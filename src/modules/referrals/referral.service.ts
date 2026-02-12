import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { AppError, NotFoundError, ValidationError } from '../../utils/errors';

const REFERRAL_BONUS_PERCENT = 5; // 5% of referred user's first deposit
const REFERRAL_MAX_BONUS = 100; // Max $100 per referral

export class ReferralService {
  async getReferralStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new NotFoundError('User', userId);

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referred: { select: { id: true, username: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const totalEarned = referrals.reduce(
      (sum, r) => sum.plus(new Decimal(r.bonusAmount?.toString() || '0')),
      new Decimal(0)
    );

    return {
      referralCode: user.referralCode,
      referralLink: `https://cryptobet.com/ref/${user.referralCode}`,
      totalReferrals: referrals.length,
      totalEarned: totalEarned.toString(),
      currency: 'USDT',
      referrals: referrals.map((r) => ({
        id: r.id,
        referred: r.referred,
        status: r.status,
        bonusAmount: r.bonusAmount?.toString() || '0',
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async processReferralBonus(referredId: string, depositAmount: string) {
    const referral = await prisma.referral.findFirst({
      where: { referredId, status: 'PENDING' },
    });
    if (!referral) return;

    const deposit = new Decimal(depositAmount);
    let bonus = deposit.mul(REFERRAL_BONUS_PERCENT).div(100);
    if (bonus.gt(REFERRAL_MAX_BONUS)) bonus = new Decimal(REFERRAL_MAX_BONUS);

    await prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: 'REWARDED',
          bonusAmount: bonus.toNumber(),
          qualifiedAt: new Date(),
        },
      });

      // Credit referrer
      const referrerWallet = await tx.wallet.findFirst({
        where: { userId: referral.referrerId, currency: { symbol: 'USDT' } },
      });
      if (referrerWallet) {
        await tx.wallet.update({
          where: { id: referrerWallet.id },
          data: { bonusBalance: { increment: bonus.toNumber() } },
        });
      }
    });
  }

  async getLeaderboard(limit: number = 20) {
    const referrals = await prisma.referral.groupBy({
      by: ['referrerId'],
      where: { status: 'REWARDED' },
      _sum: { bonusAmount: true },
      _count: true,
      orderBy: { _count: { referrerId: 'desc' } },
      take: limit,
    });

    const userIds = referrals.map((r) => r.referrerId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, avatar: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return referrals.map((r, i) => ({
      rank: i + 1,
      user: userMap.get(r.referrerId),
      totalReferrals: r._count,
      totalEarned: r._sum.bonusAmount?.toString() || '0',
    }));
  }
}

export const referralService = new ReferralService();
