'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Radio, Dice5, Ticket } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TabItem {
  key: string;
  label: string;
  href: string;
  icon: typeof Trophy;
}

// ---------------------------------------------------------------------------
// Tabs configuration - 4 tabs only: Sports, Live, Casino, Bet Slip
// ---------------------------------------------------------------------------

const TABS: TabItem[] = [
  { key: 'sports', label: 'Sports', href: '/sports', icon: Trophy },
  { key: 'live', label: 'Live', href: '/sports/live', icon: Radio },
  { key: 'casino', label: 'Casino', href: '/casino', icon: Dice5 },
  { key: 'bet-slip', label: 'Bet Slip', href: '/my-bets', icon: Ticket },
];

// ---------------------------------------------------------------------------
// Component - VERY subtle, minimal bottom bar
// ---------------------------------------------------------------------------

export function BottomNav() {
  const pathname = usePathname();
  const itemCount = useBetSlipStore((s) => s.getItemCount());

  const isActive = useCallback((tab: TabItem): boolean => {
    if (!tab.href) return false;

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
        height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: '#111214',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex items-stretch justify-around h-[52px]">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          const isBetSlip = tab.key === 'bet-slip';

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-col items-center justify-center flex-1 min-w-0 transition-transform duration-100 active:scale-95"
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Icon container */}
              <div className="relative flex items-center justify-center mb-0.5">
                <Icon
                  className="transition-colors duration-200"
                  style={{
                    width: '20px',
                    height: '20px',
                    strokeWidth: 1.8,
                    color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                  }}
                />

                {/* Bet Slip badge - small purple circle with white number */}
                {isBetSlip && itemCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 flex items-center justify-center font-bold leading-none text-white rounded-full"
                    style={{
                      minWidth: '16px',
                      height: '16px',
                      paddingLeft: '3px',
                      paddingRight: '3px',
                      fontSize: '9px',
                      backgroundColor: '#8B5CF6',
                      boxShadow: '0 0 0 1.5px #111214',
                    }}
                  >
                    {itemCount > 99 ? '99' : itemCount}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className="font-medium leading-none transition-colors duration-200"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.03em',
                  color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                }}
              >
                {tab.label}
              </span>

              {/* Active indicator - small 2px purple dot below icon */}
              {active && (
                <div
                  className="absolute"
                  style={{
                    bottom: '6px',
                    width: '2px',
                    height: '2px',
                    borderRadius: '50%',
                    backgroundColor: '#8B5CF6',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
