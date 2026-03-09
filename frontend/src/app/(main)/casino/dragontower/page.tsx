'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Shield,
  History,
  RotateCcw,
  ShieldCheck,
  Volume2,
  VolumeX,
  ArrowUp,
  Zap,
  Skull,
  Trophy,
  ChevronDown,
  LogOut,
  Coins,
  Home,
  Info,
  Minus,
  Plus,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { post } from '@/lib/api';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type GamePhase = 'idle' | 'playing' | 'won' | 'lost';
type TileState = 'hidden' | 'safe' | 'dragon' | 'dimmed';

interface TowerTile {
  state: TileState;
  col: number;
  row: number;
}

interface TowerRow {
  tiles: TowerTile[];
  cleared: boolean;
  multiplier: number;
}

// Backend returns { ...gameResult, newBalance } where gameResult is a GameResult with:
// - result: { status, difficulty, isDragon?, currentLevel, position, dragonPositions, ... }
// - roundId, game, betAmount, payout, profit, multiplier, fairness
interface DragonTowerResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    safe?: boolean;
    isDragon?: boolean;
    dragonPositions?: number[];
    currentRow?: number;
    currentLevel?: number;
    currentMultiplier?: number;
    multiplier?: number;
    nextMultiplier?: number;
    isGameOver?: boolean;
    revealedGrid?: number[][];
    grid?: number[][];
    cashoutMultiplier?: number;
    status?: string;
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
  difficulty: Difficulty;
  rowsClimbed: number;
  multiplier: number;
  won: boolean;
  profit: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    label: string;
    cols: number;
    safeCount: number;
    color: string;
    gradient: string;
    description: string;
  }
> = {
  easy: {
    label: 'Easy',
    cols: 3,
    safeCount: 2,
    color: '#10B981',
    gradient: 'from-green-600 to-green-800',
    description: '3 tiles, 2 safe',
  },
  medium: {
    label: 'Medium',
    cols: 3,
    safeCount: 1,
    color: '#F59E0B',
    gradient: 'from-yellow-600 to-yellow-800',
    description: '3 tiles, 1 safe',
  },
  hard: {
    label: 'Hard',
    cols: 4,
    safeCount: 1,
    color: '#EF4444',
    gradient: 'from-red-600 to-red-800',
    description: '4 tiles, 1 safe',
  },
  expert: {
    label: 'Expert',
    cols: 4,
    safeCount: 1,
    color: '#DC2626',
    gradient: 'from-red-700 to-red-950',
    description: '4 tiles, 1 safe, higher mult',
  },
};

const TOTAL_ROWS = 10;

// Client-side multiplier estimates
function calcMultipliers(difficulty: Difficulty): number[] {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const houseEdge = 0.03;
  const pSafe = cfg.safeCount / cfg.cols;
  const mults: number[] = [];
  let cumMult = 1;
  for (let i = 0; i < TOTAL_ROWS; i++) {
    cumMult *= 1 / pSafe;
    mults.push(parseFloat((cumMult * (1 - houseEdge)).toFixed(2)));
  }
  return mults;
}

function buildTower(difficulty: Difficulty): TowerRow[] {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const mults = calcMultipliers(difficulty);
  const rows: TowerRow[] = [];
  for (let r = 0; r < TOTAL_ROWS; r++) {
    const tiles: TowerTile[] = [];
    for (let c = 0; c < cfg.cols; c++) {
      tiles.push({ state: 'hidden', col: c, row: r });
    }
    rows.push({ tiles, cleared: false, multiplier: mults[r] });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DragonTowerPage() {
  // Auth
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [betAmount, setBetAmount] = useState<string>('1.00');
  const [currency, setCurrency] = useState<string>('USDT');
  const [tower, setTower] = useState<TowerRow[]>(() => buildTower('easy'));
  const [currentRow, setCurrentRow] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(1);
  const [profit, setProfit] = useState(0);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [fairness, setFairness] = useState<DragonTowerResponse['fairness'] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  const towerContainerRef = useRef<HTMLDivElement>(null);

  // Balance
  const balance = useMemo(() => {
    if (!user?.balances) return 0;
    const b = user.balances.find((b) => b.currency === currency);
    return b?.available || 0;
  }, [user, currency]);

  // Pre-computed multipliers
  const multipliers = useMemo(() => calcMultipliers(difficulty), [difficulty]);

  // Scroll to current row
  useEffect(() => {
    if (phase === 'playing' && towerContainerRef.current) {
      const container = towerContainerRef.current;
      const rowEl = container.querySelector(`[data-row="${currentRow}"]`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentRow, phase]);

  // Reset tower on difficulty change
  useEffect(() => {
    if (phase === 'idle') {
      setTower(buildTower(difficulty));
    }
  }, [difficulty, phase]);

  // -----------------------------------------------------------------------
  // Start game
  // -----------------------------------------------------------------------
  const startGame = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Please login to play');
      return;
    }
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) {
      setError('Invalid bet amount');
      return;
    }
    if (bet > balance) {
      setError('Insufficient balance');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await post<DragonTowerResponse>('/casino/dragontower/start', {
        amount: bet,
        currency,
        difficulty,
      });

      setRoundId(data.roundId);
      setFairness(data.fairness);
      setTower(buildTower(difficulty));
      setCurrentRow(0);
      setCurrentMultiplier(1);
      setNextMultiplier(multipliers[0]);
      setProfit(0);
      setPhase('playing');

      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to start game';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, betAmount, balance, currency, difficulty, multipliers]);

  // -----------------------------------------------------------------------
  // Pick a tile
  // -----------------------------------------------------------------------
  const pickTile = useCallback(
    async (col: number) => {
      if (phase !== 'playing' || isLoading) return;
      if (currentRow >= TOTAL_ROWS) return;

      // Check correct row
      const row = tower[currentRow];
      if (row.cleared) return;
      if (row.tiles[col].state !== 'hidden') return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await post<DragonTowerResponse>('/casino/dragontower/pick', {
          roundId,
          position: col,
        });

        setFairness(data.fairness);

        // Backend returns result.isDragon (true = dragon hit), not result.safe
        const isSafe = data.result.safe ?? !data.result.isDragon;
        if (isSafe) {
          // Safe tile -- mark it
          setTower((prev) => {
            const next = [...prev];
            const rowCopy = { ...next[currentRow] };
            const tilesCopy = [...rowCopy.tiles];
            tilesCopy[col] = { ...tilesCopy[col], state: 'safe' };
            rowCopy.tiles = tilesCopy;
            rowCopy.cleared = true;
            next[currentRow] = rowCopy;
            return next;
          });

          // Backend returns result.multiplier or result.currentMultiplier
          const newMult = data.result.currentMultiplier ?? data.result.multiplier ?? multipliers[currentRow];
          setCurrentMultiplier(newMult);
          setNextMultiplier(data.result.nextMultiplier || (currentRow + 1 < TOTAL_ROWS ? multipliers[currentRow + 1] : newMult));

          const newRow = currentRow + 1;
          setCurrentRow(newRow);

          // Check if reached the top
          if (newRow >= TOTAL_ROWS || data.result.isGameOver) {
            setProfit(data.profit);
            setPhase('won');
            setMultiplierFinal(newMult);
            addHistory(true, data.profit, newMult, newRow);
            if (data.newBalance !== undefined) {
              useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
            }
          }
        } else {
          // Dragon! Bust!
          const dragonPositions = data.result.dragonPositions || [];
          setTower((prev) => {
            const next = [...prev];
            const rowCopy = { ...next[currentRow] };
            const tilesCopy = [...rowCopy.tiles];
            // Show dragon on picked tile
            tilesCopy[col] = { ...tilesCopy[col], state: 'dragon' };
            // Reveal safe tiles
            tilesCopy.forEach((t, i) => {
              if (i !== col && !dragonPositions.includes(i)) {
                tilesCopy[i] = { ...tilesCopy[i], state: 'safe' };
              } else if (dragonPositions.includes(i) && i !== col) {
                tilesCopy[i] = { ...tilesCopy[i], state: 'dragon' };
              }
            });
            rowCopy.tiles = tilesCopy;
            next[currentRow] = rowCopy;

            // Reveal remaining rows (backend returns 'grid' not 'revealedGrid')
            const revealGrid = data.result.revealedGrid || data.result.grid;
            if (revealGrid) {
              revealGrid.forEach((dragonCols: number[], rowIdx: number) => {
                if (rowIdx !== currentRow && !next[rowIdx].cleared) {
                  const rc = { ...next[rowIdx] };
                  const tc = [...rc.tiles];
                  tc.forEach((tile, ci) => {
                    if (dragonCols.includes(ci)) {
                      tc[ci] = { ...tc[ci], state: 'dragon' };
                    } else {
                      tc[ci] = { ...tc[ci], state: 'dimmed' };
                    }
                  });
                  rc.tiles = tc;
                  next[rowIdx] = rc;
                }
              });
            }

            return next;
          });

          setPhase('lost');
          setProfit(data.profit);
          addHistory(false, data.profit, 0, currentRow);
          if (data.newBalance !== undefined) {
            useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to pick tile';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [phase, isLoading, currentRow, tower, betAmount, currency, difficulty, roundId, multipliers],
  );

  // -----------------------------------------------------------------------
  // Cashout
  // -----------------------------------------------------------------------
  const cashout = useCallback(async () => {
    if (phase !== 'playing' || cashingOut) return;
    if (currentRow === 0) return; // Can't cashout on first row

    setCashingOut(true);
    setError(null);

    try {
      const data = await post<DragonTowerResponse>('/casino/dragontower/cashout', {
        roundId,
      });

      setProfit(data.profit);
      setCurrentMultiplier(data.multiplier);
      setPhase('won');
      addHistory(true, data.profit, data.multiplier, currentRow);

      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to cashout';
      setError(msg);
    } finally {
      setCashingOut(false);
    }
  }, [phase, cashingOut, currentRow, betAmount, currency, difficulty, roundId]);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const [multiplierFinal, setMultiplierFinal] = useState(0);

  const addHistory = useCallback(
    (won: boolean, profit: number, mult: number, rows: number) => {
      setHistory((prev) => [
        {
          id: roundId || String(Date.now()),
          difficulty,
          rowsClimbed: rows,
          multiplier: mult,
          won,
          profit,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 19),
      ]);
    },
    [roundId, difficulty],
  );

  const resetGame = useCallback(() => {
    setPhase('idle');
    setTower(buildTower(difficulty));
    setCurrentRow(0);
    setCurrentMultiplier(1);
    setNextMultiplier(multipliers[0]);
    setProfit(0);
    setRoundId(null);
    setError(null);
    setMultiplierFinal(0);
  }, [difficulty, multipliers]);

  // -----------------------------------------------------------------------
  // Tile rendering
  // -----------------------------------------------------------------------
  const renderTile = (tile: TowerTile, rowIdx: number, isActive: boolean) => {
    const isSafe = tile.state === 'safe';
    const isDragon = tile.state === 'dragon';
    const isDimmed = tile.state === 'dimmed';
    const isHidden = tile.state === 'hidden';

    return (
      <motion.button
        key={`${rowIdx}-${tile.col}`}
        onClick={() => pickTile(tile.col)}
        disabled={!isActive || isLoading || !isHidden}
        className={cn(
          'relative aspect-square rounded-lg border transition-all duration-200 overflow-hidden',
          'flex items-center justify-center text-sm font-bold',
          isHidden && isActive
            ? 'cursor-pointer border-[#C8FF00]/40 bg-[#C8FF00]/5 hover:bg-[#C8FF00]/15 hover:border-[#C8FF00]/70 hover:scale-105'
            : isHidden && !isActive
              ? 'cursor-default border-[#30363D] bg-[#161B22]/60'
              : '',
          isSafe && 'border-[#10B981]/50 bg-[#10B981]/10',
          isDragon && 'border-[#EF4444]/50 bg-[#EF4444]/10',
          isDimmed && 'border-[#30363D]/30 bg-[#161B22]/30 opacity-30',
          'disabled:cursor-default',
        )}
        whileHover={isActive && isHidden ? { scale: 1.08 } : {}}
        whileTap={isActive && isHidden ? { scale: 0.95 } : {}}
      >
        <AnimatePresence mode="wait">
          {isSafe && (
            <motion.div
              key="safe"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              className="flex flex-col items-center"
            >
              <span className="text-lg sm:text-xl">&#x1F95A;</span>
            </motion.div>
          )}
          {isDragon && (
            <motion.div
              key="dragon"
              initial={{ scale: 0, rotate: 90 }}
              animate={{ scale: 1, rotate: 0 }}
              className="flex flex-col items-center"
            >
              <span className="text-lg sm:text-xl">&#x1F409;</span>
              <motion.div
                className="absolute inset-0 bg-[#EF4444]/20"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>
          )}
          {isHidden && isActive && (
            <motion.div
              key="active-hidden"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[#C8FF00]/60 text-xs font-mono"
            >
              ?
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  // -----------------------------------------------------------------------
  // Bet helpers
  // -----------------------------------------------------------------------
  const adjustBet = (delta: number) => {
    const current = parseFloat(betAmount) || 0;
    const next = Math.max(0.01, current + delta);
    setBetAmount(next.toFixed(2));
  };

  const presetAmounts = [0.01, 0.1, 1, 10, 100];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* CRYPTOBET Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-sm font-bold tracking-widest text-white/80">CRYPTOBET</span>
      </div>

      {/* Tower Grid -- edge-to-edge */}
      <div className="bg-[#161B22] border-b border-[#30363D]">
        {/* Current multiplier bar */}
        {phase === 'playing' && (
          <div className="flex items-center justify-between bg-[#0D1117] px-4 py-2">
            <div>
              <span className="text-[10px] text-[#8B949E] block">Current</span>
              <span className="text-base font-mono font-bold text-[#C8FF00]">{currentMultiplier}x</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-[#8B949E] block">Row {currentRow}/{TOTAL_ROWS}</span>
              <span className="text-xs text-gray-400">Pick a tile below</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#8B949E] block">Potential Win</span>
              <span className="text-base font-mono font-bold text-[#10B981]">
                {formatCurrency(parseFloat(betAmount) * currentMultiplier, currency)}
              </span>
            </div>
          </div>
        )}

        {/* Result Banner */}
        <AnimatePresence>
          {(phase === 'won' || phase === 'lost') && (
            <motion.div
              className={cn(
                'py-3 px-4 text-center font-bold text-sm',
                phase === 'won'
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'bg-[#EF4444]/10 text-[#EF4444]',
              )}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {phase === 'won' ? (
                <span className="flex items-center justify-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Cashed out at {currentMultiplier}x -- +{formatCurrency(profit, currency)}!
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Skull className="w-4 h-4" />
                  Dragon got you! Lost {formatCurrency(Math.abs(profit || parseFloat(betAmount)), currency)}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div
          ref={towerContainerRef}
          className="flex flex-col-reverse gap-1.5 max-h-[380px] overflow-y-auto scroll-smooth p-3"
        >
          {tower.map((row, rowIdx) => {
            const isActive = phase === 'playing' && rowIdx === currentRow;
            const isCleared = row.cleared;
            const isAbove = rowIdx > currentRow;

            return (
              <motion.div
                key={rowIdx}
                data-row={rowIdx}
                className={cn(
                  'flex items-center gap-2',
                  isActive && 'relative z-10',
                )}
                initial={false}
                animate={{
                  opacity: isAbove && phase === 'playing' ? 0.35 : 1,
                }}
              >
                {/* Row label */}
                <div className="w-14 flex-shrink-0 text-right pr-1">
                  <div
                    className={cn(
                      'text-[10px] font-mono',
                      isActive ? 'text-[#C8FF00] font-bold' : isCleared ? 'text-[#10B981]' : 'text-gray-600',
                    )}
                  >
                    {row.multiplier}x
                  </div>
                  <div className="text-[9px] text-gray-700">
                    Lv {rowIdx + 1}
                  </div>
                </div>

                {/* Tiles */}
                <div className="flex-1">
                  <div
                    className="grid gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${row.tiles.length}, 1fr)`,
                    }}
                  >
                    {row.tiles.map((tile) => renderTile(tile, rowIdx, isActive))}
                  </div>
                </div>

                {/* Active row indicator */}
                {isActive && (
                  <motion.div
                    className="w-5 flex-shrink-0 flex justify-center"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-[#C8FF00]" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Controls -- px-4 */}
      <div className="px-4 py-4 space-y-3">
        {/* Difficulty Selector */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Difficulty</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
              const cfg = DIFFICULTY_CONFIG[d];
              return (
                <button
                  key={d}
                  onClick={() => {
                    if (phase !== 'idle') return;
                    setDifficulty(d);
                  }}
                  disabled={phase !== 'idle'}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center transition-all text-xs',
                    difficulty === d
                      ? 'bg-[#C8FF00]/10 border border-[#C8FF00]/40 text-[#C8FF00]'
                      : 'bg-[#0D1117] border border-[#30363D] text-gray-400 hover:border-gray-500',
                    phase !== 'idle' && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span className="font-bold text-[11px]">{cfg.label}</span>
                  <span className="text-[9px] text-gray-600">{cfg.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              activeTab === 'manual'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E] hover:text-white',
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              activeTab === 'auto'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E] hover:text-white',
            )}
          >
            Auto
          </button>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <Coins className="w-4 h-4 text-[#C8FF00] mr-2 flex-shrink-0" />
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={phase !== 'idle'}
              min="0.01"
              step="0.01"
              className="flex-1 bg-transparent text-white font-mono text-center text-base focus:outline-none disabled:opacity-50"
            />
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => adjustBet(-1)}
                disabled={phase !== 'idle'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D444D] disabled:opacity-40 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => adjustBet(1)}
                disabled={phase !== 'idle'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D444D] disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {presetAmounts.map((val) => (
              <button
                key={val}
                onClick={() => setBetAmount(val.toFixed(2))}
                disabled={phase !== 'idle'}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
              >
                {val}
              </button>
            ))}
            <button
              onClick={() => setBetAmount((prev) => String(Math.max(0.01, parseFloat(prev) / 2)))}
              disabled={phase !== 'idle'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => setBetAmount((prev) => String(Math.min(balance, parseFloat(prev) * 2)))}
              disabled={phase !== 'idle'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-gray-500 disabled:opacity-40 transition-colors"
            >
              2X
            </button>
          </div>
        </div>

        {/* Multiplier Ladder (compact) */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Multiplier Ladder</label>
          <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto bg-[#0D1117] border border-[#30363D] rounded-lg p-2">
            {[...multipliers].reverse().map((m, idx) => {
              const rowIdx = TOTAL_ROWS - 1 - idx;
              return (
                <div
                  key={rowIdx}
                  className={cn(
                    'flex items-center justify-between px-3 py-1 rounded text-xs',
                    rowIdx === currentRow && phase === 'playing'
                      ? 'bg-[#C8FF00]/10 border border-[#C8FF00]/20'
                      : rowIdx < currentRow && phase === 'playing'
                        ? 'bg-[#10B981]/5'
                        : '',
                  )}
                >
                  <span className="text-[#8B949E]">Lv {rowIdx + 1}</span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      rowIdx === currentRow && phase === 'playing'
                        ? 'text-[#C8FF00]'
                        : rowIdx < currentRow && phase === 'playing'
                          ? 'text-[#10B981]'
                          : 'text-gray-600',
                    )}
                  >
                    {m}x
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        {phase === 'idle' ? (
          <motion.button
            onClick={startGame}
            disabled={isLoading || !isAuthenticated}
            className={cn(
              'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all',
              'hover:bg-[#d4ff33] disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4 animate-spin" />
                Starting...
              </span>
            ) : !isAuthenticated ? (
              <Link href="/login" className="flex items-center justify-center gap-2">
                Login to Play
              </Link>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Flame className="w-4 h-4" />
                START CLIMBING
              </span>
            )}
          </motion.button>
        ) : phase === 'playing' ? (
          <div className="space-y-2">
            <div className="text-center text-xs text-[#8B949E] py-1">
              Pick a tile on row {currentRow + 1} to continue
            </div>
            <motion.button
              onClick={cashout}
              disabled={cashingOut || currentRow === 0}
              className={cn(
                'w-full font-bold py-3.5 rounded-xl text-base transition-all',
                currentRow === 0
                  ? 'bg-[#2D333B] text-gray-500 opacity-60 cursor-not-allowed'
                  : 'bg-[#3D3D20] text-[#C8FF00] hover:bg-[#4D4D30]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              whileHover={currentRow > 0 ? { scale: 1.02 } : {}}
              whileTap={currentRow > 0 ? { scale: 0.98 } : {}}
            >
              {cashingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  Cashing out...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" />
                  CASH OUT {currentMultiplier}x -- {formatCurrency(parseFloat(betAmount) * currentMultiplier, currency)}
                </span>
              )}
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={resetGame}
            className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all hover:bg-[#d4ff33]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Play Again
            </span>
          </motion.button>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="text-[#EF4444] text-xs text-center bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              className="bg-[#161B22] border border-[#30363D] rounded-xl p-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                <History className="w-3.5 h-3.5" /> Recent Climbs
              </h3>
              {history.length === 0 ? (
                <p className="text-[10px] text-gray-600 text-center py-3">No games yet</p>
              ) : (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'flex items-center justify-between bg-[#0D1117] rounded-lg px-3 py-2',
                        'border-l-2',
                        entry.won ? 'border-l-[#10B981]' : 'border-l-[#EF4444]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#8B949E]">{entry.difficulty}</span>
                        <span className="text-[10px] text-gray-400">
                          Lv {entry.rowsClimbed}/{TOTAL_ROWS}
                        </span>
                        {entry.multiplier > 0 && (
                          <span className="text-[10px] font-mono text-[#C8FF00]">{entry.multiplier}x</span>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-mono font-bold',
                          entry.won ? 'text-[#10B981]' : 'text-[#EF4444]',
                        )}
                      >
                        {entry.won ? '+' : ''}
                        {formatCurrency(entry.profit, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fairness */}
        <AnimatePresence>
          {showFairness && fairness && (
            <motion.div
              className="bg-[#161B22] border border-[#30363D] rounded-xl p-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                Provably Fair
              </h3>
              <div className="space-y-2 text-[10px] font-mono">
                <div>
                  <span className="text-[#8B949E]">Round ID: </span>
                  <span className="text-gray-300">{roundId}</span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Server Seed Hash: </span>
                  <span className="text-gray-300 break-all">{fairness.serverSeedHash}</span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Client Seed: </span>
                  <span className="text-gray-300">{fairness.clientSeed}</span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Nonce: </span>
                  <span className="text-gray-300">{fairness.nonce}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Home className="w-4 h-4 text-[#8B949E] hover:text-white transition-colors" />
          </Link>
          <button onClick={() => setShowHistory(!showHistory)}>
            <Info className={cn('w-4 h-4 transition-colors', showHistory ? 'text-[#C8FF00]' : 'text-[#8B949E] hover:text-white')} />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#8B949E] hover:text-white transition-colors" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#8B949E] hover:text-white transition-colors" />
            )}
          </button>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-mono text-white font-bold">
            {formatCurrency(balance, currency)}
          </span>
          <span className="text-[9px] text-[#8B949E] ml-1">{currency}</span>
        </div>
        <button
          onClick={() => setShowFairness(!showFairness)}
          className={cn(
            'px-2 py-1 rounded-md text-[9px] font-bold transition-colors',
            showFairness
              ? 'bg-purple-500/30 text-purple-300'
              : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
          )}
        >
          Provably Fair Game
        </button>
      </div>
    </div>
  );
}
