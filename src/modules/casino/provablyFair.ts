import prisma from '../../lib/prisma';
import { generateProvablyFairSeed, hashSHA256, verifyCrashPoint, verifyDiceRoll, verifyCoinFlip, verifyMinesPositions, verifyPlinkoPath } from '../../utils/crypto';
import { AppError } from '../../utils/errors';

export class ProvablyFairService {
  /**
   * Create initial seeds for a user
   */
  async createSeeds(userId: string, clientSeed?: string) {
    const { serverSeed, serverSeedHash } = generateProvablyFairSeed();

    const seed = await prisma.provablyFairSeed.create({
      data: {
        userId,
        serverSeed,
        serverSeedHash,
        clientSeed: clientSeed || this.generateDefaultClientSeed(),
        nonce: 0,
      },
    });

    return {
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
  }

  /**
   * Get active seeds for a user (unhashed server seed is hidden)
   */
  async getActiveSeeds(userId: string) {
    let seed = await prisma.provablyFairSeed.findFirst({
      where: { userId, isRevealed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!seed) {
      // Auto-create seeds if none exist
      const result = await this.createSeeds(userId);
      return result;
    }

    return {
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
  }

  /**
   * Update client seed
   */
  async setClientSeed(userId: string, clientSeed: string) {
    const seed = await prisma.provablyFairSeed.findFirst({
      where: { userId, isRevealed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!seed) throw new AppError('NO_ACTIVE_SEED', 'No active seed found', 404);

    await prisma.provablyFairSeed.update({
      where: { id: seed.id },
      data: { clientSeed },
    });

    return { serverSeedHash: seed.serverSeedHash, clientSeed, nonce: seed.nonce };
  }

  /**
   * Rotate seeds (reveals old server seed, creates new pair)
   */
  async rotateSeeds(userId: string) {
    const currentSeed = await prisma.provablyFairSeed.findFirst({
      where: { userId, isRevealed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentSeed) throw new AppError('NO_ACTIVE_SEED', 'No active seed found', 404);

    // Reveal current seed
    await prisma.provablyFairSeed.update({
      where: { id: currentSeed.id },
      data: { isRevealed: true, revealedAt: new Date() },
    });

    // Create new seeds
    const newSeeds = await this.createSeeds(userId);

    return {
      previousSeed: {
        serverSeed: currentSeed.serverSeed, // Now revealed
        serverSeedHash: currentSeed.serverSeedHash,
        clientSeed: currentSeed.clientSeed,
        nonce: currentSeed.nonce,
      },
      newSeeds,
    };
  }

  /**
   * Get next game result using current seeds
   */
  async getNextResult(userId: string, gameType: string): Promise<{ serverSeed: string; clientSeed: string; nonce: number; serverSeedHash: string }> {
    const seed = await prisma.provablyFairSeed.findFirst({
      where: { userId, isRevealed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!seed) {
      await this.createSeeds(userId);
      return this.getNextResult(userId, gameType);
    }

    const nonce = seed.nonce;

    // Increment nonce
    await prisma.provablyFairSeed.update({
      where: { id: seed.id },
      data: { nonce: { increment: 1 } },
    });

    return {
      serverSeed: seed.serverSeed,
      clientSeed: seed.clientSeed,
      nonce,
      serverSeedHash: seed.serverSeedHash,
    };
  }

  /**
   * Verify a game result
   */
  verify(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    gameType: string;
    gameParams?: any;
  }): { serverSeedHash: string; result: number | string | number[] | ('L' | 'R')[]; type: string } {
    const { serverSeed, clientSeed, nonce, gameType, gameParams } = params;

    // Verify server seed hash
    const expectedHash = hashSHA256(serverSeed);

    switch (gameType) {
      case 'crash':
        return {
          serverSeedHash: expectedHash,
          result: verifyCrashPoint(serverSeed, clientSeed, nonce),
          type: 'crash_point',
        };

      case 'dice':
        return {
          serverSeedHash: expectedHash,
          result: verifyDiceRoll(serverSeed, clientSeed, nonce),
          type: 'dice_roll',
        };

      case 'coinflip':
        return {
          serverSeedHash: expectedHash,
          result: verifyCoinFlip(serverSeed, clientSeed, nonce),
          type: 'coin_side',
        };

      case 'mines':
        const mineCount = gameParams?.mineCount || 5;
        return {
          serverSeedHash: expectedHash,
          result: verifyMinesPositions(serverSeed, clientSeed, nonce, mineCount),
          type: 'mine_positions',
        };

      case 'plinko':
        const rows = gameParams?.rows || 12;
        return {
          serverSeedHash: expectedHash,
          result: verifyPlinkoPath(serverSeed, clientSeed, nonce, rows),
          type: 'plinko_path',
        };

      default:
        throw new AppError('INVALID_GAME', 'Unknown game type', 400);
    }
  }

  /**
   * Get seed history for a user
   */
  async getSeedHistory(userId: string, limit = 20) {
    return prisma.provablyFairSeed.findMany({
      where: { userId, isRevealed: true },
      orderBy: { revealedAt: 'desc' },
      take: limit,
      select: {
        serverSeed: true,
        serverSeedHash: true,
        clientSeed: true,
        nonce: true,
        revealedAt: true,
        createdAt: true,
      },
    });
  }

  private generateDefaultClientSeed(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export const provablyFairService = new ProvablyFairService();
