export const APP_NAME = 'CryptoBet';
export const APP_VERSION = '1.0.0';

export const JWT = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_SECRET || 'access-secret-change-me',
  REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me',
} as const;

export const BCRYPT_ROUNDS = 12;

export const RATE_LIMITS = {
  GLOBAL: { max: 100, timeWindow: '1 minute' },
  AUTH: { max: 10, timeWindow: '1 minute' },
  BET_PLACEMENT: { max: 30, timeWindow: '1 minute' },
  WITHDRAWAL: { max: 5, timeWindow: '1 minute' },
  API_FEED: { max: 600, timeWindow: '1 minute' },
  API_TRADING: { max: 60, timeWindow: '1 minute' },
} as const;

export const KYC_WITHDRAWAL_LIMITS = {
  UNVERIFIED: 2200,
  BASIC: 10000,
  FULL: Infinity,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const BET = {
  MIN_PARLAY_LEGS: 2,
  MAX_PARLAY_LEGS: 15,
  MAX_SYSTEM_LEGS: 10,
  GRACE_CANCEL_SECONDS: 3,
  LIVE_DELAY_SECONDS: { default: 5, football: 5, basketball: 3, tennis: 3, esports: 2 } as Record<string, number>,
  DANGER_HOLD_MINUTES: 5,
} as const;

export const CASINO = {
  DEFAULT_HOUSE_EDGE: 3,
  CRASH_HOUSE_EDGE: 3,
  DICE_HOUSE_EDGE: 1,
  COINFLIP_HOUSE_EDGE: 2,
  MINES_HOUSE_EDGE: 2,
  PLINKO_HOUSE_EDGE: 2,
  CRASH_ROUND_INTERVAL_MS: 15000,
  CRASH_COUNTDOWN_MS: 5000,
} as const;

export const VIP = {
  TIER_MAINTENANCE_DAYS: 30,
  DOWNGRADE_GRACE_DAYS: 30,
} as const;

export const REWARDS = {
  CALENDAR_SLOTS_PER_DAY: 3,
  CALENDAR_SLOT_INTERVAL_HOURS: 8,
  CALENDAR_CLAIM_WINDOW_HOURS: 12,
  WELCOME_PACKAGE_DAYS: 30,
  WELCOME_PACKAGE_MAX_REWARD: 2500,
  WELCOME_RAKEBACK_PERCENT: 10,
} as const;

export const WITHDRAWAL = {
  AUTO_APPROVE_THRESHOLD_USD: 1000,
  LARGE_WITHDRAWAL_THRESHOLD_USD: 10000,
} as const;

export const CACHE_TTL = {
  ODDS: 5,
  SPORTS_LIST: 60,
  COMPETITIONS_LIST: 60,
  EXCHANGE_RATES: 300,
  USER_SESSION: 900,
  EVENT_DETAIL: 30,
} as const;

export const QUEUE_NAMES = {
  BET_PROCESSING: 'bet-processing',
  BET_SETTLEMENT: 'bet-settlement',
  REWARD_CALCULATION: 'reward-calculation',
  WITHDRAWAL_PROCESSING: 'withdrawal-processing',
  DEPOSIT_DETECTION: 'deposit-detection',
  NOTIFICATION_SENDER: 'notification-sender',
} as const;

export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'de', 'it', 'fr', 'sv', 'nl', 'el', 'hu',
  'tr', 'id', 'pl', 'pt', 'pt-BR', 'ru', 'ko', 'ja', 'th', 'vi',
] as const;

export const ODDS_FORMATS = {
  DECIMAL: 'DECIMAL',
  FRACTIONAL: 'FRACTIONAL',
  AMERICAN: 'AMERICAN',
} as const;
