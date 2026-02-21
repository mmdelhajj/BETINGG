import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { getTierConfig } from '../vip/vip.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TurboStatus {
  isActive: boolean;
  boostPercent: string;
  timeRemainingSeconds: number;
  endsAt: string | null;
  startedAt: string | null;
}

// ---------------------------------------------------------------------------
// Redis keys
// ---------------------------------------------------------------------------

function turboKey(userId: string): string {
  return `turbo:active:${userId}`;
}

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------

export async function getStatus(userId: string): Promise<TurboStatus> {
  // Check Redis cache first for performance
  const cached = await redis.get(turboKey(userId));
  if (cached) {
    const parsed = JSON.parse(cached) as { endsAt: string; boostPercent: string; startedAt: string };
    const endsAt = new Date(parsed.endsAt);
    const now = new Date();
    const remaining = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));

    if (remaining > 0) {
      return {
        isActive: true,
        boostPercent: parsed.boostPercent,
        timeRemainingSeconds: remaining,
        endsAt: parsed.endsAt,
        startedAt: parsed.startedAt,
      };
    }

    // Expired in cache — clean up
    await redis.del(turboKey(userId));
  }

  // Fallback to DB
  const session = await prisma.turboSession.findFirst({
    where: {
      userId,
      isActive: true,
      endsAt: { gt: new Date() },
    },
    orderBy: { endsAt: 'desc' },
  });

  if (!session) {
    return {
      isActive: false,
      boostPercent: '0',
      timeRemainingSeconds: 0,
      endsAt: null,
      startedAt: null,
    };
  }

  const remaining = Math.max(0, Math.floor((session.endsAt.getTime() - Date.now()) / 1000));

  // Repopulate cache
  const cacheData = {
    endsAt: session.endsAt.toISOString(),
    boostPercent: session.boostPercent.toString(),
    startedAt: session.startedAt.toISOString(),
  };
  await redis.set(turboKey(userId), JSON.stringify(cacheData), 'EX', remaining);

  return {
    isActive: true,
    boostPercent: session.boostPercent.toString(),
    timeRemainingSeconds: remaining,
    endsAt: session.endsAt.toISOString(),
    startedAt: session.startedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// activate
// ---------------------------------------------------------------------------

export async function activate(userId: string): Promise<TurboStatus> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { vipTier: true },
  });

  const tierConfig = await getTierConfig(user.vipTier);
  if (!tierConfig) {
    throw new Error('VIP tier configuration not found');
  }

  const boostPercent = new Prisma.Decimal(tierConfig.turboBoostPercent);
  const durationMin = tierConfig.turboDurationMin;

  // Bronze has 0 duration — cannot activate turbo
  if (durationMin <= 0 || boostPercent.lte(0)) {
    throw new Error('TURBO mode is not available for your current VIP tier. Upgrade to Silver or above.');
  }

  const now = new Date();

  // Check for existing active session
  const existing = await prisma.turboSession.findFirst({
    where: {
      userId,
      isActive: true,
      endsAt: { gt: now },
    },
    orderBy: { endsAt: 'desc' },
  });

  let session;

  if (existing) {
    // Extend the current session by the tier's duration
    const newEndsAt = new Date(existing.endsAt.getTime() + durationMin * 60 * 1000);

    session = await prisma.turboSession.update({
      where: { id: existing.id },
      data: {
        endsAt: newEndsAt,
        // If upgrading tiers mid-session, take the higher boost
        boostPercent: boostPercent.gt(existing.boostPercent) ? boostPercent : existing.boostPercent,
      },
    });
  } else {
    // Create new session
    const endsAt = new Date(now.getTime() + durationMin * 60 * 1000);

    session = await prisma.turboSession.create({
      data: {
        userId,
        boostPercent,
        startedAt: now,
        endsAt,
        isActive: true,
      },
    });
  }

  const remaining = Math.max(0, Math.floor((session.endsAt.getTime() - Date.now()) / 1000));

  // Update Redis cache
  const cacheData = {
    endsAt: session.endsAt.toISOString(),
    boostPercent: session.boostPercent.toString(),
    startedAt: session.startedAt.toISOString(),
  };
  await redis.set(turboKey(userId), JSON.stringify(cacheData), 'EX', remaining);

  return {
    isActive: true,
    boostPercent: session.boostPercent.toString(),
    timeRemainingSeconds: remaining,
    endsAt: session.endsAt.toISOString(),
    startedAt: session.startedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// isActive
// ---------------------------------------------------------------------------

export async function isActive(userId: string): Promise<boolean> {
  // Quick Redis check
  const cached = await redis.get(turboKey(userId));
  if (cached) {
    const parsed = JSON.parse(cached) as { endsAt: string };
    if (new Date(parsed.endsAt).getTime() > Date.now()) {
      return true;
    }
    await redis.del(turboKey(userId));
  }

  const session = await prisma.turboSession.findFirst({
    where: {
      userId,
      isActive: true,
      endsAt: { gt: new Date() },
    },
    select: { id: true },
  });

  return session !== null;
}

// ---------------------------------------------------------------------------
// getBoost - returns current boost multiplier (0 if not active)
// ---------------------------------------------------------------------------

export async function getBoost(userId: string): Promise<Prisma.Decimal> {
  const cached = await redis.get(turboKey(userId));
  if (cached) {
    const parsed = JSON.parse(cached) as { endsAt: string; boostPercent: string };
    if (new Date(parsed.endsAt).getTime() > Date.now()) {
      return new Prisma.Decimal(parsed.boostPercent);
    }
    await redis.del(turboKey(userId));
  }

  const session = await prisma.turboSession.findFirst({
    where: {
      userId,
      isActive: true,
      endsAt: { gt: new Date() },
    },
    orderBy: { endsAt: 'desc' },
    select: { boostPercent: true },
  });

  if (!session) {
    return new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(session.boostPercent);
}

// ---------------------------------------------------------------------------
// Cleanup: deactivate expired sessions (called periodically or on check)
// ---------------------------------------------------------------------------

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.turboSession.updateMany({
    where: {
      isActive: true,
      endsAt: { lte: new Date() },
    },
    data: { isActive: false },
  });

  return result.count;
}
