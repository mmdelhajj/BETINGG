'use client';

import React from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Footer Links
// ---------------------------------------------------------------------------

const FOOTER_SECTIONS = [
  {
    title: 'CryptoBet',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Affiliates', href: '/affiliates' },
    ],
  },
  {
    title: 'Products',
    links: [
      { label: 'Sportsbook', href: '/sports' },
      { label: 'Live Betting', href: '/sports/live' },
      { label: 'Casino', href: '/casino' },
      { label: 'Promotions', href: '/promotions' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Academy', href: '/academy' },
      { label: 'Contact Us', href: '/help/contact' },
      { label: 'API Docs', href: '/developers' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Responsible Gambling', href: '/responsible-gambling' },
      { label: 'AML Policy', href: '/aml' },
    ],
  },
];

const CRYPTO_ICONS = ['BTC', 'ETH', 'USDT', 'SOL', 'LTC', 'DOGE', 'BNB', 'XRP'];

// ---------------------------------------------------------------------------
// Footer Component
// ---------------------------------------------------------------------------

export default function Footer() {
  return (
    <footer className="bg-background-card border-t border-border mt-auto">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-text mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-muted hover:text-text transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Crypto Payment Icons */}
        <div className="mt-10 pt-8 border-t border-border">
          <p className="text-xs text-text-muted mb-4">Accepted Cryptocurrencies</p>
          <div className="flex flex-wrap items-center gap-3">
            {CRYPTO_ICONS.map((crypto) => (
              <div
                key={crypto}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-background-elevated rounded-button border border-border"
              >
                <div className="h-4 w-4 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-accent-light">
                    {crypto.charAt(0)}
                  </span>
                </div>
                <span className="text-xs font-medium text-text-secondary">
                  {crypto}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Social + Responsible Gambling */}
        <div className="mt-8 pt-8 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Responsible Gambling */}
          <div className="flex items-start gap-3">
            <span className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full border-2 border-warning text-warning text-xs font-bold">
              18+
            </span>
            <p className="text-xs text-text-muted leading-relaxed max-w-lg">
              CryptoBet promotes responsible gambling. Gambling can be addictive.
              Please play responsibly and only gamble with money you can afford to
              lose. If you or someone you know has a gambling problem, visit{' '}
              <Link
                href="/responsible-gambling"
                className="text-accent hover:text-accent-light transition-colors underline"
              >
                our responsible gambling page
              </Link>
              .
            </p>
          </div>

          {/* Social Icons Placeholder */}
          <div className="flex items-center gap-3 shrink-0">
            {['Twitter', 'Discord', 'Telegram', 'GitHub'].map((platform) => (
              <a
                key={platform}
                href="#"
                className="h-8 w-8 rounded-button bg-background-elevated border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-border-light transition-all duration-200"
                title={platform}
              >
                <span className="text-[10px] font-bold">
                  {platform.charAt(0)}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-border px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} CryptoBet. All rights reserved.
          </p>
          <p className="text-xs text-text-muted">
            Licensed and regulated. Operating under Curacao eGaming License.
          </p>
        </div>
      </div>
    </footer>
  );
}
