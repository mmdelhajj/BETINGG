import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Plinko Game
// ---------------------------------------------------------------------------
// Ball drops through a grid of pegs. At each row, the ball goes left (0) or
// right (1) determined by provably fair randomness. The final bucket it
// lands in determines the multiplier.
// ---------------------------------------------------------------------------

type PlinkoRisk = 'low' | 'medium' | 'high';
type PlinkoRows = 8 | 12 | 16;

export interface PlinkoOptions {
  rows: PlinkoRows;
  risk: PlinkoRisk;
}

// Multiplier tables indexed by risk and row count.
// Each array has (rows + 1) entries corresponding to the final bucket positions.
const MULTIPLIER_TABLES: Record<PlinkoRisk, Record<PlinkoRows, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export class PlinkoGame extends BaseGame {
  readonly name = 'Plinko';
  readonly slug = 'plinko';
  readonly houseEdge = 0.02;
  readonly minBet = 0.01;
  readonly maxBet = 10000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as PlinkoOptions;

    // Validate options
    if (!options || !options.rows || !options.risk) {
      throw new GameError('INVALID_OPTIONS', 'Must provide rows (8|12|16) and risk (low|medium|high).');
    }

    const validRows: PlinkoRows[] = [8, 12, 16];
    const validRisks: PlinkoRisk[] = ['low', 'medium', 'high'];

    if (!validRows.includes(options.rows)) {
      throw new GameError('INVALID_ROWS', 'Rows must be 8, 12, or 16.');
    }
    if (!validRisks.includes(options.risk)) {
      throw new GameError('INVALID_RISK', 'Risk must be low, medium, or high.');
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get user seeds
    const seeds = await this.getUserSeeds(userId);

    // Generate path using provably fair results
    const randomValues = this.fairService.generateMultipleResults(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
      options.rows,
    );

    // Build path: each random determines left (0) or right (1)
    const path: number[] = [];
    let position = 0;

    for (let row = 0; row < options.rows; row++) {
      const direction = randomValues[row] < 0.5 ? 0 : 1; // 0 = left, 1 = right
      path.push(direction);
      position += direction;
    }

    // position now equals the bucket index (0 to rows)
    const bucketIndex = position;
    const multiplierTable = MULTIPLIER_TABLES[options.risk][options.rows];
    const multiplier = multiplierTable[bucketIndex];

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    // Calculate payout
    const payout = Math.floor(bet.amount * multiplier * 100000000) / 100000000;

    // Credit if payout > 0
    if (payout > 0) {
      await this.creditWinnings(userId, payout, bet.currency);
    }

    // Increment nonce
    await this.incrementNonce(userId);

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: bet.amount,
      payout,
      multiplier,
      result: {
        rows: options.rows,
        risk: options.risk,
        path,
        bucketIndex,
        multiplier,
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
      betAmount: bet.amount,
      payout,
      profit: payout - bet.amount,
      multiplier,
      result: {
        rows: options.rows,
        risk: options.risk,
        path,
        bucketIndex,
        multiplier,
        multiplierTable,
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

export const plinkoGame = new PlinkoGame();
export default plinkoGame;
