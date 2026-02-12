import { redis, getCache, setCache } from '../../lib/redis';
import {
  OddsApiSport,
  OddsApiEvent,
  OddsApiScore,
  OddsApiEventBasic,
  OddsApiConfig,
  CreditUsage,
  FetchOddsOptions,
} from './types';

// ─── Cache Keys ──────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'odds-api';
const CACHE_SPORTS_KEY = `${CACHE_PREFIX}:sports`;
const CACHE_ODDS_KEY = (sportKey: string) => `${CACHE_PREFIX}:odds:${sportKey}`;
const CACHE_EVENTS_KEY = (sportKey: string) => `${CACHE_PREFIX}:events:${sportKey}`;
const CACHE_SCORES_KEY = (sportKey: string) => `${CACHE_PREFIX}:scores:${sportKey}`;
const CREDITS_KEY = `${CACHE_PREFIX}:credits`;

// ─── Cache TTLs (seconds) ───────────────────────────────────────────────────

const TTL_SPORTS = 3600;       // 1 hour
const TTL_ODDS = 300;          // 5 minutes
const TTL_EVENTS = 600;        // 10 minutes
const TTL_SCORES = 120;        // 2 minutes

// ─── Default Config ─────────────────────────────────────────────────────────

function getConfig(): OddsApiConfig {
  const apiKey = process.env.ODDS_API_KEY || '';
  return {
    apiKey,
    baseUrl: 'https://api.the-odds-api.com/v4',
    margin: parseFloat(process.env.ODDS_API_MARGIN || '5'),
    syncIntervalMinutes: parseInt(process.env.ODDS_API_SYNC_INTERVAL_MINUTES || '15', 10),
    monthlyBudget: parseInt(process.env.ODDS_API_MONTHLY_BUDGET || '500', 10),
    mockMode: !apiKey || apiKey === 'YOUR_API_KEY_HERE',
  };
}

// ─── Credit Tracking ────────────────────────────────────────────────────────

async function getCreditUsage(): Promise<CreditUsage> {
  const config = getConfig();
  const raw = await getCache<CreditUsage>(CREDITS_KEY);

  if (raw) {
    // Check if we need to reset for a new month
    const lastReset = new Date(raw.lastResetDate);
    const now = new Date();
    if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
      const fresh: CreditUsage = {
        used: 0,
        remaining: config.monthlyBudget,
        monthlyBudget: config.monthlyBudget,
        lastResetDate: now.toISOString(),
        lastFetchDate: null,
      };
      // Store with no expiry (30 days max)
      await setCache(CREDITS_KEY, fresh, 30 * 24 * 3600);
      return fresh;
    }
    return raw;
  }

  const fresh: CreditUsage = {
    used: 0,
    remaining: config.monthlyBudget,
    monthlyBudget: config.monthlyBudget,
    lastResetDate: new Date().toISOString(),
    lastFetchDate: null,
  };
  await setCache(CREDITS_KEY, fresh, 30 * 24 * 3600);
  return fresh;
}

async function recordCreditUsage(creditsUsed: number): Promise<CreditUsage> {
  const usage = await getCreditUsage();
  const updated: CreditUsage = {
    ...usage,
    used: usage.used + creditsUsed,
    remaining: Math.max(0, usage.remaining - creditsUsed),
    lastFetchDate: new Date().toISOString(),
  };
  await setCache(CREDITS_KEY, updated, 30 * 24 * 3600);
  return updated;
}

async function hasCreditsAvailable(needed: number): Promise<boolean> {
  const usage = await getCreditUsage();
  return usage.remaining >= needed;
}

// ─── HTTP Fetch Helper ──────────────────────────────────────────────────────

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const config = getConfig();

  if (config.mockMode) {
    throw new Error('MOCK_MODE: The Odds API key is not configured. Using mock data.');
  }

  const url = new URL(`${config.baseUrl}${path}`);
  url.searchParams.set('apiKey', config.apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000), // 15 second timeout
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');

    if (response.status === 401) {
      throw new Error(`ODDS_API_AUTH_ERROR: Invalid API key. Status: ${response.status}`);
    }
    if (response.status === 429) {
      throw new Error(`ODDS_API_RATE_LIMIT: Rate limited. Please wait before retrying. Status: ${response.status}`);
    }
    if (response.status === 422) {
      throw new Error(`ODDS_API_VALIDATION: Invalid request parameters. Body: ${errorBody}`);
    }
    throw new Error(`ODDS_API_ERROR: HTTP ${response.status} - ${errorBody}`);
  }

  // Track remaining credits from response headers
  const remainingHeader = response.headers.get('x-requests-remaining');
  const usedHeader = response.headers.get('x-requests-used');
  if (remainingHeader !== null && usedHeader !== null) {
    const config = getConfig();
    const used = parseInt(usedHeader, 10);
    const remaining = parseInt(remainingHeader, 10);
    if (!isNaN(used) && !isNaN(remaining)) {
      const updated: CreditUsage = {
        used,
        remaining,
        monthlyBudget: config.monthlyBudget,
        lastResetDate: (await getCreditUsage()).lastResetDate,
        lastFetchDate: new Date().toISOString(),
      };
      await setCache(CREDITS_KEY, updated, 30 * 24 * 3600);
    }
  }

  return response.json() as Promise<T>;
}

// ─── Public API Client ──────────────────────────────────────────────────────

export class OddsApiClient {
  /**
   * Fetch available sports from The Odds API.
   * FREE - does not cost any credits.
   * Cached for 1 hour.
   */
  async fetchSports(): Promise<OddsApiSport[]> {
    const config = getConfig();

    // Check cache first
    const cached = await getCache<OddsApiSport[]>(CACHE_SPORTS_KEY);
    if (cached) {
      return cached;
    }

    if (config.mockMode) {
      const mockSports = generateMockSports();
      await setCache(CACHE_SPORTS_KEY, mockSports, TTL_SPORTS);
      return mockSports;
    }

    try {
      const sports = await apiFetch<OddsApiSport[]>('/sports');
      await setCache(CACHE_SPORTS_KEY, sports, TTL_SPORTS);
      return sports;
    } catch (error) {
      console.error('[OddsApiClient] Failed to fetch sports:', (error as Error).message);
      // Return mock data as fallback
      const mockSports = generateMockSports();
      await setCache(CACHE_SPORTS_KEY, mockSports, TTL_SPORTS);
      return mockSports;
    }
  }

  /**
   * Fetch odds for a specific sport.
   * COSTS CREDITS: 1 credit per region per market.
   * Cached for 5 minutes.
   */
  async fetchOdds(sportKey: string, options: FetchOddsOptions = {}): Promise<OddsApiEvent[]> {
    const config = getConfig();
    const cacheKey = CACHE_ODDS_KEY(sportKey);

    // Check cache first
    const cached = await getCache<OddsApiEvent[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (config.mockMode) {
      const mockEvents = generateMockOddsEvents(sportKey);
      await setCache(cacheKey, mockEvents, TTL_ODDS);
      return mockEvents;
    }

    // Calculate credits needed: 1 per region per market
    const regions = (options.regions || 'eu').split(',');
    const markets = (options.markets || 'h2h').split(',');
    const creditsNeeded = regions.length * markets.length;

    const hasCredits = await hasCreditsAvailable(creditsNeeded);
    if (!hasCredits) {
      console.warn(`[OddsApiClient] Insufficient credits for ${sportKey}. Need ${creditsNeeded}, falling back to mock data.`);
      const mockEvents = generateMockOddsEvents(sportKey);
      await setCache(cacheKey, mockEvents, TTL_ODDS);
      return mockEvents;
    }

    try {
      const events = await apiFetch<OddsApiEvent[]>(`/sports/${sportKey}/odds`, {
        regions: options.regions || 'eu',
        markets: options.markets || 'h2h',
        oddsFormat: options.oddsFormat || 'decimal',
        dateFormat: options.dateFormat || 'iso',
      });

      await recordCreditUsage(creditsNeeded);
      await setCache(cacheKey, events, TTL_ODDS);

      console.log(`[OddsApiClient] Fetched ${events.length} events for ${sportKey} (${creditsNeeded} credits used)`);
      return events;
    } catch (error) {
      console.error(`[OddsApiClient] Failed to fetch odds for ${sportKey}:`, (error as Error).message);
      const mockEvents = generateMockOddsEvents(sportKey);
      await setCache(cacheKey, mockEvents, TTL_ODDS);
      return mockEvents;
    }
  }

  /**
   * Fetch scores for a specific sport.
   * FREE - does not cost any credits.
   * Cached for 2 minutes.
   */
  async fetchScores(sportKey: string): Promise<OddsApiScore[]> {
    const config = getConfig();
    const cacheKey = CACHE_SCORES_KEY(sportKey);

    const cached = await getCache<OddsApiScore[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (config.mockMode) {
      const mockScores = generateMockScores(sportKey);
      await setCache(cacheKey, mockScores, TTL_SCORES);
      return mockScores;
    }

    try {
      const scores = await apiFetch<OddsApiScore[]>(`/sports/${sportKey}/scores`, {
        daysFrom: '1',
      });
      await setCache(cacheKey, scores, TTL_SCORES);
      return scores;
    } catch (error) {
      console.error(`[OddsApiClient] Failed to fetch scores for ${sportKey}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Fetch upcoming events for a specific sport.
   * FREE - does not cost any credits.
   * Cached for 10 minutes.
   */
  async fetchEvents(sportKey: string): Promise<OddsApiEventBasic[]> {
    const config = getConfig();
    const cacheKey = CACHE_EVENTS_KEY(sportKey);

    const cached = await getCache<OddsApiEventBasic[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (config.mockMode) {
      const mockEvents = generateMockBasicEvents(sportKey);
      await setCache(cacheKey, mockEvents, TTL_EVENTS);
      return mockEvents;
    }

    try {
      const events = await apiFetch<OddsApiEventBasic[]>(`/sports/${sportKey}/events`);
      await setCache(cacheKey, events, TTL_EVENTS);
      return events;
    } catch (error) {
      console.error(`[OddsApiClient] Failed to fetch events for ${sportKey}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * Get the current credit usage information.
   */
  async getCreditUsage(): Promise<CreditUsage> {
    return getCreditUsage();
  }

  /**
   * Check if we are in mock mode (no API key configured).
   */
  isMockMode(): boolean {
    return getConfig().mockMode;
  }

  /**
   * Get the configured margin percentage.
   */
  getMarginPercent(): number {
    return getConfig().margin;
  }

  /**
   * Invalidate all caches.
   */
  async invalidateCache(): Promise<void> {
    const keys = await redis.keys(`${CACHE_PREFIX}:*`);
    if (keys.length > 0) {
      // Don't delete credit tracking
      const nonCreditKeys = keys.filter((k) => k !== CREDITS_KEY);
      if (nonCreditKeys.length > 0) {
        await redis.del(...nonCreditKeys);
      }
    }
  }
}

// ─── Mock Data Generators ───────────────────────────────────────────────────

function generateMockSports(): OddsApiSport[] {
  return [
    { key: 'soccer_epl', group: 'Soccer', title: 'EPL', description: 'English Premier League', active: true, has_outrights: true },
    { key: 'soccer_uefa_champions_league', group: 'Soccer', title: 'UEFA Champions League', description: 'UEFA Champions League', active: true, has_outrights: true },
    { key: 'soccer_spain_la_liga', group: 'Soccer', title: 'La Liga - Spain', description: 'Spanish La Liga', active: true, has_outrights: true },
    { key: 'soccer_germany_bundesliga', group: 'Soccer', title: 'Bundesliga - Germany', description: 'German Bundesliga', active: true, has_outrights: true },
    { key: 'soccer_italy_serie_a', group: 'Soccer', title: 'Serie A - Italy', description: 'Italian Serie A', active: true, has_outrights: true },
    { key: 'basketball_nba', group: 'Basketball', title: 'NBA', description: 'US Basketball', active: true, has_outrights: true },
    { key: 'basketball_euroleague', group: 'Basketball', title: 'Basketball Euroleague', description: 'Basketball Euroleague', active: true, has_outrights: false },
    { key: 'americanfootball_nfl', group: 'American Football', title: 'NFL', description: 'US Football', active: true, has_outrights: true },
    { key: 'icehockey_nhl', group: 'Ice Hockey', title: 'NHL', description: 'US Ice Hockey', active: true, has_outrights: true },
    { key: 'baseball_mlb', group: 'Baseball', title: 'MLB', description: 'Major League Baseball', active: true, has_outrights: true },
    { key: 'mma_mixed_martial_arts', group: 'Mixed Martial Arts', title: 'MMA', description: 'Mixed Martial Arts', active: true, has_outrights: false },
    { key: 'tennis_atp_french_open', group: 'Tennis', title: 'ATP French Open', description: 'ATP French Open', active: true, has_outrights: true },
  ];
}

function generateMockTeams(sportKey: string): Array<{ home: string; away: string }> {
  const teamsByKey: Record<string, Array<{ home: string; away: string }>> = {
    soccer_epl: [
      { home: 'Arsenal', away: 'Chelsea' },
      { home: 'Manchester City', away: 'Liverpool' },
      { home: 'Tottenham', away: 'Manchester United' },
      { home: 'Newcastle United', away: 'Aston Villa' },
      { home: 'Brighton', away: 'West Ham' },
    ],
    soccer_uefa_champions_league: [
      { home: 'Real Madrid', away: 'Bayern Munich' },
      { home: 'Barcelona', away: 'Paris Saint-Germain' },
      { home: 'Inter Milan', away: 'Borussia Dortmund' },
      { home: 'Arsenal', away: 'Atletico Madrid' },
    ],
    soccer_spain_la_liga: [
      { home: 'Real Madrid', away: 'Barcelona' },
      { home: 'Atletico Madrid', away: 'Sevilla' },
      { home: 'Real Sociedad', away: 'Athletic Bilbao' },
    ],
    soccer_germany_bundesliga: [
      { home: 'Bayern Munich', away: 'Borussia Dortmund' },
      { home: 'RB Leipzig', away: 'Bayer Leverkusen' },
      { home: 'Eintracht Frankfurt', away: 'VfB Stuttgart' },
    ],
    soccer_italy_serie_a: [
      { home: 'Inter Milan', away: 'AC Milan' },
      { home: 'Juventus', away: 'Napoli' },
      { home: 'AS Roma', away: 'Lazio' },
    ],
    basketball_nba: [
      { home: 'Los Angeles Lakers', away: 'Boston Celtics' },
      { home: 'Golden State Warriors', away: 'Milwaukee Bucks' },
      { home: 'Denver Nuggets', away: 'Phoenix Suns' },
      { home: 'Philadelphia 76ers', away: 'Miami Heat' },
      { home: 'Dallas Mavericks', away: 'New York Knicks' },
    ],
    basketball_euroleague: [
      { home: 'Real Madrid', away: 'Barcelona' },
      { home: 'Olympiacos', away: 'Fenerbahce' },
    ],
    americanfootball_nfl: [
      { home: 'Kansas City Chiefs', away: 'San Francisco 49ers' },
      { home: 'Buffalo Bills', away: 'Dallas Cowboys' },
      { home: 'Philadelphia Eagles', away: 'Detroit Lions' },
      { home: 'Baltimore Ravens', away: 'Miami Dolphins' },
    ],
    icehockey_nhl: [
      { home: 'Edmonton Oilers', away: 'Florida Panthers' },
      { home: 'New York Rangers', away: 'Dallas Stars' },
      { home: 'Boston Bruins', away: 'Colorado Avalanche' },
    ],
    baseball_mlb: [
      { home: 'Los Angeles Dodgers', away: 'New York Yankees' },
      { home: 'Houston Astros', away: 'Atlanta Braves' },
      { home: 'Texas Rangers', away: 'Philadelphia Phillies' },
    ],
    mma_mixed_martial_arts: [
      { home: 'Fighter A', away: 'Fighter B' },
      { home: 'Fighter C', away: 'Fighter D' },
    ],
    tennis_atp_french_open: [
      { home: 'Player A', away: 'Player B' },
      { home: 'Player C', away: 'Player D' },
    ],
  };

  return teamsByKey[sportKey] || [
    { home: 'Team A', away: 'Team B' },
    { home: 'Team C', away: 'Team D' },
  ];
}

/**
 * Generate realistic-looking mock odds between bookmaker ranges.
 * Uses a seeded-like approach based on team names for consistency.
 */
function generateMockH2hOdds(isThreeWay: boolean): Array<{ name: string; price: number }[]> {
  const bookmakers: Array<{ name: string; price: number }[]> = [];

  for (let b = 0; b < 3; b++) {
    const outcomes: { name: string; price: number }[] = [];

    if (isThreeWay) {
      // Soccer: home/draw/away
      const homeBase = 1.5 + Math.random() * 3.5;
      const drawBase = 2.8 + Math.random() * 1.5;
      // Calculate away to make it roughly realistic
      const homeProb = 1 / homeBase;
      const drawProb = 1 / drawBase;
      const remainingProb = Math.max(0.05, 1 - homeProb - drawProb) + 0.03; // add some vig
      const awayBase = 1 / remainingProb;

      outcomes.push({ name: 'Home', price: parseFloat(homeBase.toFixed(2)) });
      outcomes.push({ name: 'Draw', price: parseFloat(drawBase.toFixed(2)) });
      outcomes.push({ name: 'Away', price: parseFloat(Math.max(1.1, awayBase).toFixed(2)) });
    } else {
      // Two-way: home/away
      const homeBase = 1.3 + Math.random() * 3;
      const homeProb = 1 / homeBase;
      const awayProb = (1 - homeProb) + 0.03; // add vig
      const awayBase = 1 / awayProb;

      outcomes.push({ name: 'Home', price: parseFloat(homeBase.toFixed(2)) });
      outcomes.push({ name: 'Away', price: parseFloat(Math.max(1.1, awayBase).toFixed(2)) });
    }

    bookmakers.push(outcomes);
  }

  return bookmakers;
}

function generateMockSpreads(homeTeam: string, awayTeam: string): Array<{ key: string; last_update: string; outcomes: Array<{ name: string; price: number; point?: number }> }[]> {
  const bookmakerMarkets: Array<{ key: string; last_update: string; outcomes: Array<{ name: string; price: number; point?: number }> }[]> = [];
  const spread = parseFloat((Math.random() * 10 - 5).toFixed(1)); // e.g., -3.5, +2.5

  for (let b = 0; b < 3; b++) {
    const homePrice = 1.8 + Math.random() * 0.3;
    const awayPrice = 1.8 + Math.random() * 0.3;

    bookmakerMarkets.push([{
      key: 'spreads',
      last_update: new Date().toISOString(),
      outcomes: [
        { name: homeTeam, price: parseFloat(homePrice.toFixed(2)), point: spread },
        { name: awayTeam, price: parseFloat(awayPrice.toFixed(2)), point: -spread },
      ],
    }]);
  }

  return bookmakerMarkets;
}

function generateMockTotals(): Array<{ key: string; last_update: string; outcomes: Array<{ name: string; price: number; point?: number }> }[]> {
  const bookmakerMarkets: Array<{ key: string; last_update: string; outcomes: Array<{ name: string; price: number; point?: number }> }[]> = [];
  const total = parseFloat((180 + Math.random() * 60).toFixed(1)); // e.g., 215.5

  for (let b = 0; b < 3; b++) {
    const overPrice = 1.8 + Math.random() * 0.3;
    const underPrice = 1.8 + Math.random() * 0.3;

    bookmakerMarkets.push([{
      key: 'totals',
      last_update: new Date().toISOString(),
      outcomes: [
        { name: 'Over', price: parseFloat(overPrice.toFixed(2)), point: total },
        { name: 'Under', price: parseFloat(underPrice.toFixed(2)), point: total },
      ],
    }]);
  }

  return bookmakerMarkets;
}

function generateMockOddsEvents(sportKey: string): OddsApiEvent[] {
  const teams = generateMockTeams(sportKey);
  const isSoccer = sportKey.startsWith('soccer_');
  const isMma = sportKey.startsWith('mma_');
  const now = Date.now();

  return teams.map((matchup, idx) => {
    // Stagger start times over the next 7 days
    const startOffset = (idx + 1) * (12 + Math.floor(Math.random() * 36)) * 3600000;
    const commenceTime = new Date(now + startOffset).toISOString();

    const bookmakerOddsSets = generateMockH2hOdds(isSoccer);
    const bookmakerNames = ['pinnacle', 'bet365', 'unibet'];

    // Generate spread and total mock data (not for MMA)
    const spreadsSets = isMma ? null : generateMockSpreads(matchup.home, matchup.away);
    const totalsSets = isMma ? null : generateMockTotals();

    return {
      id: `mock_${sportKey}_${idx}_${Date.now()}`,
      sport_key: sportKey,
      sport_title: sportKey.replace(/_/g, ' '),
      commence_time: commenceTime,
      home_team: matchup.home,
      away_team: matchup.away,
      bookmakers: bookmakerNames.map((bName, bIdx) => ({
        key: bName,
        title: bName.charAt(0).toUpperCase() + bName.slice(1),
        last_update: new Date().toISOString(),
        markets: [
          {
            key: 'h2h',
            last_update: new Date().toISOString(),
            outcomes: bookmakerOddsSets[bIdx].map((o) => ({
              name: o.name === 'Home' ? matchup.home : o.name === 'Away' ? matchup.away : 'Draw',
              price: o.price,
            })),
          },
          ...(spreadsSets ? spreadsSets[bIdx] : []),
          ...(totalsSets ? totalsSets[bIdx] : []),
        ],
      })),
    };
  });
}

function generateMockScores(sportKey: string): OddsApiScore[] {
  const teams = generateMockTeams(sportKey);
  return teams.slice(0, 2).map((matchup, idx) => ({
    id: `mock_score_${sportKey}_${idx}`,
    sport_key: sportKey,
    sport_title: sportKey.replace(/_/g, ' '),
    commence_time: new Date(Date.now() - 3600000).toISOString(),
    completed: idx === 0,
    home_team: matchup.home,
    away_team: matchup.away,
    scores: [
      { name: matchup.home, score: String(Math.floor(Math.random() * 4)) },
      { name: matchup.away, score: String(Math.floor(Math.random() * 4)) },
    ],
    last_update: new Date().toISOString(),
  }));
}

function generateMockBasicEvents(sportKey: string): OddsApiEventBasic[] {
  const teams = generateMockTeams(sportKey);
  const now = Date.now();

  return teams.map((matchup, idx) => {
    const startOffset = (idx + 1) * (12 + Math.floor(Math.random() * 36)) * 3600000;
    return {
      id: `mock_event_${sportKey}_${idx}_${Date.now()}`,
      sport_key: sportKey,
      sport_title: sportKey.replace(/_/g, ' '),
      commence_time: new Date(now + startOffset).toISOString(),
      home_team: matchup.home,
      away_team: matchup.away,
    };
  });
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const oddsApiClient = new OddsApiClient();
