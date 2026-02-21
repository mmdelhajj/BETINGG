export default function AMLPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-text mb-6">Anti-Money Laundering Policy</h1>
      <div className="bg-background-card border border-border rounded-card p-6 space-y-6 text-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">1. Purpose</h2>
          <p>CryptoBet is committed to preventing money laundering and terrorist financing. This AML policy outlines the measures we take to detect and prevent the use of our platform for illegal activities.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">2. Know Your Customer (KYC)</h2>
          <p>We implement a tiered KYC verification process. Users must verify their identity to access higher withdrawal limits. Required documents include government-issued ID and proof of address.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">3. Transaction Monitoring</h2>
          <p>All transactions are monitored for suspicious activity. Unusual patterns such as rapid deposits and withdrawals without significant gaming activity, or transactions inconsistent with a user&apos;s profile, are flagged for review.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">4. Suspicious Activity Reporting</h2>
          <p>When suspicious activity is identified, we file reports with the appropriate authorities as required by applicable law. We may freeze or close accounts pending investigation.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">5. Record Keeping</h2>
          <p>We maintain records of all customer identification documents and transaction records for a minimum of five years after account closure, in compliance with regulatory requirements.</p>
        </section>
        <section>
          <p className="text-text-muted text-xs">Last updated: February 2026</p>
        </section>
      </div>
    </div>
  );
}
