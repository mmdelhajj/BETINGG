import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { VipTier, KycLevel } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { notifyVipLevelUp } from '../notifications/notification.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;
const PENDING_LIMIT_TTL = 24 * 60 * 60; // 24 hours in seconds

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      dateOfBirth: true,
      role: true,
      kycLevel: true,
      vipTier: true,
      totalWagered: true,
      twoFactorEnabled: true,
      preferredCurrency: true,
      preferredOddsFormat: true,
      theme: true,
      language: true,
      isActive: true,
      isBanned: true,
      banReason: true,
      depositLimit: true,
      lossLimit: true,
      selfExcludedUntil: true,
      coolingOffUntil: true,
      sessionTimeout: true,
      realityCheckInterval: true,
      referralCode: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      wallets: {
        select: {
          id: true,
          balance: true,
          lockedBalance: true,
          bonusBalance: true,
          depositAddress: true,
          currency: {
            select: {
              symbol: true,
              name: true,
              type: true,
              icon: true,
              exchangeRateUsd: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Fetch VIP tier config for display
  const vipConfig = await prisma.vipTierConfig.findUnique({
    where: { tier: user.vipTier },
    select: {
      name: true,
      minWagered: true,
      rakebackPercent: true,
      benefits: true,
    },
  });

  // Calculate next VIP tier progress
  const nextTierConfig = await getNextTierConfig(user.vipTier);

  return {
    ...user,
    vipInfo: {
      currentTier: vipConfig,
      nextTier: nextTierConfig
        ? {
            tier: nextTierConfig.tier,
            name: nextTierConfig.name,
            requiredWagered: nextTierConfig.minWagered,
            progress: nextTierConfig.minWagered.gt(0)
              ? Math.min(
                  100,
                  user.totalWagered
                    .div(nextTierConfig.minWagered)
                    .mul(100)
                    .toNumber(),
                )
              : 100,
          }
        : null,
    },
  };
}

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

export async function updateProfile(
  userId: string,
  data: { nickname?: string; avatar?: string | null; dateOfBirth?: string; preferences?: { currency?: string; oddsFormat?: string; language?: string } },
) {
  // Check nickname uniqueness if provided
  if (data.nickname) {
    const existing = await prisma.user.findFirst({
      where: {
        username: data.nickname,
        id: { not: userId },
      },
    });

    if (existing) {
      return {
        error: 'NICKNAME_TAKEN',
        message: 'This nickname is already taken by another user.',
      };
    }
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (data.nickname !== undefined) updateData.username = data.nickname;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
  if (data.preferences?.currency !== undefined) updateData.preferredCurrency = data.preferences.currency;
  if (data.preferences?.oddsFormat !== undefined) updateData.preferredOddsFormat = data.preferences.oddsFormat;
  if (data.preferences?.language !== undefined) updateData.language = data.preferences.language;

  const user = await prisma.user.update({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      dateOfBirth: true,
      updatedAt: true,
    },
    data: updateData,
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PROFILE_UPDATED',
      resource: 'user',
      resourceId: userId,
      details: { updatedFields: Object.keys(data) },
    },
  });

  return { user };
}

// ---------------------------------------------------------------------------
// updatePreferences
// ---------------------------------------------------------------------------

export async function updatePreferences(
  userId: string,
  data: {
    theme?: 'DARK' | 'LIGHT' | 'CLASSIC';
    language?: string;
    oddsFormat?: 'DECIMAL' | 'FRACTIONAL' | 'AMERICAN';
    timezone?: string;
  },
) {
  const updateData: Prisma.UserUpdateInput = {};
  if (data.theme !== undefined) updateData.theme = data.theme;
  if (data.language !== undefined) updateData.language = data.language;
  if (data.oddsFormat !== undefined) updateData.preferredOddsFormat = data.oddsFormat;
  // timezone is not in the Prisma schema as a dedicated field, store it in a meta way
  // For now, we update what we can directly

  const user = await prisma.user.update({
    where: { id: userId },
    select: {
      id: true,
      theme: true,
      language: true,
      preferredOddsFormat: true,
      updatedAt: true,
    },
    data: updateData,
  });

  // If timezone was provided, store it in Redis for fast access
  if (data.timezone) {
    await redis.set(`user:${userId}:timezone`, data.timezone);
  }

  return { preferences: { ...user, timezone: data.timezone } };
}

// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  // Verify old password
  const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isValid) {
    return {
      error: 'INVALID_PASSWORD',
      message: 'Current password is incorrect.',
    };
  }

  // Hash new password
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Invalidate all other sessions for this user
  await prisma.session.updateMany({
    where: {
      userId,
      isRevoked: false,
    },
    data: { isRevoked: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'user',
      resourceId: userId,
    },
  });

  return { success: true, message: 'Password changed successfully. All other sessions have been invalidated.' };
}

// ---------------------------------------------------------------------------
// getActivityLog
// ---------------------------------------------------------------------------

export async function getActivityLog(userId: string, page: number, limit: number) {
  const where = { userId };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        details: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// setResponsibleGambling
// ---------------------------------------------------------------------------

export async function setResponsibleGambling(
  userId: string,
  settings: {
    depositLimit?: { daily?: number; weekly?: number; monthly?: number };
    lossLimit?: { daily?: number; weekly?: number; monthly?: number };
    sessionTimeout?: number | null;
    realityCheckInterval?: number | null;
  },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      depositLimit: true,
      lossLimit: true,
      sessionTimeout: true,
      realityCheckInterval: true,
    },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  const updateData: Prisma.UserUpdateInput = {};
  const pendingChanges: string[] = [];

  // Handle deposit limits - increases take 24h, decreases are instant
  if (settings.depositLimit) {
    const currentLimits = (user.depositLimit as Record<string, number> | null) ?? {};
    const newLimits = { ...currentLimits };
    const pendingLimits: Record<string, number> = {};

    for (const [period, value] of Object.entries(settings.depositLimit)) {
      if (value === undefined) continue;
      const currentValue = currentLimits[period] ?? 0;

      if (value > currentValue && currentValue > 0) {
        // Increase - schedule for 24h from now
        pendingLimits[period] = value;
        pendingChanges.push(`Deposit limit ${period}: increase to ${value} will take effect in 24 hours`);
      } else {
        // Decrease or first-time set - instant
        newLimits[period] = value;
      }
    }

    updateData.depositLimit = newLimits;

    // Store pending increases in Redis with 24h TTL
    if (Object.keys(pendingLimits).length > 0) {
      const pendingKey = `user:${userId}:pending_deposit_limit`;
      const existingPending = await redis.get(pendingKey);
      const merged = {
        ...(existingPending ? JSON.parse(existingPending) : {}),
        ...pendingLimits,
      };
      await redis.set(pendingKey, JSON.stringify(merged), 'EX', PENDING_LIMIT_TTL);
    }
  }

  // Handle loss limits - always instant
  if (settings.lossLimit) {
    const currentLimits = (user.lossLimit as Record<string, number> | null) ?? {};
    const newLimits = { ...currentLimits };

    for (const [period, value] of Object.entries(settings.lossLimit)) {
      if (value !== undefined) {
        newLimits[period] = value;
      }
    }

    updateData.lossLimit = newLimits;
  }

  // Session timeout
  if (settings.sessionTimeout !== undefined) {
    updateData.sessionTimeout = settings.sessionTimeout;
  }

  // Reality check interval
  if (settings.realityCheckInterval !== undefined) {
    updateData.realityCheckInterval = settings.realityCheckInterval;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    select: {
      depositLimit: true,
      lossLimit: true,
      sessionTimeout: true,
      realityCheckInterval: true,
    },
    data: updateData,
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'RESPONSIBLE_GAMBLING_UPDATED',
      resource: 'user',
      resourceId: userId,
      details: { settings, pendingChanges },
    },
  });

  return {
    settings: updated,
    pendingChanges: pendingChanges.length > 0 ? pendingChanges : undefined,
  };
}

// ---------------------------------------------------------------------------
// activateCoolingOff
// ---------------------------------------------------------------------------

export async function activateCoolingOff(userId: string, duration: '24h' | '1week' | '1month') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coolingOffUntil: true, selfExcludedUntil: true },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  // Check if already in cooling off or self-excluded
  const now = new Date();

  if (user.coolingOffUntil && user.coolingOffUntil > now) {
    return {
      error: 'ALREADY_COOLING_OFF',
      message: `You are already in a cooling-off period until ${user.coolingOffUntil.toISOString()}.`,
    };
  }

  if (user.selfExcludedUntil && user.selfExcludedUntil > now) {
    return {
      error: 'SELF_EXCLUDED',
      message: 'You are currently self-excluded. Cooling-off cannot be applied.',
    };
  }

  // Calculate end date
  const endDate = new Date();
  switch (duration) {
    case '24h':
      endDate.setHours(endDate.getHours() + 24);
      break;
    case '1week':
      endDate.setDate(endDate.getDate() + 7);
      break;
    case '1month':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { coolingOffUntil: endDate },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'COOLING_OFF_ACTIVATED',
      resource: 'user',
      resourceId: userId,
      details: { duration, expiresAt: endDate.toISOString() },
    },
  });

  return {
    coolingOffUntil: endDate,
    duration,
    message: `Cooling-off period activated until ${endDate.toISOString()}. You will not be able to place bets during this period.`,
  };
}

// ---------------------------------------------------------------------------
// activateSelfExclusion
// ---------------------------------------------------------------------------

export async function activateSelfExclusion(
  userId: string,
  duration: '6months' | '1year' | 'permanent',
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { selfExcludedUntil: true },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  const now = new Date();

  if (user.selfExcludedUntil && user.selfExcludedUntil > now) {
    return {
      error: 'ALREADY_EXCLUDED',
      message: `You are already self-excluded until ${user.selfExcludedUntil.toISOString()}.`,
    };
  }

  // Calculate end date
  let endDate: Date;
  switch (duration) {
    case '6months':
      endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 6);
      break;
    case '1year':
      endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    case 'permanent':
      endDate = new Date('9999-12-31T23:59:59.999Z');
      break;
  }

  // Lock the account
  await prisma.user.update({
    where: { id: userId },
    data: {
      selfExcludedUntil: endDate,
      isActive: duration === 'permanent' ? false : undefined,
    },
  });

  // Invalidate all sessions
  await prisma.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SELF_EXCLUSION_ACTIVATED',
      resource: 'user',
      resourceId: userId,
      details: {
        duration,
        expiresAt: endDate.toISOString(),
        isPermanent: duration === 'permanent',
      },
    },
  });

  return {
    selfExcludedUntil: endDate,
    duration,
    message:
      duration === 'permanent'
        ? 'Your account has been permanently self-excluded. This cannot be undone.'
        : `Self-exclusion activated until ${endDate.toISOString()}. Your account has been locked.`,
  };
}

// ---------------------------------------------------------------------------
// getUserStats
// ---------------------------------------------------------------------------

export async function getUserStats(userId: string) {
  // Aggregate sports bet stats
  const betStats = await prisma.bet.aggregate({
    where: { userId },
    _count: { id: true },
    _sum: {
      stake: true,
      actualWin: true,
    },
  });

  const wonBets = await prisma.bet.count({
    where: { userId, status: 'WON' },
  });

  const lostBets = await prisma.bet.count({
    where: { userId, status: 'LOST' },
  });

  // Aggregate casino round stats
  const casinoStats = await prisma.casinoRound.aggregate({
    where: { userId },
    _count: { id: true },
    _sum: {
      betAmount: true,
      payout: true,
    },
  });

  // Find favorite sport (most bet-on)
  const favoriteEventQuery = await prisma.betLeg.groupBy({
    by: ['eventName'],
    where: {
      bet: { userId },
      eventName: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1,
  });

  // Find favorite casino game
  const favoriteCasinoQuery = await prisma.casinoRound.groupBy({
    by: ['gameSlug'],
    where: { userId },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1,
  });

  const totalBetStake = betStats._sum.stake ?? new Prisma.Decimal(0);
  const totalBetWin = betStats._sum.actualWin ?? new Prisma.Decimal(0);
  const totalCasinoBet = casinoStats._sum.betAmount ?? new Prisma.Decimal(0);
  const totalCasinoPayout = casinoStats._sum.payout ?? new Prisma.Decimal(0);

  const totalWagered = totalBetStake.add(totalCasinoBet);
  const totalWon = totalBetWin.add(totalCasinoPayout);
  const totalLost = totalWagered.sub(totalWon);

  return {
    sports: {
      totalBets: betStats._count.id,
      totalStaked: totalBetStake,
      totalWon: totalBetWin,
      wonBets,
      lostBets,
      winRate: betStats._count.id > 0 ? ((wonBets / betStats._count.id) * 100).toFixed(2) : '0.00',
      favoriteSport: favoriteEventQuery[0]?.eventName ?? null,
    },
    casino: {
      totalRounds: casinoStats._count.id,
      totalWagered: totalCasinoBet,
      totalPayout: totalCasinoPayout,
      favoriteGame: favoriteCasinoQuery[0]?.gameSlug ?? null,
    },
    overall: {
      totalWagered,
      totalWon,
      totalLost: totalLost.isNegative() ? new Prisma.Decimal(0) : totalLost,
      netProfit: totalWon.sub(totalWagered),
    },
  };
}

// ---------------------------------------------------------------------------
// Admin: listUsers
// ---------------------------------------------------------------------------

export async function adminListUsers(filters: {
  page: number;
  limit: number;
  search?: string;
  vipTier?: VipTier;
  kycLevel?: KycLevel;
  isBanned?: boolean;
}) {
  const where: Prisma.UserWhereInput = {};

  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: 'insensitive' } },
      { username: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.vipTier) where.vipTier = filters.vipTier;
  if (filters.kycLevel) where.kycLevel = filters.kycLevel;
  if (filters.isBanned !== undefined) where.isBanned = filters.isBanned;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        kycLevel: true,
        vipTier: true,
        totalWagered: true,
        isActive: true,
        isBanned: true,
        banReason: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// ---------------------------------------------------------------------------
// Admin: getUser
// ---------------------------------------------------------------------------

export async function adminGetUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      dateOfBirth: true,
      role: true,
      kycLevel: true,
      vipTier: true,
      totalWagered: true,
      twoFactorEnabled: true,
      preferredCurrency: true,
      preferredOddsFormat: true,
      theme: true,
      language: true,
      isActive: true,
      isBanned: true,
      banReason: true,
      depositLimit: true,
      lossLimit: true,
      selfExcludedUntil: true,
      coolingOffUntil: true,
      sessionTimeout: true,
      realityCheckInterval: true,
      referralCode: true,
      referredBy: true,
      googleId: true,
      githubId: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
      updatedAt: true,
      wallets: {
        select: {
          id: true,
          balance: true,
          lockedBalance: true,
          bonusBalance: true,
          depositAddress: true,
          currency: {
            select: {
              symbol: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Get counts
  const [betsCount, transactionCount, casinoRoundsCount] = await Promise.all([
    prisma.bet.count({ where: { userId } }),
    prisma.transaction.count({
      where: { wallet: { userId } },
    }),
    prisma.casinoRound.count({ where: { userId } }),
  ]);

  return {
    ...user,
    stats: {
      betsCount,
      transactionCount,
      casinoRoundsCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Admin: banUser
// ---------------------------------------------------------------------------

export async function adminBanUser(userId: string, adminId: string, reason: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isBanned: true, role: true },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  if (user.isBanned) {
    return { error: 'ALREADY_BANNED', message: 'User is already banned.' };
  }

  // Prevent banning admins
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return {
      error: 'CANNOT_BAN_ADMIN',
      message: 'Cannot ban an administrator account.',
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true, banReason: reason },
  });

  // Invalidate all sessions
  await prisma.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId,
      userId,
      action: 'USER_BANNED',
      resource: 'user',
      resourceId: userId,
      details: { reason },
    },
  });

  return { success: true, message: 'User has been banned.' };
}

// ---------------------------------------------------------------------------
// Admin: unbanUser
// ---------------------------------------------------------------------------

export async function adminUnbanUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isBanned: true },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  if (!user.isBanned) {
    return { error: 'NOT_BANNED', message: 'User is not currently banned.' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false, banReason: null },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId,
      userId,
      action: 'USER_UNBANNED',
      resource: 'user',
      resourceId: userId,
    },
  });

  return { success: true, message: 'User has been unbanned.' };
}

// ---------------------------------------------------------------------------
// Admin: adjustBalance
// ---------------------------------------------------------------------------

export async function adminAdjustBalance(
  userId: string,
  adminId: string,
  currency: string,
  amount: number,
  type: 'credit' | 'debit',
  reason: string,
) {
  // Look up the currency
  const currencyRecord = await prisma.currency.findUnique({
    where: { symbol: currency },
  });

  if (!currencyRecord) {
    return { error: 'INVALID_CURRENCY', message: `Currency "${currency}" not found.` };
  }

  // Find or create wallet for this user + currency
  let wallet = await prisma.wallet.findUnique({
    where: {
      userId_currencyId: {
        userId,
        currencyId: currencyRecord.id,
      },
    },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: {
        userId,
        currencyId: currencyRecord.id,
        balance: 0,
        lockedBalance: 0,
        bonusBalance: 0,
      },
    });
  }

  const decimalAmount = new Prisma.Decimal(amount);

  // For debit, check sufficient balance
  if (type === 'debit') {
    if (wallet.balance.lt(decimalAmount)) {
      return {
        error: 'INSUFFICIENT_BALANCE',
        message: `User has insufficient ${currency} balance for this debit. Current balance: ${wallet.balance.toString()}.`,
      };
    }
  }

  // Perform the adjustment atomically
  const adjustedBalance =
    type === 'credit'
      ? wallet.balance.add(decimalAmount)
      : wallet.balance.sub(decimalAmount);

  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: adjustedBalance },
    }),
    prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'ADJUSTMENT',
        amount: type === 'credit' ? decimalAmount : decimalAmount.neg(),
        status: 'COMPLETED',
        approvedBy: adminId,
        metadata: { reason, adjustmentType: type, adminId },
      },
    }),
  ]);

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId,
      userId,
      action: 'BALANCE_ADJUSTED',
      resource: 'wallet',
      resourceId: wallet.id,
      details: {
        currency,
        type,
        amount,
        reason,
        previousBalance: wallet.balance.toString(),
        newBalance: updatedWallet.balance.toString(),
        transactionId: transaction.id,
      },
    },
  });

  return {
    wallet: {
      id: updatedWallet.id,
      currency,
      previousBalance: wallet.balance,
      newBalance: updatedWallet.balance,
    },
    transaction: {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
    },
  };
}

// ---------------------------------------------------------------------------
// Admin: setVipTier
// ---------------------------------------------------------------------------

export async function adminSetVipTier(userId: string, adminId: string, tier: VipTier) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, vipTier: true },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  if (user.vipTier === tier) {
    return {
      error: 'SAME_TIER',
      message: `User is already in the ${tier} tier.`,
    };
  }

  const previousTier = user.vipTier;

  await prisma.user.update({
    where: { id: userId },
    data: { vipTier: tier },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId,
      userId,
      action: 'VIP_TIER_SET',
      resource: 'user',
      resourceId: userId,
      details: { previousTier, newTier: tier },
    },
  });

  // Notify user about VIP level change
  await notifyVipLevelUp(userId, tier);

  return {
    previousTier,
    newTier: tier,
    message: `User VIP tier changed from ${previousTier} to ${tier}.`,
  };
}

// ---------------------------------------------------------------------------
// Admin: addNote
// ---------------------------------------------------------------------------

export async function adminAddNote(userId: string, adminId: string, note: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return { error: 'NOT_FOUND', message: 'User not found.' };
  }

  const adminNote = await prisma.adminUserNote.create({
    data: {
      userId,
      adminId,
      note,
    },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
  });

  return { note: adminNote };
}

// ---------------------------------------------------------------------------
// Admin: getNotes
// ---------------------------------------------------------------------------

export async function adminGetNotes(userId: string) {
  const notes = await prisma.adminUserNote.findMany({
    where: { userId },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { notes };
}

// ---------------------------------------------------------------------------
// Internal helpers
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

async function getNextTierConfig(currentTier: VipTier) {
  const currentIndex = VIP_TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex >= VIP_TIER_ORDER.length - 1) {
    return null; // Already at max tier
  }

  const nextTier = VIP_TIER_ORDER[currentIndex + 1];
  const config = await prisma.vipTierConfig.findUnique({
    where: { tier: nextTier },
    select: {
      tier: true,
      name: true,
      minWagered: true,
      rakebackPercent: true,
    },
  });

  return config;
}
