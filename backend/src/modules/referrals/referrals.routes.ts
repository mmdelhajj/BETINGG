import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import * as referralsService from './referrals.service.js';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function referralsRoutes(app: FastifyInstance): Promise<void> {
  // All referral routes require authentication
  app.addHook('preHandler', authenticate);

  // ── GET /api/v1/referrals/code ── get user's referral code and link
  app.get(
    '/api/v1/referrals/code',
    {
      schema: {
        tags: ['Referrals'],
        summary: 'Get user\'s referral code and shareable link',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const result = await referralsService.getReferralCode(userId);
      return { success: true, data: result };
    },
  );

  // ── GET /api/v1/referrals/stats ── referral statistics
  app.get(
    '/api/v1/referrals/stats',
    {
      schema: {
        tags: ['Referrals'],
        summary: 'Referral statistics (total, qualified, earned)',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const stats = await referralsService.getStats(userId);
      return { success: true, data: stats };
    },
  );

  // ── GET /api/v1/referrals/list ── list of referred users
  app.get(
    '/api/v1/referrals/list',
    {
      schema: {
        tags: ['Referrals'],
        summary: 'List of referred users with status',
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { page?: string; limit?: string };
      }>,
      _reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const page = Math.max(1, parseInt(request.query.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10) || 20));

      const result = await referralsService.getReferredUsers(userId, page, limit);
      return { success: true, data: result };
    },
  );
}
