import prisma from '../../lib/prisma';
import { NotFoundError, AppError } from '../../utils/errors';

interface GameLaunchResult {
  url: string;
  sessionId: string;
  token: string;
}

interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
  secretKey: string;
}

export class ProviderAdapter {
  private configs: Map<string, ProviderConfig> = new Map();

  async launchGame(
    userId: string,
    gameId: string,
    currency: string,
    demo: boolean = false
  ): Promise<GameLaunchResult> {
    const game = await prisma.casinoGame.findUnique({
      where: { id: gameId },
      include: { provider: true },
    });

    if (!game) throw new NotFoundError('Game', gameId);
    if (!game.isActive) throw new AppError('GAME_INACTIVE', 'Game is not available', 400);

    const session = await prisma.casinoSession.create({
      data: {
        userId,
        gameId,
        currency,
      },
    });

    // In production, call the actual provider API
    const providerName = game.provider?.name || 'internal';
    const token = `session_${session.id}_${Date.now()}`;

    return {
      url: demo
        ? `/casino/demo/${game.slug}?token=${token}`
        : `/casino/play/${game.slug}?token=${token}`,
      sessionId: session.id,
      token,
    };
  }

  async processCallback(
    providerName: string,
    action: string,
    data: Record<string, unknown>
  ) {
    switch (action) {
      case 'bet':
        return this.handleBet(data);
      case 'win':
        return this.handleWin(data);
      case 'refund':
        return this.handleRefund(data);
      default:
        throw new AppError('UNKNOWN_ACTION', `Unknown callback action: ${action}`, 400);
    }
  }

  private async handleBet(data: Record<string, unknown>) {
    const { sessionId, amount, transactionId } = data as {
      sessionId: string;
      amount: number;
      transactionId: string;
    };

    const session = await prisma.casinoSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundError('Session', sessionId);

    const wallet = await prisma.wallet.findFirst({
      where: { userId: session.userId, currency: { symbol: session.currency } },
    });
    if (!wallet) throw new AppError('NO_WALLET', 'Wallet not found', 400);

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      }),
      prisma.casinoSession.update({
        where: { id: sessionId },
        data: {
          totalBet: { increment: amount },
          rounds: { increment: 1 },
        },
      }),
    ]);

    return { success: true, balance: wallet.balance.toNumber() - amount };
  }

  private async handleWin(data: Record<string, unknown>) {
    const { sessionId, amount } = data as { sessionId: string; amount: number };

    const session = await prisma.casinoSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundError('Session', sessionId);

    const wallet = await prisma.wallet.findFirst({
      where: { userId: session.userId, currency: { symbol: session.currency } },
    });
    if (!wallet) throw new AppError('NO_WALLET', 'Wallet not found', 400);

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      }),
      prisma.casinoSession.update({
        where: { id: sessionId },
        data: { totalWin: { increment: amount } },
      }),
    ]);

    return { success: true, balance: wallet.balance.toNumber() + amount };
  }

  private async handleRefund(data: Record<string, unknown>) {
    const { sessionId, amount } = data as { sessionId: string; amount: number };

    const session = await prisma.casinoSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundError('Session', sessionId);

    const wallet = await prisma.wallet.findFirst({
      where: { userId: session.userId, currency: { symbol: session.currency } },
    });
    if (!wallet) throw new AppError('NO_WALLET', 'Wallet not found', 400);

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    return { success: true, balance: wallet.balance.toNumber() + amount };
  }
}

export const providerAdapter = new ProviderAdapter();
