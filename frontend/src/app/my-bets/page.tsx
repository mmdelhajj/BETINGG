'use client';

import { useState, useMemo } from 'react';
import {
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Trophy,
  Ban,
  Ticket,
  Layers,
  Grid3X3,
  CircleDollarSign,
} from 'lucide-react';

// Types
type BetStatus = 'PENDING' | 'LIVE' | 'WON' | 'LOST' | 'VOID' | 'CASHED_OUT';
type BetType = 'SINGLE' | 'PARLAY' | 'SYSTEM';
type LegStatus = 'PENDING' | 'WON' | 'LOST' | 'VOID';
type FilterTab = 'open' | 'settled';
type SettledFilter = 'all' | 'won' | 'lost';

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

// Mock data
const MOCK_BETS: BetData[] = [
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
];

// Helpers
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

// Sub-components
function StatusBadge({ status }: { status: BetStatus }) {
  const map: Record<BetStatus, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-[rgba(255,214,0,0.12)] text-[#FFD600]' },
    LIVE: { label: 'Live', className: 'bg-[rgba(48,224,0,0.12)] text-[#30E000]' },
    WON: { label: 'Won', className: 'bg-[rgba(48,224,0,0.1)] text-[#30E000]' },
    LOST: { label: 'Lost', className: 'bg-[rgba(255,73,74,0.1)] text-[#FF494A]' },
    VOID: { label: 'Void', className: 'bg-[rgba(255,255,255,0.06)] text-gray-400' },
    CASHED_OUT: { label: 'Cashed Out', className: 'bg-[rgba(59,130,246,0.12)] text-[#3B82F6]' },
  };

  const info = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${info.className}`}>
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

function LegRow({ leg }: { leg: BetLegData }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5">
        <LegStatusIcon status={leg.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-gray-300">
          <span className="truncate font-medium text-white">{leg.eventName}</span>
          {leg.isLive && (
            <span className="ml-1 inline-flex items-center gap-1 rounded bg-[rgba(48,224,0,0.12)] px-1.5 py-px text-[11px] font-bold text-[#30E000]">
              LIVE
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {leg.market} — <span className="text-gray-300">{leg.selection}</span>
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="font-mono text-[13px] text-white">{leg.oddsPlaced.toFixed(2)}</span>
      </div>
    </div>
  );
}

function BetCard({ bet }: { bet: BetData }) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = bet.status === 'PENDING' || bet.status === 'LIVE';
  const showCashOut = isOpen && bet.cashOutValue !== undefined;

  const settledAmount =
    bet.status === 'WON' || bet.status === 'CASHED_OUT'
      ? bet.winAmount
      : undefined;

  const primaryLegs = bet.legs.slice(0, 1);
  const remainingLegs = bet.legs.slice(1);
  const hasMore = remainingLegs.length > 0;

  return (
    <div className="rounded-lg p-4 transition-colors bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BetTypeBadge type={bet.type} />
          <StatusBadge status={bet.status} />
        </div>
        <span className="text-[11px] text-gray-500">{formatPlacedDate(bet.placedAt)}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3 mb-2">
        <div className="text-sm">
          <span className="text-[rgba(224,232,255,0.6)]">Stake </span>
          <span className="font-mono font-medium text-white">{formatAmount(bet.stake, bet.currency)}</span>
        </div>
        <div className="hidden sm:block h-3 w-px bg-[rgba(255,255,255,0.08)]" />
        {bet.status === 'LOST' ? (
          <div className="text-sm">
            <span className="text-[rgba(224,232,255,0.6)]">Potential Win </span>
            <span className="font-mono text-gray-600 line-through">
              {formatAmount(bet.potentialWin, bet.currency)}
            </span>
          </div>
        ) : settledAmount !== undefined ? (
          <div className="text-sm">
            <span className="text-[rgba(224,232,255,0.6)]">
              {bet.status === 'CASHED_OUT' ? 'Cashed Out ' : 'Won '}
            </span>
            <span className={`font-mono font-semibold ${bet.status === 'CASHED_OUT' ? 'text-[#3B82F6]' : 'text-[#30E000]'}`}>
              {formatAmount(settledAmount, bet.currency)}
            </span>
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-[rgba(224,232,255,0.6)]">Potential Win </span>
            <span className="font-mono font-medium text-[#30E000]">
              {formatAmount(bet.potentialWin, bet.currency)}
            </span>
          </div>
        )}
      </div>

      <div className="my-3 h-px w-full bg-[rgba(255,255,255,0.06)]" />

      {primaryLegs.map((leg) => (
        <LegRow key={leg.id} leg={leg} />
      ))}

      {hasMore && (
        <>
          {expanded && (
            <div className="overflow-hidden">
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {remainingLegs.map((leg) => (
                  <LegRow key={leg.id} leg={leg} />
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded py-2 text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                +{remainingLegs.length} more selection{remainingLegs.length > 1 && 's'}{' '}
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </>
      )}

      {showCashOut && (
        <div className="mt-4">
          <button className="flex w-full items-center justify-center gap-2 rounded border-2 border-[#8D52DA] bg-transparent px-4 h-9 text-sm font-semibold text-[#8D52DA] transition-colors hover:bg-[rgba(141,82,218,0.1)]">
            <CircleDollarSign className="h-4 w-4" />
            Cash Out <span className="font-mono">{formatAmount(bet.cashOutValue!, bet.currency)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg px-6 py-16 text-center bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)]">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)]">
        <Ticket className="h-10 w-10 text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold text-white">No bets yet</h3>
      <p className="mt-1 max-w-xs text-sm text-gray-500">
        You have not placed any bets. Explore our sports and casino markets to get started.
      </p>
      <a
        href="/sports"
        className="mt-5 inline-flex items-center gap-2 rounded bg-[#8D52DA] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Trophy className="h-4 w-4" />
        Place your first bet
      </a>
    </div>
  );
}

export default function MyBetsPage() {
  const [filterTab, setFilterTab] = useState<FilterTab>('open');
  const [settledFilter, setSettledFilter] = useState<SettledFilter>('all');

  const filteredBets = useMemo(() => {
    let result = MOCK_BETS;

    if (filterTab === 'open') {
      result = result.filter((b) => b.status === 'PENDING' || b.status === 'LIVE');
    } else if (filterTab === 'settled') {
      result = result.filter(
        (b) => b.status === 'WON' || b.status === 'LOST' || b.status === 'VOID' || b.status === 'CASHED_OUT'
      );

      // Apply settled sub-filter
      if (settledFilter === 'won') {
        result = result.filter((b) => b.status === 'WON' || b.status === 'CASHED_OUT');
      } else if (settledFilter === 'lost') {
        result = result.filter((b) => b.status === 'LOST');
      }
    }

    return result;
  }, [filterTab, settledFilter]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-20 bg-[#0F0F12] min-h-screen">
      <h1 className="text-[20px] font-bold text-white mb-5">My Bets</h1>

      {/* Tabs - Active / Settled with purple underline */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)] mb-5">
        {[
          { key: 'open', label: 'Active' },
          { key: 'settled', label: 'Settled' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key as FilterTab)}
            className={`relative px-5 h-10 text-sm font-medium transition-colors ${
              filterTab === tab.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {filterTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8D52DA]" />
            )}
          </button>
        ))}
      </div>

      {/* Filter Pills - Won/Lost/All (only show when Settled is active) */}
      {filterTab === 'settled' && (
        <div className="flex gap-2 mb-4">
          {[
            { key: 'all', label: 'All' },
            { key: 'won', label: 'Won' },
            { key: 'lost', label: 'Lost' },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSettledFilter(filter.key as SettledFilter)}
              className={`h-8 px-3 rounded text-xs font-medium transition-colors ${
                settledFilter === filter.key
                  ? 'bg-[#8D52DA] text-white'
                  : 'bg-[#222328] text-gray-400 hover:text-white border border-[rgba(255,255,255,0.06)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredBets.length === 0 ? (
          <EmptyState />
        ) : (
          filteredBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
        )}
      </div>
    </div>
  );
}
