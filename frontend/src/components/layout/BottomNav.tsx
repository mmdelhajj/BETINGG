'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Zap, Dice5, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBetSlipStore, selectSelectionCount } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// BottomNav -- Cloudbet-style fixed bottom navigation bar (mobile only)
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  matchPaths?: string[];
  isLive?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: <Home className="h-5 w-5" />,
    matchPaths: ['/'],
  },
  {
    label: 'Sports',
    href: '/sports',
    icon: <Trophy className="h-5 w-5" />,
    matchPaths: ['/sports', '/event'],
  },
  {
    label: 'Live',
    href: '/live',
    icon: <Zap className="h-5 w-5" />,
    matchPaths: ['/live'],
    isLive: true,
  },
  {
    label: 'Casino',
    href: '/casino',
    icon: <Dice5 className="h-5 w-5" />,
    matchPaths: ['/casino', '/games'],
  },
  {
    label: 'Bets',
    href: '#bets',
    icon: <Ticket className="h-5 w-5" />,
    matchPaths: [],
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const selectionCount = useBetSlipStore(selectSelectionCount);
  const toggleOpen = useBetSlipStore((state) => state.toggleOpen);

  // Hide on admin pages, auth pages, etc.
  const hiddenPaths = ['/admin', '/login', '/register', '/forgot-password', '/reset-password'];
  const shouldHide = hiddenPaths.some(
    (p) => pathname === p || pathname?.startsWith(p + '/'),
  );

  if (shouldHide) return null;

  const isActive = (item: NavItem) => {
    if (item.href === '/') return pathname === '/';
    return item.matchPaths?.some(
      (p) => pathname === p || pathname?.startsWith(p + '/'),
    );
  };

  const hasSelections = selectionCount > 0;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Navigation bar */}
      <nav className="bg-[#0D1117] border-t border-[#1E2430] px-1 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-[60px]">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const isBets = item.label === 'Bets';

            // For the Bets tab, toggle the betslip instead of navigating
            if (isBets) {
              return (
                <button
                  key={item.label}
                  onClick={toggleOpen}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 transition-all duration-200',
                    hasSelections ? 'text-[#8B5CF6]' : 'text-[#6B7280]',
                  )}
                >
                  <div className="relative">
                    {item.icon}
                    {/* Selection count badge */}
                    {hasSelections && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-[#8B5CF6] text-white text-[9px] font-bold rounded-full px-1">
                        {selectionCount}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium',
                    hasSelections ? 'text-[#8B5CF6]' : 'text-[#6B7280]',
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 w-16 py-1 transition-all duration-200',
                  active ? 'text-white' : 'text-[#6B7280]',
                )}
              >
                <div className="relative">
                  {item.icon}

                  {/* Live pulsing dot */}
                  {item.isLive && (
                    <span className="absolute -top-0.5 -right-0.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                    </span>
                  )}
                </div>

                <span className={cn(
                  'text-[10px] font-medium',
                  active ? 'text-white' : 'text-[#6B7280]',
                )}>
                  {item.label}
                </span>

                {/* Active indicator line */}
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#8B5CF6]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
