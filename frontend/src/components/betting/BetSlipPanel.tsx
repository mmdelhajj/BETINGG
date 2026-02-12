'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { useAuthStore } from '@/stores/authStore';
import { bettingApi } from '@/lib/api';
import { formatOdds } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo, useMotionValue } from 'framer-motion';
import {
  X,
  Trash2,
  ChevronDown,
  Receipt,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Check,
  Info,
  TrendingUp,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────
const QUICK_STAKES = [5, 10, 25, 50, 100];
const DRAG_CLOSE_THRESHOLD = 70; // 60-80px as specified
const DRAG_ELASTICITY = 0.35; // 0.3-0.4 elasticity
const MAX_SHEET_HEIGHT = 'calc(85vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))';
const TAB_HEIGHT = 44; // Touch-friendly tab height
const _BUTTON_HEIGHT = 48; // Prominent button height

// ─── Sub-components ─────────────────────────────────────────────────

/** Odds change direction badge */
function OddsChangeBadge({ direction }: { direction: 'up' | 'down' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-bold px-1 py-0.5 rounded',
        direction === 'up'
          ? 'bg-green-500/15 text-green-400'
          : 'bg-red-500/15 text-red-400'
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

/** Individual selection card - condensed for mobile */
function SelectionCard({
  item,
  betType,
  stake,
  oddsChange,
  isMobile,
  onRemove,
  onStakeChange,
  onQuickStake,
}: {
  item: {
    selectionId: string;
    selectionName: string;
    marketName: string;
    eventName: string;
    odds: string;
  };
  betType: string;
  stake: string;
  oddsChange?: { direction: 'up' | 'down'; previousOdds: string; currentOdds: string } | null;
  isMobile?: boolean;
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
      className={cn(
        'bg-surface-tertiary rounded-lg overflow-hidden',
        isMobile ? 'mb-2' : ''
      )}
    >
      <div className={cn(isMobile ? 'p-2' : 'p-3')}>
        {/* Header: Event name + Remove button */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p
            className={cn(
              'text-gray-400 leading-tight truncate flex-1',
              isMobile ? 'text-[10px]' : 'text-[11px]'
            )}
          >
            {item.eventName}
          </p>
          <button
            onClick={onRemove}
            className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors shrink-0 min-h-[44px] min-w-[44px] -m-1 flex items-center justify-center"
            aria-label="Remove selection"
          >
            <X className={cn(isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          </button>
        </div>

        {/* Selection + Market inline on mobile, stacked on desktop */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'font-semibold text-white truncate',
                isMobile ? 'text-xs' : 'text-sm'
              )}
            >
              {item.selectionName}
            </p>
            <p
              className={cn(
                'text-gray-500 truncate',
                isMobile ? 'text-[10px]' : 'text-[11px]'
              )}
            >
              {item.marketName}
            </p>
          </div>

          {/* Odds with change indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {oddsChange && <OddsChangeBadge direction={oddsChange.direction} />}
            <span
              className={cn(
                'font-mono font-bold rounded px-2 py-1',
                isMobile ? 'text-sm' : 'text-base',
                oddsChange
                  ? oddsChange.direction === 'up'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                  : 'bg-brand-500/10 text-brand-400'
              )}
            >
              {formatOdds(item.odds)}
            </span>
          </div>
        </div>

        {/* Stake input (single mode only) */}
        {betType === 'single' && (
          <div className={cn(isMobile ? 'mt-2' : 'mt-3')}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
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
                className={cn(
                  'w-full bg-surface-secondary border border-border rounded-lg pl-7 pr-3 font-mono text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all',
                  isMobile ? 'py-2 text-base' : 'py-2.5 text-sm'
                )}
                style={{ fontSize: '16px' }} // Prevents iOS zoom
              />
            </div>

            {/* Quick stakes row */}
            <div className={cn('flex gap-1.5', isMobile ? 'mt-2' : 'mt-2')}>
              {QUICK_STAKES.map((amount) => (
                <button
                  key={amount}
                  onClick={() => onQuickStake(amount)}
                  className={cn(
                    'flex-1 font-semibold bg-surface-hover/50 hover:bg-surface-hover active:bg-surface-hover rounded-md transition-colors text-gray-300 hover:text-white touch-manipulation',
                    'min-h-[44px]',
                    isMobile ? 'text-xs' : 'text-[11px]'
                  )}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {/* Potential win for this selection */}
            {potentialWin && (
              <div
                className={cn(
                  'flex justify-between items-center',
                  isMobile ? 'mt-2 text-xs' : 'mt-2.5 text-[11px]'
                )}
              >
                <span className="text-gray-500">Potential Win</span>
                <span className="font-mono font-semibold text-green-400">
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
  const [placeBetError, setPlaceBetError] = useState<string | null>(null);
  const [placeBetSuccess, setPlaceBetSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragY = useMotionValue(0);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    const tabs: Array<{ key: 'single' | 'parlay' | 'system'; label: string }> = [
      { key: 'single', label: 'Single' },
    ];
    if (items.length >= 2) tabs.push({ key: 'parlay', label: 'Parlay' });
    if (items.length >= 3) tabs.push({ key: 'system', label: 'Same Game' });
    return tabs;
  }, [items.length]);

  // Available system bet types
  const itemCount = items.length;
  const systemBetTypes = useMemo(() => getSystemBetTypes(), [itemCount, getSystemBetTypes]);
  const systemBetCount = useMemo(() => getSystemBetCount(), [systemType, getSystemBetCount]);

  // Lock body scroll on mobile when sheet is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isMobile]);

  // Clear success message after a few seconds
  useEffect(() => {
    if (placeBetSuccess) {
      const timer = setTimeout(() => setPlaceBetSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [placeBetSuccess]);

  // Reset bet type if current tab no longer available
  useEffect(() => {
    if (!availableTabs.some((tab) => tab.key === betType)) {
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
    if (info.offset.y > DRAG_CLOSE_THRESHOLD) {
      setIsOpen(false);
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-secondary/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-base text-white">Bet Slip</h3>
          {items.length > 0 && (
            <span className="bg-brand-500 text-white text-xs font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full px-1.5">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={clearSlip}
              className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1.5 transition-colors font-medium min-h-[44px] px-2 touch-manipulation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-tertiary flex items-center justify-center">
              <Receipt className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-base text-gray-300 font-semibold mb-2">
              Your bet slip is empty
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Click on odds to add selections and start betting.
            </p>
            {placeBetSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 flex items-center gap-2 text-green-400 text-sm justify-center bg-green-500/10 rounded-lg py-3 px-4"
              >
                <Check className="w-5 h-5" />
                <span className="font-semibold">Bet placed successfully!</span>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Tab Bar ──────────────────────────────────────────────────── */}
          <div
            className="flex border-b border-border bg-surface-secondary/50 shrink-0"
            style={{ minHeight: `${TAB_HEIGHT}px` }}
          >
            {availableTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setBetType(tab.key)}
                className={cn(
                  'flex-1 text-sm font-bold transition-all relative touch-manipulation',
                  'min-h-[44px] flex items-center justify-center',
                  betType === tab.key
                    ? 'text-brand-400'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {tab.label}
                {tab.key === 'parlay' && hasDuplicateEvents && (
                  <span className="absolute top-2 right-1/4 w-2 h-2 bg-red-500 rounded-full" />
                )}
                {betType === tab.key && (
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
                className="overflow-hidden shrink-0"
              >
                <div className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-yellow-400 font-semibold mb-2">
                        Odds changed for {oddsChanges.length} selection
                        {oddsChanges.length > 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={acceptOddsChanges}
                          className="text-xs font-bold px-3 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors min-h-[44px] touch-manipulation"
                        >
                          Accept Changes
                        </button>
                        <button
                          onClick={rejectOddsChanges}
                          className="text-xs font-bold px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors min-h-[44px] touch-manipulation"
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
                className="overflow-hidden shrink-0"
              >
                <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400 font-medium">
                    Multiple selections from the same event. Remove duplicates to place a parlay bet.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Selections List ───────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-3 py-3 overscroll-contain">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <SelectionCard
                  key={item.selectionId}
                  item={item}
                  betType={betType}
                  stake={stakes[item.selectionId] || ''}
                  oddsChange={getOddsChange(item.selectionId)}
                  isMobile={isMobile}
                  onRemove={() => removeSelection(item.selectionId)}
                  onStakeChange={(val) => setStake(item.selectionId, val)}
                  onQuickStake={(amount) => handleQuickStakeForItem(item.selectionId, amount)}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* ── Parlay Stake Section ─────────────────────────────────────── */}
          {betType === 'parlay' && (
            <div className="px-4 py-3 border-t border-border bg-surface-secondary/50 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                  Combined Odds
                </span>
                <span className="text-base text-brand-400 font-mono font-bold">
                  {combinedOdds}
                </span>
              </div>
              <div className="relative mb-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
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
                  className="w-full bg-surface-secondary border border-border rounded-lg py-2.5 pl-7 pr-3 font-mono text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                  style={{ fontSize: '16px' }}
                />
              </div>
              {/* Quick stakes */}
              <div className="flex gap-1.5 mb-3">
                {QUICK_STAKES.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickStakeParlay(amount)}
                    className="flex-1 min-h-[44px] text-xs font-semibold bg-surface-hover/50 hover:bg-surface-hover active:bg-surface-hover rounded-md transition-colors text-gray-300 hover:text-white touch-manipulation"
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              {/* Parlay potential win */}
              {parlayStake && parseFloat(parlayStake) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Potential Win</span>
                  <span className="font-mono font-bold text-green-400">
                    ${potentialWin}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── System Bet Section ───────────────────────────────────────── */}
          {betType === 'system' && (
            <div className="px-4 py-3 border-t border-border bg-surface-secondary/50 shrink-0">
              {systemBetTypes.length > 0 ? (
                <>
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-2">
                    System Type
                  </label>
                  <div className="space-y-2 mb-3">
                    {systemBetTypes.map((sbt) => (
                      <button
                        key={sbt.key}
                        onClick={() => setSystemType(sbt.key)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors min-h-[44px] touch-manipulation',
                          systemType === sbt.key
                            ? 'bg-brand-500/15 border-2 border-brand-500/40'
                            : 'bg-surface-tertiary hover:bg-surface-hover border-2 border-transparent'
                        )}
                      >
                        <div>
                          <span className="text-sm font-bold text-white block">
                            {sbt.name}
                          </span>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {sbt.description}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 font-mono shrink-0 ml-3">
                          {sbt.bets} bets
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* System stake input (per bet) */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-semibold">
                      Stake per bet
                    </span>
                    <span className="text-xs text-gray-500">
                      {systemBetCount} bets total
                    </span>
                  </div>
                  <div className="relative mb-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
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
                      className="w-full bg-surface-secondary border border-border rounded-lg py-2.5 pl-7 pr-3 font-mono text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  {/* Quick stakes */}
                  <div className="flex gap-1.5">
                    {QUICK_STAKES.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleQuickStakeSystem(amount)}
                        className="flex-1 min-h-[44px] text-xs font-semibold bg-surface-hover/50 hover:bg-surface-hover active:bg-surface-hover rounded-md transition-colors text-gray-300 hover:text-white touch-manipulation"
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2.5 py-3">
                  <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">
                    No system bet types available for {items.length} selections. System bets require 3-8 selections.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Accept Odds Changes Toggle ────────────────────────────────── */}
          <div className="px-4 py-2 border-t border-border/50 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Odds changes</span>
              <div className="flex items-center gap-1">
                {(['any', 'better', 'none'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setOddsChangeMode(mode)}
                    className={cn(
                      'text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-colors capitalize min-h-[32px] touch-manipulation',
                      oddsChangeMode === mode
                        ? 'bg-brand-500/20 text-brand-400'
                        : 'text-gray-600 hover:text-gray-400'
                    )}
                  >
                    {mode === 'any' ? 'All' : mode === 'better' ? 'Better' : 'None'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Summary / Footer ─────────────────────────────────────────── */}
          <div className="border-t border-border px-4 py-4 space-y-3 bg-surface-secondary shrink-0">
            {/* Error message */}
            <AnimatePresence>
              {placeBetError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5 font-medium"
                >
                  {placeBetError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Total stake */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400 font-medium">Total Stake</span>
              <span className="font-mono font-bold text-white text-base">
                ${totalStake}{' '}
                <span className="text-gray-500 text-xs font-normal">USDT</span>
              </span>
            </div>

            {/* Total potential win */}
            <div className="flex justify-between items-center pb-1">
              <span className="text-sm text-gray-400 font-medium">
                Potential Win
              </span>
              <span className="font-mono font-bold text-[#BFFF00] text-lg">
                ${potentialWin}
              </span>
            </div>

            {/* Place Bet button - Cloudbet/bet365 style */}
            <button
              onClick={handlePlaceBet}
              disabled={!canPlaceBet}
              className={cn(
                'w-full font-bold rounded-xl transition-all duration-200 touch-manipulation flex items-center justify-center gap-2',
                'text-base shadow-lg active:scale-[0.98]',
                isMobile ? 'py-3.5 min-h-[52px]' : 'py-3 min-h-[48px]',
                canPlaceBet
                  ? 'bg-[#BFFF00] hover:bg-[#D4FF33] text-black shadow-[#BFFF00]/30'
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed shadow-none'
              )}
            >
              {!isAuthenticated ? (
                'Sign in to place bet'
              ) : isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full"
                  />
                  Placing Bet...
                </>
              ) : oddsChanges.length > 0 ? (
                'Accept Odds Changes First'
              ) : betType === 'parlay' && hasDuplicateEvents ? (
                'Remove Duplicate Events'
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  Place{' '}
                  {betType === 'single'
                    ? items.length === 1
                      ? 'Bet'
                      : `${items.length} Bets`
                    : betType === 'parlay'
                      ? 'Parlay'
                      : 'System Bet'}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop sidebar - Fixed 320px right panel */}
      <aside className="hidden lg:flex flex-col w-80 border-l border-border bg-surface-secondary shrink-0 overflow-hidden fixed right-0 top-0 bottom-0 z-30">
        {panelContent}
      </aside>

      {/* Mobile bottom sheet with drag */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Bottom sheet */}
            <motion.div
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={DRAG_ELASTICITY}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              style={{
                y: dragY,
                maxHeight: MAX_SHEET_HEIGHT,
              }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-secondary rounded-t-3xl flex flex-col shadow-2xl"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0">
                <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
              </div>

              {/* Sheet content */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {panelContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile floating bet slip toggle button (when closed) */}
      <AnimatePresence>
        {!isOpen && items.length > 0 && isMobile && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-30 bg-[#BFFF00] hover:bg-[#D4FF33] text-black rounded-full px-5 py-3.5 shadow-2xl shadow-[#BFFF00]/30 flex items-center gap-2.5 font-bold text-sm touch-manipulation active:scale-95 transition-transform"
          >
            <Receipt className="w-5 h-5" />
            <span>Bet Slip</span>
            <span className="bg-black text-[#BFFF00] rounded-full min-w-[24px] h-[24px] flex items-center justify-center text-xs font-bold px-1.5">
              {items.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
