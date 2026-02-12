'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function RewardsPage() {
  const [calendar, setCalendar] = useState<any>(null);
  const [rakeback, setRakeback] = useState<any>(null);
  const [turbo, setTurbo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/rewards/calendar').catch(() => ({ data: { data: null } })),
      api.get('/rewards/rakeback').catch(() => ({ data: { data: null } })),
      api.get('/rewards/turbo/status').catch(() => ({ data: { data: null } })),
    ]).then(([calRes, rakeRes, turboRes]) => {
      setCalendar(calRes.data.data);
      setRakeback(rakeRes.data.data);
      setTurbo(turboRes.data.data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const claimReward = async (slotId: string) => {
    await api.post(`/rewards/calendar/${slotId}/claim`);
    // Refresh
    const { data } = await api.get('/rewards/calendar');
    setCalendar(data.data);
  };

  if (isLoading) return <div className="max-w-4xl mx-auto"><div className="card h-64 animate-pulse bg-surface-tertiary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Rewards</h1>

      {/* TURBO Mode */}
      {turbo?.isActive && (
        <div className="card bg-gradient-to-r from-accent-yellow/20 to-orange-500/20 border-accent-yellow/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-accent-yellow">TURBO MODE ACTIVE</p>
              <p className="text-xs text-gray-400">Casino rakeback boosted to {turbo.boostPercent}%</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold font-mono text-accent-yellow">{turbo.remainingMinutes}m</p>
              <p className="text-xs text-gray-500">remaining</p>
            </div>
          </div>
        </div>
      )}

      {/* Rakeback Stats */}
      {rakeback && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Today', value: rakeback.today },
            { label: 'This Week', value: rakeback.thisWeek },
            { label: 'This Month', value: rakeback.thisMonth },
            { label: 'Lifetime', value: rakeback.lifetime },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-xs text-gray-400">{stat.label}</p>
              <p className="text-lg font-bold font-mono text-accent-green">${stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rewards Calendar */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Rewards Calendar</h2>
        <p className="text-xs text-gray-500 mb-4">Claim your rewards 3 times per day (every 8 hours). Each unlock has a 12-hour claim window.</p>

        {calendar?.slots ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {calendar.slots.map((slot: any, idx: number) => {
              const isAvailable = slot.status === 'AVAILABLE';
              const isClaimed = slot.status === 'CLAIMED';
              const isLocked = slot.status === 'LOCKED';
              const isExpired = slot.status === 'EXPIRED';

              return (
                <div key={idx} className={cn(
                  'card text-center transition-colors',
                  isAvailable ? 'border-accent-green/50 bg-accent-green/5' :
                  isClaimed ? 'border-gray-700 opacity-60' :
                  isExpired ? 'border-accent-red/30 opacity-40' :
                  'border-border'
                )}>
                  <p className="text-xs text-gray-500 mb-1">Slot {idx + 1}</p>
                  <p className="text-lg font-bold font-mono">
                    {slot.amount ? `$${slot.amount}` : '--'}
                  </p>
                  <p className={cn('text-xs font-bold mt-2',
                    isAvailable ? 'text-accent-green' :
                    isClaimed ? 'text-gray-500' :
                    isExpired ? 'text-accent-red' : 'text-gray-600'
                  )}>
                    {isClaimed ? 'Claimed' : isAvailable ? 'Available!' : isExpired ? 'Expired' : 'Locked'}
                  </p>
                  {isAvailable && (
                    <button onClick={() => claimReward(slot.id)} className="btn-primary text-sm mt-3 w-full">
                      Claim
                    </button>
                  )}
                  {isLocked && slot.unlocksAt && (
                    <p className="text-xs text-gray-600 mt-2">
                      Unlocks: {new Date(slot.unlocksAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center py-8 text-gray-500">
            <p>Place bets to unlock rewards calendar slots.</p>
          </div>
        )}
      </section>

      {/* Welcome Package Progress */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Welcome Package</h2>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Up to $2,500 in rewards over 30 days</p>
              <p className="text-xs text-gray-500">10% rakeback on every bet from day 1</p>
            </div>
            <span className="text-xs text-brand-400 font-bold">Active</span>
          </div>
          <div className="w-full h-2 bg-surface-tertiary rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full" style={{ width: '30%' }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">Day 9 of 30</p>
        </div>
      </section>

      {/* Level-Up Rewards */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Level-Up Rewards</h2>
        <div className="card">
          <p className="text-sm text-gray-400 mb-3">Earn cash bonuses as you cross wagering milestones.</p>
          <div className="space-y-2">
            {[
              { level: '$1,000 wagered', reward: '$5', status: 'claimed' },
              { level: '$5,000 wagered', reward: '$25', status: 'claimed' },
              { level: '$10,000 wagered', reward: '$50', status: 'available' },
              { level: '$50,000 wagered', reward: '$250', status: 'locked' },
              { level: '$100,000 wagered', reward: '$500', status: 'locked' },
            ].map((item) => (
              <div key={item.level} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                <div>
                  <p className="text-sm">{item.level}</p>
                  <p className="text-xs font-mono text-accent-green">{item.reward}</p>
                </div>
                <span className={cn('text-xs font-bold',
                  item.status === 'claimed' ? 'text-gray-500' :
                  item.status === 'available' ? 'text-accent-green' : 'text-gray-600'
                )}>
                  {item.status === 'claimed' ? 'Claimed' : item.status === 'available' ? 'Claim!' : 'Locked'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
