'use client';

import Link from 'next/link';
import { Flame, Dice6 } from 'lucide-react';
import { EventCard } from '@/components/sports/EventCard';
import { cn } from '@/lib/utils';
import type { Event } from '@/types';

// ============================================================
// MOCK DATA
// ============================================================

function mockEvent(overrides: Partial<Event> & { id: string; name: string }): Event {
  return {
    slug: overrides.id,
    homeTeam: null,
    awayTeam: null,
    homeTeamLogo: null,
    awayTeamLogo: null,
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'UPCOMING',
    sportId: '1',
    competitionId: '1',
    isLive: false,
    isFeatured: false,
    metadata: null,
    ...overrides,
  };
}

const MOCK_LIVE_EVENTS: Event[] = [
  mockEvent({
    id: 'live-1',
    name: 'Manchester City vs Arsenal',
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    homeScore: 2,
    awayScore: 1,
    isLive: true,
    status: 'LIVE',
    metadata: { matchTime: "67'", period: '2nd Half' },
    competition: {
      id: 'c1',
      name: 'Premier League',
      slug: 'premier-league',
      country: 'England',
      sportId: 's1',
      sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 },
    },
    markets: [
      {
        id: 'm1',
        name: 'Match Winner',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sel-1', name: 'Manchester City', outcome: 'home', odds: '1.65', status: 'ACTIVE', marketId: 'm1' },
          { id: 'sel-2', name: 'Draw', outcome: 'draw', odds: '4.20', status: 'ACTIVE', marketId: 'm1' },
          { id: 'sel-3', name: 'Arsenal', outcome: 'away', odds: '5.50', status: 'ACTIVE', marketId: 'm1' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'live-2',
    name: 'Real Madrid vs Barcelona',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    homeScore: 1,
    awayScore: 1,
    isLive: true,
    status: 'LIVE',
    metadata: { matchTime: "34'", period: '1st Half' },
    competition: {
      id: 'c2',
      name: 'La Liga',
      slug: 'la-liga',
      country: 'Spain',
      sportId: 's1',
      sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 },
    },
    markets: [
      {
        id: 'm2',
        name: 'Match Winner',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sel-4', name: 'Real Madrid', outcome: 'home', odds: '2.10', status: 'ACTIVE', marketId: 'm2' },
          { id: 'sel-5', name: 'Draw', outcome: 'draw', odds: '3.40', status: 'ACTIVE', marketId: 'm2' },
          { id: 'sel-6', name: 'Barcelona', outcome: 'away', odds: '3.25', status: 'ACTIVE', marketId: 'm2' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'live-3',
    name: 'Lakers vs Celtics',
    homeTeam: 'LA Lakers',
    awayTeam: 'Boston Celtics',
    homeScore: 87,
    awayScore: 92,
    isLive: true,
    status: 'LIVE',
    metadata: { matchTime: 'Q3 4:22', period: 'Q3' },
    competition: {
      id: 'c3',
      name: 'NBA',
      slug: 'nba',
      country: 'USA',
      sportId: 's2',
      sport: { id: 's2', name: 'Basketball', slug: 'basketball', icon: null, isActive: true, sortOrder: 2 },
    },
    markets: [
      {
        id: 'm3',
        name: 'Moneyline',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sel-7', name: 'LA Lakers', outcome: 'home', odds: '2.40', status: 'ACTIVE', marketId: 'm3' },
          { id: 'sel-8', name: 'Boston Celtics', outcome: 'away', odds: '1.55', status: 'ACTIVE', marketId: 'm3' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'live-4',
    name: 'Bayern Munich vs Dortmund',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    homeScore: 3,
    awayScore: 0,
    isLive: true,
    status: 'LIVE',
    metadata: { matchTime: "72'", period: '2nd Half' },
    competition: {
      id: 'c5',
      name: 'Bundesliga',
      slug: 'bundesliga',
      country: 'Germany',
      sportId: 's1',
      sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 },
    },
    markets: [
      {
        id: 'm5',
        name: 'Match Winner',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sel-11', name: 'Bayern Munich', outcome: 'home', odds: '1.05', status: 'ACTIVE', marketId: 'm5' },
          { id: 'sel-12', name: 'Draw', outcome: 'draw', odds: '12.00', status: 'ACTIVE', marketId: 'm5' },
          { id: 'sel-13', name: 'Borussia Dortmund', outcome: 'away', odds: '25.00', status: 'ACTIVE', marketId: 'm5' },
        ],
      },
    ],
  }),
];

const MOCK_POPULAR_EVENTS: Event[] = [
  mockEvent({
    id: 'pop-1',
    name: 'Liverpool vs Chelsea',
    homeTeam: 'Liverpool',
    awayTeam: 'Chelsea',
    isFeatured: true,
    startTime: new Date(Date.now() + 7200000).toISOString(),
    competition: {
      id: 'c1',
      name: 'Premier League',
      slug: 'premier-league',
      country: 'England',
      sportId: 's1',
      sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 },
    },
    markets: [
      {
        id: 'mp1',
        name: 'Match Winner',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sp-1', name: 'Liverpool', outcome: 'home', odds: '1.90', status: 'ACTIVE', marketId: 'mp1' },
          { id: 'sp-2', name: 'Draw', outcome: 'draw', odds: '3.50', status: 'ACTIVE', marketId: 'mp1' },
          { id: 'sp-3', name: 'Chelsea', outcome: 'away', odds: '3.80', status: 'ACTIVE', marketId: 'mp1' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'pop-2',
    name: 'PSG vs Juventus',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Juventus',
    isFeatured: true,
    startTime: new Date(Date.now() + 10800000).toISOString(),
    competition: {
      id: 'c6',
      name: 'Champions League',
      slug: 'champions-league',
      country: null,
      sportId: 's1',
      sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 },
    },
    markets: [
      {
        id: 'mp2',
        name: 'Match Winner',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sp-4', name: 'PSG', outcome: 'home', odds: '1.75', status: 'ACTIVE', marketId: 'mp2' },
          { id: 'sp-5', name: 'Draw', outcome: 'draw', odds: '3.80', status: 'ACTIVE', marketId: 'mp2' },
          { id: 'sp-6', name: 'Juventus', outcome: 'away', odds: '4.50', status: 'ACTIVE', marketId: 'mp2' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'pop-3',
    name: 'Warriors vs Bucks',
    homeTeam: 'Golden State Warriors',
    awayTeam: 'Milwaukee Bucks',
    isFeatured: true,
    startTime: new Date(Date.now() + 14400000).toISOString(),
    competition: {
      id: 'c3',
      name: 'NBA',
      slug: 'nba',
      country: 'USA',
      sportId: 's2',
      sport: { id: 's2', name: 'Basketball', slug: 'basketball', icon: null, isActive: true, sortOrder: 2 },
    },
    markets: [
      {
        id: 'mp3',
        name: 'Moneyline',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sp-7', name: 'Warriors', outcome: 'home', odds: '2.15', status: 'ACTIVE', marketId: 'mp3' },
          { id: 'sp-8', name: 'Bucks', outcome: 'away', odds: '1.70', status: 'ACTIVE', marketId: 'mp3' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'pop-4',
    name: 'Inter Milan vs Napoli',
    homeTeam: 'Inter Milan',
    awayTeam: 'Napoli',
    isFeatured: true,
    startTime: new Date(Date.now() + 21600000).toISOString(),
    competition: {
      id: 'c7',
      name: 'Serie A',
      slug: 'serie-a',
      country: 'Italy',
      sportId: 's1',
      sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 },
    },
    markets: [
      {
        id: 'mp5',
        name: 'Match Winner',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sp-11', name: 'Inter Milan', outcome: 'home', odds: '2.00', status: 'ACTIVE', marketId: 'mp5' },
          { id: 'sp-12', name: 'Draw', outcome: 'draw', odds: '3.30', status: 'ACTIVE', marketId: 'mp5' },
          { id: 'sp-13', name: 'Napoli', outcome: 'away', odds: '3.60', status: 'ACTIVE', marketId: 'mp5' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'pop-5',
    name: 'Chiefs vs 49ers',
    homeTeam: 'Kansas City Chiefs',
    awayTeam: 'San Francisco 49ers',
    isFeatured: true,
    startTime: new Date(Date.now() + 25200000).toISOString(),
    competition: {
      id: 'c8',
      name: 'NFL',
      slug: 'nfl',
      country: 'USA',
      sportId: 's4',
      sport: { id: 's4', name: 'American Football', slug: 'american-football', icon: null, isActive: true, sortOrder: 4 },
    },
    markets: [
      {
        id: 'mp6',
        name: 'Moneyline',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sp-14', name: 'Chiefs', outcome: 'home', odds: '1.85', status: 'ACTIVE', marketId: 'mp6' },
          { id: 'sp-15', name: '49ers', outcome: 'away', odds: '1.95', status: 'ACTIVE', marketId: 'mp6' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'pop-6',
    name: 'Atletico Madrid vs Sevilla',
    homeTeam: 'Atletico Madrid',
    awayTeam: 'Sevilla',
    isFeatured: true,
    startTime: new Date(Date.now() + 28800000).toISOString(),
    competition: {
      id: 'c2',
      name: 'La Liga',
      slug: 'la-liga',
      country: 'Spain',
      sportId: 's1',
      sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 },
    },
    markets: [
      {
        id: 'mp7',
        name: 'Match Winner',
        type: 'MONEYLINE',
        status: 'OPEN',
        selections: [
          { id: 'sp-16', name: 'Atletico Madrid', outcome: 'home', odds: '1.60', status: 'ACTIVE', marketId: 'mp7' },
          { id: 'sp-17', name: 'Draw', outcome: 'draw', odds: '3.90', status: 'ACTIVE', marketId: 'mp7' },
          { id: 'sp-18', name: 'Sevilla', outcome: 'away', odds: '5.20', status: 'ACTIVE', marketId: 'mp7' },
        ],
      },
    ],
  }),
];

const TOP_LEAGUES = [
  { name: 'Premier League', slug: 'football', competition: 'premier-league', flag: 'EN' },
  { name: 'La Liga', slug: 'football', competition: 'la-liga', flag: 'ES' },
  { name: 'Champions League', slug: 'football', competition: 'champions-league', flag: 'EU' },
  { name: 'Bundesliga', slug: 'football', competition: 'bundesliga', flag: 'DE' },
  { name: 'Serie A', slug: 'football', competition: 'serie-a', flag: 'IT' },
  { name: 'Ligue 1', slug: 'football', competition: 'ligue-1', flag: 'FR' },
  { name: 'NBA', slug: 'basketball', competition: 'nba', flag: 'US' },
  { name: 'NFL', slug: 'american-football', competition: 'nfl', flag: 'US' },
  { name: 'NHL', slug: 'ice-hockey', competition: 'nhl', flag: 'US' },
];

const MOCK_CASINO_GAMES = [
  { slug: 'crash', name: 'Crash', gradient: 'from-orange-600 to-red-600' },
  { slug: 'plinko', name: 'Plinko', gradient: 'from-purple-600 to-pink-600' },
  { slug: 'dice', name: 'Dice', gradient: 'from-blue-600 to-cyan-600' },
  { slug: 'blackjack', name: 'Blackjack', gradient: 'from-emerald-700 to-teal-600' },
  { slug: 'roulette', name: 'Roulette', gradient: 'from-red-700 to-rose-600' },
  { slug: 'mines', name: 'Mines', gradient: 'from-yellow-600 to-amber-600' },
  { slug: 'baccarat', name: 'Baccarat', gradient: 'from-indigo-700 to-violet-600' },
  { slug: 'hilo', name: 'HiLo', gradient: 'from-sky-600 to-blue-700' },
];

// ============================================================
// COMPONENTS
// ============================================================

function SectionHeader({
  title,
  icon,
  href,
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-white flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-[13px] text-[#8D52DA] hover:underline transition-all"
        >
          View All
        </Link>
      )}
    </div>
  );
}

function LiveEventCard({ event }: { event: Event }) {
  const matchTime = event.metadata?.matchTime || '';
  const homeOdds = event.markets?.[0]?.selections?.find((s) => s.outcome === 'home')?.odds || '';
  const drawOdds = event.markets?.[0]?.selections?.find((s) => s.outcome === 'draw')?.odds || '';
  const awayOdds = event.markets?.[0]?.selections?.find((s) => s.outcome === 'away')?.odds || '';

  return (
    <Link
      href={`/sports/${event.competition?.sport?.slug || 'football'}/${event.slug}`}
      className="block min-w-[280px] shrink-0"
    >
      <div className="bg-[#1A1B1F] border-l-2 border-l-green-500 border border-white/[0.06] rounded-lg p-4 hover:border-white/10 transition-all duration-150">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-green-400 font-semibold">{matchTime}</span>
          </div>
          <span className="text-xs text-gray-500">{event.competition?.name}</span>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-medium truncate">{event.homeTeam}</span>
            <span className="text-lg text-white font-bold ml-3">{event.homeScore}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-medium truncate">{event.awayTeam}</span>
            <span className="text-lg text-white font-bold ml-3">{event.awayScore}</span>
          </div>
        </div>

        {event.markets && event.markets.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {homeOdds && (
              <button className="bg-white/5 hover:bg-green-500/10 border border-white/5 hover:border-green-500/40 rounded h-[38px] transition-all duration-150 flex flex-col items-center justify-center">
                <div className="text-[11px] text-gray-400 leading-none">1</div>
                <div className="text-sm text-white font-semibold leading-none mt-0.5">{homeOdds}</div>
              </button>
            )}
            {drawOdds && (
              <button className="bg-white/5 hover:bg-green-500/10 border border-white/5 hover:border-green-500/40 rounded h-[38px] transition-all duration-150 flex flex-col items-center justify-center">
                <div className="text-[11px] text-gray-400 leading-none">X</div>
                <div className="text-sm text-white font-semibold leading-none mt-0.5">{drawOdds}</div>
              </button>
            )}
            {awayOdds && (
              <button className="bg-white/5 hover:bg-green-500/10 border border-white/5 hover:border-green-500/40 rounded h-[38px] transition-all duration-150 flex flex-col items-center justify-center">
                <div className="text-[11px] text-gray-400 leading-none">2</div>
                <div className="text-sm text-white font-semibold leading-none mt-0.5">{awayOdds}</div>
              </button>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function CasinoGameCard({ game }: { game: { slug: string; name: string; gradient: string } }) {
  return (
    <Link
      href={`/casino/${game.slug}`}
      className="block w-[140px] shrink-0 group"
    >
      <div
        className={cn(
          'relative rounded-xl overflow-hidden border border-white/[0.06] hover:border-[#8D52DA] transition-all duration-150 hover:scale-[1.02]',
          `bg-gradient-to-br ${game.gradient}`,
        )}
        style={{ aspectRatio: '3/4' }}
      >
        <div className="flex items-center justify-center h-full">
          <span className="text-4xl font-black text-white/20">{game.name.charAt(0)}</span>
        </div>
      </div>
      <p className="text-[13px] text-white font-medium mt-2 truncate">{game.name}</p>
    </Link>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function HomePage() {
  return (
    <div className="pb-24 lg:pb-8">
      {/* Hero Section - Professional dark purple gradient */}
      <section className="w-full mb-8 h-[180px] md:h-[260px]">
        <div className="relative h-full bg-gradient-to-br from-[#1A1B1F] via-[#2D1B4E] to-[#1A1B1F] overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-20 w-64 h-64 rounded-full bg-purple-500 blur-3xl" />
            <div className="absolute bottom-10 left-20 w-64 h-64 rounded-full bg-purple-600 blur-3xl" />
          </div>

          {/* Hero Content - Centered with proper sizing */}
          <div className="relative z-10 h-full flex flex-col justify-center items-center text-center px-4 md:px-6 max-w-7xl mx-auto">
            <h1 className="text-white text-2xl md:text-4xl font-bold mb-2">
              Welcome to CryptoBet
            </h1>
            <p className="text-white/70 text-sm mb-6">
              Get Your $2,500 Welcome Package
            </p>
            <div>
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-[#8D52DA] hover:bg-[#7A3FC7] text-white font-semibold h-10 px-6 rounded transition-all duration-150"
              >
                Join Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* All sections below hero have consistent padding */}
      <div className="space-y-8">
        {/* Live Now Section - Edge-to-edge scroll */}
        <section className="px-4 md:px-6 max-w-7xl mx-auto">
          <SectionHeader
            title="Live Now"
            icon={
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            }
            href="/sports/live"
          />
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 pb-2">
              {MOCK_LIVE_EVENTS.map((event) => (
                <LiveEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>

        {/* Popular Events Section - Grid layout */}
        <section className="px-4 md:px-6 max-w-7xl mx-auto">
          <SectionHeader
            title="Popular"
            icon={<Flame className="w-5 h-5 text-orange-400" />}
            href="/sports"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {MOCK_POPULAR_EVENTS.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>

        {/* Top Leagues Section - Horizontal scroll with proper badge sizing */}
        <section className="px-4 md:px-6 max-w-7xl mx-auto">
          <SectionHeader title="Top Leagues" href="/sports" />
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-2">
              {TOP_LEAGUES.map((league) => (
                <Link
                  key={league.competition}
                  href={`/sports/${league.slug}/${league.competition}`}
                  className="flex items-center gap-2.5 px-4 h-11 rounded bg-[#1A1B1F] border border-white/[0.06] hover:border-white/10 transition-all duration-150 shrink-0"
                >
                  <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-[11px] font-bold text-gray-400">
                    {league.flag}
                  </span>
                  <span className="text-[13px] font-medium text-white whitespace-nowrap">
                    {league.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Casino Picks Section - Game cards with proper sizing */}
        <section className="px-4 md:px-6 max-w-7xl mx-auto">
          <SectionHeader
            title="Casino"
            icon={<Dice6 className="w-5 h-5 text-purple-400" />}
            href="/casino"
          />
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 pb-2">
              {MOCK_CASINO_GAMES.map((game) => (
                <CasinoGameCard key={game.slug} game={game} />
              ))}
            </div>
          </div>
        </section>

        {/* Promotions Banner - Full width gradient card */}
        <section className="px-4 md:px-6 max-w-7xl mx-auto">
          <Link
            href="/promotions"
            className="block w-full bg-gradient-to-r from-[#8D52DA] to-[#5E2A9E] rounded-lg p-6 md:p-8 hover:from-[#7A3FC7] hover:to-[#4E1A8E] transition-all duration-150"
          >
            <h3 className="text-white text-xl md:text-2xl font-bold mb-2">
              Get Your $2,500 Welcome Package
            </h3>
            <p className="text-white/80 text-sm md:text-base mb-4">
              Join today and claim your exclusive welcome bonus
            </p>
            <span className="inline-flex items-center justify-center bg-white text-[#8D52DA] font-semibold px-6 py-2 rounded transition-all duration-150 hover:bg-gray-100">
              Claim Bonus
            </span>
          </Link>
        </section>
      </div>
    </div>
  );
}
