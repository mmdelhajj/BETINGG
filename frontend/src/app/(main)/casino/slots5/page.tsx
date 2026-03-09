'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  History,
  Volume2,
  VolumeX,
  Zap,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Trophy,
  Star,
  Info,
  Play,
  Square,
  RotateCcw,
  X,
  Home,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import ProvablyFair from '@/components/casino/ProvablyFair';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WinLine {
  line: number;
  symbols: string[];
  multiplier: number;
  payout: number;
  positions: [number, number][];
}

interface FreeSpinResult {
  triggered: boolean;
  count: number;
  remaining: number;
  totalWin: number;
}

interface SlotResult {
  grid: string[][];
  winLines: WinLine[];
  totalPayout: number;
  freeSpins: FreeSpinResult;
}

interface ApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: SlotResult;
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface SpinHistoryEntry {
  id: string;
  bet: number;
  lines: number;
  totalBet: number;
  payout: number;
  won: boolean;
  grid: string[][];
  winLines: WinLine[];
  timestamp: Date;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NUM_COLS = 5;
const NUM_ROWS = 3;
const SPIN_STRIP_LENGTH = 25;

const SYMBOL_MAP: Record<string, { emoji: string; label: string; color: string; glow: string }> = {
  seven:   { emoji: '7\uFE0F\u20E3', label: 'Seven',   color: '#EF4444', glow: '0 0 20px rgba(239,68,68,0.7)' },
  bar:     { emoji: '\uD83C\uDFB0',   label: 'BAR',     color: '#F59E0B', glow: '0 0 20px rgba(245,158,11,0.6)' },
  cherry:  { emoji: '\uD83C\uDF52',   label: 'Cherry',  color: '#EF4444', glow: '0 0 20px rgba(239,68,68,0.6)' },
  diamond: { emoji: '\uD83D\uDC8E',   label: 'Diamond', color: '#38BDF8', glow: '0 0 20px rgba(56,189,248,0.7)' },
  bell:    { emoji: '\uD83D\uDD14',   label: 'Bell',    color: '#FBBF24', glow: '0 0 20px rgba(251,191,36,0.6)' },
  star:    { emoji: '\u2B50',         label: 'Star',    color: '#FBBF24', glow: '0 0 20px rgba(251,191,36,0.7)' },
  wild:    { emoji: '\uD83C\uDCCF',   label: 'Wild',    color: '#10B981', glow: '0 0 24px rgba(16,185,129,0.8)' },
  scatter: { emoji: '\uD83D\uDCAB',   label: 'Scatter', color: '#EC4899', glow: '0 0 24px rgba(236,72,153,0.8)' },
};

const ALL_SYMBOLS = Object.keys(SYMBOL_MAP);
const PAYLINE_OPTIONS = [1, 5, 10, 15, 20];

const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2], [0, 1, 2, 2, 2], [2, 1, 0, 0, 0], [1, 0, 1, 2, 1],
];

const PAYLINE_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#E11D48',
  '#7C3AED', '#14B8A6', '#F43F5E', '#6366F1', '#22D3EE',
  '#A855F7', '#FB923C', '#4ADE80', '#FBBF24', '#F472B6',
];

const PAYTABLE: { symbol: string; count: number; multiplier: number }[] = [
  { symbol: 'wild',    count: 5, multiplier: 500 },
  { symbol: 'wild',    count: 4, multiplier: 100 },
  { symbol: 'wild',    count: 3, multiplier: 25 },
  { symbol: 'seven',   count: 5, multiplier: 250 },
  { symbol: 'seven',   count: 4, multiplier: 50 },
  { symbol: 'seven',   count: 3, multiplier: 15 },
  { symbol: 'diamond', count: 5, multiplier: 150 },
  { symbol: 'diamond', count: 4, multiplier: 30 },
  { symbol: 'diamond', count: 3, multiplier: 10 },
  { symbol: 'bar',     count: 5, multiplier: 100 },
  { symbol: 'bar',     count: 4, multiplier: 20 },
  { symbol: 'bar',     count: 3, multiplier: 8 },
  { symbol: 'bell',    count: 5, multiplier: 75 },
  { symbol: 'bell',    count: 4, multiplier: 15 },
  { symbol: 'bell',    count: 3, multiplier: 5 },
  { symbol: 'star',    count: 5, multiplier: 60 },
  { symbol: 'star',    count: 4, multiplier: 12 },
  { symbol: 'star',    count: 3, multiplier: 4 },
  { symbol: 'cherry',  count: 5, multiplier: 40 },
  { symbol: 'cherry',  count: 4, multiplier: 8 },
  { symbol: 'cherry',  count: 3, multiplier: 3 },
];

const BET_PRESETS = [0.01, 0.1, 1, 10, 100];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSpinStrip(): string[] {
  const strip: string[] = [];
  for (let i = 0; i < SPIN_STRIP_LENGTH; i++) {
    strip.push(ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]);
  }
  return strip;
}

function generateRandomGrid(): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < NUM_ROWS; r++) {
    const row: string[] = [];
    for (let c = 0; c < NUM_COLS; c++) {
      row.push(ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]);
    }
    grid.push(row);
  }
  return grid;
}

function getPositionsForLine(lineIndex: number): [number, number][] {
  const payline = PAYLINES[lineIndex];
  if (!payline) return [];
  return payline.map((row, col) => [row, col] as [number, number]);
}

// ---------------------------------------------------------------------------
// Component: Symbol Cell
// ---------------------------------------------------------------------------

function SymbolCell({ symbol, isWinning, winColor }: { symbol: string; isWinning: boolean; winColor?: string }) {
  const info = SYMBOL_MAP[symbol] || SYMBOL_MAP.cherry;
  return (
    <motion.div
      className={cn(
        'relative flex items-center justify-center w-full aspect-square rounded-lg text-2xl sm:text-3xl select-none transition-all duration-200',
        isWinning ? 'z-10' : 'opacity-80',
      )}
      animate={
        isWinning
          ? { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }
          : { scale: 1 }
      }
      transition={{ duration: 0.6, repeat: isWinning ? Infinity : 0, repeatType: 'reverse' }}
      style={{
        background: isWinning ? `radial-gradient(circle, ${winColor || info.color}22, transparent)` : 'transparent',
        border: isWinning ? `2px solid ${winColor || info.color}` : '2px solid transparent',
      }}
    >
      <span className="drop-shadow-lg">{info.emoji}</span>
      {isWinning && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ background: `${winColor || info.color}15` }}
        />
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Component: Spinning Reel
// ---------------------------------------------------------------------------

function SpinningReel({ columnIndex, finalSymbols, isSpinning, spinDuration, spinStrip }: {
  columnIndex: number; finalSymbols: string[]; isSpinning: boolean; spinDuration: number; spinStrip: string[];
}) {
  const [displaySymbols, setDisplaySymbols] = useState<string[]>(finalSymbols);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isSpinning) { setDisplaySymbols(finalSymbols); return; }
    const delay = columnIndex * 150;
    let running = true;
    let ticker = 0;
    startTimeRef.current = performance.now() + delay;

    const animate = () => {
      if (!running) return;
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      if (elapsed < 0) { animFrameRef.current = requestAnimationFrame(animate); return; }
      if (elapsed >= spinDuration) { setDisplaySymbols(finalSymbols); return; }
      const progress = elapsed / spinDuration;
      const speed = Math.max(1, Math.floor((1 - progress) * 8));
      ticker++;
      if (ticker % speed === 0) {
        const idx = Math.floor(Math.random() * (spinStrip.length - 2));
        setDisplaySymbols([spinStrip[idx], spinStrip[idx + 1], spinStrip[idx + 2]]);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [isSpinning, finalSymbols, spinDuration, columnIndex, spinStrip]);

  return (
    <div className="flex flex-col gap-0.5">
      {displaySymbols.map((sym, rowIdx) => {
        const info = SYMBOL_MAP[sym] || SYMBOL_MAP.cherry;
        return (
          <motion.div
            key={`${columnIndex}-${rowIdx}`}
            className="flex items-center justify-center aspect-square rounded-lg text-2xl sm:text-3xl select-none bg-[#1C2128]/60"
            animate={isSpinning ? { y: [0, -4, 0] } : { y: 0 }}
            transition={isSpinning ? { duration: 0.1, repeat: Infinity } : {}}
          >
            <span className="drop-shadow-lg">{info.emoji}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function Slots5Page() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Game state
  const [grid, setGrid] = useState<string[][]>(generateRandomGrid);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winLines, setWinLines] = useState<WinLine[]>([]);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [lastMultiplier, setLastMultiplier] = useState<number>(0);
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const [freeSpinsRemaining, setFreeSpinsRemaining] = useState(0);
  const [freeSpinsTotalWin, setFreeSpinsTotalWin] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Bet controls
  const [currency, setCurrency] = useState('BTC');
  const [betPerLine, setBetPerLine] = useState('0.00001');
  const [lines, setLines] = useState(20);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Autoplay
  const [autoplayActive, setAutoplayActive] = useState(false);
  const [autoplayCount, setAutoplayCount] = useState(10);
  const [autoplayRemaining, setAutoplayRemaining] = useState(0);
  const [autoplayStopOnWin, setAutoplayStopOnWin] = useState(false);
  const autoplayRef = useRef(false);

  // Fairness
  const [fairness, setFairness] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);

  // History
  const [history, setHistory] = useState<SpinHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);

  const spinStrips = useMemo(() => Array.from({ length: NUM_COLS }, () => generateSpinStrip()), []);

  const currencies = useMemo(() => user?.balances?.map((b) => b.currency) || ['BTC', 'ETH', 'USDT'], [user]);
  const currentBalance = useMemo(() => user?.balances?.find((b) => b.currency === currency)?.available || 0, [user, currency]);
  const totalBet = useMemo(() => parseFloat(betPerLine) * lines, [betPerLine, lines]);

  // Spin logic
  const doSpin = useCallback(async () => {
    if (isSpinning) return;
    if (!isAuthenticated) { setError('Please log in to play'); return; }
    const betVal = parseFloat(betPerLine);
    if (isNaN(betVal) || betVal <= 0) { setError('Invalid bet amount'); return; }
    if (totalBet > currentBalance && freeSpinsRemaining <= 0) { setError('Insufficient balance'); return; }

    setError(null); setIsSpinning(true); setWinLines([]); setShowWinCelebration(false);
    setLastPayout(0); setLastMultiplier(0);

    try {
      const data = await post<ApiResponse>('/casino/games/slots5/play', {
        amount: freeSpinsRemaining > 0 ? 0 : totalBet, currency,
        options: { lines, betPerLine: betVal },
      });
      await new Promise((r) => setTimeout(r, 1200 + NUM_COLS * 150));

      const resultGrid = data.result?.grid ?? [];
      const resultWinLines = data.result?.winLines ?? [];
      setGrid(resultGrid);
      setWinLines(resultWinLines);
      setLastPayout(data.payout ?? 0);
      setLastMultiplier(data.multiplier ?? 0);
      setFairness(data.fairness);
      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }

      if (data.result?.freeSpins?.triggered) {
        setFreeSpinsRemaining(data.result.freeSpins.count);
        setFreeSpinsTotalWin(0);
      } else if (freeSpinsRemaining > 0) {
        setFreeSpinsRemaining((prev) => Math.max(0, prev - 1));
        setFreeSpinsTotalWin((prev) => prev + (data.payout ?? 0));
      }

      if ((data.payout ?? 0) > 0) { setShowWinCelebration(true); setTimeout(() => setShowWinCelebration(false), 3000); }

      setHistory((prev) => [{
        id: data.roundId, bet: betVal, lines, totalBet, payout: data.payout ?? 0,
        won: (data.payout ?? 0) > 0, grid: resultGrid, winLines: resultWinLines, timestamp: new Date(),
      }, ...prev.slice(0, 49)]);

      setIsSpinning(false);

      if (autoplayRef.current && autoplayRemaining > 1) {
        if (autoplayStopOnWin && data.payout > 0) { autoplayRef.current = false; setAutoplayActive(false); setAutoplayRemaining(0); }
        else { setAutoplayRemaining((prev) => prev - 1); }
      } else if (autoplayRef.current) { autoplayRef.current = false; setAutoplayActive(false); setAutoplayRemaining(0); }
    } catch (err: any) {
      setIsSpinning(false); setError(err?.message || 'Spin failed');
      autoplayRef.current = false; setAutoplayActive(false); setAutoplayRemaining(0);
    }
  }, [isSpinning, isAuthenticated, betPerLine, totalBet, currentBalance, freeSpinsRemaining, currency, lines, autoplayRemaining, autoplayStopOnWin]);

  // Autoplay effect
  useEffect(() => {
    if (autoplayActive && autoplayRemaining > 0 && !isSpinning) {
      const timer = setTimeout(() => { if (autoplayRef.current) doSpin(); }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoplayActive, autoplayRemaining, isSpinning, doSpin]);

  const startAutoplay = useCallback(() => { autoplayRef.current = true; setAutoplayActive(true); setAutoplayRemaining(autoplayCount); doSpin(); }, [autoplayCount, doSpin]);
  const stopAutoplay = useCallback(() => { autoplayRef.current = false; setAutoplayActive(false); setAutoplayRemaining(0); }, []);
  const halfBet = useCallback(() => { const val = parseFloat(betPerLine); if (!isNaN(val)) setBetPerLine((val / 2).toFixed(8)); }, [betPerLine]);
  const doubleBet = useCallback(() => { const val = parseFloat(betPerLine); if (!isNaN(val)) setBetPerLine((val * 2).toFixed(8)); }, [betPerLine]);
  const decrementBet = useCallback(() => { const val = parseFloat(betPerLine) || 0; setBetPerLine(Math.max(0.00000001, val - (val * 0.1 || 0.00001)).toFixed(8)); }, [betPerLine]);
  const incrementBet = useCallback(() => { const val = parseFloat(betPerLine) || 0; setBetPerLine((val + (val * 0.1 || 0.00001)).toFixed(8)); }, [betPerLine]);

  // Winning cell detection
  const winningCells = useMemo(() => {
    const cells = new Set<string>();
    winLines.forEach((wl) => { getPositionsForLine(wl.line - 1).forEach(([r, c]) => cells.add(`${r}-${c}`)); });
    return cells;
  }, [winLines]);

  const getWinColorForCell = useCallback((row: number, col: number): string | undefined => {
    for (const wl of winLines) {
      const positions = getPositionsForLine(wl.line - 1);
      if (positions.some(([r, c]) => r === row && c === col)) return PAYLINE_COLORS[(wl.line - 1) % PAYLINE_COLORS.length];
    }
    return undefined;
  }, [winLines]);

  const spinDisabled = isSpinning || !isAuthenticated;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Free Spins Banner */}
      <AnimatePresence>
        {freeSpinsRemaining > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mx-4 mt-2 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-[#8B5CF6] font-bold text-sm">
                <Zap size={16} />FREE SPINS: {freeSpinsRemaining} remaining<Zap size={16} />
              </div>
              <p className="text-xs text-[#8B949E] mt-1">Total free spin winnings: {formatCurrency(freeSpinsTotalWin, currency)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-4 mt-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3 text-xs text-[#EF4444] text-center">{error}</motion.div>
        )}
      </AnimatePresence>

      {/* 5x3 Reel Grid -- edge-to-edge */}
      <div className="w-full relative mt-2">
        {/* Status bar */}
        <div className="px-4 py-2 text-center">
          <p className="text-sm text-[#8B949E]">
            {isSpinning ? (
              <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>Spinning...</motion.span>
            ) : lastPayout > 0 ? (
              <span className="text-[#10B981] font-bold">WIN! {formatCurrency(lastPayout, currency)} ({lastMultiplier.toFixed(2)}x)</span>
            ) : (
              <span className="text-[#8B949E]">Lines: {lines} | Total: {formatCurrency(totalBet, currency)}</span>
            )}
          </p>
        </div>

        <div className="relative px-1">
          <div className="grid grid-cols-5 gap-0.5">
            {isSpinning
              ? Array.from({ length: NUM_COLS }, (_, colIdx) => (
                  <SpinningReel key={`spinning-${colIdx}`} columnIndex={colIdx} finalSymbols={grid.map((row) => row[colIdx])}
                    isSpinning={isSpinning} spinDuration={1000} spinStrip={spinStrips[colIdx]} />
                ))
              : Array.from({ length: NUM_ROWS }, (_, rowIdx) =>
                  Array.from({ length: NUM_COLS }, (_, colIdx) => {
                    const symbol = grid[rowIdx]?.[colIdx] || 'cherry';
                    const cellKey = `${rowIdx}-${colIdx}`;
                    const isWin = winningCells.has(cellKey);
                    return (
                      <div key={cellKey} className="bg-[#1C2128]/60 rounded-lg" style={{ gridColumn: colIdx + 1, gridRow: rowIdx + 1 }}>
                        <SymbolCell symbol={symbol} isWinning={isWin} winColor={getWinColorForCell(rowIdx, colIdx)} />
                      </div>
                    );
                  })
                )}
          </div>

          {/* Win line labels */}
          <AnimatePresence>
            {winLines.length > 0 && !isSpinning && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-2 flex flex-wrap gap-1 justify-center px-4">
                {winLines.map((wl) => (
                  <span key={wl.line} className="text-xs px-2 py-1 rounded-full font-mono font-semibold"
                    style={{ backgroundColor: `${PAYLINE_COLORS[(wl.line - 1) % PAYLINE_COLORS.length]}25`, color: PAYLINE_COLORS[(wl.line - 1) % PAYLINE_COLORS.length], border: `1px solid ${PAYLINE_COLORS[(wl.line - 1) % PAYLINE_COLORS.length]}40` }}>
                    Line {wl.line}: {wl.multiplier}x
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Win celebration overlay */}
        <AnimatePresence>
          {showWinCelebration && lastPayout > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              <div className="bg-[#0D1117]/80 rounded-2xl p-6 text-center">
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: 3 }}>
                  <Trophy className="w-10 h-10 text-[#C8FF00] mx-auto mb-2" />
                </motion.div>
                <p className="text-2xl font-bold text-[#10B981] font-mono">+{formatCurrency(lastPayout, currency)}</p>
                <p className="text-sm text-[#8B949E] mt-1">{lastMultiplier.toFixed(2)}x multiplier</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="px-4 space-y-3 mt-3">
        {/* Lines selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#8B949E] font-medium">LINES</span>
            <div className="flex gap-1">
              {PAYLINE_OPTIONS.map((n) => (
                <button key={n} onClick={() => setLines(n)} disabled={isSpinning}
                  className={cn('px-2 py-1 rounded-lg text-xs font-bold transition-all',
                    n === lines ? 'bg-[#C8FF00] text-black' : 'bg-[#21262D] text-[#8B949E] border border-[#30363D]')}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-[#8B949E]">TOTAL BET</div>
            <div className="text-xs font-bold font-mono text-[#C8FF00]">{formatCurrency(totalBet, currency)}</div>
          </div>
        </div>

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
            <input type="text" value={betPerLine} onChange={(e) => setBetPerLine(e.target.value)} disabled={isSpinning}
              className="flex-1 bg-transparent text-center text-sm font-mono text-white focus:outline-none disabled:opacity-50" />
            <div className="flex items-center gap-1 ml-2">
              <button onClick={decrementBet} disabled={isSpinning} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={incrementBet} disabled={isSpinning} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {BET_PRESETS.map((preset) => (
              <button key={preset} onClick={() => setBetPerLine(String(preset))} disabled={isSpinning}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40">
                {preset}
              </button>
            ))}
            <button onClick={halfBet} disabled={isSpinning} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-40">1/2</button>
            <button onClick={doubleBet} disabled={isSpinning} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-40">2X</button>
          </div>
        </div>

        {/* Auto Spin controls */}
        {activeTab === 'auto' && (
          <div className="space-y-3">
            {!autoplayActive ? (
              <div className="space-y-2">
                <label className="text-[#8B949E] text-sm">Number of Spins</label>
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map((n) => (
                    <button key={n} onClick={() => setAutoplayCount(n)}
                      className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                        autoplayCount === n ? 'bg-[#8B5CF6] text-white' : 'bg-[#21262D] border border-[#30363D] text-[#8B949E]')}>
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8B949E]">Stop on Win</span>
                  <button onClick={() => setAutoplayStopOnWin(!autoplayStopOnWin)}
                    className={cn('w-10 h-5 rounded-full relative transition-colors', autoplayStopOnWin ? 'bg-[#8B5CF6]' : 'bg-[#2D333B]')}>
                    <motion.div className="absolute top-0.5 w-4 h-4 rounded-full bg-white" animate={{ left: autoplayStopOnWin ? 20 : 2 }} />
                  </button>
                </div>
                <button onClick={startAutoplay} disabled={spinDisabled}
                  className="bg-[#2D333B] text-white font-bold py-3.5 rounded-xl w-full text-base disabled:opacity-40">
                  Start Auto Spin ({autoplayCount})
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-mono text-[#C8FF00] font-bold">{autoplayRemaining}</span>
                  <span className="text-xs text-[#8B949E]">spins left</span>
                </div>
                <button onClick={stopAutoplay} className="bg-[#EF4444] text-white font-bold py-3.5 px-6 rounded-xl text-sm">Stop</button>
              </div>
            )}
          </div>
        )}

        {/* SPIN Button */}
        {activeTab === 'manual' && (
          <motion.button whileTap={spinDisabled ? {} : { scale: 0.97 }} onClick={doSpin} disabled={spinDisabled}
            className={cn('w-full py-3.5 rounded-xl font-bold text-base transition-all',
              spinDisabled ? 'bg-[#30363D] text-[#484F58] cursor-not-allowed' : freeSpinsRemaining > 0 ? 'bg-[#8B5CF6] text-white' : 'bg-[#C8FF00] text-black')}>
            {isSpinning ? 'SPINNING...' : freeSpinsRemaining > 0 ? `FREE SPIN (${freeSpinsRemaining})` : !isAuthenticated ? 'LOGIN TO PLAY' : 'SPIN'}
          </motion.button>
        )}

        {/* Paytable */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button onClick={() => setShowPaytable(!showPaytable)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-white transition-colors">
            <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-[#FBBF24]" />Paytable</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showPaytable && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showPaytable && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="border-t border-[#30363D] p-3 space-y-1.5">
                  {ALL_SYMBOLS.map((sym) => {
                    const info = SYMBOL_MAP[sym];
                    const payouts = PAYTABLE.filter((p) => p.symbol === sym);
                    if (payouts.length === 0 && sym !== 'scatter') return null;
                    return (
                      <div key={sym} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{info.emoji}</span>
                          <span className="text-xs text-[#8B949E]">{info.label}</span>
                        </div>
                        <div className="flex gap-2">
                          {sym === 'scatter' ? <span className="text-xs text-[#8B949E]">3+ = Free Spins</span> :
                            payouts.map((p) => <span key={p.count} className="text-xs font-mono text-[#C8FF00]">{p.count}x={p.multiplier}x</span>)}
                        </div>
                      </div>
                    );
                  })}
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
                      {history.slice(0, 20).map((entry) => (
                        <div key={entry.id} className="px-3 py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', entry.won ? 'bg-[#10B981]' : 'bg-[#484F58]')} />
                            <span className="font-mono text-[#8B949E]">{entry.lines}L</span>
                            <span className="font-mono text-white">{formatCurrency(entry.totalBet, currency)}</span>
                          </div>
                          <span className={cn('font-mono font-bold', entry.won ? 'text-[#10B981]' : 'text-[#484F58]')}>
                            {entry.won ? `+${formatCurrency(entry.payout, currency)}` : '0'}
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

        {/* Provably Fair */}
        {fairness && <ProvablyFair serverSeedHash={fairness.serverSeedHash} clientSeed={fairness.clientSeed} nonce={fairness.nonce} />}
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
        <span className="text-sm font-mono text-white">{formatCurrency(currentBalance, currency)}</span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
