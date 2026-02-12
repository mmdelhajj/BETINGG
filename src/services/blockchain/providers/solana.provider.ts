// ─── Solana Blockchain Provider ─────────────────────────────────────────────
// Supports SOL native transfers and SPL token operations.
// Uses @solana/web3.js for all interactions.

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmRawTransaction,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo,
  clusterApiUrl,
} from '@solana/web3.js';
import Decimal from 'decimal.js';
import { getChainConfig, ChainConfig } from '../../../config/blockchain';
import {
  BlockchainProvider,
  TransactionInfo,
  FeeEstimate,
} from './index';

const RPC_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export class SolanaProvider implements BlockchainProvider {
  readonly chainId = 'SOL' as const;
  private connection: Connection;
  private config: ChainConfig;

  constructor() {
    this.config = getChainConfig('SOL');
    this.connection = new Connection(this.config.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60_000,
    });
  }

  // ─── Core Methods ─────────────────────────────────────────────────────────

  async getBalance(address: string): Promise<string> {
    return this.withRetry(async () => {
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      return balance.toString();
    }, 'getBalance');
  }

  async getTokenBalance(address: string, tokenMintAddress: string): Promise<string> {
    return this.withRetry(async () => {
      const pubkey = new PublicKey(address);
      const mintPubkey = new PublicKey(tokenMintAddress);

      // Find the associated token account
      const ataAddress = await this.findAssociatedTokenAddress(pubkey, mintPubkey);

      try {
        const tokenAccount = await this.connection.getTokenAccountBalance(ataAddress);
        return tokenAccount.value.amount;
      } catch {
        // Token account doesn't exist, balance is 0
        return '0';
      }
    }, 'getTokenBalance');
  }

  async getTransactionConfirmations(txHash: string): Promise<number> {
    return this.withRetry(async () => {
      const status = await this.connection.getSignatureStatus(txHash, {
        searchTransactionHistory: true,
      });

      if (!status.value) return 0;

      // Solana uses slot-based confirmations
      if (status.value.confirmationStatus === 'finalized') {
        return this.config.confirmationsRequired; // Finalized = fully confirmed
      }
      if (status.value.confirmationStatus === 'confirmed') {
        return Math.min(status.value.confirmations || 1, this.config.confirmationsRequired - 1);
      }

      return status.value.confirmations || 0;
    }, 'getTransactionConfirmations');
  }

  async getTransactionInfo(txHash: string): Promise<TransactionInfo | null> {
    return this.withRetry(async () => {
      const tx = await this.connection.getParsedTransaction(txHash, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) return null;

      const status = await this.connection.getSignatureStatus(txHash, {
        searchTransactionHistory: true,
      });

      let confirmations = 0;
      let txStatus: TransactionInfo['status'] = 'pending';

      if (status.value) {
        confirmations = status.value.confirmations || 0;
        if (status.value.confirmationStatus === 'finalized') {
          confirmations = this.config.confirmationsRequired;
          txStatus = tx.meta?.err ? 'failed' : 'confirmed';
        } else if (status.value.confirmationStatus === 'confirmed') {
          txStatus = tx.meta?.err ? 'failed' : 'confirmed';
        }
      }

      // Parse the transaction for transfer details
      const transferInfo = this.parseTransferInfo(tx);

      return {
        txHash,
        from: transferInfo.from,
        to: transferInfo.to,
        amount: transferInfo.amount,
        confirmations,
        blockNumber: tx.slot,
        status: txStatus,
        timestamp: tx.blockTime || undefined,
        tokenSymbol: transferInfo.tokenSymbol,
        tokenAddress: transferInfo.tokenAddress,
      };
    }, 'getTransactionInfo');
  }

  async broadcastTransaction(signedTxBase64: string): Promise<string> {
    return this.withRetry(async () => {
      const txBuffer = Buffer.from(signedTxBase64, 'base64');

      const signature = await this.connection.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      console.log(`[SOL] Transaction broadcast: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    }, 'broadcastTransaction');
  }

  async getBlockNumber(): Promise<number> {
    return this.withRetry(async () => {
      return await this.connection.getSlot();
    }, 'getBlockNumber');
  }

  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return PublicKey.isOnCurve(address);
    } catch {
      return false;
    }
  }

  async estimateFee(to: string, amount: string, tokenAddress?: string): Promise<FeeEstimate> {
    return this.withRetry(async () => {
      // Solana has relatively fixed fees
      const recentBlockhash = await this.connection.getLatestBlockhash();

      // Base fee for a simple SOL transfer
      let estimatedFee = 5000; // 5000 lamports = 0.000005 SOL

      if (tokenAddress) {
        // SPL token transfers cost more (need to create ATA potentially)
        estimatedFee = 20000; // Higher estimate for token transfers
      }

      // Try to get a more accurate fee estimate
      try {
        const toPubkey = new PublicKey(to);
        const fromPubkey = Keypair.generate().publicKey; // Dummy for estimation

        const tx = new Transaction({
          recentBlockhash: recentBlockhash.blockhash,
          feePayer: fromPubkey,
        });

        tx.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: parseInt(amount) || LAMPORTS_PER_SOL,
          })
        );

        const feeResult = await this.connection.getFeeForMessage(
          tx.compileMessage(),
          'confirmed'
        );

        if (feeResult.value !== null) {
          estimatedFee = feeResult.value;
        }
      } catch {
        // Use default estimate
      }

      return {
        fee: estimatedFee.toString(),
        feeRate: estimatedFee.toString(),
        estimatedTimeSeconds: Math.ceil(
          (this.config.confirmationsRequired * this.config.blockTimeMs) / 1000
        ),
      };
    }, 'estimateFee');
  }

  async getAddressTransactions(address: string, _fromBlock?: number): Promise<TransactionInfo[]> {
    return this.withRetry(async () => {
      const pubkey = new PublicKey(address);
      const transactions: TransactionInfo[] = [];

      // Get recent signatures for the address
      const signatures = await this.connection.getSignaturesForAddress(pubkey, {
        limit: 50,
      });

      for (const sigInfo of signatures) {
        try {
          const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });

          if (!tx) continue;

          const transferInfo = this.parseTransferInfo(tx);

          // Only include transactions where our address received funds
          if (transferInfo.to.toLowerCase() !== address.toLowerCase()) continue;

          const status = await this.connection.getSignatureStatus(sigInfo.signature, {
            searchTransactionHistory: true,
          });

          let confirmations = 0;
          if (status.value) {
            confirmations = status.value.confirmationStatus === 'finalized'
              ? this.config.confirmationsRequired
              : status.value.confirmations || 0;
          }

          transactions.push({
            txHash: sigInfo.signature,
            from: transferInfo.from,
            to: transferInfo.to,
            amount: transferInfo.amount,
            confirmations,
            blockNumber: tx.slot,
            status: sigInfo.err ? 'failed' : 'confirmed',
            timestamp: tx.blockTime || undefined,
            tokenSymbol: transferInfo.tokenSymbol,
            tokenAddress: transferInfo.tokenAddress,
          });
        } catch (err) {
          console.warn(`[SOL] Failed to parse transaction ${sigInfo.signature}:`, (err as Error).message);
          continue;
        }
      }

      return transactions;
    }, 'getAddressTransactions');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const slot = await Promise.race([
        this.connection.getSlot(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), RPC_TIMEOUT_MS)
        ),
      ]);
      return typeof slot === 'number' && slot > 0;
    } catch {
      return false;
    }
  }

  // ─── Solana-specific helpers ──────────────────────────────────────────────

  /**
   * Get the underlying Solana Connection for advanced operations.
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Create and sign a native SOL transfer transaction.
   * Returns the serialized transaction as base64.
   */
  async createNativeTransfer(
    secretKeyHex: string,
    to: string,
    lamports: number
  ): Promise<string> {
    const secretKey = Buffer.from(secretKeyHex, 'hex');
    const fromKeypair = Keypair.fromSecretKey(secretKey);
    const toPubkey = new PublicKey(to);

    const recentBlockhash = await this.connection.getLatestBlockhash();

    const transaction = new Transaction({
      recentBlockhash: recentBlockhash.blockhash,
      feePayer: fromKeypair.publicKey,
    });

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    transaction.sign(fromKeypair);

    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false, preflightCommitment: 'confirmed' }
    );

    console.log(`[SOL] Native transfer sent: ${signature}`);
    return signature;
  }

  /**
   * Convert lamports to SOL.
   */
  fromLamports(lamports: string): string {
    return new Decimal(lamports).div(LAMPORTS_PER_SOL).toFixed(9);
  }

  /**
   * Convert SOL to lamports.
   */
  toLamports(sol: string): string {
    return new Decimal(sol).mul(LAMPORTS_PER_SOL).toFixed(0);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async findAssociatedTokenAddress(
    walletAddress: PublicKey,
    tokenMintAddress: PublicKey
  ): Promise<PublicKey> {
    const [address] = PublicKey.findProgramAddressSync(
      [
        walletAddress.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return address;
  }

  private parseTransferInfo(tx: ParsedTransactionWithMeta): {
    from: string;
    to: string;
    amount: string;
    tokenSymbol?: string;
    tokenAddress?: string;
  } {
    const defaultResult = { from: '', to: '', amount: '0' };

    if (!tx.transaction?.message?.instructions) return defaultResult;

    // Try to find a system transfer instruction
    for (const instruction of tx.transaction.message.instructions) {
      if ('parsed' in instruction) {
        const parsed = instruction.parsed;

        // Native SOL transfer
        if (parsed?.type === 'transfer' && instruction.program === 'system') {
          return {
            from: parsed.info.source || '',
            to: parsed.info.destination || '',
            amount: (parsed.info.lamports || 0).toString(),
          };
        }

        // SPL token transfer
        if (
          (parsed?.type === 'transfer' || parsed?.type === 'transferChecked') &&
          instruction.program === 'spl-token'
        ) {
          const info = parsed.info;
          const tokenConfig = this.config.tokens.find(
            (t) => t.address === info.mint
          );

          return {
            from: info.authority || info.source || '',
            to: info.destination || '',
            amount: info.amount || info.tokenAmount?.amount || '0',
            tokenSymbol: tokenConfig?.symbol,
            tokenAddress: info.mint,
          };
        }
      }
    }

    // Fallback: check pre/post balances
    if (tx.meta && tx.transaction.message.accountKeys.length >= 2) {
      const accounts = tx.transaction.message.accountKeys;
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;

      if (preBalances.length >= 2 && postBalances.length >= 2) {
        const sender = accounts[0].pubkey?.toString() || accounts[0].toString();
        const receiver = accounts[1]?.pubkey?.toString() || accounts[1]?.toString() || '';

        const senderDiff = preBalances[0] - postBalances[0];
        if (senderDiff > 0) {
          return {
            from: sender,
            to: receiver,
            amount: Math.abs(senderDiff).toString(),
          };
        }
      }
    }

    return defaultResult;
  }

  private async withRetry<T>(fn: () => Promise<T>, operation: string, retries = MAX_RETRIES): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out`)), RPC_TIMEOUT_MS)
          ),
        ]);
      } catch (err) {
        lastError = err as Error;
        console.warn(
          `[SOL] ${operation} attempt ${attempt}/${retries} failed:`,
          lastError.message
        );

        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * attempt)
          );
        }
      }
    }

    throw new Error(
      `[SOL] ${operation} failed after ${retries} attempts: ${lastError?.message}`
    );
  }
}
