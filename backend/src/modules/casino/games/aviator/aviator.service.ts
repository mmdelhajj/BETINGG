import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Aviator Game (Single-Player Instant Plane Crash)
// ---------------------------------------------------------------------------
// Player sets a target multiplier (auto-cashout). The server generates a
// provably fair crash point. If the crash point >= target, the player wins
// (payout = bet * target). Otherwise the plane flies away and the bet is lost.
//
// This is conceptually the same as Crash but operates as an instant
// single-player game — no waiting room, no multiplayer, no WebSocket ticks.
// ---------------------------------------------------------------------------

export interface AviatorOptions {
  targetMultiplier: number;
}

export class AviatorGame extends BaseGame {
  readonly name = 'Aviator';
  readonly slug = 'aviator';
  readonly houseEdge = 0.03;
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  private static readonly MIN_TARGET = 1.01;
  private static readonly MAX_TARGET = 1000000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as AviatorOptions | undefined;

    // --- Validate options ---
    // Accept both targetMultiplier and autoCashout from frontend
    const targetField = (options as any)?.targetMultiplier ?? (options as any)?.autoCashout;
    if (!options || targetField === undefined || targetField === null) {
      throw new GameError(
        'INVALID_OPTIONS',
        'Must provide targetMultiplier (1.01 to 1000000).',
      );
    }

    const target = Number(targetField);

    if (isNaN(target) || target < AviatorGame.MIN_TARGET || target > AviatorGame.MAX_TARGET) {
      throw new GameError(
        'INVALID_TARGET',
        `Target multiplier must be between ${AviatorGame.MIN_TARGET} and ${AviatorGame.MAX_TARGET}.`,
      );
    }

    // Round target to 2 decimal places
    const targetMultiplier = Math.floor(target * 100) / 100;

    // --- Validate bet ---
    await this.validateBet(userId, bet.amount, bet.currency);

    // --- Get provably fair seeds ---
    const seeds = await this.getUserSeeds(userId);

    // --- Generate crash point using the same algorithm as the Crash game ---
    const crashPoint = this.fairService.generateCrashPoint(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    // --- Determine outcome ---
    const isWin = crashPoint >= targetMultiplier;
    const multiplier = isWin ? targetMultiplier : 0;
    const payout = isWin
      ? Math.floor(bet.amount * targetMultiplier * 100000000) / 100000000
      : 0;

    // --- Deduct balance ---
    await this.deductBalance(userId, bet.amount, bet.currency);

    // --- Credit winnings ---
    if (isWin) {
      await this.creditWinnings(userId, payout, bet.currency);
    }

    // --- Increment nonce ---
    await this.incrementNonce(userId);

    // --- Record round ---
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: bet.amount,
      payout,
      multiplier,
      result: {
        targetMultiplier,
        crashPoint,
        isWin,
        payout,
        multiplier,
      },
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    // --- Fetch updated balance ---
    const newBalance = await this.getBalance(userId, bet.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: bet.amount,
      payout,
      profit: payout - bet.amount,
      multiplier,
      result: {
        targetMultiplier,
        crashPoint,
        isWin,
        payout,
        multiplier,
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

export const aviatorGame = new AviatorGame();
export default aviatorGame;
