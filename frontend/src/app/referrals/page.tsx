'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  DollarSign,
  Copy,
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
      label: 'Twitter',
      href: `https://twitter.com/intent/tweet?text=${shareText}`,
      bg: 'bg-[#1DA1F2] hover:opacity-90',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(REFERRAL_LINK)}&text=${shareText}`,
      bg: 'bg-[#0088cc] hover:opacity-90',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${shareText}`,
      bg: 'bg-[#25D366] hover:opacity-90',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent('Join CryptoBet')}&body=${shareText}`,
      bg: 'bg-[#6366f1] hover:opacity-90',
      icon: <Mail className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen pb-20 px-4 bg-[#0F0F12]">
      <div className="max-w-4xl mx-auto py-6">
        <h1 className="text-[20px] font-bold text-white mb-6">Referrals</h1>

        {/* Referral Link Card - bg #1A1B1F, p-4, 8px radius */}
        <div className="bg-[#1A1B1F] rounded-lg border border-[rgba(255,255,255,0.06)] p-4 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Your Referral Link</h2>

          {/* Link display - mono font, truncated, bg #222328, p-3 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="flex-1 bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded p-3 text-sm text-gray-300 font-mono truncate select-all">
              {REFERRAL_LINK}
            </div>
            {/* Copy button - h-10, purple, 4px radius */}
            <button
              onClick={() => handleCopy()}
              className="flex items-center justify-center gap-2 bg-[#8D52DA] hover:opacity-90 text-white px-5 h-10 rounded text-sm font-semibold transition-opacity whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* Share buttons - grid of social icons, each 44px */}
          <div className="grid grid-cols-4 gap-3">
            {shareButtons.map((btn) => (
              <a
                key={btn.label}
                href={btn.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btn.bg} text-white h-11 rounded flex flex-col items-center justify-center gap-1 transition-opacity`}
                title={btn.label}
              >
                {btn.icon}
                <span className="text-[10px] font-medium">{btn.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Stats Grid - 2 col mobile, 4 col desktop */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Your Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-[#1A1B1F] rounded-lg p-4 border border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[rgba(224,232,255,0.6)] text-xs">{s.label}</span>
                  <div className="w-8 h-8 rounded bg-[rgba(141,82,218,0.15)] flex items-center justify-center">
                    <s.icon className="w-4 h-4 text-[#8D52DA]" />
                  </div>
                </div>
                {/* Number - 20px bold, white (or green for earnings) */}
                <span className={`text-xl font-bold ${s.label.includes('Earned') ? 'text-[#30E000]' : 'text-white'}`}>
                  {formatNumber(s.value, s.prefix)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Commission Tiers - proper sizing */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Commission Structure</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COMMISSION_TIERS.map((tier) => (
              <div
                key={tier.tier}
                className="bg-[#1A1B1F] rounded-lg border border-[rgba(255,255,255,0.06)] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className={`w-5 h-5 ${tier.color}`} />
                  <span className={`text-sm font-bold ${tier.color}`}>{tier.tier}</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{tier.rate}</div>
                {/* Label - 12px, muted */}
                <span className="text-xs text-[rgba(224,232,255,0.6)]">
                  {tier.referrals} referrals
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Referral History - list of entries */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Referral History</h2>
          <div className="bg-[#1A1B1F] rounded-lg border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <div className="hidden md:grid grid-cols-4 gap-4 px-4 py-3 bg-[#222328] text-xs font-semibold uppercase tracking-wider text-[rgba(224,232,255,0.6)]">
              <span>Username</span>
              <span>Date</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
            </div>

            {REFERRAL_HISTORY.map((ref, i) => (
              <div
                key={ref.username}
                className={`grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 px-4 py-3 items-center text-sm ${
                  i % 2 === 0 ? 'bg-[#1A1B1F]' : 'bg-[rgba(34,35,40,0.4)]'
                } ${i !== 0 ? 'border-t border-[rgba(255,255,255,0.04)]' : ''}`}
              >
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-gray-500 md:hidden block mb-0.5">Username</span>
                  <span className="text-white font-medium">{ref.username}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 md:hidden block mb-0.5">Date</span>
                  <span className="text-[rgba(224,232,255,0.6)] text-sm">{ref.dateJoined}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-gray-500 md:hidden block mb-1">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[ref.status]}`}>
                    {ref.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 md:hidden block mb-0.5">Amount</span>
                  <span className="text-white font-semibold text-sm">
                    {ref.earned > 0 ? `$${ref.earned.toFixed(2)}` : '--'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Terms Notice */}
        <div className="bg-[rgba(34,35,40,0.6)] rounded-lg border border-[rgba(255,255,255,0.06)] p-4 text-sm text-[rgba(224,232,255,0.6)] space-y-2">
          <p>• Commission is based on the net revenue (house edge) generated by your referrals.</p>
          <p>• Referrals are tracked for life -- you earn commission as long as your referral keeps playing.</p>
          <p>• Payouts are processed daily and credited directly to your CryptoBet wallet.</p>
        </div>

        {/* Terms Link */}
        <div className="text-center pt-6">
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
