import { z } from 'zod';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export const eventIdParamsSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
});
export type EventIdParams = z.infer<typeof eventIdParamsSchema>;

export const providerIdParamsSchema = z.object({
  id: z.string().min(1, 'Provider ID is required'),
});
export type ProviderIdParams = z.infer<typeof providerIdParamsSchema>;

// ---------------------------------------------------------------------------
// Admin: Create/Update Odds Provider
// ---------------------------------------------------------------------------

export const createOddsProviderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  type: z.enum(['REST', 'WEBSOCKET']),
  apiKey: z.string().optional(),
  apiUrl: z.string().url().optional(),
  priority: z.number().int().min(1).max(100).optional().default(1),
  isActive: z.boolean().optional().default(true),
  rateLimitPerMin: z.number().int().positive().optional(),
  quotaLimit: z.number().int().positive().optional(),
  config: z.record(z.unknown()).optional(),
});
export type CreateOddsProviderInput = z.infer<typeof createOddsProviderSchema>;

export const updateOddsProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  type: z.enum(['REST', 'WEBSOCKET']).optional(),
  apiKey: z.string().nullable().optional(),
  apiUrl: z.string().url().nullable().optional(),
  priority: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  rateLimitPerMin: z.number().int().positive().nullable().optional(),
  quotaLimit: z.number().int().positive().nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
});
export type UpdateOddsProviderInput = z.infer<typeof updateOddsProviderSchema>;

// ---------------------------------------------------------------------------
// Admin: Sync
// ---------------------------------------------------------------------------

export const oddsSyncSchema = z.object({
  sportKey: z.string().min(1, 'Sport key is required').optional(),
  providerId: z.string().optional(),
});
export type OddsSyncInput = z.infer<typeof oddsSyncSchema>;

// ---------------------------------------------------------------------------
// Admin: Sync Logs Query
// ---------------------------------------------------------------------------

export const syncLogsQuerySchema = z.object({
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
  providerId: z.string().optional(),
  status: z.string().optional(),
});
export type SyncLogsQuery = z.infer<typeof syncLogsQuerySchema>;
