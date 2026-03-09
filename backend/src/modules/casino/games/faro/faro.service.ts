import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Card helpers
// ---------------------------------------------------------------------------

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

interface Card {
  value: number;   // 1-13 (1=Ace, 11=J, 12=Q, 13=K)
  suit: string;
  display: string; // e.g. "A", "10", "K"
}

function indexToCard(deckIndex: number): Card {
  const cardIndex = deckIndex % 52;
  const suitIdx = Math.floor(cardIndex / 13);
  const rankIdx = cardIndex % 13;

  return {
    value: rankIdx + 1,
    suit: SUITS[suitIdx],
    display: RANK_NAMES[rankIdx],
  };
}

// ---------------------------------------------------------------------------
// Bet types & payouts
// ---------------------------------------------------------------------------

type FaroBetType = 'high' | 'low' | 'match';

const PAYOUTS: Record<FaroBetType, number> = {
  high: 1.9,
  low: 1.9,
  match: 11.0,
};

// ---------------------------------------------------------------------------
// FaroGame
// ---------------------------------------------------------------------------

export class FaroGame extends BaseGame {
  readonly name = 'Faro';
  readonly slug = 'faro';
  readonly houseEdge = 0.029;
  readonly minBet = 0.0001;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const opts = options as { bet?: string; cardValue?: number } | undefined;

    const betType = opts?.bet as FaroBetType | undefined;
    const cardValue = opts?.cardValue;

    // Validate bet type
    if (!betType || !['high', 'low', 'match'].includes(betType)) {
      throw new GameError('INVALID_BET_TYPE', 'bet must be "high", "low", or "match".');
    }

    // Validate cardValue for match bets
    if (betType === 'match') {
      if (cardValue === undefined || cardValue === null) {
        throw new GameError('MISSING_CARD_VALUE', 'cardValue (1-13) required for match bets.');
      }
      if (!Number.isInteger(cardValue) || cardValue < 1 || cardValue > 13) {
        throw new GameError('INVALID_CARD_VALUE', 'cardValue must be an integer between 1 and 13.');
      }
    }

    // Validate bet amount
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Draw 1 card
    const rawResult = this.fairService.generateResult(serverSeed, clientSeed, nonce);
    const deckIndex = Math.floor(rawResult * 52);
    const drawnCard = indexToCard(deckIndex);

    // Determine win
    let isWin = false;
    if (betType === 'low') {
      isWin = drawnCard.value >= 1 && drawnCard.value <= 7;
    } else if (betType === 'high') {
      isWin = drawnCard.value >= 8 && drawnCard.value <= 13;
    } else {
      // match
      isWin = drawnCard.value === cardValue;
    }

    const multiplier = isWin ? PAYOUTS[betType] : 0;
    const payout = Math.floor(amount * multiplier * 100000000) / 100000000;
    const profit = payout - amount;

    // Deduct balance
    await this.deductBalance(userId, amount, currency);

    // Credit winnings
    if (payout > 0) {
      await this.creditWinnings(userId, payout, currency);
    }

    // Result data — matches frontend FaroApiResponse.result
    const resultData = {
      drawnCard: {
        value: drawnCard.value,
        suit: drawnCard.suit,
        display: drawnCard.display,
      },
      bet: betType,
      cardValue: cardValue ?? drawnCard.value,
      isWin,
    };

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: amount,
      payout,
      multiplier: isWin ? multiplier : 0,
      result: resultData,
      serverSeedHash,
      clientSeed,
      nonce,
    });

    // Increment nonce
    await this.incrementNonce(userId);

    // Fetch updated balance
    const newBalance = await this.getBalance(userId, currency);

    return {
      roundId,
      game: this.slug,
      betAmount: amount,
      payout,
      profit,
      multiplier: isWin ? multiplier : 0,
      result: resultData,
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
      newBalance,
    };
  }
}

export const faroGame = new FaroGame();
export default faroGame;
