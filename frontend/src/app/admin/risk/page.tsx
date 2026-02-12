'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'large-bets' | 'anomalies' | 'duplicates' | 'geo';

export default function AdminRiskPage() {
  const [tab, setTab] = useState<Tab>('large-bets');
  const [largeBets, setLargeBets] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    if (tab === 'large-bets') {
      api.get('/admin/risk/large-bets?threshold=500').then(({ data }) => {
        setLargeBets(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else if (tab === 'anomalies') {
      api.get('/admin/risk/win-rate-anomalies').then(({ data }) => {
        setAnomalies(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else if (tab === 'duplicates') {
      api.get('/admin/risk/duplicate-accounts').then(({ data }) => {
        setDuplicates(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Risk Management</h1>

      <div className="flex gap-1 overflow-x-auto">
        {(['large-bets', 'anomalies', 'duplicates', 'geo'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm capitalize transition-colors whitespace-nowrap',
              tab === t ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}>{t === 'geo' ? 'Geo Restrictions' : t.replace('-', ' ')}</button>
        ))}
      </div>

      {/* Large Bets */}
      {tab === 'large-bets' && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-gray-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Stake</th>
                <th className="px-4 py-3">Odds</th>
                <th className="px-4 py-3">Potential Win</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {largeBets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No large bets found</td></tr>
              )}
              {largeBets.map((bet: any) => (
                <tr key={bet.id} className="border-b border-border/50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{bet.user?.username || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{bet.user?.vipTier}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-accent-yellow">{bet.stake} {bet.currency}</td>
                  <td className="px-4 py-3 font-mono">{parseFloat(bet.totalOdds).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono">{parseFloat(bet.potentialWin).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold',
                      bet.status === 'WON' ? 'text-accent-green' :
                      bet.status === 'LOST' ? 'text-accent-red' : 'text-accent-yellow'
                    )}>{bet.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(bet.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Win Rate Anomalies */}
      {tab === 'anomalies' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Users with win rates above 70% (minimum 50 bets)</p>
          {anomalies.length === 0 && (
            <div className="card text-center py-8 text-gray-500">No anomalies detected</div>
          )}
          {anomalies.map((a: any) => (
            <div key={a.userId} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{a.username}</p>
                <p className="text-xs text-gray-500">{a.email}</p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Win Rate</p>
                  <p className="font-bold text-accent-red">{a.winRate}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Bets</p>
                  <p className="font-mono">{a.totalBets}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Won</p>
                  <p className="font-mono text-accent-green">{a.wonBets}</p>
                </div>
                <button className="btn-secondary text-xs">Investigate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Duplicate Accounts */}
      {tab === 'duplicates' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">IP addresses associated with multiple user accounts</p>
          {duplicates.length === 0 && (
            <div className="card text-center py-8 text-gray-500">No duplicate accounts detected</div>
          )}
          {duplicates.map((d: any, i: number) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-sm">{d.ip}</div>
                <span className="text-xs font-bold text-accent-yellow">{d.accountCount} accounts</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {d.userIds.map((uid: string) => (
                  <span key={uid} className="text-xs bg-surface-tertiary rounded px-2 py-1 font-mono">{uid.slice(0, 12)}...</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Geo Restrictions */}
      {tab === 'geo' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold">Geo-Restriction Rules</h2>
          <p className="text-xs text-gray-500">Configure which countries are blocked from accessing the platform.</p>
          <div className="space-y-2">
            {[
              { code: 'US', name: 'United States', blocked: true },
              { code: 'GB', name: 'United Kingdom', blocked: true },
              { code: 'HK', name: 'Hong Kong', blocked: true },
              { code: 'SG', name: 'Singapore', blocked: true },
              { code: 'FR', name: 'France', blocked: false },
              { code: 'AU', name: 'Australia', blocked: false },
            ].map((country) => (
              <div key={country.code} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold">{country.code}</span>
                  <span className="text-sm">{country.name}</span>
                </div>
                <span className={cn('text-xs font-bold',
                  country.blocked ? 'text-accent-red' : 'text-accent-green'
                )}>
                  {country.blocked ? 'Blocked' : 'Allowed'}
                </span>
              </div>
            ))}
          </div>
          <button className="btn-primary">Save Restrictions</button>
        </div>
      )}
    </div>
  );
}
