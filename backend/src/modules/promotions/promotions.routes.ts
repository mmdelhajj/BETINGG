import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as promotionsService from './promotions.service.js';
import {
  claimPromotionParamsSchema,
  redeemPromoCodeSchema,
  promotionIdParamsSchema,
  listPromotionsQuerySchema,
  type ClaimPromotionParams,
  type RedeemPromoCodeInput,
  type PromotionIdParams,
  type ListPromotionsQuery,
} from './promotions.schemas.js';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function promotionsRoutes(app: FastifyInstance): Promise<void> {
  // =========================================================================
  // Public / Authenticated user routes
  // =========================================================================

  // ── GET /api/v1/promotions ── list active promotions (public, auth optional)
  app.get(
    '/api/v1/promotions',
    {
      schema: {
        tags: ['Promotions'],
        summary: 'List active promotions',
      },
    },
    async (
      request: FastifyRequest<{ Querystring: ListPromotionsQuery }>,
      _reply: FastifyReply,
    ) => {
      const query = listPromotionsQuerySchema.parse(request.query);
      const result = await promotionsService.getActivePromotions(
        query.page,
        query.limit,
        query.type,
      );
      return { success: true, data: result };
    },
  );

  // ── GET /api/v1/promotions/:id ── get promotion details
  app.get(
    '/api/v1/promotions/:id',
    {
      schema: {
        tags: ['Promotions'],
        summary: 'Get promotion details',
      },
    },
    async (
      request: FastifyRequest<{ Params: PromotionIdParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = promotionIdParamsSchema.parse(request.params);
      const userId = request.user?.id;
      const promotion = await promotionsService.getPromotion(id, userId);

      if (!promotion) {
        void reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Promotion not found.' },
        });
        return;
      }

      return { success: true, data: promotion };
    },
  );

  // ── POST /api/v1/promotions/:id/claim ── claim a promotion
  app.post(
    '/api/v1/promotions/:id/claim',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Promotions'],
        summary: 'Claim a promotion',
      },
    },
    async (
      request: FastifyRequest<{ Params: ClaimPromotionParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = claimPromotionParamsSchema.parse(request.params);
      const userId = request.user!.id;

      try {
        const result = await promotionsService.claimPromotion(userId, id);
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to claim promotion';
        void reply.status(400).send({
          success: false,
          error: { code: 'CLAIM_FAILED', message },
        });
      }
    },
  );

  // ── POST /api/v1/promo-codes/redeem ── redeem a promo code
  app.post(
    '/api/v1/promo-codes/redeem',
    {
      preHandler: [authenticate, validate(redeemPromoCodeSchema)],
      schema: {
        tags: ['Promotions'],
        summary: 'Redeem a promo code',
      },
    },
    async (
      request: FastifyRequest<{ Body: RedeemPromoCodeInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { code } = request.body;

      try {
        const result = await promotionsService.redeemPromoCode(userId, code);
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to redeem promo code';
        void reply.status(400).send({
          success: false,
          error: { code: 'REDEEM_FAILED', message },
        });
      }
    },
  );

}
