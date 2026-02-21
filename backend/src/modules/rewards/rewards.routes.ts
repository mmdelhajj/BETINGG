import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import * as calendarService from './calendar.service.js';
import * as rakebackService from './rakeback.service.js';
import * as turboService from './turbo.service.js';
import * as levelUpService from './levelUp.service.js';
import * as welcomePackageService from './welcomePackage.service.js';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function rewardsRoutes(app: FastifyInstance): Promise<void> {
  // All rewards routes require authentication
  app.addHook('preHandler', authenticate);

  // =========================================================================
  // Calendar
  // =========================================================================

  // ── GET /api/v1/rewards/calendar ──
  app.get(
    '/api/v1/rewards/calendar',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Get rewards calendar (today\'s slots, claimed/available/locked)',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const calendar = await calendarService.getCalendar(userId);
      return { success: true, data: calendar };
    },
  );

  // ── POST /api/v1/rewards/calendar/claim ──
  app.post(
    '/api/v1/rewards/calendar/claim',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Claim a calendar reward slot',
        body: {
          type: 'object',
          required: ['slot'],
          properties: {
            slot: { type: 'number', enum: [1, 2, 3] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { slot: 1 | 2 | 3 } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { slot } = request.body;

      try {
        const result = await calendarService.claimSlot(userId, slot);
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to claim slot';
        void reply.status(400).send({
          success: false,
          error: { code: 'CLAIM_FAILED', message },
        });
      }
    },
  );

  // =========================================================================
  // Rakeback
  // =========================================================================

  // ── GET /api/v1/rewards/rakeback/stats ──
  app.get(
    '/api/v1/rewards/rakeback/stats',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Rakeback statistics (daily, weekly, monthly, lifetime)',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const stats = await rakebackService.getRakebackStats(userId);
      return { success: true, data: stats };
    },
  );

  // ── POST /api/v1/rewards/rakeback/claim ──
  app.post(
    '/api/v1/rewards/rakeback/claim',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Claim accumulated rakeback',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      try {
        const result = await rakebackService.claimRakeback(userId);

        if (result.claimedCount === 0) {
          void reply.status(400).send({
            success: false,
            error: { code: 'NO_PENDING_RAKEBACK', message: 'No pending rakeback to claim.' },
          });
          return;
        }

        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to claim rakeback';
        void reply.status(400).send({
          success: false,
          error: { code: 'CLAIM_FAILED', message },
        });
      }
    },
  );

  // =========================================================================
  // TURBO Mode
  // =========================================================================

  // ── GET /api/v1/rewards/turbo/status ──
  app.get(
    '/api/v1/rewards/turbo/status',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'TURBO mode status (active?, boostPercent, timeRemaining)',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const status = await turboService.getStatus(userId);
      return { success: true, data: status };
    },
  );

  // ── POST /api/v1/rewards/turbo/activate ──
  app.post(
    '/api/v1/rewards/turbo/activate',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Activate TURBO mode',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      try {
        const status = await turboService.activate(userId);
        return { success: true, data: status };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to activate TURBO mode';
        void reply.status(400).send({
          success: false,
          error: { code: 'TURBO_ACTIVATION_FAILED', message },
        });
      }
    },
  );

  // =========================================================================
  // Level-Up Milestones
  // =========================================================================

  // ── GET /api/v1/rewards/level-up ──
  app.get(
    '/api/v1/rewards/level-up',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Level-up milestones and progress',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const milestones = await levelUpService.getMilestones(userId);
      return { success: true, data: milestones };
    },
  );

  // ── POST /api/v1/rewards/level-up/claim ──
  app.post(
    '/api/v1/rewards/level-up/claim',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Claim a level-up reward',
        body: {
          type: 'object',
          required: ['milestoneAmount'],
          properties: {
            milestoneAmount: { type: 'number' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { milestoneAmount: number } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.id;
      const { milestoneAmount } = request.body;

      try {
        const result = await levelUpService.claimMilestone(userId, milestoneAmount);
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to claim milestone reward';
        void reply.status(400).send({
          success: false,
          error: { code: 'CLAIM_FAILED', message },
        });
      }
    },
  );

  // =========================================================================
  // Welcome Package
  // =========================================================================

  // ── GET /api/v1/rewards/welcome-package ──
  app.get(
    '/api/v1/rewards/welcome-package',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Welcome package status and progress',
      },
    },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const userId = request.user!.id;
      const status = await welcomePackageService.getStatus(userId);
      return { success: true, data: status };
    },
  );

  // ── POST /api/v1/rewards/welcome-package/activate ──
  app.post(
    '/api/v1/rewards/welcome-package/activate',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Activate welcome package (on first deposit)',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      try {
        const status = await welcomePackageService.activate(userId);
        return { success: true, data: status };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to activate welcome package';
        void reply.status(400).send({
          success: false,
          error: { code: 'ACTIVATION_FAILED', message },
        });
      }
    },
  );

  // ── POST /api/v1/rewards/welcome-package/daily-drop ──
  app.post(
    '/api/v1/rewards/welcome-package/daily-drop',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Claim daily drop from welcome package',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      try {
        const result = await welcomePackageService.processDailyDrop(userId);
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process daily drop';
        void reply.status(400).send({
          success: false,
          error: { code: 'DAILY_DROP_FAILED', message },
        });
      }
    },
  );

  // ── POST /api/v1/rewards/welcome-package/cash-vault ──
  app.post(
    '/api/v1/rewards/welcome-package/cash-vault',
    {
      schema: {
        tags: ['Rewards'],
        summary: 'Claim cash vault (available on day 30)',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      try {
        const result = await welcomePackageService.claimCashVault(userId);
        return { success: true, data: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to claim cash vault';
        void reply.status(400).send({
          success: false,
          error: { code: 'CASH_VAULT_FAILED', message },
        });
      }
    },
  );
}
