'use client';

import React, { useState } from 'react';
import {
  User,
  Shield,
  Settings,
  FileCheck,
  Heart,
  Eye,
  EyeOff,
  Camera,
  Smartphone,
  Globe,
  Palette,
  LogOut,
  Monitor,
  AlertTriangle,
  Check,
  X,
  Upload,
  Clock,
  Ban,
  ChevronRight,
  Lock,
  Mail,
  Key,
  Fingerprint,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'profile' | 'security' | 'preferences' | 'kyc' | 'responsible';

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_SESSIONS: Session[] = [
  { id: 's1', device: 'Chrome on macOS', location: 'San Francisco, US', lastActive: 'Now', isCurrent: true },
  { id: 's2', device: 'Firefox on Windows', location: 'London, UK', lastActive: '2 hours ago', isCurrent: false },
  { id: 's3', device: 'Safari on iPhone', location: 'Tokyo, JP', lastActive: '1 day ago', isCurrent: false },
];

// ---------------------------------------------------------------------------
// Section Card Component
// ---------------------------------------------------------------------------

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between p-5 pb-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
          <Icon className="w-[18px] h-[18px] text-[#8B5CF6]" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-[#E6EDF3]">{title}</h3>
          {description && (
            <p className="text-xs text-[#8B949E] mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {badge}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0',
        enabled ? 'bg-[#8B5CF6]' : 'bg-[#30363D]',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Account Settings Page
// ---------------------------------------------------------------------------

export default function AccountSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { user } = useAuthStore();

  // Profile state
  const [nickname, setNickname] = useState(user?.username || 'CryptoUser');
  const [email, setEmail] = useState(user?.email || 'user@example.com');

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);

  // Preferences state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [oddsFormat, setOddsFormat] = useState<'decimal' | 'fractional' | 'american'>('decimal');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');

  // KYC state
  const [kycLevel] = useState(user?.kycStatus || 'none');

  // Responsible gambling state
  const [depositLimit, setDepositLimit] = useState('');
  const [lossLimit, setLossLimit] = useState('');
  const [sessionTimeout, setSessionTimeout] = useState('');

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'preferences', label: 'Preferences', icon: Settings },
    { key: 'kyc', label: 'Verification', icon: FileCheck },
    { key: 'responsible', label: 'Responsible Gambling', icon: Heart },
  ];

  const kycBadge = (status: string) => {
    const styles: Record<string, string> = {
      none: 'bg-[#8B949E]/10 text-[#8B949E] border-[#8B949E]/20',
      pending: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
      verified: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
      rejected: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
    };
    return (
      <span
        className={cn(
          'px-3 py-1 rounded-full text-[11px] font-semibold capitalize border',
          styles[status] || styles.none,
        )}
      >
        {status === 'none' ? 'Not Started' : status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#E6EDF3]">Account Settings</h1>
          <p className="text-sm text-[#8B949E] mt-1">
            Manage your profile, security, and preferences
          </p>
        </div>

        {/* Tab Navigation - Underline style */}
        <div className="border-b border-[#21262D]">
          <nav className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 relative',
                    isActive
                      ? 'text-[#8B5CF6] border-[#8B5CF6]'
                      : 'text-[#8B949E] border-transparent hover:text-[#E6EDF3] hover:border-[#30363D]',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ================================================================ */}
        {/* PROFILE TAB                                                      */}
        {/* ================================================================ */}
        {activeTab === 'profile' && (
          <div className="space-y-5 animate-fade-in">
            {/* Profile Header Card */}
            <SectionCard>
              <div className="p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  {/* Avatar */}
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-[#8B5CF6]/20">
                      {(nickname || 'U').charAt(0).toUpperCase()}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white border-2 border-[#161B22] hover:bg-[#7C3AED] transition-colors shadow-lg">
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* User Info */}
                  <div className="text-center sm:text-left flex-1">
                    <h2 className="text-xl font-bold text-[#E6EDF3]">{nickname}</h2>
                    <p className="text-sm text-[#8B949E] mt-0.5 flex items-center justify-center sm:justify-start gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {email}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20">
                        Member since {new Date().getFullYear()}
                      </span>
                      {user?.kycStatus === 'verified' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Edit Profile Form */}
            <SectionCard>
              <SectionHeader icon={User} title="Personal Information" description="Update your display name and email address" />
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                      Nickname
                    </label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button className="h-10 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-md text-sm transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[#8B5CF6]/30">
                    Save Changes
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECURITY TAB                                                     */}
        {/* ================================================================ */}
        {activeTab === 'security' && (
          <div className="space-y-5 animate-fade-in">
            {/* Change Password */}
            <SectionCard>
              <SectionHeader icon={Key} title="Change Password" description="Use a strong password with at least 8 characters" />
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                    Current Password
                  </label>
                  <div className="relative max-w-md">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 pr-10 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-[#EF4444] mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                    className="h-10 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-md text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#8B5CF6]/20"
                  >
                    Update Password
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Two-Factor Authentication */}
            <SectionCard>
              <SectionHeader
                icon={Fingerprint}
                title="Two-Factor Authentication"
                description={twoFactorEnabled ? 'Your account has an extra layer of security' : 'Add an extra layer of security to your account'}
              />
              <div className="p-5">
                <div className="flex items-center justify-between p-4 bg-[#0D1117] rounded-lg border border-[#21262D]">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        twoFactorEnabled ? 'bg-[#10B981]/10' : 'bg-[#30363D]/50',
                      )}
                    >
                      <Shield
                        className={cn(
                          'w-5 h-5',
                          twoFactorEnabled ? 'text-[#10B981]' : 'text-[#8B949E]',
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E6EDF3]">
                        {twoFactorEnabled ? '2FA is enabled' : '2FA is disabled'}
                      </p>
                      <p className="text-xs text-[#8B949E]">
                        {twoFactorEnabled
                          ? 'Using authenticator app for verification'
                          : 'Protect your account with TOTP-based 2FA'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    className={cn(
                      'h-9 px-4 rounded-md text-sm font-medium transition-all duration-200',
                      twoFactorEnabled
                        ? 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 hover:bg-[#EF4444]/20'
                        : 'bg-[#10B981] text-white hover:bg-[#059669] shadow-lg shadow-[#10B981]/20',
                    )}
                  >
                    {twoFactorEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Active Sessions */}
            <SectionCard>
              <SectionHeader icon={Monitor} title="Active Sessions" description="Manage your logged-in devices" />
              <div className="p-5 space-y-2">
                {MOCK_SESSIONS.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-lg border transition-all duration-200',
                      session.isCurrent
                        ? 'bg-[#8B5CF6]/5 border-[#8B5CF6]/20'
                        : 'bg-[#0D1117] border-[#21262D] hover:border-[#30363D]',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#1C2128] flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-[#8B949E]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#E6EDF3] flex items-center gap-2">
                          {session.device}
                          {session.isCurrent && (
                            <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded text-[10px] font-semibold border border-[#10B981]/20">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#8B949E] mt-0.5">
                          {session.location} -- {session.lastActive}
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button className="flex items-center gap-1 text-xs text-[#EF4444] hover:text-[#EF4444]/80 font-medium transition-colors">
                        <LogOut className="w-3.5 h-3.5" />
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ================================================================ */}
        {/* PREFERENCES TAB                                                  */}
        {/* ================================================================ */}
        {activeTab === 'preferences' && (
          <div className="space-y-5 animate-fade-in">
            {/* Theme */}
            <SectionCard>
              <SectionHeader icon={Palette} title="Appearance" description="Customize how the platform looks" />
              <div className="p-5">
                <label className="block text-xs font-medium text-[#8B949E] mb-2 uppercase tracking-wider">
                  Theme
                </label>
                <div className="flex gap-3 max-w-xs">
                  {(['dark', 'light'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        'flex-1 h-10 rounded-md text-sm font-medium capitalize transition-all duration-200 border',
                        theme === t
                          ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20'
                          : 'bg-[#0D1117] border-[#21262D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#30363D]',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Odds Format */}
            <SectionCard>
              <SectionHeader icon={Settings} title="Odds Format" description="Choose how odds are displayed across the platform" />
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {([
                    { key: 'decimal' as const, label: 'Decimal', example: '2.50' },
                    { key: 'fractional' as const, label: 'Fractional', example: '3/2' },
                    { key: 'american' as const, label: 'American', example: '+150' },
                  ]).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setOddsFormat(f.key)}
                      className={cn(
                        'p-3 rounded-lg border text-center transition-all duration-200',
                        oddsFormat === f.key
                          ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/40 ring-1 ring-[#8B5CF6]/20'
                          : 'bg-[#0D1117] border-[#21262D] hover:border-[#30363D]',
                      )}
                    >
                      <p className="font-bold text-lg font-mono text-[#E6EDF3]">{f.example}</p>
                      <p className="text-[11px] text-[#8B949E] mt-1">{f.label}</p>
                      {oddsFormat === f.key && (
                        <Check className="w-4 h-4 text-[#8B5CF6] mx-auto mt-1.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Language & Timezone */}
            <SectionCard>
              <SectionHeader icon={Globe} title="Language & Region" description="Set your preferred language and timezone" />
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                      Language
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all appearance-none cursor-pointer"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="de">German</option>
                      <option value="fr">French</option>
                      <option value="pt">Portuguese</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all appearance-none cursor-pointer"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Asia/Shanghai">Shanghai (CST)</option>
                    </select>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Save Button */}
            <div className="flex justify-end">
              <button className="h-10 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold rounded-md text-sm transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[#8B5CF6]/30">
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* KYC / VERIFICATION TAB                                           */}
        {/* ================================================================ */}
        {activeTab === 'kyc' && (
          <div className="space-y-5 animate-fade-in">
            {/* Verification Status Overview */}
            <SectionCard>
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#E6EDF3]">Verification Status</h3>
                    <p className="text-xs text-[#8B949E] mt-0.5">Complete verification to unlock higher limits</p>
                  </div>
                </div>
                {kycBadge(kycLevel)}
              </div>
            </SectionCard>

            {/* Verification Levels */}
            <div className="space-y-3">
              {/* Level 1 */}
              <SectionCard>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-[#10B981]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#E6EDF3]">Level 1 - Email Verified</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 font-semibold">
                          Complete
                        </span>
                      </div>
                      <p className="text-xs text-[#8B949E] mt-0.5">Withdraw up to $2,000/day</p>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Level 2 */}
              <SectionCard className={kycLevel === 'verified' ? 'border-[#10B981]/20' : undefined}>
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        kycLevel === 'verified' ? 'bg-[#10B981]/10' : 'bg-[#1C2128]',
                      )}
                    >
                      {kycLevel === 'verified' ? (
                        <Check className="w-4 h-4 text-[#10B981]" />
                      ) : (
                        <span className="text-xs font-bold text-[#8B949E]">2</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#E6EDF3]">Level 2 - Identity Verification</p>
                        {kycLevel === 'verified' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 font-semibold">
                            Complete
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8B949E] mt-0.5">Withdraw up to $50,000/day</p>
                    </div>
                  </div>

                  {kycLevel !== 'verified' && (
                    <div className="space-y-4 pl-11">
                      <div>
                        <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                          Document Type
                        </label>
                        <select className="w-full max-w-xs h-9 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all">
                          <option>Passport</option>
                          <option>ID Card</option>
                          <option>Driver&apos;s License</option>
                        </select>
                      </div>
                      <div className="flex gap-3 max-w-xs">
                        <button className="flex-1 h-24 bg-[#0D1117] border border-dashed border-[#30363D] rounded-lg flex flex-col items-center justify-center gap-1.5 text-[#8B949E] hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all duration-200">
                          <Upload className="w-5 h-5" />
                          <span className="text-[11px] font-medium">Front</span>
                        </button>
                        <button className="flex-1 h-24 bg-[#0D1117] border border-dashed border-[#30363D] rounded-lg flex flex-col items-center justify-center gap-1.5 text-[#8B949E] hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all duration-200">
                          <Upload className="w-5 h-5" />
                          <span className="text-[11px] font-medium">Back</span>
                        </button>
                      </div>
                      <button className="h-9 px-5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium rounded-md text-sm transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20">
                        Submit Documents
                      </button>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Level 3 */}
              <SectionCard>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1C2128] flex items-center justify-center">
                      <span className="text-xs font-bold text-[#8B949E]">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#E6EDF3]">Level 3 - Address Verification</p>
                      <p className="text-xs text-[#8B949E] mt-0.5">Unlimited withdrawals</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* RESPONSIBLE GAMBLING TAB                                          */}
        {/* ================================================================ */}
        {activeTab === 'responsible' && (
          <div className="space-y-5 animate-fade-in">
            {/* Warning Banner */}
            <div className="p-4 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-[18px] h-[18px] text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#E6EDF3]">Play Responsibly</p>
                <p className="text-xs text-[#8B949E] mt-1 leading-relaxed">
                  Set limits to help manage your gambling activity. Limit increases take 24 hours to apply; decreases are instant.
                </p>
              </div>
            </div>

            {/* Deposit Limits */}
            <SectionCard>
              <SectionHeader icon={Lock} title="Deposit Limits" description="Control how much you can deposit" />
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['Daily', 'Weekly', 'Monthly'].map((period) => (
                    <div key={period}>
                      <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                        {period} Limit (USD)
                      </label>
                      <input
                        type="number"
                        placeholder="No limit"
                        className="w-full h-9 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm font-mono text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                      />
                    </div>
                  ))}
                </div>
                <button className="h-9 px-5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium rounded-md text-sm transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20">
                  Set Deposit Limits
                </button>
              </div>
            </SectionCard>

            {/* Loss Limits */}
            <SectionCard>
              <SectionHeader icon={Shield} title="Loss Limits" description="Set maximum loss amounts per period" />
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['Daily', 'Weekly', 'Monthly'].map((period) => (
                    <div key={period}>
                      <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                        {period} Limit (USD)
                      </label>
                      <input
                        type="number"
                        placeholder="No limit"
                        className="w-full h-9 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm font-mono text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                      />
                    </div>
                  ))}
                </div>
                <button className="h-9 px-5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium rounded-md text-sm transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20">
                  Set Loss Limits
                </button>
              </div>
            </SectionCard>

            {/* Session Timeout */}
            <SectionCard>
              <SectionHeader icon={Clock} title="Session Timeout" description="Automatically log out after continuous play" />
              <div className="p-5">
                <div className="flex gap-2 max-w-md">
                  {['1h', '2h', '4h', '8h', 'Off'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setSessionTimeout(val)}
                      className={cn(
                        'flex-1 h-9 rounded-md text-xs font-medium transition-all duration-200 border',
                        sessionTimeout === val
                          ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20'
                          : 'bg-[#0D1117] border-[#21262D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#30363D]',
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </SectionCard>

            {/* Cooling Off & Self-Exclusion */}
            <SectionCard className="border-[#EF4444]/10">
              <SectionHeader icon={Ban} title="Cooling Off & Self-Exclusion" description="Take a break from betting" />
              <div className="p-5 space-y-4">
                {/* Cooling Off */}
                <div>
                  <p className="text-xs text-[#8B949E] mb-3">
                    Take a temporary break. You can still withdraw during cooling-off periods.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['24 Hours', '1 Week', '1 Month'].map((period) => (
                      <button
                        key={period}
                        className="h-9 px-4 bg-[#F59E0B]/5 border border-[#F59E0B]/20 text-[#F59E0B] rounded-md text-xs font-medium hover:bg-[#F59E0B]/10 transition-all duration-200"
                      >
                        Cool Off - {period}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#21262D]" />

                {/* Self-Exclusion */}
                <div>
                  <div className="p-3 bg-[#EF4444]/5 border border-[#EF4444]/15 rounded-lg mb-3">
                    <p className="text-xs text-[#EF4444] font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Self-exclusion is permanent for the selected duration. Your account will be locked.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['6 Months', '1 Year', 'Permanent'].map((period) => (
                      <button
                        key={period}
                        className="h-9 px-4 bg-[#EF4444]/5 border border-[#EF4444]/20 text-[#EF4444] rounded-md text-xs font-medium hover:bg-[#EF4444]/10 transition-all duration-200"
                      >
                        Self-Exclude - {period}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
