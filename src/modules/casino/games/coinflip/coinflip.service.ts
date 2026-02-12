import Decimal from 'decimal.js';
import prisma from '../../../../lib/prisma';
import { AppError, InsufficientBalanceError } from '../../../../utils/errors';
import { provablyFairService } from '../../provablyFair';
import { verifyCoinFlip } from '../../../../utils/crypto';

const MULTIPLIER = new Decimal('1.98'); // 2x minus 1% house edge

export class CoinflipGameService {
  async play(
    userId: string,
    currency: string,
    stake: string,
    choice: 'heads' | 'tails'
  ) {
    const stakeDecimal = new Decimal(stake);
    if (stakeDecimal.lte(0)) throw new AppError('INVALID_STAKE', 'Stake must be positive', 400);

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currency } },
    });

    if (!wallet || new Decimal(wallet.balance.toString()).lt(stakeDecimal)) {
      throw new InsufficientBalanceError();
    }

    const seedData = await provablyFairService.getNextResult(userId, 'coinflip');
    const result = verifyCoinFlip(seedData.serverSeed, seedData.clientSeed, seedData.nonce);
    const won = result === choice;
    const payout = won ? stakeDecimal.mul(MULTIPLIER).toDecimalPlaces(8) : new Decimal(0);
    const profit = payout.minus(stakeDecimal);

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
          metadata: { game: 'coinflip', choice, result, won },
        },
      });

      if (won) {
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
            metadata: { game: 'coinflip', result },
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { totalWagered: { increment: stakeDecimal.toNumber() } },
      });
    });

    return {
      result,
      choice,
      won,
      payout: payout.toString(),
      multiplier: MULTIPLIER.toString(),
      profit: profit.toString(),
      stake,
      currency,
      serverSeedHash: seedData.serverSeedHash,
      clientSeed: seedData.clientSeed,
      nonce: seedData.nonce,
    };
  }
}

export const coinflipGameService = new CoinflipGameService();
