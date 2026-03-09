import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Symbol definitions
// ---------------------------------------------------------------------------

interface SlotSymbol {
  id: number;
  name: string;
  icon: string;
  weight: number;
  payouts: Record<number, number>; // count => multiplier (3, 4, 5 of a kind)
  isWild: boolean;
  isScatter: boolean;
}

const SYMBOLS: SlotSymbol[] = [
  {
    id: 0, name: 'Wild', icon: 'wild',
    weight: 2,
    payouts: { 3: 10, 4: 50, 5: 200 },
    isWild: true, isScatter: false,
  },
  {
    id: 1, name: 'Scatter', icon: 'scatter',
    weight: 3,
    payouts: { 3: 5, 4: 20, 5: 100 },
    isWild: false, isScatter: true,
  },
  {
    id: 2, name: 'Diamond', icon: 'diamond',
    weight: 5,
    payouts: { 3: 10, 4: 25, 5: 50 },
    isWild: false, isScatter: false,
  },
  {
    id: 3, name: 'Seven', icon: 'seven',
    weight: 8,
    payouts: { 3: 5, 4: 12, 5: 25 },
    isWild: false, isScatter: false,
  },
  {
    id: 4, name: 'Bell', icon: 'bell',
    weight: 10,
    payouts: { 3: 3, 4: 8, 5: 15 },
    isWild: false, isScatter: false,
  },
  {
    id: 5, name: 'Cherry', icon: 'cherry',
    weight: 12,
    payouts: { 3: 2, 4: 5, 5: 10 },
    isWild: false, isScatter: false,
  },
  {
    id: 6, name: 'Orange', icon: 'orange',
    weight: 15,
    payouts: { 3: 1.5, 4: 4, 5: 8 },
    isWild: false, isScatter: false,
  },
  {
    id: 7, name: 'Lemon', icon: 'lemon',
    weight: 20,
    payouts: { 3: 1, 4: 3, 5: 5 },
    isWild: false, isScatter: false,
  },
  {
    id: 8, name: 'Bar', icon: 'bar',
    weight: 25,
    payouts: { 3: 0.5, 4: 1.5, 5: 3 },
    isWild: false, isScatter: false,
  },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0); // 100

// ---------------------------------------------------------------------------
// 20 payline definitions for a 5-reel x 3-row grid
// Grid layout (reel, row):
//   [0,0] [1,0] [2,0] [3,0] [4,0]   row 0 (top)
//   [0,1] [1,1] [2,1] [3,1] [4,1]   row 1 (middle)
//   [0,2] [1,2] [2,2] [3,2] [4,2]   row 2 (bottom)
//
// Each payline is an array of 5 row indices (one per reel)
// ---------------------------------------------------------------------------

const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],  // 1:  middle straight
  [0, 0, 0, 0, 0],  // 2:  top straight
  [2, 2, 2, 2, 2],  // 3:  bottom straight
  [0, 1, 2, 1, 0],  // 4:  V shape
  [2, 1, 0, 1, 2],  // 5:  inverted V
  [0, 0, 1, 2, 2],  // 6:  top-left to bottom-right diagonal
  [2, 2, 1, 0, 0],  // 7:  bottom-left to top-right diagonal
  [1, 0, 0, 0, 1],  // 8:  top plateau
  [1, 2, 2, 2, 1],  // 9:  bottom plateau
  [0, 1, 1, 1, 0],  // 10: shallow V
  [2, 1, 1, 1, 2],  // 11: shallow inverted V
  [1, 0, 1, 0, 1],  // 12: zigzag top
  [1, 2, 1, 2, 1],  // 13: zigzag bottom
  [0, 1, 0, 1, 0],  // 14: wave top
  [2, 1, 2, 1, 2],  // 15: wave bottom
  [0, 0, 1, 0, 0],  // 16: top dip
  [2, 2, 1, 2, 2],  // 17: bottom dip
  [1, 0, 2, 0, 1],  // 18: wide V
  [1, 2, 0, 2, 1],  // 19: wide inverted V
  [0, 2, 0, 2, 0],  // 20: extreme zigzag
];

// ---------------------------------------------------------------------------
// Valid line selections
// ---------------------------------------------------------------------------

const VALID_LINE_COUNTS = [1, 5, 10, 20];

// ---------------------------------------------------------------------------
// Slots5Game
// ---------------------------------------------------------------------------

export class Slots5Game extends BaseGame {
  readonly name = '5-Reel Slots';
  readonly slug = 'slots5';
  readonly houseEdge = 0.035;
  readonly minBet = 0.0001;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;

    // Parse options
    const lines = options?.lines ?? 20;
    const betPerLine = options?.betPerLine ?? (amount / (typeof lines === 'number' ? lines : 20));

    // Validate line count
    if (!VALID_LINE_COUNTS.includes(lines)) {
      throw new GameError('INVALID_LINES', `Lines must be one of: ${VALID_LINE_COUNTS.join(', ')}`);
    }

    // Calculate total bet
    const totalBet = betPerLine * lines;

    // Validate bet
    await this.validateBet(userId, totalBet, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate 15 random values (5 reels x 3 rows)
    const randoms = this.fairService.generateMultipleResults(serverSeed, clientSeed, nonce, 15);

    // Build 5x3 grid: grid[reel][row]
    const grid: SlotSymbol[][] = [];
    for (let reel = 0; reel < 5; reel++) {
      const column: SlotSymbol[] = [];
      for (let row = 0; row < 3; row++) {
        const idx = reel * 3 + row;
        column.push(this.weightedSelect(randoms[idx]));
      }
      grid.push(column);
    }

    // Count scatters anywhere on the grid
    let scatterCount = 0;
    for (let reel = 0; reel < 5; reel++) {
      for (let row = 0; row < 3; row++) {
        if (grid[reel][row].isScatter) {
          scatterCount++;
        }
      }
    }

    // Determine free spins won
    let freeSpinsWon = 0;
    if (scatterCount >= 5) freeSpinsWon = 30;
    else if (scatterCount >= 4) freeSpinsWon = 20;
    else if (scatterCount >= 3) freeSpinsWon = 10;

    // Check if this is a bonus (free spin) round
    const bonusRound = options?.bonusRound === true;
    const bonusMultiplier = bonusRound ? 3 : 1;

    // Evaluate active paylines
    const activeLines = PAYLINES.slice(0, lines);
    const winLines: {
      line: number;
      symbols: string[];
      positions: number[];
      count: number;
      matchedSymbol: string;
      multiplier: number;
      payout: number;
    }[] = [];

    let totalPayout = 0;

    for (let lineIdx = 0; lineIdx < activeLines.length; lineIdx++) {
      const payline = activeLines[lineIdx];
      const lineSymbols: SlotSymbol[] = payline.map((row, reel) => grid[reel][row]);

      const evalResult = this.evaluatePayline(lineSymbols);

      if (evalResult) {
        const linePayout = betPerLine * evalResult.multiplier * bonusMultiplier;
        totalPayout += linePayout;

        winLines.push({
          line: lineIdx + 1,
          symbols: lineSymbols.map((s) => s.name),
          positions: payline.map((row, reel) => reel * 3 + row),
          count: evalResult.count,
          matchedSymbol: evalResult.symbol.name,
          multiplier: evalResult.multiplier * bonusMultiplier,
          payout: linePayout,
        });
      }
    }

    // Scatter pays independently of paylines (based on total bet)
    if (scatterCount >= 3 && !bonusRound) {
      const scatterSym = SYMBOLS.find((s) => s.isScatter)!;
      const scatterMultiplier = scatterSym.payouts[Math.min(scatterCount, 5)] ?? scatterSym.payouts[5];
      const scatterPayout = totalBet * scatterMultiplier;
      totalPayout += scatterPayout;

      winLines.push({
        line: 0,
        symbols: Array(scatterCount).fill('Scatter'),
        positions: [],
        count: scatterCount,
        matchedSymbol: 'Scatter',
        multiplier: scatterMultiplier,
        payout: scatterPayout,
      });
    }

    const effectiveMultiplier = totalBet > 0 ? totalPayout / totalBet : 0;
    const profit = totalPayout - totalBet;

    // Deduct balance
    await this.deductBalance(userId, totalBet, currency);

    // Credit winnings
    if (totalPayout > 0) {
      await this.creditWinnings(userId, totalPayout, currency);
    }

    // Build grid display (reel-major to row-major for frontend display)
    const gridDisplay: { id: number; name: string; icon: string }[][] = [];
    for (let row = 0; row < 3; row++) {
      const rowArr: { id: number; name: string; icon: string }[] = [];
      for (let reel = 0; reel < 5; reel++) {
        const s = grid[reel][row];
        rowArr.push({ id: s.id, name: s.name, icon: s.icon });
      }
      gridDisplay.push(rowArr);
    }

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: totalBet,
      payout: totalPayout,
      multiplier: effectiveMultiplier,
      result: {
        grid: gridDisplay,
        winLines,
        scatterCount,
        freeSpinsWon,
        totalPayout,
        bonusRound,
      },
      serverSeedHash,
      clientSeed,
      nonce,
    });

    // Increment nonce
    await this.incrementNonce(userId);

    // Fetch updated balance
    const newBalance = await this.getBalance(userId, currency);

    return {
      roundId,
      game: this.slug,
      betAmount: totalBet,
      payout: totalPayout,
      profit,
      multiplier: effectiveMultiplier,
      result: {
        grid: gridDisplay,
        winLines,
        scatterCount,
        freeSpinsWon,
        totalPayout,
        bonusRound,
        betPerLine,
        activeLines: lines,
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
      newBalance,
    };
  }

  // -------------------------------------------------------------------------
  // Weighted symbol selection
  // -------------------------------------------------------------------------

  private weightedSelect(random: number): SlotSymbol {
    let cumulative = 0;
    const threshold = random * TOTAL_WEIGHT;

    for (const symbol of SYMBOLS) {
      cumulative += symbol.weight;
      if (threshold < cumulative) {
        return symbol;
      }
    }

    return SYMBOLS[SYMBOLS.length - 1];
  }

  // -------------------------------------------------------------------------
  // Payline evaluation
  // -------------------------------------------------------------------------

  /**
   * Evaluate a single payline of 5 symbols.
   * Count consecutive matching symbols from left to right.
   * Wild substitutes for any non-scatter symbol.
   * Returns null if no win (need at least 3 of a kind).
   */
  private evaluatePayline(symbols: SlotSymbol[]): {
    symbol: SlotSymbol;
    count: number;
    multiplier: number;
  } | null {
    // Scatter symbols don't participate in line wins
    // Start from leftmost non-scatter symbol
    const firstNonWild = symbols.find((s) => !s.isWild && !s.isScatter);

    if (!firstNonWild) {
      // All wilds (and/or scatters) - if at least 3 wilds from left, pay as wild
      let wildCount = 0;
      for (const s of symbols) {
        if (s.isWild) wildCount++;
        else break; // Must be consecutive from left
      }
      if (wildCount >= 3) {
        const wildSymbol = SYMBOLS[0]; // Wild
        const multiplier = wildSymbol.payouts[wildCount] ?? wildSymbol.payouts[5];
        return { symbol: wildSymbol, count: wildCount, multiplier };
      }
      return null;
    }

    // Count consecutive matching symbols from left
    // Wild substitutes for firstNonWild, scatter breaks the chain
    let count = 0;
    for (const s of symbols) {
      if (s.isScatter) break; // Scatter breaks payline chain
      if (s.id === firstNonWild.id || s.isWild) {
        count++;
      } else {
        break;
      }
    }

    if (count < 3) return null;

    const cappedCount = Math.min(count, 5);
    const multiplier = firstNonWild.payouts[cappedCount];

    if (!multiplier) return null;

    return { symbol: firstNonWild, count: cappedCount, multiplier };
  }
}

export const slots5Game = new Slots5Game();
export default slots5Game;
