'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Gift,
  Check,
  Lock,
  TrendingUp,
  Timer,
  Flame,
  Star,
  Trophy,
  Calendar,
  ArrowUpRight,
  Sparkles,
  Package,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────

interface RakebackData {
  currentRate: number;
  unclaimed: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  lifetime: number;
  history: { id: string; amount: number; date: string; type: string }[];
}

interface CalendarSlot {
  id: string;
  index: number;
  status: 'AVAILABLE' | 'CLAIMED' | 'LOCKED' | 'EXPIRED';
  amount: number | null;
  rewardType: string;
  unlocksAt: string | null;
  claimedAt: string | null;
}

interface TurboStatus {
  isActive: boolean;
  boostMultiplier: number;
  boostPercent: number;
  remainingMinutes: number;
  remainingSeconds: number;
  canActivate: boolean;
  duration: number;
  benefits: string[];
}

interface WelcomePackage {
  isActive: boolean;
  daysRemaining: number;
  currentDay: number;
  totalDays: number;
  bonusProgress: number;
  maxValue: number;
  earned: number;
}

interface LevelUpReward {
  id: string;
  tier: string;
  amount: number;
  claimedAt: string;
  wagerMilestone: number;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Now';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const SLOT_ICONS = ['🌅', '☀️', '🌙'];
const SLOT_LABELS = ['Morning', 'Afternoon', 'Evening'];

// ─── Component ──────────────────────────────────────────────────

export default function RewardsPage() {
  const [rakeback, setRakeback] = useState<RakebackData | null>(null);
  const [calendar, setCalendar] = useState<{ slots: CalendarSlot[] } | null>(null);
  const [turbo, setTurbo] = useState<TurboStatus | null>(null);
  const [welcome, setWelcome] = useState<WelcomePackage | null>(null);
  const [levelUpRewards, setLevelUpRewards] = useState<LevelUpReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [claimingRakeback, setClaimingRakeback] = useState(false);
  const [claimingSlot, setClaimingSlot] = useState<string | null>(null);
  const [activatingTurbo, setActivatingTurbo] = useState(false);
  const [turboTimer, setTurboTimer] = useState(0);

  const fetchAll = useCallback(() => {
    Promise.all([
      api.get('/rewards/rakeback').catch(() => ({ data: { data: null } })),
      api.get('/rewards/calendar').catch(() => ({ data: { data: null } })),
      api.get('/rewards/turbo/status').catch(() => ({ data: { data: null } })),
      api.get('/rewards/welcome-package').catch(() => ({ data: { data: null } })),
      api.get('/rewards/level-up-history').catch(() => ({ data: { data: [] } })),
    ]).then(([rakeRes, calRes, turboRes, welcomeRes, levelRes]) => {
      setRakeback(rakeRes.data.data);
      setCalendar(calRes.data.data);
      setTurbo(turboRes.data.data);
      setWelcome(welcomeRes.data.data);
      setLevelUpRewards(levelRes.data.data || []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Turbo countdown timer
  useEffect(() => {
    if (!turbo?.isActive || !turbo.remainingSeconds) return;
    setTurboTimer(turbo.remainingSeconds);
    const interval = setInterval(() => {
      setTurboTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          fetchAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [turbo?.isActive, turbo?.remainingSeconds, fetchAll]);

  const claimRakeback = async () => {
    setClaimingRakeback(true);
    try {
      await api.post('/rewards/rakeback/claim');
      const { data } = await api.get('/rewards/rakeback');
      setRakeback(data.data);
    } catch {}
    setClaimingRakeback(false);
  };

  const claimCalendarSlot = async (slotId: string) => {
    setClaimingSlot(slotId);
    try {
      await api.post(`/rewards/calendar/${slotId}/claim`);
      const { data } = await api.get('/rewards/calendar');
      setCalendar(data.data);
    } catch {}
    setClaimingSlot(null);
  };

  const activateTurbo = async () => {
    setActivatingTurbo(true);
    try {
      await api.post('/rewards/turbo/activate');
      const { data } = await api.get('/rewards/turbo/status');
      setTurbo(data.data);
    } catch {}
    setActivatingTurbo(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-20 rounded-2xl animate-pulse bg-[#1A1B1F] mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-56 rounded-xl animate-pulse bg-[#1A1B1F]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* ── Page Header ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
          Rewards Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Claim your bonuses, activate turbo, and track your earnings.</p>
      </motion.div>

      {/* ── Rakeback Section ──────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="rounded-2xl border border-gray-800/60 bg-[#1A1B1F] overflow-hidden"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Rakeback</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Current rate + unclaimed */}
            <div className="md:col-span-4 flex flex-col gap-4">
              <div className="rounded-xl bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/20 p-5 text-center">
                <p className="text-sm text-purple-300/70 mb-1">Current Rate</p>
                <p className="text-5xl font-extrabold bg-gradient-to-r from-purple-300 to-purple-100 bg-clip-text text-transparent">
                  {rakeback?.currentRate ?? 0}%
                </p>
              </div>

              <div className="rounded-xl bg-[#15161A] border border-gray-800/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Unclaimed Rakeback</p>
                    <p className="text-2xl font-bold font-mono text-green-400">
                      ${(rakeback?.unclaimed ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={claimRakeback}
                  disabled={claimingRakeback || (rakeback?.unclaimed ?? 0) <= 0}
                  className={cn(
                    'w-full py-3 rounded-lg font-bold text-sm transition-all',
                    (rakeback?.unclaimed ?? 0) > 0
                      ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  )}
                >
                  {claimingRakeback ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Claiming...
                    </span>
                  ) : (
                    'Claim Rakeback'
                  )}
                </button>
              </div>
            </div>

            {/* Rakeback stats */}
            <div className="md:col-span-4">
              <div className="grid grid-cols-2 gap-3 h-full">
                {[
                  { label: 'Today', value: rakeback?.today ?? 0, color: 'text-green-400' },
                  { label: 'This Week', value: rakeback?.thisWeek ?? 0, color: 'text-green-400' },
                  { label: 'This Month', value: rakeback?.thisMonth ?? 0, color: 'text-green-400' },
                  { label: 'Lifetime', value: rakeback?.lifetime ?? 0, color: 'text-yellow-400' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-[#15161A] border border-gray-800/40 p-4 flex flex-col justify-center"
                  >
                    <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                    <p className={cn('text-lg font-bold font-mono', stat.color)}>
                      ${stat.value.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Claim history */}
            <div className="md:col-span-4">
              <div className="rounded-xl bg-[#15161A] border border-gray-800/40 p-4 h-full">
                <p className="text-xs text-gray-500 font-medium mb-3">Recent Claims</p>
                {rakeback?.history && rakeback.history.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rakeback.history.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-gray-400">
                            {new Date(item.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-green-400">
                          +${item.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-6">No claims yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Daily Calendar ────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="rounded-2xl border border-gray-800/60 bg-[#1A1B1F] overflow-hidden"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Daily Rewards</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-12">
            Claim 3 rewards per day, one every 8 hours. Each has a 12-hour claim window.
          </p>

          {calendar?.slots ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {calendar.slots.map((slot, idx) => {
                const isAvailable = slot.status === 'AVAILABLE';
                const isClaimed = slot.status === 'CLAIMED';
                const isLocked = slot.status === 'LOCKED';
                const isExpired = slot.status === 'EXPIRED';

                return (
                  <motion.div
                    key={slot.id || idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * idx }}
                    whileHover={isAvailable ? { scale: 1.02 } : undefined}
                    className={cn(
                      'relative rounded-xl border p-5 text-center transition-all',
                      isAvailable
                        ? 'border-green-500/50 bg-gradient-to-b from-green-500/5 to-transparent shadow-lg shadow-green-500/5'
                        : isClaimed
                        ? 'border-gray-700/40 bg-[#15161A] opacity-60'
                        : isExpired
                        ? 'border-red-500/20 bg-[#15161A] opacity-40'
                        : 'border-gray-800/40 bg-[#15161A]'
                    )}
                  >
                    {/* Claimed overlay */}
                    {isClaimed && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-6 h-6 text-green-400" />
                        </div>
                      </div>
                    )}

                    <div className={cn(isClaimed && 'opacity-30')}>
                      <span className="text-3xl block mb-2">{SLOT_ICONS[idx] || '🎁'}</span>
                      <p className="text-xs text-gray-500 font-medium mb-1">
                        {SLOT_LABELS[idx] || `Slot ${idx + 1}`}
                      </p>
                      <p className="text-xs text-gray-600 mb-3">
                        {slot.rewardType || 'Bonus'}
                      </p>
                      <p className="text-2xl font-bold font-mono text-white mb-4">
                        {slot.amount !== null ? `$${slot.amount}` : '--'}
                      </p>
                    </div>

                    {isAvailable && (
                      <button
                        onClick={() => claimCalendarSlot(slot.id)}
                        disabled={claimingSlot === slot.id}
                        className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors shadow-lg shadow-green-600/20"
                      >
                        {claimingSlot === slot.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Claiming...
                          </span>
                        ) : (
                          'Claim'
                        )}
                      </button>
                    )}

                    {isLocked && slot.unlocksAt && (
                      <div className="flex items-center justify-center gap-1.5 text-gray-500">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="text-xs">
                          Unlocks in {formatTimeUntil(slot.unlocksAt)}
                        </span>
                      </div>
                    )}

                    {isLocked && !slot.unlocksAt && (
                      <div className="flex items-center justify-center gap-1.5 text-gray-600">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="text-xs">Locked</span>
                      </div>
                    )}

                    {isExpired && (
                      <p className="text-xs text-red-400/70 font-medium">Expired</p>
                    )}

                    {isClaimed && (
                      <p className="text-xs text-gray-500 relative z-20">Claimed</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-[#15161A] border border-gray-800/40 text-center py-12">
              <Gift className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Place bets to unlock daily reward slots.</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* ── TURBO Mode ────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className={cn(
          'rounded-2xl border overflow-hidden',
          turbo?.isActive
            ? 'border-yellow-500/40 bg-gradient-to-br from-yellow-900/20 via-[#1A1B1F] to-orange-900/10'
            : 'border-gray-800/60 bg-[#1A1B1F]'
        )}
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className={cn(
              'p-2 rounded-lg',
              turbo?.isActive ? 'bg-yellow-500/20' : 'bg-yellow-500/10'
            )}>
              <Zap className={cn(
                'w-5 h-5',
                turbo?.isActive ? 'text-yellow-300' : 'text-yellow-500'
              )} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">TURBO Mode</h2>
              {turbo?.isActive && (
                <span className="text-xs font-bold text-yellow-400 animate-pulse">ACTIVE</span>
              )}
            </div>
          </div>

          {turbo?.isActive ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Timer */}
              <div className="rounded-xl bg-black/30 border border-yellow-500/20 p-6 text-center">
                <Timer className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                <p className="text-xs text-yellow-400/70 mb-1">Time Remaining</p>
                <p className="text-3xl font-extrabold font-mono text-yellow-300">
                  {formatCountdown(turboTimer)}
                </p>
              </div>

              {/* Multiplier */}
              <div className="rounded-xl bg-black/30 border border-yellow-500/20 p-6 text-center">
                <Flame className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <p className="text-xs text-yellow-400/70 mb-1">Boost Multiplier</p>
                <p className="text-3xl font-extrabold text-orange-300">
                  {turbo.boostMultiplier}x
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Rakeback boosted to {turbo.boostPercent}%
                </p>
              </div>

              {/* Benefits */}
              <div className="rounded-xl bg-black/30 border border-yellow-500/20 p-6">
                <Sparkles className="w-6 h-6 text-yellow-400 mb-3" />
                <p className="text-xs text-yellow-400/70 mb-3">Turbo Benefits</p>
                <ul className="space-y-2">
                  {(turbo.benefits || [
                    'Boosted rakeback rate',
                    'Extra daily bonus multiplier',
                    'Priority reward claims',
                  ]).map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <Check className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-3">
                  Activate TURBO to temporarily boost your rakeback rate and earn rewards faster.
                  Duration depends on your VIP tier.
                </p>
                <ul className="space-y-1.5 mb-4">
                  {[
                    'Boosted rakeback rate',
                    'Extra daily bonus multiplier',
                    'Priority reward claims',
                  ].map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-gray-500">
                      <Zap className="w-3 h-3 text-yellow-600" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={activateTurbo}
                disabled={activatingTurbo || !turbo?.canActivate}
                className={cn(
                  'px-8 py-4 rounded-xl font-bold text-sm transition-all flex items-center gap-2',
                  turbo?.canActivate
                    ? 'bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-500 hover:to-orange-400 text-white shadow-lg shadow-yellow-600/20'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                )}
              >
                {activatingTurbo ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Activate TURBO
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.section>

      {/* ── Welcome Package ───────────────────────────────────── */}
      {welcome?.isActive && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-900/20 via-[#1A1B1F] to-indigo-900/10 overflow-hidden"
        >
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Package className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Welcome Package</h2>
                <span className="text-xs text-purple-400 font-medium">
                  {welcome.daysRemaining} days remaining
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Progress */}
              <div className="md:col-span-2 rounded-xl bg-[#15161A] border border-gray-800/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-300 font-medium">Bonus Progress</p>
                  <p className="text-xs text-purple-400 font-mono">
                    Day {welcome.currentDay} of {welcome.totalDays}
                  </p>
                </div>

                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${welcome.bonusProgress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-500"
                  />
                </div>

                <div className="flex justify-between text-xs text-gray-500">
                  <span>Earned: ${welcome.earned.toFixed(2)}</span>
                  <span>{welcome.bonusProgress.toFixed(0)}% complete</span>
                </div>
              </div>

              {/* Max value */}
              <div className="rounded-xl bg-[#15161A] border border-gray-800/40 p-5 flex flex-col justify-center text-center">
                <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-1">Max Value</p>
                <p className="text-2xl font-extrabold font-mono text-yellow-300">
                  ${welcome.maxValue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">10% rakeback from day 1</p>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Level-up Rewards History ──────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="rounded-2xl border border-gray-800/60 bg-[#1A1B1F] overflow-hidden"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Level-up Rewards</h2>
          </div>

          {levelUpRewards.length > 0 ? (
            <div className="space-y-3">
              {levelUpRewards.map((reward) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#15161A] border border-gray-800/40 hover:border-gray-700/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-600/20 to-amber-600/10 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Reached {reward.tier.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(reward.claimedAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' '}&middot;{' '}
                        ${reward.wagerMilestone.toLocaleString()} wagered
                      </p>
                    </div>
                  </div>
                  <span className="text-lg font-bold font-mono text-green-400">
                    +${reward.amount.toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Trophy className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Level-up rewards will appear here as you reach new VIP tiers.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Keep wagering to unlock your first reward!
              </p>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
