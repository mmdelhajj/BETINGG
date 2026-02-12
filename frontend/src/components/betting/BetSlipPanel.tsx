'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { useAuthStore } from '@/stores/authStore';
import { bettingApi } from '@/lib/api';
import { formatOdds } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  X,
  Trash2,
  ChevronUp,
  Receipt,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Check,
  Info,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────
const QUICK_STAKES = [10, 25, 50, 100];
const TAB_LABELS: Record<string, string> = {
  single: 'Single',
  parlay: 'Multi',
  system: 'System',
};

// ─── Sub-components ─────────────────────────────────────────────────

/** Odds change direction badge */
function OddsChangeBadge({ direction }: { direction: 'up' | 'down' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded',
        direction === 'up'
          ? 'bg-accent-green/15 text-accent-green'
          : 'bg-accent-red/15 text-accent-red'
      )}
    >
      {direction === 'up' ? (
        <ArrowUp className="w-2.5 h-2.5" />
      ) : (
        <ArrowDown className="w-2.5 h-2.5" />
      )}
    </span>
  );
}

/** Individual selection card */
function SelectionCard({
  item,
  betType,
  stake,
  oddsChange,
  onRemove,
  onStakeChange,
  onQuickStake,
}: {
  item: { selectionId: string; selectionName: string; marketName: string; eventName: string; odds: string };
  betType: string;
  stake: string;
  oddsChange?: { direction: 'up' | 'down'; previousOdds: string; currentOdds: string } | null;
  onRemove: () => void;
  onStakeChange: (value: string) => void;
  onQuickStake: (amount: number) => void;
}) {
  const potentialWin = useMemo(() => {
    if (!stake || betType !== 'single') return null;
    const s = parseFloat(stake);
    const o = parseFloat(item.odds);
    if (isNaN(s) || isNaN(o) || s <= 0) return null;
    return (s * o).toFixed(2);
  }, [stake, item.odds, betType]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-surface-tertiary rounded-lg overflow-hidden"
    >
      <div className="p-2.5">
        {/* Header row: event name + remove */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] text-gray-500 leading-tight truncate flex-1">
            {item.eventName}
          </p>
          <button
            onClick={onRemove}
            className="text-gray-600 hover:text-accent-red p-0.5 -mt-0.5 -mr-0.5 rounded transition-colors shrink-0"
            aria-label="Remove selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Selection + odds row */}
        <div className="flex items-center justify-between mt-0.5 gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-snug">
              {item.selectionName}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{item.marketName}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {oddsChange && <OddsChangeBadge direction={oddsChange.direction} />}
            <span
              className={cn(
                'font-mono text-sm font-bold px-2 py-0.5 rounded',
                oddsChange
                  ? oddsChange.direction === 'up'
                    ? 'bg-accent-green/10 text-accent-green'
                    : 'bg-accent-red/10 text-accent-red'
                  : 'text-brand-400'
              )}
            >
              {formatOdds(item.odds)}
            </span>
          </div>
        </div>

        {/* Stake input (single mode only) */}
        {betType === 'single' && (
          <div className="mt-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-mono">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={stake}
                onChange={(e) => onStakeChange(e.target.value)}
                placeholder="0.00"
                className="input text-sm py-1.5 pl-6 pr-2 font-mono tabular-nums"
              />
            </div>
            {/* Quick stakes row for single */}
            <div className="flex gap-1 mt-1.5">
              {QUICK_STAKES.map((amount) => (
                <button
                  key={amount}
                  onClick={() => onQuickStake(amount)}
                  className="flex-1 py-1 text-[10px] font-medium bg-surface-hover/50 hover:bg-surface-hover rounded transition-colors text-gray-400 hover:text-gray-200"
                >
                  +${amount}
                </button>
              ))}
            </div>
            {/* Potential win for this selection */}
            {potentialWin && (
              <div className="flex justify-between items-center mt-1.5 text-[11px]">
                <span className="text-gray-500">Potential Win</span>
                <span className="font-mono font-semibold text-accent-green">
                  ${potentialWin}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function BetSlipPanel() {
  const {
    items,
    betType,
    systemType,
    stakes,
    parlayStake,
    systemStake,
    isOpen,
    isSubmitting,
    oddsChanges,
    oddsChangeMode,
    removeSelection,
    clearSlip,
    setBetType,
    setSystemType,
    setStake,
    setParlayStake,
    setSystemStake,
    setIsOpen,
    setIsSubmitting,
    setOddsChangeMode,
    acceptOddsChanges,
    rejectOddsChanges,
    getCombinedOdds,
    getPotentialWin,
    getTotalStake,
    getSystemBetTypes,
    getSystemBetCount,
  } = useBetSlipStore();

  const { isAuthenticated } = useAuthStore();
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [placeBetError, setPlaceBetError] = useState<string | null>(null);
  const [placeBetSuccess, setPlaceBetSuccess] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Detect duplicate events for parlay warning
  const duplicateEventIds = useMemo(() => {
    const eventCounts: Record<string, number> = {};
    for (const item of items) {
      eventCounts[item.eventId] = (eventCounts[item.eventId] || 0) + 1;
    }
    return new Set(
      Object.entries(eventCounts)
        .filter(([, count]) => count > 1)
        .map(([eventId]) => eventId)
    );
  }, [items]);

  const hasDuplicateEvents = duplicateEventIds.size > 0;

  // Available tabs
  const availableTabs = useMemo(() => {
    const tabs: Array<'single' | 'parlay' | 'system'> = ['single'];
    if (items.length >= 2) tabs.push('parlay');
    if (items.length >= 3) tabs.push('system');
    return tabs;
  }, [items.length]);

  // Available system bet types
  const itemCount = items.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const systemBetTypes = useMemo(() => getSystemBetTypes(), [itemCount]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const systemBetCount = useMemo(() => getSystemBetCount(), [systemType]);

  // Lock body scroll on mobile when sheet is open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Clear success message after a few seconds
  useEffect(() => {
    if (placeBetSuccess) {
      const timer = setTimeout(() => setPlaceBetSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [placeBetSuccess]);

  // Reset bet type if current tab no longer available
  useEffect(() => {
    if (!availableTabs.includes(betType as 'single' | 'parlay' | 'system')) {
      setBetType('single');
    }
  }, [availableTabs, betType, setBetType]);

  const handlePlaceBet = async () => {
    if (!isAuthenticated || items.length === 0) return;
    setPlaceBetError(null);
    setIsSubmitting(true);
    try {
      const betData: Record<string, unknown> = {
        currency: 'USDT',
        selections: items.map((item) => ({
          selectionId: item.selectionId,
          odds: item.odds,
        })),
      };

      if (betType === 'single') {
        betData.type = 'SINGLE';
        betData.stakes = items.map((item) => ({
          selectionId: item.selectionId,
          stake: stakes[item.selectionId] || '0',
        }));
      } else if (betType === 'parlay') {
        betData.type = 'PARLAY';
        betData.stake = parlayStake;
      } else if (betType === 'system') {
        betData.type = 'SYSTEM';
        betData.systemType = systemType;
        betData.stake = systemStake;
      }

      await bettingApi.placeBet(betData);
      setPlaceBetSuccess(true);
      clearSlip();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to place bet. Please try again.';
      setPlaceBetError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStakeForItem = (selectionId: string, amount: number) => {
    const current = parseFloat(stakes[selectionId] || '0') || 0;
    setStake(selectionId, (current + amount).toString());
  };

  const handleQuickStakeParlay = (amount: number) => {
    const current = parseFloat(parlayStake || '0') || 0;
    setParlayStake((current + amount).toString());
  };

  const handleQuickStakeSystem = (amount: number) => {
    const current = parseFloat(systemStake || '0') || 0;
    setSystemStake((current + amount).toString());
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100) {
      setIsOpen(false);
      setSheetExpanded(true);
    } else if (info.offset.y > 50) {
      setSheetExpanded(false);
    } else if (info.offset.y < -50) {
      setSheetExpanded(true);
    }
  };

  const totalStake = getTotalStake();
  const potentialWin = getPotentialWin();
  const combinedOdds = getCombinedOdds();
  const canPlaceBet =
    isAuthenticated &&
    !isSubmitting &&
    parseFloat(totalStake) > 0 &&
    !(betType === 'parlay' && hasDuplicateEvents) &&
    oddsChanges.length === 0;

  // Get the odds change for a specific selection
  const getOddsChange = (selectionId: string) =>
    oddsChanges.find((c) => c.selectionId === selectionId) || null;

  // ─── Panel Content ──────────────────────────────────────────────────
  const panelContent = (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-white">Bet Slip</h3>
          {items.length > 0 && (
            <span className="bg-brand-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={clearSlip}
              className="text-[11px] text-gray-500 hover:text-accent-red flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
              <Receipt className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-sm text-gray-400 font-medium mb-1">
              Your bet slip is empty
            </p>
            <p className="text-xs text-gray-600">
              Click on odds to add selections.
            </p>
            {placeBetSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 text-accent-green text-sm justify-center"
              >
                <Check className="w-4 h-4" />
                <span>Bet placed successfully!</span>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Tab Bar ──────────────────────────────────────────────────── */}
          <div className="flex border-b border-border bg-surface-secondary/50">
            {availableTabs.map((type) => (
              <button
                key={type}
                onClick={() => setBetType(type)}
                className={cn(
                  'flex-1 py-2.5 text-xs font-semibold transition-all relative',
                  betType === type
                    ? 'text-brand-400'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {TAB_LABELS[type]}
                {type === 'parlay' && hasDuplicateEvents && (
                  <span className="absolute top-1 right-1/4 w-1.5 h-1.5 bg-accent-red rounded-full" />
                )}
                {betType === type && (
                  <motion.div
                    layoutId="betslip-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-400"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* ── Odds Changes Banner ──────────────────────────────────────── */}
          <AnimatePresence>
            {oddsChanges.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 py-2 bg-accent-yellow/10 border-b border-accent-yellow/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-accent-yellow shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[11px] text-accent-yellow font-medium">
                        Odds have changed for {oddsChanges.length} selection
                        {oddsChanges.length > 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={acceptOddsChanges}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors"
                        >
                          Accept Changes
                        </button>
                        <button
                          onClick={rejectOddsChanges}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded bg-accent-red/20 text-accent-red hover:bg-accent-red/30 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Parlay Same-Event Warning ─────────────────────────────────── */}
          <AnimatePresence>
            {betType === 'parlay' && hasDuplicateEvents && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 py-2 bg-accent-red/10 border-b border-accent-red/20 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-accent-red shrink-0 mt-0.5" />
                  <p className="text-[11px] text-accent-red">
                    You have 2+ selections from the same event. Remove duplicates to place a multi bet.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Selections List ───────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <SelectionCard
                  key={item.selectionId}
                  item={item}
                  betType={betType}
                  stake={stakes[item.selectionId] || ''}
                  oddsChange={getOddsChange(item.selectionId)}
                  onRemove={() => removeSelection(item.selectionId)}
                  onStakeChange={(val) => setStake(item.selectionId, val)}
                  onQuickStake={(amount) => handleQuickStakeForItem(item.selectionId, amount)}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* ── Parlay Stake Section ─────────────────────────────────────── */}
          {betType === 'parlay' && (
            <div className="px-3 pb-2 border-t border-border pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                  Combined Odds
                </span>
                <span className="text-sm text-brand-400 font-mono font-bold">
                  {combinedOdds}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-mono">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={parlayStake}
                  onChange={(e) => setParlayStake(e.target.value)}
                  placeholder="0.00"
                  className="input text-sm py-1.5 pl-6 pr-2 font-mono tabular-nums"
                />
              </div>
              {/* Quick stakes */}
              <div className="flex gap-1 mt-1.5">
                {QUICK_STAKES.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickStakeParlay(amount)}
                    className="flex-1 py-1 text-[10px] font-medium bg-surface-hover/50 hover:bg-surface-hover rounded transition-colors text-gray-400 hover:text-gray-200"
                  >
                    +${amount}
                  </button>
                ))}
              </div>
              {/* Parlay potential win */}
              {parlayStake && parseFloat(parlayStake) > 0 && (
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className="text-gray-500">Potential Win</span>
                  <span className="font-mono font-semibold text-accent-green">
                    ${potentialWin}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── System Bet Section ───────────────────────────────────────── */}
          {betType === 'system' && (
            <div className="px-3 pb-2 border-t border-border pt-2">
              {systemBetTypes.length > 0 ? (
                <>
                  <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide block mb-1.5">
                    System Type
                  </label>
                  <div className="space-y-1 mb-2">
                    {systemBetTypes.map((sbt) => (
                      <button
                        key={sbt.key}
                        onClick={() => setSystemType(sbt.key)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left transition-colors',
                          systemType === sbt.key
                            ? 'bg-brand-500/15 border border-brand-500/40'
                            : 'bg-surface-tertiary hover:bg-surface-hover border border-transparent'
                        )}
                      >
                        <div>
                          <span className="text-xs font-semibold text-white">
                            {sbt.name}
                          </span>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {sbt.description}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-2">
                          {sbt.bets} bets
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* System stake input (per bet) */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-gray-500 font-medium">
                      Stake per bet
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {systemBetCount} bets total
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-mono">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={systemStake}
                      onChange={(e) => setSystemStake(e.target.value)}
                      placeholder="0.00"
                      className="input text-sm py-1.5 pl-6 pr-2 font-mono tabular-nums"
                    />
                  </div>
                  {/* Quick stakes */}
                  <div className="flex gap-1 mt-1.5">
                    {QUICK_STAKES.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleQuickStakeSystem(amount)}
                        className="flex-1 py-1 text-[10px] font-medium bg-surface-hover/50 hover:bg-surface-hover rounded transition-colors text-gray-400 hover:text-gray-200"
                      >
                        +${amount}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 py-2">
                  <Info className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-500">
                    No system bet types available for {items.length} selections. System bets require a specific number of selections (3, 4, 5, 6, 7, or 8).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Accept Odds Changes Toggle ────────────────────────────────── */}
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Odds changes</span>
              <div className="flex items-center gap-1">
                {(['any', 'better', 'none'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setOddsChangeMode(mode)}
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded transition-colors capitalize',
                      oddsChangeMode === mode
                        ? 'bg-brand-500/20 text-brand-400'
                        : 'text-gray-600 hover:text-gray-400'
                    )}
                  >
                    {mode === 'any' ? 'Accept All' : mode === 'better' ? 'Higher' : 'None'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Summary / Footer ─────────────────────────────────────────── */}
          <div className="border-t border-border p-3 space-y-2 bg-surface-secondary">
            {/* Error message */}
            <AnimatePresence>
              {placeBetError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[11px] text-accent-red bg-accent-red/10 rounded px-2.5 py-1.5"
                >
                  {placeBetError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Total stake */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Total Stake</span>
              <span className="font-mono font-medium text-white">
                ${totalStake} <span className="text-gray-500 text-xs">USDT</span>
              </span>
            </div>

            {/* Total potential win */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">
                {betType === 'system' ? 'Max Potential Win' : 'Potential Win'}
              </span>
              <span className="font-mono font-bold text-accent-green">
                ${potentialWin} <span className="text-gray-500 text-xs font-normal">USDT</span>
              </span>
            </div>

            {/* Place Bet button */}
            <button
              onClick={handlePlaceBet}
              disabled={!canPlaceBet}
              className={cn(
                'w-full text-sm py-3 font-bold rounded-xl transition-all duration-200 active:scale-[0.98]',
                canPlaceBet
                  ? 'bg-accent-green hover:brightness-110 text-white shadow-lg shadow-accent-green/20'
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              )}
            >
              {!isAuthenticated
                ? 'Sign in to place bet'
                : isSubmitting
                  ? 'Placing Bet...'
                  : oddsChanges.length > 0
                    ? 'Accept Odds Changes First'
                    : betType === 'parlay' && hasDuplicateEvents
                      ? 'Remove Duplicate Events'
                      : `Place ${betType === 'single' ? (items.length === 1 ? 'Bet' : `${items.length} Bets`) : betType === 'parlay' ? 'Multi Bet' : 'System Bet'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-l border-border bg-surface-secondary shrink-0 overflow-hidden">
        {panelContent}
      </aside>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Bottom sheet */}
            <motion.div
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: sheetExpanded ? 0 : '60%' }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{ maxHeight: '85vh' }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-secondary rounded-t-2xl flex flex-col shadow-dialog"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>

              {/* Sheet content */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {panelContent}
              </div>

              {/* Collapsed summary bar */}
              {!sheetExpanded && items.length > 0 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSheetExpanded(true)}
                  className="absolute top-12 left-0 right-0 flex items-center justify-between px-4 py-3 bg-surface-tertiary border-t border-border"
                >
                  <div className="flex items-center gap-2">
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-white">
                      {items.length} selection{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-brand-400">${totalStake}</span>
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile floating bet slip toggle button (when closed) */}
      <AnimatePresence>
        {!isOpen && items.length > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className="lg:hidden fixed bottom-4 right-4 z-40 bg-brand-500 hover:bg-brand-600 text-white rounded-full p-3.5 shadow-lg shadow-brand-500/30 flex items-center gap-2"
          >
            <Receipt className="w-5 h-5" />
            <span className="text-sm font-bold pr-1">
              {items.length}
            </span>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-green rounded-full flex items-center justify-center text-[10px] font-bold">
              {items.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
