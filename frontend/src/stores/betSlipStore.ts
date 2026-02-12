import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Decimal from 'decimal.js';
import type { BetSlipItem } from '@/types';
import {
  getAvailableSystemBets,
  getSystemBetCount,
  calculateSystemBetWin,
  getSystemTotalStake,
  type SystemBetType,
} from '@/lib/systemBets';

// ─── Types ───────────────────────────────────────────────────────

type BetType = 'single' | 'parlay' | 'system';
type OddsChangeMode = 'any' | 'better' | 'none';

interface OddsChange {
  selectionId: string;
  previousOdds: string;
  currentOdds: string;
  direction: 'up' | 'down';
}

interface BetSlipState {
  // Core state
  items: BetSlipItem[];
  betType: BetType;
  systemType: string | null;
  stakes: Record<string, string>;
  parlayStake: string;
  systemStake: string;
  isOpen: boolean;
  isSubmitting: boolean;

  // Quick bet
  quickBetEnabled: boolean;
  quickBetStake: string;

  // Odds change handling
  oddsChangeMode: OddsChangeMode;
  oddsChanges: OddsChange[];

  // ─── System bet getters ────────────────────────────────────────
  getSystemBetTypes: () => SystemBetType[];
  getSystemBetCount: () => number;
  getSystemPotentialWin: () => string;

  // ─── Enhanced calculations ─────────────────────────────────────
  getCombinedOdds: () => string;
  getPotentialWin: () => string;
  getTotalStake: () => string;
  getItemCount: () => number;
  hasSelection: (selectionId: string) => boolean;

  // ─── Actions ───────────────────────────────────────────────────
  addSelection: (item: BetSlipItem) => void;
  removeSelection: (selectionId: string) => void;
  toggleSelection: (item: BetSlipItem) => void;
  clearSlip: () => void;
  setBetType: (type: BetType) => void;
  setSystemType: (type: string) => void;
  setStake: (selectionId: string, amount: string) => void;
  setParlayStake: (amount: string) => void;
  setSystemStake: (amount: string) => void;
  setIsOpen: (open: boolean) => void;
  setIsSubmitting: (submitting: boolean) => void;
  updateOdds: (selectionId: string, newOdds: string) => void;
  setQuickBet: (enabled: boolean, stake?: string) => void;
  setOddsChangeMode: (mode: OddsChangeMode) => void;
  acceptOddsChanges: () => void;
  rejectOddsChanges: () => void;
}

// ─── Store ───────────────────────────────────────────────────────

export const useBetSlipStore = create<BetSlipState>()(
  persist(
    (set, get) => ({
      // Core state
      items: [],
      betType: 'single',
      systemType: null,
      stakes: {},
      parlayStake: '',
      systemStake: '',
      isOpen: false,
      isSubmitting: false,

      // Quick bet
      quickBetEnabled: false,
      quickBetStake: '1.00',

      // Odds change handling
      oddsChangeMode: 'any',
      oddsChanges: [],

      // ─── System bet getters ──────────────────────────────────────

      getSystemBetTypes: () => {
        const { items } = get();
        return getAvailableSystemBets(items.length);
      },

      getSystemBetCount: () => {
        const { systemType } = get();
        if (!systemType) return 0;
        return getSystemBetCount(systemType);
      },

      getSystemPotentialWin: () => {
        const { items, systemType, systemStake } = get();
        if (!systemType || !systemStake || items.length === 0) return '0.00';
        return calculateSystemBetWin(items, systemType, systemStake);
      },

      // ─── Enhanced calculations ───────────────────────────────────

      getCombinedOdds: () => {
        const { items } = get();
        if (items.length === 0) return '0';
        return items
          .reduce((acc, item) => acc.mul(new Decimal(item.odds)), new Decimal(1))
          .toFixed(2);
      },

      getPotentialWin: () => {
        const { items, betType, stakes, parlayStake, systemType, systemStake } = get();
        if (items.length === 0) return '0.00';

        if (betType === 'system') {
          if (!systemType || !systemStake) return '0.00';
          return calculateSystemBetWin(items, systemType, systemStake);
        }

        if (betType === 'parlay') {
          if (!parlayStake) return '0.00';
          const combined = items.reduce(
            (acc, i) => acc.mul(new Decimal(i.odds)),
            new Decimal(1)
          );
          return combined.mul(new Decimal(parlayStake)).toFixed(2);
        }

        // Singles
        let total = new Decimal(0);
        for (const item of items) {
          const stake = stakes[item.selectionId];
          if (stake) {
            total = total.plus(new Decimal(stake).mul(new Decimal(item.odds)));
          }
        }
        return total.toFixed(2);
      },

      getTotalStake: () => {
        const { items, betType, stakes, parlayStake, systemType, systemStake } = get();

        if (betType === 'system') {
          if (!systemType || !systemStake) return '0.00';
          return getSystemTotalStake(systemType, systemStake);
        }

        if (betType === 'parlay') return parlayStake || '0';

        // Singles
        let total = new Decimal(0);
        for (const item of items) {
          const stake = stakes[item.selectionId];
          if (stake) total = total.plus(new Decimal(stake));
        }
        return total.toFixed(2);
      },

      getItemCount: () => get().items.length,

      hasSelection: (selectionId) =>
        get().items.some((i) => i.selectionId === selectionId),

      // ─── Actions ─────────────────────────────────────────────────

      addSelection: (item) => {
        const { items, quickBetEnabled } = get();

        // Prevent duplicate events in parlay (replace selection from same event)
        if (
          items.some(
            (i) => i.eventId === item.eventId && i.selectionId !== item.selectionId
          )
        ) {
          set({
            items: items
              .filter((i) => i.eventId !== item.eventId)
              .concat(item),
            isOpen: true,
          });
          return;
        }

        // Skip if already present
        if (items.some((i) => i.selectionId === item.selectionId)) return;

        const newItems = [...items, item];

        // Auto-select system type when at 3+ selections
        const newState: Partial<BetSlipState> = {
          items: newItems,
          isOpen: !quickBetEnabled,
        };

        // If bet type is system and the new count changes available types, reset system type
        if (get().betType === 'system') {
          const available = getAvailableSystemBets(newItems.length);
          if (available.length > 0 && !available.some((a) => a.key === get().systemType)) {
            newState.systemType = available[0].key;
          }
        }

        set(newState);
      },

      removeSelection: (selectionId) => {
        const { items, stakes } = get();
        const newStakes = { ...stakes };
        delete newStakes[selectionId];
        const newItems = items.filter((i) => i.selectionId !== selectionId);

        const newState: Partial<BetSlipState> = {
          items: newItems,
          stakes: newStakes,
          oddsChanges: get().oddsChanges.filter((c) => c.selectionId !== selectionId),
        };

        // Adjust bet type if too few items
        if (newItems.length <= 1) {
          newState.betType = 'single';
          newState.systemType = null;
        } else if (get().betType === 'system') {
          const available = getAvailableSystemBets(newItems.length);
          if (available.length === 0) {
            newState.betType = newItems.length >= 2 ? 'parlay' : 'single';
            newState.systemType = null;
          } else if (!available.some((a) => a.key === get().systemType)) {
            newState.systemType = available[0].key;
          }
        }

        set(newState);
      },

      toggleSelection: (item) => {
        const { items } = get();
        if (items.some((i) => i.selectionId === item.selectionId)) {
          get().removeSelection(item.selectionId);
        } else {
          get().addSelection(item);
        }
      },

      clearSlip: () =>
        set({
          items: [],
          stakes: {},
          parlayStake: '',
          systemStake: '',
          betType: 'single',
          systemType: null,
          oddsChanges: [],
        }),

      setBetType: (type) => {
        const newState: Partial<BetSlipState> = { betType: type };
        if (type === 'system') {
          const available = getAvailableSystemBets(get().items.length);
          if (available.length > 0 && !get().systemType) {
            newState.systemType = available[0].key;
          }
        }
        if (type !== 'system') {
          newState.systemType = null;
        }
        set(newState);
      },

      setSystemType: (type) => set({ systemType: type }),

      setStake: (selectionId, amount) =>
        set((state) => ({ stakes: { ...state.stakes, [selectionId]: amount } })),

      setParlayStake: (amount) => set({ parlayStake: amount }),

      setSystemStake: (amount) => set({ systemStake: amount }),

      setIsOpen: (open) => set({ isOpen: open }),

      setIsSubmitting: (submitting) => set({ isSubmitting: submitting }),

      updateOdds: (selectionId, newOdds) => {
        const { items, oddsChangeMode, oddsChanges } = get();
        const item = items.find((i) => i.selectionId === selectionId);
        if (!item) return;

        const prevOdds = item.odds;
        if (prevOdds === newOdds) return;

        const direction = new Decimal(newOdds).gt(new Decimal(prevOdds))
          ? 'up'
          : 'down';

        // If mode is 'any', silently update
        if (oddsChangeMode === 'any') {
          set({
            items: items.map((i) =>
              i.selectionId === selectionId ? { ...i, odds: newOdds } : i
            ),
          });
          return;
        }

        // If mode is 'better', only auto-accept upward changes
        if (oddsChangeMode === 'better' && direction === 'up') {
          set({
            items: items.map((i) =>
              i.selectionId === selectionId ? { ...i, odds: newOdds } : i
            ),
          });
          return;
        }

        // Otherwise, record the change for user review
        const existing = oddsChanges.findIndex(
          (c) => c.selectionId === selectionId
        );
        const change: OddsChange = {
          selectionId,
          previousOdds: prevOdds,
          currentOdds: newOdds,
          direction,
        };

        const newChanges = [...oddsChanges];
        if (existing >= 0) {
          newChanges[existing] = change;
        } else {
          newChanges.push(change);
        }

        set({ oddsChanges: newChanges });
      },

      setQuickBet: (enabled, stake) => {
        const newState: Partial<BetSlipState> = { quickBetEnabled: enabled };
        if (stake !== undefined) newState.quickBetStake = stake;
        set(newState);
      },

      setOddsChangeMode: (mode) => set({ oddsChangeMode: mode }),

      acceptOddsChanges: () => {
        const { items, oddsChanges } = get();
        const updatedItems = items.map((item) => {
          const change = oddsChanges.find(
            (c) => c.selectionId === item.selectionId
          );
          if (change) {
            return { ...item, odds: change.currentOdds };
          }
          return item;
        });
        set({ items: updatedItems, oddsChanges: [] });
      },

      rejectOddsChanges: () => {
        // Remove items that had odds changes (user doesn't accept)
        const { items, oddsChanges, stakes } = get();
        const changedIds = new Set(oddsChanges.map((c) => c.selectionId));
        const newItems = items.filter((i) => !changedIds.has(i.selectionId));
        const newStakes = { ...stakes };
        for (const id of Array.from(changedIds)) {
          delete newStakes[id];
        }
        set({
          items: newItems,
          stakes: newStakes,
          oddsChanges: [],
          betType: newItems.length <= 1 ? 'single' : get().betType,
        });
      },
    }),
    {
      name: 'cryptobet-betslip',
      partialize: (state) => ({
        quickBetEnabled: state.quickBetEnabled,
        quickBetStake: state.quickBetStake,
        oddsChangeMode: state.oddsChangeMode,
      }),
    }
  )
);
