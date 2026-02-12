'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'events' | 'sports' | 'bets' | 'margins';

export default function AdminSportsbookPage() {
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<any[]>([]);
  const [sports, setSports] = useState<any[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    if (tab === 'events') {
      api.get('/sports/events?limit=50').then(({ data }) => {
        setEvents(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else if (tab === 'sports') {
      api.get('/sports').then(({ data }) => {
        setSports(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else if (tab === 'bets') {
      api.get('/admin/bets?limit=50').then(({ data }) => {
        setBets(data.data || []);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sportsbook Management</h1>

      <div className="flex gap-1 overflow-x-auto">
        {(['events', 'sports', 'bets', 'margins'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm capitalize transition-colors whitespace-nowrap',
              tab === t ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}>{t}</button>
        ))}
      </div>

      {/* Events Manager */}
      {tab === 'events' && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-gray-500">
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Sport</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Start Time</th>
                <th className="px-4 py-3">Markets</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id} className="border-b border-border/50 hover:bg-surface-tertiary/50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{evt.homeTeam} vs {evt.awayTeam}</p>
                    <p className="text-xs text-gray-500">{evt.name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{evt.sportId?.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded',
                      evt.status === 'LIVE' ? 'bg-accent-red/20 text-accent-red' :
                      evt.status === 'UPCOMING' ? 'bg-brand-500/20 text-brand-400' :
                      'bg-gray-500/20 text-gray-400'
                    )}>{evt.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {evt.status === 'LIVE' || evt.status === 'ENDED' ? `${evt.homeScore ?? 0} - ${evt.awayScore ?? 0}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(evt.startsAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{evt._count?.markets || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {evt.status === 'UPCOMING' && <button className="text-xs text-accent-green hover:underline">Start Live</button>}
                      {evt.status === 'LIVE' && <button className="text-xs text-accent-yellow hover:underline">Suspend</button>}
                      {evt.status === 'LIVE' && <button className="text-xs text-accent-red hover:underline">End</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sports CRUD */}
      {tab === 'sports' && (
        <div className="space-y-2">
          {sports.map((s: any) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{s.iconUrl || '🏟'}</span>
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500">/{s.slug} — {s._count?.competitions || 0} competitions</p>
                </div>
              </div>
              <span className={cn('text-xs font-bold', s.isActive ? 'text-accent-green' : 'text-accent-red')}>
                {s.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bet Monitor */}
      {tab === 'bets' && (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-gray-500">
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stake</th>
                <th className="px-4 py-3">Odds</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b: any) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-surface-tertiary/50">
                  <td className="px-4 py-3 font-mono text-xs">{b.referenceId?.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-xs">{b.user?.username || b.userId?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{b.type}</td>
                  <td className="px-4 py-3 font-mono font-bold">{b.stake} {b.currency}</td>
                  <td className="px-4 py-3 font-mono">{parseFloat(b.totalOdds).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold',
                      b.status === 'WON' ? 'text-accent-green' :
                      b.status === 'LOST' ? 'text-accent-red' :
                      b.status === 'PENDING' ? 'text-accent-yellow' : 'text-gray-400'
                    )}>{b.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{b.source || 'WEB'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(b.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Odds Margins */}
      {tab === 'margins' && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold">Odds Margin Configuration</h3>
          <p className="text-xs text-gray-500">Set margin percentages per sport. Higher margins = more house edge.</p>
          <div className="space-y-2">
            {['Football', 'Basketball', 'Tennis', 'Esports', 'MMA', 'Boxing'].map((sport) => (
              <div key={sport} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
                <span className="text-sm">{sport}</span>
                <div className="flex items-center gap-2">
                  <input type="number" defaultValue="5" step="0.5" min="1" max="20" className="input w-20 text-center text-sm py-1" />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary">Save Margins</button>
        </div>
      )}
    </div>
  );
}
