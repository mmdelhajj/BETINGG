import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { ProvablyFairService } from '../../services/casino/ProvablyFairService.js';
import { GameError } from '../../services/casino/BaseGame.js';
import { gameRegistry } from '../../services/casino/GameRegistry.js';
import { crashGameService } from './games/crash/crash.service.js';
import { minesGame } from './games/mines/mines.service.js';
import { blackjackGame } from './games/blackjack/blackjack.service.js';
import { hiLoGame } from './games/hilo/hilo.service.js';
import { towerGame } from './games/tower/tower.service.js';
import { videoPokerGame } from './games/videopoker/videopoker.service.js';
import { autoBetService } from './autobet.service.js';
import { jackpotService } from './jackpot.service.js';
import { liveFeedService } from './livefeed.service.js';
import { dragonTowerGame } from './games/dragontower/dragontower.service.js';
import { pokerGame } from './games/poker/poker.service.js';
import { trenballGame } from './games/trenball/trenball.service.js';
import { getActiveVirtualMatches } from './games/virtualsports/virtualsports.service.js';
import { tournamentService } from './tournament.service.js';

const fairService = new ProvablyFairService();

// ---------------------------------------------------------------------------
// Helper: standard error response
// ---------------------------------------------------------------------------

function errorResponse(reply: FastifyReply, err: unknown): void {
  if (err instanceof GameError) {
    void reply.status(400).send({
      success: false,
      error: { code: err.code, message: err.message },
    });
  } else {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Casino] Unhandled error:', err);
    void reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper: normalize bet body — accept both `amount` and `betAmount`
// ---------------------------------------------------------------------------

function normalizeBetAmount(body: any): number {
  const raw = body.amount ?? body.betAmount;
  if (raw === undefined || raw === null) {
    throw new GameError('BET_INVALID', 'Missing required field "amount" (or "betAmount").');
  }
  const amount = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new GameError('BET_INVALID', 'Bet amount must be a valid number.');
  }
  return amount;
}

export default async function casinoRoutes(app: FastifyInstance): Promise<void> {
  // =========================================================================
  // PROVABLY FAIR
  // =========================================================================

  /**
   * GET /api/v1/casino/fairness/seed — get active seed pair (hash only)
   */
  app.get(
    '/api/v1/casino/fairness/seed',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        let seed = await prisma.provablyFairSeed.findFirst({
          where: { userId, isRevealed: false },
          orderBy: { createdAt: 'desc' },
        });

        if (!seed) {
          const { seed: serverSeed, hash } = fairService.generateServerSeed();
          seed = await prisma.provablyFairSeed.create({
            data: {
              userId,
              serverSeed,
              serverSeedHash: hash,
              clientSeed: crypto.randomBytes(16).toString('hex'),
              nonce: 0,
            },
          });
        }

        return {
          success: true,
          data: {
            serverSeedHash: seed.serverSeedHash,
            clientSeed: seed.clientSeed,
            nonce: seed.nonce,
            createdAt: seed.createdAt,
          },
        };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/fairness/rotate — rotate server seed
   * Reveals the current server seed and creates a new one.
   */
  app.post(
    '/api/v1/casino/fairness/rotate',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;

        // Reveal current seed
        const currentSeed = await prisma.provablyFairSeed.findFirst({
          where: { userId, isRevealed: false },
          orderBy: { createdAt: 'desc' },
        });

        let revealedSeed = null;
        if (currentSeed) {
          revealedSeed = await prisma.provablyFairSeed.update({
            where: { id: currentSeed.id },
            data: { isRevealed: true, revealedAt: new Date() },
          });
        }

        // Create new seed
        const { seed: serverSeed, hash } = fairService.generateServerSeed();
        const newSeed = await prisma.provablyFairSeed.create({
          data: {
            userId,
            serverSeed,
            serverSeedHash: hash,
            clientSeed: currentSeed?.clientSeed ?? crypto.randomBytes(16).toString('hex'),
            nonce: 0,
          },
        });

        return {
          success: true,
          data: {
            previous: revealedSeed
              ? {
                  serverSeed: revealedSeed.serverSeed,
                  serverSeedHash: revealedSeed.serverSeedHash,
                  clientSeed: revealedSeed.clientSeed,
                  nonce: revealedSeed.nonce,
                }
              : null,
            current: {
              serverSeedHash: newSeed.serverSeedHash,
              clientSeed: newSeed.clientSeed,
              nonce: newSeed.nonce,
            },
          },
        };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/fairness/client-seed — set client seed
   */
  app.post(
    '/api/v1/casino/fairness/client-seed',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { clientSeed: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { clientSeed } = request.body;

        if (!clientSeed || typeof clientSeed !== 'string' || clientSeed.length < 1 || clientSeed.length > 64) {
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_CLIENT_SEED', message: 'Client seed must be 1-64 characters.' },
          });
        }

        const seed = await prisma.provablyFairSeed.findFirst({
          where: { userId, isRevealed: false },
          orderBy: { createdAt: 'desc' },
        });

        if (!seed) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NO_ACTIVE_SEED', message: 'No active seed pair found.' },
          });
        }

        await prisma.provablyFairSeed.update({
          where: { id: seed.id },
          data: { clientSeed },
        });

        return {
          success: true,
          data: { clientSeed, serverSeedHash: seed.serverSeedHash },
        };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/fairness/verify — verify a past game
   */
  app.post(
    '/api/v1/casino/fairness/verify',
    async (
      request: FastifyRequest<{
        Body: { serverSeed: string; clientSeed: string; nonce: number; gameType: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { serverSeed, clientSeed, nonce, gameType } = request.body;

        if (!serverSeed || !clientSeed || nonce === undefined || !gameType) {
          return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_PARAMS', message: 'All parameters are required.' },
          });
        }

        const result = fairService.verify(serverSeed, clientSeed, nonce, gameType);

        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // GAMES CATALOG
  // =========================================================================

  /**
   * GET /api/v1/casino/games — list all games
   */
  app.get(
    '/api/v1/casino/games',
    async (
      request: FastifyRequest<{
        Querystring: { type?: string; category?: string; search?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { type, category, search } = request.query;

        const where: any = { isActive: true };
        if (type) where.type = type.toUpperCase();
        if (category) where.category = category;
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
            { tags: { has: search.toLowerCase() } },
          ];
        }

        const games = await prisma.casinoGame.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { playCount: 'desc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            category: true,
            rtp: true,
            houseEdge: true,
            thumbnail: true,
            description: true,
            tags: true,
            isProvablyFair: true,
            isDemoAvailable: true,
            playCount: true,
          },
        });

        // Merge with in-memory game data from registry
        const registryData = gameRegistry.getCatalog();
        const registryMap = new Map(registryData.map((g) => [g.slug, g]));

        const enriched = games.map((g) => {
          const regData = registryMap.get(g.slug);
          return {
            ...g,
            rtp: g.rtp?.toNumber(),
            houseEdge: regData?.houseEdge ?? g.houseEdge?.toNumber(),
            minBet: regData?.minBet ?? 0.01,
            maxBet: regData?.maxBet ?? 10000,
          };
        });

        return { success: true, data: enriched };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/games/:slug — game details
   */
  app.get(
    '/api/v1/casino/games/:slug',
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = request.params;

        const game = await prisma.casinoGame.findUnique({
          where: { slug },
          include: { provider: { select: { name: true, slug: true, logo: true } } },
        });

        if (!game) {
          return reply.status(404).send({
            success: false,
            error: { code: 'GAME_NOT_FOUND', message: 'Game not found.' },
          });
        }

        const regData = gameRegistry.get(slug);

        return {
          success: true,
          data: {
            ...game,
            rtp: game.rtp?.toNumber(),
            houseEdge: regData?.houseEdge ?? game.houseEdge?.toNumber(),
            minBet: regData?.minBet ?? 0.01,
            maxBet: regData?.maxBet ?? 10000,
          },
        };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // GENERIC PLAY ENDPOINT
  // =========================================================================

  /**
   * POST /api/v1/casino/games/:slug/play — play a round (instant games)
   */
  app.post(
    '/api/v1/casino/games/:slug/play',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { slug: string };
        Body: { amount: number; currency: string; options?: any };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = request.params;
        const body = request.body as any;
        const { currency } = body;
        const amount = normalizeBetAmount(body);
        const userId = request.user!.id;

        // Merge body-level fields into options for games that send them flat
        let options = body.options || {};
        if (body.team && !options.team) options = { ...options, team: body.team };
        if (body.autoCashout && !options.autoCashout) options = { ...options, autoCashout: body.autoCashout };
        if (body.betType && !options.betType) options = { ...options, betType: body.betType };
        if (body.selection && !options.selection) options = { ...options, selection: body.selection };

        const game = gameRegistry.get(slug);
        if (!game) {
          return reply.status(404).send({
            success: false,
            error: { code: 'GAME_NOT_FOUND', message: `Game "${slug}" not found.` },
          });
        }

        // Check if game is stateful and shouldn't use generic play
        const statefulGames = ['crash', 'mines', 'blackjack', 'hilo', 'dragontower', 'poker'];
        if (statefulGames.includes(slug)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'USE_SPECIFIC_ENDPOINT',
              message: `"${slug}" is a stateful game. Use the game-specific endpoints instead.`,
            },
          });
        }

        const result = await game.play(userId, { amount, currency, options });

        // If the game didn't already include newBalance, fetch it now
        if (result.newBalance === undefined) {
          const wallet = await prisma.wallet.findFirst({
            where: { userId, currency: { symbol: currency } },
            select: { balance: true },
          });
          result.newBalance = wallet ? wallet.balance.toNumber() : 0;
        }

        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // CRASH GAME
  // =========================================================================

  /**
   * POST /api/v1/casino/crash/bet — place a crash bet
   */
  app.post(
    '/api/v1/casino/crash/bet',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Body: { amount: number; currency: string; autoCashout?: number };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { currency, autoCashout } = request.body;
        const amount = normalizeBetAmount(request.body);

        const result = await crashGameService.placeBet(
          userId,
          amount,
          currency,
          autoCashout,
        );

        // Include updated balance in response
        const wallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const newBalance = wallet ? wallet.balance.toNumber() : 0;

        return { success: true, data: { ...result, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/crash/cashout — cash out crash bet
   */
  app.post(
    '/api/v1/casino/crash/cashout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await crashGameService.cashout(userId);

        // Try to get updated balance from user's wallets
        // We don't know the currency here, so fetch all wallets
        const wallets = await prisma.wallet.findMany({
          where: { userId },
          include: { currency: { select: { symbol: true } } },
        });
        const balances = wallets.map((w) => ({
          currency: w.currency.symbol,
          balance: w.balance.toNumber(),
        }));
        const newBalance = balances.length > 0 ? balances[0].balance : 0;

        return { success: true, data: { ...result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/crash/current — get current round state
   */
  app.get('/api/v1/casino/crash/current', async (_request, _reply) => {
    const state = crashGameService.getCurrentState();
    return { success: true, data: state };
  });

  /**
   * GET /api/v1/casino/crash/history — get crash round history
   */
  app.get(
    '/api/v1/casino/crash/history',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const limit = Math.min(parseInt(request.query.limit ?? '20', 10), 100);
        const history = await crashGameService.getHistory(limit);
        return { success: true, data: history };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // MINES GAME
  // =========================================================================

  /**
   * POST /api/v1/casino/mines/start — start a new mines game
   */
  app.post(
    '/api/v1/casino/mines/start',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Body: { amount: number; currency: string; mineCount: number };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency } = request.body;
        // Accept both mineCount and minesCount
        const mineCount = (request.body as any).mineCount ?? (request.body as any).minesCount;

        if (mineCount === undefined || mineCount === null) {
          throw new GameError('INVALID_OPTIONS', 'Missing required field "mineCount" (or "minesCount").');
        }

        const result = await minesGame.start(userId, {
          amount,
          currency,
          options: { mineCount },
        });

        // Include updated balance
        const minesWallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const newBalance = minesWallet ? minesWallet.balance.toNumber() : 0;

        return { success: true, data: { ...result, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/mines/reveal — reveal a tile
   */
  app.post(
    '/api/v1/casino/mines/reveal',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { position: number } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { position } = request.body;

        const result = await minesGame.reveal(userId, position);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/mines/cashout — cash out mines
   */
  app.post(
    '/api/v1/casino/mines/cashout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await minesGame.cashout(userId);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/mines/active — get active mines game
   */
  app.get(
    '/api/v1/casino/mines/active',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await minesGame.getActiveGame(userId);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/mines/forfeit — abandon active mines game (lose bet)
   */
  app.post(
    '/api/v1/casino/mines/forfeit',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const key = `mines:session:${userId}`;
        const raw = await redis.get(key);
        if (!raw) {
          return { success: true, data: { message: 'No active game to forfeit.' } };
        }
        await redis.del(key);

        const wallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: JSON.parse(raw).currency || 'USDT' } },
          select: { balance: true },
        });
        const newBalance = wallet ? wallet.balance.toNumber() : 0;

        return { success: true, data: { message: 'Game forfeited.', newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // BLACKJACK GAME
  // =========================================================================

  // Helper to fetch all wallet balances for a user
  async function getUserBalances(userId: string) {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      include: { currency: { select: { symbol: true } } },
    });
    return wallets.map((w) => ({
      currency: w.currency.symbol,
      balance: w.balance.toNumber(),
    }));
  }

  /**
   * Build a unified blackjack response from raw service output.
   * The service returns different shapes for deal/hit/stand/double/split,
   * so we normalise everything into the frontend's expected format.
   */
  function buildBlackjackResponse(raw: any, opts: {
    betAmount?: number;
    currency?: string;
    newBalance: number;
    fairness?: any;
  }) {
    // ---- Player hand ----
    const playerCards: any[] =
      raw.hand?.cards              // hit/double returns hand.cards
      || raw.playerHands?.[0]?.cards  // deal returns playerHands[]
      || raw.results?.[0]?.hand?.cards // stand returns results[]
      || [];

    const playerTotal: number =
      raw.hand?.total ?? raw.playerHands?.[0]?.total ?? raw.results?.[0]?.hand?.total ?? 0;

    // ---- Dealer hand ----
    // During play: show only the up card. When complete: show all cards.
    let dealerCards: any[];
    let dealerTotal: number;

    if (raw.isComplete) {
      // Game over — show full dealer hand
      dealerCards = raw.dealerHand?.cards || (raw.dealerUpCard ? [raw.dealerUpCard] : []);
      dealerTotal = raw.dealerHand?.total ?? raw.dealerTotal ?? 0;
    } else {
      // Still playing — show only the up card + a hidden placeholder
      const upCard = raw.dealerUpCard || raw.dealerHand?.cards?.[0];
      if (upCard) {
        dealerCards = [upCard, { rank: '?', suit: 'back', value: 0, hidden: true }];
        dealerTotal = upCard.value || 0;
      } else {
        dealerCards = [];
        dealerTotal = 0;
      }
    }

    // ---- Status ----
    const betAmount = opts.betAmount || raw.playerHands?.[0]?.bet || raw.hand?.bet || 0;
    const payout: number = raw.payout ?? 0;
    let status = 'playing';

    if (raw.isComplete) {
      if (raw.isBlackjack) status = 'blackjack';
      else if (raw.isBusted) status = 'bust';
      else if (payout > betAmount) status = 'win';
      else if (payout === betAmount && payout > 0) status = 'push';
      else status = 'lose';
    }

    // ---- Actions ----
    const playing = !raw.isComplete && !raw.isBusted;
    const canHit = playing;
    const canDouble = playing && playerCards.length === 2;
    const canSplit = playing && playerCards.length === 2 &&
      playerCards[0]?.rank === playerCards[1]?.rank;

    const multiplier = betAmount > 0 && payout > 0 ? payout / betAmount : 0;

    return {
      roundId: raw.roundId || '',
      result: {
        playerHand: playerCards,
        dealerHand: dealerCards,
        playerTotal,
        dealerTotal,
        status,
        canHit,
        canDouble,
        canSplit,
        canInsurance: false,
        payout,
        multiplier,
      },
      fairness: opts.fairness || {
        serverSeedHash: raw.serverSeedHash || '',
        clientSeed: '',
        nonce: 0,
      },
      newBalance: opts.newBalance,
    };
  }

  /**
   * POST /api/v1/casino/blackjack/deal — deal a new hand
   */
  app.post(
    '/api/v1/casino/blackjack/deal',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { amount?: number; betAmount?: number; currency: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency } = request.body;

        const result = await blackjackGame.deal(userId, { amount, currency });

        const bjWallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const bjNewBalance = bjWallet ? bjWallet.balance.toNumber() : 0;

        const resp = buildBlackjackResponse(result, {
          betAmount: amount,
          currency,
          newBalance: bjNewBalance,
          fairness: { serverSeedHash: result.serverSeedHash, clientSeed: '', nonce: 0 },
        });

        return { success: true, data: resp };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /** Helper: run a blackjack action and return transformed response.
   *  We snapshot the session BEFORE the action to capture dealerUpCard,
   *  currency, and player hand — since the session may be deleted on completion.
   */
  async function handleBlackjackAction(userId: string, actionFn: () => Promise<any>, reply: FastifyReply) {
    try {
      // Snapshot session state before the action
      const session = await blackjackGame.getActiveGame(userId);
      const currency = session?.currency || 'USDT';
      const dealerUpCard = session?.dealerUpCard;
      const betAmount = session?.playerHands?.[0]?.bet || 0;
      const playerCardsBefore = session?.playerHands?.[0]?.cards || [];

      const result = await actionFn();

      // Inject dealerUpCard so the transform can show it during play
      if (!result.dealerHand && !result.dealerUpCard && dealerUpCard) {
        result.dealerUpCard = dealerUpCard;
      }

      // For actions that don't return player hand (stand), inject from snapshot
      if (!result.hand && !result.playerHands && !result.results) {
        const ptotal = session?.playerHands?.[0]?.total || 0;
        result.playerHands = [{ cards: playerCardsBefore, total: ptotal }];
      }

      // Fetch balance in the correct currency
      const wallet = await prisma.wallet.findFirst({
        where: { userId, currency: { symbol: currency } },
        select: { balance: true },
      });
      const newBalance = wallet ? wallet.balance.toNumber() : 0;

      const resp = buildBlackjackResponse(result, { betAmount, currency, newBalance });
      return { success: true, data: resp };
    } catch (err) {
      errorResponse(reply, err);
    }
  }

  /**
   * POST /api/v1/casino/blackjack/hit — hit
   */
  app.post(
    '/api/v1/casino/blackjack/hit',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      return handleBlackjackAction(userId, () => blackjackGame.hit(userId), reply);
    },
  );

  /**
   * POST /api/v1/casino/blackjack/stand — stand
   */
  app.post(
    '/api/v1/casino/blackjack/stand',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      return handleBlackjackAction(userId, () => blackjackGame.stand(userId), reply);
    },
  );

  /**
   * POST /api/v1/casino/blackjack/double — double down
   */
  app.post(
    '/api/v1/casino/blackjack/double',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      return handleBlackjackAction(userId, () => blackjackGame.double(userId), reply);
    },
  );

  /**
   * POST /api/v1/casino/blackjack/split — split pair
   */
  app.post(
    '/api/v1/casino/blackjack/split',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      return handleBlackjackAction(userId, () => blackjackGame.split(userId), reply);
    },
  );

  /**
   * POST /api/v1/casino/blackjack/action — unified action endpoint (hit, stand, double, split, insurance)
   */
  app.post(
    '/api/v1/casino/blackjack/action',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { action: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { action } = request.body;

        if (!action || typeof action !== 'string') {
          return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_ACTION', message: 'Missing required field "action".' },
          });
        }

        const validActions = ['hit', 'stand', 'double', 'split', 'insurance'];
        const normalizedAction = action.toLowerCase().trim();

        if (!validActions.includes(normalizedAction)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Invalid action "${action}". Valid actions: ${validActions.join(', ')}.`,
            },
          });
        }

        if (normalizedAction === 'insurance') {
          return reply.status(400).send({
            success: false,
            error: { code: 'INSURANCE_NOT_AVAILABLE', message: 'Insurance is not currently available.' },
          });
        }

        const actionMap: Record<string, () => Promise<any>> = {
          hit: () => blackjackGame.hit(userId),
          stand: () => blackjackGame.stand(userId),
          double: () => blackjackGame.double(userId),
          split: () => blackjackGame.split(userId),
        };

        return handleBlackjackAction(userId, actionMap[normalizedAction], reply);
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/blackjack/active — get active blackjack game
   */
  app.get(
    '/api/v1/casino/blackjack/active',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await blackjackGame.getActiveGame(userId);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // HILO GAME
  // =========================================================================

  /**
   * POST /api/v1/casino/hilo/start — start HiLo chain
   */
  app.post(
    '/api/v1/casino/hilo/start',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { amount?: number; betAmount?: number; currency: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency } = request.body;

        const result = await hiLoGame.start(userId, { amount, currency });

        // Include updated balance
        const hiloWallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const hiloNewBalance = hiloWallet ? hiloWallet.balance.toNumber() : 0;

        return { success: true, data: { result, newBalance: hiloNewBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/hilo/guess — guess higher or lower
   */
  app.post(
    '/api/v1/casino/hilo/guess',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { direction: 'higher' | 'lower' } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { direction } = request.body;

        const result = await hiLoGame.guess(userId, direction);
        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/hilo/cashout — cash out HiLo chain
   */
  app.post(
    '/api/v1/casino/hilo/cashout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await hiLoGame.cashout(userId);
        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/hilo/active — get active HiLo game
   */
  app.get(
    '/api/v1/casino/hilo/active',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await hiLoGame.getActiveGame(userId);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // GAME HISTORY
  // =========================================================================

  /**
   * GET /api/v1/casino/history — user's round history
   */
  app.get(
    '/api/v1/casino/history',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Querystring: { page?: string; limit?: string; game?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10)));
        const skip = (page - 1) * limit;

        const where: any = { userId };
        if (request.query.game) {
          where.gameSlug = request.query.game;
        }

        const [rounds, total] = await Promise.all([
          prisma.casinoRound.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              gameSlug: true,
              betAmount: true,
              payout: true,
              multiplier: true,
              result: true,
              isWin: true,
              serverSeedHash: true,
              clientSeed: true,
              nonce: true,
              createdAt: true,
            },
          }),
          prisma.casinoRound.count({ where }),
        ]);

        return {
          success: true,
          data: {
            rounds: rounds.map((r) => ({
              ...r,
              betAmount: r.betAmount.toNumber(),
              payout: r.payout.toNumber(),
              multiplier: r.multiplier.toNumber(),
            })),
            pagination: {
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            },
          },
        };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/live-feed — recent bets across all games (public)
   */
  app.get('/api/v1/casino/live-feed', async (_request, reply) => {
    try {
      const raw = await redis.lrange('casino:live_feed', 0, 49);

      const feed = raw.map((entry) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      }).filter(Boolean);

      return { success: true, data: feed };
    } catch (err) {
      errorResponse(reply, err);
    }
  });

  // =========================================================================
  // TOWER GAME
  // =========================================================================

  /**
   * POST /api/v1/casino/tower/start - start a new tower game
   */
  app.post(
    '/api/v1/casino/tower/start',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Body: { amount?: number; betAmount?: number; currency: string; difficulty?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency, difficulty } = request.body;

        const result = await towerGame.start(userId, {
          amount,
          currency,
          options: { difficulty: difficulty ?? 'easy' },
        });

        // Include updated balance
        const towerWallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const towerNewBalance = towerWallet ? towerWallet.balance.toNumber() : 0;

        return { success: true, data: { result, newBalance: towerNewBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/tower/climb - climb one row
   */
  app.post(
    '/api/v1/casino/tower/climb',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { column: number } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { column } = request.body;

        const result = await towerGame.climb(userId, column);
        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/tower/cashout - cash out tower game
   */
  app.post(
    '/api/v1/casino/tower/cashout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await towerGame.cashout(userId);
        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // DRAGON TOWER GAME
  // =========================================================================

  /**
   * POST /api/v1/casino/dragontower/start - start a new dragon tower game
   */
  app.post(
    '/api/v1/casino/dragontower/start',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Body: { amount?: number; betAmount?: number; currency: string; difficulty?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency, difficulty } = request.body;

        const result = await dragonTowerGame.start(userId, {
          amount,
          currency,
          options: { difficulty: difficulty ?? 'easy' },
        });

        // Include updated balance
        const dtWallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const dtNewBalance = dtWallet ? dtWallet.balance.toNumber() : 0;

        return { success: true, data: { result, newBalance: dtNewBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/dragontower/pick - pick a door at current level
   */
  app.post(
    '/api/v1/casino/dragontower/pick',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { position: number } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { position } = request.body;

        const result = await dragonTowerGame.pick(userId, position);
        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/dragontower/cashout - cash out dragon tower game
   */
  app.post(
    '/api/v1/casino/dragontower/cashout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await dragonTowerGame.cashout(userId);
        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // VIDEO POKER GAME
  // =========================================================================

  /**
   * POST /api/v1/casino/video-poker/deal - deal a new hand
   */
  app.post(
    '/api/v1/casino/video-poker/deal',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { amount?: number; betAmount?: number; currency: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency } = request.body;

        const result = await videoPokerGame.deal(userId, { amount, currency });

        // Include updated balance
        const vpWallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const vpNewBalance = vpWallet ? vpWallet.balance.toNumber() : 0;

        return { success: true, data: { result, newBalance: vpNewBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/video-poker/draw - draw replacement cards
   */
  app.post(
    '/api/v1/casino/video-poker/draw',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { holds: boolean[] } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { holds } = request.body;

        const result = await videoPokerGame.draw(userId, holds);
        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // POKER GAME (Texas Hold'em vs House)
  // =========================================================================

  /**
   * POST /api/v1/casino/poker/deal - deal a new poker hand
   */
  app.post(
    '/api/v1/casino/poker/deal',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { amount?: number; betAmount?: number; currency: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency } = request.body;

        const result = await pokerGame.deal(userId, { amount, currency });

        const wallet = await prisma.wallet.findFirst({
          where: { userId, currency: { symbol: currency } },
          select: { balance: true },
        });
        const newBalance = wallet ? wallet.balance.toNumber() : 0;

        return { success: true, data: { result, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/poker/action - perform a poker action (call, fold, check, raise)
   */
  app.post(
    '/api/v1/casino/poker/action',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { action: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { action } = request.body;

        if (!action || typeof action !== 'string') {
          return reply.status(400).send({
            success: false,
            error: { code: 'MISSING_ACTION', message: 'Missing required field "action".' },
          });
        }

        const validActions = ['call', 'fold', 'check', 'raise'];
        const normalizedAction = action.toLowerCase().trim();

        if (!validActions.includes(normalizedAction)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Invalid action "${action}". Valid actions: ${validActions.join(', ')}.`,
            },
          });
        }

        let result: any;
        switch (normalizedAction) {
          case 'call':
            result = await pokerGame.call(userId);
            break;
          case 'fold':
            result = await pokerGame.fold(userId);
            break;
          case 'check':
            result = await pokerGame.check(userId);
            break;
          case 'raise':
            result = await pokerGame.raise(userId);
            break;
          default:
            return reply.status(400).send({
              success: false,
              error: { code: 'INVALID_ACTION', message: `Unknown action "${action}".` },
            });
        }

        const balances = await getUserBalances(userId);
        const newBalance = balances.length > 0 ? balances[0].balance : 0;
        return { success: true, data: { result, balances, newBalance } };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/poker/active - get active poker game
   */
  app.get(
    '/api/v1/casino/poker/active',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await pokerGame.getActiveGame(userId);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // TRENBALL GAME (Football Crash)
  // =========================================================================

  /**
   * POST /api/v1/casino/trenball/play - play a trenball round
   */
  app.post(
    '/api/v1/casino/trenball/play',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Body: { amount?: number; betAmount?: number; currency: string; team: string; autoCashout?: number };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const amount = normalizeBetAmount(request.body);
        const { currency, team, autoCashout } = request.body;

        const result = await trenballGame.play(userId, {
          amount,
          currency,
          options: { team, autoCashout },
        });

        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // AUTO-BET
  // =========================================================================

  /**
   * POST /api/v1/casino/autobet/start - start auto-bet session
   */
  app.post(
    '/api/v1/casino/autobet/start',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Body: {
          gameSlug: string;
          betAmount: number;
          currency: string;
          numberOfBets: number;
          stopOnProfit?: number;
          stopOnLoss?: number;
          onWinAction: 'reset' | 'increase';
          onWinPercent?: number;
          onLossAction: 'reset' | 'increase' | 'martingale';
          onLossPercent?: number;
          delayMs?: number;
          gameOptions?: Record<string, unknown>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const {
          gameSlug,
          betAmount,
          currency,
          numberOfBets,
          stopOnProfit,
          stopOnLoss,
          onWinAction,
          onWinPercent,
          onLossAction,
          onLossPercent,
          delayMs,
          gameOptions,
        } = request.body;

        const result = await autoBetService.start(userId, gameSlug, {
          betAmount,
          currency,
          numberOfBets,
          stopOnProfit,
          stopOnLoss,
          onWinAction: onWinAction ?? 'reset',
          onWinPercent,
          onLossAction: onLossAction ?? 'reset',
          onLossPercent,
          delayMs,
          gameOptions,
        });

        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/autobet/stop - stop auto-bet session
   */
  app.post(
    '/api/v1/casino/autobet/stop',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Body: { gameSlug: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { gameSlug } = request.body;

        const result = await autoBetService.stop(userId, gameSlug);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/autobet/status/:gameSlug - get auto-bet status
   */
  app.get(
    '/api/v1/casino/autobet/status/:gameSlug',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Params: { gameSlug: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { gameSlug } = request.params;

        const result = await autoBetService.getStatus(userId, gameSlug);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/autobet/sessions - get all active auto-bet sessions
   */
  app.get(
    '/api/v1/casino/autobet/sessions',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user!.id;
        const result = await autoBetService.getAllSessions(userId);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // JACKPOT
  // =========================================================================

  /**
   * GET /api/v1/casino/jackpot - get current jackpot pool amounts
   */
  app.get('/api/v1/casino/jackpot', async (_request, reply) => {
    try {
      const pools = await jackpotService.getJackpotAmounts();
      return { success: true, data: pools };
    } catch (err) {
      errorResponse(reply, err);
    }
  });

  // =========================================================================
  // LIVE FEED (enhanced)
  // =========================================================================

  /**
   * GET /api/v1/casino/feed/recent - get recent bets via LiveFeedService
   */
  app.get(
    '/api/v1/casino/feed/recent',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const limit = Math.min(parseInt(request.query.limit ?? '50', 10), 50);
        const bets = await liveFeedService.getRecentBets(limit);
        return { success: true, data: bets };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/feed/high-rollers - get high-roller bets
   */
  app.get(
    '/api/v1/casino/feed/high-rollers',
    async (
      request: FastifyRequest<{ Querystring: { minAmount?: string; limit?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const minAmount = parseFloat(request.query.minAmount ?? '100');
        const limit = Math.min(parseInt(request.query.limit ?? '20', 10), 50);
        const bets = await liveFeedService.getHighRollerBets(minAmount, limit);
        return { success: true, data: bets };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/feed/big-wins - get big win bets
   */
  app.get(
    '/api/v1/casino/feed/big-wins',
    async (
      request: FastifyRequest<{ Querystring: { minMultiplier?: string; limit?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const minMultiplier = parseFloat(request.query.minMultiplier ?? '10');
        const limit = Math.min(parseInt(request.query.limit ?? '20', 10), 50);
        const bets = await liveFeedService.getBigWins(minMultiplier, limit);
        return { success: true, data: bets };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/feed/stats - get live feed stats
   */
  app.get('/api/v1/casino/feed/stats', async (_request, reply) => {
    try {
      const stats = await liveFeedService.getStats();
      return { success: true, data: stats };
    } catch (err) {
      errorResponse(reply, err);
    }
  });

  // =========================================================================
  // VIRTUAL SPORTS — Match listings
  // =========================================================================

  /**
   * GET /api/v1/casino/virtualsports/matches - get active virtual sport matches
   */
  app.get(
    '/api/v1/casino/virtualsports/matches',
    async (
      request: FastifyRequest<{ Querystring: { sport?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const matches = getActiveVirtualMatches();
        const { sport } = request.query;
        const filtered = sport
          ? matches.filter((m) => m.sport === sport.toLowerCase())
          : matches;

        return {
          success: true,
          data: filtered.map((m) => ({
            matchId: m.matchId,
            sport: m.sport,
            homeTeam: m.homeTeam.name,
            awayTeam: m.awayTeam.name,
            homeStrength: m.homeTeam.strength,
            awayStrength: m.awayTeam.strength,
            homeOdds: m.homeOdds,
            drawOdds: m.drawOdds,
            awayOdds: m.awayOdds,
            expiresAt: new Date(m.expiresAt).toISOString(),
          })),
        };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  // =========================================================================
  // TOURNAMENTS
  // =========================================================================

  /**
   * GET /api/v1/casino/tournaments - list tournaments
   */
  app.get(
    '/api/v1/casino/tournaments',
    async (
      request: FastifyRequest<{ Querystring: { status?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { status } = request.query;
        const validStatuses = ['upcoming', 'active', 'completed', 'cancelled'];
        const statusFilter = status && validStatuses.includes(status)
          ? (status as any)
          : undefined;

        const tournaments = await tournamentService.listTournaments(statusFilter);
        return { success: true, data: tournaments };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * GET /api/v1/casino/tournaments/:id - tournament details + leaderboard
   */
  app.get(
    '/api/v1/casino/tournaments/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;

        // Try to get requesting user ID (optional auth)
        let userId: string | undefined;
        try {
          await new Promise<void>((resolve, reject) => {
            authenticate(request as any, reply as any, (err?: Error) => {
              if (err) reject(err);
              else resolve();
            });
          });
          userId = request.user?.id;
        } catch {
          // Not authenticated - that's fine, public view
        }

        const details = await tournamentService.getTournamentDetails(id, userId);
        return { success: true, data: details };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /api/v1/casino/tournaments/:id/join - join a tournament
   */
  app.post(
    '/api/v1/casino/tournaments/:id/join',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = request.user!.id;
        const { id } = request.params;

        const result = await tournamentService.joinTournament(userId, id);
        return { success: true, data: result };
      } catch (err) {
        errorResponse(reply, err);
      }
    },
  );
}
