'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { get } from '@/lib/api';
import { useSocketEvent } from '@/lib/socket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  scores?: { home?: number; away?: number } | null;
  metadata?: {
    elapsed?: number | null;
    statusShort?: string;
    statusLong?: string;
    timer?: {
      tm?: number;
      ts?: number;
      ta?: number;
      q?: string;
    };
    [key: string]: unknown;
  } | null;
  sport: string;
  sportSlug: string;
  competition: string;
  competitionSlug: string;
  time?: string | null;
  period?: string | null;
}

interface LiveGroup {
  sport: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
  events: LiveEvent[];
}

// ---------------------------------------------------------------------------
// Sport color dots
// ---------------------------------------------------------------------------

const SPORT_COLORS: Record<string, string> = {
  football: '#10B981',
  basketball: '#F59E0B',
  'ice-hockey': '#3B82F6',
  'american-football': '#8B5CF6',
  handball: '#EC4899',
  baseball: '#EF4444',
  rugby: '#F97316',
  volleyball: '#06B6D4',
  tennis: '#84CC16',
  cricket: '#A78BFA',
};

// ---------------------------------------------------------------------------
// Match time display helper (compact version for sidebar)
// ---------------------------------------------------------------------------

function getCompactMatchTime(event: LiveEvent): string {
  // Prefer pre-computed time from backend API (works for Cloudbet + BetsAPI)
  if (event.time) return event.time;

  const meta = event.metadata;
  if (!meta) return 'LIVE';

  const statusShort = meta.statusShort || '';
  const elapsed = meta.elapsed;
  const timer = meta.timer;
  const sportSlug = event.sportSlug || '';

  // Football with timer
  if (sportSlug === 'football' && timer && timer.tm != null) {
    if (statusShort === 'HT') return 'HT';
    if (statusShort === 'FT') return 'FT';
    if (statusShort === 'P') return 'PEN';
    const tm = parseInt(String(timer.tm), 10) || 0;
    const ta = timer.ta != null ? parseInt(String(timer.ta), 10) : 0;
    if (tm >= 90 && ta > 0) return `90+${ta}'`;
    if (tm >= 45 && tm < 46 && ta > 0 && statusShort === '1H') return `45+${ta}'`;
    return `${tm}'`;
  }

  // Basketball with timer
  if (sportSlug === 'basketball' && timer && timer.q != null) {
    const q = parseInt(String(timer.q), 10) || 1;
    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const label = q <= 4 ? `Q${q}` : 'OT';
    return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
  }

  // Ice Hockey with timer
  if (sportSlug === 'ice-hockey' && timer && timer.q != null) {
    const p = parseInt(String(timer.q), 10) || 1;
    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const label = p <= 3 ? `P${p}` : 'OT';
    return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
  }

  // Football fallback
  if (sportSlug === 'football') {
    if (statusShort === 'HT') return 'HT';
    if (statusShort === 'FT') return 'FT';
    if (elapsed) return `${elapsed}'`;
    if (statusShort === '1H') return '1H';
    if (statusShort === '2H') return '2H';
  }

  // Basketball fallback
  if (sportSlug === 'basketball') {
    if (['Q1', 'Q2', 'Q3', 'Q4', 'OT'].includes(statusShort)) return statusShort;
  }

  // Ice Hockey fallback
  if (sportSlug === 'ice-hockey') {
    if (statusShort === 'P1') return '1st';
    if (statusShort === 'P2') return '2nd';
    if (statusShort === 'P3') return '3rd';
  }

  if (elapsed) return `${elapsed}'`;
  if (statusShort) return statusShort;
  return 'LIVE';
}

// ---------------------------------------------------------------------------
// InPlayWidget Component
// ---------------------------------------------------------------------------

const MAX_EVENTS = 8;

export default function InPlayWidget() {
  const [groups, setGroups] = useState<LiveGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLive, setTotalLive] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Fetch live events
  // -------------------------------------------------------------------------
  const fetchLiveEvents = useCallback(async () => {
    try {
      // Primary: try the grouped live endpoint
      const data = await get<{ groups: LiveGroup[] }>('/events/live');
      const liveGroups = data.groups || [];
      setGroups(liveGroups);
      const count = liveGroups.reduce((sum, g) => sum + g.events.length, 0);
      setTotalLive(count);
    } catch {
      // Fallback: try the generic events endpoint
      try {
        const data = await get<{ events: LiveEvent[] }>('/events?status=LIVE&limit=50');
        const liveEvents = (data.events || []).filter((e) => e.status === 'LIVE');
        setTotalLive(liveEvents.length);

        // Group by sport manually
        const groupMap = new Map<string, LiveGroup>();
        for (const event of liveEvents) {
          const slug = event.sportSlug || 'other';
          if (!groupMap.has(slug)) {
            groupMap.set(slug, {
              sport: { id: slug, name: event.sport || slug, slug, icon: null },
              events: [],
            });
          }
          groupMap.get(slug)!.events.push(event);
        }
        setGroups(Array.from(groupMap.values()));
      } catch {
        setGroups([]);
        setTotalLive(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Socket.IO: listen for live event updates
  // -------------------------------------------------------------------------
  useSocketEvent('event:scoreUpdate', (data) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        events: group.events.map((event) => {
          if (event.id === data.eventId) {
            return {
              ...event,
              scores: data.score as { home?: number; away?: number },
            };
          }
          return event;
        }),
      })),
    );
  });

  useSocketEvent('event:statusChange', (data) => {
    if (data.status !== 'LIVE') {
      // Remove the event from the widget if it's no longer live
      setGroups((prev) => {
        const updated = prev
          .map((group) => ({
            ...group,
            events: group.events.filter((e) => e.id !== data.eventId),
          }))
          .filter((group) => group.events.length > 0);
        const count = updated.reduce((sum, g) => sum + g.events.length, 0);
        setTotalLive(count);
        return updated;
      });
    }
  });

  // -------------------------------------------------------------------------
  // Polling + lifecycle
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchLiveEvents();

    // Poll every 30 seconds
    pollingRef.current = setInterval(fetchLiveEvents, 30_000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchLiveEvents]);

  // -------------------------------------------------------------------------
  // Flatten events across groups, capped at MAX_EVENTS
  // -------------------------------------------------------------------------
  const displayGroups: { sportName: string; sportSlug: string; events: LiveEvent[] }[] = [];
  let eventCount = 0;

  for (const group of groups) {
    if (eventCount >= MAX_EVENTS) break;
    const remaining = MAX_EVENTS - eventCount;
    const sliced = group.events.slice(0, remaining);
    if (sliced.length > 0) {
      displayGroups.push({
        sportName: group.sport.name,
        sportSlug: group.sport.slug,
        events: sliced,
      });
      eventCount += sliced.length;
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="bg-[#161B22] border-b border-[#30363D]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363D]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#EF4444]" />
          </span>
          <span className="text-sm font-semibold text-[#E6EDF3]">In-Play</span>
          {totalLive > 0 && (
            <span className="text-[10px] font-medium text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-full">
              {totalLive}
            </span>
          )}
        </div>
        <Link
          href="/live"
          className="text-[11px] text-[#8B5CF6] hover:text-[#A78BFA] font-medium flex items-center gap-0.5 transition-colors"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Content */}
      <div className="py-1">
        {isLoading ? (
          /* Loading skeleton */
          <div className="px-4 py-2 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-1.5">
                <div className="h-3 w-20 bg-[#1C2128] rounded" />
                <div className="h-10 bg-[#1C2128] rounded" />
              </div>
            ))}
          </div>
        ) : totalLive === 0 ? (
          /* Empty state */
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-[#8B949E]">No live events right now</p>
          </div>
        ) : (
          /* Live events grouped by sport */
          displayGroups.map((group) => (
            <div key={group.sportSlug}>
              {/* Sport header */}
              <div className="flex items-center gap-2 px-4 py-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: SPORT_COLORS[group.sportSlug] || '#8B949E' }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B949E]">
                  {group.sportName}
                </span>
              </div>

              {/* Event rows */}
              {group.events.map((event) => {
                const homeScore = event.scores?.home ?? 0;
                const awayScore = event.scores?.away ?? 0;
                const matchTime = getCompactMatchTime(event);

                return (
                  <Link
                    key={event.id}
                    href={`/sports/${event.sportSlug}/${event.id}`}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-[#1C2128] transition-colors group/row"
                  >
                    {/* Teams & Score */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#E6EDF3] truncate pr-2 max-w-[140px]">
                          {event.homeTeam}
                        </span>
                        <span className="font-mono font-bold text-[#E6EDF3] shrink-0">
                          {homeScore}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-0.5">
                        <span className="text-[#E6EDF3] truncate pr-2 max-w-[140px]">
                          {event.awayTeam}
                        </span>
                        <span className="font-mono font-bold text-[#E6EDF3] shrink-0">
                          {awayScore}
                        </span>
                      </div>
                    </div>

                    {/* Time Badge */}
                    <div className="flex flex-col items-center shrink-0 ml-1">
                      <span className="text-[10px] font-mono font-semibold text-[#EF4444] leading-tight">
                        {matchTime}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[#30363D] group-hover/row:text-[#8B5CF6] transition-colors mt-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
