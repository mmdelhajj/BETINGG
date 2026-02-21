'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { get, post, put } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/api';
import {
  Search,
  Filter,
  Eye,
  Ban,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  UserCheck,
  Shield,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  vipTier: string;
  kycLevel: number;
  balance: number;
  currency: string;
  status: 'active' | 'banned' | 'suspended';
  createdAt: string;
  totalWagered: number;
}

type SortField = 'username' | 'email' | 'vipTier' | 'balance' | 'createdAt' | 'totalWagered';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 px-3"><div className="flex items-center gap-3"><Skeleton className="w-8 h-8 rounded-full" /><div className="space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-32" /></div></div></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-16" /></td>
      <td className="py-3 px-3"><Skeleton className="h-5 w-12" /></td>
      <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
      <td className="py-3 px-3 text-center"><Skeleton className="h-5 w-14 mx-auto" /></td>
      <td className="py-3 px-3 text-right"><Skeleton className="h-3 w-24 ml-auto" /></td>
      <td className="py-3 px-3 text-right"><Skeleton className="h-7 w-20 ml-auto" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// VIP tier badge color mapping
// ---------------------------------------------------------------------------

const vipVariant = (tier: string): any => {
  const map: Record<string, string> = {
    bronze: 'bronze',
    silver: 'silver',
    gold: 'gold',
    platinum: 'platinum',
    diamond: 'diamond',
    elite: 'elite',
    'black diamond': 'black-diamond',
    'blue diamond': 'blue-diamond',
  };
  return map[(tier || '').toLowerCase()] || 'default';
};

// ---------------------------------------------------------------------------
// Users Page
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Filters
  const [search, setSearch] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [bannedFilter, setBannedFilter] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Modals
  const [banModal, setBanModal] = useState<User | null>(null);
  const [balanceModal, setBalanceModal] = useState<User | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: sortField,
        sortDir,
      });
      if (search) params.set('search', search);
      if (vipFilter) params.set('vipTier', vipFilter);
      if (kycFilter) params.set('kycLevel', kycFilter);
      if (bannedFilter) params.set('status', 'banned');

      const res = await get<PaginatedResponse<User>>(`/admin/users?${params}`);
      setUsers(res?.data || []);
      setTotal(res?.total || 0);
      setTotalPages(res?.totalPages || 1);
    } catch {
      // Fallback data
      const mockUsers: User[] = Array.from({ length: 20 }, (_, i) => ({
        id: `usr-${i}`,
        username: `player_${1000 + i}`,
        email: `player${1000 + i}@example.com`,
        vipTier: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'][Math.floor(Math.random() * 5)],
        kycLevel: Math.floor(Math.random() * 4),
        balance: Math.random() * 10000,
        currency: 'USDT',
        status: i === 3 ? 'banned' : 'active',
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 365).toISOString(),
        totalWagered: Math.random() * 100000,
      }));
      setUsers(mockUsers);
      setTotal(247);
      setTotalPages(13);
    } finally {
      setLoading(false);
    }
  }, [page, search, vipFilter, kycFilter, bannedFilter, sortField, sortDir]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-accent" />
    ) : (
      <ArrowDown className="w-3 h-3 text-accent" />
    );
  };

  const handleBan = async () => {
    if (!banModal) return;
    setActionLoading(true);
    try {
      const action = banModal.status === 'banned' ? 'unban' : 'ban';
      await put(`/admin/users/${banModal.id}/${action}`, {});
      setUsers((prev) =>
        prev.map((u) =>
          u.id === banModal.id
            ? { ...u, status: action === 'ban' ? 'banned' : 'active' }
            : u,
        ),
      );
    } catch {
      // silent
    } finally {
      setActionLoading(false);
      setBanModal(null);
    }
  };

  const handleAdjustBalance = async () => {
    if (!balanceModal || !balanceAmount) return;
    setActionLoading(true);
    try {
      await post(`/admin/users/${balanceModal.id}/adjust-balance`, {
        amount: parseFloat(balanceAmount),
        reason: balanceReason,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === balanceModal.id
            ? { ...u, balance: u.balance + parseFloat(balanceAmount) }
            : u,
        ),
      );
    } catch {
      // silent
    } finally {
      setActionLoading(false);
      setBalanceModal(null);
      setBalanceAmount('');
      setBalanceReason('');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text">User Management</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {Number(total ?? 0).toLocaleString()} total users
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <Input
                placeholder="Search by username or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefixIcon={<Search className="w-4 h-4" />}
                className="bg-background"
              />
              <Button type="submit" variant="secondary" size="md">
                Search
              </Button>
            </form>
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              size="md"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3 items-end">
              <div className="w-40">
                <label className="block text-xs text-text-muted mb-1">VIP Tier</label>
                <select
                  value={vipFilter}
                  onChange={(e) => { setVipFilter(e.target.value); setPage(1); }}
                  className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="">All tiers</option>
                  {['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite', 'Black Diamond', 'Blue Diamond'].map(
                    (t) => (
                      <option key={t} value={t}>{t}</option>
                    ),
                  )}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-xs text-text-muted mb-1">KYC Level</label>
                <select
                  value={kycFilter}
                  onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
                  className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="">All</option>
                  <option value="0">Level 0</option>
                  <option value="1">Level 1</option>
                  <option value="2">Level 2</option>
                  <option value="3">Level 3</option>
                </select>
              </div>
              <label className="flex items-center gap-2 h-10 px-3 bg-background border border-border rounded-input cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannedFilter}
                  onChange={(e) => { setBannedFilter(e.target.checked); setPage(1); }}
                  className="rounded accent-accent"
                />
                <span className="text-sm text-text-secondary">Banned only</span>
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setVipFilter('');
                  setKycFilter('');
                  setBannedFilter(false);
                  setPage(1);
                }}
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Table */}
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background-elevated/50">
                <th
                  className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text"
                  onClick={() => handleSort('username')}
                >
                  <span className="flex items-center gap-1">
                    User <SortIcon field="username" />
                  </span>
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  VIP
                </th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  KYC
                </th>
                <th
                  className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text"
                  onClick={() => handleSort('balance')}
                >
                  <span className="flex items-center gap-1 justify-end">
                    Balance <SortIcon field="balance" />
                  </span>
                </th>
                <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th
                  className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text"
                  onClick={() => handleSort('createdAt')}
                >
                  <span className="flex items-center gap-1 justify-end">
                    Joined <SortIcon field="createdAt" />
                  </span>
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/50 hover:bg-background-elevated/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                          {(user.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text truncate">
                            {user.username}
                          </p>
                          <p className="text-xs text-text-muted truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={vipVariant(user.vipTier)} size="xs">
                        {user.vipTier}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          user.kycLevel >= 3 ? 'success' : user.kycLevel >= 1 ? 'warning' : 'default'
                        }
                        size="xs"
                      >
                        L{user.kycLevel}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-text">
                      {formatCurrency(user.balance, user.currency)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant={user.status === 'active' ? 'success' : 'danger'}
                        size="xs"
                        dot
                      >
                        {user.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-text-muted">
                      {formatDate(user.createdAt, 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBanModal(user)}
                          className={user.status === 'banned' ? 'text-success hover:text-success' : 'text-danger hover:text-danger'}
                        >
                          {user.status === 'banned' ? (
                            <UserCheck className="w-3.5 h-3.5" />
                          ) : (
                            <Ban className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBalanceModal(user)}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <CardFooter className="px-4">
            <p className="text-xs text-text-muted">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of{' '}
              {Number(total ?? 0).toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                    onClick={() => setPage(p)}
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
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Ban/Unban Modal */}
      <Modal open={!!banModal} onOpenChange={() => setBanModal(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>
              {banModal?.status === 'banned' ? 'Unban User' : 'Ban User'}
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary">
              Are you sure you want to{' '}
              <span className="font-medium text-text">
                {banModal?.status === 'banned' ? 'unban' : 'ban'}
              </span>{' '}
              user{' '}
              <span className="font-medium text-text">{banModal?.username}</span>?
            </p>
            {banModal?.status !== 'banned' && (
              <p className="text-xs text-warning mt-2">
                This will immediately prevent the user from logging in or placing bets.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setBanModal(null)}>
              Cancel
            </Button>
            <Button
              variant={banModal?.status === 'banned' ? 'success' : 'danger'}
              size="sm"
              isLoading={actionLoading}
              onClick={handleBan}
            >
              {banModal?.status === 'banned' ? 'Unban' : 'Ban'} User
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Adjust Balance Modal */}
      <Modal open={!!balanceModal} onOpenChange={() => { setBalanceModal(null); setBalanceAmount(''); setBalanceReason(''); }}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Adjust Balance</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary mb-4">
              Adjusting balance for{' '}
              <span className="font-medium text-text">{balanceModal?.username}</span>.
              Current balance:{' '}
              <span className="font-mono text-text">
                {balanceModal && formatCurrency(balanceModal.balance, balanceModal.currency)}
              </span>
            </p>
            <div className="space-y-3">
              <Input
                label="Amount (+ to add, - to subtract)"
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="e.g. 100 or -50"
                className="bg-background"
              />
              <Input
                label="Reason"
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                placeholder="Reason for adjustment..."
                className="bg-background"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setBalanceModal(null); setBalanceAmount(''); setBalanceReason(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={actionLoading}
              disabled={!balanceAmount}
              onClick={handleAdjustBalance}
            >
              Adjust Balance
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
