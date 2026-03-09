import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Texas Hold'em Poker vs House
// ---------------------------------------------------------------------------
// Single-player Texas Hold'em against the dealer (house).
// Flow:
//   1. Player places ante, receives 2 hole cards, dealer gets 2 hole cards (hidden)
//   2. Flop (3 community cards) - player can fold or call (2x ante)
//   3. Turn (1 community card) - player can check or bet (1x ante)
//   4. River (1 community card) - player can check or bet (1x ante)
//   5. Showdown: best 5-card hand wins
// ---------------------------------------------------------------------------

// Card representation: index 0-51
//   suit = floor(index / 13) -> 0=spades, 1=hearts, 2=diamonds, 3=clubs
//   rank = index % 13        -> 0=2, 1=3, ..., 8=10, 9=J, 10=Q, 11=K, 12=A

interface Card {
  index: number;
  suit: string;
  rank: string;
  value: number; // numeric value 2-14 (A=14)
}

type PokerPhase = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'folded';

interface PokerState {
  userId: string;
  currency: string;
  deck: number[];
  deckPosition: number;
  playerHand: Card[];
  dealerHand: Card[];
  communityCards: Card[];
  phase: PokerPhase;
  anteBet: number;
  callBet: number;     // bet added at flop (2x ante)
  turnBet: number;     // bet added at turn (1x ante)
  riverBet: number;    // bet added at river (1x ante)
  totalBet: number;
  isComplete: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface HandEvaluation {
  rank: number;       // 0=High Card to 9=Royal Flush
  name: string;
  tiebreakers: number[];
  cards: Card[];      // best 5 cards
}

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const HAND_NAMES = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
];

// Bonus payout multipliers based on hand rank (applied to ante)
const BONUS_PAYOUTS: Record<number, number> = {
  9: 100, // Royal Flush
  8: 50,  // Straight Flush
  7: 25,  // Four of a Kind
  6: 5,   // Full House
  5: 3,   // Flush
  4: 2,   // Straight
  3: 1,   // Three of a Kind
  2: 0,   // Two Pair (no bonus)
  1: 0,   // One Pair (no bonus)
  0: 0,   // High Card (no bonus)
};

export class PokerGame extends BaseGame {
  readonly name = 'Texas Hold\'em Poker';
  readonly slug = 'poker';
  readonly houseEdge = 0.025; // ~2.5%
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  private static REDIS_PREFIX = 'poker:session:';
  private static TTL = 3600;

  async play(_userId: string, _bet: BetRequest): Promise<GameResult> {
    throw new GameError('NOT_SUPPORTED', 'Use deal/call/fold/check/raise for Poker.');
  }

  // =========================================================================
  // Card helpers
  // =========================================================================

  private indexToCard(index: number): Card {
    const suitIdx = Math.floor(index / 13);
    const rankIdx = index % 13;
    const rank = RANKS[rankIdx];
    const value = rankIdx + 2; // 2=2, 3=3, ..., 12=K(13->nope, 12+2=14=A)

    return {
      index,
      suit: SUITS[suitIdx],
      rank,
      value,
    };
  }

  private drawCard(state: PokerState): Card {
    if (state.deckPosition >= state.deck.length) {
      throw new GameError('DECK_EMPTY', 'Deck is exhausted.');
    }
    const cardIndex = state.deck[state.deckPosition];
    state.deckPosition++;
    return this.indexToCard(cardIndex);
  }

  // =========================================================================
  // Hand evaluation
  // =========================================================================

  /**
   * Evaluate the best 5-card hand from 7 cards (2 hole + 5 community)
   */
  private evaluateBestHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
    const allCards = [...holeCards, ...communityCards];
    const combos = this.getCombinations(allCards, 5);

    let bestEval: HandEvaluation | null = null;

    for (const combo of combos) {
      const evaluation = this.evaluateHand(combo);
      if (!bestEval || this.compareHands(evaluation, bestEval) > 0) {
        bestEval = evaluation;
      }
    }

    return bestEval!;
  }

  /**
   * Get all C(n, k) combinations of an array
   */
  private getCombinations(arr: Card[], k: number): Card[][] {
    const result: Card[][] = [];
    const combo: Card[] = [];

    const backtrack = (start: number) => {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        backtrack(i + 1);
        combo.pop();
      }
    };

    backtrack(0);
    return result;
  }

  /**
   * Evaluate a 5-card hand
   */
  private evaluateHand(cards: Card[]): HandEvaluation {
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    const values = sorted.map((c) => c.value);
    const suits = sorted.map((c) => c.suit);

    const isFlush = suits.every((s) => s === suits[0]);

    // Check for straight
    let isStraight = false;
    let straightHighCard = 0;

    // Normal straight check
    const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
    if (uniqueValues.length === 5) {
      if (uniqueValues[0] - uniqueValues[4] === 4) {
        isStraight = true;
        straightHighCard = uniqueValues[0];
      }
      // Ace-low straight (A-2-3-4-5)
      if (
        uniqueValues[0] === 14 &&
        uniqueValues[1] === 5 &&
        uniqueValues[2] === 4 &&
        uniqueValues[3] === 3 &&
        uniqueValues[4] === 2
      ) {
        isStraight = true;
        straightHighCard = 5; // 5-high straight
      }
    }

    // Count ranks
    const rankCounts = new Map<number, number>();
    for (const v of values) {
      rankCounts.set(v, (rankCounts.get(v) || 0) + 1);
    }

    const counts = [...rankCounts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    });

    // Royal Flush
    if (isFlush && isStraight && straightHighCard === 14) {
      return {
        rank: 9,
        name: 'Royal Flush',
        tiebreakers: [14],
        cards: sorted,
      };
    }

    // Straight Flush
    if (isFlush && isStraight) {
      return {
        rank: 8,
        name: 'Straight Flush',
        tiebreakers: [straightHighCard],
        cards: sorted,
      };
    }

    // Four of a Kind
    if (counts[0][1] === 4) {
      return {
        rank: 7,
        name: 'Four of a Kind',
        tiebreakers: [counts[0][0], counts[1][0]],
        cards: sorted,
      };
    }

    // Full House
    if (counts[0][1] === 3 && counts[1][1] === 2) {
      return {
        rank: 6,
        name: 'Full House',
        tiebreakers: [counts[0][0], counts[1][0]],
        cards: sorted,
      };
    }

    // Flush
    if (isFlush) {
      return {
        rank: 5,
        name: 'Flush',
        tiebreakers: values,
        cards: sorted,
      };
    }

    // Straight
    if (isStraight) {
      return {
        rank: 4,
        name: 'Straight',
        tiebreakers: [straightHighCard],
        cards: sorted,
      };
    }

    // Three of a Kind
    if (counts[0][1] === 3) {
      const kickers = counts.filter((c) => c[1] === 1).map((c) => c[0]).sort((a, b) => b - a);
      return {
        rank: 3,
        name: 'Three of a Kind',
        tiebreakers: [counts[0][0], ...kickers],
        cards: sorted,
      };
    }

    // Two Pair
    if (counts[0][1] === 2 && counts[1][1] === 2) {
      const pairs = [counts[0][0], counts[1][0]].sort((a, b) => b - a);
      const kicker = counts[2][0];
      return {
        rank: 2,
        name: 'Two Pair',
        tiebreakers: [...pairs, kicker],
        cards: sorted,
      };
    }

    // One Pair
    if (counts[0][1] === 2) {
      const kickers = counts.filter((c) => c[1] === 1).map((c) => c[0]).sort((a, b) => b - a);
      return {
        rank: 1,
        name: 'One Pair',
        tiebreakers: [counts[0][0], ...kickers],
        cards: sorted,
      };
    }

    // High Card
    return {
      rank: 0,
      name: 'High Card',
      tiebreakers: values,
      cards: sorted,
    };
  }

  /**
   * Compare two hand evaluations. Returns > 0 if a wins, < 0 if b wins, 0 if tie
   */
  private compareHands(a: HandEvaluation, b: HandEvaluation): number {
    if (a.rank !== b.rank) return a.rank - b.rank;

    for (let i = 0; i < Math.min(a.tiebreakers.length, b.tiebreakers.length); i++) {
      if (a.tiebreakers[i] !== b.tiebreakers[i]) {
        return a.tiebreakers[i] - b.tiebreakers[i];
      }
    }

    return 0;
  }

  /**
   * Format hand name with details
   */
  private formatHandName(evaluation: HandEvaluation): string {
    const rankName = (v: number): string => {
      const names: Record<number, string> = {
        14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens',
        9: 'Nines', 8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives',
        4: 'Fours', 3: 'Threes', 2: 'Twos',
      };
      return names[v] || String(v);
    };

    switch (evaluation.rank) {
      case 9: return 'Royal Flush';
      case 8: return `Straight Flush - ${rankName(evaluation.tiebreakers[0])} High`;
      case 7: return `Four of a Kind - ${rankName(evaluation.tiebreakers[0])}`;
      case 6: return `Full House - ${rankName(evaluation.tiebreakers[0])} over ${rankName(evaluation.tiebreakers[1])}`;
      case 5: return `Flush - ${rankName(evaluation.tiebreakers[0])} High`;
      case 4: return `Straight - ${rankName(evaluation.tiebreakers[0])} High`;
      case 3: return `Three of a Kind - ${rankName(evaluation.tiebreakers[0])}`;
      case 2: return `Two Pair - ${rankName(evaluation.tiebreakers[0])} and ${rankName(evaluation.tiebreakers[1])}`;
      case 1: return `One Pair - ${rankName(evaluation.tiebreakers[0])}`;
      default: return `High Card - ${rankName(evaluation.tiebreakers[0])}`;
    }
  }

  // =========================================================================
  // Game actions
  // =========================================================================

  /**
   * Deal a new hand of Texas Hold'em
   */
  async deal(
    userId: string,
    bet: BetRequest,
  ): Promise<{
    playerHand: Card[];
    dealerHand: Card[];    // will be face-down placeholder
    communityCards: Card[];
    phase: PokerPhase;
    anteBet: number;
    totalBet: number;
    serverSeedHash: string;
  }> {
    // Check for existing active game
    const existing = await this.getSession(userId);
    if (existing && !existing.isComplete) {
      throw new GameError('GAME_IN_PROGRESS', 'You already have an active Poker hand.');
    }
    // Clean up any stale completed session so it doesn't block a new game
    if (existing) {
      await this.deleteSession(userId);
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get seeds and generate shuffled deck
    const seeds = await this.getUserSeeds(userId);
    const deck = this.fairService.generateShuffledDeck(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    // Deduct ante
    await this.deductBalance(userId, bet.amount, bet.currency);

    const state: PokerState = {
      userId,
      currency: bet.currency,
      deck,
      deckPosition: 0,
      playerHand: [],
      dealerHand: [],
      communityCards: [],
      phase: 'preflop',
      anteBet: bet.amount,
      callBet: 0,
      turnBet: 0,
      riverBet: 0,
      totalBet: bet.amount,
      isComplete: false,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    };

    // Deal 2 cards to player, 2 to dealer
    state.playerHand.push(this.drawCard(state));
    state.playerHand.push(this.drawCard(state));
    state.dealerHand.push(this.drawCard(state));
    state.dealerHand.push(this.drawCard(state));

    await this.saveSession(userId, state);

    return {
      playerHand: state.playerHand,
      dealerHand: [
        { index: -1, suit: 'hidden', rank: '?', value: 0 },
        { index: -1, suit: 'hidden', rank: '?', value: 0 },
      ],
      communityCards: [],
      phase: 'preflop',
      anteBet: bet.amount,
      totalBet: bet.amount,
      serverSeedHash: seeds.serverSeedHash,
    };
  }

  /**
   * Player action: call at preflop (costs 2x ante, deals flop)
   */
  async call(userId: string): Promise<any> {
    const state = await this.requireActiveGame(userId);

    if (state.phase !== 'preflop') {
      throw new GameError('INVALID_ACTION', 'Call is only available at preflop. Use check or raise on later streets.');
    }

    const callAmount = state.anteBet * 2;
    await this.validateBet(userId, callAmount, state.currency);
    await this.deductBalance(userId, callAmount, state.currency);

    state.callBet = callAmount;
    state.totalBet += callAmount;
    state.phase = 'flop';

    // Deal 3 community cards (flop)
    state.communityCards.push(this.drawCard(state));
    state.communityCards.push(this.drawCard(state));
    state.communityCards.push(this.drawCard(state));

    await this.saveSession(userId, state);

    return {
      playerHand: state.playerHand,
      dealerHand: [
        { index: -1, suit: 'hidden', rank: '?', value: 0 },
        { index: -1, suit: 'hidden', rank: '?', value: 0 },
      ],
      communityCards: state.communityCards,
      phase: state.phase,
      totalBet: state.totalBet,
      anteBet: state.anteBet,
      callBet: state.callBet,
    };
  }

  /**
   * Player folds - loses ante (and any bets placed so far)
   */
  async fold(userId: string): Promise<any> {
    const state = await this.requireActiveGame(userId);

    if (state.phase === 'showdown' || state.phase === 'folded') {
      throw new GameError('GAME_COMPLETE', 'Game is already complete.');
    }

    state.phase = 'folded';
    state.isComplete = true;

    await this.incrementNonce(userId);

    await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: state.totalBet,
      payout: 0,
      multiplier: 0,
      result: this.buildResultSummary(state, null, null, 'fold'),
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    // Clean up completed session from Redis
    await this.deleteSession(userId);

    return {
      playerHand: state.playerHand,
      dealerHand: state.dealerHand,
      communityCards: state.communityCards,
      phase: 'folded',
      winner: 'dealer',
      payout: 0,
      totalBet: state.totalBet,
      playerHandName: null,
      dealerHandName: null,
      playerBestHand: null,
      dealerBestHand: null,
    };
  }

  /**
   * Player checks (no additional bet, advances to next street)
   */
  async check(userId: string): Promise<any> {
    const state = await this.requireActiveGame(userId);

    if (state.phase === 'preflop') {
      throw new GameError('INVALID_ACTION', 'Cannot check preflop. You must call or fold.');
    }
    if (state.phase !== 'flop' && state.phase !== 'turn' && state.phase !== 'river') {
      throw new GameError('INVALID_ACTION', 'Cannot check in current phase.');
    }

    return this.advanceStreet(state, userId, 0);
  }

  /**
   * Player raises (bets 1x ante on current street, advances)
   */
  async raise(userId: string): Promise<any> {
    const state = await this.requireActiveGame(userId);

    if (state.phase === 'preflop') {
      throw new GameError('INVALID_ACTION', 'Cannot raise preflop. Use call.');
    }
    if (state.phase !== 'flop' && state.phase !== 'turn' && state.phase !== 'river') {
      throw new GameError('INVALID_ACTION', 'Cannot raise in current phase.');
    }

    const raiseAmount = state.anteBet;
    await this.validateBet(userId, raiseAmount, state.currency);
    await this.deductBalance(userId, raiseAmount, state.currency);

    return this.advanceStreet(state, userId, raiseAmount);
  }

  /**
   * Advance to the next street after a check or raise
   */
  private async advanceStreet(state: PokerState, userId: string, betAmount: number): Promise<any> {
    if (state.phase === 'flop') {
      state.turnBet = betAmount;
      state.totalBet += betAmount;
      state.phase = 'turn';
      // Deal turn card
      state.communityCards.push(this.drawCard(state));
      await this.saveSession(userId, state);

      return {
        playerHand: state.playerHand,
        dealerHand: [
          { index: -1, suit: 'hidden', rank: '?', value: 0 },
          { index: -1, suit: 'hidden', rank: '?', value: 0 },
        ],
        communityCards: state.communityCards,
        phase: state.phase,
        totalBet: state.totalBet,
        anteBet: state.anteBet,
        callBet: state.callBet,
        turnBet: state.turnBet,
      };
    }

    if (state.phase === 'turn') {
      state.riverBet = betAmount;
      state.totalBet += betAmount;
      state.phase = 'river';
      // Deal river card
      state.communityCards.push(this.drawCard(state));
      await this.saveSession(userId, state);

      return {
        playerHand: state.playerHand,
        dealerHand: [
          { index: -1, suit: 'hidden', rank: '?', value: 0 },
          { index: -1, suit: 'hidden', rank: '?', value: 0 },
        ],
        communityCards: state.communityCards,
        phase: state.phase,
        totalBet: state.totalBet,
        anteBet: state.anteBet,
        callBet: state.callBet,
        turnBet: state.turnBet,
        riverBet: state.riverBet,
      };
    }

    if (state.phase === 'river') {
      // Additional river bet if raising
      if (betAmount > 0) {
        state.riverBet = betAmount;
        state.totalBet += betAmount;
      }
      // Go to showdown
      return this.showdown(state, userId);
    }

    throw new GameError('INVALID_PHASE', 'Cannot advance from current phase.');
  }

  /**
   * Showdown: evaluate both hands and determine winner
   */
  private async showdown(state: PokerState, userId: string): Promise<any> {
    state.phase = 'showdown';
    state.isComplete = true;

    const playerEval = this.evaluateBestHand(state.playerHand, state.communityCards);
    const dealerEval = this.evaluateBestHand(state.dealerHand, state.communityCards);

    const comparison = this.compareHands(playerEval, dealerEval);

    let winner: 'player' | 'dealer' | 'tie';
    let payout = 0;

    if (comparison > 0) {
      winner = 'player';
      // Player wins: gets back total bet + wins ante 1:1 + bonus for hand strength
      payout = state.totalBet * 2;
      // Add bonus payout based on hand rank
      const bonus = BONUS_PAYOUTS[playerEval.rank] || 0;
      if (bonus > 0) {
        payout += state.anteBet * bonus;
      }
    } else if (comparison < 0) {
      winner = 'dealer';
      payout = 0;
    } else {
      winner = 'tie';
      payout = state.totalBet; // push - return bets
    }

    if (payout > 0) {
      await this.creditWinnings(userId, payout, state.currency);
    }

    await this.incrementNonce(userId);

    const playerHandName = this.formatHandName(playerEval);
    const dealerHandName = this.formatHandName(dealerEval);

    await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: state.totalBet,
      payout,
      multiplier: state.totalBet > 0 ? payout / state.totalBet : 0,
      result: this.buildResultSummary(state, playerEval, dealerEval, winner),
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    // Clean up completed session from Redis
    await this.deleteSession(userId);

    return {
      playerHand: state.playerHand,
      dealerHand: state.dealerHand,
      communityCards: state.communityCards,
      playerBestHand: playerEval.cards,
      dealerBestHand: dealerEval.cards,
      playerHandName,
      dealerHandName,
      playerHandRank: playerEval.rank,
      dealerHandRank: dealerEval.rank,
      winner,
      payout,
      totalBet: state.totalBet,
      phase: 'showdown',
      anteBet: state.anteBet,
      callBet: state.callBet,
      turnBet: state.turnBet,
      riverBet: state.riverBet,
    };
  }

  /**
   * Get the current game state
   */
  async getActiveGame(userId: string): Promise<any> {
    const state = await this.getSession(userId);
    if (!state || state.isComplete) {
      return { isActive: false };
    }

    return {
      isActive: true,
      playerHand: state.playerHand,
      communityCards: state.communityCards,
      phase: state.phase,
      anteBet: state.anteBet,
      callBet: state.callBet,
      turnBet: state.turnBet,
      riverBet: state.riverBet,
      totalBet: state.totalBet,
      serverSeedHash: state.serverSeedHash,
    };
  }

  // =========================================================================
  // Internal helpers
  // =========================================================================

  private buildResultSummary(
    state: PokerState,
    playerEval: HandEvaluation | null,
    dealerEval: HandEvaluation | null,
    winner: string,
  ): any {
    return {
      playerHand: state.playerHand,
      dealerHand: state.dealerHand,
      communityCards: state.communityCards,
      playerHandName: playerEval ? this.formatHandName(playerEval) : null,
      dealerHandName: dealerEval ? this.formatHandName(dealerEval) : null,
      playerHandRank: playerEval?.rank ?? null,
      dealerHandRank: dealerEval?.rank ?? null,
      winner,
      anteBet: state.anteBet,
      callBet: state.callBet,
      turnBet: state.turnBet,
      riverBet: state.riverBet,
      totalBet: state.totalBet,
    };
  }

  private async requireActiveGame(userId: string): Promise<PokerState> {
    const state = await this.getSession(userId);
    if (!state || state.isComplete) {
      throw new GameError('NO_ACTIVE_GAME', 'No active Poker game found.');
    }
    return state;
  }

  // =========================================================================
  // Redis session
  // =========================================================================

  private async saveSession(userId: string, state: PokerState): Promise<void> {
    const key = PokerGame.REDIS_PREFIX + userId;
    await redis.set(key, JSON.stringify(state), 'EX', PokerGame.TTL);
  }

  private async getSession(userId: string): Promise<PokerState | null> {
    const key = PokerGame.REDIS_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as PokerState;
  }

  private async deleteSession(userId: string): Promise<void> {
    const key = PokerGame.REDIS_PREFIX + userId;
    await redis.del(key);
  }
}

export const pokerGame = new PokerGame();
export default pokerGame;
