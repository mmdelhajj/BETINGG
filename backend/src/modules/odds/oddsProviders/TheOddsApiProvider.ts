import {
  BaseOddsProvider,
  type NormalizedSport,
  type NormalizedEvent,
  type NormalizedOdds,
  type NormalizedMarket,
  type NormalizedSelection,
} from './BaseOddsProvider.js';

// ---------------------------------------------------------------------------
// The Odds API response types (v4)
// ---------------------------------------------------------------------------

interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class TheOddsApiProvider extends BaseOddsProvider {
  private baseUrl: string;

  constructor(config: {
    apiKey: string;
    apiUrl?: string;
    quotaLimit?: number;
  }) {
    super({
      name: 'The Odds API',
      slug: 'the-odds-api',
      apiKey: config.apiKey,
      apiUrl: config.apiUrl ?? 'https://api.the-odds-api.com/v4',
      quotaLimit: config.quotaLimit ?? 500,
    });
    this.baseUrl = config.apiUrl ?? 'https://api.the-odds-api.com/v4';
  }

  // ─── Fetch Sports ────────────────────────────────────────────────────────

  async fetchSports(): Promise<NormalizedSport[]> {
    if (!this.hasQuota()) {
      throw new Error(`[${this.name}] API quota exhausted (${this.quotaUsed}/${this.quotaLimit}).`);
    }

    const url = `${this.baseUrl}/sports?apiKey=${this.apiKey}`;
    const response = await fetch(url);
    this.incrementQuota();
    this.trackQuotaFromHeaders(response);

    if (!response.ok) {
      throw new Error(`[${this.name}] fetchSports failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OddsApiSport[];

    return data.map((sport) => this.normalizeSport(sport));
  }

  // ─── Fetch Events ────────────────────────────────────────────────────────

  async fetchEvents(sportKey: string): Promise<NormalizedEvent[]> {
    if (!this.hasQuota()) {
      throw new Error(`[${this.name}] API quota exhausted.`);
    }

    const url = `${this.baseUrl}/sports/${encodeURIComponent(sportKey)}/events?apiKey=${this.apiKey}`;
    const response = await fetch(url);
    this.incrementQuota();
    this.trackQuotaFromHeaders(response);

    if (!response.ok) {
      throw new Error(
        `[${this.name}] fetchEvents(${sportKey}) failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OddsApiEvent[];

    return data.map((event) => this.normalizeEvent(event));
  }

  // ─── Fetch Odds ──────────────────────────────────────────────────────────

  async fetchOdds(sportKey: string): Promise<NormalizedOdds[]> {
    if (!this.hasQuota()) {
      throw new Error(`[${this.name}] API quota exhausted.`);
    }

    const markets = 'h2h,spreads,totals';
    const url = `${this.baseUrl}/sports/${encodeURIComponent(sportKey)}/odds?apiKey=${this.apiKey}&regions=us,eu&markets=${markets}&oddsFormat=decimal`;
    const response = await fetch(url);
    this.incrementQuota();
    this.trackQuotaFromHeaders(response);

    if (!response.ok) {
      throw new Error(
        `[${this.name}] fetchOdds(${sportKey}) failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OddsApiEvent[];

    return data.map((event) => this.normalizeOdds(event));
  }

  // ─── Normalizers ─────────────────────────────────────────────────────────

  private normalizeSport(sport: OddsApiSport): NormalizedSport {
    return {
      key: sport.key,
      name: sport.title,
      group: sport.group,
      active: sport.active,
    };
  }

  private normalizeEvent(event: OddsApiEvent): NormalizedEvent {
    const startTime = new Date(event.commence_time);
    const isLive = startTime <= new Date();

    return {
      externalId: event.id,
      sportKey: event.sport_key,
      name: `${event.home_team} vs ${event.away_team}`,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startTime,
      isLive,
    };
  }

  private normalizeOdds(event: OddsApiEvent): NormalizedOdds {
    const marketsMap = new Map<string, NormalizedMarket>();

    if (!event.bookmakers?.length) {
      return {
        eventExternalId: event.id,
        markets: [],
      };
    }

    // Use the first bookmaker as primary (or aggregate in the future)
    // We average odds across all bookmakers for better accuracy
    const oddsAccumulator = new Map<
      string,
      Map<string, { totalOdds: number; count: number; point?: number }>
    >();

    for (const bookmaker of event.bookmakers) {
      for (const market of bookmaker.markets) {
        if (!oddsAccumulator.has(market.key)) {
          oddsAccumulator.set(market.key, new Map());
        }
        const marketAcc = oddsAccumulator.get(market.key)!;

        for (const outcome of market.outcomes) {
          const key = outcome.point !== undefined
            ? `${outcome.name}_${outcome.point}`
            : outcome.name;

          if (!marketAcc.has(key)) {
            marketAcc.set(key, { totalOdds: 0, count: 0, point: outcome.point });
          }
          const acc = marketAcc.get(key)!;
          acc.totalOdds += outcome.price;
          acc.count++;
        }
      }
    }

    // Convert averaged data into normalized markets
    for (const [marketKey, outcomeMap] of oddsAccumulator) {
      const selections: NormalizedSelection[] = [];

      for (const [outcomeName, data] of outcomeMap) {
        const avgOdds = Math.round((data.totalOdds / data.count) * 1000) / 1000;
        const name = outcomeName.split('_')[0]; // Remove point suffix from key

        selections.push({
          name,
          outcome: name,
          odds: Math.max(avgOdds, 1.01), // Ensure odds > 1
          handicap: data.point,
          params: data.point !== undefined ? `point=${data.point}` : undefined,
        });
      }

      const marketType = this.mapMarketKeyToType(marketKey);
      const marketName = this.mapMarketKeyToName(marketKey);

      marketsMap.set(marketKey, {
        marketKey,
        name: marketName,
        type: marketType,
        selections,
      });
    }

    return {
      eventExternalId: event.id,
      markets: Array.from(marketsMap.values()),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private mapMarketKeyToType(key: string): 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'PROP' | 'OUTRIGHT' {
    switch (key) {
      case 'h2h':
        return 'MONEYLINE';
      case 'spreads':
        return 'SPREAD';
      case 'totals':
        return 'TOTAL';
      case 'outrights':
        return 'OUTRIGHT';
      default:
        return 'PROP';
    }
  }

  private mapMarketKeyToName(key: string): string {
    switch (key) {
      case 'h2h':
        return 'Match Winner';
      case 'spreads':
        return 'Point Spread';
      case 'totals':
        return 'Over/Under';
      case 'outrights':
        return 'Outright Winner';
      default:
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
  }

  /**
   * Track quota usage from The Odds API response headers.
   */
  private trackQuotaFromHeaders(response: Response): void {
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');

    if (remaining !== null) {
      const rem = parseInt(remaining, 10);
      if (!isNaN(rem)) {
        this.quotaUsed = this.quotaLimit - rem;
      }
    }
    if (used !== null) {
      const u = parseInt(used, 10);
      if (!isNaN(u)) {
        this.quotaUsed = u;
      }
    }
  }
}
