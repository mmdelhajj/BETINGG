import { prisma } from '../../lib/prisma';
import { deleteCachePattern } from '../../lib/redis';
import { OddsApiClient, oddsApiClient } from './client';
import { OddsApiMapper } from './mapper';
import { MappedEventWithMarkets, SyncResult, CreditUsage } from './types';

// ─── Configured Sports To Sync ──────────────────────────────────────────────
// These are the sport keys we actively sync odds for.
// Priority sports get synced more frequently and are the primary credit consumers.

interface SportSyncConfig {
  apiKey: string;
  priority: 'high' | 'medium' | 'low';
  markets: string;
  regions: string;
}

const SYNC_SPORTS: SportSyncConfig[] = [
  // High priority: EPL, Champions League (soccer)
  { apiKey: 'soccer_epl', priority: 'high', markets: 'h2h,spreads,totals', regions: 'eu' },
  { apiKey: 'soccer_uefa_champions_league', priority: 'high', markets: 'h2h,spreads,totals', regions: 'eu' },

  // High priority: NBA (basketball)
  { apiKey: 'basketball_nba', priority: 'high', markets: 'h2h,spreads,totals', regions: 'eu' },

  // Medium priority: Other major leagues
  { apiKey: 'americanfootball_nfl', priority: 'medium', markets: 'h2h,spreads,totals', regions: 'eu' },
  { apiKey: 'icehockey_nhl', priority: 'medium', markets: 'h2h,spreads,totals', regions: 'eu' },
  { apiKey: 'baseball_mlb', priority: 'medium', markets: 'h2h,spreads,totals', regions: 'eu' },

  // Low priority: Other sports
  { apiKey: 'soccer_spain_la_liga', priority: 'low', markets: 'h2h,spreads,totals', regions: 'eu' },
  { apiKey: 'soccer_germany_bundesliga', priority: 'low', markets: 'h2h,spreads,totals', regions: 'eu' },
  { apiKey: 'soccer_italy_serie_a', priority: 'low', markets: 'h2h,spreads,totals', regions: 'eu' },
  { apiKey: 'mma_mixed_martial_arts', priority: 'low', markets: 'h2h', regions: 'eu' },
];

// ─── Sync Service ───────────────────────────────────────────────────────────

export class OddsSyncService {
  private client: OddsApiClient;
  private mapper: OddsApiMapper;

  constructor() {
    this.client = oddsApiClient;
    const marginPercent = parseFloat(process.env.ODDS_API_MARGIN || '5');
    this.mapper = new OddsApiMapper(marginPercent);
  }

  /**
   * Sync the sports list from The Odds API (or mock data).
   * Creates sports and competitions in the database if they do not exist.
   * FREE endpoint - no credit cost.
   */
  async syncSportsList(): Promise<{ sportsUpserted: number; competitionsUpserted: number }> {
    const startTime = Date.now();
    console.log('[OddsSync] Starting sports list sync...');

    const apiSports = await this.client.fetchSports();
    let sportsUpserted = 0;
    let competitionsUpserted = 0;

    // Process each API sport key that we have a mapping for
    for (const apiSport of apiSports) {
      const mapping = this.mapper.getSportMapping(apiSport.key);
      if (!mapping) continue;

      // Upsert sport
      const sport = await prisma.sport.upsert({
        where: { slug: mapping.sportSlug },
        create: {
          name: mapping.sportName,
          slug: mapping.sportSlug,
          icon: mapping.sportIcon,
          isActive: true,
          sortOrder: mapping.sortOrder,
        },
        update: {
          isActive: true,
        },
      });
      sportsUpserted++;

      // Upsert competition
      await prisma.competition.upsert({
        where: {
          sportId_slug: {
            sportId: sport.id,
            slug: mapping.competitionSlug,
          },
        },
        create: {
          sportId: sport.id,
          name: mapping.competitionName,
          slug: mapping.competitionSlug,
          country: mapping.competitionCountry,
          isActive: true,
        },
        update: {
          name: mapping.competitionName,
          isActive: true,
        },
      });
      competitionsUpserted++;
    }

    // Invalidate sports caches
    await deleteCachePattern('sports:*');
    await deleteCachePattern('competitions:*');

    const duration = Date.now() - startTime;
    console.log(`[OddsSync] Sports sync completed in ${duration}ms. Sports: ${sportsUpserted}, Competitions: ${competitionsUpserted}`);

    return { sportsUpserted, competitionsUpserted };
  }

  /**
   * Sync odds for a specific sport.
   * This is the main credit-consuming operation.
   *
   * Flow:
   *  1. Fetch odds from The Odds API (or mock)
   *  2. Map to our internal structure
   *  3. Upsert events, markets, and selections in the database
   */
  async syncOddsForSport(sportConfig: SportSyncConfig): Promise<SyncResult> {
    const startTime = Date.now();
    const { apiKey, markets, regions } = sportConfig;

    console.log(`[OddsSync] Syncing odds for ${apiKey}...`);

    const result: SyncResult = {
      sport: apiKey,
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      marketsUpserted: 0,
      selectionsUpserted: 0,
      creditsUsed: 0,
      duration: 0,
    };

    try {
      // Calculate expected credit cost
      const regionCount = regions.split(',').length;
      const marketCount = markets.split(',').length;
      const expectedCredits = regionCount * marketCount;

      // Check budget before making API call
      const credits = await this.client.getCreditUsage();
      if (credits.remaining < expectedCredits && !this.client.isMockMode()) {
        console.warn(`[OddsSync] Insufficient credits for ${apiKey}. Need ${expectedCredits}, have ${credits.remaining}. Skipping.`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // Fetch odds from API (or mock)
      const apiEvents = await this.client.fetchOdds(apiKey, {
        regions,
        markets,
        oddsFormat: 'decimal',
      });

      if (!this.client.isMockMode()) {
        result.creditsUsed = expectedCredits;
      }

      // Map to our internal structure
      const mappedEvents = this.mapper.mapEvents(apiEvents);
      result.eventsProcessed = mappedEvents.length;

      // Upsert each event with its markets and selections
      for (const mappedEvent of mappedEvents) {
        await this.upsertEvent(mappedEvent, result);
      }

      // Mark events that are past their start time and no longer in the API response as completed
      await this.markCompletedEvents(apiKey, mappedEvents);

    } catch (error) {
      console.error(`[OddsSync] Error syncing ${apiKey}:`, (error as Error).message);
    }

    result.duration = Date.now() - startTime;
    console.log(
      `[OddsSync] Sync for ${apiKey} completed in ${result.duration}ms. ` +
      `Events: ${result.eventsCreated} created, ${result.eventsUpdated} updated. ` +
      `Markets: ${result.marketsUpserted}, Selections: ${result.selectionsUpserted}. ` +
      `Credits used: ${result.creditsUsed}`,
    );

    // Invalidate related caches
    await deleteCachePattern('sports:*');
    await deleteCachePattern('competitions:*');
    await deleteCachePattern('event:*');

    return result;
  }

  /**
   * Run a full sync for all configured sports based on priority.
   *
   * @param priorityFilter - Only sync sports of this priority (or all if undefined)
   */
  async syncAllSports(priorityFilter?: 'high' | 'medium' | 'low'): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const sportsToSync = priorityFilter
      ? SYNC_SPORTS.filter((s) => s.priority === priorityFilter)
      : SYNC_SPORTS;

    console.log(`[OddsSync] Starting full sync for ${sportsToSync.length} sport(s)...`);

    for (const sportConfig of sportsToSync) {
      const result = await this.syncOddsForSport(sportConfig);
      results.push(result);

      // Small delay between API calls to be respectful
      if (!this.client.isMockMode()) {
        await sleep(500);
      }
    }

    const totalCredits = results.reduce((sum, r) => sum + r.creditsUsed, 0);
    console.log(`[OddsSync] Full sync completed. Total credits used: ${totalCredits}`);

    return results;
  }

  /**
   * Sync only high-priority sports (EPL, Champions League, NBA).
   * Expected cost: 9 credits (3 sports x 1 region x 3 markets: h2h, spreads, totals)
   */
  async syncHighPriority(): Promise<SyncResult[]> {
    return this.syncAllSports('high');
  }

  /**
   * Sync live scores for all configured sports.
   * Fetches scores from The Odds API (FREE endpoint) and updates
   * homeScore, awayScore, and scores JSON on matching events.
   * Runs every 60 seconds via the scheduler for live events.
   */
  async syncLiveScores(): Promise<{ eventsUpdated: number; eventsCompleted: number }> {
    const startTime = Date.now();
    let eventsUpdated = 0;
    let eventsCompleted = 0;

    console.log('[OddsSync] Starting live scores sync...');

    // Collect unique sport keys from SYNC_SPORTS
    const sportKeys = [...new Set(SYNC_SPORTS.map((s) => s.apiKey))];

    for (const sportKey of sportKeys) {
      try {
        const scores = await this.client.fetchScores(sportKey);

        for (const scoreData of scores) {
          if (!scoreData.scores || scoreData.scores.length === 0) continue;

          // Find the event by external ID
          const event = await prisma.event.findFirst({
            where: {
              metadata: {
                path: ['externalId'],
                equals: scoreData.id,
              },
            },
          });

          if (!event) continue;

          // Parse home and away scores from the scores array
          const homeScoreEntry = scoreData.scores.find(
            (s) => s.name === scoreData.home_team,
          );
          const awayScoreEntry = scoreData.scores.find(
            (s) => s.name === scoreData.away_team,
          );

          const homeScore = homeScoreEntry ? parseInt(homeScoreEntry.score, 10) : null;
          const awayScore = awayScoreEntry ? parseInt(awayScoreEntry.score, 10) : null;

          const updateData: Record<string, any> = {
            homeScore: !isNaN(homeScore as number) ? homeScore : null,
            awayScore: !isNaN(awayScore as number) ? awayScore : null,
            scores: scoreData.scores,
          };

          // If the API says the game is completed, mark it as ENDED
          if (scoreData.completed) {
            updateData.status = 'ENDED';
            updateData.isLive = false;
            eventsCompleted++;
          } else if (event.status !== 'LIVE' && this.isLikelyLive(event.startTime)) {
            // If the game has started and scores are coming in, mark as LIVE
            updateData.status = 'LIVE';
            updateData.isLive = true;
          }

          await prisma.event.update({
            where: { id: event.id },
            data: updateData,
          });
          eventsUpdated++;
        }
      } catch (error) {
        console.error(`[OddsSync] Error syncing scores for ${sportKey}:`, (error as Error).message);
      }
    }

    // Invalidate event caches since scores changed
    if (eventsUpdated > 0) {
      await deleteCachePattern('event:*');
      await deleteCachePattern('sports:*');
    }

    const duration = Date.now() - startTime;
    console.log(
      `[OddsSync] Live scores sync completed in ${duration}ms. ` +
      `Events updated: ${eventsUpdated}, Completed: ${eventsCompleted}`,
    );

    return { eventsUpdated, eventsCompleted };
  }

  /**
   * Get current credit usage.
   */
  async getCreditUsage(): Promise<CreditUsage> {
    return this.client.getCreditUsage();
  }

  /**
   * Check if the service is running in mock mode.
   */
  isMockMode(): boolean {
    return this.client.isMockMode();
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  /**
   * Upsert an event along with its markets and selections.
   */
  private async upsertEvent(
    mappedEvent: MappedEventWithMarkets,
    result: SyncResult,
  ): Promise<void> {
    const mapping = this.mapper.getSportMapping(mappedEvent.sportKey);
    if (!mapping) return;

    // Find the sport and competition
    const sport = await prisma.sport.findUnique({ where: { slug: mapping.sportSlug } });
    if (!sport) {
      console.warn(`[OddsSync] Sport ${mapping.sportSlug} not found in DB. Run syncSportsList first.`);
      return;
    }

    const competition = await prisma.competition.findUnique({
      where: {
        sportId_slug: {
          sportId: sport.id,
          slug: mapping.competitionSlug,
        },
      },
    });
    if (!competition) {
      console.warn(`[OddsSync] Competition ${mapping.competitionSlug} not found for sport ${mapping.sportSlug}. Run syncSportsList first.`);
      return;
    }

    // Check if event already exists by looking for matching event using metadata
    let event = await prisma.event.findFirst({
      where: {
        competitionId: competition.id,
        metadata: {
          path: ['externalId'],
          equals: mappedEvent.externalId,
        },
      },
    });

    if (event) {
      // Update existing event
      event = await prisma.event.update({
        where: { id: event.id },
        data: {
          name: mappedEvent.name,
          homeTeam: mappedEvent.homeTeam,
          awayTeam: mappedEvent.awayTeam,
          startTime: mappedEvent.startTime,
          // If the event start time is in the past but within 3 hours, mark as live
          ...(this.isLikelyLive(mappedEvent.startTime)
            ? { status: 'LIVE', isLive: true }
            : {}),
          metadata: {
            externalId: mappedEvent.externalId,
            sportKey: mappedEvent.sportKey,
            lastSyncedAt: new Date().toISOString(),
          },
        },
      });
      result.eventsUpdated++;
    } else {
      // Create new event
      event = await prisma.event.create({
        data: {
          competitionId: competition.id,
          name: mappedEvent.name,
          homeTeam: mappedEvent.homeTeam,
          awayTeam: mappedEvent.awayTeam,
          startTime: mappedEvent.startTime,
          status: this.isLikelyLive(mappedEvent.startTime) ? 'LIVE' : 'UPCOMING',
          isLive: this.isLikelyLive(mappedEvent.startTime),
          metadata: {
            externalId: mappedEvent.externalId,
            sportKey: mappedEvent.sportKey,
            lastSyncedAt: new Date().toISOString(),
          },
        },
      });
      result.eventsCreated++;
    }

    // Upsert markets and selections
    for (const mappedMarket of mappedEvent.markets) {
      await this.upsertMarket(event.id, mappedMarket, result);
    }
  }

  /**
   * Upsert a market and its selections for an event.
   */
  private async upsertMarket(
    eventId: string,
    mappedMarket: MappedEventWithMarkets['markets'][0],
    result: SyncResult,
  ): Promise<void> {
    // Find or create market
    let market = await prisma.market.findFirst({
      where: {
        eventId,
        marketKey: mappedMarket.marketKey,
      },
    });

    if (market) {
      // Update existing market
      await prisma.market.update({
        where: { id: market.id },
        data: {
          name: mappedMarket.name,
          status: 'OPEN',
          margin: parseFloat(mappedMarket.margin),
        },
      });
    } else {
      // Create new market
      market = await prisma.market.create({
        data: {
          eventId,
          name: mappedMarket.name,
          marketKey: mappedMarket.marketKey,
          type: mappedMarket.type as any,
          status: 'OPEN',
          sortOrder: this.getMarketSortOrder(mappedMarket.type),
          margin: parseFloat(mappedMarket.margin),
        },
      });
    }
    result.marketsUpserted++;

    // Upsert selections
    for (const mappedSelection of mappedMarket.selections) {
      await this.upsertSelection(market.id, mappedSelection, result);
    }
  }

  /**
   * Upsert a selection within a market.
   */
  private async upsertSelection(
    marketId: string,
    mappedSelection: MappedEventWithMarkets['markets'][0]['selections'][0],
    result: SyncResult,
  ): Promise<void> {
    // Look for existing selection by market + outcome key
    const existing = await prisma.selection.findFirst({
      where: {
        marketId,
        outcome: mappedSelection.outcome,
      },
    });

    if (existing) {
      await prisma.selection.update({
        where: { id: existing.id },
        data: {
          name: mappedSelection.name,
          odds: parseFloat(mappedSelection.odds),
          probability: parseFloat(mappedSelection.probability),
          handicap: mappedSelection.handicap ? parseFloat(mappedSelection.handicap) : undefined,
          params: mappedSelection.params,
          status: 'ACTIVE',
        },
      });
    } else {
      await prisma.selection.create({
        data: {
          marketId,
          name: mappedSelection.name,
          outcome: mappedSelection.outcome,
          odds: parseFloat(mappedSelection.odds),
          probability: parseFloat(mappedSelection.probability),
          handicap: mappedSelection.handicap ? parseFloat(mappedSelection.handicap) : undefined,
          params: mappedSelection.params,
          status: 'ACTIVE',
        },
      });
    }
    result.selectionsUpserted++;
  }

  /**
   * Mark events as completed if they are past their start time by a significant margin
   * and are not included in the latest API response.
   */
  private async markCompletedEvents(
    sportKey: string,
    currentMappedEvents: MappedEventWithMarkets[],
  ): Promise<void> {
    const mapping = this.mapper.getSportMapping(sportKey);
    if (!mapping) return;

    const sport = await prisma.sport.findUnique({ where: { slug: mapping.sportSlug } });
    if (!sport) return;

    const competition = await prisma.competition.findUnique({
      where: {
        sportId_slug: {
          sportId: sport.id,
          slug: mapping.competitionSlug,
        },
      },
    });
    if (!competition) return;

    // Get all currently active events for this competition
    const activeEvents = await prisma.event.findMany({
      where: {
        competitionId: competition.id,
        status: { in: ['UPCOMING', 'LIVE'] },
      },
    });

    const currentExternalIds = new Set(currentMappedEvents.map((e) => e.externalId));
    const cutoffTime = new Date(Date.now() - 4 * 3600000); // 4 hours ago

    for (const event of activeEvents) {
      const metadata = event.metadata as any;
      const externalId = metadata?.externalId;

      // If the event is past its start time by 4+ hours and not in current API data, mark completed
      if (
        externalId &&
        !currentExternalIds.has(externalId) &&
        event.startTime < cutoffTime
      ) {
        await prisma.event.update({
          where: { id: event.id },
          data: { status: 'ENDED', isLive: false },
        });

        // Suspend all open markets for ended events
        await prisma.market.updateMany({
          where: { eventId: event.id, status: 'OPEN' },
          data: { status: 'SUSPENDED' },
        });
        await prisma.selection.updateMany({
          where: {
            market: { eventId: event.id },
            status: 'ACTIVE',
          },
          data: { status: 'SUSPENDED' },
        });

        console.log(`[OddsSync] Marked event as ended: ${event.name} (${event.id})`);
      }
    }
  }

  /**
   * Determine if an event is likely currently live based on its start time.
   * An event is "likely live" if it started less than 3 hours ago.
   */
  private isLikelyLive(startTime: Date): boolean {
    const now = Date.now();
    const eventStart = startTime.getTime();
    const threeHoursMs = 3 * 3600000;

    return eventStart <= now && eventStart > now - threeHoursMs;
  }

  /**
   * Get sort order for market types. Lower = shown first.
   */
  private getMarketSortOrder(marketType: string): number {
    switch (marketType) {
      case 'MONEYLINE':
        return 1;
      case 'SPREAD':
        return 2;
      case 'TOTAL':
        return 3;
      case 'OUTRIGHT':
        return 4;
      default:
        return 10;
    }
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const oddsSyncService = new OddsSyncService();
