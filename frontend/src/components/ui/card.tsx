'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noBorder?: boolean;
  noPadding?: boolean;
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevated, noBorder, noPadding, hoverable, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-card',
          elevated ? 'bg-background-elevated' : 'bg-background-card',
          !noBorder && 'border border-border',
          !noPadding && 'p-4',
          hoverable &&
            'transition-all duration-200 hover:border-border-light hover:shadow-lg cursor-pointer',
          className,
        )}
        {...props}
      />
    );
  },
);

Card.displayName = 'Card';

// ---------------------------------------------------------------------------
// Card Header
// ---------------------------------------------------------------------------

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  noBorder?: boolean;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, noBorder, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between',
          !noBorder && 'border-b border-border pb-3 mb-3',
          className,
        )}
        {...props}
      />
    );
  },
);

CardHeader.displayName = 'CardHeader';

// ---------------------------------------------------------------------------
// Card Title
// ---------------------------------------------------------------------------

const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn('text-sm font-semibold text-text', className)}
      {...props}
    />
  );
});

CardTitle.displayName = 'CardTitle';

// ---------------------------------------------------------------------------
// Card Body
// ---------------------------------------------------------------------------

const CardBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('', className)} {...props} />;
});

CardBody.displayName = 'CardBody';

// ---------------------------------------------------------------------------
// Card Footer
// ---------------------------------------------------------------------------

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  noBorder?: boolean;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, noBorder, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between',
          !noBorder && 'border-t border-border pt-3 mt-3',
          className,
        )}
        {...props}
      />
    );
  },
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardBody, CardFooter };
