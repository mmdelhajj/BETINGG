import { redis } from '../../../../lib/redis.js';
import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Blackjack Game
// ---------------------------------------------------------------------------
// Full Blackjack rules: hit, stand, double down, split.
// Dealer hits on soft 17.  Blackjack pays 3:2. Insurance not implemented.
// Stateful game persisted in Redis per user.
// ---------------------------------------------------------------------------

// Card representation: index 0-51, where:
//   suit = floor(index / 13)  → 0=spades, 1=hearts, 2=diamonds, 3=clubs
//   rank = index % 13         → 0=A, 1=2, 2=3, ..., 9=10, 10=J, 11=Q, 12=K

interface Card {
  index: number;
  suit: string;
  rank: string;
  value: number;   // face value (A=11 initially, face=10)
}

interface Hand {
  cards: Card[];
  bet: number;
  isStanding: boolean;
  isDoubled: boolean;
  isBusted: boolean;
  isBlackjack: boolean;
  payout: number;
}

interface BlackjackState {
  userId: string;
  currency: string;
  deck: number[];           // remaining deck indices
  deckPosition: number;     // next card index in the deck
  playerHands: Hand[];      // can be multiple if split
  dealerHand: Hand;
  activeHandIndex: number;  // which hand the player is currently playing
  isComplete: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export class BlackjackGame extends BaseGame {
  readonly name = 'Blackjack';
  readonly slug = 'blackjack';
  readonly houseEdge = 0.005; // ~0.5% with basic strategy
  readonly minBet = 0.1;
  readonly maxBet = 10000;

  private static REDIS_PREFIX = 'blackjack:session:';
  private static TTL = 3600;

  async play(_userId: string, _bet: BetRequest): Promise<GameResult> {
    throw new GameError('NOT_SUPPORTED', 'Use deal/hit/stand/double/split for Blackjack.');
  }

  // =======================================================================
  // Card helpers
  // =======================================================================

  private indexToCard(index: number): Card {
    const suitIdx = Math.floor(index / 13);
    const rankIdx = index % 13;
    const rank = RANKS[rankIdx];

    let value: number;
    if (rankIdx === 0) value = 11;        // Ace
    else if (rankIdx >= 10) value = 10;   // Face cards
    else value = rankIdx + 1;             // Number cards

    return {
      index,
      suit: SUITS[suitIdx],
      rank,
      value,
    };
  }

  private calculateHandValue(cards: Card[]): { total: number; soft: boolean } {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (card.rank === 'A') {
        aces++;
        total += 11;
      } else {
        total += card.value;
      }
    }

    // Reduce aces from 11 to 1 as needed
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return { total, soft: aces > 0 };
  }

  private isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && this.calculateHandValue(cards).total === 21;
  }

  private drawCard(state: BlackjackState): Card {
    if (state.deckPosition >= state.deck.length) {
      throw new GameError('DECK_EMPTY', 'Deck is exhausted.');
    }
    const cardIndex = state.deck[state.deckPosition];
    state.deckPosition++;
    return this.indexToCard(cardIndex);
  }

  // =======================================================================
  // Game actions
  // =======================================================================

  /**
   * Deal a new hand of Blackjack.
   */
  async deal(
    userId: string,
    bet: BetRequest,
  ): Promise<{
    playerHands: Array<{ cards: Card[]; total: number; soft: boolean }>;
    dealerUpCard: Card;
    dealerTotal: number;
    isBlackjack: boolean;
    isComplete: boolean;
    payout: number;
    serverSeedHash: string;
  }> {
    // Check for existing active game
    const existing = await this.getSession(userId);
    if (existing && !existing.isComplete) {
      throw new GameError('GAME_IN_PROGRESS', 'You already have an active Blackjack hand.');
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get seeds and generate shuffled deck
    const seeds = await this.getUserSeeds(userId);
    const deck = this.fairService.generateShuffledDeck(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    const state: BlackjackState = {
      userId,
      currency: bet.currency,
      deck,
      deckPosition: 0,
      playerHands: [],
      dealerHand: {
        cards: [],
        bet: 0,
        isStanding: false,
        isDoubled: false,
        isBusted: false,
        isBlackjack: false,
        payout: 0,
      },
      activeHandIndex: 0,
      isComplete: false,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    };

    // Deal 2 cards to player, 2 to dealer
    const playerHand: Hand = {
      cards: [],
      bet: bet.amount,
      isStanding: false,
      isDoubled: false,
      isBusted: false,
      isBlackjack: false,
      payout: 0,
    };

    playerHand.cards.push(this.drawCard(state));
    state.dealerHand.cards.push(this.drawCard(state));
    playerHand.cards.push(this.drawCard(state));
    state.dealerHand.cards.push(this.drawCard(state));

    state.playerHands.push(playerHand);

    // Check for natural blackjack
    const playerBJ = this.isBlackjack(playerHand.cards);
    const dealerBJ = this.isBlackjack(state.dealerHand.cards);

    let payout = 0;

    if (playerBJ || dealerBJ) {
      state.isComplete = true;

      if (playerBJ && dealerBJ) {
        // Push
        payout = bet.amount;
        playerHand.payout = payout;
      } else if (playerBJ) {
        // Player blackjack pays 3:2
        payout = bet.amount + bet.amount * 1.5;
        playerHand.payout = payout;
        playerHand.isBlackjack = true;
      } else {
        // Dealer blackjack
        payout = 0;
        state.dealerHand.isBlackjack = true;
      }

      if (payout > 0) {
        await this.creditWinnings(userId, payout, bet.currency);
      }

      await this.incrementNonce(userId);

      await this.recordRound({
        userId,
        gameSlug: this.slug,
        betAmount: bet.amount,
        payout,
        multiplier: payout / bet.amount,
        result: this.buildResultSummary(state),
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.nonce,
      });
    }

    await this.saveSession(userId, state);

    const playerTotal = this.calculateHandValue(playerHand.cards);
    const dealerUpCard = state.dealerHand.cards[0];

    return {
      playerHands: [
        {
          cards: playerHand.cards,
          total: playerTotal.total,
          soft: playerTotal.soft,
        },
      ],
      dealerUpCard,
      dealerTotal: dealerUpCard.value,
      isBlackjack: playerBJ,
      isComplete: state.isComplete,
      payout,
      serverSeedHash: seeds.serverSeedHash,
    };
  }

  /**
   * Hit: draw one more card for the active hand.
   */
  async hit(userId: string): Promise<{
    card: Card;
    hand: { cards: Card[]; total: number; soft: boolean };
    isBusted: boolean;
    isComplete: boolean;
    payout: number;
    dealerHand?: { cards: Card[]; total: number };
  }> {
    const state = await this.requireActiveGame(userId);
    const hand = state.playerHands[state.activeHandIndex];

    if (hand.isStanding || hand.isBusted) {
      throw new GameError('HAND_COMPLETE', 'This hand is already complete.');
    }

    const card = this.drawCard(state);
    hand.cards.push(card);

    const handValue = this.calculateHandValue(hand.cards);

    let result: any = {
      card,
      hand: { cards: hand.cards, total: handValue.total, soft: handValue.soft },
      isBusted: false,
      isComplete: false,
      payout: 0,
    };

    if (handValue.total > 21) {
      hand.isBusted = true;
      hand.payout = 0;
      result.isBusted = true;

      // Move to next hand or complete
      const resolved = await this.advanceOrComplete(state, userId);
      result.isComplete = resolved.isComplete;
      result.payout = resolved.totalPayout;
      if (resolved.isComplete) {
        result.dealerHand = {
          cards: state.dealerHand.cards,
          total: this.calculateHandValue(state.dealerHand.cards).total,
        };
      }
    } else if (handValue.total === 21) {
      // Auto-stand on 21
      hand.isStanding = true;
      const resolved = await this.advanceOrComplete(state, userId);
      result.isComplete = resolved.isComplete;
      result.payout = resolved.totalPayout;
      if (resolved.isComplete) {
        result.dealerHand = {
          cards: state.dealerHand.cards,
          total: this.calculateHandValue(state.dealerHand.cards).total,
        };
      }
    }

    await this.saveSession(userId, state);
    return result;
  }

  /**
   * Stand: stop drawing on the active hand.
   */
  async stand(userId: string): Promise<{
    isComplete: boolean;
    payout: number;
    dealerHand?: { cards: Card[]; total: number };
    results?: Array<{ hand: { cards: Card[]; total: number }; payout: number; outcome: string }>;
  }> {
    const state = await this.requireActiveGame(userId);
    const hand = state.playerHands[state.activeHandIndex];

    if (hand.isStanding || hand.isBusted) {
      throw new GameError('HAND_COMPLETE', 'This hand is already complete.');
    }

    hand.isStanding = true;

    const resolved = await this.advanceOrComplete(state, userId);
    await this.saveSession(userId, state);

    const result: any = {
      isComplete: resolved.isComplete,
      payout: resolved.totalPayout,
    };

    if (resolved.isComplete) {
      result.dealerHand = {
        cards: state.dealerHand.cards,
        total: this.calculateHandValue(state.dealerHand.cards).total,
      };
      result.results = resolved.handResults;
    }

    return result;
  }

  /**
   * Double down: double the bet, take exactly one more card, then stand.
   */
  async double(userId: string): Promise<{
    card: Card;
    hand: { cards: Card[]; total: number; soft: boolean };
    isBusted: boolean;
    isComplete: boolean;
    payout: number;
    dealerHand?: { cards: Card[]; total: number };
  }> {
    const state = await this.requireActiveGame(userId);
    const hand = state.playerHands[state.activeHandIndex];

    if (hand.cards.length !== 2) {
      throw new GameError('CANNOT_DOUBLE', 'Can only double on initial 2 cards.');
    }
    if (hand.isStanding || hand.isBusted) {
      throw new GameError('HAND_COMPLETE', 'This hand is already complete.');
    }

    // Deduct additional bet
    await this.validateBet(userId, hand.bet, state.currency);
    await this.deductBalance(userId, hand.bet, state.currency);
    hand.bet *= 2;
    hand.isDoubled = true;

    // Draw exactly one card
    const card = this.drawCard(state);
    hand.cards.push(card);

    const handValue = this.calculateHandValue(hand.cards);

    if (handValue.total > 21) {
      hand.isBusted = true;
      hand.payout = 0;
    }

    // Auto-stand after double
    hand.isStanding = true;

    const resolved = await this.advanceOrComplete(state, userId);
    await this.saveSession(userId, state);

    const result: any = {
      card,
      hand: { cards: hand.cards, total: handValue.total, soft: handValue.soft },
      isBusted: hand.isBusted,
      isComplete: resolved.isComplete,
      payout: resolved.totalPayout,
    };

    if (resolved.isComplete) {
      result.dealerHand = {
        cards: state.dealerHand.cards,
        total: this.calculateHandValue(state.dealerHand.cards).total,
      };
    }

    return result;
  }

  /**
   * Split: if the player has a pair, split into two hands.
   */
  async split(userId: string): Promise<{
    hands: Array<{ cards: Card[]; total: number; soft: boolean; bet: number }>;
    isComplete: boolean;
  }> {
    const state = await this.requireActiveGame(userId);
    const hand = state.playerHands[state.activeHandIndex];

    if (hand.cards.length !== 2) {
      throw new GameError('CANNOT_SPLIT', 'Can only split on initial 2 cards.');
    }

    const rankA = hand.cards[0].rank;
    const rankB = hand.cards[1].rank;

    if (rankA !== rankB) {
      throw new GameError('CANNOT_SPLIT', 'Can only split a pair.');
    }

    if (state.playerHands.length >= 4) {
      throw new GameError('MAX_SPLITS', 'Maximum of 4 hands allowed.');
    }

    // Deduct additional bet for the new hand
    await this.validateBet(userId, hand.bet, state.currency);
    await this.deductBalance(userId, hand.bet, state.currency);

    // Create second hand
    const secondCard = hand.cards.pop()!;
    const newHand: Hand = {
      cards: [secondCard],
      bet: hand.bet,
      isStanding: false,
      isDoubled: false,
      isBusted: false,
      isBlackjack: false,
      payout: 0,
    };

    // Deal one card to each hand
    hand.cards.push(this.drawCard(state));
    newHand.cards.push(this.drawCard(state));

    // Insert new hand after the current one
    state.playerHands.splice(state.activeHandIndex + 1, 0, newHand);

    await this.saveSession(userId, state);

    return {
      hands: state.playerHands.map((h) => {
        const val = this.calculateHandValue(h.cards);
        return {
          cards: h.cards,
          total: val.total,
          soft: val.soft,
          bet: h.bet,
        };
      }),
      isComplete: false,
    };
  }

  /**
   * Get the current game state for the client.
   */
  async getActiveGame(userId: string): Promise<any> {
    const state = await this.getSession(userId);
    if (!state || state.isComplete) {
      return { isActive: false };
    }

    return {
      isActive: true,
      playerHands: state.playerHands.map((h) => {
        const val = this.calculateHandValue(h.cards);
        return {
          cards: h.cards,
          total: val.total,
          soft: val.soft,
          bet: h.bet,
          isStanding: h.isStanding,
          isBusted: h.isBusted,
        };
      }),
      dealerUpCard: state.dealerHand.cards[0],
      activeHandIndex: state.activeHandIndex,
      serverSeedHash: state.serverSeedHash,
    };
  }

  // =======================================================================
  // Internal
  // =======================================================================

  /**
   * After a hand completes (bust or stand), advance to the next hand
   * or play out the dealer and settle all hands.
   */
  private async advanceOrComplete(
    state: BlackjackState,
    userId: string,
  ): Promise<{
    isComplete: boolean;
    totalPayout: number;
    handResults?: Array<{ hand: { cards: Card[]; total: number }; payout: number; outcome: string }>;
  }> {
    // Check if there are more hands to play
    const nextIdx = state.activeHandIndex + 1;
    if (nextIdx < state.playerHands.length) {
      const nextHand = state.playerHands[nextIdx];
      if (!nextHand.isStanding && !nextHand.isBusted) {
        state.activeHandIndex = nextIdx;
        return { isComplete: false, totalPayout: 0 };
      }
    }

    // Check if ALL hands are resolved
    const allDone = state.playerHands.every((h) => h.isStanding || h.isBusted);
    if (!allDone) {
      // Move to the first unfinished hand
      for (let i = 0; i < state.playerHands.length; i++) {
        if (!state.playerHands[i].isStanding && !state.playerHands[i].isBusted) {
          state.activeHandIndex = i;
          return { isComplete: false, totalPayout: 0 };
        }
      }
    }

    // All hands complete — play dealer
    const anyNonBusted = state.playerHands.some((h) => !h.isBusted);

    if (anyNonBusted) {
      // Dealer draws until 17+
      let dealerValue = this.calculateHandValue(state.dealerHand.cards);
      while (dealerValue.total < 17) {
        state.dealerHand.cards.push(this.drawCard(state));
        dealerValue = this.calculateHandValue(state.dealerHand.cards);
      }

      if (dealerValue.total > 21) {
        state.dealerHand.isBusted = true;
      }
    }

    // Settle each hand
    const dealerTotal = this.calculateHandValue(state.dealerHand.cards).total;
    const dealerBusted = state.dealerHand.isBusted;

    let totalPayout = 0;
    let totalBet = 0;
    const handResults: Array<{
      hand: { cards: Card[]; total: number };
      payout: number;
      outcome: string;
    }> = [];

    for (const hand of state.playerHands) {
      totalBet += hand.bet;
      const playerTotal = this.calculateHandValue(hand.cards).total;
      let outcome: string;

      if (hand.isBusted) {
        hand.payout = 0;
        outcome = 'bust';
      } else if (dealerBusted) {
        hand.payout = hand.bet * 2;
        outcome = 'win';
      } else if (playerTotal > dealerTotal) {
        hand.payout = hand.bet * 2;
        outcome = 'win';
      } else if (playerTotal === dealerTotal) {
        hand.payout = hand.bet;
        outcome = 'push';
      } else {
        hand.payout = 0;
        outcome = 'lose';
      }

      totalPayout += hand.payout;
      handResults.push({
        hand: { cards: hand.cards, total: playerTotal },
        payout: hand.payout,
        outcome,
      });
    }

    // Credit total payout
    if (totalPayout > 0) {
      await this.creditWinnings(userId, totalPayout, state.currency);
    }

    state.isComplete = true;
    await this.incrementNonce(userId);

    // Record round
    await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: totalBet,
      payout: totalPayout,
      multiplier: totalBet > 0 ? totalPayout / totalBet : 0,
      result: this.buildResultSummary(state),
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    return { isComplete: true, totalPayout, handResults };
  }

  private buildResultSummary(state: BlackjackState): any {
    return {
      playerHands: state.playerHands.map((h) => ({
        cards: h.cards,
        total: this.calculateHandValue(h.cards).total,
        bet: h.bet,
        payout: h.payout,
        isBusted: h.isBusted,
        isBlackjack: h.isBlackjack,
        isDoubled: h.isDoubled,
      })),
      dealerHand: {
        cards: state.dealerHand.cards,
        total: this.calculateHandValue(state.dealerHand.cards).total,
        isBusted: state.dealerHand.isBusted,
        isBlackjack: state.dealerHand.isBlackjack,
      },
    };
  }

  private async requireActiveGame(userId: string): Promise<BlackjackState> {
    const state = await this.getSession(userId);
    if (!state || state.isComplete) {
      throw new GameError('NO_ACTIVE_GAME', 'No active Blackjack game found.');
    }
    return state;
  }

  // =======================================================================
  // Redis session
  // =======================================================================

  private async saveSession(userId: string, state: BlackjackState): Promise<void> {
    const key = BlackjackGame.REDIS_PREFIX + userId;
    await redis.set(key, JSON.stringify(state), 'EX', BlackjackGame.TTL);
  }

  private async getSession(userId: string): Promise<BlackjackState | null> {
    const key = BlackjackGame.REDIS_PREFIX + userId;
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as BlackjackState;
  }

  private async deleteSession(userId: string): Promise<void> {
    const key = BlackjackGame.REDIS_PREFIX + userId;
    await redis.del(key);
  }
}

export const blackjackGame = new BlackjackGame();
export default blackjackGame;
