import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { getTierConfig } from '../vip/vip.service.js';
import { checkAndUpgrade } from '../vip/vip.service.js';
import * as turboService from './turbo.service.js';
import { RAKEBACK_WALLET_SPLIT } from '../../config/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RakebackStats {
  today: string;
  thisWeek: string;
  thisMonth: string;
  lifetime: string;
  pending: string;
  rakebackPercent: string;
  turboActive: boolean;
  turboBoostPercent: string;
}

interface RakebackResult {
  totalRakeback: string;
  toWallet: string;
  toCalendar: string;
  turboBonus: string;
  newTotalWagered: string;
  tierUpgraded: boolean;
}

interface ClaimResult {
  claimedCount: number;
  totalClaimed: string;
  creditedToWallet: string;
}

// ---------------------------------------------------------------------------
// calculateRakeback - called on every bet
// ---------------------------------------------------------------------------

export async function calculateRakeback(
  userId: string,
  betAmount: Prisma.Decimal,
  houseEdge: Prisma.Decimal,
): Promise<RakebackResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { vipTier: true, totalWagered: true },
  });

  const tierConfig = await getTierConfig(user.vipTier);
  if (!tierConfig) {
    throw new Error('VIP tier configuration not found');
  }

  const rakebackPercent = new Prisma.Decimal(tierConfig.rakebackPercent);

  // Base rakeback: betAmount * houseEdge * (rakebackPercent / 100)
  const baseRakeback = betAmount
    .mul(houseEdge)
    .mul(rakebackPercent)
    .div(100)
    .toDecimalPlaces(8, Prisma.Decimal.ROUND_DOWN);

  // Check TURBO boost
  const turboBoostPercent = await turboService.getBoost(userId);
  let turboBonus = new Prisma.Decimal(0);

  if (turboBoostPercent.gt(0)) {
    turboBonus = baseRakeback
      .mul(turboBoostPercent)
      .div(100)
      .toDecimalPlaces(8, Prisma.Decimal.ROUND_DOWN);
  }

  const totalRakeback = baseRakeback.add(turboBonus);

  // Split: 50% to wallet immediately, 50% to calendar (as pending rewards)
  const walletSplit = new Prisma.Decimal(RAKEBACK_WALLET_SPLIT);
  const toWallet = totalRakeback.mul(walletSplit).toDecimalPlaces(8, Prisma.Decimal.ROUND_DOWN);
  const toCalendar = totalRakeback.sub(toWallet);

  // Execute all in a transaction
  const newTotalWagered = await prisma.$transaction(async (tx) => {
    // 1. Update user's totalWagered
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        totalWagered: { increment: betAmount },
      },
      select: { totalWagered: true },
    });

    // 2. Credit rakeback to wallet (if > 0)
    if (toWallet.gt(0)) {
      const usdtCurrency = await tx.currency.findUnique({
        where: { symbol: 'USDT' },
        select: { id: true },
      });

      if (usdtCurrency) {
        await tx.wallet.upsert({
          where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
          create: {
            userId,
            currencyId: usdtCurrency.id,
            balance: toWallet,
          },
          update: {
            balance: { increment: toWallet },
          },
        });

        // Create wallet RAKEBACK reward record
        await tx.reward.create({
          data: {
            userId,
            type: 'RAKEBACK',
            amount: toWallet,
            currency: 'USDT',
            source: 'INSTANT',
            status: 'CLAIMED',
            claimedAt: new Date(),
          },
        });

        // Create transaction record
        const wallet = await tx.wallet.findUnique({
          where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
          select: { id: true },
        });

        if (wallet) {
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'RAKEBACK',
              amount: toWallet,
              status: 'COMPLETED',
              metadata: {
                betAmount: betAmount.toString(),
                houseEdge: houseEdge.toString(),
                rakebackPercent: rakebackPercent.toString(),
                turboBonus: turboBonus.toString(),
              },
            },
          });
        }
      }
    }

    // 3. Create calendar reward (pending, claimable later)
    if (toCalendar.gt(0)) {
      await tx.reward.create({
        data: {
          userId,
          type: 'RAKEBACK',
          amount: toCalendar,
          currency: 'USDT',
          source: 'CALENDAR',
          status: 'PENDING',
        },
      });
    }

    return updatedUser.totalWagered;
  });

  // 4. Check for VIP tier upgrade (outside transaction to avoid long locks)
  const tierUpgraded = await checkAndUpgrade(userId);

  // 5. Update daily rakeback stats cache
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `rakeback:daily:${userId}:${today}`;
  await redis.incrbyfloat(dailyKey, parseFloat(totalRakeback.toString()));
  await redis.expire(dailyKey, 172800); // 48 hours

  return {
    totalRakeback: totalRakeback.toString(),
    toWallet: toWallet.toString(),
    toCalendar: toCalendar.toString(),
    turboBonus: turboBonus.toString(),
    newTotalWagered: newTotalWagered.toString(),
    tierUpgraded,
  };
}

// ---------------------------------------------------------------------------
// getRakebackStats
// ---------------------------------------------------------------------------

export async function getRakebackStats(userId: string): Promise<RakebackStats> {
  const now = new Date();

  // Time boundaries
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 86400000);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Query rakeback totals for each period
  const [todayResult, weekResult, monthResult, lifetimeResult, pendingResult] = await Promise.all([
    prisma.reward.aggregate({
      where: {
        userId,
        type: 'RAKEBACK',
        createdAt: { gte: startOfToday },
        status: { in: ['CLAIMED', 'PENDING'] },
      },
      _sum: { amount: true },
    }),
    prisma.reward.aggregate({
      where: {
        userId,
        type: 'RAKEBACK',
        createdAt: { gte: startOfWeek },
        status: { in: ['CLAIMED', 'PENDING'] },
      },
      _sum: { amount: true },
    }),
    prisma.reward.aggregate({
      where: {
        userId,
        type: 'RAKEBACK',
        createdAt: { gte: startOfMonth },
        status: { in: ['CLAIMED', 'PENDING'] },
      },
      _sum: { amount: true },
    }),
    prisma.reward.aggregate({
      where: {
        userId,
        type: 'RAKEBACK',
        status: { in: ['CLAIMED', 'PENDING'] },
      },
      _sum: { amount: true },
    }),
    prisma.reward.aggregate({
      where: {
        userId,
        type: 'RAKEBACK',
        status: 'PENDING',
      },
      _sum: { amount: true },
    }),
  ]);

  // Get current tier config for display
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { vipTier: true },
  });

  const tierConfig = await getTierConfig(user.vipTier);
  const turboStatus = await turboService.getStatus(userId);

  return {
    today: (todayResult._sum.amount ?? new Prisma.Decimal(0)).toString(),
    thisWeek: (weekResult._sum.amount ?? new Prisma.Decimal(0)).toString(),
    thisMonth: (monthResult._sum.amount ?? new Prisma.Decimal(0)).toString(),
    lifetime: (lifetimeResult._sum.amount ?? new Prisma.Decimal(0)).toString(),
    pending: (pendingResult._sum.amount ?? new Prisma.Decimal(0)).toString(),
    rakebackPercent: tierConfig?.rakebackPercent ?? '0',
    turboActive: turboStatus.isActive,
    turboBoostPercent: turboStatus.boostPercent,
  };
}

// ---------------------------------------------------------------------------
// claimRakeback - claim all pending rakeback rewards
// ---------------------------------------------------------------------------

export async function claimRakeback(userId: string): Promise<ClaimResult> {
  const pendingRewards = await prisma.reward.findMany({
    where: {
      userId,
      type: 'RAKEBACK',
      status: 'PENDING',
      source: 'CALENDAR',
    },
    orderBy: { createdAt: 'asc' },
  });

  if (pendingRewards.length === 0) {
    return {
      claimedCount: 0,
      totalClaimed: '0',
      creditedToWallet: '0',
    };
  }

  const totalAmount = pendingRewards.reduce(
    (sum, r) => sum.add(r.amount),
    new Prisma.Decimal(0),
  );

  await prisma.$transaction(async (tx) => {
    // 1. Mark all pending rewards as claimed
    const rewardIds = pendingRewards.map((r) => r.id);
    await tx.reward.updateMany({
      where: { id: { in: rewardIds } },
      data: {
        status: 'CLAIMED',
        claimedAt: new Date(),
      },
    });

    // 2. Credit to wallet
    const usdtCurrency = await tx.currency.findUnique({
      where: { symbol: 'USDT' },
      select: { id: true },
    });

    if (usdtCurrency && totalAmount.gt(0)) {
      await tx.wallet.upsert({
        where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
        create: {
          userId,
          currencyId: usdtCurrency.id,
          balance: totalAmount,
        },
        update: {
          balance: { increment: totalAmount },
        },
      });

      const wallet = await tx.wallet.findUnique({
        where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
        select: { id: true },
      });

      if (wallet) {
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'RAKEBACK',
            amount: totalAmount,
            status: 'COMPLETED',
            metadata: {
              source: 'CALENDAR_CLAIM',
              rewardCount: pendingRewards.length,
            },
          },
        });
      }
    }
  });

  return {
    claimedCount: pendingRewards.length,
    totalClaimed: totalAmount.toString(),
    creditedToWallet: totalAmount.toString(),
  };
}
