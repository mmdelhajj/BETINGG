'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatOdds } from '@/lib/utils';
import { useBetSlipStore, type BetSelection } from '@/stores/betSlipStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OddsButtonProps {
  selectionId?: string;
  eventId: string;
  eventName: string;
  sportId: string;
  sportName: string;
  marketId: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  startTime: string;
  isLive?: boolean;
  compact?: boolean;
  className?: string;
  suspended?: boolean;
  status?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OddsButton({
  selectionId,
  eventId,
  eventName,
  sportId,
  sportName,
  marketId,
  marketName,
  outcomeName,
  odds,
  startTime,
  isLive = false,
  compact = false,
  className,
  suspended = false,
  status,
}: OddsButtonProps) {
  const { addSelection, hasSelection } = useBetSlipStore();
  const isSelected = hasSelection(eventId, marketId, outcomeName);

  // Treat selection as disabled if suspended or status is not ACTIVE/undefined
  const isDisabled = suspended || (status != null && status !== 'ACTIVE' && status !== 'active');

  const prevOddsRef = useRef(odds);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  // Detect odds changes and flash
  useEffect(() => {
    if (prevOddsRef.current !== odds) {
      const direction = odds > prevOddsRef.current ? 'up' : 'down';
      setFlash(direction);
      prevOddsRef.current = odds;

      const timer = setTimeout(() => setFlash(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [odds]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDisabled) return;

    const selection: BetSelection = {
      id: selectionId || `${eventId}-${marketId}-${outcomeName}`,
      eventId,
      eventName,
      marketId,
      marketName,
      outcomeName,
      odds,
      sportId,
      sportName,
      startTime,
      isLive,
    };

    addSelection(selection);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileTap={isDisabled ? undefined : { scale: 0.95 }}
      disabled={isDisabled}
      className={cn(
        'relative flex flex-col items-center gap-0.5 min-w-0 overflow-hidden',
        'px-3 py-2 rounded-button transition-all duration-200',
        'border',
        isDisabled
          ? 'bg-[#161B22] border-[#21262D] text-[#484F58] cursor-not-allowed opacity-50'
          : isSelected
            ? 'bg-[#8B5CF6]/20 border-[#8B5CF6]/50 text-[#8B5CF6]'
            : 'bg-[#1C2128] border-[#30363D] text-[#E6EDF3] hover:border-[#484F58] hover:bg-[#1C2128]/80',
        compact ? 'flex-1' : 'flex-1 min-h-[52px]',
        className,
      )}
    >
      {/* Flash overlay on odds change */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className={cn(
              'absolute inset-0 rounded-button pointer-events-none',
              flash === 'up'
                ? 'bg-[#10B981]/20'
                : 'bg-[#EF4444]/20',
            )}
          />
        )}
      </AnimatePresence>

      {/* Selection name */}
      {!compact && (
        <span className="text-[10px] text-[#8B949E] truncate max-w-full leading-tight">
          {outcomeName}
        </span>
      )}

      {/* Odds value */}
      <span
        className={cn(
          'font-mono font-semibold text-sm transition-colors duration-200',
          isSelected && 'text-[#8B5CF6]',
          flash === 'up' && !isSelected && 'text-[#10B981]',
          flash === 'down' && !isSelected && 'text-[#EF4444]',
        )}
      >
        {formatOdds(odds)}
      </span>

      {/* Trend arrow indicator */}
      <AnimatePresence>
        {flash && (
          <motion.span
            initial={{ opacity: 1, y: flash === 'up' ? 4 : -4 }}
            animate={{ opacity: 0, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className={cn(
              'absolute top-1 right-1 text-[10px] font-bold',
              flash === 'up' ? 'text-[#10B981]' : 'text-[#EF4444]',
            )}
          >
            {flash === 'up' ? '\u25B2' : '\u25BC'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
