import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { NotFoundError, AppError } from '../../utils/errors';

export class AdminWalletService {
  async getAdminWallets() {
    const wallets = await prisma.adminWallet.findMany({
      orderBy: { currencySymbol: 'asc' },
    });

    return wallets.map((w) => ({
      id: w.id,
      currencySymbol: w.currencySymbol,
      network: w.network,
      address: w.address,
      label: w.label,
      balance: w.balance.toString(),
      isActive: w.isActive,
    }));
  }

  async getAdminWallet(id: string) {
    const wallet = await prisma.adminWallet.findUnique({ where: { id } });
    if (!wallet) throw new NotFoundError('AdminWallet', id);
    return wallet;
  }

  async updateBalance(id: string, balance: string) {
    const wallet = await prisma.adminWallet.findUnique({ where: { id } });
    if (!wallet) throw new NotFoundError('AdminWallet', id);

    return prisma.adminWallet.update({
      where: { id },
      data: { balance: parseFloat(balance) },
    });
  }

  async getPlatformStats() {
    const [totalUsers, totalDeposits, totalWithdrawals, totalBets, adminWallets] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'WITHDRAWAL', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.bet.aggregate({
        _sum: { stake: true },
        _count: true,
      }),
      prisma.adminWallet.findMany({ where: { isActive: true } }),
    ]);

    const platformBalance = adminWallets.reduce(
      (sum, w) => sum.plus(new Decimal(w.balance.toString())),
      new Decimal(0)
    );

    return {
      totalUsers,
      totalDeposits: totalDeposits._sum.amount?.toString() || '0',
      totalWithdrawals: Math.abs(totalWithdrawals._sum.amount?.toNumber() || 0).toString(),
      totalBets: totalBets._count,
      totalWagered: totalBets._sum.stake?.toString() || '0',
      platformBalance: platformBalance.toString(),
    };
  }

  async getRevenueReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const [deposits, withdrawals, bets, rewards] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.bet.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _sum: { stake: true, potentialWin: true },
        _count: true,
      }),
      prisma.reward.aggregate({
        where: { status: 'CLAIMED', claimedAt: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      period: { start: startDate, end: endDate },
      deposits: { total: deposits._sum.amount?.toString() || '0', count: deposits._count },
      withdrawals: { total: Math.abs(withdrawals._sum.amount?.toNumber() || 0).toString(), count: withdrawals._count },
      betting: {
        totalWagered: bets._sum.stake?.toString() || '0',
        totalPotentialWin: bets._sum.potentialWin?.toString() || '0',
        count: bets._count,
      },
      rewards: { total: rewards._sum.amount?.toString() || '0', count: rewards._count },
    };
  }
}

export const adminWalletService = new AdminWalletService();
