import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../../../lib/prisma.js';
import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';
import { ProvablyFairService } from '../../../../services/casino/ProvablyFairService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CrashPhase = 'WAITING' | 'RUNNING' | 'CRASHED';

interface CrashBetEntry {
  id: string;
  userId: string;
  username: string;
  amount: number;
  currency: string;
  autoCashout: number | null;
  cashoutAt: number | null;
  payout: number | null;
  isActive: boolean;
}

interface CrashState {
  roundId: string;
  phase: CrashPhase;
  crashPoint: number;
  currentMultiplier: number;
  startedAt: number | null;      // epoch ms
  bets: CrashBetEntry[];
  serverSeedHash: string;
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Crash Game Service (Multiplayer, Socket.IO driven)
// ---------------------------------------------------------------------------

export class CrashGameService extends BaseGame {
  readonly name = 'Crash';
  readonly slug = 'crash';
  readonly houseEdge = 0.03;
  readonly minBet = 0.1;
  readonly maxBet = 10000;

  private state: CrashState | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private countdownTimeout: ReturnType<typeof setTimeout> | null = null;
  private broadcastFn: ((event: string, data: any) => void) | null = null;

  private fairService2 = new ProvablyFairService();

  // We use a house seed pair for the crash round (multiplayer, not per-user)
  private static HOUSE_CLIENT_SEED = 'cryptobet-crash-global';

  /**
   * Not used directly for Crash (multiplayer), but required by BaseGame.
   */
  async play(_userId: string, _bet: BetRequest): Promise<GameResult> {
    throw new GameError('NOT_SUPPORTED', 'Use placeBet/cashout for Crash game.');
  }

  /**
   * Register the Socket.IO broadcast function for the /casino namespace.
   */
  setBroadcast(fn: (event: string, data: any) => void): void {
    this.broadcastFn = fn;
  }

  private emit(event: string, data: any): void {
    if (this.broadcastFn) {
      this.broadcastFn(event, data);
    }
  }

  // =======================================================================
  // Game lifecycle
  // =======================================================================

  /**
   * Initialize the game loop. Call once on server startup.
   */
  async init(): Promise<void> {
    await this.startNewRound();
  }

  /**
   * Start a new crash round.
   */
  private async startNewRound(): Promise<void> {
    // Clean up previous interval
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    // Generate crash point
    const { seed: serverSeed, hash: serverSeedHash } =
      this.fairService2.generateServerSeed();

    // Get a sequential nonce from Redis
    const nonce = await redis.incr('crash:global_nonce');

    const crashPoint = this.fairService2.generateCrashPoint(
      serverSeed,
      CrashGameService.HOUSE_CLIENT_SEED,
      nonce,
    );

    // Persist the round
    const round = await prisma.crashRound.create({
      data: {
        crashPoint: new Decimal(crashPoint.toFixed(8)),
        serverSeed,
        serverSeedHash,
        clientSeed: CrashGameService.HOUSE_CLIENT_SEED,
        nonce,
        status: 'WAITING',
      },
    });

    this.state = {
      roundId: round.id,
      phase: 'WAITING',
      crashPoint,
      currentMultiplier: 1.0,
      startedAt: null,
      bets: [],
      serverSeedHash,
      elapsed: 0,
    };

    this.emit('crash:newRound', {
      roundId: round.id,
      phase: 'WAITING',
      serverSeedHash,
      countdown: 15,
    });

    // 15-second countdown before round starts
    this.countdownTimeout = setTimeout(() => {
      void this.startRunning();
    }, 15_000);
  }

  /**
   * Transition from WAITING to RUNNING. Begin the multiplier tick.
   */
  private async startRunning(): Promise<void> {
    if (!this.state) return;

    this.state.phase = 'RUNNING';
    this.state.startedAt = Date.now();

    await prisma.crashRound.update({
      where: { id: this.state.roundId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    this.emit('crash:start', { roundId: this.state.roundId });

    // Tick every 50ms
    this.tickInterval = setInterval(() => {
      void this.tick();
    }, 50);
  }

  /**
   * Called every 50ms while RUNNING. Advances the multiplier using
   * an exponential curve: 1.0 * e^(0.00006 * elapsed_ms).
   */
  private async tick(): Promise<void> {
    if (!this.state || this.state.phase !== 'RUNNING' || !this.state.startedAt) {
      return;
    }

    const elapsed = Date.now() - this.state.startedAt;
    const multiplier = Math.floor(Math.pow(Math.E, 0.00006 * elapsed) * 100) / 100;

    this.state.currentMultiplier = multiplier;
    this.state.elapsed = elapsed;

    // Process auto-cashouts
    for (const bet of this.state.bets) {
      if (
        bet.isActive &&
        bet.autoCashout !== null &&
        multiplier >= bet.autoCashout
      ) {
        await this.executeCashout(bet.userId, bet.autoCashout);
      }
    }

    // Check crash
    if (multiplier >= this.state.crashPoint) {
      await this.crash();
      return;
    }

    this.emit('crash:tick', {
      roundId: this.state.roundId,
      multiplier,
      elapsed,
    });
  }

  /**
   * Crash! Settle all remaining active bets as lost.
   */
  private async crash(): Promise<void> {
    if (!this.state) return;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.state.phase = 'CRASHED';

    // Settle losers
    for (const bet of this.state.bets) {
      if (bet.isActive) {
        bet.isActive = false;
        bet.payout = 0;

        await prisma.crashBet.update({
          where: { id: bet.id },
          data: { isActive: false, payout: new Decimal('0') },
        });

        // Record as casino round
        await this.recordRound({
          userId: bet.userId,
          gameSlug: this.slug,
          betAmount: bet.amount,
          payout: 0,
          multiplier: 0,
          result: { crashPoint: this.state.crashPoint, cashedOut: false },
          serverSeedHash: this.state.serverSeedHash,
          clientSeed: CrashGameService.HOUSE_CLIENT_SEED,
          nonce: 0,
        });
      }
    }

    await prisma.crashRound.update({
      where: { id: this.state.roundId },
      data: { status: 'CRASHED', crashedAt: new Date() },
    });

    this.emit('crash:crashed', {
      roundId: this.state.roundId,
      crashPoint: this.state.crashPoint,
      bets: this.state.bets.map((b) => ({
        userId: b.userId,
        username: b.username,
        amount: b.amount,
        cashoutAt: b.cashoutAt,
        payout: b.payout,
      })),
    });

    // Start next round after a 5-second pause
    setTimeout(() => {
      void this.startNewRound();
    }, 5_000);
  }

  // =======================================================================
  // Player actions
  // =======================================================================

  /**
   * Place a bet on the current crash round. Only allowed during WAITING phase.
   */
  async placeBet(
    userId: string,
    amount: number,
    currency: string,
    autoCashout?: number,
  ): Promise<{ betId: string; roundId: string }> {
    if (!this.state || this.state.phase !== 'WAITING') {
      throw new GameError('ROUND_NOT_ACCEPTING', 'Round is not accepting bets.');
    }

    // Check if user already has a bet in this round
    const existingBet = this.state.bets.find((b) => b.userId === userId);
    if (existingBet) {
      throw new GameError('ALREADY_BET', 'You already have a bet in this round.');
    }

    await this.validateBet(userId, amount, currency);
    await this.deductBalance(userId, amount, currency);

    // Get username
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    const crashBet = await prisma.crashBet.create({
      data: {
        roundId: this.state.roundId,
        userId,
        amount: new Decimal(amount.toFixed(8)),
        autoCashout: autoCashout ? new Decimal(autoCashout.toFixed(8)) : null,
        isActive: true,
      },
    });

    const betEntry: CrashBetEntry = {
      id: crashBet.id,
      userId,
      username: user?.username ?? 'Anonymous',
      amount,
      currency,
      autoCashout: autoCashout ?? null,
      cashoutAt: null,
      payout: null,
      isActive: true,
    };

    this.state.bets.push(betEntry);

    this.emit('crash:bet', {
      roundId: this.state.roundId,
      userId,
      username: betEntry.username,
      amount,
      autoCashout: autoCashout ?? null,
    });

    return { betId: crashBet.id, roundId: this.state.roundId };
  }

  /**
   * Cash out during the RUNNING phase.
   */
  async cashout(userId: string): Promise<{ payout: number; multiplier: number }> {
    if (!this.state || this.state.phase !== 'RUNNING') {
      throw new GameError('NOT_RUNNING', 'Round is not running.');
    }

    return this.executeCashout(userId, this.state.currentMultiplier);
  }

  private async executeCashout(
    userId: string,
    multiplier: number,
  ): Promise<{ payout: number; multiplier: number }> {
    if (!this.state) {
      throw new GameError('NO_STATE', 'No active round.');
    }

    const bet = this.state.bets.find((b) => b.userId === userId && b.isActive);
    if (!bet) {
      throw new GameError('NO_ACTIVE_BET', 'No active bet found for this round.');
    }

    bet.isActive = false;
    bet.cashoutAt = multiplier;
    const payout = Math.floor(bet.amount * multiplier * 100) / 100;
    bet.payout = payout;

    // Credit winnings
    await this.creditWinnings(userId, payout, bet.currency);

    // Update DB
    await prisma.crashBet.update({
      where: { id: bet.id },
      data: {
        isActive: false,
        cashoutAt: new Decimal(multiplier.toFixed(8)),
        payout: new Decimal(payout.toFixed(8)),
      },
    });

    // Record round
    await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: bet.amount,
      payout,
      multiplier,
      result: {
        crashPoint: this.state.crashPoint,
        cashedOut: true,
        cashoutMultiplier: multiplier,
      },
      serverSeedHash: this.state.serverSeedHash,
      clientSeed: CrashGameService.HOUSE_CLIENT_SEED,
      nonce: 0,
    });

    this.emit('crash:cashout', {
      roundId: this.state.roundId,
      userId,
      username: bet.username,
      multiplier,
      payout,
    });

    return { payout, multiplier };
  }

  // =======================================================================
  // Queries
  // =======================================================================

  /**
   * Get the current round state (safe for clients — no server seed).
   */
  getCurrentState(): {
    roundId: string | null;
    phase: CrashPhase;
    currentMultiplier: number;
    elapsed: number;
    serverSeedHash: string;
    bets: Array<{
      userId: string;
      username: string;
      amount: number;
      autoCashout: number | null;
      cashoutAt: number | null;
      payout: number | null;
      isActive: boolean;
    }>;
  } {
    if (!this.state) {
      return {
        roundId: null,
        phase: 'WAITING',
        currentMultiplier: 1.0,
        elapsed: 0,
        serverSeedHash: '',
        bets: [],
      };
    }

    return {
      roundId: this.state.roundId,
      phase: this.state.phase,
      currentMultiplier: this.state.currentMultiplier,
      elapsed: this.state.elapsed,
      serverSeedHash: this.state.serverSeedHash,
      bets: this.state.bets.map((b) => ({
        userId: b.userId,
        username: b.username,
        amount: b.amount,
        autoCashout: b.autoCashout,
        cashoutAt: b.cashoutAt,
        payout: b.payout,
        isActive: b.isActive,
      })),
    };
  }

  /**
   * Get the last N crash rounds from the database.
   */
  async getHistory(limit: number = 20): Promise<
    Array<{
      id: string;
      crashPoint: number;
      serverSeedHash: string;
      createdAt: Date;
    }>
  > {
    const rounds = await prisma.crashRound.findMany({
      where: { status: 'CRASHED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        crashPoint: true,
        serverSeedHash: true,
        createdAt: true,
      },
    });

    return rounds.map((r) => ({
      id: r.id,
      crashPoint: r.crashPoint.toNumber(),
      serverSeedHash: r.serverSeedHash,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Graceful shutdown — stop intervals.
   */
  shutdown(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.countdownTimeout) clearTimeout(this.countdownTimeout);
  }
}

export const crashGameService = new CrashGameService();
export default crashGameService;
