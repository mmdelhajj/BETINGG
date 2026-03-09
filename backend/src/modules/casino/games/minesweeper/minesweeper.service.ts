import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Minesweeper Casino Game
// ---------------------------------------------------------------------------
// Classic minesweeper on an 8x8 grid with betting. Player bets, then reveals
// tiles one at a time. Numbers show adjacent mine count. Auto-cascade on 0.
// Cash out anytime based on tiles revealed. Provably fair mine placement.
// ---------------------------------------------------------------------------

interface MinesweeperState {
  roundId: string;
  userId: string;
  betAmount: number;
  currency: string;
  mineCount: number;
  // 8x8 grid: -1 = mine, 0-8 = adjacent mine count
  board: number[][];
  // Which tiles are revealed
  revealed: boolean[][];
  // Which tiles are flagged
  flags: boolean[][];
  revealedCount: number;
  totalSafeTiles: number;
  currentMultiplier: number;
  isActive: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const GRID_SIZE = 8;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE; // 64
const ALLOWED_MINE_COUNTS = [5, 10, 15, 20];

// Directions for neighbor checking (8 directions)
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export class MinesweeperGame extends BaseGame {
  readonly name = 'Minesweeper';
  readonly slug = 'minesweeper';
  readonly houseEdge = 0.03;
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  private static REDIS_PREFIX = 'minesweeper:session:';
  private static TTL = 3600; // 1 hour session timeout

  /**
   * BaseGame.play is not used directly; minesweeper has start/reveal/flag/cashout flow.
   */
  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const opts = bet.options as any;
    const action = opts?.action;

    if (action === 'start') {
      return this.start(userId, bet) as any;
    } else if (action === 'reveal') {
      const row = opts.row ?? 0;
      const col = opts.col ?? 0;
      return this.reveal(userId, row, col) as any;
    } else if (action === 'flag') {
      const row = opts.row ?? 0;
      const col = opts.col ?? 0;
      return this.flag(userId, row, col) as any;
    } else if (action === 'cashout') {
      return this.cashout(userId) as any;
    }

    throw new GameError('INVALID_ACTION', 'Must provide action: start, reveal, flag, or cashout.');
  }

  // =======================================================================
  // Board generation
  // =======================================================================

  /**
   * Generate mine positions using provably fair randomness.
   * Returns an array of [row, col] tuples for mine positions.
   */
  private generateMinePositions(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    mineCount: number,
  ): [number, number][] {
    const positions: [number, number][] = [];
    const available: [number, number][] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        available.push([r, c]);
      }
    }

    const randoms = this.fairService.generateMultipleResults(
      serverSeed,
      clientSeed,
      nonce,
      mineCount,
    );

    for (let i = 0; i < mineCount; i++) {
      const idx = Math.floor(randoms[i] * available.length);
      positions.push(available[idx]);
      available.splice(idx, 1);
    }

    return positions;
  }

  /**
   * Build the 8x8 board with mine counts.
   * -1 = mine, 0-8 = adjacent mine count
   */
  private buildBoard(minePositions: [number, number][]): number[][] {
    const board: number[][] = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill(0),
    );

    // Place mines
    for (const [r, c] of minePositions) {
      board[r][c] = -1;
    }

    // Calculate adjacent counts
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (board[r][c] === -1) continue;
        let count = 0;
        for (const [dr, dc] of DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc] === -1) {
            count++;
          }
        }
        board[r][c] = count;
      }
    }

    return board;
  }

  /**
   * Auto-reveal cascade: when revealing a 0-adjacent tile, flood-fill reveal
   * all neighbors recursively until hitting numbered tiles.
   */
  private cascadeReveal(
    board: number[][],
    revealed: boolean[][],
    startR: number,
    startC: number,
  ): [number, number][] {
    const newReveals: [number, number][] = [];
    const queue: [number, number][] = [[startR, startC]];

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;

      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
      if (revealed[r][c]) continue;
      if (board[r][c] === -1) continue;

      revealed[r][c] = true;
      newReveals.push([r, c]);

      // If this tile has 0 adjacent mines, recurse into neighbors
      if (board[r][c] === 0) {
        for (const [dr, dc] of DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !revealed[nr][nc]) {
            queue.push([nr, nc]);
          }
        }
      }
    }

    return newReveals;
  }

  // =======================================================================
  // Game actions
  // =======================================================================

  /**
   * Start a new minesweeper game. Deducts balance immediately.
   */
  async start(
    userId: string,
    bet: BetRequest,
  ): Promise<{
    roundId: string;
    mineCount: number;
    gridSize: number;
    totalTiles: number;
    serverSeedHash: string;
  }> {
    const options = bet.options as { mines?: number } | undefined;
    const mineCount = options?.mines ?? 10;

    if (!ALLOWED_MINE_COUNTS.includes(mineCount)) {
      throw new GameError(
        'INVALID_OPTIONS',
        `Mine count must be one of: ${ALLOWED_MINE_COUNTS.join(', ')}.`,
      );
    }

    // Check for existing active session
    const existing = await this.getSession(userId);
    if (existing && existing.isActive) {
      throw new GameError(
        'GAME_IN_PROGRESS',
        'You already have an active Minesweeper game. Cashout or finish first.',
      );
    }
    // Clean up any stale completed session so it doesn't block a new game
    if (existing) {
      await this.deleteSession(userId);
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);

    // Generate mine positions
    const minePositions = this.generateMinePositions(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
      mineCount,
    );

    // Build the board
    const board = this.buildBoard(minePositions);

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    const roundId = `minesweeper_${userId}_${Date.now()}`;
    const totalSafeTiles = TOTAL_TILES - mineCount;

    const state: MinesweeperState = {
      roundId,
      userId,
      betAmount: bet.amount,
      currency: bet.currency,
      mineCount,
      board,
      revealed: Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false)),
      flags: Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false)),
      revealedCount: 0,
      totalSafeTiles,
      currentMultiplier: 1.0,
      isActive: true,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    };

    await this.saveSession(userId, state);

    return {
      roundId,
      mineCount,
      gridSize: GRID_SIZE,
      totalTiles: TOTAL_TILES,
      serverSeedHash: seeds.serverSeedHash,
    };
  }

  /**
   * Reveal a tile at the given (x, y) position.
   * x = column (0-7), y = row (0-7).
   */
  async reveal(
    userId: string,
    x: number,
    y: number,
  ): Promise<{
    x: number;
    y: number;
    isMine: boolean;
    value: number;
    revealedTiles: { x: number; y: number; value: number }[];
    revealedCount: number;
    currentMultiplier: number;
    nextMultiplier: number;
    payout: number;
    isGameOver: boolean;
    minePositions?: [number, number][];
    grid?: number[][];
    newBalance?: number;
  }> {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || !Number.isInteger(x) || !Number.isInteger(y)) {
      throw new GameError('INVALID_POSITION', `Position must be integers in range 0-${GRID_SIZE - 1}.`);
    }

    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      throw new GameError('NO_ACTIVE_GAME', 'No active Minesweeper game found.');
    }

    const row = y;
    const col = x;

    if (state.revealed[row][col]) {
      throw new GameError('ALREADY_REVEALED', 'This tile has already been revealed.');
    }

    // Remove flag if present
    if (state.flags[row][col]) {
      state.flags[row][col] = false;
    }

    const isMine = state.board[row][col] === -1;

    if (isMine) {
      // Game over: hit a mine
      state.revealed[row][col] = true;
      state.isActive = false;

      await this.saveSession(userId, state);
      await this.incrementNonce(userId);

      // Get mine positions for reveal
      const minePositions = this.extractMinePositions(state.board);

      // Record round (loss)
      await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: state.betAmount,
        payout: 0,
        multiplier: 0,
        result: {
          mineCount: state.mineCount,
          minePositions,
          revealedCount: state.revealedCount,
          hitMine: true,
          hitPosition: { x, y },
        },
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      });

      await this.deleteSession(userId);

      const newBalance = await this.getBalance(userId, state.currency);

      return {
        x,
        y,
        isMine: true,
        value: -1,
        revealedTiles: [{ x, y, value: -1 }],
        revealedCount: state.revealedCount,
        currentMultiplier: 0,
        nextMultiplier: 0,
        payout: 0,
        isGameOver: true,
        minePositions,
        grid: state.board,
        newBalance,
      };
    }

    // Safe tile - cascade reveal
    const newReveals = this.cascadeReveal(state.board, state.revealed, row, col);

    state.revealedCount += newReveals.length;

    // Calculate multiplier
    state.currentMultiplier = this.calculateMultiplier(
      state.mineCount,
      state.revealedCount,
    );

    const safeTilesRemaining = state.totalSafeTiles - state.revealedCount;
    const nextMultiplier =
      safeTilesRemaining > 0
        ? this.calculateMultiplier(state.mineCount, state.revealedCount + 1)
        : state.currentMultiplier;

    const revealedTiles = newReveals.map(([r, c]) => ({
      x: c,
      y: r,
      value: state.board[r][c],
    }));

    // Check if all safe tiles are revealed (auto-win)
    const allSafeRevealed = state.revealedCount >= state.totalSafeTiles;
    if (allSafeRevealed) {
      const payout =
        Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000;

      await this.creditWinnings(userId, payout, state.currency);
      await this.incrementNonce(userId);

      state.isActive = false;
      await this.saveSession(userId, state);

      const minePositions = this.extractMinePositions(state.board);

      await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: state.betAmount,
        payout,
        multiplier: state.currentMultiplier,
        result: {
          mineCount: state.mineCount,
          minePositions,
          revealedCount: state.revealedCount,
          hitMine: false,
          autoWin: true,
        },
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      });

      await this.deleteSession(userId);

      const autoWinBalance = await this.getBalance(userId, state.currency);

      return {
        x,
        y,
        isMine: false,
        value: state.board[row][col],
        revealedTiles,
        revealedCount: state.revealedCount,
        currentMultiplier: state.currentMultiplier,
        nextMultiplier: state.currentMultiplier,
        payout,
        isGameOver: true,
        minePositions,
        grid: state.board,
        newBalance: autoWinBalance,
      };
    }

    await this.saveSession(userId, state);

    return {
      x,
      y,
      isMine: false,
      value: state.board[row][col],
      revealedTiles,
      revealedCount: state.revealedCount,
      currentMultiplier: state.currentMultiplier,
      nextMultiplier,
      payout: Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000,
      isGameOver: false,
    };
  }

  /**
   * Toggle a flag on a tile.
   */
  async flag(
    userId: string,
    x: number,
    y: number,
  ): Promise<{
    x: number;
    y: number;
    isFlagged: boolean;
    flags: boolean[][];
  }> {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      throw new GameError('INVALID_POSITION', `Position must be in range 0-${GRID_SIZE - 1}.`);
    }

    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      throw new GameError('NO_ACTIVE_GAME', 'No active Minesweeper game found.');
    }

    const row = y;
    const col = x;

    if (state.revealed[row][col]) {
      throw new GameError('ALREADY_REVEALED', 'Cannot flag an already-revealed tile.');
    }

    state.flags[row][col] = !state.flags[row][col];
    await this.saveSession(userId, state);

    return {
      x,
      y,
      isFlagged: state.flags[row][col],
      flags: state.flags,
    };
  }

  /**
   * Cash out the current game at the current multiplier.
   */
  async cashout(userId: string): Promise<{
    payout: number;
    multiplier: number;
    revealedCount: number;
    minePositions: [number, number][];
    grid: number[][];
    currency: string;
    newBalance: number;
  }> {
    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      throw new GameError('NO_ACTIVE_GAME', 'No active Minesweeper game found.');
    }

    if (state.revealedCount === 0) {
      throw new GameError('NO_REVEALS', 'You must reveal at least one tile before cashing out.');
    }

    const payout =
      Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000;

    await this.creditWinnings(userId, payout, state.currency);
    await this.incrementNonce(userId);

    state.isActive = false;
    await this.saveSession(userId, state);

    const minePositions = this.extractMinePositions(state.board);

    await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: state.betAmount,
      payout,
      multiplier: state.currentMultiplier,
      result: {
        mineCount: state.mineCount,
        minePositions,
        revealedCount: state.revealedCount,
        hitMine: false,
        cashedOut: true,
      },
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    await this.deleteSession(userId);

    const cashoutBalance = await this.getBalance(userId, state.currency);

    return {
      payout,
      multiplier: state.currentMultiplier,
      revealedCount: state.revealedCount,
      minePositions,
      grid: state.board,
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
    revealed?: boolean[][];
    flags?: boolean[][];
    revealedCount?: number;
    currentMultiplier?: number;
    betAmount?: number;
    currency?: string;
    potentialPayout?: number;
    serverSeedHash?: string;
    // Send revealed tile values so player can see their numbers
    revealedValues?: { x: number; y: number; value: number }[];
  } | null> {
    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      return { isActive: false };
    }

    // Extract revealed tile values
    const revealedValues: { x: number; y: number; value: number }[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (state.revealed[r][c]) {
          revealedValues.push({ x: c, y: r, value: state.board[r][c] });
        }
      }
    }

    return {
      isActive: true,
      roundId: state.roundId,
      mineCount: state.mineCount,
      revealed: state.revealed,
      flags: state.flags,
      revealedCount: state.revealedCount,
      currentMultiplier: state.currentMultiplier,
      betAmount: state.betAmount,
      currency: state.currency,
      potentialPayout:
        Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000,
      serverSeedHash: state.serverSeedHash,
      revealedValues,
    };
  }

  // =======================================================================
  // Multiplier calculation
  // =======================================================================

  /**
   * Progressive multiplier based on combinatorics.
   * After revealing `k` safe tiles out of totalSafe = (64 - mineCount):
   * multiplier = (1 - houseEdge) * Product_{i=0}^{k-1} [ (64 - i) / (64 - mineCount - i) ]
   */
  private calculateMultiplier(mineCount: number, revealedCount: number): number {
    if (revealedCount === 0) return 1.0;

    let multiplier = 1.0;

    for (let i = 0; i < revealedCount; i++) {
      const totalRemaining = TOTAL_TILES - i;
      const safeRemaining = TOTAL_TILES - mineCount - i;
      if (safeRemaining <= 0) break;
      multiplier *= totalRemaining / safeRemaining;
    }

    // Apply house edge
    multiplier *= 1 - this.houseEdge;

    return Math.floor(multiplier * 10000) / 10000;
  }

  // =======================================================================
  // Helpers
  // =======================================================================

  private extractMinePositions(board: number[][]): [number, number][] {
    const positions: [number, number][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (board[r][c] === -1) {
          positions.push([r, c]);
        }
      }
    }
    return positions;
  }

  // =======================================================================
  // Redis session management
  // =======================================================================

  private async saveSession(userId: string, state: MinesweeperState): Promise<void> {
    const key = MinesweeperGame.REDIS_PREFIX + userId;
    await redis.set(key, JSON.stringify(state), 'EX', MinesweeperGame.TTL);
  }

  private async getSession(userId: string): Promise<MinesweeperState | null> {
    const key = MinesweeperGame.REDIS_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as MinesweeperState;
  }

  private async deleteSession(userId: string): Promise<void> {
    const key = MinesweeperGame.REDIS_PREFIX + userId;
    await redis.del(key);
  }
}

export const minesweeperGame = new MinesweeperGame();
export default minesweeperGame;
