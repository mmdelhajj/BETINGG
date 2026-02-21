import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeWindow = 'today' | 'week' | 'month' | 'all';

export interface TopEarnerEntry {
  rank: number;
  username: string;        // Anonymized: "Joh***" or "Use***123"
  totalWon: string;        // Decimal string
  totalBets: number;
  wonBets: number;
  winRate: number;         // Percentage (0-100), rounded to 1 decimal
  vipTier: string;
}

export interface TrendingBetEntry {
  id: string;
  username: string;        // Anonymized
  eventName: string;
  selection: string;
  odds: string;
  stake: string;
  winAmount: string;
  currency: string;
  isParlay: boolean;
  legCount: number;
  sport: string | null;
  sportSlug: string | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'pulse';
const TOP_EARNERS_TTL = 300;   // 5 minutes
const TRENDING_BETS_TTL = 120; // 2 minutes
const DEFAULT_TOP_EARNERS_LIMIT = 10;
const DEFAULT_TRENDING_LIMIT = 20;
const MAX_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Anonymize a username for public display.
 * Shows first 3 characters followed by "***".
 * Examples:
 *   "JohnSmith" -> "Joh***"
 *   "ab"        -> "ab***"
 *   "a"         -> "a***"
 *   ""          -> "Anonymous"
 */
function anonymizeUsername(username: string): string {
  if (!username || username.length === 0) {
    return 'Anonymous';
  }

  const visible = username.substring(0, Math.min(3, username.length));
  return `${visible}***`;
}

/**
 * Get the Date cutoff for a time window.
 */
function getWindowStart(window: TimeWindow): Date | null {
  const now = new Date();

  switch (window) {
    case 'today': {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    }
    case 'week': {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 7);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    }
    case 'month': {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 30);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    }
    case 'all':
      return null;
    default:
      return null;
  }
}

/**
 * Clamp limit to safe range.
 */
function clampLimit(limit: number | undefined, defaultLimit: number): number {
  const val = limit ?? defaultLimit;
  return Math.max(1, Math.min(val, MAX_LIMIT));
}

// ---------------------------------------------------------------------------
// getTopEarners
// ---------------------------------------------------------------------------

export async function getTopEarners(
  timeWindow: TimeWindow = 'today',
  limit?: number,
): Promise<TopEarnerEntry[]> {
  const safeLimit = clampLimit(limit, DEFAULT_TOP_EARNERS_LIMIT);
  const cacheKey = `${CACHE_PREFIX}:top-earners:${timeWindow}:${safeLimit}`;

  // Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as TopEarnerEntry[];
  }

  // Build the date filter
  const windowStart = getWindowStart(timeWindow);

  const dateFilter = windowStart
    ? Prisma.sql`AND b."settledAt" >= ${windowStart}`
    : Prisma.empty;

  // Query: aggregate winning bets grouped by userId
  // We need total bets count (WON + LOST for win rate) and sum of actualWin for WON bets
  const rows = await prisma.$queryRaw<
    Array<{
      userId: string;
      username: string;
      vipTier: string;
      totalWon: Prisma.Decimal;
      wonBets: bigint;
      totalBets: bigint;
    }>
  >(Prisma.sql`
    SELECT
      b."userId",
      u."username",
      u."vipTier",
      COALESCE(SUM(CASE WHEN b."status" = 'WON' THEN b."actualWin" ELSE 0 END), 0) AS "totalWon",
      COUNT(CASE WHEN b."status" = 'WON' THEN 1 END) AS "wonBets",
      COUNT(*) FILTER (WHERE b."status" IN ('WON', 'LOST')) AS "totalBets"
    FROM bets b
    INNER JOIN users u ON u."id" = b."userId"
    WHERE b."status" IN ('WON', 'LOST')
      ${dateFilter}
    GROUP BY b."userId", u."username", u."vipTier"
    HAVING COUNT(CASE WHEN b."status" = 'WON' THEN 1 END) > 0
    ORDER BY "totalWon" DESC
    LIMIT ${safeLimit}
  `);

  const result: TopEarnerEntry[] = rows.map((row, index) => {
    const wonBets = Number(row.wonBets);
    const totalBets = Number(row.totalBets);
    const winRate = totalBets > 0 ? Math.round((wonBets / totalBets) * 1000) / 10 : 0;

    return {
      rank: index + 1,
      username: anonymizeUsername(row.username),
      totalWon: new Prisma.Decimal(row.totalWon).toFixed(8),
      totalBets,
      wonBets,
      winRate,
      vipTier: row.vipTier,
    };
  });

  // Cache the result
  await redis.set(cacheKey, JSON.stringify(result), 'EX', TOP_EARNERS_TTL);

  return result;
}

// ---------------------------------------------------------------------------
// getTrendingBets
// ---------------------------------------------------------------------------

export async function getTrendingBets(
  sportSlug?: string,
  limit?: number,
): Promise<TrendingBetEntry[]> {
  const safeLimit = clampLimit(limit, DEFAULT_TRENDING_LIMIT);
  const cacheKey = `${CACHE_PREFIX}:trending:${sportSlug ?? 'all'}:${safeLimit}`;

  // Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as TrendingBetEntry[];
  }

  // Build the sport filter if provided
  // We join through BetLeg -> Selection -> Market -> Event -> Competition -> Sport
  const sportFilter = sportSlug
    ? Prisma.sql`AND sp."slug" = ${sportSlug}`
    : Prisma.empty;

  // Get recent winning bets with high odds or big payouts
  // Ordered by a "trending score" = actualWin * odds (rewards both big wins and long shots)
  const rows = await prisma.$queryRaw<
    Array<{
      betId: string;
      userId: string;
      username: string;
      eventName: string | null;
      selectionName: string | null;
      odds: Prisma.Decimal;
      stake: Prisma.Decimal;
      actualWin: Prisma.Decimal;
      currencySymbol: string;
      betType: string;
      legCount: bigint;
      sportName: string | null;
      sportSlug: string | null;
      createdAt: Date;
    }>
  >(Prisma.sql`
    SELECT
      b."id" AS "betId",
      b."userId",
      u."username",
      bl."eventName",
      bl."selectionName",
      b."odds",
      b."stake",
      b."actualWin",
      b."currencySymbol",
      b."type" AS "betType",
      (SELECT COUNT(*) FROM bet_legs bl2 WHERE bl2."betId" = b."id") AS "legCount",
      sp."name" AS "sportName",
      sp."slug" AS "sportSlug",
      b."createdAt"
    FROM bets b
    INNER JOIN users u ON u."id" = b."userId"
    LEFT JOIN LATERAL (
      SELECT bl1."eventName", bl1."selectionName", bl1."selectionId"
      FROM bet_legs bl1
      WHERE bl1."betId" = b."id"
      ORDER BY bl1."id"
      LIMIT 1
    ) bl ON TRUE
    LEFT JOIN selections sel ON sel."id" = bl."selectionId"
    LEFT JOIN markets m ON m."id" = sel."marketId"
    LEFT JOIN events e ON e."id" = m."eventId"
    LEFT JOIN competitions c ON c."id" = e."competitionId"
    LEFT JOIN sports sp ON sp."id" = c."sportId"
    WHERE b."status" = 'WON'
      AND b."actualWin" IS NOT NULL
      AND b."createdAt" >= NOW() - INTERVAL '7 days'
      ${sportFilter}
    ORDER BY (b."actualWin" * b."odds") DESC, b."createdAt" DESC
    LIMIT ${safeLimit}
  `);

  const result: TrendingBetEntry[] = rows.map((row) => {
    // For parlays, show the first leg selection name + leg count
    const selectionLabel = row.selectionName ?? 'Unknown Selection';
    const legCount = Number(row.legCount);

    return {
      id: row.betId,
      username: anonymizeUsername(row.username),
      eventName: row.eventName ?? 'Unknown Event',
      selection: legCount > 1 ? `${selectionLabel} +${legCount - 1} more` : selectionLabel,
      odds: new Prisma.Decimal(row.odds).toFixed(2),
      stake: new Prisma.Decimal(row.stake).toFixed(8),
      winAmount: new Prisma.Decimal(row.actualWin).toFixed(8),
      currency: row.currencySymbol,
      isParlay: row.betType === 'PARLAY',
      legCount,
      sport: row.sportName ?? null,
      sportSlug: row.sportSlug ?? null,
      timestamp: row.createdAt.toISOString(),
    };
  });

  // Cache the result
  await redis.set(cacheKey, JSON.stringify(result), 'EX', TRENDING_BETS_TTL);

  return result;
}
