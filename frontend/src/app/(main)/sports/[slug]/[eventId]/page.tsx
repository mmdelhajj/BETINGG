'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Shield,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Search,
  Star,
  Info,
  X,
  Delete,
  Check,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { cn, formatOdds, formatDate } from '@/lib/utils';
import { get } from '@/lib/api';
import { useBetSlipStore, type BetSelection } from '@/stores/betSlipStore';
import { useSocketEvent } from '@/lib/socket';
import { AnimatedScore, LiveMatchClock, LiveIndicator } from '@/components/LiveScoreTicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Market {
  id: string;
  name: string;
  category: string;
  suspended: boolean;
  selections: Selection[];
}

interface Selection {
  id?: string;
  name: string;
  odds: number;
  previousOdds?: number;
  status: 'active' | 'suspended' | 'resulted';
}

interface EventDetail {
  id: string;
  sportId: string;
  sportName: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  homeTeamCountry?: string | null;
  awayTeamCountry?: string | null;
  startTime: string;
  status: string;
  score?: { home: number; away: number };
  time?: string;
  period?: string;
  rawTimer?: { tm?: number; ts?: number; q?: number } | null;
  markets: Market[];
  stats?: EventStats;
}

interface EventStats {
  homeForm: string[];
  awayForm: string[];
  h2h: { home: number; draw: number; away: number };
  standings: { team: string; played: number; won: number; drawn: number; lost: number; points: number }[];
}

// Quick bet sheet state
interface QuickBetState {
  open: boolean;
  selectionId: string;
  eventId: string;
  eventName: string;
  sportId: string;
  sportName: string;
  marketId: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  previousOdds?: number;
  startTime: string;
  isLive: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARKET_CATEGORIES = [
  { key: 'favorites', label: '', icon: true },
  { key: 'all', label: 'Main' },
  { key: 'handicap', label: 'Asian lines' },
  { key: 'half', label: 'Half' },
  { key: 'totals', label: 'Goals' },
  { key: 'players', label: 'Players' },
  { key: 'corners', label: 'Corners' },
  { key: 'cards', label: 'Cards' },
  { key: 'specials', label: 'Specials' },
];

const INDIVIDUAL_SPORTS = new Set([
  'tennis', 'table-tennis', 'badminton', 'boxing', 'mma',
  'darts', 'snooker', 'cycling', 'golf', 'athletics',
]);

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#EF4444', '#F97316',
  '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function countryToFlag(code?: string | null): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  const offset = 0x1f1e6;
  const a = 'A'.charCodeAt(0);
  return (
    String.fromCodePoint(upper.charCodeAt(0) - a + offset) +
    String.fromCodePoint(upper.charCodeAt(1) - a + offset)
  );
}

function getShortName(name: string): string {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length <= 1) return name.slice(0, 3).toUpperCase();
  return parts[parts.length - 1].slice(0, 3).toUpperCase();
}

function deriveMatchTime(metadata: any, sportSlug: string): string | undefined {
  if (!metadata) return undefined;
  const timer = metadata.timer;
  const statusShort = metadata.statusShort || '';
  const elapsed = metadata.elapsed;

  if (sportSlug === 'football' || sportSlug === 'soccer') {
    if (statusShort === 'HT' || statusShort === 'FT') return statusShort;
    if (timer?.tm != null) {
      const tm = parseInt(String(timer.tm), 10) || 0;
      const ta = timer.ta != null ? parseInt(String(timer.ta), 10) : 0;
      if (tm >= 90 && ta > 0) return `90+${ta}'`;
      if (tm >= 45 && tm < 46 && ta > 0) return `45+${ta}'`;
      return `${tm}'`;
    }
    if (elapsed) return `${elapsed}'`;
    return undefined;
  }

  if (sportSlug === 'basketball') {
    if (timer?.q != null) {
      const q = parseInt(String(timer.q), 10) || 1;
      const tm = parseInt(String(timer.tm), 10) || 0;
      const ts = parseInt(String(timer.ts), 10) || 0;
      const label = q <= 4 ? `Q${q}` : 'OT';
      return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
    }
    return statusShort || undefined;
  }

  if (sportSlug === 'ice-hockey') {
    if (timer?.q != null) {
      const p = parseInt(String(timer.q), 10) || 1;
      const tm = parseInt(String(timer.tm), 10) || 0;
      const ts = parseInt(String(timer.ts), 10) || 0;
      const label = p <= 3 ? `P${p}` : 'OT';
      return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
    }
    return statusShort || undefined;
  }

  if (elapsed) return `${elapsed}'`;
  if (statusShort && statusShort !== 'NS') return statusShort;
  return undefined;
}

function deriveMatchPeriod(metadata: any, sportSlug: string): string | undefined {
  if (!metadata) return undefined;
  const statusShort = metadata.statusShort || '';

  if (sportSlug === 'football' || sportSlug === 'soccer') {
    if (statusShort === '1H') return '1st Half';
    if (statusShort === '2H') return '2nd Half';
    if (statusShort === 'HT') return 'Half Time';
    if (statusShort === 'ET') return 'Extra Time';
    return undefined;
  }

  if (sportSlug === 'basketball') {
    const timer = metadata.timer;
    const q = timer?.q != null ? parseInt(String(timer.q), 10) : null;
    if (q === 1) return 'Q1';
    if (q === 2) return 'Q2';
    if (q === 3) return 'Q3';
    if (q === 4) return 'Q4';
    if (q && q > 4) return 'OT';
    return statusShort || undefined;
  }

  if (sportSlug === 'ice-hockey') {
    const timer = metadata.timer;
    const p = timer?.q != null ? parseInt(String(timer.q), 10) : null;
    if (p === 1) return '1st Period';
    if (p === 2) return '2nd Period';
    if (p === 3) return '3rd Period';
    if (p && p > 3) return 'OT';
    return statusShort || undefined;
  }

  return statusShort || undefined;
}

function getMatchTime(startTime: string): string {
  const d = new Date(startTime);
  const now = new Date();
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayH = hours % 12 || 12;
  const displayM = mins.toString().padStart(2, '0');
  const timeStr = `${displayH}:${displayM} ${ampm}`;

  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (isToday) return `${timeStr} / Today`;
  if (isTomorrow) return `${timeStr} / Tomorrow`;
  return `${timeStr} / ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

function generateMockEvent(slug: string, eventId: string): EventDetail {
  const isLive = eventId.includes('live');
  return {
    id: eventId,
    sportId: slug,
    sportName: slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : '',
    competitionName: 'Premier League',
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    homeTeamCountry: 'GB',
    awayTeamCountry: 'GB',
    startTime: new Date(Date.now() + (isLive ? -3600000 : 7200000)).toISOString(),
    status: isLive ? 'live' : 'upcoming',
    score: isLive ? { home: 2, away: 1 } : undefined,
    time: isLive ? "67'" : undefined,
    period: isLive ? '2nd Half' : undefined,
    markets: [
      {
        id: 'mkt-mw', name: 'Full Time Result', category: 'main', suspended: false,
        selections: [
          { name: 'Man City', odds: 1.65, status: 'active' },
          { name: 'Draw', odds: 3.80, status: 'active' },
          { name: 'Arsenal', odds: 5.20, status: 'active' },
        ],
      },
      {
        id: 'mkt-ah', name: 'Asian Handicap', category: 'handicap', suspended: false,
        selections: [
          { name: 'Man City -0.5', odds: 1.85, status: 'active' },
          { name: 'Arsenal +0.5', odds: 2.05, status: 'active' },
        ],
      },
      {
        id: 'mkt-ou25', name: 'Total Goals Over/Under 2.5', category: 'totals', suspended: false,
        selections: [
          { name: 'Over 2.5', odds: 1.72, status: 'active' },
          { name: 'Under 2.5', odds: 2.10, status: 'active' },
        ],
      },
      {
        id: 'mkt-ou35', name: 'Total Goals Over/Under 3.5', category: 'totals', suspended: false,
        selections: [
          { name: 'Over 3.5', odds: 2.40, status: 'active' },
          { name: 'Under 3.5', odds: 1.55, status: 'active' },
        ],
      },
      {
        id: 'mkt-btts', name: 'Both Teams to Score', category: 'main', suspended: false,
        selections: [
          { name: 'Yes', odds: 1.75, status: 'active' },
          { name: 'No', odds: 2.05, status: 'active' },
        ],
      },
      {
        id: 'mkt-dc', name: 'Double Chance', category: 'main', suspended: false,
        selections: [
          { name: '1X', odds: 1.18, status: 'active' },
          { name: '12', odds: 1.22, status: 'active' },
          { name: 'X2', odds: 1.95, status: 'active' },
        ],
      },
      {
        id: 'mkt-dnb', name: 'Draw No Bet', category: 'main', suspended: false,
        selections: [
          { name: 'Man City', odds: 1.32, status: 'active' },
          { name: 'Arsenal', odds: 3.40, status: 'active' },
        ],
      },
      {
        id: 'mkt-htft', name: 'Half Time / Full Time', category: 'specials', suspended: false,
        selections: [
          { name: '1/1', odds: 2.80, status: 'active' },
          { name: '1/X', odds: 14.0, status: 'active' },
          { name: '1/2', odds: 26.0, status: 'active' },
          { name: 'X/1', odds: 4.50, status: 'active' },
          { name: 'X/X', odds: 5.80, status: 'active' },
          { name: 'X/2', odds: 11.0, status: 'active' },
          { name: '2/1', odds: 19.0, status: 'active' },
          { name: '2/X', odds: 13.0, status: 'active' },
          { name: '2/2', odds: 8.50, status: 'active' },
        ],
      },
      {
        id: 'mkt-cs', name: 'Correct Score', category: 'specials', suspended: false,
        selections: [
          { name: '1-0', odds: 7.50, status: 'active' },
          { name: '2-0', odds: 8.00, status: 'active' },
          { name: '2-1', odds: 7.00, status: 'active' },
          { name: '0-0', odds: 11.0, status: 'active' },
          { name: '1-1', odds: 6.50, status: 'active' },
          { name: '0-1', odds: 12.0, status: 'active' },
          { name: '0-2', odds: 17.0, status: 'active' },
          { name: '1-2', odds: 10.0, status: 'active' },
          { name: '3-0', odds: 15.0, status: 'active' },
        ],
      },
      {
        id: 'mkt-hcap', name: 'Handicap (-1)', category: 'handicap', suspended: false,
        selections: [
          { name: 'Man City -1', odds: 2.90, status: 'active' },
          { name: 'Draw', odds: 3.20, status: 'active' },
          { name: 'Arsenal +1', odds: 2.40, status: 'active' },
        ],
      },
    ],
    stats: {
      homeForm: ['W', 'W', 'D', 'W', 'L'],
      awayForm: ['W', 'L', 'W', 'W', 'D'],
      h2h: { home: 12, draw: 5, away: 8 },
      standings: [
        { team: 'Man City', played: 20, won: 15, drawn: 3, lost: 2, points: 48 },
        { team: 'Arsenal', played: 20, won: 14, drawn: 4, lost: 2, points: 46 },
        { team: 'Liverpool', played: 20, won: 13, drawn: 5, lost: 2, points: 44 },
        { team: 'Chelsea', played: 20, won: 10, drawn: 5, lost: 5, points: 35 },
        { team: 'Tottenham', played: 20, won: 9, drawn: 4, lost: 7, points: 31 },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <div className="bg-[#161B22] border-b border-[#21262D]">
      {/* Back row skeleton */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-5 h-5 skeleton rounded" />
        <div className="h-4 w-40 skeleton rounded" />
      </div>
      {/* Match header skeleton */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 skeleton rounded-full" />
            <div className="h-4 w-28 skeleton rounded" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-8 w-16 skeleton rounded" />
            <div className="h-3 w-12 skeleton rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-28 skeleton rounded" />
            <div className="w-10 h-10 skeleton rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="bg-[#161B22] border-b border-[#21262D] overflow-hidden">
      <div className="p-3 flex items-center justify-between">
        <div className="h-4 w-36 skeleton rounded" />
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 skeleton rounded-md" />
          <div className="h-4 w-4 skeleton rounded" />
        </div>
      </div>
      <div className="px-3 pb-3 grid grid-cols-3 gap-2">
        <div className="h-10 skeleton rounded-md" />
        <div className="h-10 skeleton rounded-md" />
        <div className="h-10 skeleton rounded-md" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Logo Component
// ---------------------------------------------------------------------------

function TeamLogo({
  name,
  logo,
  country,
  slug,
  size = 'md',
}: {
  name: string;
  logo?: string;
  country?: string | null;
  slug: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' };
  const textMap = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };
  const flagMap = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' };
  const dim = sizeMap[size];

  if (logo) {
    return (
      <div className={cn(dim, 'relative shrink-0')}>
        <Image
          src={logo}
          alt={name}
          fill
          className="object-contain"
          sizes={size === 'lg' ? '56px' : size === 'md' ? '40px' : '32px'}
        />
      </div>
    );
  }

  if (INDIVIDUAL_SPORTS.has(slug) && country) {
    return (
      <span className={cn(dim, 'flex items-center justify-center shrink-0', flagMap[size])}>
        {countryToFlag(country)}
      </span>
    );
  }

  return (
    <div
      className={cn(dim, 'rounded-full flex items-center justify-center font-bold text-white shrink-0', textMap[size])}
      style={{ backgroundColor: getAvatarColor(name || '') }}
    >
      {(name || 'T').charAt(0)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OddsButton - Cloudbet style
// ---------------------------------------------------------------------------

function OddsButton({
  selectionId, eventId, eventName, sportId, sportName, marketId, marketName,
  outcomeName, odds, previousOdds, startTime, isLive, suspended,
  onMobileClick, compact, label,
}: {
  selectionId?: string; eventId: string; eventName: string; sportId: string; sportName: string;
  marketId: string; marketName: string; outcomeName: string; odds: number;
  previousOdds?: number; startTime: string; isLive: boolean; suspended: boolean;
  onMobileClick?: (data: QuickBetState) => void;
  compact?: boolean;
  label?: string;
}) {
  const { addSelection, hasSelection } = useBetSlipStore();
  const isSelected = hasSelection(eventId, marketId, outcomeName);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (previousOdds && previousOdds !== odds) {
      const cls = odds > previousOdds ? 'flash-increase' : 'flash-decrease';
      setFlashClass(cls);
      const timer = setTimeout(() => setFlashClass(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [odds, previousOdds]);

  const handleClick = () => {
    if (suspended) return;

    if (onMobileClick && window.innerWidth < 1024) {
      onMobileClick({
        open: true,
        selectionId: selectionId || `${eventId}-${marketId}-${outcomeName}`,
        eventId,
        eventName,
        sportId,
        sportName,
        marketId,
        marketName,
        outcomeName,
        odds,
        previousOdds,
        startTime,
        isLive,
      });
      return;
    }

    addSelection({
      id: selectionId || `${eventId}-${marketId}-${outcomeName}`,
      eventId, eventName, marketId, marketName, outcomeName, odds,
      sportId, sportName, startTime, isLive,
    });
  };

  const displayLabel = label || outcomeName;

  return (
    <button
      disabled={suspended}
      onClick={handleClick}
      className={cn(
        'relative flex items-center justify-between w-full rounded-md transition-all duration-150 group',
        'bg-[#1C2128] hover:bg-[#252C35] border border-[#30363D]/60',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        isSelected && 'bg-[#8B5CF6]/15 border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/25',
        suspended && 'opacity-40 cursor-not-allowed',
        flashClass
      )}
    >
      {suspended ? (
        <Lock className="w-3.5 h-3.5 text-[#484F58] mx-auto" />
      ) : (
        <>
          <span className={cn(
            'text-[#8B949E] truncate mr-2',
            compact ? 'text-[11px]' : 'text-xs',
          )}>
            {displayLabel}
          </span>
          <span className={cn(
            'font-mono font-bold text-[#10B981] flex items-center gap-0.5 shrink-0',
            compact ? 'text-xs' : 'text-sm',
          )}>
            {formatOdds(odds)}
            {previousOdds && previousOdds !== odds && (
              odds > previousOdds
                ? <TrendingUp className="w-3 h-3 text-[#10B981] ml-0.5" />
                : <TrendingDown className="w-3 h-3 text-[#EF4444] ml-0.5" />
            )}
          </span>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Market Period Toggle (FT / 1H / 2H) - Cloudbet pill style
// ---------------------------------------------------------------------------

function PeriodToggle({
  activePeriod,
  onChangePeriod,
}: {
  activePeriod: string;
  onChangePeriod: (p: string) => void;
}) {
  const periods = ['FT', '1H', '2H'];
  return (
    <div className="flex items-center gap-0 bg-[#0D1117] rounded p-[2px]">
      {periods.map((p) => (
        <button
          key={p}
          onClick={(e) => {
            e.stopPropagation();
            onChangePeriod(p);
          }}
          className={cn(
            'px-2 py-[3px] text-[10px] font-bold rounded transition-all leading-none',
            activePeriod === p
              ? 'bg-[#8B5CF6] text-white'
              : 'text-[#484F58] hover:text-[#8B949E]',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Timeline (Cloudbet-style live tracker)
// ---------------------------------------------------------------------------

function MatchTimeline({
  event,
  homeShort,
  awayShort,
}: {
  event: EventDetail;
  homeShort: string;
  awayShort: string;
}) {
  const timeMarkers = [15, 30, 45, 60, 75, 90];
  const currentMinute = event.time ? parseInt(event.time.replace("'", ''), 10) : 0;

  return (
    <div className="bg-[#0D1117] rounded-lg px-3 py-2.5">
      {/* Team abbrevs */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-[#E6EDF3]">{homeShort}</span>
        <span className="text-[10px] font-bold text-[#E6EDF3]">{awayShort}</span>
      </div>
      {/* Timeline bar */}
      <div className="relative h-3 bg-[#161B22] rounded-full overflow-hidden">
        {/* Progress */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#8B5CF6]/40 to-[#8B5CF6]/20 rounded-full transition-all duration-1000"
          style={{ width: `${Math.min((currentMinute / 90) * 100, 100)}%` }}
        />
        {/* HT marker */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#30363D]" />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[7px] text-[#484F58] font-bold">
          HT
        </span>
        {/* Goal dots for home */}
        {event.score && event.score.home > 0 && (
          <div
            className="absolute top-0.5 w-1.5 h-1.5 bg-[#8B5CF6] rounded-full"
            style={{ left: `${Math.min(Math.max((currentMinute * 0.6 / 90) * 100, 5), 45)}%` }}
          />
        )}
        {/* Goal dots for away */}
        {event.score && event.score.away > 0 && (
          <div
            className="absolute bottom-0.5 w-1.5 h-1.5 bg-[#10B981] rounded-full"
            style={{ left: `${Math.min(Math.max((currentMinute * 0.8 / 90) * 100, 10), 70)}%` }}
          />
        )}
      </div>
      {/* Time markers */}
      <div className="flex items-center justify-between mt-1">
        {timeMarkers.map((t) => (
          <span key={t} className="text-[8px] text-[#484F58] font-mono">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Bet Bottom Sheet (Mobile)
// ---------------------------------------------------------------------------

function QuickBetSheet({
  state,
  event,
  onClose,
}: {
  state: QuickBetState;
  event: EventDetail;
  onClose: () => void;
}) {
  const { addSelection } = useBetSlipStore();
  const [amount, setAmount] = useState('');
  const [acceptChanges, setAcceptChanges] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);

  const numericAmount = parseFloat(amount) || 0;
  const potentialWin = numericAmount * state.odds;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleNumPad = (val: string) => {
    if (val === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amount.includes('.')) {
        setAmount((prev) => (prev === '' ? '0.' : prev + '.'));
      }
    } else {
      setAmount((prev) => {
        const parts = prev.split('.');
        if (parts[1] && parts[1].length >= 2) return prev;
        return prev + val;
      });
    }
  };

  const handleQuickAdd = (val: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + val).toString());
  };

  const handleAddToBetslip = () => {
    addSelection({
      id: state.selectionId,
      eventId: state.eventId,
      eventName: state.eventName,
      marketId: state.marketId,
      marketName: state.marketName,
      outcomeName: state.outcomeName,
      odds: state.odds,
      sportId: state.sportId,
      sportName: state.sportName,
      startTime: state.startTime,
      isLive: state.isLive,
    });
    onClose();
  };

  const handlePlaceBet = () => {
    if (numericAmount <= 0) return;
    addSelection({
      id: state.selectionId,
      eventId: state.eventId,
      eventName: state.eventName,
      marketId: state.marketId,
      marketName: state.marketName,
      outcomeName: state.outcomeName,
      odds: state.odds,
      sportId: state.sportId,
      sportName: state.sportName,
      startTime: state.startTime,
      isLive: state.isLive,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 lg:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#161B22] rounded-t-2xl lg:hidden animate-slide-up"
        style={{ maxHeight: '90vh' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-[#30363D] rounded-full" />
        </div>

        {/* Balance info */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-[#21262D]">
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3]">
            <X className="w-5 h-5" />
          </button>
          <span className="text-xs text-[#8B949E]">
            Available balance: <span className="text-[#E6EDF3] font-medium">USDT 0</span>
          </span>
        </div>

        {/* Match info */}
        <div className="px-4 py-3 flex items-center gap-3 border-b border-[#21262D]">
          <TeamLogo name={event.homeTeam} logo={event.homeTeamLogo} country={event.homeTeamCountry} slug={event.sportId} size="sm" />
          {event.status?.toLowerCase() === 'live' && event.score ? (
            <div className="text-center flex-1">
              <div className="text-sm font-bold font-mono text-[#E6EDF3]">
                {event.score.home} - {event.score.away}
              </div>
              <div className="text-[10px] text-[#EF4444]">{event.time}</div>
            </div>
          ) : (
            <div className="text-center flex-1">
              <div className="text-xs text-[#8B949E]">vs</div>
            </div>
          )}
          <TeamLogo name={event.awayTeam} logo={event.awayTeamLogo} country={event.awayTeamCountry} slug={event.sportId} size="sm" />
        </div>

        {/* Selected bet info */}
        <div className="px-4 py-3 border-b border-[#21262D]">
          <div className="text-sm font-bold text-[#E6EDF3]">{state.outcomeName}</div>
          <div className="text-xs text-[#8B949E] mt-0.5">{state.marketName}</div>
          <div className="flex items-center gap-2 mt-1">
            {state.previousOdds && state.previousOdds !== state.odds && (
              <span className="text-xs text-[#8B949E] line-through font-mono">
                {formatOdds(state.previousOdds)}
              </span>
            )}
            <span className="text-sm font-bold font-mono text-[#10B981]">{formatOdds(state.odds)}</span>
          </div>
          {state.previousOdds && state.previousOdds !== state.odds && (
            <div className="text-[10px] text-[#F59E0B] mt-1">Odds have changed.</div>
          )}
        </div>

        {/* Amount input */}
        <div className="px-4 py-3 border-b border-[#21262D]">
          <div className="flex items-center gap-2 bg-[#0D1117] rounded-lg px-3 py-2.5 border border-[#30363D]">
            <span className="text-xs text-[#8B949E] font-medium">USDT</span>
            <input
              type="text"
              value={amount}
              readOnly
              placeholder="0"
              className="flex-1 bg-transparent text-right text-lg font-mono text-[#E6EDF3] outline-none placeholder-[#30363D]"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[#8B949E]">Max per bet: USDT 4,065.61</span>
            {numericAmount > 0 && (
              <span className="text-[10px] text-[#8B949E]">
                Potential win: <span className="text-[#10B981] font-mono">{potentialWin.toFixed(2)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick add buttons */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-[#21262D]">
          {[1, 2, 5, 10].map((val) => (
            <button
              key={val}
              onClick={() => handleQuickAdd(val)}
              className="flex-1 py-1.5 text-sm font-semibold text-[#10B981] bg-[#10B981]/10 rounded-md hover:bg-[#10B981]/20 transition-colors"
            >
              +{val}
            </button>
          ))}
        </div>

        {/* Number pad */}
        <div className="px-4 py-2 grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
            <button
              key={key}
              onClick={() => handleNumPad(key)}
              className={cn(
                'py-3 rounded-lg text-lg font-semibold transition-colors',
                key === 'backspace'
                  ? 'bg-[#1C2128] text-[#8B949E] hover:bg-[#272D36] flex items-center justify-center'
                  : 'bg-[#1C2128] text-[#E6EDF3] hover:bg-[#272D36]',
              )}
            >
              {key === 'backspace' ? <Delete className="w-5 h-5" /> : key}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={handleAddToBetslip}
            className="flex-1 py-3 rounded-lg text-sm font-semibold border border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors"
          >
            Add to betslip
          </button>
          <button
            onClick={handlePlaceBet}
            disabled={numericAmount <= 0}
            className={cn(
              'flex-1 py-3 rounded-lg text-sm font-semibold transition-colors',
              numericAmount > 0
                ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'
                : 'bg-[#30363D] text-[#8B949E] cursor-not-allowed',
            )}
          >
            Place bet
          </button>
        </div>

        {/* Accept changes toggle */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <span className="text-[10px] text-[#8B949E]">Accept all odds changes and partial placements</span>
          <button
            onClick={() => setAcceptChanges(!acceptChanges)}
            className={cn(
              'w-9 h-5 rounded-full transition-colors relative',
              acceptChanges ? 'bg-[#8B5CF6]' : 'bg-[#30363D]',
            )}
          >
            <div
              className={cn(
                'w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform',
                acceptChanges ? 'translate-x-[18px]' : 'translate-x-1',
              )}
            />
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Event Detail Page - Cloudbet Design
// ---------------------------------------------------------------------------

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  const [favoriteMarkets, setFavoriteMarkets] = useState<Set<string>>(new Set());
  const [marketPeriods, setMarketPeriods] = useState<Record<string, string>>({});
  const [quickBet, setQuickBet] = useState<QuickBetState | null>(null);
  const [showStats, setShowStats] = useState(false);

  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ---- Category scroll arrows ----
  const checkScroll = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, isLoading]);

  const scrollCategories = useCallback((dir: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' });
  }, []);

  // ---- Data fetching ----
  useEffect(() => {
    async function fetchData() {
      try {
        const raw = await get<{ event: any }>(`/events/${eventId}`);
        const apiEvent = raw.event;
        const transformed: EventDetail = {
          id: apiEvent.id,
          sportId: apiEvent.sport?.slug ?? slug,
          sportName: apiEvent.sport?.name ?? slug,
          competitionName: apiEvent.competition?.name ?? '',
          homeTeam: apiEvent.homeTeam ?? '',
          awayTeam: apiEvent.awayTeam ?? '',
          homeTeamLogo: apiEvent.homeTeamLogo ?? undefined,
          awayTeamLogo: apiEvent.awayTeamLogo ?? undefined,
          homeTeamCountry: apiEvent.homeTeamCountry ?? apiEvent.metadata?.homeTeamCountry ?? null,
          awayTeamCountry: apiEvent.awayTeamCountry ?? apiEvent.metadata?.awayTeamCountry ?? null,
          startTime: apiEvent.startTime,
          status: (apiEvent.status ?? 'upcoming').toLowerCase() as EventDetail['status'],
          score: apiEvent.scores as { home: number; away: number } | undefined,
          time: deriveMatchTime(apiEvent.metadata, slug),
          period: deriveMatchPeriod(apiEvent.metadata, slug),
          rawTimer: apiEvent.metadata?.timer ?? null,
          markets: (apiEvent.markets ?? []).map((m: any) => ({
            id: m.id,
            name: m.name,
            category: m.type?.toLowerCase() ?? 'main',
            suspended: m.status === 'SUSPENDED',
            selections: (m.selections ?? []).map((s: any) => ({
              id: s.id,
              name: s.name,
              odds: typeof s.odds === 'string' ? parseFloat(s.odds) : s.odds,
              status: (s.status ?? 'ACTIVE').toLowerCase(),
            })),
          })),
        };
        setEvent(transformed);
        setExpandedMarkets(new Set(transformed.markets.slice(0, 6).map((m: Market) => m.id)));
      } catch {
        const mockEvent = generateMockEvent(slug, eventId);
        setEvent(mockEvent);
        setExpandedMarkets(new Set(mockEvent.markets.slice(0, 6).map((m) => m.id)));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [slug, eventId]);

  // ---- Real-time: odds updates ----
  useSocketEvent('odds:update', (data) => {
    if (data.eventId !== eventId || !event) return;
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        markets: prev.markets.map((m) => {
          if (m.id !== data.marketId) return m;
          return {
            ...m,
            selections: m.selections.map((s) => ({
              ...s,
              previousOdds: s.odds,
              odds: data.odds[s.name] ?? s.odds,
            })),
          };
        }),
      };
    });
  });

  // ---- Real-time: score updates ----
  useSocketEvent('event:scoreUpdate', (data) => {
    if (data.eventId !== eventId) return;
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        score: data.score as { home: number; away: number },
        time: data.time,
      };
    });
  });

  // ---- Real-time: event status ----
  useSocketEvent('event:status', (data) => {
    if (data.eventId !== eventId) return;
    setEvent((prev) => {
      if (!prev) return prev;
      const newStatus = data.status.toLowerCase();
      return {
        ...prev,
        status: newStatus,
        markets: newStatus === 'ended' || newStatus === 'finished'
          ? prev.markets.map((m) => ({ ...m, suspended: true }))
          : prev.markets,
      };
    });
  });

  // ---- Real-time: score updates (new format) ----
  useSocketEvent('score:update', (data) => {
    if (data.eventId !== eventId) return;
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        score: { home: data.scores.homeScore, away: data.scores.awayScore },
        time: data.scores.time,
        period: data.scores.period,
      };
    });
  });

  // ---- Derived state ----
  const isEventEnded = event?.status?.toLowerCase() === 'ended' || event?.status?.toLowerCase() === 'finished';
  const isLive = event?.status?.toLowerCase() === 'live';

  const toggleMarket = useCallback((id: string) => {
    setExpandedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavoriteMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setMarketPeriod = useCallback((marketId: string, period: string) => {
    setMarketPeriods((prev) => ({ ...prev, [marketId]: period }));
  }, []);

  // Filter markets by category and search
  const filteredMarkets = useMemo(() => {
    if (!event) return [];
    let markets = event.markets || [];

    if (activeCategory === 'favorites') {
      markets = markets.filter((m) => favoriteMarkets.has(m.id));
    } else if (activeCategory !== 'all') {
      markets = markets.filter((m) => m.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      markets = markets.filter((m) => m.name.toLowerCase().includes(q));
    }

    return markets;
  }, [event, activeCategory, searchQuery, favoriteMarkets]);

  const openQuickBet = useCallback((data: QuickBetState) => {
    setQuickBet(data);
  }, []);

  const closeQuickBet = useCallback(() => {
    setQuickBet(null);
  }, []);

  // Short names for teams
  const homeShort = event ? getShortName(event.homeTeam) : '';
  const awayShort = event ? getShortName(event.awayTeam) : '';

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D1117]">
        <HeaderSkeleton />
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <MarketSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center py-20 min-h-screen bg-[#0D1117]">
        <p className="text-[#8B949E]">Event not found</p>
      </div>
    );
  }

  const eventName = `${event.homeTeam} v ${event.awayTeam}`;

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20 lg:pb-4">
      {/* ================================================================ */}
      {/* MATCH HEADER - Cloudbet style                                    */}
      {/* ================================================================ */}
      <div className="bg-[#161B22] border-b border-[#21262D]">
        {/* Row 1: Back + Competition */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#21262D]/60">
          <button
            onClick={() => router.back()}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors shrink-0 -ml-1"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-[#8B949E] truncate">
              {event.sportName} / {event.competitionName}
            </div>
          </div>
          {isLive && (
            <LiveIndicator size="sm" />
          )}
        </div>

        {/* Row 2: Teams vs Score - Cloudbet centered layout */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Home team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <TeamLogo name={event.homeTeam} logo={event.homeTeamLogo} country={event.homeTeamCountry} slug={slug} size="lg" />
              <div className="flex items-center gap-1.5">
                {event.homeTeamCountry && (
                  <span className="text-sm">{countryToFlag(event.homeTeamCountry)}</span>
                )}
                <span className="text-xs font-semibold text-[#E6EDF3] truncate max-w-[100px] text-center">
                  {event.homeTeam}
                </span>
              </div>
            </div>

            {/* Score / Time center */}
            <div className="flex flex-col items-center px-3 shrink-0">
              {isLive && event.score ? (
                <>
                  <div className="flex items-center gap-2 tracking-wider">
                    <AnimatedScore score={event.score.home} teamName={event.homeTeam} size="lg" />
                    <span className="text-3xl font-black text-[#484F58] mx-1">:</span>
                    <AnimatedScore score={event.score.away} teamName={event.awayTeam} size="lg" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <LiveMatchClock
                      startTime={event.startTime}
                      period={event.period || '1H'}
                      timer={event.rawTimer?.tm ?? null}
                      timerSeconds={event.rawTimer?.ts ?? null}
                      sportSlug={slug}
                      size="sm"
                    />
                  </div>
                </>
              ) : isEventEnded && event.score ? (
                <>
                  <div className="text-3xl font-black font-mono text-[#8B949E] tracking-wider">
                    {event.score.home} <span className="text-[#484F58] mx-1">:</span> {event.score.away}
                  </div>
                  <span className="text-[10px] text-[#8B949E] font-medium mt-1">Full Time</span>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-[#484F58] tracking-wider">vs</div>
                  <span className="text-[10px] text-[#8B949E] mt-1 whitespace-nowrap">
                    {getMatchTime(event.startTime)}
                  </span>
                </>
              )}
            </div>

            {/* Away team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <TeamLogo name={event.awayTeam} logo={event.awayTeamLogo} country={event.awayTeamCountry} slug={slug} size="lg" />
              <div className="flex items-center gap-1.5">
                {event.awayTeamCountry && (
                  <span className="text-sm">{countryToFlag(event.awayTeamCountry)}</span>
                )}
                <span className="text-xs font-semibold text-[#E6EDF3] truncate max-w-[100px] text-center">
                  {event.awayTeam}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Stats Toggle */}
        {event.stats && (
          <div className="border-t border-[#21262D]">
            <button
              onClick={() => setShowStats(!showStats)}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors',
                showStats ? 'text-[#8B5CF6]' : 'text-[#8B949E] hover:text-[#E6EDF3]',
              )}
            >
              <BarChart3 className="w-3 h-3" />
              Match Stats
              {showStats ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* STATS PANEL (collapsible)                                        */}
      {/* ================================================================ */}
      {showStats && event.stats && (
        <div className="bg-[#161B22] border-b border-[#21262D] animate-slide-down">
          {/* Form */}
          <div className="px-4 py-3 border-b border-[#21262D]/50">
            <h4 className="text-[10px] uppercase tracking-wider text-[#484F58] font-bold mb-2">Recent Form</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#E6EDF3] font-medium w-24 truncate">{event.homeTeam}</span>
                <div className="flex gap-1">
                  {event.stats.homeForm.map((r, i) => (
                    <span key={i} className={cn(
                      'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold',
                      r === 'W' && 'bg-[#10B981] text-white',
                      r === 'D' && 'bg-[#F59E0B] text-white',
                      r === 'L' && 'bg-[#EF4444] text-white',
                    )}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#E6EDF3] font-medium w-24 truncate">{event.awayTeam}</span>
                <div className="flex gap-1">
                  {event.stats.awayForm.map((r, i) => (
                    <span key={i} className={cn(
                      'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold',
                      r === 'W' && 'bg-[#10B981] text-white',
                      r === 'D' && 'bg-[#F59E0B] text-white',
                      r === 'L' && 'bg-[#EF4444] text-white',
                    )}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* H2H */}
          <div className="px-4 py-3">
            <h4 className="text-[10px] uppercase tracking-wider text-[#484F58] font-bold mb-2">Head to Head</h4>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-[#8B5CF6] font-mono">{event.stats.h2h.home}</div>
                <div className="text-[10px] text-[#8B949E]">{homeShort}</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-[#8B949E] font-mono">{event.stats.h2h.draw}</div>
                <div className="text-[10px] text-[#8B949E]">Draw</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-[#10B981] font-mono">{event.stats.h2h.away}</div>
                <div className="text-[10px] text-[#8B949E]">{awayShort}</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden flex bg-[#0D1117]">
              {(() => {
                const total = event.stats!.h2h.home + event.stats!.h2h.draw + event.stats!.h2h.away;
                return (
                  <>
                    <div className="bg-[#8B5CF6] h-full rounded-l-full" style={{ width: `${(event.stats!.h2h.home / total) * 100}%` }} />
                    <div className="bg-[#8B949E] h-full" style={{ width: `${(event.stats!.h2h.draw / total) * 100}%` }} />
                    <div className="bg-[#10B981] h-full rounded-r-full" style={{ width: `${(event.stats!.h2h.away / total) * 100}%` }} />
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MATCH TIMELINE (live only)                                       */}
      {/* ================================================================ */}
      {isLive && event.score && (
        <div className="px-4 py-2 bg-[#0D1117]">
          <MatchTimeline event={event} homeShort={homeShort} awayShort={awayShort} />
        </div>
      )}

      {/* ================================================================ */}
      {/* MATCH ENDED BANNER                                               */}
      {/* ================================================================ */}
      {isEventEnded && (
        <div className="mx-3 mt-3 bg-[#8B949E]/8 border border-[#8B949E]/15 rounded-lg p-3 flex items-center gap-3">
          <Shield className="w-4 h-4 text-[#8B949E] shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[#E6EDF3]">Match Ended</p>
            <p className="text-[10px] text-[#8B949E]">
              {event.score
                ? `Final: ${event.homeTeam} ${event.score.home} - ${event.score.away} ${event.awayTeam}`
                : 'This event has finished. Betting is closed.'}
            </p>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MARKET CATEGORY TABS - Cloudbet horizontal scrollable            */}
      {/* ================================================================ */}
      <div className="relative bg-[#0D1117] border-b border-[#21262D] sticky top-0 z-30">
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scrollCategories('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-[#0D1117] via-[#0D1117] to-transparent"
          >
            <ChevronLeft className="w-4 h-4 text-[#8B949E]" />
          </button>
        )}

        <div
          ref={categoryScrollRef}
          className="flex items-center overflow-x-auto scrollbar-hide"
        >
          {MARKET_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  'whitespace-nowrap px-4 py-3 text-xs font-medium transition-all shrink-0 relative border-b-2',
                  isActive
                    ? 'text-[#E6EDF3] border-[#8B5CF6]'
                    : 'text-[#8B949E] border-transparent hover:text-[#E6EDF3]',
                )}
              >
                {cat.icon ? (
                  <Star className={cn(
                    'w-3.5 h-3.5',
                    isActive ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#8B949E]',
                  )} />
                ) : (
                  cat.label
                )}
              </button>
            );
          })}
        </div>

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            onClick={() => scrollCategories('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-[#0D1117] via-[#0D1117] to-transparent"
          >
            <ChevronRight className="w-4 h-4 text-[#8B949E]" />
          </button>
        )}
      </div>

      {/* ================================================================ */}
      {/* SEARCH BAR - Cloudbet style                                      */}
      {/* ================================================================ */}
      <div className="px-3 py-2.5 bg-[#0D1117]">
        <div className="flex items-center gap-2 bg-[#161B22] border border-[#21262D] rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-[#484F58] shrink-0" />
          <input
            type="text"
            placeholder="Search all markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-[#E6EDF3] placeholder-[#484F58] outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#484F58] hover:text-[#8B949E]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* MARKET CARDS - Cloudbet collapsible sections                     */}
      {/* ================================================================ */}
      <div className="space-y-0">
        {filteredMarkets.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-[#8B949E]">
              {activeCategory === 'favorites'
                ? 'No favourite markets yet. Star a market to add it here.'
                : searchQuery
                  ? `No markets matching "${searchQuery}"`
                  : 'No markets available in this category'}
            </p>
          </div>
        ) : (
          filteredMarkets.map((market) => {
            const isExpanded = expandedMarkets.has(market.id);
            const isFavorite = favoriteMarkets.has(market.id);
            const period = marketPeriods[market.id] || 'FT';
            const selections = market.selections || [];
            const selCount = selections.length;
            const is2Way = selCount === 2;
            const is3Way = selCount === 3;
            const isTotals = market.name.toLowerCase().includes('total') || market.name.toLowerCase().includes('over/under');

            return (
              <div key={market.id} className="bg-[#161B22] border-b border-[#21262D]">
                {/* Market Header - Cloudbet style */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleMarket(market.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#1C2128]/40 transition-colors cursor-pointer"
                >
                  {/* Market name */}
                  <span className="text-[13px] font-semibold text-[#E6EDF3] truncate flex-1 text-left">
                    {market.name}
                  </span>

                  {/* Right side controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Info icon */}
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-0.5 text-[#484F58] hover:text-[#8B949E] transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    {/* Live stats icon */}
                    {isLive && (
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-0.5 text-[#484F58] hover:text-[#8B949E] transition-colors"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* FT/1H/2H toggle */}
                    <PeriodToggle
                      activePeriod={period}
                      onChangePeriod={(p) => setMarketPeriod(market.id, p)}
                    />

                    {/* Favorite star */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(market.id); }}
                      className="p-0.5"
                    >
                      <Star
                        className={cn(
                          'w-3.5 h-3.5 transition-colors',
                          isFavorite ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#484F58] hover:text-[#8B949E]',
                        )}
                      />
                    </button>

                    {/* Suspended badge */}
                    {market.suspended && !isEventEnded && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] rounded font-medium">
                        Suspended
                      </span>
                    )}

                    {/* Settled badge */}
                    {isEventEnded && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#8B949E]/10 text-[#8B949E] rounded font-medium">
                        Settled
                      </span>
                    )}

                    {/* Chevron */}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#484F58]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#484F58]" />
                    )}
                  </div>
                </div>

                {/* Market Body */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    {/* Totals market: show current goals info */}
                    {isTotals && isLive && event.score && (
                      <div className="text-[11px] text-[#8B949E] mb-2 flex items-center gap-1">
                        <Info className="w-3 h-3 text-[#484F58]" />
                        <span>
                          Current goals: {event.score.home + event.score.away} ({event.score.home}-{event.score.away})
                        </span>
                      </div>
                    )}

                    {/* 2-way layout (Asian Handicap, Over/Under, etc.) */}
                    {is2Way && !isTotals && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {selections.map((sel) => (
                          <div key={sel.name} className="relative">
                            <OddsButton
                              selectionId={sel.id}
                              eventId={event.id}
                              eventName={eventName}
                              sportId={slug}
                              sportName={event.sportName}
                              marketId={market.id}
                              marketName={market.name}
                              outcomeName={sel.name}
                              odds={sel.odds}
                              previousOdds={sel.previousOdds}
                              startTime={event.startTime}
                              isLive={isLive || false}
                              suspended={market.suspended || sel.status === 'suspended' || !!isEventEnded}
                              onMobileClick={openQuickBet}
                              label={`${sel.name.includes(homeShort) || sel.name.includes(event.homeTeam.split(' ').pop() || '') ? homeShort : sel.name.includes(awayShort) || sel.name.includes(event.awayTeam.split(' ').pop() || '') ? awayShort : sel.name}  ${formatOdds(sel.odds)}`}
                            />
                            {isEventEnded && sel.status === 'resulted' && (
                              <div className="absolute -top-1 -right-1 z-10">
                                <CheckCircle className="w-4 h-4 text-[#10B981]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Totals 2-way with Over/Under headers */}
                    {is2Way && isTotals && (
                      <div>
                        {/* Over/Under column headers */}
                        <div className="grid grid-cols-2 gap-1.5 mb-1">
                          <div className="text-[10px] text-[#484F58] font-semibold text-center">Over</div>
                          <div className="text-[10px] text-[#484F58] font-semibold text-center">Under</div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {selections.map((sel) => (
                            <div key={sel.name} className="relative">
                              <OddsButton
                                selectionId={sel.id}
                                eventId={event.id}
                                eventName={eventName}
                                sportId={slug}
                                sportName={event.sportName}
                                marketId={market.id}
                                marketName={market.name}
                                outcomeName={sel.name}
                                odds={sel.odds}
                                previousOdds={sel.previousOdds}
                                startTime={event.startTime}
                                isLive={isLive || false}
                                suspended={market.suspended || sel.status === 'suspended' || !!isEventEnded}
                                onMobileClick={openQuickBet}
                              />
                              {isEventEnded && sel.status === 'resulted' && (
                                <div className="absolute -top-1 -right-1 z-10">
                                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3-way layout (Full Time Result, Double Chance, etc.) */}
                    {is3Way && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {selections.map((sel) => {
                          // Build Cloudbet-style label: "CIT 3.20" or "Draw 3.01"
                          let shortLabel = sel.name;
                          if (sel.name === event.homeTeam || sel.name.includes(event.homeTeam.split(' ').pop() || '__none__')) {
                            shortLabel = homeShort;
                          } else if (sel.name === event.awayTeam || sel.name.includes(event.awayTeam.split(' ').pop() || '__none__')) {
                            shortLabel = awayShort;
                          }
                          // For Double Chance style "1X", "12", "X2"
                          if (sel.name === '1X') shortLabel = `${homeShort} or Draw`;
                          if (sel.name === '12') shortLabel = `${homeShort} or ${awayShort}`;
                          if (sel.name === 'X2') shortLabel = `Draw or ${awayShort}`;

                          return (
                            <div key={sel.name} className="relative">
                              <OddsButton
                                selectionId={sel.id}
                                eventId={event.id}
                                eventName={eventName}
                                sportId={slug}
                                sportName={event.sportName}
                                marketId={market.id}
                                marketName={market.name}
                                outcomeName={sel.name}
                                odds={sel.odds}
                                previousOdds={sel.previousOdds}
                                startTime={event.startTime}
                                isLive={isLive || false}
                                suspended={market.suspended || sel.status === 'suspended' || !!isEventEnded}
                                onMobileClick={openQuickBet}
                                compact
                                label={shortLabel}
                              />
                              {isEventEnded && sel.status === 'resulted' && (
                                <div className="absolute -top-1 -right-1 z-10">
                                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Multi-line layout (Correct Score, HT/FT, etc.) */}
                    {!is2Way && !is3Way && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {selections.map((sel) => (
                          <div key={sel.name} className="relative">
                            <OddsButton
                              selectionId={sel.id}
                              eventId={event.id}
                              eventName={eventName}
                              sportId={slug}
                              sportName={event.sportName}
                              marketId={market.id}
                              marketName={market.name}
                              outcomeName={sel.name}
                              odds={sel.odds}
                              previousOdds={sel.previousOdds}
                              startTime={event.startTime}
                              isLive={isLive || false}
                              suspended={market.suspended || sel.status === 'suspended' || !!isEventEnded}
                              onMobileClick={openQuickBet}
                              compact
                            />
                            {isEventEnded && sel.status === 'resulted' && (
                              <div className="absolute -top-1 -right-1 z-10">
                                <CheckCircle className="w-4 h-4 text-[#10B981]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ================================================================ */}
      {/* FLOATING "MY BETS" BUTTON (mobile only)                          */}
      {/* ================================================================ */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 lg:hidden">
        <Link
          href="/bets"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#8B5CF6] text-white text-sm font-semibold rounded-full shadow-lg shadow-[#8B5CF6]/25 hover:bg-[#7C3AED] transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          My bets
        </Link>
      </div>

      {/* ================================================================ */}
      {/* QUICK BET BOTTOM SHEET (mobile only)                             */}
      {/* ================================================================ */}
      {quickBet && quickBet.open && (
        <QuickBetSheet
          state={quickBet}
          event={event}
          onClose={closeQuickBet}
        />
      )}

      {/* ================================================================ */}
      {/* GLOBAL STYLES                                                    */}
      {/* ================================================================ */}
      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 500px; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .flash-increase {
          animation: flash-green 0.6s ease-out;
        }
        .flash-decrease {
          animation: flash-red 0.6s ease-out;
        }
        @keyframes flash-green {
          0%, 100% { background-color: inherit; }
          50% { background-color: rgba(16, 185, 129, 0.2); }
        }
        @keyframes flash-red {
          0%, 100% { background-color: inherit; }
          50% { background-color: rgba(239, 68, 68, 0.2); }
        }
        .skeleton {
          background: linear-gradient(90deg, #1C2128 25%, #272D36 50%, #1C2128 75%);
          background-size: 200% 100%;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }
        @keyframes skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
