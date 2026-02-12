'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Radio, Dice5, Ticket, Menu, X } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TabItem {
  key: string;
  label: string;
  href?: string;
  icon: typeof Trophy;
  /** If true, this tab triggers an action instead of navigating */
  isAction?: boolean;
}

// ---------------------------------------------------------------------------
// Tabs configuration
// ---------------------------------------------------------------------------

const TABS: TabItem[] = [
  { key: 'sports', label: 'Sports', href: '/sports', icon: Trophy },
  { key: 'live', label: 'Live', href: '/sports/live', icon: Radio },
  { key: 'casino', label: 'Casino', href: '/casino', icon: Dice5 },
  { key: 'my-bets', label: 'My Bets', href: '/my-bets', icon: Ticket },
  { key: 'menu', label: 'Menu', icon: Menu, isAction: true },
];

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const ACTIVE_COLOR = '#8D52DA';
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.6)';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BottomNav() {
  const pathname = usePathname();
  const itemCount = useBetSlipStore((s) => s.getItemCount());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const isActive = (tab: TabItem): boolean => {
    if (tab.isAction) return sidebarOpen;
    if (!tab.href) return false;
    if (tab.key === 'live') {
      return pathname === '/sports/live' || pathname?.startsWith('/sports/live/');
    }
    if (tab.key === 'sports') {
      return (
        pathname === '/sports' ||
        (pathname?.startsWith('/sports/') === true && !pathname?.startsWith('/sports/live'))
      );
    }
    return pathname === tab.href || pathname?.startsWith(tab.href + '/') === true;
  };

  return (
    <>
      {/* ── Mobile Sidebar Overlay ─────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0"
          style={{ zIndex: 998 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar panel */}
          <div
            className="absolute top-0 right-0 bottom-0 w-[280px] overflow-y-auto"
            style={{ backgroundColor: '#111214' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 h-14 shrink-0"
              style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
            >
              <span className="text-[15px] font-semibold text-white">Menu</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="py-2">
              {[
                { label: 'Sports', href: '/sports' },
                { label: 'Live Betting', href: '/sports/live' },
                { label: 'Casino', href: '/casino' },
                { label: 'My Bets', href: '/my-bets' },
                { label: 'Promotions', href: '/promotions' },
                { label: 'Referrals', href: '/referrals' },
                { label: 'Academy', href: '/academy' },
                { label: 'Support', href: '/support' },
              ].map((link) => {
                const linkActive = pathname === link.href || pathname?.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center px-4 py-3 text-[15px] transition-colors"
                    style={{
                      color: linkActive ? ACTIVE_COLOR : 'rgba(255, 255, 255, 0.8)',
                      backgroundColor: linkActive ? 'rgba(141, 82, 218, 0.08)' : 'transparent',
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* ── Bottom Navigation Bar ──────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0"
        style={{
          height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backgroundColor: '#1A1B1F',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 999,
        }}
      >
        <div className="flex items-center justify-around h-[56px]">
          {TABS.map((tab) => {
            const active = isActive(tab);
            const Icon = tab.icon;
            const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;

            // Live tab gets a pulsing red dot instead of the standard icon
            const isLive = tab.key === 'live';
            const isMyBets = tab.key === 'my-bets';

            const content = (
              <div
                className="relative flex flex-col items-center justify-center gap-[2px] flex-1 h-full"
                style={{ color }}
              >
                <div className="relative flex items-center justify-center w-6 h-6">
                  {isLive ? (
                    <>
                      <Radio className="w-6 h-6" strokeWidth={active ? 2.2 : 1.8} />
                      {/* Red pulsing dot */}
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                        style={{ backgroundColor: '#EF4444' }}
                      >
                        <span
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ backgroundColor: '#EF4444', opacity: 0.75 }}
                        />
                      </span>
                    </>
                  ) : (
                    <Icon className="w-6 h-6" strokeWidth={active ? 2.2 : 1.8} />
                  )}

                  {/* Bet count badge on My Bets */}
                  {isMyBets && itemCount > 0 && (
                    <span
                      className="absolute -top-1 -right-2.5 min-w-[16px] h-[16px] px-[4px] text-[10px] font-bold rounded-full flex items-center justify-center text-white leading-none"
                      style={{ backgroundColor: ACTIVE_COLOR }}
                    >
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </div>

                <span
                  className="font-medium leading-none"
                  style={{ fontSize: 11, color }}
                >
                  {tab.label}
                </span>
              </div>
            );

            if (tab.isAction) {
              return (
                <button
                  key={tab.key}
                  onClick={toggleSidebar}
                  className="flex-1 h-full appearance-none bg-transparent border-none cursor-pointer"
                  aria-label="Toggle menu"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={tab.key}
                href={tab.href!}
                className="flex-1 h-full"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
