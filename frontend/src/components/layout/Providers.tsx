'use client';

import React, { useEffect } from 'react';
import { Toaster } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Client-side Providers
// ---------------------------------------------------------------------------

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const init = useAuthStore.getState().initialize;
    init();
  }, []); // Empty deps, runs once

  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
}
