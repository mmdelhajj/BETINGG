import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveBetEntry {
  id: string;
  game: string;
  gameName: string;
  username: string;       // Masked: "jo***"
  amount: string;
  multiplier: string;
  profit: string;
  currency: string;
  isWin: boolean;
  timestamp: string;
}

interface BetData {
  roundId: string;
  userId: string;
  game: string;
  gameName?: string;
  betAmount: number;
  payout: number;
  multiplier: number;
  currency: string;
  isWin: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REDIS_LIST_KEY = 'livefeed:recent_bets';
const MAX_RECENT_BETS = 50;
const DEFAULT_CURRENCY = 'USDT';

/**
 * Game slug to display name mapping.
 */
const GAME_NAMES: Record<string, string> = {
  'crash': 'Crash',
  'dice': 'Dice',
  'mines': 'Mines',
  'plinko': 'Plinko',
  'coinflip': 'Coinflip',
  'roulette': 'Roulette',
  'blackjack': 'Blackjack',
  'hilo': 'HiLo',
  'wheel': 'Wheel of Fortune',
  'tower': 'Tower',
  'limbo': 'Limbo',
  'keno': 'Keno',
  'video-poker': 'Video Poker',
  'baccarat': 'Baccarat',
  'slots': 'Slots',
};

// ---------------------------------------------------------------------------
// LiveFeedService
// ---------------------------------------------------------------------------

export class LiveFeedService {
  private io: any = null; // Socket.IO server instance

  /**
   * Set the Socket.IO server reference.
   * Must be called during server initialization.
   */
  setIO(io: any): void {
    this.io = io;
  }

  /**
   * Broadcast a bet to the live feed.
   * Called after every casino/sports bet is settled.
   */
  async broadcastBet(betData: BetData): Promise<void> {
    try {
      // Look up username (masked)
      const user = await prisma.user.findUnique({
        where: { id: betData.userId },
        select: { username: true },
      });

      const username = user ? this.maskUsername(user.username) : 'Anonymous';
      const profit = betData.payout - betData.betAmount;
      const gameName = betData.gameName ?? GAME_NAMES[betData.game] ?? betData.game;

      const entry: LiveBetEntry = {
        id: betData.roundId,
        game: betData.game,
        gameName,
        username,
        amount: betData.betAmount.toFixed(8),
        multiplier: betData.multiplier.toFixed(4),
        profit: profit.toFixed(8),
        currency: betData.currency ?? DEFAULT_CURRENCY,
        isWin: betData.isWin,
        timestamp: new Date().toISOString(),
      };

      // Store in Redis list (most recent first)
      await redis.lpush(REDIS_LIST_KEY, JSON.stringify(entry));
      await redis.ltrim(REDIS_LIST_KEY, 0, MAX_RECENT_BETS - 1);

      // Emit via Socket.IO to /live namespace
      if (this.io) {
        try {
          const liveNsp = this.io.of('/live');
          liveNsp.emit('bet:new', entry);
        } catch {
          // Socket.IO might not be ready yet
        }
      }
    } catch (err) {
      console.error('[LiveFeed] Error broadcasting bet:', err);
    }
  }

  /**
   * Get recent bets from the feed.
   */
  async getRecentBets(limit: number = MAX_RECENT_BETS): Promise<LiveBetEntry[]> {
    const clampedLimit = Math.max(1, Math.min(limit, MAX_RECENT_BETS));

    const raw = await redis.lrange(REDIS_LIST_KEY, 0, clampedLimit - 1);
    return raw.map((entry) => JSON.parse(entry) as LiveBetEntry);
  }

  /**
   * Get recent high-roller bets (bets above a certain threshold).
   */
  async getHighRollerBets(minAmount: number = 100, limit: number = 20): Promise<LiveBetEntry[]> {
    const all = await this.getRecentBets(MAX_RECENT_BETS);
    return all
      .filter((entry) => parseFloat(entry.amount) >= minAmount)
      .slice(0, limit);
  }

  /**
   * Get recent big-win bets (above a certain profit or multiplier threshold).
   */
  async getBigWins(minMultiplier: number = 10, limit: number = 20): Promise<LiveBetEntry[]> {
    const all = await this.getRecentBets(MAX_RECENT_BETS);
    return all
      .filter((entry) => entry.isWin && parseFloat(entry.multiplier) >= minMultiplier)
      .slice(0, limit);
  }

  /**
   * Get recent bets for a specific game.
   */
  async getGameBets(gameSlug: string, limit: number = 20): Promise<LiveBetEntry[]> {
    const all = await this.getRecentBets(MAX_RECENT_BETS);
    return all
      .filter((entry) => entry.game === gameSlug)
      .slice(0, limit);
  }

  /**
   * Clear the live feed (admin use).
   */
  async clearFeed(): Promise<void> {
    await redis.del(REDIS_LIST_KEY);
  }

  /**
   * Get aggregate live feed stats.
   */
  async getStats(): Promise<{
    totalBetsInFeed: number;
    totalWagered: string;
    totalWon: string;
    totalProfit: string;
    biggestWin: LiveBetEntry | null;
    biggestBet: LiveBetEntry | null;
  }> {
    const bets = await this.getRecentBets(MAX_RECENT_BETS);

    if (bets.length === 0) {
      return {
        totalBetsInFeed: 0,
        totalWagered: '0',
        totalWon: '0',
        totalProfit: '0',
        biggestWin: null,
        biggestBet: null,
      };
    }

    let totalWagered = 0;
    let totalWon = 0;
    let biggestWin: LiveBetEntry | null = null;
    let biggestBet: LiveBetEntry | null = null;
    let maxProfit = -Infinity;
    let maxBet = 0;

    for (const bet of bets) {
      const amount = parseFloat(bet.amount);
      const profit = parseFloat(bet.profit);

      totalWagered += amount;
      if (bet.isWin) {
        totalWon += amount + profit;
      }

      if (profit > maxProfit) {
        maxProfit = profit;
        biggestWin = bet;
      }

      if (amount > maxBet) {
        maxBet = amount;
        biggestBet = bet;
      }
    }

    const totalProfit = totalWon - totalWagered;

    return {
      totalBetsInFeed: bets.length,
      totalWagered: totalWagered.toFixed(8),
      totalWon: totalWon.toFixed(8),
      totalProfit: totalProfit.toFixed(8),
      biggestWin,
      biggestBet,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Mask a username for privacy.
   * "johnsmith" -> "jo***th"
   * "ab" -> "a***"
   * "a" -> "a***"
   */
  private maskUsername(username: string): string {
    if (!username || username.length === 0) {
      return 'Anonymous';
    }

    if (username.length <= 2) {
      return username.charAt(0) + '***';
    }

    if (username.length <= 4) {
      return username.charAt(0) + username.charAt(1) + '***';
    }

    // Show first 2 and last 2 characters
    const first = username.substring(0, 2);
    const last = username.substring(username.length - 2);
    return `${first}***${last}`;
  }
}

export const liveFeedService = new LiveFeedService();
export default liveFeedService;
