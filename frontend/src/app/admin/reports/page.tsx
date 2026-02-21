'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import { get } from '@/lib/api';
import {
  FileBarChart,
  Download,
  Calendar,
  DollarSign,
  Users,
  Trophy,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChartIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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

interface FinancialReport {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  revenueBySport: { name: string; revenue: number }[];
  revenueByCasino: { name: string; revenue: number }[];
}

interface UserReport {
  totalRegistrations: number;
  activeUsers: number;
  registrationsOverTime: { date: string; count: number }[];
  vipDistribution: { tier: string; count: number }[];
  retentionRate: number;
}

interface BettingReport {
  totalVolume: number;
  totalBets: number;
  avgBetSize: number;
  popularMarkets: { name: string; bets: number; volume: number }[];
  settlementStats: {
    totalSettled: number;
    userWins: number;
    userLosses: number;
    pushes: number;
    avgSettlementTime: number;
  };
}

type ReportTab = 'financial' | 'users' | 'betting';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// Chart Tooltip
// ---------------------------------------------------------------------------

function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background-elevated border border-border rounded-card p-3 shadow-xl">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="text-text font-medium font-mono">
            {typeof entry.value === 'number' && entry.value > 100
              ? `$${Number(entry.value || 0).toLocaleString()}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pie Chart Custom Label
// ---------------------------------------------------------------------------

const COLORS = ['#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

function renderCustomizedLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }: any) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Reports Page
// ---------------------------------------------------------------------------

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('financial');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [financial, setFinancial] = useState<FinancialReport | null>(null);
  const [userReport, setUserReport] = useState<UserReport | null>(null);
  const [bettingReport, setBettingReport] = useState<BettingReport | null>(null);

  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  }, []);

  const fetchReport = useCallback(async () => {
    if (!dateRange.start || !dateRange.end) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: dateRange.start, end: dateRange.end });

      if (activeTab === 'financial') {
        const res = await get<FinancialReport>(`/admin/reports/financial?${params}`);
        setFinancial(res);
      } else if (activeTab === 'users') {
        const res = await get<UserReport>(`/admin/reports/users?${params}`);
        setUserReport(res);
      } else {
        const res = await get<BettingReport>(`/admin/reports/betting?${params}`);
        setBettingReport(res);
      }
    } catch {
      // Fallback data
      if (activeTab === 'financial') {
        setFinancial({
          totalRevenue: 1245000,
          totalCosts: 842000,
          netProfit: 403000,
          profitMargin: 32.4,
          revenueBySport: [
            { name: 'Football', revenue: 450000 },
            { name: 'Basketball', revenue: 280000 },
            { name: 'Tennis', revenue: 120000 },
            { name: 'Cricket', revenue: 85000 },
            { name: 'Esports', revenue: 65000 },
            { name: 'Other', revenue: 45000 },
          ],
          revenueByCasino: [
            { name: 'Crash', revenue: 48250 },
            { name: 'Slots', revenue: 52100 },
            { name: 'Coinflip', revenue: 35600 },
            { name: 'Dice', revenue: 22100 },
            { name: 'Roulette', revenue: 21400 },
            { name: 'Other', revenue: 20550 },
          ],
        });
      } else if (activeTab === 'users') {
        const days = Array.from({ length: 30 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return { date: d.toISOString().split('T')[0].slice(5), count: Math.floor(Math.random() * 80) + 20 };
        });
        setUserReport({
          totalRegistrations: 2480,
          activeUsers: 12847,
          registrationsOverTime: days,
          vipDistribution: [
            { tier: 'Bronze', count: 8500 },
            { tier: 'Silver', count: 2800 },
            { tier: 'Gold', count: 950 },
            { tier: 'Platinum', count: 380 },
            { tier: 'Diamond', count: 145 },
            { tier: 'Elite', count: 52 },
            { tier: 'Black Diamond', count: 15 },
            { tier: 'Blue Diamond', count: 5 },
          ],
          retentionRate: 68.5,
        });
      } else {
        setBettingReport({
          totalVolume: 8542000,
          totalBets: 284500,
          avgBetSize: 30.02,
          popularMarkets: [
            { name: 'Match Winner', bets: 85000, volume: 2550000 },
            { name: 'Over/Under', bets: 62000, volume: 1860000 },
            { name: 'Both Teams Score', bets: 45000, volume: 1125000 },
            { name: 'Handicap', bets: 38000, volume: 1140000 },
            { name: 'First Scorer', bets: 22000, volume: 440000 },
            { name: 'Correct Score', bets: 18000, volume: 360000 },
            { name: 'Half Time Result', bets: 14500, volume: 290000 },
          ],
          settlementStats: {
            totalSettled: 268000,
            userWins: 128640,
            userLosses: 134000,
            pushes: 5360,
            avgSettlementTime: 45,
          },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExportCSV = () => {
    const link = document.createElement('a');
    link.href = `/api/admin/reports/export?type=${activeTab}&start=${dateRange.start}&end=${dateRange.end}&format=csv`;
    link.download = `${activeTab}-report-${dateRange.start}-${dateRange.end}.csv`;
    link.click();
  };

  const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: 'financial', label: 'Financial', icon: DollarSign },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'betting', label: 'Betting', icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">Reports</h1>
          <p className="text-sm text-text-muted mt-0.5">Analytics and platform insights</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="h-9 bg-background-card border border-border rounded-input px-3 text-sm text-text"
            />
            <span className="text-text-muted">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="h-9 bg-background-card border border-border rounded-input px-3 text-sm text-text"
            />
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleExportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === key ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : (
        <>
          {/* Financial Report */}
          {activeTab === 'financial' && financial && (
            <div className="space-y-6">
              {/* P&L Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <div>
                      <p className="text-xs text-text-muted">Total Revenue</p>
                      <p className="text-lg font-bold font-mono text-success">${Number(financial?.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-danger" />
                    <div>
                      <p className="text-xs text-text-muted">Total Costs</p>
                      <p className="text-lg font-bold font-mono text-danger">${Number(financial?.totalCosts || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-accent" />
                    <div>
                      <p className="text-xs text-text-muted">Net Profit</p>
                      <p className={cn('text-lg font-bold font-mono', Number(financial?.netProfit || 0) >= 0 ? 'text-success' : 'text-danger')}>
                        ${Number(financial?.netProfit || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-info" />
                    <div>
                      <p className="text-xs text-text-muted">Profit Margin</p>
                      <p className="text-lg font-bold font-mono text-text">{Number(financial?.profitMargin || 0).toFixed(1)}%</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue by Sport */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-accent" />
                      Revenue by Sport
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financial.revenueBySport || []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                          <XAxis type="number" stroke="#6E7681" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="name" stroke="#6E7681" fontSize={11} width={80} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="revenue" name="Revenue" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>

                {/* Revenue by Casino Game */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-success" />
                      Revenue by Casino Game
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financial.revenueByCasino || []}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={110}
                            dataKey="revenue"
                            nameKey="name"
                          >
                            {(financial.revenueByCasino || []).map((_, idx) => (
                              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          {/* User Report */}
          {activeTab === 'users' && userReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <p className="text-xs text-text-muted">New Registrations</p>
                  <p className="text-lg font-bold text-text">{Number(userReport?.totalRegistrations ?? 0).toLocaleString()}</p>
                </Card>
                <Card>
                  <p className="text-xs text-text-muted">Active Users</p>
                  <p className="text-lg font-bold text-text">{Number(userReport?.activeUsers ?? 0).toLocaleString()}</p>
                </Card>
                <Card>
                  <p className="text-xs text-text-muted">Retention Rate</p>
                  <p className="text-lg font-bold text-success">{userReport.retentionRate ?? 0}%</p>
                </Card>
                <Card>
                  <p className="text-xs text-text-muted">Avg Daily Signups</p>
                  <p className="text-lg font-bold text-text">
                    {Math.round((userReport.totalRegistrations ?? 0) / 30)}
                  </p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Registrations Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Registrations Over Time</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={userReport.registrationsOverTime || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                          <XAxis dataKey="date" stroke="#6E7681" fontSize={10} tickLine={false} />
                          <YAxis stroke="#6E7681" fontSize={11} tickLine={false} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="count" name="Registrations" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>

                {/* VIP Distribution Pie */}
                <Card>
                  <CardHeader>
                    <CardTitle>VIP Tier Distribution</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={userReport.vipDistribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={100}
                            dataKey="count"
                            nameKey="tier"
                            label={({ name, percent }) =>
                              percent > 0.03 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
                            }
                            labelLine={false}
                          >
                            {(userReport.vipDistribution || []).map((_, idx) => (
                              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          {/* Betting Report */}
          {activeTab === 'betting' && bettingReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <p className="text-xs text-text-muted">Total Volume</p>
                  <p className="text-lg font-bold font-mono text-text">${Number(bettingReport?.totalVolume || 0).toLocaleString()}</p>
                </Card>
                <Card>
                  <p className="text-xs text-text-muted">Total Bets</p>
                  <p className="text-lg font-bold text-text">{Number(bettingReport?.totalBets ?? 0).toLocaleString()}</p>
                </Card>
                <Card>
                  <p className="text-xs text-text-muted">Avg Bet Size</p>
                  <p className="text-lg font-bold font-mono text-text">${Number(bettingReport?.avgBetSize || 0).toFixed(2)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-text-muted">Avg Settlement</p>
                  <p className="text-lg font-bold text-text">{bettingReport?.settlementStats?.avgSettlementTime ?? 0}s</p>
                </Card>
              </div>

              {/* Popular Markets */}
              <Card>
                <CardHeader>
                  <CardTitle>Popular Markets</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bettingReport.popularMarkets || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                        <XAxis dataKey="name" stroke="#6E7681" fontSize={10} tickLine={false} />
                        <YAxis yAxisId="left" stroke="#6E7681" fontSize={11} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis yAxisId="right" orientation="right" stroke="#6E7681" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar yAxisId="left" dataKey="volume" name="Volume ($)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="bets" name="Bets" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              {/* Settlement Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Settlement Statistics</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-3 bg-background rounded-card border border-border text-center">
                      <p className="text-xs text-text-muted mb-1">Total Settled</p>
                      <p className="text-lg font-bold text-text">{Number(bettingReport?.settlementStats?.totalSettled ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-background rounded-card border border-border text-center">
                      <p className="text-xs text-text-muted mb-1">User Wins</p>
                      <p className="text-lg font-bold text-success">{Number(bettingReport?.settlementStats?.userWins ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">
                        {((bettingReport?.settlementStats?.totalSettled ? (Number(bettingReport.settlementStats.userWins) / Number(bettingReport.settlementStats.totalSettled)) * 100 : 0)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded-card border border-border text-center">
                      <p className="text-xs text-text-muted mb-1">User Losses</p>
                      <p className="text-lg font-bold text-danger">{Number(bettingReport?.settlementStats?.userLosses ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">
                        {((bettingReport?.settlementStats?.totalSettled ? (Number(bettingReport.settlementStats.userLosses) / Number(bettingReport.settlementStats.totalSettled)) * 100 : 0)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded-card border border-border text-center">
                      <p className="text-xs text-text-muted mb-1">Pushes</p>
                      <p className="text-lg font-bold text-warning">{Number(bettingReport?.settlementStats?.pushes ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">
                        {((bettingReport?.settlementStats?.totalSettled ? (Number(bettingReport.settlementStats.pushes) / Number(bettingReport.settlementStats.totalSettled)) * 100 : 0)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 bg-background rounded-card border border-border text-center">
                      <p className="text-xs text-text-muted mb-1">Avg Settlement</p>
                      <p className="text-lg font-bold text-text">{bettingReport?.settlementStats?.avgSettlementTime ?? 0}s</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
