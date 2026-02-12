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
      {/* Fixed Top Navigation - 60px */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[60px]">
        <TopNav />
      </div>

      {/* Fixed Left Sidebar - 220px (desktop only) */}
      <aside className="hidden lg:block fixed top-[60px] left-0 bottom-0 w-[220px] z-40 overflow-y-auto bg-[#111214]">
        <SportsSidebar />
      </aside>

      {/* Main Content Area */}
      <main
        className="flex-1 flex flex-col min-h-[calc(100vh-60px)] pt-[60px] lg:ml-[220px] xl:mr-[300px] pb-[calc(52px+env(safe-area-inset-bottom))] lg:pb-0"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <div className="flex-1">{children}</div>
        <Footer />
      </main>

      {/* Fixed Right Bet Slip Panel - 300px (xl+ only) */}
      <aside className="hidden xl:block fixed top-[60px] right-0 bottom-0 w-[300px] z-40 bg-[#111214]">
        <BetSlipPanel />
      </aside>

      {/* Mobile Bet Slip (accessed via modal/drawer, rendered in DOM but hidden) */}
      <div className="xl:hidden">
        <BetSlipPanel />
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
        className="min-h-screen flex flex-col bg-[#0F0F12]"
      >
        {/* Top Nav Skeleton - 60px */}
        <div
          className="h-[60px] flex items-center px-4 lg:px-6 gap-4 shrink-0 bg-[#1A1B1F] border-b border-white/[0.08]"
        >
          <div className="w-10 h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          <div className="flex-1" />
          <div className="w-24 h-9 rounded-lg bg-white/[0.03] animate-pulse" />
          <div className="w-20 h-9 rounded-lg bg-white/[0.03] animate-pulse" />
        </div>

        <div className="flex flex-1">
          {/* Sidebar Skeleton - 220px (desktop only) */}
          <div
            className="hidden lg:block w-[220px] shrink-0 p-3 space-y-2 overflow-y-auto bg-[#111214]"
          >
            {[...Array(12)].map((_, i) => (
              <div key={i} className="h-9 rounded bg-white/[0.03] animate-pulse" />
            ))}
          </div>

          {/* Main Content Skeleton */}
          <div
            className="flex-1 p-4 lg:p-6 space-y-4 min-h-[calc(100vh-60px)] pb-[calc(52px+env(safe-area-inset-bottom))] lg:pb-0"
            style={{
              paddingLeft: 'env(safe-area-inset-left)',
              paddingRight: 'env(safe-area-inset-right)',
            }}
          >
            {/* Title skeleton */}
            <div className="h-10 w-48 rounded-lg bg-white/[0.03] animate-pulse" />

            {/* Hero banner skeleton */}
            <div className="h-48 w-full rounded-2xl bg-white/[0.03] animate-pulse" />

            {/* Grid of cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          </div>

          {/* Bet Slip Skeleton - 300px (xl+ only) */}
          <div
            className="hidden xl:block w-[300px] shrink-0 p-4 bg-[#111214]"
          >
            <div className="h-10 rounded-lg bg-white/[0.03] animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Nav Skeleton (mobile only) */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 h-[52px] flex items-center justify-around px-4 z-50 bg-[#1A1B1F] border-t border-white/[0.08]"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-6 h-6 rounded bg-white/[0.03] animate-pulse" />
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
