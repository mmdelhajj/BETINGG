'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Minus,
  Plus,
  Shield,
  History,
  ChevronDown,
  ChevronUp,
  Spade,
  Volume2,
  VolumeX,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Hash,
  Layers,
  Home,
  Info,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FaroApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    drawnCard: CardData;
    bet: 'high' | 'low' | 'match';
    cardValue: number;
    isWin: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface CardData {
  value: number;
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  display: string;
}

interface GameRound {
  id: string;
  drawnCard: CardData;
  bet: 'high' | 'low' | 'match';
  targetValue: number;
  won: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  timestamp: Date;
  fairness?: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

type BetType = 'high' | 'low' | 'match';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];
const QUICK_AMOUNTS = [0.001, 0.01, 0.1, 1, 10];
const BET_PRESETS = [0.01, 0.1, 1, 10, 100];

const CARD_VALUES = [
  { value: 1, label: 'A', name: 'Ace' },
  { value: 2, label: '2', name: 'Two' },
  { value: 3, label: '3', name: 'Three' },
  { value: 4, label: '4', name: 'Four' },
  { value: 5, label: '5', name: 'Five' },
  { value: 6, label: '6', name: 'Six' },
  { value: 7, label: '7', name: 'Seven' },
  { value: 8, label: '8', name: 'Eight' },
  { value: 9, label: '9', name: 'Nine' },
  { value: 10, label: '10', name: 'Ten' },
  { value: 11, label: 'J', name: 'Jack' },
  { value: 12, label: 'Q', name: 'Queen' },
  { value: 13, label: 'K', name: 'King' },
];

const SUIT_SYMBOLS: Record<string, { symbol: string; color: string }> = {
  hearts: { symbol: '\u2665', color: '#EF4444' },
  diamonds: { symbol: '\u2666', color: '#EF4444' },
  clubs: { symbol: '\u2663', color: '#E5E7EB' },
  spades: { symbol: '\u2660', color: '#E5E7EB' },
};

const PAYOUTS = {
  high: 1.9,
  low: 1.9,
  match: 11.0,
};

// ---------------------------------------------------------------------------
// Card Component
// ---------------------------------------------------------------------------

function PlayingCard({
  card,
  isFlipping,
  isRevealed,
  size = 'normal',
  className,
}: {
  card: CardData | null;
  isFlipping?: boolean;
  isRevealed?: boolean;
  size?: 'small' | 'normal' | 'large';
  className?: string;
}) {
  const sizeClasses = {
    small: 'w-12 h-[68px] text-xs',
    normal: 'w-20 h-28 text-base',
    large: 'w-28 h-40 text-xl',
  };

  const suit = card ? SUIT_SYMBOLS[card.suit] : null;
  const valueLabel = card
    ? CARD_VALUES.find((cv) => cv.value === card.value)?.label || card.value.toString()
    : '';

  return (
    <div className={cn('perspective-1000', className)}>
      <motion.div
        animate={{
          rotateY: isFlipping ? [0, 90, 0] : 0,
        }}
        transition={{
          duration: 0.6,
          times: [0, 0.5, 1],
        }}
        className={cn(
          sizeClasses[size],
          'rounded-lg relative',
          'shadow-lg shadow-black/30'
        )}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {card && isRevealed !== false ? (
          <div
            className={cn(
              sizeClasses[size],
              'rounded-lg bg-white border-2 border-gray-200 flex flex-col items-center justify-center relative overflow-hidden'
            )}
          >
            <div
              className="absolute top-1 left-1.5 flex flex-col items-center leading-none"
              style={{ color: suit?.color }}
            >
              <span className="font-bold font-mono" style={{ fontSize: size === 'large' ? '16px' : size === 'normal' ? '14px' : '10px' }}>
                {valueLabel}
              </span>
              <span style={{ fontSize: size === 'large' ? '14px' : size === 'normal' ? '12px' : '8px' }}>
                {suit?.symbol}
              </span>
            </div>

            <span
              style={{
                color: suit?.color,
                fontSize: size === 'large' ? '48px' : size === 'normal' ? '32px' : '20px',
              }}
            >
              {suit?.symbol}
            </span>

            <div
              className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180"
              style={{ color: suit?.color }}
            >
              <span className="font-bold font-mono" style={{ fontSize: size === 'large' ? '16px' : size === 'normal' ? '14px' : '10px' }}>
                {valueLabel}
              </span>
              <span style={{ fontSize: size === 'large' ? '14px' : size === 'normal' ? '12px' : '8px' }}>
                {suit?.symbol}
              </span>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              sizeClasses[size],
              'rounded-lg border-2 border-[#30363D] flex items-center justify-center',
              'bg-gradient-to-br from-[#1C2128] to-[#161B22]'
            )}
          >
            <div className="w-3/4 h-3/4 rounded border border-[#30363D] flex items-center justify-center">
              <div className="text-[#484F58] font-bold" style={{ fontSize: size === 'large' ? '24px' : size === 'normal' ? '16px' : '10px' }}>
                CB
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card Value Selector
// ---------------------------------------------------------------------------

function CardValueSelector({
  selectedValue,
  onSelect,
  disabled,
  remainingCards,
}: {
  selectedValue: number;
  onSelect: (value: number) => void;
  disabled: boolean;
  remainingCards: Record<number, number>;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {CARD_VALUES.map((cv) => {
        const remaining = remainingCards[cv.value] ?? 4;
        const isSelected = selectedValue === cv.value;

        return (
          <motion.button
            key={cv.value}
            whileHover={{ scale: disabled ? 1 : 1.05 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            onClick={() => !disabled && onSelect(cv.value)}
            className={cn(
              'relative flex flex-col items-center p-1.5 rounded-lg border transition-all',
              isSelected
                ? 'bg-[#C8FF00]/10 border-[#C8FF00] shadow-lg shadow-[#C8FF00]/10'
                : 'bg-[#0D1117] border-[#30363D] hover:border-[#484F58]',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className={cn(
              'font-mono font-bold text-sm',
              isSelected ? 'text-[#C8FF00]' : 'text-[#E6EDF3]'
            )}>
              {cv.label}
            </span>
            <div className="flex gap-0.5 mt-0.5">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1 h-1 rounded-full',
                    i < remaining ? 'bg-[#8B949E]' : 'bg-[#21262D]'
                  )}
                />
              ))}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FaroGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [betType, setBetType] = useState<BetType>('high');
  const [selectedCardValue, setSelectedCardValue] = useState(7);
  const [betAmount, setBetAmount] = useState('0.01');
  const [isDealing, setIsDealing] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [lastDrawnCard, setLastDrawnCard] = useState<CardData | null>(null);
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: number; multiplier: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lastFairness, setLastFairness] = useState<FaroApiResponse['fairness'] | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [manualMode, setManualMode] = useState(true);

  // Card tracking
  const [remainingCards, setRemainingCards] = useState<Record<number, number>>(() => {
    const cards: Record<number, number> = {};
    for (let i = 1; i <= 13; i++) {
      cards[i] = 4;
    }
    return cards;
  });
  const totalRemaining = useMemo(
    () => Object.values(remainingCards).reduce((sum, count) => sum + count, 0),
    [remainingCards]
  );

  // Drawn cards history
  const [drawnCards, setDrawnCards] = useState<CardData[]>([]);

  // Game history
  const [gameHistory, setGameHistory] = useState<GameRound[]>([]);

  // Refs
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Balance
  const balance = useMemo(() => {
    if (!user?.balances) return 0;
    const b = user.balances.find((bal) => bal.currency === currency);
    return b?.available ?? 0;
  }, [user, currency]);

  // Adjust bet amount
  const adjustAmount = useCallback((delta: number) => {
    const current = parseFloat(betAmount) || 0;
    const newVal = Math.max(0.001, current + delta);
    setBetAmount(newVal.toFixed(8));
  }, [betAmount]);

  // Reset deck
  const resetDeck = useCallback(() => {
    const cards: Record<number, number> = {};
    for (let i = 1; i <= 13; i++) {
      cards[i] = 4;
    }
    setRemainingCards(cards);
    setDrawnCards([]);
    setLastDrawnCard(null);
    setLastResult(null);
  }, []);

  // Play round
  const playRound = useCallback(async () => {
    if (isDealing) return;

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Invalid bet amount');
      return;
    }
    if (amount > balance) {
      setErrorMessage('Insufficient balance');
      return;
    }
    if (totalRemaining <= 0) {
      setErrorMessage('Deck is empty! Reset to continue.');
      return;
    }

    setErrorMessage(null);
    setIsDealing(true);
    setLastResult(null);

    setIsFlipping(true);

    try {
      const response = await post<FaroApiResponse>('/casino/games/faro/play', {
        amount,
        currency,
        options: {
          bet: betType,
          cardValue: selectedCardValue,
        },
      });

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      await new Promise((resolve) => setTimeout(resolve, 600));

      const drawnCard = response.result?.drawnCard ?? { value: 1, suit: 'spades' as const, display: 'A' };
      setLastDrawnCard(drawnCard);
      setIsFlipping(false);

      setRemainingCards((prev) => ({
        ...prev,
        [drawnCard.value]: Math.max(0, (prev[drawnCard.value] ?? 4) - 1),
      }));

      setDrawnCards((prev) => [drawnCard, ...prev.slice(0, 19)]);

      setLastResult({
        won: response.result?.isWin ?? false,
        payout: response.payout ?? 0,
        multiplier: response.multiplier ?? 0,
      });

      setLastFairness(response.fairness);

      setGameHistory((prev) => [
        {
          id: response.roundId,
          drawnCard,
          bet: betType,
          targetValue: selectedCardValue,
          won: response.result?.isWin ?? false,
          betAmount: response.betAmount ?? 0,
          payout: response.payout ?? 0,
          profit: response.profit ?? 0,
          multiplier: response.multiplier ?? 0,
          timestamp: new Date(),
          fairness: response.fairness,
        },
        ...prev.slice(0, 49),
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to play');
      setIsFlipping(false);
    } finally {
      setIsDealing(false);
    }
  }, [betAmount, balance, betType, selectedCardValue, currency, isDealing, totalRemaining]);

  // Stats
  const stats = useMemo(() => {
    const totalBets = gameHistory.length;
    const wins = gameHistory.filter((g) => g.won).length;
    const totalProfit = gameHistory.reduce((acc, g) => acc + g.profit, 0);
    return { totalBets, wins, totalProfit };
  }, [gameHistory]);

  // Potential payout
  const potentialPayout = useMemo(() => {
    const amount = parseFloat(betAmount) || 0;
    return amount * PAYOUTS[betType];
  }, [betAmount, betType]);

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-sm font-bold tracking-widest text-white">CRYPTOBET</span>
      </div>

      {/* Card display area -- edge-to-edge */}
      <div className="bg-[#161B22] border-b border-[#30363D] p-6">
        <div className="flex flex-col items-center mb-4">
          <div className="text-[10px] text-[#484F58] uppercase tracking-wider mb-3">
            {lastDrawnCard ? 'Last Drawn Card' : 'Draw a Card'}
          </div>

          <div className="relative">
            <PlayingCard
              card={lastDrawnCard}
              isFlipping={isFlipping}
              isRevealed={!isFlipping}
              size="large"
            />

            {/* Result overlay */}
            <AnimatePresence>
              {lastResult && !isDealing && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: -40 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    'absolute -top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl text-sm font-mono font-bold whitespace-nowrap',
                    lastResult.won
                      ? 'bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981]'
                      : 'bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#EF4444]'
                  )}
                >
                  {lastResult.won
                    ? `+${(lastResult.payout ?? 0).toFixed(4)} (${lastResult.multiplier ?? 0}x)`
                    : 'LOSS'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Drawn cards strip */}
        {drawnCards.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-[#484F58] uppercase tracking-wider mb-2">
              Previously Drawn ({drawnCards.length})
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
              {drawnCards.map((card, i) => (
                <motion.div
                  key={`drawn-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <PlayingCard card={card} size="small" />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Deck status */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0D1117] border border-[#30363D]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#484F58]" />
            <span className="text-xs text-[#8B949E]">Cards remaining:</span>
            <span className="text-sm font-mono font-bold text-[#E6EDF3]">{totalRemaining}/52</span>
          </div>
          <button
            onClick={resetDeck}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161B22] border border-[#30363D] hover:border-[#484F58] text-xs text-[#8B949E] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      <div className="px-4 space-y-3 mt-3">
        {/* Bet type selector -- 3-column grid */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#E6EDF3]">Choose Your Bet</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { type: 'low' as BetType, label: 'Low', desc: 'A through 7', icon: <TrendingDown className="w-5 h-5" />, payout: PAYOUTS.low },
              { type: 'match' as BetType, label: 'Match', desc: 'Exact value', icon: <Hash className="w-5 h-5" />, payout: PAYOUTS.match },
              { type: 'high' as BetType, label: 'High', desc: '8 through K', icon: <TrendingUp className="w-5 h-5" />, payout: PAYOUTS.high },
            ]).map((opt) => (
              <motion.button
                key={opt.type}
                whileTap={{ scale: isDealing ? 1 : 0.98 }}
                onClick={() => setBetType(opt.type)}
                disabled={isDealing}
                className={cn(
                  'flex flex-col items-center p-3 rounded-xl border transition-all',
                  betType === opt.type
                    ? 'bg-[#C8FF00]/10 border-[#C8FF00] text-[#C8FF00]'
                    : 'bg-[#0D1117] border-[#30363D] text-[#8B949E] hover:border-[#484F58]',
                  isDealing && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="mb-1">{opt.icon}</div>
                <span className="text-xs font-bold">{opt.label}</span>
                <span className="text-[9px] text-[#484F58] mt-0.5">{opt.desc}</span>
                <span className="text-sm font-mono font-black mt-1">{opt.payout}x</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Card value selector */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#E6EDF3]">
            {betType === 'match' ? 'Select Card to Match' : 'Card Values & Deck'}
          </h3>
          <CardValueSelector
            selectedValue={selectedCardValue}
            onSelect={setSelectedCardValue}
            disabled={isDealing}
            remainingCards={remainingCards}
          />
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

        {/* Bet Amount */}
        <div className="space-y-2">
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-[#8B949E] text-sm mr-2">{currency}</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="flex-1 text-center bg-transparent text-white text-sm font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isDealing}
              step="0.001"
              min="0.001"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => adjustAmount(-0.01)}
                disabled={isDealing}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D434B] transition-colors disabled:opacity-50"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => adjustAmount(0.01)}
                disabled={isDealing}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D434B] transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick presets row */}
          <div className="flex gap-1.5 flex-wrap">
            {BET_PRESETS.map((val) => (
              <button
                key={val}
                onClick={() => setBetAmount(String(val))}
                disabled={isDealing}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
              >
                {val}
              </button>
            ))}
            <button
              onClick={() => {
                const val = parseFloat(betAmount) || 0;
                setBetAmount(Math.max(0.001, val / 2).toFixed(8));
              }}
              disabled={isDealing}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
            >
              1/2
            </button>
            <button
              onClick={() => {
                const val = parseFloat(betAmount) || 0;
                setBetAmount((val * 2).toFixed(8));
              }}
              disabled={isDealing}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
            >
              2X
            </button>
          </div>
        </div>

        {/* Bet summary */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-[#484F58]">Bet Type</span>
            <span className="text-[10px] font-medium text-[#C8FF00] capitalize">
              {betType}
              {betType === 'match' && ` (${CARD_VALUES.find((cv) => cv.value === selectedCardValue)?.label})`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#484F58]">Multiplier</span>
            <span className="text-[10px] font-mono font-bold text-[#E6EDF3]">{PAYOUTS[betType]}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-[#484F58]">Potential Win</span>
            <span className="text-[10px] font-mono font-bold text-[#10B981]">
              {potentialPayout.toFixed(4)} {currency}
            </span>
          </div>
        </div>

        {/* Deal button */}
        {!isAuthenticated ? (
          <Link href="/login">
            <button className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base">
              Login to Play
            </button>
          </Link>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={playRound}
            disabled={isDealing}
            className={cn(
              'font-bold py-3.5 rounded-xl w-full text-base transition-all',
              isDealing
                ? 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                : 'bg-[#C8FF00] text-black'
            )}
          >
            {isDealing ? (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                DEALING...
              </motion.span>
            ) : (
              'DEAL CARD'
            )}
          </motion.button>
        )}

        {/* Error */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-4 py-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center justify-between"
            >
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-[#EF4444]/70 hover:text-[#EF4444] ml-2">
                &times;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session stats */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4">
          <h3 className="text-[10px] text-[#484F58] uppercase tracking-wider mb-2">Session Stats</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-lg font-mono font-bold text-[#E6EDF3]">{stats.totalBets}</div>
              <div className="text-[10px] text-[#484F58]">Rounds</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-mono font-bold text-[#10B981]">{stats.wins}</div>
              <div className="text-[10px] text-[#484F58]">Wins</div>
            </div>
            <div className="text-center">
              <div className={cn(
                'text-lg font-mono font-bold',
                stats.totalProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              )}>
                {(stats.totalProfit ?? 0) >= 0 ? '+' : ''}{(stats.totalProfit ?? 0).toFixed(4)}
              </div>
              <div className="text-[10px] text-[#484F58]">Profit</div>
            </div>
          </div>
        </div>

        {/* History panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#C8FF00]" />
                  Game History
                </h3>
                {gameHistory.length === 0 ? (
                  <p className="text-xs text-[#484F58] text-center py-6">No rounds played yet</p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {gameHistory.map((round) => (
                      <div
                        key={round.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0D1117] border border-[#30363D]"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-2 h-2 rounded-full',
                            round.won ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                          )} />
                          <PlayingCard card={round.drawnCard} size="small" />
                          <div>
                            <span className="text-xs text-[#E6EDF3] capitalize">{round.bet}</span>
                            {round.bet === 'match' && (
                              <span className="text-[10px] text-[#484F58] ml-1">
                                (target: {CARD_VALUES.find((cv) => cv.value === round.targetValue)?.label})
                              </span>
                            )}
                            <div className="text-[10px] text-[#484F58]">
                              Drew {round.drawnCard.display || CARD_VALUES.find((cv) => cv.value === round.drawnCard.value)?.label}{' '}
                              {SUIT_SYMBOLS[round.drawnCard.suit]?.symbol}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-[#8B949E]">
                            {(round.betAmount ?? 0).toFixed(4)} {currency}
                          </div>
                          <div className={cn(
                            'text-xs font-mono font-medium',
                            round.won ? 'text-[#10B981]' : 'text-[#EF4444]'
                          )}>
                            {round.won ? '+' : ''}{(round.profit ?? 0).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fairness panel */}
        <AnimatePresence>
          {showFairness && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#10B981]" />
                  Provably Fair
                </h3>
                {lastFairness ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] text-[#484F58] uppercase tracking-wider">Server Seed Hash</span>
                      <p className="text-xs font-mono text-[#8B949E] break-all bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 mt-1">
                        {lastFairness.serverSeedHash}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#484F58] uppercase tracking-wider">Client Seed</span>
                      <p className="text-xs font-mono text-[#8B949E] break-all bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 mt-1">
                        {lastFairness.clientSeed}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#484F58] uppercase tracking-wider">Nonce</span>
                      <p className="text-xs font-mono text-[#8B949E] bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 mt-1">
                        {lastFairness.nonce}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#484F58] text-center py-6">
                    Play a round to see fairness data
                  </p>
                )}
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
