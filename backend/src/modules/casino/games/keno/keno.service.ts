import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Payout table
// payoutTable[numPicks][numMatches] = multiplier
// ---------------------------------------------------------------------------

const PAYOUT_TABLE: Record<number, Record<number, number>> = {
  1: { 0: 0, 1: 3.8 },
  2: { 0: 0, 1: 1.2, 2: 8 },
  3: { 0: 0, 1: 0.5, 2: 3, 3: 25 },
  4: { 0: 0, 1: 0.3, 2: 1.5, 3: 8, 4: 75 },
  5: { 0: 0, 1: 0.2, 2: 1, 3: 3, 4: 15, 5: 200 },
  6: { 0: 0, 1: 0, 2: 0.5, 3: 2, 4: 6, 5: 50, 6: 500 },
  7: { 0: 0, 1: 0, 2: 0.3, 3: 1.5, 4: 4, 5: 15, 6: 100, 7: 1000 },
  8: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 3, 5: 8, 6: 50, 7: 250, 8: 2500 },
  9: { 0: 0, 1: 0, 2: 0, 3: 0.5, 4: 2, 5: 5, 6: 20, 7: 100, 8: 500, 9: 5000 },
  10: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1.5, 5: 3, 6: 10, 7: 50, 8: 250, 9: 1000, 10: 10000 },
};

const GRID_SIZE = 40;
const DRAW_COUNT = 10;
const MIN_PICKS = 1;
const MAX_PICKS = 10;

// ---------------------------------------------------------------------------
// KenoGame
// ---------------------------------------------------------------------------

export class KenoGame extends BaseGame {
  readonly name = 'Keno';
  readonly slug = 'keno';
  readonly houseEdge = 0.03;
  readonly minBet = 0.1;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const picks = (options as { picks?: number[] })?.picks;

    // Validate picks
    if (!picks || !Array.isArray(picks)) {
      throw new GameError('MISSING_PICKS', 'picks must be an array of numbers.');
    }
    if (picks.length < MIN_PICKS || picks.length > MAX_PICKS) {
      throw new GameError('INVALID_PICKS_COUNT', `You must pick between ${MIN_PICKS} and ${MAX_PICKS} numbers.`);
    }

    // Validate each pick is unique and in range
    const uniquePicks = new Set(picks);
    if (uniquePicks.size !== picks.length) {
      throw new GameError('DUPLICATE_PICKS', 'All picks must be unique.');
    }
    for (const pick of picks) {
      if (!Number.isInteger(pick) || pick < 1 || pick > GRID_SIZE) {
        throw new GameError('PICK_OUT_OF_RANGE', `Each pick must be an integer between 1 and ${GRID_SIZE}.`);
      }
    }

    // Validate bet amount
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate 10 drawn numbers using provably fair (no duplicates)
    const drawnNumbers = this.generateKenoDrawn(serverSeed, clientSeed, nonce);

    // Count matches
    const drawnSet = new Set(drawnNumbers);
    const matches = picks.filter((p) => drawnSet.has(p));
    const matchCount = matches.length;

    // Look up multiplier in payout table
    const table = PAYOUT_TABLE[picks.length];
    const multiplier = table[matchCount] ?? 0;
    const payout = amount * multiplier;
    const profit = payout - amount;

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Credit winnings if any
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
        picks: picks.sort((a, b) => a - b),
        drawnNumbers: drawnNumbers.sort((a, b) => a - b),
        matches: matches.sort((a, b) => a - b),
        matchCount,
        numPicks: picks.length,
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
        picks: picks.sort((a, b) => a - b),
        drawnNumbers: drawnNumbers.sort((a, b) => a - b),
        matches: matches.sort((a, b) => a - b),
        matchCount,
        numPicks: picks.length,
        payoutTable: table,
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
   * Generate 10 unique drawn numbers in [1, GRID_SIZE] using provably fair.
   * Uses Fisher-Yates selection from available numbers.
   */
  private generateKenoDrawn(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
  ): number[] {
    const randoms = this.fairService.generateMultipleResults(
      serverSeed,
      clientSeed,
      nonce,
      DRAW_COUNT,
    );

    const available = Array.from({ length: GRID_SIZE }, (_, i) => i + 1);
    const drawn: number[] = [];

    for (let i = 0; i < DRAW_COUNT; i++) {
      const idx = Math.floor(randoms[i] * available.length);
      drawn.push(available[idx]);
      available.splice(idx, 1);
    }

    return drawn;
  }
}

export const kenoGame = new KenoGame();
export default kenoGame;
