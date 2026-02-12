import Decimal from 'decimal.js';
import prisma from '../../../../lib/prisma';
import { AppError, InsufficientBalanceError } from '../../../../utils/errors';
import { provablyFairService } from '../../provablyFair';
import { verifyMinesPositions } from '../../../../utils/crypto';
import { redis } from '../../../../lib/redis';

interface MinesGame {
  gameId: string;
  userId: string;
  stake: string;
  currency: string;
  mineCount: number;
  minePositions: number[];
  revealedTiles: number[];
  currentMultiplier: string;
  status: 'active' | 'won' | 'lost';
}

export class MinesGameService {
  async startGame(userId: string, currency: string, stake: string, mineCount: number) {
    if (mineCount < 1 || mineCount > 24) {
      throw new AppError('INVALID_MINES', 'Mine count must be between 1 and 24', 400);
    }

    const stakeDecimal = new Decimal(stake);
    if (stakeDecimal.lte(0)) throw new AppError('INVALID_STAKE', 'Stake must be positive', 400);

    // Check for existing active game
    const existingKey = `mines:active:${userId}`;
    const existing = await redis.get(existingKey);
    if (existing) throw new AppError('GAME_ACTIVE', 'You already have an active mines game', 400);

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currency } },
    });

    if (!wallet || new Decimal(wallet.balance.toString()).lt(stakeDecimal)) {
      throw new InsufficientBalanceError();
    }

    // Deduct stake
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: stakeDecimal.toNumber() } },
    });

    const seedData = await provablyFairService.getNextResult(userId, 'mines');
    const minePositions = verifyMinesPositions(
      seedData.serverSeed, seedData.clientSeed, seedData.nonce, mineCount
    );

    const gameId = `mines_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const game: MinesGame = {
      gameId,
      userId,
      stake,
      currency,
      mineCount,
      minePositions,
      revealedTiles: [],
      currentMultiplier: '1',
      status: 'active',
    };

    await redis.set(existingKey, JSON.stringify(game), 'EX', 3600); // 1 hour expiry

    return {
      gameId,
      mineCount,
      stake,
      currency,
      gridSize: 25,
      serverSeedHash: seedData.serverSeedHash,
      clientSeed: seedData.clientSeed,
      nonce: seedData.nonce,
    };
  }

  async revealTile(userId: string, position: number) {
    if (position < 0 || position > 24) {
      throw new AppError('INVALID_POSITION', 'Position must be between 0 and 24', 400);
    }

    const gameKey = `mines:active:${userId}`;
    const gameData = await redis.get(gameKey);
    if (!gameData) throw new AppError('NO_GAME', 'No active mines game found', 404);

    const game: MinesGame = JSON.parse(gameData);

    if (game.revealedTiles.includes(position)) {
      throw new AppError('ALREADY_REVEALED', 'Tile already revealed', 400);
    }

    const hitMine = game.minePositions.includes(position);

    if (hitMine) {
      game.status = 'lost';
      game.revealedTiles.push(position);
      await redis.del(gameKey);

      return {
        position,
        mine: true,
        gameOver: true,
        minePositions: game.minePositions,
        payout: '0',
        profit: new Decimal(game.stake).negated().toString(),
      };
    }

    game.revealedTiles.push(position);

    // Calculate multiplier: Combination-based
    const totalTiles = 25;
    const safeTiles = totalTiles - game.mineCount;
    const revealed = game.revealedTiles.length;

    let multiplier = new Decimal(1);
    for (let i = 0; i < revealed; i++) {
      multiplier = multiplier.mul(new Decimal(totalTiles - i).div(safeTiles - i));
    }
    multiplier = multiplier.mul(0.97).toDecimalPlaces(4); // 3% house edge

    game.currentMultiplier = multiplier.toString();

    if (revealed >= safeTiles) {
      // All safe tiles revealed - auto cashout
      return this.cashout(userId);
    }

    await redis.set(gameKey, JSON.stringify(game), 'EX', 3600);

    return {
      position,
      mine: false,
      gameOver: false,
      revealedCount: revealed,
      currentMultiplier: multiplier.toString(),
      nextMultiplier: this.calculateNextMultiplier(totalTiles, safeTiles, revealed + 1),
    };
  }

  async cashout(userId: string) {
    const gameKey = `mines:active:${userId}`;
    const gameData = await redis.get(gameKey);
    if (!gameData) throw new AppError('NO_GAME', 'No active mines game found', 404);

    const game: MinesGame = JSON.parse(gameData);
    if (game.revealedTiles.length === 0) {
      throw new AppError('NO_REVEALS', 'Must reveal at least one tile before cashing out', 400);
    }

    const stakeDecimal = new Decimal(game.stake);
    const multiplier = new Decimal(game.currentMultiplier);
    const payout = stakeDecimal.mul(multiplier).toDecimalPlaces(8);
    const profit = payout.minus(stakeDecimal);

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: game.currency } },
    });

    if (wallet) {
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: payout.toNumber() } },
        }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'WIN',
            amount: payout.toNumber(),
            status: 'COMPLETED',
            metadata: {
              game: 'mines',
              mineCount: game.mineCount,
              revealedTiles: game.revealedTiles.length,
              multiplier: multiplier.toString(),
            },
          },
        }),
      ]);
    }

    await redis.del(gameKey);

    return {
      gameOver: true,
      won: true,
      payout: payout.toString(),
      profit: profit.toString(),
      multiplier: multiplier.toString(),
      revealedTiles: game.revealedTiles,
      minePositions: game.minePositions,
    };
  }

  private calculateNextMultiplier(totalTiles: number, safeTiles: number, revealed: number): string {
    if (revealed >= safeTiles) return '0';
    let multiplier = new Decimal(1);
    for (let i = 0; i < revealed; i++) {
      multiplier = multiplier.mul(new Decimal(totalTiles - i).div(safeTiles - i));
    }
    return multiplier.mul(0.97).toDecimalPlaces(4).toString();
  }
}

export const minesGameService = new MinesGameService();
