import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Card helpers
// ---------------------------------------------------------------------------

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

interface Card {
  rank: string;
  suit: string;
  value: number; // baccarat value: A=1, 2-9=face, 10/J/Q/K=0
}

/**
 * Convert a deck index (0-51) to a Card.
 * We use an 8-deck shoe, so index range is 0-415.
 * Each index maps to (index % 52) for card identity.
 */
function indexToCard(deckIndex: number): Card {
  const cardIndex = deckIndex % 52;
  const suitIdx = Math.floor(cardIndex / 13);
  const rankIdx = cardIndex % 13;
  const rank = RANKS[rankIdx];

  let value: number;
  if (rankIdx === 0) {
    value = 1; // Ace
  } else if (rankIdx >= 1 && rankIdx <= 8) {
    value = rankIdx + 1; // 2-9
  } else {
    value = 0; // 10, J, Q, K
  }

  return {
    rank,
    suit: SUITS[suitIdx],
    value,
  };
}

type BetOn = 'player' | 'banker' | 'tie';

// ---------------------------------------------------------------------------
// BaccaratGame
// ---------------------------------------------------------------------------

export class BaccaratGame extends BaseGame {
  readonly name = 'Baccarat';
  readonly slug = 'baccarat';
  readonly houseEdge = 0.012;
  readonly minBet = 0.1;
  readonly maxBet = 10000;

  private static readonly BANKER_COMMISSION = 0.05;

  // Payouts
  private static readonly PAYOUTS: Record<BetOn, Record<string, number>> = {
    player: { player: 2.0, banker: 0, tie: 1.0 }, // 1:1 pay, tie = push
    banker: { player: 0, banker: 1.95, tie: 1.0 }, // 0.95:1 pay (5% commission), tie = push
    tie:    { player: 0, banker: 0, tie: 9.0 },     // 8:1 pay
  };

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const betOn = (options as { betOn?: BetOn })?.betOn;

    // Validate bet type
    if (!betOn || !['player', 'banker', 'tie'].includes(betOn)) {
      throw new GameError('INVALID_BET', 'betOn must be player, banker, or tie.');
    }

    // Validate bet amount
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Shuffle an 8-deck shoe using provably fair
    // For efficiency, we only need at most 6 cards, so we generate
    // 6 random values and use them to select from a virtual shoe
    const shoe = this.generateShoe(serverSeed, clientSeed, nonce);

    // Deal initial cards
    let cardIdx = 0;
    const playerCards: Card[] = [shoe[cardIdx++], shoe[cardIdx++]];
    const bankerCards: Card[] = [shoe[cardIdx++], shoe[cardIdx++]];

    let playerTotal = this.calculateHandValue(playerCards);
    let bankerTotal = this.calculateHandValue(bankerCards);

    let playerThirdCard: Card | null = null;
    let bankerThirdCard: Card | null = null;

    // Check for naturals (8 or 9)
    const playerNatural = playerTotal >= 8;
    const bankerNatural = bankerTotal >= 8;

    if (!playerNatural && !bankerNatural) {
      // Player drawing rule: player draws on 0-5
      if (this.shouldPlayerDraw(playerTotal)) {
        playerThirdCard = shoe[cardIdx++];
        playerCards.push(playerThirdCard);
        playerTotal = this.calculateHandValue(playerCards);
      }

      // Banker drawing rule (depends on player's third card)
      if (this.shouldBankerDraw(bankerTotal, playerThirdCard)) {
        bankerThirdCard = shoe[cardIdx++];
        bankerCards.push(bankerThirdCard);
        bankerTotal = this.calculateHandValue(bankerCards);
      }
    }

    // Determine winner
    let winner: 'player' | 'banker' | 'tie';
    if (playerTotal > bankerTotal) {
      winner = 'player';
    } else if (bankerTotal > playerTotal) {
      winner = 'banker';
    } else {
      winner = 'tie';
    }

    // Calculate payout
    const payoutMultiplier = BaccaratGame.PAYOUTS[betOn][winner];
    const payout = amount * payoutMultiplier;
    const profit = payout - amount;

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Credit winnings (or return stake on push)
    if (payout > 0) {
      await this.creditWinnings(userId, payout, currency);
    }

    // Record round
    const resultData = {
      betOn,
      winner,
      playerCards: playerCards.map((c) => ({ rank: c.rank, suit: c.suit, value: c.value })),
      bankerCards: bankerCards.map((c) => ({ rank: c.rank, suit: c.suit, value: c.value })),
      playerTotal,
      bankerTotal,
      playerNatural,
      bankerNatural,
      playerThirdCard: playerThirdCard
        ? { rank: playerThirdCard.rank, suit: playerThirdCard.suit, value: playerThirdCard.value }
        : null,
      bankerThirdCard: bankerThirdCard
        ? { rank: bankerThirdCard.rank, suit: bankerThirdCard.suit, value: bankerThirdCard.value }
        : null,
    };

    const multiplier = payoutMultiplier > 0 ? payoutMultiplier : 0;

    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: amount,
      payout,
      multiplier,
      result: resultData,
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
      result: resultData,
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
      newBalance,
    };
  }

  // -------------------------------------------------------------------------
  // Baccarat rules
  // -------------------------------------------------------------------------

  /**
   * Calculate hand value: sum of card values mod 10.
   */
  calculateHandValue(cards: Card[]): number {
    const sum = cards.reduce((acc, card) => acc + card.value, 0);
    return sum % 10;
  }

  /**
   * Player draws a third card if total is 0-5.
   */
  shouldPlayerDraw(playerTotal: number): boolean {
    return playerTotal <= 5;
  }

  /**
   * Banker drawing rules (standard baccarat tableau).
   * If player did NOT draw (stood), banker draws on 0-5.
   * If player DID draw, banker decision depends on banker total and player's third card value.
   */
  shouldBankerDraw(bankerTotal: number, playerThirdCard: Card | null): boolean {
    // If player did not draw (stood on 6 or 7)
    if (!playerThirdCard) {
      return bankerTotal <= 5;
    }

    const p3 = playerThirdCard.value;

    switch (bankerTotal) {
      case 0:
      case 1:
      case 2:
        // Banker always draws on 0-2
        return true;

      case 3:
        // Banker draws unless player's third card is 8
        return p3 !== 8;

      case 4:
        // Banker draws if player's third card is 2-7
        return p3 >= 2 && p3 <= 7;

      case 5:
        // Banker draws if player's third card is 4-7
        return p3 >= 4 && p3 <= 7;

      case 6:
        // Banker draws if player's third card is 6 or 7
        return p3 === 6 || p3 === 7;

      case 7:
        // Banker always stands on 7
        return false;

      default:
        // 8 or 9 - natural, should not reach here
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Shoe generation
  // -------------------------------------------------------------------------

  /**
   * Generate a virtual 8-deck shoe. We need at most 6 cards per round.
   * We use provably fair random values to select cards from the shoe.
   */
  private generateShoe(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
  ): Card[] {
    const totalCards = 52 * 8; // 8-deck shoe = 416 cards
    const neededCards = 6; // Max cards in a baccarat round

    const randoms = this.fairService.generateMultipleResults(
      serverSeed,
      clientSeed,
      nonce,
      neededCards,
    );

    // Build virtual shoe (all 416 card indices)
    const available = Array.from({ length: totalCards }, (_, i) => i);
    const selected: Card[] = [];

    for (let i = 0; i < neededCards; i++) {
      const idx = Math.floor(randoms[i] * available.length);
      selected.push(indexToCard(available[idx]));
      available.splice(idx, 1);
    }

    return selected;
  }
}

export const baccaratGame = new BaccaratGame();
export default baccaratGame;
