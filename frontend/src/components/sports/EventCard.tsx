'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { formatOdds, cn } from '@/lib/utils';
import { Star, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
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
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return `Today, ${format(date, 'HH:mm')}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow, ${format(date, 'HH:mm')}`;
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
}: {
  name: string;
  logo?: string | null;
  isHome?: boolean;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [imgError, setImgError] = useState(false);

  if (logo && !imgError) {
    return (
      <img
        src={logo}
        alt={name}
        width={28}
        height={28}
        className="w-7 h-7 rounded-full object-contain shrink-0 bg-white/5"
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
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
/*  OddsButton -- Cloudbet-style with framer-motion flash              */
/* ================================================================== */

type OddsFlash = 'up' | 'down' | null;

function OddsButton({
  selection,
  label,
  isSelected,
  onSelect,
}: {
  selection: Selection | null;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
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
          'flex-1 min-w-[72px] py-2 px-3 rounded-md flex flex-col items-center justify-center gap-0.5',
          'bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)]',
        )}
      >
        <span className="text-[10px] font-medium text-text-dim leading-none uppercase">
          {label}
        </span>
        <span className="text-xs text-text-dim font-mono">-</span>
      </div>
    );
  }

  const isSuspended = selection.status === 'SUSPENDED';

  // Determine flash background color for framer-motion
  const flashBg =
    flash === 'up'
      ? 'rgba(48, 224, 0, 0.20)'
      : flash === 'down'
        ? 'rgba(255, 73, 74, 0.20)'
        : 'transparent';

  return (
    <motion.button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSuspended) onSelect();
      }}
      disabled={isSuspended}
      animate={{
        backgroundColor: flashBg,
      }}
      transition={{ duration: flash ? 0.15 : 1.2, ease: 'easeOut' }}
      className={cn(
        'flex-1 min-w-[72px] py-2 px-3 rounded-md flex flex-col items-center justify-center gap-0.5',
        'font-mono transition-colors duration-200 relative overflow-hidden cursor-pointer',
        'border',
        // Default state
        !isSelected &&
          !flash &&
          'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.12)]',
        // Selected state -- purple
        isSelected &&
          'bg-[rgba(141,82,218,0.15)] border-[#8D52DA]',
        // Flash override borders
        flash === 'up' && !isSelected && 'border-accent-green/40',
        flash === 'down' && !isSelected && 'border-accent-red/40',
        // Suspended
        isSuspended && 'opacity-30 cursor-not-allowed',
      )}
    >
      {/* Outcome label */}
      <span
        className={cn(
          'text-[10px] font-medium leading-none uppercase tracking-wide',
          isSelected ? 'text-brand-300' : 'text-text-dim',
        )}
      >
        {label}
      </span>
      {/* Odds value */}
      <span
        className={cn(
          'text-sm font-bold leading-tight',
          isSelected
            ? 'text-brand-200'
            : flash === 'up'
              ? 'text-accent-green'
              : flash === 'down'
                ? 'text-accent-red'
                : 'text-white',
        )}
      >
        {formatOdds(selection.odds)}
      </span>
    </motion.button>
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
/*  LiveScore -- score display with pulse animation on change          */
/* ================================================================== */

function LiveScore({ score, prevScoreRef }: { score: number; prevScoreRef: React.MutableRefObject<number | null> }) {
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
    <motion.span
      animate={
        pulse
          ? {
              scale: [1, 1.3, 1],
              color: ['#FFFFFF', '#30E000', '#FFFFFF'],
            }
          : {}
      }
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="text-lg font-bold font-mono text-white tabular-nums leading-none"
    >
      {score}
    </motion.span>
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
      className="p-1 rounded transition-colors hover:bg-white/5"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className={cn(
          'w-4 h-4 transition-colors',
          isFavorite
            ? 'fill-accent-yellow text-accent-yellow'
            : 'text-text-dim hover:text-text-muted',
        )}
      />
    </button>
  );
}

/* ================================================================== */
/*  EventCard -- Main component (Cloudbet-style)                       */
/* ================================================================== */

export function EventCard({ event, compact: _compact }: EventCardProps) {
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

  // For two-way sports we show "1" / "2"; for three-way we show "1" / "X" / "2"
  const homeLabel = '1';
  const drawLabel = 'X';
  const awayLabel = '2';

  /* ---- Render ------------------------------------------------------ */

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-200 group',
        'bg-[#1A1B1F]',
        'border border-[rgba(255,255,255,0.08)]',
        'hover:border-[rgba(255,255,255,0.12)]',
      )}
      style={{ padding: '12px 16px' }}
    >
      {/* ========== HEADER: Competition + Date/Live + Favorite ========== */}
      <div className="flex items-center justify-between mb-2.5">
        {/* Left: sport icon + competition */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {sport?.slug && (
            <SportIcon
              slug={sport.slug}
              size={12}
              emoji={sport.icon}
            />
          )}
          <span className="text-[11px] text-text-dim truncate font-medium leading-none">
            {event.competition?.name}
          </span>
        </div>

        {/* Right: live badge or date + favorite */}
        <div className="flex items-center gap-2 shrink-0">
          {event.isLive ? (
            <LiveBadge
              matchTime={event.metadata?.matchTime as string | undefined}
              period={event.metadata?.period as string | undefined}
            />
          ) : (
            <div className="flex items-center gap-1 text-text-dim">
              <Clock className="w-3 h-3" />
              <span className="text-[11px] font-medium leading-none">
                {formatEventDate(event.startTime)}
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
          <div className="flex items-center justify-between mb-3">
            {/* Home team */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <TeamLogo
                name={event.homeTeam}
                logo={event.homeTeamLogo}
                isHome
              />
              <span className="text-sm font-medium text-white truncate">
                {event.homeTeam}
              </span>
            </div>

            {/* Score or VS */}
            {event.isLive ? (
              <div className="flex items-center gap-1.5 px-3 shrink-0">
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
              <span className="text-xs text-text-dim font-medium px-3 shrink-0">
                vs
              </span>
            )}

            {/* Away team */}
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              <span className="text-sm font-medium text-white truncate text-right">
                {event.awayTeam}
              </span>
              <TeamLogo
                name={event.awayTeam}
                logo={event.awayTeamLogo}
                isHome={false}
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
                />
                {/* Away */}
                <OddsButton
                  selection={awaySel}
                  label={awayLabel}
                  isSelected={awaySel ? hasSelection(awaySel.id) : false}
                  onSelect={() =>
                    awaySel && handleSelectOdds(awaySel, moneylineMarket)
                  }
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
                />
                {/* Draw */}
                <OddsButton
                  selection={drawSel}
                  label={drawLabel}
                  isSelected={drawSel ? hasSelection(drawSel.id) : false}
                  onSelect={() =>
                    drawSel && handleSelectOdds(drawSel, moneylineMarket)
                  }
                />
                {/* Away */}
                <OddsButton
                  selection={awaySel}
                  label={awayLabel}
                  isSelected={awaySel ? hasSelection(awaySel.id) : false}
                  onSelect={() =>
                    awaySel && handleSelectOdds(awaySel, moneylineMarket)
                  }
                />
              </>
            )}
          </div>

          {/* ========== FOOTER: +N markets link ======================== */}
          {marketCount > 1 && (
            <div className="mt-2.5 flex items-center justify-end">
              <Link
                href={`/sports/event/${event.id}`}
                className="flex items-center gap-0.5 text-[11px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
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
          <p className="text-sm font-medium text-white mb-2">{event.name}</p>
          {mainSelections.length > 0 && (
            <div className="flex gap-2">
              {mainSelections.slice(0, 3).map((sel, _idx) => (
                <OddsButton
                  key={sel.id}
                  selection={sel}
                  label={sel.name}
                  isSelected={hasSelection(sel.id)}
                  onSelect={() => handleSelectOdds(sel, moneylineMarket)}
                />
              ))}
            </div>
          )}
          {marketCount > 1 && (
            <div className="mt-2.5 flex items-center justify-end">
              <Link
                href={`/sports/event/${event.id}`}
                className="flex items-center gap-0.5 text-[11px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
              >
                +{marketCount - 1} market{marketCount - 1 > 1 ? 's' : ''}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
