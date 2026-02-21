// =============================================================================
// Stale Event Detection & Settlement Service
//
// Finds events that started hours/days ago but are still UPCOMING or LIVE,
// marks them as ENDED, generates random scores, and triggers auto-settlement.
//
// Designed to run periodically (every 5 minutes) to catch any events that
// the Cloudbet sync missed or that never transitioned to ENDED.
// =============================================================================

import { prisma } from '../lib/prisma.js';
import { betSettlementQueue } from '../queues/index.js';
import { logger } from '../middleware/logger.js';
import { generateRandomScores } from './auto-settlement.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Events older than this many hours past their startTime are considered stale */
const STALE_THRESHOLD_HOURS = 3;

/** Maximum events to process per run to avoid overloading the queue */
const MAX_EVENTS_PER_RUN = 100;

// ---------------------------------------------------------------------------
// Main Functions
// ---------------------------------------------------------------------------

/**
 * Finds all stale events (startTime > 3 hours ago AND status still UPCOMING or LIVE),
 * marks them as ENDED with random realistic scores, and enqueues settlement jobs.
 *
 * Returns a summary of what was processed.
 */
export async function settleStaleEvents(): Promise<{
  eventsFound: number;
  eventsProcessed: number;
  errors: number;
}> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);

  logger.info(
    { cutoff: cutoff.toISOString(), thresholdHours: STALE_THRESHOLD_HOURS },
    '[StaleSettlement] Scanning for stale events...',
  );

  // Find events that should have ended by now
  const staleEvents = await prisma.event.findMany({
    where: {
      startTime: { lt: cutoff },
      status: { in: ['UPCOMING', 'LIVE'] },
    },
    select: {
      id: true,
      name: true,
      status: true,
      startTime: true,
      scores: true,
      competition: {
        select: {
          sport: { select: { slug: true } },
        },
      },
    },
    take: MAX_EVENTS_PER_RUN,
    orderBy: { startTime: 'asc' }, // Process oldest first
  });

  if (staleEvents.length === 0) {
    logger.debug('[StaleSettlement] No stale events found');
    return { eventsFound: 0, eventsProcessed: 0, errors: 0 };
  }

  logger.info(
    { count: staleEvents.length },
    '[StaleSettlement] Found stale events to process',
  );

  let processed = 0;
  let errors = 0;

  for (const event of staleEvents) {
    try {
      const sportSlug = event.competition?.sport?.slug || 'football';

      // Generate random scores if not already present
      const existingScores = event.scores as { home: number; away: number } | null;
      const scores = (existingScores && existingScores.home !== undefined && existingScores.away !== undefined)
        ? existingScores
        : generateRandomScores(sportSlug);

      // Update event to ENDED with scores
      await prisma.event.update({
        where: { id: event.id },
        data: {
          status: 'ENDED',
          isLive: false,
          scores: scores as any,
        },
      });

      // Enqueue settlement job
      await betSettlementQueue.add(
        'auto-settle-event',
        {
          eventId: event.id,
          eventName: event.name,
          score: scores,
          source: 'stale-event-cron',
        },
        {
          // Use event ID as job ID to prevent duplicate settlement jobs
          jobId: `stale-settle-${event.id}-${Date.now()}`,
        },
      );

      logger.info(
        {
          eventId: event.id,
          eventName: event.name,
          previousStatus: event.status,
          scores,
          sportSlug,
        },
        '[StaleSettlement] Event marked ENDED and settlement queued',
      );

      processed++;
    } catch (err) {
      errors++;
      logger.error(
        { eventId: event.id, eventName: event.name, err },
        '[StaleSettlement] Failed to process stale event',
      );
    }
  }

  logger.info(
    { eventsFound: staleEvents.length, eventsProcessed: processed, errors },
    '[StaleSettlement] Stale event scan complete',
  );

  return {
    eventsFound: staleEvents.length,
    eventsProcessed: processed,
    errors,
  };
}

/**
 * Runs settlement on all ENDED events that still have unsettled bets
 * (i.e., events with OPEN markets or bets in PENDING/PARTIALLY_SETTLED status).
 *
 * Used by the admin manual settlement endpoint.
 */
export async function settleAllEndedEvents(): Promise<{
  eventsFound: number;
  eventsProcessed: number;
  errors: number;
}> {
  // Find ENDED events that have at least one OPEN market (unsettled)
  const endedUnsettled = await prisma.event.findMany({
    where: {
      status: 'ENDED',
      markets: {
        some: {
          status: 'OPEN',
        },
      },
    },
    select: {
      id: true,
      name: true,
      scores: true,
      competition: {
        select: {
          sport: { select: { slug: true } },
        },
      },
    },
    take: MAX_EVENTS_PER_RUN,
  });

  if (endedUnsettled.length === 0) {
    logger.info('[StaleSettlement] No ENDED events with unsettled markets found');
    return { eventsFound: 0, eventsProcessed: 0, errors: 0 };
  }

  logger.info(
    { count: endedUnsettled.length },
    '[StaleSettlement] Found ENDED events with unsettled markets',
  );

  let processed = 0;
  let errors = 0;

  for (const event of endedUnsettled) {
    try {
      const sportSlug = event.competition?.sport?.slug || 'football';
      const existingScores = event.scores as { home: number; away: number } | null;
      const scores = (existingScores && existingScores.home !== undefined && existingScores.away !== undefined)
        ? existingScores
        : generateRandomScores(sportSlug);

      // Make sure scores are written
      if (!existingScores || existingScores.home === undefined) {
        await prisma.event.update({
          where: { id: event.id },
          data: { scores: scores as any },
        });
      }

      await betSettlementQueue.add(
        'auto-settle-event',
        {
          eventId: event.id,
          eventName: event.name,
          score: scores,
          source: 'admin-manual-run',
        },
        {
          jobId: `manual-settle-${event.id}-${Date.now()}`,
        },
      );

      processed++;
    } catch (err) {
      errors++;
      logger.error(
        { eventId: event.id, err },
        '[StaleSettlement] Failed to enqueue settlement for ENDED event',
      );
    }
  }

  return {
    eventsFound: endedUnsettled.length,
    eventsProcessed: processed,
    errors,
  };
}

/**
 * Forces a specific event to ENDED status with provided or generated scores,
 * then triggers settlement.
 */
export async function forceEndEvent(
  eventId: string,
  providedScore?: { home: number; away: number },
): Promise<{
  eventId: string;
  eventName: string;
  scores: { home: number; away: number };
  settlementQueued: boolean;
}> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      scores: true,
      status: true,
      competition: {
        select: {
          sport: { select: { slug: true } },
        },
      },
    },
  });

  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  const sportSlug = event.competition?.sport?.slug || 'football';

  // Use provided scores, existing scores, or generate random ones
  let scores: { home: number; away: number };
  if (providedScore && typeof providedScore.home === 'number' && typeof providedScore.away === 'number') {
    scores = providedScore;
  } else {
    const existingScores = event.scores as { home: number; away: number } | null;
    scores = (existingScores && existingScores.home !== undefined && existingScores.away !== undefined)
      ? existingScores
      : generateRandomScores(sportSlug);
  }

  // Update event to ENDED
  await prisma.event.update({
    where: { id: eventId },
    data: {
      status: 'ENDED',
      isLive: false,
      scores: scores as any,
    },
  });

  // Enqueue settlement
  await betSettlementQueue.add(
    'auto-settle-event',
    {
      eventId: event.id,
      eventName: event.name,
      score: scores,
      source: 'admin-force-end',
    },
    {
      jobId: `force-end-${event.id}-${Date.now()}`,
    },
  );

  logger.info(
    { eventId, eventName: event.name, previousStatus: event.status, scores },
    '[StaleSettlement] Event force-ended and settlement queued',
  );

  return {
    eventId: event.id,
    eventName: event.name,
    scores,
    settlementQueued: true,
  };
}

// ---------------------------------------------------------------------------
// Periodic Runner
// ---------------------------------------------------------------------------

let staleCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts periodic stale event detection every 5 minutes.
 * Runs immediately on first call, then every 5 minutes.
 */
export function startStaleEventSettlement(): void {
  if (staleCheckInterval) {
    logger.info('[StaleSettlement] Stale event check already running');
    return;
  }

  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  logger.info('[StaleSettlement] Starting periodic stale event check (every 5 minutes)');

  // Run immediately
  void settleStaleEvents().catch((err) => {
    logger.error({ err }, '[StaleSettlement] Initial stale event check failed');
  });

  // Then run every 5 minutes
  staleCheckInterval = setInterval(() => {
    void settleStaleEvents().catch((err) => {
      logger.error({ err }, '[StaleSettlement] Periodic stale event check failed');
    });
  }, INTERVAL_MS);
}

/**
 * Stops the periodic stale event detection.
 */
export function stopStaleEventSettlement(): void {
  if (staleCheckInterval) {
    clearInterval(staleCheckInterval);
    staleCheckInterval = null;
    logger.info('[StaleSettlement] Stopped periodic stale event check');
  }
}
