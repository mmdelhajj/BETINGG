import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { helpService } from './help.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  category: z.enum(['account', 'payments', 'bonuses', 'betting-rules', 'responsible-gambling', 'security']),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export default async function helpRoutes(app: FastifyInstance) {
  // ─── Public ───────────────────────────────────────────
  app.get('/help/articles', async (request, reply) => {
    const { page, limit, category, search } = request.query as any;
    const result = await helpService.listArticles({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category, search,
    });
    sendSuccess(reply, result.articles, result.meta);
  });

  app.get('/help/articles/:slug', async (request, reply) => {
    const { slug } = request.params as any;
    const article = await helpService.getBySlug(slug);
    sendSuccess(reply, article);
  });

  app.get('/help/articles/:id/related', async (request, reply) => {
    const { id } = request.params as any;
    const related = await helpService.getRelated(id);
    sendSuccess(reply, related);
  });

  app.get('/help/categories', async (request, reply) => {
    const categories = await helpService.getCategories();
    sendSuccess(reply, categories);
  });

  app.post('/help/articles/:id/feedback', async (request, reply) => {
    const { id } = request.params as any;
    const { helpful } = request.body as any;
    await helpService.submitFeedback(id, helpful === true);
    sendSuccess(reply, { submitted: true });
  });

  // ─── Admin ────────────────────────────────────────────
  app.get('/admin/help/articles', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { page, limit, category } = request.query as any;
    const result = await helpService.adminList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category,
    });
    sendSuccess(reply, result.articles, result.meta);
  });

  app.post('/admin/help/articles', { preHandler: [authMiddleware] }, async (request, reply) => {
    const data = createArticleSchema.parse(request.body);
    const article = await helpService.create(data);
    sendSuccess(reply, article);
  });

  app.put('/admin/help/articles/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const data = createArticleSchema.partial().parse(request.body);
    const article = await helpService.update(id, data);
    sendSuccess(reply, article);
  });

  app.delete('/admin/help/articles/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    await helpService.delete(id);
    sendSuccess(reply, { deleted: true });
  });
}
