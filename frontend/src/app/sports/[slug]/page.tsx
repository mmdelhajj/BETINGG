'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { sportsApi } from '@/lib/api';
import { SportIcon } from '@/components/sports/SportIcon';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn, formatOdds } from '@/lib/utils';
import { ChevronDown, Clock, TrendingUp } from 'lucide-react';
import type { Event, Competition, Sport, Selection } from '@/types';

// ---------- Filter types ----------
type TimeFilter = 'all' | 'live' | 'today' | 'tomorrow' | 'outrights';
type SortMode = 'time' | 'popularity';

// ---------- Inline Odds Button ----------
function CompactOddsButton({
  selection,
  _label,
  isSelected,
  onSelect,
  disabled,
}: {
  selection: Selection | null;
  _label: string;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  if (!selection) {
    return (
      <div className="flex-1 min-w-[60px] h-9 rounded bg-surface-tertiary/50 flex items-center justify-center">
        <span className="text-xs text-gray-600">-</span>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      disabled={disabled || selection.status !== 'ACTIVE'}
      className={cn(
        'flex-1 min-w-[60px] h-9 rounded text-center font-mono text-sm font-bold transition-all duration-150 border',
        isSelected
          ? 'bg-brand-500/20 border-brand-500 text-brand-400'
          : 'bg-surface-tertiary border-transparent hover:border-brand-500/40 text-white hover:bg-surface-hover',
        (disabled || selection.status !== 'ACTIVE') && 'opacity-40 cursor-not-allowed'
      )}
    >
      {formatOdds(selection.odds)}
    </button>
  );
}

// ---------- Event Row (Bet365-style) ----------
function EventRow({ event }: { event: Event }) {
  const { toggleSelection, hasSelection } = useBetSlipStore();

  const mainMarket = event.markets?.find((m) => m.type === 'MONEYLINE');
  const selections = mainMarket?.selections || [];
  const isThreeWay = selections.length === 3;
  const marketCount = event.markets ? event.markets.length : 0;

  const homeSel = selections.find((s) => s.outcome === 'home') || selections[0] || null;
  const drawSel = selections.find((s) => s.outcome === 'draw') || (isThreeWay ? selections[1] : null);
  const awaySel = selections.find((s) => s.outcome === 'away') || (isThreeWay ? selections[2] : selections[1]) || null;

  const handleSelect = (sel: Selection) => {
    if (!mainMarket) return;
    toggleSelection({
      selectionId: sel.id,
      selectionName: sel.name,
      marketName: mainMarket.name,
      eventName: event.name,
      eventId: event.id,
      odds: sel.odds,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
  };

  const isLive = event.isLive || event.status === 'LIVE';

  return (
    <Link
      href={`/sports/event/${event.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 transition-colors group border-b border-border-dim',
        'hover:bg-surface-hover/50'
      )}
    >
      {/* Time / Live indicator column */}
      <div className="w-14 shrink-0 text-center">
        {isLive ? (
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-accent-red uppercase">Live</span>
            </span>
            {event.metadata?.matchTime && (
              <span className="text-[10px] text-gray-500 mt-0.5">{event.metadata.matchTime}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-gray-400">
              {new Date(event.startTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-[10px] text-gray-500">
              {new Date(event.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Teams column */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-sm truncate', isLive ? 'font-semibold text-white' : 'text-gray-200')}>
            {event.homeTeam || event.name}
          </span>
          {isLive && event.homeScore !== null && event.homeScore !== undefined && (
            <span className="text-sm font-bold font-mono text-white ml-auto shrink-0">
              {event.homeScore}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm truncate', isLive ? 'font-semibold text-gray-300' : 'text-gray-400')}>
            {event.awayTeam || 'TBD'}
          </span>
          {isLive && event.awayScore !== null && event.awayScore !== undefined && (
            <span className="text-sm font-bold font-mono text-gray-300 ml-auto shrink-0">
              {event.awayScore}
            </span>
          )}
        </div>
      </div>

      {/* Odds columns */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-gray-600 uppercase">1</span>
          <CompactOddsButton
            selection={homeSel}
            _label="1"
            isSelected={homeSel ? hasSelection(homeSel.id) : false}
            onSelect={() => homeSel && handleSelect(homeSel)}
            disabled={mainMarket?.status !== 'OPEN'}
          />
        </div>
        {isThreeWay && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-gray-600 uppercase">X</span>
            <CompactOddsButton
              selection={drawSel}
              _label="X"
              isSelected={drawSel ? hasSelection(drawSel.id) : false}
              onSelect={() => drawSel && handleSelect(drawSel)}
              disabled={mainMarket?.status !== 'OPEN'}
            />
          </div>
        )}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-gray-600 uppercase">2</span>
          <CompactOddsButton
            selection={awaySel}
            _label="2"
            isSelected={awaySel ? hasSelection(awaySel.id) : false}
            onSelect={() => awaySel && handleSelect(awaySel)}
            disabled={mainMarket?.status !== 'OPEN'}
          />
        </div>
        {/* Market count indicator */}
        <div className="w-8 text-center">
          {marketCount > 1 && (
            <span className="text-[11px] text-brand-400 font-medium">+{marketCount - 1}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------- Collapsible Competition Group ----------
function CompetitionGroup({
  competition,
  events,
  defaultOpen = true,
}: {
  competition: Competition | undefined;
  events: Event[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Competition Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-secondary hover:bg-surface-tertiary transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white truncate">
            {competition?.name || 'Other'}
          </span>
          {competition?.country && (
            <span className="text-xs text-gray-500">{competition.country}</span>
          )}
          <span className="text-xs text-gray-600 shrink-0">({events.length})</span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Event Rows */}
      {isOpen && (
        <div className="bg-surface-secondary/30">
          {/* Odds column headers */}
          <div className="flex items-center gap-3 px-3 py-1 border-b border-border-dim bg-surface-secondary/50">
            <div className="w-14 shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex-1 min-w-[60px] text-center">
                <span className="text-[9px] text-gray-600 uppercase font-medium">1</span>
              </div>
              {events.some((e) => {
                const mm = e.markets?.find((m) => m.type === 'MONEYLINE');
                return mm && mm.selections.length === 3;
              }) && (
                <div className="flex-1 min-w-[60px] text-center">
                  <span className="text-[9px] text-gray-600 uppercase font-medium">X</span>
                </div>
              )}
              <div className="flex-1 min-w-[60px] text-center">
                <span className="text-[9px] text-gray-600 uppercase font-medium">2</span>
              </div>
              <div className="w-8" />
            </div>
          </div>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Helper: check if date is today / tomorrow ----------
function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
}

// ---------- Main Page ----------
export default function SportPage() {
  const { slug } = useParams<{ slug: string }>();
  const [sport, setSport] = useState<Sport | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [activeCompetition, setActiveCompetition] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);

    Promise.all([
      sportsApi.getSport(slug),
      sportsApi.getCompetitions(slug),
      sportsApi.getEvents({ sportSlug: slug }),
    ]).then(([sportRes, compRes, eventsRes]) => {
      setSport(sportRes.data.data || null);
      setCompetitions(Array.isArray(compRes.data.data) ? compRes.data.data : []);
      setEvents(Array.isArray(eventsRes.data.data) ? eventsRes.data.data : []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [slug]);

  // Apply time filter
  const timeFiltered = useMemo(() => {
    switch (timeFilter) {
      case 'live':
        return events.filter((e) => e.isLive || e.status === 'LIVE');
      case 'today':
        return events.filter((e) => isToday(e.startTime));
      case 'tomorrow':
        return events.filter((e) => isTomorrow(e.startTime));
      case 'outrights':
        return events.filter((e) => e.markets?.some((m) => m.type === 'OUTRIGHT'));
      default:
        return events;
    }
  }, [events, timeFilter]);

  // Apply competition filter
  const competitionFiltered = useMemo(() => {
    if (!activeCompetition) return timeFiltered;
    return timeFiltered.filter((e) => e.competitionId === activeCompetition);
  }, [timeFiltered, activeCompetition]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...competitionFiltered];
    if (sortMode === 'time') {
      sorted.sort((a, b) => {
        // Live events first
        const aLive = a.isLive || a.status === 'LIVE' ? 0 : 1;
        const bLive = b.isLive || b.status === 'LIVE' ? 0 : 1;
        if (aLive !== bLive) return aLive - bLive;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
    } else {
      // popularity = more markets = more popular (heuristic)
      sorted.sort((a, b) => (b.markets?.length || 0) - (a.markets?.length || 0));
    }
    return sorted;
  }, [competitionFiltered, sortMode]);

  // Count live events
  const liveCount = useMemo(
    () => events.filter((e) => e.isLive || e.status === 'LIVE').length,
    [events]
  );
  const todayCount = useMemo(
    () => events.filter((e) => isToday(e.startTime)).length,
    [events]
  );
  const tomorrowCount = useMemo(
    () => events.filter((e) => isTomorrow(e.startTime)).length,
    [events]
  );

  // Group by competition
  const eventsByCompetition = useMemo(() => {
    const groups: Record<string, { competition: Competition | undefined; events: Event[] }> = {};
    for (const event of sortedEvents) {
      const compId = event.competitionId;
      if (!groups[compId]) {
        const comp = competitions.find((c) => c.id === compId) || event.competition;
        groups[compId] = { competition: comp, events: [] };
      }
      groups[compId].events.push(event);
    }
    return Object.values(groups);
  }, [sortedEvents, competitions]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="h-8 w-48 animate-pulse bg-surface-tertiary rounded" />
        <div className="h-10 w-full animate-pulse bg-surface-tertiary rounded-lg" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-surface-tertiary rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const filterTabs: { key: TimeFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: events.length },
    { key: 'live', label: 'Live', count: liveCount },
    { key: 'today', label: 'Today', count: todayCount },
    { key: 'tomorrow', label: 'Tomorrow', count: tomorrowCount },
    { key: 'outrights', label: 'Outrights' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/sports" className="hover:text-brand-400 transition-colors">
          Sports
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-white font-medium">{sport?.name || slug}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-tertiary flex items-center justify-center">
            <SportIcon slug={slug} size={24} emoji={sport?.icon} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{sport?.name || slug}</h1>
            <p className="text-xs text-gray-500">
              {events.length} events
              {liveCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-accent-red">
                  <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
                  {liveCount} live
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center gap-1 bg-surface-secondary rounded-lg border border-border p-0.5">
          <button
            onClick={() => setSortMode('time')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
              sortMode === 'time' ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white'
            )}
          >
            <Clock className="w-3 h-3" />
            Time
          </button>
          <button
            onClick={() => setSortMode('popularity')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
              sortMode === 'popularity' ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white'
            )}
          >
            <TrendingUp className="w-3 h-3" />
            Popular
          </button>
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTimeFilter(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border',
              timeFilter === tab.key
                ? tab.key === 'live'
                  ? 'bg-accent-red/15 text-accent-red border-accent-red/30'
                  : 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                : 'bg-surface-secondary text-gray-400 border-transparent hover:bg-surface-tertiary hover:text-white'
            )}
          >
            {tab.key === 'live' && <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />}
            {tab.label}
            {tab.count !== null && tab.count !== undefined && (
              <span className="text-[10px] opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Competition Sub-filter (horizontal scroll) */}
      {competitions.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCompetition(null)}
            className={cn(
              'px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors border',
              !activeCompetition
                ? 'bg-surface-tertiary text-white border-border'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            )}
          >
            All Leagues
          </button>
          {competitions.map((comp) => {
            const count = events.filter((e) => e.competitionId === comp.id).length;
            if (count === 0) return null;
            return (
              <button
                key={comp.id}
                onClick={() => setActiveCompetition(activeCompetition === comp.id ? null : comp.id)}
                className={cn(
                  'px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors border',
                  activeCompetition === comp.id
                    ? 'bg-surface-tertiary text-white border-border'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                )}
              >
                {comp.name}
                <span className="ml-1 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Events grouped by competition */}
      {sortedEvents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-secondary text-center py-16">
          <p className="text-gray-400 text-lg font-medium mb-1">No events found</p>
          <p className="text-sm text-gray-600">
            {timeFilter !== 'all'
              ? 'Try changing the filter to see more events.'
              : 'Events will appear here when they are scheduled.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {eventsByCompetition.map(({ competition, events: compEvents }) => (
            <CompetitionGroup
              key={competition?.id || 'unknown'}
              competition={competition}
              events={compEvents}
              defaultOpen={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
