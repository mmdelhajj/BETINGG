import { Prisma, ReferralStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { REFERRAL_REWARDS } from '../../config/constants.js';
import { createNotification } from '../notifications/notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferralCodeInfo {
  code: string;
  link: string;
}

interface ReferralStats {
  totalReferred: number;
  qualified: number;
  pending: number;
  totalEarned: string;
  pendingReward: string;
  nextMilestone: { count: number; reward: number } | null;
  milestones: Array<{
    count: number;
    reward: number;
    reached: boolean;
    rewarded: boolean;
  }>;
}

interface ReferredUser {
  id: string;
  username: string;
  status: ReferralStatus;
  wagered: string;
  minWagerRequired: string;
  qualifiedAt: string | null;
  createdAt: string;
}

interface ReferralListResult {
  referrals: ReferredUser[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WAGER_QUALIFICATION = new Prisma.Decimal(50); // $50 min wager

// Sort milestone keys for ordered processing
const MILESTONE_KEYS = Object.keys(REFERRAL_REWARDS)
  .map(Number)
  .sort((a, b) => a - b);

// ---------------------------------------------------------------------------
// getReferralCode
// ---------------------------------------------------------------------------

export async function getReferralCode(userId: string): Promise<ReferralCodeInfo> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralCode: true },
  });

  const link = `${config.FRONTEND_URL}/ref/${user.referralCode}`;

  return {
    code: user.referralCode,
    link,
  };
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

export async function getStats(userId: string): Promise<ReferralStats> {
  const [totalResult, qualifiedResult, totalEarnedResult] = await Promise.all([
    prisma.referral.count({
      where: { referrerId: userId },
    }),
    prisma.referral.count({
      where: { referrerId: userId, status: { in: ['QUALIFIED', 'REWARDED'] } },
    }),
    prisma.referral.aggregate({
      where: { referrerId: userId },
      _sum: { bonusAmount: true },
    }),
  ]);

  const pending = totalResult - qualifiedResult;
  const totalEarned = totalEarnedResult._sum.bonusAmount ?? new Prisma.Decimal(0);

  // Calculate pending reward (from milestones not yet awarded)
  const rewardedReferrals = await prisma.referral.count({
    where: { referrerId: userId, status: 'REWARDED' },
  });

  // Calculate milestones
  const milestones = MILESTONE_KEYS.map((count) => {
    const reward = REFERRAL_REWARDS[count];
    const reached = qualifiedResult >= count;
    // A milestone is "rewarded" if we have enough REWARDED referrals
    const rewarded = rewardedReferrals >= count;
    return { count, reward, reached, rewarded };
  });

  // Find next unreached milestone
  const nextMilestone = milestones.find((m) => !m.reached);

  // Calculate pending reward: sum of reached but not rewarded milestones
  let pendingReward = new Prisma.Decimal(0);
  for (const m of milestones) {
    if (m.reached && !m.rewarded) {
      pendingReward = pendingReward.add(new Prisma.Decimal(m.reward));
    }
  }

  return {
    totalReferred: totalResult,
    qualified: qualifiedResult,
    pending,
    totalEarned: totalEarned.toString(),
    pendingReward: pendingReward.toString(),
    nextMilestone: nextMilestone ? { count: nextMilestone.count, reward: nextMilestone.reward } : null,
    milestones,
  };
}

// ---------------------------------------------------------------------------
// getReferredUsers
// ---------------------------------------------------------------------------

export async function getReferredUsers(
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<ReferralListResult> {
  const where = { referrerId: userId };

  const [referrals, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: {
        referred: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.referral.count({ where }),
  ]);

  const result: ReferredUser[] = referrals.map((r) => ({
    id: r.referred.id,
    username: r.referred.username,
    status: r.status,
    wagered: r.referredWagered.toString(),
    minWagerRequired: MIN_WAGER_QUALIFICATION.toString(),
    qualifiedAt: r.qualifiedAt ? r.qualifiedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return { referrals: result, total, page, limit };
}

// ---------------------------------------------------------------------------
// processReferral - called on signup when a referral code is used
// ---------------------------------------------------------------------------

export async function processReferral(
  referrerId: string,
  referredId: string,
): Promise<void> {
  // Verify referrer exists and is not the same user
  if (referrerId === referredId) {
    throw new Error('Cannot refer yourself.');
  }

  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { id: true, username: true },
  });

  if (!referrer) {
    throw new Error('Referrer not found.');
  }

  // Check if referral already exists
  const existing = await prisma.referral.findFirst({
    where: { referredId },
  });

  if (existing) {
    throw new Error('User has already been referred.');
  }

  // Create the referral record
  await prisma.referral.create({
    data: {
      referrerId,
      referredId,
      status: 'PENDING',
      bonusAmount: new Prisma.Decimal(0),
      referredWagered: new Prisma.Decimal(0),
    },
  });

  // Notify referrer
  const referredUser = await prisma.user.findUnique({
    where: { id: referredId },
    select: { username: true },
  });

  await createNotification(
    referrerId,
    'SYSTEM',
    'New Referral!',
    `${referredUser?.username ?? 'A new user'} has signed up using your referral link! They need to wager $${MIN_WAGER_QUALIFICATION.toString()} to qualify.`,
    { referredId, referredUsername: referredUser?.username },
  );
}

// ---------------------------------------------------------------------------
// checkQualification - called when referred user wagers
// ---------------------------------------------------------------------------

export async function checkQualification(
  referredUserId: string,
  additionalWagered: Prisma.Decimal,
): Promise<boolean> {
  // Find the referral record for this user
  const referral = await prisma.referral.findFirst({
    where: { referredId: referredUserId, status: 'PENDING' },
  });

  if (!referral) {
    return false; // No pending referral or already qualified
  }

  // Update wagered amount
  const newWagered = referral.referredWagered.add(additionalWagered);

  await prisma.referral.update({
    where: { id: referral.id },
    data: { referredWagered: newWagered },
  });

  // Check if qualification threshold met
  if (newWagered.gte(MIN_WAGER_QUALIFICATION)) {
    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'QUALIFIED',
        qualifiedAt: new Date(),
      },
    });

    // Count total qualified referrals for the referrer
    const qualifiedCount = await prisma.referral.count({
      where: {
        referrerId: referral.referrerId,
        status: { in: ['QUALIFIED', 'REWARDED'] },
      },
    });

    // Check if any milestone reward should be given
    const reward = getReferrerReward(qualifiedCount);
    if (reward > 0) {
      await creditReferralReward(referral.referrerId, new Prisma.Decimal(reward), qualifiedCount);
    }

    // Notify referrer
    const referredUser = await prisma.user.findUnique({
      where: { id: referredUserId },
      select: { username: true },
    });

    await createNotification(
      referral.referrerId,
      'SYSTEM',
      'Referral Qualified!',
      `${referredUser?.username ?? 'Your referral'} has qualified by meeting the minimum wager requirement!${reward > 0 ? ` You earned a $${reward} reward!` : ''}`,
      { referredId: referredUserId, qualifiedCount, reward },
    );

    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// getReferrerReward - determine reward based on milestone
// ---------------------------------------------------------------------------

export function getReferrerReward(qualifiedCount: number): number {
  // Check if the current count exactly matches a milestone
  if (REFERRAL_REWARDS[qualifiedCount] !== undefined) {
    return REFERRAL_REWARDS[qualifiedCount];
  }
  return 0;
}

// ---------------------------------------------------------------------------
// creditReferralReward - internal helper to credit reward to referrer
// ---------------------------------------------------------------------------

async function creditReferralReward(
  referrerId: string,
  amount: Prisma.Decimal,
  milestoneCount: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Credit to wallet
    const usdtCurrency = await tx.currency.findUnique({
      where: { symbol: 'USDT' },
      select: { id: true },
    });

    if (usdtCurrency) {
      await tx.wallet.upsert({
        where: { userId_currencyId: { userId: referrerId, currencyId: usdtCurrency.id } },
        create: {
          userId: referrerId,
          currencyId: usdtCurrency.id,
          balance: amount,
        },
        update: {
          balance: { increment: amount },
        },
      });

      const wallet = await tx.wallet.findUnique({
        where: { userId_currencyId: { userId: referrerId, currencyId: usdtCurrency.id } },
        select: { id: true },
      });

      if (wallet) {
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'REFERRAL',
            amount,
            status: 'COMPLETED',
            metadata: {
              source: 'REFERRAL_MILESTONE',
              milestoneCount,
              reward: amount.toString(),
            },
          },
        });
      }
    }

    // Create reward record
    await tx.reward.create({
      data: {
        userId: referrerId,
        type: 'REFERRAL',
        amount,
        currency: 'USDT',
        source: `MILESTONE:${milestoneCount}`,
        status: 'CLAIMED',
        claimedAt: new Date(),
      },
    });

    // Mark the qualifying referrals up to this milestone count as REWARDED
    // Get all QUALIFIED referrals and mark them as REWARDED
    const qualifiedReferrals = await tx.referral.findMany({
      where: {
        referrerId,
        status: 'QUALIFIED',
      },
      orderBy: { qualifiedAt: 'asc' },
    });

    if (qualifiedReferrals.length > 0) {
      await tx.referral.updateMany({
        where: {
          id: { in: qualifiedReferrals.map((r) => r.id) },
        },
        data: {
          status: 'REWARDED',
          bonusAmount: amount.div(qualifiedReferrals.length).toDecimalPlaces(8),
        },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// findReferrerByCode - lookup a user by referral code
// ---------------------------------------------------------------------------

export async function findReferrerByCode(code: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });

  return user?.id ?? null;
}
