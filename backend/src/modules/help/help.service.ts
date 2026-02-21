import { prisma } from '../../lib/prisma.js';
import type {
  CreateArticleInput,
  UpdateArticleInput,
  ListArticlesQuery,
  AdminListArticlesQuery,
} from './help.schemas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class HelpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'HelpError';
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 0;
  while (true) {
    const existing = await prisma.helpArticle.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

/** Predefined help center categories */
export const HELP_CATEGORIES = [
  'Getting Started',
  'Account',
  'Deposits',
  'Withdrawals',
  'Sports Betting',
  'Casino',
  'VIP & Rewards',
  'Security',
  'Responsible Gambling',
] as const;

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export async function getArticles(query: ListArticlesQuery) {
  const { category, search } = query;

  const where: Record<string, unknown> = {
    isPublished: true,
  };

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];
  }

  const articles = await prisma.helpArticle.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      tags: true,
      helpfulYes: true,
      helpfulNo: true,
      updatedAt: true,
    },
  });

  // Group by category
  const grouped: Record<string, typeof articles> = {};
  for (const article of articles) {
    if (!grouped[article.category]) {
      grouped[article.category] = [];
    }
    grouped[article.category].push(article);
  }

  return { articles, grouped };
}

export async function getArticle(slug: string) {
  const article = await prisma.helpArticle.findUnique({
    where: { slug },
  });

  if (!article || !article.isPublished) {
    throw new HelpError('ARTICLE_NOT_FOUND', 'Help article not found', 404);
  }

  return article;
}

export async function getCategories() {
  // Return the predefined categories with article counts
  const categoryCounts = await prisma.helpArticle.groupBy({
    by: ['category'],
    where: { isPublished: true },
    _count: { id: true },
  });

  const countMap = new Map(
    categoryCounts.map((c) => [c.category, c._count.id]),
  );

  return HELP_CATEGORIES.map((name) => ({
    name,
    articleCount: countMap.get(name) ?? 0,
  }));
}

export async function voteHelpful(articleId: string, isHelpful: boolean) {
  const article = await prisma.helpArticle.findUnique({
    where: { id: articleId },
  });

  if (!article) {
    throw new HelpError('ARTICLE_NOT_FOUND', 'Help article not found', 404);
  }

  const updated = await prisma.helpArticle.update({
    where: { id: articleId },
    data: isHelpful
      ? { helpfulYes: { increment: 1 } }
      : { helpfulNo: { increment: 1 } },
    select: {
      id: true,
      helpfulYes: true,
      helpfulNo: true,
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminGetArticles(query: AdminListArticlesQuery) {
  const { page, limit, category, status } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status === 'published') where.isPublished = true;
  if (status === 'unpublished') where.isPublished = false;
  if (category) where.category = category;

  const [articles, total] = await Promise.all([
    prisma.helpArticle.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.helpArticle.count({ where }),
  ]);

  return {
    articles,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createArticle(data: CreateArticleInput) {
  const slug = await uniqueSlug(slugify(data.title));

  return prisma.helpArticle.create({
    data: {
      title: data.title,
      slug,
      content: data.content,
      category: data.category,
      tags: data.tags ?? [],
      sortOrder: data.sortOrder ?? 0,
      isPublished: data.isPublished ?? true,
    },
  });
}

export async function updateArticle(id: string, data: UpdateArticleInput) {
  const existing = await prisma.helpArticle.findUnique({ where: { id } });
  if (!existing) {
    throw new HelpError('ARTICLE_NOT_FOUND', 'Help article not found', 404);
  }

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
    updateData.slug = await uniqueSlug(slugify(data.title), id);
  }
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

  return prisma.helpArticle.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteArticle(id: string) {
  const existing = await prisma.helpArticle.findUnique({ where: { id } });
  if (!existing) {
    throw new HelpError('ARTICLE_NOT_FOUND', 'Help article not found', 404);
  }

  await prisma.helpArticle.delete({ where: { id } });
  return { message: 'Article deleted successfully' };
}
