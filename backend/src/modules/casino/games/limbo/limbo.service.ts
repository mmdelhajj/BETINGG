import crypto from 'crypto';
import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// LimboGame
// ---------------------------------------------------------------------------

export class LimboGame extends BaseGame {
  readonly name = 'Limbo';
  readonly slug = 'limbo';
  readonly houseEdge = 0.01;
  readonly minBet = 0.01;
  readonly maxBet = 10000;

  private static readonly MIN_TARGET = 1.01;
  private static readonly MAX_TARGET = 1_000_000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const targetMultiplier = (options as { targetMultiplier?: number })?.targetMultiplier;

    // Validate target multiplier
    if (targetMultiplier === undefined || targetMultiplier === null) {
      throw new GameError('MISSING_TARGET', 'targetMultiplier is required.');
    }
    if (typeof targetMultiplier !== 'number' || !isFinite(targetMultiplier)) {
      throw new GameError('INVALID_TARGET', 'targetMultiplier must be a valid number.');
    }
    if (targetMultiplier < LimboGame.MIN_TARGET) {
      throw new GameError('TARGET_TOO_LOW', `Minimum target multiplier is ${LimboGame.MIN_TARGET}x.`);
    }
    if (targetMultiplier > LimboGame.MAX_TARGET) {
      throw new GameError('TARGET_TOO_HIGH', `Maximum target multiplier is ${LimboGame.MAX_TARGET}x.`);
    }

    // Validate bet amount
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate result using crash-like formula
    // Result = max(1.00, (1 - houseEdge) * 2^32 / (2^32 - hashInt))
    const resultMultiplier = this.generateLimboResult(serverSeed, clientSeed, nonce);

    // Win if result >= target
    const isWin = resultMultiplier >= targetMultiplier;
    const payout = isWin ? amount * targetMultiplier : 0;
    const multiplier = isWin ? targetMultiplier : 0;
    const profit = payout - amount;

    // Win probability = (1 - houseEdge) / target
    const winChance = ((1 - this.houseEdge) / targetMultiplier) * 100;

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Credit winnings if won
    if (payout > 0) {
      await this.creditWinnings(userId, payout, currency);
    }

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: amount,
      payout,
      multiplier,
      result: {
        targetMultiplier,
        resultMultiplier,
        isWin,
        winChance: Math.round(winChance * 100) / 100,
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
      payout,
      profit,
      multiplier,
      result: {
        targetMultiplier,
        resultMultiplier,
        isWin,
        winChance: Math.round(winChance * 100) / 100,
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
      newBalance,
    };
  }

  /**
   * Generate a Limbo result multiplier using the crash-point formula.
   * Result = max(1.00, (1 - houseEdge) * 2^32 / (2^32 - hashInt))
   *
   * This produces a result with the correct probability distribution:
   * P(result >= x) = (1 - houseEdge) / x  for x >= 1
   */
  private generateLimboResult(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
  ): number {
    const hmac = crypto
      .createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');

    const h = parseInt(hmac.substring(0, 8), 16);
    const e = Math.pow(2, 32);

    // Avoid division by zero when h = 2^32 - 1 (maps to 1.00)
    if (h === 0xFFFFFFFF) {
      return 1.0;
    }

    const result = ((1 - this.houseEdge) * e) / (e - h);
    // Floor to 2 decimal places
    return Math.max(1.0, Math.floor(result * 100) / 100);
  }
}

export const limboGame = new LimboGame();
export default limboGame;
