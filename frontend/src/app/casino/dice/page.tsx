'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import Decimal from 'decimal.js';
import { cn } from '@/lib/utils';

interface DiceResult {
  roll: number;
  won: boolean;
  payout: string;
  target: number;
  isOver: boolean;
  id?: string;
}

interface AutoBetConfig {
  enabled: boolean;
  numberOfBets: number;
  betsPlaced: number;
  onWin: 'reset' | 'increase';
  onWinPercent: string;
  onLoss: 'reset' | 'increase';
  onLossPercent: string;
  stopOnProfit: string;
  stopOnLoss: string;
  baseStake: string;
}

// ---------- Animated Dice Display ----------
function DiceDisplay({
  result,
  isRolling,
}: {
  result: DiceResult | null;
  isRolling: boolean;
}) {
  const [displayValue, setDisplayValue] = useState<string>('--');
  const animFrameRef = useRef<number>(0);
  const rollCountRef = useRef(0);

  useEffect(() => {
    if (isRolling) {
      rollCountRef.current = 0;
      const animate = () => {
        rollCountRef.current++;
        // Speed decreases over time for a natural feel
        const speed = Math.min(rollCountRef.current * 2, 50);
        setDisplayValue((Math.random() * 100).toFixed(2));
        if (rollCountRef.current < 30) {
          animFrameRef.current = window.setTimeout(
            () => requestAnimationFrame(animate),
            speed
          ) as unknown as number;
        }
      };
      requestAnimationFrame(animate);
      return () => {
        clearTimeout(animFrameRef.current);
      };
    } else if (result) {
      setDisplayValue(result.roll.toFixed(2));
    }
  }, [isRolling, result]);

  return (
    <div className="relative py-8 sm:py-12 flex flex-col items-center justify-center">
      {/* Decorative ring */}
      <div
        className={cn(
          'w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 flex items-center justify-center transition-all duration-500',
          isRolling
            ? 'border-brand-400 shadow-lg shadow-brand-400/30 animate-pulse'
            : result
              ? result.won
                ? 'border-accent-green shadow-lg shadow-accent-green/30'
                : 'border-accent-red shadow-lg shadow-accent-red/30'
              : 'border-surface-tertiary'
        )}
      >
        <div className="text-center">
          <p
            className={cn(
              'text-4xl sm:text-5xl font-bold font-mono transition-all duration-300',
              isRolling
                ? 'text-brand-400 scale-110'
                : result
                  ? result.won
                    ? 'text-accent-green'
                    : 'text-accent-red'
                  : 'text-gray-500'
            )}
          >
            {displayValue}
          </p>
        </div>
      </div>

      {/* Result message */}
      {result && !isRolling && (
        <div className="mt-4 text-center animate-fade-in">
          <p
            className={cn(
              'text-sm font-semibold',
              result.won ? 'text-accent-green' : 'text-accent-red'
            )}
          >
            {result.won ? `Won ${result.payout} USDT` : 'Better luck next time'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Rolled {result.roll.toFixed(2)} | Target: {result.isOver ? 'Over' : 'Under'}{' '}
            {result.target}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Interactive Visual Slider ----------
function DiceSlider({
  target,
  isOver,
  onChange,
  lastRoll,
}: {
  target: number;
  isOver: boolean;
  onChange: (value: number) => void;
  lastRoll: number | null;
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handlePointerEvent = useCallback(
    (clientX: number) => {
      const el = sliderRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const value = Math.round(2 + pct * 96); // 2-98 range
      onChange(Math.max(2, Math.min(98, value)));
    },
    [onChange]
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (isDragging.current) {
        handlePointerEvent(e.clientX);
      }
    };
    const handleUp = () => {
      isDragging.current = false;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [handlePointerEvent]);

  const winChance = isOver ? 100 - target : target;
  const thumbPosition = ((target - 2) / 96) * 100;

  return (
    <div className="space-y-2 select-none">
      <div
        ref={sliderRef}
        className="relative h-12 cursor-pointer touch-none"
        onPointerDown={(e) => {
          isDragging.current = true;
          handlePointerEvent(e.clientX);
        }}
      >
        {/* Background bar */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full overflow-hidden bg-surface-tertiary">
          {/* Winning zone */}
          {isOver ? (
            <div
              className="absolute top-0 right-0 h-full bg-accent-green/40 transition-all duration-150"
              style={{ width: `${100 - target}%` }}
            />
          ) : (
            <div
              className="absolute top-0 left-0 h-full bg-accent-green/40 transition-all duration-150"
              style={{ width: `${target}%` }}
            />
          )}
          {/* Losing zone */}
          {isOver ? (
            <div
              className="absolute top-0 left-0 h-full bg-accent-red/30 transition-all duration-150"
              style={{ width: `${target}%` }}
            />
          ) : (
            <div
              className="absolute top-0 right-0 h-full bg-accent-red/30 transition-all duration-150"
              style={{ width: `${100 - target}%` }}
            />
          )}
        </div>

        {/* Last roll marker */}
        {lastRoll !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-7 bg-brand-400 rounded-full z-10 transition-all duration-500"
            style={{ left: `${((lastRoll - 2) / 96) * 100}%` }}
          />
        )}

        {/* Draggable thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-100"
          style={{ left: `${thumbPosition}%` }}
        >
          <div className="w-7 h-7 rounded-full bg-white shadow-lg border-2 border-brand-500 cursor-grab active:cursor-grabbing flex items-center justify-center">
            <span className="text-[8px] font-bold text-brand-500">{target}</span>
          </div>
        </div>
      </div>

      {/* Scale markers */}
      <div className="flex justify-between text-xs text-gray-600 px-1">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>

      {/* Win chance indicator */}
      <div className="flex justify-between items-center text-xs px-1">
        <span className="text-gray-400">
          Win Chance: <span className="text-white font-mono font-bold">{winChance.toFixed(2)}%</span>
        </span>
        <span className="text-gray-400">
          Multiplier:{' '}
          <span className="text-brand-400 font-mono font-bold">
            {new Decimal(99).div(winChance).toDecimalPlaces(4).toString()}x
          </span>
        </span>
      </div>
    </div>
  );
}

// ---------- Main Page Component ----------
export default function DicePage() {
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [stake, setStake] = useState('1.00');
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const [history, setHistory] = useState<DiceResult[]>([]);
  const [stats, setStats] = useState({
    totalBets: 0,
    wins: 0,
    losses: 0,
    profit: '0.00',
  });
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
  const [showSeeds, setShowSeeds] = useState(false);

  // Auto-bet state
  const [autoBet, setAutoBet] = useState<AutoBetConfig>({
    enabled: false,
    numberOfBets: 10,
    betsPlaced: 0,
    onWin: 'reset',
    onWinPercent: '100',
    onLoss: 'reset',
    onLossPercent: '100',
    stopOnProfit: '',
    stopOnLoss: '',
    baseStake: '1.00',
  });
  const autoBetRef = useRef(autoBet);
  autoBetRef.current = autoBet;
  const autoStakeRef = useRef(stake);

  const winChance = isOver ? 100 - target : target;
  const multiplier = new Decimal(99).div(winChance).toDecimalPlaces(4).toString();
  const potentialWin = new Decimal(stake || '0')
    .mul(multiplier)
    .toDecimalPlaces(2)
    .toString();
  const potentialProfit = new Decimal(potentialWin)
    .minus(new Decimal(stake || '0'))
    .toFixed(2);
  const houseEdge = '1.00';

  // Update stats from history
  useEffect(() => {
    const wins = history.filter((h) => h.won).length;
    const losses = history.length - wins;
    let profit = new Decimal(0);
    for (const h of history) {
      if (h.won) {
        profit = profit.plus(new Decimal(h.payout).minus(new Decimal(stake || '0')));
      } else {
        profit = profit.minus(new Decimal(stake || '0'));
      }
    }
    setStats({
      totalBets: history.length,
      wins,
      losses,
      profit: profit.toFixed(2),
    });
  }, [history, stake]);

  const handleRoll = useCallback(async () => {
    setIsRolling(true);
    try {
      const { data } = await api.post('/casino/dice/play', {
        currency: 'USDT',
        stake: autoStakeRef.current || stake,
        target,
        isOver,
      });
      // Simulate brief animation delay
      await new Promise((resolve) => setTimeout(resolve, 600));
      const result: DiceResult = {
        ...data.data,
        id: Date.now().toString(),
      };
      setLastResult(result);
      setHistory((prev) => [result, ...prev.slice(0, 49)]);

      // Auto-bet: adjust stake
      if (autoBetRef.current.enabled) {
        const ab = autoBetRef.current;
        let newStake = new Decimal(ab.baseStake);
        const currentStake = new Decimal(autoStakeRef.current || ab.baseStake);

        if (result.won) {
          if (ab.onWin === 'increase') {
            newStake = currentStake.mul(
              new Decimal(1).plus(new Decimal(ab.onWinPercent).div(100))
            );
          }
        } else {
          if (ab.onLoss === 'increase') {
            newStake = currentStake.mul(
              new Decimal(1).plus(new Decimal(ab.onLossPercent).div(100))
            );
          }
        }

        const stakeStr = newStake.toFixed(2);
        autoStakeRef.current = stakeStr;
        setStake(stakeStr);

        setAutoBet((prev) => ({
          ...prev,
          betsPlaced: prev.betsPlaced + 1,
        }));
      }
    } catch (err) {
      console.error('Roll failed:', err);
    } finally {
      setIsRolling(false);
    }
  }, [stake, target, isOver]);

  // Auto-bet loop
  useEffect(() => {
    if (!autoBet.enabled || isRolling) return;
    const ab = autoBetRef.current;

    // Check stop conditions
    if (ab.betsPlaced >= ab.numberOfBets) {
      setAutoBet((prev) => ({ ...prev, enabled: false }));
      return;
    }
    if (
      ab.stopOnProfit &&
      parseFloat(stats.profit) >= parseFloat(ab.stopOnProfit)
    ) {
      setAutoBet((prev) => ({ ...prev, enabled: false }));
      return;
    }
    if (
      ab.stopOnLoss &&
      parseFloat(stats.profit) <= -parseFloat(ab.stopOnLoss)
    ) {
      setAutoBet((prev) => ({ ...prev, enabled: false }));
      return;
    }

    const timer = setTimeout(() => {
      handleRoll();
    }, 200);
    return () => clearTimeout(timer);
  }, [autoBet.enabled, autoBet.betsPlaced, isRolling, handleRoll, stats.profit]);

  const toggleAutoBet = () => {
    if (!autoBet.enabled) {
      autoStakeRef.current = stake;
      setAutoBet((prev) => ({
        ...prev,
        enabled: true,
        betsPlaced: 0,
        baseStake: stake,
      }));
    } else {
      setAutoBet((prev) => ({ ...prev, enabled: false }));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Dice</h1>
        <button
          onClick={() => setShowSeeds(!showSeeds)}
          className="px-2 py-1 rounded-lg bg-surface-tertiary hover:bg-surface-hover text-xs text-gray-400 transition-colors"
        >
          Provably Fair
        </button>
      </div>

      {/* Provably Fair Seeds */}
      {showSeeds && (
        <div className="card mb-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Provably Fair Seeds</h3>
            <button
              onClick={() => setShowSeeds(false)}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <p className="text-gray-400">
              Each dice roll uses a combination of a server seed, client seed, and nonce to generate
              a provably fair result. You can verify any roll after it has been played.
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main game area - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Game Card */}
          <div className="card">
            {/* Dice Display with Animation */}
            <DiceDisplay result={lastResult} isRolling={isRolling} />

            {/* Slider */}
            <div className="px-2 pb-4">
              <DiceSlider
                target={target}
                isOver={isOver}
                onChange={setTarget}
                lastRoll={lastResult ? lastResult.roll : null}
              />
            </div>

            {/* Over/Under Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setIsOver(false)}
                className={cn(
                  'flex-1 py-3 rounded-lg text-sm font-semibold transition-all',
                  !isOver
                    ? 'bg-accent-green text-white shadow-lg shadow-accent-green/20'
                    : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
                )}
              >
                Roll Under {target}
              </button>
              <button
                onClick={() => setIsOver(true)}
                className={cn(
                  'flex-1 py-3 rounded-lg text-sm font-semibold transition-all',
                  isOver
                    ? 'bg-accent-green text-white shadow-lg shadow-accent-green/20'
                    : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
                )}
              >
                Roll Over {target}
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  Win Chance
                </p>
                <p className="font-bold font-mono text-sm">{winChance.toFixed(2)}%</p>
              </div>
              <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  Multiplier
                </p>
                <p className="font-bold font-mono text-sm text-brand-400">
                  {multiplier}x
                </p>
              </div>
              <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  Profit
                </p>
                <p className="font-bold font-mono text-sm text-accent-green">
                  {potentialProfit}
                </p>
              </div>
              <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  House Edge
                </p>
                <p className="font-bold font-mono text-sm text-gray-300">
                  {houseEdge}%
                </p>
              </div>
            </div>
          </div>

          {/* Bet History Table */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Bet History ({history.length})
            </h3>
            {history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm">No bets placed yet</p>
                <p className="text-gray-700 text-xs mt-1">
                  Your betting history will appear here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-secondary">
                    <tr className="text-xs text-gray-500 border-b border-border">
                      <th className="text-left py-2 font-medium">Roll</th>
                      <th className="text-center py-2 font-medium">Target</th>
                      <th className="text-center py-2 font-medium">Direction</th>
                      <th className="text-right py-2 font-medium">Result</th>
                      <th className="text-right py-2 font-medium">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 20).map((h, i) => (
                      <tr
                        key={h.id || i}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2 font-mono font-bold">
                          <span
                            className={
                              h.won ? 'text-accent-green' : 'text-accent-red'
                            }
                          >
                            {h.roll.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 text-center font-mono text-gray-400">
                          {h.target}
                        </td>
                        <td className="py-2 text-center">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              h.isOver
                                ? 'bg-brand-500/20 text-brand-400'
                                : 'bg-purple-500/20 text-purple-400'
                            )}
                          >
                            {h.isOver ? 'Over' : 'Under'}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-bold',
                              h.won
                                ? 'bg-accent-green/20 text-accent-green'
                                : 'bg-accent-red/20 text-accent-red'
                            )}
                          >
                            {h.won ? 'WIN' : 'LOSS'}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono">
                          {h.won ? (
                            <span className="text-accent-green">+{h.payout}</span>
                          ) : (
                            <span className="text-accent-red">-{stake}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Controls Panel - 1 column */}
        <div className="space-y-4">
          {/* Manual / Auto tabs */}
          <div className="card space-y-4">
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

            {/* Bet Amount */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Bet Amount (USDT)
              </label>
              <input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="input"
                placeholder="Stake"
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

            {/* Target input */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Target Number
              </label>
              <input
                type="number"
                value={target}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (v >= 2 && v <= 98) setTarget(v);
                }}
                className="input"
                min={2}
                max={98}
              />
            </div>

            {/* Manual-only content */}
            {activeTab === 'manual' && (
              <>
                {/* Payout info */}
                <div className="bg-surface-tertiary rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Potential Win</span>
                    <span className="text-white font-mono font-bold">
                      {potentialWin} USDT
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Potential Profit</span>
                    <span className="text-accent-green font-mono font-bold">
                      +{potentialProfit} USDT
                    </span>
                  </div>
                </div>

                {/* Roll button */}
                <button
                  onClick={handleRoll}
                  disabled={isRolling}
                  className={cn(
                    'btn-accent w-full py-3 font-semibold text-base',
                    isRolling && 'opacity-75 cursor-wait'
                  )}
                >
                  {isRolling ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Rolling...
                    </span>
                  ) : (
                    `Roll ${isOver ? 'Over' : 'Under'} ${target}`
                  )}
                </button>
              </>
            )}

            {/* Auto-bet content */}
            {activeTab === 'auto' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Number of Bets
                  </label>
                  <input
                    type="number"
                    value={autoBet.numberOfBets}
                    onChange={(e) =>
                      setAutoBet((prev) => ({
                        ...prev,
                        numberOfBets: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="input"
                    min={1}
                    max={1000}
                  />
                </div>

                {/* On Win */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    On Win
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setAutoBet((prev) => ({ ...prev, onWin: 'reset' }))
                      }
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                        autoBet.onWin === 'reset'
                          ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                          : 'bg-surface-tertiary text-gray-400'
                      )}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() =>
                        setAutoBet((prev) => ({ ...prev, onWin: 'increase' }))
                      }
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                        autoBet.onWin === 'increase'
                          ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                          : 'bg-surface-tertiary text-gray-400'
                      )}
                    >
                      Increase by
                    </button>
                  </div>
                  {autoBet.onWin === 'increase' && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <input
                        type="number"
                        value={autoBet.onWinPercent}
                        onChange={(e) =>
                          setAutoBet((prev) => ({
                            ...prev,
                            onWinPercent: e.target.value,
                          }))
                        }
                        className="input text-xs"
                        min={1}
                        max={1000}
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  )}
                </div>

                {/* On Loss */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    On Loss
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setAutoBet((prev) => ({ ...prev, onLoss: 'reset' }))
                      }
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                        autoBet.onLoss === 'reset'
                          ? 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                          : 'bg-surface-tertiary text-gray-400'
                      )}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() =>
                        setAutoBet((prev) => ({ ...prev, onLoss: 'increase' }))
                      }
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                        autoBet.onLoss === 'increase'
                          ? 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                          : 'bg-surface-tertiary text-gray-400'
                      )}
                    >
                      Increase by
                    </button>
                  </div>
                  {autoBet.onLoss === 'increase' && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <input
                        type="number"
                        value={autoBet.onLossPercent}
                        onChange={(e) =>
                          setAutoBet((prev) => ({
                            ...prev,
                            onLossPercent: e.target.value,
                          }))
                        }
                        className="input text-xs"
                        min={1}
                        max={1000}
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  )}
                </div>

                {/* Stop conditions */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 block font-medium">
                      Stop Profit
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
                      placeholder="None"
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 block font-medium">
                      Stop Loss
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
                      placeholder="None"
                      className="input text-xs"
                    />
                  </div>
                </div>

                {/* Auto-bet progress */}
                {autoBet.enabled && (
                  <div className="bg-surface-tertiary rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-gray-300 font-mono">
                        {autoBet.betsPlaced}/{autoBet.numberOfBets}
                      </span>
                    </div>
                    <div className="w-full bg-surface-hover rounded-full h-1.5">
                      <div
                        className="bg-brand-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(autoBet.betsPlaced / autoBet.numberOfBets) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Toggle auto-bet */}
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
              </div>
            )}
          </div>

          {/* Session Stats */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Session Stats
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total Bets</span>
                <span className="text-gray-300 font-mono">{stats.totalBets}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Wins</span>
                <span className="text-accent-green font-mono">{stats.wins}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Losses</span>
                <span className="text-accent-red font-mono">{stats.losses}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Win Rate</span>
                <span className="text-gray-300 font-mono">
                  {stats.totalBets > 0
                    ? ((stats.wins / stats.totalBets) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Net Profit</span>
                <span
                  className={cn(
                    'font-mono font-bold',
                    parseFloat(stats.profit) >= 0
                      ? 'text-accent-green'
                      : 'text-accent-red'
                  )}
                >
                  {parseFloat(stats.profit) >= 0 ? '+' : ''}
                  {stats.profit} USDT
                </span>
              </div>
            </div>
          </div>

          {/* Recent Rolls compact view */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Recent Rolls
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {history.slice(0, 20).map((h, i) => (
                <span
                  key={h.id || i}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-mono font-bold',
                    h.won
                      ? 'bg-accent-green/20 text-accent-green'
                      : 'bg-accent-red/20 text-accent-red'
                  )}
                >
                  {h.roll.toFixed(2)}
                </span>
              ))}
              {history.length === 0 && (
                <p className="text-gray-600 text-xs">No rolls yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
