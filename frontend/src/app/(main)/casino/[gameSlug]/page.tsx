'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  History,
  MessageSquare,
  X,
  Send,
  Minus,
  Plus,
  Gamepad2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  DollarSign,
  Sparkles,
  Target,
  Layers,
  Grid3X3,
  Trophy,
} from 'lucide-react';
import { cn, formatCurrency, formatRelativeDate, getDefaultBet } from '@/lib/utils';
import { get, post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import ProvablyFair from '@/components/casino/ProvablyFair';

// ===========================================================================
// Types
// ===========================================================================

interface GameInfo {
  id: string;
  name: string;
  slug: string;
  provider: string;
  description: string;
  rtp: number;
  houseEdge: number;
  minBet: number;
  maxBet: number;
  category: string;
}

interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
}

// ===========================================================================
// Mock game info for fallback
// ===========================================================================

const MOCK_GAMES: Record<string, GameInfo> = {
  hilo: { id: '8', name: 'HiLo', slug: 'hilo', provider: 'CryptoBet', description: 'Guess if the next card is higher or lower.', rtp: 97, houseEdge: 3, minBet: 0.1, maxBet: 1000, category: 'instant' },
  wheel: { id: '9', name: 'Wheel of Fortune', slug: 'wheel', provider: 'CryptoBet', description: 'Spin the wheel and land on a multiplier.', rtp: 96, houseEdge: 4, minBet: 0.1, maxBet: 1000, category: 'instant' },
  tower: { id: '10', name: 'Tower', slug: 'tower', provider: 'CryptoBet', description: 'Climb the tower row by row, choosing the safe path.', rtp: 97, houseEdge: 3, minBet: 0.1, maxBet: 1000, category: 'provably-fair' },
  limbo: { id: '11', name: 'Limbo', slug: 'limbo', provider: 'CryptoBet', description: 'Set a target multiplier and see if the result beats it.', rtp: 97, houseEdge: 3, minBet: 0.1, maxBet: 1000, category: 'instant' },
  keno: { id: '12', name: 'Keno', slug: 'keno', provider: 'CryptoBet', description: 'Pick your numbers and see how many match.', rtp: 95, houseEdge: 5, minBet: 0.1, maxBet: 1000, category: 'instant' },
  'video-poker': { id: '13', name: 'Video Poker', slug: 'video-poker', provider: 'CryptoBet', description: 'Jacks or Better video poker with full rules.', rtp: 99.5, houseEdge: 0.5, minBet: 0.1, maxBet: 2000, category: 'table' },
  baccarat: { id: '14', name: 'Baccarat', slug: 'baccarat', provider: 'CryptoBet', description: 'Bet on Player, Banker, or Tie.', rtp: 98.9, houseEdge: 1.1, minBet: 0.1, maxBet: 5000, category: 'table' },
  slots: { id: '15', name: 'Slots', slug: 'slots', provider: 'CryptoBet', description: '3x3 slot machine with multiple paylines.', rtp: 96, houseEdge: 4, minBet: 0.1, maxBet: 1000, category: 'slots' },
};

const GAME_SLUGS = new Set(['hilo', 'wheel', 'tower', 'limbo', 'keno', 'video-poker', 'baccarat', 'slots']);

// ===========================================================================
// Balance update helper - call after any API response that includes newBalance
// ===========================================================================

function syncBalance(response: any, currency: string) {
  const { updateBalance } = useAuthStore.getState();
  // Prefer balances array (has per-currency values) over newBalance (may be wrong currency)
  if (response?.balances && Array.isArray(response.balances)) {
    const match = response.balances.find((b: any) => b.currency === currency);
    if (match) {
      updateBalance(currency, match.balance, 0);
      return;
    }
  }
  if (response?.newBalance !== undefined && response.newBalance > 0) {
    updateBalance(currency, response.newBalance, 0);
  }
}

// ===========================================================================
// Card helpers (shared by HiLo, Video Poker, Baccarat)
// ===========================================================================

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

const SUIT_SYMBOLS: Record<string, string> = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
const SUIT_COLORS: Record<string, string> = { hearts: '#EF4444', diamonds: '#EF4444', clubs: '#E6EDF3', spades: '#E6EDF3' };

function randomCard() {
  const suit = SUITS[Math.floor(Math.random() * 4)];
  const rank = RANKS[Math.floor(Math.random() * 13)];
  return { suit, rank };
}

function cardValue(rank: string): number {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return parseInt(rank);
}

function baccaratValue(rank: string): number {
  if (['10', 'J', 'Q', 'K'].includes(rank)) return 0;
  if (rank === 'A') return 1;
  return parseInt(rank);
}

interface PlayingCard {
  suit: string;
  rank: string;
}

function CardDisplay({ card, held, onClick, faceDown, small }: { card: PlayingCard; held?: boolean; onClick?: () => void; faceDown?: boolean; small?: boolean }) {
  const sizeClass = small ? 'w-12 h-18 text-xs' : 'w-16 h-24 text-sm';
  if (faceDown) {
    return (
      <div
        className={cn(
          sizeClass,
          'rounded-lg border-2 border-[#30363D] bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center cursor-pointer transition-all duration-200',
          held && 'ring-2 ring-[#10B981] border-[#10B981]'
        )}
        onClick={onClick}
      >
        <span className="text-white/40 text-lg font-bold">?</span>
      </div>
    );
  }
  const color = SUIT_COLORS[card.suit] || '#E6EDF3';
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        sizeClass,
        'rounded-lg border-2 bg-[#1C2128] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none',
        held ? 'border-[#10B981] ring-2 ring-[#10B981]/50' : 'border-[#30363D] hover:border-[#484F58]'
      )}
      onClick={onClick}
    >
      <span className="font-bold leading-none" style={{ color }}>{card.rank}</span>
      <span className="leading-none mt-0.5" style={{ color }}>{SUIT_SYMBOLS[card.suit]}</span>
      {held && <span className="text-[8px] text-[#10B981] font-bold mt-1">HELD</span>}
    </motion.div>
  );
}

// ===========================================================================
// BetControls shared sub-component
// ===========================================================================

function BetControls({ betAmount, setBetAmount, onPlay, isPlaying, isAuthenticated, buttonLabel, disabled }: {
  betAmount: string;
  setBetAmount: (v: string) => void;
  onPlay: () => void;
  isPlaying: boolean;
  isAuthenticated: boolean;
  buttonLabel?: string;
  disabled?: boolean;
}) {
  const currency = useBetSlipStore((s) => s.currency);
  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.1, val * factor).toFixed(2));
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-[#8B949E] mb-1.5">Bet Amount ({currency})</label>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                min="0.1"
                step="0.1"
                className="w-full h-10 px-3 pr-14 bg-[#0D1117] border border-[#30363D] rounded-md text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8B949E]">{currency}</span>
            </div>
            <button onClick={() => adjustBet(0.5)} className="px-2 py-2 bg-[#0D1117] border border-[#30363D] rounded-md text-xs font-semibold text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all">1/2</button>
            <button onClick={() => adjustBet(2)} className="px-2 py-2 bg-[#0D1117] border border-[#30363D] rounded-md text-xs font-semibold text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all">2x</button>
          </div>
        </div>
        <button
          onClick={onPlay}
          disabled={isPlaying || !isAuthenticated || disabled}
          className={cn(
            'h-10 px-6 rounded-md font-semibold text-sm transition-all duration-200 min-w-[130px]',
            isPlaying
              ? 'bg-[#8B5CF6]/50 text-white/70 cursor-not-allowed'
              : !isAuthenticated
              ? 'bg-[#30363D] text-[#8B949E] cursor-not-allowed'
              : disabled
              ? 'bg-[#30363D] text-[#8B949E] cursor-not-allowed'
              : 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-[0.97]'
          )}
        >
          {isPlaying ? 'Playing...' : !isAuthenticated ? 'Login to Play' : (buttonLabel || 'Play')}
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// Error banner
// ===========================================================================

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2 text-center mb-2">
      <span className="text-xs font-semibold text-[#EF4444]">{message}</span>
    </div>
  );
}

// ===========================================================================
// ResultBanner: flashes win/loss after each round
// ===========================================================================

function ResultBanner({ result, payout }: { result: 'win' | 'loss' | null; payout: number }) {
  const currency = useBetSlipStore((s) => s.currency);
  if (!result) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'text-center py-2 px-4 rounded-lg text-sm font-bold',
        result === 'win' ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30' : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
      )}
    >
      {result === 'win' ? `You Won +${(payout ?? 0).toFixed(2)} ${currency}` : 'You Lost'}
    </motion.div>
  );
}

// ===========================================================================
// 1. HILO GAME
// ===========================================================================

function HiLoGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cardChain, setCardChain] = useState<PlayingCard[]>([]);
  const [multiplier, setMultiplier] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'result'>('idle');
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);
  const [isGuessing, setIsGuessing] = useState(false);

  const startGame = useCallback(async () => {
    setLastResult(null);
    setPayout(0);
    setMultiplier(1);
    setError(null);

    try {
      const res = await post<any>('/casino/hilo/start', { betAmount: parseFloat(betAmount), currency });
      syncBalance(res, currency);
      const startCard = res.currentCard || res.card || randomCard();
      setCardChain([typeof startCard === 'object' ? startCard : randomCard()]);
      setMultiplier(res.multiplier || 1);
      setPhase('playing');
    } catch {
      setError('Failed to start game. Please try again.');
      setPhase('idle');
    }
  }, [betAmount, currency]);

  const guess = useCallback(async (direction: 'higher' | 'lower') => {
    if (phase !== 'playing' || isGuessing) return;
    setIsGuessing(true);

    try {
      if (phase === 'playing') {
        const res = await post<any>('/casino/hilo/guess', { direction });
        syncBalance(res, currency);
        const nextCard = res.newCard || res.card || res.nextCard || randomCard();
        const c = typeof nextCard === 'object' ? nextCard : randomCard();
        setCardChain(prev => [...prev, c]);
        if ((res.gameOver && !res.isCorrect) || res.busted || res.lost) {
          setPhase('result');
          setLastResult('loss');
          setPayout(0);
        } else {
          setMultiplier(res.currentMultiplier || res.multiplier || multiplier * 1.4);
        }
      } else {
        setError('No active game session.');
      }
    } catch {
      setError('Failed to make guess. Please try again.');
    } finally {
      setIsGuessing(false);
    }
  }, [phase, isGuessing, sessionId, cardChain, multiplier, currency]);

  const cashout = useCallback(async () => {
    const winAmount = parseFloat(betAmount) * multiplier;
    try {
      const res = await post<any>('/casino/hilo/cashout');
      syncBalance(res, currency);
    } catch {
      setError('Failed to cash out. Please try again.');
      return;
    }
    setPhase('result');
    setLastResult('win');
    setPayout(winAmount);
    setSessionId(null);
  }, [sessionId, betAmount, multiplier, currency]);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {/* Card Chain Display */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-6 min-h-[280px] flex flex-col items-center justify-center">
        {phase === 'idle' ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-3">
              <ChevronUp className="w-8 h-8 text-[#8B5CF6]" />
            </div>
            <p className="text-[#8B949E] text-sm">Place a bet and start guessing Higher or Lower</p>
          </div>
        ) : (
          <>
            {/* Current multiplier */}
            <div className="mb-4">
              <span className="text-xs text-[#8B949E]">Current Multiplier</span>
              <div className="text-2xl font-bold text-[#8B5CF6] font-mono">{multiplier.toFixed(2)}x</div>
              <div className="text-xs text-[#10B981] font-mono">+{(parseFloat(betAmount) * multiplier).toFixed(2)} {currency}</div>
            </div>

            {/* Card chain */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 max-w-full px-2">
              {cardChain.map((c, i) => (
                <div key={i} className="flex-shrink-0">
                  <CardDisplay card={c} small={cardChain.length > 5} />
                </div>
              ))}
            </div>

            {/* Controls */}
            {phase === 'playing' && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => guess('higher')}
                  disabled={isGuessing}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-semibold hover:bg-[#10B981]/25 transition-all disabled:opacity-50"
                >
                  <ChevronUp className="w-5 h-5" /> Higher
                </button>
                <button
                  onClick={cashout}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] font-semibold hover:bg-[#F59E0B]/25 transition-all"
                >
                  <DollarSign className="w-5 h-5" /> Cashout
                </button>
                <button
                  onClick={() => guess('lower')}
                  disabled={isGuessing}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] font-semibold hover:bg-[#EF4444]/25 transition-all disabled:opacity-50"
                >
                  <ChevronDown className="w-5 h-5" /> Lower
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      {phase === 'idle' || phase === 'result' ? (
        <BetControls
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onPlay={startGame}
          isPlaying={false}
          isAuthenticated={isAuthenticated}
          buttonLabel={phase === 'result' ? 'Play Again' : 'Start Game'}
        />
      ) : null}
    </div>
  );
}

// ===========================================================================
// 2. WHEEL OF FORTUNE
// ===========================================================================

const WHEEL_SEGMENTS = [
  { label: '0x', multiplier: 0, color: '#30363D' },
  { label: '1.5x', multiplier: 1.5, color: '#3B82F6' },
  { label: '2x', multiplier: 2, color: '#10B981' },
  { label: '0x', multiplier: 0, color: '#30363D' },
  { label: '1.2x', multiplier: 1.2, color: '#6366F1' },
  { label: '3x', multiplier: 3, color: '#F59E0B' },
  { label: '0x', multiplier: 0, color: '#30363D' },
  { label: '1.5x', multiplier: 1.5, color: '#3B82F6' },
  { label: '5x', multiplier: 5, color: '#EF4444' },
  { label: '0x', multiplier: 0, color: '#30363D' },
  { label: '1.2x', multiplier: 1.2, color: '#6366F1' },
  { label: '2x', multiplier: 2, color: '#10B981' },
  { label: '0x', multiplier: 0, color: '#30363D' },
  { label: '1.5x', multiplier: 1.5, color: '#3B82F6' },
  { label: '10x', multiplier: 10, color: '#8B5CF6' },
  { label: '0x', multiplier: 0, color: '#30363D' },
  { label: '1.2x', multiplier: 1.2, color: '#6366F1' },
  { label: '2x', multiplier: 2, color: '#10B981' },
  { label: '0x', multiplier: 0, color: '#30363D' },
  { label: '50x', multiplier: 50, color: '#EC4899' },
];

function WheelGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [error, setError] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);
  const [resultMultiplier, setResultMultiplier] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 4;
    const segCount = WHEEL_SEGMENTS.length;
    const arc = (2 * Math.PI) / segCount;

    ctx.clearRect(0, 0, size, size);

    // Draw segments
    for (let i = 0; i < segCount; i++) {
      const angle = i * arc - Math.PI / 2 + (rotation * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle, angle + arc);
      ctx.closePath();
      ctx.fillStyle = WHEEL_SEGMENTS[i].color;
      ctx.fill();
      ctx.strokeStyle = '#0D1117';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle + arc / 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(WHEEL_SEGMENTS[i].label, radius * 0.65, 4);
      ctx.restore();
    }

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#161B22';
    ctx.fill();
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pointer at top
    ctx.beginPath();
    ctx.moveTo(center - 10, 2);
    ctx.lineTo(center + 10, 2);
    ctx.lineTo(center, 18);
    ctx.closePath();
    ctx.fillStyle = '#8B5CF6';
    ctx.fill();
  }, [rotation]);

  const spin = useCallback(async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setLastResult(null);
    setResultMultiplier(null);
    setError(null);

    let landedIndex: number;
    let mult: number;

    try {
      const res = await post<any>('/casino/games/wheel/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { segments: WHEEL_SEGMENTS.length, risk: 'medium' },
      });
      syncBalance(res, currency);
      mult = res.round?.multiplier ?? res.multiplier ?? 0;
      // Find the segment index that matches the multiplier
      landedIndex = WHEEL_SEGMENTS.findIndex(s => s.multiplier === mult);
      if (landedIndex === -1) landedIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    } catch {
      setError('Failed to place bet. Please try again.');
      setIsSpinning(false);
      return;
    }

    // Animate the spin
    const segAngle = 360 / WHEEL_SEGMENTS.length;
    const targetAngle = 360 * 5 + (360 - landedIndex * segAngle - segAngle / 2);
    const startRotation = rotation % 360;
    const totalRotation = targetAngle;
    const duration = 4000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing: cubic out
      const eased = 1 - Math.pow(1 - progress, 3);
      setRotation(startRotation + totalRotation * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const winAmount = parseFloat(betAmount) * mult;
        setResultMultiplier(mult);
        if (mult > 0) {
          setLastResult('win');
          setPayout(winAmount);
        } else {
          setLastResult('loss');
          setPayout(0);
        }
        setIsSpinning(false);
      }
    };
    requestAnimationFrame(animate);
  }, [isSpinning, betAmount, rotation, currency]);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-6 flex flex-col items-center justify-center min-h-[320px]">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="max-w-full"
        />

        {resultMultiplier !== null && !isSpinning && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mt-4 text-center"
          >
            <div className={cn(
              'text-3xl font-bold font-mono',
              resultMultiplier > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
            )}>
              {resultMultiplier}x
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      <BetControls
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        onPlay={spin}
        isPlaying={isSpinning}
        isAuthenticated={isAuthenticated}
        buttonLabel="Spin"
      />
    </div>
  );
}

// ===========================================================================
// 3. TOWER / STAIRS
// ===========================================================================

const TOWER_COLS: Record<string, number> = { easy: 4, medium: 3, hard: 2, expert: 2 };
const TOWER_ROWS = 10;

function TowerGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('easy');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'result'>('idle');
  const [currentRow, setCurrentRow] = useState(-1);
  const [revealedTiles, setRevealedTiles] = useState<Record<string, 'safe' | 'bomb'>>({});
  const [multiplier, setMultiplier] = useState(1);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);
  const [isClimbing, setIsClimbing] = useState(false);

  const cols = TOWER_COLS[difficulty];
  // Bomb positions for visual reveal on loss
  const [bombPositions, setBombPositions] = useState<Record<number, number>>({});

  const startGame = useCallback(async () => {
    setLastResult(null);
    setPayout(0);
    setRevealedTiles({});
    setCurrentRow(-1);
    setMultiplier(1);

    // Generate bomb positions for visual feedback
    const bombs: Record<number, number> = {};
    for (let r = 0; r < TOWER_ROWS; r++) {
      bombs[r] = Math.floor(Math.random() * cols);
    }
    setBombPositions(bombs);

    setError(null);
    try {
      const res = await post<any>('/casino/tower/start', { betAmount: parseFloat(betAmount), currency, difficulty });
      syncBalance(res, currency);
      setSessionId(res.sessionId || res.id);
      setPhase('playing');
    } catch {
      setError('Failed to start game. Please try again.');
      setPhase('idle');
    }
  }, [betAmount, difficulty, cols, currency]);

  const climb = useCallback(async (row: number, col: number) => {
    if (phase !== 'playing' || isClimbing) return;
    if (row !== currentRow + 1) return; // Must climb one row at a time
    setIsClimbing(true);

    const key = `${row}-${col}`;

    try {
      if (sessionId) {
        const res = await post<any>('/casino/tower/climb', { column: col });
        syncBalance(res, currency);
        if (res.busted || res.lost || res.bomb) {
          setRevealedTiles(prev => ({ ...prev, [key]: 'bomb' }));
          // Reveal all bombs in remaining rows
          for (let r = row + 1; r < TOWER_ROWS; r++) {
            const bKey = `${r}-${bombPositions[r]}`;
            setRevealedTiles(prev => ({ ...prev, [bKey]: 'bomb' }));
          }
          setPhase('result');
          setLastResult('loss');
          setPayout(0);
          setSessionId(null);
        } else {
          setRevealedTiles(prev => ({ ...prev, [key]: 'safe' }));
          setCurrentRow(row);
          setMultiplier(res.multiplier || multiplier * (cols / (cols - 1)));
          if (row === TOWER_ROWS - 1) {
            // Reached top
            const winAmount = parseFloat(betAmount) * (res.multiplier || multiplier);
            setPhase('result');
            setLastResult('win');
            setPayout(winAmount);
          }
        }
      } else {
        setError('No active game session.');
      }
    } catch {
      // On error, treat as bomb
      setRevealedTiles(prev => ({ ...prev, [key]: 'bomb' }));
      setPhase('result');
      setLastResult('loss');
      setPayout(0);
    } finally {
      setIsClimbing(false);
    }
  }, [phase, isClimbing, currentRow, sessionId, bombPositions, multiplier, cols, betAmount, currency]);

  const cashout = useCallback(async () => {
    const winAmount = parseFloat(betAmount) * multiplier;
    try {
      if (sessionId) {
        const res = await post<any>('/casino/tower/cashout', {});
        syncBalance(res, currency);
      }
    } catch {
      setError('Failed to cash out. Please try again.');
      return;
    }
    setPhase('result');
    setLastResult('win');
    setPayout(winAmount);
    setSessionId(null);
  }, [sessionId, betAmount, multiplier, currency]);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {/* Difficulty selector */}
      {(phase === 'idle' || phase === 'result') && (
        <div className="flex gap-2 justify-center">
          {(['easy', 'medium', 'hard', 'expert'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all',
                difficulty === d
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Tower grid */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-4 min-h-[320px]">
        {phase === 'idle' ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="text-center">
              <Layers className="w-12 h-12 text-[#8B5CF6]/40 mx-auto mb-3" />
              <p className="text-[#8B949E] text-sm">Choose difficulty and start climbing the tower</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Multiplier display */}
            <div className="text-center mb-3">
              <span className="text-xs text-[#8B949E]">Multiplier: </span>
              <span className="text-lg font-bold text-[#8B5CF6] font-mono">{multiplier.toFixed(2)}x</span>
              {phase === 'playing' && currentRow >= 0 && (
                <button
                  onClick={cashout}
                  className="ml-3 px-3 py-1 rounded-md bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-semibold hover:bg-[#F59E0B]/25 transition-all"
                >
                  Cashout {(parseFloat(betAmount) * multiplier).toFixed(2)}
                </button>
              )}
            </div>

            {/* Grid rows (top to bottom = high to low) */}
            {Array.from({ length: TOWER_ROWS }).map((_, rowIdx) => {
              const row = TOWER_ROWS - 1 - rowIdx; // Render top row first
              const isClickable = phase === 'playing' && row === currentRow + 1;
              return (
                <div key={row} className="flex gap-1.5 justify-center">
                  <span className="w-8 text-right text-[10px] text-[#6E7681] font-mono self-center">{row + 1}</span>
                  {Array.from({ length: cols }).map((_, col) => {
                    const key = `${row}-${col}`;
                    const state = revealedTiles[key];
                    return (
                      <motion.button
                        key={key}
                        onClick={() => climb(row, col)}
                        disabled={!isClickable || isClimbing}
                        className={cn(
                          'w-14 h-10 rounded-md text-xs font-bold transition-all duration-200 border',
                          state === 'safe'
                            ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]'
                            : state === 'bomb'
                            ? 'bg-[#EF4444]/20 border-[#EF4444]/40 text-[#EF4444]'
                            : isClickable
                            ? 'bg-[#1C2128] border-[#484F58] text-[#8B949E] hover:bg-[#8B5CF6]/10 hover:border-[#8B5CF6]/40 cursor-pointer'
                            : 'bg-[#161B22] border-[#30363D] text-[#30363D] cursor-default'
                        )}
                        whileHover={isClickable ? { scale: 1.05 } : {}}
                        whileTap={isClickable ? { scale: 0.95 } : {}}
                      >
                        {state === 'safe' ? '\u2713' : state === 'bomb' ? '\u2716' : ''}
                      </motion.button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      {(phase === 'idle' || phase === 'result') && (
        <BetControls
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onPlay={startGame}
          isPlaying={false}
          isAuthenticated={isAuthenticated}
          buttonLabel={phase === 'result' ? 'Play Again' : 'Start Climbing'}
        />
      )}
    </div>
  );
}

// ===========================================================================
// 4. LIMBO
// ===========================================================================

function LimboGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [targetMultiplier, setTargetMultiplier] = useState('2.00');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resultValue, setResultValue] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);
  const [animatingValue, setAnimatingValue] = useState<number | null>(null);

  const winChance = useMemo(() => {
    const t = parseFloat(targetMultiplier) || 2;
    return Math.min(99, Math.max(1, (97 / t)));
  }, [targetMultiplier]);

  const play = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setLastResult(null);
    setResultValue(null);

    const target = parseFloat(targetMultiplier) || 2;

    // Animate counting up
    let frame = 0;
    const totalFrames = 25;
    const animInterval = setInterval(() => {
      setAnimatingValue(parseFloat((Math.random() * target * 2).toFixed(2)));
      frame++;
      if (frame >= totalFrames) clearInterval(animInterval);
    }, 50);

    let result: number;
    let won: boolean;

    setError(null);
    try {
      const res = await post<any>('/casino/games/limbo/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { targetMultiplier: target },
      });
      syncBalance(res, currency);
      result = res.round?.result ?? res.result ?? res.round?.multiplier ?? parseFloat((Math.random() * 100).toFixed(2));
      won = res.round?.won ?? result >= target;
    } catch {
      clearInterval(animInterval);
      setAnimatingValue(null);
      setError('Failed to place bet. Please try again.');
      setIsPlaying(false);
      return;
    }

    // Wait for animation
    await new Promise(r => setTimeout(r, totalFrames * 50 + 200));
    clearInterval(animInterval);
    setAnimatingValue(null);

    setResultValue(result);
    const winAmount = won ? parseFloat(betAmount) * target : 0;
    setLastResult(won ? 'win' : 'loss');
    setPayout(winAmount);
    setIsPlaying(false);
  }, [isPlaying, betAmount, targetMultiplier, currency]);

  const displayValue = animatingValue ?? resultValue;

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {/* Big number display */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-8 min-h-[240px] flex flex-col items-center justify-center">
        <div className="text-center">
          <div className={cn(
            'text-6xl font-bold font-mono transition-colors duration-300',
            displayValue === null
              ? 'text-[#8B949E]/40'
              : isPlaying
              ? 'text-[#E6EDF3]'
              : lastResult === 'win'
              ? 'text-[#10B981]'
              : 'text-[#EF4444]'
          )}>
            {displayValue !== null ? `${displayValue.toFixed(2)}x` : '-.--x'}
          </div>
          <div className="mt-3 text-sm text-[#8B949E]">
            Target: <span className="text-[#8B5CF6] font-mono font-bold">{parseFloat(targetMultiplier || '2').toFixed(2)}x</span>
            <span className="mx-2">|</span>
            Win Chance: <span className="text-[#E6EDF3] font-mono">{winChance.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      {/* Target multiplier input */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4">
        <label className="block text-xs font-medium text-[#8B949E] mb-1.5">Target Multiplier</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={targetMultiplier}
            onChange={e => setTargetMultiplier(e.target.value)}
            min="1.01"
            max="1000"
            step="0.1"
            className="flex-1 h-10 px-3 bg-[#0D1117] border border-[#30363D] rounded-md text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] transition-colors"
          />
          {[1.5, 2, 3, 5, 10].map(v => (
            <button
              key={v}
              onClick={() => setTargetMultiplier(v.toFixed(2))}
              className={cn(
                'px-2.5 py-2 rounded-md text-xs font-semibold transition-all',
                parseFloat(targetMultiplier) === v
                  ? 'bg-[#8B5CF6] text-white'
                  : 'bg-[#0D1117] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]'
              )}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>

      <BetControls
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        onPlay={play}
        isPlaying={isPlaying}
        isAuthenticated={isAuthenticated}
        buttonLabel="Play"
      />
    </div>
  );
}

// ===========================================================================
// 5. KENO
// ===========================================================================

const KENO_TOTAL = 40;
const KENO_DRAW_COUNT = 10;
const KENO_MAX_PICKS = 10;

// Payout multipliers per number of picks and matches
const KENO_PAYOUTS: Record<number, Record<number, number>> = {
  1: { 1: 3.5 },
  2: { 1: 1.5, 2: 5 },
  3: { 2: 2.5, 3: 25 },
  4: { 2: 1.5, 3: 8, 4: 50 },
  5: { 2: 1, 3: 3, 4: 15, 5: 100 },
  6: { 3: 2, 4: 6, 5: 30, 6: 300 },
  7: { 3: 1.5, 4: 4, 5: 12, 6: 80, 7: 500 },
  8: { 4: 2, 5: 8, 6: 30, 7: 200, 8: 1000 },
  9: { 4: 1.5, 5: 5, 6: 15, 7: 80, 8: 500, 9: 2000 },
  10: { 4: 1, 5: 3, 6: 10, 7: 40, 8: 200, 9: 1000, 10: 5000 },
};

function KenoGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [drawn, setDrawn] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'picking' | 'playing' | 'result'>('picking');
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);
  const [matches, setMatches] = useState(0);

  const togglePick = (n: number) => {
    if (phase !== 'picking') return;
    const newPicks = new Set(picks);
    if (newPicks.has(n)) {
      newPicks.delete(n);
    } else if (newPicks.size < KENO_MAX_PICKS) {
      newPicks.add(n);
    }
    setPicks(newPicks);
  };

  const play = useCallback(async () => {
    if (picks.size === 0 || isPlaying) return;
    setIsPlaying(true);
    setPhase('playing');
    setDrawn(new Set());
    setMatches(0);
    setLastResult(null);

    const picksArr = Array.from(picks);
    let drawnNumbers: number[] = [];

    setError(null);
    try {
      const res = await post<any>('/casino/games/keno/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { picks: picksArr },
      });
      syncBalance(res, currency);
      drawnNumbers = res.round?.drawnNumbers || res.drawnNumbers || [];
      if (drawnNumbers.length === 0) throw new Error('no drawn numbers');
    } catch {
      setError('Failed to place bet. Please try again.');
      setPhase('picking');
      setIsPlaying(false);
      return;
    }

    // Animate revealing drawn numbers one by one
    for (let i = 0; i < drawnNumbers.length; i++) {
      await new Promise(r => setTimeout(r, 200));
      setDrawn(prev => new Set([...prev, drawnNumbers[i]]));
    }

    // Calculate matches
    const hitCount = picksArr.filter(p => drawnNumbers.includes(p)).length;
    setMatches(hitCount);

    const payoutTable = KENO_PAYOUTS[picksArr.length] || {};
    const mult = payoutTable[hitCount] || 0;
    const winAmount = parseFloat(betAmount) * mult;

    if (mult > 0) {
      setLastResult('win');
      setPayout(winAmount);
    } else {
      setLastResult('loss');
      setPayout(0);
    }

    setPhase('result');
    setIsPlaying(false);
  }, [picks, isPlaying, betAmount, currency]);

  const reset = () => {
    setPicks(new Set());
    setDrawn(new Set());
    setPhase('picking');
    setLastResult(null);
    setPayout(0);
    setMatches(0);
  };

  const replay = useCallback(() => {
    // Keep existing picks, just reset draw state and immediately play again
    setDrawn(new Set());
    setLastResult(null);
    setPayout(0);
    setMatches(0);
    setPhase('picking');
    setTimeout(() => play(), 50);
  }, [play]);

  const autoSelect = () => {
    const nums = new Set<number>();
    while (nums.size < 5) {
      nums.add(Math.floor(Math.random() * KENO_TOTAL) + 1);
    }
    setPicks(nums);
  };

  const payoutTable = KENO_PAYOUTS[picks.size] || {};

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {/* Info bar */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-[#8B949E]">
          Picks: <span className="text-[#E6EDF3] font-mono">{picks.size}/{KENO_MAX_PICKS}</span>
          {phase === 'result' && (
            <span className="ml-3">Hits: <span className="text-[#10B981] font-mono font-bold">{matches}</span></span>
          )}
        </div>
        <div className="flex gap-2">
          {phase === 'picking' && (
            <button onClick={autoSelect} className="px-2 py-1 rounded text-[10px] font-semibold bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] transition-all">
              Auto Pick
            </button>
          )}
          {phase === 'result' && (
            <button onClick={reset} className="px-2 py-1 rounded text-[10px] font-semibold bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] transition-all flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> New Game
            </button>
          )}
        </div>
      </div>

      {/* Number grid */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-4">
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: KENO_TOTAL }, (_, i) => i + 1).map(n => {
            const isPicked = picks.has(n);
            const isDrawn = drawn.has(n);
            const isHit = isPicked && isDrawn;
            const isMiss = isPicked && phase === 'result' && !isDrawn;

            return (
              <motion.button
                key={n}
                onClick={() => togglePick(n)}
                disabled={phase !== 'picking' && !isPicked}
                className={cn(
                  'aspect-square rounded-md text-sm font-bold transition-all duration-200 border',
                  isHit
                    ? 'bg-[#10B981]/25 border-[#10B981] text-[#10B981] scale-110'
                    : isDrawn
                    ? 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#F59E0B]'
                    : isMiss
                    ? 'bg-[#EF4444]/15 border-[#EF4444]/40 text-[#EF4444]'
                    : isPicked
                    ? 'bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#8B5CF6]'
                    : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:border-[#484F58] hover:text-[#E6EDF3]'
                )}
                animate={isHit ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {n}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Payout table */}
      {picks.size > 0 && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3">
          <div className="text-[10px] text-[#8B949E] font-semibold mb-1.5">PAYOUT TABLE ({picks.size} picks)</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(payoutTable).map(([hits, mult]) => (
              <div
                key={hits}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-mono border',
                  phase === 'result' && parseInt(hits) === matches
                    ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                    : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]'
                )}
              >
                {hits} hits = <span className="text-[#E6EDF3] font-semibold">{mult}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      {(phase === 'picking' || phase === 'result') && (
        <BetControls
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onPlay={phase === 'result' ? replay : play}
          isPlaying={isPlaying}
          isAuthenticated={isAuthenticated}
          buttonLabel={phase === 'result' ? 'Play Again' : 'Play'}
          disabled={picks.size === 0 && phase !== 'result'}
        />
      )}
    </div>
  );
}

// ===========================================================================
// 6. VIDEO POKER
// ===========================================================================

const POKER_HANDS: Record<string, number> = {
  'Royal Flush': 250,
  'Straight Flush': 50,
  'Four of a Kind': 25,
  'Full House': 9,
  'Flush': 6,
  'Straight': 4,
  'Three of a Kind': 3,
  'Two Pair': 2,
  'Jacks or Better': 1,
};

function evaluatePokerHand(cards: PlayingCard[]): { name: string; multiplier: number } {
  if (cards.length !== 5) return { name: 'No Hand', multiplier: 0 };

  const values = cards.map(c => cardValue(c.rank)).sort((a, b) => a - b);
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  const uniqueVals = [...new Set(values)];
  if (uniqueVals.length === 5 && uniqueVals[4] - uniqueVals[0] === 4) isStraight = true;
  // Ace-low straight: A,2,3,4,5
  if (uniqueVals.length === 5 && uniqueVals[0] === 2 && uniqueVals[1] === 3 && uniqueVals[2] === 4 && uniqueVals[3] === 5 && uniqueVals[4] === 14) isStraight = true;

  // Count ranks
  const counts: Record<number, number> = {};
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const countValues = Object.values(counts).sort((a, b) => b - a);

  if (isFlush && isStraight && values.includes(14) && values.includes(13)) return { name: 'Royal Flush', multiplier: 250 };
  if (isFlush && isStraight) return { name: 'Straight Flush', multiplier: 50 };
  if (countValues[0] === 4) return { name: 'Four of a Kind', multiplier: 25 };
  if (countValues[0] === 3 && countValues[1] === 2) return { name: 'Full House', multiplier: 9 };
  if (isFlush) return { name: 'Flush', multiplier: 6 };
  if (isStraight) return { name: 'Straight', multiplier: 4 };
  if (countValues[0] === 3) return { name: 'Three of a Kind', multiplier: 3 };
  if (countValues[0] === 2 && countValues[1] === 2) return { name: 'Two Pair', multiplier: 2 };
  // Jacks or Better: pair of J, Q, K, or A
  if (countValues[0] === 2) {
    const pairValue = parseInt(Object.entries(counts).find(([_, c]) => c === 2)?.[0] || '0');
    if (pairValue >= 11) return { name: 'Jacks or Better', multiplier: 1 };
  }

  return { name: 'No Hand', multiplier: 0 };
}

function VideoPokerGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<PlayingCard[]>([]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [phase, setPhase] = useState<'idle' | 'dealt' | 'result'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [handName, setHandName] = useState('');
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);
  const [isDealing, setIsDealing] = useState(false);

  const deal = useCallback(async () => {
    setIsDealing(true);
    setLastResult(null);
    setHandName('');
    setHeld([false, false, false, false, false]);

    setError(null);
    try {
      const res = await post<any>('/casino/video-poker/deal', { betAmount: parseFloat(betAmount), currency });
      syncBalance(res, currency);
      setSessionId(res.sessionId || res.id);
      const dealt = res.result?.cards || res.cards || res.hand || [];
      if (dealt.length === 5 && typeof dealt[0] === 'object') {
        setCards(dealt);
      } else {
        throw new Error('invalid cards');
      }
    } catch {
      setError('Failed to deal cards. Please try again.');
      setIsDealing(false);
      return;
    }

    setPhase('dealt');
    setIsDealing(false);
  }, [betAmount, currency]);

  const toggleHold = (idx: number) => {
    if (phase !== 'dealt') return;
    const newHeld = [...held];
    newHeld[idx] = !newHeld[idx];
    setHeld(newHeld);
  };

  const draw = useCallback(async () => {
    setIsDealing(true);

    const holds = [...held]; // 5 booleans

    try {
      if (sessionId) {
        const res = await post<any>('/casino/video-poker/draw', { holds });
        syncBalance(res, currency);
        const newCards = res.result?.finalHand || res.cards || res.hand || [];
        if (newCards.length === 5 && typeof newCards[0] === 'object') {
          setCards(newCards);
          const handResult = res.result?.handName;
          const handMult = res.result?.handMultiplier ?? res.multiplier ?? 0;
          setHandName(handResult || evaluatePokerHand(newCards).name);
          if (handMult > 0) {
            setLastResult('win');
            setPayout(res.payout || parseFloat(betAmount) * handMult);
          } else {
            setLastResult('loss');
            setPayout(0);
          }
        } else {
          throw new Error('invalid');
        }
      } else {
        setError('No active game session. Please deal again.');
        setPhase('idle');
        setIsDealing(false);
        return;
      }
    } catch {
      setError('Failed to draw cards. Please try again.');
    }

    setPhase('result');
    setIsDealing(false);
    setSessionId(null);
  }, [cards, held, sessionId, betAmount, currency]);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {/* Payout table */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
          {Object.entries(POKER_HANDS).map(([name, mult]) => (
            <div
              key={name}
              className={cn(
                'flex justify-between px-2 py-1 rounded border',
                handName === name
                  ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]'
              )}
            >
              <span>{name}</span>
              <span className="font-mono font-bold">{mult}x</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center">
        {phase === 'idle' ? (
          <div className="text-center">
            <Sparkles className="w-12 h-12 text-[#8B5CF6]/40 mx-auto mb-3" />
            <p className="text-[#8B949E] text-sm">Deal cards to start playing Jacks or Better</p>
          </div>
        ) : (
          <>
            <div className="flex gap-3 mb-4">
              {cards.map((c, i) => (
                <CardDisplay key={i} card={c} held={held[i]} onClick={() => toggleHold(i)} />
              ))}
            </div>
            {phase === 'dealt' && (
              <p className="text-xs text-[#8B949E]">Click cards to hold, then press Draw</p>
            )}
            {handName && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'mt-2 px-4 py-1.5 rounded-lg text-sm font-bold',
                  lastResult === 'win' ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#EF4444]/15 text-[#EF4444]'
                )}
              >
                {handName}
              </motion.div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      {phase === 'dealt' ? (
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 flex justify-center">
          <button
            onClick={draw}
            disabled={isDealing}
            className="h-10 px-8 rounded-md font-semibold text-sm bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {isDealing ? 'Drawing...' : 'Draw'}
          </button>
        </div>
      ) : (
        <BetControls
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onPlay={deal}
          isPlaying={isDealing}
          isAuthenticated={isAuthenticated}
          buttonLabel={phase === 'result' ? 'Deal Again' : 'Deal'}
        />
      )}
    </div>
  );
}

// ===========================================================================
// 7. BACCARAT
// ===========================================================================

function BaccaratGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [betOn, setBetOn] = useState<'player' | 'banker' | 'tie'>('player');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerCards, setPlayerCards] = useState<PlayingCard[]>([]);
  const [bankerCards, setBankerCards] = useState<PlayingCard[]>([]);
  const [playerTotal, setPlayerTotal] = useState<number | null>(null);
  const [bankerTotal, setBankerTotal] = useState<number | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);

  const calcBacTotal = (cards: PlayingCard[]): number => {
    return cards.reduce((sum, c) => sum + baccaratValue(c.rank), 0) % 10;
  };

  const play = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setLastResult(null);
    setWinner(null);
    setPlayerCards([]);
    setBankerCards([]);
    setPlayerTotal(null);
    setBankerTotal(null);

    let pCards: PlayingCard[];
    let bCards: PlayingCard[];
    let gameWinner: string;

    setError(null);
    try {
      const res = await post<any>('/casino/games/baccarat/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { betOn },
      });
      syncBalance(res, currency);
      pCards = res.round?.playerCards || res.playerCards || [randomCard(), randomCard()];
      bCards = res.round?.bankerCards || res.bankerCards || [randomCard(), randomCard()];
      gameWinner = res.round?.winner || res.winner || 'player';
      if (!Array.isArray(pCards) || pCards.length < 2) throw new Error('invalid');
    } catch {
      setError('Failed to place bet. Please try again.');
      setIsPlaying(false);
      return;
    }

    // Animate dealing
    await new Promise(r => setTimeout(r, 400));
    setPlayerCards(pCards.slice(0, 2));
    setBankerCards(bCards.slice(0, 2));
    await new Promise(r => setTimeout(r, 600));
    if (pCards.length > 2) {
      setPlayerCards(pCards);
      await new Promise(r => setTimeout(r, 400));
    }
    if (bCards.length > 2) {
      setBankerCards(bCards);
      await new Promise(r => setTimeout(r, 400));
    }

    const pTotal = calcBacTotal(pCards);
    const bTotal = calcBacTotal(bCards);
    setPlayerTotal(pTotal);
    setBankerTotal(bTotal);
    setWinner(gameWinner);

    const won = betOn === gameWinner;
    const multipliers: Record<string, number> = { player: 2, banker: 1.95, tie: 8 };
    const winAmount = won ? parseFloat(betAmount) * multipliers[betOn] : 0;
    setLastResult(won ? 'win' : 'loss');
    setPayout(winAmount);
    setIsPlaying(false);
  }, [isPlaying, betAmount, betOn, currency]);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {/* Bet selection */}
      <div className="flex gap-3 justify-center">
        {([
          { value: 'player' as const, label: 'Player', payout: '2x', color: '#3B82F6' },
          { value: 'tie' as const, label: 'Tie', payout: '8x', color: '#10B981' },
          { value: 'banker' as const, label: 'Banker', payout: '1.95x', color: '#EF4444' },
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => !isPlaying && setBetOn(opt.value)}
            className={cn(
              'flex-1 max-w-[140px] py-3 rounded-lg border-2 text-center transition-all',
              betOn === opt.value
                ? 'border-current'
                : 'border-[#30363D] hover:border-[#484F58]'
            )}
            style={{ color: betOn === opt.value ? opt.color : '#8B949E' }}
          >
            <div className="text-sm font-bold">{opt.label}</div>
            <div className="text-[10px] font-mono opacity-70">{opt.payout}</div>
          </button>
        ))}
      </div>

      {/* Card display */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-6 min-h-[240px]">
        {playerCards.length === 0 && !isPlaying ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="text-center">
              <Trophy className="w-12 h-12 text-[#8B5CF6]/40 mx-auto mb-3" />
              <p className="text-[#8B949E] text-sm">Choose Player, Banker, or Tie and place your bet</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Player */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <span className={cn('text-sm font-bold', winner === 'player' ? 'text-[#3B82F6]' : 'text-[#8B949E]')}>PLAYER</span>
                {playerTotal !== null && (
                  <span className={cn(
                    'ml-2 text-lg font-bold font-mono',
                    winner === 'player' ? 'text-[#3B82F6]' : 'text-[#E6EDF3]'
                  )}>{playerTotal}</span>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                {playerCards.map((c, i) => (
                  <CardDisplay key={i} card={c} small />
                ))}
                {isPlaying && playerCards.length === 0 && (
                  <div className="w-12 h-18 rounded-lg bg-[#1C2128] border border-[#30363D] animate-pulse" />
                )}
              </div>
            </div>

            {/* Banker */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <span className={cn('text-sm font-bold', winner === 'banker' ? 'text-[#EF4444]' : 'text-[#8B949E]')}>BANKER</span>
                {bankerTotal !== null && (
                  <span className={cn(
                    'ml-2 text-lg font-bold font-mono',
                    winner === 'banker' ? 'text-[#EF4444]' : 'text-[#E6EDF3]'
                  )}>{bankerTotal}</span>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                {bankerCards.map((c, i) => (
                  <CardDisplay key={i} card={c} small />
                ))}
                {isPlaying && bankerCards.length === 0 && (
                  <div className="w-12 h-18 rounded-lg bg-[#1C2128] border border-[#30363D] animate-pulse" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Winner announcement */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-4"
          >
            <span className={cn(
              'px-4 py-1.5 rounded-full text-sm font-bold',
              winner === 'tie'
                ? 'bg-[#10B981]/15 text-[#10B981]'
                : winner === 'player'
                ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                : 'bg-[#EF4444]/15 text-[#EF4444]'
            )}>
              {winner === 'tie' ? 'Tie!' : `${(winner || '').charAt(0).toUpperCase() + (winner || '').slice(1)} Wins!`}
            </span>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      <BetControls
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        onPlay={play}
        isPlaying={isPlaying}
        isAuthenticated={isAuthenticated}
        buttonLabel="Deal"
      />
    </div>
  );
}

// ===========================================================================
// 8. SLOTS
// ===========================================================================

const SLOT_SYMBOLS = ['7\uFE0F\u20E3', '\uD83D\uDC8E', '\uD83C\uDF52', '\uD83C\uDF4B', '\uD83D\uDD14', '\u2B50', '\uD83C\uDF40', '\uD83D\uDCA5'];
const SLOT_WEIGHTS = [1, 2, 4, 5, 3, 3, 4, 2]; // Lower weight = rarer

function weightedRandomSymbol(): string {
  const totalWeight = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    rand -= SLOT_WEIGHTS[i];
    if (rand <= 0) return SLOT_SYMBOLS[i];
  }
  return SLOT_SYMBOLS[0];
}

const SLOT_PAYOUTS: Record<string, number> = {
  '7\uFE0F\u20E3': 50,
  '\uD83D\uDC8E': 25,
  '\uD83D\uDD14': 10,
  '\u2B50': 8,
  '\uD83C\uDF40': 5,
  '\uD83C\uDF52': 4,
  '\uD83C\uDF4B': 3,
  '\uD83D\uDCA5': 2,
};

function SlotsGame() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [betAmount, setBetAmount] = useState('1.00');
  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  const [error, setError] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [grid, setGrid] = useState<string[][]>([
    ['\uD83C\uDF52', '\uD83C\uDF4B', '\u2B50'],
    ['\uD83D\uDC8E', '7\uFE0F\u20E3', '\uD83C\uDF40'],
    ['\uD83D\uDD14', '\uD83D\uDCA5', '\uD83C\uDF52'],
  ]);
  const [lastResult, setLastResult] = useState<'win' | 'loss' | null>(null);
  const [payout, setPayout] = useState(0);
  const [winLines, setWinLines] = useState<number[]>([]);

  const checkWins = (g: string[][]): { lines: number[]; total: number } => {
    const lines: number[] = [];
    let total = 0;
    const bet = parseFloat(betAmount);

    // Check 3 horizontal rows
    for (let row = 0; row < 3; row++) {
      if (g[0][row] === g[1][row] && g[1][row] === g[2][row]) {
        lines.push(row);
        total += bet * (SLOT_PAYOUTS[g[0][row]] || 2);
      }
    }
    // Check diagonals
    if (g[0][0] === g[1][1] && g[1][1] === g[2][2]) {
      lines.push(3);
      total += bet * (SLOT_PAYOUTS[g[0][0]] || 2);
    }
    if (g[0][2] === g[1][1] && g[1][1] === g[2][0]) {
      lines.push(4);
      total += bet * (SLOT_PAYOUTS[g[0][2]] || 2);
    }

    return { lines, total };
  };

  const spin = useCallback(async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setLastResult(null);
    setWinLines([]);
    setPayout(0);

    let finalGrid: string[][];

    setError(null);
    try {
      const res = await post<any>('/casino/games/slots/play', {
        amount: parseFloat(betAmount),
        currency,
        options: {},
      });
      syncBalance(res, currency);
      const reels = res.round?.reels || res.reels || null;
      if (reels && Array.isArray(reels) && reels.length === 3) {
        finalGrid = reels;
      } else {
        throw new Error('invalid');
      }
    } catch {
      setError('Failed to place bet. Please try again.');
      setIsSpinning(false);
      return;
    }

    // Spinning animation: rapidly change symbols
    const spinDuration = 1500;
    const interval = 80;
    let elapsed = 0;

    const spinTimer = setInterval(() => {
      elapsed += interval;
      const newGrid = [
        [weightedRandomSymbol(), weightedRandomSymbol(), weightedRandomSymbol()],
        elapsed > spinDuration * 0.3 ? finalGrid[1] : [weightedRandomSymbol(), weightedRandomSymbol(), weightedRandomSymbol()],
        elapsed > spinDuration * 0.6 ? finalGrid[2] : [weightedRandomSymbol(), weightedRandomSymbol(), weightedRandomSymbol()],
      ];
      if (elapsed > spinDuration * 0.15) newGrid[0] = finalGrid[0];
      setGrid(newGrid);

      if (elapsed >= spinDuration) {
        clearInterval(spinTimer);
        setGrid(finalGrid);

        // Check wins
        const { lines, total } = checkWins(finalGrid);
        setWinLines(lines);
        if (total > 0) {
          setLastResult('win');
          setPayout(total);
        } else {
          setLastResult('loss');
          setPayout(0);
        }
        setIsSpinning(false);
      }
    }, interval);
  }, [isSpinning, betAmount, currency]);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      {/* Slot machine */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-6 flex flex-col items-center">
        {/* Reels */}
        <div className="bg-[#161B22] border-2 border-[#8B5CF6]/30 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map(row => (
              <React.Fragment key={row}>
                {grid.map((col, colIdx) => {
                  const isWinRow = winLines.includes(row);
                  const isDiag1 = winLines.includes(3) && ((colIdx === 0 && row === 0) || (colIdx === 1 && row === 1) || (colIdx === 2 && row === 2));
                  const isDiag2 = winLines.includes(4) && ((colIdx === 0 && row === 2) || (colIdx === 1 && row === 1) || (colIdx === 2 && row === 0));
                  const highlight = isWinRow || isDiag1 || isDiag2;

                  return (
                    <motion.div
                      key={`${colIdx}-${row}`}
                      className={cn(
                        'w-16 h-16 flex items-center justify-center rounded-lg text-3xl transition-all',
                        highlight && !isSpinning
                          ? 'bg-[#10B981]/15 border-2 border-[#10B981]/50'
                          : 'bg-[#0D1117] border border-[#30363D]'
                      )}
                      animate={isSpinning ? { y: [0, -4, 0, 4, 0] } : highlight ? { scale: [1, 1.1, 1] } : {}}
                      transition={isSpinning ? { duration: 0.15, repeat: Infinity } : { duration: 0.5, repeat: highlight ? Infinity : 0 }}
                    >
                      {col[row]}
                    </motion.div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Payout legend */}
        <div className="flex flex-wrap gap-2 justify-center">
          {Object.entries(SLOT_PAYOUTS).slice(0, 5).map(([sym, mult]) => (
            <span key={sym} className="text-[10px] text-[#8B949E] bg-[#161B22] px-2 py-0.5 rounded border border-[#30363D]">
              {sym}{sym}{sym} = <span className="font-mono text-[#E6EDF3]">{mult}x</span>
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence>
        <ResultBanner result={lastResult} payout={payout} />
      </AnimatePresence>

      <BetControls
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        onPlay={spin}
        isPlaying={isSpinning}
        isAuthenticated={isAuthenticated}
        buttonLabel="Spin"
      />
    </div>
  );
}

// ===========================================================================
// Game Router Map
// ===========================================================================

const GAME_COMPONENTS: Record<string, React.FC> = {
  hilo: HiLoGame,
  wheel: WheelGame,
  tower: TowerGame,
  limbo: LimboGame,
  keno: KenoGame,
  'video-poker': VideoPokerGame,
  baccarat: BaccaratGame,
  slots: SlotsGame,
};

// ===========================================================================
// Main Page Component
// ===========================================================================

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameSlug = params.gameSlug as string;

  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Provably fair seeds
  const [serverSeedHash] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const [clientSeed, setClientSeed] = useState('randomclientseed123');
  const [nonce, setNonce] = useState(101);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', username: 'System', message: 'Welcome to the game chat!', timestamp: new Date().toISOString() },
    { id: '2', username: 'CryptoKing', message: 'gl everyone!', timestamp: new Date().toISOString() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated } = useAuthStore();

  // Redirect crash to its own page
  useEffect(() => {
    if (gameSlug === 'crash') {
      router.replace('/casino/crash');
    }
  }, [gameSlug, router]);

  // Fetch game info
  useEffect(() => {
    async function fetchGame() {
      try {
        const raw = await get<any>(`/casino/games/${gameSlug}`);
        const data: GameInfo = {
          ...raw,
          provider: typeof raw.provider === 'object' && raw.provider?.name
            ? raw.provider.name
            : (raw.provider ?? 'CryptoBet'),
          rtp: typeof raw.rtp === 'number' ? raw.rtp : 97,
          houseEdge: typeof raw.houseEdge === 'number' ? raw.houseEdge : 3,
          minBet: raw.minBet ?? 0.1,
          maxBet: raw.maxBet ?? 10000,
        };
        setGameInfo(data);
      } catch {
        const mock = MOCK_GAMES[gameSlug];
        if (mock) {
          setGameInfo(mock);
        }
      } finally {
        setIsLoading(false);
      }
    }
    if (gameSlug !== 'crash') {
      fetchGame();
    }
  }, [gameSlug]);

  // Chat submit
  const handleChatSubmit = useCallback(() => {
    if (!chatInput.trim() || !isAuthenticated) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      username: user?.username || 'Anonymous',
      message: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, msg]);
    setChatInput('');
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [chatInput, isAuthenticated, user]);

  // Resolve the game-specific component
  const GameComponent = GAME_COMPONENTS[gameSlug] || null;

  // Loading skeleton
  if (isLoading || gameSlug === 'crash') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-card" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-card lg:col-span-2" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      </div>
    );
  }

  // 404 state
  if (!gameInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Gamepad2 className="w-16 h-16 text-[#8B949E]/40 mb-4" />
        <h1 className="text-2xl font-bold text-[#E6EDF3] mb-2">Game Not Found</h1>
        <p className="text-sm text-[#8B949E] mb-6">
          The game &quot;{gameSlug}&quot; doesn&apos;t exist or is unavailable.
        </p>
        <Link href="/casino">
          <button className="h-10 px-6 rounded-md font-semibold text-sm bg-[#8B5CF6] text-white hover:bg-[#7C3AED] transition-all">
            Back to Casino
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 px-1 sm:px-0 pb-24">
      {/* ----- Header Bar ----- */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/casino"
            className="p-1.5 sm:p-2 rounded-md bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#E6EDF3] truncate">{gameInfo.name}</h1>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
              <Badge variant="default" size="xs">{gameInfo.provider}</Badge>
              <span className="text-xs text-[#8B949E] font-mono">
                RTP {gameInfo.rtp}%
              </span>
              <Badge variant="success" size="xs" dot>
                Online
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 sm:p-2 rounded-md bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'p-1.5 sm:p-2 rounded-md border transition-all duration-200',
              showHistory
                ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#8B5CF6]'
                : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58]'
            )}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className={cn(
              'hidden sm:block p-1.5 sm:p-2 rounded-md border transition-all duration-200',
              showChat
                ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#8B5CF6]'
                : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58]'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 sm:p-2 rounded-md bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
        </div>
      </motion.div>

      {/* ----- Main Content Area ----- */}
      <div className="flex gap-4">
        {/* Game + Controls */}
        <div className={cn('flex-1 space-y-4', showChat && 'lg:pr-0')}>
          {/* Game Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'overflow-hidden transition-all duration-300',
              isFullscreen ? 'fixed inset-4 z-50 bg-[#0D1117] rounded-lg border border-[#30363D] p-4 overflow-y-auto' : 'relative'
            )}
          >
            {/* Render the game-specific component or fallback */}
            {GameComponent ? (
              <GameComponent />
            ) : (
              /* Fallback for unknown games that still have gameInfo */
              <div className={cn(
                'flex items-center justify-center bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-[#30363D] rounded-lg',
                isFullscreen ? 'h-full' : 'aspect-[16/9]'
              )}>
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-4">
                    <Gamepad2 className="w-10 h-10 text-[#8B5CF6]/60" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#E6EDF3] mb-1">
                    {gameInfo.name}
                  </h3>
                  <p className="text-sm text-[#8B949E]">
                    Game coming soon
                  </p>
                </div>
              </div>
            )}

            {/* Fullscreen close button */}
            {isFullscreen && (
              <button
                onClick={() => setIsFullscreen(false)}
                className="absolute top-4 right-4 p-2 rounded-md bg-[#161B22]/80 border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] transition-all duration-200 z-10"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            )}
          </motion.div>

          {/* Provably Fair Panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <ProvablyFair
              serverSeedHash={serverSeedHash}
              clientSeed={clientSeed}
              nonce={nonce}
              onClientSeedChange={setClientSeed}
            />
          </motion.div>

          {/* Provably Fair History Toggle */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <Card className="bg-[#161B22] border-[#30363D]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#8B949E]" />
                      Game History
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <div className="py-8 text-center text-sm text-[#8B949E]">
                      Play a round to see your history here.
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ----- Chat Sidebar ----- */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 320 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:block overflow-hidden shrink-0"
            >
              <div className="w-[320px] bg-[#161B22] border border-[#30363D] rounded-lg flex flex-col h-[600px]">
                {/* Chat Header */}
                <div className="flex items-center justify-between p-3 border-b border-[#30363D]">
                  <h3 className="text-sm font-semibold text-[#E6EDF3] flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />
                    Game Chat
                  </h3>
                  <button
                    onClick={() => setShowChat(false)}
                    className="p-1 rounded text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="group">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            msg.username === 'System'
                              ? 'text-[#F59E0B]'
                              : msg.username === user?.username
                              ? 'text-[#8B5CF6]'
                              : 'text-[#8B949E]'
                          )}
                        >
                          {msg.username}
                        </span>
                        <span className="text-[10px] text-[#6E7681] opacity-0 group-hover:opacity-100 transition-opacity">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-[#E6EDF3] mt-0.5">
                        {msg.message}
                      </p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-3 border-t border-[#30363D]">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                        placeholder="Type a message..."
                        className="flex-1 h-9 px-3 bg-[#0D1117] border border-[#30363D] rounded-md text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#8B5CF6] transition-colors"
                      />
                      <button
                        onClick={handleChatSubmit}
                        disabled={!chatInput.trim()}
                        className="p-2 rounded-md bg-[#8B5CF6] text-white disabled:opacity-40 hover:bg-[#7C3AED] transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-center text-[#8B949E]">
                      <Link href="/login" className="text-[#8B5CF6] hover:underline">
                        Login
                      </Link>{' '}
                      to chat
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ----- Game Info Footer ----- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#161B22] border border-[#30363D] rounded-lg p-3 sm:p-4"
      >
        <div className="flex flex-wrap gap-3 sm:gap-6 text-[10px] sm:text-xs text-[#8B949E]">
          <div>
            <span className="text-[#6E7681]">Provider:</span>{' '}
            <span className="text-[#E6EDF3]">{gameInfo.provider}</span>
          </div>
          <div>
            <span className="text-[#6E7681]">RTP:</span>{' '}
            <span className="text-[#E6EDF3] font-mono">{gameInfo.rtp}%</span>
          </div>
          <div>
            <span className="text-[#6E7681]">House Edge:</span>{' '}
            <span className="text-[#E6EDF3] font-mono">{gameInfo.houseEdge}%</span>
          </div>
          <div>
            <span className="text-[#6E7681]">Min Bet:</span>{' '}
            <span className="text-[#E6EDF3] font-mono">${gameInfo.minBet}</span>
          </div>
          <div>
            <span className="text-[#6E7681]">Max Bet:</span>{' '}
            <span className="text-[#E6EDF3] font-mono">${gameInfo.maxBet}</span>
          </div>
        </div>
        {gameInfo.description && (
          <p className="mt-3 text-sm text-[#8B949E] leading-relaxed">
            {gameInfo.description}
          </p>
        )}
      </motion.div>
    </div>
  );
}
