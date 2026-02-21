import crypto from 'node:crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import {
  AuthError,
  decodeTempToken,
  completeLogin,
} from './auth.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TWO_FACTOR_TEMP_PREFIX = 'auth:2fa:temp:';
const TWO_FACTOR_TEMP_TTL = 10 * 60; // 10 minutes
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const APP_NAME = 'CryptoBet';

// ---------------------------------------------------------------------------
// setup - Generate secret and QR code for 2FA enrollment
// ---------------------------------------------------------------------------

export async function setup(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  if (user.twoFactorEnabled) {
    throw new AuthError(
      'TWO_FACTOR_ALREADY_ENABLED',
      'Two-factor authentication is already enabled on this account',
      400,
    );
  }

  // Generate TOTP secret
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME} (${user.email})`,
    issuer: APP_NAME,
    length: 20,
  });

  // Generate QR code as data URL
  const otpauthUrl = secret.otpauth_url ?? '';
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  // Store temp secret + backup codes in Redis until user verifies
  const tempData = JSON.stringify({
    secret: secret.base32,
    backupCodes,
  });
  await redis.setex(
    `${TWO_FACTOR_TEMP_PREFIX}${userId}`,
    TWO_FACTOR_TEMP_TTL,
    tempData,
  );

  return {
    secret: secret.base32,
    qrCode: qrCodeDataUrl,
    otpauthUrl,
    backupCodes,
  };
}

// ---------------------------------------------------------------------------
// verifySetup - Verify the 6-digit TOTP code during setup and persist 2FA
// ---------------------------------------------------------------------------

export async function verifySetup(userId: string, token: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  if (user.twoFactorEnabled) {
    throw new AuthError(
      'TWO_FACTOR_ALREADY_ENABLED',
      'Two-factor authentication is already enabled',
      400,
    );
  }

  // Retrieve temp data from Redis
  const redisKey = `${TWO_FACTOR_TEMP_PREFIX}${userId}`;
  const tempDataRaw = await redis.get(redisKey);

  if (!tempDataRaw) {
    throw new AuthError(
      'TWO_FACTOR_SETUP_EXPIRED',
      'Two-factor setup has expired. Please start the setup process again.',
      400,
    );
  }

  const tempData = JSON.parse(tempDataRaw) as {
    secret: string;
    backupCodes: string[];
  };

  // Verify the TOTP token against the temp secret
  const isValid = speakeasy.totp.verify({
    secret: tempData.secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step tolerance (30s)
  });

  if (!isValid) {
    throw new AuthError(
      'INVALID_TOTP_TOKEN',
      'Invalid verification code. Please try again.',
      400,
    );
  }

  // Hash backup codes before storing
  const hashedBackupCodes = await Promise.all(
    tempData.backupCodes.map(async (code) => ({
      hash: await bcrypt.hash(code, 10),
      used: false,
    })),
  );

  // Persist 2FA to user record
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: tempData.secret,
      twoFactorEnabled: true,
      backupCodes: hashedBackupCodes,
    },
  });

  // Clean up Redis temp data
  await redis.del(redisKey);

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'TWO_FACTOR_ENABLED',
      resource: 'user',
      resourceId: userId,
    },
  });

  return {
    message: 'Two-factor authentication has been enabled successfully.',
    backupCodes: tempData.backupCodes,
  };
}

// ---------------------------------------------------------------------------
// verify - Verify 2FA during login flow (after password OK, before session)
// ---------------------------------------------------------------------------

export async function verify(
  tempToken: string,
  token: string,
  ip: string,
  userAgent: string,
) {
  // Decode temp token to get userId
  const userId = decodeTempToken(tempToken);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AuthError(
      'TWO_FACTOR_NOT_ENABLED',
      'Two-factor authentication is not enabled for this account',
      400,
    );
  }

  // Try TOTP verification first (6-digit code)
  const isTotp = /^\d{6}$/.test(token);

  if (isTotp) {
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!isValid) {
      throw new AuthError(
        'INVALID_TOTP_TOKEN',
        'Invalid verification code',
        401,
      );
    }
  } else {
    // Try as a backup code
    const backupCodes = (user.backupCodes as Array<{ hash: string; used: boolean }>) ?? [];
    let backupCodeValid = false;
    let matchIndex = -1;

    for (let i = 0; i < backupCodes.length; i++) {
      const entry = backupCodes[i];
      if (entry.used) continue;
      const matches = await bcrypt.compare(token, entry.hash);
      if (matches) {
        backupCodeValid = true;
        matchIndex = i;
        break;
      }
    }

    if (!backupCodeValid || matchIndex === -1) {
      throw new AuthError(
        'INVALID_TOTP_TOKEN',
        'Invalid verification code or backup code',
        401,
      );
    }

    // Mark backup code as used
    backupCodes[matchIndex].used = true;
    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: backupCodes },
    });
  }

  // 2FA passed - complete login
  const result = await completeLogin(user, ip, userAgent);

  return result;
}

// ---------------------------------------------------------------------------
// disable - Disable 2FA (requires TOTP code + password)
// ---------------------------------------------------------------------------

export async function disable(
  userId: string,
  token: string,
  password: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AuthError(
      'TWO_FACTOR_NOT_ENABLED',
      'Two-factor authentication is not currently enabled',
      400,
    );
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthError('INVALID_PASSWORD', 'Incorrect password', 401);
  }

  // Verify TOTP
  const isValid = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (!isValid) {
    throw new AuthError(
      'INVALID_TOTP_TOKEN',
      'Invalid verification code',
      401,
    );
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: null,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'TWO_FACTOR_DISABLED',
      resource: 'user',
      resourceId: userId,
    },
  });

  return { message: 'Two-factor authentication has been disabled.' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto
      .randomBytes(Math.ceil(BACKUP_CODE_LENGTH / 2))
      .toString('hex')
      .slice(0, BACKUP_CODE_LENGTH)
      .toUpperCase();
    codes.push(code);
  }
  return codes;
}
