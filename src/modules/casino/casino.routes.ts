import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { casinoService } from './casino.service';
import { provablyFairService } from './provablyFair';
import { providerAdapter } from './provider.adapter';
import { diceGameService } from './games/dice/dice.service';
import { coinflipGameService } from './games/coinflip/coinflip.service';
import { minesGameService } from './games/mines/mines.service';
import { plinkoGameService } from './games/plinko/plinko.service';
import { crashGameService } from './games/crash/crash.service';
import { authMiddleware, adminGuard } from '../../middleware/auth';
import { sendSuccess, sendCreated } from '../../utils/response';

export default async function casinoRoutes(app: FastifyInstance): Promise<void> {
  // ─── GAME CATALOG ──────────────────────────────────────────────
  app.get('/games', async (request, reply) => {
    const query = z.object({
      category: z.string().optional(),
      provider: z.string().optional(),
      search: z.string().optional(),
      type: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);
    const result = await casinoService.getGames(query);
    sendSuccess(reply, result);
  });

  app.get('/games/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const game = await casinoService.getGameBySlug(slug);
    sendSuccess(reply, game);
  });

  app.get('/categories', async (request, reply) => {
    const categories = await casinoService.getCategories();
    sendSuccess(reply, categories);
  });

  app.get('/providers', async (request, reply) => {
    const providers = await casinoService.getProviders();
    sendSuccess(reply, providers);
  });

  app.get('/recently-played', { preHandler: [authMiddleware] }, async (request, reply) => {
    const games = await casinoService.getRecentlyPlayed(request.user!.userId);
    sendSuccess(reply, games);
  });

  app.post('/favorites/:gameId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { gameId } = z.object({ gameId: z.string() }).parse(request.params);
    const result = await casinoService.toggleFavorite(request.user!.userId, gameId);
    sendSuccess(reply, result);
  });

  // ─── GAME LAUNCH ──────────────────────────────────────────────
  app.post('/launch', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      gameId: z.string(),
      currency: z.string().default('USDT'),
      demo: z.boolean().default(false),
    }).parse(request.body);
    const result = await providerAdapter.launchGame(
      request.user!.userId, body.gameId, body.currency, body.demo
    );
    sendSuccess(reply, result);
  });

  // ─── PROVABLY FAIR ────────────────────────────────────────────
  app.get('/fairness/seeds', { preHandler: [authMiddleware] }, async (request, reply) => {
    const seed = await provablyFairService.getActiveSeeds(request.user!.userId);
    sendSuccess(reply, seed);
  });

  app.post('/fairness/client-seed', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { clientSeed } = z.object({ clientSeed: z.string().min(1).max(64) }).parse(request.body);
    const result = await provablyFairService.setClientSeed(request.user!.userId, clientSeed);
    sendSuccess(reply, result);
  });

  app.post('/fairness/rotate', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await provablyFairService.rotateSeeds(request.user!.userId);
    sendSuccess(reply, result);
  });

  app.get('/fairness/history', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }).parse(request.query);
    const history = await provablyFairService.getSeedHistory(request.user!.userId, query.limit);
    sendSuccess(reply, history);
  });

  // ─── DICE ─────────────────────────────────────────────────────
  app.post('/dice/play', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      currency: z.string().default('USDT'),
      stake: z.string(),
      target: z.number().min(1).max(98),
      isOver: z.boolean(),
    }).parse(request.body);
    const result = await diceGameService.play(
      request.user!.userId, body.currency, body.stake, body.target, body.isOver
    );
    sendSuccess(reply, result);
  });

  // ─── COINFLIP ─────────────────────────────────────────────────
  app.post('/coinflip/play', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      currency: z.string().default('USDT'),
      stake: z.string(),
      choice: z.enum(['heads', 'tails']),
    }).parse(request.body);
    const result = await coinflipGameService.play(
      request.user!.userId, body.currency, body.stake, body.choice
    );
    sendSuccess(reply, result);
  });

  // ─── MINES ────────────────────────────────────────────────────
  app.post('/mines/start', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      currency: z.string().default('USDT'),
      stake: z.string(),
      mineCount: z.number().int().min(1).max(24),
    }).parse(request.body);
    const result = await minesGameService.startGame(
      request.user!.userId, body.currency, body.stake, body.mineCount
    );
    sendCreated(reply, result);
  });

  app.post('/mines/reveal', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { position } = z.object({ position: z.number().int().min(0).max(24) }).parse(request.body);
    const result = await minesGameService.revealTile(request.user!.userId, position);
    sendSuccess(reply, result);
  });

  app.post('/mines/cashout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await minesGameService.cashout(request.user!.userId);
    sendSuccess(reply, result);
  });

  // ─── PLINKO ───────────────────────────────────────────────────
  app.post('/plinko/play', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      currency: z.string().default('USDT'),
      stake: z.string(),
      rows: z.number().refine((v) => [8, 12, 16].includes(v)),
      risk: z.enum(['low', 'medium', 'high']),
    }).parse(request.body);
    const result = await plinkoGameService.play(
      request.user!.userId, body.currency, body.stake, body.rows, body.risk
    );
    sendSuccess(reply, result);
  });

  app.get('/plinko/multipliers', async (request, reply) => {
    const query = z.object({
      rows: z.coerce.number().refine((v) => [8, 12, 16].includes(v)),
      risk: z.enum(['low', 'medium', 'high']),
    }).parse(request.query);
    const multipliers = plinkoGameService.getMultipliers(query.rows, query.risk);
    sendSuccess(reply, { multipliers });
  });

  // ─── CRASH ────────────────────────────────────────────────────
  app.post('/crash/bet', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      currency: z.string().default('USDT'),
      stake: z.string(),
      autoCashout: z.number().optional(),
    }).parse(request.body);
    const result = await crashGameService.placeBet(
      request.user!.userId, body.currency, body.stake, body.autoCashout
    );
    sendSuccess(reply, result);
  });

  app.post('/crash/cashout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await crashGameService.cashout(request.user!.userId);
    sendSuccess(reply, result);
  });

  app.get('/crash/status', async (request, reply) => {
    const status = await crashGameService.getState();
    sendSuccess(reply, status);
  });

  app.get('/crash/history', async (request, reply) => {
    const history = await crashGameService.getHistory();
    sendSuccess(reply, history);
  });
}
