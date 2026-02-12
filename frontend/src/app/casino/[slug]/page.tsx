'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Play, Info, Shield, Sparkles } from 'lucide-react';

// Game types that have dedicated pages — Next.js static routes take priority
const BUILTIN_GAMES = ['crash', 'dice', 'mines', 'plinko', 'coinflip'];

interface GameDetail {
  id: string;
  name: string;
  slug: string;
  type: string;
  category: string;
  thumbnail: string | null;
  description: string | null;
  rtp: number | null;
  volatility: string | null;
  houseEdge: number | null;
  isProvablyFair: boolean;
  isDemoAvailable: boolean;
  tags: string[];
  provider?: { name: string; slug: string };
  playCount: number;
}

export default function GamePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState('');
  const [demoMode, setDemoMode] = useState(true);

  // Redirect to builtin game pages
  useEffect(() => {
    if (slug && BUILTIN_GAMES.includes(slug)) {
      router.replace(`/casino/${slug}`);
      return;
    }
  }, [slug, router]);

  useEffect(() => {
    if (!slug || BUILTIN_GAMES.includes(slug)) return;
    api.get(`/casino/games/${slug}`)
      .then(({ data }) => {
        setGame(data.data || data);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Game not found');
        setIsLoading(false);
      });
  }, [slug]);

  const handleLaunch = async () => {
    if (!game) return;
    setIsLaunching(true);
    try {
      await api.post('/casino/launch', {
        gameId: game.id,
        currency: 'USDT',
        demo: demoMode,
      });
      // For now show a message that this is a demo environment
      alert(`Game session created! In production, this would open the ${game.provider?.name || 'provider'} game.`);
    } catch {
      alert('Please log in to play games');
    } finally {
      setIsLaunching(false);
    }
  };

  if (BUILTIN_GAMES.includes(slug || '')) return null;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-tertiary rounded" />
          <div className="aspect-video bg-surface-tertiary rounded-xl" />
          <div className="h-32 bg-surface-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-xl text-gray-400 mb-4">Game not found</p>
        <Link href="/casino" className="btn-primary">Back to Casino</Link>
      </div>
    );
  }

  // Determine visual based on game type
  const typeVisuals: Record<string, { gradient: string; icon: string }> = {
    SLOT: { gradient: 'from-violet-600 to-fuchsia-600', icon: '🎰' },
    LIVE: { gradient: 'from-emerald-600 to-teal-600', icon: '🃏' },
    TABLE: { gradient: 'from-indigo-600 to-blue-600', icon: '♠️' },
  };
  const visual = typeVisuals[game.type] || typeVisuals.SLOT;

  const getVolatilityColor = (v: string | null) => {
    if (!v) return 'text-gray-400';
    if (v === 'HIGH') return 'text-red-400';
    if (v === 'MEDIUM') return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/casino" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Casino
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Game Preview */}
        <div className="md:col-span-2">
          <div className={`aspect-video rounded-xl bg-gradient-to-br ${visual.gradient} flex flex-col items-center justify-center relative overflow-hidden`}>
            <span className="text-8xl mb-4">{visual.icon}</span>
            <h1 className="text-2xl font-bold">{game.name}</h1>
            {game.provider && (
              <p className="text-sm text-white/60 mt-1">by {game.provider.name}</p>
            )}

            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer" onClick={handleLaunch}>
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Play className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          </div>

          {/* Launch Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { setDemoMode(false); handleLaunch(); }}
              disabled={isLaunching}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
            >
              <Play className="w-4 h-4" />
              {isLaunching ? 'Launching...' : 'Play for Real'}
            </button>
            {game.isDemoAvailable !== false && (
              <button
                onClick={() => { setDemoMode(true); handleLaunch(); }}
                disabled={isLaunching}
                className="flex-1 py-3 rounded-xl bg-surface-tertiary text-gray-300 hover:bg-surface-hover transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Demo Mode
              </button>
            )}
          </div>

          {/* Description */}
          {game.description && (
            <div className="card mt-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-400" /> About
              </h3>
              <p className="text-sm text-gray-400">{game.description}</p>
            </div>
          )}
        </div>

        {/* Game Info Sidebar */}
        <div className="space-y-4">
          {/* Stats Card */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">Game Info</h3>

            {game.provider && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Provider</span>
                <span className="font-medium">{game.provider.name}</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Type</span>
              <span className="font-medium capitalize">{game.type.toLowerCase()}</span>
            </div>

            {game.rtp && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">RTP</span>
                <span className="font-medium text-green-400">{game.rtp}%</span>
              </div>
            )}

            {game.volatility && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Volatility</span>
                <span className={`font-medium ${getVolatilityColor(game.volatility)}`}>
                  {game.volatility}
                </span>
              </div>
            )}

            {game.houseEdge && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">House Edge</span>
                <span className="font-medium">{game.houseEdge}%</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Plays</span>
              <span className="font-medium">{game.playCount?.toLocaleString() || 0}</span>
            </div>
          </div>

          {/* Tags */}
          {game.tags && game.tags.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wider mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {game.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-surface-tertiary text-gray-300 px-2 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Provably Fair Badge */}
          {game.isProvablyFair && (
            <div className="card bg-green-500/10 border-green-500/20">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm font-semibold text-green-400">Provably Fair</p>
                  <p className="text-xs text-gray-400">Verified with cryptographic proof</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
