'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Zap,
  ChevronRight,
  ChevronDown,
  Lock,
  Globe,
  BarChart3,
  Star,
  Gamepad2,
  Target,
  CircleDot,
  Dumbbell,
  Swords,
  Bike,
  Search,
} from 'lucide-react';
import { cn, formatOdds, formatDate } from '@/lib/utils';
import { get } from '@/lib/api';
import { useBetSlipStore, type BetSelection } from '@/stores/betSlipStore';
import { useSocket, useSocketEvent } from '@/lib/socket';
import { LiveScoreTicker, type LiveScoreTickerEvent } from '@/components/LiveScoreTicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketSelection {
  id: string;
  name: string;
  outcome: string;
  odds: string | number;
  handicap: string | null;
  params: string | null;
  status: string;
}

interface MainMarket {
  id: string;
  name: string;
  type: string;
  selections: MarketSelection[];
}

interface FeaturedEvent {
  id: string;
  sport: string;
  sportSlug: string;
  sportIcon: string;
  competition: string;
  competitionSlug?: string;
  competitionLogo?: string | null;
  competitionCountry?: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeTeamCountry?: string | null;
  awayTeamCountry?: string | null;
  startTime: string;
  isLive?: boolean;
  scores?: { home?: number; away?: number; period?: string } | null;
  mainMarket?: MainMarket;
  spreadMarket?: MainMarket;
  totalMarket?: MainMarket;
}

interface LiveEventRaw {
  id: string;
  sport: string;
  sportSlug: string;
  sportIcon: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  homeTeamCountry?: string | null;
  awayTeamCountry?: string | null;
  scores: { home: number; away: number; period?: string };
  startTime: string;
  competition?: string;
  competitionSlug?: string;
  mainMarket?: MainMarket;
  spreadMarket?: MainMarket;
  totalMarket?: MainMarket;
  metadata?: {
    elapsed?: number | null;
    statusShort?: string;
    timer?: { tm?: number; ts?: number; ta?: number; q?: string };
    [key: string]: unknown;
  } | null;
}

interface LiveGroup {
  sport: { id: string; name: string; slug: string; icon: string };
  events: LiveEventRaw[];
}

interface SportNav {
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

interface SportCompetition {
  id: string;
  name: string;
  slug?: string;
  country?: string;
  logo?: string | null;
  events: FeaturedEvent[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPORT_ICON_CONFIG: Record<string, { icon: React.ReactNode; emoji: string; color: string }> = {
  football: { icon: <Trophy className="w-5 h-5" />, emoji: '\u26BD', color: '#22C55E' },
  soccer: { icon: <Trophy className="w-5 h-5" />, emoji: '\u26BD', color: '#22C55E' },
  basketball: { icon: <CircleDot className="w-5 h-5" />, emoji: '\uD83C\uDFC0', color: '#F97316' },
  tennis: { icon: <Target className="w-5 h-5" />, emoji: '\uD83C\uDFBE', color: '#EAB308' },
  esports: { icon: <Gamepad2 className="w-5 h-5" />, emoji: '\uD83C\uDFAE', color: '#8B5CF6' },
  baseball: { icon: <Dumbbell className="w-5 h-5" />, emoji: '\u26BE', color: '#EF4444' },
  cricket: { icon: <Target className="w-5 h-5" />, emoji: '\uD83C\uDFCF', color: '#84CC16' },
  mma: { icon: <Swords className="w-5 h-5" />, emoji: '\uD83E\uDD4A', color: '#EF4444' },
  boxing: { icon: <Dumbbell className="w-5 h-5" />, emoji: '\uD83E\uDD4B', color: '#DC2626' },
  'ice-hockey': { icon: <Swords className="w-5 h-5" />, emoji: '\uD83C\uDFD2', color: '#06B6D4' },
  rugby: { icon: <Dumbbell className="w-5 h-5" />, emoji: '\uD83C\uDFC9', color: '#A855F7' },
  volleyball: { icon: <CircleDot className="w-5 h-5" />, emoji: '\uD83C\uDFD0', color: '#3B82F6' },
  cycling: { icon: <Bike className="w-5 h-5" />, emoji: '\uD83D\uDEB4', color: '#F59E0B' },
  handball: { icon: <CircleDot className="w-5 h-5" />, emoji: '\uD83E\uDD3E', color: '#14B8A6' },
  'table-tennis': { icon: <Target className="w-5 h-5" />, emoji: '\uD83C\uDFD3', color: '#10B981' },
  'american-football': { icon: <Dumbbell className="w-5 h-5" />, emoji: '\uD83C\uDFC8', color: '#8B5CF6' },
  darts: { icon: <Target className="w-5 h-5" />, emoji: '\uD83C\uDFAF', color: '#F59E0B' },
};

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

// Mock Featured Events (fallback)
const MOCK_FEATURED: FeaturedEvent[] = [
  {
    id: 'evt-1', sport: 'Football', sportSlug: 'football', sportIcon: '\u26BD',
    competition: 'Premier League', competitionSlug: 'premier-league',
    homeTeam: 'Manchester City', awayTeam: 'Liverpool',
    startTime: new Date(Date.now() + 86400000).toISOString(),
    mainMarket: { id: 'mkt-1', name: 'Full Time Result', type: 'MONEYLINE', selections: [{ id: 's1', name: '1', outcome: 'home', odds: '2.10', handicap: null, params: null, status: 'ACTIVE' }, { id: 's2', name: 'X', outcome: 'draw', odds: '3.40', handicap: null, params: null, status: 'ACTIVE' }, { id: 's3', name: '2', outcome: 'away', odds: '3.20', handicap: null, params: null, status: 'ACTIVE' }] },
  },
  {
    id: 'evt-2', sport: 'Football', sportSlug: 'football', sportIcon: '\u26BD',
    competition: 'Premier League', competitionSlug: 'premier-league',
    homeTeam: 'Arsenal', awayTeam: 'Tottenham',
    startTime: new Date(Date.now() + 90000000).toISOString(),
    mainMarket: { id: 'mkt-1b', name: 'Full Time Result', type: 'MONEYLINE', selections: [{ id: 's1b', name: '1', outcome: 'home', odds: '1.75', handicap: null, params: null, status: 'ACTIVE' }, { id: 's2b', name: 'X', outcome: 'draw', odds: '3.80', handicap: null, params: null, status: 'ACTIVE' }, { id: 's3b', name: '2', outcome: 'away', odds: '4.20', handicap: null, params: null, status: 'ACTIVE' }] },
  },
  {
    id: 'evt-1c', sport: 'Football', sportSlug: 'football', sportIcon: '\u26BD',
    competition: 'Premier League', competitionSlug: 'premier-league',
    homeTeam: 'Aston Villa', awayTeam: 'Leeds United',
    startTime: new Date(Date.now() + 54000000).toISOString(),
    mainMarket: { id: 'mkt-1c', name: 'Full Time Result', type: 'MONEYLINE', selections: [{ id: 's1c', name: '1', outcome: 'home', odds: '1.85', handicap: null, params: null, status: 'ACTIVE' }, { id: 's2c', name: 'X', outcome: 'draw', odds: '3.64', handicap: null, params: null, status: 'ACTIVE' }, { id: 's3c', name: '2', outcome: 'away', odds: '4.46', handicap: null, params: null, status: 'ACTIVE' }] },
  },
  {
    id: 'evt-3', sport: 'Football', sportSlug: 'football', sportIcon: '\u26BD',
    competition: 'La Liga', competitionSlug: 'la-liga',
    homeTeam: 'Real Madrid', awayTeam: 'Barcelona',
    startTime: new Date(Date.now() + 172800000).toISOString(),
    mainMarket: { id: 'mkt-2', name: 'Full Time Result', type: 'MONEYLINE', selections: [{ id: 's4', name: '1', outcome: 'home', odds: '2.50', handicap: null, params: null, status: 'ACTIVE' }, { id: 's5', name: 'X', outcome: 'draw', odds: '3.10', handicap: null, params: null, status: 'ACTIVE' }, { id: 's6', name: '2', outcome: 'away', odds: '2.80', handicap: null, params: null, status: 'ACTIVE' }] },
  },
  {
    id: 'evt-4', sport: 'Basketball', sportSlug: 'basketball', sportIcon: '\uD83C\uDFC0',
    competition: 'NBA', competitionSlug: 'nba',
    homeTeam: 'LA Lakers', awayTeam: 'Golden State',
    startTime: new Date(Date.now() + 43200000).toISOString(),
    mainMarket: { id: 'mkt-3', name: 'Winner', type: 'MONEYLINE', selections: [{ id: 's7', name: '1', outcome: 'home', odds: '1.85', handicap: null, params: null, status: 'ACTIVE' }, { id: 's8', name: '2', outcome: 'away', odds: '1.95', handicap: null, params: null, status: 'ACTIVE' }] },
    spreadMarket: { id: 'mkt-3s', name: 'Spread', type: 'SPREAD', selections: [{ id: 's9', name: 'Lakers -5.5', outcome: 'home', odds: '1.91', handicap: '-5.5', params: '-5.5', status: 'ACTIVE' }, { id: 's10', name: 'Warriors +5.5', outcome: 'away', odds: '1.91', handicap: '+5.5', params: '+5.5', status: 'ACTIVE' }] },
    totalMarket: { id: 'mkt-3t', name: 'Total Points', type: 'TOTAL', selections: [{ id: 's11', name: 'Over 224.5', outcome: 'over', odds: '1.87', handicap: '224.5', params: '224.5', status: 'ACTIVE' }, { id: 's12', name: 'Under 224.5', outcome: 'under', odds: '1.95', handicap: '224.5', params: '224.5', status: 'ACTIVE' }] },
  },
];

const MOCK_LIVE: LiveEventRaw[] = [
  {
    id: 'live-1', sport: 'Football', sportSlug: 'football', sportIcon: '\u26BD',
    homeTeam: 'Arsenal', awayTeam: 'Chelsea', competition: 'Premier League',
    scores: { home: 2, away: 1, period: '2nd Half' }, startTime: '',
    mainMarket: { id: 'mkt-l1', name: 'Winner', type: 'MONEYLINE', selections: [{ id: 'sl1', name: '1', outcome: 'home', odds: '1.35', handicap: null, params: null, status: 'ACTIVE' }, { id: 'sl2', name: 'X', outcome: 'draw', odds: '4.80', handicap: null, params: null, status: 'ACTIVE' }, { id: 'sl3', name: '2', outcome: 'away', odds: '8.50', handicap: null, params: null, status: 'ACTIVE' }] },
  },
  {
    id: 'live-2', sport: 'Basketball', sportSlug: 'basketball', sportIcon: '\uD83C\uDFC0',
    homeTeam: 'Boston Celtics', awayTeam: 'Miami Heat', competition: 'NBA',
    scores: { home: 78, away: 72, period: 'Q3' }, startTime: '',
    mainMarket: { id: 'mkt-l2', name: 'Winner', type: 'MONEYLINE', selections: [{ id: 'sl4', name: '1', outcome: 'home', odds: '1.45', handicap: null, params: null, status: 'ACTIVE' }, { id: 'sl5', name: '2', outcome: 'away', odds: '2.65', handicap: null, params: null, status: 'ACTIVE' }] },
  },
  {
    id: 'live-3', sport: 'Tennis', sportSlug: 'tennis', sportIcon: '\uD83C\uDFBE',
    homeTeam: 'Djokovic N.', awayTeam: 'Alcaraz C.', competition: 'WTA Dubai',
    scores: { home: 6, away: 4, period: 'Set 2' }, startTime: '',
    mainMarket: { id: 'mkt-l3', name: 'Winner', type: 'MONEYLINE', selections: [{ id: 'sl6', name: '1', outcome: 'home', odds: '1.62', handicap: null, params: null, status: 'ACTIVE' }, { id: 'sl7', name: '2', outcome: 'away', odds: '2.25', handicap: null, params: null, status: 'ACTIVE' }] },
  },
];

const DEFAULT_SPORTS: SportNav[] = [
  { id: '1', name: 'Soccer', slug: 'football', icon: '\u26BD', eventCount: 120, liveEventCount: 8 },
  { id: '2', name: 'Basketball', slug: 'basketball', icon: '\uD83C\uDFC0', eventCount: 64, liveEventCount: 4 },
  { id: '3', name: 'Esports', slug: 'esports', icon: '\uD83C\uDFAE', eventCount: 40, liveEventCount: 5 },
  { id: '4', name: 'Tennis', slug: 'tennis', icon: '\uD83C\uDFBE', eventCount: 48, liveEventCount: 6 },
  { id: '5', name: 'Cricket', slug: 'cricket', icon: '\uD83C\uDFCF', eventCount: 22, liveEventCount: 2 },
  { id: '6', name: 'Baseball', slug: 'baseball', icon: '\u26BE', eventCount: 28, liveEventCount: 3 },
  { id: '7', name: 'MMA', slug: 'mma', icon: '\uD83E\uDD4A', eventCount: 16, liveEventCount: 1 },
  { id: '8', name: 'Ice Hockey', slug: 'ice-hockey', icon: '\uD83C\uDFD2', eventCount: 32, liveEventCount: 2 },
  { id: '9', name: 'Rugby', slug: 'rugby', icon: '\uD83C\uDFC9', eventCount: 14, liveEventCount: 0 },
  { id: '10', name: 'Boxing', slug: 'boxing', icon: '\uD83E\uDD4B', eventCount: 8, liveEventCount: 0 },
  { id: '11', name: 'Volleyball', slug: 'volleyball', icon: '\uD83C\uDFD0', eventCount: 18, liveEventCount: 1 },
  { id: '12', name: 'Darts', slug: 'darts', icon: '\uD83C\uDFAF', eventCount: 6, liveEventCount: 0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function countryCodeToFlag(countryCode?: string): string {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();
  if (code.length !== 2) {
    const nameToCode: Record<string, string> = {
      england: 'GB', 'united kingdom': 'GB', spain: 'ES', italy: 'IT',
      germany: 'DE', france: 'FR', brazil: 'BR', argentina: 'AR',
      portugal: 'PT', netherlands: 'NL', belgium: 'BE', turkey: 'TR',
      usa: 'US', 'united states': 'US', canada: 'CA', australia: 'AU',
      japan: 'JP', 'south korea': 'KR', china: 'CN', russia: 'RU',
      mexico: 'MX', sweden: 'SE', norway: 'NO', denmark: 'DK',
      finland: 'FI', switzerland: 'CH', austria: 'AT', scotland: 'GB',
      international: '', world: '',
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
  if (diffMs < 0) return { label: formatDate(startTime) };

  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const isTomorrow = date.getDate() === now.getDate() + 1 && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) return { label: 'Today', sublabel: time };
  if (isTomorrow) return { label: 'Tomorrow', sublabel: time };
  return {
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sublabel: time,
  };
}

// Determine if a sport uses basketball-style layout (spread/total/moneyline columns)
function isBasketballStyleSport(sportSlug: string): boolean {
  return ['basketball', 'american-football', 'baseball', 'ice-hockey'].includes(sportSlug);
}

// ---------------------------------------------------------------------------
// TeamCrest Component (small 16px circle with logo or letter)
// ---------------------------------------------------------------------------

function TeamCrest({
  name,
  logo,
  country,
  sportSlug,
}: {
  name: string;
  logo?: string | null;
  country?: string | null;
  sportSlug?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (logo && !imgError) {
    return (
      <img
        src={logo}
        alt=""
        className="w-4 h-4 object-contain flex-shrink-0 rounded-full"
        onError={() => setImgError(true)}
      />
    );
  }

  if (sportSlug && INDIVIDUAL_SPORTS.has(sportSlug) && country) {
    const flag = countryToFlag(country);
    if (flag) {
      return <span className="w-4 h-4 flex items-center justify-center text-[10px] leading-none flex-shrink-0">{flag}</span>;
    }
  }

  const letter = (name || '?').charAt(0).toUpperCase();
  const bgColor = getAvatarColor(name || '');

  return (
    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
      <span className="text-[8px] font-bold text-white leading-none">{letter}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SportCircleSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div className="w-14 h-14 rounded-full bg-[#1A1A2E] animate-pulse" />
      <div className="h-2.5 w-10 bg-[#1A1A2E] animate-pulse rounded" />
    </div>
  );
}

function CompetitionPillSkeleton() {
  return <div className="flex-shrink-0 h-8 w-32 bg-[#1A1A2E] animate-pulse rounded-full" />;
}

function EventGroupSkeleton() {
  return (
    <div className="bg-[#111127] overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2.5 border-b border-[#1A1A2E]">
        <div className="h-5 w-5 rounded-full bg-[#1A1A2E] animate-pulse" />
        <div className="h-4 w-32 bg-[#1A1A2E] animate-pulse rounded" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-[#1A1A2E]/50 flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-28 bg-[#1A1A2E] animate-pulse rounded" />
            <div className="h-3.5 w-24 bg-[#1A1A2E] animate-pulse rounded" />
            <div className="h-3 w-20 bg-[#1A1A2E] animate-pulse rounded" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-9 w-[56px] bg-[#1A1A2E] animate-pulse rounded" />
            <div className="h-9 w-[56px] bg-[#1A1A2E] animate-pulse rounded" />
            <div className="h-9 w-[56px] bg-[#1A1A2E] animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OddsButton (Cloudbet style: yellow-green text on dark bg)
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
  label,
  compact,
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
  label?: string;
  compact?: boolean;
}) {
  const { addSelection, hasSelection } = useBetSlipStore();
  const isSelected = hasSelection(eventId, marketId, outcomeName);
  const isSuspended = status === 'suspended' || status === 'closed';

  if (isSuspended) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded bg-[#0D0D1A]/80',
        compact ? 'w-[56px] h-8' : 'w-[56px] sm:w-[62px] h-9'
      )}>
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
        'flex flex-col items-center justify-center rounded transition-all duration-150 font-mono',
        compact ? 'w-[56px] h-8' : 'w-[56px] sm:w-[62px] h-9',
        isSelected
          ? 'bg-[#BFFF00]/15 text-[#BFFF00] ring-1 ring-[#BFFF00]/50'
          : 'bg-[#0D0D1A]/80 text-[#BFFF00] hover:bg-[#BFFF00]/10 active:scale-95'
      )}
    >
      {label && <span className="text-[9px] text-[#8B949E] leading-none mb-0.5">{label}</span>}
      <span className="text-[13px] font-semibold leading-none">{formatOdds(odds)}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Soccer-style MatchRow (Cloudbet mobile: teams left, 3 odds right)
// ---------------------------------------------------------------------------

function SoccerMatchRow({
  event,
  sportSlug,
  sportName,
}: {
  event: FeaturedEvent;
  sportSlug: string;
  sportName: string;
}) {
  const isLive = !!event.isLive;
  const scores = event.scores;
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
      href={`/sports/${sportSlug}/${event.id}`}
      className="flex items-stretch gap-2 px-4 py-2.5 border-b border-[#1A1A2E]/60 last:border-0 hover:bg-[#1A1A2E]/30 transition-colors"
    >
      {/* Left column: Teams + time */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-[3px]">
        {/* Home team */}
        <div className="flex items-center gap-2 min-w-0">
          <TeamCrest logo={event.homeTeamLogo} name={event.homeTeam} country={event.homeTeamCountry} sportSlug={sportSlug} />
          <span className={cn(
            'text-[13px] truncate leading-tight',
            isLive && scores && typeof scores.home === 'number' && scores.home > (scores.away ?? 0)
              ? 'text-white font-semibold' : 'text-[#C9D1D9]'
          )}>
            {event.homeTeam}
          </span>
          {isLive && scores && typeof scores.home === 'number' && (
            <span className="text-[13px] font-mono font-bold text-white ml-auto mr-2 flex-shrink-0">{scores.home}</span>
          )}
        </div>
        {/* Away team */}
        <div className="flex items-center gap-2 min-w-0">
          <TeamCrest logo={event.awayTeamLogo} name={event.awayTeam} country={event.awayTeamCountry} sportSlug={sportSlug} />
          <span className={cn(
            'text-[13px] truncate leading-tight',
            isLive && scores && typeof scores.away === 'number' && scores.away > (scores.home ?? 0)
              ? 'text-white font-semibold' : 'text-[#C9D1D9]'
          )}>
            {event.awayTeam}
          </span>
          {isLive && scores && typeof scores.away === 'number' && (
            <span className="text-[13px] font-mono font-bold text-white ml-auto mr-2 flex-shrink-0">{scores.away}</span>
          )}
        </div>
        {/* Time / Live badge */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {isLive ? (
            <div className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
              </span>
              <span className="text-[11px] font-semibold text-[#10B981]">
                {liveMinute !== null ? `${liveMinute}'` : 'Live'}
              </span>
            </div>
          ) : (
            <>
              <span className="text-[11px] text-[#6B7280]">
                {timeInfo.label}{timeInfo.sublabel && ` \u2022 ${timeInfo.sublabel}`}
              </span>
              <span className="text-[9px] font-bold text-[#6B7280] bg-[#1A1A2E] px-1 py-0.5 rounded ml-1">
                BB
              </span>
            </>
          )}
        </div>
      </div>

      {/* Odds column */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {market && market.selections.length > 0 ? (
          market.selections.map((sel) => (
            <OddsButton
              key={sel.id || sel.name}
              selectionId={sel.id}
              eventId={event.id}
              eventName={eventName}
              sportId={sportSlug}
              sportName={sportName}
              marketId={market.id}
              marketName={market.name}
              outcomeName={sel.name}
              odds={typeof sel.odds === 'string' ? parseFloat(sel.odds) : sel.odds}
              status={sel.status}
              startTime={event.startTime}
              isLive={isLive}
            />
          ))
        ) : (
          <span className="text-[11px] text-[#484F58] italic px-2">--</span>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Basketball-style MatchRow (Spread | Total | Money Line)
// ---------------------------------------------------------------------------

function BasketballMatchRow({
  event,
  sportSlug,
  sportName,
}: {
  event: FeaturedEvent;
  sportSlug: string;
  sportName: string;
}) {
  const isLive = !!event.isLive;
  const scores = event.scores;
  const eventName = `${event.homeTeam} vs ${event.awayTeam}`;

  const spread = event.spreadMarket;
  const total = event.totalMarket;
  const ml = event.mainMarket;

  const homeSel = spread?.selections.find(s => s.outcome === 'home');
  const awaySel = spread?.selections.find(s => s.outcome === 'away');
  const overSel = total?.selections.find(s => s.outcome === 'over');
  const underSel = total?.selections.find(s => s.outcome === 'under');
  const homeML = ml?.selections.find(s => s.outcome === 'home');
  const awayML = ml?.selections.find(s => s.outcome === 'away');

  const timeInfo = formatMatchTime(event.startTime);

  return (
    <Link
      href={`/sports/${sportSlug}/${event.id}`}
      className="block px-4 py-2.5 border-b border-[#1A1A2E]/60 last:border-0 hover:bg-[#1A1A2E]/30 transition-colors"
    >
      {/* Home team row */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamCrest logo={event.homeTeamLogo} name={event.homeTeam} country={event.homeTeamCountry} sportSlug={sportSlug} />
          <span className="text-[13px] text-[#C9D1D9] truncate">{event.homeTeam}</span>
          {isLive && scores && typeof scores.home === 'number' && (
            <span className="text-[13px] font-mono font-bold text-white ml-1 flex-shrink-0">{scores.home}</span>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {/* Spread home */}
          {homeSel ? (
            <div className="flex flex-col items-center" onClick={e => e.preventDefault()}>
              <span className="text-[9px] text-[#8B949E] mb-0.5">{homeSel.handicap || ''}</span>
              <OddsButton
                selectionId={homeSel.id}
                eventId={event.id}
                eventName={eventName}
                sportId={sportSlug}
                sportName={sportName}
                marketId={spread!.id}
                marketName={spread!.name}
                outcomeName={homeSel.name}
                odds={typeof homeSel.odds === 'string' ? parseFloat(homeSel.odds) : homeSel.odds}
                status={homeSel.status}
                startTime={event.startTime}
                isLive={isLive}
                compact
              />
            </div>
          ) : <div className="w-[56px]" />}

          {/* Total over */}
          {overSel ? (
            <div className="flex flex-col items-center" onClick={e => e.preventDefault()}>
              <span className="text-[9px] text-[#8B949E] mb-0.5">O {overSel.handicap || ''}</span>
              <OddsButton
                selectionId={overSel.id}
                eventId={event.id}
                eventName={eventName}
                sportId={sportSlug}
                sportName={sportName}
                marketId={total!.id}
                marketName={total!.name}
                outcomeName={overSel.name}
                odds={typeof overSel.odds === 'string' ? parseFloat(overSel.odds) : overSel.odds}
                status={overSel.status}
                startTime={event.startTime}
                isLive={isLive}
                compact
              />
            </div>
          ) : <div className="w-[56px]" />}

          {/* ML home */}
          {homeML ? (
            <div className="flex flex-col items-center" onClick={e => e.preventDefault()}>
              <span className="text-[9px] text-[#8B949E] mb-0.5">&nbsp;</span>
              <OddsButton
                selectionId={homeML.id}
                eventId={event.id}
                eventName={eventName}
                sportId={sportSlug}
                sportName={sportName}
                marketId={ml!.id}
                marketName={ml!.name}
                outcomeName={homeML.name}
                odds={typeof homeML.odds === 'string' ? parseFloat(homeML.odds) : homeML.odds}
                status={homeML.status}
                startTime={event.startTime}
                isLive={isLive}
                compact
              />
            </div>
          ) : <div className="w-[56px]" />}
        </div>
      </div>

      {/* Away team row */}
      <div className="flex items-center gap-2 mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamCrest logo={event.awayTeamLogo} name={event.awayTeam} country={event.awayTeamCountry} sportSlug={sportSlug} />
          <span className="text-[13px] text-[#C9D1D9] truncate">{event.awayTeam}</span>
          {isLive && scores && typeof scores.away === 'number' && (
            <span className="text-[13px] font-mono font-bold text-white ml-1 flex-shrink-0">{scores.away}</span>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {/* Spread away */}
          {awaySel ? (
            <div className="flex flex-col items-center" onClick={e => e.preventDefault()}>
              <span className="text-[9px] text-[#8B949E] mb-0.5">{awaySel.handicap || ''}</span>
              <OddsButton
                selectionId={awaySel.id}
                eventId={event.id}
                eventName={eventName}
                sportId={sportSlug}
                sportName={sportName}
                marketId={spread!.id}
                marketName={spread!.name}
                outcomeName={awaySel.name}
                odds={typeof awaySel.odds === 'string' ? parseFloat(awaySel.odds) : awaySel.odds}
                status={awaySel.status}
                startTime={event.startTime}
                isLive={isLive}
                compact
              />
            </div>
          ) : <div className="w-[56px]" />}

          {/* Total under */}
          {underSel ? (
            <div className="flex flex-col items-center" onClick={e => e.preventDefault()}>
              <span className="text-[9px] text-[#8B949E] mb-0.5">U {underSel.handicap || ''}</span>
              <OddsButton
                selectionId={underSel.id}
                eventId={event.id}
                eventName={eventName}
                sportId={sportSlug}
                sportName={sportName}
                marketId={total!.id}
                marketName={total!.name}
                outcomeName={underSel.name}
                odds={typeof underSel.odds === 'string' ? parseFloat(underSel.odds) : underSel.odds}
                status={underSel.status}
                startTime={event.startTime}
                isLive={isLive}
                compact
              />
            </div>
          ) : <div className="w-[56px]" />}

          {/* ML away */}
          {awayML ? (
            <div className="flex flex-col items-center" onClick={e => e.preventDefault()}>
              <span className="text-[9px] text-[#8B949E] mb-0.5">&nbsp;</span>
              <OddsButton
                selectionId={awayML.id}
                eventId={event.id}
                eventName={eventName}
                sportId={sportSlug}
                sportName={sportName}
                marketId={ml!.id}
                marketName={ml!.name}
                outcomeName={awayML.name}
                odds={typeof awayML.odds === 'string' ? parseFloat(awayML.odds) : awayML.odds}
                status={awayML.status}
                startTime={event.startTime}
                isLive={isLive}
                compact
              />
            </div>
          ) : <div className="w-[56px]" />}
        </div>
      </div>

      {/* Time row */}
      <div className="flex items-center gap-1.5 mt-0.5 pl-6">
        {isLive ? (
          <div className="flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
            </span>
            <span className="text-[11px] font-semibold text-[#10B981]">
              {scores?.period || 'Live'}
            </span>
          </div>
        ) : (
          <>
            <span className="text-[11px] text-[#6B7280]">
              {timeInfo.label}{timeInfo.sublabel && ` \u2022 ${timeInfo.sublabel}`}
            </span>
            <span className="text-[9px] font-bold text-[#6B7280] bg-[#1A1A2E] px-1 py-0.5 rounded ml-1">BB</span>
          </>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// CompetitionGroup (Cloudbet-style: header + market labels + event rows)
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
  events: FeaturedEvent[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const flag = countryCodeToFlag(country);
  const isBball = isBasketballStyleSport(sportSlug);

  if (events.length === 0) return null;

  const firstMarket = events[0]?.mainMarket;
  const marketHeaders = useMemo(() => {
    if (isBball) return ['Spread', 'Total', 'Money Line'];
    if (!firstMarket?.selections) return [];
    const len = firstMarket.selections.length;
    if (len === 3) return ['1', 'X', '2'];
    if (len === 2) return ['1', '2'];
    return firstMarket.selections.map((s) => s.name?.length <= 4 ? s.name : s.name?.charAt(0) || '');
  }, [firstMarket, isBball]);

  const marketName = isBball ? '' : (firstMarket?.name || 'Full Time Result');

  return (
    <div className="bg-[#111127] overflow-hidden">
      {/* Competition header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#1A1A2E]/40 transition-colors"
      >
        {logo ? (
          <img src={logo} alt="" className="w-5 h-5 object-contain flex-shrink-0 rounded-full" />
        ) : flag ? (
          <span className="text-sm flex-shrink-0">{flag}</span>
        ) : (
          <Globe className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
        )}
        <span className="text-[14px] font-bold text-white truncate">{name}</span>
        <ChevronDown className={cn(
          'w-4 h-4 text-[#6B7280] ml-auto flex-shrink-0 transition-transform duration-200',
          isCollapsed && '-rotate-90'
        )} />
      </button>

      {/* Market header row */}
      {!isCollapsed && (
        <div className="flex items-center px-4 py-1.5 border-t border-b border-[#1A1A2E]/60">
          <div className="flex-1 flex items-center gap-1.5">
            {marketName && (
              <>
                <span className="text-[11px] text-[#6B7280] font-medium truncate">{marketName}</span>
                <ChevronDown className="w-3 h-3 text-[#484F58] flex-shrink-0" />
                <BarChart3 className="w-3 h-3 text-[#484F58] flex-shrink-0 ml-0.5" />
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {marketHeaders.map((h, i) => (
              <span key={i} className={cn(
                'text-center text-[11px] text-[#6B7280] font-semibold',
                isBball ? 'w-[56px]' : 'w-[56px] sm:w-[62px]'
              )}>{h}</span>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {!isCollapsed && (
        <div>
          {events.map((event) => (
            isBball ? (
              <BasketballMatchRow key={event.id} event={event} sportSlug={sportSlug} sportName={sportName} />
            ) : (
              <SoccerMatchRow key={event.id} event={event} sportSlug={sportSlug} sportName={sportName} />
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bet Builder Promo Banner (inline between competition groups)
// ---------------------------------------------------------------------------

function BetBuilderBanner() {
  return (
    <Link
      href="/sports"
      className="block mx-0 my-0 relative overflow-hidden"
    >
      <div className="bg-gradient-to-r from-[#1A1035] via-[#15112B] to-[#111127] px-4 py-4 relative">
        {/* Decorative 3D text background */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
          <span className="text-4xl font-black text-[#8B5CF6] tracking-tight" style={{ textShadow: '2px 2px 0 #6D28D9, 4px 4px 0 #4C1D95' }}>
            BET BUILDER
          </span>
        </div>
        <div className="relative z-10">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A78BFA] mb-1">BET BUILDER</div>
          <p className="text-[13px] text-[#C9D1D9] leading-snug mb-2">
            Build bigger odds with same game parlays
          </p>
          <span className="text-[12px] font-semibold text-[#BFFF00] flex items-center gap-1">
            Browse now
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Homepage Component
// ---------------------------------------------------------------------------

export default function HomePage() {
  // --- State ---
  const [sports, setSports] = useState<SportNav[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<FeaturedEvent[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEventRaw[]>([]);
  const [popularCompetitions, setPopularCompetitions] = useState<Competition[]>([]);
  const [sportCompetitions, setSportCompetitions] = useState<SportCompetition[]>([]);

  const [selectedSportSlug, setSelectedSportSlug] = useState<string>('football');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSportEvents, setIsLoadingSportEvents] = useState(false);

  const sportScrollRef = useRef<HTMLDivElement>(null);
  const compScrollRef = useRef<HTMLDivElement>(null);

  // --- Initial data fetch ---
  useEffect(() => {
    async function fetchData() {
      try {
        const [sportsRes, eventsRes, liveRes, compsRes] = await Promise.allSettled([
          get<{ sports: SportNav[] }>('/sports'),
          get<{ events: FeaturedEvent[] }>('/events/featured'),
          get<{ groups: LiveGroup[] }>('/events/live'),
          get<Competition[]>('/sports/popular-competitions'),
        ]);

        if (sportsRes.status === 'fulfilled' && Array.isArray(sportsRes.value?.sports)) {
          setSports(sportsRes.value.sports);
        } else {
          setSports(DEFAULT_SPORTS);
        }

        if (eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value?.events)) {
          setFeaturedEvents(eventsRes.value.events);
        } else {
          setFeaturedEvents(MOCK_FEATURED);
        }

        if (liveRes.status === 'fulfilled' && Array.isArray(liveRes.value?.groups)) {
          const flatLive = liveRes.value.groups.flatMap((g) => g.events || []);
          setLiveEvents(flatLive);
        } else {
          setLiveEvents(MOCK_LIVE);
        }

        if (compsRes.status === 'fulfilled') {
          const data = compsRes.value;
          setPopularCompetitions(Array.isArray(data) ? data : (data as any)?.competitions || []);
        }
      } catch {
        setSports(DEFAULT_SPORTS);
        setFeaturedEvents(MOCK_FEATURED);
        setLiveEvents(MOCK_LIVE);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
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
        if (!cancelled) setSportCompetitions([]);
      } finally {
        if (!cancelled) setIsLoadingSportEvents(false);
      }
    }

    fetchSportCompetitions();
    return () => { cancelled = true; };
  }, [selectedSportSlug]);

  // --- Real-time score updates ---
  useSocketEvent('event:scoreUpdate', (data) => {
    setLiveEvents((prev) =>
      prev.map((e) =>
        e.id === data.eventId
          ? { ...e, scores: { ...e.scores, home: data.score?.home ?? e.scores?.home, away: data.score?.away ?? e.scores?.away } }
          : e
      )
    );
  });

  // --- Derived data ---
  const totalLive = sports.reduce((sum, s) => sum + s.liveEventCount, 0);
  const selectedSport = sports.find((s) => s.slug === selectedSportSlug);

  // Map live events to LiveScoreTicker format
  const tickerEvents: LiveScoreTickerEvent[] = useMemo(() => {
    return liveEvents.map((evt) => ({
      eventId: evt.id,
      homeTeam: evt.homeTeam,
      awayTeam: evt.awayTeam,
      homeScore: evt.scores?.home ?? 0,
      awayScore: evt.scores?.away ?? 0,
      period: evt.scores?.period || evt.metadata?.statusShort || '1H',
      timer: evt.metadata?.timer?.tm ?? evt.metadata?.elapsed ?? null,
      timerSeconds: evt.metadata?.timer?.ts ?? null,
      sportSlug: evt.sportSlug,
      competitionName: evt.competition,
      startTime: evt.startTime || undefined,
    }));
  }, [liveEvents]);

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
      const groups: Record<string, {
        competitionName: string;
        competitionLogo?: string | null;
        sportSlug: string;
        sportName: string;
        country?: string;
        events: FeaturedEvent[];
      }> = {};

      const filteredMatches = selectedCompetitionId
        ? featuredEvents.filter((m) =>
            m.competitionSlug === selectedCompetitionId ||
            m.competition === popularCompetitions.find((c) => c.id === selectedCompetitionId)?.name
          )
        : featuredEvents;

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
  }, [selectedSportSlug, selectedCompetitionId, featuredEvents, sportCompetitions, selectedSport, popularCompetitions]);

  // --- Sport select handler ---
  const handleSelectSport = useCallback((slug: string) => {
    setSelectedSportSlug(slug);
    if (compScrollRef.current) compScrollRef.current.scrollLeft = 0;
  }, []);

  // --- Render ---
  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#0D0D1A' }}>

      {/* ================================================================== */}
      {/* SECTION 1: SEARCH BAR                                              */}
      {/* ================================================================== */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1A1A2E] text-[#C9D1D9] text-[14px] pl-10 pr-4 py-2.5 rounded-lg border-none outline-none focus:ring-1 focus:ring-[#BFFF00]/30 placeholder-[#6B7280] transition-all"
          />
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 2: SPORT ICON CIRCLES (horizontal scroll)                  */}
      {/* ================================================================== */}
      <div className="px-1 pb-2">
        <div
          ref={sportScrollRef}
          className="flex items-start gap-3 py-2 overflow-x-auto scrollbar-hide px-2"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SportCircleSkeleton key={i} />)
          ) : (
            <>
              {/* All Sports */}
              <button
                onClick={() => handleSelectSport('all')}
                className="flex flex-col items-center gap-1 flex-shrink-0 w-[64px] group"
              >
                <div className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 border-2',
                  selectedSportSlug === 'all'
                    ? 'border-[#BFFF00] bg-[#BFFF00]/10 shadow-[0_0_12px_rgba(191,255,0,0.2)]'
                    : 'border-transparent bg-[#1A1A2E] group-hover:bg-[#1A1A2E]/80'
                )}>
                  <Zap className={cn(
                    'w-6 h-6',
                    selectedSportSlug === 'all' ? 'text-[#BFFF00]' : 'text-[#8B949E]'
                  )} />
                </div>
                <span className={cn(
                  'text-[10px] font-medium truncate max-w-full leading-tight text-center',
                  selectedSportSlug === 'all' ? 'text-[#BFFF00]' : 'text-[#8B949E]'
                )}>
                  All
                </span>
              </button>

              {/* Individual sports */}
              {(sports.length > 0 ? sports : DEFAULT_SPORTS).map((sport) => {
                const config = SPORT_ICON_CONFIG[sport.slug];
                const isActive = selectedSportSlug === sport.slug;
                const emoji = config?.emoji || sport.icon || '\u26BD';

                return (
                  <button
                    key={sport.id}
                    onClick={() => handleSelectSport(sport.slug)}
                    className="flex flex-col items-center gap-1 flex-shrink-0 w-[64px] group"
                  >
                    <div
                      className={cn(
                        'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 border-2',
                        isActive
                          ? 'border-[#BFFF00] shadow-[0_0_12px_rgba(191,255,0,0.2)]'
                          : 'border-transparent group-hover:scale-105'
                      )}
                      style={{
                        backgroundColor: isActive ? `${config?.color || '#8B5CF6'}25` : '#1A1A2E',
                      }}
                    >
                      <span className="text-2xl leading-none">{emoji}</span>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium truncate max-w-full leading-tight text-center',
                      isActive ? 'text-[#BFFF00]' : 'text-[#8B949E] group-hover:text-[#C9D1D9]'
                    )}>
                      {sport.name}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 3: COMPETITION TABS (horizontal scroll pills)              */}
      {/* ================================================================== */}
      <div className="mb-2">
        <div
          ref={compScrollRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-3 py-1"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {isLoading || isLoadingSportEvents ? (
            Array.from({ length: 6 }).map((_, i) => <CompetitionPillSkeleton key={i} />)
          ) : (
            <>
              {/* "Popular" pill */}
              <button
                onClick={() => setSelectedCompetitionId(null)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0',
                  selectedCompetitionId === null
                    ? 'text-[#BFFF00] bg-transparent'
                    : 'text-[#6B7280] bg-transparent hover:text-[#C9D1D9]'
                )}
              >
                <Star className="w-3 h-3" />
                Popular
                {selectedCompetitionId === null && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BFFF00] rounded-full" />
                )}
              </button>

              {competitionTabs.map((comp) => {
                const isActive = selectedCompetitionId === comp.id;
                return (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedCompetitionId(isActive ? null : comp.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 relative',
                      isActive
                        ? 'text-[#BFFF00]'
                        : 'text-[#6B7280] hover:text-[#C9D1D9]'
                    )}
                  >
                    {comp.logo ? (
                      <img src={comp.logo} alt="" className="w-4 h-4 object-contain rounded-full" />
                    ) : null}
                    <span className="truncate max-w-[140px]">{comp.name}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#BFFF00] rounded-full" />
                    )}
                  </button>
                );
              })}

              {competitionTabs.length === 0 && !isLoadingSportEvents && (
                <span className="text-[11px] text-[#484F58] px-2 italic">No competitions</span>
              )}
            </>
          )}
        </div>
        {/* Subtle separator line */}
        <div className="h-px bg-[#1A1A2E] mx-3" />
      </div>

      {/* ================================================================== */}
      {/* Live Score Ticker                                                   */}
      {/* ================================================================== */}
      {!isLoading && tickerEvents.length > 0 && (
        <div className="mb-2">
          <LiveScoreTicker
            events={tickerEvents}
            cardVariant="compact"
            className="rounded-none border-0 overflow-hidden"
          />
        </div>
      )}

      {/* ================================================================== */}
      {/* SECTION 4+: COMPETITION EVENTS                                     */}
      {/* ================================================================== */}
      <div className="space-y-0">
        {isLoading || isLoadingSportEvents ? (
          <div className="space-y-2 px-0">
            {Array.from({ length: 3 }).map((_, i) => <EventGroupSkeleton key={i} />)}
          </div>
        ) : groupedEvents.length > 0 ? (
          <>
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

                {/* Insert Bet Builder banner after 2nd group */}
                {idx === 1 && groupedEvents.length > 2 && (
                  <BetBuilderBanner />
                )}

                {/* Thin separator between groups */}
                {idx < groupedEvents.length - 1 && idx !== 1 && (
                  <div className="h-1.5 bg-[#0D0D1A]" />
                )}
                {idx === 1 && groupedEvents.length > 2 && (
                  <div className="h-1.5 bg-[#0D0D1A]" />
                )}
              </React.Fragment>
            ))}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-[#1A1A2E] flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-[#2A2A40]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No events available</h3>
            <p className="text-[13px] text-[#6B7280] max-w-xs">
              {selectedSportSlug === 'all'
                ? 'There are no featured events at the moment. Check back soon.'
                : `No events found for ${selectedSport?.name || selectedSportSlug}. Try selecting a different sport.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
