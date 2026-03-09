'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post, get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TileState = 'hidden' | 'gem' | 'mine' | 'dimmed';
type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

interface GameResponse {
  roundId: string;
  result?: {
    grid?: number[][];
    revealed?: number[];
    minePositions?: number[];
    currentMultiplier?: number;
    gemsFound?: number;
    isGameOver?: boolean;
    isMine?: boolean;
    nextMultiplier?: number;
    revealedCount?: number;
    gameOver?: boolean;
  };
  newBalance?: number;
  // Legacy response fields
  mineCount?: number;
  totalTiles?: number;
  serverSeedHash?: string;
  position?: number;
  isMine?: boolean;
  minePositions?: number[];
  currentMultiplier?: number;
  nextMultiplier?: number;
  revealedCount?: number;
  isGameOver?: boolean;
  gameOver?: boolean;
  payout?: number;
  multiplier?: number;
  balances?: Array<{ currency: string; balance: number }>;
}

interface HistoryEntry {
  id: string;
  mineCount: number;
  gemsFound: number;
  multiplier: number;
  won: boolean;
  profit: number;
  grid: TileState[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_SIZE = 25;
const MINE_PRESETS = [3, 5, 9, 12, 20];
const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

// ---------------------------------------------------------------------------
// Multiplier calculation (client-side fallback)
// ---------------------------------------------------------------------------

function calcMultiplier(totalTiles: number, mines: number, gemsRevealed: number): number {
  if (gemsRevealed === 0) return 1;
  let mult = 1;
  const houseEdge = 0.03;
  for (let i = 0; i < gemsRevealed; i++) {
    mult *= (totalTiles - i) / (totalTiles - mines - i);
  }
  return parseFloat((mult * (1 - houseEdge)).toFixed(4));
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function GemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M11 3l1 10" />
      <path d="M2 9h20" />
      <path d="M6.5 3L12 13" />
      <path d="M17.5 3L12 13" />
    </svg>
  );
}

function BombIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="13" r="9" />
      <path d="M14.35 4.65L16.3 2.7a1 1 0 011.4 0l1.6 1.6a1 1 0 010 1.4l-1.95 1.95" />
      <path d="M22 2l-1.5 1.5" />
    </svg>
  );
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function VolumeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 010 14.14" />
      <path d="M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sparkle animation component
// ---------------------------------------------------------------------------

function Sparkles({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-emerald-300 rounded-full"
          initial={{
            x: '50%',
            y: '50%',
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: `${20 + Math.random() * 60}%`,
            y: `${20 + Math.random() * 60}%`,
            scale: [0, 1.5, 0],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 0.6,
            delay: i * 0.05,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tile Component - Cloudbet style purple tiles
// ---------------------------------------------------------------------------

interface TileProps {
  index: number;
  state: TileState;
  gamePhase: GamePhase;
  isRevealing: boolean;
  revealingIndex: number | null;
  onClick: (index: number) => void;
}

function Tile({ index, state, gamePhase, isRevealing, revealingIndex, onClick }: TileProps) {
  const isFlipping = revealingIndex === index;
  const isClickable = gamePhase === 'playing' && state === 'hidden' && !isRevealing;

  return (
    <div className="relative" style={{ perspective: '600px' }}>
      <motion.button
        onClick={() => onClick(index)}
        disabled={!isClickable}
        className={cn(
          'relative w-full aspect-square rounded-lg overflow-hidden transition-all duration-200',
          'focus:outline-none',
          isClickable && 'cursor-pointer active:scale-95',
          !isClickable && state === 'hidden' && 'cursor-default',
        )}
        animate={
          isFlipping
            ? { rotateY: [0, 90, 0], transition: { duration: 0.4, times: [0, 0.5, 0.5] } }
            : {}
        }
        whileHover={isClickable ? { scale: 1.05 } : {}}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Hidden tile - purple tint */}
        {(state === 'hidden' || state === 'dimmed') && (
          <div
            className={cn(
              'absolute inset-0 rounded-lg transition-all duration-200',
              state === 'dimmed'
                ? 'bg-gradient-to-br from-purple-400/20 to-purple-500/10 opacity-40'
                : 'bg-gradient-to-br from-purple-300/60 to-purple-400/40',
              isClickable && 'hover:from-purple-300/75 hover:to-purple-400/55 hover:shadow-[0_0_12px_rgba(155,125,212,0.3)]',
            )}
          />
        )}

        {/* Gem tile - green glow */}
        {state === 'gem' && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 flex items-center justify-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
            style={{ boxShadow: '0 0 20px rgba(16, 185, 129, 0.4), inset 0 0 15px rgba(16, 185, 129, 0.15)' }}
          >
            <Sparkles active />
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <GemIcon className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
            </motion.div>
          </motion.div>
        )}

        {/* Mine tile - red glow */}
        {state === 'mine' && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-gradient-to-br from-red-500/30 to-red-600/20 flex items-center justify-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.15 }}
            style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.4), inset 0 0 15px rgba(239, 68, 68, 0.15)' }}
          >
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <BombIcon className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
            </motion.div>
          </motion.div>
        )}
      </motion.button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiplier Progression Bar - Cloudbet horizontal scrollable
// ---------------------------------------------------------------------------

function MultiplierBar({
  mineCount,
  revealedCount,
  gamePhase,
}: {
  mineCount: number;
  revealedCount: number;
  gamePhase: GamePhase;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const safeSpots = GRID_SIZE - mineCount;
  const steps = Math.min(safeSpots, 15);

  const multipliers = useMemo(() => {
    return Array.from({ length: steps }, (_, i) => ({
      gems: i,
      value: calcMultiplier(GRID_SIZE, mineCount, i),
    }));
  }, [mineCount, steps]);

  // Auto-scroll to current multiplier
  useEffect(() => {
    if (scrollRef.current && revealedCount > 0) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [revealedCount]);

  return (
    <div className="relative">
      {/* Left arrow */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 text-[#8B949E]">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </div>
      <div
        ref={scrollRef}
        className="flex items-center gap-0 overflow-x-auto scrollbar-hide py-2 px-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {multipliers.map((step, i) => {
          const isActive = gamePhase !== 'idle' && i === revealedCount;
          const isPast = gamePhase !== 'idle' && i < revealedCount;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <ChevronRight className={cn(
                  'w-3 h-3 flex-shrink-0 mx-0.5',
                  isPast ? 'text-[#C8FF00]/60' : 'text-[#484F58]',
                )} />
              )}
              <div
                data-active={isActive ? 'true' : 'false'}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all duration-200 border',
                  isActive
                    ? 'border-[#C8FF00] bg-[#C8FF00]/10 text-[#C8FF00]'
                    : isPast
                      ? 'border-[#C8FF00]/30 text-[#C8FF00]/70 bg-transparent'
                      : 'border-[#30363D] text-[#8B949E] bg-transparent',
                )}
              >
                {step.value.toFixed(2)}x
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* Right arrow */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 text-[#8B949E]">
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Mines Game Page
// ---------------------------------------------------------------------------

export default function MinesGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Game state
  const [mineCount, setMineCount] = useState(3);
  const [betAmount, setBetAmount] = useState('1.00');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [grid, setGrid] = useState<TileState[]>(Array(GRID_SIZE).fill('hidden'));
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastMineHit, setLastMineHit] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [serverMultiplier, setServerMultiplier] = useState<number | null>(null);
  const [serverNextMultiplier, setServerNextMultiplier] = useState<number | null>(null);
  const [autoPickCount, setAutoPickCount] = useState(5);
  const [isAutoPicking, setIsAutoPicking] = useState(false);
  const autoPickRef = useRef(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Initialize bet amount from currency
  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  const safeSpots = GRID_SIZE - mineCount;

  // Multipliers (use server values when available, fallback to client calc)
  const currentMultiplier = useMemo(
    () => serverMultiplier ?? calcMultiplier(GRID_SIZE, mineCount, revealedCount),
    [serverMultiplier, mineCount, revealedCount],
  );

  const nextMultiplier = useMemo(
    () => serverNextMultiplier ?? (revealedCount < safeSpots ? calcMultiplier(GRID_SIZE, mineCount, revealedCount + 1) : currentMultiplier),
    [serverNextMultiplier, mineCount, revealedCount, safeSpots, currentMultiplier],
  );

  const betNum = parseFloat(betAmount) || 0;

  const currentPayout = useMemo(
    () => betNum * currentMultiplier,
    [betNum, currentMultiplier],
  );

  const currentProfit = useMemo(
    () => currentPayout - betNum,
    [currentPayout, betNum],
  );

  // Get balance
  const balances = useAuthStore((s) => s.user?.balances ?? []);
  const currentBalance = useMemo(() => {
    const bal = balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [balances, currency]);

  // Auto-switch to a funded currency if current one has 0 balance
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const fundedCurrencies = useMemo(
    () => balances.filter((b) => b.available > 0).sort((a, b) => b.available - a.available),
    [balances],
  );
  useEffect(() => {
    if (isAuthenticated && balances.length > 0 && currentBalance === 0 && gamePhase === 'idle') {
      const funded = balances.find((b) => b.available > 0);
      if (funded) {
        useBetSlipStore.getState().setCurrency(funded.currency);
      }
    }
  }, [isAuthenticated, balances, currentBalance, gamePhase]);

  // Check for active game session
  useEffect(() => {
    if (!isAuthenticated) return;
    get<any>('/casino/mines/active')
      .then((data) => {
        if (data?.isActive && data.roundId) {
          setGameId(data.roundId);
          setMineCount(data.mineCount || 3);
          setRevealedCount(data.revealed?.length || 0);
          if (data.betAmount) setBetAmount(String(data.betAmount));
          if (data.revealed && data.revealed.length > 0) {
            const newGrid = Array(GRID_SIZE).fill('hidden') as TileState[];
            data.revealed.forEach((pos: number) => {
              newGrid[pos] = 'gem';
            });
            setGrid(newGrid);
          }
          if (data.currentMultiplier) setServerMultiplier(data.currentMultiplier);
          setGamePhase('playing');
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Helper to update balance
  const syncBalance = useCallback((data: any) => {
    if (data.newBalance !== undefined) {
      useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
    } else if (data.balances) {
      const match = data.balances.find((b: any) => b.currency === currency);
      if (match) {
        useAuthStore.getState().updateBalance(currency, match.balance, 0);
      }
    }
  }, [currency]);

  // ---------------------------------------------------------------------------
  // API calls with dual-endpoint support
  // ---------------------------------------------------------------------------

  const apiStartGame = useCallback(async () => {
    return await post<GameResponse>('/casino/mines/start', {
      amount: betNum,
      currency,
      mineCount,
    });
  }, [betNum, currency, mineCount]);

  const apiRevealTile = useCallback(async (position: number, _roundId: string) => {
    return await post<GameResponse>('/casino/mines/reveal', {
      position,
    });
  }, []);

  const apiCashout = useCallback(async (_roundId: string) => {
    return await post<GameResponse>('/casino/mines/cashout');
  }, []);

  // ---------------------------------------------------------------------------
  // Game actions
  // ---------------------------------------------------------------------------

  const startGame = useCallback(async () => {
    setErrorMessage(null);
    try {
      const response = await apiStartGame();
      const rid = response.roundId;
      setGameId(rid);
      setGrid(Array(GRID_SIZE).fill('hidden'));
      setRevealedCount(0);
      setServerMultiplier(null);
      setServerNextMultiplier(null);
      setLastMineHit(null);
      setGamePhase('playing');
      syncBalance(response);
    } catch (err: any) {
      const msg = err?.message || '';
      if (/insufficient/i.test(msg)) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else if (/active|in.progress/i.test(msg)) {
        setErrorMessage('You have an active game. Resuming...');
        setGamePhase('playing');
        return;
      } else {
        setErrorMessage(msg || 'Failed to start game.');
      }
      setGamePhase('idle');
    }
  }, [apiStartGame, syncBalance]);

  const revealTile = useCallback(async (index: number) => {
    if (gamePhase !== 'playing' || grid[index] !== 'hidden' || isRevealing || !gameId) return;

    setIsRevealing(true);
    setRevealingIndex(index);
    setErrorMessage(null);

    try {
      const response = await apiRevealTile(index, gameId);

      // Parse response (handle both unified and legacy formats)
      const result = response.result || response;
      const hitMine = result.isMine ?? response.isMine ?? false;
      const minePos = result.minePositions ?? response.minePositions;
      const revealed = result.revealedCount ?? response.revealedCount;
      const gameOver = result.isGameOver ?? response.gameOver ?? false;
      const serverMult = result.currentMultiplier ?? response.currentMultiplier;
      const serverNext = result.nextMultiplier ?? response.nextMultiplier;

      // Delay for flip animation
      await new Promise((r) => setTimeout(r, 300));

      const newGrid = [...grid];

      if (hitMine) {
        newGrid[index] = 'mine';
        setLastMineHit(index);
        // Reveal all mines
        if (minePos) {
          minePos.forEach((pos: number) => {
            if (pos !== index) newGrid[pos] = 'mine';
          });
        }
        // Dim unrevealed safe tiles
        newGrid.forEach((tile, i) => {
          if (tile === 'hidden') newGrid[i] = 'dimmed';
        });
        setGrid(newGrid);
        setGamePhase('lost');

        // Shake effect
        if (gridContainerRef.current) {
          gridContainerRef.current.classList.add('animate-shake');
          setTimeout(() => {
            gridContainerRef.current?.classList.remove('animate-shake');
          }, 500);
        }

        // Add to history
        const newCount = revealedCount;
        setHistory((prev) => [{
          id: gameId,
          mineCount,
          gemsFound: newCount,
          multiplier: 0,
          won: false,
          profit: -betNum,
          grid: [...newGrid],
        }, ...prev].slice(0, 10));

        syncBalance(response);
      } else {
        newGrid[index] = 'gem';
        setGrid(newGrid);
        const newRevealed = revealed ?? revealedCount + 1;
        setRevealedCount(newRevealed);
        if (serverMult) setServerMultiplier(serverMult);
        if (serverNext) setServerNextMultiplier(serverNext);

        // Check if all safe tiles revealed
        if (gameOver || newRevealed >= safeSpots) {
          if (minePos) {
            minePos.forEach((pos: number) => {
              newGrid[pos] = 'mine';
            });
          }
          newGrid.forEach((tile, i) => {
            if (tile === 'hidden') newGrid[i] = 'dimmed';
          });
          setGrid([...newGrid]);
          setGamePhase('won');

          const finalMult = serverMult ?? calcMultiplier(GRID_SIZE, mineCount, newRevealed);
          setHistory((prev) => [{
            id: gameId,
            mineCount,
            gemsFound: newRevealed,
            multiplier: finalMult,
            won: true,
            profit: betNum * finalMult - betNum,
            grid: [...newGrid],
          }, ...prev].slice(0, 10));

          syncBalance(response);
        }
      }
    } catch (err: any) {
      setErrorMessage('Connection error. Please try again.');
    }

    setIsRevealing(false);
    setRevealingIndex(null);
  }, [gamePhase, grid, isRevealing, gameId, apiRevealTile, revealedCount, safeSpots, mineCount, betNum, syncBalance]);

  const cashOut = useCallback(async () => {
    if (gamePhase !== 'playing' || revealedCount === 0 || !gameId) return;
    setErrorMessage(null);

    try {
      const response = await apiCashout(gameId);

      const result = response.result || response;
      const minePos = result.minePositions ?? response.minePositions;
      const finalMult = result.currentMultiplier ?? response.multiplier ?? currentMultiplier;

      const newGrid = [...grid];
      if (minePos) {
        minePos.forEach((pos: number) => {
          if (newGrid[pos] === 'hidden') newGrid[pos] = 'mine';
        });
      }
      // Dim remaining hidden tiles
      newGrid.forEach((tile, i) => {
        if (tile === 'hidden') newGrid[i] = 'dimmed';
      });
      setGrid(newGrid);
      setGamePhase('won');

      setHistory((prev) => [{
        id: gameId,
        mineCount,
        gemsFound: revealedCount,
        multiplier: finalMult,
        won: true,
        profit: betNum * finalMult - betNum,
        grid: [...newGrid],
      }, ...prev].slice(0, 10));

      syncBalance(response);
    } catch (err: any) {
      setErrorMessage('Failed to cash out. Please try again.');
    }
  }, [gamePhase, revealedCount, gameId, apiCashout, grid, currentMultiplier, mineCount, betNum, syncBalance]);

  const reset = useCallback(() => {
    setGrid(Array(GRID_SIZE).fill('hidden'));
    setRevealedCount(0);
    setGamePhase('idle');
    setGameId(null);
    setErrorMessage(null);
    setLastMineHit(null);
    setServerMultiplier(null);
    setServerNextMultiplier(null);
    autoPickRef.current = false;
    setIsAutoPicking(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Auto-pick
  // ---------------------------------------------------------------------------

  const autoPick = useCallback(async () => {
    if (gamePhase !== 'playing' || isAutoPicking) return;
    setIsAutoPicking(true);
    autoPickRef.current = true;

    const hiddenIndices = grid
      .map((t, i) => (t === 'hidden' ? i : -1))
      .filter((i) => i >= 0);

    // Shuffle and pick N
    const shuffled = [...hiddenIndices].sort(() => Math.random() - 0.5);
    const toReveal = shuffled.slice(0, Math.min(autoPickCount, hiddenIndices.length));

    for (const idx of toReveal) {
      if (!autoPickRef.current) break;
      await revealTile(idx);
      // Wait between reveals
      await new Promise((r) => setTimeout(r, 400));
      // Check if game ended
      if (gamePhase !== 'playing') break;
    }

    setIsAutoPicking(false);
    autoPickRef.current = false;
  }, [gamePhase, isAutoPicking, grid, autoPickCount, revealTile]);

  const stopAutoPick = useCallback(() => {
    autoPickRef.current = false;
    setIsAutoPicking(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Bet adjustments
  // ---------------------------------------------------------------------------

  const adjustBet = (action: 'minus' | 'plus' | 'half' | 'double') => {
    const val = betNum;
    const balancesList = useAuthStore.getState().user?.balances || [];
    const bal = balancesList.find((b) => b.currency === currency);
    const maxBal = bal?.available ?? 100;

    const step = currency === 'BTC' ? 0.0001 : currency === 'ETH' ? 0.001 : 1;

    switch (action) {
      case 'minus':
        setBetAmount(Math.max(step, val - step).toFixed(8).replace(/\.?0+$/, ''));
        break;
      case 'plus':
        setBetAmount(Math.min(maxBal, val + step).toFixed(8).replace(/\.?0+$/, ''));
        break;
      case 'half':
        setBetAmount(Math.max(step, val / 2).toFixed(8).replace(/\.?0+$/, ''));
        break;
      case 'double':
        setBetAmount(Math.min(maxBal, val * 2).toFixed(8).replace(/\.?0+$/, ''));
        break;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col">
      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-6px) rotate(-0.5deg); }
          20% { transform: translateX(6px) rotate(0.5deg); }
          30% { transform: translateX(-5px) rotate(-0.3deg); }
          40% { transform: translateX(5px) rotate(0.3deg); }
          50% { transform: translateX(-3px); }
          60% { transform: translateX(3px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
          90% { transform: translateX(-1px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* ============================================================= */}
      {/* CRYPTOBET Header Bar - thin dark bar */}
      {/* ============================================================= */}
      <div className="bg-[#161B22] py-2 text-center">
        <h1 className="text-sm font-bold tracking-widest text-white/80 uppercase">
          <span className="text-[#8B5CF6]">CRYPTO</span>BET
        </h1>
      </div>

      {/* ============================================================= */}
      {/* Error Message */}
      {/* ============================================================= */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs text-center"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* 5x5 Game Grid - edge to edge (full bleed) */}
      {/* ============================================================= */}
      <motion.div
        ref={gridContainerRef}
        className="relative w-full px-1 mt-2"
      >
        {/* Red flash overlay on mine hit */}
        <AnimatePresence>
          {gamePhase === 'lost' && lastMineHit !== null && (
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 bg-red-500/15 rounded-xl pointer-events-none z-10"
            />
          )}
        </AnimatePresence>

        <div className="grid grid-cols-5 gap-[3px]">
          {grid.map((tile, index) => (
            <Tile
              key={index}
              index={index}
              state={tile}
              gamePhase={gamePhase}
              isRevealing={isRevealing}
              revealingIndex={revealingIndex}
              onClick={revealTile}
            />
          ))}
        </div>
      </motion.div>

      {/* ============================================================= */}
      {/* Result Banner (overlay after game ends) */}
      {/* ============================================================= */}
      <AnimatePresence>
        {(gamePhase === 'won' || gamePhase === 'lost') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              'mx-4 mt-2 py-3 px-4 rounded-lg text-center border',
              gamePhase === 'won'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30',
            )}
          >
            <p className={cn(
              'text-xl font-bold font-mono',
              gamePhase === 'won' ? 'text-emerald-400' : 'text-red-400',
            )}>
              {gamePhase === 'won'
                ? `+${formatCurrency(currentProfit, currency)}`
                : `-${formatCurrency(betNum, currency)}`}
            </p>
            <p className={cn(
              'text-xs mt-0.5',
              gamePhase === 'won' ? 'text-emerald-400/70' : 'text-red-400/70',
            )}>
              {gamePhase === 'won'
                ? `Cashed out at ${currentMultiplier.toFixed(2)}x`
                : `Hit a mine after ${revealedCount} gems`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* Multiplier Progression Bar - horizontal scrollable */}
      {/* ============================================================= */}
      <div className="mt-2">
        <MultiplierBar
          mineCount={mineCount}
          revealedCount={revealedCount}
          gamePhase={gamePhase}
        />
      </div>

      {/* ============================================================= */}
      {/* Controls Section - px-4 padding */}
      {/* ============================================================= */}
      <div className="px-4 mt-3 space-y-3 pb-20">

        {/* Game Stats During Play - two side-by-side pills */}
        <div className="flex gap-2">
          <div className="flex-1 bg-[#161B22] border border-[#30363D] rounded-lg py-2 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-base">&#x1F4A3;</span>
              <span className="text-sm font-mono font-bold text-white">{mineCount}</span>
            </div>
          </div>
          <div className="flex-1 bg-[#161B22] border border-[#30363D] rounded-lg py-2 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-base">&#x1F48E;</span>
              <span className="text-sm font-mono font-bold text-white">
                {revealedCount} / {safeSpots}
              </span>
            </div>
          </div>
        </div>

        {/* Profits Display */}
        <div className="text-center">
          <p className="text-[#8B949E] text-sm">
            Profits ({revealedCount > 0 ? `${currentMultiplier.toFixed(2)}x` : '1x'})
          </p>
          <p className={cn(
            'text-xl font-mono font-bold mt-0.5',
            gamePhase === 'lost' ? 'text-red-400' :
            currentProfit > 0 ? 'text-emerald-400' : 'text-white',
          )}>
            {gamePhase === 'idle'
              ? `${formatCurrency(0, currency)} ${currency}`
              : gamePhase === 'lost'
                ? `-${formatCurrency(betNum, currency)} ${currency}`
                : `${formatCurrency(currentProfit, currency)} ${currency}`}
          </p>
        </div>

        {/* Status Hint Text */}
        <div className="text-center">
          {gamePhase === 'idle' && (
            <p className="text-sm text-[#C8FF00]">Bet to start game.</p>
          )}
          {gamePhase === 'playing' && revealedCount === 0 && (
            <p className="text-sm text-[#C8FF00]">Pick a tile to play.</p>
          )}
          {gamePhase === 'playing' && revealedCount > 0 && (
            <p className="text-sm text-[#C8FF00]">
              Keep picking or cash out at {currentMultiplier.toFixed(2)}x
            </p>
          )}
        </div>

        {/* CTA Buttons */}
        {gamePhase === 'idle' && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={!isAuthenticated || betNum <= 0}
            onClick={startGame}
            className="w-full bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:brightness-110 active:brightness-95"
          >
            {isAuthenticated ? 'BET' : 'Login to Play'}
          </motion.button>
        )}

        {gamePhase === 'playing' && (
          <>
            {/* PICK button */}
            {isAutoPicking ? (
              <button
                onClick={stopAutoPick}
                className="w-full bg-red-500/20 border border-red-500/40 text-red-400 font-bold py-3.5 rounded-xl text-base transition-all"
              >
                STOP AUTO-PICK
              </button>
            ) : (
              <button
                onClick={autoPick}
                disabled={isRevealing}
                className="w-full bg-[#2D333B] text-white font-bold py-3.5 rounded-xl text-base disabled:opacity-40 transition-all hover:bg-[#363D47]"
              >
                PICK
              </button>
            )}

            {/* CASH OUT Button */}
            <motion.button
              whileTap={revealedCount > 0 ? { scale: 0.97 } : {}}
              onClick={cashOut}
              disabled={revealedCount === 0 || isRevealing}
              className={cn(
                'w-full font-bold py-3.5 rounded-xl text-base transition-all',
                revealedCount > 0
                  ? 'bg-[#3D3D20] text-[#C8FF00] hover:bg-[#4A4A28]'
                  : 'bg-[#1C2128] text-gray-600 cursor-not-allowed',
              )}
            >
              {revealedCount > 0
                ? `CASH OUT ${formatCurrency(currentPayout, currency)} ${currency}`
                : 'CASH OUT'}
            </motion.button>
          </>
        )}

        {(gamePhase === 'won' || gamePhase === 'lost') && (
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={reset}
              className="flex-1 bg-[#2D333B] text-white font-bold py-3.5 rounded-xl text-sm transition-all hover:bg-[#363D47]"
            >
              CLEAR
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                reset();
                setTimeout(() => startGame(), 50);
              }}
              className="flex-[2] bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl text-sm transition-all hover:brightness-110"
            >
              BET AGAIN
            </motion.button>
          </div>
        )}

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-medium transition-all duration-200',
              activeTab === 'manual'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]',
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-medium transition-all duration-200',
              activeTab === 'auto'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]',
            )}
          >
            Auto
          </button>
        </div>

        {/* ============================================================= */}
        {/* Bet Amount Control */}
        {/* ============================================================= */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3 relative">
            {/* Left: currency selector */}
            <button
              onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
              disabled={gamePhase === 'playing'}
              className="flex items-center gap-1 text-xs text-[#C8FF00] font-medium mr-2 hover:brightness-110 disabled:opacity-50"
            >
              {currency}
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showCurrencyMenu && (
              <div className="absolute left-0 top-14 bg-[#161B22] border border-[#30363D] rounded-lg shadow-xl z-50 min-w-[160px] max-h-[200px] overflow-y-auto">
                {fundedCurrencies.length > 0 ? fundedCurrencies.map((b) => (
                  <button
                    key={b.currency}
                    onClick={() => {
                      useBetSlipStore.getState().setCurrency(b.currency);
                      setShowCurrencyMenu(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm flex justify-between items-center hover:bg-[#21262D] transition-colors',
                      b.currency === currency ? 'text-[#C8FF00]' : 'text-white',
                    )}
                  >
                    <span className="font-medium">{b.currency}</span>
                    <span className="text-xs text-[#8B949E] font-mono">{b.available.toFixed(4)}</span>
                  </button>
                )) : (
                  <div className="px-3 py-2 text-xs text-[#8B949E]">No funded currencies</div>
                )}
              </div>
            )}
            {/* Center: amount */}
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={gamePhase === 'playing'}
              step="any"
              min="0"
              className="flex-1 bg-transparent font-mono text-base text-white text-center focus:outline-none disabled:opacity-50"
            />
            {/* Right: minus/plus */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => adjustBet('minus')}
                disabled={gamePhase === 'playing'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => adjustBet('plus')}
                disabled={gamePhase === 'playing'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Amount Presets */}
          <div className="flex gap-1.5 mt-2">
            {BET_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setBetAmount(preset)}
                disabled={gamePhase === 'playing'}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
              >
                {preset}
              </button>
            ))}
            <button
              onClick={() => adjustBet('half')}
              disabled={gamePhase === 'playing'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
            >
              1/2
            </button>
            <button
              onClick={() => adjustBet('double')}
              disabled={gamePhase === 'playing'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
            >
              2X
            </button>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Number of Mines Selector (only when idle) */}
        {/* ============================================================= */}
        {gamePhase === 'idle' && (
          <div>
            <label className="text-[#8B949E] text-sm mb-1 block">Number of Mines</label>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
              <span className="text-xs text-[#8B949E] font-medium mr-2">&#x1F4A3;</span>
              <input
                type="number"
                value={mineCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1 && v <= 24) setMineCount(v);
                }}
                min={1}
                max={24}
                className="flex-1 bg-transparent font-mono text-base text-white text-center focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMineCount(Math.max(1, mineCount - 1))}
                  className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white transition-all"
                >
                  <MinusIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setMineCount(Math.min(24, mineCount + 1))}
                  className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white transition-all"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mine count presets */}
            <div className="flex gap-1.5 mt-2">
              {MINE_PRESETS.map((count) => (
                <button
                  key={count}
                  onClick={() => setMineCount(count)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-xs font-mono font-semibold transition-all duration-200',
                    mineCount === count
                      ? 'bg-[#8B5CF6] text-white'
                      : 'bg-[#21262D] text-[#8B949E] hover:text-white',
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* Fixed Bottom Bar */}
      {/* ============================================================= */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        {/* Left icons */}
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E] hover:text-white transition-colors">
            <HomeIcon className="w-6 h-6" />
          </Link>
          <button className="text-[#8B949E] hover:text-white transition-colors">
            <InfoIcon className="w-6 h-6" />
          </button>
          <button className="text-[#8B949E] hover:text-white transition-colors">
            <VolumeIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Center balance */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#8B949E] font-medium">{currency}</span>
          <span className="text-sm font-mono text-white">
            {currentBalance.toFixed(4)}
          </span>
        </div>

        {/* Right - Provably Fair badge */}
        <div className="flex items-center gap-1.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <ShieldCheck className="w-3 h-3 text-[#8B5CF6]" />
          <span className="text-xs text-[#8B5CF6] font-medium whitespace-nowrap">
            Provably Fair Game
          </span>
        </div>
      </div>
    </div>
  );
}
