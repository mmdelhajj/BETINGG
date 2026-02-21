import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// European Roulette Game
// ---------------------------------------------------------------------------
// Single zero (0-36). Provably fair determines the winning number.
// Supports all standard bet types with correct payouts.
// ---------------------------------------------------------------------------

// Red numbers on a European wheel
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const BLACK_NUMBERS = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

type RouletteBetType =
  | 'straight'   // single number, 35:1
  | 'split'      // 2 adjacent numbers, 17:1
  | 'street'     // row of 3, 11:1
  | 'corner'     // 4 numbers, 8:1
  | 'line'       // 2 rows of 3 (6 numbers), 5:1
  | 'dozen'      // 1st/2nd/3rd 12, 2:1
  | 'column'     // column of 12, 2:1
  | 'red'        // 1:1
  | 'black'      // 1:1
  | 'odd'        // 1:1
  | 'even'       // 1:1
  | 'high'       // 19-36, 1:1
  | 'low';       // 1-18, 1:1

interface RouletteBet {
  type: RouletteBetType;
  numbers?: number[];  // for straight, split, street, corner, line
  amount: number;
}

export interface RouletteOptions {
  bets: RouletteBet[];
}

// Payout ratios (winning pays N to 1, so total return = bet + bet*N)
const PAYOUT_RATIOS: Record<RouletteBetType, number> = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  line: 5,
  dozen: 2,
  column: 2,
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  high: 1,
  low: 1,
};

export class RouletteGame extends BaseGame {
  readonly name = 'Roulette';
  readonly slug = 'roulette';
  readonly houseEdge = 0.027; // European: 1/37 ≈ 2.7%
  readonly minBet = 0.01;
  readonly maxBet = 10000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as RouletteOptions;

    if (!options || !Array.isArray(options.bets) || options.bets.length === 0) {
      throw new GameError('INVALID_OPTIONS', 'Must provide an array of bets.');
    }

    // Validate individual bets and calculate total stake
    let totalStake = 0;
    for (const b of options.bets) {
      if (!b.type || !PAYOUT_RATIOS.hasOwnProperty(b.type)) {
        throw new GameError('INVALID_BET_TYPE', `Invalid bet type: ${b.type}`);
      }
      if (typeof b.amount !== 'number' || b.amount <= 0) {
        throw new GameError('INVALID_BET_AMOUNT', 'Each bet must have a positive amount.');
      }
      this.validateBetNumbers(b);
      totalStake += b.amount;
    }

    if (totalStake < this.minBet) {
      throw new GameError('BET_TOO_LOW', `Total bet must be at least ${this.minBet}.`);
    }
    if (totalStake > this.maxBet) {
      throw new GameError('BET_TOO_HIGH', `Total bet must not exceed ${this.maxBet}.`);
    }

    await this.validateBet(userId, totalStake, bet.currency);

    // Get user seeds
    const seeds = await this.getUserSeeds(userId);

    // Generate result: number 0-36
    const rawResult = this.fairService.generateResult(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );
    const winningNumber = Math.floor(rawResult * 37); // 0-36

    // Deduct total stake
    await this.deductBalance(userId, totalStake, bet.currency);

    // Evaluate each bet
    let totalPayout = 0;
    const betResults: Array<{
      type: RouletteBetType;
      numbers?: number[];
      amount: number;
      isWin: boolean;
      payout: number;
    }> = [];

    for (const b of options.bets) {
      const isWin = this.evaluateBet(b, winningNumber);
      const payout = isWin ? b.amount + b.amount * PAYOUT_RATIOS[b.type] : 0;
      totalPayout += payout;

      betResults.push({
        type: b.type,
        numbers: b.numbers,
        amount: b.amount,
        isWin,
        payout,
      });
    }

    // Credit winnings
    if (totalPayout > 0) {
      await this.creditWinnings(userId, totalPayout, bet.currency);
    }

    // Increment nonce
    await this.incrementNonce(userId);

    const overallMultiplier = totalStake > 0 ? totalPayout / totalStake : 0;

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: totalStake,
      payout: totalPayout,
      multiplier: overallMultiplier,
      result: {
        winningNumber,
        color: this.getColor(winningNumber),
        isOdd: winningNumber > 0 && winningNumber % 2 !== 0,
        isHigh: winningNumber >= 19,
        bets: betResults,
      },
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    // Fetch updated balance to include in response
    const newBalance = await this.getBalance(userId, bet.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: totalStake,
      payout: totalPayout,
      profit: totalPayout - totalStake,
      multiplier: overallMultiplier,
      result: {
        winningNumber,
        color: this.getColor(winningNumber),
        isOdd: winningNumber > 0 && winningNumber % 2 !== 0,
        isHigh: winningNumber >= 19,
        bets: betResults,
      },
      fairness: {
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.nonce,
      },
      newBalance,
    };
  }

  // =======================================================================
  // Bet evaluation
  // =======================================================================

  private evaluateBet(b: RouletteBet, winningNumber: number): boolean {
    switch (b.type) {
      case 'straight':
        return b.numbers !== undefined && b.numbers.includes(winningNumber);

      case 'split':
        return b.numbers !== undefined && b.numbers.includes(winningNumber);

      case 'street':
        return b.numbers !== undefined && b.numbers.includes(winningNumber);

      case 'corner':
        return b.numbers !== undefined && b.numbers.includes(winningNumber);

      case 'line':
        return b.numbers !== undefined && b.numbers.includes(winningNumber);

      case 'dozen': {
        if (!b.numbers || b.numbers.length !== 1) return false;
        const dozen = b.numbers[0]; // 1, 2, or 3
        if (winningNumber === 0) return false;
        if (dozen === 1) return winningNumber >= 1 && winningNumber <= 12;
        if (dozen === 2) return winningNumber >= 13 && winningNumber <= 24;
        if (dozen === 3) return winningNumber >= 25 && winningNumber <= 36;
        return false;
      }

      case 'column': {
        if (!b.numbers || b.numbers.length !== 1) return false;
        const col = b.numbers[0]; // 1, 2, or 3
        if (winningNumber === 0) return false;
        return winningNumber % 3 === col % 3;
      }

      case 'red':
        return RED_NUMBERS.has(winningNumber);

      case 'black':
        return BLACK_NUMBERS.has(winningNumber);

      case 'odd':
        return winningNumber > 0 && winningNumber % 2 !== 0;

      case 'even':
        return winningNumber > 0 && winningNumber % 2 === 0;

      case 'high':
        return winningNumber >= 19 && winningNumber <= 36;

      case 'low':
        return winningNumber >= 1 && winningNumber <= 18;

      default:
        return false;
    }
  }

  private validateBetNumbers(b: RouletteBet): void {
    const requiresNumbers = ['straight', 'split', 'street', 'corner', 'line', 'dozen', 'column'];

    if (requiresNumbers.includes(b.type)) {
      if (!b.numbers || !Array.isArray(b.numbers) || b.numbers.length === 0) {
        throw new GameError(
          'MISSING_NUMBERS',
          `Bet type "${b.type}" requires a numbers array.`,
        );
      }

      // Validate all numbers are in range 0-36
      for (const n of b.numbers) {
        if (!Number.isInteger(n) || n < 0 || n > 36) {
          throw new GameError('INVALID_NUMBER', `Number ${n} is not valid (must be 0-36).`);
        }
      }

      // Validate expected count
      const expectedCounts: Record<string, number> = {
        straight: 1,
        split: 2,
        street: 3,
        corner: 4,
        line: 6,
        dozen: 1,
        column: 1,
      };

      if (b.numbers.length !== expectedCounts[b.type]) {
        throw new GameError(
          'INVALID_NUMBERS_COUNT',
          `Bet type "${b.type}" requires exactly ${expectedCounts[b.type]} number(s).`,
        );
      }
    }
  }

  private getColor(num: number): 'red' | 'black' | 'green' {
    if (num === 0) return 'green';
    if (RED_NUMBERS.has(num)) return 'red';
    return 'black';
  }
}

export const rouletteGame = new RouletteGame();
export default rouletteGame;
