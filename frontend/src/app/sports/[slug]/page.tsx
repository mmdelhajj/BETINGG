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
  Clock,
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
//  Sport configuration: determines which markets columns to show
// ────────────────────────────────────────────────────────────────

interface MarketColumnDef {
  key: string; // market type key
  label: string; // column header label
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
    // ── Soccer / Football ───────────────────────────────────────
    case 'soccer':
    case 'football': {
      const competitions: MockCompetition[] = [
        { id: 'comp-epl', name: 'Premier League', country: 'England', countryFlag: '\uD83C\uDDEC\uD83C\uDDE7' },
        { id: 'comp-laliga', name: 'La Liga', country: 'Spain', countryFlag: '\uD83C\uDDEA\uD83C\uDDF8' },
        { id: 'comp-seriea', name: 'Serie A', country: 'Italy', countryFlag: '\uD83C\uDDEE\uD83C\uDDF9' },
        { id: 'comp-ucl', name: 'Champions League', country: 'Europe', countryFlag: '\uD83C\uDDEA\uD83C\uDDFA' },
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
        { id: 'ev-s9', name: 'Man United vs Dortmund', homeTeam: 'Manchester United', awayTeam: 'Borussia Dortmund', startTime: tomorrowAt(21, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ucl', markets: [market1x2('2.20', '3.40', '3.20', 'Man United', 'Dortmund')], totalMarkets: 135 },
        { id: 'ev-s10', name: 'Newcastle vs Wolves', homeTeam: 'Newcastle', awayTeam: 'Wolverhampton', startTime: tomorrowAt(15, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-epl', markets: [market1x2('1.65', '3.90', '5.20', 'Newcastle', 'Wolves')], totalMarkets: 110 },
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

    // ── Basketball ───────────────────────────────────────────────
    case 'basketball': {
      const competitions: MockCompetition[] = [
        { id: 'comp-nba', name: 'NBA', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
        { id: 'comp-euroleague', name: 'EuroLeague', country: 'Europe', countryFlag: '\uD83C\uDDEA\uD83C\uDDFA' },
        { id: 'comp-ncaa', name: 'NCAA', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-b1', name: 'Lakers vs Celtics', homeTeam: 'LA Lakers', awayTeam: 'Boston Celtics', startTime: hoursFromNow(-0.75), isLive: true, status: 'LIVE', homeScore: 78, awayScore: 82, matchTime: 'Q3 4:32', period: '3rd Quarter', competitionId: 'comp-nba', markets: [marketML('2.10', '1.75', 'Lakers', 'Celtics'), marketSpread('+3.5', '1.91', '-3.5', '1.91'), marketTotal('221.5', '1.91', '1.91')], totalMarkets: 95 },
        { id: 'ev-b2', name: 'Warriors vs Bucks', homeTeam: 'Golden State Warriors', awayTeam: 'Milwaukee Bucks', startTime: hoursFromNow(-0.3), isLive: true, status: 'LIVE', homeScore: 54, awayScore: 48, matchTime: 'Q2 1:15', period: '2nd Quarter', competitionId: 'comp-nba', markets: [marketML('1.65', '2.25', 'Warriors', 'Bucks'), marketSpread('-4.5', '1.91', '+4.5', '1.91'), marketTotal('228.5', '1.91', '1.91')], totalMarkets: 88 },
        { id: 'ev-b3', name: 'Nuggets vs 76ers', homeTeam: 'Denver Nuggets', awayTeam: 'Philadelphia 76ers', startTime: todayAt(19, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nba', markets: [marketML('1.55', '2.45', 'Nuggets', '76ers'), marketSpread('-5.5', '1.91', '+5.5', '1.91'), marketTotal('218.5', '1.91', '1.91')], totalMarkets: 92 },
        { id: 'ev-b4', name: 'Mavericks vs Suns', homeTeam: 'Dallas Mavericks', awayTeam: 'Phoenix Suns', startTime: todayAt(21, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nba', markets: [marketML('1.80', '2.00', 'Mavericks', 'Suns'), marketSpread('-1.5', '1.91', '+1.5', '1.91'), marketTotal('224.5', '1.91', '1.91')], totalMarkets: 85 },
        { id: 'ev-b5', name: 'Knicks vs Heat', homeTeam: 'New York Knicks', awayTeam: 'Miami Heat', startTime: tomorrowAt(19, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nba', markets: [marketML('1.70', '2.15', 'Knicks', 'Heat'), marketSpread('-3.5', '1.91', '+3.5', '1.91'), marketTotal('215.5', '1.91', '1.91')], totalMarkets: 78 },
        { id: 'ev-b6', name: 'Real Madrid vs Olympiacos', homeTeam: 'Real Madrid', awayTeam: 'Olympiacos', startTime: todayAt(20, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-euroleague', markets: [marketML('1.45', '2.70', 'Real Madrid', 'Olympiacos'), marketSpread('-6.5', '1.91', '+6.5', '1.91'), marketTotal('165.5', '1.91', '1.91')], totalMarkets: 62 },
        { id: 'ev-b7', name: 'Barcelona vs Fenerbahce', homeTeam: 'FC Barcelona', awayTeam: 'Fenerbahce', startTime: tomorrowAt(20, 45), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-euroleague', markets: [marketML('1.50', '2.55', 'Barcelona', 'Fenerbahce'), marketSpread('-5.5', '1.91', '+5.5', '1.91'), marketTotal('162.5', '1.91', '1.91')], totalMarkets: 58 },
        { id: 'ev-b8', name: 'Duke vs UNC', homeTeam: 'Duke', awayTeam: 'North Carolina', startTime: tomorrowAt(18, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ncaa', markets: [marketML('1.60', '2.30', 'Duke', 'UNC'), marketSpread('-4.5', '1.91', '+4.5', '1.91'), marketTotal('148.5', '1.91', '1.91')], totalMarkets: 45 },
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

    // ── Tennis ───────────────────────────────────────────────────
    case 'tennis': {
      const competitions: MockCompetition[] = [
        { id: 'comp-atp', name: 'ATP Tour - Indian Wells', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
        { id: 'comp-wta', name: 'WTA 1000 - Dubai', country: 'UAE', countryFlag: '\uD83C\uDDE6\uD83C\uDDEA' },
        { id: 'comp-gs', name: 'Roland Garros Qualifiers', country: 'France', countryFlag: '\uD83C\uDDEB\uD83C\uDDF7' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-t1', name: 'Djokovic vs Alcaraz', homeTeam: 'N. Djokovic', awayTeam: 'C. Alcaraz', startTime: hoursFromNow(-0.5), isLive: true, status: 'LIVE', homeScore: 6, awayScore: 4, matchTime: '2nd Set', period: '2nd Set', competitionId: 'comp-atp', markets: [marketML('2.20', '1.70', 'Djokovic', 'Alcaraz')], totalMarkets: 45 },
        { id: 'ev-t2', name: 'Sinner vs Medvedev', homeTeam: 'J. Sinner', awayTeam: 'D. Medvedev', startTime: todayAt(16, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-atp', markets: [marketML('1.55', '2.40', 'Sinner', 'Medvedev')], totalMarkets: 38 },
        { id: 'ev-t3', name: 'Rublev vs Zverev', homeTeam: 'A. Rublev', awayTeam: 'A. Zverev', startTime: todayAt(18, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-atp', markets: [marketML('2.80', '1.45', 'Rublev', 'Zverev')], totalMarkets: 35 },
        { id: 'ev-t4', name: 'Swiatek vs Sabalenka', homeTeam: 'I. Swiatek', awayTeam: 'A. Sabalenka', startTime: todayAt(19, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-wta', markets: [marketML('1.85', '1.95', 'Swiatek', 'Sabalenka')], totalMarkets: 40 },
        { id: 'ev-t5', name: 'Gauff vs Rybakina', homeTeam: 'C. Gauff', awayTeam: 'E. Rybakina', startTime: tomorrowAt(14, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-wta', markets: [marketML('2.10', '1.75', 'Gauff', 'Rybakina')], totalMarkets: 36 },
        { id: 'ev-t6', name: 'Tsitsipas vs Fritz', homeTeam: 'S. Tsitsipas', awayTeam: 'T. Fritz', startTime: tomorrowAt(17, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-atp', markets: [marketML('1.95', '1.85', 'Tsitsipas', 'Fritz')], totalMarkets: 32 },
        { id: 'ev-t7', name: 'Ruud vs Auger-Aliassime', homeTeam: 'C. Ruud', awayTeam: 'F. Auger-Aliassime', startTime: tomorrowAt(12, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-gs', markets: [marketML('1.65', '2.25', 'Ruud', 'Auger-Aliassime')], totalMarkets: 28 },
        { id: 'ev-t8', name: 'Pegula vs Keys', homeTeam: 'J. Pegula', awayTeam: 'M. Keys', startTime: tomorrowAt(15, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-wta', markets: [marketML('2.05', '1.80', 'Pegula', 'Keys')], totalMarkets: 30 },
      ];
      return {
        name: 'Tennis',
        icon: null,
        hasDrawMarket: false,
        marketColumns: [
          { key: 'MONEYLINE', label: 'Match Winner', outcomes: [{ key: 'home', label: '1' }, { key: 'away', label: '2' }] },
        ],
        competitions,
        events,
      };
    }

    // ── American Football ───────────────────────────────────────
    case 'american-football': {
      const competitions: MockCompetition[] = [
        { id: 'comp-nfl', name: 'NFL', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
        { id: 'comp-ncaaf', name: 'NCAA Football', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-af1', name: 'Chiefs vs Ravens', homeTeam: 'Kansas City Chiefs', awayTeam: 'Baltimore Ravens', startTime: hoursFromNow(-1), isLive: true, status: 'LIVE', homeScore: 17, awayScore: 14, matchTime: 'Q3 8:42', period: '3rd Quarter', competitionId: 'comp-nfl', markets: [marketML('1.75', '2.10', 'Chiefs', 'Ravens'), marketSpread('-2.5', '1.91', '+2.5', '1.91'), marketTotal('48.5', '1.91', '1.91')], totalMarkets: 120 },
        { id: 'ev-af2', name: '49ers vs Eagles', homeTeam: 'San Francisco 49ers', awayTeam: 'Philadelphia Eagles', startTime: todayAt(20, 15), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nfl', markets: [marketML('1.90', '1.90', '49ers', 'Eagles'), marketSpread('-1.0', '1.91', '+1.0', '1.91'), marketTotal('45.5', '1.91', '1.91')], totalMarkets: 115 },
        { id: 'ev-af3', name: 'Bills vs Dolphins', homeTeam: 'Buffalo Bills', awayTeam: 'Miami Dolphins', startTime: todayAt(13, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nfl', markets: [marketML('1.55', '2.50', 'Bills', 'Dolphins'), marketSpread('-6.5', '1.91', '+6.5', '1.91'), marketTotal('51.5', '1.91', '1.91')], totalMarkets: 108 },
        { id: 'ev-af4', name: 'Cowboys vs Packers', homeTeam: 'Dallas Cowboys', awayTeam: 'Green Bay Packers', startTime: tomorrowAt(16, 25), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nfl', markets: [marketML('2.15', '1.72', 'Cowboys', 'Packers'), marketSpread('+3.0', '1.91', '-3.0', '1.91'), marketTotal('46.5', '1.91', '1.91')], totalMarkets: 102 },
        { id: 'ev-af5', name: 'Rams vs Seahawks', homeTeam: 'LA Rams', awayTeam: 'Seattle Seahawks', startTime: tomorrowAt(20, 20), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nfl', markets: [marketML('1.85', '1.95', 'Rams', 'Seahawks'), marketSpread('-1.5', '1.91', '+1.5', '1.91'), marketTotal('43.5', '1.91', '1.91')], totalMarkets: 95 },
        { id: 'ev-af6', name: 'Alabama vs Georgia', homeTeam: 'Alabama', awayTeam: 'Georgia', startTime: tomorrowAt(15, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ncaaf', markets: [marketML('2.30', '1.62', 'Alabama', 'Georgia'), marketSpread('+4.5', '1.91', '-4.5', '1.91'), marketTotal('44.5', '1.91', '1.91')], totalMarkets: 68 },
        { id: 'ev-af7', name: 'Ohio State vs Michigan', homeTeam: 'Ohio State', awayTeam: 'Michigan', startTime: tomorrowAt(12, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ncaaf', markets: [marketML('1.70', '2.15', 'Ohio State', 'Michigan'), marketSpread('-3.5', '1.91', '+3.5', '1.91'), marketTotal('42.5', '1.91', '1.91')], totalMarkets: 65 },
        { id: 'ev-af8', name: 'Texas vs LSU', homeTeam: 'Texas', awayTeam: 'LSU', startTime: tomorrowAt(19, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ncaaf', markets: [marketML('1.80', '2.00', 'Texas', 'LSU'), marketSpread('-2.0', '1.91', '+2.0', '1.91'), marketTotal('50.5', '1.91', '1.91')], totalMarkets: 55 },
      ];
      return {
        name: 'American Football',
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

    // ── Baseball ─────────────────────────────────────────────────
    case 'baseball': {
      const competitions: MockCompetition[] = [
        { id: 'comp-mlb', name: 'MLB', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
        { id: 'comp-npb', name: 'NPB', country: 'Japan', countryFlag: '\uD83C\uDDEF\uD83C\uDDF5' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-bb1', name: 'Yankees vs Red Sox', homeTeam: 'NY Yankees', awayTeam: 'Boston Red Sox', startTime: hoursFromNow(-0.5), isLive: true, status: 'LIVE', homeScore: 3, awayScore: 5, matchTime: 'Bot 6th', period: '6th Inning', competitionId: 'comp-mlb', markets: [marketML('2.40', '1.60', 'Yankees', 'Red Sox'), marketSpread('+1.5', '1.55', '-1.5', '2.40'), marketTotal('8.5', '1.87', '1.93')], totalMarkets: 72 },
        { id: 'ev-bb2', name: 'Dodgers vs Padres', homeTeam: 'LA Dodgers', awayTeam: 'San Diego Padres', startTime: todayAt(19, 10), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-mlb', markets: [marketML('1.50', '2.60', 'Dodgers', 'Padres'), marketSpread('-1.5', '2.10', '+1.5', '1.72'), marketTotal('9.0', '1.91', '1.91')], totalMarkets: 68 },
        { id: 'ev-bb3', name: 'Astros vs Rangers', homeTeam: 'Houston Astros', awayTeam: 'Texas Rangers', startTime: todayAt(20, 5), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-mlb', markets: [marketML('1.75', '2.10', 'Astros', 'Rangers'), marketSpread('-1.5', '2.30', '+1.5', '1.60'), marketTotal('8.0', '1.91', '1.91')], totalMarkets: 65 },
        { id: 'ev-bb4', name: 'Braves vs Mets', homeTeam: 'Atlanta Braves', awayTeam: 'NY Mets', startTime: tomorrowAt(19, 20), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-mlb', markets: [marketML('1.65', '2.25', 'Braves', 'Mets'), marketSpread('-1.5', '2.20', '+1.5', '1.65'), marketTotal('7.5', '1.85', '1.95')], totalMarkets: 60 },
        { id: 'ev-bb5', name: 'Giants vs Yomiuri', homeTeam: 'Yomiuri Giants', awayTeam: 'Hanshin Tigers', startTime: tomorrowAt(10, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-npb', markets: [marketML('1.80', '2.00', 'Yomiuri', 'Hanshin'), marketSpread('-1.5', '2.15', '+1.5', '1.68'), marketTotal('7.0', '1.91', '1.91')], totalMarkets: 35 },
        { id: 'ev-bb6', name: 'Cubs vs Cardinals', homeTeam: 'Chicago Cubs', awayTeam: 'St. Louis Cardinals', startTime: todayAt(14, 20), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-mlb', markets: [marketML('1.90', '1.90', 'Cubs', 'Cardinals'), marketSpread('-1.5', '2.50', '+1.5', '1.52'), marketTotal('8.5', '1.91', '1.91')], totalMarkets: 58 },
        { id: 'ev-bb7', name: 'Mariners vs Angels', homeTeam: 'Seattle Mariners', awayTeam: 'LA Angels', startTime: tomorrowAt(22, 10), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-mlb', markets: [marketML('1.60', '2.35', 'Mariners', 'Angels'), marketSpread('-1.5', '2.00', '+1.5', '1.80'), marketTotal('7.5', '1.91', '1.91')], totalMarkets: 55 },
        { id: 'ev-bb8', name: 'Phillies vs Brewers', homeTeam: 'Philadelphia Phillies', awayTeam: 'Milwaukee Brewers', startTime: tomorrowAt(18, 40), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-mlb', markets: [marketML('1.70', '2.15', 'Phillies', 'Brewers'), marketSpread('-1.5', '2.25', '+1.5', '1.62'), marketTotal('8.0', '1.87', '1.93')], totalMarkets: 52 },
      ];
      return {
        name: 'Baseball',
        icon: null,
        hasDrawMarket: false,
        marketColumns: [
          { key: 'MONEYLINE', label: 'Moneyline', outcomes: [{ key: 'home', label: '1' }, { key: 'away', label: '2' }] },
          { key: 'SPREAD', label: 'Run Line', outcomes: [{ key: 'home', label: 'H' }, { key: 'away', label: 'A' }] },
          { key: 'TOTAL', label: 'Total', outcomes: [{ key: 'over', label: 'O' }, { key: 'under', label: 'U' }] },
        ],
        competitions,
        events,
      };
    }

    // ── Ice Hockey ───────────────────────────────────────────────
    case 'ice-hockey': {
      const competitions: MockCompetition[] = [
        { id: 'comp-nhl', name: 'NHL', country: 'USA/Canada', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
        { id: 'comp-khl', name: 'KHL', country: 'Russia', countryFlag: '\uD83C\uDDF7\uD83C\uDDFA' },
        { id: 'comp-shl', name: 'SHL', country: 'Sweden', countryFlag: '\uD83C\uDDF8\uD83C\uDDEA' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-h1', name: 'Maple Leafs vs Canadiens', homeTeam: 'Toronto Maple Leafs', awayTeam: 'Montreal Canadiens', startTime: hoursFromNow(-0.4), isLive: true, status: 'LIVE', homeScore: 2, awayScore: 1, matchTime: '2nd 12:34', period: '2nd Period', competitionId: 'comp-nhl', markets: [market1x2('1.85', '4.20', '3.80', 'Maple Leafs', 'Canadiens'), marketSpread('-1.5', '2.60', '+1.5', '1.50'), marketTotal('6.5', '1.91', '1.91')], totalMarkets: 78 },
        { id: 'ev-h2', name: 'Rangers vs Bruins', homeTeam: 'NY Rangers', awayTeam: 'Boston Bruins', startTime: todayAt(19, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nhl', markets: [market1x2('2.25', '3.80', '3.10', 'Rangers', 'Bruins'), marketSpread('+1.5', '1.45', '-1.5', '2.75'), marketTotal('5.5', '1.85', '1.95')], totalMarkets: 72 },
        { id: 'ev-h3', name: 'Oilers vs Avalanche', homeTeam: 'Edmonton Oilers', awayTeam: 'Colorado Avalanche', startTime: todayAt(21, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nhl', markets: [market1x2('2.10', '3.90', '3.30', 'Oilers', 'Avalanche'), marketSpread('-1.5', '2.80', '+1.5', '1.42'), marketTotal('6.5', '1.91', '1.91')], totalMarkets: 70 },
        { id: 'ev-h4', name: 'Panthers vs Lightning', homeTeam: 'Florida Panthers', awayTeam: 'Tampa Bay Lightning', startTime: tomorrowAt(19, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nhl', markets: [market1x2('1.95', '4.00', '3.50', 'Panthers', 'Lightning'), marketSpread('-1.5', '2.70', '+1.5', '1.48'), marketTotal('6.0', '1.91', '1.91')], totalMarkets: 65 },
        { id: 'ev-h5', name: 'Penguins vs Capitals', homeTeam: 'Pittsburgh Penguins', awayTeam: 'Washington Capitals', startTime: tomorrowAt(19, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nhl', markets: [market1x2('2.40', '3.70', '2.90', 'Penguins', 'Capitals'), marketSpread('+1.5', '1.52', '-1.5', '2.50'), marketTotal('5.5', '1.91', '1.91')], totalMarkets: 62 },
        { id: 'ev-h6', name: 'SKA vs CSKA Moscow', homeTeam: 'SKA Saint Petersburg', awayTeam: 'CSKA Moscow', startTime: tomorrowAt(17, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-khl', markets: [market1x2('2.05', '3.80', '3.40', 'SKA', 'CSKA'), marketSpread('-1.5', '2.90', '+1.5', '1.40'), marketTotal('5.5', '1.91', '1.91')], totalMarkets: 42 },
        { id: 'ev-h7', name: 'Frolunda vs Vaxjo', homeTeam: 'Frolunda HC', awayTeam: 'Vaxjo Lakers', startTime: todayAt(18, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-shl', markets: [market1x2('1.80', '4.10', '3.90', 'Frolunda', 'Vaxjo'), marketSpread('-1.5', '2.50', '+1.5', '1.55'), marketTotal('5.5', '1.91', '1.91')], totalMarkets: 38 },
        { id: 'ev-h8', name: 'Stars vs Wild', homeTeam: 'Dallas Stars', awayTeam: 'Minnesota Wild', startTime: todayAt(20, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-nhl', markets: [market1x2('2.15', '3.85', '3.20', 'Stars', 'Wild'), marketSpread('-1.5', '2.65', '+1.5', '1.50'), marketTotal('5.5', '1.87', '1.93')], totalMarkets: 68 },
      ];
      return {
        name: 'Ice Hockey',
        icon: null,
        hasDrawMarket: true,
        marketColumns: [
          { key: '1X2', label: '1X2', outcomes: [{ key: 'home', label: '1' }, { key: 'draw', label: 'X' }, { key: 'away', label: '2' }] },
          { key: 'SPREAD', label: 'Puck Line', outcomes: [{ key: 'home', label: 'H' }, { key: 'away', label: 'A' }] },
          { key: 'TOTAL', label: 'Total', outcomes: [{ key: 'over', label: 'O' }, { key: 'under', label: 'U' }] },
        ],
        competitions,
        events,
      };
    }

    // ── MMA ─────────────────────────────────────────────────────
    case 'mma': {
      const competitions: MockCompetition[] = [
        { id: 'comp-ufc', name: 'UFC 310', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
        { id: 'comp-bellator', name: 'Bellator Champions Series', country: 'USA', countryFlag: '\uD83C\uDDFA\uD83C\uDDF8' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-m1', name: 'Makhachev vs Poirier', homeTeam: 'Islam Makhachev', awayTeam: 'Dustin Poirier', startTime: todayAt(22, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ufc', markets: [marketML('1.30', '3.50', 'Makhachev', 'Poirier')], totalMarkets: 42 },
        { id: 'ev-m2', name: 'Adesanya vs Pereira', homeTeam: 'Israel Adesanya', awayTeam: 'Alex Pereira', startTime: todayAt(22, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ufc', markets: [marketML('2.20', '1.70', 'Adesanya', 'Pereira')], totalMarkets: 38 },
        { id: 'ev-m3', name: 'Jones vs Aspinall', homeTeam: 'Jon Jones', awayTeam: 'Tom Aspinall', startTime: todayAt(22, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ufc', markets: [marketML('1.55', '2.45', 'Jones', 'Aspinall')], totalMarkets: 45 },
        { id: 'ev-m4', name: 'Volkanovski vs Holloway', homeTeam: 'Alexander Volkanovski', awayTeam: 'Max Holloway', startTime: todayAt(22, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ufc', markets: [marketML('1.65', '2.25', 'Volkanovski', 'Holloway')], totalMarkets: 35 },
        { id: 'ev-m5', name: 'Strickland vs Du Plessis', homeTeam: 'Sean Strickland', awayTeam: 'Dricus Du Plessis', startTime: todayAt(22, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ufc', markets: [marketML('2.10', '1.75', 'Strickland', 'Du Plessis')], totalMarkets: 30 },
        { id: 'ev-m6', name: 'O\'Malley vs Dvalishvili', homeTeam: 'Sean O\'Malley', awayTeam: 'Merab Dvalishvili', startTime: todayAt(22, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-ufc', markets: [marketML('1.85', '1.95', 'O\'Malley', 'Dvalishvili')], totalMarkets: 32 },
        { id: 'ev-m7', name: 'Nemkov vs Romero', homeTeam: 'Vadim Nemkov', awayTeam: 'Yoel Romero', startTime: tomorrowAt(21, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-bellator', markets: [marketML('1.45', '2.70', 'Nemkov', 'Romero')], totalMarkets: 22 },
        { id: 'ev-m8', name: 'McKee vs Pitbull', homeTeam: 'A.J. McKee', awayTeam: 'Patricio Pitbull', startTime: tomorrowAt(21, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-bellator', markets: [marketML('1.70', '2.15', 'McKee', 'Pitbull')], totalMarkets: 20 },
      ];
      return {
        name: 'MMA',
        icon: null,
        hasDrawMarket: false,
        marketColumns: [
          { key: 'MONEYLINE', label: 'Fight Winner', outcomes: [{ key: 'home', label: '1' }, { key: 'away', label: '2' }] },
        ],
        competitions,
        events,
      };
    }

    // ── Default / fallback sport ────────────────────────────────
    default: {
      const displayName = slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const competitions: MockCompetition[] = [
        { id: 'comp-def1', name: `${displayName} World Championship`, country: 'International', countryFlag: '\uD83C\uDF0D' },
        { id: 'comp-def2', name: `${displayName} Premier League`, country: 'UK', countryFlag: '\uD83C\uDDEC\uD83C\uDDE7' },
      ];
      const events: MockEvent[] = [
        { id: 'ev-d1', name: 'Team A vs Team B', homeTeam: 'Team Alpha', awayTeam: 'Team Beta', startTime: hoursFromNow(-0.3), isLive: true, status: 'LIVE', homeScore: 2, awayScore: 1, matchTime: "25'", period: null, competitionId: 'comp-def1', markets: [marketML('1.65', '2.25', 'Team Alpha', 'Team Beta')], totalMarkets: 45 },
        { id: 'ev-d2', name: 'Team C vs Team D', homeTeam: 'Team Gamma', awayTeam: 'Team Delta', startTime: todayAt(16, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def1', markets: [marketML('1.90', '1.90', 'Team Gamma', 'Team Delta')], totalMarkets: 38 },
        { id: 'ev-d3', name: 'Team E vs Team F', homeTeam: 'Team Epsilon', awayTeam: 'Team Zeta', startTime: todayAt(19, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def1', markets: [marketML('2.30', '1.60', 'Team Epsilon', 'Team Zeta')], totalMarkets: 32 },
        { id: 'ev-d4', name: 'Team G vs Team H', homeTeam: 'Team Eta', awayTeam: 'Team Theta', startTime: tomorrowAt(15, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def2', markets: [marketML('1.75', '2.10', 'Team Eta', 'Team Theta')], totalMarkets: 28 },
        { id: 'ev-d5', name: 'Team I vs Team J', homeTeam: 'Team Iota', awayTeam: 'Team Kappa', startTime: tomorrowAt(18, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def2', markets: [marketML('2.05', '1.80', 'Team Iota', 'Team Kappa')], totalMarkets: 25 },
        { id: 'ev-d6', name: 'Team K vs Team L', homeTeam: 'Team Lambda', awayTeam: 'Team Mu', startTime: tomorrowAt(20, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def1', markets: [marketML('1.50', '2.60', 'Team Lambda', 'Team Mu')], totalMarkets: 30 },
        { id: 'ev-d7', name: 'Team M vs Team N', homeTeam: 'Team Nu', awayTeam: 'Team Xi', startTime: todayAt(21, 0), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def2', markets: [marketML('1.85', '1.95', 'Team Nu', 'Team Xi')], totalMarkets: 22 },
        { id: 'ev-d8', name: 'Team O vs Team P', homeTeam: 'Team Omicron', awayTeam: 'Team Pi', startTime: todayAt(17, 30), isLive: false, status: 'UPCOMING', homeScore: null, awayScore: null, matchTime: null, period: null, competitionId: 'comp-def1', markets: [marketML('2.15', '1.72', 'Team Omicron', 'Team Pi')], totalMarkets: 20 },
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
//  Odds Button
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
      <div className="flex-1 min-w-[56px] h-9 rounded bg-surface-tertiary/40 flex items-center justify-center">
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
        'flex-1 min-w-[56px] h-9 rounded text-center font-mono text-sm font-bold transition-all duration-150 border',
        isSelected
          ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
          : 'bg-surface-tertiary border-transparent hover:border-purple-500/40 text-white hover:bg-surface-hover',
        selection.status !== 'ACTIVE' && 'opacity-40 cursor-not-allowed'
      )}
      disabled={selection.status !== 'ACTIVE'}
      title={label}
    >
      <span className="flex flex-col items-center leading-tight">
        {label && <span className="text-[8px] text-gray-500 font-normal">{label}</span>}
        <span>{formatOdds(selection.odds)}</span>
      </span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
//  Event Row
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
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 transition-colors group border-b border-border-dim last:border-b-0',
        'hover:bg-surface-hover/50'
      )}
    >
      {/* Time / Live indicator */}
      <div className="w-[52px] shrink-0 text-center">
        {isLive ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                Live
              </span>
            </span>
            {event.matchTime && (
              <span className="text-[10px] text-gray-500">{event.matchTime}</span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-gray-400">
              {new Date(event.startTime).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
            <span className="text-[10px] text-gray-500">
              {new Date(event.startTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Teams + Score */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              'text-sm truncate',
              isLive ? 'font-semibold text-white' : 'text-gray-200'
            )}
          >
            {event.homeTeam}
          </span>
          {isLive && event.homeScore !== null && (
            <span className="text-sm font-bold font-mono text-white ml-auto shrink-0 tabular-nums">
              {event.homeScore}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              isLive ? 'font-semibold text-gray-300' : 'text-gray-400'
            )}
          >
            {event.awayTeam}
          </span>
          {isLive && event.awayScore !== null && (
            <span className="text-sm font-bold font-mono text-gray-300 ml-auto shrink-0 tabular-nums">
              {event.awayScore}
            </span>
          )}
        </div>
      </div>

      {/* Odds columns grouped by market type */}
      <div className="flex items-center gap-3 shrink-0">
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
                    isSelected={s ? hasSelection(s.id) : false}
                    onSelect={() => s && mkt && handleSelect(mkt, s)}
                  />
                );
              })}
            </div>
          );
        })}

        {/* More markets */}
        <div className="w-9 text-center shrink-0">
          {event.totalMarkets > 1 && (
            <span className="text-[11px] text-purple-400 font-semibold">
              +{event.totalMarkets - event.markets.length}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────
//  Collapsible Competition Group
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
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Competition Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-secondary hover:bg-surface-tertiary transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0" role="img" aria-label={competition.country}>
            {competition.countryFlag}
          </span>
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

      {/* Column headers + Events */}
      {isOpen && (
        <div className="bg-surface-secondary/30">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-dim bg-surface-secondary/60">
            <div className="w-[52px] shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-3 shrink-0">
              {marketColumns.map((colDef) => (
                <div key={colDef.key} className="flex items-center gap-1">
                  {colDef.outcomes.map((outcome) => (
                    <div
                      key={outcome.key}
                      className="flex-1 min-w-[56px] text-center"
                    >
                      <span className="text-[9px] text-gray-500 uppercase font-semibold tracking-wider">
                        {outcome.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="w-9" />
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

  // Filter events based on tab
  const filteredEvents = useMemo(() => {
    switch (timeFilter) {
      case 'live':
        return config.events.filter((e) => e.isLive || e.status === 'LIVE');
      case 'today':
        return config.events.filter((e) => isToday(e.startTime));
      case 'tomorrow':
        return config.events.filter((e) => isTomorrow(e.startTime));
      case 'outrights':
        return []; // No outrights in mock data
      default:
        return config.events;
    }
  }, [config.events, timeFilter]);

  // Sort: live first, then by start time
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const aLive = a.isLive || a.status === 'LIVE' ? 0 : 1;
      const bLive = b.isLive || b.status === 'LIVE' ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [filteredEvents]);

  // Group by competition
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

  // Counts
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
    <div className="max-w-6xl mx-auto space-y-4 pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link
          href="/sports"
          className="hover:text-purple-400 transition-colors"
        >
          Sports
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-700" />
        <span className="text-white font-medium">{config.name}</span>
      </nav>

      {/* Sport Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-surface-tertiary flex items-center justify-center border border-border">
          <SportIcon slug={slug} size={28} />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{config.name}</h1>
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-red-400">
                  {liveCount} Live
                </span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {config.events.length} events across {config.competitions.length}{' '}
            competitions
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide border-b border-border-dim">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTimeFilter(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all relative',
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
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  timeFilter === tab.key
                    ? tab.key === 'live'
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-purple-500/15 text-purple-400'
                    : 'bg-surface-tertiary text-gray-500'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Market column legend (for multi-column sports) */}
      {config.marketColumns.length > 1 && (
        <div className="flex items-center justify-end gap-3 text-[10px] text-gray-500 uppercase tracking-wider">
          {config.marketColumns.map((col) => (
            <span
              key={col.key}
              className="px-2 py-0.5 rounded bg-surface-secondary border border-border"
            >
              {col.label}
            </span>
          ))}
        </div>
      )}

      {/* Event groups */}
      {sortedEvents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-secondary text-center py-20">
          <div className="w-14 h-14 rounded-full bg-surface-tertiary flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-gray-400 text-lg font-medium mb-1">
            No events found
          </p>
          <p className="text-sm text-gray-600">
            {timeFilter !== 'all'
              ? 'Try selecting a different time filter to see more events.'
              : 'Events will appear here when they are scheduled.'}
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
