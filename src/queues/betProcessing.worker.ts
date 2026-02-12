import { Job } from 'bullmq';
import prisma from '../lib/prisma';
import Decimal from 'decimal.js';
import { addRewardCalculationJob } from './index';

export interface BetProcessingData {
  betId: string;
  userId: string;
  stake: string;
  currencySymbol: string;
}

export async function processBet(job: Job<BetProcessingData>): Promise<void> {
  const { betId, userId, stake, currencySymbol } = job.data;

  try {
    // Lock user balance
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId,
        currency: { symbol: currencySymbol },
      },
    });

    if (!wallet) {
      await prisma.bet.update({ where: { id: betId }, data: { status: 'VOID' } });
      return;
    }

    const stakeDecimal = new Decimal(stake);
    const available = new Decimal(wallet.balance.toString());

    if (available.lt(stakeDecimal)) {
      await prisma.bet.update({ where: { id: betId }, data: { status: 'VOID' } });
      return;
    }

    // Deduct from balance and lock
    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: stakeDecimal.toNumber() },
          lockedBalance: { increment: stakeDecimal.toNumber() },
        },
      }),
      prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'BET',
          amount: stakeDecimal.negated().toNumber(),
          status: 'COMPLETED',
          metadata: { betId },
        },
      }),
      prisma.bet.update({
        where: { id: betId },
        data: { status: 'ACCEPTED' },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { totalWagered: { increment: stakeDecimal.toNumber() } },
      }),
    ]);

    // Trigger reward calculation
    await addRewardCalculationJob({
      userId,
      betId,
      stake,
      currencySymbol,
      type: 'BET',
    });
  } catch (error) {
    console.error(`Bet processing failed for ${betId}:`, error);
    throw error;
  }
}
