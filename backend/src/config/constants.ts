// ─── VIP Tier System ───────────────────────────────────────────────────────

export interface VipTier {
  name: string;
  minWagered: number;
  rakebackPercent: number;
  turboBoost: number;
  turboDuration: number; // in hours
}

export const VIP_TIERS: readonly VipTier[] = [
  {
    name: 'Bronze',
    minWagered: 0,
    rakebackPercent: 5,
    turboBoost: 1.0,
    turboDuration: 0,
  },
  {
    name: 'Silver',
    minWagered: 1_000,
    rakebackPercent: 7,
    turboBoost: 1.1,
    turboDuration: 1,
  },
  {
    name: 'Gold',
    minWagered: 10_000,
    rakebackPercent: 10,
    turboBoost: 1.25,
    turboDuration: 2,
  },
  {
    name: 'Platinum',
    minWagered: 50_000,
    rakebackPercent: 12.5,
    turboBoost: 1.5,
    turboDuration: 4,
  },
  {
    name: 'Diamond',
    minWagered: 250_000,
    rakebackPercent: 15,
    turboBoost: 1.75,
    turboDuration: 6,
  },
  {
    name: 'Obsidian',
    minWagered: 1_000_000,
    rakebackPercent: 20,
    turboBoost: 2.0,
    turboDuration: 12,
  },
] as const;

// ─── Rakeback ──────────────────────────────────────────────────────────────

/** Portion of rakeback that goes to user's bonus wallet vs main wallet */
export const RAKEBACK_WALLET_SPLIT = 0.5;

// ─── Referral System ───────────────────────────────────────────────────────

/** Referral milestone rewards: { numberOfReferrals: rewardAmount (USD) } */
export const REFERRAL_REWARDS: Record<number, number> = {
  1: 5,
  5: 50,
  25: 500,
} as const;

// ─── Welcome Package ───────────────────────────────────────────────────────

/** Maximum welcome bonus amount in USD */
export const WELCOME_PACKAGE_MAX = 2500;

/** Number of days the welcome package is valid */
export const WELCOME_PACKAGE_DAYS = 30;

// ─── Jackpot ───────────────────────────────────────────────────────────────

/** Jackpot tier thresholds in USD */
export const JACKPOT_TIERS = {
  MINI: 100,
  MAJOR: 1_000,
  GRAND: 10_000,
} as const;

// ─── Bet Limits ────────────────────────────────────────────────────────────

/** Min and max bet amounts in USD equivalent */
export const BET_LIMITS = {
  MIN: 0.01,
  MAX: 100_000,
} as const;

// ─── Localization ──────────────────────────────────────────────────────────

/** Supported UI languages (ISO 639-1 codes) */
export const SUPPORTED_LANGUAGES = [
  'en', // English
  'es', // Spanish
  'pt', // Portuguese
  'de', // German
  'fr', // French
  'it', // Italian
  'ja', // Japanese
  'ko', // Korean
  'zh', // Chinese
  'ru', // Russian
  'tr', // Turkish
  'ar', // Arabic
  'hi', // Hindi
  'th', // Thai
  'vi', // Vietnamese
  'pl', // Polish
  'nl', // Dutch
  'sv', // Swedish
  'fi', // Finnish
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ─── Casino Game Settings ──────────────────────────────────────────────────

/** Interval between crash game rounds in milliseconds */
export const CRASH_GAME_INTERVAL_MS = 15_000;
