'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
} from 'lucide-react';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Side = 'heads' | 'tails';
type GamePhase = 'idle' | 'flipping' | 'result';

interface GameHistory {
  id: string;
  choice: Side;
  result: Side;
  won: boolean;
  amount: number;
  payout: number;
}

interface CoinflipResponse {
  roundId: string;
  payout: number;
  multiplier: number;
  result: {
    choice: string;
    coinResult: Side;
    isWin: boolean;
  };
  newBalance?: number;
}

// ---------------------------------------------------------------------------
// Coinflip Game Page
// ---------------------------------------------------------------------------

export default function CoinflipGamePage() {
  const { isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);
  const [selectedSide, setSelectedSide] = useState<Side>('heads');
  const [betAmount, setBetAmount] = useState('1.00');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [result, setResult] = useState<Side | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [flipRotation, setFlipRotation] = useState(0);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to guard against double-clicks / stale closures
  const isPlayingRef = useRef(false);

  useEffect(() => { setBetAmount(getDefaultBet(currency)); }, [currency]);

  const PAYOUT = 1.94;

  const animateCoin = useCallback((flipResult: Side) => {
    // 3D flip - random number of rotations (3-5 full rotations)
    const baseRotations = (3 + Math.floor(Math.random() * 3)) * 360;
    // Heads = 0 deg, Tails = 180 deg final
    const extraDeg = flipResult === 'tails' ? 180 : 0;
    setFlipRotation((prev) => prev + baseRotations + extraDeg);
  }, []);

  const handleFlip = useCallback(async () => {
    // Ref-based guard: immune to stale closures
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    setGamePhase('flipping');
    setResult(null);
    setWon(null);
    setError(null);

    let flipResult: Side;
    let isWin: boolean;
    let payoutAmount: number;

    try {
      // Call the backend API
      const data = await post<CoinflipResponse>('/casino/games/coinflip/play', {
        amount: parseFloat(betAmount),
        currency,
        options: { choice: selectedSide },
      });

      flipResult = data.result.coinResult;
      isWin = data.result.isWin;
      payoutAmount = data.payout;

      // Update balance in auth store
      if (data.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, data.newBalance, 0);
      }
    } catch {
      setError('Failed to place bet. Please try again.');
      setGamePhase('idle');
      isPlayingRef.current = false;
      return;
    }

    // Animate the coin to the result
    animateCoin(flipResult);

    setTimeout(() => {
      setResult(flipResult);
      setWon(isWin);
      setGamePhase('result');
      isPlayingRef.current = false;

      const round: GameHistory = {
        id: `cf-${Date.now()}`,
        choice: selectedSide,
        result: flipResult,
        won: isWin,
        amount: parseFloat(betAmount),
        payout: payoutAmount,
      };
      setHistory((prev) => [round, ...prev.slice(0, 9)]);
    }, 2200);
  }, [selectedSide, betAmount, animateCoin, currency]);

  const adjustBet = (factor: number) => {
    const val = parseFloat(betAmount) || 0;
    setBetAmount(Math.max(0.00001, val * factor).toFixed(5));
  };

  return (
    <div className="max-w-md mx-auto space-y-4 sm:space-y-6 px-1 sm:px-0 pb-24">
      {/* Error Display */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2 text-center">
          <span className="text-xs font-semibold text-[#EF4444]">{error}</span>
        </div>
      )}

      {/* Payout Display */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 text-center">
        <span className="text-xs text-[#8B949E]">Payout Multiplier</span>
        <p className="text-2xl font-bold font-mono text-[#8B5CF6]">{PAYOUT}x</p>
      </div>

      {/* Coin Display Area */}
      <motion.div
        className={cn(
          'bg-[#161B22] border rounded-card p-5 sm:p-8 flex flex-col items-center justify-center min-h-[260px] sm:min-h-[300px] transition-colors duration-500',
          gamePhase === 'result' && won !== null
            ? won
              ? 'border-[#10B981]/30'
              : 'border-[#EF4444]/30'
            : 'border-[#30363D]',
        )}
      >
        {/* 3D Coin */}
        <div className="perspective-[600px]">
          <motion.div
            className="w-32 h-32 sm:w-40 sm:h-40 relative"
            animate={{ rotateY: flipRotation }}
            transition={{
              duration: gamePhase === 'flipping' ? 2 : 0,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Heads (front) */}
            <div
              className="absolute inset-0 rounded-full border-4 border-[#F59E0B] bg-gradient-to-br from-[#F59E0B]/30 to-[#D97706]/20 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="text-center">
                <span className="text-5xl font-bold text-[#F59E0B]">H</span>
                <p className="text-xs font-medium text-[#F59E0B]/70 mt-1">HEADS</p>
              </div>
            </div>
            {/* Tails (back) */}
            <div
              className="absolute inset-0 rounded-full border-4 border-[#8B5CF6] bg-gradient-to-br from-[#8B5CF6]/30 to-[#7C3AED]/20 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <div className="text-center">
                <span className="text-5xl font-bold text-[#8B5CF6]">T</span>
                <p className="text-xs font-medium text-[#8B5CF6]/70 mt-1">TAILS</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Result Message */}
        <AnimatePresence>
          {gamePhase === 'result' && won !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 text-center"
            >
              <p className={cn(
                'text-2xl font-bold',
                won ? 'text-[#10B981]' : 'text-[#EF4444]',
              )}>
                {won ? 'You Win!' : 'You Lose'}
              </p>
              {won && history.length > 0 && (
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.3 }}
                  className="text-sm text-[#10B981] mt-1 font-mono"
                >
                  +{formatCurrency(history[0].payout - history[0].amount, currency)}
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Side Selection */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => gamePhase !== 'flipping' && setSelectedSide('heads')}
          disabled={gamePhase === 'flipping'}
          className={cn(
            'h-14 rounded-card font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 border',
            selectedSide === 'heads'
              ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-[#F59E0B] shadow-lg shadow-[#F59E0B]/10'
              : 'bg-[#1C2128] border-[#30363D] text-[#8B949E] hover:border-[#F59E0B]/30 hover:text-[#F59E0B]',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-[#F59E0B]/20 flex items-center justify-center text-lg font-bold text-[#F59E0B]">
            H
          </div>
          Heads
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => gamePhase !== 'flipping' && setSelectedSide('tails')}
          disabled={gamePhase === 'flipping'}
          className={cn(
            'h-14 rounded-card font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 border',
            selectedSide === 'tails'
              ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/10'
              : 'bg-[#1C2128] border-[#30363D] text-[#8B949E] hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6]',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center text-lg font-bold text-[#8B5CF6]">
            T
          </div>
          Tails
        </motion.button>
      </div>

      {/* Bet Controls */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div>
          <label className="text-xs text-[#8B949E] mb-1.5 block">Bet Amount ({currency})</label>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(0.5)}
              disabled={gamePhase === 'flipping'}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 text-xs font-medium"
            >
              1/2
            </motion.button>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={gamePhase === 'flipping'}
              className="flex-1 h-10 bg-[#0D1117] border border-[#30363D] rounded-button px-3 text-sm font-mono text-[#E6EDF3] text-center focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => adjustBet(2)}
              disabled={gamePhase === 'flipping'}
              className="h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] disabled:opacity-50 text-xs font-medium"
            >
              2x
            </motion.button>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={!isAuthenticated || gamePhase === 'flipping'}
          onClick={handleFlip}
          className={cn(
            'w-full h-12 font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2 text-lg',
            gamePhase === 'flipping'
              ? 'bg-[#484F58] text-[#8B949E] cursor-not-allowed'
              : gamePhase === 'result'
                ? 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/20'
                : 'bg-[#10B981] hover:bg-[#059669] text-white shadow-lg shadow-[#10B981]/20',
          )}
        >
          <Coins className={cn('w-5 h-5', gamePhase === 'flipping' && 'animate-spin')} />
          {gamePhase === 'flipping'
            ? 'Flipping...'
            : gamePhase === 'result'
              ? 'Flip Again'
              : isAuthenticated
                ? 'Flip Coin'
                : 'Login to Play'}
        </motion.button>
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div className="flex gap-2 justify-center flex-wrap">
          {history.map((h) => (
            <motion.div
              key={h.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border',
                h.won
                  ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-[#EF4444]/20 border-[#EF4444]/40 text-[#EF4444]',
              )}
              title={`${h.choice} vs ${h.result}: ${h.won ? 'Won' : 'Lost'}`}
            >
              {h.result === 'heads' ? 'H' : 'T'}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
