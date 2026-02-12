'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Gamepad2, Zap, User } from 'lucide-react';
import { useBetSlipStore } from '@/stores/betSlipStore';

interface NavTab {
  href: string;
  label: string;
  icon: typeof Home;
}

const tabs: NavTab[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/sports', label: 'Sports', icon: Trophy },
  { href: '/casino', label: 'Casino', icon: Gamepad2 },
  { href: '/esports', label: 'Esports', icon: Zap },
  { href: '/account', label: 'Account', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const itemCount = useBetSlipStore((s) => s.getItemCount());

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        height: 56,
        backgroundColor: '#1A1B1F',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="flex items-center justify-around h-full">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          const isSports = tab.href === '/sports';

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
              style={{ color: active ? '#8D52DA' : 'rgba(255, 255, 255, 0.5)' }}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                {isSports && itemCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: '#8D52DA' }}
                  >
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
