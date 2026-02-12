import prisma from '../../lib/prisma';

export class TurboService {
  async getActiveTurbo(userId: string) {
    const turbo = await prisma.turboSession.findFirst({
      where: { userId, isActive: true, endsAt: { gt: new Date() } },
      orderBy: { startedAt: 'desc' },
    });

    if (!turbo) return { active: false };

    const remaining = Math.max(0, turbo.endsAt.getTime() - Date.now());
    return {
      active: true,
      boostPercent: turbo.boostPercent.toString(),
      endsAt: turbo.endsAt.toISOString(),
      remainingSeconds: Math.floor(remaining / 1000),
    };
  }

  async cleanupExpired(): Promise<number> {
    const result = await prisma.turboSession.updateMany({
      where: { isActive: true, endsAt: { lt: new Date() } },
      data: { isActive: false },
    });
    return result.count;
  }
}

export const turboService = new TurboService();
