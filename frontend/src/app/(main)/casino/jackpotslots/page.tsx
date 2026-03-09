'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Star,
  Zap,
  History,
  ShieldCheck,
  Volume2,
  VolumeX,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  ChevronLeft,
  Play,
  Pause,
  Settings,
  Info,
  TrendingUp,
  Gem,
  Home,
  ChevronDown,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlotSymbol {
  id: string;
  name: string;
  emoji: string;
  color: string;
  value: number;
}

interface JackpotSlotApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    grid: string[][];
    winLines: { line: number; symbols: string[]; payout: number }[];
    totalWin: number;
    isJackpot: boolean;
    jackpotTier?: 'mini' | 'major' | 'grand';
    jackpotAmount?: number;
    isWin: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface GameRound {
  id: string;
  grid: string[][];
  won: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  isJackpot: boolean;
  jackpotTier?: string;
  timestamp: Date;
  fairness?: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYMBOLS: SlotSymbol[] = [
  { id: 'seven', name: '7s', emoji: '7\uFE0F\u20E3', color: '#EF4444', value: 100 },
  { id: 'bar', name: 'Bars', emoji: '\uD83C\uDFB0', color: '#F59E0B', value: 75 },
  { id: 'cherry', name: 'Cherries', emoji: '\uD83C\uDF52', color: '#EF4444', value: 50 },
  { id: 'diamond', name: 'Diamonds', emoji: '\uD83D\uDC8E', color: '#3B82F6', value: 40 },
  { id: 'bell', name: 'Bells', emoji: '\uD83D\uDD14', color: '#F59E0B', value: 30 },
  { id: 'star', name: 'Stars', emoji: '\u2B50', color: '#EAB308', value: 25 },
  { id: 'wild', name: 'Wild', emoji: '\uD83C\uDF1F', color: '#FFD700', value: 150 },
  { id: 'jackpot', name: 'Jackpot', emoji: '\uD83D\uDC51', color: '#FFD700', value: 500 },
];

const SYMBOL_MAP: Record<string, SlotSymbol> = {};
SYMBOLS.forEach((s) => { SYMBOL_MAP[s.id] = s; });

const REELS = 5;
const ROWS = 3;

const DEFAULT_GRID: string[][] = Array.from({ length: REELS }, () =>
  Array.from({ length: ROWS }, (_, i) => SYMBOLS[i % SYMBOLS.length].id)
);

const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
];

const BET_PRESETS = [0.01, 0.1, 1, 10, 100];

// ---------------------------------------------------------------------------
// Sparkle particle component
// ---------------------------------------------------------------------------

function SparkleParticle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-yellow-400"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: [0, -20, -40] }}
      transition={{ duration: 1.5, delay, repeat: Infinity, repeatDelay: 2 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Reel column component
// ---------------------------------------------------------------------------

function ReelColumn({
  symbols, spinning, reelIndex, winningRows,
}: {
  symbols: string[];
  spinning: boolean;
  reelIndex: number;
  winningRows: Set<number>;
}) {
  const spinDuration = 0.3 + reelIndex * 0.15;
  const extraSymbols = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length].id);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-[#0D1117] border border-[#30363D]">
      <AnimatePresence mode="wait">
        {spinning ? (
          <motion.div
            key={`spinning-${reelIndex}`}
            className="flex flex-col items-center"
            animate={{ y: [0, -800] }}
            transition={{ duration: spinDuration, repeat: Infinity, ease: 'linear' }}
          >
            {[...extraSymbols, ...symbols].map((symId, idx) => {
              const sym = SYMBOL_MAP[symId] || SYMBOLS[0];
              return (
                <div key={idx} className="flex items-center justify-center h-14 sm:h-16 w-full text-2xl sm:text-3xl">
                  <span className="drop-shadow-lg">{sym.emoji}</span>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key={`stopped-${reelIndex}-${symbols.join('-')}`}
            className="flex flex-col items-center"
            initial={{ y: -60 }}
            animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: reelIndex * 0.1 }}
          >
            {symbols.map((symId, rowIdx) => {
              const sym = SYMBOL_MAP[symId] || SYMBOLS[0];
              const isWin = winningRows.has(rowIdx);
              return (
                <motion.div
                  key={rowIdx}
                  className={cn(
                    'flex items-center justify-center h-14 sm:h-16 w-full text-2xl sm:text-3xl relative',
                    isWin && 'bg-[#C8FF00]/10'
                  )}
                  animate={isWin ? { scale: [1, 1.15, 1] } : {}}
                  transition={isWin ? { duration: 0.5, repeat: Infinity } : {}}
                >
                  <span className={cn('drop-shadow-lg', isWin && 'drop-shadow-[0_0_8px_rgba(200,255,0,0.8)]')}>
                    {sym.emoji}
                  </span>
                  {isWin && (
                    <motion.div
                      className="absolute inset-0 border-2 border-[#C8FF00] rounded"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Jackpot counter component
// ---------------------------------------------------------------------------

function JackpotCounter({
  label, amount, color, icon,
}: {
  label: string;
  amount: number;
  color: string;
  icon: React.ReactNode;
}) {
  const [displayed, setDisplayed] = useState(amount);
  const prevRef = useRef(amount);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = amount;
    if (amount === prev) return;
    const diff = amount - prev;
    const steps = 30;
    const stepVal = diff / steps;
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      setDisplayed((d) => d + stepVal);
      if (frame >= steps) { clearInterval(id); setDisplayed(amount); }
    }, 30);
    return () => clearInterval(id);
  }, [amount]);

  return (
    <motion.div
      className="flex flex-col items-center gap-0.5 p-2 rounded-xl border relative overflow-hidden bg-[#161B22]"
      style={{ borderColor: color + '40' }}
    >
      <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(ellipse at center, ${color}, transparent 70%)` }} />
      <div className="flex items-center gap-1 relative z-10">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
      </div>
      <span className="text-sm sm:text-base font-mono font-bold relative z-10" style={{ color }}>
        ${displayed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function JackpotSlotsPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [currency, setCurrency] = useState('USDT');
  const [betPerLine, setBetPerLine] = useState('0.10');
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState<string[][]>(DEFAULT_GRID);
  const [winLines, setWinLines] = useState<{ line: number; symbols: string[]; payout: number }[]>([]);
  const [lastWin, setLastWin] = useState<number>(0);
  const [lastMultiplier, setLastMultiplier] = useState<number>(0);
  const [jackpotWin, setJackpotWin] = useState<{ tier: string; amount: number } | null>(null);
  const [error, setError] = useState<string>('');

  const [jackpotMini, setJackpotMini] = useState(127.45);
  const [jackpotMajor, setJackpotMajor] = useState(1843.72);
  const [jackpotGrand, setJackpotGrand] = useState(14567.89);

  const [autoPlay, setAutoPlay] = useState(false);
  const [autoPlayCount, setAutoPlayCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPaytable, setShowPaytable] = useState(false);
  const [history, setHistory] = useState<GameRound[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  const autoPlayRef = useRef(false);
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setJackpotMini((v) => v + Math.random() * 0.05);
      setJackpotMajor((v) => v + Math.random() * 0.15);
      setJackpotGrand((v) => v + Math.random() * 0.45);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);

  const getBalance = useCallback(() => {
    if (!user?.balances) return 0;
    const bal = user.balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [user, currency]);

  const totalBet = parseFloat(betPerLine) * PAYLINES.length;

  const winningCellsPerReel = useCallback((): Set<number>[] => {
    const sets: Set<number>[] = Array.from({ length: REELS }, () => new Set<number>());
    winLines.forEach((wl) => {
      const payline = PAYLINES[wl.line];
      if (payline) { payline.forEach((row, col) => { sets[col].add(row); }); }
    });
    return sets;
  }, [winLines]);

  const adjustBet = useCallback((direction: 'up' | 'down') => {
    const steps = [0.01, 0.05, 0.10, 0.25, 0.50, 1.00, 2.50, 5.00, 10.00, 25.00, 50.00];
    const current = parseFloat(betPerLine);
    const idx = steps.findIndex((s) => s >= current);
    if (direction === 'up' && idx < steps.length - 1) setBetPerLine(steps[idx + 1].toFixed(2));
    else if (direction === 'down' && idx > 0) setBetPerLine(steps[Math.max(0, idx - 1)].toFixed(2));
  }, [betPerLine]);

  const halveBet = useCallback(() => {
    setBetPerLine(Math.max(0.01, parseFloat(betPerLine) / 2).toFixed(2));
  }, [betPerLine]);

  const doubleBet = useCallback(() => {
    setBetPerLine(Math.min(50, parseFloat(betPerLine) * 2).toFixed(2));
  }, [betPerLine]);

  const spin = useCallback(async () => {
    if (spinning) return;
    if (!isAuthenticated) { setError('Please log in to play'); return; }
    const bet = parseFloat(betPerLine);
    if (isNaN(bet) || bet <= 0) { setError('Invalid bet amount'); return; }
    if (totalBet > getBalance()) { setError('Insufficient balance'); return; }

    setError('');
    setSpinning(true);
    setWinLines([]);
    setLastWin(0);
    setLastMultiplier(0);
    setJackpotWin(null);

    try {
      const res = await post<JackpotSlotApiResponse>('/casino/games/jackpotslots/play', {
        amount: totalBet, currency, options: { betPerLine: bet },
      });
      const data = res as JackpotSlotApiResponse;

      await new Promise((resolve) => setTimeout(resolve, 1200 + REELS * 150));
      setGrid(data.result.grid);
      setSpinning(false);
      useAuthStore.getState().updateBalance(currency, data.newBalance, 0);

      await new Promise((resolve) => setTimeout(resolve, 300));

      const betAmt = data.betAmount ?? totalBet;
      const mult = data.multiplier ?? (data.payout && betAmt ? data.payout / betAmt : 0);
      const payoutAmt = data.payout ?? betAmt * mult;
      const profitAmt = data.profit ?? (payoutAmt - betAmt);

      if (data.result.isWin) {
        setWinLines(data.result.winLines || []);
        setLastWin(payoutAmt);
        setLastMultiplier(mult);
        if (data.result.isJackpot && data.result.jackpotTier) {
          setJackpotWin({ tier: data.result.jackpotTier, amount: data.result.jackpotAmount || 0 });
        }
      }

      const round: GameRound = {
        id: data.roundId, grid: data.result.grid, won: data.result.isWin,
        betAmount: betAmt, payout: payoutAmt, profit: profitAmt,
        multiplier: mult, isJackpot: data.result.isJackpot,
        jackpotTier: data.result.jackpotTier, timestamp: new Date(), fairness: data.fairness,
      };
      setHistory((prev) => [round, ...prev].slice(0, 50));

      if (autoPlayRef.current) {
        setAutoPlayCount((c) => c + 1);
        spinTimeoutRef.current = setTimeout(() => { if (autoPlayRef.current) spin(); }, 1500);
      }
    } catch (err: any) {
      setSpinning(false);
      setError(err?.message || 'Spin failed. Please try again.');
      setAutoPlay(false);
      autoPlayRef.current = false;
    }
  }, [spinning, isAuthenticated, betPerLine, totalBet, getBalance, currency]);

  const toggleAutoPlay = useCallback(() => {
    if (autoPlay) {
      setAutoPlay(false);
      autoPlayRef.current = false;
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      setAutoPlayCount(0);
    } else {
      setAutoPlay(true);
      setAutoPlayCount(0);
      spin();
    }
  }, [autoPlay, spin]);

  useEffect(() => {
    return () => { if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current); };
  }, []);

  const reelWinSets = winningCellsPerReel();

  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Jackpot win overlay */}
      <AnimatePresence>
        {jackpotWin && (
          <motion.div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 cursor-pointer"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setJackpotWin(null)}>
            <motion.div className="text-center p-8" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
              <motion.div className="mb-4" animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                <Crown className="w-16 h-16 text-[#C8FF00] mx-auto" />
              </motion.div>
              <div className="text-3xl font-bold text-[#C8FF00] uppercase mb-2">{jackpotWin.tier} Jackpot!</div>
              <div className="text-5xl font-bold text-white font-mono">${jackpotWin.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <p className="text-[#8B949E] mt-4 text-sm">Tap to continue</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Jackpot Tickers */}
      <div className="grid grid-cols-3 gap-2 px-4 mt-3">
        <JackpotCounter label="Mini" amount={jackpotMini} color="#10B981" icon={<Gem className="w-3.5 h-3.5" style={{ color: '#10B981' }} />} />
        <JackpotCounter label="Major" amount={jackpotMajor} color="#3B82F6" icon={<Trophy className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />} />
        <JackpotCounter label="Grand" amount={jackpotGrand} color="#C8FF00" icon={<Crown className="w-3.5 h-3.5" style={{ color: '#C8FF00' }} />} />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{error}</motion.div>
        )}
      </AnimatePresence>

      {/* Win display above grid */}
      <AnimatePresence>
        {lastWin > 0 && !spinning && (
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="text-center py-2">
            <div className="text-2xl font-bold text-[#10B981] font-mono">+{lastWin.toFixed(4)} {currency}</div>
            <div className="text-xs text-[#8B949E] font-mono">{lastMultiplier.toFixed(2)}x</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reel grid -- edge-to-edge */}
      <div className="w-full px-1 mt-2">
        <div className="grid grid-cols-5 gap-1">
          {grid.map((reelSymbols, reelIdx) => (
            <ReelColumn key={reelIdx} symbols={reelSymbols} spinning={spinning} reelIndex={reelIdx} winningRows={reelWinSets[reelIdx] || new Set()} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 space-y-3 mt-3">
        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button onClick={() => setActiveTab('manual')}
            className={cn('flex-1 py-2 px-6 text-sm font-medium transition-all', activeTab === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]')}>
            Manual
          </button>
          <button onClick={() => setActiveTab('auto')}
            className={cn('flex-1 py-2 px-6 text-sm font-medium transition-all', activeTab === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]')}>
            Auto
          </button>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-[#8B949E] text-sm mr-2">{currency}</span>
            <input type="text" value={betPerLine} onChange={(e) => setBetPerLine(e.target.value)} disabled={spinning}
              className="flex-1 bg-transparent text-center text-sm font-mono text-white focus:outline-none disabled:opacity-50" />
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => adjustBet('down')} disabled={spinning} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => adjustBet('up')} disabled={spinning} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {BET_PRESETS.map((preset) => (
              <button key={preset} onClick={() => setBetPerLine(String(preset))} disabled={spinning}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40">
                {preset}
              </button>
            ))}
            <button onClick={halveBet} disabled={spinning} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-40">1/2</button>
            <button onClick={doubleBet} disabled={spinning} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-40">2X</button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-[#8B949E]">Total Bet ({PAYLINES.length} lines):</span>
            <span className="font-mono font-bold text-[#C8FF00]">{isNaN(totalBet) ? '0.00' : totalBet.toFixed(4)} {currency}</span>
          </div>
        </div>

        {/* Auto play controls */}
        {activeTab === 'auto' && (
          <div className="space-y-3">
            {autoPlay ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-mono text-[#C8FF00] font-bold">{autoPlayCount}</span>
                  <span className="text-xs text-[#8B949E]">spins played</span>
                </div>
                <button onClick={toggleAutoPlay} className="bg-[#EF4444] text-white font-bold py-3.5 px-6 rounded-xl text-sm">Stop</button>
              </div>
            ) : (
              <button onClick={toggleAutoPlay} disabled={spinning || !isAuthenticated}
                className="bg-[#2D333B] text-white font-bold py-3.5 rounded-xl w-full text-base disabled:opacity-40">
                Start Auto Play
              </button>
            )}
          </div>
        )}

        {/* SPIN Button */}
        {activeTab === 'manual' && (
          <motion.button onClick={spin} disabled={spinning || autoPlay || !isAuthenticated}
            className={cn('w-full py-3.5 rounded-xl font-bold text-base transition-all',
              spinning ? 'bg-[#30363D] text-[#484F58] cursor-not-allowed' : 'bg-[#C8FF00] text-black')}
            whileTap={!spinning ? { scale: 0.97 } : {}}>
            {spinning ? 'SPINNING...' : !isAuthenticated ? 'LOGIN TO PLAY' : 'SPIN'}
          </motion.button>
        )}

        {/* Paytable */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button onClick={() => setShowPaytable(!showPaytable)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-white transition-colors">
            <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[#C8FF00]" />Paytable</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showPaytable && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showPaytable && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="border-t border-[#30363D] p-3 space-y-1.5">
                  {[...SYMBOLS].sort((a, b) => b.value - a.value).map((sym) => (
                    <div key={sym.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{sym.emoji}</span>
                        <span className="text-xs text-[#8B949E]">{sym.name}</span>
                      </div>
                      <span className="text-xs font-mono text-[#C8FF00]">{sym.value}x</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[#30363D] text-xs text-[#8B949E]">
                    <p>Wild substitutes for all symbols except Jackpot.</p>
                    <p className="mt-1">3+ Jackpot symbols trigger progressive jackpot.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button onClick={() => setShowHistory(!showHistory)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-white transition-colors">
            <div className="flex items-center gap-2"><History className="w-3.5 h-3.5" /><span>History ({history.length})</span></div>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showHistory && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="border-t border-[#30363D]">
                  {history.length === 0 ? (
                    <p className="p-4 text-center text-xs text-[#484F58]">No spins yet</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#30363D]/30">
                      {history.slice(0, 20).map((round) => (
                        <div key={round.id} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', round.won ? 'bg-[#10B981]' : 'bg-[#484F58]')} />
                            {round.isJackpot && <Crown className="w-3 h-3 text-[#C8FF00]" />}
                            <span className="font-mono text-[#8B949E]">{(round.betAmount ?? 0).toFixed(4)}</span>
                          </div>
                          <span className={cn('font-mono font-bold', round.won ? 'text-[#10B981]' : 'text-[#484F58]')}>
                            {round.won ? `+${(round.profit ?? 0).toFixed(4)}` : `${(round.profit ?? 0).toFixed(4)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E]"><Home className="w-6 h-6" /></Link>
          <button onClick={() => setShowPaytable(!showPaytable)} className="text-[#8B949E]"><Info className="w-6 h-6" /></button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E]">
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">{getBalance().toFixed(4)} {currency}</span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
