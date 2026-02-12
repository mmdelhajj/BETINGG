// ─── CryptoBet Cache Strategy ───────────────────────────
// Redis-based caching with TTL management, invalidation patterns, and warm-up

import { redis } from '../lib/redis';

interface CacheOptions {
  ttl: number;          // Time to live in seconds
  prefix?: string;      // Key prefix for namespace
  staleWhileRevalidate?: number; // Serve stale data while refreshing
}

// ─── Cache Decorator ────────────────────────────────────
export function cached<T>(keyFn: (...args: any[]) => string, opts: CacheOptions) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${opts.prefix || 'cache'}:${keyFn(...args)}`;

      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);

        // Check stale-while-revalidate
        if (opts.staleWhileRevalidate) {
          const ttl = await redis.ttl(cacheKey);
          if (ttl > 0 && ttl < opts.staleWhileRevalidate) {
            // Refresh in background
            original.apply(this, args).then((fresh: any) => {
              redis.setex(cacheKey, opts.ttl, JSON.stringify(fresh));
            }).catch(() => {});
          }
        }

        return data as T;
      }

      // Cache miss — execute and cache
      const result = await original.apply(this, args);
      if (result !== null && result !== undefined) {
        await redis.setex(cacheKey, opts.ttl, JSON.stringify(result));
      }
      return result;
    };
    return descriptor;
  };
}

// ─── Manual Cache Operations ────────────────────────────
export const cacheManager = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set(key: string, value: any, ttl: number): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  },

  async invalidate(pattern: string): Promise<number> {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return redis.del(...keys);
  },

  async invalidatePrefix(prefix: string): Promise<number> {
    return this.invalidate(`${prefix}:*`);
  },

  // Multi-key fetch (reduce round trips)
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const values = await redis.mget(...keys);
    return values.map(v => v ? JSON.parse(v) : null);
  },

  // Cache-aside with lock (prevent thundering herd)
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl: number): Promise<T> {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    // Acquire lock
    const lockKey = `lock:${key}`;
    const acquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');

    if (!acquired) {
      // Another process is fetching — wait and retry
      await new Promise(r => setTimeout(r, 100));
      const retried = await redis.get(key);
      if (retried) return JSON.parse(retried);
    }

    try {
      const result = await fetchFn();
      await redis.setex(key, ttl, JSON.stringify(result));
      return result;
    } finally {
      await redis.del(lockKey);
    }
  },
};

// ─── Cache TTL Constants ────────────────────────────────
export const CACHE_TTL = {
  SPORTS_LIST: 300,          // 5 min
  COMPETITION_LIST: 300,     // 5 min
  EVENT_LIST: 60,            // 1 min
  EVENT_DETAIL: 30,          // 30 sec
  ODDS: 5,                   // 5 sec (frequently changing)
  USER_PROFILE: 120,         // 2 min
  WALLET_BALANCE: 30,        // 30 sec
  VIP_STATUS: 300,           // 5 min
  VIP_TIERS: 3600,           // 1 hour
  EXCHANGE_RATES: 60,        // 1 min
  BLOG_POST: 300,            // 5 min
  HELP_ARTICLE: 600,         // 10 min
  LEADERBOARD: 60,           // 1 min
  CASINO_GAMES: 300,         // 5 min
  SITE_CONFIG: 300,          // 5 min
} as const;

// ─── Cache Warm-Up ──────────────────────────────────────
export async function warmUpCache() {
  const { prisma } = await import('../lib/prisma');

  // Pre-cache popular data
  const [sports, vipTiers] = await Promise.all([
    prisma.sport.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.vipTierConfig.findMany({ orderBy: { minWagered: 'asc' } }),
  ]);

  await Promise.all([
    redis.setex('cache:sports:all', CACHE_TTL.SPORTS_LIST, JSON.stringify(sports)),
    redis.setex('cache:vip:tiers', CACHE_TTL.VIP_TIERS, JSON.stringify(vipTiers)),
  ]);

  console.log(`Cache warm-up complete: ${sports.length} sports, ${vipTiers.length} VIP tiers`);
}

// ─── Database Query Optimization Helpers ────────────────
export const queryOptimizer = {
  // Batch user lookups (avoid N+1)
  async batchGetUsers(userIds: string[]) {
    const unique = [...new Set(userIds)];
    const { prisma } = await import('../lib/prisma');
    const users = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, username: true, email: true, vipTier: true },
    });
    const map = new Map(users.map(u => [u.id, u]));
    return userIds.map(id => map.get(id) || null);
  },

  // Cursor-based pagination (more efficient than offset)
  createCursorPagination<T extends { id: string }>(items: T[], limit: number) {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const cursor = data.length > 0 ? data[data.length - 1]!.id : null;
    return { data, hasMore, cursor };
  },
};
