'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Zap,
  ChevronRight,
  ChevronLeft,
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
  ArrowRight,
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
  scores?: { home?: number; away?: number } | null;
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

const SPORT_ICON_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  football: { icon: <Trophy className="w-5 h-5" />, color: '#22C55E' },
  soccer: { icon: <Trophy className="w-5 h-5" />, color: '#22C55E' },
  basketball: { icon: <CircleDot className="w-5 h-5" />, color: '#F97316' },
  tennis: { icon: <Target className="w-5 h-5" />, color: '#EAB308' },
  esports: { icon: <Gamepad2 className="w-5 h-5" />, color: '#8B5CF6' },
  baseball: { icon: <Dumbbell className="w-5 h-5" />, color: '#EF4444' },
  cricket: { icon: <Target className="w-5 h-5" />, color: '#84CC16' },
  mma: { icon: <Swords className="w-5 h-5" />, color: '#EF4444' },
  boxing: { icon: <Dumbbell className="w-5 h-5" />, color: '#DC2626' },
  'ice-hockey': { icon: <Swords className="w-5 h-5" />, color: '#06B6D4' },
  rugby: { icon: <Dumbbell className="w-5 h-5" />, color: '#A855F7' },
  volleyball: { icon: <CircleDot className="w-5 h-5" />, color: '#3B82F6' },
  cycling: { icon: <Bike className="w-5 h-5" />, color: '#F59E0B' },
  handball: { icon: <CircleDot className="w-5 h-5" />, color: '#14B8A6' },
  'table-tennis': { icon: <Target className="w-5 h-5" />, color: '#10B981' },
  'american-football': { icon: <Dumbbell className="w-5 h-5" />, color: '#8B5CF6' },
  darts: { icon: <Target className="w-5 h-5" />, color: '#F59E0B' },
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

const LIVE_SPORT_PILLS = ['Tennis', 'FIFA', 'Ice Hockey', 'Basketball', 'Volleyball'];

const LIVE_SPORT_PILL_SLUGS: Record<string, string> = {
  'Tennis': 'tennis',
  'FIFA': 'football',
  'Ice Hockey': 'ice-hockey',
  'Basketball': 'basketball',
  'Volleyball': 'volleyball',
};

const SPORT_COLORS: Record<string, string> = {
  football: '#10B981',
  basketball: '#F59E0B',
  'ice-hockey': '#3B82F6',
  'american-football': '#8B5CF6',
  handball: '#EC4899',
  baseball: '#EF4444',
  rugby: '#F97316',
  volleyball: '#06B6D4',
  tennis: '#84CC16',
  cricket: '#A78BFA',
};

// ---------------------------------------------------------------------------
// Mock data for sharpest bettors
// ---------------------------------------------------------------------------

const MOCK_SHARPEST_BETTORS = [
  { rank: 1, username: 'CryptoKing99', roi: 24.5, profit: 12450, badge: '#F59E0B' },
  { rank: 2, username: 'SharpEdge', roi: 19.2, profit: 8920, badge: '#C0C0C0' },
  { rank: 3, username: 'BetWizard', roi: 16.8, profit: 7340, badge: '#CD7F32' },
  { rank: 4, username: 'OddsHunter', roi: 14.1, profit: 5680, badge: '#8B5CF6' },
  { rank: 5, username: 'ValuePlay', roi: 11.7, profit: 4210, badge: '#3B82F6' },
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
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (isToday) return { label: 'Today', sublabel: time };
  if (isTomorrow) return { label: 'Tomorrow', sublabel: time };
  return {
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sublabel: time,
  };
}

// ---------------------------------------------------------------------------
// TeamIcon Component
// ---------------------------------------------------------------------------

function TeamIcon({
  name,
  logo,
  country,
  sportSlug,
  size = 'sm',
}: {
  name: string;
  logo?: string | null;
  country?: string | null;
  sportSlug?: string;
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

  if (sportSlug && INDIVIDUAL_SPORTS.has(sportSlug) && country) {
    const flag = countryToFlag(country);
    if (flag) {
      return <span className={`${sizeClass} flex items-center justify-center text-xs leading-none flex-shrink-0`}>{flag}</span>;
    }
  }

  const letter = (name || '?').charAt(0).toUpperCase();
  const bgColor = getAvatarColor(name || '');

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: bgColor }}>
      <span className={`${textSize} font-bold text-white leading-none`}>{letter}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SportIconSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px]">
      <div className="w-12 h-12 skeleton rounded-full" />
      <div className="h-3 w-10 skeleton rounded" />
    </div>
  );
}

function CompetitionPillSkeleton() {
  return <div className="flex-shrink-0 h-8 w-36 skeleton rounded-full" />;
}

function EventGroupSkeleton() {
  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-[#21262D]">
        <div className="h-5 w-5 skeleton rounded" />
        <div className="h-4 w-32 skeleton rounded" />
      </div>
      <div className="px-3 py-1.5 flex items-center justify-end gap-2 border-b border-[#21262D]/50">
        <div className="h-3 w-8 skeleton rounded" />
        <div className="h-3 w-8 skeleton rounded" />
        <div className="h-3 w-8 skeleton rounded" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-3 py-2.5 border-b border-[#21262D]/30 last:border-0 flex items-center gap-3">
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-28 skeleton rounded" />
            <div className="h-3.5 w-24 skeleton rounded" />
            <div className="h-3 w-16 skeleton rounded" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-9 w-[52px] skeleton rounded-md" />
            <div className="h-9 w-[52px] skeleton rounded-md" />
            <div className="h-9 w-[52px] skeleton rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OddsButton (Cloudbet style: green text on dark bg)
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
      <div className="flex items-center justify-center w-[52px] sm:w-[60px] h-9 rounded-md bg-[#1C2128] border border-[#21262D]">
        <Lock className="w-3.5 h-3.5 text-[#484F58]" />
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
        'flex items-center justify-center w-[52px] sm:w-[60px] h-9 rounded-md border transition-all duration-150 font-mono text-[13px] font-semibold',
        isSelected
          ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
          : 'border-[#21262D] bg-[#1C2128] text-[#10B981] hover:border-[#10B981]/40 hover:bg-[#10B981]/5 active:scale-95'
      )}
    >
      {formatOdds(odds)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MatchRow (Cloudbet-style: teams + time left, odds right)
// ---------------------------------------------------------------------------

function MatchRow({
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
      className="flex items-stretch gap-2 px-3 py-2.5 border-b border-[#21262D]/40 last:border-0 hover:bg-[#1C2128]/50 transition-colors"
    >
      {/* Left column: Teams + time */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamIcon logo={event.homeTeamLogo} name={event.homeTeam} country={event.homeTeamCountry} sportSlug={sportSlug} />
          <span className={cn(
            'text-[13px] truncate leading-tight',
            isLive && scores && typeof scores.home === 'number' && scores.home > (scores.away ?? 0)
              ? 'text-[#E6EDF3] font-semibold' : 'text-[#C9D1D9]'
          )}>
            {event.homeTeam}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <TeamIcon logo={event.awayTeamLogo} name={event.awayTeam} country={event.awayTeamCountry} sportSlug={sportSlug} />
          <span className={cn(
            'text-[13px] truncate leading-tight',
            isLive && scores && typeof scores.away === 'number' && scores.away > (scores.home ?? 0)
              ? 'text-[#E6EDF3] font-semibold' : 'text-[#C9D1D9]'
          )}>
            {event.awayTeam}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isLive ? (
            <div className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8B5CF6] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#8B5CF6]" />
              </span>
              <span className="text-[11px] font-semibold text-[#8B5CF6]">
                {liveMinute !== null ? `${liveMinute}'` : 'Live'}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-[#8B949E]">
              {timeInfo.label}
              {timeInfo.sublabel && <> <span className="text-[#8B949E]/70">{timeInfo.sublabel}</span></>}
            </span>
          )}
        </div>
      </div>

      {/* Score column (live only) */}
      {isLive && scores && typeof scores.home === 'number' && (
        <div className="flex flex-col items-center justify-center w-8 flex-shrink-0 gap-0.5">
          <span className="text-[13px] font-mono font-bold text-[#E6EDF3] leading-tight">{scores.home}</span>
          <span className="text-[13px] font-mono font-bold text-[#E6EDF3] leading-tight">{scores.away}</span>
        </div>
      )}

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

  if (events.length === 0) return null;

  const firstMarket = events[0]?.mainMarket;
  const marketHeaders = useMemo(() => {
    if (!firstMarket?.selections) return [];
    const len = firstMarket.selections.length;
    if (len === 3) return ['1', 'X', '2'];
    if (len === 2) return ['1', '2'];
    return firstMarket.selections.map((s) => s.name?.length <= 4 ? s.name : s.name?.charAt(0) || '');
  }, [firstMarket]);

  const marketName = firstMarket?.name || 'Full Time Result';

  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden">
      {/* Competition header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#161B22] hover:bg-[#1C2128]/60 transition-colors"
      >
        {logo ? (
          <img src={logo} alt="" className="w-5 h-5 object-contain flex-shrink-0 rounded-sm" />
        ) : flag ? (
          <span className="text-sm flex-shrink-0">{flag}</span>
        ) : (
          <Globe className="w-4 h-4 text-[#8B949E] flex-shrink-0" />
        )}
        <span className="text-[13px] font-semibold text-[#E6EDF3] truncate">{name}</span>
        <span className="text-[10px] text-[#8B949E] bg-[#0D0D1A] px-1.5 py-0.5 rounded-sm flex-shrink-0 font-medium">
          {events.length}
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 text-[#484F58] ml-auto flex-shrink-0 transition-transform duration-200',
          isCollapsed && '-rotate-90'
        )} />
      </button>

      {/* Market header row */}
      {!isCollapsed && (
        <div className="flex items-center px-3 py-1.5 border-t border-b border-[#21262D]/50 bg-[#0D0D1A]/50">
          <div className="flex-1 flex items-center gap-1.5">
            <span className="text-[11px] text-[#8B949E] font-medium truncate">{marketName}</span>
            <BarChart3 className="w-3 h-3 text-[#484F58] flex-shrink-0" />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {marketHeaders.map((h, i) => (
              <span key={i} className="w-[52px] sm:w-[60px] text-center text-[11px] text-[#8B949E] font-semibold">{h}</span>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {!isCollapsed && (
        <div>
          {events.map((event) => (
            <MatchRow key={event.id} event={event} sportSlug={sportSlug} sportName={sportName} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SharpestBettors Widget (right sidebar)
// ---------------------------------------------------------------------------

function SharpestBettorsWidget({ activeSportName }: { activeSportName: string }) {
  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#21262D] flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
          <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#E6EDF3]">Sharpest Bettors</span>
      </div>

      {/* Rankings */}
      <div className="py-1">
        {MOCK_SHARPEST_BETTORS.map((bettor) => (
          <div key={bettor.rank} className="flex items-center gap-2.5 px-4 py-2 hover:bg-[#1C2128]/50 transition-colors">
            {/* Rank badge */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: bettor.badge }}
            >
              {bettor.rank}
            </div>
            {/* Username */}
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-medium text-[#E6EDF3] truncate block">{bettor.username}</span>
            </div>
            {/* Stats */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[11px] font-mono font-semibold text-[#10B981]">+{bettor.roi}%</span>
              <span className="text-[11px] font-mono text-[#8B949E]">${bettor.profit.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div className="px-4 py-2.5 border-t border-[#21262D]">
        <Link href="/sports/live" className="text-[11px] font-semibold text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1 transition-colors">
          {activeSportName || 'Sports'} Pulse
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bet Builder Promo (right sidebar)
// ---------------------------------------------------------------------------

function BetBuilderPromo() {
  return (
    <div className="bg-gradient-to-br from-[#8B5CF6]/20 via-[#161B22] to-[#161B22] border border-[#8B5CF6]/30 rounded-lg overflow-hidden p-4 relative">
      {/* Decorative background */}
      <div className="absolute top-2 right-2 opacity-10">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="4" y="4" width="24" height="24" rx="4" stroke="#8B5CF6" strokeWidth="2" />
          <rect x="36" y="4" width="24" height="24" rx="4" stroke="#8B5CF6" strokeWidth="2" />
          <rect x="20" y="36" width="24" height="24" rx="12" stroke="#8B5CF6" strokeWidth="2" />
        </svg>
      </div>

      <div className="relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6] mb-1">Bet Builder</div>
        <p className="text-[13px] font-semibold text-[#E6EDF3] leading-snug mb-3">
          Build bigger odds with same game parlays.
        </p>
        <Link
          href="/sports"
          className="text-[12px] font-semibold text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1 transition-colors"
        >
          Browse now
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InPlay Sidebar Widget (right sidebar)
// ---------------------------------------------------------------------------

function InPlaySidebarWidget({ liveEvents }: { liveEvents: LiveEventRaw[] }) {
  const [activePill, setActivePill] = useState<string | null>(null);
  const { addSelection, hasSelection } = useBetSlipStore();

  // Group live events by sport
  const grouped = useMemo(() => {
    const groups: Record<string, { sportName: string; sportSlug: string; events: LiveEventRaw[] }> = {};
    for (const evt of liveEvents) {
      const key = evt.sportSlug || 'other';
      if (!groups[key]) {
        groups[key] = { sportName: evt.sport || key, sportSlug: key, events: [] };
      }
      groups[key].events.push(evt);
    }
    return groups;
  }, [liveEvents]);

  // Filter by active pill
  const filteredEvents = useMemo(() => {
    if (!activePill) return liveEvents.slice(0, 8);
    const slugFilter = LIVE_SPORT_PILL_SLUGS[activePill];
    if (!slugFilter) return liveEvents.slice(0, 8);
    return liveEvents.filter(e => e.sportSlug === slugFilter).slice(0, 8);
  }, [liveEvents, activePill]);

  // Re-group filtered events
  const filteredGrouped = useMemo(() => {
    const groups: Record<string, { sportName: string; sportSlug: string; competition: string; events: LiveEventRaw[] }> = {};
    for (const evt of filteredEvents) {
      const comp = evt.competition || evt.sport || 'Other';
      const key = `${evt.sportSlug}-${comp}`;
      if (!groups[key]) {
        groups[key] = { sportName: evt.sport || '', sportSlug: evt.sportSlug, competition: comp, events: [] };
      }
      groups[key].events.push(evt);
    }
    return Object.values(groups);
  }, [filteredEvents]);

  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262D]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#EF4444]" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#E6EDF3]">In-play</span>
          {liveEvents.length > 0 && (
            <span className="text-[10px] font-medium text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-full">
              {liveEvents.length}
            </span>
          )}
        </div>
        <Link href="/sports/live" className="text-[11px] text-[#8B5CF6] hover:text-[#A78BFA] font-medium flex items-center gap-0.5 transition-colors">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Sport filter pills */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#21262D]/50 overflow-x-auto scrollbar-hide">
        {LIVE_SPORT_PILLS.map((pill) => {
          const isActive = activePill === pill;
          return (
            <button
              key={pill}
              onClick={() => setActivePill(isActive ? null : pill)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 border',
                isActive
                  ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/40'
                  : 'bg-transparent text-[#8B949E] border-[#21262D] hover:text-[#C9D1D9] hover:border-[#484F58]'
              )}
            >
              {pill}
            </button>
          );
        })}
      </div>

      {/* Live event rows */}
      <div className="py-1">
        {filteredEvents.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] text-[#8B949E]">No live events</p>
          </div>
        ) : (
          filteredGrouped.map((group) => (
            <div key={`${group.sportSlug}-${group.competition}`}>
              {/* Competition header */}
              <div className="flex items-center gap-2 px-4 py-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SPORT_COLORS[group.sportSlug] || '#8B949E' }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B949E] truncate">
                  {group.competition}
                </span>
              </div>

              {/* Market header */}
              <div className="flex items-center px-4 py-0.5">
                <div className="flex-1">
                  <span className="text-[10px] text-[#484F58] font-medium">Winner</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {group.events[0]?.mainMarket?.selections.length === 3 ? (
                    <>
                      <span className="w-10 text-center text-[10px] text-[#484F58] font-semibold">1</span>
                      <span className="w-10 text-center text-[10px] text-[#484F58] font-semibold">X</span>
                      <span className="w-10 text-center text-[10px] text-[#484F58] font-semibold">2</span>
                    </>
                  ) : (
                    <>
                      <span className="w-10 text-center text-[10px] text-[#484F58] font-semibold">1</span>
                      <span className="w-10 text-center text-[10px] text-[#484F58] font-semibold">2</span>
                    </>
                  )}
                </div>
              </div>

              {/* Event rows */}
              {group.events.map((event) => {
                const homeScore = event.scores?.home ?? 0;
                const awayScore = event.scores?.away ?? 0;
                const eventName = `${event.homeTeam} vs ${event.awayTeam}`;

                return (
                  <Link
                    key={event.id}
                    href={`/sports/${event.sportSlug}/${event.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 hover:bg-[#1C2128]/50 transition-colors"
                  >
                    {/* Live dot */}
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
                    </span>

                    {/* Teams + scores */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#E6EDF3] truncate pr-1 max-w-[100px]">{event.homeTeam}</span>
                        <span className="font-mono font-bold text-[#E6EDF3] flex-shrink-0 text-[11px]">{homeScore}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px] mt-0.5">
                        <span className="text-[#E6EDF3] truncate pr-1 max-w-[100px]">{event.awayTeam}</span>
                        <span className="font-mono font-bold text-[#E6EDF3] flex-shrink-0 text-[11px]">{awayScore}</span>
                      </div>
                    </div>

                    {/* Odds */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.preventDefault()}>
                      {event.mainMarket?.selections.map((sel) => {
                        const oddsVal = typeof sel.odds === 'string' ? parseFloat(sel.odds) : sel.odds;
                        const selected = hasSelection(event.id, event.mainMarket!.id, sel.name);
                        return (
                          <button
                            key={sel.id || sel.name}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addSelection({
                                id: sel.id || `${event.id}-${event.mainMarket!.id}-${sel.name}`,
                                eventId: event.id,
                                eventName,
                                marketId: event.mainMarket!.id,
                                marketName: event.mainMarket!.name,
                                outcomeName: sel.name,
                                odds: oddsVal,
                                sportId: event.sportSlug,
                                sportName: event.sport,
                                startTime: event.startTime,
                                isLive: true,
                              });
                            }}
                            className={cn(
                              'w-10 h-8 rounded text-[11px] font-mono font-semibold transition-all duration-150 border',
                              selected
                                ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                                : 'border-[#21262D] bg-[#0D0D1A] text-[#10B981] hover:border-[#10B981]/30'
                            )}
                          >
                            {formatOdds(oddsVal)}
                          </button>
                        );
                      })}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
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

  const [selectedSportSlug, setSelectedSportSlug] = useState<string>('all');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);

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

  // --- Competition scroll helpers ---
  const scrollCompLeft = () => {
    if (compScrollRef.current) compScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
  };
  const scrollCompRight = () => {
    if (compScrollRef.current) compScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
  };

  // --- Render ---
  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: '#0D0D1A' }}>

      {/* ================================================================== */}
      {/* SPORT ICON CAROUSEL                                                */}
      {/* ================================================================== */}
      <div className="sticky top-0 z-20 border-b border-[#21262D]/60" style={{ backgroundColor: 'rgba(13,13,26,0.95)', backdropFilter: 'blur(12px)' }}>
        <div
          ref={sportScrollRef}
          className="flex items-start gap-1 py-3 overflow-x-auto scrollbar-hide px-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SportIconSkeleton key={i} />)
          ) : (
            <>
              {/* All Sports */}
              <button
                onClick={() => handleSelectSport('all')}
                className="flex flex-col items-center gap-1 flex-shrink-0 w-[72px] group"
              >
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 border-2',
                  selectedSportSlug === 'all'
                    ? 'border-[#F59E0B] bg-[#8B5CF6]/20 text-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20'
                    : 'border-transparent bg-[#1C2128] text-[#8B949E] group-hover:bg-[#1C2128]/80 group-hover:text-[#E6EDF3]'
                )}>
                  <Zap className="w-5 h-5" />
                </div>
                <span className={cn(
                  'text-[10px] font-medium truncate max-w-full leading-tight text-center',
                  selectedSportSlug === 'all' ? 'text-[#F59E0B]' : 'text-[#8B949E]'
                )}>
                  All
                </span>
                {totalLive > 0 && (
                  <span className="text-[9px] font-bold text-[#EF4444] -mt-0.5 flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-[#EF4444] animate-pulse" />
                    {totalLive}
                  </span>
                )}
              </button>

              {/* Individual sport icons */}
              {(sports.length > 0 ? sports : DEFAULT_SPORTS).map((sport) => {
                const config = SPORT_ICON_CONFIG[sport.slug] || { icon: <Trophy className="w-5 h-5" />, color: '#8B5CF6' };
                const isActive = selectedSportSlug === sport.slug;

                return (
                  <button
                    key={sport.id}
                    onClick={() => handleSelectSport(sport.slug)}
                    className="flex flex-col items-center gap-1 flex-shrink-0 w-[72px] group"
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 border-2',
                        isActive ? 'shadow-lg' : 'border-transparent group-hover:scale-105'
                      )}
                      style={{
                        backgroundColor: isActive ? `${config.color}30` : `${config.color}15`,
                        borderColor: isActive ? '#F59E0B' : 'transparent',
                        color: config.color,
                        boxShadow: isActive ? `0 4px 14px ${config.color}30` : undefined,
                      }}
                    >
                      {config.icon}
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium truncate max-w-full leading-tight text-center',
                      isActive ? 'text-[#F59E0B]' : 'text-[#8B949E] group-hover:text-[#C9D1D9]'
                    )}>
                      {sport.name}
                    </span>
                    {sport.liveEventCount > 0 && (
                      <span className="text-[9px] font-bold text-[#EF4444] -mt-0.5 flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-[#EF4444] animate-pulse" />
                        {sport.liveEventCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* COMPETITION TABS (with scroll arrows)                              */}
      {/* ================================================================== */}
      <div className="mt-2 mb-3 relative">
        {/* Left scroll arrow */}
        <button
          onClick={scrollCompLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[#0D0D1A]/90 border border-[#21262D] flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-colors shadow-lg"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Right scroll arrow */}
        <button
          onClick={scrollCompRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[#0D0D1A]/90 border border-[#21262D] flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-colors shadow-lg"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div
          ref={compScrollRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 px-8"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading || isLoadingSportEvents ? (
            Array.from({ length: 6 }).map((_, i) => <CompetitionPillSkeleton key={i} />)
          ) : (
            <>
              {/* "Popular" pill */}
              <button
                onClick={() => setSelectedCompetitionId(null)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 border',
                  selectedCompetitionId === null
                    ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/40'
                    : 'bg-transparent text-[#8B949E] border-[#21262D] hover:border-[#484F58] hover:text-[#C9D1D9]'
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
                    onClick={() => setSelectedCompetitionId(isActive ? null : comp.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 border',
                      isActive
                        ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/40'
                        : 'bg-transparent text-[#8B949E] border-[#21262D] hover:border-[#484F58] hover:text-[#C9D1D9]'
                    )}
                  >
                    {comp.logo ? (
                      <img src={comp.logo} alt="" className="w-4 h-4 object-contain rounded-sm" />
                    ) : flag ? (
                      <span className="text-xs leading-none">{flag}</span>
                    ) : null}
                    <span className="truncate max-w-[120px]">{comp.name}</span>
                    {comp.eventCount > 0 && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1 rounded-sm',
                        isActive ? 'text-[#10B981]/70' : 'text-[#484F58]'
                      )}>
                        {comp.eventCount}
                      </span>
                    )}
                  </button>
                );
              })}

              {competitionTabs.length === 0 && !isLoadingSportEvents && (
                <span className="text-[11px] text-[#484F58] px-2 italic">No competitions available</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* MAIN LAYOUT: Content + Right Sidebar                               */}
      {/* ================================================================== */}
      <div className="flex gap-4">

        {/* ================================================================ */}
        {/* MAIN CONTENT AREA                                                 */}
        {/* ================================================================ */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Live banner (if viewing all sports) */}
          {totalLive > 0 && selectedSportSlug === 'all' && !isLoading && (
            <Link
              href="/sports/live"
              className="flex items-center gap-2.5 px-3 py-2.5 bg-gradient-to-r from-[#EF4444]/10 to-transparent border border-[#EF4444]/20 rounded-lg hover:from-[#EF4444]/15 transition-all group"
            >
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#EF4444]" />
              </span>
              <span className="text-[13px] font-bold text-[#EF4444]">{totalLive} Live</span>
              <span className="text-[12px] text-[#8B949E]">events happening now</span>
              <ChevronRight className="w-4 h-4 text-[#EF4444]/50 ml-auto group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </Link>
          )}

          {/* Live Score Ticker — horizontal scrolling bar of live matches */}
          {!isLoading && tickerEvents.length > 0 && (
            <LiveScoreTicker
              events={tickerEvents}
              cardVariant="compact"
              className="rounded-lg border border-[#21262D] overflow-hidden"
            />
          )}

          {/* Event groups */}
          {isLoading || isLoadingSportEvents ? (
            Array.from({ length: 3 }).map((_, i) => <EventGroupSkeleton key={i} />)
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
                  {/* Insert Pulse banner after 2nd competition group */}
                  {idx === 1 && groupedEvents.length > 2 && (
                    <Link
                      href="/sports/live"
                      className="flex items-center gap-3 px-3 py-3 bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden hover:bg-[#1C2128]/60 transition-colors group relative"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#8B5CF6] to-[#6D28D9]" />
                      <div className="pl-2 flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6]">CryptoBet Pulse</div>
                        <div className="text-[13px] font-semibold text-[#E6EDF3] truncate">
                          {selectedSportSlug !== 'all' && selectedSport
                            ? `${selectedSport.name.toUpperCase()} -- `
                            : ''}SEE WHO&apos;S WINNING
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#8B5CF6] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-[#21262D]" />
              </div>
              <h3 className="text-base font-semibold text-[#E6EDF3] mb-1">No events available</h3>
              <p className="text-[13px] text-[#8B949E] max-w-xs">
                {selectedSportSlug === 'all'
                  ? 'There are no featured events at the moment. Check back soon.'
                  : `No events found for ${selectedSport?.name || selectedSportSlug}. Try selecting a different sport.`}
              </p>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* RIGHT SIDEBAR WIDGETS (desktop only)                              */}
        {/* ================================================================ */}
        <aside className="hidden xl:flex flex-col w-[280px] flex-shrink-0 gap-3">
          {/* Sharpest Bettors */}
          <SharpestBettorsWidget activeSportName={selectedSport?.name || 'Sports'} />

          {/* Bet Builder Promo */}
          <BetBuilderPromo />

          {/* In-play widget */}
          <InPlaySidebarWidget liveEvents={liveEvents} />
        </aside>
      </div>
    </div>
  );
}
