'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Trophy,
  Copy,
  Minus,
  AlertCircle,
  Share2,
  Zap,
  Target,
  Gamepad2,
  Swords,
  Circle,
} from 'lucide-react';
import { cn, formatCurrency, formatOdds, formatDate, copyToClipboard } from '@/lib/utils';
import { get, post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketEvent } from '@/lib/socket';
import { toastSuccess, toastError, toastInfo } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BetStatus = 'open' | 'won' | 'lost' | 'void' | 'cashout';
type BetTab = 'open' | 'settled' | 'all';

interface BetLeg {
  id: string;
  eventName: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  sportName: string;
  startTime: string;
  isLive: boolean;
  result?: 'won' | 'lost' | 'void' | 'pending';
  score?: string;
}

interface UserBet {
  id: string;
  type: 'single' | 'parlay' | 'system';
  status: BetStatus;
  legs: BetLeg[];
  stake: number;
  currency: string;
  totalOdds: number;
  potentialWin: number;
  payout?: number;
  cashOutValue?: number;
  placedAt: string;
  settledAt?: string;
}

// ---------------------------------------------------------------------------
// Sport icon helper
// ---------------------------------------------------------------------------

function SportIcon({ sport, className }: { sport: string; className?: string }) {
  const s = sport.toLowerCase();
  if (s.includes('football') || s.includes('soccer'))
    return <Circle className={className} />;
  if (s.includes('basketball'))
    return <Target className={className} />;
  if (s.includes('tennis'))
    return <Zap className={className} />;
  if (s.includes('esport'))
    return <Gamepad2 className={className} />;
  if (s.includes('hockey') || s.includes('baseball'))
    return <Swords className={className} />;
  return <Trophy className={className} />;
}

// ---------------------------------------------------------------------------
// Status badge (Cloudbet style)
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: BetStatus }) {
  const config: Record<BetStatus, { label: string; bg: string; text: string; border: string }> = {
    open: {
      label: 'Pending',
      bg: 'bg-[#F59E0B]/10',
      text: 'text-[#F59E0B]',
      border: 'border-[#F59E0B]/20',
    },
    won: {
      label: 'Won',
      bg: 'bg-[#10B981]/10',
      text: 'text-[#10B981]',
      border: 'border-[#10B981]/20',
    },
    lost: {
      label: 'Lost',
      bg: 'bg-[#EF4444]/10',
      text: 'text-[#EF4444]',
      border: 'border-[#EF4444]/20',
    },
    void: {
      label: 'Void',
      bg: 'bg-[#6B7280]/10',
      text: 'text-[#6B7280]',
      border: 'border-[#6B7280]/20',
    },
    cashout: {
      label: 'Cashed Out',
      bg: 'bg-[#8B5CF6]/10',
      text: 'text-[#8B5CF6]',
      border: 'border-[#8B5CF6]/20',
    },
  };

  const c = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded border',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {status === 'open' && <Clock className="w-3 h-3" />}
      {status === 'won' && <CheckCircle className="w-3 h-3" />}
      {status === 'lost' && <XCircle className="w-3 h-3" />}
      {status === 'void' && <Minus className="w-3 h-3" />}
      {status === 'cashout' && <DollarSign className="w-3 h-3" />}
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Leg result indicator
// ---------------------------------------------------------------------------

function LegResultIcon({ result }: { result?: string }) {
  if (!result || result === 'pending') {
    return (
      <span className="w-5 h-5 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
        <Clock className="w-3 h-3 text-[#F59E0B]" />
      </span>
    );
  }
  if (result === 'won') {
    return (
      <span className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center">
        <CheckCircle className="w-3 h-3 text-[#10B981]" />
      </span>
    );
  }
  if (result === 'lost') {
    return (
      <span className="w-5 h-5 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
        <XCircle className="w-3 h-3 text-[#EF4444]" />
      </span>
    );
  }
  // void
  return (
    <span className="w-5 h-5 rounded-full bg-[#6B7280]/10 flex items-center justify-center">
      <Minus className="w-3 h-3 text-[#6B7280]" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Bet Leg Row (expanded parlay view)
// ---------------------------------------------------------------------------

function BetLegRow({ leg, isLast }: { leg: BetLeg; isLast: boolean }) {
  const isWon = leg.result === 'won';
  const isLost = leg.result === 'lost';
  const isVoid = leg.result === 'void';
  const isSettled = isWon || isLost || isVoid;

  return (
    <div
      className={cn(
        'flex items-start gap-3 py-3',
        !isLast && 'border-b border-[#21262D]/60',
        isLost && 'bg-[#EF4444]/[0.03]',
      )}
    >
      <div className="pt-0.5">
        <LegResultIcon result={leg.result} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <SportIcon sport={leg.sportName} className="w-3 h-3 text-[#484F58]" />
          <span className="text-[11px] text-[#484F58] uppercase tracking-wide">
            {leg.sportName}
          </span>
        </div>
        <p className={cn('text-[13px] truncate', isLost ? 'text-[#EF4444]/80 line-through' : 'text-[#C9D1D9]')}>
          {leg.eventName}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#8B949E]">{leg.marketName}:</span>
          <span className={cn('text-xs font-medium', isLost ? 'text-[#EF4444]' : 'text-[#E6EDF3]')}>{leg.outcomeName}</span>
        </div>
        {leg.score && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[#484F58]">
              Score: <span className="font-mono text-[#8B949E]">{leg.score}</span>
            </span>
            {isSettled && (
              <span
                className={cn(
                  'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                  isWon && 'bg-[#10B981]/10 text-[#10B981]',
                  isLost && 'bg-[#EF4444]/10 text-[#EF4444]',
                  isVoid && 'bg-[#6B7280]/10 text-[#6B7280]',
                )}
              >
                {isWon ? 'Won' : isLost ? 'Lost' : 'Void'}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span
          className={cn(
            'font-mono text-sm font-semibold',
            isLost ? 'text-[#EF4444]/60 line-through' : 'text-[#10B981]',
          )}
        >
          {formatOdds(leg.odds)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bet Card (Cloudbet style)
// ---------------------------------------------------------------------------

function BetCard({
  bet,
  onCashOut,
  onShare,
}: {
  bet: UserBet;
  onCashOut: (betId: string) => void;
  onShare: (betId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isParlay = bet.type === 'parlay' || bet.type === 'system';
  const showExpand = isParlay || bet.legs.length > 1;
  const firstLeg = bet.legs[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden hover:border-[#30363D] transition-colors duration-200"
    >
      {/* Card top section */}
      <div className="p-4">
        {/* Row 1: Type badge + Status + Date */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isParlay && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded">
                {bet.type === 'parlay' ? 'Parlay' : 'System'} ({bet.legs.length})
              </span>
            )}
            <StatusBadge status={bet.status} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onShare(bet.id)}
              className="p-1.5 rounded text-[#484F58] hover:text-[#8B949E] hover:bg-[#1C2128] transition-colors duration-200"
              title="Share bet"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-[#484F58]">
              {formatDate(bet.placedAt)}
            </span>
          </div>
        </div>

        {/* Row 2: Event / Selection for single bets */}
        {!showExpand && firstLeg && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <SportIcon sport={firstLeg.sportName} className="w-3.5 h-3.5 text-[#484F58]" />
              <span className="text-[11px] text-[#484F58] uppercase tracking-wide">
                {firstLeg.sportName}
              </span>
              {firstLeg.isLive && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded">
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[15px] font-medium text-[#E6EDF3] leading-snug">
              {firstLeg.eventName}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-[#8B949E]">{firstLeg.marketName}</span>
              <span className="text-[#30363D]">/</span>
              <span className="text-xs font-medium text-[#E6EDF3]">{firstLeg.outcomeName}</span>
            </div>
            {firstLeg.score && (bet.status === 'won' || bet.status === 'lost' || bet.status === 'void') && (
              <p className="text-[11px] text-[#484F58] mt-1.5">
                Final: <span className="font-mono font-medium text-[#8B949E]">{firstLeg.score}</span>
              </p>
            )}
          </div>
        )}

        {/* Row 2 alternate: Parlay collapsed preview */}
        {showExpand && !isExpanded && (
          <div className="mb-3 space-y-1.5">
            {bet.legs.slice(0, 3).map((leg) => (
              <div key={leg.id} className="flex items-center gap-2">
                <LegResultIcon result={leg.result} />
                <span className={cn('text-xs truncate flex-1', leg.result === 'lost' ? 'text-[#EF4444]/70 line-through' : 'text-[#8B949E]')}>
                  {leg.eventName}
                  <span className={leg.result === 'lost' ? 'text-[#EF4444]' : 'text-[#E6EDF3]'}> - {leg.outcomeName}</span>
                  {leg.score && leg.result && leg.result !== 'pending' && (
                    <span className="text-[#484F58]"> ({leg.score})</span>
                  )}
                </span>
                <span className={cn('font-mono text-xs font-semibold shrink-0', leg.result === 'lost' ? 'text-[#EF4444]/60 line-through' : 'text-[#10B981]')}>
                  {formatOdds(leg.odds)}
                </span>
              </div>
            ))}
            {bet.legs.length > 3 && (
              <p className="text-[11px] text-[#484F58] pl-7">
                +{bet.legs.length - 3} more selection{bet.legs.length - 3 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Row 3: Odds / Stake / Return grid */}
        <div className="flex items-stretch gap-px bg-[#21262D] rounded-lg overflow-hidden">
          <div className="flex-1 bg-[#0D1117] py-2.5 px-3 text-center">
            <p className="text-[10px] text-[#484F58] uppercase tracking-wider mb-1">Odds</p>
            <p className="font-mono text-sm font-bold text-[#10B981]">
              {formatOdds(bet.totalOdds)}
            </p>
          </div>
          <div className="flex-1 bg-[#0D1117] py-2.5 px-3 text-center">
            <p className="text-[10px] text-[#484F58] uppercase tracking-wider mb-1">Stake</p>
            <p className="font-mono text-sm font-semibold text-[#E6EDF3]">
              {formatCurrency(bet.stake, bet.currency)}
            </p>
          </div>
          <div className="flex-1 bg-[#0D1117] py-2.5 px-3 text-center">
            <p className="text-[10px] text-[#484F58] uppercase tracking-wider mb-1">
              {bet.status === 'won' ? 'Payout' : bet.status === 'cashout' ? 'Cashed' : 'Return'}
            </p>
            <p
              className={cn(
                'font-mono text-sm font-bold',
                bet.status === 'won' || bet.status === 'cashout'
                  ? 'text-[#10B981]'
                  : bet.status === 'lost'
                    ? 'text-[#EF4444] line-through'
                    : 'text-[#E6EDF3]',
              )}
            >
              {bet.payout
                ? formatCurrency(bet.payout, bet.currency)
                : formatCurrency(bet.potentialWin, bet.currency)}
            </p>
          </div>
        </div>

        {/* Cash Out button for active bets */}
        {bet.status === 'open' && bet.cashOutValue && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onCashOut(bet.id)}
            className="w-full mt-3 h-10 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
          >
            <DollarSign className="w-4 h-4" />
            Cash Out {formatCurrency(bet.cashOutValue, bet.currency)}
          </motion.button>
        )}

        {/* Expand/collapse toggle for parlays */}
        {showExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-3 flex items-center justify-center gap-1.5 text-xs text-[#484F58] hover:text-[#8B949E] transition-colors duration-200 py-1"
          >
            {isExpanded ? (
              <>
                <span>Hide legs</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Show all legs</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded leg details */}
      <AnimatePresence>
        {isExpanded && showExpand && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[#21262D]">
              {bet.legs.map((leg, i) => (
                <BetLegRow key={leg.id} leg={leg} isLast={i === bet.legs.length - 1} />
              ))}
              {/* Combined odds footer */}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-[#21262D]/60">
                <span className="text-xs text-[#484F58] uppercase tracking-wider">
                  Combined Odds
                </span>
                <span className="font-mono text-sm font-bold text-[#10B981]">
                  {formatOdds(bet.totalOdds)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton (Cloudbet style)
// ---------------------------------------------------------------------------

function BetCardSkeleton() {
  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded" />
        </div>
        <Skeleton className="h-4 w-24 rounded" />
      </div>
      <div>
        <Skeleton className="h-3 w-16 rounded mb-2" />
        <Skeleton className="h-4 w-3/4 rounded mb-1.5" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
      <div className="flex items-stretch gap-px bg-[#21262D] rounded-lg overflow-hidden">
        <div className="flex-1 bg-[#0D1117] py-2.5 px-3 flex flex-col items-center gap-1">
          <Skeleton className="h-2.5 w-8 rounded" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <div className="flex-1 bg-[#0D1117] py-2.5 px-3 flex flex-col items-center gap-1">
          <Skeleton className="h-2.5 w-8 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex-1 bg-[#0D1117] py-2.5 px-3 flex flex-col items-center gap-1">
          <Skeleton className="h-2.5 w-8 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle switch component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className="text-xs text-[#8B949E]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-[#8B5CF6]' : 'bg-[#21262D]',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </button>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <div className="w-16 h-16 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mb-5">
        <Trophy className="w-7 h-7 text-[#30363D]" />
      </div>
      <h3 className="text-base font-semibold text-[#E6EDF3] mb-1.5">{title}</h3>
      <p className="text-sm text-[#484F58] text-center max-w-xs">{description}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// My Bets Page
// ---------------------------------------------------------------------------

export default function MyBetsPage() {
  const { isAuthenticated } = useAuthStore();
  const [bets, setBets] = useState<UserBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeTab, setActiveTab] = useState<BetTab>('all');
  const [showOutrights, setShowOutrights] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    // Only fetch when the user is authenticated so the JWT token is available
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    async function fetchBets() {
      setIsLoading(true);
      setFetchError(false);
      try {
        const data = await get<{ bets: any[] }>('/betting');
        // Transform API response to match frontend UserBet interface
        const STATUS_MAP: Record<string, BetStatus> = {
          PENDING: 'open', ACCEPTED: 'open', WON: 'won', LOST: 'lost',
          VOID: 'void', CASHOUT: 'cashout', PARTIALLY_SETTLED: 'open',
        };
        const transformed: UserBet[] = (data.bets || []).map((b: any) => ({
          id: b.id,
          type: (b.type ?? 'single').toLowerCase() as UserBet['type'],
          status: STATUS_MAP[b.status] ?? 'open',
          legs: (b.legs ?? []).map((l: any) => ({
            id: l.id,
            eventName: l.eventName ?? l.event?.name ?? '',
            marketName: l.marketName ?? l.market ?? '',
            outcomeName: l.selectionName ?? l.selection?.name ?? '',
            odds: typeof l.oddsAtPlacement === 'string' ? parseFloat(l.oddsAtPlacement) : (l.oddsAtPlacement ?? 0),
            sportName: l.event?.competition?.sport?.name ?? '',
            startTime: l.event?.startTime ?? '',
            isLive: l.event?.isLive ?? b.isLive ?? false,
            result: l.selectionResult
              ? ({ WIN: 'won', LOSE: 'lost', VOID: 'void', PUSH: 'void', HALF_WIN: 'won', HALF_LOSE: 'lost' } as Record<string, string>)[l.selectionResult] ?? 'pending'
              : 'pending',
            score: l.event?.scores
              ? `${l.event.scores.home ?? 0}-${l.event.scores.away ?? 0}`
              : undefined,
          })),
          stake: typeof b.stake === 'string' ? parseFloat(b.stake) : (b.stake ?? 0),
          currency: b.currency ?? 'BTC',
          totalOdds: typeof b.odds === 'string' ? parseFloat(b.odds) : (b.odds ?? 0),
          potentialWin: typeof b.potentialWin === 'string' ? parseFloat(b.potentialWin) : (b.potentialWin ?? 0),
          payout: b.actualWin ? (typeof b.actualWin === 'string' ? parseFloat(b.actualWin) : b.actualWin) : undefined,
          cashOutValue: b.cashoutAmount ? (typeof b.cashoutAmount === 'string' ? parseFloat(b.cashoutAmount) : b.cashoutAmount) : undefined,
          placedAt: b.createdAt ?? new Date().toISOString(),
          settledAt: b.settledAt ?? undefined,
        }));
        setBets(transformed);
      } catch {
        setFetchError(true);
        setBets([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBets();
  }, [isAuthenticated]);

  // Real-time bet settlement updates
  useSocketEvent('bet:settled', (data) => {
    const STATUS_MAP: Record<string, BetStatus> = {
      WON: 'won',
      LOST: 'lost',
      VOID: 'void',
    };
    const newStatus = STATUS_MAP[data.status];
    if (!newStatus) return;

    setBets((prev) =>
      prev.map((b) => {
        if (b.id !== data.betId) return b;
        const payout = parseFloat(data.actualWin) || 0;
        return {
          ...b,
          status: newStatus,
          payout: payout > 0 ? payout : undefined,
          settledAt: data.timestamp,
        };
      }),
    );

    // Show toast notification
    if (data.status === 'WON') {
      const winAmount = parseFloat(data.actualWin) || 0;
      toastSuccess(`Bet won! You won ${winAmount > 0 ? winAmount.toFixed(6) : ''}. Payout credited to your wallet.`);
    } else if (data.status === 'LOST') {
      toastError('Bet lost. Better luck next time!');
    } else if (data.status === 'VOID') {
      toastInfo('Bet voided. Your stake has been refunded.');
    }
  });

  const filteredBets = useMemo(() => {
    let result = bets;

    // Tab filter
    if (activeTab === 'open') {
      result = result.filter((b) => b.status === 'open');
    } else if (activeTab === 'settled') {
      result = result.filter((b) => b.status !== 'open');
    }

    return result;
  }, [bets, activeTab]);

  const handleCashOut = useCallback(async (betId: string) => {
    try {
      await post(`/betting/${betId}/cashout`, {});
      setBets((prev) =>
        prev.map((b) =>
          b.id === betId
            ? { ...b, status: 'cashout' as BetStatus, payout: b.cashOutValue }
            : b,
        ),
      );
    } catch {
      // Update locally for demo
      setBets((prev) =>
        prev.map((b) =>
          b.id === betId
            ? { ...b, status: 'cashout' as BetStatus, payout: b.cashOutValue }
            : b,
        ),
      );
    }
  }, []);

  const handleShare = useCallback(async (betId: string) => {
    try {
      const shareUrl = `${window.location.origin}/bets/shared/${betId}`;
      await copyToClipboard(shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    } catch {
      // silently fail
    }
  }, []);

  const tabs: { key: BetTab; label: string; count: number }[] = [
    { key: 'open', label: 'Active', count: bets.filter((b) => b.status === 'open').length },
    { key: 'settled', label: 'Settled', count: bets.filter((b) => b.status !== 'open').length },
    { key: 'all', label: 'All', count: bets.length },
  ];

  return (
    <div className="min-h-screen bg-[#0D0D1A]">
      {/* Page header */}
      <div className="border-b border-[#21262D] bg-[#0D1117]">
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-0">
          <h1 className="text-2xl font-bold text-[#E6EDF3] mb-6">My Bets</h1>

          {/* Tab bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'relative px-5 py-3 text-sm font-medium transition-colors duration-200',
                    activeTab === tab.key
                      ? 'text-[#E6EDF3]'
                      : 'text-[#484F58] hover:text-[#8B949E]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                        activeTab === tab.key
                          ? 'bg-[#8B5CF6]/20 text-[#8B5CF6]'
                          : 'bg-[#161B22] text-[#484F58]',
                      )}
                    >
                      {tab.count}
                    </span>
                  </span>
                  {/* Active underline indicator */}
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8B5CF6]"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Outrights toggle */}
            <ToggleSwitch
              checked={showOutrights}
              onChange={setShowOutrights}
              label="Outrights"
            />
          </div>
        </div>
      </div>

      {/* Bet list */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {!isAuthenticated && !isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#161B22] border border-[#21262D] rounded-lg p-12 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-[#0D1117] border border-[#21262D] flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-7 h-7 text-[#30363D]" />
                </div>
                <h3 className="text-base font-semibold text-[#E6EDF3] mb-1.5">
                  Please log in
                </h3>
                <p className="text-sm text-[#484F58]">
                  Sign in to view and manage your bets
                </p>
              </motion.div>
            ) : isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <BetCardSkeleton key={`skel-${i}`} />
              ))
            ) : fetchError ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#161B22] border border-[#21262D] rounded-lg p-12 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-[#EF4444]/5 border border-[#EF4444]/10 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-7 h-7 text-[#EF4444]/40" />
                </div>
                <h3 className="text-base font-semibold text-[#E6EDF3] mb-1.5">
                  Failed to load bets
                </h3>
                <p className="text-sm text-[#484F58]">
                  Something went wrong. Please try again later.
                </p>
              </motion.div>
            ) : filteredBets.length === 0 ? (
              <EmptyState
                title={
                  activeTab === 'open'
                    ? 'No active bets'
                    : activeTab === 'settled'
                      ? 'No settled bets'
                      : 'No bets found'
                }
                description={
                  activeTab === 'open'
                    ? 'Your active bets will appear here. Place a bet to get started.'
                    : activeTab === 'settled'
                      ? 'Your settled bets will appear here once results are in.'
                      : 'You have not placed any bets yet.'
                }
              />
            ) : (
              filteredBets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  onCashOut={handleCashOut}
                  onShare={handleShare}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Share toast */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#10B981] text-white text-sm font-medium rounded-lg shadow-xl flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Share link copied!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
