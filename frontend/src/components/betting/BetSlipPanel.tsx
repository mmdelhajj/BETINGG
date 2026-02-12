'use client';

import { useState, useRef, useEffect } from 'react';
import { useBetSlipStore } from '@/stores/betSlipStore';
import { useAuthStore } from '@/stores/authStore';
import { bettingApi } from '@/lib/api';
import { formatOdds } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Receipt } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────
const QUICK_STAKES = [5, 10, 25, 50, 100];
const DRAG_CLOSE_THRESHOLD = 70;
const DRAG_ELASTICITY = 0.35;

// ─── Selection Card ─────────────────────────────────────────────────
function SelectionCard({
  item,
  betType,
  stake,
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
  onRemove: () => void;
  onStakeChange: (value: string) => void;
  onQuickStake: (amount: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-[#222328] rounded p-3 mb-2 relative"
      style={{ borderRadius: '4px' }}
    >
      {/* Remove button - top right (44px touch target) */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 text-gray-500 hover:text-red-500 transition-colors p-2 -m-2"
        aria-label="Remove selection"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Event name - 12px gray */}
      <p className="text-[12px] text-gray-500 mb-1 pr-8 truncate">
        {item.eventName}
      </p>

      {/* Selection name + odds - 14px bold */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[14px] font-bold text-white truncate flex-1">
          {item.selectionName}
        </p>
        <span className="text-[14px] font-bold text-[#8D52DA] font-mono shrink-0 tabular-nums">
          {formatOdds(item.odds)}
        </span>
      </div>

      {/* Stake input (single mode only) - 40px height, 16px font */}
      {betType === 'single' && (
        <>
          <div className="relative mb-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[16px]">
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
              className="w-full h-[40px] bg-[#1A1B1F] border border-[rgba(255,255,255,0.08)] rounded pl-8 pr-3 text-[16px] font-mono text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#8D52DA] focus:border-[#8D52DA] transition-all"
              style={{ borderRadius: '4px' }}
            />
          </div>

          {/* Quick stakes - 28px height, 12px font */}
          <div className="flex gap-1.5">
            {QUICK_STAKES.map((amount) => (
              <button
                key={amount}
                onClick={() => onQuickStake(amount)}
                className="flex-1 h-[28px] text-[12px] bg-transparent border border-[rgba(255,255,255,0.08)] rounded text-gray-400 hover:bg-[rgba(255,255,255,0.04)] hover:text-white transition-colors font-medium"
                style={{ borderRadius: '4px' }}
              >
                ${amount}
              </button>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export function BetSlipPanel() {
  const {
    items,
    betType,
    stakes,
    parlayStake,
    isOpen,
    isSubmitting,
    removeSelection,
    clearSlip,
    setBetType,
    setStake,
    setParlayStake,
    setIsOpen,
    setIsSubmitting,
    getCombinedOdds,
    getPotentialWin,
    getTotalStake,
  } = useBetSlipStore();

  const { isAuthenticated } = useAuthStore();
  const [placeBetError, setPlaceBetError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      }

      await bettingApi.placeBet(betData);
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

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DRAG_CLOSE_THRESHOLD) {
      setIsOpen(false);
    }
  };

  const totalStake = getTotalStake();
  const potentialWin = getPotentialWin();
  const combinedOdds = getCombinedOdds();
  const canPlaceBet =
    isAuthenticated && !isSubmitting && parseFloat(totalStake) > 0;

  // ─── Panel Content ──────────────────────────────────────────────────
  const panelContent = (
    <div className="flex flex-col h-full bg-[#1A1B1F]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[16px] font-bold text-white">Bet Slip</h3>
          {items.length > 0 && (
            <button
              onClick={clearSlip}
              className="text-[12px] text-gray-500 hover:text-white transition-colors py-2 px-2 -m-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tab bar: Single | Multi - purple 2px underline on active */}
        <div className="flex border-b border-[rgba(255,255,255,0.06)] -mx-4 px-4">
          <button
            onClick={() => setBetType('single')}
            className={cn(
              'flex-1 text-[14px] font-medium py-2.5 relative transition-colors',
              betType === 'single'
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            Single
            {betType === 'single' && (
              <motion.div
                layoutId="betslip-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8D52DA]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setBetType('parlay')}
            disabled={items.length < 2}
            className={cn(
              'flex-1 text-[14px] font-medium py-2.5 relative transition-colors',
              betType === 'parlay'
                ? 'text-white'
                : items.length < 2
                  ? 'text-gray-700 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-300'
            )}
          >
            Multi
            {betType === 'parlay' && (
              <motion.div
                layoutId="betslip-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8D52DA]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        </div>
      </div>

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Receipt className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-[14px] text-gray-500 mb-1 font-medium">
              Your bet slip is empty
            </p>
            <p className="text-[12px] text-gray-700">
              Make your selections from the available events
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Selections List ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-3 py-3 overscroll-contain">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <SelectionCard
                  key={item.selectionId}
                  item={item}
                  betType={betType}
                  stake={stakes[item.selectionId] || ''}
                  onRemove={() => removeSelection(item.selectionId)}
                  onStakeChange={(val) => setStake(item.selectionId, val)}
                  onQuickStake={(amount) => handleQuickStakeForItem(item.selectionId, amount)}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* ── Parlay Section ───────────────────────────────────────────── */}
          {betType === 'parlay' && (
            <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)] shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-gray-500">Total Odds</span>
                <span className="text-[14px] text-[#8D52DA] font-mono font-bold tabular-nums">
                  {combinedOdds}
                </span>
              </div>
              {/* Parlay stake input - 40px height, 16px font */}
              <div className="relative mb-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[16px]">
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
                  className="w-full h-[40px] bg-[#1A1B1F] border border-[rgba(255,255,255,0.08)] rounded pl-8 pr-3 text-[16px] font-mono text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-[#8D52DA] focus:border-[#8D52DA] transition-all"
                  style={{ borderRadius: '4px' }}
                />
              </div>
              {/* Quick stakes - 28px height, 12px font */}
              <div className="flex gap-1.5">
                {QUICK_STAKES.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickStakeParlay(amount)}
                    className="flex-1 h-[28px] text-[12px] bg-transparent border border-[rgba(255,255,255,0.08)] rounded text-gray-400 hover:bg-[rgba(255,255,255,0.04)] hover:text-white transition-colors font-medium"
                    style={{ borderRadius: '4px' }}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer (sticky at bottom) ─────────────────────────────────── */}
          <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-4 space-y-3 bg-[#1A1B1F] shrink-0">
            {/* Error message */}
            <AnimatePresence>
              {placeBetError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[12px] text-red-400 bg-red-500/10 rounded px-3 py-2"
                  style={{ borderRadius: '4px' }}
                >
                  {placeBetError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Total stake row */}
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-gray-400">Total Stake</span>
              <span className="text-[14px] font-mono text-white tabular-nums">
                ${totalStake}
              </span>
            </div>

            {/* Potential win row - green */}
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-gray-400">Potential Win</span>
              <span className="text-[14px] font-mono font-bold text-[#30E000] tabular-nums">
                ${potentialWin}
              </span>
            </div>

            {/* Place Bet button - 44px height, purple gradient */}
            <button
              onClick={handlePlaceBet}
              disabled={!canPlaceBet}
              className={cn(
                'w-full h-[44px] rounded text-[14px] font-bold text-white transition-all',
                canPlaceBet
                  ? 'bg-gradient-to-b from-[#9D62EA] to-[#8D52DA] hover:from-[#8C51D9] hover:to-[#7a42c4] active:scale-[0.98]'
                  : 'bg-[#8D52DA] opacity-50 cursor-not-allowed'
              )}
              style={{ borderRadius: '4px' }}
            >
              {!isAuthenticated ? (
                'Sign in to bet'
              ) : isSubmitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full mx-auto"
                />
              ) : (
                'Place Bet'
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
      {/* Desktop sidebar - Fixed 300px right panel, full height */}
      <aside className="hidden lg:flex flex-col w-[300px] border-l border-[rgba(255,255,255,0.06)] bg-[#1A1B1F] shrink-0 overflow-hidden fixed right-0 top-0 bottom-0 z-30">
        {panelContent}
      </aside>

      {/* Mobile bottom sheet with drag handle and backdrop */}
      <AnimatePresence>
        {isOpen && isMobile && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[rgba(0,0,0,0.5)] z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Bottom sheet */}
            <motion.div
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300, duration: 0.2 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={DRAG_ELASTICITY}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              style={{
                maxHeight: '80vh',
              }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1B1F] rounded-t-2xl flex flex-col shadow-2xl"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0">
                <div className="w-10 h-1 bg-[rgba(255,255,255,0.15)] rounded-full" />
              </div>

              {/* Sheet content */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {panelContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile FAB - purple round button with count badge (44px+ touch target) */}
      <AnimatePresence>
        {!isOpen && items.length > 0 && isMobile && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-30 bg-gradient-to-b from-[#9D62EA] to-[#8D52DA] hover:from-[#8C51D9] hover:to-[#7a42c4] text-white rounded-full px-4 py-3 shadow-2xl flex items-center gap-2.5 font-bold text-[14px] active:scale-95 transition-all min-h-[48px]"
          >
            <Receipt className="w-5 h-5" />
            <span>Bet Slip</span>
            <span className="bg-white text-[#8D52DA] rounded-full min-w-[22px] h-[22px] flex items-center justify-center text-[12px] font-bold px-1.5">
              {items.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
