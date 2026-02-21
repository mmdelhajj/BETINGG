'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  CircleDot,
  Target,
  Swords,
  Gamepad2,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { cn, formatOdds } from '@/lib/utils';
import { get } from '@/lib/api';
import { useBetSlipStore, type BetSelection } from '@/stores/betSlipStore';
import { useSocketEvent } from '@/lib/socket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveEvent {
  id: string;
  sport: string;
  sportSlug: string;
  competition: string;
  competitionSlug: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  scores: unknown;
  isLive: boolean;
  startTime: string;
  mainMarket?: {
    id: string;
    name: string;
    type: string;
    selections: { id: string; name: string; outcome: string; odds: string; status: string }[];
  } | null;
  // Additional fields for display (populated from mock or transformed from API)
  time?: string;
  period?: string;
}

interface ApiLiveGroup {
  sport: { id: string; name: string; slug: string; icon: string | null };
  events: LiveEvent[];
}

interface SportGroup {
  sportId: string;
  sportName: string;
  sportSlug: string;
  events: LiveEvent[];
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_LIVE_EVENTS: LiveEvent[] = [
  { id: 'l1', sport: 'Football', sportSlug: 'football', competition: 'Premier League', competitionSlug: 'premier-league', homeTeam: 'Arsenal', awayTeam: 'Chelsea', scores: { home: 2, away: 1 }, isLive: true, startTime: new Date().toISOString(), time: "67'", period: '2nd Half', mainMarket: { id: 'm1', name: 'Match Winner', type: 'MONEYLINE', selections: [{ id: 's1', name: '1', outcome: '1', odds: '1.35', status: 'ACTIVE' }, { id: 's2', name: 'X', outcome: 'X', odds: '4.8', status: 'ACTIVE' }, { id: 's3', name: '2', outcome: '2', odds: '8.5', status: 'ACTIVE' }] } },
  { id: 'l2', sport: 'Football', sportSlug: 'football', competition: 'La Liga', competitionSlug: 'la-liga', homeTeam: 'Real Madrid', awayTeam: 'Villarreal', scores: { home: 0, away: 0 }, isLive: true, startTime: new Date().toISOString(), time: "23'", period: '1st Half', mainMarket: { id: 'm2', name: 'Match Winner', type: 'MONEYLINE', selections: [{ id: 's4', name: '1', outcome: '1', odds: '1.55', status: 'ACTIVE' }, { id: 's5', name: 'X', outcome: 'X', odds: '3.9', status: 'ACTIVE' }, { id: 's6', name: '2', outcome: '2', odds: '5.2', status: 'ACTIVE' }] } },
  { id: 'l3', sport: 'Football', sportSlug: 'football', competition: 'Bundesliga', competitionSlug: 'bundesliga', homeTeam: 'Bayern Munich', awayTeam: 'Dortmund', scores: { home: 3, away: 2 }, isLive: true, startTime: new Date().toISOString(), time: "82'", period: '2nd Half', mainMarket: { id: 'm3', name: 'Match Winner', type: 'MONEYLINE', selections: [{ id: 's7', name: '1', outcome: '1', odds: '1.25', status: 'ACTIVE' }, { id: 's8', name: 'X', outcome: 'X', odds: '5.5', status: 'ACTIVE' }, { id: 's9', name: '2', outcome: '2', odds: '10.0', status: 'ACTIVE' }] } },
  { id: 'l4', sport: 'Basketball', sportSlug: 'basketball', competition: 'NBA', competitionSlug: 'nba', homeTeam: 'LA Lakers', awayTeam: 'Golden State', scores: { home: 87, away: 92 }, isLive: true, startTime: new Date().toISOString(), time: 'Q3 4:32', period: '3rd Quarter', mainMarket: { id: 'm4', name: 'Match Winner', type: 'MONEYLINE', selections: [{ id: 's10', name: 'Lakers', outcome: 'Lakers', odds: '2.35', status: 'ACTIVE' }, { id: 's11', name: 'Warriors', outcome: 'Warriors', odds: '1.58', status: 'ACTIVE' }] } },
  { id: 'l5', sport: 'Basketball', sportSlug: 'basketball', competition: 'NBA', competitionSlug: 'nba', homeTeam: 'Celtics', awayTeam: 'Heat', scores: { home: 65, away: 58 }, isLive: true, startTime: new Date().toISOString(), time: 'Q2 1:15', period: '2nd Quarter', mainMarket: { id: 'm5', name: 'Match Winner', type: 'MONEYLINE', selections: [{ id: 's12', name: 'Celtics', outcome: 'Celtics', odds: '1.42', status: 'ACTIVE' }, { id: 's13', name: 'Heat', outcome: 'Heat', odds: '2.75', status: 'ACTIVE' }] } },
  { id: 'l6', sport: 'Tennis', sportSlug: 'tennis', competition: 'ATP Tour', competitionSlug: 'atp-tour', homeTeam: 'Djokovic', awayTeam: 'Nadal', scores: { home: 6, away: 4 }, isLive: true, startTime: new Date().toISOString(), time: 'Set 2', period: '2nd Set', mainMarket: { id: 'm6', name: 'Match Winner', type: 'MONEYLINE', selections: [{ id: 's14', name: 'Djokovic', outcome: 'Djokovic', odds: '1.55', status: 'ACTIVE' }, { id: 's15', name: 'Nadal', outcome: 'Nadal', odds: '2.35', status: 'ACTIVE' }] } },
  { id: 'l7', sport: 'Esports', sportSlug: 'esports', competition: 'LCK', competitionSlug: 'lck', homeTeam: 'T1', awayTeam: 'Gen.G', scores: { home: 1, away: 0 }, isLive: true, startTime: new Date().toISOString(), time: 'Map 2', period: 'Best of 3', mainMarket: { id: 'm7', name: 'Match Winner', type: 'MONEYLINE', selections: [{ id: 's16', name: 'T1', outcome: 'T1', odds: '1.50', status: 'ACTIVE' }, { id: 's17', name: 'Gen.G', outcome: 'Gen.G', odds: '2.45', status: 'ACTIVE' }] } },
];

const SPORT_ICONS: Record<string, React.ReactNode> = {
  football: <Trophy className="w-4 h-4" />,
  basketball: <CircleDot className="w-4 h-4" />,
  tennis: <Target className="w-4 h-4" />,
  hockey: <Swords className="w-4 h-4" />,
  esports: <Gamepad2 className="w-4 h-4" />,
};

const SPORT_EMOJIS: Record<string, string> = {
  football: '\u26BD',
  basketball: '\uD83C\uDFC0',
  tennis: '\uD83C\uDFBE',
  hockey: '\uD83C\uDFD2',
  esports: '\uD83C\uDFAE',
};

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function LiveEventRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[#21262D] last:border-0">
      <div className="w-[140px] flex flex-col gap-1.5">
        <div className="h-3.5 w-24 skeleton rounded" />
        <div className="h-3.5 w-20 skeleton rounded" />
      </div>
      <div className="w-[60px] flex flex-col items-center gap-1">
        <div className="h-5 w-10 skeleton rounded" />
        <div className="h-3 w-14 skeleton rounded" />
      </div>
      <div className="flex gap-2 flex-1 justify-end">
        <div className="h-9 w-[72px] skeleton rounded-button" />
        <div className="h-9 w-[72px] skeleton rounded-button" />
        <div className="h-9 w-[72px] skeleton rounded-button" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OddsButton
// ---------------------------------------------------------------------------

function OddsButton({
  selectionId, eventId, eventName, sportId, sportName, marketId, marketName, outcomeName, odds,
}: {
  selectionId?: string; eventId: string; eventName: string; sportId: string; sportName: string;
  marketId: string; marketName: string; outcomeName: string; odds: number;
}) {
  const { addSelection, hasSelection } = useBetSlipStore();
  const isSelected = hasSelection(eventId, marketId, outcomeName);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addSelection({
          id: selectionId || `${eventId}-${marketId}-${outcomeName}`,
          eventId, eventName, marketId, marketName, outcomeName, odds,
          sportId, sportName, startTime: '', isLive: true,
        });
      }}
      className={cn(
        'flex flex-col items-center justify-center min-w-[68px] px-3 py-1.5 rounded-button border text-xs transition-all duration-200',
        isSelected
          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 ring-1 ring-[#8B5CF6]/30'
          : 'bg-[#0D1117] border-[#21262D] hover:border-[#8B5CF6]/40 hover:bg-[#161B22]'
      )}
    >
      <span className="text-[10px] text-[#8B949E] leading-none mb-0.5">{outcomeName}</span>
      <span className={cn(
        'font-mono font-bold text-sm leading-tight',
        isSelected ? 'text-[#A78BFA]' : 'text-[#10B981]'
      )}>
        {formatOdds(odds)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Live Betting Page
// ---------------------------------------------------------------------------

export default function LiveBettingPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [flashingScores, setFlashingScores] = useState<Set<string>>(new Set());
  const prevScoresRef = useRef<Record<string, { home: number; away: number }>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await get<{ groups: ApiLiveGroup[] }>('/events/live');
        // Flatten grouped events into a flat list
        const allEvents: LiveEvent[] = [];
        for (const group of (data?.groups || [])) {
          for (const evt of (group?.events || [])) {
            allEvents.push(evt);
          }
        }
        setEvents(allEvents);
      } catch {
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Flash detection helper
  const detectFlash = useCallback((eventId: string, newHome: number, newAway: number) => {
    const prev = prevScoresRef.current[eventId];
    if (prev && (newHome !== prev.home || newAway !== prev.away)) {
      setFlashingScores((s) => {
        const next = new Set(s);
        next.add(eventId);
        return next;
      });
      setTimeout(() => {
        setFlashingScores((s) => {
          const next = new Set(s);
          next.delete(eventId);
          return next;
        });
      }, 1500);
    }
    prevScoresRef.current[eventId] = { home: newHome, away: newAway };
  }, []);

  // Real-time score updates
  useSocketEvent('event:scoreUpdate', (data) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== data.eventId) return e;
        const score = data.score as { home?: number; away?: number };
        detectFlash(e.id, score?.home ?? 0, score?.away ?? 0);
        return { ...e, scores: data.score, time: data.time };
      })
    );
  });

  // Real-time odds updates
  useSocketEvent('odds:update', (data) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== data.eventId || !e.mainMarket) return e;
        if (e.mainMarket.id !== data.marketId) return e;
        return {
          ...e,
          mainMarket: {
            ...e.mainMarket,
            selections: e.mainMarket.selections.map((s) => ({
              ...s,
              odds: data.odds[s.name] != null ? String(data.odds[s.name]) : s.odds,
            })),
          },
        };
      })
    );
  });

  // Derive sport counts from all events
  const sportCounts: Record<string, number> = {};
  for (const e of events) {
    const key = e.sportSlug || 'other';
    sportCounts[key] = (sportCounts[key] || 0) + 1;
  }
  const sportList = Object.entries(sportCounts)
    .map(([slug, count]) => {
      const sample = events.find((e) => e.sportSlug === slug);
      return { slug, name: sample?.sport || slug, count };
    })
    .sort((a, b) => b.count - a.count);

  // Filter events by selected sport
  const filteredEvents = selectedSport
    ? events.filter((e) => e.sportSlug === selectedSport)
    : events;

  // Group filtered events by competition
  const competitionGroups: Record<string, { sport: string; sportSlug: string; competition: string; events: LiveEvent[] }> = {};
  for (const event of filteredEvents) {
    const key = `${event.sportSlug}::${event.competition}`;
    if (!competitionGroups[key]) {
      competitionGroups[key] = {
        sport: event.sport,
        sportSlug: event.sportSlug,
        competition: event.competition,
        events: [],
      };
    }
    competitionGroups[key].events.push(event);
  }

  // Group by sport
  const sportGroups: SportGroup[] = filteredEvents.reduce<SportGroup[]>((acc, event) => {
    const group = acc.find((g) => g.sportSlug === event.sportSlug);
    if (group) {
      group.events.push(event);
    } else {
      acc.push({ sportId: event.sportSlug, sportName: event.sport, sportSlug: event.sportSlug, events: [event] });
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="border-b border-[#21262D] bg-[#161B22]">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Pulsing red dot */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF4444]" />
            </span>
            <h1 className="text-xl font-bold text-[#E6EDF3] tracking-tight">
              <span className="text-[#EF4444] font-extrabold mr-1.5">LIVE</span>
              Betting
            </h1>
            <span className="text-xs text-[#8B949E] bg-[#21262D] px-2 py-0.5 rounded-full font-medium">
              {events.length} events
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#8B949E]">
            <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
            Real-time odds
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Sport Filter Pills                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="border-b border-[#21262D] bg-[#0D1117]">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedSport(null)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border',
                !selectedSport
                  ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20'
                  : 'bg-transparent text-[#8B949E] border-[#21262D] hover:border-[#8B5CF6]/40 hover:text-[#E6EDF3]',
              )}
            >
              <Zap className="w-3 h-3" />
              All Sports
              <span className="ml-0.5 opacity-70">{events.length}</span>
            </button>
            {sportList.map((sport) => (
              <button
                key={sport.slug}
                onClick={() => setSelectedSport(sport.slug === selectedSport ? null : sport.slug)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border',
                  selectedSport === sport.slug
                    ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20'
                    : 'bg-transparent text-[#8B949E] border-[#21262D] hover:border-[#8B5CF6]/40 hover:text-[#E6EDF3]',
                )}
              >
                <span className="text-sm leading-none">{SPORT_EMOJIS[sport.slug] || '\uD83C\uDFC6'}</span>
                {sport.name}
                <span className="ml-0.5 opacity-60">{sport.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Content                                                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-[#161B22] border border-[#21262D] rounded-card overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2 border-b border-[#21262D]">
                  <div className="h-4 w-4 skeleton rounded" />
                  <div className="h-4 w-32 skeleton rounded" />
                </div>
                {Array.from({ length: 2 }).map((_, j) => (
                  <LiveEventRowSkeleton key={j} />
                ))}
              </div>
            ))}
          </div>
        ) : Object.keys(competitionGroups).length === 0 ? (
          <div className="bg-[#161B22] border border-[#21262D] rounded-card py-16 text-center">
            <Trophy className="w-12 h-12 text-[#8B949E]/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#E6EDF3] mb-2">No Live Events</h3>
            <p className="text-sm text-[#8B949E]">Check back later for live events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(competitionGroups).map(([key, group]) => (
              <div key={key} className="bg-[#161B22] border border-[#21262D] rounded-card overflow-hidden">
                {/* Competition Header */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#161B22] border-b border-[#21262D]">
                  <span className="text-[#8B5CF6]">
                    {SPORT_ICONS[group.sportSlug] || <Trophy className="w-4 h-4" />}
                  </span>
                  <span className="text-xs font-semibold text-[#E6EDF3] uppercase tracking-wide">
                    {group.competition}
                  </span>
                  <span className="text-[10px] text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded font-bold">
                    {group.events.length} LIVE
                  </span>
                </div>

                {/* Events Table */}
                <div>
                  {/* Column headers */}
                  <div className="flex items-center gap-4 px-4 py-1.5 text-[10px] uppercase tracking-wider text-[#8B949E] border-b border-[#21262D]/50 bg-[#0D1117]/40">
                    <span className="w-[40%] min-w-[140px]">Match</span>
                    <span className="w-[80px] text-center">Score</span>
                    <span className="w-[60px] text-center">Time</span>
                    <span className="flex-1 text-right">Odds</span>
                  </div>

                  {/* Event Rows */}
                  {group.events.map((event) => {
                    const eventScores = event.scores as { home?: number; away?: number } | null;
                    const isFlashing = flashingScores.has(event.id);

                    return (
                      <Link
                        key={event.id}
                        href={`/sports/${event.sportSlug}/${event.id}`}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3 border-b border-[#21262D]/50 last:border-0 transition-all duration-200 hover:bg-[#1C2128]/60 group',
                          isFlashing && 'animate-score-flash'
                        )}
                      >
                        {/* Team Names */}
                        <div className="w-[40%] min-w-[140px] flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {event.homeTeamLogo && (
                              <img src={event.homeTeamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />
                            )}
                            <span className="text-sm font-medium text-[#E6EDF3] truncate leading-tight">
                              {event.homeTeam}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {event.awayTeamLogo && (
                              <img src={event.awayTeamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />
                            )}
                            <span className="text-sm font-medium text-[#E6EDF3] truncate leading-tight">
                              {event.awayTeam}
                            </span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="w-[80px] flex flex-col items-center gap-1">
                          <span className={cn(
                            'text-base font-bold font-mono text-[#E6EDF3] leading-tight transition-colors duration-300',
                            isFlashing && 'text-[#10B981]'
                          )}>
                            {eventScores?.home ?? 0}
                          </span>
                          <span className={cn(
                            'text-base font-bold font-mono text-[#E6EDF3] leading-tight transition-colors duration-300',
                            isFlashing && 'text-[#10B981]'
                          )}>
                            {eventScores?.away ?? 0}
                          </span>
                        </div>

                        {/* Time / Period */}
                        <div className="w-[60px] flex flex-col items-center gap-0.5">
                          <span className="flex items-center gap-1 text-xs font-mono text-[#EF4444] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                            {event.time || 'LIVE'}
                          </span>
                          {event.period && (
                            <span className="text-[10px] text-[#8B949E] leading-none">{event.period}</span>
                          )}
                        </div>

                        {/* Odds */}
                        <div className="flex-1 flex items-center gap-1.5 justify-end" onClick={(e) => e.preventDefault()}>
                          {event.mainMarket?.selections.map((sel) => (
                            <OddsButton
                              key={sel.name}
                              selectionId={sel.id}
                              eventId={event.id}
                              eventName={`${event.homeTeam} vs ${event.awayTeam}`}
                              sportId={event.sportSlug}
                              sportName={event.sport}
                              marketId={event.mainMarket!.id}
                              marketName={event.mainMarket!.name}
                              outcomeName={sel.name}
                              odds={typeof sel.odds === 'string' ? parseFloat(sel.odds) : (sel.odds as unknown as number)}
                            />
                          ))}
                          <ChevronRight className="w-4 h-4 text-[#8B949E] opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
