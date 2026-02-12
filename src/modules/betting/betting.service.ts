import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { BetType, BetStatus } from '@prisma/client';
import { AppError, InsufficientBalanceError, ValidationError } from '../../utils/errors';
import { BET } from '../../config/constants';
import { OddsEngine } from '../../services/oddsEngine';
import { addBetProcessingJob } from '../../queues';

// ─── System bet type definitions for stake distribution ─────────
const SYSTEM_BET_DEFS: Record<string, { selections: number; includesSingles: boolean }> = {
  trixie:    { selections: 3, includesSingles: false },
  patent:    { selections: 3, includesSingles: true },
  yankee:    { selections: 4, includesSingles: false },
  lucky15:   { selections: 4, includesSingles: true },
  canadian:  { selections: 5, includesSingles: false },
  lucky31:   { selections: 5, includesSingles: true },
  heinz:     { selections: 6, includesSingles: false },
  lucky63:   { selections: 6, includesSingles: true },
  superheinz:{ selections: 7, includesSingles: false },
  goliath:   { selections: 8, includesSingles: false },
};

function getComboSizes(systemType: string, selectionCount: number): number[] {
  const def = SYSTEM_BET_DEFS[systemType];
  if (!def) return [2]; // fallback
  const min = def.includesSingles ? 1 : 2;
  const sizes: number[] = [];
  for (let s = min; s <= selectionCount; s++) {
    sizes.push(s);
  }
  return sizes;
}

function generateCombinations(n: number, k: number): number[][] {
  const result: number[][] = [];
  const combo: number[] = [];
  function backtrack(start: number, remaining: number) {
    if (remaining === 0) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < n - remaining + 1; i++) {
      combo.push(i);
      backtrack(i + 1, remaining - 1);
      combo.pop();
    }
  }
  backtrack(0, k);
  return result;
}

export interface PlaceBetInput {
  selections: Array<{
    selectionId: string;
    oddsAtPlacement?: number;
  }>;
  type: 'SINGLE' | 'PARLAY' | 'SYSTEM';
  stake: string;
  currencySymbol: string;
  acceptOddsChange?: 'ANY' | 'BETTER_ONLY' | 'NONE';
  systemComboSize?: number;
  systemType?: string;
  isLive?: boolean;
  ipAddress?: string;
  placedVia?: string;
}

export class BettingService {
  async placeBet(userId: string, input: PlaceBetInput) {
    const {
      selections,
      type,
      stake: stakeStr,
      currencySymbol,
      acceptOddsChange = 'ANY',
      systemComboSize,
      systemType,
      isLive = false,
      ipAddress,
      placedVia = 'WEB',
    } = input;

    const stake = new Decimal(stakeStr);

    // Validate bet type constraints
    if (type === 'SINGLE' && selections.length !== 1) {
      throw new ValidationError('Single bets must have exactly 1 selection');
    }
    if (type === 'PARLAY') {
      if (selections.length < BET.MIN_PARLAY_LEGS) {
        throw new ValidationError(`Parlays require at least ${BET.MIN_PARLAY_LEGS} selections`);
      }
      if (selections.length > BET.MAX_PARLAY_LEGS) {
        throw new ValidationError(`Parlays cannot exceed ${BET.MAX_PARLAY_LEGS} selections`);
      }
    }
    if (type === 'SYSTEM') {
      if (!systemComboSize && !systemType) {
        throw new ValidationError('System bets require a combo size or system type');
      }
      if (systemComboSize && systemComboSize < 2) {
        throw new ValidationError('System bets require a combo size of at least 2');
      }
      if (systemType && !(systemType in SYSTEM_BET_DEFS)) {
        throw new ValidationError(`Unknown system bet type: ${systemType}`);
      }
      if (systemType) {
        const def = SYSTEM_BET_DEFS[systemType];
        if (selections.length !== def.selections) {
          throw new ValidationError(
            `${systemType} requires exactly ${def.selections} selections, got ${selections.length}`
          );
        }
      }
      if (selections.length > BET.MAX_SYSTEM_LEGS) {
        throw new ValidationError(`System bets cannot exceed ${BET.MAX_SYSTEM_LEGS} selections`);
      }
    }

    // Check user is not self-excluded or cooling off
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        selfExcludedUntil: true,
        coolingOffUntil: true,
        timeoutUntil: true,
        isBanned: true,
        wagerLimit: true,
      },
    });

    if (!user) throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    if (user.isBanned) throw new AppError('ACCOUNT_BANNED', 'Account is banned', 403);
    if (user.selfExcludedUntil && new Date() < user.selfExcludedUntil) {
      throw new AppError('SELF_EXCLUDED', 'Account is self-excluded', 403);
    }
    if (user.coolingOffUntil && new Date() < user.coolingOffUntil) {
      throw new AppError('COOLING_OFF', 'Account is in cooling-off period', 403);
    }
    if (user.timeoutUntil && new Date() < user.timeoutUntil) {
      throw new AppError('TIMEOUT', 'Account is timed out', 403);
    }

    // Check wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currencySymbol } },
    });

    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found for this currency', 404);

    const available = new Decimal(wallet.balance.toString());
    if (available.lt(stake)) throw new InsufficientBalanceError();

    // Fetch and validate all selections
    const selectionIds = selections.map((s) => s.selectionId);
    const dbSelections = await prisma.selection.findMany({
      where: { id: { in: selectionIds } },
      include: {
        market: {
          include: { event: true },
        },
      },
    });

    if (dbSelections.length !== selections.length) {
      throw new ValidationError('One or more selections not found');
    }

    // Validate selections are active and markets are open
    for (const sel of dbSelections) {
      if (sel.status !== 'ACTIVE') {
        throw new ValidationError(`Selection "${sel.name}" is not active`);
      }
      if (sel.market.status !== 'OPEN') {
        throw new ValidationError(`Market "${sel.market.name}" is not open for betting`);
      }
      if (sel.market.event.status === 'ENDED' || sel.market.event.status === 'CANCELLED') {
        throw new ValidationError(`Event "${sel.market.event.name}" is no longer available`);
      }
    }

    // Check for duplicate events in parlay (same game parlay is separate)
    if (type === 'PARLAY') {
      const eventIds = dbSelections.map((s) => s.market.eventId);
      const uniqueEvents = new Set(eventIds);
      if (uniqueEvents.size !== eventIds.length) {
        throw new ValidationError(
          'Parlay cannot contain multiple selections from the same event. Use Bet Builder for same-game parlays.'
        );
      }
    }

    // Handle odds changes
    const legs: Array<{ selectionId: string; odds: Decimal }> = [];
    for (const sel of dbSelections) {
      const currentOdds = new Decimal(sel.odds.toString());
      const inputSel = selections.find((s) => s.selectionId === sel.id)!;

      if (inputSel.oddsAtPlacement) {
        const placedOdds = new Decimal(inputSel.oddsAtPlacement);
        if (!currentOdds.eq(placedOdds)) {
          if (acceptOddsChange === 'NONE') {
            throw new AppError(
              'ODDS_CHANGED',
              `Odds for "${sel.name}" changed from ${placedOdds} to ${currentOdds}`,
              409,
              { selectionId: sel.id, oldOdds: placedOdds.toString(), newOdds: currentOdds.toString() }
            );
          }
          if (acceptOddsChange === 'BETTER_ONLY' && currentOdds.lt(placedOdds)) {
            throw new AppError(
              'ODDS_DECREASED',
              `Odds for "${sel.name}" decreased from ${placedOdds} to ${currentOdds}`,
              409,
              { selectionId: sel.id, oldOdds: placedOdds.toString(), newOdds: currentOdds.toString() }
            );
          }
        }
      }

      legs.push({ selectionId: sel.id, odds: currentOdds });
    }

    // Calculate combined odds and potential win
    let combinedOdds: Decimal;
    let potentialWin: Decimal;

    if (type === 'SINGLE') {
      combinedOdds = legs[0].odds;
      potentialWin = OddsEngine.potentialWin(stake, combinedOdds);
    } else if (type === 'PARLAY') {
      combinedOdds = OddsEngine.parlayOdds(legs.map((l) => l.odds));
      potentialWin = OddsEngine.potentialWin(stake, combinedOdds);
    } else {
      // System bet: if systemType is provided, create combination bets for each combo size
      if (systemType) {
        const comboSizes = getComboSizes(systemType, legs.length);
        let totalCombos = 0;
        for (const size of comboSizes) {
          totalCombos += generateCombinations(legs.length, size).length;
        }
        const stakePerCombo = stake.div(totalCombos);
        let totalPotentialWin = new Decimal(0);
        for (const size of comboSizes) {
          const combos = generateCombinations(legs.length, size);
          for (const combo of combos) {
            const comboOdds = combo.reduce(
              (acc, idx) => acc.mul(legs[idx].odds),
              new Decimal(1)
            );
            totalPotentialWin = totalPotentialWin.plus(stakePerCombo.mul(comboOdds));
          }
        }
        combinedOdds = totalPotentialWin.div(stake);
        potentialWin = totalPotentialWin;
      } else {
        // Fallback to systemComboSize-based calculation
        const result = OddsEngine.systemBetPotentialWin(
          stake,
          legs.map((l) => l.odds),
          systemComboSize!
        );
        combinedOdds = result.potentialWin.div(stake);
        potentialWin = result.potentialWin;
      }
    }

    // Validate stake limits
    for (const sel of dbSelections) {
      if (sel.maxStake && stake.gt(sel.maxStake.toString())) {
        throw new ValidationError(
          `Stake exceeds maximum of ${sel.maxStake} for "${sel.name}"`
        );
      }
      if (sel.market.minStake && stake.lt(sel.market.minStake.toString())) {
        throw new ValidationError(
          `Stake below minimum of ${sel.market.minStake} for market "${sel.market.name}"`
        );
      }
      if (sel.market.maxStake && stake.gt(sel.market.maxStake.toString())) {
        throw new ValidationError(
          `Stake exceeds maximum of ${sel.market.maxStake} for market "${sel.market.name}"`
        );
      }
    }

    // Create bet
    const bet = await prisma.bet.create({
      data: {
        userId,
        type: type as BetType,
        stake: stake.toNumber(),
        currencySymbol,
        odds: combinedOdds.toNumber(),
        potentialWin: potentialWin.toNumber(),
        isLive,
        isCashoutAvailable: !isLive,
        ipAddress,
        placedVia,
        status: 'PENDING',
        legs: {
          create: legs.map((leg) => ({
            selectionId: leg.selectionId,
            oddsAtPlacement: leg.odds.toNumber(),
          })),
        },
      },
      include: {
        legs: {
          include: {
            selection: {
              include: { market: { include: { event: true } } },
            },
          },
        },
      },
    });

    // Queue for processing (balance deduction)
    await addBetProcessingJob({
      betId: bet.id,
      userId,
      stake: stake.toString(),
      currencySymbol,
    });

    return bet;
  }

  async getBet(userId: string, betId: string) {
    const bet = await prisma.bet.findFirst({
      where: { id: betId, userId },
      include: {
        legs: {
          include: {
            selection: {
              include: {
                market: { include: { event: { include: { competition: { include: { sport: true } } } } } },
              },
            },
          },
        },
      },
    });
    if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found', 404);
    return bet;
  }

  async getBetByReference(referenceId: string) {
    const bet = await prisma.bet.findUnique({
      where: { referenceId },
      include: {
        legs: {
          include: {
            selection: {
              include: {
                market: { include: { event: true } },
              },
            },
          },
        },
      },
    });
    if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found', 404);
    return bet;
  }

  async getOpenBets(userId: string) {
    return prisma.bet.findMany({
      where: { userId, status: { in: ['PENDING', 'ACCEPTED'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        legs: {
          include: {
            selection: {
              include: {
                market: { include: { event: true } },
              },
            },
          },
        },
      },
    });
  }

  async getBetHistory(
    userId: string,
    filters: {
      status?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ) {
    const { status, type, startDate, endDate, page = 1, limit = 20 } = filters;
    const where: any = { userId };

    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

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
                include: {
                  market: { include: { event: true } },
                },
              },
            },
          },
        },
      }),
      prisma.bet.count({ where }),
    ]);

    return {
      bets,
      meta: { page, total, hasMore: page * limit < total },
    };
  }

  async cancelBet(userId: string, betId: string) {
    const bet = await prisma.bet.findFirst({
      where: { id: betId, userId, status: 'PENDING' },
    });

    if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found or not pending', 404);

    // Check grace period
    const elapsed = (Date.now() - bet.createdAt.getTime()) / 1000;
    if (elapsed > BET.GRACE_CANCEL_SECONDS) {
      throw new AppError('CANCEL_EXPIRED', 'Cancellation window has expired', 400);
    }

    // Refund
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: bet.currencySymbol } },
    });

    if (wallet) {
      await prisma.$transaction([
        prisma.bet.update({ where: { id: betId }, data: { status: 'VOID' } }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: bet.stake.toNumber() },
            lockedBalance: { decrement: bet.stake.toNumber() },
          },
        }),
      ]);
    }

    return { cancelled: true };
  }
}

export const bettingService = new BettingService();
