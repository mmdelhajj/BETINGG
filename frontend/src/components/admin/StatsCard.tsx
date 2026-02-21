'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// StatsCard - Reusable admin statistics card
// ---------------------------------------------------------------------------

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  subtitle?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon: Icon,
  iconColor = 'text-accent',
  iconBg = 'bg-accent/15',
  subtitle,
  className,
}: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card hoverable className={className}>
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-text font-mono">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3 text-success shrink-0" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-danger shrink-0" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  isPositive ? 'text-success' : 'text-danger',
                )}
              >
                {isPositive ? '+' : ''}
                {change.toFixed(1)}%
              </span>
              <span className="text-xs text-text-muted truncate">{changeLabel}</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-text-muted truncate">{subtitle}</p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg shrink-0', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
    </Card>
  );
}
