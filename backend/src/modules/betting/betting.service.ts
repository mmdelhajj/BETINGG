import crypto from 'node:crypto';
import { Prisma, type BetStatus, type BetType, type BetLegStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { rewardCalculationQueue } from '../../queues/index.js';
import type { PlaceBetInput, BetHistoryQuery } from './betting.schemas.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_STAKE = new Prisma.Decimal('0.0001');
const MAX_STAKE_DEFAULT = new Prisma.Decimal('100000');
const MAX_PARLAY_LEGS = 15;
const MIN_PARLAY_LEGS = 2;
const LIVE_BET_DELAY_MS = 6000; // 6 second delay for live bets

// ---------------------------------------------------------------------------
// Place Bet
// ---------------------------------------------------------------------------

export interface PlaceBetResult {
  bet: {
    id: string;
    referenceId: string;
    type: string;
    stake: string;
    currency: string;
    odds: string;
    potentialWin: string;
    status: string;
    isLive: boolean;
    legs: Array<{
      id: string;
      selectionId: string;
      eventName: string | null;
      marketName: string | null;
      selectionName: string | null;
      oddsAtPlacement: string;
      status: string;
    }>;
    createdAt: string;
  };
}

export async function placeBet(
  userId: string,
  input: PlaceBetInput,
  ipAddress?: string,
): Promise<PlaceBetResult> {
  const { type, selections, stake, currency, oddsChangePolicy, isLive } = input;
  const stakeDecimal = new Prisma.Decimal(stake);

  // ── Pre-validation ──────────────────────────────────────────────────────

  // Check user is not banned or self-excluded
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      isBanned: true,
      selfExcludedUntil: true,
      coolingOffUntil: true,
    },
  });

  if (user.isBanned) {
    throw new BetError('ACCOUNT_BANNED', 'Your account is banned. You cannot place bets.');
  }
  if (user.selfExcludedUntil && user.selfExcludedUntil > new Date()) {
    throw new BetError('SELF_EXCLUDED', 'You have self-excluded from betting.');
  }
  if (user.coolingOffUntil && user.coolingOffUntil > new Date()) {
    throw new BetError('COOLING_OFF', 'You are in a cooling-off period.');
  }

  // Validate stake
  if (stakeDecimal.lt(MIN_STAKE)) {
    throw new BetError('STAKE_TOO_LOW', `Minimum stake is ${MIN_STAKE.toString()}`);
  }

  // Validate type vs selection count
  if (type === 'SINGLE' && selections.length !== 1) {
    throw new BetError('INVALID_SELECTIONS', 'Single bet must have exactly one selection.');
  }
  if (type === 'PARLAY') {
    if (selections.length < MIN_PARLAY_LEGS) {
      throw new BetError('INVALID_SELECTIONS', `Parlay requires at least ${MIN_PARLAY_LEGS} selections.`);
    }
    if (selections.length > MAX_PARLAY_LEGS) {
      throw new BetError('INVALID_SELECTIONS', `Parlay allows a maximum of ${MAX_PARLAY_LEGS} selections.`);
    }
  }

  // ── Fetch and validate all selections ───────────────────────────────────

  const selectionIds = selections.map((s) => s.selectionId);
  const dbSelections = await prisma.selection.findMany({
    where: { id: { in: selectionIds } },
    include: {
      market: {
        include: {
          event: {
            select: { id: true, name: true, status: true },
          },
        },
      },
    },
  });

  if (dbSelections.length !== selectionIds.length) {
    throw new BetError('SELECTION_NOT_FOUND', 'One or more selections were not found.');
  }

  // Build lookup map
  const selectionMap = new Map(dbSelections.map((s) => [s.id, s]));

  // Validate each selection
  const eventIds = new Set<string>();
  for (const sel of selections) {
    const dbSel = selectionMap.get(sel.selectionId)!;

    if (dbSel.status !== 'ACTIVE') {
      throw new BetError(
        'SELECTION_NOT_ACTIVE',
        `Selection "${dbSel.name}" is not active (current: ${dbSel.status}).`,
      );
    }

    if (dbSel.market.status !== 'OPEN') {
      throw new BetError(
        'MARKET_NOT_OPEN',
        `Market "${dbSel.market.name}" is not open (current: ${dbSel.market.status}).`,
      );
    }

    if (dbSel.market.event.status === 'ENDED' || dbSel.market.event.status === 'CANCELLED') {
      throw new BetError(
        'EVENT_ENDED',
        `Event "${dbSel.market.event.name}" has ended or been cancelled.`,
      );
    }

    // Odds change validation
    const currentOdds = dbSel.odds;
    const requestedOdds = new Prisma.Decimal(sel.odds);

    if (!currentOdds.eq(requestedOdds)) {
      if (oddsChangePolicy === 'REJECT') {
        throw new BetError(
          'ODDS_CHANGED',
          `Odds for "${dbSel.name}" have changed from ${requestedOdds.toString()} to ${currentOdds.toString()}.`,
        );
      }
      if (oddsChangePolicy === 'ACCEPT_HIGHER' && currentOdds.lt(requestedOdds)) {
        throw new BetError(
          'ODDS_DECREASED',
          `Odds for "${dbSel.name}" decreased from ${requestedOdds.toString()} to ${currentOdds.toString()}.`,
        );
      }
      // ACCEPT_ANY: continue with current odds
    }

    // Stake limit check
    const maxStake = dbSel.maxStake ?? MAX_STAKE_DEFAULT;
    if (stakeDecimal.gt(maxStake)) {
      throw new BetError(
        'STAKE_TOO_HIGH',
        `Maximum stake for "${dbSel.name}" is ${maxStake.toString()}.`,
      );
    }

    // Check for duplicate events in parlay
    if (type === 'PARLAY') {
      const eventId = dbSel.market.event.id;
      if (eventIds.has(eventId)) {
        throw new BetError(
          'DUPLICATE_EVENT',
          `Parlay cannot contain multiple selections from the same event: "${dbSel.market.event.name}".`,
        );
      }
      eventIds.add(eventId);
    }
  }

  // ── Calculate combined odds and potential winnings ───────────────────────

  let combinedOdds: Prisma.Decimal;
  if (type === 'SINGLE') {
    combinedOdds = selectionMap.get(selections[0].selectionId)!.odds;
  } else {
    // PARLAY: product of all selection odds
    combinedOdds = new Prisma.Decimal(1);
    for (const sel of selections) {
      const dbSel = selectionMap.get(sel.selectionId)!;
      combinedOdds = combinedOdds.mul(dbSel.odds);
    }
  }

  const potentialWin = stakeDecimal.mul(combinedOdds);

  // ── Handle live bet delay ───────────────────────────────────────────────

  if (isLive) {
    const delayKey = `live_bet_delay:${userId}:${Date.now()}`;
    await redis.set(delayKey, JSON.stringify({ userId, input, ipAddress }), 'PX', LIVE_BET_DELAY_MS);
    // For now, we proceed synchronously but flag it. In production, a queue worker
    // would pick this up after the delay.
  }

  // ── Atomic transaction: deduct balance + create bet ─────────────────────

  const bet = await prisma.$transaction(async (tx) => {
    // Find user's wallet for this currency
    const currencyRecord = await tx.currency.findUnique({
      where: { symbol: currency.toUpperCase() },
      select: { id: true },
    });

    if (!currencyRecord) {
      throw new BetError('CURRENCY_NOT_FOUND', `Currency "${currency}" not found.`);
    }

    // Find or auto-create wallet for this currency
    let wallet = await tx.wallet.findUnique({
      where: { userId_currencyId: { userId, currencyId: currencyRecord.id } },
    });

    if (!wallet) {
      // Auto-create wallet for this currency so all currencies work for betting
      wallet = await tx.wallet.create({
        data: { userId, currencyId: currencyRecord.id },
      });
    }

    // Check available balance (balance - lockedBalance)
    const available = wallet.balance.minus(wallet.lockedBalance);
    if (available.lt(stakeDecimal)) {
      throw new BetError(
        'INSUFFICIENT_BALANCE',
        `Insufficient balance. Available: ${available.toString()}, Required: ${stakeDecimal.toString()}.`,
      );
    }

    // Lock the stake amount
    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: stakeDecimal },
        lockedBalance: { increment: new Prisma.Decimal(0) }, // Balance already deducted
      },
    });

    // Create the bet
    const createdBet = await tx.bet.create({
      data: {
        userId,
        type: type as BetType,
        stake: stakeDecimal,
        currencySymbol: currency.toUpperCase(),
        potentialWin,
        odds: combinedOdds,
        status: 'ACCEPTED',
        isLive: isLive ?? false,
        isCashoutAvailable: true,
        ipAddress,
        legs: {
          create: selections.map((sel) => {
            const dbSel = selectionMap.get(sel.selectionId)!;
            return {
              selectionId: dbSel.id,
              eventName: dbSel.market.event.name,
              marketName: dbSel.market.name,
              selectionName: dbSel.name,
              oddsAtPlacement: dbSel.odds,
              status: 'PENDING' as BetLegStatus,
            };
          }),
        },
      },
      include: {
        legs: true,
      },
    });

    // Create a BET transaction
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'BET',
        amount: stakeDecimal.negated(),
        status: 'COMPLETED',
        metadata: {
          betId: createdBet.id,
          referenceId: createdBet.referenceId,
          type: createdBet.type,
          odds: combinedOdds.toString(),
        },
      },
    });

    // Update market liability
    for (const sel of selections) {
      const dbSel = selectionMap.get(sel.selectionId)!;
      await tx.marketLiability.upsert({
        where: {
          id: `${dbSel.marketId}_${dbSel.id}`,
        },
        create: {
          id: `${dbSel.marketId}_${dbSel.id}`,
          marketId: dbSel.marketId,
          selectionId: dbSel.id,
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
    }

    return createdBet;
  });

  // ── Trigger rakeback / VIP wagered update (async) ───────────────────────
  await rewardCalculationQueue.add('bet-placed', {
    userId,
    betId: bet.id,
    stake: stakeDecimal.toString(),
    currency: currency.toUpperCase(),
    type,
    timestamp: new Date().toISOString(),
  });

  // ── Update user's total wagered ─────────────────────────────────────────
  await prisma.user.update({
    where: { id: userId },
    data: {
      totalWagered: { increment: stakeDecimal },
    },
  });

  return {
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
  };
}

// ---------------------------------------------------------------------------
// User's bet history
// ---------------------------------------------------------------------------

export async function getUserBets(userId: string, filters: BetHistoryQuery) {
  const { page, limit, status, type, dateFrom, dateTo } = filters;

  const where: Prisma.BetWhereInput = {
    userId,
    ...(status ? { status: status as BetStatus } : {}),
    ...(type ? { type: type as BetType } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [bets, total] = await Promise.all([
    prisma.bet.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        legs: {
          include: {
            selection: {
              select: {
                name: true,
                odds: true,
                status: true,
                result: true,
                market: {
                  select: {
                    name: true,
                    event: {
                      select: {
                        name: true,
                        status: true,
                        scores: true,
                        startTime: true,
                        isLive: true,
                        homeTeam: true,
                        awayTeam: true,
                        competition: {
                          select: {
                            sport: { select: { name: true } },
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
      },
    }),
    prisma.bet.count({ where }),
  ]);

  return {
    bets: bets.map(formatBetResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ---------------------------------------------------------------------------
// Single bet detail
// ---------------------------------------------------------------------------

export async function getBet(userId: string, betId: string) {
  const bet = await prisma.bet.findFirst({
    where: { id: betId, userId },
    include: {
      legs: {
        include: {
          selection: {
            select: {
              name: true,
              odds: true,
              status: true,
              result: true,
              market: {
                select: {
                  name: true,
                  status: true,
                  event: {
                    select: {
                      id: true,
                      name: true,
                      status: true,
                      scores: true,
                      homeTeam: true,
                      awayTeam: true,
                      startTime: true,
                      competition: {
                        select: {
                          name: true,
                          sport: { select: { name: true, slug: true } },
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
    },
  });

  if (!bet) return null;

  // Calculate current cashout value
  let cashoutValue: string | null = null;
  if (bet.isCashoutAvailable && (bet.status === 'ACCEPTED' || bet.status === 'PENDING')) {
    const val = await calculateCashoutValue(bet);
    cashoutValue = val?.toString() ?? null;
  }

  return {
    ...formatBetResponse(bet),
    cashoutValue,
  };
}

// ---------------------------------------------------------------------------
// Open/active bets
// ---------------------------------------------------------------------------

export async function getOpenBets(userId: string) {
  const bets = await prisma.bet.findMany({
    where: {
      userId,
      status: { in: ['PENDING', 'ACCEPTED', 'PARTIALLY_SETTLED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      legs: {
        include: {
          selection: {
            select: {
              name: true,
              odds: true,
              status: true,
              result: true,
              market: {
                select: {
                  name: true,
                  event: {
                    select: {
                      name: true,
                      status: true,
                      scores: true,
                      isLive: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return bets.map(formatBetResponse);
}

// ---------------------------------------------------------------------------
// Generate shareable bet link
// ---------------------------------------------------------------------------

export async function shareBet(userId: string, betId: string) {
  const bet = await prisma.bet.findFirst({
    where: { id: betId, userId },
    select: { id: true, shareCode: true },
  });

  if (!bet) return null;

  if (bet.shareCode) {
    return { shareCode: bet.shareCode, shareUrl: `/bets/shared/${bet.shareCode}` };
  }

  const shareCode = crypto.randomBytes(8).toString('hex');
  await prisma.bet.update({
    where: { id: betId },
    data: { shareCode },
  });

  return { shareCode, shareUrl: `/bets/shared/${shareCode}` };
}

// ---------------------------------------------------------------------------
// Internal: Cashout value calculation
// ---------------------------------------------------------------------------

async function calculateCashoutValue(
  bet: {
    id: string;
    type: string;
    stake: Prisma.Decimal;
    odds: Prisma.Decimal;
    legs: Array<{
      oddsAtPlacement: Prisma.Decimal;
      status: string;
      selection: {
        odds: Prisma.Decimal;
        status: string;
        result: string | null;
      };
    }>;
  },
): Promise<Prisma.Decimal | null> {
  const CASHOUT_MARGIN = new Prisma.Decimal('0.95');

  if (bet.type === 'SINGLE') {
    const leg = bet.legs[0];
    if (!leg || leg.status !== 'PENDING') return null;

    const currentOdds = leg.selection.odds;
    if (currentOdds.lte(0)) return null;

    // cashoutValue = stake * (oddsAtPlacement / currentOdds) * margin
    const value = bet.stake
      .mul(leg.oddsAtPlacement)
      .div(currentOdds)
      .mul(CASHOUT_MARGIN);

    return value.gt(0) ? value : null;
  }

  // PARLAY: complex calculation based on settled/unsettled legs
  let settledMultiplier = new Prisma.Decimal(1);
  let unsettledMultiplier = new Prisma.Decimal(1);
  let hasUnsettled = false;

  for (const leg of bet.legs) {
    if (leg.status === 'WON') {
      settledMultiplier = settledMultiplier.mul(leg.oddsAtPlacement);
    } else if (leg.status === 'LOST') {
      return null; // Parlay is lost
    } else if (leg.status === 'VOID' || leg.status === 'PUSH') {
      // Void/push legs don't contribute
      continue;
    } else {
      // PENDING leg
      hasUnsettled = true;
      const currentOdds = leg.selection.odds;
      if (currentOdds.lte(0)) return null;
      const ratio = leg.oddsAtPlacement.div(currentOdds);
      unsettledMultiplier = unsettledMultiplier.mul(ratio);
    }
  }

  if (!hasUnsettled) return null; // All settled, no cashout needed

  const value = bet.stake
    .mul(settledMultiplier)
    .mul(unsettledMultiplier)
    .mul(CASHOUT_MARGIN);

  return value.gt(0) ? value : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBetResponse(bet: {
  id: string;
  referenceId: string;
  type: string;
  stake: Prisma.Decimal;
  currencySymbol: string;
  potentialWin: Prisma.Decimal;
  actualWin: Prisma.Decimal | null;
  cashoutAmount: Prisma.Decimal | null;
  cashoutAt: Date | null;
  odds: Prisma.Decimal;
  status: string;
  settledAt: Date | null;
  isLive: boolean;
  isCashoutAvailable: boolean;
  shareCode: string | null;
  createdAt: Date;
  legs: Array<{
    id: string;
    selectionId: string;
    eventName: string | null;
    marketName: string | null;
    selectionName: string | null;
    oddsAtPlacement: Prisma.Decimal;
    status: string;
    selection: {
      name: string;
      odds: Prisma.Decimal;
      status: string;
      result: string | null;
      market: {
        name: string;
        event: {
          name: string;
          status: string;
          scores: unknown;
          startTime?: Date;
          isLive?: boolean;
          homeTeam?: string | null;
          awayTeam?: string | null;
          competition?: { sport: { name: string } } | null;
        };
      };
    };
  }>;
}) {
  return {
    id: bet.id,
    referenceId: bet.referenceId,
    type: bet.type,
    stake: bet.stake.toString(),
    currency: bet.currencySymbol,
    potentialWin: bet.potentialWin.toString(),
    actualWin: bet.actualWin?.toString() ?? null,
    cashoutAmount: bet.cashoutAmount?.toString() ?? null,
    cashoutAt: bet.cashoutAt?.toISOString() ?? null,
    odds: bet.odds.toString(),
    status: bet.status,
    settledAt: bet.settledAt?.toISOString() ?? null,
    isLive: bet.isLive,
    isCashoutAvailable: bet.isCashoutAvailable,
    shareCode: bet.shareCode,
    createdAt: bet.createdAt.toISOString(),
    legs: bet.legs.map((l) => ({
      id: l.id,
      selectionId: l.selectionId,
      eventName: l.eventName,
      marketName: l.marketName,
      selectionName: l.selectionName,
      oddsAtPlacement: l.oddsAtPlacement.toString(),
      currentOdds: l.selection.odds.toString(),
      status: l.status,
      selectionStatus: l.selection.status,
      selectionResult: l.selection.result,
      event: {
        name: l.selection.market.event.name,
        status: l.selection.market.event.status,
        scores: l.selection.market.event.scores,
        startTime: l.selection.market.event.startTime
          ? (l.selection.market.event.startTime instanceof Date
            ? l.selection.market.event.startTime.toISOString()
            : l.selection.market.event.startTime)
          : undefined,
        isLive: l.selection.market.event.isLive ?? false,
        homeTeam: l.selection.market.event.homeTeam ?? null,
        awayTeam: l.selection.market.event.awayTeam ?? null,
        competition: l.selection.market.event.competition ?? null,
      },
      market: l.selection.market.name,
    })),
  };
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class BetError extends Error {
  public code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BetError';
    this.code = code;
  }
}
