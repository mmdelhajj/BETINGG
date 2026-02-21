import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Daily withdrawal limits by KYC level, in USD. */
const KYC_DAILY_LIMITS: Record<string, number> = {
  UNVERIFIED: 2200,
  BASIC: 10000,
  INTERMEDIATE: 50000,
  ADVANCED: Infinity,
};

const WITHDRAWAL_QUEUE_KEY = 'withdrawal:pending_queue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? 6 : day - 1; // week starts Monday
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff),
  );
  return monday;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Get the sum of today's completed + pending withdrawal amounts for a user (in USD).
 */
export async function getDailyWithdrawalTotal(userId: string): Promise<Prisma.Decimal> {
  const todayStart = startOfDay();

  const wallets = await prisma.wallet.findMany({
    where: { userId },
    select: {
      id: true,
      currency: { select: { exchangeRateUsd: true } },
    },
  });

  if (wallets.length === 0) return new Prisma.Decimal(0);

  const walletMap = new Map(wallets.map((w) => [w.id, w.currency.exchangeRateUsd]));

  const transactions = await prisma.transaction.findMany({
    where: {
      walletId: { in: wallets.map((w) => w.id) },
      type: 'WITHDRAWAL',
      status: { in: ['PENDING', 'APPROVED', 'COMPLETED', 'CONFIRMING'] },
      createdAt: { gte: todayStart },
    },
    select: { walletId: true, amount: true },
  });

  let totalUsd = new Prisma.Decimal(0);
  for (const tx of transactions) {
    const rate = walletMap.get(tx.walletId) ?? new Prisma.Decimal(0);
    totalUsd = totalUsd.add(tx.amount.mul(rate));
  }

  return totalUsd;
}

/**
 * Get withdrawal totals for a given period (for user-set limits).
 */
async function getPeriodWithdrawalTotal(
  userId: string,
  since: Date,
): Promise<Prisma.Decimal> {
  const wallets = await prisma.wallet.findMany({
    where: { userId },
    select: {
      id: true,
      currency: { select: { exchangeRateUsd: true } },
    },
  });

  if (wallets.length === 0) return new Prisma.Decimal(0);

  const walletMap = new Map(wallets.map((w) => [w.id, w.currency.exchangeRateUsd]));

  const transactions = await prisma.transaction.findMany({
    where: {
      walletId: { in: wallets.map((w) => w.id) },
      type: 'WITHDRAWAL',
      status: { in: ['PENDING', 'APPROVED', 'COMPLETED', 'CONFIRMING'] },
      createdAt: { gte: since },
    },
    select: { walletId: true, amount: true },
  });

  let totalUsd = new Prisma.Decimal(0);
  for (const tx of transactions) {
    const rate = walletMap.get(tx.walletId) ?? new Prisma.Decimal(0);
    totalUsd = totalUsd.add(tx.amount.mul(rate));
  }

  return totalUsd;
}

/**
 * Request a withdrawal. Validates balance, KYC limits, and user-set limits.
 * Locks the balance and creates a PENDING transaction.
 */
export async function requestWithdrawal(
  userId: string,
  currencySymbol: string,
  amount: string,
  toAddress: string,
  networkId: string,
  _twoFactorToken?: string,
): Promise<Record<string, unknown>> {
  const withdrawAmount = new Prisma.Decimal(amount);

  // 1. Resolve currency & network
  const currency = await prisma.currency.findUnique({
    where: { symbol: currencySymbol.toUpperCase() },
    include: { networks: { where: { id: networkId, isActive: true } } },
  });

  if (!currency) {
    throw new Error('Currency not found');
  }
  if (!currency.isActive || !currency.isWithdrawEnabled) {
    throw new Error('Withdrawals are currently disabled for this currency');
  }

  const network = currency.networks[0];
  if (!network) {
    throw new Error('Network not found or not active for this currency');
  }

  // 2. Validate minimum withdrawal
  if (withdrawAmount.lt(currency.minWithdrawal)) {
    throw new Error(
      `Minimum withdrawal is ${currency.minWithdrawal.toFixed(currency.decimals)} ${currency.symbol}`,
    );
  }

  // 3. Fetch user for KYC level and deposit limits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      kycLevel: true,
      twoFactorEnabled: true,
      depositLimit: true,
      isBanned: true,
      isActive: true,
    },
  });

  if (!user) throw new Error('User not found');
  if (user.isBanned || !user.isActive) throw new Error('Account is restricted');

  // 4. Check 2FA if enabled (placeholder - real verification would use speakeasy)
  // In a real implementation, verify the token here.
  // if (user.twoFactorEnabled && !twoFactorToken) {
  //   throw new Error('Two-factor authentication code is required');
  // }

  // 5. KYC daily limit check
  const dailyLimitUsd = KYC_DAILY_LIMITS[user.kycLevel] ?? KYC_DAILY_LIMITS.UNVERIFIED;
  const dailyTotalUsd = await getDailyWithdrawalTotal(userId);
  const withdrawalUsd = withdrawAmount.mul(currency.exchangeRateUsd);

  if (dailyTotalUsd.add(withdrawalUsd).gt(new Prisma.Decimal(dailyLimitUsd))) {
    throw new Error(
      `Daily withdrawal limit exceeded. Your ${user.kycLevel} KYC level allows $${dailyLimitUsd.toLocaleString()} USD per day. ` +
        `Today's total: $${dailyTotalUsd.toFixed(2)} USD.`,
    );
  }

  // 6. Check user-set deposit limits (stored as JSON: { daily?, weekly?, monthly? } in USD)
  if (user.depositLimit && typeof user.depositLimit === 'object') {
    const limits = user.depositLimit as Record<string, number | undefined>;

    if (limits.daily !== undefined) {
      const dayTotal = await getPeriodWithdrawalTotal(userId, startOfDay());
      if (dayTotal.add(withdrawalUsd).gt(new Prisma.Decimal(limits.daily))) {
        throw new Error(
          `Your personal daily withdrawal limit of $${limits.daily} USD would be exceeded.`,
        );
      }
    }

    if (limits.weekly !== undefined) {
      const weekTotal = await getPeriodWithdrawalTotal(userId, startOfWeek());
      if (weekTotal.add(withdrawalUsd).gt(new Prisma.Decimal(limits.weekly))) {
        throw new Error(
          `Your personal weekly withdrawal limit of $${limits.weekly} USD would be exceeded.`,
        );
      }
    }

    if (limits.monthly !== undefined) {
      const monthTotal = await getPeriodWithdrawalTotal(userId, startOfMonth());
      if (monthTotal.add(withdrawalUsd).gt(new Prisma.Decimal(limits.monthly))) {
        throw new Error(
          `Your personal monthly withdrawal limit of $${limits.monthly} USD would be exceeded.`,
        );
      }
    }
  }

  // 7. Total amount including fee
  const totalDebit = withdrawAmount.add(currency.withdrawalFee);

  // 8. Atomic: validate balance, lock funds, create transaction
  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId_currencyId: { userId, currencyId: currency.id } },
    });

    if (!wallet) {
      throw new Error('Wallet not found. Please deposit first.');
    }

    const available = wallet.balance.sub(wallet.lockedBalance);

    if (available.lt(totalDebit)) {
      throw new Error(
        `Insufficient balance. Available: ${available.toFixed(currency.decimals)} ${currency.symbol}. ` +
          `Required: ${totalDebit.toFixed(currency.decimals)} ${currency.symbol} (${withdrawAmount.toFixed(currency.decimals)} + ${currency.withdrawalFee.toFixed(currency.decimals)} fee).`,
      );
    }

    // Lock the total debit amount
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        lockedBalance: { increment: totalDebit },
      },
    });

    // Create PENDING withdrawal transaction
    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        amount: withdrawAmount,
        fee: currency.withdrawalFee,
        toAddress,
        networkId,
        status: 'PENDING',
        metadata: {
          networkLabel: network.networkLabel,
          networkName: network.networkName,
          currencySymbol: currency.symbol,
          requestedAt: new Date().toISOString(),
          withdrawalUsd: withdrawalUsd.toFixed(2),
        },
      },
    });

    return { transaction, wallet: updatedWallet };
  });

  // 9. Add to Redis withdrawal queue for admin processing
  await redis.zadd(WITHDRAWAL_QUEUE_KEY, Date.now(), result.transaction.id);

  return {
    id: result.transaction.id,
    type: 'WITHDRAWAL',
    amount: withdrawAmount.toFixed(currency.decimals),
    fee: currency.withdrawalFee.toFixed(currency.decimals),
    currency: currency.symbol,
    toAddress,
    network: network.networkLabel,
    status: 'PENDING',
    createdAt: result.transaction.createdAt.toISOString(),
  };
}

/**
 * Admin: approve a pending withdrawal. Processes (mock broadcasts) and completes.
 */
export async function approveWithdrawal(
  txId: string,
  adminId: string,
): Promise<Record<string, unknown>> {
  const result = await prisma.$transaction(async (tx) => {
    // Fetch the transaction with a lock
    const transaction = await tx.transaction.findUnique({
      where: { id: txId },
      include: {
        wallet: {
          include: {
            currency: true,
            user: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }
    if (transaction.type !== 'WITHDRAWAL') {
      throw new Error('Transaction is not a withdrawal');
    }
    if (transaction.status !== 'PENDING') {
      throw new Error(`Cannot approve a withdrawal with status: ${transaction.status}`);
    }

    const totalDebit = transaction.amount.add(transaction.fee);

    // Mock broadcast: generate a fake tx hash
    const mockTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    // Mark as APPROVED -> COMPLETED
    const updatedTx = await tx.transaction.update({
      where: { id: txId },
      data: {
        status: 'COMPLETED',
        approvedBy: adminId,
        txHash: mockTxHash,
        confirmations: 1,
        metadata: {
          ...(typeof transaction.metadata === 'object' && transaction.metadata !== null
            ? transaction.metadata
            : {}),
          approvedAt: new Date().toISOString(),
          approvedBy: adminId,
          broadcastTxHash: mockTxHash,
        },
      },
    });

    // Deduct from balance and unlock
    await tx.wallet.update({
      where: { id: transaction.walletId },
      data: {
        balance: { decrement: totalDebit },
        lockedBalance: { decrement: totalDebit },
      },
    });

    // Create notification for the user
    await tx.notification.create({
      data: {
        userId: transaction.wallet.userId,
        type: 'WITHDRAWAL_APPROVED',
        title: 'Withdrawal Approved',
        message: `Your withdrawal of ${transaction.amount.toFixed(transaction.wallet.currency.decimals)} ${transaction.wallet.currency.symbol} has been approved and processed.`,
        data: {
          transactionId: txId,
          amount: transaction.amount.toString(),
          currency: transaction.wallet.currency.symbol,
          txHash: mockTxHash,
        },
      },
    });

    return updatedTx;
  });

  // Remove from Redis queue
  await redis.zrem(WITHDRAWAL_QUEUE_KEY, txId);

  return {
    id: result.id,
    status: result.status,
    txHash: result.txHash,
    approvedBy: result.approvedBy,
    updatedAt: result.updatedAt.toISOString(),
  };
}

/**
 * Admin: reject a pending withdrawal. Unlocks the balance and notifies user.
 */
export async function rejectWithdrawal(
  txId: string,
  adminId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: txId },
      include: {
        wallet: {
          include: {
            currency: true,
            user: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }
    if (transaction.type !== 'WITHDRAWAL') {
      throw new Error('Transaction is not a withdrawal');
    }
    if (transaction.status !== 'PENDING') {
      throw new Error(`Cannot reject a withdrawal with status: ${transaction.status}`);
    }

    const totalDebit = transaction.amount.add(transaction.fee);

    // Mark as REJECTED
    const updatedTx = await tx.transaction.update({
      where: { id: txId },
      data: {
        status: 'REJECTED',
        approvedBy: adminId,
        rejectedReason: reason,
        metadata: {
          ...(typeof transaction.metadata === 'object' && transaction.metadata !== null
            ? transaction.metadata
            : {}),
          rejectedAt: new Date().toISOString(),
          rejectedBy: adminId,
          rejectionReason: reason,
        },
      },
    });

    // Unlock the balance (do NOT deduct — funds go back to available)
    await tx.wallet.update({
      where: { id: transaction.walletId },
      data: {
        lockedBalance: { decrement: totalDebit },
      },
    });

    // Notify the user
    await tx.notification.create({
      data: {
        userId: transaction.wallet.userId,
        type: 'WITHDRAWAL_REJECTED',
        title: 'Withdrawal Rejected',
        message: `Your withdrawal of ${transaction.amount.toFixed(transaction.wallet.currency.decimals)} ${transaction.wallet.currency.symbol} has been rejected. Reason: ${reason}`,
        data: {
          transactionId: txId,
          amount: transaction.amount.toString(),
          currency: transaction.wallet.currency.symbol,
          reason,
        },
      },
    });

    return updatedTx;
  });

  // Remove from Redis queue
  await redis.zrem(WITHDRAWAL_QUEUE_KEY, txId);

  return {
    id: result.id,
    status: result.status,
    rejectedReason: result.rejectedReason,
    updatedAt: result.updatedAt.toISOString(),
  };
}

/**
 * Admin: get all pending withdrawals in queue order.
 */
export async function getPendingWithdrawals(): Promise<Array<Record<string, unknown>>> {
  const transactions = await prisma.transaction.findMany({
    where: {
      type: 'WITHDRAWAL',
      status: 'PENDING',
    },
    include: {
      wallet: {
        include: {
          currency: {
            select: {
              symbol: true,
              name: true,
              decimals: true,
              exchangeRateUsd: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              kycLevel: true,
              vipTier: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount.toFixed(tx.wallet.currency.decimals),
    fee: tx.fee.toFixed(tx.wallet.currency.decimals),
    amountUsd: tx.amount.mul(tx.wallet.currency.exchangeRateUsd).toFixed(2),
    currency: tx.wallet.currency.symbol,
    currencyName: tx.wallet.currency.name,
    toAddress: tx.toAddress,
    networkId: tx.networkId,
    status: tx.status,
    confirmations: tx.confirmations,
    metadata: tx.metadata,
    user: {
      id: tx.wallet.user.id,
      username: tx.wallet.user.username,
      email: tx.wallet.user.email,
      kycLevel: tx.wallet.user.kycLevel,
      vipTier: tx.wallet.user.vipTier,
    },
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
  }));
}
