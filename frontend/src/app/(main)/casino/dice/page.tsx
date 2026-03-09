'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Dices,
  History,
  Home,
  Info,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
  DollarSign,
  Percent,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiceApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    target: number;
    condition: 'over' | 'under';
    roll: number;
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
  target: number;
  condition: 'over' | 'under';
  result: number;
  won: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  timestamp: Date;
  fairness?: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

interface AutoBetConfig {
  enabled: boolean;
  numberOfBets: number;
  stopOnProfit: number;
  stopOnLoss: number;
  onWin: 'reset' | 'increase';
  onWinIncrease: number;
  onLoss: 'reset' | 'increase';
  onLossIncrease: number;
}

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];
const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

const HOUSE_EDGE = 0.01; // 1% house edge

// ---------------------------------------------------------------------------
// SVG Icons (inline)
// ---------------------------------------------------------------------------

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
// Dice Game Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function DiceGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [target, setTarget] = useState(50.00);
  const [condition, setCondition] = useState<'over' | 'under'>('over');
  const [betAmount, setBetAmount] = useState('1.00');
  const [result, setResult] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [lastProfit, setLastProfit] = useState<number>(0);
  const [history, setHistory] = useState<GameRound[]>([]);
  const [rollingDisplay, setRollingDisplay] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [lastFairness, setLastFairness] = useState<DiceApiResponse['fairness'] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showAutoBet, setShowAutoBet] = useState(false);
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null);
  const [resultScale, setResultScale] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [rollMode, setRollMode] = useState<'over' | 'under' | 'inside'>('over');
  const [showRollModeDropdown, setShowRollModeDropdown] = useState(false);
  const [insideLow, setInsideLow] = useState(25.00);
  const [insideHigh, setInsideHigh] = useState(75.00);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Auto-bet state
  const [autoBet, setAutoBet] = useState<AutoBetConfig>({
    enabled: false,
    numberOfBets: 10,
    stopOnProfit: 0,
    stopOnLoss: 0,
    onWin: 'reset',
    onWinIncrease: 50,
    onLoss: 'reset',
    onLossIncrease: 50,
  });
  const [autoBetRunning, setAutoBetRunning] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(0);
  const [autoBetProfit, setAutoBetProfit] = useState(0);
  const autoBetRef = useRef(false);
  const baseBetRef = useRef('1.00');

  // Refs
  const isPlayingRef = useRef(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const rollModeDropdownRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingHandle = useRef<'left' | 'right' | 'single' | null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup spin interval on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  // Initialize bet amount on currency change
  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  // Sync condition with rollMode
  useEffect(() => {
    if (rollMode === 'over' || rollMode === 'under') {
      setCondition(rollMode);
    } else {
      setCondition('over');
    }
  }, [rollMode]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
      if (rollModeDropdownRef.current && !rollModeDropdownRef.current.contains(e.target as Node)) {
        setShowRollModeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Clear flash effect
  useEffect(() => {
    if (flashColor) {
      const t = setTimeout(() => setFlashColor(null), 600);
      return () => clearTimeout(t);
    }
  }, [flashColor]);

  // Calculations
  const winChance = rollMode === 'inside'
    ? parseFloat(Math.max(0, insideHigh - insideLow).toFixed(4))
    : condition === 'over'
      ? parseFloat((99.99 - target).toFixed(2))
      : parseFloat(target.toFixed(2));

  const multiplier = winChance > 0
    ? parseFloat(((100 - HOUSE_EDGE * 100) / winChance).toFixed(4))
    : 0;
  const profitOnWin = parseFloat(betAmount) * multiplier - parseFloat(betAmount);

  // Current balance
  const currentBalance = user?.balances?.find((b) => b.currency === currency)?.available ?? 0;

  // -------------------------------------------------------------------------
  // Roll handler
  // -------------------------------------------------------------------------

  const handleRoll = useCallback(async (autoBetAmountOverride?: string) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    const rollBetAmount = autoBetAmountOverride || betAmount;

    setIsRolling(true);
    setResult(null);
    setLastWin(null);
    setLastProfit(0);
    setRollingDisplay(null);
    setErrorMessage(null);
    setResultScale(1);

    // Rolling animation
    let animFrame = 0;
    const totalFrames = 24;
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    spinIntervalRef.current = setInterval(() => {
      setRollingDisplay(parseFloat((Math.random() * 99.99).toFixed(2)));
      animFrame++;
      if (animFrame >= totalFrames) {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
    }, 50);

    try {
      // For "inside" mode, we send as "over" with the low boundary as target
      const apiCondition = rollMode === 'inside' ? 'over' : condition;
      const apiTarget = rollMode === 'inside' ? insideLow : parseFloat(target.toFixed(2));

      const response = await post<DiceApiResponse>('/casino/games/dice/play', {
        amount: parseFloat(rollBetAmount),
        currency,
        options: {
          target: apiTarget,
          condition: apiCondition,
        },
      });

      // Wait for animation to finish
      const elapsed = animFrame * 50;
      const remaining = Math.max(0, totalFrames * 50 - elapsed);
      await new Promise((r) => setTimeout(r, remaining));
      if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null; }

      // Set result
      const finalResult = response.result.roll;
      const won = response.result.isWin;

      setResult(finalResult);
      setRollingDisplay(null);
      setLastWin(won);
      setLastProfit(response.profit);
      setLastFairness(response.fairness);
      setFlashColor(won ? 'green' : 'red');

      // Scale animation for result reveal
      setResultScale(1.15);
      setTimeout(() => setResultScale(1), 300);

      // Update balance
      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      // Add to history
      const round: GameRound = {
        id: response.roundId,
        target: parseFloat(target.toFixed(2)),
        condition,
        result: finalResult,
        won,
        betAmount: parseFloat(rollBetAmount),
        payout: response.payout,
        profit: response.profit,
        multiplier: response.multiplier,
        timestamp: new Date(),
        fairness: response.fairness,
      };
      setHistory((prev) => [round, ...prev.slice(0, 49)]);

      setIsRolling(false);
      isPlayingRef.current = false;

      return { won, profit: response.profit };
    } catch (err: any) {
      if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null; }
      const errorCode = err?.errors?.code || err?.message || '';
      if (errorCode === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(err?.message || '')) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(err?.message || 'Failed to place bet. Please try again.');
      }
      setIsRolling(false);
      isPlayingRef.current = false;
      return null;
    }
  }, [condition, target, betAmount, currency, rollMode, insideLow, insideHigh]);

  // -------------------------------------------------------------------------
  // Auto-bet
  // -------------------------------------------------------------------------

  const startAutoBet = useCallback(async () => {
    if (!isAuthenticated || autoBetRunning) return;
    autoBetRef.current = true;
    setAutoBetRunning(true);
    setAutoBetCount(0);
    setAutoBetProfit(0);
    baseBetRef.current = betAmount;

    let currentBet = betAmount;
    let totalProfit = 0;
    let count = 0;

    while (autoBetRef.current && count < autoBet.numberOfBets) {
      const rollResult = await handleRoll(currentBet);
      if (!rollResult) {
        break;
      }

      count++;
      totalProfit += rollResult.profit;
      setAutoBetCount(count);
      setAutoBetProfit(totalProfit);

      // Check stop conditions
      if (autoBet.stopOnProfit > 0 && totalProfit >= autoBet.stopOnProfit) break;
      if (autoBet.stopOnLoss > 0 && totalProfit <= -autoBet.stopOnLoss) break;

      // Adjust bet
      if (rollResult.won) {
        if (autoBet.onWin === 'reset') {
          currentBet = baseBetRef.current;
        } else {
          const increased = parseFloat(currentBet) * (1 + autoBet.onWinIncrease / 100);
          currentBet = increased.toFixed(8);
        }
      } else {
        if (autoBet.onLoss === 'reset') {
          currentBet = baseBetRef.current;
        } else {
          const increased = parseFloat(currentBet) * (1 + autoBet.onLossIncrease / 100);
          currentBet = increased.toFixed(8);
        }
      }

      setBetAmount(currentBet);

      // Small delay between bets
      await new Promise((r) => setTimeout(r, 300));
    }

    autoBetRef.current = false;
    setAutoBetRunning(false);
  }, [isAuthenticated, autoBetRunning, autoBet, betAmount, handleRoll]);

  const stopAutoBet = useCallback(() => {
    autoBetRef.current = false;
    setAutoBetRunning(false);
  }, []);

  // -------------------------------------------------------------------------
  // Bet amount helpers
  // -------------------------------------------------------------------------

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00000001, val * factor).toFixed(8));
  };

  const adjustBetStep = (action: 'minus' | 'plus') => {
    const val = parseFloat(betAmount) || 0;
    const step = currency === 'BTC' ? 0.0001 : currency === 'ETH' ? 0.001 : 1;
    if (action === 'minus') {
      setBetAmount(Math.max(step, val - step).toFixed(8).replace(/\.?0+$/, ''));
    } else {
      const maxBal = currentBalance || 100;
      setBetAmount(Math.min(maxBal, val + step).toFixed(8).replace(/\.?0+$/, ''));
    }
  };

  // -------------------------------------------------------------------------
  // Slider interaction
  // -------------------------------------------------------------------------

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTarget(val);
  };

  const handleTargetInput = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0.01 && num <= 99.98) {
      setTarget(num);
    }
  };

  const handleWinChanceInput = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0.01 && num <= 99.98) {
      if (rollMode === 'inside') {
        const half = num / 2;
        setInsideLow(parseFloat((50 - half).toFixed(2)));
        setInsideHigh(parseFloat((50 + half).toFixed(2)));
      } else if (condition === 'over') {
        setTarget(parseFloat((99.99 - num).toFixed(2)));
      } else {
        setTarget(parseFloat(num.toFixed(2)));
      }
    }
  };

  const handleMultiplierInput = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 1.0102) {
      const wc = (100 - HOUSE_EDGE * 100) / num;
      if (wc >= 0.01 && wc <= 99.98) {
        if (rollMode === 'inside') {
          const half = wc / 2;
          setInsideLow(parseFloat((50 - half).toFixed(2)));
          setInsideHigh(parseFloat((50 + half).toFixed(2)));
        } else if (condition === 'over') {
          setTarget(parseFloat((99.99 - wc).toFixed(2)));
        } else {
          setTarget(parseFloat(wc.toFixed(2)));
        }
      }
    }
  };

  // Inside range slider handlers
  const handleRangeBarInteraction = (clientX: number) => {
    if (!sliderRef.current || isRolling) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const rounded = parseFloat(pct.toFixed(2));

    if (rollMode === 'inside') {
      if (draggingHandle.current === 'left') {
        setInsideLow(Math.min(rounded, insideHigh - 1));
      } else if (draggingHandle.current === 'right') {
        setInsideHigh(Math.max(rounded, insideLow + 1));
      }
    } else {
      if (draggingHandle.current === 'single') {
        setTarget(Math.max(2, Math.min(98, rounded)));
      }
    }
  };

  const onPointerDown = (handle: 'left' | 'right' | 'single') => (e: React.PointerEvent) => {
    if (isRolling) return;
    draggingHandle.current = handle;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingHandle.current) return;
    handleRangeBarInteraction(e.clientX);
  };

  const onPointerUp = () => {
    draggingHandle.current = null;
  };

  // Display value
  const displayNumber = rollingDisplay ?? result;

  // Build the slider gradient depending on mode
  const getSliderGradient = () => {
    if (rollMode === 'inside') {
      return `linear-gradient(to right, #EF4444 0%, #EF4444 ${insideLow}%, #10B981 ${insideLow}%, #10B981 ${insideHigh}%, #EF4444 ${insideHigh}%, #EF4444 100%)`;
    }
    if (condition === 'over') {
      return `linear-gradient(to right, #EF4444 0%, #EF4444 ${target}%, #10B981 ${target}%, #10B981 100%)`;
    }
    return `linear-gradient(to right, #10B981 0%, #10B981 ${target}%, #EF4444 ${target}%, #EF4444 100%)`;
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col">
      {/* Screen flash overlay */}
      <AnimatePresence>
        {flashColor && (
          <motion.div
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className={cn(
              'fixed inset-0 z-50 pointer-events-none',
              flashColor === 'green' ? 'bg-[#10B981]' : 'bg-[#EF4444]',
            )}
          />
        )}
      </AnimatePresence>

      {/* Scrollbar hide CSS */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* ============================================================== */}
      {/* CRYPTOBET Header Bar - thin dark bar */}
      {/* ============================================================== */}
      <div className="bg-[#161B22] py-2 text-center">
        <h1 className="text-sm font-bold tracking-widest text-white/80 uppercase">
          <span className="text-[#8B5CF6]">CRYPTO</span>BET
        </h1>
      </div>

      {/* Main content area - full width */}
      <div className="flex-1 w-full px-4 pt-3 pb-20 space-y-3">

        {/* Error Message */}
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

        {/* ============================================================== */}
        {/* RESULT DISPLAY - Large centered number                         */}
        {/* ============================================================== */}
        <motion.div
          className={cn(
            'relative rounded-2xl overflow-hidden',
            lastWin === true && !isRolling ? 'bg-[#10B981]/5' : '',
            lastWin === false && !isRolling ? 'bg-[#EF4444]/5' : '',
            lastWin === null || isRolling ? 'bg-[#161B22]' : 'bg-[#161B22]',
          )}
        >
          <div className="relative z-10 px-4 py-8 text-center">
            <motion.div
              animate={{ scale: resultScale }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className={cn(
                'text-6xl sm:text-7xl font-black font-mono tracking-tighter',
                displayNumber === null
                  ? 'text-[#30363D]'
                  : isRolling
                    ? 'text-[#8B949E]'
                    : lastWin
                      ? 'text-[#10B981]'
                      : 'text-[#EF4444]',
              )}
            >
              {displayNumber !== null ? displayNumber.toFixed(2) : '0.00'}
            </motion.div>

            {/* Win/Loss badge */}
            <AnimatePresence>
              {lastWin !== null && !isRolling && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mt-3"
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold',
                      lastWin
                        ? 'bg-[#10B981]/15 text-[#10B981]'
                        : 'bg-[#EF4444]/15 text-[#EF4444]',
                    )}
                  >
                    {lastWin ? (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        +{formatCurrency(lastProfit, currency)}
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4" />
                        -{formatCurrency(parseFloat(betAmount), currency)}
                      </>
                    )}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ============================================================== */}
        {/* RANGE SLIDER BAR - Green/Red zones with handles               */}
        {/* ============================================================== */}
        <div className="space-y-1">
          <div
            ref={sliderRef}
            className="relative select-none touch-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* Track */}
            <div
              className="h-4 rounded-full relative overflow-visible"
              style={{ background: getSliderGradient() }}
            >
              {/* Result marker on the bar */}
              <AnimatePresence>
                {result !== null && !isRolling && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-1/2 -translate-y-1/2 z-20"
                    style={{ left: `${result}%` }}
                  >
                    <div className="w-1.5 h-6 rounded-sm -translate-x-1/2 bg-white shadow-lg shadow-white/30" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Draggable handles */}
            {rollMode === 'inside' ? (
              <>
                {/* Left handle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing"
                  style={{ left: `${insideLow}%`, transform: `translateX(-50%) translateY(-50%)` }}
                  onPointerDown={onPointerDown('left')}
                >
                  <div className="w-7 h-7 rounded-full bg-[#FACC15] border-[3px] border-[#0D1117] shadow-lg shadow-[#FACC15]/30 flex items-center justify-center">
                    <div className="w-1 h-3 bg-[#0D1117]/40 rounded-full" />
                  </div>
                </div>
                {/* Right handle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing"
                  style={{ left: `${insideHigh}%`, transform: `translateX(-50%) translateY(-50%)` }}
                  onPointerDown={onPointerDown('right')}
                >
                  <div className="w-7 h-7 rounded-full bg-[#FACC15] border-[3px] border-[#0D1117] shadow-lg shadow-[#FACC15]/30 flex items-center justify-center">
                    <div className="w-1 h-3 bg-[#0D1117]/40 rounded-full" />
                  </div>
                </div>
              </>
            ) : (
              /* Single handle for over/under */
              <div
                className="absolute top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing"
                style={{ left: `${target}%`, transform: `translateX(-50%) translateY(-50%)` }}
                onPointerDown={onPointerDown('single')}
              >
                <div className="w-7 h-7 rounded-full bg-[#FACC15] border-[3px] border-[#0D1117] shadow-lg shadow-[#FACC15]/30 flex items-center justify-center">
                  <div className="w-1 h-3 bg-[#0D1117]/40 rounded-full" />
                </div>
              </div>
            )}

            {/* Fallback hidden range input for accessibility (over/under only) */}
            {rollMode !== 'inside' && (
              <input
                type="range"
                min={2}
                max={98}
                step={1}
                value={target}
                onChange={handleSliderChange}
                disabled={isRolling}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-4 z-0"
              />
            )}
          </div>

          {/* 0 and 100 labels */}
          <div className="flex justify-between px-0.5 text-xs text-[#8B949E] font-mono">
            <span>0</span>
            <span>100</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* WIN CHANCE + MULTIPLIER + PROFIT ON WIN - three side by side    */}
        {/* ============================================================== */}
        <div className="grid grid-cols-3 gap-2">
          {/* Win Chance */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-[#8B949E] font-medium mb-1">Win Chance</p>
            <p className="text-sm font-bold font-mono text-white">{winChance.toFixed(2)}%</p>
          </div>
          {/* Multiplier */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-[#8B949E] font-medium mb-1">Multiplier</p>
            <p className="text-sm font-bold font-mono text-white">{multiplier.toFixed(4)}x</p>
          </div>
          {/* Profit on Win */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-[#8B949E] font-medium mb-1">Profit</p>
            <p className="text-sm font-bold font-mono text-[#10B981]">
              +{formatCurrency(profitOnWin > 0 ? profitOnWin : 0, currency)}
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ROLL OVER / UNDER TOGGLE                                       */}
        {/* ============================================================== */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => {
              setRollMode('over');
              setCondition('over');
            }}
            disabled={isRolling}
            className={cn(
              'flex-1 py-2.5 px-4 text-sm font-medium transition-all duration-200',
              rollMode === 'over'
                ? 'bg-[#10B981] text-white'
                : 'text-[#8B949E] hover:text-white',
            )}
          >
            Roll Over
          </button>
          <button
            onClick={() => {
              setRollMode('under');
              setCondition('under');
            }}
            disabled={isRolling}
            className={cn(
              'flex-1 py-2.5 px-4 text-sm font-medium transition-all duration-200',
              rollMode === 'under'
                ? 'bg-[#EF4444] text-white'
                : 'text-[#8B949E] hover:text-white',
            )}
          >
            Roll Under
          </button>
        </div>

        {/* ============================================================== */}
        {/* TARGET VALUE DISPLAY                                           */}
        {/* ============================================================== */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3">
          <label className="text-xs text-[#8B949E] font-medium mb-2 block">
            {condition === 'over' ? 'Roll Over' : 'Roll Under'}
          </label>
          <input
            type="number"
            value={target.toFixed(2)}
            onChange={(e) => handleTargetInput(e.target.value)}
            disabled={isRolling}
            step={1}
            className="w-full h-11 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-sm font-bold font-mono text-white focus:outline-none focus:border-[#8B5CF6] text-center"
          />
        </div>

        {/* ============================================================== */}
        {/* BET BUTTON - Lime CTA                                          */}
        {/* ============================================================== */}
        {!autoBetRunning ? (
          <motion.button
            disabled={!isAuthenticated || isRolling}
            onClick={() => handleRoll()}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full py-3.5 font-bold rounded-xl text-base transition-all duration-200 flex items-center justify-center gap-2.5 relative overflow-hidden',
              isRolling
                ? 'bg-[#484F58] text-[#8B949E] cursor-not-allowed'
                : !isAuthenticated
                  ? 'bg-[#30363D] text-[#8B949E] cursor-not-allowed'
                  : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00] active:bg-[#A8DF00]',
            )}
          >
            {isRolling && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              />
            )}
            <span className="relative z-10">
              {isRolling ? 'Rolling...' : isAuthenticated ? 'BET' : 'Login to Play'}
            </span>
          </motion.button>
        ) : (
          <motion.button
            onClick={stopAutoBet}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 font-bold rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center gap-2.5 text-base transition-colors"
          >
            Stop Auto-Bet ({autoBetCount}/{autoBet.numberOfBets})
          </motion.button>
        )}

        {/* Status hint */}
        <div className="text-center">
          <p className="text-sm text-[#C8FF00]">
            {isRolling ? 'Rolling...' : result === null ? 'Bet to start game.' : lastWin ? 'You won!' : 'Try again!'}
          </p>
        </div>

        {/* ============================================================== */}
        {/* MANUAL / AUTO TOGGLE                                           */}
        {/* ============================================================== */}
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
            onClick={() => {
              setActiveTab('auto');
              setShowAutoBet(true);
            }}
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

        {/* ============================================================== */}
        {/* BET AMOUNT CONTROL - Cloudbet style                            */}
        {/* ============================================================== */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            {/* Left: currency */}
            <span className="text-xs text-[#8B949E] font-medium mr-2">{currency}</span>
            {/* Center: amount */}
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={isRolling || autoBetRunning}
              step="any"
              className="flex-1 bg-transparent font-mono text-base text-white text-center focus:outline-none disabled:opacity-50"
            />
            {/* Right: minus/plus */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => adjustBetStep('minus')}
                disabled={isRolling || autoBetRunning}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => adjustBetStep('plus')}
                disabled={isRolling || autoBetRunning}
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
                disabled={isRolling || autoBetRunning}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
              >
                {preset}
              </button>
            ))}
            <button
              onClick={() => adjustBet(0.5)}
              disabled={isRolling || autoBetRunning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
            >
              1/2
            </button>
            <button
              onClick={() => adjustBet(2)}
              disabled={isRolling || autoBetRunning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-all"
            >
              2X
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* AUTO-BET PANEL (shown when Auto tab is active)                 */}
        {/* ============================================================== */}
        <AnimatePresence>
          {activeTab === 'auto' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-3">

                {/* Number of bets */}
                <div>
                  <label className="text-xs text-[#8B949E] font-medium mb-1.5 block">Number of Bets</label>
                  <input
                    type="number"
                    value={autoBet.numberOfBets}
                    onChange={(e) =>
                      setAutoBet((p) => ({ ...p, numberOfBets: Math.max(1, parseInt(e.target.value) || 1) }))
                    }
                    disabled={autoBetRunning}
                    className="w-full h-11 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-white focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>

                {/* Stop on profit/loss */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8B949E] font-medium mb-1.5 block">Stop Profit</label>
                    <input
                      type="number"
                      value={autoBet.stopOnProfit || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setAutoBet((p) => ({ ...p, stopOnProfit: parseFloat(e.target.value) || 0 }))
                      }
                      disabled={autoBetRunning}
                      className="w-full h-11 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-white focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#8B949E] font-medium mb-1.5 block">Stop Loss</label>
                    <input
                      type="number"
                      value={autoBet.stopOnLoss || ''}
                      placeholder="0"
                      onChange={(e) =>
                        setAutoBet((p) => ({ ...p, stopOnLoss: parseFloat(e.target.value) || 0 }))
                      }
                      disabled={autoBetRunning}
                      className="w-full h-11 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-white focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>
                </div>

                {/* On Win */}
                <div>
                  <label className="text-xs text-[#8B949E] font-medium mb-1.5 block">On Win</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAutoBet((p) => ({ ...p, onWin: 'reset' }))}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-10 rounded-lg text-xs font-bold transition-colors',
                        autoBet.onWin === 'reset'
                          ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                          : 'bg-[#0D1117] border border-[#30363D] text-[#8B949E]',
                      )}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setAutoBet((p) => ({ ...p, onWin: 'increase' }))}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-10 rounded-lg text-xs font-bold transition-colors',
                        autoBet.onWin === 'increase'
                          ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                          : 'bg-[#0D1117] border border-[#30363D] text-[#8B949E]',
                      )}
                    >
                      Increase
                    </button>
                    {autoBet.onWin === 'increase' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={autoBet.onWinIncrease}
                          onChange={(e) =>
                            setAutoBet((p) => ({ ...p, onWinIncrease: parseFloat(e.target.value) || 0 }))
                          }
                          disabled={autoBetRunning}
                          className="w-16 h-10 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 text-xs font-mono text-white focus:outline-none text-center"
                        />
                        <span className="text-xs text-[#8B949E]">%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* On Loss */}
                <div>
                  <label className="text-xs text-[#8B949E] font-medium mb-1.5 block">On Loss</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAutoBet((p) => ({ ...p, onLoss: 'reset' }))}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-10 rounded-lg text-xs font-bold transition-colors',
                        autoBet.onLoss === 'reset'
                          ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                          : 'bg-[#0D1117] border border-[#30363D] text-[#8B949E]',
                      )}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setAutoBet((p) => ({ ...p, onLoss: 'increase' }))}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-10 rounded-lg text-xs font-bold transition-colors',
                        autoBet.onLoss === 'increase'
                          ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                          : 'bg-[#0D1117] border border-[#30363D] text-[#8B949E]',
                      )}
                    >
                      Increase
                    </button>
                    {autoBet.onLoss === 'increase' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={autoBet.onLossIncrease}
                          onChange={(e) =>
                            setAutoBet((p) => ({ ...p, onLossIncrease: parseFloat(e.target.value) || 0 }))
                          }
                          disabled={autoBetRunning}
                          className="w-16 h-10 bg-[#0D1117] border border-[#30363D] rounded-lg px-2 text-xs font-mono text-white focus:outline-none text-center"
                        />
                        <span className="text-xs text-[#8B949E]">%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-bet progress tracker */}
                {autoBetRunning && (
                  <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8B949E]">Bets placed</span>
                      <span className="font-mono text-white">{autoBetCount} / {autoBet.numberOfBets}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8B949E]">Total profit</span>
                      <span className={cn('font-mono font-bold', autoBetProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                        {autoBetProfit >= 0 ? '+' : ''}{formatCurrency(autoBetProfit, currency)}
                      </span>
                    </div>
                    <div className="w-full bg-[#1C2128] rounded-full h-1.5 mt-1">
                      <div
                        className="bg-[#8B5CF6] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (autoBetCount / autoBet.numberOfBets) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Start auto-bet button */}
                {!autoBetRunning && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={startAutoBet}
                    disabled={!isAuthenticated || isRolling}
                    className={cn(
                      'w-full py-3 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors',
                      !isAuthenticated
                        ? 'bg-[#30363D] text-[#8B949E] cursor-not-allowed'
                        : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]',
                    )}
                  >
                    <Zap className="w-4 h-4" />
                    Start Auto Bet
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* PROVABLY FAIR PANEL                                            */}
        {/* ============================================================== */}
        <AnimatePresence>
          {showFairness && lastFairness && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-sm font-semibold text-white">Provably Fair</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">
                      Server Seed Hash
                    </label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">
                      {lastFairness.serverSeedHash}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">
                      Client Seed
                    </label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">
                      {lastFairness.clientSeed}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">
                      Nonce
                    </label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E]">
                      {lastFairness.nonce}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game info */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-[#484F58] pt-2">
          <span>House Edge: {(HOUSE_EDGE * 100).toFixed(0)}%</span>
          <span>|</span>
          <span>Range: 0.00 - 99.99</span>
          <span>|</span>
          <span>Provably Fair</span>
        </div>
      </div>

      {/* ================================================================ */}
      {/* FIXED BOTTOM BAR                                                 */}
      {/* ================================================================ */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        {/* Left icons */}
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E] hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <button
            onClick={() => setShowFairness(!showFairness)}
            className={cn(
              'transition-colors',
              showFairness ? 'text-[#8B5CF6]' : 'text-[#8B949E] hover:text-white',
            )}
          >
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              'transition-colors',
              soundEnabled ? 'text-white' : 'text-[#8B949E] hover:text-white',
            )}
          >
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>

        {/* Center balance */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#8B949E] font-medium">{currency}</span>
          <span className="text-sm font-mono text-white">
            {formatCurrency(currentBalance, currency)}
          </span>
        </div>

        {/* Right - Provably Fair badge */}
        <div className="flex items-center gap-1.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <ShieldCheck className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span className="text-xs text-[#8B5CF6] font-medium whitespace-nowrap">
            Provably Fair Game
          </span>
        </div>
      </div>
    </div>
  );
}
