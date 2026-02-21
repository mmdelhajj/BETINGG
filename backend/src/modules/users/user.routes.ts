import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, adminGuard } from '../../middleware/auth.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import {
  updateProfileSchema,
  updatePreferencesSchema,
  changePasswordSchema,
  activityLogQuerySchema,
  responsibleGamblingSchema,
  coolingOffSchema,
  selfExclusionSchema,
  adminListUsersQuerySchema,
  userIdParamsSchema,
  banUserSchema,
  adjustBalanceSchema,
  setVipTierSchema,
  addNoteSchema,
  type UpdateProfileInput,
  type UpdatePreferencesInput,
  type ChangePasswordInput,
  type ActivityLogQuery,
  type ResponsibleGamblingInput,
  type CoolingOffInput,
  type SelfExclusionInput,
  type AdminListUsersQuery,
  type UserIdParams,
  type BanUserInput,
  type AdjustBalanceInput,
  type SetVipTierInput,
  type AddNoteInput,
} from './user.schemas.js';
import * as userService from './user.service.js';

// ---------------------------------------------------------------------------
// User routes — /api/v1/users
// ---------------------------------------------------------------------------

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // All user routes require authentication
  fastify.addHook('preHandler', authenticate);

  // ─── GET /api/v1/users/profile ─────────────────────────────────────────────
  fastify.get(
    '/profile',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const profile = await userService.getProfile(userId);

      if (!profile) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { profile },
      });
    },
  );

  // ─── PUT /api/v1/users/profile ─────────────────────────────────────────────
  fastify.put(
    '/profile',
    {
      preHandler: [validate(updateProfileSchema)],
    },
    async (
      request: FastifyRequest<{ Body: UpdateProfileInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const result = await userService.updateProfile(userId, request.body);

      if ('error' in result) {
        return reply.status(409).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── PUT /api/v1/users/preferences ────────────────────────────────────────
  fastify.put(
    '/preferences',
    {
      preHandler: [validate(updatePreferencesSchema)],
    },
    async (
      request: FastifyRequest<{ Body: UpdatePreferencesInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const result = await userService.updatePreferences(userId, request.body);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── PUT /api/v1/users/password ───────────────────────────────────────────
  fastify.put(
    '/password',
    {
      preHandler: [validate(changePasswordSchema)],
    },
    async (
      request: FastifyRequest<{ Body: ChangePasswordInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { oldPassword, newPassword } = request.body;
      const result = await userService.changePassword(userId, oldPassword, newPassword);

      if ('error' in result) {
        const statusCode = result.error === 'NOT_FOUND' ? 404 : 400;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { message: result.message },
      });
    },
  );

  // ─── GET /api/v1/users/activity ───────────────────────────────────────────
  fastify.get(
    '/activity',
    {
      preHandler: [validateQuery(activityLogQuerySchema)],
    },
    async (
      request: FastifyRequest<{ Querystring: ActivityLogQuery }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { page, limit } = request.query;
      const result = await userService.getActivityLog(userId, page, limit);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── PUT /api/v1/users/responsible-gambling ───────────────────────────────
  fastify.put(
    '/responsible-gambling',
    {
      preHandler: [validate(responsibleGamblingSchema)],
    },
    async (
      request: FastifyRequest<{ Body: ResponsibleGamblingInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const result = await userService.setResponsibleGambling(userId, request.body);

      if ('error' in result) {
        return reply.status(404).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── POST /api/v1/users/cooling-off ──────────────────────────────────────
  fastify.post(
    '/cooling-off',
    {
      preHandler: [validate(coolingOffSchema)],
    },
    async (
      request: FastifyRequest<{ Body: CoolingOffInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { duration } = request.body;
      const result = await userService.activateCoolingOff(userId, duration);

      if ('error' in result) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          ALREADY_COOLING_OFF: 409,
          SELF_EXCLUDED: 409,
        };
        const statusCode = statusMap[result.error] ?? 400;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── POST /api/v1/users/self-exclusion ────────────────────────────────────
  fastify.post(
    '/self-exclusion',
    {
      preHandler: [validate(selfExclusionSchema)],
    },
    async (
      request: FastifyRequest<{ Body: SelfExclusionInput }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { duration } = request.body;
      const result = await userService.activateSelfExclusion(userId, duration);

      if ('error' in result) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          ALREADY_EXCLUDED: 409,
        };
        const statusCode = statusMap[result.error] ?? 400;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── GET /api/v1/users/stats ──────────────────────────────────────────────
  fastify.get(
    '/stats',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const stats = await userService.getUserStats(userId);

      return reply.status(200).send({
        success: true,
        data: { stats },
      });
    },
  );
}

// ---------------------------------------------------------------------------
// Admin user routes — /api/v1/admin/users
// ---------------------------------------------------------------------------

export async function adminUserRoutes(fastify: FastifyInstance): Promise<void> {
  // All admin routes require authentication + admin guard
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', adminGuard);

  // ─── GET /api/v1/admin/users ──────────────────────────────────────────────
  fastify.get(
    '/',
    {
      preHandler: [validateQuery(adminListUsersQuerySchema)],
    },
    async (
      request: FastifyRequest<{ Querystring: AdminListUsersQuery }>,
      reply: FastifyReply,
    ) => {
      const result = await userService.adminListUsers(request.query);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── GET /api/v1/admin/users/:id ─────────────────────────────────────────
  fastify.get(
    '/:id',
    {
      preHandler: [validateParams(userIdParamsSchema)],
    },
    async (
      request: FastifyRequest<{ Params: UserIdParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const user = await userService.adminGetUser(id);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { user },
      });
    },
  );

  // ─── POST /api/v1/admin/users/:id/ban ────────────────────────────────────
  fastify.post(
    '/:id/ban',
    {
      preHandler: [validateParams(userIdParamsSchema), validate(banUserSchema)],
    },
    async (
      request: FastifyRequest<{ Params: UserIdParams; Body: BanUserInput }>,
      reply: FastifyReply,
    ) => {
      const adminId = request.user!.id;
      const { id } = request.params;
      const { reason } = request.body;

      const result = await userService.adminBanUser(id, adminId, reason);

      if ('error' in result) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          ALREADY_BANNED: 409,
          CANNOT_BAN_ADMIN: 403,
        };
        const statusCode = statusMap[result.error] ?? 400;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { message: result.message },
      });
    },
  );

  // ─── POST /api/v1/admin/users/:id/unban ──────────────────────────────────
  fastify.post(
    '/:id/unban',
    {
      preHandler: [validateParams(userIdParamsSchema)],
    },
    async (
      request: FastifyRequest<{ Params: UserIdParams }>,
      reply: FastifyReply,
    ) => {
      const adminId = request.user!.id;
      const { id } = request.params;

      const result = await userService.adminUnbanUser(id, adminId);

      if ('error' in result) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          NOT_BANNED: 409,
        };
        const statusCode = statusMap[result.error] ?? 400;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { message: result.message },
      });
    },
  );

  // ─── POST /api/v1/admin/users/:id/adjust-balance ─────────────────────────
  fastify.post(
    '/:id/adjust-balance',
    {
      preHandler: [validateParams(userIdParamsSchema), validate(adjustBalanceSchema)],
    },
    async (
      request: FastifyRequest<{ Params: UserIdParams; Body: AdjustBalanceInput }>,
      reply: FastifyReply,
    ) => {
      const adminId = request.user!.id;
      const { id } = request.params;
      const { type, currency, amount, reason } = request.body;

      const result = await userService.adminAdjustBalance(id, adminId, currency, amount, type, reason);

      if ('error' in result) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          INVALID_CURRENCY: 400,
          INSUFFICIENT_BALANCE: 400,
        };
        const statusCode = statusMap[result.error] ?? 400;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── PUT /api/v1/admin/users/:id/vip ─────────────────────────────────────
  fastify.put(
    '/:id/vip',
    {
      preHandler: [validateParams(userIdParamsSchema), validate(setVipTierSchema)],
    },
    async (
      request: FastifyRequest<{ Params: UserIdParams; Body: SetVipTierInput }>,
      reply: FastifyReply,
    ) => {
      const adminId = request.user!.id;
      const { id } = request.params;
      const { tier } = request.body;

      const result = await userService.adminSetVipTier(id, adminId, tier);

      if ('error' in result) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          SAME_TIER: 409,
        };
        const statusCode = statusMap[result.error] ?? 400;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── POST /api/v1/admin/users/:id/notes ──────────────────────────────────
  fastify.post(
    '/:id/notes',
    {
      preHandler: [validateParams(userIdParamsSchema), validate(addNoteSchema)],
    },
    async (
      request: FastifyRequest<{ Params: UserIdParams; Body: AddNoteInput }>,
      reply: FastifyReply,
    ) => {
      const adminId = request.user!.id;
      const { id } = request.params;
      const { note } = request.body;

      const result = await userService.adminAddNote(id, adminId, note);

      if ('error' in result) {
        return reply.status(404).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── GET /api/v1/admin/users/:id/notes ───────────────────────────────────
  fastify.get(
    '/:id/notes',
    {
      preHandler: [validateParams(userIdParamsSchema)],
    },
    async (
      request: FastifyRequest<{ Params: UserIdParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const result = await userService.adminGetNotes(id);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );
}

export default userRoutes;
