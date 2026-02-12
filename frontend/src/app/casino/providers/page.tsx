'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Provider {
  id: string;
  name: string;
  slug: string;
  gameCount: number;
  logo?: string | null;
}

const FALLBACK_PROVIDERS: Provider[] = [
  { id: 'evolution', name: 'Evolution', slug: 'evolution', gameCount: 0 },
  { id: 'pragmatic-play', name: 'Pragmatic Play', slug: 'pragmatic-play', gameCount: 0 },
  { id: 'netent', name: 'NetEnt', slug: 'netent', gameCount: 0 },
  { id: 'microgaming', name: 'Microgaming', slug: 'microgaming', gameCount: 0 },
  { id: 'playngo', name: "Play'n GO", slug: 'playngo', gameCount: 0 },
  { id: 'hacksaw-gaming', name: 'Hacksaw Gaming', slug: 'hacksaw-gaming', gameCount: 0 },
  { id: 'push-gaming', name: 'Push Gaming', slug: 'push-gaming', gameCount: 0 },
  { id: 'nolimit-city', name: 'Nolimit City', slug: 'nolimit-city', gameCount: 0 },
];

const GRADIENT_COLORS = [
  'from-blue-600/20 to-cyan-600/10',
  'from-red-600/20 to-orange-600/10',
  'from-green-600/20 to-emerald-600/10',
  'from-purple-600/20 to-violet-600/10',
  'from-yellow-600/20 to-amber-600/10',
  'from-pink-600/20 to-rose-600/10',
  'from-indigo-600/20 to-blue-600/10',
  'from-teal-600/20 to-cyan-600/10',
];

function ProvidersSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="card h-40 animate-pulse bg-surface-tertiary" />
      ))}
    </div>
  );
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get('/casino/providers')
      .then(({ data }) => {
        const fetched = Array.isArray(data.data) ? data.data : [];
        setProviders(fetched.length > 0 ? fetched : FALLBACK_PROVIDERS);
        setIsLoading(false);
      })
      .catch(() => {
        setProviders(FALLBACK_PROVIDERS);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/casino" className="hover:text-brand-400 transition-colors">
          Casino
        </Link>
        <span>/</span>
        <span className="text-white">Game Providers</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Game Providers</h1>
        <p className="text-gray-400 text-sm">
          Browse games from the world&apos;s leading casino game developers. Select a provider to
          view their full game catalog.
        </p>
      </div>

      {/* Providers Grid */}
      {isLoading ? (
        <ProvidersSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {providers.map((provider, index) => (
            <Link
              key={provider.id}
              href={`/casino?provider=${provider.slug}`}
              className={cn(
                'card group relative overflow-hidden hover:border-brand-500/30 transition-all duration-200',
                'hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-500/5'
              )}
            >
              {/* Background gradient */}
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                  GRADIENT_COLORS[index % GRADIENT_COLORS.length]
                )}
              />

              <div className="relative flex flex-col items-center justify-center py-6">
                {/* Provider logo placeholder */}
                <div className="w-16 h-16 rounded-xl bg-surface-tertiary group-hover:bg-surface-hover transition-colors flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-brand-400">
                    {provider.name.charAt(0)}
                  </span>
                </div>

                {/* Provider name */}
                <h3 className="font-semibold text-sm text-center mb-1 group-hover:text-brand-400 transition-colors">
                  {provider.name}
                </h3>

                {/* Game count */}
                {provider.gameCount > 0 ? (
                  <p className="text-xs text-gray-500">
                    {provider.gameCount} {provider.gameCount === 1 ? 'game' : 'games'}
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">View games</p>
                )}
              </div>

              {/* Hover arrow indicator */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  className="w-4 h-4 text-brand-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* No providers fallback */}
      {!isLoading && providers.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No providers available</p>
          <p className="text-gray-500 text-sm">Check back later for game providers.</p>
        </div>
      )}
    </div>
  );
}
