import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { REWARDS } from '../../config/constants';
import { AppError } from '../../utils/errors';

export class WelcomePackageService {
  async activate(userId: string): Promise<any> {
    const existing = await prisma.welcomePackage.findUnique({ where: { userId } });
    if (existing) throw new AppError('ALREADY_ACTIVATED', 'Welcome package already activated', 400);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + REWARDS.WELCOME_PACKAGE_DAYS * 24 * 60 * 60 * 1000);

    return prisma.welcomePackage.create({
      data: {
        userId,
        expiresAt,
        maxReward: REWARDS.WELCOME_PACKAGE_MAX_REWARD,
        rakebackPercent: REWARDS.WELCOME_RAKEBACK_PERCENT,
      },
    });
  }

  async getStatus(userId: string) {
    const pkg = await prisma.welcomePackage.findUnique({ where: { userId } });
    if (!pkg) return { active: false, eligible: true };

    const now = new Date();
    const isActive = pkg.isActive && now < pkg.expiresAt;
    const daysRemaining = Math.max(0, Math.ceil((pkg.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const dayNumber = REWARDS.WELCOME_PACKAGE_DAYS - daysRemaining;

    return {
      active: isActive,
      eligible: false,
      activatedAt: pkg.activatedAt.toISOString(),
      expiresAt: pkg.expiresAt.toISOString(),
      dayNumber,
      daysRemaining,
      totalEarned: pkg.totalEarned.toString(),
      maxReward: pkg.maxReward.toString(),
      progressPercent: new Decimal(pkg.totalEarned.toString()).div(pkg.maxReward.toString()).mul(100).toNumber(),
      rakebackPercent: pkg.rakebackPercent.toString(),
      dailyDropsClaimed: pkg.dailyDropsClaimed,
      cashVaultAmount: pkg.cashVaultAmount.toString(),
      cashVaultClaimed: pkg.cashVaultClaimed,
      canClaimCashVault: dayNumber >= 30 && !pkg.cashVaultClaimed,
    };
  }

  async claimCashVault(userId: string): Promise<{ amount: string }> {
    const pkg = await prisma.welcomePackage.findUnique({ where: { userId } });
    if (!pkg) throw new AppError('NO_PACKAGE', 'No welcome package found', 404);

    const now = new Date();
    const dayNumber = REWARDS.WELCOME_PACKAGE_DAYS - Math.max(0, Math.ceil((pkg.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    if (dayNumber < 30) throw new AppError('TOO_EARLY', 'Cash vault available on day 30', 400);
    if (pkg.cashVaultClaimed) throw new AppError('ALREADY_CLAIMED', 'Cash vault already claimed', 400);

    const vaultAmount = new Decimal(pkg.cashVaultAmount.toString());
    if (vaultAmount.lte(0)) throw new AppError('EMPTY_VAULT', 'Cash vault is empty', 400);

    // Credit to wallet
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: 'USDT' } },
    });

    if (wallet) {
      await prisma.$transaction([
        prisma.welcomePackage.update({
          where: { userId },
          data: { cashVaultClaimed: true, isActive: false },
        }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: vaultAmount.toNumber() } },
        }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'REWARD',
            amount: vaultAmount.toNumber(),
            status: 'COMPLETED',
            metadata: { type: 'cash_vault' },
          },
        }),
        prisma.reward.create({
          data: {
            userId,
            type: 'CASH_VAULT',
            amount: vaultAmount.toNumber(),
            currency: 'USDT',
            status: 'CLAIMED',
            claimedAt: new Date(),
          },
        }),
      ]);
    }

    return { amount: vaultAmount.toString() };
  }

  async addToCashVault(userId: string, amount: string): Promise<void> {
    const pkg = await prisma.welcomePackage.findUnique({ where: { userId } });
    if (!pkg || !pkg.isActive) return;

    const totalEarned = new Decimal(pkg.totalEarned.toString()).plus(amount);
    if (totalEarned.gt(pkg.maxReward.toString())) return; // Cap reached

    await prisma.welcomePackage.update({
      where: { userId },
      data: {
        cashVaultAmount: { increment: parseFloat(amount) * 0.1 }, // 10% goes to vault
        totalEarned: { increment: parseFloat(amount) },
        dailyDropsClaimed: { increment: 1 },
      },
    });
  }
}

export const welcomePackageService = new WelcomePackageService();
