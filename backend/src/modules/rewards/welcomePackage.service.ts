import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { WELCOME_PACKAGE_MAX, WELCOME_PACKAGE_DAYS } from '../../config/constants.js';
import { createNotification } from '../notifications/notification.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WelcomePackageStatus {
  isActive: boolean;
  hasPackage: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  currentDay: number;
  totalDays: number;
  totalEarned: string;
  maxReward: string;
  rakebackPercent: string;
  dailyDropsClaimed: number;
  cashVaultAmount: string;
  cashVaultClaimed: boolean;
  cashVaultAvailable: boolean;
  daysRemaining: number;
  progressPercent: number;
}

interface DailyDropResult {
  amount: string;
  totalEarned: string;
  dayNumber: number;
  cashVaultContribution: string;
}

interface CashVaultResult {
  amount: string;
  totalEarned: string;
}

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------

export async function getStatus(userId: string): Promise<WelcomePackageStatus> {
  const pkg = await prisma.welcomePackage.findUnique({
    where: { userId },
  });

  if (!pkg) {
    return {
      isActive: false,
      hasPackage: false,
      activatedAt: null,
      expiresAt: null,
      currentDay: 0,
      totalDays: WELCOME_PACKAGE_DAYS,
      totalEarned: '0',
      maxReward: WELCOME_PACKAGE_MAX.toString(),
      rakebackPercent: '10',
      dailyDropsClaimed: 0,
      cashVaultAmount: '0',
      cashVaultClaimed: false,
      cashVaultAvailable: false,
      daysRemaining: 0,
      progressPercent: 0,
    };
  }

  const now = new Date();
  const activatedAt = new Date(pkg.activatedAt);
  const daysDiff = Math.floor((now.getTime() - activatedAt.getTime()) / (1000 * 60 * 60 * 24));
  const currentDay = Math.min(daysDiff + 1, WELCOME_PACKAGE_DAYS);
  const isActive = pkg.isActive && now < new Date(pkg.expiresAt);
  const daysRemaining = isActive ? Math.max(0, WELCOME_PACKAGE_DAYS - daysDiff) : 0;
  const cashVaultAvailable = currentDay >= WELCOME_PACKAGE_DAYS && !pkg.cashVaultClaimed && pkg.cashVaultAmount.gt(0);
  const progressPercent = Math.min(100, Math.round((currentDay / WELCOME_PACKAGE_DAYS) * 100));

  return {
    isActive,
    hasPackage: true,
    activatedAt: pkg.activatedAt.toISOString(),
    expiresAt: pkg.expiresAt.toISOString(),
    currentDay,
    totalDays: WELCOME_PACKAGE_DAYS,
    totalEarned: pkg.totalEarned.toString(),
    maxReward: pkg.maxReward.toString(),
    rakebackPercent: pkg.rakebackPercent.toString(),
    dailyDropsClaimed: pkg.dailyDropsClaimed,
    cashVaultAmount: pkg.cashVaultAmount.toString(),
    cashVaultClaimed: pkg.cashVaultClaimed,
    cashVaultAvailable,
    daysRemaining,
    progressPercent,
  };
}

// ---------------------------------------------------------------------------
// activate - called on first deposit
// ---------------------------------------------------------------------------

export async function activate(userId: string): Promise<WelcomePackageStatus> {
  // Check if user already has a welcome package
  const existing = await prisma.welcomePackage.findUnique({
    where: { userId },
  });

  if (existing) {
    throw new Error('Welcome package has already been activated for this account.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + WELCOME_PACKAGE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.welcomePackage.create({
    data: {
      userId,
      activatedAt: now,
      expiresAt,
      totalEarned: new Prisma.Decimal(0),
      maxReward: new Prisma.Decimal(WELCOME_PACKAGE_MAX),
      rakebackPercent: new Prisma.Decimal(10), // Welcome package gives 10% rakeback
      dailyDropsClaimed: 0,
      cashVaultAmount: new Prisma.Decimal(0),
      cashVaultClaimed: false,
      isActive: true,
    },
  });

  // Send notification
  await createNotification(
    userId,
    'WELCOME',
    'Welcome Package Activated!',
    `Your welcome package is active! Enjoy up to $${WELCOME_PACKAGE_MAX} in bonuses over ${WELCOME_PACKAGE_DAYS} days, plus 10% rakeback.`,
    {
      maxReward: WELCOME_PACKAGE_MAX,
      daysActive: WELCOME_PACKAGE_DAYS,
    },
  );

  return getStatus(userId);
}

// ---------------------------------------------------------------------------
// processDailyDrop - called daily or based on play activity
// ---------------------------------------------------------------------------

export async function processDailyDrop(userId: string): Promise<DailyDropResult> {
  const pkg = await prisma.welcomePackage.findUnique({
    where: { userId },
  });

  if (!pkg || !pkg.isActive) {
    throw new Error('No active welcome package found.');
  }

  const now = new Date();
  if (now >= new Date(pkg.expiresAt)) {
    throw new Error('Welcome package has expired.');
  }

  // Check if already earned max
  if (pkg.totalEarned.gte(pkg.maxReward)) {
    throw new Error('Welcome package maximum reward has been reached.');
  }

  // Calculate which day we are on
  const activatedAt = new Date(pkg.activatedAt);
  const dayNumber = Math.floor((now.getTime() - activatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Check if daily drop already claimed today
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const alreadyClaimed = await prisma.reward.findFirst({
    where: {
      userId,
      type: 'WELCOME',
      source: 'DAILY_DROP',
      createdAt: { gte: startOfToday, lt: endOfToday },
    },
  });

  if (alreadyClaimed) {
    throw new Error('Daily drop already claimed today. Come back tomorrow!');
  }

  // Calculate daily drop amount
  // Base: maxReward / 30 days, with a portion going to cash vault
  const dailyBase = pkg.maxReward.div(WELCOME_PACKAGE_DAYS).toDecimalPlaces(8, Prisma.Decimal.ROUND_DOWN);
  const cashVaultPortion = dailyBase.mul(new Prisma.Decimal('0.20')).toDecimalPlaces(8, Prisma.Decimal.ROUND_DOWN); // 20% to cash vault
  const dailyDrop = dailyBase.sub(cashVaultPortion);

  // Ensure we do not exceed max
  const remaining = pkg.maxReward.sub(pkg.totalEarned);
  const actualDrop = Prisma.Decimal.min(dailyDrop, remaining);
  const actualVault = Prisma.Decimal.min(cashVaultPortion, remaining.sub(actualDrop));

  if (actualDrop.lte(0)) {
    throw new Error('No more welcome package rewards available.');
  }

  await prisma.$transaction(async (tx) => {
    // Credit daily drop to bonus wallet
    const usdtCurrency = await tx.currency.findUnique({
      where: { symbol: 'USDT' },
      select: { id: true },
    });

    if (usdtCurrency && actualDrop.gt(0)) {
      await tx.wallet.upsert({
        where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
        create: {
          userId,
          currencyId: usdtCurrency.id,
          bonusBalance: actualDrop,
        },
        update: {
          bonusBalance: { increment: actualDrop },
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
            type: 'BONUS',
            amount: actualDrop,
            status: 'COMPLETED',
            metadata: {
              source: 'WELCOME_DAILY_DROP',
              dayNumber,
            },
          },
        });
      }
    }

    // Create reward record
    await tx.reward.create({
      data: {
        userId,
        type: 'WELCOME',
        amount: actualDrop,
        currency: 'USDT',
        source: 'DAILY_DROP',
        status: 'CLAIMED',
        claimedAt: now,
        calendarDay: dayNumber,
      },
    });

    // Update welcome package
    await tx.welcomePackage.update({
      where: { userId },
      data: {
        totalEarned: { increment: actualDrop.add(actualVault) },
        dailyDropsClaimed: { increment: 1 },
        cashVaultAmount: { increment: actualVault },
      },
    });
  });

  const updatedPkg = await prisma.welcomePackage.findUnique({ where: { userId } });

  return {
    amount: actualDrop.toString(),
    totalEarned: updatedPkg ? updatedPkg.totalEarned.toString() : '0',
    dayNumber,
    cashVaultContribution: actualVault.toString(),
  };
}

// ---------------------------------------------------------------------------
// claimCashVault - available only on day 30
// ---------------------------------------------------------------------------

export async function claimCashVault(userId: string): Promise<CashVaultResult> {
  const pkg = await prisma.welcomePackage.findUnique({
    where: { userId },
  });

  if (!pkg) {
    throw new Error('No welcome package found.');
  }

  if (pkg.cashVaultClaimed) {
    throw new Error('Cash vault has already been claimed.');
  }

  if (pkg.cashVaultAmount.lte(0)) {
    throw new Error('No funds accumulated in the cash vault.');
  }

  // Check if user has reached day 30
  const now = new Date();
  const activatedAt = new Date(pkg.activatedAt);
  const dayNumber = Math.floor((now.getTime() - activatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (dayNumber < WELCOME_PACKAGE_DAYS) {
    throw new Error(
      `Cash vault unlocks on day ${WELCOME_PACKAGE_DAYS}. You are currently on day ${dayNumber}.`,
    );
  }

  const vaultAmount = new Prisma.Decimal(pkg.cashVaultAmount);

  await prisma.$transaction(async (tx) => {
    // Credit cash vault to main wallet balance (not bonus)
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
          balance: vaultAmount,
        },
        update: {
          balance: { increment: vaultAmount },
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
            type: 'BONUS',
            amount: vaultAmount,
            status: 'COMPLETED',
            metadata: {
              source: 'WELCOME_CASH_VAULT',
              dayNumber: WELCOME_PACKAGE_DAYS,
            },
          },
        });
      }
    }

    // Create reward record
    await tx.reward.create({
      data: {
        userId,
        type: 'CASH_VAULT',
        amount: vaultAmount,
        currency: 'USDT',
        source: 'WELCOME_PACKAGE',
        status: 'CLAIMED',
        claimedAt: now,
      },
    });

    // Update welcome package
    await tx.welcomePackage.update({
      where: { userId },
      data: {
        cashVaultClaimed: true,
        isActive: false, // Package complete
      },
    });
  });

  // Send notification
  await createNotification(
    userId,
    'REWARD_AVAILABLE',
    'Cash Vault Unlocked!',
    `You have unlocked your cash vault! $${vaultAmount.toFixed(2)} has been credited to your wallet.`,
    { amount: vaultAmount.toString() },
  );

  const updatedPkg = await prisma.welcomePackage.findUnique({ where: { userId } });

  return {
    amount: vaultAmount.toString(),
    totalEarned: updatedPkg ? updatedPkg.totalEarned.toString() : '0',
  };
}
