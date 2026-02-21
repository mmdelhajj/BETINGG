import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { validate, validateQuery, validateParams } from '../../middleware/validate.js';
import {
  idParamSchema,
  messagesQuerySchema,
  createRoomSchema,
  sendMessageSchema,
  type IdParam,
  type MessagesQuery,
  type CreateRoomInput,
  type SendMessageInput,
} from './chat.schemas.js';
import * as chatService from './chat.service.js';

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
  // USER ROUTES (authenticated)
  // =======================================================================

  // GET /api/v1/chat/rooms — user's chat rooms
  fastify.get(
    '/api/v1/chat/rooms',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rooms = await chatService.getUserRooms(request.user!.id);
        return success(reply, { rooms });
      } catch (err) {
        if (err instanceof chatService.ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // POST /api/v1/chat/rooms — create chat room (subject)
  fastify.post(
    '/api/v1/chat/rooms',
    { preHandler: [authenticate, validate(createRoomSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { subject } = request.body as CreateRoomInput;
        const room = await chatService.createRoom(request.user!.id, subject);
        return success(reply, { room }, 201);
      } catch (err) {
        if (err instanceof chatService.ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/chat/rooms/:id/messages — get messages for room
  fastify.get(
    '/api/v1/chat/rooms/:id/messages',
    { preHandler: [authenticate, validateParams(idParamSchema), validateQuery(messagesQuerySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const { page, limit } = request.query as MessagesQuery;
        const result = await chatService.getMessages(
          id,
          request.user!.id,
          page,
          limit,
          false,
        );
        return success(reply, result);
      } catch (err) {
        if (err instanceof chatService.ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // POST /api/v1/chat/rooms/:id/messages — send message
  fastify.post(
    '/api/v1/chat/rooms/:id/messages',
    { preHandler: [authenticate, validateParams(idParamSchema), validate(sendMessageSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const { message: messageText } = request.body as SendMessageInput;
        const msg = await chatService.sendMessage(
          id,
          request.user!.id,
          'USER',
          messageText,
        );
        return success(reply, { message: msg }, 201);
      } catch (err) {
        if (err instanceof chatService.ChatError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

}
