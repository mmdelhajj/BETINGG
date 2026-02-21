// ---------------------------------------------------------------------------
// Base abstract class for all odds providers
// ---------------------------------------------------------------------------

export interface NormalizedSport {
  key: string;
  name: string;
  group: string;
  active: boolean;
}

export interface NormalizedEvent {
  externalId: string;
  sportKey: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  isLive: boolean;
}

export interface NormalizedOdds {
  eventExternalId: string;
  markets: NormalizedMarket[];
}

export interface NormalizedMarket {
  marketKey: string;
  name: string;
  type: 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'PROP' | 'OUTRIGHT';
  selections: NormalizedSelection[];
}

export interface NormalizedSelection {
  name: string;
  outcome: string;
  odds: number;
  handicap?: number;
  params?: string;
}

export interface ProviderQuota {
  used: number;
  remaining: number;
  limit: number;
}

export abstract class BaseOddsProvider {
  public readonly name: string;
  public readonly slug: string;
  protected apiKey: string;
  protected apiUrl: string;
  protected quotaUsed: number = 0;
  protected quotaLimit: number;

  constructor(config: {
    name: string;
    slug: string;
    apiKey: string;
    apiUrl: string;
    quotaLimit?: number;
  }) {
    this.name = config.name;
    this.slug = config.slug;
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
    this.quotaLimit = config.quotaLimit ?? 500;
  }

  /**
   * Fetch available sports from the provider.
   */
  abstract fetchSports(): Promise<NormalizedSport[]>;

  /**
   * Fetch upcoming/live events for a specific sport.
   */
  abstract fetchEvents(sportKey: string): Promise<NormalizedEvent[]>;

  /**
   * Fetch current odds for a specific sport.
   */
  abstract fetchOdds(sportKey: string): Promise<NormalizedOdds[]>;

  /**
   * Get current API quota usage.
   */
  getQuota(): ProviderQuota {
    return {
      used: this.quotaUsed,
      remaining: Math.max(0, this.quotaLimit - this.quotaUsed),
      limit: this.quotaLimit,
    };
  }

  /**
   * Check if the provider has available quota.
   */
  hasQuota(): boolean {
    return this.quotaUsed < this.quotaLimit;
  }

  /**
   * Increment quota usage counter.
   */
  protected incrementQuota(): void {
    this.quotaUsed++;
  }

  /**
   * Reset quota (typically called daily).
   */
  resetQuota(): void {
    this.quotaUsed = 0;
  }
}
