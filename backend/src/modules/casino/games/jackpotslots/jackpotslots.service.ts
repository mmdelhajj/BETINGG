import { Decimal } from '@prisma/client/runtime/library';
import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';
import { prisma } from '../../../../lib/prisma.js';
import { redis } from '../../../../lib/redis.js';

// ---------------------------------------------------------------------------
// Symbol definitions
// ---------------------------------------------------------------------------

interface SlotSymbol {
  id: number;
  name: string;
  icon: string;
  weight: number;
  payouts: Record<number, number>; // count => multiplier (3, 4, 5 of a kind)
  isWild: boolean;
  isScatter: boolean;
  isJackpot: boolean;
}

const SYMBOLS: SlotSymbol[] = [
  {
    id: 0, name: 'Jackpot', icon: 'jackpot',
    weight: 1,
    payouts: { 3: 15, 4: 75, 5: 500 },
    isWild: false, isScatter: false, isJackpot: true,
  },
  {
    id: 1, name: 'Wild', icon: 'wild',
    weight: 2,
    payouts: { 3: 10, 4: 50, 5: 200 },
    isWild: true, isScatter: false, isJackpot: false,
  },
  {
    id: 2, name: 'Scatter', icon: 'scatter',
    weight: 3,
    payouts: { 3: 5, 4: 20, 5: 100 },
    isWild: false, isScatter: true, isJackpot: false,
  },
  {
    id: 3, name: 'Diamond', icon: 'diamond',
    weight: 5,
    payouts: { 3: 10, 4: 25, 5: 50 },
    isWild: false, isScatter: false, isJackpot: false,
  },
  {
    id: 4, name: 'Crown', icon: 'crown',
    weight: 7,
    payouts: { 3: 6, 4: 15, 5: 30 },
    isWild: false, isScatter: false, isJackpot: false,
  },
  {
    id: 5, name: 'Seven', icon: 'seven',
    weight: 9,
    payouts: { 3: 4, 4: 10, 5: 20 },
    isWild: false, isScatter: false, isJackpot: false,
  },
  {
    id: 6, name: 'Bell', icon: 'bell',
    weight: 11,
    payouts: { 3: 3, 4: 7, 5: 15 },
    isWild: false, isScatter: false, isJackpot: false,
  },
  {
    id: 7, name: 'Cherry', icon: 'cherry',
    weight: 13,
    payouts: { 3: 2, 4: 5, 5: 10 },
    isWild: false, isScatter: false, isJackpot: false,
  },
  {
    id: 8, name: 'Orange', icon: 'orange',
    weight: 16,
    payouts: { 3: 1.5, 4: 3, 5: 7 },
    isWild: false, isScatter: false, isJackpot: false,
  },
  {
    id: 9, name: 'Lemon', icon: 'lemon',
    weight: 18,
    payouts: { 3: 1, 4: 2, 5: 5 },
    isWild: false, isScatter: false, isJackpot: false,
  },
  {
    id: 10, name: 'Bar', icon: 'bar',
    weight: 15,
    payouts: { 3: 0.5, 4: 1.5, 5: 3 },
    isWild: false, isScatter: false, isJackpot: false,
  },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0); // 100

// ---------------------------------------------------------------------------
// 20 paylines (same as slots5)
// ---------------------------------------------------------------------------

const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 0, 1, 0, 0],
  [2, 2, 1, 2, 2],
  [1, 0, 2, 0, 1],
  [1, 2, 0, 2, 1],
  [0, 2, 0, 2, 0],
];

const ACTIVE_LINES = 20;

// ---------------------------------------------------------------------------
// Jackpot configuration
// ---------------------------------------------------------------------------

type JackpotTier = 'MINI' | 'MAJOR' | 'GRAND';

const JACKPOT_CONTRIBUTION_RATE = 0.01; // 1% of every bet
const JACKPOT_CONTRIBUTION_SPLIT: Record<JackpotTier, number> = {
  MINI: 0.5,
  MAJOR: 0.3,
  GRAND: 0.2,
};

const JACKPOT_SEED: Record<JackpotTier, number> = {
  MINI: 100,
  MAJOR: 1000,
  GRAND: 10000,
};

const REDIS_JACKPOT_KEY = 'jackpot:pools';

// ---------------------------------------------------------------------------
// JackpotSlotsGame
// ---------------------------------------------------------------------------

export class JackpotSlotsGame extends BaseGame {
  readonly name = 'Jackpot Slots';
  readonly slug = 'jackpotslots';
  readonly houseEdge = 0.04;
  readonly minBet = 0.0001;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;

    const betPerLine = options?.betPerLine ?? (amount / ACTIVE_LINES);
    const totalBet = betPerLine * ACTIVE_LINES;

    // Validate bet
    await this.validateBet(userId, totalBet, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate 15 random values (5 reels x 3 rows)
    const randoms = this.fairService.generateMultipleResults(serverSeed, clientSeed, nonce, 15);

    // Build 5x3 grid: grid[reel][row]
    const grid: SlotSymbol[][] = [];
    for (let reel = 0; reel < 5; reel++) {
      const column: SlotSymbol[] = [];
      for (let row = 0; row < 3; row++) {
        const idx = reel * 3 + row;
        column.push(this.weightedSelect(randoms[idx]));
      }
      grid.push(column);
    }

    // Contribute to jackpot pool
    await this.contributeToJackpot(totalBet);
    const jackpotContribution = totalBet * JACKPOT_CONTRIBUTION_RATE;

    // Count jackpot symbols on the middle row (row index 1) across all 5 reels
    let jackpotSymbolCount = 0;
    for (let reel = 0; reel < 5; reel++) {
      if (grid[reel][1].isJackpot) {
        jackpotSymbolCount++;
      }
    }

    // Determine jackpot win
    let jackpotWon: 'mini' | 'major' | 'grand' | null = null;
    let jackpotAmount = 0;

    if (jackpotSymbolCount >= 5) {
      jackpotWon = 'grand';
    } else if (jackpotSymbolCount >= 4) {
      jackpotWon = 'major';
    } else if (jackpotSymbolCount >= 3) {
      jackpotWon = 'mini';
    }

    if (jackpotWon) {
      const tierKey = jackpotWon.toUpperCase() as JackpotTier;
      jackpotAmount = await this.awardJackpot(userId, tierKey, currency);
    }

    // Count scatters
    let scatterCount = 0;
    for (let reel = 0; reel < 5; reel++) {
      for (let row = 0; row < 3; row++) {
        if (grid[reel][row].isScatter) scatterCount++;
      }
    }

    let freeSpinsWon = 0;
    if (scatterCount >= 5) freeSpinsWon = 30;
    else if (scatterCount >= 4) freeSpinsWon = 20;
    else if (scatterCount >= 3) freeSpinsWon = 10;

    const bonusRound = options?.bonusRound === true;
    const bonusMultiplier = bonusRound ? 3 : 1;

    // Evaluate paylines
    const winLines: {
      line: number;
      symbols: string[];
      positions: number[];
      count: number;
      matchedSymbol: string;
      multiplier: number;
      payout: number;
    }[] = [];

    let totalPayout = 0;

    for (let lineIdx = 0; lineIdx < ACTIVE_LINES; lineIdx++) {
      const payline = PAYLINES[lineIdx];
      const lineSymbols: SlotSymbol[] = payline.map((row, reel) => grid[reel][row]);

      const evalResult = this.evaluatePayline(lineSymbols);

      if (evalResult) {
        const linePayout = betPerLine * evalResult.multiplier * bonusMultiplier;
        totalPayout += linePayout;

        winLines.push({
          line: lineIdx + 1,
          symbols: lineSymbols.map((s) => s.name),
          positions: payline.map((row, reel) => reel * 3 + row),
          count: evalResult.count,
          matchedSymbol: evalResult.symbol.name,
          multiplier: evalResult.multiplier * bonusMultiplier,
          payout: linePayout,
        });
      }
    }

    // Scatter pays
    if (scatterCount >= 3 && !bonusRound) {
      const scatterSym = SYMBOLS.find((s) => s.isScatter)!;
      const scatterMultiplier = scatterSym.payouts[Math.min(scatterCount, 5)] ?? scatterSym.payouts[5];
      const scatterPayout = totalBet * scatterMultiplier;
      totalPayout += scatterPayout;

      winLines.push({
        line: 0,
        symbols: Array(scatterCount).fill('Scatter'),
        positions: [],
        count: scatterCount,
        matchedSymbol: 'Scatter',
        multiplier: scatterMultiplier,
        payout: scatterPayout,
      });
    }

    // Add jackpot winnings to total
    totalPayout += jackpotAmount;

    const effectiveMultiplier = totalBet > 0 ? totalPayout / totalBet : 0;
    const profit = totalPayout - totalBet;

    // Deduct balance
    await this.deductBalance(userId, totalBet, currency);

    // Credit winnings (jackpot already credited in awardJackpot, so credit only slot winnings)
    const slotWinnings = totalPayout - jackpotAmount;
    if (slotWinnings > 0) {
      await this.creditWinnings(userId, slotWinnings, currency);
    }

    // Build grid display (reel-major to row-major)
    const gridDisplay: { id: number; name: string; icon: string }[][] = [];
    for (let row = 0; row < 3; row++) {
      const rowArr: { id: number; name: string; icon: string }[] = [];
      for (let reel = 0; reel < 5; reel++) {
        const s = grid[reel][row];
        rowArr.push({ id: s.id, name: s.name, icon: s.icon });
      }
      gridDisplay.push(rowArr);
    }

    // Get current jackpot amounts for display
    const currentJackpots = await this.getJackpotAmounts();

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: totalBet,
      payout: totalPayout,
      multiplier: effectiveMultiplier,
      result: {
        grid: gridDisplay,
        winLines,
        scatterCount,
        freeSpinsWon,
        totalPayout,
        bonusRound,
        jackpotWon,
        jackpotAmount,
        currentJackpots,
        jackpotContribution,
      },
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
      payout: totalPayout,
      profit,
      multiplier: effectiveMultiplier,
      result: {
        grid: gridDisplay,
        winLines,
        scatterCount,
        freeSpinsWon,
        totalPayout,
        bonusRound,
        betPerLine,
        activeLines: ACTIVE_LINES,
        jackpotWon,
        jackpotAmount,
        currentJackpots,
        jackpotContribution,
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
      newBalance,
    };
  }

  // -------------------------------------------------------------------------
  // Weighted symbol selection
  // -------------------------------------------------------------------------

  private weightedSelect(random: number): SlotSymbol {
    let cumulative = 0;
    const threshold = random * TOTAL_WEIGHT;

    for (const symbol of SYMBOLS) {
      cumulative += symbol.weight;
      if (threshold < cumulative) {
        return symbol;
      }
    }

    return SYMBOLS[SYMBOLS.length - 1];
  }

  // -------------------------------------------------------------------------
  // Payline evaluation
  // -------------------------------------------------------------------------

  private evaluatePayline(symbols: SlotSymbol[]): {
    symbol: SlotSymbol;
    count: number;
    multiplier: number;
  } | null {
    // Find first non-wild, non-scatter symbol from left
    const firstNonWild = symbols.find((s) => !s.isWild && !s.isScatter);

    if (!firstNonWild) {
      // All wilds / scatters - check consecutive wilds from left
      let wildCount = 0;
      for (const s of symbols) {
        if (s.isWild) wildCount++;
        else break;
      }
      if (wildCount >= 3) {
        const wildSymbol = SYMBOLS[1]; // Wild
        const multiplier = wildSymbol.payouts[wildCount] ?? wildSymbol.payouts[5];
        return { symbol: wildSymbol, count: wildCount, multiplier };
      }
      return null;
    }

    // Count consecutive matching from left (wild substitutes, scatter breaks)
    let count = 0;
    for (const s of symbols) {
      if (s.isScatter) break;
      if (s.id === firstNonWild.id || s.isWild) {
        count++;
      } else {
        break;
      }
    }

    if (count < 3) return null;

    const cappedCount = Math.min(count, 5);
    const multiplier = firstNonWild.payouts[cappedCount];

    if (!multiplier) return null;

    return { symbol: firstNonWild, count: cappedCount, multiplier };
  }

  // -------------------------------------------------------------------------
  // Jackpot system
  // -------------------------------------------------------------------------

  /**
   * Contribute a percentage of the bet to jackpot pools.
   */
  private async contributeToJackpot(betAmount: number): Promise<void> {
    if (betAmount <= 0) return;

    const totalContribution = betAmount * JACKPOT_CONTRIBUTION_RATE;
    if (totalContribution <= 0) return;

    const tiers: JackpotTier[] = ['MINI', 'MAJOR', 'GRAND'];

    await prisma.$transaction(async (tx) => {
      for (const tier of tiers) {
        const tierContribution = totalContribution * JACKPOT_CONTRIBUTION_SPLIT[tier];
        if (tierContribution <= 0) continue;

        const existing = await tx.jackpotPool.findFirst({ where: { tier } });

        if (existing) {
          await tx.jackpotPool.updateMany({
            where: { tier },
            data: { amount: { increment: new Decimal(tierContribution.toFixed(8)) } },
          });
        } else {
          await tx.jackpotPool.create({
            data: {
              tier,
              amount: new Decimal((JACKPOT_SEED[tier] + tierContribution).toFixed(8)),
              seedAmount: new Decimal(JACKPOT_SEED[tier]),
            },
          });
        }
      }
    });

    // Update Redis cache
    this.syncJackpotsToRedis().catch(() => { /* ignore */ });
  }

  /**
   * Award a jackpot tier to a user. Returns the jackpot amount.
   */
  private async awardJackpot(
    userId: string,
    tier: JackpotTier,
    currency: string,
  ): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const pool = await tx.jackpotPool.findFirst({ where: { tier } });
      if (!pool) return 0;

      const winAmount = pool.amount.toNumber();

      // Reset pool to seed amount
      await tx.jackpotPool.updateMany({
        where: { tier },
        data: {
          amount: pool.seedAmount,
          lastWonAt: new Date(),
          lastWonBy: userId,
          lastWonAmount: pool.amount,
        },
      });

      // Credit the user's wallet
      const wallet = await tx.wallet.findFirst({
        where: {
          userId,
          currency: { symbol: currency },
        },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: new Decimal(winAmount.toFixed(8)) } },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'WIN',
            amount: new Decimal(winAmount.toFixed(8)),
            status: 'COMPLETED',
            metadata: {
              type: 'jackpot',
              tier,
              game: 'jackpotslots',
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
          message: `Congratulations! You won the ${tier} jackpot of $${winAmount.toFixed(2)} on Jackpot Slots!`,
          data: { tier, amount: winAmount.toFixed(8), game: 'jackpotslots' },
        },
      });

      return winAmount;
    });
  }

  /**
   * Get current jackpot amounts for all tiers.
   */
  private async getJackpotAmounts(): Promise<{ mini: number; major: number; grand: number }> {
    // Try Redis cache first
    const cached = await redis.get(REDIS_JACKPOT_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const result: { mini: number; major: number; grand: number } = { mini: 100, major: 1000, grand: 10000 };
          for (const p of parsed) {
            if (p.tier === 'MINI') result.mini = parseFloat(p.amount) || 100;
            if (p.tier === 'MAJOR') result.major = parseFloat(p.amount) || 1000;
            if (p.tier === 'GRAND') result.grand = parseFloat(p.amount) || 10000;
          }
          return result;
        }
      } catch {
        // Fallback to DB
      }
    }

    // Fallback to database
    const pools = await prisma.jackpotPool.findMany();
    const result: { mini: number; major: number; grand: number } = { mini: 100, major: 1000, grand: 10000 };

    for (const pool of pools) {
      if (pool.tier === 'MINI') result.mini = pool.amount.toNumber();
      if (pool.tier === 'MAJOR') result.major = pool.amount.toNumber();
      if (pool.tier === 'GRAND') result.grand = pool.amount.toNumber();
    }

    return result;
  }

  /**
   * Sync jackpot amounts to Redis.
   */
  private async syncJackpotsToRedis(): Promise<void> {
    const pools = await prisma.jackpotPool.findMany({ orderBy: { tier: 'asc' } });
    const data = pools.map((pool) => ({
      tier: pool.tier,
      amount: pool.amount.toFixed(2),
      seedAmount: pool.seedAmount.toFixed(2),
      lastWonAt: pool.lastWonAt?.toISOString() ?? null,
      lastWonBy: pool.lastWonBy ?? null,
      lastWonAmount: pool.lastWonAmount?.toFixed(2) ?? null,
    }));
    await redis.set(REDIS_JACKPOT_KEY, JSON.stringify(data), 'EX', 30);
  }
}

export const jackpotSlotsGame = new JackpotSlotsGame();
export default jackpotSlotsGame;
