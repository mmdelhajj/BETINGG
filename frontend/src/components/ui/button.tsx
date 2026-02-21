'use client';

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-accent hover:bg-accent-hover text-white shadow-sm hover:shadow-md active:scale-[0.98]',
        secondary:
          'bg-background-elevated hover:bg-background-hover text-text border border-border hover:border-border-light active:scale-[0.98]',
        danger:
          'bg-danger hover:bg-danger-light text-white shadow-sm hover:shadow-md active:scale-[0.98]',
        ghost:
          'bg-transparent hover:bg-background-elevated text-text-secondary hover:text-text',
        outline:
          'bg-transparent border border-border hover:border-accent text-text hover:text-accent-light hover:bg-accent/5 active:scale-[0.98]',
        success:
          'bg-success hover:bg-success-light text-white shadow-sm hover:shadow-md active:scale-[0.98]',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-button gap-1.5',
        md: 'h-10 px-4 text-sm rounded-button gap-2',
        lg: 'h-12 px-6 text-base rounded-button gap-2.5',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
