import './globals.css';
import type { Metadata } from 'next';
import { ClientProviders } from './providers';

export const metadata: Metadata = {
  title: 'CryptoBet - Crypto Sportsbook & Casino',
  description: 'The best crypto betting platform with sports, casino, and esports.',
  themeColor: '#0F0F12',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className="min-h-screen text-white overflow-x-hidden"
        style={{
          backgroundColor: '#0F0F12',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
