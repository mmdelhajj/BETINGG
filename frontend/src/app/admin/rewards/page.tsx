'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type Tab = 'vip' | 'rakeback' | 'turbo' | 'welcome' | 'promotions' | 'referrals';

const VIP_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'EMERALD', 'SAPPHIRE', 'RUBY', 'DIAMOND', 'BLUE_DIAMOND'];

export default function AdminRewardsPage() {
  const [tab, setTab] = useState<Tab>('vip');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Rewards Management</h1>

      <div className="flex gap-1 overflow-x-auto">
        {(['vip', 'rakeback', 'turbo', 'welcome', 'promotions', 'referrals'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm capitalize transition-colors whitespace-nowrap',
              tab === t ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}>{t}</button>
        ))}
      </div>

      {/* VIP Tier Configuration */}
      {tab === 'vip' && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">VIP Tier Configuration</h2>
          {VIP_TIERS.map((tier) => (
            <div key={tier} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">{tier.replace('_', ' ')}</h3>
                <button className="text-xs text-brand-400 hover:underline">Edit</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-gray-500 block">Min Wagered ($)</label>
                  <input type="number" className="input text-sm py-1 mt-1" placeholder="0" />
                </div>
                <div>
                  <label className="text-gray-500 block">Rakeback %</label>
                  <input type="number" className="input text-sm py-1 mt-1" step="0.1" placeholder="0" />
                </div>
                <div>
                  <label className="text-gray-500 block">Daily Bonus Max ($)</label>
                  <input type="number" className="input text-sm py-1 mt-1" placeholder="0" />
                </div>
                <div>
                  <label className="text-gray-500 block">Weekly Bonus Max ($)</label>
                  <input type="number" className="input text-sm py-1 mt-1" placeholder="0" />
                </div>
              </div>
            </div>
          ))}
          <button className="btn-primary">Save VIP Configuration</button>
        </div>
      )}

      {/* Rakeback Settings */}
      {tab === 'rakeback' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold">Rakeback Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Wallet Split (%)</label>
              <input type="number" className="input" defaultValue="60" />
              <p className="text-xs text-gray-500 mt-1">Percentage sent directly to wallet</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Calendar Split (%)</label>
              <input type="number" className="input" defaultValue="40" />
              <p className="text-xs text-gray-500 mt-1">Percentage added to rewards calendar</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Base Rakeback Rate (%)</label>
            <input type="number" className="input w-40" defaultValue="5" step="0.1" />
          </div>
          <button className="btn-primary">Save Rakeback Settings</button>
        </div>
      )}

      {/* TURBO Settings */}
      {tab === 'turbo' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold">TURBO Mode Configuration</h2>
          <p className="text-xs text-gray-500">Configure the casino rakeback boost multiplier and duration per VIP tier.</p>
          <div className="space-y-2">
            {VIP_TIERS.map((tier) => (
              <div key={tier} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                <span className="text-sm font-medium">{tier.replace('_', ' ')}</span>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Boost %:</label>
                    <input type="number" className="input w-16 text-sm py-1 text-center" />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Duration (min):</label>
                    <input type="number" className="input w-16 text-sm py-1 text-center" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary">Save TURBO Settings</button>
        </div>
      )}

      {/* Welcome Package */}
      {tab === 'welcome' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold">Welcome Package Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Duration (days)</label>
              <input type="number" className="input" defaultValue="30" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Value ($)</label>
              <input type="number" className="input" defaultValue="2500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rakeback Boost (%)</label>
              <input type="number" className="input" defaultValue="10" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cash Vault Bonus ($)</label>
              <input type="number" className="input" defaultValue="500" />
            </div>
          </div>
          <button className="btn-primary">Save Welcome Package</button>
        </div>
      )}

      {/* Promotions */}
      {tab === 'promotions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold">Active Promotions</h2>
            <button className="btn-primary text-sm">Create Promotion</button>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 text-center py-8">Manage promotions, promo codes, and bonus conditions from this panel.</p>
          </div>
        </div>
      )}

      {/* Referral Settings */}
      {tab === 'referrals' && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold">Referral Program Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Commission Rate (%)</label>
              <input type="number" className="input" defaultValue="5" step="0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Bonus per Referral ($)</label>
              <input type="number" className="input" defaultValue="100" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Referrer Share (%)</label>
              <input type="number" className="input" defaultValue="50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Referee Share (%)</label>
              <input type="number" className="input" defaultValue="50" />
            </div>
          </div>
          <button className="btn-primary">Save Referral Settings</button>
        </div>
      )}
    </div>
  );
}
