import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { affiliateService } from './affiliate.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

const registerSchema = z.object({
  email: z.string().email(),
  companyName: z.string().optional(),
  website: z.string().url().optional(),
});

export default async function affiliateRoutes(app: FastifyInstance) {
  // ─── Public Registration ──────────────────────────────
  app.post('/affiliates/register', async (request, reply) => {
    const data = registerSchema.parse(request.body);
    const affiliate = await affiliateService.register(data);
    sendSuccess(reply, affiliate);
  });

  // ─── Affiliate Dashboard (authenticated) ──────────────
  app.get('/affiliates/stats', { preHandler: [authMiddleware] }, async (request, reply) => {
    const affiliateId = (request as any).affiliateId || (request.query as any).affiliateId;
    const stats = await affiliateService.getStats(affiliateId);
    sendSuccess(reply, stats);
  });

  app.get('/affiliates/players', { preHandler: [authMiddleware] }, async (request, reply) => {
    const affiliateId = (request as any).affiliateId || (request.query as any).affiliateId;
    const { page, limit } = request.query as any;
    const result = await affiliateService.getReferredPlayers(affiliateId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    sendSuccess(reply, result.players, result.meta);
  });

  app.post('/affiliates/api-key', { preHandler: [authMiddleware] }, async (request, reply) => {
    const affiliateId = (request as any).affiliateId || (request.body as any).affiliateId;
    const result = await affiliateService.generateApiKey(affiliateId);
    sendSuccess(reply, result);
  });

  app.get('/affiliates/earnings', { preHandler: [authMiddleware] }, async (request, reply) => {
    const affiliateId = (request as any).affiliateId || (request.query as any).affiliateId;
    const { period } = request.query as any;
    const report = await affiliateService.getEarningsReport(affiliateId, {
      period: period || 'monthly',
    });
    sendSuccess(reply, report);
  });

  // ─── Admin ────────────────────────────────────────────
  app.get('/admin/affiliates', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { page, limit, status } = request.query as any;
    const result = await affiliateService.adminList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });
    sendSuccess(reply, result.affiliates, result.meta);
  });

  app.post('/admin/affiliates/:id/approve', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const affiliate = await affiliateService.adminApprove(id, (request as any).userId);
    sendSuccess(reply, affiliate);
  });

  app.post('/admin/affiliates/:id/reject', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const affiliate = await affiliateService.adminReject(id);
    sendSuccess(reply, affiliate);
  });

  app.post('/admin/affiliates/:id/suspend', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const affiliate = await affiliateService.adminSuspend(id);
    sendSuccess(reply, affiliate);
  });

  app.put('/admin/affiliates/:id/commission', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const { commissionPercent } = request.body as any;
    const affiliate = await affiliateService.adminSetCommission(id, Number(commissionPercent));
    sendSuccess(reply, affiliate);
  });
}
