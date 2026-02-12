'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn } from '@/lib/utils';
import type { BetSlipItem } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveSelection {
  id: string;
  name: string;
  odds: number;
  previousOdds?: number;
}

interface LiveMarket {
  id: string;
  name: string;
  selections: LiveSelection[];
}

interface LiveEvent {
  id: string;
  sport: string;
  sportEmoji: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchTime: string;
  markets: LiveMarket[];
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const INITIAL_EVENTS: LiveEvent[] = [
  {
    id: 'live-s1',
    sport: 'soccer',
    sportEmoji: '⚽',
    competition: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeScore: 2,
    awayScore: 1,
    matchTime: "67'",
    markets: [
      {
        id: 'mkt-s1',
        name: '1X2',
        selections: [
          { id: 'sel-s1-1', name: '1', odds: 1.45 },
          { id: 'sel-s1-x', name: 'X', odds: 4.8 },
          { id: 'sel-s1-2', name: '2', odds: 6.5 },
        ],
      },
    ],
  },
  {
    id: 'live-s2',
    sport: 'soccer',
    sportEmoji: '⚽',
    competition: 'Premier League',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester United',
    homeScore: 0,
    awayScore: 0,
    matchTime: "23'",
    markets: [
      {
        id: 'mkt-s2',
        name: '1X2',
        selections: [
          { id: 'sel-s2-1', name: '1', odds: 1.72 },
          { id: 'sel-s2-x', name: 'X', odds: 3.6 },
          { id: 'sel-s2-2', name: '2', odds: 5.0 },
        ],
      },
    ],
  },
  {
    id: 'live-b1',
    sport: 'basketball',
    sportEmoji: '🏀',
    competition: 'NBA',
    homeTeam: 'LA Lakers',
    awayTeam: 'Boston Celtics',
    homeScore: 89,
    awayScore: 94,
    matchTime: 'Q3 8:21',
    markets: [
      {
        id: 'mkt-b1',
        name: 'Money Line',
        selections: [
          { id: 'sel-b1-1', name: '1', odds: 2.35 },
          { id: 'sel-b1-2', name: '2', odds: 1.58 },
        ],
      },
    ],
  },
  {
    id: 'live-b2',
    sport: 'basketball',
    sportEmoji: '🏀',
    competition: 'NBA',
    homeTeam: 'Golden State Warriors',
    awayTeam: 'Milwaukee Bucks',
    homeScore: 112,
    awayScore: 108,
    matchTime: 'Q4 3:45',
    markets: [
      {
        id: 'mkt-b2',
        name: 'Money Line',
        selections: [
          { id: 'sel-b2-1', name: '1', odds: 1.42 },
          { id: 'sel-b2-2', name: '2', odds: 2.85 },
        ],
      },
    ],
  },
  {
    id: 'live-h1',
    sport: 'ice-hockey',
    sportEmoji: '🏒',
    competition: 'NHL',
    homeTeam: 'Toronto Maple Leafs',
    awayTeam: 'NY Rangers',
    homeScore: 3,
    awayScore: 2,
    matchTime: 'P2 14:32',
    markets: [
      {
        id: 'mkt-h1',
        name: 'Money Line',
        selections: [
          { id: 'sel-h1-1', name: '1', odds: 1.65 },
          { id: 'sel-h1-2', name: '2', odds: 2.2 },
        ],
      },
    ],
  },
];

const SPORT_FILTERS = [
  { key: 'all', label: 'All', emoji: '' },
  { key: 'soccer', label: 'Soccer', emoji: '⚽' },
  { key: 'basketball', label: 'Basketball', emoji: '🏀' },
  { key: 'ice-hockey', label: 'Ice Hockey', emoji: '🏒' },
];

// ---------------------------------------------------------------------------
// Odds Button with trend arrows (small, 10px)
// ---------------------------------------------------------------------------

function LiveOddsButton({
  selection,
  label,
  isSelected,
  onSelect,
}: {
  selection: LiveSelection;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const trend =
    selection.previousOdds !== undefined
      ? selection.odds > selection.previousOdds
        ? 'up'
        : selection.odds < selection.previousOdds
        ? 'down'
        : null
      : null;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        'h-9 min-w-[64px] flex items-center justify-center gap-1 rounded transition-all font-mono text-xs font-bold',
        isSelected
          ? 'bg-purple-600/20 ring-1 ring-purple-500 text-purple-300'
          : 'bg-white/[0.06] hover:bg-white/[0.10] text-white'
      )}
    >
      <span className="text-gray-500 text-[10px] font-normal">{label}</span>
      <span className="flex items-center gap-0.5">
        {trend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-green-400" />}
        {trend === 'down' && <TrendingDown className="w-2.5 h-2.5 text-red-400" />}
        {selection.odds.toFixed(2)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Competition Group
// ---------------------------------------------------------------------------

function CompetitionGroup({
  competition,
  events,
}: {
  competition: string;
  events: LiveEvent[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { toggleSelection, hasSelection } = useBetSlipStore();

  const handleOddsClick = (event: LiveEvent, selection: LiveSelection) => {
    const market = event.markets[0];
    const item: BetSlipItem = {
      selectionId: selection.id,
      selectionName: selection.name === '1' ? event.homeTeam : selection.name === '2' ? event.awayTeam : 'Draw',
      marketName: market.name,
      eventName: `${event.homeTeam} vs ${event.awayTeam}`,
      eventId: event.id,
      odds: selection.odds.toString(),
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    };
    toggleSelection(item);
  };

  return (
    <div className="rounded overflow-hidden border border-white/[0.04]">
      {/* Competition header: 13px muted, h-10 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 h-10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-gray-400 font-medium">{competition}</span>
          <span className="text-xs text-gray-600">({events.length})</span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-600 transition-transform',
            isCollapsed && '-rotate-90'
          )}
        />
      </button>

      {/* Event rows: 2px green left border, match time in green, scores bold mono */}
      {!isCollapsed && events.map((event, idx) => (
        <div
          key={event.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 bg-[#1A1B1F] hover:bg-[#222328] transition-colors border-l-2 border-l-green-500',
            idx !== events.length - 1 && 'border-b border-white/[0.04]'
          )}
        >
          {/* Live indicator + Time in green */}
          <div className="w-20 shrink-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[12px] font-bold text-green-400">LIVE</span>
            </div>
            <span className="text-[12px] text-green-400">{event.matchTime}</span>
          </div>

          {/* Teams + Scores bold mono */}
          <Link href={`/sports/event/${event.id}`} className="flex-1 min-w-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-white font-medium truncate">
                  {event.homeTeam}
                </span>
                <span className="text-base font-bold font-mono text-white tabular-nums ml-2">
                  {event.homeScore}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-white font-medium truncate">
                  {event.awayTeam}
                </span>
                <span className="text-base font-bold font-mono text-white tabular-nums ml-2">
                  {event.awayScore}
                </span>
              </div>
            </div>
          </Link>

          {/* Odds buttons with trend arrows (10px) */}
          <div className="flex gap-2 shrink-0">
            {event.markets[0]?.selections.map((sel) => {
              const selected = hasSelection(sel.id);
              return (
                <LiveOddsButton
                  key={sel.id}
                  selection={sel}
                  label={sel.name}
                  isSelected={selected}
                  onSelect={() => handleOddsClick(event, sel)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sport Section
// ---------------------------------------------------------------------------

function SportSection({
  sportEmoji,
  sportLabel,
  events,
}: {
  sportKey: string;
  sportEmoji: string;
  sportLabel: string;
  events: LiveEvent[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const competitionGroups = useMemo(() => {
    const groups = new Map<string, LiveEvent[]>();
    for (const ev of events) {
      const comp = ev.competition;
      if (!groups.has(comp)) groups.set(comp, []);
      groups.get(comp)!.push(ev);
    }
    return Array.from(groups.entries());
  }, [events]);

  return (
    <div className="rounded overflow-hidden border border-white/[0.04]">
      {/* Sport header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 h-12 bg-white/[0.05] hover:bg-white/[0.07] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{sportEmoji}</span>
          <span className="text-sm font-bold text-white">{sportLabel}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/15 text-green-400 text-xs font-bold">
            <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
            {events.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform',
            isCollapsed && '-rotate-90'
          )}
        />
      </button>

      {/* Competition groups */}
      {!isCollapsed && (
        <div className="space-y-0">
          {competitionGroups.map(([comp, evts]) => (
            <CompetitionGroup key={comp} competition={comp} events={evts} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Live Page
// ---------------------------------------------------------------------------

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>(INITIAL_EVENTS);
  const [activeSport, setActiveSport] = useState<string>('all');

  // Auto-refresh every 5s - simulate odds changes
  useEffect(() => {
    const interval = setInterval(() => {
      setEvents((prev) =>
        prev.map((event) => ({
          ...event,
          markets: event.markets.map((mkt) => ({
            ...mkt,
            selections: mkt.selections.map((sel) => {
              // 30% chance of a small odds change
              if (Math.random() < 0.3) {
                const shift = (Math.random() - 0.5) * 0.1;
                const newOdds = Math.max(1.01, sel.odds + shift);
                return { ...sel, previousOdds: sel.odds, odds: parseFloat(newOdds.toFixed(2)) };
              }
              return sel;
            }),
          })),
        }))
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    for (const ev of events) {
      counts[ev.sport] = (counts[ev.sport] || 0) + 1;
    }
    return counts;
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (activeSport === 'all') return events;
    return events.filter((e) => e.sport === activeSport);
  }, [events, activeSport]);

  const groupedBySport = useMemo(() => {
    const groups = new Map<string, { key: string; emoji: string; label: string; events: LiveEvent[] }>();
    for (const ev of filteredEvents) {
      if (!groups.has(ev.sport)) {
        const filter = SPORT_FILTERS.find((f) => f.key === ev.sport);
        groups.set(ev.sport, {
          key: ev.sport,
          emoji: ev.sportEmoji,
          label: filter?.label || ev.sport,
          events: [],
        });
      }
      groups.get(ev.sport)!.events.push(ev);
    }
    return Array.from(groups.values());
  }, [filteredEvents]);

  return (
    <div className="w-full px-4 max-w-5xl mx-auto pb-20 space-y-4">
      {/* Header: "Live" + green dot + count badge */}
      <div className="flex items-center gap-3 pt-4">
        <h1 className="text-[22px] font-bold text-white">Live</h1>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-500/15">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-bold text-green-400">{events.length}</span>
        </span>
      </div>

      {/* Sport filter pills: horizontal scroll, h-9, 4px radius */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {SPORT_FILTERS.map((filter) => {
          const count = sportCounts[filter.key] || 0;
          const isActive = activeSport === filter.key;

          return (
            <button
              key={filter.key}
              onClick={() => setActiveSport(filter.key)}
              className={cn(
                'h-9 flex items-center gap-1.5 px-4 rounded text-sm font-medium whitespace-nowrap transition-all border',
                isActive
                  ? 'bg-purple-500/15 text-white border-purple-500'
                  : 'bg-transparent text-gray-400 border-white/[0.06] hover:text-white hover:border-white/10'
              )}
            >
              {filter.emoji && <span>{filter.emoji}</span>}
              {filter.label}
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded font-bold',
                  isActive ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-gray-500'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live events grouped by sport > competition */}
      {filteredEvents.length === 0 ? (
        <div className="rounded border border-white/[0.06] bg-[#1A1B1F] text-center py-16">
          <p className="text-gray-400 text-base font-medium">No live events</p>
          <p className="text-sm text-gray-600 mt-1">Check back later or try a different sport.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBySport.map((group) => (
            <SportSection
              key={group.key}
              sportKey={group.key}
              sportEmoji={group.emoji}
              sportLabel={group.label}
              events={group.events}
            />
          ))}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <p className="text-center text-xs text-gray-600 pt-2">
        Odds update automatically every 5 seconds
      </p>
    </div>
  );
}
