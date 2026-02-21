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
  Play,
  Heart,
  Percent,
  Layers,
  Star,
  Tv,
  Dice1,
  ChevronDown,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Instagram,
  Youtube,
  Github,
  MessageCircle,
  HelpCircle,
  Globe,
  Award,
  Gem,
  Package,
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
  { id: 'lb9', username: 'NeonBet', game: 'Crash', gameSlug: 'crash', amount: 0.08, currency: 'BTC', multiplier: 5.25, payout: 0.42, timestamp: new Date().toISOString() },
  { id: 'lb10', username: 'AcePlay', game: 'Blackjack', gameSlug: 'blackjack', amount: 200, currency: 'USDT', multiplier: 2.5, payout: 500, timestamp: new Date().toISOString() },
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
// Promotional Banners (Cloudbet style)
// ---------------------------------------------------------------------------

const PROMO_BANNERS = [
  {
    id: 1,
    title: 'ARCADE FAVORITES',
    subtitle: 'Now available - Play our 15 original casino games',
    cta: 'Play Now',
    link: '/casino/crash',
    gradient: 'from-[#4C1D95] via-[#6D28D9] to-[#7C3AED]',
    accentColor: '#F59E0B',
    icon: '\u{1F3B2}',
    secondIcon: '\u{1F3B0}',
  },
  {
    id: 2,
    title: 'CRASH MANIA',
    subtitle: 'Play for 15,000x - Ride the multiplier curve',
    cta: 'Play Now',
    link: '/casino/crash',
    gradient: 'from-[#991B1B] via-[#B91C1C] to-[#DC2626]',
    accentColor: '#FCD34D',
    icon: '\u{1F680}',
    secondIcon: '\u{1F4B0}',
  },
  {
    id: 3,
    title: 'PROVABLY FAIR',
    subtitle: 'Every game verified on-chain with HMAC-SHA256',
    cta: 'Learn More',
    link: '/help/provably-fair',
    gradient: 'from-[#064E3B] via-[#065F46] to-[#047857]',
    accentColor: '#34D399',
    icon: '\u{1F512}',
    secondIcon: '\u{2705}',
  },
  {
    id: 4,
    title: 'VIP REWARDS',
    subtitle: 'Up to 5% rakeback - 8 exclusive tiers',
    cta: 'Join VIP',
    link: '/vip',
    gradient: 'from-[#78350F] via-[#92400E] to-[#B45309]',
    accentColor: '#FCD34D',
    icon: '\u{1F451}',
    secondIcon: '\u{1F48E}',
  },
];

// ---------------------------------------------------------------------------
// Category Icon Configuration (Cloudbet style pill tabs)
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: {
  key: Category;
  label: string;
  icon: React.ReactNode;
  liveBadge?: boolean;
}[] = [
  { key: 'all', label: 'For you', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'recent', label: 'Recent', icon: <Clock className="w-4 h-4" /> },
  { key: 'favorites', label: 'My favorites', icon: <Heart className="w-4 h-4" /> },
  { key: 'table', label: 'Table games', icon: <Dice1 className="w-4 h-4" />, liveBadge: true },
  { key: 'high-roller', label: 'High roller', icon: <Crown className="w-4 h-4" /> },
  { key: 'provably-fair', label: 'Provably Fair', icon: <Shield className="w-4 h-4" /> },
  { key: 'slots', label: 'Slots', icon: <Layers className="w-4 h-4" /> },
  { key: 'instant', label: 'Instant Win', icon: <Zap className="w-4 h-4" /> },
  { key: 'game-shows', label: 'Game shows', icon: <Tv className="w-4 h-4" />, liveBadge: true },
  { key: 'new-games', label: 'New games', icon: <Star className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Filter Tags (Cloudbet style)
// ---------------------------------------------------------------------------

const FILTER_TAGS = [
  { key: 'high-roller', label: 'High roller', icon: <Crown className="w-3 h-3" /> },
  { key: 'feature-buy', label: 'Feature buy', icon: <Package className="w-3 h-3" /> },
  { key: 'trending', label: 'Trending', icon: <Flame className="w-3 h-3" /> },
  { key: 'new', label: 'New', icon: <Sparkles className="w-3 h-3" /> },
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
// VIP Level Colors for live feed
// ---------------------------------------------------------------------------

const VIP_COLORS = [
  'bg-[#CD7F32]', // Bronze
  'bg-[#C0C0C0]', // Silver
  'bg-[#FFD700]', // Gold
  'bg-[#E5E4E2]', // Platinum
  'bg-[#B9F2FF]', // Diamond
  'bg-[#8B5CF6]', // Elite
  'bg-[#1a1a2e]', // Black Diamond
  'bg-[#3B82F6]', // Blue Diamond
];

// ---------------------------------------------------------------------------
// Top 5 Hot Slots data
// ---------------------------------------------------------------------------

const TOP_HOT_SLOTS = [
  { rank: 1, name: 'Crash', slug: 'crash', percentage: 94.2, icon: '\u{1F680}' },
  { rank: 2, name: 'Mines', slug: 'mines', percentage: 88.7, icon: '\u{1F4A3}' },
  { rank: 3, name: 'Plinko', slug: 'plinko', percentage: 82.1, icon: '\u{26AA}' },
  { rank: 4, name: 'Dice', slug: 'dice', percentage: 76.5, icon: '\u{1F3B2}' },
  { rank: 5, name: 'Slots', slug: 'slots', percentage: 71.3, icon: '\u{1F3B0}' },
];

// ---------------------------------------------------------------------------
// Scrollable Row Component (Cloudbet style)
// ---------------------------------------------------------------------------

function ScrollableGameRow({
  title,
  titleIcon,
  games,
  viewAllHref,
  badge,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  games: CasinoGame[];
  viewAllHref?: string;
  badge?: React.ReactNode;
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
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
            {titleIcon}
            {title}
          </h2>
          {badge}
        </div>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-semibold transition-colors"
            >
              View all
            </Link>
          )}
          <div className="hidden sm:flex gap-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canLeft}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-200',
                canLeft
                  ? 'border-[#30363D] text-[#E6EDF3] hover:bg-[#21262D] hover:border-[#484F58]'
                  : 'border-[#21262D] text-[#30363D] cursor-not-allowed'
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
                  ? 'border-[#30363D] text-[#E6EDF3] hover:bg-[#21262D] hover:border-[#484F58]'
                  : 'border-[#21262D] text-[#30363D] cursor-not-allowed'
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
        className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory"
      >
        {games.map((game, idx) => (
          <GameCard key={game.id} game={game} index={idx} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Game Card Component (Cloudbet mobile style - compact square)
// ---------------------------------------------------------------------------

function GameCard({
  game,
  index = 0,
}: {
  game: CasinoGame;
  index?: number;
}) {
  const gradientClass = GAME_GRADIENTS[game.slug] || 'from-gray-700 via-slate-600 to-zinc-500';
  const gameIcon = GAME_ICONS[game.slug];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02, ease: 'easeOut' }}
      className="w-[140px] sm:w-[160px] shrink-0 snap-start"
    >
      <Link
        href={`/casino/${game.slug}`}
        className="block rounded-xl overflow-hidden group transition-all duration-200 hover:ring-2 hover:ring-[#8B5CF6]/60 hover:shadow-lg hover:shadow-[#8B5CF6]/10 hover:-translate-y-0.5"
      >
        {/* Square Thumbnail */}
        <div className="relative aspect-square overflow-hidden bg-[#161B22]">
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
              {/* Subtle pattern */}
              <div className="absolute inset-0 opacity-[0.06]" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '14px 14px',
              }} />

              {/* Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] h-[55%] rounded-full bg-white/10 blur-2xl" />

              {/* Decorative shapes */}
              <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full bg-white/8" />
              <div className="absolute -bottom-5 -left-5 w-16 h-16 rounded-full bg-black/15" />

              {/* Top shine */}
              <div className="absolute top-0 left-0 right-0 h-[35%] bg-gradient-to-b from-white/12 to-transparent" />

              {/* Icon */}
              {gameIcon ? (
                <span className="text-5xl sm:text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-transform duration-300 relative z-10 select-none">
                  {gameIcon}
                </span>
              ) : (
                <Gamepad2 className="w-12 h-12 text-white/50 relative z-10" />
              )}

              {/* Bottom vignette */}
              <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}

          {/* Badges - top left */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-20">
            {game.isNew && (
              <span className="px-1.5 py-0.5 bg-[#10B981] rounded text-[8px] font-bold text-white leading-tight shadow-sm uppercase tracking-wide">
                NEW
              </span>
            )}
            {game.isPopular && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#F59E0B] rounded text-[8px] font-bold text-black leading-tight shadow-sm">
                <Flame className="w-2.5 h-2.5" />
                HOT
              </span>
            )}
            {game.category === 'table' && (
              <span className="px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[8px] font-mono text-[#FBBF24]">
                Max $100K
              </span>
            )}
          </div>

          {/* RTP badge - top right */}
          {game.rtp >= 98 && (
            <div className="absolute top-1.5 right-1.5 z-20">
              <span className={cn(
                "px-1.5 py-0.5 backdrop-blur-sm rounded-full text-[8px] font-bold text-white shadow-sm",
                game.rtp >= 99 ? 'bg-[#10B981]/90' : 'bg-[#8B5CF6]/90'
              )}>
                {game.rtp}% RTP
              </span>
            </div>
          )}

          {/* Play overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 z-10">
            <div className="w-10 h-10 rounded-full bg-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/50 group-hover:scale-110 transition-transform duration-200">
              <Play className="w-4 h-4 text-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Info below thumbnail */}
        <div className="bg-[#161B22] px-2 py-1.5">
          <p className="font-semibold text-[12px] text-[#E6EDF3] truncate leading-tight group-hover:text-white transition-colors">
            {game.name}
          </p>
          <p className="text-[10px] text-[#6E7681] mt-0.5 truncate">
            {game.provider}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Game Card Skeleton
// ---------------------------------------------------------------------------

function GameCardSkeleton() {
  return (
    <div className="w-[140px] sm:w-[160px] shrink-0 rounded-xl overflow-hidden">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="bg-[#161B22] px-2 py-1.5 space-y-1">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live Feed Tab Types
// ---------------------------------------------------------------------------

type LiveFeedTab = 'all' | 'my' | 'huge' | 'biggest';

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
  const { user, isAuthenticated } = useAuthStore();

  // Banner carousel state
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live feed state
  const [liveFeedTab, setLiveFeedTab] = useState<LiveFeedTab>('all');
  const [showMoreBets, setShowMoreBets] = useState(false);
  const [hiddenUsernames, setHiddenUsernames] = useState(true);

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
    }, 4500);
    return () => {
      if (bannerIntervalRef.current) clearInterval(bannerIntervalRef.current);
    };
  }, []);

  const goToBanner = (index: number) => {
    setActiveBanner(index);
    if (bannerIntervalRef.current) clearInterval(bannerIntervalRef.current);
    bannerIntervalRef.current = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % PROMO_BANNERS.length);
    }, 4500);
  };

  // Toggle filter
  const toggleFilter = (key: string) => {
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  // Filtered games
  const filteredGames = useMemo(() => {
    let filtered = games;
    if (activeCategory !== 'all' && activeCategory !== 'recent' && activeCategory !== 'favorites' && activeCategory !== 'high-roller' && activeCategory !== 'game-shows' && activeCategory !== 'new-games') {
      filtered = filtered.filter((g) => g.category === activeCategory);
    }
    if (activeCategory === 'high-roller') {
      filtered = filtered.filter((g) => g.category === 'table' || g.rtp >= 98);
    }
    if (activeCategory === 'new-games') {
      filtered = filtered.filter((g) => g.isNew);
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
    if (activeFilters.includes('new')) {
      filtered = filtered.filter((g) => g.isNew);
    }
    if (activeFilters.includes('trending')) {
      filtered = filtered.filter((g) => g.isPopular);
    }
    if (activeFilters.includes('high-roller')) {
      filtered = filtered.filter((g) => g.rtp >= 98);
    }
    return filtered;
  }, [games, activeCategory, searchQuery, activeFilters]);

  // Game subsets for sections
  const recentlyPlayed = useMemo(
    () =>
      isAuthenticated
        ? games.filter((g) => ['crash', 'dice', 'mines', 'blackjack', 'plinko'].includes(g.slug))
        : [],
    [games, isAuthenticated]
  );

  const originals = useMemo(
    () => games.filter((g) => g.provider === 'CryptoBet'),
    [games]
  );

  const newGames = useMemo(
    () => games.filter((g) => g.isNew || ['wheel', 'slots', 'tower'].includes(g.slug)),
    [games]
  );

  const tableGames = useMemo(
    () => games.filter((g) => g.category === 'table'),
    [games]
  );

  const slotsGames = useMemo(
    () => games.filter((g) => g.category === 'slots' || g.slug === 'slots'),
    [games]
  );

  const trendingGames = useMemo(
    () => games.filter((g) => g.isPopular),
    [games]
  );

  const highRtpGames = useMemo(
    () => [...games].sort((a, b) => b.rtp - a.rtp).slice(0, 8),
    [games]
  );

  // Live feed data based on tab
  const displayedBets = useMemo(() => {
    let bets = liveBets;
    if (liveFeedTab === 'huge') {
      bets = bets.filter((b) => b.multiplier >= 5);
    } else if (liveFeedTab === 'biggest') {
      bets = [...bets].sort((a, b) => b.payout - a.payout);
    } else if (liveFeedTab === 'my') {
      bets = isAuthenticated ? bets.filter((b) => b.username === user?.username) : [];
    }
    return showMoreBets ? bets : bets.slice(0, 6);
  }, [liveBets, liveFeedTab, showMoreBets, isAuthenticated, user]);

  // Whether search/filter is active
  const isSearchActive = searchQuery.trim().length > 0 || activeFilters.length > 0 || (activeCategory !== 'all');

  return (
    <div className="min-h-screen pb-8 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6">
      {/* ================================================================= */}
      {/* SECTION 1: HERO BANNER CAROUSEL                                   */}
      {/* ================================================================= */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative mb-4"
      >
        <div className="relative h-[180px] sm:h-[200px] md:h-[220px] overflow-hidden">
          <AnimatePresence mode="wait">
            {PROMO_BANNERS.map(
              (banner, idx) =>
                idx === activeBanner && (
                  <motion.div
                    key={banner.id}
                    initial={{ opacity: 0, x: 80 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -80 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="absolute inset-0"
                  >
                    <Link href={banner.link}>
                      <div
                        className={cn(
                          'w-full h-full bg-gradient-to-r flex items-center px-5 sm:px-8 md:px-12 cursor-pointer relative overflow-hidden',
                          banner.gradient
                        )}
                      >
                        {/* Background decorations */}
                        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
                        <div className="absolute -right-6 -bottom-16 w-64 h-64 rounded-full bg-white/5" />
                        <div className="absolute right-4 sm:right-12 top-1/2 -translate-y-1/2 flex items-center gap-3">
                          <span className="text-7xl sm:text-8xl md:text-9xl opacity-25 select-none hidden sm:block">
                            {banner.icon}
                          </span>
                          <span className="text-5xl sm:text-6xl md:text-7xl opacity-15 select-none hidden md:block">
                            {banner.secondIcon}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="relative z-10 max-w-md">
                          <p
                            className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase mb-1.5"
                            style={{ color: banner.accentColor }}
                          >
                            CryptoBet Casino
                          </p>
                          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-1.5 leading-tight tracking-tight">
                            {banner.title}
                          </h2>
                          <p className="text-xs sm:text-sm text-white/70 mb-3 leading-snug max-w-[280px]">
                            {banner.subtitle}
                          </p>
                          <span
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-black transition-all duration-200 hover:brightness-110"
                            style={{ backgroundColor: banner.accentColor }}
                          >
                            {banner.cta}
                            <ChevronRight className="w-3.5 h-3.5" />
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
              goToBanner((activeBanner - 1 + PROMO_BANNERS.length) % PROMO_BANNERS.length)
            }
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => goToBanner((activeBanner + 1) % PROMO_BANNERS.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {PROMO_BANNERS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToBanner(idx)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  idx === activeBanner
                    ? 'w-5 bg-white'
                    : 'w-1.5 bg-white/40 hover:bg-white/60'
                )}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* Inner content padding */}
      <div className="px-4 lg:px-6">
        {/* ================================================================= */}
        {/* SECTION 2: CATEGORY TABS (horizontal scrollable pill buttons)     */}
        {/* ================================================================= */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="mb-4"
        >
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {CATEGORY_ICONS.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-full min-w-fit transition-all duration-200 shrink-0 relative text-[12px] font-medium border',
                  activeCategory === cat.key
                    ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/50 shadow-sm shadow-[#8B5CF6]/10'
                    : 'bg-[#161B22] text-[#8B949E] border-[#21262D] hover:bg-[#1C2128] hover:text-[#E6EDF3] hover:border-[#30363D]'
                )}
              >
                <span className={cn(
                  'transition-colors duration-200',
                  activeCategory === cat.key ? 'text-[#A78BFA]' : 'text-[#6E7681]'
                )}>
                  {cat.icon}
                </span>
                {cat.label}
                {cat.liveBadge && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ================================================================= */}
        {/* SECTION 3: SEARCH + FILTERS                                      */}
        {/* ================================================================= */}
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
          className="mb-5 space-y-2.5"
        >
          {/* Search bar row */}
          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#484F58]" />
              <input
                type="text"
                placeholder="Search for a casino game"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-[#0D1117] border border-[#21262D] rounded-lg text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all duration-200"
              />
            </div>

            {/* Studios dropdown */}
            <button className="h-9 px-3 bg-[#0D1117] border border-[#21262D] rounded-lg text-xs text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#30363D] transition-all flex items-center gap-1.5 whitespace-nowrap">
              Studios
              <ChevronDown className="w-3 h-3" />
            </button>

            {/* Filter icon button */}
            <button className="h-9 w-9 bg-[#0D1117] border border-[#21262D] rounded-lg text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#30363D] transition-all flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Filter tags row */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {FILTER_TAGS.map((tag) => (
              <button
                key={tag.key}
                onClick={() => toggleFilter(tag.key)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 border shrink-0',
                  activeFilters.includes(tag.key)
                    ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/40'
                    : 'bg-[#161B22] text-[#6E7681] border-[#21262D] hover:border-[#30363D] hover:text-[#8B949E]'
                )}
              >
                {tag.icon}
                {tag.label}
              </button>
            ))}
          </div>
        </motion.section>

        {/* ================================================================= */}
        {/* GAME SECTIONS (when no search/filter active)                      */}
        {/* ================================================================= */}
        {!isSearchActive && (
          <div className="space-y-6">
            {/* SECTION 4: Jump back in */}
            {isAuthenticated && recentlyPlayed.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.16 }}
              >
                <ScrollableGameRow
                  title="Jump back in"
                  titleIcon={<Clock className="w-4 h-4 text-[#8B949E]" />}
                  games={recentlyPlayed}
                  viewAllHref="/casino?filter=recent"
                />
              </motion.div>
            )}

            {/* SECTION 5: CryptoBet Originals */}
            {originals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <ScrollableGameRow
                  title="CryptoBet Originals"
                  titleIcon={<Sparkles className="w-4 h-4 text-[#8B5CF6]" />}
                  games={originals}
                  viewAllHref="/casino?provider=cryptobet"
                  badge={
                    <span className="px-1.5 py-0.5 bg-[#8B5CF6]/15 rounded text-[9px] font-bold text-[#A78BFA] tracking-wide">
                      {originals.length} GAMES
                    </span>
                  }
                />
              </motion.div>
            )}

            {/* SECTION 6: New on CryptoBet */}
            {newGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.24 }}
              >
                <ScrollableGameRow
                  title="New on CryptoBet"
                  titleIcon={<Star className="w-4 h-4 text-[#FBBF24]" />}
                  games={newGames}
                  viewAllHref="/casino?filter=new"
                />
              </motion.div>
            )}

            {/* SECTION 7: Best table games (live dealer equivalent) */}
            {tableGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.28 }}
              >
                <ScrollableGameRow
                  title="Best table games"
                  titleIcon={
                    <span className="relative">
                      <Dice1 className="w-4 h-4 text-[#10B981]" />
                      <span className="absolute -top-0.5 -right-1 flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]" />
                      </span>
                    </span>
                  }
                  games={tableGames}
                  viewAllHref="/casino?category=table"
                />
              </motion.div>
            )}

            {/* SECTION 8: Slots */}
            {slotsGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.32 }}
              >
                <ScrollableGameRow
                  title="Slots"
                  titleIcon={<Layers className="w-4 h-4 text-[#EC4899]" />}
                  games={slotsGames}
                  viewAllHref="/casino?category=slots"
                />
              </motion.div>
            )}

            {/* SECTION 9: Trending */}
            {trendingGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.36 }}
              >
                <ScrollableGameRow
                  title="Trending"
                  titleIcon={<Flame className="w-4 h-4 text-[#F97316]" />}
                  games={trendingGames}
                  viewAllHref="/casino?filter=trending"
                />
              </motion.div>
            )}

            {/* ================================================================= */}
            {/* SECTION 10: LIVE FEED TABLE                                       */}
            {/* ================================================================= */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FBBF24]" />
                  Live feed
                  <span className="relative flex h-2 w-2 ml-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
                  </span>
                </h2>
                <button
                  onClick={() => setHiddenUsernames(!hiddenUsernames)}
                  className="text-[#6E7681] hover:text-[#8B949E] transition-colors"
                  title={hiddenUsernames ? 'Show usernames' : 'Hide usernames'}
                >
                  {hiddenUsernames ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Live feed filter tabs */}
              <div className="flex gap-1 mb-3">
                {[
                  { key: 'all' as LiveFeedTab, label: 'All bets' },
                  { key: 'my' as LiveFeedTab, label: 'My bets' },
                  { key: 'huge' as LiveFeedTab, label: 'Huge wins' },
                  { key: 'biggest' as LiveFeedTab, label: 'Biggest payouts' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setLiveFeedTab(tab.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200',
                      liveFeedTab === tab.key
                        ? 'bg-[#21262D] text-white'
                        : 'text-[#6E7681] hover:text-[#8B949E] hover:bg-[#161B22]'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="bg-[#161B22] border border-[#21262D] rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr] gap-2 px-3 py-2 border-b border-[#21262D] text-[10px] font-semibold text-[#484F58] uppercase tracking-wider">
                  <span>Game</span>
                  <span>Username</span>
                  <span className="text-right">Multiplier</span>
                  <span className="text-right">Payout</span>
                </div>

                {/* Table rows */}
                <div className="divide-y divide-[#21262D]/50">
                  {displayedBets.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[#484F58] text-sm">
                      {liveFeedTab === 'my' ? 'No bets yet. Place a bet to see it here!' : 'No bets to show'}
                    </div>
                  ) : (
                    displayedBets.map((bet, idx) => (
                      <div
                        key={bet.id}
                        className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr] gap-2 px-3 py-2 text-[12px] hover:bg-[#1C2128]/50 transition-colors items-center"
                      >
                        {/* Game */}
                        <Link
                          href={`/casino/${bet.gameSlug}`}
                          className="flex items-center gap-1.5 text-[#E6EDF3] hover:text-[#8B5CF6] transition-colors font-medium truncate"
                        >
                          <span className="text-sm shrink-0">{GAME_ICONS[bet.gameSlug] || '\u{1F3AE}'}</span>
                          <span className="truncate">{bet.game}</span>
                        </Link>

                        {/* Username with VIP badge */}
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={cn(
                            'w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0',
                            VIP_COLORS[idx % VIP_COLORS.length]
                          )}>
                            {idx + 1}
                          </span>
                          <span className="text-[#8B949E] truncate">
                            {hiddenUsernames
                              ? `${bet.username.slice(0, 2)}${'*'.repeat(Math.max(3, bet.username.length - 2))}`
                              : bet.username}
                          </span>
                        </div>

                        {/* Multiplier */}
                        <span className="text-right">
                          {bet.multiplier > 0 ? (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-bold inline-block',
                                bet.multiplier >= 10
                                  ? 'bg-[#F59E0B]/15 text-[#FBBF24]'
                                  : bet.multiplier >= 2
                                  ? 'bg-[#10B981]/15 text-[#34D399]'
                                  : 'bg-[#6E7681]/10 text-[#8B949E]'
                              )}
                            >
                              {bet.multiplier}x
                            </span>
                          ) : (
                            <span className="text-[#484F58]">--</span>
                          )}
                        </span>

                        {/* Payout */}
                        <span
                          className={cn(
                            'font-mono text-[11px] text-right font-semibold truncate',
                            bet.payout > 0 ? 'text-[#34D399]' : 'text-[#F87171]'
                          )}
                        >
                          {bet.payout > 0
                            ? `+${formatCurrency(bet.payout, bet.currency)}`
                            : `-${formatCurrency(bet.amount, bet.currency)}`}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Show more button */}
                {liveBets.length > 6 && (
                  <button
                    onClick={() => setShowMoreBets(!showMoreBets)}
                    className="w-full py-2.5 text-[12px] font-medium text-[#8B5CF6] hover:text-[#A78BFA] hover:bg-[#1C2128] transition-all border-t border-[#21262D]"
                  >
                    {showMoreBets ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            </motion.section>

            {/* ================================================================= */}
            {/* SECTION 11: Additional game rows                                  */}
            {/* ================================================================= */}

            {/* Highest rakeback earnings */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.44 }}
            >
              <ScrollableGameRow
                title="Highest rakeback earnings"
                titleIcon={<TrendingUp className="w-4 h-4 text-[#10B981]" />}
                games={trendingGames}
                viewAllHref="/casino?filter=rakeback"
              />
            </motion.div>

            {/* Blackjack */}
            {tableGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.48 }}
              >
                <ScrollableGameRow
                  title="Blackjack"
                  titleIcon={<span className="text-base">{GAME_ICONS['blackjack']}</span>}
                  games={tableGames.filter((g) => g.slug === 'blackjack' || g.category === 'table')}
                  viewAllHref="/casino?category=table"
                />
              </motion.div>
            )}

            {/* Baccarat */}
            {tableGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.52 }}
              >
                <ScrollableGameRow
                  title="Baccarat"
                  titleIcon={<span className="text-base">{GAME_ICONS['baccarat']}</span>}
                  games={tableGames.filter((g) => g.slug === 'baccarat' || g.slug === 'blackjack' || g.category === 'table')}
                  viewAllHref="/casino?category=table"
                />
              </motion.div>
            )}

            {/* Roulette */}
            {tableGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.56 }}
              >
                <ScrollableGameRow
                  title="Roulette"
                  titleIcon={<span className="text-base">{GAME_ICONS['roulette']}</span>}
                  games={tableGames.filter((g) => g.slug === 'roulette' || g.category === 'table')}
                  viewAllHref="/casino?category=table"
                />
              </motion.div>
            )}

            {/* CryptoBet Picks */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            >
              <ScrollableGameRow
                title="CryptoBet picks"
                titleIcon={<Award className="w-4 h-4 text-[#FBBF24]" />}
                games={games.filter((g) => FEATURED_GAMES.includes(g.slug))}
                viewAllHref="/casino"
              />
            </motion.div>

            {/* Highest RTP */}
            {highRtpGames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.64 }}
              >
                <ScrollableGameRow
                  title="Highest RTP"
                  titleIcon={<Percent className="w-4 h-4 text-[#10B981]" />}
                  games={highRtpGames}
                  viewAllHref="/casino?sort=rtp"
                />
              </motion.div>
            )}

            {/* Popular games for you */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.68 }}
            >
              <ScrollableGameRow
                title="Popular games for you"
                titleIcon={<Gem className="w-4 h-4 text-[#A78BFA]" />}
                games={trendingGames}
                viewAllHref="/casino?filter=popular"
              />
            </motion.div>

            {/* ================================================================= */}
            {/* TOP 5 HOT SLOTS LEADERBOARD                                      */}
            {/* ================================================================= */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.72 }}
            >
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-[#F97316]" />
                TOP 5 HOT SLOTS
              </h2>
              <div className="bg-[#161B22] border border-[#21262D] rounded-xl overflow-hidden">
                {TOP_HOT_SLOTS.map((slot, idx) => (
                  <Link
                    key={slot.rank}
                    href={`/casino/${slot.slug}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 hover:bg-[#1C2128] transition-colors",
                      idx < TOP_HOT_SLOTS.length - 1 && 'border-b border-[#21262D]/50'
                    )}
                  >
                    {/* Rank */}
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                      idx === 0 ? 'bg-[#FBBF24] text-black' :
                      idx === 1 ? 'bg-[#9CA3AF] text-black' :
                      idx === 2 ? 'bg-[#CD7F32] text-white' :
                      'bg-[#21262D] text-[#8B949E]'
                    )}>
                      {slot.rank}
                    </span>

                    {/* Icon */}
                    <span className="text-xl shrink-0">{slot.icon}</span>

                    {/* Name */}
                    <span className="text-[13px] font-medium text-[#E6EDF3] flex-1">{slot.name}</span>

                    {/* Percentage bar */}
                    <div className="w-24 sm:w-32 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#21262D] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            idx === 0 ? 'bg-[#FBBF24]' : 'bg-[#8B5CF6]'
                          )}
                          style={{ width: `${slot.percentage}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-[#8B949E] w-10 text-right">
                        {slot.percentage}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.section>

            {/* ================================================================= */}
            {/* PROVABLY FAIR BANNER                                              */}
            {/* ================================================================= */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.76 }}
            >
              <div className="bg-gradient-to-r from-[#8B5CF6]/8 via-[#161B22] to-[#10B981]/8 border border-[#21262D] rounded-xl px-4 py-4">
                <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
                  <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-white">
                      All Games are Provably Fair
                    </h3>
                    <p className="text-[12px] text-[#6E7681] mt-0.5">
                      Every game uses HMAC-SHA256 cryptographic verification. Verify every result independently.
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

            {/* ================================================================= */}
            {/* SECTION 12: FOOTER CONTENT                                       */}
            {/* ================================================================= */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.8 }}
              className="mt-4 space-y-6"
            >
              {/* Social icons row */}
              <div className="flex items-center justify-center gap-3">
                {[
                  { icon: <Instagram className="w-4 h-4" />, href: '#', label: 'Instagram' },
                  { icon: <MessageCircle className="w-4 h-4" />, href: '#', label: 'Telegram' },
                  { icon: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, href: '#', label: 'X' },
                  { icon: <Youtube className="w-4 h-4" />, href: '#', label: 'YouTube' },
                  { icon: <Github className="w-4 h-4" />, href: '#', label: 'GitHub' },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    className="w-9 h-9 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center text-[#6E7681] hover:text-[#E6EDF3] hover:border-[#30363D] transition-all"
                    title={social.label}
                  >
                    {social.icon}
                  </a>
                ))}
                <span className="w-9 h-9 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center text-[9px] font-bold text-[#6E7681]">
                  18+
                </span>
              </div>

              {/* Language selector */}
              <div className="flex justify-center">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-[#161B22] border border-[#21262D] rounded-lg text-[12px] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#30363D] transition-all">
                  <Globe className="w-3.5 h-3.5" />
                  English
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Support cards */}
              <div className="grid grid-cols-3 gap-2">
                <Link
                  href="/help"
                  className="flex flex-col items-center gap-1.5 p-3 bg-[#161B22] border border-[#21262D] rounded-xl hover:border-[#30363D] hover:bg-[#1C2128] transition-all text-center"
                >
                  <HelpCircle className="w-5 h-5 text-[#8B5CF6]" />
                  <span className="text-[11px] font-medium text-[#E6EDF3]">Help Center</span>
                </Link>
                <button className="flex flex-col items-center gap-1.5 p-3 bg-[#161B22] border border-[#21262D] rounded-xl hover:border-[#30363D] hover:bg-[#1C2128] transition-all text-center">
                  <MessageCircle className="w-5 h-5 text-[#10B981]" />
                  <span className="text-[11px] font-medium text-[#E6EDF3]">Live chat</span>
                </button>
                <button className="flex flex-col items-center gap-1.5 p-3 bg-[#161B22] border border-[#21262D] rounded-xl hover:border-[#30363D] hover:bg-[#1C2128] transition-all text-center">
                  <Star className="w-5 h-5 text-[#FBBF24]" />
                  <span className="text-[11px] font-medium text-[#E6EDF3]">Feedback</span>
                </button>
              </div>

              {/* Legal text */}
              <div className="text-center space-y-2 pt-2">
                <p className="text-[10px] text-[#484F58] leading-relaxed max-w-md mx-auto">
                  CryptoBet is operated under a Curacao eGaming license. All games are provably fair
                  and use HMAC-SHA256 cryptographic verification. Gambling can be addictive. Play responsibly.
                </p>
                <div className="flex items-center justify-center gap-3 text-[10px] text-[#484F58]">
                  <Link href="/terms" className="hover:text-[#8B949E] transition-colors">Terms</Link>
                  <span className="text-[#21262D]">|</span>
                  <Link href="/privacy" className="hover:text-[#8B949E] transition-colors">Privacy</Link>
                  <span className="text-[#21262D]">|</span>
                  <Link href="/responsible-gambling" className="hover:text-[#8B949E] transition-colors">Responsible Gambling</Link>
                  <span className="text-[#21262D]">|</span>
                  <Link href="/aml" className="hover:text-[#8B949E] transition-colors">AML Policy</Link>
                </div>
              </div>
            </motion.section>
          </div>
        )}

        {/* ================================================================= */}
        {/* SEARCH/FILTER RESULTS (when search or filter is active)           */}
        {/* ================================================================= */}
        {isSearchActive && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#8B949E]" />
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : CATEGORY_ICONS.find((c) => c.key === activeCategory)?.label || 'All Games'}
                <span className="text-[11px] font-normal text-[#484F58] ml-1">
                  ({filteredGames.length})
                </span>
              </h2>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                  setActiveFilters([]);
                }}
                className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-semibold transition-colors"
              >
                Clear filters
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5"
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="rounded-xl overflow-hidden">
                      <Skeleton className="aspect-square w-full rounded-none" />
                      <div className="bg-[#161B22] px-2 py-1.5 space-y-1">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : filteredGames.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-[#161B22] border border-[#21262D] rounded-xl p-12 text-center"
                >
                  <Search className="w-8 h-8 text-[#30363D] mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1">
                    No games found
                  </h3>
                  <p className="text-xs text-[#6E7681] mb-4">
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
              ) : (
                <motion.div
                  key={`grid-${activeCategory}-${searchQuery}-${activeFilters.join(',')}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5"
                >
                  {filteredGames.map((game, idx) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.02, ease: 'easeOut' }}
                    >
                      <Link
                        href={`/casino/${game.slug}`}
                        className="block rounded-xl overflow-hidden group transition-all duration-200 hover:ring-2 hover:ring-[#8B5CF6]/60 hover:shadow-lg hover:shadow-[#8B5CF6]/10 hover:-translate-y-0.5"
                      >
                        <div className="relative aspect-square overflow-hidden bg-[#161B22]">
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
                                GAME_GRADIENTS[game.slug] || 'from-gray-700 via-slate-600 to-zinc-500'
                              )}
                            >
                              <div className="absolute inset-0 opacity-[0.06]" style={{
                                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                                backgroundSize: '14px 14px',
                              }} />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55%] h-[55%] rounded-full bg-white/10 blur-2xl" />
                              <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full bg-white/8" />
                              <div className="absolute -bottom-5 -left-5 w-16 h-16 rounded-full bg-black/15" />
                              <div className="absolute top-0 left-0 right-0 h-[35%] bg-gradient-to-b from-white/12 to-transparent" />
                              {GAME_ICONS[game.slug] ? (
                                <span className="text-5xl sm:text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-transform duration-300 relative z-10 select-none">
                                  {GAME_ICONS[game.slug]}
                                </span>
                              ) : (
                                <Gamepad2 className="w-12 h-12 text-white/50 relative z-10" />
                              )}
                              <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-black/30 to-transparent" />
                            </div>
                          )}

                          {/* Badges */}
                          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-20">
                            {game.isNew && (
                              <span className="px-1.5 py-0.5 bg-[#10B981] rounded text-[8px] font-bold text-white leading-tight shadow-sm uppercase tracking-wide">
                                NEW
                              </span>
                            )}
                            {game.isPopular && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#F59E0B] rounded text-[8px] font-bold text-black leading-tight shadow-sm">
                                <Flame className="w-2.5 h-2.5" />
                                HOT
                              </span>
                            )}
                          </div>

                          {game.rtp >= 98 && (
                            <div className="absolute top-1.5 right-1.5 z-20">
                              <span className="px-1.5 py-0.5 bg-[#8B5CF6]/90 backdrop-blur-sm rounded-full text-[8px] font-bold text-white shadow-sm">
                                {game.rtp}% RTP
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 z-10">
                            <div className="w-10 h-10 rounded-full bg-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/50 group-hover:scale-110 transition-transform duration-200">
                              <Play className="w-4 h-4 text-white ml-0.5" />
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#161B22] px-2 py-1.5">
                          <p className="font-semibold text-[12px] text-[#E6EDF3] truncate leading-tight group-hover:text-white transition-colors">
                            {game.name}
                          </p>
                          <p className="text-[10px] text-[#6E7681] mt-0.5 truncate">
                            {game.provider}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </div>
    </div>
  );
}
