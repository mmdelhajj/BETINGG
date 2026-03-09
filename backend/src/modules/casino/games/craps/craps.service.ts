import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Craps (Simplified Single-Roll Casino Craps)
// ---------------------------------------------------------------------------
// Two dice rolled simultaneously. Implements common craps bet types as a
// single-roll game for casino simplicity. Provably fair determines both dice.
// ---------------------------------------------------------------------------

type CrapsBetType =
  | 'pass'          // Pass Line: 7 or 11 wins (2x), 2/3/12 loses
  | 'dontpass'      // Don't Pass: 2 or 3 wins (2x), 12 pushes, 7/11 loses
  | 'come'          // Same as pass line
  | 'dontcome'      // Same as don't pass
  | 'field'         // Field: 2,3,4,9,10,11,12 win. 2 pays 3x, 12 pays 3x, rest 2x
  | 'any7'          // Any Seven: total=7 pays 5x
  | 'any_craps'     // Any Craps: 2,3,12 pays 8x
  | 'craps2'        // Craps 2 (Aces/Snake Eyes): total=2 pays 31x
  | 'craps3'        // Craps 3 (Ace-Deuce): total=3 pays 16x
  | 'craps12'       // Craps 12 (Boxcars/Midnight): total=12 pays 31x
  | 'yo11'          // Yo-Eleven: total=11 pays 16x
  | 'hardway4'      // Hard 4 (2+2): pays 8x
  | 'hardway6'      // Hard 6 (3+3): pays 10x
  | 'hardway8'      // Hard 8 (4+4): pays 10x
  | 'hardway10'     // Hard 10 (5+5): pays 8x
  | 'place4'        // Place 4: total=4 pays 9:5 → 2.8x
  | 'place5'        // Place 5: total=5 pays 7:5 → 2.4x
  | 'place6'        // Place 6: total=6 pays 7:6 → 2.167x
  | 'place8'        // Place 8: total=8 pays 7:6 → 2.167x
  | 'place9'        // Place 9: total=9 pays 7:5 → 2.4x
  | 'place10';      // Place 10: total=10 pays 9:5 → 2.8x

interface CrapsBet {
  type: CrapsBetType;
  amount: number;
}

export interface CrapsOptions {
  bets: CrapsBet[];
}

// Payout multipliers for each bet type (total return including original bet)
const CRAPS_PAYOUTS: Record<CrapsBetType, number | null> = {
  pass: 2,
  dontpass: 2,
  come: 2,
  dontcome: 2,
  field: null,       // variable: 2x or 3x depending on number
  any7: 5,
  any_craps: 8,
  craps2: 31,
  craps3: 16,
  craps12: 31,
  yo11: 16,
  hardway4: 8,
  hardway6: 10,
  hardway8: 10,
  hardway10: 8,
  place4: 2.8,      // 9:5 + original
  place5: 2.4,      // 7:5 + original
  place6: 2.167,    // 7:6 + original
  place8: 2.167,    // 7:6 + original
  place9: 2.4,      // 7:5 + original
  place10: 2.8,     // 9:5 + original
};

const VALID_BET_TYPES: CrapsBetType[] = [
  'pass', 'dontpass', 'come', 'dontcome', 'field',
  'any7', 'any_craps', 'craps2', 'craps3', 'craps12', 'yo11',
  'hardway4', 'hardway6', 'hardway8', 'hardway10',
  'place4', 'place5', 'place6', 'place8', 'place9', 'place10',
];

export class CrapsGame extends BaseGame {
  readonly name = 'Craps';
  readonly slug = 'craps';
  readonly houseEdge = 0.014; // ~1.4% for pass line (main bet)
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as CrapsOptions;

    if (!options || !Array.isArray(options.bets) || options.bets.length === 0) {
      throw new GameError('INVALID_OPTIONS', 'Must provide an array of bets.');
    }

    // Validate individual bets and calculate total stake
    let totalStake = 0;
    for (const b of options.bets) {
      this.validateCrapsBet(b);
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

    // Generate 2 dice results from provably fair service
    const rawResults = this.fairService.generateMultipleResults(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
      2,
    );

    const dice: [number, number] = [
      Math.floor(rawResults[0] * 6) + 1,
      Math.floor(rawResults[1] * 6) + 1,
    ];
    const total = dice[0] + dice[1];
    const isHardway = dice[0] === dice[1];

    // Determine the "phase" for display purposes
    let phase: string;
    if ([7, 11].includes(total)) {
      phase = 'natural';
    } else if ([2, 3, 12].includes(total)) {
      phase = 'craps';
    } else {
      phase = 'point';
    }

    // Deduct total stake
    await this.deductBalance(userId, totalStake, bet.currency);

    // Evaluate each bet
    let totalPayout = 0;
    const betResults: Array<{
      type: CrapsBetType;
      amount: number;
      isWin: boolean;
      isPush: boolean;
      payout: number;
      multiplier: number;
    }> = [];

    for (const b of options.bets) {
      const evaluation = this.evaluateBet(b, dice, total, isHardway);
      totalPayout += evaluation.payout;

      betResults.push({
        type: b.type,
        amount: b.amount,
        isWin: evaluation.isWin,
        isPush: evaluation.isPush,
        payout: evaluation.payout,
        multiplier: evaluation.multiplier,
      });
    }

    // Credit winnings (includes pushes which return the bet)
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
        phase,
        isHardway,
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
        phase,
        point: phase === 'point' ? total : null,
        isHardway,
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

  private validateCrapsBet(b: CrapsBet): void {
    if (!b.type || !VALID_BET_TYPES.includes(b.type)) {
      throw new GameError('INVALID_BET_TYPE', `Invalid bet type: ${b.type}`);
    }

    if (typeof b.amount !== 'number' || b.amount <= 0) {
      throw new GameError('INVALID_BET_AMOUNT', 'Each bet must have a positive amount.');
    }
  }

  // =======================================================================
  // Bet evaluation
  // =======================================================================

  private evaluateBet(
    b: CrapsBet,
    dice: [number, number],
    total: number,
    isHardway: boolean,
  ): { isWin: boolean; isPush: boolean; payout: number; multiplier: number } {
    switch (b.type) {
      // --- PASS LINE / COME ---
      case 'pass':
      case 'come': {
        if (total === 7 || total === 11) {
          return { isWin: true, isPush: false, payout: b.amount * 2, multiplier: 2 };
        }
        if (total === 2 || total === 3 || total === 12) {
          return { isWin: false, isPush: false, payout: 0, multiplier: 0 };
        }
        // Point numbers (4,5,6,8,9,10): in simplified single-roll, these lose
        // because there's no second roll to hit the point.
        // However, for a more fun game, we pay a reduced amount for "establishing a point"
        // We'll treat this as a push (bet returned) for better gameplay
        return { isWin: false, isPush: true, payout: b.amount, multiplier: 1 };
      }

      // --- DON'T PASS / DON'T COME ---
      case 'dontpass':
      case 'dontcome': {
        if (total === 2 || total === 3) {
          return { isWin: true, isPush: false, payout: b.amount * 2, multiplier: 2 };
        }
        if (total === 12) {
          // Bar 12: push
          return { isWin: false, isPush: true, payout: b.amount, multiplier: 1 };
        }
        if (total === 7 || total === 11) {
          return { isWin: false, isPush: false, payout: 0, multiplier: 0 };
        }
        // Point numbers: push in single-roll mode
        return { isWin: false, isPush: true, payout: b.amount, multiplier: 1 };
      }

      // --- FIELD ---
      case 'field': {
        if (total === 2 || total === 12) {
          // Double pay
          return { isWin: true, isPush: false, payout: b.amount * 3, multiplier: 3 };
        }
        if ([3, 4, 9, 10, 11].includes(total)) {
          return { isWin: true, isPush: false, payout: b.amount * 2, multiplier: 2 };
        }
        return { isWin: false, isPush: false, payout: 0, multiplier: 0 };
      }

      // --- ANY SEVEN ---
      case 'any7': {
        const isWin = total === 7;
        return { isWin, isPush: false, payout: isWin ? b.amount * 5 : 0, multiplier: isWin ? 5 : 0 };
      }

      // --- ANY CRAPS ---
      case 'any_craps': {
        const isWin = total === 2 || total === 3 || total === 12;
        return { isWin, isPush: false, payout: isWin ? b.amount * 8 : 0, multiplier: isWin ? 8 : 0 };
      }

      // --- SPECIFIC CRAPS ---
      case 'craps2': {
        const isWin = total === 2;
        return { isWin, isPush: false, payout: isWin ? b.amount * 31 : 0, multiplier: isWin ? 31 : 0 };
      }
      case 'craps3': {
        const isWin = total === 3;
        return { isWin, isPush: false, payout: isWin ? b.amount * 16 : 0, multiplier: isWin ? 16 : 0 };
      }
      case 'craps12': {
        const isWin = total === 12;
        return { isWin, isPush: false, payout: isWin ? b.amount * 31 : 0, multiplier: isWin ? 31 : 0 };
      }

      // --- YO-ELEVEN ---
      case 'yo11': {
        const isWin = total === 11;
        return { isWin, isPush: false, payout: isWin ? b.amount * 16 : 0, multiplier: isWin ? 16 : 0 };
      }

      // --- HARDWAYS ---
      case 'hardway4': {
        const isWin = total === 4 && isHardway; // 2+2
        return { isWin, isPush: false, payout: isWin ? b.amount * 8 : 0, multiplier: isWin ? 8 : 0 };
      }
      case 'hardway6': {
        const isWin = total === 6 && isHardway; // 3+3
        return { isWin, isPush: false, payout: isWin ? b.amount * 10 : 0, multiplier: isWin ? 10 : 0 };
      }
      case 'hardway8': {
        const isWin = total === 8 && isHardway; // 4+4
        return { isWin, isPush: false, payout: isWin ? b.amount * 10 : 0, multiplier: isWin ? 10 : 0 };
      }
      case 'hardway10': {
        const isWin = total === 10 && isHardway; // 5+5
        return { isWin, isPush: false, payout: isWin ? b.amount * 8 : 0, multiplier: isWin ? 8 : 0 };
      }

      // --- PLACE BETS ---
      case 'place4': {
        const isWin = total === 4;
        return {
          isWin,
          isPush: false,
          payout: isWin ? Math.round(b.amount * 2.8 * 100) / 100 : 0,
          multiplier: isWin ? 2.8 : 0,
        };
      }
      case 'place5': {
        const isWin = total === 5;
        return {
          isWin,
          isPush: false,
          payout: isWin ? Math.round(b.amount * 2.4 * 100) / 100 : 0,
          multiplier: isWin ? 2.4 : 0,
        };
      }
      case 'place6': {
        const isWin = total === 6;
        return {
          isWin,
          isPush: false,
          payout: isWin ? Math.round(b.amount * (7 / 6 + 1) * 100) / 100 : 0,
          multiplier: isWin ? Math.round((7 / 6 + 1) * 1000) / 1000 : 0,
        };
      }
      case 'place8': {
        const isWin = total === 8;
        return {
          isWin,
          isPush: false,
          payout: isWin ? Math.round(b.amount * (7 / 6 + 1) * 100) / 100 : 0,
          multiplier: isWin ? Math.round((7 / 6 + 1) * 1000) / 1000 : 0,
        };
      }
      case 'place9': {
        const isWin = total === 9;
        return {
          isWin,
          isPush: false,
          payout: isWin ? Math.round(b.amount * 2.4 * 100) / 100 : 0,
          multiplier: isWin ? 2.4 : 0,
        };
      }
      case 'place10': {
        const isWin = total === 10;
        return {
          isWin,
          isPush: false,
          payout: isWin ? Math.round(b.amount * 2.8 * 100) / 100 : 0,
          multiplier: isWin ? 2.8 : 0,
        };
      }

      default:
        return { isWin: false, isPush: false, payout: 0, multiplier: 0 };
    }
  }
}

export const crapsGame = new CrapsGame();
export default crapsGame;
