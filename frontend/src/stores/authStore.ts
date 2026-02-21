import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { post, get, put, setTokens, clearTokens } from '@/lib/api';
import { updateSocketAuth, disconnectSocket } from '@/lib/socket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'user' | 'vip' | 'admin';
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  twoFactorEnabled: boolean;
  createdAt: string;
  preferences: {
    oddsFormat: 'decimal' | 'fractional' | 'american';
    currency: string;
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
      betSettled: boolean;
      promotions: boolean;
    };
  };
  balances: Balance[];
}

export interface Balance {
  currency: string;
  available: number;
  locked: number;
  total: number;
}

interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
}

interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  referralCode?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

interface ProfileUpdate {
  username?: string;
  email?: string;
  avatar?: string;
  preferences?: Partial<User['preferences']>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (credentials: RegisterCredentials) => Promise<User>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<User>;
  updateBalance: (currency: string, available: number, locked: number) => void;
  setPreferredCurrency: (currency: string) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, getState) => ({
      // ---- Initial state ----
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      // ---- Actions ----

      login: async (credentials: LoginCredentials): Promise<User> => {
        set({ isLoading: true });
        try {
          const response = await post<LoginResponse>('/auth/login', credentials);

          const { user: rawUser, tokens } = response;

          // Store tokens
          setTokens(tokens.accessToken, tokens.refreshToken);
          updateSocketAuth(tokens.accessToken);

          // Build preferences from localStorage + backend data
          const savedCurrency = typeof window !== 'undefined'
            ? localStorage.getItem('cryptobet_preferred_currency')
            : null;
          const user: User = {
            ...rawUser,
            preferences: {
              oddsFormat: (rawUser as any).preferredOddsFormat || rawUser.preferences?.oddsFormat || 'decimal',
              currency: savedCurrency || (rawUser as any).preferredCurrency || rawUser.preferences?.currency || 'BTC',
              language: (rawUser as any).language || rawUser.preferences?.language || 'en',
              notifications: rawUser.preferences?.notifications || { email: true, push: true, betSettled: true, promotions: true },
            },
            balances: rawUser.balances || [],
          };

          set({
            user,
            token: tokens.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });

          return user;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (credentials: RegisterCredentials): Promise<User> => {
        set({ isLoading: true });
        try {
          const response = await post<LoginResponse>('/auth/register', credentials);

          const { user: rawUser, tokens } = response;

          setTokens(tokens.accessToken, tokens.refreshToken);
          updateSocketAuth(tokens.accessToken);

          const savedCurrency = typeof window !== 'undefined'
            ? localStorage.getItem('cryptobet_preferred_currency')
            : null;
          const user: User = {
            ...rawUser,
            preferences: {
              oddsFormat: (rawUser as any).preferredOddsFormat || rawUser.preferences?.oddsFormat || 'decimal',
              currency: savedCurrency || (rawUser as any).preferredCurrency || rawUser.preferences?.currency || 'BTC',
              language: (rawUser as any).language || rawUser.preferences?.language || 'en',
              notifications: rawUser.preferences?.notifications || { email: true, push: true, betSettled: true, promotions: true },
            },
            balances: rawUser.balances || [],
          };

          set({
            user,
            token: tokens.accessToken,
            isAuthenticated: true,
            isLoading: false,
          });

          return user;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        // Fire-and-forget logout on server
        post('/auth/logout', {}).catch(() => {
          // Ignore errors on logout
        });

        clearTokens();
        disconnectSocket();

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshToken: async () => {
        try {
          const response = await post<{ accessToken: string }>('/auth/refresh');
          const { accessToken } = response;

          setTokens(accessToken);
          updateSocketAuth(accessToken);

          set({ token: accessToken });
        } catch {
          // If refresh fails, log out
          getState().logout();
        }
      },

      fetchUser: async () => {
        set({ isLoading: true });
        try {
          const raw = await get<any>('/auth/me');
          // Normalize: backend may return wallets instead of balances
          const balances: Balance[] = raw.balances?.length
            ? raw.balances
            : (raw.wallets || []).map((w: any) => ({
                currency: w.currencySymbol || w.symbol || w.currency || '',
                available: parseFloat(w.balance ?? 0) - parseFloat(w.lockedBalance ?? 0),
                locked: parseFloat(w.lockedBalance ?? 0),
                total: parseFloat(w.balance ?? 0),
              }));
          // Currency priority: localStorage (device-specific) > backend preferredCurrency > default
          const savedCurrency = typeof window !== 'undefined'
            ? localStorage.getItem('cryptobet_preferred_currency')
            : null;
          const backendCurrency = raw.preferredCurrency || raw.preferences?.currency;
          const currency = savedCurrency || backendCurrency || 'BTC';
          // Sync localStorage with backend value if not set locally
          if (!savedCurrency && backendCurrency && typeof window !== 'undefined') {
            localStorage.setItem('cryptobet_preferred_currency', backendCurrency);
          }
          const preferences = {
            ...(raw.preferences || {}),
            currency,
          };
          const user: User = { ...raw, balances, preferences };
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          set({ isLoading: false });
          getState().logout();
        }
      },

      updateProfile: async (updates: ProfileUpdate): Promise<User> => {
        set({ isLoading: true });
        try {
          const result = await put<{ profile: User }>('/users/profile', updates);
          const user = result.profile || result as unknown as User;
          set({ user, isLoading: false });
          return user;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      updateBalance: (currency: string, available: number, locked: number) => {
        const { user } = getState();
        if (!user) return;

        const updatedBalances = (user.balances || []).map((b) =>
          b.currency === currency
            ? { ...b, available, locked, total: available + locked }
            : b,
        );

        // If currency not found, add it
        if (!updatedBalances.find((b) => b.currency === currency)) {
          updatedBalances.push({
            currency,
            available,
            locked,
            total: available + locked,
          });
        }

        set({
          user: { ...user, balances: updatedBalances },
        });
      },

      setPreferredCurrency: (currency: string) => {
        const { user } = getState();
        if (!user) return;
        set({
          user: {
            ...user,
            preferences: { ...user.preferences, currency },
          },
        });
        // Persist to localStorage so it survives refresh
        if (typeof window !== 'undefined') {
          localStorage.setItem('cryptobet_preferred_currency', currency);
        }
        // Also update on backend (fire-and-forget)
        put('/users/profile', { preferences: { currency } }).catch(() => {});
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      initialize: async () => {
        const { token, isInitialized } = getState();
        if (isInitialized) return;

        if (token) {
          try {
            await getState().fetchUser();
          } catch {
            getState().logout();
          }
        }

        set({ isInitialized: true });
      },
    }),
    {
      name: 'cryptobet-auth',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        // SSR-safe noop storage
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state: AuthState) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      } as AuthState),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors (for performance)
// ---------------------------------------------------------------------------

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectBalances = (state: AuthState) => state.user?.balances ?? [];
export const selectBalance = (currency: string) => (state: AuthState) =>
  state.user?.balances?.find((b) => b.currency === currency);
export const selectPreferredCurrency = (state: AuthState) => {
  // Priority: user preferences > localStorage > default BTC
  if (state.user?.preferences?.currency) return state.user.preferences.currency;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cryptobet_preferred_currency');
    if (saved) return saved;
  }
  return 'BTC';
};
