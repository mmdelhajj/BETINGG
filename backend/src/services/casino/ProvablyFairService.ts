import crypto from 'crypto';

export interface SeedPair {
  seed: string;
  hash: string;
}

export class ProvablyFairService {
  /**
   * Generate a new server seed and its SHA-256 hash.
   * The hash is revealed to the user before play so they can verify later.
   */
  generateServerSeed(): SeedPair {
    const seed = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return { seed, hash };
  }

  /**
   * Hash a server seed (used for verification).
   */
  hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Generate a single provably fair result in [0, 1).
   * Uses HMAC-SHA256(serverSeed, clientSeed:nonce), taking the first 8 hex chars
   * and dividing by 2^32.
   */
  generateResult(serverSeed: string, clientSeed: string, nonce: number): number {
    const hmac = crypto
      .createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');
    return parseInt(hmac.substring(0, 8), 16) / 0x100000000;
  }

  /**
   * Generate multiple provably fair results for games that need several random values
   * (e.g., Plinko path, Blackjack deck shuffle, Keno draw).
   * Each result uses a unique sub-index appended to the HMAC input.
   */
  generateMultipleResults(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    count: number,
  ): number[] {
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
      const hmac = crypto
        .createHmac('sha256', serverSeed)
        .update(`${clientSeed}:${nonce}:${i}`)
        .digest('hex');
      results.push(parseInt(hmac.substring(0, 8), 16) / 0x100000000);
    }
    return results;
  }

  /**
   * Generate a crash point using the provably fair algorithm.
   * House edge of 3% is baked in. Minimum crash point is 1.00.
   */
  generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
    const hmac = crypto
      .createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');
    const h = parseInt(hmac.substring(0, 8), 16);
    const e = Math.pow(2, 32);
    const houseEdge = 0.03;
    const result = ((1 - houseEdge) * e) / (e - h);
    return Math.max(1.0, Math.floor(result * 100) / 100);
  }

  /**
   * Generate a shuffled deck of 52 cards using provably fair randomness.
   * Uses Fisher-Yates shuffle with provably fair random values.
   * Returns array of card indices 0-51.
   */
  generateShuffledDeck(serverSeed: string, clientSeed: string, nonce: number): number[] {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    const randoms = this.generateMultipleResults(serverSeed, clientSeed, nonce, 52);

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(randoms[i] * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  /**
   * Generate mine positions for the Mines game.
   * Returns an array of `mineCount` unique positions in [0, 24].
   */
  generateMinePositions(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    mineCount: number,
  ): number[] {
    const positions: number[] = [];
    const available = Array.from({ length: 25 }, (_, i) => i);
    const randoms = this.generateMultipleResults(serverSeed, clientSeed, nonce, mineCount);

    for (let i = 0; i < mineCount; i++) {
      const idx = Math.floor(randoms[i] * available.length);
      positions.push(available[idx]);
      available.splice(idx, 1);
    }

    return positions.sort((a, b) => a - b);
  }

  /**
   * Verify a past game result by re-computing the outcome.
   * Returns the computed result so the client can compare.
   */
  verify(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    gameType: string,
  ): {
    hash: string;
    result: number | number[] | { crashPoint: number } | { deck: number[] } | { minePositions: number[] };
  } {
    const hash = this.hashServerSeed(serverSeed);

    switch (gameType) {
      case 'crash':
        return {
          hash,
          result: { crashPoint: this.generateCrashPoint(serverSeed, clientSeed, nonce) },
        };

      case 'dice':
      case 'coinflip':
      case 'limbo':
      case 'wheel':
        return {
          hash,
          result: this.generateResult(serverSeed, clientSeed, nonce),
        };

      case 'plinko': {
        // 16 rows max
        const path = this.generateMultipleResults(serverSeed, clientSeed, nonce, 16);
        return { hash, result: path };
      }

      case 'blackjack':
      case 'baccarat':
      case 'videopoker':
      case 'hilo': {
        const deck = this.generateShuffledDeck(serverSeed, clientSeed, nonce);
        return { hash, result: { deck } };
      }

      case 'roulette':
        return {
          hash,
          result: this.generateResult(serverSeed, clientSeed, nonce),
        };

      case 'mines': {
        // Default to 5 mines for verification; caller should specify
        return {
          hash,
          result: { minePositions: this.generateMinePositions(serverSeed, clientSeed, nonce, 5) },
        };
      }

      case 'keno': {
        const draws = this.generateMultipleResults(serverSeed, clientSeed, nonce, 10);
        return { hash, result: draws };
      }

      default:
        return {
          hash,
          result: this.generateResult(serverSeed, clientSeed, nonce),
        };
    }
  }
}

export const provablyFairService = new ProvablyFairService();
export default provablyFairService;
