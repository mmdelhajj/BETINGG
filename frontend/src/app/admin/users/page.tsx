'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [_isLoading, setIsLoading] = useState(true);

  const fetchUsers = async (p = 1, q = '') => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/admin/users', { params: { page: p, limit: 20, query: q || undefined } });
      setUsers(data.data);
      setTotal(data.meta?.total || 0);
    } catch {}
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, query);
  };

  const loadUserDetail = async (userId: string) => {
    const { data } = await api.get(`/admin/users/${userId}`);
    setSelectedUser(data.data);
  };

  const handleBan = async (userId: string) => {
    const reason = prompt('Ban reason:');
    if (!reason) return;
    await api.post(`/admin/users/${userId}/ban`, { reason });
    fetchUsers(page, query);
    setSelectedUser(null);
  };

  const handleUnban = async (userId: string) => {
    await api.post(`/admin/users/${userId}/unban`);
    fetchUsers(page, query);
    setSelectedUser(null);
  };

  const handleChangeVip = async (userId: string) => {
    const tier = prompt('New VIP tier (BRONZE, SILVER, GOLD, EMERALD, SAPPHIRE, RUBY, DIAMOND, BLUE_DIAMOND):');
    if (!tier) return;
    await api.put(`/admin/users/${userId}/vip-tier`, { tier });
    fetchUsers(page, query);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <span className="text-sm text-gray-500">{total} total users</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email, username, or ID..."
          className="input flex-1"
        />
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>

      {/* User Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-gray-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">VIP</th>
              <th className="px-4 py-3">KYC</th>
              <th className="px-4 py-3">Wagered</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border/50 hover:bg-surface-tertiary/50 cursor-pointer" onClick={() => loadUserDetail(user.id)}>
                <td className="px-4 py-3">
                  <p className="font-medium">{user.username}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold text-brand-400">{user.vipTier}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs font-bold',
                    user.kycLevel === 'FULL' ? 'text-accent-green' :
                    user.kycLevel === 'BASIC' ? 'text-accent-yellow' : 'text-gray-500'
                  )}>{user.kycLevel}</span>
                </td>
                <td className="px-4 py-3 font-mono">${user.totalWagered || '0'}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs font-bold', user.isActive ? 'text-accent-green' : 'text-accent-red')}>
                    {user.isActive ? 'Active' : 'Banned'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    {user.isActive ? (
                      <button onClick={() => handleBan(user.id)} className="text-xs text-accent-red hover:underline">Ban</button>
                    ) : (
                      <button onClick={() => handleUnban(user.id)} className="text-xs text-accent-green hover:underline">Unban</button>
                    )}
                    <button onClick={() => handleChangeVip(user.id)} className="text-xs text-brand-400 hover:underline ml-2">VIP</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <button disabled={page <= 1} onClick={() => { setPage(page - 1); fetchUsers(page - 1, query); }} className="btn-secondary text-sm px-4">Prev</button>
        <span className="text-sm text-gray-400 self-center">Page {page}</span>
        <button disabled={page * 20 >= total} onClick={() => { setPage(page + 1); fetchUsers(page + 1, query); }} className="btn-secondary text-sm px-4">Next</button>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-surface-primary border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{selectedUser.username}</h2>
              <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Email:</span> {selectedUser.email}</div>
              <div><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{selectedUser.id}</span></div>
              <div><span className="text-gray-500">VIP:</span> <span className="text-brand-400 font-bold">{selectedUser.vipTier}</span></div>
              <div><span className="text-gray-500">KYC:</span> {selectedUser.kycLevel}</div>
              <div><span className="text-gray-500">2FA:</span> {selectedUser.twoFactorEnabled ? 'Enabled' : 'Disabled'}</div>
              <div><span className="text-gray-500">Role:</span> {selectedUser.role}</div>
            </div>

            {/* Wallets */}
            {selectedUser.wallets?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Wallets</h3>
                <div className="space-y-1">
                  {selectedUser.wallets.map((w: any) => (
                    <div key={w.id} className="flex justify-between text-sm bg-surface-tertiary rounded px-3 py-2">
                      <span>{w.currency}</span>
                      <span className="font-mono">{w.balance}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Bets */}
            {selectedUser.bets?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Recent Bets ({selectedUser.bets.length})</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedUser.bets.slice(0, 10).map((b: any) => (
                    <div key={b.id} className="flex justify-between text-xs bg-surface-tertiary rounded px-3 py-2">
                      <span className={cn('font-bold', b.status === 'WON' ? 'text-accent-green' : b.status === 'LOST' ? 'text-accent-red' : 'text-gray-400')}>{b.status}</span>
                      <span className="font-mono">{b.stake} {b.currency}</span>
                      <span className="text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
