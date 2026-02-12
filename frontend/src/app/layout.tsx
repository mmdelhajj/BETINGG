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
  defaultOptions: {
    queries: {
      staleTime: 300000,
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Skeleton loader shown before hydration
// ---------------------------------------------------------------------------

function SkeletonLoader() {
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
        {/* Sidebar skeleton */}
        <div
          className="hidden lg:block w-[240px] shrink-0 p-3 space-y-2"
          style={{
            backgroundColor: '#111214',
            borderRight: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton h-8 rounded" />
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-4 lg:p-6 space-y-4">
          <div className="skeleton h-8 w-48 rounded-lg" />
          <div className="skeleton h-64 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Bet slip skeleton */}
        <div
          className="hidden lg:block w-[320px] shrink-0 p-3 space-y-2"
          style={{
            backgroundColor: '#1A1B1F',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="skeleton h-6 w-24 rounded" />
          <div className="skeleton h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell – wraps the layout in providers and manages sidebar / betslip
// ---------------------------------------------------------------------------

function AppShell({ children }: { children: React.ReactNode }) {
  const loadUser = useAuthStore((s) => s.loadUser);
  const loadSports = useSportsStore((s) => s.loadSports);
  useEffect(() => {
    loadUser();
    loadSports();
  }, [loadUser, loadSports]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Fixed Top Navigation ─────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <TopNav />
      </div>

      {/* ── Content area (below fixed header) ────────────────────────── */}
      <div
        className="flex flex-1"
        style={{ paddingTop: 60 }}
      >
        {/* ── Left: Sports Sidebar (desktop only) ──────────────────── */}
        <div className="hidden lg:block fixed top-[60px] left-0 bottom-0 w-[240px] z-40 overflow-y-auto">
          <SportsSidebar />
        </div>

        {/* ── Center: Main scrollable content ──────────────────────── */}
        <main
          className={
            'flex-1 min-h-[calc(100vh-60px)] flex flex-col ' +
            // Mobile: full width with bottom nav padding
            'pb-14 lg:pb-0 ' +
            // Desktop: offset for fixed sidebar
            'lg:ml-[240px] ' +
            // Desktop: offset for bet slip panel (always visible on desktop)
            'lg:mr-[320px]'
          }
        >
          {/* Page content */}
          <div className="flex-1">{children}</div>

          {/* Footer sits below page content inside the scrollable area */}
          <Footer />
        </main>

        {/* ── Right: Bet Slip Panel (desktop sidebar + mobile sheet) ── */}
        <div className="hidden lg:flex fixed top-[60px] right-0 bottom-0 w-[320px] z-40">
          <BetSlipPanel />
        </div>

        {/* Mobile bet slip (bottom sheet + floating button) */}
        <div className="lg:hidden">
          <BetSlipPanel />
        </div>
      </div>

      {/* ── Fixed Bottom Navigation (mobile only) ────────────────────── */}
      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <html lang="en" className="dark">
        <head>
          <meta name="theme-color" content="#0F0F12" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, viewport-fit=cover"
          />
          <meta name="apple-mobile-web-app-capable" content="yes" />
        </head>
        <body
          className="min-h-screen text-white overflow-x-hidden"
          style={{
            backgroundColor: '#0F0F12',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          <SkeletonLoader />
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0F0F12" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className="min-h-screen text-white overflow-x-hidden"
        style={{
          backgroundColor: '#0F0F12',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <QueryClientProvider client={queryClient}>
          <AppShell>{children}</AppShell>
        </QueryClientProvider>
      </body>
    </html>
  );
}
