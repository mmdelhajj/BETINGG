'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Trophy,
  Dice5,
  Gift,
  Star,
  Settings,
  FileBarChart,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  Crown,
  ShieldCheck,
  FileText,
  TrendingUp,
  Target,
} from 'lucide-react';
import { get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Finance', href: '/admin/finance', icon: Wallet },
  { label: 'Betting', href: '/admin/betting', icon: Target },
  { label: 'Sports', href: '/admin/sports', icon: Trophy },
  { label: 'Odds', href: '/admin/odds', icon: TrendingUp },
  { label: 'Casino', href: '/admin/casino', icon: Dice5 },
  { label: 'VIP', href: '/admin/vip', icon: Crown },
  { label: 'Promotions', href: '/admin/promotions', icon: Gift },
  { label: 'Rewards', href: '/admin/rewards', icon: Star },
  { label: 'KYC', href: '/admin/kyc', icon: ShieldCheck },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Reports', href: '/admin/reports', icon: FileBarChart },
  { label: 'Alerts', href: '/admin/alerts', icon: Bell },
];

// ---------------------------------------------------------------------------
// Admin Layout
// ---------------------------------------------------------------------------

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      // Check if user has a token at all
      const token =
        localStorage.getItem('cryptobet_token') ||
        document.cookie.match(/cryptobet_token=([^;]+)/)?.[1] ||
        null;

      if (!token) {
        window.location.href = '/login?redirect=/admin';
        return;
      }

      try {
        const user = await get<AdminUser>('/admin/me');
        // Verify the user has an admin role
        if (!user.role || !['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(user.role)) {
          window.location.href = '/';
          return;
        }
        setAdminUser(user);
        setAuthChecked(true);
      } catch {
        // Auth failed (no valid token, not admin, or endpoint missing) — redirect to login
        window.location.href = '/login?redirect=/admin';
        return;
      }

      try {
        const data = await get<{ unresolved: number }>('/admin/alerts/count');
        setAlertCount(data.unresolved);
      } catch {
        setAlertCount(0);
      }
    }

    checkAuth();
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cryptobet_token');
      localStorage.removeItem('cryptobet_refresh_token');
    }
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  // Show nothing while checking auth (prevents flash of admin UI)
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[240px] bg-background-card border-r border-border flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text">CryptoBet</h1>
            <p className="text-[10px] text-accent-light font-medium tracking-wider uppercase">
              Admin
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-text-muted hover:text-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            const showBadge = item.label === 'Alerts' && alertCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-accent/15 text-accent-light border border-accent/25'
                    : 'text-text-secondary hover:text-text hover:bg-background-elevated border border-transparent',
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', active && 'text-accent')} />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold px-1.5">
                    {alertCount}
                  </span>
                )}
                {active && <ChevronRight className="w-3 h-3 text-accent opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
              {adminUser?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text truncate">
                {adminUser?.username || 'Admin'}
              </p>
              <p className="text-[10px] text-text-muted truncate">
                {adminUser?.email || 'admin@cryptobet.com'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-background-card border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-button text-text-secondary hover:text-text hover:bg-background-elevated transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-text-secondary">
              <span>Admin Panel</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-text font-medium capitalize">
                {pathname === '/admin'
                  ? 'Dashboard'
                  : pathname.split('/').pop()?.replace(/\[.*\]/, 'Detail') || 'Page'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Alert bell */}
            <Link
              href="/admin/alerts"
              className="relative p-2 rounded-button text-text-secondary hover:text-text hover:bg-background-elevated transition-colors"
            >
              <Bell className="w-5 h-5" />
              {alertCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger animate-pulse" />
              )}
            </Link>

            {/* Admin info */}
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
              <div className="text-right">
                <p className="text-sm font-medium text-text">
                  {adminUser?.username || 'Admin'}
                </p>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/15 text-accent-light border border-accent/25">
                  {adminUser?.role?.replace('_', ' ') || 'SUPER ADMIN'}
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                {adminUser?.username?.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-button text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
