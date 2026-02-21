'use client';

import React, { useEffect } from 'react';
import { Toaster } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Client-side Providers
// ---------------------------------------------------------------------------

export default function Providers({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
}
