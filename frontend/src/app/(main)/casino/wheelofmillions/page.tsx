'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Volume2, VolumeX, ChevronDown, RotateCcw, Sparkles, Star } from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GamePhase = 'idle' | 'spinning-tier1' | 'bonus-reveal' | 'spinning-tier2' | 'mega-reveal' | 'spinning-tier3' | 'result';

interface TierResult { segment: string; multiplier: number; }

interface WOMResponse {
  roundId: string; game: string; betAmount: number; payout: number; profit: number; multiplier: number;
  result: {
    tier1: TierResult; tier2?: TierResult; tier3?: TierResult; finalMultiplier: number; payout: number; tiersReached: number;
    tier1Segments: { segment: string; multiplier: number }[]; tier2Segments: { segment: string; multiplier: number }[];
    tier3Segments: { segment: string; multiplier: number }[]; tier1Index: number; tier2Index: number | null; tier3Index: number | null;
  };
  fairness: { serverSeedHash: string; clientSeed: string; nonce: number; };
  newBalance: number;
}

interface GameHistory { id: string; tiersReached: number; finalMultiplier: number; payout: number; profit: number; betAmount: number; }

// ---------------------------------------------------------------------------
// Wheel segment builders
// ---------------------------------------------------------------------------

const TIER1_LABELS = ['1x', '2x', '3x', '5x', 'BONUS'];
const TIER2_LABELS = ['10x', '25x', '50x', '100x', 'MEGA'];
const TIER3_LABELS = ['500x', '1000x', '5000x', '10000x'];
const TIER1_SEG_COUNT = 20; const TIER2_SEG_COUNT = 16; const TIER3_SEG_COUNT = 12;

function buildSegs(labels: string[], weights: number[], total: number): string[] {
  const segs: string[] = [];
  const tw = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < labels.length; i++) { const cnt = Math.round((weights[i] / tw) * total); for (let j = 0; j < cnt; j++) segs.push(labels[i]); }
  while (segs.length < total) segs.push(labels[0]);
  while (segs.length > total) segs.pop();
  for (let i = segs.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [segs[i], segs[j]] = [segs[j], segs[i]]; }
  return segs;
}

const t1Segs = buildSegs(TIER1_LABELS, [35, 25, 15, 10, 15], TIER1_SEG_COUNT);
const t2Segs = buildSegs(TIER2_LABELS, [35, 25, 18, 12, 10], TIER2_SEG_COUNT);
const t3Segs = buildSegs(TIER3_LABELS, [45, 30, 18, 7], TIER3_SEG_COUNT);

function segColor(label: string, tier: number): string {
  if (label === 'BONUS') return '#FFD700';
  if (label === 'MEGA') return '#FF6B35';
  if (tier === 1) { const m: Record<string, string> = { '1x': '#8B6914', '2x': '#A0782C', '3x': '#B8860B', '5x': '#CD853F' }; return m[label] || '#8B6914'; }
  if (tier === 2) { const m: Record<string, string> = { '10x': '#708090', '25x': '#8A9AA5', '50x': '#A9A9A9', '100x': '#C0C0C0' }; return m[label] || '#708090'; }
  const m: Record<string, string> = { '500x': '#DAA520', '1000x': '#FFB347', '5000x': '#FF8C00', '10000x': '#FF4500' };
  return m[label] || '#DAA520';
}

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }

// ---------------------------------------------------------------------------
// Coin Shower
// ---------------------------------------------------------------------------

function CoinShower({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  useEffect(() => {
    if (!active || !ref.current) return;
    const c = ref.current; const ctx = c.getContext('2d'); if (!ctx) return;
    c.width = c.offsetWidth * 2; c.height = c.offsetHeight * 2; ctx.scale(2, 2);
    const w = c.offsetWidth; const h = c.offsetHeight;
    const cols = ['#FFD700', '#FFA500', '#FFEC8B', '#DAA520', '#FFB347'];
    const coins = Array.from({ length: 50 }, () => ({ x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vy: 1 + Math.random() * 3, vx: (Math.random() - 0.5) * 2, sz: 4 + Math.random() * 7, rot: Math.random() * Math.PI * 2, rs: 0.02 + Math.random() * 0.06, col: cols[Math.floor(Math.random() * cols.length)], life: 1 }));
    const draw = () => {
      ctx.clearRect(0, 0, w, h); let alive = false;
      for (const coin of coins) { if (coin.life <= 0) continue; alive = true; coin.y += coin.vy; coin.x += coin.vx; coin.rot += coin.rs; coin.vy += 0.04; if (coin.y > h) coin.life = 0; ctx.save(); ctx.globalAlpha = Math.max(0, coin.life); ctx.translate(coin.x, coin.y); ctx.rotate(coin.rot); ctx.fillStyle = coin.col; ctx.beginPath(); ctx.ellipse(0, 0, coin.sz, coin.sz * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      if (alive) raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [active]);
  if (!active) return null;
  return <canvas ref={ref} className="absolute inset-0 pointer-events-none z-30" style={{ width: '100%', height: '100%' }} />;
}

// ---------------------------------------------------------------------------
// Tier Ring SVG
// ---------------------------------------------------------------------------

function TierRing({ segments, tier, size, innerR, outerR, active, dimmed }: { segments: string[]; tier: number; size: number; innerR: number; outerR: number; active: boolean; dimmed: boolean; }) {
  const cx = size / 2; const n = segments.length; const aPS = (2 * Math.PI) / n; const tR = (innerR + outerR) / 2;
  return (
    <g opacity={dimmed ? 0.3 : 1} style={{ transition: 'opacity 0.5s' }}>
      <circle cx={cx} cy={cx} r={outerR} fill="none" stroke={tier === 1 ? '#8B6914' : tier === 2 ? '#708090' : '#DAA520'} strokeWidth={active ? 3 : 1.5} opacity={active ? 1 : 0.5} />
      {segments.map((label, i) => {
        const sa = i * aPS - Math.PI / 2; const ea = sa + aPS; const col = segColor(label, tier);
        const x1 = cx + outerR * Math.cos(sa); const y1 = cx + outerR * Math.sin(sa);
        const x2 = cx + outerR * Math.cos(ea); const y2 = cx + outerR * Math.sin(ea);
        const ix1 = cx + innerR * Math.cos(sa); const iy1 = cx + innerR * Math.sin(sa);
        const ix2 = cx + innerR * Math.cos(ea); const iy2 = cx + innerR * Math.sin(ea);
        const la = aPS > Math.PI ? 1 : 0;
        const d = `M ${ix1} ${iy1} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${la} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${la} 0 ${ix1} ${iy1} Z`;
        const ma = sa + aPS / 2; const tx = cx + tR * Math.cos(ma); const ty = cx + tR * Math.sin(ma); const tr = (ma * 180) / Math.PI + 90;
        const special = label === 'BONUS' || label === 'MEGA';
        return (<g key={`${tier}-${i}`}><path d={d} fill={col} stroke="#0D1117" strokeWidth="1" opacity={0.9} /><text x={tx} y={ty} fill={special ? '#0D1117' : 'white'} fontSize={n <= 12 ? 11 : n <= 16 ? 9 : 7} fontWeight="bold" fontFamily="monospace" textAnchor="middle" dominantBaseline="central" transform={`rotate(${tr}, ${tx}, ${ty})`}>{label}</text></g>);
      })}
      <circle cx={cx} cy={cx} r={innerR} fill="none" stroke={tier === 1 ? '#8B6914' : tier === 2 ? '#708090' : '#DAA520'} strokeWidth={1} opacity={0.5} />
    </g>
  );
}

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP', 'TRX'];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function WheelOfMillionsPage() {
  const { isAuthenticated, user } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const setCurrency = useBetSlipStore((s) => s.setCurrency);

  const [betAmount, setBetAmount] = useState('');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [lastResult, setLastResult] = useState<WOMResponse | null>(null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFairness, setLastFairness] = useState<WOMResponse['fairness'] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const [t1Rot, setT1Rot] = useState(0);
  const [t2Rot, setT2Rot] = useState(0);
  const [t3Rot, setT3Rot] = useState(0);
  const [activeTier, setActiveTier] = useState(0);
  const [showBonus, setShowBonus] = useState(false);
  const [showMega, setShowMega] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const [curMult, setCurMult] = useState<number | null>(null);

  const playingRef = useRef(false);
  const animRef = useRef(0);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  const bal = useMemo(() => {
    if (!user?.balances) return 0;
    return user.balances.find((b) => b.currency === currency)?.available ?? 0;
  }, [user?.balances, currency]);

  const spinRing = useCallback(
    (setRot: React.Dispatch<React.SetStateAction<number>>, curRot: number, idx: number, total: number, dur: number): Promise<void> =>
      new Promise((resolve) => {
        const segA = 360 / total; const tA = -(idx * segA + segA / 2);
        const spins = 5 + Math.floor(Math.random() * 3); const totRot = spins * 360 + ((tA % 360) + 360) % 360;
        const sR = curRot % 360; const eR = sR + totRot; const st = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - st) / dur, 1); setRot(sR + (eR - sR) * easeOutCubic(p));
          if (p < 1) animRef.current = requestAnimationFrame(tick); else { setRot(eR); resolve(); }
        };
        animRef.current = requestAnimationFrame(tick);
      }), []);

  const handleSpin = useCallback(async () => {
    if (playingRef.current || !isAuthenticated) return;
    playingRef.current = true; setError(null); setLastResult(null); setShowBonus(false); setShowMega(false); setShowCoins(false); setCurMult(null);

    let data: WOMResponse;
    try {
      data = await post<WOMResponse>('/casino/games/wheelofmillions/play', { amount: parseFloat(betAmount), currency, options: {} });
      setLastFairness(data.fairness);
      if (data.newBalance !== undefined) useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
    } catch (err: any) { setError(err?.response?.data?.error?.message || err?.message || 'Failed to place bet.'); playingRef.current = false; return; }

    const r = data.result; const tiers = r.tiersReached;

    setGamePhase('spinning-tier1'); setActiveTier(1);
    const t1Label = r.tier1.multiplier > 0 ? `${r.tier1.multiplier}x` : 'BONUS';
    const t1Vi = t1Segs.findIndex((s) => s === t1Label);
    await spinRing(setT1Rot, t1Rot, t1Vi >= 0 ? t1Vi : (r.tier1Index ?? 0), t1Segs.length, 3500);

    const betAmt = data.betAmount ?? parseFloat(betAmount);
    const payoutAmt = data.payout ?? betAmt * r.finalMultiplier;
    const profitAmt = data.profit ?? (payoutAmt - betAmt);

    if (tiers === 1) {
      setCurMult(r.finalMultiplier); setGamePhase('result');
      if (payoutAmt > betAmt) { setShowCoins(true); setTimeout(() => setShowCoins(false), 3000); }
    } else {
      setGamePhase('bonus-reveal'); setShowBonus(true);
      await new Promise((done) => setTimeout(done, 2000)); setShowBonus(false);
      setGamePhase('spinning-tier2'); setActiveTier(2);
      const t2Label = r.tier2!.segment === 'MEGA BONUS' ? 'MEGA' : `${r.tier2!.multiplier}x`;
      const t2Vi = t2Segs.findIndex((s) => s === t2Label);
      await spinRing(setT2Rot, t2Rot, t2Vi >= 0 ? t2Vi : (r.tier2Index ?? 0), t2Segs.length, 3500);

      if (tiers === 2) {
        setCurMult(r.finalMultiplier); setGamePhase('result'); setShowCoins(true); setTimeout(() => setShowCoins(false), 3000);
      } else {
        setGamePhase('mega-reveal'); setShowMega(true);
        await new Promise((done) => setTimeout(done, 2500)); setShowMega(false);
        setGamePhase('spinning-tier3'); setActiveTier(3);
        const t3Label = `${r.tier3!.multiplier}x`;
        const t3Vi = t3Segs.findIndex((s) => s === t3Label);
        await spinRing(setT3Rot, t3Rot, t3Vi >= 0 ? t3Vi : (r.tier3Index ?? 0), t3Segs.length, 4000);
        setCurMult(r.finalMultiplier); setGamePhase('result'); setShowCoins(true); setTimeout(() => setShowCoins(false), 5000);
      }
    }

    setLastResult({ ...data, payout: payoutAmt, profit: profitAmt, betAmount: betAmt }); setActiveTier(0);
    setHistory((prev) => [{ id: data.roundId, tiersReached: r.tiersReached, finalMultiplier: r.finalMultiplier, payout: payoutAmt, profit: profitAmt, betAmount: betAmt }, ...prev.slice(0, 19)]);
    playingRef.current = false;
  }, [betAmount, currency, isAuthenticated, spinRing, t1Rot, t2Rot, t3Rot]);

  const handleHalf = () => setBetAmount(((parseFloat(betAmount) || 0) / 2).toFixed(8));
  const handleDouble = () => setBetAmount(Math.min((parseFloat(betAmount) || 0) * 2, bal).toFixed(8));

  const spinning = gamePhase !== 'idle' && gamePhase !== 'result';

  const WS = 340;
  const T1O = WS / 2 - 4; const T1I = T1O * 0.68;
  const T2O = T1I - 4; const T2I = T2O * 0.62;
  const T3O = T2I - 4; const T3I = T3O * 0.45;

  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Wheel Arena - edge to edge */}
      <div className="relative bg-[#161B22] border-b border-[#30363D] overflow-hidden">
        <CoinShower active={showCoins} />

        {/* Tier badges */}
        <div className="absolute top-3 left-3 z-10 flex gap-1.5">
          {[1, 2, 3].map((t) => (
            <div key={t} className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all',
              t === 1 && 'bg-amber-900/30 border-amber-700/50 text-amber-400',
              t === 2 && 'bg-gray-600/30 border-gray-500/50 text-gray-300',
              t === 3 && 'bg-yellow-600/30 border-yellow-500/50 text-yellow-300',
              activeTier === t && 'ring-2 ring-white/30 scale-110')}>
              {t === 1 ? 'Outer' : t === 2 ? 'Middle' : 'Inner'}
            </div>
          ))}
        </div>

        {curMult !== null && gamePhase === 'result' && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute top-3 right-3 z-10">
            <div className={cn('px-3 py-1 rounded-xl font-bold font-mono text-sm border',
              curMult >= 500 ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300' : curMult >= 10 ? 'bg-purple-500/20 border-purple-400/50 text-purple-300' : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300')}>{curMult}x</div>
          </motion.div>
        )}

        <div className="relative flex flex-col items-center justify-center min-h-[380px] py-4">
          {/* Pointer */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20">
            <svg width="24" height="30" viewBox="0 0 30 38"><defs><linearGradient id="wp-g" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#FFD700" /><stop offset="100%" stopColor="#B8860B" /></linearGradient></defs><path d="M15 38 L3 8 Q1 2 7 2 L23 2 Q29 2 27 8 Z" fill="url(#wp-g)" stroke="#8B6914" strokeWidth="1.5" /></svg>
          </div>

          <div className="relative" style={{ width: WS, height: WS }}>
            <svg width={WS} height={WS} viewBox={`0 0 ${WS} ${WS}`}>
              <g style={{ transform: `rotate(${t1Rot}deg)`, transformOrigin: '50% 50%' }}><TierRing segments={t1Segs} tier={1} size={WS} innerR={T1I} outerR={T1O} active={activeTier === 1} dimmed={activeTier > 1} /></g>
              <g style={{ transform: `rotate(${t2Rot}deg)`, transformOrigin: '50% 50%' }}><TierRing segments={t2Segs} tier={2} size={WS} innerR={T2I} outerR={T2O} active={activeTier === 2} dimmed={activeTier === 0 || activeTier === 1 ? true : activeTier > 2} /></g>
              <g style={{ transform: `rotate(${t3Rot}deg)`, transformOrigin: '50% 50%' }}><TierRing segments={t3Segs} tier={3} size={WS} innerR={T3I} outerR={T3O} active={activeTier === 3} dimmed={activeTier !== 3} /></g>
              <circle cx={WS / 2} cy={WS / 2} r={T3I} fill="#161B22" stroke="#30363D" strokeWidth="2" />
              <text x={WS / 2} y={WS / 2 - 4} fill="#FFD700" fontSize="8" fontWeight="bold" textAnchor="middle" dominantBaseline="central">WHEEL OF</text>
              <text x={WS / 2} y={WS / 2 + 6} fill="#FFD700" fontSize="10" fontWeight="bold" textAnchor="middle" dominantBaseline="central">MILLIONS</text>
            </svg>
          </div>

          {/* BONUS overlay */}
          <AnimatePresence>
            {showBonus && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.5, 1.2], opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="text-center"><div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500">BONUS!</div><div className="text-sm text-amber-300 font-bold mt-1 animate-pulse">Middle Wheel Activated!</div></div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showMega && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 2, 1.5], opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <div className="text-center"><div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-400 via-orange-500 to-yellow-400">MEGA BONUS!!</div><div className="text-lg text-orange-300 font-bold mt-1 animate-bounce">Inner Wheel Activated!</div></div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result */}
          <AnimatePresence>
            {gamePhase === 'result' && lastResult && (
              <motion.div initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.3 }} className="mt-3 text-center z-10">
                <div className={cn('text-2xl font-extrabold', lastResult.profit > 0 ? 'text-[#10B981]' : lastResult.profit === 0 ? 'text-amber-400' : 'text-[#EF4444]')}>
                  {lastResult.profit > 0 ? 'YOU WIN!' : lastResult.profit === 0 ? 'PUSH' : 'NO BONUS'}
                </div>
                {lastResult.profit > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-1">
                    <span className="text-lg font-bold font-mono text-[#10B981]">+{formatCurrency(lastResult.profit, currency)}</span>
                    <span className="text-sm text-[#8B949E] ml-2">({lastResult.result.finalMultiplier}x)</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pt-3 space-y-3">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="text-sm text-red-400">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300 text-lg leading-none">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setMode('manual')}
            className={cn('flex-1 py-2 px-6 text-sm font-semibold transition-colors', mode === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]')}
          >
            Manual
          </button>
          <button
            onClick={() => setMode('auto')}
            className={cn('flex-1 py-2 px-6 text-sm font-semibold transition-colors', mode === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]')}
          >
            Auto
          </button>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="block text-[#8B949E] text-sm mb-1">Bet Amount</label>
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
            <span className="text-[#8B949E] text-xs mr-2">{currency}</span>
            <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={spinning} step="any" min="0"
              className="flex-1 bg-transparent text-center text-sm font-mono text-white focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => setBetAmount(prev => Math.max(0, (parseFloat(prev) || 0) - 0.001).toFixed(8))} disabled={spinning} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white text-sm font-bold disabled:opacity-50">-</button>
              <button onClick={() => setBetAmount(prev => ((parseFloat(prev) || 0) + 0.001).toFixed(8))} disabled={spinning} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white text-sm font-bold disabled:opacity-50">+</button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {['0.01', '0.1', '1', '10', '100'].map(v => (
              <button key={v} onClick={() => setBetAmount(v)} disabled={spinning} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-50">{v}</button>
            ))}
            <button onClick={handleHalf} disabled={spinning} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-50">1/2</button>
            <button onClick={handleDouble} disabled={spinning} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-50">2X</button>
          </div>
        </div>

        {/* Potential wins */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs"><span className="text-[#8B949E]">Tier 1 Max (5x)</span><span className="font-mono text-amber-400">{formatCurrency((parseFloat(betAmount) || 0) * 5, currency)}</span></div>
          <div className="flex items-center justify-between text-xs"><span className="text-[#8B949E]">Tier 2 Max (100x)</span><span className="font-mono text-gray-300">{formatCurrency((parseFloat(betAmount) || 0) * 100, currency)}</span></div>
          <div className="flex items-center justify-between text-xs"><span className="text-[#8B949E]">Tier 3 Max (10,000x)</span><span className="font-mono text-yellow-300 font-bold">{formatCurrency((parseFloat(betAmount) || 0) * 10000, currency)}</span></div>
        </div>

        {/* Spin button */}
        <motion.button whileTap={{ scale: 0.98 }} disabled={!isAuthenticated || spinning} onClick={handleSpin}
          className={cn('w-full py-3.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-base',
            spinning ? 'bg-[#2D333B] text-white cursor-not-allowed' : 'bg-[#C8FF00] text-black',
            !isAuthenticated && 'opacity-60 cursor-not-allowed')}>
          {spinning ? (
            <><div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {activeTier === 1 ? 'Spinning Outer...' : activeTier === 2 ? 'Spinning Middle...' : activeTier === 3 ? 'Spinning Inner...' : 'Loading...'}</>
          ) : (
            <>{isAuthenticated ? (gamePhase === 'result' ? 'SPIN AGAIN' : 'SPIN') : 'Login to Play'}</>
          )}
        </motion.button>

        {/* Recent spins */}
        {history.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <span className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider block mb-2">Recent Spins</span>
            <div className="flex gap-1.5 flex-wrap">
              {history.map((h) => (
                <div key={h.id} className={cn('px-2.5 py-1 rounded-lg text-xs font-bold font-mono border',
                  h.tiersReached === 3 ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300' : h.tiersReached === 2 ? 'bg-gray-400/15 border-gray-400/40 text-gray-300' : h.profit > 0 ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-[#1C2128] border-[#30363D] text-[#8B949E]')}>
                  {h.finalMultiplier}x
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fairness */}
        {lastFairness && gamePhase === 'result' && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3"><Shield className="w-4 h-4 text-[#C8FF00]" /><span className="text-sm font-semibold">Provably Fair</span></div>
            <div className="space-y-2 text-xs">
              <div><span className="text-[#8B949E]">Server Seed Hash</span><p className="font-mono text-gray-300 bg-[#0D1117] rounded-md px-3 py-2 mt-1 break-all">{lastFairness.serverSeedHash}</p></div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[#8B949E]">Client Seed</span><p className="font-mono text-gray-300 bg-[#0D1117] rounded-md px-3 py-2 mt-1">{lastFairness.clientSeed}</p></div>
                <div><span className="text-[#8B949E]">Nonce</span><p className="font-mono text-gray-300 bg-[#0D1117] rounded-md px-3 py-2 mt-1">{lastFairness.nonce}</p></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <a href="/casino" className="text-[#8B949E]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
          </a>
          <button className="text-[#8B949E]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-[#8B949E]">
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">{formatCurrency(bal, currency)}</span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 text-xs text-[#8B5CF6]">
          Provably Fair Game
        </div>
      </div>
    </div>
  );
}
