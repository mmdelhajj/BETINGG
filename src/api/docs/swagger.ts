import { FastifyInstance } from 'fastify';

export async function setupSwagger(app: FastifyInstance) {
  await app.register(require('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'CryptoBet Public API',
        description: `
## Overview
CryptoBet provides a REST API for programmatic access to sports betting, account management, and market data.

## Authentication
All trading and account endpoints require an API key. Include it in the \`X-API-Key\` header.

\`\`\`
X-API-Key: cb_your_api_key_here
\`\`\`

Generate an API key from your account settings or via the API key generation endpoint.

## Rate Limits
- **Feed endpoints** (sports, events, markets): 10 requests/second
- **Trading endpoints** (bets, cashout): 1 request/second
- **Account endpoints**: 5 requests/second

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Max requests per window
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Window reset time (Unix timestamp)

## Response Format
All responses follow a consistent format:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100, "hasMore": true }
}
\`\`\`

Error responses:
\`\`\`json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "Human-readable message" }
}
\`\`\`

## Odds Format
All odds are returned in **decimal format** (European). Convert as needed:
- **Fractional**: (decimal - 1) as fraction
- **American**: decimal >= 2 → (decimal - 1) * 100; decimal < 2 → -100 / (decimal - 1)

## WebSocket
Real-time updates (odds, scores) are available via Socket.IO at \`wss://api.cryptobet.com\`.
`,
        version: '1.0.0',
        contact: { name: 'CryptoBet API Support', email: 'api@cryptobet.com' },
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
        { url: 'https://api.cryptobet.com', description: 'Production' },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'Feed', description: 'Sports, events, and market data (public)' },
        { name: 'Trading', description: 'Bet placement and management (authenticated)' },
        { name: 'Account', description: 'Account and balance management (authenticated)' },
      ],
    },
  });

  await app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
  });

  // ─── Route Schemas ────────────────────────────────────
  // Sports
  app.get('/api/v1/sports', {
    schema: {
      tags: ['Feed'],
      summary: 'List all sports',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  iconUrl: { type: 'string', nullable: true },
                  _count: { type: 'object', properties: { competitions: { type: 'integer' } } },
                },
              },
            },
          },
        },
      },
    },
    handler: async () => ({ success: true, data: [] }), // Handled by v1.routes
  });

  // Events
  app.get('/api/v1/events/:id', {
    schema: {
      tags: ['Feed'],
      summary: 'Get event details',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    handler: async () => ({ success: true, data: null }),
  });

  // Place Bet
  app.post('/api/v1/bets/place', {
    schema: {
      tags: ['Trading'],
      summary: 'Place a bet',
      security: [{ ApiKeyAuth: [] }],
      body: {
        type: 'object',
        required: ['selections', 'stake', 'currency'],
        properties: {
          selections: {
            type: 'array',
            items: {
              type: 'object',
              required: ['selectionId'],
              properties: {
                selectionId: { type: 'string' },
                odds: { type: 'number', description: 'Expected odds (for change detection)' },
              },
            },
          },
          stake: { type: 'string', description: 'Stake amount as decimal string' },
          currency: { type: 'string', description: 'Currency code (BTC, ETH, USDT, etc.)' },
          type: { type: 'string', enum: ['SINGLE', 'PARLAY', 'SYSTEM'] },
          oddsChangePolicy: { type: 'string', enum: ['ACCEPT_ANY', 'ACCEPT_BETTER', 'NONE'] },
        },
      },
    },
    handler: async () => ({ success: true, data: null }),
  });

  // Bet Status
  app.get('/api/v1/bets/:referenceId/status', {
    schema: {
      tags: ['Trading'],
      summary: 'Get bet status',
      security: [{ ApiKeyAuth: [] }],
      params: { type: 'object', properties: { referenceId: { type: 'string' } }, required: ['referenceId'] },
    },
    handler: async () => ({ success: true, data: null }),
  });

  // Balance
  app.get('/api/v1/account/currencies/:symbol/balance', {
    schema: {
      tags: ['Account'],
      summary: 'Get balance for a specific currency',
      security: [{ ApiKeyAuth: [] }],
      params: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] },
    },
    handler: async () => ({ success: true, data: null }),
  });
}
