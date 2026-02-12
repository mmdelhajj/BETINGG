'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn } from '@/lib/utils';
import type { BetSlipItem } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeFilter = 'all' | 'today' | 'tomorrow' | 'live';

interface MockSelection {
  id: string;
  name: string;
  odds: string;
}

interface MockMarket {
  id: string;
  name: string;
  type: string;
  selections: MockSelection[];
}

interface MockEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  isLive: boolean;
  homeScore?: number;
  awayScore?: number;
  matchTime?: string;
  competitionId: string;
  markets: MockMarket[];
}

interface MockCompetition {
  id: string;
  name: string;
  country: string;
  flag: string;
}

// ---------------------------------------------------------------------------
// Sport Config
// ---------------------------------------------------------------------------

interface SportConfig {
  name: string;
  icon: string;
  hasDrawMarket: boolean;
  competitions: MockCompetition[];
  events: MockEvent[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function sel(name: string, odds: string): MockSelection {
  return { id: uid('sel'), name, odds };
}

function market1x2(homeOdds: string, drawOdds: string, awayOdds: string): MockMarket {
  return {
    id: uid('mkt'),
    name: '1X2',
    type: '1X2',
    selections: [sel('1', homeOdds), sel('X', drawOdds), sel('2', awayOdds)],
  };
}

function marketML(homeOdds: string, awayOdds: string): MockMarket {
  return {
    id: uid('mkt'),
    name: 'Moneyline',
    type: 'MONEYLINE',
    selections: [sel('1', homeOdds), sel('2', awayOdds)],
  };
}

function todayAt(hour: number, min = 0): string {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function tomorrowAt(hour: number, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function hoursFromNow(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Mock data per sport
// ---------------------------------------------------------------------------

function getSportConfig(slug: string): SportConfig {
  switch (slug) {
    case 'soccer':
    case 'football': {
      const competitions: MockCompetition[] = [
        { id: 'epl', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
        { id: 'laliga', name: 'La Liga', country: 'Spain', flag: '🇪🇸' },
        { id: 'seriea', name: 'Serie A', country: 'Italy', flag: '🇮🇹' },
        { id: 'ucl', name: 'Champions League', country: 'Europe', flag: '🇪🇺' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-s1', homeTeam: 'Arsenal', awayTeam: 'Chelsea', startTime: hoursFromNow(-0.5), isLive: true, homeScore: 1, awayScore: 0, matchTime: "34'", competitionId: 'epl', markets: [market1x2('1.55', '4.20', '5.50')] },
        { id: 'ev-s2', homeTeam: 'Liverpool', awayTeam: 'Manchester City', startTime: hoursFromNow(-0.25), isLive: true, homeScore: 2, awayScore: 2, matchTime: "67'", competitionId: 'epl', markets: [market1x2('3.10', '3.25', '2.40')] },
        { id: 'ev-s3', homeTeam: 'Tottenham', awayTeam: 'Aston Villa', startTime: todayAt(17, 30), isLive: false, competitionId: 'epl', markets: [market1x2('2.10', '3.50', '3.40')] },
        { id: 'ev-s4', homeTeam: 'Real Madrid', awayTeam: 'Barcelona', startTime: todayAt(20, 0), isLive: false, competitionId: 'laliga', markets: [market1x2('2.50', '3.30', '2.80')] },
        { id: 'ev-s5', homeTeam: 'Atletico Madrid', awayTeam: 'Sevilla', startTime: todayAt(18, 0), isLive: false, competitionId: 'laliga', markets: [market1x2('1.75', '3.60', '4.80')] },
        { id: 'ev-s6', homeTeam: 'AC Milan', awayTeam: 'Juventus', startTime: todayAt(19, 45), isLive: false, competitionId: 'seriea', markets: [market1x2('2.30', '3.10', '3.20')] },
        { id: 'ev-s7', homeTeam: 'Inter Milan', awayTeam: 'Napoli', startTime: tomorrowAt(20, 45), isLive: false, competitionId: 'seriea', markets: [market1x2('1.90', '3.40', '4.00')] },
        { id: 'ev-s8', homeTeam: 'Bayern Munich', awayTeam: 'PSG', startTime: tomorrowAt(21, 0), isLive: false, competitionId: 'ucl', markets: [market1x2('1.85', '3.80', '3.90')] },
      ];
      return {
        name: 'Soccer',
        icon: '⚽',
        hasDrawMarket: true,
        competitions,
        events,
      };
    }

    case 'basketball': {
      const competitions: MockCompetition[] = [
        { id: 'nba', name: 'NBA', country: 'USA', flag: '🇺🇸' },
        { id: 'euroleague', name: 'EuroLeague', country: 'Europe', flag: '🇪🇺' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-b1', homeTeam: 'LA Lakers', awayTeam: 'Boston Celtics', startTime: hoursFromNow(-0.75), isLive: true, homeScore: 78, awayScore: 82, matchTime: 'Q3 4:32', competitionId: 'nba', markets: [marketML('2.10', '1.75')] },
        { id: 'ev-b2', homeTeam: 'Golden State Warriors', awayTeam: 'Milwaukee Bucks', startTime: hoursFromNow(-0.3), isLive: true, homeScore: 54, awayScore: 48, matchTime: 'Q2 1:15', competitionId: 'nba', markets: [marketML('1.65', '2.25')] },
        { id: 'ev-b3', homeTeam: 'Denver Nuggets', awayTeam: 'Philadelphia 76ers', startTime: todayAt(19, 0), isLive: false, competitionId: 'nba', markets: [marketML('1.55', '2.45')] },
        { id: 'ev-b4', homeTeam: 'Dallas Mavericks', awayTeam: 'Phoenix Suns', startTime: todayAt(21, 30), isLive: false, competitionId: 'nba', markets: [marketML('1.80', '2.00')] },
      ];
      return {
        name: 'Basketball',
        icon: '🏀',
        hasDrawMarket: false,
        competitions,
        events,
      };
    }

    default: {
      const displayName = slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const competitions: MockCompetition[] = [
        { id: 'comp1', name: `${displayName} League`, country: 'International', flag: '🌍' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-d1', homeTeam: 'Team A', awayTeam: 'Team B', startTime: todayAt(16, 0), isLive: false, competitionId: 'comp1', markets: [marketML('1.90', '1.90')] },
      ];
      return {
        name: displayName,
        icon: '🏆',
        hasDrawMarket: false,
        competitions,
        events,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SportPage() {
  const { slug } = useParams<{ slug: string }>();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [collapsedComps, setCollapsedComps] = useState<Record<string, boolean>>({});

  const config = useMemo(() => getSportConfig(slug), [slug]);
  const { toggleSelection, hasSelection } = useBetSlipStore();

  const filteredEvents = useMemo(() => {
    switch (timeFilter) {
      case 'live':
        return config.events.filter((e) => e.isLive);
      case 'today':
        return config.events.filter((e) => isToday(e.startTime));
      case 'tomorrow':
        return config.events.filter((e) => isTomorrow(e.startTime));
      default:
        return config.events;
    }
  }, [config.events, timeFilter]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [filteredEvents]);

  const groupedByCompetition = useMemo(() => {
    const groups: { competition: MockCompetition; events: MockEvent[] }[] = [];
    const map = new Map<string, MockEvent[]>();

    for (const event of sortedEvents) {
      if (!map.has(event.competitionId)) {
        map.set(event.competitionId, []);
      }
      map.get(event.competitionId)!.push(event);
    }

    for (const [compId, events] of Array.from(map.entries())) {
      const comp = config.competitions.find((c) => c.id === compId);
      if (comp) {
        groups.push({ competition: comp, events });
      }
    }

    return groups;
  }, [sortedEvents, config.competitions]);

  const liveCount = useMemo(() => config.events.filter((e) => e.isLive).length, [config.events]);
  const todayCount = useMemo(() => config.events.filter((e) => isToday(e.startTime)).length, [config.events]);
  const tomorrowCount = useMemo(() => config.events.filter((e) => isTomorrow(e.startTime)).length, [config.events]);

  const handleOddsClick = (event: MockEvent, selection: MockSelection) => {
    const market = event.markets[0];
    const item: BetSlipItem = {
      selectionId: selection.id,
      selectionName: selection.name === '1' ? event.homeTeam : selection.name === '2' ? event.awayTeam : 'Draw',
      marketName: market.name,
      eventName: `${event.homeTeam} vs ${event.awayTeam}`,
      eventId: event.id,
      odds: selection.odds,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    };
    toggleSelection(item);
  };

  const toggleCompetition = (compId: string) => {
    setCollapsedComps((prev) => ({ ...prev, [compId]: !prev[compId] }));
  };

  return (
    <div className="w-full px-4 max-w-5xl mx-auto pb-20 space-y-4">
      {/* Breadcrumb: small, muted */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 pt-4">
        <Link href="/sports" className="hover:text-purple-400 transition-colors">
          Sports
        </Link>
        <ChevronRight className="w-3 h-3 text-gray-700" />
        <span className="text-white font-medium">{config.name}</span>
      </nav>

      {/* Header: sport icon + name (20px bold) + live count badge */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{config.icon}</span>
        <h1 className="text-[20px] font-bold text-white">{config.name}</h1>
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-500/15 border border-green-500/30">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-green-400">{liveCount} Live</span>
          </span>
        )}
      </div>

      {/* Filter tabs: sticky, h-9, 4px radius, proper spacing */}
      <div className="sticky top-0 z-10 bg-[#0F1011] py-2 -mx-4 px-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setTimeFilter('all')}
            className={cn(
              'h-9 px-4 rounded text-sm font-medium transition-all border whitespace-nowrap',
              timeFilter === 'all'
                ? 'bg-purple-500/15 text-white border-purple-500'
                : 'bg-transparent text-gray-400 border-white/[0.06] hover:text-white hover:border-white/10'
            )}
          >
            All
          </button>
          <button
            onClick={() => setTimeFilter('today')}
            className={cn(
              'h-9 px-4 rounded text-sm font-medium transition-all border whitespace-nowrap',
              timeFilter === 'today'
                ? 'bg-purple-500/15 text-white border-purple-500'
                : 'bg-transparent text-gray-400 border-white/[0.06] hover:text-white hover:border-white/10'
            )}
          >
            Today {todayCount > 0 && `(${todayCount})`}
          </button>
          <button
            onClick={() => setTimeFilter('tomorrow')}
            className={cn(
              'h-9 px-4 rounded text-sm font-medium transition-all border whitespace-nowrap',
              timeFilter === 'tomorrow'
                ? 'bg-purple-500/15 text-white border-purple-500'
                : 'bg-transparent text-gray-400 border-white/[0.06] hover:text-white hover:border-white/10'
            )}
          >
            Tomorrow {tomorrowCount > 0 && `(${tomorrowCount})`}
          </button>
          {liveCount > 0 && (
            <button
              onClick={() => setTimeFilter('live')}
              className={cn(
                'h-9 px-4 rounded text-sm font-medium transition-all border whitespace-nowrap flex items-center gap-1.5',
                timeFilter === 'live'
                  ? 'bg-green-500/15 text-green-400 border-green-500'
                  : 'bg-transparent text-gray-400 border-white/[0.06] hover:text-white hover:border-white/10'
              )}
            >
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Live ({liveCount})
            </button>
          )}
        </div>
      </div>

      {/* Events grouped by competition */}
      {sortedEvents.length === 0 ? (
        <div className="rounded border border-white/[0.06] bg-[#1A1B1F] text-center py-16">
          <p className="text-gray-400 text-base font-medium">No events found</p>
          <p className="text-sm text-gray-600 mt-1">
            {timeFilter !== 'all' ? 'Try selecting a different filter.' : 'Events will appear here when scheduled.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByCompetition.map(({ competition, events }) => {
            const isCollapsed = collapsedComps[competition.id];
            return (
              <div key={competition.id} className="rounded overflow-hidden border border-white/[0.04]">
                {/* Competition header: 13px muted, h-10 */}
                <button
                  onClick={() => toggleCompetition(competition.id)}
                  className="w-full flex items-center justify-between px-4 h-10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{competition.flag}</span>
                    <span className="text-[13px] font-medium text-gray-400">{competition.name}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-gray-600 transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                </button>

                {/* Event rows: teams stacked (14px), time (12px), odds buttons (h-9, min-w-[64px], 4px radius) */}
                {!isCollapsed && events.map((event, idx) => (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 bg-[#1A1B1F] hover:bg-[#222328] transition-colors',
                      idx !== events.length - 1 && 'border-b border-white/[0.04]'
                    )}
                  >
                    {/* Time column: 12px */}
                    <div className="w-20 shrink-0">
                      {event.isLive ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[12px] font-bold text-green-400">LIVE</span>
                          </div>
                          {event.matchTime && (
                            <span className="text-[12px] text-green-400">{event.matchTime}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12px] text-gray-500">
                          {new Date(event.startTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    {/* Teams stacked: 14px */}
                    <Link href={`/sports/event/${event.id}`} className="flex-1 min-w-0">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-white font-medium truncate">
                            {event.homeTeam}
                          </span>
                          {event.isLive && event.homeScore !== undefined && (
                            <span className="text-[14px] font-bold font-mono text-white tabular-nums ml-2">
                              {event.homeScore}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-white font-medium truncate">
                            {event.awayTeam}
                          </span>
                          {event.isLive && event.awayScore !== undefined && (
                            <span className="text-[14px] font-bold font-mono text-white tabular-nums ml-2">
                              {event.awayScore}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Odds buttons: h-9, min-w-[64px], 4px radius, one-line (label + odds) */}
                    <div className="flex gap-2 shrink-0">
                      {event.markets[0]?.selections.map((sel) => {
                        const selected = hasSelection(sel.id);
                        return (
                          <button
                            key={sel.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOddsClick(event, sel);
                            }}
                            className={cn(
                              'h-9 min-w-[64px] flex items-center justify-center gap-1.5 rounded transition-all font-mono text-xs font-bold',
                              selected
                                ? 'bg-purple-600/20 ring-1 ring-purple-500 text-purple-300'
                                : 'bg-white/[0.06] hover:bg-white/[0.10] text-white'
                            )}
                          >
                            <span className="text-gray-500 text-[11px] font-normal">{sel.name}</span>
                            <span>{sel.odds}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
