import { z } from 'zod';

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const slugParamSchema = z.object({
  slug: z.string().min(1, 'Game slug is required'),
});

export type SlugParam = z.infer<typeof slugParamSchema>;

export const gameSlugParamSchema = z.object({
  gameSlug: z.string().min(1, 'Game slug is required'),
});

export type GameSlugParam = z.infer<typeof gameSlugParamSchema>;

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const gamesQuerySchema = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type GamesQuery = z.infer<typeof gamesQuerySchema>;

export const historyQuerySchema = z.object({
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
  game: z.string().optional(),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

// ---------------------------------------------------------------------------
// Play game schema
// ---------------------------------------------------------------------------

export const playGameSchema = z.object({
  betAmount: z
    .number()
    .positive('Bet amount must be positive')
    .min(0.01, 'Minimum bet is 0.01'),
  currency: z.string().min(1, 'Currency is required'),
  clientSeed: z.string().max(64).optional(),
  options: z.record(z.unknown()).optional(),
});

export type PlayGameInput = z.infer<typeof playGameSchema>;

// ---------------------------------------------------------------------------
// Auto-bet schema
// ---------------------------------------------------------------------------

export const autoBetSchema = z.object({
  gameId: z.string().min(1, 'Game ID is required'),
  betAmount: z
    .number()
    .positive('Bet amount must be positive')
    .min(0.01, 'Minimum bet is 0.01'),
  currency: z.string().min(1, 'Currency is required'),
  rounds: z
    .number()
    .int()
    .positive('Rounds must be positive')
    .max(10000, 'Maximum 10000 rounds'),
  stopOnProfit: z.number().positive().optional(),
  stopOnLoss: z.number().positive().optional(),
  onWinAction: z.enum(['reset', 'increase']).default('reset'),
  onWinPercent: z.number().min(0).max(1000).optional(),
  onLossAction: z.enum(['reset', 'increase', 'martingale']).default('reset'),
  onLossPercent: z.number().min(0).max(1000).optional(),
  delayMs: z.number().int().min(100).max(5000).optional(),
  gameOptions: z.record(z.unknown()).optional(),
});

export type AutoBetInput = z.infer<typeof autoBetSchema>;

// ---------------------------------------------------------------------------
// Verify fairness schema
// ---------------------------------------------------------------------------

export const verifyFairnessSchema = z.object({
  serverSeed: z.string().min(1, 'Server seed is required'),
  clientSeed: z.string().min(1, 'Client seed is required'),
  nonce: z
    .number()
    .int()
    .min(0, 'Nonce must be non-negative'),
  gameType: z.string().min(1, 'Game type is required'),
});

export type VerifyFairnessInput = z.infer<typeof verifyFairnessSchema>;

// ---------------------------------------------------------------------------
// Client seed schema
// ---------------------------------------------------------------------------

export const setClientSeedSchema = z.object({
  clientSeed: z
    .string()
    .min(1, 'Client seed is required')
    .max(64, 'Client seed must be at most 64 characters'),
});

export type SetClientSeedInput = z.infer<typeof setClientSeedSchema>;
