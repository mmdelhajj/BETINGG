'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus,
  Plus,
  Dices,
  History,
  TrendingUp,
  TrendingDown,
  RotateCcw,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameRound {
  id: string;
  target: number;
  isOver: boolean;
  result: number;
  won: boolean;
  betAmount: number;
  payout: number;
  multiplier: number;
  timestamp: Date;
}

interface DiceApiResponse {
  roundId: string;
  payout: number;
  multiplier: number;
  result: {
    roll: number;
    target: number;
    isOver: boolean;
    winChance: number;
    isWin: boolean;
  };
  newBalance?: number;
}

// ---------------------------------------------------------------------------
// Dice Game Page
// ---------------------------------------------------------------------------

export default function DiceGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [betAmount, setBetAmount] = useState('1.00');
  const [result, setResult] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [history, setHistory] = useState<GameRound[]>([]);
  const [rollingDisplay, setRollingDisplay] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use a ref to guard against double-clicks / stale closures
  const isPlayingRef = useRef(false);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  const winChance = isOver ? 99.99 - target : target;
  const multiplier = winChance > 0 ? parseFloat((99 / winChance).toFixed(4)) : 0;
  const potentialWin = parseFloat(betAmount) * multiplier;

  const handleRoll = useCallback(async () => {
    // Ref-based guard: immune to stale closures
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    setIsRolling(true);
    setResult(null);
    setLastWin(null);
    setRollingDisplay(null);
    setErrorMessage(null);

    // Start spinning number animation immediately
    let animFrame = 0;
    const totalFrames = 20;
    const spinInterval = setInterval(() => {
      const display = parseFloat((Math.random() * 99.99).toFixed(2));
      setRollingDisplay(display);
      animFrame++;
      if (animFrame >= totalFrames) {
        clearInterval(spinInterval);
      }
    }, 60);

    // Call backend API
    let finalResult: number;
    let won: boolean;
    let payout: number;
    let roundMultiplier: number;
    let roundId: string;
    try {
      const response = await post<DiceApiResponse>('/casino/games/dice/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { target, isOver },
      });

      finalResult = response.result.roll;
      won = response.result.isWin;
      payout = response.payout;
      roundMultiplier = response.multiplier;
      roundId = response.roundId;
      // Update balance in auth store
      if (response.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, response.newBalance, 0);
      }
    } catch (err: any) {
      // Handle specific errors
      const errorCode = err?.errors?.code || err?.message || '';
      if (errorCode === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(err?.message || '')) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage('Failed to place bet. Please try again.');
      }

      clearInterval(spinInterval);
      setIsRolling(false);
      isPlayingRef.current = false;
      return;
    }

    // Wait for animation to complete if API was faster
    const elapsed = animFrame * 60;
    const remaining = Math.max(0, totalFrames * 60 - elapsed);
    await new Promise((resolve) => setTimeout(resolve, remaining));

    clearInterval(spinInterval);
    setResult(finalResult);
    setRollingDisplay(null);
    setLastWin(won);
    setIsRolling(false);
    isPlayingRef.current = false;

    // Add to history
    const round: GameRound = {
      id: roundId,
      target,
      isOver,
      result: finalResult,
      won,
      betAmount: parseFloat(betAmount),
      payout: won ? payout : 0,
      multiplier: roundMultiplier,
      timestamp: new Date(),
    };
    setHistory((prev) => [round, ...prev.slice(0, 49)]);
  }, [isOver, target, betAmount, multiplier, currency]);

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(5));
  };

  const displayNumber = rollingDisplay ?? result;

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0 pb-24">
      {/* Error Message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-card bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Display */}
      <motion.div
        className="bg-[#161B22] border border-[#30363D] rounded-card p-5 sm:p-8 text-center relative overflow-hidden"
        animate={
          lastWin !== null && !isRolling
            ? { borderColor: lastWin ? '#10B981' : '#EF4444' }
            : { borderColor: '#30363D' }
        }
        transition={{ duration: 0.3 }}
      >
        {/* Background glow on result */}
        <AnimatePresence>
          {lastWin !== null && !isRolling && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'absolute inset-0',
                lastWin ? 'bg-[#10B981]' : 'bg-[#EF4444]',
              )}
            />
          )}
        </AnimatePresence>

        <motion.div
          className={cn(
            'text-5xl sm:text-7xl md:text-9xl font-bold font-mono transition-colors duration-200 relative z-10',
            displayNumber === null
              ? 'text-[#484F58]'
              : isRolling
                ? 'text-[#E6EDF3]'
                : lastWin
                  ? 'text-[#10B981]'
                  : 'text-[#EF4444]',
          )}
          animate={isRolling ? { scale: [1, 1.02, 1] } : { scale: 1 }}
          transition={{ repeat: isRolling ? Infinity : 0, duration: 0.15 }}
        >
          {displayNumber !== null ? displayNumber.toFixed(2) : '00.00'}
        </motion.div>

        <AnimatePresence>
          {lastWin !== null && !isRolling && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'mt-4 text-lg font-semibold relative z-10',
                lastWin ? 'text-[#10B981]' : 'text-[#EF4444]',
              )}
            >
              {lastWin
                ? `You Win! +${formatCurrency(potentialWin - parseFloat(betAmount), currency)}`
                : 'You Lose'}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Slider */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-6 space-y-3 sm:space-y-4">
        {/* Range Slider */}
        <div className="relative">
          <div className="h-3 rounded-full bg-[#1C2128] relative overflow-hidden">
            {isOver ? (
              <>
                <div
                  className="absolute left-0 top-0 h-full bg-[#EF4444]/40 rounded-l-full transition-all duration-150"
                  style={{ width: `${target}%` }}
                />
                <div
                  className="absolute top-0 right-0 h-full bg-[#10B981]/40 rounded-r-full transition-all duration-150"
                  style={{ width: `${100 - target}%` }}
                />
              </>
            ) : (
              <>
                <div
                  className="absolute left-0 top-0 h-full bg-[#10B981]/40 rounded-l-full transition-all duration-150"
                  style={{ width: `${target}%` }}
                />
                <div
                  className="absolute top-0 right-0 h-full bg-[#EF4444]/40 rounded-r-full transition-all duration-150"
                  style={{ width: `${100 - target}%` }}
                />
              </>
            )}
            {/* Result marker */}
            <AnimatePresence>
              {result !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 w-1.5 h-5 rounded shadow-lg',
                    lastWin ? 'bg-[#10B981]' : 'bg-[#EF4444]',
                  )}
                  style={{ left: `${result}%` }}
                />
              )}
            </AnimatePresence>
          </div>
          <input
            type="range"
            min={1}
            max={98}
            value={target}
            onChange={(e) => setTarget(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
          />
          {/* Thumb indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#8B5CF6] border-2 border-white shadow-lg pointer-events-none transition-all duration-150"
            style={{ left: `${target}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-[#8B949E]">
          <span>0</span>
          <span className="font-mono font-semibold text-sm text-[#E6EDF3]">{target}</span>
          <span>99.99</span>
        </div>

        {/* Over/Under Toggle */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsOver(false)}
            className={cn(
              'flex-1 h-10 sm:h-11 rounded-button font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2',
              !isOver
                ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20'
                : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]',
            )}
          >
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Roll</span> Under {target}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsOver(true)}
            className={cn(
              'flex-1 h-10 sm:h-11 rounded-button font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2',
              isOver
                ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20'
                : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]',
            )}
          >
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Roll</span> Over {target}
          </motion.button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          <div className="bg-[#0D1117] border border-[#30363D] rounded-card p-2 sm:p-3 text-center">
            <p className="text-[9px] sm:text-[10px] text-[#8B949E] mb-0.5 sm:mb-1">Win Chance</p>
            <p className="text-sm sm:text-lg font-bold font-mono text-[#E6EDF3]">
              {winChance.toFixed(2)}%
            </p>
          </div>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-card p-2 sm:p-3 text-center">
            <p className="text-[9px] sm:text-[10px] text-[#8B949E] mb-0.5 sm:mb-1">Multiplier</p>
            <p className="text-sm sm:text-lg font-bold font-mono text-[#8B5CF6]">
              {multiplier.toFixed(4)}x
            </p>
          </div>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-card p-2 sm:p-3 text-center">
            <p className="text-[9px] sm:text-[10px] text-[#8B949E] mb-0.5 sm:mb-1">Profit on Win</p>
            <p className="text-sm sm:text-lg font-bold font-mono text-[#10B981]">
              {formatCurrency(potentialWin - parseFloat(betAmount), currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Bet Controls */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 block">Bet Amount ({currency})</label>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(0.5)}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] text-xs font-medium"
            >
              1/2
            </motion.button>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="flex-1 h-10 bg-[#0D1117] border border-[#30363D] rounded-button px-3 text-sm font-mono text-[#E6EDF3] text-center focus:outline-none focus:border-[#8B5CF6]"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(2)}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] text-xs font-medium"
            >
              2x
            </motion.button>
          </div>
        </div>

        <motion.button
          disabled={!isAuthenticated || isRolling}
          onClick={handleRoll}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'w-full h-12 font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2 text-lg',
            isRolling
              ? 'bg-[#484F58] text-[#8B949E] cursor-not-allowed'
              : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/20',
          )}
        >
          <Dices className={cn('w-5 h-5', isRolling && 'animate-spin')} />
          {isRolling ? 'Rolling...' : isAuthenticated ? 'Roll Dice' : 'Login to Play'}
        </motion.button>
      </div>

      {/* Game History */}
      {history.length > 0 && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-card overflow-hidden">
          <div className="p-4 flex items-center justify-between bg-[#1C2128] border-b border-[#30363D]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#8B949E]" />
              <h3 className="text-sm font-semibold text-[#E6EDF3]">Game History</h3>
            </div>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-[#8B949E] hover:text-[#E6EDF3] flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-[9px] sm:text-[10px] text-[#8B949E] font-medium border-b border-[#30363D]/50">
            <span>Result</span>
            <span>Target</span>
            <span>Multi</span>
            <span>Bet</span>
            <span className="text-right">Payout</span>
          </div>

          {/* Table rows */}
          <div className="max-h-60 overflow-y-auto divide-y divide-[#30363D]/30">
            {history.map((round, i) => (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-5 gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs hover:bg-[#1C2128]/50 transition-colors"
              >
                <span className={cn('font-mono font-semibold', round.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                  {(round.result ?? 0).toFixed(2)}
                </span>
                <span className="text-[#8B949E]">
                  {round.isOver ? '>' : '<'} {round.target}
                </span>
                <span className="font-mono text-[#8B5CF6]">
                  {(round.multiplier ?? 0).toFixed(2)}x
                </span>
                <span className="font-mono text-[#E6EDF3]">
                  {formatCurrency(round.betAmount, currency)}
                </span>
                <span className={cn('font-mono text-right', round.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                  {round.won ? `+${formatCurrency(round.payout - round.betAmount, currency)}` : `-${formatCurrency(round.betAmount, currency)}`}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
