import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { createNotification } from '../notifications/notification.service.js';

// ---------------------------------------------------------------------------
// Milestone configuration
// ---------------------------------------------------------------------------

interface MilestoneConfig {
  amount: number;
  reward: number;
  label: string;
}

const MILESTONES: MilestoneConfig[] = [
  { amount: 1_000, reward: 10, label: '$1K Wagered' },
  { amount: 5_000, reward: 50, label: '$5K Wagered' },
  { amount: 10_000, reward: 100, label: '$10K Wagered' },
  { amount: 50_000, reward: 500, label: '$50K Wagered' },
  { amount: 100_000, reward: 1_000, label: '$100K Wagered' },
  { amount: 500_000, reward: 5_000, label: '$500K Wagered' },
  { amount: 1_000_000, reward: 10_000, label: '$1M Wagered' },
  { amount: 2_500_000, reward: 25_000, label: '$2.5M Wagered' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MilestoneStatus = 'REACHED' | 'CURRENT' | 'UPCOMING' | 'CLAIMABLE';

interface Milestone {
  amount: string;
  reward: string;
  label: string;
  status: MilestoneStatus;
  claimedAt: string | null;
  progressPercent: number;
}

interface MilestoneResponse {
  milestones: Milestone[];
  totalWagered: string;
  currentMilestone: string | null;
  nextMilestone: string | null;
  nextMilestoneProgress: number;
}

interface ClaimResult {
  milestoneAmount: string;
  rewardAmount: string;
  creditedToWallet: string;
}

// ---------------------------------------------------------------------------
// getMilestones
// ---------------------------------------------------------------------------

export async function getMilestones(userId: string): Promise<MilestoneResponse> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totalWagered: true },
  });

  const totalWagered = new Prisma.Decimal(user.totalWagered);

  // Get all claimed level-up rewards
  const claimedRewards = await prisma.reward.findMany({
    where: {
      userId,
      type: 'LEVEL_UP',
      status: 'CLAIMED',
    },
    select: {
      amount: true,
      claimedAt: true,
      source: true,
    },
  });

  // Build set of claimed milestone amounts from source field
  const claimedAmounts = new Map<number, Date>();
  for (const r of claimedRewards) {
    const milestoneAmt = r.source ? parseInt(r.source, 10) : null;
    if (milestoneAmt) {
      claimedAmounts.set(milestoneAmt, r.claimedAt ?? new Date());
    }
  }

  // Check for unclaimed but claimable milestones
  const claimableRewards = await prisma.reward.findMany({
    where: {
      userId,
      type: 'LEVEL_UP',
      status: 'CLAIMABLE',
    },
    select: { source: true },
  });

  const claimableAmounts = new Set<number>();
  for (const r of claimableRewards) {
    const milestoneAmt = r.source ? parseInt(r.source, 10) : null;
    if (milestoneAmt) {
      claimableAmounts.add(milestoneAmt);
    }
  }

  let currentMilestone: string | null = null;
  let nextMilestone: string | null = null;
  let nextMilestoneProgress = 0;
  let foundCurrent = false;

  const milestones: Milestone[] = MILESTONES.map((m, idx) => {
    const threshold = new Prisma.Decimal(m.amount);
    const reached = totalWagered.gte(threshold);
    const claimed = claimedAmounts.has(m.amount);
    const claimable = claimableAmounts.has(m.amount);

    let status: MilestoneStatus;
    if (claimed) {
      status = 'REACHED';
    } else if (claimable || (reached && !claimed)) {
      status = 'CLAIMABLE';
    } else if (!foundCurrent && !reached) {
      status = 'CURRENT';
      foundCurrent = true;

      currentMilestone = m.label;

      // Calculate progress to this milestone
      const prevThreshold = idx > 0 ? new Prisma.Decimal(MILESTONES[idx - 1].amount) : new Prisma.Decimal(0);
      const range = threshold.sub(prevThreshold);
      const progress = totalWagered.sub(prevThreshold);
      nextMilestone = m.label;
      nextMilestoneProgress = range.gt(0)
        ? Math.min(100, Math.max(0, progress.div(range).mul(100).toNumber()))
        : 0;
    } else {
      status = 'UPCOMING';
      if (!nextMilestone && !foundCurrent) {
        nextMilestone = m.label;
      }
    }

    // Calculate individual progress
    let progressPercent: number;
    if (reached || claimed) {
      progressPercent = 100;
    } else {
      const prevThreshold = idx > 0 ? new Prisma.Decimal(MILESTONES[idx - 1].amount) : new Prisma.Decimal(0);
      const range = threshold.sub(prevThreshold);
      const progress = totalWagered.sub(prevThreshold);
      progressPercent = range.gt(0)
        ? Math.min(100, Math.max(0, Math.round(progress.div(range).mul(100).toNumber() * 100) / 100))
        : 0;
    }

    return {
      amount: m.amount.toString(),
      reward: m.reward.toString(),
      label: m.label,
      status,
      claimedAt: claimed ? claimedAmounts.get(m.amount)!.toISOString() : null,
      progressPercent,
    };
  });

  // If all milestones are reached
  if (!currentMilestone && !nextMilestone) {
    nextMilestoneProgress = 100;
  }

  return {
    milestones,
    totalWagered: totalWagered.toString(),
    currentMilestone,
    nextMilestone,
    nextMilestoneProgress: Math.round(nextMilestoneProgress * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// checkMilestone - called after totalWagered update
// ---------------------------------------------------------------------------

export async function checkMilestone(userId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totalWagered: true },
  });

  const totalWagered = new Prisma.Decimal(user.totalWagered);
  let anyNew = false;

  for (const m of MILESTONES) {
    const threshold = new Prisma.Decimal(m.amount);

    if (totalWagered.gte(threshold)) {
      // Check if this milestone reward already exists
      const existing = await prisma.reward.findFirst({
        where: {
          userId,
          type: 'LEVEL_UP',
          source: m.amount.toString(),
        },
      });

      if (!existing) {
        // Create a claimable reward
        await prisma.reward.create({
          data: {
            userId,
            type: 'LEVEL_UP',
            amount: new Prisma.Decimal(m.reward),
            currency: 'USDT',
            source: m.amount.toString(),
            status: 'CLAIMABLE',
            claimableAt: new Date(),
          },
        });

        // Notify the user
        await createNotification(
          userId,
          'REWARD_AVAILABLE',
          'Level-Up Milestone Reached!',
          `Congratulations! You have reached the ${m.label} milestone. Claim your $${m.reward} reward!`,
          {
            milestoneAmount: m.amount,
            reward: m.reward,
          },
        );

        anyNew = true;
      }
    }
  }

  return anyNew;
}

// ---------------------------------------------------------------------------
// claimMilestone
// ---------------------------------------------------------------------------

export async function claimMilestone(userId: string, milestoneAmount: number): Promise<ClaimResult> {
  // Validate this is a valid milestone
  const milestone = MILESTONES.find((m) => m.amount === milestoneAmount);
  if (!milestone) {
    throw new Error('Invalid milestone amount.');
  }

  // Find the claimable reward
  const reward = await prisma.reward.findFirst({
    where: {
      userId,
      type: 'LEVEL_UP',
      source: milestoneAmount.toString(),
      status: 'CLAIMABLE',
    },
  });

  if (!reward) {
    throw new Error('No claimable reward found for this milestone. It may have already been claimed or not yet reached.');
  }

  const rewardAmount = new Prisma.Decimal(milestone.reward);

  await prisma.$transaction(async (tx) => {
    // 1. Mark reward as claimed
    await tx.reward.update({
      where: { id: reward.id },
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

    if (usdtCurrency) {
      await tx.wallet.upsert({
        where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
        create: {
          userId,
          currencyId: usdtCurrency.id,
          balance: rewardAmount,
        },
        update: {
          balance: { increment: rewardAmount },
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
            type: 'REWARD',
            amount: rewardAmount,
            status: 'COMPLETED',
            metadata: {
              source: 'LEVEL_UP',
              milestoneAmount,
              milestoneLabel: milestone.label,
            },
          },
        });
      }
    }
  });

  return {
    milestoneAmount: milestoneAmount.toString(),
    rewardAmount: rewardAmount.toString(),
    creditedToWallet: rewardAmount.toString(),
  };
}
