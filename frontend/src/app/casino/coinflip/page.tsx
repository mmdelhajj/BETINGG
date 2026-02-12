'use client';

import { useState, useEffect, useCallback } from 'react';
import Decimal from 'decimal.js';
import { cn } from '@/lib/utils';

// ---------- Types ----------
type CoinSide = 'heads' | 'tails';

interface CoinflipResult {
  side: CoinSide;
  won: boolean;
  payout: string;
  selectedSide: CoinSide;
  id: string;
}

// ---------- Coin Display Component ----------
function CoinDisplay({
  isFlipping,
  result,
}: {
  isFlipping: boolean;
  result: CoinflipResult | null;
}) {
  const showHeads = result ? result.side === 'heads' : true;

  return (
    <div className="relative py-8 sm:py-12 flex flex-col items-center justify-center">
      {/* Coin with flip animation */}
      <div className="perspective-500">
        <div
          className={cn(
            'w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center transition-all duration-700 relative',
            isFlipping && 'animate-coin-flip',
            !isFlipping && result
              ? result.won
                ? 'shadow-[0_0_40px_rgba(34,197,94,0.3)]'
                : 'shadow-[0_0_40px_rgba(239,68,68,0.3)]'
              : 'shadow-[0_0_20px_rgba(0,0,0,0.3)]'
          )}
        >
          {/* Coin face */}
          <div
            className={cn(
              'w-full h-full rounded-full flex flex-col items-center justify-center border-4 transition-all duration-500',
              showHeads
                ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 border-amber-300'
                : 'bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500 border-slate-200'
            )}
          >
            {/* Inner ring */}
            <div
              className={cn(
                'w-[85%] h-[85%] rounded-full border-2 flex flex-col items-center justify-center',
                showHeads ? 'border-amber-300/50' : 'border-slate-200/50'
              )}
            >
              <span
                className={cn(
                  'text-3xl sm:text-4xl font-bold',
                  showHeads ? 'text-amber-900' : 'text-slate-700'
                )}
              >
                {showHeads ? 'H' : 'T'}
              </span>
              <span
                className={cn(
                  'text-[10px] sm:text-xs font-semibold uppercase tracking-wider mt-0.5',
                  showHeads ? 'text-amber-800' : 'text-slate-600'
                )}
              >
                {showHeads ? 'Heads' : 'Tails'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Result message */}
      {result && !isFlipping && (
        <div className="mt-6 text-center animate-fade-in">
          <p
            className={cn(
              'text-lg font-bold',
              result.won ? 'text-accent-green' : 'text-accent-red'
            )}
          >
            {result.won ? `You won ${result.payout} USDT!` : 'Better luck next time!'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Coin landed on{' '}
            <span className="font-semibold capitalize">{result.side}</span>
            {' | You picked '}
            <span className="font-semibold capitalize">{result.selectedSide}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Coin Selection Card ----------
function CoinCard({
  side,
  selected,
  onClick,
  disabled,
}: {
  side: CoinSide;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const isHeads = side === 'heads';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3',
        'hover:scale-[1.02] active:scale-[0.98]',
        selected && isHeads &&
          'border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/20',
        selected && !isHeads &&
          'border-slate-400 bg-slate-500/10 shadow-lg shadow-slate-400/20',
        !selected &&
          'border-surface-tertiary bg-surface-secondary hover:border-surface-hover hover:bg-surface-tertiary',
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
      )}
    >
      {/* Mini coin icon */}
      <div
        className={cn(
          'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300',
          isHeads
            ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 border-amber-300'
            : 'bg-gradient-to-br from-slate-300 via-gray-400 to-slate-500 border-slate-200',
          selected && 'scale-110'
        )}
      >
        <span
          className={cn(
            'text-2xl sm:text-3xl font-bold',
            isHeads ? 'text-amber-900' : 'text-slate-700'
          )}
        >
          {isHeads ? 'H' : 'T'}
        </span>
      </div>
      <span
        className={cn(
          'text-sm font-semibold uppercase tracking-wider',
          selected
            ? isHeads
              ? 'text-amber-400'
              : 'text-slate-300'
            : 'text-gray-400'
        )}
      >
        {side}
      </span>
      {selected && (
        <span className="text-[10px] text-brand-400 font-medium animate-fade-in">
          Selected
        </span>
      )}
    </button>
  );
}

// ---------- Main Page Component ----------
export default function CoinflipPage() {
  const [stake, setStake] = useState('1.00');
  const [selectedSide, setSelectedSide] = useState<CoinSide>('heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [lastResult, setLastResult] = useState<CoinflipResult | null>(null);
  const [history, setHistory] = useState<CoinflipResult[]>([]);
  const [balance, setBalance] = useState('1000.00');
  const [showFairness, setShowFairness] = useState(false);
  const [stats, setStats] = useState({
    totalBets: 0,
    wins: 0,
    losses: 0,
    profit: '0.00',
  });

  const multiplier = '1.96';
  const potentialWin = new Decimal(stake || '0').mul(multiplier).toDecimalPlaces(2).toString();
  const potentialProfit = new Decimal(potentialWin).minus(new Decimal(stake || '0')).toFixed(2);

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

  const handleFlip = useCallback(() => {
    if (isFlipping) return;

    const currentStake = new Decimal(stake || '0');
    if (currentStake.lte(0) || currentStake.gt(new Decimal(balance))) return;

    setIsFlipping(true);
    setLastResult(null);

    // Deduct balance immediately
    setBalance((prev) => new Decimal(prev).minus(currentStake).toFixed(2));

    // Simulate the coin flip after animation
    setTimeout(() => {
      const resultSide: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = resultSide === selectedSide;
      const payout = won
        ? currentStake.mul(multiplier).toDecimalPlaces(2).toString()
        : '0.00';

      const result: CoinflipResult = {
        side: resultSide,
        won,
        payout,
        selectedSide,
        id: Date.now().toString(),
      };

      if (won) {
        setBalance((prev) => new Decimal(prev).plus(new Decimal(payout)).toFixed(2));
      }

      setLastResult(result);
      setHistory((prev) => [result, ...prev.slice(0, 19)]);
      setIsFlipping(false);
    }, 1200);
  }, [stake, selectedSide, isFlipping, balance, multiplier]);

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Coinflip</h1>
        <button
          onClick={() => setShowFairness(!showFairness)}
          className="px-2 py-1 rounded-lg bg-surface-tertiary hover:bg-surface-hover text-xs text-gray-400 transition-colors"
        >
          Provably Fair
        </button>
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
            <p className="text-gray-400">
              Each coin flip uses a combination of a server seed, client seed, and nonce to
              generate a provably fair result. The outcome is determined before the flip and
              can be verified after the game.
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
        {/* Main game area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Game Card */}
          <div className="card">
            {/* Balance display */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Balance</span>
              <span className="text-sm font-mono font-bold text-white">{balance} USDT</span>
            </div>

            {/* Coin Display */}
            <CoinDisplay isFlipping={isFlipping} result={lastResult} />

            {/* Coin Selection */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-3 text-center font-medium uppercase tracking-wider">
                Pick Your Side
              </p>
              <div className="flex gap-3">
                <CoinCard
                  side="heads"
                  selected={selectedSide === 'heads'}
                  onClick={() => setSelectedSide('heads')}
                  disabled={isFlipping}
                />
                <CoinCard
                  side="tails"
                  selected={selectedSide === 'tails'}
                  onClick={() => setSelectedSide('tails')}
                  disabled={isFlipping}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  Win Chance
                </p>
                <p className="font-bold font-mono text-sm">50.00%</p>
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
                  +{potentialProfit}
                </p>
              </div>
              <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  House Edge
                </p>
                <p className="font-bold font-mono text-sm text-gray-300">2.00%</p>
              </div>
            </div>
          </div>

          {/* Bet History */}
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
                      <th className="text-left py-2 font-medium">Pick</th>
                      <th className="text-center py-2 font-medium">Result</th>
                      <th className="text-center py-2 font-medium">Outcome</th>
                      <th className="text-right py-2 font-medium">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr
                        key={h.id || i}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-semibold capitalize',
                              h.selectedSide === 'heads'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-500/20 text-slate-300'
                            )}
                          >
                            {h.selectedSide}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-semibold capitalize',
                              h.side === 'heads'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-500/20 text-slate-300'
                            )}
                          >
                            {h.side}
                          </span>
                        </td>
                        <td className="py-2 text-center">
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

        {/* Controls Panel */}
        <div className="space-y-4">
          <div className="card space-y-4">
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
                disabled={isFlipping}
              />
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {['1', '5', '10', '25'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setStake(v)}
                    className="btn-secondary text-xs py-1.5"
                    disabled={isFlipping}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                <button
                  onClick={() => setStake('0.01')}
                  className="btn-secondary text-xs py-1.5"
                  disabled={isFlipping}
                >
                  Min
                </button>
                <button
                  onClick={() => {
                    const val = new Decimal(stake || '0').div(2);
                    setStake(val.gt(0.01) ? val.toFixed(2) : '0.01');
                  }}
                  className="btn-secondary text-xs py-1.5"
                  disabled={isFlipping}
                >
                  1/2
                </button>
                <button
                  onClick={() =>
                    setStake(
                      Decimal.min(
                        new Decimal(stake || '0').mul(2),
                        new Decimal(balance)
                      ).toFixed(2)
                    )
                  }
                  className="btn-secondary text-xs py-1.5"
                  disabled={isFlipping}
                >
                  2x
                </button>
                <button
                  onClick={() => setStake(balance)}
                  className="btn-secondary text-xs py-1.5"
                  disabled={isFlipping}
                >
                  Max
                </button>
              </div>
            </div>

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

            {/* Flip button */}
            <button
              onClick={handleFlip}
              disabled={isFlipping || new Decimal(stake || '0').lte(0) || new Decimal(stake || '0').gt(new Decimal(balance))}
              className={cn(
                'btn-accent w-full py-3 font-semibold text-base',
                isFlipping && 'opacity-75 cursor-wait'
              )}
            >
              {isFlipping ? (
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
                  Flipping...
                </span>
              ) : (
                `Flip ${selectedSide === 'heads' ? 'Heads' : 'Tails'}`
              )}
            </button>
          </div>

          {/* Session Stats */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Session Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total Bets</span>
                <span className="text-gray-300 font-mono font-bold">{stats.totalBets}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Wins</span>
                <span className="text-accent-green font-mono font-bold">{stats.wins}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Losses</span>
                <span className="text-accent-red font-mono font-bold">{stats.losses}</span>
              </div>
              <div className="w-full bg-surface-hover rounded-full h-1.5">
                <div
                  className="bg-accent-green h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-border">
                <span className="text-gray-400">Profit / Loss</span>
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

          {/* Recent Results Strip */}
          {history.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Recent Flips</h3>
              <div className="flex gap-1.5 flex-wrap">
                {history.map((h, i) => (
                  <span
                    key={h.id || i}
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border',
                      h.won
                        ? h.side === 'heads'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-slate-500/20 text-slate-300 border-slate-400/30'
                        : 'bg-accent-red/10 text-accent-red border-accent-red/20'
                    )}
                    title={`${h.side} - ${h.won ? 'Win' : 'Loss'}`}
                  >
                    {h.side === 'heads' ? 'H' : 'T'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for coin flip animation */}
      <style jsx>{`
        .perspective-500 {
          perspective: 500px;
        }

        @keyframes coin-flip {
          0% {
            transform: rotateY(0deg) scale(1);
          }
          25% {
            transform: rotateY(540deg) scale(1.1);
          }
          50% {
            transform: rotateY(1080deg) scale(1.15);
          }
          75% {
            transform: rotateY(1440deg) scale(1.1);
          }
          100% {
            transform: rotateY(1800deg) scale(1);
          }
        }

        .animate-coin-flip {
          animation: coin-flip 1.2s cubic-bezier(0.35, 0.05, 0.25, 1) forwards;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
