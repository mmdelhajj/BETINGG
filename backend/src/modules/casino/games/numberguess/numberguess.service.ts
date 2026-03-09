import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Number Guessing Game
// ---------------------------------------------------------------------------
// Player picks a number 1-100, system generates a target number 1-100 using
// provably fair randomness. Payout depends on the distance between the guess
// and the target:
//   Exact match (distance 0) : 95x
//   Within 5   (distance 1-5): 9x
//   Within 10  (distance 6-10): 4x
//   Within 25  (distance 11-25): 1.5x
//   Otherwise  (distance 26+): loss (0x)
// ---------------------------------------------------------------------------

type PayoutTier = 'exact' | 'close' | 'near' | 'warm' | 'miss';

interface TierInfo {
  tier: PayoutTier;
  label: string;
  maxDistance: number;
  multiplier: number;
}

const TIERS: TierInfo[] = [
  { tier: 'exact', label: 'EXACT MATCH!', maxDistance: 0, multiplier: 95 },
  { tier: 'close', label: 'Very Close!', maxDistance: 5, multiplier: 9 },
  { tier: 'near', label: 'Close', maxDistance: 10, multiplier: 4 },
  { tier: 'warm', label: 'Warm', maxDistance: 25, multiplier: 1.5 },
  { tier: 'miss', label: 'Miss', maxDistance: 100, multiplier: 0 },
];

export interface NumberGuessOptions {
  guess: number; // 1-100
}

export class NumberGuessGame extends BaseGame {
  readonly name = 'Number Guess';
  readonly slug = 'numberguess';
  readonly houseEdge = 0.04; // ~4% house edge
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  /**
   * Determine which payout tier a given distance falls into.
   */
  private getTier(distance: number): TierInfo {
    for (const t of TIERS) {
      if (distance <= t.maxDistance) return t;
    }
    return TIERS[TIERS.length - 1]; // miss
  }

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as NumberGuessOptions;

    // ------ Validate options ------
    if (!options || typeof options.guess !== 'number') {
      throw new GameError(
        'INVALID_OPTIONS',
        'Must provide guess (number between 1 and 100).',
      );
    }

    const guess = Math.floor(options.guess);
    if (guess < 1 || guess > 100) {
      throw new GameError(
        'INVALID_GUESS',
        'Guess must be an integer between 1 and 100.',
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

    // Map [0, 1) to 1-100 inclusive
    const target = Math.floor(rawResult * 100) + 1;

    // ------ Calculate distance and tier ------
    const distance = Math.abs(guess - target);
    const tier = this.getTier(distance);

    const isWin = tier.multiplier > 0;
    const multiplier = tier.multiplier;

    // ------ Deduct balance ------
    await this.deductBalance(userId, bet.amount, bet.currency);

    // ------ Calculate payout ------
    const payout = isWin
      ? Math.floor(bet.amount * multiplier * 100000000) / 100000000
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
      multiplier: isWin ? multiplier : 0,
      result: {
        guess,
        target,
        distance,
        tier: tier.tier,
        tierLabel: tier.label,
        multiplier,
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
      multiplier: isWin ? multiplier : 0,
      result: {
        guess,
        target,
        distance,
        tier: tier.tier,
        tierLabel: tier.label,
        multiplier,
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

export const numberGuessGame = new NumberGuessGame();
export default numberGuessGame;
