import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Thimbles / Shell Game
// ---------------------------------------------------------------------------
// Three cups, ball hidden under one. Player guesses which cup.
// Provably fair: result [0,1) * 3, floored = ball position (0, 1, 2).
// Win payout: stake * 2.82 (~6% house edge on 1-in-3 chance).
// ---------------------------------------------------------------------------

export interface ThimblesOptions {
  guess: number; // 0, 1, or 2
  cups?: number; // always 3, included for result
}

export class ThimblesGame extends BaseGame {
  readonly name = 'Thimbles';
  readonly slug = 'thimbles';
  readonly houseEdge = 0.06;
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  private static readonly NUM_CUPS = 3;
  private static readonly WIN_MULTIPLIER = 2.82; // (1 - 0.06) * 3

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as ThimblesOptions;

    if (!options || (options.guess === undefined && (options as any).choice === undefined)) {
      throw new GameError('INVALID_OPTIONS', 'Must provide guess: 0, 1, or 2.');
    }

    const rawGuess = options.guess ?? (options as any).choice;
    const guess = typeof rawGuess === 'string' ? parseInt(rawGuess, 10) : rawGuess;

    if (!Number.isInteger(guess) || guess < 0 || guess >= ThimblesGame.NUM_CUPS) {
      throw new GameError('INVALID_GUESS', 'Guess must be 0, 1, or 2.');
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get user seeds
    const seeds = await this.getUserSeeds(userId);

    // Generate provably fair result
    const rawResult = this.fairService.generateResult(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    const ballPosition = Math.floor(rawResult * ThimblesGame.NUM_CUPS);
    const isWin = ballPosition === guess;

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    // Calculate payout
    const multiplier = isWin ? ThimblesGame.WIN_MULTIPLIER : 0;
    const payout = isWin
      ? Math.floor(bet.amount * ThimblesGame.WIN_MULTIPLIER * 100000000) / 100000000
      : 0;

    // Credit winnings
    if (isWin) {
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
        guess,
        ballPosition,
        rawValue: rawResult,
        isWin,
        cups: ThimblesGame.NUM_CUPS,
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
        guess,
        ballPosition,
        isWin,
        cups: ThimblesGame.NUM_CUPS,
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

export const thimblesGame = new ThimblesGame();
export default thimblesGame;
