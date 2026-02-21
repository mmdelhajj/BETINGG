'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils';
import { get, post, put } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api';
import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wallet,
  ToggleLeft,
  ToggleRight,
  Edit,
  Eye,
  RefreshCw,
  AlertTriangle,
  X,
  Copy,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Withdrawal {
  id: string;
  username: string;
  userId: string;
  amount: number;
  currency: string;
  address: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
  createdAt: string;
  fee: number;
}

interface Transaction {
  id: string;
  userId: string;
  username: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'bonus' | 'swap' | 'rakeback' | 'referral';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  txHash?: string;
  createdAt: string;
}

interface Currency {
  id: string;
  symbol: string;
  name: string;
  type: 'crypto' | 'fiat';
  enabled: boolean;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  minDeposit: number;
  minWithdrawal: number;
  withdrawalFee: number;
  networks: string[];
}

interface HotWallet {
  currency: string;
  address: string;
  balance: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
}

type FinanceTab = 'withdrawals' | 'transactions' | 'currencies' | 'wallets';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Finance Page
// ---------------------------------------------------------------------------

export default function AdminFinancePage() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('withdrawals');
  const [loading, setLoading] = useState(true);

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [wdPage, setWdPage] = useState(1);
  const [wdTotal, setWdTotal] = useState(0);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdActionLoading, setWdActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('');
  const [txCurrencyFilter, setTxCurrencyFilter] = useState('');

  // Currencies
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null);
  const [editForm, setEditForm] = useState<Partial<Currency>>({});

  // Wallets
  const [hotWallets, setHotWallets] = useState<HotWallet[]>([]);

  // Sorting
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(wdPage), limit: '20', status: 'pending', sortBy: sortField, sortDir });
      const res = await get<PaginatedResponse<Withdrawal>>(`/admin/withdrawals?${params}`);
      setWithdrawals(res?.data || []);
      setWdTotal(res?.total || 0);
      setWdTotalPages(res?.totalPages || 1);
    } catch {
      setWithdrawals(
        Array.from({ length: 12 }, (_, i) => ({
          id: `wd-${i}`,
          username: `user_${1000 + i}`,
          userId: `uid-${i}`,
          amount: Math.random() * 5000 + 100,
          currency: ['BTC', 'ETH', 'USDT', 'SOL'][Math.floor(Math.random() * 4)],
          address: `0x${Math.random().toString(16).slice(2, 14)}...${Math.random().toString(16).slice(2, 6)}`,
          network: ['ERC20', 'TRC20', 'BEP20', 'SOL'][Math.floor(Math.random() * 4)],
          status: 'pending',
          createdAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
          fee: Math.random() * 10 + 1,
        })),
      );
      setWdTotal(12);
      setWdTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [wdPage, sortField, sortDir]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(txPage), limit: '20', sortBy: sortField, sortDir });
      if (txSearch) params.set('search', txSearch);
      if (txTypeFilter) params.set('type', txTypeFilter);
      if (txStatusFilter) params.set('status', txStatusFilter);
      if (txCurrencyFilter) params.set('currency', txCurrencyFilter);
      const res = await get<PaginatedResponse<Transaction>>(`/admin/transactions?${params}`);
      setTransactions(res?.data || []);
      setTxTotal(res?.total || 0);
      setTxTotalPages(res?.totalPages || 1);
    } catch {
      setTransactions(
        Array.from({ length: 20 }, (_, i) => ({
          id: `tx-${i}`,
          userId: `uid-${i}`,
          username: `user_${1000 + i}`,
          type: (['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'swap'] as const)[Math.floor(Math.random() * 6)],
          amount: (Math.random() > 0.4 ? 1 : -1) * (Math.random() * 2000 + 10),
          currency: ['BTC', 'ETH', 'USDT', 'SOL', 'LTC'][Math.floor(Math.random() * 5)],
          status: (['completed', 'pending', 'failed'] as const)[Math.floor(Math.random() * 3)],
          txHash: Math.random() > 0.5 ? `0x${Math.random().toString(16).slice(2, 18)}` : undefined,
          createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
        })),
      );
      setTxTotal(350);
      setTxTotalPages(18);
    } finally {
      setLoading(false);
    }
  }, [txPage, txSearch, txTypeFilter, txStatusFilter, txCurrencyFilter, sortField, sortDir]);

  const fetchCurrencies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>('/admin/currencies');
      setCurrencies(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setCurrencies([
        { id: 'c-1', symbol: 'BTC', name: 'Bitcoin', type: 'crypto', enabled: true, depositEnabled: true, withdrawalEnabled: true, minDeposit: 0.0001, minWithdrawal: 0.001, withdrawalFee: 0.0005, networks: ['Bitcoin'] },
        { id: 'c-2', symbol: 'ETH', name: 'Ethereum', type: 'crypto', enabled: true, depositEnabled: true, withdrawalEnabled: true, minDeposit: 0.01, minWithdrawal: 0.05, withdrawalFee: 0.005, networks: ['ERC20'] },
        { id: 'c-3', symbol: 'USDT', name: 'Tether', type: 'crypto', enabled: true, depositEnabled: true, withdrawalEnabled: true, minDeposit: 10, minWithdrawal: 20, withdrawalFee: 5, networks: ['ERC20', 'TRC20', 'BEP20'] },
        { id: 'c-4', symbol: 'SOL', name: 'Solana', type: 'crypto', enabled: true, depositEnabled: true, withdrawalEnabled: true, minDeposit: 0.1, minWithdrawal: 0.5, withdrawalFee: 0.01, networks: ['Solana'] },
        { id: 'c-5', symbol: 'DOGE', name: 'Dogecoin', type: 'crypto', enabled: true, depositEnabled: true, withdrawalEnabled: false, minDeposit: 10, minWithdrawal: 50, withdrawalFee: 2, networks: ['Dogecoin'] },
        { id: 'c-6', symbol: 'LTC', name: 'Litecoin', type: 'crypto', enabled: false, depositEnabled: false, withdrawalEnabled: false, minDeposit: 0.01, minWithdrawal: 0.1, withdrawalFee: 0.001, networks: ['Litecoin'] },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>('/admin/wallets');
      setHotWallets(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setHotWallets([
        { currency: 'BTC', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', balance: 12.458, pendingDeposits: 0.125, pendingWithdrawals: 0.842 },
        { currency: 'ETH', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', balance: 245.32, pendingDeposits: 5.2, pendingWithdrawals: 18.5 },
        { currency: 'USDT', address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9', balance: 1250000, pendingDeposits: 12500, pendingWithdrawals: 85400 },
        { currency: 'SOL', address: '7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb5JUVVgmJ5hQ', balance: 3420, pendingDeposits: 120, pendingWithdrawals: 450 },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'withdrawals') fetchWithdrawals();
    else if (activeTab === 'transactions') fetchTransactions();
    else if (activeTab === 'currencies') fetchCurrencies();
    else if (activeTab === 'wallets') fetchWallets();
  }, [activeTab, fetchWithdrawals, fetchTransactions, fetchCurrencies, fetchWallets]);

  const handleApprove = async (wd: Withdrawal) => {
    setWdActionLoading(wd.id);
    try {
      await put(`/admin/withdrawals/${wd.id}/approve`, {});
      setWithdrawals((prev) => prev.filter((w) => w.id !== wd.id));
    } catch { /* silent */ }
    finally { setWdActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setWdActionLoading(rejectModal.id);
    try {
      await put(`/admin/withdrawals/${rejectModal.id}/reject`, { reason: rejectReason });
      setWithdrawals((prev) => prev.filter((w) => w.id !== rejectModal.id));
    } catch { /* silent */ }
    finally { setWdActionLoading(null); setRejectModal(null); setRejectReason(''); }
  };

  const handleToggleCurrency = async (currency: Currency, field: 'enabled' | 'depositEnabled' | 'withdrawalEnabled') => {
    try {
      await put(`/admin/currencies/${currency.id}`, { [field]: !currency[field] });
      setCurrencies((prev) =>
        prev.map((c) => c.id === currency.id ? { ...c, [field]: !c[field] } : c),
      );
    } catch { /* silent */ }
  };

  const handleSaveEditCurrency = async () => {
    if (!editCurrency) return;
    try {
      await put(`/admin/currencies/${editCurrency.id}`, editForm);
      setCurrencies((prev) =>
        prev.map((c) => c.id === editCurrency.id ? { ...c, ...editForm } : c),
      );
    } catch { /* silent */ }
    finally { setEditCurrency(null); }
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />;
  };

  const statusColor = (s: string) => {
    switch (s) { case 'completed': case 'approved': return 'success'; case 'failed': case 'rejected': case 'cancelled': return 'danger'; case 'pending': case 'processing': return 'warning'; default: return 'default'; }
  };

  const typeColor = (t: string) => {
    switch (t) { case 'deposit': return 'success'; case 'withdrawal': return 'danger'; case 'bet': return 'accent'; case 'win': return 'success'; case 'bonus': return 'info'; default: return 'default'; }
  };

  const Pagination = ({ page, totalPages, total, setPage: sp }: { page: number; totalPages: number; total: number; setPage: (p: number) => void }) => (
    totalPages > 1 ? (
      <CardFooter className="px-4">
        <p className="text-xs text-text-muted">
          Page {page} of {totalPages} ({Number(total ?? 0).toLocaleString()} total)
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => sp(page - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 5) p = i + 1;
            else if (page <= 3) p = i + 1;
            else if (page >= totalPages - 2) p = totalPages - 4 + i;
            else p = page - 2 + i;
            return (
              <button key={p} onClick={() => sp(p)} className={cn('h-8 w-8 rounded-button text-xs font-medium transition-colors', p === page ? 'bg-accent text-white' : 'text-text-secondary hover:bg-background-elevated')}>
                {p}
              </button>
            );
          })}
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => sp(page + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardFooter>
    ) : null
  );

  const tabs: { key: FinanceTab; label: string; icon: React.ElementType }[] = [
    { key: 'withdrawals', label: 'Withdrawals', icon: Clock },
    { key: 'transactions', label: 'Transactions', icon: ArrowUpDown },
    { key: 'currencies', label: 'Currencies', icon: Edit },
    { key: 'wallets', label: 'Wallets', icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Finance</h1>
        <p className="text-sm text-text-muted mt-0.5">Manage withdrawals, transactions, currencies and wallets</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === key ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === 'withdrawals' && withdrawals.length > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-warning/20 text-warning text-[10px] font-bold px-1">
                {withdrawals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Withdrawals Tab */}
      {activeTab === 'withdrawals' && (
        <Card noPadding>
          {loading ? (
            <div className="p-4"><TableSkeleton /></div>
          ) : withdrawals.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-3 opacity-50" />
              <p className="text-text-secondary">No pending withdrawals</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background-elevated/50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">User</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('amount')}>
                        <span className="flex items-center gap-1 justify-end">Amount <SortIcon field="amount" /></span>
                      </th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Address</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Network</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Fee</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('createdAt')}>
                        <span className="flex items-center gap-1 justify-end">Requested <SortIcon field="createdAt" /></span>
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((wd) => (
                      <tr key={wd.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                        <td className="py-3 px-4 text-text font-medium">{wd.username}</td>
                        <td className="py-3 px-3 text-right font-mono text-text font-medium">
                          {formatCurrency(wd.amount, wd.currency)}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleCopy(wd.address, wd.id)}
                            className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text"
                          >
                            {(wd.address || '').substring(0, 10)}...{(wd.address || '').slice(-4)}
                            {copiedId === wd.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </td>
                        <td className="py-3 px-3"><Badge variant="default" size="xs">{wd.network}</Badge></td>
                        <td className="py-3 px-3 text-right font-mono text-text-muted text-xs">{formatCurrency(wd.fee, wd.currency)}</td>
                        <td className="py-3 px-3 text-right text-xs text-text-muted">{formatRelativeDate(wd.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Button
                              variant="success"
                              size="sm"
                              isLoading={wdActionLoading === wd.id}
                              onClick={() => handleApprove(wd)}
                              leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setRejectModal(wd)}
                              leftIcon={<XCircle className="w-3.5 h-3.5" />}
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={wdPage} totalPages={wdTotalPages} total={wdTotal} setPage={setWdPage} />
            </>
          )}
        </Card>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Search by username, tx hash..."
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    prefixIcon={<Search className="w-4 h-4" />}
                    className="bg-background"
                  />
                </div>
                <select value={txTypeFilter} onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }} className="h-10 bg-background border border-border rounded-input px-3 text-sm text-text">
                  <option value="">All types</option>
                  {['deposit', 'withdrawal', 'bet', 'win', 'bonus', 'swap', 'rakeback', 'referral'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select value={txStatusFilter} onChange={(e) => { setTxStatusFilter(e.target.value); setTxPage(1); }} className="h-10 bg-background border border-border rounded-input px-3 text-sm text-text">
                  <option value="">All statuses</option>
                  {['pending', 'completed', 'failed', 'cancelled'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select value={txCurrencyFilter} onChange={(e) => { setTxCurrencyFilter(e.target.value); setTxPage(1); }} className="h-10 bg-background border border-border rounded-input px-3 text-sm text-text">
                  <option value="">All currencies</option>
                  {['BTC', 'ETH', 'USDT', 'SOL', 'LTC', 'DOGE'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </CardBody>
          </Card>

          <Card noPadding>
            {loading ? (
              <div className="p-4"><TableSkeleton /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background-elevated/50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">User</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('amount')}>
                          <span className="flex items-center gap-1 justify-end">Amount <SortIcon field="amount" /></span>
                        </th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Currency</th>
                        <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">TX Hash</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('createdAt')}>
                          <span className="flex items-center gap-1 justify-end">Date <SortIcon field="createdAt" /></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                          <td className="py-2.5 px-4 text-text font-medium">{tx.username}</td>
                          <td className="py-2.5 px-3"><Badge variant={typeColor(tx.type) as any} size="xs">{tx.type}</Badge></td>
                          <td className={cn('py-2.5 px-3 text-right font-mono font-medium', tx.amount >= 0 ? 'text-success' : 'text-danger')}>
                            {tx.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(tx.amount), tx.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-text font-mono text-xs">{tx.currency}</td>
                          <td className="py-2.5 px-3 text-center"><Badge variant={statusColor(tx.status) as any} size="xs">{tx.status}</Badge></td>
                          <td className="py-2.5 px-3 text-xs font-mono text-text-muted">{tx.txHash || '-'}</td>
                          <td className="py-2.5 px-3 text-right text-xs text-text-muted">{formatDate(tx.createdAt, 'MMM d, HH:mm')}</td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr><td colSpan={7} className="py-12 text-center text-text-muted">No transactions found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination page={txPage} totalPages={txTotalPages} total={txTotal} setPage={setTxPage} />
              </>
            )}
          </Card>
        </div>
      )}

      {/* Currencies Tab */}
      {activeTab === 'currencies' && (
        <Card noPadding>
          {loading ? (
            <div className="p-4"><TableSkeleton rows={6} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Currency</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Networks</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Enabled</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Deposit</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Withdrawal</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Min Deposit</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">W/D Fee</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((curr) => (
                    <tr key={curr.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                      <td className="py-3 px-4">
                        <div>
                          <span className="text-text font-bold">{curr.symbol}</span>
                          <p className="text-xs text-text-muted">{curr.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3"><Badge variant={curr.type === 'crypto' ? 'accent' : 'info'} size="xs">{curr.type}</Badge></td>
                      <td className="py-3 px-3 text-xs text-text-secondary">{curr.networks.join(', ')}</td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => handleToggleCurrency(curr, 'enabled')} className="mx-auto">
                          {curr.enabled ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-text-muted" />}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => handleToggleCurrency(curr, 'depositEnabled')}>
                          {curr.depositEnabled ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-text-muted" />}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => handleToggleCurrency(curr, 'withdrawalEnabled')}>
                          {curr.withdrawalEnabled ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-text-muted" />}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-text text-xs">{curr.minDeposit} {curr.symbol}</td>
                      <td className="py-3 px-3 text-right font-mono text-text text-xs">{curr.withdrawalFee} {curr.symbol}</td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditCurrency(curr); setEditForm({ minDeposit: curr.minDeposit, minWithdrawal: curr.minWithdrawal, withdrawalFee: curr.withdrawalFee }); }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Wallets Tab */}
      {activeTab === 'wallets' && (
        <div className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hotWallets.map((hw) => (
                <Card key={hw.currency}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-accent" />
                      {hw.currency} Hot Wallet
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(hw.address, hw.currency)}>
                      {copiedId === hw.currency ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  </CardHeader>
                  <CardBody>
                    <p className="text-xs font-mono text-text-muted mb-4 truncate">{hw.address}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-text-muted uppercase">Balance</p>
                        <p className="text-sm font-bold font-mono text-text">{formatCurrency(hw.balance, hw.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-text-muted uppercase">Pending In</p>
                        <p className="text-sm font-mono text-success">{formatCurrency(hw.pendingDeposits, hw.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-text-muted uppercase">Pending Out</p>
                        <p className="text-sm font-mono text-danger">{formatCurrency(hw.pendingWithdrawals, hw.currency)}</p>
                      </div>
                    </div>
                    {hw.pendingWithdrawals > hw.balance * 0.5 && (
                      <div className="mt-3 flex items-center gap-2 p-2 bg-warning/10 rounded-button border border-warning/25">
                        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                        <p className="text-xs text-warning">Pending withdrawals exceed 50% of balance</p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onOpenChange={() => { setRejectModal(null); setRejectReason(''); }}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Reject Withdrawal</ModalTitle></ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary mb-3">
              Rejecting withdrawal of{' '}
              <span className="font-mono font-medium text-text">
                {rejectModal && formatCurrency(rejectModal.amount, rejectModal.currency)}
              </span>{' '}
              for {rejectModal?.username}.
            </p>
            <Input
              label="Reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="bg-background"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="danger" size="sm" isLoading={!!wdActionLoading} onClick={handleReject}>Reject</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Currency Modal */}
      <Modal open={!!editCurrency} onOpenChange={() => setEditCurrency(null)}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Edit {editCurrency?.symbol} Settings</ModalTitle></ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <Input
                label="Min Deposit"
                type="number"
                step="any"
                value={String(editForm.minDeposit || '')}
                onChange={(e) => setEditForm({ ...editForm, minDeposit: parseFloat(e.target.value) })}
                className="bg-background"
              />
              <Input
                label="Min Withdrawal"
                type="number"
                step="any"
                value={String(editForm.minWithdrawal || '')}
                onChange={(e) => setEditForm({ ...editForm, minWithdrawal: parseFloat(e.target.value) })}
                className="bg-background"
              />
              <Input
                label="Withdrawal Fee"
                type="number"
                step="any"
                value={String(editForm.withdrawalFee || '')}
                onChange={(e) => setEditForm({ ...editForm, withdrawalFee: parseFloat(e.target.value) })}
                className="bg-background"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditCurrency(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSaveEditCurrency}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
