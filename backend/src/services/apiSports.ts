// =============================================================================
// API-Sports Integration Service
// Supports: Football, Basketball, Ice Hockey, Baseball, American Football,
//           Rugby, Handball, Volleyball, AFL, Formula 1, MMA, NBA
// API Docs: https://api-sports.io/documentation/
// Free tier: 100 requests/day PER sport API (each sport has separate quota)
// =============================================================================

import https from 'https';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { logger } from '../middleware/logger.js';
import { recalculateLiveOdds, recalculateAllLiveOdds } from './liveOddsEngine.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_KEY = '9d368daac7622f6ccb7840b120b8bae5';
const RATE_LIMIT_DELAY_MS = 1000; // 1 second between requests
const SYNC_DAYS = 3; // today + 2 more days

// ---------------------------------------------------------------------------
// Sport Configurations
// ---------------------------------------------------------------------------

interface SportConfig {
  name: string;
  slug: string;
  icon: string;
  sortOrder: number;
  apiHost: string;
  hasDraws: boolean;
  totalLine: number;
  totalLabel: string;
  isFootball?: boolean; // v3 football API has a different response format
  freeTierBlocked?: boolean;
}

const SPORT_CONFIGS: SportConfig[] = [
  {
    name: 'Football',
    slug: 'football',
    icon: 'football',
    sortOrder: 1,
    apiHost: 'v3.football.api-sports.io',
    hasDraws: true,
    totalLine: 2.5,
    totalLabel: 'Goals',
    isFootball: true,
  },
  {
    name: 'Basketball',
    slug: 'basketball',
    icon: 'basketball',
    sortOrder: 2,
    apiHost: 'v1.basketball.api-sports.io',
    hasDraws: false,
    totalLine: 210.5,
    totalLabel: 'Points',
  },
  {
    name: 'Ice Hockey',
    slug: 'ice-hockey',
    icon: 'hockey',
    sortOrder: 3,
    apiHost: 'v1.hockey.api-sports.io',
    hasDraws: true,
    totalLine: 5.5,
    totalLabel: 'Goals',
  },
  {
    name: 'American Football',
    slug: 'american-football',
    icon: 'football-american',
    sortOrder: 4,
    apiHost: 'v1.american-football.api-sports.io',
    hasDraws: false,
    totalLine: 45.5,
    totalLabel: 'Points',
  },
  {
    name: 'Handball',
    slug: 'handball',
    icon: 'handball',
    sortOrder: 5,
    apiHost: 'v1.handball.api-sports.io',
    hasDraws: true,
    totalLine: 50.5,
    totalLabel: 'Goals',
  },
  {
    name: 'Baseball',
    slug: 'baseball',
    icon: 'baseball',
    sortOrder: 6,
    apiHost: 'v1.baseball.api-sports.io',
    hasDraws: false,
    totalLine: 8.5,
    totalLabel: 'Runs',
  },
  {
    name: 'Rugby',
    slug: 'rugby',
    icon: 'rugby',
    sortOrder: 7,
    apiHost: 'v1.rugby.api-sports.io',
    hasDraws: true,
    totalLine: 40.5,
    totalLabel: 'Points',
  },
  {
    name: 'Volleyball',
    slug: 'volleyball',
    icon: 'volleyball',
    sortOrder: 8,
    apiHost: 'v1.volleyball.api-sports.io',
    hasDraws: false,
    totalLine: 3.5,
    totalLabel: 'Sets',
  },
  {
    name: 'AFL',
    slug: 'afl',
    icon: 'afl',
    sortOrder: 9,
    apiHost: 'v1.afl.api-sports.io',
    hasDraws: true,
    totalLine: 160.5,
    totalLabel: 'Points',
  },
  {
    name: 'Formula 1',
    slug: 'formula-1',
    icon: 'formula-1',
    sortOrder: 10,
    apiHost: 'v1.formula-1.api-sports.io',
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    freeTierBlocked: true,
  },
  {
    name: 'MMA',
    slug: 'mma',
    icon: 'mma',
    sortOrder: 11,
    apiHost: 'v1.mma.api-sports.io',
    hasDraws: false,
    totalLine: 2.5,
    totalLabel: 'Rounds',
    freeTierBlocked: true,
  },
  {
    name: 'NBA',
    slug: 'nba',
    icon: 'nba',
    sortOrder: 12,
    apiHost: 'v2.nba.api-sports.io',
    hasDraws: false,
    totalLine: 215.5,
    totalLabel: 'Points',
    freeTierBlocked: true,
  },
];

// ---------------------------------------------------------------------------
// API-Sports Status Mapping (works for ALL sports including football)
// ---------------------------------------------------------------------------

function mapApiSportsStatus(shortStatus: string): {
  status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';
  isLive: boolean;
} {
  switch (shortStatus) {
    case 'NS':
    case 'TBD':
      return { status: 'UPCOMING', isLive: false };
    // Live statuses — shared across all sports
    case 'Q1': case 'Q2': case 'Q3': case 'Q4': // Basketball quarters
    case 'OT': case 'BT': case 'HT':             // Overtime, Break, Halftime
    case 'P1': case 'P2': case 'P3':              // Hockey/Handball periods
    case 'INT': case 'LIVE':                       // Intermission, Generic live
    case '1H': case '2H':                          // Football/Handball halves
    case 'S1': case 'S2': case 'S3':              // Volleyball sets
    case 'S4': case 'S5':                          // Volleyball sets (4th, 5th)
    case 'ET':                                     // Extra time
    case 'P':                                      // Football penalty shootout
    case 'IN1': case 'IN2': case 'IN3':           // Baseball innings
    case 'IN4': case 'IN5': case 'IN6':
    case 'IN7': case 'IN8': case 'IN9':
      return { status: 'LIVE', isLive: true };
    // Finished statuses
    case 'FT': case 'AOT': case 'AP': case 'AWD': case 'WO':
    case 'AET':                                    // After Extra Time
    case 'PEN':                                    // After Penalties (football)
    case 'Completed':                              // F1 race completed
      return { status: 'ENDED', isLive: false };
    // Cancelled/Postponed
    case 'PST': case 'POST': case 'CANC': case 'ABD': case 'SUSP':
    case 'Cancelled':
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

interface ApiSportsResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | string[];
  results: number;
  response: T[];
}

async function fetchApi<T>(host: string, path: string): Promise<ApiSportsResponse<T>> {
  await rateLimitDelay();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path,
      method: 'GET',
      headers: {
        'x-apisports-key': API_KEY,
      },
    };

    logger.info({ host, path }, 'API-Sports: Making request');

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as ApiSportsResponse<T>;

          // Check for API errors
          const errors = parsed.errors;
          if (errors && typeof errors === 'object' && !Array.isArray(errors) && Object.keys(errors).length > 0) {
            const errorMsg = Object.values(errors).join(', ');
            reject(new Error(`API-Sports error for ${host}${path}: ${errorMsg}`));
            return;
          }
          if (Array.isArray(errors) && errors.length > 0) {
            reject(new Error(`API-Sports error for ${host}${path}: ${errors.join(', ')}`));
            return;
          }

          logger.info({ host, path, results: parsed.results }, 'API-Sports: Response received');
          resolve(parsed);
        } catch {
          reject(new Error(`Failed to parse response from ${host}${path}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err: Error) => {
      reject(new Error(`Request failed for ${host}${path}: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error(`Request timeout for ${host}${path}`));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// API Response Types — Other Sports (basketball/hockey/baseball/etc.)
// ---------------------------------------------------------------------------

interface ApiGame {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timezone: string;
  status: {
    long: string;
    short: string;
    timer: string | null;
  };
  league: {
    id: number;
    name: string;
    type: string;
    season: string | number;
    logo: string | null;
  };
  country: {
    id: number;
    name: string;
    code: string | null;
    flag: string | null;
  };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  scores: {
    home: { total: number | null } | number | null;
    away: { total: number | null } | number | null;
  };
}

// ---------------------------------------------------------------------------
// API Response Types — Football v3 (different structure)
// ---------------------------------------------------------------------------

interface FootballFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string | null;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string | null; winner: boolean | null };
    away: { id: number; name: string; logo: string | null; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
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
// Sync Status Tracking (in Redis)
// ---------------------------------------------------------------------------

export interface ApiSportsSyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  lastSyncResult: string | null;
  sportsSynced: number;
  competitionsSynced: number;
  eventsSynced: number;
  eventsCreated: number;
  eventsUpdated: number;
  errors: string[];
  startedAt: string | null;
  completedAt: string | null;
  currentSport: string | null;
  currentDate: string | null;
  requestsMade: number;
}

const SYNC_STATUS_KEY = 'api-sports:sync-status';

async function getSyncStatusFromRedis(): Promise<ApiSportsSyncStatus> {
  const cached = await redis.get(SYNC_STATUS_KEY);
  if (cached) return JSON.parse(cached);
  return {
    isRunning: false,
    lastSyncAt: null,
    lastSyncResult: null,
    sportsSynced: 0,
    competitionsSynced: 0,
    eventsSynced: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    errors: [],
    startedAt: null,
    completedAt: null,
    currentSport: null,
    currentDate: null,
    requestsMade: 0,
  };
}

async function updateSyncStatus(update: Partial<ApiSportsSyncStatus>): Promise<void> {
  const current = await getSyncStatusFromRedis();
  const updated = { ...current, ...update };
  await redis.set(SYNC_STATUS_KEY, JSON.stringify(updated), 'EX', 86400);
}

export async function getSyncStatus(): Promise<ApiSportsSyncStatus> {
  return getSyncStatusFromRedis();
}

// ---------------------------------------------------------------------------
// Ensure Sport Exists
// ---------------------------------------------------------------------------

async function ensureSport(config: SportConfig): Promise<string> {
  let sport = await prisma.sport.findUnique({ where: { slug: config.slug } });
  if (!sport) {
    sport = await prisma.sport.create({
      data: {
        name: config.name,
        slug: config.slug,
        icon: config.icon,
        isActive: true,
        sortOrder: config.sortOrder,
      },
    });
    logger.info({ sportId: sport.id, name: config.name }, 'Created sport');
  } else {
    await prisma.sport.update({
      where: { id: sport.id },
      data: { icon: config.icon, sortOrder: config.sortOrder, isActive: true },
    });
  }
  return sport.id;
}

// ---------------------------------------------------------------------------
// Ensure OddsProvider Exists
// ---------------------------------------------------------------------------

async function ensureOddsProvider(): Promise<string> {
  let provider = await prisma.oddsProvider.findUnique({ where: { slug: 'api-sports' } });
  if (!provider) {
    provider = await prisma.oddsProvider.create({
      data: {
        name: 'API-Sports',
        slug: 'api-sports',
        type: 'REST',
        apiKey: API_KEY,
        apiUrl: 'https://api-sports.io',
        priority: 3,
        isActive: true,
        rateLimitPerMin: 60,
        quotaLimit: 100,
        config: { sports: SPORT_CONFIGS.map(s => s.slug), dailyQuota: 100 },
      },
    });
  }
  return provider.id;
}

// ---------------------------------------------------------------------------
// Market Generation for New Events
// ---------------------------------------------------------------------------

async function generateMarketsForEvent(
  eventId: string,
  hasDraws: boolean,
  totalLine: number,
  totalLabel: string,
): Promise<void> {
  const existing = await prisma.market.count({ where: { eventId } });
  if (existing > 0) return;

  function generateOdds(probabilities: number[]): number[] {
    const margin = 0.95;
    return probabilities.map(p => {
      const odds = Math.round((1 / (p / margin)) * 100) / 100;
      return Math.max(1.10, odds);
    });
  }

  if (hasDraws) {
    const homePct = 0.30 + Math.random() * 0.20;
    const drawPct = 0.15 + Math.random() * 0.15;
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
  } else {
    const homePct = 0.35 + Math.random() * 0.30;
    const awayPct = 1 - homePct;
    const [homeOdds, awayOdds] = generateOdds([homePct, awayPct]);

    const m1 = await prisma.market.create({
      data: { eventId, name: 'Match Winner', marketKey: 'ML', type: 'MONEYLINE', status: 'OPEN', sortOrder: 1 },
    });
    await prisma.selection.createMany({
      data: [
        { marketId: m1.id, name: '1', outcome: 'HOME', odds: new Prisma.Decimal(homeOdds), status: 'ACTIVE' },
        { marketId: m1.id, name: '2', outcome: 'AWAY', odds: new Prisma.Decimal(awayOdds), status: 'ACTIVE' },
      ],
    });
  }

  // Over/Under Market (skip for sports with no line)
  if (totalLine > 0) {
    const overPct = 0.45 + Math.random() * 0.15;
    const underPct = 1 - overPct;
    const [overOdds, underOdds] = generateOdds([overPct, underPct]);

    const m2 = await prisma.market.create({
      data: {
        eventId,
        name: `Over/Under ${totalLine} ${totalLabel}`,
        marketKey: `OU${totalLine}`,
        type: 'TOTAL',
        status: 'OPEN',
        sortOrder: 2,
      },
    });
    await prisma.selection.createMany({
      data: [
        { marketId: m2.id, name: `Over ${totalLine}`, outcome: 'OVER', odds: new Prisma.Decimal(overOdds), status: 'ACTIVE' },
        { marketId: m2.id, name: `Under ${totalLine}`, outcome: 'UNDER', odds: new Prisma.Decimal(underOdds), status: 'ACTIVE' },
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// Upsert Event Helper (shared by football and other sports sync)
// ---------------------------------------------------------------------------

interface UpsertEventData {
  sportId: string;
  config: SportConfig;
  externalId: string;
  leagueId: number;
  leagueName: string;
  leagueLogo: string | null;
  leagueSeason: string | number;
  leagueType: string;
  country: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  homeTeamId: number;
  awayTeamId: number;
  startTime: Date;
  statusShort: string;
  statusLong: string;
  homeScore: number | null;
  awayScore: number | null;
  extraMeta?: Record<string, unknown>;
}

interface UpsertResult {
  created: number;
  updated: number;
  competitionId: string | null;
  error: string | null;
}

async function upsertEvent(data: UpsertEventData): Promise<UpsertResult> {
  const result: UpsertResult = { created: 0, updated: 0, competitionId: null, error: null };

  try {
    if (!data.homeTeamName && !data.awayTeamName) return result;

    // --- Find or create competition ---
    const leagueExternalId = `api-sports-${data.config.slug}-${data.leagueId}`;
    const leagueSlug = slugify(`${data.config.slug}-${data.leagueName}-${data.country || 'intl'}`);

    let competition = await prisma.competition.findFirst({ where: { externalId: leagueExternalId } });

    if (!competition) {
      const existingBySlug = await prisma.competition.findFirst({
        where: { sportId: data.sportId, slug: leagueSlug },
      });
      if (existingBySlug) {
        competition = await prisma.competition.update({
          where: { id: existingBySlug.id },
          data: {
            name: data.leagueName,
            country: data.country,
            logo: data.leagueLogo,
            externalId: leagueExternalId,
            isActive: true,
          },
        });
      } else {
        competition = await prisma.competition.create({
          data: {
            sportId: data.sportId,
            name: data.leagueName,
            slug: leagueSlug,
            country: data.country,
            logo: data.leagueLogo,
            externalId: leagueExternalId,
            isActive: true,
          },
        });
      }
    } else {
      await prisma.competition.update({
        where: { id: competition.id },
        data: { name: data.leagueName, country: data.country, logo: data.leagueLogo, isActive: true },
      });
    }

    result.competitionId = competition.id;

    // --- Map status ---
    const { status: eventStatus, isLive } = mapApiSportsStatus(data.statusShort);

    // --- Build event ---
    const eventName = `${data.homeTeamName || 'TBD'} vs ${data.awayTeamName || 'TBD'}`;

    const scoresObj: Record<string, number | null> = {};
    if (data.homeScore !== null) {
      scoresObj.home = data.homeScore;
      scoresObj.away = data.awayScore;
    }
    const scoresJson: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      Object.keys(scoresObj).length > 0 ? (scoresObj as Prisma.InputJsonValue) : Prisma.JsonNull;

    const metadataJson: Prisma.InputJsonValue = {
      source: 'api-sports',
      sport: data.config.slug,
      leagueId: data.leagueId,
      leagueName: data.leagueName,
      leagueSeason: data.leagueSeason,
      leagueType: data.leagueType,
      country: data.country,
      statusLong: data.statusLong,
      statusShort: data.statusShort,
      homeTeamId: data.homeTeamId,
      awayTeamId: data.awayTeamId,
      ...(data.extraMeta || {}),
    } as Prisma.InputJsonValue;

    // --- Upsert ---
    const existingEvent = await prisma.event.findFirst({
      where: { externalId: data.externalId },
      select: { id: true, status: true, scores: true, homeTeamLogo: true, awayTeamLogo: true },
    });

    if (existingEvent) {
      // Detect score changes for live odds recalculation
      const oldScores = existingEvent.scores as Record<string, number | null> | null;
      const scoreChanged = isLive && (
        (oldScores?.home ?? null) !== data.homeScore ||
        (oldScores?.away ?? null) !== data.awayScore
      );

      // Store pre-match odds in metadata on first transition to LIVE
      if (isLive && existingEvent.status === 'UPCOMING') {
        const market = await prisma.market.findFirst({
          where: { eventId: existingEvent.id, type: 'MONEYLINE', status: 'OPEN' },
          include: { selections: { where: { status: 'ACTIVE' } } },
        });
        if (market) {
          const preMatchOdds: Record<string, number> = {};
          for (const sel of market.selections) {
            if (sel.outcome === 'HOME') preMatchOdds.home = parseFloat(sel.odds.toString());
            else if (sel.outcome === 'AWAY') preMatchOdds.away = parseFloat(sel.odds.toString());
            else if (sel.outcome === 'DRAW') preMatchOdds.draw = parseFloat(sel.odds.toString());
          }
          (metadataJson as Record<string, unknown>).preMatchOdds = preMatchOdds;
        }
      }

      await prisma.event.update({
        where: { id: existingEvent.id },
        data: {
          name: eventName,
          homeTeam: data.homeTeamName || 'TBD',
          awayTeam: data.awayTeamName || 'TBD',
          homeTeamLogo: data.homeTeamLogo || existingEvent.homeTeamLogo,
          awayTeamLogo: data.awayTeamLogo || existingEvent.awayTeamLogo,
          startTime: data.startTime,
          status: eventStatus,
          isLive,
          scores: scoresJson,
          metadata: metadataJson,
        },
      });

      // Recalculate live odds when score changes or event goes live
      if (isLive && (scoreChanged || existingEvent.status === 'UPCOMING')) {
        try {
          await recalculateLiveOdds(
            existingEvent.id,
            data.homeScore ?? 0,
            data.awayScore ?? 0,
            data.config.slug,
            metadataJson as Record<string, unknown>,
          );
        } catch (oddsErr) {
          // Non-fatal: log and continue
          const msg = oddsErr instanceof Error ? oddsErr.message : String(oddsErr);
          logger.warn({ eventId: existingEvent.id, error: msg }, 'Live odds recalculation failed');
        }
      }

      result.updated++;
    } else {
      // Only create upcoming or live events (don't backfill finished games)
      if (eventStatus === 'UPCOMING' || eventStatus === 'LIVE') {
        const newEvent = await prisma.event.create({
          data: {
            externalId: data.externalId,
            competitionId: competition.id,
            name: eventName,
            homeTeam: data.homeTeamName || 'TBD',
            awayTeam: data.awayTeamName || 'TBD',
            homeTeamLogo: data.homeTeamLogo,
            awayTeamLogo: data.awayTeamLogo,
            startTime: data.startTime,
            status: eventStatus,
            isLive,
            scores: scoresJson,
            metadata: metadataJson,
          },
        });

        try {
          await generateMarketsForEvent(newEvent.id, data.config.hasDraws, data.config.totalLine, data.config.totalLabel);
        } catch (marketErr) {
          const msg = marketErr instanceof Error ? marketErr.message : String(marketErr);
          logger.error({ eventId: newEvent.id, error: msg }, 'Failed to generate markets');
        }

        result.created++;
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sync Football Fixtures (v3 API — different response format)
// ---------------------------------------------------------------------------

async function syncFootballFixtures(config: SportConfig, dateStr: string): Promise<{
  created: number;
  updated: number;
  competitionsFound: Set<string>;
  errors: string[];
}> {
  const result = { created: 0, updated: 0, competitionsFound: new Set<string>(), errors: [] as string[] };

  try {
    const response = await fetchApi<FootballFixture>(config.apiHost, `/fixtures?date=${dateStr}`);

    if (!response.response || response.response.length === 0) {
      logger.info({ sport: config.name, date: dateStr }, 'No fixtures found');
      return result;
    }

    const sportId = await ensureSport(config);

    logger.info({ sport: config.name, date: dateStr, count: response.response.length }, 'Processing football fixtures');

    for (const fix of response.response) {
      const upsertData: UpsertEventData = {
        sportId,
        config,
        externalId: `api-sports-football-${fix.fixture.id}`,
        leagueId: fix.league.id,
        leagueName: fix.league.name,
        leagueLogo: fix.league.logo,
        leagueSeason: fix.league.season,
        leagueType: 'League',
        country: fix.league.country || null,
        homeTeamName: fix.teams.home.name,
        awayTeamName: fix.teams.away.name,
        homeTeamLogo: fix.teams.home.logo,
        awayTeamLogo: fix.teams.away.logo,
        homeTeamId: fix.teams.home.id,
        awayTeamId: fix.teams.away.id,
        startTime: new Date(fix.fixture.timestamp * 1000),
        statusShort: fix.fixture.status.short,
        statusLong: fix.fixture.status.long,
        homeScore: fix.goals.home,
        awayScore: fix.goals.away,
        extraMeta: {
          fixtureId: fix.fixture.id,
          round: fix.league.round,
          elapsed: fix.fixture.status.elapsed,
        },
      };

      const res = await upsertEvent(upsertData);
      result.created += res.created;
      result.updated += res.updated;
      if (res.competitionId) result.competitionsFound.add(res.competitionId);
      if (res.error) result.errors.push(`${fix.teams.home.name} vs ${fix.teams.away.name}: ${res.error}`);
    }

    logger.info({ sport: config.name, date: dateStr, created: result.created, updated: result.updated }, 'Football sync done');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`${config.name} ${dateStr}: ${msg}`);
    logger.error({ sport: config.name, date: dateStr, error: msg }, 'Football sync failed');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sync Other Sport Games (basketball/hockey/etc.)
// ---------------------------------------------------------------------------

export async function syncSportGames(config: SportConfig, dateStr: string): Promise<{
  created: number;
  updated: number;
  competitionsFound: Set<string>;
  errors: string[];
}> {
  const result = { created: 0, updated: 0, competitionsFound: new Set<string>(), errors: [] as string[] };

  try {
    if (config.freeTierBlocked) {
      return result;
    }

    const response = await fetchApi<ApiGame>(config.apiHost, `/games?date=${dateStr}`);

    if (!response.response || response.response.length === 0) {
      return result;
    }

    const sportId = await ensureSport(config);

    logger.info({ sport: config.name, date: dateStr, count: response.response.length }, 'Processing games');

    for (const game of response.response) {
      if (!game.teams?.home?.name && !game.teams?.away?.name) continue;
      if (!game.league?.id || !game.league?.name) continue;

      // Extract score from either direct or nested format
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      if (game.scores) {
        const rawHome = game.scores.home;
        const rawAway = game.scores.away;
        if (typeof rawHome === 'number') {
          homeScore = rawHome;
          awayScore = typeof rawAway === 'number' ? rawAway : null;
        } else if (rawHome && typeof rawHome === 'object' && 'total' in rawHome) {
          homeScore = (rawHome as { total?: number | null }).total ?? null;
          awayScore = rawAway && typeof rawAway === 'object' && 'total' in rawAway
            ? (rawAway as { total?: number | null }).total ?? null
            : null;
        }
      }

      const upsertData: UpsertEventData = {
        sportId,
        config,
        externalId: `api-sports-${config.slug}-${game.id}`,
        leagueId: game.league.id,
        leagueName: game.league.name,
        leagueLogo: game.league.logo,
        leagueSeason: game.league.season,
        leagueType: game.league.type || 'League',
        country: game.country?.name || null,
        homeTeamName: game.teams.home.name,
        awayTeamName: game.teams.away.name,
        homeTeamLogo: game.teams.home.logo,
        awayTeamLogo: game.teams.away.logo,
        homeTeamId: game.teams.home.id,
        awayTeamId: game.teams.away.id,
        startTime: game.timestamp ? new Date(game.timestamp * 1000) : new Date(game.date || `${dateStr}T00:00:00Z`),
        statusShort: game.status?.short || 'NS',
        statusLong: game.status?.long || 'Not Started',
        homeScore,
        awayScore,
        extraMeta: { gameId: game.id },
      };

      const res = await upsertEvent(upsertData);
      result.created += res.created;
      result.updated += res.updated;
      if (res.competitionId) result.competitionsFound.add(res.competitionId);
      if (res.error) result.errors.push(`${game.teams.home.name} vs ${game.teams.away.name}: ${res.error}`);
    }

    logger.info({ sport: config.name, date: dateStr, created: result.created, updated: result.updated }, 'Games sync done');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`${config.name} ${dateStr}: ${msg}`);
    logger.error({ sport: config.name, date: dateStr, error: msg }, 'Games sync failed');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Clean Up Old Data
// ---------------------------------------------------------------------------

async function cleanupOldFootballData(): Promise<number> {
  logger.info('Cleaning up old football-data.org events...');
  let deleted = 0;

  try {
    const footballSport = await prisma.sport.findUnique({ where: { slug: 'football' } });
    if (!footballSport) return 0;

    // Find football events that are NOT from api-sports (old football-data.org data)
    const oldEvents = await prisma.event.findMany({
      where: {
        competition: { sportId: footballSport.id },
        OR: [
          { externalId: null },
          { externalId: { not: { startsWith: 'api-sports-' } } },
        ],
      },
      select: { id: true },
    });

    if (oldEvents.length > 0) {
      const eventIds = oldEvents.map(e => e.id);

      // Delete in batch: selections -> markets -> events
      await prisma.selection.deleteMany({ where: { market: { eventId: { in: eventIds } } } });
      await prisma.market.deleteMany({ where: { eventId: { in: eventIds } } });
      const result = await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
      deleted = result.count;

      logger.info({ deleted }, 'Deleted old football-data.org events');
    }

    // Clean up empty competitions
    const emptyComps = await prisma.competition.findMany({
      where: {
        sportId: footballSport.id,
        OR: [
          { externalId: null },
          { externalId: { not: { startsWith: 'api-sports-' } } },
        ],
      },
      select: { id: true, name: true },
    });

    for (const comp of emptyComps) {
      const remaining = await prisma.event.count({ where: { competitionId: comp.id } });
      if (remaining === 0) {
        await prisma.competition.delete({ where: { id: comp.id } });
        logger.info({ competition: comp.name }, 'Deleted empty old football competition');
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, 'Error cleaning up old football data');
  }

  return deleted;
}

async function cleanupGeneratedData(): Promise<number> {
  logger.info('Cleaning up generated placeholder data without externalId...');
  let totalDeleted = 0;

  try {
    const allSports = await prisma.sport.findMany({ select: { id: true, slug: true, name: true } });

    for (const sport of allSports) {
      const generatedComps = await prisma.competition.findMany({
        where: { sportId: sport.id, externalId: null },
        select: { id: true, name: true },
      });

      if (generatedComps.length === 0) continue;

      const compIds = generatedComps.map(c => c.id);

      const generatedEvents = await prisma.event.findMany({
        where: { competitionId: { in: compIds }, externalId: null },
        select: { id: true },
      });

      if (generatedEvents.length > 0) {
        const eventIds = generatedEvents.map(e => e.id);
        await prisma.selection.deleteMany({ where: { market: { eventId: { in: eventIds } } } });
        await prisma.market.deleteMany({ where: { eventId: { in: eventIds } } });
        const evResult = await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
        totalDeleted += evResult.count;
        logger.info({ sport: sport.name, deleted: evResult.count }, 'Cleaned up generated events');
      }

      for (const comp of generatedComps) {
        const rem = await prisma.event.count({ where: { competitionId: comp.id } });
        if (rem === 0) {
          await prisma.competition.delete({ where: { id: comp.id } });
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, 'Error during cleanup');
  }

  logger.info({ totalDeleted }, 'Cleanup done');
  return totalDeleted;
}

// ---------------------------------------------------------------------------
// Fix Stale Live Events
// ---------------------------------------------------------------------------

/**
 * Mark events as ENDED if they were LIVE but their start time was >4 hours ago
 * and they haven't been updated by the API sync. This catches events that
 * went LIVE during a previous sync but the game has since finished.
 */
async function fixStaleLiveEvents(): Promise<number> {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const staleEvents = await prisma.event.updateMany({
    where: {
      status: 'LIVE',
      isLive: true,
      startTime: { lt: fourHoursAgo },
    },
    data: {
      status: 'ENDED',
      isLive: false,
    },
  });

  if (staleEvents.count > 0) {
    logger.info({ count: staleEvents.count }, 'Fixed stale LIVE events → ENDED');
  }

  return staleEvents.count;
}

// ---------------------------------------------------------------------------
// Full Sync Orchestrator
// ---------------------------------------------------------------------------

export async function fullSync(): Promise<{
  sportsSynced: number;
  competitionsSynced: number;
  eventsSynced: number;
  eventsCreated: number;
  eventsUpdated: number;
  errors: string[];
}> {
  const currentStatus = await getSyncStatusFromRedis();
  if (currentStatus.isRunning) {
    throw new Error('An API-Sports sync is already in progress');
  }

  const startTime = Date.now();

  await updateSyncStatus({
    isRunning: true,
    startedAt: new Date().toISOString(),
    errors: [],
    sportsSynced: 0,
    competitionsSynced: 0,
    eventsSynced: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    currentSport: null,
    currentDate: null,
    requestsMade: 0,
  });

  const allErrors: string[] = [];
  let totalSportsSynced = 0;
  const allCompetitions = new Set<string>();
  let totalEventsCreated = 0;
  let totalEventsUpdated = 0;
  let requestsMade = 0;

  try {
    logger.info('=== API-Sports Full Sync Started ===');

    // Step 1: Clean up old data
    await cleanupGeneratedData();
    await cleanupOldFootballData();

    // Step 2: Fix stale live events (games that ended but are still marked LIVE)
    await fixStaleLiveEvents();

    // Step 3: Generate date strings (today + yesterday + tomorrow)
    const dates: string[] = [];
    const now = new Date();
    // Include yesterday to update finished games that were LIVE
    for (let i = -1; i < SYNC_DAYS; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    logger.info({ dates }, 'Syncing dates');

    // Step 4: Ensure all sports exist in DB
    for (const config of SPORT_CONFIGS) {
      try {
        await ensureSport(config);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ sport: config.name, error: msg }, 'Failed to ensure sport');
      }
    }

    // Step 5: Sync each sport's games
    for (const config of SPORT_CONFIGS) {
      logger.info({ sport: config.name }, 'Starting sport sync');
      await updateSyncStatus({ currentSport: config.name });

      let sportHasGames = false;

      for (const dateStr of dates) {
        await updateSyncStatus({ currentDate: dateStr });

        try {
          let result;
          if (config.isFootball) {
            result = await syncFootballFixtures(config, dateStr);
          } else if (config.freeTierBlocked) {
            result = { created: 0, updated: 0, competitionsFound: new Set<string>(), errors: [] as string[] };
          } else {
            result = await syncSportGames(config, dateStr);
          }

          if (!config.freeTierBlocked) {
            requestsMade++;
          }

          totalEventsCreated += result.created;
          totalEventsUpdated += result.updated;
          for (const compId of result.competitionsFound) allCompetitions.add(compId);
          if (result.created > 0 || result.updated > 0) sportHasGames = true;
          if (result.errors.length > 0) allErrors.push(...result.errors);

          await updateSyncStatus({
            eventsCreated: totalEventsCreated,
            eventsUpdated: totalEventsUpdated,
            eventsSynced: totalEventsCreated + totalEventsUpdated,
            competitionsSynced: allCompetitions.size,
            errors: allErrors.slice(-20),
            requestsMade,
          });
        } catch (dateErr) {
          const msg = dateErr instanceof Error ? dateErr.message : String(dateErr);
          allErrors.push(`${config.name} ${dateStr}: ${msg}`);
          logger.error({ sport: config.name, date: dateStr, error: msg }, 'Date sync failed');
        }
      }

      if (sportHasGames) totalSportsSynced++;

      // Update sport event count
      try {
        const sportId = await ensureSport(config);
        const eventCount = await prisma.event.count({
          where: { status: { in: ['UPCOMING', 'LIVE'] }, competition: { sportId } },
        });
        await prisma.sport.update({ where: { id: sportId }, data: { eventCount } });
        logger.info({ sport: config.name, eventCount }, 'Updated sport event count');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ sport: config.name, error: msg }, 'Failed to update event count');
      }

      await updateSyncStatus({ sportsSynced: totalSportsSynced });
    }

    // Step 6: Log sync result
    try {
      const providerId = await ensureOddsProvider();
      await prisma.oddsSyncLog.create({
        data: {
          providerId,
          sportKey: 'multi-sport',
          eventsCount: totalEventsCreated + totalEventsUpdated,
          marketsCount: totalEventsCreated * 2,
          status: allErrors.length > 0 ? 'PARTIAL' : 'SUCCESS',
          error: allErrors.length > 0 ? allErrors.slice(0, 5).join('; ') : null,
          duration: Math.round((Date.now() - startTime) / 1000),
        },
      });
    } catch (logErr) {
      logger.error({ error: logErr }, 'Failed to create sync log');
    }

    // Step 7: Recalculate live odds for all live events
    try {
      const oddsUpdated = await recalculateAllLiveOdds();
      logger.info({ oddsUpdated }, 'Live odds recalculation complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Failed to recalculate live odds');
    }

    // Step 8: Clear Redis caches
    try {
      await redis.del('sports:list');
      const compKeys = await redis.keys('competitions:*');
      if (compKeys.length > 0) await redis.del(...compKeys);
      const eventKeys = await redis.keys('events:*');
      if (eventKeys.length > 0) await redis.del(...eventKeys);
      logger.info('Redis caches cleared');
    } catch (cacheErr) {
      logger.error({ error: cacheErr }, 'Failed to clear caches');
    }

    logger.info({
      sportsSynced: totalSportsSynced,
      competitionsSynced: allCompetitions.size,
      eventsCreated: totalEventsCreated,
      eventsUpdated: totalEventsUpdated,
      requestsMade,
      errors: allErrors.length,
      duration: `${Math.round((Date.now() - startTime) / 1000)}s`,
    }, '=== API-Sports Full Sync Completed ===');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    allErrors.push(`Full sync failed: ${msg}`);
    logger.error({ error: msg }, 'Full sync failed');
  } finally {
    await updateSyncStatus({
      isRunning: false,
      lastSyncAt: new Date().toISOString(),
      lastSyncResult: allErrors.length > 0 ? 'PARTIAL' : 'SUCCESS',
      sportsSynced: totalSportsSynced,
      competitionsSynced: allCompetitions.size,
      eventsSynced: totalEventsCreated + totalEventsUpdated,
      eventsCreated: totalEventsCreated,
      eventsUpdated: totalEventsUpdated,
      errors: allErrors.slice(-20),
      completedAt: new Date().toISOString(),
      currentSport: null,
      currentDate: null,
      requestsMade,
    });
  }

  return {
    sportsSynced: totalSportsSynced,
    competitionsSynced: allCompetitions.size,
    eventsSynced: totalEventsCreated + totalEventsUpdated,
    eventsCreated: totalEventsCreated,
    eventsUpdated: totalEventsUpdated,
    errors: allErrors,
  };
}

// ---------------------------------------------------------------------------
// Lightweight Live-Only Sync
// Only updates currently live events — much faster, uses fewer API requests
// Designed to run every 1-2 minutes for real-time data
// ---------------------------------------------------------------------------

export async function liveSyncOnly(): Promise<{ updated: number; oddsRecalculated: number; errors: string[] }> {
  let updated = 0;
  let oddsRecalculated = 0;
  const errors: string[] = [];

  logger.info('=== Live Sync Started ===');

  for (const config of SPORT_CONFIGS) {
    if (config.freeTierBlocked) continue;

    try {
      if (config.isFootball) {
        // Football: /fixtures?live=all returns only live games
        const response = await fetchApi<FootballFixture>(config.apiHost, '/fixtures?live=all');
        if (!response.response || response.response.length === 0) continue;

        const sportId = await ensureSport(config);

        for (const fix of response.response) {
          const externalId = `api-sports-football-${fix.fixture.id}`;
          const existing = await prisma.event.findFirst({
            where: { externalId },
            select: { id: true, status: true, scores: true, homeTeamLogo: true, awayTeamLogo: true },
          });
          if (!existing) continue; // only update existing events

          const { status: eventStatus, isLive } = mapApiSportsStatus(fix.fixture.status.short);
          const scoresObj: Record<string, number | null> = {};
          if (fix.goals.home !== null) { scoresObj.home = fix.goals.home; scoresObj.away = fix.goals.away; }
          const scoresJson = Object.keys(scoresObj).length > 0 ? scoresObj as Prisma.InputJsonValue : Prisma.JsonNull;

          const metaUpdate: Record<string, unknown> = {
            statusShort: fix.fixture.status.short,
            statusLong: fix.fixture.status.long,
            elapsed: fix.fixture.status.elapsed,
          };

          // Merge metadata (keep existing fields, update live fields)
          const existingMeta = await prisma.event.findUnique({ where: { id: existing.id }, select: { metadata: true } });
          const merged = { ...(existingMeta?.metadata as Record<string, unknown> || {}), ...metaUpdate };

          await prisma.event.update({
            where: { id: existing.id },
            data: { status: eventStatus, isLive, scores: scoresJson, metadata: merged as Prisma.InputJsonValue },
          });
          updated++;
        }
      } else {
        // Other sports: /games?live=all
        try {
          const response = await fetchApi<ApiGame>(config.apiHost, '/games?live=all');
          if (!response.response || response.response.length === 0) continue;

          const sportId = await ensureSport(config);

          for (const game of response.response) {
            const externalId = `api-sports-${config.slug}-${game.id}`;
            const existing = await prisma.event.findFirst({
              where: { externalId },
              select: { id: true, status: true, scores: true, homeTeamLogo: true, awayTeamLogo: true },
            });
            if (!existing) continue;

            const { status: eventStatus, isLive } = mapApiSportsStatus(game.status?.short || 'NS');

            let homeScore: number | null = null;
            let awayScore: number | null = null;
            if (game.scores) {
              const rawHome = game.scores.home;
              const rawAway = game.scores.away;
              if (typeof rawHome === 'number') { homeScore = rawHome; awayScore = typeof rawAway === 'number' ? rawAway : null; }
              else if (rawHome && typeof rawHome === 'object' && 'total' in rawHome) {
                homeScore = (rawHome as any).total ?? null;
                awayScore = rawAway && typeof rawAway === 'object' && 'total' in rawAway ? (rawAway as any).total ?? null : null;
              }
            }

            const scoresObj: Record<string, number | null> = {};
            if (homeScore !== null) { scoresObj.home = homeScore; scoresObj.away = awayScore; }
            const scoresJson = Object.keys(scoresObj).length > 0 ? scoresObj as Prisma.InputJsonValue : Prisma.JsonNull;

            const metaUpdate: Record<string, unknown> = {
              statusShort: game.status?.short,
              statusLong: game.status?.long,
            };
            const existingMeta = await prisma.event.findUnique({ where: { id: existing.id }, select: { metadata: true } });
            const merged = { ...(existingMeta?.metadata as Record<string, unknown> || {}), ...metaUpdate };

            await prisma.event.update({
              where: { id: existing.id },
              data: { status: eventStatus, isLive, scores: scoresJson, metadata: merged as Prisma.InputJsonValue },
            });
            updated++;
          }
        } catch (err) {
          // Some sports may not support live=all
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('error')) errors.push(`${config.name}: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${config.name}: ${msg}`);
    }
  }

  // Recalculate odds for all live events after updating scores
  try {
    oddsRecalculated = await recalculateAllLiveOdds();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Odds recalc: ${msg}`);
  }

  // Clear event caches
  try {
    const eventKeys = await redis.keys('events:*');
    if (eventKeys.length > 0) await redis.del(...eventKeys);
  } catch {}

  logger.info({ updated, oddsRecalculated, errors: errors.length }, '=== Live Sync Complete ===');
  return { updated, oddsRecalculated, errors };
}

// ---------------------------------------------------------------------------
// Auto-Sync: Start periodic live sync (call once on server start)
// ---------------------------------------------------------------------------

let liveSyncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoLiveSync(intervalMs: number = 120_000): void {
  if (liveSyncInterval) return;
  logger.info({ intervalMs }, 'Starting auto live sync');
  liveSyncInterval = setInterval(async () => {
    try {
      await liveSyncOnly();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Auto live sync failed');
    }
  }, intervalMs);
}

export function stopAutoLiveSync(): void {
  if (liveSyncInterval) {
    clearInterval(liveSyncInterval);
    liveSyncInterval = null;
    logger.info('Auto live sync stopped');
  }
}
