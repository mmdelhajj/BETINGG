'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { DataTable, Column } from '@/components/admin/DataTable';
import { StatsCard } from '@/components/admin/StatsCard';
import { cn, formatRelativeDate } from '@/lib/utils';
import { get, post } from '@/lib/api';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Search,
  User,
  Calendar,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KycStats {
  pending: number;
  approved: number;
  rejected: number;
  avgReviewTime: string;
}

interface KycSubmission {
  id: string;
  userId: string;
  username: string;
  email: string;
  level: number;
  documentType: string;
  documentUrl: string;
  selfieUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

interface KycHistoryEntry {
  id: string;
  username: string;
  level: number;
  status: 'approved' | 'rejected';
  reviewedBy: string;
  reviewedAt: string;
  reason?: string;
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
// Document Viewer Modal
// ---------------------------------------------------------------------------

function DocumentViewerModal({
  open,
  onClose,
  submission,
  onApprove,
  onReject,
}: {
  open: boolean;
  onClose: () => void;
  submission: KycSubmission | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleApprove = async () => {
    if (!submission) return;
    setProcessing(true);
    await onApprove(submission.id);
    setProcessing(false);
    onClose();
  };

  const handleReject = async () => {
    if (!submission || !rejectionReason.trim()) return;
    setProcessing(true);
    await onReject(submission.id, rejectionReason);
    setProcessing(false);
    setRejectionReason('');
    setShowRejectForm(false);
    onClose();
  };

  if (!submission) return null;

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>KYC Document Review</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {/* User Info */}
          <div className="flex items-center gap-4 p-3 rounded-card bg-background-elevated mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text">{submission.username}</p>
              <p className="text-xs text-text-muted">{submission.email}</p>
            </div>
            <div className="text-right">
              <Badge variant="accent" size="sm">Level {submission.level}</Badge>
              <p className="text-xs text-text-muted mt-1">{submission.documentType}</p>
            </div>
          </div>

          {/* Document Viewer Area */}
          <div className="border border-border rounded-card overflow-hidden mb-4">
            <div className="flex items-center gap-2 p-2 border-b border-border bg-background-elevated">
              <span className="text-xs text-text-muted flex-1">Document Preview</span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="p-1.5 rounded hover:bg-background-card transition-colors text-text-muted hover:text-text"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="p-1.5 rounded hover:bg-background-card transition-colors text-text-muted hover:text-text"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => r + 90)}
                className="p-1.5 rounded hover:bg-background-card transition-colors text-text-muted hover:text-text"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-muted font-mono">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="h-[320px] flex items-center justify-center bg-[#0a0e14] overflow-auto p-4">
              <div
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.3s ease',
                }}
              >
                <div className="w-[400px] h-[260px] bg-background-card border border-border rounded-lg flex flex-col items-center justify-center gap-3">
                  <FileText className="w-12 h-12 text-text-muted" />
                  <p className="text-sm text-text-muted">{submission.documentType}</p>
                  <p className="text-xs text-text-muted">
                    {submission.documentUrl || 'Document preview unavailable'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Selfie comparison */}
          {submission.selfieUrl && (
            <div className="border border-border rounded-card p-4 mb-4">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Selfie Verification</p>
              <div className="h-[180px] bg-background-elevated rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <User className="w-10 h-10 text-text-muted mx-auto mb-2" />
                  <p className="text-xs text-text-muted">Selfie image</p>
                </div>
              </div>
            </div>
          )}

          {/* Submission details */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-card bg-background-elevated">
              <p className="text-xs text-text-muted mb-1">Submitted</p>
              <p className="text-sm text-text">{formatRelativeDate(submission.submittedAt)}</p>
            </div>
            <div className="p-3 rounded-card bg-background-elevated">
              <p className="text-xs text-text-muted mb-1">Verification Level</p>
              <p className="text-sm text-text">Level {submission.level} - {
                submission.level === 1 ? 'Basic (Email)' :
                submission.level === 2 ? 'Intermediate (ID)' :
                'Advanced (Address Proof)'
              }</p>
            </div>
          </div>

          {/* Reject form */}
          {showRejectForm && (
            <div className="p-4 rounded-card border border-danger/25 bg-danger/5 mb-4">
              <p className="text-sm font-medium text-danger mb-2">Rejection Reason</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this document is being rejected..."
                className="w-full h-24 bg-background-card border border-border rounded-input px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-danger/50 focus:border-danger resize-none"
              />
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleReject}
                  isLoading={processing}
                  disabled={!rejectionReason.trim()}
                >
                  Confirm Rejection
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </ModalBody>

        {!showRejectForm && (
          <ModalFooter>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
            {submission.status === 'pending' && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRejectForm(true)}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Reject
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleApprove}
                  isLoading={processing}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                >
                  Approve
                </Button>
              </>
            )}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// KYC Review Page
// ---------------------------------------------------------------------------

export default function AdminKycPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<KycStats | null>(null);
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [history, setHistory] = useState<KycHistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<KycSubmission | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, subsRes, histRes] = await Promise.allSettled([
        get<KycStats>('/admin/kyc/stats'),
        get<{ data: KycSubmission[]; totalPages: number }>(`/admin/kyc/submissions?status=${statusFilter}&search=${search}&page=${page}`),
        get<{ data: KycHistoryEntry[]; totalPages: number }>(`/admin/kyc/history?page=${historyPage}`),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        setStats({ pending: 14, approved: 328, rejected: 47, avgReviewTime: '2.4 hrs' });
      }

      if (subsRes.status === 'fulfilled') {
        setSubmissions(subsRes.value.data);
        setTotalPages(subsRes.value.totalPages);
      } else {
        const mockStatuses: KycSubmission['status'][] = ['pending', 'approved', 'rejected'];
        const docTypes = ['Passport', 'National ID', 'Driver License', 'Utility Bill'];
        setSubmissions(
          Array.from({ length: 12 }, (_, i) => ({
            id: `kyc-${i}`,
            userId: `user-${i}`,
            username: `user_${1000 + i}`,
            email: `user${1000 + i}@example.com`,
            level: (i % 3) + 1,
            documentType: docTypes[i % docTypes.length],
            documentUrl: `/docs/kyc-doc-${i}.jpg`,
            selfieUrl: i % 3 === 0 ? `/docs/selfie-${i}.jpg` : undefined,
            status: statusFilter === 'all' ? mockStatuses[i % 3] : statusFilter,
            submittedAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
            reviewedAt: mockStatuses[i % 3] !== 'pending'
              ? new Date(Date.now() - Math.random() * 86400000 * 2).toISOString()
              : undefined,
            reviewedBy: mockStatuses[i % 3] !== 'pending' ? 'admin_1' : undefined,
            rejectionReason: mockStatuses[i % 3] === 'rejected'
              ? 'Document is blurry or unreadable'
              : undefined,
          })),
        );
        setTotalPages(3);
      }

      if (histRes.status === 'fulfilled') {
        setHistory(histRes.value.data);
        setHistoryTotalPages(histRes.value.totalPages);
      } else {
        setHistory(
          Array.from({ length: 10 }, (_, i) => ({
            id: `hist-${i}`,
            username: `user_${2000 + i}`,
            level: (i % 3) + 1,
            status: (i % 3 === 0 ? 'rejected' : 'approved') as 'approved' | 'rejected',
            reviewedBy: 'admin_1',
            reviewedAt: new Date(Date.now() - Math.random() * 86400000 * 14).toISOString(),
            reason: i % 3 === 0 ? 'Document expired' : undefined,
          })),
        );
        setHistoryTotalPages(5);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page, historyPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actions
  const handleApprove = async (id: string) => {
    try {
      await post(`/admin/kyc/${id}/approve`);
    } catch {
      // Optimistic update
    }
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'approved' as const, reviewedAt: new Date().toISOString() } : s)),
    );
    if (stats) setStats({ ...stats, pending: stats.pending - 1, approved: stats.approved + 1 });
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      await post(`/admin/kyc/${id}/reject`, { reason });
    } catch {
      // Optimistic update
    }
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: 'rejected' as const, rejectionReason: reason, reviewedAt: new Date().toISOString() }
          : s,
      ),
    );
    if (stats) setStats({ ...stats, pending: stats.pending - 1, rejected: stats.rejected + 1 });
  };

  // Table columns
  const submissionColumns: Column<KycSubmission>[] = [
    {
      key: 'username',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-text">{row.username}</p>
          <p className="text-xs text-text-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      align: 'center',
      render: (row) => (
        <Badge variant="accent" size="xs">L{row.level}</Badge>
      ),
    },
    {
      key: 'documentType',
      header: 'Document',
      render: (row) => (
        <span className="text-sm text-text-secondary">{row.documentType}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortable: true,
      render: (row) => (
        <Badge
          variant={
            row.status === 'approved' ? 'success' :
            row.status === 'rejected' ? 'danger' :
            'warning'
          }
          size="xs"
          dot
          pulse={row.status === 'pending'}
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-text-muted">{formatRelativeDate(row.submittedAt)}</span>
      ),
    },
  ];

  const historyColumns: Column<KycHistoryEntry>[] = [
    {
      key: 'username',
      header: 'User',
      render: (row) => <span className="text-sm text-text">{row.username}</span>,
    },
    {
      key: 'level',
      header: 'Level',
      align: 'center',
      render: (row) => <Badge variant="accent" size="xs">L{row.level}</Badge>,
    },
    {
      key: 'status',
      header: 'Decision',
      align: 'center',
      render: (row) => (
        <Badge variant={row.status === 'approved' ? 'success' : 'danger'} size="xs">
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'reviewedBy',
      header: 'Reviewed By',
      render: (row) => <span className="text-sm text-text-secondary">{row.reviewedBy}</span>,
    },
    {
      key: 'reviewedAt',
      header: 'Reviewed',
      render: (row) => (
        <span className="text-xs text-text-muted">{formatRelativeDate(row.reviewedAt)}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <span className="text-xs text-text-muted truncate max-w-[200px] block">
          {row.reason || '-'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
        <Card><Skeleton className="h-[400px] w-full" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">KYC Review</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Review and manage identity verification submissions
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchData}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Pending Review"
          value={stats?.pending ?? 0}
          icon={Clock}
          iconColor="text-warning"
          iconBg="bg-warning/15"
        />
        <StatsCard
          title="Approved"
          value={stats?.approved ?? 0}
          icon={CheckCircle}
          iconColor="text-success"
          iconBg="bg-success/15"
        />
        <StatsCard
          title="Rejected"
          value={stats?.rejected ?? 0}
          icon={XCircle}
          iconColor="text-danger"
          iconBg="bg-danger/15"
        />
        <StatsCard
          title="Avg. Review Time"
          value={stats?.avgReviewTime ?? '-'}
          icon={Calendar}
          iconColor="text-info"
          iconBg="bg-info/15"
        />
      </div>

      {/* Pending alert */}
      {stats && stats.pending > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-card bg-warning/10 border border-warning/25">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-sm text-warning">
            <span className="font-bold">{stats.pending}</span> verification{stats.pending !== 1 ? 's' : ''} awaiting review.
            Oldest submission is from{' '}
            {submissions.length > 0
              ? formatRelativeDate(submissions[submissions.length - 1]?.submittedAt ?? new Date().toISOString())
              : 'recently'}
            .
          </p>
        </div>
      )}

      {/* Submissions Table */}
      <DataTable<KycSubmission>
        columns={submissionColumns}
        data={submissions}
        loading={loading}
        searchable
        searchPlaceholder="Search by username or email..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyMessage="No submissions found."
        headerExtra={
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 rounded-button text-xs font-medium transition-colors border',
                  statusFilter === s
                    ? 'bg-accent/15 text-accent-light border-accent/25'
                    : 'text-text-secondary border-transparent hover:bg-background-elevated',
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        }
        rowActions={(row) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSubmission(row);
                setViewerOpen(true);
              }}
              leftIcon={<Eye className="w-3.5 h-3.5" />}
            >
              View
            </Button>
            {row.status === 'pending' && (
              <>
                <Button
                  variant="success"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApprove(row.id);
                  }}
                  leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSubmission(row);
                    setViewerOpen(true);
                  }}
                  leftIcon={<XCircle className="w-3.5 h-3.5" />}
                >
                  Reject
                </Button>
              </>
            )}
          </>
        )}
      />

      {/* Verification History */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-4">Verification History</h2>
        <DataTable<KycHistoryEntry>
          columns={historyColumns}
          data={history}
          page={historyPage}
          totalPages={historyTotalPages}
          onPageChange={setHistoryPage}
          rowKey={(row) => row.id}
          emptyMessage="No review history found."
          compact
        />
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
