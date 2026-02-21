'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Star,
  Zap,
  Percent,
  Trophy,
  DollarSign,
  Timer,
  Filter,
  Search,
  Sparkles,
  Calendar,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toastSuccess, toastError } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Promotion {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  type: 'deposit_bonus' | 'free_bet' | 'odds_boost' | 'cashback' | 'tournament';
  status: 'active' | 'upcoming' | 'expired';
  imageGradient: string;
  iconBg: string;
  icon: React.ReactNode;
  startDate: string;
  endDate: string;
  minDeposit?: number;
  wagerReq?: number;
  maxBonus?: number;
  promoCode?: string;
  claimed: boolean;
  terms: string[];
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_PROMOTIONS: Promotion[] = [
  {
    id: 'p-1',
    title: 'Welcome Bonus - 100% Match',
    description: 'Double your first deposit up to $500! Start your CryptoBet journey with a bang.',
    longDescription: 'New players get a 100% match bonus on their first deposit. Deposit $500 and play with $1,000! The bonus is released in $10 increments for every $100 wagered.',
    type: 'deposit_bonus',
    status: 'active',
    imageGradient: 'from-[#8B5CF6]/20 via-[#8B5CF6]/5 to-[#EC4899]/10',
    iconBg: 'bg-[#8B5CF6]/10',
    icon: <Gift className="w-6 h-6 text-[#8B5CF6]" />,
    startDate: new Date(Date.now() - 86400000 * 7).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 23).toISOString(),
    minDeposit: 20,
    wagerReq: 5,
    maxBonus: 500,
    promoCode: 'WELCOME100',
    claimed: false,
    terms: [
      'Minimum deposit of $20 required',
      '5x wagering requirement on bonus amount',
      'Bonus expires 30 days after activation',
      'Available for first deposit only',
      'Maximum bonus amount: $500',
    ],
  },
  {
    id: 'p-2',
    title: 'Weekend Reload - 50% Bonus',
    description: 'Every weekend, get a 50% deposit bonus up to $250. Make your weekends count!',
    longDescription: 'Deposit every Saturday or Sunday and receive a 50% match bonus. This offer resets weekly so you can claim it every weekend.',
    type: 'deposit_bonus',
    status: 'active',
    imageGradient: 'from-[#10B981]/20 via-[#10B981]/5 to-[#3B82F6]/10',
    iconBg: 'bg-[#10B981]/10',
    icon: <Calendar className="w-6 h-6 text-[#10B981]" />,
    startDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 5).toISOString(),
    minDeposit: 10,
    wagerReq: 3,
    maxBonus: 250,
    claimed: false,
    terms: [
      'Available every Saturday and Sunday',
      'Minimum deposit of $10 required',
      '3x wagering requirement',
      'Maximum bonus: $250 per weekend',
    ],
  },
  {
    id: 'p-3',
    title: 'Champions League Odds Boost',
    description: 'Get enhanced odds on all Champions League matches this week! Up to 30% boost.',
    longDescription: 'All Champions League matches this week come with boosted odds. Pre-match and live odds are automatically enhanced by up to 30%.',
    type: 'odds_boost',
    status: 'active',
    imageGradient: 'from-[#F59E0B]/20 via-[#F59E0B]/5 to-[#EF4444]/10',
    iconBg: 'bg-[#F59E0B]/10',
    icon: <TrendingUpIcon />,
    startDate: new Date(Date.now() - 86400000).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    claimed: true,
    terms: [
      'Applies to all Champions League matches',
      'Max boost: 30% on pre-match odds',
      'Maximum payout per boosted bet: $5,000',
      'Cannot be combined with other promotions',
    ],
  },
  {
    id: 'p-4',
    title: 'Casino Cashback - 10%',
    description: 'Get 10% cashback on all casino losses this week. No wagering on cashback!',
    longDescription: 'Play any casino game and get 10% back on net losses. Cashback is credited every Monday with zero wagering requirements.',
    type: 'cashback',
    status: 'active',
    imageGradient: 'from-[#EC4899]/20 via-[#EC4899]/5 to-[#8B5CF6]/10',
    iconBg: 'bg-[#EC4899]/10',
    icon: <Percent className="w-6 h-6 text-[#EC4899]" />,
    startDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 4).toISOString(),
    claimed: false,
    terms: [
      '10% cashback on net casino losses',
      'Minimum loss of $10 to qualify',
      'Maximum cashback: $1,000 per week',
      'Cashback credited every Monday',
      'No wagering requirement on cashback',
    ],
  },
  {
    id: 'p-5',
    title: '$50,000 Crash Tournament',
    description: 'Compete in our biggest Crash game tournament with a $50,000 prize pool!',
    longDescription: 'Play Crash and climb the leaderboard! Top 100 players split the $50,000 prize pool. Points are earned based on highest multiplier achieved.',
    type: 'tournament',
    status: 'active',
    imageGradient: 'from-[#EF4444]/20 via-[#EF4444]/5 to-[#F59E0B]/10',
    iconBg: 'bg-[#EF4444]/10',
    icon: <Trophy className="w-6 h-6 text-[#EF4444]" />,
    startDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 9).toISOString(),
    claimed: false,
    terms: [
      'Minimum bet of $1 per round to qualify',
      'Points based on highest multiplier',
      'Top 100 players win prizes',
      '1st place: $10,000',
      'Must opt-in before playing',
    ],
  },
  {
    id: 'p-6',
    title: 'Free Bet Friday',
    description: 'Place 5 bets this week and get a $10 free bet on Friday!',
    longDescription: 'Simply place at least 5 qualifying bets ($5 minimum each) during the week and receive a $10 free bet credited every Friday.',
    type: 'free_bet',
    status: 'active',
    imageGradient: 'from-[#3B82F6]/20 via-[#3B82F6]/5 to-[#10B981]/10',
    iconBg: 'bg-[#3B82F6]/10',
    icon: <Sparkles className="w-6 h-6 text-[#3B82F6]" />,
    startDate: new Date(Date.now() - 86400000 * 4).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    claimed: true,
    terms: [
      'Place at least 5 bets of $5+ each',
      'Free bet credited every Friday',
      'Free bet must be used within 7 days',
      'Free bet stake not returned with winnings',
    ],
  },
  {
    id: 'p-7',
    title: 'Summer Slam Deposit Bonus',
    description: 'Celebrate summer with a massive 200% deposit bonus up to $1,000!',
    longDescription: 'This limited-time summer promotion offers triple your deposit. Available for all players, new and existing.',
    type: 'deposit_bonus',
    status: 'expired',
    imageGradient: 'from-[#30363D]/30 via-[#21262D]/20 to-[#30363D]/10',
    iconBg: 'bg-[#30363D]/30',
    icon: <Gift className="w-6 h-6 text-[#8B949E]" />,
    startDate: new Date(Date.now() - 86400000 * 30).toISOString(),
    endDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    claimed: true,
    terms: ['This promotion has ended'],
  },
];

function TrendingUpIcon() {
  return <Zap className="w-6 h-6 text-[#F59E0B]" />;
}

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// Countdown Timer
// ---------------------------------------------------------------------------

function CountdownTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calcTime = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      };
    };

    setTimeLeft(calcTime());
    const interval = setInterval(() => setTimeLeft(calcTime()), 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <div className="flex items-center gap-1.5 bg-[#0D1117]/70 backdrop-blur-sm px-2 py-1 rounded-button border border-[#21262D]">
      <Timer className="w-3 h-3 text-[#F59E0B]" />
      <span className="font-mono text-[11px] text-[#F59E0B] font-medium">
        {timeLeft.days}d {timeLeft.hours.toString().padStart(2, '0')}:{timeLeft.minutes.toString().padStart(2, '0')}:{timeLeft.seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Promo Card
// ---------------------------------------------------------------------------

function PromoCard({ promo, onClaim }: { promo: Promotion; onClaim: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (promo.promoCode) {
      const success = await copyToClipboard(promo.promoCode);
      if (success) {
        setCopied(true);
        toastSuccess('Promo code copied!');
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const isExpired = promo.status === 'expired';

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        'border rounded-card overflow-hidden transition-all duration-200 group',
        isExpired
          ? 'border-[#21262D]/50 opacity-50'
          : 'border-[#21262D] hover:border-[#30363D] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
      )}
    >
      {/* Image / Gradient Header */}
      <div className={cn(
        'relative h-40 bg-gradient-to-br flex items-center justify-center overflow-hidden',
        promo.imageGradient
      )}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[#0D1117]/40" />
        {/* Animated glow on hover */}
        {!isExpired && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#161B22] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}
        <div className={cn('relative z-10 w-16 h-16 rounded-full flex items-center justify-center border', promo.iconBg, 'border-white/10')}>
          {promo.icon}
        </div>
        {!isExpired && (
          <div className="absolute top-3 right-3 z-10">
            <CountdownTimer endDate={promo.endDate} />
          </div>
        )}
        {promo.claimed && (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="success" size="sm">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Opted In
            </Badge>
          </div>
        )}
        {isExpired && (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="default" size="sm">Expired</Badge>
          </div>
        )}
        <div className="absolute bottom-3 left-3 z-10">
          <Badge
            variant={
              promo.type === 'deposit_bonus' ? 'accent' :
              promo.type === 'odds_boost' ? 'warning' :
              promo.type === 'cashback' ? 'info' :
              promo.type === 'tournament' ? 'danger' :
              'success'
            }
            size="xs"
          >
            {promo.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="bg-[#161B22] p-4">
        <h3 className="text-base font-bold text-[#E6EDF3] mb-1">{promo.title}</h3>
        <p className="text-sm text-[#8B949E] mb-4 line-clamp-2">{promo.description}</p>

        {/* Key Details */}
        <div className="flex flex-wrap gap-3 mb-4">
          {promo.minDeposit && (
            <div className="flex items-center gap-1 text-xs text-[#8B949E]">
              <DollarSign className="w-3 h-3 text-[#8B949E]" />
              Min Deposit: <span className="font-mono text-[#E6EDF3]">${promo.minDeposit}</span>
            </div>
          )}
          {promo.wagerReq && (
            <div className="flex items-center gap-1 text-xs text-[#8B949E]">
              <Zap className="w-3 h-3 text-[#8B949E]" />
              Wager: <span className="font-mono text-[#E6EDF3]">{promo.wagerReq}x</span>
            </div>
          )}
          {promo.maxBonus && (
            <div className="flex items-center gap-1 text-xs text-[#8B949E]">
              <Star className="w-3 h-3 text-[#8B949E]" />
              Max Bonus: <span className="font-mono text-[#E6EDF3]">${promo.maxBonus}</span>
            </div>
          )}
        </div>

        {/* Promo Code */}
        {promo.promoCode && !isExpired && (
          <div className="flex items-center gap-2 mb-4 bg-[#0D1117] rounded-button px-3 py-2.5 border border-[#21262D]">
            <Tag className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <code className="flex-1 text-sm font-mono text-[#8B5CF6] font-semibold">{promo.promoCode}</code>
            <button onClick={handleCopyCode} className="p-1.5 hover:bg-[#1C2128] rounded-button transition-colors border border-transparent hover:border-[#21262D]">
              {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E]" />}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!isExpired && !promo.claimed && (
            <Button
              variant="success"
              size="sm"
              onClick={() => onClaim(promo.id)}
              className="shadow-[0_2px_10px_rgba(16,185,129,0.2)]"
            >
              {promo.type === 'tournament' ? 'Opt In' : 'Claim'}
            </Button>
          )}
          {promo.claimed && !isExpired && (
            <Button variant="success" size="sm" disabled>
              <CheckCircle2 className="w-4 h-4" />
              Claimed
            </Button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
          >
            T&Cs
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Terms Accordion */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-[#21262D]">
                <p className="text-xs text-[#8B949E] mb-3">{promo.longDescription}</p>
                <h4 className="text-xs font-semibold text-[#E6EDF3] mb-2 uppercase tracking-wider">Terms & Conditions</h4>
                <ul className="space-y-1.5">
                  {promo.terms.map((term, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#8B949E]">
                      <span className="w-1 h-1 rounded-full bg-[#8B949E] mt-1.5 shrink-0" />
                      {term}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Promo Code Input Section
// ---------------------------------------------------------------------------

function PromoCodeSection() {
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toastError('Please enter a promo code');
      return;
    }
    setIsRedeeming(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsRedeeming(false);
    toastSuccess(`Promo code "${code}" redeemed successfully!`);
    setCode('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-[#161B22] border border-[#21262D] rounded-card p-5 mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center border border-[#8B5CF6]/20">
          <Tag className="w-4 h-4 text-[#8B5CF6]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Have a promo code?</h3>
          <p className="text-xs text-[#8B949E]">Enter your code below to redeem</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Enter promo code..."
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="font-mono uppercase"
          prefixIcon={<Tag className="w-4 h-4" />}
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleRedeem}
          isLoading={isRedeeming}
          className="shrink-0 shadow-[0_2px_8px_rgba(139,92,246,0.2)]"
        >
          Redeem
        </Button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Promotions Page
// ---------------------------------------------------------------------------

export default function PromotionsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPromotions(MOCK_PROMOTIONS);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleClaim = (id: string) => {
    setPromotions((prev) => prev.map((p) => p.id === id ? { ...p, claimed: true } : p));
    toastSuccess('Promotion claimed successfully!');
  };

  const types = ['all', 'deposit_bonus', 'free_bet', 'odds_boost', 'cashback', 'tournament'];

  const typeLabels: Record<string, string> = {
    all: 'All',
    deposit_bonus: 'Deposit Bonus',
    free_bet: 'Free Bets',
    odds_boost: 'Odds Boost',
    cashback: 'Cashback',
    tournament: 'Tournament',
  };

  const activePromos = useMemo(() => {
    return promotions
      .filter((p) => p.status !== 'expired')
      .filter((p) => filter === 'all' || p.type === filter)
      .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [promotions, filter, searchQuery]);

  const expiredPromos = useMemo(() => {
    return promotions.filter((p) => p.status === 'expired');
  }, [promotions]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-button" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-40 w-full rounded-card" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-24 rounded-button" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6]/15 to-[#8B5CF6]/5 flex items-center justify-center border border-[#8B5CF6]/20">
            <Gift className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#E6EDF3]">Promotions</h1>
            <p className="text-sm text-[#8B949E]">Boost your play with exclusive bonuses and offers</p>
          </div>
        </div>
      </motion.div>

      {/* Promo Code Input */}
      <PromoCodeSection />

      {/* Search & Filter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3 mb-4"
      >
        <div className="flex-1">
          <Input
            placeholder="Search promotions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefixIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </motion.div>

      {/* Type Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex gap-2 flex-wrap mb-6"
      >
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-medium transition-all duration-200',
              filter === type
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-[0_2px_8px_rgba(139,92,246,0.25)]'
                : 'bg-[#161B22] text-[#8B949E] border border-[#21262D] hover:border-[#30363D] hover:text-[#E6EDF3]'
            )}
          >
            {typeLabels[type] || type.replace('_', ' ')}
          </button>
        ))}
      </motion.div>

      {/* Active Promotions */}
      {activePromos.length === 0 ? (
        <div className="text-center py-16 bg-[#161B22] border border-[#21262D] rounded-card">
          <div className="w-16 h-16 rounded-full bg-[#1C2128] flex items-center justify-center mx-auto mb-4 border border-[#21262D]">
            <Gift className="w-8 h-8 text-[#30363D]" />
          </div>
          <p className="text-[#8B949E] font-medium">No promotions found</p>
          <p className="text-xs text-[#8B949E]/60 mt-1">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        >
          {activePromos.map((promo) => (
            <PromoCard key={promo.id} promo={promo} onClaim={handleClaim} />
          ))}
        </motion.div>
      )}

      {/* Past Promotions */}
      {expiredPromos.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors mb-4 group"
          >
            <div className="w-6 h-6 rounded-full bg-[#1C2128] flex items-center justify-center border border-[#21262D] group-hover:border-[#30363D] transition-colors">
              {showPast ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
            Past Promotions ({expiredPromos.length})
          </button>
          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {expiredPromos.map((promo) => (
                    <PromoCard key={promo.id} promo={promo} onClaim={handleClaim} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
