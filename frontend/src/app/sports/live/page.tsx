'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { cn, formatOdds } from '@/lib/utils';
import { RefreshCw, ChevronDown, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════
//  Types for mock live data
// ═══════════════════════════════════════════════════════════════════

interface LiveSelection {
  id: string;
  name: string;
  outcome: string;
  odds: number;
  previousOdds?: number;
}

interface LiveMarket {
  id: string;
  name: string;
  type: string;
  selections: LiveSelection[];
}

interface PeriodScore {
  label: string;
  home: number;
  away: number;
}

interface LiveStats {
  possession?: { home: number; away: number };
  shotsOnTarget?: { home: number; away: number };
}

interface MatchTracker {
  sport: string;
  /** For soccer: ball position on pitch (0-100 x, 0-100 y) */
  ballX?: number;
  ballY?: number;
}

interface LiveEvent {
  id: string;
  sport: string;
  sportEmoji: string;
  competition: string;
  competitionCountry: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchTime: string;
  period: string;
  periodScores?: PeriodScore[];
  markets: LiveMarket[];
  totalMarkets: number;
  stats?: LiveStats;
  tracker?: MatchTracker;
  /** Set scores for tennis */
  sets?: { home: number; away: number }[];
  /** Current games in tennis */
  currentGames?: { home: number; away: number };
}

// ═══════════════════════════════════════════════════════════════════
//  Mock Data: 13 live events
// ═══════════════════════════════════════════════════════════════════

const MOCK_LIVE_EVENTS: LiveEvent[] = [
  // ── Soccer: Premier League ──
  {
    id: 'live-soccer-1',
    sport: 'soccer',
    sportEmoji: '\u26BD',
    competition: 'Premier League',
    competitionCountry: 'England',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    homeScore: 2,
    awayScore: 1,
    matchTime: "67'",
    period: '2nd Half',
    totalMarkets: 142,
    stats: {
      possession: { home: 58, away: 42 },
      shotsOnTarget: { home: 7, away: 4 },
    },
    tracker: { sport: 'soccer', ballX: 72, ballY: 35 },
    markets: [
      {
        id: 'mkt-s1',
        name: '1X2',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-s1-1', name: 'Arsenal', outcome: 'home', odds: 1.45 },
          { id: 'sel-s1-x', name: 'Draw', outcome: 'draw', odds: 4.8 },
          { id: 'sel-s1-2', name: 'Chelsea', outcome: 'away', odds: 6.5 },
        ],
      },
    ],
  },
  {
    id: 'live-soccer-2',
    sport: 'soccer',
    sportEmoji: '\u26BD',
    competition: 'Premier League',
    competitionCountry: 'England',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester United',
    homeScore: 0,
    awayScore: 0,
    matchTime: "23'",
    period: '1st Half',
    totalMarkets: 138,
    stats: {
      possession: { home: 63, away: 37 },
      shotsOnTarget: { home: 3, away: 1 },
    },
    tracker: { sport: 'soccer', ballX: 55, ballY: 50 },
    markets: [
      {
        id: 'mkt-s2',
        name: '1X2',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-s2-1', name: 'Liverpool', outcome: 'home', odds: 1.72 },
          { id: 'sel-s2-x', name: 'Draw', outcome: 'draw', odds: 3.6 },
          { id: 'sel-s2-2', name: 'Man Utd', outcome: 'away', odds: 5.0 },
        ],
      },
    ],
  },
  {
    id: 'live-soccer-3',
    sport: 'soccer',
    sportEmoji: '\u26BD',
    competition: 'La Liga',
    competitionCountry: 'Spain',
    homeTeam: 'Real Madrid',
    awayTeam: 'Atletico Madrid',
    homeScore: 3,
    awayScore: 2,
    matchTime: "78'",
    period: '2nd Half',
    totalMarkets: 95,
    stats: {
      possession: { home: 55, away: 45 },
      shotsOnTarget: { home: 9, away: 6 },
    },
    tracker: { sport: 'soccer', ballX: 30, ballY: 65 },
    markets: [
      {
        id: 'mkt-s3',
        name: '1X2',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-s3-1', name: 'Real Madrid', outcome: 'home', odds: 1.55 },
          { id: 'sel-s3-x', name: 'Draw', outcome: 'draw', odds: 4.2 },
          { id: 'sel-s3-2', name: 'Atletico', outcome: 'away', odds: 5.8 },
        ],
      },
    ],
  },
  {
    id: 'live-soccer-4',
    sport: 'soccer',
    sportEmoji: '\u26BD',
    competition: 'La Liga',
    competitionCountry: 'Spain',
    homeTeam: 'Barcelona',
    awayTeam: 'Sevilla',
    homeScore: 1,
    awayScore: 0,
    matchTime: "45+2'",
    period: 'Half Time',
    totalMarkets: 112,
    stats: {
      possession: { home: 71, away: 29 },
      shotsOnTarget: { home: 5, away: 2 },
    },
    tracker: { sport: 'soccer', ballX: 50, ballY: 50 },
    markets: [
      {
        id: 'mkt-s4',
        name: '1X2',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-s4-1', name: 'Barcelona', outcome: 'home', odds: 1.28 },
          { id: 'sel-s4-x', name: 'Draw', outcome: 'draw', odds: 5.5 },
          { id: 'sel-s4-2', name: 'Sevilla', outcome: 'away', odds: 11.0 },
        ],
      },
    ],
  },

  // ── Basketball: NBA ──
  {
    id: 'live-nba-1',
    sport: 'basketball',
    sportEmoji: '\uD83C\uDFC0',
    competition: 'NBA',
    competitionCountry: 'USA',
    homeTeam: 'LA Lakers',
    awayTeam: 'Boston Celtics',
    homeScore: 89,
    awayScore: 94,
    matchTime: '8:21',
    period: 'Q3',
    totalMarkets: 78,
    periodScores: [
      { label: 'Q1', home: 28, away: 31 },
      { label: 'Q2', home: 33, away: 29 },
      { label: 'Q3', home: 28, away: 34 },
    ],
    markets: [
      {
        id: 'mkt-b1',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-b1-1', name: 'LA Lakers', outcome: 'home', odds: 2.35 },
          { id: 'sel-b1-2', name: 'Boston Celtics', outcome: 'away', odds: 1.58 },
        ],
      },
    ],
  },
  {
    id: 'live-nba-2',
    sport: 'basketball',
    sportEmoji: '\uD83C\uDFC0',
    competition: 'NBA',
    competitionCountry: 'USA',
    homeTeam: 'Golden State Warriors',
    awayTeam: 'Milwaukee Bucks',
    homeScore: 112,
    awayScore: 108,
    matchTime: '3:45',
    period: 'Q4',
    totalMarkets: 64,
    periodScores: [
      { label: 'Q1', home: 30, away: 27 },
      { label: 'Q2', home: 25, away: 32 },
      { label: 'Q3', home: 31, away: 28 },
      { label: 'Q4', home: 26, away: 21 },
    ],
    markets: [
      {
        id: 'mkt-b2',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-b2-1', name: 'Warriors', outcome: 'home', odds: 1.42 },
          { id: 'sel-b2-2', name: 'Bucks', outcome: 'away', odds: 2.85 },
        ],
      },
    ],
  },
  {
    id: 'live-nba-3',
    sport: 'basketball',
    sportEmoji: '\uD83C\uDFC0',
    competition: 'NBA',
    competitionCountry: 'USA',
    homeTeam: 'Phoenix Suns',
    awayTeam: 'Denver Nuggets',
    homeScore: 55,
    awayScore: 52,
    matchTime: '4:12',
    period: 'Q2',
    totalMarkets: 82,
    periodScores: [
      { label: 'Q1', home: 32, away: 28 },
      { label: 'Q2', home: 23, away: 24 },
    ],
    markets: [
      {
        id: 'mkt-b3',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-b3-1', name: 'Phoenix Suns', outcome: 'home', odds: 1.9 },
          { id: 'sel-b3-2', name: 'Denver Nuggets', outcome: 'away', odds: 1.9 },
        ],
      },
    ],
  },

  // ── Tennis ──
  {
    id: 'live-tennis-1',
    sport: 'tennis',
    sportEmoji: '\uD83C\uDFBE',
    competition: 'ATP Australian Open',
    competitionCountry: 'Australia',
    homeTeam: 'C. Alcaraz',
    awayTeam: 'N. Djokovic',
    homeScore: 1,
    awayScore: 1,
    matchTime: '',
    period: 'Set 3',
    totalMarkets: 45,
    sets: [
      { home: 6, away: 4 },
      { home: 3, away: 6 },
    ],
    currentGames: { home: 3, away: 2 },
    markets: [
      {
        id: 'mkt-t1',
        name: 'Match Winner',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-t1-1', name: 'Alcaraz', outcome: 'home', odds: 1.75 },
          { id: 'sel-t1-2', name: 'Djokovic', outcome: 'away', odds: 2.05 },
        ],
      },
    ],
  },
  {
    id: 'live-tennis-2',
    sport: 'tennis',
    sportEmoji: '\uD83C\uDFBE',
    competition: 'WTA Dubai Open',
    competitionCountry: 'UAE',
    homeTeam: 'I. Sabalenka',
    awayTeam: 'C. Gauff',
    homeScore: 1,
    awayScore: 0,
    matchTime: '',
    period: 'Set 2',
    totalMarkets: 38,
    sets: [{ home: 6, away: 3 }],
    currentGames: { home: 4, away: 5 },
    markets: [
      {
        id: 'mkt-t2',
        name: 'Match Winner',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-t2-1', name: 'Sabalenka', outcome: 'home', odds: 1.35 },
          { id: 'sel-t2-2', name: 'Gauff', outcome: 'away', odds: 3.2 },
        ],
      },
    ],
  },

  // ── Ice Hockey ──
  {
    id: 'live-hockey-1',
    sport: 'ice-hockey',
    sportEmoji: '\uD83C\uDFD2',
    competition: 'NHL',
    competitionCountry: 'USA/Canada',
    homeTeam: 'Toronto Maple Leafs',
    awayTeam: 'NY Rangers',
    homeScore: 3,
    awayScore: 2,
    matchTime: '14:32',
    period: 'P2',
    totalMarkets: 56,
    periodScores: [
      { label: 'P1', home: 2, away: 1 },
      { label: 'P2', home: 1, away: 1 },
    ],
    markets: [
      {
        id: 'mkt-h1',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-h1-1', name: 'Maple Leafs', outcome: 'home', odds: 1.65 },
          { id: 'sel-h1-2', name: 'Rangers', outcome: 'away', odds: 2.2 },
        ],
      },
    ],
  },
  {
    id: 'live-hockey-2',
    sport: 'ice-hockey',
    sportEmoji: '\uD83C\uDFD2',
    competition: 'NHL',
    competitionCountry: 'USA/Canada',
    homeTeam: 'Edmonton Oilers',
    awayTeam: 'Colorado Avalanche',
    homeScore: 1,
    awayScore: 1,
    matchTime: '8:05',
    period: 'P1',
    totalMarkets: 52,
    periodScores: [{ label: 'P1', home: 1, away: 1 }],
    markets: [
      {
        id: 'mkt-h2',
        name: 'Money Line',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-h2-1', name: 'Oilers', outcome: 'home', odds: 2.1 },
          { id: 'sel-h2-2', name: 'Avalanche', outcome: 'away', odds: 1.72 },
        ],
      },
    ],
  },

  // ── Esports ──
  {
    id: 'live-esports-1',
    sport: 'esports',
    sportEmoji: '\uD83C\uDFAE',
    competition: 'BLAST Premier - CS2',
    competitionCountry: 'International',
    homeTeam: 'Natus Vincere',
    awayTeam: 'FaZe Clan',
    homeScore: 1,
    awayScore: 0,
    matchTime: 'Round 18',
    period: 'Map 2',
    totalMarkets: 32,
    markets: [
      {
        id: 'mkt-e1',
        name: 'Match Winner',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-e1-1', name: 'NAVI', outcome: 'home', odds: 1.5 },
          { id: 'sel-e1-2', name: 'FaZe', outcome: 'away', odds: 2.55 },
        ],
      },
    ],
  },
  {
    id: 'live-esports-2',
    sport: 'esports',
    sportEmoji: '\uD83C\uDFAE',
    competition: 'DreamLeague - Dota 2',
    competitionCountry: 'International',
    homeTeam: 'Team Spirit',
    awayTeam: 'Team Liquid',
    homeScore: 1,
    awayScore: 1,
    matchTime: '34:15',
    period: 'Game 3',
    totalMarkets: 28,
    markets: [
      {
        id: 'mkt-e2',
        name: 'Match Winner',
        type: 'MONEYLINE',
        selections: [
          { id: 'sel-e2-1', name: 'Spirit', outcome: 'home', odds: 1.85 },
          { id: 'sel-e2-2', name: 'Liquid', outcome: 'away', odds: 1.95 },
        ],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  Sport filter tabs config
// ═══════════════════════════════════════════════════════════════════

const SPORT_FILTERS = [
  { key: 'all', label: 'All', emoji: '' },
  { key: 'soccer', label: 'Soccer', emoji: '\u26BD' },
  { key: 'basketball', label: 'Basketball', emoji: '\uD83C\uDFC0' },
  { key: 'tennis', label: 'Tennis', emoji: '\uD83C\uDFBE' },
  { key: 'ice-hockey', label: 'Ice Hockey', emoji: '\uD83C\uDFD2' },
  { key: 'esports', label: 'Esports', emoji: '\uD83C\uDFAE' },
] as const;

// ═══════════════════════════════════════════════════════════════════
//  OddsButton with flash animation
// ═══════════════════════════════════════════════════════════════════

type OddsFlash = 'up' | 'down' | null;

function LiveOddsButton({
  selectionId: _selectionId,
  label,
  odds,
  isSelected,
  onSelect,
}: {
  selectionId: string;
  label: string;
  odds: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [flash, setFlash] = useState<OddsFlash>(null);
  const prevOddsRef = useRef<number>(odds);

  useEffect(() => {
    if (prevOddsRef.current !== odds) {
      const dir = odds > prevOddsRef.current ? 'up' : 'down';
      setFlash(dir);
      const timer = setTimeout(() => setFlash(null), 1800);
      prevOddsRef.current = odds;
      return () => clearTimeout(timer);
    }
  }, [odds]);

  return (
    <motion.button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 min-w-[72px] h-11 rounded px-2',
        'font-mono text-sm font-bold transition-all duration-200 relative overflow-hidden border',
        isSelected
          ? 'bg-brand-500/25 border-brand-500 text-brand-300 shadow-[inset_0_0_12px_rgba(141,82,218,0.15)]'
          : 'bg-surface-tertiary border-transparent hover:bg-surface-hover hover:border-border-hover text-white',
        flash === 'up' && !isSelected && 'animate-flash-green',
        flash === 'down' && !isSelected && 'animate-flash-red',
      )}
    >
      <span className="text-[10px] font-normal text-text-dim leading-none">{label}</span>
      <span className="flex items-center gap-0.5">
        {flash === 'up' && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-accent-green text-[10px]"
          >
            ▲
          </motion.span>
        )}
        {flash === 'down' && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-accent-red text-[10px]"
          >
            ▼
          </motion.span>
        )}
        {formatOdds(odds)}
      </span>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Mini Match Tracker (pitch/court visualization)
// ═══════════════════════════════════════════════════════════════════

function MiniTracker({ event }: { event: LiveEvent }) {
  if (event.sport === 'soccer' && event.tracker) {
    return (
      <div className="w-[80px] h-[50px] rounded bg-[#1a472a] border border-[#2a6b3a]/50 relative overflow-hidden shrink-0">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#2a6b3a]/60" />
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-[#2a6b3a]/60" />
        {/* Penalty areas */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[14px] h-[24px] border-r border-t border-b border-[#2a6b3a]/60 rounded-r" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[14px] h-[24px] border-l border-t border-b border-[#2a6b3a]/60 rounded-l" />
        {/* Ball */}
        <motion.div
          className="absolute w-[5px] h-[5px] rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"
          animate={{
            left: `${event.tracker.ballX}%`,
            top: `${event.tracker.ballY}%`,
          }}
          transition={{ duration: 2, ease: 'easeInOut' }}
          style={{ marginLeft: -2, marginTop: -2 }}
        />
      </div>
    );
  }

  if (event.sport === 'basketball') {
    return (
      <div className="w-[80px] h-[50px] rounded bg-[#4a2c0a] border border-[#6b3f10]/50 relative overflow-hidden shrink-0">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#6b3f10]/60" />
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-[#6b3f10]/60" />
        {/* Three-point arcs (simplified) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-6 border-r border-[#6b3f10]/40 rounded-r-full" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-6 border-l border-[#6b3f10]/40 rounded-l-full" />
        {/* Ball */}
        <motion.div
          className="absolute w-[5px] h-[5px] rounded-full bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.6)]"
          animate={{
            left: `${45 + Math.random() * 10}%`,
            top: `${40 + Math.random() * 20}%`,
          }}
          transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
          style={{ marginLeft: -2, marginTop: -2 }}
        />
      </div>
    );
  }

  if (event.sport === 'tennis') {
    return (
      <div className="w-[80px] h-[50px] rounded bg-[#1a3a1a] border border-[#2a5a2a]/50 relative overflow-hidden shrink-0">
        {/* Net */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
        {/* Service boxes */}
        <div className="absolute left-[25%] top-[15%] right-[25%] bottom-[15%] border border-white/15" />
        <div className="absolute left-1/2 top-[15%] w-px h-[70%] bg-white/15" />
        {/* Ball */}
        <motion.div
          className="absolute w-[4px] h-[4px] rounded-full bg-yellow-300 shadow-[0_0_4px_rgba(253,224,71,0.6)]"
          animate={{
            left: ['30%', '70%', '35%', '65%'],
            top: ['30%', '60%', '65%', '35%'],
          }}
          transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
          style={{ marginLeft: -2, marginTop: -2 }}
        />
      </div>
    );
  }

  if (event.sport === 'ice-hockey') {
    return (
      <div className="w-[80px] h-[50px] rounded bg-[#1a2a3a] border border-[#2a4a6a]/50 relative overflow-hidden shrink-0">
        {/* Center line (red) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500/40" />
        {/* Blue lines */}
        <div className="absolute left-[30%] top-0 bottom-0 w-px bg-blue-500/30" />
        <div className="absolute left-[70%] top-0 bottom-0 w-px bg-blue-500/30" />
        {/* Center circle */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-blue-500/30" />
        {/* Goals */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-red-500/20" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-red-500/20" />
        {/* Puck */}
        <motion.div
          className="absolute w-[4px] h-[4px] rounded-full bg-white shadow-[0_0_3px_rgba(255,255,255,0.5)]"
          animate={{
            left: `${40 + Math.random() * 20}%`,
            top: `${35 + Math.random() * 30}%`,
          }}
          transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
          style={{ marginLeft: -2, marginTop: -2 }}
        />
      </div>
    );
  }

  // Esports: generic
  return (
    <div className="w-[80px] h-[50px] rounded bg-[#1a1a2e] border border-[#2a2a4e]/50 relative overflow-hidden shrink-0 flex items-center justify-center">
      <Zap className="w-4 h-4 text-brand-400/40" />
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Score Visualization per sport
// ═══════════════════════════════════════════════════════════════════

function ScoreDisplay({ event }: { event: LiveEvent }) {
  // Tennis: show sets and current games
  if (event.sport === 'tennis') {
    return (
      <div className="flex flex-col gap-0.5">
        {/* Sets header */}
        <div className="flex items-center gap-0">
          {/* Home player row */}
          <div className="flex items-center gap-1">
            {event.sets?.map((set, i) => (
              <span
                key={i}
                className={cn(
                  'w-5 h-5 flex items-center justify-center text-[11px] font-mono font-bold rounded-sm',
                  set.home > set.away ? 'text-white bg-accent-green/20' : 'text-text-dim bg-surface-tertiary/60',
                )}
              >
                {set.home}
              </span>
            ))}
            {event.currentGames && (
              <span className="w-5 h-5 flex items-center justify-center text-[11px] font-mono font-bold text-accent-yellow bg-accent-yellow/10 rounded-sm">
                {event.currentGames.home}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {event.sets?.map((set, i) => (
            <span
              key={i}
              className={cn(
                'w-5 h-5 flex items-center justify-center text-[11px] font-mono font-bold rounded-sm',
                set.away > set.home ? 'text-white bg-accent-green/20' : 'text-text-dim bg-surface-tertiary/60',
              )}
            >
              {set.away}
            </span>
          ))}
          {event.currentGames && (
            <span className="w-5 h-5 flex items-center justify-center text-[11px] font-mono font-bold text-accent-yellow bg-accent-yellow/10 rounded-sm">
              {event.currentGames.away}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Basketball / Hockey: show total score prominently + period breakdown
  if (event.periodScores && event.periodScores.length > 0) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        {/* Main score */}
        <div className="flex flex-col items-end">
          <span className="text-[20px] font-bold font-mono text-white leading-tight tabular-nums">
            {event.homeScore}
          </span>
          <span className="text-[20px] font-bold font-mono text-white leading-tight tabular-nums">
            {event.awayScore}
          </span>
        </div>
        {/* Period breakdown */}
        <div className="flex gap-px mt-0.5">
          {event.periodScores.map((ps) => (
            <div key={ps.label} className="flex flex-col items-center">
              <span className="text-[8px] text-text-dim font-medium">{ps.label}</span>
              <span className="text-[9px] font-mono text-text-muted">{ps.home}-{ps.away}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Soccer / default: just the score
  return (
    <div className="flex flex-col items-end">
      <span className="text-[20px] font-bold font-mono text-white leading-tight tabular-nums">
        {event.homeScore}
      </span>
      <span className="text-[20px] font-bold font-mono text-white leading-tight tabular-nums">
        {event.awayScore}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Live Stats Mini Bar
// ═══════════════════════════════════════════════════════════════════

function LiveStatsMini({ stats }: { stats: LiveStats }) {
  return (
    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border-dim">
      {stats.possession && (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[10px] text-text-dim w-5 text-right font-mono">{stats.possession.home}%</span>
          <div className="flex-1 h-1 rounded-full bg-surface-tertiary overflow-hidden flex">
            <div
              className="h-full bg-brand-400 rounded-l-full transition-all duration-1000"
              style={{ width: `${stats.possession.home}%` }}
            />
            <div
              className="h-full bg-accent-red rounded-r-full transition-all duration-1000"
              style={{ width: `${stats.possession.away}%` }}
            />
          </div>
          <span className="text-[10px] text-text-dim w-5 font-mono">{stats.possession.away}%</span>
          <span className="text-[9px] text-text-dim">Poss.</span>
        </div>
      )}
      {stats.shotsOnTarget && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-dim font-mono">{stats.shotsOnTarget.home}</span>
          <span className="text-[9px] text-text-dim">SOT</span>
          <span className="text-[10px] text-text-dim font-mono">{stats.shotsOnTarget.away}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Live Event Card
// ═══════════════════════════════════════════════════════════════════

function LiveEventCard({ event }: { event: LiveEvent }) {
  const { toggleSelection, hasSelection } = useBetSlipStore();
  const market = event.markets[0];
  const selections = market?.selections || [];
  const isThreeWay = selections.length === 3;

  const handleSelect = useCallback(
    (sel: LiveSelection) => {
      toggleSelection({
        selectionId: sel.id,
        selectionName: sel.name,
        marketName: market?.name || '',
        eventName: `${event.homeTeam} vs ${event.awayTeam}`,
        eventId: event.id,
        odds: String(sel.odds),
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
      });
    },
    [toggleSelection, market, event],
  );

  const homeSel = selections.find((s) => s.outcome === 'home') || selections[0];
  const drawSel = selections.find((s) => s.outcome === 'draw');
  const awaySel = selections.find((s) => s.outcome === 'away') || selections[selections.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="border-l-[3px] border-l-[#30E000]"
    >
      <Link
        href={`/sports/event/${event.id}`}
        className={cn(
          'block rounded-r-lg overflow-hidden transition-all duration-200 group',
          'bg-surface-secondary border border-border-dim border-l-0',
          'hover:border-border-hover hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
        )}
      >
        {/* Card body */}
        <div className="px-4 py-3">
          {/* Top row: time badge + competition */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              {/* Time/period badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[rgba(255,73,74,0.15)] text-[#FF494A]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF494A] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FF494A]" />
                </span>
                {event.period}
                {event.matchTime ? ` ${event.matchTime}` : ''}
              </span>
              {/* Competition name */}
              <span className="text-[11px] text-text-dim font-medium">
                {event.competition}
              </span>
            </div>
            {/* More markets link */}
            {event.totalMarkets > 1 && (
              <span className="text-[11px] text-brand-400 font-semibold hover:text-brand-300 transition-colors">
                +{event.totalMarkets - 1} markets
              </span>
            )}
          </div>

          {/* Main content: Teams + Score + Tracker */}
          <div className="flex items-start gap-3">
            {/* Teams column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'text-sm font-semibold truncate',
                  event.homeScore > event.awayScore ? 'text-white' : 'text-text-secondary',
                )}>
                  {event.homeTeam}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-semibold truncate',
                  event.awayScore > event.homeScore ? 'text-white' : 'text-text-secondary',
                )}>
                  {event.awayTeam}
                </span>
              </div>
            </div>

            {/* Score */}
            <ScoreDisplay event={event} />

            {/* Mini tracker */}
            <MiniTracker event={event} />
          </div>

          {/* Live stats (soccer only) */}
          {event.stats && <LiveStatsMini stats={event.stats} />}

          {/* Odds row */}
          <div className="flex items-center gap-2 mt-3">
            {/* Odds column headers */}
            <div className="flex gap-1.5 flex-1">
              {homeSel && (
                <LiveOddsButton
                  selectionId={homeSel.id}
                  label={isThreeWay ? '1' : homeSel.name}
                  odds={homeSel.odds}
                  isSelected={hasSelection(homeSel.id)}
                  onSelect={() => handleSelect(homeSel)}
                />
              )}
              {isThreeWay && drawSel && (
                <LiveOddsButton
                  selectionId={drawSel.id}
                  label="X"
                  odds={drawSel.odds}
                  isSelected={hasSelection(drawSel.id)}
                  onSelect={() => handleSelect(drawSel)}
                />
              )}
              {awaySel && (
                <LiveOddsButton
                  selectionId={awaySel.id}
                  label={isThreeWay ? '2' : awaySel.name}
                  odds={awaySel.odds}
                  isSelected={hasSelection(awaySel.id)}
                  onSelect={() => handleSelect(awaySel)}
                />
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Competition Group
// ═══════════════════════════════════════════════════════════════════

function CompetitionGroup({
  competition,
  events,
}: {
  competition: string;
  events: LiveEvent[];
}) {
  return (
    <div>
      {/* Competition sub-header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary/60 border-b border-border-dim">
        <span className="text-xs text-text-secondary font-semibold">{competition}</span>
        <span className="text-[10px] text-text-dim">({events.length})</span>
      </div>
      {/* Event cards */}
      <div className="space-y-2 p-2">
        {events.map((event) => (
          <LiveEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Sport Section (collapsible)
// ═══════════════════════════════════════════════════════════════════

function SportSection({
  sportKey: _sportKey,
  sportEmoji,
  sportLabel,
  events,
  defaultOpen = true,
}: {
  sportKey: string;
  sportEmoji: string;
  sportLabel: string;
  events: LiveEvent[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Group by competition
  const competitionGroups = useMemo(() => {
    const groups = new Map<string, LiveEvent[]>();
    for (const ev of events) {
      const comp = ev.competition;
      if (!groups.has(comp)) groups.set(comp, []);
      groups.get(comp)!.push(ev);
    }
    return Array.from(groups.entries());
  }, [events]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-border overflow-hidden"
    >
      {/* Sport header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-secondary hover:bg-surface-tertiary transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{sportEmoji}</span>
          <span className="text-sm font-bold text-white">{sportLabel}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-red/15 text-accent-red text-[10px] font-bold">
            <span className="w-1 h-1 bg-accent-red rounded-full animate-pulse" />
            {events.length} live
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Competition groups */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-surface-deepest/50"
          >
            {competitionGroups.map(([comp, evts]) => (
              <CompetitionGroup key={comp} competition={comp} events={evts} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Main Live Page
// ═══════════════════════════════════════════════════════════════════

export default function LivePage() {
  const [events, setEvents] = useState<LiveEvent[]>(MOCK_LIVE_EVENTS);
  const [activeSport, setActiveSport] = useState<string>('all');
  const [isAutoUpdating, setIsAutoUpdating] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // ── Simulate real-time odds changes ──
  useEffect(() => {
    if (!isAutoUpdating) return;

    const interval = setInterval(() => {
      setEvents((prev) =>
        prev.map((event) => ({
          ...event,
          markets: event.markets.map((mkt) => ({
            ...mkt,
            selections: mkt.selections.map((sel) => {
              // ~30% chance of a small odds change each tick
              if (Math.random() < 0.3) {
                const shift = (Math.random() - 0.5) * 0.12;
                const newOdds = Math.max(1.01, sel.odds + shift);
                return { ...sel, previousOdds: sel.odds, odds: parseFloat(newOdds.toFixed(2)) };
              }
              return sel;
            }),
          })),
        })),
      );
      setLastUpdate(new Date());
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoUpdating]);

  // ── Simulate score changes occasionally ──
  useEffect(() => {
    if (!isAutoUpdating) return;

    const interval = setInterval(() => {
      setEvents((prev) => {
        const idx = Math.floor(Math.random() * prev.length);
        // ~5% chance of a goal/point per tick
        if (Math.random() > 0.95) {
          const updated = [...prev];
          const ev = { ...updated[idx] };
          const isHome = Math.random() > 0.5;
          if (ev.sport === 'basketball') {
            const pts = Math.random() > 0.5 ? 2 : 3;
            if (isHome) ev.homeScore += pts;
            else ev.awayScore += pts;
          } else if (ev.sport === 'soccer' || ev.sport === 'ice-hockey') {
            if (isHome) ev.homeScore += 1;
            else ev.awayScore += 1;
          }
          updated[idx] = ev;
          return updated;
        }
        return prev;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [isAutoUpdating]);

  // ── Count events per sport ──
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    for (const ev of events) {
      counts[ev.sport] = (counts[ev.sport] || 0) + 1;
    }
    return counts;
  }, [events]);

  // ── Filter events ──
  const filteredEvents = useMemo(() => {
    if (activeSport === 'all') return events;
    return events.filter((e) => e.sport === activeSport);
  }, [events, activeSport]);

  // ── Group by sport ──
  const groupedBySport = useMemo(() => {
    const groups = new Map<string, { key: string; emoji: string; label: string; events: LiveEvent[] }>();
    for (const ev of filteredEvents) {
      if (!groups.has(ev.sport)) {
        const filter = SPORT_FILTERS.find((f) => f.key === ev.sport);
        groups.set(ev.sport, {
          key: ev.sport,
          emoji: ev.sportEmoji,
          label: filter?.label || ev.sport,
          events: [],
        });
      }
      groups.get(ev.sport)!.events.push(ev);
    }
    return Array.from(groups.values());
  }, [filteredEvents]);

  // ── Time since last update ──
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

  return (
    <div className="max-w-5xl mx-auto">
      {/* ═══════ Auto-refresh indicator ═══════ */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isAutoUpdating ? 360 : 0 }}
            transition={{ duration: 2, repeat: isAutoUpdating ? Infinity : 0, ease: 'linear' }}
          >
            <RefreshCw className="w-3.5 h-3.5 text-accent-green" />
          </motion.div>
          <span className="text-[11px] text-text-dim">
            {isAutoUpdating ? 'Auto-updating' : 'Paused'}
          </span>
          <span className="text-[10px] text-text-dim">
            {secondsAgo}s ago
          </span>
        </div>
        <button
          onClick={() => setIsAutoUpdating(!isAutoUpdating)}
          className={cn(
            'text-[11px] px-2 py-0.5 rounded border transition-colors',
            isAutoUpdating
              ? 'text-accent-green border-accent-green/30 bg-accent-green/10 hover:bg-accent-green/20'
              : 'text-text-dim border-border hover:text-white hover:border-border-hover',
          )}
        >
          {isAutoUpdating ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* ═══════ Header ═══════ */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          Live Events
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgba(255,73,74,0.15)]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF494A] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF494A]" />
            </span>
            <span className="text-sm font-bold text-[#FF494A]">LIVE</span>
          </span>
        </h1>
        <span className="text-lg font-semibold text-text-secondary">
          {events.length}
        </span>
      </div>

      {/* ═══════ Sport Filter Tabs ═══════ */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2 scrollbar-hide">
        {SPORT_FILTERS.map((filter) => {
          const count = sportCounts[filter.key] || 0;
          const isActive = activeSport === filter.key;

          return (
            <button
              key={filter.key}
              onClick={() => setActiveSport(filter.key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border',
                isActive
                  ? 'bg-accent-red/15 text-accent-red border-accent-red/30'
                  : 'bg-surface-secondary text-text-secondary border-transparent hover:bg-surface-tertiary hover:text-white',
              )}
            >
              {filter.emoji && <span>{filter.emoji}</span>}
              {filter.label}
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  isActive
                    ? 'bg-accent-red/20 text-accent-red'
                    : 'bg-surface-tertiary text-text-dim',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ═══════ Live Events grouped by sport ═══════ */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-secondary text-center py-16 px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
            <Activity className="w-6 h-6 text-text-dim" />
          </div>
          <p className="text-gray-300 font-medium text-lg mb-1">No live events for this sport</p>
          <p className="text-sm text-text-dim max-w-sm mx-auto">
            Try selecting a different sport filter or check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBySport.map((group) => (
            <SportSection
              key={group.key}
              sportKey={group.key}
              sportEmoji={group.emoji}
              sportLabel={group.label}
              events={group.events}
              defaultOpen={true}
            />
          ))}
        </div>
      )}

      {/* ═══════ Bottom summary ═══════ */}
      <div className="mt-6 mb-4 flex items-center justify-center gap-2 text-[11px] text-text-dim">
        <Activity className="w-3 h-3" />
        <span>
          {events.length} live events across {new Set(events.map((e) => e.sport)).size} sports
        </span>
        <span className="text-text-dim/50">|</span>
        <span>Odds update every ~4 seconds</span>
      </div>
    </div>
  );
}
