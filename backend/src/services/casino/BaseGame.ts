import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { ProvablyFairService } from './ProvablyFairService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameResult {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: any;
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance?: number;
}

export interface BetRequest {
  amount: number;
  currency: string;
  options?: any;
}

export interface UserSeeds {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  seedId: string;
}

// ---------------------------------------------------------------------------
// Abstract base game
// ---------------------------------------------------------------------------

export abstract class BaseGame {
  abstract readonly name: string;
  abstract readonly slug: string;
  abstract readonly houseEdge: number;
  abstract readonly minBet: number;
  abstract readonly maxBet: number;

  protected fairService = new ProvablyFairService();

  /**
   * Main entry point for instant-play games (dice, coinflip, plinko, roulette).
   * Stateful games (mines, blackjack, hilo, crash) override or provide their
   * own start/action/cashout methods.
   */
  abstract play(userId: string, bet: BetRequest): Promise<GameResult>;

  // -----------------------------------------------------------------------
  // Balance helpers — all use Prisma interactive transactions for atomicity
  // -----------------------------------------------------------------------

  protected async validateBet(
    userId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount)) {
      throw new GameError('BET_INVALID', 'Bet amount must be a valid number.');
    }
    if (!currency || typeof currency !== 'string') {
      throw new GameError('CURRENCY_INVALID', 'Currency must be a valid string.');
    }
    if (amount <= 0) {
      throw new GameError('BET_INVALID', 'Bet amount must be greater than zero.');
    }
    if (amount < this.minBet) {
      throw new GameError(
        'BET_TOO_LOW',
        `Minimum bet is ${this.minBet} ${currency}.`,
      );
    }
    if (amount > this.maxBet) {
      throw new GameError(
        'BET_TOO_HIGH',
        `Maximum bet is ${this.maxBet} ${currency}.`,
      );
    }

    // Check user is not banned / self-excluded
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        isBanned: true,
        selfExcludedUntil: true,
        coolingOffUntil: true,
      },
    });

    if (!user) {
      throw new GameError('USER_NOT_FOUND', 'User not found.');
    }
    if (!user.isActive || user.isBanned) {
      throw new GameError('USER_BANNED', 'Your account is suspended.');
    }
    if (user.selfExcludedUntil && user.selfExcludedUntil > new Date()) {
      throw new GameError(
        'SELF_EXCLUDED',
        'You are currently self-excluded from gambling.',
      );
    }
    if (user.coolingOffUntil && user.coolingOffUntil > new Date()) {
      throw new GameError(
        'COOLING_OFF',
        'You are currently in a cooling-off period.',
      );
    }

    // Check balance - auto-create wallet if it doesn't exist
    let wallet = await prisma.wallet.findFirst({
      where: {
        userId,
        currency: { symbol: currency },
      },
      include: { currency: true },
    });

    if (!wallet) {
      // Auto-create wallet for this currency
      const currencyRecord = await prisma.currency.findUnique({
        where: { symbol: currency.toUpperCase() },
      });
      if (!currencyRecord) {
        throw new GameError('CURRENCY_NOT_FOUND', `Currency ${currency} not found.`);
      }
      const newWallet = await prisma.wallet.create({
        data: { userId, currencyId: currencyRecord.id },
        include: { currency: true },
      });
      wallet = newWallet;
    }

    if (wallet.balance.toNumber() < amount) {
      throw new GameError(
        'INSUFFICIENT_BALANCE',
        `Insufficient ${currency} balance. Available: ${wallet.balance.toNumber()}.`,
      );
    }
  }

  /**
   * Atomically deduct balance and record the BET transaction.
   */
  protected async deductBalance(
    userId: string,
    amount: number,
    currency: string,
  ): Promise<string> {
    if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount)) {
      throw new GameError('BET_INVALID', 'Bet amount must be a valid number.');
    }

    return prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findFirst({
        where: {
          userId,
          currency: { symbol: currency },
        },
      });

      if (!wallet) {
        // Auto-create wallet for this currency
        const currencyRecord = await tx.currency.findUnique({
          where: { symbol: currency.toUpperCase() },
        });
        if (!currencyRecord) {
          throw new GameError('CURRENCY_NOT_FOUND', `Currency ${currency} not found.`);
        }
        wallet = await tx.wallet.create({
          data: { userId, currencyId: currencyRecord.id },
        });
      }

      if (wallet.balance.toNumber() < amount) {
        throw new GameError('INSUFFICIENT_BALANCE', 'Insufficient balance.');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: new Decimal(amount.toFixed(8)) },
        },
      });

      const tx_record = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'BET',
          amount: new Decimal(amount.toFixed(8)),
          status: 'COMPLETED',
        },
      });

      return tx_record.id;
    });
  }

  /**
   * Atomically credit winnings and record the WIN transaction.
   */
  protected async creditWinnings(
    userId: string,
    amount: number,
    currency: string,
  ): Promise<string> {
    if (amount === undefined || amount === null || typeof amount !== 'number' || isNaN(amount)) {
      throw new GameError('PAYOUT_INVALID', 'Payout amount must be a valid number.');
    }
    if (amount <= 0) return '';

    return prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findFirst({
        where: {
          userId,
          currency: { symbol: currency },
        },
      });

      if (!wallet) {
        // Auto-create wallet for this currency
        const currencyRecord = await tx.currency.findUnique({
          where: { symbol: currency.toUpperCase() },
        });
        if (!currencyRecord) {
          throw new GameError('CURRENCY_NOT_FOUND', `Currency ${currency} not found.`);
        }
        wallet = await tx.wallet.create({
          data: { userId, currencyId: currencyRecord.id },
        });
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: new Decimal(amount.toFixed(8)) },
        },
      });

      const tx_record = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WIN',
          amount: new Decimal(amount.toFixed(8)),
          status: 'COMPLETED',
        },
      });

      return tx_record.id;
    });
  }

  /**
   * Record a casino round and increment the game's play count.
   */
  protected async recordRound(data: {
    userId: string;
    gameSlug: string;
    betAmount: number;
    payout: number;
    multiplier: number;
    result: any;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    sessionId?: string;
  }): Promise<string> {
    // Defensive: ensure numeric fields are valid numbers
    const betAmount = typeof data.betAmount === 'number' && !isNaN(data.betAmount) ? data.betAmount : 0;
    const payout = typeof data.payout === 'number' && !isNaN(data.payout) ? data.payout : 0;
    const multiplier = typeof data.multiplier === 'number' && !isNaN(data.multiplier) ? data.multiplier : 0;

    const round = await prisma.casinoRound.create({
      data: {
        userId: data.userId,
        gameSlug: data.gameSlug,
        betAmount: new Decimal(betAmount.toFixed(8)),
        payout: new Decimal(payout.toFixed(8)),
        multiplier: new Decimal(multiplier.toFixed(8)),
        result: data.result,
        serverSeedHash: data.serverSeedHash,
        clientSeed: data.clientSeed,
        nonce: data.nonce,
        isWin: payout > betAmount,
        sessionId: data.sessionId ?? null,
      },
    });

    // Fire-and-forget: increment play count
    prisma.casinoGame
      .updateMany({
        where: { slug: data.gameSlug },
        data: { playCount: { increment: 1 } },
      })
      .catch(() => {
        /* ignore */
      });

    // Fire-and-forget: update user totalWagered
    prisma.user
      .update({
        where: { id: data.userId },
        data: { totalWagered: { increment: new Decimal(betAmount.toFixed(8)) } },
      })
      .catch(() => {
        /* ignore */
      });

    // Push to live feed (Redis list, keep last 50)
    const feedEntry = JSON.stringify({
      roundId: round.id,
      game: data.gameSlug,
      userId: data.userId,
      betAmount,
      payout,
      multiplier,
      isWin: payout > betAmount,
      createdAt: new Date().toISOString(),
    });
    redis
      .lpush('casino:live_feed', feedEntry)
      .then(() => redis.ltrim('casino:live_feed', 0, 49))
      .catch(() => {
        /* ignore */
      });

    return round.id;
  }

  /**
   * Get the active provably fair seed pair for a user, or create one.
   */
  protected async getUserSeeds(userId: string): Promise<UserSeeds> {
    let seed = await prisma.provablyFairSeed.findFirst({
      where: {
        userId,
        isRevealed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!seed) {
      const { seed: serverSeed, hash } = this.fairService.generateServerSeed();
      const clientSeed = this.generateDefaultClientSeed();

      seed = await prisma.provablyFairSeed.create({
        data: {
          userId,
          serverSeed,
          serverSeedHash: hash,
          clientSeed,
          nonce: 0,
        },
      });
    }

    return {
      serverSeed: seed.serverSeed,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
      seedId: seed.id,
    };
  }

  /**
   * Increment the nonce for the user's active seed pair.
   */
  protected async incrementNonce(userId: string): Promise<void> {
    const seed = await prisma.provablyFairSeed.findFirst({
      where: { userId, isRevealed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (seed) {
      await prisma.provablyFairSeed.update({
        where: { id: seed.id },
        data: { nonce: { increment: 1 } },
      });
    }
  }

  // -----------------------------------------------------------------------
  // Balance query helper
  // -----------------------------------------------------------------------

  /**
   * Get the current wallet balance for a user + currency.
   * Used to include `newBalance` in game results so the frontend can update
   * the displayed balance without a separate fetch.
   */
  async getBalance(userId: string, currency: string): Promise<number> {
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId,
        currency: { symbol: currency },
      },
      select: { balance: true },
    });
    return wallet ? wallet.balance.toNumber() : 0;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private generateDefaultClientSeed(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// ---------------------------------------------------------------------------
// Custom error class for game errors
// ---------------------------------------------------------------------------

export class GameError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'GameError';
  }
}
