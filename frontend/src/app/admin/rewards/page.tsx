'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatCurrency } from '@/lib/utils';
import { get, put, post } from '@/lib/api';
import {
  Star,
  Edit,
  Save,
  Gift,
  Calendar,
  Zap,
  Users,
  Search,
  DollarSign,
  Percent,
  Clock,
  Trophy,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VipTierConfig {
  id: string;
  name: string;
  level: number;
  wageringThreshold: number;
  rakebackPercent: number;
  turboBoostPercent: number;
  turboDurationMinutes: number;
  calendarBaseReward: number;
  color: string;
}

interface WelcomePackage {
  id: string;
  totalBonusValue: number;
  rakebackPercent: number;
  durationDays: number;
  dailyDropMin: number;
  dailyDropMax: number;
  cashVaultAmount: number;
  active: boolean;
}

interface CalendarSettings {
  id: string;
  claimWindowHours: number;
  claimsPerDay: number;
  baseRewardMultiplier: number;
  turboActivationEnabled: boolean;
  active: boolean;
}

interface BonusGrantForm {
  userId: string;
  username: string;
  amount: number;
  currency: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// VIP tier badge variant
// ---------------------------------------------------------------------------

const vipVariant = (name: string): any => {
  const map: Record<string, string> = {
    bronze: 'bronze', silver: 'silver', gold: 'gold', platinum: 'platinum',
    diamond: 'diamond', elite: 'elite', 'black diamond': 'black-diamond', 'blue diamond': 'blue-diamond',
  };
  return map[(name || '').toLowerCase()] || 'default';
};

// ---------------------------------------------------------------------------
// Rewards Page
// ---------------------------------------------------------------------------

export default function AdminRewardsPage() {
  const [loading, setLoading] = useState(true);

  // VIP tiers
  const [tiers, setTiers] = useState<VipTierConfig[]>([]);
  const [editTier, setEditTier] = useState<VipTierConfig | null>(null);
  const [tierForm, setTierForm] = useState<Partial<VipTierConfig>>({});

  // Welcome package
  const [welcomePackage, setWelcomePackage] = useState<WelcomePackage | null>(null);
  const [wpEditing, setWpEditing] = useState(false);
  const [wpForm, setWpForm] = useState<Partial<WelcomePackage>>({});

  // Calendar
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings | null>(null);
  const [calEditing, setCalEditing] = useState(false);
  const [calForm, setCalForm] = useState<Partial<CalendarSettings>>({});

  // Manual bonus
  const [bonusModal, setBonusModal] = useState(false);
  const [bonusForm, setBonusForm] = useState<BonusGrantForm>({
    userId: '',
    username: '',
    amount: 0,
    currency: 'USDT',
    reason: '',
  });
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<{ id: string; username: string; email: string }[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tiersRes, wpRes, calRes] = await Promise.allSettled([
        get<any>('/admin/rewards/vip-tiers'),
        get<WelcomePackage>('/admin/rewards/welcome-package'),
        get<CalendarSettings>('/admin/rewards/calendar-settings'),
      ]);

      if (tiersRes.status === 'fulfilled') {
        const v = tiersRes.value;
        setTiers(Array.isArray(v) ? v : v?.data || []);
      }
      else {
        setTiers([
          { id: 't-1', name: 'Bronze', level: 1, wageringThreshold: 0, rakebackPercent: 0.5, turboBoostPercent: 5, turboDurationMinutes: 90, calendarBaseReward: 0.50, color: '#CD7F32' },
          { id: 't-2', name: 'Silver', level: 2, wageringThreshold: 5000, rakebackPercent: 1.0, turboBoostPercent: 8, turboDurationMinutes: 90, calendarBaseReward: 1.00, color: '#C0C0C0' },
          { id: 't-3', name: 'Gold', level: 3, wageringThreshold: 25000, rakebackPercent: 1.5, turboBoostPercent: 10, turboDurationMinutes: 90, calendarBaseReward: 2.50, color: '#FFD700' },
          { id: 't-4', name: 'Platinum', level: 4, wageringThreshold: 100000, rakebackPercent: 2.0, turboBoostPercent: 12, turboDurationMinutes: 90, calendarBaseReward: 5.00, color: '#00CED1' },
          { id: 't-5', name: 'Diamond', level: 5, wageringThreshold: 500000, rakebackPercent: 2.5, turboBoostPercent: 15, turboDurationMinutes: 120, calendarBaseReward: 10.00, color: '#9B59B6' },
          { id: 't-6', name: 'Elite', level: 6, wageringThreshold: 2000000, rakebackPercent: 3.0, turboBoostPercent: 18, turboDurationMinutes: 120, calendarBaseReward: 25.00, color: '#E74C3C' },
          { id: 't-7', name: 'Black Diamond', level: 7, wageringThreshold: 10000000, rakebackPercent: 4.0, turboBoostPercent: 22, turboDurationMinutes: 150, calendarBaseReward: 50.00, color: '#2C3E50' },
          { id: 't-8', name: 'Blue Diamond', level: 8, wageringThreshold: 50000000, rakebackPercent: 5.0, turboBoostPercent: 25, turboDurationMinutes: 180, calendarBaseReward: 100.00, color: '#3498DB' },
        ]);
      }

      if (wpRes.status === 'fulfilled') setWelcomePackage(wpRes.value);
      else {
        setWelcomePackage({
          id: 'wp-1',
          totalBonusValue: 2500,
          rakebackPercent: 10,
          durationDays: 30,
          dailyDropMin: 5,
          dailyDropMax: 50,
          cashVaultAmount: 500,
          active: true,
        });
      }

      if (calRes.status === 'fulfilled') setCalendarSettings(calRes.value);
      else {
        setCalendarSettings({
          id: 'cal-1',
          claimWindowHours: 12,
          claimsPerDay: 3,
          baseRewardMultiplier: 1.0,
          turboActivationEnabled: true,
          active: true,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveTier = async () => {
    if (!editTier) return;
    setActionLoading(true);
    try {
      await put(`/admin/rewards/vip-tiers/${editTier.id}`, tierForm);
      setTiers((prev) => prev.map((t) => t.id === editTier.id ? { ...t, ...tierForm } : t));
    } catch { /* silent */ }
    finally { setActionLoading(false); setEditTier(null); }
  };

  const handleSaveWp = async () => {
    if (!welcomePackage) return;
    setActionLoading(true);
    try {
      await put(`/admin/rewards/welcome-package/${welcomePackage.id}`, wpForm);
      setWelcomePackage({ ...welcomePackage, ...wpForm } as WelcomePackage);
    } catch { /* silent */ }
    finally { setActionLoading(false); setWpEditing(false); }
  };

  const handleSaveCal = async () => {
    if (!calendarSettings) return;
    setActionLoading(true);
    try {
      await put(`/admin/rewards/calendar-settings/${calendarSettings.id}`, calForm);
      setCalendarSettings({ ...calendarSettings, ...calForm } as CalendarSettings);
    } catch { /* silent */ }
    finally { setActionLoading(false); setCalEditing(false); }
  };

  const searchUsers = async (query: string) => {
    setUserSearch(query);
    if (query.length < 2) { setUserResults([]); return; }
    try {
      const res = await get<any>(`/admin/users?search=${query}&limit=5`);
      setUserResults(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setUserResults([
        { id: 'u-1', username: 'player_1042', email: 'player1042@email.com' },
        { id: 'u-2', username: 'whale_99', email: 'whale99@email.com' },
      ]);
    }
  };

  const handleGrantBonus = async () => {
    if (!bonusForm.userId || !bonusForm.amount) return;
    setActionLoading(true);
    try {
      await post('/admin/rewards/grant-bonus', {
        userId: bonusForm.userId,
        amount: bonusForm.amount,
        currency: bonusForm.currency,
        reason: bonusForm.reason,
      });
    } catch { /* silent */ }
    finally {
      setActionLoading(false);
      setBonusModal(false);
      setBonusForm({ userId: '', username: '', amount: 0, currency: 'USDT', reason: '' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Rewards Configuration</h1>
          <p className="text-sm text-text-muted mt-0.5">Configure VIP tiers, welcome packages, and reward settings</p>
        </div>
        <Button variant="primary" size="md" leftIcon={<Gift className="w-4 h-4" />} onClick={() => setBonusModal(true)}>
          Grant Manual Bonus
        </Button>
      </div>

      {/* VIP Tier Table */}
      <Card noPadding>
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <Star className="w-4 h-4 text-gold" />
            VIP Tier Configuration
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background-elevated/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Tier</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Wagering Req</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Rakeback %</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Turbo Boost</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Turbo Duration</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Calendar Reward</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                  <td className="py-3 px-4">
                    <Badge variant={vipVariant(tier.name)} size="md">
                      {tier.name}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-text">
                    ${Number(tier.wageringThreshold || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-success">
                    {tier.rakebackPercent}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-accent">
                    {tier.turboBoostPercent}%
                  </td>
                  <td className="py-3 px-3 text-right text-text-secondary">
                    {tier.turboDurationMinutes} min
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-text">
                    ${Number(tier.calendarBaseReward || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditTier(tier);
                      setTierForm({
                        wageringThreshold: tier.wageringThreshold,
                        rakebackPercent: tier.rakebackPercent,
                        turboBoostPercent: tier.turboBoostPercent,
                        turboDurationMinutes: tier.turboDurationMinutes,
                        calendarBaseReward: tier.calendarBaseReward,
                      });
                    }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Welcome Package */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-accent" />
              Welcome Package
            </CardTitle>
            {!wpEditing ? (
              <Button variant="ghost" size="sm" onClick={() => {
                setWpEditing(true);
                setWpForm(welcomePackage || {});
              }}>
                <Edit className="w-3.5 h-3.5 mr-1" />Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setWpEditing(false)}>Cancel</Button>
                <Button variant="primary" size="sm" isLoading={actionLoading} onClick={handleSaveWp}>
                  <Save className="w-3.5 h-3.5 mr-1" />Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardBody>
            {welcomePackage && (
              <div className="space-y-3">
                {wpEditing ? (
                  <>
                    <Input label="Total Bonus Value ($)" type="number" value={String(wpForm.totalBonusValue || 0)} onChange={(e) => setWpForm({ ...wpForm, totalBonusValue: parseFloat(e.target.value) })} className="bg-background" />
                    <Input label="Rakeback %" type="number" value={String(wpForm.rakebackPercent || 0)} onChange={(e) => setWpForm({ ...wpForm, rakebackPercent: parseFloat(e.target.value) })} className="bg-background" />
                    <Input label="Duration (days)" type="number" value={String(wpForm.durationDays || 0)} onChange={(e) => setWpForm({ ...wpForm, durationDays: parseInt(e.target.value) })} className="bg-background" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Daily Drop Min ($)" type="number" value={String(wpForm.dailyDropMin || 0)} onChange={(e) => setWpForm({ ...wpForm, dailyDropMin: parseFloat(e.target.value) })} className="bg-background" />
                      <Input label="Daily Drop Max ($)" type="number" value={String(wpForm.dailyDropMax || 0)} onChange={(e) => setWpForm({ ...wpForm, dailyDropMax: parseFloat(e.target.value) })} className="bg-background" />
                    </div>
                    <Input label="Cash Vault Amount ($)" type="number" value={String(wpForm.cashVaultAmount || 0)} onChange={(e) => setWpForm({ ...wpForm, cashVaultAmount: parseFloat(e.target.value) })} className="bg-background" />
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Total Bonus Value</span>
                      <span className="text-sm font-mono font-medium text-text">${Number(welcomePackage?.totalBonusValue || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Rakeback Rate</span>
                      <span className="text-sm font-mono text-success">{welcomePackage.rakebackPercent}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Duration</span>
                      <span className="text-sm text-text">{welcomePackage.durationDays} days</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Daily Drop Range</span>
                      <span className="text-sm font-mono text-text">${welcomePackage.dailyDropMin} - ${welcomePackage.dailyDropMax}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Cash Vault (Day 30)</span>
                      <span className="text-sm font-mono text-accent">${Number(welcomePackage?.cashVaultAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-text-secondary">Status</span>
                      <Badge variant={welcomePackage.active ? 'success' : 'default'} size="xs" dot>{welcomePackage.active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Calendar Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-info" />
              Calendar Reward Settings
            </CardTitle>
            {!calEditing ? (
              <Button variant="ghost" size="sm" onClick={() => {
                setCalEditing(true);
                setCalForm(calendarSettings || {});
              }}>
                <Edit className="w-3.5 h-3.5 mr-1" />Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setCalEditing(false)}>Cancel</Button>
                <Button variant="primary" size="sm" isLoading={actionLoading} onClick={handleSaveCal}>
                  <Save className="w-3.5 h-3.5 mr-1" />Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardBody>
            {calendarSettings && (
              <div className="space-y-3">
                {calEditing ? (
                  <>
                    <Input label="Claim Window (hours)" type="number" value={String(calForm.claimWindowHours || 0)} onChange={(e) => setCalForm({ ...calForm, claimWindowHours: parseInt(e.target.value) })} className="bg-background" />
                    <Input label="Claims Per Day" type="number" value={String(calForm.claimsPerDay || 0)} onChange={(e) => setCalForm({ ...calForm, claimsPerDay: parseInt(e.target.value) })} className="bg-background" />
                    <Input label="Base Reward Multiplier" type="number" step="0.1" value={String(calForm.baseRewardMultiplier || 0)} onChange={(e) => setCalForm({ ...calForm, baseRewardMultiplier: parseFloat(e.target.value) })} className="bg-background" />
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={calForm.turboActivationEnabled || false} onChange={(e) => setCalForm({ ...calForm, turboActivationEnabled: e.target.checked })} className="accent-accent" />
                      <span className="text-sm text-text-secondary">Enable Turbo Activation on Claim</span>
                    </label>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Claim Window</span>
                      <span className="text-sm text-text">Every {calendarSettings.claimWindowHours} hours</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Claims Per Day</span>
                      <span className="text-sm text-text">{calendarSettings.claimsPerDay}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Base Reward Multiplier</span>
                      <span className="text-sm font-mono text-text">{calendarSettings.baseRewardMultiplier}x</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-text-secondary">Turbo on Claim</span>
                      <Badge variant={calendarSettings.turboActivationEnabled ? 'success' : 'default'} size="xs">
                        {calendarSettings.turboActivationEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-text-secondary">Status</span>
                      <Badge variant={calendarSettings.active ? 'success' : 'default'} size="xs" dot>{calendarSettings.active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Edit Tier Modal */}
      <Modal open={!!editTier} onOpenChange={() => setEditTier(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>
              Edit{' '}
              <Badge variant={editTier ? vipVariant(editTier.name) : 'default'} size="md" className="ml-1">
                {editTier?.name}
              </Badge>{' '}
              Tier
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <Input label="Wagering Threshold ($)" type="number" value={String(tierForm.wageringThreshold || 0)} onChange={(e) => setTierForm({ ...tierForm, wageringThreshold: parseFloat(e.target.value) })} className="bg-background" />
              <Input label="Rakeback %" type="number" step="0.1" value={String(tierForm.rakebackPercent || 0)} onChange={(e) => setTierForm({ ...tierForm, rakebackPercent: parseFloat(e.target.value) })} className="bg-background" />
              <Input label="Turbo Boost %" type="number" value={String(tierForm.turboBoostPercent || 0)} onChange={(e) => setTierForm({ ...tierForm, turboBoostPercent: parseFloat(e.target.value) })} className="bg-background" />
              <Input label="Turbo Duration (minutes)" type="number" value={String(tierForm.turboDurationMinutes || 0)} onChange={(e) => setTierForm({ ...tierForm, turboDurationMinutes: parseInt(e.target.value) })} className="bg-background" />
              <Input label="Calendar Base Reward ($)" type="number" step="0.01" value={String(tierForm.calendarBaseReward || 0)} onChange={(e) => setTierForm({ ...tierForm, calendarBaseReward: parseFloat(e.target.value) })} className="bg-background" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditTier(null)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} onClick={handleSaveTier}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Grant Bonus Modal */}
      <Modal open={bonusModal} onOpenChange={setBonusModal}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Grant Manual Bonus</ModalTitle></ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  label="Search User"
                  value={userSearch}
                  onChange={(e) => searchUsers(e.target.value)}
                  placeholder="Username or email..."
                  prefixIcon={<Search className="w-4 h-4" />}
                  className="bg-background"
                />
                {userResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background-card border border-border rounded-card shadow-xl">
                    {userResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setBonusForm({ ...bonusForm, userId: u.id, username: u.username });
                          setUserSearch(u.username);
                          setUserResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-background-elevated text-sm"
                      >
                        <span className="text-text font-medium">{u.username}</span>
                        <span className="text-text-muted ml-2">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {bonusForm.userId && (
                <p className="text-xs text-success">
                  Selected: <span className="font-medium">{bonusForm.username}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Amount" type="number" step="0.01" value={String(bonusForm.amount || '')} onChange={(e) => setBonusForm({ ...bonusForm, amount: parseFloat(e.target.value) || 0 })} className="bg-background" />
                <div>
                  <label className="block text-xs text-text-muted mb-1">Currency</label>
                  <select value={bonusForm.currency} onChange={(e) => setBonusForm({ ...bonusForm, currency: e.target.value })} className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text">
                    {['USDT', 'BTC', 'ETH', 'SOL', 'DOGE'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Input label="Reason" value={bonusForm.reason} onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })} placeholder="Reason for bonus..." className="bg-background" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setBonusModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} disabled={!bonusForm.userId || !bonusForm.amount || !bonusForm.reason} onClick={handleGrantBonus}>
              Grant Bonus
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
