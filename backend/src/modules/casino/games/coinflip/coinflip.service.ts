import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Coinflip Game
// ---------------------------------------------------------------------------
// Simple heads or tails. Provably fair result < 0.5 = heads, >= 0.5 = tails.
// Win payout: stake * 1.94 (3% house edge per side).
// ---------------------------------------------------------------------------

type CoinChoice = 'heads' | 'tails';

export interface CoinflipOptions {
  choice: CoinChoice;
}

export class CoinflipGame extends BaseGame {
  readonly name = 'Coinflip';
  readonly slug = 'coinflip';
  readonly houseEdge = 0.03;
  readonly minBet = 0.01;
  readonly maxBet = 10000;

  private static readonly WIN_MULTIPLIER = 1.94; // (1 - 0.03) * 2

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as CoinflipOptions;

    if (!options || !options.choice) {
      throw new GameError('INVALID_OPTIONS', 'Must provide choice: "heads" or "tails".');
    }

    const choice = options.choice.toLowerCase() as CoinChoice;
    if (choice !== 'heads' && choice !== 'tails') {
      throw new GameError('INVALID_CHOICE', 'Choice must be "heads" or "tails".');
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

    const coinResult: CoinChoice = rawResult < 0.5 ? 'heads' : 'tails';
    const isWin = coinResult === choice;

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    // Calculate payout
    const multiplier = isWin ? CoinflipGame.WIN_MULTIPLIER : 0;
    const payout = isWin
      ? Math.floor(bet.amount * CoinflipGame.WIN_MULTIPLIER * 100000000) / 100000000
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
        choice,
        coinResult,
        rawValue: rawResult,
        isWin,
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
        choice,
        coinResult,
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

export const coinflipGame = new CoinflipGame();
export default coinflipGame;
