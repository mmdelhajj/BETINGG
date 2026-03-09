'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shuffle,
  Trash2,
  History,
  RotateCcw,
  Shield,
  ChevronDown,
  Check,
  X,
  Zap,
  Trophy,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  Play,
  Square,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Risk = 'low' | 'medium' | 'high';

type TileState = 'idle' | 'selected' | 'drawn' | 'hit' | 'miss';

type GamePhase = 'picking' | 'drawing' | 'result';

interface KenoApiResponse {
  roundId: string;
  result: {
    selectedNumbers: number[];
    drawnNumbers: number[];
    hits: number;
    multiplier: number;
    payout: number;
    risk: Risk;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface GameHistory {
  id: string;
  picks: number;
  hits: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  risk: Risk;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Payout tables (multipliers per picks/hits/risk)
// ---------------------------------------------------------------------------

const PAYOUT_TABLES: Record<Risk, Record<number, number[]>> = {
  low: {
    1:  [0, 2.85],
    2:  [0, 1.4, 5.1],
    3:  [0, 1.1, 1.4, 26],
    4:  [0, 0.5, 1.8, 5, 50],
    5:  [0, 0.3, 1, 3.2, 14, 75],
    6:  [0, 0.3, 0.5, 1.8, 4.5, 23, 100],
    7:  [0, 0.2, 0.4, 1.2, 3, 8, 40, 150],
    8:  [0, 0.2, 0.3, 0.8, 2, 5, 15, 60, 250],
    9:  [0, 0.1, 0.3, 0.5, 1.5, 3.5, 8, 25, 100, 400],
    10: [0, 0.1, 0.2, 0.4, 1, 2.5, 5.5, 15, 50, 175, 500],
  },
  medium: {
    1:  [0, 3.6],
    2:  [0, 1, 8],
    3:  [0, 0.5, 2, 45],
    4:  [0, 0.4, 1.5, 8, 90],
    5:  [0, 0.2, 0.8, 4, 25, 130],
    6:  [0, 0.2, 0.4, 2, 7, 40, 200],
    7:  [0, 0.1, 0.3, 1.2, 4, 14, 70, 400],
    8:  [0, 0.1, 0.2, 0.7, 2.5, 8, 30, 120, 600],
    9:  [0, 0.1, 0.2, 0.5, 1.5, 5, 15, 50, 200, 1000],
    10: [0, 0.1, 0.1, 0.3, 1, 3, 8, 25, 80, 350, 1500],
  },
  high: {
    1:  [0, 3.96],
    2:  [0, 0, 17],
    3:  [0, 0, 1, 81],
    4:  [0, 0, 0.5, 8, 200],
    5:  [0, 0, 0.3, 4, 30, 400],
    6:  [0, 0, 0.2, 2, 10, 75, 700],
    7:  [0, 0, 0.1, 1, 5, 20, 125, 1000],
    8:  [0, 0, 0.1, 0.5, 3, 12, 50, 250, 2000],
    9:  [0, 0, 0.1, 0.3, 2, 6, 25, 100, 500, 4000],
    10: [0, 0, 0, 0.2, 1, 4, 15, 50, 250, 1000, 10000],
  },
};

const MAX_PICKS = 10;
const TOTAL_NUMBERS = 40;
const DRAW_COUNT = 10;
const DRAW_INTERVAL_MS = 180;
const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'SOL', 'DOGE', 'BNB'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KenoGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('picking');
  const [risk, setRisk] = useState<Risk>('medium');
  const [betAmount, setBetAmount] = useState('1.00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<KenoApiResponse['result'] | null>(null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [showPayoutTable, setShowPayoutTable] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);

  // Auto-bet state
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(0);
  const [autoBetTotal, setAutoBetTotal] = useState(10);
  const [autoBetOnWin, setAutoBetOnWin] = useState<'reset' | 'increase'>('reset');
  const [autoBetOnLoss, setAutoBetOnLoss] = useState<'reset' | 'increase'>('reset');
  const [autoBetWinIncrease, setAutoBetWinIncrease] = useState(0);
  const [autoBetLossIncrease, setAutoBetLossIncrease] = useState(0);
  const [stopOnProfit, setStopOnProfit] = useState('');
  const [stopOnLoss, setStopOnLoss] = useState('');
  const [showAutoBet, setShowAutoBet] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  const autoBetRef = useRef(false);
  const baseBetRef = useRef('1.00');
  const profitAccumRef = useRef(0);

  const isPlayingRef = useRef(false);
  const drawTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (drawTimerRef.current) clearInterval(drawTimerRef.current);
      autoBetRef.current = false;
    };
  }, []);

  const picks = selectedNumbers.size;

  // Current payout table for selected picks count and risk
  const currentPayouts = useMemo(() => {
    if (picks === 0) return [];
    return PAYOUT_TABLES[risk][picks] || [];
  }, [picks, risk]);

  // Tile states
  const getTileState = useCallback(
    (num: number): TileState => {
      const isSelected = selectedNumbers.has(num);
      const revealedDrawn = drawnNumbers.slice(0, revealedCount);
      const isDrawn = revealedDrawn.includes(num);

      if (gamePhase === 'picking') {
        return isSelected ? 'selected' : 'idle';
      }

      if (isSelected && isDrawn) return 'hit';
      if (isSelected && !isDrawn && gamePhase === 'result') return 'miss';
      if (isDrawn && !isSelected) return 'drawn';
      if (isSelected) return 'selected';
      return 'idle';
    },
    [selectedNumbers, drawnNumbers, revealedCount, gamePhase],
  );

  // Hits count (animated during draw)
  const currentHits = useMemo(() => {
    const revealed = drawnNumbers.slice(0, revealedCount);
    return revealed.filter((n) => selectedNumbers.has(n)).length;
  }, [drawnNumbers, revealedCount, selectedNumbers]);

  // Toggle number selection
  const toggleNumber = useCallback(
    (num: number) => {
      if (gamePhase !== 'picking') return;
      setSelectedNumbers((prev) => {
        const next = new Set(prev);
        if (next.has(num)) {
          next.delete(num);
        } else if (next.size < MAX_PICKS) {
          next.add(num);
        }
        return next;
      });
    },
    [gamePhase],
  );

  // Auto-pick random numbers
  const autoPick = useCallback(
    (count: number) => {
      if (gamePhase !== 'picking') return;
      const available: number[] = [];
      for (let i = 1; i <= TOTAL_NUMBERS; i++) {
        if (!selectedNumbers.has(i)) available.push(i);
      }
      const shuffled = available.sort(() => Math.random() - 0.5);
      const remaining = MAX_PICKS - selectedNumbers.size;
      const toAdd = shuffled.slice(0, Math.min(count, remaining));
      setSelectedNumbers((prev) => {
        const next = new Set(prev);
        toAdd.forEach((n) => next.add(n));
        return next;
      });
    },
    [gamePhase, selectedNumbers],
  );

  // Clear selections
  const clearSelections = useCallback(() => {
    if (gamePhase !== 'picking') return;
    setSelectedNumbers(new Set());
  }, [gamePhase]);

  // Play game
  const playGame = useCallback(async () => {
    if (isPlayingRef.current) return;
    if (selectedNumbers.size === 0) {
      setErrorMessage('Select at least 1 number to play.');
      return;
    }
    isPlayingRef.current = true;
    setErrorMessage(null);
    setLastResult(null);
    setDrawnNumbers([]);
    setRevealedCount(0);
    setGamePhase('drawing');

    try {
      const response = await post<KenoApiResponse>('/casino/games/keno/play', {
        amount: parseFloat(betAmount),
        currency,
        options: {
          selectedNumbers: Array.from(selectedNumbers),
          risk,
        },
      });

      // Update balance
      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      const { result } = response;
      setDrawnNumbers(result.drawnNumbers);

      // Animate reveal one by one
      let revealed = 0;
      await new Promise<void>((resolve) => {
        drawTimerRef.current = setInterval(() => {
          revealed++;
          setRevealedCount(revealed);
          if (revealed >= DRAW_COUNT) {
            if (drawTimerRef.current) clearInterval(drawTimerRef.current);
            drawTimerRef.current = null;
            resolve();
          }
        }, DRAW_INTERVAL_MS);
      });

      setLastResult(result);
      setGamePhase('result');

      // Add to history
      const historyEntry: GameHistory = {
        id: response.roundId,
        picks: selectedNumbers.size,
        hits: result.hits,
        multiplier: result.multiplier,
        betAmount: parseFloat(betAmount),
        payout: result.payout,
        risk,
        timestamp: new Date(),
      };
      setHistory((prev) => [historyEntry, ...prev.slice(0, 9)]);

      isPlayingRef.current = false;

      // Auto-bet logic
      if (autoBetRef.current) {
        const won = result.payout > 0;
        const profit = result.payout - parseFloat(betAmount);
        profitAccumRef.current += profit;

        // Check stop conditions
        if (stopOnProfit && profitAccumRef.current >= parseFloat(stopOnProfit)) {
          autoBetRef.current = false;
          setAutoBetEnabled(false);
          setAutoBetCount(0);
          return;
        }
        if (stopOnLoss && profitAccumRef.current <= -parseFloat(stopOnLoss)) {
          autoBetRef.current = false;
          setAutoBetEnabled(false);
          setAutoBetCount(0);
          return;
        }

        setAutoBetCount((c) => {
          const next = c + 1;
          if (next >= autoBetTotal) {
            autoBetRef.current = false;
            setAutoBetEnabled(false);
            return 0;
          }
          return next;
        });

        // Adjust bet
        if (won && autoBetOnWin === 'increase' && autoBetWinIncrease > 0) {
          setBetAmount((prev) => {
            const increased = parseFloat(prev) * (1 + autoBetWinIncrease / 100);
            return increased.toFixed(5);
          });
        } else if (won && autoBetOnWin === 'reset') {
          setBetAmount(baseBetRef.current);
        }
        if (!won && autoBetOnLoss === 'increase' && autoBetLossIncrease > 0) {
          setBetAmount((prev) => {
            const increased = parseFloat(prev) * (1 + autoBetLossIncrease / 100);
            return increased.toFixed(5);
          });
        } else if (!won && autoBetOnLoss === 'reset') {
          setBetAmount(baseBetRef.current);
        }

        if (autoBetRef.current) {
          setTimeout(() => {
            setGamePhase('picking');
            setTimeout(() => playGame(), 200);
          }, 600);
          return;
        }
      }
    } catch (err: any) {
      if (/insufficient/i.test(err?.message || '')) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(err?.message || 'Failed to place bet. Please try again.');
      }
      setGamePhase('picking');
      isPlayingRef.current = false;
      autoBetRef.current = false;
      setAutoBetEnabled(false);
    }
  }, [selectedNumbers, risk, betAmount, currency, autoBetOnWin, autoBetOnLoss, autoBetWinIncrease, autoBetLossIncrease, autoBetTotal, stopOnProfit, stopOnLoss]);

  const newGame = useCallback(() => {
    setGamePhase('picking');
    setDrawnNumbers([]);
    setRevealedCount(0);
    setLastResult(null);
    if (drawTimerRef.current) {
      clearInterval(drawTimerRef.current);
      drawTimerRef.current = null;
    }
  }, []);

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(5));
  };

  const setMaxBet = () => {
    const user = useAuthStore.getState().user;
    const bal = user?.balances?.find((b) => b.currency === currency);
    if (bal) setBetAmount(bal.available.toFixed(5));
  };

  const startAutoBet = () => {
    if (selectedNumbers.size === 0) {
      setErrorMessage('Select at least 1 number to start auto-bet.');
      return;
    }
    baseBetRef.current = betAmount;
    profitAccumRef.current = 0;
    autoBetRef.current = true;
    setAutoBetEnabled(true);
    setAutoBetCount(0);
    if (gamePhase === 'result') {
      setGamePhase('picking');
      setTimeout(() => playGame(), 100);
    } else {
      playGame();
    }
  };

  const stopAutoBet = () => {
    autoBetRef.current = false;
    setAutoBetEnabled(false);
    setAutoBetCount(0);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ============ CRYPTOBET HEADER ============ */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-sm font-bold tracking-widest text-[#E6EDF3]">CRYPTOBET</span>
      </div>

      <div className="px-3 pb-20 pt-3 space-y-3">
        {/* Error */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Banner */}
        <AnimatePresence>
          {gamePhase === 'result' && lastResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                'rounded-xl p-4 text-center',
                lastResult.payout > 0
                  ? 'bg-[#10B981]/10 border border-[#10B981]/30'
                  : 'bg-[#EF4444]/10 border border-[#EF4444]/30',
              )}
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                className={cn(
                  'text-3xl font-bold font-mono block',
                  lastResult.payout > 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
                )}
              >
                {lastResult.payout > 0 ? `${lastResult.multiplier}x` : '0x'}
              </motion.span>
              <p className={cn(
                'text-sm font-semibold mt-1',
                lastResult.payout > 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
              )}>
                {lastResult.payout > 0
                  ? `Won ${formatCurrency(lastResult.payout, currency)}`
                  : `No win - Lost ${formatCurrency(parseFloat(betAmount), currency)}`}
              </p>
              <p className="text-xs text-[#8B949E] mt-1">
                {lastResult.hits} hit{lastResult.hits !== 1 ? 's' : ''} from {picks} pick{picks !== 1 ? 's' : ''}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drawing indicator */}
        <AnimatePresence>
          {gamePhase === 'drawing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-3 py-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-5 h-5 border-2 border-[#C8FF00] border-t-transparent rounded-full"
              />
              <span className="text-sm font-medium text-[#8B949E]">
                Drawing... <span className="font-mono text-[#C8FF00]">{revealedCount}/{DRAW_COUNT}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pick count + hits during draw */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8B949E]">Selected:</span>
            <span className="font-mono text-sm font-bold text-[#C8FF00]">{picks}/{MAX_PICKS}</span>
          </div>
          {(gamePhase === 'drawing' || gamePhase === 'result') && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#8B949E]">Hits:</span>
                <motion.span
                  key={currentHits}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  className={cn('font-mono font-bold text-sm', currentHits > 0 ? 'text-[#10B981]' : 'text-[#8B949E]')}
                >
                  {currentHits}
                </motion.span>
              </div>
              {currentPayouts[currentHits] !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#8B949E]">Mult:</span>
                  <span className={cn(
                    'font-mono font-bold text-sm',
                    currentPayouts[currentHits] > 0 ? 'text-[#C8FF00]' : 'text-[#484F58]',
                  )}>
                    {currentPayouts[currentHits]}x
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 8x5 Number Grid - Edge to edge */}
        <div className="bg-[#161B22] p-2">
          <div className="grid grid-cols-8 gap-1.5">
            {Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1).map((num) => {
              const state = getTileState(num);
              const justRevealed = gamePhase === 'drawing' && drawnNumbers[revealedCount - 1] === num;

              return (
                <motion.button
                  key={num}
                  onClick={() => toggleNumber(num)}
                  disabled={gamePhase !== 'picking'}
                  whileTap={gamePhase === 'picking' ? { scale: 0.9 } : {}}
                  animate={
                    justRevealed
                      ? { scale: [1, 1.3, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'aspect-square rounded-lg flex items-center justify-center font-mono font-bold text-sm relative select-none transition-all duration-150',
                    state === 'idle' && gamePhase === 'picking' &&
                      'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:border-[#C8FF00]/40 hover:text-[#E6EDF3] active:bg-[#262C36]',
                    state === 'idle' && gamePhase !== 'picking' &&
                      'bg-[#1C2128] border border-[#30363D] text-[#484F58]',
                    state === 'selected' &&
                      'bg-[#C8FF00] border border-[#C8FF00] text-black shadow-md shadow-[#C8FF00]/20',
                    state === 'hit' &&
                      'bg-[#10B981] border border-[#10B981] text-white shadow-md shadow-[#10B981]/30',
                    state === 'miss' &&
                      'bg-[#C8FF00]/15 border border-[#C8FF00]/25 text-[#C8FF00]/50',
                    state === 'drawn' &&
                      'bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444]',
                  )}
                >
                  {num}
                  {state === 'hit' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#10B981] rounded-full flex items-center justify-center border border-[#0D1117] z-10"
                    >
                      <Check className="w-2 h-2 text-white" strokeWidth={3} />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <button
            onClick={() => autoPick(MAX_PICKS - picks)}
            disabled={gamePhase !== 'picking' || picks >= MAX_PICKS}
            className="flex-1 h-10 bg-[#2D333B] rounded-lg text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Auto Pick
          </button>
          <button
            onClick={clearSelections}
            disabled={gamePhase !== 'picking' || picks === 0}
            className="flex-1 h-10 bg-[#2D333B] rounded-lg text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>

        {/* ============ BET CONTROLS ============ */}
        <div className="space-y-3">
          {/* Manual / Auto Toggle */}
          <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
            <button
              onClick={() => { setActiveTab('manual'); }}
              className={cn(
                'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                activeTab === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
              )}
            >
              Manual
            </button>
            <button
              onClick={() => { setActiveTab('auto'); }}
              className={cn(
                'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                activeTab === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
              )}
            >
              Auto
            </button>
          </div>

          {/* Risk Selector */}
          <div>
            <label className="text-xs text-[#8B949E] font-medium mb-1.5 block">Risk Level</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as Risk[]).map((r) => (
                <button
                  key={r}
                  onClick={() => gamePhase === 'picking' && setRisk(r)}
                  disabled={gamePhase !== 'picking'}
                  className={cn(
                    'h-9 rounded-lg text-xs font-bold capitalize transition-all',
                    risk === r
                      ? 'bg-[#8B5CF6] text-white'
                      : 'bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-40',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Bet Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#8B949E] font-medium">Bet Amount</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-[#0D1117] border border-[#30363D] rounded-md px-2 py-0.5 text-[10px] text-[#E6EDF3] focus:outline-none cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
              <span className="text-xs text-[#8B949E] font-medium mr-2">{currency}</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={gamePhase === 'drawing' || autoBetEnabled}
                className="flex-1 bg-transparent text-sm font-mono text-[#E6EDF3] text-center focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => adjustBet(0.5)}
                  disabled={gamePhase === 'drawing' || autoBetEnabled}
                  className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] transition-colors disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => adjustBet(2)}
                  disabled={gamePhase === 'drawing' || autoBetEnabled}
                  className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Quick presets */}
            <div className="flex gap-1.5 mt-2">
              {['Min', '1/2', '2x', 'Max'].map((label) => (
                <button
                  key={label}
                  disabled={gamePhase === 'drawing' || autoBetEnabled}
                  onClick={() => {
                    if (label === 'Min') setBetAmount(getDefaultBet(currency));
                    else if (label === '1/2') adjustBet(0.5);
                    else if (label === '2x') adjustBet(2);
                    else if (label === 'Max') setMaxBet();
                  }}
                  className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-[#E6EDF3] transition-colors flex-1 text-center disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-bet options */}
          {activeTab === 'auto' && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#8B949E] mb-1 block">Number of Bets</label>
                <input
                  type="number"
                  value={autoBetTotal}
                  onChange={(e) => setAutoBetTotal(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-9 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8B949E] mb-1 block">On Win</label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAutoBetOnWin('reset')}
                    className={cn('flex-1 h-8 rounded-lg text-[10px] font-bold transition-colors', autoBetOnWin === 'reset' ? 'bg-[#8B5CF6] text-white' : 'bg-[#21262D] border border-[#30363D] text-[#8B949E]')}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setAutoBetOnWin('increase')}
                    className={cn('flex-1 h-8 rounded-lg text-[10px] font-bold transition-colors', autoBetOnWin === 'increase' ? 'bg-[#8B5CF6] text-white' : 'bg-[#21262D] border border-[#30363D] text-[#8B949E]')}
                  >
                    Increase
                  </button>
                </div>
                {autoBetOnWin === 'increase' && (
                  <input
                    type="number"
                    value={autoBetWinIncrease}
                    onChange={(e) => setAutoBetWinIncrease(parseFloat(e.target.value) || 0)}
                    placeholder="% increase"
                    className="w-full h-8 mt-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 text-[10px] font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                )}
              </div>
              <div>
                <label className="text-[10px] text-[#8B949E] mb-1 block">On Loss</label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAutoBetOnLoss('reset')}
                    className={cn('flex-1 h-8 rounded-lg text-[10px] font-bold transition-colors', autoBetOnLoss === 'reset' ? 'bg-[#8B5CF6] text-white' : 'bg-[#21262D] border border-[#30363D] text-[#8B949E]')}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setAutoBetOnLoss('increase')}
                    className={cn('flex-1 h-8 rounded-lg text-[10px] font-bold transition-colors', autoBetOnLoss === 'increase' ? 'bg-[#8B5CF6] text-white' : 'bg-[#21262D] border border-[#30363D] text-[#8B949E]')}
                  >
                    Increase
                  </button>
                </div>
                {autoBetOnLoss === 'increase' && (
                  <input
                    type="number"
                    value={autoBetLossIncrease}
                    onChange={(e) => setAutoBetLossIncrease(parseFloat(e.target.value) || 0)}
                    placeholder="% increase"
                    className="w-full h-8 mt-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 text-[10px] font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#8B949E] mb-1 block">Stop Profit</label>
                  <input
                    type="number"
                    value={stopOnProfit}
                    onChange={(e) => setStopOnProfit(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 text-[10px] font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8B949E] mb-1 block">Stop Loss</label>
                  <input
                    type="number"
                    value={stopOnLoss}
                    onChange={(e) => setStopOnLoss(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 text-[10px] font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Play Button - Lime CTA */}
          {!autoBetEnabled ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={
                activeTab === 'auto'
                  ? startAutoBet
                  : gamePhase === 'result'
                    ? () => { newGame(); setTimeout(() => playGame(), 50); }
                    : playGame
              }
              disabled={!isAuthenticated || gamePhase === 'drawing' || picks === 0}
              className={cn(
                'w-full font-bold py-3.5 rounded-xl transition-all text-base flex items-center justify-center gap-2',
                gamePhase === 'drawing'
                  ? 'bg-[#1C2128] text-[#484F58] cursor-not-allowed'
                  : 'bg-[#C8FF00] text-black hover:bg-[#D4FF33] active:bg-[#B8EF00] disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {gamePhase === 'drawing' ? (
                <>
                  <Zap className="w-5 h-5 animate-pulse" />
                  Drawing...
                </>
              ) : gamePhase === 'result' ? (
                <>
                  <RotateCcw className="w-5 h-5" />
                  Play Again
                </>
              ) : isAuthenticated ? (
                activeTab === 'auto' ? (
                  <>
                    <Play className="w-4 h-4" />
                    Start Auto Bet
                  </>
                ) : (
                  'Play'
                )
              ) : (
                'Login to Play'
              )}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={stopAutoBet}
              className="w-full font-bold py-3.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center gap-2 text-base"
            >
              <Square className="w-4 h-4" />
              Stop Auto ({autoBetCount}/{autoBetTotal})
            </motion.button>
          )}
        </div>

        {/* Payout Table Collapsible */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowPayoutTable(!showPayoutTable)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            <span>Payout Table</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showPayoutTable && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showPayoutTable && picks > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#30363D] max-h-48 overflow-y-auto">
                  {currentPayouts.map((mult, hitCount) => (
                    <div
                      key={hitCount}
                      className={cn(
                        'grid grid-cols-2 px-3 py-1.5 text-xs',
                        lastResult && gamePhase === 'result' && lastResult.hits === hitCount
                          ? 'bg-[#10B981]/10'
                          : '',
                      )}
                    >
                      <span className="font-mono text-[#E6EDF3]">{hitCount} hits</span>
                      <span className={cn(
                        'text-right font-mono',
                        mult === 0 ? 'text-[#484F58]' : mult >= 10 ? 'text-[#C8FF00] font-bold' : 'text-[#8B949E]',
                      )}>
                        {mult}x
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {showPayoutTable && picks === 0 && (
            <div className="border-t border-[#30363D] p-4 text-center">
              <p className="text-xs text-[#484F58]">Select numbers to see payouts</p>
            </div>
          )}
        </div>

        {/* Drawn numbers strip */}
        {drawnNumbers.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-3">
            <p className="text-[10px] text-[#8B949E] mb-2 font-medium">Drawn Numbers</p>
            <div className="flex flex-wrap gap-1.5">
              {drawnNumbers.map((num, idx) => {
                const isHit = selectedNumbers.has(num);
                const isRevealed = idx < revealedCount;
                return (
                  <motion.div
                    key={`drawn-${idx}`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isRevealed ? { opacity: 1, scale: 1 } : { opacity: 0.2, scale: 0.8 }}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs',
                      isRevealed && isHit
                        ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                        : isRevealed
                          ? 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30'
                          : 'bg-[#1C2128] text-[#484F58] border border-[#30363D]',
                    )}
                  >
                    {isRevealed ? num : '?'}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Game History */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
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
                  <div className="border-t border-[#30363D] max-h-48 overflow-y-auto divide-y divide-[#30363D]/30">
                    {history.map((game) => {
                      const won = game.payout > 0;
                      const profit = game.payout - game.betAmount;
                      return (
                        <div
                          key={game.id}
                          className="px-3 py-2 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[#8B949E]">{game.picks}P/{game.hits}H</span>
                            <span className={cn('capitalize text-[10px]', game.risk === 'low' ? 'text-[#10B981]' : game.risk === 'medium' ? 'text-[#C8FF00]' : 'text-[#EF4444]')}>
                              {game.risk}
                            </span>
                          </div>
                          <span className={cn('font-mono font-bold', won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                            {won ? `+${formatCurrency(profit, currency)}` : `-${formatCurrency(game.betAmount, currency)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ============ FIXED BOTTOM BAR ============ */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
        >
          {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
        </button>

        <span className="text-sm font-mono text-white">
          {formatCurrency(parseFloat(betAmount) || 0, currency)} {currency}
        </span>

        <button
          onClick={() => setShowFairness(!showFairness)}
          className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 text-xs text-[#8B5CF6] flex items-center gap-1"
        >
          <Shield className="w-3 h-3" />
          Provably Fair
        </button>
      </div>
    </div>
  );
}
