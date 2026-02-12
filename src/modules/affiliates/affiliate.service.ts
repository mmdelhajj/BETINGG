import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { Decimal } from '@prisma/client/runtime/library';
import crypto from 'crypto';

export class AffiliateService {
  // ─── Registration ─────────────────────────────────────────
  async register(data: { email: string; companyName?: string; website?: string }) {
    const existing = await prisma.affiliate.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('AFFILIATE_EXISTS', 'An affiliate with this email already exists', 409);

    return prisma.affiliate.create({
      data: {
        email: data.email,
        passwordHash: '$2b$10$placeholder.hash.will.be.replaced.on.activation',
        companyName: data.companyName,
        website: data.website,
        status: 'PENDING',
      },
    });
  }

  // ─── Dashboard (Affiliate) ────────────────────────────────
  async getStats(affiliateId: string) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: { referredPlayers: true },
    });
    if (!affiliate) throw new AppError('AFFILIATE_NOT_FOUND', 'Affiliate not found', 404);

    const totalReferred = affiliate.referredPlayers.length;
    const totalRevenue = affiliate.referredPlayers.reduce(
      (sum, p) => sum.add(p.revenue), new Decimal(0)
    );
    const totalCommission = affiliate.referredPlayers.reduce(
      (sum, p) => sum.add(p.commission), new Decimal(0)
    );

    // Monthly breakdown
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyPlayers = affiliate.referredPlayers.filter(p => p.createdAt >= thisMonth);
    const monthlyRevenue = monthlyPlayers.reduce((sum, p) => sum.add(p.revenue), new Decimal(0));
    const monthlyCommission = monthlyPlayers.reduce((sum, p) => sum.add(p.commission), new Decimal(0));

    return {
      affiliate: {
        id: affiliate.id,
        email: affiliate.email,
        companyName: affiliate.companyName,
        status: affiliate.status,
        commissionPercent: affiliate.commissionPercent.toString(),
        apiKey: affiliate.apiKey,
      },
      stats: {
        totalReferred,
        totalRevenue: totalRevenue.toString(),
        totalCommission: totalCommission.toString(),
        totalEarned: affiliate.totalEarned.toString(),
        monthly: {
          newPlayers: monthlyPlayers.length,
          revenue: monthlyRevenue.toString(),
          commission: monthlyCommission.toString(),
        },
      },
    };
  }

  async getReferredPlayers(affiliateId: string, opts: { page?: number; limit?: number }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 20, 100);

    const [players, total] = await Promise.all([
      prisma.affiliatePlayer.findMany({
        where: { affiliateId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.affiliatePlayer.count({ where: { affiliateId } }),
    ]);

    return { players, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  async generateApiKey(affiliateId: string) {
    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate) throw new AppError('AFFILIATE_NOT_FOUND', 'Affiliate not found', 404);
    if (affiliate.status !== 'APPROVED') throw new AppError('NOT_APPROVED', 'Affiliate must be approved first', 403);

    const apiKey = `aff_${crypto.randomBytes(32).toString('hex')}`;
    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: { apiKey },
    });

    return { apiKey };
  }

  async getEarningsReport(affiliateId: string, opts: { period: 'daily' | 'weekly' | 'monthly' }) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: { referredPlayers: true },
    });
    if (!affiliate) throw new AppError('AFFILIATE_NOT_FOUND', 'Affiliate not found', 404);

    // Group earnings by period
    const now = new Date();
    const periods: { label: string; start: Date; end: Date }[] = [];

    if (opts.period === 'daily') {
      for (let i = 29; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const end = new Date(start.getTime() + 86400000);
        periods.push({ label: start.toISOString().slice(0, 10), start, end });
      }
    } else if (opts.period === 'weekly') {
      for (let i = 11; i >= 0; i--) {
        const start = new Date(now.getTime() - i * 7 * 86400000);
        const end = new Date(start.getTime() + 7 * 86400000);
        periods.push({ label: `Week ${12 - i}`, start, end });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        periods.push({ label: `${monthNames[start.getMonth()]} ${start.getFullYear()}`, start, end });
      }
    }

    return periods.map(p => {
      const playersInPeriod = affiliate.referredPlayers.filter(
        pl => pl.createdAt >= p.start && pl.createdAt < p.end
      );
      return {
        period: p.label,
        newPlayers: playersInPeriod.length,
        revenue: playersInPeriod.reduce((s, pl) => s.add(pl.revenue), new Decimal(0)).toString(),
        commission: playersInPeriod.reduce((s, pl) => s.add(pl.commission), new Decimal(0)).toString(),
      };
    });
  }

  // ─── Track Player (called when a user registers via affiliate link) ───
  async trackPlayer(affiliateId: string, userId: string) {
    const existing = await prisma.affiliatePlayer.findFirst({
      where: { affiliateId, userId },
    });
    if (existing) return existing;

    const player = await prisma.affiliatePlayer.create({
      data: { affiliateId, userId },
    });

    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: { totalReferred: { increment: 1 } },
    });

    return player;
  }

  async recordRevenue(userId: string, amount: Decimal) {
    const affiliatePlayer = await prisma.affiliatePlayer.findFirst({ where: { userId } });
    if (!affiliatePlayer) return;

    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliatePlayer.affiliateId } });
    if (!affiliate || affiliate.status !== 'APPROVED') return;

    const commission = amount.mul(affiliate.commissionPercent).div(100);

    await prisma.$transaction([
      prisma.affiliatePlayer.update({
        where: { id: affiliatePlayer.id },
        data: {
          revenue: { increment: amount },
          commission: { increment: commission },
        },
      }),
      prisma.affiliate.update({
        where: { id: affiliate.id },
        data: { totalEarned: { increment: commission } },
      }),
    ]);
  }

  // ─── Admin ────────────────────────────────────────────────
  async adminList(opts: { page?: number; limit?: number; status?: string }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 20, 100);
    const where: any = {};
    if (opts.status) where.status = opts.status;

    const [affiliates, total] = await Promise.all([
      prisma.affiliate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { referredPlayers: true } } },
      }),
      prisma.affiliate.count({ where }),
    ]);

    return { affiliates, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  async adminApprove(affiliateId: string, adminId: string) {
    return prisma.affiliate.update({
      where: { id: affiliateId },
      data: { status: 'APPROVED', approvedBy: adminId },
    });
  }

  async adminReject(affiliateId: string) {
    return prisma.affiliate.update({
      where: { id: affiliateId },
      data: { status: 'REJECTED' },
    });
  }

  async adminSuspend(affiliateId: string) {
    return prisma.affiliate.update({
      where: { id: affiliateId },
      data: { status: 'SUSPENDED' },
    });
  }

  async adminSetCommission(affiliateId: string, commissionPercent: number) {
    if (commissionPercent < 0 || commissionPercent > 100) {
      throw new AppError('INVALID_COMMISSION', 'Commission must be between 0 and 100', 400);
    }
    return prisma.affiliate.update({
      where: { id: affiliateId },
      data: { commissionPercent },
    });
  }
}

export const affiliateService = new AffiliateService();
