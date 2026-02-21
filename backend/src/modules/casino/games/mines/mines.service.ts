import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Mines Game
// ---------------------------------------------------------------------------
// Stateful game stored in Redis per user session.
// 5x5 grid (25 tiles). Player picks mineCount (1-24).
// Reveal tiles one at a time. Hit a mine = lose. Cash out anytime.
// Multiplier increases progressively with each safe reveal.
// ---------------------------------------------------------------------------

interface MinesState {
  roundId: string;
  userId: string;
  betAmount: number;
  currency: string;
  mineCount: number;
  minePositions: number[];   // hidden from client
  revealed: number[];         // positions revealed so far
  currentMultiplier: number;
  isActive: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface MinesStartOptions {
  mineCount: number;  // 1-24
}

export class MinesGame extends BaseGame {
  readonly name = 'Mines';
  readonly slug = 'mines';
  readonly houseEdge = 0.02;
  readonly minBet = 0.01;
  readonly maxBet = 10000;

  private static REDIS_PREFIX = 'mines:session:';
  private static TTL = 3600; // 1 hour session timeout

  /**
   * BaseGame.play is not used directly; mines has start/reveal/cashout flow.
   */
  async play(_userId: string, _bet: BetRequest): Promise<GameResult> {
    throw new GameError('NOT_SUPPORTED', 'Use start/reveal/cashout for Mines.');
  }

  // =======================================================================
  // Game actions
  // =======================================================================

  /**
   * Start a new mines game. Deducts balance immediately.
   */
  async start(
    userId: string,
    bet: BetRequest,
  ): Promise<{
    roundId: string;
    mineCount: number;
    totalTiles: 25;
    serverSeedHash: string;
  }> {
    const options = bet.options as MinesStartOptions;

    if (
      !options ||
      typeof options.mineCount !== 'number' ||
      options.mineCount < 1 ||
      options.mineCount > 24
    ) {
      throw new GameError('INVALID_OPTIONS', 'mineCount must be between 1 and 24.');
    }

    // Check for existing active session
    const existing = await this.getSession(userId);
    if (existing && existing.isActive) {
      throw new GameError('GAME_IN_PROGRESS', 'You already have an active Mines game. Cashout or finish first.');
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);

    // Generate mine positions
    const minePositions = this.fairService.generateMinePositions(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
      options.mineCount,
    );

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    const roundId = `mines_${userId}_${Date.now()}`;

    const state: MinesState = {
      roundId,
      userId,
      betAmount: bet.amount,
      currency: bet.currency,
      mineCount: options.mineCount,
      minePositions,
      revealed: [],
      currentMultiplier: 1.0,
      isActive: true,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    };

    await this.saveSession(userId, state);

    return {
      roundId,
      mineCount: options.mineCount,
      totalTiles: 25,
      serverSeedHash: seeds.serverSeedHash,
    };
  }

  /**
   * Reveal a tile at the given position (0-24).
   */
  async reveal(
    userId: string,
    position: number,
  ): Promise<{
    position: number;
    isMine: boolean;
    currentMultiplier: number;
    nextMultiplier: number;
    revealedCount: number;
    payout: number;
    minePositions?: number[];   // only revealed on game over
    gameOver: boolean;
    newBalance?: number;
  }> {
    if (position < 0 || position > 24 || !Number.isInteger(position)) {
      throw new GameError('INVALID_POSITION', 'Position must be an integer between 0 and 24.');
    }

    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      throw new GameError('NO_ACTIVE_GAME', 'No active Mines game found.');
    }

    if (state.revealed.includes(position)) {
      throw new GameError('ALREADY_REVEALED', 'This tile has already been revealed.');
    }

    const isMine = state.minePositions.includes(position);

    if (isMine) {
      // Game over — player loses
      state.revealed.push(position);
      state.isActive = false;

      await this.saveSession(userId, state);
      await this.incrementNonce(userId);

      // Record round (loss)
      const recordedRoundId = await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: state.betAmount,
        payout: 0,
        multiplier: 0,
        result: {
          mineCount: state.mineCount,
          minePositions: state.minePositions,
          revealed: state.revealed,
          hitMine: true,
          hitPosition: position,
        },
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      });

      // Clean up session
      await this.deleteSession(userId);

      // Fetch updated balance
      const lossBalance = await this.getBalance(userId, state.currency);

      return {
        position,
        isMine: true,
        currentMultiplier: 0,
        nextMultiplier: 0,
        revealedCount: state.revealed.length,
        payout: 0,
        minePositions: state.minePositions,
        gameOver: true,
        newBalance: lossBalance,
      };
    }

    // Safe tile
    state.revealed.push(position);
    const revealedCount = state.revealed.length;

    // Calculate multiplier after this reveal
    state.currentMultiplier = this.calculateMultiplier(
      state.mineCount,
      revealedCount,
    );

    // Calculate what the next reveal multiplier would be
    const safeTilesRemaining = 25 - state.mineCount - revealedCount;
    const nextMultiplier =
      safeTilesRemaining > 0
        ? this.calculateMultiplier(state.mineCount, revealedCount + 1)
        : state.currentMultiplier;

    // Check if all safe tiles are revealed (auto-win)
    const allSafeRevealed = revealedCount === 25 - state.mineCount;
    if (allSafeRevealed) {
      const payout =
        Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000;

      await this.creditWinnings(userId, payout, state.currency);
      await this.incrementNonce(userId);

      state.isActive = false;
      await this.saveSession(userId, state);

      await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: state.betAmount,
        payout,
        multiplier: state.currentMultiplier,
        result: {
          mineCount: state.mineCount,
          minePositions: state.minePositions,
          revealed: state.revealed,
          hitMine: false,
          autoWin: true,
        },
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      });

      await this.deleteSession(userId);

      // Fetch updated balance
      const autoWinBalance = await this.getBalance(userId, state.currency);

      return {
        position,
        isMine: false,
        currentMultiplier: state.currentMultiplier,
        nextMultiplier: state.currentMultiplier,
        revealedCount,
        payout,
        minePositions: state.minePositions,
        gameOver: true,
        newBalance: autoWinBalance,
      };
    }

    await this.saveSession(userId, state);

    return {
      position,
      isMine: false,
      currentMultiplier: state.currentMultiplier,
      nextMultiplier,
      revealedCount,
      payout: Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000,
      gameOver: false,
      newBalance: undefined as number | undefined,
    };
  }

  /**
   * Cash out the current game at the current multiplier.
   */
  async cashout(userId: string): Promise<{
    payout: number;
    multiplier: number;
    revealed: number[];
    minePositions: number[];
    currency: string;
    newBalance: number;
  }> {
    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      throw new GameError('NO_ACTIVE_GAME', 'No active Mines game found.');
    }

    if (state.revealed.length === 0) {
      throw new GameError('NO_REVEALS', 'You must reveal at least one tile before cashing out.');
    }

    const payout =
      Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000;

    await this.creditWinnings(userId, payout, state.currency);
    await this.incrementNonce(userId);

    state.isActive = false;
    await this.saveSession(userId, state);

    await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: state.betAmount,
      payout,
      multiplier: state.currentMultiplier,
      result: {
        mineCount: state.mineCount,
        minePositions: state.minePositions,
        revealed: state.revealed,
        hitMine: false,
        cashedOut: true,
      },
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    await this.deleteSession(userId);

    // Fetch updated balance
    const cashoutBalance = await this.getBalance(userId, state.currency);

    return {
      payout,
      multiplier: state.currentMultiplier,
      revealed: state.revealed,
      minePositions: state.minePositions,
      currency: state.currency,
      newBalance: cashoutBalance,
    };
  }

  /**
   * Get the current game state for the user (without mine positions).
   */
  async getActiveGame(userId: string): Promise<{
    isActive: boolean;
    roundId?: string;
    mineCount?: number;
    revealed?: number[];
    currentMultiplier?: number;
    betAmount?: number;
    currency?: string;
    potentialPayout?: number;
    serverSeedHash?: string;
  } | null> {
    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      return { isActive: false };
    }

    return {
      isActive: true,
      roundId: state.roundId,
      mineCount: state.mineCount,
      revealed: state.revealed,
      currentMultiplier: state.currentMultiplier,
      betAmount: state.betAmount,
      currency: state.currency,
      potentialPayout:
        Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000,
      serverSeedHash: state.serverSeedHash,
    };
  }

  // =======================================================================
  // Multiplier calculation
  // =======================================================================

  /**
   * Progressive multiplier based on combinatorics.
   * After revealing `k` safe tiles out of (25 - mineCount) safe tiles:
   * multiplier = (1 - houseEdge) * Product_{i=0}^{k-1} [ (25 - i) / (25 - mineCount - i) ]
   *
   * Simplified: for each step, the factor is totalRemaining / safeRemaining
   */
  private calculateMultiplier(mineCount: number, revealedCount: number): number {
    let multiplier = 1.0;

    for (let i = 0; i < revealedCount; i++) {
      const totalRemaining = 25 - i;
      const safeRemaining = 25 - mineCount - i;
      multiplier *= totalRemaining / safeRemaining;
    }

    // Apply house edge
    multiplier *= 1 - this.houseEdge;

    return Math.floor(multiplier * 10000) / 10000;
  }

  // =======================================================================
  // Redis session management
  // =======================================================================

  private async saveSession(userId: string, state: MinesState): Promise<void> {
    const key = MinesGame.REDIS_PREFIX + userId;
    await redis.set(key, JSON.stringify(state), 'EX', MinesGame.TTL);
  }

  private async getSession(userId: string): Promise<MinesState | null> {
    const key = MinesGame.REDIS_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as MinesState;
  }

  private async deleteSession(userId: string): Promise<void> {
    const key = MinesGame.REDIS_PREFIX + userId;
    await redis.del(key);
  }
}

export const minesGame = new MinesGame();
export default minesGame;
