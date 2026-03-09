import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Bingo constants
// ---------------------------------------------------------------------------

const BINGO_COLUMNS = {
  B: { min: 1, max: 15 },
  I: { min: 16, max: 30 },
  N: { min: 31, max: 45 },
  G: { min: 46, max: 60 },
  O: { min: 61, max: 75 },
} as const;

const COLUMN_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const CARD_SIZE = 5;
const DRAW_COUNT = 30;
const TOTAL_NUMBERS = 75;
const MIN_CARD_COUNT = 1;
const MAX_CARD_COUNT = 3;

// ---------------------------------------------------------------------------
// Payout multipliers
// ---------------------------------------------------------------------------

const PAYOUTS = {
  line: 3,          // any complete row
  diagonal: 4,      // either diagonal
  four_corners: 8,  // all 4 corners
  full_card: 50,    // all 24 daubed + free space
  blackout: 100,    // all matched within first 24 draws
} as const;

// ---------------------------------------------------------------------------
// Win detection types
// ---------------------------------------------------------------------------

interface WinEntry {
  type: 'line' | 'diagonal' | 'four_corners' | 'full_card' | 'blackout';
  card: number;           // card index (0-based)
  positions: number[][];  // [row, col] pairs
  multiplier: number;
}

// ---------------------------------------------------------------------------
// BingoGame
// ---------------------------------------------------------------------------

export class BingoGame extends BaseGame {
  readonly name = 'Bingo';
  readonly slug = 'bingo';
  readonly houseEdge = 0.04;
  readonly minBet = 0.0001;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const cardCount = (options as { cardCount?: number })?.cardCount ?? 1;

    // Validate card count
    if (!Number.isInteger(cardCount) || cardCount < MIN_CARD_COUNT || cardCount > MAX_CARD_COUNT) {
      throw new GameError('INVALID_CARD_COUNT', `cardCount must be between ${MIN_CARD_COUNT} and ${MAX_CARD_COUNT}.`);
    }

    // Total bet is amount * cardCount
    const totalBet = amount * cardCount;

    // Validate bet amount (per card)
    await this.validateBet(userId, totalBet, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // We need enough random values for:
    //   - card generation: 5 numbers per column * 5 columns * cardCount (each pick from shrinking pool)
    //   - draw: 30 numbers from 75
    // Total needed: cardCount * 25 + 30 (but FREE space means 24 per card)
    const totalRandomsNeeded = cardCount * 24 + DRAW_COUNT;
    const randoms = this.fairService.generateMultipleResults(
      serverSeed,
      clientSeed,
      nonce,
      totalRandomsNeeded,
    );

    let randomIdx = 0;

    // Generate bingo cards
    const cards: number[][][] = [];
    for (let c = 0; c < cardCount; c++) {
      const card: number[][] = [];
      for (let col = 0; col < CARD_SIZE; col++) {
        const letter = COLUMN_LETTERS[col];
        const { min, max } = BINGO_COLUMNS[letter];
        const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        const column: number[] = [];

        for (let row = 0; row < CARD_SIZE; row++) {
          // Center cell (row=2, col=2) is FREE
          if (row === 2 && col === 2) {
            column.push(0); // 0 represents FREE space
            continue;
          }
          const idx = Math.floor(randoms[randomIdx] * available.length);
          column.push(available[idx]);
          available.splice(idx, 1);
          randomIdx++;
        }

        card.push(column);
      }
      cards.push(card);
    }

    // Generate 30 drawn numbers from 1-75 (no duplicates)
    const availableNumbers = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);
    const drawnNumbers: number[] = [];

    for (let i = 0; i < DRAW_COUNT; i++) {
      const idx = Math.floor(randoms[randomIdx] * availableNumbers.length);
      drawnNumbers.push(availableNumbers[idx]);
      availableNumbers.splice(idx, 1);
      randomIdx++;
    }

    // Check for wins on each card
    const drawnSet = new Set(drawnNumbers);
    // For blackout check we need to know if all matched within first 24 draws
    const drawnFirst24 = new Set(drawnNumbers.slice(0, 24));

    const allWins: WinEntry[] = [];

    for (let c = 0; c < cardCount; c++) {
      const card = cards[c];
      const wins = this.checkWins(card, drawnSet, drawnFirst24, c);
      allWins.push(...wins);
    }

    // Calculate total multiplier (best win per card, summed across cards)
    // We take the highest multiplier win per card to avoid double-counting
    // (e.g. a full card also means lines + diagonals)
    let totalMultiplier = 0;
    for (let c = 0; c < cardCount; c++) {
      const cardWins = allWins.filter((w) => w.card === c);
      if (cardWins.length > 0) {
        // Take the best multiplier for this card
        const bestMultiplier = Math.max(...cardWins.map((w) => w.multiplier));
        totalMultiplier += bestMultiplier;
      }
    }

    const payout = amount * totalMultiplier; // payout per card * multiplier
    const profit = payout - totalBet;

    // Deduct total balance
    await this.deductBalance(userId, totalBet, currency);

    // Credit winnings if any
    if (payout > 0) {
      await this.creditWinnings(userId, payout, currency);
    }

    // Prepare cards in row-major format for the result (5 rows x 5 cols)
    const cardsRowMajor = cards.map((card) => {
      const rows: number[][] = [];
      for (let row = 0; row < CARD_SIZE; row++) {
        const rowData: number[] = [];
        for (let col = 0; col < CARD_SIZE; col++) {
          rowData.push(card[col][row]);
        }
        rows.push(rowData);
      }
      return rows;
    });

    const resultData = {
      cards: cardsRowMajor,
      drawnNumbers,
      wins: allWins.map((w) => ({
        type: w.type,
        card: w.card,
        positions: w.positions,
        multiplier: w.multiplier,
      })),
      totalMultiplier,
      payout,
      cardCount,
    };

    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: totalBet,
      payout,
      multiplier: totalMultiplier,
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
      betAmount: totalBet,
      payout,
      profit,
      multiplier: totalMultiplier,
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
  // Win checking
  // -------------------------------------------------------------------------

  /**
   * Check all possible wins on a single bingo card.
   * Card is stored as card[col][row] (column-major).
   * Returns an array of WinEntry objects.
   */
  private checkWins(
    card: number[][],
    drawnSet: Set<number>,
    drawnFirst24: Set<number>,
    cardIndex: number,
  ): WinEntry[] {
    const wins: WinEntry[] = [];

    // Build a match grid: matched[row][col] = true if daubed
    const matched: boolean[][] = [];
    for (let row = 0; row < CARD_SIZE; row++) {
      matched.push([]);
      for (let col = 0; col < CARD_SIZE; col++) {
        const num = card[col][row];
        // FREE space is always matched
        if (num === 0) {
          matched[row].push(true);
        } else {
          matched[row].push(drawnSet.has(num));
        }
      }
    }

    // Build a match grid for first-24 draws (for blackout check)
    const matchedFirst24: boolean[][] = [];
    for (let row = 0; row < CARD_SIZE; row++) {
      matchedFirst24.push([]);
      for (let col = 0; col < CARD_SIZE; col++) {
        const num = card[col][row];
        if (num === 0) {
          matchedFirst24[row].push(true);
        } else {
          matchedFirst24[row].push(drawnFirst24.has(num));
        }
      }
    }

    // Check rows
    for (let row = 0; row < CARD_SIZE; row++) {
      if (matched[row].every(Boolean)) {
        wins.push({
          type: 'line',
          card: cardIndex,
          positions: Array.from({ length: CARD_SIZE }, (_, col) => [row, col]),
          multiplier: PAYOUTS.line,
        });
      }
    }

    // Check columns
    for (let col = 0; col < CARD_SIZE; col++) {
      const colMatched = Array.from({ length: CARD_SIZE }, (_, row) => matched[row][col]);
      if (colMatched.every(Boolean)) {
        wins.push({
          type: 'line',
          card: cardIndex,
          positions: Array.from({ length: CARD_SIZE }, (_, row) => [row, col]),
          multiplier: PAYOUTS.line,
        });
      }
    }

    // Check main diagonal (top-left to bottom-right)
    const diag1 = Array.from({ length: CARD_SIZE }, (_, i) => matched[i][i]);
    if (diag1.every(Boolean)) {
      wins.push({
        type: 'diagonal',
        card: cardIndex,
        positions: Array.from({ length: CARD_SIZE }, (_, i) => [i, i]),
        multiplier: PAYOUTS.diagonal,
      });
    }

    // Check anti-diagonal (top-right to bottom-left)
    const diag2 = Array.from({ length: CARD_SIZE }, (_, i) => matched[i][CARD_SIZE - 1 - i]);
    if (diag2.every(Boolean)) {
      wins.push({
        type: 'diagonal',
        card: cardIndex,
        positions: Array.from({ length: CARD_SIZE }, (_, i) => [i, CARD_SIZE - 1 - i]),
        multiplier: PAYOUTS.diagonal,
      });
    }

    // Check four corners
    const corners = [
      matched[0][0],
      matched[0][CARD_SIZE - 1],
      matched[CARD_SIZE - 1][0],
      matched[CARD_SIZE - 1][CARD_SIZE - 1],
    ];
    if (corners.every(Boolean)) {
      wins.push({
        type: 'four_corners',
        card: cardIndex,
        positions: [
          [0, 0],
          [0, CARD_SIZE - 1],
          [CARD_SIZE - 1, 0],
          [CARD_SIZE - 1, CARD_SIZE - 1],
        ],
        multiplier: PAYOUTS.four_corners,
      });
    }

    // Check full card (all 25 cells matched)
    const allMatched = matched.every((row) => row.every(Boolean));
    if (allMatched) {
      // Check if blackout (all matched within first 24 draws)
      const allMatchedFirst24 = matchedFirst24.every((row) => row.every(Boolean));
      if (allMatchedFirst24) {
        wins.push({
          type: 'blackout',
          card: cardIndex,
          positions: this.getAllPositions(),
          multiplier: PAYOUTS.blackout,
        });
      } else {
        wins.push({
          type: 'full_card',
          card: cardIndex,
          positions: this.getAllPositions(),
          multiplier: PAYOUTS.full_card,
        });
      }
    }

    return wins;
  }

  /**
   * Get all positions in a 5x5 grid.
   */
  private getAllPositions(): number[][] {
    const positions: number[][] = [];
    for (let row = 0; row < CARD_SIZE; row++) {
      for (let col = 0; col < CARD_SIZE; col++) {
        positions.push([row, col]);
      }
    }
    return positions;
  }
}

export const bingoGame = new BingoGame();
export default bingoGame;
