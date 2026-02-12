'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSportsStore } from '@/stores/sportsStore';
import { cn } from '@/lib/utils';
import {
  Star,
  Gift,
  MessageCircle,
  HelpCircle,
  BookOpen,
  Gamepad2,
  Trophy,
  Zap,
  X,
  Menu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SportIcon } from '@/components/sports/SportIcon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SidebarTab = 'sports' | 'casino' | 'esports';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAVORITES_STORAGE_KEY = 'cryptobet_sidebar_favorites';
const ACTIVE_TAB_KEY = 'cryptobet_sidebar_tab';

const DIVIDER_COLOR = 'rgba(255, 255, 255, 0.06)';

/**
 * Static sports list with slug, display name, and emoji fallback.
 * The sidebar will merge live counts from the store when available,
 * but always renders this full list so the UI is never empty.
 */
const ALL_SPORTS: { slug: string; name: string; emoji: string }[] = [
  { slug: 'football', name: 'Soccer', emoji: '\u26BD' },
  { slug: 'basketball', name: 'Basketball', emoji: '\uD83C\uDFC0' },
  { slug: 'tennis', name: 'Tennis', emoji: '\uD83C\uDFBE' },
  { slug: 'american-football', name: 'American Football', emoji: '\uD83C\uDFC8' },
  { slug: 'baseball', name: 'Baseball', emoji: '\u26BE' },
  { slug: 'ice-hockey', name: 'Ice Hockey', emoji: '\uD83C\uDFD2' },
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

const ESPORTS_SLUGS = new Set(['cs2', 'dota-2', 'league-of-legends', 'valorant']);

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
  return <div className="mx-3 my-2" style={{ borderBottom: `1px solid ${DIVIDER_COLOR}` }} />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider select-none">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SportsSidebar() {
  const pathname = usePathname();
  const { sports, isLoading } = useSportsStore();
  const drawer = useMobileDrawer();

  // ---- Tab state (persisted) ----
  const [activeTab, setActiveTab] = useState<SidebarTab>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_TAB_KEY);
      if (stored === 'sports' || stored === 'casino' || stored === 'esports') return stored;
    }
    return 'sports';
  });

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
        id: stored?.id ?? item.slug,
        liveCount: stored?.liveCount ?? 0,
        eventCount: stored?.eventCount ?? 0,
      };
    });
  }, [sportBySlug]);

  // ---- Split into regular sports and esports ----
  const regularSports = useMemo(
    () => mergedSports.filter((s) => !ESPORTS_SLUGS.has(s.slug)),
    [mergedSports]
  );

  const esportsList = useMemo(
    () => mergedSports.filter((s) => ESPORTS_SLUGS.has(s.slug)),
    [mergedSports]
  );

  // ---- Favorite sports ----
  const favoriteSports = useMemo(
    () => mergedSports.filter((s) => favorites.includes(s.id)),
    [mergedSports, favorites]
  );

  // ---- Persist tab ----
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  // ---- Persist favorites ----
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // ---- Auto-detect tab from pathname ----
  useEffect(() => {
    if (pathname?.startsWith('/casino')) setActiveTab('casino');
    else if (pathname?.startsWith('/esports')) setActiveTab('esports');
  }, [pathname]);

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

  // ---------------------------------------------------------------------------
  // Sport row
  // ---------------------------------------------------------------------------

  const SportRow = ({
    sport,
    showStar,
    isFavorite,
  }: {
    sport: (typeof mergedSports)[0];
    showStar?: boolean;
    isFavorite?: boolean;
  }) => {
    const href = `/sports/${sport.slug}`;
    const isActive = pathname === href;
    const hasLive = (sport.liveCount ?? 0) > 0;

    return (
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-[7px] text-[14px] cursor-pointer transition-colors group',
          isActive ? 'bg-[#1a1b1f] text-white' : 'text-gray-300 hover:bg-[#1a1b1f]/60'
        )}
      >
        {/* Star for favorites section */}
        {showStar && (
          <button
            onClick={(e) => toggleFavorite(e, sport.id)}
            className="shrink-0"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={cn(
                'w-3.5 h-3.5 transition-colors',
                isFavorite
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-600 hover:text-gray-400'
              )}
            />
          </button>
        )}

        {/* Sport link */}
        <Link href={href} className="flex-1 flex items-center gap-2.5 min-w-0">
          <SportIcon slug={sport.slug} size={16} emoji={sport.emoji} />
          <span className="truncate leading-tight">{sport.name}</span>
        </Link>

        {/* Live count badge */}
        {hasLive && (
          <span className="flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[12px] text-green-400 tabular-nums font-medium">
              {sport.liveCount}
            </span>
          </span>
        )}

        {/* Hover favorite toggle (non-favorites section only) */}
        {!showStar && (
          <button
            onClick={(e) => toggleFavorite(e, sport.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5"
            aria-label="Toggle favorite"
          >
            <Star
              className={cn(
                'w-3 h-3 transition-colors',
                favorites.includes(sport.id)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-600 hover:text-gray-400'
              )}
            />
          </button>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Tab contents
  // ---------------------------------------------------------------------------

  const renderSportsTab = () => (
    <>
      {/* Refer & Earn */}
      <Link
        href="/referrals"
        className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1a1b1f]/60 transition-colors"
      >
        <Gift className="w-4 h-4 text-yellow-400" />
        <span className="font-medium">Refer &amp; Earn</span>
      </Link>

      <Divider />

      {/* My Favorites */}
      {favoriteSports.length > 0 && (
        <>
          <SectionLabel>My Favorites</SectionLabel>
          {favoriteSports.map((sport) => (
            <SportRow key={`fav-${sport.id}`} sport={sport} showStar isFavorite />
          ))}
          <Divider />
        </>
      )}

      {/* All Sports */}
      <SectionLabel>All Sports</SectionLabel>

      {isLoading ? (
        <div className="px-3 space-y-1.5 mt-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-8 rounded bg-white/[0.03] animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ) : (
        regularSports.map((sport) => <SportRow key={sport.slug} sport={sport} />)
      )}

      <Divider />

      {/* Footer links */}
      <div className="pb-6">
        <Link
          href="/academy"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <BookOpen className="w-4 h-4 text-gray-500" />
          Blog
        </Link>
        <a
          href="https://t.me/cryptobet"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-gray-500" />
          Telegram
        </a>
        <Link
          href="/support"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-gray-500" />
          Support
        </Link>
      </div>
    </>
  );

  const renderCasinoTab = () => (
    <>
      <Link
        href="/casino"
        className={cn(
          'flex items-center gap-2.5 px-4 py-2.5 text-[14px] transition-colors',
          pathname === '/casino' ? 'text-white bg-[#1a1b1f]' : 'text-gray-300 hover:bg-[#1a1b1f]/60'
        )}
      >
        <Gamepad2 className="w-4 h-4 text-purple-400" />
        <span className="font-medium">All Games</span>
      </Link>
      <Link
        href="/casino?type=live"
        className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1a1b1f]/60 transition-colors"
      >
        <span className="w-4 text-center text-[14px] shrink-0">{'\uD83C\uDFB2'}</span>
        <span>Live Dealer</span>
      </Link>
      <Link
        href="/casino?type=slots"
        className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1a1b1f]/60 transition-colors"
      >
        <span className="w-4 text-center text-[14px] shrink-0">{'\uD83C\uDFB0'}</span>
        <span>Slots</span>
      </Link>
      <Link
        href="/casino?type=table"
        className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1a1b1f]/60 transition-colors"
      >
        <span className="w-4 text-center text-[14px] shrink-0">{'\uD83C\uDCCF'}</span>
        <span>Table Games</span>
      </Link>
      <Link
        href="/casino?type=blackjack"
        className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1a1b1f]/60 transition-colors"
      >
        <span className="w-4 text-center text-[14px] shrink-0">{'\u2660\uFE0F'}</span>
        <span>Blackjack</span>
      </Link>
      <Link
        href="/casino?type=roulette"
        className="flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1a1b1f]/60 transition-colors"
      >
        <span className="w-4 text-center text-[14px] shrink-0">{'\uD83C\uDFAF'}</span>
        <span>Roulette</span>
      </Link>

      <Divider />

      <div className="pb-6">
        <Link
          href="/academy"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <BookOpen className="w-4 h-4 text-gray-500" />
          Blog
        </Link>
        <a
          href="https://t.me/cryptobet"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-gray-500" />
          Telegram
        </a>
        <Link
          href="/support"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-gray-500" />
          Support
        </Link>
      </div>
    </>
  );

  const renderEsportsTab = () => (
    <>
      <Link
        href="/sports?filter=esports"
        className={cn(
          'flex items-center gap-2.5 px-4 py-2.5 text-[14px] transition-colors',
          pathname === '/esports' ? 'text-white bg-[#1a1b1f]' : 'text-gray-300 hover:bg-[#1a1b1f]/60'
        )}
      >
        <Zap className="w-4 h-4 text-purple-400" />
        <span className="font-medium">All Esports</span>
      </Link>

      <Divider />

      <SectionLabel>Games</SectionLabel>
      {esportsList.map((sport) => (
        <SportRow key={sport.slug} sport={sport} />
      ))}

      <Divider />

      <div className="pb-6">
        <Link
          href="/academy"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <BookOpen className="w-4 h-4 text-gray-500" />
          Blog
        </Link>
        <a
          href="https://t.me/cryptobet"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-gray-500" />
          Telegram
        </a>
        <Link
          href="/support"
          className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1a1b1f]/60 transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-gray-500" />
          Support
        </Link>
      </div>
    </>
  );

  // ---------------------------------------------------------------------------
  // Tab bar (shared between desktop and mobile)
  // ---------------------------------------------------------------------------

  const TabBar = () => (
    <div className="flex shrink-0" style={{ borderBottom: `1px solid ${DIVIDER_COLOR}` }}>
      {(
        [
          { key: 'sports' as const, label: 'Sports', Icon: Trophy },
          { key: 'casino' as const, label: 'Casino', Icon: Gamepad2 },
          { key: 'esports' as const, label: 'Esports', Icon: Zap },
        ]
      ).map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-medium transition-colors relative',
            activeTab === key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
          )}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
          {activeTab === key && (
            <motion.div
              layoutId="sidebar-tab-indicator"
              className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
              style={{ backgroundColor: '#8D52DA' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Scrollable content
  // ---------------------------------------------------------------------------

  const ScrollContent = () => (
    <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {activeTab === 'sports' && renderSportsTab()}
      {activeTab === 'casino' && renderCasinoTab()}
      {activeTab === 'esports' && renderEsportsTab()}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Mobile hamburger trigger                                            */}
      {/* ------------------------------------------------------------------ */}
      <button
        onClick={drawer.toggle}
        className="fixed top-[14px] left-3 z-50 md:hidden p-2 rounded-lg bg-[#1a1b1f] text-gray-300 hover:text-white transition-colors"
        aria-label="Toggle sidebar"
      >
        {drawer.isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile drawer (< 768px)                                             */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {drawer.isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={drawer.close}
            />

            {/* Drawer panel */}
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed top-0 left-0 z-50 h-full w-[280px] flex flex-col md:hidden"
              style={{ backgroundColor: '#111214' }}
            >
              {/* Close button inside drawer */}
              <div className="flex items-center justify-between px-4 py-3 shrink-0">
                <span className="text-[15px] font-semibold text-white tracking-tight">
                  CryptoBet
                </span>
                <button
                  onClick={drawer.close}
                  className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <TabBar />
              <ScrollContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Desktop sidebar (>= 768px)                                          */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed left-0 top-[60px] bottom-0 z-30',
          'w-[200px] lg:w-[240px]'
        )}
        style={{ backgroundColor: '#111214' }}
      >
        <TabBar />
        <ScrollContent />
      </aside>
    </>
  );
}
