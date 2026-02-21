import { Prisma, type BetStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASHOUT_MARGIN = new Prisma.Decimal('0.95');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class CashoutError extends Error {
  public code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CashoutError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Get Cashout Value
// ---------------------------------------------------------------------------

/**
 * Calculate the current cashout value for a bet.
 *
 * SINGLE: cashoutValue = stake * (oddsAtPlacement / currentOdds) * margin
 * PARLAY: complex - product of settled odds * ratio of unsettled legs * margin
 */
export async function getCashoutValue(betId: string): Promise<{
  available: boolean;
  cashoutValue: string | null;
  betId: string;
}> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      legs: {
        include: {
          selection: {
            select: {
              id: true,
              odds: true,
              status: true,
              result: true,
            },
          },
        },
      },
    },
  });

  if (!bet) {
    throw new CashoutError('BET_NOT_FOUND', 'Bet not found.');
  }

  // Only active bets can be cashed out
  if (bet.status !== 'ACCEPTED' && bet.status !== 'PENDING') {
    return { available: false, cashoutValue: null, betId };
  }

  if (!bet.isCashoutAvailable) {
    return { available: false, cashoutValue: null, betId };
  }

  const value = calculateValue(bet);

  if (!value || value.lte(0)) {
    return { available: false, cashoutValue: null, betId };
  }

  // Round to 8 decimal places
  const rounded = value.toDecimalPlaces(8);

  return {
    available: true,
    cashoutValue: rounded.toString(),
    betId,
  };
}

// ---------------------------------------------------------------------------
// Execute Cashout
// ---------------------------------------------------------------------------

/**
 * Execute a cashout on a bet (full or partial).
 */
export async function cashout(
  userId: string,
  betId: string,
  requestedAmount?: number,
): Promise<{
  bet: {
    id: string;
    status: string;
    cashoutAmount: string;
    cashoutAt: string;
  };
}> {
  // Validate ownership and eligibility
  const bet = await prisma.bet.findFirst({
    where: { id: betId, userId },
    include: {
      legs: {
        include: {
          selection: {
            select: {
              id: true,
              odds: true,
              status: true,
              result: true,
            },
          },
        },
      },
    },
  });

  if (!bet) {
    throw new CashoutError('BET_NOT_FOUND', 'Bet not found.');
  }

  if (bet.status !== 'ACCEPTED' && bet.status !== 'PENDING') {
    throw new CashoutError('BET_NOT_ACTIVE', `Bet is not active (status: ${bet.status}).`);
  }

  if (!bet.isCashoutAvailable) {
    throw new CashoutError('CASHOUT_UNAVAILABLE', 'Cashout is not available for this bet.');
  }

  // Calculate current cashout value
  const currentValue = calculateValue(bet);
  if (!currentValue || currentValue.lte(0)) {
    throw new CashoutError('CASHOUT_UNAVAILABLE', 'Cashout value is zero or negative.');
  }

  const cashoutAmount = requestedAmount
    ? new Prisma.Decimal(requestedAmount)
    : currentValue;

  // Validate requested amount
  if (cashoutAmount.gt(currentValue)) {
    throw new CashoutError(
      'AMOUNT_TOO_HIGH',
      `Requested amount (${cashoutAmount.toString()}) exceeds available cashout value (${currentValue.toString()}).`,
    );
  }

  if (cashoutAmount.lte(0)) {
    throw new CashoutError('INVALID_AMOUNT', 'Cashout amount must be positive.');
  }

  // Determine if this is a full or partial cashout
  const isPartial = requestedAmount !== undefined && cashoutAmount.lt(currentValue);
  const cashoutAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // Find user's wallet
    const currency = await tx.currency.findUnique({
      where: { symbol: bet.currencySymbol },
      select: { id: true },
    });

    if (!currency) {
      throw new CashoutError('CURRENCY_NOT_FOUND', 'Currency not found.');
    }

    const wallet = await tx.wallet.findUnique({
      where: { userId_currencyId: { userId, currencyId: currency.id } },
    });

    if (!wallet) {
      throw new CashoutError('WALLET_NOT_FOUND', 'Wallet not found.');
    }

    if (isPartial) {
      // Partial cashout: reduce stake proportionally, credit partial amount
      const proportion = cashoutAmount.div(currentValue);
      const stakeReduction = bet.stake.mul(proportion);
      const newStake = bet.stake.minus(stakeReduction);
      const newPotentialWin = bet.potentialWin.mul(new Prisma.Decimal(1).minus(proportion));

      await tx.bet.update({
        where: { id: betId },
        data: {
          stake: newStake,
          potentialWin: newPotentialWin,
          cashoutAmount: cashoutAmount,
          cashoutAt,
        },
      });

      // Credit partial cashout to wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: cashoutAmount },
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WIN',
          amount: cashoutAmount,
          status: 'COMPLETED',
          metadata: {
            betId,
            type: 'PARTIAL_CASHOUT',
            originalStake: bet.stake.toString(),
            newStake: newStake.toString(),
          },
        },
      });

      return {
        id: betId,
        status: bet.status,
        cashoutAmount: cashoutAmount.toString(),
        cashoutAt: cashoutAt.toISOString(),
      };
    } else {
      // Full cashout: close the bet
      await tx.bet.update({
        where: { id: betId },
        data: {
          status: 'CASHOUT' as BetStatus,
          cashoutAmount,
          cashoutAt,
          settledAt: cashoutAt,
          actualWin: cashoutAmount,
          isCashoutAvailable: false,
        },
      });

      // Update all pending legs to VOID
      await tx.betLeg.updateMany({
        where: { betId, status: 'PENDING' },
        data: { status: 'VOID' },
      });

      // Credit cashout to wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: cashoutAmount },
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WIN',
          amount: cashoutAmount,
          status: 'COMPLETED',
          metadata: {
            betId,
            type: 'CASHOUT',
            originalStake: bet.stake.toString(),
            originalOdds: bet.odds.toString(),
          },
        },
      });

      return {
        id: betId,
        status: 'CASHOUT',
        cashoutAmount: cashoutAmount.toString(),
        cashoutAt: cashoutAt.toISOString(),
      };
    }
  });

  // Invalidate cached data
  await redis.del(`bet:cashout:${betId}`);

  return { bet: result };
}

// ---------------------------------------------------------------------------
// Update Cashout Availability
// ---------------------------------------------------------------------------

/**
 * Called when odds change, to re-evaluate whether cashout should be available.
 */
export async function updateCashoutAvailability(betId: string): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: {
      legs: {
        include: {
          selection: {
            select: { odds: true, status: true, result: true },
          },
        },
      },
    },
  });

  if (!bet) return;
  if (bet.status !== 'ACCEPTED' && bet.status !== 'PENDING') return;

  const value = calculateValue(bet);
  const isAvailable = value !== null && value.gt(0);

  if (bet.isCashoutAvailable !== isAvailable) {
    await prisma.bet.update({
      where: { id: betId },
      data: { isCashoutAvailable: isAvailable },
    });
  }
}

// ---------------------------------------------------------------------------
// Internal calculation
// ---------------------------------------------------------------------------

function calculateValue(
  bet: {
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
): Prisma.Decimal | null {
  if (bet.type === 'SINGLE') {
    const leg = bet.legs[0];
    if (!leg || leg.status !== 'PENDING') return null;

    const currentOdds = leg.selection.odds;
    if (currentOdds.lte(0)) return null;

    return bet.stake
      .mul(leg.oddsAtPlacement)
      .div(currentOdds)
      .mul(CASHOUT_MARGIN);
  }

  // PARLAY
  let settledMultiplier = new Prisma.Decimal(1);
  let unsettledMultiplier = new Prisma.Decimal(1);
  let hasUnsettled = false;
  let hasLost = false;

  for (const leg of bet.legs) {
    if (leg.status === 'WON') {
      settledMultiplier = settledMultiplier.mul(leg.oddsAtPlacement);
    } else if (leg.status === 'LOST') {
      hasLost = true;
      break;
    } else if (leg.status === 'VOID' || leg.status === 'PUSH') {
      continue; // neutral
    } else {
      // PENDING
      hasUnsettled = true;
      const currentOdds = leg.selection.odds;
      if (currentOdds.lte(0)) return null;
      unsettledMultiplier = unsettledMultiplier.mul(
        leg.oddsAtPlacement.div(currentOdds),
      );
    }
  }

  if (hasLost) return null;
  if (!hasUnsettled) return null; // All settled

  return bet.stake
    .mul(settledMultiplier)
    .mul(unsettledMultiplier)
    .mul(CASHOUT_MARGIN);
}
