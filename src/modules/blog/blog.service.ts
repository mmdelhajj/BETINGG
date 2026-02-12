import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { AppError } from '../../utils/errors';

const BLOG_CACHE_TTL = 300; // 5 minutes

export class BlogService {
  // ─── Public ───────────────────────────────────────────────
  async listPublished(opts: { page?: number; limit?: number; category?: string; tag?: string }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 20, 50);
    const where: any = { status: 'PUBLISHED', publishedAt: { lte: new Date() } };
    if (opts.category) where.category = opts.category;
    if (opts.tag) where.tags = { has: opts.tag };

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, title: true, slug: true, excerpt: true, category: true,
          tags: true, authorName: true, authorAvatar: true, featuredImage: true,
          publishedAt: true,
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return { posts, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  async getBySlug(slug: string) {
    const cacheKey = `blog:post:${slug}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const post = await prisma.blogPost.findUnique({ where: { slug } });
    if (!post || post.status !== 'PUBLISHED') throw new AppError('POST_NOT_FOUND', 'Blog post not found', 404);

    await redis.setex(cacheKey, BLOG_CACHE_TTL, JSON.stringify(post));
    return post;
  }

  async getRelated(postId: string, limit = 4) {
    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post) return [];

    return prisma.blogPost.findMany({
      where: {
        id: { not: postId },
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() },
        OR: [{ category: post.category }, { tags: { hasSome: post.tags } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true, title: true, slug: true, excerpt: true, category: true,
        featuredImage: true, publishedAt: true, authorName: true,
      },
    });
  }

  async getCategories() {
    const posts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { category: true },
    });
    const counts: Record<string, number> = {};
    for (const p of posts) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  // ─── Admin ────────────────────────────────────────────────
  async adminList(opts: { page?: number; limit?: number; status?: string }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 20, 100);
    const where: any = {};
    if (opts.status) where.status = opts.status;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return { posts, meta: { page, limit, total, hasMore: page * limit < total } };
  }

  async create(data: {
    title: string; slug: string; content: string; excerpt?: string;
    category: string; tags?: string[]; authorName: string; authorAvatar?: string;
    featuredImage?: string; seoTitle?: string; seoDescription?: string;
    status?: string; scheduledAt?: Date;
  }) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError('SLUG_EXISTS', 'A post with this slug already exists', 409);

    const publishedAt = data.status === 'PUBLISHED' ? new Date() : undefined;

    return prisma.blogPost.create({
      data: {
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt || data.content.slice(0, 200),
        category: data.category,
        tags: data.tags || [],
        authorName: data.authorName,
        authorAvatar: data.authorAvatar,
        featuredImage: data.featuredImage,
        seoTitle: data.seoTitle || data.title,
        seoDescription: data.seoDescription || data.excerpt || data.content.slice(0, 160),
        status: (data.status as any) || 'DRAFT',
        publishedAt,
        scheduledAt: data.scheduledAt,
      },
    });
  }

  async update(id: string, data: Partial<{
    title: string; slug: string; content: string; excerpt: string;
    category: string; tags: string[]; authorName: string; authorAvatar: string;
    featuredImage: string; seoTitle: string; seoDescription: string;
    status: string; scheduledAt: Date;
  }>) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new AppError('POST_NOT_FOUND', 'Blog post not found', 404);

    if (data.slug && data.slug !== post.slug) {
      const conflict = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
      if (conflict) throw new AppError('SLUG_EXISTS', 'A post with this slug already exists', 409);
    }

    const publishedAt = data.status === 'PUBLISHED' && post.status !== 'PUBLISHED'
      ? new Date() : post.publishedAt;

    const updated = await prisma.blogPost.update({
      where: { id },
      data: { ...data, status: data.status as any, publishedAt },
    });

    await redis.del(`blog:post:${post.slug}`);
    if (data.slug && data.slug !== post.slug) {
      await redis.del(`blog:post:${data.slug}`);
    }

    return updated;
  }

  async delete(id: string) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new AppError('POST_NOT_FOUND', 'Blog post not found', 404);
    await prisma.blogPost.delete({ where: { id } });
    await redis.del(`blog:post:${post.slug}`);
  }

  // Process scheduled posts (called by cron or queue)
  async publishScheduled() {
    const now = new Date();
    const posts = await prisma.blogPost.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    });
    for (const post of posts) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: now },
      });
    }
    return posts.length;
  }
}

export const blogService = new BlogService();
