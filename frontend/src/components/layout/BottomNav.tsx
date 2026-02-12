'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Radio, Dice5, Ticket } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TabItem {
  key: string;
  label: string;
  href: string;
  icon: typeof Home;
}

// ---------------------------------------------------------------------------
// Tabs configuration
// ---------------------------------------------------------------------------

const TABS: TabItem[] = [
  { key: 'home', label: 'Home', href: '/', icon: Home },
  { key: 'sports', label: 'Sports', href: '/sports', icon: Trophy },
  { key: 'live', label: 'Live', href: '/sports/live', icon: Radio },
  { key: 'casino', label: 'Casino', href: '/casino', icon: Dice5 },
  { key: 'my-bets', label: 'My Bets', href: '/my-bets', icon: Ticket },
];

// ---------------------------------------------------------------------------
// Colors - Professional Cloudbet/bet365 style
// ---------------------------------------------------------------------------

const ACTIVE_COLOR = '#BFFF00'; // Lime/green for active state
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.45)'; // Muted gray for inactive

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BottomNav() {
  const pathname = usePathname();
  const itemCount = useBetSlipStore((s) => s.getItemCount());

  const isActive = useCallback((tab: TabItem): boolean => {
    if (!tab.href) return false;

    // Exact match for home
    if (tab.key === 'home') {
      return pathname === '/';
    }

    // Live tab matching
    if (tab.key === 'live') {
      return pathname === '/sports/live' || pathname?.startsWith('/sports/live/');
    }

    // Sports tab matching (but not live)
    if (tab.key === 'sports') {
      return (
        pathname === '/sports' ||
        (pathname?.startsWith('/sports/') === true && !pathname?.startsWith('/sports/live'))
      );
    }

    // Default matching for other tabs
    return pathname === tab.href || pathname?.startsWith(tab.href + '/') === true;
  }, [pathname]);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[999]"
      style={{
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: 'rgba(15, 15, 18, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex items-stretch justify-around h-[56px]">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
          const isLive = tab.key === 'live';
          const isMyBets = tab.key === 'my-bets';

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-col items-center justify-center flex-1 min-w-0 transition-colors duration-200 active:scale-95"
              style={{
                minHeight: '44px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Icon container */}
              <div className="relative flex items-center justify-center mb-1">
                <Icon
                  className="transition-all duration-200"
                  style={{
                    width: '24px',
                    height: '24px',
                    strokeWidth: active ? 2.2 : 1.8,
                    color: color,
                  }}
                />

                {/* Live indicator - red dot */}
                {isLive && (
                  <span
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center"
                    style={{
                      width: '8px',
                      height: '8px',
                    }}
                  >
                    <span
                      className="absolute w-full h-full rounded-full"
                      style={{
                        backgroundColor: '#EF4444',
                      }}
                    />
                    <span
                      className="absolute w-full h-full rounded-full animate-ping"
                      style={{
                        backgroundColor: '#EF4444',
                        opacity: 0.75,
                      }}
                    />
                  </span>
                )}

                {/* My Bets badge - contained within tab */}
                {isMyBets && itemCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 flex items-center justify-center font-bold leading-none text-black rounded-full"
                    style={{
                      minWidth: '18px',
                      height: '18px',
                      paddingLeft: '4px',
                      paddingRight: '4px',
                      fontSize: '10px',
                      backgroundColor: ACTIVE_COLOR,
                      boxShadow: '0 0 0 2px rgba(15, 15, 18, 0.95)',
                    }}
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className="font-medium leading-none transition-colors duration-200"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.01em',
                  color: color,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
