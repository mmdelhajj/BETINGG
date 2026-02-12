// ─── Withdrawal Broadcaster Service ─────────────────────────────────────────
// Signs and broadcasts withdrawal transactions to the correct blockchain.
// Tracks confirmation status and handles retries for failed broadcasts.

import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { deleteCache } from '../../lib/redis';
import { addNotificationJob } from '../../queues';
import { getProvider } from './providers';
import { EvmProvider } from './providers/evm.provider';
import { BitcoinProvider } from './providers/bitcoin.provider';
import { SolanaProvider } from './providers/solana.provider';
import { TronProvider } from './providers/tron.provider';
import { hdWalletManager } from './hdWallet';
import {
  ChainId,
  resolveChainId,
  getChainConfig,
  getTokenContract,
  isEvmChain,
  isUtxoChain,
} from '../../config/blockchain';

const MAX_BROADCAST_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;
const CONFIRMATION_POLL_INTERVAL_MS = 30_000;
const CONFIRMATION_POLL_MAX_ATTEMPTS = 60; // 30 minutes max wait

export interface WithdrawalRequest {
  transactionId: string;
  walletId: string;
  toAddress: string;
  amount: string;
  currency: string;
  network: string;
}

class WithdrawalBroadcasterService {
  /**
   * Process a withdrawal request: sign, broadcast, and track the transaction.
   */
  async processWithdrawal(request: WithdrawalRequest): Promise<string> {
    const {
      transactionId,
      walletId,
      toAddress,
      amount,
      currency,
      network,
    } = request;

    console.log(
      `[WithdrawalBroadcaster] Processing withdrawal ${transactionId}: ` +
      `${amount} ${currency} to ${toAddress} via ${network}`
    );

    // Validate the transaction still needs processing
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: { currency: true, user: true },
        },
      },
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'PENDING' && transaction.status !== 'APPROVED') {
      console.log(
        `[WithdrawalBroadcaster] Transaction ${transactionId} status is ${transaction.status}, skipping`
      );
      return '';
    }

    // Ensure HD wallet is initialized
    if (!hdWalletManager.isInitialized()) {
      await hdWalletManager.initialize();
    }

    let txHash: string;

    try {
      // Resolve the chain from the network name
      const chainId = resolveChainId(network);

      // Sign and broadcast the transaction
      txHash = await this.signAndBroadcast(chainId, toAddress, amount, currency, walletId);

      // Update the transaction with the tx hash
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          txHash,
          status: 'CONFIRMING',
          metadata: {
            ...(transaction.metadata as Record<string, unknown> || {}),
            broadcastAt: new Date().toISOString(),
            chainId,
          },
        },
      });

      console.log(
        `[WithdrawalBroadcaster] Withdrawal ${transactionId} broadcast successfully: ${txHash}`
      );

      // Start tracking confirmations asynchronously
      this.trackConfirmations(transactionId, txHash, chainId, walletId, transaction.wallet.userId, currency, amount)
        .catch((err) => {
          console.error(
            `[WithdrawalBroadcaster] Confirmation tracking failed for ${transactionId}:`,
            (err as Error).message
          );
        });

      return txHash;
    } catch (err) {
      console.error(
        `[WithdrawalBroadcaster] Withdrawal ${transactionId} failed:`,
        (err as Error).message
      );

      // Mark the transaction as failed
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          metadata: {
            ...(transaction.metadata as Record<string, unknown> || {}),
            failedAt: new Date().toISOString(),
            failReason: (err as Error).message,
          },
        },
      });

      // Refund the locked balance back to available balance
      const absAmount = new Decimal(amount).abs();
      const fee = new Decimal(transaction.fee?.toString() || '0');
      const totalLocked = absAmount.plus(fee);

      await prisma.wallet.update({
        where: { id: walletId },
        data: {
          balance: { increment: totalLocked.toNumber() },
          lockedBalance: { decrement: totalLocked.toNumber() },
        },
      });

      await deleteCache(`balance:${transaction.wallet.userId}:${currency}`);

      // Notify the user about the failure
      await addNotificationJob({
        userId: transaction.wallet.userId,
        type: 'WITHDRAWAL',
        title: 'Withdrawal Failed',
        message: `Your withdrawal of ${amount} ${currency} failed. The amount has been returned to your balance.`,
        data: {
          transactionId,
          amount,
          currency,
          reason: (err as Error).message,
        },
      });

      throw err;
    }
  }

  /**
   * Sign and broadcast a transaction based on the chain type.
   */
  private async signAndBroadcast(
    chainId: ChainId,
    toAddress: string,
    amount: string,
    currency: string,
    walletId: string
  ): Promise<string> {
    const config = getChainConfig(chainId);
    const provider = await getProvider(chainId);

    // Get the wallet's HD path index for key derivation
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || !wallet.hdPath) {
      throw new Error(`Wallet ${walletId} has no HD path for signing`);
    }

    // Extract the address index from the HD path (last segment)
    const pathParts = wallet.hdPath.split('/');
    const indexStr = pathParts[pathParts.length - 1].replace("'", '');
    const addressIndex = parseInt(indexStr, 10);

    // Derive the private key for signing
    // For EVM chains, all EVM networks use the same ETH derivation
    let derivationChain = chainId;
    if (isEvmChain(chainId)) {
      derivationChain = 'ETH';
    }

    const keyPair = hdWalletManager.deriveKeyPair(derivationChain, addressIndex);

    if (isEvmChain(chainId)) {
      return this.broadcastEvmTransaction(chainId, keyPair.privateKey, toAddress, amount, currency);
    } else if (isUtxoChain(chainId)) {
      return this.broadcastUtxoTransaction(chainId, keyPair.privateKey, keyPair.address, toAddress, amount);
    } else if (chainId === 'SOL') {
      return this.broadcastSolanaTransaction(keyPair.privateKey, toAddress, amount, currency);
    } else if (chainId === 'TRX') {
      return this.broadcastTronTransaction(keyPair.privateKey, keyPair.address, toAddress, amount, currency);
    }

    throw new Error(`Unsupported chain for withdrawal: ${chainId}`);
  }

  /**
   * Broadcast an EVM (ETH/BSC/Polygon/Arbitrum) transaction.
   */
  private async broadcastEvmTransaction(
    chainId: ChainId,
    privateKey: string,
    toAddress: string,
    amount: string,
    currency: string
  ): Promise<string> {
    const provider = await getProvider(chainId) as EvmProvider;
    const config = getChainConfig(chainId);

    // Determine if this is a native or token transfer
    const tokenContract = getTokenContract(chainId, currency);

    if (tokenContract) {
      // ERC-20 token transfer
      const amountSmallestUnit = new Decimal(amount)
        .mul(new Decimal(10).pow(tokenContract.decimals))
        .toFixed(0);

      return provider.createTokenTransfer(
        privateKey,
        tokenContract.address,
        toAddress,
        amountSmallestUnit
      );
    } else {
      // Native transfer (ETH, BNB, MATIC, etc.)
      const amountWei = new Decimal(amount)
        .mul(new Decimal(10).pow(config.nativeDecimals))
        .toFixed(0);

      return provider.createNativeTransfer(privateKey, toAddress, amountWei);
    }
  }

  /**
   * Broadcast a UTXO (BTC/LTC/DOGE) transaction.
   */
  private async broadcastUtxoTransaction(
    chainId: ChainId,
    privateKey: string,
    fromAddress: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    const provider = await getProvider(chainId) as BitcoinProvider;

    // Convert to satoshis
    const amountSatoshis = parseInt(
      new Decimal(amount).mul(new Decimal(10).pow(8)).toFixed(0)
    );

    // Get UTXOs for the address
    const utxos = await provider.getUTXOs(fromAddress);

    if (utxos.length === 0) {
      throw new Error(`No UTXOs available for ${fromAddress} on ${chainId}`);
    }

    // Estimate fee
    const feeEstimate = await provider.estimateFee(toAddress, amountSatoshis.toString());
    const feeSatoshis = parseInt(feeEstimate.fee);

    // Create the signed transaction
    const signedTxHex = provider.createSignedTransaction(
      privateKey,
      utxos,
      toAddress,
      amountSatoshis,
      feeSatoshis,
      fromAddress // Change goes back to same address
    );

    // Broadcast
    return provider.broadcastTransaction(signedTxHex);
  }

  /**
   * Broadcast a Solana transaction.
   */
  private async broadcastSolanaTransaction(
    secretKeyHex: string,
    toAddress: string,
    amount: string,
    currency: string
  ): Promise<string> {
    const provider = await getProvider('SOL') as SolanaProvider;
    const config = getChainConfig('SOL');
    const tokenContract = getTokenContract('SOL', currency);

    if (tokenContract) {
      // SPL token transfer - for now, use native transfer pattern
      // Full SPL transfer requires additional setup (ATA creation, etc.)
      throw new Error('SPL token withdrawals are not yet supported via this broadcaster');
    }

    // Native SOL transfer
    const lamports = parseInt(
      new Decimal(amount).mul(new Decimal(10).pow(config.nativeDecimals)).toFixed(0)
    );

    return provider.createNativeTransfer(secretKeyHex, toAddress, lamports);
  }

  /**
   * Broadcast a TRON transaction.
   */
  private async broadcastTronTransaction(
    privateKey: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    currency: string
  ): Promise<string> {
    const provider = await getProvider('TRX') as TronProvider;
    const config = getChainConfig('TRX');
    const tokenContract = getTokenContract('TRX', currency);

    let unsignedTx: Record<string, unknown>;

    if (tokenContract) {
      // TRC-20 token transfer
      const amountSmallestUnit = new Decimal(amount)
        .mul(new Decimal(10).pow(tokenContract.decimals))
        .toFixed(0);

      unsignedTx = await provider.createTokenTransfer(
        fromAddress,
        tokenContract.address,
        toAddress,
        amountSmallestUnit
      );
    } else {
      // Native TRX transfer
      const amountSun = parseInt(
        new Decimal(amount).mul(1_000_000).toFixed(0)
      );

      unsignedTx = await provider.createNativeTransfer(fromAddress, toAddress, amountSun);
    }

    // Sign the transaction using the private key
    // TRON uses the same ECDSA signing as Ethereum
    const { ethers } = require('ethers');
    const signingKey = new ethers.SigningKey(privateKey);
    const txID = unsignedTx.txID as string;
    const signature = signingKey.sign(Buffer.from(txID, 'hex'));

    const signedTx = {
      ...unsignedTx,
      signature: [signature.serialized.replace('0x', '')],
    };

    return provider.broadcastTransaction(JSON.stringify(signedTx));
  }

  /**
   * Track confirmation status of a broadcast transaction.
   * Polls until the required confirmations are reached or timeout.
   */
  private async trackConfirmations(
    transactionId: string,
    txHash: string,
    chainId: ChainId,
    walletId: string,
    userId: string,
    currency: string,
    amount: string
  ): Promise<void> {
    const config = getChainConfig(chainId);
    const requiredConfirmations = config.confirmationsRequired;
    const provider = await getProvider(chainId);

    let attempts = 0;

    while (attempts < CONFIRMATION_POLL_MAX_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIRMATION_POLL_INTERVAL_MS)
      );
      attempts++;

      try {
        const confirmations = await provider.getTransactionConfirmations(txHash);

        // Update confirmation count
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { confirmations },
        });

        if (confirmations >= requiredConfirmations) {
          // Transaction is fully confirmed
          const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
          });

          if (transaction && transaction.status === 'CONFIRMING') {
            const fee = new Decimal(transaction.fee?.toString() || '0');
            const amountDecimal = new Decimal(amount).abs();
            const totalLocked = amountDecimal.plus(fee);

            await prisma.$transaction([
              prisma.transaction.update({
                where: { id: transactionId },
                data: {
                  status: 'COMPLETED',
                  metadata: {
                    ...(transaction.metadata as Record<string, unknown> || {}),
                    confirmedAt: new Date().toISOString(),
                    finalConfirmations: confirmations,
                  },
                },
              }),
              prisma.wallet.update({
                where: { id: walletId },
                data: {
                  lockedBalance: { decrement: totalLocked.toNumber() },
                },
              }),
            ]);

            await deleteCache(`balance:${userId}:${currency}`);

            await addNotificationJob({
              userId,
              type: 'WITHDRAWAL',
              title: 'Withdrawal Completed',
              message: `Your withdrawal of ${amount} ${currency} has been confirmed. TX: ${txHash}`,
              data: {
                transactionId,
                amount,
                currency,
                txHash,
              },
            });

            console.log(
              `[WithdrawalBroadcaster] Withdrawal ${transactionId} confirmed: ${txHash} ` +
              `(${confirmations} confirmations)`
            );
          }

          return; // Done tracking
        }

        console.log(
          `[WithdrawalBroadcaster] Withdrawal ${transactionId}: ${confirmations}/${requiredConfirmations} confirmations`
        );
      } catch (err) {
        console.warn(
          `[WithdrawalBroadcaster] Confirmation check failed for ${txHash}:`,
          (err as Error).message
        );
      }
    }

    console.warn(
      `[WithdrawalBroadcaster] Confirmation tracking timed out for ${transactionId} (${txHash})`
    );
  }

  /**
   * Retry a failed withdrawal.
   */
  async retryWithdrawal(transactionId: string): Promise<string> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: { include: { currency: true } },
      },
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'FAILED') {
      throw new Error(`Transaction ${transactionId} is ${transaction.status}, cannot retry`);
    }

    const meta = transaction.metadata as any;

    // Reset status to APPROVED for reprocessing
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'APPROVED',
        metadata: {
          ...meta,
          retryAt: new Date().toISOString(),
          retryCount: (meta?.retryCount || 0) + 1,
        },
      },
    });

    return this.processWithdrawal({
      transactionId: transaction.id,
      walletId: transaction.walletId,
      toAddress: transaction.toAddress || '',
      amount: meta?.netAmount || Math.abs(transaction.amount.toNumber()).toString(),
      currency: transaction.wallet.currency.symbol,
      network: meta?.network || '',
    });
  }
}

// Singleton instance
export const withdrawalBroadcaster = new WithdrawalBroadcasterService();
