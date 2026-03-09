'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Shield,
  Home,
  Info,
  Volume2,
  VolumeX,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GamePhase = 'idle' | 'shuffling' | 'picking' | 'revealing' | 'result';

interface GameHistory {
  id: string;
  guess: number;
  ballPosition: number;
  won: boolean;
  amount: number;
  payout: number;
  profit: number;
}

interface ThimblesResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    guess: number;
    ballPosition: number;
    isWin: boolean;
    cups: number;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

// ---------------------------------------------------------------------------
// Particle burst for wins
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  life: number;
}

function ParticleBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for non-GPU
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#C8FF00', '#10B981', '#34D399', '#FFD700', '#FCD34D'];
    const cx = canvas.offsetWidth / 2;
    const cy = canvas.offsetHeight / 2;

    particlesRef.current = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: cx,
      y: cy,
      angle: (Math.PI * 2 * i) / 40 + (Math.random() - 0.5) * 0.5,
      speed: 2 + Math.random() * 4,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      let alive = false;
      particlesRef.current.forEach((p) => {
        if (p.life <= 0) return;
        alive = true;
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed + 0.5;
        p.life -= 0.018;
        p.speed *= 0.98;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.6, 1);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (alive) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  if (!active) return null;
  return (
    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-20" style={{ width: '100%', height: '100%' }} />
  );
}

// ---------------------------------------------------------------------------
// Cup Component
// ---------------------------------------------------------------------------

function Cup({
  index, phase, isSelected, hasBall, isWin, shuffleOffset, onClick, liftDelay,
}: {
  index: number;
  phase: GamePhase;
  isSelected: boolean;
  hasBall: boolean;
  isWin: boolean;
  shuffleOffset: { x: number; y: number };
  onClick: () => void;
  liftDelay: number;
}) {
  const isLifted = phase === 'revealing' || phase === 'result';
  const isClickable = phase === 'picking';

  return (
    <motion.div
      className="relative flex flex-col items-center"
      animate={{
        x: phase === 'shuffling' ? shuffleOffset.x : 0,
        y: phase === 'shuffling' ? shuffleOffset.y : 0,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <div className="relative w-24 h-32 flex items-end justify-center">
        {/* Ball */}
        <motion.div
          className={cn(
            'absolute bottom-0 w-8 h-8 rounded-full z-0',
            hasBall ? 'bg-gradient-to-br from-[#C8FF00] via-[#A8D800] to-[#8BB800]' : 'opacity-0',
          )}
          animate={{
            opacity: isLifted && hasBall ? 1 : 0,
            scale: isLifted && hasBall ? 1 : 0.3,
          }}
          transition={{ delay: liftDelay + 0.2, duration: 0.3 }}
          style={{
            boxShadow: hasBall && isLifted ? '0 0 20px rgba(200,255,0,0.6), 0 0 40px rgba(200,255,0,0.3)' : 'none',
          }}
        />

        {/* Cup */}
        <motion.div
          className={cn(
            'relative z-10 cursor-pointer select-none transition-all',
            isClickable && 'hover:scale-105 active:scale-95',
            !isClickable && 'cursor-default',
          )}
          animate={{
            y: isLifted ? -50 : 0,
            rotateX: isLifted ? -15 : 0,
          }}
          transition={{
            delay: isLifted ? liftDelay : 0,
            duration: 0.5,
            type: 'spring',
            stiffness: 200,
            damping: 15,
          }}
          onClick={isClickable ? onClick : undefined}
          whileHover={isClickable ? { y: -8 } : undefined}
          whileTap={isClickable ? { scale: 0.95 } : undefined}
        >
          <div
            className={cn(
              'w-20 h-24 rounded-t-full relative overflow-hidden transition-all duration-300',
              isSelected && phase === 'result' && isWin && 'ring-2 ring-[#10B981] shadow-[0_0_30px_rgba(16,185,129,0.4)]',
              isSelected && phase === 'result' && !isWin && 'ring-2 ring-[#EF4444] shadow-[0_0_20px_rgba(239,68,68,0.4)]',
              isClickable && 'hover:shadow-[0_0_15px_rgba(200,255,0,0.3)]',
            )}
            style={{
              background: 'linear-gradient(180deg, #3B3B3B 0%, #2A2A2A 30%, #1F1F1F 60%, #151515 100%)',
              boxShadow: 'inset 0 2px 20px rgba(255,255,255,0.08), inset 0 -4px 12px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.3)',
              clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
            }}
          >
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 40%)' }} />
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#484848]/40 to-transparent rounded-t-full" />
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-3 rounded-full bg-gradient-to-b from-[#555] to-[#333] border border-[#666]/50" />
          </div>

          {/* Cup number */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-md',
              isSelected && phase === 'result' && isWin ? 'bg-[#10B981]/20 text-[#10B981]' :
              isSelected && phase === 'result' && !isWin ? 'bg-[#EF4444]/20 text-[#EF4444]' :
              isClickable ? 'bg-[#C8FF00]/10 text-[#C8FF00]' :
              'bg-[#1C2128] text-[#8B949E]',
            )}>
              {index + 1}
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];
const MULTIPLIER = 2.82;
const NUM_CUPS = 3;

function generateShuffleSequence(count: number): Array<{ from: number; to: number }> {
  const swaps: Array<{ from: number; to: number }> = [];
  for (let i = 0; i < count; i++) {
    let a = Math.floor(Math.random() * NUM_CUPS);
    let b: number;
    do { b = Math.floor(Math.random() * NUM_CUPS); } while (b === a);
    swaps.push({ from: a, to: b });
  }
  return swaps;
}

// ---------------------------------------------------------------------------
// ThimblesGamePage
// ---------------------------------------------------------------------------

export default function ThimblesGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  const [betAmount, setBetAmount] = useState('');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [selectedCup, setSelectedCup] = useState<number | null>(null);
  const [ballPosition, setBallPosition] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [lastProfit, setLastProfit] = useState<number>(0);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [lastFairness, setLastFairness] = useState<ThimblesResponse['fairness'] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual');

  const [cupPositions, setCupPositions] = useState<Array<{ x: number; y: number }>>([
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ]);

  const isPlayingRef = useRef(false);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  const currentBalance = useMemo(() => {
    if (!user?.balances) return 0;
    const bal = user.balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [user?.balances, currency]);

  const { totalWins, totalLosses } = useMemo(() => {
    let tw = 0, tl = 0;
    for (const h of history) { if (h.won) tw++; else tl++; }
    return { totalWins: tw, totalLosses: tl };
  }, [history]);

  const potentialProfit = useMemo(() => {
    const amt = parseFloat(betAmount) || 0;
    return amt * MULTIPLIER - amt;
  }, [betAmount]);

  // -----------------------------------------------------------------------
  // Start game
  // -----------------------------------------------------------------------
  const startGame = useCallback(async () => {
    if (isPlayingRef.current || !isAuthenticated) return;
    if (!betAmount || parseFloat(betAmount) <= 0) { setError('Please enter a valid bet amount.'); return; }
    isPlayingRef.current = true;
    setError(null);
    setSelectedCup(null);
    setBallPosition(null);
    setLastWon(null);
    setLastProfit(0);
    setGamePhase('shuffling');

    const swapCount = 5 + Math.floor(Math.random() * 4);
    const swaps = generateShuffleSequence(swapCount);
    const cupSpacing = 120;
    const positions = [0, 1, 2];

    for (let i = 0; i < swaps.length; i++) {
      const { from, to } = swaps[i];
      const fromIdx = positions.indexOf(from);
      const toIdx = positions.indexOf(to);
      if (fromIdx === -1 || toIdx === -1) continue;
      [positions[fromIdx], positions[toIdx]] = [positions[toIdx], positions[fromIdx]];
      const newOffsets = [0, 1, 2].map((cupIdx) => {
        const logicalPos = positions.indexOf(cupIdx);
        return { x: (logicalPos - cupIdx) * cupSpacing, y: 0 };
      });
      setCupPositions([...newOffsets]);
      await new Promise((r) => setTimeout(r, 250));
    }

    await new Promise((r) => setTimeout(r, 300));
    setCupPositions([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    await new Promise((r) => setTimeout(r, 400));
    setGamePhase('picking');
    isPlayingRef.current = false;
  }, [betAmount, isAuthenticated]);

  // -----------------------------------------------------------------------
  // Pick a cup
  // -----------------------------------------------------------------------
  const pickCup = useCallback(async (cupIndex: number) => {
    if (gamePhase !== 'picking') return;
    isPlayingRef.current = true;
    setSelectedCup(cupIndex);
    setGamePhase('revealing');

    try {
      const data = await post<ThimblesResponse>('/casino/games/thimbles/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { guess: cupIndex, cups: NUM_CUPS },
      });

      const resultBallPos = data.result?.ballPosition ?? 0;
      const resultIsWin = data.result?.isWin ?? false;
      setBallPosition(resultBallPos);
      setLastWon(resultIsWin);
      setLastProfit(data.profit ?? 0);
      setLastFairness(data.fairness);

      if (data.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, data.newBalance, 0);
      }

      setTimeout(() => {
        setGamePhase('result');
        isPlayingRef.current = false;
        const round: GameHistory = {
          id: `th-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          guess: cupIndex,
          ballPosition: resultBallPos,
          won: resultIsWin,
          amount: parseFloat(betAmount),
          payout: data.payout ?? 0,
          profit: data.profit ?? 0,
        };
        setHistory((prev) => [round, ...prev.slice(0, 19)]);
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to place bet. Please try again.';
      setError(msg);
      setGamePhase('idle');
      isPlayingRef.current = false;
    }
  }, [gamePhase, betAmount, currency]);

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00000001, val * factor).toFixed(8).replace(/\.?0+$/, (m) => m.includes('.') ? m : ''));
  };

  const isPlaying = gamePhase !== 'idle' && gamePhase !== 'result';

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center flex items-center justify-between"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-[#EF4444] hover:text-[#F87171] text-lg leading-none">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Arena */}
        <div className="relative bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
          {/* Phase indicator */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <div className={cn(
              'border rounded-full px-4 py-1.5 flex items-center gap-1.5',
              gamePhase === 'shuffling' && 'bg-[#F59E0B]/10 border-[#F59E0B]/30',
              gamePhase === 'picking' && 'bg-[#C8FF00]/10 border-[#C8FF00]/30',
              gamePhase === 'revealing' && 'bg-blue-500/10 border-blue-500/30',
              (gamePhase === 'idle' || gamePhase === 'result') && 'bg-[#1C2128]/80 border-[#30363D]',
            )}>
              <span className={cn(
                'text-xs font-semibold',
                gamePhase === 'shuffling' && 'text-[#F59E0B]',
                gamePhase === 'picking' && 'text-[#C8FF00]',
                gamePhase === 'revealing' && 'text-blue-400',
                (gamePhase === 'idle' || gamePhase === 'result') && 'text-[#8B949E]',
              )}>
                {gamePhase === 'idle' && 'Place your bet'}
                {gamePhase === 'shuffling' && 'Shuffling...'}
                {gamePhase === 'picking' && 'Pick a cup!'}
                {gamePhase === 'revealing' && 'Revealing...'}
                {gamePhase === 'result' && (lastWon ? 'You Win!' : 'You Lose')}
              </span>
            </div>
          </div>

          {/* Cups Container */}
          <div className="relative flex items-center justify-center min-h-[320px] py-8">
            <ParticleBurst active={gamePhase === 'result' && lastWon === true} />

            <div className="flex items-end gap-6">
              {[0, 1, 2].map((i) => (
                <Cup
                  key={i}
                  index={i}
                  phase={gamePhase}
                  isSelected={selectedCup === i}
                  hasBall={ballPosition === i}
                  isWin={selectedCup === i && lastWon === true}
                  shuffleOffset={cupPositions[i]}
                  onClick={() => pickCup(i)}
                  liftDelay={selectedCup === i ? 0 : 0.6}
                />
              ))}
            </div>

            {/* Result overlay */}
            <AnimatePresence>
              {gamePhase === 'result' && lastWon !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                  className="absolute bottom-4 text-center z-20"
                >
                  <p className={cn(
                    'text-2xl font-extrabold',
                    lastWon ? 'text-[#10B981]' : 'text-[#EF4444]',
                  )}>
                    {lastWon ? 'YOU WIN!' : 'YOU LOSE'}
                  </p>
                  {lastWon && lastProfit > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-1">
                      <span className="text-lg font-bold font-mono text-[#10B981]">+{formatCurrency(lastProfit, currency)}</span>
                    </motion.div>
                  )}
                  {!lastWon && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-1">
                      <span className="text-sm font-mono text-[#EF4444]/70">-{formatCurrency(parseFloat(betAmount) || 0, currency)}</span>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-[#8B949E] block mb-0.5">House Edge</span>
            <span className="text-base font-bold font-mono text-[#E6EDF3]">6%</span>
          </div>
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-[#8B949E] block mb-0.5">Win Chance</span>
            <span className="text-base font-bold font-mono text-[#E6EDF3]">33.3%</span>
          </div>
          <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-2.5 text-center">
            <span className="text-[10px] text-[#8B949E] block mb-0.5">Payout</span>
            <span className="text-base font-bold font-mono text-[#C8FF00]">{MULTIPLIER}x</span>
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
              placeholder="0.00"
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

        {/* Profit on Win */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8B949E]">Profit on Win</span>
            <span className="text-sm font-mono font-bold text-[#10B981]">+{formatCurrency(potentialProfit, currency)}</span>
          </div>
        </div>

        {/* START Button -- Lime CTA */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={!isAuthenticated || isPlaying}
          onClick={startGame}
          className={cn(
            'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all flex items-center justify-center gap-2',
            (isPlaying || !isAuthenticated) && 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed',
          )}
        >
          {gamePhase === 'shuffling' ? (
            <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />SHUFFLING...</>
          ) : gamePhase === 'picking' ? (
            'PICK A CUP!'
          ) : gamePhase === 'revealing' ? (
            <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />REVEALING...</>
          ) : isAuthenticated ? (
            gamePhase === 'result' ? 'PLAY AGAIN' : 'START'
          ) : (
            'Login to Play'
          )}
        </motion.button>

        {/* History Strip */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-[#8B949E] uppercase tracking-wider">Recent Results</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#10B981] font-mono">{totalWins}W</span>
                <span className="text-[#30363D]">|</span>
                <span className="text-[#EF4444] font-mono">{totalLosses}L</span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {history.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: i === 0 ? 0.1 : 0 }}
                  className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all border',
                    h.won
                      ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                      : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 opacity-60',
                  )}
                  title={`Cup ${h.guess + 1} -> Ball at ${h.ballPosition + 1}: ${h.won ? 'Win' : 'Loss'}`}
                >
                  {h.ballPosition + 1}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Provably Fair */}
        <AnimatePresence>
          {showFairness && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-[#C8FF00]" />
                  <span className="text-sm font-semibold text-[#E6EDF3]">Provably Fair</span>
                </div>
                {lastFairness ? (
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
                ) : (
                  <p className="text-xs text-[#8B949E]">Play a round to see fairness data.</p>
                )}
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
