'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Play, Gamepad2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  category?: string;
  gradient?: string;
  index?: number;
}

// ---------------------------------------------------------------------------
// Gradient map for game thumbnails
// ---------------------------------------------------------------------------

const GAME_GRADIENTS: Record<string, string> = {
  crash: 'from-red-600/50 to-orange-500/40',
  dice: 'from-blue-600/50 to-cyan-400/40',
  mines: 'from-emerald-600/50 to-green-400/40',
  plinko: 'from-yellow-600/50 to-amber-400/40',
  coinflip: 'from-purple-600/50 to-pink-400/40',
  roulette: 'from-red-600/50 to-rose-400/40',
  blackjack: 'from-teal-600/50 to-emerald-400/40',
  hilo: 'from-indigo-600/50 to-blue-400/40',
  wheel: 'from-amber-600/50 to-yellow-400/40',
  tower: 'from-sky-600/50 to-blue-400/40',
  limbo: 'from-violet-600/50 to-purple-400/40',
  keno: 'from-orange-600/50 to-red-400/40',
  'video-poker': 'from-green-600/50 to-teal-400/40',
  baccarat: 'from-rose-600/50 to-pink-400/40',
  slots: 'from-fuchsia-600/50 to-violet-400/40',
};

// ---------------------------------------------------------------------------
// Game Icon map
// ---------------------------------------------------------------------------

const GAME_ICONS: Record<string, string> = {
  crash: '\u{1F680}',
  dice: '\u{1F3B2}',
  mines: '\u{1F4A3}',
  plinko: '\u{26AA}',
  coinflip: '\u{1FA99}',
  roulette: '\u{1F3B0}',
  blackjack: '\u{1F0CF}',
  hilo: '\u{2195}\u{FE0F}',
  wheel: '\u{1F3A1}',
  tower: '\u{1F3D7}\u{FE0F}',
  limbo: '\u{267E}\u{FE0F}',
  keno: '\u{1F522}',
  'video-poker': '\u{1F0A1}',
  baccarat: '\u{1F3B4}',
  slots: '\u{1F3B0}',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GameCard({
  name,
  slug,
  thumbnail,
  provider,
  houseEdge,
  rtp,
  isPopular,
  isNew,
  gradient,
  index = 0,
}: GameCardProps) {
  const gradientClass = gradient || GAME_GRADIENTS[slug] || 'from-gray-600/50 to-slate-400/40';
  const gameIcon = GAME_ICONS[slug];
  const [imgError, setImgError] = useState(false);
  const showFallback = !thumbnail || imgError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
    >
      <Link
        href={`/casino/${slug}`}
        className="block bg-[#161B22] border border-[#30363D] rounded-card overflow-hidden group hover:border-[#8B5CF6]/40 hover:shadow-lg hover:shadow-[#8B5CF6]/5 transition-all duration-200"
      >
        {/* Thumbnail Area */}
        <div className="relative aspect-[4/3] overflow-hidden">
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
                'w-full h-full bg-gradient-to-br flex flex-col items-center justify-center gap-2',
                gradientClass
              )}
            >
              {gameIcon ? (
                <span className="text-5xl drop-shadow-lg group-hover:scale-110 transition-transform duration-200">
                  {gameIcon}
                </span>
              ) : (
                <Gamepad2 className="w-10 h-10 text-white/30 group-hover:text-white/50 transition-colors duration-200" />
              )}
              <span className="text-xs font-bold text-white/70 tracking-wider uppercase">
                {name}
              </span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {isPopular && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[#F59E0B]/90 rounded text-[10px] font-bold text-black">
                <Star className="w-3 h-3" />
                HOT
              </span>
            )}
            {isNew && (
              <span className="px-2 py-0.5 bg-[#10B981]/90 rounded text-[10px] font-bold text-white">
                NEW
              </span>
            )}
          </div>

          {/* House Edge Badge */}
          {(houseEdge !== undefined || rtp !== undefined) && (
            <div className="absolute top-2 right-2">
              <span className="px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] font-mono text-[#8B949E]">
                {rtp !== undefined ? `${rtp}%` : `${(100 - (houseEdge ?? 0)).toFixed(1)}%`}
              </span>
            </div>
          )}

          {/* Play Button Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors duration-200"
            initial={false}
          >
            <motion.div
              className="w-12 h-12 rounded-full bg-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Play className="w-6 h-6 text-white ml-0.5" />
            </motion.div>
          </motion.div>
        </div>

        {/* Card Info */}
        <div className="p-3">
          <p className="font-semibold text-sm text-[#E6EDF3] truncate group-hover:text-white transition-colors duration-200">
            {name}
          </p>
          <div className="flex items-center justify-between mt-1">
            <Badge variant="default" size="xs" className="text-[10px]">
              {provider}
            </Badge>
            {houseEdge !== undefined && (
              <span className="text-[10px] text-[#8B949E] font-mono">
                {houseEdge}% edge
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
