'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatDate, formatCurrency } from '@/lib/utils';
import { get, post, put, del } from '@/lib/api';
import {
  Gift,
  Plus,
  Edit,
  Trash2,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Search,
  Users,
  DollarSign,
  Tag,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Promotion {
  id: string;
  title: string;
  type: 'deposit_bonus' | 'free_bet' | 'odds_boost' | 'cashback' | 'tournament' | 'custom';
  description: string;
  conditions: string;
  rewardType: 'percentage' | 'fixed';
  rewardValue: number;
  maxBonus?: number;
  wageringRequirement: number;
  startDate: string;
  endDate: string;
  active: boolean;
  code?: string;
  claims: number;
  totalCost: number;
}

interface PromoCode {
  id: string;
  code: string;
  promotionId: string;
  promotionTitle: string;
  maxUses: number;
  currentUses: number;
  active: boolean;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// Promotions Page
// ---------------------------------------------------------------------------

export default function AdminPromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [activeSection, setActiveSection] = useState<'promotions' | 'codes'>('promotions');

  // Modal state
  const [promoModal, setPromoModal] = useState(false);
  const [isNewPromo, setIsNewPromo] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [promoForm, setPromoForm] = useState({
    title: '',
    type: 'deposit_bonus' as Promotion['type'],
    description: '',
    conditions: '',
    rewardType: 'percentage' as 'percentage' | 'fixed',
    rewardValue: 0,
    maxBonus: 0,
    wageringRequirement: 5,
    startDate: '',
    endDate: '',
    code: '',
  });

  const [codeModal, setCodeModal] = useState(false);
  const [codeForm, setCodeForm] = useState({
    code: '',
    promotionId: '',
    maxUses: 100,
    expiresAt: '',
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const totalPages = 3;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [promosRes, codesRes] = await Promise.allSettled([
        get<any>('/admin/promotions'),
        get<any>('/admin/promo-codes'),
      ]);

      if (promosRes.status === 'fulfilled') {
        const v = promosRes.value;
        setPromotions(Array.isArray(v) ? v : v?.data || []);
      }
      else {
        setPromotions([
          { id: 'p-1', title: 'Welcome Deposit Bonus', type: 'deposit_bonus', description: '100% match on first deposit up to $500', conditions: 'New users only, min deposit $20', rewardType: 'percentage', rewardValue: 100, maxBonus: 500, wageringRequirement: 5, startDate: '2025-01-01T00:00:00Z', endDate: '2025-06-30T23:59:59Z', active: true, claims: 1245, totalCost: 124500 },
          { id: 'p-2', title: 'Weekend Free Bets', type: 'free_bet', description: '$10 free bet every weekend', conditions: 'Must have wagered $100+ in the week', rewardType: 'fixed', rewardValue: 10, wageringRequirement: 3, startDate: '2025-01-01T00:00:00Z', endDate: '2025-12-31T23:59:59Z', active: true, claims: 842, totalCost: 8420 },
          { id: 'p-3', title: 'Odds Boost - Champions League', type: 'odds_boost', description: '25% odds boost on Champions League matches', conditions: 'Max bet $50, pre-match only', rewardType: 'percentage', rewardValue: 25, wageringRequirement: 1, startDate: '2025-02-01T00:00:00Z', endDate: '2025-05-31T23:59:59Z', active: true, claims: 328, totalCost: 4920 },
          { id: 'p-4', title: 'Weekly Cashback', type: 'cashback', description: '10% cashback on weekly losses up to $200', conditions: 'Min $50 wagered', rewardType: 'percentage', rewardValue: 10, maxBonus: 200, wageringRequirement: 2, startDate: '2025-01-01T00:00:00Z', endDate: '2025-12-31T23:59:59Z', active: true, code: 'CASHBACK10', claims: 2150, totalCost: 86000 },
          { id: 'p-5', title: 'Christmas Special', type: 'deposit_bonus', description: '200% deposit match', conditions: 'Min deposit $50', rewardType: 'percentage', rewardValue: 200, maxBonus: 1000, wageringRequirement: 8, startDate: '2024-12-20T00:00:00Z', endDate: '2024-12-31T23:59:59Z', active: false, code: 'XMAS2024', claims: 580, totalCost: 116000 },
        ]);
      }

      if (codesRes.status === 'fulfilled') {
        const v = codesRes.value;
        setPromoCodes(Array.isArray(v) ? v : v?.data || []);
      }
      else {
        setPromoCodes([
          { id: 'pc-1', code: 'WELCOME100', promotionId: 'p-1', promotionTitle: 'Welcome Deposit Bonus', maxUses: 10000, currentUses: 1245, active: true, expiresAt: '2025-06-30T23:59:59Z' },
          { id: 'pc-2', code: 'CASHBACK10', promotionId: 'p-4', promotionTitle: 'Weekly Cashback', maxUses: 5000, currentUses: 2150, active: true, expiresAt: '2025-12-31T23:59:59Z' },
          { id: 'pc-3', code: 'XMAS2024', promotionId: 'p-5', promotionTitle: 'Christmas Special', maxUses: 2000, currentUses: 580, active: false, expiresAt: '2024-12-31T23:59:59Z' },
          { id: 'pc-4', code: 'VIP50', promotionId: 'p-1', promotionTitle: 'VIP Exclusive', maxUses: 100, currentUses: 42, active: true, expiresAt: '2025-03-31T23:59:59Z' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSavePromo = async () => {
    setActionLoading(true);
    try {
      if (isNewPromo) {
        await post('/admin/promotions', promoForm);
      } else if (editingPromo) {
        await put(`/admin/promotions/${editingPromo.id}`, promoForm);
      }
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); setPromoModal(false); setEditingPromo(null); }
  };

  const handleDeletePromo = async (id: string) => {
    try {
      await del(`/admin/promotions/${id}`);
      setPromotions((prev) => prev.filter((p) => p.id !== id));
    } catch { /* silent */ }
  };

  const handleTogglePromo = async (promo: Promotion) => {
    try {
      await put(`/admin/promotions/${promo.id}`, { active: !promo.active });
      setPromotions((prev) =>
        prev.map((p) => p.id === promo.id ? { ...p, active: !p.active } : p),
      );
    } catch { /* silent */ }
  };

  const handleCreateCode = async () => {
    setActionLoading(true);
    try {
      await post('/admin/promo-codes', codeForm);
      fetchData();
    } catch { /* silent */ }
    finally { setActionLoading(false); setCodeModal(false); }
  };

  const handleToggleCode = async (code: PromoCode) => {
    try {
      await put(`/admin/promo-codes/${code.id}`, { active: !code.active });
      setPromoCodes((prev) =>
        prev.map((c) => c.id === code.id ? { ...c, active: !c.active } : c),
      );
    } catch { /* silent */ }
  };

  const promoTypeLabels: Record<string, string> = {
    deposit_bonus: 'Deposit Bonus',
    free_bet: 'Free Bet',
    odds_boost: 'Odds Boost',
    cashback: 'Cashback',
    tournament: 'Tournament',
    custom: 'Custom',
  };

  const promoTypeColor = (type: string) => {
    switch (type) { case 'deposit_bonus': return 'success'; case 'free_bet': return 'info'; case 'odds_boost': return 'accent'; case 'cashback': return 'warning'; case 'tournament': return 'danger'; default: return 'default'; }
  };

  const totalClaims = (promotions || []).reduce((s, p) => s + (p.claims || 0), 0);
  const totalCost = (promotions || []).reduce((s, p) => s + (p.totalCost || 0), 0);
  const activePromos = promotions.filter((p) => p.active).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Promotions</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage promotional offers and codes</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setIsNewPromo(true);
            setEditingPromo(null);
            setPromoForm({ title: '', type: 'deposit_bonus', description: '', conditions: '', rewardType: 'percentage', rewardValue: 0, maxBonus: 0, wageringRequirement: 5, startDate: '', endDate: '', code: '' });
            setPromoModal(true);
          }}
        >
          Create Promotion
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-accent" />
            <div>
              <p className="text-xs text-text-muted">Active Promos</p>
              <p className="text-lg font-bold text-text">{activePromos}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-info" />
            <div>
              <p className="text-xs text-text-muted">Total Claims</p>
              <p className="text-lg font-bold text-text">{Number(totalClaims ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-danger" />
            <div>
              <p className="text-xs text-text-muted">Total Cost</p>
              <p className="text-lg font-bold font-mono text-text">${Number(totalCost ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-success" />
            <div>
              <p className="text-xs text-text-muted">Active Codes</p>
              <p className="text-lg font-bold text-text">{promoCodes.filter((c) => c.active).length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Section Toggle */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveSection('promotions')}
          className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors', activeSection === 'promotions' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text')}
        >
          Promotions
        </button>
        <button
          onClick={() => setActiveSection('codes')}
          className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors', activeSection === 'codes' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text')}
        >
          Promo Codes
        </button>
      </div>

      {/* Promotions Section */}
      {activeSection === 'promotions' && (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-elevated/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Promotion</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Type</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Reward</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Wagering Req</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Period</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Claims</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Cost</th>
                  <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Active</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promo) => (
                  <tr key={promo.id} className={cn('border-b border-border/50 hover:bg-background-elevated/30', !promo.active && 'opacity-60')}>
                    <td className="py-3 px-4">
                      <p className="text-text font-medium">{promo.title}</p>
                      <p className="text-xs text-text-muted line-clamp-1">{promo.description}</p>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={promoTypeColor(promo.type) as any} size="xs">
                        {promoTypeLabels[promo.type]}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-text">
                      {promo.rewardType === 'percentage' ? `${promo.rewardValue}%` : `$${promo.rewardValue}`}
                      {promo.maxBonus ? <span className="text-xs text-text-muted block">max ${promo.maxBonus}</span> : null}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-text-secondary">{promo.wageringRequirement}x</td>
                    <td className="py-3 px-3 text-xs text-text-muted">
                      {formatDate(promo.startDate, 'MMM d')} - {formatDate(promo.endDate, 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-text">{Number(promo.claims ?? 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-mono text-danger">${Number(promo.totalCost || 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-center">
                      <button onClick={() => handleTogglePromo(promo)}>
                        {promo.active ? <ToggleRight className="w-6 h-6 text-success mx-auto" /> : <ToggleLeft className="w-6 h-6 text-text-muted mx-auto" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setIsNewPromo(false);
                          setEditingPromo(promo);
                          setPromoForm({
                            title: promo.title, type: promo.type, description: promo.description, conditions: promo.conditions,
                            rewardType: promo.rewardType, rewardValue: promo.rewardValue, maxBonus: promo.maxBonus || 0,
                            wageringRequirement: promo.wageringRequirement, startDate: (promo.startDate || '').slice(0, 16),
                            endDate: (promo.endDate || '').slice(0, 16), code: promo.code || '',
                          });
                          setPromoModal(true);
                        }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleDeletePromo(promo.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Promo Codes Section */}
      {activeSection === 'codes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => {
              setCodeForm({ code: '', promotionId: '', maxUses: 100, expiresAt: '' });
              setCodeModal(true);
            }}>
              Generate Code
            </Button>
          </div>
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Code</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Promotion</th>
                    <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Uses</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Expires</th>
                    <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Active</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((code) => (
                    <tr key={code.id} className={cn('border-b border-border/50 hover:bg-background-elevated/30', !code.active && 'opacity-60')}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-accent">{code.code}</span>
                          <button onClick={() => handleCopy(code.code, code.id)}>
                            {copiedId === code.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-text-muted hover:text-text" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-text-secondary">{code.promotionTitle}</td>
                      <td className="py-3 px-3 text-right font-mono text-text">
                        {code.currentUses} / {code.maxUses}
                      </td>
                      <td className="py-3 px-3 text-xs text-text-muted">{formatDate(code.expiresAt, 'MMM d, yyyy')}</td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => handleToggleCode(code)}>
                          {code.active ? <ToggleRight className="w-6 h-6 text-success mx-auto" /> : <ToggleLeft className="w-6 h-6 text-text-muted mx-auto" />}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleToggleCode(code)}>
                          {code.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Create/Edit Promotion Modal */}
      <Modal open={promoModal} onOpenChange={setPromoModal}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>{isNewPromo ? 'Create' : 'Edit'} Promotion</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <Input label="Title" value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} className="bg-background" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Type</label>
                  <select value={promoForm.type} onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value as any })} className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text">
                    {Object.entries(promoTypeLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Reward Type</label>
                  <select value={promoForm.rewardType} onChange={(e) => setPromoForm({ ...promoForm, rewardType: e.target.value as any })} className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text">
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Description</label>
                <textarea value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} className="w-full bg-background border border-border rounded-input px-3 py-2 text-sm text-text h-20 resize-none focus:outline-none focus:ring-2 focus:ring-accent/50" />
              </div>
              <Input label="Conditions" value={promoForm.conditions} onChange={(e) => setPromoForm({ ...promoForm, conditions: e.target.value })} className="bg-background" />
              <div className="grid grid-cols-3 gap-3">
                <Input label={promoForm.rewardType === 'percentage' ? 'Reward %' : 'Reward $'} type="number" value={String(promoForm.rewardValue)} onChange={(e) => setPromoForm({ ...promoForm, rewardValue: parseFloat(e.target.value) || 0 })} className="bg-background" />
                <Input label="Max Bonus $" type="number" value={String(promoForm.maxBonus)} onChange={(e) => setPromoForm({ ...promoForm, maxBonus: parseFloat(e.target.value) || 0 })} className="bg-background" />
                <Input label="Wagering Req (x)" type="number" value={String(promoForm.wageringRequirement)} onChange={(e) => setPromoForm({ ...promoForm, wageringRequirement: parseFloat(e.target.value) || 0 })} className="bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start Date" type="datetime-local" value={promoForm.startDate} onChange={(e) => setPromoForm({ ...promoForm, startDate: e.target.value })} className="bg-background" />
                <Input label="End Date" type="datetime-local" value={promoForm.endDate} onChange={(e) => setPromoForm({ ...promoForm, endDate: e.target.value })} className="bg-background" />
              </div>
              <Input label="Promo Code (optional)" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} placeholder="e.g. WELCOME100" className="bg-background font-mono" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setPromoModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} onClick={handleSavePromo}>
              {isNewPromo ? 'Create' : 'Save'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Generate Code Modal */}
      <Modal open={codeModal} onOpenChange={setCodeModal}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Generate Promo Code</ModalTitle></ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <Input label="Code" value={codeForm.code} onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })} placeholder="e.g. VIP50" className="bg-background font-mono" />
              <div>
                <label className="block text-xs text-text-muted mb-1">Promotion</label>
                <select value={codeForm.promotionId} onChange={(e) => setCodeForm({ ...codeForm, promotionId: e.target.value })} className="w-full h-10 bg-background border border-border rounded-input px-3 text-sm text-text">
                  <option value="">Select promotion...</option>
                  {promotions.filter((p) => p.active).map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <Input label="Max Uses" type="number" value={String(codeForm.maxUses)} onChange={(e) => setCodeForm({ ...codeForm, maxUses: parseInt(e.target.value) || 0 })} className="bg-background" />
              <Input label="Expires At" type="datetime-local" value={codeForm.expiresAt} onChange={(e) => setCodeForm({ ...codeForm, expiresAt: e.target.value })} className="bg-background" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setCodeModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading} disabled={!codeForm.code || !codeForm.promotionId} onClick={handleCreateCode}>Generate</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
