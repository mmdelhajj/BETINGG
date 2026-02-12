import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { initializeSocketIO } from './lib/socket';
import { errorHandler } from './middleware/errorHandler';
import { initQueues, createWorker } from './queues';
import { processBet } from './queues/betProcessing.worker';
import { settleBets } from './queues/betSettlement.worker';
import { calculateReward } from './queues/rewardCalculation.worker';
import { processWithdrawal } from './queues/withdrawalProcessing.worker';
import { detectDeposit } from './queues/depositDetection.worker';
import { sendNotification } from './queues/notificationSender.worker';
import { QUEUE_NAMES, RATE_LIMITS } from './config/constants';
import { startOddsSyncScheduler, stopOddsSyncScheduler } from './services/oddsApi';

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
  });

  // Plugins
  await app.register(cors, {
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(rateLimit, {
    max: RATE_LIMITS.GLOBAL.max,
    timeWindow: RATE_LIMITS.GLOBAL.timeWindow,
  });

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CryptoBet API',
        description: 'Crypto Sportsbook & Casino Platform API',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Health check endpoints
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.get('/health/db', async () => {
    const { prisma } = await import('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  });

  app.get('/health/redis', async () => {
    const { redis } = await import('./lib/redis');
    const pong = await redis.ping();
    return { status: 'ok', redis: pong };
  });

  // Register API routes (will be populated by subsequent agents)
  // Auth routes
  try {
    const authRoutes = await import('./modules/auth/auth.routes');
    await app.register(authRoutes.default, { prefix: '/api/v1/auth' });
  } catch { /* Will be available after Agent 2 */ }

  // User routes
  try {
    const userRoutes = await import('./modules/users/user.routes');
    await app.register(userRoutes.default, { prefix: '/api/v1/users' });
  } catch { /* Will be available after Agent 2 */ }

  // Wallet routes
  try {
    const walletRoutes = await import('./modules/wallets/wallet.routes');
    await app.register(walletRoutes.default, { prefix: '/api/v1/wallets' });
  } catch { /* Will be available after Agent 2 */ }

  // KYC routes
  try {
    const kycRoutes = await import('./modules/kyc/kyc.routes');
    await app.register(kycRoutes.default, { prefix: '/api/v1/kyc' });
  } catch { /* Will be available after Agent 2 */ }

  // Sports routes
  try {
    const sportsRoutes = await import('./modules/sports/sports.routes');
    await app.register(sportsRoutes.default, { prefix: '/api/v1/sports' });
  } catch { /* Will be available after Agent 3 */ }

  // Betting routes
  try {
    const bettingRoutes = await import('./modules/betting/betting.routes');
    await app.register(bettingRoutes.default, { prefix: '/api/v1/betting' });
  } catch { /* Will be available after Agent 3 */ }

  // Casino routes
  try {
    const casinoRoutes = await import('./modules/casino/casino.routes');
    await app.register(casinoRoutes.default, { prefix: '/api/v1/casino' });
  } catch { /* Will be available after Agent 4 */ }

  // VIP routes
  try {
    const vipRoutes = await import('./modules/vip/vip.routes');
    await app.register(vipRoutes.default, { prefix: '/api/v1/vip' });
  } catch { /* Will be available after Agent 5 */ }

  // Rewards routes
  try {
    const rewardsRoutes = await import('./modules/rewards/rewards.routes');
    await app.register(rewardsRoutes.default, { prefix: '/api/v1/rewards' });
  } catch { /* Will be available after Agent 5 */ }

  // Promotions routes
  try {
    const promoRoutes = await import('./modules/promotions/promotions.routes');
    await app.register(promoRoutes.default, { prefix: '/api/v1/promotions' });
  } catch { /* Will be available after Agent 5 */ }

  // Referrals routes
  try {
    const referralRoutes = await import('./modules/referrals/referral.routes');
    await app.register(referralRoutes.default, { prefix: '/api/v1/referrals' });
  } catch { /* Will be available after Agent 5 */ }

  // Notifications routes
  try {
    const notifRoutes = await import('./modules/notifications/notification.routes');
    await app.register(notifRoutes.default, { prefix: '/api/v1/notifications' });
  } catch { /* Will be available after Agent 5 */ }

  // Blog routes
  try {
    const blogRoutes = await import('./modules/blog/blog.routes');
    await app.register(blogRoutes.default, { prefix: '/api/v1/blog' });
  } catch { /* Will be available after Agent 8 */ }

  // Academy routes
  try {
    const academyRoutes = await import('./modules/academy/academy.routes');
    await app.register(academyRoutes.default, { prefix: '/api/v1/academy' });
  } catch { /* Will be available after Agent 8 */ }

  // Admin routes
  try {
    const adminRoutes = await import('./api/rest/admin.routes');
    await app.register(adminRoutes.default, { prefix: '/api/v1/admin' });
  } catch { /* Will be available after Agent 8 */ }

  // Public API routes
  try {
    const publicApiRoutes = await import('./api/rest/public.routes');
    await app.register(publicApiRoutes.default, { prefix: '/api/v1' });
  } catch { /* Will be available after Agent 8 */ }

  // Help center routes
  try {
    const helpRoutes = await import('./modules/help/help.routes');
    await app.register(helpRoutes.default, { prefix: '/api/v1/help' });
  } catch { /* Will be available after Agent 8 */ }

  // Affiliate routes
  try {
    const affiliateRoutes = await import('./modules/affiliates/affiliate.routes');
    await app.register(affiliateRoutes.default, { prefix: '/api/v1/affiliates' });
  } catch { /* Will be available after Agent 8 */ }

  // Virtual Sports routes
  try {
    const virtualSportsRoutes = await import('./modules/virtual-sports/virtualSports.routes');
    await app.register(virtualSportsRoutes.default, { prefix: '/api/v1/virtual-sports' });
  } catch { /* Will be available after Agent 8 */ }

  // GraphQL API
  try {
    const { setupGraphQL } = await import('./api/graphql/index');
    await setupGraphQL(app);
  } catch { /* Will be available after Agent 8 */ }

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();

  // Initialize BullMQ queues
  initQueues();

  // Register queue workers
  createWorker(QUEUE_NAMES.BET_PROCESSING, processBet, 3);
  createWorker(QUEUE_NAMES.BET_SETTLEMENT, settleBets, 2);
  createWorker(QUEUE_NAMES.REWARD_CALCULATION, calculateReward, 2);
  createWorker(QUEUE_NAMES.WITHDRAWAL_PROCESSING, processWithdrawal, 1);
  createWorker(QUEUE_NAMES.DEPOSIT_DETECTION, detectDeposit, 2);
  createWorker(QUEUE_NAMES.NOTIFICATION_SENDER, sendNotification, 3);

  // Initialize The Odds API sync scheduler
  try {
    startOddsSyncScheduler();
    console.log('Odds sync scheduler started');
  } catch (err) {
    console.warn('Failed to start odds sync scheduler:', (err as Error).message);
    console.warn('Odds sync will be unavailable. Use POST /api/v1/admin/odds/sync for manual sync.');
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    stopOddsSyncScheduler();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: PORT, host: HOST });
  console.log(`CryptoBet server running on http://${HOST}:${PORT}`);
  console.log(`API docs: http://${HOST}:${PORT}/docs`);

  // Attach Socket.IO to Fastify's underlying Node HTTP server
  // This must happen after app.listen() so that app.server is bound.
  initializeSocketIO(app.server);
  console.log('Socket.IO attached to server');
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { buildServer };
