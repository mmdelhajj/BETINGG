'use client';

import React from 'react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BetSlip from '@/components/layout/BetSlip';
import BottomNav from '@/components/layout/BottomNav';
import Footer from '@/components/layout/Footer';

// ---------------------------------------------------------------------------
// Main App Layout
// ---------------------------------------------------------------------------

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Body: Sidebar + Content + Right Sidebar */}
      <div className="flex flex-1">
        {/* Left Sidebar (desktop only) */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 p-4 lg:p-6 pb-16 lg:pb-6">{children}</div>
          <Footer />
        </main>

        {/* Right Sidebar: Bet Slip (desktop only) */}
        <aside className="hidden lg:flex flex-col w-[320px] shrink-0 border-l border-border h-[calc(100vh-64px)] sticky top-16 overflow-y-auto scrollbar-hide bg-background-card">
          <BetSlip />
        </aside>
      </div>

      {/* BetSlip mobile overlay (rendered outside aside so it's not hidden) */}
      <div className="lg:hidden">
        <BetSlip />
      </div>

      {/* Bottom Nav (mobile only) */}
      <BottomNav />
    </div>
  );
}
