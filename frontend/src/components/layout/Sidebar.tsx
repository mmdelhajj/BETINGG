'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  Zap,
  Hammer,
  Ticket,
  Gift,
  Trophy,
  Users,
  Star,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Clock,
  Flame,
  Sparkles,
  ExternalLink,
  Tv,
  Grid3X3,
  Spade,
  CircleDot,
  Diamond,
  TrendingUp,
  Clapperboard,
  Joystick,
  Table2,
  Coins,
  Hash,
  Club,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sport {
  id: string;
  name: string;
  slug: string;
  icon: string;
  eventCount: number;
  liveEventCount: number;
}

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  external?: boolean;
}

// ---------------------------------------------------------------------------
// Sport emoji map (Cloudbet-style colored icons)
// ---------------------------------------------------------------------------

const SPORT_EMOJIS: Record<string, string> = {
  'american-football': '\u{1F3C8}',
  'aussie-rules': '\u{1F3C9}',
  afl: '\u{1F3C9}',
  bandy: '\u{1F3D2}',
  baseball: '\u26BE',
  basketball: '\u{1F3C0}',
  boxing: '\u{1F94A}',
  chess: '\u265F\uFE0F',
  cricket: '\u{1F3CF}',
  cycling: '\u{1F6B4}',
  darts: '\u{1F3AF}',
  entertainment: '\u{1F3AD}',
  football: '\u26BD',
  soccer: '\u26BD',
  golf: '\u26F3',
  handball: '\u{1F93E}',
  'ice-hockey': '\u{1F3D2}',
  mma: '\u{1F94B}',
  'mixed-martial-arts': '\u{1F94B}',
  rugby: '\u{1F3C9}',
  'rugby-league': '\u{1F3C9}',
  'rugby-union': '\u{1F3C9}',
  tennis: '\u{1F3BE}',
  volleyball: '\u{1F3D0}',
  'table-tennis': '\u{1F3D3}',
  badminton: '\u{1F3F8}',
  snooker: '\u{1F3B1}',
  pool: '\u{1F3B1}',
  'formula-1': '\u{1F3CE}\uFE0F',
  motorsport: '\u{1F3CE}\uFE0F',
  'horse-racing': '\u{1F3C7}',
  esports: '\u{1F3AE}',
  'counter-strike': '\u{1F3AE}',
  'league-of-legends': '\u{1F3AE}',
  dota2: '\u{1F3AE}',
  valorant: '\u{1F3AE}',
  futsal: '\u26BD',
  'water-polo': '\u{1F93D}',
  skiing: '\u26F7\uFE0F',
  'alpine-skiing': '\u26F7\uFE0F',
  biathlon: '\u{1F3BF}',
  'cross-country': '\u{1F3BF}',
  'ski-jumping': '\u{1F3BF}',
  surfing: '\u{1F3C4}',
  swimming: '\u{1F3CA}',
  athletics: '\u{1F3C3}',
  wrestling: '\u{1F93C}',
  fencing: '\u{1F93A}',
  archery: '\u{1F3F9}',
  rowing: '\u{1F6A3}',
  sailing: '\u26F5',
  weightlifting: '\u{1F3CB}\uFE0F',
  'beach-volleyball': '\u{1F3D0}',
  lacrosse: '\u{1F94D}',
  'field-hockey': '\u{1F3D1}',
  curling: '\u{1F94C}',
  softball: '\u{1F94E}',
  'figure-skating': '\u26F8\uFE0F',
  'speed-skating': '\u26F8\uFE0F',
  bobsled: '\u{1F6F7}',
  luge: '\u{1F6F7}',
  skeleton: '\u{1F6F7}',
  'ice-skating': '\u26F8\uFE0F',
  politics: '\u{1F3DB}\uFE0F',
  specials: '\u{1F31F}',
};

// ---------------------------------------------------------------------------
// Sports Mode Navigation
// ---------------------------------------------------------------------------

const SPORTS_NAV_ITEMS: SidebarItem[] = [
  {
    label: 'All sports',
    href: '/sports',
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    label: 'In-play',
    href: '/sports/live',
    icon: (
      <span className="relative flex items-center justify-center w-4 h-4">
        <Zap className="w-3.5 h-3.5" />
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-danger rounded-full animate-pulse" />
      </span>
    ),
  },
  {
    label: 'Bet Builder',
    href: '/sports/bet-builder',
    icon: <Hammer className="w-4 h-4" />,
  },
  {
    label: 'My bets',
    href: '/bets',
    icon: <Ticket className="w-4 h-4" />,
  },
  {
    label: 'Promos',
    href: '/promotions',
    icon: <Gift className="w-4 h-4" />,
  },
  {
    label: 'Tournaments',
    href: '/tournaments',
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    label: 'Refer & earn',
    href: '/referrals',
    icon: <Users className="w-4 h-4" />,
  },
];

// ---------------------------------------------------------------------------
// Casino Mode Navigation
// ---------------------------------------------------------------------------

const CASINO_NAV_ITEMS: SidebarItem[] = [
  {
    label: 'All games',
    href: '/casino',
    icon: <Gamepad2 className="w-4 h-4" />,
  },
  {
    label: 'Recently played',
    href: '/casino/recent',
    icon: <Clock className="w-4 h-4" />,
    badge: 21,
  },
  {
    label: 'High roller',
    href: '/casino/high-roller',
    icon: <Flame className="w-4 h-4" />,
  },
  {
    label: 'New games',
    href: '/casino/new',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    label: 'Promos',
    href: '/promotions',
    icon: <Gift className="w-4 h-4" />,
  },
  {
    label: 'Tournaments',
    href: '/tournaments',
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    label: 'Refer & earn',
    href: '/referrals',
    icon: <Users className="w-4 h-4" />,
  },
];

const CASINO_CATEGORY_ITEMS: SidebarItem[] = [
  {
    label: 'Live dealer',
    href: '/casino/live-dealer',
    icon: <Tv className="w-4 h-4" />,
  },
  {
    label: 'Slots',
    href: '/casino/slots',
    icon: <Grid3X3 className="w-4 h-4" />,
  },
  {
    label: 'Blackjack',
    href: '/casino/blackjack',
    icon: <Spade className="w-4 h-4" />,
  },
  {
    label: 'Roulette',
    href: '/casino/roulette',
    icon: <CircleDot className="w-4 h-4" />,
  },
  {
    label: 'Baccarat',
    href: '/casino/baccarat',
    icon: <Diamond className="w-4 h-4" />,
  },
  {
    label: 'Crash',
    href: '/casino/crash',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    label: 'Game shows',
    href: '/casino/game-shows',
    icon: <Clapperboard className="w-4 h-4" />,
  },
  {
    label: 'Arcade',
    href: '/casino/arcade',
    icon: <Joystick className="w-4 h-4" />,
  },
  {
    label: 'Table games',
    href: '/casino/table-games',
    icon: <Table2 className="w-4 h-4" />,
  },
  {
    label: 'Jackpot slots',
    href: '/casino/jackpot-slots',
    icon: <Coins className="w-4 h-4" />,
  },
  {
    label: 'Bingo and Keno',
    href: '/casino/bingo-keno',
    icon: <Hash className="w-4 h-4" />,
  },
  {
    label: 'Poker',
    href: '/casino/poker',
    icon: <Club className="w-4 h-4" />,
  },
];

const CASINO_FOOTER_ITEMS: SidebarItem[] = [
  {
    label: 'Provably Fair',
    href: '/provably-fair',
    icon: <ExternalLink className="w-3.5 h-3.5" />,
    external: true,
  },
  {
    label: 'Blog',
    href: '/blog',
    icon: <ExternalLink className="w-3.5 h-3.5" />,
    external: true,
  },
];

// ---------------------------------------------------------------------------
// Sidebar sub-components
// ---------------------------------------------------------------------------

function SidebarNavItem({
  item,
  isActive,
  isCollapsed,
}: {
  item: SidebarItem;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const content = (
    <div
      className={cn(
        'group flex items-center gap-2.5 px-3 py-[7px] mx-1.5 rounded-md text-[13px] font-medium transition-all duration-200 cursor-pointer select-none',
        isActive
          ? 'bg-accent/20 text-white'
          : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1C2128]',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center w-4 h-4 shrink-0 transition-colors duration-200',
          isActive ? 'text-accent-light' : 'text-[#6E7681] group-hover:text-[#8B949E]',
        )}
      >
        {item.icon}
      </span>

      {!isCollapsed && (
        <>
          <span className="truncate flex-1">{item.label}</span>
          {item.badge !== undefined && (
            <span className="text-[10px] font-semibold bg-[#30363D] text-[#8B949E] rounded px-1.5 py-0.5 leading-none">
              {item.badge}
            </span>
          )}
        </>
      )}
    </div>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={item.href}>{content}</Link>;
}

function SidebarSectionHeader({
  label,
  isCollapsed,
}: {
  label: string;
  isCollapsed: boolean;
}) {
  if (isCollapsed) {
    return <div className="border-t border-[#21262D] my-1.5 mx-3" />;
  }

  return (
    <div className="px-4 pt-3 pb-1.5">
      <span className="text-[11px] font-semibold text-[#484F58] uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

function SidebarDivider() {
  return <div className="border-t border-[#21262D] my-1.5 mx-3" />;
}

function SportListItem({
  sport,
  isActive,
  isCollapsed,
}: {
  sport: Sport;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const emoji = SPORT_EMOJIS[sport.slug] || '\u{1F3C6}';
  const sportPath = `/sports/${sport.slug}`;

  return (
    <Link href={sportPath}>
      <div
        className={cn(
          'group flex items-center gap-2.5 px-3 py-[6px] mx-1.5 rounded-md text-[13px] transition-all duration-200 cursor-pointer select-none',
          isActive
            ? 'bg-accent/20 text-white'
            : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1C2128]',
        )}
      >
        <span className="text-sm w-4 text-center shrink-0 leading-none">{emoji}</span>

        {!isCollapsed && (
          <>
            <span className="truncate flex-1 font-medium">{sport.name}</span>
            {sport.liveEventCount > 0 && (
              <span className="flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                <span className="text-[10px] font-mono text-danger font-semibold">
                  {sport.liveEventCount}
                </span>
              </span>
            )}
            {sport.eventCount > 0 && sport.liveEventCount === 0 && (
              <span className="text-[10px] font-mono text-[#484F58] shrink-0">
                {sport.eventCount}
              </span>
            )}
          </>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar Component
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const pathname = usePathname();
  const [sports, setSports] = useState<Sport[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [favorites] = useState<string[]>(['football']); // TODO: persist user favorites

  // Determine which mode we're in
  const isCasinoMode = pathname?.startsWith('/casino');
  const isSportsMode = !isCasinoMode;

  // Fetch sports from API (only when in sports mode)
  useEffect(() => {
    if (!isSportsMode) return;

    async function fetchSports() {
      try {
        const data = await get<{ sports: Sport[] }>('/sports');
        setSports(data.sports || []);
      } catch {
        setSports([]);
      }
    }
    fetchSports();
  }, [isSportsMode]);

  // Split sports into favorites and all
  const { favoriteSports, allSports } = useMemo(() => {
    const favs = sports.filter((s) => favorites.includes(s.slug));
    const sorted = [...sports].sort((a, b) => a.name.localeCompare(b.name));
    return { favoriteSports: favs, allSports: sorted };
  }, [sports, favorites]);

  // Helper to check active state
  const isItemActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/sports' && pathname === '/sports') return true;
    if (href === '/casino' && pathname === '/casino') return true;
    if (href !== '/sports' && href !== '/casino') {
      return pathname === href || pathname.startsWith(href + '/');
    }
    return false;
  };

  const isSportActive = (slug: string) => {
    if (!pathname) return false;
    const sportPath = `/sports/${slug}`;
    return pathname === sportPath || pathname.startsWith(sportPath + '/');
  };

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col shrink-0 bg-[#0D1117] h-[calc(100vh-64px)] sticky top-16 transition-all duration-300 ease-in-out border-r border-[#1C2128]',
        isCollapsed ? 'w-[52px]' : 'w-[180px]',
      )}
    >
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-2">
        {/* ============================================================== */}
        {/* SPORTS MODE */}
        {/* ============================================================== */}
        {isSportsMode && (
          <>
            {/* Primary navigation */}
            <nav className="flex flex-col">
              {SPORTS_NAV_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  isActive={isItemActive(item.href)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </nav>

            <SidebarDivider />

            {/* My favorites */}
            {favoriteSports.length > 0 && (
              <>
                <SidebarSectionHeader label="My favorites" isCollapsed={isCollapsed} />
                <nav className="flex flex-col">
                  {favoriteSports.map((sport) => (
                    <div key={sport.id} className="relative">
                      <SportListItem
                        sport={sport}
                        isActive={isSportActive(sport.slug)}
                        isCollapsed={isCollapsed}
                      />
                      {!isCollapsed && (
                        <Star className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-yellow-400 fill-yellow-400" />
                      )}
                    </div>
                  ))}
                </nav>
                <SidebarDivider />
              </>
            )}

            {/* All sports */}
            <SidebarSectionHeader label="All" isCollapsed={isCollapsed} />
            <nav className="flex flex-col">
              {allSports.map((sport) => (
                <SportListItem
                  key={sport.id}
                  sport={sport}
                  isActive={isSportActive(sport.slug)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </nav>
          </>
        )}

        {/* ============================================================== */}
        {/* CASINO MODE */}
        {/* ============================================================== */}
        {isCasinoMode && (
          <>
            {/* Primary navigation */}
            <nav className="flex flex-col">
              {CASINO_NAV_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.href + item.label}
                  item={item}
                  isActive={isItemActive(item.href)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </nav>

            <SidebarDivider />

            {/* Game categories */}
            <nav className="flex flex-col">
              {CASINO_CATEGORY_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  isActive={isItemActive(item.href)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </nav>

            <SidebarDivider />

            {/* Footer links */}
            <nav className="flex flex-col">
              {CASINO_FOOTER_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  isActive={isItemActive(item.href)}
                  isCollapsed={isCollapsed}
                />
              ))}
            </nav>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* Collapse toggle button - fixed at bottom */}
      {/* ============================================================== */}
      <div className="border-t border-[#21262D] p-1.5">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex items-center justify-center w-full py-1.5 rounded-md text-[#6E7681] hover:text-[#C9D1D9] hover:bg-[#1C2128] transition-all duration-200',
            isCollapsed ? 'px-0' : 'gap-2 px-3',
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px] font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
