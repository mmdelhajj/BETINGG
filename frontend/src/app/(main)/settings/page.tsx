'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Globe,
  Shield,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  Smartphone,
  Monitor,
  Clock,
  Download,
  Trash2,
  AlertTriangle,
  Key,
  LogOut,
  Mail,
  Zap,
  DollarSign,
  Languages,
  MapPin,
  BarChart,
  Fingerprint,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { put } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingsTab = 'general' | 'security' | 'notifications' | 'privacy';

interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'privacy', label: 'Privacy', icon: Lock },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'tr', name: 'Turkish' },
];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Australia/Sydney',
];

const ODDS_FORMATS = [
  { value: 'decimal', label: 'Decimal', example: '2.50' },
  { value: 'fractional', label: 'Fractional', example: '3/2' },
  { value: 'american', label: 'American', example: '+150' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDT'];

const MOCK_SESSIONS: ActiveSession[] = [
  { id: 's1', device: 'Desktop', browser: 'Chrome 120', location: 'New York, US', ip: '192.168.1.***', lastActive: 'Now', current: true },
  { id: 's2', device: 'Mobile', browser: 'Safari 17', location: 'London, UK', ip: '10.0.0.***', lastActive: '2 hours ago', current: false },
  { id: 's3', device: 'Tablet', browser: 'Firefox 121', location: 'Berlin, DE', ip: '172.16.0.***', lastActive: '1 day ago', current: false },
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
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  iconColor?: string;
}) {
  return (
    <div className="p-5 pb-0">
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconColor ? `bg-[${iconColor}]/10` : 'bg-[#8B5CF6]/10')}>
          <Icon className={cn('w-[18px] h-[18px]', iconColor ? `text-[${iconColor}]` : 'text-[#8B5CF6]')} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[#E6EDF3]">{title}</h2>
          {description && (
            <p className="text-xs text-[#8B949E] mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-[#E6EDF3]">{label}</p>
        {description && (
          <p className="text-xs text-[#8B949E] mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0',
          enabled ? 'bg-[#8B5CF6]' : 'bg-[#30363D]',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm',
            enabled ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const user = useAuthStore((s) => s.user);

  // General settings state
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [oddsFormat, setOddsFormat] = useState('decimal');
  const [currencyDisplay, setCurrencyDisplay] = useState('USD');

  // Security state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled ?? false);

  // Notification state
  const [emailBetResults, setEmailBetResults] = useState(true);
  const [emailPromotions, setEmailPromotions] = useState(true);
  const [emailDeposits, setEmailDeposits] = useState(true);
  const [emailSecurity, setEmailSecurity] = useState(true);
  const [pushBetResults, setPushBetResults] = useState(true);
  const [pushPromotions, setPushPromotions] = useState(false);
  const [pushDeposits, setPushDeposits] = useState(true);
  const [pushLiveUpdates, setPushLiveUpdates] = useState(true);

  // Privacy state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);

  const handleSavePreferences = useCallback(async () => {
    setSavingPrefs(true);
    setPrefsMsg(null);
    try {
      // Backend expects UPPERCASE enum values
      const ODDS_MAP: Record<string, string> = { decimal: 'DECIMAL', fractional: 'FRACTIONAL', american: 'AMERICAN' };
      await put('/users/preferences', {
        theme: 'DARK',
        oddsFormat: ODDS_MAP[oddsFormat] || 'DECIMAL',
        language,
        timezone,
      });
      setPrefsMsg('Preferences saved successfully!');
    } catch {
      setPrefsMsg('Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
      setTimeout(() => setPrefsMsg(null), 3000);
    }
  }, [oddsFormat, language, timezone]);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-[#E6EDF3] flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            Settings
          </h1>
          <p className="text-sm text-[#8B949E] mt-1.5 ml-[46px]">
            Manage your account preferences and security.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tab Sidebar */}
          <motion.nav
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-56 shrink-0"
          >
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible scrollbar-hide pb-1 lg:pb-0 bg-[#161B22] lg:bg-transparent border border-[#21262D] lg:border-0 rounded-lg lg:rounded-none p-1 lg:p-0">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'inline-flex items-center gap-2.5 px-4 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 w-full text-left',
                      isActive
                        ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20'
                        : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1C2128] border border-transparent',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 ml-auto hidden lg:block" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.nav>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 min-w-0"
          >
            {/* ============================================== */}
            {/* GENERAL TAB */}
            {/* ============================================== */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                {/* Language & Region */}
                <SectionCard>
                  <SectionHeader icon={Languages} title="Language & Region" description="Set your preferred language and timezone" />
                  <div className="p-5 space-y-4 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                        Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all appearance-none cursor-pointer"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
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
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </SectionCard>

                {/* Odds Format */}
                <SectionCard>
                  <SectionHeader icon={BarChart} title="Odds Format" description="Choose how odds are displayed across the platform" />
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
                      {ODDS_FORMATS.map((fmt) => (
                        <button
                          key={fmt.value}
                          onClick={() => setOddsFormat(fmt.value)}
                          className={cn(
                            'p-4 rounded-lg border text-center transition-all duration-200',
                            oddsFormat === fmt.value
                              ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/40 ring-1 ring-[#8B5CF6]/20'
                              : 'bg-[#0D1117] border-[#21262D] hover:border-[#30363D]',
                          )}
                        >
                          <p className="font-bold text-lg font-mono text-[#E6EDF3] mb-1">{fmt.example}</p>
                          <p className="text-xs text-[#8B949E]">{fmt.label}</p>
                          {oddsFormat === fmt.value && (
                            <Check className="w-4 h-4 text-[#8B5CF6] mx-auto mt-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </SectionCard>

                {/* Currency Display */}
                <SectionCard>
                  <SectionHeader icon={DollarSign} title="Currency Display" description="Choose how currency values are shown" />
                  <div className="p-5">
                    <div className="flex flex-wrap gap-2 max-w-md">
                      {CURRENCIES.map((cur) => (
                        <button
                          key={cur}
                          onClick={() => setCurrencyDisplay(cur)}
                          className={cn(
                            'px-4 py-2 rounded-md text-sm font-medium border transition-all duration-200',
                            currencyDisplay === cur
                              ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-lg shadow-[#8B5CF6]/20'
                              : 'bg-[#0D1117] text-[#8B949E] border-[#21262D] hover:border-[#30363D] hover:text-[#E6EDF3]',
                          )}
                        >
                          {cur}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[#8B949E] mt-3">
                      This is for display purposes only. Your actual balances remain in their original currencies.
                    </p>
                  </div>
                </SectionCard>

                {/* Save Button */}
                <div className="flex items-center justify-end gap-3">
                  {prefsMsg && (
                    <motion.span
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn('text-sm font-medium', prefsMsg.includes('success') ? 'text-[#10B981]' : 'text-[#EF4444]')}
                    >
                      {prefsMsg}
                    </motion.span>
                  )}
                  <button
                    onClick={handleSavePreferences}
                    disabled={savingPrefs}
                    className="h-10 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-md font-semibold text-sm transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[#8B5CF6]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPrefs ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            )}

            {/* ============================================== */}
            {/* SECURITY TAB */}
            {/* ============================================== */}
            {activeTab === 'security' && (
              <div className="space-y-5">
                {/* Change Password */}
                <SectionCard>
                  <SectionHeader icon={Key} title="Change Password" description="Use a strong password with at least 8 characters" />
                  <div className="p-5 space-y-4 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 pr-10 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                        />
                        <button
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 pr-10 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                        />
                        <button
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#8B949E] mb-1.5 uppercase tracking-wider">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6] transition-all"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-[#EF4444] mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Passwords do not match
                        </p>
                      )}
                    </div>

                    <button
                      disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                      className="h-10 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-md font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#8B5CF6]/20"
                    >
                      Update Password
                    </button>
                  </div>
                </SectionCard>

                {/* Two-Factor Authentication */}
                <SectionCard>
                  <SectionHeader icon={Fingerprint} title="Two-Factor Authentication" description="Protect your account with TOTP-based 2FA" />
                  <div className="p-5">
                    <div className="flex items-center justify-between p-4 bg-[#0D1117] rounded-lg border border-[#21262D]">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          twoFactorEnabled ? 'bg-[#10B981]/10' : 'bg-[#30363D]/50',
                        )}>
                          <Shield className={cn(
                            'w-5 h-5',
                            twoFactorEnabled ? 'text-[#10B981]' : 'text-[#8B949E]',
                          )} />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#E6EDF3]">
                            {twoFactorEnabled ? '2FA is enabled' : '2FA is disabled'}
                          </p>
                          <p className="text-xs text-[#8B949E]">
                            {twoFactorEnabled ? 'Your account is protected with authenticator app' : 'Enable 2FA for enhanced security'}
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
                        {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                      </button>
                    </div>
                  </div>
                </SectionCard>

                {/* Active Sessions */}
                <SectionCard>
                  <SectionHeader icon={Monitor} title="Active Sessions" description="Manage your logged-in devices and browsers" />
                  <div className="p-5 space-y-2">
                    {MOCK_SESSIONS.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          'flex items-center justify-between p-3.5 rounded-lg border transition-all duration-200',
                          session.current
                            ? 'bg-[#8B5CF6]/5 border-[#8B5CF6]/20'
                            : 'bg-[#0D1117] border-[#21262D] hover:border-[#30363D]',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#1C2128] flex items-center justify-center">
                            {session.device === 'Desktop' ? (
                              <Monitor className="w-5 h-5 text-[#8B949E]" />
                            ) : (
                              <Smartphone className="w-5 h-5 text-[#8B949E]" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-[#E6EDF3]">
                                {session.device} - {session.browser}
                              </p>
                              {session.current && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 font-semibold">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#8B949E] mt-0.5">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {session.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {session.lastActive}
                              </span>
                            </div>
                          </div>
                        </div>
                        {!session.current && (
                          <button className="text-xs text-[#EF4444] hover:text-[#DC2626] font-medium transition-colors flex items-center gap-1">
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

            {/* ============================================== */}
            {/* NOTIFICATIONS TAB */}
            {/* ============================================== */}
            {activeTab === 'notifications' && (
              <div className="space-y-5">
                {/* Email Notifications */}
                <SectionCard>
                  <SectionHeader icon={Mail} title="Email Notifications" description="Choose which emails you want to receive" />
                  <div className="p-5">
                    <div className="divide-y divide-[#21262D]">
                      <Toggle
                        enabled={emailBetResults}
                        onChange={setEmailBetResults}
                        label="Bet Results"
                        description="Get notified when your bets are settled"
                      />
                      <Toggle
                        enabled={emailPromotions}
                        onChange={setEmailPromotions}
                        label="Promotions & Offers"
                        description="Special bonuses, free bets, and promotional offers"
                      />
                      <Toggle
                        enabled={emailDeposits}
                        onChange={setEmailDeposits}
                        label="Deposits & Withdrawals"
                        description="Transaction confirmations and status updates"
                      />
                      <Toggle
                        enabled={emailSecurity}
                        onChange={setEmailSecurity}
                        label="Security Alerts"
                        description="Login attempts, password changes, and suspicious activity"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Push Notifications */}
                <SectionCard>
                  <div className="p-5 pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                        <Zap className="w-[18px] h-[18px] text-[#F59E0B]" />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-semibold text-[#E6EDF3]">Push Notifications</h2>
                        <p className="text-xs text-[#8B949E] mt-0.5">Real-time notifications in your browser</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="divide-y divide-[#21262D]">
                      <Toggle
                        enabled={pushBetResults}
                        onChange={setPushBetResults}
                        label="Bet Results"
                        description="Instant notification when bets are settled"
                      />
                      <Toggle
                        enabled={pushPromotions}
                        onChange={setPushPromotions}
                        label="Promotions"
                        description="New promotions and limited-time offers"
                      />
                      <Toggle
                        enabled={pushDeposits}
                        onChange={setPushDeposits}
                        label="Deposit Confirmations"
                        description="When your crypto deposits are confirmed"
                      />
                      <Toggle
                        enabled={pushLiveUpdates}
                        onChange={setPushLiveUpdates}
                        label="Live Match Updates"
                        description="Goals, scores, and key events for matches you bet on"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button className="h-10 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-md font-semibold text-sm transition-all duration-200 shadow-lg shadow-[#8B5CF6]/20 hover:shadow-[#8B5CF6]/30">
                    Save Notification Preferences
                  </button>
                </div>
              </div>
            )}

            {/* ============================================== */}
            {/* PRIVACY TAB */}
            {/* ============================================== */}
            {activeTab === 'privacy' && (
              <div className="space-y-5">
                {/* Data Export */}
                <SectionCard>
                  <SectionHeader icon={Download} title="Data Export" description="Download a copy of all your data" />
                  <div className="p-5">
                    <div className="bg-[#0D1117] border border-[#21262D] rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-md bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4 text-[#8B5CF6]" />
                        </div>
                        <div className="text-sm text-[#8B949E]">
                          <p className="font-medium text-[#E6EDF3] mb-1.5">What is included in your export:</p>
                          <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
                            <li>Account profile and preferences</li>
                            <li>Complete bet history</li>
                            <li>Transaction records (deposits and withdrawals)</li>
                            <li>Casino game history</li>
                            <li>VIP and rewards data</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <button className="h-10 px-5 bg-[#1C2128] text-[#E6EDF3] border border-[#21262D] hover:border-[#8B5CF6]/40 hover:bg-[#21262D] rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Request Data Export
                    </button>
                  </div>
                </SectionCard>

                {/* Account Deletion */}
                <SectionCard className="border-[#EF4444]/15">
                  <div className="p-5 pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#EF4444]/10 flex items-center justify-center shrink-0">
                        <Trash2 className="w-[18px] h-[18px] text-[#EF4444]" />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-semibold text-[#E6EDF3]">Delete Account</h2>
                        <p className="text-xs text-[#8B949E] mt-0.5">Permanently delete your account and all data</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="bg-[#EF4444]/5 border border-[#EF4444]/15 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
                        <div className="text-sm text-[#8B949E]">
                          <p className="font-medium text-[#EF4444] mb-1.5">Warning: This is irreversible</p>
                          <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
                            <li>All account data will be permanently deleted</li>
                            <li>Any remaining balance will be forfeited</li>
                            <li>Active bets will be voided</li>
                            <li>VIP status and rewards will be lost</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="h-10 px-5 bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 hover:bg-[#EF4444]/20 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete My Account
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3"
                      >
                        <p className="text-sm text-[#8B949E]">
                          Type <span className="font-mono text-[#EF4444] bg-[#EF4444]/5 px-1.5 py-0.5 rounded">DELETE MY ACCOUNT</span> to confirm:
                        </p>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="Type DELETE MY ACCOUNT"
                          className="w-full max-w-sm h-10 bg-[#0D1117] border border-[#21262D] rounded-md px-3 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/40 focus:border-[#EF4444] transition-all"
                        />
                        <div className="flex gap-3">
                          <button
                            disabled={deleteConfirmText !== 'DELETE MY ACCOUNT'}
                            className="h-10 px-5 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-md font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Permanently Delete Account
                          </button>
                          <button
                            onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                            className="h-10 px-5 bg-[#1C2128] text-[#8B949E] border border-[#21262D] hover:text-[#E6EDF3] hover:border-[#30363D] rounded-md font-medium text-sm transition-all duration-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </SectionCard>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
