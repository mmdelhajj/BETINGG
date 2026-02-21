'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Trophy,
  Dice5,
  Gift,
  ShieldCheck,
  FileText,
  Settings,
  FileBarChart,
  ChevronRight,
  ChevronLeft,
  Shield,
  Target,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Finance', href: '/admin/finance', icon: Wallet },
  { label: 'Betting', href: '/admin/betting', icon: Target },
  { label: 'Casino', href: '/admin/casino', icon: Dice5 },
  { label: 'Sports', href: '/admin/sports', icon: Trophy },
  { label: 'KYC', href: '/admin/kyc', icon: ShieldCheck },
  { label: 'Promotions', href: '/admin/promotions', icon: Gift },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Reports', href: '/admin/reports', icon: FileBarChart },
];

// ---------------------------------------------------------------------------
// AdminSidebar
// ---------------------------------------------------------------------------

export interface AdminSidebarProps {
  className?: string;
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-background-card border-r border-border transition-all duration-300',
        collapsed ? 'w-[64px]' : 'w-[240px]',
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-text truncate">CryptoBet</h1>
            <p className="text-[10px] text-accent-light font-medium tracking-wider uppercase">
              Admin
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-button text-sm font-medium transition-all duration-200 border',
                collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                active
                  ? 'bg-accent/15 text-accent-light border-accent/25'
                  : 'text-text-secondary hover:text-text hover:bg-background-elevated border-transparent',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  active && 'text-accent',
                )}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {active && (
                    <ChevronRight className="w-3 h-3 text-accent opacity-60" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-2 w-full rounded-button py-2 text-xs text-text-muted hover:text-text hover:bg-background-elevated transition-colors',
            collapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
