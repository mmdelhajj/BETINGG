'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils';
import { get, post, put } from '@/lib/api';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Eye,
  X,
  Target,
  TrendingUp,
  BarChart3,
  History,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Bet {
  id: string;
  username: string;
  userId: string;
  type: 'single' | 'parlay' | 'system';
  sport: string;
  event: string;
  selection: string;
  odds: number;
  stake: number;
  currency: string;
  potentialWin: number;
  status: 'pending' | 'won' | 'lost' | 'void' | 'settled' | 'cashout';
  createdAt: string;
}

interface LiabilityItem {
  marketId: string;
  event: string;
  market: string;
  selections: {
    name: string;
    odds: number;
    totalStake: number;
    liability: number;
    betCount: number;
  }[];
  totalLiability: number;
  maxLiability: number;
}

interface SettlementLog {
  id: string;
  eventName: string;
  market: string;
  winningSelection: string;
  betsSettled: number;
  totalPayout: number;
  revenue: number;
  settledAt: string;
  settledBy: string;
}

type BettingTab = 'active' | 'liability' | 'settlements';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// Betting Management Page
// ---------------------------------------------------------------------------

export default function AdminBettingPage() {
  const [activeTab, setActiveTab] = useState<BettingTab>('active');
  const [loading, setLoading] = useState(true);

  // Active bets
  const [bets, setBets] = useState<Bet[]>([]);
  const [betPage, setBetPage] = useState(1);
  const [betTotal, setBetTotal] = useState(0);
  const [betTotalPages, setBetTotalPages] = useState(1);
  const [betSearch, setBetSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Liability
  const [liabilities, setLiabilities] = useState<LiabilityItem[]>([]);

  // Settlements
  const [settlements, setSettlements] = useState<SettlementLog[]>([]);

  // Modals
  const [voidModal, setVoidModal] = useState<Bet | null>(null);
  const [settleModal, setSettleModal] = useState<Bet | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [settleResult, setSettleResult] = useState<'won' | 'lost'>('won');
  const [actionLoading, setActionLoading] = useState(false);

  const sports = ['Football', 'Basketball', 'Tennis', 'Cricket', 'Baseball', 'Hockey', 'MMA', 'Boxing', 'Esports'];

  const fetchBets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(betPage),
        limit: '20',
        sortBy: sortField,
        sortDir,
      });
      if (betSearch) params.set('search', betSearch);
      if (sportFilter) params.set('sport', sportFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);

      const res = await get<any>(`/admin/bets?${params}`);
      setBets(res?.data || []);
      setBetTotal(res?.total || 0);
      setBetTotalPages(res?.totalPages || 1);
    } catch {
      const mockBets: Bet[] = Array.from({ length: 20 }, (_, i) => ({
        id: `bet-${i}`,
        username: `player_${1000 + Math.floor(Math.random() * 9000)}`,
        userId: `uid-${i}`,
        type: (['single', 'parlay', 'system'] as const)[Math.floor(Math.random() * 3)],
        sport: sports[Math.floor(Math.random() * sports.length)],
        event: [
          'Man City vs Liverpool',
          'Lakers vs Celtics',
          'Nadal vs Djokovic',
          'India vs Australia',
          'Yankees vs Red Sox',
          'Oilers vs Flames',
          'McGregor vs Makhachev',
          'T1 vs Gen.G',
        ][Math.floor(Math.random() * 8)],
        selection: ['Home Win', 'Away Win', 'Draw', 'Over 2.5', 'Under 2.5', 'Both Teams Score'][Math.floor(Math.random() * 6)],
        odds: Math.random() * 8 + 1.1,
        stake: Math.random() * 2000 + 10,
        currency: ['BTC', 'ETH', 'USDT'][Math.floor(Math.random() * 3)],
        potentialWin: 0,
        status: (['pending', 'won', 'lost', 'void', 'settled'] as const)[Math.floor(Math.random() * 5)],
        createdAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      }));
      mockBets.forEach((b) => { b.potentialWin = b.stake * b.odds; });
      setBets(mockBets);
      setBetTotal(486);
      setBetTotalPages(25);
    } finally {
      setLoading(false);
    }
  }, [betPage, betSearch, sportFilter, statusFilter, minAmount, maxAmount, sortField, sortDir]);

  const fetchLiabilities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>('/admin/bets/liability');
      setLiabilities(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setLiabilities([
        {
          marketId: 'm-1',
          event: 'Manchester City vs Liverpool',
          market: 'Match Winner',
          selections: [
            { name: 'Man City', odds: 2.10, totalStake: 45200, liability: 49720, betCount: 128 },
            { name: 'Draw', odds: 3.40, totalStake: 12800, liability: 30720, betCount: 45 },
            { name: 'Liverpool', odds: 3.60, totalStake: 28500, liability: 74100, betCount: 89 },
          ],
          totalLiability: 154540,
          maxLiability: 200000,
        },
        {
          marketId: 'm-2',
          event: 'Lakers vs Celtics',
          market: 'Moneyline',
          selections: [
            { name: 'Lakers', odds: 1.85, totalStake: 62000, liability: 52700, betCount: 210 },
            { name: 'Celtics', odds: 2.05, totalStake: 38400, liability: 40320, betCount: 145 },
          ],
          totalLiability: 93020,
          maxLiability: 150000,
        },
        {
          marketId: 'm-3',
          event: 'Nadal vs Djokovic',
          market: 'Match Winner',
          selections: [
            { name: 'Nadal', odds: 2.30, totalStake: 28900, liability: 37570, betCount: 78 },
            { name: 'Djokovic', odds: 1.65, totalStake: 41200, liability: 26780, betCount: 112 },
          ],
          totalLiability: 64350,
          maxLiability: 100000,
        },
        {
          marketId: 'm-4',
          event: 'Super Bowl LXII',
          market: 'Moneyline',
          selections: [
            { name: 'Kansas City', odds: 1.75, totalStake: 125000, liability: 93750, betCount: 456 },
            { name: 'Philadelphia', odds: 2.15, totalStake: 98000, liability: 112700, betCount: 389 },
          ],
          totalLiability: 206450,
          maxLiability: 250000,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>('/admin/bets/settlements?limit=20');
      setSettlements(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setSettlements(
        Array.from({ length: 15 }, (_, i) => ({
          id: `stl-${i}`,
          eventName: [
            'Arsenal vs Chelsea',
            'Warriors vs Bucks',
            'Federer vs Murray',
            'CSK vs MI',
            'Mets vs Dodgers',
          ][Math.floor(Math.random() * 5)],
          market: ['Match Winner', 'Over/Under', 'Both Teams Score', 'Moneyline', 'Handicap'][Math.floor(Math.random() * 5)],
          winningSelection: ['Home', 'Away', 'Over', 'Under', 'Draw'][Math.floor(Math.random() * 5)],
          betsSettled: Math.floor(Math.random() * 200) + 10,
          totalPayout: Math.random() * 50000 + 5000,
          revenue: Math.random() * 15000 - 3000,
          settledAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
          settledBy: Math.random() > 0.6 ? 'System (Auto)' : 'admin_ops',
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'active') fetchBets();
    else if (activeTab === 'liability') fetchLiabilities();
    else if (activeTab === 'settlements') fetchSettlements();
  }, [activeTab, fetchBets, fetchLiabilities, fetchSettlements]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />;
  };

  const handleVoid = async () => {
    if (!voidModal) return;
    setActionLoading(true);
    try {
      await put(`/admin/bets/${voidModal.id}/void`, { reason: voidReason });
      setBets((prev) => prev.map((b) => b.id === voidModal.id ? { ...b, status: 'void' } : b));
    } catch { /* silent */ }
    finally { setActionLoading(false); setVoidModal(null); setVoidReason(''); }
  };

  const handleSettle = async () => {
    if (!settleModal) return;
    setActionLoading(true);
    try {
      await put(`/admin/bets/${settleModal.id}/settle`, { result: settleResult });
      setBets((prev) => prev.map((b) => b.id === settleModal.id ? { ...b, status: settleResult } : b));
    } catch { /* silent */ }
    finally { setActionLoading(false); setSettleModal(null); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'won': case 'settled': return 'success';
      case 'lost': return 'danger';
      case 'pending': return 'warning';
      case 'void': return 'default';
      case 'cashout': return 'info';
      default: return 'default';
    }
  };

  const liabilityPercent = (current: number | string, max: number | string) => { const c = Number(current) || 0; const m = Number(max) || 1; return Math.min((c / m) * 100, 100); };
  const liabilityColor = (pct: number) => pct > 80 ? 'bg-danger' : pct > 60 ? 'bg-warning' : 'bg-success';

  const tabs: { key: BettingTab; label: string; icon: React.ElementType }[] = [
    { key: 'active', label: 'Active Bets', icon: Target },
    { key: 'liability', label: 'Liability Monitor', icon: BarChart3 },
    { key: 'settlements', label: 'Settlement Log', icon: History },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Betting Management</h1>
        <p className="text-sm text-text-muted mt-0.5">Manage bets, monitor liability, and review settlements</p>
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
          </button>
        ))}
      </div>

      {/* Active Bets Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Search by username, event, bet ID..."
                    value={betSearch}
                    onChange={(e) => setBetSearch(e.target.value)}
                    prefixIcon={<Search className="w-4 h-4" />}
                    className="bg-background"
                  />
                </div>
                <select
                  value={sportFilter}
                  onChange={(e) => { setSportFilter(e.target.value); setBetPage(1); }}
                  className="h-10 bg-background border border-border rounded-input px-3 text-sm text-text"
                >
                  <option value="">All sports</option>
                  {sports.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setBetPage(1); }}
                  className="h-10 bg-background border border-border rounded-input px-3 text-sm text-text"
                >
                  <option value="">All statuses</option>
                  {['pending', 'won', 'lost', 'void', 'settled', 'cashout'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button
                  variant={showFilters ? 'primary' : 'secondary'}
                  size="md"
                  leftIcon={<Filter className="w-4 h-4" />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  More
                </Button>
              </div>
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3 items-end">
                  <div className="w-32">
                    <label className="block text-xs text-text-muted mb-1">Min Stake</label>
                    <Input
                      type="number"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      placeholder="0"
                      className="bg-background"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-text-muted mb-1">Max Stake</label>
                    <Input
                      type="number"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      placeholder="99999"
                      className="bg-background"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBetSearch(''); setSportFilter(''); setStatusFilter('');
                      setMinAmount(''); setMaxAmount(''); setBetPage(1);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />Clear
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          <Card noPadding>
            {loading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-10 w-full" />
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background-elevated/50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">User</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Sport</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Event / Selection</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('odds')}>
                          <span className="flex items-center gap-1 justify-end">Odds <SortIcon field="odds" /></span>
                        </th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('stake')}>
                          <span className="flex items-center gap-1 justify-end">Stake <SortIcon field="stake" /></span>
                        </th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Potential Win</th>
                        <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('createdAt')}>
                          <span className="flex items-center gap-1 justify-end">Placed <SortIcon field="createdAt" /></span>
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bets.length === 0 ? (
                        <tr><td colSpan={10} className="py-16 text-center text-text-muted">No bets found.</td></tr>
                      ) : bets.map((bet) => (
                        <tr key={bet.id} className="border-b border-border/50 hover:bg-background-elevated/30 transition-colors">
                          <td className="py-2.5 px-4 text-text font-medium">{bet.username}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant={bet.type === 'parlay' ? 'accent' : bet.type === 'system' ? 'info' : 'default'} size="xs">{bet.type}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-text-secondary text-xs">{bet.sport}</td>
                          <td className="py-2.5 px-3">
                            <p className="text-text text-xs font-medium">{bet.event}</p>
                            <p className="text-text-muted text-xs">{bet.selection}</p>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-text">{Number(bet.odds ?? 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-text font-medium">
                            {formatCurrency(bet.stake, bet.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-text-secondary text-xs">
                            {formatCurrency(bet.potentialWin, bet.currency)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant={statusColor(bet.status) as any} size="xs">{bet.status}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-text-muted">{formatRelativeDate(bet.createdAt)}</td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {bet.status === 'pending' && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => setSettleModal(bet)} title="Settle manually">
                                    <CheckCircle className="w-3.5 h-3.5 text-success" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setVoidModal(bet)} title="Void bet">
                                    <XCircle className="w-3.5 h-3.5 text-danger" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {betTotalPages > 1 && (
                  <CardFooter className="px-4">
                    <p className="text-xs text-text-muted">Page {betPage} of {betTotalPages} ({Number(betTotal ?? 0).toLocaleString()} total)</p>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" disabled={betPage <= 1} onClick={() => setBetPage(betPage - 1)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      {Array.from({ length: Math.min(5, betTotalPages) }, (_, i) => {
                        let p: number;
                        if (betTotalPages <= 5) p = i + 1;
                        else if (betPage <= 3) p = i + 1;
                        else if (betPage >= betTotalPages - 2) p = betTotalPages - 4 + i;
                        else p = betPage - 2 + i;
                        return (
                          <button key={p} onClick={() => setBetPage(p)} className={cn('h-8 w-8 rounded-button text-xs font-medium transition-colors', p === betPage ? 'bg-accent text-white' : 'text-text-secondary hover:bg-background-elevated')}>{p}</button>
                        );
                      })}
                      <Button variant="ghost" size="sm" disabled={betPage >= betTotalPages} onClick={() => setBetPage(betPage + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardFooter>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Liability Monitor Tab */}
      {activeTab === 'liability' && (
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)
          ) : liabilities.length === 0 ? (
            <Card>
              <div className="py-16 text-center">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-3 opacity-50" />
                <p className="text-text-secondary">No active market liabilities</p>
              </div>
            </Card>
          ) : (
            liabilities.map((item) => {
              const pct = liabilityPercent(item.totalLiability, item.maxLiability);
              return (
                <Card key={item.marketId}>
                  <CardHeader>
                    <div>
                      <CardTitle>{item.event}</CardTitle>
                      <p className="text-xs text-text-muted mt-0.5">{item.market}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-text">${Number(item.totalLiability || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">of ${Number(item.maxLiability || 0).toLocaleString()} max</p>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', liabilityColor(pct))}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-text-muted">{pct.toFixed(0)}% of max liability</span>
                        {pct > 80 && (
                          <span className="flex items-center gap-1 text-[10px] text-danger">
                            <AlertTriangle className="w-3 h-3" />High exposure
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selections breakdown */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-xs font-medium text-text-muted uppercase">Selection</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Odds</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Total Stake</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Liability</th>
                            <th className="text-right py-2 px-3 text-xs font-medium text-text-muted uppercase">Bets</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(item.selections || []).map((sel, idx) => (
                            <tr key={idx} className="border-b border-border/50">
                              <td className="py-2 px-3 text-text font-medium">{sel.name}</td>
                              <td className="py-2 px-3 text-right font-mono text-text">{Number(sel.odds || 0).toFixed(2)}</td>
                              <td className="py-2 px-3 text-right font-mono text-text">${Number(sel.totalStake || 0).toLocaleString()}</td>
                              <td className="py-2 px-3 text-right font-mono text-danger font-medium">${Number(sel.liability || 0).toLocaleString()}</td>
                              <td className="py-2 px-3 text-right text-text-secondary">{sel.betCount ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Settlements Tab */}
      {activeTab === 'settlements' && (
        <Card noPadding>
          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Event</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Market</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Winner</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Bets Settled</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Total Payout</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Revenue</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Settled By</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-center text-text-muted">No settlement records.</td></tr>
                  ) : settlements.map((stl) => (
                    <tr key={stl.id} className="border-b border-border/50 hover:bg-background-elevated/30 transition-colors">
                      <td className="py-2.5 px-4 text-text font-medium">{stl.eventName}</td>
                      <td className="py-2.5 px-3 text-text-secondary">{stl.market}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="success" size="xs">{stl.winningSelection}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text">{stl.betsSettled}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-danger">${Number(stl.totalPayout || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className={cn('py-2.5 px-3 text-right font-mono font-medium', Number(stl.revenue || 0) >= 0 ? 'text-success' : 'text-danger')}>
                        {Number(stl.revenue || 0) >= 0 ? '+' : ''}${Number(stl.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary text-xs">
                        <Badge variant={(stl.settledBy || '').includes('Auto') ? 'info' : 'default'} size="xs">{stl.settledBy}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-text-muted">{formatRelativeDate(stl.settledAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Void Modal */}
      <Modal open={!!voidModal} onOpenChange={() => { setVoidModal(null); setVoidReason(''); }}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Void Bet</ModalTitle></ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary mb-3">
              Voiding bet <span className="font-mono text-text">{voidModal?.id}</span> for{' '}
              <span className="font-medium text-text">{voidModal?.username}</span>.
              Stake of <span className="font-mono text-text">{voidModal && formatCurrency(voidModal.stake, voidModal.currency)}</span> will be refunded.
            </p>
            <Input
              label="Reason for voiding"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Event cancelled, odds error..."
              className="bg-background"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => { setVoidModal(null); setVoidReason(''); }}>Cancel</Button>
            <Button variant="danger" size="sm" isLoading={actionLoading} disabled={!voidReason} onClick={handleVoid}>Void Bet</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Manual Settle Modal */}
      <Modal open={!!settleModal} onOpenChange={() => setSettleModal(null)}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Settle Bet Manually</ModalTitle></ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary mb-4">
              Settling bet <span className="font-mono text-text">{settleModal?.id}</span> for{' '}
              <span className="font-medium text-text">{settleModal?.username}</span>.
            </p>
            <div className="space-y-2">
              <p className="text-xs text-text-muted mb-1">Result</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettleResult('won')}
                  className={cn(
                    'flex-1 py-3 rounded-button text-sm font-medium border transition-colors',
                    settleResult === 'won'
                      ? 'bg-success/15 text-success border-success/25'
                      : 'bg-background-elevated text-text-secondary border-border hover:border-border-light',
                  )}
                >
                  Won
                </button>
                <button
                  onClick={() => setSettleResult('lost')}
                  className={cn(
                    'flex-1 py-3 rounded-button text-sm font-medium border transition-colors',
                    settleResult === 'lost'
                      ? 'bg-danger/15 text-danger border-danger/25'
                      : 'bg-background-elevated text-text-secondary border-border hover:border-border-light',
                  )}
                >
                  Lost
                </button>
              </div>
              {settleResult === 'won' && settleModal && (
                <p className="text-xs text-success mt-2">
                  Payout: <span className="font-mono font-medium">{formatCurrency(settleModal.potentialWin, settleModal.currency)}</span>
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setSettleModal(null)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} onClick={handleSettle}>Settle</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
