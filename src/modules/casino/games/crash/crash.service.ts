import Decimal from 'decimal.js';
import prisma from '../../../../lib/prisma';
import { redis } from '../../../../lib/redis';
import { emitToCrash } from '../../../../lib/socket';
import { AppError, InsufficientBalanceError } from '../../../../utils/errors';
import { provablyFairService } from '../../provablyFair';
import { verifyCrashPoint } from '../../../../utils/crypto';
import { CASINO } from '../../../../config/constants';

interface CrashBet {
  id: string;
  userId: string;
  username: string;
  stake: string;
  currency: string;
  autoCashout?: number;
  cashedOut: boolean;
  cashoutMultiplier?: number;
  winAmount?: string;
}

interface CrashRound {
  id: number;
  crashPoint: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  status: 'WAITING' | 'RUNNING' | 'CRASHED';
  bets: CrashBet[];
  startedAt?: number;
  crashedAt?: number;
  currentMultiplier?: number;
}

const CRASH_STATE_KEY = 'crash:state';
const CRASH_HISTORY_KEY = 'crash:history';

export class CrashGameService {
  private roundInterval: NodeJS.Timeout | null = null;
  private multiplierInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize crash game loop
   */
  async startGameLoop() {
    console.log('Crash game loop starting...');
    await this.startNewRound();
  }

  /**
   * Start a new round
   */
  async startNewRound() {
    const roundId = Date.now();

    // Generate provably fair crash point
    const serverSeedData = await this.generateCrashSeed();
    const crashPoint = verifyCrashPoint(
      serverSeedData.serverSeed,
      serverSeedData.clientSeed,
      serverSeedData.nonce
    );

    const round: CrashRound = {
      id: roundId,
      crashPoint,
      serverSeed: serverSeedData.serverSeed,
      serverSeedHash: serverSeedData.serverSeedHash,
      clientSeed: serverSeedData.clientSeed,
      nonce: serverSeedData.nonce,
      status: 'WAITING',
      bets: [],
    };

    await redis.set(CRASH_STATE_KEY, JSON.stringify(round));

    // Broadcast waiting phase
    emitToCrash('crash:waiting', {
      roundId,
      serverSeedHash: round.serverSeedHash,
      countdown: CASINO.CRASH_COUNTDOWN_MS / 1000,
    });

    // Start round after countdown
    this.roundInterval = setTimeout(async () => {
      await this.runRound(roundId);
    }, CASINO.CRASH_COUNTDOWN_MS);
  }

  /**
   * Run the multiplier phase
   */
  async runRound(roundId: number) {
    const state = await this.getState();
    if (!state || state.id !== roundId) return;

    state.status = 'RUNNING';
    state.startedAt = Date.now();
    state.currentMultiplier = 1.0;
    await redis.set(CRASH_STATE_KEY, JSON.stringify(state));

    emitToCrash('crash:started', { roundId });

    // Multiplier tick
    const startTime = Date.now();
    const crashPoint = state.crashPoint;

    this.multiplierInterval = setInterval(async () => {
      const elapsed = (Date.now() - startTime) / 1000;
      // Exponential growth: multiplier = e^(0.06 * t)
      const currentMultiplier = Math.round(Math.exp(0.06 * elapsed) * 100) / 100;

      if (currentMultiplier >= crashPoint) {
        // CRASH!
        if (this.multiplierInterval) clearInterval(this.multiplierInterval);
        await this.crashRound(roundId, crashPoint);
        return;
      }

      // Update state
      const currentState = await this.getState();
      if (currentState) {
        currentState.currentMultiplier = currentMultiplier;

        // Check auto-cashouts
        for (const bet of currentState.bets) {
          if (!bet.cashedOut && bet.autoCashout && currentMultiplier >= bet.autoCashout) {
            await this.autoCashoutBet(roundId, bet.userId, currentMultiplier);
          }
        }

        await redis.set(CRASH_STATE_KEY, JSON.stringify(currentState));
      }

      emitToCrash('crash:tick', { roundId, multiplier: currentMultiplier });
    }, 100); // 10 ticks per second
  }

  /**
   * Handle crash
   */
  async crashRound(roundId: number, crashPoint: number) {
    const state = await this.getState();
    if (!state || state.id !== roundId) return;

    state.status = 'CRASHED';
    state.crashedAt = Date.now();
    state.currentMultiplier = crashPoint;
    await redis.set(CRASH_STATE_KEY, JSON.stringify(state));

    // Emit crash event
    emitToCrash('crash:crashed', {
      roundId,
      crashPoint,
      serverSeed: state.serverSeed,
      bets: state.bets.map((b) => ({
        username: b.username,
        stake: b.stake,
        currency: b.currency,
        cashedOut: b.cashedOut,
        cashoutMultiplier: b.cashoutMultiplier,
        winAmount: b.winAmount,
      })),
    });

    // Save to history
    await this.saveToHistory({
      roundId,
      crashPoint,
      serverSeedHash: state.serverSeedHash,
      totalBets: state.bets.length,
      timestamp: Date.now(),
    });

    // Process uncashed bets as losses
    for (const bet of state.bets) {
      if (!bet.cashedOut) {
        // Bet lost - funds already deducted
        await this.recordBetResult(bet, 0, roundId);
      }
    }

    // Start new round after delay
    setTimeout(async () => {
      await this.startNewRound();
    }, 3000);
  }

  /**
   * Place a bet for the current round
   */
  async placeBet(
    userId: string,
    stake: string,
    currencySymbol: string,
    autoCashout?: number
  ): Promise<CrashBet> {
    const state = await this.getState();
    if (!state || state.status !== 'WAITING') {
      throw new AppError('ROUND_NOT_ACCEPTING', 'Round is not accepting bets', 400);
    }

    // Check if user already has a bet in this round
    if (state.bets.find((b) => b.userId === userId)) {
      throw new AppError('ALREADY_BET', 'You already have a bet in this round', 400);
    }

    const stakeDecimal = new Decimal(stake);

    // Validate and deduct balance
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currencySymbol } },
    });

    if (!wallet || new Decimal(wallet.balance.toString()).lt(stakeDecimal)) {
      throw new InsufficientBalanceError();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    // Deduct balance
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: stakeDecimal.toNumber() } },
    });

    await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'BET',
        amount: stakeDecimal.negated().toNumber(),
        status: 'COMPLETED',
        metadata: { game: 'crash', roundId: state.id },
      },
    });

    const bet: CrashBet = {
      id: `${state.id}-${userId}`,
      userId,
      username: user?.username || 'anonymous',
      stake,
      currency: currencySymbol,
      autoCashout,
      cashedOut: false,
    };

    state.bets.push(bet);
    await redis.set(CRASH_STATE_KEY, JSON.stringify(state));

    emitToCrash('crash:bet', {
      username: bet.username,
      stake: bet.stake,
      currency: bet.currency,
    });

    return bet;
  }

  /**
   * Manual cash out during round
   */
  async cashout(userId: string): Promise<{ multiplier: number; winAmount: string }> {
    const state = await this.getState();
    if (!state || state.status !== 'RUNNING') {
      throw new AppError('ROUND_NOT_RUNNING', 'Round is not running', 400);
    }

    const bet = state.bets.find((b) => b.userId === userId && !b.cashedOut);
    if (!bet) {
      throw new AppError('NO_ACTIVE_BET', 'No active bet in this round', 400);
    }

    const multiplier = state.currentMultiplier || 1;
    const stakeDecimal = new Decimal(bet.stake);
    const winAmount = stakeDecimal.mul(multiplier).toDecimalPlaces(8);

    bet.cashedOut = true;
    bet.cashoutMultiplier = multiplier;
    bet.winAmount = winAmount.toString();

    await redis.set(CRASH_STATE_KEY, JSON.stringify(state));

    // Credit wallet
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: bet.currency } },
    });

    if (wallet) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: winAmount.toNumber() } },
      });

      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WIN',
          amount: winAmount.toNumber(),
          status: 'COMPLETED',
          metadata: { game: 'crash', roundId: state.id, multiplier },
        },
      });
    }

    await this.recordBetResult(bet, multiplier, state.id);

    emitToCrash('crash:cashout', {
      username: bet.username,
      multiplier,
      winAmount: winAmount.toString(),
    });

    return { multiplier, winAmount: winAmount.toString() };
  }

  /**
   * Auto-cashout during round
   */
  private async autoCashoutBet(roundId: number, userId: string, multiplier: number) {
    try {
      await this.cashout(userId);
    } catch {
      // Ignore errors during auto-cashout
    }
  }

  /**
   * Get current game state (for new connections)
   */
  async getState(): Promise<CrashRound | null> {
    const data = await redis.get(CRASH_STATE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  }

  /**
   * Get crash history
   */
  async getHistory(limit = 20) {
    const data = await redis.lrange(CRASH_HISTORY_KEY, 0, limit - 1);
    return data.map((d) => JSON.parse(d));
  }

  private async saveToHistory(round: any) {
    await redis.lpush(CRASH_HISTORY_KEY, JSON.stringify(round));
    await redis.ltrim(CRASH_HISTORY_KEY, 0, 99); // Keep last 100
  }

  private async recordBetResult(bet: CrashBet, multiplier: number, roundId: number) {
    // Update user's total wagered
    await prisma.user.update({
      where: { id: bet.userId },
      data: { totalWagered: { increment: parseFloat(bet.stake) } },
    });
  }

  private async generateCrashSeed() {
    const { generateSecureToken, hashSHA256 } = await import('../../../../utils/crypto');
    const serverSeed = generateSecureToken(32);
    const clientSeed = 'cryptobet-crash';
    const nonce = Date.now();
    return {
      serverSeed,
      serverSeedHash: hashSHA256(serverSeed),
      clientSeed,
      nonce,
    };
  }

  stopGameLoop() {
    if (this.roundInterval) clearTimeout(this.roundInterval);
    if (this.multiplierInterval) clearInterval(this.multiplierInterval);
  }
}

export const crashGameService = new CrashGameService();
