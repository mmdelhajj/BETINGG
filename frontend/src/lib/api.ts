import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Sports API ──────────────────────────────────────────────────
export const sportsApi = {
  getSports: () => api.get('/sports'),
  getSport: (slug: string) => api.get(`/sports/${slug}`),
  getCompetitions: (sportSlug: string) => api.get(`/sports/${sportSlug}/competitions`),
  getEvents: (params: Record<string, any>) => api.get('/sports/events', { params }),
  getEvent: (id: string) => api.get(`/sports/events/${id}`),
  getLiveEvents: () => api.get('/sports/live'),
  getFeaturedEvents: () => api.get('/sports/featured'),
  searchEvents: (q: string) => api.get('/sports/search', { params: { q } }),
};

// ─── Betting API ─────────────────────────────────────────────────
export const bettingApi = {
  placeBet: (data: any) => api.post('/bets', data),
  getBet: (id: string) => api.get(`/bets/${id}`),
  getOpenBets: () => api.get('/bets/open'),
  getBetHistory: (params: Record<string, any>) => api.get('/bets/history', { params }),
  getCashoutValue: (betId: string) => api.get(`/bets/${betId}/cashout`),
  executeCashout: (betId: string, amount?: string) => api.post(`/bets/${betId}/cashout`, { amount }),
};

// ─── Auth API ────────────────────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: { email: string; username: string; password: string; referralCode?: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};

// ─── Wallet API ─────────────────────────────────────────────────
export const walletApi = {
  getWallets: () => api.get('/wallets'),
  getTotalBalance: () => api.get('/wallets/balance/total'),
  getDepositAddress: (currency: string) => api.get(`/wallets/deposit/${currency}/address`),
  withdraw: (data: any) => api.post('/wallets/withdraw', data),
  getSwapQuote: (params: any) => api.get('/wallets/swap/quote', { params }),
  executeSwap: (data: any) => api.post('/wallets/swap', data),
  getTransactions: (params?: Record<string, any>) => api.get('/wallets/transactions', { params }),
};

// ─── Promotions API ─────────────────────────────────────────────
export const promotionsApi = {
  getPromotions: (params?: Record<string, any>) => api.get('/promotions', { params }),
  getPromotion: (id: string) => api.get(`/promotions/${id}`),
  claimPromotion: (id: string, data?: any) => api.post(`/promotions/${id}/claim`, data),
};

// ─── Casino API ─────────────────────────────────────────────────
export const casinoApi = {
  getGames: (params?: Record<string, any>) => api.get('/casino/games', { params }),
  getGame: (slug: string) => api.get(`/casino/games/${slug}`),
  getProviders: () => api.get('/casino/providers'),
};

// ─── VIP API ────────────────────────────────────────────────────
export const vipApi = {
  getStatus: () => api.get('/vip/status'),
  getTiers: () => api.get('/vip/tiers'),
  getRakeback: () => api.get('/rewards/rakeback'),
};

// ─── User API ───────────────────────────────────────────────────
export const userApi = {
  updateProfile: (data: any) => api.put('/users/profile', data),
  changePassword: (data: any) => api.post('/auth/change-password', data),
  getKycStatus: () => api.get('/kyc/status'),
  enable2FA: () => api.post('/auth/2fa/enable'),
  verify2FA: (token: string) => api.post('/auth/2fa/verify', { token }),
  disable2FA: (token: string) => api.post('/auth/2fa/disable', { token }),
};
