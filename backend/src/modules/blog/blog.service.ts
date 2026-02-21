import { prisma } from '../../lib/prisma.js';
import type {
  CreatePostInput,
  UpdatePostInput,
  ListPostsQuery,
  AdminListPostsQuery,
} from './blog.schemas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class BlogError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'BlogError';
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
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export async function getPosts(query: ListPostsQuery) {
  const { page, limit, category } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    isPublished: true,
  };
  if (category) {
    where.category = category;
  }

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        category: true,
        tags: true,
        views: true,
        publishedAt: true,
        author: {
          select: { id: true, username: true },
        },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    posts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getPost(slug: string) {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, username: true },
      },
    },
  });

  if (!post || !post.isPublished) {
    throw new BlogError('POST_NOT_FOUND', 'Blog post not found', 404);
  }

  // Increment views (fire and forget)
  void prisma.blogPost.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
  });

  return post;
}

export async function getCategories() {
  const posts = await prisma.blogPost.findMany({
    where: { isPublished: true, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });

  return posts
    .map((p) => p.category)
    .filter((c): c is string => c !== null);
}

export async function getRelatedPosts(slug: string, limit = 3) {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: { id: true, category: true, tags: true },
  });

  if (!post) return [];

  return prisma.blogPost.findMany({
    where: {
      isPublished: true,
      id: { not: post.id },
      OR: [
        ...(post.category ? [{ category: post.category }] : []),
        ...(post.tags.length > 0 ? [{ tags: { hasSome: post.tags } }] : []),
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      category: true,
      publishedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminGetPosts(query: AdminListPostsQuery) {
  const { page, limit, status, category } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status === 'published') where.isPublished = true;
  if (status === 'draft') where.isPublished = false;
  if (category) where.category = category;

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, username: true, email: true },
        },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    posts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createPost(data: CreatePostInput, authorId: string) {
  const slug = await uniqueSlug(slugify(data.title));

  return prisma.blogPost.create({
    data: {
      title: data.title,
      slug,
      content: data.content,
      excerpt: data.excerpt ?? null,
      featuredImage: data.featuredImage ?? null,
      category: data.category ?? null,
      tags: data.tags ?? [],
      authorId,
      isPublished: false,
    },
  });
}

export async function updatePost(id: string, data: UpdatePostInput) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) {
    throw new BlogError('POST_NOT_FOUND', 'Blog post not found', 404);
  }

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
    updateData.slug = await uniqueSlug(slugify(data.title), id);
  }
  if (data.content !== undefined) updateData.content = data.content;
  if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
  if (data.featuredImage !== undefined) updateData.featuredImage = data.featuredImage;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.tags !== undefined) updateData.tags = data.tags;

  return prisma.blogPost.update({
    where: { id },
    data: updateData,
  });
}

export async function deletePost(id: string) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) {
    throw new BlogError('POST_NOT_FOUND', 'Blog post not found', 404);
  }

  await prisma.blogPost.delete({ where: { id } });
  return { message: 'Post deleted successfully' };
}

export async function publishPost(id: string, publish: boolean) {
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) {
    throw new BlogError('POST_NOT_FOUND', 'Blog post not found', 404);
  }

  return prisma.blogPost.update({
    where: { id },
    data: {
      isPublished: publish,
      publishedAt: publish ? new Date() : null,
    },
  });
}
