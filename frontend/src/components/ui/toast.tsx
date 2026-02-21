'use client';

import React from 'react';
import toast, { Toaster as HotToaster, type ToastPosition } from 'react-hot-toast';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Toast Toaster Provider
// ---------------------------------------------------------------------------

interface ToasterProps {
  position?: ToastPosition;
}

function Toaster({ position = 'top-right' }: ToasterProps) {
  return (
    <HotToaster
      position={position}
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#161B22',
          color: '#E6EDF3',
          border: '1px solid #30363D',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '14px',
          maxWidth: '420px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        },
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Toast Helpers
// ---------------------------------------------------------------------------

interface ToastOptions {
  duration?: number;
  id?: string;
}

function toastSuccess(message: string, options?: ToastOptions) {
  return toast.custom(
    (t) => (
      <div
        className={cn(
          'flex items-start gap-3 w-full max-w-[420px] bg-background-card border border-success/30 rounded-card p-4 shadow-xl',
          t.visible ? 'animate-slide-up' : 'opacity-0',
        )}
      >
        <CheckCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
        <p className="text-sm text-text flex-1">{message}</p>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-text-muted hover:text-text transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: options?.duration ?? 4000, id: options?.id },
  );
}

function toastError(message: string, options?: ToastOptions) {
  return toast.custom(
    (t) => (
      <div
        className={cn(
          'flex items-start gap-3 w-full max-w-[420px] bg-background-card border border-danger/30 rounded-card p-4 shadow-xl',
          t.visible ? 'animate-slide-up' : 'opacity-0',
        )}
      >
        <XCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
        <p className="text-sm text-text flex-1">{message}</p>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-text-muted hover:text-text transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: options?.duration ?? 5000, id: options?.id },
  );
}

function toastInfo(message: string, options?: ToastOptions) {
  return toast.custom(
    (t) => (
      <div
        className={cn(
          'flex items-start gap-3 w-full max-w-[420px] bg-background-card border border-info/30 rounded-card p-4 shadow-xl',
          t.visible ? 'animate-slide-up' : 'opacity-0',
        )}
      >
        <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
        <p className="text-sm text-text flex-1">{message}</p>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-text-muted hover:text-text transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: options?.duration ?? 4000, id: options?.id },
  );
}

function toastWarning(message: string, options?: ToastOptions) {
  return toast.custom(
    (t) => (
      <div
        className={cn(
          'flex items-start gap-3 w-full max-w-[420px] bg-background-card border border-warning/30 rounded-card p-4 shadow-xl',
          t.visible ? 'animate-slide-up' : 'opacity-0',
        )}
      >
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <p className="text-sm text-text flex-1">{message}</p>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-text-muted hover:text-text transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: options?.duration ?? 4000, id: options?.id },
  );
}

export { Toaster, toastSuccess, toastError, toastInfo, toastWarning };
