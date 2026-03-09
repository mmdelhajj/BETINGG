'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Minus,
  Plus,
  Shield,
  History,
  RotateCcw,
  ChevronDown,
  Play,
  Square,
  Plane,
  Infinity as InfinityIcon,
  Volume2,
  VolumeX,
  TrendingUp,
  Users,
  Zap,
  Home,
  Info,
  Coins,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AviatorApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    flyAwayAt: number;
    cashedOutAt: number | null;
    isWin: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface BetSlot {
  id: 1 | 2;
  amount: string;
  autoCashout: string;
  autoCashoutEnabled: boolean;
  isActive: boolean;
  isCashedOut: boolean;
  currentProfit: number;
  result: AviatorApiResponse | null;
}

interface FlightHistoryEntry {
  id: string;
  multiplier: number;
  timestamp: Date;
}

interface GameRound {
  id: string;
  flyAwayAt: number;
  cashedOutAt: number | null;
  won: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  slot: 1 | 2;
  timestamp: Date;
  fairness?: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

type GamePhase = 'waiting' | 'flying' | 'crashed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];
const QUICK_AMOUNTS = [0.001, 0.01, 0.1, 1, 10];
const AUTO_CASHOUT_PRESETS = ['1.50', '2.00', '3.00', '5.00', '10.00', '25.00'];

// ---------------------------------------------------------------------------
// SVG Flight Path Component
// ---------------------------------------------------------------------------

function FlightCanvas({
  multiplier,
  phase,
  crashPoint,
}: {
  multiplier: number;
  phase: GamePhase;
  crashPoint: number | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 300 });

  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current?.parentElement) {
        const parent = svgRef.current.parentElement;
        setDimensions({
          width: parent.clientWidth,
          height: parent.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { width, height } = dimensions;
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Build the flight curve path
  const pathPoints = useMemo(() => {
    if (phase === 'waiting') return '';

    const maxMult = Math.max(multiplier, 2);
    const steps = 100;
    const points: string[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const currentMult = 1 + (multiplier - 1) * t;
      const x = padding + (t * graphWidth);
      // Logarithmic curve for visual appeal
      const normalizedY = Math.log(currentMult) / Math.log(maxMult + 0.5);
      const y = height - padding - (normalizedY * graphHeight);
      points.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
    }

    return points.join(' ');
  }, [multiplier, phase, graphWidth, graphHeight, width, height, padding]);

  // Plane position
  const planePos = useMemo(() => {
    if (phase === 'waiting') return { x: padding, y: height - padding };
    const maxMult = Math.max(multiplier, 2);
    const normalizedY = Math.log(multiplier) / Math.log(maxMult + 0.5);
    return {
      x: padding + graphWidth,
      y: height - padding - (normalizedY * graphHeight),
    };
  }, [multiplier, phase, graphWidth, graphHeight, width, height, padding]);

  // Grid lines
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; label: string; isHorizontal: boolean }[] = [];
    const maxMult = Math.max(multiplier, 2);

    const multSteps = [1, 1.5, 2, 3, 5, 10, 25, 50, 100].filter(m => m <= maxMult + 1);
    multSteps.forEach(m => {
      const normalizedY = Math.log(m) / Math.log(maxMult + 0.5);
      const y = height - padding - (normalizedY * graphHeight);
      if (y > padding && y < height - padding) {
        lines.push({
          x1: padding,
          y1: y,
          x2: width - padding,
          y2: y,
          label: `${m.toFixed(1)}x`,
          isHorizontal: true,
        });
      }
    });

    return lines;
  }, [multiplier, graphWidth, graphHeight, width, height, padding]);

  // Gradient fill area under curve
  const fillPath = useMemo(() => {
    if (!pathPoints) return '';
    const lastX = padding + graphWidth;
    const bottomY = height - padding;
    return `${pathPoints} L${lastX},${bottomY} L${padding},${bottomY} Z`;
  }, [pathPoints, graphWidth, height, padding]);

  const isCrashed = phase === 'crashed';

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isCrashed ? '#EF4444' : '#C8FF00'} stopOpacity="0.25" />
          <stop offset="100%" stopColor={isCrashed ? '#EF4444' : '#C8FF00'} stopOpacity="0.02" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={isCrashed ? '#EF4444' : '#C8FF00'} stopOpacity="0.4" />
          <stop offset="100%" stopColor={isCrashed ? '#EF4444' : '#C8FF00'} />
        </linearGradient>
      </defs>

      {/* Grid */}
      {gridLines.map((line, i) => (
        <g key={i}>
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#1C2128"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={line.x1 - 8}
            y={line.y1 + 4}
            fill="#484F58"
            fontSize="10"
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            {line.label}
          </text>
        </g>
      ))}

      {/* Axis lines */}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#21262D" strokeWidth="1" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#21262D" strokeWidth="1" />

      {/* Fill area */}
      {fillPath && (
        <path d={fillPath} fill="url(#curveGradient)" />
      )}

      {/* Curve line */}
      {pathPoints && (
        <path
          d={pathPoints}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#glow)"
        />
      )}

      {/* Plane icon */}
      {phase !== 'waiting' && (
        <g transform={`translate(${planePos.x - 16}, ${planePos.y - 16})`}>
          {!isCrashed ? (
            <>
              {[...Array(5)].map((_, i) => (
                <circle
                  key={i}
                  cx={-i * 6 - 4}
                  cy={i * 3 + 16}
                  r={3 - i * 0.5}
                  fill="#C8FF00"
                  opacity={0.4 - i * 0.07}
                >
                  <animate
                    attributeName="opacity"
                    values={`${0.4 - i * 0.07};${0.1};${0.4 - i * 0.07}`}
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
              <g transform="rotate(-30, 16, 16)">
                <text fontSize="28" x="2" y="26">&#x2708;&#xFE0F;</text>
              </g>
            </>
          ) : (
            <g>
              <text fontSize="28" x="2" y="26">&#x1F4A5;</text>
            </g>
          )}
        </g>
      )}

      {/* Waiting state */}
      {phase === 'waiting' && (
        <text
          x={width / 2}
          y={height / 2}
          fill="#8B949E"
          fontSize="16"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
        >
          Waiting for takeoff...
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Multiplier Badge
// ---------------------------------------------------------------------------

function MultiplierBadge({ value }: { value: number }) {
  const isHigh = value >= 2;
  const isMega = value >= 10;
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex-shrink-0',
        isMega
          ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
          : isHigh
          ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
          : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
      )}
    >
      {value.toFixed(2)}x
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Bet Slot Panel (Cloudbet mobile style -- compact)
// ---------------------------------------------------------------------------

function BetSlotPanel({
  slot,
  onUpdate,
  onBet,
  onCashout,
  currency,
  isAuthenticated,
  gamePhase,
  currentMultiplier,
}: {
  slot: BetSlot;
  onUpdate: (updates: Partial<BetSlot>) => void;
  onBet: () => void;
  onCashout: () => void;
  currency: string;
  isAuthenticated: boolean;
  gamePhase: GamePhase;
  currentMultiplier: number;
}) {
  const amount = parseFloat(slot.amount) || 0;
  const cashoutMult = parseFloat(slot.autoCashout) || 2;

  const potentialProfit = slot.isActive
    ? amount * currentMultiplier - amount
    : amount * cashoutMult - amount;

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-2.5 space-y-2">
      {/* Slot header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
          Bet {slot.id}
        </span>
        {slot.isActive && !slot.isCashedOut && (
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-[10px] font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full"
          >
            LIVE
          </motion.span>
        )}
        {slot.isCashedOut && (
          <span className="text-[10px] font-mono font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
            WON
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-10 flex items-center px-2">
        <Coins className="w-3.5 h-3.5 text-[#C8FF00] mr-1.5 flex-shrink-0" />
        <input
          type="number"
          value={slot.amount}
          onChange={(e) => onUpdate({ amount: e.target.value })}
          className="flex-1 bg-transparent text-white font-mono text-center text-sm focus:outline-none disabled:opacity-50"
          disabled={slot.isActive}
          step="0.001"
          min="0.001"
        />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => {
              const val = Math.max(0.001, amount / 2);
              onUpdate({ amount: val.toFixed(8) });
            }}
            className="bg-[#2D333B] rounded w-6 h-6 flex items-center justify-center text-white hover:bg-[#3D444D] disabled:opacity-40 transition-colors text-[10px] font-bold"
            disabled={slot.isActive}
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              const val = amount * 2;
              onUpdate({ amount: val.toFixed(8) });
            }}
            className="bg-[#2D333B] rounded w-6 h-6 flex items-center justify-center text-white hover:bg-[#3D444D] disabled:opacity-40 transition-colors text-[10px] font-bold"
            disabled={slot.isActive}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Auto cashout */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onUpdate({ autoCashoutEnabled: !slot.autoCashoutEnabled })}
          className={cn(
            'w-7 h-3.5 rounded-full relative transition-colors flex-shrink-0',
            slot.autoCashoutEnabled ? 'bg-[#C8FF00]' : 'bg-[#30363D]'
          )}
          disabled={slot.isActive}
        >
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full absolute top-0.5 transition-all',
              slot.autoCashoutEnabled ? 'left-[14px] bg-black' : 'left-0.5 bg-white'
            )}
          />
        </button>
        <span className="text-[9px] text-[#8B949E]">Auto</span>
        <input
          type="number"
          value={slot.autoCashout}
          onChange={(e) => onUpdate({ autoCashout: e.target.value })}
          className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-md px-1.5 py-1 text-[10px] font-mono text-white text-center focus:outline-none focus:border-[#C8FF00]/40 disabled:opacity-50"
          disabled={slot.isActive || !slot.autoCashoutEnabled}
          step="0.1"
          min="1.01"
        />
        <span className="text-[9px] text-gray-600">x</span>
      </div>

      {/* Potential profit */}
      <div className="flex justify-between text-[10px]">
        <span className="text-[#8B949E]">
          {slot.isActive ? 'Profit' : 'Est. profit'}
        </span>
        <span className={cn(
          'font-mono font-bold',
          slot.isActive ? 'text-[#10B981]' : 'text-gray-400'
        )}>
          +{(slot.isActive ? (amount * currentMultiplier - amount) : potentialProfit).toFixed(4)}
        </span>
      </div>

      {/* Action button */}
      {!isAuthenticated ? (
        <Link href="/login">
          <button className="bg-[#C8FF00] text-black font-bold py-2.5 rounded-xl w-full text-sm transition-colors hover:bg-[#d4ff33]">
            Login
          </button>
        </Link>
      ) : slot.isActive && !slot.isCashedOut ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCashout}
          className="bg-[#3D3D20] text-[#C8FF00] font-bold py-2.5 rounded-xl w-full text-sm transition-colors hover:bg-[#4D4D30]"
        >
          <span className="font-mono">
            Cash Out @ {currentMultiplier.toFixed(2)}x
          </span>
        </motion.button>
      ) : (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBet}
          disabled={gamePhase === 'flying'}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-bold transition-colors',
            gamePhase === 'flying'
              ? 'bg-[#2D333B] text-gray-500 cursor-not-allowed'
              : 'bg-[#C8FF00] text-black hover:bg-[#d4ff33]'
          )}
        >
          {gamePhase === 'flying' ? 'Wait...' : 'Place Bet'}
        </motion.button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AviatorGamePage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Bet slots
  const [betSlots, setBetSlots] = useState<BetSlot[]>([
    {
      id: 1,
      amount: '0.001',
      autoCashout: '2.00',
      autoCashoutEnabled: false,
      isActive: false,
      isCashedOut: false,
      currentProfit: 0,
      result: null,
    },
    {
      id: 2,
      amount: '0.001',
      autoCashout: '3.00',
      autoCashoutEnabled: false,
      isActive: false,
      isCashedOut: false,
      currentProfit: 0,
      result: null,
    },
  ]);

  // History
  const [flightHistory, setFlightHistory] = useState<FlightHistoryEntry[]>([
    { id: '1', multiplier: 1.23, timestamp: new Date(Date.now() - 60000) },
    { id: '2', multiplier: 3.45, timestamp: new Date(Date.now() - 120000) },
    { id: '3', multiplier: 1.01, timestamp: new Date(Date.now() - 180000) },
    { id: '4', multiplier: 15.78, timestamp: new Date(Date.now() - 240000) },
    { id: '5', multiplier: 2.10, timestamp: new Date(Date.now() - 300000) },
    { id: '6', multiplier: 1.55, timestamp: new Date(Date.now() - 360000) },
    { id: '7', multiplier: 4.92, timestamp: new Date(Date.now() - 420000) },
    { id: '8', multiplier: 1.89, timestamp: new Date(Date.now() - 480000) },
  ]);
  const [gameHistory, setGameHistory] = useState<GameRound[]>([]);

  // Refs
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const targetMultiplierRef = useRef<number>(1);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);

  // Close currency dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // IntersectionObserver to pause animation when not visible
  useEffect(() => {
    if (!gameContainerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(gameContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Get balance
  const balance = useMemo(() => {
    if (!user?.balances) return 0;
    const b = user.balances.find((bal) => bal.currency === currency);
    return b?.available ?? 0;
  }, [user, currency]);

  // Update a bet slot
  const updateSlot = useCallback((slotId: 1 | 2, updates: Partial<BetSlot>) => {
    setBetSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s))
    );
  }, []);

  // Simulate flight animation
  const startFlight = useCallback((targetMult: number) => {
    setGamePhase('flying');
    setCurrentMultiplier(1.0);
    targetMultiplierRef.current = targetMult;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      // Skip frame when not visible, but keep the loop alive
      if (!isVisibleRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = (now - startTimeRef.current) / 1000;
      const mult = Math.pow(Math.E, 0.06 * elapsed);

      if (mult >= targetMultiplierRef.current) {
        setCurrentMultiplier(targetMultiplierRef.current);
        setGamePhase('crashed');
        setCrashPoint(targetMultiplierRef.current);

        setFlightHistory((prev) => [
          { id: `flight-${Date.now()}`, multiplier: targetMultiplierRef.current, timestamp: new Date() },
          ...prev.slice(0, 19),
        ]);

        setBetSlots((prev) =>
          prev.map((s) => {
            if (s.isActive && !s.isCashedOut) {
              return { ...s, isActive: false, isCashedOut: false };
            }
            return s;
          })
        );

        setTimeout(() => {
          setGamePhase('waiting');
          setCurrentMultiplier(1.0);
          setCrashPoint(null);
          setBetSlots((prev) =>
            prev.map((s) => ({ ...s, isActive: false, isCashedOut: false, result: null }))
          );
        }, 3000);

        return;
      }

      setCurrentMultiplier(mult);

      setBetSlots((prev) =>
        prev.map((s) => {
          if (s.isActive && !s.isCashedOut && s.autoCashoutEnabled) {
            const targetCashout = parseFloat(s.autoCashout) || 999;
            if (mult >= targetCashout) {
              return { ...s, isCashedOut: true, currentProfit: parseFloat(s.amount) * targetCashout - parseFloat(s.amount) };
            }
          }
          return s;
        })
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup animation
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Place bet
  const placeBet = useCallback(async (slotId: 1 | 2) => {
    const slot = betSlots.find((s) => s.id === slotId);
    if (!slot) return;

    const amount = parseFloat(slot.amount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Invalid bet amount');
      return;
    }
    if (amount > balance) {
      setErrorMessage('Insufficient balance');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await post<AviatorApiResponse>('/casino/games/aviator/play', {
        amount,
        currency,
        options: {
          autoCashout: slot.autoCashoutEnabled ? parseFloat(slot.autoCashout) : null,
          slot: slotId,
        },
      });

      useAuthStore.getState().updateBalance(currency, response.newBalance, 0);

      const betAmt = response.betAmount ?? amount;
      const mult = response.multiplier ?? response.result?.flyAwayAt ?? 0;
      const payoutAmt = response.payout ?? betAmt * mult;
      const profitAmt = response.profit ?? (payoutAmt - betAmt);

      updateSlot(slotId, {
        isActive: true,
        isCashedOut: false,
        result: response,
      });

      if (gamePhase === 'waiting') {
        startFlight(response.result.flyAwayAt);
      }

      setGameHistory((prev) => [
        {
          id: response.roundId,
          flyAwayAt: response.result.flyAwayAt,
          cashedOutAt: response.result.cashedOutAt,
          won: response.result.isWin,
          betAmount: betAmt,
          payout: payoutAmt,
          profit: profitAmt,
          multiplier: mult,
          slot: slotId,
          timestamp: new Date(),
          fairness: response.fairness,
        },
        ...prev.slice(0, 49),
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to place bet');
    } finally {
      setIsLoading(false);
    }
  }, [betSlots, balance, currency, gamePhase, startFlight, updateSlot]);

  // Cash out
  const cashOut = useCallback(async (slotId: 1 | 2) => {
    const slot = betSlots.find((s) => s.id === slotId);
    if (!slot || !slot.isActive || slot.isCashedOut) return;

    try {
      const response = await post<AviatorApiResponse>('/casino/games/aviator/play', {
        amount: parseFloat(slot.amount),
        currency,
        options: {
          action: 'cashout',
          roundId: slot.result?.roundId,
          slot: slotId,
          multiplier: currentMultiplier,
        },
      });

      useAuthStore.getState().updateBalance(currency, response.newBalance, 0);

      const cashBetAmt = parseFloat(slot.amount);
      const cashPayoutAmt = response.payout ?? cashBetAmt * currentMultiplier;
      const cashProfitAmt = response.profit ?? (cashPayoutAmt - cashBetAmt);

      updateSlot(slotId, {
        isCashedOut: true,
        currentProfit: cashProfitAmt,
      });

      setGameHistory((prev) =>
        prev.map((g) =>
          g.id === response.roundId && g.slot === slotId
            ? { ...g, cashedOutAt: currentMultiplier, won: true, payout: cashPayoutAmt, profit: cashProfitAmt, multiplier: currentMultiplier }
            : g
        )
      );
    } catch (err: any) {
      updateSlot(slotId, {
        isCashedOut: true,
        currentProfit: parseFloat(slot.amount) * currentMultiplier - parseFloat(slot.amount),
      });
    }
  }, [betSlots, currentMultiplier, currency, updateSlot]);

  // Stats
  const stats = useMemo(() => {
    const totalBets = gameHistory.length;
    const wins = gameHistory.filter((g) => g.won).length;
    const totalProfit = gameHistory.reduce((acc, g) => acc + (g.profit ?? 0), 0);
    return { totalBets, wins, totalProfit };
  }, [gameHistory]);

  return (
    <div ref={gameContainerRef} className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* CRYPTOBET Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-sm font-bold tracking-widest text-white/80">CRYPTOBET</span>
      </div>

      {/* History bubbles -- edge-to-edge horizontal scroll */}
      <div className="bg-[#0D1117] border-b border-[#30363D] px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <span className="text-[9px] text-[#8B949E] shrink-0 uppercase tracking-wider mr-1">History</span>
          {flightHistory.map((entry) => (
            <MultiplierBadge key={entry.id} value={entry.multiplier} />
          ))}
        </div>
      </div>

      {/* Flight display -- edge-to-edge */}
      <div className="bg-[#161B22] border-b border-[#30363D] overflow-hidden">
        <div className="relative h-[200px] sm:h-[280px]">
          <FlightCanvas
            multiplier={currentMultiplier}
            phase={gamePhase}
            crashPoint={crashPoint}
          />

          {/* Multiplier overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AnimatePresence mode="wait">
              {gamePhase === 'waiting' && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center"
                >
                  <div className="text-[#8B949E] text-xs mb-1">Next round starting...</div>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-4xl sm:text-5xl font-mono font-bold text-[#8B949E]"
                  >
                    1.00x
                  </motion.div>
                </motion.div>
              )}
              {gamePhase === 'flying' && (
                <motion.div
                  key="flying"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                >
                  <motion.div
                    key={Math.floor(currentMultiplier * 10)}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'text-4xl sm:text-6xl font-mono font-black',
                      currentMultiplier >= 10
                        ? 'text-[#F59E0B]'
                        : currentMultiplier >= 2
                        ? 'text-[#10B981]'
                        : 'text-[#C8FF00]'
                    )}
                  >
                    {currentMultiplier.toFixed(2)}x
                  </motion.div>
                </motion.div>
              )}
              {gamePhase === 'crashed' && (
                <motion.div
                  key="crashed"
                  initial={{ opacity: 0, scale: 2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                >
                  <div className="text-[#EF4444] text-xs font-bold mb-1 uppercase tracking-wider">
                    Flew away!
                  </div>
                  <motion.div
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-4xl sm:text-6xl font-mono font-black text-[#EF4444]"
                  >
                    {crashPoint?.toFixed(2)}x
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Controls -- px-4 */}
      <div className="px-4 py-4 space-y-3">
        {/* Error */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs flex items-center justify-between"
            >
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-[#EF4444]/70 hover:text-[#EF4444]">
                &times;
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two bet slots side-by-side */}
        <div className="grid grid-cols-2 gap-2">
          <BetSlotPanel
            slot={betSlots[0]}
            onUpdate={(updates) => updateSlot(1, updates)}
            onBet={() => placeBet(1)}
            onCashout={() => cashOut(1)}
            currency={currency}
            isAuthenticated={isAuthenticated}
            gamePhase={gamePhase}
            currentMultiplier={currentMultiplier}
          />
          <BetSlotPanel
            slot={betSlots[1]}
            onUpdate={(updates) => updateSlot(2, updates)}
            onBet={() => placeBet(2)}
            onCashout={() => cashOut(2)}
            currency={currency}
            isAuthenticated={isAuthenticated}
            gamePhase={gamePhase}
            currentMultiplier={currentMultiplier}
          />
        </div>

        {/* Session Stats (compact) */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-2.5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-mono font-bold text-white">{stats.totalBets}</div>
              <div className="text-[9px] text-[#8B949E]">Bets</div>
            </div>
            <div>
              <div className="text-sm font-mono font-bold text-[#10B981]">{stats.wins}</div>
              <div className="text-[9px] text-[#8B949E]">Wins</div>
            </div>
            <div>
              <div className={cn(
                'text-sm font-mono font-bold',
                stats.totalProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
              )}>
                {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(2)}
              </div>
              <div className="text-[9px] text-[#8B949E]">Profit</div>
            </div>
          </div>
        </div>

        {/* My Bets History */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
                <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-[#C8FF00]" />
                  My Bets
                </h3>
                {gameHistory.length === 0 ? (
                  <p className="text-[10px] text-gray-600 text-center py-4">No bets yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {gameHistory.map((round) => (
                      <div
                        key={`${round.id}-${round.slot}`}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0D1117] border border-[#21262D]"
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            round.won ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                          )} />
                          <div>
                            <span className="text-[10px] text-[#8B949E]">Slot {round.slot}</span>
                            <div className="text-[9px] font-mono text-gray-600">
                              Flew at {(round.flyAwayAt ?? 0).toFixed(2)}x
                              {round.cashedOutAt != null && ` | Out at ${(round.cashedOutAt ?? 0).toFixed(2)}x`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn(
                            'text-[10px] font-mono font-bold',
                            round.won ? 'text-[#10B981]' : 'text-[#EF4444]'
                          )}>
                            {round.won ? '+' : ''}{(round.profit ?? 0).toFixed(4)}
                          </div>
                        </div>
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
          {showFairness && gameHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
                <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  Provably Fair
                </h3>
                {gameHistory[0]?.fairness && (
                  <div className="space-y-2">
                    <div>
                      <span className="text-[9px] text-[#8B949E] uppercase tracking-wider">Server Seed Hash</span>
                      <p className="text-[10px] font-mono text-gray-400 break-all bg-[#0D1117] rounded px-2 py-1 mt-0.5">
                        {gameHistory[0].fairness.serverSeedHash}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#8B949E] uppercase tracking-wider">Client Seed</span>
                      <p className="text-[10px] font-mono text-gray-400 break-all bg-[#0D1117] rounded px-2 py-1 mt-0.5">
                        {gameHistory[0].fairness.clientSeed}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#8B949E] uppercase tracking-wider">Nonce</span>
                      <p className="text-[10px] font-mono text-gray-400 bg-[#0D1117] rounded px-2 py-1 mt-0.5">
                        {gameHistory[0].fairness.nonce}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Home className="w-4 h-4 text-[#8B949E] hover:text-white transition-colors" />
          </Link>
          <button onClick={() => setShowHistory(!showHistory)}>
            <Info className={cn('w-4 h-4 transition-colors', showHistory ? 'text-[#C8FF00]' : 'text-[#8B949E] hover:text-white')} />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#8B949E] hover:text-white transition-colors" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#8B949E] hover:text-white transition-colors" />
            )}
          </button>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-mono text-white font-bold">
            {formatCurrency(balance, currency)}
          </span>
          <span className="text-[9px] text-[#8B949E] ml-1">{currency}</span>
        </div>
        <button
          onClick={() => setShowFairness(!showFairness)}
          className={cn(
            'px-2 py-1 rounded-md text-[9px] font-bold transition-colors',
            showFairness
              ? 'bg-purple-500/30 text-purple-300'
              : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30',
          )}
        >
          Provably Fair Game
        </button>
      </div>
    </div>
  );
}
