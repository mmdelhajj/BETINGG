// =============================================================================
// Cloudbet Feed API Integration Service
// Syncs sports, competitions, events, and real odds from Cloudbet into Prisma DB
// API Docs: https://docs.cloudbet.com/docs/api/feed/
// Rate limit: 10 requests/second max
// =============================================================================

import https from 'https';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../middleware/logger.js';
import { betSettlementQueue } from '../queues/index.js';
import { generateRandomScores } from './auto-settlement.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEV_API_KEY =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6IkhKcDkyNnF3ZXBjNnF3LU9rMk4zV05pXzBrRFd6cEdwTzAxNlRJUjdRWDAiLCJ0eXAiOiJKV1QifQ.eyJhY2Nlc3NfdGllciI6InRyYWRpbmciLCJleHAiOjIwNTIwNTE3MzEsImlhdCI6MTczNjY5MTczMSwianRpIjoiODA1NzI5NWMtYjYyMi00MWM2LTkzODktNzE1NzkzYjY3YThhIiwic3ViIjoiNTE1Y2VjMGYtN2U5ZS00ZThmLWFkMmMtY2U4YzUyZTFiNmJmIiwidGVuYW50IjoiY2xvdWRiZXQiLCJ1dWlkIjoiNTE1Y2VjMGYtN2U5ZS00ZThmLWFkMmMtY2U4YzUyZTFiNmJmIn0.lugNbwOIAfmPeKFhJFnemrXaPOHOdMWfqEKOUWbP1yiMhtiUb8vq9l4r-gkCQQCnoKQKuvSe50oHLKtMVc3hPyZ3S1tlh4uzayzGpdQdFOGyVlJgRyg7lKBYFPnjV3YrELN5bHIZKswp8eI-KO-M9XGBbM9G97JqTPjSXy7NSDXCAw5BlTjfj0-mvEwoLCEK1tYECMr9c5wQ4vwkA_ab6-xDfwMekFtqACUAO76vPTWWSu0O0QYowhtPnYk6efs0kPLbRHqCu-YJFIJ6ZOwadqhA3Qob2c2HMloaEZNYsgdLY_QVNQfPUzVhx5g_5akMCnWJ7gckDuKfIm4GazWbKQ';

const API_KEY = process.env.CLOUDBET_API_KEY || DEV_API_KEY;
const BASE_URL = 'https://sports-api.cloudbet.com/pub';
const MAX_REQUESTS_PER_SECOND = 10;
const ODDS_CHANGE_THRESHOLD = 0.001;

// Priority sports for live sync (Cloudbet keys)
const PRIORITY_SPORT_KEYS = [
  'soccer',
  'basketball',
  'tennis',
  'ice-hockey',
  'baseball',
  'american-football',
  'cricket',
  'mma',
  'boxing',
  'volleyball',
  'table-tennis',
  'handball',
];

// Maximum competitions to sync per sport during full sync
const MAX_COMPETITIONS_PER_SPORT = 20;

// ---------------------------------------------------------------------------
// Cloudbet API Response Types
// ---------------------------------------------------------------------------

interface CloudbetSport {
  key: string;
  name: string;
  competitionCount: number;
  eventCount: number;
}

interface CloudbetSportsResponse {
  sports: CloudbetSport[];
}

interface CloudbetTeam {
  name: string;
  key: string;
  abbreviation?: string;
  nationality?: string;
}

interface CloudbetSelection {
  outcome: string;
  params: string;
  marketUrl: string;
  price: number;
  minStake: number;
  maxStake: number;
  probability: number;
  status: string; // SELECTION_ENABLED | SELECTION_DISABLED
  side: string; // BACK | LAY
}

interface CloudbetSubmarket {
  sequence: string;
  selections: CloudbetSelection[];
}

interface CloudbetMarket {
  submarkets: Record<string, CloudbetSubmarket>;
}

interface CloudbetEvent {
  id: number;
  name?: string;
  home: CloudbetTeam | null;
  away: CloudbetTeam | null;
  status: string; // PRE_TRADING | TRADING | TRADING_LIVE | RESULTED
  cutoffTime: string;
  type?: string; // EVENT_TYPE_OUTRIGHT, etc.
  markets?: Record<string, CloudbetMarket>;
  metadata?: Record<string, unknown>;
}

interface CloudbetCompetition {
  key: string;
  name: string;
  events: CloudbetEvent[];
  category?: {
    key: string;
    name: string;
  };
  sport?: {
    key: string;
    name: string;
  };
}

interface CloudbetCompetitionResponse {
  key: string;
  name: string;
  events: CloudbetEvent[];
  category?: {
    key: string;
    name: string;
  };
  sport?: {
    key: string;
    name: string;
  };
}

interface CloudbetEventsResponse {
  events: CloudbetEvent[];
  competition?: {
    key: string;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// Sport Key Mapping (Cloudbet key -> our slug)
// ---------------------------------------------------------------------------

const SPORT_KEY_MAP: Record<string, string> = {
  'soccer': 'football',
  'basketball': 'basketball',
  'tennis': 'tennis',
  'ice-hockey': 'ice-hockey',
  'baseball': 'baseball',
  'american-football': 'american-football',
  'mma': 'mma',
  'boxing': 'boxing',
  'cricket': 'cricket',
  'rugby-union': 'rugby',
  'rugby-league': 'rugby-league',
  'volleyball': 'volleyball',
  'handball': 'handball',
  'table-tennis': 'table-tennis',
  'badminton': 'badminton',
  'darts': 'darts',
  'snooker': 'snooker',
};

// Esports group keys that should all map to "esports"
const ESPORTS_KEYS = [
  'esports',
  'e-soccer',
  'e-basketball',
  'e-ice-hockey',
  'e-tennis',
  'e-baseball',
  'e-cricket',
  'e-volleyball',
  'esports-dota2',
  'esports-lol',
  'esports-csgo',
  'esports-valorant',
  'esports-call-of-duty',
  'esports-overwatch',
  'esports-starcraft',
  'esports-rocket-league',
  'esports-king-of-glory',
  'esports-rainbow-six',
];

/**
 * Maps a Cloudbet sport key to our internal slug.
 */
function mapSportKey(cloudbetKey: string): string {
  if (SPORT_KEY_MAP[cloudbetKey]) {
    return SPORT_KEY_MAP[cloudbetKey];
  }
  if (ESPORTS_KEYS.includes(cloudbetKey) || cloudbetKey.startsWith('esports-') || cloudbetKey.startsWith('e-')) {
    return 'esports';
  }
  return cloudbetKey;
}

/**
 * Maps a Cloudbet sport key to a human-readable name.
 */
function mapSportName(cloudbetKey: string, cloudbetName: string): string {
  const slug = mapSportKey(cloudbetKey);
  const nameOverrides: Record<string, string> = {
    'football': 'Football',
    'basketball': 'Basketball',
    'tennis': 'Tennis',
    'ice-hockey': 'Ice Hockey',
    'baseball': 'Baseball',
    'american-football': 'American Football',
    'mma': 'MMA',
    'boxing': 'Boxing',
    'cricket': 'Cricket',
    'rugby': 'Rugby Union',
    'rugby-league': 'Rugby League',
    'volleyball': 'Volleyball',
    'handball': 'Handball',
    'table-tennis': 'Table Tennis',
    'badminton': 'Badminton',
    'darts': 'Darts',
    'snooker': 'Snooker',
    'esports': 'Esports',
  };
  return nameOverrides[slug] || cloudbetName;
}

/**
 * Maps a Cloudbet sport key to an icon slug.
 */
function mapSportIcon(cloudbetKey: string): string {
  const slug = mapSportKey(cloudbetKey);
  const iconMap: Record<string, string> = {
    'football': 'football',
    'basketball': 'basketball',
    'tennis': 'tennis',
    'ice-hockey': 'hockey',
    'baseball': 'baseball',
    'american-football': 'american-football',
    'mma': 'mma',
    'boxing': 'boxing',
    'cricket': 'cricket',
    'rugby': 'rugby',
    'rugby-league': 'rugby',
    'volleyball': 'volleyball',
    'handball': 'handball',
    'table-tennis': 'table-tennis',
    'badminton': 'badminton',
    'darts': 'darts',
    'snooker': 'snooker',
    'esports': 'esports',
  };
  return iconMap[slug] || slug;
}

// ---------------------------------------------------------------------------
// Market Type Mapping
// ---------------------------------------------------------------------------

/**
 * Derives our MarketType enum from a Cloudbet market key.
 */
function deriveMarketType(marketKey: string): 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'OUTRIGHT' | 'PROP' {
  const lk = marketKey.toLowerCase();
  // Strip sport prefix for matching (e.g., "tennis.winner" -> "winner")
  const stripped = lk.includes('.') ? lk.split('.').slice(1).join('.') : lk;
  if (lk.includes('match_odds') || lk.includes('moneyline') || stripped === 'winner' || stripped.startsWith('winner:') || stripped === 'win' || stripped.startsWith('win:') || stripped === '1x2') return 'MONEYLINE';
  if (lk.includes('asian_handicap') || lk.includes('handicap') || lk.includes('spread')) return 'SPREAD';
  if (lk.includes('total_goals') || lk.includes('totals') || lk.includes('over_under') || stripped.startsWith('total') || stripped.match(/^ou\d/)) return 'TOTAL';
  if (lk.includes('outright')) return 'OUTRIGHT';
  return 'PROP';
}

/**
 * Derives a human-readable market name from its key.
 * e.g. "soccer.match_odds" -> "Match Odds", "soccer.asian_handicap" -> "Asian Handicap"
 */
function deriveMarketName(marketKey: string): string {
  // Remove sport prefix (e.g., "soccer.match_odds" -> "match_odds")
  const parts = marketKey.split('.');
  const rawName = parts.length > 1 ? parts.slice(1).join('.') : marketKey;

  // Convert snake_case to Title Case
  return rawName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Derives the period from a submarket key.
 * e.g. "period=ft" -> "FT", "period=h1" -> "H1", "period=q1" -> "Q1"
 */
function derivePeriod(submarketKey: string): string {
  const match = submarketKey.match(/period=(\w+)/);
  if (match) {
    return match[1].toUpperCase();
  }
  return 'FT';
}

// ---------------------------------------------------------------------------
// Selection Name Mapping
// ---------------------------------------------------------------------------

/**
 * Derives a user-friendly selection name from outcome, params, and event type.
 */
function deriveSelectionName(
  outcome: string,
  params: string,
  isOutright: boolean,
): string {
  if (isOutright) {
    return cleanOutcomeSlug(outcome);
  }

  // Extract clean numeric value from params like "innings=2&team=home&total=239.5"
  const cleanParams = params ? extractParamValue(params) : '';

  switch (outcome.toLowerCase()) {
    case 'home':
      return '1';
    case 'draw':
      return 'X';
    case 'away':
      return '2';
    case 'over':
      return cleanParams ? `Over ${cleanParams}` : 'Over';
    case 'under':
      return cleanParams ? `Under ${cleanParams}` : 'Under';
    case 'yes':
      return 'Yes';
    case 'no':
      return 'No';
    default:
      return cleanParams ? `${outcome} ${cleanParams}` : outcome;
  }
}

/**
 * Extracts the meaningful numeric value from Cloudbet params string.
 * e.g. "innings=2&team=home&total=239.5" -> "239.5"
 *      "2.5" -> "2.5"
 *      "handicap=-1.5" -> "-1.5"
 */
function extractParamValue(params: string): string {
  // If it's already a simple number, return as-is
  if (/^-?\d+(\.\d+)?$/.test(params.trim())) return params.trim();
  // Try to extract total=X or handicap=X or line=X
  const totalMatch = params.match(/(?:total|handicap|line|spread|points)=(-?\d+(?:\.\d+)?)/);
  if (totalMatch) return totalMatch[1];
  // Try to find any number in the string
  const numMatch = params.match(/(-?\d+(?:\.\d+)?)/);
  return numMatch ? numMatch[1] : params;
}

/**
 * Cleans an outright selection outcome slug to a human-readable name.
 * e.g. "s-arsenal-fc" -> "Arsenal FC"
 */
function cleanOutcomeSlug(slug: string): string {
  // Remove the leading "s-" prefix if present
  let cleaned = slug.startsWith('s-') ? slug.slice(2) : slug;
  // Restore dots that Cloudbet encodes as "." in slugs (e.g., "st." stays as "st.")
  // Replace hyphens with spaces and capitalize words
  cleaned = cleaned
    .split('-')
    .map((word) => {
      // Preserve decimal numbers (e.g., "40.5" stays as "40.5")
      if (/^\d+\.\d+$/.test(word)) return word;
      // Preserve abbreviations with dots (e.g., "st." stays as "St.")
      if (word.endsWith('.')) return word.charAt(0).toUpperCase() + word.slice(1);
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  // Fix Cloudbet slug encodings: "dot" -> ".", "comma" -> ","
  cleaned = cleaned.replace(/\bDot\b/g, '.').replace(/\s+\./g, '.').replace(/\.\s+/g, '. ');
  cleaned = cleaned.replace(/\bComma\b/g, ',').replace(/\s+,/g, ',');
  // Fix common abbreviations
  cleaned = cleaned.replace(/\bFc\b/g, 'FC');
  cleaned = cleaned.replace(/\bAfc\b/g, 'AFC');
  cleaned = cleaned.replace(/\bUtd\b/g, 'Utd');
  cleaned = cleaned.replace(/\bCf\b/g, 'CF');
  cleaned = cleaned.replace(/\bSc\b/g, 'SC');
  cleaned = cleaned.replace(/\bUs\b/g, 'US');
  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Event Status Mapping
// ---------------------------------------------------------------------------

/**
 * Maps Cloudbet event status to our EventStatus enum.
 */
function mapEventStatus(cloudbetStatus: string): 'UPCOMING' | 'LIVE' | 'ENDED' {
  switch (cloudbetStatus) {
    case 'PRE_TRADING':
    case 'TRADING':
      return 'UPCOMING';
    case 'TRADING_LIVE':
      return 'LIVE';
    case 'RESULTED':
      return 'ENDED';
    default:
      return 'UPCOMING';
  }
}

/**
 * Maps Cloudbet selection status to our SelectionStatus enum.
 */
function mapSelectionStatus(cloudbetStatus: string): 'ACTIVE' | 'SUSPENDED' {
  return cloudbetStatus === 'SELECTION_ENABLED' ? 'ACTIVE' : 'SUSPENDED';
}

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

const requestTimestamps: number[] = [];

/**
 * Waits until we can make another request without exceeding the rate limit.
 */
async function rateLimitWait(): Promise<void> {
  const now = Date.now();

  // Remove timestamps older than 1 second
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 1000) {
    requestTimestamps.shift();
  }

  // If at limit, wait until the oldest request in the window expires
  if (requestTimestamps.length >= MAX_REQUESTS_PER_SECOND) {
    const waitMs = requestTimestamps[0] + 1000 - now + 10; // +10ms buffer
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }

  requestTimestamps.push(Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// In-Memory Caches
// ---------------------------------------------------------------------------

/** Sport slug -> DB Sport ID cache (avoid repeated DB lookups) */
const sportIdCache: Map<string, string> = new Map();

/** Competition externalId -> DB Competition ID cache */
const competitionIdCache: Map<string, string> = new Map();

// ---------------------------------------------------------------------------
// Sync Status Tracking
// ---------------------------------------------------------------------------

interface CloudbetSyncStatus {
  lastFullSync: Date | null;
  lastLiveSync: Date | null;
  sportCount: number;
  eventCount: number;
  isRunning: boolean;
  lastError: string | null;
}

const syncStatus: CloudbetSyncStatus = {
  lastFullSync: null,
  lastLiveSync: null,
  sportCount: 0,
  eventCount: 0,
  isRunning: false,
  lastError: null,
};

let liveSyncInterval: ReturnType<typeof setInterval> | null = null;
let fullSyncInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// HTTP Client (native https module)
// ---------------------------------------------------------------------------

/**
 * Makes an authenticated GET request to the Cloudbet Feed API.
 * Returns the parsed JSON response.
 */
async function cloudbetFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  await rateLimitWait();

  const queryString = new URLSearchParams(params).toString();
  const path = queryString
    ? `/pub${endpoint}?${queryString}`
    : `/pub${endpoint}`;

  const url = `${BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;

  return new Promise<T>((resolve, reject) => {
    const urlObj = new URL(url);

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: `${urlObj.pathname}${urlObj.search}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': API_KEY,
        'User-Agent': 'CryptoBet/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 429) {
          logger.warn({ endpoint }, 'Cloudbet: Rate limited (HTTP 429)');
          reject(new Error(`Cloudbet rate limited on ${endpoint}`));
          return;
        }

        if (res.statusCode === 404) {
          logger.warn({ endpoint }, 'Cloudbet: Resource not found (HTTP 404)');
          reject(new Error(`Cloudbet resource not found: ${endpoint}`));
          return;
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          logger.warn(
            { endpoint, statusCode: res.statusCode, body: data.substring(0, 300) },
            'Cloudbet: HTTP error',
          );
          reject(new Error(`Cloudbet HTTP ${res.statusCode} for ${endpoint}`));
          return;
        }

        try {
          const parsed = JSON.parse(data) as T;
          resolve(parsed);
        } catch {
          logger.error(
            { endpoint, body: data.substring(0, 200) },
            'Cloudbet: Failed to parse JSON response',
          );
          reject(new Error(`Failed to parse Cloudbet JSON from ${endpoint}`));
        }
      });
    });

    req.on('error', (err: Error) => {
      logger.error({ endpoint, error: err.message }, 'Cloudbet: Request error');
      reject(new Error(`Cloudbet request failed for ${endpoint}: ${err.message}`));
    });

    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error(`Cloudbet request timeout for ${endpoint}`));
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// API Data Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch all sports from Cloudbet.
 */
async function fetchSports(): Promise<CloudbetSport[]> {
  try {
    const response = await cloudbetFetch<CloudbetSportsResponse>('/v2/odds/sports');
    return response.sports || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, 'Cloudbet: Failed to fetch sports');
    return [];
  }
}

/**
 * Fetch a competition with all its events and odds.
 */
async function fetchCompetition(competitionKey: string): Promise<CloudbetCompetitionResponse | null> {
  try {
    const response = await cloudbetFetch<CloudbetCompetitionResponse>(
      `/v2/odds/competitions/${competitionKey}`,
    );
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ competitionKey, error: msg }, 'Cloudbet: Failed to fetch competition');
    return null;
  }
}

/**
 * Fetch live events for a sport.
 */
async function fetchLiveEvents(sportKey: string): Promise<CloudbetEvent[]> {
  try {
    const response = await cloudbetFetch<CloudbetEventsResponse>('/v2/odds/events', {
      sport: sportKey,
      live: 'true',
      limit: '50',
    });
    return response.events || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ sportKey, error: msg }, 'Cloudbet: Failed to fetch live events');
    return [];
  }
}

/**
 * Fetch a single event with specific market keys.
 */
async function fetchEvent(eventId: number, marketKeys?: string): Promise<CloudbetEvent | null> {
  try {
    const params: Record<string, string> = {};
    if (marketKeys) {
      params.markets = marketKeys;
    }
    const response = await cloudbetFetch<CloudbetEvent>(
      `/v2/odds/events/${eventId}`,
      params,
    );
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ eventId, error: msg }, 'Cloudbet: Failed to fetch event');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Database Upsert Helpers
// ---------------------------------------------------------------------------

/**
 * Upserts a Sport record and returns its DB ID.
 * Caches the result in memory to avoid repeated lookups.
 */
async function upsertSport(
  cloudbetKey: string,
  cloudbetName: string,
  eventCount: number,
  sortOrder: number,
): Promise<string> {
  const slug = mapSportKey(cloudbetKey);

  // Check cache first
  const cached = sportIdCache.get(slug);
  if (cached) {
    // Update event count without a full upsert if cached
    try {
      await prisma.sport.update({
        where: { slug },
        data: { eventCount },
      });
    } catch {
      // Ignore - record may have been deleted
    }
    return cached;
  }

  const name = mapSportName(cloudbetKey, cloudbetName);
  const icon = mapSportIcon(cloudbetKey);

  try {
    const sport = await prisma.sport.upsert({
      where: { slug },
      create: {
        name,
        slug,
        icon,
        isActive: true,
        sortOrder,
        eventCount,
      },
      update: {
        eventCount,
        isActive: true,
      },
    });

    sportIdCache.set(slug, sport.id);
    return sport.id;
  } catch (err) {
    // Handle the case where name unique constraint fails (two cloudbet keys map to same slug)
    // Try to find by slug
    const existing = await prisma.sport.findUnique({ where: { slug } });
    if (existing) {
      sportIdCache.set(slug, existing.id);
      await prisma.sport.update({
        where: { slug },
        data: { eventCount: existing.eventCount + eventCount },
      });
      return existing.id;
    }
    throw err;
  }
}

/**
 * Upserts a Competition record and returns its DB ID.
 */
async function upsertCompetition(
  sportId: string,
  competitionKey: string,
  competitionName: string,
  country?: string,
): Promise<string> {
  // Check cache first
  const cached = competitionIdCache.get(competitionKey);
  if (cached) return cached;

  // Generate a slug from the competition key
  const slug = competitionKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  try {
    const competition = await prisma.competition.upsert({
      where: {
        sportId_slug: {
          sportId,
          slug,
        },
      },
      create: {
        sportId,
        name: competitionName,
        slug,
        country: country || null,
        externalId: competitionKey,
        isActive: true,
      },
      update: {
        name: competitionName,
        externalId: competitionKey,
        isActive: true,
      },
    });

    competitionIdCache.set(competitionKey, competition.id);
    return competition.id;
  } catch (err) {
    // If there's a conflict, try to find the existing record
    const existing = await prisma.competition.findFirst({
      where: { externalId: competitionKey },
    });
    if (existing) {
      competitionIdCache.set(competitionKey, existing.id);
      return existing.id;
    }
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ competitionKey, error: msg }, 'Cloudbet: Failed to upsert competition');
    throw err;
  }
}

/**
 * Upserts an Event record and returns its DB ID.
 */
async function upsertEvent(
  competitionId: string,
  cbEvent: CloudbetEvent,
): Promise<string | null> {
  const externalId = String(cbEvent.id);
  const isOutright = cbEvent.type === 'EVENT_TYPE_OUTRIGHT';

  // Determine event name
  let eventName: string;
  let homeTeam: string | null = null;
  let awayTeam: string | null = null;

  if (isOutright) {
    eventName = cbEvent.name || `Outright #${cbEvent.id}`;
  } else if (cbEvent.home && cbEvent.away) {
    homeTeam = cbEvent.home.name;
    awayTeam = cbEvent.away.name;
    eventName = `${homeTeam} vs ${awayTeam}`;
  } else if (cbEvent.name) {
    eventName = cbEvent.name;
  } else {
    eventName = `Event #${cbEvent.id}`;
  }

  const status = mapEventStatus(cbEvent.status);
  const isLive = cbEvent.status === 'TRADING_LIVE';

  // Parse cutoff time
  let startTime: Date;
  try {
    startTime = new Date(cbEvent.cutoffTime);
    if (isNaN(startTime.getTime())) {
      startTime = new Date();
    }
  } catch {
    startTime = new Date();
  }

  // Build enriched metadata with team nationality for flag display
  const enrichedMeta: Record<string, unknown> = {
    ...(cbEvent.metadata || {}),
  };
  if (cbEvent.home?.nationality) enrichedMeta.homeTeamCountry = cbEvent.home.nationality;
  if (cbEvent.away?.nationality) enrichedMeta.awayTeamCountry = cbEvent.away.nationality;
  if (cbEvent.home?.abbreviation) enrichedMeta.homeTeamAbbr = cbEvent.home.abbreviation;
  if (cbEvent.away?.abbreviation) enrichedMeta.awayTeamAbbr = cbEvent.away.abbreviation;
  const metadataVal = Object.keys(enrichedMeta).length > 0
    ? (enrichedMeta as Prisma.InputJsonValue)
    : undefined;

  try {
    // Try to find existing event by externalId
    const existing = await prisma.event.findFirst({
      where: { externalId },
    });

    if (existing) {
      // Detect status transition to ENDED (e.g. UPCOMING/LIVE -> ENDED)
      const previousStatus = existing.status;
      const transitionedToEnded = status === 'ENDED' && previousStatus !== 'ENDED';

      // Prevent downgrading: never revert a LIVE event back to UPCOMING.
      // If the event is already LIVE (e.g. set by our time-based transition)
      // and Cloudbet still reports it as TRADING/PRE_TRADING, keep it LIVE.
      let finalStatus = status;
      let finalIsLive = isLive;
      if (previousStatus === 'LIVE' && status === 'UPCOMING') {
        finalStatus = 'LIVE';
        finalIsLive = true;
      }
      // Also: if the event's startTime has passed and Cloudbet says UPCOMING,
      // force it to LIVE (time-based fallback during sync).
      if (finalStatus === 'UPCOMING' && startTime < new Date()) {
        finalStatus = 'LIVE';
        finalIsLive = true;
      }

      const updated = await prisma.event.update({
        where: { id: existing.id },
        data: {
          name: eventName,
          homeTeam,
          awayTeam,
          startTime,
          status: finalStatus,
          isLive: finalIsLive,
          metadata: metadataVal,
        },
      });

      // When event transitions to ENDED, trigger auto-settlement
      if (transitionedToEnded) {
        try {
          // Try to get sport slug for score generation
          const eventWithSport = await prisma.event.findUnique({
            where: { id: updated.id },
            select: {
              competition: { select: { sport: { select: { slug: true } } } },
            },
          });
          const sportSlug = eventWithSport?.competition?.sport?.slug || 'football';
          const scores = generateRandomScores(sportSlug);

          // Write scores to the event
          await prisma.event.update({
            where: { id: updated.id },
            data: { scores: scores as any },
          });

          // Enqueue settlement job
          await betSettlementQueue.add(
            'auto-settle-event',
            {
              eventId: updated.id,
              eventName,
              score: scores,
              source: 'cloudbet-sync',
            },
            {
              jobId: `cloudbet-settle-${updated.id}-${Date.now()}`,
            },
          );

          logger.info(
            { eventId: updated.id, eventName, scores, previousStatus },
            'Cloudbet: Event transitioned to ENDED, settlement queued',
          );
        } catch (settleErr) {
          const msg = settleErr instanceof Error ? settleErr.message : String(settleErr);
          logger.warn(
            { eventId: updated.id, error: msg },
            'Cloudbet: Failed to queue settlement for ended event',
          );
        }
      }

      return updated.id;
    }

    // For new events: if startTime is in the past and Cloudbet says UPCOMING,
    // create as LIVE instead (time-based fallback).
    let createStatus = status;
    let createIsLive = isLive;
    if (createStatus === 'UPCOMING' && startTime < new Date()) {
      createStatus = 'LIVE';
      createIsLive = true;
    }

    const created = await prisma.event.create({
      data: {
        externalId,
        competitionId,
        name: eventName,
        homeTeam,
        awayTeam,
        startTime,
        status: createStatus,
        isLive: createIsLive,
        metadata: metadataVal,
      },
    });
    return created.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ externalId, error: msg }, 'Cloudbet: Failed to upsert event');
    return null;
  }
}

/**
 * Upserts a Market record and returns its DB ID.
 */
async function upsertMarket(
  eventId: string,
  marketKey: string,
  period: string,
): Promise<string | null> {
  const name = deriveMarketName(marketKey);
  const type = deriveMarketType(marketKey);

  // Create a composite key for this market (marketKey + period for uniqueness)
  const fullMarketKey = period !== 'FT' ? `${marketKey}:${period}` : marketKey;

  try {
    // Find existing market by eventId + marketKey
    const existing = await prisma.market.findFirst({
      where: {
        eventId,
        marketKey: fullMarketKey,
      },
    });

    if (existing) {
      await prisma.market.update({
        where: { id: existing.id },
        data: {
          status: 'OPEN',
        },
      });
      return existing.id;
    }

    const market = await prisma.market.create({
      data: {
        eventId,
        name,
        marketKey: fullMarketKey,
        type,
        period,
        status: 'OPEN',
        sortOrder: deriveMarketSortOrder(type),
      },
    });
    return market.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ eventId, marketKey: fullMarketKey, error: msg }, 'Cloudbet: Failed to upsert market');
    return null;
  }
}

/**
 * Assigns a sort order based on market type for sensible display ordering.
 */
function deriveMarketSortOrder(type: string): number {
  switch (type) {
    case 'MONEYLINE': return 1;
    case 'SPREAD': return 2;
    case 'TOTAL': return 3;
    case 'OUTRIGHT': return 4;
    case 'PROP': return 10;
    default: return 99;
  }
}

/**
 * Upserts a Selection record. Returns true if odds actually changed.
 */
async function upsertSelection(
  marketId: string,
  cbSelection: CloudbetSelection,
  isOutright: boolean,
): Promise<boolean> {
  const outcome = cbSelection.outcome;
  const params = cbSelection.params || null;
  const selectionName = deriveSelectionName(outcome, cbSelection.params, isOutright);
  const status = mapSelectionStatus(cbSelection.status);
  const newOdds = new Prisma.Decimal(cbSelection.price);
  const probability = cbSelection.probability
    ? new Prisma.Decimal(cbSelection.probability)
    : null;
  const maxStake = cbSelection.maxStake
    ? new Prisma.Decimal(cbSelection.maxStake)
    : null;

  // Parse handicap from params for spread/handicap markets
  let handicap: Prisma.Decimal | null = null;
  if (params) {
    const parsed = parseFloat(params);
    if (!isNaN(parsed)) {
      handicap = new Prisma.Decimal(parsed);
    }
  }

  try {
    // Find existing selection by marketId + outcome + params (for handicap markets)
    const whereClause: Prisma.SelectionWhereInput = {
      marketId,
      outcome,
    };
    // For handicap markets, also match on params to distinguish e.g. -1.5 vs -2.5
    if (params) {
      whereClause.params = params;
    } else {
      whereClause.params = null;
    }

    const existing = await prisma.selection.findFirst({
      where: whereClause,
    });

    if (existing) {
      // Never overwrite settled selection statuses (WON, LOST, VOID)
      // These were set by the bet settlement process and should remain permanent
      const isSettled = existing.status === 'WON' || existing.status === 'LOST' || existing.status === 'VOID';
      if (isSettled) {
        return false; // Skip update entirely for settled selections
      }

      // Check if odds actually changed beyond threshold
      const oldOdds = parseFloat(existing.odds.toString());
      const newOddsFloat = cbSelection.price;
      const oddsChanged = Math.abs(oldOdds - newOddsFloat) > ODDS_CHANGE_THRESHOLD;

      await prisma.selection.update({
        where: { id: existing.id },
        data: {
          name: selectionName,
          odds: newOdds,
          probability,
          maxStake,
          handicap,
          params,
          status,
        },
      });

      return oddsChanged;
    }

    // Create new selection
    await prisma.selection.create({
      data: {
        marketId,
        name: selectionName,
        outcome,
        odds: newOdds,
        probability,
        maxStake,
        handicap,
        params,
        status,
      },
    });

    return true; // New selection counts as "changed"
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(
      { marketId, outcome, params, error: msg },
      'Cloudbet: Failed to upsert selection',
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Socket.IO Emission Helper
// ---------------------------------------------------------------------------

/**
 * Tries to emit a Socket.IO odds update event.
 * Fails silently if Socket.IO is not initialized (e.g., during standalone sync).
 */
function emitOddsUpdate(eventId: string, marketKey: string, selections: Array<{
  outcome: string;
  odds: number;
  status: string;
}>): void {
  try {
    const { getIO } = require('../lib/socket.js') as { getIO: () => { of: (ns: string) => { emit: (ev: string, data: unknown) => void } } };
    const io = getIO();
    const liveNsp = io.of('/live');

    liveNsp.emit('odds:update', {
      eventId,
      marketKey,
      selections,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Socket.IO not initialized — ignore silently
  }
}

// ---------------------------------------------------------------------------
// Process Event Markets & Selections
// ---------------------------------------------------------------------------

/**
 * Processes all markets and selections for a single Cloudbet event.
 * Returns the count of selections where odds changed.
 */
async function processEventMarkets(
  dbEventId: string,
  cbEvent: CloudbetEvent,
): Promise<number> {
  if (!cbEvent.markets) return 0;

  const isOutright = cbEvent.type === 'EVENT_TYPE_OUTRIGHT';
  let oddsChangedCount = 0;

  for (const [marketKey, market] of Object.entries(cbEvent.markets)) {
    if (!market.submarkets) continue;

    for (const [submarketKey, submarket] of Object.entries(market.submarkets)) {
      if (!submarket.selections || submarket.selections.length === 0) continue;

      const period = derivePeriod(submarketKey);
      const marketId = await upsertMarket(dbEventId, marketKey, period);
      if (!marketId) continue;

      const changedSelections: Array<{
        outcome: string;
        odds: number;
        status: string;
      }> = [];

      for (const selection of submarket.selections) {
        // Only process BACK side selections (standard odds)
        if (selection.side && selection.side !== 'BACK') continue;
        // Skip selections with invalid prices
        if (!selection.price || selection.price <= 1) continue;

        const changed = await upsertSelection(marketId, selection, isOutright);
        if (changed) {
          oddsChangedCount++;
          changedSelections.push({
            outcome: selection.outcome,
            odds: selection.price,
            status: selection.status,
          });
        }
      }

      // Emit Socket.IO update if any selections changed
      if (changedSelections.length > 0) {
        const fullMarketKey = period !== 'FT' ? `${marketKey}:${period}` : marketKey;
        emitOddsUpdate(dbEventId, fullMarketKey, changedSelections);
      }
    }
  }

  return oddsChangedCount;
}

// ---------------------------------------------------------------------------
// Full Sync
// ---------------------------------------------------------------------------

/**
 * Performs a full synchronization of sports, competitions, events, and odds
 * from the Cloudbet Feed API into the database.
 *
 * Steps:
 * 1. Fetch all sports
 * 2. Upsert each sport in the DB
 * 3. For top competitions per sport, fetch events and odds
 * 4. Upsert competitions, events, markets, and selections
 *
 * Returns sync stats.
 */
export async function cloudbetFullSync(): Promise<{
  sports: number;
  competitions: number;
  events: number;
}> {
  logger.info('Cloudbet: Starting full sync...');
  syncStatus.isRunning = true;

  let sportsCount = 0;
  let competitionsCount = 0;
  let eventsCount = 0;

  try {
    // Step 1: Fetch all sports
    const sports = await fetchSports();
    if (sports.length === 0) {
      logger.warn('Cloudbet: No sports returned from API');
      syncStatus.isRunning = false;
      return { sports: 0, competitions: 0, events: 0 };
    }

    logger.info({ count: sports.length }, 'Cloudbet: Fetched sports');

    // Aggregate esports into a single sport entry
    const aggregated = aggregateSports(sports);

    // Step 2: Upsert each sport and fetch its competitions
    let sortOrder = 1;
    for (const sport of aggregated) {
      if (sport.eventCount === 0) {
        // Skip sports with no events
        continue;
      }

      try {
        const sportId = await upsertSport(
          sport.key,
          sport.name,
          sport.eventCount,
          sortOrder++,
        );
        sportsCount++;

        // Step 3: Fetch top competitions for this sport
        // Use the competitions list from the sport endpoint
        // Cloudbet provides competitions under each sport
        const competitionKeys = await fetchSportCompetitions(sport.key);

        if (competitionKeys.length === 0) {
          logger.debug({ sport: sport.key }, 'Cloudbet: No competitions found for sport');
          continue;
        }

        // Limit to top N competitions
        const topCompetitions = competitionKeys.slice(0, MAX_COMPETITIONS_PER_SPORT);

        for (const compKey of topCompetitions) {
          try {
            // Rate limit delay between competition fetches
            await sleep(120);

            const compData = await fetchCompetition(compKey);
            if (!compData || !compData.events || compData.events.length === 0) {
              continue;
            }

            // Determine country from category if available
            const country = compData.category?.name || null;

            const competitionId = await upsertCompetition(
              sportId,
              compKey,
              compData.name,
              country ?? undefined,
            );
            competitionsCount++;

            // Step 4: Process events for this competition
            for (const cbEvent of compData.events) {
              try {
                const dbEventId = await upsertEvent(competitionId, cbEvent);
                if (!dbEventId) continue;

                await processEventMarkets(dbEventId, cbEvent);
                eventsCount++;
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.warn(
                  { eventId: cbEvent.id, error: msg },
                  'Cloudbet: Error processing event in full sync',
                );
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(
              { competitionKey: compKey, error: msg },
              'Cloudbet: Error processing competition in full sync',
            );
          }
        }

        // Delay between sports to respect rate limits
        await sleep(500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(
          { sport: sport.key, error: msg },
          'Cloudbet: Error processing sport in full sync',
        );
      }
    }

    syncStatus.lastFullSync = new Date();
    syncStatus.sportCount = sportsCount;
    syncStatus.eventCount = eventsCount;
    syncStatus.lastError = null;

    logger.info(
      { sports: sportsCount, competitions: competitionsCount, events: eventsCount },
      'Cloudbet: Full sync completed',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    syncStatus.lastError = msg;
    logger.error({ error: msg }, 'Cloudbet: Full sync failed');
  } finally {
    syncStatus.isRunning = false;
  }

  return { sports: sportsCount, competitions: competitionsCount, events: eventsCount };
}

/**
 * Aggregates multiple esport-related sport entries into a single "esports" entry.
 * Other sports pass through unchanged.
 */
function aggregateSports(sports: CloudbetSport[]): CloudbetSport[] {
  const result: CloudbetSport[] = [];
  let esportsAggregate: CloudbetSport | null = null;

  for (const sport of sports) {
    const slug = mapSportKey(sport.key);

    if (slug === 'esports') {
      if (!esportsAggregate) {
        esportsAggregate = {
          key: 'esports',
          name: 'Esports',
          competitionCount: sport.competitionCount,
          eventCount: sport.eventCount,
        };
      } else {
        esportsAggregate.competitionCount += sport.competitionCount;
        esportsAggregate.eventCount += sport.eventCount;
      }
    } else {
      result.push(sport);
    }
  }

  if (esportsAggregate) {
    result.push(esportsAggregate);
  }

  // Sort by event count descending so high-traffic sports are processed first
  result.sort((a, b) => b.eventCount - a.eventCount);
  return result;
}

/**
 * Fetches the list of competition keys for a given sport.
 * This uses the sports endpoint which lists competitions.
 *
 * Since Cloudbet's /v2/odds/sports returns sports with competition references,
 * we construct competition keys from sport + known patterns.
 * For a more accurate approach, we fetch the sport's detail page.
 */
async function fetchSportCompetitions(sportKey: string): Promise<string[]> {
  try {
    // The Cloudbet API structures competitions under sports.
    // We fetch the sport page which lists available competitions.
    const response = await cloudbetFetch<{
      name: string;
      key: string;
      competitions?: Array<{ key: string; name: string; eventCount?: number }>;
      categories?: Array<{
        key: string;
        name: string;
        competitions?: Array<{ key: string; name: string; eventCount?: number }>;
      }>;
    }>(`/v2/odds/sports/${sportKey}`);

    const competitionKeys: Array<{ key: string; eventCount: number }> = [];

    // Direct competitions on the sport
    if (response.competitions) {
      for (const comp of response.competitions) {
        competitionKeys.push({
          key: comp.key,
          eventCount: comp.eventCount || 0,
        });
      }
    }

    // Competitions nested under categories (common pattern in Cloudbet API)
    if (response.categories) {
      for (const category of response.categories) {
        if (category.competitions) {
          for (const comp of category.competitions) {
            competitionKeys.push({
              key: comp.key,
              eventCount: comp.eventCount || 0,
            });
          }
        }
      }
    }

    // Sort by event count descending, return keys
    competitionKeys.sort((a, b) => b.eventCount - a.eventCount);
    return competitionKeys.map((c) => c.key);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ sportKey, error: msg }, 'Cloudbet: Failed to fetch sport competitions');
    return [];
  }
}

// ---------------------------------------------------------------------------
// Live Sync
// ---------------------------------------------------------------------------

/**
 * Syncs live events and their current odds from Cloudbet.
 *
 * For each priority sport:
 * 1. Fetch live events from /v2/odds/events?sport={key}&live=true
 * 2. Upsert events with status = LIVE
 * 3. Update odds for all selections
 * 4. Emit Socket.IO updates when odds change
 *
 * Returns the number of events updated.
 */
export async function cloudbetLiveSync(): Promise<{ updated: number }> {
  let updatedCount = 0;

  try {
    for (const sportKey of PRIORITY_SPORT_KEYS) {
      try {
        const liveEvents = await fetchLiveEvents(sportKey);
        if (liveEvents.length === 0) continue;

        const sportSlug = mapSportKey(sportKey);

        // Ensure the sport exists in the DB
        let sportId = sportIdCache.get(sportSlug);
        if (!sportId) {
          const dbSport = await prisma.sport.findUnique({ where: { slug: sportSlug } });
          if (dbSport) {
            sportId = dbSport.id;
            sportIdCache.set(sportSlug, sportId);
          } else {
            // Create the sport if it does not exist yet
            sportId = await upsertSport(sportKey, sportKey, 0, 99);
          }
        }

        for (const cbEvent of liveEvents) {
          try {
            const externalId = String(cbEvent.id);

            // Find existing event by externalId
            let dbEvent = await prisma.event.findFirst({
              where: { externalId },
              include: { competition: true },
            });

            if (!dbEvent) {
              // Event not in DB yet — we need a competition for it
              // Use a generic "Live" competition for this sport
              const liveCompKey = `${sportKey}-live`;
              const liveCompId = await upsertCompetition(
                sportId,
                liveCompKey,
                `${mapSportName(sportKey, sportKey)} - Live`,
              );

              const dbEventId = await upsertEvent(liveCompId, cbEvent);
              if (!dbEventId) continue;

              dbEvent = await prisma.event.findUnique({
                where: { id: dbEventId },
                include: { competition: true },
              }) as typeof dbEvent;
              if (!dbEvent) continue;
            } else {
              // Update existing event to LIVE status
              await prisma.event.update({
                where: { id: dbEvent.id },
                data: {
                  status: 'LIVE',
                  isLive: true,
                },
              });
            }

            // Process markets and selections
            const changedCount = await processEventMarkets(dbEvent.id, cbEvent);
            if (changedCount > 0) {
              updatedCount++;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(
              { eventId: cbEvent.id, sport: sportKey, error: msg },
              'Cloudbet: Error processing live event',
            );
          }
        }

        // Small delay between sports
        await sleep(100);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(
          { sport: sportKey, error: msg },
          'Cloudbet: Error fetching live events for sport',
        );
      }
    }

    syncStatus.lastLiveSync = new Date();
    syncStatus.lastError = null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    syncStatus.lastError = msg;
    logger.error({ error: msg }, 'Cloudbet: Live sync failed');
  }

  return { updated: updatedCount };
}

// ---------------------------------------------------------------------------
// Periodic Sync Controllers
// ---------------------------------------------------------------------------

/**
 * Starts periodic live sync every 15 seconds.
 * If already running, does nothing.
 */
export function startCloudbetLiveSync(): void {
  if (liveSyncInterval) {
    logger.info('Cloudbet: Live sync already running');
    return;
  }

  logger.info('Cloudbet: Starting periodic live sync (every 15s)');

  // Run immediately, then every 15 seconds
  void cloudbetLiveSync();
  liveSyncInterval = setInterval(() => {
    void cloudbetLiveSync().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Cloudbet: Periodic live sync error');
    });
  }, 15_000);
}

/**
 * Stops periodic live sync.
 */
export function stopCloudbetLiveSync(): void {
  if (liveSyncInterval) {
    clearInterval(liveSyncInterval);
    liveSyncInterval = null;
    logger.info('Cloudbet: Stopped periodic live sync');
  }
}

/**
 * Starts periodic full sync every 10 minutes.
 * If already running, does nothing.
 */
export function startCloudbetFullSync(): void {
  if (fullSyncInterval) {
    logger.info('Cloudbet: Full sync already running');
    return;
  }

  logger.info('Cloudbet: Starting periodic full sync (every 10min)');

  // Run immediately, then every 10 minutes
  void cloudbetFullSync();
  fullSyncInterval = setInterval(() => {
    void cloudbetFullSync().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ error: msg }, 'Cloudbet: Periodic full sync error');
    });
  }, 10 * 60_000);
}

/**
 * Stops periodic full sync.
 */
export function stopCloudbetFullSync(): void {
  if (fullSyncInterval) {
    clearInterval(fullSyncInterval);
    fullSyncInterval = null;
    logger.info('Cloudbet: Stopped periodic full sync');
  }
}

// ---------------------------------------------------------------------------
// Sync Status
// ---------------------------------------------------------------------------

/**
 * Returns current sync status information.
 */
export function getCloudbetSyncStatus(): CloudbetSyncStatus {
  return { ...syncStatus };
}

// ---------------------------------------------------------------------------
// Exports (default object for convenience)
// ---------------------------------------------------------------------------

export default {
  cloudbetFullSync,
  cloudbetLiveSync,
  startCloudbetLiveSync,
  stopCloudbetLiveSync,
  startCloudbetFullSync,
  stopCloudbetFullSync,
  getCloudbetSyncStatus,
};
