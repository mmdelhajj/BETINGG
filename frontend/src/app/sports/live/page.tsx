'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn, formatOdds } from '@/lib/utils';
import { RefreshCw, ChevronDown, Activity, TrendingUp, TrendingDown } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  Types for mock live data
// ═══════════════════════════════════════════════════════════════════

interface LiveSelection {
  id: string;
  name: string;
  outcome: string;
  odds: number;
  previousOdds?: number;
}

interface LiveMarket {
  id: string;
  name: string;
  type: string;
  selections: LiveSelection[];
}

interface LiveEvent {
  id: string;
  sport: string;
  sportEmoji: string;
  competition: string;
  competitionCountry: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchTime: string;
  period: string;
  markets: LiveMarket[];
  totalMarkets: number;
  stats?: {
    possession?: { home: number; away: number };
    shotsOnTarget?: { home: number; away: number };
  };
}

// ═══════════════════════════════════════════════════════════════════
//  Mock Data
// ═══════════════════════════════════════════════════════════════════

const MOCK_LIVE_EVENTS: LiveEvent[] = [
  {
    id: 'live-soccer-1',
    sport: 'soccer',
    sportEmoji: '⚽',
    competition: 'Premier League',
    competitionCountry: 'England',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeScore: 2,
    awayScore: 1,
    matchTime: "67'",
    period: '2nd Half',
    totalMarkets: 142,
    stats: {
      possession: { home: 58, away: 42 },
      shotsOnTarget: { home: 7, away: 4 },
    },
    markets: [
      {
        id: 'mkt-s1',
        name: '1X2',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-s1-1', name: 'Arsenal', outcome: 'home', odds: 1.45 },
          { id: 'sel-s1-x', name: 'Draw', outcome: 'draw', odds: 4.8 },
          { id: 'sel-s1-2', name: 'Chelsea', outcome: 'away', odds: 6.5 },
        ],
      },
    ],
  },
  {
    id: 'live-soccer-2',
    sport: 'soccer',
    sportEmoji: '⚽',
    competition: 'Premier League',
    competitionCountry: 'England',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester United',
    homeScore: 0,
    awayScore: 0,
    matchTime: "23'",
    period: '1st Half',
    totalMarkets: 138,
    stats: {
      possession: { home: 63, away: 37 },
      shotsOnTarget: { home: 3, away: 1 },
    },
    markets: [
      {
        id: 'mkt-s2',
        name: '1X2',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-s2-1', name: 'Liverpool', outcome: 'home', odds: 1.72 },
          { id: 'sel-s2-x', name: 'Draw', outcome: 'draw', odds: 3.6 },
          { id: 'sel-s2-2', name: 'Man Utd', outcome: 'away', odds: 5.0 },
        ],
      },
    ],
  },
  {
    id: 'live-nba-1',
    sport: 'basketball',
    sportEmoji: '🏀',
    competition: 'NBA',
    competitionCountry: 'USA',
    homeTeam: 'LA Lakers',
    awayTeam: 'Boston Celtics',
    homeScore: 89,
    awayScore: 94,
    matchTime: 'Q3 8:21',
    period: 'Q3',
    totalMarkets: 78,
    markets: [
      {
        id: 'mkt-b1',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-b1-1', name: 'LA Lakers', outcome: 'home', odds: 2.35 },
          { id: 'sel-b1-2', name: 'Boston Celtics', outcome: 'away', odds: 1.58 },
        ],
      },
    ],
  },
  {
    id: 'live-nba-2',
    sport: 'basketball',
    sportEmoji: '🏀',
    competition: 'NBA',
    competitionCountry: 'USA',
    homeTeam: 'Golden State Warriors',
    awayTeam: 'Milwaukee Bucks',
    homeScore: 112,
    awayScore: 108,
    matchTime: 'Q4 3:45',
    period: 'Q4',
    totalMarkets: 64,
    markets: [
      {
        id: 'mkt-b2',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-b2-1', name: 'Warriors', outcome: 'home', odds: 1.42 },
          { id: 'sel-b2-2', name: 'Bucks', outcome: 'away', odds: 2.85 },
        ],
      },
    ],
  },
  {
    id: 'live-hockey-1',
    sport: 'ice-hockey',
    sportEmoji: '🏒',
    competition: 'NHL',
    competitionCountry: 'USA/Canada',
    homeTeam: 'Toronto Maple Leafs',
    awayTeam: 'NY Rangers',
    homeScore: 3,
    awayScore: 2,
    matchTime: 'P2 14:32',
    period: 'P2',
    totalMarkets: 56,
    markets: [
      {
        id: 'mkt-h1',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-h1-1', name: 'Maple Leafs', outcome: 'home', odds: 1.65 },
          { id: 'sel-h1-2', name: 'Rangers', outcome: 'away', odds: 2.2 },
        ],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  Sport filter tabs config
// ═══════════════════════════════════════════════════════════════════

const SPORT_FILTERS = [
  { key: 'all', label: 'All', emoji: '' },
  { key: 'soccer', label: 'Soccer', emoji: '⚽' },
  { key: 'basketball', label: 'Basketball', emoji: '🏀' },
  { key: 'ice-hockey', label: 'Ice Hockey', emoji: '🏒' },
] as const;

// ═══════════════════════════════════════════════════════════════════
//  OddsButton with trend arrows
// ═══════════════════════════════════════════════════════════════════

type OddsFlash = 'up' | 'down' | null;

function LiveOddsButton({
  selectionId: _selectionId,
  label,
  odds,
  isSelected,
  onSelect,
}: {
  selectionId: string;
  label: string;
  odds: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [flash, setFlash] = useState<OddsFlash>(null);
  const prevOddsRef = useRef<number>(odds);

  useEffect(() => {
    if (prevOddsRef.current !== odds) {
      const dir = odds > prevOddsRef.current ? 'up' : 'down';
      setFlash(dir);
      const timer = setTimeout(() => setFlash(null), 1200);
      prevOddsRef.current = odds;
      return () => clearTimeout(timer);
    }
  }, [odds]);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] rounded px-2 font-mono text-sm font-bold transition-all relative',
        isSelected
          ? 'bg-purple-600/25 ring-1 ring-purple-500 text-purple-300'
          : 'bg-white/[0.06] hover:bg-white/[0.10] text-white active:scale-95',
        flash === 'up' && 'bg-green-500/10',
        flash === 'down' && 'bg-red-500/10',
      )}
    >
      <span className="text-[11px] font-normal text-gray-500 leading-none">{label}</span>
      <span className="flex items-center gap-1">
        {flash === 'up' && (
          <TrendingUp className="w-3 h-3 text-green-400" />
        )}
        {flash === 'down' && (
          <TrendingDown className="w-3 h-3 text-red-400" />
        )}
        {formatOdds(odds)}
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Live Stats Mini Bar - constrained width to avoid overflow
// ═══════════════════════════════════════════════════════════════════

function LiveStatsMini({ stats }: { stats: LiveEvent['stats'] }) {
  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.04] text-[11px]">
      {stats.possession && (
        <div className="flex items-center gap-2 flex-1 min-w-0 max-w-[200px]">
          <span className="text-gray-500 w-6 text-right font-mono tabular-nums shrink-0">{stats.possession.home}%</span>
          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden flex">
            <div
              className="h-full bg-purple-500 transition-all duration-1000"
              style={{ width: `${stats.possession.home}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all duration-1000"
              style={{ width: `${stats.possession.away}%` }}
            />
          </div>
          <span className="text-gray-500 w-6 font-mono tabular-nums shrink-0">{stats.possession.away}%</span>
          <span className="text-gray-600 text-[11px] shrink-0">Poss</span>
        </div>
      )}
      {stats.shotsOnTarget && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-gray-500 font-mono tabular-nums">{stats.shotsOnTarget.home}</span>
          <span className="text-gray-600">SOT</span>
          <span className="text-gray-500 font-mono tabular-nums">{stats.shotsOnTarget.away}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Live Event Card
// ═══════════════════════════════════════════════════════════════════

function LiveEventCard({ event }: { event: LiveEvent }) {
  const { toggleSelection, hasSelection } = useBetSlipStore();
  const market = event.markets[0];
  const selections = market?.selections || [];
  const isThreeWay = selections.length === 3;

  const handleSelect = useCallback(
    (sel: LiveSelection) => {
      toggleSelection({
        selectionId: sel.id,
        selectionName: sel.name,
        marketName: market?.name || '',
        eventName: `${event.homeTeam} vs ${event.awayTeam}`,
        eventId: event.id,
        odds: String(sel.odds),
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
      });
    },
    [toggleSelection, market, event],
  );

  const homeSel = selections.find((s) => s.outcome === 'home') || selections[0];
  const drawSel = selections.find((s) => s.outcome === 'draw');
  const awaySel = selections.find((s) => s.outcome === 'away') || selections[selections.length - 1];

  return (
    <div className="border-l-[3px] border-l-green-500">
      <Link
        href={`/sports/event/${event.id}`}
        className="block rounded-r-lg overflow-hidden bg-white/[0.03] border border-white/8 border-l-0 hover:border-white/12 hover:bg-white/[0.04] transition-all"
      >
        <div className="px-4 py-3">
          {/* Top row: time badge + competition */}
          <div className="flex items-center justify-between mb-3 min-h-[44px]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Pulsing live badge */}
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-red-500/15 text-red-400 shrink-0">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                {event.period} {event.matchTime}
              </span>
              {/* Competition name - truncate if too long */}
              <span className="text-[11px] text-gray-500 font-medium truncate">
                {event.competition}
              </span>
            </div>
            {/* More markets link */}
            {event.totalMarkets > 1 && (
              <span className="text-[11px] text-purple-400 font-semibold shrink-0">
                +{event.totalMarkets - 1}
              </span>
            )}
          </div>

          {/* Main content: Teams + Score */}
          <div className="flex items-center justify-between mb-3">
            {/* Teams column - constrain with max-width to prevent overflow */}
            <div className="flex-1 min-w-0 max-w-[60%]">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'text-sm font-semibold line-clamp-2',
                  event.homeScore > event.awayScore ? 'text-white' : 'text-gray-300',
                )}>
                  {event.homeTeam}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-semibold line-clamp-2',
                  event.awayScore > event.homeScore ? 'text-white' : 'text-gray-300',
                )}>
                  {event.awayTeam}
                </span>
              </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-end shrink-0">
              <span className="text-xl font-bold font-mono text-white leading-tight tabular-nums">
                {event.homeScore}
              </span>
              <span className="text-xl font-bold font-mono text-white leading-tight tabular-nums">
                {event.awayScore}
              </span>
            </div>
          </div>

          {/* Live stats */}
          <LiveStatsMini stats={event.stats} />

          {/* Odds row - 3-col on mobile when possible */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {homeSel && (
              <LiveOddsButton
                selectionId={homeSel.id}
                label={isThreeWay ? '1' : homeSel.name}
                odds={homeSel.odds}
                isSelected={hasSelection(homeSel.id)}
                onSelect={() => handleSelect(homeSel)}
              />
            )}
            {isThreeWay && drawSel && (
              <LiveOddsButton
                selectionId={drawSel.id}
                label="X"
                odds={drawSel.odds}
                isSelected={hasSelection(drawSel.id)}
                onSelect={() => handleSelect(drawSel)}
              />
            )}
            {awaySel && (
              <LiveOddsButton
                selectionId={awaySel.id}
                label={isThreeWay ? '2' : awaySel.name}
                odds={awaySel.odds}
                isSelected={hasSelection(awaySel.id)}
                onSelect={() => handleSelect(awaySel)}
              />
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Competition Group
// ═══════════════════════════════════════════════════════════════════

function CompetitionGroup({
  competition,
  events,
}: {
  competition: string;
  events: LiveEvent[];
}) {
  return (
    <div>
      {/* Competition sub-header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.04] min-h-[44px]">
        <span className="text-xs text-gray-300 font-semibold">{competition}</span>
        <span className="text-[11px] text-gray-500">({events.length})</span>
      </div>
      {/* Event cards */}
      <div className="space-y-2 p-2">
        {events.map((event) => (
          <LiveEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Sport Section (collapsible)
// ═══════════════════════════════════════════════════════════════════

function SportSection({
  sportKey: _sportKey,
  sportEmoji,
  sportLabel,
  events,
  defaultOpen = true,
}: {
  sportKey: string;
  sportEmoji: string;
  sportLabel: string;
  events: LiveEvent[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
    <div className="rounded-lg border border-white/8 overflow-hidden bg-white/[0.02]">
      {/* Sport header - min 44px touch target */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[44px] flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/[0.07] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{sportEmoji}</span>
          <span className="text-sm font-bold text-white">{sportLabel}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[11px] font-bold">
            <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
            {events.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Competition groups */}
      {isOpen && (
        <div className="bg-white/[0.01]">
          {competitionGroups.map(([comp, evts]) => (
            <CompetitionGroup key={comp} competition={comp} events={evts} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Main Live Page
// ═══════════════════════════════════════════════════════════════════

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>(MOCK_LIVE_EVENTS);
  const [activeSport, setActiveSport] = useState<string>('all');
  const [isAutoUpdating, setIsAutoUpdating] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Simulate real-time odds changes
  useEffect(() => {
    if (!isAutoUpdating) return;

    const interval = setInterval(() => {
      setEvents((prev) =>
        prev.map((event) => ({
          ...event,
          markets: event.markets.map((mkt) => ({
            ...mkt,
            selections: mkt.selections.map((sel) => {
              // 30% chance of a small odds change
              if (Math.random() < 0.3) {
                const shift = (Math.random() - 0.5) * 0.12;
                const newOdds = Math.max(1.01, sel.odds + shift);
                return { ...sel, previousOdds: sel.odds, odds: parseFloat(newOdds.toFixed(2)) };
              }
              return sel;
            }),
          })),
        })),
      );
      setLastUpdate(new Date());
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoUpdating]);

  // Simulate score changes occasionally
  useEffect(() => {
    if (!isAutoUpdating) return;

    const interval = setInterval(() => {
      setEvents((prev) => {
        const idx = Math.floor(Math.random() * prev.length);
        if (Math.random() > 0.95) {
          const updated = [...prev];
          const ev = { ...updated[idx] };
          const isHome = Math.random() > 0.5;
          if (ev.sport === 'basketball') {
            const pts = Math.random() > 0.5 ? 2 : 3;
            if (isHome) ev.homeScore += pts;
            else ev.awayScore += pts;
          } else if (ev.sport === 'soccer' || ev.sport === 'ice-hockey') {
            if (isHome) ev.homeScore += 1;
            else ev.awayScore += 1;
          }
          updated[idx] = ev;
          return updated;
        }
        return prev;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [isAutoUpdating]);

  // Count events per sport
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    for (const ev of events) {
      counts[ev.sport] = (counts[ev.sport] || 0) + 1;
    }
    return counts;
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (activeSport === 'all') return events;
    return events.filter((e) => e.sport === activeSport);
  }, [events, activeSport]);

  // Group by sport
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

  // Time since last update
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

  return (
    <div className="w-full px-4 max-w-5xl mx-auto pb-8">
      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-between mb-4 min-h-[44px]">
        <div className="flex items-center gap-2">
          <RefreshCw className={cn(
            "w-3.5 h-3.5 text-green-500 transition-transform",
            isAutoUpdating && "animate-spin"
          )} />
          <span className="text-[11px] text-gray-500">
            {isAutoUpdating ? 'Auto-updating' : 'Paused'} • {secondsAgo}s ago
          </span>
        </div>
        <button
          onClick={() => setIsAutoUpdating(!isAutoUpdating)}
          className={cn(
            'min-h-[44px] px-3 py-1 text-[11px] rounded border transition-colors',
            isAutoUpdating
              ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
              : 'text-gray-500 border-white/10 hover:text-white hover:border-white/20',
          )}
        >
          {isAutoUpdating ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          Live Events
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/15">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-sm font-bold text-red-400">{events.length}</span>
          </span>
        </h1>
      </div>

      {/* Sport Filter Tabs - horizontal scroll, 44px min height, snap, fade gradient */}
      <div className="relative mb-5">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory">
          {SPORT_FILTERS.map((filter) => {
            const count = sportCounts[filter.key] || 0;
            const isActive = activeSport === filter.key;

            return (
              <button
                key={filter.key}
                onClick={() => setActiveSport(filter.key)}
                className={cn(
                  'min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border snap-start',
                  isActive
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/[0.07] hover:text-white',
                )}
              >
                {filter.emoji && <span>{filter.emoji}</span>}
                {filter.label}
                <span
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded-full font-bold',
                    isActive
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-white/10 text-gray-500',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0b0d] to-transparent pointer-events-none" />
      </div>

      {/* Live Events grouped by sport */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-lg border border-white/8 bg-white/[0.02] text-center py-16 px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <Activity className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-300 font-medium text-lg mb-1">No live events for this sport</p>
          <p className="text-sm text-gray-600 max-w-sm mx-auto">
            Try selecting a different sport filter or check back later.
          </p>
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
              defaultOpen={true}
            />
          ))}
        </div>
      )}

      {/* Bottom summary */}
      <div className="mt-6 mb-4 flex items-center justify-center gap-2 text-[11px] text-gray-600">
        <Activity className="w-3 h-3" />
        <span>
          {events.length} live events • Odds update every ~4s
        </span>
      </div>
    </div>
  );
}
