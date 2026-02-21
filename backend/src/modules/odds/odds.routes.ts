import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, adminGuard } from '../../middleware/auth.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import {
  eventIdParamsSchema,
  providerIdParamsSchema,
  createOddsProviderSchema,
  updateOddsProviderSchema,
  oddsSyncSchema,
  syncLogsQuerySchema,
  type EventIdParams,
  type ProviderIdParams,
  type CreateOddsProviderInput,
  type UpdateOddsProviderInput,
  type OddsSyncInput,
  type SyncLogsQuery,
} from './odds.schemas.js';
import * as oddsService from './odds.service.js';

export default async function oddsRoutes(fastify: FastifyInstance): Promise<void> {
  // =========================================================================
  // PUBLIC ROUTES
  // =========================================================================

  // ─── GET /api/v1/odds/:eventId ──────────────────────────────────────────
  fastify.get(
    '/:eventId',
    { preHandler: [validateParams(eventIdParamsSchema)] },
    async (request: FastifyRequest<{ Params: EventIdParams }>, reply: FastifyReply) => {
      const odds = await oddsService.getEventOdds(request.params.eventId);
      if (!odds) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Event not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: odds });
    },
  );

}
