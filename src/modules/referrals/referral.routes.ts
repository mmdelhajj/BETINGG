import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { referralService } from './referral.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export default async function referralRoutes(app: FastifyInstance): Promise<void> {
  app.get('/stats', { preHandler: [authMiddleware] }, async (request, reply) => {
    const stats = await referralService.getReferralStats(request.user!.userId);
    sendSuccess(reply, stats);
  });

  app.get('/leaderboard', async (request, reply) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query);
    const leaderboard = await referralService.getLeaderboard(limit);
    sendSuccess(reply, leaderboard);
  });
}
