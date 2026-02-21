import { create } from 'zustand';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BetSelection {
  id: string;
  eventId: string;
  eventName: string;
  marketId: string;
  marketName: string;
  outcomeName: string;
  odds: number;
  previousOdds?: number;
  sportId: string;
  sportName: string;
  startTime: string;
  isLive: boolean;
}

export type BetType = 'single' | 'parlay' | 'system';
export type OddsChangePolicy = 'accept_any' | 'accept_higher' | 'reject';

export interface SystemBetType {
  name: string;
  size: number; // e.g., 2 for "2 of N" system bets
  combinations: number;
}

interface PlaceBetPayload {
  type: 'SINGLE' | 'PARLAY';
  selections: Array<{
    selectionId: string;
    odds: number;
  }>;
  stake: number;
  currency: string;
  oddsChangePolicy: 'ACCEPT_ANY' | 'ACCEPT_HIGHER' | 'REJECT';
  isLive?: boolean;
}

interface PlaceBetResponse {
  betId: string;
  status: 'accepted' | 'pending';
  totalStake: number;
  potentialWin: number;
  newBalance?: number;
  bet?: {
    id: string;
    stake: string;
    currency: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateCombinations(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 1) return arr.map((item) => [item]);
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - size; i++) {
    const head = arr[i];
    const tailCombos = getCombinations(arr.slice(i + 1), size - 1);
    for (const combo of tailCombos) {
      result.push([head, ...combo]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface BetSlipState {
  // State
  selections: BetSelection[];
  betType: BetType;
  stakes: Record<string, number>; // Key: selection id for singles, 'parlay' for parlay, 'system' for system
  currency: string;
  oddsChangePolicy: OddsChangePolicy;
  systemSize: number; // For system bets: size of each combination
  isPlacing: boolean;
  isOpen: boolean; // Bet slip visibility on mobile

  // Computed getters (implemented as actions that compute)
  getTotalOdds: () => number;
  getPotentialWin: () => number;
  getTotalStake: () => number;
  getSystemBetTypes: () => SystemBetType[];
  getSelectionCount: () => number;
  hasSelection: (eventId: string, marketId: string, outcomeName: string) => boolean;

  // Actions
  addSelection: (selection: BetSelection) => void;
  removeSelection: (selectionId: string) => void;
  clearAll: () => void;
  setStake: (key: string, amount: number) => void;
  setBetType: (type: BetType) => void;
  setCurrency: (currency: string) => void;
  setOddsChangePolicy: (policy: OddsChangePolicy) => void;
  setSystemSize: (size: number) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  updateOdds: (selectionId: string, newOdds: number) => void;
  placeBet: () => Promise<PlaceBetResponse>;
}

const MAX_SELECTIONS = 20;

// Always start with 'BTC' to avoid SSR/client hydration mismatch.
// The real value is synced from localStorage on mount via hydrateFromStorage().
const INITIAL_CURRENCY = 'BTC';

export const useBetSlipStore = create<BetSlipState>()((set, getState) => ({
  // ---- Initial state ----
  selections: [],
  betType: 'single',
  stakes: {},
  currency: INITIAL_CURRENCY,
  oddsChangePolicy: 'accept_any',
  systemSize: 2,
  isPlacing: false,
  isOpen: false,

  // ---- Computed getters ----

  getTotalOdds: (): number => {
    const { selections, betType, systemSize } = getState();
    if (selections.length === 0) return 0;

    switch (betType) {
      case 'single':
        // For singles, return the odds of the first selection (or 0 for multiple)
        return selections.length === 1 ? selections[0].odds : 0;

      case 'parlay':
        return (selections || []).reduce((acc, sel) => acc * sel.odds, 1);

      case 'system': {
        // Average odds across combinations
        const combos = getCombinations(selections, systemSize);
        if (combos.length === 0) return 0;
        const totalCombinedOdds = (combos || []).reduce(
          (acc, combo) => acc + combo.reduce((a, s) => a * s.odds, 1),
          0,
        );
        return totalCombinedOdds / combos.length;
      }

      default:
        return 0;
    }
  },

  getPotentialWin: (): number => {
    const { selections, betType, stakes, systemSize } = getState();
    if (selections.length === 0) return 0;

    switch (betType) {
      case 'single': {
        let total = 0;
        for (const sel of selections) {
          const stake = stakes[sel.id] || 0;
          total += stake * sel.odds;
        }
        return total;
      }

      case 'parlay': {
        const parlayStake = stakes['parlay'] || 0;
        const combinedOdds = (selections || []).reduce((acc, sel) => acc * sel.odds, 1);
        return parlayStake * combinedOdds;
      }

      case 'system': {
        const systemStake = stakes['system'] || 0;
        const combos = getCombinations(selections, systemSize);
        // Each combination gets the same stake
        const stakePerCombo = systemStake;
        let totalPotential = 0;
        for (const combo of combos) {
          const comboOdds = combo.reduce((acc, s) => acc * s.odds, 1);
          totalPotential += stakePerCombo * comboOdds;
        }
        return totalPotential;
      }

      default:
        return 0;
    }
  },

  getTotalStake: (): number => {
    const { betType, stakes, selections, systemSize } = getState();

    switch (betType) {
      case 'single': {
        let total = 0;
        for (const sel of selections) {
          total += stakes[sel.id] || 0;
        }
        return total;
      }

      case 'parlay':
        return stakes['parlay'] || 0;

      case 'system': {
        const numCombos = calculateCombinations(selections.length, systemSize);
        return (stakes['system'] || 0) * numCombos;
      }

      default:
        return 0;
    }
  },

  getSystemBetTypes: (): SystemBetType[] => {
    const { selections } = getState();
    const n = selections.length;
    if (n < 3) return [];

    const types: SystemBetType[] = [];
    for (let k = 2; k < n; k++) {
      const combos = calculateCombinations(n, k);
      types.push({
        name: `${k}/${n}`,
        size: k,
        combinations: combos,
      });
    }
    return types;
  },

  getSelectionCount: (): number => {
    return getState().selections.length;
  },

  hasSelection: (eventId: string, marketId: string, outcomeName: string): boolean => {
    return getState().selections.some(
      (s) => s.eventId === eventId && s.marketId === marketId && s.outcomeName === outcomeName,
    );
  },

  // ---- Actions ----

  addSelection: (selection: BetSelection) => {
    const { selections } = getState();

    // Max selections check
    if (selections.length >= MAX_SELECTIONS) return;

    // Check for duplicate (same event + market + outcome)
    const exists = selections.some(
      (s) =>
        s.eventId === selection.eventId &&
        s.marketId === selection.marketId &&
        s.outcomeName === selection.outcomeName,
    );

    if (exists) {
      // If exact duplicate, remove it (toggle behavior)
      set((state) => ({
        selections: state.selections.filter(
          (s) =>
            !(
              s.eventId === selection.eventId &&
              s.marketId === selection.marketId &&
              s.outcomeName === selection.outcomeName
            ),
        ),
      }));
      return;
    }

    // Check if same event but different outcome on same market (replace)
    const sameMarketIndex = selections.findIndex(
      (s) => s.eventId === selection.eventId && s.marketId === selection.marketId,
    );

    if (sameMarketIndex !== -1) {
      set((state) => {
        const updated = [...state.selections];
        updated[sameMarketIndex] = selection;
        return { selections: updated };
      });
    } else {
      set((state) => ({
        selections: [...state.selections, selection],
      }));
    }

    // Auto-switch to parlay if multiple selections
    const { selections: updated, betType } = getState();
    if (updated.length > 1 && betType === 'single') {
      // Keep as single, but user can switch
    }
  },

  removeSelection: (selectionId: string) => {
    set((state) => {
      const newSelections = state.selections.filter((s) => s.id !== selectionId);
      const newStakes = { ...state.stakes };
      delete newStakes[selectionId];

      // Reset bet type if only 1 selection remains
      const betType = newSelections.length <= 1 ? 'single' : state.betType;

      return {
        selections: newSelections,
        stakes: newStakes,
        betType,
      };
    });
  },

  clearAll: () => {
    set({
      selections: [],
      stakes: {},
      betType: 'single',
      systemSize: 2,
    });
  },

  setStake: (key: string, amount: number) => {
    set((state) => ({
      stakes: { ...state.stakes, [key]: Math.max(0, amount) },
    }));
  },

  setBetType: (type: BetType) => {
    set({ betType: type, stakes: {} });
  },

  setCurrency: (currency: string) => {
    set({ currency });
    // Also persist so it survives page refresh
    if (typeof window !== 'undefined') {
      localStorage.setItem('cryptobet_preferred_currency', currency);
    }
  },

  setOddsChangePolicy: (policy: OddsChangePolicy) => {
    set({ oddsChangePolicy: policy });
  },

  setSystemSize: (size: number) => {
    set({ systemSize: size, stakes: {} });
  },

  toggleOpen: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  setOpen: (open: boolean) => {
    set({ isOpen: open });
  },

  updateOdds: (selectionId: string, newOdds: number) => {
    set((state) => ({
      selections: state.selections.map((s) =>
        s.id === selectionId
          ? { ...s, previousOdds: s.odds, odds: newOdds }
          : s,
      ),
    }));
  },

  placeBet: async (): Promise<PlaceBetResponse> => {
    const { selections, betType, stakes, currency, oddsChangePolicy, systemSize } =
      getState();

    if (selections.length === 0) {
      throw new Error('No selections in bet slip');
    }

    set({ isPlacing: true });

    try {
      // Calculate total stake based on bet type
      let totalStake: number;
      if (betType === 'single') {
        totalStake = selections.reduce((sum, sel) => sum + (stakes[sel.id] || 0), 0);
      } else if (betType === 'parlay') {
        totalStake = stakes['parlay'] || 0;
      } else {
        totalStake = stakes['system'] || 0;
      }

      const backendType = betType === 'parlay' || betType === 'system' ? 'PARLAY' : 'SINGLE';
      const backendOddsPolicy = oddsChangePolicy.toUpperCase().replace(/_/g, '_') as 'ACCEPT_ANY' | 'ACCEPT_HIGHER' | 'REJECT';
      const hasLive = selections.some((s) => s.isLive);

      const payload: PlaceBetPayload = {
        type: backendType,
        selections: selections.map((s) => ({
          selectionId: s.id,
          odds: s.odds,
        })),
        stake: totalStake,
        currency,
        oddsChangePolicy: backendOddsPolicy,
        ...(hasLive ? { isLive: true } : {}),
      };

      console.log('[BetSlip] Placing bet:', JSON.stringify(payload, null, 2));
      const response = await post<PlaceBetResponse>('/betting/place', payload);

      // Update balance in auth store (stake deducted)
      if (response.newBalance !== undefined) {
        const { updateBalance } = useAuthStore.getState();
        updateBalance(currency, response.newBalance, 0);
      }

      // Clear bet slip on success
      set({
        selections: [],
        stakes: {},
        betType: 'single',
        systemSize: 2,
        isPlacing: false,
      });

      return response;
    } catch (error) {
      set({ isPlacing: false });
      throw error;
    }
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectSelections = (state: BetSlipState) => state.selections;
export const selectBetType = (state: BetSlipState) => state.betType;
export const selectIsPlacing = (state: BetSlipState) => state.isPlacing;
export const selectSelectionCount = (state: BetSlipState) => state.selections.length;
export const selectIsOpen = (state: BetSlipState) => state.isOpen;

// ---------------------------------------------------------------------------
// Hydrate currency from localStorage after mount (avoids SSR mismatch)
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('cryptobet_preferred_currency');
  if (saved && saved !== INITIAL_CURRENCY) {
    useBetSlipStore.setState({ currency: saved });
  }
}
