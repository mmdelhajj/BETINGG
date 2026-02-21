'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatCurrency } from '@/lib/utils';
import { get, put } from '@/lib/api';
import {
  Dice5,
  ToggleLeft,
  ToggleRight,
  Edit,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Trophy,
  Percent,
  Search,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CasinoGame {
  id: string;
  name: string;
  slug: string;
  type: string;
  provider?: string;
  providerId?: string;
  enabled?: boolean;
  isActive?: boolean;
  houseEdge: number | string;
  minBet?: number | string;
  maxBet?: number | string;
  totalBets?: number | string;
  totalRevenue?: number | string;
  rtp: number | string;
}

interface RevenueByGame {
  name: string;
  revenue: number;
  bets: number;
}

interface JackpotPool {
  tier: string;
  amount: number | string;
  seed?: number | string;
  seedAmount?: number | string;
  lastWon?: string;
  lastWonBy?: string;
  lastWonAmount?: number | string;
}

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
            {entry.name === 'Revenue' ? `$${Number(entry.value || 0).toLocaleString()}` : Number(entry.value || 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Casino Page
// ---------------------------------------------------------------------------

export default function AdminCasinoPage() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<CasinoGame[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueByGame[]>([]);
  const [jackpots, setJackpots] = useState<JackpotPool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal
  const [editGame, setEditGame] = useState<CasinoGame | null>(null);
  const [editForm, setEditForm] = useState({
    houseEdge: 0,
    minBet: 0,
    maxBet: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [gamesRes, revRes, jpRes] = await Promise.allSettled([
        get<any>('/admin/casino/games'),
        get<any>('/admin/casino/revenue-by-game'),
        get<any>('/admin/casino/jackpots'),
      ]);

      if (gamesRes.status === 'fulfilled') {
        const v = gamesRes.value;
        setGames(Array.isArray(v) ? v : v?.data || []);
      }
      else {
        setGames([
          { id: 'g-1', name: 'Crash', slug: 'crash', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 3.0, minBet: 0.10, maxBet: 10000, totalBets: 125420, totalRevenue: 48250, rtp: 97.0 },
          { id: 'g-2', name: 'Dice', slug: 'dice', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 1.0, minBet: 0.10, maxBet: 5000, totalBets: 89500, totalRevenue: 22100, rtp: 99.0 },
          { id: 'g-3', name: 'Mines', slug: 'mines', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 2.0, minBet: 0.10, maxBet: 5000, totalBets: 67800, totalRevenue: 18900, rtp: 98.0 },
          { id: 'g-4', name: 'Plinko', slug: 'plinko', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 2.5, minBet: 0.10, maxBet: 5000, totalBets: 45300, totalRevenue: 15200, rtp: 97.5 },
          { id: 'g-5', name: 'Coinflip', slug: 'coinflip', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 3.0, minBet: 0.10, maxBet: 10000, totalBets: 102000, totalRevenue: 35600, rtp: 97.0 },
          { id: 'g-6', name: 'Roulette', slug: 'roulette', type: 'table', provider: 'CryptoBet', enabled: true, houseEdge: 2.7, minBet: 1.00, maxBet: 10000, totalBets: 38200, totalRevenue: 21400, rtp: 97.3 },
          { id: 'g-7', name: 'Blackjack', slug: 'blackjack', type: 'table', provider: 'CryptoBet', enabled: true, houseEdge: 0.5, minBet: 1.00, maxBet: 10000, totalBets: 56100, totalRevenue: 8200, rtp: 99.5 },
          { id: 'g-8', name: 'HiLo', slug: 'hilo', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 2.0, minBet: 0.10, maxBet: 5000, totalBets: 29400, totalRevenue: 9800, rtp: 98.0 },
          { id: 'g-9', name: 'Wheel of Fortune', slug: 'wheel', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 3.5, minBet: 0.10, maxBet: 5000, totalBets: 22100, totalRevenue: 12400, rtp: 96.5 },
          { id: 'g-10', name: 'Tower', slug: 'tower', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 2.0, minBet: 0.10, maxBet: 5000, totalBets: 18500, totalRevenue: 7600, rtp: 98.0 },
          { id: 'g-11', name: 'Limbo', slug: 'limbo', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 1.0, minBet: 0.10, maxBet: 5000, totalBets: 42300, totalRevenue: 11200, rtp: 99.0 },
          { id: 'g-12', name: 'Keno', slug: 'keno', type: 'original', provider: 'CryptoBet', enabled: true, houseEdge: 4.0, minBet: 0.10, maxBet: 2000, totalBets: 15800, totalRevenue: 8400, rtp: 96.0 },
          { id: 'g-13', name: 'Video Poker', slug: 'video-poker', type: 'table', provider: 'CryptoBet', enabled: false, houseEdge: 1.5, minBet: 1.00, maxBet: 5000, totalBets: 8200, totalRevenue: 3100, rtp: 98.5 },
          { id: 'g-14', name: 'Baccarat', slug: 'baccarat', type: 'table', provider: 'CryptoBet', enabled: true, houseEdge: 1.2, minBet: 1.00, maxBet: 10000, totalBets: 31200, totalRevenue: 9800, rtp: 98.8 },
          { id: 'g-15', name: 'Slots', slug: 'slots', type: 'slots', provider: 'CryptoBet', enabled: true, houseEdge: 5.0, minBet: 0.10, maxBet: 1000, totalBets: 95200, totalRevenue: 52100, rtp: 95.0 },
        ]);
      }

      if (revRes.status === 'fulfilled') {
        const v = revRes.value;
        setRevenueData(Array.isArray(v) ? v : v?.data || []);
      }
      else {
        setRevenueData([
          { name: 'Crash', revenue: 48250, bets: 125420 },
          { name: 'Slots', revenue: 52100, bets: 95200 },
          { name: 'Coinflip', revenue: 35600, bets: 102000 },
          { name: 'Dice', revenue: 22100, bets: 89500 },
          { name: 'Roulette', revenue: 21400, bets: 38200 },
          { name: 'Mines', revenue: 18900, bets: 67800 },
          { name: 'Plinko', revenue: 15200, bets: 45300 },
          { name: 'Wheel', revenue: 12400, bets: 22100 },
          { name: 'Limbo', revenue: 11200, bets: 42300 },
          { name: 'Baccarat', revenue: 9800, bets: 31200 },
        ]);
      }

      if (jpRes.status === 'fulfilled') {
        const v = jpRes.value;
        setJackpots(Array.isArray(v) ? v : v?.data || []);
      }
      else {
        setJackpots([
          { tier: 'Mini', amount: 842.50, seed: 100, lastWon: '2025-01-08T12:00:00Z', lastWonBy: 'player_2045', lastWonAmount: 156.80 },
          { tier: 'Major', amount: 5840.25, seed: 1000, lastWon: '2024-12-28T18:30:00Z', lastWonBy: 'whale_99', lastWonAmount: 3200 },
          { tier: 'Grand', amount: 28450.00, seed: 10000, lastWon: '2024-11-15T22:15:00Z', lastWonBy: 'lucky_star', lastWonAmount: 18750 },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleGame = async (game: CasinoGame) => {
    const currentEnabled = game.enabled ?? game.isActive ?? true;
    try {
      await put(`/admin/casino/games/${game.id}`, { enabled: !currentEnabled });
      setGames((prev) => prev.map((g) => g.id === game.id ? { ...g, enabled: !currentEnabled } : g));
    } catch { /* silent */ }
  };

  const handleSaveEdit = async () => {
    if (!editGame) return;
    try {
      await put(`/admin/casino/games/${editGame.id}`, editForm);
      setGames((prev) =>
        prev.map((g) => g.id === editGame.id ? { ...g, ...editForm } : g),
      );
    } catch { /* silent */ }
    finally { setEditGame(null); }
  };

  const filteredGames = games.filter(
    (g) =>
      (g.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.type || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalRevenue = games.reduce((sum, g) => sum + (Number(g.totalRevenue) || 0), 0);
  const totalBets = games.reduce((sum, g) => sum + (Number(g.totalBets) || 0), 0);
  const avgRtp = games.length > 0 ? games.reduce((sum, g) => sum + (Number(g.rtp) || 0), 0) / games.length : 0;

  const rtpAlert = (rtp: number | string, houseEdge: number | string) => {
    const expected = 100 - (Number(houseEdge) || 0);
    return Math.abs((Number(rtp) || 0) - expected) > 1.5;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Casino Management</h1>
        <p className="text-sm text-text-muted mt-0.5">Manage games, house edge, and monitor RTP</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-success/15">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Casino Revenue</p>
              <p className="text-xl font-bold font-mono text-text">${Number(totalRevenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-accent/15">
              <BarChart3 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Bets Placed</p>
              <p className="text-xl font-bold font-mono text-text">{Number(totalBets || 0).toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-info/15">
              <Percent className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Average RTP</p>
              <p className="text-xl font-bold font-mono text-text">{Number(avgRtp || 0).toFixed(2)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            Revenue by Game
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363D" />
                <XAxis dataKey="name" stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#6E7681" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" name="Revenue" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Games List */}
      <Card noPadding>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <Dice5 className="w-4 h-4 text-accent" />
              Casino Games ({filteredGames.length})
            </h3>
            <Input
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefixIcon={<Search className="w-4 h-4" />}
              className="w-64 bg-background"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background-elevated/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Game</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Enabled</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">House Edge</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Min / Max Bet</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Total Bets</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Revenue</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">RTP</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGames.map((game) => (
                <tr
                  key={game.id}
                  className={cn(
                    'border-b border-border/50 hover:bg-background-elevated/30 transition-colors',
                    !(game.enabled ?? game.isActive ?? true) && 'opacity-60',
                  )}
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-text font-medium">{game.name}</p>
                      <p className="text-xs text-text-muted">{game.provider || game.providerId || 'Internal'}</p>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <Badge
                      variant={
                        game.type === 'original' ? 'accent' : game.type === 'table' ? 'info' : 'warning'
                      }
                      size="xs"
                    >
                      {game.type}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button onClick={() => handleToggleGame(game)}>
                      {(game.enabled ?? game.isActive ?? true) ? (
                        <ToggleRight className="w-6 h-6 text-success mx-auto" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-text-muted mx-auto" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-text">
                    {Number(game.houseEdge || 0).toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="font-mono text-text-secondary text-xs">
                      ${Number(game.minBet || 0).toFixed(2)} / ${Number(game.maxBet || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-text">
                    {Number(game.totalBets || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-success font-medium">
                    ${Number(game.totalRevenue || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span className={cn('font-mono', rtpAlert(game.rtp, game.houseEdge) ? 'text-warning font-bold' : 'text-text')}>
                        {Number(game.rtp || 0).toFixed(1)}%
                      </span>
                      {rtpAlert(Number(game.rtp || 0), Number(game.houseEdge || 0)) && (
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditGame(game);
                        setEditForm({ houseEdge: Number(game.houseEdge || 0), minBet: Number(game.minBet || 0), maxBet: Number(game.maxBet || 0) });
                      }}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* RTP Monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            RTP Monitoring
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            {games
              .filter((g) => rtpAlert(g.rtp, g.houseEdge))
              .map((game) => (
                <div key={game.id} className="flex items-center justify-between p-3 bg-warning/5 rounded-card border border-warning/20">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-text">{game.name}</p>
                      <p className="text-xs text-text-muted">
                        Expected RTP: {(100 - (Number(game.houseEdge) || 0)).toFixed(1)}% | Actual: {Number(game.rtp || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <Badge variant="warning" size="sm">
                    {((Number(game.rtp) || 0) - (100 - (Number(game.houseEdge) || 0))).toFixed(1)}% deviation
                  </Badge>
                </div>
              ))}
            {games.filter((g) => rtpAlert(g.rtp, g.houseEdge)).length === 0 && (
              <p className="text-center text-text-muted py-6">All games are within expected RTP range.</p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Jackpot Pools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" />
            Jackpot Pools
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {jackpots.map((jp) => (
              <div
                key={jp.tier}
                className={cn(
                  'p-4 rounded-card border',
                  jp.tier === 'Grand'
                    ? 'bg-yellow-500/5 border-yellow-500/20'
                    : jp.tier === 'Major'
                    ? 'bg-accent/5 border-accent/20'
                    : 'bg-background border-border',
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    variant={jp.tier === 'Grand' ? 'gold' : jp.tier === 'Major' ? 'accent' : 'default'}
                    size="md"
                  >
                    {jp.tier}
                  </Badge>
                  <span className="text-[10px] text-text-muted">Seed: ${Number(jp.seed || jp.seedAmount || 0).toLocaleString()}</span>
                </div>
                <p className="text-2xl font-bold font-mono text-text mb-2">
                  ${Number(jp.amount || 0).toLocaleString()}
                </p>
                {jp.lastWon && (
                  <div className="text-xs text-text-muted">
                    <p>Last won: ${Number(jp.lastWonAmount || 0).toLocaleString()} by {jp.lastWonBy}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Edit Game Modal */}
      <Modal open={!!editGame} onOpenChange={() => setEditGame(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Edit {editGame?.name} Configuration</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">
                  House Edge: {Number(editForm.houseEdge || 0).toFixed(1)}%
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={editForm.houseEdge}
                  onChange={(e) => setEditForm({ ...editForm, houseEdge: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-background-elevated rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex justify-between text-[10px] text-text-muted mt-1">
                  <span>0.5%</span>
                  <span>10%</span>
                </div>
              </div>
              <Input
                label="Min Bet ($)"
                type="number"
                step="0.01"
                value={String(editForm.minBet)}
                onChange={(e) => setEditForm({ ...editForm, minBet: parseFloat(e.target.value) || 0 })}
                className="bg-background"
              />
              <Input
                label="Max Bet ($)"
                type="number"
                step="1"
                value={String(editForm.maxBet)}
                onChange={(e) => setEditForm({ ...editForm, maxBet: parseFloat(e.target.value) || 0 })}
                className="bg-background"
              />
              <div className="p-3 bg-background rounded-card border border-border text-xs text-text-muted">
                <p>Expected RTP: <span className="text-text font-mono">{(100 - Number(editForm.houseEdge || 0)).toFixed(1)}%</span></p>
                <p>Current actual RTP: <span className="text-text font-mono">{Number(editGame?.rtp || 0).toFixed(1)}%</span></p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditGame(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSaveEdit}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
