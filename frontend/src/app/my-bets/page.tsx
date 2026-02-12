'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Trophy,
  Ban,
  ArrowRightLeft,
  Ticket,
  Layers,
  Grid3X3,
  Zap,
  CircleDollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BetStatus = 'PENDING' | 'LIVE' | 'WON' | 'LOST' | 'VOID' | 'CASHED_OUT';
type BetType = 'SINGLE' | 'PARLAY' | 'SYSTEM';
type LegStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';
type FilterTab = 'open' | 'settled' | 'all';
type TimeFilter = 'today' | '7days' | '30days' | 'all';
type TypeFilter = 'all' | 'SINGLE' | 'PARLAY' | 'SYSTEM';

interface BetLegData {
  id: string;
  eventName: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  selection: string;
  oddsPlaced: number;
  oddsCurrent?: number;
  status: LegStatus;
  sport: 'soccer' | 'basketball';
  isLive?: boolean;
}

interface BetData {
  id: string;
  type: BetType;
  status: BetStatus;
  stake: number;
  potentialWin: number;
  winAmount?: number;
  currency: string;
  legs: BetLegData[];
  cashOutValue?: number;
  placedAt: string;
  settledAt?: string;
}

// ---------------------------------------------------------------------------
// Mock data - 10 realistic bets
// ---------------------------------------------------------------------------

const MOCK_BETS: BetData[] = [
  // --- Open single bets ---
  {
    id: 'bet-001',
    type: 'SINGLE',
    status: 'PENDING',
    stake: 0.025,
    potentialWin: 0.06125,
    currency: 'BTC',
    cashOutValue: 0.038,
    placedAt: '2026-02-12T09:14:00Z',
    legs: [
      {
        id: 'leg-001',
        eventName: 'Arsenal vs Chelsea',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        market: 'Match Result',
        selection: 'Arsenal',
        oddsPlaced: 2.45,
        oddsCurrent: 2.30,
        status: 'PENDING',
        sport: 'soccer',
      },
    ],
  },
  {
    id: 'bet-002',
    type: 'SINGLE',
    status: 'LIVE',
    stake: 50,
    potentialWin: 140,
    currency: 'USDT',
    cashOutValue: 72.5,
    placedAt: '2026-02-12T11:30:00Z',
    legs: [
      {
        id: 'leg-002',
        eventName: 'LA Lakers vs Boston Celtics',
        homeTeam: 'LA Lakers',
        awayTeam: 'Boston Celtics',
        market: 'Spread',
        selection: 'LA Lakers -3.5',
        oddsPlaced: 2.80,
        oddsCurrent: 3.10,
        status: 'PENDING',
        sport: 'basketball',
        isLive: true,
      },
    ],
  },
  {
    id: 'bet-003',
    type: 'SINGLE',
    status: 'PENDING',
    stake: 100,
    potentialWin: 190,
    currency: 'USDT',
    cashOutValue: 95,
    placedAt: '2026-02-12T08:00:00Z',
    legs: [
      {
        id: 'leg-003',
        eventName: 'Real Madrid vs Barcelona',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        market: 'Over/Under 2.5 Goals',
        selection: 'Over 2.5',
        oddsPlaced: 1.90,
        status: 'PENDING',
        sport: 'soccer',
      },
    ],
  },
  // --- Open parlay (3 legs) ---
  {
    id: 'bet-004',
    type: 'PARLAY',
    status: 'PENDING',
    stake: 25,
    potentialWin: 316.25,
    currency: 'USDT',
    cashOutValue: 48.0,
    placedAt: '2026-02-11T20:45:00Z',
    legs: [
      {
        id: 'leg-004a',
        eventName: 'Liverpool vs Man City',
        homeTeam: 'Liverpool',
        awayTeam: 'Man City',
        market: 'Both Teams to Score',
        selection: 'Yes',
        oddsPlaced: 1.75,
        oddsCurrent: 1.68,
        status: 'WON',
        sport: 'soccer',
      },
      {
        id: 'leg-004b',
        eventName: 'Golden State Warriors vs Miami Heat',
        homeTeam: 'Golden State Warriors',
        awayTeam: 'Miami Heat',
        market: 'Moneyline',
        selection: 'Golden State Warriors',
        oddsPlaced: 1.55,
        oddsCurrent: 1.50,
        status: 'WON',
        sport: 'basketball',
      },
      {
        id: 'leg-004c',
        eventName: 'Bayern Munich vs Dortmund',
        homeTeam: 'Bayern Munich',
        awayTeam: 'Dortmund',
        market: 'Match Result',
        selection: 'Bayern Munich',
        oddsPlaced: 4.65,
        oddsCurrent: 4.90,
        status: 'PENDING',
        sport: 'soccer',
      },
    ],
  },
  // --- Settled won bets ---
  {
    id: 'bet-005',
    type: 'SINGLE',
    status: 'WON',
    stake: 0.05,
    potentialWin: 0.1025,
    winAmount: 0.1025,
    currency: 'BTC',
    placedAt: '2026-02-10T15:00:00Z',
    settledAt: '2026-02-10T17:05:00Z',
    legs: [
      {
        id: 'leg-005',
        eventName: 'Inter Milan vs Juventus',
        homeTeam: 'Inter Milan',
        awayTeam: 'Juventus',
        market: 'Match Result',
        selection: 'Inter Milan',
        oddsPlaced: 2.05,
        status: 'WON',
        sport: 'soccer',
      },
    ],
  },
  {
    id: 'bet-006',
    type: 'PARLAY',
    status: 'WON',
    stake: 30,
    potentialWin: 178.5,
    winAmount: 178.5,
    currency: 'USDT',
    placedAt: '2026-02-09T12:00:00Z',
    settledAt: '2026-02-09T22:30:00Z',
    legs: [
      {
        id: 'leg-006a',
        eventName: 'PSG vs Marseille',
        homeTeam: 'PSG',
        awayTeam: 'Marseille',
        market: 'Match Result',
        selection: 'PSG',
        oddsPlaced: 1.50,
        status: 'WON',
        sport: 'soccer',
      },
      {
        id: 'leg-006b',
        eventName: 'Denver Nuggets vs Phoenix Suns',
        homeTeam: 'Denver Nuggets',
        awayTeam: 'Phoenix Suns',
        market: 'Total Points Over/Under 220.5',
        selection: 'Over 220.5',
        oddsPlaced: 1.90,
        status: 'WON',
        sport: 'basketball',
      },
      {
        id: 'leg-006c',
        eventName: 'Atletico Madrid vs Sevilla',
        homeTeam: 'Atletico Madrid',
        awayTeam: 'Sevilla',
        market: 'Double Chance',
        selection: 'Atletico Madrid or Draw',
        oddsPlaced: 2.09,
        status: 'WON',
        sport: 'soccer',
      },
    ],
  },
  // --- Settled lost bets ---
  {
    id: 'bet-007',
    type: 'SINGLE',
    status: 'LOST',
    stake: 75,
    potentialWin: 262.5,
    currency: 'USDT',
    placedAt: '2026-02-08T18:00:00Z',
    settledAt: '2026-02-08T20:00:00Z',
    legs: [
      {
        id: 'leg-007',
        eventName: 'Tottenham vs Newcastle',
        homeTeam: 'Tottenham',
        awayTeam: 'Newcastle',
        market: 'Match Result',
        selection: 'Newcastle',
        oddsPlaced: 3.50,
        status: 'LOST',
        sport: 'soccer',
      },
    ],
  },
  {
    id: 'bet-008',
    type: 'PARLAY',
    status: 'LOST',
    stake: 40,
    potentialWin: 312.0,
    currency: 'USDT',
    placedAt: '2026-02-07T14:30:00Z',
    settledAt: '2026-02-07T23:00:00Z',
    legs: [
      {
        id: 'leg-008a',
        eventName: 'AC Milan vs Napoli',
        homeTeam: 'AC Milan',
        awayTeam: 'Napoli',
        market: 'Match Result',
        selection: 'AC Milan',
        oddsPlaced: 2.20,
        status: 'WON',
        sport: 'soccer',
      },
      {
        id: 'leg-008b',
        eventName: 'Milwaukee Bucks vs Brooklyn Nets',
        homeTeam: 'Milwaukee Bucks',
        awayTeam: 'Brooklyn Nets',
        market: 'Moneyline',
        selection: 'Brooklyn Nets',
        oddsPlaced: 3.55,
        status: 'LOST',
        sport: 'basketball',
      },
    ],
  },
  // --- Cashed out bet ---
  {
    id: 'bet-009',
    type: 'SINGLE',
    status: 'CASHED_OUT',
    stake: 0.1,
    potentialWin: 0.265,
    winAmount: 0.18,
    currency: 'BTC',
    placedAt: '2026-02-06T10:00:00Z',
    settledAt: '2026-02-06T11:45:00Z',
    legs: [
      {
        id: 'leg-009',
        eventName: 'Man United vs Aston Villa',
        homeTeam: 'Man United',
        awayTeam: 'Aston Villa',
        market: 'Match Result',
        selection: 'Man United',
        oddsPlaced: 2.65,
        status: 'PENDING',
        sport: 'soccer',
      },
    ],
  },
  // --- Extra open single (system type for variety) ---
  {
    id: 'bet-010',
    type: 'SYSTEM',
    status: 'PENDING',
    stake: 60,
    potentialWin: 480,
    currency: 'USDT',
    cashOutValue: 85,
    placedAt: '2026-02-11T17:20:00Z',
    legs: [
      {
        id: 'leg-010a',
        eventName: 'Borussia Dortmund vs RB Leipzig',
        homeTeam: 'Borussia Dortmund',
        awayTeam: 'RB Leipzig',
        market: 'Match Result',
        selection: 'Borussia Dortmund',
        oddsPlaced: 2.10,
        oddsCurrent: 2.05,
        status: 'WON',
        sport: 'soccer',
      },
      {
        id: 'leg-010b',
        eventName: 'Chicago Bulls vs Toronto Raptors',
        homeTeam: 'Chicago Bulls',
        awayTeam: 'Toronto Raptors',
        market: 'Spread',
        selection: 'Chicago Bulls +4.5',
        oddsPlaced: 1.91,
        oddsCurrent: 1.85,
        status: 'PENDING',
        sport: 'basketball',
      },
      {
        id: 'leg-010c',
        eventName: 'Benfica vs Porto',
        homeTeam: 'Benfica',
        awayTeam: 'Porto',
        market: 'Over/Under 2.5 Goals',
        selection: 'Under 2.5',
        oddsPlaced: 2.00,
        status: 'PENDING',
        sport: 'soccer',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: number, currency: string): string {
  if (currency === 'BTC') {
    return `${amount.toFixed(amount < 0.001 ? 6 : 4)} ${currency}`;
  }
  if (amount >= 1000) {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

function formatPlacedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isWithinDays(dateStr: string, days: number): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff <= days * 86_400_000;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: BetStatus }) {
  const map: Record<BetStatus, { label: string; className: string }> = {
    PENDING: {
      label: 'Pending',
      className: 'bg-[rgba(255,214,0,0.12)] text-[#FFD600]',
    },
    LIVE: {
      label: 'Live',
      className: 'bg-[rgba(48,224,0,0.12)] text-[#30E000]',
    },
    WON: {
      label: 'Won',
      className: 'bg-[rgba(48,224,0,0.1)] text-[#30E000]',
    },
    LOST: {
      label: 'Lost',
      className: 'bg-[rgba(255,73,74,0.1)] text-[#FF494A]',
    },
    VOID: {
      label: 'Void',
      className: 'bg-[rgba(255,255,255,0.06)] text-gray-400',
    },
    CASHED_OUT: {
      label: 'Cashed Out',
      className: 'bg-[rgba(59,130,246,0.12)] text-[#3B82F6]',
    },
  };

  const info = map[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        info.className,
      )}
    >
      {status === 'LIVE' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30E000] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#30E000]" />
        </span>
      )}
      {info.label}
    </span>
  );
}

function BetTypeBadge({ type }: { type: BetType }) {
  const icons: Record<BetType, React.ReactNode> = {
    SINGLE: <Ticket className="h-3 w-3" />,
    PARLAY: <Layers className="h-3 w-3" />,
    SYSTEM: <Grid3X3 className="h-3 w-3" />,
  };
  const labels: Record<BetType, string> = {
    SINGLE: 'Single',
    PARLAY: 'Parlay',
    SYSTEM: 'System',
  };
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-xs font-medium text-gray-300">
      {icons[type]}
      {labels[type]}
    </span>
  );
}

function LegStatusIcon({ status }: { status: LegStatus }) {
  switch (status) {
    case 'WON':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(48,224,0,0.15)]">
          <Check className="h-3 w-3 text-[#30E000]" />
        </span>
      );
    case 'LOST':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,73,74,0.15)]">
          <X className="h-3 w-3 text-[#FF494A]" />
        </span>
      );
    case 'VOID':
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)]">
          <Ban className="h-3 w-3 text-gray-400" />
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,214,0,0.12)]">
          <Clock className="h-3 w-3 text-[#FFD600]" />
        </span>
      );
  }
}

function SportIcon({ sport }: { sport: 'soccer' | 'basketball' }) {
  if (sport === 'basketball') {
    return (
      <svg
        className="h-3.5 w-3.5 text-gray-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M4.93 4.93l4.24 4.24" />
        <path d="M14.83 14.83l4.24 4.24" />
        <path d="M14.83 9.17l4.24-4.24" />
        <path d="M4.93 19.07l4.24-4.24" />
        <path d="M2 12h20" />
        <path d="M12 2v20" />
      </svg>
    );
  }
  // soccer
  return (
    <svg
      className="h-3.5 w-3.5 text-gray-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Single bet leg row
// ---------------------------------------------------------------------------

function LegRow({ leg }: { leg: BetLegData }) {
  const oddsChanged =
    leg.oddsCurrent !== undefined && leg.oddsCurrent !== leg.oddsPlaced;

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5">
        <LegStatusIcon status={leg.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-gray-300">
          <SportIcon sport={leg.sport} />
          <span className="truncate font-medium text-white">
            {leg.eventName}
          </span>
          {leg.isLive && (
            <span className="ml-1 inline-flex items-center gap-1 rounded bg-[rgba(48,224,0,0.12)] px-1.5 py-px text-[10px] font-bold text-[#30E000]">
              <Zap className="h-2.5 w-2.5" />
              LIVE
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {leg.market} &mdash;{' '}
          <span className="text-gray-300">{leg.selection}</span>
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="font-mono text-sm text-white">
          {leg.oddsPlaced.toFixed(2)}
        </span>
        {oddsChanged && (
          <div className="flex items-center justify-end gap-0.5 text-[11px]">
            <ArrowRightLeft className="h-2.5 w-2.5 text-gray-500" />
            <span
              className={cn(
                'font-mono',
                leg.oddsCurrent! > leg.oddsPlaced
                  ? 'text-[#30E000]'
                  : 'text-[#FF494A]',
              )}
            >
              {leg.oddsCurrent!.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bet card
// ---------------------------------------------------------------------------

function BetCard({ bet }: { bet: BetData }) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = bet.status === 'PENDING' || bet.status === 'LIVE';
  const showCashOut = isOpen && bet.cashOutValue !== undefined;

  // For settled won/cashed-out bets, highlight amount
  const settledAmount =
    bet.status === 'WON' || bet.status === 'CASHED_OUT'
      ? bet.winAmount
      : undefined;

  // First leg always visible; rest behind expand
  const primaryLegs = bet.legs.slice(0, 1);
  const remainingLegs = bet.legs.slice(1);
  const hasMore = remainingLegs.length > 0;

  return (
    <div
      className="rounded-lg border p-4 transition-colors"
      style={{
        background: '#1A1B1F',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Top row: type badge, status badge, date */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <BetTypeBadge type={bet.type} />
          <StatusBadge status={bet.status} />
        </div>
        <span className="text-[11px] text-gray-500">
          {formatPlacedDate(bet.placedAt)}
        </span>
      </div>

      {/* Stake / Potential / Win */}
      <div className="flex items-center gap-4 mt-2 mb-1 text-sm">
        <div>
          <span className="text-gray-500">Stake </span>
          <span className="font-mono font-medium text-white">
            {formatAmount(bet.stake, bet.currency)}
          </span>
        </div>
        <div className="h-3 w-px bg-[rgba(255,255,255,0.08)]" />
        {bet.status === 'LOST' ? (
          <div>
            <span className="text-gray-500">Potential Win </span>
            <span className="font-mono text-gray-600 line-through">
              {formatAmount(bet.potentialWin, bet.currency)}
            </span>
          </div>
        ) : settledAmount !== undefined ? (
          <div>
            <span className="text-gray-500">
              {bet.status === 'CASHED_OUT' ? 'Cashed Out ' : 'Won '}
            </span>
            <span
              className={cn(
                'font-mono font-semibold',
                bet.status === 'CASHED_OUT'
                  ? 'text-[#3B82F6]'
                  : 'text-[#30E000]',
              )}
            >
              {formatAmount(settledAmount, bet.currency)}
            </span>
          </div>
        ) : (
          <div>
            <span className="text-gray-500">Potential Win </span>
            <span className="font-mono font-medium text-[#30E000]">
              {formatAmount(bet.potentialWin, bet.currency)}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-2 h-px w-full bg-[rgba(255,255,255,0.06)]" />

      {/* Primary leg(s) always visible */}
      {primaryLegs.map((leg) => (
        <LegRow key={leg.id} leg={leg} />
      ))}

      {/* Expandable remaining legs */}
      {hasMore && (
        <>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="extra-legs"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {remainingLegs.map((leg) => (
                    <LegRow key={leg.id} leg={leg} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="mt-1 flex w-full items-center justify-center gap-1 rounded py-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                +{remainingLegs.length} more selection
                {remainingLegs.length > 1 && 's'}{' '}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </>
      )}

      {/* Cash Out button */}
      {showCashOut && (
        <div className="mt-3">
          <button
            className="flex w-full items-center justify-center gap-2 rounded bg-[#30E000] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <CircleDollarSign className="h-4 w-4" />
            Cash Out{' '}
            <span className="font-mono">
              {formatAmount(bet.cashOutValue!, bet.currency)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border px-6 py-16 text-center"
      style={{
        background: '#1A1B1F',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)]">
        <Ticket className="h-10 w-10 text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold text-white">No bets yet</h3>
      <p className="mt-1 max-w-xs text-sm text-gray-500">
        You have not placed any bets. Explore our sports and casino markets to
        get started.
      </p>
      <a
        href="/sports"
        className="mt-5 inline-flex items-center gap-2 rounded bg-[#30E000] px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        <Trophy className="h-4 w-4" />
        Place your first bet
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter pill button helper
// ---------------------------------------------------------------------------

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-white text-black'
          : 'bg-[rgba(255,255,255,0.06)] text-gray-400 hover:text-gray-200',
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MyBetsPage() {
  const [filterTab, setFilterTab] = useState<FilterTab>('open');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filteredBets = useMemo(() => {
    let result = MOCK_BETS;

    // Filter by tab
    if (filterTab === 'open') {
      result = result.filter(
        (b) => b.status === 'PENDING' || b.status === 'LIVE',
      );
    } else if (filterTab === 'settled') {
      result = result.filter(
        (b) =>
          b.status === 'WON' ||
          b.status === 'LOST' ||
          b.status === 'VOID' ||
          b.status === 'CASHED_OUT',
      );
    }

    // Filter by time
    if (timeFilter === 'today') {
      result = result.filter((b) => isWithinDays(b.placedAt, 1));
    } else if (timeFilter === '7days') {
      result = result.filter((b) => isWithinDays(b.placedAt, 7));
    } else if (timeFilter === '30days') {
      result = result.filter((b) => isWithinDays(b.placedAt, 30));
    }

    // Filter by type
    if (typeFilter !== 'all') {
      result = result.filter((b) => b.type === typeFilter);
    }

    return result;
  }, [filterTab, timeFilter, typeFilter]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white">My Bets</h1>

      {/* Primary filter tabs */}
      <div className="mt-5 flex border-b border-[rgba(255,255,255,0.08)]">
        {(
          [
            { key: 'open', label: 'Open' },
            { key: 'settled', label: 'Settled' },
            { key: 'all', label: 'All' },
          ] as { key: FilterTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={cn(
              'relative px-5 py-2.5 text-sm font-medium transition-colors',
              filterTab === tab.key
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-300',
            )}
          >
            {tab.label}
            {filterTab === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#30E000]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Secondary filters */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* Time filter */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { key: 'today', label: 'Today' },
              { key: '7days', label: 'Last 7 days' },
              { key: '30days', label: 'Last 30 days' },
              { key: 'all', label: 'All time' },
            ] as { key: TimeFilter; label: string }[]
          ).map((t) => (
            <Pill
              key={t.key}
              active={timeFilter === t.key}
              onClick={() => setTimeFilter(t.key)}
            >
              {t.label}
            </Pill>
          ))}
        </div>

        <div className="h-4 w-px bg-[rgba(255,255,255,0.08)] hidden sm:block" />

        {/* Bet type filter */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'SINGLE', label: 'Single' },
              { key: 'PARLAY', label: 'Parlay' },
              { key: 'SYSTEM', label: 'System' },
            ] as { key: TypeFilter; label: string }[]
          ).map((t) => (
            <Pill
              key={t.key}
              active={typeFilter === t.key}
              onClick={() => setTypeFilter(t.key)}
            >
              {t.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Bet list */}
      <div className="mt-5 space-y-3">
        {filteredBets.length === 0 ? (
          <EmptyState />
        ) : (
          filteredBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
        )}
      </div>
    </div>
  );
}
