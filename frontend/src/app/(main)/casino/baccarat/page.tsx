'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Volume2, VolumeX, Home, Info, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BetType = 'player' | 'banker' | 'tie';
type GamePhase = 'betting' | 'dealing' | 'thirdCard' | 'result';
type RoadEntry = 'P' | 'B' | 'T';

interface CardData {
  rank: string;
  suit: string;
}

interface BaccaratResult {
  playerHand: CardData[];
  bankerHand: CardData[];
  playerTotal: number;
  bankerTotal: number;
  winner: 'player' | 'banker' | 'tie';
  thirdCardDrawn: boolean;
  payout: number;
  multiplier: number;
}

interface BaccaratResponse {
  roundId: string;
  result: BaccaratResult;
  fairness: { clientSeed: string; serverSeedHash: string; nonce: number };
  newBalance: number;
}

// ---------------------------------------------------------------------------
// Suit rendering helpers
// ---------------------------------------------------------------------------

const SUIT_MAP: Record<string, { symbol: string; color: string }> = {
  hearts:   { symbol: '\u2665', color: '#ef4444' },
  diamonds: { symbol: '\u2666', color: '#ef4444' },
  clubs:    { symbol: '\u2663', color: '#1e293b' },
  spades:   { symbol: '\u2660', color: '#1e293b' },
  h: { symbol: '\u2665', color: '#ef4444' },
  d: { symbol: '\u2666', color: '#ef4444' },
  c: { symbol: '\u2663', color: '#1e293b' },
  s: { symbol: '\u2660', color: '#1e293b' },
};

function getSuitInfo(suit: string) {
  const key = suit.toLowerCase();
  return SUIT_MAP[key] || { symbol: suit, color: '#1e293b' };
}

function getCardValue(rank: string): number {
  if (['J', 'Q', 'K', '10'].includes(rank.toUpperCase())) return 0;
  if (rank.toUpperCase() === 'A') return 1;
  return parseInt(rank) || 0;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE'];
const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

// ---------------------------------------------------------------------------
// Playing Card Component
// ---------------------------------------------------------------------------

function PlayingCard({
  card,
  index,
  delay = 0,
  faceDown = false,
}: {
  card: CardData;
  index: number;
  delay?: number;
  faceDown?: boolean;
}) {
  const { symbol, color } = getSuitInfo(card.suit);
  const isRed = color === '#ef4444';

  return (
    <motion.div
      initial={{ x: 200, y: -100, rotateY: 180, opacity: 0 }}
      animate={{ x: 0, y: 0, rotateY: 0, opacity: 1 }}
      transition={{
        duration: 0.5,
        delay: delay,
        type: 'spring',
        stiffness: 120,
        damping: 14,
      }}
      className="relative"
      style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: index }}
    >
      <div
        className={cn(
          'w-[48px] h-[70px] sm:w-[60px] sm:h-[86px] rounded-lg relative overflow-hidden',
          'shadow-[0_4px_16px_rgba(0,0,0,0.4)] border',
          faceDown
            ? 'border-blue-600/60 bg-gradient-to-br from-blue-900 to-blue-950'
            : 'border-gray-300/40 bg-gradient-to-br from-white to-gray-100'
        )}
      >
        {faceDown ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-9 h-13 sm:w-11 sm:h-15 rounded border-2 border-blue-600/40 bg-blue-800/30"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(59,130,246,0.15) 3px, rgba(59,130,246,0.15) 6px)',
              }}
            />
          </div>
        ) : (
          <>
            <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
              <span
                className="text-[10px] sm:text-xs font-bold"
                style={{ color: isRed ? '#dc2626' : '#1e293b' }}
              >
                {card.rank}
              </span>
              <span className="text-[9px] sm:text-[10px]" style={{ color: isRed ? '#dc2626' : '#1e293b' }}>
                {symbol}
              </span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-xl sm:text-2xl opacity-90"
                style={{ color: isRed ? '#dc2626' : '#1e293b' }}
              >
                {symbol}
              </span>
            </div>
            <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
              <span
                className="text-[10px] sm:text-xs font-bold"
                style={{ color: isRed ? '#dc2626' : '#1e293b' }}
              >
                {card.rank}
              </span>
              <span className="text-[9px] sm:text-[10px]" style={{ color: isRed ? '#dc2626' : '#1e293b' }}>
                {symbol}
              </span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Score Badge
// ---------------------------------------------------------------------------

function ScoreBadge({
  total,
  isNatural,
  isWinner,
  label,
  side,
}: {
  total: number;
  isNatural: boolean;
  isWinner: boolean;
  label: string;
  side: 'player' | 'banker';
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={cn(
        'text-[10px] uppercase tracking-widest font-medium',
        side === 'player' ? 'text-blue-400/60' : 'text-red-400/60',
      )}>
        {label}
      </span>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        className={cn(
          'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold',
          'border-2 shadow-lg',
          isNatural
            ? 'bg-[#C8FF00] border-[#C8FF00] text-black'
            : isWinner
              ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
              : 'bg-[#30363D] border-[#30363D] text-gray-300'
        )}
      >
        {total}
      </motion.div>
      {isNatural && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-[9px] font-bold text-[#C8FF00] uppercase tracking-wider"
        >
          Natural
        </motion.span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bead Plate (scoreboard dots)
// ---------------------------------------------------------------------------

function BeadPlate({ history }: { history: RoadEntry[] }) {
  const ROWS = 6;
  const COLS = 12;
  const grid: (RoadEntry | null)[][] = Array.from({ length: ROWS }, () =>
    Array(COLS).fill(null)
  );

  let col = 0;
  let row = 0;
  for (const entry of history) {
    if (row >= ROWS) {
      row = 0;
      col++;
    }
    if (col >= COLS) break;
    grid[row][col] = entry;
    row++;
  }

  const colorMap: Record<RoadEntry, string> = {
    P: 'bg-blue-500',
    B: 'bg-red-500',
    T: 'bg-emerald-500',
  };

  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
      {Array.from({ length: ROWS }).map((_, r) =>
        Array.from({ length: COLS }).map((_, c) => {
          const entry = grid[r][c];
          return (
            <div
              key={`${r}-${c}`}
              className={cn(
                'w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[7px] sm:text-[8px] font-bold text-white',
                entry ? colorMap[entry] : 'bg-[#30363D]/30'
              )}
            >
              {entry || ''}
            </div>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Big Road
// ---------------------------------------------------------------------------

function BigRoad({ history }: { history: RoadEntry[] }) {
  const ROWS = 6;
  const MAX_COLS = 20;
  const grid: (RoadEntry | null)[][] = Array.from({ length: ROWS }, () =>
    Array(MAX_COLS).fill(null)
  );

  let col = 0;
  let row = 0;
  let prevResult: RoadEntry | null = null;

  for (const entry of history) {
    if (entry === 'T') continue;
    if (prevResult && entry !== prevResult) {
      col++;
      row = 0;
    } else if (row >= ROWS) {
      col++;
      row = ROWS - 1;
    }
    if (col >= MAX_COLS) break;
    grid[row][col] = entry;
    row++;
    prevResult = entry;
  }

  const actualCols = Math.min(Math.max(col + 2, 10), MAX_COLS);

  return (
    <div
      className="grid gap-[1px] overflow-x-auto"
      style={{ gridTemplateColumns: `repeat(${actualCols}, 1fr)` }}
    >
      {Array.from({ length: ROWS }).map((_, r) =>
        Array.from({ length: actualCols }).map((_, c) => {
          const entry = grid[r][c];
          return (
            <div
              key={`br-${r}-${c}`}
              className={cn(
                'w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border',
                entry === 'P'
                  ? 'border-blue-400'
                  : entry === 'B'
                    ? 'border-red-400'
                    : 'border-[#30363D]/20'
              )}
              style={
                entry
                  ? {
                      boxShadow: `inset 0 0 0 2px ${entry === 'P' ? '#3b82f6' : '#ef4444'}`,
                    }
                  : undefined
              }
            />
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Panel
// ---------------------------------------------------------------------------

function StatsPanel({ history }: { history: RoadEntry[] }) {
  const total = history.length || 1;
  const pWins = history.filter((e) => e === 'P').length;
  const bWins = history.filter((e) => e === 'B').length;
  const ties = history.filter((e) => e === 'T').length;

  const stats = [
    { label: 'Player', value: pWins, pct: ((pWins / total) * 100).toFixed(1), color: 'text-blue-400', bg: 'bg-blue-500' },
    { label: 'Banker', value: bWins, pct: ((bWins / total) * 100).toFixed(1), color: 'text-red-400', bg: 'bg-red-500' },
    { label: 'Tie', value: ties, pct: ((ties / total) * 100).toFixed(1), color: 'text-emerald-400', bg: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-2">
      {stats.map((s) => (
        <div key={s.label} className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className={cn('font-semibold', s.color)}>{s.label}</span>
            <span className="text-gray-500">
              {s.value} ({s.pct}%)
            </span>
          </div>
          <div className="h-1 bg-[#30363D] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(s.value / total) * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn('h-full rounded-full', s.bg)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Baccarat Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function BaccaratPage() {
  const { isAuthenticated, user } = useAuthStore();
  const storeCurrency = useBetSlipStore((s) => s.currency);

  // Game state
  const [currency, setCurrency] = useState(storeCurrency || 'USDT');
  const [betAmount, setBetAmount] = useState('1.00');
  const [selectedBet, setSelectedBet] = useState<BetType | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Round state
  const [playerCards, setPlayerCards] = useState<CardData[]>([]);
  const [bankerCards, setBankerCards] = useState<CardData[]>([]);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [bankerTotal, setBankerTotal] = useState(0);
  const [winner, setWinner] = useState<'player' | 'banker' | 'tie' | null>(null);
  const [payout, setPayout] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [thirdCardDrawn, setThirdCardDrawn] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // History
  const [history, setHistory] = useState<RoadEntry[]>([]);
  const [lastRounds, setLastRounds] = useState<
    { winner: string; playerTotal: number; bankerTotal: number }[]
  >([]);

  // Fairness
  const [fairness, setFairness] = useState<{
    clientSeed: string;
    serverSeedHash: string;
    nonce: number;
  } | null>(null);

  // Dealing animation state
  const [visiblePlayerCards, setVisiblePlayerCards] = useState(0);
  const [visibleBankerCards, setVisibleBankerCards] = useState(0);
  const [showTotals, setShowTotals] = useState(false);
  const dealTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  // Derived
  const balance = user?.balances?.find((b) => b.currency === currency)?.available ?? 0;

  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  useEffect(() => {
    return () => {
      dealTimeoutRef.current.forEach(clearTimeout);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Clear deal animation state
  // ---------------------------------------------------------------------------

  const resetDealState = useCallback(() => {
    dealTimeoutRef.current.forEach(clearTimeout);
    dealTimeoutRef.current = [];
    setVisiblePlayerCards(0);
    setVisibleBankerCards(0);
    setShowTotals(false);
    setShowResult(false);
    setPlayerCards([]);
    setBankerCards([]);
    setPlayerTotal(0);
    setBankerTotal(0);
    setWinner(null);
    setPayout(0);
    setMultiplier(0);
    setThirdCardDrawn(false);
    setError(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Animate card dealing
  // ---------------------------------------------------------------------------

  const animateDeal = useCallback(
    (result: BaccaratResult) => {
      resetDealState();
      setGamePhase('dealing');
      setPlayerCards(result.playerHand);
      setBankerCards(result.bankerHand);

      const timeouts: NodeJS.Timeout[] = [];
      const hasThird = result.thirdCardDrawn;

      timeouts.push(setTimeout(() => setVisiblePlayerCards(1), 300));
      timeouts.push(setTimeout(() => setVisibleBankerCards(1), 700));
      timeouts.push(setTimeout(() => setVisiblePlayerCards(2), 1100));
      timeouts.push(setTimeout(() => setVisibleBankerCards(2), 1500));

      const initialTotalDelay = 1900;
      timeouts.push(
        setTimeout(() => {
          const pInitial = (getCardValue(result.playerHand[0].rank) + getCardValue(result.playerHand[1].rank)) % 10;
          const bInitial = (getCardValue(result.bankerHand[0].rank) + getCardValue(result.bankerHand[1].rank)) % 10;
          setPlayerTotal(pInitial);
          setBankerTotal(bInitial);
          setShowTotals(true);
        }, initialTotalDelay)
      );

      const pNatural = (getCardValue(result.playerHand[0].rank) + getCardValue(result.playerHand[1].rank)) % 10;
      const bNatural = (getCardValue(result.bankerHand[0].rank) + getCardValue(result.bankerHand[1].rank)) % 10;
      const isNatural = pNatural >= 8 || bNatural >= 8;

      if (hasThird && !isNatural) {
        setGamePhase('thirdCard');
        let thirdDelay = 2600;

        if (result.playerHand.length > 2) {
          timeouts.push(
            setTimeout(() => {
              setVisiblePlayerCards(3);
            }, thirdDelay)
          );
          thirdDelay += 600;
        }

        if (result.bankerHand.length > 2) {
          timeouts.push(
            setTimeout(() => {
              setVisibleBankerCards(3);
            }, thirdDelay)
          );
          thirdDelay += 600;
        }

        timeouts.push(
          setTimeout(() => {
            setPlayerTotal(result.playerTotal);
            setBankerTotal(result.bankerTotal);
            setThirdCardDrawn(true);
          }, thirdDelay)
        );

        timeouts.push(
          setTimeout(() => {
            setWinner(result.winner);
            setPayout(result.payout);
            setMultiplier(result.multiplier);
            setShowResult(true);
            setGamePhase('result');
          }, thirdDelay + 600)
        );
      } else {
        const resultDelay = isNatural ? 2400 : 2600;
        timeouts.push(
          setTimeout(() => {
            setPlayerTotal(result.playerTotal);
            setBankerTotal(result.bankerTotal);
            setWinner(result.winner);
            setPayout(result.payout);
            setMultiplier(result.multiplier);
            setShowResult(true);
            setGamePhase('result');
          }, resultDelay)
        );
      }

      dealTimeoutRef.current = timeouts;
    },
    [resetDealState]
  );

  // ---------------------------------------------------------------------------
  // Play round
  // ---------------------------------------------------------------------------

  const handlePlay = async () => {
    if (!isAuthenticated || !selectedBet || isLoading) return;
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bet amount.');
      return;
    }
    if (amount > balance) {
      setError('Insufficient balance.');
      return;
    }

    setIsLoading(true);
    setError(null);
    resetDealState();

    try {
      const data = await post<BaccaratResponse>('/casino/games/baccarat/play', {
        amount,
        currency,
        options: { betType: selectedBet },
      });

      setFairness(data.fairness);

      useAuthStore.getState().updateBalance(currency, data.newBalance, 0);

      const winnerChar: RoadEntry =
        data.result.winner === 'player' ? 'P' : data.result.winner === 'banker' ? 'B' : 'T';
      setHistory((prev) => [...prev, winnerChar]);
      setLastRounds((prev) => [
        ...prev.slice(-49),
        {
          winner: data.result.winner,
          playerTotal: data.result.playerTotal,
          bankerTotal: data.result.bankerTotal,
        },
      ]);

      animateDeal(data.result);
    } catch (err: any) {
      setError(err?.message || 'Failed to play. Please try again.');
      setGamePhase('betting');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // New round
  // ---------------------------------------------------------------------------

  const handleNewRound = () => {
    resetDealState();
    setGamePhase('betting');
    setFairness(null);
  };

  // ---------------------------------------------------------------------------
  // Bet amount helpers
  // ---------------------------------------------------------------------------

  const handleHalf = () => {
    const val = parseFloat(betAmount) / 2;
    if (val > 0) setBetAmount(val.toFixed(8).replace(/\.?0+$/, ''));
  };

  const handleDouble = () => {
    const val = parseFloat(betAmount) * 2;
    setBetAmount(val.toFixed(8).replace(/\.?0+$/, ''));
  };

  const adjustBetMinus = () => {
    const v = parseFloat(betAmount);
    if (!isNaN(v) && v > 0.01) {
      const next = Math.max(0.01, v - (v >= 10 ? 5 : v >= 1 ? 0.5 : 0.01));
      setBetAmount(next.toFixed(8).replace(/\.?0+$/, ''));
    }
  };

  const adjustBetPlus = () => {
    const v = parseFloat(betAmount);
    if (!isNaN(v)) {
      const next = v + (v >= 10 ? 5 : v >= 1 ? 0.5 : 0.01);
      setBetAmount(next.toFixed(8).replace(/\.?0+$/, ''));
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isPlaying = gamePhase !== 'betting';
  const pNat =
    playerCards.length >= 2
      ? (getCardValue(playerCards[0]?.rank || '') + getCardValue(playerCards[1]?.rank || '')) % 10 >= 8
      : false;
  const bNat =
    bankerCards.length >= 2
      ? (getCardValue(bankerCards[0]?.rank || '') + getCardValue(bankerCards[1]?.rank || '')) % 10 >= 8
      : false;

  return (
    <div className="min-h-screen bg-[#0D1117] text-white flex flex-col pb-20">

      {/* ================================================================== */}
      {/* Header - CRYPTOBET centered                                        */}
      {/* ================================================================== */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-base tracking-wider">
          CRYPTO<span className="text-[#8B5CF6]">BET</span>
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 mt-2">
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-4 py-2 text-center">
            <span className="text-xs text-[#EF4444] font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* GAME TABLE AREA - edge-to-edge                                     */}
      {/* ================================================================== */}
      <div className="relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, #1a3a28 0%, #142a1e 60%, #0D1117 100%)',
          minHeight: '280px',
        }}
      >
        <div className="relative z-10 px-4 py-5 flex flex-col items-center" style={{ minHeight: '280px' }}>

          {/* ---- BET SELECTION (during betting phase) ---- */}
          {gamePhase === 'betting' && (
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <span className="text-[10px] text-gray-600 uppercase tracking-[0.2em] mb-4">Select Your Bet</span>

              <div className="grid grid-cols-3 gap-3 w-full">
                {/* PLAYER */}
                <button
                  onClick={() => setSelectedBet('player')}
                  disabled={isLoading}
                  className={cn(
                    'relative rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all',
                    'border-2 min-h-[90px]',
                    selectedBet === 'player'
                      ? 'border-[#C8FF00] bg-[#C8FF00]/10 shadow-[0_0_20px_rgba(200,255,0,0.15)]'
                      : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-400/50'
                  )}
                >
                  <span className="text-sm sm:text-base font-bold text-blue-400">PLAYER</span>
                  <span className="text-[10px] text-blue-300/60">2x</span>
                  {selectedBet === 'player' && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#C8FF00] flex items-center justify-center">
                      <span className="text-[8px] text-black font-bold">&#10003;</span>
                    </div>
                  )}
                </button>

                {/* TIE */}
                <button
                  onClick={() => setSelectedBet('tie')}
                  disabled={isLoading}
                  className={cn(
                    'relative rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all',
                    'border-2 min-h-[90px]',
                    selectedBet === 'tie'
                      ? 'border-[#C8FF00] bg-[#C8FF00]/10 shadow-[0_0_20px_rgba(200,255,0,0.15)]'
                      : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/50'
                  )}
                >
                  <span className="text-sm sm:text-base font-bold text-emerald-400">TIE</span>
                  <span className="text-[10px] text-emerald-300/60">9x</span>
                  {selectedBet === 'tie' && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#C8FF00] flex items-center justify-center">
                      <span className="text-[8px] text-black font-bold">&#10003;</span>
                    </div>
                  )}
                </button>

                {/* BANKER */}
                <button
                  onClick={() => setSelectedBet('banker')}
                  disabled={isLoading}
                  className={cn(
                    'relative rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 transition-all',
                    'border-2 min-h-[90px]',
                    selectedBet === 'banker'
                      ? 'border-[#C8FF00] bg-[#C8FF00]/10 shadow-[0_0_20px_rgba(200,255,0,0.15)]'
                      : 'border-red-500/30 bg-red-500/5 hover:border-red-400/50'
                  )}
                >
                  <span className="text-sm sm:text-base font-bold text-red-400">BANKER</span>
                  <span className="text-[10px] text-red-300/60">1.95x</span>
                  {selectedBet === 'banker' && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#C8FF00] flex items-center justify-center">
                      <span className="text-[8px] text-black font-bold">&#10003;</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ---- Card Display (during dealing/result) ---- */}
          {isPlaying && (
            <div className="flex-1 flex flex-col items-center justify-between w-full gap-3">
              {/* Bet indicator */}
              <span
                className={cn(
                  'text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border font-semibold',
                  selectedBet === 'player'
                    ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                    : selectedBet === 'banker'
                      ? 'text-red-400 border-red-500/30 bg-red-500/10'
                      : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                )}
              >
                Bet: {selectedBet} / {formatCurrency(parseFloat(betAmount), currency)}
              </span>

              {/* Cards area - centered */}
              <div className="flex items-start justify-center gap-6 sm:gap-10 w-full">
                {/* Player side */}
                <div className="flex flex-col items-center gap-2">
                  {showTotals ? (
                    <ScoreBadge
                      total={playerTotal}
                      isNatural={pNat && !thirdCardDrawn && playerTotal >= 8}
                      isWinner={winner === 'player'}
                      label="Player"
                      side="player"
                    />
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-blue-300/40 font-medium h-[44px] sm:h-[56px] flex items-center">
                      Player
                    </span>
                  )}
                  <div className="flex items-center">
                    {playerCards.slice(0, visiblePlayerCards).map((card, i) => (
                      <PlayingCard key={`p-${i}`} card={card} index={i} delay={0} />
                    ))}
                    {visiblePlayerCards === 0 && (
                      <div className="w-[48px] h-[70px] sm:w-[60px] sm:h-[86px] rounded-lg border border-dashed border-blue-500/20" />
                    )}
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center justify-center mt-6">
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-[#C8FF00]/30 to-transparent" />
                  <span className="text-[#C8FF00]/40 text-[8px] font-bold my-1">VS</span>
                  <div className="w-px h-10 bg-gradient-to-b from-transparent via-[#C8FF00]/30 to-transparent" />
                </div>

                {/* Banker side */}
                <div className="flex flex-col items-center gap-2">
                  {showTotals ? (
                    <ScoreBadge
                      total={bankerTotal}
                      isNatural={bNat && !thirdCardDrawn && bankerTotal >= 8}
                      isWinner={winner === 'banker'}
                      label="Banker"
                      side="banker"
                    />
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-red-300/40 font-medium h-[44px] sm:h-[56px] flex items-center">
                      Banker
                    </span>
                  )}
                  <div className="flex items-center">
                    {bankerCards.slice(0, visibleBankerCards).map((card, i) => (
                      <PlayingCard key={`b-${i}`} card={card} index={i} delay={0} />
                    ))}
                    {visibleBankerCards === 0 && (
                      <div className="w-[48px] h-[70px] sm:w-[60px] sm:h-[86px] rounded-lg border border-dashed border-red-500/20" />
                    )}
                  </div>
                </div>
              </div>

              {/* Winner announcement */}
              <AnimatePresence>
                {showResult && winner && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="text-center"
                  >
                    <div
                      className={cn(
                        'inline-block px-5 py-2 rounded-xl font-black text-base sm:text-lg uppercase tracking-wide',
                        'border-2',
                        winner === selectedBet
                          ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                          : winner === 'tie' && selectedBet !== 'tie'
                            ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                            : 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                      )}
                    >
                      {winner === 'player'
                        ? 'PLAYER WINS!'
                        : winner === 'banker'
                          ? 'BANKER WINS!'
                          : 'TIE!'}
                    </div>
                    {payout > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-1 text-[#10B981] font-bold text-sm"
                      >
                        +{formatCurrency(payout, currency)} ({multiplier}x)
                      </motion.div>
                    )}
                    {payout === 0 && selectedBet !== winner && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-1 text-gray-500 text-xs"
                      >
                        Better luck next time
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dealing animation indicator */}
              {(gamePhase === 'dealing' || gamePhase === 'thirdCard') && !showResult && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-[#C8FF00] font-semibold text-xs uppercase tracking-widest"
                >
                  {gamePhase === 'dealing' ? 'Dealing...' : 'Drawing third card...'}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* CONTROLS                                                            */}
      {/* ================================================================== */}
      <div className="px-4 mt-3 space-y-3">
        {gamePhase === 'betting' ? (
          <>
            {/* Bet Amount */}
            <div>
              <label className="text-[#8B949E] text-sm mb-1 block">
                Bet Amount
              </label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent border-none text-sm text-white font-mono focus:outline-none pr-2"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c} className="bg-[#161B22]">{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="flex-1 bg-transparent text-center font-mono text-sm text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  step="any"
                  min="0"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={adjustBetMinus}
                    className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white font-bold text-sm hover:bg-[#3D444D] transition-colors"
                  >
                    -
                  </button>
                  <button
                    onClick={adjustBetPlus}
                    className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white font-bold text-sm hover:bg-[#3D444D] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {BET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setBetAmount(preset)}
                  className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors"
                >
                  {preset}
                </button>
              ))}
              <button
                onClick={handleHalf}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors"
              >
                1/2
              </button>
              <button
                onClick={handleDouble}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors"
              >
                2X
              </button>
            </div>

            {/* Deal button - lime CTA */}
            <button
              onClick={handlePlay}
              disabled={isLoading || !selectedBet || !isAuthenticated}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.98]',
                'disabled:cursor-not-allowed',
                isLoading
                  ? 'bg-[#2D333B] text-gray-500'
                  : !selectedBet
                  ? 'bg-[#2D333B] text-gray-600'
                  : !isAuthenticated
                  ? 'bg-[#2D333B] text-gray-500'
                  : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00] shadow-lg shadow-[#C8FF00]/10',
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="inline-block"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </motion.span>
                  Dealing...
                </span>
              ) : !selectedBet ? (
                'Select a Bet'
              ) : !isAuthenticated ? (
                'Login to Play'
              ) : (
                'DEAL'
              )}
            </button>
          </>
        ) : gamePhase === 'result' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Your bet</span>
              <span className={cn(
                'font-semibold uppercase',
                selectedBet === 'player' ? 'text-blue-400' : selectedBet === 'banker' ? 'text-red-400' : 'text-emerald-400'
              )}>
                {selectedBet}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Wager</span>
              <span className="text-white font-mono">{formatCurrency(parseFloat(betAmount), currency)}</span>
            </div>
            {payout > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Payout</span>
                <span className="text-[#10B981] font-mono font-bold">+{formatCurrency(payout, currency)}</span>
              </div>
            )}
            <div className="h-px bg-[#30363D]" />
            <button
              onClick={handleNewRound}
              className="w-full py-3.5 rounded-xl font-bold text-base bg-[#C8FF00] text-black hover:bg-[#B8EF00] shadow-lg shadow-[#C8FF00]/10 transition-all active:scale-[0.98]"
            >
              NEW ROUND
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-[#C8FF00] font-semibold text-xs uppercase tracking-widest"
            >
              {gamePhase === 'dealing' ? 'Dealing cards...' : 'Drawing third card...'}
            </motion.div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SCOREBOARDS                                                         */}
      {/* ================================================================== */}
      {history.length > 0 && (
        <div className="px-4 mt-3 space-y-3">
          {/* Recent dots */}
          <div className="flex gap-1 flex-wrap">
            {history.slice(-30).map((entry, i) => (
              <div
                key={i}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white',
                  entry === 'P' ? 'bg-blue-500' : entry === 'B' ? 'bg-red-500' : 'bg-emerald-500'
                )}
              >
                {entry}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] p-3">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider font-medium block mb-2">
              Statistics ({history.length} rounds)
            </span>
            <StatsPanel history={history} />
          </div>

          {/* Bead Plate */}
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider font-medium">Bead Plate</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[8px] text-gray-600">P</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[8px] text-gray-600">B</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[8px] text-gray-600">T</span>
                </span>
              </div>
            </div>
            <BeadPlate history={history} />
          </div>

          {/* Big Road */}
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] p-3">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider font-medium block mb-2">Big Road</span>
            <BigRoad history={history} />
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* PAYOUT INFO                                                         */}
      {/* ================================================================== */}
      <div className="px-4 mt-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Player', payout: '2x', color: 'border-blue-500/30' },
            { label: 'Tie', payout: '9x', color: 'border-emerald-500/30' },
            { label: 'Banker', payout: '1.95x', color: 'border-red-500/30' },
          ].map((item) => (
            <div
              key={item.label}
              className={cn('rounded-lg border p-2 text-center bg-[#161B22]', item.color)}
            >
              <div className="text-[9px] text-gray-500 uppercase tracking-wider">{item.label}</div>
              <div className="text-xs font-bold text-gray-300 mt-0.5">{item.payout}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fairness */}
      {fairness && (
        <div className="px-4 mt-3">
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Provably Fair</span>
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              <div className="flex gap-2">
                <span className="text-gray-600 shrink-0">Hash</span>
                <span className="text-gray-400 truncate">{fairness.serverSeedHash}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600 shrink-0">Client</span>
                <span className="text-gray-400 truncate">{fairness.clientSeed}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600 shrink-0">Nonce</span>
                <span className="text-gray-400">{fairness.nonce}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FIXED BOTTOM BAR                                                    */}
      {/* ================================================================== */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Link href="/casino" className="text-[#8B949E] hover:text-white transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <button className="text-[#8B949E] hover:text-white transition-colors">
            <Info className="w-6 h-6" />
          </button>
          <button onClick={() => setMuted(!muted)} className="text-[#8B949E] hover:text-white transition-colors">
            {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
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
