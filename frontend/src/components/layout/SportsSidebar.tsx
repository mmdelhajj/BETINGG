'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSportsStore } from '@/stores/sportsStore';
import { cn } from '@/lib/utils';
import {
  Star,
  X,
  Menu,
  Search,
  Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SportIcon } from '@/components/sports/SportIcon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SportsTab = 'all' | 'live' | 'favorites';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAVORITES_STORAGE_KEY = 'cryptobet_favorites';
const DIVIDER_COLOR = 'rgba(255, 255, 255, 0.06)';

/**
 * Static sports list with slug, display name, and emoji fallback.
 * Merged with live data from store.
 */
const ALL_SPORTS: { slug: string; name: string; emoji: string; popular?: boolean }[] = [
  { slug: 'football', name: 'Soccer', emoji: '\u26BD', popular: true },
  { slug: 'basketball', name: 'Basketball', emoji: '\uD83C\uDFC0', popular: true },
  { slug: 'tennis', name: 'Tennis', emoji: '\uD83C\uDFBE', popular: true },
  { slug: 'american-football', name: 'American Football', emoji: '\uD83C\uDFC8', popular: true },
  { slug: 'baseball', name: 'Baseball', emoji: '\u26BE', popular: true },
  { slug: 'ice-hockey', name: 'Ice Hockey', emoji: '\uD83C\uDFD2', popular: true },
  { slug: 'mma', name: 'MMA', emoji: '\uD83E\uDD4A' },
  { slug: 'boxing', name: 'Boxing', emoji: '\uD83E\uDD4A' },
  { slug: 'cricket', name: 'Cricket', emoji: '\uD83C\uDFCF' },
  { slug: 'rugby-union', name: 'Rugby', emoji: '\uD83C\uDFC9' },
  { slug: 'golf', name: 'Golf', emoji: '\u26F3' },
  { slug: 'darts', name: 'Darts', emoji: '\uD83C\uDFAF' },
  { slug: 'table-tennis', name: 'Table Tennis', emoji: '\uD83C\uDFD3' },
  { slug: 'volleyball', name: 'Volleyball', emoji: '\uD83C\uDFD0' },
  { slug: 'handball', name: 'Handball', emoji: '\uD83E\uDD3E' },
  { slug: 'cs2', name: 'Counter-Strike', emoji: '\uD83C\uDFAE' },
  { slug: 'dota-2', name: 'Dota 2', emoji: '\u2694\uFE0F' },
  { slug: 'league-of-legends', name: 'League of Legends', emoji: '\uD83D\uDC51' },
  { slug: 'valorant', name: 'Valorant', emoji: '\uD83D\uDD2B' },
  { slug: 'horse-racing', name: 'Horse Racing', emoji: '\uD83C\uDFC7' },
  { slug: 'greyhound-racing', name: 'Greyhound Racing', emoji: '\uD83D\uDC15' },
  { slug: 'snooker', name: 'Snooker', emoji: '\uD83C\uDFB1' },
  { slug: 'badminton', name: 'Badminton', emoji: '\uD83C\uDFF8' },
  { slug: 'futsal', name: 'Futsal', emoji: '\u26BD' },
  { slug: 'politics', name: 'Politics', emoji: '\uD83C\uDFDB\uFE0F' },
  { slug: 'entertainment', name: 'Entertainment', emoji: '\uD83C\uDFAC' },
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
  return <div className="mx-4 my-2" style={{ borderBottom: `1px solid ${DIVIDER_COLOR}` }} />;
}

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider select-none">
      {icon}
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

  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState<SportsTab>('all');

  // ---- Search state ----
  const [searchQuery, setSearchQuery] = useState('');

  // ---- Favorites state (persisted) ----
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

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

  // ---- Popular sports ----
  const popularSports = useMemo(
    () => mergedSports.filter((s) => s.popular),
    [mergedSports]
  );

  // ---- All sports (alphabetically sorted) ----
  const allSportsAlphabetical = useMemo(
    () => [...mergedSports].sort((a, b) => a.name.localeCompare(b.name)),
    [mergedSports]
  );

  // ---- Live sports ----
  const liveSports = useMemo(
    () => mergedSports.filter((s) => s.liveCount > 0).sort((a, b) => b.liveCount - a.liveCount),
    [mergedSports]
  );

  // ---- Favorite sports ----
  const favoriteSports = useMemo(
    () => mergedSports.filter((s) => favorites.includes(s.id)),
    [mergedSports, favorites]
  );

  // ---- Filtered sports based on search ----
  const filteredSports = useMemo(() => {
    if (!searchQuery.trim()) {
      return activeTab === 'all'
        ? allSportsAlphabetical
        : activeTab === 'live'
        ? liveSports
        : favoriteSports;
    }

    const query = searchQuery.toLowerCase();
    const baseList =
      activeTab === 'all'
        ? allSportsAlphabetical
        : activeTab === 'live'
        ? liveSports
        : favoriteSports;

    return baseList.filter((s) => s.name.toLowerCase().includes(query));
  }, [searchQuery, activeTab, allSportsAlphabetical, liveSports, favoriteSports]);

  // ---- Persist favorites ----
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // ---- Close drawer on navigation ----
  useEffect(() => {
    drawer.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ---- Toggle favorite ----
  const toggleFavorite = useCallback((e: React.MouseEvent, sportId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(sportId) ? prev.filter((id) => id !== sportId) : [...prev, sportId]
    );
  }, []);

  // ---- Navigate to sport and close drawer on mobile ----
  const handleSportClick = useCallback(
    (slug: string) => {
      router.push(`/sports/${slug}`);
      drawer.close();
    },
    [router, drawer]
  );

  // ---------------------------------------------------------------------------
  // Sport row
  // ---------------------------------------------------------------------------

  const SportRow = ({
    sport,
    isFavorite,
  }: {
    sport: (typeof mergedSports)[0];
    isFavorite?: boolean;
  }) => {
    const href = `/sports/${sport.slug}`;
    const isActive = pathname === href;
    const hasLive = (sport.liveCount ?? 0) > 0;
    const eventCount = sport.eventCount ?? 0;

    return (
      <button
        onClick={() => handleSportClick(sport.slug)}
        className={cn(
          'flex items-center gap-3 px-4 w-full text-left transition-colors group',
          // 44px minimum touch target height
          'min-h-[44px] py-2',
          isActive
            ? 'bg-white/[0.08] text-white'
            : 'text-gray-300 hover:bg-white/[0.04] active:bg-white/[0.06]'
        )}
      >
        {/* Sport icon */}
        <div className="shrink-0">
          <SportIcon slug={sport.slug} size={18} emoji={sport.emoji} />
        </div>

        {/* Sport name */}
        <span className="flex-1 text-[14px] font-medium leading-tight truncate">
          {sport.name}
        </span>

        {/* Live badge */}
        {hasLive && (
          <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-red-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-red-400 font-bold tabular-nums">
              {sport.liveCount}
            </span>
          </div>
        )}

        {/* Event count */}
        {!hasLive && eventCount > 0 && (
          <span className="text-[12px] text-gray-500 tabular-nums font-medium shrink-0">
            {eventCount}
          </span>
        )}

        {/* Star button - 32px minimum tap area */}
        <button
          onClick={(e) => toggleFavorite(e, sport.id)}
          className={cn(
            'shrink-0 flex items-center justify-center transition-opacity',
            // 32px minimum tap area
            'w-8 h-8 -mr-1',
            'opacity-0 group-hover:opacity-100',
            isFavorite && 'opacity-100'
          )}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            className={cn(
              'w-4 h-4 transition-colors',
              isFavorite
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-600 hover:text-gray-400'
            )}
          />
        </button>
      </button>
    );
  };

  // ---------------------------------------------------------------------------
  // Tab bar (3 tabs: All Sports, Live, Favorites)
  // ---------------------------------------------------------------------------

  const TabBar = () => (
    <div
      className="flex shrink-0 border-b"
      style={{ borderColor: DIVIDER_COLOR }}
    >
      {(
        [
          { key: 'all' as const, label: 'All Sports' },
          { key: 'live' as const, label: 'Live', badge: liveSports.length },
          { key: 'favorites' as const, label: 'Favorites', badge: favoriteSports.length },
        ]
      ).map(({ key, label, badge }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold transition-colors relative',
            // 44px minimum touch target
            'min-h-[44px]',
            activeTab === key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <span>{label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center',
                activeTab === key
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-700 text-gray-400'
              )}
            >
              {badge}
            </span>
          )}
          {activeTab === key && (
            <motion.div
              layoutId="sports-tab-indicator"
              className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-green-500"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Search bar
  // ---------------------------------------------------------------------------

  const SearchBar = () => (
    <div className="px-4 pt-4 pb-3 shrink-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search sports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-10 pr-4 py-2.5 rounded-lg',
            'bg-white/[0.04] border border-white/[0.08]',
            'text-[14px] text-white placeholder-gray-500',
            'focus:outline-none focus:border-green-500/50 focus:bg-white/[0.06]',
            'transition-colors'
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Scrollable content
  // ---------------------------------------------------------------------------

  const ScrollContent = () => (
    <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {/* Loading state */}
      {isLoading && (
        <div className="px-4 space-y-2 mt-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-11 rounded-lg bg-white/[0.03] animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}

      {/* All Sports tab */}
      {!isLoading && activeTab === 'all' && (
        <>
          {!searchQuery && popularSports.length > 0 && (
            <>
              <SectionLabel icon={<Flame className="w-3.5 h-3.5 text-orange-400" />}>
                Popular
              </SectionLabel>
              {popularSports.map((sport) => (
                <SportRow
                  key={sport.slug}
                  sport={sport}
                  isFavorite={favorites.includes(sport.id)}
                />
              ))}
              <Divider />
            </>
          )}

          <SectionLabel>All Sports</SectionLabel>
          {filteredSports.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-[13px]">
              No sports found
            </div>
          ) : (
            filteredSports.map((sport) => (
              <SportRow
                key={sport.slug}
                sport={sport}
                isFavorite={favorites.includes(sport.id)}
              />
            ))
          )}
        </>
      )}

      {/* Live tab */}
      {!isLoading && activeTab === 'live' && (
        <>
          <SectionLabel>Live Now</SectionLabel>
          {filteredSports.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-[13px]">
              {searchQuery ? 'No live sports found' : 'No live events at the moment'}
            </div>
          ) : (
            filteredSports.map((sport) => (
              <SportRow
                key={sport.slug}
                sport={sport}
                isFavorite={favorites.includes(sport.id)}
              />
            ))
          )}
        </>
      )}

      {/* Favorites tab */}
      {!isLoading && activeTab === 'favorites' && (
        <>
          <SectionLabel>My Favorites</SectionLabel>
          {filteredSports.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-[13px]">
              {searchQuery
                ? 'No favorites found'
                : 'No favorites yet. Star your favorite sports!'}
            </div>
          ) : (
            filteredSports.map((sport) => (
              <SportRow key={sport.slug} sport={sport} isFavorite />
            ))
          )}
        </>
      )}

      {/* Bottom spacing */}
      <div className="h-6" />
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Mobile hamburger trigger - Fixed position with safe-area support   */}
      {/* ------------------------------------------------------------------ */}
      <button
        onClick={drawer.toggle}
        className={cn(
          'fixed z-50 md:hidden',
          'p-2.5 rounded-lg',
          'bg-[#1a1b1f] text-gray-300 hover:text-white',
          'transition-colors shadow-lg',
          'touch-manipulation'
        )}
        style={{
          top: 'max(12px, env(safe-area-inset-top))',
          left: 'max(12px, env(safe-area-inset-left))',
        }}
        aria-label="Toggle sidebar"
      >
        {drawer.isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile drawer (< 768px) - Max-width 85vw, slides from left        */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {drawer.isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
              onClick={drawer.close}
              style={{
                touchAction: 'none',
              }}
            />

            {/* Drawer panel */}
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed z-50 h-full flex flex-col md:hidden',
                'shadow-2xl'
              )}
              style={{
                top: 0,
                left: 0,
                bottom: 0,
                backgroundColor: '#111214',
                // Max-width 85vw, but respect safe areas
                maxWidth: 'min(85vw, 360px)',
                width: '100%',
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
              }}
            >
              {/* Header with close button */}
              <div className="flex items-center justify-between px-4 py-4 shrink-0">
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

              <TabBar />
              <SearchBar />
              <ScrollContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop sidebar (>= 768px) - Fixed 240px width                    */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={cn(
          'hidden md:flex flex-col',
          'fixed left-0 top-[60px] bottom-0 z-30',
          'w-[240px]',
          'border-r'
        )}
        style={{
          backgroundColor: '#111214',
          borderColor: DIVIDER_COLOR,
        }}
      >
        <SearchBar />
        <TabBar />
        <ScrollContent />
      </aside>
    </>
  );
}
