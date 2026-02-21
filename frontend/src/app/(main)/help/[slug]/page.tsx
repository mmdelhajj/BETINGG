'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Clock,
  BookOpen,
  FileText,
  CheckCircle,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HelpArticle {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
  lastUpdated: string;
  readingTime: number;
  content: ArticleSection[];
}

interface ArticleSection {
  id: string;
  heading: string;
  content: string;
}

interface RelatedArticle {
  slug: string;
  title: string;
  category: string;
  readingTime: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_ARTICLE: HelpArticle = {
  slug: 'how-to-deposit-bitcoin',
  title: 'How to Deposit Bitcoin',
  category: 'Deposits & Withdrawals',
  categorySlug: 'deposits-withdrawals',
  lastUpdated: '2026-02-05',
  readingTime: 3,
  content: [
    {
      id: 'overview',
      heading: 'Overview',
      content: 'Depositing Bitcoin to your CryptoBet account is quick, easy, and secure. This guide walks you through the entire process step by step. All deposits are processed on-chain and typically confirmed within 10-30 minutes depending on network congestion.',
    },
    {
      id: 'step-1',
      heading: 'Step 1: Navigate to Your Wallet',
      content: 'Log in to your CryptoBet account and click on the "Wallet" button in the top navigation bar, or navigate to the Wallet page from your account menu. You will see a list of all supported cryptocurrencies with their current balances.',
    },
    {
      id: 'step-2',
      heading: 'Step 2: Select Bitcoin (BTC)',
      content: 'From the currency list, select Bitcoin (BTC). You can use the search bar at the top of the wallet to quickly find Bitcoin. Click on the "Deposit" tab to view your deposit options.',
    },
    {
      id: 'step-3',
      heading: 'Step 3: Copy Your Deposit Address',
      content: 'A unique Bitcoin deposit address will be generated for your account. You can either copy the address using the copy button or scan the QR code with your mobile wallet. Important: Only send Bitcoin (BTC) to this address. Sending any other cryptocurrency may result in permanent loss of funds.',
    },
    {
      id: 'step-4',
      heading: 'Step 4: Send Bitcoin',
      content: 'Open your external Bitcoin wallet and send the desired amount to the deposit address. Double-check the address before confirming the transaction. There is no minimum deposit amount, but the transaction must include a sufficient network fee.',
    },
    {
      id: 'confirmations',
      heading: 'Confirmation Requirements',
      content: 'Bitcoin deposits require 1 network confirmation before they are credited to your account. This typically takes 10-30 minutes, but can take longer during periods of high network congestion. You can track the status of your deposit on the Transactions page.',
    },
    {
      id: 'troubleshooting',
      heading: 'Troubleshooting',
      content: 'If your deposit has not appeared after 1 hour, please check the transaction on a Bitcoin block explorer using the transaction hash (TXID). If the transaction shows as confirmed but has not been credited to your account, please contact our support team with the TXID for assistance.',
    },
  ],
};

const RELATED_ARTICLES: RelatedArticle[] = [
  { slug: 'withdrawal-processing-times', title: 'Withdrawal Processing Times', category: 'Deposits & Withdrawals', readingTime: 2 },
  { slug: 'supported-cryptocurrencies', title: 'Supported Cryptocurrencies & Networks', category: 'Deposits & Withdrawals', readingTime: 4 },
  { slug: 'what-is-provably-fair', title: 'What is Provably Fair Gaming?', category: 'Casino', readingTime: 5 },
  { slug: 'how-to-enable-2fa', title: 'How to Enable Two-Factor Authentication', category: 'Account & Security', readingTime: 3 },
];

// ---------------------------------------------------------------------------
// Help Article Detail Page
// ---------------------------------------------------------------------------

export default function HelpArticlePage() {
  const params = useParams();
  const [activeSection, setActiveSection] = useState('overview');
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);

  const article = MOCK_ARTICLE;

  // Track scroll position for ToC highlighting
  useEffect(() => {
    const handleScroll = () => {
      const sections = article.content.map((s) => ({
        id: s.id,
        el: document.getElementById(s.id),
      }));

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = sections[i].el;
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            setActiveSection(sections[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [article.content]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="pb-12">
      {/* Breadcrumb */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm text-[#8B949E] mb-6 flex-wrap"
      >
        <Link href="/help" className="hover:text-[#E6EDF3] transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Help Center
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href={`/help/${article.categorySlug}`} className="hover:text-[#E6EDF3] transition-colors">
          {article.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-[#E6EDF3] truncate">{article.title}</span>
      </motion.nav>

      <div className="flex gap-8">
        {/* Table of Contents - Sidebar (desktop) */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:block w-64 shrink-0"
        >
          <div className="sticky top-24">
            <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
              <h3 className="text-sm font-semibold text-[#E6EDF3] mb-3 flex items-center gap-2">
                <List className="w-4 h-4 text-[#8B5CF6]" />
                Table of Contents
              </h3>
              <nav className="space-y-1">
                {article.content.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      'block w-full text-left text-sm py-1.5 px-3 rounded-lg transition-all duration-200 truncate',
                      activeSection === section.id
                        ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] font-medium'
                        : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1C2128]',
                    )}
                  >
                    {section.heading}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 max-w-3xl">
          {/* Article Header */}
          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-medium px-2.5 py-1 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/25">
                {article.category}
              </span>
              <span className="text-xs text-[#8B949E] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {article.readingTime} min read
              </span>
            </div>
            <h1 className="text-3xl font-bold text-[#E6EDF3] mb-3">{article.title}</h1>
            <p className="text-sm text-[#8B949E]">
              Last updated: {new Date(article.lastUpdated).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </motion.header>

          {/* Mobile Table of Contents */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="lg:hidden mb-8"
          >
            <details className="bg-[#161B22] border border-[#30363D] rounded-card">
              <summary className="p-4 text-sm font-semibold text-[#E6EDF3] cursor-pointer flex items-center gap-2">
                <List className="w-4 h-4 text-[#8B5CF6]" />
                Table of Contents
              </summary>
              <nav className="px-4 pb-4 space-y-1">
                {article.content.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="block w-full text-left text-sm py-1.5 px-3 rounded-lg text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#1C2128] transition-all"
                  >
                    {section.heading}
                  </button>
                ))}
              </nav>
            </details>
          </motion.div>

          {/* Article Content */}
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            {article.content.map((section, idx) => (
              <section key={section.id} id={section.id}>
                <h2 className="text-xl font-bold text-[#E6EDF3] mb-3 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] text-xs font-bold">
                    {idx + 1}
                  </span>
                  {section.heading}
                </h2>
                <div className="bg-[#161B22] border border-[#30363D] rounded-card p-5">
                  <p className="text-[#C9D1D9] leading-relaxed">{section.content}</p>
                </div>
              </section>
            ))}
          </motion.article>

          {/* Helpful? Feedback */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 mb-10"
          >
            <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6 text-center">
              {feedback === null ? (
                <>
                  <p className="text-[#E6EDF3] font-semibold mb-4">Was this article helpful?</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setFeedback('yes')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/25 text-[#10B981] hover:bg-[#10B981]/20 transition-all font-medium text-sm"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Yes, it helped
                    </button>
                    <button
                      onClick={() => setFeedback('no')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/25 text-[#EF4444] hover:bg-[#EF4444]/20 transition-all font-medium text-sm"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Not really
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 text-[#10B981]">
                  <CheckCircle className="w-5 h-5" />
                  <p className="font-medium">
                    {feedback === 'yes'
                      ? 'Glad this helped! Thank you for your feedback.'
                      : 'Thank you for your feedback. We will work to improve this article.'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Related Articles */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-xl font-bold text-[#E6EDF3] mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#8B5CF6]" />
              Related Articles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RELATED_ARTICLES.map((ra) => (
                <Link key={ra.slug} href={`/help/${ra.slug}`}>
                  <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4 hover:border-[#8B5CF6]/30 transition-all duration-200 group flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#1C2128] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[#8B5CF6]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#E6EDF3] truncate group-hover:text-[#A78BFA] transition-colors">
                        {ra.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#8B949E] mt-0.5">
                        <span>{ra.category}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ra.readingTime}m
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B949E] shrink-0 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
