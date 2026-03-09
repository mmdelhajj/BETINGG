'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  History,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronDown,
  Zap,
  Infinity as InfinityIcon,
  Home,
  Info,
  Minus,
  Plus,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Risk = 'low' | 'medium' | 'high';
type Segments = 10 | 20 | 30 | 50;

interface SegmentDef {
  multiplier: number;
  color: string;
  glowColor: string;
  label: string;
}

interface WheelResult {
  id: string;
  segmentIndex: number;
  multiplier: number;
  color: string;
  isWin: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  timestamp: Date;
}

interface WheelApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    segmentIndex: number;
    multiplier: number;
    color: string;
    isWin: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

// ---------------------------------------------------------------------------
// Segment Definitions
// ---------------------------------------------------------------------------

const SEGMENT_TYPES: Record<string, SegmentDef> = {
  '1':   { multiplier: 1,   color: '#4B5563', glowColor: 'rgba(75,85,99,0.6)',   label: '1x'  },
  '2':   { multiplier: 2,   color: '#3B82F6', glowColor: 'rgba(59,130,246,0.6)', label: '2x'  },
  '3':   { multiplier: 3,   color: '#10B981', glowColor: 'rgba(16,185,129,0.6)', label: '3x'  },
  '5':   { multiplier: 5,   color: '#8B5CF6', glowColor: 'rgba(139,92,246,0.6)', label: '5x'  },
  '10':  { multiplier: 10,  color: '#F59E0B', glowColor: 'rgba(245,158,11,0.6)', label: '10x' },
  '50':  { multiplier: 50,  color: '#EF4444', glowColor: 'rgba(239,68,68,0.6)',  label: '50x' },
};

function getSegmentDistribution(risk: Risk, segments: Segments): number[] {
  const distributions: Record<Risk, Record<Segments, number[]>> = {
    low: {
      10: [1, 2, 1, 2, 1, 3, 1, 2, 1, 2],
      20: [1, 2, 1, 2, 1, 3, 1, 2, 1, 2, 1, 2, 1, 3, 1, 2, 1, 5, 1, 2],
      30: [1, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2, 1, 2, 1, 3, 1, 2, 1, 1, 2, 1, 5, 1, 2, 1, 1, 2, 1, 2],
      50: [1, 2, 1, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2, 1, 5, 1, 2, 1, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 10],
    },
    medium: {
      10: [1, 2, 1, 5, 1, 3, 1, 10, 2, 3],
      20: [1, 2, 1, 3, 1, 5, 1, 2, 1, 10, 1, 2, 1, 3, 1, 5, 1, 2, 3, 50],
      30: [1, 2, 1, 3, 1, 2, 5, 1, 2, 1, 3, 1, 10, 1, 2, 1, 3, 1, 2, 5, 1, 2, 1, 3, 1, 50, 1, 2, 1, 10],
      50: [1, 2, 1, 1, 3, 1, 2, 1, 5, 1, 1, 2, 1, 3, 1, 1, 2, 10, 1, 1, 3, 1, 2, 1, 5, 1, 1, 2, 1, 3, 1, 1, 2, 1, 50, 1, 2, 1, 3, 1, 1, 2, 5, 1, 1, 3, 1, 2, 1, 10],
    },
    high: {
      10: [1, 1, 1, 1, 50, 1, 1, 1, 1, 10],
      20: [1, 1, 2, 1, 1, 1, 50, 1, 1, 1, 1, 1, 10, 1, 1, 1, 1, 50, 1, 5],
      30: [1, 1, 1, 2, 1, 1, 1, 50, 1, 1, 1, 1, 1, 10, 1, 1, 1, 1, 1, 50, 1, 1, 1, 2, 1, 1, 1, 1, 5, 1],
      50: [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 50, 1, 1, 1, 1, 1, 1, 10, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 50, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 10, 1, 1, 1, 1, 1, 2, 1, 50],
    },
  };
  return distributions[risk][segments];
}

function countSegments(dist: number[]): { multiplier: number; count: number; def: SegmentDef }[] {
  const counts: Record<number, number> = {};
  for (const m of dist) {
    counts[m] = (counts[m] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([k, v]) => ({
      multiplier: parseInt(k),
      count: v,
      def: SEGMENT_TYPES[k],
    }))
    .sort((a, b) => a.multiplier - b.multiplier);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ---------------------------------------------------------------------------
// SVG Wheel Component
// ---------------------------------------------------------------------------

interface WheelSVGProps {
  segments: number[];
  size: number;
  highlightIndex: number | null;
  isGlowing: boolean;
}

function WheelSVG({ segments, size, highlightIndex, isGlowing }: WheelSVGProps) {
  const center = size / 2;
  const outerRadius = size / 2 - 4;
  const innerRadius = outerRadius * 0.18;
  const textRadius = outerRadius * 0.65;
  const segCount = segments.length;
  const anglePerSeg = (2 * Math.PI) / segCount;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <defs>
        {Object.entries(SEGMENT_TYPES).map(([key, def]) => (
          <radialGradient key={`grad-${key}`} id={`seg-grad-${key}`} cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
          </radialGradient>
        ))}
        <filter id="wheel-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="rgba(0,0,0,0.5)" />
        </filter>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3A3F47" />
          <stop offset="50%" stopColor="#2A2F37" />
          <stop offset="100%" stopColor="#1A1F27" />
        </linearGradient>
        <radialGradient id="hub-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#2D3340" />
          <stop offset="100%" stopColor="#161B22" />
        </radialGradient>
        <filter id="segment-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={center} cy={center} r={outerRadius + 3} fill="url(#ring-grad)" filter="url(#wheel-shadow)" />
      <circle cx={center} cy={center} r={outerRadius + 1} fill="none" stroke="#484F58" strokeWidth="1" />

      {segments.map((mult, i) => {
        const def = SEGMENT_TYPES[String(mult)];
        const startAngle = i * anglePerSeg - Math.PI / 2;
        const endAngle = startAngle + anglePerSeg;

        const x1 = center + outerRadius * Math.cos(startAngle);
        const y1 = center + outerRadius * Math.sin(startAngle);
        const x2 = center + outerRadius * Math.cos(endAngle);
        const y2 = center + outerRadius * Math.sin(endAngle);
        const ix1 = center + innerRadius * Math.cos(startAngle);
        const iy1 = center + innerRadius * Math.sin(startAngle);
        const ix2 = center + innerRadius * Math.cos(endAngle);
        const iy2 = center + innerRadius * Math.sin(endAngle);

        const largeArc = anglePerSeg > Math.PI ? 1 : 0;

        const pathD = [
          `M ${ix1} ${iy1}`,
          `L ${x1} ${y1}`,
          `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
          `L ${ix2} ${iy2}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
          'Z',
        ].join(' ');

        const midAngle = startAngle + anglePerSeg / 2;
        const tx = center + textRadius * Math.cos(midAngle);
        const ty = center + textRadius * Math.sin(midAngle);
        const textRotation = (midAngle * 180) / Math.PI + 90;

        const isHighlighted = highlightIndex === i && isGlowing;
        const segColor = def?.color || '#4B5563';

        return (
          <g key={i}>
            <path
              d={pathD}
              fill={segColor}
              stroke="#0D1117"
              strokeWidth="1.5"
              opacity={isHighlighted ? 1 : 0.85}
              filter={isHighlighted ? 'url(#segment-glow)' : undefined}
            />
            <path d={pathD} fill={`url(#seg-grad-${mult})`} stroke="none" />
            <line x1={ix1} y1={iy1} x2={x1} y2={y1} stroke="#0D1117" strokeWidth="1" opacity="0.5" />
            {segCount <= 30 && (
              <text
                x={tx} y={ty}
                fill="white"
                fontSize={segCount <= 10 ? 16 : segCount <= 20 ? 13 : 10}
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
              >
                {def?.label || `${mult}x`}
              </text>
            )}
          </g>
        );
      })}

      <circle cx={center} cy={center} r={innerRadius + 2} fill="none" stroke="#30363D" strokeWidth="1" />
      <circle cx={center} cy={center} r={outerRadius - 1} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
      <circle cx={center} cy={center} r={innerRadius} fill="url(#hub-grad)" stroke="#30363D" strokeWidth="2" />
      <circle cx={center} cy={center - innerRadius * 0.15} r={innerRadius * 0.6} fill="rgba(255,255,255,0.04)" />

      {segments.map((_, i) => {
        const angle = i * anglePerSeg - Math.PI / 2;
        const ox = center + (outerRadius - 3) * Math.cos(angle);
        const oy = center + (outerRadius - 3) * Math.sin(angle);
        const ex = center + outerRadius * Math.cos(angle);
        const ey = center + outerRadius * Math.sin(angle);
        return (
          <line key={`tick-${i}`} x1={ox} y1={oy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Lime Pointer Arrow
// ---------------------------------------------------------------------------

function WheelPointer() {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
      <svg width="36" height="44" viewBox="0 0 36 44">
        <defs>
          <linearGradient id="pointer-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C8FF00" />
            <stop offset="100%" stopColor="#A0CC00" />
          </linearGradient>
          <filter id="pointer-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(200,255,0,0.5)" />
          </filter>
        </defs>
        <path
          d="M18 44 L4 8 Q2 2 8 2 L28 2 Q34 2 32 8 Z"
          fill="url(#pointer-grad)"
          stroke="#7AA000"
          strokeWidth="1.5"
          filter="url(#pointer-shadow)"
        />
        <path
          d="M18 38 L8 10 Q7 6 10 6 L26 6 Q29 6 28 10 Z"
          fill="rgba(255,255,255,0.15)"
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wheel of Fortune Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function WheelOfFortunePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Game settings
  const [risk, setRisk] = useState<Risk>('medium');
  const [segmentCount, setSegmentCount] = useState<Segments>(20);
  const [betAmount, setBetAmount] = useState('1.00');

  // Game state
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winResult, setWinResult] = useState<WheelResult | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [recentResults, setRecentResults] = useState<WheelResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showFairness, setShowFairness] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');

  // Auto-bet state
  const [autoBetActive, setAutoBetActive] = useState(false);
  const [autoBetCount, setAutoBetCount] = useState('0');
  const [autoBetOnWin, setAutoBetOnWin] = useState('reset');
  const [autoBetOnLoss, setAutoBetOnLoss] = useState('reset');
  const [autoBetWinIncrease, setAutoBetWinIncrease] = useState('100');
  const [autoBetLossIncrease, setAutoBetLossIncrease] = useState('100');
  const [autoBetStopOnProfit, setAutoBetStopOnProfit] = useState('');
  const [autoBetStopOnLoss, setAutoBetStopOnLoss] = useState('');
  const [autoBetPlayed, setAutoBetPlayed] = useState(0);
  const [autoBetProfit, setAutoBetProfit] = useState(0);

  // Refs
  const isPlayingRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const autoBetRef = useRef(false);
  const autoBetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseBetRef = useRef('1.00');
  const wheelContainerRef = useRef<HTMLDivElement>(null);

  const [wheelSize, setWheelSize] = useState(260);

  useEffect(() => {
    setBetAmount(getDefaultBet(currency));
    baseBetRef.current = getDefaultBet(currency);
  }, [currency]);

  useEffect(() => {
    function handleResize() {
      if (wheelContainerRef.current) {
        const w = wheelContainerRef.current.clientWidth;
        setWheelSize(Math.min(w - 32, 260));
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentDistribution = useMemo(
    () => getSegmentDistribution(risk, segmentCount),
    [risk, segmentCount]
  );
  const segmentLegend = useMemo(() => countSegments(currentDistribution), [currentDistribution]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (autoBetTimeoutRef.current) clearTimeout(autoBetTimeoutRef.current);
      autoBetRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Spin logic
  // ---------------------------------------------------------------------------

  const spinWheel = useCallback(
    async (overrideBet?: string) => {
      if (isPlayingRef.current) return;
      isPlayingRef.current = true;
      setIsSpinning(true);
      setShowWin(false);
      setWinResult(null);
      setHighlightIndex(null);
      setErrorMessage(null);

      const bet = overrideBet || betAmount;

      let apiResult: WheelApiResponse;
      try {
        apiResult = await post<WheelApiResponse>('/casino/games/wheel/play', {
          amount: parseFloat(bet),
          currency,
          options: { risk, segments: segmentCount },
        });

        if (apiResult.newBalance !== undefined) {
          const { updateBalance } = useAuthStore.getState();
          updateBalance(currency, apiResult.newBalance, 0);
        }
      } catch (err: any) {
        const errorCode = err?.errors?.code || err?.message || '';
        if (errorCode === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(err?.message || '')) {
          setErrorMessage('Insufficient balance. Please deposit funds.');
        } else if (err?.statusCode === 401) {
          setErrorMessage('Please log in to play.');
        } else {
          setErrorMessage('Failed to place bet. Please try again.');
        }
        setIsSpinning(false);
        isPlayingRef.current = false;
        autoBetRef.current = false;
        setAutoBetActive(false);
        return null;
      }

      const targetSegIndex = apiResult.result.segmentIndex;
      const segAngle = 360 / currentDistribution.length;
      const targetAngle = -(targetSegIndex * segAngle + segAngle / 2);
      const fullSpins = 5 + Math.floor(Math.random() * 3);
      const totalRotation = fullSpins * 360 + ((targetAngle % 360) + 360) % 360;
      const startRotation = rotation % 360;
      const endRotation = startRotation + totalRotation;

      const duration = 4000 + Math.random() * 1500;
      const startTime = performance.now();

      return new Promise<WheelResult | null>((resolve) => {
        function animate(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutCubic(progress);
          const currentRotation = startRotation + (endRotation - startRotation) * easedProgress;

          setRotation(currentRotation);

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            setRotation(endRotation);
            setHighlightIndex(targetSegIndex);
            setIsSpinning(false);
            isPlayingRef.current = false;

            const result: WheelResult = {
              id: apiResult.roundId,
              segmentIndex: targetSegIndex,
              multiplier: apiResult.result.multiplier,
              color: apiResult.result.color || SEGMENT_TYPES[String(apiResult.result.multiplier)]?.color || '#4B5563',
              isWin: apiResult.result.isWin,
              betAmount: parseFloat(bet),
              payout: apiResult.payout,
              profit: apiResult.profit,
              timestamp: new Date(),
            };

            setWinResult(result);
            setShowWin(true);
            setRecentResults((prev) => [result, ...prev.slice(0, 19)]);

            setTimeout(() => setShowWin(false), 2500);

            resolve(result);
          }
        }

        animationRef.current = requestAnimationFrame(animate);
      });
    },
    [betAmount, currency, risk, segmentCount, currentDistribution, rotation]
  );

  // ---------------------------------------------------------------------------
  // Auto-bet logic
  // ---------------------------------------------------------------------------

  const startAutoBet = useCallback(() => {
    if (!isAuthenticated) return;
    baseBetRef.current = betAmount;
    setAutoBetActive(true);
    setAutoBetPlayed(0);
    setAutoBetProfit(0);
    autoBetRef.current = true;
  }, [isAuthenticated, betAmount]);

  const stopAutoBet = useCallback(() => {
    autoBetRef.current = false;
    setAutoBetActive(false);
    if (autoBetTimeoutRef.current) {
      clearTimeout(autoBetTimeoutRef.current);
      autoBetTimeoutRef.current = null;
    }
  }, []);

  const runAutoBetRound = useCallback(async () => {
    if (!autoBetRef.current) return;

    const maxRounds = parseInt(autoBetCount) || 0;
    const stopProfit = parseFloat(autoBetStopOnProfit) || Infinity;
    const stopLoss = parseFloat(autoBetStopOnLoss) || Infinity;

    if (maxRounds > 0 && autoBetPlayed >= maxRounds) { stopAutoBet(); return; }
    if (autoBetProfit >= stopProfit) { stopAutoBet(); return; }
    if (autoBetProfit <= -stopLoss) { stopAutoBet(); return; }

    const result = await spinWheel(betAmount);

    if (!result || !autoBetRef.current) { stopAutoBet(); return; }

    const newProfit = autoBetProfit + result.profit;
    const newPlayed = autoBetPlayed + 1;
    setAutoBetProfit(newProfit);
    setAutoBetPlayed(newPlayed);

    if (result.isWin) {
      if (autoBetOnWin === 'reset') {
        setBetAmount(baseBetRef.current);
      } else {
        const increase = parseFloat(autoBetWinIncrease) || 100;
        const newBet = (parseFloat(betAmount) * (increase / 100)).toFixed(8);
        setBetAmount(newBet);
      }
    } else {
      if (autoBetOnLoss === 'reset') {
        setBetAmount(baseBetRef.current);
      } else {
        const increase = parseFloat(autoBetLossIncrease) || 100;
        const newBet = (parseFloat(betAmount) * (increase / 100)).toFixed(8);
        setBetAmount(newBet);
      }
    }

    if (maxRounds > 0 && newPlayed >= maxRounds) { stopAutoBet(); return; }
    if (newProfit >= stopProfit || newProfit <= -stopLoss) { stopAutoBet(); return; }

    if (autoBetRef.current) {
      autoBetTimeoutRef.current = setTimeout(runAutoBetRound, 800);
    }
  }, [
    autoBetCount, autoBetStopOnProfit, autoBetStopOnLoss, autoBetPlayed,
    autoBetProfit, autoBetOnWin, autoBetOnLoss, autoBetWinIncrease,
    autoBetLossIncrease, betAmount, spinWheel, stopAutoBet,
  ]);

  useEffect(() => {
    if (autoBetActive && !isSpinning && autoBetRef.current) {
      autoBetTimeoutRef.current = setTimeout(runAutoBetRound, 500);
    }
  }, [autoBetActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(8));
  };

  const incrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount((val + 0.001).toFixed(8));
  };

  const decrementBet = () => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val - 0.001).toFixed(8));
  };

  const handleSpin = () => {
    if (autoBetActive) {
      stopAutoBet();
    } else {
      spinWheel();
    }
  };

  const getResultColor = (mult: number) => SEGMENT_TYPES[String(mult)]?.color || '#4B5563';

  // ---------------------------------------------------------------------------
  // Render - Cloudbet Mobile Style
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      <div className="pb-20">
        {/* Error Message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-4 mt-3 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ WHEEL AREA - edge to edge ============ */}
        <div
          ref={wheelContainerRef}
          className="bg-[#161B22] p-4 relative overflow-hidden"
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: showWin && winResult?.isWin
                ? `radial-gradient(circle at 50% 50%, ${winResult.color}15, transparent 70%)`
                : 'radial-gradient(circle at 50% 50%, rgba(200,255,0,0.02), transparent 70%)',
            }}
          />

          {/* Large spinning wheel centered (~260px), with lime pointer */}
          <div className="relative flex items-center justify-center" style={{ minHeight: wheelSize + 48 }}>
            <WheelPointer />
            <div
              className="relative"
              style={{
                width: wheelSize,
                height: wheelSize,
                transform: `rotate(${rotation}deg)`,
                willChange: 'transform',
              }}
            >
              <WheelSVG
                segments={currentDistribution}
                size={wheelSize}
                highlightIndex={highlightIndex}
                isGlowing={showWin && !!winResult?.isWin}
              />
            </div>

            {/* Center result */}
            <AnimatePresence>
              {showWin && winResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                >
                  <div className={cn(
                    'rounded-2xl px-6 py-4 text-center',
                    winResult.isWin ? 'bg-black/60 border border-white/10' : 'bg-black/40 border border-white/5'
                  )}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.3, 1] }}
                      transition={{ duration: 0.5, times: [0, 0.6, 1] }}
                      className="text-5xl font-bold font-mono"
                      style={{ color: winResult.color }}
                    >
                      {winResult.multiplier}x
                    </motion.div>
                    {winResult.isWin ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <p className="text-[#10B981] font-bold text-lg mt-1">WIN!</p>
                        <p className="text-[#10B981]/80 text-sm font-mono">+{formatCurrency(winResult.profit, currency)}</p>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <p className="text-[#EF4444]/70 font-medium text-sm mt-1">No win</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Segment multipliers legend */}
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {segmentLegend.map((item) => (
              <div key={item.multiplier} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0D1117] border border-[#30363D]">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.def.color }} />
                <span className="text-[10px] font-mono text-[#E6EDF3] font-semibold">{item.def.label}</span>
                <span className="text-[9px] text-[#8B949E]">{item.count}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* History as colored dots */}
        {recentResults.length > 0 && (
          <div className="px-4 mt-3">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1">
              {recentResults.slice(0, 15).map((r, i) => (
                <motion.div
                  key={`${r.id}-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold font-mono text-white border-2"
                  style={{
                    backgroundColor: getResultColor(r.multiplier),
                    borderColor: r.isWin ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                  }}
                >
                  {r.multiplier}x
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ============ BET CONTROLS ============ */}
        <div className="px-4 mt-3">
          <div className="bg-[#161B22] rounded-2xl border border-[#30363D] overflow-hidden">
            {/* Manual / Auto Toggle */}
            <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex mx-4 mt-4">
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

            <div className="p-4 space-y-3">
              {/* Bet Amount */}
              <div>
                <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                  <span className="text-[#8B949E] text-xs mr-2">{currency}</span>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={isSpinning}
                    className="flex-1 bg-transparent text-sm font-mono text-[#E6EDF3] text-center focus:outline-none disabled:opacity-40"
                    step="any"
                    min="0"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={decrementBet}
                      disabled={isSpinning}
                      className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={incrementBet}
                      disabled={isSpinning}
                      className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Quick presets */}
                <div className="flex gap-1.5 mt-2">
                  {['0.01', '0.1', '1', '10', '100'].map((v) => (
                    <button
                      key={v}
                      onClick={() => !isSpinning && setBetAmount(v)}
                      disabled={isSpinning}
                      className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    onClick={() => adjustBet(0.5)}
                    disabled={isSpinning}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => adjustBet(2)}
                    disabled={isSpinning}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    2X
                  </button>
                </div>
              </div>

              {/* Risk */}
              <div>
                <label className="text-[#8B949E] text-sm mb-1 block font-medium">Risk</label>
                <div className="flex gap-1.5">
                  {(['low', 'medium', 'high'] as Risk[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => !isSpinning && setRisk(r)}
                      disabled={isSpinning || autoBetActive}
                      className={cn(
                        'flex-1 h-9 rounded-xl font-bold text-xs capitalize transition-all',
                        risk === r
                          ? 'bg-[#8B5CF6] text-white'
                          : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] disabled:opacity-40',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Segments */}
              <div>
                <label className="text-[#8B949E] text-sm mb-1 block font-medium">Segments</label>
                <div className="flex gap-1.5">
                  {([10, 20, 30, 50] as Segments[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => !isSpinning && setSegmentCount(s)}
                      disabled={isSpinning || autoBetActive}
                      className={cn(
                        'flex-1 h-9 rounded-xl font-mono font-bold text-xs transition-all',
                        segmentCount === s
                          ? 'bg-[#8B5CF6] text-white'
                          : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] disabled:opacity-40',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* SPIN - lime CTA full width */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!isAuthenticated || (isSpinning && !autoBetActive)}
                onClick={handleSpin}
                className={cn(
                  'bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base flex items-center justify-center gap-2 transition-all',
                  autoBetActive
                    ? 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
                    : isSpinning
                      ? 'opacity-40 cursor-not-allowed'
                      : (!isAuthenticated) && 'opacity-40 cursor-not-allowed',
                )}
              >
                {autoBetActive ? (
                  <>Stop Auto</>
                ) : isSpinning ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
                    />
                    Spinning...
                  </>
                ) : isAuthenticated ? (
                  <>
                    <Zap className="w-5 h-5" />
                    SPIN
                  </>
                ) : (
                  'Login to Play'
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* ============ HISTORY TABLE ============ */}
        {recentResults.length > 0 && (
          <div className="px-4 mt-3">
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-[#30363D]">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#8B949E]" />
                  <h3 className="text-sm font-semibold text-[#E6EDF3]">History</h3>
                </div>
                <button
                  onClick={() => setRecentResults([])}
                  className="text-xs text-[#8B949E] hover:text-[#E6EDF3] flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-[#30363D]/30">
                {recentResults.map((round, i) => (
                  <div key={round.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: round.color }}>
                        {round.multiplier}x
                      </div>
                      <span className={cn('font-semibold', round.isWin ? 'text-[#10B981]' : 'text-[#8B949E]')}>
                        {round.isWin ? 'Win' : 'Miss'}
                      </span>
                    </div>
                    <span className={cn('font-mono font-bold', round.profit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                      {round.profit >= 0 ? '+' : ''}{formatCurrency(round.profit, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ FIXED BOTTOM BAR ============ */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <button className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowFairness(!showFairness)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {formatCurrency(parseFloat(betAmount) || 0, currency)} {currency}
        </span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
