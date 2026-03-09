'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Shield,
  ChevronDown,
  Volume2,
  VolumeX,
  Home,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardData {
  rank: string;
  suit: string;
}

interface VideoPokerResult {
  hand?: CardData[];
  cards?: CardData[];
  finalHand?: CardData[];
  initialHand?: CardData[];
  heldCards?: boolean[];
  holds?: boolean[];
  handName?: string;
  handMultiplier?: number;
  multiplier?: number;
  payout?: number;
  isWin?: boolean;
  phase?: 'deal' | 'complete' | 'result';
  instructions?: string;
}

interface VideoPokerApiResponse {
  roundId: string;
  result: VideoPokerResult;
  multiplier?: number;
  payout?: number;
  profit?: number;
  fairness?: { serverSeedHash?: string; clientSeed?: string; nonce?: number };
  newBalance?: number;
}

interface HistoryEntry {
  id: string;
  handName: string;
  bet: number;
  payout: number;
  isWin: boolean;
  timestamp: Date;
}

type GamePhase = 'betting' | 'deal' | 'draw' | 'result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYOUT_TABLE: { hand: string; multiplier: number }[] = [
  { hand: 'Royal Flush', multiplier: 250 },
  { hand: 'Straight Flush', multiplier: 50 },
  { hand: 'Four of a Kind', multiplier: 25 },
  { hand: 'Full House', multiplier: 9 },
  { hand: 'Flush', multiplier: 6 },
  { hand: 'Straight', multiplier: 4 },
  { hand: 'Three of a Kind', multiplier: 3 },
  { hand: 'Two Pair', multiplier: 2 },
  { hand: 'Jacks or Better', multiplier: 1 },
];

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
  h: '\u2665',
  d: '\u2666',
  c: '\u2663',
  s: '\u2660',
  Heart: '\u2665',
  Diamond: '\u2666',
  Club: '\u2663',
  Spade: '\u2660',
  Hearts: '\u2665',
  Diamonds: '\u2666',
  Clubs: '\u2663',
  Spades: '\u2660',
  '\u2665': '\u2665',
  '\u2666': '\u2666',
  '\u2663': '\u2663',
  '\u2660': '\u2660',
};

const RANK_DISPLAY: Record<string, string> = {
  '1': 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', '10': '10', '11': 'J', '12': 'Q', '13': 'K', '14': 'A',
  A: 'A', J: 'J', Q: 'Q', K: 'K', T: '10',
  ace: 'A', jack: 'J', queen: 'Q', king: 'K',
  Ace: 'A', Jack: 'J', Queen: 'Q', King: 'K',
};

const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

function getSuitSymbol(suit: string): string {
  return SUIT_SYMBOLS[suit] || suit;
}

function getRankDisplay(rank: string): string {
  return RANK_DISPLAY[rank] || rank;
}

function isRedSuit(suit: string): boolean {
  const s = getSuitSymbol(suit);
  return s === '\u2665' || s === '\u2666';
}

// Big winning hands that get golden glow
const BIG_HANDS = ['Royal Flush', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush'];

// ---------------------------------------------------------------------------
// PlayingCard Component
// ---------------------------------------------------------------------------

function PlayingCard({
  card,
  index,
  isHeld,
  onToggleHold,
  phase,
  isNew,
  isDiscarded,
  faceDown,
}: {
  card: CardData | null;
  index: number;
  isHeld: boolean;
  onToggleHold: (index: number) => void;
  phase: GamePhase;
  isNew: boolean;
  isDiscarded: boolean;
  faceDown: boolean;
}) {
  const suitSymbol = card ? getSuitSymbol(card.suit) : '';
  const rankDisplay = card ? getRankDisplay(card.rank) : '';
  const red = card ? isRedSuit(card.suit) : false;
  const canHold = phase === 'deal';

  const dealVariants = {
    hidden: { x: -300, rotateY: 180, opacity: 0 },
    visible: {
      x: 0,
      rotateY: faceDown ? 180 : 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay: index * 0.12,
      },
    },
    discarded: {
      y: -100,
      rotateY: 180,
      opacity: 0,
      transition: { duration: 0.3, delay: index * 0.06 },
    },
    newCard: {
      x: 0,
      rotateY: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay: index * 0.12,
      },
    },
  };

  const animateState = isDiscarded ? 'discarded' : isNew ? 'newCard' : 'visible';

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Card */}
      <motion.div
        variants={dealVariants}
        initial="hidden"
        animate={animateState}
        style={{ perspective: '800px' }}
        className={cn(
          'relative w-[60px] h-[88px] sm:w-[72px] sm:h-[104px]',
          'rounded-lg cursor-pointer select-none transition-shadow duration-200',
          isHeld && phase !== 'betting' ? 'ring-2 ring-[#C8FF00] shadow-[0_0_12px_rgba(200,255,0,0.3)]' : '',
          canHold ? 'hover:translate-y-[-3px]' : '',
        )}
        onClick={() => canHold && onToggleHold(index)}
        whileHover={canHold ? { y: -3 } : {}}
        whileTap={canHold ? { scale: 0.97 } : {}}
      >
        {!faceDown && card ? (
          <div
            className={cn(
              'w-full h-full rounded-lg bg-white flex flex-col justify-between p-1.5',
              'border border-gray-200 shadow-md',
              red ? 'text-red-600' : 'text-gray-900',
            )}
          >
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs sm:text-sm font-bold">{rankDisplay}</span>
              <span className="text-[10px] sm:text-xs">{suitSymbol}</span>
            </div>
            <div className="flex items-center justify-center flex-1">
              <span className="text-2xl sm:text-3xl">{suitSymbol}</span>
            </div>
            <div className="flex flex-col items-end leading-none rotate-180">
              <span className="text-xs sm:text-sm font-bold">{rankDisplay}</span>
              <span className="text-[10px] sm:text-xs">{suitSymbol}</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full rounded-lg bg-gradient-to-br from-[#1C2128] to-[#0D1117] border-2 border-[#30363D] flex items-center justify-center shadow-md">
            <div className="w-[80%] h-[85%] rounded border border-[#30363D] bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(200,255,0,0.05)_4px,rgba(200,255,0,0.05)_8px)] flex items-center justify-center">
              <span className="text-[#C8FF00]/30 text-xs font-bold">VP</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Hold/Discard button below card */}
      {phase === 'deal' && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + index * 0.05 }}
          onClick={() => onToggleHold(index)}
          className={cn(
            'px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-150',
            isHeld
              ? 'bg-[#C8FF00] text-black'
              : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58]',
          )}
        >
          {isHeld ? 'Held' : 'Hold'}
        </motion.button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Video Poker Page
// ---------------------------------------------------------------------------

export default function VideoPokerPage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('betting');
  const [cards, setCards] = useState<(CardData | null)[]>([null, null, null, null, null]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [handName, setHandName] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<number>(0);
  const [payout, setPayout] = useState<number>(0);
  const [isWin, setIsWin] = useState<boolean>(false);
  const [newCardIndices, setNewCardIndices] = useState<Set<number>>(new Set());
  const [discardedIndices, setDiscardedIndices] = useState<Set<number>>(new Set());
  const [showResult, setShowResult] = useState(false);

  // Bet state
  const [betAmount, setBetAmount] = useState('1.00');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History + UI
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [fairnessData, setFairnessData] = useState<{
    serverSeedHash?: string;
    clientSeed?: string;
    nonce?: number;
  } | null>(null);

  const isPlayingRef = useRef(false);

  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  const balance = useAuthStore.getState().user?.balances?.find((b) => b.currency === currency)?.available ?? 0;

  // Toggle hold on a card
  const toggleHold = useCallback(
    (index: number) => {
      if (phase !== 'deal') return;
      setHeld((prev) => {
        const next = [...prev];
        next[index] = !next[index];
        return next;
      });
    },
    [phase],
  );

  // DEAL
  const handleDeal = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setShowResult(false);
    setHandName(null);
    setMultiplier(0);
    setPayout(0);
    setIsWin(false);
    setHeld([false, false, false, false, false]);
    setNewCardIndices(new Set());
    setDiscardedIndices(new Set());
    setCards([null, null, null, null, null]);

    try {
      const response = await post<VideoPokerApiResponse>('/casino/video-poker/deal', {
        amount: parseFloat(betAmount),
        currency,
      });

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      setRoundId(response.roundId);
      setFairnessData(response.fairness || null);

      const hand = response.result?.hand ?? response.result?.cards ?? [null, null, null, null, null];
      setCards(hand);
      setNewCardIndices(new Set([0, 1, 2, 3, 4]));

      setTimeout(() => {
        setNewCardIndices(new Set());
        setPhase('deal');
        setIsLoading(false);
        isPlayingRef.current = false;
      }, 800);
    } catch (err: any) {
      const msg = err?.message || '';
      if (/insufficient/i.test(msg)) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(msg || 'Failed to deal. Please try again.');
      }
      setIsLoading(false);
      isPlayingRef.current = false;
      setPhase('betting');
    }
  }, [betAmount, currency]);

  // DRAW
  const handleDraw = useCallback(async () => {
    if (isPlayingRef.current || !roundId) return;
    isPlayingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setPhase('draw');

    const discard = new Set<number>();
    held.forEach((h, i) => {
      if (!h) discard.add(i);
    });
    setDiscardedIndices(discard);

    await new Promise((r) => setTimeout(r, 450));

    try {
      const response = await post<VideoPokerApiResponse>('/casino/video-poker/draw', {
        holds: held,
      });

      if (response.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, response.newBalance, 0);
      }

      setFairnessData(response.fairness || null);

      const newHand = response.result?.hand ?? response.result?.finalHand ?? cards;
      setCards(newHand);
      setDiscardedIndices(new Set());
      setNewCardIndices(discard);

      const r = response.result ?? {} as any;
      const finalHandName = r.handName ?? 'No Pair';
      const finalMultiplier = r.multiplier ?? r.handMultiplier ?? response.multiplier ?? 0;
      const finalPayout = r.payout ?? response.payout ?? 0;
      const finalIsWin = r.isWin ?? (finalPayout > 0);

      setTimeout(() => {
        setNewCardIndices(new Set());
        setHandName(finalHandName);
        setMultiplier(finalMultiplier);
        setPayout(finalPayout);
        setIsWin(finalIsWin);
        setShowResult(true);
        setPhase('result');
        setIsLoading(false);
        isPlayingRef.current = false;

        setHistory((prev) => [
          {
            id: response.roundId,
            handName: finalHandName,
            bet: parseFloat(betAmount),
            payout: finalPayout,
            isWin: finalIsWin,
            timestamp: new Date(),
          },
          ...prev,
        ].slice(0, 10));
      }, 900);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to draw. Please try again.');
      setIsLoading(false);
      isPlayingRef.current = false;
      setPhase('deal');
      setDiscardedIndices(new Set());
    }
  }, [held, roundId, currency, betAmount]);

  // New Game
  const handleNewGame = useCallback(() => {
    setPhase('betting');
    setCards([null, null, null, null, null]);
    setHeld([false, false, false, false, false]);
    setRoundId(null);
    setHandName(null);
    setMultiplier(0);
    setPayout(0);
    setIsWin(false);
    setShowResult(false);
    setNewCardIndices(new Set());
    setDiscardedIndices(new Set());
  }, []);

  // Bet helpers
  const halveBet = () => {
    const current = parseFloat(betAmount) || 0;
    const next = Math.max(0.01, +(current / 2).toFixed(8));
    setBetAmount(next.toString().replace(/\.?0+$/, ''));
  };

  const doubleBet = () => {
    const current = parseFloat(betAmount) || 0;
    const next = Math.max(0.01, +(current * 2).toFixed(8));
    setBetAmount(next.toString().replace(/\.?0+$/, ''));
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

  const isActionDisabled = !isAuthenticated || isLoading;

  return (
    <div className="min-h-screen bg-[#0D1117] text-white flex flex-col pb-20">

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
        {errorMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 mt-2"
          >
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm rounded-xl px-3 py-2 text-center">
              {errorMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================= */}
      {/* Hand Name / Phase Display                                          */}
      {/* ================================================================= */}
      <div className="text-center h-16 flex flex-col items-center justify-center mt-2">
        <AnimatePresence mode="wait">
          {showResult && handName && (
            <motion.div
              key={handName}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="flex flex-col items-center"
            >
              <span
                className={cn(
                  'text-xl sm:text-2xl font-black tracking-wider uppercase',
                  isWin
                    ? BIG_HANDS.includes(handName)
                      ? 'text-[#C8FF00] drop-shadow-[0_0_15px_rgba(200,255,0,0.5)]'
                      : 'text-[#C8FF00]'
                    : 'text-[#8B949E]',
                )}
              >
                {handName}
              </span>
              {isWin && (
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm font-bold text-[#10B981] mt-1"
                >
                  +{formatCurrency(payout, currency)} ({multiplier}x)
                </motion.span>
              )}
            </motion.div>
          )}
          {phase === 'betting' && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[#484F58] text-sm"
            >
              Place your bet and deal
            </motion.span>
          )}
          {phase === 'deal' && !showResult && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[#C8FF00]/70 text-sm animate-pulse"
            >
              Choose cards to hold, then draw
            </motion.span>
          )}
          {phase === 'draw' && !showResult && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[#8B949E] text-sm animate-pulse"
            >
              Drawing new cards...
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================= */}
      {/* Cards Row - 5 cards prominent, centered                            */}
      {/* ================================================================= */}
      <div className="flex justify-center gap-2 sm:gap-3 py-2 px-2">
        {cards.map((card, index) => (
          <PlayingCard
            key={`card-${index}-${card?.rank ?? 'empty'}-${card?.suit ?? 'empty'}-${phase}`}
            card={card}
            index={index}
            isHeld={held[index]}
            onToggleHold={toggleHold}
            phase={phase}
            isNew={newCardIndices.has(index)}
            isDiscarded={discardedIndices.has(index)}
            faceDown={phase === 'betting' || !card}
          />
        ))}
      </div>

      {/* ================================================================= */}
      {/* BET AMOUNT CONTROL                                                 */}
      {/* ================================================================= */}
      <div className="px-4 mt-3 space-y-3">
        {/* Bet Amount */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-sm font-mono text-[#8B949E] pr-2">{currency}</span>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={phase !== 'betting' && phase !== 'result'}
              className="flex-1 bg-transparent text-center font-mono text-sm text-white focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              step="0.01"
              min="0.01"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={adjustBetMinus}
                disabled={phase !== 'betting' && phase !== 'result'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white font-bold text-sm hover:bg-[#3D444D] transition-colors disabled:opacity-40"
              >
                -
              </button>
              <button
                onClick={adjustBetPlus}
                disabled={phase !== 'betting' && phase !== 'result'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white font-bold text-sm hover:bg-[#3D444D] transition-colors disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Quick presets row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {BET_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setBetAmount(preset)}
              disabled={phase !== 'betting' && phase !== 'result'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors disabled:opacity-40"
            >
              {preset}
            </button>
          ))}
          <button
            onClick={halveBet}
            disabled={phase !== 'betting' && phase !== 'result'}
            className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors disabled:opacity-40"
          >
            1/2
          </button>
          <button
            onClick={doubleBet}
            disabled={phase !== 'betting' && phase !== 'result'}
            className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors disabled:opacity-40"
          >
            2X
          </button>
        </div>

        {/* ================================================================= */}
        {/* ACTION BUTTONS - lime CTA                                         */}
        {/* ================================================================= */}
        {phase === 'betting' && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleDeal}
            disabled={isActionDisabled}
            className="w-full py-3.5 bg-[#C8FF00] text-black font-bold rounded-xl text-base transition-all hover:bg-[#B8EF00] active:bg-[#A8DF00] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            DEAL
          </motion.button>
        )}

        {phase === 'deal' && (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleDraw}
            disabled={isLoading}
            className="w-full py-3.5 bg-[#C8FF00] text-black font-bold rounded-xl text-base transition-all hover:bg-[#B8EF00] active:bg-[#A8DF00] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            DRAW
          </motion.button>
        )}

        {phase === 'draw' && (
          <div className="w-full py-3.5 bg-[#2D333B] text-gray-500 font-bold rounded-xl text-base text-center">
            Drawing...
          </div>
        )}

        {phase === 'result' && (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleNewGame}
            className="w-full py-3.5 bg-[#C8FF00] text-black font-bold rounded-xl text-base transition-all hover:bg-[#B8EF00] active:bg-[#A8DF00]"
          >
            NEW DEAL
          </motion.button>
        )}
      </div>

      {/* ================================================================= */}
      {/* Paytable Collapsible                                               */}
      {/* ================================================================= */}
      <div className="px-4 mt-3">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPaytable(!showPaytable)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            <span>Paytable</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showPaytable && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showPaytable && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#30363D] divide-y divide-[#30363D]/50">
                  {PAYOUT_TABLE.map((entry) => {
                    const isCurrentHand = showResult && handName === entry.hand;
                    return (
                      <div
                        key={entry.hand}
                        className={cn(
                          'flex items-center justify-between px-3 py-2 text-xs transition-colors',
                          isCurrentHand ? 'bg-[#C8FF00]/10' : '',
                        )}
                      >
                        <span className={cn('font-medium', isCurrentHand ? 'text-[#C8FF00]' : 'text-[#8B949E]')}>
                          {entry.hand}
                        </span>
                        <span className={cn('font-mono font-bold', isCurrentHand ? 'text-[#C8FF00]' : 'text-[#E6EDF3]')}>
                          {entry.multiplier}x
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bet info */}
      {(phase === 'betting' || phase === 'result') && (
        <div className="flex items-center justify-between text-xs text-[#8B949E] px-5 mt-2">
          <span>Bet: <span className="text-[#E6EDF3] font-mono">{formatCurrency(parseFloat(betAmount) || 0, currency)}</span></span>
          <span>Max Win: <span className="text-[#C8FF00] font-mono">{formatCurrency((parseFloat(betAmount) || 0) * 250, currency)}</span></span>
        </div>
      )}

      {/* History */}
      <div className="px-4 mt-3">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              <span>Recent Hands ({history.length})</span>
            </div>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showHistoryPanel && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showHistoryPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#30363D]">
                  {history.length === 0 ? (
                    <div className="text-center text-[#484F58] text-xs py-6">No hands played yet</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#30363D]/30">
                      {history.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between px-3 py-2 text-xs"
                        >
                          <div>
                            <span className={cn('font-medium', entry.isWin ? 'text-[#10B981]' : 'text-[#8B949E]')}>
                              {entry.handName}
                            </span>
                            <span className="text-[#484F58] ml-2">
                              Bet: {formatCurrency(entry.bet, currency)}
                            </span>
                          </div>
                          <span className={cn('font-mono font-bold', entry.isWin ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                            {entry.isWin ? '+' : '-'}{formatCurrency(entry.isWin ? entry.payout : entry.bet, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Provably Fair */}
      <AnimatePresence>
        {fairnessData && (
          <div className="px-4 mt-3">
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Provably Fair</span>
              </div>
              <div className="space-y-1 text-[10px] font-mono">
                <div className="flex gap-2">
                  <span className="text-gray-600 shrink-0">Hash</span>
                  <span className="text-gray-400 truncate">{fairnessData.serverSeedHash || 'N/A'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-600 shrink-0">Client</span>
                  <span className="text-gray-400 truncate">{fairnessData.clientSeed || 'N/A'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-600 shrink-0">Nonce</span>
                  <span className="text-gray-400">{fairnessData.nonce ?? 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

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
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E] hover:text-white transition-colors">
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
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
