import Decimal from 'decimal.js';
import {
  OddsApiSport,
  OddsApiEvent,
  MappedSport,
  MappedEvent,
  MappedMarket,
  MappedSelection,
  MappedEventWithMarkets,
} from './types';
import { MarginCalculator } from './marginCalculator';

// ─── Sport Key Mapping ──────────────────────────────────────────────────────
// Maps The Odds API sport keys to our internal sport slugs and competition info

interface SportMapping {
  sportSlug: string;
  sportName: string;
  sportIcon: string;
  competitionSlug: string;
  competitionName: string;
  competitionCountry: string | null;
  sortOrder: number;
}

const SPORT_KEY_MAP: Record<string, SportMapping> = {
  // Soccer
  soccer_epl: {
    sportSlug: 'football',
    sportName: 'Football',
    sportIcon: 'football',
    competitionSlug: 'premier-league',
    competitionName: 'Premier League',
    competitionCountry: 'England',
    sortOrder: 1,
  },
  soccer_uefa_champions_league: {
    sportSlug: 'football',
    sportName: 'Football',
    sportIcon: 'football',
    competitionSlug: 'champions-league',
    competitionName: 'UEFA Champions League',
    competitionCountry: null,
    sortOrder: 1,
  },
  soccer_spain_la_liga: {
    sportSlug: 'football',
    sportName: 'Football',
    sportIcon: 'football',
    competitionSlug: 'la-liga',
    competitionName: 'La Liga',
    competitionCountry: 'Spain',
    sortOrder: 1,
  },
  soccer_germany_bundesliga: {
    sportSlug: 'football',
    sportName: 'Football',
    sportIcon: 'football',
    competitionSlug: 'bundesliga',
    competitionName: 'Bundesliga',
    competitionCountry: 'Germany',
    sortOrder: 1,
  },
  soccer_italy_serie_a: {
    sportSlug: 'football',
    sportName: 'Football',
    sportIcon: 'football',
    competitionSlug: 'serie-a',
    competitionName: 'Serie A',
    competitionCountry: 'Italy',
    sortOrder: 1,
  },
  soccer_france_ligue_one: {
    sportSlug: 'football',
    sportName: 'Football',
    sportIcon: 'football',
    competitionSlug: 'ligue-1',
    competitionName: 'Ligue 1',
    competitionCountry: 'France',
    sortOrder: 1,
  },
  soccer_uefa_europa_league: {
    sportSlug: 'football',
    sportName: 'Football',
    sportIcon: 'football',
    competitionSlug: 'europa-league',
    competitionName: 'UEFA Europa League',
    competitionCountry: null,
    sortOrder: 1,
  },

  // Basketball
  basketball_nba: {
    sportSlug: 'basketball',
    sportName: 'Basketball',
    sportIcon: 'basketball',
    competitionSlug: 'nba',
    competitionName: 'NBA',
    competitionCountry: 'USA',
    sortOrder: 2,
  },
  basketball_euroleague: {
    sportSlug: 'basketball',
    sportName: 'Basketball',
    sportIcon: 'basketball',
    competitionSlug: 'euroleague',
    competitionName: 'EuroLeague',
    competitionCountry: null,
    sortOrder: 2,
  },
  basketball_nba_championship_winner: {
    sportSlug: 'basketball',
    sportName: 'Basketball',
    sportIcon: 'basketball',
    competitionSlug: 'nba',
    competitionName: 'NBA',
    competitionCountry: 'USA',
    sortOrder: 2,
  },

  // American Football
  americanfootball_nfl: {
    sportSlug: 'american-football',
    sportName: 'American Football',
    sportIcon: 'american-football',
    competitionSlug: 'nfl',
    competitionName: 'NFL',
    competitionCountry: 'USA',
    sortOrder: 3,
  },
  americanfootball_nfl_super_bowl_winner: {
    sportSlug: 'american-football',
    sportName: 'American Football',
    sportIcon: 'american-football',
    competitionSlug: 'nfl',
    competitionName: 'NFL',
    competitionCountry: 'USA',
    sortOrder: 3,
  },

  // Ice Hockey
  icehockey_nhl: {
    sportSlug: 'ice-hockey',
    sportName: 'Ice Hockey',
    sportIcon: 'ice-hockey',
    competitionSlug: 'nhl',
    competitionName: 'NHL',
    competitionCountry: 'USA',
    sortOrder: 4,
  },

  // Baseball
  baseball_mlb: {
    sportSlug: 'baseball',
    sportName: 'Baseball',
    sportIcon: 'baseball',
    competitionSlug: 'mlb',
    competitionName: 'MLB',
    competitionCountry: 'USA',
    sortOrder: 5,
  },

  // MMA
  mma_mixed_martial_arts: {
    sportSlug: 'mma',
    sportName: 'MMA',
    sportIcon: 'mma',
    competitionSlug: 'ufc',
    competitionName: 'UFC / MMA',
    competitionCountry: null,
    sortOrder: 6,
  },

  // Tennis
  tennis_atp_french_open: {
    sportSlug: 'tennis',
    sportName: 'Tennis',
    sportIcon: 'tennis',
    competitionSlug: 'atp-french-open',
    competitionName: 'ATP French Open',
    competitionCountry: 'France',
    sortOrder: 7,
  },
  tennis_atp_wimbledon: {
    sportSlug: 'tennis',
    sportName: 'Tennis',
    sportIcon: 'tennis',
    competitionSlug: 'atp-wimbledon',
    competitionName: 'ATP Wimbledon',
    competitionCountry: 'England',
    sortOrder: 7,
  },
  tennis_atp_us_open: {
    sportSlug: 'tennis',
    sportName: 'Tennis',
    sportIcon: 'tennis',
    competitionSlug: 'atp-us-open',
    competitionName: 'ATP US Open',
    competitionCountry: 'USA',
    sortOrder: 7,
  },
  tennis_atp_australian_open: {
    sportSlug: 'tennis',
    sportName: 'Tennis',
    sportIcon: 'tennis',
    competitionSlug: 'atp-australian-open',
    competitionName: 'ATP Australian Open',
    competitionCountry: 'Australia',
    sortOrder: 7,
  },
};

// ─── Mapper Class ───────────────────────────────────────────────────────────

export class OddsApiMapper {
  private marginCalculator: MarginCalculator;

  constructor(marginPercent: number = 5) {
    this.marginCalculator = new MarginCalculator(marginPercent);
  }

  /**
   * Check if a sport key from The Odds API is one we support/map.
   */
  isSupportedSportKey(sportKey: string): boolean {
    return sportKey in SPORT_KEY_MAP;
  }

  /**
   * Get the mapping for a sport key. Returns null if not supported.
   */
  getSportMapping(sportKey: string): SportMapping | null {
    return SPORT_KEY_MAP[sportKey] || null;
  }

  /**
   * Get all sport keys we want to sync.
   */
  getAllSupportedSportKeys(): string[] {
    return Object.keys(SPORT_KEY_MAP);
  }

  /**
   * Map The Odds API sports to our internal sport structure.
   * Filters to only sports we have a mapping for.
   */
  mapSports(apiSports: OddsApiSport[]): MappedSport[] {
    const mapped: MappedSport[] = [];

    for (const apiSport of apiSports) {
      if (!apiSport.active) continue;

      const mapping = this.getSportMapping(apiSport.key);
      if (!mapping) continue;

      // Avoid duplicates (multiple API sport keys may map to same slug)
      if (!mapped.find((s) => s.slug === mapping.sportSlug)) {
        mapped.push({
          apiKey: apiSport.key,
          name: mapping.sportName,
          slug: mapping.sportSlug,
          group: apiSport.group,
        });
      }
    }

    return mapped;
  }

  /**
   * Map a single API event (with odds) to our internal structure with markets.
   */
  mapEventWithMarkets(apiEvent: OddsApiEvent): MappedEventWithMarkets | null {
    const mapping = this.getSportMapping(apiEvent.sport_key);
    if (!mapping) return null;

    const startTime = new Date(apiEvent.commence_time);
    if (isNaN(startTime.getTime())) return null;

    const event: MappedEventWithMarkets = {
      externalId: apiEvent.id,
      name: `${apiEvent.home_team} vs ${apiEvent.away_team}`,
      homeTeam: apiEvent.home_team,
      awayTeam: apiEvent.away_team,
      startTime,
      sportKey: apiEvent.sport_key,
      competitionSlug: mapping.competitionSlug,
      competitionName: mapping.competitionName,
      markets: [],
    };

    // Group bookmaker odds by market type
    const marketOddsMap = this.groupBookmakerOdds(apiEvent);

    // Process each market type
    for (const [marketKey, bookmakerOddsSets] of marketOddsMap.entries()) {
      const market = this.buildMarket(marketKey, bookmakerOddsSets, apiEvent);
      if (market) {
        event.markets.push(market);
      }
    }

    return event;
  }

  /**
   * Map multiple API events to our internal structure.
   */
  mapEvents(apiEvents: OddsApiEvent[]): MappedEventWithMarkets[] {
    const mapped: MappedEventWithMarkets[] = [];

    for (const apiEvent of apiEvents) {
      const event = this.mapEventWithMarkets(apiEvent);
      if (event) {
        mapped.push(event);
      }
    }

    return mapped;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  /**
   * Group all bookmaker odds by market key.
   * Returns a map of marketKey -> array of bookmaker outcome arrays.
   */
  private groupBookmakerOdds(
    apiEvent: OddsApiEvent,
  ): Map<string, Array<{ outcomeName: string; price: number; point?: number }[]>> {
    const marketMap = new Map<string, Array<{ outcomeName: string; price: number; point?: number }[]>>();

    for (const bookmaker of apiEvent.bookmakers) {
      for (const market of bookmaker.markets) {
        if (!marketMap.has(market.key)) {
          marketMap.set(market.key, []);
        }

        const outcomes = market.outcomes.map((o) => ({
          outcomeName: o.name,
          price: o.price,
          point: o.point,
        }));

        marketMap.get(market.key)!.push(outcomes);
      }
    }

    return marketMap;
  }

  /**
   * Build a MappedMarket from grouped bookmaker odds.
   */
  private buildMarket(
    marketKey: string,
    bookmakerOddsSets: Array<{ outcomeName: string; price: number; point?: number }[]>,
    apiEvent: OddsApiEvent,
  ): MappedMarket | null {
    if (bookmakerOddsSets.length === 0) return null;

    // Determine outcome names from the first bookmaker (all should have the same outcomes)
    const referenceOutcomes = bookmakerOddsSets[0];
    if (!referenceOutcomes || referenceOutcomes.length === 0) return null;

    const outcomeCount = referenceOutcomes.length;

    // For each outcome position, collect the best odds across all bookmakers
    // and also build arrays for the margin calculator
    const allBookmakerOddsArrays: Decimal[][] = [];
    for (const bmOutcomes of bookmakerOddsSets) {
      if (bmOutcomes.length !== outcomeCount) continue; // skip mismatched bookmakers
      allBookmakerOddsArrays.push(bmOutcomes.map((o) => new Decimal(o.price)));
    }

    if (allBookmakerOddsArrays.length === 0) return null;

    // Get the best odds with our margin applied
    const platformOdds = this.marginCalculator.bestOddsWithMargin(allBookmakerOddsArrays);
    if (platformOdds.length !== outcomeCount) return null;

    // Calculate fair probabilities for storage
    const bestOddsPerOutcome: Decimal[] = [];
    for (let i = 0; i < outcomeCount; i++) {
      let best = new Decimal(0);
      for (const bmOdds of allBookmakerOddsArrays) {
        if (bmOdds[i].gt(best)) {
          best = bmOdds[i];
        }
      }
      bestOddsPerOutcome.push(best);
    }
    const fairProbs = this.marginCalculator.getFairProbabilities(bestOddsPerOutcome);

    // Calculate the actual margin (overround) of our platform odds
    const overround = this.marginCalculator.calculateOverround(platformOdds);

    // Build selections
    const selections: MappedSelection[] = referenceOutcomes.map((outcome, idx) => {
      const selection: MappedSelection = {
        name: this.mapOutcomeName(outcome.outcomeName, marketKey, apiEvent),
        outcome: this.mapOutcomeKey(outcome.outcomeName, marketKey, apiEvent),
        odds: platformOdds[idx].toFixed(2),
        probability: fairProbs[idx].toDecimalPlaces(6).toFixed(6),
      };

      if (outcome.point !== undefined) {
        selection.handicap = new Decimal(outcome.point).toFixed(2);
        selection.params = String(outcome.point);
      }

      return selection;
    });

    // Build market
    const marketType = this.mapMarketType(marketKey);
    const marketName = this.mapMarketName(marketKey);

    return {
      name: marketName,
      marketKey: this.buildMarketKey(marketKey, referenceOutcomes),
      type: marketType,
      selections,
      margin: overround.toFixed(4),
    };
  }

  /**
   * Map The Odds API market key to our MarketType enum.
   */
  private mapMarketType(apiMarketKey: string): 'MONEYLINE' | 'SPREAD' | 'TOTAL' | 'OUTRIGHT' {
    switch (apiMarketKey) {
      case 'h2h':
        return 'MONEYLINE';
      case 'spreads':
        return 'SPREAD';
      case 'totals':
        return 'TOTAL';
      case 'outrights':
        return 'OUTRIGHT';
      default:
        return 'MONEYLINE';
    }
  }

  /**
   * Map The Odds API market key to a human-readable name.
   */
  private mapMarketName(apiMarketKey: string): string {
    switch (apiMarketKey) {
      case 'h2h':
        return 'Match Result';
      case 'spreads':
        return 'Handicap';
      case 'totals':
        return 'Over/Under';
      case 'outrights':
        return 'Outright Winner';
      default:
        return apiMarketKey;
    }
  }

  /**
   * Build a unique market key from market type and optional params.
   */
  private buildMarketKey(
    apiMarketKey: string,
    outcomes: Array<{ outcomeName: string; price: number; point?: number }>,
  ): string {
    // For totals and spreads, include the point value in the key
    if ((apiMarketKey === 'totals' || apiMarketKey === 'spreads') && outcomes[0]?.point !== undefined) {
      return `${apiMarketKey}_${outcomes[0].point}`;
    }
    return apiMarketKey;
  }

  /**
   * Map outcome name from API to a user-friendly display name.
   */
  private mapOutcomeName(
    outcomeName: string,
    marketKey: string,
    apiEvent: OddsApiEvent,
  ): string {
    if (marketKey === 'h2h') {
      if (outcomeName === 'Draw') return 'Draw';
      return outcomeName; // team name is already correct
    }

    if (marketKey === 'totals') {
      if (outcomeName === 'Over') return 'Over';
      if (outcomeName === 'Under') return 'Under';
      return outcomeName;
    }

    if (marketKey === 'spreads') {
      return outcomeName; // team name with handicap
    }

    return outcomeName;
  }

  /**
   * Map outcome name to a machine-readable outcome key.
   */
  private mapOutcomeKey(
    outcomeName: string,
    marketKey: string,
    apiEvent: OddsApiEvent,
  ): string {
    if (marketKey === 'h2h') {
      if (outcomeName === 'Draw') return 'draw';
      if (outcomeName === apiEvent.home_team) return 'home';
      if (outcomeName === apiEvent.away_team) return 'away';
      return outcomeName.toLowerCase().replace(/\s+/g, '_');
    }

    if (marketKey === 'totals') {
      return outcomeName.toLowerCase(); // 'over' or 'under'
    }

    if (marketKey === 'spreads') {
      if (outcomeName === apiEvent.home_team) return 'home';
      if (outcomeName === apiEvent.away_team) return 'away';
      return outcomeName.toLowerCase().replace(/\s+/g, '_');
    }

    return outcomeName.toLowerCase().replace(/\s+/g, '_');
  }
}
