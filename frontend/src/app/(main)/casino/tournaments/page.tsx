'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Timer, Users, Star, ChevronRight, Zap, Crown,
  Medal, Clock, DollarSign, Play, Shield, TrendingUp,
  Target, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { post, get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
type ScoringType = 'highest_multiplier' | 'most_profit' | 'wagering_volume';
type Tab = 'active' | 'upcoming' | 'completed';

interface TournamentListEntry {
  id: string;
  name: string;
  description: string;
  game: string;
  entryFee: number;
  currency: string;
  prizePool: number;
  startTime: string;
  endTime: string;
  status: TournamentStatus;
  scoringType: ScoringType;
  participantCount: number;
  maxParticipants: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  roundsPlayed: number;
  prize: number;
}

interface TournamentDetail {
  tournament: {
    id: string;
    name: string;
    description: string;
    game: string;
    entryFee: number;
    currency: string;
    prizePool: number;
    startTime: string;
    endTime: string;
    status: TournamentStatus;
    scoringType: ScoringType;
    maxParticipants: number;
    minParticipants: number;
    participants: any[];
    createdAt: string;
  };
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
  isJoined: boolean;
}

// ---------------------------------------------------------------------------
// Game icons / labels
// ---------------------------------------------------------------------------

const GAME_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  dice: { icon: '\uD83C\uDFB2', label: 'Dice', color: '#8B5CF6' },
  crash: { icon: '\uD83D\uDE80', label: 'Crash', color: '#EF4444' },
  coinflip: { icon: '\uD83E\uDE99', label: 'Coinflip', color: '#F59E0B' },
  mines: { icon: '\uD83D\uDCA3', label: 'Mines', color: '#10B981' },
  plinko: { icon: '\uD83D\uDD35', label: 'Plinko', color: '#3B82F6' },
  roulette: { icon: '\uD83C\uDFB0', label: 'Roulette', color: '#EC4899' },
  blackjack: { icon: '\uD83C\uDCA1', label: 'Blackjack', color: '#14B8A6' },
  limbo: { icon: '\uD83C\uDF1F', label: 'Limbo', color: '#F97316' },
  hilo: { icon: '\u2B06\uFE0F', label: 'HiLo', color: '#6366F1' },
  virtualsports: { icon: '\u26BD', label: 'Virtual Sports', color: '#10B981' },
};

function getGameConfig(slug: string) {
  return GAME_CONFIG[slug] || { icon: '\uD83C\uDFAE', label: slug, color: '#8B5CF6' };
}

// ---------------------------------------------------------------------------
// Scoring label
// ---------------------------------------------------------------------------

function scoringLabel(type: ScoringType): string {
  switch (type) {
    case 'highest_multiplier': return 'Highest Multiplier';
    case 'most_profit': return 'Most Profit';
    case 'wagering_volume': return 'Wagering Volume';
    default: return type;
  }
}

function scoringUnit(type: ScoringType): string {
  switch (type) {
    case 'highest_multiplier': return 'x';
    case 'most_profit': return '';
    case 'wagering_volume': return '';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------

function useCountdown(targetDate: string | Date) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const target = new Date(targetDate).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

// ---------------------------------------------------------------------------
// Tournament card
// ---------------------------------------------------------------------------

function TournamentCard({
  tournament,
  onSelect,
}: {
  tournament: TournamentListEntry;
  onSelect: (id: string) => void;
}) {
  const gameCfg = getGameConfig(tournament.game);
  const isActive = tournament.status === 'active';
  const isUpcoming = tournament.status === 'upcoming';
  const isCompleted = tournament.status === 'completed';

  const endCountdown = useCountdown(tournament.endTime);
  const startCountdown = useCountdown(tournament.startTime);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={() => onSelect(tournament.id)}
      className={cn(
        'bg-[#161B22] rounded-xl border p-4 cursor-pointer transition-all',
        isActive
          ? 'border-emerald-500/30 hover:border-emerald-500/50'
          : isUpcoming
            ? 'border-yellow-500/20 hover:border-yellow-500/40'
            : 'border-gray-800/50 hover:border-gray-700/50',
      )}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{gameCfg.icon}</span>
          <div>
            <div className="text-sm font-semibold text-white">{tournament.name}</div>
            <div className="text-[10px] text-gray-500">{gameCfg.label}</div>
          </div>
        </div>
        <div
          className={cn(
            'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
            isActive
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : isUpcoming
                ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                : 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
          )}
        >
          {isActive && (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 align-middle"
            />
          )}
          {tournament.status}
        </div>
      </div>

      {/* Prize pool */}
      <div className="bg-[#0D1117] rounded-lg p-3 mb-3 border border-gray-800/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Prize Pool</div>
            <div className="text-lg font-bold font-mono text-yellow-400">
              {tournament.prizePool.toFixed(2)} {tournament.currency}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Entry Fee</div>
            <div className="text-sm font-bold font-mono text-white">
              {tournament.entryFee.toFixed(2)} {tournament.currency}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[#0D1117] rounded-md p-2 text-center border border-gray-800/20">
          <Users className="w-3 h-3 text-gray-500 mx-auto mb-0.5" />
          <div className="text-xs font-mono text-white">{tournament.participantCount}/{tournament.maxParticipants}</div>
          <div className="text-[9px] text-gray-600">Players</div>
        </div>
        <div className="bg-[#0D1117] rounded-md p-2 text-center border border-gray-800/20">
          <Target className="w-3 h-3 text-gray-500 mx-auto mb-0.5" />
          <div className="text-[10px] font-mono text-white leading-tight">{scoringLabel(tournament.scoringType).split(' ').map(w => w[0]).join('')}</div>
          <div className="text-[9px] text-gray-600">Scoring</div>
        </div>
        <div className="bg-[#0D1117] rounded-md p-2 text-center border border-gray-800/20">
          <Clock className="w-3 h-3 text-gray-500 mx-auto mb-0.5" />
          <div className="text-[10px] font-mono text-white leading-tight">
            {isActive ? endCountdown : isUpcoming ? startCountdown : 'Done'}
          </div>
          <div className="text-[9px] text-gray-600">{isActive ? 'Left' : isUpcoming ? 'Starts' : 'Status'}</div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-gray-500">{scoringLabel(tournament.scoringType)}</div>
        <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
          View Details
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tournament detail modal
// ---------------------------------------------------------------------------

function TournamentDetailView({
  detail,
  onClose,
  onJoin,
  isJoining,
}: {
  detail: TournamentDetail;
  onClose: () => void;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const t = detail.tournament;
  const gameCfg = getGameConfig(t.game);
  const isActive = t.status === 'active';
  const isUpcoming = t.status === 'upcoming';
  const isCompleted = t.status === 'completed';

  const endCountdown = useCountdown(t.endTime);
  const startCountdown = useCountdown(t.startTime);

  // Prize breakdown
  const prizeBreakdown = [
    { rank: 1, pct: '50%', amount: t.prizePool * 0.5, icon: Crown, color: '#FFD700' },
    { rank: 2, pct: '25%', amount: t.prizePool * 0.25, icon: Medal, color: '#C0C0C0' },
    { rank: 3, pct: '15%', amount: t.prizePool * 0.15, icon: Medal, color: '#CD7F32' },
    { rank: 4, pct: '5%', amount: t.prizePool * 0.05, icon: Award, color: '#8B5CF6' },
    { rank: 5, pct: '5%', amount: t.prizePool * 0.05, icon: Award, color: '#8B5CF6' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#161B22] rounded-2xl border border-gray-800/50 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: gameCfg.color + '20' }}
              >
                {gameCfg.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t.name}</h2>
                <p className="text-xs text-gray-500">{gameCfg.label} - {scoringLabel(t.scoringType)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#0D1117] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              &times;
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-4">{t.description}</p>

          {/* Timer bar */}
          <div className={cn(
            'rounded-lg p-3 border flex items-center justify-between',
            isActive
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : isUpcoming
                ? 'bg-yellow-500/5 border-yellow-500/20'
                : 'bg-gray-500/5 border-gray-500/20',
          )}>
            <div className="flex items-center gap-2">
              <Timer className={cn('w-4 h-4', isActive ? 'text-emerald-400' : isUpcoming ? 'text-yellow-400' : 'text-gray-400')} />
              <span className="text-xs text-gray-400">
                {isActive ? 'Ends in' : isUpcoming ? 'Starts in' : 'Tournament ended'}
              </span>
            </div>
            <span className={cn(
              'text-sm font-bold font-mono',
              isActive ? 'text-emerald-400' : isUpcoming ? 'text-yellow-400' : 'text-gray-400',
            )}>
              {isActive ? endCountdown : isUpcoming ? startCountdown : 'Finished'}
            </span>
          </div>
        </div>

        {/* Prize Pool & Info */}
        <div className="p-6 border-b border-gray-800/50">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#0D1117] rounded-lg p-4 border border-gray-800/30 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Prize Pool</div>
              <div className="text-2xl font-bold font-mono text-yellow-400">
                {t.prizePool.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">{t.currency}</div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-4 border border-gray-800/30 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Entry Fee</div>
              <div className="text-2xl font-bold font-mono text-white">
                {t.entryFee.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">{t.currency}</div>
            </div>
          </div>

          {/* Prize breakdown */}
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Prize Distribution</h3>
          <div className="space-y-2">
            {prizeBreakdown.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.rank}
                  className={cn(
                    'flex items-center justify-between p-2.5 rounded-lg border',
                    p.rank <= 3
                      ? 'bg-[#0D1117] border-gray-700/30'
                      : 'bg-[#0D1117] border-gray-800/20',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: p.color + '20' }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">
                        {p.rank === 1 ? '1st Place' : p.rank === 2 ? '2nd Place' : p.rank === 3 ? '3rd Place' : `${p.rank}th Place`}
                      </div>
                      <div className="text-[10px] text-gray-500">{p.pct} of pool</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono text-yellow-400">
                    {p.amount.toFixed(2)} {t.currency}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="p-6 border-b border-gray-800/50">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Leaderboard ({detail.leaderboard.length} players)
          </h3>

          {detail.leaderboard.length === 0 ? (
            <div className="bg-[#0D1117] rounded-lg p-8 text-center border border-gray-800/20">
              <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <div className="text-sm text-gray-600">No participants yet. Be the first to join!</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {detail.leaderboard.map((entry) => {
                const isCurrentUser = entry.userId === user?.id;
                const isTop3 = entry.rank <= 3;
                const rankColors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

                return (
                  <div
                    key={entry.userId}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-all',
                      isCurrentUser
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : isTop3
                          ? 'bg-[#0D1117] border-gray-700/30'
                          : 'bg-[#0D1117] border-gray-800/20',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank badge */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: (rankColors[entry.rank] || '#374151') + '20',
                          color: rankColors[entry.rank] || '#9CA3AF',
                        }}
                      >
                        {entry.rank}
                      </div>
                      <div>
                        <div className={cn('text-sm font-medium', isCurrentUser ? 'text-purple-400' : 'text-white')}>
                          {entry.username}
                          {isCurrentUser && <span className="text-[10px] ml-1 text-purple-400">(You)</span>}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {entry.roundsPlayed} rounds played
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-white">
                        {entry.score.toFixed(2)}{scoringUnit(t.scoringType)}
                      </div>
                      {entry.prize > 0 && (
                        <div className="text-[10px] font-mono text-yellow-400">
                          +{entry.prize.toFixed(2)} {t.currency}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* User rank */}
          {detail.isJoined && detail.userRank !== null && (
            <div className="mt-3 bg-purple-500/10 rounded-lg p-3 border border-purple-500/30 text-center">
              <span className="text-xs text-purple-400">Your current rank: </span>
              <span className="text-sm font-bold text-purple-300">#{detail.userRank}</span>
            </div>
          )}
        </div>

        {/* Join / Action */}
        <div className="p-6">
          {isCompleted ? (
            <div className="bg-gray-500/10 rounded-lg p-4 text-center border border-gray-500/20">
              <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-white mb-1">Tournament Completed</div>
              {detail.leaderboard.length > 0 && (
                <div className="text-xs text-gray-400">
                  Winner: <span className="text-yellow-400 font-semibold">{detail.leaderboard[0]?.username}</span> with score {detail.leaderboard[0]?.score.toFixed(2)}
                </div>
              )}
            </div>
          ) : detail.isJoined ? (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 rounded-lg p-4 text-center border border-emerald-500/30">
                <Zap className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-sm font-semibold text-emerald-400">You are in this tournament!</div>
                <div className="text-xs text-gray-400 mt-1">
                  Play {gameCfg.label} to improve your score. {isUpcoming ? 'Tournament has not started yet.' : ''}
                </div>
              </div>
              {isActive && (
                <a
                  href={`/casino/${t.game === 'virtualsports' ? 'virtualsports' : t.game}`}
                  className="block w-full py-3 rounded-lg font-semibold text-sm text-center bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" />
                    Play {gameCfg.label} Now
                  </span>
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={onJoin}
                disabled={isJoining}
                className={cn(
                  'w-full py-3 rounded-lg font-semibold text-sm transition-all',
                  isJoining
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-yellow-500/20',
                )}
              >
                {isJoining ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Timer className="w-4 h-4" />
                    </motion.div>
                    Joining...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Join Tournament ({t.entryFee.toFixed(2)} {t.currency})
                  </span>
                )}
              </button>
              <div className="text-[10px] text-gray-600 text-center">
                Entry fee will be deducted from your {t.currency} balance
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TournamentsPage() {
  const user = useAuthStore((s) => s.user);
  const currency = user?.preferences?.currency || 'USDT';

  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [tournaments, setTournaments] = useState<TournamentListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentDetail | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch tournaments
  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await get<TournamentListEntry[]>('/casino/tournaments');
      setTournaments(data || []);
    } catch (err: any) {
      console.error('Error fetching tournaments:', err);
      setError(err?.message || 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();

    let interval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(fetchTournaments, 30000);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchTournaments(); // Refresh on return
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchTournaments]);

  // Filter by tab
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (activeTab === 'active') return t.status === 'active';
      if (activeTab === 'upcoming') return t.status === 'upcoming';
      if (activeTab === 'completed') return t.status === 'completed';
      return true;
    });
  }, [tournaments, activeTab]);

  // Open tournament detail
  const openDetail = useCallback(async (id: string) => {
    try {
      const data = await get<TournamentDetail>(`/casino/tournaments/${id}`);
      setSelectedTournament(data);
    } catch (err: any) {
      console.error('Error fetching tournament details:', err);
    }
  }, []);

  // Join tournament
  const handleJoin = useCallback(async () => {
    if (!selectedTournament) return;
    setIsJoining(true);
    setError(null);

    try {
      const result = await post<{ success: boolean; message: string; newBalance?: number }>(
        `/casino/tournaments/${selectedTournament.tournament.id}/join`,
      );

      // Update balance
      if (result.newBalance !== undefined) {
        const cur = selectedTournament.tournament.currency;
        useAuthStore.getState().updateBalance(cur, result.newBalance, 0);
      }

      setSuccessMsg(result.message || 'Successfully joined!');

      // Refresh detail
      const data = await get<TournamentDetail>(
        `/casino/tournaments/${selectedTournament.tournament.id}`,
      );
      setSelectedTournament(data);

      // Refresh list
      fetchTournaments();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to join tournament');
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsJoining(false);
    }
  }, [selectedTournament, fetchTournaments]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'active', label: 'Active', icon: <Zap className="w-3.5 h-3.5" /> },
    { key: 'upcoming', label: 'Upcoming', icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'completed', label: 'Completed', icon: <Trophy className="w-3.5 h-3.5" /> },
  ];

  // Stats
  const totalPrizePool = tournaments.filter((t) => t.status === 'active' || t.status === 'upcoming').reduce((s, t) => s + t.prizePool, 0);
  const activeTournaments = tournaments.filter((t) => t.status === 'active').length;
  const totalParticipants = tournaments.reduce((s, t) => s + t.participantCount, 0);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            Tournaments
          </h1>
          <p className="text-sm text-gray-500 mt-1">Compete against other players for prize pools</p>
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#161B22] rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Prize Pools</div>
                <div className="text-lg font-bold font-mono text-yellow-400">{totalPrizePool.toFixed(2)} USDT</div>
              </div>
            </div>
          </div>
          <div className="bg-[#161B22] rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Active Tournaments</div>
                <div className="text-lg font-bold font-mono text-emerald-400">{activeTournaments}</div>
              </div>
            </div>
          </div>
          <div className="bg-[#161B22] rounded-xl p-4 border border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Participants</div>
                <div className="text-lg font-bold font-mono text-purple-400">{totalParticipants}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                activeTab === tab.key
                  ? 'bg-[#1C2128] border-emerald-500/40 text-white'
                  : 'bg-[#161B22] border-gray-800/50 text-gray-400 hover:text-white hover:border-gray-700/50',
              )}
            >
              {tab.icon}
              {tab.label}
              <span className="text-[10px] font-mono ml-1 text-gray-500">
                ({tournaments.filter((t) => t.status === tab.key).length})
              </span>
            </button>
          ))}
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-400"
            >
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tournament grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#161B22] rounded-xl border border-gray-800/50 p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-800" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-800 rounded w-3/4 mb-1" />
                    <div className="h-3 bg-gray-800 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-16 bg-gray-800/50 rounded-lg mb-3" />
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-12 bg-gray-800/50 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="bg-[#161B22] rounded-xl border border-gray-800/50 p-12 text-center">
            <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <div className="text-lg font-semibold text-gray-500 mb-1">
              No {activeTab} tournaments
            </div>
            <div className="text-sm text-gray-600">
              {activeTab === 'active'
                ? 'Check back soon or browse upcoming tournaments.'
                : activeTab === 'upcoming'
                  ? 'No upcoming tournaments at the moment.'
                  : 'No completed tournaments to display.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} onSelect={openDetail} />
            ))}
          </div>
        )}

        {/* Detail modal */}
        <AnimatePresence>
          {selectedTournament && (
            <TournamentDetailView
              detail={selectedTournament}
              onClose={() => setSelectedTournament(null)}
              onJoin={handleJoin}
              isJoining={isJoining}
            />
          )}
        </AnimatePresence>

        {/* Provably fair footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-600">
            <Shield className="w-3 h-3" />
            <span>All tournament games use provably fair HMAC-SHA256 verification</span>
          </div>
        </div>
      </div>
    </div>
  );
}
