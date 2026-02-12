'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { sportsApi } from '@/lib/api';
import { SportIcon } from '@/components/sports/SportIcon';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { getSocket, connectSocket } from '@/lib/socket';
import { cn, formatOdds } from '@/lib/utils';
import { RefreshCw, Clock, ChevronDown } from 'lucide-react';
import type { Event, Selection } from '@/types';

const REFRESH_INTERVAL_MS = 30_000;

// ---------- Compact Odds Button ----------
function LiveOddsButton({
  selection,
  isSelected,
  onSelect,
  disabled,
}: {
  selection: Selection | null;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  if (!selection) {
    return (
      <div className="flex-1 min-w-[56px] h-9 rounded bg-surface-tertiary/50 flex items-center justify-center">
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
        'flex-1 min-w-[56px] h-9 rounded text-center font-mono text-sm font-bold transition-all duration-150 border',
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

// ---------- Live Event Row ----------
function LiveEventRow({ event }: { event: Event }) {
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

  return (
    <Link
      href={`/sports/event/${event.id}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors group border-b border-border-dim hover:bg-surface-hover/50"
    >
      {/* Time / Score column */}
      <div className="w-14 shrink-0 text-center">
        <div className="flex flex-col items-center">
          <span className="flex items-center gap-1 mb-0.5">
            <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
            <span className="text-[9px] font-bold text-accent-red uppercase">Live</span>
          </span>
          {event.metadata?.matchTime ? (
            <span className="text-[10px] text-gray-500">{event.metadata.matchTime}</span>
          ) : event.metadata?.period ? (
            <span className="text-[10px] text-gray-500">{event.metadata.period}</span>
          ) : null}
        </div>
      </div>

      {/* Teams + Scores */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-white truncate flex-1">
            {event.homeTeam || event.name}
          </span>
          <span className="text-sm font-bold font-mono text-white w-6 text-right shrink-0">
            {event.homeScore ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-300 truncate flex-1">
            {event.awayTeam || 'TBD'}
          </span>
          <span className="text-sm font-bold font-mono text-gray-300 w-6 text-right shrink-0">
            {event.awayScore ?? 0}
          </span>
        </div>
      </div>

      {/* Odds */}
      <div className="flex items-center gap-1.5 shrink-0">
        <LiveOddsButton
          selection={homeSel}
          isSelected={homeSel ? hasSelection(homeSel.id) : false}
          onSelect={() => homeSel && handleSelect(homeSel)}
          disabled={mainMarket?.status !== 'OPEN'}
        />
        {isThreeWay && (
          <LiveOddsButton
            selection={drawSel}
            isSelected={drawSel ? hasSelection(drawSel.id) : false}
            onSelect={() => drawSel && handleSelect(drawSel)}
            disabled={mainMarket?.status !== 'OPEN'}
          />
        )}
        <LiveOddsButton
          selection={awaySel}
          isSelected={awaySel ? hasSelection(awaySel.id) : false}
          onSelect={() => awaySel && handleSelect(awaySel)}
          disabled={mainMarket?.status !== 'OPEN'}
        />
        <div className="w-7 text-center">
          {marketCount > 1 && (
            <span className="text-[11px] text-brand-400 font-medium">+{marketCount - 1}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------- Sport Section (collapsible) ----------
function SportSection({
  sportName,
  sportSlug,
  sportIcon,
  events,
  defaultOpen = true,
}: {
  sportName: string;
  sportSlug: string;
  sportIcon: string | null;
  events: Event[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Group events within sport by competition
  const byCompetition = useMemo(() => {
    const groups = new Map<string, { name: string; events: Event[] }>();
    for (const ev of events) {
      const compName = ev.competition?.name || 'Other';
      const compId = ev.competitionId || compName;
      if (!groups.has(compId)) {
        groups.set(compId, { name: compName, events: [] });
      }
      groups.get(compId)!.events.push(ev);
    }
    return Array.from(groups.values());
  }, [events]);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Sport header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-secondary hover:bg-surface-tertiary transition-colors"
      >
        <div className="flex items-center gap-2">
          <SportIcon slug={sportSlug} size={18} emoji={sportIcon} />
          <span className="text-sm font-bold text-white">{sportName}</span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-red/15 text-accent-red text-[10px] font-bold">
            <span className="w-1 h-1 bg-accent-red rounded-full animate-pulse" />
            {events.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Events grouped by competition */}
      {isOpen && (
        <div className="bg-surface-secondary/30">
          {byCompetition.map((group) => (
            <div key={group.name}>
              {/* Competition sub-header */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border-dim bg-surface-secondary/60">
                <span className="text-xs text-gray-400 font-medium">{group.name}</span>
                <span className="text-[10px] text-gray-600">({group.events.length})</span>
              </div>
              {/* Event rows */}
              {group.events.map((event) => (
                <LiveEventRow key={event.id} event={event} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Main Live Page ----------
export default function LivePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [_lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  const fetchLiveEvents = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const { data } = await sportsApi.getLiveEvents();
      const liveData = Array.isArray(data.data) ? data.data : [];
      setEvents(liveData);
      setLastRefresh(new Date());
      setRefreshCountdown(30);

      if (liveData.length === 0) {
        try {
          const { data: upData } = await sportsApi.getEvents({ status: 'UPCOMING', limit: 8 });
          setUpcomingEvents(Array.isArray(upData.data) ? upData.data : []);
        } catch {
          // silently ignore
        }
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveEvents();

    // Auto-refresh interval
    const interval = setInterval(() => {
      fetchLiveEvents();
    }, REFRESH_INTERVAL_MS);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);

    // Subscribe to live updates via socket
    const socket = getSocket();
    if (!socket.connected) connectSocket();

    socket.on('score:update', (data: { eventId: string; homeScore: number; awayScore: number }) => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === data.eventId
            ? { ...e, homeScore: data.homeScore, awayScore: data.awayScore }
            : e
        )
      );
    });

    socket.on('odds:update', (data: { selectionId: string; odds: string }) => {
      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          markets: e.markets?.map((m) => ({
            ...m,
            selections: m.selections.map((s) =>
              s.id === data.selectionId ? { ...s, odds: data.odds } : s
            ),
          })),
        }))
      );
    });

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
      socket.off('score:update');
      socket.off('odds:update');
      socket.disconnect();
    };
  }, [fetchLiveEvents]);

  // Build unique sports from live events
  const sportsMap = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; icon: string | null; count: number }>();
    events.forEach((e) => {
      const sport = e.competition?.sport;
      if (sport?.name && sport?.slug) {
        const existing = map.get(sport.slug);
        if (existing) {
          existing.count++;
        } else {
          map.set(sport.slug, { name: sport.name, slug: sport.slug, icon: sport.icon || null, count: 1 });
        }
      }
    });
    return map;
  }, [events]);

  const sports = useMemo(() => Array.from(sportsMap.values()), [sportsMap]);

  const filteredEvents = useMemo(() => {
    if (!sportFilter) return events;
    return events.filter((e) => e.competition?.sport?.slug === sportFilter);
  }, [events, sportFilter]);

  // Group filtered events by sport
  const groupedBySport = useMemo(() => {
    const groups = new Map<string, {
      sportName: string;
      sportSlug: string;
      sportIcon: string | null;
      events: Event[];
    }>();
    for (const ev of filteredEvents) {
      const sportSlug = ev.competition?.sport?.slug || 'other';
      const sportName = ev.competition?.sport?.name || 'Other';
      const sportIcon = ev.competition?.sport?.icon || null;
      if (!groups.has(sportSlug)) {
        groups.set(sportSlug, { sportName, sportSlug, sportIcon, events: [] });
      }
      groups.get(sportSlug)!.events.push(ev);
    }
    // Sort by event count descending
    return Array.from(groups.values()).sort((a, b) => b.events.length - a.events.length);
  }, [filteredEvents]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 bg-accent-red rounded-full animate-pulse" />
          <div className="w-32 h-7 bg-surface-tertiary rounded animate-pulse" />
        </div>
        <div className="flex gap-2 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-20 h-8 bg-surface-tertiary rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg h-14 animate-pulse bg-surface-tertiary" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-3 h-3 bg-accent-red rounded-full animate-pulse" />
            Live Events
          </h1>
          <span className="text-sm text-gray-500">({events.length})</span>
        </div>

        {/* Auto-refresh indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] text-gray-600">
              Refreshing in {refreshCountdown}s
            </span>
            <div className="w-16 h-1 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full bg-brand-500/50 rounded-full transition-all duration-1000"
                style={{ width: `${(refreshCountdown / 30) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => fetchLiveEvents(true)}
            disabled={isRefreshing}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'bg-surface-tertiary hover:bg-surface-hover text-gray-400 hover:text-white',
              isRefreshing && 'animate-spin'
            )}
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sport Filter Tabs */}
      {sports.length > 0 && (
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSportFilter(null)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border',
              !sportFilter
                ? 'bg-accent-red/15 text-accent-red border-accent-red/30'
                : 'bg-surface-secondary text-gray-400 border-transparent hover:bg-surface-tertiary hover:text-white'
            )}
          >
            All
            <span className="text-[10px] opacity-70">({events.length})</span>
          </button>
          {sports.map((sport) => (
            <button
              key={sport.slug}
              onClick={() => setSportFilter(sport.slug === sportFilter ? null : sport.slug)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border',
                sportFilter === sport.slug
                  ? 'bg-accent-red/15 text-accent-red border-accent-red/30'
                  : 'bg-surface-secondary text-gray-400 border-transparent hover:bg-surface-tertiary hover:text-white'
              )}
            >
              <SportIcon slug={sport.slug} size={14} emoji={sport.icon} />
              {sport.name}
              <span className="text-[10px] opacity-70">({sport.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Events grouped by sport, or empty state */}
      {filteredEvents.length === 0 ? (
        <div className="space-y-6">
          {/* Empty state */}
          <div className="rounded-lg border border-border bg-surface-secondary text-center py-16 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
              <span className="w-4 h-4 bg-accent-red rounded-full animate-pulse" />
            </div>
            <p className="text-gray-300 font-medium text-lg mb-1">No live events right now</p>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              Live events will appear here as soon as games kick off. Check out upcoming matches below.
            </p>
          </div>

          {/* Upcoming events fallback */}
          {upcomingEvents.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" />
                  Starting Soon
                </h2>
                <Link
                  href="/sports"
                  className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                >
                  All Sports
                </Link>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/sports/event/${event.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 border-b border-border-dim hover:bg-surface-hover/50 transition-colors"
                  >
                    <div className="w-14 shrink-0 text-center">
                      <span className="text-[11px] text-gray-400">
                        {new Date(event.startTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </span>
                      <br />
                      <span className="text-[10px] text-gray-500">
                        {new Date(event.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{event.homeTeam || event.name}</p>
                      <p className="text-sm text-gray-400 truncate">{event.awayTeam || 'TBD'}</p>
                    </div>
                    <div className="shrink-0">
                      {event.competition?.sport?.slug && (
                        <SportIcon slug={event.competition.sport.slug} size={16} emoji={event.competition.sport.icon} />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBySport.map((group) => (
            <SportSection
              key={group.sportSlug}
              sportName={group.sportName}
              sportSlug={group.sportSlug}
              sportIcon={group.sportIcon}
              events={group.events}
              defaultOpen={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
