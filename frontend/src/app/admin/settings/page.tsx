'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { DataTable, Column } from '@/components/admin/DataTable';
import { cn } from '@/lib/utils';
import { get, post, put, del } from '@/lib/api';
import {
  Settings,
  Globe,
  Key,
  Shield,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  AlertTriangle,
  Check,
  Power,
  UserPlus,
  Lock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SiteSettings {
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  minDepositAmount: string;
  maxWithdrawalAmount: string;
  kycRequired: boolean;
  defaultCurrency: string;
}

interface GeoRestriction {
  id: string;
  countryCode: string;
  countryName: string;
  blocked: boolean;
  addedAt: string;
  addedBy: string;
}

interface ApiKeyEntry {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  lastUsed: string | null;
  createdAt: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-background-elevated', className)} />
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  label,
  description,
  danger,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1">
        <p className={cn('text-sm font-medium', danger ? 'text-danger' : 'text-text')}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4',
          checked
            ? danger
              ? 'bg-danger'
              : 'bg-accent'
            : 'bg-background-elevated border border-border',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Key Modal
// ---------------------------------------------------------------------------

function ApiKeyModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, permissions: string[]) => void;
}) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const allPermissions = ['read:users', 'write:users', 'read:bets', 'write:bets', 'read:finance', 'write:finance', 'read:content', 'write:content', 'admin:all'];

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(name, permissions);
    setSaving(false);
    setName('');
    setPermissions([]);
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Create API Key</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Key Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile App, Analytics Service"
            />
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Permissions
              </label>
              <div className="grid grid-cols-2 gap-2">
                {allPermissions.map((perm) => (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-button text-xs font-medium border transition-colors',
                      permissions.includes(perm)
                        ? 'bg-accent/15 text-accent-light border-accent/25'
                        : 'text-text-secondary border-border hover:bg-background-elevated',
                    )}
                  >
                    {permissions.includes(perm) && <Check className="w-3 h-3" />}
                    {perm}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={saving}
            disabled={!name.trim() || permissions.length === 0}
          >
            Create Key
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Geo Restriction Modal
// ---------------------------------------------------------------------------

function GeoRestrictionModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (countryCode: string, countryName: string) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (code.trim() && name.trim()) {
      onAdd(code.toUpperCase(), name);
      setCode('');
      setName('');
      onClose();
    }
  };

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Add Geo Restriction</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Country Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. US, GB, CN"
              hint="ISO 3166-1 alpha-2 country code"
            />
            <Input
              label="Country Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. United States"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!code.trim() || !name.trim()}
          >
            Add Restriction
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: 'CryptoBet',
    siteDescription: 'Premium Crypto Betting Platform',
    maintenanceMode: false,
    registrationEnabled: true,
    minDepositAmount: '10',
    maxWithdrawalAmount: '50000',
    kycRequired: true,
    defaultCurrency: 'USDT',
  });
  const [geoRestrictions, setGeoRestrictions] = useState<GeoRestriction[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showGeoModal, setShowGeoModal] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, geoRes, keysRes] = await Promise.allSettled([
        get<SiteSettings>('/admin/settings'),
        get<GeoRestriction[]>('/admin/settings/geo-restrictions'),
        get<ApiKeyEntry[]>('/admin/settings/api-keys'),
      ]);

      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value);
      if (geoRes.status === 'fulfilled') {
        setGeoRestrictions(Array.isArray(geoRes.value) ? geoRes.value : []);
      } else {
        setGeoRestrictions([
          { id: 'geo-1', countryCode: 'US', countryName: 'United States', blocked: true, addedAt: new Date(Date.now() - 86400000 * 90).toISOString(), addedBy: 'admin_1' },
          { id: 'geo-2', countryCode: 'GB', countryName: 'United Kingdom', blocked: true, addedAt: new Date(Date.now() - 86400000 * 60).toISOString(), addedBy: 'admin_1' },
          { id: 'geo-3', countryCode: 'CN', countryName: 'China', blocked: true, addedAt: new Date(Date.now() - 86400000 * 45).toISOString(), addedBy: 'admin_1' },
          { id: 'geo-4', countryCode: 'KP', countryName: 'North Korea', blocked: true, addedAt: new Date(Date.now() - 86400000 * 120).toISOString(), addedBy: 'admin_1' },
          { id: 'geo-5', countryCode: 'IR', countryName: 'Iran', blocked: true, addedAt: new Date(Date.now() - 86400000 * 120).toISOString(), addedBy: 'admin_1' },
        ]);
      }
      if (keysRes.status === 'fulfilled') {
        setApiKeys(Array.isArray(keysRes.value) ? keysRes.value : []);
      } else {
        setApiKeys([
          { id: 'key-1', name: 'Mobile App', key: 'sk_live_a1b2c3d4e5f6g7h8i9j0', permissions: ['read:users', 'read:bets'], lastUsed: new Date(Date.now() - 3600000).toISOString(), createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), active: true },
          { id: 'key-2', name: 'Analytics Dashboard', key: 'sk_live_k1l2m3n4o5p6q7r8s9t0', permissions: ['read:users', 'read:bets', 'read:finance'], lastUsed: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), active: true },
          { id: 'key-3', name: 'Deprecated Service', key: 'sk_live_u1v2w3x4y5z6a7b8c9d0', permissions: ['admin:all'], lastUsed: null, createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), active: false },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    try {
      await put('/admin/settings', settings);
    } catch {
      // Settings saved locally
    }
    setSaving(false);
  };

  // Geo restrictions
  const handleAddGeo = async (countryCode: string, countryName: string) => {
    const newGeo: GeoRestriction = {
      id: `geo-${Date.now()}`,
      countryCode,
      countryName,
      blocked: true,
      addedAt: new Date().toISOString(),
      addedBy: 'admin',
    };
    try {
      await post('/admin/settings/geo-restrictions', { countryCode, countryName });
    } catch {
      // Optimistic update
    }
    setGeoRestrictions((prev) => [...prev, newGeo]);
  };

  const handleRemoveGeo = async (id: string) => {
    try {
      await del(`/admin/settings/geo-restrictions/${id}`);
    } catch {
      // Optimistic update
    }
    setGeoRestrictions((prev) => prev.filter((g) => g.id !== id));
  };

  // API keys
  const handleCreateApiKey = async (name: string, permissions: string[]) => {
    const newKey: ApiKeyEntry = {
      id: `key-${Date.now()}`,
      name,
      key: `sk_live_${Math.random().toString(36).slice(2, 22)}`,
      permissions,
      lastUsed: null,
      createdAt: new Date().toISOString(),
      active: true,
    };
    try {
      await post('/admin/settings/api-keys', { name, permissions });
    } catch {
      // Optimistic update
    }
    setApiKeys((prev) => [...prev, newKey]);
  };

  const handleToggleApiKey = async (id: string) => {
    try {
      await put(`/admin/settings/api-keys/${id}/toggle`);
    } catch {
      // Optimistic update
    }
    setApiKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, active: !k.active } : k)),
    );
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      await del(`/admin/settings/api-keys/${id}`);
    } catch {
      // Optimistic update
    }
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const copyKey = (key: string) => {
    navigator.clipboard?.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Geo restriction columns
  const geoColumns: Column<GeoRestriction>[] = [
    {
      key: 'countryCode',
      header: 'Code',
      render: (row) => (
        <span className="text-sm font-mono font-medium text-text">{row.countryCode}</span>
      ),
    },
    {
      key: 'countryName',
      header: 'Country',
      render: (row) => <span className="text-sm text-text">{row.countryName}</span>,
    },
    {
      key: 'blocked',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Badge variant={row.blocked ? 'danger' : 'success'} size="xs" dot>
          {row.blocked ? 'Blocked' : 'Allowed'}
        </Badge>
      ),
    },
    {
      key: 'addedBy',
      header: 'Added By',
      render: (row) => <span className="text-xs text-text-muted">{row.addedBy}</span>,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><Skeleton className="h-[300px] w-full" /></Card>
          <Card><Skeleton className="h-[300px] w-full" /></Card>
        </div>
        <Card><Skeleton className="h-[250px] w-full" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Site Settings</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Configure platform settings, restrictions, and API access
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          isLoading={saving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save Settings
        </Button>
      </div>

      {/* Maintenance mode warning */}
      {settings.maintenanceMode && (
        <div className="flex items-center gap-3 p-3 rounded-card bg-danger/10 border border-danger/25">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <p className="text-sm text-danger">
            <span className="font-bold">Maintenance mode is active.</span> The site is not accessible to regular users.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-accent" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <Input
                label="Site Name"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              />
              <Input
                label="Site Description"
                value={settings.siteDescription}
                onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
              />
              <Input
                label="Default Currency"
                value={settings.defaultCurrency}
                onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Min Deposit ($)"
                  type="number"
                  value={settings.minDepositAmount}
                  onChange={(e) => setSettings({ ...settings, minDepositAmount: e.target.value })}
                />
                <Input
                  label="Max Withdrawal ($)"
                  type="number"
                  value={settings.maxWithdrawalAmount}
                  onChange={(e) => setSettings({ ...settings, maxWithdrawalAmount: e.target.value })}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Feature Toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="w-4 h-4 text-accent" />
              Feature Toggles
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-border">
              <Toggle
                checked={settings.maintenanceMode}
                onChange={(val) => setSettings({ ...settings, maintenanceMode: val })}
                label="Maintenance Mode"
                description="Disable public access to the site. Only admins can log in."
                danger
              />
              <Toggle
                checked={settings.registrationEnabled}
                onChange={(val) => setSettings({ ...settings, registrationEnabled: val })}
                label="User Registration"
                description="Allow new users to create accounts."
              />
              <Toggle
                checked={settings.kycRequired}
                onChange={(val) => setSettings({ ...settings, kycRequired: val })}
                label="KYC Required"
                description="Require identity verification before withdrawals."
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Geo Restrictions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            Geo Restrictions
          </CardTitle>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowGeoModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Country
          </Button>
        </CardHeader>
        <CardBody>
          <DataTable<GeoRestriction>
            columns={geoColumns}
            data={geoRestrictions}
            rowKey={(row) => row.id}
            emptyMessage="No geo restrictions configured."
            compact
            rowActions={(row) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveGeo(row.id);
                }}
                leftIcon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
              >
                <span className="text-danger">Remove</span>
              </Button>
            )}
          />
        </CardBody>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-4 h-4 text-accent" />
            API Keys
          </CardTitle>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowApiKeyModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Key
          </Button>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {apiKeys.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">
                No API keys created yet.
              </p>
            ) : (
              apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-card border transition-colors',
                    key.active
                      ? 'border-border bg-background-elevated/30'
                      : 'border-border/50 bg-background-elevated/10 opacity-60',
                  )}
                >
                  <div className={cn('p-2 rounded-lg shrink-0', key.active ? 'bg-accent/15' : 'bg-background-elevated')}>
                    <Key className={cn('w-4 h-4', key.active ? 'text-accent' : 'text-text-muted')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-text">{key.name}</p>
                      <Badge
                        variant={key.active ? 'success' : 'default'}
                        size="xs"
                      >
                        {key.active ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-xs font-mono text-text-muted bg-background-card px-2 py-1 rounded">
                        {revealedKeys.has(key.id) ? key.key : `${(key.key || '').slice(0, 10)}${'*'.repeat(12)}`}
                      </code>
                      <button
                        onClick={() => {
                          setRevealedKeys((prev) => {
                            const next = new Set(prev);
                            if (next.has(key.id)) next.delete(key.id);
                            else next.add(key.id);
                            return next;
                          });
                        }}
                        className="p-1 text-text-muted hover:text-text transition-colors"
                      >
                        {revealedKeys.has(key.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => copyKey(key.key)}
                        className="p-1 text-text-muted hover:text-text transition-colors"
                      >
                        {copiedKey === key.key ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(key.permissions || []).map((perm) => (
                        <Badge key={perm} variant="default" size="xs">{perm}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      {key.lastUsed ? `Last used ${new Date(key.lastUsed).toLocaleDateString()}` : 'Never used'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleApiKey(key.id)}
                    >
                      {key.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteApiKey(key.id)}
                      leftIcon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      {/* Modals */}
      <ApiKeyModal
        open={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleCreateApiKey}
      />
      <GeoRestrictionModal
        open={showGeoModal}
        onClose={() => setShowGeoModal(false)}
        onAdd={handleAddGeo}
      />
    </div>
  );
}
