'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, ChevronUp, Star, Filter } from 'lucide-react';
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

interface MockLeague {
  id: string;
  name: string;
  sport: string;
  sportSlug: string;
  country: string;
  logo: string;
}

const LEAGUES: MockLeague[] = [
  { id: 'epl', name: 'Premier League', sport: 'Soccer', sportSlug: 'soccer', country: 'England', logo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'laliga', name: 'La Liga', sport: 'Soccer', sportSlug: 'soccer', country: 'Spain', logo: '🇪🇸' },
  { id: 'nba', name: 'NBA', sport: 'Basketball', sportSlug: 'basketball', country: 'USA', logo: '🇺🇸' },
  { id: 'nfl', name: 'NFL', sport: 'American Football', sportSlug: 'american-football', country: 'USA', logo: '🇺🇸' },
];

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
  { id: 'laliga-4', homeTeam: 'Athletic Bilbao', awayTeam: 'Real Betis', startTime: inDays(4, 18, 0), isLive: false, isFeatured: false, league: 'La Liga', leagueId: 'laliga', sport: 'Soccer', sportSlug: 'soccer', markets: [makeMarket('2.05', '3.40', '3.60', 'laliga-4')] },

  // --- NBA ---
  { id: 'nba-1', homeTeam: 'Los Angeles Lakers', awayTeam: 'Boston Celtics', startTime: today(19, 30), isLive: true, isFeatured: true, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('1.85', null, '1.95', 'nba-1')], homeScore: 87, awayScore: 92, matchTime: 'Q3 4:22' },
  { id: 'nba-2', homeTeam: 'Golden State Warriors', awayTeam: 'Milwaukee Bucks', startTime: today(22, 0), isLive: false, isFeatured: false, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('2.10', null, '1.75', 'nba-2')] },
  { id: 'nba-3', homeTeam: 'Denver Nuggets', awayTeam: 'Phoenix Suns', startTime: tomorrow(21, 0), isLive: false, isFeatured: false, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('1.70', null, '2.15', 'nba-3')] },
  { id: 'nba-4', homeTeam: 'Miami Heat', awayTeam: 'Philadelphia 76ers', startTime: inDays(2, 19, 0), isLive: false, isFeatured: false, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('1.90', null, '1.90', 'nba-4')] },
  { id: 'nba-5', homeTeam: 'Dallas Mavericks', awayTeam: 'Oklahoma City Thunder', startTime: inDays(3, 20, 30), isLive: false, isFeatured: false, league: 'NBA', leagueId: 'nba', sport: 'Basketball', sportSlug: 'basketball', markets: [makeMarket('2.25', null, '1.65', 'nba-5')] },

  // --- NFL ---
  { id: 'nfl-1', homeTeam: 'Kansas City Chiefs', awayTeam: 'San Francisco 49ers', startTime: inDays(2, 18, 30), isLive: false, isFeatured: false, league: 'NFL', leagueId: 'nfl', sport: 'American Football', sportSlug: 'american-football', markets: [makeMarket('1.65', null, '2.25', 'nfl-1')] },
  { id: 'nfl-2', homeTeam: 'Philadelphia Eagles', awayTeam: 'Dallas Cowboys', startTime: inDays(2, 22, 15), isLive: false, isFeatured: false, league: 'NFL', leagueId: 'nfl', sport: 'American Football', sportSlug: 'american-football', markets: [makeMarket('1.80', null, '2.00', 'nfl-2')] },
  { id: 'nfl-3', homeTeam: 'Buffalo Bills', awayTeam: 'Baltimore Ravens', startTime: inDays(5, 20, 0), isLive: false, isFeatured: false, league: 'NFL', leagueId: 'nfl', sport: 'American Football', sportSlug: 'american-football', markets: [makeMarket('1.95', null, '1.85', 'nfl-3')] },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPORT_PILLS = [
  'All', 'Soccer', 'Basketball', 'Tennis', 'American Football',
  'Baseball', 'Ice Hockey', 'MMA', 'Boxing', 'Cricket',
  'Rugby', 'Golf', 'Esports',
];

type TimeFilter = 'today' | 'tomorrow' | 'this-week' | 'all';

const TIME_FILTERS: { label: string; value: TimeFilter }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This Week', value: 'this-week' },
  { label: 'All', value: 'all' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventTime(iso: string, isLive: boolean, matchTime?: string): string {
  if (isLive && matchTime) return matchTime;
  if (isLive) return 'LIVE';
  const d = new Date(iso);
  const todayDate = new Date();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (sameDay(d, todayDate)) return `Today ${time}`;
  if (sameDay(d, tomorrowDate)) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function isTomorrow(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  const endOfWeek = new Date(t);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  return d <= endOfWeek && d >= t;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SportsPage() {
  const { toggleSelection, hasSelection } = useBetSlipStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSport, setActiveSport] = useState('All');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});

  // Toggle league collapse
  const toggleLeague = (leagueId: string) => {
    setCollapsedLeagues((prev) => ({ ...prev, [leagueId]: !prev[leagueId] }));
  };

  // Handle odds click
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

  // ---- Filtering pipeline ----

  const filteredEvents = useMemo(() => {
    let events = MOCK_EVENTS;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.homeTeam.toLowerCase().includes(q) ||
          e.awayTeam.toLowerCase().includes(q) ||
          e.league.toLowerCase().includes(q) ||
          e.sport.toLowerCase().includes(q)
      );
    }

    // Sport filter
    if (activeSport !== 'All') {
      events = events.filter((e) => e.sport === activeSport);
    }

    // Time filter
    if (timeFilter === 'today') {
      events = events.filter((e) => isToday(e.startTime) || e.isLive);
    } else if (timeFilter === 'tomorrow') {
      events = events.filter((e) => isTomorrow(e.startTime));
    } else if (timeFilter === 'this-week') {
      events = events.filter((e) => isThisWeek(e.startTime) || e.isLive);
    }

    return events;
  }, [searchQuery, activeSport, timeFilter]);

  // Featured events (top 4)
  const featuredEvents = useMemo(
    () => filteredEvents.filter((e) => e.isFeatured).slice(0, 4),
    [filteredEvents]
  );

  // Group non-featured events by league
  const groupedByLeague = useMemo(() => {
    const map = new Map<string, MockEvent[]>();
    for (const e of filteredEvents) {
      const arr = map.get(e.leagueId) || [];
      arr.push(e);
      map.set(e.leagueId, arr);
    }
    return map;
  }, [filteredEvents]);

  return (
    <div className="max-w-5xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ================================================================
          1. Search Bar
          ================================================================ */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
          size={18}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events, teams, leagues..."
          className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#8D52DA'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        />
      </div>

      {/* ================================================================
          2. Sport Category Pills
          ================================================================ */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SPORT_PILLS.map((pill) => (
          <button
            key={pill}
            onClick={() => setActiveSport(pill)}
            className={cn(
              'px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors font-medium',
              activeSport === pill
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            )}
            style={{
              background: activeSport === pill
                ? 'linear-gradient(135deg, #8D52DA 0%, #6A3FB5 100%)'
                : 'rgba(255,255,255,0.05)',
            }}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* ================================================================
          5. Quick Time Filters
          ================================================================ */}
      <div className="flex items-center gap-1">
        <Filter size={14} className="text-gray-500 mr-1" />
        {TIME_FILTERS.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeFilter(tf.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              timeFilter === tf.value
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            )}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* ================================================================
          3. Featured / Highlighted Matches
          ================================================================ */}
      {featuredEvents.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-yellow-500" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Featured Matches
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* ================================================================
          4. Competitions List grouped by league
          ================================================================ */}
      {filteredEvents.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No events found matching your criteria.</p>
          <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters.</p>
        </div>
      )}

      {LEAGUES.map((league) => {
        const events = groupedByLeague.get(league.id);
        if (!events || events.length === 0) return null;
        const isCollapsed = !!collapsedLeagues[league.id];

        return (
          <section key={league.id}>
            {/* League header */}
            <button
              onClick={() => toggleLeague(league.id)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-t-lg sticky top-0 z-10 select-none"
              style={{ background: '#111214' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg leading-none">{league.logo}</span>
                <span className="text-sm font-semibold text-white">{league.name}</span>
                <span className="text-xs text-gray-500 font-normal">
                  {league.country}
                </span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#aaa' }}
                >
                  {events.length}
                </span>
              </div>
              {isCollapsed ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronUp size={16} className="text-gray-500" />
              )}
            </button>

            {/* Event rows */}
            {!isCollapsed && (
              <div
                className="rounded-b-lg overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.015)' }}
              >
                {events.map((event, idx) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    isLast={idx === events.length - 1}
                    onOddsClick={handleOddsClick}
                    hasSelection={hasSelection}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Featured Card
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
    <div
      className="rounded-xl p-4 transition-colors group relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(141,82,218,0.12) 0%, rgba(255,255,255,0.03) 100%)',
        border: '1px solid rgba(141,82,218,0.15)',
      }}
    >
      {/* Live badge */}
      {event.isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          Live
        </div>
      )}

      {/* League + Time */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-gray-500 font-medium">{event.league}</span>
        <span className="text-gray-700">|</span>
        <span className={cn('text-[11px] font-medium', event.isLive ? 'text-red-400' : 'text-gray-500')}>
          {formatEventTime(event.startTime, event.isLive, event.matchTime)}
        </span>
      </div>

      {/* Teams */}
      <Link href={`/sports/event/${event.id}`} className="block mb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              {event.homeTeam}
              {event.isLive && event.homeScore !== null && (
                <span className="text-yellow-400 font-bold text-base">{event.homeScore}</span>
              )}
            </p>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              {event.awayTeam}
              {event.isLive && event.awayScore !== null && (
                <span className="text-yellow-400 font-bold text-base">{event.awayScore}</span>
              )}
            </p>
          </div>
        </div>
      </Link>

      {/* Odds row */}
      <div className="flex gap-2">
        {market.selections.map((sel) => {
          const selected = hasSelection(sel.id);
          return (
            <button
              key={sel.id}
              onClick={() => onOddsClick(event, sel)}
              className={cn(
                'flex-1 flex flex-col items-center py-2 rounded-lg text-xs font-medium transition-all',
                selected
                  ? 'ring-1 ring-[#8D52DA]'
                  : 'hover:bg-white/[0.08]'
              )}
              style={{
                background: selected ? 'rgba(141,82,218,0.25)' : 'rgba(255,255,255,0.06)',
              }}
            >
              <span className="text-gray-400 text-[10px] mb-0.5">
                {sel.name === '1' ? event.homeTeam.split(' ').pop() : sel.name === '2' ? event.awayTeam.split(' ').pop() : 'Draw'}
              </span>
              <span className={cn('font-bold text-sm', selected ? 'text-[#B17EED]' : 'text-white')}>
                {sel.odds}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Row
// ---------------------------------------------------------------------------

function EventRow({
  event,
  isLast,
  onOddsClick,
  hasSelection,
}: {
  event: MockEvent;
  isLast: boolean;
  onOddsClick: (e: MockEvent, s: MockSelection) => void;
  hasSelection: (id: string) => boolean;
}) {
  const market = event.markets[0];
  if (!market) return null;

  return (
    <div
      className="flex items-center px-4 py-3 transition-colors"
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Time column */}
      <div className="w-[80px] shrink-0 mr-3">
        {event.isLive ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-[11px] font-bold">
              {event.matchTime || 'LIVE'}
            </span>
          </div>
        ) : (
          <span className="text-gray-500 text-[11px] leading-tight block">
            {formatEventTime(event.startTime, false)}
          </span>
        )}
      </div>

      {/* Teams column */}
      <Link
        href={`/sports/event/${event.id}`}
        className="flex-1 min-w-0 mr-4"
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white truncate leading-snug">
              {event.homeTeam}
              {event.isLive && event.homeScore !== null && (
                <span className="text-yellow-400 font-bold ml-2">{event.homeScore}</span>
              )}
            </p>
            <p className="text-[13px] text-white truncate leading-snug">
              {event.awayTeam}
              {event.isLive && event.awayScore !== null && (
                <span className="text-yellow-400 font-bold ml-2">{event.awayScore}</span>
              )}
            </p>
          </div>
        </div>
      </Link>

      {/* Odds columns */}
      <div className="flex gap-1.5 shrink-0">
        {market.selections.map((sel) => {
          const selected = hasSelection(sel.id);
          return (
            <button
              key={sel.id}
              onClick={() => onOddsClick(event, sel)}
              className={cn(
                'w-[60px] sm:w-[72px] flex flex-col items-center py-1.5 rounded-md text-xs transition-all',
                selected
                  ? 'ring-1 ring-[#8D52DA]'
                  : 'hover:bg-white/[0.08]'
              )}
              style={{
                background: selected ? 'rgba(141,82,218,0.25)' : 'rgba(255,255,255,0.05)',
              }}
            >
              <span className="text-gray-500 text-[9px] leading-none mb-0.5">{sel.name}</span>
              <span
                className={cn(
                  'font-bold text-[13px] leading-tight',
                  selected ? 'text-[#B17EED]' : 'text-white'
                )}
              >
                {sel.odds}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
