import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Sic Bo (Chinese Dice Game)
// ---------------------------------------------------------------------------
// Three dice rolled simultaneously. Provably fair determines all three dice.
// Supports all standard Sic Bo bet types with correct payouts.
// ---------------------------------------------------------------------------

// Total sum payout multipliers (includes original bet, e.g. 62x means 61:1 + return)
const TOTAL_SUM_PAYOUTS: Record<number, number> = {
  4: 62,
  5: 31,
  6: 18,
  7: 12,
  8: 8,
  9: 7,
  10: 6,
  11: 6,
  12: 6,
  13: 8,
  14: 12,
  15: 18,
  16: 31,
  17: 62,
};

type SicBoBetType =
  | 'small'            // total 4-10, not triple → 2x
  | 'big'              // total 11-17, not triple → 2x
  | 'specific_triple'  // three of a specific number → 180x
  | 'any_triple'       // any triple → 30x
  | 'specific_double'  // at least two of a specific number → 11x
  | 'total'            // specific total sum → varies
  | 'single'           // specific single number (1-6) → 2x/3x/4x based on count
  | 'two_dice_combo';  // specific two-dice combination → 6x

interface SicBoBet {
  type: SicBoBetType;
  value?: number | number[];  // depends on bet type
  amount: number;
}

export interface SicBoOptions {
  bets: SicBoBet[];
}

export class SicBoGame extends BaseGame {
  readonly name = 'Sic Bo';
  readonly slug = 'sicbo';
  readonly houseEdge = 0.029; // ~2.9% average house edge
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as SicBoOptions;

    if (!options || !Array.isArray(options.bets) || options.bets.length === 0) {
      throw new GameError('INVALID_OPTIONS', 'Must provide an array of bets.');
    }

    // Validate individual bets and calculate total stake
    let totalStake = 0;
    for (const b of options.bets) {
      this.validateSicBoBet(b);
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

    // Generate 3 dice results from provably fair service
    const rawResults = this.fairService.generateMultipleResults(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
      3,
    );

    const dice: [number, number, number] = [
      Math.floor(rawResults[0] * 6) + 1,
      Math.floor(rawResults[1] * 6) + 1,
      Math.floor(rawResults[2] * 6) + 1,
    ];
    const total = dice[0] + dice[1] + dice[2];
    const isTriple = dice[0] === dice[1] && dice[1] === dice[2];

    // Deduct total stake
    await this.deductBalance(userId, totalStake, bet.currency);

    // Evaluate each bet
    let totalPayout = 0;
    const betResults: Array<{
      type: SicBoBetType;
      value?: number | number[];
      amount: number;
      isWin: boolean;
      payout: number;
      multiplier: number;
    }> = [];

    for (const b of options.bets) {
      const evaluation = this.evaluateBet(b, dice, total, isTriple);
      totalPayout += evaluation.payout;

      betResults.push({
        type: b.type,
        value: b.value,
        amount: b.amount,
        isWin: evaluation.isWin,
        payout: evaluation.payout,
        multiplier: evaluation.multiplier,
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
        dice,
        total,
        isTriple,
        bets: betResults,
      },
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    // Fetch updated balance
    const newBalance = await this.getBalance(userId, bet.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: totalStake,
      payout: totalPayout,
      profit: totalPayout - totalStake,
      multiplier: overallMultiplier,
      result: {
        dice,
        total,
        isTriple,
        bets: betResults,
        totalPayout,
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
  // Bet validation
  // =======================================================================

  private validateSicBoBet(b: SicBoBet): void {
    const validTypes: SicBoBetType[] = [
      'small', 'big', 'specific_triple', 'any_triple',
      'specific_double', 'total', 'single', 'two_dice_combo',
    ];

    if (!b.type || !validTypes.includes(b.type)) {
      throw new GameError('INVALID_BET_TYPE', `Invalid bet type: ${b.type}`);
    }

    if (typeof b.amount !== 'number' || b.amount <= 0) {
      throw new GameError('INVALID_BET_AMOUNT', 'Each bet must have a positive amount.');
    }

    switch (b.type) {
      case 'small':
      case 'big':
      case 'any_triple':
        // No value needed
        break;

      case 'specific_triple':
        if (typeof b.value !== 'number' || b.value < 1 || b.value > 6 || !Number.isInteger(b.value)) {
          throw new GameError('INVALID_BET_VALUE', 'Specific triple requires a value from 1 to 6.');
        }
        break;

      case 'specific_double':
        if (typeof b.value !== 'number' || b.value < 1 || b.value > 6 || !Number.isInteger(b.value)) {
          throw new GameError('INVALID_BET_VALUE', 'Specific double requires a value from 1 to 6.');
        }
        break;

      case 'total':
        if (typeof b.value !== 'number' || b.value < 4 || b.value > 17 || !Number.isInteger(b.value)) {
          throw new GameError('INVALID_BET_VALUE', 'Total bet requires a value from 4 to 17.');
        }
        break;

      case 'single':
        if (typeof b.value !== 'number' || b.value < 1 || b.value > 6 || !Number.isInteger(b.value)) {
          throw new GameError('INVALID_BET_VALUE', 'Single number bet requires a value from 1 to 6.');
        }
        break;

      case 'two_dice_combo':
        if (
          !Array.isArray(b.value) ||
          b.value.length !== 2 ||
          !Number.isInteger(b.value[0]) ||
          !Number.isInteger(b.value[1]) ||
          b.value[0] < 1 || b.value[0] > 6 ||
          b.value[1] < 1 || b.value[1] > 6 ||
          b.value[0] === b.value[1]
        ) {
          throw new GameError(
            'INVALID_BET_VALUE',
            'Two dice combo requires an array of two different numbers from 1 to 6.',
          );
        }
        break;
    }
  }

  // =======================================================================
  // Bet evaluation
  // =======================================================================

  private evaluateBet(
    b: SicBoBet,
    dice: [number, number, number],
    total: number,
    isTriple: boolean,
  ): { isWin: boolean; payout: number; multiplier: number } {
    switch (b.type) {
      case 'small': {
        const isWin = total >= 4 && total <= 10 && !isTriple;
        return { isWin, payout: isWin ? b.amount * 2 : 0, multiplier: isWin ? 2 : 0 };
      }

      case 'big': {
        const isWin = total >= 11 && total <= 17 && !isTriple;
        return { isWin, payout: isWin ? b.amount * 2 : 0, multiplier: isWin ? 2 : 0 };
      }

      case 'specific_triple': {
        const targetValue = b.value as number;
        const isWin = isTriple && dice[0] === targetValue;
        return { isWin, payout: isWin ? b.amount * 180 : 0, multiplier: isWin ? 180 : 0 };
      }

      case 'any_triple': {
        const isWin = isTriple;
        return { isWin, payout: isWin ? b.amount * 30 : 0, multiplier: isWin ? 30 : 0 };
      }

      case 'specific_double': {
        const targetValue = b.value as number;
        const count = dice.filter((d) => d === targetValue).length;
        const isWin = count >= 2;
        return { isWin, payout: isWin ? b.amount * 11 : 0, multiplier: isWin ? 11 : 0 };
      }

      case 'total': {
        const targetTotal = b.value as number;
        const isWin = total === targetTotal;
        const multiplier = TOTAL_SUM_PAYOUTS[targetTotal] || 0;
        return { isWin, payout: isWin ? b.amount * multiplier : 0, multiplier: isWin ? multiplier : 0 };
      }

      case 'single': {
        const targetValue = b.value as number;
        const count = dice.filter((d) => d === targetValue).length;
        if (count === 0) return { isWin: false, payout: 0, multiplier: 0 };
        // 1 match = 2x, 2 matches = 3x, 3 matches = 4x
        const multiplier = count + 1;
        return { isWin: true, payout: b.amount * multiplier, multiplier };
      }

      case 'two_dice_combo': {
        const combo = b.value as number[];
        const sorted = [...combo].sort((a, b) => a - b);
        const diceSorted = [...dice].sort((a, b) => a - b);
        // Check if the two numbers appear in the dice (any positions)
        let found0 = false;
        let found1 = false;
        const diceUsed = [false, false, false];
        for (let i = 0; i < 3; i++) {
          if (!found0 && !diceUsed[i] && dice[i] === sorted[0]) {
            found0 = true;
            diceUsed[i] = true;
          }
        }
        for (let i = 0; i < 3; i++) {
          if (!found1 && !diceUsed[i] && dice[i] === sorted[1]) {
            found1 = true;
            diceUsed[i] = true;
          }
        }
        const isWin = found0 && found1;
        return { isWin, payout: isWin ? b.amount * 6 : 0, multiplier: isWin ? 6 : 0 };
      }

      default:
        return { isWin: false, payout: 0, multiplier: 0 };
    }
  }
}

export const sicBoGame = new SicBoGame();
export default sicBoGame;
