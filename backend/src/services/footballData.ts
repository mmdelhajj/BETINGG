// =============================================================================
// Football-Data.org Integration Service
// API Docs: https://docs.football-data.org/general/v4/index.html
// Free tier: 10 requests/minute, covers 12 competitions
// =============================================================================

import https from 'https';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { logger } from '../middleware/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.football-data.org/v4';
const API_KEY = '73d018cd6cd84aeabf7b06ee5588c654';
const RATE_LIMIT_DELAY_MS = 6500; // 6.5 seconds between requests (safe for 10/min)
const FOOTBALL_SPORT_SLUG = 'football';

// Competition codes available on the free tier
const FREE_TIER_COMPETITIONS = [
  'PL',   // Premier League
  'BL1',  // Bundesliga
  'PD',   // La Liga
  'SA',   // Serie A
  'FL1',  // Ligue 1
  'ELC',  // Championship
  'DED',  // Eredivisie
  'CL',   // Champions League
  'WC',   // World Cup
  'EC',   // European Championship
  'CLI',  // Copa Libertadores
  'BSA',  // Brazilian Serie A
];

// football-data.org match status → our EventStatus mapping
type FdStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED' | 'AWARDED' | 'LIVE';

function mapMatchStatus(fdStatus: FdStatus): { status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED' | 'POSTPONED'; isLive: boolean } {
  switch (fdStatus) {
    case 'SCHEDULED':
    case 'TIMED':
      return { status: 'UPCOMING', isLive: false };
    case 'IN_PLAY':
    case 'PAUSED':
    case 'LIVE':
      return { status: 'LIVE', isLive: true };
    case 'FINISHED':
    case 'AWARDED':
      return { status: 'ENDED', isLive: false };
    case 'POSTPONED':
      return { status: 'POSTPONED', isLive: false };
    case 'SUSPENDED':
    case 'CANCELLED':
      return { status: 'CANCELLED', isLive: false };
    default:
      return { status: 'UPCOMING', isLive: false };
  }
}

// ---------------------------------------------------------------------------
// HTTP Client with rate limiting
// ---------------------------------------------------------------------------

let lastRequestTime = 0;

async function rateLimitDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
}

interface ApiResponse<T> {
  status: number;
  data: T;
}

async function fetchApi<T>(endpoint: string): Promise<ApiResponse<T>> {
  await rateLimitDelay();

  return new Promise((resolve, reject) => {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const options = {
      headers: {
        'X-Auth-Token': API_KEY,
      },
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as T;
          resolve({ status: res.statusCode ?? 500, data: parsed });
        } catch {
          reject(new Error(`Failed to parse response from ${endpoint}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', (err: Error) => {
      reject(new Error(`Request failed for ${endpoint}: ${err.message}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Sync Status Tracking (in Redis)
// ---------------------------------------------------------------------------

export interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  lastSyncResult: string | null;
  competitionsSynced: number;
  matchesSynced: number;
  teamsSynced: number;
  errors: string[];
  startedAt: string | null;
  completedAt: string | null;
}

const SYNC_STATUS_KEY = 'football-data:sync-status';

async function getSyncStatusFromRedis(): Promise<SyncStatus> {
  const cached = await redis.get(SYNC_STATUS_KEY);
  if (cached) return JSON.parse(cached);
  return {
    isRunning: false,
    lastSyncAt: null,
    lastSyncResult: null,
    competitionsSynced: 0,
    matchesSynced: 0,
    teamsSynced: 0,
    errors: [],
    startedAt: null,
    completedAt: null,
  };
}

async function updateSyncStatus(update: Partial<SyncStatus>): Promise<void> {
  const current = await getSyncStatusFromRedis();
  const updated = { ...current, ...update };
  await redis.set(SYNC_STATUS_KEY, JSON.stringify(updated), 'EX', 86400); // 24hr TTL
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return getSyncStatusFromRedis();
}

// ---------------------------------------------------------------------------
// API Response Types (football-data.org v4)
// ---------------------------------------------------------------------------

interface FdArea {
  id: number;
  name: string;
  code: string;
  flag: string | null;
}

interface FdCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string | null;
  area: FdArea;
  currentSeason: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number | null;
  } | null;
}

interface FdTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
  address?: string;
  website?: string;
  founded?: number;
  clubColors?: string;
  venue?: string;
}

interface FdScore {
  winner: string | null;
  duration: string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: FdStatus;
  matchday: number | null;
  stage: string | null;
  group: string | null;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: FdScore;
  competition: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string | null;
  };
  area: FdArea;
  referees: unknown[];
}

interface FdCompetitionsResponse {
  count: number;
  competitions: FdCompetition[];
}

interface FdMatchesResponse {
  resultSet: { count: number; played: number; first: string; last: string };
  competition: FdCompetition;
  matches: FdMatch[];
}

interface FdTeamsResponse {
  count: number;
  competition: FdCompetition;
  season: unknown;
  teams: FdTeam[];
}

// ---------------------------------------------------------------------------
// Slugify Helper
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// ---------------------------------------------------------------------------
// Market Generation for New Events
// ---------------------------------------------------------------------------

/**
 * Generate realistic betting markets (1X2, Over/Under 2.5, BTTS) for a new event.
 * Skips if markets already exist for the event.
 */
async function generateMarketsForEvent(eventId: string): Promise<void> {
  // Check if markets already exist
  const existing = await prisma.market.count({ where: { eventId } });
  if (existing > 0) return;

  // Generate realistic odds with 5% margin
  function generateOdds(probabilities: number[]): number[] {
    const margin = 0.95;
    return probabilities.map(p => {
      const odds = Math.round((1 / (p / margin)) * 100) / 100;
      return Math.max(1.10, odds);
    });
  }

  // 1X2 Market
  const homePct = 0.25 + Math.random() * 0.30;
  const drawPct = 0.20 + Math.random() * 0.15;
  const awayPct = Math.max(0.10, 1 - homePct - drawPct);
  const [homeOdds, drawOdds, awayOdds] = generateOdds([homePct, drawPct, awayPct]);

  const m1 = await prisma.market.create({
    data: { eventId, name: 'Match Winner', marketKey: '1X2', type: 'MONEYLINE', status: 'OPEN', sortOrder: 1 },
  });
  await prisma.selection.createMany({
    data: [
      { marketId: m1.id, name: '1', outcome: 'HOME', odds: new Prisma.Decimal(homeOdds), status: 'ACTIVE' },
      { marketId: m1.id, name: 'X', outcome: 'DRAW', odds: new Prisma.Decimal(drawOdds), status: 'ACTIVE' },
      { marketId: m1.id, name: '2', outcome: 'AWAY', odds: new Prisma.Decimal(awayOdds), status: 'ACTIVE' },
    ],
  });

  // Over/Under 2.5
  const overPct = 0.45 + Math.random() * 0.15;
  const underPct = 1 - overPct;
  const [overOdds, underOdds] = generateOdds([overPct, underPct]);

  const m2 = await prisma.market.create({
    data: { eventId, name: 'Over/Under 2.5 Goals', marketKey: 'OU25', type: 'TOTAL', status: 'OPEN', sortOrder: 2 },
  });
  await prisma.selection.createMany({
    data: [
      { marketId: m2.id, name: 'Over 2.5', outcome: 'OVER', odds: new Prisma.Decimal(overOdds), status: 'ACTIVE' },
      { marketId: m2.id, name: 'Under 2.5', outcome: 'UNDER', odds: new Prisma.Decimal(underOdds), status: 'ACTIVE' },
    ],
  });

  // BTTS
  const yesPct = 0.45 + Math.random() * 0.15;
  const noPct = 1 - yesPct;
  const [yesOdds, noOdds] = generateOdds([yesPct, noPct]);

  const m3 = await prisma.market.create({
    data: { eventId, name: 'Both Teams to Score', marketKey: 'BTTS', type: 'TOTAL', status: 'OPEN', sortOrder: 3 },
  });
  await prisma.selection.createMany({
    data: [
      { marketId: m3.id, name: 'Yes', outcome: 'YES', odds: new Prisma.Decimal(yesOdds), status: 'ACTIVE' },
      { marketId: m3.id, name: 'No', outcome: 'NO', odds: new Prisma.Decimal(noOdds), status: 'ACTIVE' },
    ],
  });

  logger.info({ eventId }, 'Generated 3 betting markets for new event');
}

// ---------------------------------------------------------------------------
// Core Sync Functions
// ---------------------------------------------------------------------------

/**
 * Ensure the "Football" sport exists in our database.
 * Returns the sport ID.
 */
async function ensureFootballSport(): Promise<string> {
  let sport = await prisma.sport.findUnique({ where: { slug: FOOTBALL_SPORT_SLUG } });
  if (!sport) {
    sport = await prisma.sport.create({
      data: {
        name: 'Football',
        slug: FOOTBALL_SPORT_SLUG,
        icon: 'football',
        isActive: true,
        sortOrder: 1,
      },
    });
    logger.info({ sportId: sport.id }, 'Created Football sport');
  }
  return sport.id;
}

/**
 * Sync all available competitions from football-data.org.
 * Creates or updates Competition records linked to the Football sport.
 */
export async function syncCompetitions(): Promise<number> {
  const sportId = await ensureFootballSport();

  logger.info('Fetching competitions from football-data.org...');
  const response = await fetchApi<FdCompetitionsResponse>('/competitions');

  if (response.status !== 200) {
    throw new Error(`Failed to fetch competitions: HTTP ${response.status}`);
  }

  let synced = 0;

  for (const comp of response.data.competitions) {
    const slug = slugify(comp.code || comp.name);
    const externalId = comp.id.toString();

    try {
      // Try to find existing competition by externalId
      let existing = await prisma.competition.findFirst({
        where: { externalId },
      });

      if (existing) {
        // Update existing
        await prisma.competition.update({
          where: { id: existing.id },
          data: {
            name: comp.name,
            country: comp.area.name,
            logo: comp.emblem,
            isActive: true,
          },
        });
      } else {
        // Try to find by sportId + slug (may already exist from seed data)
        existing = await prisma.competition.findFirst({
          where: { sportId, slug },
        });

        if (existing) {
          await prisma.competition.update({
            where: { id: existing.id },
            data: {
              name: comp.name,
              country: comp.area.name,
              logo: comp.emblem,
              externalId,
              isActive: true,
            },
          });
        } else {
          await prisma.competition.create({
            data: {
              sportId,
              name: comp.name,
              slug,
              country: comp.area.name,
              logo: comp.emblem,
              externalId,
              isActive: true,
            },
          });
        }
      }

      synced++;
      logger.info({ competition: comp.name, code: comp.code }, 'Synced competition');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ competition: comp.name, error: msg }, 'Failed to sync competition');
    }
  }

  // Invalidate caches
  await redis.del('sports:list');
  const compKeys = await redis.keys('competitions:*');
  if (compKeys.length > 0) await redis.del(...compKeys);

  return synced;
}

/**
 * Sync matches for a specific competition code.
 * Fetches SCHEDULED, TIMED, IN_PLAY, PAUSED, and LIVE matches.
 * Creates or updates Event records.
 */
export async function syncMatches(competitionCode: string, statusFilter?: string): Promise<number> {
  // Find the competition in our DB
  const competition = await prisma.competition.findFirst({
    where: {
      OR: [
        { externalId: { not: null }, slug: slugify(competitionCode) },
        { externalId: competitionCode },
      ],
    },
  });

  // Better lookup: search by externalId based on what we stored
  const competitionByExtId = await prisma.competition.findFirst({
    where: { slug: slugify(competitionCode) },
  });

  const comp = competition || competitionByExtId;

  if (!comp) {
    logger.warn({ competitionCode }, 'Competition not found in database, skipping match sync');
    return 0;
  }

  // Build the query params
  const statuses = statusFilter || 'SCHEDULED,TIMED,IN_PLAY,PAUSED,LIVE,FINISHED';
  const endpoint = `/competitions/${competitionCode}/matches?status=${statuses}`;

  logger.info({ competitionCode, statuses }, 'Fetching matches from football-data.org...');
  const response = await fetchApi<FdMatchesResponse>(endpoint);

  if (response.status !== 200) {
    throw new Error(`Failed to fetch matches for ${competitionCode}: HTTP ${response.status}`);
  }

  let synced = 0;

  for (const match of response.data.matches) {
    const externalId = match.id.toString();
    const { status: eventStatus, isLive } = mapMatchStatus(match.status);

    // Handle null team names (TBD matches in tournaments like Champions League)
    const rawHomeName = match.homeTeam?.name || null;
    const rawAwayName = match.awayTeam?.name || null;

    // If BOTH teams are null/TBD, skip this match entirely — it's a placeholder
    if (!rawHomeName && !rawAwayName) {
      // If the event already exists in DB, delete it and its markets/selections
      const existingTbd = await prisma.event.findFirst({ where: { externalId } });
      if (existingTbd) {
        await prisma.selection.deleteMany({ where: { market: { eventId: existingTbd.id } } });
        await prisma.market.deleteMany({ where: { eventId: existingTbd.id } });
        await prisma.event.delete({ where: { id: existingTbd.id } });
        logger.info({ externalId }, 'Deleted TBD event (both teams null)');
      }
      continue;
    }

    // If only one team is null, use 'TBD' as placeholder
    const homeTeamName = rawHomeName || 'TBD';
    const awayTeamName = rawAwayName || 'TBD';

    // Build event name
    const homeName = match.homeTeam?.shortName || homeTeamName;
    const awayName = match.awayTeam?.shortName || awayTeamName;
    const eventName = `${homeName} vs ${awayName}`;

    // Build scores JSON
    const scoresObj: Record<string, number | null> = {};
    if (match.score.fullTime.home !== null) {
      scoresObj.home = match.score.fullTime.home;
      scoresObj.away = match.score.fullTime.away;
    }
    if (match.score.halfTime.home !== null) {
      scoresObj.halfTimeHome = match.score.halfTime.home;
      scoresObj.halfTimeAway = match.score.halfTime.away;
    }
    const scoresJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      Object.keys(scoresObj).length > 0 ? (scoresObj as Prisma.InputJsonValue) : Prisma.JsonNull;

    // Build metadata
    const metadataJson: Prisma.InputJsonValue = {
      externalId,
      matchday: match.matchday,
      stage: match.stage,
      group: match.group,
      area: match.area?.name || null,
      competitionCode: match.competition?.code || null,
      homeTeamId: match.homeTeam?.id || null,
      awayTeamId: match.awayTeam?.id || null,
    } as Prisma.InputJsonValue;

    try {
      // Find existing event by externalId
      const existing = await prisma.event.findFirst({
        where: { externalId },
      });

      if (existing) {
        // Update existing event
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            name: eventName,
            homeTeam: homeTeamName,
            awayTeam: awayTeamName,
            homeTeamLogo: match.homeTeam?.crest || null,
            awayTeamLogo: match.awayTeam?.crest || null,
            startTime: new Date(match.utcDate),
            status: eventStatus,
            isLive,
            scores: scoresJson,
            metadata: metadataJson,
          },
        });
      } else {
        // Only create events that are upcoming or live (skip old finished ones)
        if (eventStatus === 'UPCOMING' || eventStatus === 'LIVE') {
          const newEvent = await prisma.event.create({
            data: {
              externalId,
              competitionId: comp.id,
              name: eventName,
              homeTeam: homeTeamName,
              awayTeam: awayTeamName,
              homeTeamLogo: match.homeTeam?.crest || null,
              awayTeamLogo: match.awayTeam?.crest || null,
              startTime: new Date(match.utcDate),
              status: eventStatus,
              isLive,
              scores: scoresJson,
              metadata: metadataJson,
            },
          });

          // Generate betting markets for new event
          try {
            await generateMarketsForEvent(newEvent.id);
          } catch (marketErr) {
            const marketMsg = marketErr instanceof Error ? marketErr.message : String(marketErr);
            logger.error({ eventId: newEvent.id, error: marketMsg }, 'Failed to generate markets for new event');
          }
        }
      }

      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ match: eventName, externalId, error: msg }, 'Failed to sync match');
    }
  }

  // Invalidate event caches
  const eventKeys = await redis.keys('events:*');
  if (eventKeys.length > 0) await redis.del(...eventKeys);
  await redis.del('sports:list');

  return synced;
}

/**
 * Sync teams for a competition (updates crest/logo URLs on existing events).
 */
export async function syncTeams(competitionCode: string): Promise<number> {
  const endpoint = `/competitions/${competitionCode}/teams`;

  logger.info({ competitionCode }, 'Fetching teams from football-data.org...');
  const response = await fetchApi<FdTeamsResponse>(endpoint);

  if (response.status !== 200) {
    throw new Error(`Failed to fetch teams for ${competitionCode}: HTTP ${response.status}`);
  }

  let synced = 0;

  for (const team of response.data.teams) {
    // Update all events where this team is home or away with the crest
    const homeUpdated = await prisma.event.updateMany({
      where: {
        homeTeam: team.name,
        homeTeamLogo: null,
      },
      data: {
        homeTeamLogo: team.crest,
      },
    });

    const awayUpdated = await prisma.event.updateMany({
      where: {
        awayTeam: team.name,
        awayTeamLogo: null,
      },
      data: {
        awayTeamLogo: team.crest,
      },
    });

    if (homeUpdated.count > 0 || awayUpdated.count > 0) {
      synced++;
    }
  }

  return synced;
}

/**
 * Sync live scores for in-play matches across all competitions.
 * This should be called frequently (every 1 minute).
 */
export async function syncLiveScores(): Promise<number> {
  // Find all events currently marked as LIVE or that recently started
  const liveEvents = await prisma.event.findMany({
    where: {
      OR: [
        { status: 'LIVE', isLive: true },
        {
          status: 'UPCOMING',
          startTime: { lte: new Date() }, // matches that should have started
        },
      ],
      externalId: { not: null },
    },
    select: {
      id: true,
      externalId: true,
      competition: {
        select: { externalId: true, slug: true },
      },
    },
  });

  if (liveEvents.length === 0) {
    return 0;
  }

  // Group events by competition to minimize API calls
  const competitionCodes = new Set<string>();
  for (const event of liveEvents) {
    if (event.competition.slug) {
      competitionCodes.add(event.competition.slug.toUpperCase());
    }
  }

  let synced = 0;

  // For each competition with live events, fetch current match status
  for (const code of competitionCodes) {
    try {
      // Fetch IN_PLAY and PAUSED matches
      const matchesSynced = await syncMatches(code, 'IN_PLAY,PAUSED,LIVE,FINISHED');
      synced += matchesSynced;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ competitionCode: code, error: msg }, 'Failed to sync live scores');
    }
  }

  return synced;
}

// ---------------------------------------------------------------------------
// Full Sync Orchestrator
// ---------------------------------------------------------------------------

/**
 * Performs a complete sync:
 * 1. Syncs all competitions
 * 2. Syncs upcoming matches for each competition
 * 3. Syncs team data for crests
 *
 * Respects the 10 requests/minute rate limit.
 */
export async function fullSync(): Promise<{
  competitionsSynced: number;
  matchesSynced: number;
  teamsSynced: number;
  errors: string[];
}> {
  const status = await getSyncStatusFromRedis();
  if (status.isRunning) {
    throw new Error('A sync is already in progress');
  }

  await updateSyncStatus({
    isRunning: true,
    startedAt: new Date().toISOString(),
    errors: [],
    competitionsSynced: 0,
    matchesSynced: 0,
    teamsSynced: 0,
  });

  const errors: string[] = [];
  let competitionsSynced = 0;
  let matchesSynced = 0;
  let teamsSynced = 0;

  try {
    // Step 1: Sync competitions (1 API call)
    logger.info('=== Football-Data.org Full Sync Started ===');
    competitionsSynced = await syncCompetitions();
    await updateSyncStatus({ competitionsSynced });

    // Step 2: Sync upcoming matches for each competition
    // Each competition is 1 API call, so we need to respect the rate limit
    for (const code of FREE_TIER_COMPETITIONS) {
      try {
        const count = await syncMatches(code, 'SCHEDULED,TIMED,IN_PLAY,PAUSED,LIVE');
        matchesSynced += count;
        await updateSyncStatus({ matchesSynced });
        logger.info({ competitionCode: code, matchCount: count }, 'Synced matches for competition');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Matches sync failed for ${code}: ${msg}`);
        logger.error({ competitionCode: code, error: msg }, 'Failed to sync matches');
      }
    }

    // Step 3: Sync teams for competitions with upcoming events
    // Only sync teams for competitions that have events to minimize API calls
    const compsWithEvents = await prisma.competition.findMany({
      where: {
        externalId: { not: null },
        events: {
          some: {
            status: { in: ['UPCOMING', 'LIVE'] },
          },
        },
      },
      select: { slug: true },
    });

    for (const comp of compsWithEvents) {
      try {
        const compCode = comp.slug.toUpperCase();
        // Only sync teams for free tier competitions
        if (FREE_TIER_COMPETITIONS.includes(compCode)) {
          const count = await syncTeams(compCode);
          teamsSynced += count;
          await updateSyncStatus({ teamsSynced });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Teams sync failed for ${comp.slug}: ${msg}`);
        logger.error({ competition: comp.slug, error: msg }, 'Failed to sync teams');
      }
    }

    // Update Sport event count
    const sportId = await ensureFootballSport();
    const eventCount = await prisma.event.count({
      where: {
        status: { in: ['UPCOMING', 'LIVE'] },
        competition: { sportId },
      },
    });
    await prisma.sport.update({
      where: { id: sportId },
      data: { eventCount },
    });

    // Log the sync result
    const providerId = await ensureOddsProvider();
    await prisma.oddsSyncLog.create({
      data: {
        providerId,
        sportKey: 'football',
        eventsCount: matchesSynced,
        marketsCount: 0,
        status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        error: errors.length > 0 ? errors.join('; ') : null,
        duration: 0,
      },
    });

    logger.info(
      { competitionsSynced, matchesSynced, teamsSynced, errorCount: errors.length },
      '=== Football-Data.org Full Sync Completed ===',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Full sync failed: ${msg}`);
    logger.error({ error: msg }, 'Full sync failed');
  } finally {
    await updateSyncStatus({
      isRunning: false,
      lastSyncAt: new Date().toISOString(),
      lastSyncResult: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
      competitionsSynced,
      matchesSynced,
      teamsSynced,
      errors,
      completedAt: new Date().toISOString(),
    });
  }

  return { competitionsSynced, matchesSynced, teamsSynced, errors };
}

/**
 * Quick sync: Only syncs matches for competitions that already exist.
 * Used for the 30-minute auto-sync.
 */
export async function quickSync(): Promise<{ matchesSynced: number; errors: string[] }> {
  const errors: string[] = [];
  let matchesSynced = 0;

  for (const code of FREE_TIER_COMPETITIONS) {
    try {
      const count = await syncMatches(code, 'SCHEDULED,TIMED,IN_PLAY,PAUSED,LIVE');
      matchesSynced += count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${code}: ${msg}`);
    }
  }

  return { matchesSynced, errors };
}

// ---------------------------------------------------------------------------
// Auto-Sync Scheduler
// ---------------------------------------------------------------------------

let upcomingSyncInterval: ReturnType<typeof setInterval> | null = null;
let liveSyncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the auto-sync scheduler.
 * - Upcoming matches: every 30 minutes
 * - Live scores: every 1 minute
 */
export function startAutoSync(): void {
  // Stop any existing intervals
  stopAutoSync();

  logger.info('Starting football-data.org auto-sync scheduler');

  // Upcoming matches sync every 30 minutes
  upcomingSyncInterval = setInterval(async () => {
    try {
      logger.info('Auto-sync: Syncing upcoming matches...');
      const result = await quickSync();
      logger.info({ matchesSynced: result.matchesSynced, errors: result.errors.length }, 'Auto-sync: Upcoming matches synced');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Auto-sync: Failed to sync upcoming matches');
    }
  }, 30 * 60 * 1000); // 30 minutes

  // Live scores sync every 1 minute
  liveSyncInterval = setInterval(async () => {
    try {
      const count = await syncLiveScores();
      if (count > 0) {
        logger.info({ matchesUpdated: count }, 'Auto-sync: Live scores updated');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Auto-sync: Failed to sync live scores');
    }
  }, 60 * 1000); // 1 minute

  logger.info('Auto-sync scheduler started: upcoming matches every 30 min, live scores every 1 min');
}

/**
 * Stop the auto-sync scheduler.
 */
export function stopAutoSync(): void {
  if (upcomingSyncInterval) {
    clearInterval(upcomingSyncInterval);
    upcomingSyncInterval = null;
  }
  if (liveSyncInterval) {
    clearInterval(liveSyncInterval);
    liveSyncInterval = null;
  }
  logger.info('Auto-sync scheduler stopped');
}

/**
 * Check if auto-sync is currently running.
 */
export function isAutoSyncRunning(): boolean {
  return upcomingSyncInterval !== null || liveSyncInterval !== null;
}

// ---------------------------------------------------------------------------
// OddsProvider record for sync logs
// ---------------------------------------------------------------------------

async function ensureOddsProvider(): Promise<string> {
  let provider = await prisma.oddsProvider.findUnique({
    where: { slug: 'football-data-org' },
  });

  if (!provider) {
    provider = await prisma.oddsProvider.create({
      data: {
        name: 'Football-Data.org',
        slug: 'football-data-org',
        type: 'REST',
        apiKey: API_KEY,
        apiUrl: BASE_URL,
        priority: 2,
        isActive: true,
        rateLimitPerMin: 10,
        quotaLimit: 10,
        config: {
          freeTierCompetitions: FREE_TIER_COMPETITIONS,
        },
      },
    });
    logger.info({ providerId: provider.id }, 'Created Football-Data.org odds provider');
  }

  return provider.id;
}

// ---------------------------------------------------------------------------
// Store API Key in site_configs
// ---------------------------------------------------------------------------

export async function storeApiKeyConfig(): Promise<void> {
  await prisma.siteConfig.upsert({
    where: { key: 'football_data_api_key' },
    update: { value: API_KEY as unknown as Prisma.InputJsonValue },
    create: {
      key: 'football_data_api_key',
      value: API_KEY as unknown as Prisma.InputJsonValue,
      description: 'Football-Data.org API key for fetching real football/soccer data',
    },
  });
  logger.info('Stored football-data API key in site_configs');
}
