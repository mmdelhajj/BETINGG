'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  History,
  Shield,
  Volume2,
  VolumeX,
  Zap,
  ChevronDown,
  ChevronUp,
  X,
  Info,
  Trophy,
  Star,
  Home,
  Minus,
  Plus,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WinLine {
  line: number;
  symbols: string[];
  multiplier: number;
  payout: number;
}

interface SlotResult {
  grid: string[][];
  winLines: WinLine[];
  totalPayout: number;
  symbols: string[];
  isBonus: boolean;
}

interface SlotsApiResponse {
  roundId: string;
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYMBOL_MAP: Record<string, { emoji: string; label: string; color: string; glow: string }> = {
  cherry:  { emoji: '\uD83C\uDF52', label: 'Cherry',  color: '#EF4444', glow: '0 0 20px rgba(239,68,68,0.6)' },
  lemon:   { emoji: '\uD83C\uDF4B', label: 'Lemon',   color: '#FBBF24', glow: '0 0 20px rgba(251,191,36,0.6)' },
  orange:  { emoji: '\uD83C\uDF4A', label: 'Orange',   color: '#F97316', glow: '0 0 20px rgba(249,115,22,0.6)' },
  grape:   { emoji: '\uD83C\uDF47', label: 'Grape',   color: '#A855F7', glow: '0 0 20px rgba(168,85,247,0.6)' },
  diamond: { emoji: '\uD83D\uDC8E', label: 'Diamond', color: '#38BDF8', glow: '0 0 20px rgba(56,189,248,0.6)' },
  seven:   { emoji: '7\uFE0F\u20E3', label: 'Seven',   color: '#EF4444', glow: '0 0 20px rgba(239,68,68,0.8)' },
  star:    { emoji: '\u2B50',       label: 'Star',    color: '#FBBF24', glow: '0 0 20px rgba(251,191,36,0.8)' },
  wild:    { emoji: '\uD83C\uDCCF', label: 'Wild',    color: '#10B981', glow: '0 0 20px rgba(16,185,129,0.8)' },
  scatter: { emoji: '\uD83D\uDCAB', label: 'Scatter', color: '#EC4899', glow: '0 0 20px rgba(236,72,153,0.8)' },
};

const ALL_SYMBOLS = Object.keys(SYMBOL_MAP);
const REEL_SYMBOLS = ALL_SYMBOLS;
const NUM_COLS = 3;
const NUM_ROWS = 3;
const PAYLINE_OPTIONS = [1, 3, 5];

const SPIN_STRIP_LENGTH = 30;

const PAYTABLE: { symbols: string; count: number; multiplier: number }[] = [
  { symbols: 'wild',    count: 3, multiplier: 500 },
  { symbols: 'seven',   count: 3, multiplier: 250 },
  { symbols: 'diamond', count: 3, multiplier: 150 },
  { symbols: 'star',    count: 3, multiplier: 100 },
  { symbols: 'grape',   count: 3, multiplier: 60 },
  { symbols: 'orange',  count: 3, multiplier: 40 },
  { symbols: 'lemon',   count: 3, multiplier: 30 },
  { symbols: 'cherry',  count: 3, multiplier: 20 },
  { symbols: 'scatter', count: 3, multiplier: 50 },
];

const PAYLINE_PATHS: number[][] = [
  [1, 1, 1], // Line 1: middle row
  [0, 0, 0], // Line 2: top row
  [2, 2, 2], // Line 3: bottom row
  [0, 1, 2], // Line 4: diagonal down
  [2, 1, 0], // Line 5: diagonal up
];

const PAYLINE_COLORS = [
  '#C8FF00', '#EF4444', '#3B82F6', '#F59E0B', '#EC4899',
];

const BET_PRESETS = [0.01, 0.1, 1, 10, 100];

// ---------------------------------------------------------------------------
// Helper: generate random spin strip
// ---------------------------------------------------------------------------

function generateSpinStrip(): string[] {
  const strip: string[] = [];
  for (let i = 0; i < SPIN_STRIP_LENGTH; i++) {
    strip.push(REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)]);
  }
  return strip;
}

// ---------------------------------------------------------------------------
// Component: Single Reel Column
// ---------------------------------------------------------------------------

interface ReelColumnProps {
  colIndex: number;
  finalSymbols: string[];
  isSpinning: boolean;
  spinDelay: number;
  turboMode: boolean;
  winningCells: Set<string>;
  showWin: boolean;
}

function ReelColumn({
  colIndex,
  finalSymbols,
  isSpinning,
  spinDelay,
  turboMode,
  winningCells,
  showWin,
}: ReelColumnProps) {
  const [spinStrip, setSpinStrip] = useState<string[]>(() => generateSpinStrip());
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [hasStopped, setHasStopped] = useState(true);
  const [bouncePhase, setBouncePhase] = useState(0);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const symbolHeight = 80;
  const spinSpeed = turboMode ? 50 : 30;
  const totalSpinDuration = turboMode ? 300 : 600;

  useEffect(() => {
    if (!isSpinning) return;

    setHasStopped(false);
    setIsStopping(false);
    setBouncePhase(0);
    setSpinStrip(generateSpinStrip());
    startTimeRef.current = performance.now();

    let offset = 0;
    let stopped = false;

    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;

      if (!stopped) {
        offset += spinSpeed;
        if (offset >= SPIN_STRIP_LENGTH * symbolHeight) {
          offset = 0;
          setSpinStrip(generateSpinStrip());
        }
        setCurrentOffset(offset);
      }

      if (elapsed >= spinDelay + totalSpinDuration && !stopped) {
        stopped = true;
        setIsStopping(true);

        let bounceStep = 0;
        const bounceFrames = turboMode ? 4 : 8;
        const bounceInterval = setInterval(() => {
          bounceStep++;
          setBouncePhase(bounceStep);
          if (bounceStep >= bounceFrames) {
            clearInterval(bounceInterval);
            setBouncePhase(0);
            setHasStopped(true);
          }
        }, turboMode ? 25 : 40);

        return;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isSpinning, spinDelay, spinSpeed, totalSpinDuration, turboMode]);

  const bounceOffset = useMemo(() => {
    if (bouncePhase === 0) return 0;
    const maxBounce = 12;
    const totalFrames = turboMode ? 4 : 8;
    const progress = bouncePhase / totalFrames;
    return Math.sin(progress * Math.PI) * maxBounce * (1 - progress);
  }, [bouncePhase, turboMode]);

  const renderSymbol = (symbol: string, row: number) => {
    const sym = SYMBOL_MAP[symbol] || SYMBOL_MAP.cherry;
    const cellKey = `${colIndex}-${row}`;
    const isWinning = showWin && winningCells.has(cellKey);

    return (
      <div
        key={`${colIndex}-${row}-final`}
        className={cn(
          'flex items-center justify-center transition-all duration-300',
          isWinning && 'z-10',
        )}
        style={{
          width: '100%',
          height: `${symbolHeight}px`,
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-xl transition-all',
            isWinning ? 'animate-pulse scale-110' : '',
          )}
          style={{
            width: '68px',
            height: '68px',
            fontSize: '44px',
            lineHeight: 1,
            boxShadow: isWinning ? sym.glow : 'none',
            background: isWinning ? `${sym.color}15` : 'transparent',
            border: isWinning ? `2px solid ${sym.color}50` : '2px solid transparent',
            borderRadius: '12px',
          }}
        >
          {sym.emoji}
        </div>
      </div>
    );
  };

  if (!hasStopped && isSpinning) {
    return (
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: `${symbolHeight * NUM_ROWS}px` }}
      >
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, rgba(13,17,23,0.4) 0%, transparent 20%, transparent 80%, rgba(13,17,23,0.4) 100%)',
          }}
        />
        <div
          className="transition-none"
          style={{
            transform: `translateY(-${currentOffset % (SPIN_STRIP_LENGTH * symbolHeight)}px)`,
            filter: isStopping ? 'none' : 'blur(1px)',
          }}
        >
          {spinStrip.map((sym, i) => {
            const s = SYMBOL_MAP[sym] || SYMBOL_MAP.cherry;
            return (
              <div
                key={`spin-${i}`}
                className="flex items-center justify-center"
                style={{
                  width: '100%',
                  height: `${symbolHeight}px`,
                  fontSize: '44px',
                  lineHeight: 1,
                  opacity: 0.6,
                }}
              >
                {s.emoji}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: `${symbolHeight * NUM_ROWS}px` }}
    >
      <div
        style={{
          transform: `translateY(${bounceOffset}px)`,
          transition: bouncePhase > 0 ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {finalSymbols.map((sym, row) => renderSymbol(sym, row))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component: Slots Game
// ---------------------------------------------------------------------------

export default function SlotsGamePage() {
  const { user, isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Bet controls
  const [betPerLine, setBetPerLine] = useState('');
  const [numLines, setNumLines] = useState(5);
  const [totalBet, setTotalBet] = useState(0);

  // Game state
  const [grid, setGrid] = useState<string[][]>(() =>
    Array.from({ length: NUM_COLS }, () =>
      Array.from({ length: NUM_ROWS }, () =>
        REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)]
      )
    )
  );
  const [isSpinning, setIsSpinning] = useState(false);
  const [winLines, setWinLines] = useState<WinLine[]>([]);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [isBonus, setIsBonus] = useState(false);
  const [freeSpins, setFreeSpins] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UI state
  const [turboMode, setTurboMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SpinHistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Auto-spin
  const [autoSpinCount, setAutoSpinCount] = useState(0);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState(0);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const autoSpinRef = useRef(false);

  // Provably fair
  const [serverSeedHash, setServerSeedHash] = useState(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [clientSeed, setClientSeed] = useState('randomclientseed123');
  const [nonce, setNonce] = useState(1);

  const isPlayingRef = useRef(false);

  const currentBalance = useMemo(() => {
    if (!user?.balances) return 0;
    const bal = user.balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [user?.balances, currency]);

  useEffect(() => {
    setBetPerLine(getDefaultBet(currency));
  }, [currency]);

  useEffect(() => {
    const perLine = parseFloat(betPerLine) || 0;
    setTotalBet(perLine * numLines);
  }, [betPerLine, numLines]);

  const winningCells = useMemo(() => {
    const cells = new Set<string>();
    if (!showWin || winLines.length === 0) return cells;

    winLines.forEach((wl) => {
      const lineIdx = wl.line - 1;
      if (lineIdx >= 0 && lineIdx < PAYLINE_PATHS.length) {
        const path = PAYLINE_PATHS[lineIdx];
        path.forEach((row, col) => {
          cells.add(`${col}-${row}`);
        });
      }
    });
    return cells;
  }, [showWin, winLines]);

  // Spin Handler
  const handleSpin = useCallback(async () => {
    if (isPlayingRef.current) return;
    if (!isAuthenticated) {
      setErrorMessage('Please log in to play.');
      return;
    }

    const amount = parseFloat(betPerLine);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Invalid bet amount.');
      return;
    }

    isPlayingRef.current = true;
    setIsSpinning(true);
    setShowWin(false);
    setWinLines([]);
    setLastPayout(null);
    setErrorMessage(null);
    setIsBonus(false);

    try {
      const response = await post<SlotsApiResponse>('/casino/games/slots/play', {
        amount,
        currency,
        options: { lines: numLines },
      });

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      if (response.fairness) {
        setServerSeedHash(response.fairness.serverSeedHash);
        setClientSeed(response.fairness.clientSeed);
        setNonce(response.fairness.nonce);
      }

      const newGrid = response.result.grid;
      let colMajorGrid: string[][];
      if (newGrid.length === NUM_COLS && newGrid[0]?.length === NUM_ROWS) {
        colMajorGrid = newGrid;
      } else if (newGrid.length === NUM_ROWS && newGrid[0]?.length === NUM_COLS) {
        colMajorGrid = Array.from({ length: NUM_COLS }, (_, col) =>
          Array.from({ length: NUM_ROWS }, (_, row) => newGrid[row][col])
        );
      } else {
        colMajorGrid = Array.from({ length: NUM_COLS }, (_, col) =>
          Array.from({ length: NUM_ROWS }, (_, row) =>
            newGrid[col]?.[row] || newGrid[row]?.[col] || 'cherry'
          )
        );
      }

      const baseDuration = turboMode ? 400 : 800;
      const perReelDelay = turboMode ? 150 : 300;
      const totalAnimTime = baseDuration + (NUM_COLS - 1) * perReelDelay + (turboMode ? 200 : 500);

      setGrid(colMajorGrid);

      await new Promise((resolve) => setTimeout(resolve, totalAnimTime));

      setIsSpinning(false);

      const result = response.result;
      if (result.totalPayout > 0) {
        setWinLines(result.winLines || []);
        setLastPayout(result.totalPayout);
        setShowWin(true);
      }

      if (result.isBonus) {
        setIsBonus(true);
        setFreeSpins((prev) => prev + 10);
      }

      const entry: SpinHistoryEntry = {
        id: response.roundId,
        bet: amount,
        lines: numLines,
        totalBet: amount * numLines,
        payout: result.totalPayout,
        won: result.totalPayout > 0,
        grid: colMajorGrid,
        winLines: result.winLines || [],
        timestamp: new Date(),
      };
      setHistory((prev) => [entry, ...prev.slice(0, 9)]);
    } catch (err: any) {
      setIsSpinning(false);
      const code = err?.errors?.code || err?.message || '';
      if (/insufficient/i.test(code) || /INSUFFICIENT/i.test(code)) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(err?.message || 'Failed to spin. Please try again.');
      }
    } finally {
      isPlayingRef.current = false;
    }
  }, [isAuthenticated, betPerLine, currency, numLines, turboMode, totalBet]);

  // Auto-Spin
  const startAutoSpin = useCallback(() => {
    if (autoSpinCount <= 0) return;
    setIsAutoSpinning(true);
    setAutoSpinRemaining(autoSpinCount);
    autoSpinRef.current = true;
  }, [autoSpinCount]);

  const stopAutoSpin = useCallback(() => {
    setIsAutoSpinning(false);
    setAutoSpinRemaining(0);
    autoSpinRef.current = false;
  }, []);

  useEffect(() => {
    if (!isAutoSpinning || autoSpinRemaining <= 0 || isSpinning) return;
    if (!autoSpinRef.current) return;

    const timer = setTimeout(() => {
      if (autoSpinRef.current && autoSpinRemaining > 0) {
        setAutoSpinRemaining((prev) => prev - 1);
        handleSpin();
      }
      if (autoSpinRemaining <= 1) {
        stopAutoSpin();
      }
    }, turboMode ? 500 : 1000);

    return () => clearTimeout(timer);
  }, [isAutoSpinning, autoSpinRemaining, isSpinning, handleSpin, stopAutoSpin, turboMode]);

  // Bet Adjustments
  const adjustBet = useCallback(
    (factor: number) => {
      const val = parseFloat(betPerLine) || 0;
      const newVal = Math.max(0.00001, val * factor);
      setBetPerLine(newVal.toFixed(6).replace(/\.?0+$/, '') || '0');
    },
    [betPerLine]
  );

  const decrementBet = useCallback(() => {
    const val = parseFloat(betPerLine) || 0;
    const newVal = Math.max(0.00001, val - (val * 0.1 || 0.001));
    setBetPerLine(newVal.toFixed(6).replace(/\.?0+$/, '') || '0');
  }, [betPerLine]);

  const incrementBet = useCallback(() => {
    const val = parseFloat(betPerLine) || 0;
    const newVal = val + (val * 0.1 || 0.001);
    setBetPerLine(newVal.toFixed(6).replace(/\.?0+$/, '') || '0');
  }, [betPerLine]);

  const setMaxBet = useCallback(() => {
    const bal = user?.balances?.find((b) => b.currency === currency);
    if (bal) {
      const maxPerLine = bal.available / numLines;
      setBetPerLine(maxPerLine.toFixed(6).replace(/\.?0+$/, '') || '0');
    }
  }, [user, currency, numLines]);

  const spinButtonDisabled = isSpinning || !isAuthenticated || totalBet <= 0;

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Error */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-3 py-2 text-sm text-[#EF4444] text-center"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bonus alert */}
      <AnimatePresence>
        {isBonus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mx-4 mt-2 text-center py-2 bg-[#C8FF00]/10 border border-[#C8FF00]/30 rounded-xl"
          >
            <span className="text-sm font-bold text-[#C8FF00]">BONUS ROUND! +10 FREE SPINS</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3x3 Reel Grid -- edge-to-edge */}
      <div className="w-full">
        <div
          className="relative overflow-hidden bg-[#0D1117]"
          style={{ boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)' }}
        >
          <div className="flex gap-[2px] p-2">
            {grid.map((colSymbols, colIdx) => (
              <div
                key={colIdx}
                className="flex-1 relative"
                style={{
                  borderLeft: colIdx > 0 ? '1px solid rgba(200,255,0,0.06)' : 'none',
                }}
              >
                <ReelColumn
                  colIndex={colIdx}
                  finalSymbols={colSymbols}
                  isSpinning={isSpinning}
                  spinDelay={colIdx * (turboMode ? 150 : 300)}
                  turboMode={turboMode}
                  winningCells={winningCells}
                  showWin={showWin}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Win Display */}
        <AnimatePresence>
          {showWin && lastPayout !== null && lastPayout > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="text-center py-3"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="inline-block"
              >
                {lastPayout >= totalBet * 10 ? (
                  <div className="text-center">
                    <div className="text-xs font-bold text-[#C8FF00] mb-1">BIG WIN</div>
                    <div className="text-2xl font-black text-[#C8FF00]">
                      {formatCurrency(lastPayout, currency)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-xs text-[#10B981] mb-0.5">WIN</div>
                    <div className="text-xl font-bold text-[#10B981]">
                      {formatCurrency(lastPayout, currency)}
                    </div>
                  </div>
                )}
                {winLines.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {winLines.slice(0, 3).map((wl, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[#C8FF00]/10 text-[#C8FF00] border border-[#C8FF00]/20"
                      >
                        L{wl.line}: {wl.multiplier}x
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls area */}
      <div className="px-4 space-y-3 mt-3">
        {/* Lines selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#8B949E] font-medium">LINES</span>
            <div className="flex gap-1">
              {PAYLINE_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setNumLines(n)}
                  disabled={isSpinning}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                    numLines === n
                      ? 'bg-[#C8FF00] text-black'
                      : 'bg-[#21262D] text-[#8B949E] border border-[#30363D]'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-[#8B949E]">TOTAL BET</div>
            <div className="text-xs font-bold font-mono text-[#C8FF00]">
              {formatCurrency(totalBet, currency)}
            </div>
          </div>
        </div>

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-medium transition-all',
              activeTab === 'manual'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-medium transition-all',
              activeTab === 'auto'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Auto
          </button>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-[#8B949E] text-sm mr-2">{currency}</span>
            <input
              type="number"
              value={betPerLine}
              onChange={(e) => setBetPerLine(e.target.value)}
              min="0"
              step="any"
              disabled={isSpinning}
              className="flex-1 bg-transparent text-center text-sm font-mono text-white focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={decrementBet}
                disabled={isSpinning}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={incrementBet}
                disabled={isSpinning}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 mt-2">
            {BET_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setBetPerLine(String(preset))}
                disabled={isSpinning}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
              >
                {preset}
              </button>
            ))}
            <button
              onClick={() => adjustBet(0.5)}
              disabled={isSpinning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
            >
              1/2
            </button>
            <button
              onClick={() => adjustBet(2)}
              disabled={isSpinning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
            >
              2X
            </button>
          </div>
        </div>

        {activeTab === 'auto' && (
          <div className="space-y-3">
            {!isAutoSpinning ? (
              <div className="space-y-2">
                <label className="text-[#8B949E] text-sm">Number of Spins</label>
                <div className="flex gap-2">
                  {[10, 25, 50, 100].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAutoSpinCount(n)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                        autoSpinCount === n
                          ? 'bg-[#8B5CF6] text-white'
                          : 'bg-[#21262D] border border-[#30363D] text-[#8B949E]'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={startAutoSpin}
                  disabled={isSpinning || !isAuthenticated || autoSpinCount <= 0}
                  className="bg-[#2D333B] text-white font-bold py-3.5 rounded-xl w-full text-base disabled:opacity-40"
                >
                  Start Auto Spin
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-mono text-[#C8FF00] font-bold">{autoSpinRemaining}</span>
                  <span className="text-xs text-[#8B949E]">spins left</span>
                </div>
                <button
                  onClick={stopAutoSpin}
                  className="bg-[#EF4444] text-white font-bold py-3.5 px-6 rounded-xl text-sm"
                >
                  Stop
                </button>
              </div>
            )}
          </div>
        )}

        {/* SPIN Button */}
        {activeTab === 'manual' && (
          <motion.button
            whileTap={spinButtonDisabled ? {} : { scale: 0.97 }}
            disabled={spinButtonDisabled}
            onClick={handleSpin}
            className={cn(
              'w-full py-3.5 rounded-xl font-bold text-base transition-all',
              spinButtonDisabled
                ? 'bg-[#30363D] text-[#484F58] cursor-not-allowed'
                : 'bg-[#C8FF00] text-black',
            )}
          >
            {isSpinning ? 'SPINNING...' : !isAuthenticated ? 'LOGIN TO PLAY' : 'SPIN'}
          </motion.button>
        )}

        {/* Paytable Collapsible */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPaytable(!showPaytable)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Paytable
            </span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showPaytable && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showPaytable && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#30363D] p-3 space-y-1.5">
                  {PAYTABLE.map((entry) => {
                    const info = SYMBOL_MAP[entry.symbols];
                    if (!info) return null;
                    return (
                      <div key={`${entry.symbols}-${entry.count}`} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{info.emoji}</span>
                          <span className="text-xs text-[#8B949E]">{info.label} x{entry.count}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#C8FF00]">{entry.multiplier}x</span>
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
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              <span>History ({history.length})</span>
            </div>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showHistory && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#30363D]">
                  {history.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#484F58]">No spins yet</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#30363D]/30">
                      {history.map((entry) => (
                        <div
                          key={entry.id}
                          className="px-3 py-2 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', entry.won ? 'bg-[#10B981]' : 'bg-[#484F58]')} />
                            <span className="font-mono text-[#8B949E]">{entry.lines}L</span>
                            <span className="font-mono text-white">{formatCurrency(entry.totalBet, currency)}</span>
                          </div>
                          <span className={cn('font-mono font-bold', entry.won ? 'text-[#10B981]' : 'text-[#484F58]')}>
                            {entry.won ? `+${formatCurrency(entry.payout, currency)}` : formatCurrency(0, currency)}
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
          <Link href="/casino" className="text-[#8B949E]">
            <Home className="w-6 h-6" />
          </Link>
          <button onClick={() => setShowPaytable(!showPaytable)} className="text-[#8B949E]">
            <Info className="w-6 h-6" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E]">
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {formatCurrency(currentBalance, currency)}
        </span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
