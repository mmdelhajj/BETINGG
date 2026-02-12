'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ToolCard {
  title: string;
  description: string;
  iconPath: string;
  linkLabel: string;
  linkHref: string;
}

interface SupportResource {
  name: string;
  url: string;
  description: string;
}

const WARNING_SIGNS: string[] = [
  'Spending more money on gambling than you can afford to lose',
  'Borrowing money or selling possessions to fund gambling',
  'Chasing losses by increasing bets to try to win back what you have lost',
  'Feeling anxious, stressed, or irritable when trying to cut down on gambling',
  'Neglecting work, family, or personal responsibilities due to gambling',
  'Lying to friends or family about the extent of your gambling',
  'Gambling as a way to escape problems or relieve feelings of helplessness',
  'Needing to bet with increasing amounts of money to achieve the same level of excitement',
  'Repeated unsuccessful attempts to control, cut back, or stop gambling',
  'Feeling restless or irritable when not gambling',
];

const LIMIT_TOOLS: ToolCard[] = [
  {
    title: 'Deposit Limits',
    description: 'Set daily, weekly, or monthly caps on how much you can deposit into your account. Limits take effect immediately when decreased.',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
    linkLabel: 'Set Deposit Limits',
    linkHref: '/account?tab=limits',
  },
  {
    title: 'Loss Limits',
    description: 'Control the maximum amount you can lose over a set period. Once the limit is reached, you will not be able to place further bets.',
    iconPath: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm3.3 14.71L11 12.41V7h2v4.59l3.71 3.71-1.42 1.41z',
    linkLabel: 'Set Loss Limits',
    linkHref: '/account?tab=limits',
  },
  {
    title: 'Wager Limits',
    description: 'Restrict the total amount you can wager within a specified timeframe, helping you manage your betting activity.',
    iconPath: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z',
    linkLabel: 'Set Wager Limits',
    linkHref: '/account?tab=limits',
  },
  {
    title: 'Session Time Limits',
    description: 'Set a maximum duration for your gambling sessions. You will receive a notification when your time limit is approaching.',
    iconPath: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z',
    linkLabel: 'Set Time Limits',
    linkHref: '/account?tab=limits',
  },
  {
    title: 'Self-Exclusion',
    description: 'Temporarily or permanently exclude yourself from accessing your account and placing bets. Cooling-off periods range from 24 hours to permanent.',
    iconPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z',
    linkLabel: 'Self-Exclude',
    linkHref: '/account?tab=limits',
  },
  {
    title: 'Reality Checks',
    description: 'Receive periodic notifications during your gambling sessions showing how long you have been playing and your session summary.',
    iconPath: 'M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z',
    linkLabel: 'Set Up Reality Checks',
    linkHref: '/account?tab=limits',
  },
];

const SUPPORT_RESOURCES: SupportResource[] = [
  {
    name: 'GamCare',
    url: 'https://www.gamcare.org.uk',
    description: 'GamCare provides information, advice, and support for anyone affected by gambling problems. Free helpline and live chat available.',
  },
  {
    name: 'Gamblers Anonymous',
    url: 'https://www.gamblersanonymous.org',
    description: 'A fellowship of men and women who share their experience, strength, and hope with each other to solve their common problem of compulsive gambling.',
  },
  {
    name: 'BeGambleAware',
    url: 'https://www.begambleaware.org',
    description: 'Provides free, confidential help and support to anyone who is worried about their or someone else\'s gambling. Offers treatment referrals.',
  },
  {
    name: 'National Problem Gambling Helpline',
    url: 'https://www.ncpgambling.org',
    description: 'Call 1-800-522-4700 for confidential support 24/7. Text and chat services also available for those who prefer written communication.',
  },
];

export default function ResponsibleGamblingPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-surface-secondary to-surface-tertiary border border-border p-8 md:p-12">
        <div className="relative z-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Responsible Gambling</h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            At CryptoBet, we are committed to providing a safe and responsible gambling environment.
            We believe gambling should always remain an enjoyable form of entertainment.
          </p>
        </div>
      </div>

      {/* Our Commitment */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Our Commitment</h2>
        <div className="card">
          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              CryptoBet takes responsible gambling seriously. We understand that while the vast majority
              of our players enjoy gambling as a form of entertainment, for some it can become a problem.
              We are dedicated to helping those players and to promoting responsible gambling practices.
            </p>
            <p>
              We provide a range of tools and features designed to help you stay in control of your
              gambling activity. We also work closely with leading responsible gambling organizations
              to ensure that our approach meets the highest standards of player protection.
            </p>
            <p>
              Our staff are trained to identify and respond to signs of problem gambling, and we are
              always here to help if you need support. We encourage all players to use the tools we
              provide and to reach out if they have any concerns about their gambling behavior.
            </p>
          </div>
        </div>
      </section>

      {/* Self-Assessment */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Self-Assessment</h2>
        <div className="card">
          <p className="text-sm text-gray-300 mb-4">
            Gambling should be fun and entertaining. If you recognize any of the following warning signs
            in your own behavior, it may be time to take a step back and consider seeking help.
          </p>
          <div className="space-y-3">
            {WARNING_SIGNS.map((sign, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-lg"
              >
                <div className="flex-shrink-0 w-6 h-6 bg-accent-red/20 rounded-full flex items-center justify-center mt-0.5">
                  <svg
                    className="w-3.5 h-3.5 text-accent-red"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-300">{sign}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-4">
            If you identify with two or more of these warning signs, we strongly encourage you to
            use our responsible gambling tools or contact a support organization listed below.
          </p>
        </div>
      </section>

      {/* Tools & Features */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Tools & Features</h2>
        <p className="text-sm text-gray-400 mb-4">
          We provide several tools to help you manage your gambling activity. All tools can be
          configured in your account settings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LIMIT_TOOLS.map((tool) => (
            <div
              key={tool.title}
              className="card hover:border-brand-500/40 transition-colors group"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <svg
                  className="w-6 h-6 text-brand-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d={tool.iconPath} />
                </svg>
              </div>

              <h3 className="text-lg font-bold mb-2">{tool.title}</h3>
              <p className="text-sm text-gray-400 mb-4">{tool.description}</p>

              <Link
                href={tool.linkHref}
                className={cn(
                  'text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors',
                  'inline-flex items-center gap-1'
                )}
              >
                {tool.linkLabel}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Support Resources */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Support Resources</h2>
        <p className="text-sm text-gray-400 mb-4">
          If you or someone you know is struggling with problem gambling, the following organizations
          offer free, confidential support and guidance.
        </p>
        <div className="space-y-4">
          {SUPPORT_RESOURCES.map((resource) => (
            <div
              key={resource.name}
              className="card hover:border-brand-500/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1">{resource.name}</h3>
                  <p className="text-sm text-gray-400 mb-2">{resource.description}</p>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors inline-flex items-center gap-1"
                  >
                    {resource.url.replace('https://www.', '')}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm text-center whitespace-nowrap"
                >
                  Visit Site
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Underage Gambling */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Underage Gambling Prevention</h2>
        <div className="card">
          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              CryptoBet strictly prohibits anyone under the age of 18 (or the legal gambling age in
              their jurisdiction) from creating an account or placing bets. We take the following
              measures to prevent underage gambling:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">--</span>
                Identity verification (KYC) is required for all accounts
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">--</span>
                Age verification checks during the registration process
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">--</span>
                Accounts found to be operated by minors are immediately suspended
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">--</span>
                We recommend parental control software to prevent minors from accessing gambling sites
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact Us */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
        <div className="card bg-gradient-to-br from-surface-secondary to-surface-tertiary">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-brand-500/10 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-brand-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">Need Help?</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
              If you are concerned about your gambling behavior or need assistance with any of our
              responsible gambling tools, our support team is here to help 24/7.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/help" className="btn-primary text-sm">
                Visit Help Center
              </Link>
              <a href="mailto:support@cryptobet.com" className="btn-secondary text-sm text-center">
                Email Support
              </a>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Email: support@cryptobet.com | Live Chat available 24/7
            </p>
          </div>
        </div>
      </section>

      {/* Footer Notice */}
      <div className="text-center text-xs text-gray-600 border-t border-border pt-6">
        <p>
          Gambling can be addictive. Play responsibly. If you need help, please contact one of the
          support organizations listed above or reach out to our support team.
        </p>
      </div>
    </div>
  );
}
