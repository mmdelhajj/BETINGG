'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Star,
  Trophy,
  TrendingUp,
  Flame,
  Lock,
  BarChart3,
  Zap,
} from 'lucide-react';
import { cn, formatOdds } from '@/lib/utils';
import { get } from '@/lib/api';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { useSocketEvent } from '@/lib/socket';
import { AnimatedScore, LiveMatchClock, LiveIndicator } from '@/components/LiveScoreTicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string;
  name: string;
  slug?: string;
  country?: string;
  eventCount?: number;
  logo?: string | null;
  events: SportEvent[];
}

interface MarketSelection {
  id: string;
  name: string;
  outcome: string;
  odds: string | number;
  handicap?: string | null;
  params?: string | null;
  status: string;
}

interface Market {
  id: string;
  name: string;
  type: string;
  selections: MarketSelection[];
}

interface SportEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeTeamCountry?: string | null;
  awayTeamCountry?: string | null;
  competitionCountry?: string | null;
  startTime: string;
  status: string;
  isLive?: boolean;
  score?: { home: number; away: number };
  scores?: { home?: number; away?: number } | null;
  metadata?: {
    elapsed?: number | null;
    statusShort?: string;
    statusLong?: string;
    round?: string;
    [key: string]: unknown;
  } | null;
  mainMarket?: Market | null;
  spreadMarket?: Market | null;
  totalMarket?: Market | null;
  time?: string | null;
  period?: string | null;
}

type ViewMode = 'today' | 'tomorrow' | 'result' | 'competitions' | 'outrights' | 'pulse';

// ---------------------------------------------------------------------------
// Outright Types
// ---------------------------------------------------------------------------

interface OutrightSelection {
  id: string;
  name: string;
  outcome: string;
  odds: string;
}

interface OutrightMarket {
  id: string;
  name: string;
  marketKey: string;
  eventId: string;
  eventName: string;
  selections: OutrightSelection[];
}

interface OutrightCompetition {
  competition: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
    logo: string | null;
  };
  markets: OutrightMarket[];
}

// ---------------------------------------------------------------------------
// Pulse Types
// ---------------------------------------------------------------------------

interface TopEarner {
  rank: number;
  username: string;
  totalWon: string;
  totalBets: number;
  wonBets: number;
  winRate: string;
  vipTier: string;
}

interface TrendingBet {
  id: string;
  username: string;
  eventName: string;
  selection: string;
  odds: string;
  stake: string;
  winAmount: string;
  currency: string;
  isParlay: boolean;
  legCount: number;
  sport: string;
  sportSlug: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countryToFlag(code?: string): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  const offset = 0x1f1e6;
  const a = 'A'.charCodeAt(0);
  return (
    String.fromCodePoint(upper.charCodeAt(0) - a + offset) +
    String.fromCodePoint(upper.charCodeAt(1) - a + offset)
  );
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isOnDay(dateStr: string, day: Date): boolean {
  const d = new Date(dateStr);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

function sportLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Sports that display 3 columns: Spread | Total | MoneyLine (or Handicap | Total | Winner) */
const MULTI_MARKET_SPORTS = new Set([
  'basketball', 'ice-hockey', 'american-football', 'baseball',
  'handball', 'rugby', 'rugby-league',
]);

function isMultiMarketSport(slug: string): boolean {
  return MULTI_MARKET_SPORTS.has(slug);
}

function getMarketLabel(sport: string): string {
  if (isMultiMarketSport(sport)) {
    // For multi-market sports the label is not shown in the same way;
    // the column headers serve as the labels instead.
    return sport === 'ice-hockey' ? 'Markets' : 'Markets';
  }
  switch (sport) {
    case 'football':
    case 'futsal':
      return 'Full Time Result';
    case 'tennis':
    case 'table-tennis':
    case 'badminton':
    case 'volleyball':
    case 'beach-volleyball':
      return 'Match Winner';
    case 'mma':
    case 'boxing':
      return 'Fight Winner';
    case 'cricket':
    case 'darts':
    case 'snooker':
    case 'esports':
      return 'Match Winner';
    default:
      return 'Full Time Result';
  }
}

function getOddsLabels(sport: string, selections: number): string[] {
  if (isMultiMarketSport(sport)) {
    if (sport === 'ice-hockey') {
      return ['Handicap', 'Total', 'Winner'];
    }
    return ['Spread', 'Total', 'Money Line'];
  }
  if (selections === 3) return ['1', 'X', '2'];
  if (selections === 2) return ['1', '2'];
  return ['1', 'X', '2'];
}

// ---------------------------------------------------------------------------
// Sport icon color mapping
// ---------------------------------------------------------------------------

const SPORT_ICON_COLORS: Record<string, string> = {
  football: '#10B981',
  basketball: '#F97316',
  tennis: '#EAB308',
  'ice-hockey': '#06B6D4',
  baseball: '#EF4444',
  'american-football': '#8B5CF6',
  cricket: '#22C55E',
  rugby: '#F43F5E',
  volleyball: '#3B82F6',
  handball: '#EC4899',
  boxing: '#EF4444',
  mma: '#EF4444',
  esports: '#8B5CF6',
  darts: '#F59E0B',
  snooker: '#10B981',
  'table-tennis': '#06B6D4',
};

// ---------------------------------------------------------------------------
// Match Time Display
// ---------------------------------------------------------------------------

function getMatchTimeDisplay(event: SportEvent, sportSlug: string): string {
  // Prefer pre-computed time from backend API (works for Cloudbet + BetsAPI)
  if (event.time) return event.time;

  const meta = event.metadata as Record<string, any> | null;
  if (!meta) return 'LIVE';

  const statusShort = meta.statusShort || '';
  const elapsed = meta.elapsed;

  if (sportSlug === 'football') {
    if (statusShort === 'HT') return 'HT';
    if (statusShort === 'FT') return 'FT';
    if (statusShort === 'ET') return elapsed ? `ET ${elapsed}'` : 'ET';
    if (statusShort === 'P') return 'PEN';
    if (elapsed) return `${elapsed}'`;
    if (statusShort === '1H') return '1H';
    if (statusShort === '2H') return '2H';
    return 'LIVE';
  }

  if (sportSlug === 'basketball') {
    const timer = meta.timer;
    const tm = timer?.tm != null ? parseInt(String(timer.tm), 10) : null;
    const ts = timer?.ts != null ? parseInt(String(timer.ts), 10) : null;
    const clock = tm != null && ts != null ? `${tm}:${String(ts).padStart(2, '0')}` : (tm != null ? `${tm}:00` : '');
    switch (statusShort) {
      case 'Q1': return clock ? `Q1 ${clock}` : 'Q1';
      case 'Q2': return clock ? `Q2 ${clock}` : 'Q2';
      case 'Q3': return clock ? `Q3 ${clock}` : 'Q3';
      case 'Q4': return clock ? `Q4 ${clock}` : 'Q4';
      case 'OT': return clock ? `OT ${clock}` : 'OT';
      case 'BT': return 'Break';
      case 'HT': return 'HT';
    }
    return statusShort || 'LIVE';
  }

  if (sportSlug === 'ice-hockey') {
    const timer = meta.timer;
    const tm = timer?.tm != null ? parseInt(String(timer.tm), 10) : null;
    const ts = timer?.ts != null ? parseInt(String(timer.ts), 10) : null;
    const clock = tm != null && ts != null ? `${tm}:${String(ts).padStart(2, '0')}` : (tm != null ? `${tm}:00` : '');
    switch (statusShort) {
      case 'P1': return clock ? `P1 ${clock}` : '1st';
      case 'P2': return clock ? `P2 ${clock}` : '2nd';
      case 'P3': return clock ? `P3 ${clock}` : '3rd';
      case 'OT': return clock ? `OT ${clock}` : 'OT';
      case 'BT': return 'Break';
    }
    return statusShort || 'LIVE';
  }

  if (sportSlug === 'handball') {
    if (statusShort === '1H') return elapsed ? `1H ${elapsed}'` : '1H';
    if (statusShort === '2H') return elapsed ? `2H ${elapsed}'` : '2H';
    if (statusShort === 'HT') return 'HT';
    return statusShort || 'LIVE';
  }

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

  if (sportSlug === 'rugby') {
    if (statusShort === '1H') return elapsed ? `1H ${elapsed}'` : '1H';
    if (statusShort === '2H') return elapsed ? `2H ${elapsed}'` : '2H';
    if (statusShort === 'HT') return 'HT';
    return statusShort || 'LIVE';
  }

  if (elapsed) return `${elapsed}'`;
  if (statusShort && statusShort !== 'NS') return statusShort;
  return 'LIVE';
}

// ---------------------------------------------------------------------------
// Individual Sports
// ---------------------------------------------------------------------------

const INDIVIDUAL_SPORTS = new Set([
  'tennis', 'table-tennis', 'badminton', 'boxing', 'mma',
  'darts', 'snooker', 'cycling', 'golf', 'athletics',
]);

const SPORT_EMOJIS: Record<string, string> = {
  'horse-racing': '\uD83C\uDFC7',
  'greyhounds': '\uD83D\uDC15',
};

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

/** Team/Player icon with fallback chain */
function TeamIcon({
  name,
  logo,
  country,
  sportSlug,
  className = 'w-5 h-5',
}: {
  name: string;
  logo?: string | null;
  country?: string | null;
  sportSlug: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (logo && !imgError) {
    return (
      <img
        src={logo}
        alt=""
        className={cn(className, 'object-contain shrink-0 rounded-sm')}
        onError={() => setImgError(true)}
      />
    );
  }

  if (INDIVIDUAL_SPORTS.has(sportSlug) && country) {
    const flag = countryToFlag(country);
    if (flag) {
      return (
        <span
          className={cn(className, 'flex items-center justify-center shrink-0 text-sm leading-none')}
          title={country.toUpperCase()}
        >
          {flag}
        </span>
      );
    }
  }

  if (SPORT_EMOJIS[sportSlug]) {
    return (
      <span className={cn(className, 'flex items-center justify-center shrink-0 text-sm leading-none')}>
        {SPORT_EMOJIS[sportSlug]}
      </span>
    );
  }

  const letter = (name || '?').charAt(0).toUpperCase();
  const bgColor = getAvatarColor(name || '');

  return (
    <div
      className={cn(className, 'rounded-sm shrink-0 flex items-center justify-center')}
      style={{ backgroundColor: bgColor }}
    >
      <span className="text-[10px] font-bold text-white leading-none">
        {letter}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function CompetitionTabsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden px-4 py-3">
      {[82, 68, 95, 74, 88, 71].map((w, i) => (
        <div
          key={i}
          className="h-8 skeleton rounded-full shrink-0"
          style={{ width: `${w}px` }}
        />
      ))}
    </div>
  );
}

function EventRowSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-[#30363D]/30 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 skeleton rounded-sm shrink-0" />
            <div className="h-4 skeleton rounded" style={{ width: '120px' }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 skeleton rounded-sm shrink-0" />
            <div className="h-4 skeleton rounded" style={{ width: '100px' }} />
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <div className="h-10 w-[60px] skeleton rounded-md" />
          <div className="h-10 w-[60px] skeleton rounded-md" />
          <div className="h-10 w-[60px] skeleton rounded-md" />
        </div>
      </div>
      <div className="mt-1.5 ml-7">
        <div className="h-3 w-24 skeleton rounded" />
      </div>
    </div>
  );
}

function CompetitionBlockSkeleton() {
  return (
    <div className="bg-[#161B22] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363D]/50">
        <div className="h-4 w-6 skeleton rounded" />
        <div className="h-4 w-40 skeleton rounded" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <EventRowSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OddsButton — Cloudbet style with green/yellow text
// ---------------------------------------------------------------------------

/** Empty/disabled odds cell placeholder */
function EmptyOddsCell({ wide }: { wide?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center h-10 rounded-md bg-[#1C2128]/80',
        wide ? 'w-[88px] lg:w-[96px]' : 'w-[60px] lg:w-[68px]'
      )}
    >
      <Lock className="w-3.5 h-3.5 text-[#484F58]" />
    </div>
  );
}

function OddsButton({
  selectionId,
  eventId,
  eventName,
  sportId,
  sportName,
  marketId,
  marketName,
  outcomeName,
  odds,
  startTime,
  isLive,
  disabled,
  lineLabel,
  wide,
}: {
  selectionId?: string;
  eventId: string;
  eventName: string;
  sportId: string;
  sportName: string;
  marketId: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  startTime: string;
  isLive: boolean;
  label?: string;
  disabled?: boolean;
  /** Optional line value displayed above odds (e.g. "-7.5", "O 225.5") */
  lineLabel?: string;
  /** Use wider button (for spread/total columns) */
  wide?: boolean;
}) {
  const { addSelection, hasSelection } = useBetSlipStore();
  const isSelected = hasSelection(eventId, marketId, outcomeName);

  const widthClass = wide
    ? 'w-[88px] lg:w-[96px]'
    : 'w-[60px] lg:w-[68px]';

  if (odds <= 1 || disabled) {
    return (
      <div className={cn('flex items-center justify-center h-10 rounded-md bg-[#1C2128]/80', widthClass)}>
        {disabled && odds > 1 ? (
          <Lock className="w-3.5 h-3.5 text-[#484F58]" />
        ) : (
          <span className="text-xs text-[#484F58] font-mono">-</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addSelection({
          id: selectionId || `${eventId}-${marketId}-${outcomeName}`,
          eventId,
          eventName,
          marketId,
          marketName,
          outcomeName,
          odds,
          sportId,
          sportName,
          startTime,
          isLive,
        });
      }}
      className={cn(
        'flex flex-col items-center justify-center h-10 rounded-md font-mono font-semibold transition-all duration-200',
        widthClass,
        isSelected
          ? 'bg-[#F59E0B]/15 border border-[#F59E0B] text-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.15)]'
          : 'bg-[#1C2128] border border-transparent text-[#10B981] hover:bg-[#1C2128]/80 hover:border-[#30363D] active:scale-95'
      )}
    >
      {lineLabel ? (
        <>
          <span className={cn(
            'text-[10px] leading-tight',
            isSelected ? 'text-[#F59E0B]/70' : 'text-[#8B949E]'
          )}>
            {lineLabel}
          </span>
          <span className="text-[13px] leading-tight">{formatOdds(odds)}</span>
        </>
      ) : (
        <span className="text-sm">{formatOdds(odds)}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helper: pick selection for a specific team from a market
// ---------------------------------------------------------------------------

/**
 * For multi-market sports, find the home/away selection from a market.
 * index 0 = home team selection, index 1 = away team selection.
 */
function getSelectionByIndex(market: Market | null | undefined, index: 0 | 1): MarketSelection | null {
  if (!market || !market.selections || market.selections.length < 2) return null;
  return market.selections[index] ?? null;
}

function parseOdds(odds: string | number): number {
  return typeof odds === 'string' ? parseFloat(odds) : odds;
}

// ---------------------------------------------------------------------------
// MultiMarketEventRow — Two-row layout for Basketball, Ice Hockey, etc.
// ---------------------------------------------------------------------------

function MultiMarketEventRow({
  event,
  slug,
  sportName,
}: {
  event: SportEvent;
  slug: string;
  sportName: string;
}) {
  const isLive = event.isLive || event.status?.toLowerCase() === 'live';
  const isFinished =
    event.status?.toLowerCase() === 'ended' ||
    event.status?.toLowerCase() === 'finished';

  const eventScores = event.scores as
    | { home?: number; away?: number }
    | null
    | undefined;
  const score =
    event.score ||
    (eventScores
      ? { home: eventScores.home ?? 0, away: eventScores.away ?? 0 }
      : undefined);

  const eventName = `${event.homeTeam} vs ${event.awayTeam}`;

  // Markets
  const spreadMkt = event.spreadMarket;
  const totalMkt = event.totalMarket;
  const mlMkt = event.mainMarket;

  // Selections for home (index 0) and away (index 1)
  const homeSpread = getSelectionByIndex(spreadMkt, 0);
  const awaySpread = getSelectionByIndex(spreadMkt, 1);

  // Total: first selection is Over, second is Under
  const overTotal = getSelectionByIndex(totalMkt, 0);
  const underTotal = getSelectionByIndex(totalMkt, 1);

  const homeMl = getSelectionByIndex(mlMkt, 0);
  const awayMl = getSelectionByIndex(mlMkt, 1);

  // Build spread line labels (backend already includes +/- sign)
  const homeSpreadLabel = homeSpread?.handicap ?? null;
  const awaySpreadLabel = awaySpread?.handicap ?? null;

  // Build total line labels
  const overLine = overTotal?.handicap ?? null;
  const underLine = underTotal?.handicap ?? null;
  const overLabel = overLine ? `O ${overLine}` : null;
  const underLabel = underLine ? `U ${underLine}` : null;

  // Derive period for LiveMatchClock from metadata
  const meta = event.metadata as Record<string, any> | null;
  const derivedPeriod = event.period || meta?.statusShort || '1H';
  // Use raw BetsAPI timer (tm=minutes, ts=seconds) — NOT calculated elapsed
  const derivedTimer = meta?.timer?.tm ?? null;
  const derivedTimerSeconds = meta?.timer?.ts != null ? parseInt(String(meta.timer.ts), 10) : null;

  // Build time display
  const getTimeLabel = () => {
    if (isLive) {
      return (
        <span className="flex items-center gap-1.5 text-[11px]">
          <LiveIndicator size="xs" />
          <LiveMatchClock
            startTime={event.startTime}
            period={derivedPeriod}
            timer={derivedTimer}
            timerSeconds={derivedTimerSeconds}
            sportSlug={slug}
            size="sm"
          />
        </span>
      );
    }
    if (isFinished) {
      return (
        <span className="text-[11px] text-[#8B949E] font-medium">FT</span>
      );
    }
    const d = new Date(event.startTime);
    const now = new Date();
    const isTodayMatch = d.toDateString() === now.toDateString();
    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const isTomorrowMatch = d.toDateString() === tmrw.toDateString();

    const timeStr = formatTime(event.startTime);
    const prefix = isTodayMatch ? 'Today' : isTomorrowMatch ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return (
      <span className="text-[11px] text-[#8B949E]">
        {prefix} <span className="text-[#484F58] mx-0.5">&bull;</span> {timeStr}
      </span>
    );
  };

  /** Render an odds cell for a specific market column */
  const renderOddsCell = (
    sel: MarketSelection | null,
    market: Market | null | undefined,
    lineLabel: string | null,
    wide: boolean = true,
  ) => {
    if (!sel || !market) {
      return <EmptyOddsCell wide={wide} />;
    }
    const oddsVal = parseOdds(sel.odds);
    return (
      <OddsButton
        selectionId={sel.id}
        eventId={event.id}
        eventName={eventName}
        sportId={slug}
        sportName={sportName}
        marketId={market.id}
        marketName={market.name}
        outcomeName={sel.name || sel.outcome}
        odds={oddsVal}
        startTime={event.startTime}
        isLive={!!isLive}
        disabled={isFinished}
        lineLabel={lineLabel ?? undefined}
        wide={wide}
      />
    );
  };

  return (
    <Link
      href={`/sports/${slug}/${event.id}`}
      className="group block px-4 py-2.5 border-b border-[#30363D]/30 last:border-0 hover:bg-[#1C2128]/40 transition-colors"
    >
      {/* Home team row */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <TeamIcon
            name={event.homeTeam}
            logo={event.homeTeamLogo}
            country={event.homeTeamCountry || event.competitionCountry}
            sportSlug={slug}
            className="w-5 h-5"
          />
          <span
            className={cn(
              'text-sm truncate flex-1',
              isLive ? 'text-[#E6EDF3] font-medium' : 'text-[#C9D1D9]'
            )}
          >
            {event.homeTeam}
          </span>
          {(isLive || isFinished) && score !== undefined && (
            isLive ? (
              <AnimatedScore score={score.home} teamName={event.homeTeam} size="sm" className="w-6 text-center shrink-0 !text-lg" />
            ) : (
              <span className="text-sm font-mono font-bold w-6 text-center shrink-0 text-[#8B949E]">
                {score.home}
              </span>
            )
          )}
        </div>

        {/* Odds: Spread | Total | ML for home team */}
        <div
          className={cn('flex gap-1.5 shrink-0', isFinished && 'opacity-40')}
          onClick={(e) => e.preventDefault()}
        >
          {renderOddsCell(homeSpread, spreadMkt, homeSpreadLabel)}
          {renderOddsCell(overTotal, totalMkt, overLabel)}
          {renderOddsCell(homeMl, mlMkt, null, false)}
        </div>
      </div>

      {/* Away team row */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <TeamIcon
            name={event.awayTeam}
            logo={event.awayTeamLogo}
            country={event.awayTeamCountry || event.competitionCountry}
            sportSlug={slug}
            className="w-5 h-5"
          />
          <span
            className={cn(
              'text-sm truncate flex-1',
              isLive ? 'text-[#E6EDF3] font-medium' : 'text-[#C9D1D9]'
            )}
          >
            {event.awayTeam}
          </span>
          {(isLive || isFinished) && score !== undefined && (
            isLive ? (
              <AnimatedScore score={score.away} teamName={event.awayTeam} size="sm" className="w-6 text-center shrink-0 !text-lg" />
            ) : (
              <span className="text-sm font-mono font-bold w-6 text-center shrink-0 text-[#8B949E]">
                {score.away}
              </span>
            )
          )}
        </div>

        {/* Odds: Spread | Total | ML for away team */}
        <div
          className={cn('flex gap-1.5 shrink-0', isFinished && 'opacity-40')}
          onClick={(e) => e.preventDefault()}
        >
          {renderOddsCell(awaySpread, spreadMkt, awaySpreadLabel)}
          {renderOddsCell(underTotal, totalMkt, underLabel)}
          {renderOddsCell(awayMl, mlMkt, null, false)}
        </div>
      </div>

      {/* Time info row below */}
      <div className="mt-1.5 ml-7 flex items-center gap-2">
        {getTimeLabel()}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// EventRow — Standard layout for football (3-way), tennis (2-way), etc.
// ---------------------------------------------------------------------------

function EventRow({
  event,
  slug,
  sportName,
}: {
  event: SportEvent;
  slug: string;
  sportName: string;
}) {
  const isLive = event.isLive || event.status?.toLowerCase() === 'live';
  const isFinished =
    event.status?.toLowerCase() === 'ended' ||
    event.status?.toLowerCase() === 'finished';

  const eventScores = event.scores as
    | { home?: number; away?: number }
    | null
    | undefined;
  const score =
    event.score ||
    (eventScores
      ? { home: eventScores.home ?? 0, away: eventScores.away ?? 0 }
      : undefined);

  const market = event.mainMarket;
  const selections = market?.selections ?? [];

  // Derive period for LiveMatchClock from metadata
  const metaEr = event.metadata as Record<string, any> | null;
  const derivedPeriod = event.period || metaEr?.statusShort || '1H';
  // Use raw BetsAPI timer (tm=minutes, ts=seconds) — NOT calculated elapsed
  const derivedTimer = metaEr?.timer?.tm ?? null;
  const derivedTimerSeconds = metaEr?.timer?.ts != null ? parseInt(String(metaEr.timer.ts), 10) : null;

  // Build time display for below the teams
  const getTimeLabel = () => {
    if (isLive) {
      return (
        <span className="flex items-center gap-1.5 text-[11px]">
          <LiveIndicator size="xs" />
          <LiveMatchClock
            startTime={event.startTime}
            period={derivedPeriod}
            timer={derivedTimer}
            timerSeconds={derivedTimerSeconds}
            sportSlug={slug}
            size="sm"
          />
        </span>
      );
    }
    if (isFinished) {
      return (
        <span className="text-[11px] text-[#8B949E] font-medium">FT</span>
      );
    }
    const d = new Date(event.startTime);
    const now = new Date();
    const isTodayMatch = d.toDateString() === now.toDateString();
    const tmrw = new Date(now);
    tmrw.setDate(tmrw.getDate() + 1);
    const isTomorrowMatch = d.toDateString() === tmrw.toDateString();

    const timeStr = formatTime(event.startTime);
    const prefix = isTodayMatch ? 'Today' : isTomorrowMatch ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return (
      <span className="text-[11px] text-[#8B949E]">
        {prefix} <span className="text-[#484F58] mx-0.5">&bull;</span> {timeStr}
      </span>
    );
  };

  return (
    <Link
      href={`/sports/${slug}/${event.id}`}
      className="group block px-4 py-3 border-b border-[#30363D]/30 last:border-0 hover:bg-[#1C2128]/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Left: Teams stacked vertically + scores */}
        <div className="flex-1 min-w-0">
          {/* Home team row */}
          <div className="flex items-center gap-2 mb-1.5">
            <TeamIcon
              name={event.homeTeam}
              logo={event.homeTeamLogo}
              country={event.homeTeamCountry || event.competitionCountry}
              sportSlug={slug}
              className="w-5 h-5"
            />
            <span
              className={cn(
                'text-sm truncate flex-1',
                isLive ? 'text-[#E6EDF3] font-medium' : 'text-[#C9D1D9]'
              )}
            >
              {event.homeTeam}
            </span>
            {/* Home score */}
            {(isLive || isFinished) && score !== undefined && (
              isLive ? (
                <AnimatedScore score={score.home} teamName={event.homeTeam} size="sm" className="w-6 text-center shrink-0 !text-lg" />
              ) : (
                <span className="text-sm font-mono font-bold w-6 text-center shrink-0 text-[#8B949E]">
                  {score.home}
                </span>
              )
            )}
          </div>

          {/* Away team row */}
          <div className="flex items-center gap-2">
            <TeamIcon
              name={event.awayTeam}
              logo={event.awayTeamLogo}
              country={event.awayTeamCountry || event.competitionCountry}
              sportSlug={slug}
              className="w-5 h-5"
            />
            <span
              className={cn(
                'text-sm truncate flex-1',
                isLive ? 'text-[#E6EDF3] font-medium' : 'text-[#C9D1D9]'
              )}
            >
              {event.awayTeam}
            </span>
            {/* Away score */}
            {(isLive || isFinished) && score !== undefined && (
              isLive ? (
                <AnimatedScore score={score.away} teamName={event.awayTeam} size="sm" className="w-6 text-center shrink-0 !text-lg" />
              ) : (
                <span className="text-sm font-mono font-bold w-6 text-center shrink-0 text-[#8B949E]">
                  {score.away}
                </span>
              )
            )}
          </div>
        </div>

        {/* Right: Odds buttons */}
        <div
          className={cn('flex gap-1.5 shrink-0', isFinished && 'opacity-40')}
          onClick={(e) => e.preventDefault()}
        >
          {selections.length > 0 ? (
            selections.map((sel) => (
              <OddsButton
                key={sel.id || sel.outcome}
                selectionId={sel.id}
                eventId={event.id}
                eventName={`${event.homeTeam} vs ${event.awayTeam}`}
                sportId={slug}
                sportName={sportName}
                marketId={market?.id ?? ''}
                marketName={market?.name ?? ''}
                outcomeName={sel.name || sel.outcome}
                odds={parseOdds(sel.odds)}
                startTime={event.startTime}
                isLive={!!isLive}
                disabled={isFinished}
              />
            ))
          ) : (
            <span className="text-[11px] text-[#484F58] italic px-2 self-center">
              {isFinished ? 'Ended' : 'No odds'}
            </span>
          )}
        </div>
      </div>

      {/* Time info row below */}
      <div className="mt-1.5 ml-7 flex items-center gap-2">
        {getTimeLabel()}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// CompetitionBlock — Cloudbet grouped layout with collapsible header
// ---------------------------------------------------------------------------

function CompetitionBlock({
  competition,
  events,
  slug,
  sportName,
  marketLabel,
  defaultExpanded = true,
}: {
  competition: Competition;
  events: SportEvent[];
  slug: string;
  sportName: string;
  marketLabel: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const flag = countryToFlag(competition.country);
  const multiMarket = isMultiMarketSport(slug);

  // Determine odds column labels from first event with selections
  const firstWithSelections = events.find(
    (e) => e.mainMarket && e.mainMarket.selections.length > 0
  );
  const selectionCount = firstWithSelections?.mainMarket?.selections.length ?? 3;
  const oddsLabels = getOddsLabels(slug, selectionCount);

  return (
    <div className="bg-[#161B22] rounded-lg overflow-hidden">
      {/* Competition header row -- clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1C2128]/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {flag && <span className="text-base shrink-0">{flag}</span>}
          {competition.logo && (
            <img
              src={competition.logo}
              alt=""
              className="w-4 h-4 object-contain shrink-0"
            />
          )}
          <span className="text-[13px] font-semibold text-[#E6EDF3] truncate">
            {competition.name}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#8B949E] shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#8B949E] shrink-0" />
        )}
      </button>

      {expanded && (
        <>
          {/* Market label + odds column headers */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-[#30363D]/30">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3 text-[#484F58]" />
              <span className="text-[10px] text-[#484F58] font-medium uppercase tracking-wider">
                {marketLabel}
              </span>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {oddsLabels.map((label) => {
                // Spread/Total columns are wider, ML/Winner column is standard width
                const isWideColumn = multiMarket && (
                  label === 'Spread' || label === 'Total' || label === 'Handicap'
                );
                return (
                  <div
                    key={label}
                    className={cn(
                      'text-center',
                      isWideColumn
                        ? 'w-[88px] lg:w-[96px]'
                        : 'w-[60px] lg:w-[68px]'
                    )}
                  >
                    <span className="text-[10px] font-bold text-[#8B949E]">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event rows */}
          <div className="border-t border-[#30363D]/30">
            {events.map((event) =>
              multiMarket ? (
                <MultiMarketEventRow
                  key={event.id}
                  event={event}
                  slug={slug}
                  sportName={sportName}
                />
              ) : (
                <EventRow
                  key={event.id}
                  event={event}
                  slug={slug}
                  sportName={sportName}
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pulse Promotional Banner
// ---------------------------------------------------------------------------

function PulseBanner({ slug, sportName }: { slug: string; sportName: string }) {
  return (
    <Link
      href={`/sports/${slug}?view=pulse`}
      className="block rounded-lg overflow-hidden bg-gradient-to-r from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] p-4 hover:opacity-90 transition-opacity"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
              CryptoBet Pulse
            </span>
          </div>
          <p className="text-sm font-bold text-white">
            {sportName.toUpperCase()} &mdash; SEE WHO&apos;S WINNING
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Competitions Browse View
// ---------------------------------------------------------------------------

function CompetitionsBrowseView({
  competitions,
  slug,
}: {
  competitions: Competition[];
  slug: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Competition[]>();
    for (const comp of competitions) {
      const country = comp.country || 'International';
      if (!map.has(country)) map.set(country, []);
      map.get(country)!.push(comp);
    }
    return [...map.entries()]
      .map(([country, comps]) => ({
        country,
        flag: countryToFlag(country),
        competitions: comps.sort(
          (a, b) =>
            (b.eventCount ?? b.events.length) -
            (a.eventCount ?? a.events.length)
        ),
        totalEvents: comps.reduce(
          (sum, c) => sum + (c.eventCount ?? c.events.length),
          0
        ),
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents);
  }, [competitions]);

  return (
    <div className="space-y-2">
      {grouped.map(({ country, flag, competitions: comps, totalEvents }) => (
        <div
          key={country}
          className="bg-[#161B22] rounded-lg overflow-hidden"
        >
          {/* Country header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363D]/30">
            {flag && <span className="text-base">{flag}</span>}
            <span className="text-[13px] font-semibold text-[#E6EDF3] uppercase tracking-wide">
              {country.length === 2 ? country.toUpperCase() : country}
            </span>
            <span className="text-[11px] text-[#484F58] ml-auto">
              {totalEvents}
            </span>
          </div>

          {/* Competition links */}
          <div className="divide-y divide-[#30363D]/20">
            {comps.map((comp) => (
              <Link
                key={comp.id}
                href={`/sports/${slug}?competition=${comp.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[#1C2128]/40 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {comp.logo && (
                    <img
                      src={comp.logo}
                      alt=""
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  )}
                  <span className="text-sm text-[#C9D1D9] group-hover:text-[#E6EDF3] truncate transition-colors">
                    {comp.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#484F58] font-mono">
                    {comp.eventCount ?? comp.events.length}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#30363D] group-hover:text-[#8B949E] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {grouped.length === 0 && (
        <div className="bg-[#161B22] rounded-lg p-12 text-center">
          <p className="text-[#8B949E] text-sm">No competitions found</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InPlayView — Live matches
// ---------------------------------------------------------------------------

function InPlayView({
  slug,
  sportName,
  marketLabel,
}: {
  slug: string;
  sportName: string;
  marketLabel: string;
}) {
  const [liveEvents, setLiveEvents] = useState<
    { competition: Competition; events: SportEvent[] }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchLive() {
      setIsLoading(true);
      try {
        const data = await get<{ competitions: Competition[] }>(
          `/sports/${slug}/competitions`
        );
        if (cancelled) return;
        const comps = (data.competitions || []).map((c) => ({
          ...c,
          events: (c.events || []).filter(
            (e) => e.isLive || e.status?.toLowerCase() === 'live'
          ),
        }));
        setLiveEvents(
          comps
            .filter((c) => c.events.length > 0)
            .map((c) => ({ competition: c, events: c.events }))
        );
      } catch {
        if (!cancelled) setLiveEvents([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchLive();
    const interval = setInterval(fetchLive, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  const totalLive = liveEvents.reduce((sum, g) => sum + g.events.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <CompetitionBlockSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (totalLive === 0) {
    return (
      <div className="bg-[#161B22] rounded-lg p-12 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1C2128] flex items-center justify-center">
          <span className="w-3 h-3 rounded-full bg-[#30363D]" />
        </div>
        <p className="text-[#8B949E] text-sm mb-1">No live events right now</p>
        <p className="text-[#484F58] text-xs">
          Live {sportName.toLowerCase()} matches will appear here when they start.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Live count banner */}
      <div className="flex items-center gap-2 px-1">
        <LiveIndicator size="sm" />
        <span className="text-sm font-medium text-[#E6EDF3]">
          {totalLive} live {totalLive === 1 ? 'match' : 'matches'}
        </span>
        <span className="text-[10px] text-[#484F58]">Auto-refreshing</span>
      </div>

      {liveEvents.map(({ competition, events }) => (
        <CompetitionBlock
          key={competition.id}
          competition={competition}
          events={events}
          slug={slug}
          sportName={sportName}
          marketLabel={marketLabel}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OutrightsView
// ---------------------------------------------------------------------------

function OutrightsView({ slug }: { slug: string }) {
  const [data, setData] = useState<OutrightCompetition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addSelection, hasSelection } = useBetSlipStore();

  useEffect(() => {
    let cancelled = false;
    async function fetchOutrights() {
      setIsLoading(true);
      try {
        const res = await get<{
          sport: { id: string; name: string };
          competitions: OutrightCompetition[];
        }>(`/sports/${slug}/outrights`);
        if (!cancelled) setData(res.competitions || []);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchOutrights();
    return () => { cancelled = true; };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[#161B22] rounded-lg p-4">
            <div className="h-5 w-48 skeleton rounded mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-32 skeleton rounded" />
                  <div className="h-4 w-16 skeleton rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-[#161B22] rounded-lg p-12 text-center">
        <TrendingUp className="w-8 h-8 text-[#30363D] mx-auto mb-3" />
        <p className="text-[#8B949E] text-sm">No outright markets available for this sport</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map(({ competition, markets }) => (
        <div key={competition.id} className="bg-[#161B22] rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363D]/30">
            {competition.country && (
              <span className="text-base">{countryToFlag(competition.country)}</span>
            )}
            {competition.logo && (
              <img src={competition.logo} alt="" className="w-4 h-4 object-contain" />
            )}
            <span className="text-[13px] font-semibold text-[#E6EDF3]">
              {competition.name}
            </span>
          </div>

          {markets.map((market) => (
            <div key={market.id} className="border-b border-[#30363D]/20 last:border-0">
              <div className="px-4 py-2 bg-[#0D1117]/40">
                <span className="text-[10px] font-medium text-[#8B949E] uppercase tracking-wider">
                  {market.name}
                </span>
              </div>

              <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {market.selections.map((sel) => {
                  const odds = parseFloat(sel.odds);
                  const selected = hasSelection(market.eventId, market.id, sel.name);
                  return (
                    <button
                      key={sel.id}
                      onClick={() =>
                        addSelection({
                          id: sel.id,
                          eventId: market.eventId,
                          eventName: market.eventName,
                          marketId: market.id,
                          marketName: market.name,
                          outcomeName: sel.name,
                          odds,
                          sportId: slug,
                          sportName: sportLabel(slug),
                          startTime: new Date().toISOString(),
                          isLive: false,
                        })
                      }
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-all duration-200',
                        selected
                          ? 'bg-[#F59E0B]/10 border border-[#F59E0B] text-[#F59E0B]'
                          : 'bg-[#1C2128] border border-transparent text-[#C9D1D9] hover:border-[#30363D]'
                      )}
                    >
                      <span className="truncate mr-2">{sel.name}</span>
                      <span className={cn(
                        'font-mono font-semibold text-[13px] shrink-0',
                        selected ? 'text-[#F59E0B]' : 'text-[#10B981]'
                      )}>
                        {formatOdds(odds)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PulseView
// ---------------------------------------------------------------------------

function PulseView({ slug }: { slug: string }) {
  const [earners, setEarners] = useState<TopEarner[]>([]);
  const [trending, setTrending] = useState<TrendingBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    let cancelled = false;
    async function fetchPulse() {
      setIsLoading(true);
      try {
        const [earnersRes, trendingRes] = await Promise.allSettled([
          get<{ earners: TopEarner[] }>(`/pulse/top-earners?window=${timeWindow}&limit=10`),
          get<{ bets: TrendingBet[] }>(`/pulse/trending?sport=${slug}&limit=15`),
        ]);
        if (cancelled) return;
        if (earnersRes.status === 'fulfilled') setEarners(earnersRes.value.earners || []);
        if (trendingRes.status === 'fulfilled') setTrending(trendingRes.value.bets || []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchPulse();
    return () => { cancelled = true; };
  }, [slug, timeWindow]);

  const windowTabs = [
    { key: 'today' as const, label: 'Today' },
    { key: 'week' as const, label: 'Week' },
    { key: 'month' as const, label: 'Month' },
    { key: 'all' as const, label: 'All Time' },
  ];

  const vipColors: Record<string, string> = {
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    PLATINUM: '#E5E4E2',
    DIAMOND: '#B9F2FF',
    ELITE: '#8B5CF6',
    BLACK_DIAMOND: '#1a1a2e',
    BLUE_DIAMOND: '#0066FF',
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="bg-[#161B22] rounded-lg p-4">
          <div className="h-5 w-32 skeleton rounded mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-2">
              <div className="h-4 w-6 skeleton rounded" />
              <div className="h-4 w-24 skeleton rounded" />
              <div className="h-4 w-16 skeleton rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top Earners */}
      <div className="bg-[#161B22] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363D]/30">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-[13px] font-semibold text-[#E6EDF3]">Top Earners</span>
          </div>
          <div className="flex gap-0.5 bg-[#0D1117] rounded-md p-0.5">
            {windowTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTimeWindow(tab.key)}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  timeWindow === tab.key
                    ? 'bg-[#1C2128] text-[#E6EDF3]'
                    : 'text-[#484F58] hover:text-[#8B949E]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {earners.length > 0 ? (
          <div className="divide-y divide-[#30363D]/20">
            {earners.map((earner) => (
              <div key={earner.rank} className="flex items-center gap-3 px-4 py-3">
                <span className={cn(
                  'text-sm font-bold w-6 text-center',
                  earner.rank <= 3 ? 'text-[#F59E0B]' : 'text-[#484F58]'
                )}>
                  {earner.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-[#C9D1D9] truncate">{earner.username}</span>
                    {earner.vipTier && earner.vipTier !== 'BRONZE' && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${vipColors[earner.vipTier] || '#8B949E'}20`,
                          color: vipColors[earner.vipTier] || '#8B949E',
                        }}
                      >
                        {earner.vipTier.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#484F58]">
                    {earner.wonBets}/{earner.totalBets} bets ({earner.winRate}%)
                  </span>
                </div>
                <span className="text-sm font-mono font-semibold text-[#10B981] shrink-0">
                  +${parseFloat(earner.totalWon).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-[#8B949E] text-sm">No earners data yet</p>
            <p className="text-[#484F58] text-xs mt-1">Place bets to appear on the leaderboard</p>
          </div>
        )}
      </div>

      {/* Trending Bets */}
      <div className="bg-[#161B22] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#30363D]/30">
          <TrendingUp className="w-4 h-4 text-[#8B5CF6]" />
          <span className="text-[13px] font-semibold text-[#E6EDF3]">Trending Bets</span>
        </div>

        {trending.length > 0 ? (
          <div className="divide-y divide-[#30363D]/20">
            {trending.map((bet) => (
              <div key={bet.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#8B949E]">{bet.username}</span>
                  <span className="text-[10px] text-[#484F58]">
                    {new Date(bet.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#C9D1D9] truncate">{bet.eventName}</p>
                    <p className="text-xs text-[#8B949E] truncate">
                      {bet.selection}
                      {bet.isParlay && (
                        <span className="ml-1 text-[#8B5CF6]">Parlay ({bet.legCount} legs)</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-mono text-[#F59E0B]">@{parseFloat(bet.odds).toFixed(2)}</p>
                    <p className="text-sm font-mono font-semibold text-[#10B981]">
                      +${parseFloat(bet.winAmount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-[#8B949E] text-sm">No trending bets yet</p>
            <p className="text-[#484F58] text-xs mt-1">Recent winning bets will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultsView — Finished matches grouped by competition
// ---------------------------------------------------------------------------

function ResultsView({
  slug,
  sportName,
  marketLabel,
}: {
  slug: string;
  sportName: string;
  marketLabel: string;
}) {
  const [resultComps, setResultComps] = useState<
    { competition: Competition; events: SportEvent[] }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchResults() {
      setIsLoading(true);
      try {
        const data = await get<{ competitions: Competition[] }>(
          `/sports/${slug}/results`
        );
        if (cancelled) return;
        const comps = (data.competitions || [])
          .map((c) => ({
            competition: c,
            events: (c.events || []),
          }))
          .filter((c) => c.events.length > 0);
        setResultComps(comps);
      } catch {
        if (!cancelled) setResultComps([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchResults();
    return () => { cancelled = true; };
  }, [slug]);

  const totalResults = resultComps.reduce((sum, g) => sum + g.events.length, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CompetitionBlockSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (totalResults === 0) {
    return (
      <div className="bg-[#161B22] rounded-lg p-12 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1C2128] flex items-center justify-center">
          <BarChart3 className="w-6 h-6 text-[#30363D]" />
        </div>
        <p className="text-[#8B949E] text-sm mb-1">No results yet</p>
        <p className="text-[#484F58] text-xs">
          Finished {sportName.toLowerCase()} matches will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Results count */}
      <div className="flex items-center gap-2 px-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-[#8B949E]">
          <BarChart3 className="w-3.5 h-3.5" />
          {totalResults} finished {totalResults === 1 ? 'match' : 'matches'}
        </span>
        <span className="text-[10px] text-[#484F58]">Last 3 days</span>
      </div>

      {resultComps.map(({ competition, events }) => (
        <CompetitionBlock
          key={competition.id}
          competition={competition}
          events={events}
          slug={slug}
          sportName={sportName}
          marketLabel={marketLabel}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [isFavorite, setIsFavorite] = useState(false);

  // Read URL query params (competition, view)
  useEffect(() => {
    const compId = searchParams.get('competition');
    const view = searchParams.get('view') as ViewMode | null;
    if (compId) {
      setSelectedCompetitionId(compId);
      setViewMode('today');
    }
    if (view && ['today', 'tomorrow', 'result', 'competitions', 'outrights', 'pulse'].includes(view)) {
      setViewMode(view);
    }
  }, [searchParams]);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const pillsContainerRef = useRef<HTMLDivElement>(null);

  const sportName = sportLabel(slug);
  const marketLabel = getMarketLabel(slug);
  const iconColor = SPORT_ICON_COLORS[slug] || '#8B5CF6';

  // ---- Fetch data ----
  useEffect(() => {
    let cancelled = false;
    async function fetchData(silent = false) {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const data = await get<{ competitions: Competition[] }>(
          `/sports/${slug}/competitions`
        );
        if (cancelled) return;
        const comps = (data.competitions || []).map((c) => ({
          ...c,
          events: c.events || [],
        }));
        setCompetitions(comps);
        if (!silent) setError(null);
      } catch {
        if (!cancelled && !silent) {
          setError('Failed to load events. Please try again later.');
          setCompetitions([]);
        }
      } finally {
        if (!cancelled && !silent) setIsLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  // Reset filters when sport changes
  useEffect(() => {
    setSelectedCountry(null);
    setSelectedCompetitionId(null);
    setViewMode('today');
  }, [slug]);

  // Real-time event status updates
  useSocketEvent('event:status', useCallback((data: { eventId: string; status: string; isLive: boolean; timestamp: string }) => {
    setCompetitions((prev) =>
      prev.map((comp) => ({
        ...comp,
        events: comp.events.map((ev) => {
          if (ev.id !== data.eventId) return ev;
          return {
            ...ev,
            status: data.status.toLowerCase(),
            isLive: data.isLive,
          };
        }),
      })),
    );
  }, []));

  // Real-time score updates
  useSocketEvent('score:update', useCallback((data: { eventId: string; scores: { homeScore: number; awayScore: number; period?: string; time?: string }; timestamp: string }) => {
    setCompetitions((prev) =>
      prev.map((comp) => ({
        ...comp,
        events: comp.events.map((ev) => {
          if (ev.id !== data.eventId) return ev;
          return {
            ...ev,
            scores: { home: data.scores.homeScore, away: data.scores.awayScore },
            score: { home: data.scores.homeScore, away: data.scores.awayScore },
            metadata: {
              ...ev.metadata,
              statusShort: data.scores.period ?? ev.metadata?.statusShort,
              elapsed: data.scores.time ? parseInt(data.scores.time, 10) : ev.metadata?.elapsed,
            },
          };
        }),
      })),
    );
  }, []));

  // ---- Derived data ----

  const sortedCompetitions = useMemo(() => {
    return [...competitions].sort(
      (a, b) =>
        (b.eventCount ?? b.events.length) - (a.eventCount ?? a.events.length)
    );
  }, [competitions]);

  /** Filter events by day based on current viewMode */
  const filterByDay = useCallback((events: SportEvent[]): SportEvent[] => {
    if (viewMode === 'competitions' || viewMode === 'outrights' || viewMode === 'pulse' || viewMode === 'result') return events;
    if (selectedCompetitionId) return events; // show all events when a specific competition is selected

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (viewMode === 'today') {
      return events.filter((e) => {
        const st = e.status?.toLowerCase();
        if (st === 'ended' || st === 'finished') return false;
        const isLive = e.isLive || st === 'live';
        return isLive || isOnDay(e.startTime, today);
      });
    }

    if (viewMode === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return events.filter((e) => {
        const st = e.status?.toLowerCase();
        if (st === 'ended' || st === 'finished') return false;
        return isOnDay(e.startTime, tomorrow);
      });
    }

    return events;
  }, [viewMode]);

  // Country filter pills data
  const countryPills = useMemo(() => {
    const countryMap = new Map<string, { flag: string; count: number }>();

    sortedCompetitions.forEach((comp) => {
      const c = comp.country || '';
      if (!c) return;
      const filtered = filterByDay(comp.events);
      if (filtered.length === 0) return;
      const existing = countryMap.get(c);
      if (existing) {
        existing.count += filtered.length;
      } else {
        countryMap.set(c, { flag: countryToFlag(c), count: filtered.length });
      }
    });

    return [...countryMap.entries()]
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [sortedCompetitions, filterByDay]);

  // Count live events
  const liveCount = useMemo(() => {
    return sortedCompetitions.reduce((sum, c) =>
      sum + c.events.filter((e) => e.isLive || e.status?.toLowerCase() === 'live').length, 0
    );
  }, [sortedCompetitions]);

  /** Competitions with filtered events, in display order */
  const displayData = useMemo(() => {
    let targetComps = sortedCompetitions;

    // Filter by selected country
    if (selectedCountry === 'inplay') {
      targetComps = targetComps.map((c) => ({
        ...c,
        events: c.events.filter((e) => e.isLive || e.status?.toLowerCase() === 'live'),
      })).filter((c) => c.events.length > 0);
    } else if (selectedCountry) {
      targetComps = targetComps.filter((c) => c.country === selectedCountry);
    }

    // Filter by selected competition
    if (selectedCompetitionId) {
      targetComps = targetComps.filter((c) => c.id === selectedCompetitionId);
    }

    return targetComps
      .map((comp) => ({
        competition: comp,
        events: selectedCountry === 'inplay' ? comp.events : filterByDay(comp.events),
      }))
      .filter((entry) => entry.events.length > 0);
  }, [sortedCompetitions, selectedCountry, selectedCompetitionId, filterByDay]);

  // ---- Horizontal scroll with drag ----
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;
    isDragging.current = true;
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollLeftRef.current = ref.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent, ref: React.RefObject<HTMLDivElement | null>) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    ref.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // ---- View mode tabs config (matching Cloudbet) ----
  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'result', label: 'Result' },
    { key: 'competitions', label: 'Competitions' },
    { key: 'outrights', label: 'Outrights' },
    { key: 'pulse', label: 'Pulse' },
  ];

  // ---- Render ----
  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ================================================================== */}
      {/* Page Header: Back + Sport icon + Sport name + Favorite star        */}
      {/* ================================================================== */}
      <div className="sticky top-0 z-30 bg-[#0D1117]/95 backdrop-blur-md border-b border-[#30363D]/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#1C2128] transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-[#C9D1D9]" />
          </button>

          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${iconColor}20` }}
          >
            <Trophy className="w-4.5 h-4.5" style={{ color: iconColor }} />
          </div>

          <h1 className="text-lg font-bold text-[#E6EDF3] truncate flex-1">
            {sportName}
          </h1>

          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#1C2128] transition-colors shrink-0"
          >
            <Star
              className={cn(
                'w-5 h-5 transition-colors',
                isFavorite ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#484F58]'
              )}
            />
          </button>
        </div>

        {/* ================================================================ */}
        {/* Tab Navigation (horizontal scroll)                               */}
        {/* ================================================================ */}
        <div
          ref={tabsContainerRef}
          className="flex overflow-x-auto scrollbar-hide px-4 select-none"
          onMouseDown={(e) => handleMouseDown(e, tabsContainerRef)}
          onMouseMove={(e) => handleMouseMove(e, tabsContainerRef)}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setViewMode(tab.key);
                setSelectedCountry(null);
                setSelectedCompetitionId(null);
              }}
              className={cn(
                'relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                viewMode === tab.key
                  ? 'text-[#E6EDF3]'
                  : 'text-[#8B949E] hover:text-[#C9D1D9]'
              )}
            >
              {tab.label}
              {/* Active tab underline - yellow/green accent */}
              {viewMode === tab.key && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#F59E0B] rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Country/League filter pills (shown for Today/Tomorrow)             */}
      {/* ================================================================== */}
      {(viewMode === 'today' || viewMode === 'tomorrow') && (
        <div className="border-b border-[#30363D]/30">
          {isLoading ? (
            <CompetitionTabsSkeleton />
          ) : (
            <div
              ref={pillsContainerRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3 select-none cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => handleMouseDown(e, pillsContainerRef)}
              onMouseMove={(e) => handleMouseMove(e, pillsContainerRef)}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* "All [Sport]" pill */}
              <button
                onClick={() => {
                  setSelectedCountry(null);
                  setSelectedCompetitionId(null);
                }}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap border',
                  selectedCountry === null
                    ? 'border-[#F59E0B] text-[#F59E0B] bg-[#F59E0B]/5'
                    : 'border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9] hover:border-[#8B949E]/50 bg-transparent'
                )}
              >
                All {sportName}
              </button>

              {/* "In-play" pill */}
              {liveCount > 0 && (
                <button
                  onClick={() => {
                    setSelectedCountry(selectedCountry === 'inplay' ? null : 'inplay');
                    setSelectedCompetitionId(null);
                  }}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap border flex items-center gap-1.5',
                    selectedCountry === 'inplay'
                      ? 'border-[#F59E0B] text-[#F59E0B] bg-[#F59E0B]/5'
                      : 'border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9] hover:border-[#8B949E]/50 bg-transparent'
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                  In-play
                  <span className={cn(
                    'text-[10px] font-mono',
                    selectedCountry === 'inplay' ? 'text-[#F59E0B]/70' : 'text-[#484F58]'
                  )}>
                    {liveCount}
                  </span>
                </button>
              )}

              {/* Country pills */}
              {countryPills.map(({ code, flag }) => (
                <button
                  key={code}
                  onClick={() => {
                    setSelectedCountry(selectedCountry === code ? null : code);
                    setSelectedCompetitionId(null);
                  }}
                  className={cn(
                    'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap border flex items-center gap-1.5',
                    selectedCountry === code
                      ? 'border-[#F59E0B] text-[#F59E0B] bg-[#F59E0B]/5'
                      : 'border-[#30363D] text-[#8B949E] hover:text-[#C9D1D9] hover:border-[#8B949E]/50 bg-transparent'
                  )}
                >
                  {flag && <span className="text-[12px] leading-none">{flag}</span>}
                  <span>{code.length === 2 ? code.toUpperCase() : code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* Content area                                                        */}
      {/* ================================================================== */}
      <div className="px-3 lg:px-4 py-3 space-y-3">
        {/* Selected competition header */}
        {selectedCompetitionId && (() => {
          const comp = sortedCompetitions.find((c) => c.id === selectedCompetitionId);
          if (!comp) return null;
          return (
            <div className="flex items-center gap-2 bg-[#161B22] rounded-lg px-4 py-3">
              <button
                onClick={() => {
                  setSelectedCompetitionId(null);
                  router.replace(`/sports/${slug}`);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#1C2128] transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-[#C9D1D9]" />
              </button>
              {comp.country && <span className="text-sm">{countryToFlag(comp.country)}</span>}
              {comp.logo && <img src={comp.logo} alt="" className="w-5 h-5 object-contain shrink-0" />}
              <span className="text-sm font-semibold text-[#E6EDF3] truncate">{comp.name}</span>
              <span className="text-xs text-[#484F58] ml-auto shrink-0">
                {displayData.reduce((sum, d) => sum + d.events.length, 0)} events
              </span>
            </div>
          );
        })()}

        {/* Outrights view */}
        {viewMode === 'outrights' ? (
          <OutrightsView slug={slug} />
        ) : /* Pulse view */
        viewMode === 'pulse' ? (
          <PulseView slug={slug} />
        ) : /* Results view */
        viewMode === 'result' ? (
          <ResultsView slug={slug} sportName={sportName} marketLabel={marketLabel} />
        ) : /* Competitions browse view */
        viewMode === 'competitions' ? (
          isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CompetitionBlockSkeleton key={i} />
              ))}
            </div>
          ) : (
            <CompetitionsBrowseView
              competitions={sortedCompetitions}
              slug={slug}
            />
          )
        ) : /* Events grouped by competition (Today/Tomorrow views) */
        isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CompetitionBlockSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="bg-[#161B22] rounded-lg p-12 text-center">
            <p className="text-[#EF4444] text-sm mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-[#F59E0B] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : displayData.length === 0 ? (
          <div className="bg-[#161B22] rounded-lg p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1C2128] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#30363D]" />
            </div>
            <p className="text-[#8B949E] text-sm mb-1">No events found</p>
            <p className="text-[#484F58] text-xs">
              {viewMode === 'today'
                ? 'No events scheduled for today. Try "Tomorrow".'
                : viewMode === 'tomorrow'
                ? 'No events scheduled for tomorrow.'
                : selectedCountry
                ? 'No events for this selection. Try "All".'
                : `No ${sportName.toLowerCase()} events available right now.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayData.map(({ competition, events }, index) => (
              <React.Fragment key={competition.id}>
                <CompetitionBlock
                  competition={competition}
                  events={events}
                  slug={slug}
                  sportName={sportName}
                  marketLabel={marketLabel}
                />
                {/* Insert Pulse promotional banner after the 2nd competition */}
                {index === 1 && displayData.length > 2 && (
                  <PulseBanner slug={slug} sportName={sportName} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
