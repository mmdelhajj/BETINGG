'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  rowKey?: (row: T, index: number) => string;
  emptyMessage?: string;
  headerExtra?: React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  compact?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-background-elevated', className)}
    />
  );
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  sortField,
  sortDir = 'asc',
  onSort,
  page = 1,
  totalPages = 1,
  total,
  onPageChange,
  rowKey,
  emptyMessage = 'No data found.',
  headerExtra,
  rowActions,
  onRowClick,
  compact = false,
  className,
}: DataTableProps<T>) {
  const cellPadding = compact ? 'py-2 px-3' : 'py-3 px-4';
  const headerPadding = compact ? 'py-2 px-3' : 'py-3 px-4';

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-accent" />
    ) : (
      <ArrowDown className="w-3 h-3 text-accent" />
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <CardFooter className="px-4">
        <p className="text-xs text-text-muted">
          Page {page} of {totalPages}
          {total !== undefined && ` (${total.toLocaleString()} total)`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 5) {
              p = i + 1;
            } else if (page <= 3) {
              p = i + 1;
            } else if (page >= totalPages - 2) {
              p = totalPages - 4 + i;
            } else {
              p = page - 2 + i;
            }
            return (
              <button
                key={p}
                onClick={() => onPageChange?.(p)}
                className={cn(
                  'h-8 w-8 rounded-button text-xs font-medium transition-colors',
                  p === page
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:bg-background-elevated',
                )}
              >
                {p}
              </button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardFooter>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search + extra header */}
      {(searchable || headerExtra) && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {searchable && onSearchChange && (
            <div className="flex-1 w-full sm:max-w-sm">
              <Input
                placeholder={searchPlaceholder}
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                prefixIcon={<Search className="w-4 h-4" />}
                className="bg-background"
              />
            </div>
          )}
          {headerExtra && (
            <div className="flex items-center gap-2 flex-wrap">{headerExtra}</div>
          )}
        </div>
      )}

      {/* Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background-elevated/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      headerPadding,
                      'text-xs font-medium text-text-muted uppercase tracking-wider whitespace-nowrap',
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                          ? 'text-right'
                          : 'text-left',
                      col.sortable && onSort && 'cursor-pointer hover:text-text',
                    )}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() =>
                      col.sortable && onSort ? onSort(col.key) : undefined
                    }
                  >
                    {col.sortable && onSort ? (
                      <span
                        className={cn(
                          'flex items-center gap-1',
                          col.align === 'right' && 'justify-end',
                          col.align === 'center' && 'justify-center',
                        )}
                      >
                        {col.header}
                        <SortIcon field={col.key} />
                      </span>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
                {rowActions && (
                  <th
                    className={cn(
                      headerPadding,
                      'text-right text-xs font-medium text-text-muted uppercase tracking-wider',
                    )}
                  >
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {columns.map((col) => (
                      <td key={col.key} className={cellPadding}>
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </td>
                    ))}
                    {rowActions && (
                      <td className={cellPadding}>
                        <Skeleton className="h-7 w-20 ml-auto" />
                      </td>
                    )}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (rowActions ? 1 : 0)}
                    className="py-16 text-center text-text-muted"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr
                    key={rowKey ? rowKey(row, idx) : idx}
                    className={cn(
                      'border-b border-border/50 hover:bg-background-elevated/30 transition-colors',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          cellPadding,
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                              ? 'text-right'
                              : 'text-left',
                        )}
                      >
                        {col.render
                          ? col.render(row, idx)
                          : (row[col.key] as React.ReactNode) ?? '-'}
                      </td>
                    ))}
                    {rowActions && (
                      <td className={cn(cellPadding, 'text-right')}>
                        <div className="flex items-center gap-1 justify-end">
                          {rowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && renderPagination()}
      </Card>
    </div>
  );
}
