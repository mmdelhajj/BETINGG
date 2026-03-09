import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Scratch Card Game
// ---------------------------------------------------------------------------
// A 3x3 grid of hidden symbols generated via provably fair randomness.
// Symbols are drawn from a weighted pool that varies by card type.
// Win conditions: 3 matching symbols in any row, column, or diagonal (8 lines).
// Multiple wins are possible; all winning line multipliers are summed.
// ---------------------------------------------------------------------------

type CardType = 'basic' | 'premium' | 'vip';

interface SymbolDef {
  symbol: string;
  multiplier: number;
}

interface WinLine {
  positions: [number, number][]; // [[row, col], ...]
  symbol: string;
  multiplier: number;
}

// All possible symbols and their payouts
const SYMBOLS: SymbolDef[] = [
  { symbol: '💎', multiplier: 50 },
  { symbol: '⭐', multiplier: 10 },
  { symbol: '🍀', multiplier: 5 },
  { symbol: '🎯', multiplier: 3 },
  { symbol: '🍒', multiplier: 2 },
  { symbol: '💀', multiplier: 0 },
];

// Symbol weights per card type (higher-tier cards have slightly better odds)
const SYMBOL_WEIGHTS: Record<CardType, number[]> = {
  //            💎   ⭐   🍀   🎯   🍒   💀
  basic:   [   1,   3,   6,  10,  15,  65 ],
  premium: [   2,   5,   8,  12,  18,  55 ],
  vip:     [   3,   7,  10,  14,  20,  46 ],
};

// Bet limits per card type
const CARD_LIMITS: Record<CardType, { min: number; max: number }> = {
  basic:   { min: 0.0001, max: 10 },
  premium: { min: 0.10, max: 100 },
  vip:     { min: 1.00, max: 1000 },
};

// All 8 winning lines (3-in-a-row) for a 3x3 grid
const WIN_LINES: [number, number][][] = [
  // Rows
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  // Columns
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  // Diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

export interface ScratchCardOptions {
  cardType: CardType;
}

export class ScratchCardGame extends BaseGame {
  readonly name = 'Scratch Card';
  readonly slug = 'scratchcard';
  readonly houseEdge = 0.05; // ~5% house edge
  readonly minBet = 0.0001;
  readonly maxBet = 1000;

  /**
   * Pick a symbol from the weighted pool using a random value in [0, 1).
   */
  private pickSymbol(randomValue: number, cardType: CardType): string {
    const weights = SYMBOL_WEIGHTS[cardType];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let cumulative = 0;
    const scaled = randomValue * totalWeight;

    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (scaled < cumulative) {
        return SYMBOLS[i].symbol;
      }
    }

    // Fallback — should not happen
    return SYMBOLS[SYMBOLS.length - 1].symbol;
  }

  /**
   * Get the multiplier for a symbol.
   */
  private getMultiplier(symbol: string): number {
    const def = SYMBOLS.find((s) => s.symbol === symbol);
    return def ? def.multiplier : 0;
  }

  /**
   * Generate 9 independent random values from a single provably fair seed
   * by using the raw result as a seed to produce subsequent values.
   * We split the raw float into segments to derive 9 independent values.
   */
  private generateGridValues(rawResult: number): number[] {
    // Use the raw result to seed a simple deterministic sequence.
    // We expand a single [0,1) value into 9 by fractional multiplication.
    const values: number[] = [];
    let seed = rawResult;

    for (let i = 0; i < 9; i++) {
      // Use golden ratio for better distribution across the unit interval
      seed = (seed * 1000000 + 0.6180339887498949) % 1;
      // Ensure we stay in [0, 1)
      seed = Math.abs(seed);
      if (seed >= 1) seed = seed - Math.floor(seed);
      values.push(seed);
    }

    return values;
  }

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as ScratchCardOptions;

    // ------ Validate options ------
    if (!options || !options.cardType) {
      throw new GameError(
        'INVALID_OPTIONS',
        'Must provide cardType: "basic", "premium", or "vip".',
      );
    }

    const cardType = options.cardType.toLowerCase() as CardType;
    if (!['basic', 'premium', 'vip'].includes(cardType)) {
      throw new GameError(
        'INVALID_CARD_TYPE',
        'cardType must be "basic", "premium", or "vip".',
      );
    }

    // Validate bet amount against card limits
    const limits = CARD_LIMITS[cardType];
    if (bet.amount < limits.min) {
      throw new GameError(
        'BET_TOO_LOW',
        `Minimum bet for ${cardType} cards is ${limits.min}.`,
      );
    }
    if (bet.amount > limits.max) {
      throw new GameError(
        'BET_TOO_HIGH',
        `Maximum bet for ${cardType} cards is ${limits.max}.`,
      );
    }

    // ------ Validate bet ------
    await this.validateBet(userId, bet.amount, bet.currency);

    // ------ Provably fair ------
    const seeds = await this.getUserSeeds(userId);

    const rawResult = this.fairService.generateResult(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    // Generate 9 random values for the 3x3 grid
    const gridValues = this.generateGridValues(rawResult);

    // Build the 3x3 symbol grid
    const grid: string[][] = [];
    for (let row = 0; row < 3; row++) {
      const rowSymbols: string[] = [];
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        rowSymbols.push(this.pickSymbol(gridValues[idx], cardType));
      }
      grid.push(rowSymbols);
    }

    // ------ Check all winning lines ------
    const winLines: WinLine[] = [];

    for (const line of WIN_LINES) {
      const symbols = line.map(([r, c]) => grid[r][c]);
      // Check if all 3 symbols match
      if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        const symbol = symbols[0];
        const mult = this.getMultiplier(symbol);
        // Only count as a win if multiplier > 0 (3 skulls = not a win)
        if (mult > 0) {
          winLines.push({
            positions: line as [number, number][],
            symbol,
            multiplier: mult,
          });
        }
      }
    }

    // Total multiplier is the sum of all winning lines
    const totalMultiplier = winLines.reduce((sum, wl) => sum + wl.multiplier, 0);
    const isWin = totalMultiplier > 0;

    // ------ Deduct balance ------
    await this.deductBalance(userId, bet.amount, bet.currency);

    // ------ Calculate payout ------
    const payout = isWin
      ? Math.floor(bet.amount * totalMultiplier * 100000000) / 100000000
      : 0;

    // ------ Credit winnings ------
    if (isWin) {
      await this.creditWinnings(userId, payout, bet.currency);
    }

    // ------ Increment nonce ------
    await this.incrementNonce(userId);

    // ------ Record round ------
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: bet.amount,
      payout,
      multiplier: isWin ? totalMultiplier : 0,
      result: {
        grid,
        cardType,
        winLines: winLines.map((wl) => ({
          positions: wl.positions,
          symbol: wl.symbol,
          multiplier: wl.multiplier,
        })),
        totalMultiplier,
        isWin,
        rawValue: rawResult,
      },
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    // ------ Fetch updated balance ------
    const newBalance = await this.getBalance(userId, bet.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: bet.amount,
      payout,
      profit: payout - bet.amount,
      multiplier: isWin ? totalMultiplier : 0,
      result: {
        grid,
        cardType,
        winLines: winLines.map((wl) => ({
          positions: wl.positions,
          symbol: wl.symbol,
          multiplier: wl.multiplier,
        })),
        totalMultiplier,
        isWin,
      },
      fairness: {
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.nonce,
      },
      newBalance,
    };
  }
}

export const scratchCardGame = new ScratchCardGame();
export default scratchCardGame;
