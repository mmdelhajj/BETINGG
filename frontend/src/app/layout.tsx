'use client';

import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { SportsSidebar } from '@/components/layout/SportsSidebar';
import { BetSlipPanel } from '@/components/betting/BetSlipPanel';
import { BottomNav } from '@/components/layout/BottomNav';
import { Footer } from '@/components/layout/Footer';
import { useAuthStore } from '@/stores/authStore';
import { useSportsStore } from '@/stores/sportsStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 300000, refetchOnWindowFocus: false } },
});

function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Top nav skeleton */}
      <div className="h-14 bg-surface-secondary border-b border-border flex items-center px-4 gap-4">
        <div className="skeleton w-24 h-6 rounded" />
        <div className="hidden lg:flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton w-16 h-8 rounded-lg" />
          ))}
        </div>
        <div className="flex-1" />
        <div className="skeleton w-20 h-8 rounded-lg" />
      </div>
      {/* Content skeleton */}
      <div className="flex">
        <div className="hidden lg:block w-56 border-r border-border bg-surface-secondary p-3 space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="skeleton h-8 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 p-4 lg:p-6 space-y-4">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const loadUser = useAuthStore((s) => s.loadUser);
  const loadSports = useSportsStore((s) => s.loadSports);

  useEffect(() => {
    setMounted(true);
    loadUser();
    loadSports();
  }, [loadUser, loadSports]);

  if (!mounted) return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-white">
        <SkeletonLoader />
      </body>
    </html>
  );

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-white">
        <QueryClientProvider client={queryClient}>
          <div className="flex flex-col min-h-screen">
            <TopNav />
            <div className="flex flex-1 overflow-hidden">
              <SportsSidebar />
              <div className="flex-1 overflow-y-auto">
                <main className="p-4 lg:p-6 pb-20 lg:pb-6 min-h-[calc(100vh-3.5rem)]">{children}</main>
                <Footer />
              </div>
              <BetSlipPanel />
            </div>
            <BottomNav />
          </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}
