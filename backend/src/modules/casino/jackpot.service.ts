import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { provablyFairService } from '../../services/casino/ProvablyFairService.js';
import { JACKPOT_TIERS } from '../../config/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JackpotTier = 'MINI' | 'MAJOR' | 'GRAND';

interface JackpotPoolInfo {
  tier: JackpotTier;
  amount: string;
  seedAmount: string;
  lastWonAt: string | null;
  lastWonBy: string | null;
  lastWonAmount: string | null;
}

interface JackpotWinResult {
  tier: JackpotTier;
  amount: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Default jackpot contribution from each bet (0.5% of bet amount).
 * Per-game contribution can override this via CasinoGameConfig.jackpotContribution.
 */
const DEFAULT_JACKPOT_CONTRIBUTION = 0.005;

/**
 * Split of contributions across tiers.
 */
const CONTRIBUTION_SPLIT: Record<JackpotTier, number> = {
  MINI: 0.5,   // 50%
  MAJOR: 0.3,  // 30%
  GRAND: 0.2,  // 20%
};

/**
 * Win probabilities (1 in N chance per qualifying bet).
 */
const WIN_PROBABILITY: Record<JackpotTier, number> = {
  MINI: 10_000,
  MAJOR: 100_000,
  GRAND: 1_000_000,
};

/**
 * Seed amounts for each tier (used when pool resets after a win).
 */
const SEED_AMOUNTS: Record<JackpotTier, number> = {
  MINI: JACKPOT_TIERS.MINI,     // 100
  MAJOR: JACKPOT_TIERS.MAJOR,   // 1000
  GRAND: JACKPOT_TIERS.GRAND,   // 10000
};

const TIERS: JackpotTier[] = ['MINI', 'MAJOR', 'GRAND'];
const REDIS_POOL_KEY = 'jackpot:pools';

// ---------------------------------------------------------------------------
// JackpotService
// ---------------------------------------------------------------------------

export class JackpotService {
  /**
   * Initialize jackpot pools in the database if they don't exist.
   * Should be called on application startup.
   */
  async initialize(): Promise<void> {
    for (const tier of TIERS) {
      const existing = await prisma.jackpotPool.findFirst({
        where: { tier },
      });

      if (!existing) {
        await prisma.jackpotPool.create({
          data: {
            tier,
            amount: new Decimal(SEED_AMOUNTS[tier]),
            seedAmount: new Decimal(SEED_AMOUNTS[tier]),
          },
        });
      }
    }

    // Sync to Redis cache
    await this.syncPoolsToRedis();
  }

  /**
   * Contribute a portion of a bet to the jackpot pools.
   * Called after every casino bet.
   *
   * @param betAmount - The bet amount (number)
   * @param gameSlug - The game slug for looking up per-game contribution rate
   */
  async contributeToJackpot(betAmount: number, gameSlug: string): Promise<void> {
    if (betAmount <= 0) return;

    // Look up per-game contribution rate
    let contributionRate = DEFAULT_JACKPOT_CONTRIBUTION;

    const gameConfig = await prisma.casinoGameConfig.findUnique({
      where: { gameSlug },
      select: { jackpotContribution: true },
    });

    if (gameConfig && gameConfig.jackpotContribution.toNumber() > 0) {
      contributionRate = gameConfig.jackpotContribution.toNumber();
    }

    const totalContribution = betAmount * contributionRate;
    if (totalContribution <= 0) return;

    // Split across tiers and update atomically
    await prisma.$transaction(async (tx) => {
      for (const tier of TIERS) {
        const tierContribution = totalContribution * CONTRIBUTION_SPLIT[tier];
        if (tierContribution <= 0) continue;

        await tx.jackpotPool.updateMany({
          where: { tier },
          data: {
            amount: { increment: new Decimal(tierContribution.toFixed(8)) },
          },
        });
      }
    });

    // Update Redis cache (fire-and-forget)
    this.syncPoolsToRedis().catch(() => { /* ignore */ });
  }

  /**
   * Check if a bet wins a jackpot.
   * Uses provably fair randomness to determine the outcome.
   *
   * @param userId - The user who placed the bet
   * @param betAmount - The bet amount (affects contribution, not win chance)
   * @returns The tier won, or null if no win
   */
  async checkJackpotWin(
    userId: string,
    betAmount: number,
  ): Promise<JackpotWinResult | null> {
    if (betAmount <= 0) return null;

    // Generate a provably fair random value for jackpot check
    // Use a dedicated server seed for jackpot to avoid affecting game seeds
    const jackpotSeed = crypto.randomBytes(32).toString('hex');
    const clientSeed = `jackpot_${userId}_${Date.now()}`;
    const nonce = 0;

    // Check each tier from most valuable to least
    for (const tier of ['GRAND', 'MAJOR', 'MINI'] as JackpotTier[]) {
      const result = provablyFairService.generateResult(jackpotSeed, clientSeed, nonce);
      const threshold = 1 / WIN_PROBABILITY[tier];

      if (result < threshold) {
        // Winner! Award the jackpot
        const winResult = await this.awardJackpot(userId, tier);
        if (winResult) {
          return winResult;
        }
      }
    }

    return null;
  }

  /**
   * Award a jackpot to a user.
   * Resets the pool to seed amount.
   */
  async awardJackpot(userId: string, tier: JackpotTier): Promise<JackpotWinResult | null> {
    return prisma.$transaction(async (tx) => {
      // Get current pool
      const pool = await tx.jackpotPool.findFirst({
        where: { tier },
      });

      if (!pool) return null;

      const winAmount = pool.amount;

      // Reset pool to seed amount
      await tx.jackpotPool.updateMany({
        where: { tier },
        data: {
          amount: pool.seedAmount,
          lastWonAt: new Date(),
          lastWonBy: userId,
          lastWonAmount: winAmount,
        },
      });

      // Credit the user's primary wallet (USDT by default)
      const wallet = await tx.wallet.findFirst({
        where: {
          userId,
          currency: { symbol: 'USDT' },
        },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: winAmount },
          },
        });

        // Record WIN transaction
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'WIN',
            amount: winAmount,
            status: 'COMPLETED',
            metadata: {
              type: 'jackpot',
              tier,
              jackpotAmount: winAmount.toFixed(8),
            },
          },
        });
      }

      // Create notification
      await tx.notification.create({
        data: {
          userId,
          type: 'BET_WON',
          title: `${tier} Jackpot Won!`,
          message: `Congratulations! You won the ${tier} jackpot of $${winAmount.toFixed(2)}!`,
          data: {
            tier,
            amount: winAmount.toFixed(8),
          },
        },
      });

      return {
        tier,
        amount: winAmount.toFixed(8),
        userId,
      };
    });
  }

  /**
   * Get current jackpot pool amounts.
   */
  async getJackpotAmounts(): Promise<JackpotPoolInfo[]> {
    // Try Redis cache first
    const cached = await redis.get(REDIS_POOL_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to DB
    const pools = await prisma.jackpotPool.findMany({
      orderBy: { tier: 'asc' },
    });

    const result: JackpotPoolInfo[] = pools.map((pool) => ({
      tier: pool.tier as JackpotTier,
      amount: pool.amount.toFixed(2),
      seedAmount: pool.seedAmount.toFixed(2),
      lastWonAt: pool.lastWonAt?.toISOString() ?? null,
      lastWonBy: pool.lastWonBy ?? null,
      lastWonAmount: pool.lastWonAmount?.toFixed(2) ?? null,
    }));

    // Cache in Redis
    await redis.set(REDIS_POOL_KEY, JSON.stringify(result), 'EX', 30);

    return result;
  }

  /**
   * Get a specific tier's pool info.
   */
  async getPoolByTier(tier: JackpotTier): Promise<JackpotPoolInfo | null> {
    const pools = await this.getJackpotAmounts();
    return pools.find((p) => p.tier === tier) ?? null;
  }

  /**
   * Sync pool amounts from database to Redis cache.
   */
  private async syncPoolsToRedis(): Promise<void> {
    const pools = await prisma.jackpotPool.findMany({
      orderBy: { tier: 'asc' },
    });

    const data: JackpotPoolInfo[] = pools.map((pool) => ({
      tier: pool.tier as JackpotTier,
      amount: pool.amount.toFixed(2),
      seedAmount: pool.seedAmount.toFixed(2),
      lastWonAt: pool.lastWonAt?.toISOString() ?? null,
      lastWonBy: pool.lastWonBy ?? null,
      lastWonAmount: pool.lastWonAmount?.toFixed(2) ?? null,
    }));

    await redis.set(REDIS_POOL_KEY, JSON.stringify(data), 'EX', 30);
  }

  /**
   * Admin: manually set a jackpot pool amount.
   */
  async setPoolAmount(tier: JackpotTier, amount: number): Promise<void> {
    if (!TIERS.includes(tier)) {
      throw new Error(`Invalid tier: ${tier}. Must be one of: ${TIERS.join(', ')}`);
    }
    if (amount < 0) {
      throw new Error('Amount must be non-negative.');
    }

    await prisma.jackpotPool.updateMany({
      where: { tier },
      data: { amount: new Decimal(amount.toFixed(8)) },
    });

    await this.syncPoolsToRedis();
  }

  /**
   * Admin: reset all pools to seed amounts.
   */
  async resetAllPools(): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const tier of TIERS) {
        await tx.jackpotPool.updateMany({
          where: { tier },
          data: { amount: new Decimal(SEED_AMOUNTS[tier]) },
        });
      }
    });

    await this.syncPoolsToRedis();
  }
}

export const jackpotService = new JackpotService();
export default jackpotService;
