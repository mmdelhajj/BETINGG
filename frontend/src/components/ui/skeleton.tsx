'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Base Skeleton
// ---------------------------------------------------------------------------

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Shimmer animation (default true) */
  animate?: boolean;
}

function Skeleton({ className, animate = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded bg-background-elevated',
        animate && 'animate-pulse',
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton Text
// ---------------------------------------------------------------------------

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

function SkeletonText({
  lines = 3,
  className,
  lastLineWidth = '60%',
}: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={i === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Circle
// ---------------------------------------------------------------------------

interface SkeletonCircleProps {
  size?: number;
  className?: string;
}

function SkeletonCircle({ size = 40, className }: SkeletonCircleProps) {
  return (
    <Skeleton
      className={cn('rounded-full shrink-0', className)}
      style={{ width: size, height: size }}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------

interface SkeletonCardProps {
  className?: string;
  hasImage?: boolean;
}

function SkeletonCard({ className, hasImage = false }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'bg-background-card border border-border rounded-card overflow-hidden',
        className,
      )}
    >
      {hasImage && <Skeleton className="h-40 w-full rounded-none" />}
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <SkeletonText lines={2} />
        <div className="flex items-center gap-2 pt-2">
          <SkeletonCircle size={24} />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Table Row
// ---------------------------------------------------------------------------

interface SkeletonTableRowProps {
  columns?: number;
  className?: string;
}

function SkeletonTableRow({ columns = 5, className }: SkeletonTableRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 border-b border-border',
        className,
      )}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 flex-1"
          style={{
            maxWidth: i === 0 ? '200px' : i === columns - 1 ? '80px' : '120px',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Table
// ---------------------------------------------------------------------------

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

function SkeletonTable({
  rows = 5,
  columns = 5,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('bg-background-card border border-border rounded-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-4 p-3 border-b border-border bg-background-elevated">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3 flex-1"
            style={{
              maxWidth: i === 0 ? '200px' : i === columns - 1 ? '80px' : '120px',
            }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Event Card (sportsbook specific)
// ---------------------------------------------------------------------------

function SkeletonEventCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-background-card border border-border rounded-card p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SkeletonCircle size={20} />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-16 rounded-button" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonCircle size={20} />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-16 rounded-button" />
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonEventCard,
};
