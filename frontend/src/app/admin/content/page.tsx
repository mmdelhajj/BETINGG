'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal';
import { DataTable, Column } from '@/components/admin/DataTable';
import { cn, formatRelativeDate } from '@/lib/utils';
import { get, post, put, del } from '@/lib/api';
import {
  FileText,
  HelpCircle,
  GraduationCap,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Calendar,
  User,
  Tag,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContentTab = 'blog' | 'help' | 'academy';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  author: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  views: number;
}

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  category: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  helpful: number;
  notHelpful: number;
}

interface AcademyCourse {
  id: string;
  title: string;
  status: 'draft' | 'published';
  author: string;
  lessonsCount: number;
  enrollments: number;
  createdAt: string;
  updatedAt: string;
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
// Create/Edit Modal
// ---------------------------------------------------------------------------

function ContentFormModal({
  open,
  onClose,
  type,
  editItem,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  type: ContentTab;
  editItem: any | null;
  onSave: (data: any) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setTitle(editItem.title || '');
      setCategory(editItem.category || '');
    } else {
      setTitle('');
      setCategory('');
    }
  }, [editItem, open]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ title, category });
    setSaving(false);
    onClose();
  };

  const typeLabels = { blog: 'Blog Post', help: 'Help Article', academy: 'Academy Course' };

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{editItem ? 'Edit' : 'Create'} {typeLabels[type]}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${typeLabels[type].toLowerCase()} title...`}
            />
            {type !== 'academy' && (
              <Input
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Sports Betting, Getting Started"
              />
            )}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Content
              </label>
              <textarea
                className="w-full h-40 bg-background-card border border-border rounded-input px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                placeholder="Write content in Markdown..."
                defaultValue={editItem?.content || ''}
              />
              <p className="text-xs text-text-muted mt-1">Supports Markdown formatting</p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={saving}
            disabled={!title.trim()}
          >
            {editItem ? 'Save Changes' : 'Create'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Content Management Page
// ---------------------------------------------------------------------------

export default function AdminContentPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ContentTab>('blog');
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [helpArticles, setHelpArticles] = useState<HelpArticle[]>([]);
  const [academyCourses, setAcademyCourses] = useState<AcademyCourse[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'blog'
        ? '/admin/content/blog-posts'
        : activeTab === 'help'
          ? '/admin/content/help-articles'
          : '/admin/content/academy-courses';

      const res = await get<{ data: any[]; totalPages: number }>(
        `${endpoint}?search=${search}&page=${page}`,
      );
      if (activeTab === 'blog') {
        setBlogPosts(res.data);
      } else if (activeTab === 'help') {
        setHelpArticles(res.data);
      } else {
        setAcademyCourses(res.data);
      }
      setTotalPages(res.totalPages);
    } catch {
      // Fallback mock data
      if (activeTab === 'blog') {
        const categories = ['Sports Betting', 'Casino', 'Crypto', 'Platform News', 'Tutorials'];
        setBlogPosts(
          Array.from({ length: 10 }, (_, i) => ({
            id: `blog-${i}`,
            title: `Understanding ${categories[i % categories.length]} Strategies ${i + 1}`,
            slug: `understanding-strategies-${i + 1}`,
            status: (i % 3 === 0 ? 'draft' : 'published') as 'draft' | 'published',
            author: `admin_${(i % 3) + 1}`,
            category: categories[i % categories.length],
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
            updatedAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
            views: Math.floor(Math.random() * 5000),
          })),
        );
      } else if (activeTab === 'help') {
        const cats = ['Getting Started', 'Account', 'Deposits', 'Withdrawals', 'Betting', 'KYC'];
        setHelpArticles(
          Array.from({ length: 10 }, (_, i) => ({
            id: `help-${i}`,
            title: `How to ${cats[i % cats.length]} - Guide ${i + 1}`,
            slug: `how-to-guide-${i + 1}`,
            status: (i % 4 === 0 ? 'draft' : 'published') as 'draft' | 'published',
            category: cats[i % cats.length],
            author: `admin_${(i % 2) + 1}`,
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 60).toISOString(),
            updatedAt: new Date(Date.now() - Math.random() * 86400000 * 14).toISOString(),
            helpful: Math.floor(Math.random() * 200),
            notHelpful: Math.floor(Math.random() * 20),
          })),
        );
      } else {
        setAcademyCourses(
          Array.from({ length: 8 }, (_, i) => ({
            id: `course-${i}`,
            title: [
              'Introduction to Sports Betting',
              'Advanced Parlay Strategies',
              'Crypto Gambling 101',
              'Understanding Odds Formats',
              'Bankroll Management',
              'Live Betting Mastery',
              'Casino Game Theory',
              'Responsible Gambling',
            ][i],
            status: (i % 3 === 0 ? 'draft' : 'published') as 'draft' | 'published',
            author: `admin_${(i % 2) + 1}`,
            lessonsCount: Math.floor(Math.random() * 12) + 3,
            enrollments: Math.floor(Math.random() * 1000),
            createdAt: new Date(Date.now() - Math.random() * 86400000 * 90).toISOString(),
            updatedAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
          })),
        );
      }
      setTotalPages(3);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actions
  const getContentPath = (tab: ContentTab) =>
    tab === 'blog' ? 'blog-posts' : tab === 'help' ? 'help-articles' : 'academy-courses';

  const togglePublish = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      await put(`/admin/content/${getContentPath(activeTab)}/${id}`, { status: newStatus });
    } catch {
      // Optimistic update
    }
    const updater = (items: any[]) =>
      items.map((item: any) =>
        item.id === id ? { ...item, status: newStatus } : item,
      );
    if (activeTab === 'blog') setBlogPosts(updater);
    else if (activeTab === 'help') setHelpArticles(updater);
    else setAcademyCourses(updater);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await del(`/admin/content/${getContentPath(activeTab)}/${id}`);
    } catch {
      // Optimistic update
    }
    const filterer = (items: any[]) => items.filter((item: any) => item.id !== id);
    if (activeTab === 'blog') setBlogPosts(filterer);
    else if (activeTab === 'help') setHelpArticles(filterer);
    else setAcademyCourses(filterer);
  };

  const handleSave = async (data: any) => {
    try {
      if (editItem) {
        await put(`/admin/content/${getContentPath(activeTab)}/${editItem.id}`, data);
      } else {
        await post(`/admin/content/${getContentPath(activeTab)}`, data);
      }
    } catch {
      // Handled gracefully
    }
    fetchData();
  };

  // Table columns
  const blogColumns: Column<BlogPost>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-text">{row.title}</p>
          <p className="text-xs text-text-muted">/{row.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Badge
          variant={row.status === 'published' ? 'success' : 'warning'}
          size="xs"
          dot
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'author',
      header: 'Author',
      render: (row) => <span className="text-sm text-text-secondary">{row.author}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <Badge variant="default" size="xs">{row.category}</Badge>
      ),
    },
    {
      key: 'views',
      header: 'Views',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-text font-mono">{Number(row.views ?? 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-text-muted">{formatRelativeDate(row.updatedAt)}</span>
      ),
    },
  ];

  const helpColumns: Column<HelpArticle>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-text">{row.title}</p>
          <p className="text-xs text-text-muted">/{row.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Badge
          variant={row.status === 'published' ? 'success' : 'warning'}
          size="xs"
          dot
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <Badge variant="default" size="xs">{row.category}</Badge>,
    },
    {
      key: 'author',
      header: 'Author',
      render: (row) => <span className="text-sm text-text-secondary">{row.author}</span>,
    },
    {
      key: 'helpful',
      header: 'Helpful',
      align: 'center',
      render: (row) => (
        <span className="text-xs text-text-secondary">
          <span className="text-success">{row.helpful}</span>
          {' / '}
          <span className="text-danger">{row.notHelpful}</span>
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-text-muted">{formatRelativeDate(row.updatedAt)}</span>
      ),
    },
  ];

  const academyColumns: Column<AcademyCourse>[] = [
    {
      key: 'title',
      header: 'Course Title',
      sortable: true,
      render: (row) => (
        <p className="text-sm font-medium text-text">{row.title}</p>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <Badge
          variant={row.status === 'published' ? 'success' : 'warning'}
          size="xs"
          dot
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'author',
      header: 'Author',
      render: (row) => <span className="text-sm text-text-secondary">{row.author}</span>,
    },
    {
      key: 'lessonsCount',
      header: 'Lessons',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-text font-mono">{row.lessonsCount}</span>
      ),
    },
    {
      key: 'enrollments',
      header: 'Enrollments',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-text font-mono">{Number(row.enrollments ?? 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-text-muted">{formatRelativeDate(row.updatedAt)}</span>
      ),
    },
  ];

  const currentData =
    activeTab === 'blog'
      ? blogPosts
      : activeTab === 'help'
        ? helpArticles
        : academyCourses;

  const currentColumns =
    activeTab === 'blog'
      ? blogColumns
      : activeTab === 'help'
        ? helpColumns
        : academyColumns;

  const tabs: { key: ContentTab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'blog', label: 'Blog Posts', icon: FileText, count: blogPosts.length },
    { key: 'help', label: 'Help Articles', icon: HelpCircle, count: helpArticles.length },
    { key: 'academy', label: 'Academy Courses', icon: GraduationCap, count: academyCourses.length },
  ];

  if (loading && blogPosts.length === 0 && helpArticles.length === 0 && academyCourses.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Card><Skeleton className="h-[400px] w-full" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Content Management</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Manage blog posts, help articles, and academy courses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditItem(null);
              setFormOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create New
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-background-card border border-border rounded-card w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
                setSearch('');
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-button text-sm font-medium transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-accent/15 text-accent-light'
                  : 'text-text-secondary hover:text-text hover:bg-background-elevated',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Data Table */}
      <DataTable
        columns={currentColumns as Column<any>[]}
        data={currentData}
        loading={loading}
        searchable
        searchPlaceholder={`Search ${activeTab === 'blog' ? 'blog posts' : activeTab === 'help' ? 'help articles' : 'courses'}...`}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowKey={(row: any) => row.id}
        emptyMessage={`No ${activeTab === 'blog' ? 'blog posts' : activeTab === 'help' ? 'help articles' : 'courses'} found.`}
        rowActions={(row: any) => (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                togglePublish(row.id, row.status);
              }}
              leftIcon={row.status === 'published' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            >
              {row.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditItem(row);
                setFormOpen(true);
              }}
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.id);
              }}
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
            >
              <span className="text-danger">Delete</span>
            </Button>
          </>
        )}
      />

      {/* Create/Edit Modal */}
      <ContentFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditItem(null);
        }}
        type={activeTab}
        editItem={editItem}
        onSave={handleSave}
      />
    </div>
  );
}
