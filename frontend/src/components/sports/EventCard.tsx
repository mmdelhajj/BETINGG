'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock, Zap } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import OddsButton from './OddsButton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EventCardProps {
  id: string;
  sportId: string;
  sportName: string;
  sportSlug: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  startTime: string;
  isLive?: boolean;
  score?: { home: number; away: number };
  period?: string;
  markets: {
    id: string;
    name: string;
    selections: { id?: string; name: string; odds: number }[];
  }[];
  index?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Team Logo Placeholder
// ---------------------------------------------------------------------------

function TeamLogo({
  url,
  name,
  size = 24,
}: {
  url?: string;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  // Placeholder with initials
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="rounded-full bg-[#1C2128] border border-[#30363D] flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-[9px] font-bold text-[#8B949E]">{initials}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventCard({
  id,
  sportId,
  sportName,
  sportSlug,
  competitionName,
  homeTeam,
  awayTeam,
  homeLogoUrl,
  awayLogoUrl,
  startTime,
  isLive = false,
  score,
  period,
  markets,
  index = 0,
  className,
}: EventCardProps) {
  const eventName = `${homeTeam} vs ${awayTeam}`;
  const mainMarket = (markets || [])[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03, ease: 'easeOut' }}
    >
      <Link
        href={`/sports/${sportSlug}/${id}`}
        className={cn(
          'block bg-[#161B22] border border-[#30363D] rounded-card p-4',
          'hover:border-[#8B5CF6]/30 hover:shadow-lg hover:shadow-[#8B5CF6]/5',
          'transition-all duration-200 group',
          className,
        )}
      >
        {/* Header: Sport / Competition / Live Badge */}
        <div className="flex items-center gap-2 text-xs text-[#8B949E] mb-3">
          {isLive && (
            <Badge variant="live" size="xs" dot pulse>
              LIVE
            </Badge>
          )}
          <span className="px-2 py-0.5 bg-[#1C2128] rounded text-[10px]">
            {sportName}
          </span>
          <span className="truncate">{competitionName}</span>
          {period && isLive && (
            <span className="ml-auto text-[#F59E0B] font-medium text-[10px]">
              {period}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-2 mb-3">
          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamLogo url={homeLogoUrl} name={homeTeam} />
              <span className="font-medium text-sm text-[#E6EDF3] truncate">
                {homeTeam}
              </span>
            </div>
            {isLive && score && (
              <span className="font-bold font-mono text-sm text-[#E6EDF3] tabular-nums ml-2">
                {score.home}
              </span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamLogo url={awayLogoUrl} name={awayTeam} />
              <span className="font-medium text-sm text-[#E6EDF3] truncate">
                {awayTeam}
              </span>
            </div>
            {isLive && score && (
              <span className="font-bold font-mono text-sm text-[#E6EDF3] tabular-nums ml-2">
                {score.away}
              </span>
            )}
          </div>
        </div>

        {/* Time / Date */}
        {!isLive && (
          <div className="flex items-center gap-1.5 text-xs text-[#8B949E] mb-3">
            <Clock className="w-3 h-3" />
            <span>{formatDate(startTime)}</span>
          </div>
        )}

        {/* Main Market Odds */}
        {mainMarket && (
          <div className="flex gap-2">
            {mainMarket.selections.map((sel) => (
              <OddsButton
                key={sel.id || sel.name}
                selectionId={sel.id}
                eventId={id}
                eventName={eventName}
                sportId={sportId}
                sportName={sportName}
                marketId={mainMarket.id}
                marketName={mainMarket.name}
                outcomeName={sel.name}
                odds={sel.odds}
                startTime={startTime}
                isLive={isLive}
                compact
              />
            ))}
          </div>
        )}
      </Link>
    </motion.div>
  );
}
