'use client';

import Link from 'next/link';
import { Gift, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const referralLink = 'https://cryptobet.com/?ref=YOUR_CODE';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-yellow/10 mb-4">
          <Gift className="w-8 h-8 text-accent-yellow" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Refer &amp; Earn</h1>
        <p className="text-gray-400 text-lg">
          Invite your friends to CryptoBet and earn rewards when they sign up and play.
        </p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">How it works</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-400 text-sm">
          <li>Share your unique referral link with friends</li>
          <li>They sign up and make their first deposit</li>
          <li>You both earn bonus rewards</li>
        </ol>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Your Referral Link</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 bg-surface-tertiary border border-border rounded-lg px-4 py-2.5 text-sm text-gray-300"
          />
          <button
            onClick={handleCopy}
            className="btn-primary flex items-center gap-2 px-4 py-2.5"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Log in to get your personalized referral link.
        </p>
      </div>

      <div className="text-center">
        <Link href="/" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
