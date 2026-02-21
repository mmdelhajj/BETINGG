// =============================================================================
// Event Status Transition Service
//
// Periodically transitions UPCOMING events to LIVE when their startTime has
// passed. This fills the gap where the Cloudbet API may not report an event
// as TRADING_LIVE even though the event has already started.
//
// Runs every 60 seconds.
// =============================================================================

import { prisma } from '../lib/prisma.js';
import { logger } from '../middleware/logger.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** How often to check for events that should be LIVE (ms) */
const CHECK_INTERVAL_MS = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Main Function
// ---------------------------------------------------------------------------

/**
 * Finds all UPCOMING events whose startTime is in the past and transitions
 * them to LIVE status with isLive = true.
 *
 * This uses a single bulk UPDATE for efficiency rather than loading events
 * into memory one by one.
 *
 * Returns the number of events transitioned.
 */
export async function transitionUpcomingToLive(): Promise<number> {
  try {
    const result = await prisma.$executeRaw`
      UPDATE events
      SET status = 'LIVE', "isLive" = true, "updatedAt" = NOW()
      WHERE status = 'UPCOMING'
        AND "startTime" < NOW()
    `;

    if (result > 0) {
      logger.info(
        { count: result },
        '[EventStatusTransition] Transitioned UPCOMING events to LIVE',
      );
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      { error: msg },
      '[EventStatusTransition] Failed to transition UPCOMING events to LIVE',
    );
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Periodic Runner
// ---------------------------------------------------------------------------

let transitionInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the periodic UPCOMING -> LIVE transition check.
 * Runs immediately on first call, then every 60 seconds.
 */
export function startEventStatusTransition(): void {
  if (transitionInterval) {
    logger.info('[EventStatusTransition] Already running');
    return;
  }

  logger.info(
    `[EventStatusTransition] Starting periodic check (every ${CHECK_INTERVAL_MS / 1000}s)`,
  );

  // Run immediately
  void transitionUpcomingToLive().catch((err) => {
    logger.error({ err }, '[EventStatusTransition] Initial check failed');
  });

  // Then run periodically
  transitionInterval = setInterval(() => {
    void transitionUpcomingToLive().catch((err) => {
      logger.error({ err }, '[EventStatusTransition] Periodic check failed');
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Stops the periodic UPCOMING -> LIVE transition check.
 */
export function stopEventStatusTransition(): void {
  if (transitionInterval) {
    clearInterval(transitionInterval);
    transitionInterval = null;
    logger.info('[EventStatusTransition] Stopped periodic check');
  }
}
