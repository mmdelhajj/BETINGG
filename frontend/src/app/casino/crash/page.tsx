'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import Decimal from 'decimal.js';

type GameState = 'WAITING' | 'RUNNING' | 'CRASHED';

interface CrashHistoryEntry {
  crashPoint: string;
  id: string;
  hash?: string;
}

interface PlayerBet {
  username: string;
  stake: string;
  cashoutMultiplier?: string;
  profit?: string;
}

interface AutoBetConfig {
  enabled: boolean;
  rounds: number;
  roundsPlayed: number;
  autoCashout: string;
  stopOnProfit: string;
  stopOnLoss: string;
  sessionProfit: string;
}

// ---------- Crash Graph Canvas ----------
function CrashGraph({
  multiplier,
  gameState,
}: {
  multiplier: string;
  gameState: GameState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const pointsRef = useRef<{ value: number; time: number }[]>([]);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (gameState === 'RUNNING') {
      const now = Date.now();
      pointsRef.current.push({
        value: parseFloat(multiplier),
        time: now - startTimeRef.current,
      });
    } else if (gameState === 'WAITING') {
      pointsRef.current = [];
      startTimeRef.current = Date.now();
    }
  }, [multiplier, gameState]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear with dark background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1c2633';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const x = (w / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    const points = pointsRef.current;
    if (points.length < 2) {
      animationRef.current = requestAnimationFrame(draw);
      return;
    }

    const maxMult = Math.max(...points.map((p) => p.value), 2);
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Y-axis labels
    ctx.fillStyle = '#4b5563';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = 1 + ((maxMult - 1) / 4) * (4 - i);
      const y = padding.top + (plotH / 4) * i;
      ctx.fillText(`${val.toFixed(1)}x`, padding.left - 8, y + 4);
    }

    // X-axis labels (time-based)
    const maxTime = points[points.length - 1].time;
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const t = (maxTime / 4) * i;
      const x = padding.left + (plotW / 4) * i;
      ctx.fillText(`${(t / 1000).toFixed(1)}s`, x, h - 10);
    }

    // Draw smooth curve using quadratic bezier
    const isRed = gameState === 'CRASHED';
    const lineColor = isRed ? '#ef4444' : '#22c55e';

    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Shadow glow effect
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 8;

    for (let i = 0; i < points.length; i++) {
      const x = padding.left + (points[i].time / maxTime) * plotW;
      const y =
        padding.top + plotH - ((points[i].value - 1) / (maxMult - 1)) * plotH;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Quadratic curve for smoothness
        const prevX =
          padding.left + (points[i - 1].time / maxTime) * plotW;
        const prevY =
          padding.top +
          plotH -
          ((points[i - 1].value - 1) / (maxMult - 1)) * plotH;
        const cpX = (prevX + x) / 2;
        const cpY = (prevY + y) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill gradient below curve
    const lastX =
      padding.left +
      (points[points.length - 1].time / maxTime) * plotW;
    const baseY = padding.top + plotH;
    ctx.lineTo(lastX, baseY);
    ctx.lineTo(padding.left, baseY);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, baseY);
    if (isRed) {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.20)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.01)');
    } else {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.20)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0.01)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();

    // Pulsing dot at the end
    if (gameState === 'RUNNING' && points.length > 0) {
      const lastPt = points[points.length - 1];
      const dotX = padding.left + (lastPt.time / maxTime) * plotW;
      const dotY =
        padding.top + plotH - ((lastPt.value - 1) / (maxMult - 1)) * plotH;

      const pulse = 4 + Math.sin(Date.now() / 200) * 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dotX, dotY, pulse + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [gameState]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
}

// ---------- Main Page Component ----------
export default function CrashPage() {
  const [gameState, setGameState] = useState<GameState>('WAITING');
  const [multiplier, setMultiplier] = useState('1.00');
  const [crashPoint, setCrashPoint] = useState<string | null>(null);
  const [stake, setStake] = useState('1.00');
  const [autoCashout, setAutoCashout] = useState('');
  const [hasBet, setHasBet] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [cashoutMultiplier, setCashoutMultiplier] = useState<string | null>(null);
  const [history, setHistory] = useState<CrashHistoryEntry[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerBet[]>([]);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [currentHash, setCurrentHash] = useState<string | null>(null);

  // Auto-bet state
  const [autoBet, setAutoBet] = useState<AutoBetConfig>({
    enabled: false,
    rounds: 10,
    roundsPlayed: 0,
    autoCashout: '2.00',
    stopOnProfit: '',
    stopOnLoss: '',
    sessionProfit: '0.00',
  });

  const autoBetRef = useRef(autoBet);
  autoBetRef.current = autoBet;

  useEffect(() => {
    // Load history
    api
      .get('/casino/crash/history')
      .then(({ data }) => setHistory(data.data || []))
      .catch(() => {});

    const socket = getSocket();

    socket.on('crash:tick', (data: { multiplier: string; state: GameState }) => {
      setMultiplier(data.multiplier);
      setGameState(data.state);
    });

    socket.on(
      'crash:start',
      (data?: { hash?: string }) => {
        setGameState('RUNNING');
        setMultiplier('1.00');
        setCrashPoint(null);
        setHasCashedOut(false);
        setCashoutMultiplier(null);
        setCountdown(null);
        if (data?.hash) setCurrentHash(data.hash);
      }
    );

    socket.on('crash:crash', (data: { crashPoint: string; hash?: string }) => {
      setGameState('CRASHED');
      setCrashPoint(data.crashPoint);
      setHasBet(false);

      const entry: CrashHistoryEntry = {
        crashPoint: data.crashPoint,
        id: Date.now().toString(),
        hash: data.hash,
      };
      setHistory((prev) => [entry, ...prev.slice(0, 29)]);

      // Auto-bet: track session profit
      setAutoBet((prev) => {
        if (!prev.enabled) return prev;
        return { ...prev, roundsPlayed: prev.roundsPlayed + 1 };
      });
    });

    socket.on('crash:waiting', (data?: { countdown?: number }) => {
      setGameState('WAITING');
      if (data?.countdown) setCountdown(data.countdown);
    });

    socket.on('crash:players', (data: PlayerBet[]) => {
      setPlayers(data || []);
    });

    return () => {
      socket.off('crash:tick');
      socket.off('crash:start');
      socket.off('crash:crash');
      socket.off('crash:waiting');
      socket.off('crash:players');
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-bet: auto place on WAITING
  useEffect(() => {
    if (gameState !== 'WAITING') return;
    const ab = autoBetRef.current;
    if (!ab.enabled) return;

    // Check stop conditions
    if (ab.roundsPlayed >= ab.rounds) {
      setAutoBet((prev) => ({ ...prev, enabled: false }));
      return;
    }
    if (ab.stopOnProfit && new Decimal(ab.sessionProfit).gte(ab.stopOnProfit)) {
      setAutoBet((prev) => ({ ...prev, enabled: false }));
      return;
    }
    if (
      ab.stopOnLoss &&
      new Decimal(ab.sessionProfit).lte(new Decimal(ab.stopOnLoss).neg())
    ) {
      setAutoBet((prev) => ({ ...prev, enabled: false }));
      return;
    }

    // Delay to let round settle
    const timer = setTimeout(() => {
      handlePlaceBet();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const handlePlaceBet = async () => {
    try {
      const cashoutVal = activeTab === 'auto'
        ? parseFloat(autoBet.autoCashout) || undefined
        : autoCashout
          ? parseFloat(autoCashout)
          : undefined;

      await api.post('/casino/crash/bet', {
        currency: 'USDT',
        stake,
        autoCashout: cashoutVal,
      });
      setHasBet(true);
    } catch (err) {
      console.error('Failed to place bet:', err);
    }
  };

  const handleCashout = async () => {
    try {
      await api.post('/casino/crash/cashout');
      setHasCashedOut(true);
      setCashoutMultiplier(multiplier);

      // Track auto-bet profit
      if (autoBetRef.current.enabled) {
        const profit = new Decimal(stake)
          .mul(multiplier)
          .minus(stake)
          .toFixed(2);
        setAutoBet((prev) => ({
          ...prev,
          sessionProfit: new Decimal(prev.sessionProfit)
            .plus(profit)
            .toFixed(2),
        }));
      }
    } catch (err) {
      console.error('Failed to cashout:', err);
    }
  };

  const getMultiplierColor = () => {
    const m = parseFloat(multiplier);
    if (gameState === 'CRASHED') return 'text-accent-red';
    if (m >= 10) return 'text-purple-400';
    if (m >= 5) return 'text-orange-400';
    if (m >= 2) return 'text-yellow-400';
    return 'text-accent-green';
  };

  const getMultiplierScale = () => {
    const m = parseFloat(multiplier);
    if (gameState === 'CRASHED') return 'scale-110';
    if (m >= 10) return 'scale-125';
    if (m >= 5) return 'scale-115';
    return 'scale-100';
  };

  const currentProfit = hasBet
    ? new Decimal(stake)
        .mul(new Decimal(multiplier))
        .minus(new Decimal(stake))
        .toFixed(2)
    : '0.00';

  const toggleAutoBet = () => {
    setAutoBet((prev) => ({
      ...prev,
      enabled: !prev.enabled,
      roundsPlayed: prev.enabled ? 0 : prev.roundsPlayed,
      sessionProfit: prev.enabled ? '0.00' : prev.sessionProfit,
    }));
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Crash</h1>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-surface-tertiary hover:bg-surface-hover transition-colors"
            title={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundEnabled ? (
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowFairness(!showFairness)}
            className="px-2 py-1 rounded-lg bg-surface-tertiary hover:bg-surface-hover text-xs text-gray-400 transition-colors"
          >
            Provably Fair
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs text-gray-500 shrink-0">History</span>
          <div className="flex gap-1.5 overflow-x-auto max-w-sm sm:max-w-md pb-1">
            {history.slice(0, 20).map((h) => {
              const cp = parseFloat(h.crashPoint);
              return (
                <span
                  key={h.id}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-mono font-bold shrink-0 cursor-default',
                    cp >= 10
                      ? 'bg-purple-500/20 text-purple-400'
                      : cp >= 5
                        ? 'bg-orange-500/20 text-orange-400'
                        : cp >= 2
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-accent-red/20 text-accent-red'
                  )}
                  title={h.hash ? `Hash: ${h.hash}` : undefined}
                >
                  {h.crashPoint}x
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Provably Fair Info */}
      {showFairness && (
        <div className="card mb-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Provably Fair</h3>
            <button
              onClick={() => setShowFairness(false)}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {currentHash && (
              <div>
                <span className="text-gray-400">Current Hash:</span>
                <p className="font-mono text-gray-300 break-all bg-surface-tertiary rounded p-2 mt-1">
                  {currentHash}
                </p>
              </div>
            )}
            <p className="text-gray-400">
              Each round's crash point is determined before the round starts using a provably fair algorithm.
              The hash shown above commits to the result before bets are placed. After the round,
              you can verify the result.
            </p>
            <a
              href="/casino/verify"
              className="text-brand-400 hover:text-brand-300 font-medium inline-block"
            >
              Verify results &rarr;
            </a>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Game Display - takes 3 columns */}
        <div className="lg:col-span-3 space-y-4">
          {/* Main Game Area */}
          <div className="card relative aspect-[16/9] overflow-hidden min-h-[280px]">
            {/* Canvas graph */}
            <CrashGraph multiplier={multiplier} gameState={gameState} />

            {/* Overlay content */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative text-center">
                {gameState === 'WAITING' && (
                  <div className="animate-fade-in">
                    <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">
                      Next round
                    </p>
                    {countdown !== null ? (
                      <p className="text-5xl font-bold font-mono text-brand-400">
                        {countdown}s
                      </p>
                    ) : (
                      <p className="text-4xl font-bold font-mono text-gray-300">
                        Starting...
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">Place your bets now</p>
                  </div>
                )}
                {gameState === 'RUNNING' && (
                  <div
                    className={cn(
                      'transition-transform duration-300',
                      getMultiplierScale()
                    )}
                  >
                    <p
                      className={cn(
                        'text-6xl sm:text-7xl font-bold font-mono tracking-tight transition-colors duration-300',
                        getMultiplierColor()
                      )}
                    >
                      {multiplier}x
                    </p>
                    {hasBet && !hasCashedOut && (
                      <p className="text-sm text-accent-green mt-2 font-medium">
                        Current profit: +{currentProfit} USDT
                      </p>
                    )}
                    {hasCashedOut && cashoutMultiplier && (
                      <div className="mt-2 bg-accent-green/20 rounded-lg px-4 py-2 inline-block">
                        <p className="text-accent-green text-sm font-bold">
                          Cashed out at {cashoutMultiplier}x
                        </p>
                        <p className="text-accent-green/80 text-xs">
                          +
                          {new Decimal(stake)
                            .mul(cashoutMultiplier)
                            .minus(stake)
                            .toFixed(2)}{' '}
                          USDT
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {gameState === 'CRASHED' && (
                  <div className="animate-bounce-in">
                    <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">
                      Crashed at
                    </p>
                    <p className="text-6xl sm:text-7xl font-bold font-mono text-accent-red">
                      {crashPoint}x
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Players Table */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">
                Players ({players.length})
              </h3>
            </div>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-secondary">
                  <tr className="text-xs text-gray-500 border-b border-border">
                    <th className="text-left py-2 font-medium">Player</th>
                    <th className="text-right py-2 font-medium">Bet</th>
                    <th className="text-right py-2 font-medium">Cashout</th>
                    <th className="text-right py-2 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-6 text-gray-600 text-xs"
                      >
                        No active players this round
                      </td>
                    </tr>
                  ) : (
                    players.map((player, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2 text-gray-300">{player.username}</td>
                        <td className="py-2 text-right font-mono text-gray-400">
                          {player.stake} USDT
                        </td>
                        <td className="py-2 text-right font-mono">
                          {player.cashoutMultiplier ? (
                            <span className="text-accent-green">
                              {player.cashoutMultiplier}x
                            </span>
                          ) : gameState === 'RUNNING' ? (
                            <span className="text-yellow-500 animate-pulse">Playing</span>
                          ) : (
                            <span className="text-gray-600">--</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono">
                          {player.profit ? (
                            <span className="text-accent-green">+{player.profit}</span>
                          ) : (
                            <span className="text-gray-600">--</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Controls Panel - 1 column */}
        <div className="space-y-4">
          {/* Bet controls card */}
          <div className="card space-y-4">
            {/* Manual / Auto tabs */}
            <div className="flex rounded-lg bg-surface-tertiary p-1">
              <button
                onClick={() => setActiveTab('manual')}
                className={cn(
                  'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'manual'
                    ? 'bg-surface-hover text-white'
                    : 'text-gray-400 hover:text-gray-300'
                )}
              >
                Manual
              </button>
              <button
                onClick={() => setActiveTab('auto')}
                className={cn(
                  'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'auto'
                    ? 'bg-surface-hover text-white'
                    : 'text-gray-400 hover:text-gray-300'
                )}
              >
                Auto
              </button>
            </div>

            {/* Bet amount (shared) */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Bet Amount (USDT)
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
                {['1', '5', '10', '50'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setStake(v)}
                    className="btn-secondary text-xs py-1.5"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                <button
                  onClick={() => {
                    const val = new Decimal(stake || '0').div(2);
                    setStake(val.gt(0.01) ? val.toFixed(2) : '0.01');
                  }}
                  className="btn-secondary text-xs py-1.5"
                >
                  1/2
                </button>
                <button
                  onClick={() =>
                    setStake(new Decimal(stake || '0').mul(2).toFixed(2))
                  }
                  className="btn-secondary text-xs py-1.5"
                >
                  2x
                </button>
                <button
                  onClick={() => setStake('100')}
                  className="btn-secondary text-xs py-1.5"
                >
                  Max
                </button>
              </div>
            </div>

            {/* --- Manual Tab Content --- */}
            {activeTab === 'manual' && (
              <>
                {/* Auto Cashout */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Auto Cashout Multiplier
                  </label>
                  <input
                    type="number"
                    value={autoCashout}
                    onChange={(e) => setAutoCashout(e.target.value)}
                    placeholder="e.g. 2.00"
                    className="input"
                    step="0.01"
                    min="1.01"
                  />
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {['1.5', '2', '5', '10'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAutoCashout(v)}
                        className="btn-secondary text-xs py-1.5"
                      >
                        {v}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Potential profit display */}
                {autoCashout && parseFloat(autoCashout) > 1 && (
                  <div className="bg-surface-tertiary rounded-lg p-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Potential Profit</span>
                      <span className="text-accent-green font-mono font-bold">
                        +
                        {new Decimal(stake || '0')
                          .mul(new Decimal(autoCashout))
                          .minus(new Decimal(stake || '0'))
                          .toFixed(2)}{' '}
                        USDT
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* --- Auto Tab Content --- */}
            {activeTab === 'auto' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Number of Rounds
                  </label>
                  <input
                    type="number"
                    value={autoBet.rounds}
                    onChange={(e) =>
                      setAutoBet((prev) => ({
                        ...prev,
                        rounds: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="input"
                    min={1}
                    max={100}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Auto Cashout Multiplier
                  </label>
                  <input
                    type="number"
                    value={autoBet.autoCashout}
                    onChange={(e) =>
                      setAutoBet((prev) => ({
                        ...prev,
                        autoCashout: e.target.value,
                      }))
                    }
                    className="input"
                    step="0.01"
                    min="1.01"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Stop on Profit (USDT)
                  </label>
                  <input
                    type="number"
                    value={autoBet.stopOnProfit}
                    onChange={(e) =>
                      setAutoBet((prev) => ({
                        ...prev,
                        stopOnProfit: e.target.value,
                      }))
                    }
                    placeholder="No limit"
                    className="input"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Stop on Loss (USDT)
                  </label>
                  <input
                    type="number"
                    value={autoBet.stopOnLoss}
                    onChange={(e) =>
                      setAutoBet((prev) => ({
                        ...prev,
                        stopOnLoss: e.target.value,
                      }))
                    }
                    placeholder="No limit"
                    className="input"
                    step="0.01"
                    min="0"
                  />
                </div>

                {/* Auto-bet status */}
                {autoBet.enabled && (
                  <div className="bg-surface-tertiary rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Rounds</span>
                      <span className="text-gray-300 font-mono">
                        {autoBet.roundsPlayed}/{autoBet.rounds}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Session Profit</span>
                      <span
                        className={cn(
                          'font-mono font-bold',
                          parseFloat(autoBet.sessionProfit) >= 0
                            ? 'text-accent-green'
                            : 'text-accent-red'
                        )}
                      >
                        {parseFloat(autoBet.sessionProfit) >= 0 ? '+' : ''}
                        {autoBet.sessionProfit} USDT
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {activeTab === 'auto' ? (
              <button
                onClick={toggleAutoBet}
                className={cn(
                  'w-full py-3 rounded-lg font-semibold text-base transition-colors',
                  autoBet.enabled
                    ? 'bg-accent-red hover:bg-accent-red/80 text-white'
                    : 'btn-accent'
                )}
              >
                {autoBet.enabled ? 'Stop Auto Bet' : 'Start Auto Bet'}
              </button>
            ) : (
              <>
                {gameState === 'WAITING' && !hasBet && (
                  <button
                    onClick={handlePlaceBet}
                    className="btn-accent w-full py-3 font-semibold text-base"
                  >
                    Place Bet
                  </button>
                )}
                {gameState === 'WAITING' && hasBet && (
                  <div className="text-center py-3 bg-accent-green/10 rounded-lg border border-accent-green/20">
                    <p className="text-accent-green text-sm font-medium">
                      Bet placed! Waiting for round...
                    </p>
                  </div>
                )}
                {gameState === 'RUNNING' && hasBet && !hasCashedOut && (
                  <button
                    onClick={handleCashout}
                    className="btn-accent w-full py-3 font-semibold text-base animate-pulse"
                  >
                    Cash Out @ {multiplier}x
                    <span className="block text-xs font-normal mt-0.5">
                      (+{currentProfit} USDT)
                    </span>
                  </button>
                )}
                {gameState === 'RUNNING' && !hasBet && (
                  <div className="text-center py-3 bg-surface-tertiary rounded-lg">
                    <p className="text-gray-500 text-sm">Round in progress</p>
                  </div>
                )}
                {gameState === 'CRASHED' && (
                  <div className="text-center py-3 bg-accent-red/10 rounded-lg border border-accent-red/20">
                    <p className="text-accent-red text-sm font-medium">
                      Crashed at {crashPoint}x
                    </p>
                  </div>
                )}
                {hasCashedOut && cashoutMultiplier && (
                  <div className="text-center py-3 bg-accent-green/10 rounded-lg border border-accent-green/20">
                    <p className="text-accent-green text-sm font-bold">
                      Won{' '}
                      {new Decimal(stake).mul(cashoutMultiplier).toFixed(2)}{' '}
                      USDT
                    </p>
                    <p className="text-accent-green/80 text-xs mt-0.5">
                      Profit: +
                      {new Decimal(stake)
                        .mul(cashoutMultiplier)
                        .minus(stake)
                        .toFixed(2)}{' '}
                      USDT
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Round Info */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Current Round
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Status</span>
                <span
                  className={cn(
                    'font-medium',
                    gameState === 'RUNNING'
                      ? 'text-accent-green'
                      : gameState === 'CRASHED'
                        ? 'text-accent-red'
                        : 'text-accent-yellow'
                  )}
                >
                  {gameState}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Multiplier</span>
                <span className={cn('font-mono font-bold', getMultiplierColor())}>
                  {gameState === 'CRASHED' ? `${crashPoint}x` : `${multiplier}x`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Players</span>
                <span className="text-gray-300">{players.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full History */}
      <div className="card mt-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Recent Crashes
        </h3>
        <div className="flex flex-wrap gap-2">
          {history.map((h) => {
            const cp = parseFloat(h.crashPoint);
            return (
              <span
                key={h.id}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-default',
                  cp >= 10
                    ? 'bg-purple-500/20 text-purple-400'
                    : cp >= 5
                      ? 'bg-orange-500/20 text-orange-400'
                      : cp >= 2
                        ? 'bg-accent-green/20 text-accent-green'
                        : 'bg-accent-red/20 text-accent-red'
                )}
                title={h.hash ? `Hash: ${h.hash}` : undefined}
              >
                {h.crashPoint}x
              </span>
            );
          })}
          {history.length === 0 && (
            <p className="text-gray-600 text-xs">No history available yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
