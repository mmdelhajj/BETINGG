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
} from 'lucide-react';

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: typeof Twitter;
  label: string;
  href: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  { icon: Instagram, label: 'Instagram', href: 'https://instagram.com/cryptobet' },
  { icon: Send, label: 'Telegram', href: 'https://t.me/cryptobet' },
  { icon: Twitter, label: 'X / Twitter', href: 'https://twitter.com/cryptobet' },
  { icon: Youtube, label: 'YouTube', href: 'https://youtube.com/@cryptobet' },
];

const ROW1_LINKS: FooterLink[] = [
  { label: 'Responsible Gambling', href: '/responsible-gambling' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Help Center', href: '/help' },
  { label: 'Blog', href: '/blog' },
];

const ROW2_LINKS: FooterLink[] = [
  { label: 'About Us', href: '/about' },
  { label: 'Affiliates', href: '/affiliates' },
  { label: 'VIP Program', href: '/vip' },
  { label: 'Promotions', href: '/promotions' },
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

function FooterLinkRow({ links }: { links: FooterLink[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-[13px] text-white/50 hover:text-white transition-colors"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export function Footer() {
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');

  const currentLangLabel = LANGUAGES.find((l) => l.code === selectedLang)?.label ?? 'English';

  return (
    <footer
      className="pb-20 lg:pb-0"
      style={{ backgroundColor: '#111214', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        {/* Language Selector */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white/70 hover:text-white transition-colors"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
            >
              <Globe className="w-4 h-4" />
              <span>{currentLangLabel}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 rounded-lg py-1 shadow-dialog z-50"
                style={{ backgroundColor: '#222328' }}
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLang(lang.code);
                      setLangOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      selectedLang === lang.code
                        ? 'text-white bg-white/10'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Social Icons */}
        <div className="flex items-center justify-center gap-5 mb-8">
          {SOCIAL_LINKS.map((social) => {
            const Icon = social.icon;
            return (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white transition-colors"
                aria-label={social.label}
              >
                <Icon className="w-6 h-6" />
              </a>
            );
          })}
        </div>

        {/* Links Row 1 */}
        <div className="mb-4">
          <FooterLinkRow links={ROW1_LINKS} />
        </div>

        {/* Links Row 2 */}
        <div className="mb-8">
          <FooterLinkRow links={ROW2_LINKS} />
        </div>

        {/* License Info */}
        <div className="flex flex-col items-center text-center mb-6">
          {/* 18+ and License Badge */}
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ border: '2px solid rgba(255, 255, 255, 0.3)' }}
            >
              18+
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs text-white/50"
              style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
            >
              <span className="font-semibold text-white/70">Curacao</span>
              <span>eGaming License</span>
            </div>
          </div>

          <p className="text-xs text-white/30 leading-relaxed max-w-lg">
            Operated by Halcyon Super Holdings B.V.
          </p>
          <p className="text-xs text-white/30 leading-relaxed max-w-lg">
            Abraham Mendez Chumaceiro Boulevard 03, Willemstad, Cura&ccedil;ao
          </p>
          <p className="text-xs text-white/30 leading-relaxed max-w-lg mb-4">
            License: OGL/2024/328/0599
          </p>
        </div>

        {/* Disclaimer */}
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] text-white/25 text-center leading-relaxed">
            Gambling can be addictive. Please play responsibly. CryptoBet only accepts customers
            over 18 years of age. Customers need to be aware that gambling comes with risks and
            should be done only as entertainment. CryptoBet is not liable for any losses from
            gambling. Please gamble responsibly. If you feel you may have a problem, visit{' '}
            <a
              href="https://www.begambleaware.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/40 transition-colors"
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
