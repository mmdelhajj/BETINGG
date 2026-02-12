import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { AppError, NotFoundError, InsufficientBalanceError, ValidationError } from '../../utils/errors';
import { deleteCache } from '../../lib/redis';
import { addWithdrawalProcessingJob } from '../../queues';
import { WITHDRAWAL } from '../../config/constants';

export class WithdrawalService {
  async requestWithdrawal(
    userId: string,
    currencySymbol: string,
    amount: string,
    address: string,
    network: string
  ) {
    const amountDecimal = new Decimal(amount);
    if (amountDecimal.lte(0)) throw new ValidationError('Withdrawal amount must be positive');

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currencySymbol } },
      include: { currency: { include: { networks: true } } },
    });
    if (!wallet) throw new NotFoundError('Wallet', currencySymbol);

    const balance = new Decimal(wallet.balance.toString());
    if (balance.lt(amountDecimal)) throw new InsufficientBalanceError();

    const networkConfig = wallet.currency.networks.find((n) => n.networkName === network);
    if (!networkConfig || !networkConfig.isActive) {
      throw new ValidationError(`Network ${network} is not available for ${currencySymbol}`);
    }

    const minWithdrawal = new Decimal(wallet.currency.minWithdrawal?.toString() || '0');
    if (amountDecimal.lt(minWithdrawal)) {
      throw new ValidationError(`Minimum withdrawal is ${minWithdrawal} ${currencySymbol}`);
    }

    const fee = new Decimal(wallet.currency.withdrawalFee?.toString() || '0');
    const netAmount = amountDecimal.minus(fee);
    if (netAmount.lte(0)) throw new ValidationError('Amount after fee must be positive');

    await this.checkWithdrawalLimits(userId, amountDecimal);

    const needsReview = amountDecimal.gte(WITHDRAWAL.AUTO_APPROVE_THRESHOLD_USD);

    const tx = await prisma.$transaction(async (txn) => {
      await txn.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amountDecimal.toNumber() },
          lockedBalance: { increment: amountDecimal.toNumber() },
        },
      });

      return txn.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: amountDecimal.negated().toNumber(),
          fee: fee.toNumber(),
          status: 'PENDING',
          toAddress: address,
          metadata: { network, netAmount: netAmount.toString(), fee: fee.toString(), needsReview },
        },
      });
    });

    await deleteCache(`balance:${userId}:${currencySymbol}`);

    if (!needsReview) {
      await addWithdrawalProcessingJob({
        transactionId: tx.id,
        walletId: wallet.id,
        toAddress: address,
        amount: netAmount.toString(),
        currency: currencySymbol,
        network,
      });
    }

    return {
      transactionId: tx.id,
      status: 'PENDING',
      needsReview,
      amount,
      fee: fee.toString(),
      netAmount: netAmount.toString(),
      currency: currencySymbol,
      address,
      network,
    };
  }

  async cancelWithdrawal(userId: string, transactionId: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { wallet: { include: { currency: true } } },
    });

    if (!tx) throw new NotFoundError('Transaction', transactionId);
    if (tx.wallet.userId !== userId) throw new AppError('FORBIDDEN', 'Not your transaction', 403);
    if (tx.status !== 'PENDING') {
      throw new AppError('CANNOT_CANCEL', 'Transaction cannot be cancelled', 400);
    }

    const absAmount = Math.abs(tx.amount.toNumber());

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'CANCELLED' },
      }),
      prisma.wallet.update({
        where: { id: tx.walletId },
        data: {
          balance: { increment: absAmount },
          lockedBalance: { decrement: absAmount },
        },
      }),
    ]);

    await deleteCache(`balance:${userId}:${tx.wallet.currency.symbol}`);
    return { transactionId, status: 'CANCELLED' };
  }

  async approveWithdrawal(transactionId: string, adminId: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { wallet: { include: { currency: true } } },
    });

    if (!tx) throw new NotFoundError('Transaction', transactionId);
    const meta = tx.metadata as any;
    if (tx.status !== 'PENDING' || !meta?.needsReview) {
      throw new AppError('INVALID_STATUS', 'Transaction is not pending review', 400);
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'APPROVED', metadata: { ...meta, approvedBy: adminId, needsReview: false } },
    });

    await addWithdrawalProcessingJob({
      transactionId: tx.id,
      walletId: tx.walletId,
      toAddress: tx.toAddress!,
      amount: meta.netAmount,
      currency: tx.wallet.currency.symbol,
      network: meta.network,
    });

    return { transactionId, status: 'APPROVED' };
  }

  async rejectWithdrawal(transactionId: string, adminId: string, reason: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { wallet: { include: { currency: true } } },
    });

    if (!tx) throw new NotFoundError('Transaction', transactionId);
    const meta = tx.metadata as any;
    if (tx.status !== 'PENDING' || !meta?.needsReview) {
      throw new AppError('INVALID_STATUS', 'Transaction is not pending review', 400);
    }

    const absAmount = Math.abs(tx.amount.toNumber());

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'REJECTED',
          metadata: { ...meta, rejectedBy: adminId, rejectReason: reason, needsReview: false },
        },
      }),
      prisma.wallet.update({
        where: { id: tx.walletId },
        data: {
          balance: { increment: absAmount },
          lockedBalance: { decrement: absAmount },
        },
      }),
    ]);

    await deleteCache(`balance:${tx.wallet.userId}:${tx.wallet.currency.symbol}`);
    return { transactionId, status: 'REJECTED' };
  }

  async getPendingWithdrawals(options: { page: number; limit: number }) {
    const { page, limit } = options;
    const whereClause = {
      type: 'WITHDRAWAL' as const,
      status: 'PENDING' as const,
      metadata: { path: ['needsReview'], equals: true },
    };
    const [withdrawals, total] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          wallet: {
            include: {
              currency: true,
              user: { select: { id: true, email: true, username: true, kycLevel: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where: whereClause }),
    ]);

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: Math.abs(w.amount.toNumber()).toString(),
        currency: w.wallet.currency.symbol,
        toAddress: w.toAddress,
        user: w.wallet.user,
        createdAt: w.createdAt.toISOString(),
      })),
      meta: { page, total, hasMore: page * limit < total },
    };
  }

  private async checkWithdrawalLimits(userId: string, amount: Decimal) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayWithdrawals = await prisma.transaction.aggregate({
      where: {
        wallet: { userId },
        type: 'WITHDRAWAL',
        status: { notIn: ['CANCELLED', 'REJECTED'] },
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const todayTotal = new Decimal(Math.abs(todayWithdrawals._sum.amount?.toNumber() || 0));
    if (todayTotal.plus(amount).gt(WITHDRAWAL.LARGE_WITHDRAWAL_THRESHOLD_USD)) {
      throw new AppError('DAILY_LIMIT', 'Daily withdrawal limit exceeded', 400);
    }
  }
}

export const withdrawalService = new WithdrawalService();
