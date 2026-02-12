'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface KPIs {
  users: { total: number; activeToday: number; newToday: number };
  bets: { today: number };
  revenue: { today: string };
  deposits: { today: string };
  withdrawals: { today: string };
  pendingWithdrawals: number;
  activeEvents: number;
}

interface ChartPoint {
  date: string;
  revenue: string;
  deposits: string;
  withdrawals: string;
}

export default function AdminDashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/dashboard/chart?days=14'),
    ]).then(([kpiRes, chartRes]) => {
      setKpis(kpiRes.data.data);
      setChart(chartRes.data.data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-24 animate-pulse bg-surface-tertiary" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Users', value: kpis.users.total.toLocaleString(), color: 'text-white' },
            { label: 'Active Today', value: kpis.users.activeToday.toLocaleString(), color: 'text-accent-green' },
            { label: 'New Today', value: kpis.users.newToday.toLocaleString(), color: 'text-brand-400' },
            { label: 'Bets Today', value: kpis.bets.today.toLocaleString(), color: 'text-white' },
            { label: 'Revenue Today', value: `$${kpis.revenue.today}`, color: 'text-accent-green' },
            { label: 'Pending W/D', value: kpis.pendingWithdrawals.toString(), color: kpis.pendingWithdrawals > 0 ? 'text-accent-yellow' : 'text-gray-400' },
            { label: 'Live Events', value: kpis.activeEvents.toString(), color: 'text-accent-red' },
          ].map((kpi) => (
            <div key={kpi.label} className="card text-center">
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className={cn('text-lg font-bold font-mono', kpi.color)}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Chart (simplified bar representation) */}
      <div className="card">
        <h2 className="text-sm font-semibold mb-4">Revenue (14 days)</h2>
        <div className="flex items-end gap-1 h-40">
          {chart.map((point) => {
            const rev = Math.abs(parseFloat(point.revenue));
            const maxRev = Math.max(...chart.map(p => Math.abs(parseFloat(p.revenue))), 1);
            const height = (rev / maxRev) * 100;
            const isPositive = parseFloat(point.revenue) >= 0;
            return (
              <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn('w-full rounded-t transition-all', isPositive ? 'bg-accent-green/60' : 'bg-accent-red/60')}
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${point.date}: $${point.revenue}`}
                />
                <span className="text-[9px] text-gray-600 rotate-[-45deg] origin-top-left whitespace-nowrap">
                  {point.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deposits vs Withdrawals */}
      {kpis && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Deposits Today</p>
            <p className="text-xl font-bold font-mono text-accent-green">${kpis.deposits.today}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Withdrawals Today</p>
            <p className="text-xl font-bold font-mono text-accent-red">${kpis.withdrawals.today}</p>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Withdrawals', href: '/admin/payments', count: kpis?.pendingWithdrawals },
          { label: 'User Management', href: '/admin/users' },
          { label: 'Risk Alerts', href: '/admin/risk' },
          { label: 'Site Settings', href: '/admin/settings' },
        ].map((link) => (
          <a key={link.label} href={link.href} className="card hover:border-brand-500 transition-colors text-center">
            <p className="text-sm font-medium">{link.label}</p>
            {link.count !== undefined && (
              <p className="text-lg font-bold text-accent-yellow">{link.count}</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
