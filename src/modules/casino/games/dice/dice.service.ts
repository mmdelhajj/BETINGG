import Decimal from 'decimal.js';
import prisma from '../../../../lib/prisma';
import { AppError, InsufficientBalanceError } from '../../../../utils/errors';
import { provablyFairService } from '../../provablyFair';
import { verifyDiceRoll } from '../../../../utils/crypto';
import { CASINO } from '../../../../config/constants';

interface DiceResult {
  roll: number;
  target: number;
  isOver: boolean;
  winChance: number;
  payout: string;
  multiplier: string;
  won: boolean;
  stake: string;
  currency: string;
  profit: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export class DiceGameService {
  private readonly houseEdge = CASINO.DICE_HOUSE_EDGE;

  private calculateMultiplier(winChance: number): Decimal {
    return new Decimal(100 - this.houseEdge).div(winChance).toDecimalPlaces(4);
  }

  private calculateWinChance(target: number, isOver: boolean): number {
    return isOver ? parseFloat((100 - target).toFixed(2)) : parseFloat(target.toFixed(2));
  }

  async play(
    userId: string,
    currency: string,
    stake: string,
    target: number,
    isOver: boolean
  ): Promise<DiceResult> {
    if (target < 1 || target > 98) {
      throw new AppError('INVALID_TARGET', 'Target must be between 1 and 98', 400);
    }

    const stakeDecimal = new Decimal(stake);
    if (stakeDecimal.lte(0)) throw new AppError('INVALID_STAKE', 'Stake must be positive', 400);

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currency } },
    });

    if (!wallet || new Decimal(wallet.balance.toString()).lt(stakeDecimal)) {
      throw new InsufficientBalanceError();
    }

    const seedData = await provablyFairService.getNextResult(userId, 'dice');
    const roll = verifyDiceRoll(seedData.serverSeed, seedData.clientSeed, seedData.nonce);

    const winChance = this.calculateWinChance(target, isOver);
    const multiplier = this.calculateMultiplier(winChance);
    const won = isOver ? roll > target : roll < target;
    const payout = won ? stakeDecimal.mul(multiplier).toDecimalPlaces(8) : new Decimal(0);
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
          metadata: { game: 'dice', roll, target, isOver, won },
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
            metadata: { game: 'dice', roll, multiplier: multiplier.toString() },
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { totalWagered: { increment: stakeDecimal.toNumber() } },
      });
    });

    return {
      roll,
      target,
      isOver,
      winChance,
      payout: payout.toString(),
      multiplier: multiplier.toString(),
      won,
      stake,
      currency,
      profit: profit.toString(),
      serverSeedHash: seedData.serverSeedHash,
      clientSeed: seedData.clientSeed,
      nonce: seedData.nonce,
    };
  }
}

export const diceGameService = new DiceGameService();
