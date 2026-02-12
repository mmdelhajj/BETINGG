'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  ChevronDown,
  Plus,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { AccountModal } from './AccountModal';

/* ------------------------------------------------------------------ */
/*  Nav tabs (desktop only)                                           */
/* ------------------------------------------------------------------ */
const NAV_TABS = [
  { href: '/sports', label: 'Sports' },
  { href: '/casino', label: 'Casino' },
  { href: '/sports?filter=esports', label: 'Esports' },
] as const;

/* ------------------------------------------------------------------ */
/*  Currency options for the balance dropdown                         */
/* ------------------------------------------------------------------ */
const CURRENCIES = [
  { code: 'USDT', symbol: '₮', color: '#26A17B' },
  { code: 'BTC', symbol: '₿', color: '#F7931A' },
  { code: 'ETH', symbol: 'Ξ', color: '#627EEA' },
  { code: 'SOL', symbol: 'S', color: '#9945FF' },
  { code: 'USDC', symbol: '$', color: '#2775CA' },
] as const;

/* ================================================================== */
/*  TopNav                                                            */
/* ================================================================== */
export function TopNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  /* dropdown states */
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');

  /* refs for click-outside */
  const currencyRef = useRef<HTMLDivElement>(null);

  /* notification badge count (would come from a store in production) */
  const [notificationCount] = useState(0);

  /* ---- sync preferred currency from user record ---- */
  useEffect(() => {
    if (user?.preferredCurrency) {
      setSelectedCurrency(user.preferredCurrency);
    }
  }, [user?.preferredCurrency]);

  /* ---- click-outside handler ---- */
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
      setShowCurrencyMenu(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  /* ---- close dropdowns on navigation ---- */
  useEffect(() => {
    setShowCurrencyMenu(false);
    setShowAccountMenu(false);
  }, [pathname]);

  /* ---- helpers ---- */
  const activeCurrency = CURRENCIES.find((c) => c.code === selectedCurrency) ?? CURRENCIES[0];

  const isTabActive = (href: string) => {
    if (href === '/sports?filter=esports') {
      return pathname === '/sports' && typeof window !== 'undefined' && window.location.search.includes('filter=esports');
    }
    if (href === '/sports') {
      // Active for /sports but NOT when esports filter is on
      const isEsports =
        typeof window !== 'undefined' && window.location.search.includes('filter=esports');
      return (
        !isEsports &&
        (pathname === '/sports' || (pathname?.startsWith('/sports/') ?? false))
      );
    }
    return pathname === href || (pathname?.startsWith(href + '/') ?? false);
  };

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <nav
      className="sticky top-0 z-50 h-14 flex items-center px-4 gap-3"
      style={{
        backgroundColor: '#1A1B1F',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* ---- Logo ---- */}
      <Link href="/" className="flex items-center gap-2 shrink-0 mr-1">
        {/* SVG logo shape */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
          <rect width="28" height="28" rx="8" fill="#8D52DA" />
          <text
            x="14"
            y="19"
            textAnchor="middle"
            fill="white"
            fontSize="16"
            fontWeight="bold"
            fontFamily="Inter, sans-serif"
          >
            C
          </text>
        </svg>
        <span className="text-lg font-bold hidden sm:inline" style={{ color: '#8D52DA' }}>
          CryptoBet
        </span>
      </Link>

      {/* ---- Desktop nav tabs ---- */}
      <div className="hidden lg:flex items-center gap-1">
        {NAV_TABS.map((tab) => {
          const active = isTabActive(tab.href);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                'relative px-4 py-1.5 text-sm font-semibold rounded-md transition-colors',
                active
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {tab.label}
              {/* active purple underline */}
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4/5 rounded-full"
                  style={{ backgroundColor: '#8D52DA' }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* ---- Spacer ---- */}
      <div className="flex-1 min-w-0" />

      {/* ---- Right side (authenticated) ---- */}
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          {/* -- Balance display with currency dropdown -- */}
          <div className="relative" ref={currencyRef}>
            <button
              onClick={() => setShowCurrencyMenu((p) => !p)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-white/5"
            >
              {/* currency icon circle */}
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: activeCurrency.color }}
              >
                {activeCurrency.symbol}
              </span>
              <span className="hidden sm:inline text-white font-mono">
                0.00 <span className="text-gray-400">{activeCurrency.code}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {/* currency dropdown */}
            <AnimatePresence>
              {showCurrencyMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
                  style={{
                    backgroundColor: '#24252B',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <p className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Select currency
                  </p>
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setSelectedCurrency(c.code);
                        setShowCurrencyMenu(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                        selectedCurrency === c.code
                          ? 'text-white bg-white/5'
                          : 'text-gray-300 hover:bg-white/5'
                      )}
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.symbol}
                      </span>
                      <span className="font-medium">{c.code}</span>
                      <span className="ml-auto font-mono text-xs text-gray-500">0.00</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* -- Add Funds / Deposit button -- */}
          <Link
            href="/wallet"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors shrink-0"
            style={{ backgroundColor: '#8D52DA' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7B45C3')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#8D52DA')}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Deposit</span>
          </Link>

          {/* -- Notifications bell -- */}
          <button
            className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            {notificationCount > 0 ? (
              <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center text-white bg-red-500">
                {notificationCount}
              </span>
            ) : (
              /* subtle red dot when there are unread items -- hidden when 0 */
              null
            )}
          </button>

          {/* -- Account button (opens AccountModal) -- */}
          <button
            onClick={() => setShowAccountMenu((p) => !p)}
            className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Account menu"
          >
            {/* avatar circle */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: '#8D52DA' }}
            >
              {user?.username?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {/* Account Modal Overlay */}
          <AccountModal
            isOpen={showAccountMenu}
            onClose={() => setShowAccountMenu(false)}
          />
        </div>
      ) : (
        /* ---- Right side (unauthenticated) ---- */
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition-colors hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <LogIn className="w-4 h-4 hidden sm:block" />
            Log in
          </Link>
          <Link
            href="/register"
            className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#8D52DA' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7B45C3')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#8D52DA')}
          >
            <UserPlus className="w-4 h-4" />
            Sign up
          </Link>
        </div>
      )}
    </nav>
  );
}
