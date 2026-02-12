'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Instagram,
  Send,
  Twitter,
  Youtube,
  ChevronDown,
  MessageCircle,
  Bitcoin,
  CircleDollarSign,
  Gem,
  Coins,
  Hexagon,
  Dog,
  Shield,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

interface SocialLink {
  icon: typeof Twitter;
  label: string;
  href: string;
}

interface CryptoToken {
  symbol: string;
  icon: typeof Bitcoin;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const SOCIAL_LINKS: SocialLink[] = [
  { icon: Instagram, label: 'Instagram', href: 'https://instagram.com/cryptobet' },
  { icon: Send, label: 'Telegram', href: 'https://t.me/cryptobet' },
  { icon: Twitter, label: 'X / Twitter', href: 'https://twitter.com/cryptobet' },
  { icon: Youtube, label: 'YouTube', href: 'https://youtube.com/@cryptobet' },
  { icon: MessageCircle, label: 'Reddit', href: 'https://reddit.com/r/cryptobet' },
];

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Casino',
    links: [
      { label: 'Slots', href: '/casino/slots' },
      { label: 'Live Casino', href: '/casino/live' },
      { label: 'Table Games', href: '/casino/table-games' },
      { label: 'Jackpots', href: '/casino/jackpots' },
      { label: 'Game Shows', href: '/casino/game-shows' },
      { label: 'All Games', href: '/casino' },
    ],
  },
  {
    title: 'Sports',
    links: [
      { label: 'Soccer', href: '/sports/soccer' },
      { label: 'Basketball', href: '/sports/basketball' },
      { label: 'Tennis', href: '/sports/tennis' },
      { label: 'American Football', href: '/sports/american-football' },
      { label: 'Esports', href: '/sports?filter=esports' },
      { label: 'All Sports', href: '/sports' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Press', href: '/press' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Responsible Gambling', href: '/responsible-gambling' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

const CRYPTO_TOKENS: CryptoToken[] = [
  { symbol: 'BTC', icon: Bitcoin },
  { symbol: 'ETH', icon: Hexagon },
  { symbol: 'USDT', icon: CircleDollarSign },
  { symbol: 'LTC', icon: Gem },
  { symbol: 'SOL', icon: Coins },
  { symbol: 'DOGE', icon: Dog },
  { symbol: 'XRP', icon: Shield },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Türkçe' },
];

/* ------------------------------------------------------------------ */
/*  Component - Cloudbet-style footer: compact, professional          */
/* ------------------------------------------------------------------ */
export function Footer() {
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');

  const currentLangLabel =
    LANGUAGES.find((l) => l.code === selectedLang)?.label ?? 'English';

  return (
    <footer
      className="pb-16 lg:pb-8"
      style={{
        backgroundColor: '#0D0D10',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-8 pb-4">
        {/* ── Crypto Icons Row (top) ──────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-3 lg:gap-4 mb-8">
          {CRYPTO_TOKENS.map((token) => {
            const Icon = token.icon;
            return (
              <div
                key={token.symbol}
                className="flex items-center gap-1"
                title={token.symbol}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: 'rgba(255, 255, 255, 0.25)' }}
                />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: 'rgba(255, 255, 255, 0.25)' }}
                >
                  {token.symbol}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Divider ───────────────────────────────────────────── */}
        <div
          className="mb-8"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
        />

        {/* ── Footer Link Columns - 4-col desktop, 2-col tablet, 1-col mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-8">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h4
                className="text-[11px] font-semibold uppercase mb-3"
                style={{
                  color: 'rgba(255, 255, 255, 0.3)',
                  letterSpacing: '0.05em',
                }}
              >
                {column.title}
              </h4>
              <ul className="space-y-0">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] transition-colors block py-1.5"
                      style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = '#ffffff')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)')
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Divider ───────────────────────────────────────────── */}
        <div
          className="mb-6"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
        />

        {/* ── Social Links + Language Selector Row ──────────────── */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-6">
          {/* Social Links */}
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="transition-colors"
                  style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = '#ffffff')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.3)')
                  }
                >
                  <Icon className="w-[18px] h-[18px]" />
                </a>
              );
            })}
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
              aria-label="Select language"
              aria-expanded={langOpen}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')
              }
            >
              <Globe className="w-4 h-4" />
              <span>{currentLangLabel}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  langOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {langOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangOpen(false)}
                  aria-hidden="true"
                />
                {/* Dropdown - opens upward */}
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-44 rounded py-1 z-50 shadow-xl max-h-64 overflow-y-auto"
                  style={{ backgroundColor: '#1A1A1F' }}
                  role="listbox"
                >
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSelectedLang(lang.code);
                        setLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        selectedLang === lang.code
                          ? 'text-white bg-white/10'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                      role="option"
                      aria-selected={selectedLang === lang.code}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────── */}
        <div
          className="mb-6"
          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
        />

        {/* ── License Info + Age Restriction ───────────────────── */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-4 mb-5">
          {/* 18+ Badge */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.8)',
            }}
            aria-label="18 and over only"
          >
            18+
          </div>

          {/* License Badge */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded text-[11px]"
            style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <Shield
              className="w-4 h-4 shrink-0"
              style={{ color: 'rgba(255, 255, 255, 0.4)' }}
            />
            <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
              Licensed by{' '}
              <span
                className="font-semibold"
                style={{ color: 'rgba(255, 255, 255, 0.6)' }}
              >
                Curaçao Gaming Authority
              </span>
            </span>
          </div>
        </div>

        {/* ── Copyright ──────────────────────────────────────────── */}
        <p
          className="text-[11px] text-center mb-4"
          style={{ color: 'rgba(255, 255, 255, 0.3)' }}
        >
          &copy; 2024 CryptoBet. All rights reserved.
        </p>

        {/* ── Responsible Gambling Disclaimer ───────────────────── */}
        <div className="max-w-2xl mx-auto">
          <p
            className="text-[11px] text-center leading-relaxed"
            style={{ color: 'rgba(255, 255, 255, 0.25)' }}
          >
            Gambling can be addictive. Please play responsibly. CryptoBet only
            accepts customers over 18 years of age. Customers need to be aware
            that gambling comes with risks and should be done only as
            entertainment. CryptoBet is not liable for any losses from gambling.
            Please gamble responsibly. If you feel you may have a problem, visit{' '}
            <a
              href="https://www.begambleaware.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors"
              style={{ color: 'rgba(255, 255, 255, 0.35)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)')
              }
            >
              BeGambleAware.org
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
