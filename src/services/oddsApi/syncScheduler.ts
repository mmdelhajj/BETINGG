import { oddsSyncService } from './oddsSync.service';

// ─── Scheduler Configuration ────────────────────────────────────────────────

const SCHEDULE = {
  /** Sync sports list once per day (24 hours) */
  SPORTS_LIST_INTERVAL_MS: 24 * 60 * 60 * 1000,

  /** High-priority sports sync interval (default 15 min) */
  HIGH_PRIORITY_INTERVAL_MS: () => {
    const minutes = parseInt(process.env.ODDS_API_SYNC_INTERVAL_MINUTES || '15', 10);
    return minutes * 60 * 1000;
  },

  /** Medium-priority sports sync interval (30 min) */
  MEDIUM_PRIORITY_INTERVAL_MS: 30 * 60 * 1000,

  /** Low-priority sports sync interval (60 min) */
  LOW_PRIORITY_INTERVAL_MS: 60 * 60 * 1000,

  /** Live scores sync interval (60 seconds) */
  LIVE_SCORES_INTERVAL_MS: 60 * 1000,

  /** Initial delay before first sync (10 seconds) */
  INITIAL_DELAY_MS: 10 * 1000,
} as const;

// ─── Scheduler State ────────────────────────────────────────────────────────

let sportsListTimer: NodeJS.Timeout | null = null;
let highPriorityTimer: NodeJS.Timeout | null = null;
let mediumPriorityTimer: NodeJS.Timeout | null = null;
let lowPriorityTimer: NodeJS.Timeout | null = null;
let liveScoresTimer: NodeJS.Timeout | null = null;
let isRunning = false;

// ─── Scheduler Functions ────────────────────────────────────────────────────

/**
 * Start the odds sync scheduler.
 * Sets up periodic sync jobs for all priority levels.
 */
export function startOddsSyncScheduler(): void {
  if (isRunning) {
    console.warn('[OddsSyncScheduler] Scheduler is already running.');
    return;
  }

  isRunning = true;
  const mockMode = oddsSyncService.isMockMode();

  console.log('[OddsSyncScheduler] Starting odds sync scheduler...');
  console.log(`[OddsSyncScheduler] Mode: ${mockMode ? 'MOCK (no API key)' : 'LIVE'}`);
  console.log(`[OddsSyncScheduler] High-priority interval: ${SCHEDULE.HIGH_PRIORITY_INTERVAL_MS() / 60000} min`);
  console.log(`[OddsSyncScheduler] Medium-priority interval: ${SCHEDULE.MEDIUM_PRIORITY_INTERVAL_MS / 60000} min`);
  console.log(`[OddsSyncScheduler] Low-priority interval: ${SCHEDULE.LOW_PRIORITY_INTERVAL_MS / 60000} min`);
  console.log(`[OddsSyncScheduler] Live scores interval: ${SCHEDULE.LIVE_SCORES_INTERVAL_MS / 1000} sec`);
  console.log(`[OddsSyncScheduler] Sports list interval: ${SCHEDULE.SPORTS_LIST_INTERVAL_MS / 3600000} hours`);

  // Initial sync after a short delay
  setTimeout(async () => {
    await runSportsListSync();
    await runHighPrioritySync();
  }, SCHEDULE.INITIAL_DELAY_MS);

  // Schedule recurring syncs
  sportsListTimer = setInterval(runSportsListSync, SCHEDULE.SPORTS_LIST_INTERVAL_MS);
  highPriorityTimer = setInterval(runHighPrioritySync, SCHEDULE.HIGH_PRIORITY_INTERVAL_MS());
  mediumPriorityTimer = setInterval(runMediumPrioritySync, SCHEDULE.MEDIUM_PRIORITY_INTERVAL_MS);
  lowPriorityTimer = setInterval(runLowPrioritySync, SCHEDULE.LOW_PRIORITY_INTERVAL_MS);
  liveScoresTimer = setInterval(runLiveScoresSync, SCHEDULE.LIVE_SCORES_INTERVAL_MS);
}

/**
 * Stop the odds sync scheduler.
 */
export function stopOddsSyncScheduler(): void {
  if (!isRunning) {
    return;
  }

  console.log('[OddsSyncScheduler] Stopping odds sync scheduler...');

  if (sportsListTimer) clearInterval(sportsListTimer);
  if (highPriorityTimer) clearInterval(highPriorityTimer);
  if (mediumPriorityTimer) clearInterval(mediumPriorityTimer);
  if (lowPriorityTimer) clearInterval(lowPriorityTimer);
  if (liveScoresTimer) clearInterval(liveScoresTimer);

  sportsListTimer = null;
  highPriorityTimer = null;
  mediumPriorityTimer = null;
  lowPriorityTimer = null;
  liveScoresTimer = null;
  isRunning = false;

  console.log('[OddsSyncScheduler] Scheduler stopped.');
}

/**
 * Check if the scheduler is currently running.
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

// ─── Sync Runners ───────────────────────────────────────────────────────────

async function runSportsListSync(): Promise<void> {
  try {
    console.log('[OddsSyncScheduler] Running sports list sync...');
    const result = await oddsSyncService.syncSportsList();
    console.log(`[OddsSyncScheduler] Sports list sync done. Sports: ${result.sportsUpserted}, Competitions: ${result.competitionsUpserted}`);
  } catch (error) {
    console.error('[OddsSyncScheduler] Sports list sync failed:', (error as Error).message);
  }
}

async function runHighPrioritySync(): Promise<void> {
  try {
    // Check credit budget first
    const credits = await oddsSyncService.getCreditUsage();
    if (credits.remaining <= 0 && !oddsSyncService.isMockMode()) {
      console.warn('[OddsSyncScheduler] No credits remaining. Skipping high-priority sync.');
      return;
    }

    console.log('[OddsSyncScheduler] Running high-priority odds sync...');
    const results = await oddsSyncService.syncAllSports('high');
    const totalEvents = results.reduce((sum, r) => sum + r.eventsProcessed, 0);
    const totalCredits = results.reduce((sum, r) => sum + r.creditsUsed, 0);
    console.log(`[OddsSyncScheduler] High-priority sync done. Events: ${totalEvents}, Credits used: ${totalCredits}`);
  } catch (error) {
    console.error('[OddsSyncScheduler] High-priority sync failed:', (error as Error).message);
  }
}

async function runMediumPrioritySync(): Promise<void> {
  try {
    const credits = await oddsSyncService.getCreditUsage();
    if (credits.remaining <= 0 && !oddsSyncService.isMockMode()) {
      console.warn('[OddsSyncScheduler] No credits remaining. Skipping medium-priority sync.');
      return;
    }

    console.log('[OddsSyncScheduler] Running medium-priority odds sync...');
    const results = await oddsSyncService.syncAllSports('medium');
    const totalEvents = results.reduce((sum, r) => sum + r.eventsProcessed, 0);
    const totalCredits = results.reduce((sum, r) => sum + r.creditsUsed, 0);
    console.log(`[OddsSyncScheduler] Medium-priority sync done. Events: ${totalEvents}, Credits used: ${totalCredits}`);
  } catch (error) {
    console.error('[OddsSyncScheduler] Medium-priority sync failed:', (error as Error).message);
  }
}

async function runLowPrioritySync(): Promise<void> {
  try {
    const credits = await oddsSyncService.getCreditUsage();
    if (credits.remaining <= 0 && !oddsSyncService.isMockMode()) {
      console.warn('[OddsSyncScheduler] No credits remaining. Skipping low-priority sync.');
      return;
    }

    console.log('[OddsSyncScheduler] Running low-priority odds sync...');
    const results = await oddsSyncService.syncAllSports('low');
    const totalEvents = results.reduce((sum, r) => sum + r.eventsProcessed, 0);
    const totalCredits = results.reduce((sum, r) => sum + r.creditsUsed, 0);
    console.log(`[OddsSyncScheduler] Low-priority sync done. Events: ${totalEvents}, Credits used: ${totalCredits}`);
  } catch (error) {
    console.error('[OddsSyncScheduler] Low-priority sync failed:', (error as Error).message);
  }
}

async function runLiveScoresSync(): Promise<void> {
  try {
    console.log('[OddsSyncScheduler] Running live scores sync...');
    const result = await oddsSyncService.syncLiveScores();
    console.log(`[OddsSyncScheduler] Live scores sync done. Updated: ${result.eventsUpdated}, Completed: ${result.eventsCompleted}`);
  } catch (error) {
    console.error('[OddsSyncScheduler] Live scores sync failed:', (error as Error).message);
  }
}
