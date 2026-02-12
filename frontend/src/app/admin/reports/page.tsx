'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'financial' | 'users' | 'betting' | 'casino';
type Period = 'daily' | 'weekly' | 'monthly';

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>('financial');
  const [period, setPeriod] = useState<Period>('daily');
  const [report, setReport] = useState<any>(null);
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tab === 'financial') {
      setIsLoading(true);
      api.get(`/admin/reports/financial?period=${period}`).then(({ data }) => {
        setReport(data.data);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [tab, period]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <button className="btn-secondary text-sm">Export CSV</button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {(['financial', 'users', 'betting', 'casino'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm capitalize transition-colors',
              tab === t ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}>{t}</button>
        ))}
      </div>

      {/* Financial Report */}
      {tab === 'financial' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn('px-3 py-1 rounded text-xs capitalize',
                  period === p ? 'bg-brand-500/30 text-brand-400' : 'bg-surface-tertiary text-gray-400'
                )}>{p}</button>
            ))}
          </div>

          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card text-center">
                  <p className="text-xs text-gray-500">Total Revenue</p>
                  <p className="text-xl font-bold font-mono text-accent-green">${report.totalRevenue}</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500">Deposits</p>
                  <p className="text-lg font-bold font-mono">${report.deposits.total}</p>
                  <p className="text-xs text-gray-500">{report.deposits.count} txns</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500">Withdrawals</p>
                  <p className="text-lg font-bold font-mono">${report.withdrawals.total}</p>
                  <p className="text-xs text-gray-500">{report.withdrawals.count} txns</p>
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500">Net Flow</p>
                  <p className={cn('text-lg font-bold font-mono',
                    parseFloat(report.deposits.total) - parseFloat(report.withdrawals.total) >= 0 ? 'text-accent-green' : 'text-accent-red'
                  )}>${(parseFloat(report.deposits.total) - parseFloat(report.withdrawals.total)).toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <h3 className="text-sm font-semibold mb-3">Sportsbook</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Total Staked</span><span className="font-mono">${report.sportsbook.totalStaked}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="font-mono text-accent-green">${report.sportsbook.revenue}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Bet Count</span><span>{report.sportsbook.betCount}</span></div>
                  </div>
                </div>
                <div className="card">
                  <h3 className="text-sm font-semibold mb-3">Casino</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Total Bets</span><span className="font-mono">${report.casino.totalBets}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Wins</span><span className="font-mono">${report.casino.totalWins}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">GGR</span><span className="font-mono text-accent-green">${report.casino.ggr}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Sessions</span><span>{report.casino.sessionCount}</span></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* User Reports */}
      {tab === 'users' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Registrations', period: 'Today', value: '--' },
            { label: 'Active Users', period: 'Today', value: '--' },
            { label: 'Churn Rate', period: '30d', value: '--' },
            { label: 'VIP Distribution', period: 'Current', value: '--' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-gray-600">{stat.period}</p>
            </div>
          ))}
        </div>
      )}

      {/* Betting Reports */}
      {tab === 'betting' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Bet Volume', value: '--' },
            { label: 'Popular Sport', value: 'Football' },
            { label: 'Avg Stake', value: '--' },
            { label: 'Settlement Rate', value: '--' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Casino Reports */}
      {tab === 'casino' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total GGR', value: '--' },
            { label: 'Top Game', value: 'Crash' },
            { label: 'Avg Session', value: '--' },
            { label: 'Provider Revenue', value: '--' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
