'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'withdrawals' | 'currencies' | 'wallets' | 'transactions';

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<Tab>('withdrawals');
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tab === 'withdrawals') {
      api.get('/admin/wallets/withdrawals/pending').then(({ data }) => {
        setPendingWithdrawals(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else if (tab === 'currencies') {
      api.get('/wallets/currencies').then(({ data }) => {
        setCurrencies(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [tab]);

  const approveWithdrawal = async (txId: string) => {
    await api.post(`/wallets/withdraw/${txId}/approve`);
    setPendingWithdrawals(prev => prev.filter(w => w.id !== txId));
  };

  const rejectWithdrawal = async (txId: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await api.post(`/wallets/withdraw/${txId}/reject`, { reason });
    setPendingWithdrawals(prev => prev.filter(w => w.id !== txId));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payment Management</h1>

      <div className="flex gap-1 overflow-x-auto">
        {(['withdrawals', 'currencies', 'wallets', 'transactions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setIsLoading(true); }}
            className={cn(
              'px-4 py-2 rounded-lg text-sm capitalize transition-colors whitespace-nowrap',
              tab === t ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Pending Withdrawals */}
      {tab === 'withdrawals' && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-gray-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingWithdrawals.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No pending withdrawals</td></tr>
              )}
              {pendingWithdrawals.map((w) => (
                <tr key={w.id} className="border-b border-border/50">
                  <td className="px-4 py-3">{w.userId?.slice(0, 8)}...</td>
                  <td className="px-4 py-3 font-mono font-bold">{w.amount}</td>
                  <td className="px-4 py-3">{w.currency}</td>
                  <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]">{w.metadata?.address || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(w.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => approveWithdrawal(w.id)} className="text-xs text-accent-green hover:underline font-bold">Approve</button>
                      <button onClick={() => rejectWithdrawal(w.id)} className="text-xs text-accent-red hover:underline font-bold">Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Currency Manager */}
      {tab === 'currencies' && (
        <div className="space-y-3">
          {currencies.map((c: any) => (
            <div key={c.id || c.symbol} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-surface-tertiary rounded-full flex items-center justify-center text-xs font-bold">
                  {c.symbol?.slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-sm">{c.symbol} — {c.name}</p>
                  <p className="text-xs text-gray-500">Networks: {c.networks?.join(', ') || 'Default'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-xs">
                  <p>Min Withdrawal: <span className="font-mono">{c.minWithdrawal || '0'}</span></p>
                  <p>Fee: <span className="font-mono">{c.withdrawalFee || '0'}</span></p>
                </div>
                <div className={cn(
                  'text-xs font-bold',
                  c.isActive !== false ? 'text-accent-green' : 'text-accent-red'
                )}>
                  {c.isActive !== false ? 'Active' : 'Disabled'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Wallets */}
      {tab === 'wallets' && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">Platform Wallet Balances</h3>
          <p className="text-xs text-gray-500">Hot wallet and cold storage balance monitoring. Configure thresholds from settings.</p>
          <div className="mt-4 space-y-2">
            {['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL'].map((currency) => (
              <div key={currency} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                <span className="text-sm font-medium">{currency}</span>
                <div className="flex gap-6 text-xs">
                  <div><span className="text-gray-500">Hot: </span><span className="font-mono text-accent-green">--</span></div>
                  <div><span className="text-gray-500">Cold: </span><span className="font-mono text-brand-400">--</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction Monitor */}
      {tab === 'transactions' && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">Transaction Monitor</h3>
          <p className="text-xs text-gray-500 mb-4">Real-time feed of all deposits and withdrawals.</p>
          <div className="space-y-2">
            <div className="flex gap-2 mb-3">
              <input type="text" placeholder="Search by user ID, tx hash..." className="input flex-1" />
              <select className="input w-40">
                <option value="">All Types</option>
                <option value="DEPOSIT">Deposits</option>
                <option value="WITHDRAWAL">Withdrawals</option>
              </select>
            </div>
            <p className="text-center text-gray-500 text-sm py-8">Connect to view real-time transactions</p>
          </div>
        </div>
      )}
    </div>
  );
}
