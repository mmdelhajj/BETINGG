'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { SportIcon } from '@/components/sports/SportIcon';
import { cn, formatOdds } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Radio,
  Calendar,
  CalendarDays,
  Award,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────────

type TimeFilter = 'all' | 'live' | 'today' | 'tomorrow' | 'outrights';

interface MockSelection {
  id: string;
  name: string;
  outcome: string;
  odds: string;
  status: 'ACTIVE' | 'SUSPENDED';
  marketId: string;
}

interface MockMarket {
  id: string;
  name: string;
  type: string;
  status: 'OPEN' | 'SUSPENDED';
  selections: MockSelection[];
}

interface MockEvent {
  id: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  isLive: boolean;
  status: 'UPCOMING' | 'LIVE';
  homeScore: number | null;
  awayScore: number | null;
  matchTime: string | null;
  period: string | null;
  competitionId: string;
  markets: MockMarket[];
  totalMarkets: number;
}

interface MockCompetition {
  id: string;
  name: string;
  country: string;
  countryFlag: string;
}

// ────────────────────────────────────────────────────────────────
//  Sport configuration
// ────────────────────────────────────────────────────────────────

interface MarketColumnDef {
  key: string;
  label: string;
  outcomes: { key: string; label: string }[];
}

interface SportConfig {
  name: string;
  icon: string | null;
  hasDrawMarket: boolean;
  marketColumns: MarketColumnDef[];
  competitions: MockCompetition[];
  events: MockEvent[];
}

// ────────────────────────────────────────────────────────────────
//  Helper: generate ID
// ────────────────────────────────────────────────────────────────

let _idCounter = 1000;
function uid(prefix = 'id') {
  return `${prefix}-${++_idCounter}`;
}

function sel(
  marketId: string,
  name: string,
  outcome: string,
  odds: string
): MockSelection {
  return {
    id: uid('sel'),
    name,
    outcome,
    odds,
    status: 'ACTIVE',
    marketId,
  };
}

function market1x2(
  homeOdds: string,
  drawOdds: string,
  awayOdds: string,
  home: string,
  away: string
): MockMarket {
  const mid = uid('mkt');
  return {
    id: mid,
    name: 'Full Time Result',
    type: '1X2',
    status: 'OPEN',
    selections: [
      sel(mid, home, 'home', homeOdds),
      sel(mid, 'Draw', 'draw', drawOdds),
      sel(mid, away, 'away', awayOdds),
    ],
  };
}

function marketML(
  homeOdds: string,
  awayOdds: string,
  home: string,
  away: string
): MockMarket {
  const mid = uid('mkt');
  return {
    id: mid,
    name: 'Moneyline',
    type: 'MONEYLINE',
    status: 'OPEN',
    selections: [
      sel(mid, home, 'home', homeOdds),
      sel(mid, away, 'away', awayOdds),
    ],
  };
}

function marketSpread(
  homeLine: string,
  homeOdds: string,
  awayLine: string,
  awayOdds: string
): MockMarket {
  const mid = uid('mkt');
  return {
    id: mid,
    name: 'Spread',
    type: 'SPREAD',
    status: 'OPEN',
    selections: [
      sel(mid, homeLine, 'home', homeOdds),
      sel(mid, awayLine, 'away', awayOdds),
    ],
  };
}

function marketTotal(
  line: string,
  overOdds: string,
  underOdds: string
): MockMarket {
  const mid = uid('mkt');
  return {
    id: mid,
    name: `Total ${line}`,
    type: 'TOTAL',
    status: 'OPEN',
    selections: [
      sel(mid, `O ${line}`, 'over', overOdds),
      sel(mid, `U ${line}`, 'under', underOdds),
    ],
  };
}

// ────────────────────────────────────────────────────────────────
//  Date helpers
// ────────────────────────────────────────────────────────────────

function hoursFromNow(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

function todayAt(hour: number, min = 0): string {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function tomorrowAt(hour: number, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

// ────────────────────────────────────────────────────────────────
//  Mock data factories per sport
// ────────────────────────────────────────────────────────────────

function getSportConfig(slug: string): SportConfig {
  switch (slug) {
    case 'soccer':
    case 'football': {
      const competitions: MockCompetition[] = [
        { id: 'comp-epl', name: 'Premier League', country: 'England', countryFlag: '🇬🇧' },
        { id: 'comp-laliga', name: 'La Liga', country: 'Spain', countryFlag: '🇪🇸' },
        { id: 'comp-seriea', name: 'Serie A', country: 'Italy', countryFlag: '🇮🇹' },
        { id: 'comp-ucl', name: 'Champions League', country: 'Europe', countryFlag: '🇪🇺' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-s1', name: 'Arsenal vs Chelsea', homeTeam: 'Arsenal', awayTeam: 'Chelsea', startTime: hoursFromNow(-0.5), isLive: true, status: 'LIVE', homeScore: 1, awayScore: 0, matchTime: "34'", period: '1st Half', competitionId: 'comp-epl', markets: [market1x2('1.55', '4.20', '5.50', 'Arsenal', 'Chelsea')], totalMarkets: 142 },
        { id: 'ev-s2', name: 'Liverpool vs Man City', homeTeam: 'Liverpool', awayTeam: 'Manchester City', startTime: hoursFromNow(-0.25), isLive: true, status: 'LIVE', homeScore: 2, awayScore: 2, matchTime: "67'", period: '2nd Half', competitionId: 'comp-epl', markets: [market1x2('3.10', '3.25', '2.40', 'Liverpool', 'Man City')], totalMarkets: 138 },
        { id: 'ev-s3', name: 'Tottenham vs Aston Villa', homeTeam: 'Tottenham', awayTeam: 'Aston Villa', startTime: todayAt(17, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-epl', markets: [market1x2('2.10', '3.50', '3.40', 'Tottenham', 'Aston Villa')], totalMarkets: 125 },
        { id: 'ev-s4', name: 'Real Madrid vs Barcelona', homeTeam: 'Real Madrid', awayTeam: 'Barcelona', startTime: todayAt(20, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-laliga', markets: [market1x2('2.50', '3.30', '2.80', 'Real Madrid', 'Barcelona')], totalMarkets: 156 },
        { id: 'ev-s5', name: 'Atletico Madrid vs Sevilla', homeTeam: 'Atletico Madrid', awayTeam: 'Sevilla', startTime: todayAt(18, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-laliga', markets: [market1x2('1.75', '3.60', '4.80', 'Atl. Madrid', 'Sevilla')], totalMarkets: 118 },
        { id: 'ev-s6', name: 'AC Milan vs Juventus', homeTeam: 'AC Milan', awayTeam: 'Juventus', startTime: todayAt(19, 45), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-seriea', markets: [market1x2('2.30', '3.10', '3.20', 'AC Milan', 'Juventus')], totalMarkets: 132 },
        { id: 'ev-s7', name: 'Inter Milan vs Napoli', homeTeam: 'Inter Milan', awayTeam: 'Napoli', startTime: tomorrowAt(20, 45), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-seriea', markets: [market1x2('1.90', '3.40', '4.00', 'Inter', 'Napoli')], totalMarkets: 128 },
        { id: 'ev-s8', name: 'Bayern Munich vs PSG', homeTeam: 'Bayern Munich', awayTeam: 'PSG', startTime: tomorrowAt(21, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ucl', markets: [market1x2('1.85', '3.80', '3.90', 'Bayern', 'PSG')], totalMarkets: 148 },
      ];
      return {
        name: slug === 'soccer' ? 'Soccer' : 'Football',
        icon: null,
        hasDrawMarket: true,
        marketColumns: [
          {
            key: '1X2',
            label: 'Full Time Result',
            outcomes: [
              { key: 'home', label: '1' },
              { key: 'draw', label: 'X' },
              { key: 'away', label: '2' },
            ],
          },
        ],
        competitions,
        events,
      };
    }

    case 'basketball': {
      const competitions: MockCompetition[] = [
        { id: 'comp-nba', name: 'NBA', country: 'USA', countryFlag: '🇺🇸' },
        { id: 'comp-euroleague', name: 'EuroLeague', country: 'Europe', countryFlag: '🇪🇺' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-b1', name: 'Lakers vs Celtics', homeTeam: 'LA Lakers', awayTeam: 'Boston Celtics', startTime: hoursFromNow(-0.75), isLive: true, status: 'LIVE', homeScore: 78, awayScore: 82, matchTime: 'Q3 4:32', period: '3rd Quarter', competitionId: 'comp-nba', markets: [marketML('2.10', '1.75', 'Lakers', 'Celtics'), marketSpread('+3.5', '1.91', '-3.5', '1.91'), marketTotal('221.5', '1.91', '1.91')], totalMarkets: 95 },
        { id: 'ev-b2', name: 'Warriors vs Bucks', homeTeam: 'Golden State Warriors', awayTeam: 'Milwaukee Bucks', startTime: hoursFromNow(-0.3), isLive: true, status: 'LIVE', homeScore: 54, awayScore: 48, matchTime: 'Q2 1:15', period: '2nd Quarter', competitionId: 'comp-nba', markets: [marketML('1.65', '2.25', 'Warriors', 'Bucks'), marketSpread('-4.5', '1.91', '+4.5', '1.91'), marketTotal('228.5', '1.91', '1.91')], totalMarkets: 88 },
        { id: 'ev-b3', name: 'Nuggets vs 76ers', homeTeam: 'Denver Nuggets', awayTeam: 'Philadelphia 76ers', startTime: todayAt(19, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nba', markets: [marketML('1.55', '2.45', 'Nuggets', '76ers'), marketSpread('-5.5', '1.91', '+5.5', '1.91'), marketTotal('218.5', '1.91', '1.91')], totalMarkets: 92 },
        { id: 'ev-b4', name: 'Mavericks vs Suns', homeTeam: 'Dallas Mavericks', awayTeam: 'Phoenix Suns', startTime: todayAt(21, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nba', markets: [marketML('1.80', '2.00', 'Mavericks', 'Suns'), marketSpread('-1.5', '1.91', '+1.5', '1.91'), marketTotal('224.5', '1.91', '1.91')], totalMarkets: 85 },
      ];
      return {
        name: 'Basketball',
        icon: null,
        hasDrawMarket: false,
        marketColumns: [
          { key: 'MONEYLINE', label: 'Moneyline', outcomes: [{ key: 'home', label: '1' }, { key: 'away', label: '2' }] },
          { key: 'SPREAD', label: 'Spread', outcomes: [{ key: 'home', label: 'H' }, { key: 'away', label: 'A' }] },
          { key: 'TOTAL', label: 'Total', outcomes: [{ key: 'over', label: 'O' }, { key: 'under', label: 'U' }] },
        ],
        competitions,
        events,
      };
    }

    default: {
      const displayName = slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const competitions: MockCompetition[] = [
        { id: 'comp-def1', name: `${displayName} World Championship`, country: 'International', countryFlag: '🌍' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-d1', name: 'Team A vs Team B', homeTeam: 'Team Alpha', awayTeam: 'Team Beta', startTime: hoursFromNow(-0.3), isLive: true, status: 'LIVE', homeScore: 2, awayScore: 1, matchTime: "25'", period: null, competitionId: 'comp-def1', markets: [marketML('1.65', '2.25', 'Team Alpha', 'Team Beta')], totalMarkets: 45 },
        { id: 'ev-d2', name: 'Team C vs Team D', homeTeam: 'Team Gamma', awayTeam: 'Team Delta', startTime: todayAt(16, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def1', markets: [marketML('1.90', '1.90', 'Team Gamma', 'Team Delta')], totalMarkets: 38 },
      ];
      return {
        name: displayName,
        icon: null,
        hasDrawMarket: false,
        marketColumns: [
          { key: 'MONEYLINE', label: 'Winner', outcomes: [{ key: 'home', label: '1' }, { key: 'away', label: '2' }] },
        ],
        competitions,
        events,
      };
    }
  }
}

// ────────────────────────────────────────────────────────────────
//  Odds Button - min 44px height, 64px width
// ────────────────────────────────────────────────────────────────

function OddsButton({
  selection,
  label,
  isSelected,
  onSelect,
}: {
  selection: MockSelection | null;
  label?: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  if (!selection) {
    return (
      <div className="flex-1 min-w-[64px] min-h-[44px] rounded bg-white/[0.04] flex items-center justify-center">
        <span className="text-xs text-gray-600">-</span>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        'flex-1 min-w-[64px] min-h-[44px] rounded flex flex-col items-center justify-center font-mono text-sm font-bold transition-all',
        isSelected
          ? 'bg-purple-600/25 ring-1 ring-purple-500 text-purple-400'
          : 'bg-white/[0.06] hover:bg-white/[0.10] text-white active:scale-95',
        selection.status !== 'ACTIVE' && 'opacity-40 cursor-not-allowed'
      )}
      disabled={selection.status !== 'ACTIVE'}
      title={label}
    >
      {label && <span className="text-[11px] text-gray-500 font-normal mb-0.5">{label}</span>}
      <span>{formatOdds(selection.odds)}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
//  Event Row - mobile first responsive
// ────────────────────────────────────────────────────────────────

function EventRow({
  event,
  marketColumns,
}: {
  event: MockEvent;
  marketColumns: MarketColumnDef[];
}) {
  const { toggleSelection, hasSelection } = useBetSlipStore();
  const isLive = event.isLive || event.status === 'LIVE';

  const handleSelect = (mkt: MockMarket, sel: MockSelection) => {
    toggleSelection({
      selectionId: sel.id,
      selectionName: sel.name,
      marketName: mkt.name,
      eventName: event.name,
      eventId: event.id,
      odds: sel.odds,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
    });
  };

  return (
    <Link
      href={`/sports/event/${event.id}`}
      className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] last:border-b-0"
    >
      {/* Time / Live indicator - min 44px touch target */}
      <div className="flex items-center md:w-20 shrink-0 min-h-[44px]">
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-red-500 uppercase">Live</span>
              {event.matchTime && (
                <span className="text-[11px] text-gray-500">{event.matchTime}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-[11px] text-gray-400">
              {new Date(event.startTime).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span className="text-[11px] text-gray-500">
              {new Date(event.startTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Teams + Score - line-clamp-2 on mobile for long names */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            'text-sm font-medium line-clamp-2',
            isLive ? 'text-white' : 'text-gray-200'
          )}>
            {event.homeTeam}
          </span>
          {isLive && event.homeScore !== null && (
            <span className="text-sm font-bold font-mono text-white ml-auto shrink-0 tabular-nums">
              {event.homeScore}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-medium line-clamp-2',
            isLive ? 'text-gray-300' : 'text-gray-400'
          )}>
            {event.awayTeam}
          </span>
          {isLive && event.awayScore !== null && (
            <span className="text-sm font-bold font-mono text-gray-300 ml-auto shrink-0 tabular-nums">
              {event.awayScore}
            </span>
          )}
        </div>
      </div>

      {/* Odds columns - stack on tiny screens, 3-col on mobile+ */}
      <div className="flex flex-wrap gap-2 md:gap-3 shrink-0">
        {marketColumns.map((colDef) => {
          const mkt = event.markets.find((m) => m.type === colDef.key);
          return (
            <div key={colDef.key} className="flex items-center gap-1">
              {colDef.outcomes.map((outcome) => {
                const s = mkt?.selections.find((sel) => sel.outcome === outcome.key) || null;
                return (
                  <OddsButton
                    key={outcome.key}
                    selection={s}
                    label={outcome.label}
                    isSelected={s ? hasSelection(s.id) : false}
                    onSelect={() => s && mkt && handleSelect(mkt, s)}
                  />
                );
              })}
            </div>
          );
        })}

        {/* More markets indicator */}
        {event.totalMarkets > 1 && (
          <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
            <span className="text-[11px] text-purple-400 font-semibold">
              +{event.totalMarkets - event.markets.length}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────
//  Competition Group
// ────────────────────────────────────────────────────────────────

function CompetitionGroup({
  competition,
  events,
  marketColumns,
  defaultOpen = true,
}: {
  competition: MockCompetition;
  events: MockEvent[];
  marketColumns: MarketColumnDef[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-white/8 overflow-hidden">
      {/* Competition Header - min 44px touch target */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[44px] flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/[0.07] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{competition.countryFlag}</span>
          <span className="text-sm font-semibold text-white truncate">
            {competition.name}
          </span>
          <span className="text-xs text-gray-500 shrink-0">({events.length})</span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Column headers - hide on mobile, show on md+ */}
      {isOpen && (
        <div className="bg-white/[0.02]">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 border-b border-white/[0.04] bg-white/[0.03]">
            <div className="w-20 shrink-0 text-[11px] text-gray-500 uppercase tracking-wider">Time</div>
            <div className="flex-1 text-[11px] text-gray-500 uppercase tracking-wider">Match</div>
            <div className="flex items-center gap-3 shrink-0">
              {marketColumns.map((colDef) => (
                <div key={colDef.key} className="flex items-center gap-1">
                  {colDef.outcomes.map((outcome) => (
                    <div
                      key={outcome.key}
                      className="min-w-[64px] text-center"
                    >
                      <span className="text-[11px] text-gray-500 uppercase font-semibold tracking-wider">
                        {outcome.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="min-w-[44px]" />
            </div>
          </div>

          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              marketColumns={marketColumns}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
//  Main Page Component
// ────────────────────────────────────────────────────────────────

export default function SportPage() {
  const { slug } = useParams<{ slug: string }>();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const config = useMemo(() => getSportConfig(slug), [slug]);

  const filteredEvents = useMemo(() => {
    switch (timeFilter) {
      case 'live':
        return config.events.filter((e) => e.isLive || e.status === 'LIVE');
      case 'today':
        return config.events.filter((e) => isToday(e.startTime));
      case 'tomorrow':
        return config.events.filter((e) => isTomorrow(e.startTime));
      case 'outrights':
        return [];
      default:
        return config.events;
    }
  }, [config.events, timeFilter]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aLive = a.isLive || a.status === 'LIVE' ? 0 : 1;
      const bLive = b.isLive || b.status === 'LIVE' ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [filteredEvents]);

  const groupedByCompetition = useMemo(() => {
    const groups: { competition: MockCompetition; events: MockEvent[] }[] = [];
    const map = new Map<string, MockEvent[]>();

    for (const event of sortedEvents) {
      if (!map.has(event.competitionId)) {
        map.set(event.competitionId, []);
      }
      map.get(event.competitionId)!.push(event);
    }

    for (const [compId, events] of Array.from(map.entries())) {
      const comp = config.competitions.find((c) => c.id === compId);
      if (comp) {
        groups.push({ competition: comp, events });
      }
    }

    return groups;
  }, [sortedEvents, config.competitions]);

  const liveCount = useMemo(
    () => config.events.filter((e) => e.isLive || e.status === 'LIVE').length,
    [config.events]
  );
  const todayCount = useMemo(
    () => config.events.filter((e) => isToday(e.startTime)).length,
    [config.events]
  );
  const tomorrowCount = useMemo(
    () => config.events.filter((e) => isTomorrow(e.startTime)).length,
    [config.events]
  );

  const filterTabs: {
    key: TimeFilter;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }[] = [
    { key: 'all', label: 'All', count: config.events.length, icon: null },
    {
      key: 'live',
      label: 'Live',
      count: liveCount,
      icon: <Radio className="w-3 h-3" />,
    },
    {
      key: 'today',
      label: 'Today',
      count: todayCount,
      icon: <Calendar className="w-3 h-3" />,
    },
    {
      key: 'tomorrow',
      label: 'Tomorrow',
      count: tomorrowCount,
      icon: <CalendarDays className="w-3 h-3" />,
    },
    {
      key: 'outrights',
      label: 'Outrights',
      icon: <Award className="w-3 h-3" />,
    },
  ];

  return (
    <div className="w-full px-4 max-w-6xl mx-auto pb-8 space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/sports"
          className="hover:text-purple-400 transition-colors min-h-[44px] flex items-center"
        >
          Sports
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-700" />
        <span className="text-white font-medium">{config.name}</span>
      </nav>

      {/* Sport Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
          <SportIcon slug={slug} size={28} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{config.name}</h1>
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-red-400">
                  {liveCount} Live
                </span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {config.events.length} events across {config.competitions.length} competitions
          </p>
        </div>
      </div>

      {/* Date/League Filter Tabs - horizontal scroll, 44px min height, snap */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory border-b border-white/8">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTimeFilter(tab.key)}
              className={cn(
                'min-h-[44px] flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap transition-all relative snap-start',
                timeFilter === tab.key
                  ? tab.key === 'live'
                    ? 'text-red-400'
                    : 'text-purple-400'
                  : 'text-gray-400 hover:text-white',
                timeFilter === tab.key &&
                  'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full',
                timeFilter === tab.key &&
                  (tab.key === 'live' ? 'after:bg-red-500' : 'after:bg-purple-500')
              )}
            >
              {tab.key === 'live' && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
              {tab.key !== 'live' && tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded-full font-semibold',
                    timeFilter === tab.key
                      ? tab.key === 'live'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-purple-500/15 text-purple-400'
                      : 'bg-white/10 text-gray-500'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0b0d] to-transparent pointer-events-none" />
      </div>

      {/* Event groups */}
      {sortedEvents.length === 0 ? (
        <div className="rounded-lg border border-white/8 bg-white/[0.02] text-center py-20">
          <p className="text-gray-400 text-lg font-medium mb-1">
            No events found
          </p>
          <p className="text-sm text-gray-600">
            {timeFilter !== 'all'
              ? 'Try selecting a different time filter.'
              : 'Events will appear here when scheduled.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByCompetition.map(({ competition, events }) => (
            <CompetitionGroup
              key={competition.id}
              competition={competition}
              events={events}
              marketColumns={config.marketColumns}
              defaultOpen={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
