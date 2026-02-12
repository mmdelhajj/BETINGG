'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Trophy,
  Flame,
  Star,
  Clock,
  Gamepad2,
  Swords,
  CircleDot,
  Dribbble,
  Dumbbell,
  Target,
  Disc,
} from 'lucide-react';
import { EventCard } from '@/components/sports/EventCard';
import { cn } from '@/lib/utils';
import type { Event } from '@/types';

// ============================================================
// MOCK DATA
// ============================================================

const HERO_BANNERS = [
  {
    id: 1,
    title: 'Welcome Bonus',
    subtitle: 'Get up to 5 BTC on your first deposit',
    cta: 'Claim Now',
    href: '/promotions/welcome',
    gradient: 'from-purple-700 via-brand-600 to-indigo-800',
    accent: 'bg-purple-500/20',
  },
  {
    id: 2,
    title: 'Live Casino',
    subtitle: 'Real dealers. Real cards. Real-time crypto payouts.',
    cta: 'Play Now',
    href: '/casino/live',
    gradient: 'from-emerald-700 via-teal-600 to-cyan-800',
    accent: 'bg-emerald-500/20',
  },
  {
    id: 3,
    title: 'Sports Promo',
    subtitle: 'Boosted odds on Champions League matches this week',
    cta: 'Bet Now',
    href: '/sports/football',
    gradient: 'from-orange-700 via-red-600 to-rose-800',
    accent: 'bg-orange-500/20',
  },
];

const SPORT_CATEGORIES = [
  { label: 'Soccer', slug: 'football', icon: CircleDot },
  { label: 'Basketball', slug: 'basketball', icon: Dribbble },
  { label: 'Tennis', slug: 'tennis', icon: Disc },
  { label: 'American Football', slug: 'american-football', icon: Swords },
  { label: 'Baseball', slug: 'baseball', icon: Target },
  { label: 'Ice Hockey', slug: 'ice-hockey', icon: Gamepad2 },
  { label: 'Cricket', slug: 'cricket', icon: Trophy },
  { label: 'MMA', slug: 'mma', icon: Dumbbell },
  { label: 'Esports', slug: 'esports', icon: Gamepad2 },
];

// Helper to create mock events
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
    competition: { id: 'c1', name: 'Premier League', slug: 'premier-league', country: 'England', sportId: 's1', sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 } },
    markets: [
      {
        id: 'm1', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
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
    competition: { id: 'c2', name: 'La Liga', slug: 'la-liga', country: 'Spain', sportId: 's1', sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 } },
    markets: [
      {
        id: 'm2', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
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
    competition: { id: 'c3', name: 'NBA', slug: 'nba', country: 'USA', sportId: 's2', sport: { id: 's2', name: 'Basketball', slug: 'basketball', icon: null, isActive: true, sortOrder: 2 } },
    markets: [
      {
        id: 'm3', name: 'Moneyline', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sel-7', name: 'LA Lakers', outcome: 'home', odds: '2.40', status: 'ACTIVE', marketId: 'm3' },
          { id: 'sel-8', name: 'Boston Celtics', outcome: 'away', odds: '1.55', status: 'ACTIVE', marketId: 'm3' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'live-4',
    name: 'Djokovic vs Alcaraz',
    homeTeam: 'N. Djokovic',
    awayTeam: 'C. Alcaraz',
    homeScore: 6,
    awayScore: 4,
    isLive: true,
    status: 'LIVE',
    metadata: { matchTime: '2nd Set', period: 'Set 2' },
    competition: { id: 'c4', name: 'Australian Open', slug: 'australian-open', country: 'Australia', sportId: 's3', sport: { id: 's3', name: 'Tennis', slug: 'tennis', icon: null, isActive: true, sortOrder: 3 } },
    markets: [
      {
        id: 'm4', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sel-9', name: 'N. Djokovic', outcome: 'home', odds: '1.80', status: 'ACTIVE', marketId: 'm4' },
          { id: 'sel-10', name: 'C. Alcaraz', outcome: 'away', odds: '2.00', status: 'ACTIVE', marketId: 'm4' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'live-5',
    name: 'Bayern Munich vs Dortmund',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    homeScore: 3,
    awayScore: 0,
    isLive: true,
    status: 'LIVE',
    metadata: { matchTime: "72'", period: '2nd Half' },
    competition: { id: 'c5', name: 'Bundesliga', slug: 'bundesliga', country: 'Germany', sportId: 's1', sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 } },
    markets: [
      {
        id: 'm5', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sel-11', name: 'Bayern Munich', outcome: 'home', odds: '1.05', status: 'ACTIVE', marketId: 'm5' },
          { id: 'sel-12', name: 'Draw', outcome: 'draw', odds: '12.00', status: 'ACTIVE', marketId: 'm5' },
          { id: 'sel-13', name: 'Borussia Dortmund', outcome: 'away', odds: '25.00', status: 'ACTIVE', marketId: 'm5' },
        ],
      },
    ],
  }),
];

const MOCK_FEATURED_EVENTS: Event[] = [
  mockEvent({
    id: 'feat-1',
    name: 'Liverpool vs Chelsea',
    homeTeam: 'Liverpool',
    awayTeam: 'Chelsea',
    isFeatured: true,
    startTime: new Date(Date.now() + 7200000).toISOString(),
    competition: { id: 'c1', name: 'Premier League', slug: 'premier-league', country: 'England', sportId: 's1', sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 } },
    markets: [
      {
        id: 'mf1', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-1', name: 'Liverpool', outcome: 'home', odds: '1.90', status: 'ACTIVE', marketId: 'mf1' },
          { id: 'sf-2', name: 'Draw', outcome: 'draw', odds: '3.50', status: 'ACTIVE', marketId: 'mf1' },
          { id: 'sf-3', name: 'Chelsea', outcome: 'away', odds: '3.80', status: 'ACTIVE', marketId: 'mf1' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'feat-2',
    name: 'PSG vs Juventus',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Juventus',
    isFeatured: true,
    startTime: new Date(Date.now() + 10800000).toISOString(),
    competition: { id: 'c6', name: 'Champions League', slug: 'champions-league', country: null, sportId: 's1', sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 } },
    markets: [
      {
        id: 'mf2', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-4', name: 'PSG', outcome: 'home', odds: '1.75', status: 'ACTIVE', marketId: 'mf2' },
          { id: 'sf-5', name: 'Draw', outcome: 'draw', odds: '3.80', status: 'ACTIVE', marketId: 'mf2' },
          { id: 'sf-6', name: 'Juventus', outcome: 'away', odds: '4.50', status: 'ACTIVE', marketId: 'mf2' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'feat-3',
    name: 'Warriors vs Bucks',
    homeTeam: 'Golden State Warriors',
    awayTeam: 'Milwaukee Bucks',
    isFeatured: true,
    startTime: new Date(Date.now() + 14400000).toISOString(),
    competition: { id: 'c3', name: 'NBA', slug: 'nba', country: 'USA', sportId: 's2', sport: { id: 's2', name: 'Basketball', slug: 'basketball', icon: null, isActive: true, sortOrder: 2 } },
    markets: [
      {
        id: 'mf3', name: 'Moneyline', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-7', name: 'Warriors', outcome: 'home', odds: '2.15', status: 'ACTIVE', marketId: 'mf3' },
          { id: 'sf-8', name: 'Bucks', outcome: 'away', odds: '1.70', status: 'ACTIVE', marketId: 'mf3' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'feat-4',
    name: 'Nadal vs Sinner',
    homeTeam: 'R. Nadal',
    awayTeam: 'J. Sinner',
    isFeatured: true,
    startTime: new Date(Date.now() + 18000000).toISOString(),
    competition: { id: 'c4', name: 'Australian Open', slug: 'australian-open', country: 'Australia', sportId: 's3', sport: { id: 's3', name: 'Tennis', slug: 'tennis', icon: null, isActive: true, sortOrder: 3 } },
    markets: [
      {
        id: 'mf4', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-9', name: 'R. Nadal', outcome: 'home', odds: '3.20', status: 'ACTIVE', marketId: 'mf4' },
          { id: 'sf-10', name: 'J. Sinner', outcome: 'away', odds: '1.35', status: 'ACTIVE', marketId: 'mf4' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'feat-5',
    name: 'Inter Milan vs Napoli',
    homeTeam: 'Inter Milan',
    awayTeam: 'Napoli',
    isFeatured: true,
    startTime: new Date(Date.now() + 21600000).toISOString(),
    competition: { id: 'c7', name: 'Serie A', slug: 'serie-a', country: 'Italy', sportId: 's1', sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 } },
    markets: [
      {
        id: 'mf5', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-11', name: 'Inter Milan', outcome: 'home', odds: '2.00', status: 'ACTIVE', marketId: 'mf5' },
          { id: 'sf-12', name: 'Draw', outcome: 'draw', odds: '3.30', status: 'ACTIVE', marketId: 'mf5' },
          { id: 'sf-13', name: 'Napoli', outcome: 'away', odds: '3.60', status: 'ACTIVE', marketId: 'mf5' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'feat-6',
    name: 'Chiefs vs 49ers',
    homeTeam: 'Kansas City Chiefs',
    awayTeam: 'San Francisco 49ers',
    isFeatured: true,
    startTime: new Date(Date.now() + 25200000).toISOString(),
    competition: { id: 'c8', name: 'NFL', slug: 'nfl', country: 'USA', sportId: 's4', sport: { id: 's4', name: 'American Football', slug: 'american-football', icon: null, isActive: true, sortOrder: 4 } },
    markets: [
      {
        id: 'mf6', name: 'Moneyline', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-14', name: 'Chiefs', outcome: 'home', odds: '1.85', status: 'ACTIVE', marketId: 'mf6' },
          { id: 'sf-15', name: '49ers', outcome: 'away', odds: '1.95', status: 'ACTIVE', marketId: 'mf6' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'feat-7',
    name: 'Atletico Madrid vs Sevilla',
    homeTeam: 'Atletico Madrid',
    awayTeam: 'Sevilla',
    isFeatured: true,
    startTime: new Date(Date.now() + 28800000).toISOString(),
    competition: { id: 'c9', name: 'La Liga', slug: 'la-liga', country: 'Spain', sportId: 's1', sport: { id: 's1', name: 'Football', slug: 'football', icon: null, isActive: true, sortOrder: 1 } },
    markets: [
      {
        id: 'mf7', name: 'Match Winner', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-16', name: 'Atletico Madrid', outcome: 'home', odds: '1.60', status: 'ACTIVE', marketId: 'mf7' },
          { id: 'sf-17', name: 'Draw', outcome: 'draw', odds: '3.70', status: 'ACTIVE', marketId: 'mf7' },
          { id: 'sf-18', name: 'Sevilla', outcome: 'away', odds: '5.00', status: 'ACTIVE', marketId: 'mf7' },
        ],
      },
    ],
  }),
  mockEvent({
    id: 'feat-8',
    name: 'Maple Leafs vs Rangers',
    homeTeam: 'Toronto Maple Leafs',
    awayTeam: 'New York Rangers',
    isFeatured: true,
    startTime: new Date(Date.now() + 32400000).toISOString(),
    competition: { id: 'c10', name: 'NHL', slug: 'nhl', country: 'USA', sportId: 's5', sport: { id: 's5', name: 'Ice Hockey', slug: 'ice-hockey', icon: null, isActive: true, sortOrder: 5 } },
    markets: [
      {
        id: 'mf8', name: 'Moneyline', type: 'MONEYLINE', status: 'OPEN',
        selections: [
          { id: 'sf-19', name: 'Maple Leafs', outcome: 'home', odds: '2.25', status: 'ACTIVE', marketId: 'mf8' },
          { id: 'sf-20', name: 'Rangers', outcome: 'away', odds: '1.65', status: 'ACTIVE', marketId: 'mf8' },
        ],
      },
    ],
  }),
];

const MOCK_CASINO_GAMES = [
  { slug: 'crash', name: 'Crash', provider: 'CryptoBet Originals', gradient: 'from-orange-600 to-red-600' },
  { slug: 'plinko', name: 'Plinko', provider: 'CryptoBet Originals', gradient: 'from-purple-600 to-pink-600' },
  { slug: 'dice', name: 'Dice', provider: 'CryptoBet Originals', gradient: 'from-blue-600 to-cyan-600' },
  { slug: 'blackjack', name: 'Blackjack', provider: 'Evolution Gaming', gradient: 'from-emerald-700 to-teal-600' },
  { slug: 'roulette', name: 'Roulette', provider: 'Evolution Gaming', gradient: 'from-red-700 to-rose-600' },
  { slug: 'mines', name: 'Mines', provider: 'CryptoBet Originals', gradient: 'from-yellow-600 to-amber-600' },
  { slug: 'baccarat', name: 'Baccarat', provider: 'Pragmatic Play', gradient: 'from-indigo-700 to-violet-600' },
  { slug: 'hilo', name: 'HiLo', provider: 'CryptoBet Originals', gradient: 'from-sky-600 to-blue-700' },
  { slug: 'keno', name: 'Keno', provider: 'CryptoBet Originals', gradient: 'from-fuchsia-600 to-purple-700' },
  { slug: 'video-poker', name: 'Video Poker', provider: 'NetEnt', gradient: 'from-lime-600 to-green-700' },
];

const MOCK_RECENT_GAMES = [
  { slug: 'crash', name: 'Crash', provider: 'CryptoBet Originals', gradient: 'from-orange-600 to-red-600' },
  { slug: 'blackjack', name: 'Blackjack', provider: 'Evolution Gaming', gradient: 'from-emerald-700 to-teal-600' },
  { slug: 'dice', name: 'Dice', provider: 'CryptoBet Originals', gradient: 'from-blue-600 to-cyan-600' },
  { slug: 'roulette', name: 'Roulette', provider: 'Evolution Gaming', gradient: 'from-red-700 to-rose-600' },
  { slug: 'mines', name: 'Mines', provider: 'CryptoBet Originals', gradient: 'from-yellow-600 to-amber-600' },
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
  { name: 'MLB', slug: 'baseball', competition: 'mlb', flag: 'US' },
  { name: 'ATP Tour', slug: 'tennis', competition: 'atp', flag: 'GL' },
  { name: 'IPL', slug: 'cricket', competition: 'ipl', flag: 'IN' },
];

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Section header with title and "View all" link */
function SectionHeader({
  title,
  icon,
  href,
  linkText = 'View all',
  liveCount,
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
  linkText?: string;
  liveCount?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        {icon}
        {title}
        {liveCount !== undefined && liveCount > 0 && (
          <span className="text-xs font-bold bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">
            {liveCount}
          </span>
        )}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors font-medium"
        >
          {linkText}
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

/** Horizontal scroll container with smooth touch scrolling */
function HScrollContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 overflow-x-auto pb-2 scrollbar-hide',
        className,
      )}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  );
}

/** Hero Banner Carousel */
function HeroBannerCarousel() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % HERO_BANNERS.length);
    }, 5000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goTo = (index: number) => {
    setActive(index);
    startTimer();
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '16/6' }}>
      <AnimatePresence mode="wait">
        {HERO_BANNERS.map(
          (banner, idx) =>
            idx === active && (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <Link href={banner.href} className="block h-full">
                  <div
                    className={cn(
                      'h-full w-full bg-gradient-to-r rounded-2xl relative overflow-hidden',
                      banner.gradient,
                    )}
                  >
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-1/2 h-full opacity-20">
                      <div className="absolute top-1/4 right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col justify-center px-6 sm:px-10 md:px-14">
                      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
                        {banner.title}
                      </h2>
                      <p className="text-sm sm:text-base text-white/70 mb-4 max-w-md">
                        {banner.subtitle}
                      </p>
                      <div>
                        <span className="inline-block px-5 py-2 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-sm font-semibold transition-colors border border-white/10">
                          {banner.cta}
                        </span>
                      </div>
                    </div>

                    {/* Bottom gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>
                </Link>
              </motion.div>
            ),
        )}
      </AnimatePresence>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {HERO_BANNERS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={cn(
              'rounded-full transition-all duration-300',
              idx === active
                ? 'w-6 h-2 bg-white'
                : 'w-2 h-2 bg-white/40 hover:bg-white/60',
            )}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Casino game thumbnail card */
function CasinoGameCard({
  game,
  aspect = '3/4',
}: {
  game: { slug: string; name: string; provider: string; gradient: string };
  aspect?: string;
}) {
  return (
    <Link href={`/casino/${game.slug}`} className="shrink-0 w-[130px] sm:w-[140px] group">
      <div
        className={cn(
          'relative rounded-xl overflow-hidden border border-white/5 group-hover:border-purple-500/40 transition-all duration-200 group-hover:scale-[1.03]',
          `bg-gradient-to-br ${game.gradient}`,
        )}
        style={{ aspectRatio: aspect }}
      >
        {/* Placeholder visual */}
        <div className="flex items-center justify-center h-full">
          <span className="text-4xl font-black text-white/20">
            {game.name.charAt(0)}
          </span>
        </div>

        {/* Bottom overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-8">
          <p className="text-xs font-semibold text-white truncate">{game.name}</p>
          <p className="text-[10px] text-gray-400 truncate">{game.provider}</p>
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// MAIN HOME PAGE
// ============================================================

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState('football');

  return (
    <div className="max-w-6xl mx-auto pb-24 lg:pb-8 space-y-6">
      {/* ────────────────────────────────────────────────────────
          1. HERO BANNER CAROUSEL
      ──────────────────────────────────────────────────────── */}
      <section>
        <HeroBannerCarousel />
      </section>

      {/* ────────────────────────────────────────────────────────
          2. QUICK SPORT CATEGORY BUTTONS
      ──────────────────────────────────────────────────────── */}
      <section>
        <HScrollContainer className="gap-2">
          {SPORT_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.slug;
            const Icon = cat.icon;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={cn(
                  'shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap border',
                  isActive
                    ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_16px_rgba(147,51,234,0.3)]'
                    : 'bg-[#1A1B1F] border-white/5 text-gray-400 hover:bg-[#22232A] hover:text-white hover:border-white/10',
                )}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </HScrollContainer>
      </section>

      {/* ────────────────────────────────────────────────────────
          3. LIVE NOW SECTION
      ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Live Now"
          icon={
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          }
          href="/sports/live"
          linkText="View all"
          liveCount={MOCK_LIVE_EVENTS.length}
        />
        <HScrollContainer>
          {MOCK_LIVE_EVENTS.map((event) => (
            <div key={event.id} className="shrink-0 w-[300px] sm:w-[320px]">
              <EventCard event={event} compact />
            </div>
          ))}
        </HScrollContainer>
      </section>

      {/* ────────────────────────────────────────────────────────
          4. FEATURED EVENTS
      ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Featured"
          icon={<Star className="w-5 h-5 text-yellow-400" />}
          href="/sports"
          linkText="View all"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {MOCK_FEATURED_EVENTS.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────
          5. POPULAR CASINO GAMES
      ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Popular Games"
          icon={<Flame className="w-5 h-5 text-orange-400" />}
          href="/casino"
          linkText="View all"
        />
        <HScrollContainer>
          {MOCK_CASINO_GAMES.map((game) => (
            <CasinoGameCard key={game.slug} game={game} aspect="3/4" />
          ))}
        </HScrollContainer>
      </section>

      {/* ────────────────────────────────────────────────────────
          6. JUMP BACK IN (Recently Played)
      ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Jump back in"
          icon={<Clock className="w-5 h-5 text-purple-400" />}
          href="/casino"
          linkText="View all"
        />
        <HScrollContainer>
          {MOCK_RECENT_GAMES.map((game) => (
            <CasinoGameCard key={`recent-${game.slug}`} game={game} aspect="1/1" />
          ))}
        </HScrollContainer>
      </section>

      {/* ────────────────────────────────────────────────────────
          7. TOP LEAGUES
      ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Top Leagues"
          icon={<Trophy className="w-5 h-5 text-amber-400" />}
          href="/sports"
          linkText="All sports"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {TOP_LEAGUES.map((league) => (
            <Link
              key={league.competition}
              href={`/sports/${league.slug}/${league.competition}`}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-[#1A1B1F] border border-white/5 hover:border-purple-500/30 hover:bg-[#1F2028] transition-all group"
            >
              <span className="shrink-0 w-7 h-7 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors">
                {league.flag}
              </span>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors truncate">
                {league.name}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
