'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus,
  Plus,
  Zap,
  Shield,
  History,
  RotateCcw,
  ChevronDown,
  Play,
  Square,
  Infinity as InfinityIcon,
  Home,
  Info,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LimboResult {
  id: string;
  target: number;
  resultMultiplier: number;
  isWin: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  timestamp: Date;
}

interface LimboApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    target: number;
    resultMultiplier: number;
    isWin: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface FairnessData {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_TARGET = 1.01;
const MAX_TARGET = 1000000;
const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'SOL', 'DOGE', 'BNB'];

// ---------------------------------------------------------------------------
// Animated Counter Hook
// ---------------------------------------------------------------------------

function useAnimatedCounter() {
  const frameRef = useRef<number>(0);
  const [displayValue, setDisplayValue] = useState<number | null>(null);

  const animate = useCallback((finalValue: number, duration: number = 1200) => {
    return new Promise<void>((resolve) => {
      const startTime = performance.now();
      const startValue = 1.0;

      if (frameRef.current) cancelAnimationFrame(frameRef.current);

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const eased = 1 - Math.pow(1 - progress, 3);

        if (progress < 1) {
          const jitterAmount = Math.max(0, 1 - progress * 1.5);
          const baseValue = startValue + (finalValue - startValue) * eased;
          const jitter = jitterAmount * (Math.random() - 0.5) * finalValue * 0.3;
          const clamped = Math.max(1.0, baseValue + jitter);
          setDisplayValue(parseFloat(clamped.toFixed(2)));
          frameRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayValue(finalValue);
          resolve();
        }
      };

      frameRef.current = requestAnimationFrame(tick);
    });
  }, []);

  const reset = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    setDisplayValue(null);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return { displayValue, animate, reset };
}

// ---------------------------------------------------------------------------
// History Dot Component
// ---------------------------------------------------------------------------

function HistoryDot({ result, index }: { result: LimboResult; index: number }) {
  const color = result.isWin
    ? 'bg-[#10B981]'
    : result.resultMultiplier >= 1.5
      ? 'bg-[#F59E0B]'
      : 'bg-[#EF4444]';

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: index * 0.02, type: 'spring', stiffness: 500, damping: 25 }}
      className={cn(
        'flex-shrink-0 w-2.5 h-2.5 rounded-full cursor-default',
        color,
      )}
      title={`Target: ${result.target}x | Result: ${result.resultMultiplier}x | ${result.isWin ? 'Win' : 'Loss'}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Limbo Game Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function LimboGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [targetMultiplier, setTargetMultiplier] = useState(2);
  const [betAmount, setBetAmount] = useState('0.001');
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<LimboResult | null>(null);
  const [history, setHistory] = useState<LimboResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fairness, setFairness] = useState<FairnessData | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Auto-bet state
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoBetActive, setAutoBetActive] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(0);
  const [autoBetPlayed, setAutoBetPlayed] = useState(0);
  const [stopOnWin, setStopOnWin] = useState('');
  const [stopOnLoss, setStopOnLoss] = useState('');
  const [onWinAction, setOnWinAction] = useState<'reset' | 'increase'>('reset');
  const [onWinPercent, setOnWinPercent] = useState(0);
  const [onLossAction, setOnLossAction] = useState<'reset' | 'increase'>('reset');
  const [onLossPercent, setOnLossPercent] = useState(0);
  const [baseBetAmount, setBaseBetAmount] = useState('0.001');

  // Refs
  const isPlayingRef = useRef(false);
  const autoBetRef = useRef(false);
  const autoBetAmountRef = useRef('0.001');
  const totalProfitRef = useRef(0);

  // Animated counter
  const { displayValue, animate, reset } = useAnimatedCounter();

  // Derived values
  const winChance = (99 / targetMultiplier);
  const profitOnWin = parseFloat(betAmount) * targetMultiplier - parseFloat(betAmount);

  useEffect(() => {
    const defaultBet = getDefaultBet(currency);
    setBetAmount(defaultBet);
    setBaseBetAmount(defaultBet);
  }, [currency]);

  const handleTargetChange = useCallback((value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setTargetMultiplier(Math.min(MAX_TARGET, Math.max(MIN_TARGET, num)));
  }, []);

  const adjustTarget = useCallback((delta: number) => {
    setTargetMultiplier((prev) => {
      const next = parseFloat((prev + delta).toFixed(2));
      return Math.min(MAX_TARGET, Math.max(MIN_TARGET, next));
    });
  }, []);

  const adjustBet = useCallback((factor: number) => {
    setBetAmount((prev) => {
      const val = parseFloat(prev) || 0;
      return Math.max(0.00000001, val * factor).toFixed(8).replace(/\.?0+$/, '');
    });
  }, []);

  const setMaxBet = useCallback(() => {
    const balances = useAuthStore.getState().user?.balances || [];
    const bal = balances.find((b) => b.currency === currency);
    if (bal) setBetAmount(bal.available.toString());
  }, [currency]);

  // ---- Core Play Function ----
  const playRound = useCallback(async (amount?: string): Promise<LimboResult | null> => {
    if (isPlayingRef.current) return null;
    isPlayingRef.current = true;
    setIsPlaying(true);
    setErrorMessage(null);
    setLastResult(null);
    reset();

    const playAmount = amount || betAmount;

    try {
      const response = await post<LimboApiResponse>('/casino/games/limbo/play', {
        amount: parseFloat(playAmount),
        currency,
        options: { targetMultiplier },
      });

      const resultMult = response.result.resultMultiplier;
      await animate(resultMult, resultMult > 10 ? 1800 : 1200);

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      setFairness(response.fairness);

      const result: LimboResult = {
        id: response.roundId,
        target: response.result.target,
        resultMultiplier: response.result.resultMultiplier,
        isWin: response.result.isWin,
        betAmount: response.betAmount,
        payout: response.payout,
        profit: response.profit,
        timestamp: new Date(),
      };

      setLastResult(result);
      setHistory((prev) => [result, ...prev.slice(0, 19)]);

      isPlayingRef.current = false;
      setIsPlaying(false);
      return result;
    } catch (err: any) {
      const msg = err?.message || '';
      if (/insufficient/i.test(msg)) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(msg || 'Failed to place bet. Please try again.');
      }
      reset();
      isPlayingRef.current = false;
      setIsPlaying(false);
      return null;
    }
  }, [betAmount, currency, targetMultiplier, animate, reset]);

  const handlePlay = useCallback(() => {
    if (!autoBetActive) playRound();
  }, [playRound, autoBetActive]);

  // ---- Auto-bet Logic ----
  const startAutoBet = useCallback(() => {
    setAutoBetActive(true);
    setAutoBetPlayed(0);
    autoBetRef.current = true;
    totalProfitRef.current = 0;
    autoBetAmountRef.current = betAmount;
    setBaseBetAmount(betAmount);
  }, [betAmount]);

  const stopAutoBet = useCallback(() => {
    autoBetRef.current = false;
    setAutoBetActive(false);
  }, []);

  useEffect(() => {
    if (!autoBetActive) return;

    let cancelled = false;

    const runLoop = async () => {
      while (autoBetRef.current && !cancelled) {
        if (autoBetCount > 0 && autoBetPlayed >= autoBetCount) {
          stopAutoBet();
          break;
        }

        const currentAmount = autoBetAmountRef.current;
        const result = await playRound(currentAmount);

        if (!result || !autoBetRef.current) {
          stopAutoBet();
          break;
        }

        setAutoBetPlayed((p) => p + 1);
        totalProfitRef.current += result.profit;

        const sw = parseFloat(stopOnWin);
        const sl = parseFloat(stopOnLoss);
        if (!isNaN(sw) && sw > 0 && totalProfitRef.current >= sw) {
          stopAutoBet();
          break;
        }
        if (!isNaN(sl) && sl > 0 && totalProfitRef.current <= -sl) {
          stopAutoBet();
          break;
        }

        if (result.isWin) {
          if (onWinAction === 'reset') {
            autoBetAmountRef.current = baseBetAmount;
          } else if (onWinAction === 'increase' && onWinPercent > 0) {
            const increased = parseFloat(autoBetAmountRef.current) * (1 + onWinPercent / 100);
            autoBetAmountRef.current = increased.toFixed(8).replace(/\.?0+$/, '');
          }
        } else {
          if (onLossAction === 'reset') {
            autoBetAmountRef.current = baseBetAmount;
          } else if (onLossAction === 'increase' && onLossPercent > 0) {
            const increased = parseFloat(autoBetAmountRef.current) * (1 + onLossPercent / 100);
            autoBetAmountRef.current = increased.toFixed(8).replace(/\.?0+$/, '');
          }
        }

        setBetAmount(autoBetAmountRef.current);

        await new Promise((r) => setTimeout(r, 300));
      }
    };

    runLoop();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBetActive]);

  // ---- Determine display state ----
  const isWinResult = lastResult?.isWin === true && !isPlaying;
  const isLossResult = lastResult?.isWin === false && !isPlaying;

  const resultColor = isPlaying
    ? 'text-[#E6EDF3]'
    : isWinResult
      ? 'text-[#10B981]'
      : isLossResult
        ? 'text-[#EF4444]'
        : 'text-[#484F58]';

  const displayNumber = displayValue !== null ? displayValue : lastResult?.resultMultiplier ?? null;

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ============ CRYPTOBET HEADER ============ */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-sm font-bold tracking-widest text-[#E6EDF3]">CRYPTOBET</span>
      </div>

      <div className="px-3 pb-20 pt-3 space-y-3">
        {/* Error Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ HISTORY DOTS ============ */}
        {history.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            {history.map((r, i) => (
              <HistoryDot key={r.id} result={r} index={i} />
            ))}
            <button
              onClick={() => setHistory([])}
              className="flex-shrink-0 ml-1 p-1 text-[#484F58] hover:text-[#8B949E] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ============ MAIN RESULT DISPLAY ============ */}
        <motion.div
          className="relative bg-[#161B22] overflow-hidden"
          style={{ borderRadius: 0 }}
          animate={
            isWinResult
              ? { opacity: [0.8, 1, 0.8], scale: [1, 1.01, 1] }
              : isLossResult
                ? { opacity: 0.9 }
                : { opacity: 1 }
          }
          transition={isWinResult ? { duration: 1.5, repeat: 2 } : { duration: 0.3 }}
        >
          {/* Background flashes */}
          <AnimatePresence>
            {isWinResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.15, 0.05, 0.12, 0.04] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2 }}
                className="absolute inset-0 bg-[#10B981] pointer-events-none"
              />
            )}
            {isLossResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.08, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 bg-[#EF4444] pointer-events-none"
              />
            )}
          </AnimatePresence>

          <div className="relative z-10 flex flex-col items-center justify-center py-16">
            {/* The big number */}
            <motion.div
              className={cn('font-mono font-black tracking-tight transition-colors duration-200', resultColor)}
              style={{ fontSize: 'clamp(4rem, 14vw, 7rem)', lineHeight: 1 }}
              animate={
                isPlaying
                  ? { scale: [1, 1.02, 1], opacity: [1, 0.85, 1] }
                  : isWinResult
                    ? {
                        scale: [1.1, 1],
                        opacity: [1, 0.8, 1],
                      }
                    : { scale: 1, opacity: 1 }
              }
              transition={
                isPlaying
                  ? { repeat: Infinity, duration: 0.12 }
                  : { type: 'spring', stiffness: 300, damping: 20 }
              }
            >
              {displayNumber !== null ? `${displayNumber.toFixed(2)}x` : '0.00x'}
            </motion.div>

            {/* Win/Loss label */}
            <AnimatePresence>
              {isWinResult && lastResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.1, type: 'spring' }}
                  className="mt-4 flex flex-col items-center gap-1"
                >
                  <span className="text-[#10B981] font-bold text-lg">YOU WIN</span>
                  <span className="text-[#10B981] font-mono text-sm">
                    +{formatCurrency(lastResult.profit, currency)}
                  </span>
                </motion.div>
              )}
              {isLossResult && lastResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mt-4 flex flex-col items-center gap-1"
                >
                  <span className="text-[#EF4444] font-semibold text-base">No Luck</span>
                  <span className="text-[#EF4444]/70 font-mono text-sm">
                    -{formatCurrency(lastResult.betAmount, currency)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ============ BET CONTROLS ============ */}
        <div className="space-y-3">
          {/* Manual / Auto Toggle */}
          <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
            <button
              onClick={() => { setActiveTab('manual'); setAutoBetEnabled(false); }}
              className={cn(
                'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                activeTab === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
              )}
            >
              Manual
            </button>
            <button
              onClick={() => { setActiveTab('auto'); setAutoBetEnabled(true); }}
              className={cn(
                'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                activeTab === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
              )}
            >
              Auto
            </button>
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
                step="any"
                className="flex-1 bg-transparent text-sm font-mono text-[#E6EDF3] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => adjustBet(0.5)}
                  className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => adjustBet(2)}
                  className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
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
                  onClick={() => {
                    if (label === 'Min') setBetAmount(getDefaultBet(currency));
                    else if (label === '1/2') adjustBet(0.5);
                    else if (label === '2x') adjustBet(2);
                    else if (label === 'Max') setMaxBet();
                  }}
                  className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-[#E6EDF3] transition-colors flex-1 text-center"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Multiplier - LARGE */}
          <div>
            <label className="text-xs text-[#8B949E] mb-1.5 block font-medium">Target Multiplier</label>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
              <button
                onClick={() => adjustTarget(-0.1)}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                value={targetMultiplier}
                onChange={(e) => handleTargetChange(e.target.value)}
                step="0.01"
                min={MIN_TARGET}
                max={MAX_TARGET}
                className="flex-1 bg-transparent text-lg font-mono font-bold text-[#C8FF00] text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-[#484F58] mr-2">x</span>
              <button
                onClick={() => adjustTarget(0.1)}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Quick presets */}
            <div className="flex gap-1.5 mt-2">
              {[1.5, 2, 3, 5, 10, 100].map((t) => (
                <button
                  key={t}
                  onClick={() => setTargetMultiplier(t)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-[10px] font-bold transition-colors',
                    targetMultiplier === t
                      ? 'bg-[#C8FF00]/20 text-[#C8FF00] border border-[#C8FF00]/40'
                      : 'bg-[#21262D] text-[#8B949E] border border-[#30363D] hover:text-[#E6EDF3]',
                  )}
                >
                  {t}x
                </button>
              ))}
            </div>
          </div>

          {/* Win Chance & Profit - auto-calculated */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
              <p className="text-[10px] text-[#8B949E] mb-0.5">Win Chance</p>
              <p className="text-lg font-bold font-mono text-[#E6EDF3]">
                {winChance.toFixed(4)}%
              </p>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
              <p className="text-[10px] text-[#8B949E] mb-0.5">Profit on Win</p>
              <p className="text-lg font-bold font-mono text-[#10B981]">
                {formatCurrency(profitOnWin, currency)}
              </p>
            </div>
          </div>

          {/* Auto-bet options */}
          {activeTab === 'auto' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] text-[#8B949E] mb-1 block">Number of Bets</label>
                <input
                  type="number"
                  value={autoBetCount || ''}
                  onChange={(e) => setAutoBetCount(parseInt(e.target.value) || 0)}
                  placeholder="Infinite"
                  className="w-full h-9 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#8B949E] mb-1 block">Stop on Profit</label>
                  <input
                    type="number"
                    value={stopOnWin}
                    onChange={(e) => setStopOnWin(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8B949E] mb-1 block">Stop on Loss</label>
                  <input
                    type="number"
                    value={stopOnLoss}
                    onChange={(e) => setStopOnLoss(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {autoBetActive && (
                <div className="bg-[#0D1117] rounded-lg p-3 border border-[#30363D]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#8B949E]">Rounds</span>
                    <span className="font-mono text-[#E6EDF3]">
                      {autoBetPlayed}{autoBetCount > 0 ? ` / ${autoBetCount}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1.5">
                    <span className="text-[#8B949E]">Profit</span>
                    <span className={cn(
                      'font-mono font-semibold',
                      totalProfitRef.current >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
                    )}>
                      {totalProfitRef.current >= 0 ? '+' : ''}{formatCurrency(totalProfitRef.current, currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BET BUTTON - Lime CTA */}
          <motion.button
            disabled={!isAuthenticated || isPlaying}
            onClick={autoBetActive ? stopAutoBet : (autoBetEnabled ? startAutoBet : handlePlay)}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-base',
              autoBetActive
                ? 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
                : isPlaying
                  ? 'bg-[#1C2128] text-[#484F58] cursor-not-allowed'
                  : 'bg-[#C8FF00] text-black font-bold hover:bg-[#D4FF33] active:bg-[#B8EF00]',
            )}
          >
            {autoBetActive ? (
              <>
                <Square className="w-4 h-4" />
                Stop ({autoBetPlayed})
              </>
            ) : isPlaying ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}
                >
                  <Zap className="w-5 h-5" />
                </motion.div>
                Playing...
              </span>
            ) : !isAuthenticated ? (
              'Login to Play'
            ) : autoBetEnabled ? (
              <>
                <Play className="w-4 h-4" />
                Start Auto Bet
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Bet
              </>
            )}
          </motion.button>
        </div>

        {/* ============ GAME HISTORY TABLE ============ */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[#30363D]">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#8B949E]" />
                <h3 className="text-xs font-semibold text-[#E6EDF3]">Recent Bets</h3>
              </div>
              <span className="text-[10px] text-[#484F58] font-mono">{history.length} rounds</span>
            </div>

            <div className="max-h-52 overflow-y-auto divide-y divide-[#30363D]/30">
              {history.map((round, i) => (
                <motion.div
                  key={round.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.015 }}
                  className="px-4 py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#8B949E] w-12">{round.target.toFixed(2)}x</span>
                    <span className={cn(
                      'font-mono font-bold',
                      round.isWin ? 'text-[#10B981]' : 'text-[#EF4444]',
                    )}>
                      {round.resultMultiplier.toFixed(2)}x
                    </span>
                  </div>
                  <span className={cn(
                    'font-mono font-bold',
                    round.isWin ? 'text-[#10B981]' : 'text-[#EF4444]',
                  )}>
                    {round.isWin
                      ? `+${formatCurrency(round.profit, currency)}`
                      : `-${formatCurrency(round.betAmount, currency)}`
                    }
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Provably Fair Panel */}
        <AnimatePresence>
          {showFairness && fairness && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#E6EDF3] mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#8B5CF6]" />
                  Fairness Verification
                </p>
                {[
                  { label: 'Server Seed Hash', value: fairness.serverSeedHash },
                  { label: 'Client Seed', value: fairness.clientSeed },
                  { label: 'Nonce', value: fairness.nonce.toString() },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-[#8B949E]">{item.label}</span>
                    <span className="text-[11px] font-mono text-[#E6EDF3] bg-[#0D1117] rounded-lg px-2 py-1 break-all">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
