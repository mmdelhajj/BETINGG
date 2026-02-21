export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-text mb-6">About CryptoBet</h1>
      <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
        <div className="bg-background-card border border-border rounded-card p-6">
          <h2 className="text-lg font-semibold text-text mb-3">Our Mission</h2>
          <p>CryptoBet is a next-generation cryptocurrency sportsbook and casino platform, combining the excitement of sports betting and casino gaming with the security and transparency of blockchain technology.</p>
        </div>
        <div className="bg-background-card border border-border rounded-card p-6">
          <h2 className="text-lg font-semibold text-text mb-3">Why CryptoBet?</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Provably fair casino games with verifiable results</li>
            <li>Competitive odds powered by multiple providers</li>
            <li>Instant crypto deposits and fast withdrawals</li>
            <li>Multi-tier VIP rewards program</li>
            <li>24/7 live betting on thousands of events</li>
            <li>Support for 40+ cryptocurrencies</li>
          </ul>
        </div>
        <div className="bg-background-card border border-border rounded-card p-6">
          <h2 className="text-lg font-semibold text-text mb-3">Security</h2>
          <p>We employ industry-leading security practices including end-to-end encryption, two-factor authentication, and regular security audits. All casino games use provably fair algorithms based on HMAC-SHA256 cryptographic verification.</p>
        </div>
      </div>
    </div>
  );
}
