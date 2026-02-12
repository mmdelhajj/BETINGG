'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'D' },
  { href: '/admin/users', label: 'Users', icon: 'U' },
  { href: '/admin/payments', label: 'Payments', icon: 'P' },
  { href: '/admin/sportsbook', label: 'Sportsbook', icon: 'S' },
  { href: '/admin/casino', label: 'Casino', icon: 'C' },
  { href: '/admin/rewards', label: 'Rewards', icon: 'R' },
  { href: '/admin/reports', label: 'Reports', icon: 'F' },
  { href: '/admin/risk', label: 'Risk', icon: '!' },
  { href: '/admin/settings', label: 'Settings', icon: 'G' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen -mt-4 -mx-4">
      {/* Sidebar */}
      <aside className="w-56 bg-surface-secondary border-r border-border flex-shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold text-brand-400">Admin Panel</h2>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-gray-400 hover:text-white hover:bg-surface-tertiary'
                )}
              >
                <span className="w-6 h-6 rounded bg-surface-tertiary flex items-center justify-center text-xs font-bold">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
