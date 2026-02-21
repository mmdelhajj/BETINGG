'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, User, Calendar, Tag } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toastSuccess, toastError } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    nickname: z
      .string()
      .min(1, 'Nickname is required')
      .min(3, 'Nickname must be at least 3 characters')
      .max(20, 'Nickname must be at most 20 characters')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Only letters, numbers, hyphens and underscores',
      ),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    promoCode: z.string().optional(),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Password Strength
// ---------------------------------------------------------------------------

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2)
    return { score, label: 'Weak', color: 'bg-[#EF4444]', textColor: 'text-[#EF4444]' };
  if (score <= 4)
    return { score, label: 'Fair', color: 'bg-[#F59E0B]', textColor: 'text-[#F59E0B]' };
  return { score, label: 'Strong', color: 'bg-[#10B981]', textColor: 'text-[#10B981]' };
}

// ---------------------------------------------------------------------------
// Register Page
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPromoCode, setShowPromoCode] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      nickname: '',
      dateOfBirth: '',
      promoCode: '',
      termsAccepted: undefined as unknown as true,
    },
  });

  const passwordValue = watch('password');
  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordValue || ''),
    [passwordValue],
  );

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({
        email: data.email,
        password: data.password,
        username: data.nickname,
        referralCode: data.promoCode || undefined,
      });
      toastSuccess('Account created successfully! Welcome to CryptoBet.');
      router.push('/');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to create account';
      toastError(message);
    }
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.location.href = `${baseUrl}/api/auth/${provider}`;
  };

  const inputClassName =
    'bg-[#0D1117] border-[#21262D] text-[#E6EDF3] placeholder:text-[#484F58] focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]';

  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-card p-6 sm:p-8 shadow-2xl shadow-black/40 animate-fade-in">
      {/* Tab Toggle: Log in / Register */}
      <div className="flex mb-6 bg-[#0D1117] rounded-button p-1 border border-[#21262D]">
        <Link
          href="/login"
          className="flex-1 text-center py-2 text-sm font-medium text-[#484F58] hover:text-[#8B949E] rounded-[4px] transition-colors duration-200"
        >
          Log In
        </Link>
        <div className="flex-1 text-center py-2 text-sm font-semibold text-white bg-[#8B5CF6] rounded-[4px] shadow-sm cursor-default">
          Register
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          prefixIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          className={inputClassName}
          {...register('email')}
        />

        <Input
          label="Nickname"
          type="text"
          placeholder="coolbettor"
          prefixIcon={<User className="h-4 w-4" />}
          error={errors.nickname?.message}
          hint="3-20 characters, letters, numbers, hyphens, underscores"
          className={inputClassName}
          {...register('nickname')}
        />

        {/* Password with Strength Indicator */}
        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a strong password"
            prefixIcon={<Lock className="h-4 w-4" />}
            suffixIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#484F58] hover:text-[#E6EDF3] transition-colors duration-200"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
            error={errors.password?.message}
            className={inputClassName}
            {...register('password')}
          />
          {/* Strength Indicator */}
          {passwordValue && passwordValue.length > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((segment) => (
                    <div
                      key={segment}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        segment <= passwordStrength.score
                          ? passwordStrength.color
                          : 'bg-[#21262D]',
                      )}
                    />
                  ))}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium min-w-[40px] text-right',
                    passwordStrength.textColor,
                  )}
                >
                  {passwordStrength.label}
                </span>
              </div>
            </div>
          )}
        </div>

        <Input
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Confirm your password"
          prefixIcon={<Lock className="h-4 w-4" />}
          suffixIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="text-[#484F58] hover:text-[#E6EDF3] transition-colors duration-200"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
          error={errors.confirmPassword?.message}
          className={inputClassName}
          {...register('confirmPassword')}
        />

        <Input
          label="Date of Birth"
          type="date"
          prefixIcon={<Calendar className="h-4 w-4" />}
          error={errors.dateOfBirth?.message}
          className={inputClassName}
          {...register('dateOfBirth')}
        />

        {/* Promo Code Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowPromoCode(!showPromoCode)}
            className="text-sm text-[#8B5CF6] hover:underline transition-all duration-200 flex items-center gap-1.5"
          >
            <Tag className="h-3.5 w-3.5" />
            {showPromoCode ? 'Hide promo code' : 'I have a promo code'}
          </button>
          {showPromoCode && (
            <div className="mt-2 animate-slide-down">
              <Input
                type="text"
                placeholder="Enter promo code"
                prefixIcon={<Tag className="h-4 w-4" />}
                className={inputClassName}
                {...register('promoCode')}
              />
            </div>
          )}
        </div>

        {/* Terms Checkbox */}
        <div>
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[#21262D] bg-[#0D1117] text-[#8B5CF6] focus:ring-[#8B5CF6] focus:ring-offset-0 cursor-pointer"
              {...register('termsAccepted')}
            />
            <span className="text-sm text-[#8B949E] leading-relaxed group-hover:text-[#E6EDF3] transition-colors duration-200">
              I am at least 18 years old and agree to the{' '}
              <Link
                href="/terms"
                className="text-[#8B5CF6] hover:underline transition-all duration-200"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="text-[#8B5CF6] hover:underline transition-all duration-200"
              >
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="mt-1.5 text-xs text-[#EF4444]">
              {errors.termsAccepted.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[#8B5CF6]/30 transition-all duration-200"
        >
          Create Account
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#21262D]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[#161B22] px-3 text-[#484F58] uppercase tracking-wider font-medium">
            or continue with
          </span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          className="flex items-center justify-center gap-2.5 h-11 px-4 bg-[#0D1117] hover:bg-[#1C2128] text-[#E6EDF3] text-sm font-medium rounded-button border border-[#21262D] hover:border-[#30363D] transition-all duration-200 active:scale-[0.97]"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>

        <button
          type="button"
          onClick={() => handleOAuth('github')}
          className="flex items-center justify-center gap-2.5 h-11 px-4 bg-[#0D1117] hover:bg-[#1C2128] text-[#E6EDF3] text-sm font-medium rounded-button border border-[#21262D] hover:border-[#30363D] transition-all duration-200 active:scale-[0.97]"
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          GitHub
        </button>
      </div>

      {/* Sign In Link */}
      <p className="text-center text-sm text-[#484F58] mt-6">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-[#8B5CF6] hover:underline font-medium transition-all duration-200"
        >
          Sign In
        </Link>
      </p>
    </div>
  );
}
