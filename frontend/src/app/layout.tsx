import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import Providers from '@/components/layout/Providers';

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: {
    default: 'CryptoBet - Crypto Sports Betting',
    template: '%s | CryptoBet',
  },
  description:
    'The premier crypto sports betting platform. Bet on sports with Bitcoin, Ethereum, and other cryptocurrencies. Live betting, competitive odds, and instant payouts.',
  keywords: [
    'crypto betting',
    'bitcoin sports betting',
    'ethereum betting',
    'cryptocurrency gambling',
    'live sports betting',
    'crypto sportsbook',
  ],
  authors: [{ name: 'CryptoBet' }],
  creator: 'CryptoBet',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://cryptobet.com',
    siteName: 'CryptoBet',
    title: 'CryptoBet - Crypto Sports Betting',
    description:
      'Bet on sports with Bitcoin, Ethereum, and other cryptocurrencies. Live betting, competitive odds, and instant payouts.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CryptoBet - Crypto Sports Betting',
    description:
      'Bet on sports with Bitcoin, Ethereum, and other cryptocurrencies.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#0D1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
