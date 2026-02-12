'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSportsStore } from '@/stores/sportsStore';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { SportIcon } from '@/components/sports/SportIcon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MergedSport {
  slug: string;
  name: string;
  emoji: string;
  popular?: boolean;
  id: string;
  liveCount: number;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Static sports list matching Cloudbet's real sidebar structure.
 * Popular sports shown first, then all sports alphabetically.
 */
const ALL_SPORTS: { slug: string; name: string; emoji: string; popular?: boolean }[] = [
  { slug: 'football', name: 'Soccer', emoji: '⚽', popular: true },
  { slug: 'basketball', name: 'Basketball', emoji: '🏀', popular: true },
  { slug: 'tennis', name: 'Tennis', emoji: '🎾', popular: true },
  { slug: 'american-football', name: 'American Football', emoji: '🏈', popular: true },
  { slug: 'baseball', name: 'Baseball', emoji: '⚾', popular: true },
  { slug: 'ice-hockey', name: 'Ice Hockey', emoji: '🏒', popular: true },
  { slug: 'mma', name: 'MMA', emoji: '🥊' },
  { slug: 'boxing', name: 'Boxing', emoji: '🥊' },
  { slug: 'cricket', name: 'Cricket', emoji: '🏏' },
  { slug: 'rugby-union', name: 'Rugby', emoji: '🏉' },
  { slug: 'golf', name: 'Golf', emoji: '⛳' },
  { slug: 'darts', name: 'Darts', emoji: '🎯' },
  { slug: 'table-tennis', name: 'Table Tennis', emoji: '🏓' },
  { slug: 'volleyball', name: 'Volleyball', emoji: '🏐' },
  { slug: 'handball', name: 'Handball', emoji: '🤾' },
  { slug: 'cs2', name: 'Counter-Strike', emoji: '🎮' },
  { slug: 'dota-2', name: 'Dota 2', emoji: '⚔️' },
  { slug: 'league-of-legends', name: 'League of Legends', emoji: '👑' },
  { slug: 'valorant', name: 'Valorant', emoji: '🔫' },
  { slug: 'horse-racing', name: 'Horse Racing', emoji: '🏇' },
  { slug: 'greyhound-racing', name: 'Greyhound Racing', emoji: '🐕' },
  { slug: 'snooker', name: 'Snooker', emoji: '🎱' },
  { slug: 'badminton', name: 'Badminton', emoji: '🏸' },
  { slug: 'futsal', name: 'Futsal', emoji: '⚽' },
  { slug: 'politics', name: 'Politics', emoji: '🏛️' },
  { slug: 'entertainment', name: 'Entertainment', emoji: '🎬' },
];

// ---------------------------------------------------------------------------
// Mobile drawer hook
// ---------------------------------------------------------------------------

function useMobileDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return { isOpen, open, close, toggle };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Divider() {
  return (
    <div
      className="mx-3 my-2"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-2 text-[11px] font-bold uppercase select-none tracking-widest" style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SportsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sports, isLoading } = useSportsStore();
  const drawer = useMobileDrawer();

  // ---- Build a lookup map: slug -> Sport from the store ----
  const sportBySlug = useMemo(() => {
    const map: Record<string, (typeof sports)[0]> = {};
    for (const s of sports) {
      map[s.slug] = s;
    }
    return map;
  }, [sports]);

  // ---- Merge static list with store data ----
  const mergedSports = useMemo(() => {
    return ALL_SPORTS.map((item) => {
      const stored = sportBySlug[item.slug];
      return {
        slug: item.slug,
        name: item.name,
        emoji: item.emoji,
        popular: item.popular,
        id: stored?.id ?? item.slug,
        liveCount: stored?.liveCount ?? 0,
        eventCount: stored?.eventCount ?? 0,
      };
    });
  }, [sportBySlug]);

  // ---- Popular sports (shown first) ----
  const popularSports = useMemo(
    () => mergedSports.filter((s) => s.popular),
    [mergedSports]
  );

  // ---- All sports (alphabetically sorted, excluding popular) ----
  const allSportsAlphabetical = useMemo(
    () =>
      mergedSports
        .filter((s) => !s.popular)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [mergedSports]
  );

  // ---- Close drawer on navigation ----
  useEffect(() => {
    drawer.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ---- Navigate to sport and close drawer on mobile ----
  const handleSportClick = useCallback(
    (slug: string) => {
      router.push(`/sports/${slug}`);
      drawer.close();
    },
    [router, drawer]
  );

  // ---------------------------------------------------------------------------
  // Sport row - Clean Cloudbet style
  // ---------------------------------------------------------------------------

  const SportRow = ({ sport }: { sport: MergedSport }) => {
    const href = `/sports/${sport.slug}`;
    const isActive = pathname === href;
    const hasLive = sport.liveCount > 0;
    const eventCount = sport.eventCount ?? 0;

    return (
      <button
        onClick={() => handleSportClick(sport.slug)}
        className={cn(
          'relative flex items-center gap-3 px-3 w-full text-left transition-all duration-200',
          'h-[40px]',
          isActive
            ? 'bg-[rgba(141,82,218,0.1)] text-white'
            : 'text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'
        )}
      >
        {/* Active indicator - 2px purple left border */}
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#8d52da]" />
        )}

        {/* Sport icon - 16px */}
        <div className="shrink-0">
          <SportIcon slug={sport.slug} size={16} emoji={sport.emoji} />
        </div>

        {/* Sport name - 14px */}
        <span className="flex-1 text-[14px] font-normal truncate">{sport.name}</span>

        {/* Live indicator dot */}
        {hasLive && (
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        )}

        {/* Event count */}
        {eventCount > 0 && (
          <span className="text-[12px] text-[rgba(255,255,255,0.4)] font-normal tabular-nums shrink-0">
            {eventCount}
          </span>
        )}
      </button>
    );
  };

  // ---------------------------------------------------------------------------
  // Bottom links - Refer & Earn, Promotions
  // ---------------------------------------------------------------------------

  const BottomLinks = () => (
    <div className="px-3 py-4 space-y-1 border-t border-[rgba(255,255,255,0.06)]">
      <button
        onClick={() => router.push('/referrals')}
        className="flex items-center gap-3 px-3 w-full text-left h-[40px] text-[14px] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white transition-all duration-200"
      >
        <span>🎁</span>
        <span>Refer & Earn</span>
      </button>
      <button
        onClick={() => router.push('/promotions')}
        className="flex items-center gap-3 px-3 w-full text-left h-[40px] text-[14px] text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white transition-all duration-200"
      >
        <span>🎉</span>
        <span>Promotions</span>
      </button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Scrollable content with thin scrollbar
  // ---------------------------------------------------------------------------

  const ScrollContent = () => (
    <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {/* Loading state - skeleton rows */}
      {isLoading && (
        <div className="px-3 space-y-1 mt-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-[40px] rounded bg-white/[0.02] animate-pulse"
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      )}

      {/* Sports list */}
      {!isLoading && (
        <>
          {/* SPORTS label - 11px, uppercase, tracking-widest, muted */}
          <SectionLabel>SPORTS</SectionLabel>

          {/* Popular sports */}
          {popularSports.map((sport) => (
            <SportRow key={sport.slug} sport={sport} />
          ))}

          {/* Divider between popular and all sports */}
          <Divider />

          {/* ALL SPORTS label */}
          <SectionLabel>ALL SPORTS</SectionLabel>

          {/* Alphabetical sports */}
          {allSportsAlphabetical.map((sport) => (
            <SportRow key={sport.slug} sport={sport} />
          ))}
        </>
      )}

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Mobile backdrop overlay - rgba(0,0,0,0.5)                          */}
      {/* ------------------------------------------------------------------ */}
      {drawer.isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={drawer.close}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Mobile drawer (< lg) - max-width min(85vw, 300px)                 */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={cn(
          'fixed z-50 h-full flex flex-col lg:hidden',
          'shadow-2xl transition-transform duration-200 ease-out',
          drawer.isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          top: 0,
          left: 0,
          bottom: 0,
          backgroundColor: '#111214',
          width: 'min(85vw, 300px)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        {/* Header on mobile - logo + close X button */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-[16px]">C</span>
            </div>
            <span className="text-[17px] font-bold text-white tracking-tight">
              CryptoBet
            </span>
          </div>
          <button
            onClick={drawer.close}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScrollContent />
        <BottomLinks />
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop sidebar (>= lg) - fixed 220px, top-[60px], bottom-0       */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={cn(
          'hidden lg:flex flex-col',
          'fixed left-0 top-[60px] bottom-0 z-30',
          'w-[220px]',
          'border-r border-[rgba(255,255,255,0.06)]'
        )}
        style={{
          backgroundColor: '#111214',
        }}
      >
        <ScrollContent />
        <BottomLinks />
      </aside>
    </>
  );
}
