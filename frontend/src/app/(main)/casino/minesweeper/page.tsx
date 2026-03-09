'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CellState = 'hidden' | 'revealed' | 'mine' | 'flagged';
type GamePhase = 'idle' | 'playing' | 'won' | 'lost';
type GridSize = '5x5' | '8x8' | '10x10';

interface CellData {
  state: CellState;
  value: number;
  row: number;
  col: number;
}

interface GameResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    row: number;
    col: number;
    isMine: boolean;
    value: number;
    revealedCells?: { row: number; col: number; value: number }[];
    currentMultiplier: number;
    nextMultiplier: number;
    revealedCount: number;
    totalSafe: number;
    minePositions?: { row: number; col: number }[];
    grid?: number[][];
    gameOver: boolean;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface CashoutResponse {
  roundId: string;
  payout: number;
  profit: number;
  multiplier: number;
  minePositions: { row: number; col: number }[];
  grid: number[][];
  newBalance: number;
}

interface HistoryEntry {
  id: string;
  gridSize: GridSize;
  mines: number;
  revealed: number;
  multiplier: number;
  profit: number;
  won: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_CONFIGS: { value: GridSize; label: string; size: number }[] = [
  { value: '5x5', label: '5x5', size: 5 },
  { value: '8x8', label: '8x8', size: 8 },
  { value: '10x10', label: '10x10', size: 10 },
];

const MINE_PRESETS: Record<GridSize, number[]> = {
  '5x5': [1, 3, 5, 8, 12],
  '8x8': [5, 10, 15, 20, 30],
  '10x10': [10, 15, 25, 35, 50],
};

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-green-400',
  3: 'text-red-400',
  4: 'text-purple-400',
  5: 'text-yellow-500',
  6: 'text-cyan-400',
  7: 'text-pink-400',
  8: 'text-orange-400',
};

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'LTC', 'DOGE', 'XRP'];

// ---------------------------------------------------------------------------
// Multiplier calculation (client-side for display)
// ---------------------------------------------------------------------------

function calcMultiplier(totalCells: number, mines: number, revealed: number): number {
  if (revealed === 0) return 1;
  let mult = 1;
  const houseEdge = 0.02;
  for (let i = 0; i < revealed; i++) {
    mult *= (totalCells - i) / (totalCells - mines - i);
  }
  return parseFloat((mult * (1 - houseEdge)).toFixed(4));
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function MineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="6" />
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
      <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2" />
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" stroke="currentColor" strokeWidth="2" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" stroke="currentColor" strokeWidth="2" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function FlagSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function GemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" />
      <path d="M11 3l1 10" /><path d="M2 9h20" />
      <path d="M6.5 3L12 13" /><path d="M17.5 3L12 13" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Cell Component
// ---------------------------------------------------------------------------

function Cell({
  cell,
  gridSize,
  onClick,
  onRightClick,
  flagMode,
  disabled,
  animDelay,
}: {
  cell: CellData;
  gridSize: number;
  onClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
  flagMode: boolean;
  disabled: boolean;
  animDelay: number;
}) {
  const isSmall = gridSize >= 8;
  const isTiny = gridSize >= 10;
  const cellSize = isTiny ? 'w-7 h-7 sm:w-8 sm:h-8' : isSmall ? 'w-9 h-9 sm:w-10 sm:h-10' : 'w-11 h-11 sm:w-14 sm:h-14';
  const fontSize = isTiny ? 'text-xs' : isSmall ? 'text-sm' : 'text-base';

  const handleClick = () => {
    if (disabled) return;
    if (flagMode && cell.state === 'hidden') {
      onRightClick({ preventDefault: () => {} } as React.MouseEvent);
      return;
    }
    onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      onContextMenu={e => { e.preventDefault(); onRightClick(e); }}
      disabled={disabled || cell.state === 'revealed'}
      className={cn(
        cellSize,
        'rounded-lg font-mono font-bold flex items-center justify-center transition-all relative overflow-hidden',
        cell.state === 'hidden' && 'bg-[#161B22] hover:bg-[#1C2128] border border-[#30363D] hover:border-[#C8FF00]/40 cursor-pointer active:scale-95',
        cell.state === 'flagged' && 'bg-[#161B22] border border-yellow-500/40 cursor-pointer',
        cell.state === 'revealed' && cell.value >= 0 && 'bg-[#0D1117] border border-[#30363D]/50 cursor-default',
        cell.state === 'mine' && 'bg-[#EF4444]/20 border border-[#EF4444]/50 cursor-default',
        disabled && cell.state === 'hidden' && 'cursor-not-allowed opacity-60',
        fontSize
      )}
    >
      <AnimatePresence mode="wait">
        {cell.state === 'hidden' && (
          <motion.div key="hidden" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-[#30363D]">
            ?
          </motion.div>
        )}
        {cell.state === 'flagged' && (
          <motion.div key="flag" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
            <FlagSvg className={cn('text-yellow-400', isTiny ? 'w-3.5 h-3.5' : isSmall ? 'w-4 h-4' : 'w-5 h-5')} />
          </motion.div>
        )}
        {cell.state === 'revealed' && cell.value > 0 && (
          <motion.span key="number" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: animDelay, type: 'spring', stiffness: 500 }} className={NUMBER_COLORS[cell.value] || 'text-white'}>
            {cell.value}
          </motion.span>
        )}
        {cell.state === 'revealed' && cell.value === 0 && (
          <motion.div key="safe" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: animDelay }}>
            <GemIcon className={cn('text-[#10B981]', isTiny ? 'w-3 h-3' : isSmall ? 'w-4 h-4' : 'w-5 h-5')} />
          </motion.div>
        )}
        {cell.state === 'mine' && (
          <motion.div key="mine" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: animDelay, type: 'spring' }}>
            <MineIcon className={cn('text-[#EF4444]', isTiny ? 'w-3.5 h-3.5' : isSmall ? 'w-4 h-4' : 'w-5 h-5')} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MinesweeperPage() {
  const user = useAuthStore(s => s.user);
  const balances = user?.balances ?? [];

  const [currency, setCurrency] = useState('BTC');
  const [betAmount, setBetAmount] = useState('');
  const [gridSizeKey, setGridSizeKey] = useState<GridSize>('5x5');
  const [mineCount, setMineCount] = useState(3);
  const [flagMode, setFlagMode] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  const [phase, setPhase] = useState<GamePhase>('idle');
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [fairness, setFairness] = useState<GameResponse['fairness'] | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const gridSize = GRID_CONFIGS.find(g => g.value === gridSizeKey)?.size ?? 5;
  const totalCells = gridSize * gridSize;
  const totalSafe = totalCells - mineCount;

  const currentBalance = useMemo(() => {
    const b = balances.find(b => b.currency === currency);
    return b?.available ?? 0;
  }, [balances, currency]);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  useEffect(() => { setMineCount(MINE_PRESETS[gridSizeKey][1]); }, [gridSizeKey]);

  const initGrid = useCallback((): CellData[][] => {
    const g: CellData[][] = [];
    for (let r = 0; r < gridSize; r++) {
      const row: CellData[] = [];
      for (let c = 0; c < gridSize; c++) {
        row.push({ state: 'hidden', value: 0, row: r, col: c });
      }
      g.push(row);
    }
    return g;
  }, [gridSize]);

  const startGame = useCallback(async () => {
    if (!user) { setError('Please log in to play'); return; }
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid bet amount'); return; }
    if (amount > currentBalance) { setError('Insufficient balance'); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await post<GameResponse>('/casino/games/minesweeper/play', {
        amount, currency, options: { gridSize: gridSizeKey, mines: mineCount, action: 'start' },
      });
      setRoundId(data.roundId);
      setGrid(initGrid());
      setPhase('playing');
      setRevealedCount(0);
      setCurrentMultiplier(1);
      setNextMultiplier(data.result?.nextMultiplier ?? calcMultiplier(totalCells, mineCount, 1));
      setFairness(data.fairness);
      setFlagMode(false);
      if (data.newBalance !== undefined) useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  }, [user, betAmount, currency, currentBalance, gridSizeKey, mineCount, totalCells, initGrid]);

  const revealCell = useCallback(async (row: number, col: number) => {
    if (phase !== 'playing' || !roundId) return;
    const cell = grid[row]?.[col];
    if (!cell || cell.state !== 'hidden') return;
    try {
      const data = await post<GameResponse>('/casino/games/minesweeper/play', {
        amount: 0, currency, options: { gridSize: gridSizeKey, mines: mineCount, row, col, action: 'reveal', roundId },
      });
      const newGrid = grid.map(r => r.map(c => ({ ...c })));
      const result = data.result;
      if (result.isMine) {
        newGrid[row][col] = { ...newGrid[row][col], state: 'mine', value: -1 };
        if (result.minePositions) {
          result.minePositions.forEach((pos: { row: number; col: number }) => {
            if (pos.row !== row || pos.col !== col) newGrid[pos.row][pos.col] = { ...newGrid[pos.row][pos.col], state: 'mine', value: -1 };
          });
        }
        if (result.grid) {
          for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
              if (newGrid[r][c].state === 'hidden') {
                const val = result.grid[r]?.[c] ?? 0;
                newGrid[r][c] = { ...newGrid[r][c], state: val === -1 ? 'mine' : 'revealed', value: val };
              }
            }
          }
        }
        setGrid(newGrid);
        setPhase('lost');
        if (data.newBalance !== undefined) useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
        setHistory(prev => [{ id: data.roundId, gridSize: gridSizeKey, mines: mineCount, revealed: revealedCount, multiplier: currentMultiplier, profit: data.profit ?? -(parseFloat(betAmount) || 0), won: false }, ...prev].slice(0, 20));
      } else {
        const cellsToReveal = result.revealedCells ?? [{ row, col, value: result.value }];
        cellsToReveal.forEach((c: { row: number; col: number; value: number }) => {
          newGrid[c.row][c.col] = { ...newGrid[c.row][c.col], state: 'revealed', value: c.value };
        });
        const newCount = result.revealedCount ?? revealedCount + cellsToReveal.length;
        setGrid(newGrid);
        setRevealedCount(newCount);
        setCurrentMultiplier(result.currentMultiplier ?? calcMultiplier(totalCells, mineCount, newCount));
        setNextMultiplier(result.nextMultiplier ?? calcMultiplier(totalCells, mineCount, newCount + 1));
        if (newCount >= totalSafe) {
          setPhase('won');
          if (data.newBalance !== undefined) useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
          setHistory(prev => [{ id: data.roundId, gridSize: gridSizeKey, mines: mineCount, revealed: newCount, multiplier: result.currentMultiplier ?? currentMultiplier, profit: data.profit ?? ((parseFloat(betAmount) || 0) * (result.currentMultiplier ?? currentMultiplier) - (parseFloat(betAmount) || 0)), won: true }, ...prev].slice(0, 20));
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to reveal cell');
    }
  }, [phase, roundId, grid, currency, gridSizeKey, mineCount, gridSize, revealedCount, currentMultiplier, totalCells, totalSafe, betAmount]);

  const toggleFlag = useCallback((row: number, col: number) => {
    if (phase !== 'playing') return;
    const cell = grid[row]?.[col];
    if (!cell || (cell.state !== 'hidden' && cell.state !== 'flagged')) return;
    const newGrid = grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col] = { ...newGrid[row][col], state: cell.state === 'flagged' ? 'hidden' : 'flagged' };
    setGrid(newGrid);
  }, [phase, grid]);

  const cashOut = useCallback(async () => {
    if (phase !== 'playing' || !roundId || revealedCount === 0) return;
    setCashingOut(true);
    try {
      const data = await post<CashoutResponse>('/casino/games/minesweeper/play', {
        amount: 0, currency, options: { action: 'cashout', roundId, gridSize: gridSizeKey, mines: mineCount },
      });
      if (data.grid) {
        const newGrid = grid.map(r => r.map(c => ({ ...c })));
        for (let r = 0; r < gridSize; r++) {
          for (let c = 0; c < gridSize; c++) {
            if (newGrid[r][c].state === 'hidden' || newGrid[r][c].state === 'flagged') {
              const val = data.grid[r]?.[c] ?? 0;
              newGrid[r][c] = { ...newGrid[r][c], state: val === -1 ? 'mine' : 'revealed', value: val };
            }
          }
        }
        setGrid(newGrid);
      }
      if (data.minePositions) {
        setGrid(prev => {
          const g = prev.map(r => r.map(c => ({ ...c })));
          data.minePositions.forEach((pos: { row: number; col: number }) => { g[pos.row][pos.col] = { ...g[pos.row][pos.col], state: 'mine', value: -1 }; });
          return g;
        });
      }
      setPhase('won');
      if (data.newBalance !== undefined) useAuthStore.getState().updateBalance(currency, data.newBalance, 0);
      setHistory(prev => [{ id: data.roundId, gridSize: gridSizeKey, mines: mineCount, revealed: revealedCount, multiplier: data.multiplier ?? currentMultiplier, profit: data.profit ?? ((parseFloat(betAmount) || 0) * (data.multiplier ?? currentMultiplier) - (parseFloat(betAmount) || 0)), won: true }, ...prev].slice(0, 20));
    } catch (err: any) {
      setError(err?.message || 'Failed to cash out');
    } finally {
      setCashingOut(false);
    }
  }, [phase, roundId, revealedCount, currency, gridSizeKey, mineCount, grid, gridSize, betAmount, currentMultiplier]);

  const resetGame = useCallback(() => {
    setPhase('idle'); setGrid([]); setRoundId(null); setRevealedCount(0);
    setCurrentMultiplier(1); setNextMultiplier(1); setError(null); setFairness(null);
  }, []);

  const handleHalf = () => setBetAmount(((parseFloat(betAmount) || 0) / 2).toFixed(8));
  const handleDouble = () => setBetAmount(Math.min((parseFloat(betAmount) || 0) * 2, currentBalance).toFixed(8));

  const potentialPayout = useMemo(() => {
    const amt = parseFloat(betAmount) || 0;
    return amt * currentMultiplier;
  }, [betAmount, currentMultiplier]);

  const isPlaying = phase === 'playing';
  const isOver = phase === 'won' || phase === 'lost';
  const displayGrid = grid.length > 0 ? grid : initGrid();

  const flagCount = useMemo(() => {
    let count = 0;
    grid.forEach(row => row.forEach(cell => { if (cell.state === 'flagged') count++; }));
    return count;
  }, [grid]);

  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Game Grid - edge to edge */}
      <div className="bg-[#161B22] border-b border-[#30363D]">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <MineIcon className="w-4 h-4 text-[#EF4444]" />
              <span className="text-sm text-[#8B949E] font-mono">{mineCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GemIcon className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm text-[#8B949E] font-mono">{totalSafe - revealedCount}</span>
            </div>
          </div>
          {isPlaying && (
            <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-xs text-[#C8FF00] font-medium">
              Tap to reveal
            </motion.div>
          )}
        </div>

        <div className="flex justify-center pb-4 px-2">
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
            {displayGrid.map((row, r) =>
              row.map((cell, c) => (
                <Cell
                  key={`${r}-${c}`}
                  cell={cell}
                  gridSize={gridSize}
                  onClick={() => revealCell(r, c)}
                  onRightClick={() => toggleFlag(r, c)}
                  flagMode={flagMode}
                  disabled={!isPlaying}
                  animDelay={phase === 'idle' ? 0 : Math.random() * 0.2}
                />
              ))
            )}
          </div>
        </div>

        {phase === 'idle' && (
          <div className="pb-4 text-center">
            <p className="text-[#8B949E] text-sm">Place a bet and start the game</p>
          </div>
        )}
      </div>

      {/* Multiplier / Stats (playing) */}
      {isPlaying && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-4 pt-3">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Multiplier', value: `${currentMultiplier.toFixed(2)}x`, color: 'text-[#10B981]' },
              { label: 'Revealed', value: `${revealedCount}/${totalSafe}`, color: 'text-[#C8FF00]' },
              { label: 'Mines', value: `${mineCount}`, color: 'text-[#EF4444]' },
              { label: 'Payout', value: formatCurrency(potentialPayout, currency), color: 'text-yellow-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#161B22] rounded-lg border border-[#30363D] p-2 text-center">
                <div className="text-[10px] text-[#8B949E] uppercase tracking-wider">{stat.label}</div>
                <div className={cn('text-sm font-mono font-bold mt-0.5', stat.color)}>{stat.value}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Flag mode toggle */}
      {isPlaying && (
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between bg-[#161B22] border border-[#30363D] rounded-xl p-3">
            <div className="flex items-center gap-2">
              <FlagSvg className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-white">Flag Mode</span>
              <span className="text-xs text-[#8B949E] font-mono">({flagCount})</span>
            </div>
            <button
              onClick={() => setFlagMode(!flagMode)}
              className={cn('w-10 h-5 rounded-full relative transition-colors', flagMode ? 'bg-[#C8FF00]' : 'bg-[#30363D]')}
            >
              <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', flagMode ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 pt-3 space-y-3">
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
            <input
              type="number"
              value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              disabled={isPlaying}
              className="flex-1 bg-transparent text-center text-white font-mono text-sm focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.00"
              step="any"
              min="0"
            />
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

        {/* Grid Size */}
        <div>
          <label className="block text-[#8B949E] text-sm mb-1">Grid Size</label>
          <div className="grid grid-cols-3 gap-1 bg-[#0D1117] border border-[#30363D] rounded-lg p-1">
            {GRID_CONFIGS.map(gc => (
              <button
                key={gc.value}
                onClick={() => setGridSizeKey(gc.value)}
                disabled={isPlaying}
                className={cn(
                  'py-2 rounded-md text-sm font-medium transition-all',
                  gridSizeKey === gc.value ? 'bg-[#8B5CF6] text-white font-bold' : 'text-[#8B949E] hover:text-white'
                )}
              >
                {gc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mine Count */}
        <div>
          <label className="block text-[#8B949E] text-sm mb-1">
            Mines: <span className="text-white font-mono">{mineCount}</span>
          </label>
          <input
            type="range"
            min={1}
            max={totalCells - 1}
            value={mineCount}
            onChange={e => setMineCount(parseInt(e.target.value))}
            disabled={isPlaying}
            className="w-full accent-[#C8FF00]"
          />
          <div className="flex gap-1 mt-2">
            {MINE_PRESETS[gridSizeKey].map(n => (
              <button
                key={n}
                onClick={() => setMineCount(n)}
                disabled={isPlaying}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-mono transition-all',
                  mineCount === n ? 'bg-[#8B5CF6] text-white font-bold' : 'bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-white'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-sm text-[#EF4444]">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        {phase === 'idle' && (
          <motion.button
            onClick={startGame}
            disabled={loading}
            whileTap={{ scale: 0.98 }}
            className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base disabled:opacity-60 transition-all"
          >
            {loading ? 'Starting...' : 'NEW GAME'}
          </motion.button>
        )}

        {isPlaying && (
          <motion.button
            onClick={cashOut}
            disabled={cashingOut || revealedCount === 0}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full py-3.5 rounded-xl font-bold text-base transition-all',
              revealedCount > 0
                ? 'bg-[#C8FF00] text-black'
                : 'bg-[#2D333B] text-white cursor-not-allowed'
            )}
          >
            {cashingOut ? 'Cashing Out...' : `Cash Out ${formatCurrency(potentialPayout, currency)}`}
          </motion.button>
        )}

        {isOver && (
          <div className="space-y-2">
            <div className={cn(
              'text-center py-3 rounded-lg font-bold text-lg',
              phase === 'won' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#EF4444]/10 text-[#EF4444]'
            )}>
              {phase === 'won' ? `Won ${formatCurrency(potentialPayout, currency)}!` : 'BOOM! Mine hit!'}
            </div>
            <motion.button
              onClick={resetGame}
              whileTap={{ scale: 0.98 }}
              className="bg-[#C8FF00] text-black font-bold py-3.5 rounded-xl w-full text-base transition-all"
            >
              NEW GAME
            </motion.button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-[#161B22] rounded-xl border border-[#30363D] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#30363D]">
              <h3 className="text-sm font-semibold text-white">Game History</h3>
            </div>
            <div className="divide-y divide-[#30363D]/50 max-h-[250px] overflow-y-auto">
              {history.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                      entry.won ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                    )}>
                      {entry.won ? 'W' : 'L'}
                    </div>
                    <div>
                      <div className="text-sm text-white">{entry.gridSize} &middot; {entry.mines} mines</div>
                      <div className="text-xs text-[#8B949E] font-mono">{(entry.multiplier ?? 0).toFixed(2)}x</div>
                    </div>
                  </div>
                  <div className={cn('text-sm font-mono font-bold', entry.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                    {entry.won ? '+' : ''}{formatCurrency(entry.profit ?? 0, currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provably Fair */}
        {fairness && isOver && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#161B22] rounded-xl border border-[#30363D] p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldIcon className="w-4 h-4 text-[#C8FF00]" />
              <span className="text-sm font-semibold text-white">Provably Fair</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-[#8B949E] flex-shrink-0 w-24">Server Seed:</span>
                <span className="text-gray-300 font-mono break-all">{fairness.serverSeedHash}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8B949E] flex-shrink-0 w-24">Client Seed:</span>
                <span className="text-gray-300 font-mono break-all">{fairness.clientSeed}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8B949E] flex-shrink-0 w-24">Nonce:</span>
                <span className="text-gray-300 font-mono">{fairness.nonce}</span>
              </div>
            </div>
          </motion.div>
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
