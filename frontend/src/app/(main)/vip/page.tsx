'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Star,
  Gem,
  Zap,
  TrendingUp,
  Gift,
  Users,
  Shield,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  Calculator,
  Sparkles,
  HeadphonesIcon,
  DollarSign,
  Percent,
  Clock,
  Trophy,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

interface VIPTier {
  name: string;
  minWager: number;
  rakeback: number;
  color: string;
  gradient: string;
  borderColor: string;
  icon: React.ReactNode;
  benefits: string[];
  badgeVariant: string;
}

const VIP_TIERS: VIPTier[] = [
  {
    name: 'Bronze',
    minWager: 0,
    rakeback: 0.5,
    color: '#CD7F32',
    gradient: 'from-amber-900/30 to-amber-700/10',
    borderColor: 'border-amber-700/30',
    icon: <Star className="w-5 h-5" />,
    benefits: ['0.5% Rakeback', 'Daily Rewards', 'Standard Support', 'Basic Promotions'],
    badgeVariant: 'bronze',
  },
  {
    name: 'Silver',
    minWager: 5000,
    rakeback: 1,
    color: '#C0C0C0',
    gradient: 'from-slate-500/30 to-slate-400/10',
    borderColor: 'border-slate-500/30',
    icon: <Star className="w-5 h-5" />,
    benefits: ['1% Rakeback', 'Daily Rewards', 'Priority Support', 'Exclusive Promotions', 'Weekly Bonuses'],
    badgeVariant: 'silver',
  },
  {
    name: 'Gold',
    minWager: 25000,
    rakeback: 1.5,
    color: '#FFD700',
    gradient: 'from-yellow-500/30 to-yellow-400/10',
    borderColor: 'border-yellow-500/30',
    icon: <Crown className="w-5 h-5" />,
    benefits: ['1.5% Rakeback', 'Enhanced Rewards', 'Priority Support', 'Exclusive Promotions', 'Weekly Bonuses', 'Higher Limits'],
    badgeVariant: 'gold',
  },
  {
    name: 'Platinum',
    minWager: 100000,
    rakeback: 2,
    color: '#E5E4E2',
    gradient: 'from-cyan-500/30 to-cyan-400/10',
    borderColor: 'border-cyan-500/30',
    icon: <Crown className="w-5 h-5" />,
    benefits: ['2% Rakeback', 'Premium Rewards', 'Dedicated Support', 'VIP Promotions', 'Daily Bonuses', 'Higher Limits', 'Custom Odds Boosts'],
    badgeVariant: 'platinum',
  },
  {
    name: 'Diamond',
    minWager: 500000,
    rakeback: 2.5,
    color: '#B9F2FF',
    gradient: 'from-violet-500/30 to-violet-400/10',
    borderColor: 'border-violet-500/30',
    icon: <Gem className="w-5 h-5" />,
    benefits: ['2.5% Rakeback', 'Premium Rewards', 'Account Manager', 'VIP Events', 'Daily Bonuses', 'Max Limits', 'Custom Odds Boosts', 'Cashback'],
    badgeVariant: 'diamond',
  },
  {
    name: 'Elite',
    minWager: 2000000,
    rakeback: 3,
    color: '#FF6B6B',
    gradient: 'from-rose-500/30 to-rose-400/10',
    borderColor: 'border-rose-500/30',
    icon: <Gem className="w-5 h-5" />,
    benefits: ['3% Rakeback', 'Elite Rewards', 'Personal Manager', 'Exclusive Events', 'Hourly Bonuses', 'No Limits', 'Priority Withdrawals', 'Luxury Gifts'],
    badgeVariant: 'elite',
  },
  {
    name: 'Black Diamond',
    minWager: 10000000,
    rakeback: 4,
    color: '#2D2D2D',
    gradient: 'from-gray-800/50 to-gray-700/20',
    borderColor: 'border-gray-600/50',
    icon: <Gem className="w-5 h-5" />,
    benefits: ['4% Rakeback', 'Supreme Rewards', 'Personal Manager', 'Private Events', 'Hourly Bonuses', 'No Limits', 'Instant Withdrawals', 'Luxury Experiences', 'Custom Limits'],
    badgeVariant: 'black-diamond',
  },
  {
    name: 'Blue Diamond',
    minWager: 50000000,
    rakeback: 5,
    color: '#4DA6FF',
    gradient: 'from-blue-500/30 to-blue-400/10',
    borderColor: 'border-blue-500/30',
    icon: <Sparkles className="w-5 h-5" />,
    benefits: ['5% Rakeback', 'Ultimate Rewards', 'Dedicated Team', 'Exclusive Global Events', 'Continuous Bonuses', 'No Limits', 'Instant Withdrawals', 'Luxury Travel', 'Bespoke Everything'],
    badgeVariant: 'blue-diamond',
  },
];

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// VIP Page
// ---------------------------------------------------------------------------

export default function VIPPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentTierIndex, setCurrentTierIndex] = useState(2); // Gold
  const [totalWagered, setTotalWagered] = useState(42500);
  const [expandedTier, setExpandedTier] = useState<number | null>(null);
  const [rakebackInput, setRakebackInput] = useState('1000');
  const [showAllTiers, setShowAllTiers] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const currentTier = VIP_TIERS[currentTierIndex];
  const nextTier = VIP_TIERS[currentTierIndex + 1];
  const progress = nextTier
    ? ((totalWagered - currentTier.minWager) / (nextTier.minWager - currentTier.minWager)) * 100
    : 100;
  const remaining = nextTier ? nextTier.minWager - totalWagered : 0;

  // Rakeback Calculator
  const rakebackAmount = useMemo(() => {
    const wager = parseFloat(rakebackInput || '0');
    return (wager * currentTier.rakeback) / 100;
  }, [rakebackInput, currentTier.rakeback]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6]/15 to-[#8B5CF6]/5 flex items-center justify-center border border-[#8B5CF6]/20">
            <Crown className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#E6EDF3]">VIP Club</h1>
            <p className="text-sm text-[#8B949E]">Exclusive rewards and benefits for our most valued players</p>
          </div>
        </div>
      </motion.div>

      {/* Current Tier Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden rounded-card border border-[#21262D] bg-[#161B22] p-6 md:p-8 mb-8"
      >
        {/* Tier-colored glow */}
        <div className="absolute inset-0 bg-gradient-to-br opacity-60" style={{
          background: `linear-gradient(135deg, ${currentTier.color}08 0%, transparent 50%, ${nextTier?.color ?? currentTier.color}05 100%)`
        }} />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" style={{ backgroundColor: `${currentTier.color}06` }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" style={{ backgroundColor: `${currentTier.color}04` }} />

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                {/* Tier Badge with glow */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center border"
                    style={{ backgroundColor: `${currentTier.color}12`, borderColor: `${currentTier.color}25`, color: currentTier.color }}>
                    {currentTier.icon}
                  </div>
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ borderWidth: 2, borderColor: `${currentTier.color}30`, borderStyle: 'solid' }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
                <div>
                  <Badge variant={currentTier.badgeVariant as any} size="lg">{currentTier.name}</Badge>
                  <p className="text-xs text-[#8B949E] mt-1.5">Current VIP Tier</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-[#8B949E] uppercase tracking-wider mb-1">Total Wagered</p>
                <p className="text-3xl font-bold font-mono text-[#E6EDF3]">
                  ${totalWagered.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-[#0D1117]/60 rounded-card p-4 min-w-[200px] border border-[#21262D]">
                <p className="text-xs text-[#8B949E] mb-1 font-medium uppercase tracking-wider">Rakeback Rate</p>
                <p className="text-3xl font-bold font-mono" style={{ color: currentTier.color }}>{currentTier.rakeback}%</p>
              </div>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#8B949E] font-medium">Progress to {nextTier.name}</span>
                <span className="text-xs font-mono text-[#8B949E]">
                  ${remaining.toLocaleString()} remaining
                </span>
              </div>
              <div className="h-3.5 bg-[#0D1117] rounded-full overflow-hidden border border-[#21262D]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full relative"
                  style={{ background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier.color})` }}
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-white/15 rounded-full"
                  />
                </motion.div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-mono" style={{ color: currentTier.color }}>{currentTier.name}</span>
                <span className="text-[10px] font-mono" style={{ color: nextTier.color }}>{nextTier.name}</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* VIP Tier Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-xl font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#8B5CF6]" />
          VIP Tiers
        </h2>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <div className="bg-[#161B22] border border-[#21262D] rounded-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#21262D] bg-[#0D1117]/50">
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Tier</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Min. Wager</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Rakeback</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Support</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Account Mgr</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Exclusive Events</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Priority Withdraw</th>
                </tr>
              </thead>
              <tbody>
                {VIP_TIERS.map((tier, i) => (
                  <tr
                    key={tier.name}
                    className={cn(
                      'border-b border-[#21262D]/50 transition-colors duration-200',
                      i === currentTierIndex
                        ? 'bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/8'
                        : i % 2 === 0
                        ? 'bg-[#0D1117]/30 hover:bg-[#1C2128]'
                        : 'hover:bg-[#1C2128]'
                    )}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center border" style={{ backgroundColor: `${tier.color}12`, borderColor: `${tier.color}25`, color: tier.color }}>
                          {tier.icon}
                        </div>
                        <span className="text-sm font-medium text-[#E6EDF3]">{tier.name}</span>
                        {i === currentTierIndex && <Badge variant="accent" size="xs">Current</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-sm text-[#E6EDF3]">
                      {tier.minWager === 0 ? 'Free' : `$${tier.minWager.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold" style={{ color: tier.color }}>
                      {tier.rakeback}%
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-[#8B949E]">
                      {i >= 4 ? 'Dedicated' : i >= 1 ? 'Priority' : 'Standard'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {i >= 4 ? <Check className="w-4 h-4 text-[#10B981] mx-auto" /> : <X className="w-4 h-4 text-[#30363D] mx-auto" />}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {i >= 3 ? <Check className="w-4 h-4 text-[#10B981] mx-auto" /> : <X className="w-4 h-4 text-[#30363D] mx-auto" />}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {i >= 5 ? <Check className="w-4 h-4 text-[#10B981] mx-auto" /> : <X className="w-4 h-4 text-[#30363D] mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="lg:hidden space-y-3">
          {(showAllTiers ? VIP_TIERS : VIP_TIERS.slice(0, 4)).map((tier, i) => (
            <motion.div
              key={tier.name}
              variants={staggerItem}
              className={cn(
                'border rounded-card overflow-hidden transition-all duration-200',
                i === currentTierIndex
                  ? 'border-[#8B5CF6]/25 ring-1 ring-[#8B5CF6]/15 bg-[#161B22] shadow-[0_0_16px_rgba(139,92,246,0.06)]'
                  : 'border-[#21262D] bg-[#161B22] hover:border-[#30363D]'
              )}
            >
              <button
                onClick={() => setExpandedTier(expandedTier === i ? null : i)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ backgroundColor: `${tier.color}12`, borderColor: `${tier.color}25`, color: tier.color }}>
                    {tier.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#E6EDF3]">{tier.name}</span>
                      {i === currentTierIndex && <Badge variant="accent" size="xs">Current</Badge>}
                    </div>
                    <span className="text-xs text-[#8B949E]">
                      {tier.minWager === 0 ? 'Free' : `$${tier.minWager.toLocaleString()} wagered`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold" style={{ color: tier.color }}>{tier.rakeback}%</span>
                  {expandedTier === i ? <ChevronUp className="w-4 h-4 text-[#8B949E]" /> : <ChevronDown className="w-4 h-4 text-[#8B949E]" />}
                </div>
              </button>
              <AnimatePresence>
                {expandedTier === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0 border-t border-[#21262D]">
                      <ul className="space-y-2 mt-3">
                        {tier.benefits.map((b) => (
                          <li key={b} className="flex items-center gap-2 text-xs text-[#8B949E]">
                            <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {!showAllTiers && (
            <button
              onClick={() => setShowAllTiers(true)}
              className="w-full py-3 text-sm text-[#8B5CF6] hover:text-[#A78BFA] font-medium transition-colors"
            >
              Show all {VIP_TIERS.length} tiers
            </button>
          )}
        </motion.div>
      </motion.div>

      {/* Rakeback Calculator & Perks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Rakeback Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#161B22] border border-[#21262D] rounded-card p-6"
        >
          <h3 className="text-lg font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center border border-[#8B5CF6]/20">
              <Calculator className="w-4 h-4 text-[#8B5CF6]" />
            </div>
            Rakeback Calculator
          </h3>
          <div className="space-y-4">
            <Input
              label="Wager Amount (USD)"
              type="number"
              value={rakebackInput}
              onChange={(e) => setRakebackInput(e.target.value)}
              prefixText="$"
            />
            <div className="bg-[#0D1117] rounded-card p-4 space-y-3 border border-[#21262D]">
              <div className="flex justify-between text-sm">
                <span className="text-[#8B949E]">Your Tier</span>
                <Badge variant={currentTier.badgeVariant as any} size="sm">{currentTier.name}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8B949E]">Rakeback Rate</span>
                <span className="font-mono font-semibold" style={{ color: currentTier.color }}>{currentTier.rakeback}%</span>
              </div>
              <div className="border-t border-[#21262D]" />
              <div className="flex justify-between">
                <span className="text-sm text-[#8B949E]">Estimated Rakeback</span>
                <span className="text-xl font-bold font-mono text-[#10B981]">
                  ${rakebackAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8B949E]">50% Instant</span>
                <span className="font-mono text-[#E6EDF3]">${(rakebackAmount * 0.5).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8B949E]">50% to Rewards</span>
                <span className="font-mono text-[#E6EDF3]">${(rakebackAmount * 0.5).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* VIP Perks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#161B22] border border-[#21262D] rounded-card p-6"
        >
          <h3 className="text-lg font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center border border-[#8B5CF6]/20">
              <Gift className="w-4 h-4 text-[#8B5CF6]" />
            </div>
            VIP Perks
          </h3>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2.5">
            {[
              { icon: HeadphonesIcon, title: 'Personal Account Manager', description: 'Dedicated support available 24/7 for Diamond+ tiers', color: '#8B5CF6', bgColor: 'bg-[#8B5CF6]/10', borderColor: 'border-[#8B5CF6]/15' },
              { icon: TrendingUp, title: 'Higher Betting Limits', description: 'Increased max bet and withdrawal limits', color: '#10B981', bgColor: 'bg-[#10B981]/10', borderColor: 'border-[#10B981]/15' },
              { icon: Zap, title: 'Exclusive Events', description: 'VIP-only tournaments with massive prize pools', color: '#F59E0B', bgColor: 'bg-[#F59E0B]/10', borderColor: 'border-[#F59E0B]/15' },
              { icon: DollarSign, title: 'Priority Withdrawals', description: 'Instant processing for Elite+ tier members', color: '#3B82F6', bgColor: 'bg-[#3B82F6]/10', borderColor: 'border-[#3B82F6]/15' },
              { icon: Sparkles, title: 'Luxury Gifts', description: 'Physical rewards and experiences for top tiers', color: '#EC4899', bgColor: 'bg-[#EC4899]/10', borderColor: 'border-[#EC4899]/15' },
              { icon: Percent, title: 'Custom Odds Boosts', description: 'Personalized odds boosts on your favorite events', color: '#14B8A6', bgColor: 'bg-[#14B8A6]/10', borderColor: 'border-[#14B8A6]/15' },
            ].map((perk) => (
              <motion.div
                key={perk.title}
                variants={staggerItem}
                className={cn('flex items-start gap-3 p-3 bg-[#0D1117]/50 rounded-card border border-[#21262D] hover:border-[#30363D] transition-colors duration-200')}
              >
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 border', perk.bgColor, perk.borderColor)}>
                  <perk.icon className="w-5 h-5" style={{ color: perk.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#E6EDF3]">{perk.title}</p>
                  <p className="text-xs text-[#8B949E]">{perk.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
