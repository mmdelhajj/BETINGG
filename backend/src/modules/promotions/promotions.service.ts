import crypto from 'node:crypto';
import { Prisma, VipTier } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { createNotification } from '../notifications/notification.service.js';
import type {
  CreatePromotionInput,
  UpdatePromotionInput,
  GeneratePromoCodesInput,
  AdminListPromotionsQuery,
} from './promotions.schemas.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VIP_TIER_ORDER: VipTier[] = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'ELITE',
  'BLACK_DIAMOND',
  'BLUE_DIAMOND',
];

interface PromotionSummary {
  id: string;
  title: string;
  description: string;
  type: string;
  code: string | null;
  image: string | null;
  conditions: unknown;
  reward: unknown;
  startDate: string;
  endDate: string;
  isActive: boolean;
  maxClaims: number | null;
  claimCount: number;
  createdAt: string;
  ctaText: string;
  ctaLink: string;
}

interface PromotionDetail extends PromotionSummary {
  userClaimed: boolean;
  canClaim: boolean;
  canClaimReason: string | null;
}

interface ClaimResult {
  promotionId: string;
  rewardType: string;
  rewardValue: string;
  creditedAmount: string;
  currency: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializePromotion(p: {
  id: string;
  title: string;
  description: string;
  type: string;
  code: string | null;
  image: string | null;
  conditions: unknown;
  reward: unknown;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  maxClaims: number | null;
  claimCount: number;
  createdAt: Date;
}): PromotionSummary {
  const cta = getPromotionCta(p.type);
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    type: p.type,
    code: p.code,
    image: p.image,
    conditions: p.conditions,
    reward: p.reward,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    isActive: p.isActive,
    maxClaims: p.maxClaims,
    claimCount: p.claimCount,
    createdAt: p.createdAt.toISOString(),
    ctaText: cta.ctaText,
    ctaLink: cta.ctaLink,
  };
}

function getPromotionCta(type: string): { ctaText: string; ctaLink: string } {
  switch (type) {
    case 'DEPOSIT_BONUS':
      return { ctaText: 'Deposit Now', ctaLink: '/wallet/deposit' };
    case 'FREE_BET':
      return { ctaText: 'Claim Free Bet', ctaLink: '/promotions' };
    case 'ODDS_BOOST':
      return { ctaText: 'View Boosted Odds', ctaLink: '/sports' };
    case 'CASHBACK':
      return { ctaText: 'Learn More', ctaLink: '/promotions' };
    default:
      return { ctaText: 'Learn More', ctaLink: '/promotions' };
  }
}

function generateCode(prefix?: string): string {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return prefix ? `${prefix.toUpperCase()}-${random}` : random;
}

// ---------------------------------------------------------------------------
// getActivePromotions
// ---------------------------------------------------------------------------

export async function getActivePromotions(
  page: number = 1,
  limit: number = 20,
  type?: string,
): Promise<{ promotions: PromotionSummary[]; total: number; page: number; limit: number }> {
  const now = new Date();

  const where: Prisma.PromotionWhereInput = {
    isActive: true,
    startDate: { lte: now },
    endDate: { gte: now },
    ...(type ? { type: type as Prisma.EnumPromoTypeFilter['equals'] } : {}),
  };

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.promotion.count({ where }),
  ]);

  return {
    promotions: promotions.map(serializePromotion),
    total,
    page,
    limit,
  };
}

// ---------------------------------------------------------------------------
// getPromotion
// ---------------------------------------------------------------------------

export async function getPromotion(
  id: string,
  userId?: string,
): Promise<PromotionDetail | null> {
  const promotion = await prisma.promotion.findUnique({
    where: { id },
    include: {
      _count: { select: { claims: true } },
    },
  });

  if (!promotion) return null;

  let userClaimed = false;
  let canClaim = true;
  let canClaimReason: string | null = null;

  if (userId) {
    const existingClaim = await prisma.promoClaim.findFirst({
      where: { userId, promotionId: id },
    });

    userClaimed = existingClaim !== null;

    if (userClaimed) {
      canClaim = false;
      canClaimReason = 'You have already claimed this promotion.';
    }
  }

  const now = new Date();
  if (!promotion.isActive) {
    canClaim = false;
    canClaimReason = 'This promotion is no longer active.';
  } else if (now < promotion.startDate) {
    canClaim = false;
    canClaimReason = 'This promotion has not started yet.';
  } else if (now > promotion.endDate) {
    canClaim = false;
    canClaimReason = 'This promotion has expired.';
  } else if (promotion.maxClaims && promotion.claimCount >= promotion.maxClaims) {
    canClaim = false;
    canClaimReason = 'This promotion has reached its maximum number of claims.';
  }

  return {
    ...serializePromotion(promotion),
    userClaimed,
    canClaim: canClaim && !userClaimed,
    canClaimReason,
  };
}

// ---------------------------------------------------------------------------
// claimPromotion
// ---------------------------------------------------------------------------

export async function claimPromotion(
  userId: string,
  promotionId: string,
): Promise<ClaimResult> {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
  });

  if (!promotion) {
    throw new Error('Promotion not found.');
  }

  // Validation
  const now = new Date();
  if (!promotion.isActive) {
    throw new Error('This promotion is no longer active.');
  }
  if (now < promotion.startDate) {
    throw new Error('This promotion has not started yet.');
  }
  if (now > promotion.endDate) {
    throw new Error('This promotion has expired.');
  }
  if (promotion.maxClaims && promotion.claimCount >= promotion.maxClaims) {
    throw new Error('This promotion has reached its maximum number of claims.');
  }

  // Check user hasn't already claimed
  const existingClaim = await prisma.promoClaim.findFirst({
    where: { userId, promotionId },
  });

  if (existingClaim) {
    throw new Error('You have already claimed this promotion.');
  }

  // Check conditions
  const conditions = promotion.conditions as Record<string, unknown>;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { vipTier: true, totalWagered: true, createdAt: true },
  });

  // Min VIP tier check
  if (conditions.minVipTier) {
    const requiredIdx = VIP_TIER_ORDER.indexOf(conditions.minVipTier as VipTier);
    const userIdx = VIP_TIER_ORDER.indexOf(user.vipTier);
    if (userIdx < requiredIdx) {
      throw new Error(`This promotion requires ${conditions.minVipTier} VIP tier or higher.`);
    }
  }

  // Per-user claim limit check
  if (conditions.maxClaimsPerUser) {
    const userClaimsCount = await prisma.promoClaim.count({
      where: { userId, promotionId },
    });
    if (userClaimsCount >= (conditions.maxClaimsPerUser as number)) {
      throw new Error('You have reached the maximum number of claims for this promotion.');
    }
  }

  // New users only check (accounts < 7 days old)
  if (conditions.newUsersOnly) {
    const accountAge = (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge > 7) {
      throw new Error('This promotion is available for new users only.');
    }
  }

  // Calculate reward
  const rewardConfig = promotion.reward as Record<string, unknown>;
  const rewardType = rewardConfig.type as string;
  const rewardValue = new Prisma.Decimal(String(rewardConfig.value ?? 0));
  const rewardCurrency = (rewardConfig.currency as string) || 'USDT';
  const maxValue = rewardConfig.maxValue
    ? new Prisma.Decimal(String(rewardConfig.maxValue))
    : null;

  let creditAmount: Prisma.Decimal;

  switch (rewardType) {
    case 'FIXED':
      creditAmount = rewardValue;
      break;
    case 'PERCENTAGE': {
      // For percentage bonuses, we would typically apply to a deposit
      // For direct claim, use the value as a fixed amount capped by maxValue
      creditAmount = rewardValue;
      if (maxValue && creditAmount.gt(maxValue)) {
        creditAmount = maxValue;
      }
      break;
    }
    case 'FREE_BET':
      creditAmount = rewardValue;
      break;
    case 'ODDS_BOOST':
      creditAmount = rewardValue;
      break;
    default:
      creditAmount = rewardValue;
  }

  // Execute claim in transaction
  await prisma.$transaction(async (tx) => {
    // Create claim record
    await tx.promoClaim.create({
      data: {
        userId,
        promotionId,
        amount: creditAmount,
        status: 'CLAIMED',
      },
    });

    // Increment promotion claim count
    await tx.promotion.update({
      where: { id: promotionId },
      data: { claimCount: { increment: 1 } },
    });

    // Credit to wallet based on reward type
    if (creditAmount.gt(0) && (rewardType === 'FIXED' || rewardType === 'PERCENTAGE' || rewardType === 'FREE_BET')) {
      const currency = await tx.currency.findUnique({
        where: { symbol: rewardCurrency },
        select: { id: true },
      });

      if (currency) {
        const balanceField = rewardType === 'FREE_BET' ? 'bonusBalance' : 'balance';

        await tx.wallet.upsert({
          where: { userId_currencyId: { userId, currencyId: currency.id } },
          create: {
            userId,
            currencyId: currency.id,
            [balanceField]: creditAmount,
          },
          update: {
            [balanceField]: { increment: creditAmount },
          },
        });

        const wallet = await tx.wallet.findUnique({
          where: { userId_currencyId: { userId, currencyId: currency.id } },
          select: { id: true },
        });

        if (wallet) {
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'BONUS',
              amount: creditAmount,
              status: 'COMPLETED',
              metadata: {
                source: 'PROMOTION',
                promotionId,
                promotionTitle: promotion.title,
                rewardType,
              },
            },
          });
        }
      }
    }

    // Create reward record
    await tx.reward.create({
      data: {
        userId,
        type: 'TURBO', // Using closest RewardType — these are promo rewards
        amount: creditAmount,
        currency: rewardCurrency,
        source: `PROMO:${promotionId}`,
        status: 'CLAIMED',
        claimedAt: now,
      },
    });
  });

  // Notify user
  await createNotification(
    userId,
    'PROMO_AVAILABLE',
    'Promotion Claimed!',
    `You have successfully claimed "${promotion.title}". ${creditAmount.toString()} ${rewardCurrency} has been credited to your account.`,
    { promotionId, amount: creditAmount.toString(), currency: rewardCurrency },
  );

  return {
    promotionId,
    rewardType,
    rewardValue: rewardValue.toString(),
    creditedAmount: creditAmount.toString(),
    currency: rewardCurrency,
  };
}

// ---------------------------------------------------------------------------
// redeemPromoCode
// ---------------------------------------------------------------------------

export async function redeemPromoCode(userId: string, code: string): Promise<ClaimResult> {
  const promotion = await prisma.promotion.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!promotion) {
    throw new Error('Invalid promo code. Please check and try again.');
  }

  return claimPromotion(userId, promotion.id);
}

// ---------------------------------------------------------------------------
// Admin: createPromotion
// ---------------------------------------------------------------------------

export async function createPromotion(
  input: CreatePromotionInput,
  adminId: string,
): Promise<PromotionSummary> {
  // Check for duplicate code
  if (input.code) {
    const existing = await prisma.promotion.findUnique({
      where: { code: input.code },
    });
    if (existing) {
      throw new Error(`Promo code "${input.code}" already exists.`);
    }
  }

  const promotion = await prisma.promotion.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      code: input.code ?? null,
      image: input.image ?? null,
      conditions: input.conditions as Prisma.JsonObject,
      reward: input.reward as Prisma.JsonObject,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      maxClaims: input.maxClaims ?? null,
      isActive: input.isActive,
      createdBy: adminId,
    },
  });

  // Invalidate cache
  await redis.del('promotions:active');

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId,
      action: 'CREATE_PROMOTION',
      resource: 'promotion',
      resourceId: promotion.id,
      details: { title: input.title, type: input.type },
    },
  });

  return serializePromotion(promotion);
}

// ---------------------------------------------------------------------------
// Admin: updatePromotion
// ---------------------------------------------------------------------------

export async function updatePromotion(
  id: string,
  input: Partial<CreatePromotionInput>,
  adminId: string,
): Promise<PromotionSummary> {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Promotion not found.');
  }

  // If updating code, check for duplicates
  if (input.code && input.code !== existing.code) {
    const duplicate = await prisma.promotion.findUnique({ where: { code: input.code } });
    if (duplicate) {
      throw new Error(`Promo code "${input.code}" already exists.`);
    }
  }

  const promotion = await prisma.promotion.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.code !== undefined ? { code: input.code ?? null } : {}),
      ...(input.image !== undefined ? { image: input.image ?? null } : {}),
      ...(input.conditions !== undefined ? { conditions: input.conditions as Prisma.JsonObject } : {}),
      ...(input.reward !== undefined ? { reward: input.reward as Prisma.JsonObject } : {}),
      ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {}),
      ...(input.maxClaims !== undefined ? { maxClaims: input.maxClaims ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await redis.del('promotions:active');

  await prisma.auditLog.create({
    data: {
      adminId,
      action: 'UPDATE_PROMOTION',
      resource: 'promotion',
      resourceId: id,
      details: input as Prisma.JsonObject,
    },
  });

  return serializePromotion(promotion);
}

// ---------------------------------------------------------------------------
// Admin: deactivatePromotion
// ---------------------------------------------------------------------------

export async function deactivatePromotion(
  id: string,
  adminId: string,
): Promise<PromotionSummary> {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) {
    throw new Error('Promotion not found.');
  }

  const promotion = await prisma.promotion.update({
    where: { id },
    data: { isActive: false },
  });

  await redis.del('promotions:active');

  await prisma.auditLog.create({
    data: {
      adminId,
      action: 'DEACTIVATE_PROMOTION',
      resource: 'promotion',
      resourceId: id,
    },
  });

  return serializePromotion(promotion);
}

// ---------------------------------------------------------------------------
// Admin: listAllPromotions
// ---------------------------------------------------------------------------

export async function listAllPromotions(
  query: AdminListPromotionsQuery,
): Promise<{ promotions: PromotionSummary[]; total: number; page: number; limit: number }> {
  const where: Prisma.PromotionWhereInput = {
    ...(query.type ? { type: query.type as Prisma.EnumPromoTypeFilter['equals'] } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.promotion.count({ where }),
  ]);

  return {
    promotions: promotions.map(serializePromotion),
    total,
    page: query.page,
    limit: query.limit,
  };
}

// ---------------------------------------------------------------------------
// Admin: generatePromoCodes
// ---------------------------------------------------------------------------

export async function generatePromoCodes(
  input: GeneratePromoCodesInput,
  adminId: string,
): Promise<{ codes: string[]; promotionId: string; count: number }> {
  const promotion = await prisma.promotion.findUnique({
    where: { id: input.promotionId },
  });

  if (!promotion) {
    throw new Error('Promotion not found.');
  }

  const codes: string[] = [];
  const existingCodes = new Set<string>();

  // Fetch existing codes to avoid duplicates
  const existingPromotions = await prisma.promotion.findMany({
    where: { code: { not: null } },
    select: { code: true },
  });
  for (const p of existingPromotions) {
    if (p.code) existingCodes.add(p.code);
  }

  // Generate unique codes and create linked promotions
  for (let i = 0; i < input.count; i++) {
    let code: string;
    let attempts = 0;
    do {
      code = generateCode(input.prefix);
      attempts++;
      if (attempts > 100) {
        throw new Error('Failed to generate unique promo codes. Try a different prefix.');
      }
    } while (existingCodes.has(code));

    existingCodes.add(code);
    codes.push(code);
  }

  // Create promotions for each code (clones of parent promotion)
  await prisma.$transaction(
    codes.map((code) =>
      prisma.promotion.create({
        data: {
          title: promotion.title,
          description: promotion.description,
          type: promotion.type,
          code,
          image: promotion.image,
          conditions: promotion.conditions as Prisma.JsonObject,
          reward: promotion.reward as Prisma.JsonObject,
          startDate: promotion.startDate,
          endDate: promotion.endDate,
          maxClaims: 1, // Each code is single-use
          isActive: true,
          createdBy: adminId,
        },
      }),
    ),
  );

  await prisma.auditLog.create({
    data: {
      adminId,
      action: 'GENERATE_PROMO_CODES',
      resource: 'promotion',
      resourceId: input.promotionId,
      details: { count: input.count, prefix: input.prefix },
    },
  });

  return {
    codes,
    promotionId: input.promotionId,
    count: codes.length,
  };
}

// ---------------------------------------------------------------------------
// Admin: listPromoCodes
// ---------------------------------------------------------------------------

export async function listPromoCodes(
  query: { promotionId?: string; isActive?: boolean; page: number; limit: number },
): Promise<{
  codes: Array<{
    id: string;
    code: string;
    title: string;
    type: string;
    isActive: boolean;
    claimCount: number;
    maxClaims: number | null;
    startDate: string;
    endDate: string;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const where: Prisma.PromotionWhereInput = {
    code: { not: null },
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  // If promotionId is provided, find all codes whose title matches the parent
  if (query.promotionId) {
    const parent = await prisma.promotion.findUnique({
      where: { id: query.promotionId },
      select: { title: true },
    });
    if (parent) {
      where.title = parent.title;
    }
  }

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        isActive: true,
        claimCount: true,
        maxClaims: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.promotion.count({ where }),
  ]);

  return {
    codes: promotions.map((p) => ({
      id: p.id,
      code: p.code!,
      title: p.title,
      type: p.type,
      isActive: p.isActive,
      claimCount: p.claimCount,
      maxClaims: p.maxClaims,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
    })),
    total,
    page: query.page,
    limit: query.limit,
  };
}
