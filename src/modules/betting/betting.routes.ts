import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bettingService } from './betting.service';
import { cashoutService } from './cashout.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

const placeBetSchema = z.object({
  selections: z.array(z.object({
    selectionId: z.string(),
    oddsAtPlacement: z.number().positive().optional(),
  })).min(1),
  type: z.enum(['SINGLE', 'PARLAY', 'SYSTEM']),
  stake: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0, 'Stake must be positive'),
  currencySymbol: z.string().min(1),
  acceptOddsChange: z.enum(['ANY', 'BETTER_ONLY', 'NONE']).default('ANY'),
  systemComboSize: z.number().int().min(2).optional(),
  systemType: z.string().optional(), // e.g. 'trixie', 'patent', 'yankee', etc.
  isLive: z.boolean().default(false),
});

export default async function bettingRoutes(app: FastifyInstance): Promise<void> {
  // Place bet (supports single, parlay, system bet types)
  app.post('/place', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = placeBetSchema.parse(request.body);
    const bet = await bettingService.placeBet(request.user!.userId, {
      ...body,
      ipAddress: request.ip,
      placedVia: 'WEB',
    });
    sendSuccess(reply, bet, undefined, 201);
  });

  // Get bet by ID
  app.get('/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const bet = await bettingService.getBet(request.user!.userId, id);
    sendSuccess(reply, bet);
  });

  // Get bet by reference ID
  app.get('/reference/:referenceId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { referenceId } = z.object({ referenceId: z.string() }).parse(request.params);
    const bet = await bettingService.getBetByReference(referenceId);
    sendSuccess(reply, bet);
  });

  // Get open bets
  app.get('/open', { preHandler: [authMiddleware] }, async (request, reply) => {
    const bets = await bettingService.getOpenBets(request.user!.userId);
    sendSuccess(reply, bets);
  });

  // Get bet history
  app.get('/history', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      status: z.string().optional(),
      type: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);

    const result = await bettingService.getBetHistory(request.user!.userId, {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
    sendSuccess(reply, result.bets, result.meta);
  });

  // Cancel bet (within grace period)
  app.post('/:id/cancel', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const result = await bettingService.cancelBet(request.user!.userId, id);
    sendSuccess(reply, result);
  });

  // Get cash-out value
  app.get('/:id/cashout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const result = await cashoutService.getCashoutValue(id, request.user!.userId);
    sendSuccess(reply, result);
  });

  // Execute cash-out
  app.post('/:id/cashout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { percentage } = z.object({
      percentage: z.number().min(1).max(100).default(100),
    }).parse(request.body || {});
    const result = await cashoutService.executeCashout(id, request.user!.userId, percentage);
    sendSuccess(reply, result);
  });

  // Set auto cash-out
  app.post('/:id/auto-cashout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { targetMultiplier } = z.object({
      targetMultiplier: z.number().min(1.01),
    }).parse(request.body);
    await cashoutService.setAutoCashout(id, request.user!.userId, targetMultiplier);
    sendSuccess(reply, { message: 'Auto cash-out set' });
  });
}
