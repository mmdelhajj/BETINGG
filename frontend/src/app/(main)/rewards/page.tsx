'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  Calendar,
  Percent,
  Zap,
  Package,
  TrendingUp,
  Clock,
  Check,
  Lock,
  Star,
  Flame,
  ChevronRight,
  Trophy,
  ArrowUp,
  Sparkles,
  Timer,
  DollarSign,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toastSuccess, toastError } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RewardTab = 'calendar' | 'rakeback' | 'turbo' | 'welcome' | 'levelup';

interface DayReward {
  day: number;
  amount: number;
  currency: string;
  claimed: boolean;
  available: boolean;
  bonus?: string;
}

interface LevelMilestone {
  id: string;
  wagerRequired: number;
  reward: number;
  currency: string;
  claimed: boolean;
  current: number;
}

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

// ---------------------------------------------------------------------------
// Daily Calendar Tab
// ---------------------------------------------------------------------------

function DailyCalendarTab() {
  const [streak, setStreak] = useState(4);
  const [claimingDay, setClaimingDay] = useState<number | null>(null);

  const days: DayReward[] = [
    { day: 1, amount: 0.50, currency: 'USDT', claimed: true, available: false },
    { day: 2, amount: 0.75, currency: 'USDT', claimed: true, available: false },
    { day: 3, amount: 1.00, currency: 'USDT', claimed: true, available: false },
    { day: 4, amount: 1.50, currency: 'USDT', claimed: true, available: false },
    { day: 5, amount: 2.00, currency: 'USDT', claimed: false, available: true, bonus: 'Turbo Boost' },
    { day: 6, amount: 3.00, currency: 'USDT', claimed: false, available: false },
    { day: 7, amount: 5.00, currency: 'USDT', claimed: false, available: false, bonus: 'Mystery Box' },
  ];

  const handleClaim = async (day: number) => {
    setClaimingDay(day);
    await new Promise((r) => setTimeout(r, 800));
    setClaimingDay(null);
    setStreak((prev) => prev + 1);
    toastSuccess(`Day ${day} reward claimed!`);
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Streak Banner */}
      <div className="relative overflow-hidden rounded-card border border-[#21262D] bg-[#161B22]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#F59E0B]/8 via-transparent to-[#EF4444]/4" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#F59E0B]/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#F59E0B]/3 rounded-full blur-2xl translate-y-1/2" />
        <div className="relative z-10 p-6 flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/10 flex items-center justify-center border border-[#F59E0B]/20">
              <Flame className="w-8 h-8 text-[#F59E0B]" />
            </div>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[#F59E0B]/30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-[#8B949E] uppercase tracking-wider">Current Streak</p>
            <p className="text-4xl font-bold font-mono text-[#F59E0B] leading-tight">{streak} Days</p>
            <p className="text-xs text-[#8B949E] mt-0.5">Keep your streak alive for bonus rewards!</p>
          </div>
        </div>
      </div>

      {/* 7-Day Grid */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-7 gap-2 md:gap-3">
        {days.map((reward) => (
          <motion.div
            key={reward.day}
            variants={staggerItem}
            className={cn(
              'relative flex flex-col items-center p-2 md:p-4 rounded-card border transition-all duration-200',
              reward.claimed
                ? 'bg-[#10B981]/5 border-[#10B981]/25 shadow-[0_0_12px_rgba(16,185,129,0.06)]'
                : reward.available
                ? 'bg-[#8B5CF6]/5 border-[#8B5CF6]/30 ring-1 ring-[#8B5CF6]/20 shadow-[0_0_16px_rgba(139,92,246,0.08)]'
                : 'bg-[#0D1117] border-[#21262D] hover:border-[#30363D]'
            )}
          >
            <span className={cn(
              'text-[10px] font-medium mb-1 uppercase tracking-wider',
              reward.claimed ? 'text-[#10B981]/70' : reward.available ? 'text-[#8B5CF6]/70' : 'text-[#8B949E]/60'
            )}>Day {reward.day}</span>
            <div className={cn(
              'relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center mb-2',
              reward.claimed
                ? 'bg-[#10B981]/10 border border-[#10B981]/20'
                : reward.available
                ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/20'
                : 'bg-[#1C2128] border border-[#21262D]'
            )}>
              {reward.claimed ? (
                <Check className="w-5 h-5 text-[#10B981]" />
              ) : reward.available ? (
                <>
                  <Gift className="w-5 h-5 text-[#8B5CF6]" />
                  <motion.div
                    className="absolute inset-0 rounded-full border border-[#8B5CF6]/40"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </>
              ) : (
                <Lock className="w-5 h-5 text-[#30363D]" />
              )}
            </div>
            <span className={cn(
              'text-xs md:text-sm font-mono font-semibold',
              reward.claimed ? 'text-[#10B981]' : 'text-[#E6EDF3]'
            )}>
              ${reward.amount.toFixed(2)}
            </span>
            {reward.bonus && (
              <span className="text-[8px] md:text-[10px] text-[#F59E0B] font-medium mt-0.5">+{reward.bonus}</span>
            )}
            {reward.available && !reward.claimed && (
              <button
                onClick={() => handleClaim(reward.day)}
                disabled={claimingDay === reward.day}
                className="mt-2 px-2 py-1 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white text-[10px] md:text-xs font-medium rounded-button transition-all duration-200 disabled:opacity-50 shadow-[0_2px_8px_rgba(139,92,246,0.25)]"
              >
                {claimingDay === reward.day ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Clock className="w-3 h-3" />
                  </motion.div>
                ) : (
                  'Claim'
                )}
              </button>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Next Claim Timer */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1C2128] border border-[#21262D] flex items-center justify-center">
            <Clock className="w-5 h-5 text-[#8B949E]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#E6EDF3]">Next claim available in</p>
            <p className="text-xs text-[#8B949E]">Claim windows open every 12 hours</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-[#8B5CF6]"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="font-mono text-lg font-bold text-[#8B5CF6]">04:32:18</span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Rakeback Tab
// ---------------------------------------------------------------------------

function RakebackTab() {
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    setIsClaiming(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsClaiming(false);
    toastSuccess('Rakeback claimed successfully!');
  };

  const stats = {
    currentRate: 1.5,
    todayAccumulated: 12.45,
    weeklyAccumulated: 87.30,
    monthlyAccumulated: 342.50,
    lifetimeEarned: 2845.75,
    availableToClaim: 42.30,
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Current Rate Hero */}
      <div className="relative overflow-hidden rounded-card border border-[#21262D] bg-[#161B22]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/6 via-transparent to-[#8B5CF6]/4" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#10B981]/4 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#8B5CF6]/4 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#8B949E] uppercase tracking-wider mb-1">Your Rakeback Rate</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-bold font-mono text-[#10B981]">{stats.currentRate}%</p>
                <Badge variant="gold" size="sm">Gold Tier</Badge>
              </div>
              <p className="text-xs text-[#8B949E] mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[#10B981]" />
                Upgrade to Platinum for 2% rakeback
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-[#8B949E] uppercase tracking-wider mb-1">Available to Claim</p>
              <p className="text-3xl font-bold font-mono text-[#E6EDF3]">${stats.availableToClaim.toFixed(2)}</p>
              <Button
                variant="success"
                size="sm"
                onClick={handleClaim}
                isLoading={isClaiming}
                className="mt-3 shadow-[0_2px_10px_rgba(16,185,129,0.25)]"
              >
                <DollarSign className="w-4 h-4" />
                Claim Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Today', value: stats.todayAccumulated, icon: Clock, color: '#3B82F6', bg: 'from-[#3B82F6]/10 to-[#3B82F6]/5' },
          { label: 'This Week', value: stats.weeklyAccumulated, icon: Calendar, color: '#8B5CF6', bg: 'from-[#8B5CF6]/10 to-[#8B5CF6]/5' },
          { label: 'This Month', value: stats.monthlyAccumulated, icon: TrendingUp, color: '#10B981', bg: 'from-[#10B981]/10 to-[#10B981]/5' },
          { label: 'Lifetime', value: stats.lifetimeEarned, icon: Star, color: '#F59E0B', bg: 'from-[#F59E0B]/10 to-[#F59E0B]/5' },
        ].map((stat) => (
          <div key={stat.label} className="relative overflow-hidden bg-[#161B22] border border-[#21262D] rounded-card p-4 group hover:border-[#30363D] transition-colors duration-200">
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300', stat.bg)} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                  <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                </div>
                <span className="text-xs text-[#8B949E] font-medium">{stat.label}</span>
              </div>
              <p className="text-lg font-bold font-mono text-[#E6EDF3]">${stat.value.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-card p-6">
        <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
          How Rakeback Works
        </h3>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Place any bet on sports or casino games', color: '#8B5CF6' },
            { step: '2', text: 'Earn rakeback based on your VIP tier rate', color: '#3B82F6' },
            { step: '3', text: '50% added to your wallet instantly', color: '#10B981' },
            { step: '4', text: '50% added to your rewards calendar', color: '#F59E0B' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-200"
                style={{ backgroundColor: `${item.color}10`, color: item.color }}>
                {item.step}
              </div>
              <p className="text-sm text-[#8B949E] group-hover:text-[#E6EDF3] transition-colors duration-200">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Turbo Tab
// ---------------------------------------------------------------------------

function TurboTab() {
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [multiplier] = useState(1.25);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const handleActivate = () => {
    setIsActive(true);
    setTimeLeft(5400); // 90 minutes
    toastSuccess('TURBO mode activated! Enjoy 25% boost for 90 minutes!');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Turbo Card */}
      <div className={cn(
        'relative overflow-hidden rounded-card border p-8 text-center',
        isActive
          ? 'border-[#F59E0B]/30 bg-[#161B22]'
          : 'border-[#21262D] bg-[#161B22]'
      )}>
        {/* Background glow effects */}
        {isActive ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#F59E0B]/8 via-transparent to-[#EF4444]/4" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F59E0B]/6 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#F59E0B]/5 rounded-full blur-3xl -translate-y-1/2" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1C2128]/50 via-transparent to-[#1C2128]/30" />
        )}

        <div className="relative z-10">
          <motion.div
            animate={isActive ? { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className="relative mx-auto mb-4 w-20 h-20"
          >
            <div className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center',
              isActive
                ? 'bg-gradient-to-br from-[#F59E0B]/20 to-[#EF4444]/10 border border-[#F59E0B]/25'
                : 'bg-[#1C2128] border border-[#21262D]'
            )}>
              <Zap className={cn('w-10 h-10', isActive ? 'text-[#F59E0B]' : 'text-[#8B949E]')} />
            </div>
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[#F59E0B]/40"
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.div>

          <h2 className="text-2xl font-bold text-[#E6EDF3] mb-2">
            {isActive ? 'TURBO Active!' : 'Turbo Charge'}
          </h2>

          {isActive ? (
            <>
              <p className="text-lg font-mono font-bold text-[#F59E0B] mb-1">
                {multiplier}x Multiplier Active
              </p>
              <p className="text-5xl font-bold font-mono text-[#E6EDF3] mb-4 tracking-tight">{formatTime(timeLeft)}</p>
              <div className="h-2.5 bg-[#0D1117] rounded-full overflow-hidden max-w-xs mx-auto border border-[#21262D]">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] rounded-full relative"
                  style={{ width: `${(timeLeft / 5400) * 100}%` }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </motion.div>
              </div>
              <p className="text-xs text-[#8B949E] mt-3">All winnings boosted by 25%</p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#8B949E] mb-6 max-w-md mx-auto">
                Activate TURBO mode to boost all your winnings by up to 25% for 90 minutes.
                Claim from your daily calendar to unlock.
              </p>
              <Button variant="primary" size="lg" onClick={handleActivate} className="shadow-[0_4px_16px_rgba(139,92,246,0.3)]">
                <Zap className="w-5 h-5" />
                Activate TURBO
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Turbo Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Duration', value: '90 min', icon: Timer, desc: 'Per activation', color: '#F59E0B' },
          { label: 'Boost', value: 'Up to 25%', icon: TrendingUp, desc: 'On all winnings', color: '#10B981' },
          { label: 'Activations', value: '3/day', icon: Zap, desc: 'Per claim window', color: '#8B5CF6' },
        ].map((item) => (
          <div key={item.label} className="relative overflow-hidden bg-[#161B22] border border-[#21262D] rounded-card p-5 text-center group hover:border-[#30363D] transition-colors duration-200">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-[#1C2128]/50 transition-all duration-300" />
            <div className="relative z-10">
              <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center border"
                style={{ backgroundColor: `${item.color}10`, borderColor: `${item.color}20` }}>
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <p className="text-xl font-bold font-mono text-[#E6EDF3]">{item.value}</p>
              <p className="text-xs text-[#8B949E] mt-1 font-medium">{item.label}</p>
              <p className="text-[10px] text-[#8B949E]/50 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Welcome Package Tab
// ---------------------------------------------------------------------------

function WelcomePackageTab() {
  const totalBonus = 2500;
  const claimedBonus = 875;
  const daysRemaining = 22;
  const depositsRemaining = 3;

  const deposits = [
    { id: 1, match: '100%', maxBonus: 500, deposited: 500, bonusReceived: 500, claimed: true },
    { id: 2, match: '75%', maxBonus: 750, deposited: 500, bonusReceived: 375, claimed: true },
    { id: 3, match: '50%', maxBonus: 500, deposited: 0, bonusReceived: 0, claimed: false },
    { id: 4, match: '25%', maxBonus: 750, deposited: 0, bonusReceived: 0, claimed: false },
  ];

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Overview */}
      <div className="relative overflow-hidden rounded-card border border-[#21262D] bg-[#161B22]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/6 via-transparent to-[#10B981]/4" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#8B5CF6]/4 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#10B981]/4 rounded-full blur-3xl translate-y-1/3" />
        <div className="relative z-10 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B5CF6]/15 to-[#8B5CF6]/5 flex items-center justify-center border border-[#8B5CF6]/20">
              <Package className="w-6 h-6 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#E6EDF3]">Welcome Package</h2>
              <p className="text-xs text-[#8B949E]">Up to ${totalBonus.toLocaleString()} in bonuses over 30 days</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-[#0D1117]/60 rounded-card p-3 border border-[#21262D]">
              <p className="text-xs text-[#8B949E] mb-0.5">Claimed</p>
              <p className="text-xl font-bold font-mono text-[#10B981]">${claimedBonus}</p>
            </div>
            <div className="bg-[#0D1117]/60 rounded-card p-3 border border-[#21262D]">
              <p className="text-xs text-[#8B949E] mb-0.5">Remaining</p>
              <p className="text-xl font-bold font-mono text-[#E6EDF3]">${totalBonus - claimedBonus}</p>
            </div>
            <div className="bg-[#0D1117]/60 rounded-card p-3 border border-[#21262D]">
              <p className="text-xs text-[#8B949E] mb-0.5">Days Left</p>
              <p className="text-xl font-bold font-mono text-[#F59E0B]">{daysRemaining}</p>
            </div>
          </div>

          <div className="h-2.5 bg-[#0D1117] rounded-full overflow-hidden border border-[#21262D]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(claimedBonus / totalBonus) * 100}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#10B981] rounded-full relative"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-full"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>
          <p className="text-xs text-[#8B949E] mt-2">{((claimedBonus / totalBonus) * 100).toFixed(0)}% completed</p>
        </div>
      </div>

      {/* Deposit Bonuses */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
        {deposits.map((dep) => (
          <motion.div
            key={dep.id}
            variants={staggerItem}
            className={cn(
              'flex items-center justify-between p-4 rounded-card border transition-all duration-200',
              dep.claimed
                ? 'bg-[#10B981]/4 border-[#10B981]/15 hover:border-[#10B981]/25'
                : 'bg-[#161B22] border-[#21262D] hover:border-[#8B5CF6]/20'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border',
                dep.claimed
                  ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                  : 'bg-[#1C2128] text-[#8B949E] border-[#21262D]'
              )}>
                {dep.claimed ? <Check className="w-5 h-5" /> : dep.id}
              </div>
              <div>
                <p className="text-sm font-medium text-[#E6EDF3]">Deposit #{dep.id} - {dep.match} Match</p>
                <p className="text-xs text-[#8B949E]">Max bonus: ${dep.maxBonus}</p>
              </div>
            </div>
            <div className="text-right">
              {dep.claimed ? (
                <div>
                  <p className="text-sm font-mono font-semibold text-[#10B981]">+${dep.bonusReceived}</p>
                  <Badge variant="success" size="xs">Claimed</Badge>
                </div>
              ) : (
                <Button variant="primary" size="sm" className="shadow-[0_2px_8px_rgba(139,92,246,0.2)]">
                  Deposit
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Cash Vault */}
      <div className="relative overflow-hidden bg-[#161B22] border border-[#21262D] rounded-card p-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F59E0B]/4 via-transparent to-[#F59E0B]/2" />
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#F59E0B]/15 to-[#F59E0B]/5 flex items-center justify-center mx-auto mb-3 border border-[#F59E0B]/20">
            <Lock className="w-7 h-7 text-[#F59E0B]" />
          </div>
          <h3 className="text-lg font-bold text-[#E6EDF3]">Cash Vault</h3>
          <p className="text-sm text-[#8B949E] mb-2">Unlocks on Day 30</p>
          <p className="text-xs text-[#8B949E]">Complete your welcome package to unlock a special bonus payout</p>
          <p className="font-mono font-bold text-3xl text-[#F59E0B] mt-3">$250.00</p>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Level Up Tab
// ---------------------------------------------------------------------------

function LevelUpTab() {
  const totalWagered = 42500;

  const milestones: LevelMilestone[] = [
    { id: 'm-1', wagerRequired: 1000, reward: 5, currency: 'USDT', claimed: true, current: totalWagered },
    { id: 'm-2', wagerRequired: 5000, reward: 25, currency: 'USDT', claimed: true, current: totalWagered },
    { id: 'm-3', wagerRequired: 10000, reward: 50, currency: 'USDT', claimed: true, current: totalWagered },
    { id: 'm-4', wagerRequired: 50000, reward: 250, currency: 'USDT', claimed: false, current: totalWagered },
    { id: 'm-5', wagerRequired: 100000, reward: 500, currency: 'USDT', claimed: false, current: totalWagered },
    { id: 'm-6', wagerRequired: 500000, reward: 2500, currency: 'USDT', claimed: false, current: totalWagered },
    { id: 'm-7', wagerRequired: 1000000, reward: 5000, currency: 'USDT', claimed: false, current: totalWagered },
    { id: 'm-8', wagerRequired: 2500000, reward: 15000, currency: 'USDT', claimed: false, current: totalWagered },
  ];

  const handleClaim = (id: string) => {
    toastSuccess('Level-up reward claimed!');
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Current Progress */}
      <div className="relative overflow-hidden bg-[#161B22] border border-[#21262D] rounded-card p-6">
        <div className="absolute inset-0 bg-gradient-to-r from-[#8B5CF6]/4 via-transparent to-[#10B981]/4" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-[#8B949E] uppercase tracking-wider mb-1">Total Wagered</p>
              <p className="text-3xl font-bold font-mono text-[#E6EDF3]">${totalWagered.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-[#8B949E] uppercase tracking-wider mb-1">Next Milestone</p>
              <p className="text-xl font-bold font-mono text-[#8B5CF6]">$50,000</p>
              <p className="text-xs text-[#8B949E]">${(50000 - totalWagered).toLocaleString()} to go</p>
            </div>
          </div>
          <div className="h-3 bg-[#0D1117] rounded-full overflow-hidden border border-[#21262D]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(totalWagered / 50000) * 100}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#10B981] rounded-full relative"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent rounded-full"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-mono text-[#8B949E]">${totalWagered.toLocaleString()}</span>
            <span className="text-[10px] font-mono text-[#8B5CF6]">$50,000</span>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
        {milestones.map((milestone) => {
          const reached = totalWagered >= milestone.wagerRequired;
          const canClaim = reached && !milestone.claimed;
          const progress = Math.min((totalWagered / milestone.wagerRequired) * 100, 100);

          return (
            <motion.div
              key={milestone.id}
              variants={staggerItem}
              className={cn(
                'flex items-center justify-between p-4 rounded-card border transition-all duration-200',
                milestone.claimed
                  ? 'bg-[#10B981]/4 border-[#10B981]/15'
                  : canClaim
                  ? 'bg-[#8B5CF6]/4 border-[#8B5CF6]/25 ring-1 ring-[#8B5CF6]/15 shadow-[0_0_16px_rgba(139,92,246,0.06)]'
                  : 'bg-[#161B22] border-[#21262D] hover:border-[#30363D]'
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border',
                  milestone.claimed
                    ? 'bg-[#10B981]/10 border-[#10B981]/20'
                    : canClaim
                    ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/20'
                    : 'bg-[#1C2128] border-[#21262D]'
                )}>
                  {milestone.claimed ? (
                    <Check className="w-5 h-5 text-[#10B981]" />
                  ) : canClaim ? (
                    <Trophy className="w-5 h-5 text-[#8B5CF6]" />
                  ) : (
                    <Target className="w-5 h-5 text-[#8B949E]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#E6EDF3]">
                    Wager ${milestone.wagerRequired.toLocaleString()}
                  </p>
                  {!reached && (
                    <div className="mt-1.5">
                      <div className="h-1.5 bg-[#0D1117] rounded-full overflow-hidden w-full max-w-[200px] border border-[#21262D]">
                        <div
                          className="h-full bg-gradient-to-r from-[#8B5CF6]/40 to-[#8B5CF6]/60 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#8B949E] mt-0.5 font-mono">{progress.toFixed(0)}%</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('font-mono font-semibold text-sm', milestone.claimed ? 'text-[#10B981]' : 'text-[#E6EDF3]')}>
                  +${milestone.reward}
                </span>
                {canClaim && (
                  <Button variant="primary" size="sm" onClick={() => handleClaim(milestone.id)} className="shadow-[0_2px_8px_rgba(139,92,246,0.2)]">
                    Claim
                  </Button>
                )}
                {milestone.claimed && (
                  <Badge variant="success" size="xs">Claimed</Badge>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Rewards Page
// ---------------------------------------------------------------------------

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<RewardTab>('calendar');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const tabs: { id: RewardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'calendar', label: 'Daily Calendar', icon: <Calendar className="w-4 h-4" /> },
    { id: 'rakeback', label: 'Rakeback', icon: <Percent className="w-4 h-4" /> },
    { id: 'turbo', label: 'Turbo Charge', icon: <Zap className="w-4 h-4" /> },
    { id: 'welcome', label: 'Welcome Package', icon: <Package className="w-4 h-4" /> },
    { id: 'levelup', label: 'Level Up', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-button" />
          ))}
        </div>
        <Skeleton className="h-32 w-full rounded-card" />
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6]/15 to-[#8B5CF6]/5 flex items-center justify-center border border-[#8B5CF6]/20">
            <Gift className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#E6EDF3]">Rewards Center</h1>
            <p className="text-sm text-[#8B949E]">Earn rewards just by playing</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-1 mb-6 bg-[#0D1117] border border-[#21262D] rounded-card p-1 overflow-x-auto"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-button text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200',
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-[0_2px_8px_rgba(139,92,246,0.3)]'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#161B22]'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'calendar' && <DailyCalendarTab key="calendar" />}
        {activeTab === 'rakeback' && <RakebackTab key="rakeback" />}
        {activeTab === 'turbo' && <TurboTab key="turbo" />}
        {activeTab === 'welcome' && <WelcomePackageTab key="welcome" />}
        {activeTab === 'levelup' && <LevelUpTab key="levelup" />}
      </AnimatePresence>
    </div>
  );
}
