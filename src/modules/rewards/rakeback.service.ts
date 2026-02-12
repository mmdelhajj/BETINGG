import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';

export class RakebackService {
  /**
   * Calculate rakeback for a bet
   */
  async calculateRakeback(
    userId: string,
    stakeAmount: string,
    houseEdge: number = 0.03
  ): Promise<{ walletAmount: string; calendarAmount: string; totalRakeback: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { welcomePackage: true },
    });
    if (!user) return { walletAmount: '0', calendarAmount: '0', totalRakeback: '0' };

    const tierConfig = await prisma.vipTierConfig.findUnique({
      where: { tier: user.vipTier },
    });
    if (!tierConfig) return { walletAmount: '0', calendarAmount: '0', totalRakeback: '0' };

    const stake = new Decimal(stakeAmount);
    let rakebackPercent = new Decimal(tierConfig.rakebackPercent.toString()).div(100);

    // Check welcome package
    if (user.welcomePackage?.isActive && new Date() < user.welcomePackage.expiresAt) {
      const welcomePercent = new Decimal(user.welcomePackage.rakebackPercent.toString()).div(100);
      if (welcomePercent.gt(rakebackPercent)) {
        rakebackPercent = welcomePercent;
      }
    }

    // Check turbo boost
    const turboSession = await prisma.turboSession.findFirst({
      where: { userId, isActive: true, endsAt: { gt: new Date() } },
    });
    if (turboSession) {
      const turboBoost = new Decimal(turboSession.boostPercent.toString()).div(100);
      rakebackPercent = rakebackPercent.plus(turboBoost);
    }

    const totalRakeback = stake.mul(houseEdge).mul(rakebackPercent);
    const calendarSplit = new Decimal(tierConfig.calendarSplitPercent.toString()).div(100);
    const walletAmount = totalRakeback.mul(new Decimal(1).minus(calendarSplit));
    const calendarAmount = totalRakeback.mul(calendarSplit);

    return {
      walletAmount: walletAmount.toDecimalPlaces(8).toString(),
      calendarAmount: calendarAmount.toDecimalPlaces(8).toString(),
      totalRakeback: totalRakeback.toDecimalPlaces(8).toString(),
    };
  }

  /**
   * Get accumulated unclaimed rakeback for a user
   */
  async getAccumulatedRakeback(userId: string) {
    const rewards = await prisma.reward.findMany({
      where: { userId, type: 'RAKEBACK', status: 'CLAIMABLE' },
    });

    const total = rewards.reduce(
      (sum, r) => sum.plus(new Decimal(r.amount.toString())),
      new Decimal(0)
    );

    return {
      total: total.toString(),
      count: rewards.length,
      currency: 'USDT',
    };
  }

  /**
   * Claim accumulated rakeback (add to wallet)
   */
  async claimRakeback(userId: string): Promise<{ claimed: string; activatedTurbo: boolean }> {
    const rewards = await prisma.reward.findMany({
      where: { userId, type: 'RAKEBACK', status: 'CLAIMABLE' },
    });

    if (rewards.length === 0) return { claimed: '0', activatedTurbo: false };

    const total = rewards.reduce(
      (sum, r) => sum.plus(new Decimal(r.amount.toString())),
      new Decimal(0)
    );

    // Credit to wallet
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: 'USDT' } },
    });

    if (wallet) {
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: total.toNumber() } },
        }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'RAKEBACK',
            amount: total.toNumber(),
            status: 'COMPLETED',
            metadata: { rewardIds: rewards.map((r) => r.id) },
          },
        }),
        prisma.reward.updateMany({
          where: { id: { in: rewards.map((r) => r.id) } },
          data: { status: 'CLAIMED', claimedAt: new Date() },
        }),
      ]);
    }

    return { claimed: total.toString(), activatedTurbo: false };
  }

  /**
   * Get rakeback stats
   */
  async getRakebackStats(userId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, week, month, lifetime] = await Promise.all([
      this.sumRewards(userId, 'RAKEBACK', startOfDay),
      this.sumRewards(userId, 'RAKEBACK', startOfWeek),
      this.sumRewards(userId, 'RAKEBACK', startOfMonth),
      this.sumRewards(userId, 'RAKEBACK'),
    ]);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vipTier: true },
    });

    const tierConfig = await prisma.vipTierConfig.findUnique({
      where: { tier: user?.vipTier || 'BRONZE' },
    });

    return {
      today: today.toString(),
      thisWeek: week.toString(),
      thisMonth: month.toString(),
      lifetime: lifetime.toString(),
      rakebackRate: tierConfig?.rakebackPercent.toString() || '0',
      currency: 'USDT',
    };
  }

  private async sumRewards(userId: string, type: string, since?: Date): Promise<Decimal> {
    const where: any = { userId, type };
    if (since) where.createdAt = { gte: since };

    const result = await prisma.reward.aggregate({
      where,
      _sum: { amount: true },
    });

    return new Decimal(result._sum.amount?.toString() || '0');
  }
}

export const rakebackService = new RakebackService();
