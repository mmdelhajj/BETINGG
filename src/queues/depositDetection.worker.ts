import { Job } from 'bullmq';
import prisma from '../lib/prisma';
import { deleteCache } from '../lib/redis';
import { addNotificationJob } from './index';
import { getProvider } from '../services/blockchain/providers';
import {
  resolveChainId,
  getChainConfig,
  getConfirmationsRequired,
  ChainId,
} from '../config/blockchain';

export interface DepositDetectionData {
  /** ID of the Transaction record (if manually submitted) */
  transactionId?: string;
  walletId: string;
  txHash: string;
  amount: string;
  network: string;
  /** Resolved chain ID */
  chainId?: string;
  currencySymbol: string;
  /** Confirmation data from automatic detection */
  confirmations?: number;
  requiredConfirmations?: number;
  fromAddress?: string;
  networkId?: string;
}

/**
 * Deposit detection worker.
 * Verifies transactions on the actual blockchain, tracks confirmations,
 * and credits the user's balance when fully confirmed.
 */
export async function detectDeposit(job: Job<DepositDetectionData>): Promise<void> {
  const {
    transactionId,
    walletId,
    txHash,
    amount,
    network,
    currencySymbol,
    networkId,
  } = job.data;

  console.log(
    `[DepositDetection] Processing deposit job: txHash=${txHash} wallet=${walletId} currency=${currencySymbol}`
  );

  // Resolve the chain from the network name
  let chainId: ChainId;
  try {
    chainId = job.data.chainId
      ? (job.data.chainId as ChainId)
      : resolveChainId(network);
  } catch (err) {
    console.error(
      `[DepositDetection] Cannot resolve chain for network "${network}": ${(err as Error).message}`
    );
    return;
  }

  // Get blockchain provider and chain configuration
  let provider;
  try {
    provider = await getProvider(chainId);
  } catch (err) {
    console.error(
      `[DepositDetection] Failed to get provider for ${chainId}: ${(err as Error).message}`
    );
    throw err; // Retry the job
  }

  const config = getChainConfig(chainId);
  const requiredConfirmations = config.confirmationsRequired;

  // Fetch the actual transaction info from the blockchain
  let txInfo;
  try {
    txInfo = await provider.getTransactionInfo(txHash);
  } catch (err) {
    console.warn(
      `[DepositDetection] Failed to fetch tx info for ${txHash} on ${chainId}: ${(err as Error).message}`
    );
    throw err; // Retry the job
  }

  // Transaction not found on chain yet - may still be propagating
  if (!txInfo) {
    console.log(`[DepositDetection] Transaction ${txHash} not found on ${chainId}, will retry`);
    throw new Error(`Transaction ${txHash} not yet visible on ${chainId}`);
  }

  // Verify the transaction status
  if (txInfo.status === 'failed') {
    console.warn(`[DepositDetection] Transaction ${txHash} failed on ${chainId}`);
    if (transactionId) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          metadata: {
            chainId,
            network,
            failReason: 'Transaction reverted on chain',
            verifiedAt: new Date().toISOString(),
          },
        },
      });
    }
    return;
  }

  const confirmations = txInfo.confirmations;
  const isFullyConfirmed = confirmations >= requiredConfirmations;

  // Get the wallet info
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: { currency: true, user: true },
  });

  if (!wallet) {
    console.error(`[DepositDetection] Wallet ${walletId} not found`);
    return;
  }

  // Check if we already have a transaction record for this txHash
  const existingTx = transactionId
    ? await prisma.transaction.findUnique({ where: { id: transactionId } })
    : await prisma.transaction.findFirst({ where: { txHash, walletId } });

  if (existingTx) {
    // Update existing transaction
    if (existingTx.status === 'COMPLETED') {
      console.log(`[DepositDetection] Transaction ${txHash} already completed, skipping`);
      return;
    }

    if (existingTx.status === 'FAILED' || existingTx.status === 'CANCELLED') {
      console.log(`[DepositDetection] Transaction ${txHash} is ${existingTx.status}, skipping`);
      return;
    }

    // Update confirmations and possibly complete the deposit
    if (isFullyConfirmed) {
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: existingTx.id },
          data: {
            status: 'COMPLETED',
            confirmations,
            requiredConfirmations,
            fromAddress: txInfo.from || existingTx.fromAddress,
            metadata: {
              ...(existingTx.metadata as Record<string, unknown> || {}),
              chainId,
              blockNumber: txInfo.blockNumber,
              confirmedAt: new Date().toISOString(),
              verifiedOnChain: true,
            },
          },
        }),
        prisma.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: parseFloat(amount) } },
        }),
      ]);

      await deleteCache(`balance:${wallet.userId}:${currencySymbol}`);

      await addNotificationJob({
        userId: wallet.userId,
        type: 'DEPOSIT',
        title: 'Deposit Confirmed',
        message: `Your deposit of ${amount} ${currencySymbol} has been confirmed.`,
        data: { txHash, amount, currency: currencySymbol, confirmations },
      });

      console.log(
        `[DepositDetection] Deposit confirmed: ${txHash} - ${amount} ${currencySymbol} ` +
        `(${confirmations}/${requiredConfirmations} confirmations)`
      );
    } else {
      // Update confirmation count, keep as CONFIRMING
      await prisma.transaction.update({
        where: { id: existingTx.id },
        data: {
          status: 'CONFIRMING',
          confirmations,
          requiredConfirmations,
          fromAddress: txInfo.from || existingTx.fromAddress,
          metadata: {
            ...(existingTx.metadata as Record<string, unknown> || {}),
            chainId,
            blockNumber: txInfo.blockNumber,
            lastCheckedAt: new Date().toISOString(),
            verifiedOnChain: true,
          },
        },
      });

      console.log(
        `[DepositDetection] Deposit confirming: ${txHash} - ` +
        `${confirmations}/${requiredConfirmations} confirmations`
      );

      // Re-enqueue for continued monitoring
      throw new Error(
        `Awaiting confirmations: ${confirmations}/${requiredConfirmations} for ${txHash}`
      );
    }
  } else {
    // Create a new transaction record (automatic detection path)
    const status = isFullyConfirmed ? 'COMPLETED' : 'CONFIRMING';

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          walletId,
          type: 'DEPOSIT',
          amount: parseFloat(amount),
          txHash,
          fromAddress: txInfo.from,
          toAddress: wallet.depositAddress || '',
          networkId: networkId || undefined,
          status: status as any,
          confirmations,
          requiredConfirmations,
          metadata: {
            chainId,
            network,
            blockNumber: txInfo.blockNumber,
            tokenSymbol: txInfo.tokenSymbol,
            tokenAddress: txInfo.tokenAddress,
            detectedAt: new Date().toISOString(),
            verifiedOnChain: true,
          },
        },
      }),
      ...(isFullyConfirmed
        ? [
            prisma.wallet.update({
              where: { id: walletId },
              data: { balance: { increment: parseFloat(amount) } },
            }),
          ]
        : []),
    ]);

    if (isFullyConfirmed) {
      await deleteCache(`balance:${wallet.userId}:${currencySymbol}`);

      await addNotificationJob({
        userId: wallet.userId,
        type: 'DEPOSIT',
        title: 'Deposit Confirmed',
        message: `Your deposit of ${amount} ${currencySymbol} has been confirmed.`,
        data: { txHash, amount, currency: currencySymbol },
      });

      console.log(
        `[DepositDetection] New deposit confirmed: ${txHash} - ${amount} ${currencySymbol}`
      );
    } else {
      await addNotificationJob({
        userId: wallet.userId,
        type: 'DEPOSIT',
        title: 'Deposit Detected',
        message: `Deposit of ${amount} ${currencySymbol} detected. Waiting for ${requiredConfirmations - confirmations} more confirmations.`,
        data: { txHash, amount, currency: currencySymbol, confirmations, requiredConfirmations },
      });

      console.log(
        `[DepositDetection] New deposit detected (not yet confirmed): ${txHash} - ${amount} ${currencySymbol}`
      );

      // Re-enqueue for continued monitoring
      throw new Error(
        `Awaiting confirmations: ${confirmations}/${requiredConfirmations} for ${txHash}`
      );
    }
  }
}
