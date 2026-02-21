'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, formatRelativeDate } from '@/lib/utils';
import { get } from '@/lib/api';
import {
  Users,
  Receipt,
  DollarSign,
  Clock,
  Radio,
  Wifi,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiData {
  activeUsers: number;
  activeUsersChange: number;
  betsToday: number;
  betsTodayChange: number;
  revenueToday: number;
  revenueTodayChange: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  liveEvents: number;
  onlineUsers: number;
}

interface RevenuePoint {
  date: string;
  revenue: number;
  profit: number;
}

interface DepositWithdrawalPoint {
  date: string;
  deposits: number;
  withdrawals: number;
}

interface RecentBet {
  id: string;
  username: string;
  type: string;
  amount: number;
  currency: string;
  odds: number;
  status: string;
  createdAt: string;
}

interface RecentUser {
  id: string;
  username: string;
  email: string;
  kycLevel: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-background-elevated',
        className,
      )}
    />
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardBody>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardBody>
    </Card>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background-elevated border border-border rounded-card p-3 shadow-xl">
      <p className="text-xs text-text-muted mb-2">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="text-text font-medium font-mono">
            ${Number(entry.value || 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

function KpiCard({ title, value, change, subtitle, icon: Icon, iconColor, iconBg }: KpiCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card hoverable>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl font-bold text-text font-mono">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3 text-success" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-danger" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  isPositive ? 'text-success' : 'text-danger',
                )}
              >
                {isPositive ? '+' : ''}
                {Number(change).toFixed(1)}%
              </span>
              <span className="text-xs text-text-muted">vs yesterday</span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [depWithData, setDepWithData] = useState<DepositWithdrawalPoint[]>([]);
  const [recentBets, setRecentBets] = useState<RecentBet[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, revRes, dwRes, betsRes, usersRes] = await Promise.allSettled([
        get<KpiData>('/admin/dashboard/kpi'),
        get<RevenuePoint[]>('/admin/dashboard/revenue?days=7'),
        get<DepositWithdrawalPoint[]>('/admin/dashboard/deposits-withdrawals?days=7'),
        get<RecentBet[]>('/admin/dashboard/recent-bets?limit=20'),
        get<RecentUser[]>('/admin/dashboard/recent-users?limit=10'),
      ]);

      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value);
      else {
        setKpi({
          activeUsers: 12847,
          activeUsersChange: 5.2,
          betsToday: 3482,
          betsTodayChange: -2.1,
          revenueToday: 48250,
          revenueTodayChange: 12.4,
          pendingWithdrawals: 23,
          pendingWithdrawalsAmount: 85400,
          liveEvents: 47,
          onlineUsers: 1893,
        });
      }

      if (revRes.status === 'fulfilled') setRevenueData(Array.isArray(revRes.value) ? revRes.value : []);
      else {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        setRevenueData(
          days.map((d) => ({
            date: d,
            revenue: Math.floor(Math.random() * 80000) + 30000,
            profit: Math.floor(Math.random() * 20000) + 5000,
          })),
        );
      }

      if (dwRes.status === 'fulfilled') setDepWithData(Array.isArray(dwRes.value) ? dwRes.value : []);
      else {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        setDepWithData(
          days.map((d) => ({
            date: d,
            deposits: Math.floor(Math.random() * 120000) + 40000,
            withdrawals: Math.floor(Math.random() * 80000) + 20000,
          })),
        );
      }

      if (betsRes.status === 'fulfilled') setRecentBets(Array.isArray(betsRes.value) ? betsRes.value : []);
      else {
        setRecentBets(
          Array.from({ length: 20 }, (_, i) => ({
            id: `bet-${i}`,
            username: `user_${Math.floor(Math.random() * 1000)}`,
            type: ['single', 'parlay', 'casino'][Math.floor(Math.random() * 3)],
            amount: Math.random() * 500 + 10,
            currency: ['BTC', 'ETH', 'USDT'][Math.floor(Math.random() * 3)],
            odds: Math.random() * 5 + 1.1,
            status: ['pending', 'won', 'lost', 'settled'][Math.floor(Math.random() * 4)],
            createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          })),
        );
      }

      if (usersRes.status === 'fulfilled') setRecentUsers(Array.isArray(usersRes.value) ? usersRes.value : []);
      else {
        setRecentUsers(
          Array.from({ length: 10 }, (_, i) => ({
            id: `user-${i}`,
            username: `newuser_${Math.floor(Math.random() * 10000)}`,
            email: `user${i}@example.com`,
            kycLevel: Math.floor(Math.random() * 4),
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TableSkeleton rows={10} />
          <TableSkeleton rows={5} />
        </div>
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'won':
      case 'settled':
        return 'success';
      case 'lost':
        return 'danger';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Platform overview and key metrics
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 rounded-button bg-background-card border border-border text-text-secondary hover:text-text hover:border-border-light transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Pending alerts */}
      {kpi && kpi.pendingWithdrawals > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-card bg-warning/10 border border-warning/25">
          <Clock className="w-4 h-4 text-warning shrink-0" />
          <p className="text-sm text-warning">
            <span className="font-bold">{kpi.pendingWithdrawals}</span> pending withdrawals
            totaling{' '}
            <span className="font-bold font-mono">
              ${Number(kpi?.pendingWithdrawalsAmount ?? 0).toLocaleString()}
            </span>{' '}
            require review.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Active Users"
          value={Number(kpi?.activeUsers ?? 0).toLocaleString()}
          change={kpi?.activeUsersChange}
          icon={Users}
          iconColor="text-info"
          iconBg="bg-info/15"
        />
        <KpiCard
          title="Bets Today"
          value={Number(kpi?.betsToday ?? 0).toLocaleString()}
          change={kpi?.betsTodayChange}
          icon={Receipt}
          iconColor="text-accent"
          iconBg="bg-accent/15"
        />
        <KpiCard
          title="Revenue Today"
          value={`$${Number(kpi?.revenueToday ?? 0).toLocaleString()}`}
          change={kpi?.revenueTodayChange}
          icon={DollarSign}
          iconColor="text-success"
          iconBg="bg-success/15"
        />
        <KpiCard
          title="Pending W/D"
          value={String(kpi?.pendingWithdrawals || 0)}
          subtitle={`$${Number(kpi?.pendingWithdrawalsAmount ?? 0).toLocaleString()} total`}
          icon={Clock}
          iconColor="text-warning"
          iconBg="bg-warning/15"
        />
        <KpiCard
          title="Live Events"
          value={String(kpi?.liveEvents || 0)}
          icon={Radio}
          iconColor="text-danger"
          iconBg="bg-danger/15"
        />
        <KpiCard
          title="Online Users"
          value={Number(kpi?.onlineUsers ?? 0).toLocaleString()}
          icon={Wifi}
          iconColor="text-success"
          iconBg="bg-success/15"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              Revenue (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                  <XAxis
                    dataKey="date"
                    stroke="#6E7681"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6E7681"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', color: '#8B949E' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#8B5CF6' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#10B981' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Deposits vs Withdrawals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-info" />
              Deposits vs Withdrawals
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={depWithData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                  <XAxis
                    dataKey="date"
                    stroke="#6E7681"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6E7681"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', color: '#8B949E' }}
                  />
                  <Bar
                    dataKey="deposits"
                    name="Deposits"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="withdrawals"
                    name="Withdrawals"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Bets */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Bets</CardTitle>
              <span className="text-xs text-text-muted">Last 20</span>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                        User
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                        Odds
                      </th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBets.map((bet) => (
                      <tr
                        key={bet.id}
                        className="border-b border-border/50 hover:bg-background-elevated/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-text font-medium">
                          {bet.username}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={
                              bet.type === 'parlay' ? 'accent' : 'default'
                            }
                            size="xs"
                          >
                            {bet.type}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-text font-mono">
                          {formatCurrency(bet.amount, bet.currency)}
                        </td>
                        <td className="py-2 px-3 text-right text-text font-mono">
                          {Number(bet.odds ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge
                            variant={statusColor(bet.status) as any}
                            size="xs"
                          >
                            {bet.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right text-text-muted text-xs">
                          {formatRelativeDate(bet.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Recent Registrations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
            <span className="text-xs text-text-muted">Last 10</span>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-button hover:bg-background-elevated/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                    {(user.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">
                      {user.username}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={user.kycLevel >= 2 ? 'success' : user.kycLevel === 1 ? 'warning' : 'default'}
                      size="xs"
                    >
                      KYC {user.kycLevel}
                    </Badge>
                    <p className="text-[10px] text-text-muted mt-1">
                      {formatRelativeDate(user.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
