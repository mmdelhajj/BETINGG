'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  prefixText?: string;
  suffixText?: string;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      prefixIcon,
      suffixIcon,
      prefixText,
      suffixText,
      containerClassName,
      type = 'text',
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefixIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              {prefixIcon}
            </div>
          )}
          {prefixText && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
              {prefixText}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              'w-full h-10 bg-background-card border rounded-input px-3 text-sm text-text placeholder:text-text-muted',
              'transition-all duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-danger focus:ring-danger/50 focus:border-danger'
                : 'border-border hover:border-border-light',
              prefixIcon && 'pl-10',
              prefixText && 'pl-10',
              suffixIcon && 'pr-10',
              suffixText && 'pr-10',
              className,
            )}
            {...props}
          />
          {suffixIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {suffixIcon}
            </div>
          )}
          {suffixText && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">
              {suffixText}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-danger flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 16A8 8 0 108 0a8 8 0 000 16zM8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"
              />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-text-muted">{hint}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
