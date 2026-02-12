'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useSportsStore } from '@/stores/sportsStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { sportsApi, casinoApi } from '@/lib/api';
import { formatOdds, cn } from '@/lib/utils';
import Link from 'next/link';
import {
  Search, ChevronRight, Zap, Shield, Trophy, Headphones,
  Clock, TrendingUp,
} from 'lucide-react';
import { SportIcon } from '@/components/sports/SportIcon';
import { EventCard } from '@/components/sports/EventCard';
import type { Event, Selection } from '@/types';

// ─── Quick-access sport categories ──────────────────────────────
const CATEGORY_BUTTONS = [
  { label: 'Soccer', slug: 'football' },
  { label: 'Basketball', slug: 'basketball' },
  { label: 'Tennis', slug: 'tennis' },
  { label: 'Cricket', slug: 'cricket' },
  { label: 'Ice Hockey', slug: 'ice-hockey' },
  { label: 'Esports', slug: 'esports' },
  { label: 'Baseball', slug: 'baseball' },
  { label: 'MMA', slug: 'mma' },
  { label: 'Boxing', slug: 'boxing' },
  { label: 'Golf', slug: 'golf' },
];

// ─── Why CryptoBet features ────────────────────────────────────
const WHY_FEATURES = [
  { title: 'Instant Payouts', description: 'Withdrawals via blockchain in minutes.', icon: Zap },
  { title: 'Provably Fair', description: 'Verify every result cryptographically.', icon: Shield },
  { title: 'Best Odds', description: 'Industry-leading margins on all markets.', icon: Trophy },
  { title: '24/7 Support', description: 'Expert help around the clock.', icon: Headphones },
];

// ─── Static popular sports (fallback when store is empty) ──────
const POPULAR_SPORTS_FALLBACK = [
  { name: 'Football', slug: 'football', events: 2400, liveCount: 12 },
  { name: 'Basketball', slug: 'basketball', events: 1200, liveCount: 8 },
  { name: 'Tennis', slug: 'tennis', events: 800, liveCount: 5 },
  { name: 'Cricket', slug: 'cricket', events: 350, liveCount: 2 },
  { name: 'Esports', slug: 'esports', events: 600, liveCount: 4 },
  { name: 'Ice Hockey', slug: 'ice-hockey', events: 450, liveCount: 3 },
  { name: 'MMA', slug: 'mma', events: 280, liveCount: 0 },
  { name: 'Boxing', slug: 'boxing', events: 150, liveCount: 0 },
];

// ─── Casino game fallbacks ─────────────────────────────────────
const CASINO_FALLBACK: { slug: string; name: string; provider: string; gradient: string; thumbnail?: string }[] = [
  { slug: 'crash', name: 'Crash', provider: 'CryptoBet', gradient: 'from-orange-600 to-red-600' },
  { slug: 'plinko', name: 'Plinko', provider: 'CryptoBet', gradient: 'from-purple-600 to-pink-600' },
  { slug: 'dice', name: 'Dice', provider: 'CryptoBet', gradient: 'from-blue-600 to-cyan-600' },
  { slug: 'blackjack', name: 'Blackjack', provider: 'Evolution', gradient: 'from-emerald-600 to-teal-600' },
  { slug: 'roulette', name: 'Roulette', provider: 'Evolution', gradient: 'from-red-600 to-rose-600' },
  { slug: 'mines', name: 'Mines', provider: 'CryptoBet', gradient: 'from-yellow-600 to-amber-600' },
];

// ─── Types for API data ────────────────────────────────────────
interface CasinoGame {
  slug: string;
  name: string;
  provider?: string | { name: string };
  thumbnail?: string;
}

// ─── Sport slug to display label for Quick Odds Table ──────────
const SPORT_LABELS: Record<string, string> = {
  football: 'Soccer',
  basketball: 'Basketball',
  tennis: 'Tennis',
  cricket: 'Cricket',
  'ice-hockey': 'Ice Hockey',
  esports: 'Esports',
  baseball: 'Baseball',
  mma: 'MMA',
  boxing: 'Boxing',
  golf: 'Golf',
};

// Sports that typically have 3-way markets (1/X/2)
const THREE_WAY_SPORTS = new Set(['football', 'ice-hockey', 'handball']);

// ─── Horizontal scroll helper ──────────────────────────────────
function HorizontalScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className={cn('flex gap-3 overflow-x-auto scrollbar-hide pb-1', className)}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Quick Odds Row ────────────────────────────────────────────
function QuickOddsRow({ event }: { event: Event }) {
  const { toggleSelection, hasSelection } = useBetSlipStore();
  const mainMarket = event.markets?.find((m) => m.type === 'MONEYLINE');
  const selections = mainMarket?.selections || [];

  const isThreeWay = selections.length === 3;
  const homeSel = selections.find((s) => s.outcome === 'home') || selections[0] || null;
  const drawSel = selections.find((s) => s.outcome === 'draw') || (isThreeWay ? selections[1] : null);
  const awaySel = selections.find((s) => s.outcome === 'away') || (isThreeWay ? selections[2] : selections[1]) || null;

  const handleSelect = (sel: Selection) => {
    toggleSelection({
      selectionId: sel.id,
      selectionName: sel.name,
      marketName: mainMarket?.name || '',
      eventName: event.name,
      eventId: event.id,
      odds: sel.odds,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
  };

  const startDate = new Date(event.startTime);
  const timeStr = event.isLive
    ? event.metadata?.matchTime || 'LIVE'
    : startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <Link
      href={`/sports/event/${event.id}`}
      className="grid items-center gap-2 px-3 py-2 hover:bg-surface-hover/50 transition-colors border-b border-[rgba(255,255,255,0.03)] last:border-b-0"
      style={{ gridTemplateColumns: 'minmax(56px, 64px) 1fr repeat(var(--odds-cols), 64px)' }}
    >
      {/* Time */}
      <div className="flex items-center gap-1.5">
        {event.isLive ? (
          <>
            <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-accent-red">{timeStr}</span>
          </>
        ) : (
          <span className="text-[11px] text-gray-500 font-medium">{timeStr}</span>
        )}
      </div>

      {/* Teams */}
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[13px] font-medium text-white truncate">
            {event.homeTeam || event.name}
          </span>
          {event.isLive && event.homeScore !== null && event.homeScore !== undefined && (
            <span className="text-xs font-bold font-mono text-white ml-auto shrink-0">
              {event.homeScore}
            </span>
          )}
        </div>
        {event.awayTeam && (
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-gray-400 truncate">
              {event.awayTeam}
            </span>
            {event.isLive && event.awayScore !== null && event.awayScore !== undefined && (
              <span className="text-xs font-bold font-mono text-gray-400 ml-auto shrink-0">
                {event.awayScore}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Odds: Home (1) */}
      {homeSel ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(homeSel); }}
          disabled={homeSel.status !== 'ACTIVE'}
          className={cn(
            'py-1.5 rounded text-center text-xs font-mono font-bold transition-all border',
            hasSelection(homeSel.id)
              ? 'bg-brand-500/20 border-brand-500 text-brand-400'
              : 'bg-surface-tertiary border-transparent hover:border-brand-500/50 text-white',
            homeSel.status === 'SUSPENDED' && 'opacity-40 cursor-not-allowed'
          )}
        >
          {formatOdds(homeSel.odds)}
        </button>
      ) : (
        <span className="py-1.5 text-center text-xs text-gray-600">-</span>
      )}

      {/* Odds: Draw (X) -- only for 3-way */}
      {drawSel ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(drawSel); }}
          disabled={drawSel.status !== 'ACTIVE'}
          className={cn(
            'py-1.5 rounded text-center text-xs font-mono font-bold transition-all border',
            hasSelection(drawSel.id)
              ? 'bg-brand-500/20 border-brand-500 text-brand-400'
              : 'bg-surface-tertiary border-transparent hover:border-brand-500/50 text-white',
            drawSel.status === 'SUSPENDED' && 'opacity-40 cursor-not-allowed'
          )}
        >
          {formatOdds(drawSel.odds)}
        </button>
      ) : isThreeWay ? (
        <span className="py-1.5 text-center text-xs text-gray-600">-</span>
      ) : null}

      {/* Odds: Away (2) */}
      {awaySel ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(awaySel); }}
          disabled={awaySel.status !== 'ACTIVE'}
          className={cn(
            'py-1.5 rounded text-center text-xs font-mono font-bold transition-all border',
            hasSelection(awaySel.id)
              ? 'bg-brand-500/20 border-brand-500 text-brand-400'
              : 'bg-surface-tertiary border-transparent hover:border-brand-500/50 text-white',
            awaySel.status === 'SUSPENDED' && 'opacity-40 cursor-not-allowed'
          )}
        >
          {formatOdds(awaySel.odds)}
        </button>
      ) : (
        <span className="py-1.5 text-center text-xs text-gray-600">-</span>
      )}
    </Link>
  );
}

// ─── Quick Odds Sport Section ──────────────────────────────────
function QuickOddsSportSection({
  sportSlug,
  events,
  isThreeWay,
}: {
  sportSlug: string;
  events: Event[];
  isThreeWay: boolean;
}) {
  const label = SPORT_LABELS[sportSlug] || sportSlug;
  const cols = isThreeWay ? 3 : 2;

  return (
    <div className="bg-[#1A1B1F] rounded-lg border border-[rgba(255,255,255,0.04)] overflow-hidden">
      {/* Sport header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2">
          <SportIcon slug={sportSlug} size={16} />
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="text-[11px] text-gray-500">({events.length})</span>
        </div>
        <Link
          href={`/sports/${sportSlug}`}
          className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-0.5"
        >
          All
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Column headers */}
      <div
        className="grid items-center gap-2 px-3 py-1.5 border-b border-[rgba(255,255,255,0.04)]"
        style={{ gridTemplateColumns: `minmax(56px, 64px) 1fr repeat(${cols}, 64px)` }}
      >
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Time</span>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Match</span>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium text-center">1</span>
        {isThreeWay && (
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium text-center">X</span>
        )}
        <span className="text-[10px] text-gray-600 uppercase tracking-wider font-medium text-center">2</span>
      </div>

      {/* Rows */}
      <div style={{ ['--odds-cols' as string]: cols }}>
        {events.map((event) => (
          <QuickOddsRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

// ─── Featured Match Hero Card ──────────────────────────────────
function FeaturedHeroCard({ event }: { event: Event }) {
  const { toggleSelection, hasSelection } = useBetSlipStore();
  const mainMarket = event.markets?.find((m) => m.type === 'MONEYLINE' || m.type === 'SPREAD');
  const selections = mainMarket?.selections || [];

  const handleSelect = (sel: Selection) => {
    toggleSelection({
      selectionId: sel.id,
      selectionName: sel.name,
      marketName: mainMarket?.name || '',
      eventName: event.name,
      eventId: event.id,
      odds: sel.odds,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
  };

  const homeInitials = (event.homeTeam || 'TBD')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

  const awayInitials = (event.awayTeam || 'TBD')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-brand-900 via-brand-800 to-surface-secondary border border-border min-h-[180px]">
      <div className="absolute inset-0">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-accent-purple/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          {event.isLive ? (
            <span className="flex items-center gap-1.5 text-xs bg-accent-red/20 border border-accent-red/30 text-accent-red px-2.5 py-0.5 rounded-full font-bold">
              <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="text-xs bg-brand-500/20 border border-brand-500/30 text-brand-400 px-2.5 py-0.5 rounded-full font-medium">
              Featured
            </span>
          )}
          <span className="text-xs text-gray-400">{event.competition?.name || ''}</span>
        </div>

        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {event.homeTeamLogo ? (
              <img src={event.homeTeamLogo} alt={event.homeTeam || ''} className="w-10 h-10 rounded-full object-contain bg-white/5 shrink-0" loading="lazy" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-sm shrink-0">{homeInitials}</div>
            )}
            <span className="text-base font-bold truncate">{event.homeTeam || 'TBD'}</span>
          </div>

          <div className="shrink-0 text-center">
            {event.isLive ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono">{event.homeScore ?? 0}</span>
                <span className="text-gray-500 text-sm">-</span>
                <span className="text-2xl font-bold font-mono text-gray-400">{event.awayScore ?? 0}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-500 font-medium">VS</span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className="text-base font-bold text-gray-300 truncate text-right">{event.awayTeam || 'TBD'}</span>
            {event.awayTeamLogo ? (
              <img src={event.awayTeamLogo} alt={event.awayTeam || ''} className="w-10 h-10 rounded-full object-contain bg-white/5 shrink-0" loading="lazy" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center text-accent-purple font-bold text-sm shrink-0">{awayInitials}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {selections.slice(0, 3).map((sel, idx) => {
            const label = selections.length === 3
              ? ['1', 'X', '2'][idx]
              : selections.length === 2
                ? ['1', '2'][idx]
                : sel.name;
            return (
              <button
                key={sel.id}
                onClick={() => handleSelect(sel)}
                disabled={sel.status !== 'ACTIVE'}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  hasSelection(sel.id)
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-tertiary/80 hover:bg-surface-hover text-white',
                  sel.status === 'SUSPENDED' && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="text-xs text-gray-400">{label}</span>
                <span className="font-mono font-bold text-brand-400">{formatOdds(sel.odds)}</span>
              </button>
            );
          })}
          <Link
            href={`/sports/event/${event.id}`}
            className="ml-auto btn-primary text-sm px-5 py-2 rounded-lg font-semibold"
          >
            Bet now
          </Link>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function HomePage() {
  const {
    sports,
    featuredEvents,
    liveEvents,
    loadSports,
    loadFeaturedEvents,
    loadLiveEvents,
  } = useSportsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [casinoGames, setCasinoGames] = useState<CasinoGame[]>([]);

  // Load data on mount
  useEffect(() => {
    loadSports();
    loadFeaturedEvents();
    loadLiveEvents();

    // Load upcoming events for the Quick Odds Table
    sportsApi
      .getEvents({ status: 'UPCOMING', limit: 40, sortBy: 'startTime', order: 'asc' })
      .then((res) => {
        const events = res.data?.data;
        if (Array.isArray(events)) setUpcomingEvents(events);
      })
      .catch(() => {});

    // Load casino games
    casinoApi
      .getGames({ limit: 6, category: 'popular' })
      .then((res) => {
        const games = res.data?.data;
        if (Array.isArray(games)) setCasinoGames(games);
      })
      .catch(() => {});
  }, [loadSports, loadFeaturedEvents, loadLiveEvents]);

  // Build popular sports from store or fallback
  const popularSports = sports.length > 0
    ? sports
        .filter((s) => s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 8)
        .map((s) => ({
          name: s.name,
          slug: s.slug,
          events: s.eventCount || 0,
          liveCount: s.liveCount || 0,
        }))
    : POPULAR_SPORTS_FALLBACK;

  // Casino games to display
  const displayCasino = casinoGames.length > 0
    ? casinoGames.map((g) => ({
        slug: g.slug,
        name: g.name,
        provider:
          typeof g.provider === 'string'
            ? g.provider
            : g.provider?.name || 'CryptoBet',
        thumbnail: g.thumbnail,
        gradient: '',
      }))
    : CASINO_FALLBACK;

  // Featured event hero
  const heroEvent = featuredEvents[0] || liveEvents[0] || null;

  // Upcoming events that are NOT the hero event, for the "Popular Matches" grid
  const popularMatches = useMemo(() => {
    const combined = [...featuredEvents, ...upcomingEvents];
    const seen = new Set<string>();
    if (heroEvent) seen.add(heroEvent.id);
    const unique: Event[] = [];
    for (const ev of combined) {
      if (!seen.has(ev.id) && ev.markets && ev.markets.length > 0) {
        seen.add(ev.id);
        unique.push(ev);
      }
      if (unique.length >= 6) break;
    }
    return unique;
  }, [featuredEvents, upcomingEvents, heroEvent]);

  // Group upcoming events by sport for Quick Odds Table
  const oddsBySport = useMemo(() => {
    const allEvents = [...liveEvents, ...upcomingEvents];
    const groups: Record<string, Event[]> = {};
    for (const ev of allEvents) {
      const sportSlug = ev.sport?.slug || ev.competition?.sport?.slug || '';
      if (!sportSlug) continue;
      if (!ev.markets || ev.markets.length === 0) continue;
      if (!groups[sportSlug]) groups[sportSlug] = [];
      if (groups[sportSlug].length < 8) {
        groups[sportSlug].push(ev);
      }
    }
    // Sort sport sections: prioritize those with more events
    const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    return entries.slice(0, 4);
  }, [liveEvents, upcomingEvents]);

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/sports?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 lg:pb-0 space-y-6">

      {/* ── Search Bar ────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="relative">
        <div className="flex items-center bg-surface-secondary rounded-lg border border-border focus-within:border-brand-500/50 transition-colors">
          <Search className="w-5 h-5 text-gray-500 ml-4 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sports, events, teams..."
            className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none"
          />
        </div>
      </form>

      {/* ── Category Quick Buttons ────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORY_BUTTONS.map((cat) => {
          const liveSport = popularSports.find((s) => s.slug === cat.slug);
          const liveCount = liveSport?.liveCount || 0;
          return (
            <Link
              key={cat.slug}
              href={`/sports/${cat.slug}`}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-colors bg-transparent border-border hover:border-border-hover hover:bg-surface-secondary text-gray-300"
            >
              <SportIcon slug={cat.slug} size={14} />
              {cat.label}
              {liveCount > 0 && (
                <span className="ml-0.5 text-[10px] bg-accent-red/20 text-accent-red px-1.5 py-0 rounded-full font-bold">
                  {liveCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Featured Match Hero ───────────────────────────────────── */}
      {heroEvent && (
        <section>
          <FeaturedHeroCard event={heroEvent} />
        </section>
      )}

      {/* ── Live Now ──────────────────────────────────────────────── */}
      {liveEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-red" />
              </span>
              LIVE NOW
              <span className="text-xs font-bold bg-accent-red/15 text-accent-red px-2 py-0.5 rounded-full">
                {liveEvents.length}
              </span>
            </h2>
            <Link
              href="/sports/live"
              className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors font-medium"
            >
              View All Live
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <HorizontalScroll className="gap-3">
            {liveEvents.slice(0, 12).map((event) => (
              <div key={event.id} className="shrink-0 w-[280px]">
                <EventCard event={event} />
              </div>
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* ── Popular Matches ───────────────────────────────────────── */}
      {popularMatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              Popular Matches
            </h2>
            <Link
              href="/sports"
              className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors font-medium"
            >
              All Events
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {popularMatches.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* ── Quick Odds Table ──────────────────────────────────────── */}
      {oddsBySport.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" />
              Upcoming Odds
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {oddsBySport.map(([sportSlug, events]) => (
              <QuickOddsSportSection
                key={sportSlug}
                sportSlug={sportSlug}
                events={events}
                isThreeWay={THREE_WAY_SPORTS.has(sportSlug)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Popular Sports ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">Sports</h2>
          <Link
            href="/sports"
            className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors font-medium"
          >
            All Sports
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {popularSports.map((sport) => (
            <Link
              key={sport.slug}
              href={`/sports/${sport.slug}`}
              className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.04)] rounded-lg p-3.5 flex items-center gap-3 hover:border-[rgba(255,255,255,0.12)] transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors shrink-0">
                <SportIcon slug={sport.slug} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold group-hover:text-brand-400 transition-colors truncate">
                  {sport.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500">
                    {sport.events > 0 ? `${sport.events.toLocaleString()}` : 'Browse'}
                  </span>
                  {sport.liveCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-accent-red font-bold">
                      <span className="w-1 h-1 bg-accent-red rounded-full animate-pulse" />
                      {sport.liveCount} live
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Casino Quick Access ────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">Casino</h2>
          <Link
            href="/casino"
            className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors font-medium"
          >
            All Games
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <HorizontalScroll>
          {displayCasino.map((game) => (
            <Link
              key={game.slug}
              href={`/casino/${game.slug}`}
              className="shrink-0 w-[120px] group"
            >
              <div
                className={cn(
                  'relative aspect-[3/4] rounded-lg overflow-hidden border border-[rgba(255,255,255,0.04)] group-hover:border-brand-500/40 transition-colors',
                  game.thumbnail ? '' : `bg-gradient-to-br ${game.gradient || 'from-gray-700 to-gray-900'}`
                )}
              >
                {game.thumbnail ? (
                  <img src={game.thumbnail} alt={game.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-2xl font-bold opacity-60">{game.name.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-5">
                  <p className="text-[11px] font-semibold text-white truncate">{game.name}</p>
                  <p className="text-[9px] text-gray-400 truncate">{game.provider}</p>
                </div>
              </div>
            </Link>
          ))}
        </HorizontalScroll>
      </section>

      {/* ── Why CryptoBet (compact) ────────────────────────────────── */}
      <section className="border-t border-[rgba(255,255,255,0.04)] pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {WHY_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-[#1A1B1F] border border-[rgba(255,255,255,0.04)]"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-brand-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{feature.title}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
