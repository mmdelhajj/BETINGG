'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Rocket,
  Shield,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Dices,
  Trophy,
  Star,
  Lock,
  Heart,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  BookOpen,
  ExternalLink,
  MessageSquare,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get, post as apiPost } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  helpfulYes: number;
  helpfulNo: number;
  updatedAt: string;
  content?: string;
}

interface HelpCategory {
  name: string;
  articleCount: number;
}

// ---------------------------------------------------------------------------
// Category Icons & Colors
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Getting Started': Rocket,
  Account: Shield,
  Deposits: ArrowDownToLine,
  Withdrawals: ArrowUpFromLine,
  'Sports Betting': Trophy,
  Casino: Dices,
  'VIP & Rewards': Star,
  Security: Lock,
  'Responsible Gambling': Heart,
};

const CATEGORY_ACCENT: Record<string, { icon: string; bg: string; border: string }> = {
  'Getting Started': { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  Account: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  Deposits: { icon: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  Withdrawals: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'Sports Betting': { icon: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  Casino: { icon: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  'VIP & Rewards': { icon: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  Security: { icon: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'Responsible Gambling': { icon: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
};

const DEFAULT_ACCENT = { icon: 'text-[#8B949E]', bg: 'bg-[#8B949E]/10', border: 'border-[#8B949E]/20' };

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CategorySkeleton() {
  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-[#1C2128] rounded-lg" />
        <div>
          <div className="h-5 bg-[#1C2128] rounded w-32 mb-1" />
          <div className="h-3 bg-[#1C2128] rounded w-20" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Viewer Modal
// ---------------------------------------------------------------------------

function ArticleViewer({
  article,
  onClose,
  onVote,
}: {
  article: HelpArticle;
  onClose: () => void;
  onVote: (id: string, isHelpful: boolean) => void;
}) {
  const [voted, setVoted] = useState<boolean | null>(null);

  const handleVote = (isHelpful: boolean) => {
    if (voted !== null) return;
    setVoted(isHelpful);
    onVote(article.id, isHelpful);
  };

  // Simple markdown rendering
  const contentHtml = (article.content ?? '')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-[#E6EDF3] mt-6 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-[#E6EDF3] mt-8 mb-3">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[#E6EDF3] font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-[#8B949E] leading-7 mb-3">')
    .replace(/\n/g, '<br />');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1117]/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#161B22] border border-[#21262D] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#161B22] border-b border-[#21262D] px-6 py-4 flex items-center justify-between z-10">
          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/25 uppercase tracking-wide">
            {article.category}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1C2128] border border-[#21262D] flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#8B5CF6]/30 transition-all duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-[#E6EDF3] mb-6 leading-tight">{article.title}</h2>

          <div
            className="text-[#8B949E] leading-7 mb-8"
            dangerouslySetInnerHTML={{
              __html: `<p class="text-[#8B949E] leading-7 mb-3">${contentHtml}</p>`,
            }}
          />

          {/* Helpful vote */}
          <div className="border-t border-[#21262D] pt-6">
            <p className="text-sm text-[#8B949E] mb-3">Was this article helpful?</p>
            {voted !== null ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg">
                <ThumbsUp className="w-4 h-4 text-[#10B981]" />
                <p className="text-sm text-[#10B981] font-medium">
                  Thanks for your feedback!
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => handleVote(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1C2128] border border-[#21262D] rounded-lg text-sm text-[#8B949E] hover:border-[#10B981]/40 hover:text-[#10B981] hover:bg-[#10B981]/5 transition-all duration-200"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Yes ({article.helpfulYes})
                </button>
                <button
                  onClick={() => handleVote(false)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1C2128] border border-[#21262D] rounded-lg text-sm text-[#8B949E] hover:border-[#EF4444]/40 hover:text-[#EF4444] hover:bg-[#EF4444]/5 transition-all duration-200"
                >
                  <ThumbsDown className="w-4 h-4" />
                  No ({article.helpfulNo})
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HelpPage() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [groupedArticles, setGroupedArticles] = useState<Record<string, HelpArticle[]>>({});
  const [allArticles, setAllArticles] = useState<HelpArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [catData, articlesData] = await Promise.all([
          get<{ categories: HelpCategory[] }>('/help/categories'),
          get<{ articles: HelpArticle[]; grouped: Record<string, HelpArticle[]> }>('/help/articles'),
        ]);
        setCategories(catData?.categories || []);
        setGroupedArticles(articlesData?.grouped || {});
        setAllArticles(articlesData?.articles || []);
      } catch {
        // API unavailable
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSelectArticle = useCallback(async (article: HelpArticle) => {
    try {
      const data = await get<{ article: HelpArticle }>(`/help/articles/${article.slug}`);
      setSelectedArticle(data.article);
    } catch {
      setSelectedArticle({ ...article, content: 'Content could not be loaded.' });
    }
  }, []);

  const handleVote = useCallback(async (id: string, isHelpful: boolean) => {
    try {
      await apiPost(`/help/articles/${id}/helpful`, { isHelpful });
    } catch {
      // Silently fail
    }
  }, []);

  // Search filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allArticles.filter(
      (a) =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.tags || []).some((t) => (t || '').toLowerCase().includes(q)) ||
        (a.category || '').toLowerCase().includes(q),
    );
  }, [searchQuery, allArticles]);

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center py-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/20 to-[#8B5CF6]/5 border border-[#8B5CF6]/20 flex items-center justify-center mx-auto mb-5">
            <HelpCircle className="w-8 h-8 text-[#8B5CF6]" />
          </div>
          <h1 className="text-3xl font-bold text-[#E6EDF3] mb-3">Help Center</h1>
          <p className="text-[#8B949E] max-w-lg mx-auto leading-relaxed">
            Find answers to common questions about deposits, withdrawals, betting, casino games, and more.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative max-w-xl mx-auto"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6E7681]" />
          <input
            type="text"
            placeholder="Search for help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 bg-[#161B22] border border-[#21262D] rounded-xl pl-12 pr-4 text-[#E6EDF3] placeholder:text-[#6E7681] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 focus:border-[#8B5CF6]/60 transition-all duration-200 text-base shadow-lg shadow-black/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-[#1C2128] flex items-center justify-center text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </motion.div>

        {/* Search Results */}
        {searchResults !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <p className="text-sm text-[#6E7681]">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
            </p>
            {searchResults.length > 0 ? (
              searchResults.map((article) => (
                <button
                  key={article.id}
                  onClick={() => void handleSelectArticle(article)}
                  className="w-full text-left bg-[#161B22] border border-[#21262D] rounded-xl p-4 hover:border-[#8B5CF6]/40 hover:bg-[#1C2128] transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/25 uppercase tracking-wide">
                      {article.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#E6EDF3] group-hover:text-[#A78BFA] transition-colors duration-200">
                      {article.title}
                    </h3>
                    <ChevronDown className="w-4 h-4 text-[#6E7681] group-hover:text-[#8B5CF6] transition-colors shrink-0 ml-3 -rotate-90" />
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-14">
                <div className="w-14 h-14 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mx-auto mb-4">
                  <Search className="w-6 h-6 text-[#6E7681]" />
                </div>
                <p className="text-[#E6EDF3] font-semibold mb-1">No articles found</p>
                <p className="text-[#6E7681] text-sm">Try different keywords or browse categories below.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Category Sections */}
        {searchResults === null && (
          <>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <CategorySkeleton key={i} />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
              >
                {categories.map((cat, catIndex) => {
                  const Icon = CATEGORY_ICONS[cat.name] ?? HelpCircle;
                  const accent = CATEGORY_ACCENT[cat.name] ?? DEFAULT_ACCENT;
                  const isExpanded = expandedCategories.has(cat.name);
                  const articles = groupedArticles[cat.name] ?? [];

                  return (
                    <motion.div
                      key={cat.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: catIndex * 0.05 }}
                      className="bg-[#161B22] border border-[#21262D] rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => toggleCategory(cat.name)}
                        className="w-full flex items-center justify-between p-4 hover:bg-[#1C2128]/50 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center border',
                              accent.bg,
                              accent.border,
                            )}
                          >
                            <Icon className={cn('w-5 h-5', accent.icon)} />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-[#E6EDF3] text-sm">{cat.name}</h3>
                            <p className="text-xs text-[#6E7681]">
                              {cat.articleCount} article{cat.articleCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                          isExpanded ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]' : 'text-[#6E7681]',
                        )}>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-0.5">
                              {articles.length > 0 ? (
                                articles.map((article) => (
                                  <button
                                    key={article.id}
                                    onClick={() => void handleSelectArticle(article)}
                                    className="w-full text-left flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[#1C2128] transition-colors duration-200 group"
                                  >
                                    <span className="text-sm text-[#8B949E] group-hover:text-[#E6EDF3] transition-colors duration-200">
                                      {article.title}
                                    </span>
                                    <ExternalLink className="w-3.5 h-3.5 text-[#6E7681] opacity-0 group-hover:opacity-100 group-hover:text-[#8B5CF6] transition-all duration-200 shrink-0 ml-2" />
                                  </button>
                                ))
                              ) : (
                                <p className="text-sm text-[#6E7681] py-2 px-3">
                                  No articles in this category yet.
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </>
        )}

        {/* Contact support */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-r from-[#8B5CF6]/10 via-[#161B22] to-[#8B5CF6]/5 border border-[#21262D] rounded-xl p-8 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <h3 className="text-lg font-bold text-[#E6EDF3] mb-2">Still need help?</h3>
          <p className="text-[#8B949E] text-sm mb-5 max-w-sm mx-auto">
            Can&apos;t find what you&apos;re looking for? Our support team is available 24/7.
          </p>
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors duration-200 text-sm font-medium shadow-lg shadow-[#8B5CF6]/25"
            onClick={(e) => {
              e.preventDefault();
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-chat'));
              }
            }}
          >
            <MessageSquare className="w-4 h-4" />
            Contact Support
          </button>
        </motion.div>

        {/* Article Viewer Modal */}
        <AnimatePresence>
          {selectedArticle && (
            <ArticleViewer
              article={selectedArticle}
              onClose={() => setSelectedArticle(null)}
              onVote={(id, isHelpful) => void handleVote(id, isHelpful)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
