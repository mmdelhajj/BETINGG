'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatCurrency, formatDate, formatFullDate, formatRelativeDate } from '@/lib/utils';
import { get, post, put } from '@/lib/api';
import { toastSuccess, toastError } from '@/components/ui/toast';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Star,
  Calendar,
  Wallet,
  Ban,
  KeyRound,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  MessageSquare,
  Monitor,
  Clock,
  Copy,
  Check,
  Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserDetail {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role: string;
  vipTier: string;
  kycLevel: number;
  status: 'active' | 'banned' | 'suspended';
  createdAt: string;
  lastLoginAt?: string;
  twoFactorEnabled: boolean;
  totalWagered: number;
  totalWon: number;
  totalDeposited: number;
  totalWithdrawn: number;
  netProfit: number;
}

interface WalletBalance {
  currency: string;
  available: number;
  locked: number;
  total: number;
}

interface BetRecord {
  id: string;
  type: string;
  amount: number;
  currency: string;
  odds: number;
  potentialPayout: number;
  status: string;
  eventName?: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  txHash?: string;
  createdAt: string;
}

interface KycDocument {
  id: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  fileName: string;
  uploadedAt: string;
  reviewedAt?: string;
  reason?: string;
}

interface AdminNote {
  id: string;
  adminUsername: string;
  content: string;
  createdAt: string;
}

interface Session {
  id: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// User Detail Page
// ---------------------------------------------------------------------------

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [activeTab, setActiveTab] = useState<'bets' | 'transactions' | 'documents' | 'notes' | 'sessions'>('bets');

  // Tab data
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Modals
  const [banModal, setBanModal] = useState(false);
  const [balanceModal, setBalanceModal] = useState(false);
  const [vipModal, setVipModal] = useState(false);
  const [resetPwModal, setResetPwModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceCurrency, setBalanceCurrency] = useState('USDT');
  const [balanceReason, setBalanceReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [selectedVip, setSelectedVip] = useState('');
  const [newNote, setNewNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const vipVariant = (tier: string): any => {
    const map: Record<string, string> = {
      bronze: 'bronze', silver: 'silver', gold: 'gold', platinum: 'platinum',
      diamond: 'diamond', elite: 'elite', 'black diamond': 'black-diamond', 'blue diamond': 'blue-diamond',
    };
    return map[(tier || '').toLowerCase()] || 'default';
  };

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, walletsRes] = await Promise.allSettled([
        get<UserDetail>(`/admin/users/${userId}`),
        get<WalletBalance[]>(`/admin/users/${userId}/wallets`),
      ]);

      if (userRes.status === 'fulfilled') {
        setUser(userRes.value);
        setSelectedVip(userRes.value.vipTier);
      } else {
        setUser({
          id: userId,
          username: 'player_1042',
          email: 'player1042@example.com',
          role: 'user',
          vipTier: 'Gold',
          kycLevel: 2,
          status: 'active',
          createdAt: '2024-06-15T10:30:00Z',
          lastLoginAt: '2025-01-10T14:22:00Z',
          twoFactorEnabled: true,
          totalWagered: 45820.50,
          totalWon: 42310.25,
          totalDeposited: 15000,
          totalWithdrawn: 8500,
          netProfit: -3510.25,
        });
        setSelectedVip('Gold');
      }

      if (walletsRes.status === 'fulfilled') {
        const v = walletsRes.value;
        setWallets(Array.isArray(v) ? v : (v as any)?.data || (v as any)?.wallets || []);
      } else {
        setWallets([
          { currency: 'BTC', available: 0.0542, locked: 0.002, total: 0.0562 },
          { currency: 'ETH', available: 1.234, locked: 0.1, total: 1.334 },
          { currency: 'USDT', available: 2450.50, locked: 200, total: 2650.50 },
          { currency: 'SOL', available: 15.8, locked: 0, total: 15.8 },
          { currency: 'DOGE', available: 5000, locked: 0, total: 5000 },
          { currency: 'LTC', available: 3.25, locked: 0.5, total: 3.75 },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchTabData = useCallback(async () => {
    try {
      if (activeTab === 'bets') {
        const res = await get<any>(`/admin/users/${userId}/bets?limit=50`);
        setBets(Array.isArray(res) ? res : res?.data || []);
      } else if (activeTab === 'transactions') {
        const res = await get<any>(`/admin/users/${userId}/transactions?limit=50`);
        setTransactions(Array.isArray(res) ? res : res?.data || []);
      } else if (activeTab === 'documents') {
        const res = await get<any>(`/admin/users/${userId}/documents`);
        setDocuments(Array.isArray(res) ? res : res?.data || []);
      } else if (activeTab === 'notes') {
        const res = await get<any>(`/admin/users/${userId}/notes`);
        setNotes(Array.isArray(res) ? res : res?.data || []);
      } else if (activeTab === 'sessions') {
        const res = await get<any>(`/admin/users/${userId}/sessions`);
        setSessions(Array.isArray(res) ? res : res?.data || []);
      }
    } catch {
      // Fallback data per tab
      if (activeTab === 'bets') {
        setBets(
          Array.from({ length: 15 }, (_, i) => ({
            id: `bet-${i}`,
            type: ['single', 'parlay', 'casino'][Math.floor(Math.random() * 3)],
            amount: Math.random() * 500 + 10,
            currency: 'USDT',
            odds: Math.random() * 4 + 1.2,
            potentialPayout: Math.random() * 2000,
            status: ['won', 'lost', 'pending', 'settled'][Math.floor(Math.random() * 4)],
            eventName: `Event ${i + 1}`,
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
          })),
        );
      } else if (activeTab === 'transactions') {
        setTransactions(
          Array.from({ length: 12 }, (_, i) => ({
            id: `tx-${i}`,
            type: ['deposit', 'withdrawal', 'bet', 'win', 'bonus'][Math.floor(Math.random() * 5)],
            amount: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 1000 + 50),
            currency: ['BTC', 'ETH', 'USDT'][Math.floor(Math.random() * 3)],
            status: ['completed', 'pending', 'failed'][Math.floor(Math.random() * 3)],
            txHash: i % 3 === 0 ? `0x${Math.random().toString(16).slice(2, 18)}...` : undefined,
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 60).toISOString(),
          })),
        );
      } else if (activeTab === 'documents') {
        setDocuments([
          { id: 'doc-1', type: 'Passport', status: 'approved', fileName: 'passport_front.jpg', uploadedAt: '2024-08-10T10:00:00Z', reviewedAt: '2024-08-11T09:00:00Z' },
          { id: 'doc-2', type: 'Proof of Address', status: 'pending', fileName: 'utility_bill.pdf', uploadedAt: '2024-12-20T15:30:00Z' },
        ]);
      } else if (activeTab === 'notes') {
        setNotes([
          { id: 'n-1', adminUsername: 'admin_john', content: 'User requested VIP upgrade. Reviewed wagering history and approved Gold tier.', createdAt: '2024-11-05T14:00:00Z' },
          { id: 'n-2', adminUsername: 'admin_sarah', content: 'Suspicious betting pattern flagged. Monitored for 7 days, no further issues found.', createdAt: '2024-10-15T09:30:00Z' },
        ]);
      } else if (activeTab === 'sessions') {
        setSessions([
          { id: 's-1', ip: '192.168.1.100', userAgent: 'Chrome 120 / Windows', createdAt: '2025-01-10T14:00:00Z', lastActiveAt: '2025-01-10T14:22:00Z', isCurrent: true },
          { id: 's-2', ip: '10.0.0.50', userAgent: 'Safari 17 / macOS', createdAt: '2025-01-08T08:00:00Z', lastActiveAt: '2025-01-08T12:00:00Z', isCurrent: false },
          { id: 's-3', ip: '172.16.0.5', userAgent: 'Mobile Chrome / Android', createdAt: '2025-01-05T18:00:00Z', lastActiveAt: '2025-01-05T20:30:00Z', isCurrent: false },
        ]);
      }
    }
  }, [activeTab, userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);
  useEffect(() => { fetchTabData(); }, [fetchTabData]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBan = async () => {
    if (!user) return;
    const action = user.status === 'banned' ? 'unban' : 'ban';
    if (action === 'ban' && !banReason.trim()) {
      toastError('Please provide a reason for banning this user.');
      return;
    }
    setActionLoading(true);
    try {
      const body = action === 'ban' ? { reason: banReason.trim() } : {};
      await post(`/admin/users/${userId}/${action}`, body);
      setUser({ ...user, status: action === 'ban' ? 'banned' : 'active' });
      toastSuccess(action === 'ban' ? `${user.username} has been banned.` : `${user.username} has been unbanned.`);
    } catch (err: any) {
      toastError(err?.message || `Failed to ${action} user.`);
    } finally {
      setActionLoading(false);
      setBanModal(false);
      setBanReason('');
    }
  };

  const handleAdjustBalance = async () => {
    const parsedAmount = parseFloat(balanceAmount);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
      toastError('Amount must be a non-zero number.');
      return;
    }
    if (!balanceReason.trim()) {
      toastError('Please provide a reason for the balance adjustment.');
      return;
    }
    setActionLoading(true);
    try {
      await post(`/admin/users/${userId}/adjust-balance`, {
        amount: parsedAmount,
        currency: balanceCurrency,
        reason: balanceReason.trim(),
      });
      toastSuccess(`Balance adjusted: ${parsedAmount > 0 ? '+' : ''}${parsedAmount} ${balanceCurrency}`);
      fetchUser();
    } catch (err: any) {
      toastError(err?.message || 'Failed to adjust balance.');
    } finally {
      setActionLoading(false);
      setBalanceModal(false);
      setBalanceAmount('');
      setBalanceReason('');
    }
  };

  const handleSetVip = async () => {
    setActionLoading(true);
    try {
      await put(`/admin/users/${userId}/vip`, { tier: selectedVip });
      if (user) setUser({ ...user, vipTier: selectedVip });
      toastSuccess(`VIP tier updated to ${selectedVip}.`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to update VIP tier.');
    } finally {
      setActionLoading(false);
      setVipModal(false);
    }
  };

  const handleResetPassword = async () => {
    setActionLoading(true);
    try {
      await post(`/admin/users/${userId}/reset-password`, {});
      toastSuccess('Password reset link sent to user.');
    } catch (err: any) {
      toastError(err?.message || 'Failed to send password reset.');
    } finally {
      setActionLoading(false);
      setResetPwModal(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await post(`/admin/users/${userId}/notes`, { content: newNote.trim() });
      setNotes([
        { id: `n-${Date.now()}`, adminUsername: 'admin', content: newNote.trim(), createdAt: new Date().toISOString() },
        ...notes,
      ]);
      setNewNote('');
      toastSuccess('Note added.');
    } catch (err: any) {
      toastError(err?.message || 'Failed to add note.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const statusColor = (s: string) => {
    switch (s) {
      case 'won': case 'approved': case 'completed': case 'active': return 'success';
      case 'lost': case 'rejected': case 'failed': case 'banned': return 'danger';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const tabs = [
    { key: 'bets', label: 'Bets', icon: DollarSign },
    { key: 'transactions', label: 'Transactions', icon: Wallet },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'notes', label: 'Notes', icon: MessageSquare },
    { key: 'sessions', label: 'Sessions', icon: Monitor },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/admin/users')}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="space-y-4">
          <Card>
            <CardBody className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent text-2xl font-bold mx-auto">
                {(user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-text">{user.username}</h2>
                <p className="text-sm text-text-muted">{user.email}</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Badge variant={vipVariant(user.vipTier)} size="md">
                  {user.vipTier}
                </Badge>
                <Badge variant={user.status === 'active' ? 'success' : 'danger'} size="md" dot>
                  {user.status}
                </Badge>
              </div>

              <div className="text-left space-y-3 pt-4 border-t border-border">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-secondary">Role:</span>
                  <span className="text-text font-medium capitalize ml-auto">{user.role}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-secondary">KYC Level:</span>
                  <Badge variant={user.kycLevel >= 2 ? 'success' : 'warning'} size="xs" className="ml-auto">
                    Level {user.kycLevel}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <KeyRound className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-secondary">2FA:</span>
                  <Badge variant={user.twoFactorEnabled ? 'success' : 'default'} size="xs" className="ml-auto">
                    {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-secondary">Joined:</span>
                  <span className="text-text text-xs ml-auto">{formatDate(user.createdAt, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-secondary">Last login:</span>
                  <span className="text-text text-xs ml-auto">
                    {user.lastLoginAt ? formatRelativeDate(user.lastLoginAt) : 'Never'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-secondary">ID:</span>
                  <button
                    onClick={() => handleCopy(user.id, 'uid')}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-text ml-auto font-mono"
                  >
                    {user.id.substring(0, 12)}...
                    {copiedId === 'uid' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardBody className="space-y-2">
              <Button
                variant={user.status === 'banned' ? 'success' : 'danger'}
                size="sm"
                fullWidth
                leftIcon={<Ban className="w-4 h-4" />}
                onClick={() => setBanModal(true)}
              >
                {user.status === 'banned' ? 'Unban User' : 'Ban User'}
              </Button>
              <Button variant="secondary" size="sm" fullWidth leftIcon={<Wallet className="w-4 h-4" />} onClick={() => setBalanceModal(true)}>
                Adjust Balance
              </Button>
              <Button variant="secondary" size="sm" fullWidth leftIcon={<Star className="w-4 h-4" />} onClick={() => setVipModal(true)}>
                Set VIP Tier
              </Button>
              <Button variant="secondary" size="sm" fullWidth leftIcon={<KeyRound className="w-4 h-4" />} onClick={() => setResetPwModal(true)}>
                Reset Password
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Wagered', value: formatCurrency(Number(user.totalWagered) || 0, 'USDT'), icon: TrendingUp, color: 'text-accent' },
              { label: 'Total Won', value: formatCurrency(Number(user.totalWon) || 0, 'USDT'), icon: DollarSign, color: 'text-success' },
              { label: 'Total Deposited', value: formatCurrency(Number(user.totalDeposited) || 0, 'USDT'), icon: TrendingUp, color: 'text-info' },
              { label: 'Net P&L', value: formatCurrency(Math.abs(Number(user.netProfit) || 0), 'USDT'), icon: Number(user.netProfit) >= 0 ? TrendingUp : TrendingDown, color: Number(user.netProfit) >= 0 ? 'text-success' : 'text-danger' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn('w-3.5 h-3.5', color)} />
                  <span className="text-xs text-text-muted">{label}</span>
                </div>
                <p className={cn('text-lg font-bold font-mono', color === 'text-danger' ? 'text-danger' : 'text-text')}>
                  {Number(user.netProfit) < 0 && label === 'Net P&L' ? '-' : ''}{value}
                </p>
              </Card>
            ))}
          </div>

          {/* Wallet Balances */}
          <Card>
            <CardHeader>
              <CardTitle>Wallet Balances</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {wallets.map((w) => (
                  <div
                    key={w.currency}
                    className="p-3 bg-background rounded-card border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-text">{w.currency}</span>
                      {Number(w.locked) > 0 && (
                        <Badge variant="warning" size="xs">
                          Locked: {formatCurrency(w.locked, w.currency, { showSymbol: false })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-mono text-text font-medium">
                      {formatCurrency(w.available, w.currency)}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Total: {formatCurrency(w.total, w.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Tabs */}
          <Card noPadding>
            <div className="flex border-b border-border overflow-x-auto">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                    activeTab === key
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text hover:border-border-light',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* Bets Tab */}
              {activeTab === 'bets' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">Event</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Amount</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Odds</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bets.map((bet) => (
                        <tr key={bet.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                          <td className="py-2 px-3"><Badge variant={bet.type === 'parlay' ? 'accent' : 'default'} size="xs">{bet.type}</Badge></td>
                          <td className="py-2 px-3 text-text text-xs">{bet.eventName || '-'}</td>
                          <td className="py-2 px-3 text-right font-mono text-text">{formatCurrency(bet.amount, bet.currency)}</td>
                          <td className="py-2 px-3 text-right font-mono text-text-secondary">{Number(bet.odds ?? 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-center"><Badge variant={statusColor(bet.status) as any} size="xs">{bet.status}</Badge></td>
                          <td className="py-2 px-3 text-right text-xs text-text-muted">{formatDate(bet.createdAt, 'MMM d, HH:mm')}</td>
                        </tr>
                      ))}
                      {bets.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-text-muted">No bets found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Amount</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">Currency</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">TX Hash</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                          <td className="py-2 px-3"><Badge variant={tx.type === 'deposit' ? 'success' : tx.type === 'withdrawal' ? 'danger' : 'default'} size="xs">{tx.type}</Badge></td>
                          <td className={cn('py-2 px-3 text-right font-mono', Number(tx.amount) >= 0 ? 'text-success' : 'text-danger')}>
                            {Number(tx.amount) >= 0 ? '+' : ''}{formatCurrency(Math.abs(Number(tx.amount)), tx.currency)}
                          </td>
                          <td className="py-2 px-3 text-text font-mono text-xs">{tx.currency}</td>
                          <td className="py-2 px-3 text-center"><Badge variant={statusColor(tx.status) as any} size="xs">{tx.status}</Badge></td>
                          <td className="py-2 px-3 text-xs font-mono text-text-muted">{tx.txHash || '-'}</td>
                          <td className="py-2 px-3 text-right text-xs text-text-muted">{formatDate(tx.createdAt, 'MMM d, HH:mm')}</td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-text-muted">No transactions found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === 'documents' && (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-4 p-3 bg-background rounded-card border border-border">
                      <FileText className="w-8 h-8 text-text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text">{doc.type}</p>
                        <p className="text-xs text-text-muted">{doc.fileName}</p>
                        <p className="text-xs text-text-muted">Uploaded: {formatDate(doc.uploadedAt, 'MMM d, yyyy')}</p>
                      </div>
                      <Badge variant={statusColor(doc.status) as any} size="sm">
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <p className="text-center text-text-muted py-8">No documents uploaded.</p>
                  )}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add admin note..."
                      className="bg-background"
                    />
                    <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAddNote} disabled={!newNote.trim()}>
                      Add
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 bg-background rounded-card border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-accent">{note.adminUsername}</span>
                          <span className="text-xs text-text-muted">{formatRelativeDate(note.createdAt)}</span>
                        </div>
                        <p className="text-sm text-text-secondary">{note.content}</p>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="text-center text-text-muted py-8">No admin notes yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">IP</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">Device</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Started</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Last Active</th>
                        <th className="text-center py-2 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                          <td className="py-2 px-3 font-mono text-text text-xs">{session.ip}</td>
                          <td className="py-2 px-3 text-text-secondary text-xs">{session.userAgent}</td>
                          <td className="py-2 px-3 text-right text-xs text-text-muted">{formatDate(session.createdAt, 'MMM d, HH:mm')}</td>
                          <td className="py-2 px-3 text-right text-xs text-text-muted">{formatRelativeDate(session.lastActiveAt)}</td>
                          <td className="py-2 px-3 text-center">
                            {session.isCurrent ? (
                              <Badge variant="success" size="xs" dot pulse>Active</Badge>
                            ) : (
                              <Badge variant="default" size="xs">Expired</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                      {sessions.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-text-muted">No sessions found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Ban Modal */}
      <Modal open={banModal} onOpenChange={(open) => { setBanModal(open); if (!open) setBanReason(''); }}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>{user.status === 'banned' ? 'Unban' : 'Ban'} User</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary">
              Are you sure you want to {user.status === 'banned' ? 'unban' : 'ban'}{' '}
              <span className="font-medium text-text">{user.username}</span>?
            </p>
            {user.status !== 'banned' && (
              <div className="mt-3">
                <Input
                  label="Reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for ban (required)"
                  className="bg-background"
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => { setBanModal(false); setBanReason(''); }}>Cancel</Button>
            <Button
              variant={user.status === 'banned' ? 'success' : 'danger'}
              size="sm"
              isLoading={actionLoading}
              onClick={handleBan}
              disabled={user.status !== 'banned' && !banReason.trim()}
            >
              {user.status === 'banned' ? 'Unban' : 'Ban'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Balance Modal */}
      <Modal open={balanceModal} onOpenChange={setBalanceModal}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Adjust Balance</ModalTitle></ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Currency</label>
                <select
                  value={balanceCurrency}
                  onChange={(e) => setBalanceCurrency(e.target.value)}
                  className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text"
                >
                  {wallets.map((w) => (
                    <option key={w.currency} value={w.currency}>{w.currency}</option>
                  ))}
                </select>
              </div>
              <Input label="Amount" type="number" step="0.01" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="e.g. 100 or -50" className="bg-background" />
              <Input label="Reason" value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="Reason..." className="bg-background" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setBalanceModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} disabled={!balanceAmount || !balanceReason.trim()} onClick={handleAdjustBalance}>Adjust</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* VIP Modal */}
      <Modal open={vipModal} onOpenChange={setVipModal}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Set VIP Tier</ModalTitle></ModalHeader>
          <ModalBody>
            <div>
              <label className="block text-xs text-text-muted mb-1">VIP Tier</label>
              <select
                value={selectedVip}
                onChange={(e) => setSelectedVip(e.target.value)}
                className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text"
              >
                {['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite', 'Black Diamond', 'Blue Diamond'].map(
                  (t) => (<option key={t} value={t}>{t}</option>),
                )}
              </select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setVipModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} onClick={handleSetVip}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={resetPwModal} onOpenChange={setResetPwModal}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Reset Password</ModalTitle></ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary">
              This will send a password reset link to{' '}
              <span className="font-medium text-text">{user.email}</span>.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setResetPwModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} onClick={handleResetPassword}>Send Reset Link</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
