'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  RotateCcw,
  ShieldCheck,
  History,
  Volume2,
  VolumeX,
  Trash2,
  Plus,
  Minus,
  Trophy,
  AlertTriangle,
  Info,
  Home,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { post } from '@/lib/api';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CrapsBetType =
  | 'pass'
  | 'dontPass'
  | 'field'
  | 'any7'
  | 'hardways'
  | 'come'
  | 'dontCome'
  | 'place6'
  | 'place8'
  | 'yo11'
  | 'anyCraps'
  | 'craps2'
  | 'craps12'
  | 'hard4'
  | 'hard6'
  | 'hard8'
  | 'hard10';

type GamePhase = 'idle' | 'rolling' | 'comeOut' | 'point' | 'resolved';

interface PlacedBet {
  id: string;
  type: CrapsBetType;
  amount: number;
}

interface CrapsResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    dice: [number, number];
    total: number;
    phase: 'comeOut' | 'point';
    point: number | null;
    isNatural: boolean;
    isCraps: boolean;
    isPointMade: boolean;
    isSevenOut: boolean;
    outcome: 'win' | 'loss' | 'push' | 'continue';
    betResults: Array<{
      type: string;
      amount: number;
      won: boolean;
      payout: number;
      multiplier: number;
    }>;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface HistoryEntry {
  id: string;
  dice: [number, number];
  total: number;
  phase: string;
  outcome: string;
  profit: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BET_TYPES: Record<
  CrapsBetType,
  { label: string; payout: string; description: string; category: string; color: string }
> = {
  pass: { label: 'PASS LINE', payout: '1:1', description: '7/11 wins on come-out, point made wins', category: 'main', color: '#10B981' },
  dontPass: { label: "DON'T PASS", payout: '1:1', description: '2/3 wins on come-out, 7 before point wins', category: 'main', color: '#EF4444' },
  come: { label: 'COME', payout: '1:1', description: 'Like pass line after come-out', category: 'main', color: '#10B981' },
  dontCome: { label: "DON'T COME", payout: '1:1', description: "Like don't pass after come-out", category: 'main', color: '#EF4444' },
  field: { label: 'FIELD', payout: '1:1 / 2:1', description: '2,3,4,9,10,11,12 wins. 2/12 pay 2:1', category: 'single', color: '#F59E0B' },
  any7: { label: 'ANY 7', payout: '4:1', description: 'Next roll is 7', category: 'single', color: '#8B5CF6' },
  yo11: { label: 'YO-ELEVEN', payout: '15:1', description: 'Next roll is 11', category: 'single', color: '#EC4899' },
  anyCraps: { label: 'ANY CRAPS', payout: '7:1', description: 'Next roll is 2, 3, or 12', category: 'single', color: '#F97316' },
  craps2: { label: 'SNAKE EYES', payout: '30:1', description: 'Next roll is 2', category: 'prop', color: '#DC2626' },
  craps12: { label: 'BOXCARS', payout: '30:1', description: 'Next roll is 12', category: 'prop', color: '#DC2626' },
  place6: { label: 'PLACE 6', payout: '7:6', description: '6 before 7', category: 'place', color: '#06B6D4' },
  place8: { label: 'PLACE 8', payout: '7:6', description: '8 before 7', category: 'place', color: '#06B6D4' },
  hard4: { label: 'HARD 4', payout: '7:1', description: '2+2 before 7 or easy 4', category: 'hardway', color: '#A855F7' },
  hard6: { label: 'HARD 6', payout: '9:1', description: '3+3 before 7 or easy 6', category: 'hardway', color: '#A855F7' },
  hard8: { label: 'HARD 8', payout: '9:1', description: '4+4 before 7 or easy 8', category: 'hardway', color: '#A855F7' },
  hard10: { label: 'HARD 10', payout: '7:1', description: '5+5 before 7 or easy 10', category: 'hardway', color: '#A855F7' },
  hardways: { label: 'HARDWAYS', payout: 'Various', description: 'All hardway bets combined', category: 'hardway', color: '#A855F7' },
};

const CHIP_VALUES = [0.5, 1, 5, 10, 25, 100];
const BET_PRESETS = [0.01, 0.1, 1, 10, 100];

// ---------------------------------------------------------------------------
// Dice Face SVG
// ---------------------------------------------------------------------------

function DiceFace({
  value,
  size = 80,
  rolling = false,
  color = '#ffffff',
}: {
  value: number;
  size?: number;
  rolling?: boolean;
  color?: string;
}) {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };

  const dots = dotPositions[value] || dotPositions[1];
  const r = size * 0.08;

  return (
    <motion.div
      className="relative"
      animate={
        rolling
          ? {
              rotateX: [0, 360, 720],
              rotateY: [0, 180, 360],
              rotateZ: [0, 90, 180],
            }
          : { rotateX: 0, rotateY: 0, rotateZ: 0 }
      }
      transition={
        rolling
          ? { duration: 0.8, ease: 'easeOut' }
          : { duration: 0.4, type: 'spring' }
      }
      style={{ perspective: 600 }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <linearGradient id={`diceGrad-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2D333B" />
            <stop offset="100%" stopColor="#1C2128" />
          </linearGradient>
          <filter id="diceShadow">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect
          x="5"
          y="5"
          width="90"
          height="90"
          rx="12"
          ry="12"
          fill={`url(#diceGrad-${value})`}
          filter="url(#diceShadow)"
          stroke="#30363D"
          strokeWidth="1"
        />
        <rect
          x="8"
          y="8"
          width="84"
          height="84"
          rx="10"
          ry="10"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity="0.95" />
        ))}
      </svg>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CrapsPage() {
  // Auth
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [dice, setDice] = useState<[number, number]>([1, 1]);
  const [diceTotal, setDiceTotal] = useState(2);
  const [point, setPoint] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>('USDT');
  const [chipValue, setChipValue] = useState(1);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<CrapsResponse['result'] | null>(null);
  const [profit, setProfit] = useState(0);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [fairness, setFairness] = useState<CrapsResponse['fairness'] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<'win' | 'loss' | 'push' | null>(null);
  const [animatingResults, setAnimatingResults] = useState(false);
  const [manualMode, setManualMode] = useState(true);

  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Balance
  const balance = useMemo(() => {
    if (!user?.balances) return 0;
    const b = user.balances.find((b) => b.currency === currency);
    return b?.available || 0;
  }, [user, currency]);

  // Total bet amount
  const totalBet = useMemo(() => placedBets.reduce((sum, b) => sum + b.amount, 0), [placedBets]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Place a bet
  // -----------------------------------------------------------------------
  const placeBet = useCallback(
    (type: CrapsBetType) => {
      if (isRolling || animatingResults) return;
      if (chipValue > balance - totalBet) {
        setError('Insufficient balance');
        return;
      }

      setError(null);

      setPlacedBets((prev) => {
        const existing = prev.find((b) => b.type === type);
        if (existing) {
          return prev.map((b) =>
            b.type === type ? { ...b, amount: b.amount + chipValue } : b,
          );
        }
        return [...prev, { id: `${type}-${Date.now()}`, type, amount: chipValue }];
      });
    },
    [chipValue, balance, totalBet, isRolling, animatingResults],
  );

  // Remove a bet
  const removeBet = useCallback(
    (type: CrapsBetType) => {
      if (isRolling || animatingResults) return;
      setPlacedBets((prev) => prev.filter((b) => b.type !== type));
    },
    [isRolling, animatingResults],
  );

  // Clear all bets
  const clearBets = useCallback(() => {
    if (isRolling || animatingResults) return;
    setPlacedBets([]);
    setError(null);
  }, [isRolling, animatingResults]);

  // -----------------------------------------------------------------------
  // Roll the dice
  // -----------------------------------------------------------------------
  const rollDice = useCallback(async () => {
    if (isRolling || animatingResults) return;
    if (placedBets.length === 0) {
      setError('Place at least one bet');
      return;
    }
    if (!isAuthenticated) {
      setError('Please login to play');
      return;
    }

    setIsRolling(true);
    setError(null);
    setLastOutcome(null);

    const bets = placedBets.map((b) => ({
      type: b.type,
      amount: b.amount,
    }));

    try {
      const data = await post<CrapsResponse>('/casino/games/craps/play', {
        amount: totalBet,
        currency,
        options: {
          betType: placedBets.length === 1 ? placedBets[0].type : 'multi',
          bets,
          point: point,
        },
      });

      setFairness(data.fairness);
      setRoundId(data.roundId);

      const finalDice = data.result?.dice ?? [1, 1] as [number, number];
      let rollCount = 0;
      const maxRolls = 12;

      const animateRoll = () => {
        if (rollCount < maxRolls) {
          setDice([
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
          ] as [number, number]);
          rollCount++;
          rollTimeoutRef.current = setTimeout(animateRoll, 80 + rollCount * 10);
        } else {
          setDice(finalDice);
          setDiceTotal(data.result?.total ?? 0);
          setIsRolling(false);
          setAnimatingResults(true);

          setTimeout(() => {
            processResult(data);
            setAnimatingResults(false);
          }, 600);
        }
      };

      animateRoll();
    } catch (err: unknown) {
      setIsRolling(false);
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Roll failed';
      setError(msg);
    }
  }, [isRolling, animatingResults, placedBets, isAuthenticated, totalBet, currency, point]);

  // -----------------------------------------------------------------------
  // Process result
  // -----------------------------------------------------------------------
  const processResult = useCallback(
    (data: CrapsResponse) => {
      const result = data.result;
      if (!result) return;
      setLastResult(result);
      setProfit(data.profit ?? 0);

      if (result.outcome === 'continue') {
        setPoint(result.point);
        setPhase('point');
      } else {
        setPoint(null);
        setPhase('resolved');
        setLastOutcome(data.profit > 0 ? 'win' : data.profit < 0 ? 'loss' : 'push');
        setPlacedBets([]);
      }

      setHistory((prev) => [
        {
          id: data.roundId,
          dice: result.dice,
          total: result.total,
          phase: result.phase,
          outcome: result.outcome,
          profit: data.profit,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 29),
      ]);

      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }
    },
    [currency],
  );

  // New game
  const newGame = useCallback(() => {
    setPhase('idle');
    setPoint(null);
    setLastResult(null);
    setLastOutcome(null);
    setProfit(0);
    setError(null);
    setPlacedBets([]);
  }, []);

  // -----------------------------------------------------------------------
  // Bet zone renderer
  // -----------------------------------------------------------------------
  const renderBetZone = (
    type: CrapsBetType,
    size: 'large' | 'medium' | 'small' = 'medium',
  ) => {
    const info = BET_TYPES[type];
    if (!info) return null;
    const placed = placedBets.find((b) => b.type === type);
    const betResult = lastResult?.betResults?.find((r) => r.type === type);

    return (
      <motion.button
        key={type}
        onClick={() => placeBet(type)}
        onContextMenu={(e) => {
          e.preventDefault();
          removeBet(type);
        }}
        disabled={isRolling || animatingResults}
        className={cn(
          'relative rounded-xl border transition-all overflow-hidden',
          'flex flex-col items-center justify-center text-center',
          size === 'large' && 'p-3',
          size === 'medium' && 'p-2',
          size === 'small' && 'p-1.5',
          placed
            ? 'border-[#C8FF00]/60 bg-[#C8FF00]/5'
            : 'border-[#30363D] bg-[#161B22] hover:border-[#484F58]',
          betResult && betResult.won && 'border-[#10B981]/60 bg-[#10B981]/10',
          betResult && !betResult.won && 'border-[#EF4444]/40 bg-[#EF4444]/5',
          'disabled:cursor-default',
        )}
        whileHover={!isRolling ? { scale: 1.02 } : {}}
        whileTap={!isRolling ? { scale: 0.98 } : {}}
      >
        <span
          className={cn(
            'font-bold uppercase',
            size === 'large' && 'text-xs',
            size === 'medium' && 'text-[10px]',
            size === 'small' && 'text-[9px]',
          )}
          style={{ color: info.color }}
        >
          {info.label}
        </span>
        <span
          className={cn(
            'font-mono text-[#8B949E]',
            size === 'large' && 'text-[10px]',
            size === 'medium' && 'text-[9px]',
            size === 'small' && 'text-[8px]',
          )}
        >
          {info.payout}
        </span>

        {/* Chip indicator */}
        {placed && (
          <motion.div
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C8FF00] text-black text-[8px] font-bold flex items-center justify-center shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            {placed.amount >= 1000
              ? `${(placed.amount / 1000).toFixed(0)}k`
              : placed.amount}
          </motion.div>
        )}

        {/* Win/loss indicator */}
        <AnimatePresence>
          {betResult && (
            <motion.div
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-xl',
                betResult.won ? 'bg-[#10B981]/30' : 'bg-[#EF4444]/20',
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className={cn('text-sm font-bold', betResult.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                {betResult.won ? `+${(betResult.payout ?? 0).toFixed(2)}` : '-'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-sm font-bold tracking-widest text-white">CRYPTOBET</span>
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {lastOutcome && phase === 'resolved' && (
          <motion.div
            className={cn(
              'mx-4 mt-3 rounded-xl py-3 px-4 text-center font-bold',
              lastOutcome === 'win'
                ? 'bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981]'
                : lastOutcome === 'loss'
                  ? 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]'
                  : 'bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]',
            )}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {lastOutcome === 'win' && (
              <span className="flex items-center justify-center gap-2 text-sm">
                <Trophy className="w-4 h-4" />
                You won! +{formatCurrency(profit, currency)}
              </span>
            )}
            {lastOutcome === 'loss' && (
              <span className="text-sm">You lost {formatCurrency(Math.abs(profit), currency)}</span>
            )}
            {lastOutcome === 'push' && <span className="text-sm">Push! Bet returned.</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dice display area -- edge-to-edge */}
      <div className="bg-[#161B22] border-b border-[#30363D] p-6 mt-0">
        {/* Point indicator */}
        {point && (
          <div className="flex justify-center mb-3">
            <div className="bg-[#C8FF00]/10 border border-[#C8FF00]/30 px-3 py-1 rounded-full">
              <span className="text-xs text-[#C8FF00] font-bold">POINT: {point}</span>
            </div>
          </div>
        )}

        {/* Dice */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <DiceFace value={dice[0]} size={80} rolling={isRolling} />
          <DiceFace value={dice[1]} size={80} rolling={isRolling} />
        </div>

        {/* Total */}
        <div className="text-center mb-3">
          <motion.div
            key={diceTotal}
            className={cn(
              'inline-block text-4xl font-mono font-bold',
              lastOutcome === 'win' && 'text-[#10B981]',
              lastOutcome === 'loss' && 'text-[#EF4444]',
              !lastOutcome && 'text-[#E6EDF3]',
            )}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {isRolling ? '?' : diceTotal}
          </motion.div>
          {lastResult && !isRolling && (
            <div className="text-xs text-[#8B949E] mt-1">
              {lastResult.isNatural && 'Natural!'}
              {lastResult.isCraps && 'Craps!'}
              {lastResult.isPointMade && 'Point made!'}
              {lastResult.isSevenOut && 'Seven out!'}
              {lastResult.outcome === 'continue' && `Point is ${lastResult.point}`}
            </div>
          )}
        </div>

        {/* Roll history dots */}
        {history.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {history.slice(0, 15).map((h, i) => (
              <motion.div
                key={h.id}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border',
                  h.profit > 0
                    ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                    : h.profit < 0
                      ? 'bg-[#EF4444]/15 border-[#EF4444]/40 text-[#EF4444]'
                      : 'bg-[#1C2128] border-[#30363D] text-[#8B949E]',
                )}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.03 }}
                title={`${h.dice[0]}+${h.dice[1]}=${h.total}`}
              >
                {h.total}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 space-y-3 mt-3">
        {/* Craps table layout */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-3 space-y-2">
          <div className="text-[10px] text-[#8B949E] text-center mb-1">Tap to place bet. Long press to remove.</div>

          {/* Pass / Don't Pass */}
          <div className="grid grid-cols-2 gap-2">
            {renderBetZone('pass', 'large')}
            {renderBetZone('dontPass', 'large')}
          </div>

          {/* Come / Don't Come */}
          <div className="grid grid-cols-2 gap-2">
            {renderBetZone('come', 'medium')}
            {renderBetZone('dontCome', 'medium')}
          </div>

          {/* Field */}
          <div>
            {renderBetZone('field', 'large')}
          </div>

          {/* Place bets */}
          <div className="grid grid-cols-2 gap-2">
            {renderBetZone('place6', 'medium')}
            {renderBetZone('place8', 'medium')}
          </div>

          {/* Proposition bets */}
          <div className="grid grid-cols-4 gap-1.5">
            {renderBetZone('any7', 'small')}
            {renderBetZone('yo11', 'small')}
            {renderBetZone('anyCraps', 'small')}
            {renderBetZone('craps2', 'small')}
          </div>

          {/* Hardways */}
          <div className="grid grid-cols-4 gap-1.5">
            {renderBetZone('hard4', 'small')}
            {renderBetZone('hard6', 'small')}
            {renderBetZone('hard8', 'small')}
            {renderBetZone('hard10', 'small')}
          </div>
        </div>

        {/* Manual/Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setManualMode(true)}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              manualMode ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setManualMode(false)}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              !manualMode ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
            )}
          >
            Auto
          </button>
        </div>

        {/* Bet Amount Control */}
        <div className="space-y-2">
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-[#8B949E] text-sm mr-2">{currency}</span>
            <span className="flex-1 text-center font-mono text-white text-sm">
              ${chipValue.toFixed(2)}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setChipValue(Math.max(0.01, chipValue - (chipValue >= 10 ? 5 : chipValue >= 1 ? 0.5 : 0.1)))}
                disabled={isRolling}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D434B] transition-colors disabled:opacity-50"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setChipValue(chipValue + (chipValue >= 10 ? 5 : chipValue >= 1 ? 0.5 : 0.1))}
                disabled={isRolling}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D434B] transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 flex-wrap">
            {BET_PRESETS.map((val) => (
              <button
                key={val}
                onClick={() => setChipValue(val)}
                disabled={isRolling}
                className={cn(
                  'bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50',
                  chipValue === val && 'border-[#C8FF00] text-[#C8FF00]',
                )}
              >
                {val}
              </button>
            ))}
            <button
              onClick={() => setChipValue(Math.max(0.01, chipValue / 2))}
              disabled={isRolling}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
            >
              1/2
            </button>
            <button
              onClick={() => setChipValue(chipValue * 2)}
              disabled={isRolling}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
            >
              2X
            </button>
          </div>
        </div>

        {/* Active bets summary */}
        {placedBets.length > 0 && (
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#8B949E]">Active Bets</span>
              <button
                onClick={clearBets}
                disabled={isRolling}
                className="text-[10px] text-[#EF4444] hover:text-[#F87171] flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="space-y-1">
              {placedBets.map((bet) => {
                const info = BET_TYPES[bet.type];
                return (
                  <div
                    key={bet.type}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium" style={{ color: info?.color }}>
                      {info?.label || bet.type}
                    </span>
                    <span className="font-mono text-[#E6EDF3]">
                      ${bet.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-[#30363D] flex items-center justify-between">
              <span className="text-xs text-[#8B949E]">Total Bet</span>
              <span className="text-sm font-mono font-bold text-[#C8FF00]">
                ${totalBet.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Roll / New Game button */}
        {phase === 'resolved' ? (
          <motion.button
            onClick={newGame}
            whileTap={{ scale: 0.98 }}
            className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base"
          >
            <span className="flex items-center justify-center gap-2">
              <RotateCcw className="w-5 h-5" /> NEW GAME
            </span>
          </motion.button>
        ) : (
          <motion.button
            onClick={rollDice}
            disabled={isRolling || animatingResults || placedBets.length === 0 || !isAuthenticated}
            whileTap={!isRolling ? { scale: 0.98 } : {}}
            className={cn(
              'font-bold py-3.5 rounded-xl w-full text-base transition-all',
              isRolling || animatingResults || placedBets.length === 0 || !isAuthenticated
                ? 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                : 'bg-[#C8FF00] text-black',
            )}
          >
            {isRolling ? (
              <span className="flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5 animate-spin" />
                ROLLING...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {point ? `ROLL DICE (Point: ${point})` : 'ROLL DICE'}
              </span>
            )}
          </motion.button>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="text-[#EF4444] text-xs text-center bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-[#C8FF00]" />
                How to Play Craps
              </h3>
              <div className="text-xs text-[#8B949E] space-y-2">
                <p>
                  <strong className="text-[#E6EDF3]">Come-out Roll:</strong> The first roll. Pass Line
                  wins on 7 or 11, loses on 2, 3, or 12. Any other number becomes the Point.
                </p>
                <p>
                  <strong className="text-[#E6EDF3]">Point Phase:</strong> Keep rolling. If the Point
                  number hits, Pass Line wins. If 7 hits first, Pass Line loses (seven-out).
                </p>
                <p>
                  <strong className="text-[#E6EDF3]">{"Don't Pass:"}</strong> Opposite of Pass Line. Wins
                  on 2/3 come-out, loses on 7/11. During point, wins if 7 comes before point.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fairness */}
        <AnimatePresence>
          {showFairness && fairness && (
            <motion.div
              className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                Provably Fair
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[#8B949E]">Round ID: </span>
                  <span className="text-[#E6EDF3]">{roundId}</span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Server Seed Hash: </span>
                  <span className="text-[#E6EDF3] break-all">{fairness.serverSeedHash}</span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Client Seed: </span>
                  <span className="text-[#E6EDF3]">{fairness.clientSeed}</span>
                </div>
                <div>
                  <span className="text-[#8B949E]">Nonce: </span>
                  <span className="text-[#E6EDF3]">{fairness.nonce}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-[#C8FF00]" /> Roll History
              </h3>
              {history.length === 0 ? (
                <p className="text-xs text-[#484F58] text-center py-4">No rolls yet</p>
              ) : (
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'flex items-center justify-between bg-[#0D1117] rounded-lg px-3 py-2',
                        'border-l-2',
                        entry.profit > 0
                          ? 'border-l-[#10B981]'
                          : entry.profit < 0
                            ? 'border-l-[#EF4444]'
                            : 'border-l-[#30363D]',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#E6EDF3]">
                          {entry.dice[0]}+{entry.dice[1]}={entry.total}
                        </span>
                        <span className="text-[10px] text-[#8B949E] uppercase">
                          {entry.outcome}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-mono font-bold',
                          entry.profit > 0
                            ? 'text-[#10B981]'
                            : entry.profit < 0
                              ? 'text-[#EF4444]'
                              : 'text-[#8B949E]',
                        )}
                      >
                        {entry.profit > 0 ? '+' : ''}
                        {formatCurrency(entry.profit, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/casino">
            <Home className="w-6 h-6 text-[#8B949E]" />
          </Link>
          <button onClick={() => setShowInfo(!showInfo)}>
            <Info className="w-6 h-6 text-[#8B949E]" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="w-6 h-6 text-[#8B949E]" /> : <VolumeX className="w-6 h-6 text-[#8B949E]" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {formatCurrency(balance, currency)}
        </span>
        <button
          onClick={() => setShowFairness(!showFairness)}
          className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 text-xs text-[#8B5CF6]"
        >
          Provably Fair Game
        </button>
      </div>
    </div>
  );
}
