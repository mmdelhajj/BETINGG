import { z } from 'zod';

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const listPostsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 12))
    .pipe(z.number().int().min(1).max(50)),
  category: z.string().optional(),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const adminListPostsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  status: z.enum(['all', 'published', 'draft']).optional().default('all'),
  category: z.string().optional(),
});

export type AdminListPostsQuery = z.infer<typeof adminListPostsQuerySchema>;

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const slugParamSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});

export type SlugParam = z.infer<typeof slugParamSchema>;

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export type IdParam = z.infer<typeof idParamSchema>;

// ---------------------------------------------------------------------------
// Body schemas
// ---------------------------------------------------------------------------

export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().max(500).optional(),
  featuredImage: z.string().url('Featured image must be a valid URL').optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  featuredImage: z.string().url().optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const publishPostSchema = z.object({
  publish: z.boolean(),
});

export type PublishPostInput = z.infer<typeof publishPostSchema>;
