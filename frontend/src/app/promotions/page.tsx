'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: string;
  minDeposit: string;
  wageringRequirement: number;
  maxBonus: string;
  expiresAt: string | null;
  isActive: boolean;
  featured?: boolean;
  gradient?: string;
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'welcome', label: 'Welcome' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'free_bet', label: 'Free Bets' },
  { key: 'cashback', label: 'Cashback' },
  { key: 'vip', label: 'VIP' },
] as const;

const TYPE_BADGE_COLORS: Record<string, string> = {
  DEPOSIT_BONUS: 'bg-brand-500/20 text-brand-400',
  FREE_BET: 'bg-accent-green/20 text-accent-green',
  CASHBACK: 'bg-accent-yellow/20 text-accent-yellow',
  WELCOME_BONUS: 'bg-accent-purple/20 text-accent-purple',
  RELOAD_BONUS: 'bg-accent-orange/20 text-accent-orange',
  VIP_BONUS: 'bg-purple-500/20 text-purple-400',
};

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT_BONUS: 'Deposit Bonus',
  FREE_BET: 'Free Bet',
  CASHBACK: 'Cashback',
  WELCOME_BONUS: 'Welcome Bonus',
  RELOAD_BONUS: 'Reload Bonus',
  VIP_BONUS: 'VIP Bonus',
};

const CARD_GRADIENTS = [
  'from-brand-500/30 to-brand-700/10',
  'from-accent-green/30 to-emerald-700/10',
  'from-accent-yellow/30 to-amber-700/10',
  'from-purple-500/30 to-purple-700/10',
  'from-accent-orange/30 to-orange-700/10',
  'from-cyan-500/30 to-cyan-700/10',
];

const FALLBACK_PROMOTIONS: Promotion[] = [
  {
    id: 'fallback-1',
    title: 'Welcome Bonus - 100% up to 5 BTC',
    description: 'Start your journey with CryptoBet and get a 100% match on your first deposit up to 5 BTC. Use your bonus across sports betting and casino games.',
    type: 'WELCOME_BONUS',
    minDeposit: '0.001',
    wageringRequirement: 40,
    maxBonus: '5 BTC',
    expiresAt: null,
    isActive: true,
    featured: true,
    gradient: 'from-brand-500/40 to-purple-600/20',
  },
  {
    id: 'fallback-2',
    title: 'Weekly Cashback 10%',
    description: 'Get 10% cashback on your net losses every week. Cashback is credited automatically every Monday with no wagering requirements.',
    type: 'CASHBACK',
    minDeposit: '0.0005',
    wageringRequirement: 0,
    maxBonus: '1 BTC',
    expiresAt: null,
    isActive: true,
    gradient: 'from-accent-yellow/30 to-amber-700/10',
  },
  {
    id: 'fallback-3',
    title: 'Free Bet Friday',
    description: 'Place at least 3 bets during the week and receive a free bet every Friday. The free bet value is based on your weekly activity level.',
    type: 'FREE_BET',
    minDeposit: '0.001',
    wageringRequirement: 1,
    maxBonus: '0.05 BTC',
    expiresAt: null,
    isActive: true,
    gradient: 'from-accent-green/30 to-emerald-700/10',
  },
  {
    id: 'fallback-4',
    title: 'VIP Reload Bonus',
    description: 'Exclusive for VIP members. Get a 50% reload bonus on every deposit up to 2 BTC. Higher VIP tiers unlock even greater bonuses.',
    type: 'VIP_BONUS',
    minDeposit: '0.01',
    wageringRequirement: 25,
    maxBonus: '2 BTC',
    expiresAt: null,
    isActive: true,
    gradient: 'from-purple-500/30 to-purple-700/10',
  },
  {
    id: 'fallback-5',
    title: 'First Deposit Bonus - 150%',
    description: 'Make your first deposit and receive a 150% bonus. Available for all new players who complete identity verification.',
    type: 'DEPOSIT_BONUS',
    minDeposit: '0.002',
    wageringRequirement: 35,
    maxBonus: '3 BTC',
    expiresAt: null,
    isActive: true,
    gradient: 'from-cyan-500/30 to-cyan-700/10',
  },
  {
    id: 'fallback-6',
    title: 'Esports Cashback',
    description: 'Bet on esports and get 15% cashback on net losses. Covers all major esports tournaments including CS2, Dota 2, and League of Legends.',
    type: 'CASHBACK',
    minDeposit: '0.0005',
    wageringRequirement: 0,
    maxBonus: '0.5 BTC',
    expiresAt: null,
    isActive: true,
    gradient: 'from-accent-orange/30 to-orange-700/10',
  },
];

function getFilterCategory(type: string): string {
  switch (type) {
    case 'WELCOME_BONUS':
      return 'welcome';
    case 'DEPOSIT_BONUS':
    case 'RELOAD_BONUS':
      return 'deposit';
    case 'FREE_BET':
      return 'free_bet';
    case 'CASHBACK':
      return 'cashback';
    case 'VIP_BONUS':
      return 'vip';
    default:
      return 'all';
  }
}

function SkeletonCard({ large }: { large?: boolean }) {
  return (
    <div className={cn('card animate-pulse', large ? 'md:col-span-2' : '')}>
      <div className={cn('bg-surface-tertiary rounded-lg mb-4', large ? 'h-40' : 'h-28')} />
      <div className="h-4 bg-surface-tertiary rounded w-1/4 mb-3" />
      <div className="h-6 bg-surface-tertiary rounded w-3/4 mb-2" />
      <div className="h-4 bg-surface-tertiary rounded w-full mb-2" />
      <div className="h-4 bg-surface-tertiary rounded w-2/3 mb-4" />
      <div className="flex gap-4">
        <div className="h-4 bg-surface-tertiary rounded w-1/4" />
        <div className="h-4 bg-surface-tertiary rounded w-1/4" />
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get('/promotions')
      .then((res) => {
        const data = res.data.data;
        if (Array.isArray(data) && data.length > 0) {
          const withGradients = data.map((p: Promotion, i: number) => ({
            ...p,
            gradient: p.gradient || CARD_GRADIENTS[i % CARD_GRADIENTS.length],
          }));
          setPromotions(withGradients);
        } else {
          setPromotions(FALLBACK_PROMOTIONS);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setPromotions(FALLBACK_PROMOTIONS);
        setIsLoading(false);
      });
  }, []);

  const filtered =
    activeFilter === 'all'
      ? promotions
      : promotions.filter((p) => getFilterCategory(p.type) === activeFilter);

  const featuredPromo = filtered.find((p) => p.featured);
  const regularPromos = filtered.filter((p) => !p.featured);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500/20 via-surface-secondary to-purple-600/20 border border-border p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent" />
        <div className="relative z-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Promotions & Bonuses</h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            Boost your bankroll with our exclusive promotions. From welcome bonuses to weekly cashback,
            there is always a reward waiting for you at CryptoBet.
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-4 right-8 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-4 left-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeFilter === tab.key
                ? 'bg-brand-500 text-white'
                : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          <SkeletonCard large />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Featured Promotion */}
      {!isLoading && featuredPromo && (
        <div
          className={cn(
            'card border-brand-500/30 overflow-hidden relative',
            'md:col-span-2'
          )}
        >
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-60',
              featuredPromo.gradient || 'from-brand-500/40 to-purple-600/20'
            )}
          />
          <div className="relative z-10 p-4 md:p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-brand-500 text-white text-xs font-bold rounded-full uppercase">
                Featured
              </span>
              <span
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  TYPE_BADGE_COLORS[featuredPromo.type] || 'bg-surface-tertiary text-gray-300'
                )}
              >
                {TYPE_LABELS[featuredPromo.type] || featuredPromo.type}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">{featuredPromo.title}</h2>
            <p className="text-gray-300 text-sm md:text-base mb-6 max-w-2xl">
              {featuredPromo.description}
            </p>
            <div className="flex flex-wrap gap-4 mb-6 text-sm">
              <div className="bg-surface/60 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-gray-400 text-xs">Min Deposit</p>
                <p className="font-bold font-mono">{featuredPromo.minDeposit} BTC</p>
              </div>
              <div className="bg-surface/60 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-gray-400 text-xs">Max Bonus</p>
                <p className="font-bold font-mono text-accent-green">{featuredPromo.maxBonus}</p>
              </div>
              {featuredPromo.wageringRequirement > 0 && (
                <div className="bg-surface/60 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-gray-400 text-xs">Wagering</p>
                  <p className="font-bold font-mono">{featuredPromo.wageringRequirement}x</p>
                </div>
              )}
            </div>
            <Link href="/register" className="btn-primary inline-block text-center">
              Claim Now
            </Link>
          </div>
        </div>
      )}

      {/* Promotion Cards Grid */}
      {!isLoading && regularPromos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {regularPromos.map((promo, index) => (
            <div key={promo.id} className="card overflow-hidden hover:border-brand-500/40 transition-colors group">
              {/* Gradient Header */}
              <div
                className={cn(
                  'h-28 -mx-4 -mt-4 mb-4 bg-gradient-to-br flex items-end p-4',
                  promo.gradient || CARD_GRADIENTS[index % CARD_GRADIENTS.length]
                )}
              >
                <span
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    TYPE_BADGE_COLORS[promo.type] || 'bg-surface-tertiary text-gray-300'
                  )}
                >
                  {TYPE_LABELS[promo.type] || promo.type}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold mb-2 group-hover:text-brand-400 transition-colors">
                {promo.title}
              </h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{promo.description}</p>

              {/* Details */}
              <div className="flex flex-wrap gap-3 mb-4 text-xs">
                <div className="bg-surface-tertiary rounded-lg px-3 py-1.5">
                  <span className="text-gray-500">Min Deposit: </span>
                  <span className="font-mono font-medium">{promo.minDeposit} BTC</span>
                </div>
                {promo.wageringRequirement > 0 && (
                  <div className="bg-surface-tertiary rounded-lg px-3 py-1.5">
                    <span className="text-gray-500">Wagering: </span>
                    <span className="font-mono font-medium">{promo.wageringRequirement}x</span>
                  </div>
                )}
                <div className="bg-surface-tertiary rounded-lg px-3 py-1.5">
                  <span className="text-gray-500">Max: </span>
                  <span className="font-mono font-medium text-accent-green">{promo.maxBonus}</span>
                </div>
              </div>

              {/* Expiry */}
              {promo.expiresAt && (
                <p className="text-xs text-gray-500 mb-4">
                  Expires: {new Date(promo.expiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}

              {/* CTA */}
              <Link href="/register" className="btn-primary inline-block text-center text-sm w-full">
                Claim Now
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filtered.length === 0 && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-surface-tertiary rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-1">No promotions found</h3>
          <p className="text-gray-500 text-sm">
            There are no promotions in this category at the moment. Check back soon.
          </p>
        </div>
      )}

      {/* Terms Notice */}
      <div className="text-center text-xs text-gray-600 pb-4">
        <p>
          All promotions are subject to{' '}
          <Link href="/help/terms" className="text-brand-400 hover:underline">
            Terms & Conditions
          </Link>
          . Wagering requirements and other restrictions may apply. Must be 18+ to participate.
        </p>
      </div>
    </div>
  );
}
