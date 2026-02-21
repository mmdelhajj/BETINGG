import { z } from 'zod';

// ---------------------------------------------------------------------------
// Public schemas
// ---------------------------------------------------------------------------

export const claimPromotionParamsSchema = z.object({
  id: z.string().min(1, 'Promotion ID is required'),
});
export type ClaimPromotionParams = z.infer<typeof claimPromotionParamsSchema>;

export const redeemPromoCodeSchema = z.object({
  code: z
    .string()
    .min(1, 'Promo code is required')
    .max(50, 'Promo code is too long')
    .transform((v) => v.trim().toUpperCase()),
});
export type RedeemPromoCodeInput = z.infer<typeof redeemPromoCodeSchema>;

export const promotionIdParamsSchema = z.object({
  id: z.string().min(1, 'Promotion ID is required'),
});
export type PromotionIdParams = z.infer<typeof promotionIdParamsSchema>;

export const listPromotionsQuerySchema = z.object({
  type: z
    .enum(['DEPOSIT_BONUS', 'FREE_BET', 'ODDS_BOOST', 'CASHBACK', 'TOURNAMENT', 'CUSTOM'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;

// ---------------------------------------------------------------------------
// Admin schemas
// ---------------------------------------------------------------------------

export const createPromotionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  type: z.enum(['DEPOSIT_BONUS', 'FREE_BET', 'ODDS_BOOST', 'CASHBACK', 'TOURNAMENT', 'CUSTOM']),
  code: z
    .string()
    .max(50)
    .transform((v) => v.trim().toUpperCase())
    .optional()
    .nullable(),
  image: z.string().url().optional().nullable(),
  conditions: z.object({
    minDeposit: z.number().min(0).optional(),
    maxBonus: z.number().min(0).optional(),
    wageringRequirement: z.number().min(0).optional(),
    minOdds: z.number().min(1).optional(),
    validGames: z.array(z.string()).optional(),
    minVipTier: z
      .enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'ELITE', 'BLACK_DIAMOND', 'BLUE_DIAMOND'])
      .optional(),
    maxClaimsPerUser: z.number().int().min(1).optional(),
    newUsersOnly: z.boolean().optional(),
  }),
  reward: z.object({
    type: z.enum(['PERCENTAGE', 'FIXED', 'FREE_BET', 'ODDS_BOOST']),
    value: z.number().min(0),
    currency: z.string().default('USDT'),
    maxValue: z.number().min(0).optional(),
  }),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxClaims: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

export const updatePromotionSchema = createPromotionSchema.partial();
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

export const generatePromoCodesSchema = z.object({
  promotionId: z.string().min(1, 'Promotion ID is required'),
  count: z.number().int().min(1).max(1000).default(1),
  prefix: z.string().max(10).optional(),
});
export type GeneratePromoCodesInput = z.infer<typeof generatePromoCodesSchema>;

export const adminListPromoCodesQuerySchema = z.object({
  promotionId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminListPromoCodesQuery = z.infer<typeof adminListPromoCodesQuerySchema>;

export const adminListPromotionsQuerySchema = z.object({
  type: z
    .enum(['DEPOSIT_BONUS', 'FREE_BET', 'ODDS_BOOST', 'CASHBACK', 'TOURNAMENT', 'CUSTOM'])
    .optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminListPromotionsQuery = z.infer<typeof adminListPromotionsQuerySchema>;
