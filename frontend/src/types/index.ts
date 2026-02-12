export interface Sport {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  eventCount?: number;
  liveCount?: number;
}

export interface Competition {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  sportId: string;
  sport?: Sport;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  startTime: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'SUSPENDED';
  sportId: string;
  competitionId: string;
  competition?: Competition;
  sport?: Sport;
  markets?: Market[];
  homeScore?: number | null;
  awayScore?: number | null;
  isLive: boolean;
  isFeatured: boolean;
  metadata?: {
    matchTime?: string;
    period?: string;
    [key: string]: unknown;
  } | null;
}

export interface Market {
  id: string;
  name: string;
  type: string;
  status: 'OPEN' | 'SUSPENDED' | 'SETTLED' | 'VOIDED';
  selections: Selection[];
}

export interface Selection {
  id: string;
  name: string;
  outcome?: string;
  odds: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'WINNER' | 'LOSER' | 'VOIDED';
  marketId: string;
}

export interface BetSlipItem {
  selectionId: string;
  selectionName: string;
  marketName: string;
  eventName: string;
  eventId: string;
  odds: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
}

export interface Bet {
  id: string;
  reference: string;
  type: 'SINGLE' | 'PARLAY' | 'SYSTEM';
  stake: string;
  potentialWin: string;
  combinedOdds: string;
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID' | 'CASHOUT' | 'CANCELLED';
  currency: string;
  legs: BetLeg[];
  createdAt: string;
  settledAt?: string;
}

export interface BetLeg {
  id: string;
  selectionId: string;
  odds: string;
  status: string;
  selection: {
    name: string;
    market: {
      name: string;
      event: { id: string; name: string; startTime: string };
    };
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string;
  vipTier: string;
  kycLevel: string;
  preferredCurrency: string;
  preferredOddsFormat: string;
  twoFactorEnabled: boolean;
}
