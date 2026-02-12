'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  X,
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Shield,
  Settings,
  CheckCircle2,
  MessageCircle,
  Inbox,
  Tag,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !user) return null;

  const isVerified = user.kycLevel !== 'NONE' && user.kycLevel !== 'none';

  const handleSignOut = async () => {
    await logout();
    onClose();
    router.push('/');
  };

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed z-[101] md:inset-0 md:flex md:items-center md:justify-center inset-y-0 right-0 w-full max-w-[380px] md:relative md:w-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
      >
        <div
          className="h-full md:h-auto w-full md:max-w-[380px] bg-[#1A1B1F] md:rounded-lg overflow-y-auto scrollbar-thin animate-slide-right md:animate-modal"
          style={{ boxShadow: '0px 8px 32px rgba(0,0,0,0.32)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
            <h2 className="text-base font-semibold text-white">Account</h2>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222328] rounded-lg transition-fast"
              aria-label="Close account menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile section */}
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-3 mb-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0">
                  {user.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.username}</p>
                {isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs text-accent-green mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Account Verified
                  </span>
                )}
                {!isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs text-accent-yellow mt-0.5">
                    Unverified
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleNavigate('/account')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-fast group"
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                My profile
              </span>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
            </button>
          </div>

          {/* Wallet section */}
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Wallet
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleNavigate('/wallet?action=deposit')}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-[#222328] hover:bg-[#2A2B30] rounded-lg transition-fast text-center"
              >
                <ArrowDownToLine className="w-5 h-5 text-accent-green" />
                <span className="text-xs text-gray-300">Deposit</span>
              </button>
              <button
                onClick={() => handleNavigate('/wallet?action=withdraw')}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-[#222328] hover:bg-[#2A2B30] rounded-lg transition-fast text-center"
              >
                <ArrowUpFromLine className="w-5 h-5 text-brand-400" />
                <span className="text-xs text-gray-300">Withdraw</span>
              </button>
              <button
                onClick={() => handleNavigate('/wallet?tab=history')}
                className="flex flex-col items-center gap-1.5 px-3 py-3 bg-[#222328] hover:bg-[#2A2B30] rounded-lg transition-fast text-center"
              >
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-300">History</span>
              </button>
            </div>
          </div>

          {/* Account settings section */}
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Account
            </p>
            <nav className="space-y-0.5">
              <button
                onClick={() => handleNavigate('/account#security')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-fast"
              >
                <Shield className="w-4 h-4" />
                Security
              </button>
              <button
                onClick={() => handleNavigate('/account/settings')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-fast"
              >
                <Settings className="w-4 h-4" />
                Preferences
              </button>
              <button
                onClick={() => handleNavigate('/account#verification')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-fast"
              >
                <CheckCircle2 className="w-4 h-4" />
                Verification
                {!isVerified && (
                  <span className="ml-auto w-2 h-2 bg-accent-yellow rounded-full" />
                )}
              </button>
            </nav>
          </div>

          {/* Support & extras section */}
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <nav className="space-y-0.5">
              <button
                onClick={() => handleNavigate('/support')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-fast"
              >
                <MessageCircle className="w-4 h-4" />
                Live support
              </button>
              <button
                onClick={() => handleNavigate('/notifications')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-fast"
              >
                <Inbox className="w-4 h-4" />
                Inbox
              </button>
              <button
                onClick={() => handleNavigate('/promotions/redeem')}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-fast"
              >
                <Tag className="w-4 h-4" />
                Promo code
              </button>
            </nav>
          </div>

          {/* Sign out */}
          <div className="px-5 py-4">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-accent-red hover:bg-[#222328] rounded-lg transition-fast"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
