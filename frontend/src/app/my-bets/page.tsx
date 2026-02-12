'use client';

import { useEffect, useState } from 'react';
import { bettingApi } from '@/lib/api';
import { formatOdds, formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Bet } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-accent-yellow',
  WON: 'text-accent-green',
  LOST: 'text-accent-red',
  VOID: 'text-gray-400',
  CASHOUT: 'text-accent-orange',
  CANCELLED: 'text-gray-500',
};

type Tab = 'open' | 'settled';

export default function MyBetsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('open');
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const fetcher = activeTab === 'open'
      ? bettingApi.getOpenBets()
      : bettingApi.getBetHistory({ page, limit: 20 });

    fetcher.then(({ data }) => {
      const items = data.data;
      setBets(Array.isArray(items) ? items : items.bets || []);
      setHasMore(data.meta?.hasMore || false);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [activeTab, page]);

  const handleCashout = async (betId: string) => {
    try {
      await bettingApi.executeCashout(betId);
      // Refresh
      if (activeTab === 'open') {
        const { data } = await bettingApi.getOpenBets();
        setBets(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Cashout failed:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Bets</h1>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {(['open', 'settled'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors capitalize',
              activeTab === tab
                ? 'text-brand-400 border-b-2 border-brand-400'
                : 'text-gray-500 hover:text-gray-300'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-28 animate-pulse bg-surface-tertiary" />
          ))}
        </div>
      ) : bets.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">
            {activeTab === 'open' ? 'No open bets' : 'No bet history yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bets.map((bet) => (
            <div key={bet.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-surface-tertiary px-2 py-0.5 rounded capitalize">
                    {bet.type.toLowerCase()}
                  </span>
                  <span className={cn('text-xs font-bold', STATUS_COLORS[bet.status])}>
                    {bet.status}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatDate(bet.createdAt)}</span>
              </div>

              {/* Legs */}
              <div className="space-y-1.5 mb-3">
                {bet.legs.map((leg) => (
                  <div key={leg.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <p className="text-gray-300">{leg.selection.name}</p>
                      <p className="text-xs text-gray-500">
                        {leg.selection.market.event.name} - {leg.selection.market.name}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-brand-400">{formatOdds(leg.odds)}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-sm">
                  <span className="text-gray-400">Stake: </span>
                  <span className="font-mono">{formatCurrency(bet.stake, bet.currency)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-right">
                    <span className="text-gray-400">Potential Win: </span>
                    <span className="font-mono text-accent-green">
                      {formatCurrency(bet.potentialWin, bet.currency)}
                    </span>
                  </div>
                  {bet.status === 'PENDING' && (
                    <button
                      onClick={() => handleCashout(bet.id)}
                      className="btn-secondary text-xs px-2 py-1"
                    >
                      Cash Out
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {hasMore && activeTab === 'settled' && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary w-full text-sm"
            >
              Load More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
