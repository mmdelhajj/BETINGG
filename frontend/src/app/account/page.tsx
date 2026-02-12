'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api, userApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  User,
  Shield,
  Settings,
  BadgeCheck,
  Gauge,
  Key,
  Camera,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
  Upload,
  Monitor,
  Smartphone,
  Globe,
  Clock,
  AlertTriangle,
  Trash2,
  Plus,
  X,
  FileText,
  CreditCard,
  Contact,
  ScanFace,
  Info,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
type Tab = 'profile' | 'security' | 'preferences' | 'verification' | 'limits' | 'api-keys';

interface Session {
  id: string;
  device: string;
  browser: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

interface LoginEntry {
  id: string;
  ip: string;
  device: string;
  browser: string;
  time: string;
  success: boolean;
}

interface ApiKey {
  id: string;
  name: string;
  keyMasked: string;
  permissions: string[];
  createdAt: string;
  lastUsed: string | null;
}

interface KycDocument {
  type: string;
  label: string;
  status: 'none' | 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

// ─── Tab Config ─────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'preferences', label: 'Preferences', icon: Settings },
  { key: 'verification', label: 'Verification', icon: BadgeCheck },
  { key: 'limits', label: 'Limits', icon: Gauge },
  { key: 'api-keys', label: 'API Keys', icon: Key },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espanol' },
  { code: 'pt', label: 'Portugues' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Francais' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Turkce' },
  { code: 'ru', label: 'Pyccknn' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'id', label: 'Indonesian' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'sv', label: 'Svenska' },
];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const CURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'DOGE', 'SOL', 'XRP', 'BNB', 'TRX'];

// ─── Shared input class ─────────────────────────────────────────────
const inputClass =
  'w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-[#8D52DA] transition-colors';
const selectClass =
  'w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#8D52DA] transition-colors appearance-none cursor-pointer';

// ═══════════════════════════════════════════════════════════════════
// Main Account Page
// ═══════════════════════════════════════════════════════════════════
export default function AccountPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get('tab') as Tab) || 'profile';
  const [activeTab, setActiveTab] = useState<Tab>(tabParam);

  const switchTab = useCallback(
    (t: Tab) => {
      setActiveTab(t);
      router.replace(`/account?tab=${t}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const t = searchParams.get('tab') as Tab;
    if (t && TABS.some((x) => x.key === t)) setActiveTab(t);
  }, [searchParams]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Please log in to access account settings.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-72px)]">
      {/* ── Sidebar (desktop) / Tabs (mobile) ── */}
      <aside className="hidden lg:flex flex-col w-[200px] shrink-0 bg-[#111214] border-r border-[rgba(255,255,255,0.06)] p-3 gap-0.5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2 mb-1">
          Account
        </h2>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left',
              activeTab === key
                ? 'bg-[#8D52DA]/15 text-[#8D52DA]'
                : 'text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.04)]'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </aside>

      {/* Mobile top tabs */}
      <div className="lg:hidden flex overflow-x-auto gap-1 p-2 bg-[#111214] border-b border-[rgba(255,255,255,0.06)] scrollbar-hide">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === key
                ? 'bg-[#8D52DA]/15 text-[#8D52DA]'
                : 'text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.04)]'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content Area ── */}
      <main className="flex-1 bg-[#0F0F12] p-4 md:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-2xl">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'preferences' && <PreferencesTab />}
          {activeTab === 'verification' && <VerificationTab />}
          {activeTab === 'limits' && <LimitsTab />}
          {activeTab === 'api-keys' && <ApiKeysTab />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Profile Tab
// ═══════════════════════════════════════════════════════════════════
function ProfileTab() {
  const { user } = useAuthStore();
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const referralCode = user?.id ? user.id.slice(0, 8).toUpperCase() : 'N/A';

  const copyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveEmail = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({ email });
      setEditingEmail(false);
      setSuccessMsg('Email updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      /* handled by interceptor */
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({ phone });
      setEditingPhone(false);
      setSuccessMsg('Phone number updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      /* handled by interceptor */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Profile</h1>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <Check size={16} />
          {successMsg}
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[rgba(255,255,255,0.05)] border-2 border-[rgba(255,255,255,0.08)] flex items-center justify-center overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-[#8D52DA]">
                {user?.username?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#8D52DA] flex items-center justify-center hover:bg-[#7a45c0] transition-colors">
            <Camera size={14} className="text-white" />
          </button>
        </div>
        <div>
          <p className="text-white font-semibold">{user?.username}</p>
          <p className="text-xs text-gray-500">VIP {user?.vipTier || 'Bronze'}</p>
        </div>
      </div>

      {/* Username (read-only) */}
      <div>
        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Username</label>
        <input type="text" value={user?.username || ''} disabled className={cn(inputClass, 'opacity-50 cursor-not-allowed')} />
        <p className="text-xs text-gray-600 mt-1">Username cannot be changed.</p>
      </div>

      {/* Email */}
      <div>
        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Email Address</label>
        {editingEmail ? (
          <div className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputClass, 'flex-1')} />
            <button onClick={saveEmail} disabled={saving} className="px-4 py-2 bg-[#8D52DA] text-white text-sm rounded-lg hover:bg-[#7a45c0] transition-colors disabled:opacity-50">
              Save
            </button>
            <button onClick={() => { setEditingEmail(false); setEmail(user?.email || ''); }} className="px-3 py-2 text-gray-400 text-sm hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg">
            <span className="text-sm text-white">{user?.email}</span>
            <button onClick={() => setEditingEmail(true)} className="text-xs text-[#8D52DA] hover:text-[#a670e8] transition-colors font-medium">
              Change
            </button>
          </div>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Phone Number</label>
        {editingPhone ? (
          <div className="flex gap-2">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className={cn(inputClass, 'flex-1')} />
            <button onClick={savePhone} disabled={saving} className="px-4 py-2 bg-[#8D52DA] text-white text-sm rounded-lg hover:bg-[#7a45c0] transition-colors disabled:opacity-50">
              Save
            </button>
            <button onClick={() => { setEditingPhone(false); setPhone(''); }} className="px-3 py-2 text-gray-400 text-sm hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg">
            <span className="text-sm text-gray-500">{phone || 'No phone number added'}</span>
            <button onClick={() => setEditingPhone(true)} className="text-xs text-[#8D52DA] hover:text-[#a670e8] transition-colors font-medium">
              {phone ? 'Edit' : 'Add'}
            </button>
          </div>
        )}
      </div>

      {/* Date Joined */}
      <div>
        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Date Joined</label>
        <div className="flex items-center gap-2 p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg">
          <Clock size={14} className="text-gray-500" />
          <span className="text-sm text-gray-300">Member since January 2024</span>
        </div>
      </div>

      {/* Referral Code */}
      <div>
        <label className="text-xs font-medium text-gray-400 mb-1.5 block">Referral Code</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-between p-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] rounded-lg">
            <span className="text-sm text-white font-mono tracking-wider">{referralCode}</span>
          </div>
          <button
            onClick={copyReferral}
            className={cn(
              'px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
              copied ? 'bg-green-500/15 text-green-400' : 'bg-[#8D52DA] text-white hover:bg-[#7a45c0]'
            )}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Security Tab
// ═══════════════════════════════════════════════════════════════════
function SecurityTab() {
  const { user } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 2FA
  const [twoFaEnabled, setTwoFaEnabled] = useState(user?.twoFactorEnabled ?? false);
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaToken, setTwoFaToken] = useState('');
  const [twoFaMsg, setTwoFaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sessions / login history
  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', device: 'Desktop', browser: 'Chrome 120', ip: '192.168.1.***', lastActive: '2 min ago', isCurrent: true },
    { id: '2', device: 'Mobile', browser: 'Safari 17', ip: '10.0.0.***', lastActive: '3 hours ago', isCurrent: false },
  ]);

  const [loginHistory] = useState<LoginEntry[]>([
    { id: '1', ip: '192.168.1.***', device: 'Desktop', browser: 'Chrome 120', time: '2024-01-15 14:32', success: true },
    { id: '2', ip: '192.168.1.***', device: 'Desktop', browser: 'Chrome 120', time: '2024-01-14 09:11', success: true },
    { id: '3', ip: '10.0.0.***', device: 'Mobile', browser: 'Safari 17', time: '2024-01-13 22:45', success: true },
    { id: '4', ip: '203.0.113.***', device: 'Desktop', browser: 'Firefox 121', time: '2024-01-12 17:05', success: false },
    { id: '5', ip: '192.168.1.***', device: 'Desktop', browser: 'Chrome 120', time: '2024-01-12 08:30', success: true },
  ]);

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setSaving(true);
    try {
      await userApi.changePassword({ currentPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch {
      setPasswordMsg({ type: 'error', text: 'Failed to change password. Check your current password.' });
    } finally {
      setSaving(false);
      setTimeout(() => setPasswordMsg(null), 4000);
    }
  };

  const initiate2fa = async () => {
    try {
      const { data } = await userApi.enable2FA();
      setQrCodeUrl(data.data?.qrCode || '');
      setTwoFaSecret(data.data?.secret || '');
      setShow2faSetup(true);
    } catch {
      setTwoFaMsg({ type: 'error', text: 'Failed to initiate 2FA setup.' });
    }
  };

  const confirm2fa = async () => {
    try {
      await userApi.verify2FA(twoFaToken);
      setTwoFaEnabled(true);
      setShow2faSetup(false);
      setTwoFaToken('');
      setTwoFaMsg({ type: 'success', text: 'Two-factor authentication enabled.' });
      setTimeout(() => setTwoFaMsg(null), 3000);
    } catch {
      setTwoFaMsg({ type: 'error', text: 'Invalid verification code. Try again.' });
    }
  };

  const disable2fa = async () => {
    const token = prompt('Enter your 2FA code to disable:');
    if (!token) return;
    try {
      await userApi.disable2FA(token);
      setTwoFaEnabled(false);
      setTwoFaMsg({ type: 'success', text: 'Two-factor authentication disabled.' });
      setTimeout(() => setTwoFaMsg(null), 3000);
    } catch {
      setTwoFaMsg({ type: 'error', text: 'Invalid code. 2FA not disabled.' });
    }
  };

  const revokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Security</h1>

      {/* Password Change */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Password</h3>
            <p className="text-xs text-gray-500 mt-0.5">Change your account password</p>
          </div>
          {!showPasswordForm && (
            <button onClick={() => setShowPasswordForm(true)} className="text-xs font-medium text-[#8D52DA] hover:text-[#a670e8] transition-colors">
              Change Password
            </button>
          )}
        </div>

        {passwordMsg && (
          <div className={cn('p-3 rounded-lg text-sm flex items-center gap-2', passwordMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400')}>
            {passwordMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {passwordMsg.text}
          </div>
        )}

        {showPasswordForm && (
          <div className="space-y-3">
            <div className="relative">
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Current Password</label>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter current password"
              />
              <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-8 text-gray-500 hover:text-gray-300">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">New Password</label>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter new password"
              />
              <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-8 text-gray-500 hover:text-gray-300">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={changePassword} disabled={saving} className="px-5 py-2 bg-[#8D52DA] text-white text-sm rounded-lg font-medium hover:bg-[#7a45c0] transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Update Password'}
              </button>
              <button
                onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Two-Factor Authentication */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Two-Factor Authentication</h3>
            <p className="text-xs text-gray-500 mt-0.5">Add an extra layer of security using an authenticator app</p>
          </div>
          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', twoFaEnabled ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400')}>
            {twoFaEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {twoFaMsg && (
          <div className={cn('p-3 rounded-lg text-sm flex items-center gap-2', twoFaMsg.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400')}>
            {twoFaMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
            {twoFaMsg.text}
          </div>
        )}

        {!twoFaEnabled && !show2faSetup && (
          <button onClick={initiate2fa} className="px-5 py-2 bg-[#8D52DA] text-white text-sm rounded-lg font-medium hover:bg-[#7a45c0] transition-colors">
            Enable 2FA
          </button>
        )}

        {show2faSetup && (
          <div className="space-y-4">
            <div className="p-4 bg-[rgba(255,255,255,0.03)] rounded-lg space-y-3">
              <p className="text-sm text-gray-300">Scan this QR code with your authenticator app:</p>
              {qrCodeUrl ? (
                <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                </div>
              ) : (
                <div className="w-40 h-40 mx-auto bg-gray-700 rounded-lg animate-pulse" />
              )}
              {twoFaSecret && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                  <code className="block text-sm text-[#8D52DA] font-mono bg-[rgba(141,82,218,0.1)] px-3 py-2 rounded-lg text-center tracking-widest">
                    {twoFaSecret}
                  </code>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block">Verification Code</label>
              <input
                type="text"
                value={twoFaToken}
                onChange={(e) => setTwoFaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={inputClass}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={confirm2fa} disabled={twoFaToken.length !== 6} className="px-5 py-2 bg-[#8D52DA] text-white text-sm rounded-lg font-medium hover:bg-[#7a45c0] transition-colors disabled:opacity-50">
                Verify & Enable
              </button>
              <button onClick={() => { setShow2faSetup(false); setTwoFaToken(''); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {twoFaEnabled && (
          <button onClick={disable2fa} className="px-5 py-2 bg-[rgba(255,73,74,0.1)] text-[#FF494A] text-sm rounded-lg font-medium hover:bg-[rgba(255,73,74,0.2)] transition-colors">
            Disable 2FA
          </button>
        )}
      </section>

      {/* Active Sessions */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Active Sessions</h3>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.03)] rounded-lg">
              <div className="flex items-center gap-3">
                {s.device === 'Desktop' ? <Monitor size={16} className="text-gray-400" /> : <Smartphone size={16} className="text-gray-400" />}
                <div>
                  <p className="text-sm text-white">
                    {s.browser}
                    {s.isCurrent && <span className="ml-2 text-xs text-green-400 font-medium">(This device)</span>}
                  </p>
                  <p className="text-xs text-gray-500">{s.ip} -- {s.lastActive}</p>
                </div>
              </div>
              {!s.isCurrent && (
                <button onClick={() => revokeSession(s.id)} className="text-xs text-[#FF494A] hover:text-red-300 transition-colors font-medium">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Login History */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Login History</h3>
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 text-xs text-gray-500 font-medium">
            <span>IP Address</span>
            <span>Device</span>
            <span>Time</span>
            <span className="text-right">Status</span>
          </div>
          {loginHistory.map((entry) => (
            <div key={entry.id} className="grid grid-cols-[1fr_1fr_1fr_80px] gap-2 px-3 py-2 bg-[rgba(255,255,255,0.02)] rounded-lg text-sm">
              <span className="text-gray-300 font-mono text-xs">{entry.ip}</span>
              <span className="text-gray-400 text-xs">{entry.device}</span>
              <span className="text-gray-400 text-xs">{entry.time}</span>
              <span className={cn('text-right text-xs font-medium', entry.success ? 'text-green-400' : 'text-[#FF494A]')}>
                {entry.success ? 'Success' : 'Failed'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Preferences Tab
// ═══════════════════════════════════════════════════════════════════
function PreferencesTab() {
  const { user } = useAuthStore();
  const [oddsFormat, setOddsFormat] = useState<'decimal' | 'fractional' | 'american'>(
    (user?.preferredOddsFormat as 'decimal' | 'fractional' | 'american') || 'decimal'
  );
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [language, setLanguage] = useState('en');
  const [primaryCurrency, setPrimaryCurrency] = useState(user?.preferredCurrency || 'USDT');
  const [timezone, setTimezone] = useState('UTC');
  const [notifications, setNotifications] = useState({ email: true, push: true, sms: false });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const savePreferences = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({
        preferredOddsFormat: oddsFormat,
        preferredCurrency: primaryCurrency,
      });
      setSuccessMsg('Preferences saved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      /* handled by interceptor */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Preferences</h1>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <Check size={16} />
          {successMsg}
        </div>
      )}

      {/* Odds Format */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Odds Format</h3>
        <div className="flex gap-2">
          {(['decimal', 'fractional', 'american'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setOddsFormat(f)}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-all',
                oddsFormat === f
                  ? 'bg-[#8D52DA] text-white'
                  : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.08)]'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Theme</h3>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-all',
                theme === t
                  ? 'bg-[#8D52DA] text-white'
                  : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.08)]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Language</h3>
        <div className="relative">
          <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={cn(selectClass, 'pl-9')}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-[#111214]">
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Primary Currency */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Currency Display</h3>
        <select value={primaryCurrency} onChange={(e) => setPrimaryCurrency(e.target.value)} className={selectClass}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c} className="bg-[#111214]">
              {c}
            </option>
          ))}
        </select>
      </section>

      {/* Notifications */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Notifications</h3>
        <div className="space-y-2">
          {([
            { key: 'email' as const, label: 'Email Notifications', desc: 'Receive updates and promotions via email' },
            { key: 'push' as const, label: 'Push Notifications', desc: 'Browser push notifications for bet results' },
            { key: 'sms' as const, label: 'SMS Notifications', desc: 'Text messages for important alerts' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.03)] rounded-lg">
              <div>
                <p className="text-sm text-white">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <button
                onClick={() => setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors shrink-0',
                  notifications[key] ? 'bg-[#8D52DA]' : 'bg-[rgba(255,255,255,0.1)]'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                    notifications[key] ? 'left-[22px]' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Timezone */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Time Zone</h3>
        <div className="relative">
          <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cn(selectClass, 'pl-9')}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} className="bg-[#111214]">
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Save */}
      <button onClick={savePreferences} disabled={saving} className="w-full py-3 bg-[#8D52DA] text-white text-sm font-semibold rounded-lg hover:bg-[#7a45c0] transition-colors disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Verification (KYC) Tab
// ═══════════════════════════════════════════════════════════════════
function VerificationTab() {
  const { user } = useAuthStore();
  const [kycLevel, setKycLevel] = useState<'UNVERIFIED' | 'BASIC' | 'FULL'>(
    (user?.kycLevel as 'UNVERIFIED' | 'BASIC' | 'FULL') || 'UNVERIFIED'
  );
  const [documents, setDocuments] = useState<KycDocument[]>([
    { type: 'PASSPORT', label: 'Passport', status: 'none' },
    { type: 'DRIVERS_LICENSE', label: "Driver's License", status: 'none' },
    { type: 'NATIONAL_ID', label: 'National ID', status: 'none' },
    { type: 'PROOF_OF_ADDRESS', label: 'Proof of Address', status: 'none' },
    { type: 'SELFIE', label: 'Selfie with ID', status: 'none' },
  ]);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/kyc/status')
      .then(({ data }) => {
        const d = data.data;
        if (d?.currentLevel) setKycLevel(d.currentLevel);
        setDocuments((prev) =>
          prev.map((doc) => ({
            ...doc,
            status: d?.approvedTypes?.includes(doc.type)
              ? 'approved'
              : d?.pendingTypes?.includes(doc.type)
                ? 'pending'
                : d?.rejectedTypes?.includes(doc.type)
                  ? 'rejected'
                  : 'none',
          }))
        );
      })
      .catch(() => {});
  }, []);

  const handleUpload = (docType: string) => {
    // Trigger file input (in a real app, open a file picker)
    setUploading(docType);
    // Simulated: mark as pending after "upload"
    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (d.type === docType ? { ...d, status: 'pending' as const } : d))
      );
      setUploading(null);
    }, 1500);
  };

  const tiers = [
    {
      level: 'UNVERIFIED',
      label: 'Unverified',
      color: 'text-gray-400',
      bg: 'bg-gray-500/10',
      limits: ['Deposit: 2 BTC/day', 'Withdrawal: 0.5 BTC/day', 'Limited promotions'],
    },
    {
      level: 'BASIC',
      label: 'Basic Verified',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      limits: ['Deposit: 10 BTC/day', 'Withdrawal: 5 BTC/day', 'Access to all promotions'],
    },
    {
      level: 'FULL',
      label: 'Fully Verified',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      limits: ['Unlimited deposits', 'Unlimited withdrawals', 'VIP rewards access', 'Priority support'],
    },
  ];

  const statusIcon = (status: KycDocument['status']) => {
    switch (status) {
      case 'approved':
        return <Check size={16} className="text-green-400" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-400" />;
      case 'rejected':
        return <X size={16} className="text-[#FF494A]" />;
      default:
        return <Upload size={16} className="text-gray-500" />;
    }
  };

  const statusLabel = (status: KycDocument['status']) => {
    switch (status) {
      case 'approved':
        return <span className="text-green-400 font-medium">Approved</span>;
      case 'pending':
        return <span className="text-yellow-400 font-medium">Pending Review</span>;
      case 'rejected':
        return <span className="text-[#FF494A] font-medium">Rejected</span>;
      default:
        return <span className="text-gray-500">Not Submitted</span>;
    }
  };

  const docIcon = (type: string) => {
    switch (type) {
      case 'PASSPORT':
      case 'NATIONAL_ID':
        return <Contact size={18} className="text-gray-400" />;
      case 'DRIVERS_LICENSE':
        return <CreditCard size={18} className="text-gray-400" />;
      case 'PROOF_OF_ADDRESS':
        return <FileText size={18} className="text-gray-400" />;
      case 'SELFIE':
        return <ScanFace size={18} className="text-gray-400" />;
      default:
        return <FileText size={18} className="text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Verification</h1>

      {/* Current Level */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
              kycLevel === 'FULL'
                ? 'bg-green-500/20 text-green-400'
                : kycLevel === 'BASIC'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-gray-500/20 text-gray-400'
            )}
          >
            <BadgeCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Current Level:{' '}
              <span className={kycLevel === 'FULL' ? 'text-green-400' : kycLevel === 'BASIC' ? 'text-yellow-400' : 'text-gray-400'}>
                {kycLevel === 'FULL' ? 'Fully Verified' : kycLevel === 'BASIC' ? 'Basic Verified' : 'Unverified'}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {kycLevel === 'FULL'
                ? 'Your account is fully verified with maximum limits.'
                : 'Complete verification to unlock higher limits and features.'}
            </p>
          </div>
        </div>
      </section>

      {/* Tier Benefits */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white mb-3">Verification Tiers</h3>
        <div className="grid gap-3">
          {tiers.map((tier) => (
            <div
              key={tier.level}
              className={cn(
                'p-4 rounded-xl border transition-all',
                kycLevel === tier.level
                  ? 'border-[#8D52DA]/40 bg-[#8D52DA]/5'
                  : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-sm font-semibold', tier.color)}>{tier.label}</span>
                {kycLevel === tier.level && (
                  <span className="text-xs bg-[#8D52DA]/20 text-[#8D52DA] px-2 py-0.5 rounded-full font-medium">Current</span>
                )}
              </div>
              <ul className="space-y-1">
                {tier.limits.map((limit, i) => (
                  <li key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                    <ChevronRight size={12} className="text-gray-600 shrink-0" />
                    {limit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Document Upload */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Documents</h3>

        {/* Identity Documents */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Identity Document (one required)</p>
          {documents
            .filter((d) => ['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID'].includes(d.type))
            .map((doc) => (
              <div key={doc.type} className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-lg">
                <div className="flex items-center gap-3">
                  {docIcon(doc.type)}
                  <div>
                    <p className="text-sm text-white">{doc.label}</p>
                    <div className="text-xs mt-0.5">{statusLabel(doc.status)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon(doc.status)}
                  {doc.status === 'none' || doc.status === 'rejected' ? (
                    <button
                      onClick={() => handleUpload(doc.type)}
                      disabled={uploading === doc.type}
                      className="px-3 py-1.5 bg-[#8D52DA] text-white text-xs rounded-lg font-medium hover:bg-[#7a45c0] transition-colors disabled:opacity-50"
                    >
                      {uploading === doc.type ? 'Uploading...' : 'Upload'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>

        {/* Proof of Address */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-4">Proof of Address</p>
          {documents
            .filter((d) => d.type === 'PROOF_OF_ADDRESS')
            .map((doc) => (
              <div key={doc.type} className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-lg">
                <div className="flex items-center gap-3">
                  {docIcon(doc.type)}
                  <div>
                    <p className="text-sm text-white">{doc.label}</p>
                    <div className="text-xs mt-0.5">{statusLabel(doc.status)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon(doc.status)}
                  {doc.status === 'none' || doc.status === 'rejected' ? (
                    <button
                      onClick={() => handleUpload(doc.type)}
                      disabled={uploading === doc.type}
                      className="px-3 py-1.5 bg-[#8D52DA] text-white text-xs rounded-lg font-medium hover:bg-[#7a45c0] transition-colors disabled:opacity-50"
                    >
                      {uploading === doc.type ? 'Uploading...' : 'Upload'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>

        {/* Selfie */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-4">Selfie Verification</p>
          {documents
            .filter((d) => d.type === 'SELFIE')
            .map((doc) => (
              <div key={doc.type} className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-lg">
                <div className="flex items-center gap-3">
                  {docIcon(doc.type)}
                  <div>
                    <p className="text-sm text-white">{doc.label}</p>
                    <div className="text-xs mt-0.5">{statusLabel(doc.status)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon(doc.status)}
                  {doc.status === 'none' || doc.status === 'rejected' ? (
                    <button
                      onClick={() => handleUpload(doc.type)}
                      disabled={uploading === doc.type}
                      className="px-3 py-1.5 bg-[#8D52DA] text-white text-xs rounded-lg font-medium hover:bg-[#7a45c0] transition-colors disabled:opacity-50"
                    >
                      {uploading === doc.type ? 'Uploading...' : 'Upload'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Info notice */}
      <div className="flex items-start gap-2 p-3 bg-[rgba(141,82,218,0.06)] border border-[rgba(141,82,218,0.15)] rounded-lg">
        <Info size={16} className="text-[#8D52DA] shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400">
          Documents are reviewed within 24 hours. Accepted formats: JPG, PNG, PDF. Max file size: 10MB. Ensure all text is clearly legible and documents are not expired.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Limits Tab
// ═══════════════════════════════════════════════════════════════════
function LimitsTab() {
  const [depositLimits, setDepositLimits] = useState({ daily: '', weekly: '', monthly: '' });
  const [lossLimits, setLossLimits] = useState({ daily: '', weekly: '', monthly: '' });
  const [wagerLimits, setWagerLimits] = useState({ daily: '', weekly: '', monthly: '' });
  const [sessionLimit, setSessionLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showSelfExclusion, setShowSelfExclusion] = useState(false);
  const [selfExclusionConfirm, setSelfExclusionConfirm] = useState('');
  const [coolingOff, setCoolingOff] = useState<string | null>(null);

  const saveLimits = async () => {
    setSaving(true);
    try {
      await api.put('/users/limits', {
        deposit: depositLimits,
        loss: lossLimits,
        wager: wagerLimits,
        sessionMinutes: sessionLimit ? parseInt(sessionLimit) : null,
      });
      setSuccessMsg('Limits updated successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      /* handled by interceptor */
    } finally {
      setSaving(false);
    }
  };

  const activateCoolingOff = async (period: string) => {
    if (!confirm(`Are you sure you want to activate a ${period} cooling-off period? You will not be able to place bets during this time.`)) return;
    setCoolingOff(period);
    try {
      await api.post('/users/cooling-off', { period });
    } catch {
      /* handled by interceptor */
    }
  };

  const activateSelfExclusion = async () => {
    if (selfExclusionConfirm !== 'EXCLUDE') return;
    try {
      await api.post('/users/self-exclude');
      alert('Self-exclusion activated. Your account has been locked.');
    } catch {
      /* handled by interceptor */
    }
  };

  const LimitGroup = ({
    title,
    limits,
    setLimits,
  }: {
    title: string;
    limits: { daily: string; weekly: string; monthly: string };
    setLimits: React.Dispatch<React.SetStateAction<{ daily: string; weekly: string; monthly: string }>>;
  }) => (
    <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        {(['daily', 'weekly', 'monthly'] as const).map((period) => (
          <div key={period}>
            <label className="text-xs text-gray-500 mb-1 block capitalize">{period}</label>
            <input
              type="number"
              value={limits[period]}
              onChange={(e) => setLimits((prev) => ({ ...prev, [period]: e.target.value }))}
              className={inputClass}
              placeholder="No limit"
              min="0"
            />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Responsible Gambling Limits</h1>
      <p className="text-sm text-gray-400">
        Set limits to help manage your gambling activity. Limits take effect immediately. Reductions are instant; increases require a 24-hour cooling-off period.
      </p>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <Check size={16} />
          {successMsg}
        </div>
      )}

      <LimitGroup title="Deposit Limits" limits={depositLimits} setLimits={setDepositLimits} />
      <LimitGroup title="Loss Limits" limits={lossLimits} setLimits={setLossLimits} />
      <LimitGroup title="Wager Limits" limits={wagerLimits} setLimits={setWagerLimits} />

      {/* Session Time Limit */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-white">Session Time Limit</h3>
        <p className="text-xs text-gray-500">Set a reminder when your session exceeds this duration (minutes).</p>
        <input
          type="number"
          value={sessionLimit}
          onChange={(e) => setSessionLimit(e.target.value)}
          className={cn(inputClass, 'max-w-[200px]')}
          placeholder="e.g. 60"
          min="15"
        />
      </section>

      <button onClick={saveLimits} disabled={saving} className="w-full py-3 bg-[#8D52DA] text-white text-sm font-semibold rounded-lg hover:bg-[#7a45c0] transition-colors disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Limits'}
      </button>

      {/* Divider */}
      <div className="border-t border-[rgba(255,255,255,0.06)]" />

      {/* Cooling-off */}
      <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
          <Clock size={16} />
          Cooling-Off Period
        </h3>
        <p className="text-xs text-gray-400">Temporarily restrict your account from placing bets. Your account remains accessible for withdrawals.</p>
        <div className="flex gap-2">
          {[
            { label: '24 Hours', value: '24h' },
            { label: '7 Days', value: '7d' },
            { label: '30 Days', value: '30d' },
            { label: '90 Days', value: '90d' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => activateCoolingOff(opt.value)}
              disabled={coolingOff !== null}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                coolingOff === opt.value
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-40'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {coolingOff && (
          <p className="text-xs text-yellow-400">
            Cooling-off period of {coolingOff} is active. You cannot place bets during this period.
          </p>
        )}
      </section>

      {/* Self-Exclusion */}
      <section className="p-4 bg-[rgba(255,73,74,0.04)] border border-[rgba(255,73,74,0.15)] rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-[#FF494A] flex items-center gap-2">
          <AlertTriangle size={16} />
          Self-Exclusion
        </h3>
        <p className="text-xs text-gray-400">
          Permanently exclude yourself from the platform. This action is irreversible. Your account will be closed and remaining balance will be available for withdrawal.
        </p>
        {!showSelfExclusion ? (
          <button
            onClick={() => setShowSelfExclusion(true)}
            className="px-5 py-2 bg-[rgba(255,73,74,0.1)] text-[#FF494A] text-sm rounded-lg font-medium hover:bg-[rgba(255,73,74,0.2)] transition-colors"
          >
            Self-Exclude My Account
          </button>
        ) : (
          <div className="space-y-3 p-3 bg-[rgba(255,73,74,0.05)] rounded-lg">
            <div className="flex items-start gap-2 p-2 bg-[rgba(255,73,74,0.1)] rounded-lg">
              <AlertTriangle size={14} className="text-[#FF494A] shrink-0 mt-0.5" />
              <p className="text-xs text-[#FF494A]">
                This action cannot be undone. Type EXCLUDE below to confirm.
              </p>
            </div>
            <input
              type="text"
              value={selfExclusionConfirm}
              onChange={(e) => setSelfExclusionConfirm(e.target.value)}
              className={cn(inputClass, 'border-[rgba(255,73,74,0.3)]')}
              placeholder='Type "EXCLUDE" to confirm'
            />
            <div className="flex gap-2">
              <button
                onClick={activateSelfExclusion}
                disabled={selfExclusionConfirm !== 'EXCLUDE'}
                className="px-5 py-2 bg-[#FF494A] text-white text-sm rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                Confirm Self-Exclusion
              </button>
              <button
                onClick={() => { setShowSelfExclusion(false); setSelfExclusionConfirm(''); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// API Keys Tab
// ═══════════════════════════════════════════════════════════════════
function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Trading Bot',
      keyMasked: 'cb_live_****************************a3f2',
      permissions: ['read', 'trade'],
      createdAt: '2024-01-10',
      lastUsed: '2024-01-15 09:32',
    },
    {
      id: '2',
      name: 'Portfolio Tracker',
      keyMasked: 'cb_live_****************************9b71',
      permissions: ['read'],
      createdAt: '2024-01-05',
      lastUsed: null,
    },
  ]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<Record<string, boolean>>({
    read: true,
    trade: false,
    withdraw: false,
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const AVAILABLE_PERMISSIONS = [
    { key: 'read', label: 'Read', desc: 'View account info, balances, and bet history' },
    { key: 'trade', label: 'Trade', desc: 'Place bets, manage wagers' },
    { key: 'withdraw', label: 'Withdraw', desc: 'Initiate withdrawals (requires 2FA)' },
  ];

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const selectedPermissions = Object.entries(newKeyPermissions)
      .filter(([, v]) => v)
      .map(([k]) => k);

    try {
      // Simulated key creation
      const fakeKey = `cb_live_${Array(32).fill(0).map(() => 'abcdef0123456789'[Math.floor(Math.random() * 16)]).join('')}`;
      setCreatedKey(fakeKey);
      setKeys((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          name: newKeyName,
          keyMasked: `cb_live_****************************${fakeKey.slice(-4)}`,
          permissions: selectedPermissions,
          createdAt: new Date().toISOString().split('T')[0],
          lastUsed: null,
        },
      ]);
    } catch {
      /* handled by interceptor */
    }
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const deleteKey = (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const resetCreate = () => {
    setShowCreateForm(false);
    setNewKeyName('');
    setNewKeyPermissions({ read: true, trade: false, withdraw: false });
    setCreatedKey(null);
    setCopiedKey(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">API Keys</h1>
        {!showCreateForm && (
          <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#8D52DA] text-white text-sm rounded-lg font-medium hover:bg-[#7a45c0] transition-colors">
            <Plus size={16} />
            Create New Key
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400">
        Manage API keys for programmatic access to your account. Keep your keys secure and never share them.
      </p>

      {/* Create Form */}
      {showCreateForm && (
        <section className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-white">Create New API Key</h3>

          {createdKey ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  Copy this key now. It will not be shown again.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-green-400 font-mono bg-[rgba(0,0,0,0.3)] p-3 rounded-lg break-all">
                  {createdKey}
                </code>
                <button
                  onClick={copyKey}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all shrink-0',
                    copiedKey ? 'bg-green-500/15 text-green-400' : 'bg-[#8D52DA] text-white hover:bg-[#7a45c0]'
                  )}
                >
                  {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <button onClick={resetCreate} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Trading Bot, Portfolio App"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Permissions</label>
                <div className="space-y-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <label key={perm.key} className="flex items-center justify-between p-3 bg-[rgba(255,255,255,0.03)] rounded-lg cursor-pointer group">
                      <div>
                        <p className="text-sm text-white">{perm.label}</p>
                        <p className="text-xs text-gray-500">{perm.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={newKeyPermissions[perm.key]}
                        onChange={(e) => setNewKeyPermissions((prev) => ({ ...prev, [perm.key]: e.target.checked }))}
                        className="w-4 h-4 rounded bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.15)] text-[#8D52DA] focus:ring-[#8D52DA] focus:ring-offset-0"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {newKeyPermissions.withdraw && (
                <div className="flex items-start gap-2 p-3 bg-[rgba(255,73,74,0.06)] border border-[rgba(255,73,74,0.15)] rounded-lg">
                  <AlertTriangle size={14} className="text-[#FF494A] shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-400">
                    The withdraw permission is sensitive. Ensure this key is stored securely. 2FA will be required for withdrawal operations.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={createKey}
                  disabled={!newKeyName.trim()}
                  className="px-5 py-2 bg-[#8D52DA] text-white text-sm rounded-lg font-medium hover:bg-[#7a45c0] transition-colors disabled:opacity-50"
                >
                  Create Key
                </button>
                <button onClick={resetCreate} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Existing Keys */}
      <section className="space-y-2">
        {keys.length === 0 ? (
          <div className="p-8 text-center bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl">
            <Key size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No API keys yet.</p>
            <p className="text-xs text-gray-600 mt-1">Create a key to get started with programmatic access.</p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="p-4 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">{key.name}</p>
                  <code className="text-xs text-gray-500 font-mono">{key.keyMasked}</code>
                </div>
                <button
                  onClick={() => deleteKey(key.id)}
                  className="p-2 text-gray-500 hover:text-[#FF494A] hover:bg-[rgba(255,73,74,0.1)] rounded-lg transition-colors"
                  title="Delete key"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  {key.permissions.map((p) => (
                    <span key={p} className="text-xs bg-[rgba(255,255,255,0.06)] text-gray-300 px-2 py-0.5 rounded capitalize">
                      {p}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-gray-600">|</span>
                <span className="text-xs text-gray-500">Created {key.createdAt}</span>
                {key.lastUsed && (
                  <>
                    <span className="text-xs text-gray-600">|</span>
                    <span className="text-xs text-gray-500">Last used {key.lastUsed}</span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
