'use client';

import Link from 'next/link';

const sections = [
  { id: 'information-collect', title: '1. Information We Collect' },
  { id: 'how-we-use', title: '2. How We Use Your Information' },
  { id: 'data-sharing', title: '3. Data Sharing & Disclosure' },
  { id: 'data-security', title: '4. Data Security' },
  { id: 'cookies', title: '5. Cookies & Tracking' },
  { id: 'your-rights', title: '6. Your Rights' },
  { id: 'data-retention', title: '7. Data Retention' },
  { id: 'international', title: '8. International Transfers' },
  { id: 'children', title: '9. Children\'s Privacy' },
  { id: 'changes', title: '10. Changes to Policy' },
  { id: 'contact', title: '11. Contact' },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
          <span>Last updated: January 15, 2025</span>
          <span className="w-1 h-1 bg-gray-600 rounded-full" />
          <span>Effective: February 1, 2025</span>
        </div>
        <p className="text-gray-500 text-sm max-w-2xl mx-auto">
          This Privacy Policy explains how CryptoBet collects, uses, discloses, and protects your
          personal information when you use our platform. We are committed to safeguarding your
          privacy and ensuring transparency in our data practices.
        </p>
      </div>

      {/* Table of Contents */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
        <nav className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="text-sm text-brand-400 hover:text-brand-300 transition-colors py-1"
            >
              {section.title}
            </a>
          ))}
        </nav>
      </div>

      {/* Section 1 */}
      <section id="information-collect" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">1. Information We Collect</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          We collect information that you provide directly to us when you create an account, make
          transactions, contact customer support, or participate in promotions. This includes your
          email address, username, date of birth, country of residence, and cryptocurrency wallet
          addresses. When identity verification is required, we may also collect your full legal
          name, government-issued identification documents, proof of address, and photographs.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We automatically collect certain technical information when you access or use our platform,
          including your IP address, device type, operating system, browser type and version,
          referring URLs, pages visited, time spent on pages, click patterns, and other usage
          statistics. We may also collect information about your geographic location based on your
          IP address to comply with regulatory requirements.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Transaction data is collected and maintained for all deposits, withdrawals, bets, and
          casino game activity. This includes transaction amounts, timestamps, blockchain
          transaction hashes, bet details (selections, odds, stakes, results), and game session
          data. This information is essential for providing our services, ensuring fair play, and
          meeting our regulatory obligations.
        </p>
      </section>

      {/* Section 2 */}
      <section id="how-we-use" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">2. How We Use Your Information</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          We use your personal information primarily to provide, maintain, and improve our services.
          This includes processing your transactions, settling bets, managing your account, providing
          customer support, and personalizing your experience on the platform. We also use your
          information to verify your identity, prevent fraud, and comply with applicable legal and
          regulatory requirements.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          With your consent, we may use your contact information to send you promotional
          communications, including information about new features, special offers, and upcoming
          events. You can opt out of marketing communications at any time through your account
          settings or by following the unsubscribe instructions in our emails. Please note that even
          if you opt out of marketing, we may still send you transactional or service-related
          communications.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We use aggregated and anonymized data for analytics purposes, including analyzing usage
          trends, monitoring platform performance, improving our services, and developing new
          features. This aggregated data does not identify individual users and may be shared with
          third parties for research or business purposes.
        </p>
      </section>

      {/* Section 3 */}
      <section id="data-sharing" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">3. Data Sharing & Disclosure</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet does not sell your personal information to third parties. We may share your
          information with trusted service providers who assist us in operating our platform,
          processing transactions, conducting identity verification, and providing customer support.
          These service providers are contractually obligated to protect your information and use it
          only for the purposes we specify.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We may disclose your information when required by law, regulation, legal process, or
          governmental request. This includes responding to subpoenas, court orders, or regulatory
          inquiries. We may also share information with law enforcement agencies if we believe in
          good faith that disclosure is necessary to prevent fraud, money laundering, terrorist
          financing, or other illegal activities, or to protect the rights, property, or safety of
          CryptoBet, our users, or the public.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          In the event of a merger, acquisition, reorganization, or sale of assets, your personal
          information may be transferred as part of that transaction. We will notify you via email or
          a prominent notice on our platform of any change in ownership or uses of your personal
          information, as well as any choices you may have regarding your information.
        </p>
      </section>

      {/* Section 4 */}
      <section id="data-security" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">4. Data Security</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          We implement robust technical and organizational security measures to protect your personal
          information against unauthorized access, alteration, disclosure, or destruction. These
          measures include encryption of data in transit and at rest using industry-standard
          protocols (TLS 1.3 and AES-256), multi-factor authentication, regular security audits,
          and penetration testing.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Access to personal information is restricted to authorized employees and service providers
          who require access to perform their job functions. All personnel with access to sensitive
          data undergo background checks and receive regular training on data protection and security
          best practices. We maintain detailed access logs and conduct regular reviews of access
          permissions.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          While we strive to protect your personal information, no method of electronic transmission
          or storage is completely secure. We cannot guarantee absolute security, and you acknowledge
          that you transmit information to us at your own risk. We encourage you to use strong,
          unique passwords, enable two-factor authentication, and take other steps to protect your
          account.
        </p>
      </section>

      {/* Section 5 */}
      <section id="cookies" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">5. Cookies & Tracking</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet uses cookies and similar tracking technologies to enhance your experience on our
          platform. Essential cookies are necessary for the operation of our website and enable core
          functionality such as security, session management, and accessibility. These cookies cannot
          be disabled without affecting the functionality of the platform.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We also use analytics cookies to understand how users interact with our platform, which
          helps us improve our services. Performance cookies help us monitor and optimize platform
          performance. Functionality cookies remember your preferences and settings. You can manage
          your cookie preferences through your browser settings or our cookie consent banner.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We may use third-party analytics services (such as Google Analytics) to collect and analyze
          usage data. These services may use their own cookies and tracking technologies. We do not
          use advertising cookies or allow third-party advertising networks to track users on our
          platform. For more information about the cookies we use, please refer to our Cookie Policy.
        </p>
      </section>

      {/* Section 6 */}
      <section id="your-rights" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">6. Your Rights</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          Depending on your jurisdiction, you may have certain rights regarding your personal
          information, including the right to access, correct, update, or delete your personal data.
          You may also have the right to restrict or object to certain processing of your
          information, the right to data portability, and the right to withdraw consent where
          processing is based on consent.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          To exercise any of these rights, please contact us using the information provided in the
          Contact section below. We will respond to your request within 30 days, as required by
          applicable law. Please note that certain rights may be limited by regulatory requirements
          -- for example, we may be required to retain certain data for anti-money laundering
          compliance even if you request deletion.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          If you are a resident of the European Economic Area (EEA), United Kingdom, or California,
          you may have additional rights under the GDPR, UK GDPR, or CCPA respectively. These
          include the right to lodge a complaint with a supervisory authority and the right not to be
          discriminated against for exercising your privacy rights. We will not deny services or
          change pricing based on your exercise of privacy rights.
        </p>
      </section>

      {/* Section 7 */}
      <section id="data-retention" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">7. Data Retention</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          We retain your personal information for as long as your account is active or as needed to
          provide you with our services. After account closure, we may retain certain information for
          a period necessary to comply with our legal obligations, resolve disputes, enforce our
          agreements, and meet regulatory requirements. Transaction records and identity verification
          documents are typically retained for a minimum of five years after account closure.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Anonymized and aggregated data that cannot be used to identify you may be retained
          indefinitely for analytical and statistical purposes. When personal data is no longer
          required, it is securely deleted or anonymized in accordance with our data retention
          policies and applicable legal requirements.
        </p>
      </section>

      {/* Section 8 */}
      <section id="international" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">8. International Transfers</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet operates globally, and your personal information may be transferred to, stored,
          and processed in countries other than your country of residence. These countries may have
          data protection laws that differ from those of your jurisdiction. By using our platform,
          you consent to the transfer of your information to countries where we or our service
          providers operate.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          When transferring personal data from the EEA, UK, or other jurisdictions with data
          transfer restrictions, we implement appropriate safeguards to ensure your data is
          adequately protected. These safeguards may include Standard Contractual Clauses approved
          by the European Commission, adequacy decisions, or other legally recognized transfer
          mechanisms.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We regularly assess the data protection laws of the countries to which we transfer data
          and implement supplementary measures where necessary to ensure an equivalent level of
          protection. You may request information about the safeguards we have in place for
          international data transfers by contacting us.
        </p>
      </section>

      {/* Section 9 */}
      <section id="children" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">9. Children&apos;s Privacy</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet is not intended for use by individuals under the age of 18 or the minimum legal
          gambling age in their jurisdiction, whichever is higher. We do not knowingly collect
          personal information from minors. If we become aware that we have inadvertently collected
          personal information from a minor, we will take immediate steps to delete such information
          from our records.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          If you are a parent or guardian and believe that your child has provided personal
          information to CryptoBet, please contact us immediately so that we can take appropriate
          action. We encourage parents and guardians to monitor their children&apos;s internet usage and
          to use parental controls and filtering software to prevent minors from accessing gambling
          websites.
        </p>
      </section>

      {/* Section 10 */}
      <section id="changes" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">10. Changes to Policy</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          We may update this Privacy Policy from time to time to reflect changes in our practices,
          technologies, legal requirements, or other factors. When we make material changes, we will
          notify you by updating the &quot;Last updated&quot; date at the top of this policy, posting a notice
          on our platform, and, where required by law, sending you an email notification.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We encourage you to periodically review this Privacy Policy to stay informed about how we
          collect, use, and protect your information. Your continued use of the platform after the
          effective date of any updated Privacy Policy constitutes your acceptance of the changes. If
          you do not agree with the revised policy, you should discontinue use of our services and
          close your account.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Previous versions of this Privacy Policy are available upon request. We maintain an archive
          of all prior versions and can provide them to you if needed for your reference or legal
          requirements.
        </p>
      </section>

      {/* Section 11 */}
      <section id="contact" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">11. Contact</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          If you have any questions, concerns, or requests regarding this Privacy Policy or our data
          practices, please contact our Data Protection Officer through the following channels:
        </p>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <span className="text-gray-500">Email:</span>{' '}
            <span className="text-brand-400">privacy@cryptobet.com</span>
          </p>
          <p>
            <span className="text-gray-500">Data Protection Officer:</span>{' '}
            <span className="text-brand-400">dpo@cryptobet.com</span>
          </p>
          <p>
            <span className="text-gray-500">Help Center:</span>{' '}
            <Link href="/help" className="text-brand-400 hover:text-brand-300 underline">
              Visit our Help Center
            </Link>
          </p>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">
          For requests related to your personal data rights (access, correction, deletion, etc.),
          please allow up to 30 days for us to process your request. We may need to verify your
          identity before fulfilling certain requests. If you are unsatisfied with our response, you
          have the right to lodge a complaint with your local data protection authority.
        </p>
      </section>

      {/* Back to top */}
      <div className="text-center">
        <a
          href="#"
          className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
        >
          Back to top
        </a>
      </div>
    </div>
  );
}
