'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Heart,
  Star,
  Play,
  Flame,
  ShieldCheck,
  TrendingUp,
  Dice1,
  Bomb,
  CircleDot,
  Coins,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trophy,
  X,
  Gamepad2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';

// ─── Types ──────────────────────────────────────────────────────────────────
interface CasinoGame {
  id: string;
  name: string;
  provider: string;
  category: string[];
  image: string;
  isNew: boolean;
  isHot: boolean;
  isFavorite: boolean;
  rtp: number;
  isJackpot?: boolean;
}

interface TopWin {
  id: string;
  user: string;
  game: string;
  amount: string;
  currency: string;
  multiplier: string;
  timeAgo: string;
}

// ─── Categories ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'slots', label: 'Slots' },
  { key: 'live-casino', label: 'Live Casino' },
  { key: 'table-games', label: 'Table Games' },
  { key: 'blackjack', label: 'Blackjack' },
  { key: 'roulette', label: 'Roulette' },
  { key: 'baccarat', label: 'Baccarat' },
  { key: 'poker', label: 'Poker' },
  { key: 'game-shows', label: 'Game Shows' },
  { key: 'crash', label: 'Crash' },
  { key: 'arcade', label: 'Arcade' },
  { key: 'jackpot', label: 'Jackpot Slots' },
];

// ─── Providers ──────────────────────────────────────────────────────────────
const PROVIDERS = [
  'All Providers',
  'Evolution',
  'Pragmatic Play',
  'NetEnt',
  "Play'n GO",
  'Hacksaw',
  'BGaming',
  'CryptoBet Originals',
];

// ─── Gradient generator for placeholder thumbnails ──────────────────────────
const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #f5576c 0%, #ff6a00 100%)',
  'linear-gradient(135deg, #13547a 0%, #80d0c7 100%)',
  'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
  'linear-gradient(135deg, #00c6fb 0%, #005bea 100%)',
  'linear-gradient(135deg, #d558c8 0%, #24d292 100%)',
  'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
  'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
  'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)',
];

function getGradient(index: number): string {
  return GRADIENTS[index % GRADIENTS.length];
}

// ─── Mock Game Data (40+ games) ─────────────────────────────────────────────
const MOCK_GAMES: CasinoGame[] = [
  // Slots
  { id: 's1', name: 'Starburst', provider: 'NetEnt', category: ['slots'], image: getGradient(0), isNew: false, isHot: true, isFavorite: false, rtp: 96.09 },
  { id: 's2', name: "Gonzo's Quest", provider: 'NetEnt', category: ['slots'], image: getGradient(1), isNew: false, isHot: true, isFavorite: true, rtp: 95.97 },
  { id: 's3', name: 'Gates of Olympus', provider: 'Pragmatic Play', category: ['slots'], image: getGradient(2), isNew: false, isHot: true, isFavorite: false, rtp: 96.5 },
  { id: 's4', name: 'Sweet Bonanza', provider: 'Pragmatic Play', category: ['slots'], image: getGradient(3), isNew: false, isHot: true, isFavorite: false, rtp: 96.48 },
  { id: 's5', name: 'Dead or Alive 2', provider: 'NetEnt', category: ['slots'], image: getGradient(4), isNew: false, isHot: false, isFavorite: true, rtp: 96.8 },
  { id: 's6', name: 'Wolf Gold', provider: 'Pragmatic Play', category: ['slots', 'jackpot'], image: getGradient(5), isNew: false, isHot: false, isFavorite: false, rtp: 96.01, isJackpot: true },
  { id: 's7', name: 'Sugar Rush', provider: 'Pragmatic Play', category: ['slots'], image: getGradient(6), isNew: true, isHot: true, isFavorite: false, rtp: 96.5 },
  { id: 's8', name: 'Big Bass Bonanza', provider: 'Pragmatic Play', category: ['slots'], image: getGradient(7), isNew: false, isHot: true, isFavorite: false, rtp: 96.71 },
  { id: 's9', name: 'Book of Dead', provider: "Play'n GO", category: ['slots'], image: getGradient(8), isNew: false, isHot: true, isFavorite: true, rtp: 96.21 },
  { id: 's10', name: 'Reactoonz', provider: "Play'n GO", category: ['slots'], image: getGradient(9), isNew: false, isHot: false, isFavorite: false, rtp: 96.51 },
  { id: 's11', name: 'Fire Joker', provider: "Play'n GO", category: ['slots'], image: getGradient(10), isNew: false, isHot: false, isFavorite: false, rtp: 96.15 },
  { id: 's12', name: 'Wanted Dead or a Wild', provider: 'Hacksaw', category: ['slots'], image: getGradient(11), isNew: false, isHot: true, isFavorite: false, rtp: 96.38 },
  { id: 's13', name: 'Chaos Crew', provider: 'Hacksaw', category: ['slots'], image: getGradient(12), isNew: true, isHot: false, isFavorite: false, rtp: 96.09 },
  { id: 's14', name: 'Dork Unit', provider: 'Hacksaw', category: ['slots'], image: getGradient(13), isNew: false, isHot: false, isFavorite: false, rtp: 96.28 },
  { id: 's15', name: 'Elvis Frog in Vegas', provider: 'BGaming', category: ['slots'], image: getGradient(14), isNew: false, isHot: false, isFavorite: false, rtp: 96.0 },
  { id: 's16', name: 'Aloha King Elvis', provider: 'BGaming', category: ['slots'], image: getGradient(15), isNew: true, isHot: false, isFavorite: false, rtp: 95.8 },
  { id: 's17', name: 'Fruit Party', provider: 'Pragmatic Play', category: ['slots'], image: getGradient(0), isNew: false, isHot: false, isFavorite: false, rtp: 96.47 },
  { id: 's18', name: 'The Dog House', provider: 'Pragmatic Play', category: ['slots'], image: getGradient(1), isNew: false, isHot: true, isFavorite: false, rtp: 96.51 },
  { id: 's19', name: 'Starlight Princess', provider: 'Pragmatic Play', category: ['slots'], image: getGradient(2), isNew: false, isHot: true, isFavorite: false, rtp: 96.5 },
  { id: 's20', name: 'Mental', provider: 'NetEnt', category: ['slots'], image: getGradient(3), isNew: true, isHot: false, isFavorite: false, rtp: 96.1 },
  { id: 's21', name: 'Razor Shark', provider: "Play'n GO", category: ['slots'], image: getGradient(4), isNew: false, isHot: false, isFavorite: false, rtp: 96.7 },

  // Jackpot Slots
  { id: 'j1', name: 'Mega Moolah', provider: 'NetEnt', category: ['slots', 'jackpot'], image: getGradient(5), isNew: false, isHot: true, isFavorite: false, rtp: 88.12, isJackpot: true },
  { id: 'j2', name: 'Divine Fortune', provider: 'NetEnt', category: ['slots', 'jackpot'], image: getGradient(6), isNew: false, isHot: false, isFavorite: false, rtp: 96.59, isJackpot: true },
  { id: 'j3', name: 'Jackpot King', provider: "Play'n GO", category: ['slots', 'jackpot'], image: getGradient(7), isNew: false, isHot: false, isFavorite: false, rtp: 95.0, isJackpot: true },

  // Live Casino
  { id: 'l1', name: 'Lightning Roulette', provider: 'Evolution', category: ['live-casino', 'roulette'], image: getGradient(8), isNew: false, isHot: true, isFavorite: true, rtp: 97.3 },
  { id: 'l2', name: 'Crazy Time', provider: 'Evolution', category: ['live-casino', 'game-shows'], image: getGradient(9), isNew: false, isHot: true, isFavorite: false, rtp: 96.08 },
  { id: 'l3', name: 'Monopoly Live', provider: 'Evolution', category: ['live-casino', 'game-shows'], image: getGradient(10), isNew: false, isHot: true, isFavorite: false, rtp: 96.23 },
  { id: 'l4', name: 'Blackjack VIP', provider: 'Evolution', category: ['live-casino', 'blackjack'], image: getGradient(11), isNew: false, isHot: false, isFavorite: false, rtp: 99.28 },
  { id: 'l5', name: 'Dream Catcher', provider: 'Evolution', category: ['live-casino', 'game-shows'], image: getGradient(12), isNew: false, isHot: false, isFavorite: false, rtp: 96.58 },
  { id: 'l6', name: 'Speed Baccarat', provider: 'Evolution', category: ['live-casino', 'baccarat'], image: getGradient(13), isNew: false, isHot: false, isFavorite: false, rtp: 98.94 },
  { id: 'l7', name: 'Infinite Blackjack', provider: 'Evolution', category: ['live-casino', 'blackjack'], image: getGradient(14), isNew: true, isHot: false, isFavorite: false, rtp: 99.47 },
  { id: 'l8', name: 'XXXtreme Lightning Roulette', provider: 'Evolution', category: ['live-casino', 'roulette'], image: getGradient(15), isNew: true, isHot: true, isFavorite: false, rtp: 97.1 },
  { id: 'l9', name: 'Funky Time', provider: 'Evolution', category: ['live-casino', 'game-shows'], image: getGradient(0), isNew: true, isHot: false, isFavorite: false, rtp: 95.87 },

  // Table Games
  { id: 't1', name: 'European Roulette', provider: 'NetEnt', category: ['table-games', 'roulette'], image: getGradient(1), isNew: false, isHot: false, isFavorite: false, rtp: 97.3 },
  { id: 't2', name: 'Blackjack Classic', provider: 'NetEnt', category: ['table-games', 'blackjack'], image: getGradient(2), isNew: false, isHot: false, isFavorite: false, rtp: 99.5 },
  { id: 't3', name: 'Baccarat', provider: "Play'n GO", category: ['table-games', 'baccarat'], image: getGradient(3), isNew: false, isHot: false, isFavorite: false, rtp: 98.94 },
  { id: 't4', name: 'Casino Hold\'em', provider: 'NetEnt', category: ['table-games', 'poker'], image: getGradient(4), isNew: false, isHot: false, isFavorite: false, rtp: 97.84 },
  { id: 't5', name: 'Three Card Poker', provider: "Play'n GO", category: ['table-games', 'poker'], image: getGradient(5), isNew: false, isHot: false, isFavorite: false, rtp: 96.63 },
  { id: 't6', name: 'French Roulette', provider: 'NetEnt', category: ['table-games', 'roulette'], image: getGradient(6), isNew: false, isHot: false, isFavorite: false, rtp: 98.65 },

  // Arcade
  { id: 'a1', name: 'Aviator', provider: 'Pragmatic Play', category: ['arcade', 'crash'], image: getGradient(7), isNew: false, isHot: true, isFavorite: false, rtp: 97.0 },
  { id: 'a2', name: 'Spaceman', provider: 'Pragmatic Play', category: ['arcade', 'crash'], image: getGradient(8), isNew: false, isHot: false, isFavorite: false, rtp: 96.5 },
  { id: 'a3', name: 'Hi-Lo', provider: 'BGaming', category: ['arcade'], image: getGradient(9), isNew: false, isHot: false, isFavorite: false, rtp: 98.0 },
  { id: 'a4', name: 'Keno', provider: 'BGaming', category: ['arcade'], image: getGradient(10), isNew: false, isHot: false, isFavorite: false, rtp: 95.0 },

  // CryptoBet Originals
  { id: 'o1', name: 'Crash', provider: 'CryptoBet Originals', category: ['crash', 'arcade'], image: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)', isNew: false, isHot: true, isFavorite: false, rtp: 99.0 },
  { id: 'o2', name: 'Dice', provider: 'CryptoBet Originals', category: ['arcade'], image: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', isNew: false, isHot: false, isFavorite: false, rtp: 99.0 },
  { id: 'o3', name: 'Mines', provider: 'CryptoBet Originals', category: ['arcade'], image: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', isNew: false, isHot: true, isFavorite: false, rtp: 99.0 },
  { id: 'o4', name: 'Plinko', provider: 'CryptoBet Originals', category: ['arcade'], image: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', isNew: false, isHot: false, isFavorite: false, rtp: 99.0 },
  { id: 'o5', name: 'Coinflip', provider: 'CryptoBet Originals', category: ['arcade'], image: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', isNew: true, isHot: false, isFavorite: false, rtp: 99.0 },
];

// ─── Originals Data ─────────────────────────────────────────────────────────
const ORIGINALS = [
  { id: 'o1', name: 'Crash', slug: 'crash', Icon: TrendingUp, gradient: 'from-orange-600 via-red-600 to-rose-700', description: 'Ride the multiplier' },
  { id: 'o2', name: 'Dice', slug: 'dice', Icon: Dice1, gradient: 'from-blue-600 via-indigo-600 to-blue-800', description: 'Roll to win' },
  { id: 'o3', name: 'Mines', slug: 'mines', Icon: Bomb, gradient: 'from-yellow-600 via-amber-600 to-orange-700', description: 'Avoid the mines' },
  { id: 'o4', name: 'Plinko', slug: 'plinko', Icon: CircleDot, gradient: 'from-purple-600 via-violet-600 to-purple-800', description: 'Drop and collect' },
  { id: 'o5', name: 'Coinflip', slug: 'coinflip', Icon: Coins, gradient: 'from-teal-600 via-emerald-600 to-green-700', description: 'Heads or tails' },
];

// ─── Mock Recently Played (subset) ─────────────────────────────────────────
const RECENTLY_PLAYED_IDS = ['s3', 'l2', 'o1', 's1', 'l1', 's9'];

// ─── Mock Top Winners ───────────────────────────────────────────────────────
const TOP_WINNERS: TopWin[] = [
  { id: 'w1', user: 'Sat0shi_N', game: 'Gates of Olympus', amount: '3.452', currency: 'BTC', multiplier: '4,831x', timeAgo: '2m ago' },
  { id: 'w2', user: 'CryptoKing', game: 'Sweet Bonanza', amount: '12.8', currency: 'ETH', multiplier: '2,150x', timeAgo: '5m ago' },
  { id: 'w3', user: 'Diamond_H', game: 'Crazy Time', amount: '85,200', currency: 'USDT', multiplier: '1,420x', timeAgo: '8m ago' },
  { id: 'w4', user: 'LuckyDegen', game: 'Crash', amount: '1.205', currency: 'BTC', multiplier: '312x', timeAgo: '12m ago' },
  { id: 'w5', user: 'Whale_42', game: 'Lightning Roulette', amount: '5.67', currency: 'ETH', multiplier: '500x', timeAgo: '15m ago' },
  { id: 'w6', user: 'NightOwl', game: 'Book of Dead', amount: '45,800', currency: 'USDT', multiplier: '3,720x', timeAgo: '18m ago' },
];

// ─── GameCard Component ─────────────────────────────────────────────────────
function GameCard({ game, onToggleFavorite }: { game: CasinoGame; onToggleFavorite: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/casino/${game.id}`} className="block">
        <div
          className="relative overflow-hidden rounded-xl bg-[#1A1B1F] transition-all duration-200"
          style={{
            transform: hovered ? 'scale(1.02)' : 'scale(1)',
            boxShadow: hovered ? '0 8px 30px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {/* Thumbnail */}
          <div
            className="aspect-[3/4] w-full flex items-center justify-center relative"
            style={{ background: game.image }}
          >
            <span className="text-white/20 text-[40px] font-bold select-none">
              {game.name.charAt(0)}
            </span>

            {/* Badges - top left */}
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
              {game.isNew && (
                <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded leading-tight">
                  NEW
                </span>
              )}
              {game.isHot && (
                <span className="text-[10px] font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white px-1.5 py-0.5 rounded leading-tight flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5" /> HOT
                </span>
              )}
              {game.isJackpot && (
                <span className="text-[10px] font-bold bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-1.5 py-0.5 rounded leading-tight flex items-center gap-0.5">
                  <Trophy className="w-2.5 h-2.5" /> JACKPOT
                </span>
              )}
            </div>

            {/* Favorite heart - top right */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(game.id);
              }}
              className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                game.isFavorite
                  ? 'bg-red-500/90 text-white'
                  : 'bg-black/40 text-white/50 opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${game.isFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Hover overlay with Play / Demo */}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-[5]"
                >
                  <button className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                    <Play className="w-4 h-4 fill-current" /> Play
                  </button>
                  <button className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors">
                    Demo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Info below image */}
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-bold text-white truncate leading-tight">
              {game.name}
            </p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              {game.provider}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function CasinoPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeProvider, setActiveProvider] = useState('All Providers');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(MOCK_GAMES.filter((g) => g.isFavorite).map((g) => g.id))
  );

  const tabsRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);

  // Close provider dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Games with current favorite state
  const gamesWithFavState = useMemo(
    () => MOCK_GAMES.map((g) => ({ ...g, isFavorite: favorites.has(g.id) })),
    [favorites]
  );

  // Filtered games
  const filteredGames = useMemo(() => {
    let games = gamesWithFavState;

    // Category filter
    if (activeCategory !== 'all') {
      games = games.filter((g) => g.category.includes(activeCategory));
    }

    // Provider filter
    if (activeProvider !== 'All Providers') {
      games = games.filter((g) => g.provider === activeProvider);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      games = games.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.provider.toLowerCase().includes(q)
      );
    }

    return games;
  }, [gamesWithFavState, activeCategory, activeProvider, search]);

  // Recently played games
  const recentlyPlayed = useMemo(
    () =>
      RECENTLY_PLAYED_IDS
        .map((id) => gamesWithFavState.find((g) => g.id === id))
        .filter(Boolean) as CasinoGame[],
    [gamesWithFavState]
  );

  // Scroll category tabs
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
      {/* ── Search Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Casino</h1>
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games or providers..."
            className="w-full bg-[#1A1B1F] border border-white/[0.08] rounded-xl pl-10 pr-9 py-2.5 text-[13px] text-white placeholder:text-gray-500 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category Tabs ──────────────────────────────────────────── */}
      <div className="relative mb-5">
        <button
          onClick={() => scrollTabs('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[#1A1B1F]/90 border border-white/[0.08] items-center justify-center text-gray-400 hover:text-white transition-colors backdrop-blur-sm hidden sm:flex"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div
          ref={tabsRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide px-0 sm:px-9 pb-1"
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                    : 'bg-[#1A1B1F] text-gray-400 hover:bg-[#252630] hover:text-white border border-white/[0.06]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scrollTabs('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[#1A1B1F]/90 border border-white/[0.08] items-center justify-center text-gray-400 hover:text-white transition-colors backdrop-blur-sm hidden sm:flex"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Provider Filter ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div ref={providerRef} className="relative">
          <button
            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1B1F] border border-white/[0.08] text-[13px] text-gray-300 hover:bg-[#252630] hover:text-white transition-colors"
          >
            {activeProvider}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                showProviderDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>
          {showProviderDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 top-full mt-1 w-52 bg-[#1E1F25] border border-white/[0.08] rounded-xl shadow-xl py-1 z-30"
            >
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setActiveProvider(p);
                    setShowProviderDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                    activeProvider === p
                      ? 'text-purple-400 bg-purple-500/10'
                      : 'text-gray-300 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </motion.div>
          )}
        </div>
        {/* Active filter pills */}
        {activeProvider !== 'All Providers' && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 text-purple-400 text-[12px] font-medium">
            {activeProvider}
            <button onClick={() => setActiveProvider('All Providers')}>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

      {/* ── Featured Game Banner ───────────────────────────────────── */}
      <section className="mb-8">
        <Link href="/casino/s3" className="block">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 p-6 sm:p-8 hover:shadow-xl hover:shadow-purple-900/20 transition-shadow">
            {/* Background decorative elements */}
            <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-purple-500/10 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl" />
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
              <span className="text-[10px] font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-1 rounded-full flex items-center gap-1">
                <Flame className="w-3 h-3" /> FEATURED
              </span>
            </div>
            <div className="relative z-10 max-w-xl">
              <p className="text-purple-300 text-[12px] font-semibold uppercase tracking-wider mb-1">
                Pragmatic Play
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Gates of Olympus
              </h2>
              <p className="text-gray-300 text-[14px] leading-relaxed mb-4 max-w-md">
                Unleash the power of Zeus with multipliers up to 500x. Tumbling reels, free spins, and massive win potential await.
              </p>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[11px] bg-white/10 text-gray-300 px-2.5 py-1 rounded-lg font-mono">
                  RTP 96.5%
                </span>
                <span className="text-[11px] bg-white/10 text-gray-300 px-2.5 py-1 rounded-lg">
                  Max Win 5,000x
                </span>
                <span className="flex items-center gap-1 text-[11px] bg-yellow-500/15 text-yellow-400 px-2.5 py-1 rounded-lg">
                  <Star className="w-3 h-3 fill-current" /> 4.8
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-[14px]">
                  <Play className="w-4 h-4 fill-current" /> Play Now
                </button>
                <button className="bg-white/10 hover:bg-white/15 text-white/70 hover:text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-[14px]">
                  Try Demo
                </button>
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* ── CryptoBet Originals Section ────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <ShieldCheck className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-white">CryptoBet Originals</h2>
          <span className="inline-flex items-center gap-1 text-[10px] bg-purple-500/20 text-purple-400 px-2.5 py-0.5 rounded-full font-semibold">
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
                href={`/casino/${game.id}`}
                className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${game.gradient} p-5 sm:p-6 hover:scale-[1.03] transition-all duration-300 hover:shadow-lg hover:shadow-black/30`}
              >
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
                <div className="absolute top-2 right-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-white/40" />
                </div>
                <div className="relative z-10 flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                    <GameIcon className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold text-[15px] text-white">{game.name}</span>
                  <span className="text-[11px] text-white/60">{game.description}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Recently Played (if logged in) ─────────────────────────── */}
      {isAuthenticated && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Recently Played</h2>
            <Link
              href="/casino?filter=recent"
              className="text-[13px] text-purple-400 hover:text-purple-300 transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recentlyPlayed.map((game) => (
              <GameCard key={game.id} game={game} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        </section>
      )}

      {/* ── Top Winners ────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold text-white">Top Winners</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOP_WINNERS.map((win) => (
            <div
              key={win.id}
              className="flex items-center gap-3 bg-[#1A1B1F] border border-white/[0.06] rounded-xl p-3.5 hover:border-white/[0.12] transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white truncate">
                    {win.user}
                  </span>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">
                    {win.timeAgo}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 truncate">{win.game}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[13px] font-bold text-emerald-400">
                    {win.amount} {win.currency}
                  </span>
                  <span className="text-[10px] text-yellow-400/70 font-mono">
                    {win.multiplier}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Game Grid ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {activeCategory === 'all' ? 'All Games' : CATEGORIES.find((c) => c.key === activeCategory)?.label || 'Games'}
            <span className="text-[13px] text-gray-500 font-normal ml-2">
              ({filteredGames.length})
            </span>
          </h2>
        </div>

        {filteredGames.length === 0 ? (
          <div className="text-center py-20">
            <Gamepad2 className="w-14 h-14 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-base font-medium">No games found</p>
            <p className="text-[13px] text-gray-500 mt-1">
              Try a different search, category, or provider
            </p>
            <button
              onClick={() => {
                setSearch('');
                setActiveProvider('All Providers');
                setActiveCategory('all');
              }}
              className="mt-4 text-purple-400 text-[13px] hover:text-purple-300 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          >
            <AnimatePresence mode="popLayout">
              {filteredGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}
