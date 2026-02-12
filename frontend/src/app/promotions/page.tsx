'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Gift, Tag, Percent, Clock, ArrowRight, Zap, Trophy, Star, Ticket, TrendingUp, UserPlus } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

type PromotionCategory = 'all' | 'sports' | 'casino' | 'vip' | 'new-users';
type PromotionBadge = 'Deposit Bonus' | 'Free Bet' | 'Cashback' | 'Odds Boost' | 'Referral';
type PromotionStatus = 'active' | 'limited' | 'expired';
type PromotionCTA = 'Claim Now' | 'Learn More' | 'Opt In';

interface Promotion {
  id: string;
  title: string;
  description: string;
  category: PromotionCategory;
  badge: PromotionBadge;
  status: PromotionStatus;
  cta: PromotionCTA;
  validUntil: string;
  gradient: string;
  iconBg: string;
  icon: React.ReactNode;
}

// ─── Constants ──────────────────────────────────────────────────

const CATEGORY_TABS: { key: PromotionCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sports', label: 'Sports' },
  { key: 'casino', label: 'Casino' },
  { key: 'vip', label: 'VIP' },
  { key: 'new-users', label: 'New Users' },
];

const BADGE_COLORS: Record<PromotionBadge, string> = {
  'Deposit Bonus': 'bg-[#8D52DA]/20 text-[#B47EFF]',
  'Free Bet': 'bg-emerald-500/20 text-emerald-400',
  'Cashback': 'bg-amber-500/20 text-amber-400',
  'Odds Boost': 'bg-sky-500/20 text-sky-400',
  'Referral': 'bg-pink-500/20 text-pink-400',
};

const STATUS_COLORS: Record<PromotionStatus, { dot: string; text: string; label: string }> = {
  active: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Active' },
  limited: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Limited Time' },
  expired: { dot: 'bg-gray-500', text: 'text-gray-500', label: 'Expired' },
};

const ICON_SIZE = 28;

const PROMOTIONS: Promotion[] = [
  {
    id: 'promo-1',
    title: 'Welcome Bonus',
    description: '100% up to $500 on first deposit',
    category: 'new-users',
    badge: 'Deposit Bonus',
    status: 'active',
    cta: 'Claim Now',
    validUntil: '2026-06-30',
    gradient: 'from-[#8D52DA] via-[#6B3FA0] to-[#3D2066]',
    iconBg: 'bg-[#8D52DA]/30',
    icon: <Gift size={ICON_SIZE} className="text-[#B47EFF]" />,
  },
  {
    id: 'promo-2',
    title: 'Free Bet Friday',
    description: 'Get a $10 free bet every Friday',
    category: 'sports',
    badge: 'Free Bet',
    status: 'active',
    cta: 'Opt In',
    validUntil: '2026-12-31',
    gradient: 'from-emerald-600 via-emerald-700 to-emerald-900',
    iconBg: 'bg-emerald-500/30',
    icon: <Ticket size={ICON_SIZE} className="text-emerald-400" />,
  },
  {
    id: 'promo-3',
    title: 'Casino Cashback',
    description: '10% weekly cashback on casino losses',
    category: 'casino',
    badge: 'Cashback',
    status: 'active',
    cta: 'Opt In',
    validUntil: '2026-12-31',
    gradient: 'from-amber-600 via-amber-700 to-amber-900',
    iconBg: 'bg-amber-500/30',
    icon: <Percent size={ICON_SIZE} className="text-amber-400" />,
  },
  {
    id: 'promo-4',
    title: 'Premier League Special',
    description: 'Boosted odds on all Premier League matches',
    category: 'sports',
    badge: 'Odds Boost',
    status: 'limited',
    cta: 'Claim Now',
    validUntil: '2026-05-25',
    gradient: 'from-sky-600 via-sky-700 to-sky-900',
    iconBg: 'bg-sky-500/30',
    icon: <TrendingUp size={ICON_SIZE} className="text-sky-400" />,
  },
  {
    id: 'promo-5',
    title: 'VIP Reload',
    description: '50% reload bonus for VIP members',
    category: 'vip',
    badge: 'Deposit Bonus',
    status: 'active',
    cta: 'Claim Now',
    validUntil: '2026-12-31',
    gradient: 'from-purple-600 via-purple-800 to-purple-950',
    iconBg: 'bg-purple-500/30',
    icon: <Star size={ICON_SIZE} className="text-purple-400" />,
  },
  {
    id: 'promo-6',
    title: 'Crypto Deposit Bonus',
    description: 'Extra 5% on all crypto deposits',
    category: 'all',
    badge: 'Deposit Bonus',
    status: 'active',
    cta: 'Learn More',
    validUntil: '2026-09-30',
    gradient: 'from-orange-600 via-orange-700 to-orange-900',
    iconBg: 'bg-orange-500/30',
    icon: <Zap size={ICON_SIZE} className="text-orange-400" />,
  },
  {
    id: 'promo-7',
    title: 'Refer a Friend',
    description: 'Get $25 for each friend you refer',
    category: 'all',
    badge: 'Referral',
    status: 'active',
    cta: 'Learn More',
    validUntil: '2026-12-31',
    gradient: 'from-pink-600 via-pink-700 to-pink-900',
    iconBg: 'bg-pink-500/30',
    icon: <UserPlus size={ICON_SIZE} className="text-pink-400" />,
  },
  {
    id: 'promo-8',
    title: 'Weekend Parlay Boost',
    description: '25% extra on 4+ leg parlays',
    category: 'sports',
    badge: 'Odds Boost',
    status: 'limited',
    cta: 'Opt In',
    validUntil: '2026-04-30',
    gradient: 'from-cyan-600 via-cyan-700 to-cyan-900',
    iconBg: 'bg-cyan-500/30',
    icon: <Trophy size={ICON_SIZE} className="text-cyan-400" />,
  },
];

// ─── Component ──────────────────────────────────────────────────

export default function PromotionsPage() {
  const [activeCategory, setActiveCategory] = useState<PromotionCategory>('all');
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeStatus, setPromoCodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [promoCodeMessage, setPromoCodeMessage] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);

  const filtered =
    activeCategory === 'all'
      ? PROMOTIONS
      : PROMOTIONS.filter(
          (p) => p.category === activeCategory || p.category === 'all'
        );

  function handleApplyPromoCode() {
    const trimmed = promoCode.trim();
    if (!trimmed) {
      setPromoCodeStatus('error');
      setPromoCodeMessage('Please enter a promo code.');
      return;
    }
    // Mock validation
    if (trimmed.toUpperCase() === 'WELCOME500' || trimmed.toUpperCase() === 'CRYPTOBET') {
      setPromoCodeStatus('success');
      setPromoCodeMessage(`Promo code "${trimmed.toUpperCase()}" applied successfully! Bonus has been credited to your account.`);
    } else {
      setPromoCodeStatus('error');
      setPromoCodeMessage(`Invalid promo code "${trimmed}". Please check and try again.`);
    }
  }

  function formatValidUntil(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white">Promotions</h1>
        <button
          onClick={() => setShowPromoModal(!showPromoModal)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#8D52DA] text-[#B47EFF] hover:bg-[#8D52DA]/10 transition-colors text-sm font-medium"
        >
          <Tag size={16} />
          Enter promo code
        </button>
      </div>

      {/* ─── Inline Promo Code Entry (toggled) ─────────────────── */}
      {showPromoModal && (
        <div className="bg-[#1A1B1F] border border-[#2A2B30] rounded-xl p-5 flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label htmlFor="header-promo" className="block text-sm text-gray-400 mb-1.5">
              Promo Code
            </label>
            <input
              id="header-promo"
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                if (promoCodeStatus !== 'idle') {
                  setPromoCodeStatus('idle');
                  setPromoCodeMessage('');
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromoCode()}
              placeholder="e.g. WELCOME500"
              className="w-full bg-[#12131A] border border-[#2A2B30] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#8D52DA] transition-colors text-sm"
            />
          </div>
          <button
            onClick={handleApplyPromoCode}
            className="px-6 py-2.5 bg-[#8D52DA] hover:bg-[#7B45C3] text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            Apply
          </button>
          {promoCodeMessage && (
            <p
              className={cn(
                'text-sm sm:self-center',
                promoCodeStatus === 'success' ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {promoCodeMessage}
            </p>
          )}
        </div>
      )}

      {/* ─── Category Tabs ─────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeCategory === tab.key
                ? 'bg-[#8D52DA] text-white'
                : 'bg-[#1A1B1F] text-gray-400 hover:text-white hover:bg-[#252630]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Promotion Cards Grid ──────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((promo) => {
            const statusInfo = STATUS_COLORS[promo.status];
            return (
              <div
                key={promo.id}
                className="bg-[#1A1B1F] rounded-xl overflow-hidden border border-transparent hover:border-[#8D52DA]/40 transition-all group"
              >
                {/* Banner */}
                <div
                  className={cn(
                    'relative aspect-video bg-gradient-to-br flex items-center justify-center',
                    promo.gradient
                  )}
                >
                  {/* Decorative circles */}
                  <div className="absolute top-4 right-4 w-20 h-20 bg-white/5 rounded-full blur-xl" />
                  <div className="absolute bottom-4 left-4 w-16 h-16 bg-black/10 rounded-full blur-lg" />

                  {/* Icon container */}
                  <div
                    className={cn(
                      'relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm',
                      promo.iconBg
                    )}
                  >
                    {promo.icon}
                  </div>

                  {/* Status indicator */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <span className={cn('w-2 h-2 rounded-full', statusInfo.dot)} />
                    <span className={cn('text-[11px] font-medium', statusInfo.text)}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 text-[11px] font-semibold rounded-full',
                        BADGE_COLORS[promo.badge]
                      )}
                    >
                      {promo.badge}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#B47EFF] transition-colors">
                    {promo.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-3 leading-relaxed">
                    {promo.description}
                  </p>

                  {/* Valid until */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                    <Clock size={13} />
                    <span>Valid until {formatValidUntil(promo.validUntil)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    {promo.cta === 'Claim Now' ? (
                      <button className="flex items-center gap-2 px-5 py-2 bg-[#8D52DA] hover:bg-[#7B45C3] text-white text-sm font-medium rounded-lg transition-colors">
                        {promo.cta}
                        <ArrowRight size={14} />
                      </button>
                    ) : promo.cta === 'Opt In' ? (
                      <button className="flex items-center gap-2 px-5 py-2 bg-[#8D52DA] hover:bg-[#7B45C3] text-white text-sm font-medium rounded-lg transition-colors">
                        {promo.cta}
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button className="flex items-center gap-2 px-5 py-2 border border-[#8D52DA] text-[#B47EFF] hover:bg-[#8D52DA]/10 text-sm font-medium rounded-lg transition-colors">
                        {promo.cta}
                        <ArrowRight size={14} />
                      </button>
                    )}
                    <button className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">
                      T&Cs apply
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#1A1B1F] rounded-xl text-center py-16 px-6">
          <div className="w-14 h-14 bg-[#252630] rounded-full mx-auto mb-4 flex items-center justify-center">
            <Gift size={24} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No promotions found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            There are no promotions in this category right now. Check back soon or browse all promotions.
          </p>
        </div>
      )}

      {/* ─── Promo Code Section (Bottom) ───────────────────────── */}
      <div className="bg-[#1A1B1F] rounded-xl border border-[#2A2B30] p-6 md:p-8">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-12 h-12 bg-[#8D52DA]/20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Tag size={22} className="text-[#B47EFF]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Have a Promo Code?</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your promotional code below to unlock exclusive bonuses and offers.
          </p>

          <div className="flex gap-3 max-w-md mx-auto">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                if (promoCodeStatus !== 'idle') {
                  setPromoCodeStatus('idle');
                  setPromoCodeMessage('');
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromoCode()}
              placeholder="Enter promo code"
              className="flex-1 bg-[#12131A] border border-[#2A2B30] rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#8D52DA] transition-colors text-sm text-center uppercase tracking-wider"
            />
            <button
              onClick={handleApplyPromoCode}
              className="px-8 py-3 bg-[#8D52DA] hover:bg-[#7B45C3] text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Apply
            </button>
          </div>

          {/* Status message */}
          {promoCodeMessage && (
            <div
              className={cn(
                'mt-4 text-sm px-4 py-2.5 rounded-lg',
                promoCodeStatus === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}
            >
              {promoCodeMessage}
            </div>
          )}
        </div>
      </div>

      {/* ─── Terms Notice ──────────────────────────────────────── */}
      <p className="text-center text-xs text-gray-600">
        All promotions are subject to{' '}
        <a href="/help/terms" className="text-[#B47EFF] hover:underline">
          Terms & Conditions
        </a>
        . Wagering requirements and other restrictions may apply. Promotions may be modified or withdrawn at any time.
        Must be 18+ to participate.
      </p>
    </div>
  );
}
