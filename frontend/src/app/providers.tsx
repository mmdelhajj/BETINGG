'use client';

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
  defaultOptions: {
    queries: {
      staleTime: 300000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell({ children }: { children: React.ReactNode }) {
  const loadUser = useAuthStore((s) => s.loadUser);
  const loadSports = useSportsStore((s) => s.loadSports);

  useEffect(() => {
    loadUser();
    loadSports();
  }, [loadUser, loadSports]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Fixed Top Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <TopNav />
      </div>

      {/* Content area below fixed header */}
      <div className="flex flex-1" style={{ paddingTop: 60 }}>
        {/* Left: Sports Sidebar (desktop only) */}
        <div className="hidden lg:block fixed top-[60px] left-0 bottom-0 w-[240px] z-40 overflow-y-auto">
          <SportsSidebar />
        </div>

        {/* Center: Main scrollable content */}
        <main
          className={
            'flex-1 min-h-[calc(100vh-60px)] flex flex-col ' +
            'pb-14 lg:pb-0 ' +
            'lg:ml-[240px] ' +
            'lg:mr-[320px]'
          }
        >
          <div className="flex-1">{children}</div>
          <Footer />
        </main>

        {/* Right: Bet Slip Panel (desktop) */}
        <div className="hidden lg:flex fixed top-[60px] right-0 bottom-0 w-[320px] z-40">
          <BetSlipPanel />
        </div>

        {/* Mobile bet slip */}
        <div className="lg:hidden">
          <BetSlipPanel />
        </div>
      </div>

      {/* Fixed Bottom Navigation (mobile only) */}
      <BottomNav />
    </div>
  );
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#0F0F12' }}>
        {/* Top nav skeleton */}
        <div
          className="h-[60px] flex items-center px-4 gap-4"
          style={{
            backgroundColor: '#1A1B1F',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
          <div className="flex-1" />
          <div className="w-24 h-8 rounded-lg bg-white/5 animate-pulse" />
          <div className="w-20 h-9 rounded-lg bg-white/5 animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="flex">
          <div
            className="hidden lg:block w-[240px] shrink-0 p-3 space-y-3"
            style={{ backgroundColor: '#111214' }}
          >
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-white/5 animate-pulse" />
            ))}
          </div>
          <div className="flex-1 p-4 lg:p-6 space-y-4">
            <div className="h-10 w-48 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-48 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>{children}</AppShell>
    </QueryClientProvider>
  );
}
