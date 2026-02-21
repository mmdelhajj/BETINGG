import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Dice Game
// ---------------------------------------------------------------------------
// Classic dice: pick a target number (0-99.99), choose over or under.
// Win condition: isOver ? result > target : result < target
// Payout multiplier: (100 - houseEdge*100) / winChance
// ---------------------------------------------------------------------------

export interface DiceOptions {
  target: number;  // 0 - 99.99
  isOver: boolean;
}

export class DiceGame extends BaseGame {
  readonly name = 'Dice';
  readonly slug = 'dice';
  readonly houseEdge = 0.02; // 2%
  readonly minBet = 0.01;
  readonly maxBet = 10000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as DiceOptions;

    // Validate options
    if (!options || typeof options.target !== 'number' || typeof options.isOver !== 'boolean') {
      throw new GameError('INVALID_OPTIONS', 'Must provide target (number) and isOver (boolean).');
    }

    if (options.target < 1 || options.target > 98) {
      throw new GameError(
        'INVALID_TARGET',
        'Target must be between 1 and 98.',
      );
    }

    // Validate bet
    await this.validateBet(userId, bet.amount, bet.currency);

    // Get user seeds
    const seeds = await this.getUserSeeds(userId);

    // Generate provably fair result: 0 - 99.99
    const rawResult = this.fairService.generateResult(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );
    const result = Math.floor(rawResult * 10000) / 100; // 0.00 - 99.99

    // Calculate win chance and payout multiplier
    const winChance = options.isOver
      ? 100 - options.target      // e.g., target=50 isOver: 50% chance
      : options.target;            // e.g., target=50 isUnder: 50% chance

    const multiplier =
      Math.floor(((100 - this.houseEdge * 100) / winChance) * 10000) / 10000;

    // Determine win
    const isWin = options.isOver
      ? result > options.target
      : result < options.target;

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    // Credit if won
    const payout = isWin ? Math.floor(bet.amount * multiplier * 100000000) / 100000000 : 0;
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
      multiplier: isWin ? multiplier : 0,
      result: {
        roll: result,
        target: options.target,
        isOver: options.isOver,
        winChance,
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
      multiplier: isWin ? multiplier : 0,
      result: {
        roll: result,
        target: options.target,
        isOver: options.isOver,
        winChance,
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

export const diceGame = new DiceGame();
export default diceGame;
