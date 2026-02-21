'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatDate, formatRelativeDate } from '@/lib/utils';
import { get, post, put, del } from '@/lib/api';
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Activity,
  Database,
  Zap,
  History,
  Server,
  Key,
  Globe,
  TrendingUp,
  BarChart3,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderType = 'THE_ODDS_API' | 'GOALSERVE' | 'CUSTOM';

interface OddsProvider {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  priority: number;
  syncInterval: number;
  active: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

interface SyncConfig {
  globalSyncInterval: number;
  autoSyncEnabled: boolean;
  preMatchMargin: number;
  liveMargin: number;
}

interface SyncStatus {
  lastSyncAt: string | null;
  nextScheduledSync: string | null;
  totalSyncedEvents: number;
  totalSyncedMarkets: number;
  totalSyncedSelections: number;
  errorCount: number;
  isRunning: boolean;
}

interface SyncLogEntry {
  id: string;
  timestamp: string;
  providerName: string;
  providerType: ProviderType;
  eventsSynced: number;
  marketsSynced: number;
  selectionsSynced: number;
  errors: number;
  duration: number;
  status: 'success' | 'partial' | 'failed';
}

interface ProviderFormState {
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  priority: number;
  syncInterval: number;
}

type OddsTab = 'providers' | 'config' | 'history';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROVIDERS: OddsProvider[] = [
  {
    id: 'prov-1',
    name: 'The Odds API',
    type: 'THE_ODDS_API',
    apiKey: 'sk_live_a3f8...x9k2',
    baseUrl: 'https://api.the-odds-api.com/v4',
    priority: 1,
    syncInterval: 60,
    active: true,
    lastSyncAt: new Date(Date.now() - 180_000).toISOString(),
    createdAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'prov-2',
    name: 'Goalserve Sports',
    type: 'GOALSERVE',
    apiKey: 'gs_prod_7b2e...m4p1',
    baseUrl: 'https://www.goalserve.com/getfeed',
    priority: 2,
    syncInterval: 120,
    active: true,
    lastSyncAt: new Date(Date.now() - 420_000).toISOString(),
    createdAt: '2025-07-15T14:30:00Z',
  },
  {
    id: 'prov-3',
    name: 'BetRadar Feed',
    type: 'CUSTOM',
    apiKey: 'br_key_9c1d...z6w8',
    baseUrl: 'https://api.betradar.com/v1',
    priority: 3,
    syncInterval: 300,
    active: false,
    lastSyncAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: '2025-09-20T09:00:00Z',
  },
];

const MOCK_SYNC_CONFIG: SyncConfig = {
  globalSyncInterval: 60,
  autoSyncEnabled: true,
  preMatchMargin: 5.5,
  liveMargin: 8.0,
};

const MOCK_SYNC_STATUS: SyncStatus = {
  lastSyncAt: new Date(Date.now() - 180_000).toISOString(),
  nextScheduledSync: new Date(Date.now() + 420_000).toISOString(),
  totalSyncedEvents: 1_247,
  totalSyncedMarkets: 8_432,
  totalSyncedSelections: 26_891,
  errorCount: 3,
  isRunning: false,
};

const MOCK_SYNC_LOGS: SyncLogEntry[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 180_000).toISOString(),
    providerName: 'The Odds API',
    providerType: 'THE_ODDS_API',
    eventsSynced: 142,
    marketsSynced: 856,
    selectionsSynced: 2_568,
    errors: 0,
    duration: 4_320,
    status: 'success',
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 420_000).toISOString(),
    providerName: 'Goalserve Sports',
    providerType: 'GOALSERVE',
    eventsSynced: 98,
    marketsSynced: 412,
    selectionsSynced: 1_236,
    errors: 1,
    duration: 6_780,
    status: 'partial',
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    providerName: 'The Odds API',
    providerType: 'THE_ODDS_API',
    eventsSynced: 138,
    marketsSynced: 831,
    selectionsSynced: 2_493,
    errors: 0,
    duration: 3_950,
    status: 'success',
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 7_200_000).toISOString(),
    providerName: 'The Odds API',
    providerType: 'THE_ODDS_API',
    eventsSynced: 145,
    marketsSynced: 870,
    selectionsSynced: 2_610,
    errors: 0,
    duration: 4_100,
    status: 'success',
  },
  {
    id: 'log-5',
    timestamp: new Date(Date.now() - 10_800_000).toISOString(),
    providerName: 'BetRadar Feed',
    providerType: 'CUSTOM',
    eventsSynced: 0,
    marketsSynced: 0,
    selectionsSynced: 0,
    errors: 5,
    duration: 12_400,
    status: 'failed',
  },
  {
    id: 'log-6',
    timestamp: new Date(Date.now() - 14_400_000).toISOString(),
    providerName: 'Goalserve Sports',
    providerType: 'GOALSERVE',
    eventsSynced: 102,
    marketsSynced: 430,
    selectionsSynced: 1_290,
    errors: 0,
    duration: 5_900,
    status: 'success',
  },
  {
    id: 'log-7',
    timestamp: new Date(Date.now() - 18_000_000).toISOString(),
    providerName: 'The Odds API',
    providerType: 'THE_ODDS_API',
    eventsSynced: 140,
    marketsSynced: 845,
    selectionsSynced: 2_535,
    errors: 2,
    duration: 5_200,
    status: 'partial',
  },
  {
    id: 'log-8',
    timestamp: new Date(Date.now() - 21_600_000).toISOString(),
    providerName: 'The Odds API',
    providerType: 'THE_ODDS_API',
    eventsSynced: 136,
    marketsSynced: 820,
    selectionsSynced: 2_460,
    errors: 0,
    duration: 3_800,
    status: 'success',
  },
];

// ---------------------------------------------------------------------------
// Helper: mask API key
// ---------------------------------------------------------------------------

function maskApiKey(key: string): string {
  if (!key || key.length < 10) return '****';
  const prefix = key.slice(0, key.indexOf('_') > -1 ? key.indexOf('_', key.indexOf('_') + 1) + 1 : 8);
  return `${prefix}${'*'.repeat(8)}`;
}

// ---------------------------------------------------------------------------
// Helper: format duration
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const seconds = (ms / 1_000).toFixed(1);
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// Helper: provider type badge color
// ---------------------------------------------------------------------------

function providerTypeBadge(type: ProviderType) {
  switch (type) {
    case 'THE_ODDS_API':
      return 'accent';
    case 'GOALSERVE':
      return 'info';
    case 'CUSTOM':
      return 'default';
  }
}

// ---------------------------------------------------------------------------
// Default form
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER_FORM: ProviderFormState = {
  name: '',
  type: 'THE_ODDS_API',
  apiKey: '',
  baseUrl: '',
  priority: 1,
  syncInterval: 60,
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminOddsPage() {
  const [activeTab, setActiveTab] = useState<OddsTab>('providers');
  const [loading, setLoading] = useState(true);

  // Providers state
  const [providers, setProviders] = useState<OddsProvider[]>([]);
  const [providerModal, setProviderModal] = useState<OddsProvider | null>(null);
  const [isNewProvider, setIsNewProvider] = useState(false);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(DEFAULT_PROVIDER_FORM);

  // Sync config state
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(MOCK_SYNC_CONFIG);
  const [configDirty, setConfigDirty] = useState(false);

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(MOCK_SYNC_STATUS);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync history state
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<OddsProvider | null>(null);

  // -------------------------------------------------------------------------
  // Fetchers
  // -------------------------------------------------------------------------

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>('/admin/odds/providers');
      setProviders(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setProviders(MOCK_PROVIDERS);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSyncConfig = useCallback(async () => {
    try {
      const res = await get<SyncConfig>('/admin/odds/config');
      setSyncConfig(res);
    } catch {
      setSyncConfig(MOCK_SYNC_CONFIG);
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await get<SyncStatus>('/admin/odds/sync/status');
      setSyncStatus(res);
    } catch {
      setSyncStatus(MOCK_SYNC_STATUS);
    }
  }, []);

  const fetchSyncLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>('/admin/odds/sync/logs');
      setSyncLogs(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setSyncLogs(MOCK_SYNC_LOGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
    fetchSyncConfig();
    fetchSyncStatus();
  }, [fetchProviders, fetchSyncConfig, fetchSyncStatus]);

  useEffect(() => {
    if (activeTab === 'history') fetchSyncLogs();
  }, [activeTab, fetchSyncLogs]);

  // Refresh sync status periodically
  useEffect(() => {
    const interval = setInterval(fetchSyncStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  // -------------------------------------------------------------------------
  // Handlers: Providers
  // -------------------------------------------------------------------------

  const handleOpenNewProvider = () => {
    setIsNewProvider(true);
    setProviderForm(DEFAULT_PROVIDER_FORM);
    setProviderModal({} as OddsProvider);
  };

  const handleOpenEditProvider = (provider: OddsProvider) => {
    setIsNewProvider(false);
    setProviderForm({
      name: provider.name,
      type: provider.type,
      apiKey: '',
      baseUrl: provider.baseUrl,
      priority: provider.priority,
      syncInterval: provider.syncInterval,
    });
    setProviderModal(provider);
  };

  const handleSaveProvider = async () => {
    setActionLoading('save-provider');
    try {
      if (isNewProvider) {
        const created = await post<OddsProvider>('/admin/odds/providers', providerForm);
        setProviders((prev) => [...prev, created]);
      } else if (providerModal?.id) {
        const payload: Record<string, unknown> = { ...providerForm };
        if (!payload.apiKey) delete payload.apiKey;
        const updated = await put<OddsProvider>(`/admin/odds/providers/${providerModal.id}`, payload);
        setProviders((prev) => prev.map((p) => (p.id === providerModal.id ? updated : p)));
      }
    } catch {
      // Optimistic update for demo
      if (isNewProvider) {
        const newProv: OddsProvider = {
          id: `prov-${Date.now()}`,
          ...providerForm,
          active: true,
          lastSyncAt: null,
          createdAt: new Date().toISOString(),
        };
        setProviders((prev) => [...prev, newProv]);
      } else if (providerModal?.id) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerModal.id
              ? { ...p, name: providerForm.name, type: providerForm.type, baseUrl: providerForm.baseUrl, priority: providerForm.priority, syncInterval: providerForm.syncInterval }
              : p,
          ),
        );
      }
    } finally {
      setActionLoading(null);
      setProviderModal(null);
    }
  };

  const handleToggleProvider = async (provider: OddsProvider) => {
    setActionLoading(`toggle-${provider.id}`);
    try {
      await put(`/admin/odds/providers/${provider.id}`, { active: !provider.active });
    } catch {
      // proceed with optimistic update
    } finally {
      setProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? { ...p, active: !p.active } : p)),
      );
      setActionLoading(null);
    }
  };

  const handleDeleteProvider = async () => {
    if (!deleteTarget) return;
    setActionLoading(`delete-${deleteTarget.id}`);
    try {
      await del(`/admin/odds/providers/${deleteTarget.id}`);
    } catch {
      // proceed with optimistic update
    } finally {
      setProviders((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setActionLoading(null);
      setDeleteTarget(null);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Sync config
  // -------------------------------------------------------------------------

  const handleSyncConfigChange = <K extends keyof SyncConfig>(key: K, value: SyncConfig[K]) => {
    setSyncConfig((prev) => ({ ...prev, [key]: value }));
    setConfigDirty(true);
  };

  const handleSaveSyncConfig = async () => {
    setConfigSaving(true);
    try {
      await put('/admin/odds/config', syncConfig);
    } catch {
      // silent — config is already updated locally
    } finally {
      setConfigSaving(false);
      setConfigDirty(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Manual sync
  // -------------------------------------------------------------------------

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await post('/admin/odds/sync/trigger');
      // Refresh status after a short delay
      setTimeout(() => {
        fetchSyncStatus();
        setIsSyncing(false);
      }, 3_000);
    } catch {
      // Simulate sync completing
      setTimeout(() => {
        setSyncStatus((prev) => ({
          ...prev,
          lastSyncAt: new Date().toISOString(),
          nextScheduledSync: new Date(Date.now() + syncConfig.globalSyncInterval * 1_000).toISOString(),
          totalSyncedEvents: prev.totalSyncedEvents + 142,
          totalSyncedMarkets: prev.totalSyncedMarkets + 856,
          totalSyncedSelections: prev.totalSyncedSelections + 2_568,
        }));
        setIsSyncing(false);
      }, 3_000);
    }
  };

  // -------------------------------------------------------------------------
  // Tab definitions
  // -------------------------------------------------------------------------

  const tabs: { key: OddsTab; label: string; icon: React.ElementType }[] = [
    { key: 'providers', label: 'Providers', icon: Server },
    { key: 'config', label: 'Configuration', icon: Settings },
    { key: 'history', label: 'Sync History', icon: History },
  ];

  // -------------------------------------------------------------------------
  // Render: Sync Status Panel (always visible)
  // -------------------------------------------------------------------------

  const renderSyncStatusPanel = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider">Last Sync</span>
        </div>
        <p className="text-sm font-medium text-text font-mono">
          {syncStatus.lastSyncAt ? formatRelativeDate(syncStatus.lastSyncAt) : 'Never'}
        </p>
      </Card>

      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-3.5 h-3.5 text-info" />
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider">Next Sync</span>
        </div>
        <p className="text-sm font-medium text-text font-mono">
          {syncStatus.nextScheduledSync ? formatRelativeDate(syncStatus.nextScheduledSync) : 'N/A'}
        </p>
      </Card>

      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider">Events</span>
        </div>
        <p className="text-sm font-bold text-text font-mono">{Number(syncStatus?.totalSyncedEvents ?? 0).toLocaleString()}</p>
      </Card>

      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-3.5 h-3.5 text-accent" />
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider">Markets</span>
        </div>
        <p className="text-sm font-bold text-text font-mono">{Number(syncStatus?.totalSyncedMarkets ?? 0).toLocaleString()}</p>
      </Card>

      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-3.5 h-3.5 text-info" />
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider">Selections</span>
        </div>
        <p className="text-sm font-bold text-text font-mono">{Number(syncStatus?.totalSyncedSelections ?? 0).toLocaleString()}</p>
      </Card>

      <Card className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-3.5 h-3.5 text-danger" />
          <span className="text-[10px] text-text-muted uppercase font-medium tracking-wider">Errors</span>
        </div>
        <p className={cn('text-sm font-bold font-mono', syncStatus.errorCount > 0 ? 'text-danger' : 'text-success')}>
          {syncStatus.errorCount}
        </p>
      </Card>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: Providers Table
  // -------------------------------------------------------------------------

  const renderProvidersTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{providers.length} provider{providers.length !== 1 ? 's' : ''} configured</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={handleOpenNewProvider}
          >
            Add Provider
          </Button>
        </div>
      </div>

      <Card noPadding>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-elevated/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Provider</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">API Key</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Priority</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Interval</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Last Sync</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.id} className="border-b border-border/50 hover:bg-background-elevated/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-text-muted shrink-0" />
                        <span className="text-text font-medium">{provider.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={providerTypeBadge(provider.type) as any} size="xs">
                        {(provider.type || '').replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-text-muted">{maskApiKey(provider.apiKey)}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-background-elevated text-xs font-bold text-text">
                        {provider.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-text-muted text-xs font-mono">{provider.syncInterval}s</td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant={provider.active ? 'success' : 'default'}
                        size="xs"
                        dot
                        pulse={provider.active}
                      >
                        {provider.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-xs text-text-muted">
                      {provider.lastSyncAt ? formatRelativeDate(provider.lastSyncAt) : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditProvider(provider)}
                          title="Edit provider"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <button
                          onClick={() => handleToggleProvider(provider)}
                          className="p-1 rounded-button hover:bg-background-elevated transition-colors"
                          title={provider.active ? 'Deactivate' : 'Activate'}
                        >
                          {provider.active ? (
                            <ToggleRight className="w-6 h-6 text-success" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-text-muted" />
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger"
                          onClick={() => setDeleteTarget(provider)}
                          title="Delete provider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {providers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-text-muted">
                      No odds providers configured. Click "Add Provider" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: Config tab
  // -------------------------------------------------------------------------

  const renderConfigTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sync Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Configuration</CardTitle>
        </CardHeader>

        <div className="space-y-5">
          {/* Auto-sync toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Auto-Sync</p>
              <p className="text-xs text-text-muted mt-0.5">Automatically sync odds from providers on schedule</p>
            </div>
            <button onClick={() => handleSyncConfigChange('autoSyncEnabled', !syncConfig.autoSyncEnabled)}>
              {syncConfig.autoSyncEnabled ? (
                <ToggleRight className="w-8 h-8 text-success" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-text-muted" />
              )}
            </button>
          </div>

          {/* Global sync interval */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Global Sync Interval (seconds)
            </label>
            <Input
              type="number"
              value={String(syncConfig.globalSyncInterval)}
              onChange={(e) => handleSyncConfigChange('globalSyncInterval', parseInt(e.target.value) || 60)}
              className="bg-background"
              hint="How often to sync odds from all providers (minimum 30s)"
            />
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveSyncConfig}
              isLoading={configSaving}
              disabled={!configDirty}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </Card>

      {/* Margin Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Margin Settings</CardTitle>
        </CardHeader>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Pre-Match Margin (%)
            </label>
            <Input
              type="number"
              step="0.1"
              value={String(syncConfig.preMatchMargin)}
              onChange={(e) => handleSyncConfigChange('preMatchMargin', parseFloat(e.target.value) || 0)}
              className="bg-background"
              suffixText="%"
              hint="Margin applied to pre-match odds. Higher values = more house edge."
            />
            <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${Math.min(syncConfig.preMatchMargin * 5, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Live Margin (%)
            </label>
            <Input
              type="number"
              step="0.1"
              value={String(syncConfig.liveMargin)}
              onChange={(e) => handleSyncConfigChange('liveMargin', parseFloat(e.target.value) || 0)}
              className="bg-background"
              suffixText="%"
              hint="Margin applied to live in-play odds. Typically higher than pre-match."
            />
            <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-warning rounded-full transition-all duration-300"
                style={{ width: `${Math.min(syncConfig.liveMargin * 5, 100)}%` }}
              />
            </div>
          </div>

          <div className="p-3 bg-background rounded-card border border-border">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-text">Implied Overround</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Pre-match: {(100 + Number(syncConfig.preMatchMargin || 0)).toFixed(1)}% | Live: {(100 + Number(syncConfig.liveMargin || 0)).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveSyncConfig}
              isLoading={configSaving}
              disabled={!configDirty}
            >
              Save Margins
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render: Sync History tab
  // -------------------------------------------------------------------------

  const renderHistoryTab = () => (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Showing {syncLogs.length} recent sync operations
      </p>

      <Card noPadding>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-elevated/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Timestamp</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Provider</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Events</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Markets</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Selections</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Errors</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Duration</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-background-elevated/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-text text-xs font-medium">{formatDate(log.timestamp, 'MMM d, HH:mm:ss')}</p>
                        <p className="text-[11px] text-text-muted">{formatRelativeDate(log.timestamp)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={providerTypeBadge(log.providerType) as any} size="xs">
                          {(log.providerType || '').replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-text-muted text-xs">{log.providerName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {log.status === 'success' && (
                        <Badge variant="success" size="xs" dot>Success</Badge>
                      )}
                      {log.status === 'partial' && (
                        <Badge variant="warning" size="xs" dot>Partial</Badge>
                      )}
                      {log.status === 'failed' && (
                        <Badge variant="danger" size="xs" dot>Failed</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-text">
                      {Number(log.eventsSynced ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-text">
                      {Number(log.marketsSynced ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-text">
                      {Number(log.selectionsSynced ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={cn('font-mono', log.errors > 0 ? 'text-danger font-medium' : 'text-text-muted')}>
                        {log.errors}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-text-muted text-xs">
                      {formatDuration(log.duration)}
                    </td>
                  </tr>
                ))}
                {syncLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-text-muted">
                      No sync history available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">Odds Management</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Configure odds providers, sync settings, and margin controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus.isRunning || isSyncing ? (
            <Badge variant="warning" size="md" dot pulse>Sync in progress</Badge>
          ) : syncStatus.errorCount > 0 ? (
            <Badge variant="danger" size="md" dot>{syncStatus.errorCount} error{syncStatus.errorCount !== 1 ? 's' : ''}</Badge>
          ) : (
            <Badge variant="success" size="md" dot>All systems healthy</Badge>
          )}
        </div>
      </div>

      {/* Sync status cards */}
      {renderSyncStatusPanel()}

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === key ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'providers' && renderProvidersTab()}
      {activeTab === 'config' && renderConfigTab()}
      {activeTab === 'history' && renderHistoryTab()}

      {/* Add / Edit Provider Modal */}
      <Modal open={!!providerModal} onOpenChange={() => setProviderModal(null)}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>{isNewProvider ? 'Add Odds Provider' : 'Edit Odds Provider'}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Provider Name"
                placeholder="e.g. The Odds API"
                value={providerForm.name}
                onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                className="bg-background"
                prefixIcon={<Globe className="w-4 h-4" />}
              />

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Provider Type
                </label>
                <select
                  value={providerForm.type}
                  onChange={(e) => setProviderForm({ ...providerForm, type: e.target.value as ProviderType })}
                  className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                >
                  <option value="THE_ODDS_API">THE ODDS API</option>
                  <option value="GOALSERVE">GOALSERVE</option>
                  <option value="CUSTOM">CUSTOM</option>
                </select>
              </div>

              <Input
                label={isNewProvider ? 'API Key' : 'API Key (leave blank to keep current)'}
                type="password"
                placeholder={isNewProvider ? 'Enter API key' : 'Leave blank to keep unchanged'}
                value={providerForm.apiKey}
                onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
                className="bg-background"
                prefixIcon={<Key className="w-4 h-4" />}
              />

              <Input
                label="Base URL"
                placeholder="https://api.example.com/v1"
                value={providerForm.baseUrl}
                onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
                className="bg-background"
                prefixIcon={<Globe className="w-4 h-4" />}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Priority"
                  type="number"
                  min={1}
                  max={99}
                  value={String(providerForm.priority)}
                  onChange={(e) => setProviderForm({ ...providerForm, priority: parseInt(e.target.value) || 1 })}
                  className="bg-background"
                  hint="Lower = higher priority"
                />
                <Input
                  label="Sync Interval (seconds)"
                  type="number"
                  min={30}
                  value={String(providerForm.syncInterval)}
                  onChange={(e) => setProviderForm({ ...providerForm, syncInterval: parseInt(e.target.value) || 60 })}
                  className="bg-background"
                  hint="Min 30 seconds"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setProviderModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={actionLoading === 'save-provider'}
              onClick={handleSaveProvider}
              disabled={!providerForm.name || (isNewProvider && !providerForm.apiKey)}
            >
              {isNewProvider ? 'Add Provider' : 'Save Changes'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Delete Provider</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-danger/15 shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div>
                <p className="text-sm text-text">
                  Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
                </p>
                <p className="text-xs text-text-muted mt-1">
                  This action cannot be undone. All sync history for this provider will also be removed.
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={actionLoading === `delete-${deleteTarget?.id}`}
              onClick={handleDeleteProvider}
            >
              Delete Provider
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
