import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { vipService } from './vip.service';
import { authMiddleware, adminGuard } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export default async function vipRoutes(app: FastifyInstance): Promise<void> {
  // Get VIP tiers comparison
  app.get('/tiers', async (_request, reply) => {
    const tiers = await vipService.getVipBenefitsComparison();
    sendSuccess(reply, tiers);
  });

  // Get user VIP status
  app.get('/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const status = await vipService.getUserVipStatus(request.user!.userId);
    sendSuccess(reply, status);
  });

  // Admin: Update tier config
  app.put('/admin/tiers/:tier', { preHandler: [adminGuard] }, async (request, reply) => {
    const { tier } = z.object({
      tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'DIAMOND', 'BLUE_DIAMOND']),
    }).parse(request.params);
    const body = z.object({
      minWagered: z.number().optional(),
      rakebackPercent: z.number().optional(),
      turboBoostPercent: z.number().optional(),
      turboDurationMin: z.number().int().optional(),
      dailyBonusMax: z.number().optional(),
      weeklyBonusMax: z.number().optional(),
      monthlyBonusMax: z.number().optional(),
      levelUpReward: z.number().optional(),
      calendarSplitPercent: z.number().optional(),
      benefits: z.any().optional(),
    }).parse(request.body);
    const config = await vipService.updateTierConfig(tier, body);
    sendSuccess(reply, config);
  });

  // Admin: Set user tier
  app.put('/admin/users/:userId/tier', { preHandler: [adminGuard] }, async (request, reply) => {
    const { userId } = z.object({ userId: z.string() }).parse(request.params);
    const { tier } = z.object({
      tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'DIAMOND', 'BLUE_DIAMOND']),
    }).parse(request.body);
    const user = await vipService.setUserTier(userId, tier);
    sendSuccess(reply, { userId: user.id, vipTier: user.vipTier });
  });
}
