'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toastSuccess, toastError } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  function getRedirect(): string {
    if (typeof window === 'undefined') return '/';
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || '/';
  }
  const isLoading = useAuthStore((s) => s.isLoading);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login({ email: data.email, password: data.password });
      toastSuccess('Welcome back!');
      router.push(getRedirect());
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Invalid email or password';
      toastError(message);
    }
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    window.location.href = `${baseUrl}/api/auth/${provider}`;
  };

  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-card p-6 sm:p-8 shadow-2xl shadow-black/40 animate-fade-in">
      {/* Tab Toggle: Log in / Register */}
      <div className="flex mb-6 bg-[#0D1117] rounded-button p-1 border border-[#21262D]">
        <div className="flex-1 text-center py-2 text-sm font-semibold text-white bg-[#8B5CF6] rounded-[4px] shadow-sm cursor-default">
          Log In
        </div>
        <Link
          href="/register"
          className="flex-1 text-center py-2 text-sm font-medium text-[#484F58] hover:text-[#8B949E] rounded-[4px] transition-colors duration-200"
        >
          Register
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          prefixIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          className="bg-[#0D1117] border-[#21262D] text-[#E6EDF3] placeholder:text-[#484F58] focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]"
          {...register('email')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter your password"
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
          className="bg-[#0D1117] border-[#21262D] text-[#E6EDF3] placeholder:text-[#484F58] focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]"
          {...register('password')}
        />

        {/* Remember Me + Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#21262D] bg-[#0D1117] text-[#8B5CF6] focus:ring-[#8B5CF6] focus:ring-offset-0 cursor-pointer"
              {...register('rememberMe')}
            />
            <span className="text-sm text-[#8B949E] group-hover:text-[#E6EDF3] transition-colors duration-200">
              Remember me
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-[#8B5CF6] hover:underline transition-all duration-200"
          >
            Forgot password?
          </Link>
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
          Sign In
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

      {/* Sign Up Link */}
      <p className="text-center text-sm text-[#484F58] mt-6">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-[#8B5CF6] hover:underline font-medium transition-all duration-200"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
