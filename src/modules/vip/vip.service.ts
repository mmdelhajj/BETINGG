import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { VipTier } from '@prisma/client';
import { NotFoundError } from '../../utils/errors';
import { addNotificationJob } from '../../queues';

const TIER_ORDER: VipTier[] = [
  'BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'DIAMOND', 'BLUE_DIAMOND',
];

export class VipService {
  async getTierConfigs() {
    return prisma.vipTierConfig.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async getTierConfig(tier: VipTier) {
    const config = await prisma.vipTierConfig.findUnique({ where: { tier } });
    if (!config) throw new NotFoundError('VIP Tier Config');
    return config;
  }

  async getUserVipStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, vipTier: true, totalWagered: true },
    });
    if (!user) throw new NotFoundError('User');

    const currentTierConfig = await prisma.vipTierConfig.findUnique({
      where: { tier: user.vipTier },
    });

    const nextTierIndex = TIER_ORDER.indexOf(user.vipTier) + 1;
    let nextTierConfig = null;
    let progressPercent = 100;

    if (nextTierIndex < TIER_ORDER.length) {
      nextTierConfig = await prisma.vipTierConfig.findUnique({
        where: { tier: TIER_ORDER[nextTierIndex] },
      });

      if (nextTierConfig && currentTierConfig) {
        const wagered = new Decimal(user.totalWagered.toString());
        const currentMin = new Decimal(currentTierConfig.minWagered.toString());
        const nextMin = new Decimal(nextTierConfig.minWagered.toString());
        const range = nextMin.minus(currentMin);

        if (range.gt(0)) {
          progressPercent = wagered.minus(currentMin).div(range).mul(100).toNumber();
          progressPercent = Math.min(Math.max(progressPercent, 0), 100);
        }
      }
    }

    return {
      currentTier: user.vipTier,
      currentTierConfig,
      nextTier: nextTierIndex < TIER_ORDER.length ? TIER_ORDER[nextTierIndex] : null,
      nextTierConfig,
      totalWagered: user.totalWagered.toString(),
      progressPercent: Math.round(progressPercent * 100) / 100,
    };
  }

  async checkAndUpgrade(userId: string): Promise<{ upgraded: boolean; newTier?: VipTier }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, vipTier: true, totalWagered: true },
    });
    if (!user) return { upgraded: false };

    const wagered = new Decimal(user.totalWagered.toString());
    const currentIndex = TIER_ORDER.indexOf(user.vipTier);

    // Find the highest tier the user qualifies for
    const allConfigs = await prisma.vipTierConfig.findMany({
      orderBy: { sortOrder: 'desc' },
    });

    for (const config of allConfigs) {
      const tierIndex = TIER_ORDER.indexOf(config.tier);
      if (tierIndex > currentIndex && wagered.gte(config.minWagered.toString())) {
        await prisma.user.update({
          where: { id: userId },
          data: { vipTier: config.tier },
        });

        // Create level-up reward
        await prisma.reward.create({
          data: {
            userId,
            type: 'LEVEL_UP',
            amount: config.levelUpReward.toNumber(),
            currency: 'USDT',
            status: 'CLAIMABLE',
            claimableAt: new Date(),
          },
        });

        // Notify
        await addNotificationJob({
          userId,
          type: 'VIP_UPGRADE',
          title: `Congratulations! You've reached ${config.name}!`,
          message: `You've been promoted to ${config.name} tier. Enjoy enhanced rewards and benefits!`,
          data: { oldTier: user.vipTier, newTier: config.tier },
        });

        return { upgraded: true, newTier: config.tier };
      }
    }

    return { upgraded: false };
  }

  async getVipBenefitsComparison() {
    const configs = await prisma.vipTierConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return configs.map((c) => ({
      tier: c.tier,
      name: c.name,
      minWagered: c.minWagered.toString(),
      rakebackPercent: c.rakebackPercent.toString(),
      turboBoostPercent: c.turboBoostPercent.toString(),
      turboDurationMin: c.turboDurationMin,
      dailyBonusMax: c.dailyBonusMax.toString(),
      weeklyBonusMax: c.weeklyBonusMax?.toString() || null,
      monthlyBonusMax: c.monthlyBonusMax?.toString() || null,
      levelUpReward: c.levelUpReward.toString(),
      benefits: c.benefits,
    }));
  }

  // Admin methods
  async updateTierConfig(
    tier: VipTier,
    data: Partial<{
      minWagered: number;
      rakebackPercent: number;
      turboBoostPercent: number;
      turboDurationMin: number;
      dailyBonusMax: number;
      weeklyBonusMax: number;
      monthlyBonusMax: number;
      levelUpReward: number;
      calendarSplitPercent: number;
      benefits: any;
    }>
  ) {
    return prisma.vipTierConfig.update({ where: { tier }, data });
  }

  async setUserTier(userId: string, tier: VipTier) {
    return prisma.user.update({ where: { id: userId }, data: { vipTier: tier } });
  }
}

export const vipService = new VipService();
