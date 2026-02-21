import { z } from 'zod';

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export type IdParam = z.infer<typeof idParamSchema>;

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const liveEventsQuerySchema = z.object({
  sport: z.string().optional(),
  competition: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),
});

export type LiveEventsQuery = z.infer<typeof liveEventsQuerySchema>;

export const timelineQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

export type TimelineQuery = z.infer<typeof timelineQuerySchema>;

// ---------------------------------------------------------------------------
// Body schemas
// ---------------------------------------------------------------------------

export const placeLiveBetSchema = z.object({
  selectionId: z.string().min(1, 'Selection ID is required'),
  stake: z
    .number()
    .positive('Stake must be positive')
    .min(0.01, 'Minimum stake is 0.01'),
  currency: z.string().min(1, 'Currency is required'),
  odds: z.number().positive('Odds must be positive'),
  oddsChangePolicy: z
    .enum(['ACCEPT_ANY', 'ACCEPT_HIGHER', 'REJECT'])
    .default('REJECT'),
});

export type PlaceLiveBetInput = z.infer<typeof placeLiveBetSchema>;
