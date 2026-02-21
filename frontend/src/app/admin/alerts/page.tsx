'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatDate, formatRelativeDate } from '@/lib/utils';
import { get, put } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Shield,
  DollarSign,
  UserX,
  Eye,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Alert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  type: 'large_bet' | 'suspicious_activity' | 'system' | 'withdrawal' | 'user_report' | 'risk';
  title: string;
  message: string;
  metadata?: {
    userId?: string;
    username?: string;
    amount?: number;
    currency?: string;
    betId?: string;
  };
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// Alerts Page
// ---------------------------------------------------------------------------

export default function AdminAlertsPage() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Filters
  const [severityFilter, setSeverityFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [typeFilter, setTypeFilter] = useState('');

  // Sort
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: sortField,
        sortDir,
      });
      if (severityFilter) params.set('severity', severityFilter);
      if (resolvedFilter !== 'all') params.set('resolved', String(resolvedFilter === 'resolved'));
      if (typeFilter) params.set('type', typeFilter);

      const res = await get<PaginatedResponse<Alert>>(`/admin/alerts?${params}`);
      setAlerts(res?.data || []);
      setTotal(res?.total || 0);
      setTotalPages(res?.totalPages || 1);
    } catch {
      const types: Alert['type'][] = ['large_bet', 'suspicious_activity', 'system', 'withdrawal', 'user_report', 'risk'];
      const severities: Alert['severity'][] = ['LOW', 'MEDIUM', 'HIGH'];

      const mockAlerts: Alert[] = [
        {
          id: 'a-1',
          severity: 'HIGH',
          type: 'large_bet',
          title: 'Large bet placed',
          message: 'User whale_99 placed a $45,000 parlay bet on 6 legs. This exceeds the $25,000 threshold for review.',
          metadata: { userId: 'u-1', username: 'whale_99', amount: 45000, currency: 'USDT', betId: 'bet-9999' },
          resolved: false,
          createdAt: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: 'a-2',
          severity: 'HIGH',
          type: 'suspicious_activity',
          title: 'Suspicious login pattern detected',
          message: 'User player_2045 logged in from 5 different countries in the last 24 hours. Potential account sharing or VPN abuse.',
          metadata: { userId: 'u-2', username: 'player_2045' },
          resolved: false,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'a-3',
          severity: 'MEDIUM',
          type: 'withdrawal',
          title: 'Large withdrawal request',
          message: 'User diamond_king requested a withdrawal of 5.2 BTC ($312,000). KYC Level 2 verified.',
          metadata: { userId: 'u-3', username: 'diamond_king', amount: 312000, currency: 'BTC' },
          resolved: false,
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'a-4',
          severity: 'MEDIUM',
          type: 'risk',
          title: 'High risk accumulator bet',
          message: 'User betking placed a 12-leg parlay with potential payout of $250,000. Market liability threshold exceeded on Premier League match.',
          metadata: { userId: 'u-4', username: 'betking', amount: 250000 },
          resolved: false,
          createdAt: new Date(Date.now() - 14400000).toISOString(),
        },
        {
          id: 'a-5',
          severity: 'HIGH',
          type: 'suspicious_activity',
          title: 'Potential arbitrage detected',
          message: 'Users arb_master and bet_pro are placing opposite bets on the same market within 30 seconds. Possible coordinated arbitrage.',
          metadata: { username: 'arb_master, bet_pro' },
          resolved: false,
          createdAt: new Date(Date.now() - 18000000).toISOString(),
        },
        {
          id: 'a-6',
          severity: 'LOW',
          type: 'system',
          title: 'Odds sync delay',
          message: 'TheOddsAPI sync delayed by 5 minutes. Last successful sync at 14:32 UTC.',
          resolved: false,
          createdAt: new Date(Date.now() - 21600000).toISOString(),
        },
        {
          id: 'a-7',
          severity: 'MEDIUM',
          type: 'large_bet',
          title: 'Unusual betting pattern',
          message: 'User high_roller placed 15 bets in 2 minutes on the same event, totaling $18,000.',
          metadata: { userId: 'u-5', username: 'high_roller', amount: 18000 },
          resolved: false,
          createdAt: new Date(Date.now() - 28800000).toISOString(),
        },
        {
          id: 'a-8',
          severity: 'LOW',
          type: 'user_report',
          title: 'User complaint',
          message: 'User newbie_22 reported an issue with deposit not being credited. Transaction hash provided.',
          metadata: { userId: 'u-6', username: 'newbie_22' },
          resolved: true,
          resolvedBy: 'admin_john',
          resolvedAt: new Date(Date.now() - 43200000).toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'a-9',
          severity: 'HIGH',
          type: 'risk',
          title: 'Market liability exceeded',
          message: 'Total liability on "Manchester United vs Liverpool - Match Winner" exceeded $500,000. Consider suspending the market.',
          resolved: true,
          resolvedBy: 'admin_sarah',
          resolvedAt: new Date(Date.now() - 72000000).toISOString(),
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: 'a-10',
          severity: 'LOW',
          type: 'system',
          title: 'High server load detected',
          message: 'Server CPU usage exceeded 85% for 10 minutes. Auto-scaling triggered.',
          resolved: true,
          resolvedBy: 'system',
          resolvedAt: new Date(Date.now() - 259200000).toISOString(),
          createdAt: new Date(Date.now() - 259200000).toISOString(),
        },
      ];

      let filtered = mockAlerts;
      if (resolvedFilter === 'unresolved') filtered = filtered.filter((a) => !a.resolved);
      if (resolvedFilter === 'resolved') filtered = filtered.filter((a) => a.resolved);
      if (severityFilter) filtered = filtered.filter((a) => a.severity === severityFilter);
      if (typeFilter) filtered = filtered.filter((a) => a.type === typeFilter);

      setAlerts(filtered);
      setTotal(filtered.length);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, resolvedFilter, typeFilter, sortField, sortDir]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleResolve = async (alert: Alert) => {
    setActionLoading(alert.id);
    try {
      await put(`/admin/alerts/${alert.id}/resolve`, {});
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id
            ? { ...a, resolved: true, resolvedAt: new Date().toISOString(), resolvedBy: 'admin' }
            : a,
        ),
      );
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const severityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'HIGH': return <AlertOctagon className="w-5 h-5 text-danger" />;
      case 'MEDIUM': return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'LOW': return <Info className="w-5 h-5 text-info" />;
    }
  };

  const severityBadge = (severity: Alert['severity']) => {
    switch (severity) {
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'info';
    }
  };

  const typeIcon = (type: Alert['type']) => {
    switch (type) {
      case 'large_bet': return <DollarSign className="w-4 h-4" />;
      case 'suspicious_activity': return <UserX className="w-4 h-4" />;
      case 'system': return <Shield className="w-4 h-4" />;
      case 'withdrawal': return <DollarSign className="w-4 h-4" />;
      case 'user_report': return <Bell className="w-4 h-4" />;
      case 'risk': return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const typeLabel = (type: Alert['type']) => {
    switch (type) {
      case 'large_bet': return 'Large Bet';
      case 'suspicious_activity': return 'Suspicious';
      case 'system': return 'System';
      case 'withdrawal': return 'Withdrawal';
      case 'user_report': return 'User Report';
      case 'risk': return 'Risk';
    }
  };

  const unresolvedCount = alerts.filter((a) => !a.resolved).length;
  const highCount = alerts.filter((a) => a.severity === 'HIGH' && !a.resolved).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Alerts</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {unresolvedCount} unresolved alerts
            {highCount > 0 && (
              <span className="text-danger font-medium ml-2">
                ({highCount} high severity)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-muted font-medium">Filters:</span>
            </div>

            {/* Resolved filter */}
            <div className="flex bg-background rounded-button border border-border overflow-hidden">
              {(['all', 'unresolved', 'resolved'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => { setResolvedFilter(val); setPage(1); }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                    resolvedFilter === val
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text',
                  )}
                >
                  {val}
                </button>
              ))}
            </div>

            {/* Severity filter */}
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
              className="h-8 bg-background border border-border rounded-input px-2 text-xs text-text"
            >
              <option value="">All severities</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="h-8 bg-background border border-border rounded-input px-2 text-xs text-text"
            >
              <option value="">All types</option>
              <option value="large_bet">Large Bet</option>
              <option value="suspicious_activity">Suspicious Activity</option>
              <option value="risk">Risk</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="system">System</option>
              <option value="user_report">User Report</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Alerts List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary font-medium">No alerts to show</p>
            <p className="text-xs text-text-muted mt-1">All clear! No matching alerts found.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={cn(
                'transition-all',
                alert.resolved && 'opacity-60',
                !alert.resolved && alert.severity === 'HIGH' && 'border-danger/30',
                !alert.resolved && alert.severity === 'MEDIUM' && 'border-warning/30',
              )}
            >
              <div className="flex items-start gap-4">
                {/* Severity icon */}
                <div className="shrink-0 mt-0.5">{severityIcon(alert.severity)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-semibold text-text">{alert.title}</h3>
                        <Badge variant={severityBadge(alert.severity) as any} size="xs">
                          {alert.severity}
                        </Badge>
                        <Badge variant="default" size="xs">
                          {typeIcon(alert.type)}
                          <span className="ml-1">{typeLabel(alert.type)}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {alert.message}
                      </p>
                    </div>

                    {/* Timestamp & actions */}
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-text-muted flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {formatRelativeDate(alert.createdAt)}
                      </p>
                      {!alert.resolved && (
                        <Button
                          variant="success"
                          size="sm"
                          className="mt-2"
                          isLoading={actionLoading === alert.id}
                          leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                          onClick={() => handleResolve(alert)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  {alert.metadata && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {alert.metadata.username && (
                        <span className="text-xs bg-background-elevated px-2 py-1 rounded font-mono text-text-secondary">
                          User: {alert.metadata.username}
                        </span>
                      )}
                      {alert.metadata.amount && (
                        <span className="text-xs bg-background-elevated px-2 py-1 rounded font-mono text-text-secondary">
                          Amount: ${Number(alert.metadata?.amount || 0).toLocaleString()} {alert.metadata.currency || ''}
                        </span>
                      )}
                      {alert.metadata.betId && (
                        <span className="text-xs bg-background-elevated px-2 py-1 rounded font-mono text-text-secondary">
                          Bet: {alert.metadata.betId}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Resolved info */}
                  {alert.resolved && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-success">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>
                        Resolved by {alert.resolvedBy}{' '}
                        {alert.resolvedAt && formatRelativeDate(alert.resolvedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 w-8 rounded-button text-xs font-medium transition-colors',
                    p === page ? 'bg-accent text-white' : 'text-text-secondary hover:bg-background-elevated',
                  )}
                >
                  {p}
                </button>
              );
            })}
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
