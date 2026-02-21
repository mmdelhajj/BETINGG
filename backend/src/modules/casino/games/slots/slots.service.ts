import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Symbol definitions
// ---------------------------------------------------------------------------

interface SlotSymbol {
  id: number;
  name: string;
  icon: string;
  weight: number;
  threeOfKind: number;  // 3-of-a-kind multiplier
  isWild: boolean;
}

const SYMBOLS: SlotSymbol[] = [
  { id: 0, name: 'Cherry',  icon: 'cherry',  weight: 20, threeOfKind: 5,   isWild: true },
  { id: 1, name: 'Lemon',   icon: 'lemon',   weight: 18, threeOfKind: 8,   isWild: false },
  { id: 2, name: 'Orange',  icon: 'orange',  weight: 15, threeOfKind: 12,  isWild: false },
  { id: 3, name: 'Plum',    icon: 'plum',    weight: 12, threeOfKind: 18,  isWild: false },
  { id: 4, name: 'Bell',    icon: 'bell',    weight: 8,  threeOfKind: 30,  isWild: false },
  { id: 5, name: 'Bar',     icon: 'bar',     weight: 5,  threeOfKind: 50,  isWild: false },
  { id: 6, name: 'Seven',   icon: 'seven',   weight: 3,  threeOfKind: 100, isWild: false },
  { id: 7, name: 'Diamond', icon: 'diamond', weight: 1,  threeOfKind: 500, isWild: false },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0); // 82

// 2-of-a-kind pays 20% of 3-of-a-kind
const TWO_OF_KIND_RATIO = 0.2;

// 5 paylines on a 3x3 grid:
// Grid positions:
//  [0][1][2]   row 0 (top)
//  [3][4][5]   row 1 (middle)
//  [6][7][8]   row 2 (bottom)
//
// Payline definitions (using grid position indices):
const PAYLINES: number[][] = [
  [0, 1, 2],  // top row
  [3, 4, 5],  // middle row
  [6, 7, 8],  // bottom row
  [0, 4, 8],  // diagonal top-left to bottom-right
  [6, 4, 2],  // diagonal bottom-left to top-right
];

// ---------------------------------------------------------------------------
// SlotsGame
// ---------------------------------------------------------------------------

export class SlotsGame extends BaseGame {
  readonly name = 'Slots';
  readonly slug = 'slots';
  readonly houseEdge = 0.04;
  readonly minBet = 0.1;
  readonly maxBet = 1000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency } = bet;

    // Validate bet
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate 9 symbols (3x3) using weighted provably fair selection
    const randoms = this.fairService.generateMultipleResults(serverSeed, clientSeed, nonce, 9);
    const grid = randoms.map((r) => this.weightedSelect(r));

    // Arrange into 3x3 for display
    const gridDisplay = [
      [grid[0], grid[1], grid[2]],
      [grid[3], grid[4], grid[5]],
      [grid[6], grid[7], grid[8]],
    ];

    // Check all 5 paylines for matches
    const betPerLine = amount / PAYLINES.length;
    let totalMultiplier = 0;
    const paylineResults: {
      paylineIndex: number;
      positions: number[];
      symbols: string[];
      matchType: string | null;
      multiplier: number;
      payout: number;
    }[] = [];

    for (let pl = 0; pl < PAYLINES.length; pl++) {
      const positions = PAYLINES[pl];
      const lineSymbols = positions.map((pos) => grid[pos]);
      const result = this.evaluatePayline(lineSymbols);

      const linePayout = betPerLine * result.multiplier;
      totalMultiplier += result.multiplier / PAYLINES.length; // Normalized

      paylineResults.push({
        paylineIndex: pl,
        positions,
        symbols: lineSymbols.map((s) => s.name),
        matchType: result.matchType,
        multiplier: result.multiplier,
        payout: linePayout,
      });
    }

    const totalPayout = paylineResults.reduce((sum, pr) => sum + pr.payout, 0);
    const effectiveMultiplier = amount > 0 ? totalPayout / amount : 0;
    const profit = totalPayout - amount;

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Credit winnings
    if (totalPayout > 0) {
      await this.creditWinnings(userId, totalPayout, currency);
    }

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: amount,
      payout: totalPayout,
      multiplier: effectiveMultiplier,
      result: {
        grid: gridDisplay.map((row) =>
          row.map((s) => ({ id: s.id, name: s.name, icon: s.icon })),
        ),
        paylines: paylineResults,
        totalPayout,
      },
      serverSeedHash,
      clientSeed,
      nonce,
    });

    // Increment nonce
    await this.incrementNonce(userId);

    // Fetch updated balance to include in response
    const newBalance = await this.getBalance(userId, currency);

    return {
      roundId,
      game: this.slug,
      betAmount: amount,
      payout: totalPayout,
      profit,
      multiplier: effectiveMultiplier,
      result: {
        grid: gridDisplay.map((row) =>
          row.map((s) => ({ id: s.id, name: s.name, icon: s.icon })),
        ),
        paylines: paylineResults,
        totalPayout,
        betPerLine,
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

  /**
   * Select a symbol using weighted random.
   * @param random - A provably fair random value in [0, 1)
   */
  private weightedSelect(random: number): SlotSymbol {
    let cumulative = 0;
    const threshold = random * TOTAL_WEIGHT;

    for (const symbol of SYMBOLS) {
      cumulative += symbol.weight;
      if (threshold < cumulative) {
        return symbol;
      }
    }

    // Fallback (should not reach here)
    return SYMBOLS[SYMBOLS.length - 1];
  }

  // -------------------------------------------------------------------------
  // Payline evaluation
  // -------------------------------------------------------------------------

  /**
   * Evaluate a single payline of 3 symbols.
   * Cherry is wild and substitutes for any symbol.
   */
  private evaluatePayline(symbols: SlotSymbol[]): {
    matchType: string | null;
    multiplier: number;
  } {
    const [s0, s1, s2] = symbols;

    // Check for 3-of-a-kind (considering wilds)
    const threeMatch = this.checkThreeOfKind(s0, s1, s2);
    if (threeMatch) {
      return {
        matchType: `3x ${threeMatch.name}`,
        multiplier: threeMatch.threeOfKind,
      };
    }

    // Check for 2-of-a-kind on the first two positions (with wild)
    // We check all pairs: (0,1), (0,2), (1,2)
    const twoMatch = this.checkBestTwoOfKind(s0, s1, s2);
    if (twoMatch) {
      return {
        matchType: `2x ${twoMatch.name}`,
        multiplier: twoMatch.threeOfKind * TWO_OF_KIND_RATIO,
      };
    }

    return { matchType: null, multiplier: 0 };
  }

  /**
   * Check if three symbols match (considering Cherry as wild).
   * Returns the matched symbol (the non-wild one), or Cherry if all are Cherry.
   */
  private checkThreeOfKind(s0: SlotSymbol, s1: SlotSymbol, s2: SlotSymbol): SlotSymbol | null {
    // Get the non-wild symbols
    const nonWild = [s0, s1, s2].filter((s) => !s.isWild);

    if (nonWild.length === 0) {
      // All wilds (all cherries) - pay as cherry 3-of-a-kind
      return SYMBOLS[0]; // Cherry
    }

    if (nonWild.length === 1) {
      // Two wilds + one non-wild: matches as the non-wild symbol
      return nonWild[0];
    }

    if (nonWild.length === 2) {
      // One wild + two non-wilds: match only if the two non-wilds are the same
      if (nonWild[0].id === nonWild[1].id) {
        return nonWild[0];
      }
      return null;
    }

    // No wilds: all three must match
    if (s0.id === s1.id && s1.id === s2.id) {
      return s0;
    }

    return null;
  }

  /**
   * Check for the best 2-of-a-kind match in positions.
   * Only pays if at least 2 symbols match (wilds count as matching).
   * Returns the highest-paying 2-of-a-kind match.
   */
  private checkBestTwoOfKind(s0: SlotSymbol, s1: SlotSymbol, s2: SlotSymbol): SlotSymbol | null {
    const pairs: [SlotSymbol, SlotSymbol][] = [
      [s0, s1],
      [s0, s2],
      [s1, s2],
    ];

    let bestMatch: SlotSymbol | null = null;

    for (const [a, b] of pairs) {
      const match = this.checkPairMatch(a, b);
      if (match) {
        if (!bestMatch || match.threeOfKind > bestMatch.threeOfKind) {
          bestMatch = match;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Check if a pair of symbols match (considering wilds).
   */
  private checkPairMatch(a: SlotSymbol, b: SlotSymbol): SlotSymbol | null {
    if (a.isWild && b.isWild) {
      return SYMBOLS[0]; // Both wild = Cherry pair
    }
    if (a.isWild) return b;
    if (b.isWild) return a;
    if (a.id === b.id) return a;
    return null;
  }
}

export const slotsGame = new SlotsGame();
export default slotsGame;
