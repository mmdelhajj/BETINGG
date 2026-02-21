import { Prisma, VipTier } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { createNotification } from '../notifications/notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VipTierInfo {
  tier: VipTier;
  name: string;
  minWagered: string;
  rakebackPercent: string;
  turboBoostPercent: string;
  turboDurationMin: number;
  dailyBonusMax: string;
  weeklyBonusMax: string | null;
  monthlyBonusMax: string | null;
  levelUpReward: string;
  calendarSplitPercent: string;
  maxLevelUpReward: string | null;
  sortOrder: number;
  benefits: unknown;
}

interface VipStatus {
  tier: VipTier;
  tierName: string;
  totalWagered: string;
  nextTier: VipTier | null;
  nextTierName: string | null;
  nextTierThreshold: string | null;
  progressPercent: number;
  remainingToNext: string | null;
  benefits: VipTierInfo;
}

interface TierChangeRecord {
  id: string;
  previousTier: VipTier;
  newTier: VipTier;
  totalWageredAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tier ordering
// ---------------------------------------------------------------------------

const TIER_ORDER: VipTier[] = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'ELITE',
  'BLACK_DIAMOND',
  'BLUE_DIAMOND',
];

const TIER_NAMES: Record<VipTier, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  DIAMOND: 'Diamond',
  ELITE: 'Elite',
  BLACK_DIAMOND: 'Black Diamond',
  BLUE_DIAMOND: 'Blue Diamond',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDecimal(val: Prisma.Decimal | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  return val.toString();
}

function tierIndex(tier: VipTier): number {
  return TIER_ORDER.indexOf(tier);
}

// ---------------------------------------------------------------------------
// getAllTiers
// ---------------------------------------------------------------------------

export async function getAllTiers(): Promise<VipTierInfo[]> {
  const cacheKey = 'vip:tiers:all';
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as VipTierInfo[];
  }

  const tiers = await prisma.vipTierConfig.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  const result: VipTierInfo[] = tiers.map((t) => ({
    tier: t.tier,
    name: t.name,
    minWagered: t.minWagered.toString(),
    rakebackPercent: t.rakebackPercent.toString(),
    turboBoostPercent: t.turboBoostPercent.toString(),
    turboDurationMin: t.turboDurationMin,
    dailyBonusMax: t.dailyBonusMax.toString(),
    weeklyBonusMax: formatDecimal(t.weeklyBonusMax),
    monthlyBonusMax: formatDecimal(t.monthlyBonusMax),
    levelUpReward: t.levelUpReward.toString(),
    calendarSplitPercent: t.calendarSplitPercent.toString(),
    maxLevelUpReward: formatDecimal(t.maxLevelUpReward),
    sortOrder: t.sortOrder,
    benefits: t.benefits,
  }));

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour
  return result;
}

// ---------------------------------------------------------------------------
// getTierConfig
// ---------------------------------------------------------------------------

export async function getTierConfig(tier: VipTier): Promise<VipTierInfo | null> {
  const allTiers = await getAllTiers();
  return allTiers.find((t) => t.tier === tier) ?? null;
}

// ---------------------------------------------------------------------------
// getTierForWagered
// ---------------------------------------------------------------------------

export async function getTierForWagered(totalWagered: Prisma.Decimal): Promise<VipTier> {
  const allTiers = await getAllTiers();

  // Walk from highest to lowest — return the first tier whose threshold is met
  for (let i = allTiers.length - 1; i >= 0; i--) {
    const threshold = new Prisma.Decimal(allTiers[i].minWagered);
    if (totalWagered.gte(threshold)) {
      return allTiers[i].tier;
    }
  }

  return 'BRONZE';
}

// ---------------------------------------------------------------------------
// getVipStatus
// ---------------------------------------------------------------------------

export async function getVipStatus(userId: string): Promise<VipStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      vipTier: true,
      totalWagered: true,
    },
  });

  const allTiers = await getAllTiers();
  const currentIdx = tierIndex(user.vipTier);
  const currentTierConfig = allTiers.find((t) => t.tier === user.vipTier)!;

  let nextTier: VipTier | null = null;
  let nextTierName: string | null = null;
  let nextTierThreshold: string | null = null;
  let remainingToNext: string | null = null;
  let progressPercent = 100;

  if (currentIdx < TIER_ORDER.length - 1) {
    const nextTierEnum = TIER_ORDER[currentIdx + 1];
    const nextTierConfig = allTiers.find((t) => t.tier === nextTierEnum);
    if (nextTierConfig) {
      nextTier = nextTierEnum;
      nextTierName = TIER_NAMES[nextTierEnum];
      nextTierThreshold = nextTierConfig.minWagered;

      const currentThreshold = new Prisma.Decimal(currentTierConfig.minWagered);
      const nextThresholdDec = new Prisma.Decimal(nextTierConfig.minWagered);
      const wagered = new Prisma.Decimal(user.totalWagered);

      const totalRange = nextThresholdDec.minus(currentThreshold);
      const progressInRange = wagered.minus(currentThreshold);
      const remaining = nextThresholdDec.minus(wagered);

      remainingToNext = remaining.gt(0) ? remaining.toString() : '0';

      if (totalRange.gt(0)) {
        const pct = progressInRange.div(totalRange).mul(100).toNumber();
        progressPercent = Math.min(Math.max(pct, 0), 100);
      } else {
        progressPercent = 100;
      }
    }
  }

  return {
    tier: user.vipTier,
    tierName: TIER_NAMES[user.vipTier],
    totalWagered: user.totalWagered.toString(),
    nextTier,
    nextTierName,
    nextTierThreshold,
    progressPercent: Math.round(progressPercent * 100) / 100,
    remainingToNext,
    benefits: currentTierConfig,
  };
}

// ---------------------------------------------------------------------------
// checkAndUpgrade - called after every bet
// ---------------------------------------------------------------------------

export async function checkAndUpgrade(userId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, vipTier: true, totalWagered: true },
  });

  const qualifiedTier = await getTierForWagered(new Prisma.Decimal(user.totalWagered));
  const currentIdx = tierIndex(user.vipTier);
  const qualifiedIdx = tierIndex(qualifiedTier);

  // No upgrade needed
  if (qualifiedIdx <= currentIdx) {
    return false;
  }

  // Perform the upgrade
  await prisma.user.update({
    where: { id: userId },
    data: { vipTier: qualifiedTier },
  });

  // Record tier change history in notifications + audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'VIP_TIER_CHANGE',
      resource: 'user',
      resourceId: userId,
      details: {
        previousTier: user.vipTier,
        newTier: qualifiedTier,
        totalWageredAt: user.totalWagered.toString(),
      },
    },
  });

  // Send notification
  await createNotification(
    userId,
    'VIP_LEVEL_UP',
    'VIP Tier Upgrade!',
    `Congratulations! You have been promoted to ${TIER_NAMES[qualifiedTier]} tier! Enjoy enhanced benefits.`,
    {
      previousTier: user.vipTier,
      newTier: qualifiedTier,
      totalWagered: user.totalWagered.toString(),
    },
  );

  // Invalidate any cached VIP status
  await redis.del(`vip:status:${userId}`);

  return true;
}

// ---------------------------------------------------------------------------
// getTierHistory
// ---------------------------------------------------------------------------

export async function getTierHistory(
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ history: TierChangeRecord[]; total: number; page: number; limit: number }> {
  const where = {
    userId,
    action: 'VIP_TIER_CHANGE',
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const history: TierChangeRecord[] = logs.map((log) => {
    const details = log.details as Record<string, unknown> | null;
    return {
      id: log.id,
      previousTier: (details?.previousTier as VipTier) ?? 'BRONZE',
      newTier: (details?.newTier as VipTier) ?? 'BRONZE',
      totalWageredAt: (details?.totalWageredAt as string) ?? '0',
      createdAt: log.createdAt.toISOString(),
    };
  });

  return { history, total, page, limit };
}
