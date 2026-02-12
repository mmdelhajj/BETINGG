import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { AppError, NotFoundError, ValidationError, ConflictError } from '../../utils/errors';
import { getCache, setCache, deleteCachePattern } from '../../lib/redis';
import { addNotificationJob } from '../../queues';

export class PromotionsService {
  async getActivePromotions() {
    const cached = await getCache<any[]>('promotions:active');
    if (cached) return cached;

    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const active = promotions.filter((p) => {
      const cond = p.conditions as any;
      if (cond?.endDate && new Date(cond.endDate) < now) return false;
      if (cond?.maxUses && p.claimCount >= cond.maxUses) return false;
      return true;
    });

    await setCache('promotions:active', active, 300);
    return active;
  }

  async getPromotion(id: string) {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) throw new NotFoundError('Promotion', id);
    return promotion;
  }

  async claimPromoCode(userId: string, code: string) {
    const normalized = code.trim().toUpperCase();
    const promotion = await prisma.promotion.findFirst({ where: { code: normalized, isActive: true } });
    if (!promotion) throw new NotFoundError('Promotion code', normalized);

    const conditions = promotion.conditions as any;
    const reward = promotion.reward as any;
    const now = new Date();

    if (conditions?.endDate && new Date(conditions.endDate) < now) throw new ValidationError('Promotion expired');
    if (conditions?.maxUses && promotion.claimCount >= conditions.maxUses) throw new ValidationError('Promotion exhausted');

    const maxPerUser = conditions?.maxUsesPerUser ?? 1;
    const userClaims = await prisma.promoClaim.count({
      where: { userId, promotionId: promotion.id },
    });
    if (userClaims >= maxPerUser) throw new ConflictError('Already claimed');

    let rewardAmount: Decimal;
    if (reward.type === 'FIXED' || reward.type === 'FREE_BET') {
      rewardAmount = new Decimal(reward.amount || '0');
    } else if (reward.type === 'PERCENTAGE') {
      const userWallets = await prisma.wallet.findMany({
        where: { userId },
        select: { balance: true },
      });
      const totalBalance = userWallets.reduce((sum, w) => sum.plus(new Decimal(w.balance.toString())), new Decimal(0));
      rewardAmount = totalBalance.mul(reward.percentage || 0).div(100);
      if (reward.maxCap) {
        const cap = new Decimal(reward.maxCap);
        if (rewardAmount.gt(cap)) rewardAmount = cap;
      }
    } else {
      throw new AppError('INVALID_REWARD', 'Unknown reward type', 500);
    }

    if (rewardAmount.lte(0)) throw new ValidationError('Reward amount is zero');

    const claim = await prisma.$transaction(async (tx) => {
      const newClaim = await tx.promoClaim.create({
        data: {
          userId,
          promotionId: promotion.id,
          amount: rewardAmount.toFixed(8),
          claimedAt: now,
        },
      });

      await tx.promotion.update({
        where: { id: promotion.id },
        data: { claimCount: { increment: 1 } },
      });

      await tx.wallet.updateMany({
        where: { userId, currency: { symbol: reward.currency || 'USDT' } },
        data: { bonusBalance: { increment: parseFloat(rewardAmount.toFixed(8)) } },
      });

      return newClaim;
    });

    await deleteCachePattern('promotions:*');

    await addNotificationJob({
      userId,
      type: 'PROMOTION',
      title: 'Promotion Claimed!',
      message: `You received ${rewardAmount.toFixed(2)} ${reward.currency || 'USDT'} from "${promotion.title}"`,
      data: { promotionId: promotion.id, claimId: claim.id },
    });

    return { claimId: claim.id, rewardAmount: rewardAmount.toFixed(8), currency: reward.currency || 'USDT' };
  }

  async createPromotion(data: {
    code: string; name: string; description: string; type: string;
    conditions: any; reward: any; bannerUrl?: string;
  }) {
    const code = data.code.trim().toUpperCase();
    const existing = await prisma.promotion.findFirst({ where: { code } });
    if (existing) throw new ConflictError(`Code "${code}" already exists`);

    const promotion = await prisma.promotion.create({
      data: {
        code,
        title: data.name,
        description: data.description,
        type: data.type as any,
        conditions: data.conditions,
        reward: data.reward,
        startDate: new Date(),
        endDate: data.conditions?.endDate ? new Date(data.conditions.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
        claimCount: 0,
      },
    });

    await deleteCachePattern('promotions:*');
    return promotion;
  }

  async deactivatePromotion(id: string) {
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Promotion', id);
    await prisma.promotion.update({ where: { id }, data: { isActive: false } });
    await deleteCachePattern('promotions:*');
    return { id, deactivated: true };
  }
}

export const promotionsService = new PromotionsService();
