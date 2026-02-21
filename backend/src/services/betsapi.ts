// =============================================================================
// BetsAPI Live Data Integration Service
// Replaces API-Sports live sync with real-time data from BetsAPI (Bet365 source)
// API Docs: https://betsapi.com/docs/
// Rate limit: Events API tier ($150/mo) — 3,600 req/hr (60 req/min)
// =============================================================================

import https from 'https';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../middleware/logger.js';
import { recalculateLiveOdds } from './liveOddsEngine.js';
import { broadcastEventStatus } from '../modules/live/live.service.js';
import { betSettlementQueue } from '../queues/index.js';
import config from '../config/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BETSAPI_TOKEN = config.BETSAPI_TOKEN || '246059-rrvRSBnT7ZFXhc';
const BASE_URL = 'https://api.betsapi.com/v1';
const MAX_REQUESTS_PER_HOUR = 3600; // Events API tier ($150/mo)
const MAX_REQUESTS_PER_MINUTE = 55; // Conservative: 55/min × 60 = 3300/hr, leaves 300/hr headroom
const TEAM_IMAGE_BASE_URL = 'https://assets.b365api.com/images/team/b';

// ---------------------------------------------------------------------------
// Sport ID Mapping (BetsAPI sport_id -> our slug)
// ---------------------------------------------------------------------------

interface BetsAPISportConfig {
  betsapiId: number;
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  hasDraws: boolean;
  totalLine: number;
  totalLabel: string;
  priority: number; // lower = polled first; football = highest priority
  hasRealOdds: boolean; // true = fetch real odds from BetsAPI /v2/event/odds
}

const SPORT_CONFIGS: BetsAPISportConfig[] = [
  // --- Tier 1: Highest priority, polled most often ---
  {
    betsapiId: 1,
    slug: 'football',
    name: 'Football',
    icon: 'football',
    sortOrder: 1,
    hasDraws: true,
    totalLine: 2.5,
    totalLabel: 'Goals',
    priority: 1,
    hasRealOdds: true,
  },
  {
    betsapiId: 18,
    slug: 'basketball',
    name: 'Basketball',
    icon: 'basketball',
    sortOrder: 2,
    hasDraws: false,
    totalLine: 210.5,
    totalLabel: 'Points',
    priority: 2,
    hasRealOdds: true,
  },
  {
    betsapiId: 13,
    slug: 'tennis',
    name: 'Tennis',
    icon: 'tennis',
    sortOrder: 3,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 3,
    hasRealOdds: false,
  },
  {
    betsapiId: 17,
    slug: 'ice-hockey',
    name: 'Ice Hockey',
    icon: 'hockey',
    sortOrder: 4,
    hasDraws: true,
    totalLine: 5.5,
    totalLabel: 'Goals',
    priority: 4,
    hasRealOdds: false,
  },
  // --- Tier 2: Major sports ---
  {
    betsapiId: 16,
    slug: 'baseball',
    name: 'Baseball',
    icon: 'baseball',
    sortOrder: 5,
    hasDraws: false,
    totalLine: 8.5,
    totalLabel: 'Runs',
    priority: 5,
    hasRealOdds: false,
  },
  {
    betsapiId: 3,
    slug: 'cricket',
    name: 'Cricket',
    icon: 'cricket',
    sortOrder: 6,
    hasDraws: true,
    totalLine: 0,
    totalLabel: '',
    priority: 6,
    hasRealOdds: false,
  },
  {
    betsapiId: 8,
    slug: 'rugby',
    name: 'Rugby Union',
    icon: 'rugby',
    sortOrder: 7,
    hasDraws: true,
    totalLine: 45.5,
    totalLabel: 'Points',
    priority: 7,
    hasRealOdds: false,
  },
  {
    betsapiId: 19,
    slug: 'rugby-league',
    name: 'Rugby League',
    icon: 'rugby',
    sortOrder: 8,
    hasDraws: true,
    totalLine: 42.5,
    totalLabel: 'Points',
    priority: 8,
    hasRealOdds: false,
  },
  {
    betsapiId: 78,
    slug: 'handball',
    name: 'Handball',
    icon: 'handball',
    sortOrder: 9,
    hasDraws: true,
    totalLine: 50.5,
    totalLabel: 'Goals',
    priority: 9,
    hasRealOdds: false,
  },
  {
    betsapiId: 91,
    slug: 'volleyball',
    name: 'Volleyball',
    icon: 'volleyball',
    sortOrder: 10,
    hasDraws: false,
    totalLine: 3.5,
    totalLabel: 'Sets',
    priority: 10,
    hasRealOdds: false,
  },
  // --- Tier 3: Popular secondary sports ---
  {
    betsapiId: 9,
    slug: 'boxing',
    name: 'Boxing',
    icon: 'boxing',
    sortOrder: 11,
    hasDraws: true,
    totalLine: 0,
    totalLabel: '',
    priority: 11,
    hasRealOdds: false,
  },
  {
    betsapiId: 151,
    slug: 'esports',
    name: 'Esports',
    icon: 'esports',
    sortOrder: 12,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 12,
    hasRealOdds: false,
  },
  {
    betsapiId: 92,
    slug: 'table-tennis',
    name: 'Table Tennis',
    icon: 'table-tennis',
    sortOrder: 13,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 13,
    hasRealOdds: false,
  },
  {
    betsapiId: 94,
    slug: 'badminton',
    name: 'Badminton',
    icon: 'badminton',
    sortOrder: 14,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 14,
    hasRealOdds: false,
  },
  {
    betsapiId: 83,
    slug: 'futsal',
    name: 'Futsal',
    icon: 'futsal',
    sortOrder: 15,
    hasDraws: true,
    totalLine: 5.5,
    totalLabel: 'Goals',
    priority: 15,
    hasRealOdds: false,
  },
  {
    betsapiId: 84,
    slug: 'field-hockey',
    name: 'Field Hockey',
    icon: 'field-hockey',
    sortOrder: 16,
    hasDraws: true,
    totalLine: 4.5,
    totalLabel: 'Goals',
    priority: 16,
    hasRealOdds: false,
  },
  // --- Tier 4: Niche / seasonal ---
  {
    betsapiId: 107,
    slug: 'golf',
    name: 'Golf',
    icon: 'golf',
    sortOrder: 17,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 17,
    hasRealOdds: false,
  },
  {
    betsapiId: 110,
    slug: 'water-polo',
    name: 'Water Polo',
    icon: 'water-polo',
    sortOrder: 18,
    hasDraws: true,
    totalLine: 17.5,
    totalLabel: 'Goals',
    priority: 18,
    hasRealOdds: false,
  },
  {
    betsapiId: 90,
    slug: 'floorball',
    name: 'Floorball',
    icon: 'floorball',
    sortOrder: 19,
    hasDraws: true,
    totalLine: 9.5,
    totalLabel: 'Goals',
    priority: 19,
    hasRealOdds: false,
  },
  {
    betsapiId: 89,
    slug: 'bandy',
    name: 'Bandy',
    icon: 'bandy',
    sortOrder: 20,
    hasDraws: true,
    totalLine: 8.5,
    totalLabel: 'Goals',
    priority: 20,
    hasRealOdds: false,
  },
  {
    betsapiId: 98,
    slug: 'curling',
    name: 'Curling',
    icon: 'curling',
    sortOrder: 21,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 21,
    hasRealOdds: false,
  },
  {
    betsapiId: 75,
    slug: 'lacrosse',
    name: 'Lacrosse',
    icon: 'lacrosse',
    sortOrder: 22,
    hasDraws: false,
    totalLine: 20.5,
    totalLabel: 'Goals',
    priority: 22,
    hasRealOdds: false,
  },
  // --- Tier 5: Racing (no head-to-head markets) ---
  {
    betsapiId: 2,
    slug: 'horse-racing',
    name: 'Horse Racing',
    icon: 'horse-racing',
    sortOrder: 23,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 23,
    hasRealOdds: false,
  },
  {
    betsapiId: 4,
    slug: 'greyhounds',
    name: 'Greyhounds',
    icon: 'greyhounds',
    sortOrder: 24,
    hasDraws: false,
    totalLine: 0,
    totalLabel: '',
    priority: 24,
    hasRealOdds: false,
  },
];

const SPORT_ID_TO_CONFIG = new Map<number, BetsAPISportConfig>();
const SLUG_TO_CONFIG = new Map<string, BetsAPISportConfig>();
for (const cfg of SPORT_CONFIGS) {
  SPORT_ID_TO_CONFIG.set(cfg.betsapiId, cfg);
  SLUG_TO_CONFIG.set(cfg.slug, cfg);
}

// ---------------------------------------------------------------------------
// BetsAPI Response Types
// ---------------------------------------------------------------------------

interface BetsAPILeague {
  id: string;
  name: string;
  cc?: string;
}

interface BetsAPITeam {
  id: string;
  name: string;
  image_id?: string;
  cc?: string;
}

interface BetsAPITimer {
  tm?: number;
  ts?: number;
  tt?: string;
  ta?: number;
  md?: number;
  q?: number;
}

interface BetsAPIPeriodScore {
  home: string;
  away: string;
}

interface BetsAPIEvent {
  id: string;
  sport_id: string;
  time: string;
  time_status: string;
  league: BetsAPILeague;
  home: BetsAPITeam;
  away: BetsAPITeam;
  ss?: string;
  scores?: Record<string, BetsAPIPeriodScore>;
  timer?: BetsAPITimer;
  bet365_id?: string;
  extra?: Record<string, unknown>;
}

interface BetsAPIResponse {
  success: number;
  pager?: {
    page: number;
    per_page: number;
    total: number;
  };
  results: any; // BetsAPIEvent[] for events endpoints, object for odds endpoints
}

// ---------------------------------------------------------------------------
// Cached Event Type (in-memory cache)
// ---------------------------------------------------------------------------

export interface CachedEvent {
  id: string;                 // BetsAPI event ID
  betsapiId: string;          // Same as id (for clarity)
  dbEventId: string | null;   // Our database event ID (set after upsert)
  sportId: number;            // BetsAPI sport_id
  sportSlug: string;
  leagueId: string;
  leagueName: string;
  leagueCountry: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamImageId: string | null;
  awayTeamImageId: string | null;
  homeTeamCountry: string | null;
  awayTeamCountry: string | null;
  homeScore: number;
  awayScore: number;
  ss: string;                 // Raw score string "home-away"
  periodScores: Record<string, { home: number; away: number }>;
  timer: BetsAPITimer | null;
  elapsed: number;            // Total elapsed minutes
  statusShort: string;        // Derived status
  startTime: number;          // Unix timestamp
  bet365Id: string | null;
  isLive: boolean;
  lastUpdated: number;        // Date.now() timestamp
  missCount: number;          // Consecutive polls where event was absent from in-play
}

// ---------------------------------------------------------------------------
// In-Memory Cache
// ---------------------------------------------------------------------------

const eventCache = new Map<string, CachedEvent>();
const activeSports = new Map<string, number>(); // slug -> event count for active sports

// ---------------------------------------------------------------------------
// Rate Limiter
// ---------------------------------------------------------------------------

let requestTimestamps: number[] = [];
let rateLimitCooldownUntil = 0; // timestamp when cooldown expires

function canMakeRequest(): boolean {
  const now = Date.now();
  // Check cooldown from TOO_MANY_REQUESTS
  if (now < rateLimitCooldownUntil) return false;
  // Remove timestamps older than 1 hour
  requestTimestamps = requestTimestamps.filter(t => now - t < 3_600_000);
  // Check both per-minute burst limit and per-hour hard limit
  const lastMinute = requestTimestamps.filter(t => now - t < 60_000).length;
  return lastMinute < MAX_REQUESTS_PER_MINUTE && requestTimestamps.length < MAX_REQUESTS_PER_HOUR;
}

function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

function getAvailableRequestsPerMinute(): number {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(t => now - t < 3_600_000);
  const lastMinute = requestTimestamps.filter(t => now - t < 60_000).length;
  const hourlyRemaining = MAX_REQUESTS_PER_HOUR - requestTimestamps.length;
  const minuteRemaining = MAX_REQUESTS_PER_MINUTE - lastMinute;
  return Math.min(minuteRemaining, hourlyRemaining);
}

// ---------------------------------------------------------------------------
// HTTP Client
// ---------------------------------------------------------------------------

async function fetchBetsAPI(endpoint: string, params: Record<string, string> = {}): Promise<BetsAPIResponse> {
  if (!canMakeRequest()) {
    throw new Error('BetsAPI rate limit reached (55 req/min). Waiting for next window.');
  }

  recordRequest();

  const queryParams = new URLSearchParams({
    token: BETSAPI_TOKEN,
    ...params,
  });

  const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: `${urlObj.pathname}${urlObj.search}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoBet/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as BetsAPIResponse;

          // Detect TOO_MANY_REQUESTS from BetsAPI (HTTP 429 or error in response body)
          if (res.statusCode === 429 || data.includes('TOO_MANY_REQUESTS')) {
            // Set cooldown for 5 minutes — don't make any more requests
            rateLimitCooldownUntil = Date.now() + 5 * 60_000;
            logger.warn({ endpoint, cooldownUntil: new Date(rateLimitCooldownUntil).toISOString() }, 'BetsAPI: TOO_MANY_REQUESTS — cooling down for 5 minutes');
            reject(new Error(`BetsAPI TOO_MANY_REQUESTS for ${endpoint}. Cooling down for 90s.`));
            return;
          }

          if (parsed.success !== 1) {
            reject(new Error(`BetsAPI error for ${endpoint}: success=${parsed.success}, response=${data.substring(0, 300)}`));
            return;
          }

          resolve(parsed);
        } catch {
          reject(new Error(`Failed to parse BetsAPI response from ${endpoint}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err: Error) => {
      reject(new Error(`BetsAPI request failed for ${endpoint}: ${err.message}`));
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`BetsAPI request timeout for ${endpoint}`));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// Fetch In-Play Events for a Sport
// ---------------------------------------------------------------------------

async function fetchInPlayEvents(sportId: number): Promise<BetsAPIEvent[]> {
  try {
    const response = await fetchBetsAPI('/events/inplay', {
      sport_id: sportId.toString(),
    });
    return response.results || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const config = SPORT_ID_TO_CONFIG.get(sportId);
    logger.error({ sportId, sport: config?.slug, error: msg }, 'BetsAPI: Failed to fetch in-play events');
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch Upcoming Events for a Sport (paginated)
// ---------------------------------------------------------------------------

async function fetchUpcomingEvents(
  sportId: number,
  day: string, // YYYYMMDD format
  maxPages: number = 50,
): Promise<BetsAPIEvent[]> {
  const allEvents: BetsAPIEvent[] = [];
  let page = 1;

  while (page <= maxPages) {
    if (!canMakeRequest()) {
      // Wait up to 10 seconds for rate limit to clear, then retry
      logger.debug({ sportId, page }, 'BetsAPI: Rate limit pause during upcoming fetch');
      await new Promise(resolve => setTimeout(resolve, 10_000));
      if (!canMakeRequest()) {
        logger.warn({ sportId, page, fetched: allEvents.length }, 'BetsAPI: Rate limit reached during upcoming fetch, stopping pagination');
        break;
      }
    }

    try {
      const response = await fetchBetsAPI('/events/upcoming', {
        sport_id: sportId.toString(),
        day,
        page: page.toString(),
      });

      const events = response.results || [];
      allEvents.push(...events);

      // Check if there are more pages
      const pager = response.pager;
      if (!pager || page * pager.per_page >= pager.total) {
        break; // No more pages
      }

      page++;

      // Small delay between pages to spread load
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const config = SPORT_ID_TO_CONFIG.get(sportId);
      logger.error({ sportId, sport: config?.slug, day, page, error: msg }, 'BetsAPI: Failed to fetch upcoming events');
      break;
    }
  }

  return allEvents;
}

// ---------------------------------------------------------------------------
// Real Odds Fetching from BetsAPI (Football & Basketball only)
// ---------------------------------------------------------------------------

// Market key mapping for BetsAPI odds response
// Football: 1_1 = 1X2, 1_2 = Asian Handicap, 1_3 = Over/Under, 1_5 = 1H AH, 1_6 = 1H OU, 1_8 = 1H 1X2
// Basketball: 18_1 = ML, 18_2 = Spread, 18_3 = Over/Under, 18_4 = Live ML, 18_5 = Live Spread, 18_6 = Live OU

interface BetsAPIOddsEntry {
  id: string;
  home_od?: string;
  draw_od?: string;
  away_od?: string;
  over_od?: string;
  under_od?: string;
  handicap?: string;
  ss?: string | null;
  time_str?: string | null;
  add_time?: string;
  q?: string; // quarter (basketball)
}

// Cache: betsapiId -> { lastFetched, odds }
const oddsCache = new Map<string, { lastFetched: number; odds: Record<string, BetsAPIOddsEntry[]> }>();
const ODDS_CACHE_TTL = 5_000; // 5 seconds — matches the 5s live sync interval

async function fetchEventOdds(betsapiEventId: string): Promise<Record<string, BetsAPIOddsEntry[]> | null> {
  // Check cache
  const cached = oddsCache.get(betsapiEventId);
  if (cached && Date.now() - cached.lastFetched < ODDS_CACHE_TTL) {
    return cached.odds;
  }

  try {
    const response = await fetchBetsAPI('/v2/event/odds', {
      event_id: betsapiEventId,
    });

    if (!response.results) return null;

    const odds: Record<string, BetsAPIOddsEntry[]> = response.results.odds || {};
    oddsCache.set(betsapiEventId, { lastFetched: Date.now(), odds });
    return odds;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ eventId: betsapiEventId, error: msg }, 'BetsAPI: Failed to fetch real odds');
    return null;
  }
}

// Get the latest odds entry from an array (first element = most recent)
function getLatestOdds(entries: BetsAPIOddsEntry[] | undefined): BetsAPIOddsEntry | null {
  if (!entries || entries.length === 0) return null;
  return entries[0]; // BetsAPI returns newest first
}

/**
 * Fetch real odds from BetsAPI and update the database markets/selections
 * for football and basketball events. Called during live sync and for new events.
 */
async function syncRealOddsForEvent(
  dbEventId: string,
  betsapiEventId: string,
  sportConfig: BetsAPISportConfig,
  isLive: boolean,
): Promise<boolean> {
  if (!sportConfig.hasRealOdds) return false;
  if (!canMakeRequest()) return false; // Don't burn rate limit on odds

  const oddsData = await fetchEventOdds(betsapiEventId);
  if (!oddsData) return false;

  // --- Football Markets ---
  if (sportConfig.slug === 'football') {
    // 1X2 (Full Time Result) — key: 1_1
    const ftResult = getLatestOdds(oddsData['1_1']);
    if (ftResult && ftResult.home_od && ftResult.home_od !== '-') {
      await upsertMarketOdds(dbEventId, '1X2', 'Match Winner', 'MONEYLINE', 1, [
        { name: '1', outcome: 'HOME', odds: parseFloat(ftResult.home_od) },
        { name: 'X', outcome: 'DRAW', odds: parseFloat(ftResult.draw_od || '0') },
        { name: '2', outcome: 'AWAY', odds: parseFloat(ftResult.away_od || '0') },
      ]);
    }

    // Asian Handicap — key: 1_2
    const ah = getLatestOdds(oddsData['1_2']);
    if (ah && ah.home_od && ah.home_od !== '-' && ah.handicap) {
      const hcap = ah.handicap;
      await upsertMarketOdds(dbEventId, `AH${hcap}`, `Asian Handicap ${hcap}`, 'SPREAD', 2, [
        { name: `Home ${hcap}`, outcome: 'HOME', odds: parseFloat(ah.home_od) },
        { name: `Away ${hcap}`, outcome: 'AWAY', odds: parseFloat(ah.away_od || '0') },
      ]);
    }

    // Over/Under — key: 1_3
    const ou = getLatestOdds(oddsData['1_3']);
    if (ou && ou.over_od && ou.over_od !== '-' && ou.handicap) {
      const line = ou.handicap;
      await upsertMarketOdds(dbEventId, `OU${line}`, `Over/Under ${line} Goals`, 'TOTAL', 3, [
        { name: `Over ${line}`, outcome: 'OVER', odds: parseFloat(ou.over_od) },
        { name: `Under ${line}`, outcome: 'UNDER', odds: parseFloat(ou.under_od || '0') },
      ]);
    }

    // 1st Half 1X2 — key: 1_8
    const ht1x2 = getLatestOdds(oddsData['1_8']);
    if (ht1x2 && ht1x2.home_od && ht1x2.home_od !== '-') {
      await upsertMarketOdds(dbEventId, '1H1X2', '1st Half Result', 'MONEYLINE', 4, [
        { name: '1', outcome: 'HOME', odds: parseFloat(ht1x2.home_od) },
        { name: 'X', outcome: 'DRAW', odds: parseFloat(ht1x2.draw_od || '0') },
        { name: '2', outcome: 'AWAY', odds: parseFloat(ht1x2.away_od || '0') },
      ]);
    }

    // 1st Half Asian Handicap — key: 1_5
    const htAh = getLatestOdds(oddsData['1_5']);
    if (htAh && htAh.home_od && htAh.home_od !== '-' && htAh.handicap) {
      const hcap = htAh.handicap;
      await upsertMarketOdds(dbEventId, `1HAH${hcap}`, `1st Half Asian Handicap ${hcap}`, 'SPREAD', 5, [
        { name: `Home ${hcap}`, outcome: 'HOME', odds: parseFloat(htAh.home_od) },
        { name: `Away ${hcap}`, outcome: 'AWAY', odds: parseFloat(htAh.away_od || '0') },
      ]);
    }

    // 1st Half Over/Under — key: 1_6
    const htOu = getLatestOdds(oddsData['1_6']);
    if (htOu && htOu.over_od && htOu.over_od !== '-' && htOu.handicap) {
      const line = htOu.handicap;
      await upsertMarketOdds(dbEventId, `1HOU${line}`, `1st Half Over/Under ${line}`, 'TOTAL', 6, [
        { name: `Over ${line}`, outcome: 'OVER', odds: parseFloat(htOu.over_od) },
        { name: `Under ${line}`, outcome: 'UNDER', odds: parseFloat(htOu.under_od || '0') },
      ]);
    }
  }

  // --- Basketball Markets ---
  if (sportConfig.slug === 'basketball') {
    // Match Winner (Money Line) — key: 18_1
    const ml = getLatestOdds(oddsData['18_1']);
    if (ml && ml.home_od && ml.home_od !== '-') {
      await upsertMarketOdds(dbEventId, 'ML', 'Match Winner', 'MONEYLINE', 1, [
        { name: '1', outcome: 'HOME', odds: parseFloat(ml.home_od) },
        { name: '2', outcome: 'AWAY', odds: parseFloat(ml.away_od || '0') },
      ]);
    }

    // Spread — key: 18_2
    const spread = getLatestOdds(oddsData['18_2']);
    if (spread && spread.home_od && spread.home_od !== '-' && spread.handicap) {
      const hcap = spread.handicap;
      await upsertMarketOdds(dbEventId, `AH${hcap}`, `Spread ${hcap}`, 'SPREAD', 2, [
        { name: `Home ${hcap}`, outcome: 'HOME', odds: parseFloat(spread.home_od) },
        { name: `Away ${hcap}`, outcome: 'AWAY', odds: parseFloat(spread.away_od || '0') },
      ]);
    }

    // Over/Under — key: 18_3
    const ou = getLatestOdds(oddsData['18_3']);
    if (ou && ou.over_od && ou.over_od !== '-' && ou.handicap) {
      const line = ou.handicap;
      await upsertMarketOdds(dbEventId, `OU${line}`, `Over/Under ${line} Points`, 'TOTAL', 3, [
        { name: `Over ${line}`, outcome: 'OVER', odds: parseFloat(ou.over_od) },
        { name: `Under ${line}`, outcome: 'UNDER', odds: parseFloat(ou.under_od || '0') },
      ]);
    }

    // Live quarter markets (only when live)
    if (isLive) {
      // Quarter Winner — key: 18_7
      const qml = getLatestOdds(oddsData['18_7']);
      if (qml && qml.home_od && qml.home_od !== '-') {
        const qLabel = qml.q ? `Q${qml.q}` : 'Q';
        await upsertMarketOdds(dbEventId, `${qLabel}ML`, `${qLabel} Winner`, 'MONEYLINE', 7, [
          { name: '1', outcome: 'HOME', odds: parseFloat(qml.home_od) },
          { name: '2', outcome: 'AWAY', odds: parseFloat(qml.away_od || '0') },
        ]);
      }

      // Quarter Spread — key: 18_8
      const qspread = getLatestOdds(oddsData['18_8']);
      if (qspread && qspread.home_od && qspread.home_od !== '-' && qspread.handicap) {
        const qLabel = qspread.q ? `Q${qspread.q}` : 'Q';
        const hcap = qspread.handicap;
        await upsertMarketOdds(dbEventId, `${qLabel}AH${hcap}`, `${qLabel} Spread ${hcap}`, 'SPREAD', 8, [
          { name: `Home ${hcap}`, outcome: 'HOME', odds: parseFloat(qspread.home_od) },
          { name: `Away ${hcap}`, outcome: 'AWAY', odds: parseFloat(qspread.away_od || '0') },
        ]);
      }

      // Quarter Over/Under — key: 18_9
      const qou = getLatestOdds(oddsData['18_9']);
      if (qou && qou.over_od && qou.over_od !== '-' && qou.handicap) {
        const qLabel = qou.q ? `Q${qou.q}` : 'Q';
        const line = qou.handicap;
        await upsertMarketOdds(dbEventId, `${qLabel}OU${line}`, `${qLabel} Over/Under ${line}`, 'TOTAL', 9, [
          { name: `Over ${line}`, outcome: 'OVER', odds: parseFloat(qou.over_od) },
          { name: `Under ${line}`, outcome: 'UNDER', odds: parseFloat(qou.under_od || '0') },
        ]);
      }
    }
  }

  return true; // Successfully synced at least some odds data
}

/**
 * Upsert a market + selections for a given event.
 * If market already exists, update the odds. If not, create it.
 */
async function upsertMarketOdds(
  eventId: string,
  marketKey: string,
  marketName: string,
  marketType: string,
  sortOrder: number,
  selections: Array<{ name: string; outcome: string; odds: number }>,
): Promise<void> {
  // Filter out invalid odds and clamp to reasonable range
  const validSelections = selections
    .filter(s => s.odds > 1.0 && isFinite(s.odds))
    .map(s => ({ ...s, odds: Math.max(1.02, Math.min(31.0, s.odds)) }));
  if (validSelections.length === 0) return;

  try {
    // Find or create market
    let market = await prisma.market.findFirst({
      where: { eventId, marketKey },
      select: { id: true },
    });

    if (!market) {
      market = await prisma.market.create({
        data: {
          eventId,
          name: marketName,
          marketKey,
          type: marketType as any,
          status: 'OPEN',
          sortOrder,
        },
        select: { id: true },
      });
    }

    // Update each selection
    for (const sel of validSelections) {
      const existing = await prisma.selection.findFirst({
        where: { marketId: market.id, outcome: sel.outcome },
        select: { id: true, odds: true },
      });

      if (existing) {
        const oldOdds = parseFloat(existing.odds.toString());
        if (Math.abs(oldOdds - sel.odds) > 0.001) {
          await prisma.selection.update({
            where: { id: existing.id },
            data: {
              odds: new Prisma.Decimal(sel.odds),
              name: sel.name,
            },
          });

          // Emit odds change via Socket.IO
          try {
            const socketModule = require('../lib/socket.js');
            const io = socketModule.getIO();
            io.of('/live').to(`event:${eventId}`).emit('odds:update', {
              eventId,
              marketKey,
              selectionId: existing.id,
              outcome: sel.outcome,
              oldOdds: oldOdds,
              newOdds: sel.odds,
              direction: sel.odds > oldOdds ? 'up' : 'down',
            });
          } catch { /* Socket not ready */ }
        }
      } else {
        await prisma.selection.create({
          data: {
            marketId: market.id,
            name: sel.name,
            outcome: sel.outcome,
            odds: new Prisma.Decimal(sel.odds),
            status: 'ACTIVE',
          },
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ eventId, marketKey, error: msg }, 'BetsAPI: Failed to upsert market odds');
  }
}

// ---------------------------------------------------------------------------
// Score Parsing
// ---------------------------------------------------------------------------

function parseScore(ss: string | undefined): { home: number; away: number } {
  if (!ss || ss === '') return { home: 0, away: 0 };
  const parts = ss.split('-');
  if (parts.length !== 2) return { home: 0, away: 0 };
  return {
    home: parseInt(parts[0], 10) || 0,
    away: parseInt(parts[1], 10) || 0,
  };
}

function parsePeriodScores(scores: Record<string, BetsAPIPeriodScore> | undefined): Record<string, { home: number; away: number }> {
  if (!scores) return {};
  const result: Record<string, { home: number; away: number }> = {};
  for (const [period, score] of Object.entries(scores)) {
    result[period] = {
      home: parseInt(score.home, 10) || 0,
      away: parseInt(score.away, 10) || 0,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Timer / Elapsed Time Calculation
// ---------------------------------------------------------------------------

function calculateElapsedMinutes(timer: BetsAPITimer | undefined | null, sportSlug: string): number {
  if (!timer) return 0;

  switch (sportSlug) {
    case 'football': {
      // tm = minutes, ts = seconds, ta = added time in stoppage
      const minutes = timer.tm ?? 0;
      const seconds = timer.ts ?? 0;
      const addedTime = timer.ta ?? 0;
      return minutes + Math.floor(seconds / 60) + addedTime;
    }
    case 'basketball': {
      // q = quarter number, tm = minutes, ts = seconds remaining in quarter
      // NBA quarter = 12 min. Calculate elapsed.
      const quarter = timer.q ?? 1;
      const minutesRemaining = timer.tm ?? 0;
      const quarterMinutes = 12;
      const elapsedInQuarter = quarterMinutes - minutesRemaining;
      return ((quarter - 1) * quarterMinutes) + Math.max(0, elapsedInQuarter);
    }
    case 'ice-hockey': {
      // q = period number, tm = minutes, ts = seconds remaining in period
      // Period = 20 min
      const period = timer.q ?? 1;
      const minutesRemaining = timer.tm ?? 0;
      const periodMinutes = 20;
      const elapsedInPeriod = periodMinutes - minutesRemaining;
      return ((period - 1) * periodMinutes) + Math.max(0, elapsedInPeriod);
    }
    case 'tennis': {
      // Tennis doesn't have a meaningful elapsed-minutes concept
      return 0;
    }
    case 'baseball': {
      // Innings: rough estimate, 6 min per half-inning
      const inning = timer.q ?? 1;
      return inning * 6;
    }
    case 'volleyball':
    case 'badminton': {
      // Sets: rough estimate
      const set = timer.q ?? 1;
      return set * 20;
    }
    case 'table-tennis': {
      const set = timer.q ?? 1;
      return set * 5;
    }
    case 'cricket': {
      // Overs: very rough, 4 min per over
      return (timer.tm ?? 0) * 4;
    }
    case 'rugby':
    case 'rugby-league': {
      // Similar to football: 40-min halves
      const minutes = timer.tm ?? 0;
      return minutes;
    }
    case 'handball':
    case 'futsal': {
      // 30-min halves
      const minutes = timer.tm ?? 0;
      return minutes;
    }
    case 'boxing': {
      // Rounds: ~3 min each
      const round = timer.q ?? 1;
      return round * 3;
    }
    case 'water-polo': {
      // 8-min quarters
      const quarter = timer.q ?? 1;
      const minutesRemaining = timer.tm ?? 0;
      return ((quarter - 1) * 8) + Math.max(0, 8 - minutesRemaining);
    }
    case 'field-hockey': {
      // 35-min halves, similar to football
      return timer.tm ?? 0;
    }
    default:
      return timer.tm ?? 0;
  }
}

function deriveStatusShort(timer: BetsAPITimer | undefined | null, sportSlug: string, timeStatus: string): string {
  // time_status: 0=Not Started, 1=InPlay, 2=ToBeFixed, 3=Ended, 4=Postponed, 5=Cancelled, 6=WalkOver, 7=Interrupted, 8=Abandoned, 9=Retired, 10=Suspended
  if (timeStatus !== '1') {
    switch (timeStatus) {
      case '0': return 'NS';
      case '2': return 'TBF';
      case '3': return 'FT';
      case '4': return 'PST';
      case '5': return 'CANC';
      case '6': return 'WO';
      case '7': return 'INT';
      case '8': return 'ABD';
      case '9': return 'RET';
      case '10': return 'SUSP';
      default: return 'NS';
    }
  }

  // In-play: derive period status from timer
  if (!timer) return 'LIVE';

  switch (sportSlug) {
    case 'football': {
      const minutes = parseInt(String(timer.tm), 10) || 0;
      if (minutes <= 45) return '1H';
      if (minutes === 45 && (String(timer.tt) === '0' || parseInt(String(timer.ts), 10) === 0)) return 'HT';
      if (minutes <= 90) return '2H';
      return 'ET';
    }
    case 'basketball': {
      const q = parseInt(String(timer.q), 10) || 1;
      switch (q) {
        case 1: return 'Q1';
        case 2: return 'Q2';
        case 3: return 'Q3';
        case 4: return 'Q4';
        default: return 'OT';
      }
    }
    case 'ice-hockey': {
      const p = parseInt(String(timer.q), 10) || 1;
      switch (p) {
        case 1: return 'P1';
        case 2: return 'P2';
        case 3: return 'P3';
        default: return 'OT';
      }
    }
    case 'tennis':
    case 'table-tennis':
    case 'badminton': {
      const set = parseInt(String(timer.q), 10) || 1;
      return `S${set}`;
    }
    case 'baseball': {
      const inning = parseInt(String(timer.q), 10) || 1;
      return `IN${inning}`;
    }
    case 'volleyball': {
      const set = parseInt(String(timer.q), 10) || 1;
      return `S${set}`;
    }
    case 'cricket': {
      return 'LIVE';
    }
    case 'rugby':
    case 'rugby-league': {
      const minutes = parseInt(String(timer.tm), 10) || 0;
      if (minutes <= 40) return '1H';
      return '2H';
    }
    case 'handball':
    case 'futsal': {
      const minutes = parseInt(String(timer.tm), 10) || 0;
      if (minutes <= 30) return '1H';
      return '2H';
    }
    case 'boxing': {
      const round = parseInt(String(timer.q), 10) || 1;
      return `R${round}`;
    }
    case 'water-polo': {
      const q = parseInt(String(timer.q), 10) || 1;
      return `Q${q}`;
    }
    case 'field-hockey': {
      const minutes = timer.tm ?? 0;
      if (minutes <= 35) return '1H';
      return '2H';
    }
    default:
      return 'LIVE';
  }
}

// ---------------------------------------------------------------------------
// Map BetsAPI time_status to our EventStatus
// ---------------------------------------------------------------------------

function mapTimeStatus(timeStatus: string): { status: 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED'; isLive: boolean } {
  switch (timeStatus) {
    case '0':
      return { status: 'UPCOMING', isLive: false };
    case '1':
      return { status: 'LIVE', isLive: true };
    case '3':
      return { status: 'ENDED', isLive: false };
    case '2': // To be fixed
    case '4': // Postponed
    case '5': // Cancelled
    case '6': // Walkover
    case '7': // Interrupted
    case '8': // Abandoned
    case '9': // Retired
    case '10': // Suspended
      return { status: 'CANCELLED', isLive: false };
    default:
      return { status: 'UPCOMING', isLive: false };
  }
}

// ---------------------------------------------------------------------------
// Sports where BetsAPI team images are known to return 404
// ---------------------------------------------------------------------------

const SPORTS_WITHOUT_TEAM_IMAGES = new Set([
  'table-tennis', 'horse-racing', 'greyhounds', 'badminton', 'lacrosse',
]);

// ---------------------------------------------------------------------------
// Team Image URL Helper
// ---------------------------------------------------------------------------

function getTeamImageUrl(imageId: string | undefined, teamId?: string): string | null {
  // Use image_id if available and non-zero
  if (imageId && imageId !== '0') {
    return `${TEAM_IMAGE_BASE_URL}/${imageId}.png`;
  }
  // Fallback: use team/player ID (works for tennis players, etc.)
  if (teamId && teamId !== '0') {
    return `${TEAM_IMAGE_BASE_URL}/${teamId}.png`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Virtual Sport (eSoccer / eBasketball) Logo Resolution
// ---------------------------------------------------------------------------

/**
 * Common abbreviated team name mappings used in eSoccer/eBasketball.
 * Keys are lowercase. Values are the canonical name used in real football events.
 */
const ESOCCER_NAME_ALIASES: Record<string, string> = {
  'a.madrid': 'Atletico Madrid',
  'atl. madrid': 'Atletico Madrid',
  'a.bilbao': 'Athletic Bilbao',
  'ath. bilbao': 'Athletic Bilbao',
  'man city': 'Manchester City',
  'man utd': 'Manchester United',
  'man united': 'Manchester United',
  'bayer 04': 'Bayer Leverkusen',
  'eintracht': 'Eintracht Frankfurt',
  'sp.lisbon': 'Sporting Lisbon',
  'sporting cp': 'Sporting Lisbon',
  'hertha': 'Hertha Berlin',
  'rb leipzig': 'RB Leipzig',
  'w.bremen': 'Werder Bremen',
  'werder': 'Werder Bremen',
  'int. miami': 'Inter Miami',
  'inter': 'Inter Milan',
  'psv': 'PSV Eindhoven',
  'vfb stuttgart': 'VfB Stuttgart 1893',
  'stuttgart': 'VfB Stuttgart 1893',
  'dortmund': 'Borussia Dortmund',
  'bayern': 'Bayern Munich',
  'rangers': 'Rangers FC',
  'newcastle': 'Newcastle United',
  'west ham': 'West Ham United',
  'galatasaray': 'Galatasaray SK',
  'fiorentina': 'ACF Fiorentina',
  'lazio': 'SS Lazio',
  'roma': 'AS Roma',
  'alanyaspor': 'Alanyaspor',
  'freiburg': 'SC Freiburg',
  'psg': 'Paris Saint-Germain',
  'paris': 'Paris Saint-Germain',
  'braga': 'SC Braga',
  'celta vigo': 'Celta de Vigo',
  'lille': 'Lille OSC',
  'ajax': 'AFC Ajax',
  'chelsea': 'Chelsea FC',
};

/**
 * Check if a competition/league name indicates a virtual sport (eSoccer, eBasketball, Volta).
 */
function isVirtualSport(leagueName: string): boolean {
  const lower = leagueName.toLowerCase();
  return (
    lower.includes('esoccer') ||
    lower.includes('ebasketball') ||
    lower.includes('e-soccer') ||
    lower.includes('e-basketball') ||
    lower.includes('volta') ||
    lower.includes('efootball') ||
    lower.includes('e-football')
  );
}

/**
 * Map eSoccer/virtual sport league names to a live odds engine slug.
 * The liveOddsEngine has configs for "esoccer-short", "esoccer-medium", etc.
 * Falls back to "football" if no specific config exists.
 */
function getVirtualSportOddsSlug(leagueName: string): string {
  const lower = leagueName.toLowerCase();
  if (lower.includes('volta') || lower.includes('6 min')) return 'esoccer-short';
  if (lower.includes('8 min')) return 'esoccer-medium';
  if (lower.includes('10 min') || lower.includes('12 min')) return 'esoccer-long';
  if (lower.includes('ebasketball') || lower.includes('e-basketball')) return 'ebasketball';
  return 'esoccer-medium'; // Default
}

/**
 * Extract the real team name from an eSoccer gamertag-style name.
 * Examples:
 *   "Barcelona (Eros)" -> "Barcelona"
 *   "Real Madrid (Lio) Esports" -> "Real Madrid"
 *   "Man City (Felix)" -> "Man City"
 */
function extractRealTeamName(name: string): string {
  return name
    .replace(/\s*\([\w\s]+\)\s*/g, '') // Remove (gamertag)
    .replace(/\s*Esports?\s*$/i, '')    // Remove trailing "Esports" or "Esport"
    .trim();
}

/**
 * Cache for real team logo lookups to avoid repeated DB queries.
 * Maps lowercase team name -> logo URL or null.
 */
const realTeamLogoCache = new Map<string, string | null>();

/**
 * Look up a real team's logo from the database by searching for non-virtual events
 * where the team name matches. Falls back to ESOCCER_NAME_ALIASES if direct lookup fails.
 */
// Prisma NOT clause to exclude virtual sport competitions from logo lookups
const NOT_VIRTUAL_SPORT = {
  OR: [
    { competition: { name: { contains: 'soccer', mode: 'insensitive' as const } } },
    { competition: { name: { contains: 'ebasketball', mode: 'insensitive' as const } } },
    { competition: { name: { contains: 'efootball', mode: 'insensitive' as const } } },
    { competition: { name: { contains: 'volta', mode: 'insensitive' as const } } },
  ],
};

async function findRealTeamLogo(teamName: string): Promise<string | null> {
  const key = teamName.toLowerCase().trim();
  if (!key) return null;
  if (realTeamLogoCache.has(key)) return realTeamLogoCache.get(key)!;

  // Try direct name first, then alias
  const namesToTry = [teamName];
  const alias = ESOCCER_NAME_ALIASES[key];
  if (alias) namesToTry.push(alias);

  for (const searchName of namesToTry) {
    // Try exact match first (home team)
    let homeMatch = await prisma.event.findFirst({
      where: {
        homeTeam: { equals: searchName, mode: 'insensitive' },
        homeTeamLogo: { not: null },
        NOT: NOT_VIRTUAL_SPORT,
      },
      select: { homeTeamLogo: true },
    });

    if (homeMatch?.homeTeamLogo) {
      realTeamLogoCache.set(key, homeMatch.homeTeamLogo);
      return homeMatch.homeTeamLogo;
    }

    // Try exact match (away team)
    let awayMatch = await prisma.event.findFirst({
      where: {
        awayTeam: { equals: searchName, mode: 'insensitive' },
        awayTeamLogo: { not: null },
        NOT: NOT_VIRTUAL_SPORT,
      },
      select: { awayTeamLogo: true },
    });

    if (awayMatch?.awayTeamLogo) {
      realTeamLogoCache.set(key, awayMatch.awayTeamLogo);
      return awayMatch.awayTeamLogo;
    }

    // Try fuzzy match: "Chelsea" matches "Chelsea (W)", "Chelsea U21", etc.
    homeMatch = await prisma.event.findFirst({
      where: {
        homeTeam: { startsWith: searchName, mode: 'insensitive' },
        homeTeamLogo: { not: null },
        NOT: NOT_VIRTUAL_SPORT,
      },
      select: { homeTeamLogo: true },
      orderBy: { homeTeam: 'asc' }, // prefer shortest/most exact match
    });

    if (homeMatch?.homeTeamLogo) {
      realTeamLogoCache.set(key, homeMatch.homeTeamLogo);
      return homeMatch.homeTeamLogo;
    }

    awayMatch = await prisma.event.findFirst({
      where: {
        awayTeam: { startsWith: searchName, mode: 'insensitive' },
        awayTeamLogo: { not: null },
        NOT: NOT_VIRTUAL_SPORT,
      },
      select: { awayTeamLogo: true },
      orderBy: { awayTeam: 'asc' },
    });

    if (awayMatch?.awayTeamLogo) {
      realTeamLogoCache.set(key, awayMatch.awayTeamLogo);
      return awayMatch.awayTeamLogo;
    }

    // Try contains match as last resort: "Freiburg" matches "SC Freiburg U19"
    if (searchName.length >= 4) {
      homeMatch = await prisma.event.findFirst({
        where: {
          homeTeam: { contains: searchName, mode: 'insensitive' },
          homeTeamLogo: { not: null },
          NOT: NOT_VIRTUAL_SPORT,
        },
        select: { homeTeamLogo: true },
        orderBy: { homeTeam: 'asc' },
      });

      if (homeMatch?.homeTeamLogo) {
        realTeamLogoCache.set(key, homeMatch.homeTeamLogo);
        return homeMatch.homeTeamLogo;
      }

      awayMatch = await prisma.event.findFirst({
        where: {
          awayTeam: { contains: searchName, mode: 'insensitive' },
          awayTeamLogo: { not: null },
          NOT: NOT_VIRTUAL_SPORT,
        },
        select: { awayTeamLogo: true },
        orderBy: { awayTeam: 'asc' },
      });

      if (awayMatch?.awayTeamLogo) {
        realTeamLogoCache.set(key, awayMatch.awayTeamLogo);
        return awayMatch.awayTeamLogo;
      }
    }
  }

  realTeamLogoCache.set(key, null);
  return null;
}

/**
 * Synchronous version for Socket.IO broadcasts — only checks the in-memory cache.
 * By the time we broadcast, upsertEventToDB will have already populated the cache.
 */
function findRealTeamLogoCached(teamName: string): string | null {
  const key = teamName.toLowerCase().trim();
  if (!key) return null;
  return realTeamLogoCache.get(key) ?? null;
}

/**
 * Resolve team logo for a CachedEvent — synchronous, cache-only version for broadcasts.
 */
function resolveTeamLogoSync(
  ev: CachedEvent,
  side: 'home' | 'away',
): string | null {
  if (SPORTS_WITHOUT_TEAM_IMAGES.has(ev.sportSlug)) return null;

  if (isVirtualSport(ev.leagueName)) {
    const rawName = side === 'home' ? ev.homeTeam : ev.awayTeam;
    const realName = extractRealTeamName(rawName);
    return findRealTeamLogoCached(realName);
  }

  const imageId = side === 'home' ? ev.homeTeamImageId : ev.awayTeamImageId;
  const teamId = side === 'home' ? ev.homeTeamId : ev.awayTeamId;
  return getTeamImageUrl(imageId || undefined, teamId || undefined);
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
// Build CachedEvent from BetsAPI event
// ---------------------------------------------------------------------------

function buildCachedEvent(event: BetsAPIEvent): CachedEvent | null {
  const sportId = parseInt(event.sport_id, 10);
  const config = SPORT_ID_TO_CONFIG.get(sportId);
  if (!config) return null;

  const score = parseScore(event.ss);
  const periodScores = parsePeriodScores(event.scores);
  const elapsed = calculateElapsedMinutes(event.timer, config.slug);
  const statusShort = deriveStatusShort(event.timer, config.slug, event.time_status);

  return {
    id: event.id,
    betsapiId: event.id,
    dbEventId: null, // Set after DB upsert
    sportId,
    sportSlug: config.slug,
    leagueId: event.league?.id || '0',
    leagueName: event.league?.name || 'Unknown League',
    leagueCountry: event.league?.cc || null,
    homeTeam: event.home?.name || 'Home',
    awayTeam: event.away?.name || 'Away',
    homeTeamId: event.home?.id || null,
    awayTeamId: event.away?.id || null,
    homeTeamImageId: event.home?.image_id || null,
    awayTeamImageId: event.away?.image_id || null,
    homeTeamCountry: event.home?.cc || null,
    awayTeamCountry: event.away?.cc || null,
    homeScore: score.home,
    awayScore: score.away,
    ss: event.ss || '0-0',
    periodScores,
    timer: event.timer || null,
    elapsed,
    statusShort,
    startTime: parseInt(event.time, 10) || 0,
    bet365Id: event.bet365_id || null,
    isLive: event.time_status === '1',
    lastUpdated: Date.now(),
    missCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Ensure Sport Exists in DB
// ---------------------------------------------------------------------------

async function ensureSport(config: BetsAPISportConfig): Promise<string> {
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
    logger.info({ sportId: sport.id, name: config.name }, 'BetsAPI: Created sport');
  }
  return sport.id;
}

// ---------------------------------------------------------------------------
// Find or Create Competition
// ---------------------------------------------------------------------------

async function findOrCreateCompetition(
  sportDbId: string,
  sportSlug: string,
  league: BetsAPILeague,
): Promise<string> {
  const externalId = `betsapi-${sportSlug}-league-${league.id}`;
  const leagueSlug = slugify(`${sportSlug}-${league.name}-${league.cc || 'intl'}`);

  // 1. Try by externalId
  let competition = await prisma.competition.findFirst({ where: { externalId } });
  if (competition) return competition.id;

  // 2. Try by sportId + slug
  competition = await prisma.competition.findFirst({
    where: { sportId: sportDbId, slug: leagueSlug },
  });
  if (competition) {
    // Attach externalId
    await prisma.competition.update({
      where: { id: competition.id },
      data: { externalId, name: league.name, country: league.cc?.toUpperCase() || null, isActive: true },
    });
    return competition.id;
  }

  // 3. Create new
  competition = await prisma.competition.create({
    data: {
      sportId: sportDbId,
      name: league.name,
      slug: leagueSlug,
      country: league.cc?.toUpperCase() || null,
      externalId,
      isActive: true,
    },
  });

  logger.info({ competitionId: competition.id, name: league.name, sport: sportSlug }, 'BetsAPI: Created competition');
  return competition.id;
}

// ---------------------------------------------------------------------------
// Generate Markets for New Events
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
      return Math.max(1.10, Math.min(15.0, odds));
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

  // Over/Under Market
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
// Upsert Event to Database
// ---------------------------------------------------------------------------

async function upsertEventToDB(
  cached: CachedEvent,
  sportConfig: BetsAPISportConfig,
  timeStatus?: string,
): Promise<{ dbEventId: string; created: boolean; scoreChanged: boolean; marketCount: number }> {
  const externalId = `betsapi:${cached.betsapiId}`;
  // Use the explicit timeStatus if provided, otherwise infer from isLive
  const resolvedTimeStatus = timeStatus ?? (cached.isLive ? '1' : '3');
  const { status: eventStatus, isLive } = mapTimeStatus(resolvedTimeStatus);

  // Build scores JSON
  const scoresObj: Record<string, number> = {
    home: cached.homeScore,
    away: cached.awayScore,
  };
  const scoresJson: Prisma.InputJsonValue = scoresObj as Prisma.InputJsonValue;

  // Build metadata JSON
  const metadataJson: Prisma.InputJsonValue = {
    source: 'betsapi',
    sport: cached.sportSlug,
    betsapiId: cached.betsapiId,
    bet365Id: cached.bet365Id,
    leagueId: cached.leagueId,
    leagueName: cached.leagueName,
    leagueCountry: cached.leagueCountry,
    statusShort: cached.statusShort,
    elapsed: cached.elapsed,
    timer: cached.timer,
    periodScores: cached.periodScores,
    homeTeamImageId: cached.homeTeamImageId,
    awayTeamImageId: cached.awayTeamImageId,
    homeTeamCountry: cached.homeTeamCountry,
    awayTeamCountry: cached.awayTeamCountry,
  } as Prisma.InputJsonValue;

  // Resolve team logos — for virtual sports (eSoccer/eBasketball), look up the
  // real team's logo from our database instead of using BetsAPI's 1x1 pixel GIFs.
  let homeTeamLogo: string | null;
  let awayTeamLogo: string | null;

  if (SPORTS_WITHOUT_TEAM_IMAGES.has(cached.sportSlug)) {
    homeTeamLogo = null;
    awayTeamLogo = null;
  } else if (isVirtualSport(cached.leagueName)) {
    const realHomeName = extractRealTeamName(cached.homeTeam);
    const realAwayName = extractRealTeamName(cached.awayTeam);
    homeTeamLogo = await findRealTeamLogo(realHomeName);
    awayTeamLogo = await findRealTeamLogo(realAwayName);
  } else {
    homeTeamLogo = getTeamImageUrl(cached.homeTeamImageId || undefined, cached.homeTeamId || undefined);
    awayTeamLogo = getTeamImageUrl(cached.awayTeamImageId || undefined, cached.awayTeamId || undefined);
  }

  const eventName = `${cached.homeTeam} vs ${cached.awayTeam}`;
  const startTime = new Date(cached.startTime * 1000);

  // --- Find existing event ---

  // 1. Try by externalId (exact match)
  let existing = await prisma.event.findFirst({
    where: { externalId },
    select: { id: true, status: true, scores: true, homeTeamLogo: true, awayTeamLogo: true },
  });

  // 2. Try fuzzy match: same team names + approximate start time (within 2 hours)
  if (!existing) {
    const windowStart = new Date(startTime.getTime() - 2 * 60 * 60 * 1000);
    const windowEnd = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    existing = await prisma.event.findFirst({
      where: {
        homeTeam: cached.homeTeam,
        awayTeam: cached.awayTeam,
        startTime: { gte: windowStart, lte: windowEnd },
        externalId: { not: { startsWith: 'betsapi:' } },
      },
      select: { id: true, status: true, scores: true, homeTeamLogo: true, awayTeamLogo: true },
    });

    // If found by fuzzy match, update the externalId to claim it for betsapi
    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: { externalId },
      });
      logger.info({
        eventId: existing.id,
        match: eventName,
        externalId,
      }, 'BetsAPI: Claimed existing event via fuzzy match');
    }
  }

  if (existing) {
    // Detect score changes
    const oldScores = existing.scores as Record<string, number> | null;
    const scoreChanged = (
      (oldScores?.home ?? -1) !== cached.homeScore ||
      (oldScores?.away ?? -1) !== cached.awayScore
    );

    // IMMEDIATE Socket.IO emission on score change — don't wait for the batch
    // cycle to complete. This gets the goal/score update to frontends ASAP.
    if (scoreChanged && existing.id) {
      try {
        const socketModule = require('../lib/socket.js');
        const io = socketModule.getIO();
        const liveNsp = io.of('/live');

        // Immediate score:update to event room subscribers
        liveNsp.to(`event:${existing.id}`).emit('score:update', {
          eventId: existing.id,
          scores: { homeScore: cached.homeScore, awayScore: cached.awayScore },
          timestamp: new Date().toISOString(),
        });

        // Immediate live:goal notification to all live subscribers
        liveNsp.emit('live:goal', {
          eventId: existing.id,
          betsapiId: cached.betsapiId,
          homeTeam: cached.homeTeam,
          awayTeam: cached.awayTeam,
          score: `${cached.homeScore}-${cached.awayScore}`,
          timer: cached.timer,
          elapsed: cached.elapsed,
          sport: cached.sportSlug,
          timestamp: new Date().toISOString(),
        });
      } catch { /* Socket not ready yet — will be caught in batch emission */ }
    }

    // Store pre-match odds on first transition to LIVE
    if (isLive && existing.status === 'UPCOMING') {
      const market = await prisma.market.findFirst({
        where: { eventId: existing.id, type: 'MONEYLINE', status: 'OPEN' },
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

    // Update event
    await prisma.event.update({
      where: { id: existing.id },
      data: {
        name: eventName,
        homeTeam: cached.homeTeam,
        awayTeam: cached.awayTeam,
        homeTeamLogo: homeTeamLogo || existing.homeTeamLogo,
        awayTeamLogo: awayTeamLogo || existing.awayTeamLogo,
        startTime,
        status: eventStatus,
        isLive,
        scores: scoresJson,
        metadata: metadataJson,
      },
    });

    // Auto-settle if event just transitioned to ENDED
    if (eventStatus === 'ENDED' && existing.status !== 'ENDED') {
      try { broadcastEventStatus(existing.id, 'ENDED', false); } catch { /* best effort */ }
      betSettlementQueue.add('auto-settle-event', {
        eventId: existing.id,
        eventName,
        score: { home: cached.homeScore, away: cached.awayScore },
      }).catch(() => {});
      logger.info({
        eventId: existing.id,
        match: eventName,
        score: `${cached.homeScore}-${cached.awayScore}`,
      }, 'BetsAPI: Event ended via status update, queued for auto-settlement');
    }

    // Broadcast LIVE status transition
    if (isLive && existing.status === 'UPCOMING') {
      try { broadcastEventStatus(existing.id, 'LIVE', true); } catch { /* best effort */ }
    }

    const mktCount = await prisma.market.count({ where: { eventId: existing.id } });
    return { dbEventId: existing.id, created: false, scoreChanged, marketCount: mktCount };
  }

  // --- Create new event ---
  // Redirect eSoccer/virtual events to the eSoccer sport (not football)
  let sportDbId: string;
  let effectiveSlug: string;
  if (isVirtualSport(cached.leagueName)) {
    const esoccerSport = await prisma.sport.findFirst({ where: { slug: 'esoccer' } });
    if (esoccerSport) {
      sportDbId = esoccerSport.id;
      effectiveSlug = 'esoccer';
    } else {
      sportDbId = await ensureSport(sportConfig);
      effectiveSlug = sportConfig.slug;
    }
  } else {
    sportDbId = await ensureSport(sportConfig);
    effectiveSlug = sportConfig.slug;
  }
  const competitionId = await findOrCreateCompetition(
    sportDbId,
    effectiveSlug,
    { id: cached.leagueId, name: cached.leagueName, cc: cached.leagueCountry || undefined },
  );

  const newEvent = await prisma.event.create({
    data: {
      externalId,
      competitionId,
      name: eventName,
      homeTeam: cached.homeTeam,
      awayTeam: cached.awayTeam,
      homeTeamLogo,
      awayTeamLogo,
      startTime,
      status: eventStatus,
      isLive,
      scores: scoresJson,
      metadata: metadataJson,
    },
  });

  // Generate markets for new event
  const eventIsVirtual = isVirtualSport(cached.leagueName);
  if (sportConfig.hasRealOdds && !eventIsVirtual) {
    // Fetch real odds from BetsAPI for real football/basketball (not eSoccer)
    try {
      await syncRealOddsForEvent(newEvent.id, cached.betsapiId, sportConfig, cached.isLive);
      logger.info({ eventId: newEvent.id, match: eventName, sport: sportConfig.slug }, 'BetsAPI: Synced real odds for new event');
    } catch (oddsErr) {
      const msg = oddsErr instanceof Error ? oddsErr.message : String(oddsErr);
      logger.warn({ eventId: newEvent.id, error: msg }, 'BetsAPI: Real odds fetch failed, falling back to generated');
      // Fallback to generated odds
      try {
        await generateMarketsForEvent(newEvent.id, sportConfig.hasDraws, sportConfig.totalLine, sportConfig.totalLabel);
      } catch { /* ignore */ }
    }
  } else {
    // Generated odds for all other sports + eSoccer/virtual
    try {
      await generateMarketsForEvent(newEvent.id, sportConfig.hasDraws, sportConfig.totalLine, sportConfig.totalLabel);
    } catch (marketErr) {
      const msg = marketErr instanceof Error ? marketErr.message : String(marketErr);
      logger.error({ eventId: newEvent.id, error: msg }, 'BetsAPI: Failed to generate markets');
    }
  }

  logger.info({
    eventId: newEvent.id,
    match: eventName,
    sport: sportConfig.slug,
    league: cached.leagueName,
  }, 'BetsAPI: Created new event');

  return { dbEventId: newEvent.id, created: true, scoreChanged: false, marketCount: 0 };
}

// ---------------------------------------------------------------------------
// Socket.IO Emission Helpers
// ---------------------------------------------------------------------------

function emitSocketUpdates(
  allEvents: CachedEvent[],
  scoreChanges: Array<{ cached: CachedEvent; dbEventId: string }>,
): void {
  let io;
  try {
    // Dynamic import to avoid crash if Socket.IO hasn't been initialized yet
    const socketModule = require('../lib/socket.js');
    io = socketModule.getIO();
  } catch {
    // Socket.IO not initialized — skip emissions
    return;
  }

  const liveNsp = io.of('/live');

  // 1. Broadcast all live events
  const livePayload = allEvents.map(ev => ({
    id: ev.betsapiId,
    dbEventId: ev.dbEventId,
    sport: ev.sportSlug,
    league: ev.leagueName,
    leagueCountry: ev.leagueCountry,
    homeTeam: ev.homeTeam,
    awayTeam: ev.awayTeam,
    homeScore: ev.homeScore,
    awayScore: ev.awayScore,
    ss: ev.ss,
    timer: ev.timer,
    elapsed: ev.elapsed,
    statusShort: ev.statusShort,
    periodScores: ev.periodScores,
    homeTeamLogo: resolveTeamLogoSync(ev, 'home'),
    awayTeamLogo: resolveTeamLogoSync(ev, 'away'),
    homeTeamCountry: ev.homeTeamCountry,
    awayTeamCountry: ev.awayTeamCountry,
    isLive: ev.isLive,
    startTime: ev.startTime,
    bet365Id: ev.bet365Id,
  }));

  liveNsp.emit('live:update', { events: livePayload });

  // 2. Score change events
  for (const { cached, dbEventId } of scoreChanges) {
    // Goal/Score notification
    liveNsp.emit('live:goal', {
      eventId: dbEventId,
      betsapiId: cached.betsapiId,
      homeTeam: cached.homeTeam,
      awayTeam: cached.awayTeam,
      score: `${cached.homeScore}-${cached.awayScore}`,
      timer: cached.timer,
      elapsed: cached.elapsed,
      sport: cached.sportSlug,
    });

    // Per-event room update
    liveNsp.to(`event:${dbEventId}`).emit('event:update', {
      eventId: dbEventId,
      betsapiId: cached.betsapiId,
      homeTeam: cached.homeTeam,
      awayTeam: cached.awayTeam,
      homeScore: cached.homeScore,
      awayScore: cached.awayScore,
      ss: cached.ss,
      timer: cached.timer,
      elapsed: cached.elapsed,
      statusShort: cached.statusShort,
      periodScores: cached.periodScores,
      isLive: cached.isLive,
    });
  }

  // 3. Per-sport room updates
  const sportGroups = new Map<string, typeof livePayload>();
  for (const ev of livePayload) {
    if (!sportGroups.has(ev.sport)) sportGroups.set(ev.sport, []);
    sportGroups.get(ev.sport)!.push(ev);
  }
  for (const [sportSlug, events] of sportGroups) {
    liveNsp.to(`sport:${sportSlug}`).emit('sport:update', { sport: sportSlug, events });
  }
}

// ---------------------------------------------------------------------------
// Polling Logic — Fixed 5-second interval for all sports
// ---------------------------------------------------------------------------

// With the Events API tier ($150/mo, 3600 req/hr = 60 req/min), we can afford
// to poll aggressively. At 55 req/min budget we can cover ~11 sports per 5s cycle,
// which is more than enough for typical live sport coverage.
const LIVE_POLL_INTERVAL_MS = 5_000; // 5 seconds — fast enough for near-real-time scores

function determinePollSchedule(): Array<{ config: BetsAPISportConfig; intervalMs: number }> {
  // Get active sports from cache (sports that currently have live events)
  const activeSlugCounts = new Map<string, number>();
  for (const cached of eventCache.values()) {
    if (cached.isLive) {
      const current = activeSlugCounts.get(cached.sportSlug) || 0;
      activeSlugCounts.set(cached.sportSlug, current + 1);
    }
  }

  // Always include Tier 1 sports (football, basketball, tennis, ice-hockey) even if
  // they have no cached events — they may have new games starting at any time.
  const ALWAYS_POLL_SLUGS = new Set(['football', 'basketball', 'tennis', 'ice-hockey']);

  // Active = has cached live events OR is a tier-1 sport
  const activeSportConfigs = SPORT_CONFIGS
    .filter(cfg => activeSlugCounts.has(cfg.slug) || ALWAYS_POLL_SLUGS.has(cfg.slug))
    .sort((a, b) => a.priority - b.priority);

  // If no active sports, still poll all sports at 5s to discover new live events quickly
  if (activeSportConfigs.length === 0) {
    return SPORT_CONFIGS
      .sort((a, b) => a.priority - b.priority)
      .map(config => ({ config, intervalMs: LIVE_POLL_INTERVAL_MS }));
  }

  // All active sports polled at fixed 5s interval — the per-cycle sport selection
  // in getSportsToPollNow() ensures we stay within rate limits
  return activeSportConfigs.map(config => ({ config, intervalMs: LIVE_POLL_INTERVAL_MS }));
}

// ---------------------------------------------------------------------------
// Determine which sports to poll in this cycle
// ---------------------------------------------------------------------------

const lastPollTime = new Map<string, number>(); // slug -> last poll timestamp

function getSportsToPollNow(): BetsAPISportConfig[] {
  const schedule = determinePollSchedule();
  const now = Date.now();
  const toPoll: BetsAPISportConfig[] = [];

  for (const { config, intervalMs } of schedule) {
    const lastPoll = lastPollTime.get(config.slug) || 0;
    if (now - lastPoll >= intervalMs) {
      toPoll.push(config);
    }
  }

  // If nothing to poll based on schedule but we have budget, do a discovery poll
  if (toPoll.length === 0 && getAvailableRequestsPerMinute() > SPORT_CONFIGS.length) {
    // Periodically check all sports for newly started games (every 60 seconds each)
    for (const config of SPORT_CONFIGS) {
      const lastPoll = lastPollTime.get(config.slug) || 0;
      if (now - lastPoll >= 60_000) {
        toPoll.push(config);
        break; // Only add one discovery poll per cycle
      }
    }
  }

  return toPoll.sort((a, b) => a.priority - b.priority);
}

// ---------------------------------------------------------------------------
// Core: Single Poll Cycle (betsapiLiveSync)
// ---------------------------------------------------------------------------

export async function betsapiLiveSync(): Promise<{ updated: number; goals: number }> {
  let updated = 0;
  let goals = 0;
  const allScoreChanges: Array<{ cached: CachedEvent; dbEventId: string }> = [];

  const sportsToPoll = getSportsToPollNow();

  if (sportsToPoll.length === 0) {
    // Nothing to poll this cycle — still emit cached data to keep frontends fresh.
    // Always broadcast even if empty (frontends use this as a heartbeat).
    const allCached = Array.from(eventCache.values()).filter(ev => ev.isLive);
    emitSocketUpdates(allCached, []);
    return { updated: 0, goals: 0 };
  }

  for (const sportConfig of sportsToPoll) {
    // Check rate limit before each request
    if (!canMakeRequest()) {
      logger.warn({ sport: sportConfig.slug }, 'BetsAPI: Rate limit reached, skipping sport this cycle');
      break;
    }

    lastPollTime.set(sportConfig.slug, Date.now());

    const events = await fetchInPlayEvents(sportConfig.betsapiId);

    // Track active event count for this sport
    activeSports.set(sportConfig.slug, events.length);

    // Track events that disappeared from in-play list.
    // DO NOT settle immediately — the event might reappear on the next poll (API hiccup/pagination).
    // Use a "missCount" approach: only mark as ENDED after 3 consecutive misses (~15 seconds at 5s interval).
    const liveEventIds = new Set(events.map(e => e.id));
    for (const [cacheKey, cached] of eventCache) {
      if (cached.sportSlug === sportConfig.slug && cached.isLive && !liveEventIds.has(cached.id)) {
        // Increment miss counter (how many consecutive polls this event was absent)
        cached.missCount = (cached.missCount || 0) + 1;

        // Only mark as ended after 3+ consecutive misses (avoids false positives from API hiccups)
        if (cached.missCount < 3) {
          logger.debug({
            match: `${cached.homeTeam} vs ${cached.awayTeam}`,
            missCount: cached.missCount,
          }, 'BetsAPI: Event missing from in-play, waiting for confirmation');
          continue; // Skip — wait for more misses before declaring ended
        }

        cached.isLive = false;
        cached.lastUpdated = Date.now();

        // Update DB: mark as ENDED and trigger auto-settlement
        if (cached.dbEventId) {
          try {
            await prisma.event.update({
              where: { id: cached.dbEventId },
              data: { status: 'ENDED', isLive: false },
            });

            // Broadcast status change to connected clients
            try { broadcastEventStatus(cached.dbEventId, 'ENDED', false); } catch { /* best effort */ }

            // Queue auto-settlement (non-blocking)
            betSettlementQueue.add('auto-settle-event', {
              eventId: cached.dbEventId,
              eventName: `${cached.homeTeam} vs ${cached.awayTeam}`,
              score: { home: cached.homeScore, away: cached.awayScore },
            }).catch(() => {});

            logger.info({
              eventId: cached.dbEventId,
              match: `${cached.homeTeam} vs ${cached.awayTeam}`,
              score: `${cached.homeScore}-${cached.awayScore}`,
              missCount: cached.missCount,
            }, 'BetsAPI: Event ended (confirmed absent), queued for auto-settlement');
          } catch {
            // Event may have already been updated or deleted
          }
        }

        // Remove from cache after a short delay (keep for 5 minutes for late updates)
        setTimeout(() => {
          const entry = eventCache.get(cacheKey);
          if (entry && !entry.isLive) {
            eventCache.delete(cacheKey);
          }
        }, 5 * 60 * 1000);
      }
    }

    // Process each live event
    for (const rawEvent of events) {
      const newCached = buildCachedEvent(rawEvent);
      if (!newCached) continue;

      const cacheKey = `${sportConfig.slug}:${rawEvent.id}`;
      const oldCached = eventCache.get(cacheKey);

      // Detect score change
      const scoreChanged = oldCached !== undefined &&
        oldCached.ss !== newCached.ss &&
        oldCached.ss !== '0-0'; // Don't count initial fetch as a "change"

      // Carry forward the dbEventId from old cache if available
      if (oldCached?.dbEventId) {
        newCached.dbEventId = oldCached.dbEventId;
      }

      // Upsert to database
      try {
        const result = await upsertEventToDB(newCached, sportConfig);
        newCached.dbEventId = result.dbEventId;
        updated++;

        // Check both our detection and DB-level score change detection
        const actualScoreChanged = scoreChanged || result.scoreChanged;
        const isNewEvent = !oldCached; // First time seeing this event
        const isVirtual = isVirtualSport(newCached.leagueName);

        // Determine if we need to update odds
        // On score change: always update odds
        // On new event (cold cache / genuinely new): create markets + odds
        // On missing markets: event exists but has no odds yet (e.g. created before odds engine was fixed)
        const hasNoMarkets = result.marketCount === 0;
        const needsOddsUpdate = actualScoreChanged || isNewEvent || hasNoMarkets;

        if (needsOddsUpdate && newCached.dbEventId) {
          if (actualScoreChanged) {
            goals++;
            allScoreChanges.push({ cached: newCached, dbEventId: newCached.dbEventId });
            logger.info({
              match: `${newCached.homeTeam} vs ${newCached.awayTeam}`,
              oldScore: oldCached?.ss || 'N/A',
              newScore: newCached.ss,
              sport: sportConfig.slug,
              elapsed: newCached.elapsed,
            }, 'BetsAPI: Score change detected');
          }

          const isVirtualSportEvent = isVirtual;
          const oddsSlug = isVirtualSportEvent ? getVirtualSportOddsSlug(newCached.leagueName) : sportConfig.slug;

          // For real-odds sports (football/basketball), try API odds on score changes.
          // On cold-cache new events, only use API if we have plenty of budget (>10 req/min left),
          // otherwise fall back to calculated odds to avoid burning API quota on restart.
          if (sportConfig.hasRealOdds && !isVirtualSportEvent) {
            const shouldTryRealOdds = actualScoreChanged || getAvailableRequestsPerMinute() > 10;

            let realOddsSuccess = false;
            if (shouldTryRealOdds) {
              try {
                realOddsSuccess = await syncRealOddsForEvent(newCached.dbEventId, newCached.betsapiId, sportConfig, true);
              } catch (oddsErr) {
                const msg = oddsErr instanceof Error ? oddsErr.message : String(oddsErr);
                logger.warn({ eventId: newCached.dbEventId, error: msg }, 'BetsAPI: Real odds sync failed');
              }
            }

            // Fallback: if API has no odds or we skipped it, use calculated odds from the engine
            if (!realOddsSuccess) {
              try {
                const metadata: Record<string, unknown> = {
                  elapsed: newCached.elapsed,
                  statusShort: newCached.statusShort,
                  timer: newCached.timer,
                  quarter: newCached.timer?.q,
                  period: newCached.timer?.q,
                  periodScores: newCached.periodScores,
                };
                await recalculateLiveOdds(
                  newCached.dbEventId,
                  newCached.homeScore,
                  newCached.awayScore,
                  sportConfig.slug,
                  metadata,
                );
              } catch { /* best effort fallback */ }
            }
          } else {
            // Use calculated odds for non-real-odds sports AND eSoccer/virtual
            try {
              const metadata: Record<string, unknown> = {
                elapsed: newCached.elapsed,
                statusShort: newCached.statusShort,
                timer: newCached.timer,
                quarter: newCached.timer?.q,
                period: newCached.timer?.q,
                periodScores: newCached.periodScores,
              };

              await recalculateLiveOdds(
                newCached.dbEventId,
                newCached.homeScore,
                newCached.awayScore,
                oddsSlug,
                metadata,
              );
            } catch (oddsErr) {
              const msg = oddsErr instanceof Error ? oddsErr.message : String(oddsErr);
              logger.warn({ eventId: newCached.dbEventId, error: msg }, 'BetsAPI: Odds recalculation failed');
            }
          }
        }
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        logger.error({
          match: `${newCached.homeTeam} vs ${newCached.awayTeam}`,
          betsapiId: rawEvent.id,
          error: msg,
        }, 'BetsAPI: Failed to upsert event to DB');
      }

      // Update cache
      eventCache.set(cacheKey, newCached);
    }
  }

  // ALWAYS emit Socket.IO updates after every sync cycle — even if no changes
  // were detected. This keeps frontends fresh and acts as a heartbeat.
  // Score changes are also emitted immediately in upsertEventToDB above,
  // so frontends get a double-push: instant on change + periodic refresh.
  const allLiveEvents = Array.from(eventCache.values()).filter(ev => ev.isLive);
  emitSocketUpdates(allLiveEvents, allScoreChanges);

  if (updated > 0 || goals > 0) {
    const sportSummary: Record<string, number> = {};
    for (const [slug, count] of activeSports) {
      if (count > 0) sportSummary[slug] = count;
    }
    logger.info({
      updated,
      goals,
      totalLive: allLiveEvents.length,
      sports: sportSummary,
      requestsUsed: requestTimestamps.filter(t => Date.now() - t < 60_000).length,
      requestsAvailable: getAvailableRequestsPerMinute(),
    }, 'BetsAPI: Live sync cycle complete');
  }

  return { updated, goals };
}

// ---------------------------------------------------------------------------
// Full Sync: Upcoming Events for All Sports
// ---------------------------------------------------------------------------

// Priority tiers for full sync — sync most popular sports first to stay within budget
const FULL_SYNC_TIER1 = [1, 18, 13, 17]; // football, basketball, tennis, ice-hockey
const FULL_SYNC_TIER2 = [16, 3, 8, 19, 78, 91, 151]; // baseball, cricket, rugby, rugby-league, handball, volleyball, esports
const FULL_SYNC_TIER3 = [9, 92, 94, 83, 84, 107, 110, 90, 89, 98, 75, 2, 4]; // rest

function getUpcomingDays(count: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10).replace(/-/g, '')); // YYYYMMDD
  }
  return days;
}

export async function betsapiFullSync(): Promise<{ totalEvents: number; sports: number }> {
  logger.info('BetsAPI Full Sync: Starting upcoming events sync...');

  // Tier 1 sports get 7 days of events, Tier 2 gets 3 days, Tier 3 gets 2 days
  const DAYS_BY_TIER: Record<string, number> = {};
  for (const id of FULL_SYNC_TIER1) DAYS_BY_TIER[id] = 3;
  for (const id of FULL_SYNC_TIER2) DAYS_BY_TIER[id] = 2;
  for (const id of FULL_SYNC_TIER3) DAYS_BY_TIER[id] = 1;

  let totalEvents = 0;
  let sportsWithEvents = 0;

  // Process sports in priority tiers
  const allTiers = [...FULL_SYNC_TIER1, ...FULL_SYNC_TIER2, ...FULL_SYNC_TIER3];

  for (const sportBetsapiId of allTiers) {
    const sportConfig = SPORT_ID_TO_CONFIG.get(sportBetsapiId);
    if (!sportConfig) continue;

    // Check rate limit — leave at least 5 requests for live sync
    if (getAvailableRequestsPerMinute() < 5) {
      logger.warn({ sport: sportConfig.slug }, 'BetsAPI Full Sync: Rate limit budget low, pausing. Will resume next cycle.');
      // Wait 60 seconds for rate limit window to reset
      await new Promise(resolve => setTimeout(resolve, 62_000));
      // Re-check
      if (getAvailableRequestsPerMinute() < 5) {
        logger.warn('BetsAPI Full Sync: Still rate limited after waiting, stopping this cycle.');
        break;
      }
    }

    let sportEventCount = 0;
    const daysToFetch = DAYS_BY_TIER[sportBetsapiId] || 2;
    const days = getUpcomingDays(daysToFetch);

    for (const day of days) {
      try {
        if (day !== days[0]) {
          // Small delay between day requests
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        const events = await fetchUpcomingEvents(sportBetsapiId, day, 50);

        for (const rawEvent of events) {
          // Skip events that are already live or ended
          if (rawEvent.time_status !== '0') continue;

          const cached = buildCachedEvent(rawEvent);
          if (!cached) continue;

          try {
            const result = await upsertEventToDB(cached, sportConfig, '0');
            sportEventCount++;
            totalEvents++;

            // Skip pre-match odds during full sync to conserve API quota
            // Real odds will be fetched when events go live
          } catch (dbErr) {
            const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            logger.error({
              match: `${cached.homeTeam} vs ${cached.awayTeam}`,
              betsapiId: rawEvent.id,
              error: msg,
            }, 'BetsAPI Full Sync: Failed to upsert upcoming event');
          }
        }

        logger.debug({
          sport: sportConfig.slug,
          day,
          fetched: events.length,
        }, 'BetsAPI Full Sync: Day fetched');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ sport: sportConfig.slug, day, error: msg }, 'BetsAPI Full Sync: Error fetching day events');
      }
    }

    if (sportEventCount > 0) {
      sportsWithEvents++;
      logger.info({
        sport: sportConfig.slug,
        events: sportEventCount,
        days: daysToFetch,
      }, 'BetsAPI Full Sync: Sport synced');
    }

    // Small delay between sports to be respectful to rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Update sport event counts in DB
  try {
    const sportCounts = await prisma.event.groupBy({
      by: ['competitionId'],
      where: { status: { in: ['UPCOMING', 'LIVE'] } },
      _count: { id: true },
    });

    // Get competition -> sport mapping
    const compIds = sportCounts.map(c => c.competitionId);
    if (compIds.length > 0) {
      const competitions = await prisma.competition.findMany({
        where: { id: { in: compIds } },
        select: { id: true, sportId: true },
      });

      const sportEventMap = new Map<string, number>();
      const compToSport = new Map<string, string>();
      for (const comp of competitions) {
        compToSport.set(comp.id, comp.sportId);
      }
      for (const sc of sportCounts) {
        const sportId = compToSport.get(sc.competitionId);
        if (sportId) {
          sportEventMap.set(sportId, (sportEventMap.get(sportId) || 0) + sc._count.id);
        }
      }

      for (const [sportId, count] of sportEventMap) {
        await prisma.sport.update({
          where: { id: sportId },
          data: { eventCount: count },
        }).catch(() => { /* ignore if sport doesn't exist */ });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ error: msg }, 'BetsAPI Full Sync: Failed to update sport event counts');
  }

  logger.info({
    totalEvents,
    sportsWithEvents,
    requestsUsed: requestTimestamps.filter(t => Date.now() - t < 60_000).length,
  }, 'BetsAPI Full Sync: Complete');

  return { totalEvents, sports: sportsWithEvents };
}

// ---------------------------------------------------------------------------
// Full Sync: Startup + 30-minute interval
// ---------------------------------------------------------------------------

let fullSyncTimer: ReturnType<typeof setInterval> | null = null;

export function startBetsAPIFullSync(): void {
  // Run once on startup (with a short delay to let server settle)
  setTimeout(async () => {
    try {
      await betsapiFullSync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'BetsAPI Full Sync: Initial sync failed');
    }
  }, 5_000);

  // Then run every 30 minutes
  fullSyncTimer = setInterval(async () => {
    try {
      await betsapiFullSync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'BetsAPI Full Sync: Periodic sync failed');
    }
  }, 30 * 60 * 1000);

  logger.info('BetsAPI Full Sync: Scheduled (every 30 minutes)');
}

export function stopBetsAPIFullSync(): void {
  if (fullSyncTimer) {
    clearInterval(fullSyncTimer);
    fullSyncTimer = null;
    logger.info('BetsAPI Full Sync: Stopped');
  }
}

// ---------------------------------------------------------------------------
// Polling Loop Control
// ---------------------------------------------------------------------------

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let stopRequested = false;

async function pollLoop(): Promise<void> {
  if (stopRequested || !isRunning) return;

  try {
    await betsapiLiveSync();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, 'BetsAPI: Poll loop error');
  }

  if (stopRequested || !isRunning) return;

  // Fixed 5-second polling interval for all sports — fast enough for near-real-time
  // score updates. With 3600 req/hr budget, we can sustain ~11 sport polls per cycle.
  pollTimer = setTimeout(() => {
    void pollLoop();
  }, LIVE_POLL_INTERVAL_MS);
}

export function startBetsAPILiveSync(): void {
  if (isRunning) {
    logger.warn('BetsAPI: Live sync already running');
    return;
  }

  isRunning = true;
  stopRequested = false;

  logger.info({
    maxReqPerMin: MAX_REQUESTS_PER_MINUTE,
    maxReqPerHour: MAX_REQUESTS_PER_HOUR,
    sports: SPORT_CONFIGS.map(c => `${c.slug}(id=${c.betsapiId})`),
  }, 'BetsAPI: Starting live sync polling loop');

  // Stagger initial polls: spread sports across the first 2 minutes so we don't
  // blast all 24 sports in a single cycle and burn the per-minute quota.
  const now = Date.now();
  const staggerMs = 5_000; // 5 seconds between each sport's first poll
  SPORT_CONFIGS
    .sort((a, b) => a.priority - b.priority)
    .forEach((cfg, idx) => {
      // Tier-1 sports poll immediately, rest are staggered
      const delay = idx < 4 ? 0 : idx * staggerMs;
      lastPollTime.set(cfg.slug, now - 60_000 + delay);
    });

  // Clean up stale LIVE events on startup and every 10 minutes
  void cleanupStaleLiveEvents();
  setInterval(() => void cleanupStaleLiveEvents(), 10 * 60 * 1000);

  // Start immediately
  void pollLoop();
}

/**
 * Mark stale LIVE events as ENDED.
 * Two cleanup strategies:
 * 1. Any LIVE event not updated in the last 10 minutes → ENDED
 *    (the live sync touches every active event every 5 seconds, so 10 min stale = finished)
 * 2. Any LIVE event started > 6 hours ago → ENDED (safety net)
 */
async function cleanupStaleLiveEvents(): Promise<void> {
  try {
    // Strategy 1: Not updated in 10 minutes = no longer reported by BetsAPI = finished
    const staleUpdateTime = new Date(Date.now() - 10 * 60 * 1000);
    const result1 = await prisma.event.updateMany({
      where: {
        status: 'LIVE',
        updatedAt: { lt: staleUpdateTime },
      },
      data: { status: 'ENDED', isLive: false },
    });

    // Strategy 2: Started > 6 hours ago (safety net for extra-long events)
    const staleStartTime = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const result2 = await prisma.event.updateMany({
      where: {
        status: 'LIVE',
        startTime: { lt: staleStartTime },
      },
      data: { status: 'ENDED', isLive: false },
    });

    const total = result1.count + result2.count;
    if (total > 0) {
      logger.info({ staleUpdate: result1.count, staleStart: result2.count }, 'BetsAPI: Cleaned up stale LIVE events -> ENDED');
    }
  } catch (err) {
    logger.error({ err }, 'BetsAPI: Failed to clean up stale LIVE events');
  }
}

export function stopBetsAPILiveSync(): void {
  if (!isRunning) {
    logger.warn('BetsAPI: Live sync not running');
    return;
  }

  stopRequested = true;
  isRunning = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  logger.info({
    cachedEvents: eventCache.size,
    activeSports: Object.fromEntries(activeSports),
  }, 'BetsAPI: Live sync stopped');
}

// ---------------------------------------------------------------------------
// Get Cached Live Events (for frontend API endpoints)
// ---------------------------------------------------------------------------

export function getLiveEvents(): CachedEvent[] {
  return Array.from(eventCache.values())
    .filter(ev => ev.isLive)
    .sort((a, b) => {
      // Sort by sport priority first, then by league, then by start time
      const configA = SLUG_TO_CONFIG.get(a.sportSlug);
      const configB = SLUG_TO_CONFIG.get(b.sportSlug);
      const priorityDiff = (configA?.priority ?? 99) - (configB?.priority ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      const leagueDiff = a.leagueName.localeCompare(b.leagueName);
      if (leagueDiff !== 0) return leagueDiff;
      return a.startTime - b.startTime;
    });
}

// ---------------------------------------------------------------------------
// Utility Exports for Admin / Debugging
// ---------------------------------------------------------------------------

export function getBetsAPISyncStatus(): {
  isRunning: boolean;
  cachedEvents: number;
  liveEvents: number;
  activeSports: Record<string, number>;
  requestsUsedLastMinute: number;
  requestsAvailable: number;
} {
  const sportSummary: Record<string, number> = {};
  for (const [slug, count] of activeSports) {
    sportSummary[slug] = count;
  }

  return {
    isRunning,
    cachedEvents: eventCache.size,
    liveEvents: Array.from(eventCache.values()).filter(ev => ev.isLive).length,
    activeSports: sportSummary,
    requestsUsedLastMinute: requestTimestamps.filter(t => Date.now() - t < 60_000).length,
    requestsAvailable: getAvailableRequestsPerMinute(),
  };
}

export function getLiveEventsBySport(sportSlug: string): CachedEvent[] {
  return Array.from(eventCache.values())
    .filter(ev => ev.isLive && ev.sportSlug === sportSlug)
    .sort((a, b) => {
      const leagueDiff = a.leagueName.localeCompare(b.leagueName);
      if (leagueDiff !== 0) return leagueDiff;
      return a.startTime - b.startTime;
    });
}

export function getLiveEventById(betsapiId: string): CachedEvent | null {
  for (const cached of eventCache.values()) {
    if (cached.betsapiId === betsapiId) return cached;
  }
  return null;
}

export function getLiveEventByDbId(dbEventId: string): CachedEvent | null {
  for (const cached of eventCache.values()) {
    if (cached.dbEventId === dbEventId) return cached;
  }
  return null;
}

export function clearCache(): void {
  eventCache.clear();
  activeSports.clear();
  lastPollTime.clear();
  logger.info('BetsAPI: Cache cleared');
}

// ---------------------------------------------------------------------------
// Outright / Futures Market Generation
// ---------------------------------------------------------------------------

/**
 * Outright market definition: describes a competition-level futures market
 * (e.g. "Premier League Winner", "NBA Championship Winner").
 */
export interface OutrightMarketDef {
  competitionName: string;
  competitionSlug: string;
  sportSlug: string;
  marketName: string;
  marketKey: string;
  selections: Array<{
    name: string;
    odds: number;
  }>;
}

/**
 * Seed data for outright markets organised by sport slug.
 * Each entry lists the competition, the futures market name, and
 * candidate selections with hand-tuned base probabilities.
 */
interface OutrightSeed {
  competitionName: string;
  sportSlug: string;
  markets: Array<{
    marketName: string;
    marketKey: string;
    selections: Array<{ name: string; probability: number }>;
  }>;
}

const OUTRIGHT_SEEDS: OutrightSeed[] = [
  // ─── Football ──────────────────────────────────────────────────────
  {
    competitionName: 'Premier League',
    sportSlug: 'football',
    markets: [
      {
        marketName: 'Premier League Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Manchester City', probability: 0.30 },
          { name: 'Arsenal', probability: 0.25 },
          { name: 'Liverpool', probability: 0.20 },
          { name: 'Chelsea', probability: 0.08 },
          { name: 'Manchester United', probability: 0.05 },
          { name: 'Tottenham Hotspur', probability: 0.04 },
          { name: 'Newcastle United', probability: 0.04 },
          { name: 'Aston Villa', probability: 0.02 },
          { name: 'Brighton', probability: 0.01 },
          { name: 'West Ham United', probability: 0.01 },
        ],
      },
      {
        marketName: 'Premier League Top 4 Finish',
        marketKey: 'OUTRIGHT_TOP4',
        selections: [
          { name: 'Manchester City', probability: 0.88 },
          { name: 'Arsenal', probability: 0.85 },
          { name: 'Liverpool', probability: 0.80 },
          { name: 'Chelsea', probability: 0.55 },
          { name: 'Manchester United', probability: 0.40 },
          { name: 'Tottenham Hotspur', probability: 0.35 },
          { name: 'Newcastle United', probability: 0.30 },
          { name: 'Aston Villa', probability: 0.20 },
        ],
      },
      {
        marketName: 'Premier League Relegation',
        marketKey: 'OUTRIGHT_RELEGATION',
        selections: [
          { name: 'Luton Town', probability: 0.70 },
          { name: 'Sheffield United', probability: 0.65 },
          { name: 'Burnley', probability: 0.60 },
          { name: 'Nottingham Forest', probability: 0.35 },
          { name: 'Everton', probability: 0.30 },
          { name: 'Wolverhampton', probability: 0.20 },
        ],
      },
    ],
  },
  {
    competitionName: 'La Liga',
    sportSlug: 'football',
    markets: [
      {
        marketName: 'La Liga Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Real Madrid', probability: 0.40 },
          { name: 'Barcelona', probability: 0.35 },
          { name: 'Atletico Madrid', probability: 0.12 },
          { name: 'Real Sociedad', probability: 0.05 },
          { name: 'Athletic Bilbao', probability: 0.04 },
          { name: 'Girona', probability: 0.02 },
          { name: 'Villarreal', probability: 0.01 },
          { name: 'Real Betis', probability: 0.01 },
        ],
      },
    ],
  },
  {
    competitionName: 'Champions League',
    sportSlug: 'football',
    markets: [
      {
        marketName: 'Champions League Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Manchester City', probability: 0.18 },
          { name: 'Real Madrid', probability: 0.16 },
          { name: 'Bayern Munich', probability: 0.12 },
          { name: 'Arsenal', probability: 0.10 },
          { name: 'Barcelona', probability: 0.09 },
          { name: 'Inter Milan', probability: 0.07 },
          { name: 'PSG', probability: 0.06 },
          { name: 'Liverpool', probability: 0.06 },
          { name: 'Borussia Dortmund', probability: 0.04 },
          { name: 'Napoli', probability: 0.03 },
          { name: 'Atletico Madrid', probability: 0.03 },
          { name: 'Juventus', probability: 0.02 },
        ],
      },
    ],
  },
  {
    competitionName: 'Bundesliga',
    sportSlug: 'football',
    markets: [
      {
        marketName: 'Bundesliga Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Bayern Munich', probability: 0.50 },
          { name: 'Borussia Dortmund', probability: 0.20 },
          { name: 'RB Leipzig', probability: 0.12 },
          { name: 'Bayer Leverkusen', probability: 0.10 },
          { name: 'Stuttgart', probability: 0.04 },
          { name: 'Eintracht Frankfurt', probability: 0.02 },
          { name: 'Wolfsburg', probability: 0.01 },
          { name: 'Freiburg', probability: 0.01 },
        ],
      },
    ],
  },
  {
    competitionName: 'Serie A',
    sportSlug: 'football',
    markets: [
      {
        marketName: 'Serie A Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Inter Milan', probability: 0.35 },
          { name: 'Juventus', probability: 0.22 },
          { name: 'AC Milan', probability: 0.15 },
          { name: 'Napoli', probability: 0.12 },
          { name: 'Atalanta', probability: 0.06 },
          { name: 'AS Roma', probability: 0.05 },
          { name: 'Lazio', probability: 0.03 },
          { name: 'Fiorentina', probability: 0.02 },
        ],
      },
    ],
  },
  {
    competitionName: 'Ligue 1',
    sportSlug: 'football',
    markets: [
      {
        marketName: 'Ligue 1 Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'PSG', probability: 0.65 },
          { name: 'Monaco', probability: 0.10 },
          { name: 'Marseille', probability: 0.08 },
          { name: 'Lille', probability: 0.06 },
          { name: 'Nice', probability: 0.05 },
          { name: 'Lyon', probability: 0.04 },
          { name: 'Lens', probability: 0.02 },
        ],
      },
    ],
  },
  // ─── Basketball ────────────────────────────────────────────────────
  {
    competitionName: 'NBA',
    sportSlug: 'basketball',
    markets: [
      {
        marketName: 'NBA Championship Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Boston Celtics', probability: 0.18 },
          { name: 'Denver Nuggets', probability: 0.14 },
          { name: 'Milwaukee Bucks', probability: 0.10 },
          { name: 'Philadelphia 76ers', probability: 0.09 },
          { name: 'Phoenix Suns', probability: 0.08 },
          { name: 'LA Lakers', probability: 0.07 },
          { name: 'Golden State Warriors', probability: 0.06 },
          { name: 'LA Clippers', probability: 0.06 },
          { name: 'Dallas Mavericks', probability: 0.05 },
          { name: 'Miami Heat', probability: 0.05 },
          { name: 'Minnesota Timberwolves', probability: 0.04 },
          { name: 'Oklahoma City Thunder', probability: 0.04 },
          { name: 'New York Knicks', probability: 0.02 },
          { name: 'Sacramento Kings', probability: 0.02 },
        ],
      },
      {
        marketName: 'NBA MVP',
        marketKey: 'OUTRIGHT_MVP',
        selections: [
          { name: 'Nikola Jokic', probability: 0.22 },
          { name: 'Luka Doncic', probability: 0.18 },
          { name: 'Giannis Antetokounmpo', probability: 0.14 },
          { name: 'Joel Embiid', probability: 0.12 },
          { name: 'Jayson Tatum', probability: 0.10 },
          { name: 'Shai Gilgeous-Alexander', probability: 0.10 },
          { name: 'LeBron James', probability: 0.05 },
          { name: 'Stephen Curry', probability: 0.05 },
          { name: 'Kevin Durant', probability: 0.04 },
        ],
      },
    ],
  },
  {
    competitionName: 'EuroLeague',
    sportSlug: 'basketball',
    markets: [
      {
        marketName: 'EuroLeague Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Real Madrid', probability: 0.22 },
          { name: 'Olympiacos', probability: 0.16 },
          { name: 'Barcelona', probability: 0.14 },
          { name: 'Fenerbahce', probability: 0.12 },
          { name: 'Panathinaikos', probability: 0.10 },
          { name: 'AS Monaco', probability: 0.08 },
          { name: 'Bayern Munich', probability: 0.06 },
          { name: 'Maccabi Tel Aviv', probability: 0.04 },
          { name: 'Anadolu Efes', probability: 0.04 },
          { name: 'Partizan', probability: 0.04 },
        ],
      },
    ],
  },
  // ─── Tennis ────────────────────────────────────────────────────────
  {
    competitionName: 'ATP Tour',
    sportSlug: 'tennis',
    markets: [
      {
        marketName: 'Australian Open Winner',
        marketKey: 'OUTRIGHT_AO',
        selections: [
          { name: 'Novak Djokovic', probability: 0.22 },
          { name: 'Jannik Sinner', probability: 0.18 },
          { name: 'Carlos Alcaraz', probability: 0.16 },
          { name: 'Daniil Medvedev', probability: 0.10 },
          { name: 'Alexander Zverev', probability: 0.08 },
          { name: 'Andrey Rublev', probability: 0.06 },
          { name: 'Stefanos Tsitsipas', probability: 0.05 },
          { name: 'Holger Rune', probability: 0.04 },
          { name: 'Hubert Hurkacz', probability: 0.03 },
        ],
      },
      {
        marketName: 'French Open Winner',
        marketKey: 'OUTRIGHT_RG',
        selections: [
          { name: 'Carlos Alcaraz', probability: 0.28 },
          { name: 'Novak Djokovic', probability: 0.22 },
          { name: 'Jannik Sinner', probability: 0.14 },
          { name: 'Alexander Zverev', probability: 0.10 },
          { name: 'Daniil Medvedev', probability: 0.06 },
          { name: 'Stefanos Tsitsipas', probability: 0.06 },
          { name: 'Casper Ruud', probability: 0.05 },
          { name: 'Andrey Rublev', probability: 0.04 },
        ],
      },
    ],
  },
  // ─── Ice Hockey ────────────────────────────────────────────────────
  {
    competitionName: 'NHL',
    sportSlug: 'ice-hockey',
    markets: [
      {
        marketName: 'Stanley Cup Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Edmonton Oilers', probability: 0.12 },
          { name: 'Florida Panthers', probability: 0.11 },
          { name: 'Dallas Stars', probability: 0.09 },
          { name: 'Colorado Avalanche', probability: 0.08 },
          { name: 'Vegas Golden Knights', probability: 0.08 },
          { name: 'New York Rangers', probability: 0.07 },
          { name: 'Carolina Hurricanes', probability: 0.07 },
          { name: 'Toronto Maple Leafs', probability: 0.06 },
          { name: 'Boston Bruins', probability: 0.06 },
          { name: 'Winnipeg Jets', probability: 0.05 },
          { name: 'Vancouver Canucks', probability: 0.05 },
          { name: 'Tampa Bay Lightning', probability: 0.04 },
          { name: 'Nashville Predators', probability: 0.04 },
          { name: 'New Jersey Devils', probability: 0.04 },
          { name: 'Minnesota Wild', probability: 0.04 },
        ],
      },
    ],
  },
  // ─── Baseball ──────────────────────────────────────────────────────
  {
    competitionName: 'MLB',
    sportSlug: 'baseball',
    markets: [
      {
        marketName: 'World Series Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Los Angeles Dodgers', probability: 0.14 },
          { name: 'Atlanta Braves', probability: 0.12 },
          { name: 'Houston Astros', probability: 0.10 },
          { name: 'New York Yankees', probability: 0.09 },
          { name: 'Philadelphia Phillies', probability: 0.08 },
          { name: 'Baltimore Orioles', probability: 0.07 },
          { name: 'Texas Rangers', probability: 0.06 },
          { name: 'Tampa Bay Rays', probability: 0.06 },
          { name: 'San Diego Padres', probability: 0.05 },
          { name: 'Milwaukee Brewers', probability: 0.05 },
          { name: 'Arizona Diamondbacks', probability: 0.05 },
          { name: 'Minnesota Twins', probability: 0.04 },
          { name: 'Seattle Mariners', probability: 0.04 },
          { name: 'Toronto Blue Jays', probability: 0.03 },
          { name: 'San Francisco Giants', probability: 0.02 },
        ],
      },
    ],
  },
  // ─── Cricket ───────────────────────────────────────────────────────
  {
    competitionName: 'ICC Cricket World Cup',
    sportSlug: 'cricket',
    markets: [
      {
        marketName: 'Cricket World Cup Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'India', probability: 0.28 },
          { name: 'Australia', probability: 0.22 },
          { name: 'England', probability: 0.15 },
          { name: 'South Africa', probability: 0.10 },
          { name: 'New Zealand', probability: 0.08 },
          { name: 'Pakistan', probability: 0.07 },
          { name: 'West Indies', probability: 0.04 },
          { name: 'Sri Lanka', probability: 0.03 },
          { name: 'Bangladesh', probability: 0.02 },
          { name: 'Afghanistan', probability: 0.01 },
        ],
      },
    ],
  },
  // ─── Rugby ─────────────────────────────────────────────────────────
  {
    competitionName: 'Six Nations',
    sportSlug: 'rugby',
    markets: [
      {
        marketName: 'Six Nations Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'Ireland', probability: 0.30 },
          { name: 'France', probability: 0.25 },
          { name: 'England', probability: 0.18 },
          { name: 'Scotland', probability: 0.12 },
          { name: 'Wales', probability: 0.08 },
          { name: 'Italy', probability: 0.07 },
        ],
      },
    ],
  },
  // ─── Esports ───────────────────────────────────────────────────────
  {
    competitionName: 'League of Legends World Championship',
    sportSlug: 'esports',
    markets: [
      {
        marketName: 'LoL Worlds Winner',
        marketKey: 'OUTRIGHT_WINNER',
        selections: [
          { name: 'T1', probability: 0.22 },
          { name: 'Gen.G', probability: 0.18 },
          { name: 'JDG', probability: 0.14 },
          { name: 'Bilibili Gaming', probability: 0.10 },
          { name: 'Weibo Gaming', probability: 0.08 },
          { name: 'Fnatic', probability: 0.06 },
          { name: 'G2 Esports', probability: 0.06 },
          { name: 'Cloud9', probability: 0.04 },
          { name: 'NRG', probability: 0.04 },
          { name: 'KT Rolster', probability: 0.04 },
          { name: 'MAD Lions', probability: 0.02 },
          { name: 'Team Liquid', probability: 0.02 },
        ],
      },
    ],
  },
];

/**
 * Convert probability to decimal odds with a configurable margin.
 * Ensures the returned odds are never below 1.05.
 */
function probabilityToOdds(probability: number, margin: number = 0.93): number {
  const raw = 1 / (probability / margin);
  const rounded = Math.round(raw * 100) / 100;
  return Math.max(1.05, rounded);
}

/**
 * Generate in-memory outright market definitions.
 * These are not persisted — the service layer reads them and optionally
 * seeds them into the database as OUTRIGHT-type markets.
 *
 * A small random jitter (+/- 5 %) is applied each time so the odds feel
 * dynamic across calls (the results are cached upstream for 5 minutes).
 */
export function generateOutrightMarkets(sportSlug?: string): OutrightMarketDef[] {
  const seeds = sportSlug
    ? OUTRIGHT_SEEDS.filter(s => s.sportSlug === sportSlug)
    : OUTRIGHT_SEEDS;

  const result: OutrightMarketDef[] = [];

  for (const seed of seeds) {
    for (const mkt of seed.markets) {
      const competitionSlug = slugify(`${seed.sportSlug}-${seed.competitionName}`);

      const selections = mkt.selections.map(sel => {
        // Apply small jitter to probability so odds vary across cache windows
        const jitter = 1 + (Math.random() - 0.5) * 0.10; // +/- 5 %
        const adjustedProb = Math.min(0.98, Math.max(0.005, sel.probability * jitter));
        return {
          name: sel.name,
          odds: probabilityToOdds(adjustedProb),
        };
      });

      result.push({
        competitionName: seed.competitionName,
        competitionSlug,
        sportSlug: seed.sportSlug,
        marketName: mkt.marketName,
        marketKey: mkt.marketKey,
        selections,
      });
    }
  }

  return result;
}

/**
 * Persist outright markets into the database for a given sport.
 * Uses upsert logic: skips markets that already exist for the same
 * competition + marketKey combination.
 *
 * Returns the number of markets created.
 */
export async function seedOutrightMarkets(sportSlug?: string): Promise<number> {
  const defs = generateOutrightMarkets(sportSlug);
  let created = 0;

  for (const def of defs) {
    try {
      // Find sport
      const sport = await prisma.sport.findUnique({
        where: { slug: def.sportSlug },
        select: { id: true },
      });
      if (!sport) continue;

      // Find or create competition
      let competition = await prisma.competition.findFirst({
        where: {
          sportId: sport.id,
          name: { contains: def.competitionName, mode: 'insensitive' },
          isActive: true,
        },
        select: { id: true },
      });

      if (!competition) {
        competition = await prisma.competition.create({
          data: {
            sportId: sport.id,
            name: def.competitionName,
            slug: def.competitionSlug,
            isActive: true,
            externalId: `outright-${def.competitionSlug}`,
          },
          select: { id: true },
        });
      }

      // Find or create a placeholder "outright" event for this competition
      const outrightEventExtId = `outright:${def.competitionSlug}`;
      let event = await prisma.event.findFirst({
        where: { externalId: outrightEventExtId },
        select: { id: true },
      });

      if (!event) {
        // Create a far-future event to hold outright markets
        event = await prisma.event.create({
          data: {
            competitionId: competition.id,
            externalId: outrightEventExtId,
            name: `${def.competitionName} - Outrights`,
            homeTeam: null,
            awayTeam: null,
            startTime: new Date('2026-06-30T23:59:59Z'),
            status: 'UPCOMING',
            isLive: false,
            isFeatured: false,
            metadata: { type: 'outright' } as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
      }

      // Check if a market with this key already exists on the event
      const existingMarket = await prisma.market.findFirst({
        where: {
          eventId: event.id,
          marketKey: def.marketKey,
          type: 'OUTRIGHT',
        },
        select: { id: true },
      });
      if (existingMarket) continue;

      // Create market + selections
      const market = await prisma.market.create({
        data: {
          eventId: event.id,
          name: def.marketName,
          marketKey: def.marketKey,
          type: 'OUTRIGHT',
          status: 'OPEN',
          sortOrder: 1,
        },
      });

      await prisma.selection.createMany({
        data: def.selections.map((sel) => ({
          marketId: market.id,
          name: sel.name,
          outcome: sel.name, // For outrights, outcome = selection name
          odds: new Prisma.Decimal(sel.odds),
          status: 'ACTIVE' as const,
        })),
      });

      created++;

      logger.info({
        market: def.marketName,
        competition: def.competitionName,
        sport: def.sportSlug,
        selections: def.selections.length,
      }, 'BetsAPI: Seeded outright market');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({
        market: def.marketName,
        competition: def.competitionName,
        error: msg,
      }, 'BetsAPI: Failed to seed outright market');
    }
  }

  return created;
}
