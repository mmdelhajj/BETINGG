'use client';

import React, { useState, useEffect } from 'react';
import { Crown, Edit2, Save, X, Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { get, put, post } from '@/lib/api';

const VIP_TIERS = [
  { name: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-400/10', threshold: 0, rakeback: 0.5 },
  { name: 'Silver', color: 'text-gray-300', bg: 'bg-gray-300/10', threshold: 5000, rakeback: 1.0 },
  { name: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-400/10', threshold: 25000, rakeback: 1.5 },
  { name: 'Platinum', color: 'text-cyan-300', bg: 'bg-cyan-300/10', threshold: 100000, rakeback: 2.0 },
  { name: 'Diamond', color: 'text-blue-400', bg: 'bg-blue-400/10', threshold: 500000, rakeback: 2.5 },
  { name: 'Elite', color: 'text-purple-400', bg: 'bg-purple-400/10', threshold: 2000000, rakeback: 3.0 },
  { name: 'Black Diamond', color: 'text-white', bg: 'bg-white/10', threshold: 10000000, rakeback: 4.0 },
  { name: 'Blue Diamond', color: 'text-blue-300', bg: 'bg-blue-300/10', threshold: 50000000, rakeback: 5.0 },
];

export default function AdminVipPage() {
  const [editingTier, setEditingTier] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignTier, setAssignTier] = useState('GOLD');

  const handleAssignTier = async () => {
    if (!assignUserId) return;
    try {
      await post(`/admin/vip/assign`, { userId: assignUserId, tier: assignTier });
      setAssignUserId('');
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="w-6 h-6 text-accent" /> VIP Management
          </h1>
          <p className="text-text-muted text-sm mt-1">Configure VIP tiers and manage player assignments</p>
        </div>
      </div>

      {/* VIP Tiers Configuration */}
      <div className="bg-background-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold">VIP Tier Configuration</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-sm text-text-muted">
                <th className="px-6 py-3">Tier</th>
                <th className="px-6 py-3">Min Wagered</th>
                <th className="px-6 py-3">Rakeback %</th>
                <th className="px-6 py-3">Turbo Boost</th>
                <th className="px-6 py-3">Calendar Bonus</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {VIP_TIERS.map((tier, i) => (
                <tr key={tier.name} className="border-b border-border/50 hover:bg-background-elevated/50">
                  <td className="px-6 py-4">
                    <span className={cn('px-3 py-1 rounded-full text-sm font-medium', tier.bg, tier.color)}>
                      {tier.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono">${Number(tier.threshold || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono">{tier.rakeback}%</td>
                  <td className="px-6 py-4 font-mono">{(Number(tier.rakeback || 0) * 5).toFixed(0)}%</td>
                  <td className="px-6 py-4 font-mono">${(Number(tier.rakeback || 0) * 10).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setEditingTier(editingTier === i ? null : i)}
                      className="p-1.5 rounded hover:bg-accent/20 text-text-muted hover:text-accent transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Tier Assignment */}
      <div className="bg-background-card rounded-xl border border-border p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Manual Tier Assignment
        </h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm text-text-muted mb-1 block">User ID or Email</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                placeholder="Search user..."
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-text"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-text-muted mb-1 block">Target Tier</label>
            <select
              value={assignTier}
              onChange={(e) => setAssignTier(e.target.value)}
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-text"
            >
              {VIP_TIERS.map(t => (
                <option key={t.name} value={t.name.toUpperCase().replace(' ', '_')}>{t.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAssignTier}
            disabled={!assignUserId}
            className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Assign Tier
          </button>
        </div>
      </div>
    </div>
  );
}
