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
      <div className="flex flex-1 pt-14 lg:pt-[60px]">
        {/* Left: Sports Sidebar (desktop only) */}
        <div className="hidden lg:block fixed top-[60px] left-0 bottom-0 w-[240px] z-40 overflow-y-auto">
          <SportsSidebar />
        </div>

        {/* Center: Main scrollable content */}
        <main
          className="flex-1 flex flex-col min-h-[calc(100vh-56px)] lg:min-h-[calc(100vh-60px)] pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0 lg:ml-[240px] lg:mr-[320px]"
          style={{
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
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
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: '#0F0F12' }}
      >
        {/* Top nav skeleton - 56px mobile, 60px desktop */}
        <div
          className="h-14 lg:h-[60px] flex items-center px-4 gap-4 shrink-0"
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
        <div className="flex flex-1 pt-14 lg:pt-[60px]">
          {/* Sidebar skeleton (desktop only) */}
          <div
            className="hidden lg:block w-[240px] shrink-0 p-3 space-y-3 overflow-y-auto"
            style={{ backgroundColor: '#111214' }}
          >
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-white/5 animate-pulse" />
            ))}
          </div>

          {/* Main content skeleton */}
          <div
            className="flex-1 p-4 lg:p-6 space-y-4 min-h-[calc(100vh-56px)] lg:min-h-[calc(100vh-60px)] pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0"
            style={{
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
            }}
          >
            <div className="h-10 w-48 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-48 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          </div>

          {/* Betslip skeleton (desktop only) */}
          <div
            className="hidden lg:block w-[320px] shrink-0 p-4"
            style={{ backgroundColor: '#111214' }}
          >
            <div className="h-10 rounded-lg bg-white/5 animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom nav skeleton (mobile only) */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 h-14 flex items-center justify-around px-4 z-50"
          style={{
            backgroundColor: '#1A1B1F',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-6 h-6 rounded bg-white/5 animate-pulse" />
          ))}
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
