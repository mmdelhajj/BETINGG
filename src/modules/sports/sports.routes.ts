import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sportsService } from './sports.service';
import { authMiddleware, adminGuard, optionalAuthMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../lib/prisma';

export default async function sportsRoutes(app: FastifyInstance): Promise<void> {
  // ─── PUBLIC ROUTES ──────────────────────────────────────────────

  // List all sports
  app.get('/', async (request, reply) => {
    const sports = await sportsService.getSports();
    sendSuccess(reply, sports);
  });

  // Get sport by slug with competitions
  app.get('/:slug', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const sport = await sportsService.getSportBySlug(slug);
    sendSuccess(reply, sport);
  });

  // Get competitions for a sport
  app.get('/:slug/competitions', async (request, reply) => {
    const { slug } = z.object({ slug: z.string() }).parse(request.params);
    const competitions = await sportsService.getCompetitions(slug);
    sendSuccess(reply, competitions);
  });

  // Get events for a competition
  app.get('/competitions/:id/events', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { status } = z.object({ status: z.enum(['UPCOMING', 'LIVE', 'ENDED']).optional() }).parse(request.query);
    const events = await sportsService.getCompetitionEvents(id, status as any);
    sendSuccess(reply, events);
  });

  // Get events by sport slug or competition
  app.get('/events', async (request, reply) => {
    const { sportSlug, competitionId, status, limit } = z.object({
      sportSlug: z.string().optional(),
      competitionId: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().optional(),
    }).parse(request.query);

    const where: any = { status: { in: ['UPCOMING', 'LIVE'] } };
    if (status) where.status = status;
    if (competitionId) where.competitionId = competitionId;
    if (sportSlug) {
      const sport = await sportsService.getSportBySlug(sportSlug);
      if (sport) {
        where.competition = { sportId: sport.id };
      }
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: Math.min(limit || 50, 100),
      include: {
        competition: { include: { sport: true } },
        markets: {
          where: { status: 'OPEN' },
          take: 5,
          orderBy: { sortOrder: 'asc' },
          include: { selections: { where: { status: 'ACTIVE' }, orderBy: { outcome: 'asc' } } },
        },
        _count: { select: { markets: { where: { status: 'OPEN' } } } },
      },
    });
    sendSuccess(reply, events);
  });

  // Get single event with all markets
  app.get('/events/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const event = await sportsService.getEvent(id);
    sendSuccess(reply, event);
  });

  // Get live events
  app.get('/live', async (request, reply) => {
    const { sport } = z.object({ sport: z.string().optional() }).parse(request.query);
    const events = await sportsService.getLiveEvents(sport);
    sendSuccess(reply, events);
  });

  // Get featured events
  app.get('/featured', async (request, reply) => {
    const events = await sportsService.getFeaturedEvents();
    sendSuccess(reply, events);
  });

  // Search events
  app.get('/search', async (request, reply) => {
    const { q } = z.object({ q: z.string().min(2) }).parse(request.query);
    const events = await sportsService.searchEvents(q);
    sendSuccess(reply, events);
  });

  // ─── ADMIN ROUTES ───────────────────────────────────────────────

  // Create sport
  app.post('/admin', { preHandler: [adminGuard] }, async (request, reply) => {
    const body = z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      icon: z.string().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(request.body);
    const sport = await sportsService.createSport(body);
    sendSuccess(reply, sport, undefined, 201);
  });

  // Update sport
  app.put('/admin/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(request.body);
    const sport = await sportsService.updateSport(id, body);
    sendSuccess(reply, sport);
  });

  // Create competition
  app.post('/admin/competitions', { preHandler: [adminGuard] }, async (request, reply) => {
    const body = z.object({
      sportId: z.string(),
      name: z.string(),
      slug: z.string(),
      country: z.string().optional(),
    }).parse(request.body);
    const competition = await sportsService.createCompetition(body);
    sendSuccess(reply, competition, undefined, 201);
  });

  // Create event
  app.post('/admin/events', { preHandler: [adminGuard] }, async (request, reply) => {
    const body = z.object({
      competitionId: z.string(),
      name: z.string(),
      homeTeam: z.string().optional(),
      awayTeam: z.string().optional(),
      startTime: z.string().datetime(),
      isFeatured: z.boolean().optional(),
    }).parse(request.body);
    const event = await sportsService.createEvent({
      ...body,
      startTime: new Date(body.startTime),
    });
    sendSuccess(reply, event, undefined, 201);
  });

  // Update event
  app.put('/admin/events/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      name: z.string().optional(),
      status: z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'POSTPONED']).optional(),
      scores: z.any().optional(),
      isLive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
      metadata: z.any().optional(),
    }).parse(request.body);
    const event = await sportsService.updateEvent(id, body);
    sendSuccess(reply, event);
  });

  // Update event status
  app.patch('/admin/events/:id/status', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { status } = z.object({
      status: z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'POSTPONED']),
    }).parse(request.body);
    const event = await sportsService.updateEventStatus(id, status);
    sendSuccess(reply, event);
  });

  // Create market
  app.post('/admin/markets', { preHandler: [adminGuard] }, async (request, reply) => {
    const body = z.object({
      eventId: z.string(),
      name: z.string(),
      marketKey: z.string(),
      type: z.enum(['MONEYLINE', 'SPREAD', 'TOTAL', 'PROP', 'OUTRIGHT']),
      period: z.string().optional(),
      sortOrder: z.number().int().optional(),
      margin: z.number().optional(),
    }).parse(request.body);
    const market = await sportsService.createMarket(body);
    sendSuccess(reply, market, undefined, 201);
  });

  // Create selection
  app.post('/admin/selections', { preHandler: [adminGuard] }, async (request, reply) => {
    const body = z.object({
      marketId: z.string(),
      name: z.string(),
      outcome: z.string(),
      odds: z.number().positive(),
      probability: z.number().min(0).max(1).optional(),
      handicap: z.number().optional(),
      maxStake: z.number().positive().optional(),
    }).parse(request.body);
    const selection = await sportsService.createSelection(body);
    sendSuccess(reply, selection, undefined, 201);
  });

  // Update odds
  app.patch('/admin/selections/:id/odds', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { odds } = z.object({ odds: z.number().positive() }).parse(request.body);
    await sportsService.updateOdds(id, odds);
    sendSuccess(reply, { message: 'Odds updated' });
  });

  // Suspend/resume market
  app.patch('/admin/markets/:id/suspend', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await sportsService.suspendMarket(id);
    sendSuccess(reply, { message: 'Market suspended' });
  });

  app.patch('/admin/markets/:id/resume', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await sportsService.resumeMarket(id);
    sendSuccess(reply, { message: 'Market resumed' });
  });

  // Settle market
  app.post('/admin/markets/:id/settle', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { results } = z.object({
      results: z.array(z.object({
        selectionId: z.string(),
        result: z.enum(['WIN', 'LOSE', 'VOID', 'PUSH', 'HALF_WIN', 'HALF_LOSE']),
      })),
    }).parse(request.body);
    const result = await sportsService.settleMarket(id, results);
    sendSuccess(reply, result);
  });
}
