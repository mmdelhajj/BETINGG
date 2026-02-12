import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { promotionsService } from './promotions.service';
import { authMiddleware, adminGuard } from '../../middleware/auth';
import { sendSuccess, sendCreated } from '../../utils/response';

export default async function promotionsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request, reply) => {
    const promotions = await promotionsService.getActivePromotions();
    sendSuccess(reply, promotions);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const promotion = await promotionsService.getPromotion(id);
    sendSuccess(reply, promotion);
  });

  app.post('/claim', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { code } = z.object({ code: z.string().min(1).max(50) }).parse(request.body);
    const result = await promotionsService.claimPromoCode(request.user!.userId, code);
    sendCreated(reply, result);
  });

  app.post('/admin', { preHandler: [adminGuard] }, async (request, reply) => {
    const data = z.object({
      code: z.string().min(1).max(50),
      name: z.string().min(1).max(200),
      description: z.string().min(1),
      type: z.string(),
      conditions: z.record(z.any()),
      reward: z.record(z.any()),
      bannerUrl: z.string().url().optional(),
    }).parse(request.body);
    const promotion = await promotionsService.createPromotion(data);
    sendCreated(reply, promotion);
  });

  app.delete('/admin/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const result = await promotionsService.deactivatePromotion(id);
    sendSuccess(reply, result);
  });
}
