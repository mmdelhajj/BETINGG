import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const emailSchema = z
  .string()
  .email('Invalid email address')
  .transform((v) => v.toLowerCase().trim());

const totpTokenSchema = z
  .string()
  .regex(/^\d{6}$/, 'Token must be a 6-digit code');

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nickname: z
    .string()
    .min(3, 'Nickname must be at least 3 characters')
    .max(20, 'Nickname must be at most 20 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Nickname may only contain letters, numbers, hyphens, and underscores',
    ),
  dateOfBirth: z
    .string()
    .refine(
      (val) => {
        const d = new Date(val);
        if (isNaN(d.getTime())) return false;
        // Must be at least 18 years old
        const now = new Date();
        const age = now.getFullYear() - d.getFullYear();
        const monthDiff = now.getMonth() - d.getMonth();
        const dayDiff = now.getDate() - d.getDate();
        const actualAge =
          monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        return actualAge >= 18;
      },
      { message: 'You must be at least 18 years old to register' },
    ),
  promoCode: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

// ---------------------------------------------------------------------------
// Forgot Password
// ---------------------------------------------------------------------------

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ---------------------------------------------------------------------------
// Reset Password
// ---------------------------------------------------------------------------

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---------------------------------------------------------------------------
// 2FA Setup Verify
// ---------------------------------------------------------------------------

export const twoFactorSetupVerifySchema = z.object({
  token: totpTokenSchema,
});

export type TwoFactorSetupVerifyInput = z.infer<typeof twoFactorSetupVerifySchema>;

// ---------------------------------------------------------------------------
// 2FA Verify (login flow)
// ---------------------------------------------------------------------------

export const twoFactorVerifySchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  token: z
    .string()
    .min(1, 'Token is required')
    .refine(
      (val) => /^\d{6}$/.test(val) || /^[a-zA-Z0-9]{8}$/.test(val),
      { message: 'Token must be a 6-digit TOTP code or an 8-character backup code' },
    ),
});

export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;

// ---------------------------------------------------------------------------
// 2FA Disable
// ---------------------------------------------------------------------------

export const twoFactorDisableSchema = z.object({
  token: totpTokenSchema,
  password: z.string().min(1, 'Password is required'),
});

export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;
