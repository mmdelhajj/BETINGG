'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Search,
  Menu,
  ChevronDown,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { AccountModal } from './AccountModal';

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
/*  TopNav  -  Professional mobile-first navigation                   */
/* ================================================================== */
export function TopNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  /* dropdown / modal states */
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');

  /* refs for click-outside */
  const currencyRef = useRef<HTMLDivElement>(null);

  /* ---- sync preferred currency from user record ---- */
  useEffect(() => {
    if (user?.preferredCurrency) {
      setSelectedCurrency(user.preferredCurrency);
    }
  }, [user?.preferredCurrency]);

  /* ---- click-outside handler ---- */
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      currencyRef.current &&
      !currencyRef.current.contains(e.target as Node)
    ) {
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
    setShowAccountModal(false);
    setShowSearchOverlay(false);
  }, [pathname]);

  /* ---- helpers ---- */
  const activeCurrency =
    CURRENCIES.find((c) => c.code === selectedCurrency) ?? CURRENCIES[0];

  const formatBalance = (balance: number = 0): string => {
    if (balance >= 1000000) return `${(balance / 1000000).toFixed(2)}M`;
    if (balance >= 1000) return `${(balance / 1000).toFixed(2)}K`;
    return balance.toFixed(2);
  };

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 flex items-center px-4 md:px-6 z-[1000]"
        style={{
          height: 'calc(56px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          backgroundColor: '#1A1B1F',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center w-full h-14 md:h-[60px]">
          {/* ---- Mobile Menu Button (left) ---- */}
          <button
            className="flex items-center justify-center shrink-0 w-11 h-11 -ml-2 mr-1 md:hidden text-white hover:bg-white/5 active:bg-white/10 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" strokeWidth={2} />
          </button>

          {/* ---- Logo (CB monogram) ---- */}
          <Link
            href="/"
            className="flex items-center justify-center shrink-0 w-11 h-11 md:w-12 md:h-12 md:mr-6 hover:opacity-80 active:opacity-60 transition-opacity"
            aria-label="CryptoBet Home"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              className="w-9 h-9 md:w-10 md:h-10"
            >
              <rect width="40" height="40" rx="10" fill="#8D52DA" />
              <text
                x="20"
                y="27"
                textAnchor="middle"
                fill="white"
                fontSize="18"
                fontWeight="800"
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="-0.5"
              >
                CB
              </text>
            </svg>
          </Link>

          {/* ---- Spacer pushes everything to the right ---- */}
          <div className="flex-1 min-w-0" />

          {/* ---- Right-side actions ---- */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 md:gap-2">
              {/* -- Balance display with currency dropdown -- */}
              <div className="relative" ref={currencyRef}>
                <button
                  onClick={() => setShowCurrencyMenu((p) => !p)}
                  className={cn(
                    'flex items-center gap-2 px-2 md:px-3 h-11 rounded-lg transition-colors',
                    'hover:bg-white/5 active:bg-white/10'
                  )}
                  aria-label="Select currency"
                >
                  {/* currency icon circle */}
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: activeCurrency.color }}
                  >
                    {activeCurrency.symbol}
                  </span>
                  {/* balance text */}
                  <div className="flex flex-col items-start">
                    <span className="text-white font-mono text-sm md:text-base font-semibold leading-tight whitespace-nowrap">
                      {formatBalance(0)}
                    </span>
                    <span className="text-gray-400 text-xs leading-tight hidden md:block">
                      {activeCurrency.code}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0',
                      showCurrencyMenu && 'rotate-180'
                    )}
                  />
                </button>

                {/* currency dropdown panel */}
                <AnimatePresence>
                  {showCurrencyMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl py-2 overflow-hidden"
                      style={{
                        backgroundColor: '#24252B',
                        border: '1px solid rgba(255,255,255,0.08)',
                        zIndex: 1010,
                      }}
                    >
                      <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Select currency
                      </p>
                      <div className="py-1">
                        {CURRENCIES.map((c) => (
                          <button
                            key={c.code}
                            onClick={() => {
                              setSelectedCurrency(c.code);
                              setShowCurrencyMenu(false);
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors min-h-[44px]',
                              selectedCurrency === c.code
                                ? 'text-white bg-white/5'
                                : 'text-gray-300 hover:bg-white/5 active:bg-white/10'
                            )}
                          >
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                              style={{ backgroundColor: c.color }}
                            >
                              {c.symbol}
                            </span>
                            <span className="font-semibold">{c.code}</span>
                            <span className="ml-auto font-mono text-sm text-gray-500">
                              {formatBalance(0)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* -- Add Funds button (lime green CTA) -- */}
              <Link
                href="/wallet"
                className={cn(
                  'flex items-center justify-center gap-1.5 px-3 md:px-4 h-11 rounded-lg font-semibold shrink-0',
                  'transition-all duration-150 min-w-[44px]'
                )}
                style={{
                  backgroundColor: '#BFFF00',
                  color: '#000000',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#A8E000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#BFFF00';
                }}
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
                <span className="hidden sm:inline">Add Funds</span>
              </Link>

              {/* -- Search button (mobile only) -- */}
              <button
                onClick={() => setShowSearchOverlay(true)}
                className={cn(
                  'flex md:hidden items-center justify-center w-11 h-11 rounded-lg shrink-0',
                  'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors'
                )}
                aria-label="Search"
              >
                <Search className="w-5 h-5" strokeWidth={2} />
              </button>

              {/* -- Account button (user avatar) -- */}
              <button
                onClick={() => setShowAccountModal((p) => !p)}
                className={cn(
                  'flex items-center justify-center w-11 h-11 rounded-full shrink-0',
                  'transition-all hover:ring-2 hover:ring-white/20 active:scale-95'
                )}
                aria-label="Account menu"
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white"
                  style={{
                    backgroundColor: '#8D52DA',
                    fontSize: '16px',
                  }}
                >
                  {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                </div>
              </button>

              {/* Account Modal Overlay */}
              <AccountModal
                isOpen={showAccountModal}
                onClose={() => setShowAccountModal(false)}
              />
            </div>
          ) : (
            /* ---- Right side (unauthenticated) ---- */
            <div className="flex items-center gap-2">
              {/* -- Search button (mobile only) -- */}
              <button
                onClick={() => setShowSearchOverlay(true)}
                className={cn(
                  'flex md:hidden items-center justify-center w-11 h-11 rounded-lg shrink-0',
                  'text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors'
                )}
                aria-label="Search"
              >
                <Search className="w-5 h-5" strokeWidth={2} />
              </button>

              {/* -- Log in button -- */}
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 px-3 md:px-4 h-11 font-semibold text-white rounded-lg transition-colors hover:bg-white/5 active:bg-white/10 min-w-[44px]"
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: '14px',
                }}
              >
                <LogIn className="w-4 h-4 hidden md:block" />
                <span>Log In</span>
              </Link>

              {/* -- Sign up button (ALWAYS VISIBLE) -- */}
              <Link
                href="/register"
                className="flex items-center justify-center gap-1.5 px-3 md:px-4 h-11 font-semibold rounded-lg transition-all min-w-[44px]"
                style={{
                  backgroundColor: '#BFFF00',
                  color: '#000000',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#A8E000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#BFFF00';
                }}
              >
                <UserPlus className="w-4 h-4 hidden md:block" />
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* ---- Search Overlay (Mobile) ---- */}
      <AnimatePresence>
        {showSearchOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[1100] md:hidden"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              paddingTop: 'calc(56px + env(safe-area-inset-top))',
            }}
            onClick={() => setShowSearchOverlay(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  strokeWidth={2}
                />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search games, sports, events..."
                  className="w-full h-12 pl-12 pr-4 rounded-xl text-white placeholder-gray-500 outline-none transition-colors"
                  style={{
                    backgroundColor: '#24252B',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '16px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                />
              </div>
              <button
                onClick={() => setShowSearchOverlay(false)}
                className="w-full mt-4 h-11 rounded-xl text-white font-semibold transition-colors"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
