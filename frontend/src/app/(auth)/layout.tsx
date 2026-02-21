import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Authentication',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0D1117' }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Subtle purple glow top-left */}
        <div className="absolute -top-1/3 -left-1/4 w-[700px] h-[700px] rounded-full bg-accent/[0.04] blur-[120px]" />
        {/* Subtle purple glow bottom-right */}
        <div className="absolute -bottom-1/3 -right-1/4 w-[500px] h-[500px] rounded-full bg-accent/[0.03] blur-[100px]" />
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(139,92,246,0.4) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative w-full max-w-[440px] z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-lg shadow-accent/20 group-hover:shadow-accent/30 transition-shadow duration-300">
              <span className="text-white font-bold text-lg">CB</span>
            </div>
            <span className="text-2xl font-bold text-[#E6EDF3] tracking-tight">
              Crypto<span className="text-accent">Bet</span>
            </span>
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
