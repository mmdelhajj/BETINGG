'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Volume2, VolumeX, ChevronDown, RotateCcw, Zap, Hash, Trophy, Home, Info, Minus, Plus } from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WinEntry {
  type: 'line' | 'diagonal' | 'four_corners' | 'full_card' | 'blackout';
  card: number;
  positions: number[][];
  multiplier: number;
}

interface BingoResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    cards: number[][][];
    drawnNumbers: number[];
    wins: WinEntry[];
    totalMultiplier: number;
    payout: number;
    cardCount: number;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface GameHistory {
  id: string;
  betAmount: number;
  payout: number;
  profit: number;
  wins: WinEntry[];
  cardCount: number;
  multiplier: number;
  timestamp: Date;
}

type GamePhase = 'idle' | 'drawing' | 'result';
type DrawSpeed = 'slow' | 'fast' | 'instant';

const COLUMN_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const COLUMN_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

const WIN_TYPE_LABELS: Record<string, string> = {
  line: 'Line',
  diagonal: 'Diagonal',
  four_corners: 'Four Corners',
  full_card: 'Full Card',
  blackout: 'Blackout',
};

const WIN_TYPE_MULTIPLIERS: Record<string, number> = {
  line: 3,
  diagonal: 4,
  four_corners: 8,
  full_card: 50,
  blackout: 100,
};

const BET_PRESETS = [0.01, 0.1, 1, 10, 100];

// ---------------------------------------------------------------------------
// Bouncing Ball Component
// ---------------------------------------------------------------------------

function BouncingBall({ number, letter }: { number: number; letter: string }) {
  const colIdx = COLUMN_LETTERS.indexOf(letter as any);
  const color = COLUMN_COLORS[colIdx] || '#8B5CF6';

  return (
    <motion.div
      initial={{ y: -60, scale: 0.3, opacity: 0 }}
      animate={{
        y: [-60, 10, -20, 5, 0],
        scale: [0.3, 1.1, 0.95, 1.02, 1],
        opacity: 1,
      }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative flex flex-col items-center"
    >
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center shadow-2xl"
        style={{
          background: `radial-gradient(ellipse at 35% 30%, ${color}dd, ${color} 60%, ${color}99 100%)`,
          boxShadow: `0 8px 32px ${color}60, inset 0 2px 12px rgba(255,255,255,0.3), inset 0 -4px 8px rgba(0,0,0,0.2)`,
        }}
      >
        <span className="text-[9px] font-bold text-white/80 leading-none">{letter}</span>
        <span className="text-lg sm:text-xl font-black text-white leading-tight">{number}</span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Called Numbers Board (75 numbers)
// ---------------------------------------------------------------------------

function CalledNumbersBoard({ calledNumbers }: { calledNumbers: Set<number> }) {
  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
      <h3 className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider mb-2">Called Numbers</h3>
      <div className="grid grid-cols-5 gap-0.5">
        {COLUMN_LETTERS.map((letter, colIdx) => (
          <div key={letter}>
            <div className="text-center text-[10px] font-bold py-0.5 rounded-t" style={{ color: COLUMN_COLORS[colIdx] }}>{letter}</div>
            <div className="space-y-0.5">
              {Array.from({ length: 15 }, (_, i) => {
                const num = colIdx * 15 + i + 1;
                const called = calledNumbers.has(num);
                return (
                  <div
                    key={num}
                    className={cn('text-center text-[9px] font-mono py-0.5 rounded transition-all duration-300',
                      called ? 'text-white font-bold' : 'bg-[#0D1117] text-[#484F58]')}
                    style={called ? { backgroundColor: `${COLUMN_COLORS[colIdx]}30`, color: COLUMN_COLORS[colIdx] } : undefined}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bingo Card Component
// ---------------------------------------------------------------------------

function BingoCard({
  card, cardIndex, daubedNumbers, winPositions, isAnimating,
}: {
  card: number[][]; cardIndex: number; daubedNumbers: Set<number>; winPositions: Set<string>; isAnimating: boolean;
}) {
  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
      <div className="grid grid-cols-5">
        {COLUMN_LETTERS.map((letter, i) => (
          <div key={letter} className="text-center py-1.5 text-sm font-black tracking-wider"
            style={{ color: COLUMN_COLORS[i], backgroundColor: `${COLUMN_COLORS[i]}10` }}>{letter}</div>
        ))}
      </div>
      <div className="text-center text-[10px] text-[#484F58] py-0.5 bg-[#0D1117]/50">Card {cardIndex + 1}</div>
      <div className="grid grid-cols-5 gap-[1px] bg-[#30363D]/30 p-[1px]">
        {card.map((row, rowIdx) =>
          row.map((num, colIdx) => {
            const isFree = num === 0;
            const isDaubed = isFree || daubedNumbers.has(num);
            const posKey = `${rowIdx},${colIdx}`;
            const isWinPos = winPositions.has(posKey);
            return (
              <motion.div
                key={`${rowIdx}-${colIdx}`}
                className={cn(
                  'relative aspect-square flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300',
                  isFree ? 'bg-[#C8FF00]/10 text-[#C8FF00]'
                    : isDaubed ? 'bg-[#10B981]/15 text-[#10B981]'
                    : 'bg-[#0D1117] text-[#8B949E]',
                )}
                animate={isWinPos ? { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] } : {}}
                transition={isWinPos ? { duration: 1.2, repeat: Infinity } : {}}
              >
                {isDaubed && !isFree && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-[2px] rounded-full bg-[#10B981]/20 border border-[#10B981]/40" />
                  </motion.div>
                )}
                {isWinPos && <div className="absolute inset-0 bg-[#C8FF00]/10 border border-[#C8FF00]/50 rounded-sm" />}
                <span className="relative z-10">{isFree ? 'FREE' : num}</span>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bingo Game Page
// ---------------------------------------------------------------------------

export default function BingoGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [betAmount, setBetAmount] = useState('');
  const [cardCount, setCardCount] = useState(1);
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [drawSpeed, setDrawSpeed] = useState<DrawSpeed>('fast');
  const [cards, setCards] = useState<number[][][]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentBall, setCurrentBall] = useState<{ number: number; letter: string } | null>(null);
  const [wins, setWins] = useState<WinEntry[]>([]);
  const [totalMultiplier, setTotalMultiplier] = useState(0);
  const [lastPayout, setLastPayout] = useState(0);
  const [lastProfit, setLastProfit] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [showFairness, setShowFairness] = useState(false);
  const [lastFairness, setLastFairness] = useState<BingoResponse['fairness'] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCalledBoard, setShowCalledBoard] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const isPlayingRef = useRef(false);
  const drawTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  const currentBalance = useMemo(() => {
    if (!user?.balances) return 0;
    return user.balances.find((b) => b.currency === currency)?.available ?? 0;
  }, [user?.balances, currency]);

  const calledNumbersSet = useMemo(() => new Set(drawnNumbers.slice(0, revealedCount)), [drawnNumbers, revealedCount]);
  const daubedNumbers = useMemo(() => calledNumbersSet, [calledNumbersSet]);

  const winPositionSets = useMemo(() => {
    if (gamePhase !== 'result') return [];
    return cards.map((_, cardIdx) => {
      const set = new Set<string>();
      wins.filter((w) => w.card === cardIdx).forEach((w) => { w.positions.forEach(([row, col]) => { set.add(`${row},${col}`); }); });
      return set;
    });
  }, [wins, cards, gamePhase]);

  const getLetterForNumber = (num: number): string => {
    if (num <= 15) return 'B'; if (num <= 30) return 'I'; if (num <= 45) return 'N'; if (num <= 60) return 'G'; return 'O';
  };

  useEffect(() => { return () => { if (drawTimerRef.current) clearTimeout(drawTimerRef.current); }; }, []);

  const handlePlay = useCallback(async () => {
    if (isPlayingRef.current || gamePhase === 'drawing') return;
    isPlayingRef.current = true;
    setGamePhase('drawing'); setError(null); setWins([]); setTotalMultiplier(0); setLastPayout(0); setLastProfit(0);
    setCards([]); setDrawnNumbers([]); setRevealedCount(0); setCurrentBall(null);

    try {
      const data = await post<BingoResponse>('/casino/games/bingo/play', { amount: parseFloat(betAmount), currency, options: { cardCount } });
      setCards(data.result?.cards ?? []); setDrawnNumbers(data.result?.drawnNumbers ?? []); setWins(data.result?.wins ?? []);
      setTotalMultiplier(data.result?.totalMultiplier ?? 0); setLastPayout(data.payout); setLastProfit(data.profit); setLastFairness(data.fairness);
      if (data.newBalance !== undefined) { useAuthStore.getState().updateBalance(currency, data.newBalance, 0); }

      const drawnNums = data.result?.drawnNumbers ?? [];
      const resultWins = data.result?.wins ?? [];
      const resultCardCount = data.result?.cardCount ?? cardCount;
      const totalDraws = drawnNums.length;
      const delays = { slow: 500, fast: 150, instant: 0 };
      const delay = delays[drawSpeed];

      if (delay === 0) {
        setRevealedCount(totalDraws);
        if (totalDraws > 0) { setCurrentBall({ number: drawnNums[totalDraws - 1], letter: getLetterForNumber(drawnNums[totalDraws - 1]) }); }
        setGamePhase('result'); isPlayingRef.current = false;
        setHistory((prev) => [{ id: data.roundId, betAmount: data.betAmount, payout: data.payout, profit: data.profit, wins: resultWins, cardCount: resultCardCount, multiplier: data.multiplier, timestamp: new Date() }, ...prev.slice(0, 9)]);
      } else {
        let count = 0;
        const revealNext = () => {
          count++;
          const num = drawnNums[count - 1];
          setRevealedCount(count);
          if (num !== undefined) { setCurrentBall({ number: num, letter: getLetterForNumber(num) }); }
          if (count < totalDraws) { drawTimerRef.current = setTimeout(revealNext, delay); }
          else {
            setGamePhase('result'); isPlayingRef.current = false;
            setHistory((prev) => [{ id: data.roundId, betAmount: data.betAmount, payout: data.payout, profit: data.profit, wins: resultWins, cardCount: resultCardCount, multiplier: data.multiplier, timestamp: new Date() }, ...prev.slice(0, 9)]);
          }
        };
        drawTimerRef.current = setTimeout(revealNext, delay);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to play. Please try again.');
      setGamePhase('idle'); isPlayingRef.current = false;
    }
  }, [betAmount, currency, cardCount, drawSpeed, gamePhase]);

  const skipToEnd = useCallback(() => {
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current);
    setRevealedCount(drawnNumbers.length);
    if (drawnNumbers.length > 0) { setCurrentBall({ number: drawnNumbers[drawnNumbers.length - 1], letter: getLetterForNumber(drawnNumbers[drawnNumbers.length - 1]) }); }
    setGamePhase('result'); isPlayingRef.current = false;
  }, [drawnNumbers]);

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00000001, val * factor).toFixed(8).replace(/\.?0+$/, (m) => m.includes('.') ? m : ''));
  };

  const decrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00000001, val - (val * 0.1 || 0.001)).toFixed(8).replace(/\.?0+$/, ''));
  };

  const incrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount((val + (val * 0.1 || 0.001)).toFixed(8).replace(/\.?0+$/, ''));
  };

  const setMaxBet = () => {
    const maxPerCard = currentBalance / cardCount;
    setBetAmount(maxPerCard.toFixed(8).replace(/\.?0+$/, ''));
  };

  const bestWinLabel = useMemo(() => {
    if (wins.length === 0) return null;
    const bestMult = Math.max(...wins.map((w) => w.multiplier));
    const bestWin = wins.find((w) => w.multiplier === bestMult);
    return bestWin ? (WIN_TYPE_LABELS[bestWin.type] || bestWin.type) : null;
  }, [wins]);

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* BINGO! celebration overlay */}
      <AnimatePresence>
        {gamePhase === 'result' && wins.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.3, opacity: 0, rotateZ: -10 }}
              animate={{ scale: [0.3, 1.3, 1], opacity: [0, 1, 1, 1, 0], rotateZ: [-10, 5, 0] }}
              transition={{ duration: 2.5, times: [0, 0.2, 0.4, 0.8, 1] }}
              className="text-center">
              <div className="text-6xl sm:text-8xl font-black text-[#C8FF00] drop-shadow-2xl">BINGO!</div>
              <div className="mt-2 text-2xl sm:text-3xl font-bold text-[#10B981]">+{formatCurrency(lastPayout, currency)}</div>
              {bestWinLabel && <div className="mt-1 text-lg text-[#C8FF00] font-semibold">{bestWinLabel}!</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-xs text-[#EF4444]">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-[#EF4444] hover:text-[#F87171] text-lg leading-none">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Ball / Number Caller -- edge-to-edge */}
      <div className="w-full bg-[#0D1117] p-6 flex flex-col items-center justify-center min-h-[120px]">
        {gamePhase === 'idle' && !currentBall && (
          <div className="text-center">
            <div className="text-[#484F58] text-sm mb-1">Ready to play</div>
            <div className="text-[#30363D] text-4xl font-black font-mono">--</div>
          </div>
        )}
        {currentBall && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] text-[#8B949E] uppercase tracking-wider font-medium">
              {gamePhase === 'drawing' ? `Ball ${revealedCount} of ${drawnNumbers.length}` : 'Last Ball'}
            </div>
            <BouncingBall key={`${currentBall.letter}${currentBall.number}-${revealedCount}`} number={currentBall.number} letter={currentBall.letter} />
          </div>
        )}
        {gamePhase === 'drawing' && (
          <button onClick={skipToEnd} className="mt-3 text-xs text-[#8B949E] hover:text-white transition-colors underline underline-offset-2">Skip to end</button>
        )}
        {/* Draw progress bar */}
        {(gamePhase === 'drawing' || gamePhase === 'result') && drawnNumbers.length > 0 && (
          <div className="w-full max-w-xs mt-3">
            <div className="h-1.5 rounded-full bg-[#0D1117] border border-[#30363D] overflow-hidden">
              <motion.div className="h-full rounded-full bg-[#C8FF00]" animate={{ width: `${(revealedCount / drawnNumbers.length) * 100}%` }} transition={{ duration: 0.2 }} />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 space-y-3 mt-3">
        {/* Bingo Cards */}
        {cards.length > 0 && (
          <div className={cn('grid gap-3', cards.length === 1 ? 'grid-cols-1' : cards.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3')}>
            {cards.map((card, idx) => (
              <BingoCard key={idx} card={card} cardIndex={idx} daubedNumbers={daubedNumbers} winPositions={winPositionSets[idx] || new Set()} isAnimating={gamePhase === 'drawing'} />
            ))}
          </div>
        )}

        {/* Result summary */}
        <AnimatePresence>
          {gamePhase === 'result' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={cn('rounded-xl p-4 border text-center',
                wins.length > 0 ? 'bg-[#10B981]/10 border-[#10B981]/30' : 'bg-[#EF4444]/10 border-[#EF4444]/30')}>
              {wins.length > 0 ? (
                <div>
                  <Trophy className="w-6 h-6 text-[#C8FF00] mx-auto mb-2" />
                  <div className="text-lg font-bold text-[#10B981]">Won {formatCurrency(lastPayout, currency)}!</div>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {wins.map((w, i) => (
                      <span key={i} className="text-[10px] bg-[#10B981]/15 text-[#10B981] px-2 py-0.5 rounded-full font-medium">
                        {WIN_TYPE_LABELS[w.type]} ({w.multiplier}x) - Card {w.card + 1}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-lg font-bold text-[#EF4444]">No Bingo</div>
                  <div className="text-xs text-[#8B949E] mt-1">Better luck next time!</div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Called Numbers Board */}
        {(gamePhase === 'drawing' || gamePhase === 'result') && showCalledBoard && (
          <CalledNumbersBoard calledNumbers={calledNumbersSet} />
        )}

        {/* Card Count -- pills with active = lime border */}
        <div>
          <label className="text-[#8B949E] text-sm mb-2 block">Number of Cards</label>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((count) => (
              <button key={count} onClick={() => gamePhase === 'idle' && setCardCount(count)} disabled={gamePhase !== 'idle'}
                className={cn('h-10 rounded-xl font-bold text-sm transition-all border',
                  cardCount === count ? 'bg-[#C8FF00]/10 border-[#C8FF00] text-[#C8FF00]' : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]',
                  gamePhase !== 'idle' && 'opacity-50 cursor-not-allowed')}>
                {count} Card{count > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Draw Speed -- pills with active = lime border */}
        <div>
          <label className="text-[#8B949E] text-sm mb-2 block">Draw Speed</label>
          <div className="grid grid-cols-3 gap-2">
            {(['slow', 'fast', 'instant'] as DrawSpeed[]).map((speed) => (
              <button key={speed} onClick={() => setDrawSpeed(speed)}
                className={cn('h-9 rounded-lg text-xs font-semibold transition-all border capitalize',
                  drawSpeed === speed ? 'bg-[#C8FF00]/10 border-[#C8FF00] text-[#C8FF00]' : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]')}>
                {speed}
              </button>
            ))}
          </div>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-[#8B949E] text-sm mr-2">{currency}</span>
            <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={gamePhase !== 'idle'} step="any" min="0"
              className="flex-1 bg-transparent text-center text-sm font-mono text-white focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
            <div className="flex items-center gap-1 ml-2">
              <button onClick={decrementBet} disabled={gamePhase !== 'idle'} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button onClick={incrementBet} disabled={gamePhase !== 'idle'} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {BET_PRESETS.map((preset) => (
              <button key={preset} onClick={() => setBetAmount(String(preset))} disabled={gamePhase !== 'idle'}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40">
                {preset}
              </button>
            ))}
            <button onClick={() => adjustBet(0.5)} disabled={gamePhase !== 'idle'} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-40">1/2</button>
            <button onClick={() => adjustBet(2)} disabled={gamePhase !== 'idle'} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-40">2X</button>
          </div>
        </div>

        {/* Total bet */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-[#8B949E]">Total Bet ({cardCount} card{cardCount > 1 ? 's' : ''})</span>
          <span className="text-sm font-bold font-mono text-[#C8FF00]">{formatCurrency((parseFloat(betAmount) || 0) * cardCount, currency)}</span>
        </div>

        {/* PLAY BINGO Button */}
        <motion.button whileTap={{ scale: 0.98 }} disabled={!isAuthenticated || gamePhase !== 'idle'} onClick={handlePlay}
          className={cn('w-full py-3.5 font-bold rounded-xl transition-all text-base',
            gamePhase !== 'idle' || !isAuthenticated ? 'bg-[#30363D] text-[#484F58] cursor-not-allowed' : 'bg-[#C8FF00] text-black')}>
          {gamePhase === 'drawing' ? 'Drawing...' : isAuthenticated ? (gamePhase === 'result' ? 'PLAY AGAIN' : 'PLAY BINGO') : 'LOGIN TO PLAY'}
        </motion.button>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
            <button onClick={() => setShowHistory(!showHistory)}
              className="w-full p-3 flex items-center justify-between text-xs font-medium text-[#8B949E] hover:text-white transition-colors">
              <span>History ({history.length})</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', showHistory && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border-t border-[#30363D] max-h-48 overflow-y-auto divide-y divide-[#30363D]/30">
                    {history.map((h) => (
                      <div key={h.id} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#8B949E]">{h.cardCount} card{h.cardCount > 1 ? 's' : ''}</span>
                          <span className="font-mono text-white">{formatCurrency(h.betAmount, currency)}</span>
                        </div>
                        <span className={cn('font-mono font-bold', h.wins.length > 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                          {h.wins.length > 0 ? `+${formatCurrency(h.profit, currency)}` : `-${formatCurrency(h.betAmount, currency)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E]"><Home className="w-6 h-6" /></Link>
          <button onClick={() => setShowFairness(!showFairness)} className="text-[#8B949E]"><Info className="w-6 h-6" /></button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E]">
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">{formatCurrency(currentBalance, currency)}</span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
