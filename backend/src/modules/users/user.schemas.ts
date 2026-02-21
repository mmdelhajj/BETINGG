import { z } from 'zod';

// ---------------------------------------------------------------------------
// Update profile
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  nickname: z
    .string()
    .min(3, 'Nickname must be at least 3 characters')
    .max(20, 'Nickname must be at most 20 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Nickname may only contain letters, numbers, hyphens, and underscores',
    )
    .optional(),
  avatar: z.string().url('Avatar must be a valid URL').optional().nullable(),
  dateOfBirth: z
    .string()
    .refine(
      (val) => {
        const d = new Date(val);
        if (isNaN(d.getTime())) return false;
        const now = new Date();
        const age = now.getFullYear() - d.getFullYear();
        const monthDiff = now.getMonth() - d.getMonth();
        const dayDiff = now.getDate() - d.getDate();
        const actualAge =
          monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        return actualAge >= 18;
      },
      { message: 'You must be at least 18 years old' },
    )
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// Update preferences
// ---------------------------------------------------------------------------

export const updatePreferencesSchema = z.object({
  theme: z.enum(['DARK', 'LIGHT', 'CLASSIC']).optional(),
  language: z
    .string()
    .min(2, 'Language code must be at least 2 characters')
    .max(10, 'Language code must be at most 10 characters')
    .optional(),
  oddsFormat: z.enum(['DECIMAL', 'FRACTIONAL', 'AMERICAN']).optional(),
  timezone: z.string().max(50).optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number'),
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// Activity log query
// ---------------------------------------------------------------------------

export const activityLogQuerySchema = z.object({
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
});

export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>;

// ---------------------------------------------------------------------------
// Responsible gambling settings
// ---------------------------------------------------------------------------

export const responsibleGamblingSchema = z.object({
  depositLimit: z
    .object({
      daily: z.number().min(0).optional(),
      weekly: z.number().min(0).optional(),
      monthly: z.number().min(0).optional(),
    })
    .optional(),
  lossLimit: z
    .object({
      daily: z.number().min(0).optional(),
      weekly: z.number().min(0).optional(),
      monthly: z.number().min(0).optional(),
    })
    .optional(),
  sessionTimeout: z
    .number()
    .int()
    .min(15, 'Session timeout must be at least 15 minutes')
    .max(1440, 'Session timeout cannot exceed 24 hours (1440 minutes)')
    .optional()
    .nullable(),
  realityCheckInterval: z
    .number()
    .int()
    .min(15, 'Reality check interval must be at least 15 minutes')
    .max(240, 'Reality check interval cannot exceed 4 hours (240 minutes)')
    .optional()
    .nullable(),
});

export type ResponsibleGamblingInput = z.infer<typeof responsibleGamblingSchema>;

// ---------------------------------------------------------------------------
// Cooling-off
// ---------------------------------------------------------------------------

export const coolingOffSchema = z.object({
  duration: z.enum(['24h', '1week', '1month'], {
    required_error: 'Duration is required',
    invalid_type_error: 'Duration must be one of: 24h, 1week, 1month',
  }),
});

export type CoolingOffInput = z.infer<typeof coolingOffSchema>;

// ---------------------------------------------------------------------------
// Self-exclusion
// ---------------------------------------------------------------------------

export const selfExclusionSchema = z.object({
  duration: z.enum(['6months', '1year', 'permanent'], {
    required_error: 'Duration is required',
    invalid_type_error: 'Duration must be one of: 6months, 1year, permanent',
  }),
});

export type SelfExclusionInput = z.infer<typeof selfExclusionSchema>;

// ---------------------------------------------------------------------------
// Admin: List users query
// ---------------------------------------------------------------------------

export const adminListUsersQuerySchema = z.object({
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
  search: z.string().optional(),
  vipTier: z
    .enum([
      'BRONZE',
      'SILVER',
      'GOLD',
      'PLATINUM',
      'DIAMOND',
      'ELITE',
      'BLACK_DIAMOND',
      'BLUE_DIAMOND',
    ])
    .optional(),
  kycLevel: z.enum(['UNVERIFIED', 'BASIC', 'INTERMEDIATE', 'ADVANCED']).optional(),
  isBanned: z
    .string()
    .optional()
    .transform((v) => {
      if (v === 'true') return true;
      if (v === 'false') return false;
      return undefined;
    }),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;

// ---------------------------------------------------------------------------
// Admin: User ID param
// ---------------------------------------------------------------------------

export const userIdParamsSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;

// ---------------------------------------------------------------------------
// Admin: Ban user
// ---------------------------------------------------------------------------

export const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required').max(500),
});

export type BanUserInput = z.infer<typeof banUserSchema>;

// ---------------------------------------------------------------------------
// Admin: Adjust balance
// ---------------------------------------------------------------------------

export const adjustBalanceSchema = z.object({
  type: z.enum(['credit', 'debit'], {
    required_error: 'Adjustment type is required',
    invalid_type_error: 'Type must be "credit" or "debit"',
  }),
  currency: z.string().min(1, 'Currency symbol is required'),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(1_000_000, 'Amount exceeds maximum allowed'),
  reason: z.string().min(1, 'Reason is required for balance adjustments').max(500),
});

export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;

// ---------------------------------------------------------------------------
// Admin: Set VIP tier
// ---------------------------------------------------------------------------

export const setVipTierSchema = z.object({
  tier: z.enum([
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'DIAMOND',
    'ELITE',
    'BLACK_DIAMOND',
    'BLUE_DIAMOND',
  ]),
});

export type SetVipTierInput = z.infer<typeof setVipTierSchema>;

// ---------------------------------------------------------------------------
// Admin: Add note
// ---------------------------------------------------------------------------

export const addNoteSchema = z.object({
  note: z.string().min(1, 'Note content is required').max(2000),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;
