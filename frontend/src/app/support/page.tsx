'use client';

import Link from 'next/link';
import { HelpCircle, MessageCircle, Mail, FileText } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/10 mb-4">
          <HelpCircle className="w-8 h-8 text-brand-400" />
        </div>
        <h1 className="text-3xl font-bold mb-3">Support</h1>
        <p className="text-gray-400 text-lg">
          Need help? We are here for you. Choose an option below.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/help"
          className="card p-6 hover:border-brand-500/40 transition-colors group"
        >
          <FileText className="w-6 h-6 text-brand-400 mb-3" />
          <h2 className="font-semibold mb-1 group-hover:text-white transition-colors">Help Center</h2>
          <p className="text-sm text-gray-400">
            Browse FAQs and articles for quick answers.
          </p>
        </Link>

        <a
          href="https://t.me/cryptobet"
          target="_blank"
          rel="noopener noreferrer"
          className="card p-6 hover:border-brand-500/40 transition-colors group"
        >
          <MessageCircle className="w-6 h-6 text-brand-400 mb-3" />
          <h2 className="font-semibold mb-1 group-hover:text-white transition-colors">Telegram</h2>
          <p className="text-sm text-gray-400">
            Chat with our community and support team.
          </p>
        </a>

        <a
          href="mailto:support@cryptobet.com"
          className="card p-6 hover:border-brand-500/40 transition-colors group"
        >
          <Mail className="w-6 h-6 text-brand-400 mb-3" />
          <h2 className="font-semibold mb-1 group-hover:text-white transition-colors">Email</h2>
          <p className="text-sm text-gray-400">
            Send us an email and we will get back to you.
          </p>
        </a>

        <Link
          href="/responsible-gambling"
          className="card p-6 hover:border-brand-500/40 transition-colors group"
        >
          <HelpCircle className="w-6 h-6 text-brand-400 mb-3" />
          <h2 className="font-semibold mb-1 group-hover:text-white transition-colors">Responsible Gambling</h2>
          <p className="text-sm text-gray-400">
            Tools and resources for responsible play.
          </p>
        </Link>
      </div>

      <div className="text-center">
        <Link href="/" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
