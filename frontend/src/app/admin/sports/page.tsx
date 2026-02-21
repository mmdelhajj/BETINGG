'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { cn, formatDate, formatRelativeDate } from '@/lib/utils';
import { get, post, put, del } from '@/lib/api';
import {
  Trophy,
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Square,
  Radio,
  ToggleLeft,
  ToggleRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  Target,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Sport {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  active: boolean;
  eventCount: number;
  order: number;
}

interface Competition {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
  country?: string;
  active: boolean;
  eventCount: number;
}

interface SportEvent {
  id: string;
  name: string;
  sportName: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: 'upcoming' | 'live' | 'ended' | 'suspended' | 'cancelled';
  homeScore?: number;
  awayScore?: number;
  marketCount: number;
}

interface Market {
  id: string;
  eventId: string;
  eventName: string;
  name: string;
  type: string;
  status: 'open' | 'suspended' | 'closed' | 'settled';
  selections: Selection[];
}

interface Selection {
  id: string;
  name: string;
  odds: number;
  status: 'active' | 'suspended' | 'winner' | 'loser';
}

type SportsTab = 'sports' | 'competitions' | 'events' | 'markets';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-background-elevated', className)} />;
}

// ---------------------------------------------------------------------------
// Sports Page
// ---------------------------------------------------------------------------

export default function AdminSportsPage() {
  const [activeTab, setActiveTab] = useState<SportsTab>('events');
  const [loading, setLoading] = useState(true);

  // Sports state
  const [sports, setSports] = useState<Sport[]>([]);
  const [sportModal, setSportModal] = useState<Sport | null>(null);
  const [sportForm, setSportForm] = useState({ name: '', slug: '', active: true });
  const [isNewSport, setIsNewSport] = useState(false);

  // Competitions state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compSearch, setCompSearch] = useState('');

  // Events state
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('');
  const [eventPage, setEventPage] = useState(1);
  const [eventTotalPages, setEventTotalPages] = useState(1);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventModal, setEventModal] = useState<SportEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    homeTeam: '',
    awayTeam: '',
    sportId: '',
    competitionId: '',
    startTime: '',
    homeScore: 0,
    awayScore: 0,
  });
  const [isNewEvent, setIsNewEvent] = useState(false);

  // Markets state
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketSearch, setMarketSearch] = useState('');
  const [marketModal, setMarketModal] = useState<Market | null>(null);

  const [sortField, setSortField] = useState('startTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>('/admin/sports');
      setSports(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setSports([
        { id: 's-1', name: 'Football', slug: 'football', active: true, eventCount: 245, order: 1 },
        { id: 's-2', name: 'Basketball', slug: 'basketball', active: true, eventCount: 89, order: 2 },
        { id: 's-3', name: 'Tennis', slug: 'tennis', active: true, eventCount: 67, order: 3 },
        { id: 's-4', name: 'Cricket', slug: 'cricket', active: true, eventCount: 42, order: 4 },
        { id: 's-5', name: 'Baseball', slug: 'baseball', active: false, eventCount: 0, order: 5 },
        { id: 's-6', name: 'Ice Hockey', slug: 'ice-hockey', active: true, eventCount: 38, order: 6 },
        { id: 's-7', name: 'MMA', slug: 'mma', active: true, eventCount: 12, order: 7 },
        { id: 's-8', name: 'Esports', slug: 'esports', active: true, eventCount: 55, order: 8 },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>(`/admin/competitions?search=${compSearch}`);
      setCompetitions(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setCompetitions([
        { id: 'comp-1', name: 'Premier League', sportId: 's-1', sportName: 'Football', country: 'England', active: true, eventCount: 38 },
        { id: 'comp-2', name: 'La Liga', sportId: 's-1', sportName: 'Football', country: 'Spain', active: true, eventCount: 34 },
        { id: 'comp-3', name: 'NBA', sportId: 's-2', sportName: 'Basketball', country: 'USA', active: true, eventCount: 48 },
        { id: 'comp-4', name: 'UEFA Champions League', sportId: 's-1', sportName: 'Football', country: 'Europe', active: true, eventCount: 24 },
        { id: 'comp-5', name: 'ATP Tour', sportId: 's-3', sportName: 'Tennis', country: 'Global', active: true, eventCount: 30 },
        { id: 'comp-6', name: 'NHL', sportId: 's-6', sportName: 'Ice Hockey', country: 'USA', active: true, eventCount: 35 },
      ]);
    } finally {
      setLoading(false);
    }
  }, [compSearch]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(eventPage), limit: '20', sortBy: sortField, sortDir });
      if (eventSearch) params.set('search', eventSearch);
      if (eventStatusFilter) params.set('status', eventStatusFilter);
      const res = await get<any>(`/admin/events?${params}`);
      setEvents(res?.data || []);
      setEventTotal(res?.total || 0);
      setEventTotalPages(res?.totalPages || 1);
    } catch {
      const statuses: SportEvent['status'][] = ['upcoming', 'live', 'ended', 'suspended'];
      setEvents(
        Array.from({ length: 20 }, (_, i) => ({
          id: `ev-${i}`,
          name: `Team A vs Team B (${i})`,
          sportName: ['Football', 'Basketball', 'Tennis'][Math.floor(Math.random() * 3)],
          competitionName: ['Premier League', 'NBA', 'ATP Tour'][Math.floor(Math.random() * 3)],
          homeTeam: `Team ${i * 2 + 1}`,
          awayTeam: `Team ${i * 2 + 2}`,
          startTime: new Date(Date.now() + (Math.random() - 0.3) * 86400000 * 7).toISOString(),
          status: statuses[Math.floor(Math.random() * 4)],
          homeScore: Math.floor(Math.random() * 4),
          awayScore: Math.floor(Math.random() * 4),
          marketCount: Math.floor(Math.random() * 20) + 3,
        })),
      );
      setEventTotal(156);
      setEventTotalPages(8);
    } finally {
      setLoading(false);
    }
  }, [eventPage, eventSearch, eventStatusFilter, sortField, sortDir]);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<any>(`/admin/markets?search=${marketSearch}`);
      setMarkets(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setMarkets(
        Array.from({ length: 10 }, (_, i) => ({
          id: `mkt-${i}`,
          eventId: `ev-${i}`,
          eventName: `Team ${i * 2 + 1} vs Team ${i * 2 + 2}`,
          name: ['Match Winner', 'Over/Under 2.5', 'Both Teams to Score', 'Handicap'][Math.floor(Math.random() * 4)],
          type: ['1x2', 'over_under', 'btts', 'handicap'][Math.floor(Math.random() * 4)],
          status: (['open', 'suspended', 'closed', 'settled'] as const)[Math.floor(Math.random() * 4)],
          selections: [
            { id: `sel-${i}-1`, name: 'Home', odds: 1.5 + Math.random() * 2, status: 'active' as const },
            { id: `sel-${i}-2`, name: 'Draw', odds: 2.5 + Math.random() * 2, status: 'active' as const },
            { id: `sel-${i}-3`, name: 'Away', odds: 2 + Math.random() * 3, status: 'active' as const },
          ],
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [marketSearch]);

  useEffect(() => {
    if (activeTab === 'sports') fetchSports();
    else if (activeTab === 'competitions') fetchCompetitions();
    else if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'markets') fetchMarkets();
  }, [activeTab, fetchSports, fetchCompetitions, fetchEvents, fetchMarkets]);

  const handleSaveSport = async () => {
    setActionLoading('sport');
    try {
      if (isNewSport) {
        await post('/admin/sports', sportForm);
      } else if (sportModal) {
        await put(`/admin/sports/${sportModal.id}`, sportForm);
      }
      fetchSports();
    } catch { /* silent */ }
    finally { setActionLoading(null); setSportModal(null); }
  };

  const handleDeleteSport = async (id: string) => {
    try {
      await del(`/admin/sports/${id}`);
      setSports((prev) => prev.filter((s) => s.id !== id));
    } catch { /* silent */ }
  };

  const handleToggleSport = async (sport: Sport) => {
    try {
      await put(`/admin/sports/${sport.id}`, { active: !sport.active });
      setSports((prev) => prev.map((s) => s.id === sport.id ? { ...s, active: !s.active } : s));
    } catch { /* silent */ }
  };

  const handleEventAction = async (event: SportEvent, action: 'live' | 'suspend' | 'end') => {
    setActionLoading(`${event.id}-${action}`);
    try {
      await put(`/admin/events/${event.id}/status`, { status: action === 'live' ? 'live' : action === 'suspend' ? 'suspended' : 'ended' });
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? { ...e, status: action === 'live' ? 'live' : action === 'suspend' ? 'suspended' : 'ended' }
            : e,
        ),
      );
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  };

  const handleSaveEvent = async () => {
    setActionLoading('event');
    try {
      if (isNewEvent) {
        await post('/admin/events', eventForm);
      } else if (eventModal) {
        await put(`/admin/events/${eventModal.id}`, eventForm);
      }
      fetchEvents();
    } catch { /* silent */ }
    finally { setActionLoading(null); setEventModal(null); }
  };

  const handleSettleMarket = async (market: Market, winnerId: string) => {
    setActionLoading(market.id);
    try {
      await put(`/admin/markets/${market.id}/settle`, { winnerSelectionId: winnerId });
      fetchMarkets();
    } catch { /* silent */ }
    finally { setActionLoading(null); setMarketModal(null); }
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-text-muted" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />;
  };

  const eventStatusColor = (s: string) => {
    switch (s) { case 'live': return 'danger'; case 'upcoming': return 'info'; case 'ended': return 'default'; case 'suspended': return 'warning'; case 'cancelled': return 'danger'; default: return 'default'; }
  };

  const marketStatusColor = (s: string) => {
    switch (s) { case 'open': return 'success'; case 'suspended': return 'warning'; case 'closed': return 'default'; case 'settled': return 'info'; default: return 'default'; }
  };

  const tabs: { key: SportsTab; label: string; icon: React.ElementType }[] = [
    { key: 'sports', label: 'Sports', icon: Trophy },
    { key: 'competitions', label: 'Competitions', icon: Calendar },
    { key: 'events', label: 'Events', icon: Radio },
    { key: 'markets', label: 'Markets', icon: Target },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">Sports Management</h1>
        <p className="text-sm text-text-muted mt-0.5">Manage sports, competitions, events and markets</p>
      </div>

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

      {/* Sports Tab */}
      {activeTab === 'sports' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => { setIsNewSport(true); setSportForm({ name: '', slug: '', active: true }); setSportModal({} as Sport); }}
            >
              Add Sport
            </Button>
          </div>

          <Card noPadding>
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background-elevated/50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Sport</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Slug</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Events</th>
                      <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Active</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sports.map((sport) => (
                      <tr key={sport.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                        <td className="py-3 px-4 text-text font-medium">{sport.name}</td>
                        <td className="py-3 px-3 font-mono text-text-muted text-xs">{sport.slug}</td>
                        <td className="py-3 px-3 text-right text-text">{sport.eventCount}</td>
                        <td className="py-3 px-3 text-center">
                          <button onClick={() => handleToggleSport(sport)}>
                            {sport.active ? <ToggleRight className="w-6 h-6 text-success mx-auto" /> : <ToggleLeft className="w-6 h-6 text-text-muted mx-auto" />}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => { setIsNewSport(false); setSportForm({ name: sport.name, slug: sport.slug, active: sport.active }); setSportModal(sport); }}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => handleDeleteSport(sport.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Competitions Tab */}
      {activeTab === 'competitions' && (
        <div className="space-y-4">
          <Input placeholder="Search competitions..." value={compSearch} onChange={(e) => setCompSearch(e.target.value)} prefixIcon={<Search className="w-4 h-4" />} className="max-w-md bg-background-card" />
          <Card noPadding>
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background-elevated/50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Competition</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Sport</th>
                      <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Country</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Events</th>
                      <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitions.map((comp) => (
                      <tr key={comp.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                        <td className="py-3 px-4 text-text font-medium">{comp.name}</td>
                        <td className="py-3 px-3"><Badge variant="accent" size="xs">{comp.sportName}</Badge></td>
                        <td className="py-3 px-3 text-text-secondary">{comp.country || '-'}</td>
                        <td className="py-3 px-3 text-right text-text">{comp.eventCount}</td>
                        <td className="py-3 px-3 text-center">
                          {comp.active ? <ToggleRight className="w-6 h-6 text-success mx-auto" /> : <ToggleLeft className="w-6 h-6 text-text-muted mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Input placeholder="Search events..." value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} prefixIcon={<Search className="w-4 h-4" />} className="bg-background-card flex-1" />
            <select value={eventStatusFilter} onChange={(e) => { setEventStatusFilter(e.target.value); setEventPage(1); }} className="h-10 bg-background-card border border-border rounded-input px-3 text-sm text-text">
              <option value="">All statuses</option>
              {['upcoming', 'live', 'ended', 'suspended', 'cancelled'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setIsNewEvent(true);
                setEventForm({ homeTeam: '', awayTeam: '', sportId: '', competitionId: '', startTime: '', homeScore: 0, awayScore: 0 });
                setEventModal({} as SportEvent);
              }}
            >
              Create Event
            </Button>
          </div>

          <Card noPadding>
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background-elevated/50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase">Event</th>
                        <th className="text-left py-3 px-3 text-xs font-medium text-text-muted uppercase">Sport</th>
                        <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Score</th>
                        <th className="text-center py-3 px-3 text-xs font-medium text-text-muted uppercase">Status</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase">Markets</th>
                        <th className="text-right py-3 px-3 text-xs font-medium text-text-muted uppercase cursor-pointer" onClick={() => handleSort('startTime')}>
                          <span className="flex items-center gap-1 justify-end">Start <SortIcon field="startTime" /></span>
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id} className="border-b border-border/50 hover:bg-background-elevated/30">
                          <td className="py-3 px-4">
                            <p className="text-text font-medium">{event.homeTeam} vs {event.awayTeam}</p>
                            <p className="text-xs text-text-muted">{event.competitionName}</p>
                          </td>
                          <td className="py-3 px-3"><Badge variant="accent" size="xs">{event.sportName}</Badge></td>
                          <td className="py-3 px-3 text-center font-mono text-text font-bold">
                            {event.status === 'live' || event.status === 'ended' ? `${event.homeScore} - ${event.awayScore}` : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge variant={eventStatusColor(event.status) as any} size="xs" dot={event.status === 'live'} pulse={event.status === 'live'}>
                              {event.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right text-text">{event.marketCount}</td>
                          <td className="py-3 px-3 text-right text-xs text-text-muted">{formatDate(event.startTime, 'MMM d, HH:mm')}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {event.status === 'upcoming' && (
                                <Button variant="ghost" size="sm" className="text-success" isLoading={actionLoading === `${event.id}-live`} onClick={() => handleEventAction(event, 'live')} title="Go Live">
                                  <Play className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {event.status === 'live' && (
                                <>
                                  <Button variant="ghost" size="sm" className="text-warning" isLoading={actionLoading === `${event.id}-suspend`} onClick={() => handleEventAction(event, 'suspend')} title="Suspend">
                                    <Pause className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-danger" isLoading={actionLoading === `${event.id}-end`} onClick={() => handleEventAction(event, 'end')} title="End Event">
                                    <Square className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                              {event.status === 'suspended' && (
                                <Button variant="ghost" size="sm" className="text-success" isLoading={actionLoading === `${event.id}-live`} onClick={() => handleEventAction(event, 'live')} title="Resume">
                                  <Play className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => {
                                setIsNewEvent(false);
                                setEventForm({ homeTeam: event.homeTeam, awayTeam: event.awayTeam, sportId: '', competitionId: '', startTime: event.startTime, homeScore: event.homeScore || 0, awayScore: event.awayScore || 0 });
                                setEventModal(event);
                              }}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {events.length === 0 && (
                        <tr><td colSpan={7} className="py-12 text-center text-text-muted">No events found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {eventTotalPages > 1 && (
                  <CardFooter className="px-4">
                    <p className="text-xs text-text-muted">Page {eventPage} of {eventTotalPages}</p>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" disabled={eventPage <= 1} onClick={() => setEventPage(eventPage - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" disabled={eventPage >= eventTotalPages} onClick={() => setEventPage(eventPage + 1)}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </CardFooter>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Markets Tab */}
      {activeTab === 'markets' && (
        <div className="space-y-4">
          <Input placeholder="Search markets..." value={marketSearch} onChange={(e) => setMarketSearch(e.target.value)} prefixIcon={<Search className="w-4 h-4" />} className="max-w-md bg-background-card" />
          <Card noPadding>
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {markets.map((market) => (
                  <div key={market.id} className="p-4 hover:bg-background-elevated/30 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-text">{market.name}</p>
                        <p className="text-xs text-text-muted">{market.eventName} | {market.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={marketStatusColor(market.status) as any} size="xs">{market.status}</Badge>
                        {market.status === 'closed' && (
                          <Button variant="primary" size="sm" leftIcon={<Zap className="w-3 h-3" />} onClick={() => setMarketModal(market)}>
                            Settle
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(market.selections || []).map((sel) => (
                        <div key={sel.id} className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-button border border-border">
                          <span className="text-xs text-text-secondary">{sel.name}</span>
                          <span className="text-sm font-mono font-bold text-accent">{Number(sel.odds || 0).toFixed(2)}</span>
                          {sel.status === 'winner' && <Badge variant="success" size="xs">W</Badge>}
                          {sel.status === 'loser' && <Badge variant="danger" size="xs">L</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {markets.length === 0 && (
                  <div className="py-12 text-center text-text-muted">No markets found.</div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Sport Modal */}
      <Modal open={!!sportModal} onOpenChange={() => setSportModal(null)}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>{isNewSport ? 'Add' : 'Edit'} Sport</ModalTitle></ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <Input label="Name" value={sportForm.name} onChange={(e) => setSportForm({ ...sportForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} className="bg-background" />
              <Input label="Slug" value={sportForm.slug} onChange={(e) => setSportForm({ ...sportForm, slug: e.target.value })} className="bg-background" />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={sportForm.active} onChange={(e) => setSportForm({ ...sportForm, active: e.target.checked })} className="accent-accent" />
                <span className="text-sm text-text-secondary">Active</span>
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setSportModal(null)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading === 'sport'} onClick={handleSaveSport}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Event Modal */}
      <Modal open={!!eventModal} onOpenChange={() => setEventModal(null)}>
        <ModalContent size="md">
          <ModalHeader><ModalTitle>{isNewEvent ? 'Create' : 'Edit'} Event</ModalTitle></ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Home Team" value={eventForm.homeTeam} onChange={(e) => setEventForm({ ...eventForm, homeTeam: e.target.value })} className="bg-background" />
                <Input label="Away Team" value={eventForm.awayTeam} onChange={(e) => setEventForm({ ...eventForm, awayTeam: e.target.value })} className="bg-background" />
              </div>
              <Input label="Start Time" type="datetime-local" value={eventForm.startTime?.slice(0, 16)} onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })} className="bg-background" />
              {!isNewEvent && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Home Score" type="number" value={String(eventForm.homeScore)} onChange={(e) => setEventForm({ ...eventForm, homeScore: parseInt(e.target.value) || 0 })} className="bg-background" />
                  <Input label="Away Score" type="number" value={String(eventForm.awayScore)} onChange={(e) => setEventForm({ ...eventForm, awayScore: parseInt(e.target.value) || 0 })} className="bg-background" />
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setEventModal(null)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={actionLoading === 'event'} onClick={handleSaveEvent}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Settle Market Modal */}
      <Modal open={!!marketModal} onOpenChange={() => setMarketModal(null)}>
        <ModalContent size="sm">
          <ModalHeader><ModalTitle>Settle Market</ModalTitle></ModalHeader>
          <ModalBody>
            <p className="text-sm text-text-secondary mb-4">
              Select the winning selection for <span className="text-text font-medium">{marketModal?.name}</span>:
            </p>
            <div className="space-y-2">
              {(marketModal?.selections || []).map((sel) => (
                <button
                  key={sel.id}
                  onClick={() => marketModal && handleSettleMarket(marketModal, sel.id)}
                  className="w-full flex items-center justify-between p-3 bg-background rounded-card border border-border hover:border-accent transition-colors"
                >
                  <span className="text-sm text-text font-medium">{sel.name}</span>
                  <span className="text-sm font-mono text-accent">{Number(sel.odds ?? 0).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={() => setMarketModal(null)}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
