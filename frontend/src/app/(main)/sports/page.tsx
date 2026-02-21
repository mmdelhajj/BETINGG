'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get } from '@/lib/api';
import { useSocket, useSocketEvent } from '@/lib/socket';

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

interface Competition {
  id: string;
  name: string;
  slug?: string;
  sportSlug?: string;
  sport?: { id: string; name: string; slug: string; icon?: string };
  eventCount: number;
  logo?: string | null;
  country?: string;
}

// ---------------------------------------------------------------------------
// Sport emoji/icon mapping -- Cloudbet style colorful emojis
// ---------------------------------------------------------------------------

const SPORT_EMOJI_MAP: Record<string, { emoji: string; color: string }> = {
  soccer: { emoji: '\u26BD', color: '#22C55E' },
  football: { emoji: '\u26BD', color: '#22C55E' },
  'american-football': { emoji: '\uD83C\uDFC8', color: '#8B4513' },
  basketball: { emoji: '\uD83C\uDFC0', color: '#F97316' },
  tennis: { emoji: '\uD83C\uDFBE', color: '#EAB308' },
  baseball: { emoji: '\u26BE', color: '#EF4444' },
  hockey: { emoji: '\uD83C\uDFD2', color: '#06B6D4' },
  'ice-hockey': { emoji: '\uD83C\uDFD2', color: '#06B6D4' },
  mma: { emoji: '\uD83E\uDD4A', color: '#EF4444' },
  boxing: { emoji: '\uD83E\uDD4A', color: '#DC2626' },
  cricket: { emoji: '\uD83C\uDFCF', color: '#84CC16' },
  rugby: { emoji: '\uD83C\uDFC9', color: '#A855F7' },
  'rugby-league': { emoji: '\uD83C\uDFC9', color: '#A855F7' },
  'rugby-union': { emoji: '\uD83C\uDFC9', color: '#9333EA' },
  esports: { emoji: '\uD83C\uDFAE', color: '#8B5CF6' },
  cycling: { emoji: '\uD83D\uDEB4', color: '#F59E0B' },
  'table-tennis': { emoji: '\uD83C\uDFD3', color: '#10B981' },
  volleyball: { emoji: '\uD83C\uDFD0', color: '#3B82F6' },
  handball: { emoji: '\uD83E\uDD3E', color: '#14B8A6' },
  darts: { emoji: '\uD83C\uDFAF', color: '#EF4444' },
  snooker: { emoji: '\uD83C\uDFB1', color: '#22C55E' },
  golf: { emoji: '\u26F3', color: '#22C55E' },
  'aussie-rules': { emoji: '\uD83C\uDFC9', color: '#EAB308' },
  bandy: { emoji: '\uD83C\uDFD2', color: '#06B6D4' },
  'field-hockey': { emoji: '\uD83C\uDFD1', color: '#F97316' },
  futsal: { emoji: '\u26BD', color: '#10B981' },
  floorball: { emoji: '\uD83C\uDFD1', color: '#3B82F6' },
  squash: { emoji: '\uD83C\uDFBE', color: '#A855F7' },
  'counter-strike': { emoji: '\uD83D\uDD2B', color: '#F59E0B' },
  'call-of-duty': { emoji: '\uD83C\uDFAE', color: '#EF4444' },
  'dota-2': { emoji: '\uD83C\uDFAE', color: '#DC2626' },
  'league-of-legends': { emoji: '\uD83C\uDFAE', color: '#3B82F6' },
  valorant: { emoji: '\uD83C\uDFAE', color: '#EF4444' },
  fifa: { emoji: '\uD83C\uDFAE', color: '#22C55E' },
  nba2k: { emoji: '\uD83C\uDFAE', color: '#F97316' },
  chess: { emoji: '\u265F\uFE0F', color: '#8B949E' },
  entertainment: { emoji: '\uD83C\uDFAC', color: '#EC4899' },
  politics: { emoji: '\uD83C\uDFDB\uFE0F', color: '#6366F1' },
  greyhounds: { emoji: '\uD83D\uDC15', color: '#A855F7' },
  'horse-racing': { emoji: '\uD83C\uDFC7', color: '#F59E0B' },
};

function getSportEmoji(sport: Sport): { emoji: string; color: string } {
  return (
    SPORT_EMOJI_MAP[sport.slug] ||
    SPORT_EMOJI_MAP[sport.icon] ||
    { emoji: '\uD83C\uDFC6', color: '#8B5CF6' }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countryCodeToFlag(countryCode?: string): string {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();
  if (code.length !== 2) {
    const nameToCode: Record<string, string> = {
      england: 'GB',
      'united kingdom': 'GB',
      spain: 'ES',
      italy: 'IT',
      germany: 'DE',
      france: 'FR',
      brazil: 'BR',
      argentina: 'AR',
      portugal: 'PT',
      netherlands: 'NL',
      belgium: 'BE',
      turkey: 'TR',
      usa: 'US',
      'united states': 'US',
      canada: 'CA',
      australia: 'AU',
      japan: 'JP',
      'south korea': 'KR',
      china: 'CN',
      russia: 'RU',
      mexico: 'MX',
      sweden: 'SE',
      norway: 'NO',
      denmark: 'DK',
      finland: 'FI',
      switzerland: 'CH',
      austria: 'AT',
      scotland: 'GB',
      international: '',
      world: '',
      europe: '',
    };
    const mapped = nameToCode[code.toLowerCase()];
    if (!mapped) return '';
    if (mapped === '') return '';
    return String.fromCodePoint(
      ...mapped.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  }
  return String.fromCodePoint(
    ...code.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function SearchBarSkeleton() {
  return (
    <div className="px-4 pt-4 pb-2">
      <div className="h-11 w-full skeleton rounded-lg" />
    </div>
  );
}

function TrendingChipSkeleton() {
  return <div className="flex-shrink-0 h-[36px] w-32 skeleton rounded-full" />;
}

function SportRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 border-b border-[#1E2433]">
      <div className="w-7 h-7 skeleton rounded-full" />
      <div className="h-4 w-28 skeleton rounded flex-1" />
      <div className="w-4 h-4 skeleton rounded" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrendingChip -- pill button for a trending competition
// ---------------------------------------------------------------------------

function TrendingChip({
  competition,
  onClick,
}: {
  competition: Competition;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const flag = countryCodeToFlag(competition.country);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#161B22] border border-[#21262D]/60 hover:border-[#8B5CF6]/40 hover:bg-[#1C2128] transition-all duration-200 flex-shrink-0 group active:scale-[0.97]"
    >
      {/* Competition logo / flag circle */}
      <div className="w-5 h-5 rounded-full bg-[#21262D] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {competition.logo && !imgError ? (
          <img
            src={competition.logo}
            alt=""
            className="w-5 h-5 object-contain rounded-full"
            onError={() => setImgError(true)}
          />
        ) : flag ? (
          <span className="text-[11px] leading-none">{flag}</span>
        ) : (
          <span className="text-[9px] font-bold text-[#6E7681]">
            {competition.name.charAt(0)}
          </span>
        )}
      </div>
      {/* Competition name */}
      <span className="text-[12px] font-medium text-[#C9D1D9] whitespace-nowrap group-hover:text-white transition-colors">
        {competition.name}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SportRow -- a single sport in the "All" list
// ---------------------------------------------------------------------------

function SportRow({ sport }: { sport: Sport }) {
  const { emoji, color } = getSportEmoji(sport);

  return (
    <Link
      href={`/sports/${sport.slug}`}
      className="flex items-center gap-3.5 px-4 py-3.5 border-b border-[#1E2433]/70 hover:bg-[#161B22]/80 transition-colors duration-150 active:bg-[#1C2128] group"
    >
      {/* Sport emoji icon */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <span className="text-[16px] leading-none">{emoji}</span>
      </div>

      {/* Sport name */}
      <span className="text-[14px] font-medium text-[#E6EDF3] flex-1 truncate group-hover:text-white transition-colors">
        {sport.name}
      </span>

      {/* Event count badge (optional) + Chevron */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {sport.liveEventCount > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#EF4444]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="text-[10px] font-bold text-[#EF4444] tabular-nums">
              {sport.liveEventCount}
            </span>
          </div>
        )}
        {sport.eventCount > 0 && (
          <span className="text-[11px] text-[#6E7681] tabular-nums font-medium">
            {sport.eventCount}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-[#30363D] group-hover:text-[#6E7681] transition-colors" />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sports Lobby Page -- Cloudbet "All Sports" Design
// ---------------------------------------------------------------------------

export default function SportsLobbyPage() {
  const router = useRouter();

  // --- State ---
  const [sports, setSports] = useState<Sport[]>([]);
  const [popularCompetitions, setPopularCompetitions] = useState<Competition[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const trendingRow1Ref = useRef<HTMLDivElement>(null);
  const trendingRow2Ref = useRef<HTMLDivElement>(null);

  // --- Socket.IO real-time live updates ---
  useSocket({ autoConnect: true, rooms: ['live'] });

  // live:update -- update live counts on sports
  useSocketEvent(
    'live:update',
    useCallback(
      (data: {
        events: Array<{
          id: string;
          sportSlug: string;
          isLive: boolean;
          [key: string]: unknown;
        }>;
      }) => {
        if (!data?.events) return;
        const liveCountBySport = new Map<string, number>();
        for (const ev of data.events) {
          if (ev.isLive) {
            liveCountBySport.set(
              ev.sportSlug,
              (liveCountBySport.get(ev.sportSlug) || 0) + 1
            );
          }
        }
        setSports((prev) =>
          prev.map((s) => ({
            ...s,
            liveEventCount: liveCountBySport.get(s.slug) ?? s.liveEventCount,
          }))
        );
      },
      []
    )
  );

  // --- Initial data fetch ---
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [sportsRes, compsRes] = await Promise.allSettled([
          get<{ sports: Sport[] }>('/sports'),
          get<Competition[]>('/sports/popular-competitions'),
        ]);

        if (sportsRes.status === 'fulfilled') {
          setSports(sportsRes.value.sports || []);
        }
        if (compsRes.status === 'fulfilled') {
          const data = compsRes.value;
          setPopularCompetitions(
            Array.isArray(data)
              ? data
              : (data as any)?.competitions || []
          );
        }
      } catch {
        // Graceful empty state
      } finally {
        setIsLoadingInitial(false);
      }
    }
    fetchInitialData();
  }, []);

  // --- Derived: sorted sports alphabetically ---
  const sortedSports = useMemo(() => {
    return [...sports].sort((a, b) => a.name.localeCompare(b.name));
  }, [sports]);

  // --- Filtered sports by search ---
  const filteredSports = useMemo(() => {
    if (!searchQuery.trim()) return sortedSports;
    const q = searchQuery.toLowerCase().trim();
    return sortedSports.filter((s) => s.name.toLowerCase().includes(q));
  }, [sortedSports, searchQuery]);

  // --- Filtered competitions by search ---
  const filteredCompetitions = useMemo(() => {
    if (!searchQuery.trim()) return popularCompetitions;
    const q = searchQuery.toLowerCase().trim();
    return popularCompetitions.filter((c) => c.name.toLowerCase().includes(q));
  }, [popularCompetitions, searchQuery]);

  // --- Split trending competitions into two rows ---
  const trendingRow1 = useMemo(() => {
    if (!searchQuery.trim()) {
      const half = Math.ceil(popularCompetitions.length / 2);
      return popularCompetitions.slice(0, half);
    }
    const half = Math.ceil(filteredCompetitions.length / 2);
    return filteredCompetitions.slice(0, half);
  }, [popularCompetitions, filteredCompetitions, searchQuery]);

  const trendingRow2 = useMemo(() => {
    if (!searchQuery.trim()) {
      const half = Math.ceil(popularCompetitions.length / 2);
      return popularCompetitions.slice(half);
    }
    const half = Math.ceil(filteredCompetitions.length / 2);
    return filteredCompetitions.slice(half);
  }, [popularCompetitions, filteredCompetitions, searchQuery]);

  // --- Navigate to competition's sport page on chip tap ---
  const handleCompetitionTap = useCallback(
    (comp: Competition) => {
      const sportSlug = comp.sport?.slug || comp.sportSlug || 'soccer';
      router.push(`/sports/${sportSlug}`);
    },
    [router]
  );

  // --- Render ---
  return (
    <div className="min-h-screen bg-[#0D1117]">
      {/* ================================================================ */}
      {/* Section 1: Search Bar                                            */}
      {/* ================================================================ */}
      {isLoadingInitial ? (
        <SearchBarSkeleton />
      ) : (
        <div className="px-4 pt-4 pb-2">
          <div
            className={cn(
              'relative flex items-center rounded-lg transition-all duration-200',
              isSearchFocused
                ? 'bg-[#1C2128] ring-1 ring-[#8B5CF6]/40'
                : 'bg-[#161B22]'
            )}
          >
            <Search className="w-4.5 h-4.5 text-[#6E7681] ml-3.5 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-[14px] text-[#E6EDF3] placeholder-[#484F58] py-3 px-3 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="p-2 mr-1 hover:bg-[#21262D] rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-[#6E7681]" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Section 2: Trending (horizontal scrollable chips in two rows)    */}
      {/* ================================================================ */}
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-[15px] font-bold text-white mb-3">Trending</h2>

        {isLoadingInitial ? (
          <div className="space-y-2">
            {/* Row 1 skeleton */}
            <div className="flex items-center gap-2 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <TrendingChipSkeleton key={`r1-${i}`} />
              ))}
            </div>
            {/* Row 2 skeleton */}
            <div className="flex items-center gap-2 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <TrendingChipSkeleton key={`r2-${i}`} />
              ))}
            </div>
          </div>
        ) : trendingRow1.length > 0 || trendingRow2.length > 0 ? (
          <div className="space-y-2">
            {/* Row 1 */}
            {trendingRow1.length > 0 && (
              <div
                ref={trendingRow1Ref}
                className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {trendingRow1.map((comp) => (
                  <TrendingChip
                    key={comp.id}
                    competition={comp}
                    onClick={() => handleCompetitionTap(comp)}
                  />
                ))}
              </div>
            )}
            {/* Row 2 */}
            {trendingRow2.length > 0 && (
              <div
                ref={trendingRow2Ref}
                className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {trendingRow2.map((comp) => (
                  <TrendingChip
                    key={comp.id}
                    competition={comp}
                    onClick={() => handleCompetitionTap(comp)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : searchQuery.trim() ? (
          <p className="text-[12px] text-[#484F58] italic py-2">
            No trending competitions match &ldquo;{searchQuery}&rdquo;
          </p>
        ) : null}
      </div>

      {/* Divider */}
      <div className="mx-4 border-b border-[#1E2433]/70 my-1" />

      {/* ================================================================ */}
      {/* Section 3: "All" Sports List                                     */}
      {/* ================================================================ */}
      <div className="pt-3 pb-24">
        <h2 className="text-[15px] font-bold text-white px-4 mb-2">All</h2>

        {isLoadingInitial ? (
          <div>
            {Array.from({ length: 15 }).map((_, i) => (
              <SportRowSkeleton key={i} />
            ))}
          </div>
        ) : filteredSports.length > 0 ? (
          <div>
            {filteredSports.map((sport) => (
              <SportRow key={sport.id} sport={sport} />
            ))}
          </div>
        ) : searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mb-3">
              <Search className="w-5 h-5 text-[#30363D]" />
            </div>
            <h3 className="text-[14px] font-semibold text-[#E6EDF3] mb-1">
              No sports found
            </h3>
            <p className="text-[12px] text-[#6E7681] max-w-xs">
              No sports match &ldquo;{searchQuery}&rdquo;. Try a different search term.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mb-3">
              <span className="text-xl">{'\uD83C\uDFC6'}</span>
            </div>
            <h3 className="text-[14px] font-semibold text-[#E6EDF3] mb-1">
              No sports available
            </h3>
            <p className="text-[12px] text-[#6E7681] max-w-xs">
              Sports will appear here once events are available. Check back soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
