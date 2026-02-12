'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Decimal from 'decimal.js';

type GamePhase = 'betting' | 'playing' | 'won' | 'lost';

interface TileState {
  revealed: boolean;
  mine: boolean;
  animating: boolean;
}

// ---------- Multiplier Calculator ----------
function calculateMultiplier(mineCount: number, revealed: number): string {
  // Provably fair multiplier based on mines and revealed tiles
  // multiplier = (25! / (25 - revealed)!) / ((25 - mines)! / (25 - mines - revealed)!) * (1 - houseEdge)
  const total = 25;
  const safe = total - mineCount;
  const houseEdge = 0.02;

  if (revealed === 0) return '1.00';
  if (revealed >= safe) return '25.00'; // max

  let mult = 1;
  for (let i = 0; i < revealed; i++) {
    mult *= (total - i) / (safe - i);
  }
  mult *= 1 - houseEdge;
  return Math.max(1, mult).toFixed(2);
}

// ---------- Tile Component ----------
function Tile({
  tile,
  index,
  onClick,
  disabled,
  gamePhase,
}: {
  tile: TileState;
  index: number;
  onClick: () => void;
  disabled: boolean;
  gamePhase: GamePhase;
}) {
  const isRevealed = tile.revealed;
  const isMine = tile.mine;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-300 font-bold relative overflow-hidden',
        // Revealed mine
        isRevealed && isMine &&
          'bg-accent-red/20 border-2 border-accent-red shadow-lg shadow-accent-red/20',
        // Revealed safe (gem)
        isRevealed && !isMine &&
          'bg-accent-green/20 border-2 border-accent-green shadow-lg shadow-accent-green/20',
        // Unrevealed during play
        !isRevealed && gamePhase === 'playing' &&
          'bg-surface-tertiary hover:bg-surface-hover hover:scale-105 cursor-pointer border-2 border-transparent hover:border-brand-500/50 active:scale-95',
        // Unrevealed not during play
        !isRevealed && gamePhase !== 'playing' &&
          'bg-surface-tertiary border-2 border-transparent',
        // Animating reveal
        tile.animating && 'animate-flip scale-110'
      )}
      aria-label={`Tile ${index + 1}`}
    >
      {isRevealed ? (
        isMine ? (
          <div className="flex flex-col items-center">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-accent-red" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.3" />
              <circle cx="12" cy="12" r="5" fill="currentColor" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        ) : (
          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-accent-green" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L8 8H2l4.5 5.5L4 22l8-4 8 4-2.5-8.5L22 8h-6L12 2z" />
          </svg>
        )
      ) : (
        gamePhase === 'playing' && (
          <div className="w-4 h-4 rounded-full bg-surface-hover/50" />
        )
      )}
    </button>
  );
}

// ---------- Main Page Component ----------
export default function MinesPage() {
  const [stake, setStake] = useState('1.00');
  const [mineCount, setMineCount] = useState(5);
  const [gamePhase, setGamePhase] = useState<GamePhase>('betting');
  const [tiles, setTiles] = useState<TileState[]>(
    Array(25).fill(null).map(() => ({ revealed: false, mine: false, animating: false }))
  );
  const [currentMultiplier, setCurrentMultiplier] = useState('1.00');
  const [revealedCount, setRevealedCount] = useState(0);
  const [_minePositions, setMinePositions] = useState<number[]>([]);
  const [history, setHistory] = useState<Array<{ won: boolean; multiplier: string; profit: string }>>([]);
  const [nextMultiplier, setNextMultiplier] = useState('1.00');

  // Calculate next multiplier preview
  const _previewNextMultiplier = useCallback(
    (count: number) => {
      return calculateMultiplier(mineCount, count + 1);
    },
    [mineCount]
  );

  const currentWinnings = new Decimal(stake || '0')
    .mul(new Decimal(currentMultiplier))
    .toFixed(2);
  const currentProfit = new Decimal(currentWinnings)
    .minus(new Decimal(stake || '0'))
    .toFixed(2);

  const startGame = async () => {
    try {
      await api.post('/casino/mines/start', {
        currency: 'USDT',
        stake,
        mineCount,
      });
      setGamePhase('playing');
      setTiles(
        Array(25).fill(null).map(() => ({ revealed: false, mine: false, animating: false }))
      );
      setCurrentMultiplier('1.00');
      setRevealedCount(0);
      setMinePositions([]);
      setNextMultiplier(calculateMultiplier(mineCount, 1));
    } catch (err) {
      console.error('Failed to start:', err);
    }
  };

  const revealTile = async (position: number) => {
    if (gamePhase !== 'playing' || tiles[position].revealed) return;

    try {
      const { data } = await api.post('/casino/mines/reveal', { position });
      const result = data.data;

      const newTiles = tiles.map((t) => ({ ...t, animating: false }));
      newTiles[position] = { revealed: true, mine: result.mine, animating: true };

      if (result.gameOver && result.minePositions) {
        // Show all mines with staggered animation
        result.minePositions.forEach((pos: number, idx: number) => {
          setTimeout(() => {
            setTiles((prev) => {
              const updated = [...prev];
              updated[pos] = { revealed: true, mine: true, animating: true };
              return updated;
            });
          }, idx * 80);
        });
        setMinePositions(result.minePositions);

        if (result.mine) {
          setGamePhase('lost');
          setHistory((prev) => [
            { won: false, multiplier: currentMultiplier, profit: `-${stake}` },
            ...prev.slice(0, 19),
          ]);
        } else {
          setGamePhase('won');
          setHistory((prev) => [
            { won: true, multiplier: result.currentMultiplier || currentMultiplier, profit: currentProfit },
            ...prev.slice(0, 19),
          ]);
        }
      } else {
        const newCount = revealedCount + 1;
        setRevealedCount(newCount);
        setCurrentMultiplier(result.currentMultiplier || calculateMultiplier(mineCount, newCount));
        setNextMultiplier(calculateMultiplier(mineCount, newCount + 1));
      }

      setTiles(newTiles);
    } catch (err) {
      console.error('Failed to reveal:', err);
    }
  };

  const handleAutoPick = async () => {
    // Pick a random unrevealed tile
    const unrevealed = tiles
      .map((t, i) => (!t.revealed ? i : -1))
      .filter((i) => i >= 0);
    if (unrevealed.length === 0) return;
    const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    await revealTile(randomIndex);
  };

  const cashout = async () => {
    try {
      const { data } = await api.post('/casino/mines/cashout');
      const result = data.data;
      setGamePhase('won');

      // Reveal mines
      if (result.minePositions) {
        const _newTiles = tiles.map((t) => ({ ...t }));
        result.minePositions.forEach((pos: number, idx: number) => {
          setTimeout(() => {
            setTiles((prev) => {
              const updated = [...prev];
              updated[pos] = { revealed: true, mine: true, animating: true };
              return updated;
            });
          }, idx * 60);
        });
        setMinePositions(result.minePositions);
      }

      setHistory((prev) => [
        { won: true, multiplier: currentMultiplier, profit: currentProfit },
        ...prev.slice(0, 19),
      ]);
    } catch (err) {
      console.error('Cashout failed:', err);
    }
  };

  const safeTiles = 25 - mineCount;

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Mines</h1>
        <a
          href="/casino/verify"
          className="px-2 py-1 rounded-lg bg-surface-tertiary hover:bg-surface-hover text-xs text-gray-400 transition-colors"
        >
          Provably Fair
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Grid */}
        <div className="md:col-span-2 space-y-3">
          <div className="card p-3 sm:p-4">
            {/* Multiplier & Winnings Bar (during play) */}
            {gamePhase === 'playing' && revealedCount > 0 && (
              <div className="flex items-center justify-between mb-3 bg-surface-tertiary rounded-lg p-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Current
                  </p>
                  <p className="text-lg font-bold font-mono text-accent-green">
                    {currentMultiplier}x
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Winnings
                  </p>
                  <p className="text-lg font-bold font-mono text-accent-green">
                    {currentWinnings} USDT
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Next
                  </p>
                  <p className="text-lg font-bold font-mono text-brand-400">
                    {nextMultiplier}x
                  </p>
                </div>
              </div>
            )}

            {/* 5x5 Grid */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {tiles.map((tile, i) => (
                <Tile
                  key={i}
                  tile={tile}
                  index={i}
                  onClick={() => revealTile(i)}
                  disabled={gamePhase !== 'playing' || tile.revealed}
                  gamePhase={gamePhase}
                />
              ))}
            </div>

            {/* Playing actions */}
            {gamePhase === 'playing' && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAutoPick}
                  className="flex-1 btn-secondary py-2.5 text-sm font-medium"
                >
                  Random Pick
                </button>
                <button
                  onClick={cashout}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-bold transition-all',
                    revealedCount > 0
                      ? 'bg-accent-green text-white shadow-lg shadow-accent-green/20 hover:bg-accent-green/90'
                      : 'bg-surface-tertiary text-gray-500 cursor-not-allowed'
                  )}
                  disabled={revealedCount === 0}
                >
                  Cash Out {revealedCount > 0 ? `(${currentWinnings} USDT)` : ''}
                </button>
              </div>
            )}
          </div>

          {/* Game history strip */}
          {history.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Recent Games</h3>
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
            {gamePhase === 'betting' && (
              <>
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

                {/* Mine Count */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-400 font-medium">Mines</label>
                    <span className="text-xs font-mono text-brand-400 font-bold">
                      {mineCount}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    value={mineCount}
                    onChange={(e) => setMineCount(parseInt(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>1 mine</span>
                    <span>24 mines</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[1, 3, 5, 10].map((v) => (
                      <button
                        key={v}
                        onClick={() => setMineCount(v)}
                        className={cn(
                          'py-1.5 rounded-lg text-xs font-medium transition-colors',
                          mineCount === v
                            ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                            : 'btn-secondary'
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game Info */}
                <div className="bg-surface-tertiary rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Safe Tiles</span>
                    <span className="text-gray-300 font-mono">{safeTiles}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Max Multiplier</span>
                    <span className="text-brand-400 font-mono font-bold">
                      {calculateMultiplier(mineCount, safeTiles)}x
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">First Pick Mult.</span>
                    <span className="text-gray-300 font-mono">
                      {calculateMultiplier(mineCount, 1)}x
                    </span>
                  </div>
                </div>

                {/* Start */}
                <button
                  onClick={startGame}
                  className="btn-accent w-full py-3 font-semibold text-base"
                >
                  Start Game
                </button>
              </>
            )}

            {gamePhase === 'playing' && (
              <>
                {/* Current Game Info */}
                <div className="text-center space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Current Multiplier
                    </p>
                    <p className="text-4xl font-bold font-mono text-accent-green">
                      {currentMultiplier}x
                    </p>
                  </div>

                  <div className="bg-surface-tertiary rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Stake</span>
                      <span className="text-gray-300 font-mono">{stake} USDT</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Revealed</span>
                      <span className="text-gray-300 font-mono">
                        {revealedCount}/{safeTiles}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Winnings</span>
                      <span className="text-accent-green font-mono font-bold">
                        {currentWinnings} USDT
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Profit</span>
                      <span
                        className={cn(
                          'font-mono font-bold',
                          parseFloat(currentProfit) >= 0
                            ? 'text-accent-green'
                            : 'text-accent-red'
                        )}
                      >
                        {parseFloat(currentProfit) >= 0 ? '+' : ''}
                        {currentProfit} USDT
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Progress</span>
                    <span className="font-mono">
                      {revealedCount}/{safeTiles}
                    </span>
                  </div>
                  <div className="w-full bg-surface-hover rounded-full h-2">
                    <div
                      className="bg-accent-green h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(revealedCount / safeTiles) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Cash Out */}
                <button
                  onClick={cashout}
                  disabled={revealedCount === 0}
                  className={cn(
                    'w-full py-3 rounded-lg font-bold text-base transition-all',
                    revealedCount > 0
                      ? 'bg-accent-green text-white shadow-lg shadow-accent-green/20 hover:bg-accent-green/90 animate-pulse'
                      : 'bg-surface-tertiary text-gray-500 cursor-not-allowed'
                  )}
                >
                  {revealedCount > 0
                    ? `Cash Out ${currentWinnings} USDT`
                    : 'Reveal a tile first'}
                </button>
              </>
            )}

            {/* Won / Lost States */}
            {(gamePhase === 'won' || gamePhase === 'lost') && (
              <>
                <div
                  className={cn(
                    'text-center p-4 rounded-lg',
                    gamePhase === 'won' ? 'bg-accent-green/10' : 'bg-accent-red/10'
                  )}
                >
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      gamePhase === 'won' ? 'text-accent-green' : 'text-accent-red'
                    )}
                  >
                    {gamePhase === 'won' ? 'You Won!' : 'Game Over'}
                  </p>
                  {gamePhase === 'won' && (
                    <div className="mt-2 space-y-1">
                      <p className="text-accent-green text-sm font-medium">
                        {currentWinnings} USDT
                      </p>
                      <p className="text-accent-green/70 text-xs">
                        Profit: +{currentProfit} USDT at {currentMultiplier}x
                      </p>
                    </div>
                  )}
                  {gamePhase === 'lost' && (
                    <p className="text-accent-red/70 text-sm mt-1">
                      Lost {stake} USDT
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setGamePhase('betting')}
                  className="btn-accent w-full py-3 font-semibold text-base"
                >
                  Play Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
