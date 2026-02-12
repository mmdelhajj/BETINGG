'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { formatOdds, cn } from '@/lib/utils';
import { Star, Clock, ChevronRight } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { SportIcon } from '@/components/sports/SportIcon';
import type { Event, Selection, Market } from '@/types';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

/** Sports that typically have no draw outcome */
const NO_DRAW_SPORTS = new Set([
  'basketball',
  'ice-hockey',
  'american-football',
  'baseball',
  'tennis',
  'table-tennis',
  'badminton',
  'volleyball',
  'esports',
  'cs2',
  'dota-2',
  'league-of-legends',
  'valorant',
  'rainbow-six',
  'starcraft-2',
  'call-of-duty',
  'ea-sports-fc',
  'rocket-league',
]);

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface EventCardProps {
  event: Event;
  compact?: boolean;
  featured?: boolean;
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function formatEventDate(dateStr: string, isMobile = false): string {
  const date = new Date(dateStr);
  const timeStr = format(date, 'HH:mm');

  if (isMobile) {
    return timeStr;
  }

  if (isToday(date)) {
    return `Today, ${timeStr}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow, ${timeStr}`;
  }
  return format(date, 'MMM d, HH:mm');
}

/* ================================================================== */
/*  TeamLogo                                                           */
/* ================================================================== */

function TeamLogo({
  name,
  logo,
  isHome = true,
  size = 'default',
}: {
  name: string;
  logo?: string | null;
  isHome?: boolean;
  size?: 'compact' | 'default' | 'featured';
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    compact: 'w-6 h-6',
    default: 'w-7 h-7',
    featured: 'w-9 h-9',
  };

  const textSizeClasses = {
    compact: 'text-[9px]',
    default: 'text-[10px]',
    featured: 'text-xs',
  };

  if (logo && !imgError) {
    return (
      <img
        src={logo}
        alt={name}
        className={cn(
          sizeClasses[size],
          'rounded-full object-contain shrink-0 bg-white/5',
        )}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        textSizeClasses[size],
        'rounded-full flex items-center justify-center font-bold shrink-0',
        isHome
          ? 'bg-brand-500/20 text-brand-400'
          : 'bg-accent-purple/20 text-accent-purple',
      )}
    >
      {initials}
    </div>
  );
}

/* ================================================================== */
/*  OddsButton -- Bet365/Cloudbet style with CSS transitions           */
/* ================================================================== */

type OddsFlash = 'up' | 'down' | null;

function OddsButton({
  selection,
  label,
  isSelected,
  onSelect,
  compact = false,
}: {
  selection: Selection | null;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const [flash, setFlash] = useState<OddsFlash>(null);
  const prevOdds = useRef<string | null>(null);

  // Detect odds movement for flash animation
  useEffect(() => {
    if (!selection) return;
    if (prevOdds.current !== null && prevOdds.current !== selection.odds) {
      const dir =
        parseFloat(selection.odds) > parseFloat(prevOdds.current)
          ? 'up'
          : 'down';
      setFlash(dir);
      const timer = setTimeout(() => setFlash(null), 1500);
      return () => clearTimeout(timer);
    }
    prevOdds.current = selection.odds;
  }, [selection?.odds, selection]);

  if (!selection) {
    return (
      <div
        className={cn(
          'flex-1 min-w-[64px] rounded-md flex flex-col items-center justify-center gap-0.5',
          'bg-white/[0.03] border border-white/[0.06]',
          compact ? 'h-10 px-2' : 'h-11 px-3',
        )}
      >
        <span
          className={cn(
            'font-medium text-text-dim leading-none uppercase tracking-wide',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          {label}
        </span>
        <span className="text-xs text-text-dim font-mono">-</span>
      </div>
    );
  }

  const isSuspended = selection.status === 'SUSPENDED';

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSuspended) onSelect();
      }}
      disabled={isSuspended}
      className={cn(
        'flex-1 min-w-[64px] rounded-md flex flex-col items-center justify-center gap-0.5',
        'font-mono relative overflow-hidden cursor-pointer',
        'border transition-all duration-200',
        compact ? 'h-10 px-2' : 'h-11 px-3',
        // Selected state - lime green background (#BFFF00)
        isSelected && [
          'bg-[#BFFF00] border-[#BFFF00]',
          'shadow-[0_0_0_1px_rgba(191,255,0,0.3)]',
        ],
        // Flash up state - green
        !isSelected &&
          flash === 'up' && [
            'bg-accent-green/20 border-accent-green/40',
            'odds-flash-up',
          ],
        // Flash down state - red
        !isSelected &&
          flash === 'down' && [
            'bg-accent-red/20 border-accent-red/40',
            'odds-flash-down',
          ],
        // Default state
        !isSelected &&
          !flash && [
            'bg-white/[0.03] border-white/[0.06]',
            'hover:bg-white/[0.06] hover:border-white/[0.10]',
            'active:scale-[0.98]',
          ],
        // Suspended
        isSuspended && 'opacity-30 cursor-not-allowed',
      )}
      style={{
        // Minimum touch target height
        minHeight: '44px',
      }}
    >
      {/* Outcome label */}
      <span
        className={cn(
          'font-medium leading-none uppercase tracking-wide',
          compact ? 'text-[10px]' : 'text-[11px]',
          isSelected ? 'text-[#1A1B1F]' : 'text-text-dim',
        )}
      >
        {label}
      </span>
      {/* Odds value - reserved min-width to prevent layout shift */}
      <span
        className={cn(
          'font-bold leading-tight min-w-[32px] text-center',
          compact ? 'text-sm' : 'text-[14px]',
          isSelected
            ? 'text-[#1A1B1F]'
            : flash === 'up'
              ? 'text-accent-green'
              : flash === 'down'
                ? 'text-accent-red'
                : 'text-white',
        )}
      >
        {formatOdds(selection.odds)}
      </span>
    </button>
  );
}

/* ================================================================== */
/*  LiveBadge                                                          */
/* ================================================================== */

function LiveBadge({
  matchTime,
  period,
}: {
  matchTime?: string;
  period?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Pulsing red dot */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-red" />
      </span>
      <span className="text-[11px] font-bold text-accent-red uppercase tracking-wider">
        LIVE
      </span>
      {(period || matchTime) && (
        <span className="text-[11px] text-text-secondary font-medium ml-0.5">
          {period && <span>{period}</span>}
          {matchTime && (
            <span>
              {period ? ' ' : ''}
              {matchTime}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/* ================================================================== */
/*  LiveScore -- score display with CSS pulse animation                */
/* ================================================================== */

function LiveScore({
  score,
  prevScoreRef,
}: {
  score: number;
  prevScoreRef: React.MutableRefObject<number | null>;
}) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevScoreRef.current !== null && prevScoreRef.current !== score) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1200);
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = score;
  }, [score, prevScoreRef]);

  return (
    <span
      className={cn(
        'text-lg font-bold font-mono text-white tabular-nums leading-none min-w-[20px] text-center',
        pulse && 'score-pulse',
      )}
    >
      {score}
    </span>
  );
}

/* ================================================================== */
/*  FavoriteButton                                                     */
/* ================================================================== */

function FavoriteButton({ eventId }: { eventId: string }) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    try {
      const favorites: string[] = JSON.parse(
        localStorage.getItem('cryptobet-favorites') || '[]',
      );
      setIsFavorite(favorites.includes(eventId));
    } catch {
      // ignore parse errors
    }
  }, [eventId]);

  const toggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsFavorite((prev) => {
        const next = !prev;
        try {
          const favorites: string[] = JSON.parse(
            localStorage.getItem('cryptobet-favorites') || '[]',
          );
          if (next) {
            favorites.push(eventId);
          } else {
            const idx = favorites.indexOf(eventId);
            if (idx >= 0) favorites.splice(idx, 1);
          }
          localStorage.setItem(
            'cryptobet-favorites',
            JSON.stringify(favorites),
          );
        } catch {
          // ignore
        }
        return next;
      });
    },
    [eventId],
  );

  return (
    <button
      onClick={toggleFavorite}
      className={cn(
        'rounded transition-colors hover:bg-white/5',
        'min-w-[32px] min-h-[32px] flex items-center justify-center',
      )}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className={cn(
          'w-4 h-4 transition-all duration-200',
          isFavorite
            ? 'fill-accent-yellow text-accent-yellow scale-110'
            : 'text-text-dim hover:text-text-muted hover:scale-110',
        )}
      />
    </button>
  );
}

/* ================================================================== */
/*  EventCard -- Main component (Bet365/Cloudbet mobile-first style)  */
/* ================================================================== */

export function EventCard({
  event,
  compact = false,
  featured = false,
}: EventCardProps) {
  const { toggleSelection, hasSelection } = useBetSlipStore();

  // Score pulse refs
  const prevHomeScore = useRef<number | null>(null);
  const prevAwayScore = useRef<number | null>(null);

  /* ---- Market extraction ------------------------------------------ */

  const moneylineMarket = event.markets?.find(
    (m) => m.type === 'MONEYLINE',
  );
  const mainSelections = moneylineMarket?.selections || [];
  const marketCount = event.markets ? event.markets.length : 0;
  const isThreeWay = mainSelections.length === 3;

  /* ---- Sport detection --------------------------------------------- */

  const sport = event.competition?.sport;
  const sportSlug = sport?.slug || '';
  const isNoDraw =
    NO_DRAW_SPORTS.has(sportSlug) || (!isThreeWay && mainSelections.length === 2);

  /* ---- Selection mapping ------------------------------------------- */

  const homeSel =
    mainSelections.find((s) => s.outcome === 'home') ||
    mainSelections[0] ||
    null;
  const drawSel =
    mainSelections.find((s) => s.outcome === 'draw') ||
    (isThreeWay ? mainSelections[1] : null);
  const awaySel =
    mainSelections.find((s) => s.outcome === 'away') ||
    (isThreeWay ? mainSelections[2] : mainSelections[1]) ||
    null;

  /* ---- Bet slip handler -------------------------------------------- */

  const handleSelectOdds = useCallback(
    (selection: Selection, market: Market | undefined) => {
      toggleSelection({
        selectionId: selection.id,
        selectionName: selection.name,
        marketName: market?.name || '',
        eventName: event.name,
        eventId: event.id,
        odds: selection.odds,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
      });
    },
    [toggleSelection, event],
  );

  /* ---- Outcome labels ---------------------------------------------- */

  const homeLabel = '1';
  const drawLabel = 'X';
  const awayLabel = '2';

  /* ---- Logo size based on variant --------------------------------- */

  const logoSize = featured ? 'featured' : compact ? 'compact' : 'default';

  /* ---- Render ------------------------------------------------------ */

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden transition-all duration-200 group',
        'bg-[#1A1B1F]',
        'border border-white/[0.08]',
        'hover:border-white/[0.12] hover:shadow-lg',
        compact ? 'p-3' : 'p-3 md:p-4',
        featured && 'md:p-5',
      )}
    >
      {/* ========== HEADER: Competition + Date/Live + Favorite ========== */}
      <div className="flex items-center justify-between mb-2 md:mb-2.5">
        {/* Left: sport icon + competition */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {sport?.slug && (
            <SportIcon
              slug={sport.slug}
              size={compact ? 11 : 12}
              emoji={sport.icon}
            />
          )}
          <span
            className={cn(
              'text-text-dim font-medium leading-none line-clamp-1',
              compact ? 'text-[10px]' : 'text-[11px] md:text-xs',
            )}
            title={event.competition?.name}
          >
            {event.competition?.name}
          </span>
        </div>

        {/* Right: live badge or date + favorite */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {event.isLive ? (
            <LiveBadge
              matchTime={event.metadata?.matchTime as string | undefined}
              period={event.metadata?.period as string | undefined}
            />
          ) : (
            <div className="flex items-center gap-1 text-text-dim">
              <Clock className={cn('w-3 h-3', compact && 'w-2.5 h-2.5')} />
              {/* Mobile: condensed time, Desktop: full date */}
              <span className="text-[11px] font-medium leading-none md:hidden">
                {formatEventDate(event.startTime, true)}
              </span>
              <span className="text-[11px] font-medium leading-none hidden md:inline">
                {formatEventDate(event.startTime, false)}
              </span>
            </div>
          )}
          <FavoriteButton eventId={event.id} />
        </div>
      </div>

      {/* ========== BODY: Teams + Score (live) ========================= */}
      {event.homeTeam && event.awayTeam ? (
        <>
          {/* Teams row */}
          <div
            className={cn(
              'flex items-center justify-between',
              compact ? 'mb-2' : 'mb-2.5 md:mb-3',
            )}
          >
            {/* Home team */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <TeamLogo
                name={event.homeTeam}
                logo={event.homeTeamLogo}
                isHome
                size={logoSize}
              />
              <span
                className={cn(
                  'font-medium text-white',
                  // 2-line clamp on mobile, prevent truncation to "Manches..."
                  'line-clamp-2 break-words',
                  compact ? 'text-[13px]' : 'text-sm md:text-[15px]',
                )}
                title={event.homeTeam}
              >
                {event.homeTeam}
              </span>
            </div>

            {/* Score or VS - reserved min-width to prevent layout shift */}
            {event.isLive ? (
              <div className="flex items-center gap-1.5 px-2 md:px-3 shrink-0 min-w-[60px] justify-center">
                <LiveScore
                  score={event.homeScore ?? 0}
                  prevScoreRef={prevHomeScore}
                />
                <span className="text-xs text-text-dim font-medium mx-0.5">
                  -
                </span>
                <LiveScore
                  score={event.awayScore ?? 0}
                  prevScoreRef={prevAwayScore}
                />
              </div>
            ) : (
              <span className="text-xs text-text-dim font-medium px-2 md:px-3 shrink-0 min-w-[40px] text-center">
                vs
              </span>
            )}

            {/* Away team */}
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              <span
                className={cn(
                  'font-medium text-white text-right',
                  // 2-line clamp on mobile
                  'line-clamp-2 break-words',
                  compact ? 'text-[13px]' : 'text-sm md:text-[15px]',
                )}
                title={event.awayTeam}
              >
                {event.awayTeam}
              </span>
              <TeamLogo
                name={event.awayTeam}
                logo={event.awayTeamLogo}
                isHome={false}
                size={logoSize}
              />
            </div>
          </div>

          {/* ========== ODDS BUTTONS ROW ================================ */}
          <div className="flex gap-2">
            {isNoDraw ? (
              <>
                {/* Home */}
                <OddsButton
                  selection={homeSel}
                  label={homeLabel}
                  isSelected={homeSel ? hasSelection(homeSel.id) : false}
                  onSelect={() =>
                    homeSel && handleSelectOdds(homeSel, moneylineMarket)
                  }
                  compact={compact}
                />
                {/* Away */}
                <OddsButton
                  selection={awaySel}
                  label={awayLabel}
                  isSelected={awaySel ? hasSelection(awaySel.id) : false}
                  onSelect={() =>
                    awaySel && handleSelectOdds(awaySel, moneylineMarket)
                  }
                  compact={compact}
                />
              </>
            ) : (
              <>
                {/* Home */}
                <OddsButton
                  selection={homeSel}
                  label={homeLabel}
                  isSelected={homeSel ? hasSelection(homeSel.id) : false}
                  onSelect={() =>
                    homeSel && handleSelectOdds(homeSel, moneylineMarket)
                  }
                  compact={compact}
                />
                {/* Draw */}
                <OddsButton
                  selection={drawSel}
                  label={drawLabel}
                  isSelected={drawSel ? hasSelection(drawSel.id) : false}
                  onSelect={() =>
                    drawSel && handleSelectOdds(drawSel, moneylineMarket)
                  }
                  compact={compact}
                />
                {/* Away */}
                <OddsButton
                  selection={awaySel}
                  label={awayLabel}
                  isSelected={awaySel ? hasSelection(awaySel.id) : false}
                  onSelect={() =>
                    awaySel && handleSelectOdds(awaySel, moneylineMarket)
                  }
                  compact={compact}
                />
              </>
            )}
          </div>

          {/* ========== FOOTER: +N markets link ======================== */}
          {marketCount > 1 && (
            <div className="mt-2 md:mt-2.5 flex items-center justify-end">
              <Link
                href={`/sports/event/${event.id}`}
                className={cn(
                  'flex items-center gap-0.5 text-brand-400 hover:text-brand-300 font-medium transition-colors',
                  compact ? 'text-[10px]' : 'text-[11px]',
                )}
                onClick={(e) => e.stopPropagation()}
              >
                +{marketCount - 1} market{marketCount - 1 > 1 ? 's' : ''}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </>
      ) : (
        /* ---- Fallback: no teams (outrights, specials) --------------- */
        <div>
          <p
            className={cn(
              'font-medium text-white mb-2 line-clamp-2',
              compact ? 'text-[13px]' : 'text-sm',
            )}
          >
            {event.name}
          </p>
          {mainSelections.length > 0 && (
            <div className="flex gap-2">
              {mainSelections.slice(0, 3).map((sel) => (
                <OddsButton
                  key={sel.id}
                  selection={sel}
                  label={sel.name}
                  isSelected={hasSelection(sel.id)}
                  onSelect={() => handleSelectOdds(sel, moneylineMarket)}
                  compact={compact}
                />
              ))}
            </div>
          )}
          {marketCount > 1 && (
            <div className="mt-2 md:mt-2.5 flex items-center justify-end">
              <Link
                href={`/sports/event/${event.id}`}
                className={cn(
                  'flex items-center gap-0.5 text-brand-400 hover:text-brand-300 font-medium transition-colors',
                  compact ? 'text-[10px]' : 'text-[11px]',
                )}
              >
                +{marketCount - 1} market{marketCount - 1 > 1 ? 's' : ''}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes score-pulse {
          0%,
          100% {
            transform: scale(1);
            color: #ffffff;
          }
          50% {
            transform: scale(1.3);
            color: #30e000;
          }
        }

        :global(.score-pulse) {
          animation: score-pulse 0.8s ease-out;
        }

        @keyframes odds-flash {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        :global(.odds-flash-up),
        :global(.odds-flash-down) {
          animation: odds-flash 1.5s ease-out;
        }
      `}</style>
    </div>
  );
}
