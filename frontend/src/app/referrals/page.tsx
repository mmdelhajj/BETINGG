'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  DollarSign,
  Copy,
  QrCode,
  Check,
  Mail,
  TrendingUp,
  Award,
  Clock,
} from 'lucide-react';

// Mock data
const REFERRAL_CODE = 'CB-7X9K2M';
const REFERRAL_LINK = `https://cryptobet.com/?ref=${REFERRAL_CODE}`;

const STATS = [
  { label: 'Total Referrals', value: 24, prefix: '', icon: Users },
  { label: 'Active Referrals', value: 18, prefix: '', icon: TrendingUp },
  { label: 'Total Earned', value: 1432.5, prefix: '$', icon: DollarSign },
  { label: 'Pending', value: 215.0, prefix: '$', icon: Clock },
];

interface Referral {
  username: string;
  dateJoined: string;
  status: 'Pending' | 'Qualified' | 'Rewarded';
  earned: number;
}

const REFERRAL_HISTORY: Referral[] = [
  { username: 'j***n84', dateJoined: '2026-02-10', status: 'Rewarded', earned: 85.2 },
  { username: 'cr***to', dateJoined: '2026-02-08', status: 'Rewarded', earned: 124.0 },
  { username: 'b***er', dateJoined: '2026-02-05', status: 'Qualified', earned: 42.5 },
  { username: 'x***99', dateJoined: '2026-01-28', status: 'Pending', earned: 0 },
  { username: 'lu***ky', dateJoined: '2026-01-22', status: 'Rewarded', earned: 310.8 },
];

const COMMISSION_TIERS = [
  { tier: 'Starter', referrals: '1 - 10', rate: '25%', color: 'text-[#30E000]' },
  { tier: 'Silver', referrals: '11 - 50', rate: '30%', color: 'text-[#8D52DA]' },
  { tier: 'Gold', referrals: '51 - 100', rate: '35%', color: 'text-[#FFD600]' },
  { tier: 'Diamond', referrals: '100+', rate: '40%', color: 'text-[#3B82F6]' },
];

const STATUS_STYLES: Record<Referral['status'], string> = {
  Pending: 'bg-[rgba(255,214,0,0.12)] text-[#FFD600]',
  Qualified: 'bg-[rgba(141,82,218,0.15)] text-[#8D52DA]',
  Rewarded: 'bg-[rgba(48,224,0,0.1)] text-[#30E000]',
};

function formatNumber(n: number, prefix = '') {
  if (prefix === '$') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return n.toLocaleString();
}

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text?: string) => {
    navigator.clipboard.writeText(text ?? REFERRAL_LINK).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareText = encodeURIComponent(
    `Join me on CryptoBet! Sign up with my referral link and get a bonus: ${REFERRAL_LINK}`
  );

  const shareButtons = [
    {
      label: 'Copy Link',
      onClick: () => handleCopy(),
      bg: 'bg-[#222328] hover:bg-[#2A2B30]',
      icon: copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />,
    },
    {
      label: 'Twitter',
      href: `https://twitter.com/intent/tweet?text=${shareText}`,
      bg: 'bg-[#1DA1F2] hover:opacity-90',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(REFERRAL_LINK)}&text=${shareText}`,
      bg: 'bg-[#0088cc] hover:opacity-90',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent('Join CryptoBet')}&body=${shareText}`,
      bg: 'bg-[#6366f1] hover:opacity-90',
      icon: <Mail className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen pb-24 px-4 bg-[#0F0F12]">
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Refer & Earn</h1>
          <p className="text-base text-[rgba(224,232,255,0.6)] max-w-md mx-auto">
            Get cash when they play. Share your unique link and earn lifetime commissions.
          </p>
        </div>

        {/* Referral Link + Share */}
        <div className="bg-[#1A1B1F] rounded-lg border border-[rgba(255,255,255,0.06)] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-5">Your Referral Link</h2>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-4 py-3 text-sm text-gray-300 font-mono truncate select-all">
                  <span className="block sm:hidden">{REFERRAL_LINK.slice(0, 30)}...</span>
                  <span className="hidden sm:block">{REFERRAL_LINK}</span>
                </div>
                <button
                  onClick={() => handleCopy()}
                  className="flex items-center justify-center gap-2 bg-[#8D52DA] hover:opacity-90 text-white px-5 py-3 rounded text-sm font-semibold transition-opacity whitespace-nowrap"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {shareButtons.map((btn) => {
                  const className = `${btn.bg} text-white px-4 py-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-opacity`;
                  if (btn.href) {
                    return (
                      <a
                        key={btn.label}
                        href={btn.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={className}
                      >
                        {btn.icon}
                        <span className="hidden sm:inline">{btn.label}</span>
                      </a>
                    );
                  }
                  return (
                    <button key={btn.label} onClick={btn.onClick} className={className}>
                      {btn.icon}
                      {btn.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-[rgba(224,232,255,0.6)]">
                Your referral code: <span className="text-[#8D52DA] font-mono">{REFERRAL_CODE}</span>
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-lg bg-gradient-to-br from-[#8D52DA] to-[#5A3A8F] border border-[rgba(141,82,218,0.3)] flex items-center justify-center">
                <QrCode className="w-14 h-14 md:w-16 md:h-16 text-white/60" />
              </div>
              <span className="text-xs text-[rgba(224,232,255,0.6)]">Scan to refer</span>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Your Stats</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-[#1A1B1F] rounded-lg p-5 border border-[rgba(255,255,255,0.06)] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[rgba(224,232,255,0.6)] text-xs">{s.label}</span>
                  <div className="w-9 h-9 rounded-lg bg-[rgba(141,82,218,0.15)] flex items-center justify-center">
                    <s.icon className="w-4 h-4 text-[#8D52DA]" />
                  </div>
                </div>
                <span className="text-2xl font-bold text-white">
                  {formatNumber(s.value, s.prefix)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Referral History */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Referral History</h2>
          <div className="bg-[#1A1B1F] rounded-lg border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <div className="hidden md:grid grid-cols-4 gap-4 px-6 py-3 bg-[#222328] text-xs font-semibold uppercase tracking-wider text-[rgba(224,232,255,0.6)]">
              <span>Username</span>
              <span>Date Joined</span>
              <span>Status</span>
              <span className="text-right">Earned</span>
            </div>

            {REFERRAL_HISTORY.map((ref, i) => (
              <div
                key={ref.username}
                className={`grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 px-5 md:px-6 py-4 items-center text-sm ${
                  i % 2 === 0 ? 'bg-[#1A1B1F]' : 'bg-[rgba(34,35,40,0.4)]'
                } border-t border-[rgba(255,255,255,0.04)]`}
              >
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-gray-500 md:hidden">Username</span>
                  <span className="text-white font-medium">{ref.username}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 md:hidden block">Date</span>
                  <span className="text-[rgba(224,232,255,0.6)] text-sm">{ref.dateJoined}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-gray-500 md:hidden block mb-1">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[ref.status]}`}>
                    {ref.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 md:hidden block">Earned</span>
                  <span className="text-white font-semibold text-sm">
                    {ref.earned > 0 ? `$${ref.earned.toFixed(2)}` : '--'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commission Structure */}
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Commission Structure</h2>
          <p className="text-sm text-[rgba(224,232,255,0.6)] mb-6 max-w-2xl">
            Earn a percentage of the house edge generated by every referred player. The more friends
            you bring, the higher your commission tier.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {COMMISSION_TIERS.map((tier) => (
              <div
                key={tier.tier}
                className="bg-[#1A1B1F] rounded-lg border border-[rgba(255,255,255,0.06)] p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <Award className={`w-5 h-5 ${tier.color}`} />
                  <span className={`text-base font-bold ${tier.color}`}>{tier.tier}</span>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white">{tier.rate}</div>
                <span className="text-xs text-[rgba(224,232,255,0.6)]">
                  {tier.referrals} referrals
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-[rgba(34,35,40,0.6)] rounded-lg border border-[rgba(255,255,255,0.06)] p-5 text-sm text-[rgba(224,232,255,0.6)] space-y-2">
            <p>• Commission is based on the net revenue (house edge) generated by your referrals.</p>
            <p>• Referrals are tracked for life -- you earn commission as long as your referral keeps playing.</p>
            <p>• Payouts are processed daily and credited directly to your CryptoBet wallet.</p>
          </div>
        </div>

        {/* Terms Link */}
        <div className="text-center pt-8">
          <Link
            href="/terms"
            className="text-xs text-[rgba(224,232,255,0.6)] hover:text-[#8D52DA] transition-colors underline underline-offset-4"
          >
            Referral Programme Terms & Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
