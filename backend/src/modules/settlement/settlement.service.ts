import { Prisma, type BetStatus, type BetLegStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rewardCalculationQueue } from '../../queues/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettlementResult {
  betId: string;
  status: BetStatus;
  actualWin: string;
  legsSettled: number;
}

interface SettlementReport {
  totalBetsSettled: number;
  totalWon: string;
  totalLost: string;
  totalVoid: string;
  totalPayout: string;
  totalStake: string;
  grossProfit: string;
  dateFrom: string;
  dateTo: string;
}

// ---------------------------------------------------------------------------
// Settle a single bet (called when all legs have results)
// ---------------------------------------------------------------------------

/**
 * Settle an individual bet. Evaluates all legs and determines the outcome.
 *
 * SINGLE: if WON -> payout = stake * odds. LOST -> payout = 0. VOID -> return stake. PUSH -> return stake.
 * PARLAY: all legs must be WON to win. Void legs reduce combined odds. Push = return stake for that leg proportion.
 */
export async function settleBet(betId: string): Promise<SettlementResult> {
  const result = await prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUniqueOrThrow({
      where: { id: betId },
      include: {
        legs: {
          include: {
            selection: {
              select: {
                id: true,
                status: true,
                result: true,
                odds: true,
              },
            },
          },
        },
      },
    });

    // Skip if already settled or cashed out
    if (bet.status === 'WON' || bet.status === 'LOST' || bet.status === 'VOID' || bet.status === 'CASHOUT') {
      return {
        betId: bet.id,
        status: bet.status,
        actualWin: bet.actualWin?.toString() ?? '0',
        legsSettled: bet.legs.length,
      };
    }

    // Check if all legs are settled
    const allSettled = bet.legs.every(
      (l) => l.status !== 'PENDING',
    );

    if (!allSettled) {
      // Mark as partially settled if at least one is settled
      const someSettled = bet.legs.some((l) => l.status !== 'PENDING');
      if (someSettled && bet.status !== 'PARTIALLY_SETTLED') {
        await tx.bet.update({
          where: { id: betId },
          data: { status: 'PARTIALLY_SETTLED' },
        });
      }
      return {
        betId: bet.id,
        status: 'PARTIALLY_SETTLED' as BetStatus,
        actualWin: '0',
        legsSettled: bet.legs.filter((l) => l.status !== 'PENDING').length,
      };
    }

    // All legs settled - determine bet outcome
    const settledAt = new Date();
    let betStatus: BetStatus;
    let payout: Prisma.Decimal;

    if (bet.type === 'SINGLE') {
      const leg = bet.legs[0];
      if (!leg) {
        throw new Error('Single bet has no legs');
      }

      switch (leg.status) {
        case 'WON':
          betStatus = 'WON';
          payout = bet.stake.mul(leg.oddsAtPlacement);
          break;
        case 'LOST':
          betStatus = 'LOST';
          payout = new Prisma.Decimal(0);
          break;
        case 'VOID':
          betStatus = 'VOID';
          payout = bet.stake; // Return stake
          break;
        case 'PUSH':
          betStatus = 'VOID';
          payout = bet.stake; // Return stake on push
          break;
        case 'HALF_WIN':
          betStatus = 'WON';
          // Half win: half the profit
          const halfProfit = bet.stake.mul(leg.oddsAtPlacement).minus(bet.stake).div(2);
          payout = bet.stake.add(halfProfit);
          break;
        case 'HALF_LOSE':
          betStatus = 'LOST';
          // Half lose: lose half the stake
          payout = bet.stake.div(2);
          break;
        default:
          betStatus = 'LOST';
          payout = new Prisma.Decimal(0);
      }
    } else {
      // PARLAY or SYSTEM
      let allWon = true;
      let anyLost = false;
      let allVoidOrPush = true;
      let combinedOdds = new Prisma.Decimal(1);
      let voidCount = 0;

      for (const leg of bet.legs) {
        switch (leg.status) {
          case 'WON':
            allVoidOrPush = false;
            combinedOdds = combinedOdds.mul(leg.oddsAtPlacement);
            break;
          case 'LOST':
            allWon = false;
            anyLost = true;
            allVoidOrPush = false;
            break;
          case 'VOID':
          case 'PUSH':
            // Void legs are removed from parlay (odds = 1.0 for that leg)
            allWon = false; // technically not all "won" but the bet isn't lost
            voidCount++;
            break;
          case 'HALF_WIN':
            allVoidOrPush = false;
            // Half win: use average between 1.0 and full odds
            const adjustedWinOdds = new Prisma.Decimal(1).add(
              leg.oddsAtPlacement.minus(1).div(2),
            );
            combinedOdds = combinedOdds.mul(adjustedWinOdds);
            break;
          case 'HALF_LOSE':
            allVoidOrPush = false;
            // Half lose: use 0.5 as the effective multiplier for this leg
            combinedOdds = combinedOdds.mul(new Prisma.Decimal('0.5'));
            anyLost = true; // Still considered a loss leg
            break;
          default:
            allWon = false;
            anyLost = true;
            allVoidOrPush = false;
        }
      }

      if (allVoidOrPush) {
        // All legs void/push -> return stake
        betStatus = 'VOID';
        payout = bet.stake;
      } else if (anyLost) {
        // Any lost leg in parlay = entire parlay lost (except half-lose edge case)
        const hasOnlyHalfLose = bet.legs.every(
          (l) => l.status === 'WON' || l.status === 'VOID' || l.status === 'PUSH' || l.status === 'HALF_WIN' || l.status === 'HALF_LOSE',
        );

        if (hasOnlyHalfLose && !bet.legs.some((l) => l.status === 'LOST')) {
          // No full losses, only half-loses mixed with wins
          betStatus = 'WON';
          payout = bet.stake.mul(combinedOdds);
        } else {
          betStatus = 'LOST';
          payout = new Prisma.Decimal(0);
        }
      } else {
        // All non-void legs won
        betStatus = 'WON';
        payout = bet.stake.mul(combinedOdds);
      }
    }

    // Update the bet
    await tx.bet.update({
      where: { id: betId },
      data: {
        status: betStatus,
        actualWin: payout,
        settledAt,
        isCashoutAvailable: false,
      },
    });

    // Credit winnings to user's wallet (if payout > 0)
    if (payout.gt(0)) {
      const currency = await tx.currency.findUnique({
        where: { symbol: bet.currencySymbol },
        select: { id: true },
      });

      if (currency) {
        const wallet = await tx.wallet.findUnique({
          where: { userId_currencyId: { userId: bet.userId, currencyId: currency.id } },
        });

        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: payout } },
          });

          // Create WIN or VOID transaction
          const txType = betStatus === 'VOID' ? 'ADJUSTMENT' : 'WIN';
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: txType,
              amount: payout,
              status: 'COMPLETED',
              metadata: {
                betId: bet.id,
                referenceId: bet.referenceId,
                type: bet.type,
                originalStake: bet.stake.toString(),
                originalOdds: bet.odds.toString(),
                settlementType: betStatus,
              },
            },
          });
        }
      }
    }

    // Create LOSS transaction record (for tracking)
    if (betStatus === 'LOST') {
      const currency = await tx.currency.findUnique({
        where: { symbol: bet.currencySymbol },
        select: { id: true },
      });
      if (currency) {
        const wallet = await tx.wallet.findUnique({
          where: { userId_currencyId: { userId: bet.userId, currencyId: currency.id } },
        });
        if (wallet) {
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'BET',
              amount: new Prisma.Decimal(0),
              status: 'COMPLETED',
              metadata: {
                betId: bet.id,
                referenceId: bet.referenceId,
                settlementType: 'LOSS',
                originalStake: bet.stake.toString(),
              },
            },
          });
        }
      }
    }

    return {
      betId: bet.id,
      status: betStatus,
      actualWin: payout.toString(),
      legsSettled: bet.legs.length,
    };
  });

  // Trigger async post-settlement tasks
  await rewardCalculationQueue.add('bet-settled', {
    betId: result.betId,
    status: result.status,
    actualWin: result.actualWin,
    timestamp: new Date().toISOString(),
  });

  return result;
}

// ---------------------------------------------------------------------------
// Settle all bets for a market
// ---------------------------------------------------------------------------

/**
 * When a market is settled, find all bets with legs on this market,
 * update leg statuses from selection results, then attempt to settle
 * any fully-determined bets.
 */
export async function settleMarketBets(marketId: string): Promise<{
  legsUpdated: number;
  betsSettled: number;
  results: SettlementResult[];
}> {
  // Get all selections in this market with their results
  const selections = await prisma.selection.findMany({
    where: { marketId },
    select: { id: true, status: true, result: true },
  });

  if (selections.length === 0) {
    return { legsUpdated: 0, betsSettled: 0, results: [] };
  }

  const selectionResultMap = new Map<string, { status: string; result: string | null }>();
  for (const sel of selections) {
    selectionResultMap.set(sel.id, { status: sel.status, result: sel.result });
  }

  // Find all bet legs for these selections that are still pending
  const selectionIds = selections.map((s) => s.id);
  const pendingLegs = await prisma.betLeg.findMany({
    where: {
      selectionId: { in: selectionIds },
      status: 'PENDING',
    },
    select: { id: true, betId: true, selectionId: true },
  });

  if (pendingLegs.length === 0) {
    return { legsUpdated: 0, betsSettled: 0, results: [] };
  }

  // Update each leg's status based on selection result
  let legsUpdated = 0;
  const affectedBetIds = new Set<string>();

  for (const leg of pendingLegs) {
    const selResult = selectionResultMap.get(leg.selectionId);
    if (!selResult || !selResult.result) continue;

    const legStatus = mapResultToLegStatus(selResult.result);

    await prisma.betLeg.update({
      where: { id: leg.id },
      data: { status: legStatus },
    });

    legsUpdated++;
    affectedBetIds.add(leg.betId);
  }

  // Try to settle each affected bet
  const results: SettlementResult[] = [];
  for (const betId of affectedBetIds) {
    try {
      const result = await settleBet(betId);
      results.push(result);
    } catch (err) {
      console.error(`[Settlement] Failed to settle bet ${betId}:`, err);
    }
  }

  const betsSettled = results.filter(
    (r) => r.status === 'WON' || r.status === 'LOST' || r.status === 'VOID',
  ).length;

  return { legsUpdated, betsSettled, results };
}

// ---------------------------------------------------------------------------
// Process void leg
// ---------------------------------------------------------------------------

/**
 * Handle a voided selection: mark the leg as VOID, then settle the bet.
 * SINGLE: return stake.
 * PARLAY: recalculate without the void leg.
 */
export async function processVoidLeg(betLegId: string): Promise<void> {
  const leg = await prisma.betLeg.findUniqueOrThrow({
    where: { id: betLegId },
    select: { id: true, betId: true, status: true },
  });

  if (leg.status !== 'PENDING') return;

  await prisma.betLeg.update({
    where: { id: betLegId },
    data: { status: 'VOID' },
  });

  // Check if the bet should be settled now
  const bet = await prisma.bet.findUnique({
    where: { id: leg.betId },
    include: {
      legs: { select: { status: true } },
    },
  });

  if (!bet) return;

  if (bet.type === 'SINGLE') {
    // Single bet with void leg = return stake immediately
    await settleBet(bet.id);
  } else {
    // Parlay: check if all remaining legs are settled
    const allResolved = bet.legs.every((l) => l.status !== 'PENDING');
    if (allResolved) {
      await settleBet(bet.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Settlement Report (Admin)
// ---------------------------------------------------------------------------

/**
 * Generate a settlement report for a date range.
 */
export async function getSettlementReport(
  dateFrom: string,
  dateTo: string,
): Promise<SettlementReport> {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  const settledBets = await prisma.bet.findMany({
    where: {
      settledAt: { gte: from, lte: to },
      status: { in: ['WON', 'LOST', 'VOID', 'CASHOUT'] },
    },
    select: {
      id: true,
      status: true,
      stake: true,
      actualWin: true,
    },
  });

  let totalWon = new Prisma.Decimal(0);
  let totalLost = new Prisma.Decimal(0);
  let totalVoid = new Prisma.Decimal(0);
  let totalPayout = new Prisma.Decimal(0);
  let totalStake = new Prisma.Decimal(0);
  let wonCount = 0;
  let lostCount = 0;
  let voidCount = 0;

  for (const bet of settledBets) {
    totalStake = totalStake.add(bet.stake);
    const win = bet.actualWin ?? new Prisma.Decimal(0);

    switch (bet.status) {
      case 'WON':
        wonCount++;
        totalWon = totalWon.add(win);
        totalPayout = totalPayout.add(win);
        break;
      case 'LOST':
        lostCount++;
        totalLost = totalLost.add(bet.stake);
        break;
      case 'VOID':
        voidCount++;
        totalVoid = totalVoid.add(bet.stake);
        totalPayout = totalPayout.add(bet.stake); // Stake returned
        break;
      case 'CASHOUT':
        totalPayout = totalPayout.add(win);
        break;
    }
  }

  const grossProfit = totalStake.minus(totalPayout);

  return {
    totalBetsSettled: settledBets.length,
    totalWon: totalWon.toString(),
    totalLost: totalLost.toString(),
    totalVoid: totalVoid.toString(),
    totalPayout: totalPayout.toString(),
    totalStake: totalStake.toString(),
    grossProfit: grossProfit.toString(),
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapResultToLegStatus(result: string): BetLegStatus {
  switch (result) {
    case 'WIN':
      return 'WON';
    case 'LOSE':
      return 'LOST';
    case 'VOID':
      return 'VOID';
    case 'PUSH':
      return 'PUSH';
    case 'HALF_WIN':
      return 'HALF_WIN';
    case 'HALF_LOSE':
      return 'HALF_LOSE';
    default:
      return 'PENDING';
  }
}
