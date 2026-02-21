import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { createServer } from 'http';
import { config } from './config/index.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { setupSocketIO } from './lib/socket.js';
import { setupQueues, closeQueues } from './queues/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger, requestLogger } from './middleware/logger.js';

// Casino services
import { crashGameService } from './modules/casino/games/crash/crash.service.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import walletRoutes from './modules/wallets/wallet.routes.js';
import kycRoutes from './modules/kyc/kyc.routes.js';
import sportsRoutes from './modules/sports/sports.routes.js';
import bettingRoutes from './modules/betting/betting.routes.js';
import casinoRoutes from './modules/casino/casino.routes.js';
import oddsRoutes from './modules/odds/odds.routes.js';
import vipRoutes from './modules/vip/vip.routes.js';
import rewardsRoutes from './modules/rewards/rewards.routes.js';
import promotionsRoutes from './modules/promotions/promotions.routes.js';
import referralsRoutes from './modules/referrals/referrals.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import blogRoutes from './modules/blog/blog.routes.js';
import helpRoutes from './modules/help/help.routes.js';
import academyRoutes from './modules/academy/academy.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import liveRoutes from './modules/live/live.routes.js';
import chatRoutes from './modules/live/chat.routes.js';
import pulseRoutes from './modules/pulse/pulse.routes.js';

// ---------------------------------------------------------------------------
// Create HTTP server first, then Fastify with serverFactory
// ---------------------------------------------------------------------------

const httpServer = createServer();

const app = Fastify({
  logger: false, // We use our own pino logger via the requestLogger hook
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024, // 10 MB
  serverFactory: (handler) => {
    httpServer.on('request', handler);
    return httpServer;
  },
});

// ---------------------------------------------------------------------------
// Register plugins
// ---------------------------------------------------------------------------

async function registerPlugins(): Promise<void> {
  // CORS - allow frontend origin with credentials
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  });

  // Global rate limiting: 500 requests per minute per IP (generous for dev/testing)
  await app.register(rateLimit, {
    max: 500,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Maximum ${context.max} requests per ${context.after}. Please try again later.`,
        details: {
          limit: context.max,
          remaining: 0,
          retryAfter: context.after,
        },
      },
    }),
  });

  // Swagger API documentation
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'CryptoBet API',
        description: 'CryptoBet Platform - Crypto Sportsbook & Casino API',
        version: '1.0.0',
        contact: {
          name: 'CryptoBet Team',
          url: 'https://cryptobet.com',
        },
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token obtained from /api/v1/auth/login',
          },
        },
      },
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Auth', description: 'Authentication & authorization' },
        { name: 'Users', description: 'User management' },
        { name: 'Wallets', description: 'Crypto wallet operations' },
        { name: 'Betting', description: 'Sports betting' },
        { name: 'Casino', description: 'Casino games' },
        { name: 'VIP', description: 'VIP & rewards system' },
        { name: 'Admin', description: 'Admin dashboard' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: true,
  });

  // Cookie support (for refresh tokens)
  await app.register(cookie, {
    secret: config.JWT_SECRET,
    parseOptions: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  });

  // Multipart file upload support (10 MB limit)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 5,
      fieldSize: 1024 * 1024, // 1 MB
    },
  });
}

// ---------------------------------------------------------------------------
// Register hooks & error handler
// ---------------------------------------------------------------------------

function registerHooks(): void {
  // Disable browser caching for API responses
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    reply.header('Pragma', 'no-cache');
    return payload;
  });

  // Request logging on response
  app.addHook('onResponse', requestLogger);

  // Handle empty JSON bodies on DELETE requests (frontend sends Content-Type: application/json with no body)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, function (_req, body, done) {
    try {
      const str = (body as string || '').trim();
      if (!str) {
        done(null, {});
        return;
      }
      const json = JSON.parse(str);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Custom error handler
  app.setErrorHandler(errorHandler as any);
}

// ---------------------------------------------------------------------------
// Health check endpoints
// ---------------------------------------------------------------------------

function registerHealthRoutes(): void {
  // Basic health check
  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Basic health check',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                timestamp: { type: 'string' },
                uptime: { type: 'number' },
                environment: { type: 'string' },
                version: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
        version: '1.0.0',
      },
    };
  });

  // Database health check
  app.get('/health/db', {
    schema: {
      tags: ['Health'],
      summary: 'Database connectivity check',
    },
  }, async (_request, reply) => {
    try {
      const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;
      return {
        success: true,
        data: {
          status: 'connected',
          timestamp: result[0].now.toISOString(),
          latency: 'ok',
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err }, 'Database health check failed');
      void reply.status(503);
      return {
        success: false,
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: config.NODE_ENV === 'production'
            ? 'Database is unavailable'
            : `Database connection failed: ${message}`,
        },
      };
    }
  });

  // Redis health check
  app.get('/health/redis', {
    schema: {
      tags: ['Health'],
      summary: 'Redis connectivity check',
    },
  }, async (_request, reply) => {
    try {
      const start = Date.now();
      const pong = await redis.ping();
      const latency = Date.now() - start;

      return {
        success: true,
        data: {
          status: 'connected',
          response: pong,
          latencyMs: latency,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err }, 'Redis health check failed');
      void reply.status(503);
      return {
        success: false,
        error: {
          code: 'REDIS_UNAVAILABLE',
          message: config.NODE_ENV === 'production'
            ? 'Redis is unavailable'
            : `Redis connection failed: ${message}`,
        },
      };
    }
  });
}

// ---------------------------------------------------------------------------
// Attach Socket.IO to the shared HTTP server
// ---------------------------------------------------------------------------

const io = setupSocketIO(httpServer);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, `Received ${signal}. Starting graceful shutdown...`);

  try {
    // 0. Stop crash game loop and stale event settlement
    logger.info('Stopping crash game loop...');
    crashGameService.shutdown();

    // Stop event status transition cron
    try {
      const { stopEventStatusTransition } = await import('./services/event-status-transition.js');
      stopEventStatusTransition();
    } catch { /* may not be loaded */ }

    // Stop stale event settlement cron
    try {
      const { stopStaleEventSettlement } = await import('./services/stale-event-settlement.js');
      stopStaleEventSettlement();
    } catch { /* may not be loaded */ }

    // 1. Close queues and workers
    logger.info('Closing BullMQ queues...');
    await closeQueues();

    // 2. Close Fastify (stops accepting new connections)
    logger.info('Closing Fastify server...');
    await app.close();

    // 3. Close Redis
    logger.info('Closing Redis connection...');
    await redis.quit();

    // 4. Close Prisma
    logger.info('Closing Prisma connection...');
    await prisma.$disconnect();

    // 5. Close HTTP server
    logger.info('Closing HTTP server...');
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info('Graceful shutdown complete.');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  // Log but don't crash — background services (BetsAPI sync, Cloudbet sync) can
  // produce transient Prisma errors that shouldn't take down the whole server.
  logger.error({ err: reason }, 'Unhandled rejection (non-fatal)');
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  try {
    // Register all plugins
    await registerPlugins();

    // Register hooks and error handler
    registerHooks();

    // Register health check routes
    registerHealthRoutes();

    // -----------------------------------------------------------------------
    // Register API v1 routes
    // Modules with full paths (already include /api/v1/...) — no prefix
    // Modules with relative paths — register with prefix
    // -----------------------------------------------------------------------

    // Full-path modules (paths already include /api/v1/...)
    await app.register(authRoutes);          // /api/v1/auth/*
    await app.register(walletRoutes);        // /api/v1/wallets/*
    await app.register(casinoRoutes);        // /api/v1/casino/*
    await app.register(vipRoutes);           // /api/v1/vip/*
    await app.register(rewardsRoutes);       // /api/v1/rewards/*
    await app.register(promotionsRoutes);    // /api/v1/promotions/*
    await app.register(referralsRoutes);     // /api/v1/referrals/*
    await app.register(blogRoutes);          // /api/v1/blog/*
    await app.register(helpRoutes);          // /api/v1/help/*
    await app.register(academyRoutes);       // /api/v1/academy/*
    await app.register(chatRoutes);          // /api/v1/chat/*
    await app.register(pulseRoutes);         // /api/v1/pulse/*

    // Relative-path modules — need prefix
    await app.register(userRoutes, { prefix: '/api/v1/users' });
    await app.register(kycRoutes, { prefix: '/api/v1/kyc' });
    await app.register(sportsRoutes, { prefix: '/api/v1' });
    await app.register(bettingRoutes, { prefix: '/api/v1/betting' });
    await app.register(oddsRoutes, { prefix: '/api/v1/odds' });
    await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
    await app.register(liveRoutes, { prefix: '/api/v1/live' });

    // Admin module (uses /admin/... paths)
    await app.register(adminRoutes, { prefix: '/api/v1' });

    logger.info('All API routes registered');

    // Setup BullMQ queues and workers
    await setupQueues();

    // Wait for Fastify to be ready (compiles schemas, finishes plugin loading)
    await app.ready();

    logger.info('Swagger documentation available at /docs');

    // Start listening (Fastify uses our httpServer via serverFactory)
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(
      {
        port: config.PORT,
        env: config.NODE_ENV,
        pid: process.pid,
      },
      `CryptoBet API server listening on http://0.0.0.0:${config.PORT}`,
    );

    // Start Cloudbet Feed API integration (live polling first, full sync deferred)
    try {
      const { startCloudbetLiveSync, cloudbetFullSync } = await import('./services/cloudbet.js');
      // Start live polling immediately — this is the priority
      startCloudbetLiveSync();
      logger.info('Cloudbet: Live sync started');
      // Defer full sync by 30 seconds to let live sync settle
      setTimeout(async () => {
        try {
          await cloudbetFullSync();
          logger.info('Cloudbet: Full sync completed');
        } catch (err) {
          logger.warn({ err }, 'Cloudbet: Deferred full sync failed');
        }
      }, 30 * 1000);
    } catch (err) {
      logger.warn({ err }, 'Cloudbet integration could not be started');
    }

    // BetsAPI integration (Events API $150/mo — live scores, match data)
    if (process.env.BETSAPI_TOKEN) {
      try {
        const { startBetsAPILiveSync, startBetsAPIFullSync } = await import('./services/betsapi.js');
        startBetsAPILiveSync();
        logger.info('BetsAPI: Live sync started');
        setTimeout(async () => {
          try {
            startBetsAPIFullSync();
            logger.info('BetsAPI: Full sync started');
          } catch (err) {
            logger.warn({ err }, 'BetsAPI: Deferred full sync failed');
          }
        }, 60 * 1000);
      } catch (err) {
        logger.warn({ err }, 'BetsAPI integration could not be started');
      }
    } else {
      logger.info('BetsAPI: Skipped (no BETSAPI_TOKEN set). Using Cloudbet as sole odds provider.');
    }

    // -----------------------------------------------------------------------
    // Start event status transition (UPCOMING -> LIVE) every 60 seconds
    // Catches events whose startTime has passed but are still UPCOMING
    // -----------------------------------------------------------------------
    try {
      const { startEventStatusTransition } = await import('./services/event-status-transition.js');
      startEventStatusTransition();
      logger.info('Event status transition cron started (every 60 seconds)');
    } catch (err) {
      logger.warn({ err }, 'Event status transition cron could not be started');
    }

    // -----------------------------------------------------------------------
    // Start stale event settlement cron (every 5 minutes)
    // Catches events that started hours/days ago and are still UPCOMING/LIVE
    // -----------------------------------------------------------------------
    try {
      const { startStaleEventSettlement } = await import('./services/stale-event-settlement.js');
      startStaleEventSettlement();
      logger.info('Stale event settlement cron started (every 5 minutes)');
    } catch (err) {
      logger.warn({ err }, 'Stale event settlement cron could not be started');
    }

    // -----------------------------------------------------------------------
    // Initialize Crash game loop (multiplayer, Socket.IO driven)
    // -----------------------------------------------------------------------
    try {
      const casinoNsp = io.of('/casino');
      crashGameService.setBroadcast((event: string, data: any) => {
        casinoNsp.emit(event, data);
      });
      await crashGameService.init();
      logger.info('Crash game loop initialized and running');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize crash game loop');
    }
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void start();

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { app, io, httpServer };
export default app;
