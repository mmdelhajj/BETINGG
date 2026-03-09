import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Rock Paper Scissors Game
// ---------------------------------------------------------------------------
// Classic RPS with provably fair outcome.
// Result [0, 1): 0-0.333... = rock, 0.333...-0.666... = paper, 0.666...-1 = scissors
// Win payout: stake * 2.82 (~6% house edge on 1-in-3 win chance)
// Tie: stake returned (1x)
// Loss: 0
// ---------------------------------------------------------------------------

type RPSChoice = 'rock' | 'paper' | 'scissors';
type RPSOutcome = 'win' | 'lose' | 'tie';

export interface RPSOptions {
  choice: RPSChoice;
}

const VALID_CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

export class RPSGame extends BaseGame {
  readonly name = 'Rock Paper Scissors';
  readonly slug = 'rps';
  readonly houseEdge = 0.06;
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  private static readonly WIN_MULTIPLIER = 2.82;
  private static readonly TIE_MULTIPLIER = 1;

  /**
   * Convert a raw provably fair float [0, 1) into a house RPS choice.
   */
  private static rawToChoice(raw: number): RPSChoice {
    if (raw < 1 / 3) return 'rock';
    if (raw < 2 / 3) return 'paper';
    return 'scissors';
  }

  /**
   * Determine outcome from player vs house.
   * Rock > Scissors, Scissors > Paper, Paper > Rock
   */
  private static determineOutcome(player: RPSChoice, house: RPSChoice): RPSOutcome {
    if (player === house) return 'tie';
    if (
      (player === 'rock' && house === 'scissors') ||
      (player === 'scissors' && house === 'paper') ||
      (player === 'paper' && house === 'rock')
    ) {
      return 'win';
    }
    return 'lose';
  }

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as RPSOptions;

    // ---- Validate options ----
    if (!options || !options.choice) {
      throw new GameError('INVALID_OPTIONS', 'Must provide choice: "rock", "paper", or "scissors".');
    }

    const playerChoice = options.choice.toLowerCase() as RPSChoice;
    if (!VALID_CHOICES.includes(playerChoice)) {
      throw new GameError('INVALID_CHOICE', 'Choice must be "rock", "paper", or "scissors".');
    }

    // ---- Validate bet ----
    await this.validateBet(userId, bet.amount, bet.currency);

    // ---- Provably fair ----
    const seeds = await this.getUserSeeds(userId);

    const rawResult = this.fairService.generateResult(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    const houseChoice = RPSGame.rawToChoice(rawResult);
    const outcome = RPSGame.determineOutcome(playerChoice, houseChoice);

    // ---- Deduct balance ----
    await this.deductBalance(userId, bet.amount, bet.currency);

    // ---- Calculate payout ----
    let multiplier: number;
    let payout: number;

    switch (outcome) {
      case 'win':
        multiplier = RPSGame.WIN_MULTIPLIER;
        payout = Math.floor(bet.amount * RPSGame.WIN_MULTIPLIER * 100000000) / 100000000;
        break;
      case 'tie':
        multiplier = RPSGame.TIE_MULTIPLIER;
        payout = Math.floor(bet.amount * RPSGame.TIE_MULTIPLIER * 100000000) / 100000000;
        break;
      case 'lose':
      default:
        multiplier = 0;
        payout = 0;
        break;
    }

    // ---- Credit winnings (win or tie) ----
    if (payout > 0) {
      await this.creditWinnings(userId, payout, bet.currency);
    }

    // ---- Increment nonce ----
    await this.incrementNonce(userId);

    // ---- Record round ----
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: bet.amount,
      payout,
      multiplier,
      result: {
        playerChoice,
        houseChoice,
        outcome,
        rawValue: rawResult,
      },
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    // ---- Fetch updated balance ----
    const newBalance = await this.getBalance(userId, bet.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: bet.amount,
      payout,
      profit: payout - bet.amount,
      multiplier,
      result: {
        playerChoice,
        houseChoice,
        outcome,
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

export const rpsGame = new RPSGame();
export default rpsGame;
