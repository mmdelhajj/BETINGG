import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import {
  placeBetSchema,
  betHistoryQuerySchema,
  betIdParamsSchema,
  cashoutSchema,
  type PlaceBetInput,
  type BetHistoryQuery,
  type BetIdParams,
  type CashoutInput,
} from './betting.schemas.js';
import * as bettingService from './betting.service.js';
import { BetError } from './betting.service.js';
import * as cashoutService from './cashout.service.js';
import { CashoutError } from './cashout.service.js';

export default async function bettingRoutes(fastify: FastifyInstance): Promise<void> {
  // All betting routes require authentication
  fastify.addHook('preHandler', authenticate);

  // ─── POST /api/v1/bets/place ────────────────────────────────────────────
  fastify.post(
    '/place',
    { preHandler: [validate(placeBetSchema)] },
    async (request: FastifyRequest<{ Body: PlaceBetInput }>, reply: FastifyReply) => {
      try {
        request.log.info({ body: request.body, userId: request.user?.id }, 'BET PLACE REQUEST');
        const result = await bettingService.placeBet(
          request.user!.id,
          request.body,
          request.ip,
        );

        // Include updated wallet balance so the frontend can update its display
        const currency = request.body.currency?.toUpperCase() || 'BTC';
        const wallet = await prisma.wallet.findFirst({
          where: {
            userId: request.user!.id,
            currency: { symbol: currency },
          },
          select: { balance: true },
        });
        const newBalance = wallet ? wallet.balance.toNumber() : 0;

        return reply.status(201).send({
          success: true,
          data: { ...result, newBalance },
        });
      } catch (err) {
        if (err instanceof BetError) {
          request.log.warn({ code: err.code, message: err.message, body: request.body }, 'BET PLACE FAILED');
          return reply.status(400).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // ─── GET /api/v1/bets ──────────────────────────────────────────────────
  fastify.get(
    '/',
    { preHandler: [validateQuery(betHistoryQuerySchema)] },
    async (request: FastifyRequest<{ Querystring: BetHistoryQuery }>, reply: FastifyReply) => {
      const result = await bettingService.getUserBets(request.user!.id, request.query);
      return reply.status(200).send({ success: true, data: result });
    },
  );

  // ─── GET /api/v1/bets/open ──────────────────────────────────────────────
  fastify.get(
    '/open',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bets = await bettingService.getOpenBets(request.user!.id);
      return reply.status(200).send({ success: true, data: { bets } });
    },
  );

  // ─── GET /api/v1/bets/:id ──────────────────────────────────────────────
  fastify.get(
    '/:id',
    { preHandler: [validateParams(betIdParamsSchema)] },
    async (request: FastifyRequest<{ Params: BetIdParams }>, reply: FastifyReply) => {
      const bet = await bettingService.getBet(request.user!.id, request.params.id);
      if (!bet) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Bet not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: { bet } });
    },
  );

  // ─── GET /api/v1/bets/:id/cashout-value ─────────────────────────────────
  fastify.get(
    '/:id/cashout-value',
    { preHandler: [validateParams(betIdParamsSchema)] },
    async (request: FastifyRequest<{ Params: BetIdParams }>, reply: FastifyReply) => {
      try {
        // Verify ownership first
        const bet = await bettingService.getBet(request.user!.id, request.params.id);
        if (!bet) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Bet not found.' },
          });
        }

        const result = await cashoutService.getCashoutValue(request.params.id);
        return reply.status(200).send({ success: true, data: result });
      } catch (err) {
        if (err instanceof CashoutError) {
          return reply.status(400).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // ─── POST /api/v1/bets/:id/cashout ─────────────────────────────────────
  fastify.post(
    '/:id/cashout',
    { preHandler: [validateParams(betIdParamsSchema), validate(cashoutSchema)] },
    async (
      request: FastifyRequest<{ Params: BetIdParams; Body: CashoutInput }>,
      reply: FastifyReply,
    ) => {
      try {
        const result = await cashoutService.cashout(
          request.user!.id,
          request.params.id,
          request.body.amount,
        );
        return reply.status(200).send({ success: true, data: result });
      } catch (err) {
        if (err instanceof CashoutError) {
          return reply.status(400).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // ─── POST /api/v1/bets/:id/share ───────────────────────────────────────
  fastify.post(
    '/:id/share',
    { preHandler: [validateParams(betIdParamsSchema)] },
    async (request: FastifyRequest<{ Params: BetIdParams }>, reply: FastifyReply) => {
      const result = await bettingService.shareBet(request.user!.id, request.params.id);
      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Bet not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: result });
    },
  );
}
