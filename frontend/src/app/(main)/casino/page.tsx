'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  Clock,
  Heart,
  Dice1,
  Crown,
  Shield,
  Layers,
  Zap,
  Tv,
  Star,
  ChevronLeft,
  ChevronRight,
  Flame,
  Play,
  Gamepad2,
  TrendingUp,
  Gem,
  Home,
  Info,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

type Category = 'all' | 'slots' | 'table' | 'instant' | 'provably-fair' | string;

// ---------------------------------------------------------------------------
// Game Data
// ---------------------------------------------------------------------------

const MOCK_GAMES: CasinoGame[] = [
  // Originals (provably fair)
  { id: '1', name: 'Crash', slug: 'crash', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '2', name: 'Dice', slug: 'dice', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 99, houseEdge: 1 },
  { id: '3', name: 'Mines', slug: 'mines', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '4', name: 'Plinko', slug: 'plinko', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '5', name: 'Coinflip', slug: 'coinflip', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: true, rtp: 97, houseEdge: 3 },
  { id: '6', name: 'Limbo', slug: 'limbo', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, rtp: 97, houseEdge: 3 },
  { id: '7', name: 'HiLo', slug: 'hilo', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, rtp: 97, houseEdge: 3 },
  { id: '8', name: 'Tower', slug: 'tower', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: false, rtp: 97, houseEdge: 3 },
  { id: '9', name: 'Wheel of Fortune', slug: 'wheel', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 96, houseEdge: 4 },
  { id: '10', name: 'Keno', slug: 'keno', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, rtp: 95, houseEdge: 5 },
  // Table games
  { id: '11', name: 'Blackjack', slug: 'blackjack', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: true, rtp: 99.5, houseEdge: 0.5 },
  { id: '12', name: 'Roulette', slug: 'roulette', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: true, rtp: 97.3, houseEdge: 2.7 },
  { id: '13', name: 'Baccarat', slug: 'baccarat', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, rtp: 98.9, houseEdge: 1.1 },
  { id: '14', name: 'Video Poker', slug: 'videopoker', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, rtp: 99.5, houseEdge: 0.5 },
  { id: '15', name: 'Sic Bo', slug: 'sicbo', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, isNew: true, rtp: 97.2, houseEdge: 2.8 },
  { id: '16', name: 'Craps', slug: 'craps', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, isNew: true, rtp: 98.6, houseEdge: 1.4 },
  { id: '17', name: 'Faro', slug: 'faro', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, isNew: true, rtp: 97, houseEdge: 3 },
  { id: '18', name: 'Poker', slug: 'poker', thumbnail: '', provider: 'CryptoBet', category: 'table', isPopular: false, isNew: true, rtp: 98.5, houseEdge: 1.5 },
  // Slots
  { id: '19', name: 'Classic Slots', slug: 'slots', thumbnail: '', provider: 'CryptoBet', category: 'slots', isPopular: true, rtp: 96, houseEdge: 4 },
  { id: '20', name: '5-Reel Slots', slug: 'slots5', thumbnail: '', provider: 'CryptoBet', category: 'slots', isPopular: false, isNew: true, rtp: 96.5, houseEdge: 3.5 },
  { id: '21', name: 'Jackpot Slots', slug: 'jackpotslots', thumbnail: '', provider: 'CryptoBet', category: 'slots', isPopular: true, isNew: true, rtp: 95, houseEdge: 5 },
  // Instant / Casual
  { id: '22', name: 'Rock Paper Scissors', slug: 'rps', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 97, houseEdge: 3 },
  { id: '23', name: 'Number Guess', slug: 'numberguess', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 97, houseEdge: 3 },
  { id: '24', name: 'Scratch Cards', slug: 'scratchcard', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 95, houseEdge: 5 },
  { id: '25', name: 'Thimbles', slug: 'thimbles', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 97, houseEdge: 3 },
  { id: '26', name: 'Dragon Tower', slug: 'dragontower', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: false, isNew: true, rtp: 97, houseEdge: 3 },
  // Advanced
  { id: '27', name: 'Aviator', slug: 'aviator', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: true, isNew: true, rtp: 97, houseEdge: 3 },
  { id: '28', name: 'Trenball', slug: 'trenball', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: false, isNew: true, rtp: 97, houseEdge: 3 },
  { id: '29', name: 'Case Opening', slug: 'caseopening', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 93, houseEdge: 7 },
  { id: '30', name: 'Bingo', slug: 'bingo', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 95, houseEdge: 5 },
  { id: '31', name: 'Minesweeper', slug: 'minesweeper', thumbnail: '', provider: 'CryptoBet', category: 'provably-fair', isPopular: false, isNew: true, rtp: 97, houseEdge: 3 },
  // Complex
  { id: '32', name: 'Wheel of Millions', slug: 'wheelofmillions', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: true, isNew: true, rtp: 95, houseEdge: 5 },
  { id: '33', name: 'Horse Racing', slug: 'horseracing', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 95, houseEdge: 5 },
  { id: '34', name: 'Ludo', slug: 'ludo', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 96, houseEdge: 4 },
  { id: '35', name: 'Virtual Sports', slug: 'virtualsports', thumbnail: '', provider: 'CryptoBet', category: 'instant', isPopular: false, isNew: true, rtp: 95, houseEdge: 5 },
];

// ---------------------------------------------------------------------------
// Game Gradients & Icons
// ---------------------------------------------------------------------------

const GAME_GRADIENTS: Record<string, string> = {
  crash: 'from-red-600 to-orange-500',
  dice: 'from-amber-600 to-yellow-400',
  mines: 'from-pink-500 to-purple-600',
  plinko: 'from-green-500 to-emerald-400',
  coinflip: 'from-yellow-400 to-amber-500',
  limbo: 'from-blue-600 to-cyan-400',
  hilo: 'from-violet-600 to-purple-400',
  tower: 'from-indigo-600 to-blue-500',
  wheel: 'from-purple-500 to-pink-500',
  keno: 'from-teal-500 to-green-400',
  blackjack: 'from-emerald-700 to-green-500',
  roulette: 'from-red-700 to-red-500',
  baccarat: 'from-amber-700 to-yellow-500',
  videopoker: 'from-blue-700 to-indigo-500',
  sicbo: 'from-orange-600 to-red-400',
  craps: 'from-green-600 to-lime-400',
  faro: 'from-rose-600 to-pink-400',
  poker: 'from-emerald-600 to-teal-400',
  slots: 'from-purple-600 to-violet-400',
  slots5: 'from-fuchsia-600 to-purple-400',
  jackpotslots: 'from-yellow-500 to-orange-500',
  rps: 'from-cyan-500 to-blue-400',
  numberguess: 'from-sky-500 to-indigo-400',
  scratchcard: 'from-lime-500 to-green-400',
  thimbles: 'from-amber-500 to-orange-400',
  dragontower: 'from-red-500 to-purple-600',
  aviator: 'from-red-500 to-rose-400',
  trenball: 'from-green-500 to-teal-400',
  caseopening: 'from-yellow-500 to-amber-400',
  bingo: 'from-blue-500 to-purple-400',
  minesweeper: 'from-gray-500 to-slate-400',
  wheelofmillions: 'from-yellow-400 to-amber-300',
  horseracing: 'from-amber-700 to-amber-500',
  ludo: 'from-red-400 to-blue-400',
  virtualsports: 'from-green-400 to-emerald-500',
  crash_trenball: 'from-orange-500 to-red-400',
};

const GAME_ICONS: Record<string, string> = {
  crash: '\u{1F680}', dice: '\u{1F3B2}', mines: '\u{1F48E}', plinko: '\u{26A1}', coinflip: '\u{1FA99}',
  limbo: '\u{1F3AF}', hilo: '\u{1F0CF}', tower: '\u{1F3D7}\u{FE0F}', wheel: '\u{1F3A1}', keno: '\u{1F522}',
  blackjack: '\u{2660}\u{FE0F}', roulette: '\u{1F3B0}', baccarat: '\u{1F451}', videopoker: '\u{1F0CF}', sicbo: '\u{1F3B2}',
  craps: '\u{1F3AF}', faro: '\u{1F0A1}', poker: '\u{2663}\u{FE0F}', slots: '\u{1F352}', slots5: '\u{1F3B0}',
  jackpotslots: '\u{1F4B0}', rps: '\u{270A}', numberguess: '\u{1F52E}', scratchcard: '\u{1F3AB}', thimbles: '\u{1F3C6}',
  dragontower: '\u{1F409}', aviator: '\u{2708}\u{FE0F}', trenball: '\u{26BD}', caseopening: '\u{1F4E6}', bingo: '\u{1F171}\u{FE0F}',
  minesweeper: '\u{1F4A3}', wheelofmillions: '\u{1F3C6}', horseracing: '\u{1F3C7}', ludo: '\u{1F3B2}', virtualsports: '\u{1F3DF}\u{FE0F}',
};

// ---------------------------------------------------------------------------
// Slug to page path mapping
// ---------------------------------------------------------------------------

const SLUG_TO_PATH: Record<string, string> = {
  'video-poker': 'videopoker',
};

function gameHref(slug: string) {
  return `/casino/${SLUG_TO_PATH[slug] || slug}`;
}

// Constant slug lists used in filteredGames useMemo (hoisted to avoid re-creation)
const GAME_SHOW_SLUGS = ['wheel', 'wheelofmillions', 'bingo', 'ludo'] as const;

// ---------------------------------------------------------------------------
// Sub-tabs (Cloudbet style)
// ---------------------------------------------------------------------------

const SUB_TABS: { key: Category; label: string; icon?: React.ReactNode }[] = [
  { key: 'all', label: 'For you', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { key: 'recent', label: 'Recent', icon: <Clock className="w-3.5 h-3.5" /> },
  { key: 'favorites', label: 'My favorites', icon: <Heart className="w-3.5 h-3.5" /> },
  { key: 'table', label: 'Table games', icon: <Dice1 className="w-3.5 h-3.5" /> },
  { key: 'provably-fair', label: 'Provably Fair', icon: <Shield className="w-3.5 h-3.5" /> },
  { key: 'slots', label: 'Slots', icon: <Layers className="w-3.5 h-3.5" /> },
  { key: 'instant', label: 'Instant Win', icon: <Zap className="w-3.5 h-3.5" /> },
  { key: 'game-shows', label: 'Game shows', icon: <Tv className="w-3.5 h-3.5" /> },
  { key: 'new-games', label: 'New games', icon: <Star className="w-3.5 h-3.5" /> },
  { key: 'high-roller', label: 'High roller', icon: <Crown className="w-3.5 h-3.5" /> },
];

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

const FILTER_CHIPS = ['High roller', 'Feature buy', 'Trending', 'New'];

// ---------------------------------------------------------------------------
// Section Definitions - game slugs for each row
// ---------------------------------------------------------------------------

const SECTIONS = {
  originals: ['crash', 'dice', 'mines', 'plinko', 'coinflip', 'limbo', 'hilo', 'tower', 'wheel', 'keno', 'dragontower', 'minesweeper', 'aviator'],
  newGames: ['aviator', 'wheelofmillions', 'jackpotslots', 'sicbo', 'craps', 'faro', 'poker', 'slots5', 'dragontower', 'rps', 'numberguess', 'scratchcard', 'thimbles'],
  tableGames: ['blackjack', 'roulette', 'baccarat', 'videopoker', 'sicbo', 'craps', 'faro', 'poker'],
  slots: ['slots', 'slots5', 'jackpotslots'],
  quickCasual: ['coinflip', 'rps', 'numberguess', 'scratchcard', 'thimbles', 'keno', 'bingo', 'ludo'],
  trending: ['crash', 'aviator', 'mines', 'blackjack', 'plinko', 'wheelofmillions', 'jackpotslots', 'roulette', 'dice', 'slots'],
  advanced: ['aviator', 'trenball', 'caseopening', 'horseracing', 'virtualsports', 'wheelofmillions', 'tower', 'dragontower'],
  jumpBackIn: ['crash', 'mines', 'dice', 'blackjack', 'plinko', 'roulette'],
};

// ---------------------------------------------------------------------------
// Helper: get game objects from slug list
// ---------------------------------------------------------------------------

function getGamesBySlugs(slugs: string[]): CasinoGame[] {
  return slugs
    .map((slug) => MOCK_GAMES.find((g) => g.slug === slug))
    .filter(Boolean) as CasinoGame[];
}

// ---------------------------------------------------------------------------
// GameCardThumbnail - gradient background with emoji icon
// ---------------------------------------------------------------------------

function GameCardThumbnail({ slug }: { slug: string }) {
  const gradientClass = GAME_GRADIENTS[slug] || 'from-gray-600 to-slate-500';
  const icon = GAME_ICONS[slug];

  return (
    <div className={cn('w-full h-full bg-gradient-to-br flex items-center justify-center relative', gradientClass)}>
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1px, transparent 0)',
          backgroundSize: '12px 12px',
        }}
      />
      {/* Center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full bg-white/10 blur-2xl" />
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
      {/* Icon */}
      {icon ? (
        <span className="text-3xl drop-shadow-[0_3px_8px_rgba(0,0,0,0.4)] relative z-10 select-none">
          {icon}
        </span>
      ) : (
        <Gamepad2 className="w-8 h-8 text-white/50 relative z-10" />
      )}
      {/* Bottom vignette */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge Components
// ---------------------------------------------------------------------------

function BadgeNew() {
  return (
    <span className="px-1.5 py-0.5 bg-[#EF4444] rounded text-[9px] font-extrabold text-white leading-none uppercase tracking-wider">
      NEW
    </span>
  );
}

function BadgeRTP({ rtp }: { rtp: number }) {
  return (
    <span className="px-1.5 py-0.5 bg-black/50 rounded text-[9px] font-bold text-white/80 leading-none">
      {rtp}% RTP
    </span>
  );
}

// ---------------------------------------------------------------------------
// GameCard - Cloudbet mobile style (square dark cards)
// ---------------------------------------------------------------------------

const GameCard = React.memo(function GameCard({ game, size = 'normal' }: { game: CasinoGame; size?: 'normal' | 'grid' }) {
  return (
    <Link
      href={gameHref(game.slug)}
      className={cn(
        'block shrink-0 snap-start group',
        size === 'grid' ? 'w-full' : 'w-[120px]',
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-[#161B22] transition-all duration-200 group-hover:ring-2 group-hover:ring-[#8B5CF6]/60 group-hover:shadow-lg group-hover:shadow-[#8B5CF6]/10 group-hover:-translate-y-0.5">
        <GameCardThumbnail slug={game.slug} />

        {/* Badges overlay - top left */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-20">
          {game.isNew && <BadgeNew />}
        </div>

        {/* RTP badge - bottom right */}
        <div className="absolute bottom-1.5 right-1.5 z-20">
          <BadgeRTP rtp={game.rtp} />
        </div>

        {/* Play button overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 z-10">
          <div className="w-9 h-9 rounded-full bg-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/40">
            <Play className="w-4 h-4 text-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Game name + provider */}
      <div className="mt-1.5 px-0.5">
        <p className="text-[11px] font-semibold text-white truncate leading-tight group-hover:text-[#C8FF00] transition-colors">
          {game.name}
        </p>
        <p className="text-[10px] text-[#8B949E] truncate leading-tight mt-0.5">
          {game.provider}
        </p>
      </div>
    </Link>
  );
});

// ---------------------------------------------------------------------------
// GameRow - horizontal scrollable row with title and See all
// ---------------------------------------------------------------------------

const GameRow = React.memo(function GameRow({
  title,
  titleIcon,
  games,
  seeAllHref,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  games: CasinoGame[];
  seeAllHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (games.length === 0) return null;

  return (
    <section className="relative">
      {/* Row Header */}
      <div className="flex items-center justify-between mb-2.5 px-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          {titleIcon}
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-xs text-[#8B949E] hover:text-[#C8FF00] font-medium transition-colors"
          >
            See all
          </Link>
        )}
      </div>

      {/* Scrollable Game Cards */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory px-4"
      >
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
});

// ---------------------------------------------------------------------------
// GameGrid - 2-column grid
// ---------------------------------------------------------------------------

const GameGrid = React.memo(function GameGrid({
  title,
  titleIcon,
  games,
  seeAllHref,
}: {
  title: string;
  titleIcon?: React.ReactNode;
  games: CasinoGame[];
  seeAllHref?: string;
}) {
  if (games.length === 0) return null;

  return (
    <section className="px-4">
      {/* Row Header */}
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          {titleIcon}
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-xs text-[#8B949E] hover:text-[#C8FF00] font-medium transition-colors"
          >
            See all
          </Link>
        )}
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {games.map((game) => (
          <GameCard key={game.id} game={game} size="grid" />
        ))}
      </div>
    </section>
  );
});

// ---------------------------------------------------------------------------
// SearchBar - Cloudbet style
// ---------------------------------------------------------------------------

const SearchBar = React.memo(function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative px-4">
      <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B949E]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for a casino game"
        className="w-full h-10 pl-9 pr-4 rounded-lg bg-[#161B22] border border-[#30363D] text-sm text-white placeholder-[#8B949E] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all"
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// SubTabs - horizontal scrollable category sub-tabs
// ---------------------------------------------------------------------------

const SubTabs = React.memo(function SubTabs({
  active,
  onSelect,
}: {
  active: Category;
  onSelect: (cat: Category) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-4">
      {SUB_TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-200 border',
              isActive
                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-md shadow-[#8B5CF6]/20'
                : 'bg-[#161B22] text-[#8B949E] border-[#30363D] hover:text-white hover:border-[#484F58]'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// FilterChips - horizontal scrollable filter pills
// ---------------------------------------------------------------------------

const FilterChips = React.memo(function FilterChips({
  activeFilter,
  onSelect,
}: {
  activeFilter: string | null;
  onSelect: (f: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4">
      {FILTER_CHIPS.map((chip) => {
        const isActive = activeFilter === chip;
        return (
          <button
            key={chip}
            onClick={() => onSelect(isActive ? null : chip)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-200 border',
              isActive
                ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30'
                : 'bg-[#21262D] text-[#8B949E] border-[#30363D] hover:text-white hover:border-[#484F58]'
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Hero Slider Data & Component
// ---------------------------------------------------------------------------

const HERO_SLIDES = [
  {
    id: 'crash',
    game: 'Crash',
    tagline: 'Ride the Rocket',
    description: 'Cash out before the crash for massive multipliers',
    gradient: 'from-purple-600 via-pink-600 to-rose-500',
    icon: '\u{1F680}',
    accentColor: '#EC4899',
    href: '/casino/crash',
  },
  {
    id: 'mines',
    game: 'Mines',
    tagline: 'Dig for Diamonds',
    description: 'Reveal gems and avoid mines to multiply your bet',
    gradient: 'from-emerald-600 via-teal-500 to-cyan-500',
    icon: '\u{1F48E}',
    accentColor: '#14B8A6',
    href: '/casino/mines',
  },
  {
    id: 'blackjack',
    game: 'Blackjack',
    tagline: 'Beat the Dealer',
    description: 'Classic 21 with the best odds in the house',
    gradient: 'from-green-800 via-emerald-700 to-green-600',
    icon: '\u2660\uFE0F',
    accentColor: '#10B981',
    href: '/casino/blackjack',
  },
  {
    id: 'plinko',
    game: 'Plinko',
    tagline: 'Drop & Win',
    description: 'Watch the ball bounce to huge multipliers',
    gradient: 'from-blue-600 via-indigo-600 to-violet-600',
    icon: '\u26A1',
    accentColor: '#818CF8',
    href: '/casino/plinko',
  },
  {
    id: 'roulette',
    game: 'Roulette',
    tagline: 'Spin to Win',
    description: 'Place your bets and let the wheel decide',
    gradient: 'from-red-700 via-red-600 to-amber-500',
    icon: '\u{1F3B0}',
    accentColor: '#F59E0B',
    href: '/casino/roulette',
  },
  {
    id: 'dice',
    game: 'Dice',
    tagline: 'Roll Your Luck',
    description: 'Set your target and roll for provably fair wins',
    gradient: 'from-cyan-600 via-blue-600 to-blue-700',
    icon: '\u{1F3B2}',
    accentColor: '#22D3EE',
    href: '/casino/dice',
  },
];

const HeroSlider = React.memo(function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const goToSlide = useCallback((index: number) => {
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartTime.current = Date.now();
    setIsPaused(true);
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaTime = Date.now() - touchStartTime.current;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Swipe threshold: at least 40px or fast enough velocity
      if (Math.abs(deltaX) > 40 || velocity > 0.3) {
        if (deltaX < 0) {
          // Swipe left -> next slide
          setDirection(1);
          setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
        } else {
          // Swipe right -> prev slide
          setDirection(-1);
          setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
        }
      }

      touchStartX.current = null;
      // Resume auto-rotate after a brief delay
      setTimeout(() => setIsPaused(false), 3000);
    },
    []
  );

  const slide = HERO_SLIDES[currentSlide];

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  return (
    <div
      className="px-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="relative w-full h-[180px] sm:h-[240px] md:h-[280px] rounded-xl overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={slide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.25 },
            }}
            className={cn(
              'absolute inset-0 bg-gradient-to-br flex items-center',
              slide.gradient
            )}
          >
            {/* Decorative dot pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '16px 16px',
              }}
            />

            {/* Top shine gradient */}
            <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />

            {/* Bottom vignette */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />

            {/* Large faded background emoji */}
            <div className="absolute right-[-10px] sm:right-4 top-1/2 -translate-y-1/2 text-[100px] sm:text-[140px] md:text-[180px] opacity-[0.12] select-none pointer-events-none leading-none">
              {slide.icon}
            </div>

            {/* Glowing orb decoration */}
            <div
              className="absolute top-1/4 right-1/4 w-32 h-32 sm:w-48 sm:h-48 rounded-full blur-3xl opacity-20"
              style={{ backgroundColor: slide.accentColor }}
            />

            {/* Content */}
            <div className="relative z-10 px-5 sm:px-8 md:px-10 flex flex-col justify-center h-full max-w-[65%] sm:max-w-[55%]">
              {/* Provider badge */}
              <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C8FF00] animate-pulse" />
                <span className="text-[10px] sm:text-xs font-semibold text-white/70 uppercase tracking-wider">
                  CryptoBet Original
                </span>
              </div>

              {/* Game title */}
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight mb-1 sm:mb-1.5 drop-shadow-lg">
                {slide.game}
              </h2>

              {/* Tagline */}
              <p className="text-sm sm:text-lg md:text-xl font-bold text-white/90 mb-1 sm:mb-2">
                {slide.tagline}
              </p>

              {/* Description */}
              <p className="text-[11px] sm:text-sm text-white/60 leading-snug mb-3 sm:mb-4 line-clamp-2">
                {slide.description}
              </p>

              {/* Play Now button */}
              <Link
                href={slide.href}
                className="inline-flex items-center gap-1.5 w-fit px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 hover:scale-105 hover:shadow-lg"
                style={{
                  backgroundColor: slide.accentColor,
                  color: '#fff',
                  boxShadow: `0 4px 14px ${slide.accentColor}40`,
                }}
              >
                <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                Play Now
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={cn(
                'rounded-full transition-all duration-300',
                idx === currentSlide
                  ? 'w-5 h-1.5 bg-white'
                  : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Filtered Games Grid (when a category tab is selected)
// ---------------------------------------------------------------------------

function FilteredGamesGrid({ games }: { games: CasinoGame[] }) {
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Gamepad2 className="w-12 h-12 text-[#30363D] mb-3" />
        <p className="text-sm text-[#8B949E]">No games found</p>
        <p className="text-xs text-[#484F58] mt-1">Try a different category or search</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 px-4 pb-4">
      {games.map((game, idx) => (
        <motion.div
          key={game.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: idx * 0.02 }}
        >
          <GameCard game={game} size="grid" />
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom Bar (fixed)
// ---------------------------------------------------------------------------

function BottomBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
      {/* Left icons */}
      <div className="flex items-center gap-3">
        <Link href="/casino" className="text-[#8B949E] hover:text-white transition-colors">
          <Home className="w-6 h-6" />
        </Link>
        <button className="text-[#8B949E] hover:text-white transition-colors">
          <Info className="w-6 h-6" />
        </button>
        <button className="text-[#8B949E] hover:text-white transition-colors">
          <Volume2 className="w-6 h-6" />
        </button>
      </div>

      {/* Center balance */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-mono text-white">0.0000 BTC</span>
      </div>

      {/* Right - Provably Fair badge */}
      <div className="flex items-center gap-1.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
        <Shield className="w-3.5 h-3.5 text-[#8B5CF6]" />
        <span className="text-xs text-[#8B5CF6] font-medium whitespace-nowrap">
          Provably Fair Game
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Casino Lobby Page
// ---------------------------------------------------------------------------

export default function CasinoLobbyPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Memoized game lists for each section
  const originalsGames = useMemo(() => getGamesBySlugs(SECTIONS.originals), []);
  const newGames = useMemo(() => getGamesBySlugs(SECTIONS.newGames), []);
  const jumpBackInGames = useMemo(() => getGamesBySlugs(SECTIONS.jumpBackIn), []);
  const trendingGames = useMemo(() => getGamesBySlugs(SECTIONS.trending), []);
  const tableGames = useMemo(() => getGamesBySlugs(SECTIONS.tableGames), []);
  const slotsGames = useMemo(() => getGamesBySlugs(SECTIONS.slots), []);
  const quickCasualGames = useMemo(() => getGamesBySlugs(SECTIONS.quickCasual), []);
  const advancedGames = useMemo(() => getGamesBySlugs(SECTIONS.advanced), []);

  // Filtered games for category/search mode
  const filteredGames = useMemo(() => {
    let games = MOCK_GAMES;

    // Category filter
    if (activeCategory !== 'all') {
      switch (activeCategory) {
        case 'recent':
          games = MOCK_GAMES.slice(0, 12);
          break;
        case 'favorites':
          games = MOCK_GAMES.filter((g) => g.isPopular);
          break;
        case 'new-games':
          games = MOCK_GAMES.filter((g) => g.isNew);
          break;
        case 'high-roller':
          games = MOCK_GAMES.filter((g) => g.category === 'table' || g.rtp >= 98);
          break;
        case 'game-shows':
          games = MOCK_GAMES.filter((g) => (GAME_SHOW_SLUGS as readonly string[]).includes(g.slug));
          break;
        default:
          games = MOCK_GAMES.filter((g) => g.category === activeCategory);
          break;
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      games = games.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.slug.toLowerCase().includes(q) ||
          g.provider.toLowerCase().includes(q)
      );
    }

    // Filter chips
    if (activeFilter) {
      switch (activeFilter) {
        case 'High roller':
          games = games.filter((g) => g.rtp >= 98 || g.category === 'table');
          break;
        case 'Trending':
          const trendingSlugs = SECTIONS.trending;
          games = games.filter((g) => trendingSlugs.includes(g.slug));
          break;
        case 'New':
          games = games.filter((g) => g.isNew);
          break;
        case 'Feature buy':
          games = games.filter((g) => g.category === 'slots' || g.category === 'instant');
          break;
      }
    }

    return games;
  }, [activeCategory, searchQuery, activeFilter]);

  const isDefaultView = activeCategory === 'all' && !searchQuery.trim() && !activeFilter;

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Scrollbar hide CSS */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Header with Casino tab */}
      <div className="bg-[#161B22] border-b border-[#30363D]">
        <div className="flex items-center justify-center gap-8 py-3 px-4">
          <Link href="/" className="text-[#8B949E] text-sm font-medium">
            Sports
          </Link>
          <Link href="/casino" className="text-white text-sm font-bold relative">
            Casino
            <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-[#8B5CF6]" />
          </Link>
          <Link href="/" className="text-[#8B949E] text-sm font-medium">
            Live
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="py-3 space-y-4 pb-20">
        {/* Hero Slider */}
        <HeroSlider />

        {/* Sub-tabs */}
        <SubTabs active={activeCategory} onSelect={setActiveCategory} />

        {/* Search Bar */}
        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        {/* Filter Chips */}
        <FilterChips activeFilter={activeFilter} onSelect={setActiveFilter} />

        {/* Default View: Rows and grids */}
        {isDefaultView ? (
          <div className="space-y-6">
            {/* Jump back in */}
            <GameRow
              title="Jump back in"
              titleIcon={<Clock className="w-4 h-4 text-[#8B949E]" />}
              games={jumpBackInGames}
            />

            {/* Originals - 2-column grid */}
            <GameGrid
              title="Originals"
              titleIcon={<Gem className="w-4 h-4 text-[#C8FF00]" />}
              games={originalsGames.slice(0, 8)}
              seeAllHref="/casino?category=provably-fair"
            />

            {/* New */}
            <GameGrid
              title="New"
              titleIcon={<Sparkles className="w-4 h-4 text-[#C8FF00]" />}
              games={newGames.slice(0, 6)}
              seeAllHref="/casino?category=new-games"
            />

            {/* Trending */}
            <GameRow
              title="Trending"
              titleIcon={<TrendingUp className="w-4 h-4 text-[#EF4444]" />}
              games={trendingGames}
            />

            {/* Best table games */}
            <GameRow
              title="Best table games"
              titleIcon={<Dice1 className="w-4 h-4 text-[#8B5CF6]" />}
              games={tableGames}
              seeAllHref="/casino?category=table"
            />

            {/* Slots */}
            <GameRow
              title="Slots"
              titleIcon={<Layers className="w-4 h-4 text-[#8B5CF6]" />}
              games={slotsGames}
              seeAllHref="/casino?category=slots"
            />

            {/* Quick & Casual */}
            <GameRow
              title="Quick & Casual"
              titleIcon={<Zap className="w-4 h-4 text-[#C8FF00]" />}
              games={quickCasualGames}
              seeAllHref="/casino?category=instant"
            />

            {/* Advanced Games */}
            <GameRow
              title="Advanced Games"
              titleIcon={<Star className="w-4 h-4 text-[#8B5CF6]" />}
              games={advancedGames}
              seeAllHref="/casino?category=provably-fair"
            />
          </div>
        ) : (
          /* Filtered/Search View: Grid layout */
          <div>
            <div className="flex items-center gap-2 mb-4 px-4">
              <h2 className="text-sm font-bold text-white">
                {searchQuery.trim()
                  ? `Results for "${searchQuery}"`
                  : SUB_TABS.find((t) => t.key === activeCategory)?.label || 'Games'}
              </h2>
              <span className="text-xs text-[#8B949E]">
                {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}
              </span>
            </div>
            <FilteredGamesGrid games={filteredGames} />
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <BottomBar />
    </div>
  );
}
