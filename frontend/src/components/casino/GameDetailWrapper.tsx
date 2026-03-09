'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Star, CheckCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameDetailWrapperProps {
  gameName: string;
  gameSlug: string;
  description: string;
  rtp: number;
  category: 'Arcade' | 'Table' | 'Slots' | 'Instant' | 'Card' | 'Provably Fair';
  gradient: string; // tailwind gradient classes
  icon: string; // emoji
  children: React.ReactNode; // the actual game
}

// ---------------------------------------------------------------------------
// Breakpoint hook — detect lg+ for auto-skip behavior
// ---------------------------------------------------------------------------

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GameDetailWrapper({
  gameName,
  gameSlug,
  description,
  rtp,
  category,
  gradient,
  icon,
  children,
}: GameDetailWrapperProps) {
  const isDesktop = useIsDesktop();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // On desktop (lg+), skip the detail view entirely
  const showGame = isDesktop || isPlaying;

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handleBack = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // =========================================================================
  // Game View (playing state or desktop)
  // =========================================================================

  if (showGame) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="game-view"
          initial={isDesktop ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {/* Back button — only on mobile when user clicked Play */}
          {!isDesktop && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="mb-3"
            >
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-button bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200 text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to details
              </button>
            </motion.div>
          )}

          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  // =========================================================================
  // Detail / Preview View (mobile only)
  // =========================================================================

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="detail-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="space-y-4 pb-24"
      >
        {/* Back to casino link */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Link
            href="/casino"
            className="inline-flex items-center gap-1.5 text-sm text-[#8B949E] hover:text-[#E6EDF3] transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Casino
          </Link>
        </motion.div>

        {/* ----------------------------------------------------------------- */}
        {/* 1. Game Title + Subtitle                                          */}
        {/* ----------------------------------------------------------------- */}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <h1 className="text-2xl font-bold text-[#E6EDF3]">{gameName}</h1>
          <p className="text-sm text-[#8B949E] mt-0.5">by CryptoBet</p>
        </motion.div>

        {/* ----------------------------------------------------------------- */}
        {/* 2. Hero Image Area                                                */}
        {/* ----------------------------------------------------------------- */}

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={cn(
            'relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br flex items-center justify-center',
            gradient
          )}
        >
          {/* RTP Badge — top right */}
          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 bg-black/50 rounded-lg text-xs font-bold text-white">
              {rtp}% RTP
            </span>
          </div>

          {/* Centered game icon */}
          <span className="text-8xl drop-shadow-2xl select-none">{icon}</span>

          {/* Bottom gradient overlay for depth */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0D1117]/60 to-transparent" />
        </motion.div>

        {/* ----------------------------------------------------------------- */}
        {/* 3. Play Button                                                    */}
        {/* ----------------------------------------------------------------- */}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <button
            onClick={handlePlay}
            className="w-full h-12 rounded-xl bg-[#C8FF00] text-black font-bold text-base hover:bg-[#D4FF33] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-[#C8FF00]/20"
          >
            Play
          </button>
        </motion.div>

        {/* ----------------------------------------------------------------- */}
        {/* 4. Demo Play Link                                                 */}
        {/* ----------------------------------------------------------------- */}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="text-center"
        >
          <button
            onClick={handlePlay}
            className="text-sm font-medium text-[#C8FF00]/80 hover:text-[#C8FF00] transition-colors duration-200"
          >
            Demo play
          </button>
        </motion.div>

        {/* ----------------------------------------------------------------- */}
        {/* 5. Details Card                                                   */}
        {/* ----------------------------------------------------------------- */}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.25 }}
          className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 space-y-3.5"
        >
          {/* RTP row */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8B949E]">RTP</span>
            <span className="text-sm font-bold text-[#E6EDF3]">{rtp}%</span>
          </div>

          {/* Divider */}
          <div className="border-t border-[#30363D]" />

          {/* Studio row */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8B949E]">Studio</span>
            <span className="text-sm font-semibold text-[#8B5CF6]">CryptoBet</span>
          </div>

          {/* Divider */}
          <div className="border-t border-[#30363D]" />

          {/* Provably fair row */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8B949E]">Provably fair</span>
            <CheckCircle className="w-5 h-5 text-[#10B981]" />
          </div>

          {/* Divider */}
          <div className="border-t border-[#30363D]" />

          {/* Category tag */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8B949E]">Category</span>
            <span className="px-3 py-1 bg-[#1C2128] text-text-secondary text-xs font-medium rounded-full">
              {category}
            </span>
          </div>
        </motion.div>

        {/* ----------------------------------------------------------------- */}
        {/* 6. Description Card                                               */}
        {/* ----------------------------------------------------------------- */}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.3 }}
          className="bg-[#161B22] border border-[#30363D] rounded-xl p-4"
        >
          {/* Header with game name, subtitle, and favorite icon */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-[#E6EDF3]">{gameName}</h2>
              <p className="text-xs text-[#8B949E] mt-0.5">by CryptoBet</p>
            </div>
            <button
              onClick={() => setIsFavorited(!isFavorited)}
              className="p-1.5 rounded-lg hover:bg-[#1C2128] transition-colors duration-200"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={cn(
                  'w-5 h-5 transition-colors duration-200',
                  isFavorited
                    ? 'text-[#F59E0B] fill-[#F59E0B]'
                    : 'text-[#8B949E] hover:text-[#E6EDF3]'
                )}
              />
            </button>
          </div>

          {/* Description text */}
          <p className="text-sm text-[#8B949E] leading-relaxed">{description}</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
