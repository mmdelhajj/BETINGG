import { z } from 'zod';

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const listArticlesQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;

export const adminListArticlesQuerySchema = z.object({
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
  category: z.string().optional(),
  status: z.enum(['all', 'published', 'unpublished']).optional().default('all'),
});

export type AdminListArticlesQuery = z.infer<typeof adminListArticlesQuerySchema>;

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

export const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  sortOrder: z.number().int().min(0).optional().default(0),
  isPublished: z.boolean().optional().default(true),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

export const helpfulVoteSchema = z.object({
  isHelpful: z.boolean(),
});

export type HelpfulVoteInput = z.infer<typeof helpfulVoteSchema>;
