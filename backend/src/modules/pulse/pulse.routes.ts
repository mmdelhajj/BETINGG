import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as pulseService from './pulse.service.js';
import type { TimeWindow } from './pulse.service.js';

// ---------------------------------------------------------------------------
// Querystring types
// ---------------------------------------------------------------------------

interface TopEarnersQuery {
  window?: string;
  limit?: string;
}

interface TrendingBetsQuery {
  sport?: string;
  limit?: string;
}

// ---------------------------------------------------------------------------
// Valid time window values
// ---------------------------------------------------------------------------

const VALID_WINDOWS = new Set<string>(['today', 'week', 'month', 'all']);

function isValidWindow(value: string): value is TimeWindow {
  return VALID_WINDOWS.has(value);
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function pulseRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/pulse/top-earners ── public (no auth required)
  app.get(
    '/api/v1/pulse/top-earners',
    {
      schema: {
        tags: ['Pulse'],
        summary: 'Get top earning users for a time window',
        description:
          'Returns a leaderboard of the top earning users (anonymized) by total winnings. ' +
          'Results are cached for 5 minutes.',
        querystring: {
          type: 'object',
          properties: {
            window: {
              type: 'string',
              enum: ['today', 'week', 'month', 'all'],
              default: 'today',
              description: 'Time window for leaderboard',
            },
            limit: {
              type: 'string',
              default: '10',
              description: 'Number of results (max 50)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  window: { type: 'string' },
                  earners: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        rank: { type: 'number' },
                        username: { type: 'string' },
                        totalWon: { type: 'string' },
                        totalBets: { type: 'number' },
                        wonBets: { type: 'number' },
                        winRate: { type: 'number' },
                        vipTier: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: TopEarnersQuery }>,
      _reply: FastifyReply,
    ) => {
      const windowParam = (request.query.window ?? 'today').toLowerCase();
      const window: TimeWindow = isValidWindow(windowParam) ? windowParam : 'today';
      const limit = Math.max(1, Math.min(50, parseInt(request.query.limit ?? '10', 10) || 10));

      const earners = await pulseService.getTopEarners(window, limit);

      return {
        success: true,
        data: {
          window,
          earners,
        },
      };
    },
  );

  // ── GET /api/v1/pulse/trending ── public (no auth required)
  app.get(
    '/api/v1/pulse/trending',
    {
      schema: {
        tags: ['Pulse'],
        summary: 'Get trending / noteworthy winning bets',
        description:
          'Returns recent winning bets ranked by impressiveness (high odds and big payouts). ' +
          'Optionally filtered by sport. Results are cached for 2 minutes.',
        querystring: {
          type: 'object',
          properties: {
            sport: {
              type: 'string',
              description: 'Sport slug to filter by (e.g., "football", "basketball")',
            },
            limit: {
              type: 'string',
              default: '20',
              description: 'Number of results (max 50)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  sport: { type: ['string', 'null'] },
                  bets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        eventName: { type: 'string' },
                        selection: { type: 'string' },
                        odds: { type: 'string' },
                        stake: { type: 'string' },
                        winAmount: { type: 'string' },
                        currency: { type: 'string' },
                        isParlay: { type: 'boolean' },
                        legCount: { type: 'number' },
                        sport: { type: ['string', 'null'] },
                        sportSlug: { type: ['string', 'null'] },
                        timestamp: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: TrendingBetsQuery }>,
      _reply: FastifyReply,
    ) => {
      const sportSlug = request.query.sport?.trim() || undefined;
      const limit = Math.max(1, Math.min(50, parseInt(request.query.limit ?? '20', 10) || 20));

      const bets = await pulseService.getTrendingBets(sportSlug, limit);

      return {
        success: true,
        data: {
          sport: sportSlug ?? null,
          bets,
        },
      };
    },
  );
}
