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
// Place Bet
// ---------------------------------------------------------------------------

export const placeBetSchema = z.object({
  type: z.enum(['SINGLE', 'PARLAY']),
  selections: z
    .array(
      z.object({
        selectionId: z.string().min(1, 'Selection ID is required'),
        odds: z.number().positive('Odds must be positive'),
      }),
    )
    .min(1, 'At least one selection is required')
    .max(15, 'Maximum 15 selections per parlay'),
  stake: z
    .number()
    .positive('Stake must be positive')
    .min(0.0001, 'Minimum stake is 0.0001'),
  currency: z.string().min(1, 'Currency is required'),
  oddsChangePolicy: z.enum(['ACCEPT_ANY', 'ACCEPT_HIGHER', 'REJECT']).default('REJECT'),
  isLive: z.boolean().optional().default(false),
});

export type PlaceBetInput = z.infer<typeof placeBetSchema>;

// ---------------------------------------------------------------------------
// Bet History
// ---------------------------------------------------------------------------

export const betHistoryQuerySchema = paginationSchema.extend({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'WON', 'LOST', 'VOID', 'CASHOUT', 'PARTIALLY_SETTLED'])
    .optional(),
  type: z.enum(['SINGLE', 'PARLAY', 'SYSTEM']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type BetHistoryQuery = z.infer<typeof betHistoryQuerySchema>;

// ---------------------------------------------------------------------------
// Bet ID Params
// ---------------------------------------------------------------------------

export const betIdParamsSchema = z.object({
  id: z.string().min(1, 'Bet ID is required'),
});

export type BetIdParams = z.infer<typeof betIdParamsSchema>;

// ---------------------------------------------------------------------------
// Cashout
// ---------------------------------------------------------------------------

export const cashoutSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
});

export type CashoutInput = z.infer<typeof cashoutSchema>;

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

export const shareBetSchema = z.object({});

export type ShareBetInput = z.infer<typeof shareBetSchema>;
