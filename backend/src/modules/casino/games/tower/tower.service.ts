import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface DifficultyConfig {
  columns: number;
  traps: number;
  baseMultiplierPerRow: number;
}

interface TowerState {
  userId: string;
  betAmount: number;
  currency: string;
  difficulty: Difficulty;
  currentRow: number;
  trapPositions: number[][]; // trap column indices for each row
  revealed: number[];        // column chosen by player for each completed row
  multiplier: number;
  isActive: boolean;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Difficulty configs
// ---------------------------------------------------------------------------

const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: { columns: 4, traps: 1, baseMultiplierPerRow: 1.31 },     // ~25% lose chance
  medium: { columns: 3, traps: 1, baseMultiplierPerRow: 1.47 },   // ~33% lose chance
  hard: { columns: 2, traps: 1, baseMultiplierPerRow: 1.96 },     // ~50% lose chance
  expert: { columns: 3, traps: 2, baseMultiplierPerRow: 2.94 },   // ~67% lose chance
};

const TOTAL_ROWS = 10;
const REDIS_KEY_PREFIX = 'tower:game:';
const REDIS_TTL = 3600; // 1 hour

// ---------------------------------------------------------------------------
// TowerGame
// ---------------------------------------------------------------------------

export class TowerGame extends BaseGame {
  readonly name = 'Tower';
  readonly slug = 'tower';
  readonly houseEdge = 0.02;
  readonly minBet = 0.01;
  readonly maxBet = 5000;

  /**
   * play() is not used directly for Tower -- it's a stateful game.
   * Provided to satisfy BaseGame abstract requirement; delegates to start().
   */
  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    return this.start(userId, bet);
  }

  // -------------------------------------------------------------------------
  // Start a new tower climb
  // -------------------------------------------------------------------------

  async start(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const difficulty: Difficulty = (options as { difficulty?: Difficulty })?.difficulty ?? 'easy';

    if (!DIFFICULTY_CONFIGS[difficulty]) {
      throw new GameError('INVALID_DIFFICULTY', 'Difficulty must be easy, medium, hard, or expert.');
    }

    // Check for existing active game
    const existingKey = REDIS_KEY_PREFIX + userId;
    const existing = await redis.get(existingKey);
    if (existing) {
      throw new GameError('GAME_IN_PROGRESS', 'You already have an active Tower game. Cashout or finish it first.');
    }

    // Validate bet
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate trap positions for all 10 rows using provably fair
    const config = DIFFICULTY_CONFIGS[difficulty];
    const totalRandomsNeeded = TOTAL_ROWS * config.traps;
    const randoms = this.fairService.generateMultipleResults(serverSeed, clientSeed, nonce, totalRandomsNeeded);

    const trapPositions: number[][] = [];
    let randomIdx = 0;

    for (let row = 0; row < TOTAL_ROWS; row++) {
      const available = Array.from({ length: config.columns }, (_, i) => i);
      const rowTraps: number[] = [];

      for (let t = 0; t < config.traps; t++) {
        const idx = Math.floor(randoms[randomIdx] * available.length);
        rowTraps.push(available[idx]);
        available.splice(idx, 1);
        randomIdx++;
      }

      trapPositions.push(rowTraps.sort((a, b) => a - b));
    }

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Store game state in Redis
    const state: TowerState = {
      userId,
      betAmount: amount,
      currency,
      difficulty,
      currentRow: 0,
      trapPositions,
      revealed: [],
      multiplier: 1.0,
      isActive: true,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      createdAt: new Date().toISOString(),
    };

    await redis.set(existingKey, JSON.stringify(state), 'EX', REDIS_TTL);

    // Increment nonce
    await this.incrementNonce(userId);

    return {
      roundId: '',
      game: this.slug,
      betAmount: amount,
      payout: 0,
      profit: -amount,
      multiplier: 1.0,
      result: {
        status: 'started',
        difficulty,
        totalRows: TOTAL_ROWS,
        columns: config.columns,
        traps: config.traps,
        currentRow: 0,
        multiplier: 1.0,
        nextMultiplier: this.calculateMultiplier(difficulty, 1),
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Climb one row
  // -------------------------------------------------------------------------

  async climb(userId: string, column: number): Promise<GameResult> {
    const key = REDIS_KEY_PREFIX + userId;
    const raw = await redis.get(key);

    if (!raw) {
      throw new GameError('NO_GAME', 'No active Tower game found.');
    }

    const state: TowerState = JSON.parse(raw);

    if (!state.isActive) {
      throw new GameError('GAME_OVER', 'This Tower game has already ended.');
    }

    const config = DIFFICULTY_CONFIGS[state.difficulty];

    // Validate column
    if (!Number.isInteger(column) || column < 0 || column >= config.columns) {
      throw new GameError('INVALID_COLUMN', `Column must be between 0 and ${config.columns - 1}.`);
    }

    const currentRow = state.currentRow;
    const rowTraps = state.trapPositions[currentRow];
    const isTrap = rowTraps.includes(column);

    if (isTrap) {
      // Player hit a trap - lose everything
      state.isActive = false;
      state.multiplier = 0;
      state.revealed.push(column);

      // Record the round
      const roundId = await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: state.betAmount,
        payout: 0,
        multiplier: 0,
        result: {
          status: 'busted',
          difficulty: state.difficulty,
          currentRow,
          column,
          trapPositions: state.trapPositions,
          revealed: state.revealed,
        },
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      });

      // Clean up Redis
      await redis.del(key);

      // Fetch updated balance
      const trapBalance = await this.getBalance(userId, state.currency);

      return {
        roundId,
        game: this.slug,
        betAmount: state.betAmount,
        payout: 0,
        profit: -state.betAmount,
        multiplier: 0,
        result: {
          status: 'busted',
          difficulty: state.difficulty,
          hitTrap: true,
          currentRow,
          column,
          trapPositions: state.trapPositions,
          revealed: state.revealed,
          totalRows: TOTAL_ROWS,
          columns: config.columns,
        },
        fairness: {
          serverSeedHash: state.serverSeedHash,
          clientSeed: state.clientSeed,
          nonce: state.nonce,
        },
        newBalance: trapBalance,
      };
    }

    // Safe - advance row
    state.revealed.push(column);
    state.currentRow = currentRow + 1;
    state.multiplier = this.calculateMultiplier(state.difficulty, state.currentRow);

    // Check if reached the top
    const reachedTop = state.currentRow >= TOTAL_ROWS;

    if (reachedTop) {
      // Auto-cashout at the top
      return this.cashoutInternal(userId, state, key);
    }

    // Update Redis
    await redis.set(key, JSON.stringify(state), 'EX', REDIS_TTL);

    return {
      roundId: '',
      game: this.slug,
      betAmount: state.betAmount,
      payout: 0,
      profit: 0,
      multiplier: state.multiplier,
      result: {
        status: 'climbing',
        difficulty: state.difficulty,
        hitTrap: false,
        currentRow: state.currentRow,
        column,
        multiplier: state.multiplier,
        nextMultiplier: state.currentRow < TOTAL_ROWS
          ? this.calculateMultiplier(state.difficulty, state.currentRow + 1)
          : null,
        revealed: state.revealed,
        totalRows: TOTAL_ROWS,
        columns: config.columns,
      },
      fairness: {
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      },
      newBalance: undefined as number | undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Cashout
  // -------------------------------------------------------------------------

  async cashout(userId: string): Promise<GameResult> {
    const key = REDIS_KEY_PREFIX + userId;
    const raw = await redis.get(key);

    if (!raw) {
      throw new GameError('NO_GAME', 'No active Tower game found.');
    }

    const state: TowerState = JSON.parse(raw);

    if (!state.isActive) {
      throw new GameError('GAME_OVER', 'This Tower game has already ended.');
    }

    if (state.currentRow === 0) {
      throw new GameError('NO_PROGRESS', 'You must climb at least one row before cashing out.');
    }

    return this.cashoutInternal(userId, state, key);
  }

  // -------------------------------------------------------------------------
  // Internal cashout
  // -------------------------------------------------------------------------

  private async cashoutInternal(userId: string, state: TowerState, key: string): Promise<GameResult> {
    const payout = state.betAmount * state.multiplier;
    const profit = payout - state.betAmount;

    // Credit winnings
    await this.creditWinnings(userId, payout, state.currency);

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: state.betAmount,
      payout,
      multiplier: state.multiplier,
      result: {
        status: 'cashout',
        difficulty: state.difficulty,
        currentRow: state.currentRow,
        trapPositions: state.trapPositions,
        revealed: state.revealed,
      },
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    // Clean up Redis
    await redis.del(key);

    const config = DIFFICULTY_CONFIGS[state.difficulty];

    // Fetch updated balance
    const cashoutBalance = await this.getBalance(userId, state.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: state.betAmount,
      payout,
      profit,
      multiplier: state.multiplier,
      result: {
        status: 'cashout',
        difficulty: state.difficulty,
        currentRow: state.currentRow,
        trapPositions: state.trapPositions,
        revealed: state.revealed,
        totalRows: TOTAL_ROWS,
        columns: config.columns,
      },
      fairness: {
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      },
      newBalance: cashoutBalance,
    };
  }

  // -------------------------------------------------------------------------
  // Multiplier calculation
  // -------------------------------------------------------------------------

  /**
   * Calculate multiplier for a given row number (1-indexed).
   * Formula: multiplier = basePerRow ^ rowsClimbed * (1 - houseEdge)
   */
  private calculateMultiplier(difficulty: Difficulty, rowsClimbed: number): number {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const safeProb = (config.columns - config.traps) / config.columns;
    // Fair multiplier for surviving `rowsClimbed` rows
    const fairMultiplier = Math.pow(1 / safeProb, rowsClimbed);
    // Apply house edge
    const withEdge = fairMultiplier * (1 - this.houseEdge);
    return Math.floor(withEdge * 100) / 100; // 2 decimal places
  }
}

export const towerGame = new TowerGame();
export default towerGame;
