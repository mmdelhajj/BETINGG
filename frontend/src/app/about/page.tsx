'use client';

import Link from 'next/link';

const stats = [
  { label: '50+', description: 'Sports', detail: 'Covering all major leagues and events worldwide' },
  { label: '1000+', description: 'Casino Games', detail: 'Slots, table games, live dealer, and more' },
  { label: '35+', description: 'Cryptocurrencies', detail: 'Bitcoin, Ethereum, and many altcoins accepted' },
  { label: '24/7', description: 'Support', detail: 'Round-the-clock customer assistance' },
];

const features = [
  {
    title: 'Fast Payouts',
    description:
      'Withdrawals processed in minutes, not days. Our automated payout system ensures you receive your winnings quickly through the blockchain.',
  },
  {
    title: 'Provably Fair',
    description:
      'All our casino games use cryptographic algorithms that allow you to independently verify every result. Full transparency, zero manipulation.',
  },
  {
    title: 'Best Odds',
    description:
      'We offer some of the most competitive odds in the industry. Lower margins mean better value for every bet you place on our platform.',
  },
  {
    title: 'VIP Program',
    description:
      'Earn loyalty points on every wager and climb through our VIP tiers. Exclusive bonuses, higher limits, personal account managers, and more.',
  },
  {
    title: 'Multi-Currency',
    description:
      'Bet with over 35 cryptocurrencies including Bitcoin, Ethereum, USDT, Solana, and many more. Seamless deposits and withdrawals across all chains.',
  },
  {
    title: 'Live Betting',
    description:
      'Place bets on thousands of live events every day with real-time odds updates. Stream events directly on our platform while you bet.',
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-surface-secondary p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 to-accent-purple/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">About CryptoBet</h1>
          <p className="text-lg md:text-xl text-gray-300 leading-relaxed">
            The leading cryptocurrency sportsbook and casino platform, delivering a premium betting
            experience with the speed, security, and transparency that only blockchain technology
            can provide.
          </p>
        </div>
      </div>

      {/* Mission Statement */}
      <section className="card">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-2xl font-bold">Our Mission</h2>
          <p className="text-gray-300 leading-relaxed">
            At CryptoBet, our mission is to revolutionize the online betting industry by combining
            cutting-edge blockchain technology with an unparalleled user experience. We believe that
            every player deserves a platform that is transparent, fair, fast, and secure -- and
            that is exactly what we have built.
          </p>
          <p className="text-gray-300 leading-relaxed">
            We are committed to providing the widest selection of sports and casino games, the most
            competitive odds, and the fastest payouts in the industry. By leveraging cryptocurrency,
            we eliminate the friction, delays, and fees associated with traditional payment methods,
            giving our users full control over their funds at all times.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-8">CryptoBet by the Numbers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.description}
              className="card text-center hover:border-brand-500/30 transition-colors"
            >
              <div className="text-3xl md:text-4xl font-bold text-brand-400 mb-1">
                {stat.label}
              </div>
              <div className="text-sm font-semibold mb-2">{stat.description}</div>
              <p className="text-xs text-gray-500">{stat.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section>
        <h2 className="text-2xl font-bold text-center mb-2">Why Choose CryptoBet</h2>
        <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
          We have built CryptoBet from the ground up with players in mind. Here is what sets us
          apart from the competition.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="card hover:border-brand-500/30 transition-colors group"
            >
              <h3 className="text-lg font-semibold mb-2 group-hover:text-brand-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Company Section */}
      <section className="card">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center">Our Story</h2>
          <p className="text-gray-300 leading-relaxed">
            Founded in 2024, CryptoBet was created by a team of industry veterans, blockchain
            engineers, and gaming enthusiasts who saw the opportunity to build a better betting
            platform. Drawing on decades of combined experience in online gaming, fintech, and
            distributed systems, we set out to create a platform that truly puts players first.
          </p>
          <p className="text-gray-300 leading-relaxed">
            CryptoBet is fully licensed and regulated, operating under strict compliance with
            applicable gambling regulations. We hold ourselves to the highest standards of
            integrity, fairness, and responsible gambling. Our platform undergoes regular third-party
            audits to ensure that all games operate fairly and that our random number generators
            produce genuinely random results.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Transparency is at the core of everything we do. From our provably fair casino games to
            our publicly verifiable on-chain transactions, we believe that trust is earned through
            openness. We are proud to be building a new standard for the online betting industry --
            one that prioritizes fairness, speed, and player experience above all else.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="bg-surface-tertiary rounded-xl p-4 text-center">
              <div className="text-sm font-semibold text-brand-400 mb-1">Founded</div>
              <div className="text-lg font-bold">2024</div>
            </div>
            <div className="bg-surface-tertiary rounded-xl p-4 text-center">
              <div className="text-sm font-semibold text-brand-400 mb-1">Licensed</div>
              <div className="text-lg font-bold">Fully Regulated</div>
            </div>
            <div className="bg-surface-tertiary rounded-xl p-4 text-center">
              <div className="text-sm font-semibold text-brand-400 mb-1">Commitment</div>
              <div className="text-lg font-bold">Fair & Transparent</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 to-brand-800 p-8 md:p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent" />
        <div className="relative z-10 text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to Start?</h2>
          <p className="text-gray-300 max-w-xl mx-auto">
            Join thousands of players who have already discovered the future of online betting.
            Create your account in seconds and start playing today.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register" className="btn-primary text-lg px-8 py-3">
              Register Now
            </Link>
            <Link href="/sports" className="btn-secondary text-lg px-8 py-3">
              Browse Sports
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
