'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useBetSlipStore, selectSelectionCount } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// BottomNav -- Cloudbet-style floating "My bets" pill button (mobile only)
//
// Replaces the traditional 5-tab bottom bar. Primary navigation (Home, Sports,
// Live, Casino) is now handled by Header tabs. This component renders only a
// centered floating pill that opens the betslip.
// ---------------------------------------------------------------------------

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

  return (
    <div className="md:hidden fixed bottom-[20px] left-1/2 -translate-x-1/2 z-50">
      <button
        onClick={toggleOpen}
        className="
          relative flex items-center gap-2.5
          px-5 py-2.5
          rounded-full
          border border-[#8B5CF6]
          text-white text-sm font-medium
          transition-all duration-200
          active:scale-95
        "
        style={{
          background: 'rgba(20, 20, 40, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.25), 0 4px 12px rgba(0, 0, 0, 0.4)',
        }}
        aria-label={`My bets (${selectionCount} selections)`}
      >
        {/* Bet count badge */}
        <span
          className="
            inline-flex items-center justify-center
            min-w-[18px] h-[18px]
            bg-purple-600 text-white
            text-[11px] font-bold leading-none
            rounded-full px-1
          "
        >
          {selectionCount}
        </span>

        {/* Label */}
        <span className="whitespace-nowrap">My bets</span>
      </button>
    </div>
  );
}
