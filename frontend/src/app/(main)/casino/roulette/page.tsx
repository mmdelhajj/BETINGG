'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
]; // European wheel order

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

type BetType =
  | 'straight'
  | 'red'
  | 'black'
  | 'odd'
  | 'even'
  | '1-18'
  | '19-36'
  | '1st12'
  | '2nd12'
  | '3rd12'
  | 'col1'
  | 'col2'
  | 'col3';

interface PlacedBet {
  id: string;
  type: BetType;
  numbers: number[];
  label: string;
  amount: number;
  payout: number;
}

function getNumberColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

function numberBgClass(n: number): string {
  const color = getNumberColor(n);
  if (color === 'green') return 'bg-[#10B981]';
  if (color === 'red') return 'bg-[#EF4444]';
  return 'bg-[#1C2128]';
}

function calculatePayout(type: BetType): number {
  switch (type) {
    case 'straight': return 36;
    case 'red': case 'black': case 'odd': case 'even': case '1-18': case '19-36': return 2;
    case '1st12': case '2nd12': case '3rd12': case 'col1': case 'col2': case 'col3': return 3;
    default: return 0;
  }
}

function getNumbersForBet(type: BetType, straight?: number): number[] {
  switch (type) {
    case 'straight': return straight !== undefined ? [straight] : [];
    case 'red': return RED_NUMBERS;
    case 'black': return BLACK_NUMBERS;
    case 'odd': return Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => n % 2 === 1);
    case 'even': return Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => n % 2 === 0);
    case '1-18': return Array.from({ length: 18 }, (_, i) => i + 1);
    case '19-36': return Array.from({ length: 18 }, (_, i) => i + 19);
    case '1st12': return Array.from({ length: 12 }, (_, i) => i + 1);
    case '2nd12': return Array.from({ length: 12 }, (_, i) => i + 13);
    case '3rd12': return Array.from({ length: 12 }, (_, i) => i + 25);
    case 'col1': return [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
    case 'col2': return [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
    case 'col3': return [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface RouletteBetPayload {
  type: string;
  numbers?: number[];
  amount: number;
}

interface RouletteResponse {
  roundId: string;
  payout: number;
  multiplier: number;
  result: {
    winningNumber: number;
    number?: number;
    color: string;
    isWin: boolean;
    winningBets: any[];
  };
  newBalance?: number;
}

/** Map internal BetType to API bet type string */
function betTypeToApi(type: BetType): string {
  switch (type) {
    case 'straight': return 'number';
    case '1st12': return 'dozen1';
    case '2nd12': return 'dozen2';
    case '3rd12': return 'dozen3';
    default: return type; // red, black, odd, even, 1-18, 19-36, col1, col2, col3
  }
}

// ---------------------------------------------------------------------------
// Chip values per currency
// ---------------------------------------------------------------------------

const ROULETTE_CHIPS: Record<string, number[]> = {
  BTC: [0.0001, 0.001, 0.005, 0.01, 0.05, 0.1],
  ETH: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  USDT: [1, 5, 10, 25, 50, 100],
  USDC: [1, 5, 10, 25, 50, 100],
  SOL: [0.01, 0.05, 0.1, 0.5, 1, 5],
  BNB: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
};

// ---------------------------------------------------------------------------
// Roulette Game Page
// ---------------------------------------------------------------------------

export default function RouletteGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  const chips = ROULETTE_CHIPS[currency] || ROULETTE_CHIPS.USDT;
  const [chipAmount, setChipAmount] = useState(chips[1]);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [recentResults, setRecentResults] = useState<number[]>([]);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to guard against double-clicks / stale closures
  const isPlayingRef = useRef(false);

  // Reset chip amount when currency changes
  useEffect(() => {
    const newChips = ROULETTE_CHIPS[currency] || ROULETTE_CHIPS.USDT;
    setChipAmount(newChips[1]);
    setPlacedBets([]);
  }, [currency]);

  const totalBet = useMemo(
    () => placedBets.reduce((acc, b) => acc + b.amount, 0),
    [placedBets],
  );

  const addBet = useCallback(
    (type: BetType, label: string, straight?: number) => {
      if (isSpinning) return;
      const numbers = getNumbersForBet(type, straight);
      const payout = calculatePayout(type);
      const bet: PlacedBet = {
        id: `${type}-${straight ?? ''}-${Date.now()}`,
        type,
        numbers,
        label,
        amount: chipAmount,
        payout,
      };
      setPlacedBets((prev) => [...prev, bet]);
    },
    [chipAmount, isSpinning],
  );

  const clearBets = useCallback(() => {
    if (isSpinning) return;
    setPlacedBets([]);
    setResult(null);
    setWinAmount(null);
  }, [isSpinning]);

  const animateWheel = useCallback((resultNumber: number) => {
    const resultIdx = NUMBERS.indexOf(resultNumber);
    const degreesPerSlot = 360 / NUMBERS.length;
    const baseRotations = 5 * 360;
    const targetAngle = baseRotations + (360 - resultIdx * degreesPerSlot);
    setWheelRotation((prev) => prev + targetAngle);
  }, []);

  const spin = useCallback(async () => {
    if (isPlayingRef.current || placedBets.length === 0) return;
    isPlayingRef.current = true;
    setIsSpinning(true);
    setWinAmount(null);
    setError(null);

    let resultNumber: number;
    let totalWin: number;

    try {
      // Build API bet payload
      const apiBets: RouletteBetPayload[] = placedBets.map((bet) => ({
        type: betTypeToApi(bet.type),
        numbers: bet.type === 'straight' ? bet.numbers : undefined,
        amount: bet.amount,
      }));

      const data = await post<RouletteResponse>('/casino/games/roulette/play', {
        amount: totalBet,
        currency,
        options: { bets: apiBets },
      });

      resultNumber = data.result?.winningNumber ?? data.result?.number ?? 0;
      totalWin = data.payout;

      // Update balance in auth store
      if (data.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, data.newBalance, 0);
      }
    } catch {
      setError('Failed to place bet. Please try again.');
      setIsSpinning(false);
      isPlayingRef.current = false;
      return;
    }

    // Animate the wheel to the result
    animateWheel(resultNumber);

    setTimeout(() => {
      setResult(resultNumber);
      setRecentResults((prev) => [resultNumber, ...prev.slice(0, 14)]);
      setWinAmount(totalWin);
      setIsSpinning(false);
      isPlayingRef.current = false;
    }, 4000);
  }, [placedBets, totalBet, animateWheel, currency]);

  // Board layout: 3 rows x 12 columns
  const boardNumbers = Array.from({ length: 36 }, (_, i) => i + 1);

  return (
    <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4 px-1 sm:px-0 pb-24">
      {/* Error Display */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2 text-center">
          <span className="text-xs font-semibold text-[#EF4444]">{error}</span>
        </div>
      )}

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
          {recentResults.map((num, i) => (
            <motion.div
              key={`${i}-${num}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                'shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold text-white',
                numberBgClass(num),
                num === 0 && 'text-white',
              )}
            >
              {num}
            </motion.div>
          ))}
        </div>
      )}

      {/* Wheel + Result */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4 sm:p-6 flex flex-col items-center">
        {/* Spinning Wheel */}
        <div className="relative w-48 h-48 md:w-64 md:h-64 mb-4">
          <motion.div
            className="w-full h-full rounded-full border-4 border-[#30363D] relative overflow-hidden"
            animate={{ rotate: wheelRotation }}
            transition={{
              duration: isSpinning ? 4 : 0,
              ease: [0.2, 0.8, 0.3, 1],
            }}
            style={{
              background: `conic-gradient(${NUMBERS.map((n, i) => {
                const color = getNumberColor(n);
                const colorHex = color === 'red' ? '#EF4444' : color === 'green' ? '#10B981' : '#1C2128';
                const start = (i / NUMBERS.length) * 100;
                const end = ((i + 1) / NUMBERS.length) * 100;
                return `${colorHex} ${start}% ${end}%`;
              }).join(', ')})`,
            }}
          >
            {/* Center circle */}
            <div className="absolute inset-4 rounded-full bg-[#0D1117] border-2 border-[#30363D] flex items-center justify-center">
              <span className="text-3xl font-bold font-mono text-[#E6EDF3]">
                {result !== null ? result : '?'}
              </span>
            </div>
          </motion.div>
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[16px] border-l-transparent border-r-transparent border-t-[#F59E0B]" />
          </div>
        </div>

        {/* Win display */}
        <AnimatePresence>
          {winAmount !== null && !isSpinning && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'px-6 py-3 rounded-card text-center mb-2',
                winAmount > 0
                  ? 'bg-[#10B981]/10 border border-[#10B981]/30'
                  : 'bg-[#EF4444]/10 border border-[#EF4444]/30',
              )}
            >
              <p className={cn(
                'text-lg font-bold',
                winAmount > 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
              )}>
                {winAmount > 0
                  ? `Won ${formatCurrency(winAmount, currency)}!`
                  : 'No win this round'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Betting Board */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-2 sm:p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[340px]">
            {/* Zero */}
            <div className="flex gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
              <button
                onClick={() => addBet('straight', '0', 0)}
                disabled={isSpinning}
                className={cn(
                  'h-8 sm:h-10 w-full rounded text-[10px] sm:text-xs font-mono font-bold text-white transition-all duration-200',
                  'bg-[#10B981] hover:bg-[#10B981]/80 disabled:opacity-50',
                  result === 0 && 'ring-2 ring-[#F59E0B]',
                )}
              >
                0
              </button>
            </div>

            {/* Number grid: 3 rows of 12 */}
            <div className="space-y-0.5 sm:space-y-1 mb-1 sm:mb-2">
              {[2, 1, 0].map((rowOffset) => (
                <div key={rowOffset} className="flex gap-0.5 sm:gap-1">
                  {Array.from({ length: 12 }).map((_, colIdx) => {
                    const num = colIdx * 3 + (3 - rowOffset);
                    return (
                      <button
                        key={num}
                        onClick={() => addBet('straight', `${num}`, num)}
                        disabled={isSpinning}
                        className={cn(
                          'flex-1 h-8 sm:h-10 min-w-[26px] sm:min-w-[32px] rounded text-[10px] sm:text-xs font-mono font-bold text-white transition-all duration-200 disabled:opacity-50',
                          numberBgClass(num),
                          'hover:brightness-125',
                          result === num && 'ring-2 ring-[#F59E0B]',
                          placedBets.some((b) => b.type === 'straight' && b.numbers.includes(num)) && 'ring-2 ring-[#8B5CF6]',
                        )}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Dozens */}
            <div className="flex gap-0.5 sm:gap-1 mb-1 sm:mb-2">
              {[
                { type: '1st12' as BetType, label: '1st 12' },
                { type: '2nd12' as BetType, label: '2nd 12' },
                { type: '3rd12' as BetType, label: '3rd 12' },
              ].map((bet) => (
                <button
                  key={bet.type}
                  onClick={() => addBet(bet.type, bet.label)}
                  disabled={isSpinning}
                  className="flex-1 h-7 sm:h-9 rounded border border-[#30363D] bg-[#1C2128] text-[9px] sm:text-[10px] font-medium text-[#E6EDF3] hover:bg-[#8B5CF6]/10 hover:border-[#8B5CF6]/30 transition-all duration-200 disabled:opacity-50"
                >
                  {bet.label}
                </button>
              ))}
            </div>

            {/* Outside bets */}
            <div className="grid grid-cols-6 gap-0.5 sm:gap-1">
              {[
                { type: '1-18' as BetType, label: '1-18' },
                { type: 'even' as BetType, label: 'Even' },
                { type: 'red' as BetType, label: 'Red', color: 'bg-[#EF4444]' },
                { type: 'black' as BetType, label: 'Black', color: 'bg-[#1C2128]' },
                { type: 'odd' as BetType, label: 'Odd' },
                { type: '19-36' as BetType, label: '19-36' },
              ].map((bet) => (
                <button
                  key={bet.type}
                  onClick={() => addBet(bet.type, bet.label)}
                  disabled={isSpinning}
                  className={cn(
                    'h-7 sm:h-9 rounded border text-[9px] sm:text-[10px] font-medium transition-all duration-200 disabled:opacity-50',
                    bet.color
                      ? `${bet.color} border-[#30363D] text-white hover:brightness-125`
                      : 'border-[#30363D] bg-[#1C2128] text-[#E6EDF3] hover:bg-[#8B5CF6]/10 hover:border-[#8B5CF6]/30',
                  )}
                >
                  {bet.label}
                </button>
              ))}
            </div>

            {/* Column bets */}
            <div className="flex gap-0.5 sm:gap-1 mt-1 sm:mt-2">
              {[
                { type: 'col1' as BetType, label: 'Col 1' },
                { type: 'col2' as BetType, label: 'Col 2' },
                { type: 'col3' as BetType, label: 'Col 3' },
              ].map((bet) => (
                <button
                  key={bet.type}
                  onClick={() => addBet(bet.type, bet.label)}
                  disabled={isSpinning}
                  className="flex-1 h-7 sm:h-8 rounded border border-[#30363D] bg-[#1C2128] text-[9px] sm:text-[10px] font-medium text-[#E6EDF3] hover:bg-[#8B5CF6]/10 hover:border-[#8B5CF6]/30 transition-all duration-200 disabled:opacity-50"
                >
                  {bet.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chip selector + Controls */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Chip selector */}
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 sm:mb-2 block">Chip Value ({currency})</label>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {chips.map((chip) => (
              <motion.button
                key={chip}
                whileTap={{ scale: 0.9 }}
                onClick={() => setChipAmount(chip)}
                className={cn(
                  'px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-mono font-bold transition-all duration-200',
                  chipAmount === chip
                    ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20'
                    : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]',
                )}
              >
                {chip}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Placed bets summary */}
        {placedBets.length > 0 && (
          <div className="bg-[#0D1117] border border-[#30363D] rounded-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#8B949E]">
                {placedBets.length} bet{placedBets.length > 1 ? 's' : ''} placed
              </span>
              <span className="text-xs font-mono font-bold text-[#E6EDF3]">
                Total: {formatCurrency(totalBet, currency)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {placedBets.slice(-8).map((bet) => (
                <span
                  key={bet.id}
                  className="px-2 py-0.5 bg-[#1C2128] border border-[#30363D] rounded text-[10px] text-[#E6EDF3] font-mono"
                >
                  {bet.label} ({formatCurrency(bet.amount, currency)})
                </span>
              ))}
              {placedBets.length > 8 && (
                <span className="text-[10px] text-[#8B949E]">
                  +{placedBets.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={clearBets}
            disabled={isSpinning || placedBets.length === 0}
            className="h-10 sm:h-12 px-3 sm:px-4 bg-[#1C2128] border border-[#30363D] rounded-button text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Clear
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={spin}
            disabled={!isAuthenticated || isSpinning || placedBets.length === 0}
            className={cn(
              'flex-1 h-10 sm:h-12 font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2 text-base sm:text-lg',
              isSpinning
                ? 'bg-[#484F58] text-[#8B949E] cursor-not-allowed'
                : 'bg-[#10B981] hover:bg-[#059669] text-white shadow-lg shadow-[#10B981]/20',
            )}
          >
            <RotateCcw className={cn('w-4 h-4 sm:w-5 sm:h-5', isSpinning && 'animate-spin')} />
            {isSpinning
              ? 'Spinning...'
              : isAuthenticated
                ? 'Spin'
                : 'Login to Play'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
