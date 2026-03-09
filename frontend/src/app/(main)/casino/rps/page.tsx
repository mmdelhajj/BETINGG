'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  History,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Zap,
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

type RPSChoice = 'rock' | 'paper' | 'scissors';
type RPSOutcome = 'win' | 'lose' | 'tie';
type GamePhase = 'idle' | 'shaking' | 'result';

interface RPSApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    playerChoice: RPSChoice;
    houseChoice: RPSChoice;
    outcome: RPSOutcome;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance?: number;
}

interface GameHistory {
  id: string;
  playerChoice: RPSChoice;
  houseChoice: RPSChoice;
  outcome: RPSOutcome;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  timestamp: Date;
  fairness?: RPSApiResponse['fairness'];
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];
const WIN_MULTIPLIER = 2.82;
const HOUSE_EDGE = 0.06;

const CHOICE_CONFIG: Record<RPSChoice, { icon: string; label: string }> = {
  rock: { icon: '\u270A', label: 'Rock' },
  paper: { icon: '\u270B', label: 'Paper' },
  scissors: { icon: '\u270C\uFE0F', label: 'Scissors' },
};

const SHAKE_EMOJIS = ['\u270A', '\u270B', '\u270C\uFE0F'];

// ---------------------------------------------------------------------------
// RPS Game Page
// ---------------------------------------------------------------------------

export default function RPSGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [selectedChoice, setSelectedChoice] = useState<RPSChoice>('rock');
  const [betAmount, setBetAmount] = useState('1.00');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [playerRevealed, setPlayerRevealed] = useState<RPSChoice | null>(null);
  const [houseRevealed, setHouseRevealed] = useState<RPSChoice | null>(null);
  const [outcome, setOutcome] = useState<RPSOutcome | null>(null);
  const [lastProfit, setLastProfit] = useState<number>(0);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakeIndex, setShakeIndex] = useState(0);
  const [showFairness, setShowFairness] = useState(false);
  const [lastFairness, setLastFairness] = useState<RPSApiResponse['fairness'] | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showAutoBet, setShowAutoBet] = useState(false);
  const [flashColor, setFlashColor] = useState<'green' | 'red' | 'yellow' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairnessPanel, setShowFairnessPanel] = useState(false);
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual');

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
  const shakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize bet amount on currency change
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

  // Clear flash effect
  useEffect(() => {
    if (flashColor) {
      const t = setTimeout(() => setFlashColor(null), 600);
      return () => clearTimeout(t);
    }
  }, [flashColor]);

  // Cleanup shake timer on unmount
  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearInterval(shakeTimerRef.current);
    };
  }, []);

  // Current balance
  const currentBalance = user?.balances?.find((b) => b.currency === currency)?.available ?? 0;

  // -------------------------------------------------------------------------
  // Play handler
  // -------------------------------------------------------------------------

  const handlePlay = useCallback(async (autoBetAmountOverride?: string) => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    const playBetAmount = autoBetAmountOverride || betAmount;

    setGamePhase('shaking');
    setPlayerRevealed(null);
    setHouseRevealed(null);
    setOutcome(null);
    setLastProfit(0);
    setLastPayout(0);
    setErrorMessage(null);

    let shakeCycle = 0;
    shakeTimerRef.current = setInterval(() => {
      setShakeIndex(shakeCycle % 3);
      shakeCycle++;
    }, 200);

    try {
      const response = await post<RPSApiResponse>('/casino/games/rps/play', {
        amount: parseFloat(playBetAmount),
        currency,
        options: { choice: selectedChoice },
      });

      const minShakeTime = 1200;
      await new Promise((r) => setTimeout(r, minShakeTime));

      if (shakeTimerRef.current) {
        clearInterval(shakeTimerRef.current);
        shakeTimerRef.current = null;
      }

      const {
        result: { playerChoice, houseChoice, outcome: gameOutcome },
        payout,
        profit,
        multiplier,
        fairness,
      } = response;

      setPlayerRevealed(playerChoice);
      await new Promise((r) => setTimeout(r, 400));

      setHouseRevealed(houseChoice);
      setOutcome(gameOutcome);
      setLastProfit(profit);
      setLastPayout(payout);
      setLastFairness(fairness);
      setGamePhase('result');

      if (gameOutcome === 'win') setFlashColor('green');
      else if (gameOutcome === 'lose') setFlashColor('red');
      else setFlashColor('yellow');

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      const round: GameHistory = {
        id: response.roundId,
        playerChoice,
        houseChoice,
        outcome: gameOutcome,
        betAmount: parseFloat(playBetAmount),
        payout,
        profit,
        multiplier,
        timestamp: new Date(),
        fairness,
      };
      setHistory((prev) => [round, ...prev.slice(0, 19)]);

      isPlayingRef.current = false;
      return { won: gameOutcome === 'win', profit };
    } catch (err: any) {
      if (shakeTimerRef.current) {
        clearInterval(shakeTimerRef.current);
        shakeTimerRef.current = null;
      }

      const errorCode = err?.errors?.code || err?.message || '';
      if (errorCode === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(err?.message || '')) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(err?.message || 'Failed to place bet. Please try again.');
      }

      setGamePhase('idle');
      isPlayingRef.current = false;
      return null;
    }
  }, [selectedChoice, betAmount, currency]);

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
      const result = await handlePlay(currentBet);
      if (!result) break;

      count++;
      totalProfit += result.profit;
      setAutoBetCount(count);
      setAutoBetProfit(totalProfit);

      if (autoBet.stopOnProfit > 0 && totalProfit >= autoBet.stopOnProfit) break;
      if (autoBet.stopOnLoss > 0 && totalProfit <= -autoBet.stopOnLoss) break;

      if (result.won) {
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
      await new Promise((r) => setTimeout(r, 500));
    }

    autoBetRef.current = false;
    setAutoBetRunning(false);
  }, [isAuthenticated, autoBetRunning, autoBet, betAmount, handlePlay]);

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

  const setMaxBet = () => {
    setBetAmount(currentBalance.toFixed(8));
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const getHandDisplay = (side: 'player' | 'house', revealed: RPSChoice | null) => {
    const isShaking = gamePhase === 'shaking';
    const isIdle = gamePhase === 'idle';

    if (isShaking) return SHAKE_EMOJIS[shakeIndex];
    if (revealed) return CHOICE_CONFIG[revealed].icon;
    if (side === 'player' && isIdle) return CHOICE_CONFIG[selectedChoice].icon;
    return '?';
  };

  const getHandLabel = (side: 'player' | 'house', revealed: RPSChoice | null) => {
    if (gamePhase === 'shaking') return '...';
    if (revealed) return CHOICE_CONFIG[revealed].label;
    if (side === 'player' && gamePhase === 'idle') return CHOICE_CONFIG[selectedChoice].label;
    return 'Waiting';
  };

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
            className={cn(
              'fixed inset-0 z-50 pointer-events-none',
              flashColor === 'green' ? 'bg-[#10B981]' : flashColor === 'red' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]',
            )}
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

        {/* VS Arena */}
        <motion.div
          className={cn(
            'relative bg-[#161B22] border rounded-2xl overflow-hidden',
            outcome === 'win' ? 'border-[#10B981]/50' : outcome === 'lose' ? 'border-[#EF4444]/50' : outcome === 'tie' ? 'border-[#F59E0B]/50' : 'border-[#30363D]',
          )}
        >
          {/* Background glow */}
          <AnimatePresence>
            {outcome && gamePhase === 'result' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.06 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'absolute inset-0',
                  outcome === 'win' ? 'bg-[#10B981]' : outcome === 'lose' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]',
                )}
              />
            )}
          </AnimatePresence>

          <div className="relative z-10 px-4 py-10">
            <div className="flex items-center justify-center gap-4">
              {/* Player */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#8B949E] font-bold">YOU</span>
                <motion.div
                  animate={
                    gamePhase === 'shaking'
                      ? { y: [0, -16, 0], rotate: [0, -5, 5, 0] }
                      : playerRevealed
                        ? { scale: [0.8, 1.15, 1] }
                        : {}
                  }
                  transition={
                    gamePhase === 'shaking'
                      ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.4 }
                  }
                  className={cn(
                    'w-24 h-24 rounded-2xl flex items-center justify-center text-5xl border-2 transition-all',
                    outcome === 'win' && gamePhase === 'result'
                      ? 'border-[#10B981] bg-[#10B981]/10 shadow-lg shadow-[#10B981]/20'
                      : outcome === 'lose' && gamePhase === 'result'
                        ? 'border-[#EF4444] bg-[#EF4444]/10'
                        : outcome === 'tie' && gamePhase === 'result'
                          ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                          : gamePhase === 'shaking'
                            ? 'border-[#C8FF00]/30 bg-[#C8FF00]/5'
                            : 'border-[#30363D] bg-[#1C2128]',
                  )}
                >
                  <span className="select-none">{getHandDisplay('player', playerRevealed)}</span>
                </motion.div>
                <span className="text-xs font-semibold text-[#8B949E]">{getHandLabel('player', playerRevealed)}</span>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center">
                <motion.span
                  animate={gamePhase === 'shaking' ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className={cn(
                    'text-2xl font-black',
                    gamePhase === 'shaking' ? 'text-[#C8FF00]' :
                    outcome === 'win' ? 'text-[#10B981]' :
                    outcome === 'lose' ? 'text-[#EF4444]' :
                    outcome === 'tie' ? 'text-[#F59E0B]' :
                    'text-[#30363D]',
                  )}
                >
                  VS
                </motion.span>
              </div>

              {/* House */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#8B949E] font-bold">HOUSE</span>
                <motion.div
                  animate={
                    gamePhase === 'shaking'
                      ? { y: [0, -16, 0], rotate: [0, 5, -5, 0] }
                      : houseRevealed
                        ? { scale: [0.8, 1.15, 1] }
                        : {}
                  }
                  transition={
                    gamePhase === 'shaking'
                      ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.4 }
                  }
                  className={cn(
                    'w-24 h-24 rounded-2xl flex items-center justify-center text-5xl border-2 transition-all',
                    outcome === 'lose' && gamePhase === 'result'
                      ? 'border-[#10B981] bg-[#10B981]/10 shadow-lg shadow-[#10B981]/20'
                      : outcome === 'win' && gamePhase === 'result'
                        ? 'border-[#EF4444] bg-[#EF4444]/10'
                        : outcome === 'tie' && gamePhase === 'result'
                          ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                          : gamePhase === 'shaking'
                            ? 'border-[#C8FF00]/30 bg-[#C8FF00]/5'
                            : 'border-[#30363D] bg-[#1C2128]',
                  )}
                >
                  <span className="select-none">{getHandDisplay('house', houseRevealed)}</span>
                </motion.div>
                <span className="text-xs font-semibold text-[#8B949E]">{getHandLabel('house', houseRevealed)}</span>
              </div>
            </div>

            {/* Outcome Banner */}
            <AnimatePresence>
              {outcome && gamePhase === 'result' && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                  className="mt-6 text-center"
                >
                  <span className={cn(
                    'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-extrabold tracking-wide',
                    outcome === 'win' ? 'bg-[#10B981]/15 text-[#10B981]' :
                    outcome === 'lose' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                    'bg-[#F59E0B]/15 text-[#F59E0B]',
                  )}>
                    {outcome === 'win' ? 'YOU WIN!' : outcome === 'lose' ? 'YOU LOSE' : 'TIE - BET RETURNED'}
                  </span>
                  {outcome === 'win' && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-sm font-bold font-mono text-[#10B981] mt-2"
                    >
                      +{formatCurrency(lastProfit, currency)}
                    </motion.p>
                  )}
                  {outcome === 'tie' && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-xs text-[#F59E0B]/80 mt-1.5"
                    >
                      Your bet has been returned
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Hand Selection Buttons -- large icons */}
        <div className="grid grid-cols-3 gap-3">
          {(['rock', 'paper', 'scissors'] as RPSChoice[]).map((choice) => {
            const config = CHOICE_CONFIG[choice];
            const isSelected = selectedChoice === choice;
            const isDisabled = gamePhase === 'shaking';
            return (
              <motion.button
                key={choice}
                whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                onClick={() => !isDisabled && setSelectedChoice(choice)}
                disabled={isDisabled}
                className={cn(
                  'relative h-24 rounded-xl font-semibold text-sm transition-all duration-200 flex flex-col items-center justify-center gap-2 border-2',
                  isSelected
                    ? 'border-[#C8FF00] bg-[#C8FF00]/10 shadow-lg shadow-[#C8FF00]/10'
                    : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-[#484F58] hover:text-[#E6EDF3]',
                  isDisabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <span className="text-4xl select-none">{config.icon}</span>
                <span className={cn('text-xs font-bold', isSelected ? 'text-[#C8FF00]' : 'text-[#8B949E]')}>
                  {config.label}
                </span>
                {isSelected && (
                  <motion.div
                    layoutId="rps-ring"
                    className="absolute inset-0 rounded-xl border-2 border-[#C8FF00]"
                    style={{ boxShadow: '0 0 20px 2px rgba(200,255,0,0.15)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Payout Info Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-0.5">Win</span>
            <p className="text-base font-bold font-mono text-[#10B981]">{WIN_MULTIPLIER}x</p>
          </div>
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-0.5">Tie</span>
            <p className="text-base font-bold font-mono text-[#F59E0B]">1.00x</p>
          </div>
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-0.5">Lose</span>
            <p className="text-base font-bold font-mono text-[#EF4444]">0x</p>
          </div>
        </div>

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setBetMode('manual')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              betMode === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]'
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setBetMode('auto')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              betMode === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]'
            )}
          >
            Auto
          </button>
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
              disabled={gamePhase === 'shaking' || autoBetRunning}
              className="flex-1 bg-transparent text-white font-mono text-sm text-center outline-none disabled:opacity-50"
              step="any"
            />
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => adjustBet(0.5)}
                disabled={gamePhase === 'shaking' || autoBetRunning}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => adjustBet(2)}
                disabled={gamePhase === 'shaking' || autoBetRunning}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Quick presets row */}
          <div className="flex gap-1.5">
            {['0.01', '0.1', '1', '10', '100'].map((v) => (
              <button
                key={v}
                onClick={() => setBetAmount(v)}
                disabled={gamePhase === 'shaking' || autoBetRunning}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30"
              >
                {v}
              </button>
            ))}
            <button
              onClick={() => adjustBet(0.5)}
              disabled={gamePhase === 'shaking' || autoBetRunning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30"
            >
              1/2
            </button>
            <button
              onClick={() => adjustBet(2)}
              disabled={gamePhase === 'shaking' || autoBetRunning}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30"
            >
              2X
            </button>
          </div>
        </div>

        {/* PLAY Button -- Lime CTA */}
        {!autoBetRunning ? (
          <motion.button
            disabled={!isAuthenticated || gamePhase === 'shaking'}
            onClick={() => handlePlay()}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all',
              (gamePhase === 'shaking' || !isAuthenticated) && 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed',
            )}
          >
            {gamePhase === 'shaking'
              ? 'Playing...'
              : gamePhase === 'result'
                ? 'PLAY AGAIN'
                : isAuthenticated
                  ? 'PLAY'
                  : 'Login to Play'}
          </motion.button>
        ) : (
          <motion.button
            onClick={stopAutoBet}
            whileTap={{ scale: 0.98 }}
            className="bg-[#EF4444] text-white font-bold py-3.5 rounded-xl w-full text-base"
          >
            Stop Auto-Bet ({autoBetCount}/{autoBet.numberOfBets})
          </motion.button>
        )}

        {/* Auto-Bet Card */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAutoBet(!showAutoBet)}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#1C2128] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#C8FF00]" />
              <span className="text-sm font-semibold text-[#E6EDF3]">Auto Bet</span>
              {autoBetRunning && (
                <span className="text-[10px] bg-[#10B981]/15 text-[#10B981] px-2 py-0.5 rounded-full font-bold">RUNNING</span>
              )}
            </div>
            {showAutoBet ? <ChevronUp className="w-4 h-4 text-[#8B949E]" /> : <ChevronDown className="w-4 h-4 text-[#8B949E]" />}
          </button>
          <AnimatePresence>
            {showAutoBet && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3 border-t border-[#30363D]">
                  <div className="pt-3" />
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-1">Number of Bets</label>
                    <input
                      type="number"
                      value={autoBet.numberOfBets}
                      onChange={(e) => setAutoBet((p) => ({ ...p, numberOfBets: Math.max(1, parseInt(e.target.value) || 1) }))}
                      disabled={autoBetRunning}
                      className="w-full h-9 bg-[#161B22] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#C8FF00]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-1">Stop Profit</label>
                      <input
                        type="number"
                        value={autoBet.stopOnProfit || ''}
                        placeholder="0"
                        onChange={(e) => setAutoBet((p) => ({ ...p, stopOnProfit: parseFloat(e.target.value) || 0 }))}
                        disabled={autoBetRunning}
                        className="w-full h-9 bg-[#161B22] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#C8FF00]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-1">Stop Loss</label>
                      <input
                        type="number"
                        value={autoBet.stopOnLoss || ''}
                        placeholder="0"
                        onChange={(e) => setAutoBet((p) => ({ ...p, stopOnLoss: parseFloat(e.target.value) || 0 }))}
                        disabled={autoBetRunning}
                        className="w-full h-9 bg-[#161B22] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#C8FF00]"
                      />
                    </div>
                  </div>
                  {/* On Win */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-1.5">On Win</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setAutoBet((p) => ({ ...p, onWin: 'reset' }))}
                        disabled={autoBetRunning}
                        className={cn(
                          'flex-1 h-8 rounded-md text-xs font-bold transition-colors',
                          autoBet.onWin === 'reset'
                            ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                            : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E]',
                        )}
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => setAutoBet((p) => ({ ...p, onWin: 'increase' }))}
                        disabled={autoBetRunning}
                        className={cn(
                          'flex-1 h-8 rounded-md text-xs font-bold transition-colors',
                          autoBet.onWin === 'increase'
                            ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                            : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E]',
                        )}
                      >
                        Increase
                      </button>
                      {autoBet.onWin === 'increase' && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={autoBet.onWinIncrease}
                            onChange={(e) => setAutoBet((p) => ({ ...p, onWinIncrease: parseFloat(e.target.value) || 0 }))}
                            disabled={autoBetRunning}
                            className="w-16 h-8 bg-[#161B22] border border-[#30363D] rounded-md px-2 text-xs font-mono text-[#E6EDF3] focus:outline-none"
                          />
                          <span className="text-[10px] text-[#8B949E]">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* On Loss */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] font-medium block mb-1.5">On Loss</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setAutoBet((p) => ({ ...p, onLoss: 'reset' }))}
                        disabled={autoBetRunning}
                        className={cn(
                          'flex-1 h-8 rounded-md text-xs font-bold transition-colors',
                          autoBet.onLoss === 'reset'
                            ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                            : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E]',
                        )}
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => setAutoBet((p) => ({ ...p, onLoss: 'increase' }))}
                        disabled={autoBetRunning}
                        className={cn(
                          'flex-1 h-8 rounded-md text-xs font-bold transition-colors',
                          autoBet.onLoss === 'increase'
                            ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                            : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E]',
                        )}
                      >
                        Increase
                      </button>
                      {autoBet.onLoss === 'increase' && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={autoBet.onLossIncrease}
                            onChange={(e) => setAutoBet((p) => ({ ...p, onLossIncrease: parseFloat(e.target.value) || 0 }))}
                            disabled={autoBetRunning}
                            className="w-16 h-8 bg-[#161B22] border border-[#30363D] rounded-md px-2 text-xs font-mono text-[#E6EDF3] focus:outline-none"
                          />
                          <span className="text-[10px] text-[#8B949E]">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Auto-bet progress */}
                  {autoBetRunning && (
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8B949E]">Bets placed</span>
                        <span className="font-mono text-[#E6EDF3]">{autoBetCount} / {autoBet.numberOfBets}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8B949E]">Total profit</span>
                        <span className={cn('font-mono font-bold', autoBetProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                          {autoBetProfit >= 0 ? '+' : ''}{formatCurrency(autoBetProfit, currency)}
                        </span>
                      </div>
                      <div className="w-full bg-[#1C2128] rounded-full h-1.5 mt-1">
                        <div
                          className="bg-[#C8FF00] h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (autoBetCount / autoBet.numberOfBets) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {/* Start auto-bet */}
                  {!autoBetRunning && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={startAutoBet}
                      disabled={!isAuthenticated || gamePhase === 'shaking'}
                      className={cn(
                        'w-full h-11 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors',
                        !isAuthenticated
                          ? 'bg-[#30363D] text-[#8B949E] cursor-not-allowed'
                          : 'bg-[#C8FF00] hover:bg-[#D4FF33] text-black',
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
        </div>

        {/* History dots */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-[#8B949E]" />
                <span className="text-xs font-medium text-[#8B949E]">Recent Games</span>
                <span className="text-[10px] bg-[#1C2128] text-[#8B949E] px-1.5 py-0.5 rounded-full">{history.length}</span>
              </div>
              <button
                onClick={() => setHistory([])}
                className="text-[10px] text-[#484F58] hover:text-[#8B949E] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Clear
              </button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {history.slice(0, 20).map((round, i) => (
                <motion.div
                  key={round.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.02, type: 'spring', stiffness: 400 }}
                  className="group relative"
                >
                  <div className={cn(
                    'h-9 px-1.5 rounded-lg flex items-center justify-center gap-0.5 text-sm cursor-default transition-all border',
                    round.outcome === 'win'
                      ? 'bg-[#10B981]/15 border-[#10B981]/30'
                      : round.outcome === 'lose'
                        ? 'bg-[#EF4444]/15 border-[#EF4444]/30'
                        : 'bg-[#F59E0B]/15 border-[#F59E0B]/30',
                  )}>
                    <span className="text-xs">{CHOICE_CONFIG[round.playerChoice].icon}</span>
                    <span className="text-[8px] text-[#484F58]">vs</span>
                    <span className="text-xs">{CHOICE_CONFIG[round.houseChoice].icon}</span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                    <div className="bg-[#1C2128] border border-[#30363D] rounded-lg px-3 py-2 text-[10px] whitespace-nowrap shadow-xl">
                      <div className="text-[#E6EDF3] font-medium">
                        {CHOICE_CONFIG[round.playerChoice].label} vs {CHOICE_CONFIG[round.houseChoice].label}
                      </div>
                      <div className={cn(
                        'font-bold mt-0.5',
                        round.outcome === 'win' ? 'text-[#10B981]' : round.outcome === 'lose' ? 'text-[#EF4444]' : 'text-[#F59E0B]',
                      )}>
                        {round.outcome === 'win'
                          ? `+${formatCurrency(round.profit, currency)}`
                          : round.outcome === 'lose'
                            ? `-${formatCurrency(round.betAmount, currency)}`
                            : 'Tie (returned)'}
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#30363D]" />
                    </div>
                  </div>
                </motion.div>
              ))}
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
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">
                      {lastFairness.serverSeedHash}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Client Seed</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E] break-all select-all">
                      {lastFairness.clientSeed}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#8B949E] block mb-0.5">Nonce</label>
                    <div className="bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 text-[11px] font-mono text-[#8B949E]">
                      {lastFairness.nonce}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-[#484F58] leading-relaxed">
                  Result [0,1) mapped: 0-0.333 = Rock, 0.333-0.666 = Paper, 0.666-1 = Scissors.
                  Verify at any time by rotating your server seed.
                </p>
              </div>
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
          <button onClick={() => setShowFairness(!showFairness)}>
            <Info className="w-6 h-6 text-[#8B949E]" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="w-6 h-6 text-[#8B949E]" /> : <VolumeX className="w-6 h-6 text-[#8B949E]" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {formatCurrency(currentBalance, currency)}
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
