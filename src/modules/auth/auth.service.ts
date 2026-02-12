import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../middleware/auth';
import { BCRYPT_ROUNDS, APP_NAME } from '../../config/constants';
import { AppError, ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { generateSecureToken } from '../../utils/crypto';
import { addNotificationJob } from '../../queues';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  referralCode?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  async register(input: RegisterInput, ip?: string): Promise<{ user: any; tokens: TokenPair }> {
    const { email, username, password, referralCode } = input;

    // Check for existing user
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username }] },
    });
    if (existing) {
      throw new ConflictError(
        existing.email === email.toLowerCase()
          ? 'Email already registered'
          : 'Username already taken'
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Handle referral
    let referredBy: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        passwordHash,
        referredBy,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        vipTier: true,
        kycLevel: true,
        referralCode: true,
        createdAt: true,
      },
    });

    // Create referral record
    if (referredBy) {
      await prisma.referral.create({
        data: { referrerId: referredBy, referredId: user.id },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'register',
        resource: 'user',
        resourceId: user.id,
        ipAddress: ip,
      },
    });

    return { user, tokens };
  }

  async login(input: LoginInput, ip?: string, userAgent?: string): Promise<{ user: any; tokens: TokenPair }> {
    const { email, password, twoFactorCode } = input;
    // Check login attempts
    const attemptsKey = `login_attempts:${email.toLowerCase()}`;
    const attempts = parseInt((await redis.get(attemptsKey)) || '0');
    if (attempts >= 10) {
      throw new AppError('ACCOUNT_LOCKED', 'Too many login attempts. Try again in 15 minutes.', 429);
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        isActive: true,
        isBanned: true,
        banReason: true,
        vipTier: true,
        kycLevel: true,
        selfExcludedUntil: true,
        coolingOffUntil: true,
        timeoutUntil: true,
        referralCode: true,
      },
    });

    if (!user) {
      await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, 900);
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive || user.isBanned) {
      throw new AppError('ACCOUNT_SUSPENDED', user.banReason || 'Account is suspended', 403);
    }

    // Check self-exclusion
    if (user.selfExcludedUntil && new Date() < user.selfExcludedUntil) {
      throw new AppError('SELF_EXCLUDED', 'Account is self-excluded', 403);
    }

    // Check cooling-off
    if (user.coolingOffUntil && new Date() < user.coolingOffUntil) {
      throw new AppError('COOLING_OFF', 'Account is in cooling-off period', 403);
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, 900);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check 2FA
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        throw new AppError('2FA_REQUIRED', 'Two-factor authentication code required', 403);
      }
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1,
      });
      if (!verified) {
        throw new UnauthorizedError('Invalid 2FA code');
      }
    }

    // Clear login attempts
    await redis.del(attemptsKey);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store session
    const sessionId = uuidv4();
    await redis.setex(
      `session:${user.id}:${sessionId}`,
      604800, // 7 days
      JSON.stringify({ userAgent, ip, createdAt: new Date().toISOString() })
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login',
        resource: 'user',
        resourceId: user.id,
        ipAddress: ip,
        userAgent,
      },
    });

    const { passwordHash: _, twoFactorSecret: __, ...safeUser } = user;
    return { user: safeUser, tokens };
  }

  async refreshToken(token: string): Promise<TokenPair> {
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    const payload = verifyRefreshToken(token);

    // Blacklist old refresh token
    await redis.setex(`blacklist:${token}`, 604800, '1');

    return this.generateTokens(payload.userId, payload.email, payload.role);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await redis.setex(`blacklist:${refreshToken}`, 604800, '1');
    }

    // Remove all sessions for user
    const sessionKeys = await redis.keys(`session:${userId}:*`);
    if (sessionKeys.length > 0) {
      await redis.del(...sessionKeys);
    }
  }

  async setup2FA(userId: string): Promise<{ secret: string; qrCode: string; otpauthUrl: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError('User not found');

    const secret = speakeasy.generateSecret({
      name: `${APP_NAME}:${user.email}`,
      issuer: APP_NAME,
      length: 32,
    });

    // Store temp secret (not yet confirmed)
    await redis.setex(`2fa_setup:${userId}`, 600, secret.base32);

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode,
      otpauthUrl: secret.otpauth_url!,
    };
  }

  async confirm2FA(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const tempSecret = await redis.get(`2fa_setup:${userId}`);
    if (!tempSecret) {
      throw new ValidationError('2FA setup expired. Please start again.');
    }

    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new ValidationError('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => generateSecureToken(4).toUpperCase());

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: tempSecret,
        twoFactorEnabled: true,
      },
    });

    // Store backup codes
    await redis.setex(
      `2fa_backup:${userId}`,
      0, // No expiry for backup codes - use PERSIST
      JSON.stringify(backupCodes)
    );
    await redis.persist(`2fa_backup:${userId}`);

    await redis.del(`2fa_setup:${userId}`);

    return { backupCodes };
  }

  async disable2FA(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new ValidationError('2FA is not enabled');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new ValidationError('Invalid verification code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
      },
    });

    await redis.del(`2fa_backup:${userId}`);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return; // Don't reveal whether email exists

    const token = generateSecureToken(32);
    await redis.setex(`password_reset:${token}`, 3600, user.id); // 1 hour

    // In production, send email with reset link
    await addNotificationJob({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Password Reset',
      message: `Your password reset token: ${token}`,
      channels: ['EMAIL'],
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await redis.get(`password_reset:${token}`);
    if (!userId) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await redis.del(`password_reset:${token}`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new ValidationError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async oauthLogin(
    provider: 'google' | 'github',
    profile: { id: string; email: string; name?: string; avatar?: string },
    ip?: string
  ): Promise<{ user: any; tokens: TokenPair; isNewUser: boolean }> {
    const providerField = provider === 'google' ? 'googleId' : 'githubId';

    // Check if user exists with this OAuth ID
    let user = await prisma.user.findFirst({
      where: { [providerField]: profile.id },
    });

    let isNewUser = false;

    if (!user) {
      // Check if email is already registered
      user = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });

      if (user) {
        // Link OAuth to existing account
        await prisma.user.update({
          where: { id: user.id },
          data: { [providerField]: profile.id },
        });
      } else {
        // Create new user
        const username = profile.name?.replace(/\s+/g, '_').toLowerCase() || `user_${generateSecureToken(4)}`;
        user = await prisma.user.create({
          data: {
            email: profile.email.toLowerCase(),
            username: await this.ensureUniqueUsername(username),
            passwordHash: await bcrypt.hash(generateSecureToken(32), BCRYPT_ROUNDS),
            [providerField]: profile.id,
            avatar: profile.avatar,
            lastLoginAt: new Date(),
            lastLoginIp: ip,
          },
        });
        isNewUser = true;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user, tokens, isNewUser };
  }

  async getActiveSessions(userId: string): Promise<Array<{ id: string; userAgent?: string; ip?: string; createdAt: string }>> {
    const keys = await redis.keys(`session:${userId}:*`);
    const sessions = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const sessionId = key.split(':').pop()!;
        sessions.push({ id: sessionId, ...JSON.parse(data) });
      }
    }

    return sessions;
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await redis.del(`session:${userId}:${sessionId}`);
  }

  private async generateTokens(userId: string, email: string, role: string): Promise<TokenPair> {
    const accessToken = generateAccessToken({ userId, email, role });
    const refreshToken = generateRefreshToken({ userId, email, role });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async ensureUniqueUsername(base: string): Promise<string> {
    let username = base;
    let counter = 1;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${base}${counter}`;
      counter++;
    }
    return username;
  }
}

export const authService = new AuthService();
