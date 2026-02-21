import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { validateQuery, validateParams } from '../../middleware/validate.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  type ListNotificationsQuery,
  type NotificationIdParams,
} from './notification.schemas.js';
import * as notificationService from './notification.service.js';

export default async function notificationRoutes(fastify: FastifyInstance): Promise<void> {
  // All notification routes require authentication
  fastify.addHook('preHandler', authenticate);

  // ─── GET /api/v1/notifications ─────────────────────────────────────────────
  fastify.get(
    '/',
    {
      preHandler: [validateQuery(listNotificationsQuerySchema)],
    },
    async (
      request: FastifyRequest<{ Querystring: ListNotificationsQuery }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { page, limit, unreadOnly } = request.query;

      const result = await notificationService.getNotifications(userId, page, limit, unreadOnly);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── GET /api/v1/notifications/unread-count ────────────────────────────────
  fastify.get(
    '/unread-count',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const result = await notificationService.getUnreadCount(userId);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── PUT /api/v1/notifications/read-all ────────────────────────────────────
  fastify.put(
    '/read-all',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const result = await notificationService.markAllAsRead(userId);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── PUT /api/v1/notifications/:id/read ────────────────────────────────────
  fastify.put(
    '/:id/read',
    {
      preHandler: [validateParams(notificationIdParamsSchema)],
    },
    async (
      request: FastifyRequest<{ Params: NotificationIdParams }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { id } = request.params;

      const notification = await notificationService.markAsRead(userId, id);

      if (!notification) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Notification not found.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { notification },
      });
    },
  );

  // ─── DELETE /api/v1/notifications/:id ──────────────────────────────────────
  fastify.delete(
    '/:id',
    {
      preHandler: [validateParams(notificationIdParamsSchema)],
    },
    async (
      request: FastifyRequest<{ Params: NotificationIdParams }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { id } = request.params;

      const result = await notificationService.deleteNotification(userId, id);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Notification not found.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { message: 'Notification deleted successfully.' },
      });
    },
  );
}
