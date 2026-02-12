'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'from-amber-700 to-amber-900',
  SILVER: 'from-gray-400 to-gray-600',
  GOLD: 'from-yellow-500 to-yellow-700',
  EMERALD: 'from-emerald-500 to-emerald-700',
  SAPPHIRE: 'from-blue-500 to-blue-700',
  RUBY: 'from-red-500 to-red-700',
  DIAMOND: 'from-cyan-400 to-cyan-600',
  BLUE_DIAMOND: 'from-indigo-400 to-indigo-600',
};

export default function VipPage() {
  const [status, setStatus] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/vip/status'),
      api.get('/vip/tiers'),
      api.get('/rewards/rakeback').catch(() => ({ data: { data: null } })),
    ]).then(([statusRes, tiersRes, rewardsRes]) => {
      setStatus(statusRes.data.data);
      setTiers(tiersRes.data.data);
      setRewards(rewardsRes.data.data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="max-w-4xl mx-auto"><div className="card h-64 animate-pulse bg-surface-tertiary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Current Status */}
      {status && (
        <div className={cn('card bg-gradient-to-r border-0 p-6', TIER_COLORS[status.currentTier] || 'from-gray-600 to-gray-800')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Your VIP Tier</p>
              <h1 className="text-3xl font-bold">{status.currentTier.replace('_', ' ')}</h1>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Total Wagered</p>
              <p className="text-xl font-bold font-mono">${status.totalWagered}</p>
            </div>
          </div>

          {status.nextTier && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Progress to {status.nextTier.replace('_', ' ')}</span>
                <span>{status.progressPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/50 rounded-full transition-all"
                  style={{ width: `${Math.min(status.progressPercent, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rakeback Stats */}
      {rewards && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Today', value: rewards.today },
            { label: 'This Week', value: rewards.thisWeek },
            { label: 'This Month', value: rewards.thisMonth },
            { label: 'Lifetime', value: rewards.lifetime },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-xs text-gray-400">{stat.label}</p>
              <p className="text-lg font-bold font-mono text-accent-green">${stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tier Comparison */}
      <section>
        <h2 className="text-lg font-semibold mb-3">VIP Tiers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {tiers.map((tier: any) => (
            <div
              key={tier.tier}
              className={cn(
                'card border transition-colors',
                tier.tier === status?.currentTier ? 'border-brand-500' : 'border-border'
              )}
            >
              <div className={cn('h-2 rounded-full mb-3 bg-gradient-to-r', TIER_COLORS[tier.tier] || 'from-gray-500 to-gray-700')} />
              <h3 className="font-bold text-sm">{tier.tier.replace('_', ' ')}</h3>
              <p className="text-xs text-gray-500 mt-1">Min wagered: ${tier.minWagered}</p>
              <div className="mt-3 space-y-1 text-xs">
                <p>Rakeback: <span className="text-brand-400">{tier.rakebackPercent}%</span></p>
                <p>Daily Bonus: <span className="text-brand-400">${tier.dailyBonusMax}</span></p>
                {tier.weeklyBonusMax > 0 && <p>Weekly: <span className="text-brand-400">${tier.weeklyBonusMax}</span></p>}
                {tier.monthlyBonusMax > 0 && <p>Monthly: <span className="text-brand-400">${tier.monthlyBonusMax}</span></p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
