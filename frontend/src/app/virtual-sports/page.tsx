'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface VirtualSport {
  id: string;
  name: string;
  slug: string;
  description: string;
  gradient: string;
  iconPath: string;
  comingSoon: boolean;
}

const VIRTUAL_SPORTS: VirtualSport[] = [
  {
    id: 'vs-football',
    name: 'Virtual Football',
    slug: 'virtual-football',
    description: 'Fast-paced virtual football matches with realistic simulations. Bet on match results, goals, and more.',
    gradient: 'from-emerald-600/40 to-emerald-900/20',
    iconPath: 'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11H7.101l-.9 2.79L12 17.6l5.8-3.81-.9-2.79H13V7h-2v4z',
    comingSoon: false,
  },
  {
    id: 'vs-basketball',
    name: 'Virtual Basketball',
    slug: 'virtual-basketball',
    description: 'High-scoring virtual basketball action. Bet on quarters, totals, and head-to-head matchups.',
    gradient: 'from-orange-500/40 to-orange-900/20',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z',
    comingSoon: false,
  },
  {
    id: 'vs-horse-racing',
    name: 'Virtual Horse Racing',
    slug: 'virtual-horse-racing',
    description: 'Experience the thrill of horse racing anytime. Bet on winners, each-way, and forecast bets.',
    gradient: 'from-amber-500/40 to-amber-900/20',
    iconPath: 'M22 6h-5l-2-4h-4L9 6H7c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h1l1 10h2l1-10h2l1 10h2l1-10h1c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z',
    comingSoon: false,
  },
  {
    id: 'vs-greyhounds',
    name: 'Virtual Greyhounds',
    slug: 'virtual-greyhounds',
    description: 'Virtual greyhound racing with races every few minutes. Quick action and instant results.',
    gradient: 'from-sky-500/40 to-sky-900/20',
    iconPath: 'M18 4l-2 2h-2l-4 4-2-2-4 4v4h4l4-4 2 2 4-4V8l2-2V4z',
    comingSoon: false,
  },
  {
    id: 'vs-tennis',
    name: 'Virtual Tennis',
    slug: 'virtual-tennis',
    description: 'Virtual tennis matches featuring set betting, match winners, and game handicaps.',
    gradient: 'from-lime-500/40 to-lime-900/20',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM5.61 16.78C4.6 15.45 4 13.8 4 12s.6-3.45 1.61-4.78C7.06 8.31 8 10.05 8 12s-.94 3.69-2.39 4.78zM12 20c-1.8 0-3.45-.6-4.78-1.61C8.31 16.94 10.05 16 12 16s3.69.94 4.78 2.39C15.45 19.4 13.8 20 12 20zm4.78-3.22C15.45 15.4 13.8 14.8 12 14.8s-3.45.6-4.78 1.61',
    comingSoon: true,
  },
  {
    id: 'vs-cycling',
    name: 'Virtual Cycling',
    slug: 'virtual-cycling',
    description: 'Virtual cycling races across various terrains. Bet on stage winners, overall champions, and sprint finishes.',
    gradient: 'from-rose-500/40 to-rose-900/20',
    iconPath: 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5S3.1 13.5 5 13.5s3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z',
    comingSoon: true,
  },
];

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-36 bg-surface-tertiary rounded-lg mb-4" />
      <div className="h-5 bg-surface-tertiary rounded w-2/3 mb-2" />
      <div className="h-4 bg-surface-tertiary rounded w-full mb-2" />
      <div className="h-4 bg-surface-tertiary rounded w-3/4 mb-4" />
      <div className="h-10 bg-surface-tertiary rounded" />
    </div>
  );
}

export default function VirtualSportsPage() {
  const [_apiGames, setApiGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get('/casino/games', { params: { type: 'virtual' } })
      .then((res) => {
        const data = res.data.data;
        if (Array.isArray(data)) {
          setApiGames(data);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600/20 via-surface-secondary to-sky-600/20 border border-border p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
        <div className="relative z-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Virtual Sports</h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            Experience non-stop action with our virtual sports. Realistic simulations,
            instant results, and available around the clock. No waiting for real events.
          </p>
        </div>
        <div className="absolute top-4 right-10 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-4 left-10 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl" />
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-400">24/7</p>
          <p className="text-xs text-gray-400 mt-1">Always Available</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-green">60s</p>
          <p className="text-xs text-gray-400 mt-1">Event Frequency</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-yellow">6+</p>
          <p className="text-xs text-gray-400 mt-1">Sports Available</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Virtual Sports Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {VIRTUAL_SPORTS.map((sport) => (
            <div
              key={sport.id}
              className={cn(
                'card overflow-hidden hover:border-brand-500/40 transition-all group relative',
                sport.comingSoon && 'opacity-80'
              )}
            >
              {/* Gradient Background Header */}
              <div
                className={cn(
                  'h-36 -mx-4 -mt-4 mb-4 bg-gradient-to-br flex items-center justify-center relative',
                  sport.gradient
                )}
              >
                {/* Sport Icon */}
                <svg
                  className="w-16 h-16 text-white/30 group-hover:text-white/50 transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d={sport.iconPath} />
                </svg>

                {/* 24/7 Tag */}
                {!sport.comingSoon && (
                  <span className="absolute top-3 right-3 bg-surface/70 backdrop-blur-sm text-xs font-medium text-accent-green px-2 py-1 rounded-full">
                    Available 24/7
                  </span>
                )}

                {/* Coming Soon Badge */}
                {sport.comingSoon && (
                  <span className="absolute top-3 right-3 bg-accent-yellow/20 backdrop-blur-sm text-xs font-bold text-accent-yellow px-3 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold mb-2 group-hover:text-brand-400 transition-colors">
                {sport.name}
              </h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{sport.description}</p>

              {/* CTA */}
              {sport.comingSoon ? (
                <button
                  disabled
                  className="btn-secondary w-full text-sm opacity-60 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              ) : (
                <Link
                  href={`/casino?category=virtual&game=${sport.slug}`}
                  className="btn-primary inline-block text-center text-sm w-full"
                >
                  Play Now
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* About Virtual Sports Section */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">About Virtual Sports Betting</h2>
        <div className="space-y-4 text-sm text-gray-400">
          <p>
            Virtual sports use advanced random number generators and realistic simulations to create
            sporting events that you can bet on at any time. Each event is independent, fair, and
            uses certified RNG technology to ensure completely random outcomes.
          </p>
          <p>
            Unlike real sports, virtual events run continuously with new matches and races starting
            every minute. This means you never have to wait for a real game to start. Whether it is
            3 AM or a holiday, virtual sports are always available.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-surface-tertiary rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">How It Works</h3>
              <ul className="space-y-1 text-gray-400">
                <li>1. Choose your virtual sport</li>
                <li>2. Review the upcoming event and odds</li>
                <li>3. Place your bet on available markets</li>
                <li>4. Watch the simulation and collect winnings</li>
              </ul>
            </div>
            <div className="bg-surface-tertiary rounded-lg p-4">
              <h3 className="font-medium text-white mb-2">Key Features</h3>
              <ul className="space-y-1 text-gray-400">
                <li>-- Certified RNG for fair outcomes</li>
                <li>-- Events every 60 seconds</li>
                <li>-- Multiple bet types per event</li>
                <li>-- Realistic HD simulations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Responsible Gambling Link */}
      <div className="text-center text-xs text-gray-600 pb-4">
        <p>
          Virtual sports are games of chance. Please gamble responsibly.{' '}
          <Link href="/responsible-gambling" className="text-brand-400 hover:underline">
            Responsible Gambling
          </Link>
        </p>
      </div>
    </div>
  );
}
