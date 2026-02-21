import { Prisma, type EventStatus, type MarketStatus, type SelectionStatus, type SelectionResult } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { oddsSyncQueue, betSettlementQueue } from '../../queues/index.js';
import type {
  ListUsersQuery,
  EditUserInput,
  BanUserInput,
  AdjustBalanceInput,
  AddNoteInput,
  ListKycQuery,
  RejectKycInput,
  ListBetsQuery,
  VoidBetInput,
  SettleManuallyInput,
  ListGameConfigsQuery,
  UpdateGameConfigInput,
  UpdateHouseEdgeInput,
  ListTransactionsQuery,
  ListWithdrawalsQuery,
  WithdrawalActionInput,
  CreateSportInput,
  UpdateSportInput,
  ListSportsQuery,
  CreateCompetitionInput,
  UpdateCompetitionInput,
  CreateEventInput,
  UpdateEventInput,
  ListEventsQuery,
  CreateMarketInput,
  UpdateMarketInput,
  CreateSelectionInput,
  UpdateSelectionInput,
  SyncOddsInput,
  ListOddsProvidersQuery,
  ConfigureOddsProviderInput,
  CreateOddsProviderInput,
  CreatePromotionInput,
  UpdatePromotionInput,
  ListPromotionsQuery,
  UpdateVipTierInput,
  AssignVipTierInput,
  CreateBlogPostInput,
  UpdateBlogPostInput,
  ListBlogPostsQuery,
  CreateHelpArticleInput,
  UpdateHelpArticleInput,
  ListHelpArticlesQuery,
  CreateCourseInput,
  UpdateCourseInput,
  ListCoursesQuery,
  CreateLessonInput,
  UpdateLessonInput,
  UpdateSiteConfigInput,
  AddGeoRestrictionInput,
  MaintenanceModeInput,
  RevenueReportQuery,
  GameReportQuery,
  UserActivityReportQuery,
  ListAuditLogsQuery,
  ListAlertsQuery,
  ChartPeriodQuery,
} from './admin.schemas.js';

// =============================================================================
// Error Helper
// =============================================================================

export class AdminError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

// =============================================================================
// Frontend Compatibility Helpers
// =============================================================================

/** Maps Prisma VipTier enum values to display-friendly strings the frontend expects. */
const VIP_TIER_DISPLAY: Record<string, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  DIAMOND: 'Diamond',
  ELITE: 'Elite',
  BLACK_DIAMOND: 'Black Diamond',
  BLUE_DIAMOND: 'Blue Diamond',
};

/** Maps display-friendly VIP tier strings back to Prisma enum values for filtering. */
const VIP_TIER_FROM_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(VIP_TIER_DISPLAY).map(([k, v]) => [v, k]),
);

/** Maps Prisma KycLevel enum to numeric levels the frontend expects. */
const KYC_LEVEL_TO_NUMBER: Record<string, number> = {
  UNVERIFIED: 0,
  BASIC: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

/**
 * Derives a frontend-compatible `status` string from isActive/isBanned booleans.
 */
function deriveStatus(isActive: boolean, isBanned: boolean): 'active' | 'banned' | 'suspended' {
  if (isBanned) return 'banned';
  if (!isActive) return 'suspended';
  return 'active';
}

// =============================================================================
// Promotion CTA Helper
// =============================================================================

function getPromotionCtaFields(type: string): { ctaText: string; ctaLink: string } {
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

// =============================================================================
// Audit Log Helper
// =============================================================================

async function createAuditLog(
  adminId: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
) {
  await prisma.auditLog.create({
    data: {
      adminId,
      action,
      resource,
      resourceId,
      details: details as Prisma.InputJsonValue,
      ipAddress,
      userAgent,
    },
  });
}

// =============================================================================
// DASHBOARD
// =============================================================================

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 30);

  const [
    totalUsers,
    newUsersToday,
    newUsersWeek,
    activeBets,
    todayBetsCount,
    todayBetsRevenue,
    weekBetsRevenue,
    monthBetsRevenue,
    pendingWithdrawals,
    pendingWithdrawalsAmount,
    totalDepositsToday,
    totalWithdrawalsToday,
    totalDepositsMonth,
    totalWithdrawalsMonth,
    liveEvents,
    activeSessions,
    pendingKyc,
    unresolvedAlerts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.bet.count({ where: { status: { in: ['PENDING', 'ACCEPTED'] } } }),
    prisma.bet.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.bet.aggregate({
      where: { createdAt: { gte: todayStart }, status: { in: ['WON', 'LOST', 'VOID', 'CASHOUT'] } },
      _sum: { stake: true },
    }),
    prisma.bet.aggregate({
      where: { createdAt: { gte: weekStart }, status: { in: ['WON', 'LOST', 'VOID', 'CASHOUT'] } },
      _sum: { stake: true },
    }),
    prisma.bet.aggregate({
      where: { createdAt: { gte: monthStart }, status: { in: ['WON', 'LOST', 'VOID', 'CASHOUT'] } },
      _sum: { stake: true },
    }),
    prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
    prisma.transaction.aggregate({
      where: { type: 'WITHDRAWAL', status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.event.count({ where: { status: 'LIVE' } }),
    prisma.session.count({ where: { isRevoked: false, expiresAt: { gt: now } } }),
    prisma.kycDocument.count({ where: { status: 'PENDING' } }),
    prisma.adminAlert.count({ where: { isResolved: false } }),
  ]);

  return {
    users: {
      total: totalUsers,
      newToday: newUsersToday,
      newThisWeek: newUsersWeek,
    },
    betting: {
      activeBets,
      todayBetsCount,
      todayRevenue: todayBetsRevenue._sum.stake?.toString() ?? '0',
      weekRevenue: weekBetsRevenue._sum.stake?.toString() ?? '0',
      monthRevenue: monthBetsRevenue._sum.stake?.toString() ?? '0',
    },
    financial: {
      depositsToday: totalDepositsToday._sum.amount?.toString() ?? '0',
      withdrawalsToday: totalWithdrawalsToday._sum.amount?.toString() ?? '0',
      depositsMonth: totalDepositsMonth._sum.amount?.toString() ?? '0',
      withdrawalsMonth: totalWithdrawalsMonth._sum.amount?.toString() ?? '0',
      pendingWithdrawals,
      pendingWithdrawalsAmount: pendingWithdrawalsAmount._sum.amount?.toString() ?? '0',
    },
    platform: {
      liveEvents,
      activeSessions,
      pendingKyc,
      unresolvedAlerts,
    },
  };
}

export async function getChartData(query: ChartPeriodQuery) {
  const period = query.period as '7d' | '30d' | '90d';
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    dates.push(d.toISOString().split('T')[0]);
  }

  const [bets, deposits, withdrawals, registrations] = await Promise.all([
    prisma.bet.findMany({
      where: { createdAt: { gte: startDate }, status: { in: ['WON', 'LOST', 'VOID', 'CASHOUT'] } },
      select: { stake: true, actualWin: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: startDate } },
      select: { amount: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: startDate } },
      select: { amount: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    }),
  ]);

  const revenueByDay = new Map<string, number>();
  const depositsByDay = new Map<string, number>();
  const withdrawalsByDay = new Map<string, number>();
  const registrationsByDay = new Map<string, number>();
  const profitByDay = new Map<string, number>();

  for (const date of dates) {
    revenueByDay.set(date, 0);
    depositsByDay.set(date, 0);
    withdrawalsByDay.set(date, 0);
    registrationsByDay.set(date, 0);
    profitByDay.set(date, 0);
  }

  for (const bet of bets) {
    const day = bet.createdAt.toISOString().split('T')[0];
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(bet.stake));
    const win = bet.actualWin ? Number(bet.actualWin) : 0;
    profitByDay.set(day, (profitByDay.get(day) ?? 0) + (Number(bet.stake) - win));
  }

  for (const dep of deposits) {
    const day = dep.createdAt.toISOString().split('T')[0];
    depositsByDay.set(day, (depositsByDay.get(day) ?? 0) + Number(dep.amount));
  }

  for (const w of withdrawals) {
    const day = w.createdAt.toISOString().split('T')[0];
    withdrawalsByDay.set(day, (withdrawalsByDay.get(day) ?? 0) + Number(w.amount));
  }

  for (const reg of registrations) {
    const day = reg.createdAt.toISOString().split('T')[0];
    registrationsByDay.set(day, (registrationsByDay.get(day) ?? 0) + 1);
  }

  return {
    labels: dates,
    revenue: dates.map((d) => revenueByDay.get(d) ?? 0),
    profit: dates.map((d) => profitByDay.get(d) ?? 0),
    deposits: dates.map((d) => depositsByDay.get(d) ?? 0),
    withdrawals: dates.map((d) => withdrawalsByDay.get(d) ?? 0),
    registrations: dates.map((d) => registrationsByDay.get(d) ?? 0),
  };
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export async function listUsers(query: ListUsersQuery) {
  const { page, limit, search, role, vipTier, kycLevel, isBanned, isActive, sortBy, sortOrder } = query;
  // Frontend sends `sortDir` and `status` — extract via `as any` since they're optional schema fields
  const sortDir = (query as any).sortDir as string | undefined;
  const status = (query as any).status as string | undefined;

  // Use `sortDir` as alias for `sortOrder` (frontend sends sortDir)
  const effectiveSortOrder: 'asc' | 'desc' = (sortDir === 'asc' || sortDir === 'desc' ? sortDir : sortOrder) ?? 'desc';

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { id: { contains: search } },
    ];
  }
  if (role) where.role = role as Prisma.EnumUserRoleFilter['equals'];

  // Handle vipTier — frontend may send display names like "Gold", convert to enum "GOLD"
  if (vipTier) {
    const enumValue = VIP_TIER_FROM_DISPLAY[vipTier] ?? vipTier;
    where.vipTier = enumValue as Prisma.EnumVipTierFilter['equals'];
  }

  // Handle kycLevel — frontend may send numeric string "0","1","2","3", convert to enum
  if (kycLevel) {
    const kycEnumMap: Record<string, string> = { '0': 'UNVERIFIED', '1': 'BASIC', '2': 'INTERMEDIATE', '3': 'ADVANCED' };
    const enumValue = kycEnumMap[kycLevel as string] ?? kycLevel;
    where.kycLevel = enumValue as Prisma.EnumKycLevelFilter['equals'];
  }

  // Handle `status` filter from frontend: status=banned → isBanned=true
  if (status === 'banned') {
    where.isBanned = true;
  } else if (status === 'suspended') {
    where.isActive = false;
    where.isBanned = false;
  } else if (status === 'active') {
    where.isActive = true;
    where.isBanned = false;
  }

  // Also keep legacy isBanned / isActive filters for backward compat
  if (isBanned !== undefined && !status) where.isBanned = isBanned;
  if (isActive !== undefined && !status) where.isActive = isActive;

  const orderBy: Prisma.UserOrderByWithRelationInput = {};
  const allowedSortFields = ['createdAt', 'email', 'username', 'totalWagered', 'vipTier', 'lastLoginAt', 'balance'];
  if (sortBy && sortBy !== 'balance' && allowedSortFields.includes(sortBy)) {
    orderBy[sortBy as keyof Prisma.UserOrderByWithRelationInput] = effectiveSortOrder;
  } else if (sortBy !== 'balance') {
    orderBy.createdAt = 'desc';
  } else {
    // 'balance' sort: not a direct user field; fall back to createdAt
    orderBy.createdAt = effectiveSortOrder as 'asc' | 'desc';
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
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
        preferredCurrency: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
        wallets: {
          select: {
            balance: true,
            lockedBalance: true,
          },
        },
        _count: {
          select: {
            bets: true,
            wallets: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map((u) => {
      // Calculate total balance across all wallets
      const totalBalance = u.wallets.reduce(
        (sum, w) => sum + parseFloat(w.balance.toString()),
        0,
      );

      return {
        // Original fields preserved for backward compat
        id: u.id,
        email: u.email,
        username: u.username,
        avatar: u.avatar,
        role: u.role,
        isActive: u.isActive,
        isBanned: u.isBanned,
        banReason: u.banReason,
        preferredCurrency: u.preferredCurrency,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        betCount: u._count.bets,
        walletCount: u._count.wallets,

        // Frontend-compatible transformed fields
        avatarUrl: u.avatar,                                          // avatar → avatarUrl
        vipTier: VIP_TIER_DISPLAY[u.vipTier] ?? u.vipTier,            // GOLD → Gold
        kycLevel: KYC_LEVEL_TO_NUMBER[u.kycLevel] ?? 0,               // BASIC → 1
        totalWagered: parseFloat(u.totalWagered.toString()),           // Decimal string → number
        balance: totalBalance,                                        // aggregated wallet balance
        currency: u.preferredCurrency,                                // preferredCurrency → currency
        status: deriveStatus(u.isActive, u.isBanned),                 // booleans → 'active'|'banned'|'suspended'
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUser(userId: string) {
  const [user, depositAgg, withdrawalAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallets: {
          include: {
            currency: { select: { symbol: true, name: true, type: true } },
          },
        },
        riskProfile: true,
        adminNotes: {
          include: {
            admin: { select: { id: true, username: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            bets: true,
            kycDocuments: true,
            notifications: true,
            rewards: true,
            sessions: true,
          },
        },
      },
    }),
    // Aggregate total deposits for this user
    prisma.transaction.aggregate({
      where: {
        wallet: { userId },
        type: 'DEPOSIT',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    }),
    // Aggregate total withdrawals for this user
    prisma.transaction.aggregate({
      where: {
        wallet: { userId },
        type: 'WITHDRAWAL',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    }),
  ]);

  if (!user) throw new AdminError('USER_NOT_FOUND', 'User not found', 404);

  // Compute aggregate financial stats from risk profile and transactions
  const riskTotalWon = user.riskProfile ? parseFloat(user.riskProfile.totalWon.toString()) : 0;
  const riskTotalLost = user.riskProfile ? parseFloat(user.riskProfile.totalLost.toString()) : 0;
  const totalWageredNum = parseFloat(user.totalWagered.toString());
  const totalDepositedNum = depositAgg._sum.amount ? parseFloat(depositAgg._sum.amount.toString()) : 0;
  const totalWithdrawnNum = withdrawalAgg._sum.amount ? parseFloat(withdrawalAgg._sum.amount.toString()) : 0;

  return {
    // Original fields preserved for backward compat
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
    role: user.role,
    twoFactorEnabled: user.twoFactorEnabled,
    preferredCurrency: user.preferredCurrency,
    preferredOddsFormat: user.preferredOddsFormat,
    theme: user.theme,
    language: user.language,
    isActive: user.isActive,
    isBanned: user.isBanned,
    banReason: user.banReason,
    depositLimit: user.depositLimit,
    lossLimit: user.lossLimit,
    selfExcludedUntil: user.selfExcludedUntil?.toISOString() ?? null,
    timeoutUntil: user.timeoutUntil?.toISOString() ?? null,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: user.lastLoginIp,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),

    // Frontend-compatible transformed fields
    avatarUrl: user.avatar,                                            // avatar → avatarUrl
    vipTier: VIP_TIER_DISPLAY[user.vipTier] ?? user.vipTier,           // GOLD → Gold
    kycLevel: KYC_LEVEL_TO_NUMBER[user.kycLevel] ?? 0,                 // BASIC → 1
    status: deriveStatus(user.isActive, user.isBanned),                // booleans → 'active'|'banned'|'suspended'
    currency: user.preferredCurrency,                                  // preferredCurrency → currency
    totalWagered: totalWageredNum,                                     // Decimal → number
    totalWon: riskTotalWon,                                            // from risk profile
    totalDeposited: totalDepositedNum,                                 // from transaction aggregation
    totalWithdrawn: totalWithdrawnNum,                                 // from transaction aggregation
    netProfit: riskTotalWon - riskTotalLost,                           // won - lost

    wallets: user.wallets.map((w) => ({
      id: w.id,
      currencySymbol: w.currency.symbol,
      currencyName: w.currency.name,
      currencyType: w.currency.type,
      balance: w.balance.toString(),
      lockedBalance: w.lockedBalance.toString(),
      bonusBalance: w.bonusBalance.toString(),
      depositAddress: w.depositAddress,
    })),
    riskProfile: user.riskProfile
      ? {
          riskLevel: user.riskProfile.riskLevel,
          totalBets: user.riskProfile.totalBets,
          totalWon: user.riskProfile.totalWon.toString(),
          totalLost: user.riskProfile.totalLost.toString(),
          winRate: user.riskProfile.winRate.toString(),
          avgStake: user.riskProfile.avgStake.toString(),
          maxStake: user.riskProfile.maxStake.toString(),
          flags: user.riskProfile.flags,
        }
      : null,
    notes: user.adminNotes.map((n) => ({
      id: n.id,
      note: n.note,
      adminId: n.admin.id,
      adminUsername: n.admin.username,
      createdAt: n.createdAt.toISOString(),
    })),
    counts: user._count,
  };
}

export async function editUser(userId: string, input: EditUserInput, adminId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new AdminError('USER_NOT_FOUND', 'User not found', 404);

  if (input.email && input.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) throw new AdminError('EMAIL_TAKEN', 'Email is already in use');
  }

  if (input.username && input.username !== existing.username) {
    const usernameTaken = await prisma.user.findUnique({ where: { username: input.username } });
    if (usernameTaken) throw new AdminError('USERNAME_TAKEN', 'Username is already in use');
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (input.email !== undefined) updateData.email = input.email;
  if (input.username !== undefined) updateData.username = input.username;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.vipTier !== undefined) updateData.vipTier = input.vipTier;
  if (input.kycLevel !== undefined) updateData.kycLevel = input.kycLevel;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.preferredCurrency !== undefined) updateData.preferredCurrency = input.preferredCurrency;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true, email: true, username: true, role: true,
      vipTier: true, kycLevel: true, isActive: true, updatedAt: true,
    },
  });

  await createAuditLog(adminId, 'EDIT_USER', 'user', userId, input as Record<string, unknown>);
  return user;
}

export async function banUser(userId: string, input: BanUserInput, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminError('USER_NOT_FOUND', 'User not found', 404);
  if (user.isBanned) throw new AdminError('ALREADY_BANNED', 'User is already banned');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true, banReason: input.reason, isActive: false },
    select: { id: true, email: true, username: true, isBanned: true, banReason: true },
  });

  // Revoke all active sessions
  await prisma.session.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });

  await createAuditLog(adminId, 'BAN_USER', 'user', userId, { reason: input.reason });
  return updated;
}

export async function unbanUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminError('USER_NOT_FOUND', 'User not found', 404);
  if (!user.isBanned) throw new AdminError('NOT_BANNED', 'User is not banned');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false, banReason: null, isActive: true },
    select: { id: true, email: true, username: true, isBanned: true },
  });

  await createAuditLog(adminId, 'UNBAN_USER', 'user', userId);
  return updated;
}

export async function adjustBalance(userId: string, input: AdjustBalanceInput, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminError('USER_NOT_FOUND', 'User not found', 404);

  // Normalize: accept both 'currencySymbol' and 'currency' field names
  const currencySymbol = input.currencySymbol || input.currency || '';
  const currency = await prisma.currency.findUnique({ where: { symbol: currencySymbol } });
  if (!currency) throw new AdminError('CURRENCY_NOT_FOUND', 'Currency not found', 404);

  const absoluteAmount = new Prisma.Decimal(Math.abs(input.amount));
  // Derive type from amount sign if not explicitly provided
  const adjustType = input.type || (input.amount > 0 ? 'CREDIT' : 'DEBIT');
  const isCredit = adjustType === 'CREDIT';

  const result = await prisma.$transaction(async (tx) => {
    // Find or create wallet
    let wallet = await tx.wallet.findUnique({
      where: { userId_currencyId: { userId, currencyId: currency.id } },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId, currencyId: currency.id, balance: new Prisma.Decimal(0) },
      });
    }

    // Check sufficient balance for debit
    if (!isCredit && wallet.balance.lt(absoluteAmount)) {
      throw new AdminError('INSUFFICIENT_BALANCE', 'User has insufficient balance for this debit');
    }

    // Update wallet balance
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: isCredit
          ? { increment: absoluteAmount }
          : { decrement: absoluteAmount },
      },
    });

    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'ADJUSTMENT',
        amount: absoluteAmount,
        status: 'COMPLETED',
        metadata: {
          adminId,
          type: adjustType,
          reason: input.reason,
          originalAmount: input.amount,
        },
      },
    });

    return { wallet: updatedWallet, transaction };
  });

  await createAuditLog(adminId, 'ADJUST_BALANCE', 'wallet', result.wallet.id, {
    userId,
    type: adjustType,
    amount: input.amount,
    currency: currencySymbol,
    reason: input.reason,
  });

  return {
    walletId: result.wallet.id,
    newBalance: result.wallet.balance.toString(),
    transactionId: result.transaction.id,
    type: adjustType,
    amount: absoluteAmount.toString(),
    currency: currencySymbol,
  };
}

export async function addNote(userId: string, input: AddNoteInput, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminError('USER_NOT_FOUND', 'User not found', 404);

  // Accept both 'note' and 'content' field names
  const noteText = input.note || input.content || '';
  const note = await prisma.adminUserNote.create({
    data: { userId, adminId, note: noteText },
    include: {
      admin: { select: { id: true, username: true, email: true } },
    },
  });

  return {
    id: note.id,
    note: note.note,
    adminId: note.admin.id,
    adminUsername: note.admin.username,
    createdAt: note.createdAt.toISOString(),
  };
}

// =============================================================================
// KYC MANAGEMENT
// =============================================================================

export async function listKycDocuments(query: ListKycQuery) {
  const { page, limit, status, type } = query;

  const where: Prisma.KycDocumentWhereInput = {};
  if (status) where.status = status.toUpperCase() as Prisma.EnumKycDocStatusFilter['equals'];
  if (type) where.type = type.toUpperCase() as Prisma.EnumKycDocTypeFilter['equals'];

  const [documents, total] = await Promise.all([
    prisma.kycDocument.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true, email: true, username: true, kycLevel: true,
            vipTier: true, createdAt: true,
          },
        },
      },
    }),
    prisma.kycDocument.count({ where }),
  ]);

  return {
    documents: documents.map((d) => ({
      id: d.id,
      userId: d.userId,
      type: d.type,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      status: d.status,
      reviewedBy: d.reviewedBy,
      reviewNote: d.reviewNote,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      user: {
        id: d.user.id,
        email: d.user.email,
        username: d.user.username,
        kycLevel: d.user.kycLevel,
        vipTier: d.user.vipTier,
        createdAt: d.user.createdAt.toISOString(),
      },
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function approveKycDocument(docId: string, adminId: string) {
  const document = await prisma.kycDocument.findUnique({
    where: { id: docId },
    include: {
      user: {
        select: { id: true, kycLevel: true, kycDocuments: { select: { type: true, status: true } } },
      },
    },
  });

  if (!document) throw new AdminError('DOC_NOT_FOUND', 'Document not found', 404);
  if (document.status !== 'PENDING') {
    throw new AdminError('ALREADY_REVIEWED', `Document already ${document.status.toLowerCase()}`);
  }

  const updated = await prisma.kycDocument.update({
    where: { id: docId },
    data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date() },
  });

  // Evaluate KYC level upgrade
  const allDocs = await prisma.kycDocument.findMany({
    where: { userId: document.userId },
    select: { type: true, status: true },
  });

  const approvedTypes = new Set(
    allDocs.filter((d) => d.status === 'APPROVED' || d.id === docId).map((d) => d.type),
  );

  const hasIdDoc = approvedTypes.has('PASSPORT') || approvedTypes.has('DRIVERS_LICENSE') || approvedTypes.has('NATIONAL_ID');
  const hasProofOfAddress = approvedTypes.has('PROOF_OF_ADDRESS');

  let newLevel = document.user.kycLevel;
  if (hasIdDoc && hasProofOfAddress) {
    newLevel = 'ADVANCED';
  } else if (hasIdDoc) {
    newLevel = 'INTERMEDIATE';
  }

  if (newLevel !== document.user.kycLevel) {
    await prisma.user.update({
      where: { id: document.userId },
      data: { kycLevel: newLevel },
    });
  }

  await createAuditLog(adminId, 'KYC_APPROVE', 'kyc_document', docId, {
    docType: document.type,
    previousLevel: document.user.kycLevel,
    newLevel,
  });

  return {
    document: updated,
    kycLevelUpgraded: newLevel !== document.user.kycLevel,
    newKycLevel: newLevel,
  };
}

export async function rejectKycDocument(docId: string, input: RejectKycInput, adminId: string) {
  const document = await prisma.kycDocument.findUnique({ where: { id: docId } });
  if (!document) throw new AdminError('DOC_NOT_FOUND', 'Document not found', 404);
  if (document.status !== 'PENDING') {
    throw new AdminError('ALREADY_REVIEWED', `Document already ${document.status.toLowerCase()}`);
  }

  const updated = await prisma.kycDocument.update({
    where: { id: docId },
    data: { status: 'REJECTED', reviewedBy: adminId, reviewNote: input.reason, reviewedAt: new Date() },
  });

  await createAuditLog(adminId, 'KYC_REJECT', 'kyc_document', docId, {
    docType: document.type,
    reason: input.reason,
  });

  return { document: updated };
}

// =============================================================================
// BETTING MANAGEMENT
// =============================================================================

export async function listBets(query: ListBetsQuery) {
  const { page, limit, status, type, userId, minStake, maxStake, isLive, startDate, endDate, sortBy, sortOrder } = query;

  const where: Prisma.BetWhereInput = {};
  if (status) where.status = status.toUpperCase() as Prisma.EnumBetStatusFilter['equals'];
  if (type) where.type = type.toUpperCase() as Prisma.EnumBetTypeFilter['equals'];
  if (userId) where.userId = userId;
  if (isLive !== undefined) where.isLive = isLive;
  if (minStake || maxStake) {
    where.stake = {};
    if (minStake) where.stake.gte = new Prisma.Decimal(minStake);
    if (maxStake) where.stake.lte = new Prisma.Decimal(maxStake);
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const orderBy: Prisma.BetOrderByWithRelationInput = {};
  const allowedSortFields = ['createdAt', 'stake', 'potentialWin', 'odds', 'status'];
  if (sortBy && allowedSortFields.includes(sortBy)) {
    orderBy[sortBy as keyof Prisma.BetOrderByWithRelationInput] = sortOrder;
  } else {
    orderBy.createdAt = 'desc';
  }

  const [bets, total] = await Promise.all([
    prisma.bet.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, email: true, vipTier: true } },
        legs: {
          include: {
            selection: {
              select: { name: true, odds: true, status: true, result: true },
            },
          },
        },
      },
    }),
    prisma.bet.count({ where }),
  ]);

  return {
    data: bets.map((b) => ({
      id: b.id,
      referenceId: b.referenceId,
      userId: b.userId,
      user: b.user,
      type: b.type,
      stake: b.stake.toString(),
      currencySymbol: b.currencySymbol,
      potentialWin: b.potentialWin.toString(),
      actualWin: b.actualWin?.toString() ?? null,
      cashoutAmount: b.cashoutAmount?.toString() ?? null,
      odds: b.odds.toString(),
      status: b.status,
      isLive: b.isLive,
      settledAt: b.settledAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
      legs: b.legs.map((l) => ({
        id: l.id,
        selectionId: l.selectionId,
        eventName: l.eventName,
        marketName: l.marketName,
        selectionName: l.selectionName,
        oddsAtPlacement: l.oddsAtPlacement.toString(),
        status: l.status,
        currentOdds: l.selection.odds.toString(),
        selectionStatus: l.selection.status,
        selectionResult: l.selection.result,
      })),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function voidBet(betId: string, input: VoidBetInput, adminId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { user: { select: { id: true } } },
  });

  if (!bet) throw new AdminError('BET_NOT_FOUND', 'Bet not found', 404);
  if (bet.status === 'VOID') throw new AdminError('ALREADY_VOIDED', 'Bet is already voided');
  if (bet.status === 'WON' || bet.status === 'LOST') {
    throw new AdminError('ALREADY_SETTLED', 'Cannot void a settled bet');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Void the bet
    const voidedBet = await tx.bet.update({
      where: { id: betId },
      data: { status: 'VOID', settledAt: new Date() },
    });

    // Void all legs
    await tx.betLeg.updateMany({
      where: { betId },
      data: { status: 'VOID' },
    });

    // Refund stake to user wallet
    const currency = await tx.currency.findUnique({
      where: { symbol: bet.currencySymbol },
      select: { id: true },
    });

    if (currency) {
      const wallet = await tx.wallet.findUnique({
        where: { userId_currencyId: { userId: bet.userId, currencyId: currency.id } },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: bet.stake } },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'ADJUSTMENT',
            amount: bet.stake,
            status: 'COMPLETED',
            metadata: {
              source: 'BET_VOID',
              betId,
              adminId,
              reason: input.reason,
            },
          },
        });
      }
    }

    return voidedBet;
  });

  await createAuditLog(adminId, 'VOID_BET', 'bet', betId, {
    userId: bet.userId,
    stake: bet.stake.toString(),
    reason: input.reason,
  });

  return { bet: result, refundedAmount: bet.stake.toString() };
}

export async function settleManually(betId: string, input: SettleManuallyInput, adminId: string) {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { user: { select: { id: true } } },
  });

  if (!bet) throw new AdminError('BET_NOT_FOUND', 'Bet not found', 404);
  if (['WON', 'LOST', 'VOID', 'CASHOUT'].includes(bet.status)) {
    throw new AdminError('ALREADY_SETTLED', 'Bet is already settled');
  }

  const result = await prisma.$transaction(async (tx) => {
    let actualWin: Prisma.Decimal | null = null;

    if (input.result === 'WON') {
      actualWin = input.payout != null
        ? new Prisma.Decimal(input.payout)
        : bet.potentialWin;

      // Credit winnings
      const currency = await tx.currency.findUnique({
        where: { symbol: bet.currencySymbol },
        select: { id: true },
      });

      if (currency) {
        const wallet = await tx.wallet.findUnique({
          where: { userId_currencyId: { userId: bet.userId, currencyId: currency.id } },
        });

        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: actualWin } },
          });

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'WIN',
              amount: actualWin,
              status: 'COMPLETED',
              metadata: {
                source: 'MANUAL_SETTLEMENT',
                betId,
                adminId,
                reason: input.reason,
              },
            },
          });
        }
      }
    } else if (input.result === 'VOID') {
      // Refund stake
      actualWin = bet.stake;
      const currency = await tx.currency.findUnique({
        where: { symbol: bet.currencySymbol },
        select: { id: true },
      });

      if (currency) {
        const wallet = await tx.wallet.findUnique({
          where: { userId_currencyId: { userId: bet.userId, currencyId: currency.id } },
        });

        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: bet.stake } },
          });

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'ADJUSTMENT',
              amount: bet.stake,
              status: 'COMPLETED',
              metadata: {
                source: 'MANUAL_VOID',
                betId,
                adminId,
                reason: input.reason,
              },
            },
          });
        }
      }
    }

    const settledBet = await tx.bet.update({
      where: { id: betId },
      data: {
        status: input.result as Prisma.EnumBetStatusFieldUpdateOperationsInput['set'],
        actualWin,
        settledAt: new Date(),
      },
    });

    return settledBet;
  });

  await createAuditLog(adminId, 'MANUAL_SETTLE_BET', 'bet', betId, {
    userId: bet.userId,
    result: input.result,
    payout: input.payout,
    reason: input.reason,
  });

  return {
    bet: {
      ...result,
      stake: result.stake.toString(),
      potentialWin: result.potentialWin.toString(),
      actualWin: result.actualWin?.toString() ?? null,
      odds: result.odds.toString(),
    },
  };
}

// =============================================================================
// CASINO MANAGEMENT
// =============================================================================

export async function listGameConfigs(query: ListGameConfigsQuery) {
  const { page, limit, gameSlug, isActive } = query;

  const where: Prisma.CasinoGameConfigWhereInput = {};
  if (gameSlug) where.gameSlug = { contains: gameSlug, mode: 'insensitive' };
  if (isActive !== undefined) where.isActive = isActive;

  const [configs, total] = await Promise.all([
    prisma.casinoGameConfig.findMany({
      where,
      orderBy: { gameSlug: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.casinoGameConfig.count({ where }),
  ]);

  return {
    configs: configs.map((c) => ({
      id: c.id,
      gameSlug: c.gameSlug,
      houseEdge: c.houseEdge.toString(),
      minBet: c.minBet.toString(),
      maxBet: c.maxBet.toString(),
      isActive: c.isActive,
      jackpotContribution: c.jackpotContribution.toString(),
      config: c.config,
      updatedAt: c.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function updateGameConfig(configId: string, input: UpdateGameConfigInput, adminId: string) {
  const existing = await prisma.casinoGameConfig.findUnique({ where: { id: configId } });
  if (!existing) throw new AdminError('CONFIG_NOT_FOUND', 'Game config not found', 404);

  const updateData: Prisma.CasinoGameConfigUpdateInput = {};
  if (input.houseEdge !== undefined) updateData.houseEdge = new Prisma.Decimal(input.houseEdge);
  if (input.minBet !== undefined) updateData.minBet = new Prisma.Decimal(input.minBet);
  if (input.maxBet !== undefined) updateData.maxBet = new Prisma.Decimal(input.maxBet);
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.jackpotContribution !== undefined) updateData.jackpotContribution = new Prisma.Decimal(input.jackpotContribution);
  if (input.config !== undefined) updateData.config = input.config as Prisma.InputJsonValue;

  const config = await prisma.casinoGameConfig.update({
    where: { id: configId },
    data: updateData,
  });

  // Invalidate game config cache
  await redis.del(`game:config:${existing.gameSlug}`);

  await createAuditLog(adminId, 'UPDATE_GAME_CONFIG', 'casino_game_config', configId, {
    gameSlug: existing.gameSlug,
    changes: input as Record<string, unknown>,
  });

  return {
    id: config.id,
    gameSlug: config.gameSlug,
    houseEdge: config.houseEdge.toString(),
    minBet: config.minBet.toString(),
    maxBet: config.maxBet.toString(),
    isActive: config.isActive,
    jackpotContribution: config.jackpotContribution.toString(),
    config: config.config,
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function updateHouseEdge(input: UpdateHouseEdgeInput, adminId: string) {
  const config = await prisma.casinoGameConfig.findUnique({
    where: { gameSlug: input.gameSlug },
  });

  if (!config) throw new AdminError('CONFIG_NOT_FOUND', `No config found for game "${input.gameSlug}"`, 404);

  const updated = await prisma.casinoGameConfig.update({
    where: { gameSlug: input.gameSlug },
    data: { houseEdge: new Prisma.Decimal(input.houseEdge) },
  });

  await redis.del(`game:config:${input.gameSlug}`);

  await createAuditLog(adminId, 'UPDATE_HOUSE_EDGE', 'casino_game_config', config.id, {
    gameSlug: input.gameSlug,
    previousHouseEdge: config.houseEdge.toString(),
    newHouseEdge: input.houseEdge,
  });

  return {
    gameSlug: updated.gameSlug,
    houseEdge: updated.houseEdge.toString(),
  };
}

// =============================================================================
// FINANCIAL MANAGEMENT
// =============================================================================

export async function listTransactions(query: ListTransactionsQuery) {
  const { page, limit, type, status, userId, walletId, minAmount, maxAmount, startDate, endDate, sortBy, sortOrder } = query;

  const where: Prisma.TransactionWhereInput = {};
  if (type) where.type = type.toUpperCase() as Prisma.EnumTxTypeFilter['equals'];
  if (status) where.status = status.toUpperCase() as Prisma.EnumTxStatusFilter['equals'];
  if (walletId) where.walletId = walletId;
  if (userId) {
    where.wallet = { userId };
  }
  if (minAmount || maxAmount) {
    where.amount = {};
    if (minAmount) where.amount.gte = new Prisma.Decimal(minAmount);
    if (maxAmount) where.amount.lte = new Prisma.Decimal(maxAmount);
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
  const allowedSortFields = ['createdAt', 'amount', 'type', 'status'];
  if (sortBy && allowedSortFields.includes(sortBy)) {
    orderBy[sortBy as keyof Prisma.TransactionOrderByWithRelationInput] = sortOrder;
  } else {
    orderBy.createdAt = 'desc';
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        wallet: {
          select: {
            userId: true,
            currency: { select: { symbol: true, name: true } },
            user: { select: { id: true, username: true, email: true } },
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    data: transactions.map((t) => ({
      id: t.id,
      walletId: t.walletId,
      userId: t.wallet.userId,
      username: t.wallet.user.username,
      email: t.wallet.user.email,
      currencySymbol: t.wallet.currency.symbol,
      currencyName: t.wallet.currency.name,
      type: t.type,
      amount: t.amount.toString(),
      fee: t.fee.toString(),
      txHash: t.txHash,
      fromAddress: t.fromAddress,
      toAddress: t.toAddress,
      status: t.status,
      confirmations: t.confirmations,
      approvedBy: t.approvedBy,
      rejectedReason: t.rejectedReason,
      metadata: t.metadata,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function listPendingWithdrawals(query: ListWithdrawalsQuery) {
  const { page, limit, status, userId, startDate, endDate } = query;

  const where: Prisma.TransactionWhereInput = {
    type: 'WITHDRAWAL',
  };
  if (status) {
    where.status = status.toUpperCase() as Prisma.EnumTxStatusFilter['equals'];
  } else {
    where.status = 'PENDING';
  }
  if (userId) where.wallet = { userId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [withdrawals, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        wallet: {
          select: {
            userId: true,
            currency: { select: { symbol: true, name: true } },
            user: { select: { id: true, username: true, email: true, kycLevel: true, vipTier: true } },
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    data: withdrawals.map((w) => ({
      id: w.id,
      userId: w.wallet.userId,
      user: w.wallet.user,
      currencySymbol: w.wallet.currency.symbol,
      amount: w.amount.toString(),
      fee: w.fee.toString(),
      toAddress: w.toAddress,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function approveWithdrawal(txId: string, adminId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: txId },
    include: { wallet: { select: { userId: true } } },
  });

  if (!tx) throw new AdminError('TX_NOT_FOUND', 'Transaction not found', 404);
  if (tx.type !== 'WITHDRAWAL') throw new AdminError('NOT_WITHDRAWAL', 'Transaction is not a withdrawal');
  if (tx.status !== 'PENDING') throw new AdminError('NOT_PENDING', 'Withdrawal is not pending');

  const updated = await prisma.transaction.update({
    where: { id: txId },
    data: { status: 'APPROVED', approvedBy: adminId },
  });

  await createAuditLog(adminId, 'APPROVE_WITHDRAWAL', 'transaction', txId, {
    userId: tx.wallet.userId,
    amount: tx.amount.toString(),
  });

  return { transaction: { ...updated, amount: updated.amount.toString(), fee: updated.fee.toString() } };
}

export async function rejectWithdrawal(txId: string, input: WithdrawalActionInput, adminId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: txId },
    include: { wallet: { select: { userId: true, id: true } } },
  });

  if (!tx) throw new AdminError('TX_NOT_FOUND', 'Transaction not found', 404);
  if (tx.type !== 'WITHDRAWAL') throw new AdminError('NOT_WITHDRAWAL', 'Transaction is not a withdrawal');
  if (tx.status !== 'PENDING') throw new AdminError('NOT_PENDING', 'Withdrawal is not pending');

  const result = await prisma.$transaction(async (ptx) => {
    // Reject the transaction
    const updated = await ptx.transaction.update({
      where: { id: txId },
      data: {
        status: 'REJECTED',
        rejectedReason: input.reason ?? 'Rejected by admin',
      },
    });

    // Refund the amount + fee back to wallet
    const refundAmount = tx.amount.add(tx.fee);
    await ptx.wallet.update({
      where: { id: tx.wallet.id },
      data: { balance: { increment: refundAmount } },
    });

    return updated;
  });

  await createAuditLog(adminId, 'REJECT_WITHDRAWAL', 'transaction', txId, {
    userId: tx.wallet.userId,
    amount: tx.amount.toString(),
    reason: input.reason,
  });

  return { transaction: { ...result, amount: result.amount.toString(), fee: result.fee.toString() } };
}

// =============================================================================
// SPORTS MANAGEMENT
// =============================================================================

export async function listSports(query: ListSportsQuery) {
  const { page, limit, isActive, search } = query;

  const where: Prisma.SportWhereInput = {};
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [sports, total] = await Promise.all([
    prisma.sport.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { competitions: true } } },
    }),
    prisma.sport.count({ where }),
  ]);

  return {
    data: sports.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      icon: s.icon,
      isActive: s.isActive,
      active: s.isActive,
      sortOrder: s.sortOrder,
      order: s.sortOrder,
      eventCount: s.eventCount ?? 0,
      competitionCount: s._count.competitions,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createSport(input: CreateSportInput, adminId: string) {
  // Check for duplicate name/slug before creating
  const existingName = await prisma.sport.findUnique({ where: { name: input.name } });
  if (existingName) throw new AdminError('DUPLICATE_SPORT', `Sport with name "${input.name}" already exists`, 409);
  const existingSlug = await prisma.sport.findUnique({ where: { slug: input.slug } });
  if (existingSlug) throw new AdminError('DUPLICATE_SPORT', `Sport with slug "${input.slug}" already exists`, 409);

  const sport = await prisma.sport.create({ data: input });
  await redis.del('sports:list');
  await createAuditLog(adminId, 'CREATE_SPORT', 'sport', sport.id, { name: input.name });
  return sport;
}

export async function updateSport(id: string, input: UpdateSportInput, adminId: string) {
  const existing = await prisma.sport.findUnique({ where: { id } });
  if (!existing) throw new AdminError('SPORT_NOT_FOUND', 'Sport not found', 404);

  // Map frontend field names to database field names
  const data: any = { ...input };
  if ((input as any).active !== undefined && data.isActive === undefined) {
    data.isActive = (input as any).active;
  }
  if ((input as any).order !== undefined && data.sortOrder === undefined) {
    data.sortOrder = (input as any).order;
  }
  delete data.active;
  delete data.order;

  const sport = await prisma.sport.update({ where: { id }, data });
  await redis.del('sports:list');
  await createAuditLog(adminId, 'UPDATE_SPORT', 'sport', id, input as Record<string, unknown>);
  return sport;
}

export async function deleteSport(id: string, adminId: string) {
  const existing = await prisma.sport.findUnique({ where: { id }, include: { _count: { select: { competitions: true } } } });
  if (!existing) throw new AdminError('SPORT_NOT_FOUND', 'Sport not found', 404);
  if (existing._count.competitions > 0) {
    throw new AdminError('HAS_COMPETITIONS', 'Cannot delete sport with existing competitions. Deactivate instead.');
  }

  await prisma.sport.delete({ where: { id } });
  await redis.del('sports:list');
  await createAuditLog(adminId, 'DELETE_SPORT', 'sport', id, { name: existing.name });
  return { message: 'Sport deleted successfully' };
}

export async function createCompetition(input: CreateCompetitionInput, adminId: string) {
  const sport = await prisma.sport.findUnique({ where: { id: input.sportId } });
  if (!sport) throw new AdminError('SPORT_NOT_FOUND', 'Sport not found', 404);

  const competition = await prisma.competition.create({
    data: input,
    include: { sport: { select: { name: true, slug: true } } },
  });
  await redis.del('sports:list');
  await createAuditLog(adminId, 'CREATE_COMPETITION', 'competition', competition.id, { name: input.name });
  return competition;
}

export async function updateCompetition(id: string, input: UpdateCompetitionInput, adminId: string) {
  const existing = await prisma.competition.findUnique({ where: { id } });
  if (!existing) throw new AdminError('COMPETITION_NOT_FOUND', 'Competition not found', 404);

  const competition = await prisma.competition.update({
    where: { id },
    data: input,
    include: { sport: { select: { name: true, slug: true } } },
  });
  await redis.del('sports:list');
  await createAuditLog(adminId, 'UPDATE_COMPETITION', 'competition', id, input as Record<string, unknown>);
  return competition;
}

export async function deleteCompetition(id: string, adminId: string) {
  const existing = await prisma.competition.findUnique({ where: { id }, include: { _count: { select: { events: true } } } });
  if (!existing) throw new AdminError('COMPETITION_NOT_FOUND', 'Competition not found', 404);
  if (existing._count.events > 0) {
    throw new AdminError('HAS_EVENTS', 'Cannot delete competition with existing events. Deactivate instead.');
  }

  await prisma.competition.delete({ where: { id } });
  await redis.del('sports:list');
  await createAuditLog(adminId, 'DELETE_COMPETITION', 'competition', id, { name: existing.name });
  return { message: 'Competition deleted successfully' };
}

export async function listEvents(query: ListEventsQuery) {
  const { page, limit, sportId, competitionId, status, isLive, isFeatured, search, startDate, endDate, sortBy, sortDir, sortOrder: sortOrderDir } = query as any;

  const where: Prisma.EventWhereInput = {};
  if (competitionId) where.competitionId = competitionId;
  if (sportId) where.competition = { sportId };
  if (status) where.status = status.toUpperCase() as EventStatus;
  if (isLive !== undefined) where.isLive = isLive;
  if (isFeatured !== undefined) where.isFeatured = isFeatured;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { homeTeam: { contains: search, mode: 'insensitive' } },
      { awayTeam: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  // Determine sort order - use sortDir or sortOrder (alias), default to 'desc'
  const resolvedSortDir = sortDir || sortOrderDir || 'desc';
  // Build orderBy based on sortBy field
  const validSortFields: Record<string, string> = { startTime: 'startTime', name: 'name', status: 'status', createdAt: 'createdAt' };
  const resolvedSortField = validSortFields[sortBy as string] || 'startTime';
  const eventOrderBy: any = { [resolvedSortField]: resolvedSortDir };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: eventOrderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        competition: {
          select: { id: true, name: true, slug: true, sport: { select: { id: true, name: true, slug: true } } },
        },
        _count: { select: { markets: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    data: events.map((e) => {
      const scores = e.scores as any;
      return {
        id: e.id,
        name: e.name,
        homeTeam: e.homeTeam,
        awayTeam: e.awayTeam,
        startTime: e.startTime.toISOString(),
        status: e.status.toLowerCase(),
        scores: e.scores,
        homeScore: scores?.home ?? scores?.homeScore ?? 0,
        awayScore: scores?.away ?? scores?.awayScore ?? 0,
        isLive: e.isLive,
        isFeatured: e.isFeatured,
        sportName: e.competition?.sport?.name ?? '',
        competitionName: e.competition?.name ?? '',
        competition: e.competition,
        marketCount: e._count.markets,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createEvent(input: CreateEventInput, adminId: string) {
  const competition = await prisma.competition.findUnique({ where: { id: input.competitionId } });
  if (!competition) throw new AdminError('COMPETITION_NOT_FOUND', 'Competition not found', 404);

  const event = await prisma.event.create({
    data: {
      competitionId: input.competitionId,
      name: input.name,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      startTime: new Date(input.startTime),
      isFeatured: input.isFeatured,
      streamUrl: input.streamUrl,
      metadata: input.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
    },
    include: {
      competition: { select: { name: true, slug: true, sport: { select: { name: true, slug: true } } } },
    },
  });

  await invalidateEventCaches();
  await createAuditLog(adminId, 'CREATE_EVENT', 'event', event.id, { name: input.name });
  return event;
}

export async function updateEvent(id: string, input: UpdateEventInput, adminId: string) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new AdminError('EVENT_NOT_FOUND', 'Event not found', 404);

  const updateData: Prisma.EventUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.homeTeam !== undefined) updateData.homeTeam = input.homeTeam;
  if (input.awayTeam !== undefined) updateData.awayTeam = input.awayTeam;
  if (input.startTime !== undefined) updateData.startTime = new Date(input.startTime);
  if (input.status !== undefined) updateData.status = input.status as EventStatus;
  if (input.scores !== undefined) updateData.scores = input.scores as Prisma.InputJsonValue ?? Prisma.JsonNull;
  if (input.metadata !== undefined) updateData.metadata = input.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull;
  if (input.isFeatured !== undefined) updateData.isFeatured = input.isFeatured;
  if (input.isLive !== undefined) updateData.isLive = input.isLive;
  if (input.streamUrl !== undefined) updateData.streamUrl = input.streamUrl;

  const event = await prisma.event.update({
    where: { id },
    data: updateData,
    include: {
      competition: { select: { name: true, slug: true, sport: { select: { name: true, slug: true } } } },
    },
  });

  await invalidateEventCaches();
  await createAuditLog(adminId, 'UPDATE_EVENT', 'event', id, input as Record<string, unknown>);
  return event;
}

export async function deleteEvent(id: string, adminId: string) {
  const existing = await prisma.event.findUnique({ where: { id }, include: { _count: { select: { markets: true } } } });
  if (!existing) throw new AdminError('EVENT_NOT_FOUND', 'Event not found', 404);
  if (existing._count.markets > 0) {
    throw new AdminError('HAS_MARKETS', 'Cannot delete event with existing markets');
  }

  await prisma.event.delete({ where: { id } });
  await invalidateEventCaches();
  await createAuditLog(adminId, 'DELETE_EVENT', 'event', id, { name: existing.name });
  return { message: 'Event deleted successfully' };
}

export async function createMarket(input: CreateMarketInput, adminId: string) {
  const event = await prisma.event.findUnique({ where: { id: input.eventId } });
  if (!event) throw new AdminError('EVENT_NOT_FOUND', 'Event not found', 404);

  const market = await prisma.market.create({
    data: input,
    include: { event: { select: { name: true } }, selections: true },
  });

  await createAuditLog(adminId, 'CREATE_MARKET', 'market', market.id, { name: input.name, eventId: input.eventId });
  return market;
}

export async function updateMarket(id: string, input: UpdateMarketInput, adminId: string) {
  const existing = await prisma.market.findUnique({ where: { id } });
  if (!existing) throw new AdminError('MARKET_NOT_FOUND', 'Market not found', 404);

  const updateData: Prisma.MarketUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.marketKey !== undefined) updateData.marketKey = input.marketKey;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.status !== undefined) updateData.status = input.status as MarketStatus;
  if (input.period !== undefined) updateData.period = input.period;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

  const market = await prisma.market.update({
    where: { id },
    data: updateData,
    include: { event: { select: { name: true } }, selections: true },
  });

  await createAuditLog(adminId, 'UPDATE_MARKET', 'market', id, input as Record<string, unknown>);
  return market;
}

export async function createSelection(input: CreateSelectionInput, adminId: string) {
  const market = await prisma.market.findUnique({ where: { id: input.marketId } });
  if (!market) throw new AdminError('MARKET_NOT_FOUND', 'Market not found', 404);

  const selection = await prisma.selection.create({
    data: {
      marketId: input.marketId,
      name: input.name,
      outcome: input.outcome,
      odds: new Prisma.Decimal(input.odds),
      probability: input.probability != null ? new Prisma.Decimal(input.probability) : null,
      maxStake: input.maxStake != null ? new Prisma.Decimal(input.maxStake) : null,
      handicap: input.handicap != null ? new Prisma.Decimal(input.handicap) : null,
      params: input.params,
    },
    include: { market: { select: { name: true, eventId: true } } },
  });

  await createAuditLog(adminId, 'CREATE_SELECTION', 'selection', selection.id, { name: input.name });
  return selection;
}

export async function updateSelection(id: string, input: UpdateSelectionInput, adminId: string) {
  const existing = await prisma.selection.findUnique({ where: { id } });
  if (!existing) throw new AdminError('SELECTION_NOT_FOUND', 'Selection not found', 404);

  const updateData: Prisma.SelectionUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.outcome !== undefined) updateData.outcome = input.outcome;
  if (input.odds !== undefined) updateData.odds = new Prisma.Decimal(input.odds);
  if (input.probability !== undefined) updateData.probability = input.probability != null ? new Prisma.Decimal(input.probability) : null;
  if (input.maxStake !== undefined) updateData.maxStake = input.maxStake != null ? new Prisma.Decimal(input.maxStake) : null;
  if (input.handicap !== undefined) updateData.handicap = input.handicap != null ? new Prisma.Decimal(input.handicap) : null;
  if (input.params !== undefined) updateData.params = input.params;
  if (input.status !== undefined) updateData.status = input.status as SelectionStatus;

  const selection = await prisma.selection.update({
    where: { id },
    data: updateData,
    include: { market: { select: { name: true, eventId: true } } },
  });

  await createAuditLog(adminId, 'UPDATE_SELECTION', 'selection', id, input as Record<string, unknown>);
  return selection;
}

// =============================================================================
// ODDS MANAGEMENT
// =============================================================================

export async function syncOdds(input: SyncOddsInput, adminId: string) {
  const jobData: Record<string, unknown> = { triggeredBy: adminId };
  if (input.providerId) jobData.providerId = input.providerId;
  if (input.sportKey) jobData.sportKey = input.sportKey;

  const job = await oddsSyncQueue.add('manual-sync', jobData);

  await createAuditLog(adminId, 'SYNC_ODDS', 'odds', undefined, {
    providerId: input.providerId,
    sportKey: input.sportKey,
    jobId: job.id,
  });

  return { jobId: job.id, message: 'Odds sync job queued successfully' };
}

export async function listOddsProviders(query: ListOddsProvidersQuery) {
  const { page, limit, isActive } = query;

  const where: Prisma.OddsProviderWhereInput = {};
  if (isActive !== undefined) where.isActive = isActive;

  const [providers, total] = await Promise.all([
    prisma.oddsProvider.findMany({
      where,
      orderBy: { priority: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { syncLogs: true } },
      },
    }),
    prisma.oddsProvider.count({ where }),
  ]);

  // Frontend OddsProvider interface expects: id, name, type (THE_ODDS_API|GOALSERVE|CUSTOM),
  // apiKey, baseUrl, priority, syncInterval, active, lastSyncAt, createdAt
  return {
    data: providers.map((p) => {
      // Map provider name to frontend ProviderType
      const nameUpper = p.name.toUpperCase();
      let providerType: string = 'CUSTOM';
      if (nameUpper.includes('ODDS API') || nameUpper.includes('THE_ODDS')) providerType = 'THE_ODDS_API';
      else if (nameUpper.includes('GOALSERVE')) providerType = 'GOALSERVE';

      return {
        id: p.id,
        name: p.name,
        type: providerType,
        apiKey: p.apiKey ? p.apiKey.slice(0, 8) + '****' : '',
        baseUrl: p.apiUrl || '',
        priority: p.priority,
        syncInterval: (p as any).syncInterval ?? 60,
        active: p.isActive,
        lastSyncAt: p.lastSyncAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        // Keep original fields for backward compatibility
        slug: p.slug,
        isActive: p.isActive,
        syncLogCount: p._count.syncLogs,
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createOddsProvider(input: CreateOddsProviderInput, adminId: string) {
  // Map frontend type values to backend enum
  const typeMap: Record<string, string> = { THE_ODDS_API: 'REST', GOALSERVE: 'REST', CUSTOM: 'REST' };
  const dbType = (typeMap[input.type as string] || input.type || 'REST') as any;

  // Auto-generate slug from name if not provided
  const slug = (input as any).slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Check for duplicate name/slug
  const existingName = await prisma.oddsProvider.findUnique({ where: { name: input.name } });
  if (existingName) throw new AdminError('DUPLICATE_PROVIDER', `Odds provider with name "${input.name}" already exists`, 409);
  const existingSlug = await prisma.oddsProvider.findUnique({ where: { slug } });
  if (existingSlug) throw new AdminError('DUPLICATE_PROVIDER', `Odds provider with slug "${slug}" already exists`, 409);

  // Accept both apiUrl and baseUrl
  const apiUrl = input.apiUrl || (input as any).baseUrl || undefined;

  const provider = await prisma.oddsProvider.create({
    data: {
      name: input.name,
      slug,
      type: dbType,
      apiKey: input.apiKey,
      apiUrl,
      priority: input.priority,
      isActive: input.isActive,
      rateLimitPerMin: input.rateLimitPerMin,
      quotaLimit: input.quotaLimit,
      config: input.config as Prisma.InputJsonValue,
    },
  });

  await createAuditLog(adminId, 'CREATE_ODDS_PROVIDER', 'odds_provider', provider.id, { name: input.name });

  // Return in frontend-expected shape
  const nameUpper = provider.name.toUpperCase();
  let providerType: string = 'CUSTOM';
  if (nameUpper.includes('ODDS API') || nameUpper.includes('THE_ODDS')) providerType = 'THE_ODDS_API';
  else if (nameUpper.includes('GOALSERVE')) providerType = 'GOALSERVE';

  return {
    id: provider.id,
    name: provider.name,
    type: providerType,
    apiKey: provider.apiKey ? provider.apiKey.slice(0, 8) + '****' : '',
    baseUrl: provider.apiUrl || '',
    priority: provider.priority,
    syncInterval: (input as any).syncInterval ?? 60,
    active: provider.isActive,
    lastSyncAt: null,
    createdAt: provider.createdAt.toISOString(),
  };
}

export async function configureOddsProvider(id: string, input: ConfigureOddsProviderInput, adminId: string) {
  const existing = await prisma.oddsProvider.findUnique({ where: { id } });
  if (!existing) throw new AdminError('PROVIDER_NOT_FOUND', 'Odds provider not found', 404);

  // Check name uniqueness if changing name
  if (input.name !== undefined && input.name !== existing.name) {
    const nameConflict = await prisma.oddsProvider.findUnique({ where: { name: input.name } });
    if (nameConflict) throw new AdminError('DUPLICATE_PROVIDER', `Odds provider with name "${input.name}" already exists`, 409);
  }

  const updateData: Prisma.OddsProviderUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  // Map frontend type values to backend enum
  if (input.type !== undefined) {
    const typeMap: Record<string, string> = { THE_ODDS_API: 'REST', GOALSERVE: 'REST', CUSTOM: 'REST' };
    updateData.type = (typeMap[input.type] || input.type) as any;
  }
  if (input.apiKey !== undefined) updateData.apiKey = input.apiKey;
  // Accept both apiUrl and baseUrl (frontend sends baseUrl)
  if (input.apiUrl !== undefined) updateData.apiUrl = input.apiUrl;
  if ((input as any).baseUrl !== undefined) updateData.apiUrl = (input as any).baseUrl;
  if (input.priority !== undefined) updateData.priority = input.priority;
  // Accept both isActive and active (frontend sends active)
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if ((input as any).active !== undefined) updateData.isActive = (input as any).active;
  if (input.rateLimitPerMin !== undefined) updateData.rateLimitPerMin = input.rateLimitPerMin;
  if (input.quotaLimit !== undefined) updateData.quotaLimit = input.quotaLimit;
  if (input.config !== undefined) updateData.config = input.config as Prisma.InputJsonValue;

  const provider = await prisma.oddsProvider.update({ where: { id }, data: updateData });

  await createAuditLog(adminId, 'CONFIGURE_ODDS_PROVIDER', 'odds_provider', id, input as Record<string, unknown>);
  return provider;
}

// =============================================================================
// PROMOTIONS MANAGEMENT
// =============================================================================

export async function listPromotions(query: ListPromotionsQuery) {
  const { page, limit, type, isActive, search } = query;

  const where: Prisma.PromotionWhereInput = {};
  if (type) where.type = type as Prisma.EnumPromoTypeFilter['equals'];
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { claims: true } } },
    }),
    prisma.promotion.count({ where }),
  ]);

  return {
    data: promotions.map((p) => {
      const reward = (p.reward ?? {}) as Record<string, unknown>;
      const conditions = (p.conditions ?? {}) as Record<string, unknown>;
      const rewardValue = Number(reward.value ?? 0);
      const claimCount = p.claimCount ?? 0;

      // Extract a human-readable conditions string for the frontend
      const conditionsText = typeof conditions.description === 'string'
        ? conditions.description
        : (typeof p.conditions === 'string' ? p.conditions : '');

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type.toLowerCase(),
        code: p.code,
        image: p.image,
        conditions: conditionsText || conditions,
        reward,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        isActive: p.isActive,
        maxClaims: p.maxClaims,
        claimCount,
        totalClaims: p._count.claims,
        createdBy: p.createdBy,
        createdAt: p.createdAt.toISOString(),
        // Frontend-compatible aliases
        active: p.isActive,
        claims: claimCount,
        totalCost: claimCount * rewardValue,
        rewardType: reward.type === 'PERCENTAGE' ? 'percentage'
          : reward.type === 'FIXED' ? 'fixed'
          : String(reward.type ?? 'fixed').toLowerCase(),
        rewardValue,
        maxBonus: Number(reward.maxValue ?? conditions.maxBonus ?? 0) || undefined,
        wageringRequirement: Number(conditions.wageringRequirement ?? 0),
        ...getPromotionCtaFields(p.type),
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createPromotion(input: CreatePromotionInput, adminId: string) {
  // Normalize code: treat empty string as null
  const code = input.code?.trim() || null;
  if (code) {
    const existing = await prisma.promotion.findUnique({ where: { code } });
    if (existing) throw new AdminError('CODE_EXISTS', `Promo code "${code}" already exists`);
  }

  const promotion = await prisma.promotion.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      code,
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

  await redis.del('promotions:active');
  await createAuditLog(adminId, 'CREATE_PROMOTION', 'promotion', promotion.id, { title: input.title });
  return promotion;
}

export async function updatePromotion(id: string, input: UpdatePromotionInput, adminId: string) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new AdminError('PROMOTION_NOT_FOUND', 'Promotion not found', 404);

  const updateData: Prisma.PromotionUpdateInput = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.code !== undefined) updateData.code = input.code;
  if (input.image !== undefined) updateData.image = input.image;
  if (input.conditions !== undefined) updateData.conditions = input.conditions as Prisma.JsonObject;
  if (input.reward !== undefined) updateData.reward = input.reward as Prisma.JsonObject;
  if (input.startDate !== undefined) updateData.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) updateData.endDate = new Date(input.endDate);
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.maxClaims !== undefined) updateData.maxClaims = input.maxClaims;

  const promotion = await prisma.promotion.update({ where: { id }, data: updateData });

  await redis.del('promotions:active');
  await createAuditLog(adminId, 'UPDATE_PROMOTION', 'promotion', id, input as Record<string, unknown>);
  return promotion;
}

export async function deletePromotion(id: string, adminId: string) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new AdminError('PROMOTION_NOT_FOUND', 'Promotion not found', 404);

  // Soft delete by deactivating
  const promotion = await prisma.promotion.update({
    where: { id },
    data: { isActive: false },
  });

  await redis.del('promotions:active');
  await createAuditLog(adminId, 'DELETE_PROMOTION', 'promotion', id, { title: existing.title });
  return promotion;
}

// =============================================================================
// VIP MANAGEMENT
// =============================================================================

export async function listVipTiers() {
  const tiers = await prisma.vipTierConfig.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  return {
    tiers: tiers.map((t) => ({
      id: t.id,
      tier: t.tier,
      name: t.name,
      minWagered: t.minWagered.toString(),
      rakebackPercent: t.rakebackPercent.toString(),
      turboBoostPercent: t.turboBoostPercent.toString(),
      turboDurationMin: t.turboDurationMin,
      dailyBonusMax: t.dailyBonusMax.toString(),
      weeklyBonusMax: t.weeklyBonusMax?.toString() ?? null,
      monthlyBonusMax: t.monthlyBonusMax?.toString() ?? null,
      levelUpReward: t.levelUpReward.toString(),
      calendarSplitPercent: t.calendarSplitPercent.toString(),
      maxLevelUpReward: t.maxLevelUpReward?.toString() ?? null,
      sortOrder: t.sortOrder,
      benefits: t.benefits,
    })),
  };
}

export async function updateVipTier(id: string, input: UpdateVipTierInput, adminId: string) {
  const existing = await prisma.vipTierConfig.findUnique({ where: { id } });
  if (!existing) throw new AdminError('TIER_NOT_FOUND', 'VIP tier config not found', 404);

  const updateData: Prisma.VipTierConfigUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.minWagered !== undefined) updateData.minWagered = new Prisma.Decimal(input.minWagered);
  if (input.rakebackPercent !== undefined) updateData.rakebackPercent = new Prisma.Decimal(input.rakebackPercent);
  if (input.turboBoostPercent !== undefined) updateData.turboBoostPercent = new Prisma.Decimal(input.turboBoostPercent);
  if (input.turboDurationMin !== undefined) updateData.turboDurationMin = input.turboDurationMin;
  if (input.dailyBonusMax !== undefined) updateData.dailyBonusMax = new Prisma.Decimal(input.dailyBonusMax);
  if (input.weeklyBonusMax !== undefined) updateData.weeklyBonusMax = input.weeklyBonusMax != null ? new Prisma.Decimal(input.weeklyBonusMax) : null;
  if (input.monthlyBonusMax !== undefined) updateData.monthlyBonusMax = input.monthlyBonusMax != null ? new Prisma.Decimal(input.monthlyBonusMax) : null;
  if (input.levelUpReward !== undefined) updateData.levelUpReward = new Prisma.Decimal(input.levelUpReward);
  if (input.calendarSplitPercent !== undefined) updateData.calendarSplitPercent = new Prisma.Decimal(input.calendarSplitPercent);
  if (input.maxLevelUpReward !== undefined) updateData.maxLevelUpReward = input.maxLevelUpReward != null ? new Prisma.Decimal(input.maxLevelUpReward) : null;
  if (input.benefits !== undefined) updateData.benefits = input.benefits as Prisma.InputJsonValue;

  const tier = await prisma.vipTierConfig.update({ where: { id }, data: updateData });

  await redis.del('vip:tiers');
  await createAuditLog(adminId, 'UPDATE_VIP_TIER', 'vip_tier_config', id, {
    tier: existing.tier,
    changes: input as Record<string, unknown>,
  });

  return tier;
}

export async function assignVipTier(input: AssignVipTierInput, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new AdminError('USER_NOT_FOUND', 'User not found', 404);

  const previousTier = user.vipTier;

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { vipTier: input.tier },
    select: { id: true, username: true, email: true, vipTier: true },
  });

  await createAuditLog(adminId, 'ASSIGN_VIP_TIER', 'user', input.userId, {
    previousTier,
    newTier: input.tier,
    reason: input.reason,
  });

  return { user: updated, previousTier, newTier: input.tier };
}

// =============================================================================
// CONTENT MANAGEMENT
// =============================================================================

// --- Blog Posts ---

export async function listBlogPosts(query: ListBlogPostsQuery) {
  const { page, limit, category, isPublished, search } = query;

  const where: Prisma.BlogPostWhereInput = {};
  if (category) where.category = category;
  if (isPublished !== undefined) where.isPublished = isPublished;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { author: { select: { id: true, username: true } } },
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      featuredImage: p.featuredImage,
      category: p.category,
      tags: p.tags,
      isPublished: p.isPublished,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      views: p.views,
      author: p.author,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createBlogPost(input: CreateBlogPostInput, adminId: string) {
  const post = await prisma.blogPost.create({
    data: {
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      featuredImage: input.featuredImage,
      category: input.category,
      tags: input.tags,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? new Date() : null,
      authorId: adminId,
    },
  });

  await createAuditLog(adminId, 'CREATE_BLOG_POST', 'blog_post', post.id, { title: input.title });
  return post;
}

export async function updateBlogPost(id: string, input: UpdateBlogPostInput, adminId: string) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new AdminError('POST_NOT_FOUND', 'Blog post not found', 404);

  const updateData: Prisma.BlogPostUpdateInput = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.excerpt !== undefined) updateData.excerpt = input.excerpt;
  if (input.featuredImage !== undefined) updateData.featuredImage = input.featuredImage;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.isPublished !== undefined) {
    updateData.isPublished = input.isPublished;
    if (input.isPublished && !existing.isPublished) {
      updateData.publishedAt = new Date();
    }
  }

  const post = await prisma.blogPost.update({ where: { id }, data: updateData });

  await createAuditLog(adminId, 'UPDATE_BLOG_POST', 'blog_post', id, input as Record<string, unknown>);
  return post;
}

export async function deleteBlogPost(id: string, adminId: string) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new AdminError('POST_NOT_FOUND', 'Blog post not found', 404);

  await prisma.blogPost.delete({ where: { id } });
  await createAuditLog(adminId, 'DELETE_BLOG_POST', 'blog_post', id, { title: existing.title });
  return { message: 'Blog post deleted successfully' };
}

// --- Help Articles ---

export async function listHelpArticles(query: ListHelpArticlesQuery) {
  const { page, limit, category, isPublished, search } = query;

  const where: Prisma.HelpArticleWhereInput = {};
  if (category) where.category = category;
  if (isPublished !== undefined) where.isPublished = isPublished;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [articles, total] = await Promise.all([
    prisma.helpArticle.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.helpArticle.count({ where }),
  ]);

  return {
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category,
      tags: a.tags,
      sortOrder: a.sortOrder,
      isPublished: a.isPublished,
      author: 'Admin',
      helpfulYes: a.helpfulYes,
      helpfulNo: a.helpfulNo,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createHelpArticle(input: CreateHelpArticleInput, adminId: string) {
  const article = await prisma.helpArticle.create({ data: input });
  await createAuditLog(adminId, 'CREATE_HELP_ARTICLE', 'help_article', article.id, { title: input.title });
  return article;
}

export async function updateHelpArticle(id: string, input: UpdateHelpArticleInput, adminId: string) {
  const existing = await prisma.helpArticle.findUnique({ where: { id } });
  if (!existing) throw new AdminError('ARTICLE_NOT_FOUND', 'Help article not found', 404);

  const article = await prisma.helpArticle.update({ where: { id }, data: input });
  await createAuditLog(adminId, 'UPDATE_HELP_ARTICLE', 'help_article', id, input as Record<string, unknown>);
  return article;
}

export async function deleteHelpArticle(id: string, adminId: string) {
  const existing = await prisma.helpArticle.findUnique({ where: { id } });
  if (!existing) throw new AdminError('ARTICLE_NOT_FOUND', 'Help article not found', 404);

  await prisma.helpArticle.delete({ where: { id } });
  await createAuditLog(adminId, 'DELETE_HELP_ARTICLE', 'help_article', id, { title: existing.title });
  return { message: 'Help article deleted successfully' };
}

// --- Academy Courses ---

export async function listCourses(query: ListCoursesQuery) {
  const { page, limit, category, difficulty, isPublished, search } = query;

  const where: Prisma.AcademyCourseWhereInput = {};
  if (category) where.category = category;
  if (difficulty) where.difficulty = difficulty;
  if (isPublished !== undefined) where.isPublished = isPublished;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [courses, total] = await Promise.all([
    prisma.academyCourse.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { lessons: true } } },
    }),
    prisma.academyCourse.count({ where }),
  ]);

  return {
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      thumbnail: c.thumbnail,
      category: c.category,
      difficulty: c.difficulty,
      lessonCount: c._count.lessons,
      lessonsCount: c._count.lessons,
      isPublished: c.isPublished,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createCourse(input: CreateCourseInput, adminId: string) {
  const course = await prisma.academyCourse.create({ data: input });
  await createAuditLog(adminId, 'CREATE_COURSE', 'academy_course', course.id, { title: input.title });
  return course;
}

export async function updateCourse(id: string, input: UpdateCourseInput, adminId: string) {
  const existing = await prisma.academyCourse.findUnique({ where: { id } });
  if (!existing) throw new AdminError('COURSE_NOT_FOUND', 'Course not found', 404);

  const course = await prisma.academyCourse.update({ where: { id }, data: input });
  await createAuditLog(adminId, 'UPDATE_COURSE', 'academy_course', id, input as Record<string, unknown>);
  return course;
}

export async function deleteCourse(id: string, adminId: string) {
  const existing = await prisma.academyCourse.findUnique({
    where: { id },
    include: { _count: { select: { lessons: true } } },
  });
  if (!existing) throw new AdminError('COURSE_NOT_FOUND', 'Course not found', 404);

  // Cascade delete lessons
  await prisma.$transaction([
    prisma.academyLesson.deleteMany({ where: { courseId: id } }),
    prisma.academyCourse.delete({ where: { id } }),
  ]);

  await createAuditLog(adminId, 'DELETE_COURSE', 'academy_course', id, { title: existing.title });
  return { message: 'Course deleted successfully' };
}

export async function createLesson(input: CreateLessonInput, adminId: string) {
  const course = await prisma.academyCourse.findUnique({ where: { id: input.courseId } });
  if (!course) throw new AdminError('COURSE_NOT_FOUND', 'Course not found', 404);

  const lesson = await prisma.academyLesson.create({ data: input });

  // Update lesson count
  await prisma.academyCourse.update({
    where: { id: input.courseId },
    data: { lessonCount: { increment: 1 } },
  });

  await createAuditLog(adminId, 'CREATE_LESSON', 'academy_lesson', lesson.id, { title: input.title, courseId: input.courseId });
  return lesson;
}

export async function updateLesson(id: string, input: UpdateLessonInput, adminId: string) {
  const existing = await prisma.academyLesson.findUnique({ where: { id } });
  if (!existing) throw new AdminError('LESSON_NOT_FOUND', 'Lesson not found', 404);

  const lesson = await prisma.academyLesson.update({ where: { id }, data: input });
  await createAuditLog(adminId, 'UPDATE_LESSON', 'academy_lesson', id, input as Record<string, unknown>);
  return lesson;
}

export async function deleteLesson(id: string, adminId: string) {
  const existing = await prisma.academyLesson.findUnique({ where: { id } });
  if (!existing) throw new AdminError('LESSON_NOT_FOUND', 'Lesson not found', 404);

  await prisma.academyLesson.delete({ where: { id } });

  // Update lesson count
  await prisma.academyCourse.update({
    where: { id: existing.courseId },
    data: { lessonCount: { decrement: 1 } },
  });

  await createAuditLog(adminId, 'DELETE_LESSON', 'academy_lesson', id, { title: existing.title });
  return { message: 'Lesson deleted successfully' };
}

// =============================================================================
// SITE SETTINGS
// =============================================================================

export async function getSiteConfigs() {
  return prisma.siteConfig.findMany({ orderBy: { key: 'asc' } });
}

export async function updateSiteConfig(input: UpdateSiteConfigInput, adminId: string) {
  const config = await prisma.siteConfig.upsert({
    where: { key: input.key },
    update: {
      value: input.value as Prisma.InputJsonValue,
      description: input.description,
      updatedBy: adminId,
    },
    create: {
      key: input.key,
      value: input.value as Prisma.InputJsonValue,
      description: input.description,
      updatedBy: adminId,
    },
  });

  await redis.del(`site:config:${input.key}`);
  await createAuditLog(adminId, 'UPDATE_SITE_CONFIG', 'site_config', config.id, { key: input.key });
  return config;
}

export async function getGeoRestrictions() {
  return prisma.geoRestriction.findMany({
    orderBy: { countryName: 'asc' },
  });
}

export async function addGeoRestriction(input: AddGeoRestrictionInput, adminId: string) {
  const existing = await prisma.geoRestriction.findUnique({ where: { countryCode: input.countryCode } });

  if (existing) {
    if (existing.isBlocked) {
      throw new AdminError('ALREADY_BLOCKED', `${input.countryName} is already blocked`);
    }
    const updated = await prisma.geoRestriction.update({
      where: { countryCode: input.countryCode },
      data: { isBlocked: true, reason: input.reason },
    });
    await createAuditLog(adminId, 'ADD_GEO_RESTRICTION', 'geo_restriction', updated.id, input as Record<string, unknown>);
    return updated;
  }

  const restriction = await prisma.geoRestriction.create({
    data: { countryCode: input.countryCode, countryName: input.countryName, isBlocked: true, reason: input.reason },
  });

  await redis.del('geo:restrictions');
  await createAuditLog(adminId, 'ADD_GEO_RESTRICTION', 'geo_restriction', restriction.id, input as Record<string, unknown>);
  return restriction;
}

export async function removeGeoRestriction(id: string, adminId: string) {
  const existing = await prisma.geoRestriction.findUnique({ where: { id } });
  if (!existing) throw new AdminError('NOT_FOUND', 'Geo restriction not found', 404);

  await prisma.geoRestriction.delete({ where: { id } });
  await redis.del('geo:restrictions');
  await createAuditLog(adminId, 'REMOVE_GEO_RESTRICTION', 'geo_restriction', id, { countryCode: existing.countryCode });
  return { message: 'Geo restriction removed' };
}

export async function setMaintenanceMode(input: MaintenanceModeInput, adminId: string) {
  const config = await prisma.siteConfig.upsert({
    where: { key: 'maintenance_mode' },
    update: {
      value: {
        enabled: input.enabled,
        message: input.message ?? 'We are currently performing scheduled maintenance. Please check back soon.',
        allowedIps: input.allowedIps ?? [],
        estimatedEndTime: input.estimatedEndTime ?? null,
      } as unknown as Prisma.InputJsonValue,
      updatedBy: adminId,
    },
    create: {
      key: 'maintenance_mode',
      value: {
        enabled: input.enabled,
        message: input.message ?? 'We are currently performing scheduled maintenance. Please check back soon.',
        allowedIps: input.allowedIps ?? [],
        estimatedEndTime: input.estimatedEndTime ?? null,
      } as unknown as Prisma.InputJsonValue,
      description: 'Maintenance mode configuration',
      updatedBy: adminId,
    },
  });

  await redis.del('site:config:maintenance_mode');
  await createAuditLog(adminId, 'SET_MAINTENANCE_MODE', 'site_config', config.id, {
    enabled: input.enabled,
  });

  return config;
}

// =============================================================================
// REPORTS
// =============================================================================

export async function getRevenueReport(query: RevenueReportQuery) {
  const { startDate, endDate, groupBy, currency } = query;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const betWhere: Prisma.BetWhereInput = {
    createdAt: { gte: start, lte: end },
    status: { in: ['WON', 'LOST', 'VOID', 'CASHOUT'] },
  };
  if (currency) betWhere.currencySymbol = currency;

  const bets = await prisma.bet.findMany({
    where: betWhere,
    select: { stake: true, actualWin: true, currencySymbol: true, status: true, createdAt: true },
  });

  const deposits = await prisma.transaction.findMany({
    where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: start, lte: end } },
    select: { amount: true, createdAt: true },
  });

  const withdrawals = await prisma.transaction.findMany({
    where: { type: 'WITHDRAWAL', status: 'COMPLETED', createdAt: { gte: start, lte: end } },
    select: { amount: true, createdAt: true },
  });

  // Aggregate totals
  let totalStaked = 0;
  let totalWinnings = 0;
  let totalBetsCount = 0;
  let wonBetsCount = 0;
  let lostBetsCount = 0;

  for (const bet of bets) {
    totalStaked += Number(bet.stake);
    totalWinnings += bet.actualWin ? Number(bet.actualWin) : 0;
    totalBetsCount++;
    if (bet.status === 'WON') wonBetsCount++;
    if (bet.status === 'LOST') lostBetsCount++;
  }

  const totalDeposited = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
  const grossProfit = totalStaked - totalWinnings;
  const netRevenue = totalDeposited - totalWithdrawn;

  // Group data by period
  const getKey = (date: Date): string => {
    if (groupBy === 'month') return date.toISOString().slice(0, 7);
    if (groupBy === 'week') {
      const d = new Date(date);
      d.setDate(d.getDate() - d.getDay());
      return d.toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  };

  const grouped = new Map<string, { staked: number; winnings: number; profit: number; bets: number }>();

  for (const bet of bets) {
    const key = getKey(bet.createdAt);
    const entry = grouped.get(key) ?? { staked: 0, winnings: 0, profit: 0, bets: 0 };
    entry.staked += Number(bet.stake);
    entry.winnings += bet.actualWin ? Number(bet.actualWin) : 0;
    entry.profit += Number(bet.stake) - (bet.actualWin ? Number(bet.actualWin) : 0);
    entry.bets += 1;
    grouped.set(key, entry);
  }

  return {
    summary: {
      totalStaked: totalStaked.toFixed(2),
      totalWinnings: totalWinnings.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      totalDeposited: totalDeposited.toFixed(2),
      totalWithdrawn: totalWithdrawn.toFixed(2),
      netRevenue: netRevenue.toFixed(2),
      totalBets: totalBetsCount,
      wonBets: wonBetsCount,
      lostBets: lostBetsCount,
      houseEdge: totalStaked > 0 ? ((grossProfit / totalStaked) * 100).toFixed(2) : '0.00',
    },
    breakdown: Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({
        period,
        staked: data.staked.toFixed(2),
        winnings: data.winnings.toFixed(2),
        profit: data.profit.toFixed(2),
        bets: data.bets,
      })),
    period: { start: start.toISOString(), end: end.toISOString(), groupBy },
  };
}

export async function getGameReport(query: GameReportQuery) {
  const { page, limit, gameSlug, gameType, startDate, endDate } = query;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const where: Prisma.CasinoRoundWhereInput = {
    createdAt: { gte: start, lte: end },
  };
  if (gameSlug) where.gameSlug = gameSlug;

  const rounds = await prisma.casinoRound.groupBy({
    by: ['gameSlug'],
    where,
    _count: { id: true },
    _sum: { betAmount: true, payout: true },
    _avg: { multiplier: true },
  });

  // Get game details for slugs
  const slugs = rounds.map((r) => r.gameSlug);
  const games = await prisma.casinoGame.findMany({
    where: {
      slug: { in: slugs },
      ...(gameType ? { type: gameType as Prisma.EnumGameTypeFilter['equals'] } : {}),
    },
    select: { slug: true, name: true, type: true, houseEdge: true, rtp: true },
  });
  const gameMap = new Map(games.map((g) => [g.slug, g]));

  let results = rounds
    .filter((r) => !gameType || gameMap.has(r.gameSlug))
    .map((r) => {
      const game = gameMap.get(r.gameSlug);
      const totalBet = Number(r._sum.betAmount ?? 0);
      const totalPayout = Number(r._sum.payout ?? 0);
      return {
        gameSlug: r.gameSlug,
        gameName: game?.name ?? r.gameSlug,
        gameType: game?.type ?? 'UNKNOWN',
        totalRounds: r._count.id,
        totalBet: totalBet.toFixed(2),
        totalPayout: totalPayout.toFixed(2),
        profit: (totalBet - totalPayout).toFixed(2),
        avgMultiplier: r._avg.multiplier?.toString() ?? '0',
        houseEdge: game?.houseEdge?.toString() ?? null,
        rtp: game?.rtp?.toString() ?? null,
        actualRtp: totalBet > 0 ? ((totalPayout / totalBet) * 100).toFixed(2) : '0',
      };
    })
    .sort((a, b) => Number(b.totalBet) - Number(a.totalBet));

  const total = results.length;
  results = results.slice((page - 1) * limit, page * limit);

  return {
    games: results,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    period: { start: start.toISOString(), end: end.toISOString() },
  };
}

export async function getUserActivityReport(query: UserActivityReportQuery) {
  const { page, limit, userId, startDate, endDate } = query;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const userWhere: Prisma.UserWhereInput = {};
  if (userId) userWhere.id = userId;

  const [topBettors, topDepositors, recentActivity] = await Promise.all([
    // Top bettors
    prisma.bet.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: start, lte: end } },
      _sum: { stake: true },
      _count: { id: true },
      orderBy: { _sum: { stake: 'desc' } },
      take: limit,
    }),
    // Top depositors
    prisma.transaction.findMany({
      where: { type: 'DEPOSIT', status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      select: { amount: true, wallet: { select: { userId: true } } },
    }),
    // Recent audit log activity
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    }),
  ]);

  // Resolve user info for top bettors
  const bettorIds = topBettors.map((b) => b.userId);
  const bettorUsers = await prisma.user.findMany({
    where: { id: { in: bettorIds } },
    select: { id: true, username: true, email: true, vipTier: true },
  });
  const bettorMap = new Map(bettorUsers.map((u) => [u.id, u]));

  // Aggregate deposits by user
  const depositMap = new Map<string, number>();
  for (const d of topDepositors) {
    const uid = d.wallet.userId;
    depositMap.set(uid, (depositMap.get(uid) ?? 0) + Number(d.amount));
  }

  return {
    topBettors: topBettors.map((b) => {
      const user = bettorMap.get(b.userId);
      return {
        userId: b.userId,
        username: user?.username ?? 'Unknown',
        email: user?.email ?? '',
        vipTier: user?.vipTier ?? 'BRONZE',
        totalStaked: b._sum.stake?.toString() ?? '0',
        betCount: b._count.id,
      };
    }),
    topDepositors: Array.from(depositMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([uid, amount]) => {
        const user = bettorMap.get(uid);
        return { userId: uid, username: user?.username ?? 'Unknown', totalDeposited: amount.toFixed(2) };
      }),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      resource: a.resource,
      resourceId: a.resourceId,
      details: a.details,
      user: a.user,
      createdAt: a.createdAt.toISOString(),
    })),
    period: { start: start.toISOString(), end: end.toISOString() },
  };
}

// =============================================================================
// AUDIT LOGS
// =============================================================================

export async function listAuditLogs(query: ListAuditLogsQuery) {
  const { page, limit, action, adminId, userId, resource, startDate, endDate } = query;

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (adminId) where.adminId = adminId;
  if (userId) where.userId = userId;
  if (resource) where.resource = resource;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, email: true } },
        admin: { select: { id: true, username: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      adminId: l.adminId,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      details: l.details,
      ipAddress: l.ipAddress,
      userAgent: l.userAgent,
      user: l.user,
      admin: l.admin,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// =============================================================================
// ALERTS
// =============================================================================

export async function listAlerts(query: ListAlertsQuery) {
  const { page, limit, severity, type, isResolved } = query;

  const where: Prisma.AdminAlertWhereInput = {};
  if (severity) where.severity = severity;
  if (type) where.type = type;
  if (isResolved !== undefined) where.isResolved = isResolved;

  const [alerts, total] = await Promise.all([
    prisma.adminAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        relatedUser: { select: { id: true, username: true, email: true } },
        relatedBet: { select: { id: true, referenceId: true, stake: true, status: true } },
      },
    }),
    prisma.adminAlert.count({ where }),
  ]);

  return {
    data: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      isResolved: a.isResolved,
      resolvedBy: a.resolvedBy,
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      relatedUser: a.relatedUser,
      relatedBet: a.relatedBet
        ? { ...a.relatedBet, stake: a.relatedBet.stake.toString() }
        : null,
      createdAt: a.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function resolveAlert(id: string, adminId: string) {
  const alert = await prisma.adminAlert.findUnique({ where: { id } });
  if (!alert) throw new AdminError('ALERT_NOT_FOUND', 'Alert not found', 404);
  if (alert.isResolved) throw new AdminError('ALREADY_RESOLVED', 'Alert is already resolved');

  const updated = await prisma.adminAlert.update({
    where: { id },
    data: { isResolved: true, resolvedBy: adminId, resolvedAt: new Date() },
  });

  await createAuditLog(adminId, 'RESOLVE_ALERT', 'admin_alert', id);
  return updated;
}

// =============================================================================
// Helpers
// =============================================================================

async function invalidateEventCaches() {
  const keys = await redis.keys('events:*');
  if (keys.length > 0) await redis.del(...keys);
  await redis.del('sports:list');
}
