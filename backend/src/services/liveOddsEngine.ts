// =============================================================================
// Live Odds Recalculation Engine v2
// Uses Poisson distribution for football/hockey/handball (sports with draws)
// Uses score-margin model for basketball/volleyball (no draws)
// Recalculates moneyline odds based on current score + elapsed time
//
// KEY DESIGN: Uses fixed average lambdas per sport (not derived from odds)
// The current score + elapsed time naturally produces correct live odds
// =============================================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../middleware/logger.js';

// ---------------------------------------------------------------------------
// Math Helpers
// ---------------------------------------------------------------------------

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k > 15) return 0; // negligible
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

// ---------------------------------------------------------------------------
// Sport Configs — fixed average parameters (no feedback loops)
// ---------------------------------------------------------------------------

interface OddsConfig {
  totalTime: number;          // total match time in minutes
  hasDraws: boolean;
  avgLambdaHome: number;      // avg scoring units for home team per match
  avgLambdaAway: number;      // avg scoring units for away team per match
  model: 'poisson' | 'margin';
  liveMargin: number;         // house edge for live odds (e.g., 1.06 = 6%)
  scoreStdPerMin: number;     // for margin model: std dev of score per minute
}

const ODDS_CONFIGS: Record<string, OddsConfig> = {
  football: {
    totalTime: 95,     // including stoppage time
    hasDraws: true,
    avgLambdaHome: 1.37,
    avgLambdaAway: 1.13,
    model: 'poisson',
    liveMargin: 1.06,
    scoreStdPerMin: 0,
  },
  'ice-hockey': {
    totalTime: 60,
    hasDraws: true,
    avgLambdaHome: 2.9,
    avgLambdaAway: 2.6,
    model: 'poisson',
    liveMargin: 1.06,
    scoreStdPerMin: 0,
  },
  handball: {
    totalTime: 60,
    hasDraws: true,
    avgLambdaHome: 27,
    avgLambdaAway: 25,
    model: 'poisson',
    liveMargin: 1.06,
    scoreStdPerMin: 0,
  },
  rugby: {
    totalTime: 80,
    hasDraws: true,
    avgLambdaHome: 22,
    avgLambdaAway: 20,
    model: 'poisson',
    liveMargin: 1.06,
    scoreStdPerMin: 0,
  },
  basketball: {
    totalTime: 48,
    hasDraws: false,
    avgLambdaHome: 110,
    avgLambdaAway: 105,
    model: 'margin',
    liveMargin: 1.06,
    scoreStdPerMin: 1.8,  // ~1.8 points std per minute in basketball
  },
  'american-football': {
    totalTime: 60,
    hasDraws: false,
    avgLambdaHome: 24,
    avgLambdaAway: 21,
    model: 'margin',
    liveMargin: 1.06,
    scoreStdPerMin: 0.7,
  },
  volleyball: {
    totalTime: 100,
    hasDraws: false,
    avgLambdaHome: 2.6,
    avgLambdaAway: 2.4,
    model: 'margin',
    liveMargin: 1.06,
    scoreStdPerMin: 0.08,
  },
  baseball: {
    totalTime: 54,
    hasDraws: false,
    avgLambdaHome: 4.5,
    avgLambdaAway: 4.0,
    model: 'margin',
    liveMargin: 1.06,
    scoreStdPerMin: 0.4,
  },
  // --- eSoccer / Virtual Sports ---
  'esoccer-short': {
    totalTime: 7,       // Volta 6 mins + buffer
    hasDraws: true,
    avgLambdaHome: 2.5, // Higher scoring rate per minute than real football
    avgLambdaAway: 2.0,
    model: 'poisson',
    liveMargin: 1.08,
    scoreStdPerMin: 0,
  },
  'esoccer-medium': {
    totalTime: 9,       // 8 mins + buffer
    hasDraws: true,
    avgLambdaHome: 3.0,
    avgLambdaAway: 2.5,
    model: 'poisson',
    liveMargin: 1.08,
    scoreStdPerMin: 0,
  },
  'esoccer-long': {
    totalTime: 14,      // 10-12 mins + buffer
    hasDraws: true,
    avgLambdaHome: 4.0,
    avgLambdaAway: 3.5,
    model: 'poisson',
    liveMargin: 1.08,
    scoreStdPerMin: 0,
  },
  ebasketball: {
    totalTime: 20,
    hasDraws: false,
    avgLambdaHome: 50,
    avgLambdaAway: 45,
    model: 'margin',
    liveMargin: 1.08,
    scoreStdPerMin: 1.5,
  },
};

// ---------------------------------------------------------------------------
// Get Elapsed Minutes from Metadata
// ---------------------------------------------------------------------------

function getElapsedMinutes(metadata: Record<string, unknown> | null, sportSlug: string, config: OddsConfig): number | null {
  if (!metadata) return null;

  // Football stores elapsed directly from the API
  if (typeof metadata.elapsed === 'number' && metadata.elapsed > 0) {
    return Math.min(metadata.elapsed, config.totalTime - 1);
  }

  const statusShort = (metadata.statusShort as string) || '';

  // Basketball: Q1→6, Q2→18, Q3→30, Q4→42 (midpoint of each quarter)
  if (sportSlug === 'basketball') {
    const map: Record<string, number> = { Q1: 6, Q2: 18, HT: 24, Q3: 30, Q4: 42, OT: 48, BT: 24 };
    return map[statusShort] ?? null;
  }

  // Hockey: P1→10, P2→30, P3→50
  if (sportSlug === 'ice-hockey') {
    const map: Record<string, number> = { P1: 10, BT: 20, P2: 30, P3: 50, OT: 60 };
    return map[statusShort] ?? null;
  }

  // Handball: 1H→15, HT→30, 2H→45
  if (sportSlug === 'handball') {
    const map: Record<string, number> = { '1H': 15, HT: 30, '2H': 45 };
    return map[statusShort] ?? null;
  }

  // eSoccer: elapsed is stored directly from BetsAPI, just use it
  if (sportSlug.startsWith('esoccer') || sportSlug === 'ebasketball') {
    if (typeof metadata.elapsed === 'string') {
      const mins = parseInt(metadata.elapsed, 10);
      if (!isNaN(mins) && mins > 0) return Math.min(mins, config.totalTime - 1);
    }
    return Math.floor(config.totalTime * 0.5); // Default to midpoint
  }

  // Football fallback (when elapsed is null but status is known)
  if (sportSlug === 'football') {
    const map: Record<string, number> = { '1H': 25, HT: 45, '2H': 70, ET: 95 };
    return map[statusShort] ?? null;
  }

  // Rugby
  if (sportSlug === 'rugby') {
    const map: Record<string, number> = { '1H': 20, HT: 40, '2H': 60 };
    return map[statusShort] ?? null;
  }

  // Volleyball sets
  if (sportSlug === 'volleyball') {
    const map: Record<string, number> = { S1: 15, S2: 35, S3: 55, S4: 75, S5: 90 };
    return map[statusShort] ?? null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Poisson Model (Football, Hockey, Handball, Rugby)
// Calculate P(homeWin), P(draw), P(awayWin) for remaining match
// ---------------------------------------------------------------------------

function calculatePoissonLiveOdds(
  currentHome: number,
  currentAway: number,
  elapsed: number,
  config: OddsConfig,
): { homeWin: number; draw: number; awayWin: number } {
  const timeRemaining = Math.max(1, config.totalTime - elapsed);
  const timeRatio = timeRemaining / config.totalTime;

  // Expected additional goals for remaining time
  const remLambdaHome = config.avgLambdaHome * timeRatio;
  const remLambdaAway = config.avgLambdaAway * timeRatio;

  let homeWinProb = 0;
  let drawProb = 0;
  let awayWinProb = 0;

  // Max additional goals to consider (for Poisson convergence)
  const maxAdd = config.avgLambdaHome > 10 ? 15 : 8;

  for (let addH = 0; addH <= maxAdd; addH++) {
    const pH = poissonPMF(addH, remLambdaHome);
    if (pH < 1e-8) break;

    for (let addA = 0; addA <= maxAdd; addA++) {
      const pA = poissonPMF(addA, remLambdaAway);
      if (pA < 1e-8) break;

      const prob = pH * pA;
      const finalH = currentHome + addH;
      const finalA = currentAway + addA;

      if (finalH > finalA) homeWinProb += prob;
      else if (finalH === finalA) drawProb += prob;
      else awayWinProb += prob;
    }
  }

  // Normalize
  const total = homeWinProb + drawProb + awayWinProb;
  if (total > 0) {
    homeWinProb /= total;
    drawProb /= total;
    awayWinProb /= total;
  } else {
    // Fallback
    homeWinProb = 0.4;
    drawProb = 0.2;
    awayWinProb = 0.4;
  }

  return { homeWin: homeWinProb, draw: drawProb, awayWin: awayWinProb };
}

// ---------------------------------------------------------------------------
// Score-Margin Model (Basketball, Am. Football, Volleyball)
// ---------------------------------------------------------------------------

function calculateMarginLiveOdds(
  currentHome: number,
  currentAway: number,
  elapsed: number,
  config: OddsConfig,
): { homeWin: number; draw: number; awayWin: number } {
  const timeRemaining = Math.max(0.5, config.totalTime - elapsed);
  const timeRatio = timeRemaining / config.totalTime;

  const currentMargin = currentHome - currentAway;

  // Expected scoring rate (points per minute)
  const homeRate = config.avgLambdaHome / config.totalTime;
  const awayRate = config.avgLambdaAway / config.totalTime;

  // Expected additional margin from remaining time
  const expectedAddMargin = (homeRate - awayRate) * timeRemaining;
  const expectedFinalMargin = currentMargin + expectedAddMargin;

  // Standard deviation of the final margin
  const totalStd = config.scoreStdPerMin * Math.sqrt(timeRemaining);

  if (totalStd <= 0.01) {
    // Game essentially over
    if (currentMargin > 0) return { homeWin: 0.99, draw: 0, awayWin: 0.01 };
    if (currentMargin < 0) return { homeWin: 0.01, draw: 0, awayWin: 0.99 };
    return { homeWin: 0.50, draw: 0, awayWin: 0.50 };
  }

  // P(home wins) = P(finalMargin > 0) using normal CDF
  const homeWin = Math.max(0.005, Math.min(0.995, normalCDF(expectedFinalMargin / totalStd)));
  const awayWin = 1 - homeWin;

  return { homeWin, draw: 0, awayWin };
}

// ---------------------------------------------------------------------------
// Convert Probability to Decimal Odds with Margin
// ---------------------------------------------------------------------------

function probToOdds(prob: number, margin: number): number {
  if (prob <= 0.01) return 31.00;
  if (prob >= 0.98) return 1.02;
  const raw = margin / prob;
  return Math.round(Math.max(1.02, Math.min(31.0, raw)) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main: Recalculate Live Odds for a Single Event
// ---------------------------------------------------------------------------

export async function recalculateLiveOdds(
  eventId: string,
  currentHomeScore: number,
  currentAwayScore: number,
  sportSlug: string,
  metadata: Record<string, unknown> | null,
): Promise<{ updated: boolean; newOdds?: Record<string, number> }> {
  const config = ODDS_CONFIGS[sportSlug];
  if (!config) return { updated: false };

  try {
    // Get elapsed time
    const elapsed = getElapsedMinutes(metadata, sportSlug, config);
    if (elapsed === null) return { updated: false };

    // Calculate probabilities
    let probs: { homeWin: number; draw: number; awayWin: number };
    if (config.model === 'poisson') {
      probs = calculatePoissonLiveOdds(currentHomeScore, currentAwayScore, elapsed, config);
    } else {
      probs = calculateMarginLiveOdds(currentHomeScore, currentAwayScore, elapsed, config);
    }

    // Convert to odds
    const newHomeOdds = probToOdds(probs.homeWin, config.liveMargin);
    const newDrawOdds = config.hasDraws ? probToOdds(probs.draw, config.liveMargin) : null;
    const newAwayOdds = probToOdds(probs.awayWin, config.liveMargin);

    // Find ANY existing MONEYLINE market (OPEN or SETTLED — we'll reopen if needed)
    let market = await prisma.market.findFirst({
      where: { eventId, type: 'MONEYLINE' },
      include: { selections: { orderBy: { name: 'asc' } } },
    });

    // If market was previously settled (shouldn't happen on LIVE events, but recover gracefully),
    // reopen it and reset all selections to ACTIVE
    if (market && market.status !== 'OPEN') {
      await prisma.market.update({
        where: { id: market.id },
        data: { status: 'OPEN' },
      });
      await prisma.selection.updateMany({
        where: { marketId: market.id, status: { not: 'ACTIVE' } },
        data: { status: 'ACTIVE', result: null },
      });
      // Reload with fresh selection statuses
      market = await prisma.market.findFirst({
        where: { id: market.id },
        include: { selections: { orderBy: { name: 'asc' } } },
      });
    }

    // If no market exists at all, create one with selections
    if (!market) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { homeTeam: true, awayTeam: true },
      });
      if (!event) return { updated: false };

      const selections: Array<{ name: string; outcome: string; odds: any }> = [
        { name: event.homeTeam, outcome: 'HOME', odds: new Prisma.Decimal(newHomeOdds) },
        { name: event.awayTeam, outcome: 'AWAY', odds: new Prisma.Decimal(newAwayOdds) },
      ];
      if (config.hasDraws && newDrawOdds !== null) {
        selections.push({ name: 'Draw', outcome: 'DRAW', odds: new Prisma.Decimal(newDrawOdds) });
      }

      market = await prisma.market.create({
        data: {
          eventId,
          name: 'Match Winner',
          marketKey: `moneyline_${eventId}`,
          type: 'MONEYLINE',
          status: 'OPEN',
          selections: {
            create: selections.map((s) => ({
              name: s.name,
              outcome: s.outcome,
              odds: s.odds,
              status: 'ACTIVE',
            })),
          },
        },
        include: { selections: { orderBy: { name: 'asc' } } },
      });
    }

    // Filter to only ACTIVE selections for updating
    const activeSelections = market.selections.filter((s) => s.status === 'ACTIVE');
    if (activeSelections.length < 2) return { updated: false };

    // Update each selection's odds
    for (const sel of activeSelections) {
      let newOdds: number;
      if (sel.outcome === 'HOME') newOdds = newHomeOdds;
      else if (sel.outcome === 'AWAY') newOdds = newAwayOdds;
      else if (sel.outcome === 'DRAW' && newDrawOdds !== null) newOdds = newDrawOdds;
      else continue;

      await prisma.selection.update({
        where: { id: sel.id },
        data: { odds: new Prisma.Decimal(newOdds) },
      });
    }

    const result: Record<string, number> = { home: newHomeOdds, away: newAwayOdds };
    if (newDrawOdds !== null) result.draw = newDrawOdds;

    logger.info({
      eventId: eventId.slice(0, 12),
      sport: sportSlug,
      score: `${currentHomeScore}-${currentAwayScore}`,
      elapsed,
      probs: {
        home: Math.round(probs.homeWin * 1000) / 10,
        draw: Math.round(probs.draw * 1000) / 10,
        away: Math.round(probs.awayWin * 1000) / 10,
      },
      odds: result,
    }, 'Odds recalculated');

    return { updated: true, newOdds: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ eventId: eventId.slice(0, 12), error: msg }, 'Odds recalc failed');
    return { updated: false };
  }
}

// ---------------------------------------------------------------------------
// Batch: Recalculate odds for ALL live events
// ---------------------------------------------------------------------------

export async function recalculateAllLiveOdds(): Promise<number> {
  let updated = 0;

  try {
    const liveEvents = await prisma.event.findMany({
      where: { status: 'LIVE', isLive: true },
      select: {
        id: true,
        scores: true,
        metadata: true,
        competition: {
          select: { sport: { select: { slug: true } } },
        },
      },
    });

    logger.info({ count: liveEvents.length }, 'Recalculating odds for all live events');

    for (const event of liveEvents) {
      const scores = event.scores as Record<string, number> | null;
      const metadata = event.metadata as Record<string, unknown> | null;
      const sportSlug = event.competition.sport.slug;

      const homeScore = scores?.home ?? 0;
      const awayScore = scores?.away ?? 0;

      const result = await recalculateLiveOdds(event.id, homeScore, awayScore, sportSlug, metadata);
      if (result.updated) updated++;
    }

    logger.info({ updated, total: liveEvents.length }, 'Live odds recalculation complete');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ error: msg }, 'Batch odds recalculation failed');
  }

  return updated;
}
