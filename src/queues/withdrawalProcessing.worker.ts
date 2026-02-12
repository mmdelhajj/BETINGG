import { Job } from 'bullmq';
import prisma from '../lib/prisma';
import Decimal from 'decimal.js';
import { deleteCache } from '../lib/redis';
import { addNotificationJob } from './index';
import { withdrawalBroadcaster } from '../services/blockchain/withdrawalBroadcaster';

export interface WithdrawalProcessingData {
  transactionId: string;
  walletId: string;
  amount: string;
  toAddress: string;
  /** Network name or chain ID */
  network: string;
  networkId?: string;
  currencySymbol: string;
  /** Alias for currencySymbol in legacy code */
  currency?: string;
}

/**
 * Withdrawal processing worker.
 * Signs and broadcasts withdrawal transactions to the blockchain
 * via the WithdrawalBroadcaster service.
 */
export async function processWithdrawal(job: Job<WithdrawalProcessingData>): Promise<void> {
  const {
    transactionId,
    walletId,
    amount,
    toAddress,
    currencySymbol,
    currency,
    network,
  } = job.data;

  const symbol = currencySymbol || currency || '';

  console.log(
    `[WithdrawalProcessing] Processing withdrawal ${transactionId}: ` +
    `${amount} ${symbol} to ${toAddress} via ${network}`
  );

  try {
    // Validate the transaction exists and is in the correct state
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { wallet: { include: { user: true, currency: true } } },
    });

    if (!transaction) {
      console.error(`[WithdrawalProcessing] Transaction ${transactionId} not found`);
      return;
    }

    // Accept both PENDING (auto-approved) and APPROVED (admin-approved) statuses
    if (transaction.status !== 'PENDING' && transaction.status !== 'APPROVED') {
      console.log(
        `[WithdrawalProcessing] Transaction ${transactionId} status is ${transaction.status}, skipping`
      );
      return;
    }

    // Mark as processing to prevent double-processing
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'APPROVED',
        metadata: {
          ...(transaction.metadata as Record<string, unknown> || {}),
          processingStartedAt: new Date().toISOString(),
          processingJobId: job.id,
        },
      },
    });

    // Delegate to the withdrawal broadcaster for real blockchain transaction
    const txHash = await withdrawalBroadcaster.processWithdrawal({
      transactionId,
      walletId,
      toAddress,
      amount,
      currency: symbol,
      network,
    });

    console.log(
      `[WithdrawalProcessing] Withdrawal ${transactionId} broadcast: ${txHash}`
    );
  } catch (error) {
    const errorMessage = (error as Error).message || String(error);
    console.error(`[WithdrawalProcessing] Withdrawal ${transactionId} failed:`, errorMessage);

    // Check if this is a retryable error
    const isRetryable = isRetryableError(errorMessage);

    if (isRetryable && (job.attemptsMade || 0) < (job.opts?.attempts || 5) - 1) {
      console.log(
        `[WithdrawalProcessing] Will retry withdrawal ${transactionId} ` +
        `(attempt ${(job.attemptsMade || 0) + 1}/${job.opts?.attempts || 5})`
      );
      throw error; // Re-throw to trigger BullMQ retry
    }

    // Final failure - the withdrawal broadcaster handles status update and refund
    // Just log and don't re-throw
    console.error(
      `[WithdrawalProcessing] Withdrawal ${transactionId} permanently failed after ` +
      `${(job.attemptsMade || 0) + 1} attempts: ${errorMessage}`
    );
  }
}

/**
 * Determine if an error is retryable (network issues, timeouts, etc).
 */
function isRetryableError(message: string): boolean {
  const retryablePatterns = [
    'timeout',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'rate limit',
    'too many requests',
    'service unavailable',
    '503',
    '502',
    '429',
    'nonce too low',
    'replacement transaction underpriced',
    'already known',
    'not yet visible',
  ];

  const lowerMessage = message.toLowerCase();
  return retryablePatterns.some((pattern) => lowerMessage.includes(pattern.toLowerCase()));
}
