'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Lock,
  Settings,
  CheckCircle2,
  MessageCircle,
  Mail,
  Gift,
  LogOut,
  ChevronRight,
  Trophy,
} from 'lucide-react';

// ─── VIP Tier Definitions ──────────────────────────────────────────
const VIP_TIERS = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'EMERALD',
  'SAPPHIRE',
  'RUBY',
  'DIAMOND',
  'BLUE_DIAMOND',
] as const;

const VIP_TIER_COLORS: Record<string, string> = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  EMERALD: '#50C878',
  SAPPHIRE: '#0F52BA',
  RUBY: '#E0115F',
  DIAMOND: '#B9F2FF',
  BLUE_DIAMOND: '#4FC3F7',
};

function getVipProgress(tier: string): { current: number; next: string | null; percent: number } {
  const idx = VIP_TIERS.indexOf(tier as (typeof VIP_TIERS)[number]);
  if (idx === -1) return { current: 0, next: VIP_TIERS[1], percent: 0 };
  if (idx >= VIP_TIERS.length - 1) return { current: idx, next: null, percent: 100 };
  // Simulate progress within current tier (in a real app this comes from the API)
  return { current: idx, next: VIP_TIERS[idx + 1], percent: Math.min(65, (idx + 1) * 15) };
}

function formatTierName(tier: string): string {
  return tier
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Responsive Hook ───────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}

// ─── Component ─────────────────────────────────────────────────────
interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const isMobile = useIsMobile();

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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

  if (!user) return null;

  const isVerified = user.kycLevel !== 'NONE' && user.kycLevel !== 'none';
  const vipTier = user.vipTier || 'BRONZE';
  const vipInfo = getVipProgress(vipTier);
  const tierColor = VIP_TIER_COLORS[vipTier] || VIP_TIER_COLORS.BRONZE;

  const initials = user.username
    ? user.username
        .split(/[\s_-]+/)
        .map((w) => w.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const handleSignOut = async () => {
    await logout();
    onClose();
    router.push('/');
  };

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href);
  };

  // ── Framer Motion Variants ──────────────────────────────────────
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const panelVariantsDesktop = {
    hidden: { x: 320 },
    visible: { x: 0 },
    exit: { x: 320 },
  };

  const panelVariantsMobile = {
    hidden: { y: '100%' },
    visible: { y: 0 },
    exit: { y: '100%' },
  };

  const transition = {
    type: 'spring' as const,
    damping: 30,
    stiffness: 300,
  };

  // ── Section Link Item ───────────────────────────────────────────
  const MenuItem = ({
    icon: Icon,
    label,
    href,
    badge,
    onClick,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href?: string;
    badge?: boolean;
    onClick?: () => void;
  }) => {
    const content = (
      <span className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-colors group cursor-pointer">
        <span className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-gray-400" />
          {label}
        </span>
        <span className="flex items-center gap-2">
          {badge && <span className="w-2 h-2 bg-accent-red rounded-full" />}
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
        </span>
      </span>
    );

    if (href) {
      return (
        <Link href={href} onClick={onClose} className="block">
          {content}
        </Link>
      );
    }

    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  };

  // ── Panel Content ───────────────────────────────────────────────
  const panelContent = (
    <div className="flex flex-col h-full">
      {/* ── 1. Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
        <h2 className="text-base font-semibold text-white">Account</h2>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222328] rounded-lg transition-colors"
          aria-label="Close account menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Scrollable Body ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin overscroll-contain">
        {/* ── 2. User Profile ──────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-12 h-12 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #C084FC 100%)',
                }}
              >
                {initials}
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
          <Link
            href="/account"
            onClick={onClose}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-300 hover:bg-[#222328] rounded-lg transition-colors group"
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              My profile
            </span>
            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
          </Link>
        </div>

        {/* ── 3. Wallet Section ────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Wallet
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleNavigate('/wallet?action=deposit')}
              className="flex flex-col items-center gap-1.5 px-3 py-3 bg-[#222328] hover:bg-[#2A2B30] rounded-lg transition-colors text-center"
            >
              <div className="w-9 h-9 rounded-full bg-accent-green/15 flex items-center justify-center">
                <ArrowDownToLine className="w-4.5 h-4.5 text-accent-green" />
              </div>
              <span className="text-xs text-gray-300">Deposit</span>
            </button>
            <button
              onClick={() => handleNavigate('/wallet?action=withdraw')}
              className="flex flex-col items-center gap-1.5 px-3 py-3 bg-[#222328] hover:bg-[#2A2B30] rounded-lg transition-colors text-center"
            >
              <div className="w-9 h-9 rounded-full bg-accent-red/15 flex items-center justify-center">
                <ArrowUpFromLine className="w-4.5 h-4.5 text-accent-red" />
              </div>
              <span className="text-xs text-gray-300">Withdraw</span>
            </button>
            <button
              onClick={() => handleNavigate('/wallet?tab=history')}
              className="flex flex-col items-center gap-1.5 px-3 py-3 bg-[#222328] hover:bg-[#2A2B30] rounded-lg transition-colors text-center"
            >
              <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <span className="text-xs text-gray-300">History</span>
            </button>
          </div>
        </div>

        {/* ── 4. Account Section ───────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Account
          </p>
          <nav className="space-y-0.5">
            <MenuItem icon={Lock} label="Security" href="/account?tab=security" />
            <MenuItem icon={Settings} label="Preferences" href="/account?tab=preferences" />
            <MenuItem
              icon={CheckCircle2}
              label="Verification"
              href="/account?tab=verification"
              badge={!isVerified}
            />
          </nav>
        </div>

        {/* ── 5. Support Section ───────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <nav className="space-y-0.5">
            <MenuItem icon={MessageCircle} label="Live Support" href="/support" />
            <MenuItem icon={Mail} label="Inbox" href="/notifications" badge />
            <MenuItem icon={Gift} label="Promo Code" href="/promotions/redeem" />
          </nav>
        </div>

        {/* ── 6. VIP Status ────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <button
            onClick={() => handleNavigate('/vip')}
            className="w-full bg-[#222328] hover:bg-[#2A2B30] rounded-lg p-4 transition-colors text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4" style={{ color: tierColor }} />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  VIP Status
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-sm font-bold text-white mb-2" style={{ color: tierColor }}>
              {formatTierName(vipTier)}
            </p>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-[#1A1B1F] rounded-full overflow-hidden mb-1.5">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: tierColor }}
                initial={{ width: 0 }}
                animate={{ width: `${vipInfo.percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            {vipInfo.next ? (
              <p className="text-[11px] text-gray-500">
                {vipInfo.percent}% to {formatTierName(vipInfo.next)}
              </p>
            ) : (
              <p className="text-[11px] text-gray-500">Max tier reached</p>
            )}
          </button>
        </div>

        {/* ── 7. Sign Out ──────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white bg-[#222328] hover:bg-[#2A2B30] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            key="account-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          {isMobile ? (
            /* ── Mobile: Bottom Sheet ─────────────────────────────── */
            <motion.div
              key="account-panel-mobile"
              variants={panelVariantsMobile}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={transition}
              className="fixed bottom-0 left-0 right-0 z-[101] bg-[#1A1B1F] rounded-t-[16px] flex flex-col"
              style={{ maxHeight: '90vh' }}
              role="dialog"
              aria-modal="true"
              aria-label="Account menu"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag indicator */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              {panelContent}
            </motion.div>
          ) : (
            /* ── Desktop: Right Panel ─────────────────────────────── */
            <motion.div
              key="account-panel-desktop"
              variants={panelVariantsDesktop}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={transition}
              className="fixed top-0 right-0 bottom-0 z-[101] w-[320px] bg-[#1A1B1F] flex flex-col"
              style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.4)' }}
              role="dialog"
              aria-modal="true"
              aria-label="Account menu"
              onClick={(e) => e.stopPropagation()}
            >
              {panelContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
