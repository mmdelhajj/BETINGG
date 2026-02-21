'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported sport slugs for clock formatting. */
export type SportSlug =
  | 'football'
  | 'basketball'
  | 'ice-hockey'
  | 'american-football'
  | 'handball'
  | 'rugby'
  | 'tennis'
  | 'volleyball'
  | 'baseball'
  | 'cricket'
  | (string & {});

/**
 * Period identifiers.
 * Football: "1H", "2H", "HT", "ET1", "ET2", "PEN"
 * Basketball: "Q1", "Q2", "Q3", "Q4", "OT"
 * Ice Hockey: "P1", "P2", "P3", "OT"
 * etc.
 */
export type MatchPeriod = string;

/** Configuration for countdown-based sports (basketball, ice hockey). */
interface CountdownSportConfig {
  mode: 'countdown';
  /** Total seconds per period (e.g. 12 * 60 for NBA quarter). */
  periodDuration: number;
  /** Period labels in order (e.g. ["Q1","Q2","Q3","Q4"]). */
  periods: string[];
  overtimeLabel: string;
  /** Break periods where clock pauses. */
  breakPeriods: string[];
}

/** Configuration for countup-based sports (football, handball, rugby). */
interface CountupSportConfig {
  mode: 'countup';
  /** Break periods where clock pauses (e.g. "HT"). */
  breakPeriods: string[];
}

type SportClockConfig = CountdownSportConfig | CountupSportConfig;

/** Sport clock configurations keyed by sport slug. */
const SPORT_CLOCK_CONFIG: Record<string, SportClockConfig> = {
  football: {
    mode: 'countup',
    breakPeriods: ['HT', 'FT', 'PEN'],
  },
  handball: {
    mode: 'countup',
    breakPeriods: ['HT', 'FT'],
  },
  rugby: {
    mode: 'countup',
    breakPeriods: ['HT', 'FT'],
  },
  basketball: {
    mode: 'countdown',
    periodDuration: 12 * 60, // 12 min quarters (NBA default)
    periods: ['Q1', 'Q2', 'Q3', 'Q4'],
    overtimeLabel: 'OT',
    breakPeriods: ['HT', 'BREAK', 'FT'],
  },
  'ice-hockey': {
    mode: 'countdown',
    periodDuration: 20 * 60, // 20 min periods
    periods: ['P1', 'P2', 'P3'],
    overtimeLabel: 'OT',
    breakPeriods: ['BREAK', 'FT'],
  },
  'american-football': {
    mode: 'countdown',
    periodDuration: 15 * 60, // 15 min quarters
    periods: ['Q1', 'Q2', 'Q3', 'Q4'],
    overtimeLabel: 'OT',
    breakPeriods: ['HT', 'BREAK', 'FT'],
  },
};

// ---------------------------------------------------------------------------
// useMatchClock — Custom hook for ticking match clock
// ---------------------------------------------------------------------------

export interface UseMatchClockOptions {
  /** Last known minute value from API (e.g. 45 for football, or seconds remaining for countdown sports). */
  timer?: number | string | null;
  /** Last known seconds value from API (optional fine-grained seconds). */
  timerSeconds?: number | null;
  /** Current match period (e.g. "1H", "Q2", "P3"). */
  period: MatchPeriod;
  /** Sport slug to determine clock behavior. */
  sportSlug: SportSlug;
  /** Match start timestamp (ISO string). Used as fallback if timer is not provided. */
  startTime?: string;
  /** Whether the clock should be running (defaults to true). */
  isRunning?: boolean;
}

export interface UseMatchClockResult {
  /** Formatted display string (e.g. "45:23", "Q3 8:45"). */
  display: string;
  /** Raw elapsed seconds (for countup) or remaining seconds (for countdown). */
  rawSeconds: number;
  /** Whether the clock is currently paused (break/halftime). */
  isPaused: boolean;
  /** Period label to show alongside the clock. */
  periodLabel: string;
}

export function useMatchClock({
  timer,
  timerSeconds,
  period,
  sportSlug,
  startTime,
  isRunning = true,
}: UseMatchClockOptions): UseMatchClockResult {
  const config = SPORT_CLOCK_CONFIG[sportSlug];

  // Determine if clock is in a break
  const isPaused = useMemo(() => {
    if (!config) return false;
    return config.breakPeriods.includes(period);
  }, [config, period]);

  // Compute initial seconds from timer prop
  const getInitialSeconds = useCallback((): number => {
    const timerNum = timer != null ? parseInt(String(timer), 10) : NaN;

    if (config?.mode === 'countdown') {
      // For countdown: timer represents minutes remaining or seconds remaining
      if (!isNaN(timerNum)) {
        const baseSec = timerNum * 60;
        const sec = timerSeconds != null ? timerSeconds : 0;
        return Math.max(0, baseSec + sec);
      }
      return (config as CountdownSportConfig).periodDuration;
    }

    // Countup mode
    if (!isNaN(timerNum)) {
      const baseSec = timerNum * 60;
      const sec = timerSeconds != null ? timerSeconds : 0;
      return baseSec + sec;
    }

    // Fallback: compute from startTime
    if (startTime) {
      const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      return Math.max(0, elapsed);
    }

    return 0;
  }, [timer, timerSeconds, config, startTime]);

  const [seconds, setSeconds] = useState<number>(getInitialSeconds);

  // Reset when timer or period changes (new data from API)
  const prevTimerRef = useRef(timer);
  const prevPeriodRef = useRef(period);

  useEffect(() => {
    if (prevTimerRef.current !== timer || prevPeriodRef.current !== period) {
      setSeconds(getInitialSeconds());
      prevTimerRef.current = timer;
      prevPeriodRef.current = period;
    }
  }, [timer, period, getInitialSeconds]);

  // Tick every second
  useEffect(() => {
    if (isPaused || !isRunning) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (config?.mode === 'countdown') {
          return Math.max(0, prev - 1);
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, isRunning, config]);

  // Format the display
  const display = useMemo(() => {
    if (isPaused) {
      // Show the break label directly
      if (period === 'HT') return 'HT';
      if (period === 'FT') return 'FT';
      if (period === 'PEN') return 'PEN';
      return period;
    }

    const totalSec = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

    return timeStr;
  }, [seconds, isPaused, period]);

  // Period label for display alongside the clock
  const periodLabel = useMemo(() => {
    if (isPaused) return '';

    // For countdown sports, show the period prefix
    if (config?.mode === 'countdown') {
      const cdConfig = config as CountdownSportConfig;
      if (cdConfig.periods.includes(period)) {
        return period;
      }
      if (period === 'OT' || period.startsWith('OT')) {
        return cdConfig.overtimeLabel;
      }
      return period;
    }

    // For countup sports (football etc), no prefix needed — just the time
    return '';
  }, [config, period, isPaused]);

  return {
    display,
    rawSeconds: seconds,
    isPaused,
    periodLabel,
  };
}

// ---------------------------------------------------------------------------
// LiveMatchClock — Ticking clock display
// ---------------------------------------------------------------------------

export interface LiveMatchClockProps {
  /** Match start timestamp (ISO string). */
  startTime?: string;
  /** Current match period. */
  period: MatchPeriod;
  /** Last known timer value from API (minutes). */
  timer?: number | string | null;
  /** Optional fine-grained seconds from API. */
  timerSeconds?: number | null;
  /** Sport slug for clock mode. */
  sportSlug: SportSlug;
  /** Additional CSS classes. */
  className?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
}

export function LiveMatchClock({
  startTime,
  period,
  timer,
  timerSeconds,
  sportSlug,
  className,
  size = 'md',
}: LiveMatchClockProps) {
  const { display, isPaused, periodLabel } = useMatchClock({
    timer,
    timerSeconds,
    period,
    sportSlug,
    startTime,
  });

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span
      className={cn(
        'font-mono font-semibold tabular-nums',
        isPaused ? 'text-yellow-400' : 'text-emerald-400',
        sizeClasses[size],
        className,
      )}
    >
      {periodLabel && (
        <span className="mr-1">{periodLabel}</span>
      )}
      <span>{display}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// AnimatedScore — Score display with flash on change
// ---------------------------------------------------------------------------

export interface AnimatedScoreProps {
  /** The current score value. */
  score: number;
  /** Team name (for accessibility). */
  teamName: string;
  /** Additional CSS classes. */
  className?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
}

export function AnimatedScore({
  score,
  teamName,
  className,
  size = 'md',
}: AnimatedScoreProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevScoreRef = useRef(score);
  const animationKeyRef = useRef(0);

  useEffect(() => {
    if (prevScoreRef.current !== score) {
      prevScoreRef.current = score;
      animationKeyRef.current += 1;
      setIsFlashing(true);

      const timeout = setTimeout(() => {
        setIsFlashing(false);
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [score]);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <span
      key={animationKeyRef.current}
      aria-label={`${teamName} score: ${score}`}
      className={cn(
        'font-mono font-bold tabular-nums inline-block',
        'text-white transition-colors duration-200',
        sizeClasses[size],
        isFlashing && 'animate-score-pop text-emerald-400',
        className,
      )}
    >
      {score}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LiveIndicator — Pulsing "LIVE" badge
// ---------------------------------------------------------------------------

export interface LiveIndicatorProps {
  /** Additional CSS classes. */
  className?: string;
  /** Size variant. */
  size?: 'xs' | 'sm' | 'md';
  /** Whether to show the text label (defaults to true). */
  showLabel?: boolean;
}

export function LiveIndicator({
  className,
  size = 'sm',
  showLabel = true,
}: LiveIndicatorProps) {
  const dotSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
  };

  const textSizes = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-xs',
  };

  const paddingSizes = {
    xs: 'px-1.5 py-0.5',
    sm: 'px-2 py-0.5',
    md: 'px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full',
        'bg-red-500/10 border border-red-500/20',
        paddingSizes[size],
        className,
      )}
    >
      <span className="relative flex shrink-0">
        <span
          className={cn(
            'absolute inline-flex rounded-full bg-red-500 opacity-75 animate-ping',
            dotSizes[size],
          )}
        />
        <span
          className={cn(
            'relative inline-flex rounded-full bg-red-500',
            dotSizes[size],
          )}
        />
      </span>
      {showLabel && (
        <span
          className={cn(
            'font-bold uppercase tracking-wider text-red-500',
            textSizes[size],
          )}
        >
          LIVE
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LiveScoreCard — Full card combining all above
// ---------------------------------------------------------------------------

export type LiveScoreCardVariant = 'compact' | 'full';

export interface LiveScoreCardProps {
  /** Home team name. */
  homeTeam: string;
  /** Away team name. */
  awayTeam: string;
  /** Home team score. */
  homeScore: number;
  /** Away team score. */
  awayScore: number;
  /** Current match period. */
  period: MatchPeriod;
  /** Last known timer value from API (minutes). */
  timer?: number | string | null;
  /** Optional fine-grained seconds from API. */
  timerSeconds?: number | null;
  /** Sport slug. */
  sportSlug: SportSlug;
  /** Competition name (e.g. "Premier League"). */
  competitionName?: string;
  /** Event ID for navigation. */
  eventId: string;
  /** Match start timestamp (ISO string). */
  startTime?: string;
  /** Display variant. */
  variant?: LiveScoreCardVariant;
  /** Additional CSS classes. */
  className?: string;
}

export function LiveScoreCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  period,
  timer,
  timerSeconds,
  sportSlug,
  competitionName,
  eventId,
  startTime,
  variant = 'full',
  className,
}: LiveScoreCardProps) {
  const href = `/sports/${sportSlug}/${eventId}`;

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className={cn(
          'block rounded-card border border-border',
          'bg-[#1C2128] hover:border-accent/30 hover:bg-background-hover',
          'transition-all duration-200 p-3 group',
          className,
        )}
      >
        {/* Top row: LIVE badge + competition */}
        <div className="flex items-center justify-between mb-2">
          <LiveIndicator size="xs" />
          {competitionName && (
            <span className="text-[10px] text-text-muted truncate ml-2 max-w-[120px]">
              {competitionName}
            </span>
          )}
        </div>

        {/* Score row */}
        <div className="flex items-center justify-between">
          {/* Home */}
          <div className="flex-1 min-w-0">
            <span className="text-xs text-text truncate block">{homeTeam}</span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-1.5 mx-2 shrink-0">
            <AnimatedScore score={homeScore} teamName={homeTeam} size="sm" />
            <span className="text-text-muted text-xs font-medium">-</span>
            <AnimatedScore score={awayScore} teamName={awayTeam} size="sm" />
          </div>

          {/* Away */}
          <div className="flex-1 min-w-0 text-right">
            <span className="text-xs text-text truncate block">{awayTeam}</span>
          </div>
        </div>

        {/* Clock */}
        <div className="mt-2 text-center">
          <LiveMatchClock
            startTime={startTime}
            period={period}
            timer={timer}
            timerSeconds={timerSeconds}
            sportSlug={sportSlug}
            size="sm"
          />
        </div>
      </Link>
    );
  }

  // Full variant
  return (
    <Link
      href={href}
      className={cn(
        'block rounded-card border border-border',
        'bg-[#1C2128] hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5',
        'transition-all duration-200 p-4 group',
        className,
      )}
    >
      {/* Header: LIVE badge + competition name */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LiveIndicator size="sm" />
          {competitionName && (
            <span className="text-[11px] text-text-secondary truncate max-w-[200px]">
              {competitionName}
            </span>
          )}
        </div>
        <LiveMatchClock
          startTime={startTime}
          period={period}
          timer={timer}
          timerSeconds={timerSeconds}
          sportSlug={sportSlug}
          size="sm"
        />
      </div>

      {/* Main score area */}
      <div className="flex items-center justify-between gap-3">
        {/* Home team */}
        <div className="flex-1 min-w-0 text-left">
          <TeamInitials name={homeTeam} />
          <p className="text-sm font-medium text-text truncate mt-1.5">{homeTeam}</p>
        </div>

        {/* Score block */}
        <div className="flex items-center gap-2 shrink-0">
          <AnimatedScore score={homeScore} teamName={homeTeam} size="md" />
          <span className="text-text-muted text-lg font-light">:</span>
          <AnimatedScore score={awayScore} teamName={awayTeam} size="md" />
        </div>

        {/* Away team */}
        <div className="flex-1 min-w-0 text-right">
          <div className="flex justify-end">
            <TeamInitials name={awayTeam} />
          </div>
          <p className="text-sm font-medium text-text truncate mt-1.5">{awayTeam}</p>
        </div>
      </div>

      {/* Bottom: period info */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          {getPeriodDisplayName(period, sportSlug)}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// LiveScoreTicker — Horizontal scrolling ticker of live scores
// ---------------------------------------------------------------------------

export interface LiveScoreTickerEvent {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period: MatchPeriod;
  timer?: number | string | null;
  timerSeconds?: number | null;
  sportSlug: SportSlug;
  competitionName?: string;
  startTime?: string;
}

export interface LiveScoreTickerProps {
  /** Array of live events to display in the ticker. */
  events: LiveScoreTickerEvent[];
  /** Additional CSS classes for the container. */
  className?: string;
  /** Variant for each event card in the ticker. */
  cardVariant?: LiveScoreCardVariant;
}

export function LiveScoreTicker({
  events,
  className,
  cardVariant = 'compact',
}: LiveScoreTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden',
        'bg-background-card border-b border-border',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <LiveIndicator size="xs" />
          <span className="text-xs font-semibold text-text">
            Live Scores
          </span>
          <span className="text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full font-medium">
            {events.length}
          </span>
        </div>
        <Link
          href="/live"
          className="text-[11px] text-accent hover:text-accent-light font-medium transition-colors"
        >
          View all
        </Link>
      </div>

      {/* Scrollable ticker */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {events.map((event) => (
          <div key={event.eventId} className="shrink-0 w-[260px]">
            <LiveScoreCard
              homeTeam={event.homeTeam}
              awayTeam={event.awayTeam}
              homeScore={event.homeScore}
              awayScore={event.awayScore}
              period={event.period}
              timer={event.timer}
              timerSeconds={event.timerSeconds}
              sportSlug={event.sportSlug}
              competitionName={event.competitionName}
              eventId={event.eventId}
              startTime={event.startTime}
              variant={cardVariant}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Team initials avatar
// ---------------------------------------------------------------------------

function TeamInitials({ name }: { name: string }) {
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        'w-8 h-8 rounded-full',
        'bg-background-card border border-border',
      )}
    >
      <span className="text-[10px] font-bold text-text-secondary">{initials}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Friendly period name
// ---------------------------------------------------------------------------

function getPeriodDisplayName(period: MatchPeriod, sportSlug: SportSlug): string {
  const periodMap: Record<string, Record<string, string>> = {
    football: {
      '1H': '1st Half',
      '2H': '2nd Half',
      HT: 'Half Time',
      ET1: 'Extra Time 1st',
      ET2: 'Extra Time 2nd',
      PEN: 'Penalties',
      FT: 'Full Time',
    },
    basketball: {
      Q1: '1st Quarter',
      Q2: '2nd Quarter',
      Q3: '3rd Quarter',
      Q4: '4th Quarter',
      OT: 'Overtime',
      HT: 'Half Time',
      FT: 'Final',
    },
    'ice-hockey': {
      P1: '1st Period',
      P2: '2nd Period',
      P3: '3rd Period',
      OT: 'Overtime',
      FT: 'Final',
    },
    'american-football': {
      Q1: '1st Quarter',
      Q2: '2nd Quarter',
      Q3: '3rd Quarter',
      Q4: '4th Quarter',
      OT: 'Overtime',
      HT: 'Half Time',
      FT: 'Final',
    },
    handball: {
      '1H': '1st Half',
      '2H': '2nd Half',
      HT: 'Half Time',
      FT: 'Full Time',
    },
  };

  const sportPeriods = periodMap[sportSlug];
  if (sportPeriods && sportPeriods[period]) {
    return sportPeriods[period];
  }

  return period;
}
