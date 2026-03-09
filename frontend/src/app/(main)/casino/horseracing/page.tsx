'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BetType = 'win' | 'place' | 'show';
type GamePhase = 'idle' | 'racing' | 'finished';

interface HorseData {
  id: number; name: string; color: string; jockeyColor: string; odds: number;
  progress: number; speed: number; position: number; finishTime: number; lane: number;
}

interface GameResponse {
  roundId: string; game: string; betAmount: number; payout: number; profit: number; multiplier: number;
  result: { positions: number[]; finishTimes: number[]; selectedHorse: number; betType: string; won: boolean };
  fairness: { serverSeedHash: string; clientSeed: string; nonce: number };
  newBalance: number;
}

interface HistoryEntry {
  id: string; horse: number; betType: BetType; amount: number; multiplier: number; profit: number; won: boolean; positions: number[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HORSES: Omit<HorseData, 'progress' | 'speed' | 'position' | 'finishTime' | 'lane'>[] = [
  { id: 1, name: 'Thunder Bolt', color: '#EF4444', jockeyColor: '#FCA5A5', odds: 3.5 },
  { id: 2, name: 'Silver Arrow', color: '#8B5CF6', jockeyColor: '#C4B5FD', odds: 4.2 },
  { id: 3, name: 'Golden Dream', color: '#F59E0B', jockeyColor: '#FCD34D', odds: 5.0 },
  { id: 4, name: 'Midnight Star', color: '#3B82F6', jockeyColor: '#93C5FD', odds: 6.5 },
  { id: 5, name: 'Desert Storm', color: '#10B981', jockeyColor: '#6EE7B7', odds: 8.0 },
  { id: 6, name: 'Royal Flush', color: '#EC4899', jockeyColor: '#F9A8D4', odds: 10.0 },
  { id: 7, name: 'Iron Warrior', color: '#6B7280', jockeyColor: '#D1D5DB', odds: 15.0 },
  { id: 8, name: 'Lucky Charm', color: '#14B8A6', jockeyColor: '#5EEAD4', odds: 20.0 },
];

const BET_TYPES: { value: BetType; label: string; desc: string; multiplierFactor: number }[] = [
  { value: 'win', label: 'Win', desc: '1st place only', multiplierFactor: 1.0 },
  { value: 'place', label: 'Place', desc: '1st or 2nd', multiplierFactor: 0.45 },
  { value: 'show', label: 'Show', desc: 'Top 3 finish', multiplierFactor: 0.25 },
];

const RACE_DURATION_MS = 6500;
const CURRENCIES = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP'];

function HorseIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color || 'currentColor'} strokeWidth="0">
      <path d="M22 6.5C22 5.12 20.88 4 19.5 4c-.39 0-.76.09-1.09.24L15.5 2 12 3l-1.5 5H7l-2 2.5L3 9 1 11l5 4 1.5-.5 1 2.5H11l1 2h2l1-3h3l1-2h2V6.5zM19.5 6a.5.5 0 110 1 .5.5 0 010-1z"/>
    </svg>
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function HorseRacingPage() {
  const user = useAuthStore(s => s.user);
  const balances = user?.balances ?? [];

  const [currency, setCurrency] = useState('BTC');
  const [betAmount, setBetAmount] = useState('');
  const [selectedHorse, setSelectedHorse] = useState<number>(1);
  const [betType, setBetType] = useState<BetType>('win');
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const [horses, setHorses] = useState<HorseData[]>([]);
  const [finishOrder, setFinishOrder] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<GameResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const animFrameRef = useRef<number>(0);
  const raceStartRef = useRef<number>(0);
  const speedsRef = useRef<number[]>([]);
  const progressRef = useRef<number[]>([]);
  const finishOrderRef = useRef<number[]>([]);

  const currentBalance = useMemo(() => {
    return balances.find(b => b.currency === currency)?.available ?? 0;
  }, [balances, currency]);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  const initHorses = useCallback((): HorseData[] => {
    return HORSES.map((h, idx) => ({ ...h, progress: 0, speed: 0, position: idx + 1, finishTime: 0, lane: idx }));
  }, []);

  const generateSpeedProfile = useCallback((targetPositions: number[]) => {
    const speeds: number[] = [];
    for (let i = 0; i < 8; i++) {
      const pos = targetPositions[i];
      const base = 1.0 - (pos - 1) * 0.06;
      const jitter = (Math.random() - 0.5) * 0.02;
      speeds.push(Math.max(0.3, base + jitter));
    }
    return speeds;
  }, []);

  const animateRace = useCallback((timestamp: number) => {
    if (!raceStartRef.current) raceStartRef.current = timestamp;
    const elapsed = timestamp - raceStartRef.current;
    const progress = Math.min(elapsed / RACE_DURATION_MS, 1);
    const newProgress = [...progressRef.current];
    const speeds = speedsRef.current;
    let allFinished = true;
    for (let i = 0; i < 8; i++) {
      if (newProgress[i] < 100) {
        const eased = easeInOutCubic(progress) * speeds[i];
        const wobble = Math.sin(elapsed / (200 + i * 30)) * 0.3;
        newProgress[i] = Math.min(100, eased * 100 + wobble);
        if (newProgress[i] >= 99.5) {
          newProgress[i] = 100;
          if (!finishOrderRef.current.includes(i + 1)) finishOrderRef.current.push(i + 1);
        } else { allFinished = false; }
      }
    }
    progressRef.current = newProgress;
    setHorses(prev => prev.map((h, i) => ({ ...h, progress: newProgress[i] })));
    setFinishOrder([...finishOrderRef.current]);
    if (allFinished || progress >= 1) {
      for (let i = 0; i < 8; i++) { if (!finishOrderRef.current.includes(i + 1)) finishOrderRef.current.push(i + 1); }
      setFinishOrder([...finishOrderRef.current]);
      setPhase('finished');
      setTimeout(() => setShowResult(true), 800);
      return;
    }
    animFrameRef.current = requestAnimationFrame(animateRace);
  }, []);

  const startRace = useCallback(async () => {
    if (!user) { setError('Please log in to play'); return; }
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { setError('Please enter a valid bet amount'); return; }
    if (amount > currentBalance) { setError('Insufficient balance'); return; }
    setError(null); setLoading(true);
    try {
      const data = await post<GameResponse>('/casino/games/horseracing/play', { amount, currency, options: { horse: selectedHorse, betType } });
      const newHorses = initHorses();
      setHorses(newHorses); setFinishOrder([]); finishOrderRef.current = [];
      progressRef.current = new Array(8).fill(0); raceStartRef.current = 0;
      const positions = data.result?.positions ?? [];
      const targetPositions: number[] = new Array(8);
      positions.forEach((horseId: number, idx: number) => { targetPositions[horseId - 1] = idx + 1; });
      speedsRef.current = generateSpeedProfile(targetPositions);
      setLastResult(data); setPhase('racing'); setLoading(false);
      if (data.newBalance !== undefined) useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      animFrameRef.current = requestAnimationFrame(animateRace);
      setHistory(prev => [{ id: data.roundId, horse: selectedHorse, betType, amount, multiplier: data.multiplier ?? 0, profit: data.profit ?? 0, won: data.result?.won ?? false, positions }, ...prev].slice(0, 20));
    } catch (err: any) { setError(err?.message || 'Failed to place bet'); setLoading(false); }
  }, [user, betAmount, currency, currentBalance, selectedHorse, betType, initHorses, generateSpeedProfile, animateRace]);

  useEffect(() => { return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); }; }, []);

  const resetRace = useCallback(() => {
    setShowResult(false); setPhase('idle'); setHorses([]); setFinishOrder([]); setLastResult(null);
  }, []);

  const handleHalf = () => setBetAmount(((parseFloat(betAmount) || 0) / 2).toFixed(8));
  const handleDouble = () => setBetAmount(Math.min((parseFloat(betAmount) || 0) * 2, currentBalance).toFixed(8));

  const potentialPayout = useMemo(() => {
    const amt = parseFloat(betAmount) || 0;
    const horseData = HORSES.find(h => h.id === selectedHorse);
    if (!horseData) return 0;
    const factor = BET_TYPES.find(b => b.value === betType)?.multiplierFactor ?? 1;
    return amt * horseData.odds * factor;
  }, [betAmount, selectedHorse, betType]);

  const isPlaying = phase === 'racing';
  const displayHorses = phase === 'idle' ? initHorses() : horses;

  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Race Track - edge to edge */}
      <div className="bg-[#161B22] border-b border-[#30363D] overflow-hidden">
        <div className="px-4 py-2 flex justify-between items-center">
          <span className="text-xs text-[#8B949E] font-semibold">Race Track</span>
          <span className={cn('text-xs font-semibold', phase === 'racing' ? 'text-yellow-400' : phase === 'finished' ? 'text-[#10B981]' : 'text-[#8B949E]')}>
            {phase === 'idle' ? 'Awaiting start' : phase === 'racing' ? 'RACE IN PROGRESS' : 'RACE COMPLETE'}
          </span>
        </div>
        <div className="px-3 pb-3 space-y-1">
          {displayHorses.map((horse, idx) => {
            const finishPos = finishOrder.indexOf(horse.id);
            const posLabel = finishPos >= 0 ? finishPos + 1 : null;
            return (
              <div key={horse.id} className={cn('relative flex items-center gap-2 h-9 rounded-md', idx % 2 === 0 ? 'bg-[#161B22]/60' : 'bg-[#1C2128]/40')}>
                <div className="w-6 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-[#8B949E]">{horse.id}</span>
                </div>
                <div className="flex-1 relative h-full overflow-hidden">
                  <motion.div className="absolute top-1/2 -translate-y-1/2 z-20" style={{ left: `${Math.min(horse.progress, 95)}%` }} animate={{ left: `${Math.min(horse.progress, 95)}%` }} transition={{ duration: 0.05, ease: 'linear' }}>
                    <HorseIcon className="w-7 h-7" color={horse.color} />
                  </motion.div>
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#30363D]">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: horse.color, width: `${horse.progress}%` }} animate={{ width: `${horse.progress}%` }} transition={{ duration: 0.05, ease: 'linear' }} />
                  </div>
                </div>
                {phase === 'finished' && posLabel !== null && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn('absolute right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-30', posLabel === 1 && 'bg-yellow-500 text-black', posLabel === 2 && 'bg-gray-300 text-black', posLabel === 3 && 'bg-amber-700 text-white', posLabel > 3 && 'bg-[#30363D] text-[#8B949E]')}>
                    {posLabel}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pt-3 space-y-3">
        {/* Horse Selection */}
        <div>
          <label className="block text-[#8B949E] text-sm mb-1">Select Horse</label>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {HORSES.map(horse => {
              const isSelected = selectedHorse === horse.id;
              const multiplier = betType === 'win' ? horse.odds : betType === 'place' ? +(horse.odds * 0.45).toFixed(2) : +(horse.odds * 0.25).toFixed(2);
              const finishPos = finishOrder.length > 0 ? finishOrder.indexOf(horse.id) + 1 || null : null;
              return (
                <button key={horse.id} onClick={() => setSelectedHorse(horse.id)} disabled={isPlaying}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left', isSelected ? 'border-[#C8FF00] bg-[#C8FF00]/5' : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58]', isPlaying && !isSelected && 'opacity-50 cursor-not-allowed')}>
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: horse.color + '30', border: `2px solid ${horse.color}` }}>
                    <span className="text-xs font-bold text-white">{horse.id}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{horse.name}</div>
                    <div className="text-xs text-[#8B949E] font-mono">Odds: {horse.odds.toFixed(1)}x</div>
                  </div>
                  <div className={cn('text-right flex-shrink-0', isSelected ? 'text-[#C8FF00]' : 'text-gray-300')}>
                    <div className="text-sm font-mono font-bold">{multiplier.toFixed(2)}x</div>
                  </div>
                  {phase === 'finished' && finishPos !== null && (
                    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold', finishPos === 1 && 'bg-yellow-500 text-black', finishPos === 2 && 'bg-gray-300 text-black', finishPos === 3 && 'bg-amber-700 text-white', finishPos > 3 && 'bg-[#30363D] text-[#8B949E]')}>
                      {finishPos}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bet Type */}
        <div>
          <label className="block text-[#8B949E] text-sm mb-1">Bet Type</label>
          <div className="grid grid-cols-3 gap-1 bg-[#0D1117] border border-[#30363D] rounded-lg p-1">
            {BET_TYPES.map(bt => (
              <button key={bt.value} onClick={() => setBetType(bt.value)} disabled={isPlaying}
                className={cn('py-2 rounded-md text-sm font-medium transition-all', betType === bt.value ? 'bg-[#8B5CF6] text-white font-bold' : 'text-[#8B949E] hover:text-white')}>
                <div>{bt.label}</div>
                <div className="text-[10px] opacity-70">{bt.desc}</div>
              </button>
            ))}
          </div>
        </div>

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
            <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)} disabled={isPlaying}
              className="flex-1 bg-transparent text-center text-white font-mono text-sm focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.00" step="any" min="0" />
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => setBetAmount(prev => Math.max(0, (parseFloat(prev) || 0) - 0.001).toFixed(8))} disabled={isPlaying} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white text-sm font-bold disabled:opacity-50">-</button>
              <button onClick={() => setBetAmount(prev => ((parseFloat(prev) || 0) + 0.001).toFixed(8))} disabled={isPlaying} className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-white text-sm font-bold disabled:opacity-50">+</button>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            {['0.01', '0.1', '1', '10', '100'].map(v => (
              <button key={v} onClick={() => setBetAmount(v)} disabled={isPlaying} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-50">{v}</button>
            ))}
            <button onClick={handleHalf} disabled={isPlaying} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-50">1/2</button>
            <button onClick={handleDouble} disabled={isPlaying} className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] disabled:opacity-50">2X</button>
          </div>
        </div>

        {/* Potential Payout */}
        <div className="bg-[#0D1117] rounded-lg p-3 flex items-center justify-between border border-[#30363D]">
          <span className="text-sm text-[#8B949E]">Potential Payout</span>
          <span className="text-sm font-mono font-bold text-[#10B981]">{formatCurrency(potentialPayout, currency)}</span>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-sm text-[#EF4444]">{error}</motion.div>
          )}
        </AnimatePresence>

        {/* CTA Button */}
        <motion.button
          onClick={phase === 'finished' ? resetRace : startRace}
          disabled={loading || isPlaying}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'w-full py-3.5 rounded-xl font-bold text-base transition-all',
            isPlaying ? 'bg-[#2D333B] text-white cursor-not-allowed' : 'bg-[#C8FF00] text-black',
            loading && 'opacity-60'
          )}
        >
          {phase === 'finished' ? 'NEW RACE' : isPlaying ? 'Racing...' : loading ? 'Placing Bet...' : 'PLACE BET'}
        </motion.button>

        {/* Result overlay */}
        <AnimatePresence>
          {showResult && lastResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={resetRace}>
              <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ type: 'spring', damping: 20 }}
                className={cn('relative w-full max-w-sm rounded-2xl border p-6 text-center', lastResult.result?.won ? 'bg-gradient-to-b from-[#10B981]/20 to-[#161B22] border-[#10B981]/40' : 'bg-gradient-to-b from-[#EF4444]/20 to-[#161B22] border-[#EF4444]/40')}
                onClick={e => e.stopPropagation()}>
                <h2 className={cn('text-2xl font-bold mb-2', lastResult.result?.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                  {lastResult.result?.won ? 'You Won!' : 'Better Luck Next Time'}
                </h2>
                {lastResult.result?.won && (
                  <div className="text-3xl font-mono font-bold text-[#10B981] mb-2">+{formatCurrency(lastResult.profit, currency)}</div>
                )}
                <div className="bg-[#0D1117] rounded-lg p-3 mb-4 space-y-1">
                  {(lastResult.result?.positions ?? []).slice(0, 4).map((horseId: number, idx: number) => {
                    const h = HORSES.find(x => x.id === horseId);
                    return (
                      <div key={horseId} className={cn('flex items-center gap-2 px-2 py-1 rounded text-sm', horseId === selectedHorse && 'bg-[#C8FF00]/10 border border-[#C8FF00]/30')}>
                        <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold', idx === 0 && 'bg-yellow-500 text-black', idx === 1 && 'bg-gray-300 text-black', idx === 2 && 'bg-amber-700 text-white', idx === 3 && 'bg-[#30363D] text-[#8B949E]')}>{idx + 1}</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h?.color }} />
                        <span className="text-white text-sm">{h?.name}</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={resetRace} className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base">Continue</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363D]"><h3 className="text-sm font-semibold text-white">Bet History</h3></div>
            <div className="divide-y divide-[#30363D]/50 max-h-[250px] overflow-y-auto">
              {history.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold', entry.won ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]')}>
                      {entry.won ? 'W' : 'L'}
                    </div>
                    <div>
                      <div className="text-sm text-white">{HORSES.find(h => h.id === entry.horse)?.name} ({entry.betType})</div>
                      <div className="text-xs text-[#8B949E] font-mono">Bet: {formatCurrency(entry.amount, currency)}</div>
                    </div>
                  </div>
                  <div className={cn('text-sm font-mono font-bold', entry.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                    {entry.won ? '+' : ''}{formatCurrency(entry.profit, currency)}
                  </div>
                </div>
              ))}
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
            {soundEnabled ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
            )}
          </button>
        </div>
        <span className="text-sm font-mono text-white">{formatCurrency(currentBalance, currency)}</span>
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 text-xs text-[#8B5CF6]">
          Provably Fair Game
        </div>
      </div>
    </div>
  );
}
