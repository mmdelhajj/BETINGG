import { Job } from 'bullmq';
import prisma from '../lib/prisma';
import Decimal from 'decimal.js';

export interface RewardCalculationData {
  userId: string;
  betId: string;
  stake: string;
  currencySymbol: string;
  type: 'BET';
}

export async function calculateReward(job: Job<RewardCalculationData>): Promise<void> {
  const { userId, stake, type } = job.data;

  if (type !== 'BET') return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { welcomePackage: true },
  });

  if (!user) return;

  // Get VIP tier config
  const tierConfig = await prisma.vipTierConfig.findUnique({
    where: { tier: user.vipTier },
  });

  if (!tierConfig) return;

  const stakeDecimal = new Decimal(stake);
  const houseEdge = new Decimal(0.03); // 3% average house edge
  const rakebackPercent = new Decimal(tierConfig.rakebackPercent.toString()).div(100);

  // Check if welcome package is active
  let effectiveRakebackPercent = rakebackPercent;
  if (user.welcomePackage?.isActive && new Date() < user.welcomePackage.expiresAt) {
    const welcomeRakeback = new Decimal(user.welcomePackage.rakebackPercent.toString()).div(100);
    if (welcomeRakeback.gt(effectiveRakebackPercent)) {
      effectiveRakebackPercent = welcomeRakeback;
    }
  }

  // Check for active turbo session
  const turboSession = await prisma.turboSession.findFirst({
    where: {
      userId,
      isActive: true,
      endsAt: { gt: new Date() },
    },
  });

  if (turboSession) {
    const turboBoost = new Decimal(turboSession.boostPercent.toString()).div(100);
    effectiveRakebackPercent = effectiveRakebackPercent.plus(turboBoost);
  }

  // Calculate rakeback
  const rakeback = stakeDecimal.mul(houseEdge).mul(effectiveRakebackPercent);

  if (rakeback.lte(0)) return;

  // Split between wallet (immediate) and calendar
  const calendarSplit = new Decimal(tierConfig.calendarSplitPercent.toString()).div(100);
  const walletAmount = rakeback.mul(new Decimal(1).minus(calendarSplit));
  const calendarAmount = rakeback.mul(calendarSplit);

  // Create wallet rakeback reward (immediately claimable)
  if (walletAmount.gt(0)) {
    await prisma.reward.create({
      data: {
        userId,
        type: 'RAKEBACK',
        amount: walletAmount.toNumber(),
        currency: 'USDT',
        source: `bet:${job.data.betId}`,
        status: 'CLAIMABLE',
        claimableAt: new Date(),
      },
    });
  }

  // Create calendar reward (claimable during next calendar slot)
  if (calendarAmount.gt(0)) {
    await prisma.reward.create({
      data: {
        userId,
        type: 'DAILY',
        amount: calendarAmount.toNumber(),
        currency: 'USDT',
        source: `bet:${job.data.betId}`,
        status: 'PENDING',
      },
    });
  }

  // Check VIP tier upgrade
  await checkVipUpgrade(userId);
}

async function checkVipUpgrade(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalWagered: true, vipTier: true },
  });

  if (!user) return;

  const nextTier = await prisma.vipTierConfig.findFirst({
    where: {
      minWagered: { lte: user.totalWagered },
      tier: { not: user.vipTier },
    },
    orderBy: { minWagered: 'desc' },
  });

  if (nextTier && nextTier.sortOrder > getVipTierOrder(user.vipTier)) {
    await prisma.user.update({
      where: { id: userId },
      data: { vipTier: nextTier.tier },
    });

    // Create level-up reward
    await prisma.reward.create({
      data: {
        userId,
        type: 'LEVEL_UP',
        amount: nextTier.levelUpReward.toNumber(),
        currency: 'USDT',
        status: 'CLAIMABLE',
        claimableAt: new Date(),
      },
    });
  }
}

function getVipTierOrder(tier: string): number {
  const order: Record<string, number> = {
    BRONZE: 0,
    SILVER: 1,
    GOLD: 2,
    EMERALD: 3,
    SAPPHIRE: 4,
    RUBY: 5,
    DIAMOND: 6,
    BLUE_DIAMOND: 7,
  };
  return order[tier] ?? 0;
}
