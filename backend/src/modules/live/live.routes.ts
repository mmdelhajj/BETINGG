import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { authenticate } from '../../middleware/auth.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import {
  idParamSchema,
  liveEventsQuerySchema,
  timelineQuerySchema,
  placeLiveBetSchema,
  type IdParam,
  type LiveEventsQuery,
  type TimelineQuery,
  type PlaceLiveBetInput,
} from './live.schemas.js';
import * as liveService from './live.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function success(reply: FastifyReply, data: unknown, statusCode = 200) {
  return reply.status(statusCode).send({ success: true, data });
}

function error(reply: FastifyReply, code: string, message: string, statusCode = 400) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message },
  });
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

class LiveBetError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'LiveBetError';
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LIVE_BET_DELAY_MS = 6000; // 6 second acceptance delay for live bets
const MIN_STAKE = new Prisma.Decimal('0.01');
const MAX_STAKE_DEFAULT = new Prisma.Decimal('100000');
const CACHE_TTL_LIVE_EVENTS = 5; // seconds
const CACHE_TTL_LIVE_STATS = 10; // seconds

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function liveRoutes(fastify: FastifyInstance): Promise<void> {
  // =======================================================================
  // PUBLIC ROUTES
  // =======================================================================

  /**
   * GET /api/v1/live/events - List all live events
   *
   * Returns events currently in LIVE status, grouped by sport/competition.
   * Supports optional filtering by sport or competition slug.
   */
  fastify.get(
    '/api/v1/live/events',
    { preHandler: [validateQuery(liveEventsQuerySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { sport, competition, page, limit } = request.query as LiveEventsQuery;

        // Try Redis cache first
        const cacheKey = `live:events:${sport ?? 'all'}:${competition ?? 'all'}:${page}:${limit}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
          return success(reply, JSON.parse(cached));
        }

        const where: Prisma.EventWhereInput = {
          status: 'LIVE',
          isLive: true,
        };

        if (sport) {
          where.competition = {
            sport: { slug: sport },
          };
        }

        if (competition) {
          where.competition = {
            ...((where.competition as Prisma.CompetitionWhereInput) ?? {}),
            slug: competition,
          };
        }

        const skip = (page - 1) * limit;

        const [events, total] = await Promise.all([
          prisma.event.findMany({
            where,
            orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
            skip,
            take: limit,
            select: {
              id: true,
              name: true,
              slug: true,
              homeTeam: true,
              awayTeam: true,
              startTime: true,
              status: true,
              isLive: true,
              scores: true,
              streamUrl: true,
              competition: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  sport: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      icon: true,
                    },
                  },
                },
              },
              markets: {
                where: { status: 'OPEN' },
                orderBy: { sortOrder: 'asc' },
                take: 3, // Only return top 3 markets in list view
                select: {
                  id: true,
                  name: true,
                  type: true,
                  status: true,
                  selections: {
                    where: { status: 'ACTIVE' },
                    orderBy: { sortOrder: 'asc' },
                    select: {
                      id: true,
                      name: true,
                      odds: true,
                      status: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.event.count({ where }),
        ]);

        // Format odds as numbers
        const formatted = events.map((event) => ({
          ...event,
          markets: event.markets.map((market) => ({
            ...market,
            selections: market.selections.map((sel) => ({
              ...sel,
              odds: sel.odds.toNumber(),
            })),
          })),
        }));

        // Group by sport
        const grouped = new Map<
          string,
          {
            sport: { id: string; name: string; slug: string; icon: string | null };
            events: typeof formatted;
          }
        >();

        for (const event of formatted) {
          const sportSlug = event.competition.sport.slug;
          if (!grouped.has(sportSlug)) {
            grouped.set(sportSlug, {
              sport: event.competition.sport,
              events: [],
            });
          }
          grouped.get(sportSlug)!.events.push(event);
        }

        const result = {
          groups: Array.from(grouped.values()),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };

        // Cache briefly
        await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_LIVE_EVENTS);

        return success(reply, result);
      } catch (err) {
        throw err;
      }
    },
  );

  /**
   * GET /api/v1/live/events/:id - Get a single live event with all current odds
   *
   * Returns full event details including all open markets and selections.
   */
  fastify.get(
    '/api/v1/live/events/:id',
    { preHandler: [validateParams(idParamSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;

        const event = await prisma.event.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            slug: true,
            homeTeam: true,
            awayTeam: true,
            startTime: true,
            status: true,
            isLive: true,
            scores: true,
            streamUrl: true,
            metadata: true,
            competition: {
              select: {
                id: true,
                name: true,
                slug: true,
                sport: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    icon: true,
                  },
                },
              },
            },
            markets: {
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                sortOrder: true,
                selections: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    odds: true,
                    status: true,
                    maxStake: true,
                  },
                },
              },
            },
          },
        });

        if (!event) {
          return error(reply, 'EVENT_NOT_FOUND', 'Event not found', 404);
        }

        // Get subscriber count from Redis
        const subscriberCount = await redis.scard(`live:event:${id}:subscribers`);

        const formatted = {
          ...event,
          subscriberCount: Number(subscriberCount),
          markets: event.markets.map((market) => ({
            ...market,
            selections: market.selections.map((sel) => ({
              ...sel,
              odds: sel.odds.toNumber(),
              maxStake: sel.maxStake?.toNumber() ?? null,
            })),
          })),
        };

        return success(reply, { event: formatted });
      } catch (err) {
        throw err;
      }
    },
  );

  /**
   * GET /api/v1/live/events/:id/stats - Get live stats for an event
   *
   * Returns match statistics including possession, shots, corners, etc.
   * Data is cached in Redis and updated by the live data feed.
   */
  fastify.get(
    '/api/v1/live/events/:id/stats',
    { preHandler: [validateParams(idParamSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;

        // Verify event exists
        const event = await prisma.event.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            status: true,
            isLive: true,
            scores: true,
            metadata: true,
            homeTeam: true,
            awayTeam: true,
          },
        });

        if (!event) {
          return error(reply, 'EVENT_NOT_FOUND', 'Event not found', 404);
        }

        // Try to get live stats from Redis (updated by external data feed)
        const cachedStats = await redis.get(`live:event:${id}:stats`);
        let stats: Record<string, unknown> = {};

        if (cachedStats) {
          stats = JSON.parse(cachedStats);
        } else {
          // Fallback: construct basic stats from the event metadata
          const metadata = (event.metadata as Record<string, unknown>) ?? {};
          stats = {
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
            scores: event.scores,
            possession: metadata.possession ?? null,
            shots: metadata.shots ?? null,
            shotsOnTarget: metadata.shotsOnTarget ?? null,
            corners: metadata.corners ?? null,
            fouls: metadata.fouls ?? null,
            yellowCards: metadata.yellowCards ?? null,
            redCards: metadata.redCards ?? null,
            period: metadata.period ?? null,
            clock: metadata.clock ?? null,
          };
        }

        const result = {
          eventId: event.id,
          eventName: event.name,
          status: event.status,
          isLive: event.isLive,
          stats,
          timestamp: new Date().toISOString(),
        };

        return success(reply, result);
      } catch (err) {
        throw err;
      }
    },
  );

  /**
   * GET /api/v1/live/events/:id/timeline - Get match timeline/events
   *
   * Returns chronological list of match events (goals, cards, substitutions, etc.)
   */
  fastify.get(
    '/api/v1/live/events/:id/timeline',
    { preHandler: [validateParams(idParamSchema), validateQuery(timelineQuerySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const { page, limit } = request.query as TimelineQuery;

        // Verify event exists
        const event = await prisma.event.findUnique({
          where: { id },
          select: { id: true, name: true, status: true },
        });

        if (!event) {
          return error(reply, 'EVENT_NOT_FOUND', 'Event not found', 404);
        }

        // Try Redis for live timeline data
        const cachedTimeline = await redis.get(`live:event:${id}:timeline`);

        if (cachedTimeline) {
          const allIncidents: Array<Record<string, unknown>> = JSON.parse(cachedTimeline);
          const total = allIncidents.length;
          const skip = (page - 1) * limit;
          const paginatedIncidents = allIncidents.slice(skip, skip + limit);

          return success(reply, {
            eventId: event.id,
            eventName: event.name,
            incidents: paginatedIncidents,
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          });
        }

        // Fallback: get from database event_incidents table if it exists,
        // otherwise return from event metadata
        const skip = (page - 1) * limit;

        const [incidents, total] = await Promise.all([
          prisma.eventIncident.findMany({
            where: { eventId: id },
            orderBy: { minute: 'asc' },
            skip,
            take: limit,
            select: {
              id: true,
              type: true,
              minute: true,
              team: true,
              playerName: true,
              description: true,
              metadata: true,
              createdAt: true,
            },
          }),
          prisma.eventIncident.count({ where: { eventId: id } }),
        ]);

        return success(reply, {
          eventId: event.id,
          eventName: event.name,
          incidents,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (err) {
        // If eventIncident table doesn't exist, return empty
        if (
          err instanceof Prisma.PrismaClientValidationError ||
          (err instanceof Error && err.message.includes('eventIncident'))
        ) {
          const { id } = request.params as IdParam;
          return success(reply, {
            eventId: id,
            eventName: '',
            incidents: [],
            pagination: {
              page: 1,
              limit: 50,
              total: 0,
              totalPages: 0,
            },
          });
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // AUTHENTICATED ROUTES
  // =======================================================================

  /**
   * POST /api/v1/live/events/:id/bet - Place a live bet on an event
   *
   * Live bets have a delay period (typically 6 seconds) during which odds
   * can change. The oddsChangePolicy controls behavior on odds movement.
   */
  fastify.post(
    '/api/v1/live/events/:id/bet',
    {
      preHandler: [
        authenticate,
        validateParams(idParamSchema),
        validate(placeLiveBetSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id: eventId } = request.params as IdParam;
        const { selectionId, stake, currency, odds, oddsChangePolicy } =
          request.body as PlaceLiveBetInput;
        const userId = request.user!.id;

        // Verify event is live
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { id: true, name: true, status: true, isLive: true },
        });

        if (!event) {
          return error(reply, 'EVENT_NOT_FOUND', 'Event not found', 404);
        }

        if (!event.isLive || event.status !== 'LIVE') {
          return error(
            reply,
            'EVENT_NOT_LIVE',
            'This event is not currently live. Live bets cannot be placed.',
            400,
          );
        }

        // Verify selection exists in this event and is active
        const selection = await prisma.selection.findUnique({
          where: { id: selectionId },
          include: {
            market: {
              select: {
                id: true,
                name: true,
                status: true,
                eventId: true,
              },
            },
          },
        });

        if (!selection || selection.market.eventId !== eventId) {
          return error(
            reply,
            'SELECTION_NOT_FOUND',
            'Selection not found in this event',
            404,
          );
        }

        if (selection.status !== 'ACTIVE') {
          return error(
            reply,
            'SELECTION_SUSPENDED',
            `Selection "${selection.name}" is currently suspended`,
            400,
          );
        }

        if (selection.market.status !== 'OPEN') {
          return error(
            reply,
            'MARKET_SUSPENDED',
            `Market "${selection.market.name}" is currently suspended`,
            400,
          );
        }

        // Check odds change
        const currentOdds = selection.odds;
        const requestedOdds = new Prisma.Decimal(odds);

        if (!currentOdds.eq(requestedOdds)) {
          if (oddsChangePolicy === 'REJECT') {
            return error(
              reply,
              'ODDS_CHANGED',
              `Odds have changed from ${requestedOdds.toString()} to ${currentOdds.toString()}`,
              400,
            );
          }
          if (oddsChangePolicy === 'ACCEPT_HIGHER' && currentOdds.lt(requestedOdds)) {
            return error(
              reply,
              'ODDS_DECREASED',
              `Odds decreased from ${requestedOdds.toString()} to ${currentOdds.toString()}`,
              400,
            );
          }
          // ACCEPT_ANY: proceed with current odds
        }

        // Validate stake
        const stakeDecimal = new Prisma.Decimal(stake);
        if (stakeDecimal.lt(MIN_STAKE)) {
          return error(reply, 'STAKE_TOO_LOW', `Minimum stake is ${MIN_STAKE.toString()}`, 400);
        }

        const maxStake = selection.maxStake ?? MAX_STAKE_DEFAULT;
        if (stakeDecimal.gt(maxStake)) {
          return error(reply, 'STAKE_TOO_HIGH', `Maximum stake is ${maxStake.toString()}`, 400);
        }

        // Check user restrictions
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isBanned: true,
            selfExcludedUntil: true,
            coolingOffUntil: true,
          },
        });

        if (!user) {
          return error(reply, 'USER_NOT_FOUND', 'User not found', 404);
        }
        if (user.isBanned) {
          return error(reply, 'ACCOUNT_BANNED', 'Your account is banned', 403);
        }
        if (user.selfExcludedUntil && user.selfExcludedUntil > new Date()) {
          return error(reply, 'SELF_EXCLUDED', 'You have self-excluded from betting', 403);
        }
        if (user.coolingOffUntil && user.coolingOffUntil > new Date()) {
          return error(reply, 'COOLING_OFF', 'You are in a cooling-off period', 403);
        }

        // Atomic transaction: deduct balance + create live bet
        const potentialWin = stakeDecimal.mul(currentOdds);

        const bet = await prisma.$transaction(async (tx) => {
          // Find wallet
          const currencyRecord = await tx.currency.findUnique({
            where: { symbol: currency.toUpperCase() },
            select: { id: true },
          });

          if (!currencyRecord) {
            throw new LiveBetError(
              'CURRENCY_NOT_FOUND',
              `Currency "${currency}" not found`,
              404,
            );
          }

          const wallet = await tx.wallet.findUnique({
            where: {
              userId_currencyId: {
                userId,
                currencyId: currencyRecord.id,
              },
            },
          });

          if (!wallet) {
            throw new LiveBetError(
              'WALLET_NOT_FOUND',
              `No ${currency} wallet found`,
              404,
            );
          }

          const available = wallet.balance.minus(wallet.lockedBalance);
          if (available.lt(stakeDecimal)) {
            throw new LiveBetError(
              'INSUFFICIENT_BALANCE',
              `Insufficient balance. Available: ${available.toString()}`,
              400,
            );
          }

          // Deduct balance
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { decrement: stakeDecimal },
            },
          });

          // Create bet
          const createdBet = await tx.bet.create({
            data: {
              userId,
              type: 'SINGLE',
              stake: stakeDecimal,
              currencySymbol: currency.toUpperCase(),
              potentialWin,
              odds: currentOdds,
              status: 'ACCEPTED',
              isLive: true,
              isCashoutAvailable: true,
              ipAddress: request.ip,
              legs: {
                create: [
                  {
                    selectionId: selection.id,
                    eventName: event.name,
                    marketName: selection.market.name,
                    selectionName: selection.name,
                    oddsAtPlacement: currentOdds,
                    status: 'PENDING',
                  },
                ],
              },
            },
            include: {
              legs: true,
            },
          });

          // Record BET transaction
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'BET',
              amount: stakeDecimal.negated(),
              status: 'COMPLETED',
              metadata: {
                betId: createdBet.id,
                referenceId: createdBet.referenceId,
                type: 'LIVE_SINGLE',
                eventId,
                odds: currentOdds.toString(),
              },
            },
          });

          // Update market liability
          await tx.marketLiability.upsert({
            where: {
              id: `${selection.marketId}_${selection.id}`,
            },
            create: {
              id: `${selection.marketId}_${selection.id}`,
              marketId: selection.marketId,
              selectionId: selection.id,
              totalStake: stakeDecimal,
              potentialPayout: potentialWin,
              netExposure: potentialWin.minus(stakeDecimal),
            },
            update: {
              totalStake: { increment: stakeDecimal },
              potentialPayout: { increment: potentialWin },
              netExposure: { increment: potentialWin.minus(stakeDecimal) },
            },
          });

          return createdBet;
        });

        // Update user's total wagered (fire-and-forget)
        prisma.user
          .update({
            where: { id: userId },
            data: { totalWagered: { increment: stakeDecimal } },
          })
          .catch(() => {});

        return success(
          reply,
          {
            bet: {
              id: bet.id,
              referenceId: bet.referenceId,
              type: bet.type,
              stake: bet.stake.toString(),
              currency: bet.currencySymbol,
              odds: bet.odds.toString(),
              potentialWin: bet.potentialWin.toString(),
              status: bet.status,
              isLive: bet.isLive,
              legs: bet.legs.map((l) => ({
                id: l.id,
                selectionId: l.selectionId,
                eventName: l.eventName,
                marketName: l.marketName,
                selectionName: l.selectionName,
                oddsAtPlacement: l.oddsAtPlacement.toString(),
                status: l.status,
              })),
              createdAt: bet.createdAt.toISOString(),
            },
          },
          201,
        );
      } catch (err) {
        if (err instanceof LiveBetError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // LIVE STATS (general)
  // =======================================================================

  /**
   * GET /api/v1/live/stats - Get overall live betting stats
   *
   * Returns connected users, active live events, subscriber counts.
   */
  fastify.get(
    '/api/v1/live/stats',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const cacheKey = 'live:platform_stats';
        const cached = await redis.get(cacheKey);
        if (cached) {
          return success(reply, JSON.parse(cached));
        }

        const stats = await liveService.getLiveStats();
        await redis.set(cacheKey, JSON.stringify(stats), 'EX', CACHE_TTL_LIVE_STATS);
        return success(reply, stats);
      } catch (err) {
        throw err;
      }
    },
  );
}
