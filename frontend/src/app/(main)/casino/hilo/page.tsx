'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  Minus,
  History,
  RotateCcw,
  Shield,
  Zap,
  TrendingUp,
  Equal,
  Home,
  Info,
  Volume2,
  VolumeX,
  Plus,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

interface PlayingCard {
  value: CardValue;
  suit: Suit;
}

type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

// Backend returns { result: <gameResult>, newBalance, balances? }
// For /start:  result = { currentCard, probabilities, multipliers, serverSeedHash }
// For /guess:  result = { previousCard, newCard, direction, isCorrect, currentMultiplier, nextMultipliers?, nextProbabilities?, payout, gameOver, newBalance? }
// For /cashout: result = { payout, multiplier, history, roundsPlayed, newBalance }
interface HiLoApiResponse {
  result: any;
  newBalance?: number;
  balances?: Array<{ currency: string; balance: number }>;
}

interface HistoryEntry {
  id: string;
  cards: PlayingCard[];
  betAmount: number;
  payout: number;
  multiplier: number;
  won: boolean;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Card Constants & Helpers
// ---------------------------------------------------------------------------

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '\u2660',
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
};
const SUIT_COLORS: Record<Suit, string> = {
  spades: '#E6EDF3',
  hearts: '#EF4444',
  diamonds: '#EF4444',
  clubs: '#E6EDF3',
};
const VALUE_LABELS: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'SOL', 'LTC', 'DOGE', 'BNB', 'XRP'];

function parseCard(c: { value: number; suit: string }): PlayingCard {
  const suitMap: Record<string, Suit> = {
    spades: 'spades', hearts: 'hearts', diamonds: 'diamonds', clubs: 'clubs',
    S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs',
  };
  return {
    value: Math.max(1, Math.min(13, c.value)) as CardValue,
    suit: suitMap[c.suit] || 'spades',
  };
}

function randomCard(): PlayingCard {
  return {
    value: (Math.floor(Math.random() * 13) + 1) as CardValue,
    suit: SUITS[Math.floor(Math.random() * 4)],
  };
}

function calcHigherProb(value: CardValue): number {
  const higherCount = 13 - value;
  return (higherCount * 4) / 51 * 100;
}

function calcLowerProb(value: CardValue): number {
  const lowerCount = value - 1;
  return (lowerCount * 4) / 51 * 100;
}

function calcSkipProb(value: CardValue): number {
  return (3 / 51) * 100;
}

function probToMultiplier(prob: number): number {
  if (prob <= 0) return 0;
  return parseFloat((99 / prob).toFixed(4));
}

// ---------------------------------------------------------------------------
// PlayingCardComponent
// ---------------------------------------------------------------------------

function PlayingCardComponent({
  card,
  size = 'normal',
  flipped = false,
  highlight,
  animateIn = false,
  delay = 0,
}: {
  card: PlayingCard;
  size?: 'mini' | 'small' | 'normal' | 'large';
  flipped?: boolean;
  highlight?: 'green' | 'red' | null;
  animateIn?: boolean;
  delay?: number;
}) {
  const sizeClasses = {
    mini: 'w-8 h-11 text-[9px] rounded',
    small: 'w-11 h-[60px] text-[10px] rounded-md',
    normal: 'w-16 h-[88px] text-sm rounded-lg',
    large: 'w-28 h-[156px] text-xl rounded-xl',
  };

  const suitColor = SUIT_COLORS[card.suit];
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const label = VALUE_LABELS[card.value];

  const borderGlow = highlight === 'green'
    ? 'ring-2 ring-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.4)]'
    : highlight === 'red'
      ? 'ring-2 ring-[#EF4444] shadow-[0_0_20px_rgba(239,68,68,0.4)]'
      : '';

  return (
    <motion.div
      initial={animateIn ? { x: 60, rotateY: 180, opacity: 0 } : false}
      animate={{ x: 0, rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay, type: 'spring', stiffness: 200, damping: 20 }}
      className={cn(sizeClasses[size], 'relative select-none')}
      style={{ perspective: '1000px' }}
    >
      <motion.div
        initial={flipped ? { rotateY: 180 } : { rotateY: 0 }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front face */}
        <div
          className={cn(
            'absolute inset-0 bg-white flex flex-col justify-between p-1.5 backface-hidden',
            sizeClasses[size],
            borderGlow,
            'transition-shadow duration-500',
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex flex-col items-start leading-none" style={{ color: suitColor }}>
            <span className="font-bold font-mono">{label}</span>
            <span className={size === 'mini' ? 'text-[8px]' : size === 'small' ? 'text-[9px]' : size === 'large' ? 'text-base' : 'text-xs'}>{suitSymbol}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: suitColor }}>
            <span className={cn(
              'font-normal',
              size === 'mini' ? 'text-lg' : size === 'small' ? 'text-xl' : size === 'normal' ? 'text-3xl' : 'text-5xl',
            )}>
              {suitSymbol}
            </span>
          </div>
          <div className="flex flex-col items-end leading-none self-end" style={{ color: suitColor, transform: 'rotate(180deg)' }}>
            <span className="font-bold font-mono">{label}</span>
            <span className={size === 'mini' ? 'text-[8px]' : size === 'small' ? 'text-[9px]' : size === 'large' ? 'text-base' : 'text-xs'}>{suitSymbol}</span>
          </div>
        </div>

        {/* Back face */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center backface-hidden',
            sizeClasses[size],
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="w-[70%] h-[80%] border-2 border-white/30 rounded-sm flex items-center justify-center">
            <div className="text-white/40 font-bold text-sm">CB</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// HiLo Game Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function HiLoGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [cardChain, setCardChain] = useState<PlayingCard[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [streak, setStreak] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [resultHighlight, setResultHighlight] = useState<'green' | 'red' | null>(null);
  const [lastGuess, setLastGuess] = useState<string | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [fairnessData, setFairnessData] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Bet state
  const [betAmount, setBetAmount] = useState('1.00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Refs
  const isPlayingRef = useRef(false);
  const chainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  // Auto-scroll card chain to right
  useEffect(() => {
    if (chainScrollRef.current) {
      chainScrollRef.current.scrollLeft = chainScrollRef.current.scrollWidth;
    }
  }, [cardChain]);

  // Current card
  const currentCard = cardChain.length > 0 ? cardChain[cardChain.length - 1] : null;

  // Probabilities
  const higherProb = currentCard ? calcHigherProb(currentCard.value) : 50;
  const lowerProb = currentCard ? calcLowerProb(currentCard.value) : 50;
  const skipProb = currentCard ? calcSkipProb(currentCard.value) : 0;
  const higherMulti = probToMultiplier(higherProb);
  const lowerMulti = probToMultiplier(lowerProb);

  // Potential payout
  const potentialPayout = parseFloat(betAmount) * currentMultiplier;

  // ---------------------------------------------------------------------------
  // Start game
  // ---------------------------------------------------------------------------

  const handleStart = useCallback(async () => {
    if (isPlayingRef.current || !isAuthenticated) return;
    isPlayingRef.current = true;
    setIsAnimating(true);
    setErrorMessage(null);
    setResultHighlight(null);
    setLastGuess(null);

    try {
      const response = await post<HiLoApiResponse>('/casino/hilo/start', {
        amount: parseFloat(betAmount),
        currency,
      });

      const gameResult = response.result || response;
      setRoundId('active');
      if (gameResult.serverSeedHash) {
        setFairnessData({ serverSeedHash: gameResult.serverSeedHash, clientSeed: '', nonce: 0 });
      }

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      const startCard = gameResult.currentCard
        ? parseCard(gameResult.currentCard)
        : randomCard();

      setCardChain([startCard]);
      setCurrentMultiplier(1);
      setStreak(0);
      setGamePhase('playing');

      await new Promise((r) => setTimeout(r, 600));
    } catch (err: any) {
      if (/insufficient/i.test(err?.message || '')) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(err?.message || 'Failed to start game. Please try again.');
      }
    } finally {
      setIsAnimating(false);
      isPlayingRef.current = false;
    }
  }, [betAmount, currency, isAuthenticated]);

  // ---------------------------------------------------------------------------
  // Guess Higher/Lower/Skip
  // ---------------------------------------------------------------------------

  const handleGuess = useCallback(async (action: 'higher' | 'lower' | 'skip') => {
    if (isPlayingRef.current || gamePhase !== 'playing' || !roundId) return;
    isPlayingRef.current = true;
    setIsAnimating(true);
    setErrorMessage(null);
    setResultHighlight(null);
    setLastGuess(action);

    try {
      const response = await post<HiLoApiResponse>('/casino/hilo/guess', {
        direction: action,
      });

      const gameResult = response.result || response;

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      const nextCard = gameResult.newCard
        ? parseCard(gameResult.newCard)
        : gameResult.currentCard
          ? parseCard(gameResult.currentCard)
          : randomCard();

      await new Promise((r) => setTimeout(r, 300));

      setCardChain((prev) => [...prev, nextCard]);

      await new Promise((r) => setTimeout(r, 400));

      if (gameResult.isCorrect === false || gameResult.gameOver) {
        if (gameResult.isCorrect === false) {
          setResultHighlight('red');
          setGamePhase('lost');
          setCurrentMultiplier(0);

          setHistory((prev) => [{
            id: roundId || Date.now().toString(),
            cards: [...cardChain, nextCard],
            betAmount: parseFloat(betAmount),
            payout: 0,
            multiplier: 0,
            won: false,
            timestamp: new Date(),
          }, ...prev.slice(0, 9)]);

          await new Promise((r) => setTimeout(r, 1500));
          setResultHighlight(null);
        } else {
          const newMulti = gameResult.currentMultiplier || currentMultiplier;
          setCurrentMultiplier(newMulti);
          setResultHighlight('green');
          setStreak((s) => s + 1);
          setGamePhase('won');

          setHistory((prev) => [{
            id: roundId || Date.now().toString(),
            cards: [...cardChain, nextCard],
            betAmount: parseFloat(betAmount),
            payout: gameResult.payout || 0,
            multiplier: newMulti,
            won: true,
            timestamp: new Date(),
          }, ...prev.slice(0, 9)]);

          await new Promise((r) => setTimeout(r, 1500));
          setResultHighlight(null);
        }
      } else {
        const newMulti = gameResult.currentMultiplier || currentMultiplier * (action === 'skip' ? 1 : (action === 'higher' ? higherMulti : lowerMulti));
        setCurrentMultiplier(newMulti);
        setStreak((s) => s + 1);
        setResultHighlight('green');

        await new Promise((r) => setTimeout(r, 800));
        setResultHighlight(null);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process guess. Try again.');
    } finally {
      setIsAnimating(false);
      isPlayingRef.current = false;
    }
  }, [gamePhase, roundId, currency, cardChain, currentMultiplier, higherMulti, lowerMulti, betAmount]);

  // ---------------------------------------------------------------------------
  // Cashout
  // ---------------------------------------------------------------------------

  const handleCashout = useCallback(async () => {
    if (isPlayingRef.current || gamePhase !== 'playing' || !roundId) return;
    isPlayingRef.current = true;
    setIsAnimating(true);
    setErrorMessage(null);

    try {
      const response = await post<HiLoApiResponse>('/casino/hilo/cashout', {});

      const gameResult = response.result || response;

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      const finalMulti = gameResult.multiplier || currentMultiplier;
      setCurrentMultiplier(finalMulti);
      setGamePhase('won');
      setResultHighlight('green');

      setHistory((prev) => [{
        id: roundId || Date.now().toString(),
        cards: [...cardChain],
        betAmount: parseFloat(betAmount),
        payout: gameResult.payout || parseFloat(betAmount) * finalMulti,
        multiplier: finalMulti,
        won: true,
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]);

      await new Promise((r) => setTimeout(r, 2000));
      setResultHighlight(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Cashout failed. Try again.');
    } finally {
      setIsAnimating(false);
      isPlayingRef.current = false;
    }
  }, [gamePhase, roundId, currency, cardChain, currentMultiplier, betAmount]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  const handleNewGame = useCallback(() => {
    setGamePhase('idle');
    setCardChain([]);
    setCurrentMultiplier(1);
    setRoundId(null);
    setResultHighlight(null);
    setLastGuess(null);
    setStreak(0);
    setErrorMessage(null);
  }, []);

  // Bet adjustments
  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(5));
  };

  const incrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount((val + 0.001).toFixed(5));
  };

  const decrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val - 0.001).toFixed(5));
  };

  const setMaxBet = () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const bal = user.balances.find((b) => b.currency === currency);
    if (bal) setBetAmount(bal.available.toFixed(8));
  };

  // ---------------------------------------------------------------------------
  // Render - Cloudbet Mobile Style
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      <div className="pb-20">
        {/* Error Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-4 mt-3 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ GAME AREA - edge to edge ============ */}
        <div className="bg-[#161B22] mt-0">

          {/* Top: Current Multiplier */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-[#30363D]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8B949E]">Multiplier</span>
              <motion.span
                key={currentMultiplier}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className={cn(
                  'text-2xl font-black font-mono',
                  currentMultiplier > 1 ? 'text-[#C8FF00]' : 'text-[#E6EDF3]',
                )}
              >
                {currentMultiplier.toFixed(2)}x
              </motion.span>
              {streak > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C8FF00]/10 border border-[#C8FF00]/30"
                >
                  <Zap className="w-3 h-3 text-[#C8FF00]" />
                  <span className="text-[10px] font-bold text-[#C8FF00]">{streak}</span>
                </motion.div>
              )}
            </div>
            {gamePhase === 'playing' && (
              <div className="text-right">
                <p className="text-[10px] text-[#8B949E]">Potential</p>
                <p className="text-sm font-bold font-mono text-[#C8FF00]">
                  {formatCurrency(potentialPayout, currency)}
                </p>
              </div>
            )}
          </div>

          {/* Card Chain (horizontal scroll) */}
          {cardChain.length > 1 && (
            <div
              ref={chainScrollRef}
              className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide border-b border-[#30363D]/50"
            >
              {cardChain.slice(0, -1).map((card, i) => (
                <motion.div
                  key={`chain-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.7, scale: 1 }}
                  className="flex-shrink-0"
                >
                  <PlayingCardComponent card={card} size="small" />
                </motion.div>
              ))}
            </div>
          )}

          {/* Main Card Area */}
          <div className="relative flex flex-col items-center justify-center py-12 min-h-[280px]">
            {/* Background dots */}
            <div className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #E6EDF3 1px, transparent 0)',
                backgroundSize: '20px 20px',
              }}
            />

            {/* Game Over Overlay */}
            <AnimatePresence>
              {(gamePhase === 'won' || gamePhase === 'lost') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center"
                  style={{
                    background: gamePhase === 'won'
                      ? 'radial-gradient(ellipse at center, rgba(200,255,0,0.1) 0%, transparent 70%)'
                      : 'radial-gradient(ellipse at center, rgba(239,68,68,0.1) 0%, transparent 70%)',
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="text-center"
                  >
                    {gamePhase === 'won' ? (
                      <div className="space-y-2">
                        <p className="text-4xl font-black text-[#10B981]">CASHOUT!</p>
                        <p className="text-2xl font-bold font-mono text-[#C8FF00]">
                          +{formatCurrency(potentialPayout - parseFloat(betAmount), currency)}
                        </p>
                        <p className="text-sm text-[#8B949E]">at {currentMultiplier.toFixed(2)}x</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-4xl font-black text-[#EF4444]">BUST!</p>
                        <p className="text-base text-[#8B949E]">Better luck next time</p>
                      </div>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleNewGame}
                      className="mt-4 bg-[#C8FF00] text-black font-bold py-3.5 px-8 rounded-xl text-base"
                    >
                      New Game
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Idle State */}
            {gamePhase === 'idle' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-5 relative z-10"
              >
                <div className="w-24 h-[132px] rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-lg">
                  <div className="w-[70%] h-[80%] border-2 border-white/20 rounded-sm flex items-center justify-center">
                    <div className="text-white/30 font-bold text-sm">CB</div>
                  </div>
                </div>
                <p className="text-sm text-[#8B949E]">Place your bet to start</p>
              </motion.div>
            )}

            {/* Playing - Current Card (large centered) */}
            {gamePhase !== 'idle' && currentCard && (
              <div className="relative z-10">
                <PlayingCardComponent
                  card={currentCard}
                  size="large"
                  highlight={resultHighlight}
                  animateIn={true}
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#8B5CF6] text-white text-xs font-bold font-mono shadow-lg"
                >
                  {VALUE_LABELS[currentCard.value]}
                </motion.div>
              </div>
            )}
          </div>

          {/* Higher / Lower Buttons - two large side by side */}
          {gamePhase === 'playing' && currentCard && (
            <div className="px-4 pb-4 space-y-2">
              {/* Probability info */}
              <div className="flex justify-between text-[10px] text-[#8B949E] px-1 mb-1">
                <span>Higher {higherProb.toFixed(0)}% ({higherMulti.toFixed(2)}x)</span>
                <span>Lower {lowerProb.toFixed(0)}% ({lowerMulti.toFixed(2)}x)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Higher - green */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isAnimating}
                  onClick={() => handleGuess('higher')}
                  className={cn(
                    'h-16 rounded-xl font-bold text-base flex flex-col items-center justify-center gap-1 transition-all',
                    isAnimating
                      ? 'bg-[#1C2128] text-[#484F58] cursor-not-allowed'
                      : 'bg-[#10B981] text-white hover:bg-[#059669] active:bg-[#047857]',
                  )}
                >
                  <ChevronUp className="w-6 h-6" />
                  <span>HIGHER</span>
                </motion.button>

                {/* Lower - red */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={isAnimating}
                  onClick={() => handleGuess('lower')}
                  className={cn(
                    'h-16 rounded-xl font-bold text-base flex flex-col items-center justify-center gap-1 transition-all',
                    isAnimating
                      ? 'bg-[#1C2128] text-[#484F58] cursor-not-allowed'
                      : 'bg-[#EF4444] text-white hover:bg-[#DC2626] active:bg-[#B91C1C]',
                  )}
                >
                  <ChevronDown className="w-6 h-6" />
                  <span>LOWER</span>
                </motion.button>
              </div>

              {/* Cash Out Button - olive */}
              {currentMultiplier > 1 && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isAnimating}
                  onClick={handleCashout}
                  className={cn(
                    'bg-[#3D3D20] text-[#C8FF00] font-bold py-3.5 rounded-xl w-full flex items-center justify-center gap-3 transition-all text-base',
                    isAnimating && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span>CASH OUT</span>
                  <span className="font-mono">{formatCurrency(potentialPayout, currency)}</span>
                  <span className="text-sm opacity-75">({currentMultiplier.toFixed(2)}x)</span>
                </motion.button>
              )}
            </div>
          )}

          {/* Idle - Deal Button */}
          {gamePhase === 'idle' && (
            <div className="px-4 pb-4">
              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={!isAuthenticated || isAnimating}
                onClick={handleStart}
                className={cn(
                  'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base flex items-center justify-center gap-2 transition-all',
                  (!isAuthenticated || isAnimating) && 'opacity-40 cursor-not-allowed',
                )}
              >
                {isAnimating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
                  />
                ) : !isAuthenticated ? (
                  'Login to Play'
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Deal Card
                  </>
                )}
              </motion.button>
            </div>
          )}

          {/* Won/Lost - Play Again */}
          {(gamePhase === 'won' || gamePhase === 'lost') && (
            <div className="px-4 pb-4">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNewGame}
                className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </motion.button>
            </div>
          )}
        </div>

        {/* ============ BET CONTROLS ============ */}
        <div className="px-4 mt-3">
          <div className="bg-[#161B22] rounded-2xl border border-[#30363D] overflow-hidden">
            {/* Manual / Auto Toggle */}
            <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex mx-4 mt-4">
              <button
                onClick={() => setActiveTab('manual')}
                className={cn(
                  'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                  activeTab === 'manual'
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[#8B949E]',
                )}
              >
                Manual
              </button>
              <button
                onClick={() => setActiveTab('auto')}
                className={cn(
                  'flex-1 py-2 px-6 text-sm font-bold transition-colors',
                  activeTab === 'auto'
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[#8B949E]',
                )}
              >
                Auto
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Bet Amount */}
              <div>
                <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                  <span className="text-[#8B949E] text-xs mr-2">{currency}</span>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={gamePhase === 'playing'}
                    step="any"
                    min="0"
                    className="flex-1 bg-transparent text-sm font-mono text-[#E6EDF3] text-center focus:outline-none disabled:opacity-40"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={decrementBet}
                      disabled={gamePhase === 'playing'}
                      className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={incrementBet}
                      disabled={gamePhase === 'playing'}
                      className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Quick presets */}
                <div className="flex gap-1.5 mt-2">
                  {['0.01', '0.1', '1', '10', '100'].map((v) => (
                    <button
                      key={v}
                      onClick={() => gamePhase !== 'playing' && setBetAmount(v)}
                      disabled={gamePhase === 'playing'}
                      className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    onClick={() => adjustBet(0.5)}
                    disabled={gamePhase === 'playing'}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => adjustBet(2)}
                    disabled={gamePhase === 'playing'}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    2X
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5 text-center">
                  <p className="text-[9px] text-[#8B949E] mb-0.5">Card</p>
                  <p className="text-sm font-bold font-mono text-[#E6EDF3]">
                    {currentCard ? VALUE_LABELS[currentCard.value] : '-'}
                  </p>
                </div>
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5 text-center">
                  <p className="text-[9px] text-[#8B949E] mb-0.5">Multiplier</p>
                  <p className="text-sm font-bold font-mono text-[#C8FF00]">
                    {currentMultiplier.toFixed(2)}x
                  </p>
                </div>
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5 text-center">
                  <p className="text-[9px] text-[#8B949E] mb-0.5">Streak</p>
                  <p className="text-sm font-bold font-mono text-[#10B981]">{streak}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ CARD REFERENCE ============ */}
        <div className="px-4 mt-3">
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-3">
            <p className="text-[10px] text-[#8B949E] mb-2 font-medium">A=1 Low, K=13 High</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {Array.from({ length: 13 }, (_, i) => i + 1).map((val) => {
                const isCurrentValue = currentCard?.value === val;
                return (
                  <div
                    key={val}
                    className={cn(
                      'flex-shrink-0 w-8 h-10 rounded-md flex flex-col items-center justify-center text-[10px] font-bold font-mono transition-all',
                      isCurrentValue
                        ? 'bg-[#C8FF00] text-black ring-1 ring-[#C8FF00]/50'
                        : currentCard && val > currentCard.value
                          ? 'bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981]'
                          : currentCard && val < currentCard.value
                            ? 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]'
                            : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E]',
                    )}
                  >
                    <span>{VALUE_LABELS[val]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============ GAME HISTORY ============ */}
        {history.length > 0 && (
          <div className="px-4 mt-3">
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-[#30363D]">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#8B949E]" />
                  <h3 className="text-sm font-semibold text-[#E6EDF3]">History</h3>
                </div>
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-[#8B949E] hover:text-[#E6EDF3] flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-[#30363D]/30">
                {history.map((entry, i) => (
                  <motion.div
                    key={entry.id + '-' + i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-4 py-3 hover:bg-[#1C2128]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold',
                          entry.won ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444]',
                        )}>
                          {entry.won ? 'WIN' : 'LOSS'}
                        </span>
                        <span className="text-xs text-[#8B949E]">{entry.cards.length} cards</span>
                        {entry.won && (
                          <span className="text-xs font-mono font-bold text-[#C8FF00]">{entry.multiplier.toFixed(2)}x</span>
                        )}
                      </div>
                      <span className={cn(
                        'text-xs font-mono font-bold',
                        entry.won ? 'text-[#10B981]' : 'text-[#EF4444]',
                      )}>
                        {entry.won
                          ? `+${formatCurrency(entry.payout - entry.betAmount, currency)}`
                          : `-${formatCurrency(entry.betAmount, currency)}`}
                      </span>
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {entry.cards.map((card, ci) => (
                        <div
                          key={ci}
                          className={cn(
                            'flex-shrink-0 w-7 h-10 rounded bg-white flex flex-col items-center justify-center text-[9px] font-bold border',
                            ci === entry.cards.length - 1 && !entry.won
                              ? 'border-[#EF4444]'
                              : ci === entry.cards.length - 1 && entry.won
                                ? 'border-[#10B981]'
                                : 'border-gray-200',
                          )}
                        >
                          <span style={{ color: SUIT_COLORS[card.suit] }}>{VALUE_LABELS[card.value]}</span>
                          <span style={{ color: SUIT_COLORS[card.suit] }} className="text-[8px]">{SUIT_SYMBOLS[card.suit]}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Provably Fair Panel */}
        <AnimatePresence>
          {showFairness && fairnessData && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-4 mt-3"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 space-y-2">
                <h3 className="text-sm font-semibold text-[#E6EDF3] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#10B981]" />
                  Fairness Verification
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-[#8B949E] mb-0.5">Server Seed Hash</p>
                    <p className="font-mono text-[#E6EDF3] break-all bg-[#0D1117] rounded-lg p-2">{fairnessData.serverSeedHash}</p>
                  </div>
                  <div>
                    <p className="text-[#8B949E] mb-0.5">Client Seed</p>
                    <p className="font-mono text-[#E6EDF3] break-all bg-[#0D1117] rounded-lg p-2">{fairnessData.clientSeed}</p>
                  </div>
                  <div>
                    <p className="text-[#8B949E] mb-0.5">Nonce</p>
                    <p className="font-mono text-[#E6EDF3] bg-[#0D1117] rounded-lg p-2">{fairnessData.nonce}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============ FIXED BOTTOM BAR ============ */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <button className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowFairness(!showFairness)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {formatCurrency(parseFloat(betAmount) || 0, currency)} {currency}
        </span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
