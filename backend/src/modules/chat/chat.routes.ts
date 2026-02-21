import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import {
  idParamSchema,
  roomsQuerySchema,
  messagesQuerySchema,
  sendMessageSchema,
  tipUserSchema,
  type IdParam,
  type RoomsQuery,
  type MessagesQuery,
  type SendMessageInput,
  type TipUserInput,
} from './chat.schemas.js';
import * as chatService from './chat.service.js';
import { ChatError } from './chat.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function success(reply: FastifyReply, data: unknown, statusCode = 200) {
  return reply.status(statusCode).send({ success: true, data });
}

function error(reply: FastifyReply, code: string, message: string, statusCode = 400) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message },
  });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  // =======================================================================
  // PUBLIC ROUTES
  // =======================================================================

  /**
   * GET /api/v1/chat/rooms - List all active chat rooms
   *
   * Query params:
   *   - type: optional filter by room type (GENERAL, SPORT, CASINO, VIP)
   */
  fastify.get(
    '/api/v1/chat/rooms',
    { preHandler: [validateQuery(roomsQuerySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { type } = request.query as RoomsQuery;
        const rooms = await chatService.getRooms(type);
        return success(reply, { rooms });
      } catch (err) {
        if (err instanceof ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  /**
   * GET /api/v1/chat/rooms/:id/messages - Get messages with pagination
   *
   * Query params:
   *   - page: page number (default 1)
   *   - limit: messages per page (default 50, max 100)
   *   - before: ISO date string for cursor-based pagination
   */
  fastify.get(
    '/api/v1/chat/rooms/:id/messages',
    { preHandler: [validateParams(idParamSchema), validateQuery(messagesQuerySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const query = request.query as MessagesQuery;
        const result = await chatService.getMessages(id, query);
        return success(reply, result);
      } catch (err) {
        if (err instanceof ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // AUTHENTICATED ROUTES
  // =======================================================================

  /**
   * POST /api/v1/chat/rooms/:id/messages - Send a message to a chat room
   *
   * Body:
   *   - content: string (1-2000 chars)
   *   - replyToId: optional message ID to reply to
   */
  fastify.post(
    '/api/v1/chat/rooms/:id/messages',
    {
      preHandler: [
        authenticate,
        validateParams(idParamSchema),
        validate(sendMessageSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const body = request.body as SendMessageInput;
        const message = await chatService.sendMessage(request.user!.id, id, body);
        return success(reply, { message }, 201);
      } catch (err) {
        if (err instanceof ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  /**
   * POST /api/v1/chat/rooms/:id/tip - Tip another user in a chat room
   *
   * Body:
   *   - recipientId: string
   *   - amount: number (min 0.01)
   *   - currency: string
   *   - message: optional string (max 200 chars)
   */
  fastify.post(
    '/api/v1/chat/rooms/:id/tip',
    {
      preHandler: [
        authenticate,
        validateParams(idParamSchema),
        validate(tipUserSchema),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const body = request.body as TipUserInput;
        const result = await chatService.tipUser(request.user!.id, id, body);
        return success(reply, result);
      } catch (err) {
        if (err instanceof ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );
}
