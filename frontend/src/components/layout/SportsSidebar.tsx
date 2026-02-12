'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSportsStore } from '@/stores/sportsStore';
import { sportsApi, casinoApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  Star,
  Gift,
  Loader2,
  MessageCircle,
  HelpCircle,
  BookOpen,
  Gamepad2,
  Trophy,
  Zap,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SportIcon } from '@/components/sports/SportIcon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarCompetition {
  id: string;
  name: string;
  country: string | null;
  slug: string;
  _count: { events: number };
}

interface CasinoCategory {
  key: string;
  label: string;
  icon: string;
  href: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type SidebarTab = 'sports' | 'casino' | 'esports';

const FAVORITES_STORAGE_KEY = 'cryptobet_sidebar_favorites';
const ACTIVE_TAB_KEY = 'cryptobet_sidebar_tab';

const DIVIDER_COLOR = 'rgba(255, 255, 255, 0.04)';

const CASINO_CATEGORIES: CasinoCategory[] = [
  { key: 'live', label: 'Live Dealer', icon: '\uD83C\uDFB2', href: '/casino?type=live' },
  { key: 'slots', label: 'Slots', icon: '\uD83C\uDFB0', href: '/casino?type=slots' },
  { key: 'table', label: 'Table Games', icon: '\uD83C\uDCCF', href: '/casino?type=table' },
  { key: 'blackjack', label: 'Blackjack', icon: '\u2660\uFE0F', href: '/casino?type=blackjack' },
  { key: 'roulette', label: 'Roulette', icon: '\uD83C\uDFAF', href: '/casino?type=roulette' },
  { key: 'baccarat', label: 'Baccarat', icon: '\uD83C\uDCB4', href: '/casino?type=baccarat' },
  { key: 'poker', label: 'Poker', icon: '\uD83C\uDCCF', href: '/casino?type=poker' },
  { key: 'game-shows', label: 'Game Shows', icon: '\uD83C\uDFAA', href: '/casino?type=game-shows' },
  { key: 'crash', label: 'Crash', icon: '\uD83D\uDCA5', href: '/casino/crash' },
  { key: 'arcade', label: 'Arcade', icon: '\uD83D\uDD79\uFE0F', href: '/casino?type=arcade' },
];

const ESPORTS_LIST = [
  { slug: 'cs2', name: 'Counter-Strike 2', icon: '\uD83C\uDFAE' },
  { slug: 'dota-2', name: 'Dota 2', icon: '\u2694\uFE0F' },
  { slug: 'league-of-legends', name: 'League of Legends', icon: '\uD83D\uDC51' },
  { slug: 'valorant', name: 'Valorant', icon: '\uD83D\uDD2B' },
  { slug: 'call-of-duty', name: 'Call of Duty', icon: '\uD83D\uDC80' },
  { slug: 'ea-sports-fc', name: 'NBA2K', icon: '\uD83C\uDFC0' },
  { slug: 'rocket-league', name: 'Rocket League', icon: '\uD83D\uDE80' },
  { slug: 'rainbow-six', name: 'Rainbow Six', icon: '\uD83D\uDEE1\uFE0F' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SportsSidebar() {
  const pathname = usePathname();
  const { sports, isLoading } = useSportsStore();

  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState<SidebarTab>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ACTIVE_TAB_KEY);
      if (stored === 'sports' || stored === 'casino' || stored === 'esports') return stored;
    }
    return 'sports';
  });

  // ---- Sports state ----
  const [expandedSports, setExpandedSports] = useState<Record<string, boolean>>({});
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
  const [competitionsCache, setCompetitionsCache] = useState<Record<string, SidebarCompetition[]>>({});
  const [competitionsLoading, setCompetitionsLoading] = useState<Record<string, boolean>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  // ---- Casino state ----
  const [casinoProviders, setCasinoProviders] = useState<{ name: string; slug?: string }[]>([]);

  // ---- Derived sport lists ----
  const activeSports = useMemo(
    () => sports.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [sports]
  );

  const favoriteSports = useMemo(
    () => activeSports.filter((s) => favorites.includes(s.id)),
    [activeSports, favorites]
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

  // ---- Fetch casino providers once ----
  useEffect(() => {
    if (activeTab === 'casino' && casinoProviders.length === 0) {
      casinoApi
        .getProviders()
        .then(({ data }) => {
          const providers = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
          setCasinoProviders(providers);
        })
        .catch(() => {});
    }
  }, [activeTab, casinoProviders.length]);

  // ---- Competition fetching (keep existing logic) ----
  const fetchCompetitions = useCallback(async (sportSlug: string) => {
    if (fetchedRef.current.has(sportSlug)) return;
    fetchedRef.current.add(sportSlug);
    setCompetitionsLoading((prev) => ({ ...prev, [sportSlug]: true }));
    try {
      const { data } = await sportsApi.getCompetitions(sportSlug);
      const comps: SidebarCompetition[] = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      setCompetitionsCache((prev) => ({ ...prev, [sportSlug]: comps }));
    } catch {
      fetchedRef.current.delete(sportSlug);
    } finally {
      setCompetitionsLoading((prev) => ({ ...prev, [sportSlug]: false }));
    }
  }, []);

  const toggleExpand = (sportId: string, sportSlug: string) => {
    const willExpand = !expandedSports[sportId];
    setExpandedSports((prev) => ({ ...prev, [sportId]: willExpand }));
    if (willExpand) {
      fetchCompetitions(sportSlug);
    }
  };

  const toggleFavorite = (e: React.MouseEvent, sportId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(sportId) ? prev.filter((id) => id !== sportId) : [...prev, sportId]
    );
  };

  /** Group competitions by country */
  const groupByCountry = (competitions: SidebarCompetition[]) => {
    const groups: Record<string, SidebarCompetition[]> = {};
    for (const comp of competitions) {
      const country = comp.country || 'International';
      if (!groups[country]) groups[country] = [];
      groups[country].push(comp);
    }
    return groups;
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  /** Divider line */
  const Divider = () => (
    <div className="mx-3 my-2" style={{ borderBottom: `1px solid ${DIVIDER_COLOR}` }} />
  );

  /** Section label */
  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
      {children}
    </div>
  );

  /** Single sport row (used in favorites + all sports) */
  const SportRow = ({
    sport,
    showStar,
    showExpand,
    isFavorite,
  }: {
    sport: (typeof activeSports)[0];
    showStar?: boolean;
    showExpand?: boolean;
    isFavorite?: boolean;
  }) => {
    const isActive = pathname === `/sports/${sport.slug}`;
    const isExpanded = expandedSports[sport.id];

    return (
      <div>
        {/* Main row */}
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-[7px] text-[14px] cursor-pointer transition-colors group',
            isActive ? 'bg-[#1A1B1F] text-white' : 'text-gray-300 hover:bg-[#1A1B1F]'
          )}
        >
          {/* Star icon for favorites */}
          {showStar && (
            <button
              onClick={(e) => toggleFavorite(e, sport.id)}
              className="shrink-0"
            >
              <Star
                className={cn(
                  'w-3.5 h-3.5',
                  isFavorite
                    ? 'fill-accent-yellow text-accent-yellow'
                    : 'text-gray-600 hover:text-gray-400'
                )}
              />
            </button>
          )}

          {/* Sport icon + name link */}
          <Link
            href={`/sports/${sport.slug}`}
            className="flex-1 flex items-center gap-2 min-w-0"
          >
            <SportIcon slug={sport.slug} size={16} emoji={sport.icon} />
            <span className="truncate">{sport.name}</span>
          </Link>

          {/* Event count */}
          {sport.eventCount !== undefined && sport.eventCount > 0 && (
            <span className="text-[12px] text-gray-500 tabular-nums shrink-0">
              {sport.eventCount}
            </span>
          )}

          {/* Expand arrow */}
          {showExpand && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleExpand(sport.id, sport.slug);
              }}
              className="p-0.5 shrink-0"
            >
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 text-gray-500 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          )}

          {/* Hover favorite toggle (non-favorite rows) */}
          {!showStar && (
            <button
              onClick={(e) => toggleFavorite(e, sport.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5"
            >
              <Star
                className={cn(
                  'w-3 h-3',
                  favorites.includes(sport.id)
                    ? 'fill-accent-yellow text-accent-yellow'
                    : 'text-gray-600 hover:text-gray-400'
                )}
              />
            </button>
          )}
        </div>

        {/* Expandable competitions */}
        {showExpand && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pl-6 pr-2 py-1 space-y-0.5">
                  {competitionsLoading[sport.slug] ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    </div>
                  ) : competitionsCache[sport.slug]?.length ? (
                    <>
                      {Object.entries(groupByCountry(competitionsCache[sport.slug])).map(
                        ([country, comps]) => (
                          <div key={country}>
                            {Object.keys(groupByCountry(competitionsCache[sport.slug])).length > 1 && (
                              <span className="block px-2 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                {country}
                              </span>
                            )}
                            {comps.map((comp) => (
                              <Link
                                key={comp.id}
                                href={`/sports/${sport.slug}?competition=${comp.id}`}
                                className="flex items-center justify-between px-2 py-1.5 text-[12px] text-gray-400 hover:text-white hover:bg-[#1A1B1F] rounded transition-colors"
                              >
                                <span className="truncate">{comp.name}</span>
                                {comp._count?.events > 0 && (
                                  <span className="text-[10px] text-gray-500 shrink-0 ml-1">
                                    {comp._count.events}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        )
                      )}
                    </>
                  ) : null}
                  {/* Bottom links */}
                  <div style={{ borderTop: `1px solid ${DIVIDER_COLOR}` }} className="mt-1 pt-1 space-y-0.5">
                    <Link
                      href={`/sports/${sport.slug}?filter=live`}
                      className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-gray-400 hover:text-white hover:bg-[#1A1B1F] rounded transition-colors"
                    >
                      <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
                      Live {sport.name}
                    </Link>
                    <Link
                      href={`/sports/${sport.slug}`}
                      className="block px-2 py-1.5 text-[12px] text-gray-400 hover:text-white hover:bg-[#1A1B1F] rounded transition-colors"
                    >
                      All {sport.name} &rarr;
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Tab Content: Sports
  // ---------------------------------------------------------------------------

  const renderSportsTab = () => (
    <>
      {/* Refer & Earn link */}
      <Link
        href="/referrals"
        className="flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1A1B1F] transition-colors"
      >
        <Gift className="w-4 h-4 text-accent-yellow" />
        <span className="font-medium">Refer &amp; Earn</span>
      </Link>

      <Divider />

      {/* My Favorites */}
      {favoriteSports.length > 0 && (
        <>
          <SectionLabel>My Favorites</SectionLabel>
          {favoriteSports.map((sport) => (
            <SportRow
              key={`fav-${sport.id}`}
              sport={sport}
              showStar
              isFavorite
            />
          ))}
          <Divider />
        </>
      )}

      {/* All Sports */}
      <SectionLabel>All Sports</SectionLabel>

      {isLoading ? (
        <div className="px-3 space-y-1.5 mt-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-8 rounded" />
          ))}
        </div>
      ) : activeSports.length === 0 ? (
        <p className="text-xs text-gray-500 px-4 py-4 text-center">No sports available</p>
      ) : (
        activeSports.map((sport) => (
          <SportRow
            key={sport.id}
            sport={sport}
            showExpand
          />
        ))
      )}

      <Divider />

      {/* Footer links */}
      <div className="pb-4">
        <Link
          href="/academy"
          className="flex items-center gap-2 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1A1B1F] transition-colors"
        >
          <BookOpen className="w-4 h-4 text-gray-500" />
          Blog
        </Link>
        <a
          href="https://t.me/cryptobet"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1A1B1F] transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-gray-500" />
          Telegram
        </a>
        <Link
          href="/support"
          className="flex items-center gap-2 px-4 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-[#1A1B1F] transition-colors"
        >
          <HelpCircle className="w-4 h-4 text-gray-500" />
          Support
        </Link>
      </div>
    </>
  );

  // ---------------------------------------------------------------------------
  // Tab Content: Casino
  // ---------------------------------------------------------------------------

  const renderCasinoTab = () => (
    <>
      {/* Top quick links */}
      <Link
        href="/casino"
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 text-[14px] transition-colors',
          pathname === '/casino' ? 'text-white bg-[#1A1B1F]' : 'text-gray-300 hover:bg-[#1A1B1F]'
        )}
      >
        <Gamepad2 className="w-4 h-4 text-brand-400" />
        <span className="font-medium">All Games</span>
      </Link>
      <Link
        href="/casino?filter=favorites"
        className="flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1A1B1F] transition-colors"
      >
        <Star className="w-4 h-4 text-accent-yellow" />
        <span>Favorites</span>
      </Link>
      <Link
        href="/casino?filter=recent"
        className="flex items-center gap-2 px-4 py-2.5 text-[14px] text-gray-300 hover:bg-[#1A1B1F] transition-colors"
      >
        <Clock className="w-4 h-4 text-gray-500" />
        <span>Recently Played</span>
      </Link>

      <Divider />

      {/* Categories */}
      <SectionLabel>Categories</SectionLabel>
      {CASINO_CATEGORIES.map((cat) => (
        <Link
          key={cat.key}
          href={cat.href}
          className={cn(
            'flex items-center gap-2 px-4 py-[7px] text-[14px] transition-colors',
            pathname === cat.href ? 'text-white bg-[#1A1B1F]' : 'text-gray-300 hover:bg-[#1A1B1F]'
          )}
        >
          <span className="w-4 text-center text-[14px] shrink-0">{cat.icon}</span>
          <span className="flex-1 truncate">{cat.label}</span>
          {cat.count !== undefined && (
            <span className="text-[12px] text-gray-500 tabular-nums">{cat.count}</span>
          )}
        </Link>
      ))}

      <Divider />

      {/* Providers */}
      <SectionLabel>Providers</SectionLabel>
      {casinoProviders.length === 0 ? (
        <div className="px-4 py-2">
          <div className="space-y-1.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-6 rounded" />
            ))}
          </div>
        </div>
      ) : (
        <div className="pb-4">
          {casinoProviders.map((provider, i) => (
            <Link
              key={provider.slug || i}
              href={`/casino/providers?provider=${provider.slug || encodeURIComponent(provider.name)}`}
              className="block px-4 py-[7px] text-[13px] text-gray-400 hover:text-white hover:bg-[#1A1B1F] transition-colors truncate"
            >
              {provider.name}
            </Link>
          ))}
        </div>
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Tab Content: Esports
  // ---------------------------------------------------------------------------

  const renderEsportsTab = () => (
    <>
      <Link
        href="/sports?filter=esports"
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 text-[14px] transition-colors',
          pathname === '/esports' ? 'text-white bg-[#1A1B1F]' : 'text-gray-300 hover:bg-[#1A1B1F]'
        )}
      >
        <Zap className="w-4 h-4 text-brand-400" />
        <span className="font-medium">All Esports</span>
      </Link>

      <Divider />

      {ESPORTS_LIST.map((item) => {
        const href = `/sports/${item.slug}`;
        const isActive = pathname === href;
        return (
          <Link
            key={item.slug}
            href={href}
            className={cn(
              'flex items-center gap-2 px-4 py-[7px] text-[14px] transition-colors',
              isActive ? 'text-white bg-[#1A1B1F]' : 'text-gray-300 hover:bg-[#1A1B1F]'
            )}
          >
            <span className="w-4 text-center text-[14px] shrink-0">{item.icon}</span>
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <aside
      className="hidden lg:flex flex-col w-[240px] overflow-hidden shrink-0"
      style={{ backgroundColor: '#111214' }}
    >
      {/* ──────────── Tab Switcher ──────────── */}
      <div className="flex" style={{ borderBottom: `1px solid ${DIVIDER_COLOR}` }}>
        {(
          [
            { key: 'sports', label: 'Sports', icon: Trophy },
            { key: 'casino', label: 'Casino', icon: Gamepad2 },
            { key: 'esports', label: 'Esports', icon: Zap },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
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
            {/* Active indicator */}
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

      {/* ──────────── Scrollable Content ──────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'sports' && renderSportsTab()}
        {activeTab === 'casino' && renderCasinoTab()}
        {activeTab === 'esports' && renderEsportsTab()}
      </div>
    </aside>
  );
}
