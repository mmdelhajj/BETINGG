import { Prisma, type OddsProviderType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { getIO } from '../../lib/socket.js';
import { TheOddsApiProvider } from './oddsProviders/TheOddsApiProvider.js';
import type { BaseOddsProvider, NormalizedOdds } from './oddsProviders/BaseOddsProvider.js';
import type {
  CreateOddsProviderInput,
  UpdateOddsProviderInput,
  SyncLogsQuery,
} from './odds.schemas.js';

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const providerInstances = new Map<string, BaseOddsProvider>();

function getProviderInstance(provider: {
  id: string;
  slug: string;
  apiKey: string | null;
  apiUrl: string | null;
  quotaLimit: number | null;
}): BaseOddsProvider | null {
  if (providerInstances.has(provider.id)) {
    return providerInstances.get(provider.id)!;
  }

  if (!provider.apiKey) return null;

  let instance: BaseOddsProvider | null = null;

  switch (provider.slug) {
    case 'the-odds-api':
      instance = new TheOddsApiProvider({
        apiKey: provider.apiKey,
        apiUrl: provider.apiUrl ?? undefined,
        quotaLimit: provider.quotaLimit ?? 500,
      });
      break;
    default:
      return null;
  }

  if (instance) {
    providerInstances.set(provider.id, instance);
  }
  return instance;
}

// ---------------------------------------------------------------------------
// Cache TTLs
// ---------------------------------------------------------------------------

const LIVE_ODDS_TTL = 5; // 5 seconds for live events
const PREMATCH_ODDS_TTL = 30; // 30 seconds for pre-match events
const EVENT_ODDS_CACHE_PREFIX = 'odds:event:';

// ---------------------------------------------------------------------------
// Get Event Odds (cached)
// ---------------------------------------------------------------------------

/**
 * Get all markets and selections with current odds for an event.
 * First checks Redis cache, falls back to database.
 */
export async function getEventOdds(eventId: string) {
  // Try cache first
  const cacheKey = `${EVENT_ODDS_CACHE_PREFIX}${eventId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      isLive: true,
      status: true,
      markets: {
        where: { status: { in: ['OPEN', 'SUSPENDED'] } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          selections: {
            orderBy: [{ name: 'asc' }],
          },
        },
      },
    },
  });

  if (!event) return null;

  const result = {
    eventId: event.id,
    eventName: event.name,
    isLive: event.isLive,
    status: event.status,
    markets: event.markets.map((m) => ({
      id: m.id,
      name: m.name,
      marketKey: m.marketKey,
      type: m.type,
      period: m.period,
      status: m.status,
      selections: m.selections.map((s) => ({
        id: s.id,
        name: s.name,
        outcome: s.outcome,
        odds: s.odds.toString(),
        probability: s.probability?.toString() ?? null,
        handicap: s.handicap?.toString() ?? null,
        params: s.params,
        status: s.status,
      })),
    })),
  };

  // Cache with appropriate TTL
  const ttl = event.isLive ? LIVE_ODDS_TTL : PREMATCH_ODDS_TTL;
  await redis.set(cacheKey, JSON.stringify(result), 'EX', ttl);

  return result;
}

// ---------------------------------------------------------------------------
// Odds Conversion
// ---------------------------------------------------------------------------

/**
 * Convert decimal odds to various formats.
 */
export function convertOdds(
  decimalOdds: number,
  format: 'decimal' | 'fractional' | 'american',
): string {
  switch (format) {
    case 'decimal':
      return decimalOdds.toFixed(2);

    case 'fractional': {
      // Convert decimal to fractional (e.g., 2.5 -> 3/2)
      const profit = decimalOdds - 1;
      // Find a reasonable fraction
      const precision = 100;
      const numerator = Math.round(profit * precision);
      const denominator = precision;
      const gcd = greatestCommonDivisor(numerator, denominator);
      return `${numerator / gcd}/${denominator / gcd}`;
    }

    case 'american': {
      if (decimalOdds >= 2) {
        // Positive American odds
        const american = Math.round((decimalOdds - 1) * 100);
        return `+${american}`;
      } else {
        // Negative American odds
        const american = Math.round(-100 / (decimalOdds - 1));
        return `${american}`;
      }
    }

    default:
      return decimalOdds.toFixed(2);
  }
}

/**
 * Apply house margin to true odds.
 * marginOdds = trueOdds / (1 + margin/100)
 */
export function applyMargin(trueOdds: number, marginPercent: number): number {
  if (marginPercent <= 0) return trueOdds;
  const marginMultiplier = 1 + marginPercent / 100;
  const marginOdds = trueOdds / marginMultiplier;
  // Ensure odds are always > 1
  return Math.max(marginOdds, 1.01);
}

// ---------------------------------------------------------------------------
// Cache Odds
// ---------------------------------------------------------------------------

/**
 * Store odds in Redis with appropriate TTL.
 */
export async function cacheOdds(
  eventId: string,
  odds: unknown,
  isLive: boolean = false,
): Promise<void> {
  const cacheKey = `${EVENT_ODDS_CACHE_PREFIX}${eventId}`;
  const ttl = isLive ? LIVE_ODDS_TTL : PREMATCH_ODDS_TTL;
  await redis.set(cacheKey, JSON.stringify(odds), 'EX', ttl);
}

// ---------------------------------------------------------------------------
// Sync Odds from Providers
// ---------------------------------------------------------------------------

/**
 * Fetch odds from all active providers for a sport, normalize them,
 * apply margins, update database, cache, and broadcast via Socket.IO.
 */
export async function syncOdds(sportKey?: string): Promise<{
  eventsUpdated: number;
  marketsUpdated: number;
  providersUsed: string[];
}> {
  const providers = await prisma.oddsProvider.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  });

  if (providers.length === 0) {
    return { eventsUpdated: 0, marketsUpdated: 0, providersUsed: [] };
  }

  let totalEventsUpdated = 0;
  let totalMarketsUpdated = 0;
  const providersUsed: string[] = [];

  for (const provider of providers) {
    const instance = getProviderInstance(provider);
    if (!instance) continue;
    if (!instance.hasQuota()) continue;

    const startTime = Date.now();
    let syncStatus = 'SUCCESS';
    let syncError: string | null = null;
    let eventsCount = 0;
    let marketsCount = 0;

    try {
      // Use sportKey if provided, otherwise sync a default set
      const sportKeys = sportKey
        ? [sportKey]
        : ['americanfootball_nfl', 'basketball_nba', 'soccer_epl', 'icehockey_nhl', 'baseball_mlb'];

      for (const sk of sportKeys) {
        try {
          const oddsData = await instance.fetchOdds(sk);

          for (const eventOdds of oddsData) {
            const updated = await applyOddsToDatabase(eventOdds, sk);
            if (updated) {
              eventsCount++;
              marketsCount += eventOdds.markets.length;
            }
          }
        } catch (sportErr) {
          console.error(`[OddsSync] Error syncing sport ${sk} from ${provider.name}:`, sportErr);
        }
      }

      totalEventsUpdated += eventsCount;
      totalMarketsUpdated += marketsCount;
      providersUsed.push(provider.name);
    } catch (err) {
      syncStatus = 'FAILED';
      syncError = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[OddsSync] Provider ${provider.name} failed:`, err);
    }

    const duration = Date.now() - startTime;

    // Log sync attempt
    await prisma.oddsSyncLog.create({
      data: {
        providerId: provider.id,
        sportKey: sportKey ?? 'multi',
        eventsCount,
        marketsCount,
        status: syncStatus,
        error: syncError,
        duration,
      },
    });

    // Update provider last sync
    const quota = instance.getQuota();
    await prisma.oddsProvider.update({
      where: { id: provider.id },
      data: {
        lastSyncAt: new Date(),
        quotaUsed: quota.used,
      },
    });
  }

  return {
    eventsUpdated: totalEventsUpdated,
    marketsUpdated: totalMarketsUpdated,
    providersUsed,
  };
}

// ---------------------------------------------------------------------------
// Admin: CRUD for odds providers
// ---------------------------------------------------------------------------

export async function getProviders() {
  return prisma.oddsProvider.findMany({
    orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { syncLogs: true } },
    },
  });
}

export async function createProvider(data: CreateOddsProviderInput) {
  return prisma.oddsProvider.create({
    data: {
      ...data,
      type: data.type as OddsProviderType,
      config: data.config ?? Prisma.JsonNull,
    },
  });
}

export async function updateProvider(id: string, data: UpdateOddsProviderInput) {
  const updateData: Prisma.OddsProviderUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.type !== undefined) updateData.type = data.type as OddsProviderType;
  if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
  if (data.apiUrl !== undefined) updateData.apiUrl = data.apiUrl;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.rateLimitPerMin !== undefined) updateData.rateLimitPerMin = data.rateLimitPerMin;
  if (data.quotaLimit !== undefined) updateData.quotaLimit = data.quotaLimit;
  if (data.config !== undefined) updateData.config = data.config ?? Prisma.JsonNull;

  // Clear cached provider instance when config changes
  providerInstances.delete(id);

  return prisma.oddsProvider.update({ where: { id }, data: updateData });
}

export async function getSyncLogs(query: SyncLogsQuery) {
  const { page, limit, providerId, status } = query;

  const where: Prisma.OddsSyncLogWhereInput = {};
  if (providerId) where.providerId = providerId;
  if (status) where.status = status;

  const [logs, total] = await Promise.all([
    prisma.oddsSyncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        provider: { select: { name: true, slug: true } },
      },
    }),
    prisma.oddsSyncLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      providerName: l.provider.name,
      providerSlug: l.provider.slug,
      sportKey: l.sportKey,
      eventsCount: l.eventsCount,
      marketsCount: l.marketsCount,
      status: l.status,
      error: l.error,
      duration: l.duration,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ---------------------------------------------------------------------------
// Internal: Apply odds data to database
// ---------------------------------------------------------------------------

async function applyOddsToDatabase(
  oddsData: NormalizedOdds,
  sportKey: string,
): Promise<boolean> {
  // Try to find the event in our database by external metadata or by team names
  // For now, we match by checking existing events with similar names
  // In production, we'd store external IDs in event metadata

  // Attempt to find by metadata external ID
  const events = await prisma.event.findMany({
    where: {
      status: { in: ['UPCOMING', 'LIVE'] },
      metadata: {
        path: ['externalId'],
        equals: oddsData.eventExternalId,
      },
    },
    select: { id: true, isLive: true },
    take: 1,
  });

  let eventId: string | undefined;
  let isLive = false;

  if (events.length > 0) {
    eventId = events[0].id;
    isLive = events[0].isLive;
  } else {
    // No match found, skip
    return false;
  }

  // Default margin (configurable per sport in production)
  const marginPercent = 5;

  // Update each market
  for (const marketData of oddsData.markets) {
    // Find or create market
    const existingMarkets = await prisma.market.findMany({
      where: { eventId, marketKey: marketData.marketKey },
      take: 1,
    });

    let marketId: string;

    if (existingMarkets.length > 0) {
      marketId = existingMarkets[0].id;
    } else {
      const created = await prisma.market.create({
        data: {
          eventId,
          name: marketData.name,
          marketKey: marketData.marketKey,
          type: marketData.type,
        },
      });
      marketId = created.id;
    }

    // Update selections
    for (const selData of marketData.selections) {
      const marginOdds = applyMargin(selData.odds, marginPercent);
      const oddsDecimal = new Prisma.Decimal(marginOdds.toFixed(3));
      const probability = new Prisma.Decimal((1 / marginOdds).toFixed(8));

      const existingSelections = await prisma.selection.findMany({
        where: {
          marketId,
          outcome: selData.outcome,
          ...(selData.handicap !== undefined
            ? { handicap: new Prisma.Decimal(selData.handicap) }
            : {}),
        },
        take: 1,
      });

      if (existingSelections.length > 0) {
        const oldOdds = existingSelections[0].odds;
        if (!oldOdds.eq(oddsDecimal)) {
          await prisma.selection.update({
            where: { id: existingSelections[0].id },
            data: {
              odds: oddsDecimal,
              probability,
            },
          });

          // Broadcast odds change via Socket.IO for live events
          if (isLive) {
            broadcastOddsChange(eventId, marketId, existingSelections[0].id, {
              oldOdds: oldOdds.toString(),
              newOdds: oddsDecimal.toString(),
              selectionName: selData.name,
            });
          }
        }
      } else {
        await prisma.selection.create({
          data: {
            marketId,
            name: selData.name,
            outcome: selData.outcome,
            odds: oddsDecimal,
            probability,
            handicap: selData.handicap != null ? new Prisma.Decimal(selData.handicap) : null,
            params: selData.params,
          },
        });
      }
    }
  }

  // Invalidate odds cache
  await redis.del(`${EVENT_ODDS_CACHE_PREFIX}${eventId}`);

  return true;
}

// ---------------------------------------------------------------------------
// Socket.IO Broadcasting
// ---------------------------------------------------------------------------

function broadcastOddsChange(
  eventId: string,
  marketId: string,
  selectionId: string,
  data: { oldOdds: string; newOdds: string; selectionName: string },
) {
  try {
    const io = getIO();
    const liveNsp = io.of('/live');

    liveNsp.to(`event:${eventId}`).emit('odds:update', {
      eventId,
      marketId,
      selectionId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Socket.IO not initialized yet, skip broadcast
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function greatestCommonDivisor(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}
