import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// HiLo Game
// ---------------------------------------------------------------------------
// Card chain game. A card is dealt; guess if the next card is higher or lower.
// Correct guess increases multiplier. Cash out anytime. Wrong guess = lose.
// Multiplier per guess is based on the probability of the guess being correct.
//
// Cards: standard deck 1(Ace)-13(King). Suits don't matter for value.
// Higher = next card value > current.  Lower = next card value < current.
// Equal = lose (neither higher nor lower).
// ---------------------------------------------------------------------------

type Direction = 'higher' | 'lower';

interface HiLoCard {
  value: number;       // 1-13
  suit: string;
  rank: string;
  index: number;       // 0-51 index from deck
}

interface HiLoState {
  userId: string;
  currency: string;
  betAmount: number;
  deck: number[];           // shuffled deck
  deckPosition: number;
  currentCard: HiLoCard;
  history: HiLoCard[];      // all previously shown cards
  currentMultiplier: number;
  roundNumber: number;      // how many guesses made
  isActive: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export class HiLoGame extends BaseGame {
  readonly name = 'HiLo';
  readonly slug = 'hilo';
  readonly houseEdge = 0.02;
  readonly minBet = 0.01;
  readonly maxBet = 10000;

  private static REDIS_PREFIX = 'hilo:session:';
  private static TTL = 3600;

  async play(_userId: string, _bet: BetRequest): Promise<GameResult> {
    throw new GameError('NOT_SUPPORTED', 'Use start/guess/cashout for HiLo.');
  }

  // =======================================================================
  // Card helpers
  // =======================================================================

  private indexToCard(index: number): HiLoCard {
    const suitIdx = Math.floor(index / 13);
    const rankIdx = index % 13;
    return {
      value: rankIdx + 1,   // 1 (Ace) through 13 (King)
      suit: SUITS[suitIdx],
      rank: RANKS[rankIdx],
      index,
    };
  }

  /**
   * Calculate the probability of the next card being higher than the current value.
   * Based on how many cards in a standard deck are strictly higher.
   * Uses a simple model: 4 copies of each rank 1-13.
   * P(higher) = (number of ranks > current) * 4 / 52
   * P(lower)  = (number of ranks < current) * 4 / 52
   * P(equal)  = 4 / 52
   *
   * For simplicity and to avoid tracking the exact remaining deck,
   * we use the theoretical distribution.
   */
  private calculateProbabilities(currentValue: number): {
    higher: number;
    lower: number;
    equal: number;
  } {
    const ranksHigher = 13 - currentValue;
    const ranksLower = currentValue - 1;

    return {
      higher: (ranksHigher * 4) / 52,
      lower: (ranksLower * 4) / 52,
      equal: 4 / 52,
    };
  }

  /**
   * Calculate the multiplier for a correct guess.
   * multiplier = (1 - houseEdge) / probability
   */
  private guessMultiplier(direction: Direction, currentValue: number): number {
    const probs = this.calculateProbabilities(currentValue);
    const prob = direction === 'higher' ? probs.higher : probs.lower;

    if (prob <= 0) {
      // Can't go higher than King or lower than Ace — guaranteed loss
      return 0;
    }

    return Math.floor(((1 - this.houseEdge) / prob) * 10000) / 10000;
  }

  // =======================================================================
  // Game actions
  // =======================================================================

  /**
   * Start a new HiLo chain. Deducts balance, deals the first card.
   */
  async start(
    userId: string,
    bet: BetRequest,
  ): Promise<{
    currentCard: HiLoCard;
    probabilities: { higher: number; lower: number };
    multipliers: { higher: number; lower: number };
    serverSeedHash: string;
  }> {
    const existing = await this.getSession(userId);
    if (existing && existing.isActive) {
      throw new GameError('GAME_IN_PROGRESS', 'You already have an active HiLo game.');
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    const seeds = await this.getUserSeeds(userId);
    const deck = this.fairService.generateShuffledDeck(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    await this.deductBalance(userId, bet.amount, bet.currency);

    const firstCard = this.indexToCard(deck[0]);

    const state: HiLoState = {
      userId,
      currency: bet.currency,
      betAmount: bet.amount,
      deck,
      deckPosition: 1,
      currentCard: firstCard,
      history: [firstCard],
      currentMultiplier: 1.0,
      roundNumber: 0,
      isActive: true,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    };

    await this.saveSession(userId, state);

    const probs = this.calculateProbabilities(firstCard.value);

    return {
      currentCard: firstCard,
      probabilities: {
        higher: Math.round(probs.higher * 10000) / 100,
        lower: Math.round(probs.lower * 10000) / 100,
      },
      multipliers: {
        higher: this.guessMultiplier('higher', firstCard.value),
        lower: this.guessMultiplier('lower', firstCard.value),
      },
      serverSeedHash: seeds.serverSeedHash,
    };
  }

  /**
   * Make a guess: higher or lower.
   */
  async guess(
    userId: string,
    direction: Direction,
  ): Promise<{
    previousCard: HiLoCard;
    newCard: HiLoCard;
    direction: Direction;
    isCorrect: boolean;
    currentMultiplier: number;
    nextMultipliers?: { higher: number; lower: number };
    nextProbabilities?: { higher: number; lower: number };
    payout: number;
    gameOver: boolean;
    newBalance?: number;
  }> {
    if (direction !== 'higher' && direction !== 'lower') {
      throw new GameError('INVALID_DIRECTION', 'Direction must be "higher" or "lower".');
    }

    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      throw new GameError('NO_ACTIVE_GAME', 'No active HiLo game found.');
    }

    if (state.deckPosition >= state.deck.length) {
      throw new GameError('DECK_EXHAUSTED', 'No more cards in the deck. Please cash out.');
    }

    const previousCard = state.currentCard;
    const newCard = this.indexToCard(state.deck[state.deckPosition]);
    state.deckPosition++;

    const isCorrect =
      (direction === 'higher' && newCard.value > previousCard.value) ||
      (direction === 'lower' && newCard.value < previousCard.value);

    state.currentCard = newCard;
    state.history.push(newCard);
    state.roundNumber++;

    if (!isCorrect) {
      // Lost
      state.isActive = false;
      await this.saveSession(userId, state);
      await this.incrementNonce(userId);

      await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: state.betAmount,
        payout: 0,
        multiplier: 0,
        result: {
          history: state.history,
          lastGuess: direction,
          correct: false,
          roundsPlayed: state.roundNumber,
        },
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      });

      await this.deleteSession(userId);

      // Fetch updated balance
      const lossBalance = await this.getBalance(userId, state.currency);

      return {
        previousCard,
        newCard,
        direction,
        isCorrect: false,
        currentMultiplier: 0,
        payout: 0,
        gameOver: true,
        newBalance: lossBalance,
      };
    }

    // Correct guess — update multiplier
    const stepMultiplier = this.guessMultiplier(direction, previousCard.value);
    state.currentMultiplier =
      Math.floor(state.currentMultiplier * stepMultiplier * 10000) / 10000;

    await this.saveSession(userId, state);

    const probs = this.calculateProbabilities(newCard.value);

    return {
      previousCard,
      newCard,
      direction,
      isCorrect: true,
      currentMultiplier: state.currentMultiplier,
      nextMultipliers: {
        higher: this.guessMultiplier('higher', newCard.value),
        lower: this.guessMultiplier('lower', newCard.value),
      },
      nextProbabilities: {
        higher: Math.round(probs.higher * 10000) / 100,
        lower: Math.round(probs.lower * 10000) / 100,
      },
      payout: Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000,
      gameOver: false,
      newBalance: undefined as number | undefined,
    };
  }

  /**
   * Cash out the current chain at the accumulated multiplier.
   */
  async cashout(userId: string): Promise<{
    payout: number;
    multiplier: number;
    history: HiLoCard[];
    roundsPlayed: number;
    newBalance: number;
  }> {
    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      throw new GameError('NO_ACTIVE_GAME', 'No active HiLo game found.');
    }

    if (state.roundNumber === 0) {
      throw new GameError('NO_GUESSES', 'You must make at least one guess before cashing out.');
    }

    const payout =
      Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000;

    await this.creditWinnings(userId, payout, state.currency);
    await this.incrementNonce(userId);

    state.isActive = false;
    await this.saveSession(userId, state);

    await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: state.betAmount,
      payout,
      multiplier: state.currentMultiplier,
      result: {
        history: state.history,
        cashedOut: true,
        roundsPlayed: state.roundNumber,
      },
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    await this.deleteSession(userId);

    // Fetch updated balance
    const cashoutBalance = await this.getBalance(userId, state.currency);

    return {
      payout,
      multiplier: state.currentMultiplier,
      history: state.history,
      roundsPlayed: state.roundNumber,
      newBalance: cashoutBalance,
    };
  }

  /**
   * Get current game state for the user.
   */
  async getActiveGame(userId: string): Promise<any> {
    const state = await this.getSession(userId);
    if (!state || !state.isActive) {
      return { isActive: false };
    }

    const probs = this.calculateProbabilities(state.currentCard.value);

    return {
      isActive: true,
      currentCard: state.currentCard,
      history: state.history,
      currentMultiplier: state.currentMultiplier,
      betAmount: state.betAmount,
      currency: state.currency,
      roundNumber: state.roundNumber,
      potentialPayout:
        Math.floor(state.betAmount * state.currentMultiplier * 100000000) / 100000000,
      probabilities: {
        higher: Math.round(probs.higher * 10000) / 100,
        lower: Math.round(probs.lower * 10000) / 100,
      },
      multipliers: {
        higher: this.guessMultiplier('higher', state.currentCard.value),
        lower: this.guessMultiplier('lower', state.currentCard.value),
      },
      serverSeedHash: state.serverSeedHash,
    };
  }

  // =======================================================================
  // Redis session
  // =======================================================================

  private async saveSession(userId: string, state: HiLoState): Promise<void> {
    const key = HiLoGame.REDIS_PREFIX + userId;
    await redis.set(key, JSON.stringify(state), 'EX', HiLoGame.TTL);
  }

  private async getSession(userId: string): Promise<HiLoState | null> {
    const key = HiLoGame.REDIS_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as HiLoState;
  }

  private async deleteSession(userId: string): Promise<void> {
    const key = HiLoGame.REDIS_PREFIX + userId;
    await redis.del(key);
  }
}

export const hiLoGame = new HiLoGame();
export default hiLoGame;
