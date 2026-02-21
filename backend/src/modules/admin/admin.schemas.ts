import { z } from 'zod';

// =============================================================================
// Shared Helpers
// =============================================================================

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

const sortOrderSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z
    .string()
    .optional()
    .transform((v) => (v === 'asc' ? 'asc' : 'desc'))
    .pipe(z.enum(['asc', 'desc'])),
  // Accept `sortDir` as alias for `sortOrder` (frontend compat)
  sortDir: z
    .string()
    .optional()
    .transform((v) => (v === 'asc' ? 'asc' : v === 'desc' ? 'desc' : undefined)),
});

const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// =============================================================================
// Params Schemas
// =============================================================================

export const idParams = z.object({
  id: z.string().min(1, 'ID is required'),
});
export type IdParams = z.infer<typeof idParams>;

export const userIdParams = z.object({
  userId: z.string().min(1, 'User ID is required'),
});
export type UserIdParams = z.infer<typeof userIdParams>;

export const docIdParams = z.object({
  docId: z.string().min(1, 'Document ID is required'),
});
export type DocIdParams = z.infer<typeof docIdParams>;

export const betIdParams = z.object({
  betId: z.string().min(1, 'Bet ID is required'),
});
export type BetIdParams = z.infer<typeof betIdParams>;

// =============================================================================
// Dashboard
// =============================================================================

export const dashboardQuerySchema = z.object({
  period: z
    .string()
    .optional()
    .transform((v) => {
      if (v === '7d' || v === '30d' || v === '90d' || v === '365d') return v;
      return '7d';
    }),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const chartPeriodQuerySchema = z.object({
  period: z
    .string()
    .optional()
    .transform((v) => {
      if (v === '7d' || v === '30d' || v === '90d') return v;
      return '7d';
    }),
});
export type ChartPeriodQuery = z.infer<typeof chartPeriodQuerySchema>;

// =============================================================================
// User Management
// =============================================================================

export const listUsersQuerySchema = paginationSchema.merge(sortOrderSchema).extend({
  search: z.string().optional(),
  role: z.string().optional(),
  vipTier: z.string().optional(),
  kycLevel: z.string().optional(),
  // Accept `status` as frontend sends status=banned instead of isBanned=true
  status: z.string().optional(),
  isBanned: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const editUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(2).max(50).optional(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  vipTier: z
    .enum([
      'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
      'DIAMOND', 'ELITE', 'BLACK_DIAMOND', 'BLUE_DIAMOND',
    ])
    .optional(),
  kycLevel: z.enum(['UNVERIFIED', 'BASIC', 'INTERMEDIATE', 'ADVANCED']).optional(),
  isActive: z.boolean().optional(),
  preferredCurrency: z.string().optional(),
});
export type EditUserInput = z.infer<typeof editUserSchema>;

export const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required').max(1000),
});
export type BanUserInput = z.infer<typeof banUserSchema>;

export const adjustBalanceSchema = z.object({
  currencySymbol: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  amount: z.number().refine(v => v !== 0, 'Amount must be non-zero'),
  reason: z.string().min(1, 'Reason is required').max(1000),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
}).refine((data) => !!(data.currencySymbol || data.currency), {
  message: 'Currency is required (provide currencySymbol or currency)',
  path: ['currencySymbol'],
});
export type AdjustBalanceInput = {
  currencySymbol?: string;
  currency?: string;
  amount: number;
  reason: string;
  type?: 'CREDIT' | 'DEBIT';
};

export const addNoteSchema = z.object({
  note: z.string().min(1).max(5000).optional(),
  content: z.string().min(1).max(5000).optional(),
}).refine((data) => !!(data.note || data.content), {
  message: 'Note is required (provide note or content)',
  path: ['note'],
});
export type AddNoteInput = { note?: string; content?: string };

// =============================================================================
// KYC Management
// =============================================================================

export const listKycQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  type: z.string().optional(),
});
export type ListKycQuery = z.infer<typeof listKycQuerySchema>;

export const rejectKycSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
});
export type RejectKycInput = z.infer<typeof rejectKycSchema>;

// =============================================================================
// Betting Management
// =============================================================================

export const listBetsQuerySchema = paginationSchema.merge(sortOrderSchema).merge(dateRangeSchema).extend({
  status: z.string().optional(),
  type: z.string().optional(),
  userId: z.string().optional(),
  minStake: z.string().optional(),
  maxStake: z.string().optional(),
  isLive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});
export type ListBetsQuery = z.infer<typeof listBetsQuerySchema>;

export const voidBetSchema = z.object({
  reason: z.string().min(1, 'Void reason is required').max(1000),
});
export type VoidBetInput = z.infer<typeof voidBetSchema>;

export const settleManuallySchema = z.object({
  result: z.enum(['WON', 'LOST', 'VOID', 'PUSH']),
  payout: z.number().min(0).optional(),
  reason: z.string().min(1, 'Settlement reason is required').max(1000),
});
export type SettleManuallyInput = z.infer<typeof settleManuallySchema>;

// =============================================================================
// Casino Management
// =============================================================================

export const listGameConfigsQuerySchema = paginationSchema.extend({
  gameSlug: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});
export type ListGameConfigsQuery = z.infer<typeof listGameConfigsQuerySchema>;

export const updateGameConfigSchema = z.object({
  houseEdge: z.number().min(0).max(100).optional(),
  minBet: z.number().positive().optional(),
  maxBet: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  jackpotContribution: z.number().min(0).max(1).optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateGameConfigInput = z.infer<typeof updateGameConfigSchema>;

export const updateHouseEdgeSchema = z.object({
  gameSlug: z.string().min(1, 'Game slug is required'),
  houseEdge: z.number().min(0).max(100),
});
export type UpdateHouseEdgeInput = z.infer<typeof updateHouseEdgeSchema>;

// =============================================================================
// Financial Management
// =============================================================================

export const listTransactionsQuerySchema = paginationSchema.merge(sortOrderSchema).merge(dateRangeSchema).extend({
  type: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
  walletId: z.string().optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export const listWithdrawalsQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  status: z.string().optional(),
  userId: z.string().optional(),
});
export type ListWithdrawalsQuery = z.infer<typeof listWithdrawalsQuerySchema>;

export const withdrawalActionSchema = z.object({
  reason: z.string().max(1000).optional(),
});
export type WithdrawalActionInput = z.infer<typeof withdrawalActionSchema>;

// =============================================================================
// Sports Management
// =============================================================================

export const createSportSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  icon: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});
export type CreateSportInput = z.infer<typeof createSportSchema>;

export const updateSportSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  icon: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  order: z.number().int().optional(),
});
export type UpdateSportInput = z.infer<typeof updateSportSchema>;

export const listSportsQuerySchema = paginationSchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});
export type ListSportsQuery = z.infer<typeof listSportsQuerySchema>;

export const createCompetitionSchema = z.object({
  sportId: z.string().min(1, 'Sport ID is required'),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  country: z.string().max(100).optional(),
  isActive: z.boolean().optional().default(true),
});
export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;

export const updateCompetitionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  country: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;

export const createEventSchema = z.object({
  competitionId: z.string().min(1),
  name: z.string().min(1).max(500),
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
  startTime: z.string().refine((v) => !isNaN(Date.parse(v))).optional(),
  status: z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'POSTPONED']).optional(),
  scores: z.record(z.unknown()).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  isFeatured: z.boolean().optional(),
  isLive: z.boolean().optional(),
  streamUrl: z.string().url().nullable().optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const listEventsQuerySchema = paginationSchema.merge(dateRangeSchema).merge(sortOrderSchema).extend({
  sportId: z.string().optional(),
  competitionId: z.string().optional(),
  status: z.string().optional(),
  isLive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  isFeatured: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const createMarketSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1).max(300),
  marketKey: z.string().min(1).max(100),
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
  marketId: z.string().min(1),
  name: z.string().min(1).max(200),
  outcome: z.string().min(1).max(100),
  odds: z.number().positive().min(1.001, 'Odds must be > 1'),
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

// =============================================================================
// Odds Management
// =============================================================================

export const syncOddsSchema = z.object({
  providerId: z.string().min(1).optional(),
  sportKey: z.string().optional(),
});
export type SyncOddsInput = z.infer<typeof syncOddsSchema>;

export const listOddsProvidersQuerySchema = paginationSchema.extend({
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});
export type ListOddsProvidersQuery = z.infer<typeof listOddsProvidersQuerySchema>;

export const configureOddsProviderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.union([z.enum(['REST', 'WEBSOCKET']), z.enum(['THE_ODDS_API', 'GOALSERVE', 'CUSTOM'])]).optional(),
  apiKey: z.string().optional(),
  apiUrl: z.string().url().optional(),
  // Frontend sends 'baseUrl' instead of 'apiUrl'
  baseUrl: z.string().optional(),
  priority: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  // Frontend sends 'active' instead of 'isActive'
  active: z.boolean().optional(),
  // Frontend sends 'syncInterval'
  syncInterval: z.number().int().optional(),
  rateLimitPerMin: z.number().int().positive().optional(),
  quotaLimit: z.number().int().positive().nullable().optional(),
  config: z.record(z.unknown()).optional(),
});
export type ConfigureOddsProviderInput = z.infer<typeof configureOddsProviderSchema>;

export const createOddsProviderSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  type: z.union([z.enum(['REST', 'WEBSOCKET']), z.enum(['THE_ODDS_API', 'GOALSERVE', 'CUSTOM'])]).optional().default('REST'),
  apiKey: z.string().optional(),
  apiUrl: z.string().url().optional(),
  // Frontend sends 'baseUrl' instead of 'apiUrl'
  baseUrl: z.string().optional(),
  priority: z.number().int().min(1).optional().default(1),
  isActive: z.boolean().optional().default(true),
  // Frontend sends 'syncInterval'
  syncInterval: z.number().int().optional(),
  rateLimitPerMin: z.number().int().positive().optional(),
  quotaLimit: z.number().int().positive().nullable().optional(),
  config: z.record(z.unknown()).optional(),
});
export type CreateOddsProviderInput = z.infer<typeof createOddsProviderSchema>;

// =============================================================================
// Promotions Management
// =============================================================================

// Accept both uppercase (backend enum) and lowercase (frontend) promo types
const promoTypeSchema = z.string().transform((v) => v.toUpperCase()).pipe(
  z.enum(['DEPOSIT_BONUS', 'FREE_BET', 'ODDS_BOOST', 'CASHBACK', 'TOURNAMENT', 'CUSTOM']),
);

// conditions can be a JSON object or a free-text string from the frontend
const conditionsSchema = z.union([z.string(), z.record(z.unknown())]).optional();

export const createPromotionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  type: promoTypeSchema,
  code: z.string().max(50).optional(),
  image: z.string().url().optional(),
  conditions: conditionsSchema,
  reward: z.record(z.unknown()).optional(),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid start date'),
  endDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid end date'),
  isActive: z.boolean().optional().default(true),
  active: z.boolean().optional(),
  maxClaims: z.number().int().positive().optional(),
  // Frontend flat fields (mapped to nested conditions/reward in route handler)
  rewardType: z.string().optional(),
  rewardValue: z.number().optional(),
  maxBonus: z.number().optional(),
  wageringRequirement: z.number().optional(),
});
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

export const updatePromotionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  type: promoTypeSchema.optional(),
  code: z.string().max(50).nullable().optional(),
  image: z.string().url().nullable().optional(),
  conditions: conditionsSchema,
  reward: z.record(z.unknown()).optional(),
  startDate: z.string().refine((v) => !isNaN(Date.parse(v))).optional(),
  endDate: z.string().refine((v) => !isNaN(Date.parse(v))).optional(),
  isActive: z.boolean().optional(),
  active: z.boolean().optional(),
  maxClaims: z.number().int().positive().nullable().optional(),
  // Frontend flat fields (mapped to nested conditions/reward in route handler)
  rewardType: z.string().optional(),
  rewardValue: z.number().optional(),
  maxBonus: z.number().optional(),
  wageringRequirement: z.number().optional(),
});
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

export const listPromotionsQuerySchema = paginationSchema.extend({
  type: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});
export type ListPromotionsQuery = z.infer<typeof listPromotionsQuerySchema>;

// =============================================================================
// VIP Management
// =============================================================================

export const listVipTiersQuerySchema = paginationSchema;
export type ListVipTiersQuery = z.infer<typeof listVipTiersQuerySchema>;

export const updateVipTierSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  minWagered: z.number().min(0).optional(),
  rakebackPercent: z.number().min(0).max(100).optional(),
  turboBoostPercent: z.number().min(0).max(100).optional(),
  turboDurationMin: z.number().int().positive().optional(),
  dailyBonusMax: z.number().min(0).optional(),
  weeklyBonusMax: z.number().min(0).nullable().optional(),
  monthlyBonusMax: z.number().min(0).nullable().optional(),
  levelUpReward: z.number().min(0).optional(),
  calendarSplitPercent: z.number().min(0).max(100).optional(),
  maxLevelUpReward: z.number().min(0).nullable().optional(),
  benefits: z.record(z.unknown()).optional(),
});
export type UpdateVipTierInput = z.infer<typeof updateVipTierSchema>;

export const assignVipTierSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  tier: z.enum([
    'BRONZE', 'SILVER', 'GOLD', 'PLATINUM',
    'DIAMOND', 'ELITE', 'BLACK_DIAMOND', 'BLUE_DIAMOND',
  ]),
  reason: z.string().min(1, 'Reason is required').max(1000),
});
export type AssignVipTierInput = z.infer<typeof assignVipTierSchema>;

// =============================================================================
// Content Management
// =============================================================================

export const createBlogPostSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  excerpt: z.string().max(1000).optional(),
  featuredImage: z.string().url().optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional().default([]),
  isPublished: z.boolean().optional().default(false),
});
export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;

export const updateBlogPostSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(1000).nullable().optional(),
  featuredImage: z.string().url().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;

export const listBlogPostsQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  isPublished: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});
export type ListBlogPostsQuery = z.infer<typeof listBlogPostsQuerySchema>;

export const createHelpArticleSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  category: z.string().min(1).max(100),
  tags: z.array(z.string()).optional().default([]),
  sortOrder: z.number().int().optional().default(0),
  isPublished: z.boolean().optional().default(true),
});
export type CreateHelpArticleInput = z.infer<typeof createHelpArticleSchema>;

export const updateHelpArticleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(1).optional(),
  category: z.string().min(1).max(100).optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateHelpArticleInput = z.infer<typeof updateHelpArticleSchema>;

export const listHelpArticlesQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  isPublished: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});
export type ListHelpArticlesQuery = z.infer<typeof listHelpArticlesQuerySchema>;

export const createCourseSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/),
  description: z.string().min(1),
  thumbnail: z.string().url().optional(),
  category: z.string().max(100).optional(),
  difficulty: z.string().max(50).optional(),
  isPublished: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().min(1).optional(),
  thumbnail: z.string().url().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  difficulty: z.string().max(50).nullable().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const listCoursesQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  difficulty: z.string().optional(),
  isPublished: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().optional(),
});
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

export const createLessonSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  videoUrl: z.string().url().optional(),
  sortOrder: z.number().int(),
  duration: z.number().int().positive().optional(),
});
export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().min(1).optional(),
  videoUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
  duration: z.number().int().positive().nullable().optional(),
});
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

// =============================================================================
// Site Settings
// =============================================================================

export const updateSiteConfigSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.unknown(),
  description: z.string().max(1000).optional(),
});
export type UpdateSiteConfigInput = z.infer<typeof updateSiteConfigSchema>;

export const addGeoRestrictionSchema = z.object({
  countryCode: z.string().length(2, 'Country code must be 2 characters'),
  countryName: z.string().min(1).max(200),
  reason: z.string().max(1000).optional(),
});
export type AddGeoRestrictionInput = z.infer<typeof addGeoRestrictionSchema>;

export const maintenanceModeSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(2000).optional(),
  allowedIps: z.array(z.string()).optional(),
  estimatedEndTime: z.string().optional(),
});
export type MaintenanceModeInput = z.infer<typeof maintenanceModeSchema>;

// =============================================================================
// Reports
// =============================================================================

export const revenueReportQuerySchema = dateRangeSchema.extend({
  groupBy: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'day' || v === 'week' || v === 'month') return v;
      return 'day';
    }),
  currency: z.string().optional(),
});
export type RevenueReportQuery = z.infer<typeof revenueReportQuerySchema>;

export const gameReportQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  gameSlug: z.string().optional(),
  gameType: z.string().optional(),
});
export type GameReportQuery = z.infer<typeof gameReportQuerySchema>;

export const userActivityReportQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  userId: z.string().optional(),
  activityType: z.string().optional(),
});
export type UserActivityReportQuery = z.infer<typeof userActivityReportQuerySchema>;

// =============================================================================
// Audit Logs
// =============================================================================

export const listAuditLogsQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  action: z.string().optional(),
  adminId: z.string().optional(),
  userId: z.string().optional(),
  resource: z.string().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

// =============================================================================
// Alerts
// =============================================================================

export const listAlertsQuerySchema = paginationSchema.extend({
  severity: z.string().optional(),
  type: z.string().optional(),
  isResolved: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
