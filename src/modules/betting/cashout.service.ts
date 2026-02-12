import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { AppError } from '../../utils/errors';
import { OddsEngine } from '../../services/oddsEngine';
import { emitToUser } from '../../lib/socket';

export class CashoutService {
  async getCashoutValue(betId: string, userId: string): Promise<{ available: boolean; amount: string }> {
    const bet = await prisma.bet.findFirst({
      where: { id: betId, userId, status: 'ACCEPTED', isCashoutAvailable: true },
      include: {
        legs: {
          include: {
            selection: { include: { market: true } },
          },
        },
      },
    });

    if (!bet) return { available: false, amount: '0' };

    // Check if all legs are still active (no settled legs)
    const hasSettled = bet.legs.some((leg) => leg.status !== 'PENDING');
    if (hasSettled) return { available: false, amount: '0' };

    const stake = new Decimal(bet.stake.toString());
    const originalOdds = new Decimal(bet.odds.toString());

    // Calculate current combined odds
    let currentCombinedOdds = new Decimal(1);
    for (const leg of bet.legs) {
      currentCombinedOdds = currentCombinedOdds.mul(new Decimal(leg.selection.odds.toString()));
    }

    const cashoutValue = OddsEngine.cashOutValue(stake, originalOdds, currentCombinedOdds);

    if (cashoutValue.lte(0)) return { available: false, amount: '0' };

    return { available: true, amount: cashoutValue.toString() };
  }

  async executeCashout(
    betId: string,
    userId: string,
    percentage: number = 100
  ): Promise<{ success: boolean; amount: string; remainingStake?: string }> {
    const bet = await prisma.bet.findFirst({
      where: { id: betId, userId, status: 'ACCEPTED', isCashoutAvailable: true },
      include: {
        legs: {
          include: { selection: true },
        },
      },
    });

    if (!bet) throw new AppError('CASHOUT_NOT_AVAILABLE', 'Cash out is not available for this bet', 400);

    const stake = new Decimal(bet.stake.toString());
    const originalOdds = new Decimal(bet.odds.toString());

    let currentCombinedOdds = new Decimal(1);
    for (const leg of bet.legs) {
      currentCombinedOdds = currentCombinedOdds.mul(new Decimal(leg.selection.odds.toString()));
    }

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: bet.currencySymbol } },
    });

    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404);

    if (percentage === 100) {
      // Full cash out
      const cashoutValue = OddsEngine.cashOutValue(stake, originalOdds, currentCombinedOdds);

      if (cashoutValue.lte(0)) {
        throw new AppError('CASHOUT_VALUE_ZERO', 'Cash out value is zero', 400);
      }

      await prisma.$transaction([
        prisma.bet.update({
          where: { id: betId },
          data: {
            status: 'CASHOUT',
            cashoutAmount: cashoutValue.toNumber(),
            cashoutAt: new Date(),
            settledAt: new Date(),
          },
        }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: cashoutValue.toNumber() },
            lockedBalance: { decrement: stake.toNumber() },
          },
        }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'WIN',
            amount: cashoutValue.toNumber(),
            status: 'COMPLETED',
            metadata: { betId, type: 'cashout' },
          },
        }),
      ]);

      try {
        emitToUser(userId, 'bet:cashout', {
          betId,
          amount: cashoutValue.toString(),
          type: 'full',
        });
      } catch { /* Socket may not be initialized */ }

      return { success: true, amount: cashoutValue.toString() };
    } else {
      // Partial cash out
      const { cashoutAmount, remainingStake } = OddsEngine.partialCashOutValue(
        stake,
        originalOdds,
        currentCombinedOdds,
        percentage
      );

      if (cashoutAmount.lte(0)) {
        throw new AppError('CASHOUT_VALUE_ZERO', 'Cash out value is zero', 400);
      }

      await prisma.$transaction([
        prisma.bet.update({
          where: { id: betId },
          data: {
            stake: remainingStake.toNumber(),
            potentialWin: remainingStake.mul(originalOdds).toNumber(),
            cashoutAmount: cashoutAmount.toNumber(),
          },
        }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: cashoutAmount.toNumber() },
            lockedBalance: { decrement: stake.minus(remainingStake).toNumber() },
          },
        }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'WIN',
            amount: cashoutAmount.toNumber(),
            status: 'COMPLETED',
            metadata: { betId, type: 'partial_cashout', percentage },
          },
        }),
      ]);

      try {
        emitToUser(userId, 'bet:cashout', {
          betId,
          amount: cashoutAmount.toString(),
          type: 'partial',
          percentage,
          remainingStake: remainingStake.toString(),
        });
      } catch { /* Socket may not be initialized */ }

      return {
        success: true,
        amount: cashoutAmount.toString(),
        remainingStake: remainingStake.toString(),
      };
    }
  }

  async setAutoCashout(
    betId: string,
    userId: string,
    targetMultiplier: number
  ): Promise<void> {
    const bet = await prisma.bet.findFirst({
      where: { id: betId, userId, status: 'ACCEPTED' },
    });

    if (!bet) throw new AppError('BET_NOT_FOUND', 'Bet not found', 404);

    // Store auto-cashout setting in Redis
    const { redis } = await import('../../lib/redis');
    await redis.setex(
      `auto_cashout:${betId}`,
      86400, // 24 hours
      JSON.stringify({ userId, targetMultiplier, stake: bet.stake.toString(), odds: bet.odds.toString() })
    );
  }
}

export const cashoutService = new CashoutService();
