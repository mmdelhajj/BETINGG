'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Info, Volume2, VolumeX } from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Risk = 'low' | 'medium' | 'high';
type RowCount = 8 | 12 | 16;

interface PlinkoResult {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    path: ('L' | 'R')[];
    bucketIndex: number;
    multiplier: number;
    risk: Risk;
    rows: RowCount;
  };
  fairness: { serverSeed?: string; clientSeed?: string; nonce?: number };
  newBalance: number;
}

interface ActiveBall {
  id: string;
  path: ('L' | 'R')[];
  bucketIndex: number;
  multiplier: number;
  profit: number;
  startTime: number;
  currentPegRow: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  phase: 'falling' | 'landed';
  trail: { x: number; y: number; alpha: number }[];
  hue: number;
}

interface HistoryEntry {
  multiplier: number;
  profit: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Multiplier tables (Stake-style)
// ---------------------------------------------------------------------------

const MULTIPLIERS: Record<Risk, Record<RowCount, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    12: [8.9, 3.0, 1.4, 1.1, 1.0, 0.5, 0.5, 1.0, 1.1, 1.4, 3.0, 8.9, 8.9],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getBucketColor(mult: number): string {
  if (mult >= 100) return '#A855F7';
  if (mult >= 10) return '#F59E0B';
  if (mult >= 5) return '#3B82F6';
  if (mult >= 2) return '#10B981';
  if (mult >= 1) return '#EAB308';
  if (mult >= 0.5) return '#F97316';
  return '#EF4444';
}

function getBucketGradient(mult: number): [string, string] {
  if (mult >= 100) return ['#A855F7', '#7C3AED'];
  if (mult >= 10) return ['#F59E0B', '#D97706'];
  if (mult >= 5) return ['#3B82F6', '#2563EB'];
  if (mult >= 2) return ['#10B981', '#059669'];
  if (mult >= 1) return ['#EAB308', '#CA8A04'];
  if (mult >= 0.5) return ['#F97316', '#EA580C'];
  return ['#EF4444', '#DC2626'];
}

function getHistoryDotColor(mult: number): string {
  if (mult >= 100) return 'bg-purple-500';
  if (mult >= 10) return 'bg-amber-500';
  if (mult >= 5) return 'bg-blue-500';
  if (mult >= 2) return 'bg-emerald-500';
  if (mult >= 1) return 'bg-yellow-500';
  if (mult >= 0.5) return 'bg-orange-500';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Canvas geometry calculations
// ---------------------------------------------------------------------------

function getPegPositions(rows: RowCount, canvasW: number, canvasH: number) {
  const pegs: { x: number; y: number; row: number; col: number }[] = [];
  const topPadding = canvasH * 0.06;
  const bottomPadding = canvasH * 0.14;
  const sidePadding = canvasW * 0.06;
  const boardH = canvasH - topPadding - bottomPadding;
  const boardW = canvasW - sidePadding * 2;
  const rowSpacing = boardH / (rows + 1);
  const maxPegsInRow = rows + 2;
  const pegSpacingX = boardW / maxPegsInRow;

  for (let r = 0; r < rows; r++) {
    const pegsInRow = r + 3;
    const rowWidth = (pegsInRow - 1) * pegSpacingX;
    const startX = (canvasW - rowWidth) / 2;
    const y = topPadding + (r + 1) * rowSpacing;

    for (let c = 0; c < pegsInRow; c++) {
      pegs.push({
        x: startX + c * pegSpacingX,
        y,
        row: r,
        col: c,
      });
    }
  }

  return { pegs, rowSpacing, pegSpacingX, topPadding, bottomPadding, boardH, sidePadding };
}

function getBucketPositions(rows: RowCount, canvasW: number, canvasH: number) {
  const mults = MULTIPLIERS.low[rows];
  const bucketCount = mults.length;
  const sidePadding = canvasW * 0.06;
  const boardW = canvasW - sidePadding * 2;
  const maxPegsInRow = rows + 2;
  const pegSpacingX = boardW / maxPegsInRow;
  const lastRowPegs = rows + 2;
  const lastRowWidth = (lastRowPegs - 1) * pegSpacingX;
  const lastRowStartX = (canvasW - lastRowWidth) / 2;
  const bucketWidth = pegSpacingX;
  const bucketY = canvasH * 0.88;

  const buckets: { x: number; y: number; width: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      x: lastRowStartX - pegSpacingX / 2 + i * bucketWidth,
      y: bucketY,
      width: bucketWidth,
    });
  }

  return { buckets, bucketWidth, bucketY };
}

function computeBallPath(
  path: ('L' | 'R')[],
  rows: RowCount,
  canvasW: number,
  canvasH: number,
): { x: number; y: number }[] {
  const { pegs, rowSpacing, pegSpacingX, topPadding } = getPegPositions(rows, canvasW, canvasH);
  const positions: { x: number; y: number }[] = [];

  const startX = canvasW / 2;
  const startY = topPadding - 10;
  positions.push({ x: startX, y: startY });

  let currentX = startX;

  for (let r = 0; r < path.length; r++) {
    const direction = path[r] === 'R' ? 1 : -1;
    const pegsInRow = r + 3;
    const maxPegsInRow = rows + 2;
    const boardW = canvasW - canvasW * 0.06 * 2;
    const pegSpX = boardW / maxPegsInRow;
    const offset = direction * (pegSpX / 2);

    currentX += offset;

    const y = topPadding + (r + 1) * (canvasH - topPadding - canvasH * 0.14) / (rows + 1);
    positions.push({ x: currentX, y });
  }

  const bucketY = canvasH * 0.88;
  positions.push({ x: currentX, y: bucketY + 10 });

  return positions;
}

// ---------------------------------------------------------------------------
// Main Component - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function PlinkoGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Game config
  const [risk, setRisk] = useState<Risk>('medium');
  const [rows, setRows] = useState<RowCount>(16);
  const [betAmount, setBetAmount] = useState('1.00');

  // Game state
  const [activeBalls, setActiveBalls] = useState<ActiveBall[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastWin, setLastWin] = useState<{ multiplier: number; profit: number } | null>(null);
  const [litBucket, setLitBucket] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-bet
  const [autoBetActive, setAutoBetActive] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState(0);
  const [autoBetTotal, setAutoBetTotal] = useState(10);
  const [dropRate, setDropRate] = useState(500);
  const autoBetRef = useRef(false);
  const autoBetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // UI
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual');
  const [isMuted, setIsMuted] = useState(false);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const ballsRef = useRef<ActiveBall[]>([]);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const isVisibleRef = useRef(true);

  // Memoized multipliers
  const multipliers = MULTIPLIERS[risk][rows];

  // Current balance
  const currentBalance = useMemo(() => {
    if (!user?.balances) return 0;
    const bal = user.balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [user?.balances, currency]);

  // Initialize bet amount from currency
  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
  }, [currency]);

  // ---------------------------------------------------------------------------
  // Canvas resize observer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const height = Math.min(width * 0.75, 600);
        setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
      }
    });

    observer.observe(container);
    const rect = container.getBoundingClientRect();
    setCanvasSize({ w: Math.floor(rect.width), h: Math.floor(Math.min(rect.width * 0.75, 600)) });

    return () => observer.disconnect();
  }, []);

  // IntersectionObserver to pause animation when not visible
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Canvas render loop
  // ---------------------------------------------------------------------------

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, W, H);

    const scaledW = W / dpr;
    const scaledH = H / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // --- Draw pegs ---
    const { pegs, pegSpacingX } = getPegPositions(rows, scaledW, scaledH);
    const pegRadius = Math.max(2.5, Math.min(pegSpacingX * 0.08, 5));

    pegs.forEach((peg) => {
      const gradient = ctx.createRadialGradient(peg.x, peg.y, 0, peg.x, peg.y, pegRadius * 3);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, pegRadius * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(peg.x - pegRadius * 0.25, peg.y - pegRadius * 0.25, pegRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- Draw buckets ---
    const { buckets, bucketWidth, bucketY } = getBucketPositions(rows, scaledW, scaledH);
    const mults = MULTIPLIERS[risk][rows];
    const bucketH = scaledH * 0.08;

    mults.forEach((mult, i) => {
      const bx = buckets[i].x;
      const by = bucketY;
      const bw = bucketWidth;
      const isLit = litBucket === i;
      const [colorA, colorB] = getBucketGradient(mult);

      const grad = ctx.createLinearGradient(bx, by, bx, by + bucketH);
      if (isLit) {
        grad.addColorStop(0, colorA);
        grad.addColorStop(1, colorB);
      } else {
        grad.addColorStop(0, colorA + '30');
        grad.addColorStop(1, colorB + '20');
      }
      ctx.fillStyle = grad;

      const r = 4;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bucketH - r);
      ctx.quadraticCurveTo(bx + bw, by + bucketH, bx + bw - r, by + bucketH);
      ctx.lineTo(bx + r, by + bucketH);
      ctx.quadraticCurveTo(bx, by + bucketH, bx, by + bucketH - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();

      if (isLit) {
        ctx.shadowColor = colorA;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = isLit ? colorA : colorA + '50';
      ctx.lineWidth = isLit ? 2 : 1;
      ctx.stroke();

      const fontSize = Math.max(8, Math.min(bw * 0.28, 13));
      ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isLit ? '#FFFFFF' : getBucketColor(mult);
      const label = mult >= 1000 ? `${(mult / 1000).toFixed(0)}K` : `${mult}x`;
      ctx.fillText(label, bx + bw / 2, by + bucketH / 2);
    });

    // --- Draw balls and trails ---
    const balls = ballsRef.current;

    balls.forEach((ball) => {
      for (let t = 0; t < ball.trail.length; t++) {
        const tp = ball.trail[t];
        if (tp.alpha <= 0) continue;
        const trailRadius = Math.max(2, 6 * tp.alpha);
        const alpha = tp.alpha * 0.6;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, trailRadius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${ball.hue}, 100%, 60%, ${alpha})`;
        ctx.fill();
      }

      if (ball.phase === 'landed') return;

      const glowGrad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 18);
      glowGrad.addColorStop(0, `hsla(${ball.hue}, 100%, 60%, 0.4)`);
      glowGrad.addColorStop(1, `hsla(${ball.hue}, 100%, 60%, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 18, 0, Math.PI * 2);
      ctx.fill();

      const ballGrad = ctx.createRadialGradient(
        ball.x - 2, ball.y - 2, 1,
        ball.x, ball.y, 8,
      );
      ballGrad.addColorStop(0, `hsl(${ball.hue}, 100%, 75%)`);
      ballGrad.addColorStop(1, `hsl(${ball.hue}, 100%, 50%)`);
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, [rows, risk, litBucket]);

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;
  }, [canvasSize]);

  useEffect(() => {
    let running = true;
    const PEG_BOUNCE_DURATION = 120;
    const SETTLE_DURATION = 200;

    const tick = (now: number) => {
      if (!running) return;

      // Skip frame when not visible, but keep the loop alive
      if (!isVisibleRef.current) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const balls = ballsRef.current;
      let needsUpdate = false;

      balls.forEach((ball) => {
        if (ball.phase === 'landed') return;

        const elapsed = now - ball.startTime;
        const totalPegs = ball.path.length;
        const pegIdx = Math.floor(elapsed / PEG_BOUNCE_DURATION);

        if (pegIdx >= totalPegs) {
          const settleElapsed = elapsed - totalPegs * PEG_BOUNCE_DURATION;
          if (settleElapsed > SETTLE_DURATION) {
            ball.phase = 'landed';
            needsUpdate = true;
            setLitBucket(ball.bucketIndex);
            setLastWin({ multiplier: ball.multiplier, profit: ball.profit });
            setHistory((prev) => [
              { multiplier: ball.multiplier, profit: ball.profit, timestamp: Date.now() },
              ...prev.slice(0, 19),
            ]);

            setTimeout(() => {
              setLitBucket((prev) => (prev === ball.bucketIndex ? null : prev));
            }, 1500);

            setTimeout(() => {
              ballsRef.current = ballsRef.current.filter((b) => b.id !== ball.id);
              setActiveBalls([...ballsRef.current]);
            }, 500);
          } else {
            const positions = computeBallPath(ball.path, rows, canvasSize.w, canvasSize.h);
            const lastPos = positions[positions.length - 1];
            const settleProgress = settleElapsed / SETTLE_DURATION;
            const bounceY = Math.sin(settleProgress * Math.PI) * -8;
            ball.x = lastPos.x;
            ball.y = lastPos.y + bounceY;
          }
        } else {
          const positions = computeBallPath(ball.path, rows, canvasSize.w, canvasSize.h);
          const fraction = (elapsed % PEG_BOUNCE_DURATION) / PEG_BOUNCE_DURATION;

          const fromIdx = Math.min(pegIdx, positions.length - 1);
          const toIdx = Math.min(pegIdx + 1, positions.length - 1);
          const from = positions[fromIdx];
          const to = positions[toIdx];

          const easeY = fraction * fraction;
          const easeX = 1 - (1 - fraction) * (1 - fraction);

          const bounceArc = Math.sin(fraction * Math.PI) * -12;

          ball.x = from.x + (to.x - from.x) * easeX;
          ball.y = from.y + (to.y - from.y) * easeY + bounceArc;

          ball.currentPegRow = pegIdx;
        }

        ball.trail.push({ x: ball.x, y: ball.y, alpha: 1.0 });
        if (ball.trail.length > 20) {
          ball.trail.shift();
        }
        ball.trail.forEach((t) => {
          t.alpha *= 0.88;
        });
      });

      renderCanvas();

      if (needsUpdate) {
        setActiveBalls([...ballsRef.current]);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [rows, canvasSize, renderCanvas]);

  // ---------------------------------------------------------------------------
  // Drop ball
  // ---------------------------------------------------------------------------

  const dropBall = useCallback(async () => {
    if (!isAuthenticated) {
      setErrorMessage('Please log in to play.');
      return;
    }

    setErrorMessage(null);
    setIsPlaying(true);

    try {
      const data = await post<PlinkoResult>('/casino/games/plinko/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { risk, rows },
      });

      if (data.newBalance !== undefined) {
        useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      }

      const path = data.result.path;
      const bucketIndex = data.result.bucketIndex;
      const mult = data.result.multiplier;
      const profit = data.profit;

      const hues = [38, 280, 160, 200, 340, 50, 120];
      const ball: ActiveBall = {
        id: data.roundId || `ball_${Date.now()}_${Math.random()}`,
        path,
        bucketIndex,
        multiplier: mult,
        profit,
        startTime: performance.now(),
        currentPegRow: 0,
        x: canvasSize.w / 2,
        y: canvasSize.h * 0.04,
        vx: 0,
        vy: 0,
        targetX: 0,
        targetY: 0,
        phase: 'falling',
        trail: [],
        hue: hues[Math.floor(Math.random() * hues.length)],
      };

      ballsRef.current = [...ballsRef.current, ball];
      setActiveBalls([...ballsRef.current]);
    } catch (err: any) {
      const msg = err?.errors?.code || err?.message || '';
      if (/insufficient/i.test(msg)) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else {
        setErrorMessage(err?.message || 'Failed to place bet. Please try again.');
      }
    } finally {
      setIsPlaying(false);
    }
  }, [isAuthenticated, betAmount, currency, risk, rows, canvasSize]);

  // ---------------------------------------------------------------------------
  // Auto-bet logic
  // ---------------------------------------------------------------------------

  const startAutoBet = useCallback(() => {
    autoBetRef.current = true;
    setAutoBetActive(true);
    setAutoBetCount(0);

    let count = 0;

    const runNext = () => {
      if (!autoBetRef.current || count >= autoBetTotal) {
        autoBetRef.current = false;
        setAutoBetActive(false);
        return;
      }

      count++;
      setAutoBetCount(count);
      dropBall();

      autoBetTimerRef.current = setTimeout(runNext, dropRate);
    };

    runNext();
  }, [dropBall, autoBetTotal, dropRate]);

  const stopAutoBet = useCallback(() => {
    autoBetRef.current = false;
    setAutoBetActive(false);
    if (autoBetTimerRef.current) {
      clearTimeout(autoBetTimerRef.current);
      autoBetTimerRef.current = null;
    }
  }, []);

  // Cleanup auto-bet on unmount
  useEffect(() => {
    return () => {
      autoBetRef.current = false;
      if (autoBetTimerRef.current) clearTimeout(autoBetTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Bet amount helpers
  // ---------------------------------------------------------------------------

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(8).replace(/\.?0+$/, ''));
  };

  const setMaxBet = () => {
    const bal = useAuthStore.getState().user?.balances?.find((b) => b.currency === currency);
    if (bal) setBetAmount(bal.available.toFixed(8).replace(/\.?0+$/, ''));
  };

  const ballsInFlight = activeBalls.filter((b) => b.phase === 'falling').length;

  // Quick bet presets
  const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

  // ---------------------------------------------------------------------------
  // Render - Cloudbet Mobile Style (EXACT SPEC)
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-3 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
          >
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-3 text-[#EF4444] hover:text-red-300 font-bold">
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas area - Full Width Edge-to-Edge (top ~45% of screen) */}
      <div
        ref={containerRef}
        className="relative bg-[#161B22] overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="w-full block cursor-pointer"
          style={{ height: canvasSize.h }}
          onClick={() => {
            if (!autoBetActive) dropBall();
          }}
        />

        {/* Last win overlay */}
        <AnimatePresence>
          {lastWin && activeBalls.filter((b) => b.phase === 'falling').length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <div className={cn(
                'px-5 py-2.5 rounded-xl border',
                lastWin.profit > 0
                  ? 'bg-[#10B981]/20 border-[#10B981]/40'
                  : lastWin.profit === 0
                    ? 'bg-yellow-500/20 border-yellow-500/40'
                    : 'bg-[#EF4444]/20 border-[#EF4444]/40'
              )}>
                <div className={cn(
                  'text-3xl font-bold font-mono text-center',
                  lastWin.profit > 0 ? 'text-[#10B981]' : lastWin.profit === 0 ? 'text-yellow-400' : 'text-[#EF4444]',
                )}>
                  {lastWin.multiplier}x
                </div>
                <div className={cn(
                  'text-sm font-mono text-center mt-0.5',
                  lastWin.profit > 0 ? 'text-[#10B981]' : lastWin.profit === 0 ? 'text-yellow-300' : 'text-[#EF4444]',
                )}>
                  {lastWin.profit > 0 ? '+' : ''}{formatCurrency(lastWin.profit, currency)}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Balls in flight indicator */}
        {ballsInFlight > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0D1117]/80 border border-[#30363D]">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-mono text-amber-400">{ballsInFlight}</span>
          </div>
        )}

        {/* Click to drop hint */}
        {activeBalls.length === 0 && !autoBetActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-2 opacity-30"
            >
              <div className="w-5 h-5 rounded-full bg-amber-400" />
              <span className="text-xs text-[#8B949E]">Tap or press Drop</span>
            </motion.div>
          </div>
        )}
      </div>

      {/* History dots - horizontal scroll */}
      {history.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-3 px-4">
          {history.map((entry, i) => (
            <motion.div
              key={`${entry.timestamp}-${i}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className={cn(
                'shrink-0 w-[48px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-mono font-bold text-white',
                getHistoryDotColor(entry.multiplier),
              )}
              title={`${entry.multiplier}x | ${entry.profit >= 0 ? '+' : ''}${formatCurrency(entry.profit, currency)}`}
            >
              {entry.multiplier}x
            </motion.div>
          ))}
        </div>
      )}

      {/* Controls Below Board */}
      <div className="px-4 pb-20 space-y-3">

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setBetMode('manual')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-all duration-200',
              betMode === 'manual'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setBetMode('auto')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-all duration-200',
              betMode === 'auto'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Auto
          </button>
        </div>

        {/* Risk Level Selector - Pill Buttons */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Risk Level</label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as Risk[]).map((r) => (
              <button
                key={r}
                onClick={() => { if (!autoBetActive) setRisk(r); }}
                disabled={autoBetActive}
                className={cn(
                  'flex-1 h-10 rounded-lg font-bold text-sm capitalize transition-all duration-200',
                  risk === r
                    ? r === 'low'
                      ? 'bg-[#10B981] text-white'
                      : r === 'medium'
                        ? 'bg-[#F59E0B] text-black'
                        : 'bg-[#EF4444] text-white'
                    : 'bg-[#0D1117] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-40',
                )}
              >
                {r === 'low' ? 'Low' : r === 'medium' ? 'Med' : 'High'}
              </button>
            ))}
          </div>
        </div>

        {/* Row Count - Pill Buttons, active = purple */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Rows</label>
          <div className="flex gap-2">
            {([8, 12, 16] as RowCount[]).map((r) => (
              <button
                key={r}
                onClick={() => { if (!autoBetActive && activeBalls.length === 0) setRows(r); }}
                disabled={autoBetActive || activeBalls.length > 0}
                className={cn(
                  'flex-1 h-10 rounded-lg font-mono font-bold text-sm transition-all duration-200',
                  rows === r
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-[#0D1117] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-40',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-xs text-[#8B949E] mr-2">{currency}</span>
            <input
              type="number"
              step="any"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={autoBetActive}
              className="flex-1 bg-transparent text-center text-sm font-mono text-[#E6EDF3] focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustBet(0.5)}
                disabled={autoBetActive}
                className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center disabled:opacity-40"
              >
                -
              </button>
              <button
                onClick={() => adjustBet(2)}
                disabled={autoBetActive}
                className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
          {/* Quick Presets */}
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {BET_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setBetAmount(p)}
                disabled={autoBetActive}
                className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => adjustBet(0.5)}
              disabled={autoBetActive}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
            >
              1/2
            </button>
            <button
              onClick={() => adjustBet(2)}
              disabled={autoBetActive}
              className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-40"
            >
              2X
            </button>
          </div>
        </div>

        {/* Drop Ball Button / Auto Bet */}
        {betMode === 'manual' ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={!isAuthenticated || isPlaying || autoBetActive}
            onClick={dropBall}
            className={cn(
              'w-full py-3.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 text-base',
              !isAuthenticated || isPlaying
                ? 'bg-[#2D333B] text-white cursor-not-allowed opacity-50'
                : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]',
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
            {!isAuthenticated ? 'Login to Play' : isPlaying ? 'Dropping...' : 'Drop Ball'}
          </motion.button>
        ) : (
          <div className="space-y-2">
            {/* Auto-bet controls */}
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[#8B949E] text-sm">Bets</label>
                {autoBetActive && (
                  <span className="text-[10px] font-mono text-amber-400">{autoBetCount}/{autoBetTotal}</span>
                )}
              </div>
              <input
                type="number"
                min={1}
                max={1000}
                value={autoBetTotal}
                onChange={(e) => setAutoBetTotal(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                disabled={autoBetActive}
                className="w-full h-9 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            {autoBetActive ? (
              <button
                onClick={stopAutoBet}
                className="w-full py-3.5 bg-[#EF4444]/20 hover:bg-[#EF4444]/30 border border-[#EF4444]/40 text-[#EF4444] font-bold text-base rounded-xl transition-all"
              >
                Stop Auto Bet
              </button>
            ) : (
              <button
                onClick={startAutoBet}
                disabled={!isAuthenticated}
                className={cn(
                  'w-full py-3.5 font-bold rounded-xl transition-all duration-200 text-base',
                  !isAuthenticated
                    ? 'bg-[#2D333B] text-white cursor-not-allowed opacity-50'
                    : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]',
                )}
              >
                Start Auto Bet
              </button>
            )}
          </div>
        )}

        {/* Session Stats */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold font-mono text-[#E6EDF3]">{history.length}</div>
                <div className="text-[10px] text-[#8B949E]">Drops</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono text-[#10B981]">
                  {history.filter((h) => h.profit > 0).length}
                </div>
                <div className="text-[10px] text-[#8B949E]">Wins</div>
              </div>
              <div>
                <div className={cn(
                  'text-lg font-bold font-mono',
                  history.reduce((s, h) => s + h.profit, 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
                )}>
                  {history.reduce((s, h) => s + h.profit, 0) >= 0 ? '+' : ''}
                  {formatCurrency(history.reduce((s, h) => s + h.profit, 0), currency, { maxDecimals: 4 })}
                </div>
                <div className="text-[10px] text-[#8B949E]">Profit</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        {/* Left icons */}
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <button className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

        {/* Center balance */}
        <span className="text-sm font-mono text-white">
          {formatCurrency(currentBalance, currency)} {currency}
        </span>

        {/* Right - Provably Fair Game badge */}
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
