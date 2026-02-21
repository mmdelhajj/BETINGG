import Link from 'next/link';

export default function AffiliatesPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-text mb-6">Affiliate Program</h1>
      <div className="space-y-6">
        <div className="bg-background-card border border-border rounded-card p-6">
          <h2 className="text-lg font-semibold text-text mb-3">Earn With CryptoBet</h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Join our affiliate program and earn commissions by referring new players to CryptoBet. Enjoy competitive revenue share rates, real-time tracking, and timely payouts in cryptocurrency.
          </p>
        </div>
        <div className="bg-background-card border border-border rounded-card p-6">
          <h2 className="text-lg font-semibold text-text mb-3">How It Works</h2>
          <ul className="list-disc list-inside space-y-2 text-text-secondary text-sm">
            <li>Sign up for a free affiliate account</li>
            <li>Get your unique referral link</li>
            <li>Share with your audience</li>
            <li>Earn up to 40% revenue share on referred players</li>
          </ul>
        </div>
        <div className="bg-background-card border border-border rounded-card p-6 text-center">
          <p className="text-text-secondary text-sm mb-4">Already a member? Use your referral dashboard to track earnings.</p>
          <Link href="/referrals" className="inline-flex items-center px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-button transition-colors">
            Go to Referrals
          </Link>
        </div>
      </div>
    </div>
  );
}
