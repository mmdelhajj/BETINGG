'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Decimal from 'decimal.js';

type Risk = 'low' | 'medium' | 'high';

// ---------- Multiplier Tables ----------
const MULTIPLIER_TABLES: Record<number, Record<Risk, number[]>> = {
  8: {
    low:    [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high:   [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low:    [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high:   [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low:    [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high:   [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

// ---------- Ball Physics ----------
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  path: number[]; // 0 = left, 1 = right for each row
  currentRow: number;
  targetBucket: number;
  done: boolean;
  color: string;
}

// ---------- Plinko Canvas ----------
function PlinkoCanvas({
  rows,
  risk,
  balls,
  onFrame,
}: {
  rows: number;
  risk: Risk;
  balls: Ball[];
  onFrame: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    const padTop = 30;
    const padBottom = 50;
    const padSide = 20;
    const availH = h - padTop - padBottom;
    const availW = w - padSide * 2;
    const rowSpacing = availH / (rows + 1);
    const pegRadius = Math.max(2, Math.min(4, w / 100));

    // Draw pegs
    for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 3; // Starts at 3 pegs (top row)
      const rowW = (pegsInRow - 1) * (availW / (rows + 2));
      const startX = (w - rowW) / 2;

      for (let col = 0; col < pegsInRow; col++) {
        const x = startX + col * (rowW / Math.max(1, pegsInRow - 1));
        const y = padTop + (row + 1) * rowSpacing;

        // Glow effect
        ctx.beginPath();
        ctx.arc(x, y, pegRadius + 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#334155';
        ctx.fill();
      }
    }

    // Draw buckets at bottom
    const multipliers = MULTIPLIER_TABLES[rows]?.[risk] || [];
    const bucketCount = multipliers.length;
    const bucketWidth = availW / bucketCount;
    const bucketY = h - padBottom + 5;

    for (let i = 0; i < bucketCount; i++) {
      const x = padSide + i * bucketWidth;
      const mult = multipliers[i];
      const center = bucketCount / 2;
      const _distFromCenter = Math.abs(i - (center - 0.5)) / center;

      // Color based on multiplier value
      let bgColor: string;
      if (mult >= 10) {
        bgColor = 'rgba(239, 68, 68, 0.3)'; // red - high
      } else if (mult >= 2) {
        bgColor = 'rgba(249, 115, 22, 0.3)'; // orange
      } else if (mult >= 1) {
        bgColor = 'rgba(34, 197, 94, 0.3)'; // green
      } else {
        bgColor = 'rgba(107, 114, 128, 0.2)'; // gray - low
      }

      // Draw bucket
      ctx.fillStyle = bgColor;
      ctx.fillRect(x + 1, bucketY, bucketWidth - 2, 35);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(x + 1, bucketY, bucketWidth - 2, 35);

      // Label
      ctx.fillStyle = mult >= 2 ? '#fff' : '#9ca3af';
      ctx.font = `${Math.max(8, Math.min(11, bucketWidth / 4))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${mult}x`, x + bucketWidth / 2, bucketY + 22);
    }

    // Draw balls
    for (const ball of balls) {
      if (ball.done) continue;

      // Trail
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.fill();

      // Ball
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(
        ball.x - 1,
        ball.y - 1,
        0,
        ball.x,
        ball.y,
        ball.radius
      );
      gradient.addColorStop(0, '#fbbf24');
      gradient.addColorStop(1, '#f59e0b');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Shine
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }

    onFrame();
    animRef.current = requestAnimationFrame(draw);
  }, [rows, risk, balls, onFrame]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
}

// ---------- Main Page Component ----------
export default function PlinkoPage() {
  const [stake, setStake] = useState('1.00');
  const [rows, setRows] = useState<number>(12);
  const [risk, setRisk] = useState<Risk>('medium');
  const [isDropping, setIsDropping] = useState(false);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [lastResult, setLastResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [autoDrop, setAutoDrop] = useState(false);
  const autoDropRef = useRef(false);
  autoDropRef.current = autoDrop;

  const updateBalls = useCallback(() => {
    setBalls((prev) => {
      if (prev.length === 0) return prev;

      return prev.map((ball) => {
        if (ball.done) return ball;

        // Simple gravity-based physics
        let newVy = ball.vy + 0.3; // gravity
        let newVx = ball.vx * 0.98; // friction
        const newX = ball.x + newVx;
        let newY = ball.y + newVy;
        let newRow = ball.currentRow;

        // Check if ball reached next peg row
        const canvasHeight = 500; // approximate
        const padTop = 30;
        const padBottom = 50;
        const availH = canvasHeight - padTop - padBottom;
        const rowSpacing = availH / (rows + 1);
        const nextRowY = padTop + (newRow + 1) * rowSpacing;

        if (newY >= nextRowY && newRow < rows) {
          // Bounce off peg - go left or right based on path
          const direction = ball.path[newRow] || 0;
          newVx = direction === 1 ? 2 + Math.random() : -(2 + Math.random());
          newVy = -newVy * 0.3;
          newY = nextRowY - 2;
          newRow++;
        }

        // Check if done (reached bottom)
        if (newY >= canvasHeight - padBottom) {
          return { ...ball, y: canvasHeight - padBottom - 5, done: true };
        }

        return {
          ...ball,
          x: newX,
          y: newY,
          vx: newVx,
          vy: newVy,
          currentRow: newRow,
        };
      });
    });
  }, [rows]);

  const handleDrop = async () => {
    setIsDropping(true);
    try {
      const { data } = await api.post('/casino/plinko/play', {
        currency: 'USDT',
        stake,
        rows,
        risk,
      });

      const result = data.data;
      setLastResult(result);
      setHistory((prev) => [result, ...prev.slice(0, 19)]);

      // Create ball with path
      const bucketIndex = result.bucket || Math.floor(Math.random() * (rows + 1));
      const path: number[] = [];
      // Generate a path that leads to the target bucket
      let _position = 0;
      for (let i = 0; i < rows; i++) {
        const targetRatio = bucketIndex / rows;
        const goRight = Math.random() < targetRatio + (Math.random() - 0.5) * 0.3;
        path.push(goRight ? 1 : 0);
        if (goRight) _position++;
      }

      const newBall: Ball = {
        x: 250, // center
        y: 20,
        vx: 0,
        vy: 1,
        radius: 5,
        path,
        currentRow: 0,
        targetBucket: bucketIndex,
        done: false,
        color: '#fbbf24',
      };

      setBalls((prev) => [...prev.filter((b) => !b.done).slice(-5), newBall]);
    } catch (err) {
      console.error('Drop failed:', err);
    } finally {
      setIsDropping(false);
    }
  };

  // Auto-drop loop
  useEffect(() => {
    if (!autoDrop) return;
    const interval = setInterval(() => {
      if (autoDropRef.current && !isDropping) {
        handleDrop();
      }
    }, 1200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDrop, isDropping]);

  // Clean up done balls
  useEffect(() => {
    const cleanup = setInterval(() => {
      setBalls((prev) => prev.filter((b) => !b.done || Date.now() - 0 < 2000));
    }, 3000);
    return () => clearInterval(cleanup);
  }, []);

  const multipliers = MULTIPLIER_TABLES[rows]?.[risk] || [];

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Plinko</h1>
        <a
          href="/casino/verify"
          className="px-2 py-1 rounded-lg bg-surface-tertiary hover:bg-surface-hover text-xs text-gray-400 transition-colors"
        >
          Provably Fair
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Game Display */}
        <div className="md:col-span-2 space-y-3">
          <div className="card overflow-hidden">
            <div className="aspect-[4/3] min-h-[350px]">
              <PlinkoCanvas
                rows={rows}
                risk={risk}
                balls={balls}
                onFrame={updateBalls}
              />
            </div>
          </div>

          {/* Last result */}
          {lastResult && (
            <div
              className={cn(
                'card text-center py-4',
                lastResult.won
                  ? 'border border-accent-green/20'
                  : 'border border-accent-red/20'
              )}
            >
              <p className="text-xs text-gray-400 mb-1">Last Drop</p>
              <p
                className={cn(
                  'text-3xl font-bold font-mono',
                  lastResult.won ? 'text-accent-green' : 'text-accent-red'
                )}
              >
                {lastResult.multiplier}x
              </p>
              <p
                className={cn(
                  'text-sm font-medium mt-1',
                  lastResult.won ? 'text-accent-green' : 'text-accent-red'
                )}
              >
                {lastResult.won
                  ? `+${lastResult.profit}`
                  : lastResult.profit}{' '}
                USDT
              </p>
            </div>
          )}

          {/* History strip */}
          {history.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                History
              </h3>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {history.map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold shrink-0',
                      h.won
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-accent-red/20 text-accent-red'
                    )}
                  >
                    {h.multiplier}x
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="card space-y-4">
            {/* Stake */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Stake (USDT)
              </label>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="input"
                step="0.01"
                min="0.01"
              />
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {['1', '5', '10', '25'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setStake(v)}
                    className="btn-secondary text-xs py-1.5"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Rows
              </label>
              <div className="flex gap-2">
                {[8, 12, 16].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRows(r)}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                      rows === r
                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                        : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Risk
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as Risk[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRisk(r)}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-all',
                      risk === r
                        ? r === 'low'
                          ? 'bg-accent-green text-white shadow-lg shadow-accent-green/20'
                          : r === 'medium'
                            ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20'
                            : 'bg-accent-red text-white shadow-lg shadow-accent-red/20'
                        : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Multiplier preview */}
            <div className="bg-surface-tertiary rounded-lg p-3">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                Multipliers ({risk})
              </p>
              <div className="flex flex-wrap gap-1">
                {multipliers.map((m, i) => {
                  const isEdge = m >= 5;
                  const isMid = m >= 1 && m < 5;
                  return (
                    <span
                      key={i}
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                        isEdge
                          ? 'bg-accent-red/20 text-accent-red'
                          : isMid
                            ? 'bg-accent-green/20 text-accent-green'
                            : 'bg-gray-500/20 text-gray-400'
                      )}
                    >
                      {m}x
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Drop / Auto-Drop */}
            <button
              onClick={handleDrop}
              disabled={isDropping}
              className={cn(
                'btn-accent w-full py-3 font-semibold text-base',
                isDropping && 'opacity-75 cursor-wait'
              )}
            >
              {isDropping ? 'Dropping...' : 'Drop Ball'}
            </button>

            <button
              onClick={() => setAutoDrop(!autoDrop)}
              className={cn(
                'w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
                autoDrop
                  ? 'bg-accent-red text-white hover:bg-accent-red/80'
                  : 'btn-secondary'
              )}
            >
              {autoDrop ? 'Stop Auto Drop' : 'Auto Drop'}
            </button>
          </div>

          {/* Stats */}
          {history.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Session Stats
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Drops</span>
                  <span className="text-gray-300 font-mono">{history.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Wins</span>
                  <span className="text-accent-green font-mono">
                    {history.filter((h) => h.won).length}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Best</span>
                  <span className="text-brand-400 font-mono font-bold">
                    {Math.max(...history.map((h) => parseFloat(h.multiplier) || 0)).toFixed(1)}x
                  </span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Net Profit</span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      history.reduce(
                        (sum, h) => sum + parseFloat(h.profit || '0'),
                        0
                      ) >= 0
                        ? 'text-accent-green'
                        : 'text-accent-red'
                    )}
                  >
                    {history
                      .reduce(
                        (sum, h) => sum + parseFloat(h.profit || '0'),
                        0
                      )
                      .toFixed(2)}{' '}
                    USDT
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
