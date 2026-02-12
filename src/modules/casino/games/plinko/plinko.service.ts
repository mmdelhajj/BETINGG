import Decimal from 'decimal.js';
import prisma from '../../../../lib/prisma';
import { AppError, InsufficientBalanceError } from '../../../../utils/errors';
import { provablyFairService } from '../../provablyFair';
import { verifyPlinkoPath } from '../../../../utils/crypto';

type PlinkoRisk = 'low' | 'medium' | 'high';

const PLINKO_MULTIPLIERS: Record<number, Record<PlinkoRisk, number[]>> = {
  8: {
    low:    [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high:   [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low:    [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high:   [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low:    [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high:   [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export class PlinkoGameService {
  async play(
    userId: string,
    currency: string,
    stake: string,
    rows: number,
    risk: PlinkoRisk
  ) {
    if (![8, 12, 16].includes(rows)) {
      throw new AppError('INVALID_ROWS', 'Rows must be 8, 12, or 16', 400);
    }

    const stakeDecimal = new Decimal(stake);
    if (stakeDecimal.lte(0)) throw new AppError('INVALID_STAKE', 'Stake must be positive', 400);

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currency } },
    });

    if (!wallet || new Decimal(wallet.balance.toString()).lt(stakeDecimal)) {
      throw new InsufficientBalanceError();
    }

    const seedData = await provablyFairService.getNextResult(userId, 'plinko');
    const path = verifyPlinkoPath(seedData.serverSeed, seedData.clientSeed, seedData.nonce, rows);

    // Calculate bucket index from path
    let position = 0;
    for (const direction of path) {
      position += direction === 'R' ? 1 : 0; // L = left, R = right
    }

    const multipliers = PLINKO_MULTIPLIERS[rows][risk];
    const multiplier = new Decimal(multipliers[position]);
    const payout = stakeDecimal.mul(multiplier).toDecimalPlaces(8);
    const profit = payout.minus(stakeDecimal);
    const won = payout.gt(stakeDecimal);

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: stakeDecimal.toNumber() } },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'BET',
          amount: stakeDecimal.negated().toNumber(),
          status: 'COMPLETED',
          metadata: { game: 'plinko', rows, risk, bucket: position },
        },
      });

      if (payout.gt(0)) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: payout.toNumber() } },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'WIN',
            amount: payout.toNumber(),
            status: 'COMPLETED',
            metadata: { game: 'plinko', multiplier: multiplier.toString() },
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { totalWagered: { increment: stakeDecimal.toNumber() } },
      });
    });

    return {
      path,
      bucket: position,
      multiplier: multiplier.toString(),
      payout: payout.toString(),
      profit: profit.toString(),
      won,
      stake,
      currency,
      rows,
      risk,
      serverSeedHash: seedData.serverSeedHash,
      clientSeed: seedData.clientSeed,
      nonce: seedData.nonce,
    };
  }

  getMultipliers(rows: number, risk: PlinkoRisk) {
    if (!PLINKO_MULTIPLIERS[rows]) return null;
    return PLINKO_MULTIPLIERS[rows][risk] || null;
  }
}

export const plinkoGameService = new PlinkoGameService();
