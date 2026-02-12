import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { blogService } from './blog.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  category: z.enum(['sports', 'casino', 'esports', 'crypto', 'promotions']),
  tags: z.array(z.string()).optional(),
  authorName: z.string().min(1),
  authorAvatar: z.string().url().optional(),
  featuredImage: z.string().url().optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export default async function blogRoutes(app: FastifyInstance) {
  // ─── Public ───────────────────────────────────────────
  app.get('/blog/posts', async (request, reply) => {
    const { page, limit, category, tag } = request.query as any;
    const result = await blogService.listPublished({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category, tag,
    });
    sendSuccess(reply, result.posts, result.meta);
  });

  app.get('/blog/posts/:slug', async (request, reply) => {
    const { slug } = request.params as any;
    const post = await blogService.getBySlug(slug);
    sendSuccess(reply, post);
  });

  app.get('/blog/posts/:id/related', async (request, reply) => {
    const { id } = request.params as any;
    const related = await blogService.getRelated(id);
    sendSuccess(reply, related);
  });

  app.get('/blog/categories', async (request, reply) => {
    const categories = await blogService.getCategories();
    sendSuccess(reply, categories);
  });

  // ─── Admin ────────────────────────────────────────────
  app.get('/admin/blog/posts', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { page, limit, status } = request.query as any;
    const result = await blogService.adminList({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });
    sendSuccess(reply, result.posts, result.meta);
  });

  app.post('/admin/blog/posts', { preHandler: [authMiddleware] }, async (request, reply) => {
    const data = createPostSchema.parse(request.body);
    const post = await blogService.create({
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    });
    sendSuccess(reply, post);
  });

  app.put('/admin/blog/posts/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const data = createPostSchema.partial().parse(request.body);
    const post = await blogService.update(id, {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    });
    sendSuccess(reply, post);
  });

  app.delete('/admin/blog/posts/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    await blogService.delete(id);
    sendSuccess(reply, { deleted: true });
  });
}
