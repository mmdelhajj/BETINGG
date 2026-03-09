'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, Home, Info, Volume2, VolumeX } from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Card {
  rank: string;
  suit: string;
  value: number;
  hidden?: boolean;
}

interface GameResult {
  playerHand: Card[];
  dealerHand: Card[];
  playerTotal: number;
  dealerTotal: number;
  status: 'playing' | 'dealer_turn' | 'blackjack' | 'bust' | 'win' | 'lose' | 'push';
  canHit: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canInsurance: boolean;
  payout: number;
  multiplier: number;
}

interface BlackjackResponse {
  roundId: string;
  result: GameResult;
  fairness: { serverSeedHash: string; clientSeed: string; nonce: number };
  newBalance: number;
}

type HistoryEntry = 'W' | 'L' | 'P' | 'BJ';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'SOL', 'DOGE', 'BNB', 'XRP'];
const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660',
  h: '\u2665', d: '\u2666', c: '\u2663', s: '\u2660',
  Hearts: '\u2665', Diamonds: '\u2666', Clubs: '\u2663', Spades: '\u2660',
  H: '\u2665', D: '\u2666', C: '\u2663', S: '\u2660',
  '\u2665': '\u2665', '\u2666': '\u2666', '\u2663': '\u2663', '\u2660': '\u2660',
};

function getSuitSymbol(suit: string): string {
  return SUIT_SYMBOLS[suit] || suit;
}

function isRedSuit(suit: string): boolean {
  const s = getSuitSymbol(suit);
  return s === '\u2665' || s === '\u2666';
}

function getRankDisplay(rank: string): string {
  const r = rank.toUpperCase();
  if (r === 'ACE' || r === '1') return 'A';
  if (r === 'JACK') return 'J';
  if (r === 'QUEEN') return 'Q';
  if (r === 'KING') return 'K';
  return rank;
}

// ---------------------------------------------------------------------------
// Card Back Pattern
// ---------------------------------------------------------------------------

function CardBackPattern() {
  return (
    <div className="absolute inset-0 rounded-lg overflow-hidden">
      <div className="absolute inset-[3px] rounded-md bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 border border-blue-600/40">
        <div
          className="absolute inset-1 rounded opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.08) 4px, rgba(255,255,255,0.08) 5px), repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.08) 4px, rgba(255,255,255,0.08) 5px)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-blue-400/40 flex items-center justify-center">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-blue-400/30 bg-blue-600/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playing Card Component
// ---------------------------------------------------------------------------

function PlayingCard({
  card,
  index,
  hidden = false,
  flipping = false,
  bustTint = false,
  delay = 0,
}: {
  card: Card;
  index: number;
  hidden?: boolean;
  flipping?: boolean;
  bustTint?: boolean;
  delay?: number;
}) {
  const rank = getRankDisplay(card.rank);
  const suit = getSuitSymbol(card.suit);
  const red = isRedSuit(card.suit);
  const isFace = ['J', 'Q', 'K'].includes(rank);
  const isAce = rank === 'A';
  const suitColor = red ? 'text-red-500' : 'text-gray-900';

  const centerSuits = () => {
    const val = card.value || parseInt(rank) || 0;
    if (isFace || isAce || val < 2 || val > 10) return null;
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={cn('text-base sm:text-xl opacity-40', suitColor)}>{suit}</span>
      </div>
    );
  };

  const faceSymbol = () => {
    if (isAce) return <span className={cn('text-2xl sm:text-4xl', suitColor)}>{suit}</span>;
    if (rank === 'J') return <span className="text-lg sm:text-2xl">&#x1F0B1;</span>;
    if (rank === 'Q') return <span className="text-lg sm:text-2xl">&#x1F0BD;</span>;
    if (rank === 'K') return <span className="text-lg sm:text-2xl">&#x1F0BE;</span>;
    return null;
  };

  return (
    <motion.div
      initial={{ x: 200, y: -100, opacity: 0, rotateY: 180 }}
      animate={{
        x: 0,
        y: 0,
        opacity: 1,
        rotateY: flipping ? [180, 0] : 0,
      }}
      transition={{
        duration: 0.5,
        delay: delay + index * 0.2,
        rotateY: { duration: 0.6, delay: delay + index * 0.2 + 0.1 },
      }}
      className="relative shrink-0"
      style={{
        perspective: '800px',
        marginLeft: index > 0 ? '-16px' : '0',
        zIndex: index,
      }}
    >
      <div
        className={cn(
          'w-[56px] h-[80px] sm:w-[72px] sm:h-[104px]',
          'rounded-lg relative select-none',
          'shadow-[0_4px_12px_rgba(0,0,0,0.5),0_1px_3px_rgba(0,0,0,0.3)]',
          'transition-all duration-300',
          bustTint && !hidden && 'brightness-75 saturate-50',
        )}
      >
        {hidden ? (
          <CardBackPattern />
        ) : (
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white via-gray-50 to-gray-100 border border-gray-300/60 overflow-hidden">
            <div className="absolute inset-0 rounded-lg shadow-inner pointer-events-none" />
            <div className="absolute top-[3px] left-[4px] sm:top-1 sm:left-1.5 flex flex-col items-center leading-none">
              <span className={cn('text-[11px] sm:text-sm font-bold', suitColor)}>{rank}</span>
              <span className={cn('text-[10px] sm:text-xs -mt-0.5', suitColor)}>{suit}</span>
            </div>
            <div className="absolute bottom-[3px] right-[4px] sm:bottom-1 sm:right-1.5 flex flex-col items-center leading-none rotate-180">
              <span className={cn('text-[11px] sm:text-sm font-bold', suitColor)}>{rank}</span>
              <span className={cn('text-[10px] sm:text-xs -mt-0.5', suitColor)}>{suit}</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              {isFace || isAce ? faceSymbol() : centerSuits()}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Hand Total Badge
// ---------------------------------------------------------------------------

function HandTotalBadge({ total, isBust, isBlackjack }: { total: number; isBust: boolean; isBlackjack: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn(
        'px-3 py-1 rounded-full flex items-center justify-center',
        'font-bold text-sm shadow-lg',
        isBlackjack
          ? 'bg-[#C8FF00] text-black'
          : isBust
          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
          : total >= 17 && total <= 20
          ? 'bg-[#C8FF00]/20 text-[#C8FF00] border border-[#C8FF00]/40'
          : total === 21
          ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
          : 'bg-[#30363D] text-gray-300 border border-[#30363D]',
      )}
    >
      {isBust ? 'BUST' : total}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Insurance Prompt
// ---------------------------------------------------------------------------

function InsurancePrompt({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-[#161B22]/95 border border-[#C8FF00]/30 rounded-xl p-4 sm:p-6 text-center"
    >
      <div className="text-[#C8FF00] font-bold text-base sm:text-lg mb-1">Insurance?</div>
      <p className="text-gray-400 text-xs sm:text-sm mb-4">Dealer shows an Ace. Insure against Blackjack?</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onAccept}
          className="px-5 py-2 rounded-xl bg-[#C8FF00] text-black font-bold text-sm transition-colors hover:bg-[#B8EF00]"
        >
          Yes (1:2 bet)
        </button>
        <button
          onClick={onDecline}
          className="px-5 py-2 rounded-xl bg-[#30363D] hover:bg-[#3D444D] text-white font-semibold text-sm transition-colors"
        >
          No Thanks
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Result Overlay
// ---------------------------------------------------------------------------

function ResultOverlay({
  status,
  payout,
  multiplier,
  currency,
}: {
  status: string;
  payout: number;
  multiplier: number;
  currency: string;
}) {
  const isWin = status === 'win' || status === 'blackjack';
  const isPush = status === 'push';

  const label =
    status === 'blackjack'
      ? 'BLACKJACK!'
      : status === 'win'
      ? 'YOU WIN!'
      : status === 'bust'
      ? 'BUST!'
      : status === 'push'
      ? 'PUSH'
      : 'DEALER WINS';

  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.3, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 text-center"
    >
      <div
        className={cn(
          'text-2xl sm:text-4xl font-black drop-shadow-2xl',
          status === 'blackjack' && 'text-[#C8FF00]',
          isWin && status !== 'blackjack' && 'text-[#10B981]',
          isPush && 'text-yellow-400',
          (status === 'bust' || status === 'lose') && 'text-[#EF4444]',
        )}
      >
        {label}
      </div>

      {payout > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-2 text-lg sm:text-xl font-bold text-[#10B981]"
        >
          +{formatCurrency(payout, currency)}
          {multiplier > 1 && (
            <span className="ml-2 text-sm text-gray-400">({multiplier}x)</span>
          )}
        </motion.div>
      )}

      {isPush && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-1 text-sm text-gray-400"
        >
          Bet returned
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// History Badge
// ---------------------------------------------------------------------------

function HistoryBadge({ entry }: { entry: HistoryEntry }) {
  const config: Record<HistoryEntry, { bg: string; text: string; label: string }> = {
    W: { bg: 'bg-[#10B981]', text: 'text-white', label: 'W' },
    L: { bg: 'bg-[#EF4444]', text: 'text-white', label: 'L' },
    P: { bg: 'bg-yellow-500', text: 'text-black', label: 'P' },
    BJ: { bg: 'bg-[#C8FF00]', text: 'text-black', label: 'BJ' },
  };
  const c = config[entry];
  return (
    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold', c.bg, c.text)}>
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Currency Selector Dropdown
// ---------------------------------------------------------------------------

function CurrencySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#0D1117] border border-[#30363D] text-sm font-mono text-white hover:border-[#C8FF00]/40 transition-colors"
      >
        {value}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-full mt-1 right-0 z-50 bg-[#161B22] border border-[#30363D] rounded-lg shadow-xl overflow-hidden min-w-[100px]"
          >
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm font-mono hover:bg-[#1C2128] transition-colors',
                  c === value ? 'text-[#C8FF00] bg-[#C8FF00]/5' : 'text-gray-300',
                )}
              >
                {c}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Blackjack Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function BlackjackPage() {
  const { isAuthenticated } = useAuthStore();
  const storeCurrency = useBetSlipStore((s) => s.currency);

  // Game state
  const [currency, setCurrency] = useState(storeCurrency || 'USDT');
  const [betAmount, setBetAmount] = useState('1.00');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [dealerTotal, setDealerTotal] = useState(0);
  const [status, setStatus] = useState<string>('idle');
  const [canHit, setCanHit] = useState(false);
  const [canDouble, setCanDouble] = useState(false);
  const [canSplit, setCanSplit] = useState(false);
  const [canInsurance, setCanInsurance] = useState(false);
  const [payout, setPayout] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showInsurancePrompt, setShowInsurancePrompt] = useState(false);
  const [fairness, setFairness] = useState<{ serverSeedHash: string; clientSeed: string; nonce: number } | null>(null);
  const [dealerRevealing, setDealerRevealing] = useState(false);
  const [prevDealerCardCount, setPrevDealerCardCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Keep currency synced with store
  useEffect(() => {
    if (storeCurrency) setCurrency(storeCurrency);
  }, [storeCurrency]);

  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  const isGameOver = ['blackjack', 'bust', 'win', 'lose', 'push'].includes(status);
  const isPlaying = status === 'playing';
  const isDealerTurn = status === 'dealer_turn';

  const balance = useAuthStore.getState().user?.balances?.find((b) => b.currency === currency)?.available ?? 0;

  // ---------------------------------------------------------------------------
  // Apply response from backend
  // ---------------------------------------------------------------------------

  const applyResponse = useCallback(
    (data: BlackjackResponse) => {
      const r = data.result;
      setRoundId(data.roundId);
      setPlayerHand(r.playerHand);
      setPrevDealerCardCount((prev) => {
        if (r.dealerHand.length > prev) {
          setDealerRevealing(true);
          setTimeout(() => setDealerRevealing(false), 800);
        }
        return r.dealerHand.length;
      });
      setDealerHand(r.dealerHand);
      setPlayerTotal(r.playerTotal);
      setDealerTotal(r.dealerTotal);
      setCanHit(r.canHit);
      setCanDouble(r.canDouble);
      setCanSplit(r.canSplit);
      setCanInsurance(r.canInsurance);
      setPayout(r.payout || 0);
      setMultiplier(r.multiplier || 0);
      setFairness(data.fairness || null);

      if (r.canInsurance && r.status === 'playing') {
        setShowInsurancePrompt(true);
      } else {
        setShowInsurancePrompt(false);
      }

      setStatus(r.status);

      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }

      if (['win', 'lose', 'push', 'blackjack', 'bust'].includes(r.status)) {
        let entry: HistoryEntry = 'L';
        if (r.status === 'blackjack') entry = 'BJ';
        else if (r.status === 'win') entry = 'W';
        else if (r.status === 'push') entry = 'P';
        else entry = 'L';
        setHistory((prev) => [entry, ...prev].slice(0, 10));
      }
    },
    [currency],
  );

  // ---------------------------------------------------------------------------
  // Deal new hand
  // ---------------------------------------------------------------------------

  const handleDeal = async () => {
    if (!isAuthenticated) {
      setError('Please log in to play.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPayout(0);
    setMultiplier(0);
    setDealerRevealing(false);
    setPrevDealerCardCount(0);

    try {
      const data = await post<BlackjackResponse>('/casino/blackjack/deal', {
        amount: parseFloat(betAmount),
        currency,
      });
      applyResponse(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to deal. Please try again.');
      setStatus('idle');
    }

    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Player action
  // ---------------------------------------------------------------------------

  const handleAction = async (action: 'hit' | 'stand' | 'double' | 'split' | 'insurance') => {
    if (status !== 'playing') return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await post<BlackjackResponse>(`/casino/blackjack/${action}`, {
        action,
        roundId,
      });
      applyResponse(data);
    } catch (err: any) {
      setError(err?.message || 'Action failed. Please try again.');
    }

    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Insurance handlers
  // ---------------------------------------------------------------------------

  const handleInsuranceAccept = () => {
    setShowInsurancePrompt(false);
    handleAction('insurance');
  };

  const handleInsuranceDecline = () => {
    setShowInsurancePrompt(false);
  };

  // ---------------------------------------------------------------------------
  // Bet helpers
  // ---------------------------------------------------------------------------

  const halveBet = () => {
    const v = parseFloat(betAmount);
    if (!isNaN(v) && v > 0) setBetAmount((v / 2).toFixed(8).replace(/\.?0+$/, ''));
  };

  const doubleBet = () => {
    const v = parseFloat(betAmount);
    if (!isNaN(v)) setBetAmount((v * 2).toFixed(8).replace(/\.?0+$/, ''));
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
  // Dealer visibility
  // ---------------------------------------------------------------------------

  const hasHiddenDealerCard = dealerHand.some((c) => c.hidden);
  const visibleDealerTotal = hasHiddenDealerCard
    ? dealerHand.filter((c) => !c.hidden).reduce((sum, c) => sum + c.value, 0)
    : dealerTotal;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col pb-20">

      {/* ================================================================= */}
      {/* Top Header Bar - CRYPTOBET centered                               */}
      {/* ================================================================= */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-base tracking-wider">
          CRYPTO<span className="text-[#8B5CF6]">BET</span>
        </span>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 mt-2"
          >
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-4 py-2 text-center">
              <span className="text-xs font-medium text-[#EF4444]">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================= */}
      {/* CARD TABLE AREA - edge-to-edge                                    */}
      {/* ================================================================= */}
      <div className="relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse at center, #1a3a28 0%, #142a1e 60%, #0D1117 100%)',
          minHeight: '340px',
        }}
      >
        {/* Table content */}
        <div className="relative z-10 flex flex-col items-center justify-between h-full py-5 px-4" style={{ minHeight: '340px' }}>

          {/* ---- DEALER AREA (top) ---- */}
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Dealer</span>
              {dealerHand.length > 0 && (
                <HandTotalBadge
                  total={visibleDealerTotal}
                  isBust={!hasHiddenDealerCard && dealerTotal > 21}
                  isBlackjack={!hasHiddenDealerCard && dealerTotal === 21 && dealerHand.length === 2}
                />
              )}
            </div>
            <div className="flex items-center justify-center min-h-[88px]">
              {dealerHand.length > 0 ? (
                <div className="flex items-center">
                  {dealerHand.map((card, i) => (
                    <PlayingCard
                      key={`dealer-${i}-${card.rank}-${card.suit}-${card.hidden}`}
                      card={card}
                      index={i}
                      hidden={card.hidden}
                      flipping={dealerRevealing && i > 0}
                      delay={0}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-gray-700 text-xs">Waiting to deal...</div>
              )}
            </div>
          </div>

          {/* ---- CENTER: Result / Insurance ---- */}
          <div className="relative z-20 flex items-center justify-center min-h-[60px]">
            <AnimatePresence mode="wait">
              {showInsurancePrompt && (
                <InsurancePrompt onAccept={handleInsuranceAccept} onDecline={handleInsuranceDecline} />
              )}
              {isGameOver && !showInsurancePrompt && (
                <ResultOverlay status={status} payout={payout} multiplier={multiplier} currency={currency} />
              )}
            </AnimatePresence>

            {(isPlaying || isDealerTurn) && !showInsurancePrompt && !isGameOver && (
              <div className="text-center">
                <span className="text-[10px] text-gray-500 font-mono">
                  {formatCurrency(parseFloat(betAmount) || 0, currency)} {currency}
                </span>
              </div>
            )}
          </div>

          {/* Dealer turn indicator */}
          {isDealerTurn && (
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[#C8FF00] text-xs font-medium"
            >
              Dealer drawing...
            </motion.div>
          )}

          {/* ---- PLAYER AREA (bottom) ---- */}
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center justify-center min-h-[88px] relative">
              {playerHand.length > 0 ? (
                <div className="flex items-center">
                  {playerHand.map((card, i) => (
                    <PlayingCard
                      key={`player-${i}-${card.rank}-${card.suit}`}
                      card={card}
                      index={i}
                      bustTint={status === 'bust'}
                      delay={0.1}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-gray-700 text-xs">Place your bet</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Player</span>
              {playerHand.length > 0 && (
                <HandTotalBadge
                  total={playerTotal}
                  isBust={status === 'bust'}
                  isBlackjack={status === 'blackjack' || (playerTotal === 21 && playerHand.length === 2)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* ACTION BUTTONS (during play) - pill row                            */}
      {/* ================================================================= */}
      <AnimatePresence>
        {isPlaying && !showInsurancePrompt && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 mt-3"
          >
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => handleAction('hit')}
                disabled={isLoading || !canHit}
                className={cn(
                  'px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95',
                  canHit
                    ? 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]'
                    : 'bg-[#2D333B] text-gray-600 cursor-not-allowed',
                )}
              >
                HIT
              </button>
              <button
                onClick={() => handleAction('stand')}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#2D333B] text-white hover:bg-[#3D444D] transition-all active:scale-95"
              >
                STAND
              </button>
              <button
                onClick={() => handleAction('double')}
                disabled={isLoading || !canDouble}
                className={cn(
                  'px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95',
                  canDouble
                    ? 'bg-[#C8FF00]/20 text-[#C8FF00] border border-[#C8FF00]/40 hover:bg-[#C8FF00]/30'
                    : 'bg-[#2D333B] text-gray-600 cursor-not-allowed',
                )}
              >
                DOUBLE
              </button>
              <button
                onClick={() => handleAction('split')}
                disabled={isLoading || !canSplit}
                className={cn(
                  'px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95',
                  canSplit
                    ? 'bg-[#C8FF00]/20 text-[#C8FF00] border border-[#C8FF00]/40 hover:bg-[#C8FF00]/30'
                    : 'bg-[#2D333B] text-gray-600 cursor-not-allowed',
                )}
              >
                SPLIT
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================= */}
      {/* MANUAL / AUTO TOGGLE                                               */}
      {/* ================================================================= */}
      <div className="px-4 mt-3">
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              activeTab === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-colors',
              activeTab === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]',
            )}
          >
            Auto
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* BETTING CONTROLS                                                   */}
      {/* ================================================================= */}
      <div className="px-4 mt-3 space-y-3">
        {/* Bet Amount Label */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">
            Bet Amount
          </label>
          {/* Bet Input with currency icon left, amount center, -/+ right */}
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <CurrencySelector value={currency} onChange={setCurrency} />
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={isPlaying || isDealerTurn}
              className="flex-1 bg-transparent text-center font-mono text-sm text-white focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              step="0.01"
              min="0"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={adjustBetMinus}
                disabled={isPlaying || isDealerTurn}
                className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white font-bold text-sm hover:bg-[#3D444D] transition-colors disabled:opacity-40"
              >
                -
              </button>
              <button
                onClick={adjustBetPlus}
                disabled={isPlaying || isDealerTurn}
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
              disabled={isPlaying || isDealerTurn}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors disabled:opacity-40"
            >
              {preset}
            </button>
          ))}
          <button
            onClick={halveBet}
            disabled={isPlaying || isDealerTurn}
            className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors disabled:opacity-40"
          >
            1/2
          </button>
          <button
            onClick={doubleBet}
            disabled={isPlaying || isDealerTurn}
            className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white hover:border-[#C8FF00]/30 transition-colors disabled:opacity-40"
          >
            2X
          </button>
        </div>

        {/* Deal / New Hand Button - lime CTA */}
        {(status === 'idle' || isGameOver) && (
          <button
            onClick={handleDeal}
            disabled={isLoading || !isAuthenticated}
            className={cn(
              'w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.98]',
              isLoading
                ? 'bg-[#2D333B] text-gray-500 cursor-wait'
                : !isAuthenticated
                ? 'bg-[#2D333B] text-gray-500 cursor-not-allowed'
                : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00] shadow-lg shadow-[#C8FF00]/10',
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="inline-block w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full"
                />
                Dealing...
              </span>
            ) : isGameOver ? (
              'NEW HAND'
            ) : !isAuthenticated ? (
              'LOG IN TO PLAY'
            ) : (
              'DEAL'
            )}
          </button>
        )}
      </div>

      {/* ================================================================= */}
      {/* HISTORY                                                            */}
      {/* ================================================================= */}
      {history.length > 0 && (
        <div className="px-4 mt-3">
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                Last 10 Hands
              </span>
              <span className="text-[10px] text-gray-600 font-mono">
                {history.filter((h) => h === 'W' || h === 'BJ').length}W - {history.filter((h) => h === 'L').length}L - {history.filter((h) => h === 'P').length}P
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {history.map((entry, i) => (
                <motion.div
                  key={`${entry}-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <HistoryBadge entry={entry} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* GAME RULES COMPACT                                                 */}
      {/* ================================================================= */}
      <div className="px-4 mt-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'BJ Pays', value: '3:2' },
            { label: 'Dealer', value: 'S17' },
            { label: 'Double', value: 'Any 2' },
            { label: 'Split', value: '4x' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-[#161B22] rounded-lg border border-[#30363D] p-2 text-center"
            >
              <div className="text-[9px] text-gray-600">{item.label}</div>
              <div className="text-[11px] font-semibold text-gray-400">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Provably Fair Details                                               */}
      {/* ================================================================= */}
      {fairness && (
        <div className="px-4 mt-3">
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                Provably Fair
              </span>
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

      {/* ================================================================= */}
      {/* FIXED BOTTOM BAR - Cloudbet style                                  */}
      {/* ================================================================= */}
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
