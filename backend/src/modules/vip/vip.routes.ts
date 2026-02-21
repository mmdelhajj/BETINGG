import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import * as vipService from './vip.service.js';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function vipRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/vip/tiers ── public (no auth required)
  app.get(
    '/api/v1/vip/tiers',
    {
      schema: {
        tags: ['VIP'],
        summary: 'Get all VIP tiers with benefits',
      },
    },
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const tiers = await vipService.getAllTiers();
      return { success: true, data: { tiers } };
    },
  );

  // ── GET /api/v1/vip/status ── authenticated
  app.get(
    '/api/v1/vip/status',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['VIP'],
        summary: 'Get current user VIP status',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const status = await vipService.getVipStatus(userId);
      return { success: true, data: status };
    },
  );

  // ── GET /api/v1/vip/history ── authenticated
  app.get(
    '/api/v1/vip/history',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['VIP'],
        summary: 'Get tier change history',
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

      const result = await vipService.getTierHistory(userId, page, limit);
      return { success: true, data: result };
    },
  );
}
