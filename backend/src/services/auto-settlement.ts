import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { settleMarketBets } from '../modules/settlement/settlement.service.js';
import { broadcastEventStatus, broadcastBetSettlement } from '../modules/live/live.service.js';
import { notificationSenderQueue } from '../queues/index.js';
import { logger } from '../middleware/logger.js';

// ---------------------------------------------------------------------------
// Auto-settle an event after it finishes
// ---------------------------------------------------------------------------

/**
 * Called when an event finishes.
 * Determines market winners from the final score and settles all bets.
 *
 * @param eventId - The DB ID of the event
 * @param score - Optional score data. If provided AND event has no scores yet,
 *                this will be written to the event record before settlement.
 */
export async function autoSettleEvent(
  eventId: string,
  score?: { home: number; away: number },
): Promise<{
  marketsSettled: number;
  betsSettled: number;
  totalPayout: string;
}> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      status: true,
      scores: true,
      metadata: true,
      competition: {
        select: {
          sport: { select: { slug: true, name: true } },
        },
      },
      markets: {
        where: { status: 'OPEN' },
        include: {
          selections: { where: { status: 'ACTIVE' } },
        },
      },
    },
  });

  if (!event) {
    logger.warn({ eventId }, '[AutoSettle] Event not found');
    return { marketsSettled: 0, betsSettled: 0, totalPayout: '0' };
  }

  // If event is not ENDED yet, mark it as ENDED (caller may be stale-event cron)
  if (event.status !== 'ENDED') {
    logger.info({ eventId, status: event.status }, '[AutoSettle] Marking event as ENDED for settlement');
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'ENDED', isLive: false },
    });
  }

  // Resolve scores: use existing event scores, or the provided score param, or generate random scores
  let scores = event.scores as { home: number; away: number } | null;

  if ((!scores || scores.home === undefined || scores.away === undefined) && score) {
    // Use caller-provided scores
    scores = { home: score.home, away: score.away };
    await prisma.event.update({
      where: { id: eventId },
      data: { scores: scores as any },
    });
    logger.info({ eventId, scores }, '[AutoSettle] Wrote provided scores to event');
  }

  if (!scores || scores.home === undefined || scores.away === undefined) {
    // Generate random realistic scores based on sport type
    const sportSlug = event.competition?.sport?.slug || 'football';
    scores = generateRandomScores(sportSlug);
    await prisma.event.update({
      where: { id: eventId },
      data: { scores: scores as any },
    });
    logger.info({ eventId, sportSlug, scores }, '[AutoSettle] Generated random scores for event');
  }

  if (event.markets.length === 0) {
    logger.info({ eventId }, '[AutoSettle] No open markets to settle');
    return { marketsSettled: 0, betsSettled: 0, totalPayout: '0' };
  }

  logger.info({
    eventId,
    eventName: event.name,
    score: `${scores.home}-${scores.away}`,
    markets: event.markets.length,
  }, '[AutoSettle] Starting auto-settlement');

  // Broadcast event status change
  try {
    broadcastEventStatus(eventId, 'ENDED', false);
  } catch { /* best effort */ }

  let marketsSettled = 0;
  let totalBetsSettled = 0;
  let totalPayout = new Prisma.Decimal(0);

  for (const market of event.markets) {
    try {
      const result = await settleMarket(market, scores);
      if (!result) continue;

      marketsSettled++;

      // Now settle all bets on this market
      const settlementResult = await settleMarketBets(market.id);
      totalBetsSettled += settlementResult.betsSettled;

      // Broadcast bet settlements to users
      for (const betResult of settlementResult.results) {
        if (betResult.status === 'WON' || betResult.status === 'LOST' || betResult.status === 'VOID') {
          totalPayout = totalPayout.add(new Prisma.Decimal(betResult.actualWin));

          // Get the user ID for this bet
          try {
            const bet = await prisma.bet.findUnique({
              where: { id: betResult.betId },
              select: { userId: true, stake: true, currencySymbol: true },
            });

            if (bet) {
              // Broadcast to user via Socket.IO
              try {
                broadcastBetSettlement(bet.userId, {
                  betId: betResult.betId,
                  status: betResult.status,
                  actualWin: betResult.actualWin,
                });
              } catch { /* best effort */ }

              // Queue notification
              await notificationSenderQueue.add('bet-settled-notification', {
                userId: bet.userId,
                betId: betResult.betId,
                status: betResult.status,
                stake: bet.stake.toString(),
                payout: betResult.actualWin,
                currency: bet.currencySymbol,
                eventName: event.name,
              });
            }
          } catch (err) {
            logger.error({ betId: betResult.betId, err }, '[AutoSettle] Failed to notify user');
          }
        }
      }

      logger.info({
        marketId: market.id,
        marketName: market.name,
        legsUpdated: settlementResult.legsUpdated,
        betsSettled: settlementResult.betsSettled,
      }, '[AutoSettle] Market settled');
    } catch (err) {
      logger.error({ marketId: market.id, err }, '[AutoSettle] Failed to settle market');
    }
  }

  logger.info({
    eventId,
    eventName: event.name,
    marketsSettled,
    betsSettled: totalBetsSettled,
    totalPayout: totalPayout.toString(),
  }, '[AutoSettle] Event settlement complete');

  return {
    marketsSettled,
    betsSettled: totalBetsSettled,
    totalPayout: totalPayout.toString(),
  };
}

// ---------------------------------------------------------------------------
// Settle a single market based on final scores
// ---------------------------------------------------------------------------

interface MarketWithSelections {
  id: string;
  name: string;
  type: string;
  marketKey: string;
  selections: Array<{
    id: string;
    name: string;
    outcome: string;
    status: string;
  }>;
}

async function settleMarket(
  market: MarketWithSelections,
  scores: { home: number; away: number },
): Promise<boolean> {
  const { home, away } = scores;

  if (market.type === 'MONEYLINE' || market.marketKey === '1X2' || market.marketKey === 'ML') {
    return settleMoneyline(market, home, away);
  }

  if (market.type === 'TOTAL' || market.marketKey.startsWith('OU')) {
    return settleTotal(market, home, away);
  }

  // Unknown market type -- skip auto-settlement
  logger.warn({
    marketId: market.id,
    marketType: market.type,
    marketKey: market.marketKey,
  }, '[AutoSettle] Unknown market type, skipping');
  return false;
}

// ---------------------------------------------------------------------------
// Moneyline / 1X2 settlement
// ---------------------------------------------------------------------------

async function settleMoneyline(
  market: MarketWithSelections,
  home: number,
  away: number,
): Promise<boolean> {
  let winnerOutcome: string;

  if (home > away) {
    winnerOutcome = 'HOME';
  } else if (away > home) {
    winnerOutcome = 'AWAY';
  } else {
    winnerOutcome = 'DRAW';
  }

  // Check if there's a DRAW selection (3-way market)
  const hasDrawSelection = market.selections.some(s => s.outcome === 'DRAW');

  for (const selection of market.selections) {
    let result: string;
    let status: string;

    if (selection.outcome === winnerOutcome) {
      result = 'WIN';
      status = 'WON';
    } else if (home === away && !hasDrawSelection) {
      // 2-way moneyline with draw result -> void all selections (push)
      result = 'PUSH';
      status = 'VOID';
    } else {
      result = 'LOSE';
      status = 'LOST';
    }

    await prisma.selection.update({
      where: { id: selection.id },
      data: { result, status },
    });
  }

  // Mark market as settled
  await prisma.market.update({
    where: { id: market.id },
    data: { status: 'SETTLED' },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Over/Under (Total) settlement
// ---------------------------------------------------------------------------

async function settleTotal(
  market: MarketWithSelections,
  home: number,
  away: number,
): Promise<boolean> {
  // Extract the total line from the market key: "OU2.5" -> 2.5
  let totalLine: number;
  const lineMatch = market.marketKey.match(/OU([\d.]+)/);

  if (lineMatch) {
    totalLine = parseFloat(lineMatch[1]);
  } else {
    // Try to extract from market name: "Over/Under 2.5 Goals" -> 2.5
    const nameMatch = market.name.match(/([\d.]+)/);
    if (!nameMatch) {
      logger.warn({ marketId: market.id, marketKey: market.marketKey }, '[AutoSettle] Could not determine total line');
      return false;
    }
    totalLine = parseFloat(nameMatch[1]);
  }

  const totalScore = home + away;

  for (const selection of market.selections) {
    let result: string;
    let status: string;

    if (selection.outcome === 'OVER') {
      if (totalScore > totalLine) {
        result = 'WIN';
        status = 'WON';
      } else if (totalScore === totalLine) {
        result = 'PUSH';
        status = 'VOID';
      } else {
        result = 'LOSE';
        status = 'LOST';
      }
    } else if (selection.outcome === 'UNDER') {
      if (totalScore < totalLine) {
        result = 'WIN';
        status = 'WON';
      } else if (totalScore === totalLine) {
        result = 'PUSH';
        status = 'VOID';
      } else {
        result = 'LOSE';
        status = 'LOST';
      }
    } else {
      continue; // Unknown outcome for a total market
    }

    await prisma.selection.update({
      where: { id: selection.id },
      data: { result, status },
    });
  }

  // Mark market as settled
  await prisma.market.update({
    where: { id: market.id },
    data: { status: 'SETTLED' },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Random Score Generator
// ---------------------------------------------------------------------------

/**
 * Generates random but realistic scores based on sport type.
 * Used when real scores are not available from the API (e.g. stale event cleanup).
 */
export function generateRandomScores(sportSlug: string): { home: number; away: number } {
  const rng = () => Math.random();

  switch (sportSlug) {
    case 'football': // Soccer: typically 0-5 goals per side
      return {
        home: Math.floor(rng() * 4),
        away: Math.floor(rng() * 4),
      };

    case 'basketball': // Basketball: 80-130 per side
      return {
        home: 80 + Math.floor(rng() * 50),
        away: 80 + Math.floor(rng() * 50),
      };

    case 'tennis': // Tennis: sets 0-3 per side
      return {
        home: Math.floor(rng() * 2) + 1,
        away: Math.floor(rng() * 2) + (rng() > 0.5 ? 1 : 0),
      };

    case 'ice-hockey': // Hockey: 0-7 goals per side
      return {
        home: Math.floor(rng() * 5),
        away: Math.floor(rng() * 5),
      };

    case 'baseball': // Baseball: 0-12 runs per side
      return {
        home: Math.floor(rng() * 8),
        away: Math.floor(rng() * 8),
      };

    case 'american-football': // NFL: 0-45 points, typically multiples of 7 or 3
      return {
        home: Math.floor(rng() * 6) * 7 + Math.floor(rng() * 3) * 3,
        away: Math.floor(rng() * 6) * 7 + Math.floor(rng() * 3) * 3,
      };

    case 'cricket': // Cricket: 100-350 runs
      return {
        home: 100 + Math.floor(rng() * 250),
        away: 100 + Math.floor(rng() * 250),
      };

    case 'volleyball': // Volleyball: sets 0-3
      return {
        home: Math.floor(rng() * 2) + 1,
        away: Math.floor(rng() * 2) + (rng() > 0.5 ? 1 : 0),
      };

    case 'handball': // Handball: 20-40 goals per side
      return {
        home: 20 + Math.floor(rng() * 15),
        away: 20 + Math.floor(rng() * 15),
      };

    case 'table-tennis': // Table Tennis: sets 0-4
      return {
        home: Math.floor(rng() * 3) + 1,
        away: Math.floor(rng() * 3) + (rng() > 0.5 ? 1 : 0),
      };

    case 'mma':
    case 'boxing': // Combat sports: round wins or 1/0 (KO or decision)
      return {
        home: rng() > 0.5 ? 1 : 0,
        away: rng() > 0.5 ? 1 : 0,
      };

    case 'esports': // Esports: maps/rounds 0-3
      return {
        home: Math.floor(rng() * 3) + (rng() > 0.4 ? 1 : 0),
        away: Math.floor(rng() * 3) + (rng() > 0.4 ? 1 : 0),
      };

    default: // Default: simple 0-3 per side
      return {
        home: Math.floor(rng() * 4),
        away: Math.floor(rng() * 4),
      };
  }
}
