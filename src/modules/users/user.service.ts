import prisma from '../../lib/prisma';
import { NotFoundError, AppError, ForbiddenError, ValidationError } from '../../utils/errors';

export interface UpdateProfileInput {
  username?: string;
  avatar?: string;
  dateOfBirth?: string;
}

export interface UpdatePreferencesInput {
  preferredCurrency?: string;
  preferredOddsFormat?: string;
  theme?: string;
  language?: string;
}

export interface LimitInput {
  daily?: string;
  weekly?: string;
  monthly?: string;
}

const COOLING_OFF_DURATIONS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
};

const SELF_EXCLUSION_DURATIONS: Record<string, number | null> = {
  '6m': 6 * 30 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
  'permanent': null,
};

const USER_SELECT = {
  id: true, email: true, username: true, role: true, avatar: true, dateOfBirth: true,
  kycLevel: true, vipTier: true, totalWagered: true, twoFactorEnabled: true,
  preferredCurrency: true, preferredOddsFormat: true, theme: true, language: true,
  depositLimit: true, lossLimit: true, wagerLimit: true, sessionTimeLimit: true,
  selfExcludedUntil: true, coolingOffUntil: true, referralCode: true,
  lastLoginAt: true, createdAt: true,
} as const;

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    if (!user) throw new NotFoundError('User', userId);
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);

    if (input.username && input.username !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: input.username } });
      if (existing) throw new AppError('CONFLICT', 'Username already taken', 409);
    }

    const data: Record<string, unknown> = {};
    if (input.username !== undefined) data.username = input.username;
    if (input.avatar !== undefined) data.avatar = input.avatar;
    if (input.dateOfBirth !== undefined) data.dateOfBirth = new Date(input.dateOfBirth);

    const updated = await prisma.user.update({ where: { id: userId }, data, select: USER_SELECT });

    await prisma.auditLog.create({
      data: { userId, action: 'update_profile', resource: 'user', resourceId: userId, details: { fields: Object.keys(data) } },
    });

    return updated;
  }

  async updatePreferences(userId: string, input: UpdatePreferencesInput) {
    const data: Record<string, unknown> = {};
    if (input.preferredCurrency !== undefined) data.preferredCurrency = input.preferredCurrency;
    if (input.preferredOddsFormat !== undefined) data.preferredOddsFormat = input.preferredOddsFormat;
    if (input.theme !== undefined) data.theme = input.theme;
    if (input.language !== undefined) data.language = input.language;

    return prisma.user.update({ where: { id: userId }, data, select: USER_SELECT });
  }

  async setDepositLimit(userId: string, limits: LimitInput) {
    this.validateLimits(limits);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);
    const current = (user.depositLimit as Record<string, string> | null) || {};
    return prisma.user.update({
      where: { id: userId },
      data: { depositLimit: { ...current, ...limits } },
      select: { depositLimit: true },
    });
  }

  async setLossLimit(userId: string, limits: LimitInput) {
    this.validateLimits(limits);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);
    const current = (user.lossLimit as Record<string, string> | null) || {};
    return prisma.user.update({
      where: { id: userId },
      data: { lossLimit: { ...current, ...limits } },
      select: { lossLimit: true },
    });
  }

  async setWagerLimit(userId: string, limits: LimitInput) {
    this.validateLimits(limits);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);
    const current = (user.wagerLimit as Record<string, string> | null) || {};
    return prisma.user.update({
      where: { id: userId },
      data: { wagerLimit: { ...current, ...limits } },
      select: { wagerLimit: true },
    });
  }

  async setSessionTimeLimit(userId: string, minutes: number) {
    if (minutes < 1 || minutes > 1440) throw new ValidationError('Session time limit must be between 1 and 1440 minutes');
    return prisma.user.update({
      where: { id: userId },
      data: { sessionTimeLimit: minutes },
      select: { sessionTimeLimit: true },
    });
  }

  async requestCoolingOff(userId: string, period: string) {
    const duration = COOLING_OFF_DURATIONS[period];
    if (!duration) throw new ValidationError('Invalid cooling-off period');
    const coolingOffUntil = new Date(Date.now() + duration);
    await prisma.user.update({ where: { id: userId }, data: { coolingOffUntil } });
    await prisma.auditLog.create({
      data: { userId, action: 'cooling_off', resource: 'user', resourceId: userId, details: { period } },
    });
    return { coolingOffUntil: coolingOffUntil.toISOString() };
  }

  async requestSelfExclusion(userId: string, period: string) {
    const duration = SELF_EXCLUSION_DURATIONS[period];
    if (duration === undefined) throw new ValidationError('Invalid self-exclusion period');
    const selfExcludedUntil = duration === null
      ? new Date('2099-12-31T23:59:59.999Z')
      : new Date(Date.now() + duration);
    await prisma.user.update({ where: { id: userId }, data: { selfExcludedUntil, isActive: false } });
    await prisma.auditLog.create({
      data: { userId, action: 'self_exclusion', resource: 'user', resourceId: userId, details: { period, permanent: duration === null } },
    });
    return { selfExcludedUntil: selfExcludedUntil.toISOString() };
  }

  async getBettingHistory(userId: string, options: { page: number; limit: number; status?: string }) {
    const { page, limit, status } = options;
    const where: any = { userId };
    if (status) where.status = status;

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where,
        include: { legs: { include: { selection: { include: { market: { include: { event: { select: { id: true, name: true, startTime: true } } } } } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bet.count({ where }),
    ]);

    return { bets, meta: { page, total, hasMore: page * limit < total } };
  }

  async getCasinoHistory(userId: string, options: { page: number; limit: number }) {
    const { page, limit } = options;
    const [sessions, total] = await Promise.all([
      prisma.casinoSession.findMany({
        where: { userId },
        include: { game: { select: { id: true, name: true, slug: true, type: true, thumbnail: true } } },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.casinoSession.count({ where: { userId } }),
    ]);

    return { sessions, meta: { page, total, hasMore: page * limit < total } };
  }

  private validateLimits(limits: LimitInput) {
    const d = limits.daily ? parseFloat(limits.daily) : undefined;
    const w = limits.weekly ? parseFloat(limits.weekly) : undefined;
    const m = limits.monthly ? parseFloat(limits.monthly) : undefined;

    if (d !== undefined && (isNaN(d) || d <= 0)) throw new ValidationError('Daily limit must be positive');
    if (w !== undefined && (isNaN(w) || w <= 0)) throw new ValidationError('Weekly limit must be positive');
    if (m !== undefined && (isNaN(m) || m <= 0)) throw new ValidationError('Monthly limit must be positive');
    if (d !== undefined && w !== undefined && d > w) throw new ValidationError('Daily limit cannot exceed weekly');
    if (w !== undefined && m !== undefined && w > m) throw new ValidationError('Weekly limit cannot exceed monthly');
  }
}

export const userService = new UserService();
