'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'bonuses', label: 'Bonuses', icon: '🎁' },
  { id: 'betting-rules', label: 'Betting Rules', icon: '📋' },
  { id: 'responsible-gambling', label: 'Responsible Gambling', icon: '🛡' },
  { id: 'security', label: 'Security', icon: '🔒' },
];

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchArticles = async (opts?: { search?: string; category?: string }) => {
    setIsLoading(true);
    const params: any = {};
    if (opts?.search) params.search = opts.search;
    if (opts?.category) params.category = opts.category;
    const { data } = await api.get('/help/articles', { params });
    setArticles(data.data || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchArticles(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles({ search: searchQuery, category: activeCategory || undefined });
  };

  const selectCategory = (cat: string | null) => {
    setActiveCategory(cat);
    fetchArticles({ category: cat || undefined, search: searchQuery || undefined });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-gray-400 mb-4">Find answers to common questions or contact our support team.</p>

        {/* Search */}
        <form onSubmit={handleSearch} className="max-w-lg mx-auto">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles..."
              className="input pl-10 w-full"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          </div>
        </form>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(activeCategory === cat.id ? null : cat.id)}
            className={cn(
              'card text-center py-4 transition-colors cursor-pointer',
              activeCategory === cat.id ? 'border-brand-500 bg-brand-500/10' : 'hover:border-brand-500/50'
            )}
          >
            <span className="text-2xl block mb-1">{cat.icon}</span>
            <span className="text-xs font-medium">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Articles */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-14 animate-pulse bg-surface-tertiary" />
          ))
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No articles found</p>
            <p className="text-sm">Try a different search or category</p>
          </div>
        ) : (
          articles.map((article) => (
            <Link key={article.id} href={`/help/${article.slug}`} className="card flex items-center justify-between hover:border-brand-500/50 transition-colors">
              <div>
                <h3 className="font-medium text-sm">{article.title}</h3>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-brand-400 capitalize">{article.category}</span>
                  {article.tags?.slice(0, 2).map((tag: string) => (
                    <span key={tag} className="text-xs text-gray-600">{tag}</span>
                  ))}
                </div>
              </div>
              <span className="text-gray-500 text-lg">&rsaquo;</span>
            </Link>
          ))
        )}
      </div>

      {/* Contact */}
      <div className="card bg-surface-tertiary text-center py-8">
        <h2 className="text-lg font-bold mb-2">Still need help?</h2>
        <p className="text-sm text-gray-400 mb-4">Our support team is available 24/7.</p>
        <div className="flex justify-center gap-3">
          <button className="btn-primary">Live Chat</button>
          <button className="btn-secondary">Email Support</button>
        </div>
      </div>
    </div>
  );
}
