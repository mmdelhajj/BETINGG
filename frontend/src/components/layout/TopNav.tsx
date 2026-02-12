'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Menu,
  ChevronDown,
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

/* ------------------------------------------------------------------ */
/*  Main nav links (desktop only)                                     */
/* ------------------------------------------------------------------ */
const NAV_LINKS = [
  { label: 'Sports', href: '/sports' },
  { label: 'Casino', href: '/casino' },
  { label: 'Esports', href: '/esports' },
  { label: 'Promotions', href: '/promotions' },
] as const;

/* ================================================================== */
/*  TopNav - Real Cloudbet.com Design                                */
/* ================================================================== */
export function TopNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  /* scroll state for transparent -> solid background */
  const [isScrolled, setIsScrolled] = useState(false);

  /* dropdown / modal states */
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');

  /* refs for click-outside */
  const currencyRef = useRef<HTMLDivElement>(null);

  /* ---- scroll listener for transparent -> solid transition ---- */
  useEffect(() => {
    const handleScroll = () => {
      // Transition at 5% of viewport height
      const scrollThreshold = window.innerHeight * 0.05;
      setIsScrolled(window.scrollY > scrollThreshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    setShowMobileMenu(false);
  }, [pathname]);

  /* ---- helpers ---- */
  const activeCurrency =
    CURRENCIES.find((c) => c.code === selectedCurrency) ?? CURRENCIES[0];

  const formatBalance = (balance: number = 0): string => {
    if (balance >= 1000000) return `${(balance / 1000000).toFixed(2)}M`;
    if (balance >= 1000) return `${(balance / 1000).toFixed(2)}K`;
    return balance.toFixed(2);
  };

  const isLinkActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 flex items-center px-4 md:px-6 z-[1000] transition-all duration-200"
        style={{
          height: 'calc(60px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          backgroundColor: isScrolled ? '#141114' : 'transparent',
          borderBottom: isScrolled
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid transparent',
        }}
      >
        <div className="flex items-center w-full h-[60px] max-w-[1920px] mx-auto">
          {/* ---- Logo ---- */}
          <Link
            href="/"
            className="flex items-center justify-center shrink-0 h-[60px] mr-8 hover:opacity-80 transition-opacity"
            aria-label="Cloudbet Home"
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              className="w-9 h-9"
            >
              <rect width="36" height="36" rx="8" fill="#8D52DA" />
              <text
                x="18"
                y="24"
                textAnchor="middle"
                fill="white"
                fontSize="16"
                fontWeight="800"
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="-0.5"
              >
                CB
              </text>
            </svg>
          </Link>

          {/* ---- Desktop Nav Links ---- */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = isLinkActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative px-4 h-[60px] flex items-center text-sm font-medium transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-white/60 hover:text-white'
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: '#8D52DA' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* ---- Spacer ---- */}
          <div className="flex-1 min-w-0" />

          {/* ---- Right Side (Desktop) ---- */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search Icon */}
            <button
              onClick={() => setShowSearchOverlay(true)}
              className="flex items-center justify-center w-10 h-10 rounded text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" strokeWidth={2} />
            </button>

            {isAuthenticated ? (
              <>
                {/* Balance Display */}
                <div className="relative" ref={currencyRef}>
                  <button
                    onClick={() => setShowCurrencyMenu((p) => !p)}
                    className="flex items-center gap-2 px-3 h-10 rounded hover:bg-white/5 transition-colors"
                    aria-label="Select currency"
                  >
                    {/* Currency icon */}
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: activeCurrency.color }}
                    >
                      {activeCurrency.symbol}
                    </span>
                    {/* Balance */}
                    <span className="text-white font-mono text-sm font-semibold whitespace-nowrap">
                      {formatBalance(0)}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-white/60 transition-transform duration-200',
                        showCurrencyMenu && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Currency Dropdown */}
                  <AnimatePresence>
                    {showCurrencyMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-56 rounded overflow-hidden shadow-2xl"
                        style={{
                          backgroundColor: '#1C1C1E',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <div className="py-1">
                          {CURRENCIES.map((c) => (
                            <button
                              key={c.code}
                              onClick={() => {
                                setSelectedCurrency(c.code);
                                setShowCurrencyMenu(false);
                              }}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                                selectedCurrency === c.code
                                  ? 'text-white bg-white/5'
                                  : 'text-white/80 hover:bg-white/5'
                              )}
                            >
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ backgroundColor: c.color }}
                              >
                                {c.symbol}
                              </span>
                              <span className="font-medium">{c.code}</span>
                              <span className="ml-auto font-mono text-xs text-white/50">
                                {formatBalance(0)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Deposit Button */}
                <button
                  className="relative px-4 h-10 rounded font-semibold text-white text-sm overflow-hidden transition-all hover:brightness-110"
                  style={{
                    backgroundColor: '#8D52DA',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#7a42c4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#8D52DA';
                  }}
                >
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(0deg, rgba(255,255,255,0.075), rgba(255,255,255,0.15))',
                    }}
                  />
                  <span className="relative">Deposit</span>
                </button>

                {/* User Avatar */}
                <button
                  onClick={() => setShowAccountModal((p) => !p)}
                  className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 transition-all hover:ring-2 hover:ring-white/20"
                  aria-label="Account menu"
                  style={{ backgroundColor: '#8D52DA' }}
                >
                  <span className="text-white font-bold text-sm">
                    {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                  </span>
                </button>

                {/* Account Modal */}
                <AccountModal
                  isOpen={showAccountModal}
                  onClose={() => setShowAccountModal(false)}
                />
              </>
            ) : (
              <>
                {/* Join Button (Purple) */}
                <Link
                  href="/register"
                  className="relative px-4 h-10 rounded font-semibold text-white text-sm overflow-hidden transition-all hover:brightness-110"
                  style={{
                    backgroundColor: '#8D52DA',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#7a42c4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#8D52DA';
                  }}
                >
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(0deg, rgba(255,255,255,0.075), rgba(255,255,255,0.15))',
                    }}
                  />
                  <span className="relative">Join</span>
                </Link>
              </>
            )}
          </div>

          {/* ---- Right Side (Mobile) ---- */}
          <div className="flex md:hidden items-center gap-2">
            {/* Search */}
            <button
              onClick={() => setShowSearchOverlay(true)}
              className="flex items-center justify-center w-10 h-10 rounded text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5" strokeWidth={2} />
            </button>

            {/* Balance (if logged in) */}
            {isAuthenticated && (
              <button
                onClick={() => setShowCurrencyMenu(true)}
                className="flex items-center gap-1.5 px-2 h-10 rounded hover:bg-white/5 transition-colors"
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: activeCurrency.color }}
                >
                  {activeCurrency.symbol}
                </span>
                <span className="text-white font-mono text-sm font-semibold">
                  {formatBalance(0)}
                </span>
              </button>
            )}

            {/* Hamburger Menu */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className="flex items-center justify-center w-10 h-10 rounded text-white hover:bg-white/5 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>
        </div>
      </nav>

      {/* ---- Search Overlay ---- */}
      <AnimatePresence>
        {showSearchOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[1100]"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              paddingTop: 'calc(60px + env(safe-area-inset-top))',
            }}
            onClick={() => setShowSearchOverlay(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="p-4 max-w-2xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
                  strokeWidth={2}
                />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search games, sports, events..."
                  className="w-full h-14 pl-12 pr-4 rounded text-white placeholder-white/40 outline-none transition-colors"
                  style={{
                    backgroundColor: '#1C1C1E',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '16px',
                    borderRadius: '4px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      'rgba(255,255,255,0.08)';
                  }}
                />
              </div>
              <button
                onClick={() => setShowSearchOverlay(false)}
                className="w-full mt-4 h-12 rounded text-white font-medium transition-colors hover:bg-white/10"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  fontSize: '14px',
                  borderRadius: '4px',
                }}
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Mobile Menu Drawer ---- */}
      <AnimatePresence>
        {showMobileMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[1200] md:hidden"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
              onClick={() => setShowMobileMenu(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 right-0 bottom-0 w-[80%] max-w-sm z-[1201] md:hidden overflow-y-auto"
              style={{
                backgroundColor: '#141114',
                paddingTop: 'calc(60px + env(safe-area-inset-top))',
              }}
            >
              <div className="p-6">
                {/* Nav Links */}
                <nav className="space-y-1">
                  {NAV_LINKS.map((link) => {
                    const isActive = isLinkActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          'block px-4 py-3 rounded text-base font-medium transition-colors',
                          isActive
                            ? 'text-white bg-white/10'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        )}
                        style={{ borderRadius: '4px' }}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* Divider */}
                <div
                  className="my-6 h-px"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                />

                {/* Auth Actions */}
                {isAuthenticated ? (
                  <div className="space-y-3">
                    <button
                      className="w-full relative px-4 h-12 rounded font-semibold text-white text-sm overflow-hidden transition-all"
                      style={{
                        backgroundColor: '#8D52DA',
                        borderRadius: '4px',
                      }}
                    >
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(0deg, rgba(255,255,255,0.075), rgba(255,255,255,0.15))',
                        }}
                      />
                      <span className="relative">Deposit</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Link
                      href="/register"
                      className="w-full relative px-4 h-12 rounded font-semibold text-white text-sm overflow-hidden transition-all flex items-center justify-center"
                      style={{
                        backgroundColor: '#8D52DA',
                        borderRadius: '4px',
                      }}
                    >
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(0deg, rgba(255,255,255,0.075), rgba(255,255,255,0.15))',
                        }}
                      />
                      <span className="relative">Join Now</span>
                    </Link>
                    <Link
                      href="/login"
                      className="w-full px-4 h-12 rounded font-medium text-white text-sm transition-colors flex items-center justify-center hover:bg-white/5"
                      style={{
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                      }}
                    >
                      Log In
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Currency Menu (Mobile) */}
      <AnimatePresence>
        {showCurrencyMenu && !showMobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1150] md:hidden flex items-end"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onClick={() => setShowCurrencyMenu(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="w-full rounded-t-2xl overflow-hidden"
              style={{
                backgroundColor: '#141114',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-white text-lg font-semibold mb-4">
                  Select Currency
                </h3>
                <div className="space-y-2">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        setSelectedCurrency(c.code);
                        setShowCurrencyMenu(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded text-sm transition-colors',
                        selectedCurrency === c.code
                          ? 'text-white bg-white/10'
                          : 'text-white/80 hover:bg-white/5'
                      )}
                      style={{ borderRadius: '4px' }}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: c.color }}
                      >
                        {c.symbol}
                      </span>
                      <span className="font-medium">{c.code}</span>
                      <span className="ml-auto font-mono text-sm text-white/50">
                        {formatBalance(0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
