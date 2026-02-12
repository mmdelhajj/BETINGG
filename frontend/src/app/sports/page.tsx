'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, ChevronUp, Star } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SportsPage() {
  const { toggleSelection, hasSelection } = useBetSlipStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSport, setActiveSport] = useState('All');
  const [collapsedLeagues, setCollapsedLeagues] = useState<Record<string, boolean>>({});

  const toggleLeague = (leagueId: string) => {
    setCollapsedLeagues((prev) => ({ ...prev, [leagueId]: !prev[leagueId] }));
  };

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

  // Filtering
  const filteredEvents = useMemo(() => {
    let events = MOCK_EVENTS;

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

    if (activeSport !== 'All') {
      events = events.filter((e) => e.sport === activeSport);
    }

    return events;
  }, [searchQuery, activeSport]);

  const featuredEvents = useMemo(
    () => filteredEvents.filter((e) => e.isFeatured).slice(0, 4),
    [filteredEvents]
  );

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
    <div className="w-full px-4 max-w-6xl mx-auto pb-8 space-y-4">

      {/* Search Bar */}
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
          className="w-full h-11 pl-10 pr-4 rounded-lg text-sm text-white placeholder-gray-500 bg-white/5 border border-white/8 outline-none transition-colors focus:border-purple-500"
        />
      </div>

      {/* Sport Category Pills - horizontal scroll with fade gradient */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory">
          {SPORT_PILLS.map((pill) => (
            <button
              key={pill}
              onClick={() => setActiveSport(pill)}
              className={cn(
                'min-h-[44px] px-4 py-2 rounded-full text-sm whitespace-nowrap font-medium transition-all snap-start',
                activeSport === pill
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
                  : 'bg-white/5 text-gray-400 hover:text-gray-200 active:scale-95'
              )}
            >
              {pill}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0b0d] to-transparent pointer-events-none" />
      </div>

      {/* Featured Matches */}
      {featuredEvents.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-yellow-500" />
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Featured Matches
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
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

      {/* No results */}
      {filteredEvents.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No events found matching your criteria.</p>
          <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Competitions List */}
      {LEAGUES.map((league) => {
        const events = groupedByLeague.get(league.id);
        if (!events || events.length === 0) return null;
        const isCollapsed = !!collapsedLeagues[league.id];

        return (
          <section key={league.id} className="rounded-lg overflow-hidden border border-white/8 bg-white/[0.02]">
            {/* League header - min 44px height for touch */}
            <button
              onClick={() => toggleLeague(league.id)}
              className="w-full min-h-[44px] flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg leading-none">{league.logo}</span>
                <span className="text-sm font-semibold text-white">{league.name}</span>
                <span className="text-xs text-gray-500 font-normal hidden sm:inline">
                  {league.country}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
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
              <div className="divide-y divide-white/[0.04]">
                {events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
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
    <div className="rounded-xl p-4 bg-gradient-to-br from-purple-600/10 to-transparent border border-purple-500/20 hover:border-purple-500/30 transition-all">
      {/* Live badge */}
      {event.isLive && (
        <div className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 text-[11px] font-bold uppercase px-2 py-1 rounded-full mb-2">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          Live
        </div>
      )}

      {/* League + Time */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-gray-500 font-medium">{event.league}</span>
        <span className="text-gray-700">•</span>
        <span className={cn('text-[11px] font-medium', event.isLive ? 'text-red-400' : 'text-gray-500')}>
          {formatEventTime(event.startTime, event.isLive, event.matchTime)}
        </span>
      </div>

      {/* Teams */}
      <Link href={`/sports/event/${event.id}`} className="block mb-4 min-h-[44px]">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white line-clamp-2 flex items-center gap-2">
            {event.homeTeam}
            {event.isLive && event.homeScore !== undefined && (
              <span className="text-yellow-400 font-bold">{event.homeScore}</span>
            )}
          </p>
          <p className="text-sm font-semibold text-white line-clamp-2 flex items-center gap-2">
            {event.awayTeam}
            {event.isLive && event.awayScore !== undefined && (
              <span className="text-yellow-400 font-bold">{event.awayScore}</span>
            )}
          </p>
        </div>
      </Link>

      {/* Odds row - min 44px height buttons, 64px min width */}
      <div className="grid grid-cols-3 gap-2">
        {market.selections.map((sel) => {
          const selected = hasSelection(sel.id);
          return (
            <button
              key={sel.id}
              onClick={() => onOddsClick(event, sel)}
              className={cn(
                'min-h-[44px] min-w-[64px] flex flex-col items-center justify-center py-2 rounded-lg transition-all',
                selected
                  ? 'bg-purple-600/30 ring-1 ring-purple-500 text-purple-300'
                  : 'bg-white/[0.08] hover:bg-white/[0.12] text-white active:scale-95'
              )}
            >
              <span className="text-gray-400 text-[11px] mb-0.5">
                {sel.name === '1' ? '1' : sel.name === '2' ? '2' : 'X'}
              </span>
              <span className="font-bold text-sm">{sel.odds}</span>
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors min-h-[88px] sm:min-h-[64px]">
      {/* Time column - min 44px touch target */}
      <div className="flex items-center gap-3 sm:w-24 shrink-0">
        {event.isLive ? (
          <div className="flex items-center gap-1.5 min-h-[44px]">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-[11px] font-bold">
              {event.matchTime || 'LIVE'}
            </span>
          </div>
        ) : (
          <span className="text-gray-500 text-[11px] min-h-[44px] flex items-center">
            {formatEventTime(event.startTime, false)}
          </span>
        )}
      </div>

      {/* Teams column - allow line-clamp on mobile */}
      <Link
        href={`/sports/event/${event.id}`}
        className="flex-1 min-w-0 min-h-[44px] flex items-center"
      >
        <div className="w-full space-y-1">
          <p className="text-sm text-white font-medium line-clamp-2 flex items-center gap-2">
            {event.homeTeam}
            {event.isLive && event.homeScore !== undefined && (
              <span className="text-yellow-400 font-bold tabular-nums">{event.homeScore}</span>
            )}
          </p>
          <p className="text-sm text-white font-medium line-clamp-2 flex items-center gap-2">
            {event.awayTeam}
            {event.isLive && event.awayScore !== undefined && (
              <span className="text-yellow-400 font-bold tabular-nums">{event.awayScore}</span>
            )}
          </p>
        </div>
      </Link>

      {/* Odds columns - 3-col on mobile when possible, min 64px width, 44px height */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2 shrink-0">
        {market.selections.map((sel) => {
          const selected = hasSelection(sel.id);
          return (
            <button
              key={sel.id}
              onClick={() => onOddsClick(event, sel)}
              className={cn(
                'min-h-[44px] min-w-[64px] sm:w-[72px] flex flex-col items-center justify-center py-2 rounded-md transition-all',
                selected
                  ? 'bg-purple-600/30 ring-1 ring-purple-500 text-purple-300'
                  : 'bg-white/[0.06] hover:bg-white/[0.10] text-white active:scale-95'
              )}
            >
              <span className="text-gray-500 text-[11px] mb-0.5">{sel.name}</span>
              <span className="font-bold text-sm">{sel.odds}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
