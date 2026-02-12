import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notificationService } from './notification.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export default async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      unreadOnly: z.coerce.boolean().default(false),
    }).parse(request.query);
    const result = await notificationService.getNotifications(request.user!.userId, query);
    sendSuccess(reply, result.notifications, result.meta);
  });

  app.get('/unread-count', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await notificationService.getUnreadCount(request.user!.userId);
    sendSuccess(reply, result);
  });

  app.post('/:id/read', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const result = await notificationService.markAsRead(request.user!.userId, id);
    sendSuccess(reply, result);
  });

  app.post('/read-all', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await notificationService.markAllAsRead(request.user!.userId);
    sendSuccess(reply, result);
  });

  app.delete('/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const result = await notificationService.deleteNotification(request.user!.userId, id);
    sendSuccess(reply, result);
  });

  app.get('/preferences', { preHandler: [authMiddleware] }, async (request, reply) => {
    const prefs = await notificationService.getPreferences(request.user!.userId);
    sendSuccess(reply, prefs);
  });

  app.put('/preferences', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      inApp: z.boolean().optional(),
      betSettlement: z.boolean().optional(),
      promotions: z.boolean().optional(),
      deposits: z.boolean().optional(),
      withdrawals: z.boolean().optional(),
    }).parse(request.body);
    const result = await notificationService.updatePreferences(request.user!.userId, body as Record<string, boolean>);
    sendSuccess(reply, result);
  });
}
