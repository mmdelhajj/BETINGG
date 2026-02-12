'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { sportsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn, formatOdds, formatDate } from '@/lib/utils';
import {
  ChevronDown,
  ChevronLeft,
  MapPin,
  Calendar,
  Trophy,
  BarChart3,
  Clock,
  Zap,
  Star,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Event, Market, Selection } from '@/types';

// ──────────────────────────────────────────────────────────────────────
// Market category tabs
// ──────────────────────────────────────────────────────────────────────

type MarketCategory = 'all' | 'popular' | 'main' | 'goals' | 'halves' | 'player_props' | 'specials';

const CATEGORY_TABS: { key: MarketCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'popular', label: 'Popular' },
  { key: 'main', label: 'Main' },
  { key: 'goals', label: 'Goals/Points' },
  { key: 'halves', label: 'Halves/Quarters' },
  { key: 'player_props', label: 'Player Props' },
  { key: 'specials', label: 'Specials' },
];

// ──────────────────────────────────────────────────────────────────────
// Sport-specific market catalogue (comprehensive mock data generators)
// ──────────────────────────────────────────────────────────────────────

let _mockId = 1000;
function mid(): string {
  return `mock-market-${_mockId++}`;
}
function sid(): string {
  return `mock-sel-${_mockId++}`;
}

function mkSel(name: string, odds: number, marketId: string): Selection {
  return {
    id: sid(),
    name,
    odds: odds.toFixed(2),
    status: 'ACTIVE',
    marketId,
  };
}

function mkMarket(
  name: string,
  type: string,
  category: MarketCategory,
  selections: { name: string; odds: number }[]
): Market & { _category: MarketCategory } {
  const id = mid();
  return {
    id,
    name,
    type,
    status: 'OPEN',
    selections: selections.map((s) => mkSel(s.name, s.odds, id)),
    _category: category,
  };
}

type CategorizedMarket = Market & { _category: MarketCategory };

function generateSoccerMarkets(home: string, away: string): CategorizedMarket[] {
  return [
    // --- POPULAR / MAIN ---
    mkMarket('Full Time Result', '1X2', 'main', [
      { name: home, odds: 2.10 },
      { name: 'Draw', odds: 3.40 },
      { name: away, odds: 3.25 },
    ]),
    mkMarket('Double Chance', 'DOUBLE_CHANCE', 'main', [
      { name: `${home} or Draw`, odds: 1.30 },
      { name: `${home} or ${away}`, odds: 1.25 },
      { name: `${away} or Draw`, odds: 1.55 },
    ]),
    mkMarket('Both Teams to Score', 'BTTS', 'popular', [
      { name: 'Yes', odds: 1.72 },
      { name: 'No', odds: 2.05 },
    ]),
    mkMarket('Draw No Bet', 'DNB', 'main', [
      { name: home, odds: 1.65 },
      { name: away, odds: 2.15 },
    ]),

    // --- GOALS ---
    mkMarket('Over/Under 0.5 Goals', 'TOTAL', 'goals', [
      { name: 'Over 0.5', odds: 1.08 },
      { name: 'Under 0.5', odds: 7.50 },
    ]),
    mkMarket('Over/Under 1.5 Goals', 'TOTAL', 'goals', [
      { name: 'Over 1.5', odds: 1.33 },
      { name: 'Under 1.5', odds: 3.20 },
    ]),
    mkMarket('Over/Under 2.5 Goals', 'TOTAL', 'goals', [
      { name: 'Over 2.5', odds: 1.90 },
      { name: 'Under 2.5', odds: 1.90 },
    ]),
    mkMarket('Over/Under 3.5 Goals', 'TOTAL', 'goals', [
      { name: 'Over 3.5', odds: 2.75 },
      { name: 'Under 3.5', odds: 1.42 },
    ]),
    mkMarket('Over/Under 4.5 Goals', 'TOTAL', 'goals', [
      { name: 'Over 4.5', odds: 4.50 },
      { name: 'Under 4.5', odds: 1.18 },
    ]),
    mkMarket('Total Goals Odd/Even', 'ODD_EVEN', 'goals', [
      { name: 'Odd', odds: 1.90 },
      { name: 'Even', odds: 1.90 },
    ]),
    mkMarket('Exact Total Goals', 'EXACT_TOTAL', 'goals', [
      { name: '0 Goals', odds: 9.00 },
      { name: '1 Goal', odds: 5.50 },
      { name: '2 Goals', odds: 3.75 },
      { name: '3 Goals', odds: 3.50 },
      { name: '4 Goals', odds: 5.00 },
      { name: '5+ Goals', odds: 5.50 },
    ]),

    // --- ASIAN HANDICAP ---
    mkMarket('Asian Handicap -1.5', 'SPREAD', 'main', [
      { name: `${home} -1.5`, odds: 3.10 },
      { name: `${away} +1.5`, odds: 1.35 },
    ]),
    mkMarket('Asian Handicap -1.0', 'SPREAD', 'main', [
      { name: `${home} -1`, odds: 2.60 },
      { name: `${away} +1`, odds: 1.50 },
    ]),
    mkMarket('Asian Handicap -0.5', 'SPREAD', 'main', [
      { name: `${home} -0.5`, odds: 2.10 },
      { name: `${away} +0.5`, odds: 1.75 },
    ]),
    mkMarket('Asian Handicap 0', 'SPREAD', 'main', [
      { name: `${home} 0`, odds: 1.85 },
      { name: `${away} 0`, odds: 2.00 },
    ]),
    mkMarket('Asian Handicap +0.5', 'SPREAD', 'main', [
      { name: `${home} +0.5`, odds: 1.55 },
      { name: `${away} -0.5`, odds: 2.40 },
    ]),
    mkMarket('Asian Handicap +1.0', 'SPREAD', 'main', [
      { name: `${home} +1`, odds: 1.35 },
      { name: `${away} -1`, odds: 3.10 },
    ]),
    mkMarket('Asian Handicap +1.5', 'SPREAD', 'main', [
      { name: `${home} +1.5`, odds: 1.22 },
      { name: `${away} -1.5`, odds: 3.90 },
    ]),

    // --- CORRECT SCORE ---
    mkMarket('Correct Score', 'CORRECT_SCORE', 'popular', [
      { name: '1-0', odds: 6.50 },
      { name: '2-0', odds: 9.00 },
      { name: '2-1', odds: 8.50 },
      { name: '3-0', odds: 17.00 },
      { name: '3-1', odds: 15.00 },
      { name: '3-2', odds: 23.00 },
      { name: '4-0', odds: 41.00 },
      { name: '4-1', odds: 34.00 },
      { name: '0-0', odds: 9.50 },
      { name: '1-1', odds: 6.00 },
      { name: '2-2', odds: 13.00 },
      { name: '3-3', odds: 51.00 },
      { name: '0-1', odds: 8.00 },
      { name: '0-2', odds: 13.00 },
      { name: '1-2', odds: 10.50 },
      { name: '0-3', odds: 26.00 },
      { name: '1-3', odds: 21.00 },
      { name: '2-3', odds: 29.00 },
    ]),

    // --- HALVES ---
    mkMarket('Half Time Result', '1X2_HT', 'halves', [
      { name: home, odds: 2.50 },
      { name: 'Draw', odds: 2.20 },
      { name: away, odds: 3.75 },
    ]),
    mkMarket('Half Time/Full Time', 'HT_FT', 'halves', [
      { name: `${home}/${home}`, odds: 3.40 },
      { name: `${home}/Draw`, odds: 11.00 },
      { name: `${home}/${away}`, odds: 29.00 },
      { name: `Draw/${home}`, odds: 4.75 },
      { name: 'Draw/Draw', odds: 5.50 },
      { name: `Draw/${away}`, odds: 6.50 },
      { name: `${away}/${home}`, odds: 26.00 },
      { name: `${away}/Draw`, odds: 13.00 },
      { name: `${away}/${away}`, odds: 5.25 },
    ]),
    mkMarket('1st Half Over/Under 0.5', 'TOTAL_H1', 'halves', [
      { name: 'Over 0.5', odds: 1.36 },
      { name: 'Under 0.5', odds: 3.00 },
    ]),
    mkMarket('1st Half Over/Under 1.5', 'TOTAL_H1', 'halves', [
      { name: 'Over 1.5', odds: 2.40 },
      { name: 'Under 1.5', odds: 1.55 },
    ]),
    mkMarket('2nd Half Over/Under 0.5', 'TOTAL_H2', 'halves', [
      { name: 'Over 0.5', odds: 1.25 },
      { name: 'Under 0.5', odds: 3.60 },
    ]),
    mkMarket('2nd Half Over/Under 1.5', 'TOTAL_H2', 'halves', [
      { name: 'Over 1.5', odds: 2.10 },
      { name: 'Under 1.5', odds: 1.70 },
    ]),
    mkMarket('1st Half Both Teams to Score', 'BTTS_H1', 'halves', [
      { name: 'Yes', odds: 2.80 },
      { name: 'No', odds: 1.40 },
    ]),
    mkMarket('2nd Half Both Teams to Score', 'BTTS_H2', 'halves', [
      { name: 'Yes', odds: 2.50 },
      { name: 'No', odds: 1.50 },
    ]),

    // --- PLAYER PROPS ---
    mkMarket('First Goal Scorer', 'PLAYER_PROP', 'player_props', [
      { name: 'Player A', odds: 5.50 },
      { name: 'Player B', odds: 6.00 },
      { name: 'Player C', odds: 7.00 },
      { name: 'Player D', odds: 8.00 },
      { name: 'Player E', odds: 9.00 },
      { name: 'Player F', odds: 10.00 },
      { name: 'No Goal Scorer', odds: 9.50 },
    ]),
    mkMarket('Last Goal Scorer', 'PLAYER_PROP', 'player_props', [
      { name: 'Player A', odds: 5.00 },
      { name: 'Player B', odds: 5.50 },
      { name: 'Player C', odds: 6.50 },
      { name: 'Player D', odds: 7.50 },
      { name: 'Player E', odds: 8.50 },
      { name: 'Player F', odds: 9.50 },
    ]),
    mkMarket('Anytime Goal Scorer', 'PLAYER_PROP', 'player_props', [
      { name: 'Player A', odds: 2.20 },
      { name: 'Player B', odds: 2.50 },
      { name: 'Player C', odds: 3.00 },
      { name: 'Player D', odds: 3.40 },
      { name: 'Player E', odds: 4.00 },
      { name: 'Player F', odds: 4.50 },
    ]),

    // --- SPECIALS ---
    mkMarket('To Win to Nil', 'SPECIAL', 'specials', [
      { name: home, odds: 3.50 },
      { name: away, odds: 5.50 },
    ]),
    mkMarket('Result & Both Teams to Score', 'SPECIAL', 'specials', [
      { name: `${home} & Yes`, odds: 3.80 },
      { name: `Draw & Yes`, odds: 5.00 },
      { name: `${away} & Yes`, odds: 5.80 },
      { name: `${home} & No`, odds: 3.20 },
      { name: `Draw & No`, odds: 9.50 },
      { name: `${away} & No`, odds: 5.00 },
    ]),
    mkMarket('Result & Over/Under 2.5', 'SPECIAL', 'specials', [
      { name: `${home} & Over 2.5`, odds: 3.50 },
      { name: `${home} & Under 2.5`, odds: 3.60 },
      { name: `Draw & Over 2.5`, odds: 7.00 },
      { name: `Draw & Under 2.5`, odds: 5.00 },
      { name: `${away} & Over 2.5`, odds: 5.25 },
      { name: `${away} & Under 2.5`, odds: 5.50 },
    ]),
    mkMarket('Total Corners Over/Under 9.5', 'SPECIAL', 'specials', [
      { name: 'Over 9.5', odds: 1.85 },
      { name: 'Under 9.5', odds: 1.95 },
    ]),
    mkMarket('Total Cards Over/Under 3.5', 'SPECIAL', 'specials', [
      { name: 'Over 3.5', odds: 1.80 },
      { name: 'Under 3.5', odds: 2.00 },
    ]),
  ];
}

function generateBasketballMarkets(home: string, away: string): CategorizedMarket[] {
  return [
    // --- MAIN ---
    mkMarket('Money Line', 'MONEYLINE', 'main', [
      { name: home, odds: 1.75 },
      { name: away, odds: 2.10 },
    ]),
    mkMarket('Point Spread -5.5', 'SPREAD', 'main', [
      { name: `${home} -5.5`, odds: 1.91 },
      { name: `${away} +5.5`, odds: 1.91 },
    ]),
    mkMarket('Point Spread -4.5', 'SPREAD', 'main', [
      { name: `${home} -4.5`, odds: 1.87 },
      { name: `${away} +4.5`, odds: 1.95 },
    ]),
    mkMarket('Point Spread -3.5', 'SPREAD', 'main', [
      { name: `${home} -3.5`, odds: 1.83 },
      { name: `${away} +3.5`, odds: 2.00 },
    ]),

    // --- TOTALS ---
    mkMarket('Total Points Over/Under 215.5', 'TOTAL', 'goals', [
      { name: 'Over 215.5', odds: 1.91 },
      { name: 'Under 215.5', odds: 1.91 },
    ]),
    mkMarket('Total Points Over/Under 210.5', 'TOTAL', 'goals', [
      { name: 'Over 210.5', odds: 1.70 },
      { name: 'Under 210.5', odds: 2.15 },
    ]),
    mkMarket('Total Points Over/Under 220.5', 'TOTAL', 'goals', [
      { name: 'Over 220.5', odds: 2.15 },
      { name: 'Under 220.5', odds: 1.70 },
    ]),
    mkMarket('Total Points Odd/Even', 'ODD_EVEN', 'goals', [
      { name: 'Odd', odds: 1.90 },
      { name: 'Even', odds: 1.90 },
    ]),

    // --- POPULAR ---
    mkMarket(`${home} Total Points O/U 107.5`, 'TEAM_TOTAL', 'popular', [
      { name: 'Over 107.5', odds: 1.91 },
      { name: 'Under 107.5', odds: 1.91 },
    ]),
    mkMarket(`${away} Total Points O/U 106.5`, 'TEAM_TOTAL', 'popular', [
      { name: 'Over 106.5', odds: 1.91 },
      { name: 'Under 106.5', odds: 1.91 },
    ]),

    // --- 1st QUARTER ---
    mkMarket('1st Quarter - Winner', 'QUARTER', 'halves', [
      { name: home, odds: 1.87 },
      { name: 'Tie', odds: 8.00 },
      { name: away, odds: 2.05 },
    ]),
    mkMarket('1st Quarter - Spread -1.5', 'QUARTER', 'halves', [
      { name: `${home} -1.5`, odds: 1.91 },
      { name: `${away} +1.5`, odds: 1.91 },
    ]),
    mkMarket('1st Quarter - Total O/U 53.5', 'QUARTER', 'halves', [
      { name: 'Over 53.5', odds: 1.91 },
      { name: 'Under 53.5', odds: 1.91 },
    ]),

    // --- 2nd QUARTER ---
    mkMarket('2nd Quarter - Winner', 'QUARTER', 'halves', [
      { name: home, odds: 1.90 },
      { name: 'Tie', odds: 8.50 },
      { name: away, odds: 2.00 },
    ]),
    mkMarket('2nd Quarter - Spread -1.5', 'QUARTER', 'halves', [
      { name: `${home} -1.5`, odds: 1.91 },
      { name: `${away} +1.5`, odds: 1.91 },
    ]),
    mkMarket('2nd Quarter - Total O/U 54.5', 'QUARTER', 'halves', [
      { name: 'Over 54.5', odds: 1.91 },
      { name: 'Under 54.5', odds: 1.91 },
    ]),

    // --- 3rd QUARTER ---
    mkMarket('3rd Quarter - Winner', 'QUARTER', 'halves', [
      { name: home, odds: 1.85 },
      { name: 'Tie', odds: 8.00 },
      { name: away, odds: 2.05 },
    ]),
    mkMarket('3rd Quarter - Spread -1.5', 'QUARTER', 'halves', [
      { name: `${home} -1.5`, odds: 1.91 },
      { name: `${away} +1.5`, odds: 1.91 },
    ]),
    mkMarket('3rd Quarter - Total O/U 54.5', 'QUARTER', 'halves', [
      { name: 'Over 54.5', odds: 1.91 },
      { name: 'Under 54.5', odds: 1.91 },
    ]),

    // --- 4th QUARTER ---
    mkMarket('4th Quarter - Winner', 'QUARTER', 'halves', [
      { name: home, odds: 1.83 },
      { name: 'Tie', odds: 9.00 },
      { name: away, odds: 2.10 },
    ]),
    mkMarket('4th Quarter - Spread -1.5', 'QUARTER', 'halves', [
      { name: `${home} -1.5`, odds: 1.91 },
      { name: `${away} +1.5`, odds: 1.91 },
    ]),
    mkMarket('4th Quarter - Total O/U 55.5', 'QUARTER', 'halves', [
      { name: 'Over 55.5', odds: 1.91 },
      { name: 'Under 55.5', odds: 1.91 },
    ]),

    // --- 1st HALF ---
    mkMarket('1st Half - Winner', 'HALF', 'halves', [
      { name: home, odds: 1.80 },
      { name: 'Tie', odds: 6.50 },
      { name: away, odds: 2.10 },
    ]),
    mkMarket('1st Half - Spread -2.5', 'HALF', 'halves', [
      { name: `${home} -2.5`, odds: 1.91 },
      { name: `${away} +2.5`, odds: 1.91 },
    ]),
    mkMarket('1st Half - Total O/U 107.5', 'HALF', 'halves', [
      { name: 'Over 107.5', odds: 1.91 },
      { name: 'Under 107.5', odds: 1.91 },
    ]),

    // --- 2nd HALF ---
    mkMarket('2nd Half - Winner', 'HALF', 'halves', [
      { name: home, odds: 1.82 },
      { name: 'Tie', odds: 7.00 },
      { name: away, odds: 2.08 },
    ]),
    mkMarket('2nd Half - Spread -2.5', 'HALF', 'halves', [
      { name: `${home} -2.5`, odds: 1.91 },
      { name: `${away} +2.5`, odds: 1.91 },
    ]),
    mkMarket('2nd Half - Total O/U 108.5', 'HALF', 'halves', [
      { name: 'Over 108.5', odds: 1.91 },
      { name: 'Under 108.5', odds: 1.91 },
    ]),

    // --- RACE TO POINTS ---
    mkMarket('Race to 10 Points', 'SPECIAL', 'specials', [
      { name: home, odds: 1.80 },
      { name: away, odds: 2.00 },
      { name: 'Neither', odds: 51.00 },
    ]),
    mkMarket('Race to 20 Points', 'SPECIAL', 'specials', [
      { name: home, odds: 1.75 },
      { name: away, odds: 2.10 },
    ]),
    mkMarket('Race to 30 Points', 'SPECIAL', 'specials', [
      { name: home, odds: 1.72 },
      { name: away, odds: 2.15 },
    ]),

    // --- WINNING MARGIN ---
    mkMarket('Winning Margin', 'SPECIAL', 'specials', [
      { name: `${home} by 1-5`, odds: 4.00 },
      { name: `${home} by 6-10`, odds: 4.50 },
      { name: `${home} by 11-15`, odds: 6.00 },
      { name: `${home} by 16-20`, odds: 8.00 },
      { name: `${home} by 21+`, odds: 7.50 },
      { name: `${away} by 1-5`, odds: 5.00 },
      { name: `${away} by 6-10`, odds: 5.50 },
      { name: `${away} by 11-15`, odds: 7.00 },
      { name: `${away} by 16-20`, odds: 10.00 },
      { name: `${away} by 21+`, odds: 9.00 },
    ]),

    // --- PLAYER PROPS ---
    mkMarket('Player Points - Star A O/U 25.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 25.5', odds: 1.87 },
      { name: 'Under 25.5', odds: 1.95 },
    ]),
    mkMarket('Player Points - Star B O/U 22.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 22.5', odds: 1.91 },
      { name: 'Under 22.5', odds: 1.91 },
    ]),
    mkMarket('Player Rebounds - Star A O/U 8.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 8.5', odds: 1.85 },
      { name: 'Under 8.5', odds: 1.97 },
    ]),
    mkMarket('Player Assists - Star A O/U 6.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 6.5', odds: 1.91 },
      { name: 'Under 6.5', odds: 1.91 },
    ]),
    mkMarket('Player 3-Pointers - Star A O/U 2.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 2.5', odds: 1.80 },
      { name: 'Under 2.5', odds: 2.00 },
    ]),
    mkMarket('Player Points + Rebounds + Assists - Star A O/U 39.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 39.5', odds: 1.87 },
      { name: 'Under 39.5', odds: 1.95 },
    ]),
  ];
}

function generateBaseballMarkets(home: string, away: string): CategorizedMarket[] {
  return [
    // --- MAIN ---
    mkMarket('Money Line', 'MONEYLINE', 'main', [
      { name: home, odds: 1.65 },
      { name: away, odds: 2.25 },
    ]),
    mkMarket('Run Line -1.5', 'SPREAD', 'main', [
      { name: `${home} -1.5`, odds: 2.20 },
      { name: `${away} +1.5`, odds: 1.67 },
    ]),
    mkMarket('Run Line +1.5', 'SPREAD', 'main', [
      { name: `${home} +1.5`, odds: 1.40 },
      { name: `${away} -1.5`, odds: 2.90 },
    ]),

    // --- TOTALS ---
    mkMarket('Total Runs Over/Under 8.5', 'TOTAL', 'goals', [
      { name: 'Over 8.5', odds: 1.91 },
      { name: 'Under 8.5', odds: 1.91 },
    ]),
    mkMarket('Total Runs Over/Under 7.5', 'TOTAL', 'goals', [
      { name: 'Over 7.5', odds: 1.65 },
      { name: 'Under 7.5', odds: 2.20 },
    ]),
    mkMarket('Total Runs Over/Under 9.5', 'TOTAL', 'goals', [
      { name: 'Over 9.5', odds: 2.15 },
      { name: 'Under 9.5', odds: 1.72 },
    ]),
    mkMarket('Total Runs Odd/Even', 'ODD_EVEN', 'goals', [
      { name: 'Odd', odds: 1.91 },
      { name: 'Even', odds: 1.91 },
    ]),

    // --- TEAM TOTALS ---
    mkMarket(`${home} Total Runs O/U 4.5`, 'TEAM_TOTAL', 'goals', [
      { name: 'Over 4.5', odds: 1.87 },
      { name: 'Under 4.5', odds: 1.95 },
    ]),
    mkMarket(`${away} Total Runs O/U 4.5`, 'TEAM_TOTAL', 'goals', [
      { name: 'Over 4.5', odds: 2.00 },
      { name: 'Under 4.5', odds: 1.83 },
    ]),

    // --- INNINGS ---
    mkMarket('1st Inning - Winner', 'INNING', 'halves', [
      { name: home, odds: 2.60 },
      { name: 'Tie', odds: 2.10 },
      { name: away, odds: 3.20 },
    ]),
    mkMarket('1st Inning - Total O/U 0.5', 'INNING', 'halves', [
      { name: 'Over 0.5', odds: 1.55 },
      { name: 'Under 0.5', odds: 2.40 },
    ]),
    mkMarket('First 3 Innings - Winner', 'INNING', 'halves', [
      { name: home, odds: 2.10 },
      { name: 'Tie', odds: 2.80 },
      { name: away, odds: 2.75 },
    ]),
    mkMarket('First 3 Innings - Total O/U 2.5', 'INNING', 'halves', [
      { name: 'Over 2.5', odds: 1.80 },
      { name: 'Under 2.5', odds: 2.00 },
    ]),
    mkMarket('First 5 Innings - Winner', 'HALF', 'halves', [
      { name: home, odds: 1.85 },
      { name: 'Tie', odds: 3.50 },
      { name: away, odds: 2.40 },
    ]),
    mkMarket('First 5 Innings - Run Line -0.5', 'HALF', 'halves', [
      { name: `${home} -0.5`, odds: 1.95 },
      { name: `${away} +0.5`, odds: 1.87 },
    ]),
    mkMarket('First 5 Innings - Total O/U 4.5', 'HALF', 'halves', [
      { name: 'Over 4.5', odds: 1.91 },
      { name: 'Under 4.5', odds: 1.91 },
    ]),
    mkMarket('First 7 Innings - Winner', 'INNING', 'halves', [
      { name: home, odds: 1.70 },
      { name: 'Tie', odds: 4.50 },
      { name: away, odds: 2.30 },
    ]),
    mkMarket('First 7 Innings - Total O/U 6.5', 'INNING', 'halves', [
      { name: 'Over 6.5', odds: 1.85 },
      { name: 'Under 6.5', odds: 1.97 },
    ]),

    // --- SPECIALS ---
    mkMarket('Will There Be a Home Run?', 'SPECIAL', 'specials', [
      { name: 'Yes', odds: 1.30 },
      { name: 'No', odds: 3.40 },
    ]),
    mkMarket('Will the Game Go to Extra Innings?', 'SPECIAL', 'specials', [
      { name: 'Yes', odds: 8.00 },
      { name: 'No', odds: 1.06 },
    ]),

    // --- PLAYER PROPS ---
    mkMarket('Pitcher A Strikeouts O/U 5.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 5.5', odds: 1.87 },
      { name: 'Under 5.5', odds: 1.95 },
    ]),
    mkMarket('Batter A Total Bases O/U 1.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 1.5', odds: 1.91 },
      { name: 'Under 1.5', odds: 1.91 },
    ]),
    mkMarket('Batter B Hits O/U 0.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 0.5', odds: 1.55 },
      { name: 'Under 0.5', odds: 2.40 },
    ]),
  ];
}

function generateAmericanFootballMarkets(home: string, away: string): CategorizedMarket[] {
  return [
    // --- MAIN ---
    mkMarket('Money Line', 'MONEYLINE', 'main', [
      { name: home, odds: 1.65 },
      { name: away, odds: 2.25 },
    ]),
    mkMarket('Point Spread -3.5', 'SPREAD', 'main', [
      { name: `${home} -3.5`, odds: 1.91 },
      { name: `${away} +3.5`, odds: 1.91 },
    ]),
    mkMarket('Point Spread -6.5', 'SPREAD', 'main', [
      { name: `${home} -6.5`, odds: 2.15 },
      { name: `${away} +6.5`, odds: 1.72 },
    ]),
    mkMarket('Point Spread -7.5', 'SPREAD', 'main', [
      { name: `${home} -7.5`, odds: 2.25 },
      { name: `${away} +7.5`, odds: 1.65 },
    ]),

    // --- TOTALS ---
    mkMarket('Total Points Over/Under 45.5', 'TOTAL', 'goals', [
      { name: 'Over 45.5', odds: 1.91 },
      { name: 'Under 45.5', odds: 1.91 },
    ]),
    mkMarket('Total Points Over/Under 43.5', 'TOTAL', 'goals', [
      { name: 'Over 43.5', odds: 1.75 },
      { name: 'Under 43.5', odds: 2.10 },
    ]),
    mkMarket('Total Points Over/Under 47.5', 'TOTAL', 'goals', [
      { name: 'Over 47.5', odds: 2.10 },
      { name: 'Under 47.5', odds: 1.75 },
    ]),
    mkMarket('Total Points Odd/Even', 'ODD_EVEN', 'goals', [
      { name: 'Odd', odds: 1.91 },
      { name: 'Even', odds: 1.91 },
    ]),

    // --- POPULAR ---
    mkMarket(`${home} Total Points O/U 23.5`, 'TEAM_TOTAL', 'popular', [
      { name: 'Over 23.5', odds: 1.91 },
      { name: 'Under 23.5', odds: 1.91 },
    ]),
    mkMarket(`${away} Total Points O/U 22.5`, 'TEAM_TOTAL', 'popular', [
      { name: 'Over 22.5', odds: 1.91 },
      { name: 'Under 22.5', odds: 1.91 },
    ]),

    // --- QUARTERS ---
    mkMarket('1st Quarter - Winner', 'QUARTER', 'halves', [
      { name: home, odds: 2.15 },
      { name: 'Tie', odds: 3.75 },
      { name: away, odds: 2.50 },
    ]),
    mkMarket('1st Quarter - Spread -0.5', 'QUARTER', 'halves', [
      { name: `${home} -0.5`, odds: 1.91 },
      { name: `${away} +0.5`, odds: 1.91 },
    ]),
    mkMarket('1st Quarter - Total O/U 10.5', 'QUARTER', 'halves', [
      { name: 'Over 10.5', odds: 1.91 },
      { name: 'Under 10.5', odds: 1.91 },
    ]),
    mkMarket('2nd Quarter - Winner', 'QUARTER', 'halves', [
      { name: home, odds: 2.20 },
      { name: 'Tie', odds: 3.80 },
      { name: away, odds: 2.45 },
    ]),
    mkMarket('2nd Quarter - Spread -0.5', 'QUARTER', 'halves', [
      { name: `${home} -0.5`, odds: 1.91 },
      { name: `${away} +0.5`, odds: 1.91 },
    ]),
    mkMarket('2nd Quarter - Total O/U 10.5', 'QUARTER', 'halves', [
      { name: 'Over 10.5', odds: 1.91 },
      { name: 'Under 10.5', odds: 1.91 },
    ]),

    // --- HALVES ---
    mkMarket('1st Half - Winner', 'HALF', 'halves', [
      { name: home, odds: 1.85 },
      { name: 'Tie', odds: 4.50 },
      { name: away, odds: 2.30 },
    ]),
    mkMarket('1st Half - Spread -1.5', 'HALF', 'halves', [
      { name: `${home} -1.5`, odds: 1.91 },
      { name: `${away} +1.5`, odds: 1.91 },
    ]),
    mkMarket('1st Half - Total O/U 22.5', 'HALF', 'halves', [
      { name: 'Over 22.5', odds: 1.91 },
      { name: 'Under 22.5', odds: 1.91 },
    ]),
    mkMarket('2nd Half - Winner', 'HALF', 'halves', [
      { name: home, odds: 1.83 },
      { name: 'Tie', odds: 5.00 },
      { name: away, odds: 2.35 },
    ]),
    mkMarket('2nd Half - Spread -1.5', 'HALF', 'halves', [
      { name: `${home} -1.5`, odds: 1.91 },
      { name: `${away} +1.5`, odds: 1.91 },
    ]),
    mkMarket('2nd Half - Total O/U 23.5', 'HALF', 'halves', [
      { name: 'Over 23.5', odds: 1.91 },
      { name: 'Under 23.5', odds: 1.91 },
    ]),

    // --- SPECIALS ---
    mkMarket('Winning Margin', 'SPECIAL', 'specials', [
      { name: `${home} by 1-6`, odds: 3.80 },
      { name: `${home} by 7-12`, odds: 4.50 },
      { name: `${home} by 13-18`, odds: 6.00 },
      { name: `${home} by 19+`, odds: 5.50 },
      { name: `${away} by 1-6`, odds: 5.00 },
      { name: `${away} by 7-12`, odds: 5.50 },
      { name: `${away} by 13-18`, odds: 8.00 },
      { name: `${away} by 19+`, odds: 7.50 },
    ]),
    mkMarket('Total Touchdowns O/U 5.5', 'SPECIAL', 'specials', [
      { name: 'Over 5.5', odds: 1.91 },
      { name: 'Under 5.5', odds: 1.91 },
    ]),
    mkMarket('First Scoring Play', 'SPECIAL', 'specials', [
      { name: 'Touchdown', odds: 1.35 },
      { name: 'Field Goal', odds: 2.90 },
      { name: 'Safety', odds: 51.00 },
    ]),

    // --- PLAYER PROPS ---
    mkMarket('QB A Passing Yards O/U 275.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 275.5', odds: 1.87 },
      { name: 'Under 275.5', odds: 1.95 },
    ]),
    mkMarket('QB A Passing TDs O/U 2.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 2.5', odds: 2.10 },
      { name: 'Under 2.5', odds: 1.75 },
    ]),
    mkMarket('RB A Rushing Yards O/U 72.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 72.5', odds: 1.91 },
      { name: 'Under 72.5', odds: 1.91 },
    ]),
    mkMarket('WR A Receiving Yards O/U 68.5', 'PLAYER_PROP', 'player_props', [
      { name: 'Over 68.5', odds: 1.87 },
      { name: 'Under 68.5', odds: 1.95 },
    ]),
    mkMarket('Anytime Touchdown Scorer', 'PLAYER_PROP', 'player_props', [
      { name: 'RB A', odds: 1.70 },
      { name: 'WR A', odds: 2.20 },
      { name: 'WR B', odds: 3.00 },
      { name: 'TE A', odds: 3.50 },
      { name: 'RB B', odds: 4.00 },
      { name: 'QB A', odds: 6.50 },
    ]),
  ];
}

/** Fallback generic markets for any sport */
function generateGenericMarkets(home: string, away: string): CategorizedMarket[] {
  return [
    mkMarket('Match Winner', 'MONEYLINE', 'main', [
      { name: home, odds: 1.80 },
      { name: away, odds: 2.00 },
    ]),
    mkMarket('Handicap -1.5', 'SPREAD', 'main', [
      { name: `${home} -1.5`, odds: 2.30 },
      { name: `${away} +1.5`, odds: 1.60 },
    ]),
    mkMarket('Total Points O/U', 'TOTAL', 'goals', [
      { name: 'Over', odds: 1.91 },
      { name: 'Under', odds: 1.91 },
    ]),
  ];
}

function getSportType(slug: string): 'soccer' | 'basketball' | 'baseball' | 'american_football' | 'generic' {
  if (['soccer', 'football'].includes(slug)) return 'soccer';
  if (slug === 'basketball') return 'basketball';
  if (slug === 'baseball') return 'baseball';
  if (['american-football', 'nfl'].includes(slug)) return 'american_football';
  return 'generic';
}

function generateMockMarkets(sportSlug: string, home: string, away: string): CategorizedMarket[] {
  const type = getSportType(sportSlug);
  switch (type) {
    case 'soccer': return generateSoccerMarkets(home, away);
    case 'basketball': return generateBasketballMarkets(home, away);
    case 'baseball': return generateBaseballMarkets(home, away);
    case 'american_football': return generateAmericanFootballMarkets(home, away);
    default: return generateGenericMarkets(home, away);
  }
}

function filterByCategory(markets: CategorizedMarket[], cat: MarketCategory): CategorizedMarket[] {
  if (cat === 'all') return markets;
  if (cat === 'popular') {
    // Popular = first few from main + BTTS + correct score + any explicit popular
    const popular = markets.filter(
      (m) =>
        m._category === 'popular' ||
        m.name === 'Full Time Result' ||
        m.name === 'Money Line' ||
        m.name === 'Match Winner' ||
        m.name.startsWith('Point Spread') && m.name.includes('-3.5') ||
        m.name.startsWith('Run Line') && m.name.includes('-1.5') ||
        m.name.includes('Over/Under 2.5') ||
        m.name === 'Total Points Over/Under 215.5' ||
        m.name === 'Total Runs Over/Under 8.5' ||
        m.name === 'Total Points Over/Under 45.5'
    );
    return popular.length > 0 ? popular : markets.slice(0, 6);
  }
  return markets.filter((m) => m._category === cat);
}

// ──────────────────────────────────────────────────────────────────────
// Animated Accordion Market Section
// ──────────────────────────────────────────────────────────────────────

function MarketAccordion({
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

  const handleSelect = useCallback(
    (selection: Selection) => {
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
    },
    [market, event, toggleSelection]
  );

  const gridCols =
    market.selections.length === 2
      ? 'grid-cols-2'
      : market.selections.length === 3
        ? 'grid-cols-3'
        : market.selections.length <= 6
          ? 'grid-cols-3'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';

  return (
    <div className="overflow-hidden border-b border-[#2a2b30]">
      {/* Header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1A1B1F] hover:bg-[#22232a] transition-colors"
      >
        <span className="text-sm font-semibold text-white">{market.name}</span>
        <div className="flex items-center gap-2">
          {market.status === 'SUSPENDED' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-semibold">
              SUSPENDED
            </span>
          )}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </motion.div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 py-3 bg-[#13141a]">
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
                        'flex items-center justify-between px-3 py-2.5 rounded-md transition-all duration-150 min-h-[44px]',
                        isSelected
                          ? 'bg-[rgba(141,82,218,0.15)] border border-[#8D52DA]'
                          : 'bg-[rgba(255,255,255,0.05)] border border-transparent hover:bg-[rgba(255,255,255,0.08)]',
                        isDisabled && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm truncate mr-2',
                          isSelected ? 'text-[#b388f5] font-medium' : 'text-gray-300'
                        )}
                      >
                        {sel.name}
                      </span>
                      <span
                        className={cn(
                          'font-mono font-bold text-sm shrink-0',
                          isSelected ? 'text-[#8D52DA]' : 'text-white'
                        )}
                      >
                        {formatOdds(sel.odds)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Bet Builder Section
// ──────────────────────────────────────────────────────────────────────

function BetBuilderBanner() {
  return (
    <div className="rounded-lg border border-[#8D52DA]/30 bg-gradient-to-r from-[#8D52DA]/10 to-transparent overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-lg bg-[#8D52DA]/20 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-[#8D52DA]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Bet Builder</p>
          <p className="text-xs text-gray-400">Combine selections from this event into one bet</p>
        </div>
        <div className="px-3 py-1.5 rounded-md bg-[#8D52DA] text-white text-xs font-bold shrink-0 cursor-pointer hover:bg-[#9e63eb] transition-colors">
          Build Your Bet
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Countdown for upcoming events
// ──────────────────────────────────────────────────────────────────────

function KickoffCountdown({ startTime }: { startTime: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(startTime).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Starting soon');
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (days > 0) {
        setRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setRemaining(`${minutes}m ${seconds}s`);
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <Clock className="w-3.5 h-3.5" />
      <span>{remaining}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Basketball scoreboard
// ──────────────────────────────────────────────────────────────────────

function BasketballScoreboard({ event }: { event: Event }) {
  const metadata = event.metadata as Record<string, unknown> | null | undefined;
  if (!metadata) return null;

  const quarters: { label: string; home: number | string; away: number | string }[] = [];
  for (let q = 1; q <= 4; q++) {
    const hk = `homeQ${q}`;
    const ak = `awayQ${q}`;
    if (metadata[hk] !== null || metadata[ak] !== null) {
      quarters.push({
        label: `Q${q}`,
        home: (metadata[hk] as number | string) ?? '-',
        away: (metadata[ak] as number | string) ?? '-',
      });
    }
  }
  if (metadata.homeOT !== null || metadata.awayOT !== null) {
    quarters.push({
      label: 'OT',
      home: (metadata.homeOT as number | string) ?? '-',
      away: (metadata.awayOT as number | string) ?? '-',
    });
  }
  if (quarters.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[#2a2b30] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1A1B1F]">
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
          <tr className="border-t border-[#2a2b30]">
            <td className="px-3 py-2 font-medium text-white">{event.homeTeam}</td>
            {quarters.map((q) => (
              <td key={q.label} className="text-center px-2 py-2 font-mono text-gray-300">{q.home}</td>
            ))}
            <td className="text-center px-3 py-2 font-mono font-bold text-white">{event.homeScore ?? 0}</td>
          </tr>
          <tr className="border-t border-[#2a2b30]">
            <td className="px-3 py-2 font-medium text-gray-300">{event.awayTeam}</td>
            {quarters.map((q) => (
              <td key={q.label} className="text-center px-2 py-2 font-mono text-gray-400">{q.away}</td>
            ))}
            <td className="text-center px-3 py-2 font-mono font-bold text-gray-300">{event.awayScore ?? 0}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Loading Skeleton
// ──────────────────────────────────────────────────────────────────────

function EventDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
      <div className="h-4 w-64 bg-[#1A1B1F] rounded" />
      <div className="rounded-xl bg-[#1A1B1F] border border-[#2a2b30] p-6">
        <div className="h-6 w-48 bg-[#22232a] rounded mb-6" />
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-6 w-32 bg-[#22232a] rounded" />
          </div>
          <div className="h-16 w-24 bg-[#22232a] rounded" />
          <div className="space-y-2 flex-1 flex flex-col items-end">
            <div className="h-6 w-32 bg-[#22232a] rounded" />
          </div>
        </div>
      </div>
      <div className="h-10 w-full bg-[#1A1B1F] rounded-lg" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-20 bg-[#1A1B1F] rounded-lg" />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main Page Component
// ──────────────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<MarketCategory>('all');
  const tabsRef = useRef<HTMLDivElement>(null);

  // Reset mock ID generator on mount to keep IDs stable per render
  useEffect(() => {
    _mockId = 1000;
  }, []);

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

  // Live updates via socket
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

  // Determine sport
  const sportSlug = event?.competition?.sport?.slug || '';
  const isBasketball = sportSlug === 'basketball';

  // Build comprehensive market list: API markets + mock depth
  const allMarkets: CategorizedMarket[] = useMemo(() => {
    if (!event) return [];
    const home = event.homeTeam || 'Home';
    const away = event.awayTeam || 'Away';

    // Start with API-provided markets, tagged as 'main'
    const apiMarkets: CategorizedMarket[] = (event.markets || []).map((m) => ({
      ...m,
      _category: 'main' as MarketCategory,
    }));

    // Generate sport-specific mock markets for full depth
    const mockMarkets = generateMockMarkets(sportSlug, home, away);

    // Deduplicate by name: prefer API markets, then add mocks that don't overlap
    const apiNames = new Set(apiMarkets.map((m) => m.name));
    const combined = [
      ...apiMarkets,
      ...mockMarkets.filter((m) => !apiNames.has(m.name)),
    ];

    return combined;
  }, [event, sportSlug]);

  // Filter for active category
  const displayedMarkets = useMemo(
    () => filterByCategory(allMarkets, activeCategory),
    [allMarkets, activeCategory]
  );

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<MarketCategory, number> = {
      all: allMarkets.length,
      popular: filterByCategory(allMarkets, 'popular').length,
      main: filterByCategory(allMarkets, 'main').length,
      goals: filterByCategory(allMarkets, 'goals').length,
      halves: filterByCategory(allMarkets, 'halves').length,
      player_props: filterByCategory(allMarkets, 'player_props').length,
      specials: filterByCategory(allMarkets, 'specials').length,
    };
    return counts;
  }, [allMarkets]);

  // ─── Render states ─────────────────────────────────────────────────

  if (isLoading) return <EventDetailSkeleton />;

  if (error || !event) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="rounded-lg border border-[#2a2b30] bg-[#1A1B1F] text-center py-16">
          <p className="text-gray-400 text-lg mb-4">{error || 'Event not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg bg-[#8D52DA] text-white text-sm font-semibold hover:bg-[#9e63eb] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const sportName = event.competition?.sport?.name || 'Sport';
  const competitionName = event.competition?.name || 'Competition';
  const home = event.homeTeam || event.name;
  const away = event.awayTeam || 'TBD';

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-8">
      {/* ────────── Back button + breadcrumb ────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 overflow-hidden">
          <Link href="/sports" className="hover:text-[#8D52DA] transition-colors shrink-0">
            Sports
          </Link>
          <span className="text-gray-700">/</span>
          {event.competition?.sport?.slug ? (
            <Link
              href={`/sports/${event.competition.sport.slug}`}
              className="hover:text-[#8D52DA] transition-colors shrink-0"
            >
              {sportName}
            </Link>
          ) : (
            <span className="shrink-0">{sportName}</span>
          )}
          <span className="text-gray-700">/</span>
          <span className="text-gray-400 truncate">{competitionName}</span>
        </nav>
      </div>

      {/* ────────── Event Header ────────── */}
      <div className="rounded-xl border border-[#2a2b30] bg-gradient-to-b from-[#1A1B1F] to-[#13141a] overflow-hidden">
        {/* Competition bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#2a2b30] bg-[#1A1B1F]/80">
          <div className="flex items-center gap-2">
            {event.isLive && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                  Live
                </span>
              </span>
            )}
            <Trophy className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-400">{competitionName}</span>
          </div>
          <div>
            {event.isLive && event.metadata?.period ? (
              <span className="text-xs text-red-400 font-medium">
                {event.metadata.period}
                {event.metadata.matchTime ? ` - ${event.metadata.matchTime}` : ''}
              </span>
            ) : !event.isLive ? (
              <KickoffCountdown startTime={event.startTime} />
            ) : null}
          </div>
        </div>

        {/* Teams + Score */}
        <div className="px-5 py-6">
          <div className="flex items-center justify-between">
            {/* Home team */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#22232a] border border-[#2a2b30] flex items-center justify-center">
                {event.homeTeamLogo ? (
                  <img
                    src={event.homeTeamLogo}
                    alt={home}
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">{home.charAt(0)}</span>
                )}
              </div>
              <p className="font-bold text-lg text-white leading-tight">{home}</p>
              <p className="text-xs text-gray-500 mt-0.5">Home</p>
            </div>

            {/* Score / VS */}
            <div className="px-6 text-center shrink-0">
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
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-red-400">
                        {event.metadata.matchTime}
                      </span>
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

            {/* Away team */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#22232a] border border-[#2a2b30] flex items-center justify-center">
                {event.awayTeamLogo ? (
                  <img
                    src={event.awayTeamLogo}
                    alt={away}
                    className="w-10 h-10 object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">{away.charAt(0)}</span>
                )}
              </div>
              <p className="font-bold text-lg text-white leading-tight">{away}</p>
              <p className="text-xs text-gray-500 mt-0.5">Away</p>
            </div>
          </div>

          {/* Basketball scoreboard */}
          {isBasketball && event.isLive && <BasketballScoreboard event={event} />}
        </div>
      </div>

      {/* ────────── Bet Builder ────────── */}
      <BetBuilderBanner />

      {/* ────────── Category Tabs (horizontal scroll) ────────── */}
      <div
        ref={tabsRef}
        className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide bg-[#1A1B1F] rounded-lg border border-[#2a2b30] p-1"
      >
        {CATEGORY_TABS.map((tab) => {
          const count = categoryCounts[tab.key];
          const isActive = activeCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={cn(
                'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all',
                isActive
                  ? 'bg-[#8D52DA]/15 text-[#b388f5]'
                  : count > 0
                    ? 'text-gray-400 hover:text-white hover:bg-[#22232a]'
                    : 'text-gray-600 cursor-default'
              )}
              disabled={count === 0}
            >
              {tab.key === 'popular' && <Star className="w-3.5 h-3.5" />}
              {tab.key === 'specials' && <Zap className="w-3.5 h-3.5" />}
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'text-[10px] ml-0.5',
                    isActive ? 'text-[#b388f5]/70' : 'text-gray-600'
                  )}
                >
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ────────── Markets ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Left column: Markets list */}
        <div>
          {displayedMarkets.length === 0 ? (
            <div className="rounded-lg border border-[#2a2b30] bg-[#1A1B1F] text-center py-12">
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
              <p className="text-gray-400 text-lg font-medium">No markets in this category</p>
              <p className="text-gray-500 text-sm mt-1">
                Try the &ldquo;All&rdquo; tab to browse all available markets.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[#2a2b30] overflow-hidden">
              {displayedMarkets.map((market, idx) => (
                <MarketAccordion
                  key={market.id}
                  market={market}
                  event={event}
                  defaultOpen={idx < 5}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right column: Match info sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-4 space-y-4">
            {/* Match Info Card */}
            <div className="rounded-lg border border-[#2a2b30] bg-[#1A1B1F] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2b30] bg-[#22232a]/50">
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
                {Boolean((event.metadata as Record<string, unknown> | null)?.venue) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Venue</p>
                      <p className="text-sm text-white">
                        {(event.metadata as Record<string, unknown>).venue as string}
                      </p>
                    </div>
                  </div>
                )}
                {event.isLive && (
                  <div className="pt-2 border-t border-[#2a2b30]">
                    <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-red-400 uppercase">Live Now</span>
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

            {/* Quick Stats */}
            <div className="rounded-lg border border-[#2a2b30] bg-[#1A1B1F] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2b30] bg-[#22232a]/50">
                <h3 className="text-sm font-semibold text-white">Quick Stats</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="bg-[#22232a] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Status</p>
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      event.isLive ? 'text-green-400' : 'text-gray-300'
                    )}
                  >
                    {event.isLive ? 'In Play' : 'Upcoming'}
                  </p>
                </div>
                <div className="bg-[#22232a] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Markets</p>
                  <p className="text-xs font-semibold text-white">{allMarkets.length}</p>
                </div>
                {event.isLive && (
                  <div className="col-span-2 bg-[#22232a] rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Score</p>
                    <p className="text-lg font-bold font-mono text-white">
                      {event.homeScore ?? 0} - {event.awayScore ?? 0}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Market depth summary */}
            <div className="rounded-lg border border-[#2a2b30] bg-[#1A1B1F] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2b30] bg-[#22232a]/50">
                <h3 className="text-sm font-semibold text-white">Market Depth</h3>
              </div>
              <div className="p-3 space-y-1">
                {CATEGORY_TABS.filter((t) => t.key !== 'all').map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveCategory(tab.key)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors',
                      activeCategory === tab.key
                        ? 'bg-[#8D52DA]/15 text-[#b388f5]'
                        : 'text-gray-400 hover:text-white hover:bg-[#22232a]'
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono">{categoryCounts[tab.key]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only match info (below markets) */}
      <div className="lg:hidden space-y-4">
        <div className="rounded-lg border border-[#2a2b30] bg-[#1A1B1F] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2b30] bg-[#22232a]/50">
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
              <Calendar className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-sm text-white">{formatDate(event.startTime)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
