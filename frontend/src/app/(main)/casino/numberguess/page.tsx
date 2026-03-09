'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ChevronDown,
  History,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Target,
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

interface NumberGuessApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    guess: number;
    target: number;
    distance: number;
    tier: string;
    tierLabel: string;
    multiplier: number;
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
  guess: number;
  target: number;
  distance: number;
  tier: string;
  tierLabel: string;
  won: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];
const HOUSE_EDGE = 0.04;

const TIER_CONFIG = [
  { tier: 'exact', label: 'Exact', distance: 0, multiplier: 95, color: '#FFD700', bgColor: 'rgba(255,215,0,0.15)', borderColor: 'rgba(255,215,0,0.4)' },
  { tier: 'close', label: 'Within 5', distance: 5, multiplier: 9, color: '#10B981', bgColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)' },
  { tier: 'near', label: 'Within 10', distance: 10, multiplier: 4, color: '#3B82F6', bgColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' },
  { tier: 'warm', label: 'Within 25', distance: 25, multiplier: 1.5, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' },
  { tier: 'miss', label: 'Miss', distance: 100, multiplier: 0, color: '#EF4444', bgColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
];

function getTierForDistance(distance: number) {
  for (const t of TIER_CONFIG) {
    if (distance <= t.distance) return t;
  }
  return TIER_CONFIG[TIER_CONFIG.length - 1];
}

// ---------------------------------------------------------------------------
// Number Guess Game Page
// ---------------------------------------------------------------------------

export default function NumberGuessPage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [guess, setGuess] = useState(50);
  const [betAmount, setBetAmount] = useState('1.00');
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<NumberGuessApiResponse['result'] | null>(null);
  const [lastProfit, setLastProfit] = useState(0);
  const [history, setHistory] = useState<GameRound[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [lastFairness, setLastFairness] = useState<NumberGuessApiResponse['fairness'] | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual');

  // Animation state
  const [scrollingNumber, setScrollingNumber] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [resultScale, setResultScale] = useState(1);

  // Refs
  const isPlayingRef = useRef(false);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup spin interval on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  // Init bet amount
  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  // Close currency dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Clear flash
  useEffect(() => {
    if (flashColor) {
      const t = setTimeout(() => setFlashColor(null), 600);
      return () => clearTimeout(t);
    }
  }, [flashColor]);

  const currentBalance = user?.balances?.find((b) => b.currency === currency)?.available ?? 0;

  // -------------------------------------------------------------------------
  // Play handler
  // -------------------------------------------------------------------------

  const handlePlay = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    setLastResult(null);
    setLastProfit(0);
    setShowResult(false);
    setErrorMessage(null);
    setResultScale(1);

    // Scrolling animation
    let frame = 0;
    const totalFrames = 30;
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    spinIntervalRef.current = setInterval(() => {
      setScrollingNumber(Math.floor(Math.random() * 100) + 1);
      frame++;
      if (frame >= totalFrames) {
        if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
    }, 60);

    try {
      const response = await post<NumberGuessApiResponse>('/casino/games/numberguess/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { guess },
      });

      const elapsed = frame * 60;
      const remaining = Math.max(0, totalFrames * 60 - elapsed);
      await new Promise((r) => setTimeout(r, remaining));
      if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null; }

      // Slow reveal
      const result = response.result ?? {} as any;
      const target = result.target ?? 50;
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const progress = (i + 1) / steps;
        const interpolated = Math.round(
          scrollingNumber !== null
            ? scrollingNumber + (target - scrollingNumber) * progress
            : target
        );
        setScrollingNumber(Math.max(1, Math.min(100, interpolated)));
        await new Promise((r) => setTimeout(r, 80));
      }

      setScrollingNumber(target);
      await new Promise((r) => setTimeout(r, 200));

      setLastResult(result);
      setLastProfit(response.profit ?? 0);
      setLastFairness(response.fairness);
      setShowResult(true);

      const tier = getTierForDistance(result.distance ?? 100);
      setFlashColor(result.isWin ? tier.color : '#EF4444');

      setResultScale(1.2);
      setTimeout(() => setResultScale(1), 300);

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      const round: GameRound = {
        id: response.roundId,
        guess: result.guess ?? guess,
        target: result.target ?? 50,
        distance: result.distance ?? 100,
        tier: result.tier ?? 0,
        tierLabel: result.tierLabel ?? '',
        won: result.isWin ?? false,
        betAmount: parseFloat(betAmount),
        payout: response.payout ?? 0,
        profit: response.profit ?? 0,
        multiplier: response.multiplier ?? 0,
        timestamp: new Date(),
      };
      setHistory((prev) => [round, ...prev.slice(0, 49)]);

      setIsPlaying(false);
      isPlayingRef.current = false;
    } catch (err: any) {
      if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null; }
      setScrollingNumber(null);
      const errorCode = err?.errors?.code || err?.message || '';
      if (errorCode === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(err?.message || '')) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(err?.message || 'Failed to place bet. Please try again.');
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  }, [guess, betAmount, currency]);

  // Bet amount helpers
  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00000001, val * factor).toFixed(8));
  };

  const setMaxBet = () => {
    setBetAmount(currentBalance.toFixed(8));
  };

  const displayNumber = scrollingNumber;
  const resultTier = lastResult ? getTierForDistance(lastResult.distance) : null;
  const guessPercent = ((guess - 1) / 99) * 100;
  const targetPercent = lastResult ? ((lastResult.target - 1) / 99) * 100 : null;

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Flash overlay */}
      <AnimatePresence>
        {flashColor && (
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50 pointer-events-none"
            style={{ backgroundColor: flashColor }}
          />
        )}
      </AnimatePresence>

      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Error */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Display Card */}
        <motion.div
          className={cn(
            'relative bg-[#161B22] border rounded-2xl overflow-hidden',
            showResult && lastResult?.isWin ? 'border-[#10B981]/50' : '',
            showResult && !lastResult?.isWin ? 'border-[#EF4444]/50' : '',
            !showResult ? 'border-[#30363D]' : '',
          )}
        >
          <AnimatePresence>
            {showResult && lastResult && resultTier && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.08 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
                style={{ backgroundColor: resultTier.color }}
              />
            )}
          </AnimatePresence>

          <div className="relative z-10 px-6 py-10 text-center">
            <div className="mb-2 text-xs uppercase tracking-wider text-[#8B949E] font-medium">
              {isPlaying ? 'Finding number...' : 'Target Number'}
            </div>
            <motion.div
              animate={{ scale: resultScale }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className={cn(
                'text-7xl font-black font-mono tracking-tighter',
                displayNumber === null && !showResult ? 'text-[#30363D]' :
                isPlaying && !showResult ? 'text-[#8B949E]' :
                showResult && resultTier ? '' : 'text-[#30363D]',
              )}
              style={showResult && resultTier ? { color: resultTier.color } : undefined}
            >
              {showResult && lastResult ? lastResult.target : displayNumber !== null ? displayNumber : '?'}
            </motion.div>

            <AnimatePresence>
              {showResult && lastResult && resultTier && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mt-4 space-y-2"
                >
                  <span
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: resultTier.bgColor,
                      color: resultTier.color,
                      border: `1px solid ${resultTier.borderColor}`,
                    }}
                  >
                    <Target className="w-4 h-4" />
                    {lastResult.tierLabel} {lastResult.isWin ? `(${resultTier.multiplier}x)` : ''}
                  </span>
                  <div className="text-sm text-[#8B949E]">
                    Your guess: <span className="font-mono font-bold text-[#E6EDF3]">{lastResult.guess}</span>
                    {' '} | Distance: <span className="font-mono font-bold text-[#E6EDF3]">{lastResult.distance}</span>
                  </div>
                  <span className={cn(
                    'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold',
                    lastResult.isWin ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444]',
                  )}>
                    {lastResult.isWin ? (
                      <><TrendingUp className="w-4 h-4" />+{formatCurrency(lastProfit, currency)}</>
                    ) : (
                      <><TrendingDown className="w-4 h-4" />-{formatCurrency(parseFloat(betAmount), currency)}</>
                    )}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Guess Input -- Slider + Number */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-4">
          {/* Number line visualization */}
          <div className="relative h-14">
            <div className="absolute top-6 left-0 right-0 h-2 rounded-full bg-[#1C2128]" />

            {lastResult && (
              <>
                <div className="absolute top-6 h-2 rounded-full" style={{
                  left: `${Math.max(0, ((lastResult.target - 1) / 99) * 100 - 0.5)}%`,
                  width: '1%',
                  backgroundColor: 'rgba(255,215,0,0.5)',
                }} />
                <div className="absolute top-6 h-2" style={{
                  left: `${Math.max(0, ((Math.max(1, lastResult.target - 5) - 1) / 99) * 100)}%`,
                  width: `${(Math.min(10, (lastResult.target + 5 > 100 ? 100 - lastResult.target + 5 : 10) + (lastResult.target - 5 < 1 ? 5 - lastResult.target + 1 : 0)) / 99) * 100}%`,
                  backgroundColor: 'rgba(16,185,129,0.2)',
                }} />
                <div className="absolute top-6 h-2" style={{
                  left: `${Math.max(0, ((Math.max(1, lastResult.target - 10) - 1) / 99) * 100)}%`,
                  width: `${(Math.min(20, (lastResult.target + 10 > 100 ? 100 - lastResult.target + 10 : 20) + (lastResult.target - 10 < 1 ? 10 - lastResult.target + 1 : 0)) / 99) * 100}%`,
                  backgroundColor: 'rgba(59,130,246,0.12)',
                }} />
              </>
            )}

            {/* Guess marker */}
            <motion.div
              className="absolute top-0 z-20"
              style={{ left: `${guessPercent}%` }}
              animate={{ left: `${guessPercent}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="relative -translate-x-1/2">
                <div className="w-5 h-5 rounded-full bg-[#C8FF00] border-2 border-white shadow-lg shadow-[#C8FF00]/40" />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#C8FF00] text-black text-[10px] font-bold font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
                  {guess}
                </div>
              </div>
            </motion.div>

            {/* Target marker */}
            <AnimatePresence>
              {showResult && lastResult && targetPercent !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-0 z-30"
                  style={{ left: `${targetPercent}%` }}
                >
                  <div className="relative -translate-x-1/2">
                    <div className="w-5 h-5 rounded-full border-2 border-white shadow-lg"
                      style={{
                        backgroundColor: resultTier?.color || '#EF4444',
                        boxShadow: `0 0 12px ${resultTier?.color || '#EF4444'}80`,
                      }}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold font-mono px-1.5 py-0.5 rounded whitespace-nowrap"
                      style={{ backgroundColor: resultTier?.color || '#EF4444' }}
                    >
                      {lastResult.target}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Arc connector */}
            {showResult && lastResult && targetPercent !== null && (
              <svg className="absolute top-0 left-0 w-full h-14 pointer-events-none z-10" preserveAspectRatio="none">
                <path
                  d={`M ${guessPercent}% 12 Q ${(guessPercent + targetPercent) / 2}% ${Math.max(-10, 12 - lastResult.distance * 0.4)} ${targetPercent}% 12`}
                  stroke={resultTier?.color || '#8B949E'}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="4 4"
                  opacity={0.5}
                />
              </svg>
            )}

            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0 text-[10px] text-[#484F58] font-mono">
              <span>1</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          {/* Slider + input */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium">Your Guess</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={guess}
                onChange={(e) => setGuess(parseInt(e.target.value))}
                disabled={isPlaying}
                className="flex-1 h-2 bg-[#1C2128] rounded-full appearance-none cursor-pointer accent-[#C8FF00] [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#C8FF00] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#C8FF00]/30 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={guess}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= 100) setGuess(val);
                }}
                disabled={isPlaying}
                className="w-20 h-10 bg-[#161B22] border border-[#30363D] rounded-lg px-3 text-center text-lg font-bold font-mono text-[#C8FF00] focus:outline-none focus:border-[#C8FF00] transition-colors"
              />
            </div>
            {/* Quick pick */}
            <div className="flex gap-1.5">
              {[10, 25, 50, 75, 90].map((n) => (
                <button
                  key={n}
                  onClick={() => setGuess(n)}
                  disabled={isPlaying}
                  className={cn(
                    'flex-1 h-8 rounded-md text-xs font-bold transition-colors',
                    guess === n
                      ? 'bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30'
                      : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58]',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payout Tiers */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[#8B949E] font-medium mb-3">Payout Tiers</div>
          <div className="grid grid-cols-5 gap-1.5">
            {TIER_CONFIG.map((tier) => (
              <div
                key={tier.tier}
                className={cn(
                  'rounded-lg p-2 text-center border transition-all',
                  showResult && lastResult && getTierForDistance(lastResult.distance).tier === tier.tier
                    ? 'ring-2 scale-105' : '',
                )}
                style={{
                  backgroundColor: tier.bgColor,
                  borderColor: tier.borderColor,
                  ...(showResult && lastResult && getTierForDistance(lastResult.distance).tier === tier.tier
                    ? { ringColor: tier.color, boxShadow: `0 0 16px ${tier.color}40` } : {}),
                }}
              >
                <div className="text-base font-black font-mono" style={{ color: tier.color }}>
                  {tier.multiplier > 0 ? `${tier.multiplier}x` : '0x'}
                </div>
                <div className="text-[10px] text-[#8B949E] mt-0.5 font-medium">{tier.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bet Amount Control */}
        <div className="space-y-2">
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center">
            <span className="text-[#8B949E] text-xs ml-3">{currency}</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={isPlaying}
              className="flex-1 bg-transparent text-white font-mono text-sm text-center outline-none disabled:opacity-50"
              step="any"
            />
            <div className="flex items-center gap-1 mr-2">
              <button onClick={() => adjustBet(0.5)} disabled={isPlaying}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => adjustBet(2)} disabled={isPlaying}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Quick presets row */}
          <div className="flex gap-1.5">
            {['0.01', '0.1', '1', '10', '100'].map((v) => (
              <button key={v} onClick={() => setBetAmount(v)} disabled={isPlaying}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30">
                {v}
              </button>
            ))}
            <button onClick={() => adjustBet(0.5)} disabled={isPlaying}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30">
              1/2
            </button>
            <button onClick={() => adjustBet(2)} disabled={isPlaying}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30">
              2X
            </button>
          </div>
        </div>

        {/* GUESS Button -- Lime CTA */}
        <motion.button
          disabled={!isAuthenticated || isPlaying}
          onClick={handlePlay}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all',
            (isPlaying || !isAuthenticated) && 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed',
          )}
        >
          {isPlaying ? 'GUESSING...' : isAuthenticated ? 'GUESS' : 'Login to Play'}
        </motion.button>

        {/* History dots */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-[#8B949E]" />
                <span className="text-xs font-medium text-[#8B949E]">Recent Games</span>
              </div>
              <button onClick={() => setHistory([])} className="text-[10px] text-[#484F58] hover:text-[#8B949E] flex items-center gap-1 transition-colors">
                <RotateCcw className="w-2.5 h-2.5" /> Clear
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {history.slice(0, 20).map((round, i) => {
                const tier = getTierForDistance(round.distance);
                return (
                  <motion.div
                    key={round.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.02, type: 'spring', stiffness: 400 }}
                    className="group relative"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono cursor-default transition-all border"
                      style={{ backgroundColor: tier.bgColor, borderColor: tier.borderColor, color: tier.color }}
                    >
                      {round.distance}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                      <div className="bg-[#1C2128] border border-[#30363D] rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-xl">
                        <div className="text-[#E6EDF3] font-mono">Guess: {round.guess} | Target: {round.target}</div>
                        <div className="text-[#8B949E]">{round.tierLabel} (d={round.distance})</div>
                        <div className={cn('font-bold', round.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                          {round.won ? `+${formatCurrency(round.profit, currency)}` : `-${formatCurrency(round.betAmount, currency)}`}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Provably Fair */}
        <AnimatePresence>
          {showFairness && lastFairness && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C8FF00]" />
                  <span className="text-sm font-semibold text-[#E6EDF3]">Provably Fair</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Server Seed Hash</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">{lastFairness.serverSeedHash}</div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Client Seed</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">{lastFairness.clientSeed}</div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Nonce</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E]">{lastFairness.nonce}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E] hover:text-white transition-colors">
            <Home className="w-5 h-5" />
          </Link>
          <button onClick={() => setShowFairness(!showFairness)} className="text-[#8B949E] hover:text-white transition-colors">
            <Info className="w-5 h-5" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E] hover:text-white transition-colors">
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-[#8B949E]">Balance</div>
          <div className="text-sm font-mono font-bold text-[#E6EDF3]">{formatCurrency(currentBalance, currency)}</div>
        </div>
        <div className="bg-[#21262D] border border-[#30363D] rounded-full px-3 py-1">
          <span className="text-[10px] text-[#8B949E] font-medium">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
