'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Eye,
  Tag,
  BookOpen,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featuredImage: string | null;
  category: string | null;
  tags: string[];
  views: number;
  publishedAt: string;
  createdAt: string;
  author: { id: string; nickname?: string; username?: string } | null;
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  category: string | null;
  publishedAt: string;
}

// ---------------------------------------------------------------------------
// Markdown Renderer
// ---------------------------------------------------------------------------

function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-[#E6EDF3] mt-8 mb-4">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-[#E6EDF3] mt-10 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-[#E6EDF3] mt-12 mb-6">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#E6EDF3]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-[#1C2128] px-1.5 py-0.5 rounded text-sm text-[#8B5CF6] font-mono">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[#8B5CF6] hover:underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-[#8B949E]">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-[#8B949E]">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-[#8B949E] leading-7 mb-4">')
    .replace(/\n/g, '<br />');

  return (
    <div
      className="prose-custom text-[#8B949E] leading-7"
      dangerouslySetInnerHTML={{
        __html: `<p class="text-[#8B949E] leading-7 mb-4">${html}</p>`,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function PostSkeleton() {
  return (
    <div className="animate-pulse space-y-6 max-w-4xl">
      <div className="h-5 bg-[#1C2128] rounded w-24" />
      <div className="h-64 bg-[#1C2128] rounded-lg" />
      <div className="h-10 bg-[#1C2128] rounded w-3/4" />
      <div className="h-4 bg-[#1C2128] rounded w-48" />
      <div className="space-y-2">
        <div className="h-4 bg-[#1C2128] rounded w-full" />
        <div className="h-4 bg-[#1C2128] rounded w-full" />
        <div className="h-4 bg-[#1C2128] rounded w-2/3" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  News: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  Guides: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Analysis: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  Updates: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlogPostPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const fetchPost = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await get<{ post: BlogPost; related: RelatedPost[] }>(
          `/blog/posts/${slug}`,
        );
        setPost(data?.post || null);
        setRelated(data?.related || []);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void fetchPost();
  }, [slug]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: post?.title, url });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <PostSkeleton />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <BookOpen className="w-16 h-16 text-[#484F58] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#E6EDF3] mb-2">Post Not Found</h2>
        <p className="text-[#8B949E] mb-6">
          The blog post you are looking for does not exist or has been removed.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 min-w-0"
        >
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-[#8B949E] hover:text-[#8B5CF6] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          {/* Featured Image */}
          {post.featuredImage && (
            <div className="rounded-lg overflow-hidden mb-8 border border-[#30363D]">
              <img
                src={post.featuredImage}
                alt={post.title}
                className="w-full h-64 md:h-96 object-cover"
              />
            </div>
          )}

          {/* Category + Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {post.category && (
              <span
                className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded border',
                  CATEGORY_COLORS[post.category] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25',
                )}
              >
                {post.category}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-[#8B949E]">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1 text-xs text-[#8B949E]">
              <Eye className="w-3.5 h-3.5" />
              {(post.views ?? 0).toLocaleString()} views
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-[#E6EDF3] mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Author + Share */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#30363D]">
            {post.author && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center text-[#8B5CF6] font-bold text-lg">
                  {(post.author?.nickname || post.author?.username || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#E6EDF3]">{post.author.nickname || post.author.username}</p>
                  <p className="text-xs text-[#8B949E]">Author</p>
                </div>
              </div>
            )}
            <button
              onClick={() => void handleShare()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-[#8B949E] border border-[#30363D] rounded-lg hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>

          {/* Content */}
          <div className="mb-10">
            <MarkdownContent content={post.content} />
          </div>

          {/* Tags */}
          {(post.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-6 border-t border-[#30363D]">
              {(post.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#1C2128] text-[#8B949E] rounded-full border border-[#30363D]"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </motion.article>

        {/* Sidebar: Related Posts */}
        <aside className="lg:w-80 shrink-0">
          <div className="sticky top-24">
            <h3 className="text-lg font-bold text-[#E6EDF3] mb-4">Related Posts</h3>
            {related.length > 0 ? (
              <div className="space-y-4">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/blog/${r.slug}`}
                    className="block bg-[#161B22] border border-[#30363D] rounded-lg p-4 hover:border-[#8B5CF6]/40 transition-all group"
                  >
                    {r.featuredImage && (
                      <div className="rounded overflow-hidden mb-3 h-32">
                        <img
                          src={r.featuredImage}
                          alt={r.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    {r.category && (
                      <span
                        className={cn(
                          'text-[10px] font-medium px-2 py-0.5 rounded border',
                          CATEGORY_COLORS[r.category] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25',
                        )}
                      >
                        {r.category}
                      </span>
                    )}
                    <h4 className="text-sm font-semibold text-[#E6EDF3] mt-2 line-clamp-2 group-hover:text-[#A78BFA] transition-colors">
                      {r.title}
                    </h4>
                    <p className="text-xs text-[#8B949E] mt-1">
                      {new Date(r.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 text-center">
                <BookOpen className="w-8 h-8 text-[#484F58] mx-auto mb-2" />
                <p className="text-sm text-[#8B949E]">No related posts found.</p>
              </div>
            )}

            {/* Back to blog link */}
            <Link
              href="/blog"
              className="mt-6 block text-center text-sm text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
            >
              View all posts
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
