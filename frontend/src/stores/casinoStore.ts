import { create } from 'zustand';
import { post } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CasinoGameState =
  | 'idle'
  | 'betting'
  | 'playing'
  | 'cashout'
  | 'result'
  | 'error';

export interface AutoBetSettings {
  enabled: boolean;
  numberOfBets: number;
  betsPlaced: number;
  onWin: 'reset' | 'increase';
  onLoss: 'reset' | 'increase';
  winIncreasePercent: number;
  lossIncreasePercent: number;
  stopOnProfit: number;
  stopOnLoss: number;
  currentProfit: number;
}

interface PlaceCasinoBetPayload {
  gameSlug: string;
  amount: number;
  currency: string;
  clientSeed?: string;
  params?: Record<string, unknown>;
}

interface CasinoBetResult {
  roundId: string;
  result: unknown;
  payout: number;
  multiplier: number;
  serverSeedHash: string;
  nonce: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CasinoState {
  // State
  gameState: CasinoGameState;
  balance: number;
  currency: string;
  currentBet: number;
  baseBet: number;
  lastResult: CasinoBetResult | null;
  autoBet: AutoBetSettings;
  isProcessing: boolean;
  error: string | null;

  // Provably fair
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;

  // Actions
  setGameState: (state: CasinoGameState) => void;
  setBalance: (balance: number) => void;
  updateBalance: (delta: number) => void;
  setCurrency: (currency: string) => void;
  setCurrentBet: (amount: number) => void;
  setBaseBet: (amount: number) => void;
  setClientSeed: (seed: string) => void;
  setError: (error: string | null) => void;

  placeBet: (payload: PlaceCasinoBetPayload) => Promise<CasinoBetResult>;
  cashOut: (roundId: string) => Promise<{ payout: number; multiplier: number }>;

  // Auto bet
  setAutoBet: (settings: Partial<AutoBetSettings>) => void;
  startAutoBet: () => void;
  stopAutoBet: () => void;
  processAutoBetStep: (won: boolean, payout: number) => boolean; // returns true if should continue

  // Reset
  reset: () => void;
}

const DEFAULT_AUTO_BET: AutoBetSettings = {
  enabled: false,
  numberOfBets: 0, // 0 = infinite
  betsPlaced: 0,
  onWin: 'reset',
  onLoss: 'reset',
  winIncreasePercent: 100,
  lossIncreasePercent: 100,
  stopOnProfit: 0,
  stopOnLoss: 0,
  currentProfit: 0,
};

function generateClientSeed(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const useCasinoStore = create<CasinoState>()((set, getState) => ({
  // ---- Initial state ----
  gameState: 'idle',
  balance: 0,
  currency: 'BTC',
  currentBet: 0.001,
  baseBet: 0.001,
  lastResult: null,
  autoBet: { ...DEFAULT_AUTO_BET },
  isProcessing: false,
  error: null,

  clientSeed: generateClientSeed(),
  serverSeedHash: '',
  nonce: 0,

  // ---- Actions ----

  setGameState: (gameState: CasinoGameState) => {
    set({ gameState });
  },

  setBalance: (balance: number) => {
    set({ balance });
  },

  updateBalance: (delta: number) => {
    set((state) => ({ balance: state.balance + delta }));
  },

  setCurrency: (currency: string) => {
    set({ currency });
  },

  setCurrentBet: (amount: number) => {
    set({ currentBet: Math.max(0, amount) });
  },

  setBaseBet: (amount: number) => {
    set({ baseBet: Math.max(0, amount), currentBet: Math.max(0, amount) });
  },

  setClientSeed: (seed: string) => {
    set({ clientSeed: seed });
  },

  setError: (error: string | null) => {
    set({ error, gameState: error ? 'error' : getState().gameState });
  },

  placeBet: async (payload: PlaceCasinoBetPayload): Promise<CasinoBetResult> => {
    set({ isProcessing: true, error: null, gameState: 'betting' });

    try {
      const { clientSeed, nonce } = getState();
      const result = await post<CasinoBetResult>(`/casino/games/${payload.gameSlug}/play`, {
        amount: payload.amount,
        currency: payload.currency,
        options: {
          ...payload.params,
          clientSeed,
          nonce,
        },
      });

      set({
        lastResult: result,
        serverSeedHash: result.serverSeedHash,
        nonce: result.nonce,
        isProcessing: false,
        gameState: 'playing',
      });

      return result;
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : 'Failed to place bet';
      set({ isProcessing: false, error: message, gameState: 'error' });
      throw error;
    }
  },

  cashOut: async (
    roundId: string,
  ): Promise<{ payout: number; multiplier: number }> => {
    set({ isProcessing: true });

    try {
      const result = await post<{ payout: number; multiplier: number }>(
        '/casino/cashout',
        { roundId },
      );

      set((state) => ({
        isProcessing: false,
        gameState: 'cashout',
        balance: state.balance + result.payout,
      }));

      return result;
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : 'Failed to cash out';
      set({ isProcessing: false, error: message });
      throw error;
    }
  },

  setAutoBet: (settings: Partial<AutoBetSettings>) => {
    set((state) => ({
      autoBet: { ...state.autoBet, ...settings },
    }));
  },

  startAutoBet: () => {
    const { currentBet } = getState();
    set({
      autoBet: {
        ...getState().autoBet,
        enabled: true,
        betsPlaced: 0,
        currentProfit: 0,
      },
      baseBet: currentBet,
    });
  },

  stopAutoBet: () => {
    set((state) => ({
      autoBet: { ...state.autoBet, enabled: false },
      currentBet: state.baseBet,
    }));
  },

  processAutoBetStep: (won: boolean, payout: number): boolean => {
    const state = getState();
    const { autoBet, baseBet, currentBet } = state;

    if (!autoBet.enabled) return false;

    const profit = autoBet.currentProfit + (won ? payout - currentBet : -currentBet);
    const betsPlaced = autoBet.betsPlaced + 1;

    // Stop conditions
    if (autoBet.numberOfBets > 0 && betsPlaced >= autoBet.numberOfBets) {
      getState().stopAutoBet();
      return false;
    }
    if (autoBet.stopOnProfit > 0 && profit >= autoBet.stopOnProfit) {
      getState().stopAutoBet();
      return false;
    }
    if (autoBet.stopOnLoss > 0 && profit <= -autoBet.stopOnLoss) {
      getState().stopAutoBet();
      return false;
    }

    // Adjust bet
    let nextBet = currentBet;
    if (won) {
      nextBet =
        autoBet.onWin === 'reset'
          ? baseBet
          : currentBet * (1 + autoBet.winIncreasePercent / 100);
    } else {
      nextBet =
        autoBet.onLoss === 'reset'
          ? baseBet
          : currentBet * (1 + autoBet.lossIncreasePercent / 100);
    }

    set({
      currentBet: nextBet,
      autoBet: { ...autoBet, betsPlaced, currentProfit: profit },
    });

    return true;
  },

  reset: () => {
    set({
      gameState: 'idle',
      lastResult: null,
      error: null,
      isProcessing: false,
      autoBet: { ...DEFAULT_AUTO_BET },
    });
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectGameState = (state: CasinoState) => state.gameState;
export const selectBalance = (state: CasinoState) => state.balance;
export const selectCurrentBet = (state: CasinoState) => state.currentBet;
export const selectIsProcessing = (state: CasinoState) => state.isProcessing;
export const selectAutoBet = (state: CasinoState) => state.autoBet;
export const selectError = (state: CasinoState) => state.error;
