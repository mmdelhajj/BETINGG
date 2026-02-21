'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Circle,
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

type Risk = 'low' | 'medium' | 'high';
type Rows = 8 | 12 | 16;

interface BallPath {
  id: string;
  positions: { x: number; y: number }[];
  bucketIndex: number;
  multiplier: number;
}

interface PlinkoApiResponse {
  roundId: string;
  payout: number;
  multiplier: number;
  result: {
    bucketIndex: number;
    multiplier: number;
    isWin: boolean;
  };
  newBalance?: number;
}

// ---------------------------------------------------------------------------
// Multiplier tables
// ---------------------------------------------------------------------------

const MULTIPLIERS: Record<Risk, Record<Rows, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [8.9, 3.0, 1.4, 1.1, 1.0, 0.5, 0.5, 1.0, 1.1, 1.4, 3.0, 8.9, 8.9],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

function bucketColor(multiplier: number): string {
  if (multiplier >= 10) return 'bg-[#EF4444] text-white';
  if (multiplier >= 3) return 'bg-[#F59E0B] text-black';
  if (multiplier >= 1) return 'bg-[#10B981] text-white';
  return 'bg-[#8B949E]/30 text-[#8B949E]';
}

function bucketBorderColor(multiplier: number): string {
  if (multiplier >= 10) return 'ring-[#EF4444]';
  if (multiplier >= 3) return 'ring-[#F59E0B]';
  if (multiplier >= 1) return 'ring-[#10B981]';
  return 'ring-[#8B949E]';
}

// ---------------------------------------------------------------------------
// Plinko Game Page
// ---------------------------------------------------------------------------

export default function PlinkoGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [risk, setRisk] = useState<Risk>('medium');
  const [rows, setRows] = useState<Rows>(12);
  const [betAmount, setBetAmount] = useState('1.00');
  const [lastResult, setLastResult] = useState<number | null>(null);
  const [lastBucketIdx, setLastBucketIdx] = useState<number | null>(null);
  const [isDropping, setIsDropping] = useState(false);
  const [recentResults, setRecentResults] = useState<number[]>([]);
  const [ballPosition, setBallPosition] = useState<{ x: number; y: number } | null>(null);
  const [animatingBall, setAnimatingBall] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use a ref to guard against double-clicks / stale closures
  const isPlayingRef = useRef(false);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  const multipliers = MULTIPLIERS[risk][rows];

  const handleDrop = useCallback(async () => {
    // Ref-based guard: immune to stale closures
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    setIsDropping(true);
    setLastResult(null);
    setLastBucketIdx(null);
    setAnimatingBall(true);
    setErrorMessage(null);

    let targetBucketIdx: number;
    let targetMultiplier: number;
    // Try backend API first to get the result
    try {
      const response = await post<PlinkoApiResponse>('/casino/games/plinko/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { risk, rows },
      });

      targetMultiplier = response.multiplier || response.result?.multiplier || 0;
      // Update balance in auth store
      if (response.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, response.newBalance, 0);
      }

      // Find bucket index that matches the multiplier from API
      const matchIdx = multipliers.findIndex((m) => m === targetMultiplier);
      if (matchIdx >= 0) {
        // If multiple buckets have same multiplier, pick one randomly for visual variety
        const matchingIndices = multipliers
          .map((m, i) => (m === targetMultiplier ? i : -1))
          .filter((i) => i >= 0);
        targetBucketIdx = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];
      } else {
        // Closest multiplier match fallback
        let closest = 0;
        let closestDiff = Math.abs(multipliers[0] - targetMultiplier);
        for (let i = 1; i < multipliers.length; i++) {
          const diff = Math.abs(multipliers[i] - targetMultiplier);
          if (diff < closestDiff) {
            closestDiff = diff;
            closest = i;
          }
        }
        targetBucketIdx = closest;
        targetMultiplier = multipliers[closest];
      }
    } catch (err: any) {
      const errorCode = err?.errors?.code || err?.message || '';
      if (errorCode === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(err?.message || '')) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage('Failed to place bet. Please try again.');
      }

      setIsDropping(false);
      setAnimatingBall(false);
      isPlayingRef.current = false;
      return;
    }

    // Generate a ball path that ends at the target bucket
    const path: { x: number; y: number }[] = [];
    const bucketWidth = 100 / multipliers.length;
    const targetX = (targetBucketIdx + 0.5) * bucketWidth;
    let xPos = 50; // Start at center
    const yStep = 100 / (rows + 1);

    for (let i = 0; i < rows; i++) {
      // Gradually guide ball toward target bucket with natural randomness
      const progress = (i + 1) / rows;
      const targetAtRow = 50 + (targetX - 50) * progress;
      const drift = (100 / (rows + 2)) * 0.5;

      // Bias direction toward target
      const diff = targetAtRow - xPos;
      const direction = diff > 0 ? 1 : diff < 0 ? -1 : (Math.random() > 0.5 ? 1 : -1);

      // Add some randomness but still trend toward target
      if (i < rows - 2) {
        const randomFactor = Math.random() > 0.35 ? direction : -direction;
        xPos += randomFactor * drift;
      } else {
        // Last couple rows, be more precise
        xPos += direction * drift;
      }

      xPos = Math.max(5, Math.min(95, xPos));
      path.push({ x: xPos, y: (i + 1) * yStep });
    }

    // Snap the final position to the target bucket center
    if (path.length > 0) {
      path[path.length - 1].x = targetX;
    }

    const result = targetMultiplier;
    const bucketIdx = targetBucketIdx;

    // Animate ball through path
    let step = 0;
    const interval = setInterval(() => {
      if (step < path.length) {
        setBallPosition(path[step]);
        step++;
      } else {
        clearInterval(interval);
        setBallPosition(null);
        setAnimatingBall(false);
        setLastResult(result);
        setLastBucketIdx(bucketIdx);
        setRecentResults((prev) => [result, ...prev.slice(0, 14)]);
        setIsDropping(false);
        isPlayingRef.current = false;
      }
    }, 100);
  }, [rows, multipliers, risk, betAmount, currency]);

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(5));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 px-1 sm:px-0 pb-24">
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

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {recentResults.map((res, i) => (
            <motion.div
              key={`${i}-${res}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-bold border border-transparent',
                bucketColor(res),
              )}
            >
              {res}x
            </motion.div>
          ))}
        </div>
      )}

      {/* Plinko Board */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card overflow-hidden">
        <div className="aspect-[4/3] relative">
          {/* Peg grid visualization */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 sm:gap-1 p-4 sm:p-8">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <div key={rowIdx} className="flex gap-1.5 sm:gap-3 justify-center">
                {Array.from({ length: rowIdx + 3 }).map((_, pegIdx) => (
                  <motion.div
                    key={pegIdx}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: (rowIdx * 0.02) + (pegIdx * 0.01) }}
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#8B5CF6]/40"
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Animated Ball */}
          <AnimatePresence>
            {ballPosition && (
              <motion.div
                key="ball"
                className="absolute w-4 h-4 rounded-full bg-[#F59E0B] shadow-lg shadow-[#F59E0B]/50 z-10"
                initial={{ left: '50%', top: '0%', x: '-50%', y: '-50%' }}
                animate={{
                  left: `${ballPosition.x}%`,
                  top: `${ballPosition.y}%`,
                }}
                transition={{ duration: 0.08, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

          {/* Result Display Overlay */}
          <AnimatePresence>
            {lastResult !== null && !isDropping && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 z-20"
              >
                <div className={cn(
                  'text-4xl sm:text-5xl md:text-7xl font-bold font-mono',
                  lastResult >= 3 ? 'text-[#10B981]' : lastResult >= 1 ? 'text-[#F59E0B]' : 'text-[#EF4444]',
                )}>
                  {lastResult}x
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Idle bounce indicator */}
          {!isDropping && lastResult === null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-4 h-4 rounded-full bg-[#F59E0B]/60"
              />
            </div>
          )}
        </div>

        {/* Multiplier Buckets */}
        <div className="flex gap-px sm:gap-0.5 px-1 sm:px-2 pb-1.5 sm:pb-2 overflow-x-auto">
          {multipliers.map((mult, i) => (
            <motion.div
              key={i}
              animate={lastBucketIdx === i ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.3 }}
              className={cn(
                'flex-1 min-w-[18px] py-1 sm:py-1.5 rounded text-center text-[7px] sm:text-[9px] md:text-[10px] font-mono font-bold transition-all duration-200',
                bucketColor(mult),
                lastBucketIdx === i && `ring-2 ${bucketBorderColor(mult)}`,
              )}
            >
              {mult}x
            </motion.div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Row Selector */}
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 block">Rows</label>
          <div className="flex gap-2">
            {([8, 12, 16] as Rows[]).map((r) => (
              <motion.button
                key={r}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRows(r)}
                disabled={isDropping}
                className={cn(
                  'flex-1 h-10 rounded-button font-mono font-semibold text-sm transition-all duration-200',
                  rows === r
                    ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20'
                    : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50',
                )}
              >
                {r}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Risk Selector */}
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 block">Risk Level</label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as Risk[]).map((r) => (
              <motion.button
                key={r}
                whileTap={{ scale: 0.95 }}
                onClick={() => setRisk(r)}
                disabled={isDropping}
                className={cn(
                  'flex-1 h-10 rounded-button font-semibold text-sm capitalize transition-all duration-200',
                  risk === r
                    ? r === 'low'
                      ? 'bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20'
                      : r === 'medium'
                        ? 'bg-[#F59E0B] text-black shadow-lg shadow-[#F59E0B]/20'
                        : 'bg-[#EF4444] text-white shadow-lg shadow-[#EF4444]/20'
                    : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50',
                )}
              >
                {r}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 block">Bet Amount ({currency})</label>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(0.5)}
              disabled={isDropping}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 text-xs font-medium"
            >
              1/2
            </motion.button>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={isDropping}
              className="flex-1 h-10 bg-[#0D1117] border border-[#30363D] rounded-button px-3 text-sm font-mono text-[#E6EDF3] text-center focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(2)}
              disabled={isDropping}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 text-xs font-medium"
            >
              2x
            </motion.button>
          </div>
        </div>

        {/* Drop Button */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={!isAuthenticated || isDropping}
          onClick={handleDrop}
          className={cn(
            'w-full h-12 font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2 text-lg',
            isDropping
              ? 'bg-[#484F58] text-[#8B949E] cursor-not-allowed'
              : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/20',
          )}
        >
          <Circle className={cn('w-5 h-5', isDropping && 'animate-bounce')} />
          {isDropping ? 'Dropping...' : isAuthenticated ? 'Drop Ball' : 'Login to Play'}
        </motion.button>
      </div>
    </div>
  );
}
