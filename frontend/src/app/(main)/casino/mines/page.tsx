'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bomb,
  Gem,
  DollarSign,
  RotateCcw,
  Minus,
  Plus,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post, get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TileState = 'hidden' | 'gem' | 'mine';
type GamePhase = 'idle' | 'playing' | 'won' | 'lost';

interface MinesStartResponse {
  roundId: string;
  mineCount: number;
  totalTiles: number;
  serverSeedHash: string;
  newBalance?: number;
}

interface MinesRevealResponse {
  position: number;
  isMine: boolean;
  minePositions?: number[];
  currentMultiplier: number;
  nextMultiplier: number;
  revealedCount: number;
  gameOver: boolean;
  payout: number;
  newBalance?: number;
}

interface MinesCashoutResponse {
  payout: number;
  multiplier: number;
  minePositions: number[];
  newBalance: number;
}

interface MinesActiveResponse {
  gameId: string;
  mineCount: number;
  revealedPositions: number[];
  multiplier: number;
}

// ---------------------------------------------------------------------------
// Multiplier calculation
// ---------------------------------------------------------------------------

function calcMultiplier(totalTiles: number, mines: number, gemsRevealed: number): number {
  if (gemsRevealed === 0) return 1;
  let mult = 1;
  const houseEdge = 0.03;
  for (let i = 0; i < gemsRevealed; i++) {
    mult *= (totalTiles - i) / (totalTiles - mines - i);
  }
  return parseFloat((mult * (1 - houseEdge)).toFixed(4));
}

// ---------------------------------------------------------------------------
// Mines Game Page
// ---------------------------------------------------------------------------

export default function MinesGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [mineCount, setMineCount] = useState(3);
  const [betAmount, setBetAmount] = useState('1.00');
  const [gameState, setGameState] = useState<GamePhase>('idle');
  const [grid, setGrid] = useState<TileState[]>(Array(25).fill('hidden'));
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [revealedCount, setRevealedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- set initial bet on mount
  const [isRevealing, setIsRevealing] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);

  // Check for active game session on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    get<{ isActive: boolean; roundId?: string; mineCount?: number; revealed?: number[]; currentMultiplier?: number; betAmount?: number; currency?: string }>('/casino/mines/active')
      .then((data) => {
        if (data?.isActive && data.roundId) {
          setGameId(data.roundId);
          setMineCount(data.mineCount || 3);
          setRevealedCount(data.revealed?.length || 0);
          if (data.betAmount) setBetAmount(String(data.betAmount));
          // Restore revealed tiles
          if (data.revealed && data.revealed.length > 0) {
            const newGrid = Array(25).fill('hidden') as TileState[];
            data.revealed.forEach((pos) => { newGrid[pos] = 'gem'; });
            setGrid(newGrid);
          }
          setGameState('playing');
        }
      })
      .catch(() => { /* no active game, that's fine */ });
  }, [isAuthenticated]);

  const safeSpots = 25 - mineCount;

  const currentMultiplier = useMemo(
    () => calcMultiplier(25, mineCount, revealedCount),
    [mineCount, revealedCount],
  );

  const nextMultiplier = useMemo(
    () => revealedCount < safeSpots ? calcMultiplier(25, mineCount, revealedCount + 1) : currentMultiplier,
    [mineCount, revealedCount, safeSpots, currentMultiplier],
  );

  const currentProfit = useMemo(
    () => parseFloat(betAmount) * currentMultiplier - parseFloat(betAmount),
    [betAmount, currentMultiplier],
  );

  const startGame = useCallback(async () => {
    setErrorMessage(null);

    try {
      const response = await post<MinesStartResponse>('/casino/mines/start', {
        betAmount: parseFloat(betAmount),
        currency,
        minesCount: mineCount,
      });

      setGameId(response.roundId);
      setMinePositions(new Set());
      setGrid(Array(25).fill('hidden'));
      setRevealedCount(0);
      setGameState('playing');
      // Update balance in auth store (bet deducted)
      if (response.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, response.newBalance, 0);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (/insufficient/i.test(msg)) {
        setErrorMessage('Insufficient balance. Please deposit funds.');
      } else if (err?.statusCode === 401) {
        setErrorMessage('Please log in to play.');
      } else if (/active|in.progress/i.test(msg)) {
        // Resume existing game session
        setErrorMessage('You have an active game. Resuming...');
        setGameState('playing');
        return;
      } else {
        setErrorMessage(msg || 'Failed to start game. Please try again.');
      }
      setGameState('idle');
    }
  }, [mineCount, betAmount, currency]);

  const revealTile = useCallback(async (index: number) => {
    if (gameState !== 'playing' || grid[index] !== 'hidden' || isRevealing) return;

    setIsRevealing(true);
    setErrorMessage(null);

    if (gameId) {
      // Use backend API
      try {
        const response = await post<MinesRevealResponse>('/casino/mines/reveal', {
          position: index,
        });

        const newGrid = [...grid];

        if (response.isMine) {
          // Hit a mine - reveal all mine positions from backend
          newGrid[index] = 'mine';
          if (response.minePositions) {
            response.minePositions.forEach((pos) => {
              newGrid[pos] = 'mine';
            });
          }
          setGrid(newGrid);
          setMinePositions(new Set(response.minePositions || [index]));
          setGameState('lost');
          // Update balance (loss)
          if (response.newBalance !== undefined) {
            const { updateBalance } = useAuthStore.getState();
            updateBalance(currency, response.newBalance, 0);
          }
        } else {
          newGrid[index] = 'gem';
          setGrid(newGrid);
          setRevealedCount(response.revealedCount);

          if (response.gameOver && response.minePositions) {
            // All gems found - auto win
            response.minePositions.forEach((pos) => {
              newGrid[pos] = 'mine';
            });
            setMinePositions(new Set(response.minePositions));
            setGrid([...newGrid]);
            setGameState('won');
            if (response.newBalance !== undefined) {
              const { updateBalance } = useAuthStore.getState();
              updateBalance(currency, response.newBalance, 0);
            }
          }
        }
      } catch (err: any) {
        // On API error during play, show error but don't break game
        setErrorMessage('Connection error. Tile could not be revealed.');
      }
    } else {
      setErrorMessage('No active game session. Please start a new game.');
      setIsRevealing(false);
      return;
    }

    setIsRevealing(false);
  }, [gameState, grid, minePositions, revealedCount, safeSpots, gameId, isRevealing, currency]);

  const cashOut = useCallback(async () => {
    if (gameState !== 'playing' || revealedCount === 0) return;
    setErrorMessage(null);

    if (gameId) {
      try {
        const response = await post<MinesCashoutResponse>('/casino/mines/cashout');

        const newGrid = [...grid];
        if (response.minePositions) {
          response.minePositions.forEach((pos) => {
            if (newGrid[pos] === 'hidden') newGrid[pos] = 'mine';
          });
          setMinePositions(new Set(response.minePositions));
        }
        setGrid(newGrid);
        setGameState('won');

        // Update balance in auth store (winnings credited)
        if (response.newBalance !== undefined) {
          const { updateBalance } = useAuthStore.getState();
          updateBalance(currency, response.newBalance, 0);
        } else if ((response as any).balances) {
          // Backend may return balances array instead
          const balances = (response as any).balances as Array<{ currency: string; balance: number }>;
          const match = balances.find((b) => b.currency === currency);
          if (match) {
            const { updateBalance } = useAuthStore.getState();
            updateBalance(currency, match.balance, 0);
          }
        }
      } catch (err: any) {
        setErrorMessage('Failed to cash out. Please try again.');
      }
    } else {
      setErrorMessage('No active game session.');
    }
  }, [gameState, grid, minePositions, revealedCount, gameId, currency]);

  const reset = () => {
    setGrid(Array(25).fill('hidden'));
    setMinePositions(new Set());
    setRevealedCount(0);
    setGameState('idle');
    setGameId(null);
    setErrorMessage(null);
  };

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(5));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 px-1 sm:px-0 pb-24">
      {/* Error Message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-card bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm text-center"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-4 text-center">
          <p className="text-[10px] text-[#8B949E] mb-1">Current Multiplier</p>
          <motion.p
            key={currentMultiplier}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xl sm:text-2xl font-bold font-mono text-[#8B5CF6]"
          >
            {revealedCount > 0 ? `${currentMultiplier.toFixed(2)}x` : '--'}
          </motion.p>
          {gameState === 'playing' && revealedCount > 0 && revealedCount < safeSpots && (
            <p className="text-[10px] text-[#8B949E] mt-1">
              Next: <span className="text-[#10B981] font-mono">{nextMultiplier.toFixed(2)}x</span>
            </p>
          )}
        </div>
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-4 text-center">
          <p className="text-[10px] text-[#8B949E] mb-1">Current Profit</p>
          <p className={cn(
            'text-xl sm:text-2xl font-bold font-mono',
            gameState === 'lost' ? 'text-[#EF4444]' :
            currentProfit > 0 ? 'text-[#10B981]' : 'text-[#E6EDF3]',
          )}>
            {gameState !== 'idle'
              ? gameState === 'lost'
                ? `-${formatCurrency(parseFloat(betAmount), currency)}`
                : `+${formatCurrency(currentProfit, currency)}`
              : '--'}
          </p>
        </div>
      </div>

      {/* 5x5 Grid */}
      <motion.div
        className={cn(
          'bg-[#161B22] border rounded-card p-2 sm:p-4 transition-colors duration-300',
          gameState === 'won' ? 'border-[#10B981]/30' :
          gameState === 'lost' ? 'border-[#EF4444]/30' : 'border-[#30363D]',
        )}
      >
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 max-w-md mx-auto">
          {grid.map((tile, index) => (
            <motion.button
              key={index}
              onClick={() => revealTile(index)}
              disabled={gameState !== 'playing' || tile !== 'hidden'}
              whileHover={tile === 'hidden' && gameState === 'playing' ? { scale: 1.08 } : {}}
              whileTap={tile === 'hidden' && gameState === 'playing' ? { scale: 0.92 } : {}}
              className={cn(
                'aspect-square rounded-lg flex items-center justify-center transition-all duration-200 border',
                tile === 'hidden' && gameState === 'playing'
                  ? 'bg-[#1C2128] border-[#30363D] hover:bg-[#8B5CF6]/10 hover:border-[#8B5CF6]/30 cursor-pointer'
                  : tile === 'hidden'
                    ? 'bg-[#1C2128] border-[#30363D] cursor-not-allowed'
                    : tile === 'gem'
                      ? 'bg-[#10B981]/20 border-[#10B981]/40'
                      : 'bg-[#EF4444]/20 border-[#EF4444]/40',
              )}
            >
              <AnimatePresence mode="wait">
                {tile === 'gem' && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  >
                    <Gem className="w-6 h-6 md:w-8 md:h-8 text-[#10B981]" />
                  </motion.div>
                )}
                {tile === 'mine' && (
                  <motion.div
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  >
                    <Bomb className="w-6 h-6 md:w-8 md:h-8 text-[#EF4444]" />
                  </motion.div>
                )}
                {tile === 'hidden' && gameState === 'playing' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-3 h-3 rounded-full bg-[#30363D]"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Controls */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Mine Count Selector */}
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 block">
            Mines ({mineCount})
          </label>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {[1, 3, 5, 7, 10, 12, 15, 20, 24].map((count) => (
              <button
                key={count}
                onClick={() => gameState === 'idle' && setMineCount(count)}
                disabled={gameState !== 'idle'}
                className={cn(
                  'h-9 px-3 rounded-button text-xs font-mono font-medium transition-all duration-200 whitespace-nowrap',
                  mineCount === count
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50',
                )}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Bet Amount */}
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 block">Bet Amount ({currency})</label>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(0.5)}
              disabled={gameState === 'playing'}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 text-xs font-medium"
            >
              1/2
            </motion.button>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={gameState === 'playing'}
              className="flex-1 h-10 bg-[#0D1117] border border-[#30363D] rounded-button px-3 text-sm font-mono text-[#E6EDF3] text-center focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(2)}
              disabled={gameState === 'playing'}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 text-xs font-medium"
            >
              2x
            </motion.button>
          </div>
        </div>

        {/* Action Buttons */}
        {gameState === 'idle' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={!isAuthenticated}
            onClick={startGame}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#8B5CF6]/50 disabled:cursor-not-allowed text-white font-bold rounded-button transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20"
          >
            {isAuthenticated ? 'Start Game' : 'Login to Play'}
          </motion.button>
        )}

        {gameState === 'playing' && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={cashOut}
            disabled={revealedCount === 0}
            className={cn(
              'w-full h-12 font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2',
              revealedCount > 0
                ? 'bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white shadow-lg shadow-[#10B981]/20'
                : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] cursor-not-allowed',
            )}
          >
            <DollarSign className="w-5 h-5" />
            {revealedCount > 0
              ? `Cash Out ${formatCurrency(parseFloat(betAmount) * currentMultiplier, currency)}`
              : 'Pick a tile to start'}
          </motion.button>
        )}

        {(gameState === 'won' || gameState === 'lost') && (
          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-4 rounded-card text-center',
                gameState === 'won'
                  ? 'bg-[#10B981]/10 border border-[#10B981]/30'
                  : 'bg-[#EF4444]/10 border border-[#EF4444]/30',
              )}
            >
              <p className={cn(
                'text-lg font-bold',
                gameState === 'won' ? 'text-[#10B981]' : 'text-[#EF4444]',
              )}>
                {gameState === 'won'
                  ? `Won ${formatCurrency(parseFloat(betAmount) * currentMultiplier, currency)} at ${currentMultiplier.toFixed(2)}x`
                  : `Boom! Lost ${formatCurrency(parseFloat(betAmount), currency)}`}
              </p>
              {gameState === 'won' && (
                <p className="text-sm text-[#8B949E] mt-1">
                  {revealedCount} gems found
                </p>
              )}
            </motion.div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { reset(); setTimeout(() => startGame(), 50); }}
              className="w-full h-11 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </motion.button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-2 sm:p-3 text-center">
          <p className="text-[10px] text-[#8B949E] mb-0.5 sm:mb-1">Gems Found</p>
          <p className="font-mono font-bold text-base sm:text-lg text-[#10B981]">{revealedCount}</p>
        </div>
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-2 sm:p-3 text-center">
          <p className="text-[10px] text-[#8B949E] mb-0.5 sm:mb-1">Mines</p>
          <p className="font-mono font-bold text-base sm:text-lg text-[#EF4444]">{mineCount}</p>
        </div>
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-2 sm:p-3 text-center">
          <p className="text-[10px] text-[#8B949E] mb-0.5 sm:mb-1">Safe Left</p>
          <p className="font-mono font-bold text-base sm:text-lg text-[#E6EDF3]">
            {safeSpots - revealedCount}
          </p>
        </div>
      </div>
    </div>
  );
}
