'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors duration-200 select-none',
  {
    variants: {
      variant: {
        // Status badges
        success:
          'bg-success/15 text-success border border-success/25',
        danger:
          'bg-danger/15 text-danger border border-danger/25',
        warning:
          'bg-warning/15 text-warning border border-warning/25',
        info:
          'bg-info/15 text-info border border-info/25',
        default:
          'bg-background-elevated text-text-secondary border border-border',
        // VIP tier badges
        bronze:
          'bg-amber-900/20 text-amber-500 border border-amber-700/30',
        silver:
          'bg-slate-400/15 text-slate-300 border border-slate-500/30',
        gold:
          'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        platinum:
          'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        diamond:
          'bg-violet-500/15 text-violet-300 border border-violet-500/30',
        elite:
          'bg-rose-500/15 text-rose-300 border border-rose-500/30',
        'black-diamond':
          'bg-gray-800/50 text-white border border-gray-600/50',
        'blue-diamond':
          'bg-blue-500/15 text-blue-300 border border-blue-500/30',
        // Special
        live:
          'bg-danger/15 text-danger border border-danger/25',
        accent:
          'bg-accent/15 text-accent-light border border-accent/25',
      },
      size: {
        xs: 'text-[10px] px-1.5 py-0.5 rounded',
        sm: 'text-xs px-2 py-0.5 rounded',
        md: 'text-xs px-2.5 py-1 rounded-button',
        lg: 'text-sm px-3 py-1 rounded-button',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

function Badge({
  className,
  variant,
  size,
  dot,
  pulse,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span className="relative mr-1.5">
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              variant === 'success' && 'bg-success',
              variant === 'danger' && 'bg-danger',
              variant === 'warning' && 'bg-warning',
              variant === 'info' && 'bg-info',
              variant === 'live' && 'bg-danger',
              (!variant || variant === 'default') && 'bg-text-muted',
            )}
          />
          {pulse && (
            <span
              className={cn(
                'absolute inset-0 inline-block h-1.5 w-1.5 rounded-full animate-ping',
                variant === 'success' && 'bg-success',
                variant === 'danger' && 'bg-danger',
                variant === 'warning' && 'bg-warning',
                variant === 'info' && 'bg-info',
                variant === 'live' && 'bg-danger',
                (!variant || variant === 'default') && 'bg-text-muted',
              )}
            />
          )}
        </span>
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
