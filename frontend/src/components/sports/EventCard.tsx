'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { formatOdds, formatDate, cn } from '@/lib/utils';
import { ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { SportIcon } from '@/components/sports/SportIcon';
import type { Event, Selection, Market } from '@/types';

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

/** Sports that typically have no draw -- show ML / Spread / Total columns */
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
        width={24}
        height={24}
        className="w-6 h-6 rounded-full object-contain shrink-0 bg-white/5"
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
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
/*  OddsButton -- professional betting-site style                      */
/* ================================================================== */

type OddsFlash = 'up' | 'down' | null;

function OddsButton({
  selection,
  label,
  isSelected,
  onSelect,
}: {
  selection: Selection | null;
  label?: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [flash, setFlash] = useState<OddsFlash>(null);
  const prevOdds = useRef<string | null>(null);

  // Detect odds movement
  useEffect(() => {
    if (!selection) return;
    if (prevOdds.current !== null && prevOdds.current !== selection.odds) {
      const dir =
        parseFloat(selection.odds) > parseFloat(prevOdds.current)
          ? 'up'
          : 'down';
      setFlash(dir);
      const timer = setTimeout(() => setFlash(null), 2000);
      return () => clearTimeout(timer);
    }
    prevOdds.current = selection.odds;
  }, [selection?.odds, selection]);

  if (!selection) {
    return (
      <div className="flex-1 min-w-[64px] h-10 rounded bg-surface-tertiary/50 flex items-center justify-center">
        <span className="text-xs text-text-dim">-</span>
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
        'flex-1 min-w-[64px] h-10 rounded flex flex-col items-center justify-center gap-0',
        'font-mono text-sm font-bold transition-all duration-200 relative overflow-hidden',
        'border',
        // Selected state
        isSelected
          ? 'bg-brand-500/25 border-brand-500 text-brand-300 shadow-[inset_0_0_12px_rgba(141,82,218,0.15)]'
          : 'bg-surface-tertiary border-transparent hover:bg-surface-hover hover:border-border-hover text-white',
        // Suspended
        isSuspended && 'opacity-30 cursor-not-allowed',
        // Flash animations
        flash === 'up' && !isSelected && 'animate-flash-green',
        flash === 'down' && !isSelected && 'animate-flash-red',
      )}
    >
      {/* Label (optional, for headers like spread value) */}
      {label && (
        <span className="text-[10px] font-normal text-text-dim leading-none">
          {label}
        </span>
      )}
      {/* Odds value */}
      <span className="flex items-center gap-0.5">
        {flash === 'up' && (
          <TrendingUp className="w-3 h-3 text-accent-green" />
        )}
        {flash === 'down' && (
          <TrendingDown className="w-3 h-3 text-accent-red" />
        )}
        {formatOdds(selection.odds)}
      </span>
    </button>
  );
}

/* ================================================================== */
/*  Period Scores (for basketball, hockey, etc.)                       */
/* ================================================================== */

function PeriodScores({ metadata }: { metadata: Event['metadata'] }) {
  if (!metadata) return null;

  // Attempt to parse period scores from metadata
  const periodKeys = ['q1', 'q2', 'q3', 'q4', 'p1', 'p2', 'p3', 'ot'].filter(
    (key) => metadata[key] !== null && metadata[key] !== undefined,
  );

  if (periodKeys.length === 0) return null;

  const periodLabels: Record<string, string> = {
    q1: 'Q1',
    q2: 'Q2',
    q3: 'Q3',
    q4: 'Q4',
    p1: 'P1',
    p2: 'P2',
    p3: 'P3',
    ot: 'OT',
  };

  return (
    <div className="flex items-center gap-3 px-1 pt-1">
      {periodKeys.map((key) => (
        <span key={key} className="text-[10px] text-text-dim font-mono">
          <span className="text-text-muted">{periodLabels[key] || key}:</span>{' '}
          {String(metadata[key])}
        </span>
      ))}
    </div>
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
        <span className="text-[11px] text-text-secondary font-medium">
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
/*  EventCard -- Main component                                        */
/* ================================================================== */

export function EventCard({ event, compact: _compact }: EventCardProps) {
  const { toggleSelection, hasSelection } = useBetSlipStore();

  /* ─── Market extraction ─────────────────────────────────────── */

  const moneylineMarket = event.markets?.find(
    (m) => m.type === 'MONEYLINE',
  );
  const spreadMarket = event.markets?.find((m) => m.type === 'SPREAD');
  const totalMarket = event.markets?.find((m) => m.type === 'TOTAL');

  const mainSelections = moneylineMarket?.selections || [];
  const spreadSelections = spreadMarket?.selections || [];
  const totalSelections = totalMarket?.selections || [];

  const marketCount = event.markets ? event.markets.length : 0;
  const isThreeWay = mainSelections.length === 3;

  /* ─── Sport detection ───────────────────────────────────────── */

  const sport = event.competition?.sport;
  const sportSlug = sport?.slug || '';
  const isNoDraw = NO_DRAW_SPORTS.has(sportSlug) || (!isThreeWay && mainSelections.length === 2);

  /* ─── Selection mapping ─────────────────────────────────────── */

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

  // Spread selections (home / away)
  const homeSpread = spreadSelections.find(
    (s) => s.outcome === 'home',
  ) || spreadSelections[0] || null;
  const awaySpread = spreadSelections.find(
    (s) => s.outcome === 'away',
  ) || spreadSelections[1] || null;

  // Total selections (over / under)
  const overSel = totalSelections.find(
    (s) => s.outcome === 'over' || s.name.toLowerCase().includes('over'),
  ) || totalSelections[0] || null;
  const underSel = totalSelections.find(
    (s) => s.outcome === 'under' || s.name.toLowerCase().includes('under'),
  ) || totalSelections[1] || null;

  /* ─── Bet slip handler ──────────────────────────────────────── */

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

  /* ─── Column headers ────────────────────────────────────────── */

  const colHeaders = isNoDraw
    ? ['ML', 'Spread', 'Total']
    : ['1', 'X', '2'];

  /* ─── Extract spread / total labels ─────────────────────────── */

  const spreadLabel = homeSpread?.name?.match(/[+-][\d.]+/)?.[0] || '';
  const totalLabel = overSel?.name?.match(/[\d.]+/)?.[0] || '';

  /* ─── Render ────────────────────────────────────────────────── */

  return (
    <Link
      href={`/sports/event/${event.id}`}
      className={cn(
        'block rounded-lg overflow-hidden transition-all duration-200 group',
        'bg-surface-secondary',
        'border border-border-dim',
        'hover:border-border-hover hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
      )}
    >
      {/* ═══════════ HEADER ═══════════ */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-secondary">
        {/* Left: sport icon + competition name + live badge */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {sport?.slug && (
            <SportIcon
              slug={sport.slug}
              size={14}
              emoji={sport.icon}
            />
          )}
          <span className="text-xs text-text-dim truncate font-medium">
            {event.competition?.name}
          </span>
        </div>

        {/* Center/Right: Live badge or date */}
        <div className="flex items-center gap-2 shrink-0">
          {event.isLive ? (
            <LiveBadge
              matchTime={event.metadata?.matchTime as string | undefined}
              period={event.metadata?.period as string | undefined}
            />
          ) : (
            <span className="text-[11px] text-text-dim font-medium">
              {formatDate(event.startTime)}
            </span>
          )}
        </div>

        {/* Right: market count + arrow */}
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          {marketCount > 1 && (
            <span className="text-[10px] text-text-muted bg-surface-tertiary rounded px-1.5 py-0.5 font-medium whitespace-nowrap">
              +{marketCount - 1}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-text-dim opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* ═══════════ DIVIDER ═══════════ */}
      <div className="border-t border-border-dim" />

      {/* ═══════════ BODY: Teams + Odds Grid ═══════════ */}
      {event.homeTeam && event.awayTeam ? (
        <div className="px-3 py-2">
          {/* ─── Column Headers ─────────────────────────── */}
          <div className="flex items-center mb-1.5">
            {/* Team name spacer */}
            <div className="flex-1" />
            {/* Score spacer (only when live) */}
            {event.isLive && <div className="w-8" />}
            {/* Odds column headers */}
            <div className="flex gap-1.5">
              {colHeaders.map((header) => (
                <div
                  key={header}
                  className="flex-1 min-w-[64px] text-center"
                >
                  <span className="text-[10px] text-text-dim font-medium uppercase tracking-wider">
                    {header}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Home Team Row ──────────────────────────── */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <TeamLogo
                name={event.homeTeam}
                logo={event.homeTeamLogo}
                isHome
              />
              <span className="text-sm font-medium text-white truncate">
                {event.homeTeam}
              </span>
            </div>
            {/* Live score */}
            {event.isLive && (
              <span className="text-sm font-bold font-mono text-white w-8 text-center tabular-nums">
                {event.homeScore ?? 0}
              </span>
            )}
            {/* Odds buttons */}
            <div className="flex gap-1.5">
              {isNoDraw ? (
                <>
                  {/* ML */}
                  <OddsButton
                    selection={homeSel}
                    isSelected={homeSel ? hasSelection(homeSel.id) : false}
                    onSelect={() =>
                      homeSel && handleSelectOdds(homeSel, moneylineMarket)
                    }
                  />
                  {/* Spread */}
                  <OddsButton
                    selection={homeSpread}
                    label={spreadLabel || undefined}
                    isSelected={
                      homeSpread ? hasSelection(homeSpread.id) : false
                    }
                    onSelect={() =>
                      homeSpread &&
                      handleSelectOdds(homeSpread, spreadMarket)
                    }
                  />
                  {/* Total Over */}
                  <OddsButton
                    selection={overSel}
                    label={totalLabel ? `O ${totalLabel}` : undefined}
                    isSelected={overSel ? hasSelection(overSel.id) : false}
                    onSelect={() =>
                      overSel && handleSelectOdds(overSel, totalMarket)
                    }
                  />
                </>
              ) : (
                <>
                  {/* 1 (Home) */}
                  <OddsButton
                    selection={homeSel}
                    isSelected={homeSel ? hasSelection(homeSel.id) : false}
                    onSelect={() =>
                      homeSel && handleSelectOdds(homeSel, moneylineMarket)
                    }
                  />
                  {/* X (Draw) */}
                  <OddsButton
                    selection={drawSel}
                    isSelected={drawSel ? hasSelection(drawSel.id) : false}
                    onSelect={() =>
                      drawSel && handleSelectOdds(drawSel, moneylineMarket)
                    }
                  />
                  {/* 2 (Away) */}
                  <OddsButton
                    selection={awaySel}
                    isSelected={awaySel ? hasSelection(awaySel.id) : false}
                    onSelect={() =>
                      awaySel && handleSelectOdds(awaySel, moneylineMarket)
                    }
                  />
                </>
              )}
            </div>
          </div>

          {/* ─── Away Team Row ──────────────────────────── */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <TeamLogo
                name={event.awayTeam}
                logo={event.awayTeamLogo}
                isHome={false}
              />
              <span className="text-sm font-medium text-text-secondary truncate">
                {event.awayTeam}
              </span>
            </div>
            {/* Live score */}
            {event.isLive && (
              <span className="text-sm font-bold font-mono text-text-secondary w-8 text-center tabular-nums">
                {event.awayScore ?? 0}
              </span>
            )}
            {/* Odds buttons */}
            <div className="flex gap-1.5">
              {isNoDraw ? (
                <>
                  {/* ML */}
                  <OddsButton
                    selection={awaySel}
                    isSelected={awaySel ? hasSelection(awaySel.id) : false}
                    onSelect={() =>
                      awaySel && handleSelectOdds(awaySel, moneylineMarket)
                    }
                  />
                  {/* Spread */}
                  <OddsButton
                    selection={awaySpread}
                    label={
                      awaySpread?.name?.match(/[+-][\d.]+/)?.[0] || undefined
                    }
                    isSelected={
                      awaySpread ? hasSelection(awaySpread.id) : false
                    }
                    onSelect={() =>
                      awaySpread &&
                      handleSelectOdds(awaySpread, spreadMarket)
                    }
                  />
                  {/* Total Under */}
                  <OddsButton
                    selection={underSel}
                    label={totalLabel ? `U ${totalLabel}` : undefined}
                    isSelected={
                      underSel ? hasSelection(underSel.id) : false
                    }
                    onSelect={() =>
                      underSel && handleSelectOdds(underSel, totalMarket)
                    }
                  />
                </>
              ) : (
                <>
                  {/* Spacer cells -- away row has no odds in 3-way (handled above) */}
                  <div className="flex-1 min-w-[64px]" />
                  <div className="flex-1 min-w-[64px]" />
                  <div className="flex-1 min-w-[64px]" />
                </>
              )}
            </div>
          </div>

          {/* ─── Period scores (basketball etc.) ────────── */}
          {event.isLive && event.metadata && (
            <PeriodScores metadata={event.metadata} />
          )}
        </div>
      ) : (
        /* ─── Fallback: no teams (outright, etc.) ──────── */
        <div className="px-3 py-3">
          <p className="text-sm font-medium text-white">{event.name}</p>
          {mainSelections.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {mainSelections.slice(0, 3).map((sel) => (
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
        </div>
      )}
    </Link>
  );
}
