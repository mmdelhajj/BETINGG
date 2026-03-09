'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Shield, Volume2, VolumeX, ChevronDown, TrendingUp, Zap, RotateCcw, Home, Info } from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Side = 'heads' | 'tails';
type GamePhase = 'idle' | 'flipping' | 'result';

interface GameHistory {
  id: string;
  choice: Side;
  result: Side;
  won: boolean;
  amount: number;
  payout: number;
  profit: number;
}

interface CoinflipResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    choice: string;
    coinResult: Side;
    isWin: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

// ---------------------------------------------------------------------------
// Particle burst for wins
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  life: number;
}

function ParticleBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for non-GPU
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#10B981', '#34D399', '#6EE7B7', '#FFD700', '#FCD34D', '#8B5CF6'];
    const cx = canvas.offsetWidth / 2;
    const cy = canvas.offsetHeight / 2;

    particlesRef.current = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: cx,
      y: cy,
      angle: (Math.PI * 2 * i) / 40 + (Math.random() - 0.5) * 0.5,
      speed: 2 + Math.random() * 4,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      let alive = false;

      particlesRef.current.forEach((p) => {
        if (p.life <= 0) return;
        alive = true;
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed + 0.5;
        p.life -= 0.018;
        p.speed *= 0.98;

        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.6, 1);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      if (alive) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-20"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Currency options
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];

// ---------------------------------------------------------------------------
// CoinFlip Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function CoinflipGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [selectedSide, setSelectedSide] = useState<Side>('heads');
  const [betAmount, setBetAmount] = useState('');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [lastResult, setLastResult] = useState<Side | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [lastProfit, setLastProfit] = useState<number>(0);
  const [flipKey, setFlipKey] = useState(0);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [lastFairness, setLastFairness] = useState<CoinflipResponse['fairness'] | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  // Auto-bet state
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState('0');
  const [autoBetOnWin, setAutoBetOnWin] = useState<'reset' | 'increase'>('reset');
  const [autoBetOnLoss, setAutoBetOnLoss] = useState<'reset' | 'increase'>('reset');
  const [autoBetWinIncrease, setAutoBetWinIncrease] = useState('0');
  const [autoBetLossIncrease, setAutoBetLossIncrease] = useState('0');
  const [autoBetStopProfit, setAutoBetStopProfit] = useState('');
  const [autoBetStopLoss, setAutoBetStopLoss] = useState('');
  const [autoBetRunning, setAutoBetRunning] = useState(false);
  const [autoBetPlayed, setAutoBetPlayed] = useState(0);
  const [autoBetSessionProfit, setAutoBetSessionProfit] = useState(0);

  // UI toggles
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual');
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const isPlayingRef = useRef(false);
  const autoBetRef = useRef(false);
  const autoBetAmountRef = useRef('');
  const autoBetProfitRef = useRef(0);
  const autoBetPlayedRef = useRef(0);
  const coinControls = useAnimation();

  // Sound
  const [soundEnabled, setSoundEnabled] = useState(true);

  const MULTIPLIER = 1.94;

  // Initialize bet amount
  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  // Current balance
  const currentBalance = useMemo(() => {
    if (!user?.balances) return 0;
    const bal = user.balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [user?.balances, currency]);

  // Win/loss streaks
  const { winStreak, lossStreak, totalWins, totalLosses } = useMemo(() => {
    let ws = 0, ls = 0, tw = 0, tl = 0;
    for (const h of history) {
      if (h.won) tw++;
      else tl++;
    }
    for (const h of history) {
      if (h.won) { ws++; } else break;
    }
    if (ws === 0) {
      for (const h of history) {
        if (!h.won) { ls++; } else break;
      }
    }
    return { winStreak: ws, lossStreak: ls, totalWins: tw, totalLosses: tl };
  }, [history]);

  // Potential profit
  const potentialProfit = useMemo(() => {
    const amt = parseFloat(betAmount) || 0;
    return amt * MULTIPLIER - amt;
  }, [betAmount]);

  // ---------------------------------------------------------------------------
  // Coin flip handler
  // ---------------------------------------------------------------------------

  const handleFlip = useCallback(async (overrideBetAmount?: string) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    const currentBet = overrideBetAmount || betAmount;

    setGamePhase('flipping');
    setLastResult(null);
    setLastWon(null);
    setLastProfit(0);
    setError(null);

    setFlipKey((k) => k + 1);

    let flipResult: Side;
    let isWin: boolean;
    let payoutAmount: number;
    let profitAmount: number;

    try {
      const data = await post<CoinflipResponse>('/casino/games/coinflip/play', {
        amount: parseFloat(currentBet),
        currency,
        options: { choice: selectedSide },
      });

      flipResult = data.result.coinResult;
      isWin = data.result.isWin;
      payoutAmount = data.payout;
      profitAmount = data.profit;

      setLastFairness(data.fairness);

      if (data.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, data.newBalance, 0);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to place bet. Please try again.';
      setError(msg);
      setGamePhase('idle');
      isPlayingRef.current = false;
      autoBetRef.current = false;
      setAutoBetRunning(false);
      return;
    }

    setTimeout(async () => {
      setLastResult(flipResult);
      setLastWon(isWin);
      setLastProfit(profitAmount);
      setGamePhase('result');
      isPlayingRef.current = false;

      const round: GameHistory = {
        id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        choice: selectedSide,
        result: flipResult,
        won: isWin,
        amount: parseFloat(currentBet),
        payout: payoutAmount,
        profit: profitAmount,
      };
      setHistory((prev) => [round, ...prev.slice(0, 19)]);

      // Auto-bet logic
      if (autoBetRef.current) {
        const newPlayed = autoBetPlayedRef.current + 1;
        autoBetPlayedRef.current = newPlayed;
        setAutoBetPlayed(newPlayed);

        const newProfit = autoBetProfitRef.current + profitAmount;
        autoBetProfitRef.current = newProfit;
        setAutoBetSessionProfit(newProfit);

        const maxBets = parseInt(autoBetCount) || 0;
        const stopProfit = parseFloat(autoBetStopProfit) || Infinity;
        const stopLoss = parseFloat(autoBetStopLoss) || Infinity;

        if (
          (maxBets > 0 && newPlayed >= maxBets) ||
          (newProfit >= stopProfit) ||
          (newProfit <= -stopLoss)
        ) {
          autoBetRef.current = false;
          setAutoBetRunning(false);
          return;
        }

        let nextBet = parseFloat(autoBetAmountRef.current);
        if (isWin) {
          if (autoBetOnWin === 'increase') {
            const pct = parseFloat(autoBetWinIncrease) || 0;
            nextBet = nextBet * (1 + pct / 100);
          } else {
            nextBet = parseFloat(getDefaultBet(currency));
          }
        } else {
          if (autoBetOnLoss === 'increase') {
            const pct = parseFloat(autoBetLossIncrease) || 0;
            nextBet = nextBet * (1 + pct / 100);
          } else {
            nextBet = parseFloat(getDefaultBet(currency));
          }
        }

        const nextBetStr = nextBet.toFixed(8);
        autoBetAmountRef.current = nextBetStr;
        setBetAmount(nextBetStr);

        setTimeout(() => {
          if (autoBetRef.current) {
            handleFlip(nextBetStr);
          }
        }, 600);
      }
    }, 2200);
  }, [
    selectedSide, betAmount, currency, autoBetCount, autoBetOnWin, autoBetOnLoss,
    autoBetWinIncrease, autoBetLossIncrease, autoBetStopProfit, autoBetStopLoss,
  ]);

  // Start / stop auto-bet
  const toggleAutoBet = useCallback(() => {
    if (autoBetRunning) {
      autoBetRef.current = false;
      setAutoBetRunning(false);
    } else {
      autoBetRef.current = true;
      autoBetAmountRef.current = betAmount;
      autoBetProfitRef.current = 0;
      autoBetPlayedRef.current = 0;
      setAutoBetPlayed(0);
      setAutoBetSessionProfit(0);
      setAutoBetRunning(true);
      handleFlip();
    }
  }, [autoBetRunning, betAmount, handleFlip]);

  // Bet adjustment helpers
  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00000001, val * factor).toFixed(8).replace(/\.?0+$/, (m) => m.includes('.') ? m : ''));
  };

  const setMaxBet = () => {
    setBetAmount(currentBalance.toFixed(8).replace(/\.?0+$/, ''));
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setShowCurrencyDropdown(false);
    };
    if (showCurrencyDropdown) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [showCurrencyDropdown]);

  // Quick bet presets
  const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

  // ---------------------------------------------------------------------------
  // Render - Cloudbet Mobile Style (EXACT SPEC)
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 flex items-center gap-2"
          >
            <span className="text-sm text-[#EF4444] flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-[#EF4444] hover:text-red-300 text-lg leading-none font-bold">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coin Arena - Full Width Edge-to-Edge */}
      <div className="relative bg-[#161B22] overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1C2128] via-transparent to-transparent opacity-60" />

        {/* Multiplier badge */}
        <div className="absolute top-3 left-3 z-10">
          <div className="bg-[#0D1117]/80 border border-[#30363D] rounded-lg px-2.5 py-1 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-[#8B5CF6]" />
            <span className="text-xs font-bold font-mono text-[#8B5CF6]">{MULTIPLIER}x</span>
          </div>
        </div>

        {/* Streak badge */}
        {(winStreak > 1 || lossStreak > 1) && (
          <div className="absolute top-3 right-3 z-10">
            <div className={cn(
              'border rounded-lg px-2.5 py-1 flex items-center gap-1',
              winStreak > 1
                ? 'bg-[#10B981]/10 border-[#10B981]/30'
                : 'bg-[#EF4444]/10 border-[#EF4444]/30',
            )}>
              <Zap className={cn('w-3 h-3', winStreak > 1 ? 'text-[#10B981]' : 'text-[#EF4444]')} />
              <span className={cn('text-xs font-bold', winStreak > 1 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                {winStreak > 1 ? `${winStreak}W` : `${lossStreak}L`}
              </span>
            </div>
          </div>
        )}

        {/* Coin Container - ~280px height centered */}
        <div className="relative flex flex-col items-center justify-center min-h-[280px] py-6">
          <ParticleBurst active={gamePhase === 'result' && lastWon === true} />

          {/* The 3D Coin */}
          <div className="perspective-[800px]" style={{ perspective: '800px' }}>
            <motion.div
              key={flipKey}
              className={cn(
                'w-32 h-32 sm:w-40 sm:h-40 relative cursor-default',
                gamePhase === 'result' && lastWon === true && 'drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]',
                gamePhase === 'result' && lastWon === false && 'drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]',
              )}
              initial={{ rotateY: 0 }}
              animate={
                gamePhase === 'flipping'
                  ? { rotateY: [0, 360 * 7 + (lastResult === 'tails' ? 180 : 0)] }
                  : gamePhase === 'result' && lastWon === false
                    ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
                    : {}
              }
              transition={
                gamePhase === 'flipping'
                  ? { duration: 2, ease: [0.25, 0.1, 0.15, 1] }
                  : gamePhase === 'result' && lastWon === false
                    ? { duration: 0.5, ease: 'easeInOut' }
                    : {}
              }
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Heads Face */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  background: 'radial-gradient(ellipse at 35% 30%, #FCD34D, #F59E0B 40%, #D97706 70%, #B45309 100%)',
                  boxShadow: 'inset 0 2px 20px rgba(255,255,255,0.2), inset 0 -4px 12px rgba(0,0,0,0.3), 0 8px 32px rgba(245,158,11,0.3)',
                }}
              >
                <div className="absolute inset-[6px] rounded-full border-2 border-amber-300/30" />
                <div className="flex flex-col items-center z-10">
                  <svg width="36" height="28" viewBox="0 0 40 32" fill="none" className="mb-1 drop-shadow-lg">
                    <path d="M4 24L8 8L15 16L20 4L25 16L32 8L36 24H4Z" fill="#FEF3C7" stroke="#92400E" strokeWidth="1.5" />
                    <circle cx="8" cy="7" r="2.5" fill="#FEF3C7" stroke="#92400E" strokeWidth="1" />
                    <circle cx="20" cy="3" r="2.5" fill="#FEF3C7" stroke="#92400E" strokeWidth="1" />
                    <circle cx="32" cy="7" r="2.5" fill="#FEF3C7" stroke="#92400E" strokeWidth="1" />
                    <rect x="4" y="24" width="32" height="4" rx="1" fill="#FEF3C7" stroke="#92400E" strokeWidth="1" />
                  </svg>
                  <span className="text-base font-extrabold text-amber-900 tracking-wider drop-shadow">HEADS</span>
                </div>
              </div>

              {/* Tails Face */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'radial-gradient(ellipse at 35% 30%, #E5E7EB, #9CA3AF 40%, #6B7280 70%, #4B5563 100%)',
                  boxShadow: 'inset 0 2px 20px rgba(255,255,255,0.25), inset 0 -4px 12px rgba(0,0,0,0.3), 0 8px 32px rgba(156,163,175,0.3)',
                }}
              >
                <div className="absolute inset-[6px] rounded-full border-2 border-gray-300/30" />
                <div className="flex flex-col items-center z-10">
                  <svg width="32" height="32" viewBox="0 0 36 36" fill="none" className="mb-1 drop-shadow-lg">
                    <path d="M18 4L32 18L18 32L4 18L18 4Z" fill="#F3F4F6" stroke="#374151" strokeWidth="1.5" />
                    <path d="M18 4L24 18L18 32L12 18L18 4Z" fill="#E5E7EB" stroke="#374151" strokeWidth="0.5" />
                    <path d="M4 18H32" stroke="#374151" strokeWidth="0.75" />
                  </svg>
                  <span className="text-base font-extrabold text-gray-700 tracking-wider drop-shadow">TAILS</span>
                </div>
              </div>

              {/* Coin edge */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  transform: 'translateZ(-2px)',
                  background: 'linear-gradient(180deg, #92400E 0%, #78350F 100%)',
                  boxShadow: '0 0 0 3px #78350F',
                }}
              />
            </motion.div>
          </div>

          {/* Result overlay with profit/loss */}
          <AnimatePresence>
            {gamePhase === 'result' && lastWon !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                className="mt-4 text-center z-10"
              >
                <p className={cn(
                  'text-2xl font-extrabold',
                  lastWon ? 'text-[#10B981]' : 'text-[#EF4444]',
                )}>
                  {lastWon ? 'YOU WIN!' : 'YOU LOSE'}
                </p>
                {lastWon && lastProfit > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-1"
                  >
                    <span className="text-lg font-bold font-mono text-[#10B981]">
                      +{formatCurrency(lastProfit, currency)}
                    </span>
                  </motion.div>
                )}
                {!lastWon && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-1"
                  >
                    <span className="text-sm font-mono text-[#EF4444]/70">
                      -{formatCurrency(parseFloat(betAmount) || 0, currency)}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content area with padding */}
      <div className="px-4 pb-20 space-y-3 mt-4">

        {/* Heads / Tails Selection - Two large buttons side by side */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => gamePhase !== 'flipping' && setSelectedSide('heads')}
            disabled={gamePhase === 'flipping'}
            className={cn(
              'relative h-14 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 border-2 overflow-hidden',
              selectedSide === 'heads'
                ? 'bg-gradient-to-r from-amber-500/15 to-amber-600/10 border-[#C8FF00] text-amber-400'
                : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-amber-500/40 hover:text-amber-400/80',
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold transition-all',
              selectedSide === 'heads'
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-amber-900 shadow-lg'
                : 'bg-[#30363D] text-[#8B949E]',
            )}>
              H
            </div>
            <span className="relative z-10">HEADS</span>
            {selectedSide === 'heads' && (
              <div className="absolute right-3 w-2 h-2 rounded-full bg-[#C8FF00] animate-pulse" />
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => gamePhase !== 'flipping' && setSelectedSide('tails')}
            disabled={gamePhase === 'flipping'}
            className={cn(
              'relative h-14 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 border-2 overflow-hidden',
              selectedSide === 'tails'
                ? 'bg-gradient-to-r from-gray-400/15 to-gray-500/10 border-[#C8FF00] text-gray-300'
                : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-gray-400/40 hover:text-gray-400/80',
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold transition-all',
              selectedSide === 'tails'
                ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800 shadow-lg'
                : 'bg-[#30363D] text-[#8B949E]',
            )}>
              T
            </div>
            <span className="relative z-10">TAILS</span>
            {selectedSide === 'tails' && (
              <div className="absolute right-3 w-2 h-2 rounded-full bg-[#C8FF00] animate-pulse" />
            )}
          </motion.button>
        </div>

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => { setBetMode('manual'); setAutoBetEnabled(false); if (autoBetRunning) { autoBetRef.current = false; setAutoBetRunning(false); } }}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-all duration-200',
              betMode === 'manual'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Manual
          </button>
          <button
            onClick={() => { setBetMode('auto'); setAutoBetEnabled(true); }}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-all duration-200',
              betMode === 'auto'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Auto
          </button>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-xs text-[#8B949E] mr-2">{currency}</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={gamePhase === 'flipping' || autoBetRunning}
              step="any"
              min="0"
              className="flex-1 bg-transparent text-center text-sm font-mono text-[#E6EDF3] focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.00"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustBet(0.5)}
                disabled={gamePhase === 'flipping' || autoBetRunning}
                className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center disabled:opacity-40"
              >
                -
              </button>
              <button
                onClick={() => adjustBet(2)}
                disabled={gamePhase === 'flipping' || autoBetRunning}
                className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
          {/* Quick Presets */}
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {BET_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setBetAmount(p)}
                disabled={gamePhase === 'flipping' || autoBetRunning}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => adjustBet(0.5)}
              disabled={gamePhase === 'flipping' || autoBetRunning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
            >
              1/2
            </button>
            <button
              onClick={() => adjustBet(2)}
              disabled={gamePhase === 'flipping' || autoBetRunning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
            >
              2X
            </button>
          </div>
        </div>

        {/* Profit on Win */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[#8B949E] text-sm">Profit on Win</span>
            <span className="text-sm font-bold font-mono text-[#10B981]">
              +{formatCurrency(potentialProfit, currency)}
            </span>
          </div>
        </div>

        {/* Auto-bet settings (when auto mode) */}
        <AnimatePresence>
          {betMode === 'auto' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 space-y-3">
                <div>
                  <label className="text-[#8B949E] text-sm mb-1.5 block">Number of Bets</label>
                  <input
                    type="number"
                    value={autoBetCount}
                    onChange={(e) => setAutoBetCount(e.target.value)}
                    disabled={autoBetRunning}
                    className="w-full h-10 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0 = Infinite"
                  />
                </div>

                {/* On Win */}
                <div>
                  <label className="text-[#8B949E] text-sm mb-1.5 block">On Win</label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAutoBetOnWin('reset')}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-xs font-bold border transition-all',
                        autoBetOnWin === 'reset'
                          ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                          : 'bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:border-[#484F58]',
                      )}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setAutoBetOnWin('increase')}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-xs font-bold border transition-all',
                        autoBetOnWin === 'increase'
                          ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                          : 'bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:border-[#484F58]',
                      )}
                    >
                      Increase %
                    </button>
                  </div>
                  {autoBetOnWin === 'increase' && (
                    <input
                      type="number"
                      value={autoBetWinIncrease}
                      onChange={(e) => setAutoBetWinIncrease(e.target.value)}
                      disabled={autoBetRunning}
                      className="w-full h-9 mt-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="e.g. 100"
                    />
                  )}
                </div>

                {/* On Loss */}
                <div>
                  <label className="text-[#8B949E] text-sm mb-1.5 block">On Loss</label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setAutoBetOnLoss('reset')}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-xs font-bold border transition-all',
                        autoBetOnLoss === 'reset'
                          ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                          : 'bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:border-[#484F58]',
                      )}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setAutoBetOnLoss('increase')}
                      disabled={autoBetRunning}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-xs font-bold border transition-all',
                        autoBetOnLoss === 'increase'
                          ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                          : 'bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:border-[#484F58]',
                      )}
                    >
                      Increase %
                    </button>
                  </div>
                  {autoBetOnLoss === 'increase' && (
                    <input
                      type="number"
                      value={autoBetLossIncrease}
                      onChange={(e) => setAutoBetLossIncrease(e.target.value)}
                      disabled={autoBetRunning}
                      className="w-full h-9 mt-1.5 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="e.g. 100"
                    />
                  )}
                </div>

                {/* Stop Conditions */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#8B949E] text-sm mb-1.5 block">Stop Profit</label>
                    <input
                      type="number"
                      value={autoBetStopProfit}
                      onChange={(e) => setAutoBetStopProfit(e.target.value)}
                      disabled={autoBetRunning}
                      className="w-full h-9 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[#8B949E] text-sm mb-1.5 block">Stop Loss</label>
                    <input
                      type="number"
                      value={autoBetStopLoss}
                      onChange={(e) => setAutoBetStopLoss(e.target.value)}
                      disabled={autoBetRunning}
                      className="w-full h-9 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Auto-bet running stats */}
                {autoBetRunning && (
                  <div className="bg-[#0D1117] rounded-lg p-3 grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <span className="text-[10px] text-[#8B949E] block">Played</span>
                      <span className="text-sm font-bold font-mono text-[#E6EDF3]">{autoBetPlayed}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-[#8B949E] block">Profit</span>
                      <span className={cn(
                        'text-sm font-bold font-mono',
                        autoBetSessionProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
                      )}>
                        {autoBetSessionProfit >= 0 ? '+' : ''}{formatCurrency(autoBetSessionProfit, currency)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button - Lime "Flip Coin" */}
        {betMode === 'auto' ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={!isAuthenticated || (gamePhase === 'flipping' && !autoBetRunning)}
            onClick={toggleAutoBet}
            className={cn(
              'w-full py-3.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-base',
              autoBetRunning
                ? 'bg-[#EF4444]/20 hover:bg-[#EF4444]/30 border border-[#EF4444]/40 text-[#EF4444]'
                : !isAuthenticated
                ? 'bg-[#2D333B] text-white cursor-not-allowed opacity-50'
                : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]',
            )}
          >
            {autoBetRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-[#EF4444]/30 border-t-[#EF4444] rounded-full animate-spin" />
                Stop Auto Bet
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {isAuthenticated ? 'Start Auto Bet' : 'Login to Play'}
              </>
            )}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={!isAuthenticated || gamePhase === 'flipping'}
            onClick={() => handleFlip()}
            className={cn(
              'w-full py-3.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-base relative overflow-hidden',
              gamePhase === 'flipping'
                ? 'bg-[#2D333B] text-white cursor-not-allowed opacity-50'
                : !isAuthenticated
                ? 'bg-[#2D333B] text-white cursor-not-allowed opacity-50'
                : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]',
            )}
          >
            {gamePhase === 'flipping' ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Flipping...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-black">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M12 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {isAuthenticated
                  ? gamePhase === 'result' ? 'Flip Again' : 'Flip Coin'
                  : 'Login to Play'}
              </>
            )}
          </motion.button>
        )}

        {/* History Strip */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#8B949E] text-sm">Recent Results</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#10B981] font-mono font-bold">{totalWins}W</span>
                <span className="text-[#30363D]">|</span>
                <span className="text-[#EF4444] font-mono font-bold">{totalLosses}L</span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {history.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: i === 0 ? 0.1 : 0 }}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all',
                    h.result === 'heads'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-gray-400/15 text-gray-300 border border-gray-400/30',
                    h.won && 'ring-1 ring-[#10B981]/50',
                    !h.won && 'opacity-50',
                  )}
                  title={`${h.choice.toUpperCase()} -> ${h.result.toUpperCase()}: ${h.won ? 'Win' : 'Loss'}`}
                >
                  {h.result === 'heads' ? 'H' : 'T'}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Session Stats */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#8B949E] text-sm">Win Rate</span>
                <span className="text-xs font-mono font-bold text-[#E6EDF3]">
                  {history.length > 0 ? ((totalWins / history.length) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#0D1117] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#10B981] transition-all duration-500"
                  style={{ width: `${history.length > 0 ? (totalWins / history.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#8B949E] text-sm">Net Profit</span>
                {(() => {
                  const net = history.reduce((s, h) => s + h.profit, 0);
                  return (
                    <span className={cn(
                      'text-xs font-mono font-bold',
                      net >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
                    )}>
                      {net >= 0 ? '+' : ''}{formatCurrency(net, currency)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        {/* Left icons */}
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <button onClick={() => setShowFairness(!showFairness)} className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

        {/* Center balance */}
        <span className="text-sm font-mono text-white">
          {formatCurrency(currentBalance, currency)} {currency}
        </span>

        {/* Right - Provably Fair Game badge */}
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>

      {/* Provably Fair Panel (shown when info tapped) */}
      <AnimatePresence>
        {showFairness && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 mt-3"
          >
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 mb-20">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-sm font-bold text-[#E6EDF3]">Provably Fair</span>
              </div>
              {lastFairness ? (
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] text-[#8B949E] uppercase">Server Seed Hash</span>
                    <p className="text-xs font-mono text-[#E6EDF3] bg-[#0D1117] rounded-lg px-3 py-2 mt-1 break-all">
                      {lastFairness.serverSeedHash}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[#8B949E] uppercase">Client Seed</span>
                      <p className="text-xs font-mono text-[#E6EDF3] bg-[#0D1117] rounded-lg px-3 py-2 mt-1">
                        {lastFairness.clientSeed}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8B949E] uppercase">Nonce</span>
                      <p className="text-xs font-mono text-[#E6EDF3] bg-[#0D1117] rounded-lg px-3 py-2 mt-1">
                        {lastFairness.nonce}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#8B949E]">Play a round to see fairness data.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shimmer keyframes */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
