'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'security' | 'limits' | 'kyc';

export default function AccountPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');
  const [username, setUsername] = useState(user?.username || '');
  const [kycStatus, setKycStatus] = useState<any>(null);

  useEffect(() => {
    if (tab === 'kyc') {
      api.get('/kyc/status').then(({ data }) => setKycStatus(data.data)).catch(() => {});
    }
  }, [tab]);

  const updateProfile = async () => {
    await api.put('/users/profile', { username });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Account Settings</h1>

      <div className="flex gap-1 mb-4 overflow-x-auto">
        {(['profile', 'security', 'limits', 'kyc'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm capitalize transition-colors whitespace-nowrap',
              tab === t ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}
          >
            {t === 'kyc' ? 'KYC' : t}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Email</label>
            <input type="email" value={user?.email || ''} disabled className="input opacity-60" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">VIP Tier</label>
            <p className="text-sm font-bold text-brand-400">{user?.vipTier || 'BRONZE'}</p>
          </div>
          <button onClick={updateProfile} className="btn-primary">Save Changes</button>
        </div>
      )}

      {tab === 'security' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-gray-500">Add extra security to your account</p>
            </div>
            <span className={cn('text-sm font-bold', user?.twoFactorEnabled ? 'text-accent-green' : 'text-gray-500')}>
              {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <button className="btn-secondary w-full">Change Password</button>
          <button className="btn-secondary w-full">Manage Sessions</button>
        </div>
      )}

      {tab === 'limits' && (
        <div className="card space-y-4">
          <p className="text-sm text-gray-400">Set responsible gambling limits to manage your activity.</p>
          {['Deposit', 'Loss', 'Wager'].map((type) => (
            <div key={type} className="bg-surface-tertiary rounded-lg p-3">
              <p className="text-sm font-medium mb-2">{type} Limits</p>
              <div className="grid grid-cols-3 gap-2">
                {['Daily', 'Weekly', 'Monthly'].map((period) => (
                  <div key={period}>
                    <label className="text-xs text-gray-500">{period}</label>
                    <input type="number" className="input text-sm py-1" placeholder="No limit" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn-primary w-full">Save Limits</button>

          <hr className="border-border" />

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-accent-yellow">Self-Exclusion</h3>
            <div className="flex gap-2">
              {['24h', '1w', '1m'].map((period) => (
                <button key={period} className="btn-secondary text-xs flex-1">{period} cooling off</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'kyc' && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3 p-3 bg-surface-tertiary rounded-lg">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
              kycStatus?.currentLevel === 'FULL' ? 'bg-accent-green/20 text-accent-green' :
              kycStatus?.currentLevel === 'BASIC' ? 'bg-accent-yellow/20 text-accent-yellow' :
              'bg-gray-500/20 text-gray-500'
            )}>
              {kycStatus?.currentLevel?.[0] || '?'}
            </div>
            <div>
              <p className="text-sm font-medium">KYC Level: {kycStatus?.currentLevel || 'Loading...'}</p>
              <p className="text-xs text-gray-500">
                {kycStatus?.requiredForNextLevel?.length
                  ? `Upload ${kycStatus.requiredForNextLevel.join(', ')} to upgrade`
                  : 'Fully verified'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {['PASSPORT', 'DRIVERS_LICENSE', 'PROOF_OF_ADDRESS', 'SELFIE'].map((docType) => {
              const isApproved = kycStatus?.approvedTypes?.includes(docType);
              const isPending = kycStatus?.pendingTypes?.includes(docType);
              return (
                <div key={docType} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                  <span className="text-sm">{docType.replace(/_/g, ' ')}</span>
                  <span className={cn('text-xs font-bold',
                    isApproved ? 'text-accent-green' : isPending ? 'text-accent-yellow' : 'text-gray-500'
                  )}>
                    {isApproved ? 'Approved' : isPending ? 'Pending' : 'Required'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
