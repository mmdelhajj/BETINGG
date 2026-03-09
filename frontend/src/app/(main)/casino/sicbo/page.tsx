'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Trash2, Home, Info, Volume2, VolumeX, Minus, Plus, ChevronDown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SicBoBetType =
  | 'small'
  | 'big'
  | 'specific_triple'
  | 'any_triple'
  | 'specific_double'
  | 'total'
  | 'single'
  | 'two_dice_combo';

interface PlacedBet {
  id: string;
  type: SicBoBetType;
  value?: number | number[];
  label: string;
  amount: number;
}

interface SicBoResponse {
  roundId: string;
  payout: number;
  multiplier: number;
  result: {
    dice: [number, number, number];
    total: number;
    isTriple: boolean;
    bets: Array<{
      type: string;
      value?: number | number[];
      amount: number;
      isWin: boolean;
      payout: number;
      multiplier: number;
    }>;
    totalPayout: number;
  };
  newBalance?: number;
}

interface HistoryEntry {
  dice: [number, number, number];
  total: number;
  isTriple: boolean;
}

// ---------------------------------------------------------------------------
// Total sum payouts
// ---------------------------------------------------------------------------

const TOTAL_SUM_PAYOUTS: Record<number, number> = {
  4: 62, 5: 31, 6: 18, 7: 12, 8: 8, 9: 7, 10: 6,
  11: 6, 12: 6, 13: 8, 14: 12, 15: 18, 16: 31, 17: 62,
};

// Two-dice combos (all unique pairs of different values)
const TWO_DICE_COMBOS: [number, number][] = [
  [1, 2], [1, 3], [1, 4], [1, 5], [1, 6],
  [2, 3], [2, 4], [2, 5], [2, 6],
  [3, 4], [3, 5], [3, 6],
  [4, 5], [4, 6],
  [5, 6],
];

// Chip values per currency
const SICBO_CHIPS: Record<string, number[]> = {
  BTC: [0.0001, 0.001, 0.005, 0.01, 0.05],
  ETH: [0.001, 0.005, 0.01, 0.05, 0.1],
  USDT: [1, 5, 10, 25, 100],
  USDC: [1, 5, 10, 25, 100],
  SOL: [0.01, 0.05, 0.1, 0.5, 1],
  BNB: [0.001, 0.005, 0.01, 0.05, 0.1],
};

// ---------------------------------------------------------------------------
// Dice Face Component (CSS dots)
// ---------------------------------------------------------------------------

function DiceFace({ value, size = 'lg', highlight = false }: { value: number; size?: 'sm' | 'md' | 'lg'; highlight?: boolean }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16 sm:w-20 sm:h-20',
  };
  const dotSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5 sm:w-3 sm:h-3',
  };

  const dotPositions: Record<number, string[]> = {
    1: ['col-start-2 row-start-2'],
    2: ['col-start-3 row-start-1', 'col-start-1 row-start-3'],
    3: ['col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3'],
    4: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    5: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    6: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
  };

  return (
    <div
      className={cn(
        sizeClasses[size],
        'rounded-lg grid grid-cols-3 grid-rows-3 place-items-center p-1.5 sm:p-2 transition-all duration-300',
        highlight
          ? 'bg-[#C8FF00] shadow-lg shadow-[#C8FF00]/30 ring-2 ring-[#C8FF00]'
          : 'bg-white shadow-md',
      )}
    >
      {dotPositions[value]?.map((pos, i) => (
        <div
          key={i}
          className={cn(
            dotSize[size],
            'rounded-full',
            highlight ? 'bg-black' : 'bg-[#1a1a1a]',
            pos,
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sic Bo Game Page
// ---------------------------------------------------------------------------

export default function SicBoGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  const chips = SICBO_CHIPS[currency] || SICBO_CHIPS.USDT;
  const [selectedChip, setSelectedChip] = useState(chips[1]);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [diceResult, setDiceResult] = useState<[number, number, number] | null>(null);
  const [totalResult, setTotalResult] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [winningBetIds, setWinningBetIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<SicBoResponse | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  const isPlayingRef = useRef(false);

  // Reset on currency change
  useEffect(() => {
    const newChips = SICBO_CHIPS[currency] || SICBO_CHIPS.USDT;
    setSelectedChip(newChips[1]);
    setPlacedBets([]);
  }, [currency]);

  const totalBet = useMemo(
    () => placedBets.reduce((acc, b) => acc + b.amount, 0),
    [placedBets],
  );

  const currentBalance = useMemo(() => {
    const { user } = useAuthStore.getState();
    if (!user?.balances) return 0;
    const w = user.balances.find((b: any) => b.currency === currency);
    return w ? w.available : 0;
  }, [currency, winAmount]);

  const addBet = useCallback(
    (type: SicBoBetType, label: string, value?: number | number[]) => {
      if (isRolling) return;
      const bet: PlacedBet = {
        id: `${type}-${JSON.stringify(value)}-${Date.now()}`,
        type,
        value,
        label,
        amount: selectedChip,
      };
      setPlacedBets((prev) => [...prev, bet]);
    },
    [selectedChip, isRolling],
  );

  const clearBets = useCallback(() => {
    if (isRolling) return;
    setPlacedBets([]);
    setDiceResult(null);
    setTotalResult(null);
    setWinAmount(null);
    setWinningBetIds(new Set());
    setLastResponse(null);
  }, [isRolling]);

  // Count bets on a specific area for showing chip count
  const betCountOnArea = useCallback(
    (type: SicBoBetType, value?: number | number[]) => {
      return placedBets.filter(
        (b) => b.type === type && JSON.stringify(b.value) === JSON.stringify(value),
      ).length;
    },
    [placedBets],
  );

  const betTotalOnArea = useCallback(
    (type: SicBoBetType, value?: number | number[]) => {
      return placedBets
        .filter((b) => b.type === type && JSON.stringify(b.value) === JSON.stringify(value))
        .reduce((sum, b) => sum + b.amount, 0);
    },
    [placedBets],
  );

  // Check if this area is a winner after the roll
  const isAreaWinner = useCallback(
    (type: SicBoBetType, value?: number | number[]) => {
      if (!lastResponse?.result?.bets) return false;
      return lastResponse.result.bets.some(
        (b) =>
          b.type === type &&
          JSON.stringify(b.value) === JSON.stringify(value) &&
          b.isWin,
      );
    },
    [lastResponse],
  );

  const roll = useCallback(async () => {
    if (isPlayingRef.current || placedBets.length === 0) return;
    isPlayingRef.current = true;
    setIsRolling(true);
    setWinAmount(null);
    setWinningBetIds(new Set());
    setError(null);
    setLastResponse(null);

    try {
      // Build API payload
      const apiBets = placedBets.map((bet) => ({
        type: bet.type,
        value: bet.value,
        amount: bet.amount,
      }));

      const data = await post<SicBoResponse>('/casino/games/sicbo/play', {
        amount: totalBet,
        currency,
        options: { bets: apiBets },
      });

      setLastResponse(data);

      // Update balance
      if (data.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, data.newBalance, 0);
      }

      // Show dice animation then reveal
      setTimeout(() => {
        const resultDice = data.result?.dice ?? [1, 1, 1];
        const resultTotal = data.result?.total ?? 3;
        const resultBets = data.result?.bets ?? [];
        const resultIsTriple = data.result?.isTriple ?? false;

        setDiceResult(resultDice);
        setTotalResult(resultTotal);
        setWinAmount(data.payout ?? 0);

        // Mark winning bets
        const winIds = new Set<string>();
        resultBets.forEach((b, idx) => {
          if (b.isWin && placedBets[idx]) {
            winIds.add(placedBets[idx].id);
          }
        });
        setWinningBetIds(winIds);

        // Add to history
        setHistory((prev) => [
          { dice: resultDice, total: resultTotal, isTriple: resultIsTriple },
          ...prev.slice(0, 19),
        ]);

        setIsRolling(false);
        isPlayingRef.current = false;
      }, 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to place bet. Please try again.');
      setIsRolling(false);
      isPlayingRef.current = false;
    }
  }, [placedBets, totalBet, currency]);

  // ---------------------------------------------------------------------------
  // Bet Area Button Helper
  // ---------------------------------------------------------------------------

  function BetArea({
    type,
    value,
    label,
    sublabel,
    payoutText,
    className,
    isWide = false,
  }: {
    type: SicBoBetType;
    value?: number | number[];
    label: string;
    sublabel?: string;
    payoutText: string;
    className?: string;
    isWide?: boolean;
  }) {
    const count = betCountOnArea(type, value);
    const areaTotal = betTotalOnArea(type, value);
    const isWinner = isAreaWinner(type, value);
    return (
      <button
        onClick={() => addBet(type, label, value)}
        disabled={isRolling}
        className={cn(
          'relative rounded-lg border text-center transition-all duration-200 disabled:opacity-50',
          'hover:brightness-110 active:scale-[0.98]',
          isWinner && !isRolling
            ? 'ring-2 ring-[#C8FF00] shadow-lg shadow-[#C8FF00]/20 bg-[#C8FF00]/10 border-[#C8FF00]/50'
            : 'border-[#30363D] bg-[#161B22] hover:bg-[#1C2128] hover:border-[#484F58]',
          isWide ? 'px-3 py-2' : 'px-2 py-1.5',
          className,
        )}
      >
        <div className="text-[10px] sm:text-xs font-bold text-[#E6EDF3]">{label}</div>
        {sublabel && <div className="text-[8px] sm:text-[10px] text-[#8B949E]">{sublabel}</div>}
        <div className="text-[8px] sm:text-[10px] text-[#C8FF00] font-mono">{payoutText}</div>
        {count > 0 && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#C8FF00] text-black text-[9px] font-bold flex items-center justify-center shadow">
            {count}
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* CRYPTOBET Header */}
      <div className="bg-[#161B22] py-2 text-center border-b border-[#30363D]">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-3 text-center">
          <span className="text-xs font-semibold text-[#EF4444]">{error}</span>
        </div>
      )}

      {/* History Strip */}
      {history.length > 0 && (
        <div className="px-4 mt-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {history.map((h, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'shrink-0 flex items-center gap-0.5 px-2 py-1 rounded-lg border text-[10px] font-mono font-bold',
                  h.isTriple
                    ? 'bg-[#C8FF00]/10 border-[#C8FF00]/30 text-[#C8FF00]'
                    : h.total >= 11
                      ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                      : 'bg-[#3B82F6]/10 border-[#3B82F6]/30 text-[#3B82F6]',
                )}
              >
                {h.dice.map((d, j) => (
                  <span key={j} className="w-4 h-4 flex items-center justify-center bg-white/10 rounded text-[9px]">
                    {d}
                  </span>
                ))}
                <span className="ml-1">={h.total}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Dice Display Area - Edge to Edge */}
      <div className="bg-[#161B22] border-y border-[#30363D] mt-3 p-6 flex flex-col items-center relative overflow-hidden">
        {/* Three Dice */}
        <div className="flex gap-4 items-center justify-center min-h-[80px]">
          {isRolling ? (
            <>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    rotateX: [0, 360, 720, 1080],
                    rotateY: [0, 180, 360, 540],
                    y: [0, -30, 0, -20, 0],
                  }}
                  transition={{
                    duration: 2.5,
                    ease: 'easeInOut',
                    delay: i * 0.15,
                    repeat: 0,
                  }}
                  className="perspective-500"
                >
                  <DiceFace value={Math.floor(Math.random() * 6) + 1} size="lg" />
                </motion.div>
              ))}
            </>
          ) : diceResult ? (
            <>
              {diceResult.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotateX: 720 }}
                  animate={{ scale: 1, rotateX: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                    delay: i * 0.2,
                  }}
                >
                  <DiceFace value={d} size="lg" highlight={diceResult[0] === diceResult[1] && diceResult[1] === diceResult[2]} />
                </motion.div>
              ))}
            </>
          ) : (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="opacity-30">
                  <DiceFace value={i} size="lg" />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Total */}
        {diceResult && !isRolling && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center"
          >
            <span className="text-3xl font-bold font-mono text-[#E6EDF3]">
              {totalResult}
            </span>
            <span className="ml-2 text-sm text-[#8B949E]">
              {diceResult[0] === diceResult[1] && diceResult[1] === diceResult[2] ? 'TRIPLE!' : totalResult! >= 11 ? 'BIG' : 'SMALL'}
            </span>
          </motion.div>
        )}

        {/* Win display */}
        <AnimatePresence>
          {winAmount !== null && !isRolling && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'mt-3 px-6 py-2 rounded-xl text-center',
                winAmount > 0
                  ? 'bg-[#10B981]/10 border border-[#10B981]/30'
                  : 'bg-[#EF4444]/10 border border-[#EF4444]/30',
              )}
            >
              <p className={cn(
                'text-lg font-bold font-mono',
                winAmount > 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
              )}>
                {winAmount > 0
                  ? `+${formatCurrency(winAmount, currency)}`
                  : 'No win this round'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Area - px-4 */}
      <div className="px-4 mt-3 space-y-3">
        {/* Manual / Auto Toggle */}
        <div className="flex bg-[#161B22] rounded-lg p-1 border border-[#30363D]">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex-1 py-2 rounded-md text-xs font-bold transition-all',
              activeTab === 'manual'
                ? 'bg-[#8B5CF6] text-white shadow-lg'
                : 'text-[#8B949E] hover:text-white',
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={cn(
              'flex-1 py-2 rounded-md text-xs font-bold transition-all',
              activeTab === 'auto'
                ? 'bg-[#8B5CF6] text-white shadow-lg'
                : 'text-[#8B949E] hover:text-white',
            )}
          >
            Auto
          </button>
        </div>

        {/* Chip Selector */}
        <div>
          <label className="text-xs text-[#8B949E] mb-2 block font-medium">Chip Value ({currency})</label>
          <div className="flex gap-2 flex-wrap">
            {chips.map((chip) => (
              <motion.button
                key={chip}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedChip(chip)}
                className={cn(
                  'w-12 h-12 rounded-full text-[10px] font-mono font-bold transition-all duration-200 flex items-center justify-center border-2',
                  selectedChip === chip
                    ? 'bg-[#C8FF00]/20 border-[#C8FF00] text-[#C8FF00] shadow-lg shadow-[#C8FF00]/20 scale-110'
                    : 'bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58]',
                )}
              >
                {chip}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Betting Table */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 space-y-3">
          {/* Big / Small */}
          <div className="grid grid-cols-2 gap-2">
            <BetArea type="small" label="SMALL" sublabel="4-10" payoutText="2x" isWide className="py-3" />
            <BetArea type="big" label="BIG" sublabel="11-17" payoutText="2x" isWide className="py-3" />
          </div>

          {/* Triples */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#8B949E] font-semibold">Triples</div>
            <div className="grid grid-cols-7 gap-1">
              <BetArea type="any_triple" label="ANY" sublabel="Trip" payoutText="30x" />
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <BetArea
                  key={n}
                  type="specific_triple"
                  value={n}
                  label={`${n}-${n}-${n}`}
                  payoutText="180x"
                />
              ))}
            </div>
          </div>

          {/* Doubles */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#8B949E] font-semibold">Doubles</div>
            <div className="grid grid-cols-6 gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <BetArea
                  key={n}
                  type="specific_double"
                  value={n}
                  label={`${n}-${n}`}
                  payoutText="11x"
                />
              ))}
            </div>
          </div>

          {/* Total Sum Bets */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#8B949E] font-semibold">Totals</div>
            <div className="grid grid-cols-7 gap-1">
              {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((n) => (
                <BetArea
                  key={n}
                  type="total"
                  value={n}
                  label={`${n}`}
                  payoutText={`${TOTAL_SUM_PAYOUTS[n]}x`}
                />
              ))}
            </div>
          </div>

          {/* Single Number Bets */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#8B949E] font-semibold">Single Numbers</div>
            <div className="grid grid-cols-6 gap-1">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <BetArea
                  key={n}
                  type="single"
                  value={n}
                  label={`${n}`}
                  sublabel="any die"
                  payoutText="2-4x"
                />
              ))}
            </div>
          </div>

          {/* Two Dice Combos */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#8B949E] font-semibold">Two Dice Combos</div>
            <div className="grid grid-cols-5 gap-1">
              {TWO_DICE_COMBOS.map(([a, b]) => (
                <BetArea
                  key={`${a}-${b}`}
                  type="two_dice_combo"
                  value={[a, b]}
                  label={`${a}-${b}`}
                  payoutText="6x"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Placed bets summary */}
        {placedBets.length > 0 && (
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#8B949E]">
                {placedBets.length} bet{placedBets.length > 1 ? 's' : ''} placed
              </span>
              <span className="text-xs font-mono font-bold text-[#C8FF00]">
                Total: {formatCurrency(totalBet, currency)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {placedBets.slice(-10).map((bet) => (
                <span
                  key={bet.id}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono border',
                    winningBetIds.has(bet.id)
                      ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                      : 'bg-[#1C2128] border-[#30363D] text-[#E6EDF3]',
                  )}
                >
                  {bet.label} ({formatCurrency(bet.amount, currency)})
                </span>
              ))}
              {placedBets.length > 10 && (
                <span className="text-[10px] text-[#8B949E]">+{placedBets.length - 10} more</span>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={clearBets}
            disabled={isRolling || placedBets.length === 0}
            className="h-[52px] px-4 bg-[#2D333B] border border-[#30363D] rounded-xl text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={roll}
            disabled={!isAuthenticated || isRolling || placedBets.length === 0}
            className={cn(
              'flex-1 h-[52px] font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-base',
              isRolling || !isAuthenticated || placedBets.length === 0
                ? 'bg-[#30363D] text-[#484F58] cursor-not-allowed'
                : 'bg-[#C8FF00] text-black hover:bg-[#D4FF33] shadow-lg shadow-[#C8FF00]/20',
            )}
          >
            <RotateCcw className={cn('w-5 h-5', isRolling && 'animate-spin')} />
            {isRolling
              ? 'Rolling...'
              : isAuthenticated
                ? `ROLL (${formatCurrency(totalBet, currency)})`
                : 'LOGIN TO PLAY'}
          </motion.button>
        </div>

        {/* Payout Reference (collapsible) */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowFairness(!showFairness)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs text-[#8B949E] hover:text-white transition-colors"
          >
            <span>Payout Reference</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showFairness && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showFairness && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#30363D] px-4 pb-3 pt-2 grid grid-cols-2 gap-2 text-[10px] text-[#8B949E]">
                  <div><span className="text-[#C8FF00]">Small/Big:</span> 2x</div>
                  <div><span className="text-[#C8FF00]">Any Triple:</span> 30x</div>
                  <div><span className="text-[#C8FF00]">Specific Triple:</span> 180x</div>
                  <div><span className="text-[#C8FF00]">Specific Double:</span> 11x</div>
                  <div><span className="text-[#C8FF00]">Single (1 match):</span> 2x</div>
                  <div><span className="text-[#C8FF00]">Single (2 match):</span> 3x</div>
                  <div><span className="text-[#C8FF00]">Single (3 match):</span> 4x</div>
                  <div><span className="text-[#C8FF00]">Two Dice Combo:</span> 6x</div>
                  <div><span className="text-[#C8FF00]">Total 4/17:</span> 62x</div>
                  <div><span className="text-[#C8FF00]">Total 5/16:</span> 31x</div>
                  <div><span className="text-[#C8FF00]">Total 6/15:</span> 18x</div>
                  <div><span className="text-[#C8FF00]">Total 7/14:</span> 12x</div>
                  <div><span className="text-[#C8FF00]">Total 8/13:</span> 8x</div>
                  <div><span className="text-[#C8FF00]">Total 9/12:</span> 7x/6x</div>
                  <div><span className="text-[#C8FF00]">Total 10/11:</span> 6x</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History (collapsible) */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-white transition-colors"
            >
              <span>History ({history.length})</span>
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
                    {history.map((h, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {h.dice.map((d, j) => (
                            <span key={j} className="w-5 h-5 flex items-center justify-center bg-white/10 rounded text-[10px] font-mono text-white">
                              {d}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white">={h.total}</span>
                          <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded',
                            h.isTriple
                              ? 'bg-[#C8FF00]/10 text-[#C8FF00]'
                              : h.total >= 11
                                ? 'bg-[#EF4444]/10 text-[#EF4444]'
                                : 'bg-[#3B82F6]/10 text-[#3B82F6]',
                          )}>
                            {h.isTriple ? 'TRIPLE' : h.total >= 11 ? 'BIG' : 'SMALL'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E]"><Home className="w-6 h-6" /></Link>
          <button className="text-[#8B949E]"><Info className="w-6 h-6" /></button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E]">
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">{formatCurrency(currentBalance, currency)}</span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
