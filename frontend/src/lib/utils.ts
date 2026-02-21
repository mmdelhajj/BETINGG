import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';

// ---------------------------------------------------------------------------
// cn – className merge helper (clsx + tailwind-merge)
// ---------------------------------------------------------------------------

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

const CRYPTO_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 6,
  USDT: 2,
  USDC: 2,
  LTC: 6,
  DOGE: 2,
  SOL: 4,
  BNB: 6,
  XRP: 4,
  TRX: 2,
  ADA: 4,
  DOT: 4,
  MATIC: 4,
  AVAX: 4,
  LINK: 4,
};

const CRYPTO_SYMBOLS: Record<string, string> = {
  BTC: '\u20BF',
  ETH: '\u039E',
  USDT: '$',
  USDC: '$',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

export function formatCurrency(
  amount: number | string,
  symbol: string = 'BTC',
  options?: { showSymbol?: boolean; maxDecimals?: number },
): string {
  const { showSymbol = true, maxDecimals } = options ?? {};
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) return '0.00';

  const decimals = maxDecimals ?? CRYPTO_DECIMALS[symbol.toUpperCase()] ?? 4;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });

  if (!showSymbol) return formatted;

  const sym = CRYPTO_SYMBOLS[symbol.toUpperCase()];
  if (sym) {
    return `${sym}${formatted}`;
  }

  return `${formatted} ${symbol.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Odds formatting
// ---------------------------------------------------------------------------

export type OddsFormat = 'decimal' | 'fractional' | 'american';

export function formatOdds(odds: number, toFormat: OddsFormat = 'decimal'): string {
  switch (toFormat) {
    case 'decimal':
      return odds.toFixed(2);

    case 'fractional': {
      // Convert decimal odds to fractional
      const numerator = odds - 1;
      // Find best fraction approximation
      const precision = 100;
      const gcdVal = gcd(Math.round(numerator * precision), precision);
      const num = Math.round(numerator * precision) / gcdVal;
      const den = precision / gcdVal;
      return `${num}/${den}`;
    }

    case 'american': {
      if (odds >= 2.0) {
        // Positive american odds
        const american = Math.round((odds - 1) * 100);
        return `+${american}`;
      } else {
        // Negative american odds
        const american = Math.round(-100 / (odds - 1));
        return `${american}`;
      }
    }

    default:
      return odds.toFixed(2);
  }
}

export function convertOdds(odds: number, from: OddsFormat, to: OddsFormat): number {
  // First convert to decimal
  let decimal: number;

  switch (from) {
    case 'decimal':
      decimal = odds;
      break;
    case 'american':
      if (odds > 0) {
        decimal = odds / 100 + 1;
      } else {
        decimal = 100 / Math.abs(odds) + 1;
      }
      break;
    case 'fractional':
      // Assumes odds is already the decimal representation of the fraction
      decimal = odds + 1;
      break;
    default:
      decimal = odds;
  }

  // Then convert from decimal to target format
  switch (to) {
    case 'decimal':
      return decimal;
    case 'american':
      if (decimal >= 2.0) {
        return Math.round((decimal - 1) * 100);
      }
      return Math.round(-100 / (decimal - 1));
    case 'fractional':
      return decimal - 1;
    default:
      return decimal;
  }
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

export function formatDate(
  date: string | Date,
  formatStr?: string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (formatStr) {
    return format(d, formatStr);
  }

  if (isToday(d)) {
    return `Today, ${format(d, 'HH:mm')}`;
  }
  if (isTomorrow(d)) {
    return `Tomorrow, ${format(d, 'HH:mm')}`;
  }
  if (isYesterday(d)) {
    return `Yesterday, ${format(d, 'HH:mm')}`;
  }

  return format(d, 'MMM d, HH:mm');
}

export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatFullDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMMM d, yyyy HH:mm:ss');
}

// ---------------------------------------------------------------------------
// Address shortening
// ---------------------------------------------------------------------------

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;

  const start = address.startsWith('0x') ? chars + 2 : chars;
  return `${address.slice(0, start)}...${address.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Avatar URL generation (DiceBear)
// ---------------------------------------------------------------------------

export function generateAvatarUrl(
  username: string,
  style: 'identicon' | 'bottts' | 'pixel-art' | 'adventurer' = 'identicon',
  size: number = 64,
): string {
  const seed = encodeURIComponent(username);
  return `https://api.dicebear.com/8.x/${style}/svg?seed=${seed}&size=${size}`;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }
  return Promise.resolve(false);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: Parameters<T>) => void>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

// ---------------------------------------------------------------------------
// Casino default bet amounts per currency
// ---------------------------------------------------------------------------

const DEFAULT_BETS: Record<string, string> = {
  BTC: '0.0001',
  ETH: '0.001',
  USDT: '1.00',
  USDC: '1.00',
  SOL: '0.05',
  BNB: '0.005',
  LTC: '0.01',
  DOGE: '10.00',
  XRP: '1.00',
  TRX: '5.00',
};

export function getDefaultBet(currency: string): string {
  return DEFAULT_BETS[currency] || '1.00';
}
