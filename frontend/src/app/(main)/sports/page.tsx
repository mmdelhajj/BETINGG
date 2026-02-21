'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Trophy,
  CircleDot,
  Target,
  Dumbbell,
  Swords,
  Gamepad2,
  Bike,
  Zap,
  Globe,
  Star,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { cn, formatOdds, formatDate } from '@/lib/utils';
import { get } from '@/lib/api';
import { useSocket, useSocketEvent } from '@/lib/socket';
import { useBetSlipStore } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sport {
  id: string;
  name: string;
  slug: string;
  icon: string;
  eventCount: number;
  liveEventCount: number;
}

interface Competition {
  id: string;
  name: string;
  slug?: string;
  sportSlug?: string;
  sport?: { id: string; name: string; slug: string; icon?: string };
  eventCount: number;
  logo?: string | null;
  country?: string;
}

interface FeaturedMatch {
  id: string;
  sport: string;
  sportSlug: string;
  competition: string;
  competitionSlug: string;
  competitionLogo?: string | null;
  competitionCountry?: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeTeamCountry?: string | null;
  awayTeamCountry?: string | null;
  startTime: string;
  isLive: boolean;
  scores?: { home?: number; away?: number } | null;
  mainMarket?: {
    id: string;
    name: string;
    type: string;
    selections: {
      id: string;
      name: string;
      outcome: string;
      odds: string;
      status: string;
    }[];
  } | null;
}

interface SportCompetition {
  id: string;
  name: string;
  slug?: string;
  country?: string;
  logo?: string | null;
  events: SportEvent[];
}

interface SportEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeTeamCountry?: string | null;
  awayTeamCountry?: string | null;
  startTime: string;
  status: string;
  isLive?: boolean;
  scores?: { home?: number; away?: number } | null;
  mainMarket?: {
    id: string;
    name: string;
    type: string;
    selections: {
      id: string;
      name: string;
      outcome: string;
      odds: string | number;
      status: string;
    }[];
  } | null;
}

// ---------------------------------------------------------------------------
// Constants -- Sport icon config with colors
// ---------------------------------------------------------------------------

const SPORT_ICON_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; emoji: string }
> = {
  football: {
    icon: <Trophy className="w-5 h-5" />,
    color: '#22C55E',
    emoji: '',
  },
  soccer: {
    icon: <Trophy className="w-5 h-5" />,
    color: '#22C55E',
    emoji: '',
  },
  basketball: {
    icon: <CircleDot className="w-5 h-5" />,
    color: '#F97316',
    emoji: '',
  },
  tennis: {
    icon: <Target className="w-5 h-5" />,
    color: '#EAB308',
    emoji: '',
  },
  baseball: {
    icon: <Dumbbell className="w-5 h-5" />,
    color: '#EF4444',
    emoji: '',
  },
  hockey: {
    icon: <Swords className="w-5 h-5" />,
    color: '#06B6D4',
    emoji: '',
  },
  'ice-hockey': {
    icon: <Swords className="w-5 h-5" />,
    color: '#06B6D4',
    emoji: '',
  },
  mma: {
    icon: <Swords className="w-5 h-5" />,
    color: '#EF4444',
    emoji: '',
  },
  boxing: {
    icon: <Dumbbell className="w-5 h-5" />,
    color: '#DC2626',
    emoji: '',
  },
  cricket: {
    icon: <Target className="w-5 h-5" />,
    color: '#84CC16',
    emoji: '',
  },
  rugby: {
    icon: <Dumbbell className="w-5 h-5" />,
    color: '#A855F7',
    emoji: '',
  },
  esports: {
    icon: <Gamepad2 className="w-5 h-5" />,
    color: '#8B5CF6',
    emoji: '',
  },
  cycling: {
    icon: <Bike className="w-5 h-5" />,
    color: '#F59E0B',
    emoji: '',
  },
  'table-tennis': {
    icon: <Target className="w-5 h-5" />,
    color: '#10B981',
    emoji: '',
  },
  volleyball: {
    icon: <CircleDot className="w-5 h-5" />,
    color: '#3B82F6',
    emoji: '',
  },
  handball: {
    icon: <CircleDot className="w-5 h-5" />,
    color: '#14B8A6',
    emoji: '',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countryCodeToFlag(countryCode?: string): string {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();
  if (code.length !== 2) {
    const nameToCode: Record<string, string> = {
      england: 'GB',
      'united kingdom': 'GB',
      spain: 'ES',
      italy: 'IT',
      germany: 'DE',
      france: 'FR',
      brazil: 'BR',
      argentina: 'AR',
      portugal: 'PT',
      netherlands: 'NL',
      belgium: 'BE',
      turkey: 'TR',
      usa: 'US',
      'united states': 'US',
      canada: 'CA',
      australia: 'AU',
      japan: 'JP',
      'south korea': 'KR',
      china: 'CN',
      russia: 'RU',
      mexico: 'MX',
      sweden: 'SE',
      norway: 'NO',
      denmark: 'DK',
      finland: 'FI',
      switzerland: 'CH',
      austria: 'AT',
      scotland: 'GB',
      international: '',
      world: '',
    };
    const mapped = nameToCode[code.toLowerCase()];
    if (!mapped) return '';
    if (mapped === '') return '';
    return String.fromCodePoint(
      ...mapped.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  }
  return String.fromCodePoint(
    ...code.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

function formatMatchTime(startTime: string): { label: string; sublabel?: string } {
  const date = new Date(startTime);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs < 0) {
    return { label: formatDate(startTime) };
  }

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isTomorrow =
    date.getDate() === now.getDate() + 1 &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return { label: 'Today', sublabel: time };
  }
  if (isTomorrow) {
    return { label: 'Tomorrow', sublabel: time };
  }

  return {
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sublabel: time,
  };
}

// ---------------------------------------------------------------------------
// Team Icon Fallback Helpers
// ---------------------------------------------------------------------------

const INDIVIDUAL_SPORTS = new Set([
  'tennis',
  'table-tennis',
  'badminton',
  'boxing',
  'mma',
  'darts',
  'snooker',
  'cycling',
  'golf',
  'athletics',
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

// ---------------------------------------------------------------------------
// TeamIcon Component
// ---------------------------------------------------------------------------

function TeamIcon({
  logo,
  name,
  countryCode,
  sportSlug,
  size = 'sm',
}: {
  logo?: string | null;
  name: string;
  countryCode?: string | null;
  sportSlug: string;
  size?: 'sm' | 'md';
}) {
  const [imgError, setImgError] = useState(false);

  const sizeClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  const textSize = size === 'md' ? 'text-[10px]' : 'text-[9px]';

  if (logo && !imgError) {
    return (
      <img
        src={logo}
        alt=""
        className={`${sizeClass} object-contain flex-shrink-0 rounded-sm`}
        onError={() => setImgError(true)}
      />
    );
  }

  if (INDIVIDUAL_SPORTS.has(sportSlug) && countryCode) {
    const flag = countryToFlag(countryCode);
    if (flag) {
      return (
        <span
          className={`${sizeClass} flex items-center justify-center flex-shrink-0 text-xs leading-none`}
        >
          {flag}
        </span>
      );
    }
  }

  const letter = name.charAt(0).toUpperCase();
  const bgColor = getAvatarColor(name);

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: bgColor }}
    >
      <span className={`${textSize} font-bold text-white leading-none`}>
        {letter}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SportIconSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div className="w-11 h-11 skeleton rounded-full" />
      <div className="h-2.5 w-8 skeleton rounded" />
    </div>
  );
}

function CompetitionPillSkeleton() {
  return <div className="flex-shrink-0 h-[30px] w-28 skeleton rounded-full" />;
}

function EventGroupSkeleton() {
  return (
    <div className="border-b border-[#21262D]">
      {/* Competition header skeleton */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#0D1117]">
        <div className="h-4 w-4 skeleton rounded" />
        <div className="h-3.5 w-28 skeleton rounded" />
      </div>
      {/* Market header skeleton */}
      <div className="flex items-center px-4 py-1.5 bg-[#0D1117]/60 border-b border-[#21262D]/60">
        <div className="flex-1" />
        <div className="flex gap-2">
          <div className="h-3 w-10 skeleton rounded" />
          <div className="h-3 w-10 skeleton rounded" />
          <div className="h-3 w-10 skeleton rounded" />
        </div>
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center px-4 py-3 border-b border-[#21262D]/40"
        >
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 skeleton rounded-full" />
              <div className="h-3 w-24 skeleton rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 skeleton rounded-full" />
              <div className="h-3 w-20 skeleton rounded" />
            </div>
          </div>
          <div className="w-14 flex items-center justify-center">
            <div className="h-3 w-10 skeleton rounded" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-[38px] w-[58px] skeleton rounded" />
            <div className="h-[38px] w-[58px] skeleton rounded" />
            <div className="h-[38px] w-[58px] skeleton rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OddsButton -- Cloudbet style green monospace on dark bg
// ---------------------------------------------------------------------------

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
  status,
  startTime,
  isLive,
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
  status?: string;
  startTime: string;
  isLive: boolean;
}) {
  const { addSelection, hasSelection } = useBetSlipStore();
  const isSelected = hasSelection(eventId, marketId, outcomeName);
  const isSuspended = status === 'suspended' || status === 'closed';

  if (isSuspended) {
    return (
      <div className="flex items-center justify-center w-[58px] h-[38px] rounded bg-[#161B22] border border-[#21262D]">
        <Lock className="w-3 h-3 text-[#484F58]" />
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
        'flex items-center justify-center w-[58px] h-[38px] rounded border transition-all duration-150 font-mono text-[13px] font-semibold tabular-nums',
        isSelected
          ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#C4B5FD] shadow-[0_0_8px_rgba(139,92,246,0.2)]'
          : 'border-[#21262D] bg-[#161B22] text-[#10B981] hover:border-[#10B981]/50 hover:bg-[#10B981]/5 active:scale-[0.97]'
      )}
    >
      {formatOdds(odds)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MatchRow -- Cloudbet table row style: teams left, time center, odds right
// ---------------------------------------------------------------------------

function MatchRow({
  event,
  sportSlug,
  sportName,
  showBorder = true,
}: {
  event: SportEvent | FeaturedMatch;
  sportSlug: string;
  sportName: string;
  competitionName: string;
  showBorder?: boolean;
}) {
  const isLive = 'isLive' in event ? !!event.isLive : false;
  const scores = event.scores as { home?: number; away?: number } | null;
  const market = event.mainMarket;
  const eventName = `${event.homeTeam} vs ${event.awayTeam}`;
  const timeInfo = formatMatchTime(event.startTime);

  const liveMinute = useMemo(() => {
    if (!isLive) return null;
    const start = new Date(event.startTime).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - start) / 60000);
    return diffMin > 0 && diffMin < 120 ? diffMin : null;
  }, [isLive, event.startTime]);

  return (
    <Link
      href={`/sports/${sportSlug}/${'id' in event ? event.id : ''}`}
      className={cn(
        'group flex items-center gap-0 px-4 py-2.5 hover:bg-[#161B22]/80 transition-colors duration-150',
        showBorder && 'border-b border-[#21262D]/50'
      )}
    >
      {/* Teams column */}
      <div className="flex-1 min-w-0 pr-3">
        {/* Home team row */}
        <div className="flex items-center gap-2 min-w-0 mb-1">
          <TeamIcon
            logo={event.homeTeamLogo}
            name={event.homeTeam}
            countryCode={
              'homeTeamCountry' in event
                ? (event as FeaturedMatch).homeTeamCountry
                : undefined
            }
            sportSlug={sportSlug}
          />
          <span
            className={cn(
              'text-[13px] truncate leading-tight',
              isLive && scores && typeof scores.home === 'number' && scores.home > (scores.away ?? 0)
                ? 'text-white font-medium'
                : 'text-[#C9D1D9]'
            )}
          >
            {event.homeTeam}
          </span>
        </div>

        {/* Away team row */}
        <div className="flex items-center gap-2 min-w-0">
          <TeamIcon
            logo={event.awayTeamLogo}
            name={event.awayTeam}
            countryCode={
              'awayTeamCountry' in event
                ? (event as FeaturedMatch).awayTeamCountry
                : undefined
            }
            sportSlug={sportSlug}
          />
          <span
            className={cn(
              'text-[13px] truncate leading-tight',
              isLive && scores && typeof scores.away === 'number' && scores.away > (scores.home ?? 0)
                ? 'text-white font-medium'
                : 'text-[#C9D1D9]'
            )}
          >
            {event.awayTeam}
          </span>
        </div>
      </div>

      {/* Time / Score column -- fixed width center */}
      <div className="w-[60px] flex-shrink-0 flex flex-col items-center justify-center text-center">
        {isLive ? (
          <>
            {/* Live badge */}
            <div className="flex items-center gap-1 mb-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#EF4444]" />
              </span>
              <span className="text-[10px] font-bold text-[#EF4444] uppercase tracking-wide">
                {liveMinute !== null ? `${liveMinute}'` : 'Live'}
              </span>
            </div>
            {/* Score */}
            {scores && typeof scores.home === 'number' && (
              <span className="text-[13px] font-mono font-bold text-white leading-none">
                {scores.home} - {scores.away ?? 0}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[11px] text-[#8B949E] font-medium leading-tight">
              {timeInfo.label}
            </span>
            {timeInfo.sublabel && (
              <span className="text-[10px] text-[#6E7681] leading-tight">
                {timeInfo.sublabel}
              </span>
            )}
          </>
        )}
      </div>

      {/* Odds column */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        {market && market.selections.length > 0 ? (
          market.selections.map((sel) => (
            <OddsButton
              key={sel.id || sel.name}
              selectionId={sel.id}
              eventId={'id' in event ? event.id : ''}
              eventName={eventName}
              sportId={sportSlug}
              sportName={sportName}
              marketId={market.id}
              marketName={market.name}
              outcomeName={sel.name}
              odds={
                typeof sel.odds === 'string'
                  ? parseFloat(sel.odds)
                  : sel.odds
              }
              status={sel.status}
              startTime={event.startTime}
              isLive={isLive}
            />
          ))
        ) : (
          <span className="text-[11px] text-[#484F58] italic w-[58px] text-center">--</span>
        )}
      </div>

      {/* Arrow indicator */}
      <ChevronRight className="w-3.5 h-3.5 text-[#30363D] ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// CompetitionGroup -- Collapsible competition section with market headers
// ---------------------------------------------------------------------------

function CompetitionGroup({
  name,
  country,
  logo,
  sportSlug,
  sportName,
  events,
}: {
  name: string;
  country?: string;
  logo?: string | null;
  sportSlug: string;
  sportName: string;
  events: (SportEvent | FeaturedMatch)[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const flag = countryCodeToFlag(country);

  if (events.length === 0) return null;

  const firstMarket = events[0]?.mainMarket;

  const marketHeaders = useMemo(() => {
    if (!firstMarket?.selections) return [];
    const len = firstMarket.selections.length;
    if (len === 3) return ['1', 'X', '2'];
    if (len === 2) return ['1', '2'];
    return firstMarket.selections.map((s) =>
      s.name?.length <= 4 ? s.name : s.name?.charAt(0) || ''
    );
  }, [firstMarket]);

  return (
    <div className="border-b border-[#21262D]">
      {/* Competition header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2.5 px-4 py-2 bg-[#0D1117] hover:bg-[#161B22]/50 transition-colors duration-150"
      >
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-[#6E7681] flex-shrink-0 transition-transform duration-200',
            isCollapsed && '-rotate-90'
          )}
        />
        {logo ? (
          <img
            src={logo}
            alt=""
            className="w-4 h-4 object-contain flex-shrink-0 rounded-sm"
          />
        ) : flag ? (
          <span className="text-sm flex-shrink-0 leading-none">{flag}</span>
        ) : (
          <Globe className="w-3.5 h-3.5 text-[#6E7681] flex-shrink-0" />
        )}
        <span className="text-[13px] font-semibold text-[#E6EDF3] truncate">
          {name}
        </span>
        <span className="text-[10px] text-[#6E7681] bg-[#21262D] px-1.5 py-0.5 rounded font-mono flex-shrink-0">
          {events.length}
        </span>
        <div className="flex-1" />
      </button>

      {/* Market column headers */}
      {!isCollapsed && marketHeaders.length > 0 && (
        <div className="flex items-center px-4 py-1 bg-[#0D1117]/70 border-b border-[#21262D]/40">
          <div className="flex-1" />
          <div className="w-[60px] flex-shrink-0" />
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {marketHeaders.map((h, i) => (
              <span
                key={i}
                className="w-[58px] text-center text-[10px] text-[#6E7681] font-semibold uppercase tracking-wider"
              >
                {h}
              </span>
            ))}
          </div>
          {/* Spacer for arrow */}
          <div className="w-[22px] flex-shrink-0" />
        </div>
      )}

      {/* Events */}
      {!isCollapsed && (
        <div>
          {events.map((event, idx) => (
            <MatchRow
              key={event.id}
              event={event}
              sportSlug={sportSlug}
              sportName={sportName}
              competitionName={name}
              showBorder={idx < events.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PulseBanner
// ---------------------------------------------------------------------------

function PulseBanner({ sportName }: { sportName: string }) {
  return (
    <Link
      href="/sports/live"
      className="flex items-center gap-3 mx-4 my-3 px-4 py-3 bg-gradient-to-r from-[#8B5CF6]/10 via-[#161B22] to-[#161B22] border border-[#8B5CF6]/20 rounded-lg hover:border-[#8B5CF6]/40 transition-all duration-200 group"
    >
      <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
        <Zap className="w-4 h-4 text-[#8B5CF6]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#8B5CF6]/80">
          CryptoBet Pulse
        </div>
        <div className="text-[13px] font-semibold text-[#E6EDF3] truncate">
          {sportName ? `${sportName} -- ` : ''}See who&apos;s winning right now
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-[#8B5CF6] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// BrowseSportsGrid
// ---------------------------------------------------------------------------

function BrowseSportsGrid({
  sports,
  onSelect,
}: {
  sports: Sport[];
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="px-4 py-4">
      <h2 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
        <Globe className="w-4 h-4 text-[#8B5CF6]" />
        Browse All Sports
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {sports.map((sport) => {
          const config =
            SPORT_ICON_CONFIG[sport.icon] ||
            SPORT_ICON_CONFIG[sport.slug] ||
            { icon: <Trophy className="w-5 h-5" />, color: '#8B5CF6', emoji: '' };

          return (
            <button
              key={sport.id}
              onClick={() => onSelect(sport.slug)}
              className="bg-[#161B22] border border-[#21262D] rounded-lg p-3 flex items-center gap-2.5 hover:border-[#8B5CF6]/30 hover:bg-[#1C2128] transition-all duration-200 group text-left"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                style={{
                  backgroundColor: `${config.color}18`,
                  color: config.color,
                }}
              >
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-[#E6EDF3] truncate">
                  {sport.name}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#6E7681]">
                  <span>{sport.eventCount}</span>
                  {sport.liveEventCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[#EF4444]">
                      <span className="w-1 h-1 rounded-full bg-[#EF4444] animate-pulse" />
                      {sport.liveEventCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScrollableRow - shared horizontal scroll with optional arrows
// ---------------------------------------------------------------------------

function ScrollableRow({
  children,
  scrollRef,
  className,
  showArrows = false,
}: {
  children: React.ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  showArrows?: boolean;
}) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const ref = scrollRef || internalRef;
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      observer.disconnect();
    };
  }, [ref, checkScroll]);

  const scrollBy = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="relative group/scroll">
      {showArrows && canScrollLeft && (
        <button
          onClick={() => scrollBy(-200)}
          className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-[#0D1117] to-transparent flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4 text-[#C9D1D9]" />
        </button>
      )}
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={cn('overflow-x-auto scrollbar-hide', className)}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
      {showArrows && canScrollRight && (
        <button
          onClick={() => scrollBy(200)}
          className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-[#0D1117] to-transparent flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4 text-[#C9D1D9]" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sports Lobby Page
// ---------------------------------------------------------------------------

export default function SportsLobbyPage() {
  // --- State ---
  const [sports, setSports] = useState<Sport[]>([]);
  const [popularCompetitions, setPopularCompetitions] = useState<Competition[]>([]);
  const [featuredMatches, setFeaturedMatches] = useState<FeaturedMatch[]>([]);
  const [sportCompetitions, setSportCompetitions] = useState<SportCompetition[]>([]);

  const [selectedSportSlug, setSelectedSportSlug] = useState<string>('all');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(
    null
  );

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingSportEvents, setIsLoadingSportEvents] = useState(false);

  const sportScrollRef = useRef<HTMLDivElement>(null);
  const compScrollRef = useRef<HTMLDivElement>(null);

  // --- Socket.IO real-time live updates ---
  useSocket({ autoConnect: true, rooms: ['live'] });

  // live:update — full list of live events (replace/merge into local state)
  useSocketEvent('live:update', useCallback((data: { events: Array<{ id: string; homeTeam: string; awayTeam: string; homeTeamLogo?: string | null; awayTeamLogo?: string | null; startTime: string; status: string; isLive: boolean; scores?: { home?: number; away?: number } | null; sportSlug: string; competitionSlug?: string; mainMarket?: { id: string; name: string; type: string; selections: { id: string; name: string; outcome: string; odds: string | number; status: string }[] } | null }> }) => {
    if (!data?.events) return;
    const liveById = new Map(data.events.map((e) => [e.id, e]));

    // Update featured matches
    setFeaturedMatches((prev) =>
      prev.map((m) => {
        const live = liveById.get(m.id);
        if (!live) return m;
        return {
          ...m,
          isLive: live.isLive,
          status: live.status as string,
          scores: live.scores ?? m.scores,
          mainMarket: live.mainMarket
            ? { ...live.mainMarket, selections: live.mainMarket.selections.map((s) => ({ ...s, odds: String(s.odds) })) }
            : m.mainMarket,
        };
      })
    );

    // Update sport competitions (drill into events)
    setSportCompetitions((prev) =>
      prev.map((comp) => ({
        ...comp,
        events: comp.events.map((ev) => {
          const live = liveById.get(ev.id);
          if (!live) return ev;
          return {
            ...ev,
            isLive: live.isLive,
            status: live.status,
            scores: live.scores ?? ev.scores,
            mainMarket: live.mainMarket
              ? { ...live.mainMarket, selections: live.mainMarket.selections.map((s) => ({ ...s, odds: s.odds })) }
              : ev.mainMarket,
          };
        }),
      }))
    );

    // Recompute per-sport live counts
    const liveCountBySport = new Map<string, number>();
    for (const ev of data.events) {
      if (ev.isLive) {
        liveCountBySport.set(ev.sportSlug, (liveCountBySport.get(ev.sportSlug) || 0) + 1);
      }
    }
    setSports((prev) =>
      prev.map((s) => ({
        ...s,
        liveEventCount: liveCountBySport.get(s.slug) ?? s.liveEventCount,
      }))
    );
  }, []));

  // event:scoreUpdate — individual score change
  useSocketEvent('event:scoreUpdate', useCallback((data: { eventId: string; homeScore: number; awayScore: number; timer?: string; period?: string }) => {
    if (!data?.eventId) return;
    const newScores = { home: data.homeScore, away: data.awayScore };

    setFeaturedMatches((prev) =>
      prev.map((m) =>
        m.id === data.eventId ? { ...m, scores: newScores } : m
      )
    );

    setSportCompetitions((prev) =>
      prev.map((comp) => ({
        ...comp,
        events: comp.events.map((ev) =>
          ev.id === data.eventId ? { ...ev, scores: newScores } : ev
        ),
      }))
    );
  }, []));

  // event:status — live/ended status change
  useSocketEvent('event:status', useCallback((data: { eventId: string; status: string; isLive: boolean }) => {
    if (!data?.eventId) return;

    setFeaturedMatches((prev) =>
      prev.map((m) =>
        m.id === data.eventId ? { ...m, isLive: data.isLive } : m
      )
    );

    setSportCompetitions((prev) =>
      prev.map((comp) => ({
        ...comp,
        events: comp.events.map((ev) =>
          ev.id === data.eventId ? { ...ev, isLive: data.isLive, status: data.status } : ev
        ),
      }))
    );

    // Adjust live count on the relevant sport
    setSports((prev) =>
      prev.map((s) => {
        // Check if this sport has the event
        const hasEvent =
          featuredMatches.some((m) => m.id === data.eventId && m.sportSlug === s.slug) ||
          sportCompetitions.some((c) => c.events.some((ev) => ev.id === data.eventId));
        if (!hasEvent) return s;
        return {
          ...s,
          liveEventCount: data.isLive
            ? s.liveEventCount + 1
            : Math.max(0, s.liveEventCount - 1),
        };
      })
    );
  }, [featuredMatches, sportCompetitions]));

  // --- Initial data fetch ---
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [sportsRes, compsRes, featuredRes] = await Promise.allSettled([
          get<{ sports: Sport[] }>('/sports'),
          get<Competition[]>('/sports/popular-competitions'),
          get<{ events: FeaturedMatch[] }>('/events/featured'),
        ]);

        if (sportsRes.status === 'fulfilled') {
          setSports(sportsRes.value.sports || []);
        }
        if (compsRes.status === 'fulfilled') {
          const data = compsRes.value;
          setPopularCompetitions(
            Array.isArray(data) ? data : (data as any)?.competitions || []
          );
        }
        if (featuredRes.status === 'fulfilled') {
          setFeaturedMatches(featuredRes.value.events || []);
        }
      } catch {
        // Graceful empty state
      } finally {
        setIsLoadingInitial(false);
      }
    }
    fetchInitialData();
  }, []);

  // --- Fetch sport-specific competitions when a sport is selected ---
  useEffect(() => {
    if (selectedSportSlug === 'all') {
      setSportCompetitions([]);
      setSelectedCompetitionId(null);
      return;
    }

    let cancelled = false;

    async function fetchSportCompetitions() {
      setIsLoadingSportEvents(true);
      setSelectedCompetitionId(null);
      try {
        const data = await get<{ competitions: SportCompetition[] }>(
          `/sports/${selectedSportSlug}/competitions`
        );
        if (!cancelled) {
          setSportCompetitions(
            Array.isArray(data)
              ? (data as unknown as SportCompetition[])
              : data.competitions || []
          );
        }
      } catch {
        if (!cancelled) {
          setSportCompetitions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSportEvents(false);
        }
      }
    }

    fetchSportCompetitions();
    return () => {
      cancelled = true;
    };
  }, [selectedSportSlug]);

  // --- Derived data ---
  const totalLive = sports.reduce((sum, s) => sum + s.liveEventCount, 0);
  const selectedSport = sports.find((s) => s.slug === selectedSportSlug);

  // Competition tabs
  const competitionTabs = useMemo(() => {
    if (selectedSportSlug === 'all') {
      return popularCompetitions.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        country: c.country,
        logo: c.logo,
        sportSlug: c.sport?.slug || c.sportSlug || '',
        eventCount: c.eventCount,
      }));
    }
    return sportCompetitions.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      country: c.country,
      logo: c.logo,
      sportSlug: selectedSportSlug,
      eventCount: c.events?.length || 0,
    }));
  }, [selectedSportSlug, popularCompetitions, sportCompetitions]);

  // Events grouped by competition
  const groupedEvents = useMemo(() => {
    if (selectedSportSlug === 'all') {
      const groups: Record<
        string,
        {
          competitionName: string;
          competitionLogo?: string | null;
          sportSlug: string;
          sportName: string;
          country?: string;
          events: FeaturedMatch[];
        }
      > = {};

      const filteredMatches = selectedCompetitionId
        ? featuredMatches.filter(
            (m) =>
              m.competitionSlug === selectedCompetitionId ||
              m.competition ===
                popularCompetitions.find((c) => c.id === selectedCompetitionId)?.name
          )
        : featuredMatches;

      for (const match of filteredMatches) {
        const key = match.competitionSlug || match.competition;
        if (!groups[key]) {
          groups[key] = {
            competitionName: match.competition,
            competitionLogo: match.competitionLogo,
            sportSlug: match.sportSlug,
            sportName: match.sport,
            events: [],
          };
        }
        groups[key].events.push(match);
      }
      return Object.values(groups);
    }

    let comps = sportCompetitions;
    if (selectedCompetitionId) {
      comps = comps.filter((c) => c.id === selectedCompetitionId);
    }

    return comps
      .filter((c) => c.events && c.events.length > 0)
      .map((c) => ({
        competitionName: c.name,
        competitionLogo: c.logo,
        sportSlug: selectedSportSlug,
        sportName: selectedSport?.name || '',
        country: c.country,
        events: c.events,
      }));
  }, [
    selectedSportSlug,
    selectedCompetitionId,
    featuredMatches,
    sportCompetitions,
    selectedSport,
    popularCompetitions,
  ]);

  // --- Sport select handler ---
  const handleSelectSport = useCallback((slug: string) => {
    setSelectedSportSlug(slug);
    if (compScrollRef.current) {
      compScrollRef.current.scrollLeft = 0;
    }
  }, []);

  // --- Render ---
  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ================================================================ */}
      {/* Sport Icon Carousel -- horizontal scroll with circular icons     */}
      {/* ================================================================ */}
      <div className="sticky top-0 z-20 bg-[#0D1117]/95 backdrop-blur-md border-b border-[#21262D]">
        <ScrollableRow
          scrollRef={sportScrollRef}
          className="flex items-center gap-3 px-4 py-3"
          showArrows
        >
          {isLoadingInitial ? (
            <div className="flex items-center gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <SportIconSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* All Sports icon */}
              <button
                onClick={() => handleSelectSport('all')}
                className="flex flex-col items-center gap-1 flex-shrink-0 group"
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border-2',
                    selectedSportSlug === 'all'
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#8B5CF6] shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                      : 'border-transparent bg-[#161B22] text-[#6E7681] group-hover:bg-[#1C2128] group-hover:text-[#C9D1D9]'
                  )}
                >
                  <Zap className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium leading-none',
                    selectedSportSlug === 'all'
                      ? 'text-[#8B5CF6]'
                      : 'text-[#6E7681] group-hover:text-[#C9D1D9]'
                  )}
                >
                  All
                </span>
              </button>

              {/* Individual sport icons */}
              {sports.map((sport) => {
                const config =
                  SPORT_ICON_CONFIG[sport.icon] ||
                  SPORT_ICON_CONFIG[sport.slug] ||
                  {
                    icon: <Trophy className="w-5 h-5" />,
                    color: '#8B5CF6',
                    emoji: '',
                  };
                const isActive = selectedSportSlug === sport.slug;

                return (
                  <button
                    key={sport.id}
                    onClick={() => handleSelectSport(sport.slug)}
                    className="flex flex-col items-center gap-1 flex-shrink-0 group relative"
                  >
                    <div
                      className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border-2',
                        isActive
                          ? 'shadow-lg'
                          : 'border-transparent group-hover:scale-105'
                      )}
                      style={{
                        backgroundColor: isActive
                          ? `${config.color}25`
                          : `${config.color}12`,
                        borderColor: isActive ? config.color : 'transparent',
                        color: config.color,
                        boxShadow: isActive
                          ? `0 0 12px ${config.color}30`
                          : undefined,
                      }}
                    >
                      {config.icon}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium leading-none truncate max-w-[56px] text-center',
                        isActive
                          ? 'text-white'
                          : 'text-[#6E7681] group-hover:text-[#C9D1D9]'
                      )}
                    >
                      {sport.name}
                    </span>
                    {/* Live badge on sport icon -- pulsing red dot */}
                    {sport.liveEventCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[14px] flex items-center justify-center px-1 bg-[#EF4444] text-white text-[8px] font-bold rounded-full leading-none">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-40" />
                        <span className="relative">{sport.liveEventCount}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollableRow>
      </div>

      {/* ================================================================ */}
      {/* Competition Pills -- horizontal scrollable tabs                  */}
      {/* ================================================================ */}
      <div className="border-b border-[#21262D] bg-[#0D1117]">
        <ScrollableRow
          scrollRef={compScrollRef}
          className="flex items-center gap-1.5 px-4 py-2"
          showArrows
        >
          {isLoadingInitial || isLoadingSportEvents ? (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <CompetitionPillSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {/* "Popular" / "All" pill */}
              <button
                onClick={() => setSelectedCompetitionId(null)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0',
                  selectedCompetitionId === null
                    ? 'bg-[#8B5CF6] text-white shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                    : 'bg-[#161B22] text-[#8B949E] hover:bg-[#1C2128] hover:text-[#C9D1D9]'
                )}
              >
                <Star className="w-3 h-3" />
                Popular
              </button>

              {competitionTabs.map((comp) => {
                const flag = countryCodeToFlag(comp.country);
                const isActive = selectedCompetitionId === comp.id;
                return (
                  <button
                    key={comp.id}
                    onClick={() =>
                      setSelectedCompetitionId(isActive ? null : comp.id)
                    }
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0',
                      isActive
                        ? 'bg-[#8B5CF6] text-white shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                        : 'bg-[#161B22] text-[#8B949E] hover:bg-[#1C2128] hover:text-[#C9D1D9]'
                    )}
                  >
                    {comp.logo ? (
                      <img
                        src={comp.logo}
                        alt=""
                        className="w-3.5 h-3.5 object-contain rounded-sm"
                      />
                    ) : flag ? (
                      <span className="text-[11px] leading-none">{flag}</span>
                    ) : null}
                    <span className="truncate max-w-[100px]">{comp.name}</span>
                  </button>
                );
              })}

              {competitionTabs.length === 0 && !isLoadingSportEvents && (
                <span className="text-[11px] text-[#484F58] px-2 italic">
                  No competitions available
                </span>
              )}
            </div>
          )}
        </ScrollableRow>
      </div>

      {/* ================================================================ */}
      {/* Live Events Banner                                               */}
      {/* ================================================================ */}
      {totalLive > 0 && selectedSportSlug === 'all' && (
        <Link
          href="/sports/live"
          className="flex items-center gap-2.5 mx-4 mt-3 px-4 py-2.5 bg-gradient-to-r from-[#EF4444]/8 via-transparent to-transparent border border-[#EF4444]/15 rounded-lg hover:border-[#EF4444]/30 transition-all duration-200 group"
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#EF4444]" />
          </span>
          <span className="text-[12px] font-bold text-[#EF4444] tabular-nums">
            {totalLive} Live
          </span>
          <span className="text-[11px] text-[#6E7681]">events happening now</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#EF4444]/40 ml-auto group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
        </Link>
      )}

      {/* ================================================================ */}
      {/* Events Section -- Competition groups in table-like layout        */}
      {/* ================================================================ */}
      <div className={cn(
        'mt-2',
        totalLive > 0 && selectedSportSlug === 'all' ? 'mt-3' : 'mt-0'
      )}>
        {isLoadingInitial || isLoadingSportEvents ? (
          <div>
            {Array.from({ length: 3 }).map((_, i) => (
              <EventGroupSkeleton key={i} />
            ))}
          </div>
        ) : groupedEvents.length > 0 ? (
          <div>
            {groupedEvents.map((group, idx) => (
              <React.Fragment key={`${group.competitionName}-${idx}`}>
                <CompetitionGroup
                  name={group.competitionName}
                  country={group.country}
                  logo={group.competitionLogo}
                  sportSlug={group.sportSlug}
                  sportName={group.sportName}
                  events={group.events}
                />
                {/* Insert Pulse banner after 2nd competition group */}
                {idx === 1 && groupedEvents.length > 2 && (
                  <PulseBanner
                    sportName={
                      selectedSportSlug === 'all'
                        ? ''
                        : selectedSport?.name || ''
                    }
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mb-4">
              <Trophy className="w-7 h-7 text-[#30363D]" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#E6EDF3] mb-1">
              No events available
            </h3>
            <p className="text-[12px] text-[#6E7681] max-w-xs leading-relaxed">
              {selectedSportSlug === 'all'
                ? 'There are no featured events at the moment. Check back soon.'
                : `No events found for ${selectedSport?.name || selectedSportSlug}. Try selecting a different sport.`}
            </p>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Browse All Sports Grid                                           */}
      {/* ================================================================ */}
      {selectedSportSlug === 'all' && !isLoadingInitial && sports.length > 0 && (
        <BrowseSportsGrid sports={sports} onSelect={handleSelectSport} />
      )}
    </div>
  );
}
