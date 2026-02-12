import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { Decimal } from '@prisma/client/runtime/library';

export class AdminService {
  // ─── Dashboard KPIs ───────────────────────────────────────
  async getDashboardKPIs() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers, activeToday, newToday,
      betsToday, pendingWithdrawals, activeEvents,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastLoginAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.bet.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
      prisma.event.count({ where: { status: 'LIVE' } }),
    ]);

    // Revenue calculations
    const todayBets = await prisma.bet.findMany({
      where: { createdAt: { gte: todayStart } },
      select: { stake: true, actualWin: true, status: true },
    });

    let revenueToday = new Decimal(0);
    for (const bet of todayBets) {
      if (bet.status === 'LOST') revenueToday = revenueToday.add(bet.stake);
      if (bet.status === 'WON' && bet.actualWin) revenueToday = revenueToday.sub(bet.actualWin.sub(bet.stake));
    }

    // Deposit/withdrawal volumes today
    const [depositsToday, withdrawalsToday] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
    ]);

    return {
      users: { total: totalUsers, activeToday, newToday },
      bets: { today: betsToday },
      revenue: { today: revenueToday.toString() },
      deposits: { today: depositsToday._sum.amount?.toString() || '0' },
      withdrawals: { today: withdrawalsToday._sum.amount?.toString() || '0' },
      pendingWithdrawals,
      activeEvents,
    };
  }

  // ─── Revenue Chart Data ───────────────────────────────────
  async getRevenueChart(days = 30) {
    const points: { date: string; revenue: string; deposits: string; withdrawals: string }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const label = dayStart.toISOString().slice(0, 10);

      const [bets, deps, wds] = await Promise.all([
        prisma.bet.findMany({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
          select: { stake: true, actualWin: true, status: true },
        }),
        prisma.transaction.aggregate({
          where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: dayStart, lt: dayEnd } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: dayStart, lt: dayEnd } },
          _sum: { amount: true },
        }),
      ]);

      let rev = new Decimal(0);
      for (const b of bets) {
        if (b.status === 'LOST') rev = rev.add(b.stake);
        if (b.status === 'WON' && b.actualWin) rev = rev.sub(b.actualWin.sub(b.stake));
      }

      points.push({
        date: label,
        revenue: rev.toString(),
        deposits: deps._sum.amount?.toString() || '0',
        withdrawals: wds._sum.amount?.toString() || '0',
      });
    }

    return points;
  }

  // ─── User Management ──────────────────────────────────────
  async searchUsers(opts: { query?: string; page?: number; limit?: number; vipTier?: string }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 20, 100);
    const where: any = {};

    if (opts.query) {
      where.OR = [
        { email: { contains: opts.query, mode: 'insensitive' } },
        { username: { contains: opts.query, mode: 'insensitive' } },
        { id: opts.query },
      ];
    }
    if (opts.vipTier) where.vipTier = opts.vipTier;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, email: true, username: true, role: true, vipTier: true,
          kycLevel: true, isActive: true, createdAt: true, lastLoginAt: true,
          totalWagered: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } },
        bets: { orderBy: { createdAt: 'desc' }, take: 20 },
        kycDocuments: true,
      },
    });
    return user;
  }

  async banUser(userId: string, reason: string, adminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
    await prisma.auditLog.create({
      data: {
        userId, adminId, action: 'user_banned',
        resource: 'user', resourceId: userId,
        details: { reason },
      },
    });
  }

  async unbanUser(userId: string, adminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
    await prisma.auditLog.create({
      data: {
        userId, adminId, action: 'user_unbanned',
        resource: 'user', resourceId: userId,
      },
    });
  }

  async adjustBalance(userId: string, walletId: string, amount: string, reason: string, adminId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new Error('Wallet not found');

    const adjustment = new Decimal(amount);
    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: adjustment } },
      }),
      prisma.transaction.create({
        data: {
          walletId,
          type: adjustment.isPositive() ? 'BONUS' : 'ADJUSTMENT',
          amount: adjustment.abs(),
          status: 'COMPLETED',
          metadata: { reason, adminId },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId, adminId, action: 'balance_adjusted',
          resource: 'wallet', resourceId: walletId,
          details: { amount, reason, currencyId: wallet.currencyId },
        },
      }),
    ]);
  }

  async changeVipTier(userId: string, tier: string, adminId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { vipTier: tier as any },
    });
    await prisma.auditLog.create({
      data: {
        userId, adminId, action: 'vip_tier_changed',
        resource: 'user', resourceId: userId,
        details: { newTier: tier },
      },
    });
  }

  // ─── Bet Management ───────────────────────────────────────
  async searchBets(opts: { page?: number; limit?: number; status?: string; userId?: string; minStake?: string }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 20, 100);
    const where: any = {};

    if (opts.status) where.status = opts.status;
    if (opts.userId) where.userId = opts.userId;
    if (opts.minStake) where.stake = { gte: new Decimal(opts.minStake) };

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { username: true, email: true } }, legs: true },
      }),
      prisma.bet.count({ where }),
    ]);

    return { bets, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  // ─── Financial Reports ────────────────────────────────────
  async getFinancialReport(period: 'daily' | 'weekly' | 'monthly') {
    const now = new Date();
    let startDate: Date;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      startDate = new Date(now.getTime() - 7 * 86400000);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [deposits, withdrawals, bets, casinoGames] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.bet.findMany({
        where: { createdAt: { gte: startDate } },
        select: { stake: true, actualWin: true, status: true },
      }),
      prisma.casinoSession.aggregate({
        where: { startedAt: { gte: startDate } },
        _sum: { totalBet: true, totalWin: true },
        _count: true,
      }),
    ]);

    let sportsbookRevenue = new Decimal(0);
    for (const b of bets) {
      if (b.status === 'LOST') sportsbookRevenue = sportsbookRevenue.add(b.stake);
      if (b.status === 'WON' && b.actualWin) sportsbookRevenue = sportsbookRevenue.sub(b.actualWin.sub(b.stake));
    }

    const casinoBets = casinoGames._sum.totalBet || new Decimal(0);
    const casinoWins = casinoGames._sum.totalWin || new Decimal(0);
    const casinoGGR = casinoBets.sub(casinoWins);

    return {
      period,
      startDate: startDate.toISOString(),
      deposits: {
        total: deposits._sum.amount?.toString() || '0',
        count: deposits._count,
      },
      withdrawals: {
        total: withdrawals._sum.amount?.toString() || '0',
        count: withdrawals._count,
      },
      sportsbook: {
        totalStaked: bets.reduce((s, b) => s.add(b.stake), new Decimal(0)).toString(),
        revenue: sportsbookRevenue.toString(),
        betCount: bets.length,
      },
      casino: {
        totalBets: casinoBets.toString(),
        totalWins: casinoWins.toString(),
        ggr: casinoGGR.toString(),
        sessionCount: casinoGames._count,
      },
      totalRevenue: sportsbookRevenue.add(casinoGGR).toString(),
    };
  }

  // ─── Risk Management ──────────────────────────────────────
  async getLargeBets(threshold: string, limit = 50) {
    return prisma.bet.findMany({
      where: { stake: { gte: new Decimal(threshold) } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, username: true, email: true, vipTier: true } } },
    });
  }

  async getWinRateAnomalies(minBets = 50, winRateThreshold = 0.7) {
    const users = await prisma.user.findMany({
      include: { _count: { select: { bets: true } } },
    });

    const anomalies: any[] = [];
    for (const user of users) {
      if (user._count.bets < minBets) continue;

      const [totalBets, wonBets] = await Promise.all([
        prisma.bet.count({ where: { userId: user.id, status: { in: ['WON', 'LOST'] } } }),
        prisma.bet.count({ where: { userId: user.id, status: 'WON' } }),
      ]);

      if (totalBets === 0) continue;
      const winRate = wonBets / totalBets;
      if (winRate >= winRateThreshold) {
        anomalies.push({
          userId: user.id,
          username: user.username,
          email: user.email,
          totalBets,
          wonBets,
          winRate: (winRate * 100).toFixed(1),
        });
      }
    }

    return anomalies;
  }

  async getDuplicateAccounts() {
    const logs = await prisma.auditLog.findMany({
      where: { action: 'login' },
      select: { userId: true, ipAddress: true },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const ipToUsers: Record<string, Set<string>> = {};
    for (const log of logs) {
      if (!log.ipAddress || !log.userId) continue;
      if (!ipToUsers[log.ipAddress]) ipToUsers[log.ipAddress] = new Set();
      ipToUsers[log.ipAddress].add(log.userId);
    }

    return Object.entries(ipToUsers)
      .filter(([, users]) => users.size > 1)
      .map(([ip, users]) => ({ ip, userIds: Array.from(users), accountCount: users.size }))
      .sort((a, b) => b.accountCount - a.accountCount);
  }

  // ─── Site Settings ────────────────────────────────────────
  async getSiteConfig() {
    const configs = await prisma.siteConfig.findMany();
    const result: Record<string, any> = {};
    for (const c of configs) result[c.key] = c.value;
    return result;
  }

  async updateSiteConfig(key: string, value: any, adminId: string) {
    const config = await prisma.siteConfig.upsert({
      where: { key },
      update: { value, updatedBy: adminId },
      create: { key, value, updatedBy: adminId },
    });

    // Invalidate cache
    await redis.del(`config:${key}`);
    return config;
  }

  // ─── Audit Log ────────────────────────────────────────────
  async getAuditLog(opts: { page?: number; limit?: number; action?: string; userId?: string }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 50, 200);
    const where: any = {};

    if (opts.action) where.action = opts.action;
    if (opts.userId) where.userId = opts.userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, meta: { page, limit, total, hasMore: page * limit < total } };
  }
}

export const adminService = new AdminService();
