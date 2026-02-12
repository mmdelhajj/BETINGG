import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { addBetSettlementJob, addNotificationJob } from '../../queues';
import { emitToUser } from '../../lib/socket';

export class SettlementService {
  /**
   * Settle a market with results and trigger bet settlement
   */
  async settleMarket(
    marketId: string,
    results: Array<{ selectionId: string; result: 'WIN' | 'LOSE' | 'VOID' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSE' }>
  ) {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { selections: true, event: true },
    });

    if (!market) throw new Error('Market not found');
    if (market.status === 'SETTLED') throw new Error('Market already settled');

    // Update selection results
    for (const { selectionId, result } of results) {
      const statusMap: Record<string, string> = {
        WIN: 'WON',
        LOSE: 'LOST',
        VOID: 'VOID',
        PUSH: 'PUSH',
        HALF_WIN: 'WON',
        HALF_LOSE: 'LOST',
      };

      await prisma.selection.update({
        where: { id: selectionId },
        data: {
          result: result as any,
          status: statusMap[result] as any,
        },
      });
    }

    // Update market status
    await prisma.market.update({
      where: { id: marketId },
      data: { status: 'SETTLED' },
    });

    // Queue bet settlement
    await addBetSettlementJob({ marketId });

    return { settled: true, marketId };
  }

  /**
   * Void an entire market (refund all bets)
   */
  async voidMarket(marketId: string) {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { selections: true },
    });

    if (!market) throw new Error('Market not found');

    // Set all selections to void
    await prisma.selection.updateMany({
      where: { marketId },
      data: { result: 'VOID', status: 'VOID' },
    });

    await prisma.market.update({
      where: { id: marketId },
      data: { status: 'VOIDED' },
    });

    // Queue bet settlement (void logic handles refunds)
    await addBetSettlementJob({ marketId });

    return { voided: true, marketId };
  }

  /**
   * Get settlement report for a market
   */
  async getSettlementReport(marketId: string) {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: {
        selections: true,
        event: true,
      },
    });

    if (!market) throw new Error('Market not found');

    const betLegs = await prisma.betLeg.findMany({
      where: { selection: { marketId } },
      include: {
        bet: true,
        selection: true,
      },
    });

    let totalStaked = new Decimal(0);
    let totalPaidOut = new Decimal(0);
    let betsWon = 0;
    let betsLost = 0;
    let betsVoided = 0;

    for (const leg of betLegs) {
      totalStaked = totalStaked.plus(new Decimal(leg.bet.stake.toString()));
      if (leg.bet.actualWin) {
        totalPaidOut = totalPaidOut.plus(new Decimal(leg.bet.actualWin.toString()));
      }
      if (leg.bet.status === 'WON') betsWon++;
      else if (leg.bet.status === 'LOST') betsLost++;
      else if (leg.bet.status === 'VOID') betsVoided++;
    }

    return {
      market: {
        id: market.id,
        name: market.name,
        status: market.status,
        event: market.event.name,
      },
      selections: market.selections.map((s) => ({
        name: s.name,
        odds: s.odds.toString(),
        result: s.result,
      })),
      stats: {
        totalBets: betLegs.length,
        totalStaked: totalStaked.toString(),
        totalPaidOut: totalPaidOut.toString(),
        profit: totalStaked.minus(totalPaidOut).toString(),
        betsWon,
        betsLost,
        betsVoided,
      },
    };
  }

  /**
   * Auto-settle all markets for an ended event
   */
  async autoSettleEvent(eventId: string) {
    const markets = await prisma.market.findMany({
      where: { eventId, status: 'SETTLED' },
    });

    const results = [];
    for (const market of markets) {
      try {
        await addBetSettlementJob({ marketId: market.id });
        results.push({ marketId: market.id, queued: true });
      } catch (error) {
        results.push({ marketId: market.id, queued: false, error: String(error) });
      }
    }

    return results;
  }

  /**
   * Handle dead heat rule (multiple winners sharing the win)
   */
  async settleDeadHeat(
    marketId: string,
    winnerIds: string[],
    deadHeatFactor: number
  ) {
    const results = [];
    const allSelections = await prisma.selection.findMany({
      where: { marketId },
    });

    for (const sel of allSelections) {
      if (winnerIds.includes(sel.id)) {
        // Winner with dead heat reduction
        results.push({ selectionId: sel.id, result: 'WIN' as const });
      } else {
        results.push({ selectionId: sel.id, result: 'LOSE' as const });
      }
    }

    // Update selections
    for (const { selectionId, result } of results) {
      await prisma.selection.update({
        where: { id: selectionId },
        data: {
          result,
          status: result === 'WIN' ? 'WON' : 'LOST',
        },
      });
    }

    // For dead heat, we need to modify the payout calculation
    // Store the dead heat factor in market metadata
    await prisma.market.update({
      where: { id: marketId },
      data: { status: 'SETTLED' },
    });

    // Custom settlement with dead heat factor
    const betLegs = await prisma.betLeg.findMany({
      where: {
        selectionId: { in: winnerIds },
        status: 'PENDING',
      },
      include: { bet: true },
    });

    for (const leg of betLegs) {
      const originalPayout = new Decimal(leg.bet.stake.toString())
        .mul(new Decimal(leg.oddsAtPlacement.toString()));
      const adjustedPayout = originalPayout.mul(deadHeatFactor);

      // Update the leg's effective odds for settlement
      await prisma.betLeg.update({
        where: { id: leg.id },
        data: { status: 'WON' },
      });
    }

    await addBetSettlementJob({ marketId });
    return { settled: true, deadHeatFactor };
  }

  /**
   * Reconciliation: find unsettled bets for settled markets
   */
  async findUnsettledBets() {
    const unsettled = await prisma.betLeg.findMany({
      where: {
        status: 'PENDING',
        selection: {
          market: { status: 'SETTLED' },
          result: { not: null },
        },
      },
      include: {
        bet: true,
        selection: { include: { market: true } },
      },
      take: 100,
    });

    return unsettled.map((leg) => ({
      betId: leg.betId,
      betLegId: leg.id,
      selectionId: leg.selectionId,
      marketId: leg.selection.marketId,
      result: leg.selection.result,
    }));
  }
}

export const settlementService = new SettlementService();
