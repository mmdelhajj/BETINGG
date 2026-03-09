import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Trenball - Football-themed Crash Variant (Single Player Instant)
// ---------------------------------------------------------------------------
// Player picks a team (Red or Blue).
// A "ball" kicks and a multiplier rises (like crash).
// At a provably fair crash point, the ball scores into one team's goal.
// If ball goes into your team's goal: you lose.
// If ball goes into opponent's goal: you can cashout at current multiplier
//   or it auto-resolves at the crash point.
//
// Since this is a single-player instant game, the flow is:
//   1. Player places bet, picks team, optionally sets autoCashout
//   2. Server determines crash point and scoring team
//   3. If autoCashout < crashPoint and autoCashout is set, player wins at autoCashout
//   4. Otherwise, scoring team is revealed
//   5. If scoring team === player's team: player loses
//   6. If scoring team !== player's team: player wins at crashPoint
// ---------------------------------------------------------------------------

export class TrenballGame extends BaseGame {
  readonly name = 'Crash Trenball';
  readonly slug = 'trenball';
  readonly houseEdge = 0.03; // 3% house edge (same as crash)
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;

    // Validate options
    if (!options || !options.team) {
      throw new GameError('MISSING_TEAM', 'You must pick a team: "red" or "blue".');
    }

    let team = String(options.team).toLowerCase();
    // Accept home/away aliases from frontend
    if (team === 'home') team = 'red';
    if (team === 'away') team = 'blue';
    if (team !== 'red' && team !== 'blue') {
      throw new GameError('INVALID_TEAM', 'Team must be "red" or "blue".');
    }

    const autoCashout = options.autoCashout
      ? Math.max(1.01, parseFloat(String(options.autoCashout)))
      : null;

    // Validate bet
    await this.validateBet(userId, amount, currency);

    // Get seeds
    const seeds = await this.getUserSeeds(userId);

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Generate crash point using provably fair algorithm (same as crash game)
    const crashPoint = this.fairService.generateCrashPoint(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    // Determine which team scores using a separate provably fair result
    // We use the generateResult method with a different sub-index
    const teamResult = this.fairService.generateResult(
      seeds.serverSeed,
      `${seeds.clientSeed}:team`,
      seeds.nonce,
    );
    const scoringTeam: 'red' | 'blue' = teamResult < 0.5 ? 'red' : 'blue';

    // Determine outcome
    let cashoutMultiplier: number;
    let isWin: boolean;
    let payout: number;

    if (autoCashout && autoCashout < crashPoint) {
      // Player cashed out before the goal was scored
      // But we need to check: does the goal eventually go in the player's net?
      // In auto-cashout, the player escapes before the goal
      cashoutMultiplier = autoCashout;
      isWin = true;
      payout = Math.floor(amount * cashoutMultiplier * 100) / 100;
    } else {
      // Ball reaches the goal
      cashoutMultiplier = crashPoint;

      if (scoringTeam === team) {
        // Ball went into the player's goal - they lose
        isWin = false;
        payout = 0;
      } else {
        // Ball went into the opponent's goal - player wins at crash point
        isWin = true;
        payout = Math.floor(amount * crashPoint * 100) / 100;
      }
    }

    // Credit winnings if won
    if (payout > 0) {
      await this.creditWinnings(userId, payout, currency);
    }

    // Increment nonce
    await this.incrementNonce(userId);

    // Get new balance
    const newBalance = await this.getBalance(userId, currency);

    // Build result
    const result: any = {
      team,
      scoringTeam,
      crashPoint,
      cashoutMultiplier,
      isWin,
      payout,
      autoCashout,
      wasAutoCashout: autoCashout !== null && autoCashout < crashPoint,
    };

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: amount,
      payout,
      multiplier: isWin ? cashoutMultiplier : 0,
      result,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    return {
      roundId,
      game: this.slug,
      betAmount: amount,
      payout,
      profit: payout - amount,
      multiplier: isWin ? cashoutMultiplier : 0,
      result,
      fairness: {
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.nonce,
      },
      newBalance,
    };
  }
}

export const trenballGame = new TrenballGame();
export default trenballGame;
