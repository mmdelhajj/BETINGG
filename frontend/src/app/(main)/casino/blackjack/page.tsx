'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Info, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

interface Card {
  rank: string;
  suit: string;
  value: number;
  hidden?: boolean;
}

interface Hand {
  cards: Card[];
  value: number;
  isSoft: boolean;
  isBusted: boolean;
  isBlackjack: boolean;
}

type GamePhase = 'betting' | 'playing' | 'dealer' | 'settled';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface ApiCard {
  rank: string;
  suit: string;
  value?: number;
  hidden?: boolean;
}

interface ApiHand {
  cards: ApiCard[];
  value: number;
  bust?: boolean;
  blackjack?: boolean;
}

interface BlackjackApiResponse {
  sessionId: string;
  playerHands: ApiHand[];
  dealerHand: ApiHand;
  status: 'playing' | 'dealer_turn' | 'complete';
  result?: string;
  payout?: number;
  newBalance?: number;
}

/** Convert an API card to our internal Card type */
function apiCardToCard(c: ApiCard): Card {
  const rank = c.rank;
  const suit = c.suit;
  const value = c.value ?? (rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(rank) ? 10 : parseInt(rank));
  return { rank, suit, value, hidden: c.hidden };
}

/** Convert an API hand to our internal Hand type */
function apiHandToHand(h: ApiHand): Hand {
  const cards = h.cards.map(apiCardToCard);
  const visibleCards = cards.filter((c) => !c.hidden);
  let value = h.value;
  // If API didn't provide a value, calculate from visible cards
  if (value === undefined || value === null) {
    value = visibleCards.reduce((sum, c) => sum + c.value, 0);
  }
  const aces = visibleCards.filter((c) => c.rank === 'A').length;
  return {
    cards,
    value,
    isSoft: aces > 0 && value <= 21,
    isBusted: h.bust ?? value > 21,
    isBlackjack: h.blackjack ?? (cards.length === 2 && value === 21 && !cards.some((c) => c.hidden)),
  };
}

/** Map API status to our GamePhase */
function apiStatusToPhase(status: string): GamePhase {
  switch (status) {
    case 'playing': return 'playing';
    case 'dealer_turn': return 'dealer';
    case 'complete': return 'settled';
    default: return 'playing';
  }
}

/** Map API result string to display string */
function apiResultToDisplay(result?: string): string | null {
  if (!result) return null;
  const r = result.toLowerCase();
  if (r.includes('blackjack')) return 'BLACKJACK';
  if (r.includes('win') || r === 'player_wins' || r === 'player_win') return 'WIN';
  if (r.includes('push') || r === 'tie') return 'PUSH';
  if (r.includes('bust') || r.includes('lose') || r === 'dealer_wins' || r === 'dealer_win') return 'LOSE';
  return result.toUpperCase();
}

function getCardColor(suit: string) {
  return suit === '♥' || suit === '♦' ? 'text-danger' : 'text-white';
}

function CardComponent({ card, index, hidden }: { card: Card; index: number; hidden?: boolean }) {
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0, x: 50 }}
      animate={{ rotateY: 0, opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.15 }}
      className={cn(
        'w-14 h-20 sm:w-20 sm:h-28 rounded-lg border flex flex-col items-center justify-center relative',
        'shadow-lg',
        hidden
          ? 'bg-accent/30 border-accent/50'
          : 'bg-background-elevated border-border'
      )}
      style={{ marginLeft: index > 0 ? '-12px' : '0' }}
    >
      {hidden ? (
        <div className="text-accent text-xl sm:text-2xl font-bold">?</div>
      ) : (
        <>
          <div className={cn('text-sm sm:text-lg font-bold', getCardColor(card.suit))}>
            {card.rank}
          </div>
          <div className={cn('text-lg sm:text-2xl', getCardColor(card.suit))}>
            {card.suit}
          </div>
        </>
      )}
    </motion.div>
  );
}

function HandDisplay({ hand, label, isActive }: { hand: Hand; label: string; isActive?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">{label}</span>
        <span className={cn(
          'px-2 py-0.5 rounded text-sm font-mono font-bold',
          hand.isBusted ? 'bg-danger/20 text-danger' :
          hand.isBlackjack ? 'bg-success/20 text-success' :
          isActive ? 'bg-accent/20 text-accent' : 'bg-background-elevated text-text'
        )}>
          {hand.isBusted ? 'BUST' : hand.isBlackjack ? 'BLACKJACK' : hand.value}
          {hand.isSoft && !hand.isBusted && !hand.isBlackjack && ' (soft)'}
        </span>
      </div>
      <div className="flex items-center">
        {hand.cards.map((card, i) => (
          <CardComponent key={i} card={card} index={i} hidden={card.hidden} />
        ))}
      </div>
    </div>
  );
}

export default function BlackjackPage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
  const [playerHands, setPlayerHands] = useState<Hand[]>([]);
  const [dealerHand, setDealerHand] = useState<Hand | null>(null);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [payout, setPayout] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  // ---------------------------------------------------------------------------
  // Apply API response to game state
  // ---------------------------------------------------------------------------

  const applyApiResponse = useCallback((data: BlackjackApiResponse) => {
    setSessionId(data.sessionId);

    // Convert player hands
    const convertedPlayerHands = data.playerHands.map(apiHandToHand);
    setPlayerHands(convertedPlayerHands);

    // Convert dealer hand
    setDealerHand(apiHandToHand(data.dealerHand));

    // Set game phase
    const phase = apiStatusToPhase(data.status);
    setGamePhase(phase);

    // Set active hand (always first non-bust, non-complete hand)
    const nextActiveIdx = convertedPlayerHands.findIndex((h) => !h.isBusted);
    setActiveHandIndex(nextActiveIdx >= 0 ? nextActiveIdx : 0);

    // Result & payout
    if (data.status === 'complete') {
      const displayResult = apiResultToDisplay(data.result);
      setResult(displayResult);
      setPayout(data.payout ?? 0);
    } else {
      setResult(null);
      setPayout(0);
    }

    // Update balance in auth store
    if (data.newBalance !== undefined) {
      const { updateBalance } = useAuthStore.getState();
      updateBalance(currency, data.newBalance, 0);
    } else if ((data as any).balances && Array.isArray((data as any).balances)) {
      const balances = (data as any).balances as Array<{ currency: string; balance: number }>;
      const match = balances.find((b) => b.currency === currency);
      if (match) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, match.balance, 0);
      }
    }
  }, [currency]);

  // ---------------------------------------------------------------------------
  // handleDeal — call API, fall back to mock
  // ---------------------------------------------------------------------------

  const handleDeal = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await post<BlackjackApiResponse>('/casino/blackjack/deal', {
        betAmount: parseFloat(betAmount),
        currency,
      });
      applyApiResponse(data);
    } catch {
      setError('Failed to deal. Please try again.');
      setGamePhase('betting');
    }

    setIsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // handleAction — call API with sessionId, fall back to mock
  // ---------------------------------------------------------------------------

  const handleAction = async (action: 'hit' | 'stand' | 'double' | 'split') => {
    setIsLoading(true);
    setError(null);

    if (sessionId) {
      try {
        const data = await post<BlackjackApiResponse>('/casino/blackjack/action', {
          action,
        });
        applyApiResponse(data);
        setIsLoading(false);
        return;
      } catch {
        setError('Failed to perform action. Please try again.');
      }
    } else {
      setError('No active game session. Please deal again.');
      setGamePhase('betting');
    }

    setIsLoading(false);
  };

  const canSplit = playerHands[activeHandIndex]?.cards.length === 2 &&
    playerHands[activeHandIndex]?.cards[0].rank === playerHands[activeHandIndex]?.cards[1].rank;

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/casino" className="p-1.5 sm:p-2 rounded-lg hover:bg-background-card transition-colors">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Blackjack</h1>
            <p className="text-xs sm:text-sm text-text-muted">House Edge: 0.5% | RTP: 99.5%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-background-card transition-colors">
            <Volume2 className="w-5 h-5 text-text-muted" />
          </button>
          <button className="p-2 rounded-lg hover:bg-background-card transition-colors">
            <Info className="w-5 h-5 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2 text-center">
          <span className="text-xs font-semibold text-[#EF4444]">{error}</span>
        </div>
      )}

      {/* Game Table */}
      <div className="bg-[#1a472a] rounded-xl sm:rounded-2xl border border-[#2d6b3f] p-4 sm:p-8 min-h-[300px] sm:min-h-[400px] flex flex-col items-center justify-between relative overflow-hidden">
        {/* Felt pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        {/* Dealer Hand */}
        <div className="relative z-10">
          {dealerHand ? (
            <HandDisplay hand={dealerHand} label="Dealer" />
          ) : (
            <div className="text-text-muted text-sm">Dealer</div>
          )}
        </div>

        {/* Center Info */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className={cn(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20',
                'px-5 py-3 sm:px-8 sm:py-4 rounded-xl font-bold text-xl sm:text-2xl',
                result === 'WIN' ? 'bg-success/90 text-white' :
                result === 'BLACKJACK' ? 'bg-yellow-500/90 text-black' :
                result === 'PUSH' ? 'bg-blue-500/90 text-white' :
                'bg-danger/90 text-white'
              )}
            >
              {result}
              {payout > 0 && (
                <div className="text-sm font-normal mt-1 text-center">
                  +{formatCurrency(payout, currency)}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player Hands */}
        <div className="relative z-10 flex gap-4 sm:gap-8">
          {playerHands.length > 0 ? (
            playerHands.map((hand, i) => (
              <HandDisplay
                key={i}
                hand={hand}
                label={playerHands.length > 1 ? `Hand ${i + 1}` : 'Player'}
                isActive={i === activeHandIndex && gamePhase === 'playing'}
              />
            ))
          ) : (
            <div className="text-text-muted text-sm">Player</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-background-card rounded-xl border border-border p-3 sm:p-6 space-y-3 sm:space-y-4">
        {gamePhase === 'betting' || gamePhase === 'settled' ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="text-xs sm:text-sm text-text-muted mb-1 block">Bet Amount</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 font-mono text-sm text-text"
                    step="0.01"
                    min="0.10"
                  />
                  <span className="text-xs sm:text-sm text-text-muted">{currency}</span>
                </div>
              </div>
              <div className="flex gap-1.5 sm:gap-2 sm:pt-5 overflow-x-auto">
                {[5, 10, 25, 50, 100].map(v => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v.toFixed(2))}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-background border border-border text-xs sm:text-sm hover:border-accent transition-colors shrink-0"
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleDeal}
              disabled={isLoading || !isAuthenticated}
              className="w-full py-2.5 sm:py-3 rounded-lg bg-accent hover:bg-accent/80 text-white font-semibold text-sm sm:text-base transition-colors disabled:opacity-50"
            >
              {gamePhase === 'settled' ? 'New Hand' : 'Deal'}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3 justify-center flex-wrap">
            <button
              onClick={() => handleAction('hit')}
              disabled={isLoading}
              className="px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-success hover:bg-success/80 text-white text-sm sm:text-base font-semibold transition-colors"
            >
              Hit
            </button>
            <button
              onClick={() => handleAction('stand')}
              disabled={isLoading}
              className="px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-danger hover:bg-danger/80 text-white text-sm sm:text-base font-semibold transition-colors"
            >
              Stand
            </button>
            <button
              onClick={() => handleAction('double')}
              disabled={isLoading}
              className="px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-accent hover:bg-accent/80 text-white text-sm sm:text-base font-semibold transition-colors"
            >
              Double
            </button>
            {canSplit && (
              <button
                onClick={() => handleAction('split')}
                disabled={isLoading}
                className="px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base font-semibold transition-colors"
              >
                Split
              </button>
            )}
          </div>
        )}
      </div>

      {/* Game Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: 'Blackjack Pays', value: '3:2' },
          { label: 'Dealer Stands', value: 'Soft 17' },
          { label: 'Double Down', value: 'Any 2 Cards' },
          { label: 'Split', value: 'Up to 4 Hands' },
        ].map(item => (
          <div key={item.label} className="bg-background-card rounded-lg border border-border p-2.5 sm:p-4 text-center">
            <div className="text-[10px] sm:text-xs text-text-muted">{item.label}</div>
            <div className="text-xs sm:text-sm font-semibold mt-0.5 sm:mt-1">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
