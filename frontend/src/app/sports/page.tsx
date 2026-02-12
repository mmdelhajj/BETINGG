'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { sportsApi } from '@/lib/api';
import { useSportsStore } from '@/stores/sportsStore';
import { EventCard } from '@/components/sports/EventCard';
import { cn } from '@/lib/utils';
import { SportIcon } from '@/components/sports/SportIcon';
import { ChevronRight, Zap, Wallet, Trophy } from 'lucide-react';
import type { Event } from '@/types';

// ---------- Dynamic gradient map by sport slug ----------
const SPORT_GRADIENTS: Record<string, string> = {
  football: 'from-green-600 to-emerald-800',
  basketball: 'from-orange-500 to-red-700',
  tennis: 'from-yellow-500 to-lime-700',
  cricket: 'from-blue-500 to-indigo-700',
  baseball: 'from-red-500 to-rose-800',
  'ice-hockey': 'from-cyan-500 to-blue-800',
  mma: 'from-red-600 to-gray-800',
  esports: 'from-purple-500 to-violet-800',
  'american-football': 'from-violet-500 to-purple-800',
  boxing: 'from-red-700 to-rose-900',
  'rugby-union': 'from-purple-600 to-fuchsia-800',
  'rugby-league': 'from-violet-600 to-purple-900',
  golf: 'from-green-500 to-emerald-700',
  'table-tennis': 'from-amber-500 to-orange-700',
  volleyball: 'from-pink-500 to-rose-700',
  darts: 'from-rose-500 to-red-800',
  cycling: 'from-amber-500 to-yellow-700',
  f1: 'from-red-600 to-rose-900',
  handball: 'from-orange-400 to-amber-700',
  snooker: 'from-green-700 to-emerald-900',
  badminton: 'from-sky-400 to-blue-700',
  'horse-racing': 'from-yellow-700 to-amber-900',
  'greyhound-racing': 'from-stone-500 to-gray-800',
  futsal: 'from-green-400 to-emerald-700',
  'water-polo': 'from-sky-500 to-cyan-800',
  'aussie-rules': 'from-yellow-500 to-amber-700',
  surfing: 'from-cyan-500 to-teal-700',
  skiing: 'from-sky-300 to-blue-600',
  cs2: 'from-orange-500 to-amber-800',
  'dota-2': 'from-red-600 to-rose-800',
  'league-of-legends': 'from-purple-400 to-violet-700',
  valorant: 'from-rose-500 to-red-700',
  'rainbow-six': 'from-indigo-500 to-blue-800',
  'starcraft-2': 'from-cyan-400 to-teal-700',
  'call-of-duty': 'from-lime-500 to-green-800',
  'ea-sports-fc': 'from-emerald-500 to-green-800',
  'rocket-league': 'from-blue-500 to-indigo-800',
  politics: 'from-indigo-500 to-violet-800',
  entertainment: 'from-pink-400 to-fuchsia-700',
};

const DEFAULT_GRADIENT = 'from-gray-600 to-gray-800';

// ---------- Skeleton components ----------
function CardSkeleton() {
  return <div className="rounded-lg h-[180px] animate-pulse bg-surface-tertiary shrink-0" />;
}

function LiveScrollSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="min-w-[300px] rounded-lg h-[180px] animate-pulse bg-surface-tertiary" />
      ))}
    </div>
  );
}

function SportGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-xl h-28 animate-pulse bg-surface-tertiary" />
      ))}
    </div>
  );
}

export default function SportsPage() {
  const { sports, liveEvents, featuredEvents, loadSports, loadLiveEvents, loadFeaturedEvents } =
    useSportsStore();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    loadSports();
    loadLiveEvents();
    loadFeaturedEvents();

    sportsApi
      .getEvents({ limit: 10, status: 'UPCOMING' })
      .then(({ data }) => {
        setUpcomingEvents(Array.isArray(data.data) ? data.data : []);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [loadSports, loadLiveEvents, loadFeaturedEvents]);

  // Build live counts per sport from live events
  const liveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of liveEvents) {
      const sportSlug = ev.competition?.sport?.slug;
      if (sportSlug) {
        counts[sportSlug] = (counts[sportSlug] || 0) + 1;
      }
    }
    return counts;
  }, [liveEvents]);

  // Active sports sorted by sortOrder
  const activeSports = useMemo(() => {
    return [...sports]
      .filter((s) => s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [sports]);

  // Category quick-filter: derive unique sport categories from live + upcoming events
  const categories = useMemo(() => {
    const cats = new Map<string, { name: string; slug: string; icon: string | null }>();
    for (const s of activeSports) {
      cats.set(s.slug, { name: s.name, slug: s.slug, icon: s.icon });
    }
    return Array.from(cats.values()).slice(0, 12);
  }, [activeSports]);

  // Filter upcoming events by category
  const filteredUpcoming = useMemo(() => {
    if (!activeCategory) return upcomingEvents;
    return upcomingEvents.filter(
      (e) => e.competition?.sport?.slug === activeCategory
    );
  }, [upcomingEvents, activeCategory]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ─── Hero Section ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-surface-secondary p-8 md:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Sports Betting</h1>
          <p className="text-gray-300 max-w-lg mb-6">
            Bet on thousands of events across all major sports. Competitive odds, fast payouts, and
            live in-play betting with real-time updates.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sports/live" className="btn-primary flex items-center gap-2">
              <span className="w-2 h-2 bg-accent-red rounded-full animate-pulse" />
              Live Events
              {liveEvents.length > 0 && (
                <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
                  {liveEvents.length}
                </span>
              )}
            </Link>
            <Link href="/my-bets" className="btn-secondary">
              My Bets
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Live Events Horizontal Scroll ─────────────────────────── */}
      {liveEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-accent-red rounded-full animate-pulse" />
              Live Now
              <span className="text-sm font-normal text-gray-500">
                ({liveEvents.length})
              </span>
            </h2>
            <Link
              href="/sports/live"
              className="text-sm text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {liveEvents.slice(0, 10).map((event) => (
              <div key={event.id} className="min-w-[300px] max-w-[340px] shrink-0">
                <EventCard event={event} />
              </div>
            ))}
          </div>
        </section>
      )}

      {liveEvents.length === 0 && isLoading && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-accent-red rounded-full animate-pulse" />
            Live Now
          </h2>
          <LiveScrollSkeleton />
        </section>
      )}

      {/* ─── Featured Events ───────────────────────────────────────── */}
      {featuredEvents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent-yellow" />
              Featured
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {featuredEvents.slice(0, 4).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Popular Sports Grid -- Dynamic from store ─────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Popular Sports</h2>
        {activeSports.length === 0 ? (
          <SportGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeSports.slice(0, 12).map((sport) => {
              const liveCount = liveCounts[sport.slug] || 0;
              return (
                <Link
                  key={sport.slug}
                  href={`/sports/${sport.slug}`}
                  className={cn(
                    'relative overflow-hidden rounded-xl p-5 bg-gradient-to-br border border-transparent',
                    'hover:border-white/10 hover:scale-[1.02] transition-all duration-200 group',
                    SPORT_GRADIENTS[sport.slug] || DEFAULT_GRADIENT
                  )}
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-colors" />
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-3">
                      <SportIcon slug={sport.slug} size={24} emoji={sport.icon} />
                    </div>
                    <p className="font-semibold text-sm">{sport.name}</p>
                    {liveCount > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium bg-white/15 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
                        {liveCount} live
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── Category Quick-Filters + Upcoming Events ──────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
        </div>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border',
                !activeCategory
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-surface-tertiary text-gray-300 border-transparent hover:bg-surface-hover'
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border',
                  activeCategory === cat.slug
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-surface-tertiary text-gray-300 border-transparent hover:bg-surface-hover'
                )}
              >
                <SportIcon slug={cat.slug} size={14} emoji={cat.icon} />
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredUpcoming.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No upcoming events available</p>
            <p className="text-xs text-gray-600 mt-1">Check back soon for new events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredUpcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Quick Stats / Features ────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-brand-500/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-brand-400" />
          </div>
          <h3 className="font-semibold text-sm mb-1">Live Betting</h3>
          <p className="text-xs text-gray-500">
            Bet in real-time with live odds updates and instant settlement.
          </p>
        </div>
        <div className="card text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-accent-green/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-accent-green" />
          </div>
          <h3 className="font-semibold text-sm mb-1">Crypto Payouts</h3>
          <p className="text-xs text-gray-500">
            Fast withdrawals in BTC, ETH, USDT, and other cryptocurrencies.
          </p>
        </div>
        <div className="card text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-accent-yellow/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-accent-yellow" />
          </div>
          <h3 className="font-semibold text-sm mb-1">Best Odds</h3>
          <p className="text-xs text-gray-500">
            Competitive odds across all sports with low margin pricing.
          </p>
        </div>
      </section>
    </div>
  );
}
