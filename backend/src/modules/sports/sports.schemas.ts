import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? '1', 10)))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? '20', 10))))
    .pipe(z.number().int().positive()),
});

// ---------------------------------------------------------------------------
// Public query schemas
// ---------------------------------------------------------------------------

export const sportSlugParamsSchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
});
export type SportSlugParams = z.infer<typeof sportSlugParamsSchema>;

export const competitionIdParamsSchema = z.object({
  id: z.string().min(1, 'Competition ID is required'),
});
export type CompetitionIdParams = z.infer<typeof competitionIdParamsSchema>;

export const eventIdParamsSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
});
export type EventIdParams = z.infer<typeof eventIdParamsSchema>;

export const marketIdParamsSchema = z.object({
  id: z.string().min(1, 'Market ID is required'),
});
export type MarketIdParams = z.infer<typeof marketIdParamsSchema>;

export const selectionIdParamsSchema = z.object({
  id: z.string().min(1, 'Selection ID is required'),
});
export type SelectionIdParams = z.infer<typeof selectionIdParamsSchema>;

export const sportIdParamsSchema = z.object({
  id: z.string().min(1, 'Sport ID is required'),
});
export type SportIdParams = z.infer<typeof sportIdParamsSchema>;

export const eventsQuerySchema = paginationSchema.extend({
  sportSlug: z.string().optional(),
  status: z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'POSTPONED']).optional(),
  featured: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  live: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  search: z.string().optional(),
  competitionId: z.string().optional(),
});
export type EventsQuery = z.infer<typeof eventsQuerySchema>;

export const searchEventsQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? '1', 10)))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(50, Math.max(1, parseInt(v ?? '20', 10))))
    .pipe(z.number().int().positive()),
});
export type SearchEventsQuery = z.infer<typeof searchEventsQuerySchema>;

export const competitionEventsQuerySchema = paginationSchema.extend({
  status: z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'POSTPONED']).optional(),
});
export type CompetitionEventsQuery = z.infer<typeof competitionEventsQuerySchema>;

// ---------------------------------------------------------------------------
// Admin create/update schemas
// ---------------------------------------------------------------------------

export const createSportSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  icon: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});
export type CreateSportInput = z.infer<typeof createSportSchema>;

export const updateSportSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  icon: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateSportInput = z.infer<typeof updateSportSchema>;

export const createCompetitionSchema = z.object({
  sportId: z.string().min(1, 'Sport ID is required'),
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  country: z.string().max(100).optional(),
  isActive: z.boolean().optional().default(true),
});
export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;

export const updateCompetitionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  country: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;

export const createEventSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
  name: z.string().min(1, 'Event name is required').max(500),
  homeTeam: z.string().max(200).optional(),
  awayTeam: z.string().max(200).optional(),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date format'),
  isFeatured: z.boolean().optional().default(false),
  streamUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  homeTeam: z.string().max(200).nullable().optional(),
  awayTeam: z.string().max(200).nullable().optional(),
  startTime: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), 'Invalid date format')
    .optional(),
  status: z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'POSTPONED']).optional(),
  scores: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  isFeatured: z.boolean().optional(),
  isLive: z.boolean().optional(),
  streamUrl: z.string().url().nullable().optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const createMarketSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  name: z.string().min(1, 'Market name is required').max(300),
  marketKey: z.string().min(1, 'Market key is required').max(100),
  type: z.enum(['MONEYLINE', 'SPREAD', 'TOTAL', 'PROP', 'OUTRIGHT']),
  period: z.string().max(20).optional().default('FT'),
  sortOrder: z.number().int().optional().default(0),
});
export type CreateMarketInput = z.infer<typeof createMarketSchema>;

export const updateMarketSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  marketKey: z.string().min(1).max(100).optional(),
  type: z.enum(['MONEYLINE', 'SPREAD', 'TOTAL', 'PROP', 'OUTRIGHT']).optional(),
  status: z.enum(['OPEN', 'SUSPENDED', 'SETTLED', 'CANCELLED', 'VOIDED']).optional(),
  period: z.string().max(20).optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateMarketInput = z.infer<typeof updateMarketSchema>;

export const createSelectionSchema = z.object({
  marketId: z.string().min(1, 'Market ID is required'),
  name: z.string().min(1, 'Selection name is required').max(200),
  outcome: z.string().min(1, 'Outcome is required').max(100),
  odds: z
    .number()
    .positive('Odds must be positive')
    .min(1.001, 'Odds must be greater than 1'),
  probability: z.number().min(0).max(1).optional(),
  maxStake: z.number().positive().optional(),
  handicap: z.number().optional(),
  params: z.string().max(200).optional(),
});
export type CreateSelectionInput = z.infer<typeof createSelectionSchema>;

export const updateSelectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  outcome: z.string().min(1).max(100).optional(),
  odds: z.number().positive().min(1.001).optional(),
  probability: z.number().min(0).max(1).nullable().optional(),
  maxStake: z.number().positive().nullable().optional(),
  handicap: z.number().nullable().optional(),
  params: z.string().max(200).nullable().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'WON', 'LOST', 'VOID', 'PUSH']).optional(),
});
export type UpdateSelectionInput = z.infer<typeof updateSelectionSchema>;

export const settleMarketSchema = z.object({
  results: z
    .array(
      z.object({
        selectionId: z.string().min(1, 'Selection ID is required'),
        result: z.enum(['WIN', 'LOSE', 'VOID', 'PUSH', 'HALF_WIN', 'HALF_LOSE']),
      }),
    )
    .min(1, 'At least one result is required'),
});
export type SettleMarketInput = z.infer<typeof settleMarketSchema>;
