'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ban,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Search,
  Wifi,
  WifiOff,
  Zap,
  Trophy,
  Target,
  CircleDot,
  Swords,
  Gamepad2,
  Dumbbell,
  Bike,
} from 'lucide-react';
import { io as ioClient, type Socket } from 'socket.io-client';
import { cn, formatOdds } from '@/lib/utils';
import { get } from '@/lib/api';
import { useBetSlipStore, type BetSelection } from '@/stores/betSlipStore';
import { AnimatedScore, LiveMatchClock, LiveIndicator } from '@/components/LiveScoreTicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  startTime: string;
  status: string;
  scores?: { home?: number; away?: number } | null;
  metadata?: {
    elapsed?: number | null;
    statusShort?: string;
    statusLong?: string;
    round?: string;
    sport?: string;
    timer?: {
      tm?: number;
      ts?: number;
      ta?: number;
      q?: string;
      tt?: string;
      md?: number;
    };
    periodScores?: Record<string, { home: number; away: number }>;
    [key: string]: unknown;
  } | null;
  sport: string;
  sportSlug: string;
  competition: string;
  competitionSlug: string;
  time?: string | null;
  period?: string | null;
  mainMarket?: {
    id: string;
    name: string;
    type: string;
    selections: { id: string; name: string; outcome: string; odds: string | number; status: string }[];
  } | null;
}

interface GoalNotification {
  id: string;
  eventId: string;
  team: string;
  score: string;
  timestamp: number;
}

interface SportGroup {
  slug: string;
  name: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Socket.IO URL derivation
// ---------------------------------------------------------------------------

function getSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return apiUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Match Time Display Helper
// ---------------------------------------------------------------------------

function getMatchTimeDisplay(event: LiveEvent): string {
  if (event.time) return event.time;

  const meta = event.metadata;
  if (!meta) return 'LIVE';

  const statusShort = meta.statusShort || '';
  const elapsed = meta.elapsed;
  const timer = meta.timer;
  const sportSlug = event.sportSlug || meta.sport || '';

  // Football with BetsAPI timer
  if (sportSlug === 'football' && timer && timer.tm != null) {
    if (statusShort === 'HT') return 'HT';
    if (statusShort === 'FT') return 'FT';
    if (statusShort === 'P') return 'PEN';
    if (statusShort === 'BT') return 'Break';

    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const ta = timer.ta != null ? parseInt(String(timer.ta), 10) : 0;

    if (tm >= 90 && ta > 0) return `90+${ta}'`;
    if (tm >= 45 && tm < 46 && ta > 0 && statusShort === '1H') return `45+${ta}'`;
    if (ts > 0) return `${tm}:${String(ts).padStart(2, '0')}`;
    return `${tm}'`;
  }

  // Basketball with BetsAPI timer
  if (sportSlug === 'basketball' && timer && timer.q != null) {
    const q = parseInt(String(timer.q), 10) || 1;
    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const label = q <= 4 ? `Q${q}` : 'OT';
    return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
  }

  // Ice Hockey with BetsAPI timer
  if (sportSlug === 'ice-hockey' && timer && timer.q != null) {
    const p = parseInt(String(timer.q), 10) || 1;
    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const label = p <= 3 ? `P${p}` : 'OT';
    return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
  }

  // Football legacy
  if (sportSlug === 'football') {
    if (statusShort === 'HT') return 'HT';
    if (statusShort === 'FT') return 'FT';
    if (statusShort === 'ET') return elapsed ? `ET ${elapsed}'` : 'ET';
    if (statusShort === 'P') return 'PEN';
    if (statusShort === 'BT') return 'Break';
    if (elapsed) return `${elapsed}'`;
    if (statusShort === '1H') return '1H';
    if (statusShort === '2H') return '2H';
    return 'LIVE';
  }

  // Basketball legacy
  if (sportSlug === 'basketball') {
    switch (statusShort) {
      case 'Q1': return elapsed ? `Q1 ${elapsed}'` : 'Q1';
      case 'Q2': return elapsed ? `Q2 ${elapsed}'` : 'Q2';
      case 'Q3': return elapsed ? `Q3 ${elapsed}'` : 'Q3';
      case 'Q4': return elapsed ? `Q4 ${elapsed}'` : 'Q4';
      case 'OT': return elapsed ? `OT ${elapsed}'` : 'OT';
      case 'BT': return 'Break';
      case 'HT': return 'HT';
    }
    return statusShort || 'LIVE';
  }

  // Ice Hockey legacy
  if (sportSlug === 'ice-hockey') {
    switch (statusShort) {
      case 'P1': return elapsed ? `P1 ${elapsed}'` : '1st';
      case 'P2': return elapsed ? `P2 ${elapsed}'` : '2nd';
      case 'P3': return elapsed ? `P3 ${elapsed}'` : '3rd';
      case 'OT': return elapsed ? `OT ${elapsed}'` : 'OT';
      case 'BT': return 'Break';
    }
    return statusShort || 'LIVE';
  }

  // Handball
  if (sportSlug === 'handball') {
    if (statusShort === '1H') return elapsed ? `1H ${elapsed}'` : '1H';
    if (statusShort === '2H') return elapsed ? `2H ${elapsed}'` : '2H';
    if (statusShort === 'HT') return 'HT';
    return statusShort || 'LIVE';
  }

  // Volleyball
  if (sportSlug === 'volleyball') {
    switch (statusShort) {
      case 'S1': return 'Set 1';
      case 'S2': return 'Set 2';
      case 'S3': return 'Set 3';
      case 'S4': return 'Set 4';
      case 'S5': return 'Set 5';
    }
    return statusShort || 'LIVE';
  }

  // Rugby
  if (sportSlug === 'rugby') {
    if (statusShort === '1H') return elapsed ? `1H ${elapsed}'` : '1H';
    if (statusShort === '2H') return elapsed ? `2H ${elapsed}'` : '2H';
    if (statusShort === 'HT') return 'HT';
    return statusShort || 'LIVE';
  }

  // Baseball
  if (sportSlug === 'baseball') {
    const inningMatch = statusShort.match(/^IN(\d+)$/);
    if (inningMatch) return `${inningMatch[1]}th`;
    return statusShort || 'LIVE';
  }

  if (elapsed) return `${elapsed}'`;
  if (statusShort) return statusShort;
  return 'LIVE';
}

// ---------------------------------------------------------------------------
// Sport config for top filter bar (Cloudbet-style icons)
// ---------------------------------------------------------------------------

const SPORT_ICON_CONFIG: Record<string, { emoji: string; color: string }> = {
  football: { emoji: '\u26BD', color: '#22C55E' },
  soccer: { emoji: '\u26BD', color: '#22C55E' },
  basketball: { emoji: '\uD83C\uDFC0', color: '#F97316' },
  tennis: { emoji: '\uD83C\uDFBE', color: '#EAB308' },
  'ice-hockey': { emoji: '\uD83C\uDFD2', color: '#06B6D4' },
  baseball: { emoji: '\u26BE', color: '#EF4444' },
  cricket: { emoji: '\uD83C\uDFCF', color: '#84CC16' },
  volleyball: { emoji: '\uD83C\uDFD0', color: '#3B82F6' },
  handball: { emoji: '\uD83E\uDD3E', color: '#14B8A6' },
  'table-tennis': { emoji: '\uD83C\uDFD3', color: '#10B981' },
  'american-football': { emoji: '\uD83C\uDFC8', color: '#8B5CF6' },
  rugby: { emoji: '\uD83C\uDFC9', color: '#A855F7' },
  esports: { emoji: '\uD83C\uDFAE', color: '#8B5CF6' },
  mma: { emoji: '\uD83E\uDD4A', color: '#EF4444' },
  boxing: { emoji: '\uD83E\uDD4B', color: '#DC2626' },
  darts: { emoji: '\uD83C\uDFAF', color: '#F59E0B' },
  cycling: { emoji: '\uD83D\uDEB4', color: '#F59E0B' },
  squash: { emoji: '\uD83C\uDFBE', color: '#14B8A6' },
};

// ---------------------------------------------------------------------------
// Team Crest (small circle with initials)
// ---------------------------------------------------------------------------

function TeamCrest({ name, className }: { name: string; className?: string }) {
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Generate a deterministic color from the team name
  const hash = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = [
    '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#EF4444', '#F97316',
    '#F59E0B', '#EAB308', '#84CC16', '#22C55E',
    '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6',
  ];
  const bgColor = colors[hash % colors.length];

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full',
        className,
      )}
      style={{ backgroundColor: `${bgColor}22`, border: `1px solid ${bgColor}44` }}
    >
      <span className="text-[8px] font-bold leading-none" style={{ color: bgColor }}>
        {initials}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suspended Odds Icon (circle-slash / Ban icon)
// ---------------------------------------------------------------------------

function SuspendedOddsIcon() {
  return (
    <div className="flex items-center justify-center w-[52px] h-8">
      <Ban className="w-4 h-4 text-[#3D4450]" strokeWidth={1.5} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Odds Button (Cloudbet style: yellow-green odds)
// ---------------------------------------------------------------------------

function LiveOddsButton({
  eventId, eventName, sportId, sportName, marketId, marketName,
  selectionId, outcomeName, label, odds, startTime, suspended,
}: {
  eventId: string; eventName: string; sportId: string; sportName: string;
  marketId: string; marketName: string; selectionId: string;
  outcomeName: string; label: string; odds: number; startTime: string;
  suspended?: boolean;
}) {
  const { addSelection, hasSelection } = useBetSlipStore();
  const isSelected = hasSelection(eventId, marketId, outcomeName);

  if (suspended || odds <= 1) {
    return <SuspendedOddsIcon />;
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addSelection({
          id: selectionId || `${eventId}-${marketId}-${outcomeName}`,
          eventId, eventName, marketId, marketName, outcomeName, odds,
          sportId, sportName, startTime, isLive: true,
        });
      }}
      className={cn(
        'flex items-center justify-center w-[52px] h-8 rounded text-xs font-mono font-bold transition-all duration-200',
        isSelected
          ? 'bg-[#BFFF00]/20 text-[#BFFF00] ring-1 ring-[#BFFF00]/40'
          : 'bg-[#1C2128] hover:bg-[#252D38] text-[#BFFF00]',
      )}
    >
      {formatOdds(odds)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function EventRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1C2128]/50 last:border-0">
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="h-3 w-32 skeleton rounded" />
        <div className="h-3 w-28 skeleton rounded" />
      </div>
      <div className="flex gap-1">
        <div className="h-8 w-[52px] skeleton rounded" />
        <div className="h-8 w-[52px] skeleton rounded" />
        <div className="h-8 w-[52px] skeleton rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competition Section (collapsible)
// ---------------------------------------------------------------------------

function CompetitionSection({
  competitionName,
  events,
  sportSlug,
  flashingEvents,
  isBasketball,
}: {
  competitionName: string;
  events: LiveEvent[];
  sportSlug: string;
  flashingEvents: Set<string>;
  isBasketball: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  // Determine market header columns based on sport type
  const marketLabel = isBasketball ? 'Money Line' : 'Full Time Result';
  const colHeaders = isBasketball ? ['1', '2'] : ['1', 'X', '2'];

  return (
    <div className="border-b border-[#1C2128] last:border-b-0">
      {/* Competition Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-[#0F1318] hover:bg-[#141920] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Flag/logo placeholder */}
          <div className="w-4 h-3 rounded-sm bg-[#21262D] shrink-0 flex items-center justify-center overflow-hidden">
            <span className="text-[7px] text-[#8B949E]">
              {competitionName.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span className="text-xs font-medium text-[#C9D1D9] truncate">
            {competitionName}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-[#484F58] shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#484F58] shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {/* Market header row */}
            <div className="flex items-center px-4 py-1.5 bg-[#0D1117] border-b border-[#1C2128]/60">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[10px] font-medium text-[#484F58] uppercase tracking-wider">
                  {marketLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] text-[#238636] font-semibold uppercase">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#238636] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#238636]" />
                  </span>
                  Live
                </span>
              </div>
              <div className="flex gap-1">
                {colHeaders.map((h) => (
                  <div key={h} className="w-[52px] text-center text-[10px] font-semibold text-[#484F58]">
                    {h}
                  </div>
                ))}
              </div>
            </div>

            {/* Event rows */}
            {events.map((event, idx) => (
              <EventRow
                key={event.id}
                event={event}
                isFlashing={flashingEvents.has(event.id)}
                isBasketball={isBasketball}
                isLast={idx === events.length - 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Row (Cloudbet In-Play style)
// ---------------------------------------------------------------------------

function EventRow({
  event,
  isFlashing,
  isBasketball,
  isLast,
}: {
  event: LiveEvent;
  isFlashing: boolean;
  isBasketball: boolean;
  isLast: boolean;
}) {
  const market = event.mainMarket;
  const selections = market?.selections ?? [];
  const score = event.scores;
  const homeScore = score?.home ?? 0;
  const awayScore = score?.away ?? 0;
  const matchTime = getMatchTimeDisplay(event);

  // Determine if market is suspended (no active selections)
  const isSuspended = selections.length === 0 || selections.every(
    (s) => s.status !== 'ACTIVE' || (typeof s.odds === 'number' ? s.odds : parseFloat(String(s.odds))) <= 1
  );

  // Get selections by outcome for proper column mapping
  const getSelectionByOutcome = (outcome: string) => {
    return selections.find(
      (s) => s.outcome === outcome || s.name === outcome
    );
  };

  const homeSelection = getSelectionByOutcome('home') || getSelectionByOutcome('1') || selections[0];
  const drawSelection = getSelectionByOutcome('draw') || getSelectionByOutcome('X') || (selections.length >= 3 ? selections[1] : null);
  const awaySelection = getSelectionByOutcome('away') || getSelectionByOutcome('2') || (selections.length >= 3 ? selections[2] : selections[1]);

  // Parse time display for the inline format
  const isMinuteTime = matchTime.endsWith("'") || /^\d+:/.test(matchTime);
  const isBreakStatus = ['HT', 'FT', 'PEN', 'Break'].includes(matchTime);

  // Build odds columns
  const oddsColumns = isBasketball
    ? [homeSelection, awaySelection]
    : [homeSelection, drawSelection, awaySelection];

  return (
    <Link
      href={`/sports/${event.sportSlug}/${event.id}`}
      className={cn(
        'flex items-center px-4 py-2.5 transition-all duration-200 hover:bg-[#161B22] group',
        !isLast && 'border-b border-[#1C2128]/40',
        isFlashing && 'animate-score-flash',
      )}
    >
      {/* Left: Teams + Score + Time */}
      <div className="flex-1 min-w-0 mr-3">
        {/* Home team row */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <TeamCrest name={event.homeTeam} />
          <span className="text-[13px] text-[#C9D1D9] truncate leading-tight flex-1 min-w-0">
            {event.homeTeam}
          </span>
          <AnimatedScore
            score={homeScore}
            teamName={event.homeTeam}
            size="sm"
            className="!text-[13px] !font-bold text-white leading-tight w-5 text-right"
          />
        </div>

        {/* Away team row */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <TeamCrest name={event.awayTeam} />
          <span className="text-[13px] text-[#C9D1D9] truncate leading-tight flex-1 min-w-0">
            {event.awayTeam}
          </span>
          <AnimatedScore
            score={awayScore}
            teamName={event.awayTeam}
            size="sm"
            className="!text-[13px] !font-bold text-white leading-tight w-5 text-right"
          />
        </div>

        {/* Time display */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {isBreakStatus ? (
            <span className="text-[11px] font-medium text-yellow-400">{matchTime}</span>
          ) : isMinuteTime ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono font-medium text-[#8B949E]">{matchTime}</span>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#BFFF00] opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#BFFF00]" />
              </span>
            </div>
          ) : matchTime === 'LIVE' ? (
            <span className="text-[10px] font-bold text-[#238636] uppercase tracking-wide">Live</span>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono font-medium text-[#8B949E]">{matchTime}</span>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#BFFF00] opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#BFFF00]" />
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Odds columns */}
      <div className="flex gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
        {isSuspended ? (
          // All suspended
          <>
            {oddsColumns.map((_, i) => (
              <SuspendedOddsIcon key={i} />
            ))}
          </>
        ) : (
          <>
            {oddsColumns.map((sel, i) => {
              if (!sel) {
                return <SuspendedOddsIcon key={i} />;
              }
              const odds = typeof sel.odds === 'string' ? parseFloat(sel.odds) : sel.odds;
              const selSuspended = sel.status !== 'ACTIVE' || isNaN(odds) || odds <= 1;
              return (
                <LiveOddsButton
                  key={sel.id || `col-${i}`}
                  selectionId={sel.id}
                  eventId={event.id}
                  eventName={`${event.homeTeam} vs ${event.awayTeam}`}
                  sportId={event.sportSlug}
                  sportName={event.sport}
                  marketId={market?.id ?? ''}
                  marketName={market?.name ?? ''}
                  outcomeName={sel.name || sel.outcome}
                  label={isBasketball ? (i === 0 ? '1' : '2') : (['1', 'X', '2'][i])}
                  odds={odds}
                  startTime={event.startTime}
                  suspended={selSuspended}
                />
              );
            })}
          </>
        )}
        {/* More markets arrow */}
        <Link
          href={`/sports/${event.sportSlug}/${event.id}`}
          className="flex items-center justify-center w-6 h-8 text-[#484F58] hover:text-[#8B949E] opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sport Filter Icon (top horizontal bar)
// ---------------------------------------------------------------------------

function SportFilterIcon({
  slug,
  name,
  count,
  isActive,
  onClick,
}: {
  slug: string;
  name: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const config = SPORT_ICON_CONFIG[slug];
  const emoji = config?.emoji || '\uD83C\uDFC6';
  const color = config?.color || '#8B949E';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[56px] shrink-0',
        isActive
          ? 'bg-[#21262D]'
          : 'hover:bg-[#161B22]',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all duration-200',
          isActive
            ? 'ring-2 ring-offset-1 ring-offset-[#0D1117]'
            : 'opacity-60 hover:opacity-100',
        )}
        style={{
          backgroundColor: isActive ? `${color}22` : '#161B22',
          borderColor: isActive ? color : 'transparent',
          ...(isActive ? { boxShadow: `0 0 0 2px ${color}` } : {}),
        }}
      >
        <span className="leading-none">{emoji}</span>
      </div>
      <span
        className={cn(
          'text-[10px] font-medium leading-tight text-center whitespace-nowrap',
          isActive ? 'text-[#E6EDF3]' : 'text-[#8B949E]',
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          'text-[9px] font-mono leading-none',
          isActive ? 'text-[#BFFF00]' : 'text-[#484F58]',
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Live Betting Page
// ---------------------------------------------------------------------------

export default function LiveBettingPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCompetitions, setCollapsedCompetitions] = useState<Set<string>>(new Set());
  const [goalNotifications, setGoalNotifications] = useState<GoalNotification[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // Track previous scores for flash animation
  const prevScoresRef = useRef<Record<string, { home: number; away: number }>>({});
  const [flashingEvents, setFlashingEvents] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoExpandedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Score change detection
  // -------------------------------------------------------------------------
  const detectScoreChanges = useCallback((newEvents: LiveEvent[]) => {
    const prev = prevScoresRef.current;
    const newFlashing = new Set<string>();

    for (const event of newEvents) {
      const newHome = event.scores?.home ?? 0;
      const newAway = event.scores?.away ?? 0;
      const prevScore = prev[event.id];

      if (prevScore) {
        const homeScored = newHome > prevScore.home;
        const awayScored = newAway > prevScore.away;

        if (homeScored || awayScored) {
          newFlashing.add(event.id);

          const scoringTeam = homeScored ? event.homeTeam : event.awayTeam;
          const notifId = `${event.id}-${newHome}-${newAway}-${Date.now()}`;

          setGoalNotifications((prev) => [
            ...prev,
            {
              id: notifId,
              eventId: event.id,
              team: scoringTeam,
              score: `${newHome} - ${newAway}`,
              timestamp: Date.now(),
            },
          ]);

          setTimeout(() => {
            setGoalNotifications((prev) => prev.filter((n) => n.id !== notifId));
          }, 5000);
        }
      }

      prev[event.id] = { home: newHome, away: newAway };
    }

    if (newFlashing.size > 0) {
      setFlashingEvents((existing) => {
        const merged = new Set(existing);
        newFlashing.forEach((id) => merged.add(id));
        return merged;
      });

      setTimeout(() => {
        setFlashingEvents((existing) => {
          const next = new Set(existing);
          newFlashing.forEach((id) => next.delete(id));
          return next;
        });
      }, 1500);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Initial API fetch
  // -------------------------------------------------------------------------
  const fetchLiveEvents = useCallback(async () => {
    try {
      const data = await get<{ events: LiveEvent[] }>('/events?status=LIVE&limit=200');
      const liveEvents = (data.events || []).filter((e) => e.status === 'LIVE');
      detectScoreChanges(liveEvents);
      setEvents(liveEvents);
    } catch {
      try {
        const data = await get<{ events: LiveEvent[] }>('/events/live');
        const liveEvents = data.events || [];
        detectScoreChanges(liveEvents);
        setEvents(liveEvents);
      } catch {
        setEvents([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [detectScoreChanges]);

  // -------------------------------------------------------------------------
  // Socket.IO connection + event listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchLiveEvents();

    const socketUrl = getSocketUrl();
    const socket = ioClient(`${socketUrl}/live`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchLiveEvents();
        }, 30000);
      }
    });

    socket.on('connect_error', () => {
      setSocketConnected(false);
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchLiveEvents();
        }, 30000);
      }
    });

    // Full list update
    socket.on('live:update', (data: { events: LiveEvent[] }) => {
      if (data && Array.isArray(data.events)) {
        const liveEvents = data.events.filter((e) => e.status === 'LIVE');
        detectScoreChanges(liveEvents);
        setEvents(liveEvents);
        setIsLoading(false);
      }
    });

    // Goal notification
    socket.on(
      'live:goal',
      (data: {
        eventId: string;
        homeTeam: string;
        awayTeam: string;
        homeScore: number;
        awayScore: number;
        timer?: unknown;
        sportSlug?: string;
        competition?: string;
      }) => {
        if (!data || !data.eventId) return;

        const prev = prevScoresRef.current[data.eventId];
        let scoringTeam = data.homeTeam;
        if (prev) {
          if (data.awayScore > (prev.away ?? 0)) {
            scoringTeam = data.awayTeam;
          } else if (data.homeScore > (prev.home ?? 0)) {
            scoringTeam = data.homeTeam;
          }
        }

        prevScoresRef.current[data.eventId] = {
          home: data.homeScore,
          away: data.awayScore,
        };

        setFlashingEvents((existing) => {
          const next = new Set(existing);
          next.add(data.eventId);
          return next;
        });
        setTimeout(() => {
          setFlashingEvents((existing) => {
            const next = new Set(existing);
            next.delete(data.eventId);
            return next;
          });
        }, 1500);

        const notifId = `goal-${data.eventId}-${data.homeScore}-${data.awayScore}-${Date.now()}`;
        setGoalNotifications((prev) => [
          ...prev,
          {
            id: notifId,
            eventId: data.eventId,
            team: scoringTeam,
            score: `${data.homeScore} - ${data.awayScore}`,
            timestamp: Date.now(),
          },
        ]);

        setTimeout(() => {
          setGoalNotifications((prev) => prev.filter((n) => n.id !== notifId));
        }, 5000);

        setEvents((currentEvents) =>
          currentEvents.map((ev) => {
            if (ev.id === data.eventId) {
              return {
                ...ev,
                scores: { home: data.homeScore, away: data.awayScore },
              };
            }
            return ev;
          })
        );
      }
    );

    // Single event update
    socket.on('event:update', (data: LiveEvent) => {
      if (!data || !data.id) return;
      setEvents((currentEvents) => {
        const idx = currentEvents.findIndex((e) => e.id === data.id);
        if (idx >= 0) {
          const updated = [...currentEvents];
          const prevScore = prevScoresRef.current[data.id];
          const newHome = data.scores?.home ?? 0;
          const newAway = data.scores?.away ?? 0;
          if (prevScore && (newHome > prevScore.home || newAway > prevScore.away)) {
            setFlashingEvents((existing) => {
              const next = new Set(existing);
              next.add(data.id);
              return next;
            });
            setTimeout(() => {
              setFlashingEvents((existing) => {
                const next = new Set(existing);
                next.delete(data.id);
                return next;
              });
            }, 1500);
          }
          prevScoresRef.current[data.id] = { home: newHome, away: newAway };
          updated[idx] = data;
          return updated;
        }
        if (data.status === 'LIVE') {
          prevScoresRef.current[data.id] = {
            home: data.scores?.home ?? 0,
            away: data.scores?.away ?? 0,
          };
          return [...currentEvents, data];
        }
        return currentEvents;
      });
    });

    // Fallback polling
    const fallbackTimeout = setTimeout(() => {
      if (!socket.connected && !pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchLiveEvents();
        }, 30000);
      }
    }, 5000);

    return () => {
      clearTimeout(fallbackTimeout);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('live:update');
      socket.off('live:goal');
      socket.off('event:update');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Filter events
  // -------------------------------------------------------------------------
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedSport && e.sportSlug !== selectedSport) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (e.homeTeam || '').toLowerCase().includes(q) ||
          (e.awayTeam || '').toLowerCase().includes(q) ||
          (e.competition || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, selectedSport, searchQuery]);

  // -------------------------------------------------------------------------
  // Group events: by sport -> by competition
  // -------------------------------------------------------------------------
  const { groupedBySport, sportGroups } = useMemo(() => {
    const grouped: Record<string, Record<string, LiveEvent[]>> = {};
    for (const event of filteredEvents) {
      const sportKey = event.sportSlug || event.sport || 'other';
      if (!grouped[sportKey]) grouped[sportKey] = {};
      const compKey = event.competition || 'Other';
      if (!grouped[sportKey][compKey]) grouped[sportKey][compKey] = [];
      grouped[sportKey][compKey].push(event);
    }

    // Sport list with counts (from unfiltered events for sidebar counts)
    const sportCounts: Record<string, number> = {};
    for (const e of events) {
      const key = e.sportSlug || 'other';
      sportCounts[key] = (sportCounts[key] || 0) + 1;
    }
    const groups: SportGroup[] = [];
    for (const [slug, count] of Object.entries(sportCounts)) {
      const sample = events.find((e) => e.sportSlug === slug);
      groups.push({ slug, name: sample?.sport || slug, count });
    }
    groups.sort((a, b) => b.count - a.count);

    return { groupedBySport: grouped, sportGroups: groups };
  }, [filteredEvents, events]);

  // Auto-select first sport if none selected and events exist
  useEffect(() => {
    if (!hasAutoExpandedRef.current && sportGroups.length > 0 && selectedSport === null) {
      // Don't auto-select, show all by default (like Cloudbet)
      hasAutoExpandedRef.current = true;
    }
  }, [sportGroups, selectedSport]);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ================================================================= */}
      {/* Goal Notifications (fixed top-right)                              */}
      {/* ================================================================= */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {goalNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-[#161B22] border border-[#238636]/40 rounded-lg p-3 flex items-center gap-3 backdrop-blur-sm shadow-lg shadow-[#238636]/10 pointer-events-auto"
            >
              <div className="w-8 h-8 rounded-full bg-[#238636]/15 flex items-center justify-center shrink-0">
                <span className="text-base">{'\u26BD'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-[#238636] uppercase tracking-wider">GOAL!</span>
                </div>
                <span className="text-xs text-[#8B949E] truncate block">{notif.team} scored</span>
              </div>
              <span className="text-sm font-mono text-[#E6EDF3] font-bold whitespace-nowrap bg-[#0D1117] px-2.5 py-1 rounded-md">
                {notif.score}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ================================================================= */}
      {/* Sticky Header                                                     */}
      {/* ================================================================= */}
      <div className="sticky top-0 z-40 bg-[#0D1117] border-b border-[#21262D]">
        {/* Title bar */}
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-[#E6EDF3] tracking-tight flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#BFFF00]" />
                In-Play
              </h1>
              <span className="text-xs text-[#484F58] bg-[#161B22] px-2 py-0.5 rounded font-mono">
                {events.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative hidden sm:block w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484F58]" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-7 bg-[#161B22] border border-[#21262D] rounded-md pl-8 pr-3 text-xs text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-1 focus:ring-[#BFFF00]/30 focus:border-[#BFFF00]/30 transition-all"
                />
              </div>
              {/* Connection indicator */}
              <div className="flex items-center gap-1.5 shrink-0">
                {socketConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-[#238636]" />
                    <span className="text-[10px] text-[#238636] font-medium hidden sm:inline">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-[#484F58]" />
                    <span className="text-[10px] text-[#484F58] font-medium hidden sm:inline">Polling</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sport Filter Icons (horizontal scrollable) */}
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide px-2 pb-2">
            {/* All Sports */}
            <SportFilterIcon
              slug="all"
              name="All"
              count={events.length}
              isActive={selectedSport === null}
              onClick={() => setSelectedSport(null)}
            />
            {sportGroups.map((sport) => (
              <SportFilterIcon
                key={sport.slug}
                slug={sport.slug}
                name={sport.name}
                count={sport.count}
                isActive={selectedSport === sport.slug}
                onClick={() => setSelectedSport(sport.slug === selectedSport ? null : sport.slug)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Main Content                                                      */}
      {/* ================================================================= */}
      <div className="max-w-[1400px] mx-auto px-4 py-3">
        {/* Mobile Search (shown below header on small screens) */}
        <div className="sm:hidden mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#484F58]" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 bg-[#161B22] border border-[#21262D] rounded-md pl-8 pr-3 text-xs text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-1 focus:ring-[#BFFF00]/30 focus:border-[#BFFF00]/30 transition-all"
            />
          </div>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-[#0F1318]">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 skeleton rounded" />
                    <div className="h-3 w-28 skeleton rounded" />
                  </div>
                  <div className="h-3 w-3 skeleton rounded" />
                </div>
                <div className="px-4 py-1.5 bg-[#0D1117] border-b border-[#1C2128]/60 flex items-center">
                  <div className="h-2.5 w-24 skeleton rounded" />
                </div>
                <EventRowSkeleton />
                <EventRowSkeleton />
                <EventRowSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Render events grouped by sport, then by competition */}
            {Object.entries(groupedBySport).map(([sportSlug, competitions]) => {
              const isBasketball = sportSlug === 'basketball' || sportSlug === 'american-football';

              return (
                <div key={sportSlug} className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden">
                  {/* Render each competition as a collapsible section */}
                  {Object.entries(competitions).map(([compName, compEvents]) => (
                    <CompetitionSection
                      key={`${sportSlug}-${compName}`}
                      competitionName={compName}
                      events={compEvents}
                      sportSlug={sportSlug}
                      flashingEvents={flashingEvents}
                      isBasketball={isBasketball}
                    />
                  ))}
                </div>
              );
            })}

            {/* Empty state */}
            {filteredEvents.length === 0 && !isLoading && (
              <div className="bg-[#161B22] border border-[#21262D] rounded-lg py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-[#21262D] flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-7 h-7 text-[#484F58]" />
                </div>
                <p className="text-[#E6EDF3] text-base font-semibold">No live events right now</p>
                <p className="text-[#8B949E] text-sm mt-1.5">Check back soon for more live action</p>
                {selectedSport && (
                  <button
                    onClick={() => setSelectedSport(null)}
                    className="mt-4 px-4 py-2 text-xs font-medium text-[#BFFF00] bg-[#BFFF00]/10 rounded-md hover:bg-[#BFFF00]/20 transition-colors"
                  >
                    Show all sports
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
