import { FastifyInstance } from 'fastify';
import { virtualSportsService } from './virtualSports.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

export default async function virtualSportsRoutes(app: FastifyInstance) {
  // ─── Public ───────────────────────────────────────────
  app.get('/virtual-sports', async (request, reply) => {
    const sports = await virtualSportsService.listSports();
    sendSuccess(reply, sports);
  });

  app.get('/virtual-sports/:slug', async (request, reply) => {
    const { slug } = request.params as any;
    const sport = await virtualSportsService.getSport(slug);
    sendSuccess(reply, sport);
  });

  app.get('/virtual-sports/:slug/upcoming', async (request, reply) => {
    const { slug } = request.params as any;
    const { limit } = request.query as any;
    const events = await virtualSportsService.getUpcomingEvents(slug, limit ? Number(limit) : 10);
    sendSuccess(reply, events);
  });

  app.get('/virtual-sports/:slug/results', async (request, reply) => {
    const { slug } = request.params as any;
    const { limit } = request.query as any;
    const results = await virtualSportsService.getRecentResults(slug, limit ? Number(limit) : 20);
    sendSuccess(reply, results);
  });

  app.get('/virtual-sports/events/:id', async (request, reply) => {
    const { id } = request.params as any;
    const event = await virtualSportsService.getEvent(id);
    sendSuccess(reply, event);
  });

  app.get('/virtual-sports/events/:id/verify', async (request, reply) => {
    const { id } = request.params as any;
    const result = await virtualSportsService.verifyResult(id);
    sendSuccess(reply, result);
  });

  // ─── Admin ────────────────────────────────────────────
  app.post('/admin/virtual-sports', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { name, slug, intervalSec, markets } = request.body as any;
    const sport = await virtualSportsService.adminCreateSport({ name, slug, intervalSec, markets });
    sendSuccess(reply, sport);
  });

  app.put('/admin/virtual-sports/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
    const sport = await virtualSportsService.adminUpdateSport(id, data);
    sendSuccess(reply, sport);
  });
}
