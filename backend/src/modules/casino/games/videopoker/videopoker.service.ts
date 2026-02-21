import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Card helpers
// ---------------------------------------------------------------------------

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

interface Card {
  index: number; // 0-51
  rank: string;
  suit: string;
  value: number; // 2-14 (A=14)
}

function indexToCard(index: number): Card {
  const suitIdx = Math.floor(index / 13);
  const rankIdx = index % 13;
  return {
    index,
    rank: RANKS[rankIdx],
    suit: SUITS[suitIdx],
    value: rankIdx + 2, // 2=2, 3=3, ..., 10=10, J=11, Q=12, K=13, A=14
  };
}

// ---------------------------------------------------------------------------
// Hand rankings and payouts (Jacks or Better)
// ---------------------------------------------------------------------------

interface HandRank {
  name: string;
  multiplier: number;
  rank: number; // higher = better
}

const HAND_RANKS: HandRank[] = [
  { name: 'Royal Flush', multiplier: 800, rank: 9 },
  { name: 'Straight Flush', multiplier: 50, rank: 8 },
  { name: 'Four of a Kind', multiplier: 25, rank: 7 },
  { name: 'Full House', multiplier: 9, rank: 6 },
  { name: 'Flush', multiplier: 6, rank: 5 },
  { name: 'Straight', multiplier: 4, rank: 4 },
  { name: 'Three of a Kind', multiplier: 3, rank: 3 },
  { name: 'Two Pair', multiplier: 2, rank: 2 },
  { name: 'Jacks or Better', multiplier: 1, rank: 1 },
  { name: 'Nothing', multiplier: 0, rank: 0 },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface VideoPokerState {
  userId: string;
  betAmount: number;
  currency: string;
  deck: number[];         // Full shuffled deck (indices 0-51)
  hand: number[];          // Current 5 card indices
  deckPosition: number;    // Next card position in deck
  phase: 'deal' | 'draw';
  isActive: boolean;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: string;
}

const REDIS_KEY_PREFIX = 'videopoker:game:';
const REDIS_TTL = 3600;

// ---------------------------------------------------------------------------
// VideoPokerGame
// ---------------------------------------------------------------------------

export class VideoPokerGame extends BaseGame {
  readonly name = 'Video Poker';
  readonly slug = 'video-poker';
  readonly houseEdge = 0.015;
  readonly minBet = 0.1;
  readonly maxBet = 1000;

  /**
   * play() delegates to deal() for the initial entry point.
   */
  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    return this.deal(userId, bet);
  }

  // -------------------------------------------------------------------------
  // Deal - start a new hand
  // -------------------------------------------------------------------------

  async deal(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency } = bet;

    // Check for existing game
    const key = REDIS_KEY_PREFIX + userId;
    const existing = await redis.get(key);
    if (existing) {
      throw new GameError('GAME_IN_PROGRESS', 'You already have an active Video Poker hand. Complete it first.');
    }

    // Validate bet
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Shuffle deck using provably fair Fisher-Yates
    const deck = this.fairService.generateShuffledDeck(serverSeed, clientSeed, nonce);

    // Deal 5 cards
    const hand = deck.slice(0, 5);
    const deckPosition = 5;

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Store state
    const state: VideoPokerState = {
      userId,
      betAmount: amount,
      currency,
      deck,
      hand,
      deckPosition,
      phase: 'deal',
      isActive: true,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      createdAt: new Date().toISOString(),
    };

    await redis.set(key, JSON.stringify(state), 'EX', REDIS_TTL);

    // Increment nonce
    await this.incrementNonce(userId);

    const cards = hand.map(indexToCard);
    const handEval = this.evaluateHand(cards);

    return {
      roundId: '',
      game: this.slug,
      betAmount: amount,
      payout: 0,
      profit: 0,
      multiplier: 0,
      result: {
        phase: 'deal',
        cards: cards.map((c) => ({ rank: c.rank, suit: c.suit })),
        handName: handEval.name,
        handMultiplier: handEval.multiplier,
        instructions: 'Select cards to hold (array of 5 booleans), then call draw.',
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Draw - replace non-held cards and evaluate final hand
  // -------------------------------------------------------------------------

  async draw(userId: string, holds: boolean[]): Promise<GameResult> {
    const key = REDIS_KEY_PREFIX + userId;
    const raw = await redis.get(key);

    if (!raw) {
      throw new GameError('NO_GAME', 'No active Video Poker game found.');
    }

    const state: VideoPokerState = JSON.parse(raw);

    if (!state.isActive || state.phase !== 'deal') {
      throw new GameError('INVALID_PHASE', 'Cannot draw in current game state.');
    }

    // Validate holds array
    if (!Array.isArray(holds) || holds.length !== 5) {
      throw new GameError('INVALID_HOLDS', 'holds must be an array of exactly 5 booleans.');
    }
    for (const h of holds) {
      if (typeof h !== 'boolean') {
        throw new GameError('INVALID_HOLDS', 'Each element in holds must be a boolean.');
      }
    }

    // Replace non-held cards
    const newHand = [...state.hand];
    let deckPos = state.deckPosition;

    for (let i = 0; i < 5; i++) {
      if (!holds[i]) {
        if (deckPos >= state.deck.length) {
          throw new GameError('DECK_EXHAUSTED', 'Not enough cards in deck.');
        }
        newHand[i] = state.deck[deckPos];
        deckPos++;
      }
    }

    // Evaluate final hand
    const cards = newHand.map(indexToCard);
    const handEval = this.evaluateHand(cards);

    const multiplier = handEval.multiplier;
    const payout = state.betAmount * multiplier;
    const profit = payout - state.betAmount;

    // Credit winnings if any
    if (payout > 0) {
      await this.creditWinnings(userId, payout, state.currency);
    }

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: state.betAmount,
      payout,
      multiplier,
      result: {
        initialHand: state.hand.map(indexToCard).map((c) => ({ rank: c.rank, suit: c.suit })),
        holds,
        finalHand: cards.map((c) => ({ rank: c.rank, suit: c.suit })),
        handName: handEval.name,
        handRank: handEval.rank,
      },
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    // Clean up Redis
    await redis.del(key);

    // Fetch updated balance
    const newBalance = await this.getBalance(userId, state.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: state.betAmount,
      payout,
      profit,
      multiplier,
      result: {
        phase: 'complete',
        initialHand: state.hand.map(indexToCard).map((c) => ({ rank: c.rank, suit: c.suit })),
        holds,
        finalHand: cards.map((c) => ({ rank: c.rank, suit: c.suit })),
        handName: handEval.name,
        handMultiplier: multiplier,
      },
      fairness: {
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      },
      newBalance,
    };
  }

  // -------------------------------------------------------------------------
  // Hand evaluation
  // -------------------------------------------------------------------------

  evaluateHand(cards: Card[]): HandRank {
    if (cards.length !== 5) {
      return HAND_RANKS[HAND_RANKS.length - 1]; // Nothing
    }

    const values = cards.map((c) => c.value).sort((a, b) => a - b);
    const suits = cards.map((c) => c.suit);

    const isFlush = suits.every((s) => s === suits[0]);
    const isStraight = this.checkStraight(values);

    // Count values
    const valueCounts = new Map<number, number>();
    for (const v of values) {
      valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1);
    }
    const counts = Array.from(valueCounts.values()).sort((a, b) => b - a);
    const uniqueValues = Array.from(valueCounts.keys()).sort((a, b) => a - b);

    // Royal Flush: A-K-Q-J-10 all same suit
    if (isFlush && isStraight && values[0] === 10 && values[4] === 14) {
      return HAND_RANKS[0]; // Royal Flush
    }

    // Straight Flush
    if (isFlush && isStraight) {
      return HAND_RANKS[1]; // Straight Flush
    }

    // Four of a Kind
    if (counts[0] === 4) {
      return HAND_RANKS[2]; // Four of a Kind
    }

    // Full House
    if (counts[0] === 3 && counts[1] === 2) {
      return HAND_RANKS[3]; // Full House
    }

    // Flush
    if (isFlush) {
      return HAND_RANKS[4]; // Flush
    }

    // Straight
    if (isStraight) {
      return HAND_RANKS[5]; // Straight
    }

    // Three of a Kind
    if (counts[0] === 3) {
      return HAND_RANKS[6]; // Three of a Kind
    }

    // Two Pair
    if (counts[0] === 2 && counts[1] === 2) {
      return HAND_RANKS[7]; // Two Pair
    }

    // Jacks or Better (pair of J, Q, K, or A)
    if (counts[0] === 2) {
      // Find which value is the pair
      for (const [val, count] of valueCounts.entries()) {
        if (count === 2 && val >= 11) {
          // J=11, Q=12, K=13, A=14
          return HAND_RANKS[8]; // Jacks or Better
        }
      }
    }

    // Nothing
    return HAND_RANKS[9]; // Nothing
  }

  /**
   * Check if values form a straight (including Ace-low: A-2-3-4-5).
   */
  private checkStraight(sortedValues: number[]): boolean {
    // Normal straight: consecutive values
    const isNormal =
      sortedValues[4] - sortedValues[0] === 4 &&
      new Set(sortedValues).size === 5;

    // Ace-low straight (Wheel): A-2-3-4-5
    const isWheel =
      sortedValues[0] === 2 &&
      sortedValues[1] === 3 &&
      sortedValues[2] === 4 &&
      sortedValues[3] === 5 &&
      sortedValues[4] === 14;

    return isNormal || isWheel;
  }
}

export const videoPokerGame = new VideoPokerGame();
export default videoPokerGame;
