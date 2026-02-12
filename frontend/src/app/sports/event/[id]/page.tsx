'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { sportsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn, formatOdds, formatDate } from '@/lib/utils';
import { ChevronDown, ChevronLeft, MapPin, Calendar, Trophy, BarChart3 } from 'lucide-react';
import type { Event, Market, Selection } from '@/types';

// ---------- Market tab definitions ----------
type MarketTab = 'main' | 'goals' | 'halves' | 'props' | 'specials';

const MARKET_TAB_CONFIG: {
  key: MarketTab;
  label: string;
  types: string[];
}[] = [
  { key: 'main', label: 'Main', types: ['MONEYLINE', 'SPREAD', 'TOTAL'] },
  { key: 'goals', label: 'Goals/Points', types: ['TOTAL', 'OVER_UNDER'] },
  { key: 'halves', label: 'Halves/Quarters', types: ['HALF', 'QUARTER', 'PERIOD'] },
  { key: 'props', label: 'Player Props', types: ['PROP', 'PLAYER_PROP'] },
  { key: 'specials', label: 'Specials', types: ['OUTRIGHT', 'SPECIAL', 'BOOST'] },
];

// ---------- Categorize markets for tab view ----------
function getMarketsForTab(markets: Market[], tab: MarketTab): Market[] {
  if (tab === 'main') {
    // Main includes primary market types
    const mainTypes = new Set(['MONEYLINE', 'SPREAD', 'TOTAL']);
    const mainMarkets = markets.filter((m) => mainTypes.has(m.type));
    // If no typed matches, show all
    return mainMarkets.length > 0 ? mainMarkets : markets;
  }

  const tabConfig = MARKET_TAB_CONFIG.find((t) => t.key === tab);
  if (!tabConfig) return [];

  const matched = markets.filter((m) =>
    tabConfig.types.some((t) => m.type.includes(t) || m.name.toUpperCase().includes(t))
  );
  return matched;
}

// ---------- Collapsible Market Section ----------
function MarketSection({
  market,
  event,
  defaultOpen = true,
}: {
  market: Market;
  event: Event;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { toggleSelection, hasSelection } = useBetSlipStore();

  const handleSelect = (selection: Selection) => {
    if (selection.status !== 'ACTIVE' || market.status !== 'OPEN') return;
    toggleSelection({
      selectionId: selection.id,
      selectionName: selection.name,
      marketName: market.name,
      eventName: event.name,
      eventId: event.id,
      odds: selection.odds,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
  };

  const gridCols =
    market.selections.length === 2
      ? 'grid-cols-2'
      : market.selections.length === 3
        ? 'grid-cols-3'
        : market.selections.length <= 6
          ? 'grid-cols-3'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Market header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-secondary hover:bg-surface-tertiary transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{market.name}</span>
          {market.status === 'SUSPENDED' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-yellow/20 text-accent-yellow font-semibold">
              SUSPENDED
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Selections */}
      {isOpen && (
        <div className="p-3 bg-[#16171a]">
          <div className={cn('grid gap-2', gridCols)}>
            {market.selections.map((sel) => {
              const isSelected = hasSelection(sel.id);
              const isDisabled = sel.status !== 'ACTIVE' || market.status !== 'OPEN';

              return (
                <button
                  key={sel.id}
                  onClick={() => handleSelect(sel)}
                  disabled={isDisabled}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded border transition-all duration-150 min-h-[44px]',
                    isSelected
                      ? 'bg-brand-500/20 border-brand-500'
                      : 'bg-surface-tertiary border-transparent hover:border-brand-500/40 hover:bg-surface-hover',
                    isDisabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <span className={cn(
                    'text-sm truncate mr-2',
                    isSelected ? 'text-brand-400 font-medium' : 'text-gray-300'
                  )}>
                    {sel.name}
                  </span>
                  <span className={cn(
                    'font-mono font-bold text-sm shrink-0',
                    isSelected ? 'text-brand-400' : 'text-white'
                  )}>
                    {formatOdds(sel.odds)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Scoreboard for basketball ----------
function BasketballScoreboard({ event }: { event: Event }) {
  const metadata = event.metadata as Record<string, unknown> | null | undefined;
  if (!metadata) return null;

  // Try to extract quarter scores from metadata
  const quarters: { label: string; home: number | string; away: number | string }[] = [];

  for (let q = 1; q <= 4; q++) {
    const homeKey = `homeQ${q}` as string;
    const awayKey = `awayQ${q}` as string;
    if (metadata[homeKey] !== null && metadata[homeKey] !== undefined || metadata[awayKey] !== null && metadata[awayKey] !== undefined) {
      quarters.push({
        label: `Q${q}`,
        home: (metadata[homeKey] as number | string) ?? '-',
        away: (metadata[awayKey] as number | string) ?? '-',
      });
    }
  }

  // Also check OT
  if (metadata.homeOT !== null && metadata.homeOT !== undefined || metadata.awayOT !== null && metadata.awayOT !== undefined) {
    quarters.push({
      label: 'OT',
      home: (metadata.homeOT as number | string) ?? '-',
      away: (metadata.awayOT as number | string) ?? '-',
    });
  }

  if (quarters.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-secondary">
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-1/3">Team</th>
            {quarters.map((q) => (
              <th key={q.label} className="text-center px-2 py-2 text-xs font-medium text-gray-500">
                {q.label}
              </th>
            ))}
            <th className="text-center px-3 py-2 text-xs font-bold text-gray-400">T</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="px-3 py-2 font-medium text-white">{event.homeTeam}</td>
            {quarters.map((q) => (
              <td key={q.label} className="text-center px-2 py-2 font-mono text-gray-300">
                {q.home}
              </td>
            ))}
            <td className="text-center px-3 py-2 font-mono font-bold text-white">
              {event.homeScore ?? 0}
            </td>
          </tr>
          <tr className="border-t border-border">
            <td className="px-3 py-2 font-medium text-gray-300">{event.awayTeam}</td>
            {quarters.map((q) => (
              <td key={q.label} className="text-center px-2 py-2 font-mono text-gray-400">
                {q.away}
              </td>
            ))}
            <td className="text-center px-3 py-2 font-mono font-bold text-gray-300">
              {event.awayScore ?? 0}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------- Match Info Sidebar ----------
function MatchInfoSidebar({ event }: { event: Event }) {
  const competitionName = event.competition?.name || 'Competition';
  const sportName = event.competition?.sport?.name || 'Sport';
  const metadata = event.metadata as Record<string, unknown> | null | undefined;
  const venue = metadata?.venue as string | undefined;

  return (
    <div className="rounded-lg border border-border bg-surface-secondary overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-tertiary/50">
        <h3 className="text-sm font-semibold text-white">Match Info</h3>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Trophy className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Competition</p>
            <p className="text-sm text-white">{competitionName}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <BarChart3 className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Sport</p>
            <p className="text-sm text-white">{sportName}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Date</p>
            <p className="text-sm text-white">{formatDate(event.startTime)}</p>
          </div>
        </div>
        {venue && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Venue</p>
              <p className="text-sm text-white">{venue}</p>
            </div>
          </div>
        )}
        {event.isLive && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-accent-red/10 border border-accent-red/20">
              <span className="w-2 h-2 bg-accent-red rounded-full animate-pulse" />
              <span className="text-xs font-bold text-accent-red uppercase">Live Now</span>
              {event.metadata?.period && (
                <span className="text-xs text-gray-400 ml-auto">
                  {event.metadata.period}
                  {event.metadata.matchTime ? ` - ${event.metadata.matchTime}` : ''}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Loading Skeleton ----------
function EventDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
      <div className="h-4 w-64 bg-surface-tertiary rounded" />
      <div className="rounded-xl bg-surface-secondary border border-border p-6">
        <div className="h-6 w-48 bg-surface-tertiary rounded mb-6" />
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-6 w-32 bg-surface-tertiary rounded" />
          </div>
          <div className="h-16 w-24 bg-surface-tertiary rounded" />
          <div className="space-y-2 flex-1 flex flex-col items-end">
            <div className="h-6 w-32 bg-surface-tertiary rounded" />
          </div>
        </div>
      </div>
      <div className="h-10 w-full bg-surface-tertiary rounded-lg" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-surface-tertiary rounded-lg" />
      ))}
    </div>
  );
}

// ---------- Main Page Component ----------
export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MarketTab>('main');

  const fetchEvent = useCallback(() => {
    if (!id) return;
    sportsApi
      .getEvent(id)
      .then(({ data }) => {
        setEvent(data.data || null);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load event');
        setIsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  // Subscribe to live updates
  useEffect(() => {
    if (!event?.isLive) return;

    const socket = getSocket();

    const handleScoreUpdate = (data: { eventId: string; homeScore: number; awayScore: number }) => {
      if (data.eventId === id) {
        setEvent((prev) =>
          prev ? { ...prev, homeScore: data.homeScore, awayScore: data.awayScore } : prev
        );
      }
    };

    const handleOddsUpdate = (data: { selectionId: string; odds: string }) => {
      setEvent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          markets: prev.markets?.map((m) => ({
            ...m,
            selections: m.selections.map((s) =>
              s.id === data.selectionId ? { ...s, odds: data.odds } : s
            ),
          })),
        };
      });
    };

    const handleMarketUpdate = (data: { marketId: string; status: Market['status'] }) => {
      setEvent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          markets: prev.markets?.map((m) =>
            m.id === data.marketId ? { ...m, status: data.status } : m
          ),
        };
      });
    };

    socket.on('score:update', handleScoreUpdate);
    socket.on('odds:update', handleOddsUpdate);
    socket.on('market:update', handleMarketUpdate);

    return () => {
      socket.off('score:update', handleScoreUpdate);
      socket.off('odds:update', handleOddsUpdate);
      socket.off('market:update', handleMarketUpdate);
    };
  }, [event?.isLive, id]);

  // Determine the sport type for conditional rendering
  const sportSlug = event?.competition?.sport?.slug || '';
  const isBasketball = sportSlug === 'basketball';

  // Markets for active tab
  const markets = event?.markets || [];
  const tabMarkets = useMemo(
    () => getMarketsForTab(markets, activeTab),
    [markets, activeTab]
  );

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<MarketTab, number> = { main: 0, goals: 0, halves: 0, props: 0, specials: 0 };
    for (const tab of MARKET_TAB_CONFIG) {
      counts[tab.key] = getMarketsForTab(markets, tab.key).length;
    }
    return counts;
  }, [markets]);

  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  if (error || !event) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="rounded-lg border border-border bg-surface-secondary text-center py-16">
          <p className="text-gray-400 text-lg mb-4">{error || 'Event not found'}</p>
          <button onClick={() => router.back()} className="btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const sportName = event.competition?.sport?.name || 'Sport';
  const competitionName = event.competition?.name || 'Competition';

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <Link href="/sports" className="hover:text-brand-400 transition-colors">
          Sports
        </Link>
        <span className="text-gray-700">/</span>
        {event.competition?.sport?.slug ? (
          <Link
            href={`/sports/${event.competition.sport.slug}`}
            className="hover:text-brand-400 transition-colors"
          >
            {sportName}
          </Link>
        ) : (
          <span>{sportName}</span>
        )}
        <span className="text-gray-700">/</span>
        <span className="text-gray-400">{competitionName}</span>
      </nav>

      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* ========== MATCH HEADER ========== */}
      <div className="rounded-xl border border-border bg-gradient-to-b from-surface-secondary to-[#16171a] overflow-hidden">
        {/* Competition bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-surface-tertiary/30">
          <div className="flex items-center gap-2">
            {event.isLive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-red/20 border border-accent-red/30">
                <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-accent-red uppercase tracking-wide">Live</span>
              </span>
            )}
            <span className="text-xs text-gray-400">{competitionName}</span>
          </div>
          <span className="text-xs text-gray-500">
            {event.isLive && event.metadata?.period
              ? `${event.metadata.period}${event.metadata.matchTime ? ` - ${event.metadata.matchTime}` : ''}`
              : formatDate(event.startTime)}
          </span>
        </div>

        {/* Teams and Score Display */}
        <div className="px-5 py-6">
          <div className="flex items-center justify-between">
            {/* Home Team */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-surface-tertiary border border-border flex items-center justify-center">
                {event.homeTeamLogo ? (
                  <img
                    src={event.homeTeamLogo}
                    alt={event.homeTeam || ''}
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {(event.homeTeam || event.name).charAt(0)}
                  </span>
                )}
              </div>
              <p className="font-bold text-lg text-white">{event.homeTeam || event.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">Home</p>
            </div>

            {/* Score / VS */}
            <div className="px-8 text-center shrink-0">
              {event.isLive ? (
                <div>
                  <div className="flex items-center gap-4">
                    <span className="text-5xl font-black font-mono text-white leading-none">
                      {event.homeScore ?? 0}
                    </span>
                    <span className="text-xl text-gray-600 font-light">:</span>
                    <span className="text-5xl font-black font-mono text-white leading-none">
                      {event.awayScore ?? 0}
                    </span>
                  </div>
                  {event.metadata?.matchTime && (
                    <div className="mt-2 flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-accent-red rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-accent-red">{event.metadata.matchTime}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <span className="text-3xl font-bold text-gray-600">VS</span>
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(event.startTime).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(event.startTime).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-surface-tertiary border border-border flex items-center justify-center">
                {event.awayTeamLogo ? (
                  <img
                    src={event.awayTeamLogo}
                    alt={event.awayTeam || ''}
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {(event.awayTeam || '?').charAt(0)}
                  </span>
                )}
              </div>
              <p className="font-bold text-lg text-white">{event.awayTeam || 'TBD'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Away</p>
            </div>
          </div>

          {/* Basketball Scoreboard */}
          {isBasketball && event.isLive && <BasketballScoreboard event={event} />}
        </div>
      </div>

      {/* ========== MAIN CONTENT AREA ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Left: Markets */}
        <div className="space-y-4">
          {/* Market Tabs */}
          {markets.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide bg-surface-secondary rounded-lg border border-border p-1">
              {MARKET_TAB_CONFIG.map((tab) => {
                const count = tabCounts[tab.key];
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all',
                      activeTab === tab.key
                        ? 'bg-brand-500/15 text-brand-400'
                        : count > 0
                          ? 'text-gray-400 hover:text-white hover:bg-surface-tertiary'
                          : 'text-gray-600 cursor-default'
                    )}
                    disabled={count === 0}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={cn(
                        'text-[10px] ml-0.5',
                        activeTab === tab.key ? 'text-brand-400/70' : 'text-gray-600'
                      )}>
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Market Sections */}
          {markets.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-secondary text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-gray-600 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-gray-400 text-lg font-medium">No markets available</p>
              <p className="text-gray-500 text-sm mt-1">
                Markets for this event have not been published yet.
              </p>
            </div>
          ) : tabMarkets.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-secondary text-center py-8">
              <p className="text-gray-400">No markets in this category</p>
              <p className="text-gray-600 text-sm mt-1">
                Try the &ldquo;Main&rdquo; tab for available markets.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tabMarkets.map((market, idx) => (
                <MarketSection
                  key={market.id}
                  market={market}
                  event={event}
                  defaultOpen={idx < 5}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Match Info Sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-4">
            <MatchInfoSidebar event={event} />

            {/* Quick Stats */}
            {event.isLive && (
              <div className="mt-4 rounded-lg border border-border bg-surface-secondary overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-surface-tertiary/50">
                  <h3 className="text-sm font-semibold text-white">Quick Stats</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Status</p>
                    <p className="text-xs font-semibold text-accent-green">In Play</p>
                  </div>
                  <div className="bg-surface-tertiary rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Markets</p>
                    <p className="text-xs font-semibold text-white">{markets.length}</p>
                  </div>
                  <div className="col-span-2 bg-surface-tertiary rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Score</p>
                    <p className="text-lg font-bold font-mono text-white">
                      {event.homeScore ?? 0} - {event.awayScore ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only Match Info (below markets) */}
      <div className="lg:hidden">
        <MatchInfoSidebar event={event} />
      </div>
    </div>
  );
}
