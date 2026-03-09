'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  History,
  Shield,
  Minus,
  Plus,
  ToggleLeft,
  ToggleRight,
  Zap,
  RefreshCw,
  Trophy,
  Coins,
  Star,
  Info,
  Volume2,
  VolumeX,
  ChevronDown,
  Home,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface PlayingCard {
  suit: Suit;
  value: CardValue;
  faceUp: boolean;
}

type GamePhase = 'idle' | 'ante' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'result';
type PokerAction = 'deal' | 'call' | 'fold' | 'raise' | 'check';

type HandRank =
  | 'High Card'
  | 'Pair'
  | 'Two Pair'
  | 'Three of a Kind'
  | 'Straight'
  | 'Flush'
  | 'Full House'
  | 'Four of a Kind'
  | 'Straight Flush'
  | 'Royal Flush';

interface RoundResult {
  roundId: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    playerHand: PlayingCard[];
    dealerHand: PlayingCard[];
    communityCards: PlayingCard[];
    playerHandRank: HandRank;
    dealerHandRank: HandRank;
    winner: 'player' | 'dealer' | 'tie';
    phase: GamePhase;
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
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  playerHand: HandRank;
  winner: 'player' | 'dealer' | 'tie';
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'SOL', 'DOGE'];
const BET_PRESETS = [0.01, 0.1, 1, 10, 100];

const RANK_NUM_TO_NAME: Record<number, HandRank> = {
  0: 'High Card',
  1: 'Pair',
  2: 'Two Pair',
  3: 'Three of a Kind',
  4: 'Straight',
  5: 'Flush',
  6: 'Full House',
  7: 'Four of a Kind',
  8: 'Straight Flush',
  9: 'Royal Flush',
};

function parseHandRank(val: unknown): HandRank {
  if (typeof val === 'number' && val in RANK_NUM_TO_NAME) return RANK_NUM_TO_NAME[val];
  if (typeof val === 'string') {
    const s = val.toLowerCase();
    if (s.includes('royal flush')) return 'Royal Flush';
    if (s.includes('straight flush')) return 'Straight Flush';
    if (s.includes('four of a kind')) return 'Four of a Kind';
    if (s.includes('full house')) return 'Full House';
    if (s.includes('flush')) return 'Flush';
    if (s.includes('straight')) return 'Straight';
    if (s.includes('three of a kind')) return 'Three of a Kind';
    if (s.includes('two pair')) return 'Two Pair';
    if (s.includes('pair') || s.includes('one pair')) return 'Pair';
    return 'High Card';
  }
  return 'High Card';
}

const HAND_RANK_ORDER: HandRank[] = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush',
];

const HAND_RANK_COLORS: Record<HandRank, string> = {
  'High Card': '#6B7280',
  'Pair': '#8B5CF6',
  'Two Pair': '#8B5CF6',
  'Three of a Kind': '#3B82F6',
  'Straight': '#10B981',
  'Flush': '#10B981',
  'Full House': '#F59E0B',
  'Four of a Kind': '#EF4444',
  'Straight Flush': '#EF4444',
  'Royal Flush': '#C8FF00',
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#EF4444',
  diamonds: '#EF4444',
  clubs: '#E5E7EB',
  spades: '#E5E7EB',
};

// ---------------------------------------------------------------------------
// Card Component
// ---------------------------------------------------------------------------

function CardDisplay({
  card,
  index = 0,
  size = 'md',
  dealing = false,
  flipping = false,
}: {
  card: PlayingCard | null;
  index?: number;
  size?: 'sm' | 'md' | 'lg';
  dealing?: boolean;
  flipping?: boolean;
}) {
  const [isFlipped, setIsFlipped] = useState(!card?.faceUp);

  useEffect(() => {
    if (flipping && card?.faceUp) {
      const timer = setTimeout(() => setIsFlipped(false), index * 200);
      return () => clearTimeout(timer);
    }
    setIsFlipped(!card?.faceUp);
  }, [card?.faceUp, flipping, index]);

  const sizeClasses = {
    sm: 'w-11 h-[62px] text-xs',
    md: 'w-14 h-[80px] text-sm',
    lg: 'w-16 h-[92px] text-base',
  };

  if (!card) {
    return (
      <div className={cn(sizeClasses[size], 'rounded-lg border border-[#30363D] bg-[#1C2128] flex items-center justify-center opacity-30')}>
        <span className="text-[#484F58] text-lg">?</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={dealing ? { y: -100, opacity: 0, rotateY: 180 } : false}
      animate={{ y: 0, opacity: 1, rotateY: isFlipped ? 180 : 0 }}
      transition={{
        y: { duration: 0.4, delay: index * 0.15, ease: 'easeOut' },
        opacity: { duration: 0.3, delay: index * 0.15 },
        rotateY: { duration: 0.5, delay: index * 0.15 + (dealing ? 0.3 : 0) },
      }}
      className={cn(sizeClasses[size], 'relative cursor-default')}
      style={{ perspective: '600px', transformStyle: 'preserve-3d' }}
    >
      <div
        className="absolute inset-0 rounded-lg border shadow-lg flex flex-col items-center justify-between p-1 bg-gradient-to-br from-white to-gray-100 border-gray-300"
        style={{ backfaceVisibility: 'hidden' }}
      >
        <div className="flex items-center gap-0.5 self-start">
          <span className="font-bold" style={{ color: SUIT_COLORS[card.suit] }}>{card.value}</span>
          <span style={{ color: SUIT_COLORS[card.suit], fontSize: size === 'sm' ? '9px' : '12px' }}>{SUIT_SYMBOLS[card.suit]}</span>
        </div>
        <span style={{ color: SUIT_COLORS[card.suit], fontSize: size === 'sm' ? '16px' : size === 'md' ? '22px' : '28px' }}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
        <div className="flex items-center gap-0.5 self-end rotate-180">
          <span className="font-bold" style={{ color: SUIT_COLORS[card.suit] }}>{card.value}</span>
          <span style={{ color: SUIT_COLORS[card.suit], fontSize: size === 'sm' ? '9px' : '12px' }}>{SUIT_SYMBOLS[card.suit]}</span>
        </div>
      </div>
      <div
        className="absolute inset-0 rounded-lg border shadow-lg bg-gradient-to-br from-[#1C2128] to-[#0D1117] border-[#30363D]"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-[70%] h-[70%] border border-[#30363D] rounded-md flex items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(200,255,0,0.03)_3px,rgba(200,255,0,0.03)_6px)]">
            <Star className="w-4 h-4 text-[#C8FF00]/20" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Poker Page Component
// ---------------------------------------------------------------------------

export default function PokerPage() {
  const { user, isAuthenticated } = useAuthStore();
  const balances = user?.balances ?? [];

  const [currency, setCurrency] = useState('USDT');
  const [betAmount, setBetAmount] = useState('1.00');
  const [raiseAmount, setRaiseAmount] = useState('2.00');

  // Game state
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [playerCards, setPlayerCards] = useState<PlayingCard[]>([]);
  const [dealerCards, setDealerCards] = useState<PlayingCard[]>([]);
  const [communityCards, setCommunityCards] = useState<(PlayingCard | null)[]>([null, null, null, null, null]);
  const [pot, setPot] = useState(0);
  const [playerHandRank, setPlayerHandRank] = useState<HandRank | null>(null);
  const [dealerHandRank, setDealerHandRank] = useState<HandRank | null>(null);
  const [winner, setWinner] = useState<'player' | 'dealer' | 'tie' | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [isDealing, setIsDealing] = useState(false);
  const [currentBet, setCurrentBet] = useState(0);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showFairness, setShowFairness] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [manualMode, setManualMode] = useState(true);

  // Auto-bet
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(0);
  const [autoBetMaxRounds, setAutoBetMaxRounds] = useState(10);
  const [autoBetStopOnWin, setAutoBetStopOnWin] = useState(0);
  const [autoBetStopOnLoss, setAutoBetStopOnLoss] = useState(0);
  const [autoBetOnWin, setAutoBetOnWin] = useState<'reset' | 'increase'>('reset');
  const [autoBetOnLoss, setAutoBetOnLoss] = useState<'reset' | 'increase'>('reset');
  const [autoBetIncreaseWin, setAutoBetIncreaseWin] = useState(0);
  const [autoBetIncreaseLoss, setAutoBetIncreaseLoss] = useState(100);
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const autoBetRef = useRef(false);
  const autoBetProfitRef = useRef(0);
  const [showAutoBet, setShowAutoBet] = useState(false);

  const historyScrollRef = useRef<HTMLDivElement>(null);

  // Derived
  const currentBalance = useMemo(() => {
    const bal = balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [balances, currency]);

  const canDeal = phase === 'idle' && parseFloat(betAmount) > 0 && parseFloat(betAmount) <= currentBalance;
  const canAct = ['preflop', 'flop', 'turn', 'river'].includes(phase) && !isLoading;

  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollLeft = 0;
    }
  }, [history.length]);

  // API Call
  const playAction = useCallback(
    async (action: PokerAction, extraRaise?: number) => {
      setIsLoading(true);
      setError(null);

      try {
        let raw: any;
        if (action === 'deal') {
          raw = await post<any>('/casino/poker/deal', {
            amount: parseFloat(betAmount),
            currency,
          });
        } else {
          const actionBody: Record<string, unknown> = { action };
          if (action === 'raise' && extraRaise) {
            actionBody.raiseAmount = extraRaise;
          }
          raw = await post<any>('/casino/poker/action', actionBody);
        }

        const gameResult = raw.result || raw;
        const newBalance = raw.newBalance ?? gameResult.newBalance ?? 0;

        const totalBet = gameResult.totalBet ?? gameResult.anteBet ?? parseFloat(betAmount);
        const payout = gameResult.payout ?? 0;

        const res: RoundResult = {
          roundId: 'active',
          betAmount: totalBet,
          payout,
          profit: payout - totalBet,
          multiplier: totalBet > 0 && payout > 0 ? payout / totalBet : 0,
          result: {
            playerHand: (gameResult.playerHand || []).map((c: any) => ({
              suit: c.suit || 'spades',
              value: c.rank || c.value || '?',
              faceUp: c.suit !== 'hidden',
            })),
            dealerHand: (gameResult.dealerHand || []).map((c: any) => ({
              suit: c.suit || 'spades',
              value: c.rank || c.value || '?',
              faceUp: c.suit !== 'hidden',
            })),
            communityCards: (gameResult.communityCards || []).map((c: any) => ({
              suit: c.suit || 'spades',
              value: c.rank || c.value || '?',
              faceUp: true,
            })),
            playerHandRank: gameResult.playerHandRank != null
              ? parseHandRank(gameResult.playerHandRank)
              : gameResult.playerHandName
                ? parseHandRank(gameResult.playerHandName)
                : 'High Card',
            dealerHandRank: gameResult.dealerHandRank != null
              ? parseHandRank(gameResult.dealerHandRank)
              : gameResult.dealerHandName
                ? parseHandRank(gameResult.dealerHandName)
                : 'High Card',
            winner: gameResult.winner || 'dealer',
            phase: gameResult.phase || 'preflop',
          },
          fairness: {
            serverSeedHash: gameResult.serverSeedHash || '',
            clientSeed: '',
            nonce: 0,
          },
          newBalance,
        };

        useAuthStore.getState().updateBalance(currency, newBalance, 0);

        return res;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [betAmount, currency]
  );

  const addHistory = useCallback((data: RoundResult) => {
    const entry: HistoryEntry = {
      id: data.roundId,
      betAmount: data.betAmount,
      payout: data.payout,
      profit: data.profit,
      multiplier: data.multiplier,
      playerHand: data.result.playerHandRank,
      winner: data.result.winner,
      timestamp: Date.now(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const handleNewRound = useCallback(() => {
    setPhase('idle');
    setPlayerCards([]);
    setDealerCards([]);
    setCommunityCards([null, null, null, null, null]);
    setPot(0);
    setPlayerHandRank(null);
    setDealerHandRank(null);
    setWinner(null);
    setCurrentBet(0);
    setError(null);
  }, []);

  const stopAutoBet = useCallback(() => {
    autoBetRef.current = false;
    setIsAutoBetting(false);
  }, []);

  const handleAutoBetNext = useCallback(
    (data: RoundResult) => {
      if (!autoBetRef.current) return;

      const totalProfit = autoBetProfitRef.current;

      if (autoBetStopOnWin > 0 && totalProfit >= autoBetStopOnWin) { stopAutoBet(); return; }
      if (autoBetStopOnLoss > 0 && totalProfit <= -autoBetStopOnLoss) { stopAutoBet(); return; }
      if (autoBetCount + 1 >= autoBetMaxRounds) { stopAutoBet(); return; }

      if (data.profit > 0) {
        if (autoBetOnWin === 'reset') {
          setBetAmount(getDefaultBet(currency));
        } else {
          setBetAmount((prev) => {
            const newBet = parseFloat(prev) * (1 + autoBetIncreaseWin / 100);
            return newBet.toFixed(4);
          });
        }
      } else {
        if (autoBetOnLoss === 'reset') {
          setBetAmount(getDefaultBet(currency));
        } else {
          setBetAmount((prev) => {
            const newBet = parseFloat(prev) * (1 + autoBetIncreaseLoss / 100);
            return newBet.toFixed(4);
          });
        }
      }

      setTimeout(() => {
        if (autoBetRef.current) {
          handleNewRound();
        }
      }, 1500);
    },
    [autoBetCount, autoBetMaxRounds, autoBetStopOnWin, autoBetStopOnLoss, autoBetOnWin, autoBetOnLoss, autoBetIncreaseWin, autoBetIncreaseLoss, currency, handleNewRound, stopAutoBet]
  );

  const triggerShowdown = useCallback(
    (data: RoundResult) => {
      const revealedDealer = data.result.dealerHand.map((c) => ({ ...c, faceUp: true }));
      setDealerCards(revealedDealer);
      setDealerHandRank(data.result.dealerHandRank);
      setCommunityCards(
        (data.result.communityCards || []).map((c) => (c ? { ...c, faceUp: true } : null))
      );

      setTimeout(() => {
        setWinner(data.result.winner);
        setPhase('result');
        addHistory(data);

        if (autoBetRef.current) {
          autoBetProfitRef.current += data.profit;
          setAutoBetCount((prev) => prev + 1);
          handleAutoBetNext(data);
        }
      }, 1200);
    },
    [addHistory, handleAutoBetNext]
  );

  const advancePhase = useCallback(
    (data: RoundResult, currentPhase: GamePhase, onComplete: (nextPhase: GamePhase) => void) => {
      const cc = data.result.communityCards || [];
      let nextPhase: GamePhase = 'idle';

      if (currentPhase === 'preflop') {
        const newCC: (PlayingCard | null)[] = [
          cc[0] ? { ...cc[0], faceUp: true } : null,
          cc[1] ? { ...cc[1], faceUp: true } : null,
          cc[2] ? { ...cc[2], faceUp: true } : null,
          null, null,
        ];
        setCommunityCards(newCC);
        nextPhase = 'flop';
      } else if (currentPhase === 'flop') {
        setCommunityCards((prev) => {
          const updated = [...prev];
          updated[3] = cc[3] ? { ...cc[3], faceUp: true } : null;
          return updated;
        });
        nextPhase = 'turn';
      } else if (currentPhase === 'turn') {
        setCommunityCards((prev) => {
          const updated = [...prev];
          updated[4] = cc[4] ? { ...cc[4], faceUp: true } : null;
          return updated;
        });
        nextPhase = 'river';
      } else if (currentPhase === 'river') {
        nextPhase = 'showdown';
      }

      if (data.result.playerHandRank) {
        setPlayerHandRank(data.result.playerHandRank);
      }

      onComplete(nextPhase);
    },
    []
  );

  // Deal
  const handleDeal = useCallback(async () => {
    if (!canDeal && !isAutoBetting) return;

    setPhase('ante');
    setWinner(null);
    setDealerHandRank(null);
    setPlayerHandRank(null);
    setIsDealing(true);
    setCommunityCards([null, null, null, null, null]);
    setDealerCards([]);
    setPlayerCards([]);
    setCurrentBet(parseFloat(betAmount));
    setPot(parseFloat(betAmount) * 2);

    const data = await playAction('deal');
    if (!data) { setPhase('idle'); setIsDealing(false); return; }

    setLastResult(data);

    const pCards = data.result.playerHand.map((c) => ({ ...c, faceUp: true }));
    setPlayerCards(pCards);

    const dCards = data.result.dealerHand.map((c) => ({ ...c, faceUp: false }));
    setDealerCards(dCards);

    if (data.result.playerHandRank) {
      setPlayerHandRank(data.result.playerHandRank);
    }

    setTimeout(() => {
      setIsDealing(false);
      setPhase('preflop');
    }, 800);
  }, [canDeal, isAutoBetting, betAmount, playAction]);

  // Call
  const handleCall = useCallback(async () => {
    if (!canAct) return;
    setIsDealing(true);

    const data = await playAction('call');
    if (!data) { setIsDealing(false); return; }

    setLastResult(data);
    setPot(data.betAmount * 2);

    const currentPhase = phase;

    advancePhase(data, currentPhase, (nextPhase) => {
      setTimeout(() => {
        setPhase(nextPhase);
        setIsDealing(false);
        if (nextPhase === 'showdown' || data.result.phase === 'showdown') {
          triggerShowdown(data);
        }
      }, 600);
    });
  }, [canAct, phase, playAction, advancePhase, triggerShowdown]);

  // Raise
  const handleRaise = useCallback(async () => {
    if (!canAct) return;
    const raise = parseFloat(raiseAmount);
    if (isNaN(raise) || raise <= 0) return;

    setIsDealing(true);
    setCurrentBet((prev) => prev + raise);
    setPot((prev) => prev + raise * 2);

    const data = await playAction('raise', raise);
    if (!data) { setIsDealing(false); return; }

    setLastResult(data);

    const currentPhase = phase;

    advancePhase(data, currentPhase, (nextPhase) => {
      setTimeout(() => {
        setPhase(nextPhase);
        setIsDealing(false);
        if (nextPhase === 'showdown' || data.result.phase === 'showdown') {
          triggerShowdown(data);
        }
      }, 600);
    });
  }, [canAct, phase, raiseAmount, playAction, advancePhase, triggerShowdown]);

  // Fold
  const handleFold = useCallback(async () => {
    if (!canAct) return;

    const data = await playAction('fold');
    if (!data) return;

    setLastResult(data);
    setWinner('dealer');
    setPhase('result');

    const revealedDealer = data.result.dealerHand.map((c) => ({ ...c, faceUp: true }));
    setDealerCards(revealedDealer);
    if (data.result.dealerHandRank) {
      setDealerHandRank(data.result.dealerHandRank);
    }

    addHistory(data);

    if (autoBetRef.current) {
      autoBetProfitRef.current += data.profit;
      setAutoBetCount((prev) => prev + 1);
      handleAutoBetNext(data);
    }
  }, [canAct, playAction, addHistory, handleAutoBetNext]);

  // Auto-bet start
  const startAutoBet = useCallback(() => {
    autoBetRef.current = true;
    autoBetProfitRef.current = 0;
    setIsAutoBetting(true);
    setAutoBetCount(0);
    handleDeal();
  }, [handleDeal]);

  // Bet helpers
  const adjustBet = useCallback(
    (multiplier: number) => {
      const current = parseFloat(betAmount) || 0;
      const newVal = Math.max(0.0001, current * multiplier);
      setBetAmount(newVal.toFixed(4));
    },
    [betAmount]
  );

  const adjustRaise = useCallback(
    (delta: number) => {
      const current = parseFloat(raiseAmount) || 0;
      const newVal = Math.max(0.01, current + delta);
      setRaiseAmount(newVal.toFixed(4));
    },
    [raiseAmount]
  );

  // Phase label
  const phaseLabel = useMemo(() => {
    const labels: Record<GamePhase, string> = {
      idle: 'Place Your Ante',
      ante: 'Dealing...',
      preflop: 'Pre-Flop',
      flop: 'Flop',
      turn: 'Turn',
      river: 'River',
      showdown: 'Showdown',
      result: winner === 'player' ? 'You Win!' : winner === 'tie' ? 'Push' : 'Dealer Wins',
    };
    return labels[phase];
  }, [phase, winner]);

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-sm font-bold tracking-widest text-white">CRYPTOBET</span>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-3 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards display area -- edge-to-edge */}
      <div className="bg-[#161B22] border-b border-[#30363D] p-4 space-y-4">
        {/* Phase + Pot */}
        <div className="flex items-center justify-between">
          <motion.span
            key={phaseLabel}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'text-sm font-bold px-3 py-1 rounded-full',
              phase === 'result'
                ? winner === 'player'
                  ? 'bg-[#10B981]/15 text-[#10B981]'
                  : winner === 'tie'
                    ? 'bg-[#C8FF00]/15 text-[#C8FF00]'
                    : 'bg-[#EF4444]/15 text-[#EF4444]'
                : 'bg-[#0D1117] border border-[#30363D] text-[#E6EDF3]'
            )}
          >
            {phaseLabel}
          </motion.span>
          {pot > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C8FF00]/10 border border-[#C8FF00]/20">
              <Coins className="w-3.5 h-3.5 text-[#C8FF00]" />
              <span className="text-[#C8FF00] font-mono font-bold text-xs">{pot.toFixed(4)}</span>
            </div>
          )}
        </div>

        {/* Dealer */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-[#8B949E] font-medium mb-1.5 uppercase tracking-wider">Dealer</span>
          <div className="flex gap-2">
            {dealerCards.length > 0 ? (
              dealerCards.map((card, i) => (
                <CardDisplay key={`d-${i}`} card={card} index={i} size="md" dealing={isDealing} flipping={phase === 'showdown' || phase === 'result'} />
              ))
            ) : (
              <><CardDisplay card={null} size="md" /><CardDisplay card={null} size="md" /></>
            )}
          </div>
          {dealerHandRank && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${HAND_RANK_COLORS[dealerHandRank]}20`, color: HAND_RANK_COLORS[dealerHandRank], border: `1px solid ${HAND_RANK_COLORS[dealerHandRank]}40` }}>
              {dealerHandRank}
            </motion.span>
          )}
        </div>

        {/* Community Cards */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-[#8B949E] font-medium mb-1.5 uppercase tracking-wider">Community</span>
          <div className="flex gap-1.5">
            {communityCards.map((card, i) => (
              <CardDisplay key={`c-${i}`} card={card} index={i} size="sm" dealing={isDealing} flipping={true} />
            ))}
          </div>
        </div>

        {/* Player */}
        <div className="flex flex-col items-center">
          <div className="flex gap-2">
            {playerCards.length > 0 ? (
              playerCards.map((card, i) => (
                <CardDisplay key={`p-${i}`} card={card} index={i} size="lg" dealing={isDealing} flipping={true} />
              ))
            ) : (
              <><CardDisplay card={null} size="lg" /><CardDisplay card={null} size="lg" /></>
            )}
          </div>
          <span className="text-[10px] text-[#8B949E] font-medium mt-1.5 uppercase tracking-wider">Your Hand</span>
          {playerHandRank && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${HAND_RANK_COLORS[playerHandRank]}20`, color: HAND_RANK_COLORS[playerHandRank], border: `1px solid ${HAND_RANK_COLORS[playerHandRank]}40` }}>
              {playerHandRank}
            </motion.span>
          )}
        </div>

        {/* Win/Loss overlay */}
        <AnimatePresence>
          {phase === 'result' && winner && lastResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                'text-center p-3 rounded-xl border',
                winner === 'player' ? 'bg-[#10B981]/10 border-[#10B981]/30' : winner === 'tie' ? 'bg-[#C8FF00]/10 border-[#C8FF00]/30' : 'bg-[#EF4444]/10 border-[#EF4444]/30',
              )}
            >
              <div className={cn('text-lg font-black', winner === 'player' ? 'text-[#10B981]' : winner === 'tie' ? 'text-[#C8FF00]' : 'text-[#EF4444]')}>
                {winner === 'player' ? 'YOU WIN!' : winner === 'dealer' ? 'DEALER WINS' : 'PUSH'}
              </div>
              {winner === 'player' && (
                <div className="text-sm font-mono text-[#10B981] mt-1">+{lastResult.profit.toFixed(4)} {currency}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 space-y-3 mt-3">
        {/* Action Buttons -- pills in a row */}
        <div className="space-y-3">
          {phase === 'idle' || phase === 'result' ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={phase === 'result' ? handleNewRound : handleDeal}
              disabled={phase === 'idle' && !canDeal}
              className={cn(
                'font-bold py-3.5 rounded-xl w-full text-base transition-all',
                (phase === 'result' || canDeal)
                  ? 'bg-[#C8FF00] text-black'
                  : 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
              )}
            >
              {phase === 'result' ? 'NEW HAND' : 'DEAL'}
            </motion.button>
          ) : (
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCall}
                disabled={!canAct}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-sm transition-all',
                  canAct
                    ? 'bg-[#C8FF00] text-black'
                    : 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                )}
              >
                {phase === 'river' ? 'Call' : 'Check'}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRaise}
                disabled={!canAct}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-sm transition-all',
                  canAct
                    ? 'bg-[#2D333B] text-white'
                    : 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                )}
              >
                Bet
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFold}
                disabled={!canAct}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-sm transition-all',
                  canAct
                    ? 'bg-[#2D333B] text-white'
                    : 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                )}
              >
                Fold
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRaise}
                disabled={!canAct}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-sm transition-all',
                  canAct
                    ? 'bg-[#2D333B] text-white'
                    : 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                )}
              >
                Raise
              </motion.button>
            </div>
          )}

          {/* Raise amount input when in play */}
          {canAct && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8B949E]">Raise:</span>
              <div className="flex-1 flex items-center bg-[#0D1117] border border-[#30363D] rounded-lg overflow-hidden">
                <button onClick={() => adjustRaise(-0.5)} className="px-2.5 py-2 text-[#8B949E] hover:text-[#E6EDF3]">
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(e.target.value)}
                  className="flex-1 text-center bg-transparent text-[#E6EDF3] text-sm font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button onClick={() => adjustRaise(0.5)} className="px-2.5 py-2 text-[#8B949E] hover:text-[#E6EDF3]">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
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
              disabled={phase !== 'idle'}
              className="flex-1 text-center bg-transparent text-white text-sm font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => adjustBet(0.5)}
                disabled={phase !== 'idle'}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white hover:bg-[#3D434B] transition-colors disabled:opacity-50"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => adjustBet(2)}
                disabled={phase !== 'idle'}
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
                onClick={() => setBetAmount(String(val))}
                disabled={phase !== 'idle'}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
              >
                {val}
              </button>
            ))}
            <button
              onClick={() => adjustBet(0.5)}
              disabled={phase !== 'idle'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
            >
              1/2
            </button>
            <button
              onClick={() => adjustBet(2)}
              disabled={phase !== 'idle'}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-50"
            >
              2X
            </button>
          </div>
        </div>

        {/* History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
                <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#C8FF00]" /> History
                </h3>
                {history.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#484F58]">No rounds played yet</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {history.map((entry) => (
                      <div key={entry.id + entry.timestamp} className="px-3 py-2 flex items-center justify-between text-xs bg-[#0D1117] rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-bold',
                            entry.winner === 'player' ? 'text-[#10B981]' : entry.winner === 'tie' ? 'text-[#C8FF00]' : 'text-[#EF4444]'
                          )}>
                            {entry.multiplier.toFixed(2)}x
                          </span>
                          <span className="text-[#8B949E]">{entry.playerHand}</span>
                        </div>
                        <span className={cn(
                          'font-mono font-bold',
                          entry.profit > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                        )}>
                          {entry.profit > 0 ? '+' : ''}{entry.profit.toFixed(4)}
                        </span>
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
          {showFairness && lastResult?.fairness && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 text-xs text-[#8B949E] space-y-1">
                <p><span className="text-[#E6EDF3] font-medium">Server Seed Hash:</span> <span className="font-mono break-all">{lastResult.fairness.serverSeedHash || 'N/A'}</span></p>
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
