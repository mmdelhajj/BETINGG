'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  ChevronDown,
  Menu,
  X,
  User,
  Settings,
  Trophy,
  Crown,
  Wallet,
  LogOut,
  Ticket,
  Home,
  Plus,
  Gift,
  Shield,
  Gamepad2,
  Dice5,
  CheckCheck,
  Trash2,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Star,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { get, put } from '@/lib/api';
import { useAuthStore, selectUser, selectIsAuthenticated, selectBalances, selectPreferredCurrency } from '@/stores/authStore';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WalletModal from '@/components/layout/WalletModal';

// ---------------------------------------------------------------------------
// Nav Items - Cloudbet style: Sports | Casino | Esports
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  {
    label: 'Sports',
    href: '/sports',
    icon: Trophy,
  },
  {
    label: 'Casino',
    href: '/casino',
    icon: Dice5,
  },
  {
    label: 'Esports',
    href: '/esports',
    icon: Gamepad2,
  },
];

// ---------------------------------------------------------------------------
// Mobile Nav Tabs (Cloudbet-style - icons only row)
// ---------------------------------------------------------------------------

const MOBILE_NAV_TABS = [
  { label: 'Sports', href: '/sports', icon: Trophy },
  { label: 'Casino', href: '/casino', icon: Dice5 },
  { label: 'Esports', href: '/esports', icon: Gamepad2 },
];

// ---------------------------------------------------------------------------
// Currency Icon Component
// ---------------------------------------------------------------------------

function CurrencyIcon({ currency, size = 16 }: { currency: string; size?: number }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    USDT: { bg: 'bg-emerald-500', text: 'text-white', label: 'T' },
    USDC: { bg: 'bg-blue-500', text: 'text-white', label: '$' },
    BTC: { bg: 'bg-orange-500', text: 'text-white', label: '\u20BF' },
    ETH: { bg: 'bg-indigo-400', text: 'text-white', label: '\u039E' },
    SOL: { bg: 'bg-purple-500', text: 'text-white', label: 'S' },
    BNB: { bg: 'bg-yellow-500', text: 'text-black', label: 'B' },
    LTC: { bg: 'bg-gray-400', text: 'text-white', label: 'L' },
    DOGE: { bg: 'bg-amber-400', text: 'text-black', label: 'D' },
    XRP: { bg: 'bg-slate-500', text: 'text-white', label: 'X' },
    TRX: { bg: 'bg-red-500', text: 'text-white', label: 'T' },
  };

  const config = colors[currency?.toUpperCase()] || { bg: 'bg-gray-500', text: 'text-white', label: '?' };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold shrink-0',
        config.bg,
        config.text,
      )}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Cloudbet-style Logo: 4 vertical bars
// ---------------------------------------------------------------------------

function CloudbetLogo() {
  return (
    <div className="flex items-center gap-[3px]">
      <div className="w-[3px] h-3 bg-white/60 rounded-full" />
      <div className="w-[3px] h-4 bg-white/75 rounded-full" />
      <div className="w-[3px] h-5 bg-white/90 rounded-full" />
      <div className="w-[3px] h-6 bg-white rounded-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header Component
// ---------------------------------------------------------------------------

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore(selectUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const setPreferredCurrency = useAuthStore((s) => s.setPreferredCurrency);
  const balances = useAuthStore(selectBalances);
  const preferredCurrency = useAuthStore(selectPreferredCurrency);
  const setBetSlipCurrency = useBetSlipStore((s) => s.setCurrency);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [mobileCurrencyDropdownOpen, setMobileCurrencyDropdownOpen] = useState(false);
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    data?: Record<string, unknown>;
  }>>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);
  const mobileCurrencyDropdownRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
      if (
        currencyDropdownRef.current &&
        !currencyDropdownRef.current.contains(event.target as Node)
      ) {
        setCurrencyDropdownOpen(false);
      }
      if (
        mobileCurrencyDropdownRef.current &&
        !mobileCurrencyDropdownRef.current.contains(event.target as Node)
      ) {
        setMobileCurrencyDropdownOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notification count
  const fetchNotificationCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await get<{ count: number }>('/notifications/unread-count');
      setNotificationCount(data.count ?? 0);
    } catch {
      // silently ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(interval);
  }, [fetchNotificationCount]);

  // Fetch notifications when panel opens
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setNotificationsLoading(true);
    try {
      const data = await get<{ notifications: Array<{ id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; data?: Record<string, unknown> }> }>('/notifications?limit=20');
      setNotifications(data.notifications ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [isAuthenticated]);

  const handleToggleNotifications = useCallback(() => {
    const opening = !notificationsOpen;
    setNotificationsOpen(opening);
    if (opening) fetchNotifications();
  }, [notificationsOpen, fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await put('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setNotificationCount(0);
    } catch {
      // silently ignore
    }
  }, []);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await put(`/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setNotificationCount((c) => Math.max(0, c - 1));
    } catch {
      // silently ignore
    }
  }, []);

  // Focus search input when expanded
  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchExpanded]);

  // Funded balances (available > 0)
  const fundedBalances = balances.filter((b) => b.available > 0);

  // Active balance: the one matching the user's preferred currency, or the highest
  const activeBalance =
    fundedBalances.find((b) => b.currency === preferredCurrency) ||
    fundedBalances.slice().sort((a, b) => b.available - a.available)[0] ||
    null;

  // Keep legacy alias for code that references primaryBalance
  const primaryBalance = activeBalance;

  // Handle currency selection from dropdown
  const handleSelectCurrency = (currency: string) => {
    setPreferredCurrency(currency);
    setBetSlipCurrency(currency);
    setCurrencyDropdownOpen(false);
    setMobileCurrencyDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    router.push('/login');
  };

  // Helper to check active route
  const isActiveRoute = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <>
      {/* ================================================================== */}
      {/* DESKTOP HEADER (lg and above) - Cloudbet dark navy design          */}
      {/* ================================================================== */}
      <header className="sticky top-0 z-50 hidden lg:block" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)' }}>
        <div className="h-16 flex items-center justify-between px-5">
          {/* ---- Left: Logo + Nav Tabs ---- */}
          <div className="flex items-center gap-1">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3 shrink-0 mr-4 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors duration-200"
            >
              <CloudbetLogo />
              <span className="text-[15px] font-bold text-white tracking-wide">
                Crypto<span className="text-accent-light">Bet</span>
              </span>
            </Link>

            {/* Desktop Nav Tabs - Cloudbet style with icon above text */}
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActiveRoute(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl transition-all duration-200 group min-w-[72px]',
                      active
                        ? 'bg-accent/20 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <span className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
                      active
                        ? 'bg-accent text-white shadow-lg shadow-accent/30'
                        : 'text-gray-400 group-hover:text-white',
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={cn(
                      'text-[11px] font-semibold tracking-wide',
                      active ? 'text-white' : 'text-gray-400 group-hover:text-gray-200',
                    )}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ---- Center: Search ---- */}
          <div className="flex-1 flex justify-center max-w-md mx-4">
            {searchExpanded ? (
              <div className="relative w-full">
                <div className="flex items-center h-9 w-full rounded-full bg-white/10 border border-white/10 px-3 gap-2 transition-all duration-200">
                  <Search className="h-4 w-4 text-gray-400 shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search events, teams, games..."
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none font-sans"
                    onBlur={() => setSearchExpanded(false)}
                  />
                  <button
                    onClick={() => setSearchExpanded(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSearchExpanded(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <Search className="h-4 w-4" />
                <span className="text-sm">Search</span>
              </button>
            )}
          </div>

          {/* ---- Right: Balance, Add Funds, Rewards, Notifications, Avatar ---- */}
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                {/* Balance Display + Currency Dropdown */}
                <div className="relative" ref={currencyDropdownRef}>
                  <button
                    onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                    className="flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                  >
                    <CurrencyIcon currency={primaryBalance?.currency || 'USDT'} size={18} />
                    <span className="font-mono text-sm font-semibold text-white tabular-nums">
                      {primaryBalance
                        ? formatCurrency(primaryBalance.available, primaryBalance.currency, { showSymbol: false })
                        : '0.00'}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {primaryBalance?.currency || 'USDT'}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-gray-400 transition-transform duration-200',
                        currencyDropdownOpen && 'rotate-180',
                      )}
                    />
                    <div className="ml-0.5 w-px h-4 bg-white/10" />
                    <Shield className="h-4 w-4 text-gray-400" />
                  </button>

                  {/* Currency Dropdown - Cloudbet style */}
                  {currencyDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl py-0 animate-fade-in z-50 overflow-hidden" style={{ background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {/* Active Balance */}
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                          Active Balance
                        </p>
                        {primaryBalance && (
                          <div className="flex items-center gap-3">
                            <CurrencyIcon currency={primaryBalance.currency} size={24} />
                            <div className="flex-1">
                              <span className="text-white font-semibold text-sm">
                                {primaryBalance.currency}
                              </span>
                            </div>
                            <span className="font-mono text-sm font-semibold text-white">
                              {formatCurrency(primaryBalance.available, primaryBalance.currency, {
                                showSymbol: false,
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Available Balances */}
                      <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                          Available Balances
                        </p>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {fundedBalances.map((b) => (
                          <button
                            key={b.currency}
                            onClick={() => handleSelectCurrency(b.currency)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150',
                              b.currency === primaryBalance?.currency
                                ? 'bg-accent/10'
                                : 'hover:bg-white/5',
                            )}
                          >
                            <CurrencyIcon currency={b.currency} size={20} />
                            <div className="flex-1 text-left">
                              <span className="font-medium text-white text-sm">
                                {b.currency}
                              </span>
                            </div>
                            <span className="font-mono text-sm text-gray-300">
                              {formatCurrency(b.available, b.currency, {
                                showSymbol: false,
                              })}
                            </span>
                            {b.currency === primaryBalance?.currency && (
                              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                            )}
                          </button>
                        ))}
                        {fundedBalances.length === 0 && (
                          <div className="px-4 py-5 text-center text-xs text-gray-500">
                            No funded currencies yet.
                          </div>
                        )}
                      </div>

                      {/* Manage Wallet */}
                      <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button
                          onClick={() => { setCurrencyDropdownOpen(false); setWalletModalOpen(true); }}
                          className="text-xs text-accent-light hover:text-accent transition-colors font-medium"
                        >
                          Manage wallet
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Funds Button - Opens Wallet Modal */}
                <button
                  onClick={() => setWalletModalOpen(true)}
                  className="h-9 px-4 rounded-lg font-bold text-sm text-white transition-all duration-200 active:scale-[0.97] shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                    boxShadow: '0 2px 12px rgba(34,197,94,0.3)',
                  }}
                >
                  Add funds
                </button>

                {/* Rewards / Gift */}
                <Link
                  href="/rewards"
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-white/5 transition-all duration-200"
                >
                  <Gift className="h-[18px] w-[18px]" />
                </Link>

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={handleToggleNotifications}
                    className={cn(
                      'relative h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200',
                      notificationsOpen && 'text-white bg-white/5',
                    )}
                  >
                    <Bell className="h-[18px] w-[18px]" />
                    {notificationCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2" style={{ ['--tw-ring-color' as string]: '#1a1a2e' } as React.CSSProperties}>
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown Panel */}
                  {notificationsOpen && (
                    <div className="absolute right-0 top-full mt-2 w-[380px] rounded-xl shadow-2xl animate-fade-in z-50 overflow-hidden" style={{ background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <h3 className="text-sm font-semibold text-white">Notifications</h3>
                        {notifications.some((n) => !n.isRead) && (
                          <button
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1 text-[11px] text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
                          >
                            <CheckCheck className="h-3 w-3" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      {/* Notification List */}
                      <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                        {notificationsLoading ? (
                          <div className="py-8 text-center">
                            <div className="h-5 w-5 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-[#484F58] mt-2">Loading...</p>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-10 text-center">
                            <Bell className="h-8 w-8 text-[#30363D] mx-auto mb-2" />
                            <p className="text-sm text-[#484F58]">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => { if (!n.isRead) handleMarkRead(n.id); }}
                              className={cn(
                                'w-full text-left flex gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors',
                                !n.isRead && 'bg-[#8B5CF6]/[0.04]',
                              )}
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                            >
                              <div className={cn(
                                'shrink-0 mt-0.5 h-8 w-8 rounded-full flex items-center justify-center',
                                n.type === 'BET_WON' && 'bg-[#10B981]/10',
                                n.type === 'BET_LOST' && 'bg-[#EF4444]/10',
                                n.type === 'DEPOSIT_CONFIRMED' && 'bg-[#3B82F6]/10',
                                n.type === 'WITHDRAWAL_APPROVED' && 'bg-[#8B5CF6]/10',
                                n.type === 'VIP_LEVEL_UP' && 'bg-[#F59E0B]/10',
                                n.type === 'PROMO_AVAILABLE' && 'bg-[#EC4899]/10',
                                !['BET_WON','BET_LOST','DEPOSIT_CONFIRMED','WITHDRAWAL_APPROVED','VIP_LEVEL_UP','PROMO_AVAILABLE'].includes(n.type) && 'bg-white/5',
                              )}>
                                {n.type === 'BET_WON' && <TrendingUp className="h-4 w-4 text-[#10B981]" />}
                                {n.type === 'BET_LOST' && <AlertCircle className="h-4 w-4 text-[#EF4444]" />}
                                {n.type === 'DEPOSIT_CONFIRMED' && <ArrowDownCircle className="h-4 w-4 text-[#3B82F6]" />}
                                {n.type === 'WITHDRAWAL_APPROVED' && <ArrowUpCircle className="h-4 w-4 text-[#8B5CF6]" />}
                                {n.type === 'VIP_LEVEL_UP' && <Star className="h-4 w-4 text-[#F59E0B]" />}
                                {n.type === 'PROMO_AVAILABLE' && <Zap className="h-4 w-4 text-[#EC4899]" />}
                                {!['BET_WON','BET_LOST','DEPOSIT_CONFIRMED','WITHDRAWAL_APPROVED','VIP_LEVEL_UP','PROMO_AVAILABLE'].includes(n.type) && <Bell className="h-4 w-4 text-[#8B949E]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-[13px] leading-snug', n.isRead ? 'text-[#8B949E]' : 'text-[#E6EDF3] font-medium')}>
                                  {n.title}
                                </p>
                                <p className="text-[11px] text-[#484F58] mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-[#30363D] mt-1">
                                  {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  {' '}
                                  {new Date(n.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {!n.isRead && (
                                <div className="shrink-0 mt-2">
                                  <div className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
                                </div>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Avatar Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg hover:bg-white/5 transition-all duration-200"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center overflow-hidden ring-2 ring-white/10">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 text-gray-400 transition-transform duration-200',
                        userDropdownOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  {/* User Dropdown Menu */}
                  {userDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-60 rounded-xl shadow-2xl py-0 animate-fade-in z-50 overflow-hidden" style={{ background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {/* User Info */}
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center overflow-hidden">
                            {user.avatar ? (
                              <img
                                src={user.avatar}
                                alt={user.username}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {user.username}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="py-1">
                        <DropdownItem
                          icon={<User className="h-4 w-4" />}
                          label="Profile"
                          href="/account"
                          onClick={() => setUserDropdownOpen(false)}
                        />
                        <DropdownItem
                          icon={<Settings className="h-4 w-4" />}
                          label="Settings"
                          href="/settings"
                          onClick={() => setUserDropdownOpen(false)}
                        />
                        <DropdownItem
                          icon={<Ticket className="h-4 w-4" />}
                          label="My Bets"
                          href="/bets"
                          onClick={() => setUserDropdownOpen(false)}
                        />
                        <DropdownItem
                          icon={<Crown className="h-4 w-4" />}
                          label="VIP"
                          href="/rewards"
                          onClick={() => setUserDropdownOpen(false)}
                        />
                        <button
                          onClick={() => { setUserDropdownOpen(false); setWalletModalOpen(true); }}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors duration-200 w-full text-left"
                        >
                          <span className="text-gray-400"><Wallet className="h-4 w-4" /></span>
                          Wallet
                        </button>
                      </div>

                      <div className="py-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors duration-200"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Not authenticated: Login + Register */
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/login')}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  Log in
                </button>
                <button
                  onClick={() => router.push('/register')}
                  className="h-9 px-5 rounded-lg text-sm font-bold text-white transition-all duration-200 active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                    boxShadow: '0 2px 12px rgba(34,197,94,0.25)',
                  }}
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* MOBILE HEADER (below lg) - Cloudbet compact design                 */}
      {/* ================================================================== */}
      <header className="sticky top-0 z-50 lg:hidden">
        {/* ----- Top Bar (compact ~52px) ----- */}
        <div className="h-[52px] flex items-center justify-between px-3" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)' }}>
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 px-1">
            <CloudbetLogo />
            <span className="text-sm font-bold text-white tracking-wide">
              C<span className="text-accent-light">B</span>
            </span>
          </Link>

          {/* Center: Balance (for authenticated users) */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1.5 mx-2">
              {/* Search icon */}
              <button
                onClick={() => setSearchExpanded(!searchExpanded)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Balance pill */}
              <div className="relative" ref={mobileCurrencyDropdownRef}>
                <button
                  onClick={() => setMobileCurrencyDropdownOpen(!mobileCurrencyDropdownOpen)}
                  className="flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                >
                  <CurrencyIcon
                    currency={primaryBalance?.currency || 'USDT'}
                    size={16}
                  />
                  <span className="font-mono text-xs font-semibold text-white tabular-nums">
                    {primaryBalance
                      ? formatCurrency(primaryBalance.available, primaryBalance.currency, {
                          showSymbol: false,
                        })
                      : '0.00'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 text-gray-400 transition-transform duration-200',
                      mobileCurrencyDropdownOpen && 'rotate-180',
                    )}
                  />
                </button>

                {/* Mobile Currency Dropdown */}
                {mobileCurrencyDropdownOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 rounded-xl shadow-2xl py-0 animate-fade-in z-50 overflow-hidden" style={{ background: '#1e1e3a', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Active Balance
                      </p>
                    </div>
                    {primaryBalance && (
                      <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <CurrencyIcon currency={primaryBalance.currency} size={22} />
                        <span className="text-white font-medium text-sm flex-1">{primaryBalance.currency}</span>
                        <span className="font-mono text-sm text-white font-semibold">
                          {formatCurrency(primaryBalance.available, primaryBalance.currency, { showSymbol: false })}
                        </span>
                      </div>
                    )}
                    <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Available Balances
                      </p>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {fundedBalances.map((b) => (
                        <button
                          key={b.currency}
                          onClick={() => handleSelectCurrency(b.currency)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150',
                            b.currency === primaryBalance?.currency
                              ? 'bg-accent/10'
                              : 'hover:bg-white/5',
                          )}
                        >
                          <CurrencyIcon currency={b.currency} size={20} />
                          <div className="flex-1 text-left">
                            <span className="font-medium text-white text-sm">
                              {b.currency}
                            </span>
                          </div>
                          <span className="font-mono text-sm text-gray-300">
                            {formatCurrency(b.available, b.currency, {
                              showSymbol: false,
                            })}
                          </span>
                          {b.currency === primaryBalance?.currency && (
                            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                          )}
                        </button>
                      ))}
                      {fundedBalances.length === 0 && (
                        <div className="px-4 py-4 text-center text-xs text-gray-500">
                          No funded currencies. Deposit to get started.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Add funds "+" button - Opens Wallet Modal */}
              <button
                onClick={() => setWalletModalOpen(true)}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                  boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
                }}
              >
                <Plus className="h-4 w-4 text-white" strokeWidth={3} />
              </button>
            </div>
          ) : (
            /* Non-authenticated: compact sign in / sign up */
            <div className="flex items-center gap-1.5 mx-2">
              <button
                onClick={() => router.push('/login')}
                className="h-7 px-3 text-xs font-semibold text-gray-300 hover:text-white rounded-md hover:bg-white/5 transition-all duration-200"
              >
                Log in
              </button>
              <button
                onClick={() => router.push('/register')}
                className="h-7 px-3 text-xs font-bold text-white rounded-md transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }}
              >
                Register
              </button>
            </div>
          )}

          {/* Right: Action icons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {isAuthenticated && (
              <>
                {/* Notifications (Bell) */}
                <button
                  onClick={handleToggleNotifications}
                  className={cn(
                    'relative h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200',
                    notificationsOpen && 'text-white bg-white/10',
                  )}
                >
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white" style={{ boxShadow: '0 0 0 2px #1a1a2e' }}>
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* Hamburger / Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* ----- Mobile Navigation Row: Sports | Casino | Esports icons ----- */}
        <div
          ref={mobileNavRef}
          className="h-12 flex items-center justify-center gap-2 px-4"
          style={{ background: '#14142a', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          {MOBILE_NAV_TABS.map((tab) => {
            const active = isActiveRoute(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all duration-200 flex-1 max-w-[100px]',
                  active
                    ? 'bg-accent/15 text-white'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <span className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200',
                  active
                    ? 'bg-accent text-white shadow-md shadow-accent/30'
                    : 'text-gray-500',
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className={cn(
                  'text-[10px] font-semibold',
                  active ? 'text-white' : 'text-gray-500',
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ----- Mobile Expanded Search (slides down when triggered) ----- */}
        {searchExpanded && (
          <div className="px-3 py-2 animate-fade-in" style={{ background: '#14142a', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white/5 border border-white/10">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search events, teams..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none font-sans"
                autoFocus
                onBlur={() => setSearchExpanded(false)}
              />
            </div>
          </div>
        )}

        {/* ----- Mobile Slide-out Menu (profile, settings, etc.) ----- */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Panel */}
            <div
              className="absolute right-0 top-0 bottom-0 w-72 flex flex-col shadow-2xl"
              style={{
                background: 'linear-gradient(180deg, #1a1a2e 0%, #141428 100%)',
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                animation: 'slideInRight 0.25s ease-out',
              }}
            >
              {/* Panel Header */}
              <div className="h-[52px] flex items-center justify-between px-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-sm font-semibold text-white">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* User Info (if authenticated) */}
              {isAuthenticated && user && (
                <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-accent to-purple-700 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white/10">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {user.username}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Balance in menu */}
                  {primaryBalance && (
                    <div className="mt-3 flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/8">
                      <CurrencyIcon
                        currency={primaryBalance.currency}
                        size={22}
                      />
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Balance</p>
                        <p className="font-mono text-sm font-bold text-white">
                          {formatCurrency(primaryBalance.available, primaryBalance.currency, {
                            showSymbol: false,
                          })}{' '}
                          <span className="text-gray-400 text-xs font-sans font-normal">
                            {primaryBalance.currency}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto py-2">
                {isAuthenticated && user ? (
                  <>
                    <MobileMenuItem
                      icon={<User className="h-4 w-4" />}
                      label="Profile"
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                    />
                    <button
                      onClick={() => { setMobileMenuOpen(false); setWalletModalOpen(true); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors duration-200 w-full text-left"
                    >
                      <span className="shrink-0 text-gray-500"><Wallet className="h-4 w-4" /></span>
                      Wallet
                    </button>
                    <MobileMenuItem
                      icon={<Ticket className="h-4 w-4" />}
                      label="My Bets"
                      href="/bets"
                      onClick={() => setMobileMenuOpen(false)}
                    />
                    <MobileMenuItem
                      icon={<Gift className="h-4 w-4" />}
                      label="Rewards"
                      href="/rewards"
                      onClick={() => setMobileMenuOpen(false)}
                      accent
                    />
                    <MobileMenuItem
                      icon={<Crown className="h-4 w-4" />}
                      label="VIP"
                      href="/rewards"
                      onClick={() => setMobileMenuOpen(false)}
                      accent
                    />
                    <MobileMenuItem
                      icon={<Settings className="h-4 w-4" />}
                      label="Settings"
                      href="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                    />

                    <div className="mx-4 my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors duration-200"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    {/* Navigation for non-authenticated */}
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-200',
                            isActiveRoute(item.href)
                              ? 'text-white bg-accent/10'
                              : 'text-gray-400 hover:text-white hover:bg-white/5',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}

                    <div className="mx-4 my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                    <div className="px-4 py-2 space-y-2">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          router.push('/register');
                        }}
                        className="w-full h-10 rounded-lg text-sm font-bold text-white transition-all duration-200"
                        style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' }}
                      >
                        Register
                      </button>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          router.push('/login');
                        }}
                        className="w-full h-10 rounded-lg text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
                      >
                        Log in
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ================================================================== */}
      {/* GLOBAL: Inline keyframes for mobile slide-in animation             */}
      {/* ================================================================== */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}} />

      {/* Wallet Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Mobile Menu Item
// ---------------------------------------------------------------------------

function MobileMenuItem({
  icon,
  label,
  href,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-200',
        accent
          ? 'text-yellow-400 hover:bg-white/5'
          : 'text-gray-300 hover:text-white hover:bg-white/5',
      )}
    >
      <span className={cn('shrink-0', accent ? 'text-yellow-400' : 'text-gray-500')}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Desktop Dropdown Item
// ---------------------------------------------------------------------------

function DropdownItem({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors duration-200"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  );
}
