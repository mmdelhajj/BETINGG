'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Link2,
  Copy,
  Check,
  Share2,
  TrendingUp,
  DollarSign,
  UserPlus,
  UserCheck,
  Gift,
  Star,
  Trophy,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Send,
  Clock,
  Target,
} from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toastSuccess } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
  pendingRewards: number;
  currentTier: number;
  referralCode: string;
  referralLink: string;
}

interface ReferredUser {
  id: string;
  username: string;
  joinedAt: string;
  status: 'pending' | 'active' | 'qualified';
  wagered: number;
  reward: number;
  rewardClaimed: boolean;
}

interface ReferralTier {
  level: number;
  referralsNeeded: number;
  reward: number;
  commissionRate: number;
  perks: string[];
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_STATS: ReferralStats = {
  totalReferrals: 18,
  activeReferrals: 12,
  pendingReferrals: 6,
  totalEarned: 285.50,
  pendingRewards: 45.00,
  currentTier: 2,
  referralCode: 'CRYPTO8X2K',
  referralLink: 'https://cryptobet.io/ref/CRYPTO8X2K',
};

const MOCK_REFERRED: ReferredUser[] = [
  { id: 'r-1', username: 'Play***er42', joinedAt: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'qualified', wagered: 520, reward: 5, rewardClaimed: true },
  { id: 'r-2', username: 'Luc***bet', joinedAt: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'qualified', wagered: 1250, reward: 5, rewardClaimed: true },
  { id: 'r-3', username: 'Cry***fan', joinedAt: new Date(Date.now() - 86400000 * 7).toISOString(), status: 'qualified', wagered: 890, reward: 5, rewardClaimed: false },
  { id: 'r-4', username: 'Bet***pro', joinedAt: new Date(Date.now() - 86400000 * 10).toISOString(), status: 'active', wagered: 75, reward: 0, rewardClaimed: false },
  { id: 'r-5', username: 'Win***ace', joinedAt: new Date(Date.now() - 86400000 * 12).toISOString(), status: 'qualified', wagered: 2100, reward: 5, rewardClaimed: true },
  { id: 'r-6', username: 'Cas***king', joinedAt: new Date(Date.now() - 86400000 * 15).toISOString(), status: 'active', wagered: 30, reward: 0, rewardClaimed: false },
  { id: 'r-7', username: 'Top***user', joinedAt: new Date(Date.now() - 86400000).toISOString(), status: 'pending', wagered: 0, reward: 0, rewardClaimed: false },
  { id: 'r-8', username: 'New***bet', joinedAt: new Date(Date.now() - 3600000 * 5).toISOString(), status: 'pending', wagered: 0, reward: 0, rewardClaimed: false },
];

const REFERRAL_TIERS: ReferralTier[] = [
  { level: 1, referralsNeeded: 1, reward: 5, commissionRate: 5, perks: ['$5 per qualified referral', '5% commission on referral wagers'] },
  { level: 2, referralsNeeded: 5, reward: 50, commissionRate: 7.5, perks: ['$50 bonus at 5 referrals', '7.5% commission', 'Priority payouts'] },
  { level: 3, referralsNeeded: 25, reward: 500, commissionRate: 10, perks: ['$500 bonus at 25 referrals', '10% commission', 'VIP referral badge', 'Exclusive promo codes'] },
  { level: 4, referralsNeeded: 100, reward: 2500, commissionRate: 15, perks: ['$2,500 bonus at 100 referrals', '15% commission', 'Custom referral page', 'Dedicated affiliate manager'] },
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
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// Share Buttons
// ---------------------------------------------------------------------------

function ShareButtons({ link, code }: { link: string; code: string }) {
  const shareText = `Join CryptoBet and get up to $2,500 in bonuses! Use my referral code: ${code}`;

  const shareLinks = [
    {
      name: 'Twitter / X',
      icon: <ExternalLink className="w-4 h-4" />,
      color: 'hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] hover:border-[#1DA1F2]/30',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`,
    },
    {
      name: 'Telegram',
      icon: <Send className="w-4 h-4" />,
      color: 'hover:bg-[#0088CC]/10 hover:text-[#0088CC] hover:border-[#0088CC]/30',
      url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'WhatsApp',
      icon: <MessageCircle className="w-4 h-4" />,
      color: 'hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30',
      url: `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + link)}`,
    },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {shareLinks.map((sl) => (
        <a
          key={sl.name}
          href={sl.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#21262D] bg-[#1C2128] text-[#8B949E] text-xs font-medium transition-all duration-200',
            sl.color
          )}
        >
          {sl.icon}
          {sl.name}
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: 'pending' | 'active' | 'qualified' }) {
  const config = {
    pending: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/20', label: 'Pending' },
    active: { bg: 'bg-[#3B82F6]/10', text: 'text-[#3B82F6]', border: 'border-[#3B82F6]/20', label: 'Active' },
    qualified: { bg: 'bg-[#10B981]/10', text: 'text-[#10B981]', border: 'border-[#10B981]/20', label: 'Qualified' },
  }[status];

  return (
    <span className={cn('inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border', config.bg, config.text, config.border)}>
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Referrals Page
// ---------------------------------------------------------------------------

export default function ReferralsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats] = useState<ReferralStats>(MOCK_STATS);
  const [referrals] = useState<ReferredUser[]>(MOCK_REFERRED);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(stats.referralLink);
    if (success) {
      setCopiedLink(true);
      toastSuccess('Referral link copied!');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    const success = await copyToClipboard(stats.referralCode);
    if (success) {
      setCopiedCode(true);
      toastSuccess('Referral code copied!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const currentTierData = REFERRAL_TIERS[stats.currentTier - 1];
  const nextTierData = REFERRAL_TIERS[stats.currentTier];
  const qualifiedCount = referrals.filter((r) => r.status === 'qualified').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D1117]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#E6EDF3]">Referral Program</h1>
              <p className="text-sm text-[#8B949E]">Invite friends and earn rewards together</p>
            </div>
          </div>
        </motion.div>

        {/* Referral Link Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden bg-[#161B22] border border-[#21262D] rounded-xl p-6 mb-6"
        >
          {/* Decorative gradient */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B5CF6] via-[#A78BFA] to-[#10B981]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

          <div className="relative z-10">
            <h2 className="text-lg font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#8B5CF6]" />
              Your Referral Link
            </h2>

            {/* Link */}
            <div className="flex items-center gap-2 bg-[#0D1117] border border-[#21262D] rounded-xl p-3 mb-3">
              <Link2 className="w-4 h-4 text-[#8B5CF6] shrink-0" />
              <span className="flex-1 text-sm font-mono text-[#E6EDF3] truncate">{stats.referralLink}</span>
              <button
                onClick={handleCopyLink}
                className={cn(
                  'shrink-0 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5',
                  copiedLink
                    ? 'bg-[#10B981] text-white'
                    : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-lg shadow-[#8B5CF6]/25',
                )}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {/* Code */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs text-[#6E7681]">Referral code:</span>
              <div className="flex items-center gap-2 bg-[#0D1117] border border-[#21262D] rounded-lg px-3 py-1.5">
                <code className="text-sm font-mono text-[#A78BFA] font-bold tracking-wider">{stats.referralCode}</code>
                <button
                  onClick={handleCopyCode}
                  className="p-1 rounded-md hover:bg-[#1C2128] transition-colors duration-200"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E] hover:text-[#E6EDF3]" />}
                </button>
              </div>
            </div>

            {/* Share Buttons */}
            <div>
              <p className="text-xs text-[#6E7681] mb-2">Share via:</p>
              <ShareButtons link={stats.referralLink} code={stats.referralCode} />
            </div>
          </div>
        </motion.div>

        {/* Stats Dashboard */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          {[
            { label: 'Total Referrals', value: stats.totalReferrals, icon: UserPlus, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/20' },
            { label: 'Active', value: stats.activeReferrals, icon: UserCheck, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/20' },
            { label: 'Total Earned', value: `$${(stats.totalEarned ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/20' },
            { label: 'Pending', value: `$${(stats.pendingRewards ?? 0).toFixed(2)}`, icon: Clock, color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', border: 'border-[#3B82F6]/20' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={staggerItem}
              className="bg-[#161B22] border border-[#21262D] rounded-xl p-4 hover:border-[#8B5CF6]/20 transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border', stat.bg, stat.border)}>
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </div>
              <p className="text-xl font-bold font-mono text-[#E6EDF3]">{stat.value}</p>
              <p className="text-xs text-[#6E7681] mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Referral Tiers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[#161B22] border border-[#21262D] rounded-xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#8B5CF6]" />
            Referral Tiers
          </h2>

          {/* Progress to next tier */}
          {nextTierData && (
            <div className="mb-6 p-4 bg-[#0D1117] border border-[#21262D] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#8B949E] flex items-center gap-1">
                  Level {stats.currentTier} <ChevronRight className="w-3 h-3 text-[#6E7681]" /> Level {stats.currentTier + 1}
                </span>
                <span className="text-xs font-mono font-bold text-[#A78BFA]">
                  {qualifiedCount}/{nextTierData.referralsNeeded}
                </span>
              </div>
              <div className="h-2.5 bg-[#161B22] border border-[#21262D] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((qualifiedCount / nextTierData.referralsNeeded) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] rounded-full"
                />
              </div>
              <p className="text-xs text-[#6E7681] mt-2">
                {nextTierData.referralsNeeded - qualifiedCount} more qualified referrals to unlock Level {stats.currentTier + 1} (${nextTierData.reward} bonus + {nextTierData.commissionRate}% commission)
              </p>
            </div>
          )}

          {/* Tier Cards */}
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
            {REFERRAL_TIERS.map((tier) => {
              const isActive = tier.level === stats.currentTier;
              const isUnlocked = tier.level <= stats.currentTier;

              return (
                <motion.div
                  key={tier.level}
                  variants={staggerItem}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border transition-all duration-200',
                    isActive
                      ? 'bg-[#8B5CF6]/5 border-[#8B5CF6]/30 ring-1 ring-[#8B5CF6]/20'
                      : isUnlocked
                      ? 'bg-[#10B981]/5 border-[#10B981]/20'
                      : 'bg-[#0D1117] border-[#21262D]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border',
                      isActive
                        ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20'
                        : isUnlocked
                        ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                        : 'bg-[#1C2128] text-[#6E7681] border-[#21262D]'
                    )}>
                      {isUnlocked ? <Check className="w-5 h-5" /> : tier.level}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#E6EDF3]">Level {tier.level}</p>
                        {isActive && (
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/25">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6E7681]">{tier.referralsNeeded} qualified referrals</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm text-[#E6EDF3]">${tier.reward}</p>
                    <p className="text-xs text-[#6E7681]">{tier.commissionRate}% commission</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Referred Users List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[#161B22] border border-[#21262D] rounded-xl overflow-hidden mb-6"
        >
          <div className="px-6 py-4 border-b border-[#21262D] flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#E6EDF3] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#8B5CF6]" />
              Referred Users
            </h2>
            <span className="text-xs font-mono text-[#6E7681] bg-[#0D1117] border border-[#21262D] px-2.5 py-1 rounded-lg">
              {referrals.length} total
            </span>
          </div>

          {/* Table Header */}
          <div className="hidden md:grid grid-cols-5 gap-4 px-6 py-3 bg-[#0D1117] border-b border-[#21262D] text-[10px] font-semibold text-[#6E7681] uppercase tracking-wider">
            <span>User</span>
            <span>Joined</span>
            <span>Status</span>
            <span className="text-right">Wagered</span>
            <span className="text-right">Reward</span>
          </div>

          {/* Rows */}
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            {referrals.map((user) => (
              <motion.div
                key={user.id}
                variants={staggerItem}
                className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 px-6 py-3 border-b border-[#21262D]/50 hover:bg-[#1C2128]/50 transition-colors duration-200"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1C2128] border border-[#21262D] flex items-center justify-center text-xs font-bold text-[#6E7681]">
                    {(user.username || 'U').charAt(0)}
                  </div>
                  <span className="text-sm text-[#E6EDF3] font-mono">{user.username}</span>
                </div>
                <div className="flex items-center text-xs text-[#8B949E] justify-end md:justify-start">
                  {new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center">
                  <StatusBadge status={user.status} />
                </div>
                <div className="text-right flex items-center justify-end">
                  <span className="font-mono text-sm text-[#E6EDF3]">${(user.wagered ?? 0).toLocaleString()}</span>
                </div>
                <div className="text-right flex items-center justify-end">
                  {user.reward > 0 ? (
                    <span className={cn('font-mono text-sm font-semibold flex items-center gap-1', user.rewardClaimed ? 'text-[#10B981]' : 'text-[#F59E0B]')}>
                      ${user.reward}
                      {user.rewardClaimed && <Check className="w-3 h-3 text-[#10B981]" />}
                    </span>
                  ) : (
                    <span className="text-xs text-[#6E7681]">--</span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#161B22] border border-[#21262D] rounded-xl p-6"
        >
          <h2 className="text-lg font-bold text-[#E6EDF3] mb-5 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#8B5CF6]" />
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Share Your Link', desc: 'Share your unique referral link with friends via social media or direct message.', icon: Share2, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/20' },
              { step: '2', title: 'Friends Join & Play', desc: 'When they sign up and start wagering, they become your active referrals.', icon: UserPlus, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/20' },
              { step: '3', title: 'Earn Rewards', desc: 'Get $5 per qualified referral plus commission on their wagers. Level up for more!', icon: Gift, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/20' },
            ].map((item) => (
              <div key={item.step} className="bg-[#0D1117] border border-[#21262D] rounded-xl p-5 text-center">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 border', item.bg, item.border)}>
                  <item.icon className={cn('w-6 h-6', item.color)} />
                </div>
                <h3 className="text-sm font-bold text-[#E6EDF3] mb-1.5">{item.title}</h3>
                <p className="text-xs text-[#8B949E] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
