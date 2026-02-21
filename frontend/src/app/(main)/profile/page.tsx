'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Shield,
  Key,
  Globe,
  Clock,
  ChevronRight,
  Camera,
  Save,
  Smartphone,
  Monitor,
  Trash2,
  LogOut,
  Trophy,
  TrendingUp,
  BarChart3,
  Target,
  Percent,
  Star,
  AlertTriangle,
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  Eye,
  EyeOff,
  Settings,
  FileCheck,
  ShieldCheck,
  XCircle,
  Activity,
} from 'lucide-react';
import { cn, formatCurrency, copyToClipboard, generateAvatarUrl } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toastSuccess, toastError } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileTab = 'general' | 'security' | 'stats';

interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

interface BettingStats {
  totalBets: number;
  totalWagered: number;
  totalWon: number;
  totalProfit: number;
  winRate: number;
  avgBetSize: number;
  biggestWin: number;
  longestStreak: number;
  favoriteSport: string;
  favoriteGame: string;
  activeDays: number;
  memberSince: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_SESSIONS: Session[] = [
  { id: 's-1', device: 'Desktop', browser: 'Chrome 121', os: 'Windows 11', ip: '192.168.1.***', location: 'New York, US', lastActive: new Date().toISOString(), isCurrent: true },
  { id: 's-2', device: 'Mobile', browser: 'Safari 17', os: 'iOS 17.3', ip: '10.0.0.***', location: 'New York, US', lastActive: new Date(Date.now() - 3600000).toISOString(), isCurrent: false },
  { id: 's-3', device: 'Tablet', browser: 'Firefox 122', os: 'Android 14', ip: '172.16.0.***', location: 'London, UK', lastActive: new Date(Date.now() - 86400000).toISOString(), isCurrent: false },
];

const MOCK_STATS: BettingStats = {
  totalBets: 1247,
  totalWagered: 45892.50,
  totalWon: 48234.75,
  totalProfit: 2342.25,
  winRate: 52.8,
  avgBetSize: 36.80,
  biggestWin: 4521.00,
  longestStreak: 9,
  favoriteSport: 'Football',
  favoriteGame: 'Crash',
  activeDays: 87,
  memberSince: '2024-06-15',
};

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// KYC Status Badge
// ---------------------------------------------------------------------------

function KycStatusBadge({ level }: { level: number }) {
  const configs = [
    { label: 'Unverified', color: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20', icon: XCircle },
    { label: 'Basic', color: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20', icon: FileCheck },
    { label: 'Intermediate', color: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20', icon: ShieldCheck },
    { label: 'Advanced', color: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20', icon: CheckCircle2 },
  ];
  const config = configs[Math.min(level, 3)];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border', config.color)}>
      <Icon className="w-3 h-3" />
      KYC: {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------

function GeneralTab() {
  const [username, setUsername] = useState('CryptoWhale');
  const [email, setEmail] = useState('whale@cryptobet.io');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('America/New_York');
  const [oddsFormat, setOddsFormat] = useState('decimal');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsSaving(false);
    toastSuccess('Profile updated successfully!');
  };

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'de', label: 'German' },
    { value: 'fr', label: 'French' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ru', label: 'Russian' },
  ];

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (UTC-5)' },
    { value: 'America/Chicago', label: 'Central Time (UTC-6)' },
    { value: 'America/Denver', label: 'Mountain Time (UTC-7)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8)' },
    { value: 'Europe/London', label: 'London (UTC+0)' },
    { value: 'Europe/Berlin', label: 'Berlin (UTC+1)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
    { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  ];

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Profile Info */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-[#8B5CF6]" />
          Profile Information
        </h3>
        <div className="space-y-4">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            prefixIcon={<User className="w-4 h-4" />}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            prefixIcon={<Mail className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#8B5CF6]" />
          Preferences
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8B949E] mb-1.5">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-lg px-3 text-sm text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6]/60 transition-all duration-200"
            >
              {languages.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8B949E] mb-1.5">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 bg-[#0D1117] border border-[#21262D] rounded-lg px-3 text-sm text-[#E6EDF3] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6]/60 transition-all duration-200"
            >
              {timezones.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8B949E] mb-2">Odds Format</label>
            <div className="flex gap-2">
              {(['decimal', 'fractional', 'american'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setOddsFormat(fmt)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200',
                    oddsFormat === fmt
                      ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                      : 'bg-[#0D1117] border border-[#21262D] text-[#8B949E] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3]'
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Button variant="primary" size="lg" onClick={handleSave} isLoading={isSaving}>
        <Save className="w-4 h-4" />
        Save Changes
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Security Tab
// ---------------------------------------------------------------------------

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showTwoFASetup, setShowTwoFASetup] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [copied, setCopied] = useState(false);
  const [sessions] = useState<Session[]>(MOCK_SESSIONS);

  const mockSecret = 'JBSWY3DPEHPK3PXP';

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toastError('Passwords do not match');
      return;
    }
    toastSuccess('Password changed successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleEnable2FA = () => {
    if (twoFACode.length === 6) {
      setTwoFAEnabled(true);
      setShowTwoFASetup(false);
      setTwoFACode('');
      toastSuccess('Two-factor authentication enabled!');
    } else {
      toastError('Please enter a valid 6-digit code');
    }
  };

  const handleCopySecret = async () => {
    const success = await copyToClipboard(mockSecret);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    toastSuccess('Session revoked successfully');
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Change Password */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-[#8B5CF6]" />
          Change Password
        </h3>
        <div className="space-y-4">
          <Input
            label="Current Password"
            type={showPasswords ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            suffixIcon={
              <button onClick={() => setShowPasswords(!showPasswords)} className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Input
            label="New Password"
            type={showPasswords ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="Confirm New Password"
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
          />
          <Button variant="primary" onClick={handleChangePassword} disabled={!currentPassword || !newPassword || !confirmPassword}>
            Update Password
          </Button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#E6EDF3] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#8B5CF6]" />
            Two-Factor Authentication
          </h3>
          <span className={cn(
            'inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border',
            twoFAEnabled
              ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
              : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
          )}>
            {twoFAEnabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {twoFAEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {twoFAEnabled ? (
          <div>
            <p className="text-sm text-[#8B949E] mb-4">
              Two-factor authentication is enabled on your account. You will need your authenticator app to log in.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => { setTwoFAEnabled(false); toastSuccess('2FA disabled'); }}
            >
              Disable 2FA
            </Button>
          </div>
        ) : showTwoFASetup ? (
          <div className="space-y-4">
            <p className="text-sm text-[#8B949E]">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex flex-col items-center gap-4 p-6 bg-[#0D1117] border border-[#21262D] rounded-xl">
              <div className="w-40 h-40 bg-white rounded-lg flex items-center justify-center">
                <QrCode className="w-28 h-28 text-[#0D1117]" />
              </div>
              <div className="text-center">
                <p className="text-xs text-[#6E7681] mb-2">Or enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-[#A78BFA] bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 px-3 py-1 rounded-lg">{mockSecret}</code>
                  <button onClick={handleCopySecret} className="p-1.5 rounded-lg hover:bg-[#1C2128] transition-colors">
                    {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4 text-[#8B949E]" />}
                  </button>
                </div>
              </div>
            </div>
            <Input
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              hint="Enter the code from your authenticator app"
            />
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleEnable2FA} disabled={twoFACode.length !== 6}>
                Verify & Enable
              </Button>
              <Button variant="secondary" onClick={() => setShowTwoFASetup(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[#8B949E] mb-4">
              Add an extra layer of security to your account. Once enabled, you'll need to enter a code from your authenticator app when logging in.
            </p>
            <Button variant="primary" onClick={() => setShowTwoFASetup(true)}>
              <Shield className="w-4 h-4" />
              Enable 2FA
            </Button>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-[#8B5CF6]" />
          Active Sessions
        </h3>
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              variants={staggerItem}
              className="flex items-center justify-between p-3 bg-[#0D1117] border border-[#21262D] rounded-xl hover:border-[#21262D] transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  session.device === 'Desktop' ? 'bg-blue-500/10' : session.device === 'Mobile' ? 'bg-emerald-500/10' : 'bg-purple-500/10',
                )}>
                  {session.device === 'Desktop' ? (
                    <Monitor className="w-5 h-5 text-blue-400" />
                  ) : (
                    <Smartphone className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[#E6EDF3] font-medium">
                      {session.browser} on {session.os}
                    </p>
                    {session.isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#6E7681]">
                    {session.ip} - {session.location} - {new Date(session.lastActive).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  className="p-2 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stats Tab
// ---------------------------------------------------------------------------

function StatsTab() {
  const stats = MOCK_STATS;

  const statCards = [
    { label: 'Total Bets', value: (stats.totalBets ?? 0).toLocaleString(), icon: Target, color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10' },
    { label: 'Total Wagered', value: `$${(stats.totalWagered ?? 0).toLocaleString()}`, icon: TrendingUp, color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10' },
    { label: 'Total Won', value: `$${(stats.totalWon ?? 0).toLocaleString()}`, icon: Trophy, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
    { label: 'Net Profit', value: `$${(stats.totalProfit ?? 0).toLocaleString()}`, icon: BarChart3, color: (stats.totalProfit ?? 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]', bg: (stats.totalProfit ?? 0) >= 0 ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10' },
    { label: 'Win Rate', value: `${stats.winRate ?? 0}%`, icon: Percent, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
    { label: 'Avg Bet Size', value: `$${(stats.avgBetSize ?? 0).toFixed(2)}`, icon: BarChart3, color: 'text-[#8B949E]', bg: 'bg-[#8B949E]/10' },
    { label: 'Biggest Win', value: `$${(stats.biggestWin ?? 0).toLocaleString()}`, icon: Star, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
    { label: 'Longest Streak', value: `${stats.longestStreak} wins`, icon: TrendingUp, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
  ];

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Stats Grid */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <motion.div
            key={stat.label}
            variants={staggerItem}
            className="bg-[#161B22] border border-[#21262D] rounded-xl p-4 hover:border-[#8B5CF6]/20 transition-all duration-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
            </div>
            <p className="text-lg font-bold font-mono text-[#E6EDF3]">{stat.value}</p>
            <p className="text-xs text-[#6E7681] mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Favorites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#8B5CF6]" />
            Favorite Sport
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#8B5CF6]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#E6EDF3]">{stats.favoriteSport}</p>
              <p className="text-xs text-[#6E7681]">Most bets placed</p>
            </div>
          </div>
        </div>
        <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#10B981]" />
            Favorite Game
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center">
              <Star className="w-6 h-6 text-[#10B981]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#E6EDF3]">{stats.favoriteGame}</p>
              <p className="text-xs text-[#6E7681]">Most rounds played</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[#E6EDF3] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#8B5CF6]" />
          Activity Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4">
            <p className="text-2xl font-bold font-mono text-[#E6EDF3]">{stats.activeDays}</p>
            <p className="text-xs text-[#6E7681] mt-1">Active Days</p>
          </div>
          <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4">
            <p className="text-2xl font-bold font-mono text-[#E6EDF3]">
              {Math.floor((Date.now() - new Date(stats.memberSince).getTime()) / 86400000)}
            </p>
            <p className="text-xs text-[#6E7681] mt-1">Days Since Joined</p>
          </div>
          <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4">
            <p className="text-2xl font-bold font-mono text-[#E6EDF3]">
              {new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs text-[#6E7681] mt-1">Member Since</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Profile Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('general');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const tabs: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'stats', label: 'Statistics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D1117]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-lg" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-[#161B22] border border-[#21262D] rounded-xl p-6 mb-6"
        >
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B5CF6] via-[#A78BFA] to-[#10B981]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 pt-2">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#10B981] p-[2px]">
                <div className="w-full h-full rounded-full bg-[#161B22] flex items-center justify-center overflow-hidden">
                  <img
                    src={generateAvatarUrl('CryptoWhale', 'identicon', 80)}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <button className="absolute bottom-0 right-0 w-7 h-7 bg-[#8B5CF6] rounded-full flex items-center justify-center border-2 border-[#161B22] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* User Info */}
            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <h1 className="text-xl font-bold text-[#E6EDF3]">CryptoWhale</h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                  <Star className="w-3 h-3" />
                  Gold
                </span>
                <KycStatusBadge level={2} />
              </div>
              <p className="text-sm text-[#8B949E] mt-1">whale@cryptobet.io</p>
              <p className="text-xs text-[#6E7681] mt-0.5">Joined June 2024</p>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Link href="/profile/kyc">
                <Button variant="outline" size="sm">
                  <Shield className="w-4 h-4" />
                  KYC
                </Button>
              </Link>
              <Link href="/vip">
                <Button variant="outline" size="sm">
                  <Star className="w-4 h-4" />
                  VIP
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex gap-1 mb-6 bg-[#0D1117] border border-[#21262D] rounded-xl p-1"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex-1 justify-center',
                activeTab === tab.id
                  ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20'
                  : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#161B22]'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'general' && <GeneralTab key="general" />}
          {activeTab === 'security' && <SecurityTab key="security" />}
          {activeTab === 'stats' && <StatsTab key="stats" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
