'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn, formatCurrency, getDefaultBet } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Sport = 'football' | 'basketball' | 'tennis';

interface VirtualEvent {
  id: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startTime: Date;
  selections: VirtualSelection[];
  status: 'upcoming' | 'live' | 'finished';
  score?: { home: number; away: number };
  minute?: number;
}

interface VirtualSelection {
  id: string;
  label: string;
  odds: number;
}

interface BetHistoryEntry {
  id: string;
  eventId: string;
  sport: Sport;
  matchup: string;
  selection: string;
  odds: number;
  betAmount: number;
  payout: number;
  profit: number;
  won: boolean;
  timestamp: Date;
}

interface SimulationState {
  eventId: string;
  progress: number;
  minute: number;
  homeScore: number;
  awayScore: number;
  events: SimEvent[];
  finished: boolean;
}

interface SimEvent {
  minute: number;
  type: 'goal' | 'point' | 'set' | 'foul' | 'card';
  team: 'home' | 'away';
  description: string;
}

interface ApiResponse {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    eventId: string;
    sport: string;
    selection: string;
    won: boolean;
    finalScore: { home: number; away: number };
    matchEvents: SimEvent[];
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

// ---------------------------------------------------------------------------
// Sport Icons
// ---------------------------------------------------------------------------

const SPORT_ICONS: Record<Sport, JSX.Element> = {
  football: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  ),
  basketball: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93l14.14 14.14" />
      <path d="M19.07 4.93L4.93 19.07" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
    </svg>
  ),
  tennis: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M18.09 5.91A5.97 5.97 0 0 0 12 4a5.97 5.97 0 0 0-6.09 1.91" />
      <path d="M5.91 18.09A5.97 5.97 0 0 0 12 20a5.97 5.97 0 0 0 6.09-1.91" />
    </svg>
  ),
};

const SPORT_COLORS: Record<Sport, string> = {
  football: '#10B981',
  basketball: '#F59E0B',
  tennis: '#3B82F6',
};

const SPORT_LABELS: Record<Sport, string> = {
  football: 'Football',
  basketball: 'Basketball',
  tennis: 'Tennis',
};

// ---------------------------------------------------------------------------
// Mock Virtual Events Generator
// ---------------------------------------------------------------------------

const FOOTBALL_TEAMS = [
  'FC Barcelona', 'Real Madrid', 'Man City', 'Bayern Munich', 'PSG',
  'Liverpool', 'Juventus', 'Inter Milan', 'Dortmund', 'Arsenal',
  'AC Milan', 'Chelsea', 'Atletico', 'Ajax', 'Porto',
];

const BASKETBALL_TEAMS = [
  'Lakers', 'Celtics', 'Warriors', 'Nets', 'Bucks',
  'Heat', 'Suns', 'Mavericks', '76ers', 'Nuggets',
  'Clippers', 'Grizzlies', 'Cavaliers', 'Kings', 'Pelicans',
];

const TENNIS_PLAYERS = [
  'Djokovic', 'Alcaraz', 'Sinner', 'Medvedev', 'Rune',
  'Fritz', 'Zverev', 'Ruud', 'Tsitsipas', 'Rublev',
  'Hurkacz', 'Tiafoe', 'De Minaur', 'Shelton', 'Draper',
];

const LEAGUES: Record<Sport, string[]> = {
  football: ['Champions League', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga'],
  basketball: ['NBA', 'EuroLeague', 'Virtual Cup', 'All-Star'],
  tennis: ['Grand Slam', 'ATP Masters', 'Virtual Open', 'World Tour'],
};

function generateEvents(sport: Sport, count: number): VirtualEvent[] {
  const teams = sport === 'football' ? FOOTBALL_TEAMS : sport === 'basketball' ? BASKETBALL_TEAMS : TENNIS_PLAYERS;
  const leagues = LEAGUES[sport];
  const events: VirtualEvent[] = [];
  const usedPairs = new Set<string>();

  for (let i = 0; i < count; i++) {
    let home: string, away: string;
    do {
      home = teams[Math.floor(Math.random() * teams.length)];
      away = teams[Math.floor(Math.random() * teams.length)];
    } while (home === away || usedPairs.has(`${home}-${away}`));
    usedPairs.add(`${home}-${away}`);

    const minutesFromNow = (i + 1) * 3 + Math.floor(Math.random() * 5);
    const homeOdds = 1.3 + Math.random() * 2.5;
    const drawOdds = sport === 'tennis' ? 0 : 2.5 + Math.random() * 2;
    const awayOdds = 1.3 + Math.random() * 2.5;

    const selections: VirtualSelection[] = [
      { id: `${i}-home`, label: home, odds: parseFloat(homeOdds.toFixed(2)) },
    ];

    if (sport !== 'tennis') {
      selections.push({ id: `${i}-draw`, label: 'Draw', odds: parseFloat(drawOdds.toFixed(2)) });
    }

    selections.push({ id: `${i}-away`, label: away, odds: parseFloat(awayOdds.toFixed(2)) });

    events.push({
      id: `virtual-${sport}-${i}-${Date.now()}`,
      sport,
      homeTeam: home,
      awayTeam: away,
      league: leagues[Math.floor(Math.random() * leagues.length)],
      startTime: new Date(Date.now() + minutesFromNow * 60000),
      selections,
      status: 'upcoming',
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Countdown Hook
// ---------------------------------------------------------------------------

function useCountdown(targetDate: Date): string {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Starting...');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

function EventCountdown({ date }: { date: Date }) {
  const countdown = useCountdown(date);
  return (
    <span className="font-mono text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {countdown}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Simulation Component
// ---------------------------------------------------------------------------

function MatchSimulation({
  simulation,
  event,
}: {
  simulation: SimulationState;
  event: VirtualEvent;
}) {
  const sportLabel = event.sport === 'football' ? 'min' : event.sport === 'basketball' ? 'Q' : 'set';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#161B22] rounded-xl p-4 border border-[#30363D]"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#8B949E]">{event.league}</span>
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-xs text-red-400 font-semibold flex items-center gap-1"
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          LIVE
        </motion.span>
      </div>

      {/* Score */}
      <div className="flex items-center justify-center gap-6 mb-4">
        <div className="text-right flex-1">
          <div className="text-sm font-semibold truncate">{event.homeTeam}</div>
        </div>
        <div className="flex items-center gap-3">
          <motion.span
            key={simulation.homeScore}
            initial={{ scale: 1.5, color: '#10B981' }}
            animate={{ scale: 1, color: '#FFFFFF' }}
            className="text-3xl font-black font-mono"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {simulation.homeScore}
          </motion.span>
          <span className="text-[#8B949E] text-xl">-</span>
          <motion.span
            key={simulation.awayScore}
            initial={{ scale: 1.5, color: '#10B981' }}
            animate={{ scale: 1, color: '#FFFFFF' }}
            className="text-3xl font-black font-mono"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {simulation.awayScore}
          </motion.span>
        </div>
        <div className="text-left flex-1">
          <div className="text-sm font-semibold truncate">{event.awayTeam}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[#8B949E] mb-1">
          <span>0</span>
          <span className="text-[#8B5CF6] font-semibold">{simulation.minute} {sportLabel}</span>
          <span>{event.sport === 'football' ? 90 : event.sport === 'basketball' ? 48 : 5}</span>
        </div>
        <div className="h-2 bg-[#0D1117] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${SPORT_COLORS[event.sport]}, #8B5CF6)`,
            }}
            animate={{ width: `${simulation.progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Match Events */}
      {simulation.events.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1.5">
          {simulation.events.slice(-6).map((evt, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-[#8B949E] font-mono w-8 text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {evt.minute}&apos;
              </span>
              <span className={cn(
                'w-2 h-2 rounded-full',
                evt.type === 'goal' || evt.type === 'point' ? 'bg-[#10B981]' :
                evt.type === 'card' ? 'bg-[#F59E0B]' : 'bg-[#8B949E]'
              )} />
              <span className="text-gray-300">{evt.description}</span>
            </motion.div>
          ))}
        </div>
      )}

      {simulation.finished && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center text-sm font-bold text-[#8B5CF6]"
        >
          FULL TIME
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Currency Icons
// ---------------------------------------------------------------------------

const CURRENCY_ICONS: Record<string, string> = {
  BTC: '\u20BF', ETH: '\u039E', USDT: '$', USDC: '$', LTC: '\u0141',
  DOGE: 'D', SOL: 'S', XRP: 'X', BNB: 'B', TRX: 'T',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VirtualSportsPage() {
  const user = useAuthStore((s) => s.user);
  const currency = user?.preferences?.currency ?? 'BTC';

  const [activeSport, setActiveSport] = useState<Sport>('football');
  const [events, setEvents] = useState<Record<Sport, VirtualEvent[]>>({
    football: [],
    basketball: [],
    tennis: [],
  });
  const [selectedEvent, setSelectedEvent] = useState<VirtualEvent | null>(null);
  const [selectedSelection, setSelectedSelection] = useState<VirtualSelection | null>(null);
  const [betAmount, setBetAmount] = useState(getDefaultBet(currency));
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [betHistory, setBetHistory] = useState<BetHistoryEntry[]>([]);
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [activeBetResult, setActiveBetResult] = useState<{
    won: boolean;
    profit: number;
    payout: number;
  } | null>(null);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [showHistory, setShowHistory] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Generate events on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setEvents({
      football: generateEvents('football', 6),
      basketball: generateEvents('basketball', 6),
      tennis: generateEvents('tennis', 6),
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  const runSimulation = useCallback((
    event: VirtualEvent,
    finalScore: { home: number; away: number },
    matchEvents: SimEvent[],
    onComplete: () => void
  ) => {
    const maxMinute = event.sport === 'football' ? 90 : event.sport === 'basketball' ? 48 : 5;
    const stepDuration = 80;
    let currentMinute = 0;
    const eventsByMinute = new Map<number, SimEvent[]>();

    matchEvents.forEach((e) => {
      const existing = eventsByMinute.get(e.minute) || [];
      existing.push(e);
      eventsByMinute.set(e.minute, existing);
    });

    const initialState: SimulationState = {
      eventId: event.id,
      progress: 0,
      minute: 0,
      homeScore: 0,
      awayScore: 0,
      events: [],
      finished: false,
    };

    setSimulation(initialState);

    let homeScore = 0;
    let awayScore = 0;
    const displayedEvents: SimEvent[] = [];

    simIntervalRef.current = setInterval(() => {
      currentMinute++;

      const minuteEvents = eventsByMinute.get(currentMinute);
      if (minuteEvents) {
        minuteEvents.forEach((e) => {
          if (e.type === 'goal' || e.type === 'point') {
            if (e.team === 'home') homeScore++;
            else awayScore++;
          }
          displayedEvents.push(e);
        });
      }

      const progress = Math.min((currentMinute / maxMinute) * 100, 100);

      setSimulation({
        eventId: event.id,
        progress,
        minute: currentMinute,
        homeScore,
        awayScore,
        events: [...displayedEvents],
        finished: currentMinute >= maxMinute,
      });

      if (currentMinute >= maxMinute) {
        if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        setSimulation((prev) => prev ? {
          ...prev,
          homeScore: finalScore.home,
          awayScore: finalScore.away,
          finished: true,
        } : null);
        onComplete();
      }
    }, stepDuration);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Place Bet
  // ---------------------------------------------------------------------------

  const placeBet = useCallback(async () => {
    if (!selectedEvent || !selectedSelection || isPlacingBet) return;
    setError(null);
    setActiveBetResult(null);
    setIsPlacingBet(true);

    try {
      const data = await post<ApiResponse>('/casino/games/virtualsports/play', {
        amount: parseFloat(betAmount),
        currency,
        options: {
          sport: selectedEvent.sport,
          eventId: selectedEvent.id,
          selection: selectedSelection.id,
        },
      });

      useAuthStore.getState().updateBalance(currency, data.newBalance, 0);

      const betAmt = data.betAmount ?? parseFloat(betAmount);
      const payoutAmt = data.payout ?? (data.result.won ? betAmt * selectedSelection.odds : 0);
      const profitAmt = data.profit ?? (payoutAmt - betAmt);

      runSimulation(
        selectedEvent,
        data.result.finalScore,
        data.result.matchEvents || [],
        () => {
          setActiveBetResult({
            won: data.result.won,
            profit: profitAmt,
            payout: payoutAmt,
          });

          setBetHistory((prev) => [
            {
              id: data.roundId,
              eventId: selectedEvent.id,
              sport: selectedEvent.sport,
              matchup: `${selectedEvent.homeTeam} vs ${selectedEvent.awayTeam}`,
              selection: selectedSelection.label,
              odds: selectedSelection.odds,
              betAmount: betAmt,
              payout: payoutAmt,
              profit: profitAmt,
              won: data.result.won,
              timestamp: new Date(),
            },
            ...prev,
          ].slice(0, 50));

          setIsPlacingBet(false);

          setEvents((prev) => ({
            ...prev,
            [selectedEvent.sport]: prev[selectedEvent.sport].map((e) =>
              e.id === selectedEvent.id
                ? generateEvents(selectedEvent.sport, 1)[0]
                : e
            ),
          }));
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bet placement failed';
      setError(message);
      setIsPlacingBet(false);
    }
  }, [selectedEvent, selectedSelection, isPlacingBet, betAmount, currency, runSimulation]);

  // ---------------------------------------------------------------------------
  // Bet helpers
  // ---------------------------------------------------------------------------

  const adjustBet = useCallback((factor: number) => {
    setBetAmount((prev) => {
      const v = parseFloat(prev) || 0;
      return Math.max(0, v * factor).toFixed(8);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const currentEvents = useMemo(() => events[activeSport], [events, activeSport]);
  const potentialPayout = useMemo(() => {
    if (!selectedSelection || !betAmount) return 0;
    return parseFloat(betAmount) * selectedSelection.odds;
  }, [selectedSelection, betAmount]);

  const balance = user?.balances?.find((b: any) => b.currency === currency)?.available ?? 0;

  // ---------------------------------------------------------------------------
  // Session Stats
  // ---------------------------------------------------------------------------

  const sessionStats = useMemo(() => {
    if (betHistory.length === 0) return null;
    const wins = betHistory.filter((b) => b.won).length;
    const totalWagered = betHistory.reduce((s, b) => s + (b.betAmount ?? 0), 0);
    const totalProfit = betHistory.reduce((s, b) => s + (b.profit ?? 0), 0);
    return {
      bets: betHistory.length,
      winRate: ((wins / betHistory.length) * 100).toFixed(0),
      wagered: totalWagered,
      profit: totalProfit,
    };
  }, [betHistory]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0D1117] text-white pb-20">
      {/* Cloudbet Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-xs font-bold tracking-widest text-[#8B949E]">CRYPTOBET</span>
      </div>

      {/* Sport Tabs */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(Object.keys(SPORT_LABELS) as Sport[]).map((sport) => (
            <button
              key={sport}
              onClick={() => {
                setActiveSport(sport);
                setSelectedEvent(null);
                setSelectedSelection(null);
                setSimulation(null);
                setActiveBetResult(null);
              }}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
                activeSport === sport
                  ? 'text-white'
                  : 'bg-[#161B22] text-[#8B949E] border border-[#30363D]'
              )}
              style={activeSport === sport ? {
                background: `linear-gradient(135deg, ${SPORT_COLORS[sport]}CC, ${SPORT_COLORS[sport]}66)`,
              } : undefined}
            >
              {SPORT_ICONS[sport]}
              {SPORT_LABELS[sport]}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                activeSport === sport ? 'bg-white/20' : 'bg-[#21262D]'
              )}>
                {events[sport].length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Simulation */}
      <AnimatePresence>
        {simulation && selectedEvent && !simulation.finished && (
          <div className="px-4 mb-3">
            <MatchSimulation simulation={simulation} event={selectedEvent} />
          </div>
        )}
      </AnimatePresence>

      {/* Bet Result */}
      <AnimatePresence>
        {activeBetResult && simulation?.finished && (
          <div className="px-4 mb-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'rounded-xl p-4 text-center border',
                activeBetResult.won
                  ? 'bg-[#10B981]/10 border-[#10B981]/40'
                  : 'bg-[#EF4444]/10 border-[#EF4444]/40'
              )}
            >
              <div className={cn('text-2xl font-bold mb-1', activeBetResult.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                {activeBetResult.won ? 'You Won!' : 'You Lost'}
              </div>
              <div
                className={cn('text-lg font-mono', activeBetResult.won ? 'text-[#10B981]' : 'text-[#EF4444]')}
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {activeBetResult.profit >= 0 ? '+' : ''}{formatCurrency(activeBetResult.profit, currency)}
              </div>
              {activeBetResult.won && (
                <div className="text-xs text-[#8B949E] mt-1">
                  Payout: {formatCurrency(activeBetResult.payout, currency)}
                </div>
              )}
              <button
                onClick={() => {
                  setActiveBetResult(null);
                  setSimulation(null);
                  setSelectedEvent(null);
                  setSelectedSelection(null);
                }}
                className="mt-3 px-6 py-2 text-xs bg-[#21262D] border border-[#30363D] rounded-xl hover:bg-[#2D333B] transition-colors font-semibold"
              >
                Back to Events
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Events List */}
      {!simulation && (
        <div className="px-4 space-y-2 mb-4">
          {currentEvents.length === 0 ? (
            <div className="bg-[#161B22] rounded-xl p-8 text-center border border-[#30363D]">
              <p className="text-[#8B949E] text-sm">No events available. Check back soon.</p>
            </div>
          ) : (
            currentEvents.map((event) => {
              const isSelected = selectedEvent?.id === event.id;

              return (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'bg-[#161B22] rounded-xl overflow-hidden transition-all border',
                    isSelected ? 'border-[#8B5CF6]' : 'border-[#30363D]'
                  )}
                >
                  {/* Event Header */}
                  <div
                    className="px-3 py-2.5 cursor-pointer"
                    onClick={() => {
                      setSelectedEvent(isSelected ? null : event);
                      setSelectedSelection(null);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-[#8B949E]">{event.league}</span>
                      <div className="flex items-center gap-1 text-[#8B949E]">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <EventCountdown date={event.startTime} />
                      </div>
                    </div>

                    {/* Teams + Odds */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="text-sm font-semibold truncate">{event.homeTeam}</div>
                        <div className="text-[10px] text-[#8B949E]">vs</div>
                        <div className="text-sm font-semibold truncate">{event.awayTeam}</div>
                      </div>

                      {/* Odds Buttons */}
                      <div className="flex gap-1.5">
                        {event.selections.map((sel) => (
                          <button
                            key={sel.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                              setSelectedSelection(
                                selectedSelection?.id === sel.id ? null : sel
                              );
                            }}
                            className={cn(
                              'flex flex-col items-center px-2.5 py-1.5 rounded-lg text-xs transition-all min-w-[52px]',
                              selectedSelection?.id === sel.id
                                ? 'bg-[#8B5CF6] text-white'
                                : 'bg-[#21262D] text-gray-300 border border-[#30363D]'
                            )}
                          >
                            <span className="text-[9px] text-[#8B949E] mb-0.5">
                              {sel.label === event.homeTeam ? '1' : sel.label === 'Draw' ? 'X' : '2'}
                            </span>
                            <span
                              className="font-bold font-mono text-[11px]"
                              style={{ fontFamily: 'JetBrains Mono, monospace' }}
                            >
                              {sel.odds.toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <div className="px-4 mb-3">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400"
            >
              {error}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bet Controls */}
      {!simulation && (
        <div className="px-4 space-y-3">
          {/* Selected Info */}
          {selectedSelection && selectedEvent && (
            <div className="bg-[#161B22] rounded-xl p-3 border border-[#8B5CF6]/30">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[#8B949E] truncate">{selectedEvent.league}</div>
                  <div className="text-xs font-semibold truncate">
                    {selectedEvent.homeTeam} vs {selectedEvent.awayTeam}
                  </div>
                </div>
                <div className="text-right ml-3">
                  <div className="text-[10px] text-[#8B949E]">{selectedSelection.label}</div>
                  <span
                    className="text-sm font-bold font-mono text-[#8B5CF6]"
                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {selectedSelection.odds.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Manual / Auto Toggle */}
          <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
            <button
              onClick={() => setMode('manual')}
              className={cn(
                'flex-1 py-2 text-xs font-bold transition-colors',
                mode === 'manual' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]'
              )}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('auto')}
              className={cn(
                'flex-1 py-2 text-xs font-bold transition-colors',
                mode === 'auto' ? 'bg-[#8B5CF6] text-white' : 'text-[#8B949E]'
              )}
            >
              Auto
            </button>
          </div>

          {/* Bet Amount */}
          <div>
            <label className="text-xs text-[#8B949E] mb-1.5 block">Bet Amount</label>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center px-3 gap-2">
              <span className="text-[#8B949E] text-sm font-bold w-5 text-center">
                {CURRENCY_ICONS[currency] || '$'}
              </span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={isPlacingBet}
                className="flex-1 bg-transparent text-center text-sm font-mono outline-none text-white disabled:opacity-50"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
                step="any"
                min="0"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => adjustBet(0.5)}
                  className="w-7 h-7 rounded-md bg-[#21262D] border border-[#30363D] flex items-center justify-center text-[#8B949E] text-xs font-bold hover:text-white transition-colors"
                >
                  -
                </button>
                <button
                  onClick={() => adjustBet(2)}
                  className="w-7 h-7 rounded-md bg-[#21262D] border border-[#30363D] flex items-center justify-center text-[#8B949E] text-xs font-bold hover:text-white transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex gap-2">
            {['Min', '10%', '25%', '50%', 'Max'].map((label) => (
              <button
                key={label}
                onClick={() => {
                  const b = typeof balance === 'number' ? balance : 0;
                  if (label === 'Min') setBetAmount(getDefaultBet(currency));
                  else if (label === '10%') setBetAmount((b * 0.1).toFixed(8));
                  else if (label === '25%') setBetAmount((b * 0.25).toFixed(8));
                  else if (label === '50%') setBetAmount((b * 0.5).toFixed(8));
                  else if (label === 'Max') setBetAmount(b.toFixed(8));
                }}
                className="flex-1 bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors font-medium"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Potential Payout */}
          {selectedSelection && (
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[#8B949E]">Potential Payout</span>
              <span
                className="text-[#10B981] font-bold font-mono"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {formatCurrency(potentialPayout, currency)}
              </span>
            </div>
          )}

          {/* Place Bet Button */}
          <motion.button
            onClick={placeBet}
            disabled={isPlacingBet || !selectedSelection || !betAmount || parseFloat(betAmount) <= 0}
            whileTap={{ scale: isPlacingBet ? 1 : 0.97 }}
            className={cn(
              'w-full py-3.5 rounded-xl font-bold text-base transition-all',
              isPlacingBet || !selectedSelection || !betAmount || parseFloat(betAmount) <= 0
                ? 'bg-[#2D333B] text-[#8B949E] cursor-not-allowed'
                : 'bg-[#C8FF00] text-black'
            )}
          >
            {isPlacingBet ? 'Simulating...' : !selectedSelection ? 'Select an Event' : 'PLACE BET'}
          </motion.button>

          {/* Session Stats */}
          {sessionStats && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-[#161B22] rounded-lg p-2 text-center border border-[#30363D]">
                <div className="text-[10px] text-[#8B949E]">Bets</div>
                <div className="text-sm font-bold font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {sessionStats.bets}
                </div>
              </div>
              <div className="bg-[#161B22] rounded-lg p-2 text-center border border-[#30363D]">
                <div className="text-[10px] text-[#8B949E]">Win%</div>
                <div className="text-sm font-bold font-mono text-[#10B981]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {sessionStats.winRate}%
                </div>
              </div>
              <div className="bg-[#161B22] rounded-lg p-2 text-center border border-[#30363D]">
                <div className="text-[10px] text-[#8B949E]">Wagered</div>
                <div className="text-[10px] font-bold font-mono text-gray-300 truncate" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatCurrency(sessionStats.wagered, currency)}
                </div>
              </div>
              <div className="bg-[#161B22] rounded-lg p-2 text-center border border-[#30363D]">
                <div className="text-[10px] text-[#8B949E]">Profit</div>
                <div
                  className={cn('text-[10px] font-bold font-mono truncate', sessionStats.profit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {sessionStats.profit >= 0 ? '+' : ''}{formatCurrency(sessionStats.profit, currency)}
                </div>
              </div>
            </div>
          )}

          {/* Bet History Toggle */}
          {betHistory.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between bg-[#161B22] border border-[#30363D] rounded-xl px-3 py-2.5"
            >
              <span className="text-xs text-[#8B949E] font-semibold flex items-center gap-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Bet History ({betHistory.length})
              </span>
              <svg
                className={cn('w-4 h-4 text-[#8B949E] transition-transform', showHistory && 'rotate-180')}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

          {/* History Entries */}
          <AnimatePresence>
            {showHistory && betHistory.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-1.5"
              >
                {betHistory.slice(0, 10).map((bet) => (
                  <div
                    key={bet.id}
                    className={cn(
                      'px-3 py-2 rounded-lg border',
                      bet.won ? 'bg-[#10B981]/5 border-[#10B981]/20' : 'bg-[#EF4444]/5 border-[#EF4444]/20'
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: SPORT_COLORS[bet.sport] }}>
                          {SPORT_ICONS[bet.sport]}
                        </span>
                        <span className="text-xs text-[#8B949E] truncate max-w-[140px]">{bet.matchup}</span>
                      </div>
                      <span className={cn('text-[10px] font-bold', bet.won ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                        {bet.won ? 'WON' : 'LOST'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8B949E]">
                        {bet.selection} @ <span className="font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{bet.odds.toFixed(2)}</span>
                      </span>
                      <span
                        className={cn('text-xs font-mono font-bold', bet.won ? 'text-[#10B981]' : 'text-[#EF4444]')}
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {bet.profit >= 0 ? '+' : ''}{formatCurrency(bet.profit, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        {/* Left Icons */}
        <div className="flex items-center gap-3">
          <button className="text-[#8B949E] hover:text-white transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9.5L12 4l9 5.5" />
              <path d="M19 13v6a1 1 0 01-1 1H6a1 1 0 01-1-1v-6" />
            </svg>
          </button>
          <button className="text-[#8B949E] hover:text-white transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </button>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="text-[#8B949E] hover:text-white transition-colors"
          >
            {soundOn ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>
        </div>

        {/* Center Balance */}
        <div className="text-center">
          <span className="text-[10px] text-[#8B949E] block leading-tight">Balance</span>
          <span className="text-xs font-bold font-mono text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {formatCurrency(balance, currency)}
          </span>
        </div>

        {/* Provably Fair Badge */}
        <div className="flex items-center gap-1 bg-[#0D1117] border border-[#30363D] rounded-full px-2.5 py-1">
          <svg className="w-3 h-3 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          <span className="text-[9px] text-[#8B949E] font-semibold whitespace-nowrap">Provably Fair</span>
        </div>
      </div>
    </div>
  );
}
