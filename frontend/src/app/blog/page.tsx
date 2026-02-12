'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const CATEGORIES = ['all', 'sports', 'casino', 'esports', 'crypto', 'promotions'];

export default function BlogPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = async (p: number, cat: string) => {
    setIsLoading(true);
    const params: any = { page: p, limit: 12 };
    if (cat !== 'all') params.category = cat;
    const { data } = await api.get('/blog/posts', { params });
    setPosts(data.data || []);
    setHasMore(data.meta?.hasMore || false);
    setIsLoading(false);
  };

  useEffect(() => { fetchPosts(1, category); }, [category]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">CryptoBet Blog</h1>
        <p className="text-gray-400">News, guides, and insights on sports betting, casino, and crypto.</p>
      </div>

      {/* Category Filter */}
      <div className="flex justify-center gap-1 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => { setCategory(cat); setPage(1); }}
            className={cn('px-4 py-2 rounded-lg text-sm capitalize transition-colors',
              category === cat ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
            )}>{cat}</button>
        ))}
      </div>

      {/* Posts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-64 animate-pulse bg-surface-tertiary" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="card hover:border-brand-500 transition-colors group">
              {post.featuredImage && (
                <div className="w-full h-36 bg-surface-tertiary rounded-lg mb-3 overflow-hidden">
                  <img src={post.featuredImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              )}
              {!post.featuredImage && (
                <div className="w-full h-36 bg-gradient-to-br from-brand-500/20 to-surface-tertiary rounded-lg mb-3 flex items-center justify-center">
                  <span className="text-4xl opacity-20">{post.category === 'sports' ? '⚽' : post.category === 'casino' ? '🎰' : post.category === 'crypto' ? '₿' : '📰'}</span>
                </div>
              )}
              <span className="text-xs text-brand-400 uppercase">{post.category}</span>
              <h2 className="font-bold text-sm mt-1 line-clamp-2 group-hover:text-brand-400 transition-colors">{post.title}</h2>
              <p className="text-xs text-gray-500 mt-2 line-clamp-2">{post.excerpt}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                <span>{post.authorName}</span>
                <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {hasMore && (
        <div className="text-center">
          <button onClick={() => { const next = page + 1; setPage(next); fetchPosts(next, category); }} className="btn-secondary">Load More</button>
        </div>
      )}
    </div>
  );
}
