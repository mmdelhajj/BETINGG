'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/settings').then(({ data }) => {
      setConfig(data.data || {});
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const updateConfig = async (key: string, value: any) => {
    await api.put(`/admin/settings/${key}`, { value });
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Site Settings</h1>

      {/* Maintenance Mode */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold">Maintenance Mode</h2>
        <div className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
          <div>
            <p className="text-sm">Maintenance Mode</p>
            <p className="text-xs text-gray-500">When enabled, users see a maintenance page</p>
          </div>
          <button
            onClick={() => updateConfig('maintenance_mode', !config.maintenance_mode)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-colors',
              config.maintenance_mode ? 'bg-accent-red text-white' : 'bg-surface-tertiary text-gray-400 border border-border'
            )}
          >
            {config.maintenance_mode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Announcement Banner */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold">Announcement Banner</h2>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Banner Text</label>
          <input
            type="text"
            className="input"
            defaultValue={config.announcement_banner || ''}
            placeholder="Leave empty to hide banner"
            onBlur={(e) => updateConfig('announcement_banner', e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          {['info', 'warning', 'success'].map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio" name="banner_type"
                checked={config.announcement_type === type}
                onChange={() => updateConfig('announcement_type', type)}
              />
              <span className="capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold">Languages</h2>
        <p className="text-xs text-gray-500">Default language and enabled translations.</p>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Default Language</label>
          <select className="input w-60" defaultValue={config.default_language || 'en'}>
            {['en', 'es', 'de', 'it', 'fr', 'sv', 'nl', 'el', 'hu', 'tr', 'id', 'pl', 'pt', 'pt-BR', 'ru', 'ko', 'ja', 'th', 'vi'].map((lang) => (
              <option key={lang} value={lang}>{lang.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* API Rate Limits */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold">API Rate Limits</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Feed (req/sec)</label>
            <input type="number" className="input" defaultValue="10" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Trading (req/sec)</label>
            <input type="number" className="input" defaultValue="1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Account (req/sec)</label>
            <input type="number" className="input" defaultValue="5" />
          </div>
        </div>
        <button className="btn-primary text-sm">Save Rate Limits</button>
      </div>

      {/* Legal Content */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold">Legal & Compliance</h2>
        <p className="text-xs text-gray-500">Edit terms of service, privacy policy, and responsible gambling content.</p>
        <div className="space-y-2">
          {['Terms of Service', 'Privacy Policy', 'Responsible Gambling Policy', 'Cookie Policy'].map((doc) => (
            <div key={doc} className="flex items-center justify-between p-3 bg-surface-tertiary rounded-lg">
              <span className="text-sm">{doc}</span>
              <button className="text-xs text-brand-400 hover:underline">Edit</button>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Audit Log</h2>
          <a href="/admin/audit-log" className="text-xs text-brand-400 hover:underline">View All</a>
        </div>
        <p className="text-center text-gray-500 text-sm py-4">Recent admin actions will appear here</p>
      </div>
    </div>
  );
}
