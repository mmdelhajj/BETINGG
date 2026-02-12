'use client';

import { useState } from 'react';
import { Gift, Clock, ArrowRight } from 'lucide-react';

// Types
type PromotionCategory = 'all' | 'sports' | 'casino' | 'vip';
type PromotionBadge = 'Deposit Bonus' | 'Free Bet' | 'Cashback' | 'Odds Boost';

interface Promotion {
  id: string;
  title: string;
  description: string;
  category: PromotionCategory;
  badge: PromotionBadge;
  validUntil: string;
  gradient: string;
}

// Mock Data
const PROMOTIONS: Promotion[] = [
  {
    id: 'promo-1',
    title: 'Welcome Bonus',
    description: '100% up to $500 on first deposit',
    category: 'all',
    badge: 'Deposit Bonus',
    validUntil: '2026-06-30',
    gradient: 'from-[#8D52DA] to-[#5A3A8F]',
  },
  {
    id: 'promo-2',
    title: 'Free Bet Friday',
    description: 'Get a $10 free bet every Friday',
    category: 'sports',
    badge: 'Free Bet',
    validUntil: '2026-12-31',
    gradient: 'from-emerald-600 to-emerald-800',
  },
  {
    id: 'promo-3',
    title: 'Casino Cashback',
    description: '10% weekly cashback on casino losses',
    category: 'casino',
    badge: 'Cashback',
    validUntil: '2026-12-31',
    gradient: 'from-amber-600 to-amber-800',
  },
  {
    id: 'promo-4',
    title: 'Premier League Special',
    description: 'Boosted odds on all Premier League matches',
    category: 'sports',
    badge: 'Odds Boost',
    validUntil: '2026-05-25',
    gradient: 'from-sky-600 to-sky-800',
  },
  {
    id: 'promo-5',
    title: 'VIP Reload',
    description: '50% reload bonus for VIP members',
    category: 'vip',
    badge: 'Deposit Bonus',
    validUntil: '2026-12-31',
    gradient: 'from-purple-600 to-purple-900',
  },
  {
    id: 'promo-6',
    title: 'Crypto Deposit Bonus',
    description: 'Extra 5% on all crypto deposits',
    category: 'all',
    badge: 'Deposit Bonus',
    validUntil: '2026-09-30',
    gradient: 'from-orange-600 to-orange-800',
  },
];

const CATEGORY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'sports', label: 'Sports' },
  { key: 'casino', label: 'Casino' },
  { key: 'vip', label: 'VIP' },
];

const BADGE_COLORS: Record<PromotionBadge, string> = {
  'Deposit Bonus': 'bg-[rgba(141,82,218,0.15)] text-[#8D52DA]',
  'Free Bet': 'bg-[rgba(48,224,0,0.15)] text-[#30E000]',
  'Cashback': 'bg-[rgba(255,214,0,0.15)] text-[#FFD600]',
  'Odds Boost': 'bg-[rgba(59,130,246,0.15)] text-[#3B82F6]',
};

function formatValidUntil(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PromotionsPage() {
  const [activeCategory, setActiveCategory] = useState<PromotionCategory>('all');
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeStatus, setPromoCodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [promoCodeMessage, setPromoCodeMessage] = useState('');

  const filtered =
    activeCategory === 'all'
      ? PROMOTIONS
      : PROMOTIONS.filter((p) => p.category === activeCategory || p.category === 'all');

  function handleApplyPromoCode() {
    const trimmed = promoCode.trim();
    if (!trimmed) {
      setPromoCodeStatus('error');
      setPromoCodeMessage('Please enter a promo code.');
      return;
    }
    if (trimmed.toUpperCase() === 'WELCOME500' || trimmed.toUpperCase() === 'CRYPTOBET') {
      setPromoCodeStatus('success');
      setPromoCodeMessage(`Promo code "${trimmed.toUpperCase()}" applied successfully!`);
    } else {
      setPromoCodeStatus('error');
      setPromoCodeMessage(`Invalid promo code "${trimmed}". Please check and try again.`);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 bg-[#0F0F12] min-h-screen">
      {/* Header */}
      <div className="py-6">
        <h1 className="text-3xl font-bold text-white mb-2">Promotions</h1>
        <p className="text-[rgba(224,232,255,0.6)]">Exclusive bonuses and offers</p>
      </div>

      {/* Promo Code Input */}
      <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded-lg p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1 w-full">
            <label htmlFor="promo-code" className="block text-sm text-[rgba(224,232,255,0.6)] mb-1.5">
              Promo Code
            </label>
            <input
              id="promo-code"
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
              className="w-full bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-[#8D52DA] transition-colors text-base h-10"
              style={{ fontSize: '16px' }}
            />
          </div>
          <button
            onClick={handleApplyPromoCode}
            className="px-6 py-3 bg-[#8D52DA] hover:opacity-90 text-white font-medium rounded transition-opacity text-sm whitespace-nowrap h-10"
          >
            Apply
          </button>
        </div>
        {promoCodeMessage && (
          <p
            className={`text-sm mt-3 ${
              promoCodeStatus === 'success' ? 'text-[#30E000]' : 'text-[#FF494A]'
            }`}
          >
            {promoCodeMessage}
          </p>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key as PromotionCategory)}
            className={`px-5 py-2.5 h-10 rounded text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === tab.key
                ? 'bg-[#8D52DA] text-white'
                : 'bg-[#222328] text-[rgba(224,232,255,0.6)] hover:text-white hover:bg-[#2A2B30] border border-[rgba(255,255,255,0.06)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Promotion Cards Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((promo) => (
            <div
              key={promo.id}
              className="bg-[#1A1B1F] rounded-lg overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[rgba(141,82,218,0.4)] transition-all group"
            >
              {/* Banner */}
              <div className={`relative aspect-video bg-gradient-to-br ${promo.gradient} flex items-center justify-center p-6`}>
                <div className="absolute top-4 right-4 w-20 h-20 bg-white/5 rounded-full blur-xl" />
                <div className="absolute bottom-4 left-4 w-16 h-16 bg-black/10 rounded-full blur-lg" />

                <div className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm">
                  <Gift className="w-8 h-8 text-white" />
                </div>

                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${BADGE_COLORS[promo.badge]}`}>
                    {promo.badge}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#B47EFF] transition-colors">
                  {promo.title}
                </h3>
                <p className="text-[rgba(224,232,255,0.6)] text-sm mb-3 leading-relaxed">
                  {promo.description}
                </p>

                {/* Valid until */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Valid until {formatValidUntil(promo.validUntil)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#8D52DA] hover:opacity-90 text-white text-sm font-medium rounded transition-opacity flex-1 sm:flex-initial">
                    Claim Now
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">
                    T&Cs apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#1A1B1F] rounded-lg text-center py-16 px-6 border border-[rgba(255,255,255,0.06)]">
          <div className="w-14 h-14 bg-[#222328] rounded-full mx-auto mb-4 flex items-center justify-center">
            <Gift className="w-6 h-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No promotions found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            There are no promotions in this category right now. Check back soon or browse all promotions.
          </p>
        </div>
      )}

      {/* Terms Notice */}
      <p className="text-center text-xs text-gray-600 mt-8">
        All promotions are subject to{' '}
        <a href="/help/terms" className="text-[#8D52DA] hover:underline">
          Terms & Conditions
        </a>
        . Wagering requirements and other restrictions may apply. Promotions may be modified or withdrawn at any time.
        Must be 18+ to participate.
      </p>

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
