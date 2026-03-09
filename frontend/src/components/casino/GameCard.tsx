'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameCardProps {
  id: string;
  name: string;
  slug: string;
  thumbnail?: string;
  provider: string;
  houseEdge?: number;
  rtp?: number;
  isPopular?: boolean;
  isNew?: boolean;
  isHot?: boolean;
  category?: string;
  gradient?: string;
  icon?: string;
  index?: number;
  size?: 'sm' | 'md' | 'lg';
}

// ---------------------------------------------------------------------------
// Gradient map for game thumbnails
// ---------------------------------------------------------------------------

export const GAME_GRADIENTS: Record<string, string> = {
  crash: 'from-red-600 to-orange-500',
  dice: 'from-amber-600 to-yellow-400',
  mines: 'from-pink-500 to-purple-600',
  plinko: 'from-green-500 to-emerald-400',
  coinflip: 'from-yellow-400 to-amber-500',
  limbo: 'from-blue-600 to-cyan-400',
  hilo: 'from-violet-600 to-purple-400',
  tower: 'from-indigo-600 to-blue-500',
  wheel: 'from-purple-500 to-pink-500',
  keno: 'from-teal-500 to-green-400',
  blackjack: 'from-emerald-700 to-green-500',
  roulette: 'from-red-700 to-red-500',
  baccarat: 'from-amber-700 to-yellow-500',
  videopoker: 'from-blue-700 to-indigo-500',
  sicbo: 'from-orange-600 to-red-400',
  craps: 'from-green-600 to-lime-400',
  faro: 'from-rose-600 to-pink-400',
  poker: 'from-emerald-600 to-teal-400',
  slots: 'from-purple-600 to-violet-400',
  slots5: 'from-fuchsia-600 to-purple-400',
  jackpotslots: 'from-yellow-500 to-orange-500',
  rps: 'from-cyan-500 to-blue-400',
  numberguess: 'from-sky-500 to-indigo-400',
  scratchcard: 'from-lime-500 to-green-400',
  thimbles: 'from-amber-500 to-orange-400',
  dragontower: 'from-red-500 to-purple-600',
  aviator: 'from-red-500 to-rose-400',
  trenball: 'from-green-500 to-teal-400',
  caseopening: 'from-yellow-500 to-amber-400',
  bingo: 'from-blue-500 to-purple-400',
  minesweeper: 'from-gray-500 to-slate-400',
  wheelofmillions: 'from-yellow-400 to-amber-500',
  horseracing: 'from-amber-700 to-orange-500',
  ludo: 'from-red-400 to-blue-500',
  virtualsports: 'from-green-400 to-emerald-600',
};

export const GAME_ICONS: Record<string, string> = {
  crash: '🚀', dice: '🎲', mines: '💎', plinko: '⚡', coinflip: '🪙',
  limbo: '🎯', hilo: '🃏', tower: '🏗️', wheel: '🎡', keno: '🔢',
  blackjack: '♠️', roulette: '🎰', baccarat: '👑', videopoker: '🃏',
  sicbo: '🎲', craps: '🎯', faro: '🂡', poker: '♣️', slots: '🍒',
  slots5: '🎰', jackpotslots: '💰', rps: '✊', numberguess: '🔮',
  scratchcard: '🎫', thimbles: '🏆', dragontower: '🐉', aviator: '✈️',
  trenball: '⚽', caseopening: '📦', bingo: '🅱️', minesweeper: '💣',
  wheelofmillions: '🏆', horseracing: '🏇', ludo: '🎲', virtualsports: '🏟️',
};

// ---------------------------------------------------------------------------
// Component — Cloudbet-style game card for horizontal scroll rows
// ---------------------------------------------------------------------------

function GameCard({
  name,
  slug,
  thumbnail,
  provider,
  rtp,
  isPopular,
  isNew,
  isHot,
  gradient,
  icon,
  index = 0,
  size = 'md',
}: GameCardProps) {
  const gradientClass = gradient || GAME_GRADIENTS[slug] || 'from-gray-600 to-slate-500';
  const gameIcon = icon || GAME_ICONS[slug];
  const [imgError, setImgError] = useState(false);
  const showFallback = !thumbnail || imgError;

  const sizeClasses = {
    sm: 'w-[100px]',
    md: 'w-[130px]',
    lg: 'w-[160px]',
  };

  const thumbSizeClasses = {
    sm: 'h-[100px]',
    md: 'h-[130px]',
    lg: 'h-[160px]',
  };

  const iconSize = {
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-5xl',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.03, ease: 'easeOut' }}
      className={cn('flex-shrink-0', sizeClasses[size])}
    >
      <Link href={`/casino/${slug}`} className="block group">
        {/* Thumbnail */}
        <div className={cn('relative rounded-xl overflow-hidden', thumbSizeClasses[size])}>
          {!showFallback ? (
            <img
              src={thumbnail}
              alt={name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className={cn(
                'w-full h-full bg-gradient-to-br flex flex-col items-center justify-center',
                gradientClass
              )}
            >
              {gameIcon ? (
                <span className={cn('drop-shadow-lg group-hover:scale-110 transition-transform duration-200', iconSize[size])}>
                  {gameIcon}
                </span>
              ) : (
                <Gamepad2 className="w-8 h-8 text-white/40" />
              )}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {isHot && rtp && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#EF4444]/90 rounded text-[9px] font-bold text-white">
                🔥 {rtp}% RTP
              </span>
            )}
            {isNew && (
              <span className="px-1.5 py-0.5 bg-[#10B981]/90 rounded text-[9px] font-bold text-white">
                NEW
              </span>
            )}
            {isPopular && !isHot && (
              <span className="px-1.5 py-0.5 bg-[#F59E0B]/90 rounded text-[9px] font-bold text-black">
                HOT
              </span>
            )}
          </div>

          {/* RTP badge (top-right, only if not already showing in hot badge) */}
          {rtp && !isHot && rtp >= 98 && (
            <div className="absolute top-1.5 right-1.5">
              <span className="px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-bold text-[#C8FF00]">
                {rtp}% RTP
              </span>
            </div>
          )}
        </div>

        {/* Name + Provider */}
        <div className="mt-1.5 px-0.5">
          <p className="text-xs font-semibold text-[#E6EDF3] truncate leading-tight">
            {name}
          </p>
          <p className="text-[10px] text-[#8B949E] truncate leading-tight mt-0.5">
            {provider}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

export default React.memo(GameCard);
