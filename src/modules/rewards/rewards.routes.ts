import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { rakebackService } from './rakeback.service';
import { calendarService } from './calendar.service';
import { turboService } from './turbo.service';
import { welcomePackageService } from './welcomePackage.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export default async function rewardsRoutes(app: FastifyInstance): Promise<void> {
  // ─── RAKEBACK ───────────────────────────────────────────────────
  app.get('/rakeback', { preHandler: [authMiddleware] }, async (request, reply) => {
    const stats = await rakebackService.getRakebackStats(request.user!.userId);
    sendSuccess(reply, stats);
  });

  app.get('/rakeback/accumulated', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await rakebackService.getAccumulatedRakeback(request.user!.userId);
    sendSuccess(reply, result);
  });

  app.post('/rakeback/claim', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await rakebackService.claimRakeback(request.user!.userId);
    sendSuccess(reply, result);
  });

  // ─── CALENDAR ───────────────────────────────────────────────────
  app.get('/calendar', { preHandler: [authMiddleware] }, async (request, reply) => {
    const calendar = await calendarService.getCalendar(request.user!.userId);
    sendSuccess(reply, calendar);
  });

  app.post('/calendar/claim', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { slot } = z.object({ slot: z.number().int().min(1).max(3) }).parse(request.body);
    const result = await calendarService.claimSlot(request.user!.userId, slot);
    sendSuccess(reply, result);
  });

  app.get('/calendar/weekly', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await calendarService.getWeeklyReward(request.user!.userId);
    sendSuccess(reply, result);
  });

  // ─── TURBO ──────────────────────────────────────────────────────
  app.get('/turbo', { preHandler: [authMiddleware] }, async (request, reply) => {
    const status = await turboService.getActiveTurbo(request.user!.userId);
    sendSuccess(reply, status);
  });

  // ─── WELCOME PACKAGE ───────────────────────────────────────────
  app.get('/welcome', { preHandler: [authMiddleware] }, async (request, reply) => {
    const status = await welcomePackageService.getStatus(request.user!.userId);
    sendSuccess(reply, status);
  });

  app.post('/welcome/activate', { preHandler: [authMiddleware] }, async (request, reply) => {
    const pkg = await welcomePackageService.activate(request.user!.userId);
    sendSuccess(reply, pkg, undefined, 201);
  });

  app.post('/welcome/cash-vault', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await welcomePackageService.claimCashVault(request.user!.userId);
    sendSuccess(reply, result);
  });

  // ─── REWARD HISTORY ─────────────────────────────────────────────
  app.get('/history', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      type: z.string().optional(),
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);

    const { default: prisma } = await import('../../lib/prisma');
    const where: any = { userId: request.user!.userId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [rewards, total] = await Promise.all([
      prisma.reward.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.reward.count({ where }),
    ]);

    sendSuccess(reply, rewards, { page: query.page, total, hasMore: query.page * query.limit < total });
  });
}
