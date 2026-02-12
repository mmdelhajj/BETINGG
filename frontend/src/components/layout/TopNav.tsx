'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  MessageCircle,
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
/*  TopNav  -  Cloudbet-style fixed header                            */
/* ================================================================== */
export function TopNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  /* dropdown / modal states */
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
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
  }, [pathname]);

  /* ---- helpers ---- */
  const activeCurrency =
    CURRENCIES.find((c) => c.code === selectedCurrency) ?? CURRENCIES[0];

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <nav
      className="fixed top-0 left-0 right-0 flex items-center px-4 md:px-5"
      style={{
        height: 60,
        backgroundColor: '#1A1B1F',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 1000,
      }}
    >
      {/* ---- Logo (CB monogram) ---- */}
      <Link href="/" className="flex items-center shrink-0 mr-4 md:mr-6">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden
          className="w-7 h-7 md:w-9 md:h-9"
        >
          <rect width="36" height="36" rx="10" fill="#8D52DA" />
          <text
            x="18"
            y="24"
            textAnchor="middle"
            fill="white"
            fontSize="17"
            fontWeight="800"
            fontFamily="Inter, system-ui, sans-serif"
            letterSpacing="-0.5"
          >
            CB
          </text>
        </svg>
      </Link>

      {/* ---- Spacer pushes everything else to the right ---- */}
      <div className="flex-1 min-w-0" />

      {/* ---- Right-side actions ---- */}
      {isAuthenticated ? (
        <div className="flex items-center gap-1.5 md:gap-2.5">
          {/* -- Balance display with currency dropdown -- */}
          <div className="relative" ref={currencyRef}>
            <button
              onClick={() => setShowCurrencyMenu((p) => !p)}
              className={cn(
                'flex items-center gap-1.5 md:gap-2 px-2 md:px-3 h-9 rounded-lg text-sm font-semibold transition-colors',
                'hover:bg-white/5'
              )}
            >
              {/* currency icon circle */}
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: activeCurrency.color }}
              >
                {activeCurrency.symbol}
              </span>
              {/* balance text */}
              <span className="text-white font-mono text-xs md:text-sm whitespace-nowrap">
                <span className="hidden sm:inline">0.00 </span>
                <span className="sm:hidden">0.00 </span>
                <span className="text-gray-400 hidden sm:inline">
                  {activeCurrency.code}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-gray-400 transition-transform duration-150',
                  showCurrencyMenu && 'rotate-180'
                )}
              />
            </button>

            {/* currency dropdown panel */}
            <AnimatePresence>
              {showCurrencyMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl py-1 overflow-hidden"
                  style={{
                    backgroundColor: '#24252B',
                    border: '1px solid rgba(255,255,255,0.08)',
                    zIndex: 1010,
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
                        'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors',
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
                      <span className="ml-auto font-mono text-xs text-gray-500">
                        0.00
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* -- Add Funds button (lime green) -- */}
          <Link
            href="/wallet"
            className={cn(
              'flex items-center gap-1 md:gap-1.5 px-2.5 md:px-4 h-9 rounded-lg text-xs md:text-sm font-semibold shrink-0',
              'transition-all duration-150'
            )}
            style={{
              backgroundColor: '#BFFF00',
              color: '#000000',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#A8E000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#BFFF00';
            }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Add funds</span>
            <span className="sm:hidden">Add</span>
          </Link>

          {/* -- Chat button -- */}
          <button
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
              'text-gray-400 hover:text-white hover:bg-white/5 transition-colors'
            )}
            aria-label="Chat"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
          </button>

          {/* -- Account button (user avatar) -- */}
          <button
            onClick={() => setShowAccountModal((p) => !p)}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-full shrink-0',
              'transition-colors hover:ring-2 hover:ring-white/10'
            )}
            aria-label="Account menu"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: '#8D52DA' }}
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
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 h-9 text-sm font-semibold text-white rounded-lg transition-colors hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <LogIn className="w-4 h-4 hidden sm:block" />
            Log in
          </Link>
          <Link
            href="/register"
            className="hidden sm:flex items-center gap-1.5 px-4 h-9 text-sm font-semibold rounded-lg transition-colors"
            style={{
              backgroundColor: '#BFFF00',
              color: '#000000',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#A8E000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#BFFF00';
            }}
          >
            <UserPlus className="w-4 h-4" />
            Sign up
          </Link>
        </div>
      )}
    </nav>
  );
}
