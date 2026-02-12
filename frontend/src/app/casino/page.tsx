'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Heart,
  Play,
  ChevronDown,
  X,
  Gamepad2,
} from 'lucide-react';

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


// ─── GameCard Component ─────────────────────────────────────────────────────
function GameCard({ game, onToggleFavorite }: { game: CasinoGame; onToggleFavorite: (id: string) => void }) {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div className="relative group">
      <Link href={`/casino/${game.id}`} className="block">
        <div
          className="relative overflow-hidden rounded-xl bg-[#1A1B1F] border border-transparent hover:border-[#8D52DA] transition-all duration-200"
          style={{ transform: showOverlay ? 'scale(1.02)' : 'scale(1)' }}
          onClick={(e) => {
            if (window.innerWidth < 768 && !showOverlay) {
              e.preventDefault();
              setShowOverlay(true);
              setTimeout(() => setShowOverlay(false), 3000);
            }
          }}
        >
          {/* Thumbnail */}
          <div
            className="aspect-[3/4] w-full flex items-center justify-center relative bg-[#222328]"
            style={{ background: game.image }}
          >
            <span className="text-white/20 text-3xl md:text-4xl font-bold select-none">
              {game.name.charAt(0)}
            </span>

            {/* Badges - top left */}
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
              {game.isNew && (
                <span className="text-[9px] font-bold uppercase bg-[#10b981] text-white px-1.5 py-0.5 rounded leading-none">
                  NEW
                </span>
              )}
              {game.isHot && (
                <span className="text-[9px] font-bold uppercase bg-[#ef4444] text-white px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5">
                  HOT
                </span>
              )}
              {game.isJackpot && (
                <span className="text-[9px] font-bold uppercase bg-[#8D52DA] text-white px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5">
                  POPULAR
                </span>
              )}
            </div>

            {/* Favorite heart */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(game.id);
              }}
              className={`absolute top-1.5 right-1.5 z-10 w-8 h-8 md:w-7 md:h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                game.isFavorite
                  ? 'bg-red-500/90 text-white'
                  : 'bg-black/40 text-white/70 md:opacity-0 md:group-hover:opacity-100 hover:bg-black/60 hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 md:w-3.5 md:h-3.5 ${game.isFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Play overlay */}
            <div
              className={`absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-[5] transition-opacity duration-200 ${
                showOverlay ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100 pointer-events-none md:group-hover:pointer-events-auto'
              }`}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/casino/${game.id}`;
                }}
                className="flex items-center gap-1.5 bg-[#8D52DA] hover:bg-[#7B45C3] text-white text-sm font-bold px-5 py-2.5 rounded transition-colors"
              >
                <Play className="w-4 h-4 fill-current" /> Play Now
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-4 py-2 rounded transition-colors"
              >
                Demo
              </button>
            </div>
          </div>

          {/* Info below image */}
          <div className="px-2 py-2">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">
              {game.name}
            </p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              {game.provider}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function CasinoPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeProvider, setActiveProvider] = useState('All Providers');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [displayCount, setDisplayCount] = useState(30);
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(MOCK_GAMES.filter((g) => g.isFavorite).map((g) => g.id))
  );

  const tabsRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const gamesWithFavState = useMemo(
    () => MOCK_GAMES.map((g) => ({ ...g, isFavorite: favorites.has(g.id) })),
    [favorites]
  );

  const filteredGames = useMemo(() => {
    let games = gamesWithFavState;

    if (activeCategory !== 'all') {
      games = games.filter((g) => g.category.includes(activeCategory));
    }

    if (activeProvider !== 'All Providers') {
      games = games.filter((g) => g.provider === activeProvider);
    }

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

  const displayedGames = useMemo(() => {
    return filteredGames.slice(0, displayCount);
  }, [filteredGames, displayCount]);

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + 30);
  };

  return (
    <div className="min-h-screen bg-[#0F0F12] pb-20">
      <div className="mx-auto max-w-7xl px-4 py-4">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games..."
              className="w-full h-10 bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-10 text-base text-white placeholder:text-gray-500 outline-none focus:border-[#8D52DA] transition-all"
              style={{ fontSize: '16px', borderRadius: '4px' }}
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

        {/* Category Tabs */}
        <div className="mb-4">
          <div
            ref={tabsRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  style={{ borderRadius: '4px' }}
                  className={`h-10 px-4 text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-[#8D52DA] text-white'
                      : 'bg-[#222328] text-[rgba(224,232,255,0.6)] hover:bg-[#2A2B30] hover:text-white border border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider Filter */}
        <div className="flex items-center gap-2 mb-4">
          <div ref={providerRef} className="relative">
            <button
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              style={{ borderRadius: '4px' }}
              className="flex items-center gap-2 h-10 px-4 bg-[#222328] border border-[rgba(255,255,255,0.06)] text-sm text-[rgba(224,232,255,0.6)] hover:bg-[#2A2B30] hover:text-white transition-colors"
            >
              <span className="text-sm">{activeProvider}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showProviderDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>
            {showProviderDropdown && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded shadow-2xl py-1 z-50 max-h-80 overflow-y-auto">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setActiveProvider(p);
                      setShowProviderDropdown(false);
                    }}
                    className={`w-full text-left h-10 px-4 text-sm transition-colors ${
                      activeProvider === p
                        ? 'text-[#8D52DA] bg-[rgba(141,82,218,0.1)]'
                        : 'text-[rgba(224,232,255,0.6)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeProvider !== 'All Providers' && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(141,82,218,0.15)] text-[#8D52DA] text-xs font-medium">
              {activeProvider}
              <button
                onClick={() => setActiveProvider('All Providers')}
                className="hover:text-[#B47EFF]"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {/* Game Grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">
              {activeCategory === 'all' ? 'All Games' : CATEGORIES.find((c) => c.key === activeCategory)?.label || 'Games'}
              <span className="text-sm text-[rgba(224,232,255,0.3)] font-normal ml-2">
                ({filteredGames.length})
              </span>
            </h2>
          </div>

          {filteredGames.length === 0 ? (
            <div className="text-center py-20">
              <Gamepad2 className="w-14 h-14 text-gray-700 mx-auto mb-3" />
              <p className="text-[rgba(224,232,255,0.6)] text-base font-medium">No games found</p>
              <p className="text-sm text-[rgba(224,232,255,0.3)] mt-1">
                Try a different search, category, or provider
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setActiveProvider('All Providers');
                  setActiveCategory('all');
                }}
                className="mt-4 text-[#8D52DA] text-sm hover:text-[#B47EFF] transition-colors font-medium"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
                {displayedGames.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>

              {displayCount < filteredGames.length && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={handleLoadMore}
                    style={{ borderRadius: '4px' }}
                    className="flex items-center justify-center gap-2 h-10 bg-[#222328] hover:bg-[#2A2B30] border border-[rgba(255,255,255,0.06)] text-white font-semibold px-6 transition-all"
                  >
                    Load More Games
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
