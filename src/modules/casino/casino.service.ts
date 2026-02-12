import prisma from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { GameType } from '@prisma/client';

export class CasinoService {
  async getGames(filters: {
    type?: string;
    category?: string;
    provider?: string;
    search?: string;
    tags?: string[];
    page?: number;
    limit?: number;
    sortBy?: 'popular' | 'new' | 'name';
  }) {
    const { type, category, provider, search, tags, page = 1, limit = 24, sortBy = 'popular' } = filters;

    const where: any = { isActive: true };
    if (type) where.type = type as GameType;
    if (category) where.category = category;
    if (provider) where.provider = { slug: provider };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (tags && tags.length > 0) where.tags = { hasSome: tags };

    const orderBy = sortBy === 'popular'
      ? { playCount: 'desc' as const }
      : sortBy === 'new'
        ? { id: 'desc' as const }
        : { name: 'asc' as const };

    const [games, total] = await Promise.all([
      prisma.casinoGame.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { provider: { select: { name: true, slug: true, logo: true } } },
      }),
      prisma.casinoGame.count({ where }),
    ]);

    return { games, meta: { page, total, hasMore: page * limit < total } };
  }

  async getGameBySlug(slug: string) {
    const game = await prisma.casinoGame.findUnique({
      where: { slug },
      include: { provider: true },
    });
    if (!game) throw new NotFoundError('Game');
    return game;
  }

  async getCategories() {
    const categories = await prisma.casinoGame.groupBy({
      by: ['category'],
      where: { isActive: true, category: { not: null } },
      _count: true,
    });
    return categories.map((c) => ({ name: c.category, count: c._count }));
  }

  async getProviders() {
    return prisma.gameProvider.findMany({
      where: { isActive: true },
      include: { _count: { select: { games: { where: { isActive: true } } } } },
    });
  }

  async getRecentlyPlayed(userId: string, limit = 10) {
    const sessions = await prisma.casinoSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      distinct: ['gameId'],
      include: {
        game: { include: { provider: { select: { name: true, slug: true } } } },
      },
    });
    return sessions.map((s) => s.game);
  }

  async getFavorites(userId: string) {
    const favorites = await prisma.userFavoriteGame.findMany({
      where: { userId },
      include: {
        game: { include: { provider: { select: { name: true, slug: true } } } },
      },
    });
    return favorites.map((f) => f.game);
  }

  async toggleFavorite(userId: string, gameId: string): Promise<boolean> {
    const existing = await prisma.userFavoriteGame.findUnique({
      where: { userId_gameId: { userId, gameId } },
    });

    if (existing) {
      await prisma.userFavoriteGame.delete({
        where: { userId_gameId: { userId, gameId } },
      });
      return false;
    }

    await prisma.userFavoriteGame.create({
      data: { userId, gameId },
    });
    return true;
  }

  async createSession(userId: string, gameId: string, currency: string) {
    await prisma.casinoGame.update({
      where: { id: gameId },
      data: { playCount: { increment: 1 } },
    });

    return prisma.casinoSession.create({
      data: { userId, gameId, currency },
    });
  }

  async endSession(sessionId: string) {
    return prisma.casinoSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  async updateSessionStats(sessionId: string, betAmount: string, winAmount: string) {
    return prisma.casinoSession.update({
      where: { id: sessionId },
      data: {
        totalBet: { increment: parseFloat(betAmount) },
        totalWin: { increment: parseFloat(winAmount) },
        rounds: { increment: 1 },
      },
    });
  }
}

export const casinoService = new CasinoService();
