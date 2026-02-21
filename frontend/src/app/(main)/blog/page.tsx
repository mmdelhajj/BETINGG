'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Clock,
  Calendar,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Newspaper,
  GraduationCap,
  BarChart3,
  Bell,
  Search,
  Eye,
  Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  featuredImage: string | null;
  tags: string[];
  views: number;
  publishedAt: string;
  author: { id: string; nickname?: string; username?: string } | null;
}

interface PostsResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES = [
  { key: 'all', label: 'All Posts', icon: BookOpen },
  { key: 'News', label: 'News', icon: Newspaper },
  { key: 'Guides', label: 'Guides', icon: GraduationCap },
  { key: 'Analysis', label: 'Analysis', icon: BarChart3 },
  { key: 'Updates', label: 'Updates', icon: Bell },
] as const;

const POSTS_PER_PAGE = 12;

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Category Badge (purple pill)
// ---------------------------------------------------------------------------

function CategoryBadge({ category, size = 'sm' }: { category: string; size?: 'xs' | 'sm' }) {
  return (
    <span
      className={cn(
        'font-semibold rounded-full bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/25 uppercase tracking-wide',
        size === 'xs' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-0.5',
      )}
    >
      {category}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PostCardSkeleton() {
  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-lg overflow-hidden animate-pulse">
      <div className="h-48 bg-gradient-to-br from-[#1C2128] to-[#161B22]" />
      <div className="p-5">
        <div className="flex gap-2 mb-3">
          <div className="h-4 bg-[#1C2128] rounded-full w-16" />
        </div>
        <div className="h-5 bg-[#1C2128] rounded w-3/4 mb-3" />
        <div className="h-4 bg-[#1C2128] rounded w-full mb-1" />
        <div className="h-4 bg-[#1C2128] rounded w-2/3 mb-4" />
        <div className="flex justify-between pt-3 border-t border-[#21262D]">
          <div className="h-3 bg-[#1C2128] rounded w-24" />
          <div className="h-3 bg-[#1C2128] rounded w-16" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blog Page
// ---------------------------------------------------------------------------

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await get<{ categories: string[] }>('/blog/categories');
        setCategories(data?.categories || []);
      } catch {
        // Use default categories if API unavailable
      }
    };
    void fetchCategories();
  }, []);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(POSTS_PER_PAGE),
      });
      if (activeCategory !== 'all') {
        params.set('category', activeCategory);
      }
      const data = await get<PostsResponse>(`/blog/posts?${params}`);
      setPosts(data?.posts || []);
      setTotalPages(data?.totalPages || 1);
    } catch {
      setPosts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [currentPage, activeCategory]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  // Client-side search filtering
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(q)),
    );
  }, [posts, searchQuery]);

  // Find featured post (first post when viewing "all" with no search)
  const featuredPost =
    activeCategory === 'all' && !searchQuery && currentPage === 1
      ? filteredPosts[0]
      : null;

  const displayPosts = featuredPost
    ? filteredPosts.slice(1)
    : filteredPosts;

  const handleCategoryChange = (key: string) => {
    setActiveCategory(key);
    setCurrentPage(1);
  };

  // Build dynamic category tabs: merge defaults with API categories
  const categoryTabs = useMemo(() => {
    if (categories.length === 0) return DEFAULT_CATEGORIES;
    const apiCats = categories.map((c) => ({
      key: c,
      label: c,
      icon: DEFAULT_CATEGORIES.find((d) => d.key === c)?.icon ?? BookOpen,
    }));
    return [{ key: 'all', label: 'All Posts', icon: BookOpen }, ...apiCats];
  }, [categories]);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#E6EDF3]">Blog</h1>
            </div>
          </div>
          <p className="text-[#8B949E] ml-[52px]">
            Latest news, guides, and analysis from the CryptoBet team.
          </p>
        </motion.div>

        {/* Featured Post Hero */}
        {featuredPost && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link href={`/blog/${featuredPost.slug}`}>
              <div className="relative rounded-xl overflow-hidden group cursor-pointer border border-[#21262D] hover:border-[#8B5CF6]/50 transition-all duration-300 shadow-2xl shadow-black/20">
                {/* Background: gradient or image */}
                {featuredPost.featuredImage ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundImage: `url(${featuredPost.featuredImage})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/30 via-[#1C2128] to-[#10B981]/20" />
                )}
                {/* Dark overlay with gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/70 to-[#0D1117]/30" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/60 to-transparent" />

                <div className="relative z-10 p-8 md:p-12 lg:p-16 min-h-[280px] flex flex-col justify-end">
                  <div className="flex items-center gap-3 mb-4">
                    {featuredPost.category && (
                      <CategoryBadge category={featuredPost.category} />
                    )}
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#8B5CF6] text-white uppercase tracking-wide flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      Featured
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-4xl font-bold text-[#E6EDF3] mb-4 max-w-2xl group-hover:text-[#A78BFA] transition-colors leading-tight">
                    {featuredPost.title}
                  </h2>
                  {featuredPost.excerpt && (
                    <p className="text-[#8B949E] text-base md:text-lg mb-6 max-w-xl line-clamp-2">
                      {featuredPost.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-[#6E7681]">
                    {featuredPost.author && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-white font-semibold text-xs">
                          {(featuredPost.author?.nickname || featuredPost.author?.username || 'A').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[#8B949E]">{featuredPost.author.nickname || featuredPost.author.username}</span>
                      </div>
                    )}
                    <span className="flex items-center gap-1.5 text-[#8B949E]">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(featuredPost.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-1.5 text-[#8B949E]">
                      <Eye className="w-3.5 h-3.5" />
                      {(featuredPost.views ?? 0).toLocaleString()} views
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Search + Category Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7681]" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 bg-[#161B22] border border-[#21262D] rounded-lg pl-10 pr-4 text-sm text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6]/60 transition-all duration-200"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categoryTabs.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryChange(cat.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                      : 'bg-[#161B22] text-[#8B949E] border border-[#21262D] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] hover:bg-[#1C2128]',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Blog Post Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCategory}-${currentPage}-${searchQuery}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {displayPosts.length > 0 ? (
                displayPosts.map((post) => (
                  <motion.div key={post.id} variants={cardVariants}>
                    <Link href={`/blog/${post.slug}`}>
                      <article className="bg-[#161B22] border border-[#21262D] rounded-xl overflow-hidden group hover:border-[#8B5CF6]/40 hover:shadow-xl hover:shadow-[#8B5CF6]/5 transition-all duration-300 h-full flex flex-col">
                        {/* Thumbnail with gradient overlay */}
                        <div className="h-48 relative overflow-hidden">
                          {post.featuredImage ? (
                            <img
                              src={post.featuredImage}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#8B5CF6]/15 via-[#1C2128] to-[#10B981]/10 flex items-center justify-center">
                              <BookOpen className="w-12 h-12 text-[#8B5CF6]/20" />
                            </div>
                          )}
                          {/* Gradient overlay at bottom */}
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#161B22] to-transparent" />
                          {/* Category badge */}
                          {post.category && (
                            <div className="absolute top-3 left-3">
                              <CategoryBadge category={post.category} size="xs" />
                            </div>
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-[#0D1117]/0 group-hover:bg-[#0D1117]/20 transition-all duration-300" />
                        </div>

                        {/* Content */}
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="font-bold text-[#E6EDF3] mb-2 line-clamp-2 group-hover:text-[#A78BFA] transition-colors duration-200 leading-snug">
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p className="text-sm text-[#8B949E] mb-4 line-clamp-2 flex-1 leading-relaxed">
                              {post.excerpt}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-xs text-[#6E7681] pt-3 border-t border-[#21262D]">
                            <div className="flex items-center gap-2">
                              {post.author && (
                                <>
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-white font-semibold text-[10px]">
                                    {(post.author?.nickname || post.author?.username || 'A').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-[#8B949E]">{post.author.nickname || post.author.username}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 text-[#8B949E]">
                                <Calendar className="w-3 h-3" />
                                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="flex items-center gap-1 text-[#8B949E]">
                                <Eye className="w-3 h-3" />
                                {post.views}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </Link>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  variants={cardVariants}
                  className="col-span-full text-center py-20"
                >
                  <div className="w-16 h-16 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-[#6E7681]" />
                  </div>
                  <p className="text-[#E6EDF3] text-lg font-semibold mb-1">No posts found</p>
                  <p className="text-[#6E7681] text-sm">
                    Try changing your search or category filter.
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 pt-4"
          >
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#161B22] border border-[#21262D] text-[#8B949E] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] hover:bg-[#1C2128] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={cn(
                  'inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-all duration-200',
                  currentPage === i + 1
                    ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                    : 'bg-[#161B22] border border-[#21262D] text-[#8B949E] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] hover:bg-[#1C2128]',
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#161B22] border border-[#21262D] text-[#8B949E] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] hover:bg-[#1C2128] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
