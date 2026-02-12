import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { userService } from './user.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';
import { paginationSchema } from '../../utils/validation';

export default async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/profile', { preHandler: [authMiddleware] }, async (request, reply) => {
    const profile = await userService.getProfile(request.user!.userId);
    sendSuccess(reply, profile);
  });

  app.put('/profile', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      username: z.string().min(3).max(30).optional(),
      avatar: z.string().url().optional(),
      dateOfBirth: z.string().optional(),
    }).parse(request.body);
    const result = await userService.updateProfile(request.user!.userId, body);
    sendSuccess(reply, result);
  });

  app.put('/preferences', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      preferredCurrency: z.string().optional(),
      preferredOddsFormat: z.enum(['DECIMAL', 'FRACTIONAL', 'AMERICAN']).optional(),
      theme: z.enum(['DARK', 'LIGHT', 'CLASSIC']).optional(),
      language: z.string().optional(),
    }).parse(request.body);
    const result = await userService.updatePreferences(request.user!.userId, body);
    sendSuccess(reply, result);
  });

  // ─── RESPONSIBLE GAMBLING ──────────────────────────────────────
  app.put('/limits/deposit', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      daily: z.string().optional(),
      weekly: z.string().optional(),
      monthly: z.string().optional(),
    }).parse(request.body);
    const result = await userService.setDepositLimit(request.user!.userId, body);
    sendSuccess(reply, result);
  });

  app.put('/limits/loss', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      daily: z.string().optional(),
      weekly: z.string().optional(),
      monthly: z.string().optional(),
    }).parse(request.body);
    const result = await userService.setLossLimit(request.user!.userId, body);
    sendSuccess(reply, result);
  });

  app.put('/limits/wager', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      daily: z.string().optional(),
      weekly: z.string().optional(),
      monthly: z.string().optional(),
    }).parse(request.body);
    const result = await userService.setWagerLimit(request.user!.userId, body);
    sendSuccess(reply, result);
  });

  app.put('/limits/session', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { minutes } = z.object({ minutes: z.number().int().min(1).max(1440) }).parse(request.body);
    const result = await userService.setSessionTimeLimit(request.user!.userId, minutes);
    sendSuccess(reply, result);
  });

  app.post('/cooling-off', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { period } = z.object({ period: z.enum(['24h', '1w', '1m']) }).parse(request.body);
    const result = await userService.requestCoolingOff(request.user!.userId, period);
    sendSuccess(reply, result);
  });

  app.post('/self-exclusion', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { period } = z.object({ period: z.enum(['6m', '1y', 'permanent']) }).parse(request.body);
    const result = await userService.requestSelfExclusion(request.user!.userId, period);
    sendSuccess(reply, result);
  });

  // ─── HISTORY ──────────────────────────────────────────────────
  app.get('/history/bets', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);
    const result = await userService.getBettingHistory(request.user!.userId, query);
    sendSuccess(reply, result.bets, result.meta);
  });

  app.get('/history/casino', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const result = await userService.getCasinoHistory(request.user!.userId, query);
    sendSuccess(reply, result.sessions, result.meta);
  });
}
