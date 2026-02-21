'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Trash2,
  Ticket,
  Zap,
  MinusCircle,
  Settings,
  Trophy,
  BarChart3,
  Clock,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { cn, formatOdds } from '@/lib/utils';
import {
  useBetSlipStore,
  selectSelections,
  selectBetType,
  selectIsPlacing,
  type BetSelection,
} from '@/stores/betSlipStore';
import { useAuthStore, selectIsAuthenticated, selectBalance, selectPreferredCurrency } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { toastSuccess, toastError } from '@/components/ui/toast';
import { get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_STAKES: Record<string, number[]> = {
  BTC: [0.001, 0.005, 0.01, 0.05],
  ETH: [0.01, 0.05, 0.1, 0.5],
  USDT: [10, 25, 50, 100],
  USDC: [10, 25, 50, 100],
  SOL: [0.1, 0.5, 1, 5],
  BNB: [0.01, 0.05, 0.1, 0.5],
  DOGE: [10, 50, 100, 500],
  XRP: [5, 10, 50, 100],
  ADA: [10, 50, 100, 500],
  DOT: [1, 5, 10, 50],
  LTC: [0.1, 0.5, 1, 5],
  AVAX: [0.5, 1, 5, 10],
  MATIC: [10, 50, 100, 500],
  TRX: [50, 100, 500, 1000],
  LINK: [1, 5, 10, 50],
  SHIB: [100000, 500000, 1000000, 5000000],
};
const DEFAULT_QUICK_STAKES = [10, 25, 50, 100];

const SPORT_FILTER_PILLS = [
  { id: 'tennis', label: 'Tennis', icon: '🎾' },
  { id: 'football', label: 'FIFA', icon: '⚽' },
  { id: 'hockey', label: 'Ice Hockey', icon: '🏒' },
  { id: 'basketball', label: 'Basketball', icon: '🏀' },
  { id: 'volleyball', label: 'Beach Volleyball', icon: '🏐' },
  { id: 'esports', label: 'Esports', icon: '🎮' },
  { id: 'baseball', label: 'Baseball', icon: '⚾' },
];

const MOCK_SHARPEST_BETTORS = [
  { rank: 1, name: 'CryptoKing', roi: 34.2, profit: 12450, color: 'bg-yellow-500' },
  { rank: 2, name: 'BetMaster99', roi: 28.7, profit: 8930, color: 'bg-gray-300' },
  { rank: 3, name: 'SharpEdge', roi: 22.1, profit: 6720, color: 'bg-amber-700' },
  { rank: 4, name: 'OddsWhiz', roi: 18.9, profit: 4510, color: 'bg-[#30363D]' },
  { rank: 5, name: 'ValueHunter', roi: 15.3, profit: 3280, color: 'bg-[#30363D]' },
];

const MOCK_LIVE_MATCHES = [
  {
    competition: 'ATP Australian Open',
    sport: 'tennis',
    matches: [
      {
        id: 'lm1',
        home: 'N. Djokovic',
        away: 'C. Alcaraz',
        homeScore: '6-4, 3',
        awayScore: '4-6, 2',
        homeOdds: 1.55,
        awayOdds: 2.40,
        isLive: true,
        set: '2nd Set',
      },
    ],
  },
  {
    competition: 'Premier League',
    sport: 'football',
    matches: [
      {
        id: 'lm2',
        home: 'Arsenal',
        away: 'Chelsea',
        homeScore: '2',
        awayScore: '1',
        homeOdds: 1.25,
        awayOdds: 8.50,
        drawOdds: 5.20,
        isLive: true,
        minute: "67'",
      },
    ],
  },
  {
    competition: 'NBA',
    sport: 'basketball',
    matches: [
      {
        id: 'lm3',
        home: 'Lakers',
        away: 'Celtics',
        homeScore: '89',
        awayScore: '95',
        homeOdds: 2.80,
        awayOdds: 1.42,
        isLive: true,
        quarter: 'Q3',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatAmount(amount: number, currency: string): string {
  const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'LTC', 'XRP', 'DOGE'].includes(currency);
  if (isCrypto) {
    if (amount === 0) return '0';
    if (amount < 0.0001) return amount.toFixed(8);
    if (amount < 0.01) return amount.toFixed(6);
    if (amount < 1) return amount.toFixed(4);
    return amount.toFixed(4);
  }
  return amount.toFixed(2);
}

function parseTeams(eventName: string): { home: string; away: string } {
  const parts = eventName.split(/\s+(?:vs?\.?|@)\s+/i);
  if (parts.length >= 2) {
    return { home: parts[0].trim(), away: parts[1].trim() };
  }
  return { home: eventName, away: '' };
}

// ---------------------------------------------------------------------------
// Sub-component: In-Play Widget
// ---------------------------------------------------------------------------

function InPlayWidget() {
  const [activeSport, setActiveSport] = useState('tennis');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredMatches = MOCK_LIVE_MATCHES.filter(
    (c) => c.sport === activeSport || activeSport === 'all',
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E2430]">
        <div className="relative flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">In-play</span>
        </div>
        <div className="ml-auto">
          <Activity className="h-3.5 w-3.5 text-[#6B7280]" />
        </div>
      </div>

      {/* Sport filter pills */}
      <div className="px-3 py-2 border-b border-[#1E2430]">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5"
        >
          {SPORT_FILTER_PILLS.map((sport) => (
            <button
              key={sport.id}
              onClick={() => setActiveSport(sport.id)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all duration-200 shrink-0',
                activeSport === sport.id
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-[#1C2128] text-[#8B9AB0] hover:bg-[#21262D] hover:text-white',
              )}
            >
              <span className="text-xs">{sport.icon}</span>
              {sport.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live matches */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filteredMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Activity className="h-8 w-8 text-[#30363D] mb-2" />
            <p className="text-xs text-[#6B7280]">No live matches in this sport</p>
          </div>
        ) : (
          filteredMatches.map((comp, ci) => (
            <div key={ci}>
              {/* Competition header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-[#0D1117]/50">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide truncate">
                  {comp.competition}
                </span>
                <ChevronRight className="h-3 w-3 text-[#30363D] ml-auto shrink-0" />
              </div>

              {comp.matches.map((match) => (
                <div
                  key={match.id}
                  className="px-4 py-2.5 border-b border-[#1E2430]/50 hover:bg-[#161B22] transition-colors cursor-pointer"
                >
                  {/* Market label */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <BarChart3 className="h-3 w-3 text-[#6B7280]" />
                    <span className="text-[10px] text-[#6B7280] font-medium">Winner</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] text-[#6B7280] font-medium">1</span>
                      {'drawOdds' in match && (
                        <span className="text-[10px] text-[#6B7280] font-medium">X</span>
                      )}
                      <span className="text-[10px] text-[#6B7280] font-medium">2</span>
                    </div>
                  </div>

                  {/* Home row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                    </span>
                    <span className="text-xs text-white font-medium flex-1 truncate">
                      {match.home}
                    </span>
                    <span className="text-[10px] font-mono text-[#8B9AB0] w-10 text-center">
                      {match.homeScore}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded min-w-[44px] text-center">
                      {match.homeOdds.toFixed(2)}
                    </span>
                  </div>

                  {/* Away row */}
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0" />
                    <span className="text-xs text-[#8B9AB0] font-medium flex-1 truncate">
                      {match.away}
                    </span>
                    <span className="text-[10px] font-mono text-[#8B9AB0] w-10 text-center">
                      {match.awayScore}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-white bg-[#1C2128] px-2 py-0.5 rounded min-w-[44px] text-center border border-[#30363D]">
                      {match.awayOdds.toFixed(2)}
                    </span>
                  </div>

                  {/* Match time indicator */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="h-2.5 w-2.5 text-[#6B7280]" />
                    <span className="text-[9px] text-[#6B7280]">
                      {'set' in match && match.set}
                      {'minute' in match && match.minute}
                      {'quarter' in match && match.quarter}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Sharpest Bettors Widget
// ---------------------------------------------------------------------------

function SharpestBettorsWidget() {
  return (
    <div className="border-t border-[#1E2430]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E2430]">
        <Trophy className="h-3.5 w-3.5 text-yellow-500" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">
          Sharpest Bettors
        </span>
      </div>

      {/* Rankings */}
      <div className="px-3 py-2">
        {MOCK_SHARPEST_BETTORS.map((bettor) => (
          <div
            key={bettor.rank}
            className="flex items-center gap-2.5 py-2 border-b border-[#1E2430]/50 last:border-0"
          >
            {/* Rank badge */}
            <div
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px] font-bold',
                bettor.rank === 1 && 'bg-yellow-500 text-black',
                bettor.rank === 2 && 'bg-gray-300 text-black',
                bettor.rank === 3 && 'bg-amber-700 text-white',
                bettor.rank > 3 && 'bg-[#1C2128] text-[#6B7280] border border-[#30363D]',
              )}
            >
              {bettor.rank}
            </div>

            {/* Name */}
            <span className="text-xs text-white font-medium flex-1 truncate">
              {bettor.name}
            </span>

            {/* ROI */}
            <span className="text-[10px] font-mono font-bold text-[#10B981]">
              +{bettor.roi}%
            </span>

            {/* Profit */}
            <span className="text-[10px] font-mono text-[#8B9AB0] min-w-[50px] text-right">
              ${bettor.profit.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Odds Change Toggle
// ---------------------------------------------------------------------------

function OddsChangeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-2.5 w-full py-2"
      type="button"
    >
      <div
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0',
          enabled ? 'bg-[#8B5CF6]' : 'bg-[#30363D]',
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm',
            enabled && 'translate-x-4',
          )}
        />
      </div>
      <span className="text-[11px] text-[#6B7280] leading-tight">
        Accept all odds changes and partial placements
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Parlay Leg Card
// ---------------------------------------------------------------------------

interface LegCardProps {
  selection: BetSelection;
  onRemove: () => void;
  showStakeInput?: boolean;
  stake?: number;
  onStakeChange?: (v: number) => void;
  displayCurrency: string;
}

function LegCard({
  selection,
  onRemove,
  showStakeInput,
  stake,
  onStakeChange,
  displayCurrency,
}: LegCardProps) {
  const [flashClass, setFlashClass] = useState('');
  const { home, away } = parseTeams(selection.eventName);

  useEffect(() => {
    if (selection.previousOdds && selection.previousOdds !== selection.odds) {
      const increased = selection.odds > selection.previousOdds;
      setFlashClass(increased ? 'animate-flash-green' : 'animate-flash-red');
      const timer = setTimeout(() => setFlashClass(''), 500);
      return () => clearTimeout(timer);
    }
  }, [selection.odds, selection.previousOdds]);

  return (
    <div className="relative group">
      {/* Event Card */}
      <div className="bg-[#141922] border border-[#1E2430] rounded-lg p-3 hover:border-[#30363D] transition-colors duration-200">
        {/* Top row: teams + live indicator + remove */}
        <div className="flex items-start gap-2">
          {/* Team info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-4 h-4 rounded-full bg-[#1C2128] flex items-center justify-center shrink-0 border border-[#30363D]">
                <span className="text-[7px] font-bold text-[#8B9AB0]">
                  {home.charAt(0)}
                </span>
              </div>
              <span className="text-[11px] text-white truncate font-medium">{home}</span>
            </div>
            {away && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#1C2128] flex items-center justify-center shrink-0 border border-[#30363D]">
                  <span className="text-[7px] font-bold text-[#8B9AB0]">
                    {away.charAt(0)}
                  </span>
                </div>
                <span className="text-[11px] text-[#8B9AB0] truncate font-medium">{away}</span>
              </div>
            )}
          </div>

          {/* Live indicator */}
          {selection.isLive && (
            <Badge variant="live" size="xs" dot pulse>
              LIVE
            </Badge>
          )}

          {/* Remove button */}
          <button
            onClick={onRemove}
            className="shrink-0 w-5 h-5 flex items-center justify-center text-[#30363D] hover:text-red-500 transition-colors duration-200 opacity-0 group-hover:opacity-100"
          >
            <MinusCircle className="h-4 w-4" />
          </button>
        </div>

        {/* Selection & Odds */}
        <div className="mt-2 pt-2 border-t border-[#1E2430]">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white truncate">
                {selection.outcomeName}
              </p>
              <p className="text-[10px] text-[#6B7280] truncate mt-0.5">
                {selection.marketName}
              </p>
            </div>
            <span
              className={cn(
                'font-mono text-[13px] text-[#10B981] font-bold ml-2 bg-[#10B981]/10 px-2 py-0.5 rounded',
                flashClass,
              )}
            >
              {formatOdds(selection.odds)}
            </span>
          </div>
        </div>

        {/* Single bet stake input */}
        {showStakeInput && onStakeChange !== undefined && (
          <div className="mt-2 pt-2 border-t border-[#1E2430]">
            <div className="flex items-center gap-2 bg-[#0D1117] rounded-md px-2.5 py-2 border border-[#1E2430] focus-within:border-[#8B5CF6]/50 transition-colors">
              <span className="text-[10px] text-[#6B7280] font-semibold shrink-0">
                {displayCurrency}
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={stake || ''}
                onChange={(e) => onStakeChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-xs font-mono text-white placeholder:text-[#30363D] focus:outline-none text-right"
              />
            </div>
            {stake && stake > 0 && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-[#6B7280]">To return</span>
                <span className="text-[10px] font-mono text-[#10B981] font-medium">
                  {displayCurrency} {formatAmount(stake * selection.odds, displayCurrency)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Empty State (Cloudbet-style with watermark)
// ---------------------------------------------------------------------------

function EmptyState({ message, sub, showHistory }: { message: string; sub: string; showHistory?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-12">
      {/* Cloudbet-style logo watermark */}
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-2xl bg-[#141922] flex items-center justify-center border border-[#1E2430] opacity-40">
          <Ticket className="h-8 w-8 text-[#30363D]" />
        </div>
      </div>
      <p className="text-sm font-medium text-[#6B7280] mb-1">{message}</p>
      <p className="text-xs text-[#30363D]">{sub}</p>
      {showHistory && (
        <button className="mt-4 text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-medium transition-colors">
          View bet history
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Settings Panel
// ---------------------------------------------------------------------------

function SettingsPanel({
  oddsChangePolicy,
  setOddsChangePolicy,
  onClose,
}: {
  oddsChangePolicy: string;
  setOddsChangePolicy: (v: 'accept_any' | 'accept_higher' | 'reject') => void;
  onClose: () => void;
}) {
  const options = [
    { value: 'accept_any' as const, label: 'Accept all odds changes' },
    { value: 'accept_higher' as const, label: 'Accept higher odds only' },
    { value: 'reject' as const, label: 'Reject all odds changes' },
  ];

  return (
    <div className="absolute top-full right-0 mt-1 bg-[#141922] border border-[#1E2430] rounded-lg shadow-2xl shadow-black/50 z-50 p-3 min-w-[220px]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white">Odds Settings</span>
        <button onClick={onClose} className="text-[#6B7280] hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setOddsChangePolicy(opt.value);
              onClose();
            }}
            className={cn(
              'w-full text-left px-2.5 py-2 text-xs rounded transition-colors duration-200',
              oddsChangePolicy === opt.value
                ? 'bg-[#8B5CF6]/15 text-[#A78BFA]'
                : 'text-[#8B9AB0] hover:bg-[#1C2128] hover:text-white',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: My Bets Panel
// ---------------------------------------------------------------------------

interface MyBet {
  id: string;
  referenceId: string;
  type: string;
  stake: string;
  currency: string;
  potentialWin: string;
  actualWin: string | null;
  odds: string;
  status: string;
  isLive: boolean;
  isCashoutAvailable: boolean;
  createdAt: string;
  legs: Array<{
    id: string;
    eventName: string | null;
    marketName: string | null;
    selectionName: string | null;
    oddsAtPlacement: string;
    status: string;
    event: { name: string; status: string; scores: unknown };
  }>;
}

function MyBetsPanel({
  displayCurrency,
  isAuthenticated,
  onClose,
}: {
  displayCurrency: string;
  isAuthenticated: boolean;
  onClose?: () => void;
}) {
  const [bets, setBets] = useState<MyBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'active' | 'settled'>('active');
  const [showOutrights, setShowOutrights] = useState(false);

  const fetchBets = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await get<{ bets: MyBet[] }>('/betting/open');
      setBets(res.bets || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load bets');
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'WON': return 'text-[#10B981]';
      case 'LOST': return 'text-[#EF4444]';
      case 'VOID': case 'CASHOUT': return 'text-[#F59E0B]';
      default: return 'text-[#8B9AB0]';
    }
  };

  const statusBg = (s: string) => {
    switch (s) {
      case 'WON': return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20';
      case 'LOST': return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
      case 'VOID': case 'CASHOUT': return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20';
      default: return 'bg-[#8B5CF6]/10 text-[#A78BFA] border-[#8B5CF6]/20';
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* MY BETS Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2430]">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-[#8B5CF6]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">My Bets</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-[#6B7280] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Active / Settled toggle */}
      <div className="px-3 py-2 border-b border-[#1E2430]">
        <div className="flex gap-1 bg-[#0D1117] rounded-lg p-0.5">
          <button
            onClick={() => setActiveFilter('active')}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 text-center',
              activeFilter === 'active'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#6B7280] hover:text-[#8B9AB0]',
            )}
          >
            Active
          </button>
          <button
            onClick={() => setActiveFilter('settled')}
            className={cn(
              'flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 text-center',
              activeFilter === 'settled'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#6B7280] hover:text-[#8B9AB0]',
            )}
          >
            Settled
          </button>
        </div>

        {/* Outrights toggle */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[#6B7280] font-medium">Outrights</span>
          <button
            onClick={() => setShowOutrights(!showOutrights)}
            type="button"
          >
            <div
              className={cn(
                'relative w-8 h-[18px] rounded-full transition-colors duration-200',
                showOutrights ? 'bg-[#8B5CF6]' : 'bg-[#30363D]',
              )}
            >
              <div
                className={cn(
                  'absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 shadow-sm',
                  showOutrights && 'translate-x-[14px]',
                )}
              />
            </div>
          </button>
        </div>
      </div>

      {!isAuthenticated ? (
        <EmptyState
          message="Sign in to see your bets"
          sub="Log in to view your active and settled bets"
          showHistory
        />
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#8B5CF6]/30 border-t-[#8B5CF6] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {error && (
            <div className="px-3 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20">
              {error}
              <button onClick={fetchBets} className="ml-2 underline hover:no-underline">
                Retry
              </button>
            </div>
          )}

          {bets.length === 0 ? (
            <EmptyState
              message="No bets available"
              sub="Place a bet to see it here"
              showHistory
            />
          ) : (
            <div className="p-2.5 space-y-2">
              {bets.map((bet) => (
                <div
                  key={bet.id}
                  className="bg-[#141922] border border-[#1E2430] rounded-lg p-3 hover:border-[#30363D] transition-colors"
                >
                  {/* Header: type + status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-[#6B7280] tracking-wide">
                        {bet.type}
                      </span>
                      {bet.isLive && (
                        <Badge variant="live" size="xs" dot pulse>
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
                        statusBg(bet.status),
                      )}
                    >
                      {bet.status}
                    </span>
                  </div>

                  {/* Legs */}
                  {bet.legs.map((leg, i) => (
                    <div key={leg.id || i} className="mb-1.5 last:mb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white font-medium truncate flex-1 mr-2">
                          {leg.selectionName || 'Selection'}
                        </span>
                        <span className="text-xs font-mono text-[#10B981] font-bold shrink-0">
                          {parseFloat(leg.oddsAtPlacement).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#6B7280] truncate">
                        {leg.eventName || leg.event?.name || 'Event'}
                        {leg.marketName ? ` - ${leg.marketName}` : ''}
                      </div>
                    </div>
                  ))}

                  {/* Stake & potential win */}
                  <div className="mt-2 pt-2 border-t border-[#1E2430] flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-[#6B7280] uppercase tracking-wide">Stake</div>
                      <div className="text-xs font-mono font-semibold text-white">
                        {bet.currency} {parseFloat(bet.stake).toFixed(4)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-[#6B7280] uppercase tracking-wide">
                        {bet.status === 'WON' ? 'Won' : 'Potential Win'}
                      </div>
                      <div className={cn('text-xs font-mono font-bold', statusColor(bet.status))}>
                        {bet.currency}{' '}
                        {bet.actualWin
                          ? parseFloat(bet.actualWin).toFixed(4)
                          : parseFloat(bet.potentialWin).toFixed(4)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: BetSlipContent
// ---------------------------------------------------------------------------

function BetSlipContent({
  selections,
  betType,
  isPlacing,
  isAuthenticated,
  stakes,
  currency,
  totalStake,
  potentialWin,
  activeTab,
  setActiveTab,
  setBetType,
  setStake,
  setCurrency,
  removeSelection,
  clearAll,
  handlePlaceBet,
  handleQuickStake,
  displayCurrency,
  balance,
  quickStakes,
  oddsChangePolicy,
  setOddsChangePolicy,
  acceptAllChanges,
  setAcceptAllChanges,
}: {
  selections: BetSelection[];
  betType: string;
  isPlacing: boolean;
  isAuthenticated: boolean;
  stakes: Record<string, number>;
  currency: string;
  totalStake: number;
  potentialWin: number;
  activeTab: 'slip' | 'bets';
  setActiveTab: (v: 'slip' | 'bets') => void;
  setBetType: (v: 'single' | 'parlay') => void;
  setStake: (id: string, v: number) => void;
  setCurrency: (v: string) => void;
  removeSelection: (id: string) => void;
  clearAll: () => void;
  handlePlaceBet: () => void;
  handleQuickStake: (amount: number) => void;
  displayCurrency: string;
  balance: number;
  quickStakes: number[];
  oddsChangePolicy: string;
  setOddsChangePolicy: (v: 'accept_any' | 'accept_higher' | 'reject') => void;
  acceptAllChanges: boolean;
  setAcceptAllChanges: (v: boolean) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const combinedOdds = useMemo(() => {
    if (selections.length === 0) return 0;
    return selections.reduce((acc, sel) => acc * sel.odds, 1);
  }, [selections]);

  const canPlaceBet = totalStake > 0 && !isPlacing;

  // When no selections and on slip tab, show in-play + sharpest bettors
  const showInPlayWidget = activeTab === 'slip' && selections.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0D1117]">
      {/* ================================================================ */}
      {/* TOP BAR: Betslip | My bets tabs */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between px-3 py-0 border-b border-[#1E2430] bg-[#0D1117]">
        {/* Left: Tabs */}
        <div className="flex items-center gap-0">
          <button
            onClick={() => setActiveTab('slip')}
            className={cn(
              'px-3 py-2.5 text-xs font-bold transition-all duration-200 border-b-2 uppercase tracking-wide',
              activeTab === 'slip'
                ? 'text-white border-[#8B5CF6]'
                : 'text-[#6B7280] border-transparent hover:text-[#8B9AB0]',
            )}
          >
            Betslip
            {selections.length > 0 && (
              <span className="ml-1.5 bg-[#8B5CF6] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] inline-flex items-center justify-center">
                {selections.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('bets')}
            className={cn(
              'px-3 py-2.5 text-xs font-bold transition-all duration-200 border-b-2 uppercase tracking-wide',
              activeTab === 'bets'
                ? 'text-white border-[#8B5CF6]'
                : 'text-[#6B7280] border-transparent hover:text-[#8B9AB0]',
            )}
          >
            My bets
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {selections.length > 0 && (
            <button
              onClick={clearAll}
              className="w-7 h-7 flex items-center justify-center rounded text-[#30363D] hover:text-red-500 hover:bg-red-500/10 transition-all duration-200"
              title="Clear all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-7 h-7 flex items-center justify-center rounded text-[#30363D] hover:text-white hover:bg-[#1C2128] transition-all duration-200"
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            {showSettings && (
              <SettingsPanel
                oddsChangePolicy={oddsChangePolicy}
                setOddsChangePolicy={setOddsChangePolicy}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* CONTENT */}
      {/* ================================================================ */}
      {activeTab === 'slip' ? (
        <div className="flex flex-col flex-1 min-h-0">
          {showInPlayWidget ? (
            /* When betslip is empty, show In-Play + Sharpest Bettors */
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <InPlayWidget />
              <SharpestBettorsWidget />
            </div>
          ) : selections.length === 0 ? (
            <EmptyState
              message="Bet slip is empty"
              sub="Add selections to your bet slip by clicking on odds"
            />
          ) : (
            <>
              {/* ============================================================ */}
              {/* BET TYPE TABS: Singles N | Parlay */}
              {/* ============================================================ */}
              <div className="border-b border-[#1E2430]">
                <div className="flex items-center">
                  <button
                    onClick={() => setBetType('single')}
                    className={cn(
                      'flex-1 py-2.5 text-[11px] font-bold text-center transition-all duration-200 border-b-2 uppercase tracking-wide',
                      betType === 'single'
                        ? 'text-white border-[#8B5CF6] bg-[#8B5CF6]/5'
                        : 'text-[#6B7280] border-transparent hover:text-[#8B9AB0]',
                    )}
                  >
                    Singles {selections.length}
                  </button>
                  <button
                    onClick={() => setBetType('parlay')}
                    className={cn(
                      'flex-1 py-2.5 text-[11px] font-bold text-center transition-all duration-200 border-b-2 uppercase tracking-wide',
                      betType === 'parlay'
                        ? 'text-white border-[#8B5CF6] bg-[#8B5CF6]/5'
                        : 'text-[#6B7280] border-transparent hover:text-[#8B9AB0]',
                    )}
                  >
                    Parlay
                  </button>
                </div>

                {/* Parlay info bar */}
                {betType === 'parlay' && selections.length > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 bg-[#141922]">
                    <span className="text-xs text-[#8B9AB0]">
                      <span className="font-semibold text-white">{selections.length} Legs</span>{' '}
                      <span className="text-[#10B981] font-mono font-bold">
                        @ {formatOdds(combinedOdds)}
                      </span>
                    </span>
                    <button
                      onClick={clearAll}
                      className="text-[#30363D] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ============================================================ */}
              {/* PARLAY STAKE INPUT (above legs) */}
              {/* ============================================================ */}
              {betType === 'parlay' && (
                <div className="px-3 pt-3 pb-1 border-b border-[#1E2430]">
                  {/* Available balance */}
                  <div className="flex items-center justify-end mb-1.5">
                    <span className="text-[10px] text-[#6B7280]">
                      Balance:{' '}
                      <span className="font-mono text-[#8B9AB0]">
                        {displayCurrency} {formatAmount(balance, displayCurrency)}
                      </span>
                    </span>
                  </div>

                  {/* Stake input */}
                  <div className="flex items-center gap-2 bg-[#141922] border border-[#1E2430] rounded-lg px-3 py-2.5 focus-within:border-[#8B5CF6]/50 transition-colors duration-200">
                    <span className="text-xs font-semibold text-[#6B7280] shrink-0">
                      {displayCurrency}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={stakes['parlay'] || ''}
                      onChange={(e) =>
                        setStake('parlay', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="flex-1 bg-transparent text-sm font-mono text-white placeholder:text-[#30363D] focus:outline-none text-right"
                    />
                  </div>

                  {/* Quick stakes */}
                  <div className="flex gap-1.5 mt-2">
                    {quickStakes.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleQuickStake(amount)}
                        className="flex-1 py-1.5 text-[10px] font-semibold text-[#8B9AB0] bg-[#141922] hover:bg-[#1C2128] border border-[#1E2430] rounded-md transition-all duration-200 hover:text-white active:scale-[0.97]"
                      >
                        {amount}
                      </button>
                    ))}
                  </div>

                  {/* To return */}
                  <div className="flex items-center justify-between mt-2 mb-2 px-0.5">
                    <span className="text-[10px] text-[#6B7280]">To return</span>
                    <span className="text-xs font-mono font-semibold text-[#10B981]">
                      {displayCurrency} {formatAmount(potentialWin, displayCurrency)}
                    </span>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* LEG CARDS (scrollable) */}
              {/* ============================================================ */}
              <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-2">
                {selections.map((selection) => (
                  <LegCard
                    key={selection.id}
                    selection={selection}
                    onRemove={() => removeSelection(selection.id)}
                    showStakeInput={betType === 'single'}
                    stake={betType === 'single' ? stakes[selection.id] || 0 : undefined}
                    onStakeChange={
                      betType === 'single'
                        ? (v) => setStake(selection.id, v)
                        : undefined
                    }
                    displayCurrency={displayCurrency}
                  />
                ))}
              </div>

              {/* ============================================================ */}
              {/* SINGLES: Summary section at bottom */}
              {/* ============================================================ */}
              {betType === 'single' && (
                <div className="px-3 pt-2 pb-0 border-t border-[#1E2430]">
                  {/* Available balance */}
                  <div className="flex items-center justify-end mb-1.5">
                    <span className="text-[10px] text-[#6B7280]">
                      Balance:{' '}
                      <span className="font-mono text-[#8B9AB0]">
                        {displayCurrency} {formatAmount(balance, displayCurrency)}
                      </span>
                    </span>
                  </div>

                  {/* Quick stakes for singles */}
                  <div className="flex gap-1.5 mb-2">
                    {quickStakes.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleQuickStake(amount)}
                        className="flex-1 py-1.5 text-[10px] font-semibold text-[#8B9AB0] bg-[#141922] hover:bg-[#1C2128] border border-[#1E2430] rounded-md transition-all duration-200 hover:text-white active:scale-[0.97]"
                      >
                        {amount}
                      </button>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6B7280]">Total Stake</span>
                      <span className="font-mono font-semibold text-white">
                        {displayCurrency} {formatAmount(totalStake, displayCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6B7280]">Potential Win</span>
                      <span className="font-mono font-bold text-[#10B981]">
                        {displayCurrency} {formatAmount(potentialWin, displayCurrency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* BOTTOM: Place Bet + Toggle */}
              {/* ============================================================ */}
              <div className="px-3 pt-2 pb-3">
                {/* Place bet button */}
                <button
                  onClick={handlePlaceBet}
                  disabled={!canPlaceBet}
                  className={cn(
                    'w-full py-3 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wide',
                    canPlaceBet
                      ? 'bg-[#10B981] hover:bg-[#0D9668] text-white shadow-lg shadow-[#10B981]/20 active:scale-[0.98]'
                      : 'bg-[#1C2128] text-[#30363D] cursor-not-allowed',
                  )}
                >
                  {isPlacing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Placing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Place Bet
                    </>
                  )}
                </button>

                {/* Accept all odds changes toggle */}
                <OddsChangeToggle
                  enabled={acceptAllChanges}
                  onChange={setAcceptAllChanges}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        /* ================================================================ */
        /* MY BETS TAB */
        /* ================================================================ */
        <MyBetsPanel displayCurrency={displayCurrency} isAuthenticated={isAuthenticated} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main: BetSlip Component
// ---------------------------------------------------------------------------

export default function BetSlip() {
  const selections = useBetSlipStore(selectSelections);
  const betType = useBetSlipStore(selectBetType);
  const isPlacing = useBetSlipStore(selectIsPlacing);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  const {
    removeSelection,
    clearAll,
    setStake,
    setBetType,
    setCurrency,
    setOddsChangePolicy,
    stakes,
    currency,
    oddsChangePolicy,
    getPotentialWin,
    getTotalStake,
    placeBet,
    isOpen: mobileOpen,
    setOpen: setMobileOpen,
  } = useBetSlipStore();

  const [activeTab, setActiveTab] = useState<'slip' | 'bets'>('slip');
  const [acceptAllChanges, setAcceptAllChanges] = useState(true);

  // Track newly added selection for the pop-up preview
  const [showPreview, setShowPreview] = useState(false);
  const prevCountRef = useRef(selections.length);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preferredCurrency = useAuthStore(selectPreferredCurrency);
  const displayCurrency = currency || preferredCurrency || 'BTC';

  // Drag-to-close state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const balanceData = useAuthStore(selectBalance(displayCurrency));
  const balance = balanceData?.available ?? 0;

  const quickStakes = QUICK_STAKES[displayCurrency] || DEFAULT_QUICK_STAKES;

  useEffect(() => {
    if (acceptAllChanges) {
      setOddsChangePolicy('accept_any');
    }
  }, [acceptAllChanges, setOddsChangePolicy]);

  useEffect(() => {
    if (preferredCurrency && preferredCurrency !== currency) {
      setCurrency(preferredCurrency);
    }
  }, [preferredCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selections.length === 0) {
      setMobileOpen(false);
      setShowPreview(false);
    }
  }, [selections.length]);

  // Show preview pop-up when a new selection is added (mobile only)
  useEffect(() => {
    if (selections.length > prevCountRef.current && !mobileOpen) {
      setShowPreview(true);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => setShowPreview(false), 4000);
    }
    prevCountRef.current = selections.length;
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [selections.length, mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const totalStake = getTotalStake();
  const potentialWin = getPotentialWin();

  const handlePlaceBet = async () => {
    if (!isAuthenticated) {
      toastError('Please sign in to place bets');
      return;
    }
    try {
      const result = await placeBet();
      toastSuccess(`Bet placed successfully! Bet ID: ${result.betId}`);
      setMobileOpen(false);
    } catch (err: any) {
      const message = err?.message || (err instanceof Error ? err.message : 'Failed to place bet');
      console.error('[BetSlip] Place bet error:', err);
      toastError(message);
    }
  };

  const handleQuickStake = (amount: number) => {
    if (betType === 'single' && selections.length > 0) {
      selections.forEach((s) => setStake(s.id, amount));
    } else if (betType === 'parlay') {
      setStake('parlay', amount);
    }
  };

  // Touch drag handlers for pull-down-to-close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - dragStartY.current;
      if (diff > 0) {
        setDragY(diff);
      }
    },
    [isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragY > 120) {
      setMobileOpen(false);
    }
    setDragY(0);
  }, [dragY]);

  const sharedProps = {
    selections,
    betType,
    isPlacing,
    isAuthenticated,
    stakes,
    currency,
    totalStake,
    potentialWin,
    activeTab,
    setActiveTab,
    setBetType,
    setStake,
    setCurrency,
    removeSelection,
    clearAll,
    handlePlaceBet,
    handleQuickStake,
    displayCurrency,
    balance,
    quickStakes,
    oddsChangePolicy,
    setOddsChangePolicy,
    acceptAllChanges,
    setAcceptAllChanges,
  };

  return (
    <>
      {/* ================================================================ */}
      {/* DESKTOP: Sticky right sidebar content (rendered inline) */}
      {/* ================================================================ */}
      <div className="hidden lg:flex flex-col flex-1 min-h-0">
        <BetSlipContent {...sharedProps} />
      </div>

      {/* ================================================================ */}
      {/* MOBILE: Floating bet slip preview bar */}
      {/* ================================================================ */}
      {!mobileOpen && selections.length > 0 && (
        <div
          className={cn(
            'lg:hidden fixed bottom-[72px] left-3 right-3 z-40 transition-all duration-300 ease-out',
            showPreview ? 'animate-slide-up' : '',
          )}
        >
          {/* Expanded preview showing latest selection */}
          {showPreview && selections.length > 0 && (() => {
            const latest = selections[selections.length - 1];
            const { home, away } = parseTeams(latest.eventName);
            return (
              <div className="bg-[#141922] border border-[#1E2430] rounded-t-xl px-3 py-2.5 mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Bet Added</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white font-medium truncate">
                      {home}{away ? ` vs ${away}` : ''}
                    </p>
                    <p className="text-[10px] text-[#6B7280] truncate mt-0.5">
                      {latest.outcomeName} — {latest.marketName}
                    </p>
                  </div>
                  <span className="text-sm font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-lg ml-2 shrink-0">
                    {formatOdds(latest.odds)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Main betslip bar */}
          <button
            onClick={() => {
              setShowPreview(false);
              setMobileOpen(true);
            }}
            className={cn(
              'w-full flex items-center justify-between gap-2 h-[52px] px-4 font-bold shadow-lg active:scale-[0.98] bg-[#10B981] text-white shadow-[#10B981]/30',
              showPreview ? 'rounded-b-xl' : 'rounded-xl',
            )}
          >
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              <span className="text-sm font-bold">Betslip</span>
              <span className="bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {selections.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {totalStake > 0 ? (
                <span className="text-xs font-mono opacity-90">
                  {displayCurrency} {formatAmount(totalStake, displayCurrency)}
                </span>
              ) : (
                <span className="text-xs opacity-80">Open</span>
              )}
              <ChevronRight className="h-4 w-4 opacity-60 -rotate-90" />
            </div>
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* MOBILE: Full-screen slide-up modal */}
      {/* ================================================================ */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className="lg:hidden fixed inset-0 z-[70] flex flex-col bg-[#0D1117] animate-slide-up-panel"
            style={{
              transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
              transition: isDragging ? 'none' : 'transform 200ms ease',
            }}
          >
            {/* Drag handle + close */}
            <div
              className="flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1 rounded-full bg-[#30363D]" />
            </div>

            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-2.5 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full text-[#6B7280] hover:text-white hover:bg-[#1C2128] transition-all duration-200"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Content */}
            <BetSlipContent {...sharedProps} />
          </div>
        </>
      )}
    </>
  );
}
