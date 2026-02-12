'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'games' | 'providers' | 'analytics';

export default function AdminCasinoPage() {
  const [tab, setTab] = useState<Tab>('games');
  const [games, setGames] = useState<any[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (tab === 'games') {
      api.get('/casino/games?limit=100').then(({ data }) => {
        setGames(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Casino Management</h1>

      <div className="flex gap-1">
        {(['games', 'providers', 'analytics'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm capitalize transition-colors',
              tab === t ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}>{t}</button>
        ))}
      </div>

      {/* Game Catalog */}
      {tab === 'games' && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 text-xs text-gray-500 px-4">
            <span>Game</span>
            <span>Provider</span>
            <span>Type / RTP</span>
            <span>Status</span>
          </div>
          {/* Originals */}
          {[
            { name: 'Crash', type: 'ORIGINAL', rtp: '97%', active: true },
            { name: 'Dice', type: 'ORIGINAL', rtp: '99%', active: true },
            { name: 'Mines', type: 'ORIGINAL', rtp: '97%', active: true },
            { name: 'Plinko', type: 'ORIGINAL', rtp: '97%', active: true },
            { name: 'Coinflip', type: 'ORIGINAL', rtp: '98%', active: true },
          ].map((game) => (
            <div key={game.name} className="card flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-brand-500/20 rounded-lg flex items-center justify-center text-brand-400 text-xs font-bold">
                  {game.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                  <p className="font-medium text-sm">{game.name}</p>
                  <p className="text-xs text-gray-500">CryptoBet {game.type}</p>
                  <p className="text-xs">RTP: <span className="text-brand-400">{game.rtp}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('text-xs font-bold', game.active ? 'text-accent-green' : 'text-accent-red')}>
                  {game.active ? 'Active' : 'Disabled'}
                </span>
                <button className="text-xs text-gray-400 hover:text-white">Edit</button>
              </div>
            </div>
          ))}

          {/* Provider Games */}
          {games.map((g: any) => (
            <div key={g.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-surface-tertiary rounded-lg" />
                <div>
                  <p className="font-medium text-sm">{g.name}</p>
                  <p className="text-xs text-gray-500">{g.provider} — {g.type}</p>
                </div>
              </div>
              <span className={cn('text-xs font-bold', g.isActive ? 'text-accent-green' : 'text-accent-red')}>
                {g.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Providers */}
      {tab === 'providers' && (
        <div className="space-y-3">
          {['Evolution Gaming', 'Pragmatic Play', 'NetEnt', 'Play\'n GO', 'Microgaming', 'Red Tiger'].map((provider) => (
            <div key={provider} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{provider}</p>
                <p className="text-xs text-gray-500">Game provider integration</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-right">
                  <p className="text-gray-500">Games: <span className="text-white">--</span></p>
                  <p className="text-gray-500">Revenue: <span className="font-mono text-accent-green">--</span></p>
                </div>
                <button className="btn-secondary text-xs">Configure</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      {tab === 'analytics' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total GGR', value: '--', color: 'text-accent-green' },
            { label: 'Total Sessions', value: '--', color: 'text-white' },
            { label: 'Avg Session', value: '--', color: 'text-brand-400' },
            { label: 'Top Game', value: 'Crash', color: 'text-accent-yellow' },
          ].map((stat) => (
            <div key={stat.label} className="card text-center">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
