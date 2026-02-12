import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
// Helper to build a success response object for returning from routes
function successResponse<T>(data: T, meta?: Record<string, unknown>): { success: true; data: T; meta?: Record<string, unknown> } {
  const res: { success: true; data: T; meta?: Record<string, unknown> } = { success: true, data };
  if (meta) res.meta = meta;
  return res;
}
import { AppError } from '../../utils/errors';
import { Decimal } from '@prisma/client/runtime/library';

// API key authentication for public API
async function apiKeyAuth(req: any) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) throw new AppError('API_KEY_REQUIRED', 'API key is required', 401);

  const user = await prisma.user.findFirst({ where: { apiKeys: { some: { key: apiKey } } } });
  if (!user) throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
  if (!user.isActive) throw new AppError('ACCOUNT_DISABLED', 'Account is disabled', 403);

  req.userId = user.id;
  req.user = user;
}

export async function publicApiV1Routes(app: FastifyInstance) {
  // ─── Feed (Public + API Key) ──────────────────────────

  // GET /api/v1/sports — List all sports
  app.get('/api/v1/sports', async () => {
    const cacheKey = 'api:v1:sports';
    const cached = await redis.get(cacheKey);
    if (cached) return successResponse(JSON.parse(cached));

    const sports = await prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, slug: true, icon: true,
        _count: { select: { competitions: true } },
      },
    });

    await redis.setex(cacheKey, 60, JSON.stringify(sports));
    return successResponse(sports);
  });

  // GET /api/v1/sports/:sport/competitions — Competitions for a sport
  app.get('/api/v1/sports/:sport/competitions', async (req) => {
    const { sport } = req.params as any;
    const sportRecord = await prisma.sport.findFirst({
      where: { OR: [{ slug: sport }, { id: sport }] },
    });
    if (!sportRecord) throw new AppError('SPORT_NOT_FOUND', 'Sport not found', 404);

    const competitions = await prisma.competition.findMany({
      where: { sportId: sportRecord.id, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, slug: true, country: true,
        _count: { select: { events: true } },
      },
    });

    return successResponse(competitions);
  });

  // GET /api/v1/competitions/:id/events — Events for a competition
  app.get('/api/v1/competitions/:id/events', async (req) => {
    const { id } = req.params as any;
    const { status, limit, offset } = req.query as any;

    const where: any = { competitionId: id };
    if (status) where.status = status;

    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      skip: offset ? Number(offset) : 0,
      take: Math.min(Number(limit) || 50, 100),
      select: {
        id: true, name: true, homeTeam: true, awayTeam: true,
        status: true, startTime: true, scores: true,
        _count: { select: { markets: true } },
      },
    });

    return successResponse(events);
  });

  // GET /api/v1/events/:id — Event details
  app.get('/api/v1/events/:id', async (req) => {
    const { id } = req.params as any;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        competition: { include: { sport: { select: { id: true, name: true, slug: true } } } },
      },
    });

    if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    return successResponse(event);
  });

  // GET /api/v1/events/:id/markets — Markets and odds for an event
  app.get('/api/v1/events/:id/markets', async (req) => {
    const { id } = req.params as any;

    const markets = await prisma.market.findMany({
      where: { eventId: id, status: 'OPEN' },
      include: {
        selections: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, odds: true, status: true },
        },
      },
    });

    return successResponse(markets);
  });

  // ─── Trading (Authenticated API Key) ─────────────────

  // POST /api/v1/bets/place — Place a bet
  app.post('/api/v1/bets/place', { preHandler: [apiKeyAuth] }, async (req) => {
    const { selections, stake, currency, type, oddsChangePolicy } = req.body as any;

    if (!selections?.length || !stake || !currency) {
      throw new AppError('INVALID_BET', 'selections, stake, and currency are required', 400);
    }

    // Validate selections exist and get current odds
    const selectionRecords = await Promise.all(
      selections.map(async (s: any) => {
        const selection = await prisma.selection.findUnique({
          where: { id: s.selectionId },
          include: { market: { include: { event: true } } },
        });
        if (!selection) throw new AppError('SELECTION_NOT_FOUND', `Selection ${s.selectionId} not found`, 404);
        if (selection.status !== 'ACTIVE') throw new AppError('SELECTION_SUSPENDED', `Selection ${s.selectionId} is suspended`, 400);
        if (selection.market.event.status === 'ENDED') throw new AppError('EVENT_ENDED', 'Event has ended', 400);

        // Odds change check
        if (oddsChangePolicy === 'NONE' && s.odds && !selection.odds.equals(new Decimal(s.odds))) {
          throw new AppError('ODDS_CHANGED', `Odds changed for ${selection.name}`, 409);
        }

        return { ...selection, requestedOdds: s.odds };
      })
    );

    // Calculate combined odds for parlays
    let totalOdds = new Decimal(1);
    for (const s of selectionRecords) {
      totalOdds = totalOdds.mul(s.odds);
    }

    const stakeDecimal = new Decimal(stake);
    const potentialWin = stakeDecimal.mul(totalOdds);

    // Check wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: { userId: (req as any).userId, currency: { symbol: currency } },
    });
    if (!wallet || wallet.balance.lt(stakeDecimal)) {
      throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient balance', 400);
    }

    // Create bet in transaction
    const bet = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: stakeDecimal } },
      });

      // Create bet
      const newBet = await tx.bet.create({
        data: {
          userId: (req as any).userId,
          type: type || (selections.length > 1 ? 'PARLAY' : 'SINGLE'),
          stake: stakeDecimal,
          currencySymbol: currency,
          odds: totalOdds,
          potentialWin,
          status: 'PENDING',
          placedVia: 'API',
          referenceId: `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          legs: {
            create: selectionRecords.map((s: any) => ({
              selection: { connect: { id: s.id } },
              oddsAtPlacement: s.odds,
              status: 'PENDING',
            })),
          },
        },
        include: { legs: true },
      });

      return newBet;
    });

    return successResponse({
      referenceId: bet.referenceId,
      status: bet.status,
      type: bet.type,
      stake: bet.stake.toString(),
      odds: bet.odds.toString(),
      potentialWin: bet.potentialWin.toString(),
      currencySymbol: bet.currencySymbol,
      legs: bet.legs.map(l => ({
        selectionId: l.selectionId,
        oddsAtPlacement: l.oddsAtPlacement.toString(),
        status: l.status,
      })),
      createdAt: bet.createdAt,
    });
  });

  // GET /api/v1/bets/:referenceId/status — Bet status
  app.get('/api/v1/bets/:referenceId/status', { preHandler: [apiKeyAuth] }, async (req) => {
    const { referenceId } = req.params as any;

    const bet = await prisma.bet.findFirst({
      where: { referenceId, userId: (req as any).userId },
      include: { legs: { include: { selection: { select: { name: true } } } } },
    });

    if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found', 404);

    return successResponse({
      referenceId: bet.referenceId,
      status: bet.status,
      type: bet.type,
      stake: bet.stake.toString(),
      odds: bet.odds.toString(),
      potentialWin: bet.potentialWin.toString(),
      actualWin: bet.actualWin?.toString() || null,
      currencySymbol: bet.currencySymbol,
      legs: bet.legs.map(l => ({
        selectionId: l.selectionId,
        selectionName: (l as any).selection?.name,
        oddsAtPlacement: l.oddsAtPlacement.toString(),
        status: l.status,
      })),
      createdAt: bet.createdAt,
      settledAt: bet.settledAt,
    });
  });

  // GET /api/v1/bets/history — Bet history
  app.get('/api/v1/bets/history', { preHandler: [apiKeyAuth] }, async (req) => {
    const { limit, offset, status } = req.query as any;
    const where: any = { userId: (req as any).userId };
    if (status) where.status = status;

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset ? Number(offset) : 0,
        take: Math.min(Number(limit) || 20, 100),
        include: { legs: true },
      }),
      prisma.bet.count({ where }),
    ]);

    return successResponse(
      bets.map(b => ({
        referenceId: b.referenceId,
        status: b.status,
        type: b.type,
        stake: b.stake.toString(),
        odds: b.odds.toString(),
        potentialWin: b.potentialWin.toString(),
        actualWin: b.actualWin?.toString() || null,
        currencySymbol: b.currencySymbol,
        legCount: b.legs.length,
        createdAt: b.createdAt,
        settledAt: b.settledAt,
      })),
      { total, limit: Number(limit) || 20, offset: Number(offset) || 0, hasMore: (Number(offset) || 0) + (Number(limit) || 20) < total }
    );
  });

  // POST /api/v1/bets/:referenceId/cashout — Cash out a bet
  app.post('/api/v1/bets/:referenceId/cashout', { preHandler: [apiKeyAuth] }, async (req) => {
    const { referenceId } = req.params as any;
    const { amount } = req.body as any;

    const bet = await prisma.bet.findFirst({
      where: { referenceId, userId: (req as any).userId },
    });

    if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found', 404);
    if (bet.status !== 'PENDING') throw new AppError('BET_NOT_ACTIVE', 'Bet is not active', 400);

    const cashoutAmount = amount ? new Decimal(amount) : bet.stake.mul(new Decimal('0.9'));

    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: { status: 'CASHOUT', actualWin: cashoutAmount, cashoutAmount, cashoutAt: new Date(), settledAt: new Date() },
      }),
      prisma.wallet.updateMany({
        where: { userId: (req as any).userId, currency: { symbol: bet.currencySymbol } },
        data: { balance: { increment: cashoutAmount } },
      }),
    ]);

    return successResponse({
      referenceId: bet.referenceId,
      status: 'CASHOUT',
      cashoutAmount: cashoutAmount.toString(),
    });
  });

  // ─── Account (Authenticated API Key) ─────────────────

  // GET /api/v1/account/profile
  app.get('/api/v1/account/profile', { preHandler: [apiKeyAuth] }, async (req) => {
    const user = (req as any).user;
    return successResponse({
      id: user.id,
      username: user.username,
      email: user.email,
      vipTier: user.vipTier,
      kycLevel: user.kycLevel,
      createdAt: user.createdAt,
    });
  });

  // GET /api/v1/account/currencies
  app.get('/api/v1/account/currencies', { preHandler: [apiKeyAuth] }, async (req) => {
    const wallets = await prisma.wallet.findMany({
      where: { userId: (req as any).userId },
      include: { currency: { select: { symbol: true } } },
    });

    return successResponse(wallets.map(w => ({
      currency: w.currency.symbol,
      balance: w.balance.toString(),
      bonusBalance: w.bonusBalance.toString(),
    })));
  });

  // GET /api/v1/account/currencies/:symbol/balance
  app.get('/api/v1/account/currencies/:symbol/balance', { preHandler: [apiKeyAuth] }, async (req) => {
    const { symbol } = req.params as any;

    const wallet = await prisma.wallet.findFirst({
      where: { userId: (req as any).userId, currency: { symbol: symbol.toUpperCase() } },
      include: { currency: { select: { symbol: true } } },
    });

    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found for this currency', 404);

    return successResponse({
      currency: wallet.currency.symbol,
      balance: wallet.balance.toString(),
      bonusBalance: wallet.bonusBalance.toString(),
      lockedBalance: wallet.lockedBalance.toString(),
    });
  });

  // ─── API Key Management ───────────────────────────────
  app.post('/api/v1/account/api-key/generate', { preHandler: [apiKeyAuth] }, async (req) => {
    const crypto = await import('crypto');
    const newKey = `cb_${crypto.randomBytes(32).toString('hex')}`;

    await prisma.apiKey.create({
      data: {
        userId: (req as any).userId,
        key: newKey,
        permissions: {},
      },
    });

    return successResponse({ apiKey: newKey });
  });

  app.post('/api/v1/account/api-key/revoke', { preHandler: [apiKeyAuth] }, async (req) => {
    await prisma.apiKey.deleteMany({
      where: { userId: (req as any).userId },
    });

    return successResponse({ revoked: true });
  });
}
