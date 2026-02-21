export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-text mb-6">Privacy Policy</h1>
      <div className="bg-background-card border border-border rounded-card p-6 space-y-6 text-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">1. Information We Collect</h2>
          <p>We collect information you provide during registration (email, username, date of birth), KYC verification documents, and transaction history. We also collect technical data such as IP addresses and browser information for security purposes.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">2. How We Use Your Information</h2>
          <p>Your information is used to provide our services, verify your identity, process transactions, prevent fraud, comply with legal obligations, and improve our platform. We do not sell your personal data to third parties.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">3. Data Security</h2>
          <p>We implement industry-standard security measures including encryption, secure connections (TLS), and regular security audits to protect your data. Access to personal information is restricted to authorized personnel only.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">4. Cookies</h2>
          <p>We use essential cookies for authentication and session management. Analytics cookies help us understand how users interact with our platform. You can manage cookie preferences in your browser settings.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text mb-2">5. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data. You can download your data or request account deletion by contacting our support team. Some data may be retained as required by law.</p>
        </section>
        <section>
          <p className="text-text-muted text-xs">Last updated: February 2026</p>
        </section>
      </div>
    </div>
  );
}
