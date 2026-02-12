import { Job } from 'bullmq';
import prisma from '../lib/prisma';
import Decimal from 'decimal.js';
import { addNotificationJob } from './index';
import { emitToUser } from '../lib/socket';

export interface BetSettlementData {
  marketId: string;
}

export async function settleBets(job: Job<BetSettlementData>): Promise<void> {
  const { marketId } = job.data;

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      selections: true,
      event: true,
    },
  });

  if (!market || market.status !== 'SETTLED') return;

  // Find all bet legs for this market's selections
  const selectionIds = market.selections.map((s) => s.id);
  const betLegs = await prisma.betLeg.findMany({
    where: {
      selectionId: { in: selectionIds },
      status: 'PENDING',
    },
    include: {
      selection: true,
      bet: { include: { legs: { include: { selection: true } } } },
    },
  });

  for (const leg of betLegs) {
    const selection = leg.selection;
    let legStatus: 'WON' | 'LOST' | 'VOID' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSE' = 'LOST';

    switch (selection.result) {
      case 'WIN':
        legStatus = 'WON';
        break;
      case 'LOSE':
        legStatus = 'LOST';
        break;
      case 'VOID':
        legStatus = 'VOID';
        break;
      case 'PUSH':
        legStatus = 'PUSH';
        break;
      case 'HALF_WIN':
        legStatus = 'HALF_WIN';
        break;
      case 'HALF_LOSE':
        legStatus = 'HALF_LOSE';
        break;
      default:
        continue; // Skip if no result yet
    }

    // Update leg status
    await prisma.betLeg.update({
      where: { id: leg.id },
      data: { status: legStatus },
    });

    // Check if all legs in the bet are settled
    const bet = leg.bet;
    const allLegs = bet.legs;
    const updatedLegs = allLegs.map((l) => (l.id === leg.id ? { ...l, status: legStatus } : l));
    const allSettled = updatedLegs.every((l) => l.status !== 'PENDING');

    if (allSettled) {
      await settleBet(bet.id, updatedLegs);
    }
  }
}

async function settleBet(
  betId: string,
  legs: Array<{ status: string; oddsAtPlacement: Decimal | number | string }>
): Promise<void> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
    include: { user: true },
  });

  if (!bet) return;

  const stake = new Decimal(bet.stake.toString());
  let totalOdds = new Decimal(1);
  let allWon = true;
  let anyLost = false;
  let hasVoid = false;

  for (const leg of legs) {
    const legOdds = new Decimal(leg.oddsAtPlacement.toString());

    switch (leg.status) {
      case 'WON':
        totalOdds = totalOdds.mul(legOdds);
        break;
      case 'LOST':
        anyLost = true;
        allWon = false;
        break;
      case 'VOID':
      case 'PUSH':
        hasVoid = true;
        // Void legs reduce to odds 1.0
        break;
      case 'HALF_WIN':
        totalOdds = totalOdds.mul(legOdds.minus(1).div(2).plus(1));
        break;
      case 'HALF_LOSE':
        totalOdds = totalOdds.mul(new Decimal(0.5));
        allWon = false;
        break;
    }
  }

  let betStatus: 'WON' | 'LOST' | 'VOID' = 'LOST';
  let actualWin = new Decimal(0);

  if (anyLost && !hasVoid) {
    betStatus = 'LOST';
    actualWin = new Decimal(0);
  } else if (legs.every((l) => l.status === 'VOID' || l.status === 'PUSH')) {
    betStatus = 'VOID';
    actualWin = stake; // Return stake
  } else if (allWon || (!anyLost && hasVoid)) {
    betStatus = 'WON';
    actualWin = stake.mul(totalOdds);
  }

  const wallet = await prisma.wallet.findFirst({
    where: {
      userId: bet.userId,
      currency: { symbol: bet.currencySymbol },
    },
  });

  if (!wallet) return;

  await prisma.$transaction([
    // Update bet
    prisma.bet.update({
      where: { id: betId },
      data: {
        status: betStatus,
        actualWin: actualWin.toNumber(),
        settledAt: new Date(),
      },
    }),
    // Unlock balance
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        lockedBalance: { decrement: stake.toNumber() },
        balance: { increment: actualWin.toNumber() },
      },
    }),
    // Create win transaction if won
    ...(actualWin.gt(0)
      ? [
          prisma.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'WIN',
              amount: actualWin.toNumber(),
              status: 'COMPLETED',
              metadata: { betId },
            },
          }),
        ]
      : []),
  ]);

  // Send notification
  await addNotificationJob({
    userId: bet.userId,
    type: 'BET_SETTLED',
    title: betStatus === 'WON' ? 'Bet Won!' : betStatus === 'VOID' ? 'Bet Voided' : 'Bet Lost',
    message:
      betStatus === 'WON'
        ? `Your bet won ${actualWin.toFixed(8)} ${bet.currencySymbol}!`
        : betStatus === 'VOID'
          ? `Your bet was voided. Stake returned.`
          : `Your bet did not win. Better luck next time!`,
    data: { betId, betStatus, actualWin: actualWin.toString() },
  });

  // Emit real-time update
  try {
    emitToUser(bet.userId, 'bet:settled', {
      betId,
      status: betStatus,
      actualWin: actualWin.toString(),
    });
  } catch {
    // Socket may not be initialized in worker
  }
}
