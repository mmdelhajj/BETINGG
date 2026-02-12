import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { AppError } from '../../utils/errors';
import { Decimal } from '@prisma/client/runtime/library';

// Helper to get authenticated user from context
function requireAuth(ctx: any) {
  if (!ctx.userId) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  return ctx.userId;
}

export const resolvers = {
  Query: {
    sports: async () => {
      return prisma.sport.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    },

    sport: async (_: any, { slug }: { slug: string }) => {
      return prisma.sport.findFirst({ where: { slug, isActive: true } });
    },

    competitions: async (_: any, { sportId }: { sportId: string }) => {
      return prisma.competition.findMany({
        where: { sportId, isActive: true },
        orderBy: { name: 'asc' },
      });
    },

    events: async (_: any, args: { sportKey?: string; status?: string; limit?: number; offset?: number }) => {
      const where: any = {};
      if (args.sportKey) {
        const sport = await prisma.sport.findFirst({ where: { slug: args.sportKey } });
        if (sport) where.competition = { sportId: sport.id };
      }
      if (args.status) where.status = args.status;

      return prisma.event.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip: args.offset || 0,
        take: Math.min(args.limit || 50, 100),
      });
    },

    event: async (_: any, { id }: { id: string }) => {
      return prisma.event.findUnique({ where: { id } });
    },

    odds: async (_: any, { eventId }: { eventId: string }) => {
      return prisma.market.findMany({
        where: { eventId, status: 'OPEN' },
        include: { selections: { where: { status: 'ACTIVE' } } },
      });
    },

    account: async (_: any, __: any, ctx: any) => {
      const userId = requireAuth(ctx);
      return prisma.user.findUnique({ where: { id: userId } });
    },

    balance: async (_: any, { currency }: { currency: string }, ctx: any) => {
      const userId = requireAuth(ctx);
      const wallet = await prisma.wallet.findFirst({
        where: { userId, currency: { symbol: currency.toUpperCase() } },
        include: { currency: true },
      });
      if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404);
      return wallet;
    },

    betHistory: async (_: any, args: { limit?: number; offset?: number; status?: string }, ctx: any) => {
      const userId = requireAuth(ctx);
      const where: any = { userId };
      if (args.status) where.status = args.status;

      const [bets, total] = await Promise.all([
        prisma.bet.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: args.offset || 0,
          take: Math.min(args.limit || 20, 100),
          include: { legs: true },
        }),
        prisma.bet.count({ where }),
      ]);

      return {
        bets,
        total,
        hasMore: (args.offset || 0) + (args.limit || 20) < total,
      };
    },

    bet: async (_: any, { referenceId }: { referenceId: string }, ctx: any) => {
      const userId = requireAuth(ctx);
      return prisma.bet.findFirst({
        where: { referenceId, userId },
        include: { legs: true },
      });
    },
  },

  Mutation: {
    placeBet: async (_: any, { input }: any, ctx: any) => {
      const userId = requireAuth(ctx);
      const { selections, stake, currency, type, oddsChangePolicy } = input;

      const selectionRecords = await Promise.all(
        selections.map(async (s: any) => {
          const sel = await prisma.selection.findUnique({
            where: { id: s.selectionId },
            include: { market: { include: { event: true } } },
          });
          if (!sel || sel.status !== 'ACTIVE') throw new AppError('SELECTION_INVALID', 'Invalid selection', 400);
          return sel;
        })
      );

      let totalOdds = new Decimal(1);
      for (const s of selectionRecords) totalOdds = totalOdds.mul(s.odds);

      const stakeDecimal = new Decimal(stake);
      const potentialWin = stakeDecimal.mul(totalOdds);

      const wallet = await prisma.wallet.findFirst({ where: { userId, currency: { symbol: currency } } });
      if (!wallet || wallet.balance.lt(stakeDecimal)) {
        throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient balance', 400);
      }

      const bet = await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: stakeDecimal } },
        });

        return tx.bet.create({
          data: {
            userId,
            type: type || (selections.length > 1 ? 'PARLAY' : 'SINGLE'),
            stake: stakeDecimal,
            currencySymbol: currency,
            odds: totalOdds,
            potentialWin,
            status: 'PENDING',
            placedVia: 'GRAPHQL',
            referenceId: `gql_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            legs: {
              create: selectionRecords.map((s: any) => ({
                selection: { connect: { id: s.id } },
                oddsAtPlacement: s.odds,
                status: 'PENDING',
              })),
            },
          },
        });
      });

      return {
        referenceId: bet.referenceId,
        status: bet.status,
        stake: bet.stake.toString(),
        odds: bet.odds.toString(),
        potentialWin: bet.potentialWin.toString(),
      };
    },

    cashOut: async (_: any, { betId, amount }: any, ctx: any) => {
      const userId = requireAuth(ctx);
      const bet = await prisma.bet.findFirst({
        where: { OR: [{ id: betId }, { referenceId: betId }], userId },
      });
      if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found', 404);
      if (bet.status !== 'PENDING') throw new AppError('BET_NOT_ACTIVE', 'Bet not active', 400);

      const cashoutAmount = amount ? new Decimal(amount) : bet.stake.mul(new Decimal('0.9'));

      await prisma.$transaction([
        prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'CASHOUT', actualWin: cashoutAmount, cashoutAmount, cashoutAt: new Date(), settledAt: new Date() },
        }),
        prisma.wallet.updateMany({
          where: { userId, currency: { symbol: bet.currencySymbol } },
          data: { balance: { increment: cashoutAmount } },
        }),
      ]);

      return {
        referenceId: bet.referenceId,
        status: 'CASHOUT',
        cashoutAmount: cashoutAmount.toString(),
      };
    },

    cancelBet: async (_: any, { betId }: any, ctx: any) => {
      const userId = requireAuth(ctx);
      const bet = await prisma.bet.findFirst({
        where: { OR: [{ id: betId }, { referenceId: betId }], userId },
      });
      if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found', 404);
      if (bet.status !== 'PENDING') return false;

      // Check grace period (3 seconds)
      const elapsed = Date.now() - bet.createdAt.getTime();
      if (elapsed > 3000) throw new AppError('GRACE_PERIOD_EXPIRED', 'Cancellation grace period expired', 400);

      await prisma.$transaction([
        prisma.bet.update({
          where: { id: bet.id },
          data: { status: 'VOID', settledAt: new Date() },
        }),
        prisma.wallet.updateMany({
          where: { userId, currency: { symbol: bet.currencySymbol } },
          data: { balance: { increment: bet.stake } },
        }),
      ]);

      return true;
    },
  },

  // ─── Field Resolvers ──────────────────────────────────
  Sport: {
    competitionCount: async (sport: any) => {
      return prisma.competition.count({ where: { sportId: sport.id, isActive: true } });
    },
    competitions: async (sport: any) => {
      return prisma.competition.findMany({
        where: { sportId: sport.id, isActive: true },
        orderBy: { name: 'asc' },
      });
    },
  },

  Competition: {
    eventCount: async (comp: any) => {
      return prisma.event.count({ where: { competitionId: comp.id } });
    },
    events: async (comp: any, args: { status?: string; limit?: number }) => {
      const where: any = { competitionId: comp.id };
      if (args.status) where.status = args.status;
      return prisma.event.findMany({
        where,
        orderBy: { startTime: 'asc' },
        take: Math.min(args.limit || 50, 100),
      });
    },
  },

  Event: {
    isLive: (event: any) => event.status === 'LIVE',
    competition: async (event: any) => prisma.competition.findUnique({ where: { id: event.competitionId } }),
    sport: async (event: any) => {
      const competition = await prisma.competition.findUnique({
        where: { id: event.competitionId },
        include: { sport: true },
      });
      return competition?.sport ?? null;
    },
    markets: async (event: any) => {
      return prisma.market.findMany({
        where: { eventId: event.id, status: 'OPEN' },
        include: { selections: { where: { status: 'ACTIVE' } } },
      });
    },
  },

  Market: {
    selections: async (market: any) => {
      if (market.selections) return market.selections;
      return prisma.selection.findMany({ where: { marketId: market.id, status: 'ACTIVE' } });
    },
  },

  Bet: {
    legs: async (bet: any) => {
      if (bet.legs) return bet.legs;
      return prisma.betLeg.findMany({
        where: { betId: bet.id },
        include: { selection: { include: { market: { include: { event: true } } } } },
      });
    },
  },

  BetLeg: {
    selectionName: async (leg: any) => {
      if (leg.selection?.name) return leg.selection.name;
      const sel = await prisma.selection.findUnique({ where: { id: leg.selectionId } });
      return sel?.name;
    },
    eventName: async (leg: any) => {
      if (leg.selection?.market?.event?.name) return leg.selection.market.event.name;
      const sel = await prisma.selection.findUnique({
        where: { id: leg.selectionId },
        include: { market: { include: { event: true } } },
      });
      return sel?.market?.event?.name;
    },
  },

  // ─── Subscriptions (pub/sub via Redis) ────────────────
  Subscription: {
    oddsUpdate: {
      subscribe: async function* (_: any, { eventId }: any) {
        const channel = `odds:${eventId}`;
        // In production, this would use Redis pub/sub
        // Simplified: yield updates from Redis channel
        while (true) {
          const data = await redis.get(`live:odds:${eventId}`);
          if (data) {
            yield { oddsUpdate: JSON.parse(data) };
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      },
    },
    scoreUpdate: {
      subscribe: async function* (_: any, { eventId }: any) {
        while (true) {
          const data = await redis.get(`live:score:${eventId}`);
          if (data) {
            yield { scoreUpdate: JSON.parse(data) };
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      },
    },
    betStatus: {
      subscribe: async function* (_: any, { referenceId }: any, ctx: any) {
        while (true) {
          const data = await redis.get(`bet:status:${referenceId}`);
          if (data) {
            yield { betStatus: JSON.parse(data) };
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      },
    },
  },
};
