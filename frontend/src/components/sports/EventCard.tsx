'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { formatOdds, cn } from '@/lib/utils';
import { Lock } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
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

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const timeStr = format(date, 'HH:mm');

  if (isToday(date)) {
    return `Today ${timeStr}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow ${timeStr}`;
  }
  return format(date, 'dd MMM HH:mm');
}

/* ================================================================== */
/*  OddsButton -- Cloudbet signature style                            */
/* ================================================================== */

type OddsFlash = 'up' | 'down' | null;

function OddsButton({
  selection,
  label,
  isSelected,
  onSelect,
  compact,
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

  const buttonHeight = compact ? 'h-[36px]' : 'h-[40px]';
  const labelSize = compact ? 'text-[10px]' : 'text-[11px]';
  const oddsSize = compact ? 'text-[13px]' : 'text-[14px]';
  const paddingX = compact ? 'px-2.5' : 'px-3';

  if (!selection) {
    return (
      <div
        className={cn(
          'flex-1 rounded flex items-center justify-between',
          buttonHeight,
          paddingX,
          'bg-white/[0.03] border border-white/[0.06]',
        )}
        style={{ borderRadius: '4px' }}
      >
        <span className={cn(labelSize, 'text-[rgba(224,232,255,0.3)] uppercase font-medium')}>
          {label}
        </span>
        <span className={cn(oddsSize, 'text-[rgba(224,232,255,0.3)] font-bold font-mono')}>
          -
        </span>
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
        'flex-1 rounded flex items-center justify-between',
        buttonHeight,
        paddingX,
        'border transition-all duration-200',
        'relative overflow-hidden',
        // Selected state - purple
        isSelected && [
          'bg-[rgba(141,82,218,0.15)] border-[#8D52DA]',
          'text-white',
        ],
        // Flash up state - green
        !isSelected &&
          flash === 'up' && [
            'bg-[rgba(48,224,0,0.1)] border-white/[0.06]',
            'odds-flash',
          ],
        // Flash down state - red
        !isSelected &&
          flash === 'down' && [
            'bg-[rgba(255,73,74,0.1)] border-white/[0.06]',
            'odds-flash',
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
      style={{ borderRadius: '4px' }}
    >
      {/* Label left */}
      <span
        className={cn(
          labelSize,
          'uppercase font-medium',
          isSelected ? 'text-white' : 'text-[rgba(224,232,255,0.3)]',
        )}
      >
        {label}
      </span>

      {/* Odds right */}
      <span
        className={cn(
          oddsSize,
          'font-bold font-mono tabular-nums',
          isSelected
            ? 'text-white'
            : flash === 'up'
              ? 'text-[#30E000]'
              : flash === 'down'
                ? 'text-[#FF494A]'
                : 'text-white',
        )}
      >
        {formatOdds(selection.odds)}
      </span>

      {/* Lock icon for suspended */}
      {isSuspended && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock className="w-4 h-4 text-white/30" />
        </div>
      )}
    </button>
  );
}

/* ================================================================== */
/*  LiveScore -- score display with pulse animation                   */
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
      const timer = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = score;
  }, [score, prevScoreRef]);

  return (
    <span
      className={cn(
        'text-[16px] font-bold font-mono text-white tabular-nums',
        pulse && 'score-pulse',
      )}
    >
      {score}
    </span>
  );
}

/* ================================================================== */
/*  EventCard -- Cloudbet signature design                            */
/* ================================================================== */

export function EventCard({
  event,
  compact = false,
  featured: _featured = false,
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

  /* ---- Sizing based on variant ------------------------------------ */

  const cardPadding = compact ? 'p-2' : 'p-3';
  const headerGap = compact ? 'mb-1.5' : 'mb-2';
  const teamFontSize = compact ? 'text-[13px]' : 'text-[14px]';
  const teamGap = compact ? 'mb-1' : 'mb-1.5';
  const oddsGap = compact ? 'gap-1' : 'gap-1.5';

  /* ---- Render ------------------------------------------------------ */

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden transition-all duration-200',
        'bg-[#1A1B1F]',
        'border border-[rgba(255,255,255,0.06)]',
        'hover:border-[rgba(255,255,255,0.10)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)]',
        cardPadding,
        // Live card: green left border (2px)
        event.isLive && 'border-l-2 border-l-[#30E000]',
      )}
      style={{ borderRadius: '8px' }}
    >
      {/* ========== HEADER: Competition + Time/Date ==================== */}
      <div className={cn('flex items-center justify-between', headerGap)}>
        {/* Competition name */}
        <span
          className="text-[11px] text-[rgba(224,232,255,0.3)] truncate flex-1 min-w-0"
          title={event.competition?.name}
        >
          {event.competition?.name}
        </span>

        {/* Time/Date or Live badge */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {event.isLive ? (
            <>
              {/* Live badge - red background */}
              <div
                className="px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(255,73,74,0.15)',
                }}
              >
                <span className="text-[9px] text-[#FF494A] uppercase font-bold tracking-wide">
                  LIVE
                </span>
              </div>
              {/* Match time in green */}
              {event.metadata?.matchTime && (
                <span className="text-[11px] text-[#30E000] font-medium tabular-nums">
                  {event.metadata.matchTime}
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] text-[rgba(224,232,255,0.3)]">
              {formatEventDate(event.startTime)}
            </span>
          )}
        </div>
      </div>

      {/* ========== TEAMS SECTION ====================================== */}
      {event.homeTeam && event.awayTeam ? (
        <>
          {/* Home team row */}
          <div className={cn('flex items-center justify-between', teamGap)}>
            <span className={cn(teamFontSize, 'text-white font-medium truncate flex-1 min-w-0 pr-2')}>
              {event.homeTeam}
            </span>
            {event.isLive && event.homeScore !== undefined && (
              <LiveScore
                score={event.homeScore ?? 0}
                prevScoreRef={prevHomeScore}
              />
            )}
          </div>

          {/* Away team row - 2px gap between rows */}
          <div className={cn('flex items-center justify-between', compact ? 'mb-2' : 'mb-3')}>
            <span className={cn(teamFontSize, 'text-white font-medium truncate flex-1 min-w-0 pr-2')}>
              {event.awayTeam}
            </span>
            {event.isLive && event.awayScore !== undefined && (
              <LiveScore
                score={event.awayScore ?? 0}
                prevScoreRef={prevAwayScore}
              />
            )}
          </div>

          {/* ========== ODDS ROW ======================================== */}
          <div className={cn('flex', oddsGap)}>
            {isNoDraw ? (
              <>
                {/* Two-way: Home + Away */}
                <OddsButton
                  selection={homeSel}
                  label={homeLabel}
                  isSelected={homeSel ? hasSelection(homeSel.id) : false}
                  onSelect={() =>
                    homeSel && handleSelectOdds(homeSel, moneylineMarket)
                  }
                  compact={compact}
                />
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
                {/* Three-way: Home + Draw + Away */}
                <OddsButton
                  selection={homeSel}
                  label={homeLabel}
                  isSelected={homeSel ? hasSelection(homeSel.id) : false}
                  onSelect={() =>
                    homeSel && handleSelectOdds(homeSel, moneylineMarket)
                  }
                  compact={compact}
                />
                <OddsButton
                  selection={drawSel}
                  label={drawLabel}
                  isSelected={drawSel ? hasSelection(drawSel.id) : false}
                  onSelect={() =>
                    drawSel && handleSelectOdds(drawSel, moneylineMarket)
                  }
                  compact={compact}
                />
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
            <div className={cn('flex items-center justify-center', compact ? 'mt-1.5' : 'mt-2')}>
              <Link
                href={`/sports/event/${event.id}`}
                className="text-[11px] text-[rgba(224,232,255,0.5)] hover:text-[rgba(224,232,255,0.8)] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                +{marketCount - 1} market{marketCount - 1 > 1 ? 's' : ''}
              </Link>
            </div>
          )}
        </>
      ) : (
        /* ---- Fallback: no teams (outrights, specials) --------------- */
        <>
          <div className={compact ? 'mb-2' : 'mb-3'}>
            <p className={cn(teamFontSize, 'text-white font-medium line-clamp-2')}>
              {event.name}
            </p>
          </div>

          {mainSelections.length > 0 && (
            <div className={cn('flex', oddsGap)}>
              {mainSelections.slice(0, 3).map((sel) => (
                <OddsButton
                  key={sel.id}
                  selection={sel}
                  label={sel.name.slice(0, 3).toUpperCase()}
                  isSelected={hasSelection(sel.id)}
                  onSelect={() => handleSelectOdds(sel, moneylineMarket)}
                  compact={compact}
                />
              ))}
            </div>
          )}

          {marketCount > 1 && (
            <div className={cn('flex items-center justify-center', compact ? 'mt-1.5' : 'mt-2')}>
              <Link
                href={`/sports/event/${event.id}`}
                className="text-[11px] text-[rgba(224,232,255,0.5)] hover:text-[rgba(224,232,255,0.8)] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                +{marketCount - 1} market{marketCount - 1 > 1 ? 's' : ''}
              </Link>
            </div>
          )}
        </>
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
            transform: scale(1.2);
            color: #30e000;
          }
        }

        :global(.score-pulse) {
          animation: score-pulse 0.6s ease-out;
        }

        @keyframes odds-flash {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        :global(.odds-flash) {
          animation: odds-flash 1.5s ease-out;
        }
      `}</style>
    </div>
  );
}
