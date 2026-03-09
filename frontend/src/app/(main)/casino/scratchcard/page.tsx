'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  History,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Eye,
  Trophy,
  Home,
  Info,
  Volume2,
  VolumeX,
  Minus,
  Plus,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = 'bronze' | 'silver' | 'gold';
type GamePhase = 'idle' | 'scratching' | 'revealed' | 'won' | 'lost';
type CellState = 'hidden' | 'scratching' | 'revealed';

interface GridCell {
  symbol: string;
  emoji: string;
  state: CellState;
  isWinning: boolean;
}

interface WinLineData {
  positions: [number, number][];
  symbol: string;
  multiplier: number;
}

interface ScratchCardResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    grid: string[][];
    cardType: string;
    winLines: WinLineData[];
    totalMultiplier: number;
    isWin: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface HistoryEntry {
  id: string;
  tier: Tier;
  multiplier: number;
  won: boolean;
  profit: number;
  grid: GridCell[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYMBOL_MAP: Record<string, { emoji: string; color: string }> = {
  diamond: { emoji: '\uD83D\uDC8E', color: '#60A5FA' },
  star: { emoji: '\u2B50', color: '#FBBF24' },
  cherry: { emoji: '\uD83C\uDF52', color: '#F87171' },
  crown: { emoji: '\uD83D\uDC51', color: '#F59E0B' },
  seven: { emoji: '7\uFE0F\u20E3', color: '#A78BFA' },
  bell: { emoji: '\uD83D\uDD14', color: '#FCD34D' },
  clover: { emoji: '\uD83C\uDF40', color: '#34D399' },
  gem: { emoji: '\uD83D\uDCA0', color: '#818CF8' },
  coin: { emoji: '\uD83E\uDE99', color: '#D97706' },
};

const TIER_CONFIG: Record<Tier, { label: string; minBet: number; color: string; icon: string }> = {
  bronze: { label: 'Bronze', minBet: 0.5, color: '#CD7F32', icon: '\uD83E\uDD49' },
  silver: { label: 'Silver', minBet: 2, color: '#C0C0C0', icon: '\uD83E\uDD48' },
  gold: { label: 'Gold', minBet: 10, color: '#FFD700', icon: '\uD83E\uDD47' },
};

const ALL_SYMBOLS = Object.keys(SYMBOL_MAP);

function generateFallbackGrid(): GridCell[] {
  const cells: GridCell[] = [];
  for (let i = 0; i < 9; i++) {
    const sym = ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
    cells.push({ symbol: sym, emoji: SYMBOL_MAP[sym].emoji, state: 'hidden', isWinning: false });
  }
  return cells;
}

function parseApiGrid(grid: string[][], winLines: WinLineData[]): GridCell[] {
  const winPositions = new Set<string>();
  (winLines || []).forEach((line) => {
    line.positions.forEach(([r, c]) => winPositions.add(`${r}-${c}`));
  });
  const cells: GridCell[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sym = grid[r]?.[c] || 'star';
      const key = sym.toLowerCase();
      const mapped = SYMBOL_MAP[key] || SYMBOL_MAP.star;
      cells.push({ symbol: key, emoji: mapped.emoji, state: 'hidden', isWinning: winPositions.has(`${r}-${c}`) });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScratchCardPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [tier, setTier] = useState<Tier>('bronze');
  const [betAmount, setBetAmount] = useState<string>('0.50');
  const [currency, setCurrency] = useState<string>('USDT');
  const [grid, setGrid] = useState<GridCell[]>(() => generateFallbackGrid());
  const [revealedCount, setRevealedCount] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [profit, setProfit] = useState(0);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [fairness, setFairness] = useState<ScratchCardResponse['fairness'] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [autoReveal, setAutoReveal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual');

  const responseRef = useRef<ScratchCardResponse | null>(null);
  const autoRevealTimerRef = useRef<NodeJS.Timeout | null>(null);

  const balance = useMemo(() => {
    if (!user?.balances) return 0;
    const b = user.balances.find((b) => b.currency === currency);
    return b?.available || 0;
  }, [user, currency]);

  useEffect(() => {
    const cfg = TIER_CONFIG[tier];
    setBetAmount(String(cfg.minBet));
  }, [tier]);

  useEffect(() => {
    return () => { if (autoRevealTimerRef.current) clearTimeout(autoRevealTimerRef.current); };
  }, []);

  // -----------------------------------------------------------------------
  // Buy a card
  // -----------------------------------------------------------------------
  const buyCard = useCallback(async () => {
    if (!isAuthenticated) { setError('Please login to play'); return; }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) { setError('Invalid bet amount'); return; }
    if (bet < TIER_CONFIG[tier].minBet) { setError(`Minimum bet for ${TIER_CONFIG[tier].label} is $${TIER_CONFIG[tier].minBet}`); return; }
    if (bet > balance) { setError('Insufficient balance'); return; }

    setIsLoading(true);
    setError(null);
    setPhase('idle');
    setRevealedCount(0);
    setMultiplier(0);
    setProfit(0);

    try {
      const cardTypeMap: Record<Tier, string> = { bronze: 'basic', silver: 'premium', gold: 'vip' };
      const data = await post<ScratchCardResponse>('/casino/games/scratchcard/play', {
        amount: bet,
        currency,
        options: { cardType: cardTypeMap[tier] },
      });

      responseRef.current = data;
      setRoundId(data.roundId);
      setFairness(data.fairness);

      const cells = parseApiGrid(data.result?.grid ?? [], data.result?.winLines ?? []);
      setGrid(cells);
      setPhase('scratching');

      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }

      if (autoReveal) {
        revealAllCells(cells, data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to buy card';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, betAmount, tier, balance, currency, autoReveal]);

  // -----------------------------------------------------------------------
  // Reveal a single cell
  // -----------------------------------------------------------------------
  const revealCell = useCallback((index: number) => {
    if (phase !== 'scratching') return;
    if (grid[index].state !== 'hidden') return;

    setGrid((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], state: 'scratching' };
      return next;
    });

    setTimeout(() => {
      setGrid((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], state: 'revealed' };
        return next;
      });
      setRevealedCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= 9) finalizeCard();
        return newCount;
      });
    }, 400);
  }, [phase, grid]);

  // -----------------------------------------------------------------------
  // Reveal all cells
  // -----------------------------------------------------------------------
  const revealAllCells = useCallback((cells: GridCell[], data: ScratchCardResponse) => {
    let delay = 0;
    cells.forEach((_, i) => {
      autoRevealTimerRef.current = setTimeout(() => {
        setGrid((prev) => { const next = [...prev]; next[i] = { ...next[i], state: 'scratching' }; return next; });
        setTimeout(() => {
          setGrid((prev) => { const next = [...prev]; next[i] = { ...next[i], state: 'revealed' }; return next; });
          setRevealedCount((prev) => {
            const nc = prev + 1;
            if (nc >= 9) setTimeout(() => finalizeFromResponse(data), 300);
            return nc;
          });
        }, 300);
      }, delay);
      delay += 200;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Reveal remaining
  // -----------------------------------------------------------------------
  const revealRemaining = useCallback(() => {
    if (phase !== 'scratching') return;
    const resp = responseRef.current;
    if (!resp) return;

    let delay = 0;
    grid.forEach((cell, i) => {
      if (cell.state === 'hidden') {
        setTimeout(() => {
          setGrid((prev) => { const next = [...prev]; next[i] = { ...next[i], state: 'scratching' }; return next; });
          setTimeout(() => {
            setGrid((prev) => { const next = [...prev]; next[i] = { ...next[i], state: 'revealed' }; return next; });
            setRevealedCount((prev) => {
              const nc = prev + 1;
              if (nc >= 9) setTimeout(() => finalizeFromResponse(resp), 300);
              return nc;
            });
          }, 300);
        }, delay);
        delay += 150;
      }
    });
  }, [phase, grid]);

  // -----------------------------------------------------------------------
  // Finalize
  // -----------------------------------------------------------------------
  const finalizeCard = useCallback(() => {
    const resp = responseRef.current;
    if (!resp) return;
    finalizeFromResponse(resp);
  }, []);

  const finalizeFromResponse = useCallback((data: ScratchCardResponse) => {
    const isWin = data.result.isWin;
    setMultiplier(data.multiplier);
    setProfit(data.profit);
    setPhase(isWin ? 'won' : 'lost');

    setHistory((prev) => [{
      id: data.roundId,
      tier,
      multiplier: data.multiplier,
      won: isWin,
      profit: data.profit,
      grid: grid.map((c) => ({ ...c, state: 'revealed' })),
      timestamp: Date.now(),
    }, ...prev.slice(0, 19)]);
  }, [tier, grid]);

  // -----------------------------------------------------------------------
  // New card
  // -----------------------------------------------------------------------
  const newCard = useCallback(() => {
    setPhase('idle');
    setGrid(generateFallbackGrid());
    setRevealedCount(0);
    setMultiplier(0);
    setProfit(0);
    setRoundId(null);
    responseRef.current = null;
    setError(null);
  }, []);

  // Bet helpers
  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00000001, val * factor).toFixed(8));
  };

  const isActive = phase !== 'idle' && phase !== 'won' && phase !== 'lost';

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Area */}
        <div className={cn(
          'relative bg-[#161B22] border rounded-2xl overflow-hidden p-5',
          phase === 'won' ? 'border-[#10B981]/50' : phase === 'lost' ? 'border-[#EF4444]/50' : 'border-[#30363D]',
        )}>
          {/* Tier badge */}
          <div className="absolute top-3 right-3 z-10">
            <div className="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 bg-[#1C2128] border border-[#30363D]"
              style={{ color: TIER_CONFIG[tier].color }}>
              <span>{TIER_CONFIG[tier].icon}</span>
              <span>{TIER_CONFIG[tier].label}</span>
            </div>
          </div>

          {/* Result banner */}
          <AnimatePresence>
            {(phase === 'won' || phase === 'lost') && (
              <motion.div
                className={cn(
                  'absolute inset-x-0 top-0 py-3 text-center font-bold text-base z-20',
                  phase === 'won' ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444]',
                )}
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                {phase === 'won' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Trophy className="w-4 h-4" />
                    You won {multiplier}x -- +{formatCurrency(profit, currency)}!
                  </span>
                ) : (
                  <span>No match this time</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3x3 Grid -- centered */}
          <div className="flex justify-center mt-6 mb-3">
            <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">
              {grid.map((cell, i) => {
                const symbolData = SYMBOL_MAP[cell.symbol] || SYMBOL_MAP.star;
                return (
                  <motion.button
                    key={i}
                    className={cn(
                      'relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200',
                      cell.state === 'hidden' && phase === 'scratching'
                        ? 'border-[#C8FF00]/30 hover:border-[#C8FF00] hover:scale-105'
                        : 'border-[#30363D]/50',
                      cell.state === 'revealed' && cell.isWinning && 'border-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.3)]',
                      cell.state === 'revealed' && !cell.isWinning && 'border-[#30363D]/30 opacity-70',
                      phase !== 'scratching' && cell.state === 'hidden' && 'cursor-default',
                    )}
                    onClick={() => revealCell(i)}
                    disabled={phase !== 'scratching' || cell.state !== 'hidden'}
                    whileHover={cell.state === 'hidden' && phase === 'scratching' ? { scale: 1.05 } : {}}
                    whileTap={cell.state === 'hidden' && phase === 'scratching' ? { scale: 0.95 } : {}}
                    layout
                  >
                    {/* Hidden overlay */}
                    <AnimatePresence>
                      {cell.state === 'hidden' && (
                        <motion.div
                          className={cn(
                            'absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br',
                            tier === 'bronze' && 'from-amber-700/80 to-amber-900/80',
                            tier === 'silver' && 'from-gray-400/80 to-gray-600/80',
                            tier === 'gold' && 'from-yellow-500/80 to-yellow-700/80',
                          )}
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0, scale: 1.2 }}
                          transition={{ duration: 0.4 }}
                        >
                          <div className="text-2xl opacity-50">?</div>
                          <div className="absolute inset-0 opacity-20"
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)' }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Scratching animation */}
                    <AnimatePresence>
                      {cell.state === 'scratching' && (
                        <motion.div
                          className="absolute inset-0 z-20 flex items-center justify-center bg-white/20"
                          initial={{ opacity: 1 }}
                          animate={{
                            opacity: [1, 0.8, 0.5, 0],
                            clipPath: [
                              'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
                              'polygon(10% 10%, 90% 5%, 95% 90%, 5% 95%)',
                              'polygon(20% 20%, 80% 15%, 85% 80%, 15% 85%)',
                              'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)',
                            ],
                          }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                        >
                          <Sparkles className="w-6 h-6 text-[#C8FF00] animate-spin" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Revealed symbol */}
                    <div className={cn(
                      'absolute inset-0 flex flex-col items-center justify-center bg-[#1C2128]',
                      cell.state === 'revealed' ? 'opacity-100' : 'opacity-0',
                    )}>
                      <motion.span
                        className="text-3xl"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={cell.state === 'revealed' ? { scale: 1, rotate: 0 } : {}}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        {cell.emoji}
                      </motion.span>
                      {cell.isWinning && cell.state === 'revealed' && (
                        <motion.div
                          className="absolute inset-0 border-2 border-[#10B981] rounded-xl"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-[#8B949E] mb-1">
              <span>Revealed: {revealedCount}/9</span>
              {phase === 'scratching' && (
                <button onClick={revealRemaining} className="text-[#C8FF00] hover:text-[#D4FF33] flex items-center gap-1 text-xs font-medium">
                  <Eye className="w-3 h-3" /> Reveal All
                </button>
              )}
            </div>
            <div className="h-1.5 bg-[#0D1117] rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  phase === 'won' ? 'bg-[#10B981]' : phase === 'lost' ? 'bg-[#EF4444]' : 'bg-[#C8FF00]',
                )}
                initial={{ width: '0%' }}
                animate={{ width: `${(revealedCount / 9) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>

        {/* Tier Selector */}
        <div className="space-y-2">
          <label className="text-[#8B949E] text-sm mb-1 block">Card Tier</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TIER_CONFIG) as Tier[]).map((t) => {
              const cfg = TIER_CONFIG[t];
              return (
                <button
                  key={t}
                  onClick={() => { if (phase !== 'idle') return; setTier(t); }}
                  disabled={phase !== 'idle'}
                  className={cn(
                    'relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center',
                    tier === t
                      ? 'border-[#C8FF00] bg-[#C8FF00]/10'
                      : 'border-[#30363D] bg-[#161B22] hover:border-[#484F58]',
                    phase !== 'idle' && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span className="text-xl">{cfg.icon}</span>
                  <span className={cn('text-xs font-bold', tier === t ? 'text-[#C8FF00]' : 'text-[#E6EDF3]')}>{cfg.label}</span>
                  <span className="text-[10px] text-[#8B949E]">${cfg.minBet} min</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bet Amount Control */}
        <div className="space-y-2">
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center">
            <span className="text-[#8B949E] text-xs ml-3">{currency}</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={phase !== 'idle'}
              className="flex-1 bg-transparent text-white font-mono text-sm text-center outline-none disabled:opacity-50"
              step="any"
            />
            <div className="flex items-center gap-1 mr-2">
              <button onClick={() => adjustBet(0.5)} disabled={phase !== 'idle'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => adjustBet(2)} disabled={phase !== 'idle'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Quick presets row */}
          <div className="flex gap-1.5">
            {['0.01', '0.1', '1', '10', '100'].map((v) => (
              <button key={v} onClick={() => setBetAmount(v)} disabled={phase !== 'idle'}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30">
                {v}
              </button>
            ))}
            <button onClick={() => adjustBet(0.5)} disabled={phase !== 'idle'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30">
              1/2
            </button>
            <button onClick={() => adjustBet(2)} disabled={phase !== 'idle'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30">
              2X
            </button>
          </div>
        </div>

        {/* Auto Reveal Toggle */}
        <div className="flex items-center justify-between bg-[#161B22] border border-[#30363D] rounded-xl px-4 py-3">
          <span className="text-sm text-[#8B949E]">Auto Reveal</span>
          <button
            onClick={() => setAutoReveal(!autoReveal)}
            disabled={phase !== 'idle'}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              autoReveal ? 'bg-[#C8FF00]' : 'bg-[#30363D]',
              'disabled:opacity-50',
            )}
          >
            <motion.div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow"
              animate={{ left: autoReveal ? '22px' : '2px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* BUY CARD / New Card -- Lime CTA */}
        {phase === 'idle' ? (
          <motion.button
            onClick={buyCard}
            disabled={isLoading || !isAuthenticated}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all flex items-center justify-center gap-2',
              (isLoading || !isAuthenticated) && 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed',
            )}
          >
            {isLoading ? (
              <><RotateCcw className="w-4 h-4 animate-spin" />Buying...</>
            ) : isAuthenticated ? (
              <><Sparkles className="w-4 h-4" />BUY CARD</>
            ) : (
              'Login to Play'
            )}
          </motion.button>
        ) : phase === 'scratching' ? (
          <div className="text-center text-[#8B949E] text-sm py-3 bg-[#161B22] border border-[#30363D] rounded-xl">
            <Sparkles className="w-4 h-4 inline-block mr-1 text-[#C8FF00]" />
            Tap cells to scratch and reveal!
          </div>
        ) : (
          <motion.button
            onClick={newCard}
            whileTap={{ scale: 0.98 }}
            className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> New Card
          </motion.button>
        )}

        {/* Payout Table */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
          <h3 className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium mb-3">Payout Table</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { match: '3x \uD83D\uDC8E', mult: '50x' },
              { match: '3x \uD83D\uDC51', mult: '25x' },
              { match: '3x 7\uFE0F\u20E3', mult: '15x' },
              { match: '3x \u2B50', mult: '10x' },
              { match: '3x \uD83C\uDF40', mult: '5x' },
              { match: '3x \uD83C\uDF52', mult: '3x' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2">
                <span className="text-sm">{p.match}</span>
                <span className="text-sm font-mono font-bold text-[#C8FF00]">{p.mult}</span>
              </div>
            ))}
          </div>
        </div>

        {/* History dots */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-[#8B949E]" />
                <span className="text-xs font-medium text-[#8B949E]">Recent Cards</span>
              </div>
              <button onClick={() => setHistory([])} className="text-[10px] text-[#484F58] hover:text-[#8B949E] flex items-center gap-1 transition-colors">
                <RotateCcw className="w-2.5 h-2.5" /> Clear
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {history.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.02, type: 'spring', stiffness: 400 }}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono border',
                    entry.won
                      ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                      : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 opacity-60',
                  )}
                >
                  {entry.multiplier > 0 ? `${entry.multiplier}x` : '0x'}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Provably Fair */}
        <AnimatePresence>
          {showFairness && fairness && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C8FF00]" />
                  <span className="text-sm font-semibold text-[#E6EDF3]">Provably Fair</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Server Seed Hash</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">{fairness.serverSeedHash}</div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Client Seed</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">{fairness.clientSeed}</div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Nonce</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E]">{fairness.nonce}</div>
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
          <Link href="/casino" className="text-[#8B949E] hover:text-white transition-colors">
            <Home className="w-5 h-5" />
          </Link>
          <button onClick={() => setShowFairness(!showFairness)} className="text-[#8B949E] hover:text-white transition-colors">
            <Info className="w-5 h-5" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E] hover:text-white transition-colors">
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[#8B949E]">Balance</div>
          <div className="text-sm font-mono font-bold text-[#E6EDF3]">{formatCurrency(balance, currency)}</div>
        </div>
        <div className="bg-[#21262D] border border-[#30363D] rounded-full px-3 py-1">
          <span className="text-[10px] text-[#8B949E] font-medium">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
