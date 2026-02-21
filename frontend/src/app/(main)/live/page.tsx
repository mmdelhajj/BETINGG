'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trophy,
  Timer,
  Activity,
  TrendingUp,
  TrendingDown,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { io as ioClient, type Socket } from 'socket.io-client';
import { cn, formatOdds } from '@/lib/utils';
import { get } from '@/lib/api';
import { useBetSlipStore, type BetSelection } from '@/stores/betSlipStore';
import { AnimatedScore, LiveMatchClock, LiveIndicator } from '@/components/LiveScoreTicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  startTime: string;
  status: string;
  scores?: { home?: number; away?: number } | null;
  metadata?: {
    elapsed?: number | null;
    statusShort?: string;
    statusLong?: string;
    round?: string;
    sport?: string;
    timer?: {
      tm?: number;
      ts?: number;
      ta?: number;
      q?: string;
      tt?: string;
      md?: number;
    };
    periodScores?: Record<string, { home: number; away: number }>;
    [key: string]: unknown;
  } | null;
  sport: string;
  sportSlug: string;
  competition: string;
  competitionSlug: string;
  time?: string | null;
  period?: string | null;
  mainMarket?: {
    id: string;
    name: string;
    type: string;
    selections: { id: string; name: string; outcome: string; odds: string | number; status: string }[];
  } | null;
}

interface GoalNotification {
  id: string;
  eventId: string;
  team: string;
  score: string;
  timestamp: number;
}

interface SportGroup {
  slug: string;
  name: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Socket.IO URL derivation
// ---------------------------------------------------------------------------

function getSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  // Strip /api/v1 or any trailing path from the URL to get the base server URL
  return apiUrl.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Match Time Display Helper
// ---------------------------------------------------------------------------

function getMatchTimeDisplay(event: LiveEvent): string {
  // Prefer pre-computed time from backend API (works for Cloudbet + BetsAPI)
  if (event.time) return event.time;

  const meta = event.metadata;
  if (!meta) return 'LIVE';

  const statusShort = meta.statusShort || '';
  const elapsed = meta.elapsed;
  const timer = meta.timer;
  const sportSlug = event.sportSlug || meta.sport || '';

  // ---------------------------------------------------------------------------
  // BetsAPI timer format handling
  // ---------------------------------------------------------------------------

  // Football with BetsAPI timer
  if (sportSlug === 'football' && timer && timer.tm != null) {
    if (statusShort === 'HT') return 'HT';
    if (statusShort === 'FT') return 'FT';
    if (statusShort === 'P') return 'PEN';
    if (statusShort === 'BT') return 'Break';

    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const ta = timer.ta != null ? parseInt(String(timer.ta), 10) : 0;

    // Stoppage/added time: show 90+X' or 45+X'
    if (tm >= 90 && ta > 0) {
      return `90+${ta}'`;
    }
    if (tm >= 45 && tm < 46 && ta > 0 && statusShort === '1H') {
      return `45+${ta}'`;
    }

    // Standard football timer: show MM:SS or just MM'
    if (ts > 0) {
      return `${tm}:${String(ts).padStart(2, '0')}`;
    }
    return `${tm}'`;
  }

  // Basketball with BetsAPI timer
  if (sportSlug === 'basketball' && timer && timer.q != null) {
    const q = parseInt(String(timer.q), 10) || 1;
    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const label = q <= 4 ? `Q${q}` : 'OT';
    return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
  }

  // Ice Hockey with BetsAPI timer
  if (sportSlug === 'ice-hockey' && timer && timer.q != null) {
    const p = parseInt(String(timer.q), 10) || 1;
    const tm = parseInt(String(timer.tm), 10) || 0;
    const ts = parseInt(String(timer.ts), 10) || 0;
    const label = p <= 3 ? `P${p}` : 'OT';
    return `${label} ${tm}:${String(ts).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Legacy elapsed/statusShort format (backward compatibility)
  // ---------------------------------------------------------------------------

  // Football: show elapsed minutes + half
  if (sportSlug === 'football') {
    if (statusShort === 'HT') return 'HT';
    if (statusShort === 'FT') return 'FT';
    if (statusShort === 'ET') return elapsed ? `ET ${elapsed}'` : 'ET';
    if (statusShort === 'P') return 'PEN';
    if (statusShort === 'BT') return 'Break';
    if (elapsed) return `${elapsed}'`;
    if (statusShort === '1H') return '1H';
    if (statusShort === '2H') return '2H';
    return 'LIVE';
  }

  // Basketball: show quarter + time
  if (sportSlug === 'basketball') {
    switch (statusShort) {
      case 'Q1': return elapsed ? `Q1 ${elapsed}'` : 'Q1';
      case 'Q2': return elapsed ? `Q2 ${elapsed}'` : 'Q2';
      case 'Q3': return elapsed ? `Q3 ${elapsed}'` : 'Q3';
      case 'Q4': return elapsed ? `Q4 ${elapsed}'` : 'Q4';
      case 'OT': return elapsed ? `OT ${elapsed}'` : 'OT';
      case 'BT': return 'Break';
      case 'HT': return 'HT';
    }
    return statusShort || 'LIVE';
  }

  // Ice Hockey: show period + time
  if (sportSlug === 'ice-hockey') {
    switch (statusShort) {
      case 'P1': return elapsed ? `P1 ${elapsed}'` : '1st';
      case 'P2': return elapsed ? `P2 ${elapsed}'` : '2nd';
      case 'P3': return elapsed ? `P3 ${elapsed}'` : '3rd';
      case 'OT': return elapsed ? `OT ${elapsed}'` : 'OT';
      case 'BT': return 'Break';
    }
    return statusShort || 'LIVE';
  }

  // Handball
  if (sportSlug === 'handball') {
    if (statusShort === '1H') return elapsed ? `1H ${elapsed}'` : '1H';
    if (statusShort === '2H') return elapsed ? `2H ${elapsed}'` : '2H';
    if (statusShort === 'HT') return 'HT';
    return statusShort || 'LIVE';
  }

  // Volleyball: show set
  if (sportSlug === 'volleyball') {
    switch (statusShort) {
      case 'S1': return 'Set 1';
      case 'S2': return 'Set 2';
      case 'S3': return 'Set 3';
      case 'S4': return 'Set 4';
      case 'S5': return 'Set 5';
    }
    return statusShort || 'LIVE';
  }

  // Rugby
  if (sportSlug === 'rugby') {
    if (statusShort === '1H') return elapsed ? `1H ${elapsed}'` : '1H';
    if (statusShort === '2H') return elapsed ? `2H ${elapsed}'` : '2H';
    if (statusShort === 'HT') return 'HT';
    return statusShort || 'LIVE';
  }

  // Baseball
  if (sportSlug === 'baseball') {
    const inningMatch = statusShort.match(/^IN(\d+)$/);
    if (inningMatch) return `${inningMatch[1]}th`;
    return statusShort || 'LIVE';
  }

  // Generic fallback
  if (elapsed) return `${elapsed}'`;
  if (statusShort) return statusShort;
  return 'LIVE';
}

function getMatchPeriodLabel(event: LiveEvent): string {
  const meta = event.metadata;
  if (!meta?.statusLong) return '';
  return meta.statusLong;
}

// ---------------------------------------------------------------------------
// Sport emojis
// ---------------------------------------------------------------------------

const SPORT_EMOJIS: Record<string, string> = {
  football: '\u26BD',
  basketball: '\uD83C\uDFC0',
  'ice-hockey': '\uD83C\uDFD2',
  'american-football': '\uD83C\uDFC8',
  handball: '\uD83E\uDD3E',
  baseball: '\u26BE',
  rugby: '\uD83C\uDFC9',
  volleyball: '\uD83C\uDFD0',
};

// ---------------------------------------------------------------------------
// Odds Button with Cloudbet-style design
// ---------------------------------------------------------------------------

function LiveOddsButton({
  eventId, eventName, sportId, sportName, marketId, marketName,
  selectionId, outcomeName, odds, startTime,
}: {
  eventId: string; eventName: string; sportId: string; sportName: string;
  marketId: string; marketName: string; selectionId: string;
  outcomeName: string; odds: number; startTime: string;
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
          sportId, sportName, startTime, isLive: true,
        });
      }}
      className={cn(
        'relative flex flex-col items-center gap-0.5 min-w-[64px] px-3 py-1.5 rounded-button border text-xs transition-all duration-200',
        isSelected
          ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 ring-1 ring-[#8B5CF6]/30'
          : 'bg-[#0D1117] border-[#21262D] hover:border-[#8B5CF6]/40 hover:bg-[#161B22]',
      )}
    >
      <span className="text-[10px] text-[#8B949E] truncate max-w-full leading-none">{outcomeName}</span>
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
// Skeleton row
// ---------------------------------------------------------------------------

function EventRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[#21262D]/50 last:border-0">
      <div className="w-[38%] min-w-[130px] flex flex-col gap-1.5">
        <div className="h-3.5 w-24 skeleton rounded" />
        <div className="h-3.5 w-20 skeleton rounded" />
      </div>
      <div className="w-[50px] flex flex-col items-center gap-1">
        <div className="h-4 w-6 skeleton rounded" />
        <div className="h-4 w-6 skeleton rounded" />
      </div>
      <div className="w-[56px] flex flex-col items-center gap-1">
        <div className="h-3.5 w-10 skeleton rounded" />
        <div className="h-3 w-8 skeleton rounded" />
      </div>
      <div className="flex gap-1.5 flex-1 justify-end">
        <div className="h-9 w-[64px] skeleton rounded-button" />
        <div className="h-9 w-[64px] skeleton rounded-button" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Betting Page
// ---------------------------------------------------------------------------

export default function LiveBettingPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set());
  const [goalNotifications, setGoalNotifications] = useState<GoalNotification[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

  // Track previous scores to detect changes and apply flash animation
  const prevScoresRef = useRef<Record<string, { home: number; away: number }>>({});
  // Track which event IDs are currently "flashing" due to a score change
  const [flashingEvents, setFlashingEvents] = useState<Set<string>>(new Set());
  // Reference to the socket instance
  const socketRef = useRef<Socket | null>(null);
  // Reference to the polling interval fallback
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track whether we've done the initial expand
  const hasAutoExpandedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Auto-expand sports helper
  // -------------------------------------------------------------------------
  const autoExpandSports = useCallback((liveEvents: LiveEvent[]) => {
    if (!hasAutoExpandedRef.current && liveEvents.length > 0) {
      const sports = new Set(liveEvents.map((e) => e.sportSlug).filter(Boolean));
      setExpandedSports(sports);
      hasAutoExpandedRef.current = true;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Score change detection --- updates flash state and triggers notifications
  // -------------------------------------------------------------------------
  const detectScoreChanges = useCallback((newEvents: LiveEvent[]) => {
    const prev = prevScoresRef.current;
    const newFlashing = new Set<string>();

    for (const event of newEvents) {
      const newHome = event.scores?.home ?? 0;
      const newAway = event.scores?.away ?? 0;
      const prevScore = prev[event.id];

      if (prevScore) {
        const homeScored = newHome > prevScore.home;
        const awayScored = newAway > prevScore.away;

        if (homeScored || awayScored) {
          newFlashing.add(event.id);

          const scoringTeam = homeScored ? event.homeTeam : event.awayTeam;
          const notifId = `${event.id}-${newHome}-${newAway}-${Date.now()}`;

          setGoalNotifications((prev) => [
            ...prev,
            {
              id: notifId,
              eventId: event.id,
              team: scoringTeam,
              score: `${newHome} - ${newAway}`,
              timestamp: Date.now(),
            },
          ]);

          // Auto-dismiss notification after 5 seconds
          setTimeout(() => {
            setGoalNotifications((prev) => prev.filter((n) => n.id !== notifId));
          }, 5000);
        }
      }

      // Update tracked scores
      prev[event.id] = { home: newHome, away: newAway };
    }

    if (newFlashing.size > 0) {
      setFlashingEvents((existing) => {
        const merged = new Set(existing);
        newFlashing.forEach((id) => merged.add(id));
        return merged;
      });

      // Clear flash after animation completes (1.5s matches the CSS animation)
      setTimeout(() => {
        setFlashingEvents((existing) => {
          const next = new Set(existing);
          newFlashing.forEach((id) => next.delete(id));
          return next;
        });
      }, 1500);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Initial API fetch
  // -------------------------------------------------------------------------
  const fetchLiveEvents = useCallback(async () => {
    try {
      const data = await get<{ events: LiveEvent[] }>('/events?status=LIVE&limit=200');
      const liveEvents = (data.events || []).filter(
        (e) => e.status === 'LIVE'
      );
      detectScoreChanges(liveEvents);
      setEvents(liveEvents);
      autoExpandSports(liveEvents);
    } catch {
      // Fallback: try alternative endpoint
      try {
        const data = await get<{ events: LiveEvent[] }>('/events/live');
        const liveEvents = data.events || [];
        detectScoreChanges(liveEvents);
        setEvents(liveEvents);
        autoExpandSports(liveEvents);
      } catch {
        setEvents([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [detectScoreChanges, autoExpandSports]);

  // -------------------------------------------------------------------------
  // Start polling fallback (used when Socket.IO is not connected)
  // -------------------------------------------------------------------------
  const startPollingFallback = useCallback(() => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(fetchLiveEvents, 30000);
  }, [fetchLiveEvents]);

  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // Socket.IO connection + event listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    // 1. Always do an initial API fetch for first load
    fetchLiveEvents();

    // 2. Connect to Socket.IO /live namespace
    const socketUrl = getSocketUrl();
    const socket = ioClient(`${socketUrl}/live`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      // Stop polling since we have a live socket connection
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      // Fall back to polling when socket disconnects
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchLiveEvents();
        }, 30000);
      }
    });

    socket.on('connect_error', () => {
      setSocketConnected(false);
      // Fall back to polling on connection error
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchLiveEvents();
        }, 30000);
      }
    });

    // ---- live:update --- full list of all live events ----
    socket.on('live:update', (data: { events: LiveEvent[] }) => {
      if (data && Array.isArray(data.events)) {
        const liveEvents = data.events.filter((e) => e.status === 'LIVE');
        detectScoreChanges(liveEvents);
        setEvents(liveEvents);
        autoExpandSports(liveEvents);
        setIsLoading(false);
      }
    });

    // ---- live:goal --- score change notification ----
    socket.on(
      'live:goal',
      (data: {
        eventId: string;
        homeTeam: string;
        awayTeam: string;
        homeScore: number;
        awayScore: number;
        timer?: unknown;
        sportSlug?: string;
        competition?: string;
      }) => {
        if (!data || !data.eventId) return;

        // Determine which team scored by comparing with previous scores
        const prev = prevScoresRef.current[data.eventId];
        let scoringTeam = data.homeTeam; // default
        if (prev) {
          if (data.awayScore > (prev.away ?? 0)) {
            scoringTeam = data.awayTeam;
          } else if (data.homeScore > (prev.home ?? 0)) {
            scoringTeam = data.homeTeam;
          }
        }

        // Update the score in our tracked scores
        prevScoresRef.current[data.eventId] = {
          home: data.homeScore,
          away: data.awayScore,
        };

        // Flash the event card
        setFlashingEvents((existing) => {
          const next = new Set(existing);
          next.add(data.eventId);
          return next;
        });
        setTimeout(() => {
          setFlashingEvents((existing) => {
            const next = new Set(existing);
            next.delete(data.eventId);
            return next;
          });
        }, 1500);

        // Add goal notification
        const notifId = `goal-${data.eventId}-${data.homeScore}-${data.awayScore}-${Date.now()}`;
        setGoalNotifications((prev) => [
          ...prev,
          {
            id: notifId,
            eventId: data.eventId,
            team: scoringTeam,
            score: `${data.homeScore} - ${data.awayScore}`,
            timestamp: Date.now(),
          },
        ]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setGoalNotifications((prev) => prev.filter((n) => n.id !== notifId));
        }, 5000);

        // Also update the event in our events list with the new score
        setEvents((currentEvents) =>
          currentEvents.map((ev) => {
            if (ev.id === data.eventId) {
              return {
                ...ev,
                scores: { home: data.homeScore, away: data.awayScore },
              };
            }
            return ev;
          })
        );
      }
    );

    // ---- event:update --- single event update (when subscribed to event room) ----
    socket.on('event:update', (data: LiveEvent) => {
      if (!data || !data.id) return;
      setEvents((currentEvents) => {
        const idx = currentEvents.findIndex((e) => e.id === data.id);
        if (idx >= 0) {
          const updated = [...currentEvents];
          // Detect score change for this single event
          const prevScore = prevScoresRef.current[data.id];
          const newHome = data.scores?.home ?? 0;
          const newAway = data.scores?.away ?? 0;
          if (prevScore && (newHome > prevScore.home || newAway > prevScore.away)) {
            setFlashingEvents((existing) => {
              const next = new Set(existing);
              next.add(data.id);
              return next;
            });
            setTimeout(() => {
              setFlashingEvents((existing) => {
                const next = new Set(existing);
                next.delete(data.id);
                return next;
              });
            }, 1500);
          }
          prevScoresRef.current[data.id] = { home: newHome, away: newAway };
          updated[idx] = data;
          return updated;
        }
        // New event not in list yet --- add it if LIVE
        if (data.status === 'LIVE') {
          prevScoresRef.current[data.id] = {
            home: data.scores?.home ?? 0,
            away: data.scores?.away ?? 0,
          };
          return [...currentEvents, data];
        }
        return currentEvents;
      });
    });

    // If socket doesn't connect within 5 seconds, start polling as fallback
    const fallbackTimeout = setTimeout(() => {
      if (!socket.connected && !pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          fetchLiveEvents();
        }, 30000);
      }
    }, 5000);

    // Cleanup
    return () => {
      clearTimeout(fallbackTimeout);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('live:update');
      socket.off('live:goal');
      socket.off('event:update');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter events
  const filteredEvents = events.filter((e) => {
    if (selectedSport && e.sportSlug !== selectedSport) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (e.homeTeam || '').toLowerCase().includes(q) ||
        (e.awayTeam || '').toLowerCase().includes(q) ||
        (e.competition || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by sport, then by competition within each sport
  const groupedBySport: Record<string, Record<string, LiveEvent[]>> = {};
  for (const event of filteredEvents) {
    const sportKey = event.sportSlug || event.sport || 'other';
    if (!groupedBySport[sportKey]) groupedBySport[sportKey] = {};
    const compKey = event.competition || 'Other';
    if (!groupedBySport[sportKey][compKey]) groupedBySport[sportKey][compKey] = [];
    groupedBySport[sportKey][compKey].push(event);
  }

  // Sport list with counts
  const sportGroups: SportGroup[] = [];
  const sportCounts: Record<string, number> = {};
  for (const e of events) {
    const key = e.sportSlug || 'other';
    sportCounts[key] = (sportCounts[key] || 0) + 1;
  }
  for (const [slug, count] of Object.entries(sportCounts)) {
    const sample = events.find((e) => e.sportSlug === slug);
    sportGroups.push({ slug, name: sample?.sport || slug, count });
  }
  sportGroups.sort((a, b) => b.count - a.count);

  const toggleSportExpand = (slug: string) => {
    setExpandedSports((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ================================================================= */}
      {/* Goal Notifications (fixed top-right)                              */}
      {/* ================================================================= */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {goalNotifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="bg-[#0D1117] border border-[#10B981]/40 rounded-card p-3 flex items-center gap-3 backdrop-blur-sm shadow-lg shadow-[#10B981]/10 pointer-events-auto"
            >
              <div className="w-8 h-8 rounded-full bg-[#10B981]/15 flex items-center justify-center shrink-0">
                <span className="text-base">{'\u26BD'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-[#10B981] uppercase tracking-wider">GOAL!</span>
                </div>
                <span className="text-xs text-[#8B949E] truncate block">{notif.team} scored</span>
              </div>
              <span className="text-sm font-mono text-[#E6EDF3] font-bold whitespace-nowrap bg-[#161B22] px-2.5 py-1 rounded-button">
                {notif.score}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ================================================================= */}
      {/* Sticky Header Bar                                                 */}
      {/* ================================================================= */}
      <div className="sticky top-0 z-40 border-b border-[#21262D] bg-[#161B22]/95 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4">
          {/* Top row: Title + Search + Connection */}
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <LiveIndicator size="md" />
              <h1 className="text-xl font-bold text-[#E6EDF3] tracking-tight">
                Betting
              </h1>
              <span className="text-xs text-[#8B949E] bg-[#21262D] px-2 py-0.5 rounded-full font-medium hidden sm:inline-flex">
                {events.length} events across {sportGroups.length} sports
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B949E]" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 bg-[#0D1117] border border-[#21262D] rounded-button pl-9 pr-3 text-xs text-[#E6EDF3] placeholder:text-[#8B949E]/60 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]/50 transition-all"
                />
              </div>
              {/* Socket connection indicator */}
              <div className="flex items-center gap-1.5 shrink-0">
                {socketConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-[10px] text-[#10B981] font-semibold hidden sm:inline">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-[#8B949E]" />
                    <span className="text-[10px] text-[#8B949E] font-semibold hidden sm:inline">Polling</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sport Filter Pills Row */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2.5 -mt-0.5">
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
              All Live
              <span className="ml-0.5 opacity-70">{events.length}</span>
            </button>
            {sportGroups.map((sport) => (
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

      {/* ================================================================= */}
      {/* Main Content Area                                                 */}
      {/* ================================================================= */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        {/* Loading */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#161B22] border border-[#21262D] rounded-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262D]">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 skeleton rounded" />
                    <div className="h-4 w-28 skeleton rounded" />
                    <div className="h-4 w-14 skeleton rounded-full" />
                  </div>
                  <div className="h-4 w-4 skeleton rounded" />
                </div>
                <EventRowSkeleton />
                <EventRowSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedBySport).map(([sportSlug, competitions]) => {
              const isExpanded = expandedSports.has(sportSlug);
              const allSportEvents = Object.values(competitions).flat();
              const sportName = allSportEvents[0]?.sport || sportSlug;
              const emoji = SPORT_EMOJIS[sportSlug] || '\uD83C\uDFC6';
              const totalCount = allSportEvents.length;

              return (
                <div key={sportSlug} className="bg-[#161B22] border border-[#21262D] rounded-card overflow-hidden">
                  {/* Sport Header - Clickable to expand/collapse */}
                  <button
                    onClick={() => toggleSportExpand(sportSlug)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1C2128]/50 transition-colors border-b border-[#21262D]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="text-xs font-bold text-[#E6EDF3] uppercase tracking-wide">{sportName}</span>
                      <LiveIndicator size="xs" />
                      <span className="text-[10px] text-[#EF4444] font-bold ml-0.5">
                        {totalCount}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#8B949E]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8B949E]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {/* Render each competition within the sport */}
                        {Object.entries(competitions).map(([compName, compEvents]) => (
                          <div key={compName}>
                            {/* Competition sub-header */}
                            <div className="flex items-center gap-2 px-4 py-1.5 bg-[#0D1117]/60 border-b border-[#21262D]/50">
                              <span className="text-[10px] font-semibold text-[#8B949E] uppercase tracking-wider">{compName}</span>
                              <span className="text-[10px] text-[#8B949E]/60">{compEvents.length}</span>
                            </div>

                            {/* Column headers */}
                            <div className="flex items-center gap-4 px-4 py-1 text-[10px] uppercase tracking-wider text-[#8B949E]/70 border-b border-[#21262D]/30 bg-[#0D1117]/30">
                              <span className="w-[38%] min-w-[130px]">Match</span>
                              <span className="w-[50px] text-center">Score</span>
                              <span className="w-[56px] text-center">Time</span>
                              <span className="flex-1 text-right">Odds</span>
                            </div>

                            {/* Event Rows */}
                            {compEvents.map((event, idx) => {
                              const market = event.mainMarket;
                              const selections = market?.selections ?? [];
                              const score = event.scores;
                              const matchTime = getMatchTimeDisplay(event);
                              const periodLabel = getMatchPeriodLabel(event);
                              const isFlashing = flashingEvents.has(event.id);

                              return (
                                <Link
                                  key={event.id}
                                  href={`/sports/${event.sportSlug}/${event.id}`}
                                  className={cn(
                                    'flex items-center gap-4 px-4 py-3 transition-all duration-200 hover:bg-[#1C2128]/50 group',
                                    idx > 0 && 'border-t border-[#21262D]/30',
                                    isFlashing && 'animate-score-flash',
                                  )}
                                >
                                  {/* Team Names */}
                                  <div className="w-[38%] min-w-[130px] flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      {event.homeTeamLogo && (
                                        <img src={event.homeTeamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />
                                      )}
                                      <span className="text-sm font-medium text-[#E6EDF3] truncate leading-tight">{event.homeTeam}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {event.awayTeamLogo && (
                                        <img src={event.awayTeamLogo} alt="" className="w-4 h-4 object-contain shrink-0" />
                                      )}
                                      <span className="text-sm font-medium text-[#E6EDF3] truncate leading-tight">{event.awayTeam}</span>
                                    </div>
                                  </div>

                                  {/* Score */}
                                  <div className="w-[50px] flex flex-col items-center gap-1">
                                    <AnimatedScore
                                      score={score?.home ?? 0}
                                      teamName={event.homeTeam}
                                      size="sm"
                                      className="!text-base leading-tight"
                                    />
                                    <AnimatedScore
                                      score={score?.away ?? 0}
                                      teamName={event.awayTeam}
                                      size="sm"
                                      className="!text-base leading-tight"
                                    />
                                  </div>

                                  {/* Time / Period */}
                                  <div className="w-[56px] flex flex-col items-center gap-0.5">
                                    <LiveMatchClock
                                      startTime={event.startTime}
                                      period={event.period || (event.metadata as any)?.statusShort || '1H'}
                                      timer={(event.metadata as any)?.timer?.tm ?? null}
                                      timerSeconds={(event.metadata as any)?.timer?.ts != null ? parseInt(String((event.metadata as any).timer.ts), 10) : null}
                                      sportSlug={event.sportSlug}
                                      size="sm"
                                    />
                                    {periodLabel && (
                                      <span className="text-[9px] text-[#8B949E] leading-none text-center">{periodLabel}</span>
                                    )}
                                  </div>

                                  {/* Odds */}
                                  <div className="flex-1 flex items-center gap-1.5 justify-end" onClick={(e) => e.preventDefault()}>
                                    {selections.length > 0 ? (
                                      <>
                                        {selections.map((sel: any) => (
                                          <LiveOddsButton
                                            key={sel.name || sel.outcome}
                                            selectionId={sel.id}
                                            eventId={event.id}
                                            eventName={`${event.homeTeam} vs ${event.awayTeam}`}
                                            sportId={event.sportSlug}
                                            sportName={event.sport}
                                            marketId={market?.id ?? ''}
                                            marketName={market?.name ?? ''}
                                            outcomeName={sel.name || sel.outcome}
                                            odds={typeof sel.odds === 'string' ? parseFloat(sel.odds) : sel.odds}
                                            startTime={event.startTime}
                                          />
                                        ))}
                                        <Link
                                          href={`/sports/${event.sportSlug}/${event.id}`}
                                          className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6] hover:text-[#A78BFA] ml-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          +more
                                          <ChevronRight className="w-3 h-3" />
                                        </Link>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-[#8B949E]/50 italic">No odds</span>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {filteredEvents.length === 0 && !isLoading && (
              <div className="bg-[#161B22] border border-[#21262D] rounded-card py-16 text-center">
                <Zap className="w-12 h-12 text-[#8B949E]/20 mx-auto mb-4" />
                <p className="text-[#E6EDF3] text-lg font-semibold">No live events right now</p>
                <p className="text-[#8B949E] text-sm mt-1">Check back soon for more live action.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
