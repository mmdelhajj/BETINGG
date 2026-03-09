'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Minus,
  Plus,
  Shield,
  History,
  ChevronDown,
  Package,
  Star,
  Sparkles,
  Trophy,
  Gift,
  Volume2,
  VolumeX,
  RotateCcw,
  Zap,
  Home,
  Info,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CaseItem {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  multiplier: number;
  color: string;
  icon: string;
}

interface CaseType {
  slug: 'basic' | 'premium' | 'legendary';
  name: string;
  description: string;
  price: number;
  color: string;
  icon: React.ReactNode;
  items: CaseItem[];
}

interface CaseApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    caseType: string;
    wonItem: CaseItem;
    isWin: boolean;
    reelItems: CaseItem[];
    winIndex: number;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface OpeningHistoryEntry {
  id: string;
  caseType: string;
  item: CaseItem;
  payout: number;
  profit: number;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];

const RARITY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  common: { bg: 'bg-[#6B7280]/10', border: 'border-[#6B7280]/30', text: 'text-[#9CA3AF]', glow: '0 0 20px rgba(107, 114, 128, 0.3)' },
  rare: { bg: 'bg-[#3B82F6]/10', border: 'border-[#3B82F6]/30', text: 'text-[#60A5FA]', glow: '0 0 20px rgba(59, 130, 246, 0.3)' },
  epic: { bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/30', text: 'text-[#A78BFA]', glow: '0 0 20px rgba(139, 92, 246, 0.3)' },
  legendary: { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/30', text: 'text-[#FBBF24]', glow: '0 0 30px rgba(245, 158, 11, 0.4)' },
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

const BASIC_ITEMS: CaseItem[] = [
  { id: 'b1', name: 'Bronze Coin', rarity: 'common', multiplier: 0.1, color: '#6B7280', icon: '\u{1FA99}' },
  { id: 'b2', name: 'Small Gem', rarity: 'common', multiplier: 0.2, color: '#6B7280', icon: '\u{1F48E}' },
  { id: 'b3', name: 'Silver Token', rarity: 'common', multiplier: 0.3, color: '#6B7280', icon: '\u{1F948}' },
  { id: 'b4', name: 'Lucky Charm', rarity: 'common', multiplier: 0.5, color: '#6B7280', icon: '\u{1F340}' },
  { id: 'b5', name: 'Blue Crystal', rarity: 'rare', multiplier: 1.5, color: '#3B82F6', icon: '\u{1F52E}' },
  { id: 'b6', name: 'Sapphire Ring', rarity: 'rare', multiplier: 2.0, color: '#3B82F6', icon: '\u{1F48D}' },
  { id: 'b7', name: 'Amethyst Blade', rarity: 'epic', multiplier: 5.0, color: '#8B5CF6', icon: '\u{2694}\u{FE0F}' },
  { id: 'b8', name: 'Golden Nugget', rarity: 'legendary', multiplier: 15.0, color: '#F59E0B', icon: '\u{1F451}' },
];

const PREMIUM_ITEMS: CaseItem[] = [
  { id: 'p1', name: 'Silver Bar', rarity: 'common', multiplier: 0.3, color: '#6B7280', icon: '\u{1F948}' },
  { id: 'p2', name: 'Emerald Shard', rarity: 'common', multiplier: 0.5, color: '#6B7280', icon: '\u{1F49A}' },
  { id: 'p3', name: 'Ruby Pendant', rarity: 'rare', multiplier: 1.0, color: '#3B82F6', icon: '\u{2764}\u{FE0F}' },
  { id: 'p4', name: 'Diamond Dust', rarity: 'rare', multiplier: 2.0, color: '#3B82F6', icon: '\u{2728}' },
  { id: 'p5', name: 'Phoenix Feather', rarity: 'rare', multiplier: 3.0, color: '#3B82F6', icon: '\u{1FAB6}' },
  { id: 'p6', name: 'Dragon Scale', rarity: 'epic', multiplier: 7.0, color: '#8B5CF6', icon: '\u{1F409}' },
  { id: 'p7', name: 'Star Fragment', rarity: 'epic', multiplier: 12.0, color: '#8B5CF6', icon: '\u{2B50}' },
  { id: 'p8', name: 'Infinity Stone', rarity: 'legendary', multiplier: 30.0, color: '#F59E0B', icon: '\u{1F49C}' },
];

const LEGENDARY_ITEMS: CaseItem[] = [
  { id: 'l1', name: 'Gold Ingot', rarity: 'common', multiplier: 0.5, color: '#6B7280', icon: '\u{1F3C5}' },
  { id: 'l2', name: 'Platinum Coin', rarity: 'rare', multiplier: 1.5, color: '#3B82F6', icon: '\u{1FA99}' },
  { id: 'l3', name: 'Crystal Skull', rarity: 'rare', multiplier: 3.0, color: '#3B82F6', icon: '\u{1F480}' },
  { id: 'l4', name: 'Enchanted Sword', rarity: 'epic', multiplier: 5.0, color: '#8B5CF6', icon: '\u{1F5E1}\u{FE0F}' },
  { id: 'l5', name: 'Magic Orb', rarity: 'epic', multiplier: 10.0, color: '#8B5CF6', icon: '\u{1F52E}' },
  { id: 'l6', name: 'Mystic Crown', rarity: 'epic', multiplier: 15.0, color: '#8B5CF6', icon: '\u{1F451}' },
  { id: 'l7', name: 'Celestial Armor', rarity: 'legendary', multiplier: 50.0, color: '#F59E0B', icon: '\u{1F6E1}\u{FE0F}' },
  { id: 'l8', name: 'Universe Key', rarity: 'legendary', multiplier: 100.0, color: '#F59E0B', icon: '\u{1F511}' },
];

const CASE_TYPES: CaseType[] = [
  { slug: 'basic', name: 'Basic', description: 'Common & rare', price: 0.001, color: '#6B7280', icon: <Package className="w-5 h-5" />, items: BASIC_ITEMS },
  { slug: 'premium', name: 'Premium', description: 'Better epics', price: 0.01, color: '#8B5CF6', icon: <Star className="w-5 h-5" />, items: PREMIUM_ITEMS },
  { slug: 'legendary', name: 'Legendary', description: 'Legendary chance', price: 0.1, color: '#F59E0B', icon: <Trophy className="w-5 h-5" />, items: LEGENDARY_ITEMS },
];

// ---------------------------------------------------------------------------
// Confetti Component
// ---------------------------------------------------------------------------

function Confetti({ active }: { active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1.5,
        color: ['#C8FF00', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'][Math.floor(Math.random() * 6)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
      })),
    []
  );

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}%`, y: '-10%', rotate: 0, opacity: 1 }}
          animate={{ y: '110%', rotate: p.rotation + 360, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reel Component
// ---------------------------------------------------------------------------

function CaseReel({
  items,
  isSpinning,
  winIndex,
  onSpinComplete,
}: {
  items: CaseItem[];
  isSpinning: boolean;
  winIndex: number;
  onSpinComplete: () => void;
}) {
  const reelRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const itemWidth = 100;
  const gap = 6;
  const totalItemWidth = itemWidth + gap;
  const containerCenter = typeof window !== 'undefined' ? Math.min(window.innerWidth - 32, 500) / 2 : 250;

  useEffect(() => {
    if (!isSpinning) {
      setOffset(0);
      return;
    }

    const targetOffset = winIndex * totalItemWidth - containerCenter + itemWidth / 2;
    const duration = 4000;
    const startTime = performance.now();
    const startOffset = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const extraSpins = items.length * totalItemWidth * 2;
      const currentOffset = startOffset + (targetOffset + extraSpins) * eased;

      setOffset(currentOffset);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setOffset(targetOffset + extraSpins);
        setTimeout(onSpinComplete, 300);
      }
    };

    requestAnimationFrame(animate);
  }, [isSpinning, winIndex, totalItemWidth, containerCenter, items.length, onSpinComplete]);

  return (
    <div className="relative">
      {/* Pointer arrow -- lime */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 -mt-1">
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-[#C8FF00]" />
      </div>

      {/* Gradient overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#161B22] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#161B22] to-transparent z-10 pointer-events-none" />

      {/* Reel container */}
      <div className="overflow-hidden rounded-lg border border-[#30363D] bg-[#0D1117] py-3">
        <div
          ref={reelRef}
          className="flex gap-1.5 transition-none"
          style={{
            transform: `translateX(${-offset}px)`,
            paddingLeft: containerCenter - itemWidth / 2,
          }}
        >
          {items.map((item, index) => {
            const rarityStyle = RARITY_COLORS[item.rarity];
            return (
              <div
                key={`${item.id}-${index}`}
                className={cn(
                  'flex-shrink-0 w-[100px] h-[110px] rounded-lg border flex flex-col items-center justify-center gap-1 transition-all duration-300',
                  rarityStyle.bg,
                  rarityStyle.border
                )}
                style={{
                  boxShadow: !isSpinning && index === winIndex ? rarityStyle.glow : 'none',
                }}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className={cn('text-[8px] font-medium text-center px-1 leading-tight', rarityStyle.text)}>
                  {item.name}
                </span>
                <span className={cn('text-[10px] font-mono font-bold', rarityStyle.text)}>
                  {item.multiplier}x
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#C8FF00]/40 z-10 pointer-events-none" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CaseOpeningPage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [selectedCase, setSelectedCase] = useState<CaseType>(CASE_TYPES[0]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [winIndex, setWinIndex] = useState(0);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [showContents, setShowContents] = useState(false);
  const [lastFairness, setLastFairness] = useState<CaseApiResponse['fairness'] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // History
  const [openingHistory, setOpeningHistory] = useState<OpeningHistoryEntry[]>([]);

  // Refs
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Balance
  const balance = useMemo(() => {
    if (!user?.balances) return 0;
    const b = user.balances.find((bal) => bal.currency === currency);
    return b?.available ?? 0;
  }, [user, currency]);

  // Generate reel items for display
  const generateReelItems = useCallback((items: CaseItem[], winItem: CaseItem, count: number = 60): { reel: CaseItem[]; index: number } => {
    const reel: CaseItem[] = [];
    for (let i = 0; i < count; i++) {
      const randomItem = items[Math.floor(Math.random() * items.length)];
      reel.push({ ...randomItem, id: `reel-${i}-${randomItem.id}` });
    }
    const winPosition = count - 8;
    reel[winPosition] = { ...winItem, id: `reel-win-${winItem.id}` };
    return { reel, index: winPosition };
  }, []);

  // Open case
  const openCase = useCallback(async () => {
    if (isSpinning || isLoading) return;

    const price = selectedCase.price;
    if (price > balance) {
      setErrorMessage('Insufficient balance');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setShowResult(false);
    setWonItem(null);
    setShowConfetti(false);

    try {
      const response = await post<CaseApiResponse>('/casino/games/caseopening/play', {
        amount: price,
        currency,
        options: { caseType: selectedCase.slug },
      });

      useAuthStore.getState().updateBalance(currency, response.newBalance, 0);

      const winItem = response.result.wonItem;
      let reelData: CaseItem[];
      let winIdx: number;

      if (response.result.reelItems && response.result.reelItems.length > 0) {
        reelData = response.result.reelItems;
        winIdx = response.result.winIndex;
      } else {
        const generated = generateReelItems(selectedCase.items, winItem);
        reelData = generated.reel;
        winIdx = generated.index;
      }

      setReelItems(reelData);
      setWinIndex(winIdx);
      setIsSpinning(true);
      setLastFairness(response.fairness);
      setWonItem(winItem);

      const payoutAmt = response.payout ?? (winItem.multiplier ?? 0) * price;
      const profitAmt = response.profit ?? (payoutAmt - price);

      setOpeningHistory((prev) => [
        { id: response.roundId, caseType: selectedCase.slug, item: winItem, payout: payoutAmt, profit: profitAmt, timestamp: new Date() },
        ...prev.slice(0, 49),
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to open case');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCase, balance, currency, isSpinning, isLoading, generateReelItems]);

  // Handle spin complete
  const handleSpinComplete = useCallback(() => {
    setIsSpinning(false);
    setShowResult(true);

    if (wonItem) {
      const isRare = wonItem.rarity === 'epic' || wonItem.rarity === 'legendary';
      if (isRare) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    }
  }, [wonItem]);

  // Stats
  const stats = useMemo(() => {
    const totalOpened = openingHistory.length;
    const totalProfit = openingHistory.reduce((acc, h) => acc + (h.profit ?? 0), 0);
    const bestItem = openingHistory.reduce<OpeningHistoryEntry | null>(
      (best, h) => (!best || h.payout > best.payout ? h : best),
      null
    );
    return { totalOpened, totalProfit, bestItem };
  }, [openingHistory]);

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Case Type Selector -- compact 3 col grid */}
        <div className="grid grid-cols-3 gap-2">
          {CASE_TYPES.map((ct) => (
            <button
              key={ct.slug}
              onClick={() => { if (!isSpinning) setSelectedCase(ct); }}
              className={cn(
                'relative flex flex-col items-center p-2.5 rounded-xl border transition-all',
                selectedCase.slug === ct.slug
                  ? 'bg-[#C8FF00]/5 border-[#C8FF00]/40'
                  : 'bg-[#161B22] border-[#30363D] hover:border-[#8B949E]'
              )}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-1"
                style={{ backgroundColor: `${ct.color}20`, color: ct.color }}
              >
                {ct.icon}
              </div>
              <span className="text-[11px] font-bold text-white">{ct.name}</span>
              <span className="text-[8px] text-[#8B949E] mt-0.5">{ct.description}</span>
              <div className="mt-1 px-2 py-0.5 rounded bg-[#0D1117]">
                <span className="text-[10px] font-mono text-[#8B949E]">
                  {ct.price} {currency}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Reel Area */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 relative overflow-hidden">
          <Confetti active={showConfetti} />

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C8FF00]" />
              {selectedCase.name}
            </h2>
            <button
              onClick={() => setShowContents(!showContents)}
              className="text-[9px] text-[#8B949E] hover:text-white transition-colors"
            >
              {showContents ? 'Hide contents' : 'View contents'}
            </button>
          </div>

          {/* Case contents grid */}
          <AnimatePresence>
            {showContents && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="grid grid-cols-4 gap-1.5">
                  {selectedCase.items.map((item) => {
                    const rarityStyle = RARITY_COLORS[item.rarity];
                    return (
                      <div
                        key={item.id}
                        className={cn('flex flex-col items-center p-1.5 rounded-lg border', rarityStyle.bg, rarityStyle.border)}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span className={cn('text-[7px] mt-0.5 text-center', rarityStyle.text)}>{item.name}</span>
                        <span className={cn('text-[9px] font-mono font-bold', rarityStyle.text)}>{item.multiplier}x</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spinning reel */}
          {reelItems.length > 0 ? (
            <CaseReel
              items={reelItems}
              isSpinning={isSpinning}
              winIndex={winIndex}
              onSpinComplete={handleSpinComplete}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#30363D] bg-[#0D1117] py-3">
              <div className="flex gap-1.5 justify-center">
                {selectedCase.items.slice(0, 4).map((item, i) => {
                  const rarityStyle = RARITY_COLORS[item.rarity];
                  return (
                    <div
                      key={`placeholder-${i}`}
                      className={cn(
                        'flex-shrink-0 w-[80px] h-[100px] rounded-lg border flex flex-col items-center justify-center gap-1 opacity-30',
                        rarityStyle.bg, rarityStyle.border
                      )}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className={cn('text-[8px] font-medium', rarityStyle.text)}>{item.name}</span>
                      <span className={cn('text-[10px] font-mono font-bold', rarityStyle.text)}>{item.multiplier}x</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-center mt-2 text-[10px] text-[#8B949E]">
                Open a case to spin the reel!
              </div>
            </div>
          )}

          {/* Win result overlay */}
          <AnimatePresence>
            {showResult && wonItem && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="mt-3 flex flex-col items-center"
              >
                <div className="text-[10px] text-[#8B949E] mb-1.5">You won!</div>
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className={cn(
                    'flex flex-col items-center p-4 rounded-xl border',
                    RARITY_COLORS[wonItem.rarity].bg,
                    RARITY_COLORS[wonItem.rarity].border
                  )}
                  style={{ boxShadow: RARITY_COLORS[wonItem.rarity].glow }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-4xl mb-2"
                  >
                    {wonItem.icon}
                  </motion.span>
                  <span className={cn('text-sm font-bold', RARITY_COLORS[wonItem.rarity].text)}>
                    {wonItem.name}
                  </span>
                  <span className={cn('text-[9px] uppercase tracking-wider mt-0.5', RARITY_COLORS[wonItem.rarity].text)}>
                    {RARITY_LABELS[wonItem.rarity]}
                  </span>
                  <span className={cn('text-xl font-mono font-black mt-1', RARITY_COLORS[wonItem.rarity].text)}>
                    {wonItem.multiplier}x
                  </span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Open Case Button -- lime CTA */}
        <div className="space-y-2">
          {!isAuthenticated ? (
            <Link href="/login">
              <button className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base">
                Login to Play
              </button>
            </Link>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={openCase}
              disabled={isSpinning || isLoading}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-base transition-all',
                isSpinning || isLoading
                  ? 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                  : 'bg-[#C8FF00] text-black'
              )}
            >
              {isSpinning ? (
                <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  Opening...
                </motion.span>
              ) : isLoading ? (
                'Loading...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Gift className="w-5 h-5" />
                  OPEN CASE - {selectedCase.price} {currency}
                </span>
              )}
            </motion.button>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs flex items-center justify-between"
            >
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-[#EF4444]/70 hover:text-[#EF4444]">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session Stats */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-base font-mono font-bold text-white">{stats.totalOpened}</div>
              <div className="text-[9px] text-[#8B949E]">Cases Opened</div>
            </div>
            <div>
              <div className={cn('text-base font-mono font-bold', stats.totalProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(4)}
              </div>
              <div className="text-[9px] text-[#8B949E]">Total Profit</div>
            </div>
          </div>
          {stats.bestItem && (
            <div className="mt-2 pt-2 border-t border-[#30363D]">
              <div className="text-[9px] text-[#8B949E]">Best Item</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm">{stats.bestItem.item.icon}</span>
                <span className={cn('text-[10px] font-medium', RARITY_COLORS[stats.bestItem.item.rarity].text)}>
                  {stats.bestItem.item.name} ({stats.bestItem.item.multiplier}x)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
                <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-[#C8FF00]" />
                  Recent Openings
                </h3>
                {openingHistory.length === 0 ? (
                  <p className="text-[10px] text-[#8B949E] text-center py-4">No cases opened yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {openingHistory.map((entry) => {
                      const rarityStyle = RARITY_COLORS[entry.item.rarity];
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0D1117] border border-[#21262D]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{entry.item.icon}</span>
                            <div>
                              <span className={cn('text-[10px] font-medium', rarityStyle.text)}>
                                {entry.item.name}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={cn('text-[8px] px-1 py-0.5 rounded', rarityStyle.bg, rarityStyle.text)}>
                                  {RARITY_LABELS[entry.item.rarity]}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-mono text-[#8B949E]">{entry.item.multiplier}x</div>
                            <div className={cn('text-[10px] font-mono font-bold', (entry.profit ?? 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                              {(entry.profit ?? 0) >= 0 ? '+' : ''}{(entry.profit ?? 0).toFixed(4)}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fairness */}
        <AnimatePresence>
          {showFairness && lastFairness && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
                <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  Provably Fair
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-[9px] text-[#8B949E] uppercase tracking-wider">Server Seed Hash</span>
                    <p className="text-[10px] font-mono text-[#8B949E] break-all bg-[#0D1117] rounded px-2 py-1 mt-0.5">
                      {lastFairness.serverSeedHash}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B949E] uppercase tracking-wider">Client Seed</span>
                    <p className="text-[10px] font-mono text-[#8B949E] break-all bg-[#0D1117] rounded px-2 py-1 mt-0.5">
                      {lastFairness.clientSeed}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8B949E] uppercase tracking-wider">Nonce</span>
                    <p className="text-[10px] font-mono text-[#8B949E] bg-[#0D1117] rounded px-2 py-1 mt-0.5">
                      {lastFairness.nonce}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/casino">
            <Home className="w-6 h-6 text-[#8B949E]" />
          </Link>
          <button onClick={() => setShowHistory(!showHistory)}>
            <Info className="w-6 h-6 text-[#8B949E]" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="w-6 h-6 text-[#8B949E]" /> : <VolumeX className="w-6 h-6 text-[#8B949E]" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {balance.toFixed(4)} {currency}
        </span>
        <button
          onClick={() => setShowFairness(!showFairness)}
          className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 text-xs text-[#8B5CF6]"
        >
          Provably Fair Game
        </button>
      </div>
    </div>
  );
}
