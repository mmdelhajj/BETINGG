'use client';

import Link from 'next/link';

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'eligibility', title: '2. Eligibility' },
  { id: 'account', title: '3. Account Registration' },
  { id: 'deposits', title: '4. Deposits & Withdrawals' },
  { id: 'betting', title: '5. Betting Rules' },
  { id: 'casino', title: '6. Casino Games' },
  { id: 'bonuses', title: '7. Bonuses & Promotions' },
  { id: 'responsible', title: '8. Responsible Gambling' },
  { id: 'prohibited', title: '9. Prohibited Activities' },
  { id: 'liability', title: '10. Limitation of Liability' },
  { id: 'privacy', title: '11. Privacy' },
  { id: 'disputes', title: '12. Dispute Resolution' },
  { id: 'modifications', title: '13. Modifications' },
  { id: 'contact', title: '14. Contact' },
];

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold">Terms of Service</h1>
        <p className="text-gray-400 text-sm">
          Last updated: January 15, 2025
        </p>
        <p className="text-gray-500 text-sm max-w-2xl mx-auto">
          Please read these Terms of Service carefully before using CryptoBet. By accessing or using
          our platform, you agree to be bound by these terms and conditions.
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
      <section id="acceptance" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">1. Acceptance of Terms</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          By creating an account, accessing, or using the CryptoBet platform (the &quot;Service&quot;), you
          acknowledge that you have read, understood, and agree to be bound by these Terms of Service
          (&quot;Terms&quot;). These Terms constitute a legally binding agreement between you and CryptoBet
          (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). If you do not agree with any part of these Terms,
          you must not use our Service.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          These Terms apply to all users of the Service, including without limitation users who are
          browsers, customers, merchants, vendors, and contributors of content. Your continued use
          of the platform after any modifications to these Terms constitutes acceptance of those
          changes.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Additional terms and conditions may apply to specific features, promotions, or services
          offered through the platform. Such additional terms are hereby incorporated by reference
          into these Terms. In the event of a conflict between these Terms and any additional terms,
          the additional terms shall control for that specific feature or service.
        </p>
      </section>

      {/* Section 2 */}
      <section id="eligibility" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">2. Eligibility</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          You must be at least 18 years of age, or the minimum legal gambling age in your
          jurisdiction (whichever is greater), to use the CryptoBet platform. By accessing and using
          our Service, you represent and warrant that you meet the minimum age requirement and have
          the legal capacity to enter into a binding agreement.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          It is your sole responsibility to ensure that your use of CryptoBet complies with all
          applicable laws and regulations in your jurisdiction. CryptoBet does not provide services
          to individuals residing in jurisdictions where online gambling is prohibited or restricted.
          We reserve the right to restrict access to our services based on geographic location and
          may use geolocation technology to enforce these restrictions.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Users who are employees, directors, or agents of CryptoBet, or their immediate family
          members, are prohibited from placing bets or wagers on the platform. We also reserve the
          right to refuse service to any individual at our sole discretion, including but not limited
          to individuals who have been previously banned from the platform.
        </p>
      </section>

      {/* Section 3 */}
      <section id="account" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">3. Account Registration</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          To use certain features of CryptoBet, you must create an account by providing accurate,
          current, and complete information. You are responsible for maintaining the confidentiality
          of your account credentials, including your password and any authentication tokens. You
          agree to notify us immediately of any unauthorized use of your account.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Each individual is permitted to maintain only one account on CryptoBet. Creating multiple
          accounts is strictly prohibited and may result in the immediate termination of all accounts
          and forfeiture of any balances. We employ various methods to detect and prevent multi-
          accounting, including IP address monitoring, device fingerprinting, and identity
          verification.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We may require you to undergo identity verification (Know Your Customer or KYC) procedures
          at any time. Failure to provide requested documentation within the specified timeframe may
          result in account suspension or closure. All personal information provided during
          registration and verification is handled in accordance with our Privacy Policy.
        </p>
      </section>

      {/* Section 4 */}
      <section id="deposits" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">4. Deposits & Withdrawals</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet accepts deposits and processes withdrawals exclusively in supported
          cryptocurrencies. All transactions are processed on their respective blockchain networks,
          and processing times may vary depending on network conditions, congestion, and confirmation
          requirements. Minimum deposit and withdrawal amounts apply and are displayed on the
          platform.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          You are solely responsible for ensuring the accuracy of wallet addresses when initiating
          transactions. CryptoBet is not liable for funds sent to incorrect addresses due to user
          error. Deposits are credited to your account after the required number of blockchain
          confirmations. We reserve the right to request additional verification before processing
          withdrawals, particularly for large amounts.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Withdrawal requests are typically processed within 24 hours, subject to security checks
          and verification procedures. CryptoBet reserves the right to impose daily, weekly, or
          monthly withdrawal limits. All transactions are subject to applicable blockchain network
          fees, which are borne by the user. We do not charge additional fees for standard deposits
          or withdrawals.
        </p>
      </section>

      {/* Section 5 */}
      <section id="betting" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">5. Betting Rules</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          All bets placed on CryptoBet are subject to these Terms and our specific Betting Rules.
          Once a bet is confirmed and accepted by our system, it cannot be cancelled or modified
          unless otherwise stated. We reserve the right to void or cancel bets in cases of obvious
          errors, technical malfunctions, or suspicion of fraud. Minimum and maximum bet limits apply
          to all markets.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Odds are subject to change at any time prior to bet acceptance. The odds displayed at the
          time of bet placement and confirmation are the odds that apply to your bet. In the event of
          a dispute regarding odds, the odds recorded in our system at the time of bet acceptance
          shall be considered final. CryptoBet uses industry-standard settlement procedures for all
          sporting events.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          For live (in-play) betting, there may be a delay between the submission of a bet and its
          acceptance. Bets placed during this delay period are subject to acceptance based on current
          odds. CryptoBet reserves the right to suspend or close any market at any time. In the
          event of an abandoned or postponed event, bets will be settled according to our specific
          rules for that sport.
        </p>
      </section>

      {/* Section 6 */}
      <section id="casino" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">6. Casino Games</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet offers a variety of casino games, including slots, table games, live dealer
          games, and provably fair games. All games are operated using certified random number
          generators (RNGs) or, in the case of provably fair games, cryptographic algorithms that
          allow independent verification of results. Return-to-player (RTP) percentages are
          displayed for each game where applicable.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Game rules and paytables are available within each game interface. It is your
          responsibility to review and understand the rules before placing any wagers. In the event
          of a discrepancy between the game rules displayed and the underlying game logic, the
          underlying game logic shall prevail. Maximum win limits may apply to certain games or
          bonus-related play.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet is not responsible for interruptions to gameplay caused by network connectivity
          issues, device malfunctions, or other factors outside our control. In the event of a game
          malfunction, any affected bets will be voided and stakes returned to the player. We
          reserve the right to adjust balances if a game result is determined to have been affected
          by a software error.
        </p>
      </section>

      {/* Section 7 */}
      <section id="bonuses" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">7. Bonuses & Promotions</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet may offer bonuses, free bets, promotions, and other incentives from time to
          time. All bonuses and promotions are subject to specific terms and conditions, including
          wagering requirements, time limits, maximum bet sizes, and game restrictions. These
          specific terms will be clearly communicated at the time of the promotion.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Bonuses are intended for recreational players and are limited to one per person, household,
          IP address, email address, and payment method. CryptoBet reserves the right to revoke
          bonuses and any associated winnings if we determine that a user has abused or attempted to
          abuse a promotion, engaged in irregular play patterns, or created multiple accounts to
          exploit bonus offers.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Wagering requirements must be met within the specified timeframe for bonus funds and
          associated winnings to be eligible for withdrawal. Contributions toward wagering
          requirements vary by game type and are specified in the promotion terms. CryptoBet
          reserves the right to modify or cancel any promotion at any time, subject to honoring
          existing obligations to users who have already opted in.
        </p>
      </section>

      {/* Section 8 */}
      <section id="responsible" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">8. Responsible Gambling</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet is committed to promoting responsible gambling practices. We provide various
          tools to help you manage your gambling activity, including deposit limits, loss limits,
          wager limits, session time limits, cooling-off periods, and self-exclusion options. We
          encourage all users to set personal limits and gamble responsibly.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          If you believe you may have a gambling problem, we urge you to seek help from professional
          organizations such as GamCare, Gamblers Anonymous, or similar services available in your
          jurisdiction. You may request a self-exclusion period at any time by contacting our support
          team. During self-exclusion, your account will be suspended and you will be unable to place
          any bets or wagers.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Gambling should be viewed as a form of entertainment, not as a means of generating income.
          Never gamble with money you cannot afford to lose. CryptoBet reserves the right to impose
          restrictions on any account if we have reason to believe the user may be experiencing
          gambling-related harm. For more information, please visit our{' '}
          <Link href="/responsible-gambling" className="text-brand-400 hover:text-brand-300 underline">
            Responsible Gambling
          </Link>{' '}
          page.
        </p>
      </section>

      {/* Section 9 */}
      <section id="prohibited" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">9. Prohibited Activities</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          Users are strictly prohibited from engaging in the following activities: using the platform
          for money laundering or terrorist financing; using automated software, bots, or scripts to
          interact with the platform; colluding with other users to defraud the platform; exploiting
          software bugs or vulnerabilities; and engaging in any form of cheating or match-fixing.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Additionally, users must not attempt to gain unauthorized access to other users&apos; accounts,
          our servers, or any systems connected to our platform. Use of VPNs or proxy servers to
          circumvent geographic restrictions is prohibited. Users must not use the platform for any
          purpose that is unlawful, abusive, or prohibited by these Terms.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Violation of these prohibitions may result in immediate account suspension, forfeiture of
          balances, and permanent exclusion from the platform. We reserve the right to report
          suspected illegal activities to the relevant authorities. CryptoBet employs advanced
          monitoring systems to detect and prevent prohibited activities, and any suspicious
          behavior will be investigated.
        </p>
      </section>

      {/* Section 10 */}
      <section id="liability" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">10. Limitation of Liability</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          To the maximum extent permitted by applicable law, CryptoBet and its officers, directors,
          employees, agents, and affiliates shall not be liable for any indirect, incidental,
          special, consequential, or punitive damages, including but not limited to loss of profits,
          data, use, or other intangible losses, arising out of or in connection with your use of or
          inability to use the Service.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet does not guarantee uninterrupted, secure, or error-free operation of the
          platform. The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
          warranties of any kind, either express or implied. We disclaim all warranties, including
          implied warranties of merchantability, fitness for a particular purpose, and
          non-infringement.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          In no event shall our total liability to you for all claims arising out of or relating to
          the use of the Service exceed the amount of funds deposited by you in the 12 months
          preceding the claim. Some jurisdictions do not allow the exclusion or limitation of
          certain warranties or liabilities, so these limitations may not apply to you in their
          entirety.
        </p>
      </section>

      {/* Section 11 */}
      <section id="privacy" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">11. Privacy</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          Your privacy is important to us. Our collection, use, and protection of your personal
          information is governed by our{' '}
          <Link href="/privacy" className="text-brand-400 hover:text-brand-300 underline">
            Privacy Policy
          </Link>
          , which is incorporated into these Terms by reference. By using CryptoBet, you consent to
          the collection and use of your information as described in our Privacy Policy.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          We implement industry-standard security measures to protect your personal and financial
          information. However, no method of electronic transmission or storage is 100% secure, and
          we cannot guarantee absolute security. You are responsible for maintaining the
          confidentiality of your account credentials and for any activity that occurs under your
          account.
        </p>
      </section>

      {/* Section 12 */}
      <section id="disputes" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">12. Dispute Resolution</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          In the event of a dispute arising from or relating to these Terms or the Service, the
          parties agree to first attempt to resolve the dispute informally by contacting our customer
          support team. You must submit your complaint in writing within 30 days of the event giving
          rise to the dispute. We will endeavor to resolve complaints within 14 business days.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          If informal resolution is unsuccessful, any disputes shall be submitted to binding
          arbitration in accordance with the rules of the relevant arbitration authority. The
          arbitration shall be conducted in English, and the arbitrator&apos;s decision shall be final
          and binding. You agree to waive any right to a jury trial or to participate in a class
          action lawsuit or class-wide arbitration.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          These Terms shall be governed by and construed in accordance with the laws of the
          jurisdiction in which CryptoBet is licensed and regulated, without regard to conflict of
          law provisions. Any legal action or proceeding arising under these Terms shall be brought
          exclusively in the courts of the applicable jurisdiction.
        </p>
      </section>

      {/* Section 13 */}
      <section id="modifications" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">13. Modifications</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          CryptoBet reserves the right to modify, amend, or update these Terms at any time at our
          sole discretion. We will notify users of material changes by posting a notice on the
          platform and updating the &quot;Last updated&quot; date at the top of these Terms. For significant
          changes, we may also notify you via email or through an in-app notification.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Your continued use of the Service after any modifications constitutes your acceptance of
          the revised Terms. If you do not agree with the modified Terms, your sole remedy is to
          discontinue use of the Service and close your account. We encourage you to periodically
          review these Terms to stay informed about our current policies and practices.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          Modifications to bonus terms, promotional offers, or game rules may be made without prior
          notice, provided that existing obligations to users are honored. Any such modifications
          will take effect immediately upon posting to the platform unless otherwise specified.
        </p>
      </section>

      {/* Section 14 */}
      <section id="contact" className="card space-y-4">
        <h2 className="text-xl font-semibold text-brand-400">14. Contact</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          If you have any questions, concerns, or complaints regarding these Terms of Service or the
          CryptoBet platform, please do not hesitate to contact us through the following channels:
        </p>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <span className="text-gray-500">Email:</span>{' '}
            <span className="text-brand-400">support@cryptobet.com</span>
          </p>
          <p>
            <span className="text-gray-500">Live Chat:</span> Available 24/7 on our platform
          </p>
          <p>
            <span className="text-gray-500">Help Center:</span>{' '}
            <Link href="/help" className="text-brand-400 hover:text-brand-300 underline">
              Visit our Help Center
            </Link>
          </p>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">
          We aim to respond to all inquiries within 24 hours. For urgent matters related to account
          security or suspected unauthorized access, please contact us immediately via live chat for
          the fastest resolution.
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
