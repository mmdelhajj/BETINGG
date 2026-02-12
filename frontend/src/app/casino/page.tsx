'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { casinoApi } from '@/lib/api';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  Layers,
  Radio,
  Grid3X3,
  Gamepad2,
  TrendingUp,
  Dice1,
  Bomb,
  CircleDot,
  Coins,
  Cherry,
  Spade,
  Club,
  Tv,
  Zap,
  Trophy,
  ShieldCheck,
  ChevronDown,
  ArrowUpDown,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────
interface CasinoGame {
  id: string;
  name: string;
  slug: string;
  type: string;
  thumbnail: string | null;
  provider?: { id?: string; name: string };
  rtp?: number;
  isNew?: boolean;
  isHot?: boolean;
  createdAt?: string;
  popularity?: number;
}

interface Provider {
  id: string;
  name: string;
  slug?: string;
  gameCount?: number;
}

// ─── Category Tabs ──────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: 'All Games', icon: Layers },
  { key: 'originals', label: 'Originals', icon: Sparkles },
  { key: 'live', label: 'Live Dealer', icon: Radio },
  { key: 'slots', label: 'Slots', icon: Cherry },
  { key: 'table', label: 'Table Games', icon: Spade },
  { key: 'blackjack', label: 'Blackjack', icon: Club },
  { key: 'roulette', label: 'Roulette', icon: CircleDot },
  { key: 'baccarat', label: 'Baccarat', icon: Layers },
  { key: 'poker', label: 'Poker', icon: Spade },
  { key: 'game-shows', label: 'Game Shows', icon: Tv },
  { key: 'crash', label: 'Crash', icon: TrendingUp },
  { key: 'arcade', label: 'Arcade', icon: Zap },
  { key: 'jackpot', label: 'Jackpot Slots', icon: Trophy },
];

// ─── Sort Options ───────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'popular', label: 'Popular' },
  { key: 'a-z', label: 'A-Z' },
  { key: 'newest', label: 'Newest' },
  { key: 'rtp', label: 'RTP (highest)' },
];

// ─── Originals Data ─────────────────────────────────────────────
const ORIGINALS = [
  {
    name: 'Crash',
    slug: 'crash',
    Icon: TrendingUp,
    gradient: 'from-orange-600 via-red-600 to-rose-700',
    description: 'Ride the multiplier',
  },
  {
    name: 'Dice',
    slug: 'dice',
    Icon: Dice1,
    gradient: 'from-blue-600 via-indigo-600 to-blue-800',
    description: 'Roll to win',
  },
  {
    name: 'Mines',
    slug: 'mines',
    Icon: Bomb,
    gradient: 'from-yellow-600 via-amber-600 to-orange-700',
    description: 'Avoid the mines',
  },
  {
    name: 'Plinko',
    slug: 'plinko',
    Icon: CircleDot,
    gradient: 'from-purple-600 via-violet-600 to-purple-800',
    description: 'Drop and collect',
  },
  {
    name: 'Coinflip',
    slug: 'coinflip',
    Icon: Coins,
    gradient: 'from-teal-600 via-emerald-600 to-green-700',
    description: 'Heads or tails',
  },
];

// ─── Game-type icon mapping (Lucide icons & gradients) ──────────
const GAME_TYPE_VISUALS: Record<
  string,
  { Icon: typeof TrendingUp; gradient: string; bgGradient: string }
> = {
  SLOT: {
    Icon: Grid3X3,
    gradient: 'from-amber-500 to-orange-600',
    bgGradient: 'from-amber-600/30 to-orange-600/30',
  },
  LIVE: {
    Icon: Radio,
    gradient: 'from-red-500 to-rose-600',
    bgGradient: 'from-red-600/30 to-rose-600/30',
  },
  TABLE: {
    Icon: Layers,
    gradient: 'from-green-500 to-emerald-600',
    bgGradient: 'from-green-600/30 to-emerald-600/30',
  },
  CRASH: {
    Icon: TrendingUp,
    gradient: 'from-orange-500 to-red-600',
    bgGradient: 'from-orange-600/30 to-red-600/30',
  },
  DICE: {
    Icon: Dice1,
    gradient: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-600/30 to-indigo-600/30',
  },
  MINES: {
    Icon: Bomb,
    gradient: 'from-yellow-500 to-amber-600',
    bgGradient: 'from-yellow-600/30 to-amber-600/30',
  },
  PLINKO: {
    Icon: CircleDot,
    gradient: 'from-purple-500 to-violet-600',
    bgGradient: 'from-purple-600/30 to-violet-600/30',
  },
  COINFLIP: {
    Icon: Coins,
    gradient: 'from-teal-500 to-cyan-600',
    bgGradient: 'from-teal-600/30 to-cyan-600/30',
  },
  BLACKJACK: {
    Icon: Club,
    gradient: 'from-green-500 to-emerald-600',
    bgGradient: 'from-green-600/30 to-emerald-600/30',
  },
  ROULETTE: {
    Icon: CircleDot,
    gradient: 'from-red-500 to-rose-600',
    bgGradient: 'from-red-600/30 to-rose-600/30',
  },
  BACCARAT: {
    Icon: Spade,
    gradient: 'from-indigo-500 to-purple-600',
    bgGradient: 'from-indigo-600/30 to-purple-600/30',
  },
  POKER: {
    Icon: Spade,
    gradient: 'from-emerald-500 to-teal-600',
    bgGradient: 'from-emerald-600/30 to-teal-600/30',
  },
};

const ITEMS_PER_PAGE = 20;

// ─── Main Component ─────────────────────────────────────────────
export default function CasinoPage() {
  const [allGames, setAllGames] = useState<CasinoGame[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

  const tabsRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // ── Fetch games ───────────────────────────────────────────────
  useEffect(() => {
    setIsLoading(true);
    const params: Record<string, string | number> = { limit: 200 };
    if (activeCategory !== 'all' && activeCategory !== 'originals') {
      params.type = activeCategory;
    }
    if (activeProvider) params.provider = activeProvider;
    if (search) params.search = search;

    casinoApi
      .getGames(params)
      .then(({ data }) => {
        setAllGames(data.data || []);
        setDisplayCount(ITEMS_PER_PAGE);
      })
      .catch(() => setAllGames([]))
      .finally(() => setIsLoading(false));
  }, [activeCategory, activeProvider, search]);

  // ── Fetch providers ───────────────────────────────────────────
  useEffect(() => {
    casinoApi
      .getProviders()
      .then(({ data }) => setProviders(data.data || []))
      .catch(() => setProviders([]));
  }, []);

  // ── Close sort dropdown on outside click ──────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Sort & filter logic ───────────────────────────────────────
  const sortedGames = useMemo(() => {
    const sorted = [...allGames];
    switch (sortBy) {
      case 'a-z':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        sorted.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
        break;
      case 'rtp':
        sorted.sort((a, b) => (b.rtp || 0) - (a.rtp || 0));
        break;
      case 'popular':
      default:
        sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
    }
    return sorted;
  }, [allGames, sortBy]);

  const visibleGames = useMemo(
    () => sortedGames.slice(0, displayCount),
    [sortedGames, displayCount]
  );

  const totalCount = sortedGames.length;
  const hasMore = displayCount < totalCount;

  // ── Category counts (approximate from fetched data) ───────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allGames.length };
    allGames.forEach((g) => {
      const t = g.type?.toLowerCase() || '';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [allGames]);

  // ── Helpers ───────────────────────────────────────────────────
  const getGameVisual = useCallback((type: string) => {
    const upper = type?.toUpperCase() || 'SLOT';
    return GAME_TYPE_VISUALS[upper] || GAME_TYPE_VISUALS.SLOT;
  }, []);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const clearSearch = () => setSearch('');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Casino</h1>
          {totalCount > 0 && (
            <span className="text-[13px] text-text-dim bg-surface-tertiary px-2.5 py-0.5 rounded-full font-medium">
              {totalCount} Games
            </span>
          )}
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games..."
            className="input pl-10 pr-9 w-full text-[13px]"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category Tabs ───────────────────────────────────────── */}
      <div className="relative mb-6">
        {/* Left scroll arrow */}
        <button
          onClick={() => scrollTabs('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-surface-secondary/90 border border-border flex items-center justify-center text-gray-400 hover:text-white hover:bg-surface-hover transition-colors backdrop-blur-sm hidden sm:flex"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={tabsRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-0 sm:px-8 pb-1"
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count =
              cat.key === 'all'
                ? categoryCounts.all || 0
                : categoryCounts[cat.key] || 0;
            const isActive = activeCategory === cat.key;

            return (
              <button
                key={cat.key}
                onClick={() => {
                  setActiveCategory(cat.key);
                  setDisplayCount(ITEMS_PER_PAGE);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-all duration-200 border ${
                  isActive
                    ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20'
                    : 'bg-transparent text-gray-300 border-border hover:bg-surface-hover hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    className={`text-[11px] ${
                      isActive ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right scroll arrow */}
        <button
          onClick={() => scrollTabs('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-surface-secondary/90 border border-border flex items-center justify-center text-gray-400 hover:text-white hover:bg-surface-hover transition-colors backdrop-blur-sm hidden sm:flex"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Originals Section ───────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'originals') && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent-yellow" />
            <h2 className="text-lg font-semibold text-white">
              CryptoBet Originals
            </h2>
            <span className="inline-flex items-center gap-1 text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full font-medium">
              <ShieldCheck className="w-3 h-3" />
              Provably Fair
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {ORIGINALS.map((game) => {
              const GameIcon = game.Icon;
              return (
                <Link
                  key={game.slug}
                  href={`/casino/${game.slug}`}
                  className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${game.gradient} p-5 sm:p-6 hover:scale-[1.03] transition-all duration-300 hover:shadow-lg hover:shadow-black/30`}
                >
                  {/* Decorative circles */}
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
                  <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />

                  <div className="relative z-10 flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      <GameIcon className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold text-[15px] text-white">
                      {game.name}
                    </span>
                    <span className="text-[11px] text-white/60">
                      {game.description}
                    </span>
                  </div>

                  {/* Provably Fair badge */}
                  <div className="absolute top-2 right-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-white/40" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Provider Filter ─────────────────────────────────────── */}
      {providers.length > 0 && (
        <section className="mb-6">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setActiveProvider(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap transition-all border ${
                activeProvider === null
                  ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                  : 'bg-surface-tertiary text-gray-400 border-border hover:bg-surface-hover hover:text-white'
              }`}
            >
              All Providers
            </button>
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() =>
                  setActiveProvider(
                    activeProvider === provider.id ? null : provider.id
                  )
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] whitespace-nowrap transition-all border ${
                  activeProvider === provider.id
                    ? 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                    : 'bg-surface-tertiary text-gray-400 border-border hover:bg-surface-hover hover:text-white'
                }`}
              >
                {provider.name}
                {provider.gameCount !== undefined && provider.gameCount !== null && (
                  <span className="text-[10px] text-gray-500">
                    ({provider.gameCount})
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Sort + Count Bar ────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-gray-500">
          Showing{' '}
          <span className="text-gray-300 font-medium">
            {Math.min(displayCount, totalCount)}
          </span>{' '}
          of{' '}
          <span className="text-gray-300 font-medium">{totalCount}</span>{' '}
          games
        </p>

        {/* Sort dropdown */}
        <div ref={sortRef} className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-gray-300 bg-surface-tertiary border border-border hover:bg-surface-hover transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                showSortDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showSortDropdown && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-surface-secondary border border-border rounded-lg shadow-dialog py-1 z-20 animate-fade-in">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setSortBy(opt.key);
                    setShowSortDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                    sortBy === opt.key
                      ? 'text-brand-400 bg-brand-500/10'
                      : 'text-gray-300 hover:bg-surface-hover'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Game Grid ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] bg-surface-tertiary rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : visibleGames.length === 0 ? (
        <div className="text-center py-20">
          <Gamepad2 className="w-14 h-14 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-base font-medium">No games found</p>
          <p className="text-[13px] text-gray-500 mt-1">
            Try a different search or category
          </p>
          {(search || activeProvider) && (
            <button
              onClick={() => {
                setSearch('');
                setActiveProvider(null);
              }}
              className="mt-4 text-brand-400 text-[13px] hover:text-brand-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {visibleGames.map((game) => {
              const visual = getGameVisual(game.type);
              const GameTypeIcon = visual.Icon;

              return (
                <Link
                  key={game.id}
                  href={`/casino/${game.slug}`}
                  className="group relative aspect-[3/4] bg-[#1A1B1F] rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 hover:scale-[1.02] transition-all duration-200 shadow-card"
                >
                  {/* Thumbnail or icon fallback */}
                  {game.thumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${visual.bgGradient} gap-3`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <GameTypeIcon className="w-8 h-8 text-white/80" />
                      </div>
                      {game.rtp !== undefined && game.rtp !== null && (
                        <span className="text-[10px] text-gray-400 font-mono bg-black/20 px-2 py-0.5 rounded">
                          RTP {game.rtp}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {game.isNew && (
                      <span className="text-[10px] font-bold bg-accent-green text-white px-1.5 py-0.5 rounded">
                        NEW
                      </span>
                    )}
                    {game.isHot && (
                      <span className="text-[10px] font-bold bg-accent-red text-white px-1.5 py-0.5 rounded">
                        HOT
                      </span>
                    )}
                  </div>

                  {game.rtp !== undefined && game.rtp !== null && game.thumbnail && (
                    <div className="absolute top-2 right-2">
                      <span className="text-[10px] font-mono bg-black/60 text-gray-300 px-1.5 py-0.5 rounded backdrop-blur-sm">
                        {game.rtp}%
                      </span>
                    </div>
                  )}

                  {/* Bottom info overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-10">
                    <p className="text-[14px] font-bold text-white truncate">
                      {game.name}
                    </p>
                    {game.provider && (
                      <p className="text-[12px] text-text-dim truncate">
                        {game.provider.name}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Load More ───────────────────────────────────────── */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 mt-8 mb-4">
              <button
                onClick={handleLoadMore}
                className="btn-secondary px-8 py-2.5 text-[14px] font-medium rounded-lg hover:bg-surface-hover transition-colors"
              >
                Load More
              </button>
              <p className="text-[12px] text-gray-500">
                Showing {Math.min(displayCount, totalCount)} of {totalCount}{' '}
                games
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
