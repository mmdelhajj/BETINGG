import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { AppError } from '../../utils/errors';

const HELP_CACHE_TTL = 600; // 10 minutes

export class HelpService {
  // ─── Public ───────────────────────────────────────────────
  async listArticles(opts: { category?: string; search?: string; page?: number; limit?: number }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 20, 50);
    const where: any = { isPublished: true };

    if (opts.category) where.category = opts.category;
    if (opts.search) {
      where.OR = [
        { title: { contains: opts.search, mode: 'insensitive' } },
        { content: { contains: opts.search, mode: 'insensitive' } },
        { tags: { has: opts.search } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.helpArticle.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, title: true, slug: true, category: true,
          tags: true, sortOrder: true, helpfulCount: true,
          notHelpfulCount: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.helpArticle.count({ where }),
    ]);

    return { articles, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  async getBySlug(slug: string) {
    const cacheKey = `help:article:${slug}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const article = await prisma.helpArticle.findUnique({ where: { slug } });
    if (!article || !article.isPublished) throw new AppError('ARTICLE_NOT_FOUND', 'Help article not found', 404);

    await redis.setex(cacheKey, HELP_CACHE_TTL, JSON.stringify(article));
    return article;
  }

  async getCategories() {
    const articles = await prisma.helpArticle.findMany({
      where: { isPublished: true },
      select: { category: true },
    });
    const counts: Record<string, number> = {};
    for (const a of articles) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  async submitFeedback(articleId: string, helpful: boolean) {
    const article = await prisma.helpArticle.findUnique({ where: { id: articleId } });
    if (!article) throw new AppError('ARTICLE_NOT_FOUND', 'Help article not found', 404);

    await prisma.helpArticle.update({
      where: { id: articleId },
      data: helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
    });

    await redis.del(`help:article:${article.slug}`);
  }

  async getRelated(articleId: string, limit = 4) {
    const article = await prisma.helpArticle.findUnique({ where: { id: articleId } });
    if (!article) return [];

    return prisma.helpArticle.findMany({
      where: {
        id: { not: articleId },
        isPublished: true,
        OR: [{ category: article.category }, { tags: { hasSome: article.tags } }],
      },
      orderBy: { sortOrder: 'asc' },
      take: limit,
      select: { id: true, title: true, slug: true, category: true },
    });
  }

  // ─── Admin ────────────────────────────────────────────────
  async adminList(opts: { page?: number; limit?: number; category?: string }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 50, 100);
    const where: any = {};
    if (opts.category) where.category = opts.category;

    const [articles, total] = await Promise.all([
      prisma.helpArticle.findMany({
        where,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.helpArticle.count({ where }),
    ]);

    return { articles, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  async create(data: {
    title: string; slug: string; content: string; category: string;
    tags?: string[]; isPublished?: boolean; sortOrder?: number;
  }) {
    const existing = await prisma.helpArticle.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError('SLUG_EXISTS', 'An article with this slug already exists', 409);

    return prisma.helpArticle.create({
      data: {
        title: data.title,
        slug: data.slug,
        content: data.content,
        category: data.category,
        tags: data.tags || [],
        isPublished: data.isPublished ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, data: Partial<{
    title: string; slug: string; content: string; category: string;
    tags: string[]; isPublished: boolean; sortOrder: number;
  }>) {
    const article = await prisma.helpArticle.findUnique({ where: { id } });
    if (!article) throw new AppError('ARTICLE_NOT_FOUND', 'Article not found', 404);

    if (data.slug && data.slug !== article.slug) {
      const conflict = await prisma.helpArticle.findUnique({ where: { slug: data.slug } });
      if (conflict) throw new AppError('SLUG_EXISTS', 'An article with this slug already exists', 409);
    }

    const updated = await prisma.helpArticle.update({ where: { id }, data });
    await redis.del(`help:article:${article.slug}`);
    return updated;
  }

  async delete(id: string) {
    const article = await prisma.helpArticle.findUnique({ where: { id } });
    if (!article) throw new AppError('ARTICLE_NOT_FOUND', 'Article not found', 404);
    await prisma.helpArticle.delete({ where: { id } });
    await redis.del(`help:article:${article.slug}`);
  }
}

export const helpService = new HelpService();
