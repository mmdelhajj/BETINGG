import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { config } from '../../config/index.js';
import type { JwtPayload } from '../../middleware/auth.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;
const FAILED_ATTEMPTS_KEY_PREFIX = 'auth:failed:';
const FAILED_ATTEMPTS_MAX = 5;
const FAILED_ATTEMPTS_LOCK_SECONDS = 15 * 60; // 15 minutes
const PASSWORD_RESET_PREFIX = 'auth:reset:';
const PASSWORD_RESET_TTL = 60 * 60; // 1 hour
const TEMP_TOKEN_SECRET = config.JWT_SECRET + ':2fa-temp';
const TEMP_TOKEN_EXPIRY = '5m';

/** The major currencies for which a wallet is auto-created upon registration. */
const DEFAULT_WALLET_CURRENCIES = [
  'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'DOGE', 'XRP', 'ADA', 'LTC',
  'DOT', 'MATIC', 'AVAX', 'TRX', 'LINK', 'TON', 'SHIB', 'BCH',
];

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface TokenUser {
  id: string;
  email: string;
  role: string;
  vipTier: string;
}

export function generateTokens(user: TokenUser): TokenPair {
  const accessPayload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    vipTier: user.vipTier,
  };

  const accessToken = jwt.sign(accessPayload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY },
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: config.JWT_ACCESS_EXPIRY,
  };
}

function generateTempToken(userId: string): string {
  return jwt.sign({ id: userId, type: '2fa-temp' }, TEMP_TOKEN_SECRET, {
    expiresIn: TEMP_TOKEN_EXPIRY,
  });
}

export function decodeTempToken(token: string): string {
  const decoded = jwt.verify(token, TEMP_TOKEN_SECRET) as {
    id: string;
    type: string;
  };
  if (decoded.type !== '2fa-temp') {
    throw new AuthError('INVALID_TEMP_TOKEN', 'Invalid temporary token', 401);
  }
  return decoded.id;
}

// ---------------------------------------------------------------------------
// Referral code generation
// ---------------------------------------------------------------------------

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput) {
  const { email, password, nickname, dateOfBirth, promoCode } = input;

  // Check for existing user
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username: nickname }],
    },
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new AuthError('EMAIL_EXISTS', 'An account with this email already exists', 409);
    }
    throw new AuthError('NICKNAME_EXISTS', 'This nickname is already taken', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Generate unique referral code with collision retry
  let referralCode = generateReferralCode();
  let codeExists = await prisma.user.findUnique({ where: { referralCode } });
  let retries = 0;
  while (codeExists && retries < 10) {
    referralCode = generateReferralCode();
    codeExists = await prisma.user.findUnique({ where: { referralCode } });
    retries++;
  }

  // Resolve referrer from promo code
  let referrerId: string | undefined;
  if (promoCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: promoCode },
      select: { id: true },
    });
    if (referrer) {
      referrerId = referrer.id;
    }
    // Silently ignore invalid promo codes
  }

  // Lookup currency IDs for default wallets
  const currencies = await prisma.currency.findMany({
    where: { symbol: { in: DEFAULT_WALLET_CURRENCIES }, isActive: true },
    select: { id: true, symbol: true },
  });

  // Create user + wallets + referral + welcome package in a single transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        username: nickname,
        passwordHash,
        dateOfBirth: new Date(dateOfBirth),
        referralCode,
        referredBy: referrerId ?? null,
      },
    });

    // Create wallets for each supported currency
    if (currencies.length > 0) {
      await tx.wallet.createMany({
        data: currencies.map((c) => ({
          userId: newUser.id,
          currencyId: c.id,
        })),
      });
    }

    // Track referral
    if (referrerId) {
      await tx.referral.create({
        data: {
          referrerId,
          referredId: newUser.id,
        },
      });
    }

    // Create welcome package (30 days)
    await tx.welcomePackage.create({
      data: {
        userId: newUser.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return newUser;
  });

  // Generate tokens
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
    vipTier: user.vipTier,
  });

  return {
    user: sanitizeUser(user),
    tokens,
  };
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export async function login(
  input: LoginInput,
  ip: string,
  userAgent: string,
) {
  const { email, password } = input;

  // Check rate-limit / lockout
  const lockKey = `${FAILED_ATTEMPTS_KEY_PREFIX}${email}`;
  const attempts = await redis.get(lockKey);
  if (attempts && parseInt(attempts, 10) >= FAILED_ATTEMPTS_MAX) {
    const ttl = await redis.ttl(lockKey);
    throw new AuthError(
      'ACCOUNT_LOCKED',
      `Account temporarily locked due to too many failed login attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      429,
    );
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    await incrementFailedAttempts(lockKey);
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Check banned
  if (user.isBanned) {
    throw new AuthError(
      'ACCOUNT_BANNED',
      `Your account has been suspended${user.banReason ? `: ${user.banReason}` : ''}`,
      403,
    );
  }

  // Check inactive
  if (!user.isActive) {
    throw new AuthError('ACCOUNT_INACTIVE', 'Your account is deactivated', 403);
  }

  // Check self-exclusion
  if (user.selfExcludedUntil && user.selfExcludedUntil > new Date()) {
    throw new AuthError(
      'SELF_EXCLUDED',
      `Your account is under self-exclusion until ${user.selfExcludedUntil.toISOString()}`,
      403,
    );
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    await incrementFailedAttempts(lockKey);
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Clear failed attempts on successful password match
  await redis.del(lockKey);

  // If 2FA is enabled, return a temporary token instead
  if (user.twoFactorEnabled) {
    const tempToken = generateTempToken(user.id);
    return {
      requiresTwoFactor: true,
      tempToken,
    };
  }

  // No 2FA - complete login
  return completeLogin(user, ip, userAgent);
}

// ---------------------------------------------------------------------------
// completeLogin (shared by login + 2FA verify)
// ---------------------------------------------------------------------------

export async function completeLogin(
  user: {
    id: string;
    email: string;
    role: string;
    vipTier: string;
    username: string;
    avatar: string | null;
    kycLevel: string;
    twoFactorEnabled: boolean;
    referralCode: string;
    createdAt: Date;
  },
  ip: string,
  userAgent: string,
) {
  const tokens = generateTokens({
    id: user.id,
    email: user.email,
    role: user.role,
    vipTier: user.vipTier,
  });

  // Compute refresh token expiry
  const refreshExpiryMs = parseExpiryToMs(config.JWT_REFRESH_EXPIRY);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  // Create session record
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      ipAddress: ip,
      userAgent,
      expiresAt,
    },
  });

  // Update last login info
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      resource: 'session',
      resourceId: session.id,
      ipAddress: ip,
      userAgent,
      details: { method: 'password' },
    },
  });

  // Fetch wallets to include balances in login response
  const wallets = await prisma.wallet.findMany({
    where: { userId: user.id },
    include: { currency: { select: { symbol: true } } },
  });

  const balances = wallets.map((w) => ({
    currency: w.currency.symbol,
    available: parseFloat(w.balance.minus(w.lockedBalance).toString()),
    locked: parseFloat(w.lockedBalance.toString()),
    total: parseFloat(w.balance.toString()),
  }));

  return {
    requiresTwoFactor: false,
    user: { ...sanitizeUser(user), balances },
    tokens,
    sessionId: session.id,
  };
}

// ---------------------------------------------------------------------------
// refreshToken
// ---------------------------------------------------------------------------

export async function refreshToken(token: string) {
  // Verify the refresh token signature
  let decoded: { id: string; type: string };
  try {
    decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as {
      id: string;
      type: string;
    };
  } catch {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
  }

  if (decoded.type !== 'refresh') {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid token type', 401);
  }

  // Find the session with this refresh token
  const session = await prisma.session.findUnique({
    where: { refreshToken: token },
    include: { user: true },
  });

  if (!session) {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Session not found', 401);
  }

  if (session.isRevoked) {
    // Potential token reuse attack - revoke all sessions for user
    await prisma.session.updateMany({
      where: { userId: session.userId },
      data: { isRevoked: true },
    });
    throw new AuthError(
      'TOKEN_REUSE_DETECTED',
      'Token reuse detected. All sessions have been invalidated for security.',
      401,
    );
  }

  if (session.expiresAt < new Date()) {
    throw new AuthError('SESSION_EXPIRED', 'Session has expired', 401);
  }

  // Revoke the old session
  await prisma.session.update({
    where: { id: session.id },
    data: { isRevoked: true },
  });

  // Generate new token pair
  const newTokens = generateTokens({
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    vipTier: session.user.vipTier,
  });

  const refreshExpiryMs = parseExpiryToMs(config.JWT_REFRESH_EXPIRY);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  // Create new session
  await prisma.session.create({
    data: {
      userId: session.userId,
      token: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt,
    },
  });

  return {
    tokens: newTokens,
    user: sanitizeUser(session.user),
  };
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export async function logout(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== userId) {
    throw new AuthError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  });

  return { message: 'Logged out successfully' };
}

// ---------------------------------------------------------------------------
// forgotPassword
// ---------------------------------------------------------------------------

export async function forgotPassword(email: string) {
  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const redisKey = `${PASSWORD_RESET_PREFIX}${resetToken}`;
    await redis.setex(redisKey, PASSWORD_RESET_TTL, user.id);

    // In production, send an email with the reset link here.
    // For development, log the token.
    if (config.NODE_ENV !== 'production') {
      console.log(
        `[Auth] Password reset token for ${email}: ${resetToken}`,
      );
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'FORGOT_PASSWORD',
        resource: 'user',
        resourceId: user.id,
        details: { email },
      },
    });
  }

  return {
    message:
      'If an account with that email exists, a password reset link has been sent.',
  };
}

// ---------------------------------------------------------------------------
// resetPassword
// ---------------------------------------------------------------------------

export async function resetPassword(token: string, newPassword: string) {
  const redisKey = `${PASSWORD_RESET_PREFIX}${token}`;
  const userId = await redis.get(redisKey);

  if (!userId) {
    throw new AuthError(
      'INVALID_RESET_TOKEN',
      'Invalid or expired password reset token',
      400,
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password and invalidate all sessions in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all active sessions
    await tx.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'RESET_PASSWORD',
        resource: 'user',
        resourceId: userId,
      },
    });
  });

  // Delete the reset token
  await redis.del(redisKey);

  return { message: 'Password reset successfully. Please log in with your new password.' };
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallets: {
        include: {
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
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    dateOfBirth: user.dateOfBirth,
    role: user.role,
    kycLevel: user.kycLevel,
    vipTier: user.vipTier,
    totalWagered: user.totalWagered.toString(),
    twoFactorEnabled: user.twoFactorEnabled,
    preferredCurrency: user.preferredCurrency,
    preferredOddsFormat: user.preferredOddsFormat,
    theme: user.theme,
    language: user.language,
    referralCode: user.referralCode,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    wallets: user.wallets.map((w) => ({
      id: w.id,
      currencySymbol: w.currency.symbol,
      currencyName: w.currency.name,
      currencyType: w.currency.type,
      currencyIcon: w.currency.icon,
      balance: w.balance.toString(),
      lockedBalance: w.lockedBalance.toString(),
      bonusBalance: w.bonusBalance.toString(),
      exchangeRateUsd: w.currency.exchangeRateUsd.toString(),
    })),
    balances: user.wallets.map((w) => ({
      currency: w.currency.symbol,
      available: parseFloat(w.balance.minus(w.lockedBalance).toString()),
      locked: parseFloat(w.lockedBalance.toString()),
      total: parseFloat(w.balance.toString()),
    })),
  };
}

// ---------------------------------------------------------------------------
// getSessions
// ---------------------------------------------------------------------------

export async function getSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return sessions;
}

// ---------------------------------------------------------------------------
// revokeSession
// ---------------------------------------------------------------------------

export async function revokeSession(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== userId) {
    throw new AuthError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  if (session.isRevoked) {
    throw new AuthError('SESSION_ALREADY_REVOKED', 'Session is already revoked', 400);
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { isRevoked: true },
  });

  return { message: 'Session revoked successfully' };
}

// ---------------------------------------------------------------------------
// OAuth user creation / lookup helper
// ---------------------------------------------------------------------------

export async function findOrCreateOAuthUser(params: {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  avatar?: string | null;
}) {
  const { provider, providerId, email, name, avatar } = params;
  const providerIdField = provider === 'google' ? 'googleId' : 'githubId';

  // Try to find by provider ID first
  let user = await prisma.user.findFirst({
    where: { [providerIdField]: providerId },
  });

  if (user) {
    return user;
  }

  // Try to find by email and link account
  user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Link provider to existing account
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        [providerIdField]: providerId,
        ...(avatar && !user.avatar ? { avatar } : {}),
      },
    });
    return user;
  }

  // Create new user
  const referralCode = generateReferralCode();

  // Generate a unique username from the name
  let baseUsername = name
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 15);
  if (baseUsername.length < 3) {
    baseUsername = 'user';
  }

  let username = baseUsername;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}${suffix}`;
    suffix++;
    if (suffix > 1000) {
      username = `${baseUsername}_${crypto.randomBytes(3).toString('hex')}`;
      break;
    }
  }

  // Random password for OAuth users (they authenticate via provider)
  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString('hex'),
    BCRYPT_ROUNDS,
  );

  const currencies = await prisma.currency.findMany({
    where: { symbol: { in: DEFAULT_WALLET_CURRENCIES }, isActive: true },
    select: { id: true },
  });

  const newUser = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        username,
        passwordHash,
        avatar: avatar ?? null,
        referralCode,
        [providerIdField]: providerId,
      },
    });

    if (currencies.length > 0) {
      await tx.wallet.createMany({
        data: currencies.map((c) => ({
          userId: created.id,
          currencyId: c.id,
        })),
      });
    }

    await tx.welcomePackage.create({
      data: {
        userId: created.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return created;
  });

  return newUser;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function incrementFailedAttempts(lockKey: string): Promise<void> {
  const current = await redis.incr(lockKey);
  if (current === 1) {
    await redis.expire(lockKey, FAILED_ATTEMPTS_LOCK_SECONDS);
  }
}

function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // default 7 days
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function sanitizeUser(user: {
  id: string;
  email: string;
  username: string;
  role: string;
  vipTier: string;
  avatar?: string | null;
  kycLevel?: string;
  twoFactorEnabled?: boolean;
  referralCode?: string;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    vipTier: user.vipTier,
    avatar: user.avatar ?? null,
    kycLevel: user.kycLevel ?? null,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    referralCode: user.referralCode ?? null,
    createdAt: user.createdAt ?? null,
  };
}
