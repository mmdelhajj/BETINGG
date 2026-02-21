'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { post } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toastSuccess, toastError } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// ---------------------------------------------------------------------------
// Forgot Password Page
// ---------------------------------------------------------------------------

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    try {
      await post('/auth/forgot-password', { email: data.email });
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      toastSuccess('Reset link sent! Check your email.');
    } catch (err: unknown) {
      // Always show success to prevent email enumeration
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="bg-[#161B22] border border-[#21262D] rounded-card p-6 sm:p-8 shadow-2xl shadow-black/40 animate-fade-in">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#10B981]/10 border border-[#10B981]/20 mb-5">
            <CheckCircle className="h-7 w-7 text-[#10B981]" />
          </div>
          <h1 className="text-xl font-bold text-[#E6EDF3] mb-2">
            Check Your Email
          </h1>
          <p className="text-sm text-[#8B949E] leading-relaxed mb-6">
            We&apos;ve sent a password reset link to{' '}
            <span className="text-[#E6EDF3] font-medium">{submittedEmail}</span>.
            Please check your inbox and follow the instructions.
          </p>
          <p className="text-xs text-[#484F58] mb-6">
            Didn&apos;t receive it? Check your spam folder or try again in a few
            minutes.
          </p>
          <div className="space-y-3">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => {
                setIsSubmitted(false);
                setSubmittedEmail('');
              }}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[#8B5CF6]/30 transition-all duration-200"
            >
              Try Another Email
            </Button>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors duration-200 py-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-card p-6 sm:p-8 shadow-2xl shadow-black/40 animate-fade-in">
      {/* Lock Icon */}
      <div className="text-center mb-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 mb-5">
          <svg
            className="h-6 w-6 text-[#8B5CF6]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#E6EDF3]">Forgot Password?</h1>
        <p className="text-sm text-[#8B949E] mt-2 leading-relaxed">
          No worries! Enter your email address and we&apos;ll send you a link to
          reset your password.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          prefixIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          className="bg-[#0D1117] border-[#21262D] text-[#E6EDF3] placeholder:text-[#484F58] focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]"
          {...register('email')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[#8B5CF6]/30 transition-all duration-200"
        >
          Send Reset Link
        </Button>
      </form>

      {/* Back to Login */}
      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
