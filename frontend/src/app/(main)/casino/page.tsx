'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Gamepad2,
  Zap,
  Clock,
  TrendingUp,
  Flame,
  Shield,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  Crown,
  Snowflake,
  Play,
  Filter,
  Grid3X3,
  List,
  ShoppingBag,
  Heart,
  Percent,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { get } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketEvent } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CasinoGame {
  id: string;
  name: string;
  slug: string;
  thumbnail: string;
  type?: string;
  provider: string;
  category: string;
  isProvablyFair?: boolean;
  isDemoAvailable?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  rtp: number;
  houseEdge?: number;
  playCount?: number;
  tags?: string[];
  description?: string;
}

interface LiveBet {
  id: string;
  username: string;
  game: string;
  gameSlug: string;
  amount: number;
  currency: string;
  multiplier: number;
  payout: number;
  timestamp: string;
}

interface BigWin {
  id: string;
  username: string;
  game: string;
  amount: number;
  currency: string;
  multiplier: number;
  timestamp: string;
}

type Category = 'all' | 'slots' | 'table' | 'instant' | 'provably-fair' | string;

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_GAMES: CasinoGame[] = [
  { id: '1', name: 'Crash', slug: 'crash', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '2', name: 'Dice', slug: 'dice', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 99, houseEdge: 1 },
  { id: '3', name: 'Mines', slug: 'mines', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '4', name: 'Plinko', slug: 'plinko', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '5', name: 'Coinflip', slug: 'coinflip', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '6', name: 'Roulette', slug: 'roulette', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: true, rtp: 97.3, houseEdge: 2.7 },
  { id: '7', name: 'Blackjack', slug: 'blackjack', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: true, rtp: 99.5, houseEdge: 0.5 },
  { id: '8', name: 'HiLo', slug: 'hilo', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, rtp: 97, houseEdge: 3 },
  { id: '9', name: 'Wheel of Fortune', slug: 'wheel', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 96, houseEdge: 4 },
  { id: '10', name: 'Tower', slug: 'tower', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: false, rtp: 97, houseEdge: 3 },
  { id: '11', name: 'Limbo', slug: 'limbo', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, rtp: 97, houseEdge: 3 },
  { id: '12', name: 'Keno', slug: 'keno', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, rtp: 95, houseEdge: 5 },
  { id: '13', name: 'Video Poker', slug: 'video-poker', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, rtp: 99.5, houseEdge: 0.5 },
  { id: '14', name: 'Baccarat', slug: 'baccarat', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, rtp: 98.9, houseEdge: 1.1 },
  { id: '15', name: 'Slots', slug: 'slots', thumbnail: '', provider: 'CryptoBet', category: 'slots', isPopular: true, isNew: true, rtp: 96, houseEdge: 4 },
];

const MOCK_LIVE_BETS: LiveBet[] = [
  { id: 'lb1', username: 'CryptoKing', game: 'Crash', gameSlug: 'crash', amount: 0.05, currency: 'BTC', multiplier: 3.42, payout: 0.171, timestamp: new Date().toISOString() },
  { id: 'lb2', username: 'LuckyDice', game: 'Dice', gameSlug: 'dice', amount: 100, currency: 'USDT', multiplier: 1.98, payout: 198, timestamp: new Date().toISOString() },
  { id: 'lb3', username: 'MineHunter', game: 'Mines', gameSlug: 'mines', amount: 0.5, currency: 'ETH', multiplier: 8.1, payout: 4.05, timestamp: new Date().toISOString() },
  { id: 'lb4', username: 'SlotMaster', game: 'Slots', gameSlug: 'slots', amount: 250, currency: 'USDT', multiplier: 0, payout: 0, timestamp: new Date().toISOString() },
  { id: 'lb5', username: 'PlinkoFan', game: 'Plinko', gameSlug: 'plinko', amount: 0.02, currency: 'BTC', multiplier: 16.0, payout: 0.32, timestamp: new Date().toISOString() },
  { id: 'lb6', username: 'WhaleShark', game: 'Blackjack', gameSlug: 'blackjack', amount: 1.5, currency: 'ETH', multiplier: 2.0, payout: 3.0, timestamp: new Date().toISOString() },
  { id: 'lb7', username: 'HighRoller', game: 'Crash', gameSlug: 'crash', amount: 0.1, currency: 'BTC', multiplier: 12.5, payout: 1.25, timestamp: new Date().toISOString() },
  { id: 'lb8', username: 'LuckyStar', game: 'Roulette', gameSlug: 'roulette', amount: 500, currency: 'USDT', multiplier: 35, payout: 17500, timestamp: new Date().toISOString() },
];

const MOCK_BIG_WINS: BigWin[] = [
  { id: 'bw1', username: 'CryptoWhale', game: 'Crash', amount: 2.5, currency: 'BTC', multiplier: 142.5, timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: 'bw2', username: 'LuckyStar', game: 'Roulette', amount: 17500, currency: 'USDT', multiplier: 35, timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: 'bw3', username: 'DiamondH', game: 'Slots', amount: 0.8, currency: 'ETH', multiplier: 250, timestamp: new Date(Date.now() - 1200000).toISOString() },
  { id: 'bw4', username: 'PlinkoKing', game: 'Plinko', amount: 0.05, currency: 'BTC', multiplier: 1000, timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: 'bw5', username: 'MegaWin99', game: 'Mines', amount: 5000, currency: 'USDT', multiplier: 24.2, timestamp: new Date(Date.now() - 2400000).toISOString() },
];

const FEATURED_GAMES = ['crash', 'dice', 'mines', 'plinko', 'blackjack'];

// ---------------------------------------------------------------------------
// Promotional Banners
// ---------------------------------------------------------------------------

const PROMO_BANNERS = [
  {
    id: 1,
    title: 'CRASH MANIA',
    subtitle: "Ride the curve for up to 15,000x multiplier",
    cta: 'Play Now',
    link: '/casino/crash',
    gradient: 'from-[#4C1D95] via-[#6D28D9] to-[#7C3AED]',
    accentColor: '#F59E0B',
    icon: '\u{1F680}',
  },
  {
    id: 2,
    title: 'PROVABLY FAIR',
    subtitle: 'Every game verified with HMAC-SHA256 cryptography',
    cta: 'Learn More',
    link: '/help/provably-fair',
    gradient: 'from-[#064E3B] via-[#065F46] to-[#047857]',
    accentColor: '#10B981',
    icon: '\u{1F512}',
  },
  {
    id: 3,
    title: 'ARCADE FAVORITES',
    subtitle: '15 original games with the best odds in crypto',
    cta: 'Explore',
    link: '/casino',
    gradient: 'from-[#7F1D1D] via-[#991B1B] to-[#B91C1C]',
    accentColor: '#EF4444',
    icon: '\u{1F3AE}',
  },
];

// ---------------------------------------------------------------------------
// Category Icon Configuration (Cloudbet style)
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: {
  key: Category;
  label: string;
  icon: React.ReactNode;
  liveBadge?: boolean;
}[] = [
  { key: 'all', label: 'For you', icon: <Sparkles className="w-5 h-5" /> },
  { key: 'recent', label: 'Recent', icon: <Clock className="w-5 h-5" /> },
  { key: 'favorites', label: 'My favorites', icon: <Heart className="w-5 h-5" /> },
  { key: 'table', label: 'Table games', icon: <Grid3X3 className="w-5 h-5" />, liveBadge: true },
  { key: 'provably-fair', label: 'Provably Fair', icon: <Shield className="w-5 h-5" /> },
  { key: 'slots', label: 'Slots', icon: <Layers className="w-5 h-5" /> },
  { key: 'instant', label: 'Instant Win', icon: <Zap className="w-5 h-5" /> },
  { key: 'high-roller', label: 'High roller', icon: <Crown className="w-5 h-5" /> },
];

// ---------------------------------------------------------------------------
// Filter Pills Configuration
// ---------------------------------------------------------------------------

const FILTER_PILLS = [
  { key: 'high-roller', label: 'High roller', icon: <Crown className="w-3.5 h-3.5" /> },
  { key: 'feature-buy', label: 'Feature buy', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { key: 'trending', label: 'Trending', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: 'new', label: 'New', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: 'hot', label: 'Hot', icon: <Flame className="w-3.5 h-3.5" /> },
  { key: 'cold', label: 'Cold', icon: <Snowflake className="w-3.5 h-3.5" /> },
  { key: 'high-rtp', label: 'High RTP', icon: <Percent className="w-3.5 h-3.5" /> },
  { key: 'auto-play', label: 'Auto play', icon: <RotateCcw className="w-3.5 h-3.5" /> },
];

// ---------------------------------------------------------------------------
// Game Gradients & Icons (for card thumbnails)
// ---------------------------------------------------------------------------

const GAME_GRADIENTS: Record<string, string> = {
  crash: 'from-red-700 via-orange-600 to-amber-500',
  dice: 'from-blue-700 via-blue-500 to-cyan-400',
  mines: 'from-emerald-700 via-emerald-500 to-green-400',
  plinko: 'from-yellow-600 via-amber-500 to-orange-400',
  coinflip: 'from-purple-700 via-fuchsia-500 to-pink-400',
  roulette: 'from-red-800 via-red-600 to-rose-400',
  blackjack: 'from-teal-700 via-emerald-600 to-green-400',
  hilo: 'from-indigo-700 via-indigo-500 to-blue-400',
  wheel: 'from-amber-600 via-yellow-500 to-lime-400',
  tower: 'from-sky-700 via-sky-500 to-cyan-400',
  limbo: 'from-violet-700 via-purple-500 to-fuchsia-400',
  keno: 'from-orange-700 via-orange-500 to-yellow-400',
  'video-poker': 'from-green-700 via-teal-500 to-cyan-400',
  baccarat: 'from-rose-700 via-pink-500 to-fuchsia-400',
  slots: 'from-fuchsia-700 via-purple-500 to-violet-400',
};

const GAME_ICONS: Record<string, string> = {
  crash: '\u{1F680}',
  dice: '\u{1F3B2}',
  mines: '\u{1F4A3}',
  plinko: '\u{26AA}',
  coinflip: '\u{1FA99}',
  roulette: '\u{1F3B0}',
  blackjack: '\u{1F0CF}',
  hilo: '\u{2195}\u{FE0F}',
  wheel: '\u{1F3A1}',
  tower: '\u{1F3D7}\u{FE0F}',
  limbo: '\u{267E}\u{FE0F}',
  keno: '\u{1F522}',
  'video-poker': '\u{1F0A1}',
  baccarat: '\u{1F3B4}',
  slots: '\u{1F3B0}',
};

// ---------------------------------------------------------------------------
// Scrollable Row Component
// ---------------------------------------------------------------------------

function ScrollableGameRow({
  title,
  titleIcon,
  games,
  viewAllHref,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  games: CasinoGame[];
  viewAllHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateArrows, { passive: true });
      return () => el.removeEventListener('scroll', updateArrows);
    }
  }, [updateArrows, games]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    setTimeout(updateArrows, 400);
  };

  if (games.length === 0) return null;

  return (
    <section className="relative group/section">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-[#E6EDF3] flex items-center gap-2">
          {titleIcon}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-medium transition-colors"
            >
              View all
            </Link>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canLeft}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200',
                canLeft
                  ? 'border-[#30363D] text-[#E6EDF3] hover:bg-[#1C2128] hover:border-[#484F58]'
                  : 'border-[#1C2128] text-[#30363D] cursor-not-allowed'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canRight}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200',
                canRight
                  ? 'border-[#30363D] text-[#E6EDF3] hover:bg-[#1C2128] hover:border-[#484F58]'
                  : 'border-[#1C2128] text-[#30363D] cursor-not-allowed'
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Cards */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory"
      >
        {games.map((game, idx) => (
          <CloudbetGameCard key={game.id} game={game} index={idx} variant="scroll" />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cloudbet-style Game Card Component
// ---------------------------------------------------------------------------

function CloudbetGameCard({
  game,
  index = 0,
  variant = 'grid',
}: {
  game: CasinoGame;
  index?: number;
  variant?: 'grid' | 'scroll';
}) {
  const gradientClass = GAME_GRADIENTS[game.slug] || 'from-gray-700 via-slate-600 to-zinc-500';
  const gameIcon = GAME_ICONS[game.slug];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: 'easeOut' }}
      className={cn(
        'snap-start',
        variant === 'scroll'
          ? 'w-[140px] sm:w-[170px] shrink-0'
          : 'w-full'
      )}
    >
      <Link
        href={`/casino/${game.slug}`}
        className="block rounded-xl overflow-hidden group transition-all duration-200 hover:ring-2 hover:ring-[#8B5CF6]/50 hover:shadow-xl hover:shadow-[#8B5CF6]/20 hover:-translate-y-0.5"
      >
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#161B22]">
          {game.thumbnail ? (
            <img
              src={game.thumbnail}
              alt={game.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className={cn(
                'w-full h-full bg-gradient-to-br flex flex-col items-center justify-center relative',
                gradientClass
              )}
            >
              {/* Decorative pattern overlay */}
              <div className="absolute inset-0 opacity-[0.07]" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '16px 16px',
              }} />

              {/* Decorative glow circle behind the icon */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-white/10 blur-2xl" />

              {/* Corner accent shapes */}
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
              <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-black/15" />

              {/* Top shine effect */}
              <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/15 to-transparent" />

              {/* Emoji icon - large and prominent */}
              {gameIcon ? (
                <span className="text-6xl sm:text-7xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-transform duration-300 relative z-10 select-none">
                  {gameIcon}
                </span>
              ) : (
                <Gamepad2 className="w-14 h-14 text-white/50 relative z-10" />
              )}

              {/* Game name inside the thumbnail */}
              <span className="text-[11px] sm:text-xs font-extrabold text-white/80 tracking-widest uppercase mt-2 relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                {game.name}
              </span>

              {/* Bottom vignette */}
              <div className="absolute bottom-0 left-0 right-0 h-[35%] bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}

          {/* RTP badge - top right (purple circle style) */}
          {game.rtp && (
            <div className="absolute top-1.5 right-1.5 z-20">
              <span className="px-1.5 py-0.5 bg-[#8B5CF6]/90 backdrop-blur-sm rounded-full text-[9px] font-bold text-white shadow-sm">
                {game.rtp}% RTP
              </span>
            </div>
          )}

          {/* Badges - top left */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-20">
            {game.isNew && (
              <span className="px-1.5 py-0.5 bg-[#10B981] rounded text-[9px] font-bold text-white leading-tight shadow-sm">
                NEW
              </span>
            )}
            {game.isPopular && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#F59E0B] rounded text-[9px] font-bold text-black leading-tight shadow-sm">
                <Flame className="w-2.5 h-2.5" />
                HOT
              </span>
            )}
          </div>

          {/* Bet limit badges - bottom */}
          {game.category === 'table' && (
            <div className="absolute bottom-1.5 left-1.5 z-20">
              <span className="px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] font-mono text-[#F59E0B]">
                $5K
              </span>
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 z-10">
            <div className="w-11 h-11 rounded-full bg-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/50 group-hover:scale-110 transition-transform duration-200">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-[#161B22] px-2.5 py-2">
          <p className="font-semibold text-[13px] text-[#E6EDF3] truncate leading-tight group-hover:text-white transition-colors">
            {game.name}
          </p>
          <p className="text-[11px] text-[#6E7681] mt-0.5 truncate">
            {game.provider}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Game Card Skeleton (Cloudbet style)
// ---------------------------------------------------------------------------

function GameCardSkeleton() {
  return (
    <div className="w-full rounded-xl overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="bg-[#161B22] px-2.5 py-2 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Casino Lobby Page
// ---------------------------------------------------------------------------

export default function CasinoLobbyPage() {
  const [games, setGames] = useState<CasinoGame[]>([]);
  const [liveBets, setLiveBets] = useState<LiveBet[]>(MOCK_LIVE_BETS);
  const [bigWins] = useState<BigWin[]>(MOCK_BIG_WINS);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { user, isAuthenticated } = useAuthStore();

  // Banner carousel state
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch games
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await get<CasinoGame[]>('/casino/games');
        const TYPE_TO_CATEGORY: Record<string, string> = {
          SLOT: 'slots',
          TABLE: 'table',
          INSTANT: 'instant',
          CRASH: 'provably-fair',
          DICE: 'provably-fair',
          MINES: 'provably-fair',
          PLINKO: 'provably-fair',
          CUSTOM: 'provably-fair',
        };
        const transformed = (Array.isArray(data) ? data : []).map((g: any) => ({
          ...g,
          provider: g.provider ?? 'CryptoBet',
          category: g.category ?? TYPE_TO_CATEGORY[g.type] ?? 'instant',
          isPopular: g.isPopular ?? (g.playCount > 100),
          rtp: typeof g.rtp === 'number' ? g.rtp : 97,
        }));
        setGames(transformed);
      } catch {
        setGames(MOCK_GAMES);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Live bets feed via socket
  useSocketEvent('chat:message', () => {
    // In production this would add real live bets
  });

  // Banner auto-slide
  useEffect(() => {
    bannerIntervalRef.current = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % PROMO_BANNERS.length);
    }, 5000);
    return () => {
      if (bannerIntervalRef.current) clearInterval(bannerIntervalRef.current);
    };
  }, []);

  const goToBanner = (index: number) => {
    setActiveBanner(index);
    if (bannerIntervalRef.current) clearInterval(bannerIntervalRef.current);
    bannerIntervalRef.current = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % PROMO_BANNERS.length);
    }, 5000);
  };

  // Toggle filter pill
  const toggleFilter = (key: string) => {
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  // Filtered games
  const filteredGames = useMemo(() => {
    let filtered = games;
    if (activeCategory !== 'all' && activeCategory !== 'recent' && activeCategory !== 'favorites' && activeCategory !== 'high-roller') {
      filtered = filtered.filter((g) => g.category === activeCategory);
    }
    if (activeCategory === 'high-roller') {
      filtered = filtered.filter((g) => g.category === 'table' || g.rtp >= 98);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.provider.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)
      );
    }
    // Apply filter pills
    if (activeFilters.includes('new')) {
      filtered = filtered.filter((g) => g.isNew);
    }
    if (activeFilters.includes('hot') || activeFilters.includes('trending')) {
      filtered = filtered.filter((g) => g.isPopular);
    }
    if (activeFilters.includes('high-rtp')) {
      filtered = filtered.filter((g) => g.rtp >= 98);
    }
    return filtered;
  }, [games, activeCategory, searchQuery, activeFilters]);

  // Featured games for carousel
  const featuredGames = useMemo(
    () => games.filter((g) => FEATURED_GAMES.includes(g.slug)),
    [games]
  );

  // Recently played
  const recentlyPlayed = useMemo(
    () =>
      isAuthenticated
        ? games.filter((g) => ['crash', 'dice', 'mines'].includes(g.slug))
        : [],
    [games, isAuthenticated]
  );

  // Highest rakeback (popular games)
  const highestRakeback = useMemo(
    () => games.filter((g) => g.isPopular),
    [games]
  );

  // Table games
  const tableGames = useMemo(
    () => games.filter((g) => g.category === 'table'),
    [games]
  );

  // CryptoBet Originals
  const originals = useMemo(
    () => games.filter((g) => g.provider === 'CryptoBet'),
    [games]
  );

  return (
    <div className="min-h-screen pb-8">
      {/* ================================================================= */}
      {/* TOP BANNER CAROUSEL                                               */}
      {/* ================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mb-6 rounded-xl overflow-hidden"
      >
        <div className="relative h-[180px] sm:h-[200px] md:h-[220px]">
          <AnimatePresence mode="wait">
            {PROMO_BANNERS.map(
              (banner, idx) =>
                idx === activeBanner && (
                  <motion.div
                    key={banner.id}
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -60 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    className="absolute inset-0"
                  >
                    <Link href={banner.link}>
                      <div
                        className={cn(
                          'w-full h-full bg-gradient-to-r rounded-xl flex items-center px-6 sm:px-10 md:px-14 cursor-pointer relative overflow-hidden',
                          banner.gradient
                        )}
                      >
                        {/* Decorative circles */}
                        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
                        <div className="absolute -right-4 -bottom-12 w-56 h-56 rounded-full bg-white/5" />
                        <div className="absolute right-16 top-1/2 -translate-y-1/2 text-8xl sm:text-9xl opacity-30 select-none hidden sm:block">
                          {banner.icon}
                        </div>

                        <div className="relative z-10 max-w-md">
                          <p
                            className="text-xs font-bold tracking-[0.2em] uppercase mb-2"
                            style={{ color: banner.accentColor }}
                          >
                            CryptoBet Casino
                          </p>
                          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2 leading-tight">
                            {banner.title}
                          </h2>
                          <p className="text-sm sm:text-base text-white/70 mb-4 leading-snug">
                            {banner.subtitle}
                          </p>
                          <span
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white transition-all duration-200 hover:brightness-110"
                            style={{ backgroundColor: banner.accentColor }}
                          >
                            {banner.cta}
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
            )}
          </AnimatePresence>

          {/* Prev/Next arrows */}
          <button
            onClick={() =>
              goToBanner(
                (activeBanner - 1 + PROMO_BANNERS.length) % PROMO_BANNERS.length
              )
            }
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() =>
              goToBanner((activeBanner + 1) % PROMO_BANNERS.length)
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {PROMO_BANNERS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToBanner(idx)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  idx === activeBanner
                    ? 'w-6 bg-white'
                    : 'w-1.5 bg-white/40 hover:bg-white/60'
                )}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* CATEGORY ICONS ROW                                                */}
      {/* ================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-5"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORY_ICONS.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={cn(
                'flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl min-w-[80px] transition-all duration-200 shrink-0 relative',
                activeCategory === cat.key
                  ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                  : 'bg-[#161B22] text-[#8B949E] hover:bg-[#1C2128] hover:text-[#E6EDF3] border border-[#1C2128]'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200',
                  activeCategory === cat.key
                    ? 'bg-white/20'
                    : 'bg-[#1C2128]'
                )}
              >
                {cat.icon}
              </div>
              <span className="text-[11px] font-medium whitespace-nowrap">
                {cat.label}
              </span>
              {cat.liveBadge && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-[#EF4444] rounded text-[8px] font-bold text-white leading-none">
                  Live
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* SEARCH + FILTERS ROW                                              */}
      {/* ================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mb-6 space-y-3"
      >
        {/* Search + Studios + View toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7681]" />
            <input
              type="text"
              placeholder="Search for a casino game"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all duration-200"
            />
          </div>

          {/* Studios dropdown */}
          <button className="h-10 px-4 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all flex items-center gap-2 whitespace-nowrap">
            <Filter className="w-4 h-4" />
            Studios
            <ChevronRight className="w-3 h-3 rotate-90" />
          </button>

          {/* Grid/List toggle */}
          <div className="flex bg-[#0D1117] border border-[#30363D] rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'w-10 h-10 flex items-center justify-center transition-all',
                viewMode === 'grid'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#6E7681] hover:text-[#E6EDF3]'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'w-10 h-10 flex items-center justify-center transition-all',
                viewMode === 'list'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#6E7681] hover:text-[#E6EDF3]'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => toggleFilter(pill.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 border shrink-0',
                activeFilters.includes(pill.key)
                  ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/30'
                  : 'bg-[#0D1117] text-[#8B949E] border-[#30363D] hover:border-[#484F58] hover:text-[#E6EDF3]'
              )}
            >
              {pill.icon}
              {pill.label}
            </button>
          ))}
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* GAME SECTIONS - Horizontal Scrolling Rows (Cloudbet style)        */}
      {/* ================================================================= */}
      <div className="space-y-7">
        {/* Jump back in (recently played) */}
        {isAuthenticated && recentlyPlayed.length > 0 && !searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <ScrollableGameRow
              title="Jump back in"
              titleIcon={<Clock className="w-4 h-4 text-[#8B949E]" />}
              games={recentlyPlayed}
              viewAllHref="/casino?filter=recent"
            />
          </motion.div>
        )}

        {/* Highest rakeback earnings */}
        {!searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <ScrollableGameRow
              title="Highest rakeback earnings"
              titleIcon={<TrendingUp className="w-4 h-4 text-[#10B981]" />}
              games={highestRakeback}
              viewAllHref="/casino?filter=rakeback"
            />
          </motion.div>
        )}

        {/* Blackjack section */}
        {!searchQuery && tableGames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <ScrollableGameRow
              title="Blackjack"
              titleIcon={
                <span className="text-base">{GAME_ICONS['blackjack']}</span>
              }
              games={tableGames}
              viewAllHref="/casino?category=table"
            />
          </motion.div>
        )}

        {/* CryptoBet Originals */}
        {!searchQuery && originals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
          >
            <ScrollableGameRow
              title="CryptoBet Originals"
              titleIcon={<Sparkles className="w-4 h-4 text-[#8B5CF6]" />}
              games={originals}
              viewAllHref="/casino?provider=cryptobet"
            />
          </motion.div>
        )}

        {/* ================================================================= */}
        {/* FULL GAME GRID (when searching or filtered)                       */}
        {/* ================================================================= */}
        {(searchQuery || activeCategory !== 'all' || activeFilters.length > 0) && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-[#E6EDF3] flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#8B949E]" />
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : CATEGORY_ICONS.find((c) => c.key === activeCategory)?.label || 'All Games'}
                <span className="text-xs font-normal text-[#6E7681] ml-1">
                  ({filteredGames.length})
                </span>
              </h2>
              {(searchQuery || activeFilters.length > 0) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                    setActiveFilters([]);
                  }}
                  className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-medium transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3"
                >
                  {Array.from({ length: 14 }).map((_, i) => (
                    <GameCardSkeleton key={i} />
                  ))}
                </motion.div>
              ) : filteredGames.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-[#161B22] border border-[#1C2128] rounded-xl p-16 text-center"
                >
                  <Search className="w-10 h-10 text-[#30363D] mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-[#E6EDF3] mb-1.5">
                    No games found
                  </h3>
                  <p className="text-sm text-[#6E7681] mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory('all');
                      setActiveFilters([]);
                    }}
                  >
                    Clear Filters
                  </Button>
                </motion.div>
              ) : viewMode === 'grid' ? (
                <motion.div
                  key={`grid-${activeCategory}-${searchQuery}-${activeFilters.join(',')}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3"
                >
                  {filteredGames.map((game, idx) => (
                    <CloudbetGameCard key={game.id} game={game} index={idx} />
                  ))}
                </motion.div>
              ) : (
                /* List view */
                <motion.div
                  key={`list-${activeCategory}-${searchQuery}-${activeFilters.join(',')}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1"
                >
                  {filteredGames.map((game, idx) => (
                    <Link
                      key={game.id}
                      href={`/casino/${game.slug}`}
                      className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#161B22] hover:bg-[#1C2128] border border-transparent hover:border-[#30363D] transition-all duration-200 group"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#0D1117] flex items-center justify-center shrink-0">
                        {game.thumbnail ? (
                          <img
                            src={game.thumbnail}
                            alt={game.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">
                            {GAME_ICONS[game.slug] || '\u{1F3AE}'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#E6EDF3] truncate group-hover:text-white">
                          {game.name}
                        </p>
                        <p className="text-xs text-[#6E7681] truncate">
                          {game.provider}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {game.isNew && (
                          <span className="px-1.5 py-0.5 bg-[#10B981] rounded text-[9px] font-bold text-white">
                            NEW
                          </span>
                        )}
                        {game.isPopular && (
                          <span className="px-1.5 py-0.5 bg-[#F59E0B] rounded text-[9px] font-bold text-black">
                            HOT
                          </span>
                        )}
                        <span className="px-2 py-1 bg-[#8B5CF6]/15 rounded-full text-[11px] font-mono font-semibold text-[#A78BFA]">
                          {game.rtp}% RTP
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#30363D] group-hover:text-[#8B5CF6] transition-colors" />
                      </div>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {/* ================================================================= */}
        {/* ALL GAMES GRID (default view, no search, "For you" category)      */}
        {/* ================================================================= */}
        {!searchQuery && activeCategory === 'all' && activeFilters.length === 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-[#E6EDF3] flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#8B949E]" />
                All Games
                <span className="text-xs font-normal text-[#6E7681] ml-1">
                  ({games.length})
                </span>
              </h2>
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading-all"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3"
                >
                  {Array.from({ length: 14 }).map((_, i) => (
                    <GameCardSkeleton key={i} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="grid-all"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3"
                >
                  {games.map((game, idx) => (
                    <CloudbetGameCard key={game.id} game={game} index={idx} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </div>

      {/* ================================================================= */}
      {/* LIVE BETS TICKER TABLE                                            */}
      {/* ================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-8"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#E6EDF3] flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#8B5CF6]" />
            Live Bets
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
            </span>
          </h2>
        </div>

        <div className="bg-[#161B22] border border-[#1C2128] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-[#1C2128] text-[11px] font-medium text-[#6E7681] uppercase tracking-wider">
            <span>Game</span>
            <span>User</span>
            <span className="text-right">Bet</span>
            <span className="text-right">Multiplier</span>
            <span className="text-right">Profit</span>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-[#1C2128]">
            {liveBets.map((bet) => (
              <div
                key={bet.id}
                className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-sm hover:bg-[#1C2128]/50 transition-colors"
              >
                <Link
                  href={`/casino/${bet.gameSlug}`}
                  className="text-[#E6EDF3] hover:text-[#8B5CF6] transition-colors font-medium truncate"
                >
                  {bet.game}
                </Link>
                <span className="text-[#8B949E] truncate">{bet.username}</span>
                <span className="text-[#E6EDF3] font-mono text-xs text-right whitespace-nowrap">
                  {formatCurrency(bet.amount, bet.currency)}
                </span>
                <span className="text-right whitespace-nowrap">
                  {bet.multiplier > 0 ? (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-bold',
                        bet.multiplier >= 10
                          ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                          : bet.multiplier >= 2
                          ? 'bg-[#10B981]/15 text-[#10B981]'
                          : 'bg-[#6E7681]/15 text-[#8B949E]'
                      )}
                    >
                      {bet.multiplier}x
                    </span>
                  ) : (
                    <span className="text-[#6E7681] text-xs">-</span>
                  )}
                </span>
                <span
                  className={cn(
                    'font-mono text-xs text-right font-semibold whitespace-nowrap',
                    bet.payout > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                  )}
                >
                  {bet.payout > 0
                    ? `+${formatCurrency(bet.payout, bet.currency)}`
                    : `-${formatCurrency(bet.amount, bet.currency)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* PROVABLY FAIR BANNER                                              */}
      {/* ================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.55 }}
        className="mt-6"
      >
        <div className="bg-gradient-to-r from-[#8B5CF6]/8 via-[#161B22] to-[#10B981]/8 border border-[#1C2128] rounded-xl px-6 py-5">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-11 h-11 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#10B981]" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-[#E6EDF3]">
                All Games are Provably Fair
              </h3>
              <p className="text-sm text-[#6E7681] mt-0.5">
                Every game uses HMAC-SHA256 cryptographic verification. You can
                independently verify every single game result.
              </p>
            </div>
            <Link href="/help/provably-fair">
              <Button variant="outline" size="sm">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
