'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Gift,
  Users,
  DollarSign,
  Share2,
  Copy,
  QrCode,
  Check,
  Mail,
  ChevronRight,
  TrendingUp,
  Award,
  Clock,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const REFERRAL_CODE = 'CB-7X9K2M';
const REFERRAL_LINK = `https://cryptobet.com/?ref=${REFERRAL_CODE}`;

const STATS = [
  { label: 'Total Referrals', value: 24, prefix: '', icon: Users },
  { label: 'Active Referrals', value: 18, prefix: '', icon: TrendingUp },
  { label: 'Total Earned', value: 1_432.5, prefix: '$', icon: DollarSign },
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
  { username: 'de***fi', dateJoined: '2026-01-15', status: 'Qualified', earned: 18.0 },
];

const COMMISSION_TIERS = [
  { tier: 'Starter', referrals: '1 - 10', rate: '25%', color: 'text-accent-green' },
  { tier: 'Silver', referrals: '11 - 50', rate: '30%', color: 'text-brand-300' },
  { tier: 'Gold', referrals: '51 - 100', rate: '35%', color: 'text-accent-yellow' },
  { tier: 'Diamond', referrals: '100+', rate: '40%', color: 'text-accent-purple' },
];

const STATUS_STYLES: Record<Referral['status'], string> = {
  Pending: 'bg-accent-yellow/15 text-accent-yellow',
  Qualified: 'bg-brand-500/15 text-brand-300',
  Rewarded: 'bg-accent-green/15 text-accent-green',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatNumber(n: number, prefix = '') {
  if (prefix === '$') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return n.toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Animated counter                                                   */
/* ------------------------------------------------------------------ */

function AnimatedStat({
  value,
  prefix,
  label,
  icon: Icon,
  index,
}: {
  value: number;
  prefix: string;
  label: string;
  icon: React.ElementType;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 * index }}
      className="bg-surface-secondary rounded-card p-5 border border-border flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-text-dim text-xs md:text-sm">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-brand-500/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-400" />
        </div>
      </div>
      <motion.span
        className="text-2xl font-bold text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.15 * index }}
      >
        {formatNumber(value, prefix)}
      </motion.span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

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
      bg: 'bg-surface-hover hover:bg-[#35363b]',
      icon: copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />,
    },
    {
      label: 'Twitter / X',
      href: `https://twitter.com/intent/tweet?text=${shareText}`,
      bg: 'bg-[#1DA1F2] hover:bg-[#1a8cd8]',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(REFERRAL_LINK)}&text=${shareText}`,
      bg: 'bg-[#0088cc] hover:bg-[#0077b3]',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${shareText}`,
      bg: 'bg-[#25D366] hover:bg-[#1ebe57]',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent('Join CryptoBet')}&body=${shareText}`,
      bg: 'bg-[#6366f1] hover:bg-[#5558e0]',
      icon: <Mail className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen pb-24 px-4">
      {/* ============================================================ */}
      {/* HERO SECTION                                                  */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden -mx-4 px-4">
        {/* gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-800/80 to-surface-deepest" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(141,82,218,0.35),transparent_60%)]" />

        <div className="relative max-w-5xl mx-auto py-12 md:py-16 flex flex-col md:flex-row items-center gap-8">
          {/* text */}
          <motion.div
            className="flex-1 text-center md:text-left"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
              Refer &amp; Earn
            </h1>
            <p className="text-base md:text-lg text-brand-200/80 max-w-md mx-auto md:mx-0">
              Get cash when they play. Share your unique link, earn lifetime commissions on every
              friend you bring to CryptoBet.
            </p>
          </motion.div>

          {/* illustration */}
          <motion.div
            className="flex-shrink-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative w-40 h-40 md:w-48 md:h-48">
              {/* glow */}
              <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-3xl" />
              {/* circle bg */}
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-brand-600/40 to-brand-900/60 border border-brand-500/20 flex items-center justify-center">
                <Gift className="w-16 h-16 md:w-20 md:h-20 text-brand-300" strokeWidth={1.5} />
                <DollarSign className="absolute top-4 right-2 md:top-6 md:right-4 w-8 h-8 md:w-10 md:h-10 text-accent-yellow opacity-80" />
                <DollarSign className="absolute bottom-6 left-2 md:bottom-8 md:left-4 w-6 h-6 md:w-8 md:h-8 text-accent-green opacity-70 rotate-12" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto space-y-12 mt-8">
        {/* ============================================================ */}
        {/* REFERRAL LINK + SHARE + QR                                   */}
        {/* ============================================================ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-surface-secondary rounded-card border border-border p-5 md:p-6"
        >
          <h2 className="text-lg md:text-xl font-semibold text-white mb-5">Your Referral Link</h2>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* left: link + share buttons */}
            <div className="flex-1 space-y-4">
              {/* link box - 44px touch target */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 bg-surface-deepest border border-border rounded-lg px-4 py-3 text-sm text-gray-300 font-mono truncate select-all min-h-[44px] flex items-center">
                  <span className="block sm:hidden">{REFERRAL_LINK.slice(0, 30)}...</span>
                  <span className="hidden sm:block">{REFERRAL_LINK}</span>
                </div>
                <button
                  onClick={() => handleCopy()}
                  className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* share buttons - 44px minimum */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {shareButtons.map((btn) => {
                  const className = `${btn.bg} text-white px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors min-h-[44px]`;
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

              <p className="text-xs md:text-sm text-text-dim">
                Your referral code: <span className="text-brand-300 font-mono">{REFERRAL_CODE}</span>
              </p>
            </div>

            {/* right: QR code mock */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-xl bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900 border border-brand-500/30 flex items-center justify-center">
                <QrCode className="w-14 h-14 md:w-16 md:h-16 text-white/60" />
              </div>
              <span className="text-xs md:text-sm text-text-dim">Scan to refer</span>
            </div>
          </div>
        </motion.section>

        {/* ============================================================ */}
        {/* HOW IT WORKS                                                 */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: 'Share your link',
                desc: 'Send your unique referral link to friends via social media, email, or messaging apps.',
                icon: Share2,
                color: 'from-brand-500/20 to-brand-700/5',
              },
              {
                step: 2,
                title: 'Friend signs up & plays',
                desc: 'Your friend registers using your link and starts playing on CryptoBet.',
                icon: Users,
                color: 'from-accent-green/20 to-accent-green/5',
              },
              {
                step: 3,
                title: 'You earn commission',
                desc: 'Earn a percentage of the house edge on every bet your referral makes. Lifetime earnings!',
                icon: DollarSign,
                color: 'from-accent-yellow/20 to-accent-yellow/5',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className={`bg-gradient-to-b ${item.color} bg-surface-secondary rounded-card border border-border p-5 text-center relative overflow-hidden`}
              >
                {/* step badge */}
                <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-brand-500/25 flex items-center justify-center text-xs font-bold text-brand-300">
                  {item.step}
                </div>
                <div className="w-12 h-12 md:w-14 md:h-14 mx-auto mb-4 rounded-2xl bg-surface-hover/60 flex items-center justify-center">
                  <item.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-base md:text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs md:text-sm text-text-secondary leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* STATS DASHBOARD - 2-col on mobile, 4-col on desktop                                              */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Your Stats</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {STATS.map((s, i) => (
              <AnimatedStat
                key={s.label}
                value={s.value}
                prefix={s.prefix}
                label={s.label}
                icon={s.icon}
                index={i}
              />
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* REFERRAL HISTORY - compact card layout on mobile                                       */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Referral History</h2>
          <div className="bg-surface-secondary rounded-card border border-border overflow-hidden">
            {/* header - hidden on mobile */}
            <div className="hidden md:grid grid-cols-4 gap-4 px-6 py-3 bg-surface-hover/50 text-xs font-semibold uppercase tracking-wider text-text-dim">
              <span>Username</span>
              <span>Date Joined</span>
              <span>Status</span>
              <span className="text-right">Earned</span>
            </div>

            {/* rows - card layout on mobile */}
            {REFERRAL_HISTORY.map((ref, i) => (
              <motion.div
                key={ref.username}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * i }}
                className={`grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 px-5 md:px-6 py-4 items-center text-sm ${
                  i % 2 === 0 ? 'bg-surface-secondary' : 'bg-surface-tertiary/40'
                } border-t border-border-dim`}
              >
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-gray-500 md:hidden">Username</span>
                  <span className="text-white font-medium">{ref.username}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 md:hidden block">Date</span>
                  <span className="text-text-secondary text-sm">{ref.dateJoined}</span>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-xs text-gray-500 md:hidden block mb-1">Status</span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[ref.status]}`}
                  >
                    {ref.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 md:hidden block">Earned</span>
                  <span className="text-white font-semibold text-sm">
                    {ref.earned > 0 ? `$${ref.earned.toFixed(2)}` : '--'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* COMMISSION STRUCTURE - responsive table/cards                                         */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Commission Structure</h2>
          <p className="text-sm md:text-base text-text-secondary mb-6 max-w-2xl">
            Earn a percentage of the house edge generated by every referred player. The more friends
            you bring, the higher your commission tier. Commissions are calculated in real-time and
            credited daily. Your earnings have <strong className="text-white">no lifetime cap</strong>.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {COMMISSION_TIERS.map((tier, i) => (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 * i }}
                className="bg-surface-secondary rounded-card border border-border p-4 md:p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <Award className={`w-5 h-5 ${tier.color}`} />
                  <span className={`text-base md:text-lg font-bold ${tier.color}`}>{tier.tier}</span>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white">{tier.rate}</div>
                <span className="text-xs md:text-sm text-text-dim">
                  {tier.referrals} referrals
                </span>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 bg-surface-tertiary/60 rounded-card border border-border p-4 md:p-5 text-sm md:text-base text-text-secondary space-y-2">
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 text-brand-400 flex-shrink-0" />
              <span>
                Commission is based on the net revenue (house edge) generated by your referrals.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 text-brand-400 flex-shrink-0" />
              <span>
                Referrals are tracked for life -- you earn commission as long as your referral keeps
                playing.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 mt-0.5 text-brand-400 flex-shrink-0" />
              <span>
                Payouts are processed daily and credited directly to your CryptoBet wallet.
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* TERMS LINK                                                   */}
        {/* ============================================================ */}
        <div className="text-center pb-4">
          <Link
            href="/terms"
            className="text-xs md:text-sm text-text-dim hover:text-brand-400 transition-colors underline underline-offset-4 min-h-[44px] inline-flex items-center"
          >
            Referral Programme Terms &amp; Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
