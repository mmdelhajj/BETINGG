'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Zap,
  ChevronRight,
  ChevronLeft,
  Check,
  Lock,
  Trophy,
  Gift,
  Headphones,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── VIP Tier Definitions ───────────────────────────────────────

interface TierDef {
  key: string;
  name: string;
  icon: string;
  rakeback: number;
  minWager: number;
  levelUpBonus: number;
  dailyBonus: string;
  weeklyBonus: string;
  monthlyBonus: string;
  turboDuration: string;
  dedicatedSupport: boolean;
  gradient: string;
  border: string;
  glow: string;
  iconColor: string;
}

const VIP_TIERS: TierDef[] = [
  {
    key: 'BRONZE',
    name: 'Bronze',
    icon: '🥉',
    rakeback: 5,
    minWager: 0,
    levelUpBonus: 0,
    dailyBonus: '$0.50',
    weeklyBonus: '--',
    monthlyBonus: '--',
    turboDuration: '10 min',
    dedicatedSupport: false,
    gradient: 'from-amber-800 via-amber-700 to-amber-900',
    border: 'border-amber-700/50',
    glow: 'shadow-amber-900/20',
    iconColor: 'text-amber-500',
  },
  {
    key: 'SILVER',
    name: 'Silver',
    icon: '🥈',
    rakeback: 7,
    minWager: 1000,
    levelUpBonus: 5,
    dailyBonus: '$1',
    weeklyBonus: '$5',
    monthlyBonus: '--',
    turboDuration: '15 min',
    dedicatedSupport: false,
    gradient: 'from-gray-500 via-gray-400 to-gray-600',
    border: 'border-gray-400/50',
    glow: 'shadow-gray-500/20',
    iconColor: 'text-gray-300',
  },
  {
    key: 'GOLD',
    name: 'Gold',
    icon: '🥇',
    rakeback: 10,
    minWager: 5000,
    levelUpBonus: 25,
    dailyBonus: '$2.50',
    weeklyBonus: '$15',
    monthlyBonus: '$50',
    turboDuration: '20 min',
    dedicatedSupport: false,
    gradient: 'from-yellow-600 via-yellow-500 to-yellow-700',
    border: 'border-yellow-500/50',
    glow: 'shadow-yellow-600/20',
    iconColor: 'text-yellow-400',
  },
  {
    key: 'EMERALD',
    name: 'Emerald',
    icon: '💚',
    rakeback: 12,
    minWager: 25000,
    levelUpBonus: 100,
    dailyBonus: '$5',
    weeklyBonus: '$35',
    monthlyBonus: '$150',
    turboDuration: '30 min',
    dedicatedSupport: false,
    gradient: 'from-emerald-700 via-emerald-500 to-emerald-800',
    border: 'border-emerald-500/50',
    glow: 'shadow-emerald-600/20',
    iconColor: 'text-emerald-400',
  },
  {
    key: 'SAPPHIRE',
    name: 'Sapphire',
    icon: '💙',
    rakeback: 15,
    minWager: 100000,
    levelUpBonus: 500,
    dailyBonus: '$10',
    weeklyBonus: '$75',
    monthlyBonus: '$350',
    turboDuration: '45 min',
    dedicatedSupport: false,
    gradient: 'from-blue-700 via-blue-500 to-blue-800',
    border: 'border-blue-500/50',
    glow: 'shadow-blue-600/20',
    iconColor: 'text-blue-400',
  },
  {
    key: 'RUBY',
    name: 'Ruby',
    icon: '❤️',
    rakeback: 18,
    minWager: 500000,
    levelUpBonus: 2500,
    dailyBonus: '$25',
    weeklyBonus: '$200',
    monthlyBonus: '$1,000',
    turboDuration: '60 min',
    dedicatedSupport: true,
    gradient: 'from-red-800 via-red-600 to-red-900',
    border: 'border-red-500/50',
    glow: 'shadow-red-600/20',
    iconColor: 'text-red-400',
  },
  {
    key: 'DIAMOND',
    name: 'Diamond',
    icon: '💎',
    rakeback: 22,
    minWager: 2000000,
    levelUpBonus: 10000,
    dailyBonus: '$50',
    weeklyBonus: '$500',
    monthlyBonus: '$2,500',
    turboDuration: '90 min',
    dedicatedSupport: true,
    gradient: 'from-cyan-600 via-cyan-400 to-cyan-700',
    border: 'border-cyan-400/50',
    glow: 'shadow-cyan-500/20',
    iconColor: 'text-cyan-300',
  },
  {
    key: 'BLUE_DIAMOND',
    name: 'Blue Diamond',
    icon: '💠',
    rakeback: 25,
    minWager: 10000000,
    levelUpBonus: 50000,
    dailyBonus: '$100',
    weeklyBonus: '$1,000',
    monthlyBonus: '$5,000',
    turboDuration: '120 min',
    dedicatedSupport: true,
    gradient: 'from-indigo-600 via-indigo-400 to-indigo-700',
    border: 'border-indigo-400/50',
    glow: 'shadow-indigo-500/30',
    iconColor: 'text-indigo-300',
  },
];

const BENEFIT_ROWS = [
  { key: 'rakeback', label: 'Rakeback Rate', icon: TrendingUp },
  { key: 'dailyBonus', label: 'Daily Bonus', icon: Gift },
  { key: 'weeklyBonus', label: 'Weekly Bonus', icon: Gift },
  { key: 'monthlyBonus', label: 'Monthly Bonus', icon: Gift },
  { key: 'turboDuration', label: 'Turbo Duration', icon: Zap },
  { key: 'levelUpBonus', label: 'Level-up Reward', icon: Trophy },
  { key: 'dedicatedSupport', label: 'Dedicated Support', icon: Headphones },
];

function formatWager(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return `$${n}`;
}

function getTierIndex(tierKey: string): number {
  return VIP_TIERS.findIndex((t) => t.key === tierKey);
}

// ─── Component ──────────────────────────────────────────────────

export default function VipPage() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get('/vip/status')
      .then((res) => {
        setStatus(res.data.data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const currentTierKey = status?.currentTier || 'BRONZE';
  const currentTierIdx = getTierIndex(currentTierKey);
  const currentTier = VIP_TIERS[currentTierIdx] || VIP_TIERS[0];
  const nextTier = currentTierIdx < VIP_TIERS.length - 1 ? VIP_TIERS[currentTierIdx + 1] : null;
  const progressPercent = status?.progressPercent ?? 0;
  const totalWagered = status?.totalWagered ?? 0;
  const wagerRemaining = nextTier ? Math.max(0, nextTier.minWager - totalWagered) : 0;

  const scrollTiers = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-64 rounded-2xl animate-pulse bg-[#1A1B1F]" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl animate-pulse bg-[#1A1B1F]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      {/* ── Hero Section ──────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/80 via-[#1A1B1F] to-indigo-900/60 border border-purple-500/20 p-8 md:p-12"
      >
        {/* Decorative elements */}
        <div className="absolute top-4 right-8 text-6xl opacity-20 select-none">💎</div>
        <div className="absolute bottom-4 right-24 text-4xl opacity-10 select-none">💠</div>
        <div className="absolute top-12 right-40 text-3xl opacity-15 select-none">✨</div>
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-300 via-white to-indigo-300 bg-clip-text text-transparent"
          >
            VIP Program
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-400 mt-3 max-w-lg"
          >
            Level up and earn exclusive rewards. Higher tiers unlock bigger bonuses, faster turbo,
            and dedicated support.
          </motion.p>
        </div>
      </motion.section>

      {/* ── Current Status Card ───────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className={cn(
          'relative overflow-hidden rounded-2xl border p-6 md:p-8',
          'bg-gradient-to-r',
          currentTier.gradient,
          currentTier.border
        )}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{currentTier.icon}</div>
            <div>
              <p className="text-sm text-white/70 font-medium">Current Tier</p>
              <h2 className="text-3xl font-bold text-white">
                {currentTier.name} {currentTierIdx + 1}
              </h2>
              <p className="text-sm text-white/60 mt-1">
                {currentTier.rakeback}% rakeback on every bet
              </p>
            </div>
          </div>

          <div className="text-left md:text-right space-y-1">
            <p className="text-sm text-white/70">Total Wagered</p>
            <p className="text-2xl font-bold font-mono text-white">
              {formatWager(totalWagered)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {nextTier && (
          <div className="relative z-10 mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/80 font-medium">
                {progressPercent.toFixed(0)}% to {nextTier.name}
              </span>
              <span className="text-white/60 text-xs">
                Wager {formatWager(wagerRemaining)} more to level up
              </span>
            </div>
            <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-white/60 to-white/90"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-white/50">{currentTier.name}</span>
              <span className="text-xs text-white/50">{nextTier.name}</span>
            </div>
          </div>
        )}

        {!nextTier && (
          <div className="relative z-10 mt-4 flex items-center gap-2 text-white/80">
            <Crown className="w-5 h-5" />
            <span className="text-sm font-medium">You have reached the highest VIP tier!</span>
          </div>
        )}
      </motion.section>

      {/* ── VIP Tier Cards ────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">VIP Tiers</h2>
          <div className="flex gap-2">
            <button
              onClick={() => scrollTiers('left')}
              className="p-2 rounded-lg bg-[#1A1B1F] border border-gray-700/50 hover:border-purple-500/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={() => scrollTiers('right')}
              className="p-2 rounded-lg bg-[#1A1B1F] border border-gray-700/50 hover:border-purple-500/50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
          style={{ scrollbarWidth: 'thin' }}
        >
          {VIP_TIERS.map((tier, idx) => {
            const isCurrent = idx === currentTierIdx;
            const isLocked = idx > currentTierIdx;

            return (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={cn(
                  'flex-shrink-0 w-[280px] snap-start rounded-xl border p-5 transition-all duration-300',
                  'bg-[#1A1B1F]',
                  isCurrent
                    ? 'border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/30'
                    : isLocked
                    ? 'border-gray-800/60 opacity-70'
                    : 'border-gray-700/40 hover:border-gray-600/60'
                )}
              >
                {/* Tier header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{tier.icon}</span>
                    <div>
                      <h3 className="font-bold text-white text-lg">{tier.name}</h3>
                      <p className="text-xs text-gray-500">Level {idx + 1}</p>
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      CURRENT
                    </span>
                  )}
                  {isLocked && <Lock className="w-4 h-4 text-gray-600" />}
                </div>

                {/* Rakeback highlight */}
                <div className={cn('rounded-lg p-3 mb-4 bg-gradient-to-r', tier.gradient)}>
                  <p className="text-xs text-white/70">Rakeback</p>
                  <p className="text-2xl font-extrabold text-white">{tier.rakeback}%</p>
                </div>

                {/* Stats */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Required Wager</span>
                    <span className="text-white font-medium font-mono">
                      {tier.minWager === 0 ? 'Free' : formatWager(tier.minWager)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Level-up Bonus</span>
                    <span className="text-green-400 font-medium font-mono">
                      {tier.levelUpBonus > 0 ? `$${tier.levelUpBonus.toLocaleString()}` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Daily Bonus</span>
                    <span className="text-white font-mono">{tier.dailyBonus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Weekly Bonus</span>
                    <span className="text-white font-mono">{tier.weeklyBonus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Monthly Bonus</span>
                    <span className="text-white font-mono">{tier.monthlyBonus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Turbo Duration</span>
                    <span className="text-yellow-400 font-mono">{tier.turboDuration}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Dedicated Support</span>
                    {tier.dedicatedSupport ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <span className="text-gray-600">--</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Benefits Comparison Table ─────────────────────────── */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Benefits Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800/60">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-[#1A1B1F] border-b border-gray-800/60">
                <th className="text-left p-4 text-gray-400 font-medium w-48">Benefit</th>
                {VIP_TIERS.map((tier, idx) => (
                  <th
                    key={tier.key}
                    className={cn(
                      'p-4 text-center font-medium min-w-[100px]',
                      idx === currentTierIdx
                        ? 'text-purple-300 bg-purple-500/5'
                        : 'text-gray-400'
                    )}
                  >
                    <span className="block text-lg mb-1">{tier.icon}</span>
                    <span className="text-xs">{tier.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BENEFIT_ROWS.map((row, rowIdx) => {
                const Icon = row.icon;
                return (
                  <tr
                    key={row.key}
                    className={cn(
                      'border-b border-gray-800/40',
                      rowIdx % 2 === 0 ? 'bg-[#15161A]' : 'bg-[#1A1B1F]'
                    )}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-300">{row.label}</span>
                      </div>
                    </td>
                    {VIP_TIERS.map((tier, idx) => {
                      let value: string;
                      if (row.key === 'rakeback') {
                        value = `${tier.rakeback}%`;
                      } else if (row.key === 'levelUpBonus') {
                        value = tier.levelUpBonus > 0 ? `$${tier.levelUpBonus.toLocaleString()}` : '--';
                      } else if (row.key === 'dedicatedSupport') {
                        value = tier.dedicatedSupport ? '✓' : '--';
                      } else {
                        value = (tier as any)[row.key] ?? '--';
                      }

                      return (
                        <td
                          key={tier.key}
                          className={cn(
                            'p-4 text-center font-mono text-xs',
                            idx === currentTierIdx
                              ? 'text-purple-300 bg-purple-500/5 font-semibold'
                              : value === '--'
                              ? 'text-gray-700'
                              : value === '✓'
                              ? 'text-green-400'
                              : 'text-gray-300'
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
