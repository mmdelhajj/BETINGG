import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Decimal from 'decimal.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatOdds(odds: number | string, format: 'decimal' | 'fractional' | 'american' = 'decimal'): string {
  const d = new Decimal(odds);
  if (format === 'decimal') return d.toFixed(2);
  if (format === 'american') {
    if (d.gte(2)) return `+${d.minus(1).mul(100).toFixed(0)}`;
    return `-${new Decimal(100).div(d.minus(1)).toFixed(0)}`;
  }
  // fractional
  const num = d.minus(1);
  const denominator = 100;
  const numerator = num.mul(denominator).toFixed(0);
  return `${numerator}/${denominator}`;
}

export function formatCurrency(amount: string | number, currency: string = 'USDT'): string {
  const d = new Decimal(amount);
  if (d.gte(1000000)) return `${d.div(1000000).toFixed(2)}M ${currency}`;
  if (d.gte(1000)) return `${d.div(1000).toFixed(2)}K ${currency}`;
  return `${d.toFixed(d.lt(1) ? 4 : 2)} ${currency}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getSportIcon(slug: string): string {
  const icons: Record<string, string> = {
    football: 'soccer', soccer: 'soccer', basketball: 'basketball', tennis: 'tennis',
    baseball: 'baseball', 'ice-hockey': 'hockey', cricket: 'cricket', rugby: 'rugby',
    boxing: 'boxing', mma: 'martial-arts', golf: 'golf', 'formula-1': 'f1',
    esports: 'gamepad', 'counter-strike': 'gamepad', dota2: 'gamepad', lol: 'gamepad',
  };
  return icons[slug] || 'trophy';
}
