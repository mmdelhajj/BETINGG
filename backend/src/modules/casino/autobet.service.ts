import { redis } from '../../lib/redis.js';
import { type GameResult, type BetRequest } from '../../services/casino/BaseGame.js';

// Import all non-stateful game instances
import { wheelGame } from './games/wheel/wheel.service.js';
import { limboGame } from './games/limbo/limbo.service.js';
import { kenoGame } from './games/keno/keno.service.js';
import { baccaratGame } from './games/baccarat/baccarat.service.js';
import { slotsGame } from './games/slots/slots.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnAction = 'reset' | 'increase';

interface AutoBetConfig {
  betAmount: number;
  currency: string;
  numberOfBets: number;
  stopOnProfit?: number;       // Stop if total profit exceeds this
  stopOnLoss?: number;         // Stop if total loss exceeds this (positive number)
  onWinAction: OnAction;
  onWinPercent?: number;       // Percent to increase on win (e.g. 50 = 50%)
  onLossAction: OnAction | 'martingale';
  onLossPercent?: number;      // Percent to increase on loss
  delayMs?: number;            // Delay between bets in ms (min 100)
  gameOptions?: Record<string, unknown>; // Game-specific options (passed every round)
}

interface AutoBetSession {
  userId: string;
  gameSlug: string;
  config: AutoBetConfig;
  status: 'running' | 'stopped' | 'completed' | 'error';
  betsCompleted: number;
  totalWagered: number;
  totalPayout: number;
  totalProfit: number;
  currentBetAmount: number;
  baseBetAmount: number;
  wins: number;
  losses: number;
  results: AutoBetRoundSummary[];
  startedAt: string;
  stoppedAt?: string;
  stopReason?: string;
  lastError?: string;
}

interface AutoBetRoundSummary {
  roundIndex: number;
  roundId: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  isWin: boolean;
  runningProfit: number;
}

interface AutoBetStatus {
  isActive: boolean;
  session: AutoBetSession | null;
}

// ---------------------------------------------------------------------------
// Game registry - non-stateful games that support auto-bet
// ---------------------------------------------------------------------------

const SUPPORTED_GAMES: Record<string, { play: (userId: string, bet: BetRequest) => Promise<GameResult> }> = {
  'wheel': wheelGame,
  'limbo': limboGame,
  'keno': kenoGame,
  'baccarat': baccaratGame,
  'slots': slotsGame,
};

// Games that will be added when their modules are loaded
// dice, coinflip, plinko are also non-stateful but imported dynamically to avoid circular deps

const REDIS_KEY_PREFIX = 'autobet:session:';
const REDIS_STOP_KEY_PREFIX = 'autobet:stop:';
const REDIS_TTL = 7200; // 2 hours
const MIN_DELAY_MS = 100;
const MAX_DELAY_MS = 5000;
const MAX_BETS = 10000;

// ---------------------------------------------------------------------------
// AutoBetService
// ---------------------------------------------------------------------------

export class AutoBetService {
  /**
   * Register additional games for auto-bet support.
   */
  registerGame(slug: string, game: { play: (userId: string, bet: BetRequest) => Promise<GameResult> }): void {
    SUPPORTED_GAMES[slug] = game;
  }

  /**
   * Start an auto-bet session.
   * Runs bets sequentially with configurable delay.
   * Returns immediately; bets run asynchronously.
   */
  async start(
    userId: string,
    gameSlug: string,
    config: AutoBetConfig,
  ): Promise<{ sessionId: string; message: string }> {
    // Validate game
    const game = SUPPORTED_GAMES[gameSlug];
    if (!game) {
      throw new Error(`Game "${gameSlug}" is not supported for auto-bet. Supported: ${Object.keys(SUPPORTED_GAMES).join(', ')}`);
    }

    // Check for existing session
    const existingKey = REDIS_KEY_PREFIX + `${userId}:${gameSlug}`;
    const existing = await redis.get(existingKey);
    if (existing) {
      const session: AutoBetSession = JSON.parse(existing);
      if (session.status === 'running') {
        throw new Error('An auto-bet session is already running for this game.');
      }
    }

    // Validate config
    if (config.betAmount <= 0) {
      throw new Error('Bet amount must be greater than zero.');
    }
    if (config.numberOfBets <= 0 || config.numberOfBets > MAX_BETS) {
      throw new Error(`Number of bets must be between 1 and ${MAX_BETS}.`);
    }
    if (config.stopOnProfit !== undefined && config.stopOnProfit <= 0) {
      throw new Error('stopOnProfit must be positive.');
    }
    if (config.stopOnLoss !== undefined && config.stopOnLoss <= 0) {
      throw new Error('stopOnLoss must be positive.');
    }

    const delayMs = Math.max(MIN_DELAY_MS, Math.min(config.delayMs ?? 200, MAX_DELAY_MS));

    // Initialize session
    const session: AutoBetSession = {
      userId,
      gameSlug,
      config: { ...config, delayMs },
      status: 'running',
      betsCompleted: 0,
      totalWagered: 0,
      totalPayout: 0,
      totalProfit: 0,
      currentBetAmount: config.betAmount,
      baseBetAmount: config.betAmount,
      wins: 0,
      losses: 0,
      results: [],
      startedAt: new Date().toISOString(),
    };

    const sessionKey = existingKey;
    await redis.set(sessionKey, JSON.stringify(session), 'EX', REDIS_TTL);

    // Clear any stop signal
    await redis.del(REDIS_STOP_KEY_PREFIX + `${userId}:${gameSlug}`);

    // Run the auto-bet loop asynchronously
    this.runLoop(userId, gameSlug, sessionKey, game, delayMs).catch((err) => {
      console.error(`[AutoBet] Fatal error for ${userId}:${gameSlug}:`, err);
    });

    return {
      sessionId: `${userId}:${gameSlug}`,
      message: `Auto-bet started: ${config.numberOfBets} bets on ${gameSlug}`,
    };
  }

  /**
   * Stop an active auto-bet session.
   */
  async stop(userId: string, gameSlug: string): Promise<{ message: string }> {
    const sessionKey = REDIS_KEY_PREFIX + `${userId}:${gameSlug}`;
    const raw = await redis.get(sessionKey);

    if (!raw) {
      throw new Error('No auto-bet session found for this game.');
    }

    const session: AutoBetSession = JSON.parse(raw);
    if (session.status !== 'running') {
      throw new Error(`Auto-bet session is not running (status: ${session.status}).`);
    }

    // Signal stop
    await redis.set(REDIS_STOP_KEY_PREFIX + `${userId}:${gameSlug}`, '1', 'EX', 60);

    return { message: 'Stop signal sent. Auto-bet will stop after current bet completes.' };
  }

  /**
   * Get the current auto-bet status for a user and game.
   */
  async getStatus(userId: string, gameSlug: string): Promise<AutoBetStatus> {
    const sessionKey = REDIS_KEY_PREFIX + `${userId}:${gameSlug}`;
    const raw = await redis.get(sessionKey);

    if (!raw) {
      return { isActive: false, session: null };
    }

    const session: AutoBetSession = JSON.parse(raw);
    return {
      isActive: session.status === 'running',
      session,
    };
  }

  /**
   * Get all active auto-bet sessions for a user.
   */
  async getAllSessions(userId: string): Promise<AutoBetSession[]> {
    const sessions: AutoBetSession[] = [];

    for (const slug of Object.keys(SUPPORTED_GAMES)) {
      const key = REDIS_KEY_PREFIX + `${userId}:${slug}`;
      const raw = await redis.get(key);
      if (raw) {
        sessions.push(JSON.parse(raw));
      }
    }

    return sessions;
  }

  // -------------------------------------------------------------------------
  // Internal: auto-bet loop
  // -------------------------------------------------------------------------

  private async runLoop(
    userId: string,
    gameSlug: string,
    sessionKey: string,
    game: { play: (userId: string, bet: BetRequest) => Promise<GameResult> },
    delayMs: number,
  ): Promise<void> {
    let session: AutoBetSession;

    const loadSession = async (): Promise<AutoBetSession | null> => {
      const raw = await redis.get(sessionKey);
      if (!raw) return null;
      return JSON.parse(raw);
    };

    const saveSession = async (s: AutoBetSession): Promise<void> => {
      await redis.set(sessionKey, JSON.stringify(s), 'EX', REDIS_TTL);
    };

    const shouldStop = async (): Promise<string | null> => {
      // Check stop signal
      const stopSignal = await redis.get(REDIS_STOP_KEY_PREFIX + `${userId}:${gameSlug}`);
      if (stopSignal) return 'User requested stop';

      const s = await loadSession();
      if (!s) return 'Session not found';
      if (s.status !== 'running') return `Session status: ${s.status}`;

      // Check stop conditions
      if (s.betsCompleted >= s.config.numberOfBets) return 'All bets completed';
      if (s.config.stopOnProfit && s.totalProfit >= s.config.stopOnProfit) return `Profit target reached: ${s.totalProfit}`;
      if (s.config.stopOnLoss && s.totalProfit <= -s.config.stopOnLoss) return `Loss limit reached: ${s.totalProfit}`;

      return null;
    };

    try {
      const loaded = await loadSession();
      if (!loaded) return;
      session = loaded;

      for (let i = 0; i < session.config.numberOfBets; i++) {
        // Check stop conditions
        const stopReason = await shouldStop();
        if (stopReason) {
          session = (await loadSession()) ?? session;
          session.status = session.betsCompleted >= session.config.numberOfBets ? 'completed' : 'stopped';
          session.stopReason = stopReason;
          session.stoppedAt = new Date().toISOString();
          await saveSession(session);
          await redis.del(REDIS_STOP_KEY_PREFIX + `${userId}:${gameSlug}`);
          return;
        }

        // Reload session to get current bet amount
        session = (await loadSession()) ?? session;

        try {
          // Place bet
          const betRequest: BetRequest = {
            amount: session.currentBetAmount,
            currency: session.config.currency,
            options: session.config.gameOptions ?? {},
          };

          const result = await game.play(userId, betRequest);

          // Update session
          const isWin = result.payout > result.betAmount;
          session.betsCompleted++;
          session.totalWagered += result.betAmount;
          session.totalPayout += result.payout;
          session.totalProfit += result.profit;

          if (isWin) {
            session.wins++;
          } else {
            session.losses++;
          }

          // Adjust bet amount based on win/loss action
          session.currentBetAmount = this.calculateNextBet(
            session.baseBetAmount,
            session.currentBetAmount,
            isWin,
            session.config,
          );

          // Add round summary (keep last 100)
          const summary: AutoBetRoundSummary = {
            roundIndex: i,
            roundId: result.roundId,
            betAmount: result.betAmount,
            payout: result.payout,
            profit: result.profit,
            multiplier: result.multiplier,
            isWin,
            runningProfit: session.totalProfit,
          };

          session.results.push(summary);
          if (session.results.length > 100) {
            session.results = session.results.slice(-100);
          }

          await saveSession(session);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);

          // If insufficient balance, stop gracefully
          if (errorMsg.includes('Insufficient') || errorMsg.includes('balance')) {
            session.status = 'stopped';
            session.stopReason = 'Insufficient balance';
            session.stoppedAt = new Date().toISOString();
            await saveSession(session);
            return;
          }

          // Other errors: log and stop
          session.status = 'error';
          session.lastError = errorMsg;
          session.stoppedAt = new Date().toISOString();
          await saveSession(session);
          return;
        }

        // Delay between bets
        if (i < session.config.numberOfBets - 1) {
          await this.sleep(delayMs);
        }
      }

      // All bets completed
      session = (await loadSession()) ?? session;
      session.status = 'completed';
      session.stopReason = 'All bets completed';
      session.stoppedAt = new Date().toISOString();
      await saveSession(session);
    } catch (err) {
      console.error(`[AutoBet] Loop error for ${userId}:${gameSlug}:`, err);

      try {
        const s = await loadSession();
        if (s) {
          s.status = 'error';
          s.lastError = err instanceof Error ? err.message : String(err);
          s.stoppedAt = new Date().toISOString();
          await saveSession(s);
        }
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bet amount calculation
  // -------------------------------------------------------------------------

  private calculateNextBet(
    baseBet: number,
    currentBet: number,
    isWin: boolean,
    config: AutoBetConfig,
  ): number {
    if (isWin) {
      switch (config.onWinAction) {
        case 'reset':
          return baseBet;
        case 'increase': {
          const percent = config.onWinPercent ?? 0;
          return currentBet * (1 + percent / 100);
        }
        default:
          return baseBet;
      }
    } else {
      switch (config.onLossAction) {
        case 'reset':
          return baseBet;
        case 'increase': {
          const percent = config.onLossPercent ?? 0;
          return currentBet * (1 + percent / 100);
        }
        case 'martingale':
          // Double the bet on loss
          return currentBet * 2;
        default:
          return baseBet;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const autoBetService = new AutoBetService();
export default autoBetService;
