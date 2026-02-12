// ─── The Odds API Response Types ────────────────────────────────────────────

export interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

export interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface OddsApiScore {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: Array<{ name: string; score: string }> | null;
  last_update: string | null;
}

export interface OddsApiEventBasic {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

// ─── Internal Mapped Types ──────────────────────────────────────────────────

export interface MappedSport {
  apiKey: string;
  name: string;
  slug: string;
  group: string;
}

export interface MappedEvent {
  externalId: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  sportKey: string;
  competitionSlug: string;
  competitionName: string;
}

export interface MappedSelection {
  name: string;
  outcome: string;
  odds: string; // Decimal string
  probability: string; // Decimal string
  handicap?: string; // Decimal string
  params?: string;
}

export interface MappedMarket {
  name: string;
  marketKey: string;
  type: 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'OUTRIGHT';
  selections: MappedSelection[];
  margin: string; // Decimal string
}

export interface MappedEventWithMarkets extends MappedEvent {
  markets: MappedMarket[];
}

// ─── Configuration Types ────────────────────────────────────────────────────

export interface OddsApiConfig {
  apiKey: string;
  baseUrl: string;
  margin: number;
  syncIntervalMinutes: number;
  monthlyBudget: number;
  mockMode: boolean;
}

export interface CreditUsage {
  used: number;
  remaining: number;
  monthlyBudget: number;
  lastResetDate: string;
  lastFetchDate: string | null;
}

export interface FetchOddsOptions {
  regions?: string;
  markets?: string;
  oddsFormat?: 'decimal' | 'american';
  dateFormat?: 'iso' | 'unix';
}

export interface SyncResult {
  sport: string;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  marketsUpserted: number;
  selectionsUpserted: number;
  creditsUsed: number;
  duration: number;
}
