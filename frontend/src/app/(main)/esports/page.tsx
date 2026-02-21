'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Flame,
  Clock,
  Trophy,
  Zap,
} from 'lucide-react';
import { cn, formatOdds } from '@/lib/utils';
import { get } from '@/lib/api';
import { useBetSlipStore } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketSelection {
  id: string;
  name: string;
  outcome: string;
  odds: string | number;
  status: string;
}

interface Market {
  id: string;
  name: string;
  type: string;
  selections: MarketSelection[];
}

interface EsportEvent {
  id: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  startTime: string;
  status: string;
  isLive?: boolean;
  scores?: { home?: number; away?: number } | null;
  mainMarket?: Market | null;
  competition: string;
  competitionSlug: string;
  sport: string;
  sportSlug: string;
  sportIcon?: string | null;
}

interface EsportSport {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Esport slugs to filter
// ---------------------------------------------------------------------------

const ESPORT_SLUGS = [
  'esports',
  'esport-fifa',
  'esport-nba2k',
  'esport-valorant',
  'counter-strike',
  'dota-2',
  'league-of-legends',
  'overwatch',
  'starcraft',
  'rocket-league',
  'call-of-duty',
  'rainbow-six',
  'king-of-glory',
  'arena-of-valor',
  'mobile-legends',
];

const ESPORT_ICONS: Record<string, string> = {
  'counter-strike': '🎯',
  'dota-2': '⚔️',
  'league-of-legends': '🏰',
  'esport-valorant': '🔫',
  'esport-fifa': '⚽',
  'esport-nba2k': '🏀',
  'esports': '🎮',
  'overwatch': '🛡️',
  'starcraft': '🚀',
  'rocket-league': '🚗',
  'call-of-duty': '💣',
  'rainbow-six': '🎖️',
  'king-of-glory': '👑',
  'mobile-legends': '📱',
};

// ---------------------------------------------------------------------------
// OddsButton
// ---------------------------------------------------------------------------

function OddsButton({
  selectionId,
  eventId,
  eventName,
  sportName,
  marketId,
  marketName,
  outcomeName,
  odds,
  startTime,
  isLive,
  disabled,
}: {
  selectionId: string;
  eventId: string;
  eventName: string;
  sportName: string;
  marketId: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  startTime: string;
  isLive: boolean;
  disabled?: boolean;
}) {
  const addSelection = useBetSlipStore((s) => s.addSelection);
  const removeSelection = useBetSlipStore((s) => s.removeSelection);
  const selections = useBetSlipStore((s) => s.selections);
  const isSelected = selections.some((s) => s.id === selectionId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (isSelected) {
      removeSelection(selectionId);
    } else {
      addSelection({
        id: selectionId,
        eventId,
        eventName,
        sportId: '',
        sportName,
        marketId,
        marketName,
        outcomeName,
        odds,
        startTime,
        isLive,
      });
    }
  };

  if (odds <= 1) return null;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'min-w-[60px] h-9 px-2 rounded-md font-mono text-[13px] font-semibold transition-all duration-150',
        'border',
        isSelected
          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#A78BFA]'
          : 'bg-[#1C2128] border-[#30363D] text-[#10B981] hover:bg-[#21262D] hover:border-[#8B5CF6]/50',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {formatOdds(odds)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// EventRow
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: EsportEvent }) {
  const isLive = event.isLive || event.status?.toLowerCase() === 'live';
  const isFinished = event.status?.toLowerCase() === 'ended';
  const scores = event.scores as { home?: number; away?: number } | null;
  const market = event.mainMarket;
  const selections = market?.selections ?? [];

  const parseOdds = (v: string | number) => (typeof v === 'string' ? parseFloat(v) : v) || 0;

  const now = new Date();
  const start = new Date(event.startTime);
  const isToday = start.toDateString() === now.toDateString();
  const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Link
      href={`/sports/${event.sportSlug}/${event.id}`}
      className={cn(
        'block px-4 py-3 hover:bg-[#1C2128]/60 transition-colors border-b border-[#21262D]/40',
        isLive && 'bg-[#1C2128]/30',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Left: Teams */}
        <div className="flex-1 min-w-0">
          {/* Home */}
          <div className="flex items-center gap-2 mb-1">
            {event.homeTeamLogo ? (
              <img src={event.homeTeamLogo} alt="" className="w-5 h-5 rounded object-cover" />
            ) : (
              <div className="w-5 h-5 rounded bg-[#21262D] flex items-center justify-center text-[10px] font-bold text-[#8B949E]">
                {(event.homeTeam || '?').charAt(0)}
              </div>
            )}
            <span className={cn('text-sm truncate flex-1', isLive ? 'text-white font-medium' : 'text-[#C9D1D9]')}>
              {event.homeTeam}
            </span>
            {(isLive || isFinished) && scores && (
              <span className={cn('text-sm font-mono font-bold w-6 text-center', isLive ? 'text-white' : 'text-[#8B949E]')}>
                {scores.home ?? 0}
              </span>
            )}
          </div>
          {/* Away */}
          <div className="flex items-center gap-2">
            {event.awayTeamLogo ? (
              <img src={event.awayTeamLogo} alt="" className="w-5 h-5 rounded object-cover" />
            ) : (
              <div className="w-5 h-5 rounded bg-[#21262D] flex items-center justify-center text-[10px] font-bold text-[#8B949E]">
                {(event.awayTeam || '?').charAt(0)}
              </div>
            )}
            <span className={cn('text-sm truncate flex-1', isLive ? 'text-white font-medium' : 'text-[#C9D1D9]')}>
              {event.awayTeam}
            </span>
            {(isLive || isFinished) && scores && (
              <span className={cn('text-sm font-mono font-bold w-6 text-center', isLive ? 'text-white' : 'text-[#8B949E]')}>
                {scores.away ?? 0}
              </span>
            )}
          </div>
        </div>

        {/* Right: Odds */}
        <div className={cn('flex gap-1.5 shrink-0', isFinished && 'opacity-40')} onClick={(e) => e.preventDefault()}>
          {selections.length > 0 ? (
            selections.map((sel) => (
              <OddsButton
                key={sel.id}
                selectionId={sel.id}
                eventId={event.id}
                eventName={`${event.homeTeam} vs ${event.awayTeam}`}
                sportName={event.sport}
                marketId={market?.id ?? ''}
                marketName={market?.name ?? ''}
                outcomeName={sel.name || sel.outcome}
                odds={parseOdds(sel.odds)}
                startTime={event.startTime}
                isLive={!!isLive}
                disabled={isFinished}
              />
            ))
          ) : (
            <span className="text-[11px] text-[#484F58] italic px-2 self-center">
              {isFinished ? 'Ended' : 'No odds'}
            </span>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="mt-1.5 ml-7 flex items-center gap-2">
        {isLive ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#EF4444]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#EF4444] animate-pulse" />
            LIVE
          </span>
        ) : isFinished ? (
          <span className="text-[11px] text-[#484F58]">Ended</span>
        ) : (
          <span className="text-[11px] text-[#484F58]">
            {isToday ? `Today ${timeStr}` : start.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeStr}
          </span>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// CompetitionBlock
// ---------------------------------------------------------------------------

function CompetitionBlock({
  name,
  events,
  defaultExpanded = true,
}: {
  name: string;
  events: EsportEvent[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#161B22] hover:bg-[#1C2128] transition-colors"
      >
        <Trophy className="h-3.5 w-3.5 text-[#484F58]" />
        <span className="text-[13px] font-semibold text-[#C9D1D9] flex-1 text-left truncate">{name}</span>
        <span className="text-[11px] text-[#484F58] mr-1">{events.length}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-[#484F58]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#484F58]" />}
      </button>
      {expanded && (
        <div>
          {/* Header row */}
          <div className="flex items-center px-4 py-1.5 bg-[#0D1117]/60">
            <span className="flex-1 text-[10px] text-[#484F58] uppercase tracking-wider">Match</span>
            <div className="flex gap-1.5 shrink-0">
              <span className="min-w-[60px] text-center text-[10px] text-[#484F58] uppercase tracking-wider">1</span>
              <span className="min-w-[60px] text-center text-[10px] text-[#484F58] uppercase tracking-wider">2</span>
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

// ---------------------------------------------------------------------------
// Main Esports Page
// ---------------------------------------------------------------------------

export default function EsportsPage() {
  const router = useRouter();
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [esportSports, setEsportSports] = useState<EsportSport[]>([]);
  const [events, setEvents] = useState<EsportEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch esport sports list
  useEffect(() => {
    async function fetchSports() {
      try {
        const data = await get<{ sports: EsportSport[] }>('/sports');
        const sports = (data.sports || data as unknown as EsportSport[] || []);
        const filtered = (Array.isArray(sports) ? sports : []).filter(
          (s) => ESPORT_SLUGS.includes(s.slug) && s.eventCount > 0
        );
        setEsportSports(filtered);
      } catch {
        setEsportSports([]);
      }
    }
    fetchSports();
  }, []);

  // Fetch events for selected sport or all esports
  useEffect(() => {
    let cancelled = false;
    async function fetchEvents() {
      setIsLoading(true);
      try {
        if (selectedSport) {
          // Fetch events for specific esport
          const data = await get<{ competitions: Array<{ name: string; events: EsportEvent[] }> }>(
            `/sports/${selectedSport}/competitions`
          );
          const allEvents: EsportEvent[] = [];
          (data.competitions || []).forEach((c) => {
            (c.events || []).forEach((e) => {
              allEvents.push({ ...e, competition: c.name, competitionSlug: '', sport: selectedSport, sportSlug: selectedSport });
            });
          });
          if (!cancelled) setEvents(allEvents);
        } else {
          // Fetch events for all esports
          const allEvents: EsportEvent[] = [];
          const fetches = esportSports.slice(0, 8).map(async (sport) => {
            try {
              const data = await get<{ competitions: Array<{ name: string; events: EsportEvent[] }> }>(
                `/sports/${sport.slug}/competitions`
              );
              (data.competitions || []).forEach((c) => {
                (c.events || []).forEach((e) => {
                  allEvents.push({ ...e, competition: c.name, competitionSlug: '', sport: sport.name, sportSlug: sport.slug });
                });
              });
            } catch { /* skip */ }
          });
          await Promise.all(fetches);
          if (!cancelled) setEvents(allEvents);
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    if (esportSports.length > 0 || selectedSport) {
      fetchEvents();
    }
    return () => { cancelled = true; };
  }, [selectedSport, esportSports]);

  // Group events by competition
  const grouped = events.reduce<Record<string, { sport: string; sportSlug: string; events: EsportEvent[] }>>((acc, e) => {
    const key = `${e.sportSlug}::${e.competition}`;
    if (!acc[key]) acc[key] = { sport: e.sport, sportSlug: e.sportSlug, events: [] };
    acc[key].events.push(e);
    return acc;
  }, {});

  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    // Live events first, then by event count
    const aLive = a[1].events.some((e) => e.isLive);
    const bLive = b[1].events.some((e) => e.isLive);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return b[1].events.length - a[1].events.length;
  });

  const totalEvents = esportSports.reduce((sum, s) => sum + s.eventCount, 0);

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6">
      {/* Hero Banner */}
      <div
        className="relative px-6 py-8 lg:py-12"
        style={{
          background: 'linear-gradient(135deg, #1a0a2e 0%, #0D1117 50%, #0a1628 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #8B5CF6 0%, transparent 50%), radial-gradient(circle at 70% 50%, #3B82F6 0%, transparent 50%)' }} />
        <div className="relative max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            <Gamepad2 className="h-8 w-8 text-[#8B5CF6]" />
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Esports</h1>
          </div>
          <p className="text-[#8B949E] text-sm lg:text-base max-w-xl">
            Bet on your favorite esports tournaments — CS2, Dota 2, League of Legends, Valorant, FIFA, and more.
          </p>
          <div className="flex items-center gap-4 mt-4 text-xs text-[#484F58]">
            <span className="flex items-center gap-1">
              <Gamepad2 className="h-3.5 w-3.5" />
              {esportSports.length} games
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {totalEvents} events
            </span>
          </div>
        </div>
      </div>

      {/* Sport filter pills */}
      <div className="px-4 lg:px-6 py-3 bg-[#0D1117] border-b border-[#21262D] overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedSport(null)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              !selectedSport
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-[#1C2128] text-[#8B949E] hover:bg-[#21262D] hover:text-white border border-[#30363D]',
            )}
          >
            <Flame className="h-3 w-3" />
            All
          </button>
          {esportSports.map((sport) => (
            <button
              key={sport.slug}
              onClick={() => setSelectedSport(sport.slug)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                selectedSport === sport.slug
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-[#1C2128] text-[#8B949E] hover:bg-[#21262D] hover:text-white border border-[#30363D]',
              )}
            >
              <span>{ESPORT_ICONS[sport.slug] || '🎮'}</span>
              {sport.name}
              <span className="text-[10px] opacity-60">({sport.eventCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="bg-[#0D1117]">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="h-8 w-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-[#484F58] mt-3">Loading esports events...</p>
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="py-16 text-center">
            <Gamepad2 className="h-12 w-12 text-[#21262D] mx-auto mb-3" />
            <p className="text-[#484F58] text-sm">No esports events available right now</p>
            <p className="text-[#30363D] text-xs mt-1">Check back soon for upcoming tournaments</p>
          </div>
        ) : (
          sortedGroups.map(([key, group]) => {
            const compName = key.split('::')[1];
            const icon = ESPORT_ICONS[group.sportSlug] || '🎮';
            return (
              <CompetitionBlock
                key={key}
                name={`${icon} ${group.sport} — ${compName}`}
                events={group.events}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
