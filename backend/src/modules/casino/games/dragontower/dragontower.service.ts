import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  columns: number;
  traps: number;       // dragons per level
  baseMultiplierPerLevel: number;
}

interface DragonTowerState {
  userId: string;
  betAmount: number;
  currency: string;
  difficulty: Difficulty;
  currentLevel: number;        // 0-indexed, 0 = not yet picked
  dragonPositions: number[][]; // dragon column indices for each level
  revealed: number[];          // column chosen by player for each completed level
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
// 3 doors per level, 9 levels
// easy:   1 dragon  per level -> 2/3 safe -> ~1.4x per level
// medium: 1 dragon  per level -> 2/3 safe -> ~2.1x per level (higher edge)
// hard:   2 dragons per level -> 1/3 safe -> ~4.2x per level
// ---------------------------------------------------------------------------

const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy:   { columns: 3, traps: 1, baseMultiplierPerLevel: 1.40 },
  medium: { columns: 3, traps: 1, baseMultiplierPerLevel: 1.40 },
  hard:   { columns: 3, traps: 2, baseMultiplierPerLevel: 2.80 },
};

const TOTAL_LEVELS = 9;
const REDIS_KEY_PREFIX = 'dragontower:game:';
const REDIS_TTL = 3600; // 1 hour

// ---------------------------------------------------------------------------
// DragonTowerGame
// ---------------------------------------------------------------------------

export class DragonTowerGame extends BaseGame {
  readonly name = 'Dragon Tower';
  readonly slug = 'dragontower';
  readonly houseEdge = 0.03;
  readonly minBet = 0.0001;
  readonly maxBet = 5000;

  /**
   * play() delegates based on options.action for the stateful game.
   */
  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const opts = bet.options as {
      action?: string;
      difficulty?: Difficulty;
      position?: number;
      roundId?: string;
    };

    const action = opts?.action ?? 'start';

    switch (action) {
      case 'start':
        return this.start(userId, bet);
      case 'pick':
        if (opts?.position === undefined || opts?.position === null) {
          throw new GameError('INVALID_OPTIONS', 'Must provide position (0, 1, or 2) for pick action.');
        }
        return this.pick(userId, opts.position);
      case 'cashout':
        return this.cashout(userId);
      default:
        throw new GameError('INVALID_ACTION', 'Action must be "start", "pick", or "cashout".');
    }
  }

  // -------------------------------------------------------------------------
  // Start a new dragon tower game
  // -------------------------------------------------------------------------

  async start(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const difficulty: Difficulty = (options as { difficulty?: Difficulty })?.difficulty ?? 'easy';

    if (!DIFFICULTY_CONFIGS[difficulty]) {
      throw new GameError('INVALID_DIFFICULTY', 'Difficulty must be easy, medium, or hard.');
    }

    // Check for existing active game
    const existingKey = REDIS_KEY_PREFIX + userId;
    const existing = await redis.get(existingKey);
    if (existing) {
      const existingState: DragonTowerState = JSON.parse(existing);
      if (existingState.isActive) {
        throw new GameError('GAME_IN_PROGRESS', 'You already have an active Dragon Tower game. Cashout or finish it first.');
      }
      // Clean up stale completed session so it doesn't block a new game
      await redis.del(existingKey);
    }

    // Validate bet
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate dragon positions for all 9 levels using provably fair randomness
    const config = DIFFICULTY_CONFIGS[difficulty];
    const totalRandomsNeeded = TOTAL_LEVELS * config.traps;
    const randoms = this.fairService.generateMultipleResults(serverSeed, clientSeed, nonce, totalRandomsNeeded);

    const dragonPositions: number[][] = [];
    let randomIdx = 0;

    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const available = Array.from({ length: config.columns }, (_, i) => i);
      const levelDragons: number[] = [];

      for (let t = 0; t < config.traps; t++) {
        const idx = Math.floor(randoms[randomIdx] * available.length);
        levelDragons.push(available[idx]);
        available.splice(idx, 1);
        randomIdx++;
      }

      dragonPositions.push(levelDragons.sort((a, b) => a - b));
    }

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Store game state in Redis
    const state: DragonTowerState = {
      userId,
      betAmount: amount,
      currency,
      difficulty,
      currentLevel: 0,
      dragonPositions,
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

    // Calculate the multiplier ladder
    const multiplierLadder = this.getMultiplierLadder(difficulty);

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
        totalLevels: TOTAL_LEVELS,
        columns: config.columns,
        traps: config.traps,
        currentLevel: 0,
        multiplier: 1.0,
        nextMultiplier: multiplierLadder[0],
        multiplierLadder,
        revealed: [],
        grid: [],
        isDragon: false,
        isGameOver: false,
        currentMultiplier: 1.0,
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Pick a door at the current level
  // -------------------------------------------------------------------------

  async pick(userId: string, position: number): Promise<GameResult> {
    const key = REDIS_KEY_PREFIX + userId;
    const raw = await redis.get(key);

    if (!raw) {
      throw new GameError('NO_GAME', 'No active Dragon Tower game found.');
    }

    const state: DragonTowerState = JSON.parse(raw);

    if (!state.isActive) {
      throw new GameError('GAME_OVER', 'This Dragon Tower game has already ended.');
    }

    const config = DIFFICULTY_CONFIGS[state.difficulty];

    // Validate position
    if (!Number.isInteger(position) || position < 0 || position >= config.columns) {
      throw new GameError('INVALID_POSITION', `Position must be between 0 and ${config.columns - 1}.`);
    }

    const currentLevel = state.currentLevel;
    const levelDragons = state.dragonPositions[currentLevel];
    const isDragon = levelDragons.includes(position);

    if (isDragon) {
      // Player hit a dragon - game over, lose everything
      state.isActive = false;
      state.multiplier = 0;
      state.revealed.push(position);

      // Record the round
      const roundId = await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: state.betAmount,
        payout: 0,
        multiplier: 0,
        result: {
          status: 'dragon',
          difficulty: state.difficulty,
          currentLevel,
          position,
          dragonPositions: state.dragonPositions,
          revealed: state.revealed,
        },
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      });

      // Clean up Redis
      await redis.del(key);

      // Fetch updated balance
      const dragonBalance = await this.getBalance(userId, state.currency);

      // Build the full grid for reveal
      const grid = this.buildRevealGrid(state.dragonPositions, state.revealed, config.columns, currentLevel + 1);

      return {
        roundId,
        game: this.slug,
        betAmount: state.betAmount,
        payout: 0,
        profit: -state.betAmount,
        multiplier: 0,
        result: {
          status: 'dragon',
          difficulty: state.difficulty,
          isDragon: true,
          currentLevel,
          position,
          dragonPositions: state.dragonPositions,
          revealed: state.revealed,
          totalLevels: TOTAL_LEVELS,
          columns: config.columns,
          grid,
          currentMultiplier: 0,
          isGameOver: true,
        },
        fairness: {
          serverSeedHash: state.serverSeedHash,
          clientSeed: state.clientSeed,
          nonce: state.nonce,
        },
        newBalance: dragonBalance,
      };
    }

    // Safe - advance level
    state.revealed.push(position);
    state.currentLevel = currentLevel + 1;
    state.multiplier = this.calculateMultiplier(state.difficulty, state.currentLevel);

    // Check if reached the top
    const reachedTop = state.currentLevel >= TOTAL_LEVELS;

    if (reachedTop) {
      // Auto-cashout at the top
      return this.cashoutInternal(userId, state, key);
    }

    // Update Redis
    await redis.set(key, JSON.stringify(state), 'EX', REDIS_TTL);

    const multiplierLadder = this.getMultiplierLadder(state.difficulty);
    const grid = this.buildRevealGrid(state.dragonPositions, state.revealed, config.columns, state.currentLevel);

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
        isDragon: false,
        currentLevel: state.currentLevel,
        position,
        multiplier: state.multiplier,
        nextMultiplier: state.currentLevel < TOTAL_LEVELS
          ? multiplierLadder[state.currentLevel]
          : null,
        revealed: state.revealed,
        totalLevels: TOTAL_LEVELS,
        columns: config.columns,
        grid,
        currentMultiplier: state.multiplier,
        multiplierLadder,
        isGameOver: false,
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
      throw new GameError('NO_GAME', 'No active Dragon Tower game found.');
    }

    const state: DragonTowerState = JSON.parse(raw);

    if (!state.isActive) {
      throw new GameError('GAME_OVER', 'This Dragon Tower game has already ended.');
    }

    if (state.currentLevel === 0) {
      throw new GameError('NO_PROGRESS', 'You must climb at least one level before cashing out.');
    }

    return this.cashoutInternal(userId, state, key);
  }

  // -------------------------------------------------------------------------
  // Internal cashout
  // -------------------------------------------------------------------------

  private async cashoutInternal(userId: string, state: DragonTowerState, key: string): Promise<GameResult> {
    const payout = Math.floor(state.betAmount * state.multiplier * 100000000) / 100000000;
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
        currentLevel: state.currentLevel,
        dragonPositions: state.dragonPositions,
        revealed: state.revealed,
      },
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    // Clean up Redis
    await redis.del(key);

    const config = DIFFICULTY_CONFIGS[state.difficulty];
    const grid = this.buildRevealGrid(state.dragonPositions, state.revealed, config.columns, state.currentLevel);
    const multiplierLadder = this.getMultiplierLadder(state.difficulty);

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
        currentLevel: state.currentLevel,
        dragonPositions: state.dragonPositions,
        revealed: state.revealed,
        totalLevels: TOTAL_LEVELS,
        columns: config.columns,
        grid,
        currentMultiplier: state.multiplier,
        multiplierLadder,
        isDragon: false,
        isGameOver: true,
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
   * Calculate multiplier for a given number of levels climbed (1-indexed).
   * Formula: (1 / safeProb) ^ levelsClimbed * (1 - houseEdge)
   */
  private calculateMultiplier(difficulty: Difficulty, levelsClimbed: number): number {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const safeProb = (config.columns - config.traps) / config.columns;
    const fairMultiplier = Math.pow(1 / safeProb, levelsClimbed);
    const withEdge = fairMultiplier * (1 - this.houseEdge);
    return Math.floor(withEdge * 100) / 100; // 2 decimal places
  }

  /**
   * Get the full multiplier ladder for all 9 levels.
   */
  private getMultiplierLadder(difficulty: Difficulty): number[] {
    return Array.from({ length: TOTAL_LEVELS }, (_, i) =>
      this.calculateMultiplier(difficulty, i + 1),
    );
  }

  /**
   * Build a grid representation for the client showing revealed levels.
   * Each row is an array of 'safe' | 'dragon' | 'hidden' | 'picked'.
   */
  private buildRevealGrid(
    dragonPositions: number[][],
    revealed: number[],
    columns: number,
    revealUpTo: number,
  ): string[][] {
    const grid: string[][] = [];

    for (let level = 0; level < TOTAL_LEVELS; level++) {
      const row: string[] = [];
      for (let col = 0; col < columns; col++) {
        if (level < revealUpTo) {
          // This level has been played
          const isDragon = dragonPositions[level].includes(col);
          const wasChosen = revealed[level] === col;

          if (wasChosen && isDragon) {
            row.push('dragon_hit');
          } else if (wasChosen) {
            row.push('picked');
          } else if (isDragon) {
            row.push('dragon');
          } else {
            row.push('safe');
          }
        } else {
          row.push('hidden');
        }
      }
      grid.push(row);
    }

    return grid;
  }
}

export const dragonTowerGame = new DragonTowerGame();
export default dragonTowerGame;
