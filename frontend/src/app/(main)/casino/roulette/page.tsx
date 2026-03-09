'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, X, Undo2, Volume2, VolumeX, Shield, Home, Info, ChevronDown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { post } from '@/lib/api';
import Link from 'next/link';

// =============================================================================
// CONSTANTS
// =============================================================================

const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
  11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
  22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

const CHIP_DENOMINATIONS = [1, 5, 10, 25, 100];

const CHIP_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: '#FFFFFF', border: '#C0C0C0', text: '#1a1a1a' },
  5: { bg: '#EF4444', border: '#B91C1C', text: '#FFFFFF' },
  10: { bg: '#3B82F6', border: '#1D4ED8', text: '#FFFFFF' },
  25: { bg: '#10B981', border: '#047857', text: '#FFFFFF' },
  100: { bg: '#1a1a1a', border: '#4B5563', text: '#FFFFFF' },
};

const CURRENCIES = ['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB'];
const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

type BetType = 'straight' | 'split' | 'street' | 'corner' | 'line' | 'column' | 'dozen' | 'red' | 'black' | 'odd' | 'even' | 'high' | 'low';

interface PlacedBet {
  id: string;
  type: BetType;
  numbers: number[];
  amount: number;
  label: string;
}

interface RouletteResult {
  winningNumber: number;
  color: 'red' | 'black' | 'green';
  bets: Array<{ type: string; numbers: number[]; amount: number; payout: number }>;
  totalPayout: number;
  totalBet: number;
}

interface RouletteResponse {
  roundId: string;
  result: RouletteResult;
  fairness: any;
  newBalance: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function getNumberColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

function getColorHex(color: 'red' | 'black' | 'green'): string {
  if (color === 'red') return '#E03131';
  if (color === 'green') return '#2F9E44';
  return '#1a1a1a';
}

function getNumbersForBet(type: BetType, numbers?: number[]): number[] {
  if (numbers && numbers.length > 0) return numbers;
  switch (type) {
    case 'red': return Array.from(RED_NUMBERS);
    case 'black': return Array.from(BLACK_NUMBERS);
    case 'odd': return Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 1);
    case 'even': return Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0);
    case 'low': return Array.from({ length: 18 }, (_, i) => i + 1);
    case 'high': return Array.from({ length: 18 }, (_, i) => i + 19);
    default: return numbers || [];
  }
}

function getTotalOnCell(bets: PlacedBet[], cellKey: string): number {
  return bets
    .filter(b => betCellKey(b) === cellKey)
    .reduce((sum, b) => sum + b.amount, 0);
}

function betCellKey(bet: PlacedBet): string {
  return `${bet.type}-${bet.numbers.sort((a, b) => a - b).join(',')}`;
}

function cellKey(type: BetType, numbers: number[]): string {
  return `${type}-${[...numbers].sort((a, b) => a - b).join(',')}`;
}

// =============================================================================
// ROULETTE WHEEL SVG
// =============================================================================

const RouletteWheel: React.FC<{
  rotation: number;
  ballRotation: number;
  isSpinning: boolean;
  winningNumber: number | null;
  showBall: boolean;
}> = React.memo(({ rotation, ballRotation, isSpinning, winningNumber, showBall }) => {
  const pocketCount = WHEEL_NUMBERS.length;
  const pocketAngle = 360 / pocketCount;
  const cx = 200;
  const cy = 200;
  const outerR = 190;
  const innerR = 145;
  const numberR = 168;
  const ballTrackR = 130;

  return (
    <div className="relative w-[260px] h-[260px] mx-auto select-none">
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#8B7355] via-[#5C4A32] to-[#3D2E1E] p-[6px] shadow-[0_0_40px_rgba(0,0,0,0.6)]">
        <div className="w-full h-full rounded-full bg-[#2a1f14] p-[3px]">
          <div className="w-full h-full rounded-full overflow-hidden relative">
            <motion.svg
              viewBox="0 0 400 400"
              className="w-full h-full"
              animate={{ rotate: rotation }}
              transition={{
                duration: isSpinning ? 5 : 0,
                ease: [0.15, 0.85, 0.25, 1],
              }}
            >
              <circle cx={cx} cy={cy} r={outerR} fill="#2a1810" stroke="#5C4A32" strokeWidth="1.5" />
              {WHEEL_NUMBERS.map((num, i) => {
                const startAngle = (i * pocketAngle - 90) * (Math.PI / 180);
                const endAngle = ((i + 1) * pocketAngle - 90) * (Math.PI / 180);
                const midAngle = ((i + 0.5) * pocketAngle - 90) * (Math.PI / 180);
                const x1outer = cx + outerR * Math.cos(startAngle);
                const y1outer = cy + outerR * Math.sin(startAngle);
                const x2outer = cx + outerR * Math.cos(endAngle);
                const y2outer = cy + outerR * Math.sin(endAngle);
                const x1inner = cx + innerR * Math.cos(startAngle);
                const y1inner = cy + innerR * Math.sin(startAngle);
                const x2inner = cx + innerR * Math.cos(endAngle);
                const y2inner = cy + innerR * Math.sin(endAngle);
                const color = getNumberColor(num);
                const fillColor = getColorHex(color);
                const textX = cx + numberR * Math.cos(midAngle);
                const textY = cy + numberR * Math.sin(midAngle);
                const textRotation = (i + 0.5) * pocketAngle;
                const isWinner = winningNumber === num && !isSpinning;
                return (
                  <g key={num}>
                    <path
                      d={`M ${x1inner} ${y1inner} L ${x1outer} ${y1outer} A ${outerR} ${outerR} 0 0 1 ${x2outer} ${y2outer} L ${x2inner} ${y2inner} A ${innerR} ${innerR} 0 0 0 ${x1inner} ${y1inner}`}
                      fill={isWinner ? '#FFD700' : fillColor}
                      stroke="#1a1208"
                      strokeWidth="0.8"
                    />
                    <line x1={x1inner} y1={y1inner} x2={x1outer} y2={y1outer} stroke="#8B7355" strokeWidth="0.5" opacity="0.5" />
                    <text
                      x={textX} y={textY}
                      textAnchor="middle" dominantBaseline="central"
                      fill={isWinner ? '#1a1a1a' : '#FFFFFF'}
                      fontSize="10" fontWeight="bold"
                      fontFamily="'JetBrains Mono', monospace"
                      transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                    >
                      {num}
                    </text>
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#8B7355" strokeWidth="2" />
              <circle cx={cx} cy={cy} r={innerR - 4} fill="#1a1208" />
              {WHEEL_NUMBERS.map((_, i) => {
                const angle = (i * pocketAngle - 90) * (Math.PI / 180);
                const x1 = cx + (innerR - 4) * Math.cos(angle);
                const y1 = cy + (innerR - 4) * Math.sin(angle);
                const x2 = cx + 60 * Math.cos(angle);
                const y2 = cy + 60 * Math.sin(angle);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5C4A32" strokeWidth="0.5" opacity="0.4" />;
              })}
              <circle cx={cx} cy={cy} r={58} fill="#2a1810" stroke="#8B7355" strokeWidth="1.5" />
              <circle cx={cx} cy={cy} r={45} fill="url(#centerGrad)" stroke="#5C4A32" strokeWidth="1" />
              <circle cx={cx} cy={cy} r={20} fill="#3D2E1E" stroke="#8B7355" strokeWidth="0.8" />
              <circle cx={cx} cy={cy} r={8} fill="#5C4A32" />
              <defs>
                <radialGradient id="centerGrad" cx="40%" cy="40%">
                  <stop offset="0%" stopColor="#5C4A32" />
                  <stop offset="100%" stopColor="#2a1810" />
                </radialGradient>
              </defs>
            </motion.svg>

            {showBall && (
              <motion.div
                className="absolute"
                style={{ width: '12px', height: '12px', left: '50%', top: '50%', marginLeft: '-6px', marginTop: '-6px' }}
                animate={{ rotate: ballRotation }}
                transition={{ duration: isSpinning ? 5 : 0, ease: [0.15, 0.85, 0.25, 1] }}
              >
                <div
                  className="w-3 h-3 rounded-full bg-gradient-to-br from-white via-gray-200 to-gray-400 shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                  style={{ transform: `translateY(-${ballTrackR * (260 / 400)}px)` }}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#FFD700] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
      </div>
    </div>
  );
});
RouletteWheel.displayName = 'RouletteWheel';

// =============================================================================
// CHIP STACK
// =============================================================================

const ChipStack: React.FC<{ amount: number; small?: boolean }> = ({ amount, small }) => {
  const closestChip = CHIP_DENOMINATIONS.reduce((prev, curr) =>
    Math.abs(curr - amount) < Math.abs(prev - amount) ? curr : prev
  );
  const colors = CHIP_COLORS[closestChip] || CHIP_COLORS[1];
  const size = small ? 'w-5 h-5 text-[7px]' : 'w-7 h-7 text-[9px]';
  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold border-2 shadow-md', size)}
      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
    >
      {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount}
    </div>
  );
};

// =============================================================================
// BETTING CELL
// =============================================================================

const BettingCell: React.FC<{
  label: string | React.ReactNode;
  bgColor?: string;
  textColor?: string;
  onClick: () => void;
  isWinner?: boolean;
  chipAmount?: number;
  disabled?: boolean;
  className?: string;
  isHighlighted?: boolean;
}> = ({ label, bgColor, textColor, onClick, isWinner, chipAmount, disabled, className, isHighlighted }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'relative flex items-center justify-center font-bold transition-all duration-150 border border-[#3d5a3d]/60',
      'hover:brightness-125 hover:z-10 hover:scale-[1.02]',
      'disabled:pointer-events-none disabled:opacity-60',
      'active:scale-95',
      isWinner && 'ring-2 ring-[#C8FF00] ring-offset-1 ring-offset-[#0D1117] z-20 animate-pulse',
      isHighlighted && 'brightness-125',
      className,
    )}
    style={{
      backgroundColor: bgColor || '#1a3a2a',
      color: textColor || '#e0e0e0',
    }}
  >
    {label}
    {chipAmount !== undefined && chipAmount > 0 && (
      <div className="absolute -top-1 -right-1 z-30 pointer-events-none">
        <ChipStack amount={chipAmount} small />
      </div>
    )}
  </button>
);

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function RouletteGamePage() {
  const { isAuthenticated, user } = useAuthStore();

  // Game state
  const [currency, setCurrency] = useState('USDT');
  const [selectedChip, setSelectedChip] = useState(5);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<RouletteResult | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [showBall, setShowBall] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isPlayingRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derived
  const totalBet = useMemo(() => placedBets.reduce((sum, b) => sum + b.amount, 0), [placedBets]);

  const balance = useMemo(() => {
    if (!user?.balances) return 0;
    const b = user.balances.find(bal => bal.currency === currency);
    return b?.available ?? 0;
  }, [user, currency]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ----- BET PLACEMENT -----
  const placeBet = useCallback((type: BetType, numbers: number[], label: string) => {
    if (isSpinning) return;
    const bet: PlacedBet = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      numbers,
      amount: selectedChip,
      label,
    };
    setPlacedBets(prev => [...prev, bet]);
    setWinningNumber(null);
    setLastResult(null);
    setError(null);
  }, [selectedChip, isSpinning]);

  const undoLastBet = useCallback(() => {
    if (isSpinning) return;
    setPlacedBets(prev => prev.slice(0, -1));
  }, [isSpinning]);

  const clearBets = useCallback(() => {
    if (isSpinning) return;
    setPlacedBets([]);
    setWinningNumber(null);
    setLastResult(null);
    setError(null);
  }, [isSpinning]);

  // ----- SPIN -----
  const spin = useCallback(async () => {
    if (isPlayingRef.current || placedBets.length === 0 || !isAuthenticated) return;
    isPlayingRef.current = true;
    setIsSpinning(true);
    setWinningNumber(null);
    setLastResult(null);
    setError(null);
    setShowBall(true);

    try {
      const apiBets = placedBets.map(bet => ({
        type: bet.type,
        numbers: bet.numbers,
        amount: bet.amount,
      }));

      const data = await post<RouletteResponse>('/casino/games/roulette/play', {
        amount: totalBet,
        currency,
        options: { bets: apiBets },
      });

      const resultNum = data.result.winningNumber;
      const resultIdx = WHEEL_NUMBERS.indexOf(resultNum);
      const pocketAngle = 360 / WHEEL_NUMBERS.length;

      const baseSpins = 6 * 360;
      const targetAngle = baseSpins + (360 - resultIdx * pocketAngle);
      setWheelRotation(prev => prev + targetAngle);

      const ballSpins = -8 * 360;
      const ballTarget = ballSpins + (resultIdx * pocketAngle);
      setBallRotation(prev => prev + ballTarget);

      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }

      setTimeout(() => {
        setWinningNumber(resultNum);
        setLastResult(data.result);
        setHistory(prev => [resultNum, ...prev.slice(0, 19)]);
        setIsSpinning(false);
        isPlayingRef.current = false;
      }, 5200);

    } catch (err: any) {
      setError(err?.message || 'Failed to place bet. Please try again.');
      setIsSpinning(false);
      setShowBall(false);
      isPlayingRef.current = false;
    }
  }, [placedBets, totalBet, currency, isAuthenticated]);

  // ----- TABLE LAYOUT -----
  const tableRows = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  ];

  const isNumberWinner = (n: number) => winningNumber === n && !isSpinning;
  const isBetOnNumber = (n: number) => placedBets.some(b => b.type === 'straight' && b.numbers.includes(n));

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col pb-20">

      {/* ================================================================= */}
      {/* HEADER - CRYPTOBET centered                                       */}
      {/* ================================================================= */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-base tracking-wider">
          CRYPTO<span className="text-[#8B5CF6]">BET</span>
        </span>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 mt-2"
          >
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2 text-center">
              <span className="text-xs text-[#EF4444]">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================= */}
      {/* WHEEL - edge-to-edge bg, centered ~260px                          */}
      {/* ================================================================= */}
      <div className="py-4 flex flex-col items-center">
        <RouletteWheel
          rotation={wheelRotation}
          ballRotation={ballRotation}
          isSpinning={isSpinning}
          winningNumber={winningNumber}
          showBall={showBall}
        />

        {/* Winning number display */}
        <AnimatePresence>
          {winningNumber !== null && !isSpinning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="mt-3 flex flex-col items-center gap-1"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-mono font-bold text-white border-4 shadow-lg"
                style={{
                  backgroundColor: getColorHex(getNumberColor(winningNumber)),
                  borderColor: '#C8FF00',
                  boxShadow: `0 0 20px ${getColorHex(getNumberColor(winningNumber))}80`,
                }}
              >
                {winningNumber}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Win/Loss banner */}
        <AnimatePresence>
          {lastResult && !isSpinning && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-center w-full"
            >
              {lastResult.totalPayout > 0 ? (
                <motion.p
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [0.8, 1.15, 1] }}
                  className="text-xl font-bold text-[#10B981] font-mono"
                >
                  +{formatCurrency(lastResult.totalPayout, currency)}
                </motion.p>
              ) : (
                <p className="text-sm font-bold text-[#EF4444]">No win this round</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================= */}
      {/* RECENT RESULTS - colored number dots                               */}
      {/* ================================================================= */}
      {history.length > 0 && (
        <div className="px-4 mb-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {history.map((num, i) => {
              const color = getNumberColor(num);
              const bgMap = { red: '#E03131', black: '#1a1a1a', green: '#2F9E44' };
              const borderMap = { red: '#991B1B', black: '#4B5563', green: '#166534' };
              return (
                <motion.div
                  key={`${i}-${num}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.03, type: 'spring', stiffness: 400, damping: 20 }}
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono font-bold text-white border-2"
                  style={{ backgroundColor: bgMap[color], borderColor: borderMap[color] }}
                >
                  {num}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CHIP SELECTOR - small circles, selected has lime ring              */}
      {/* ================================================================= */}
      <div className="px-4 mb-3">
        <div className="flex items-center justify-center gap-3">
          {CHIP_DENOMINATIONS.map(chip => {
            const colors = CHIP_COLORS[chip];
            const isActive = selectedChip === chip;
            return (
              <motion.button
                key={chip}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedChip(chip)}
                className={cn(
                  'rounded-full transition-all duration-150',
                  isActive ? 'ring-2 ring-[#C8FF00] ring-offset-2 ring-offset-[#0D1117] scale-110' : '',
                )}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-[3px] shadow-lg"
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: isActive ? '#C8FF00' : colors.border,
                    color: colors.text,
                  }}
                >
                  {chip}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* BETTING BOARD - compact mobile                                     */}
      {/* ================================================================= */}
      <div className="px-4 mb-3">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-2 overflow-x-auto scrollbar-hide">
          <div className="min-w-[340px]">
            <div className="rounded-lg p-2 border border-[#3d5a3d]/40" style={{ backgroundColor: '#1a3a2a' }}>
              {/* Zero + Numbers + Columns */}
              <div className="flex gap-0">
                <div className="flex-shrink-0 w-[32px] mr-[1px]">
                  <BettingCell
                    label={<span className="text-sm font-mono">0</span>}
                    bgColor="#2F9E44"
                    textColor="#FFFFFF"
                    onClick={() => placeBet('straight', [0], '0')}
                    isWinner={isNumberWinner(0)}
                    chipAmount={getTotalOnCell(placedBets, cellKey('straight', [0]))}
                    disabled={isSpinning}
                    className="w-full h-full rounded-l-md text-center"
                    isHighlighted={isBetOnNumber(0)}
                  />
                </div>

                <div className="flex-1 flex flex-col gap-[1px]">
                  {tableRows.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex gap-[1px]">
                      {row.map(num => {
                        const color = getNumberColor(num);
                        return (
                          <BettingCell
                            key={num}
                            label={<span className="text-[10px] font-mono font-bold">{num}</span>}
                            bgColor={getColorHex(color)}
                            textColor="#FFFFFF"
                            onClick={() => placeBet('straight', [num], `${num}`)}
                            isWinner={isNumberWinner(num)}
                            chipAmount={getTotalOnCell(placedBets, cellKey('straight', [num]))}
                            disabled={isSpinning}
                            className="flex-1 h-[32px] min-w-[24px] rounded-sm"
                            isHighlighted={isBetOnNumber(num)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Column bets */}
                <div className="flex-shrink-0 w-[32px] ml-[1px] flex flex-col gap-[1px]">
                  {[
                    { nums: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], label: '2:1' },
                    { nums: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], label: '2:1' },
                    { nums: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34], label: '2:1' },
                  ].map(({ nums, label }, idx) => (
                    <BettingCell
                      key={idx}
                      label={<span className="text-[8px] font-bold">{label}</span>}
                      bgColor="#1a3a2a"
                      textColor="#d4c89a"
                      onClick={() => placeBet('column', nums, `Col ${idx + 1}`)}
                      chipAmount={getTotalOnCell(placedBets, cellKey('column', nums))}
                      disabled={isSpinning}
                      className="flex-1 rounded-sm"
                    />
                  ))}
                </div>
              </div>

              {/* Dozens */}
              <div className="flex gap-[1px] mt-[1px]" style={{ marginLeft: '33px', marginRight: '33px' }}>
                {[
                  { nums: Array.from({ length: 12 }, (_, i) => i + 1), label: '1st 12' },
                  { nums: Array.from({ length: 12 }, (_, i) => i + 13), label: '2nd 12' },
                  { nums: Array.from({ length: 12 }, (_, i) => i + 25), label: '3rd 12' },
                ].map(({ nums, label }) => (
                  <BettingCell
                    key={label}
                    label={<span className="text-[9px] font-bold">{label}</span>}
                    bgColor="#1a3a2a"
                    textColor="#d4c89a"
                    onClick={() => placeBet('dozen', nums, label)}
                    chipAmount={getTotalOnCell(placedBets, cellKey('dozen', nums))}
                    disabled={isSpinning}
                    className="flex-1 h-[28px] rounded-sm"
                  />
                ))}
              </div>

              {/* Outside bets */}
              <div className="flex gap-[1px] mt-[1px]" style={{ marginLeft: '33px', marginRight: '33px' }}>
                <BettingCell
                  label={<span className="text-[8px] font-bold">1-18</span>}
                  bgColor="#1a3a2a" textColor="#d4c89a"
                  onClick={() => placeBet('low', getNumbersForBet('low'), '1-18')}
                  chipAmount={getTotalOnCell(placedBets, cellKey('low', getNumbersForBet('low')))}
                  disabled={isSpinning} className="flex-1 h-[28px] rounded-sm"
                />
                <BettingCell
                  label={<span className="text-[8px] font-bold">EVEN</span>}
                  bgColor="#1a3a2a" textColor="#d4c89a"
                  onClick={() => placeBet('even', getNumbersForBet('even'), 'Even')}
                  chipAmount={getTotalOnCell(placedBets, cellKey('even', getNumbersForBet('even')))}
                  disabled={isSpinning} className="flex-1 h-[28px] rounded-sm"
                />
                <BettingCell
                  label={<span className="w-3 h-3 rounded-full bg-[#E03131] inline-block" />}
                  bgColor="#E03131" textColor="#FFFFFF"
                  onClick={() => placeBet('red', getNumbersForBet('red'), 'Red')}
                  chipAmount={getTotalOnCell(placedBets, cellKey('red', getNumbersForBet('red')))}
                  disabled={isSpinning} className="flex-1 h-[28px] rounded-sm"
                />
                <BettingCell
                  label={<span className="w-3 h-3 rounded-full bg-[#1a1a1a] inline-block border border-gray-600" />}
                  bgColor="#1a1a1a" textColor="#FFFFFF"
                  onClick={() => placeBet('black', getNumbersForBet('black'), 'Black')}
                  chipAmount={getTotalOnCell(placedBets, cellKey('black', getNumbersForBet('black')))}
                  disabled={isSpinning} className="flex-1 h-[28px] rounded-sm"
                />
                <BettingCell
                  label={<span className="text-[8px] font-bold">ODD</span>}
                  bgColor="#1a3a2a" textColor="#d4c89a"
                  onClick={() => placeBet('odd', getNumbersForBet('odd'), 'Odd')}
                  chipAmount={getTotalOnCell(placedBets, cellKey('odd', getNumbersForBet('odd')))}
                  disabled={isSpinning} className="flex-1 h-[28px] rounded-sm"
                />
                <BettingCell
                  label={<span className="text-[8px] font-bold">19-36</span>}
                  bgColor="#1a3a2a" textColor="#d4c89a"
                  onClick={() => placeBet('high', getNumbersForBet('high'), '19-36')}
                  chipAmount={getTotalOnCell(placedBets, cellKey('high', getNumbersForBet('high')))}
                  disabled={isSpinning} className="flex-1 h-[28px] rounded-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* BET AMOUNT CONTROL                                                 */}
      {/* ================================================================= */}
      <div className="px-4 mb-3 space-y-3">
        {/* Bet Amount Label */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                className="flex items-center gap-1 text-sm font-mono text-white pr-2"
              >
                {currency}
                <ChevronDown className={cn('w-3 h-3 text-gray-500 transition-transform', showCurrencyDropdown && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showCurrencyDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full left-0 mt-1 bg-[#161B22] border border-[#30363D] rounded-lg shadow-xl z-50 overflow-hidden min-w-[80px]"
                  >
                    {CURRENCIES.map(c => (
                      <button
                        key={c}
                        onClick={() => { setCurrency(c); setShowCurrencyDropdown(false); }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm font-mono hover:bg-[#1C2128] transition-colors',
                          c === currency ? 'text-[#C8FF00]' : 'text-gray-300',
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="flex-1 text-center text-sm font-mono text-white">
              {formatCurrency(totalBet, currency)}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={undoLastBet}
                disabled={isSpinning || placedBets.length === 0}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D444D] transition-colors disabled:opacity-30"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={clearBets}
                disabled={isSpinning || placedBets.length === 0}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#EF4444] hover:bg-[#3D444D] transition-colors disabled:opacity-30"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {BET_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setSelectedChip(parseFloat(preset))}
              className={cn(
                'bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors',
                selectedChip === parseFloat(preset) && 'border-[#C8FF00] text-[#C8FF00]',
              )}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* SPIN button - lime CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={spin}
          disabled={!isAuthenticated || isSpinning || placedBets.length === 0}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all',
            isSpinning
              ? 'bg-[#2D333B] text-gray-500 cursor-not-allowed'
              : placedBets.length === 0
                ? 'bg-[#2D333B] text-gray-600 cursor-not-allowed'
                : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00] shadow-lg shadow-[#C8FF00]/10',
          )}
        >
          <RotateCcw className={cn('w-4 h-4', isSpinning && 'animate-spin')} />
          {isSpinning ? 'Spinning...' : !isAuthenticated ? 'Login to Play' : 'SPIN'}
        </motion.button>
      </div>

      {/* ================================================================= */}
      {/* PAYOUT TABLE compact                                               */}
      {/* ================================================================= */}
      <div className="px-4 mb-3">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
          <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mb-2">Payouts</p>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {[
              { name: 'Straight', payout: '35:1' },
              { name: 'Split', payout: '17:1' },
              { name: 'Street', payout: '11:1' },
              { name: 'Corner', payout: '8:1' },
              { name: 'Line', payout: '5:1' },
              { name: 'Column/Dozen', payout: '2:1' },
              { name: 'Red/Black', payout: '1:1' },
              { name: 'Odd/Even', payout: '1:1' },
            ].map(({ name, payout }) => (
              <div key={name} className="flex items-center justify-between px-2 py-1.5 bg-[#0D1117] rounded border border-[#30363D]/50">
                <span className="text-gray-500">{name}</span>
                <span className="font-mono font-bold text-gray-300">{payout}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* FIXED BOTTOM BAR                                                   */}
      {/* ================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Link href="/casino" className="text-[#8B949E] hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <button className="text-[#8B949E] hover:text-white transition-colors">
            <Info className="w-6 h-6" />
          </button>
          <button onClick={() => setIsMuted(!isMuted)} className="text-[#8B949E] hover:text-white transition-colors">
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-white">
            {formatCurrency(balance, currency)}
            <span className="text-gray-500 ml-1 text-xs">{currency}</span>
          </span>
        </div>

        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
