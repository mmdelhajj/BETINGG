'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Skull,
  ArrowUp,
  RotateCcw,
  Shield,
  ChevronDown,
  TrendingUp,
  Zap,
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
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type GamePhase = 'idle' | 'playing' | 'won' | 'lost';
type CellState = 'hidden' | 'safe' | 'trap' | 'current' | 'unreachable';

interface TowerResponse {
  roundId: string;
  result: {
    grid?: number[][];
    currentRow: number;
    revealedRows?: number[];
    isGameOver?: boolean;
    isTrap?: boolean;
    hitTrap?: boolean;
    currentMultiplier?: number;
    multiplier?: number;
    trapPositions?: any;
    status?: string;
    difficulty?: string;
    columns?: number;
    totalRows?: number;
  };
  newBalance: number;
  balances?: Array<{ currency: string; balance: number }>;
}

interface GameHistory {
  id: string;
  difficulty: Difficulty;
  rowsClimbed: number;
  betAmount: number;
  multiplier: number;
  won: boolean;
  currency: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_ROWS = 10;

const DIFFICULTY_CONFIG: Record<Difficulty, { cols: number; traps: number; label: string; color: string }> = {
  easy:   { cols: 4, traps: 1, label: 'Easy',   color: 'text-[#10B981]' },
  medium: { cols: 3, traps: 1, label: 'Medium', color: 'text-[#F59E0B]' },
  hard:   { cols: 3, traps: 2, label: 'Hard',   color: 'text-[#F97316]' },
  expert: { cols: 4, traps: 3, label: 'Expert', color: 'text-[#EF4444]' },
};

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'DOGE', 'LTC', 'XRP'];

function getMultiplierForRow(difficulty: Difficulty, row: number): number {
  const { cols, traps } = DIFFICULTY_CONFIG[difficulty];
  const safePerRow = cols - traps;
  let mult = 1;
  const houseEdge = 0.03;
  for (let i = 0; i < row; i++) {
    mult *= cols / safePerRow;
  }
  return parseFloat((mult * (1 - houseEdge)).toFixed(4));
}

// ---------------------------------------------------------------------------
// Tower Game Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function TowerGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Game state
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [betAmount, setBetAmount] = useState('1.00');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [currentRow, setCurrentRow] = useState(0);
  const [revealedCells, setRevealedCells] = useState<Map<string, CellState>>(new Map());
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistory[]>([]);
  const [shakeActive, setShakeActive] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const [celebrateActive, setCelebrateActive] = useState(false);
  const [profitFly, setProfitFly] = useState(false);
  const [revealedTraps, setRevealedTraps] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  const towerRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tower_history');
      if (saved) setGameHistory(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveHistory = useCallback((entry: GameHistory) => {
    setGameHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 10);
      try { localStorage.setItem('tower_history', JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const config = DIFFICULTY_CONFIG[difficulty];
  const cols = config.cols;

  const multiplierLadder = useMemo(() => {
    return Array.from({ length: TOTAL_ROWS }, (_, i) => ({
      row: i + 1,
      multiplier: getMultiplierForRow(difficulty, i + 1),
    }));
  }, [difficulty]);

  useEffect(() => {
    if (activeRowRef.current && towerRef.current) {
      const container = towerRef.current;
      const element = activeRowRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const offset = elementRect.top - containerRect.top - containerRect.height / 2 + elementRect.height / 2;
      container.scrollBy({ top: offset, behavior: 'smooth' });
    }
  }, [currentRow]);

  const currentPayout = useMemo(() => {
    if (currentRow === 0) return 0;
    return parseFloat(betAmount) * currentMultiplier;
  }, [betAmount, currentMultiplier, currentRow]);

  const currentProfit = useMemo(() => {
    return currentPayout - parseFloat(betAmount);
  }, [currentPayout, betAmount]);

  // ---------------------------------------------------------------------------
  // API calls
  // ---------------------------------------------------------------------------

  const startGame = useCallback(async () => {
    if (!isAuthenticated) {
      setErrorMessage('Please log in to play.');
      return;
    }
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const response = await post<TowerResponse>('/casino/tower/start', {
        amount: parseFloat(betAmount),
        currency,
        difficulty,
      });

      setRoundId(response.roundId);
      setCurrentRow(0);
      setRevealedCells(new Map());
      setRevealedTraps(new Set());
      setCurrentMultiplier(1);
      setGamePhase('playing');
      setShakeActive(false);
      setRedFlash(false);
      setCelebrateActive(false);
      setProfitFly(false);

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (/insufficient/i.test(msg)) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else if (/active|in.progress/i.test(msg)) {
        setErrorMessage('You have an active game. Please finish it first.');
      } else {
        setErrorMessage(msg || 'Failed to start game.');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [betAmount, currency, difficulty, isAuthenticated]);

  const pickTile = useCallback(async (row: number, col: number) => {
    if (gamePhase !== 'playing' || isProcessing) return;
    const targetRow = currentRow + 1;
    if (row !== targetRow) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await post<TowerResponse>('/casino/tower/climb', {
        column: col,
      });

      const { result } = response;
      const isTrap = result.isTrap ?? result.hitTrap ?? false;

      if (isTrap) {
        const newCells = new Map(revealedCells);
        newCells.set(`${row}-${col}`, 'trap');

        const newTraps = new Set<string>();
        if (result.grid) {
          result.grid.forEach((gridRow: number[], rowIdx: number) => {
            gridRow.forEach((val: number, colIdx: number) => {
              if (val === -1 || val === 0) {
                const key = `${rowIdx + 1}-${colIdx}`;
                newTraps.add(key);
                if (!newCells.has(key)) {
                  newCells.set(key, 'trap');
                }
              }
            });
          });
        } else if (result.trapPositions) {
          if (Array.isArray(result.trapPositions)) {
            result.trapPositions.forEach((positions: any, rowIdx: number) => {
              if (Array.isArray(positions)) {
                positions.forEach((colIdx: number) => {
                  const key = `${rowIdx + 1}-${colIdx}`;
                  newTraps.add(key);
                  if (!newCells.has(key)) {
                    newCells.set(key, 'trap');
                  }
                });
              }
            });
          }
        }

        setRevealedCells(newCells);
        setRevealedTraps(newTraps);
        setGamePhase('lost');
        setShakeActive(true);
        setRedFlash(true);

        setTimeout(() => {
          setShakeActive(false);
          setRedFlash(false);
        }, 800);

        if (response.newBalance !== undefined) {
          useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
        }

        saveHistory({
          id: roundId || Date.now().toString(),
          difficulty,
          rowsClimbed: currentRow,
          betAmount: parseFloat(betAmount),
          multiplier: currentMultiplier,
          won: false,
          currency,
          timestamp: Date.now(),
        });
      } else {
        const newCells = new Map(revealedCells);
        newCells.set(`${row}-${col}`, 'safe');
        setRevealedCells(newCells);
        const newCurrentRow = result.currentRow ?? currentRow + 1;
        const newMult = result.currentMultiplier ?? result.multiplier ?? currentMultiplier;
        setCurrentRow(newCurrentRow);
        setCurrentMultiplier(newMult);

        if (newCurrentRow >= TOTAL_ROWS) {
          setGamePhase('won');
          setCelebrateActive(true);
          setProfitFly(true);

          if (response.newBalance !== undefined) {
            useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
          }

          saveHistory({
            id: roundId || Date.now().toString(),
            difficulty,
            rowsClimbed: TOTAL_ROWS,
            betAmount: parseFloat(betAmount),
            multiplier: newMult,
            won: true,
            currency,
            timestamp: Date.now(),
          });
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Connection error. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [gamePhase, isProcessing, currentRow, currency, roundId, revealedCells, betAmount, currentMultiplier, difficulty, saveHistory]);

  const cashOut = useCallback(async () => {
    if (gamePhase !== 'playing' || currentRow === 0 || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await post<TowerResponse>('/casino/tower/cashout', {
        roundId,
      });

      setGamePhase('won');
      setCelebrateActive(true);
      setProfitFly(true);

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      if (response.result?.grid) {
        const newCells = new Map(revealedCells);
        response.result.grid.forEach((gridRow: number[], rowIdx: number) => {
          gridRow.forEach((val: number, colIdx: number) => {
            const key = `${rowIdx + 1}-${colIdx}`;
            if (!newCells.has(key)) {
              if (val === -1 || val === 0) {
                newCells.set(key, 'trap');
              }
            }
          });
        });
        setRevealedCells(newCells);
      } else if (response.result?.trapPositions && Array.isArray(response.result.trapPositions)) {
        const newCells = new Map(revealedCells);
        response.result.trapPositions.forEach((positions: any, rowIdx: number) => {
          if (Array.isArray(positions)) {
            positions.forEach((colIdx: number) => {
              const key = `${rowIdx + 1}-${colIdx}`;
              if (!newCells.has(key)) {
                newCells.set(key, 'trap');
              }
            });
          }
        });
        setRevealedCells(newCells);
      }

      saveHistory({
        id: roundId || Date.now().toString(),
        difficulty,
        rowsClimbed: currentRow,
        betAmount: parseFloat(betAmount),
        multiplier: currentMultiplier,
        won: true,
        currency,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to cash out.');
    } finally {
      setIsProcessing(false);
    }
  }, [gamePhase, currentRow, isProcessing, currency, roundId, revealedCells, betAmount, currentMultiplier, difficulty, saveHistory]);

  const resetGame = useCallback(() => {
    setGamePhase('idle');
    setRoundId(null);
    setCurrentRow(0);
    setRevealedCells(new Map());
    setRevealedTraps(new Set());
    setCurrentMultiplier(1);
    setErrorMessage(null);
    setShakeActive(false);
    setRedFlash(false);
    setCelebrateActive(false);
    setProfitFly(false);
  }, []);

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(5));
  };

  const incrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount((val + 0.001).toFixed(5));
  };

  const decrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val - 0.001).toFixed(5));
  };

  const setMaxBet = () => {
    const balance = useAuthStore.getState().user?.balances?.find((b) => b.currency === currency);
    if (balance) {
      setBetAmount(balance.available.toFixed(5));
    }
  };

  const getCellState = useCallback((row: number, col: number): CellState => {
    const key = `${row}-${col}`;
    const revealed = revealedCells.get(key);
    if (revealed) return revealed;

    if (gamePhase === 'playing') {
      const nextRow = currentRow + 1;
      if (row === nextRow) return 'current';
      if (row > nextRow) return 'unreachable';
    }

    return 'hidden';
  }, [revealedCells, gamePhase, currentRow]);

  // ---------------------------------------------------------------------------
  // Render - Cloudbet Mobile Style
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      <div className="pb-20">
        {/* Error Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-4 mt-3 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ TOWER GRID - edge to edge ============ */}
        <motion.div
          className={cn(
            'bg-[#161B22] p-3 relative overflow-hidden transition-colors duration-300',
            gamePhase === 'won' ? 'border-b border-[#10B981]/40' :
            gamePhase === 'lost' ? 'border-b border-[#EF4444]/40' : '',
          )}
          animate={shakeActive ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          {/* Red flash overlay */}
          <AnimatePresence>
            {redFlash && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.15 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#EF4444] z-10 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Celebration overlay */}
          <AnimatePresence>
            {celebrateActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 pointer-events-none"
              >
                {Array.from({ length: 15 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: '50%', y: '50%', opacity: 1, scale: 0 }}
                    animate={{
                      x: `${Math.random() * 100}%`,
                      y: `${Math.random() * 100}%`,
                      opacity: [1, 1, 0],
                      scale: [0, 1.5, 0.5],
                    }}
                    transition={{ duration: 1.5, delay: i * 0.05 }}
                    className={cn(
                      'absolute w-2 h-2 rounded-full',
                      i % 3 === 0 ? 'bg-[#C8FF00]' : i % 3 === 1 ? 'bg-[#10B981]' : 'bg-[#8B5CF6]',
                    )}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Profit fly animation */}
          <AnimatePresence>
            {profitFly && currentRow > 0 && (
              <motion.div
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -100, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 z-20 text-2xl font-bold font-mono text-[#C8FF00] pointer-events-none whitespace-nowrap"
              >
                +{formatCurrency(currentProfit, currency)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current multiplier display at each row */}
          {gamePhase === 'playing' && currentRow > 0 && (
            <div className="mb-3 text-center">
              <span className="text-xs text-[#8B949E]">Current Payout</span>
              <div className="text-3xl font-black font-mono text-[#C8FF00]">{currentMultiplier.toFixed(2)}x</div>
              <span className="text-sm font-mono text-[#10B981]">{formatCurrency(currentPayout, currency)}</span>
            </div>
          )}

          {/* Tower with multiplier ladder */}
          <div className="flex gap-2">
            {/* Multiplier Ladder */}
            <div className="flex flex-col-reverse gap-1.5 flex-shrink-0 w-14">
              {multiplierLadder.map(({ row, multiplier }) => {
                const isActive = gamePhase === 'playing' && row === currentRow + 1;
                const isCompleted = row <= currentRow;

                return (
                  <div
                    key={row}
                    className={cn(
                      'h-11 flex items-center justify-center rounded-lg text-[11px] font-mono font-bold transition-all border',
                      isActive
                        ? 'bg-[#C8FF00]/10 border-[#C8FF00]/40 text-[#C8FF00]'
                        : isCompleted
                          ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                          : 'bg-[#0D1117] border-[#1C2128] text-[#484F58]',
                    )}
                  >
                    {multiplier.toFixed(2)}x
                  </div>
                );
              })}
            </div>

            {/* Tower Grid */}
            <div
              ref={towerRef}
              className="flex-1 flex flex-col-reverse gap-1.5"
            >
              {Array.from({ length: TOTAL_ROWS }, (_, rowIdx) => {
                const row = rowIdx + 1;
                const isActiveRow = gamePhase === 'playing' && row === currentRow + 1;

                return (
                  <div
                    key={row}
                    ref={isActiveRow ? activeRowRef : undefined}
                    className={cn(
                      'grid gap-1.5',
                      cols === 3 ? 'grid-cols-3' : 'grid-cols-4',
                    )}
                  >
                    {Array.from({ length: cols }, (_, colIdx) => {
                      const cellState = getCellState(row, colIdx);
                      const key = `${row}-${colIdx}`;

                      return (
                        <motion.button
                          key={key}
                          onClick={() => pickTile(row, colIdx)}
                          disabled={cellState !== 'current' || isProcessing}
                          whileHover={cellState === 'current' ? { scale: 1.05 } : {}}
                          whileTap={cellState === 'current' ? { scale: 0.95 } : {}}
                          className={cn(
                            'h-11 rounded-lg flex items-center justify-center transition-all border relative overflow-hidden',
                            cellState === 'current' &&
                              'bg-[#1C2128] border-[#C8FF00]/40 cursor-pointer hover:bg-[#C8FF00]/10 hover:border-[#C8FF00]/60',
                            cellState === 'hidden' &&
                              'bg-[#1C2128] border-[#30363D]/50 cursor-not-allowed',
                            cellState === 'unreachable' &&
                              'bg-[#0D1117] border-[#1C2128] cursor-not-allowed opacity-30',
                            cellState === 'safe' &&
                              'bg-[#10B981]/15 border-[#10B981]/40 cursor-default',
                            cellState === 'trap' &&
                              'bg-[#EF4444]/15 border-[#EF4444]/40 cursor-default',
                          )}
                        >
                          {cellState === 'current' && (
                            <motion.div
                              className="absolute inset-0 rounded-lg border-2 border-[#C8FF00]/30"
                              animate={{ opacity: [0.3, 0.7, 0.3] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}

                          {(cellState === 'hidden' || cellState === 'unreachable') && (
                            <div className="w-2 h-2 rounded-full bg-[#30363D]/60" />
                          )}

                          {cellState === 'current' && (
                            <motion.div
                              className="w-3 h-3 rounded-full bg-[#C8FF00]/40"
                              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                          )}

                          <AnimatePresence>
                            {cellState === 'safe' && (
                              <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                              >
                                <Star className="w-5 h-5 text-[#10B981] fill-[#10B981]/30" />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {cellState === 'trap' && (
                              <motion.div
                                initial={{ scale: 0, rotate: 180 }}
                                animate={{ scale: [0, 1.3, 1], rotate: [180, 0, 0] }}
                                transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                              >
                                <Skull className="w-5 h-5 text-[#EF4444]" />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {cellState === 'trap' && revealedTraps.has(key) && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0.8 }}
                              animate={{ scale: 3, opacity: 0 }}
                              transition={{ duration: 0.6 }}
                              className="absolute inset-0 rounded-full bg-[#EF4444]/30 pointer-events-none"
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Row numbers */}
            <div className="flex flex-col-reverse gap-1.5 flex-shrink-0 w-6">
              {Array.from({ length: TOTAL_ROWS }, (_, i) => {
                const row = i + 1;
                const isActive = gamePhase === 'playing' && row === currentRow + 1;
                const isCompleted = row <= currentRow;

                return (
                  <div
                    key={row}
                    className={cn(
                      'h-11 flex items-center justify-center text-xs font-mono rounded-md transition-all',
                      isActive ? 'text-[#C8FF00] font-bold' :
                      isCompleted ? 'text-[#10B981]' : 'text-[#484F58]',
                    )}
                  >
                    {row}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ground level */}
          <div className="mt-3 flex items-center gap-2 justify-center">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#30363D] to-transparent" />
            <span className="text-[10px] text-[#484F58] uppercase tracking-wider">Ground</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#30363D] to-transparent" />
          </div>
        </motion.div>

        {/* ============ GAME RESULT OVERLAY ============ */}
        <AnimatePresence>
          {(gamePhase === 'won' || gamePhase === 'lost') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'mx-4 mt-3 bg-[#161B22] border rounded-2xl p-5 text-center',
                gamePhase === 'won' ? 'border-[#10B981]/40' : 'border-[#EF4444]/40',
              )}
            >
              {gamePhase === 'won' ? (
                <>
                  <p className="text-2xl font-black text-[#10B981]">Cashed Out!</p>
                  <p className="text-lg font-bold font-mono text-[#C8FF00] mt-1">
                    +{formatCurrency(currentProfit, currency)}
                  </p>
                  <p className="text-xs text-[#8B949E] mt-1">at {currentMultiplier.toFixed(2)}x - Row {currentRow}</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-black text-[#EF4444]">Trap Hit!</p>
                  <p className="text-sm text-[#8B949E] mt-1">Lost {formatCurrency(parseFloat(betAmount), currency)}</p>
                </>
              )}
              <div className="flex gap-2 mt-4">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { resetGame(); setTimeout(() => startGame(), 50); }}
                  className="flex-1 bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl text-base flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={resetGame}
                  className="bg-[#2D333B] text-white font-bold py-3.5 rounded-xl px-5"
                >
                  New Bet
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ BET CONTROLS ============ */}
        <div className="px-4 mt-3">
          <div className="bg-[#161B22] rounded-2xl border border-[#30363D] overflow-hidden">
            {/* Manual / Auto Toggle */}
            <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex mx-4 mt-4">
              <button
                onClick={() => setActiveTab('manual')}
                className={cn(
                  'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                  activeTab === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
                )}
              >
                Manual
              </button>
              <button
                onClick={() => setActiveTab('auto')}
                className={cn(
                  'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                  activeTab === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
                )}
              >
                Auto
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Difficulty Selector: Easy/Medium/Hard/Expert as pills, active = purple */}
              <div>
                <label className="text-[#8B949E] text-sm mb-1 block font-medium">Difficulty</label>
                <div className="flex gap-1.5">
                  {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
                    const dc = DIFFICULTY_CONFIG[d];
                    return (
                      <button
                        key={d}
                        onClick={() => gamePhase === 'idle' && setDifficulty(d)}
                        disabled={gamePhase !== 'idle'}
                        className={cn(
                          'flex-1 h-9 rounded-xl text-xs font-bold transition-all',
                          difficulty === d
                            ? 'bg-[#8B5CF6] text-white'
                            : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-40',
                        )}
                      >
                        {dc.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#484F58] mt-1.5">
                  {config.cols} cols, {config.traps} trap{config.traps > 1 ? 's' : ''} per row
                </p>
              </div>

              {/* Bet Amount */}
              <div>
                <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                  <span className="text-[#8B949E] text-xs mr-2">{currency}</span>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={gamePhase !== 'idle'}
                    step="any"
                    min="0"
                    className="flex-1 bg-transparent text-sm font-mono text-[#E6EDF3] text-center focus:outline-none disabled:opacity-40"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={decrementBet}
                      disabled={gamePhase !== 'idle'}
                      className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={incrementBet}
                      disabled={gamePhase !== 'idle'}
                      className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Quick presets */}
                <div className="flex gap-1.5 mt-2">
                  {['0.01', '0.1', '1', '10', '100'].map((v) => (
                    <button
                      key={v}
                      onClick={() => gamePhase === 'idle' && setBetAmount(v)}
                      disabled={gamePhase !== 'idle'}
                      className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    onClick={() => adjustBet(0.5)}
                    disabled={gamePhase !== 'idle'}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => adjustBet(2)}
                    disabled={gamePhase !== 'idle'}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    2X
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              {gamePhase === 'idle' && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={startGame}
                  disabled={isProcessing || !isAuthenticated}
                  className={cn(
                    'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base flex items-center justify-center gap-2 transition-all',
                    (isProcessing || !isAuthenticated) && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      {isAuthenticated ? 'Start Climbing' : 'Login to Play'}
                    </>
                  )}
                </motion.button>
              )}

              {gamePhase === 'playing' && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={cashOut}
                  disabled={currentRow === 0 || isProcessing}
                  className={cn(
                    'font-bold py-3.5 rounded-xl w-full text-base flex items-center justify-center gap-2 transition-all',
                    currentRow > 0
                      ? 'bg-[#3D3D20] text-[#C8FF00]'
                      : 'bg-[#2D333B] text-white opacity-50 cursor-not-allowed',
                  )}
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-[#C8FF00]/30 border-t-[#C8FF00] rounded-full animate-spin" />
                  ) : currentRow > 0 ? (
                    <>
                      <Trophy className="w-4 h-4" />
                      Cash Out {formatCurrency(currentPayout, currency)}
                    </>
                  ) : (
                    'Pick a tile to start'
                  )}
                </motion.button>
              )}

              {/* Progress bar */}
              {gamePhase === 'playing' && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#8B949E]">Progress</span>
                    <span className="text-[#E6EDF3] font-mono">{currentRow}/{TOTAL_ROWS}</span>
                  </div>
                  <div className="h-2 bg-[#0D1117] rounded-full overflow-hidden border border-[#30363D]">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#C8FF00] to-[#10B981] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(currentRow / TOTAL_ROWS) * 100}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============ HISTORY ============ */}
        {gameHistory.length > 0 && (
          <div className="px-4 mt-3">
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-[#C8FF00]" />
                Recent Games
              </h3>
              <div className="space-y-2">
                {gameHistory.map((game, i) => (
                  <motion.div
                    key={game.id + i}
                    initial={i === 0 ? { opacity: 0, x: 10 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      'p-2.5 rounded-lg border text-xs flex items-center justify-between',
                      game.won
                        ? 'bg-[#10B981]/5 border-[#10B981]/20'
                        : 'bg-[#EF4444]/5 border-[#EF4444]/20',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold',
                        game.won ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]',
                      )}>
                        {game.rowsClimbed}
                      </div>
                      <div>
                        <span className={cn(
                          'font-mono font-semibold',
                          game.won ? 'text-[#10B981]' : 'text-[#EF4444]',
                        )}>
                          {game.won ? '+' : '-'}{formatCurrency(
                            game.won ? game.betAmount * game.multiplier - game.betAmount : game.betAmount,
                            game.currency,
                          )}
                        </span>
                        <span className="text-[10px] text-[#484F58] block">
                          {DIFFICULTY_CONFIG[game.difficulty]?.label || game.difficulty} - {game.multiplier.toFixed(2)}x
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ FIXED BOTTOM BAR ============ */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <button className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowFairness(!showFairness)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {formatCurrency(parseFloat(betAmount) || 0, currency)} {currency}
        </span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
