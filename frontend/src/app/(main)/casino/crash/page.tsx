'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  History,
  Zap,
  Shield,
  Clock,
  Volume2,
  VolumeX,
  Settings,
  Minus,
  Plus,
  ToggleLeft,
  ToggleRight,
  Rocket,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import { cn, formatCurrency, formatRelativeDate, generateId, getDefaultBet } from '@/lib/utils';
import { get, post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { useSocket, useSocketEvent } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import CrashGraph, { type CrashStatus } from '@/components/casino/CrashGraph';
import ProvablyFair from '@/components/casino/ProvablyFair';

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
// Crash Game Page
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
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeBetSlot, setActiveBetSlot] = useState<BetSlot>(1);

  // Provably fair seeds
  const [serverSeedHash, setServerSeedHash] = useState(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  const [clientSeed, setClientSeed] = useState('randomclientseed123');
  const [nonce, setNonce] = useState(101);


  // Refs for callbacks to access latest state without re-creating intervals
  const bet1Ref = useRef({ placed: false, cashedOut: false, autoCashout: '' });
  const bet2Ref = useRef({ placed: false, cashedOut: false, autoCashout: '' });

  useEffect(() => {
    bet1Ref.current = { placed: bet1Placed, cashedOut: bet1CashedOut, autoCashout: bet1AutoCashout };
  }, [bet1Placed, bet1CashedOut, bet1AutoCashout]);

  useEffect(() => {
    bet2Ref.current = { placed: bet2Placed, cashedOut: bet2CashedOut, autoCashout: bet2AutoCashout };
  }, [bet2Placed, bet2CashedOut, bet2AutoCashout]);


  // Socket connection
  const { socket, isConnected } = useSocket({ autoConnect: true });

  // =========================================================================
  // Fetch initial state from backend
  // =========================================================================

  const fetchInitialState = useCallback(async () => {
    try {
      const [currentState, historyData] = await Promise.all([
        get<CrashCurrentState>('/casino/crash/current'),
        get<CrashHistoryEntry[]>('/casino/crash/history'),
      ]);

      // Map history to our frontend format
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

      // Apply current round state
      if (currentState && currentState.roundId) {
        setCurrentRoundId(currentState.roundId);
        setServerSeedHash(currentState.serverSeedHash || serverSeedHash);

        // Map backend bets to our PlayerBet format
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

      // Backend returned no active round
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

    // --- crash:tick - multiplier updates while running ---
    const handleTick = (data: { roundId: string; multiplier: number; elapsed: number }) => {
      setGameStatus('running');
      setCurrentMultiplier(data.multiplier);
    };

    // --- crash:crashed (bust) - round ended ---
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

      // Update players with final settlement
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
          // If player didn't cash out, they busted
          if (!p.cashedOut) {
            return { ...p, payout: 0 };
          }
          return p;
        })
      );

      // Mark user bets as lost if not cashed out
      if (bet1Ref.current.placed && !bet1Ref.current.cashedOut) {
        // Bet was lost on crash
      }
      if (bet2Ref.current.placed && !bet2Ref.current.cashedOut) {
        // Bet was lost on crash
      }

      // Add to history
      const newRound: CrashRound = {
        id: data.roundId,
        crashPoint: data.crashPoint,
        hash: generateId().slice(0, 12) + '...',
        timestamp: new Date().toISOString(),
      };
      setRoundHistory((prev) => [newRound, ...prev.slice(0, 19)]);
    };

    // --- crash:newRound - new round starting (WAITING phase) ---
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

      // Reset user bet state for new round
      setBet1Placed(false);
      setBet1CashedOut(false);
      setBet2Placed(false);
      setBet2CashedOut(false);

      // Countdown ticker
      let cd = Math.ceil(data.countdown);
      const cdTimer = setInterval(() => {
        cd -= 1;
        setCountdown(cd);
        if (cd <= 0) {
          clearInterval(cdTimer);
        }
      }, 1000);
    };

    // --- crash:start - round transitions from WAITING to RUNNING ---
    const handleStart = (data: { roundId: string }) => {
      setGameStatus('running');
      setCurrentMultiplier(1.0);
    };

    // --- crash:bet - another player placed a bet ---
    const handleBet = (data: {
      roundId: string;
      userId: string;
      username: string;
      amount: number;
      autoCashout: number | null;
    }) => {
      setPlayers((prev) => {
        // Avoid duplicates
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

    // --- crash:cashout - another player cashed out ---
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

      // --- Call backend API ---
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

        // Update balance in auth store (bet deducted)
        if (result.newBalance !== undefined) {
          const { updateBalance } = useAuthStore.getState();
          updateBalance(currency, result.newBalance, 0);
        }

        if (slot === 1) {
          setBet1Placed(true);
        } else {
          setBet2Placed(true);
        }

        // Add self to players list (the server will also broadcast crash:bet)
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

      // --- Call backend API ---
      if (slot === 1) setBet1Loading(true);
      else setBet2Loading(true);

      try {
        const result = await post<{
          payout: number;
          multiplier: number;
          balances?: Array<{ currency: string; balance: number }>;
        }>('/casino/crash/cashout');

        // Update balance in auth store (winnings credited)
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
    [gameStatus, bet1Placed, bet1CashedOut, bet2Placed, bet2CashedOut, currentMultiplier, clearError]
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
        return { label: 'Processing...', disabled: true, variant: 'secondary' as const };
      }

      if (gameStatus === 'waiting') {
        if (placed) return { label: 'Bet Placed', disabled: true, variant: 'secondary' as const };
        return { label: `Bet ${formatCurrency(parseFloat(amount) || 0, currency)}`, disabled: !isAuthenticated, variant: 'primary' as const };
      }
      if (gameStatus === 'running') {
        if (placed && !cashedOut) {
          return {
            label: `Cash Out ${formatCurrency((parseFloat(amount) || 0) * currentMultiplier, currency)}`,
            disabled: false,
            variant: 'success' as const,
          };
        }
        if (cashedOut) return { label: 'Cashed Out!', disabled: true, variant: 'secondary' as const };
        return { label: 'Waiting...', disabled: true, variant: 'secondary' as const };
      }
      return { label: 'Next Round...', disabled: true, variant: 'secondary' as const };
    },
    [gameStatus, bet1Placed, bet2Placed, bet1CashedOut, bet2CashedOut, bet1Amount, bet2Amount, bet1Loading, bet2Loading, currentMultiplier, isAuthenticated, currency]
  );

  const slot1Button = getSlotButtonState(1);
  const slot2Button = getSlotButtonState(2);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-3 sm:space-y-4 px-1 sm:px-0 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/casino"
            className="p-2 rounded-button bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#E6EDF3] flex items-center gap-1.5 sm:gap-2">
              <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-[#EF4444]" />
              Crash

            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="default" size="xs">CryptoBet</Badge>
              <Badge variant="live" size="xs" dot pulse>
                  Live
                </Badge>
              <span className="text-xs text-[#8B949E]">
                <Users className="w-3 h-3 inline mr-0.5" />
                {players.length} playing
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-button bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-2 rounded-button border transition-all duration-200',
              showSettings
                ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#8B5CF6]'
                : 'bg-[#161B22] border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58]'
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Error Banner */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-card px-4 py-3 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <p className="text-sm text-[#EF4444]">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-auto text-[#EF4444]/60 hover:text-[#EF4444] text-xs"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round History Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-1"
      >
        {roundHistory.slice(0, 15).map((round, i) => (
          <motion.div
            key={round.id}
            initial={i === 0 ? { opacity: 0, scale: 0.5, x: -20 } : false}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-button text-xs font-mono font-bold cursor-default border transition-all duration-200 hover:scale-105',
              round.crashPoint >= 10
                ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                : round.crashPoint >= 2
                ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
            )}
          >
            {(round.crashPoint ?? 0).toFixed(2)}x
          </motion.div>
        ))}
      </motion.div>

      {/* Main Layout: Graph + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Graph Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-2"
        >
          <div className="relative">
            <CrashGraph
              multiplier={currentMultiplier}
              status={gameStatus}
              crashPoint={crashPoint}
              className="h-[220px] sm:h-[300px] md:h-[400px]"
            />

            {/* Countdown overlay */}
            {gameStatus === 'waiting' && countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0D1117]/60 rounded-card border border-[#30363D]">
                <div className="text-center">
                  <Timer className="w-6 h-6 text-[#8B949E] mx-auto mb-2" />
                  <p className="text-sm text-[#8B949E] mb-2">Starting in</p>
                  <motion.div
                    key={countdown}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-4xl sm:text-6xl font-bold font-mono text-[#8B5CF6]"
                  >
                    {countdown}
                  </motion.div>
                  <p className="text-xs text-[#8B949E] mt-3">
                    Place your bets now!
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Bet Controls Panel */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-4"
        >
          {/* Bet Slot Tabs */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-card overflow-hidden">
            <div className="flex border-b border-[#30363D]">
              <button
                onClick={() => setActiveBetSlot(1)}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-all duration-200',
                  activeBetSlot === 1
                    ? 'text-[#E6EDF3] bg-[#1C2128] border-b-2 border-[#8B5CF6]'
                    : 'text-[#8B949E] hover:text-[#E6EDF3]'
                )}
              >
                Bet 1
              </button>
              <button
                onClick={() => setActiveBetSlot(2)}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-all duration-200',
                  activeBetSlot === 2
                    ? 'text-[#E6EDF3] bg-[#1C2128] border-b-2 border-[#8B5CF6]'
                    : 'text-[#8B949E] hover:text-[#E6EDF3]'
                )}
              >
                Bet 2
              </button>
            </div>

            <div className="p-3 sm:p-4 space-y-3">
              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-[#8B949E] mb-1.5">
                  Bet Amount
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={activeBetSlot === 1 ? bet1Amount : bet2Amount}
                      onChange={(e) =>
                        activeBetSlot === 1
                          ? setBet1Amount(e.target.value)
                          : setBet2Amount(e.target.value)
                      }
                      min="0.1"
                      step="1"
                      className="w-full h-10 px-3 pr-14 bg-[#0D1117] border border-[#30363D] rounded-input text-sm font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8B949E]">
                      {currency}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const val = activeBetSlot === 1 ? bet1Amount : bet2Amount;
                      const half = Math.max(0.1, parseFloat(val) / 2).toFixed(2);
                      activeBetSlot === 1 ? setBet1Amount(half) : setBet2Amount(half);
                    }}
                    className="px-2 py-2 bg-[#0D1117] border border-[#30363D] rounded-input text-xs font-semibold text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
                  >
                    1/2
                  </button>
                  <button
                    onClick={() => {
                      const val = activeBetSlot === 1 ? bet1Amount : bet2Amount;
                      const dbl = Math.min(10000, parseFloat(val) * 2).toFixed(2);
                      activeBetSlot === 1 ? setBet1Amount(dbl) : setBet2Amount(dbl);
                    }}
                    className="px-2 py-2 bg-[#0D1117] border border-[#30363D] rounded-input text-xs font-semibold text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
                  >
                    2x
                  </button>
                </div>
              </div>

              {/* Auto Cashout */}
              <div>
                <label className="block text-xs font-medium text-[#8B949E] mb-1.5">
                  Auto Cash Out
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={activeBetSlot === 1 ? bet1AutoCashout : bet2AutoCashout}
                    onChange={(e) =>
                      activeBetSlot === 1
                        ? setBet1AutoCashout(e.target.value)
                        : setBet2AutoCashout(e.target.value)
                    }
                    min="1.01"
                    step="0.01"
                    placeholder="Disabled"
                    className="w-full h-10 px-3 pr-8 bg-[#0D1117] border border-[#30363D] rounded-input text-sm font-mono text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:border-[#8B5CF6] transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8B949E]">
                    x
                  </span>
                </div>
              </div>

              {/* Bet/Cashout Button */}
              {activeBetSlot === 1 ? (
                <Button
                  variant={slot1Button.variant}
                  size="lg"
                  fullWidth
                  disabled={slot1Button.disabled}
                  onClick={() => {
                    if (gameStatus === 'waiting' && !bet1Placed) placeBet(1);
                    else if (gameStatus === 'running' && bet1Placed && !bet1CashedOut) cashOut(1);
                  }}
                  className={cn(
                    'font-bold text-base',
                    gameStatus === 'running' && bet1Placed && !bet1CashedOut
                      ? 'animate-pulse-slow'
                      : ''
                  )}
                >
                  {slot1Button.label}
                </Button>
              ) : (
                <Button
                  variant={slot2Button.variant}
                  size="lg"
                  fullWidth
                  disabled={slot2Button.disabled}
                  onClick={() => {
                    if (gameStatus === 'waiting' && !bet2Placed) placeBet(2);
                    else if (gameStatus === 'running' && bet2Placed && !bet2CashedOut) cashOut(2);
                  }}
                  className={cn(
                    'font-bold text-base',
                    gameStatus === 'running' && bet2Placed && !bet2CashedOut
                      ? 'animate-pulse-slow'
                      : ''
                  )}
                >
                  {slot2Button.label}
                </Button>
              )}

              {/* Auto-Bet Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#8B949E]">Auto-Bet</span>
                <button
                  onClick={() => setAutoBetEnabled(!autoBetEnabled)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium transition-colors',
                    autoBetEnabled ? 'text-[#8B5CF6]' : 'text-[#8B949E]'
                  )}
                >
                  {autoBetEnabled ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5" />
                  )}
                  {autoBetEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 text-center">
              <p className="text-[10px] text-[#8B949E] uppercase tracking-wider">
                Players
              </p>
              <p className="text-lg font-bold font-mono text-[#E6EDF3] mt-0.5">
                {players.length}
              </p>
            </div>
            <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3 text-center">
              <p className="text-[10px] text-[#8B949E] uppercase tracking-wider">
                Total Bet
              </p>
              <p className="text-lg font-bold font-mono text-[#E6EDF3] mt-0.5">
                ${totalBetAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Player Bets Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-[#161B22] border-[#30363D]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8B949E]" />
              Player Bets
              <Badge variant="default" size="xs">
                {players.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="sticky top-0 bg-[#161B22]">
                  <tr className="text-[#8B949E] text-[10px] sm:text-xs border-b border-[#30363D]">
                    <th className="text-left py-2 px-1.5 sm:px-3 font-medium">Player</th>
                    <th className="text-right py-2 px-1.5 sm:px-3 font-medium">Bet</th>
                    <th className="text-right py-2 px-1.5 sm:px-3 font-medium hidden sm:table-cell">Auto</th>
                    <th className="text-right py-2 px-1.5 sm:px-3 font-medium">Cashout</th>
                    <th className="text-right py-2 px-1.5 sm:px-3 font-medium">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr
                      key={player.id}
                      className={cn(
                        'border-b border-[#30363D]/50 transition-colors',
                        player.id.startsWith('my-bet')
                          ? 'bg-[#8B5CF6]/5'
                          : 'hover:bg-[#1C2128]'
                      )}
                    >
                      <td className="py-2 px-1.5 sm:py-2.5 sm:px-3">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#1C2128] flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-[#8B949E] shrink-0">
                            {(player.username || 'U')[0]}
                          </div>
                          <span
                            className={cn(
                              'text-xs sm:text-sm truncate max-w-[60px] sm:max-w-none',
                              player.id.startsWith('my-bet')
                                ? 'font-semibold text-[#8B5CF6]'
                                : 'text-[#E6EDF3]'
                            )}
                          >
                            {player.username}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-1.5 sm:py-2.5 sm:px-3 text-right font-mono text-[#E6EDF3]">
                        {formatCurrency(player.betAmount, player.currency)}
                      </td>
                      <td className="py-2 px-1.5 sm:py-2.5 sm:px-3 text-right font-mono text-[#8B949E] hidden sm:table-cell">
                        {player.autoCashout ? `${player.autoCashout}x` : '-'}
                      </td>
                      <td className="py-2 px-1.5 sm:py-2.5 sm:px-3 text-right">
                        {player.cashedOut && player.cashoutMultiplier ? (
                          <Badge variant="success" size="xs">
                            {(player.cashoutMultiplier ?? 0).toFixed(2)}x
                          </Badge>
                        ) : gameStatus === 'crashed' && !player.cashedOut ? (
                          <Badge variant="danger" size="xs">
                            Busted
                          </Badge>
                        ) : (
                          <span className="text-xs text-[#8B949E]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-1.5 sm:py-2.5 sm:px-3 text-right font-mono">
                        {player.cashedOut && player.payout && player.payout > 0 ? (
                          <span className="text-[#10B981] font-semibold">
                            +{formatCurrency(player.payout - player.betAmount, player.currency)}
                          </span>
                        ) : gameStatus === 'crashed' && !player.cashedOut ? (
                          <span className="text-[#EF4444]">
                            -{formatCurrency(player.betAmount, player.currency)}
                          </span>
                        ) : (
                          <span className="text-[#8B949E]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Provably Fair */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <ProvablyFair
          serverSeedHash={serverSeedHash}
          clientSeed={clientSeed}
          nonce={nonce}
          onClientSeedChange={setClientSeed}
        />
      </motion.div>

      {/* Game Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="bg-[#161B22] border border-[#30363D] rounded-card p-4"
      >
        <div className="flex flex-wrap gap-3 sm:gap-6 text-[10px] sm:text-xs text-[#8B949E]">
          <div>
            <span className="text-[#6E7681]">Provider:</span>{' '}
            <span className="text-[#E6EDF3]">CryptoBet Originals</span>
          </div>
          <div>
            <span className="text-[#6E7681]">House Edge:</span>{' '}
            <span className="text-[#E6EDF3] font-mono">3%</span>
          </div>
          <div>
            <span className="text-[#6E7681]">Max Win:</span>{' '}
            <span className="text-[#E6EDF3] font-mono">1,000,000x</span>
          </div>
          <div>
            <span className="text-[#6E7681]">Min Bet:</span>{' '}
            <span className="text-[#E6EDF3] font-mono">$0.10 {currency}</span>
          </div>
          <div>
            <span className="text-[#6E7681]">Mode:</span>{' '}
            <span className="font-mono text-[#10B981]">Live</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#8B949E] leading-relaxed">
          Place your bet before the round starts. Once the multiplier begins rising, click
          &quot;Cash Out&quot; at any time to lock in your profit. If you don&apos;t cash out before
          the crash, you lose your bet. Set an auto-cashout target to automatically secure
          your winnings at a specific multiplier.
        </p>
      </motion.div>
    </div>
  );
}
