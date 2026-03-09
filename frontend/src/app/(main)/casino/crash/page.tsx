'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Volume2,
  VolumeX,
  AlertTriangle,
  Home,
  Info,
  Rocket,
  Timer,
} from 'lucide-react';
import { cn, formatCurrency, generateId, getDefaultBet } from '@/lib/utils';
import { get, post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { useSocket } from '@/lib/socket';
import CrashGraph, { type CrashStatus } from '@/components/casino/CrashGraph';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerBet {
  id: string;
  username: string;
  avatar?: string;
  betAmount: number;
  currency: string;
  autoCashout: number | null;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  payout: number | null;
}

interface CrashRound {
  id: string;
  crashPoint: number;
  hash: string;
  timestamp: string;
}

type BetSlot = 1 | 2;

// Backend response types
interface CrashCurrentState {
  roundId: string | null;
  phase: 'WAITING' | 'RUNNING' | 'CRASHED';
  currentMultiplier: number;
  elapsed: number;
  serverSeedHash: string;
  bets: Array<{
    userId: string;
    username: string;
    amount: number;
    autoCashout: number | null;
    cashoutAt: number | null;
    payout: number | null;
    isActive: boolean;
  }>;
}

interface CrashHistoryEntry {
  id: string;
  crashPoint: number;
  serverSeedHash: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Crash Game Page - Cloudbet Mobile Style
// ---------------------------------------------------------------------------

export default function CrashGamePage() {
  const { user, isAuthenticated } = useAuthStore();
  const currency = useBetSlipStore((s) => s.currency);

  // Connection / mode state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Game state
  const [gameStatus, setGameStatus] = useState<CrashStatus>('waiting');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | undefined>();
  const [countdown, setCountdown] = useState(5);
  const [players, setPlayers] = useState<PlayerBet[]>([]);
  const [roundHistory, setRoundHistory] = useState<CrashRound[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);

  // Bet slot 1
  const [bet1Amount, setBet1Amount] = useState('1.00');
  const [bet1Placed, setBet1Placed] = useState(false);
  const [bet1CashedOut, setBet1CashedOut] = useState(false);
  const [bet1AutoCashout, setBet1AutoCashout] = useState('');
  const [bet1Loading, setBet1Loading] = useState(false);

  // Bet slot 2
  const [bet2Amount, setBet2Amount] = useState('1.00');
  const [bet2Placed, setBet2Placed] = useState(false);
  const [bet2CashedOut, setBet2CashedOut] = useState(false);
  const [bet2AutoCashout, setBet2AutoCashout] = useState('');
  const [bet2Loading, setBet2Loading] = useState(false);

  useEffect(() => { setBet1Amount(getDefaultBet(currency)); setBet2Amount(getDefaultBet(currency)); }, [currency]);

  // UI toggles
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [betMode, setBetMode] = useState<'manual' | 'auto'>('manual');

  // Provably fair seeds
  const [serverSeedHash, setServerSeedHash] = useState(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [clientSeed, setClientSeed] = useState('randomclientseed123');
  const [nonce, setNonce] = useState(101);

  // Refs for callbacks to access latest state without re-creating intervals
  const bet1Ref = useRef({ placed: false, cashedOut: false, autoCashout: '' });
  const bet2Ref = useRef({ placed: false, cashedOut: false, autoCashout: '' });
  const cdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bet1Ref.current = { placed: bet1Placed, cashedOut: bet1CashedOut, autoCashout: bet1AutoCashout };
  }, [bet1Placed, bet1CashedOut, bet1AutoCashout]);

  useEffect(() => {
    bet2Ref.current = { placed: bet2Placed, cashedOut: bet2CashedOut, autoCashout: bet2AutoCashout };
  }, [bet2Placed, bet2CashedOut, bet2AutoCashout]);

  // Socket connection
  const { socket, isConnected } = useSocket({ autoConnect: true });

  // Current balance
  const currentBalance = useMemo(() => {
    if (!user?.balances) return 0;
    const bal = user.balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [user?.balances, currency]);

  // =========================================================================
  // Fetch initial state from backend
  // =========================================================================

  const fetchInitialState = useCallback(async () => {
    try {
      const [currentState, historyData] = await Promise.all([
        get<CrashCurrentState>('/casino/crash/current'),
        get<CrashHistoryEntry[]>('/casino/crash/history'),
      ]);

      if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        setRoundHistory(
          historyData.map((h) => ({
            id: h.id,
            crashPoint: h.crashPoint,
            hash: h.serverSeedHash.slice(0, 12) + '...',
            timestamp: h.createdAt,
          }))
        );
      }

      if (currentState && currentState.roundId) {
        setCurrentRoundId(currentState.roundId);
        setServerSeedHash(currentState.serverSeedHash || serverSeedHash);

        const mappedBets: PlayerBet[] = (currentState.bets || []).map((b, idx) => ({
          id: `server-${b.userId}-${idx}`,
          username: b.username,
          betAmount: b.amount,
          currency: 'USDT',
          autoCashout: b.autoCashout,
          cashedOut: b.cashoutAt !== null,
          cashoutMultiplier: b.cashoutAt,
          payout: b.payout,
        }));
        setPlayers(mappedBets);

        if (currentState.phase === 'WAITING') {
          setGameStatus('waiting');
          setCurrentMultiplier(1.0);
          setCrashPoint(undefined);
        } else if (currentState.phase === 'RUNNING') {
          setGameStatus('running');
          setCurrentMultiplier(currentState.currentMultiplier);
          setCrashPoint(undefined);
        } else if (currentState.phase === 'CRASHED') {
          setGameStatus('crashed');
          setCurrentMultiplier(currentState.currentMultiplier);
          setCrashPoint(currentState.currentMultiplier);
        }

        return true;
      }

      setErrorMessage('No active crash round found. Please wait for the next round.');
      return false;
    } catch (err) {
      console.warn('[Crash] Backend unreachable:', err);
      setErrorMessage('Unable to connect to the game server. Please try again later.');
      return false;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // =========================================================================
  // Socket Event Handlers (real-time from backend)
  // =========================================================================

  useEffect(() => {
    if (!socket) return;

    const handleTick = (data: { roundId: string; multiplier: number; elapsed: number }) => {
      setGameStatus('running');
      setCurrentMultiplier(data.multiplier);
    };

    const handleCrashed = (data: {
      roundId: string;
      crashPoint: number;
      bets: Array<{
        userId: string;
        username: string;
        amount: number;
        cashoutAt: number | null;
        payout: number | null;
      }>;
    }) => {
      setGameStatus('crashed');
      setCrashPoint(data.crashPoint);
      setCurrentMultiplier(data.crashPoint);

      setPlayers((prev) =>
        prev.map((p) => {
          const serverBet = data.bets.find((b) => b.username === p.username);
          if (serverBet) {
            return {
              ...p,
              cashedOut: serverBet.cashoutAt !== null,
              cashoutMultiplier: serverBet.cashoutAt,
              payout: serverBet.payout ?? 0,
            };
          }
          if (!p.cashedOut) {
            return { ...p, payout: 0 };
          }
          return p;
        })
      );

      if (bet1Ref.current.placed && !bet1Ref.current.cashedOut) {
        // Bet was lost on crash
      }
      if (bet2Ref.current.placed && !bet2Ref.current.cashedOut) {
        // Bet was lost on crash
      }

      const newRound: CrashRound = {
        id: data.roundId,
        crashPoint: data.crashPoint,
        hash: generateId().slice(0, 12) + '...',
        timestamp: new Date().toISOString(),
      };
      setRoundHistory((prev) => [newRound, ...prev.slice(0, 19)]);
    };

    const handleNewRound = (data: {
      roundId: string;
      phase: string;
      serverSeedHash: string;
      countdown: number;
    }) => {
      setGameStatus('waiting');
      setCurrentMultiplier(1.0);
      setCrashPoint(undefined);
      setCurrentRoundId(data.roundId);
      setServerSeedHash(data.serverSeedHash);
      setCountdown(Math.ceil(data.countdown));
      setPlayers([]);

      setBet1Placed(false);
      setBet1CashedOut(false);
      setBet2Placed(false);
      setBet2CashedOut(false);

      let cd = Math.ceil(data.countdown);
      if (cdTimerRef.current) clearInterval(cdTimerRef.current);
      cdTimerRef.current = setInterval(() => {
        cd -= 1;
        setCountdown(cd);
        if (cd <= 0) {
          if (cdTimerRef.current) clearInterval(cdTimerRef.current);
          cdTimerRef.current = null;
        }
      }, 1000);
    };

    const handleStart = (data: { roundId: string }) => {
      setGameStatus('running');
      setCurrentMultiplier(1.0);
    };

    const handleBet = (data: {
      roundId: string;
      userId: string;
      username: string;
      amount: number;
      autoCashout: number | null;
    }) => {
      setPlayers((prev) => {
        if (prev.some((p) => p.username === data.username)) return prev;
        return [
          ...prev,
          {
            id: `srv-${data.userId}`,
            username: data.username,
            betAmount: data.amount,
            currency: 'USDT',
            autoCashout: data.autoCashout,
            cashedOut: false,
            cashoutMultiplier: null,
            payout: null,
          },
        ];
      });
    };

    const handleCashout = (data: {
      roundId: string;
      userId: string;
      username: string;
      multiplier: number;
      payout: number;
    }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.username === data.username
            ? {
                ...p,
                cashedOut: true,
                cashoutMultiplier: data.multiplier,
                payout: data.payout,
              }
            : p
        )
      );
    };

    socket.on('crash:tick', handleTick);
    socket.on('crash:crashed', handleCrashed);
    socket.on('crash:newRound', handleNewRound);
    socket.on('crash:start', handleStart);
    socket.on('crash:bet', handleBet);
    socket.on('crash:cashout', handleCashout);

    return () => {
      if (cdTimerRef.current) {
        clearInterval(cdTimerRef.current);
        cdTimerRef.current = null;
      }
      socket.off('crash:tick', handleTick);
      socket.off('crash:crashed', handleCrashed);
      socket.off('crash:newRound', handleNewRound);
      socket.off('crash:start', handleStart);
      socket.off('crash:bet', handleBet);
      socket.off('crash:cashout', handleCashout);
    };
  }, [socket]);

  // =========================================================================
  // Initialization: fetch backend state
  // =========================================================================

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await fetchInitialState();
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [fetchInitialState]);

  // =========================================================================
  // Bet Actions
  // =========================================================================

  const clearError = useCallback(() => {
    setTimeout(() => setErrorMessage(null), 4000);
  }, []);

  const placeBet = useCallback(
    async (slot: BetSlot) => {
      if (!isAuthenticated) {
        setErrorMessage('Please log in to place a bet.');
        clearError();
        return;
      }

      const amount = parseFloat(slot === 1 ? bet1Amount : bet2Amount);
      const autoCashoutStr = slot === 1 ? bet1AutoCashout : bet2AutoCashout;
      const autoCashoutVal = autoCashoutStr ? parseFloat(autoCashoutStr) : undefined;

      if (isNaN(amount) || amount <= 0) {
        setErrorMessage('Invalid bet amount.');
        clearError();
        return;
      }

      if (gameStatus !== 'waiting') {
        setErrorMessage('Round is not accepting bets right now.');
        clearError();
        return;
      }

      if (slot === 1) setBet1Loading(true);
      else setBet2Loading(true);

      try {
        const body: { betAmount: number; currency: string; autoCashout?: number } = {
          betAmount: amount,
          currency,
        };
        if (autoCashoutVal && autoCashoutVal > 1) {
          body.autoCashout = autoCashoutVal;
        }

        const result = await post<{ betId: string; roundId: string; newBalance?: number }>(
          '/casino/crash/bet',
          body
        );

        if (result.newBalance !== undefined) {
          const { updateBalance } = useAuthStore.getState();
          updateBalance(currency, result.newBalance, 0);
        }

        if (slot === 1) {
          setBet1Placed(true);
        } else {
          setBet2Placed(true);
        }

        setPlayers((prev) => {
          const myId = slot === 1 ? 'my-bet-1' : 'my-bet-2';
          if (prev.some((p) => p.id === myId)) return prev;
          return [
            {
              id: myId,
              username: user?.username || 'You',
              betAmount: amount,
              currency,
              autoCashout: autoCashoutVal ?? null,
              cashedOut: false,
              cashoutMultiplier: null,
              payout: null,
            },
            ...prev,
          ];
        });

        setErrorMessage(null);
      } catch (err: any) {
        const code = err?.errors?.code || err?.message || 'Unknown error';
        if (code.includes('INSUFFICIENT_BALANCE') || code.includes('insufficient')) {
          setErrorMessage('Insufficient balance. Please deposit funds.');
        } else if (code.includes('ROUND_NOT_ACCEPTING')) {
          setErrorMessage('Round is not accepting bets. Wait for the next round.');
        } else if (code.includes('ALREADY_BET')) {
          setErrorMessage('You already have a bet in this round.');
        } else {
          setErrorMessage(`Failed to place bet: ${code}`);
        }
        clearError();
      } finally {
        if (slot === 1) setBet1Loading(false);
        else setBet2Loading(false);
      }
    },
    [isAuthenticated, gameStatus, bet1Amount, bet2Amount, bet1AutoCashout, bet2AutoCashout, user, clearError, currency]
  );

  const cashOut = useCallback(
    async (slot: BetSlot) => {
      if (gameStatus !== 'running') return;

      const placed = slot === 1 ? bet1Placed : bet2Placed;
      const cashedOut = slot === 1 ? bet1CashedOut : bet2CashedOut;
      if (!placed || cashedOut) return;

      if (slot === 1) setBet1Loading(true);
      else setBet2Loading(true);

      try {
        const result = await post<{
          payout: number;
          multiplier: number;
          balances?: Array<{ currency: string; balance: number }>;
        }>('/casino/crash/cashout');

        if (result.balances) {
          const match = result.balances.find((b) => b.currency === currency);
          if (match) {
            const { updateBalance } = useAuthStore.getState();
            updateBalance(currency, match.balance, 0);
          }
        }

        if (slot === 1) {
          setBet1CashedOut(true);
        } else {
          setBet2CashedOut(true);
        }

        const myId = slot === 1 ? 'my-bet-1' : 'my-bet-2';
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === myId
              ? {
                  ...p,
                  cashedOut: true,
                  cashoutMultiplier: result.multiplier,
                  payout: result.payout,
                }
              : p
          )
        );

        setErrorMessage(null);
      } catch (err: any) {
        const code = err?.errors?.code || err?.message || 'Unknown error';
        if (code.includes('NOT_RUNNING')) {
          setErrorMessage('Round has already ended.');
        } else if (code.includes('NO_ACTIVE_BET')) {
          setErrorMessage('No active bet found to cash out.');
        } else {
          setErrorMessage(`Failed to cash out: ${code}`);
        }
        clearError();
      } finally {
        if (slot === 1) setBet1Loading(false);
        else setBet2Loading(false);
      }
    },
    [gameStatus, bet1Placed, bet1CashedOut, bet2Placed, bet2CashedOut, currentMultiplier, clearError, currency]
  );

  // =========================================================================
  // Computed values
  // =========================================================================

  const totalBetAmount = useMemo(
    () => players.reduce((sum, p) => sum + p.betAmount, 0),
    [players]
  );

  const getSlotButtonState = useCallback(
    (slot: BetSlot) => {
      const placed = slot === 1 ? bet1Placed : bet2Placed;
      const cashedOut = slot === 1 ? bet1CashedOut : bet2CashedOut;
      const amount = slot === 1 ? bet1Amount : bet2Amount;
      const loading = slot === 1 ? bet1Loading : bet2Loading;

      if (loading) {
        return { label: 'Processing...', disabled: true, action: 'none' as const };
      }

      if (gameStatus === 'waiting') {
        if (placed) return { label: 'Bet Placed', disabled: true, action: 'none' as const };
        return { label: 'Place Bet', disabled: !isAuthenticated, action: 'bet' as const };
      }
      if (gameStatus === 'running') {
        if (placed && !cashedOut) {
          return {
            label: `Cash Out ${formatCurrency((parseFloat(amount) || 0) * currentMultiplier, currency)}`,
            disabled: false,
            action: 'cashout' as const,
          };
        }
        if (cashedOut) return { label: 'Cashed Out!', disabled: true, action: 'none' as const };
        return { label: 'Waiting...', disabled: true, action: 'none' as const };
      }
      return { label: 'Next Round...', disabled: true, action: 'none' as const };
    },
    [gameStatus, bet1Placed, bet2Placed, bet1CashedOut, bet2CashedOut, bet1Amount, bet2Amount, bet1Loading, bet2Loading, currentMultiplier, isAuthenticated, currency]
  );

  const slot1Button = getSlotButtonState(1);
  const slot2Button = getSlotButtonState(2);

  // Quick bet presets
  const BET_PRESETS = ['0.01', '0.1', '1', '10', '100'];

  // =========================================================================
  // Render - Cloudbet Mobile Style (EXACT SPEC)
  // =========================================================================

  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl px-4 py-3 flex items-center gap-2 mx-4 mt-3"
          >
            <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <p className="text-sm text-[#EF4444] flex-1">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-[#EF4444]/60 hover:text-[#EF4444] text-xs font-medium"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Graph Area - Full Width Edge-to-Edge */}
      <div className="relative overflow-hidden bg-[#161B22]">
        <CrashGraph
          multiplier={currentMultiplier}
          status={gameStatus}
          crashPoint={crashPoint}
          className="h-[45vh] min-h-[220px] max-h-[360px]"
        />

        {/* Countdown overlay */}
        {gameStatus === 'waiting' && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0D1117]/70">
            <div className="text-center">
              <Timer className="w-5 h-5 text-[#8B949E] mx-auto mb-2" />
              <p className="text-xs text-[#8B949E] mb-1">Starting in</p>
              <motion.div
                key={countdown}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-5xl font-bold font-mono text-[#8B5CF6]"
              >
                {countdown}
              </motion.div>
              <p className="text-[10px] text-[#8B949E] mt-2">Place your bets now!</p>
            </div>
          </div>
        )}
      </div>

      {/* Round History Bubbles - Horizontal Scroll */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-3 px-4">
        {roundHistory.slice(0, 20).map((round, i) => (
          <motion.div
            key={round.id}
            initial={i === 0 ? { opacity: 0, scale: 0.5 } : false}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'shrink-0 w-[52px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-mono font-bold',
              round.crashPoint >= 10
                ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                : round.crashPoint >= 2
                ? 'bg-[#10B981]/15 text-[#10B981]'
                : 'bg-[#EF4444]/15 text-[#EF4444]'
            )}
          >
            {(round.crashPoint ?? 0).toFixed(2)}x
          </motion.div>
        ))}
      </div>

      {/* Content area with padding */}
      <div className="px-4 pb-20 space-y-3">

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setBetMode('manual')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-all duration-200',
              betMode === 'manual'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setBetMode('auto')}
            className={cn(
              'flex-1 py-2 px-6 text-sm font-bold transition-all duration-200',
              betMode === 'auto'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#8B949E]'
            )}
          >
            Auto
          </button>
        </div>

        {/* Two Bet Slots Side by Side */}
        <div className="grid grid-cols-2 gap-2">
          {/* Bet Slot 1 */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">Bet 1</div>

            {/* Bet Amount */}
            <div>
              <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                <span className="text-xs text-[#8B949E] mr-2">{currency}</span>
                <input
                  type="number"
                  value={bet1Amount}
                  onChange={(e) => setBet1Amount(e.target.value)}
                  min="0.1"
                  step="1"
                  className="flex-1 bg-transparent text-center text-sm font-mono text-[#E6EDF3] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const half = Math.max(0.1, parseFloat(bet1Amount) / 2).toFixed(2);
                      setBet1Amount(half);
                    }}
                    className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <button
                    onClick={() => {
                      const dbl = Math.min(10000, parseFloat(bet1Amount) * 2).toFixed(2);
                      setBet1Amount(dbl);
                    }}
                    className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
              {/* Quick Presets */}
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {BET_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setBet1Amount(p)}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors"
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const half = Math.max(0.1, parseFloat(bet1Amount) / 2).toFixed(2);
                    setBet1Amount(half);
                  }}
                  className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors"
                >
                  1/2
                </button>
                <button
                  onClick={() => {
                    const dbl = Math.min(10000, parseFloat(bet1Amount) * 2).toFixed(2);
                    setBet1Amount(dbl);
                  }}
                  className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors"
                >
                  2X
                </button>
              </div>
            </div>

            {/* Auto Cashout */}
            <div>
              <label className="text-[#8B949E] text-sm mb-1 block">Auto Cashout</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                <input
                  type="number"
                  value={bet1AutoCashout}
                  onChange={(e) => setBet1AutoCashout(e.target.value)}
                  min="1.01"
                  step="0.01"
                  placeholder="-"
                  className="flex-1 bg-transparent text-center text-sm font-mono text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-[#8B949E]">x</span>
              </div>
            </div>

            {/* Bet/Cashout Button */}
            <button
              disabled={slot1Button.disabled}
              onClick={() => {
                if (slot1Button.action === 'bet') placeBet(1);
                else if (slot1Button.action === 'cashout') cashOut(1);
              }}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-base transition-all duration-200',
                slot1Button.action === 'cashout'
                  ? 'bg-[#3D3D20] text-[#C8FF00] animate-pulse'
                  : slot1Button.disabled
                  ? 'bg-[#2D333B] text-white cursor-not-allowed opacity-50'
                  : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]'
              )}
            >
              {slot1Button.label}
            </button>
          </div>

          {/* Bet Slot 2 */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">Bet 2</div>

            {/* Bet Amount */}
            <div>
              <label className="text-[#8B949E] text-sm mb-1 block">Bet Amount</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                <span className="text-xs text-[#8B949E] mr-2">{currency}</span>
                <input
                  type="number"
                  value={bet2Amount}
                  onChange={(e) => setBet2Amount(e.target.value)}
                  min="0.1"
                  step="1"
                  className="flex-1 bg-transparent text-center text-sm font-mono text-[#E6EDF3] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const half = Math.max(0.1, parseFloat(bet2Amount) / 2).toFixed(2);
                      setBet2Amount(half);
                    }}
                    className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <button
                    onClick={() => {
                      const dbl = Math.min(10000, parseFloat(bet2Amount) * 2).toFixed(2);
                      setBet2Amount(dbl);
                    }}
                    className="w-6 h-6 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] text-xs font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
              {/* Quick Presets */}
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {BET_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setBet2Amount(p)}
                    className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors"
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const half = Math.max(0.1, parseFloat(bet2Amount) / 2).toFixed(2);
                    setBet2Amount(half);
                  }}
                  className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors"
                >
                  1/2
                </button>
                <button
                  onClick={() => {
                    const dbl = Math.min(10000, parseFloat(bet2Amount) * 2).toFixed(2);
                    setBet2Amount(dbl);
                  }}
                  className="bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors"
                >
                  2X
                </button>
              </div>
            </div>

            {/* Auto Cashout */}
            <div>
              <label className="text-[#8B949E] text-sm mb-1 block">Auto Cashout</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3">
                <input
                  type="number"
                  value={bet2AutoCashout}
                  onChange={(e) => setBet2AutoCashout(e.target.value)}
                  min="1.01"
                  step="0.01"
                  placeholder="-"
                  className="flex-1 bg-transparent text-center text-sm font-mono text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-[#8B949E]">x</span>
              </div>
            </div>

            {/* Bet/Cashout Button */}
            <button
              disabled={slot2Button.disabled}
              onClick={() => {
                if (slot2Button.action === 'bet') placeBet(2);
                else if (slot2Button.action === 'cashout') cashOut(2);
              }}
              className={cn(
                'w-full py-3.5 rounded-xl font-bold text-base transition-all duration-200',
                slot2Button.action === 'cashout'
                  ? 'bg-[#3D3D20] text-[#C8FF00] animate-pulse'
                  : slot2Button.disabled
                  ? 'bg-[#2D333B] text-white cursor-not-allowed opacity-50'
                  : 'bg-[#C8FF00] text-black hover:bg-[#B8EF00]'
              )}
            >
              {slot2Button.label}
            </button>
          </div>
        </div>

        {/* Active Players - Compact Scrollable List */}
        {players.length > 0 && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#30363D]">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[#8B949E]" />
                <span className="text-xs font-semibold text-[#8B949E]">Players</span>
              </div>
              <span className="text-[10px] font-mono text-[#8B949E]">{players.length} bets</span>
            </div>
            <div className="max-h-[180px] overflow-y-auto">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center justify-between px-4 py-2 border-b border-[#30363D]/50 last:border-0',
                    player.id.startsWith('my-bet') && 'bg-[#8B5CF6]/5'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#1C2128] flex items-center justify-center text-[10px] font-bold text-[#8B949E] shrink-0">
                      {(player.username || 'U')[0]}
                    </div>
                    <span className={cn(
                      'text-xs truncate max-w-[70px]',
                      player.id.startsWith('my-bet') ? 'font-bold text-[#8B5CF6]' : 'text-[#E6EDF3]'
                    )}>
                      {player.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[#8B949E]">
                      {formatCurrency(player.betAmount, player.currency)}
                    </span>
                    {player.cashedOut && player.cashoutMultiplier ? (
                      <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded-full">
                        {(player.cashoutMultiplier ?? 0).toFixed(2)}x
                      </span>
                    ) : gameStatus === 'crashed' && !player.cashedOut ? (
                      <span className="text-[10px] font-bold text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-full">
                        Bust
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#8B949E]">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        {/* Left icons */}
        <div className="flex items-center gap-3">
          <Link href="/casino" className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Home className="w-6 h-6" />
          </Link>
          <button className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
            <Info className="w-6 h-6" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>
        </div>

        {/* Center balance */}
        <span className="text-sm font-mono text-white">
          {formatCurrency(currentBalance, currency)} {currency}
        </span>

        {/* Right - Provably Fair Game badge */}
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <span className="text-xs text-[#8B5CF6]">Provably Fair Game</span>
        </div>
      </div>
    </div>
  );
}
