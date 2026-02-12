'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn } from '@/lib/utils';
import type { BetSlipItem } from '@/types';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface MockSelection {
  id: string;
  name: string;
  odds: string;
}

interface MockMarket {
  id: string;
  name: string;
  selections: MockSelection[];
}

interface MockEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  isLive: boolean;
  isFeatured: boolean;
  league: string;
  leagueId: string;
  sport: string;
  sportSlug: string;
  markets: MockMarket[];
  homeScore?: number;
  awayScore?: number;
  matchTime?: string;
}

function makeMarket(homeOdds: string, drawOdds: string | null, awayOdds: string, eventId: string): MockMarket {
  const selections: MockSelection[] = [
    { id: `${eventId}-home`, name: '1', odds: homeOdds },
  ];
  if (drawOdds) {
    selections.push({ id: `${eventId}-draw`, name: 'X', odds: drawOdds });
  }
  selections.push({ id: `${eventId}-away`, name: '2', odds: awayOdds });
  return { id: `mkt-${eventId}`, name: '1X2', selections };
}

const now = new Date();
const today = (h: number, m: number) => {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const tomorrow = (h: number, m: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const inDays = (days: number, h: number, m: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const MOCK_EVENTS: MockEvent[] = [
  // --- Premier League ---
  { id: 'epl-1', homeTeam: 'Arsenal', awayTeam: 'Manchester City', startTime: today(17, 30), isLive: true, isFeatured: true, league: 'Premier League', leagueId: 'epl', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('2.50', '3.20', '2.85', 'epl-1')], homeScore: 1, awayScore: 1, matchTime: "62'" },
  { id: 'epl-2', homeTeam: 'Liverpool', awayTeam: 'Chelsea', startTime: today(20, 0), isLive: false, isFeatured: true, league: 'Premier League', leagueId: 'epl', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('1.90', '3.50', '4.20', 'epl-2')] },
  { id: 'epl-3', homeTeam: 'Manchester United', awayTeam: 'Tottenham', startTime: tomorrow(15, 0), isLive: false, isFeatured: false, league: 'Premier League', leagueId: 'epl', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('2.40', '3.30', '3.00', 'epl-3')] },
  { id: 'epl-4', homeTeam: 'Newcastle United', awayTeam: 'Aston Villa', startTime: tomorrow(17, 30), isLive: false, isFeatured: false, league: 'Premier League', leagueId: 'epl', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('2.10', '3.40', '3.50', 'epl-4')] },
  { id: 'epl-5', homeTeam: 'Brighton', awayTeam: 'West Ham', startTime: inDays(3, 15, 0), isLive: false, isFeatured: false, league: 'Premier League', leagueId: 'epl', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('1.95', '3.60', '3.90', 'epl-5')] },

  // --- La Liga ---
  { id: 'laliga-1', homeTeam: 'Real Madrid', awayTeam: 'Barcelona', startTime: today(21, 0), isLive: false, isFeatured: true, league: 'La Liga', leagueId: 'laliga', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('2.60', '3.25', '2.70', 'laliga-1')] },
  { id: 'laliga-2', homeTeam: 'Atletico Madrid', awayTeam: 'Sevilla', startTime: tomorrow(19, 0), isLive: false, isFeatured: false, league: 'La Liga', leagueId: 'laliga', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('1.75', '3.60', '4.80', 'laliga-2')] },
  { id: 'laliga-3', homeTeam: 'Real Sociedad', awayTeam: 'Villarreal', startTime: inDays(2, 20, 0), isLive: false, isFeatured: false, league: 'La Liga', leagueId: 'laliga', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('2.20', '3.30', '3.30', 'laliga-3')] },

  // --- NBA ---
  { id: 'nba-1', homeTeam: 'Los Angeles Lakers', awayTeam: 'Boston Celtics', startTime: today(19, 30), isLive: true, isFeatured: true, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('1.85', null, '1.95', 'nba-1')], homeScore: 87, awayScore: 92, matchTime: 'Q3 4:22' },
  { id: 'nba-2', homeTeam: 'Golden State Warriors', awayTeam: 'Milwaukee Bucks', startTime: today(22, 0), isLive: false, isFeatured: false, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('2.10', null, '1.75', 'nba-2')] },
  { id: 'nba-3', homeTeam: 'Denver Nuggets', awayTeam: 'Phoenix Suns', startTime: tomorrow(21, 0), isLive: false, isFeatured: false, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('1.70', null, '2.15', 'nba-3')] },

  // --- NFL ---
  { id: 'nfl-1', homeTeam: 'Kansas City Chiefs', awayTeam: 'San Francisco 49ers', startTime: inDays(2, 18, 30), isLive: false, isFeatured: false, league: 'NFL', leagueId: 'nfl', sport: 'American Football', sportSlug: 'american-football', markets: [makeMarket('1.65', null, '2.25', 'nfl-1')] },
  { id: 'nfl-2', homeTeam: 'Philadelphia Eagles', awayTeam: 'Dallas Cowboys', startTime: inDays(2, 22, 15), isLive: false, isFeatured: false, league: 'NFL', leagueId: 'nfl', sport: 'American Football', sportSlug: 'american-football', markets: [makeMarket('1.80', null, '2.00', 'nfl-2')] },
];

// Sports list with icons and counts
const SPORTS_LIST = [
  { slug: 'soccer', name: 'Soccer', icon: '⚽', count: 156 },
  { slug: 'basketball', name: 'Basketball', icon: '🏀', count: 89 },
  { slug: 'tennis', name: 'Tennis', icon: '🎾', count: 124 },
  { slug: 'american-football', name: 'American Football', icon: '🏈', count: 42 },
  { slug: 'ice-hockey', name: 'Ice Hockey', icon: '🏒', count: 67 },
  { slug: 'baseball', name: 'Baseball', icon: '⚾', count: 53 },
  { slug: 'esports', name: 'Esports', icon: '🎮', count: 78 },
  { slug: 'mma', name: 'MMA', icon: '🥊', count: 12 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventTime(iso: string, isLive: boolean, matchTime?: string): string {
  if (isLive && matchTime) return matchTime;
  if (isLive) return 'LIVE';
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const todayDate = new Date();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, todayDate)) return time;
  if (sameDay(d, tomorrowDate)) return `Tom ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SportsPage() {
  const { toggleSelection, hasSelection } = useBetSlipStore();

  const handleOddsClick = (event: MockEvent, selection: MockSelection) => {
    const item: BetSlipItem = {
      selectionId: selection.id,
      selectionName: selection.name === '1' ? event.homeTeam : selection.name === '2' ? event.awayTeam : 'Draw',
      marketName: '1X2',
      eventName: `${event.homeTeam} vs ${event.awayTeam}`,
      eventId: event.id,
      odds: selection.odds,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    };
    toggleSelection(item);
  };

  const featuredEvents = useMemo(
    () => MOCK_EVENTS.filter((e) => e.isFeatured).slice(0, 3),
    []
  );

  // Group events by date
  const eventsByDate = useMemo(() => {
    const groups = new Map<string, MockEvent[]>();
    MOCK_EVENTS.forEach((event) => {
      const dateKey = formatDate(event.startTime);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(event);
    });
    return groups;
  }, []);

  const liveCount = useMemo(() => MOCK_EVENTS.filter((e) => e.isLive).length, []);

  return (
    <div className="w-full px-4 max-w-6xl mx-auto pb-20 space-y-6">
      {/* Simple page header */}
      <h1 className="text-2xl font-bold text-white pt-4">Sports</h1>

      {/* Featured/Live section */}
      {featuredEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              {liveCount > 0 ? 'Live & Featured' : 'Featured'}
            </h2>
            {liveCount > 0 && (
              <Link
                href="/sports/live"
                className="text-xs text-purple-400 hover:text-purple-300 font-medium"
              >
                View all live
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {featuredEvents.map((event) => (
              <FeaturedCard
                key={event.id}
                event={event}
                onOddsClick={handleOddsClick}
                hasSelection={hasSelection}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sports list - simple rows */}
      <section className="rounded overflow-hidden border border-white/[0.04]">
        {SPORTS_LIST.map((sport, idx) => (
          <Link
            key={sport.slug}
            href={`/sports/${sport.slug}`}
            className={cn(
              'flex items-center justify-between px-4 h-[52px] bg-[#1A1B1F] hover:bg-[#222328] transition-colors',
              idx !== SPORTS_LIST.length - 1 && 'border-b border-white/[0.04]'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{sport.icon}</span>
              <span className="text-sm font-medium text-white">{sport.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-medium">{sport.count} events</span>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </div>
          </Link>
        ))}
      </section>

      {/* Upcoming events grouped by date */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Upcoming Events
        </h2>
        {Array.from(eventsByDate.entries()).map(([date, events]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              {date}
            </h3>
            {events.filter((e) => !e.isLive).slice(0, 5).map((event) => (
              <UpcomingEventRow
                key={event.id}
                event={event}
                onOddsClick={handleOddsClick}
                hasSelection={hasSelection}
              />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Featured Card (larger card for live/featured events)
// ---------------------------------------------------------------------------

function FeaturedCard({
  event,
  onOddsClick,
  hasSelection,
}: {
  event: MockEvent;
  onOddsClick: (e: MockEvent, s: MockSelection) => void;
  hasSelection: (id: string) => boolean;
}) {
  const market = event.markets[0];
  if (!market) return null;

  return (
    <div className="rounded-lg p-4 bg-[#1A1B1F] border border-white/[0.06] hover:border-white/10 transition-all">
      {/* Live badge */}
      {event.isLive && (
        <div className="inline-flex items-center gap-1.5 bg-green-500/15 text-green-400 text-xs font-bold uppercase px-2 py-1 rounded mb-3">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Live
        </div>
      )}

      {/* League + Time */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 font-medium">{event.league}</span>
        <span className="text-gray-700">•</span>
        <span className={cn('text-xs font-medium', event.isLive ? 'text-green-400' : 'text-gray-500')}>
          {formatEventTime(event.startTime, event.isLive, event.matchTime)}
        </span>
      </div>

      {/* Teams */}
      <Link href={`/sports/event/${event.id}`} className="block mb-4">
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-white flex items-center justify-between">
            {event.homeTeam}
            {event.isLive && event.homeScore !== undefined && (
              <span className="text-white font-bold font-mono tabular-nums">{event.homeScore}</span>
            )}
          </p>
          <p className="text-base font-semibold text-white flex items-center justify-between">
            {event.awayTeam}
            {event.isLive && event.awayScore !== undefined && (
              <span className="text-white font-bold font-mono tabular-nums">{event.awayScore}</span>
            )}
          </p>
        </div>
      </Link>

      {/* Odds row */}
      <div className="grid grid-cols-3 gap-2">
        {market.selections.map((sel) => {
          const selected = hasSelection(sel.id);
          return (
            <button
              key={sel.id}
              onClick={() => onOddsClick(event, sel)}
              className={cn(
                'h-9 flex items-center justify-center gap-2 rounded transition-all font-mono text-sm font-bold',
                selected
                  ? 'bg-purple-600/20 ring-1 ring-purple-500 text-purple-300'
                  : 'bg-white/[0.06] hover:bg-white/[0.10] text-white'
              )}
            >
              <span className="text-gray-500 text-xs font-normal">
                {sel.name === '1' ? '1' : sel.name === '2' ? '2' : 'X'}
              </span>
              <span>{sel.odds}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming Event Row (compact)
// ---------------------------------------------------------------------------

function UpcomingEventRow({
  event,
  onOddsClick,
  hasSelection,
}: {
  event: MockEvent;
  onOddsClick: (e: MockEvent, s: MockSelection) => void;
  hasSelection: (id: string) => boolean;
}) {
  const market = event.markets[0];
  if (!market) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1A1B1F] rounded border border-white/[0.04] hover:border-white/[0.08] transition-all">
      {/* Time */}
      <div className="w-16 shrink-0">
        <span className="text-xs text-gray-500">
          {formatEventTime(event.startTime, false)}
        </span>
      </div>

      {/* Teams */}
      <Link
        href={`/sports/event/${event.id}`}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-300 truncate">{event.homeTeam}</span>
          <span className="text-gray-600 shrink-0">vs</span>
          <span className="text-gray-300 truncate">{event.awayTeam}</span>
        </div>
        <div className="text-xs text-gray-600 mt-0.5">{event.league}</div>
      </Link>

      {/* Odds */}
      <div className="flex gap-2 shrink-0">
        {market.selections.map((sel) => {
          const selected = hasSelection(sel.id);
          return (
            <button
              key={sel.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOddsClick(event, sel);
              }}
              className={cn(
                'w-14 h-8 flex items-center justify-center rounded transition-all font-mono text-xs font-bold',
                selected
                  ? 'bg-purple-600/20 ring-1 ring-purple-500 text-purple-300'
                  : 'bg-white/[0.06] hover:bg-white/[0.10] text-white'
              )}
            >
              {sel.odds}
            </button>
          );
        })}
      </div>
    </div>
  );
}
