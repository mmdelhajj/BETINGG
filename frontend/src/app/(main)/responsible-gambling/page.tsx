'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  Clock,
  DollarSign,
  Ban,
  Heart,
  ChevronRight,
  Check,
  Info,
  ExternalLink,
  Phone,
  MessageCircle,
  HelpCircle,
  TrendingDown,
  Timer,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'assessment' | 'deposit-limits' | 'loss-limits' | 'session-limits' | 'self-exclusion' | 'resources';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'assessment', label: 'Self-Assessment', icon: HelpCircle },
  { key: 'deposit-limits', label: 'Deposit Limits', icon: DollarSign },
  { key: 'loss-limits', label: 'Loss Limits', icon: TrendingDown },
  { key: 'session-limits', label: 'Session Limits', icon: Timer },
  { key: 'self-exclusion', label: 'Self-Exclusion', icon: Ban },
  { key: 'resources', label: 'Resources', icon: Heart },
];

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Do you ever bet more money than you can afford to lose?',
    options: ['Never', 'Rarely', 'Sometimes', 'Often'],
  },
  {
    id: 2,
    question: 'Do you feel restless or irritable when trying to stop or reduce your betting?',
    options: ['Never', 'Rarely', 'Sometimes', 'Often'],
  },
  {
    id: 3,
    question: 'Have you ever borrowed money or sold anything to get money to bet?',
    options: ['Never', 'Rarely', 'Sometimes', 'Often'],
  },
  {
    id: 4,
    question: 'Do you spend more time betting than you planned?',
    options: ['Never', 'Rarely', 'Sometimes', 'Often'],
  },
  {
    id: 5,
    question: 'Have you tried to win back money you have lost (chasing losses)?',
    options: ['Never', 'Rarely', 'Sometimes', 'Often'],
  },
  {
    id: 6,
    question: 'Has your betting caused problems in your relationships?',
    options: ['Never', 'Rarely', 'Sometimes', 'Often'],
  },
];

const EXCLUSION_OPTIONS = [
  { key: '24h', label: '24 Hours', description: 'A short cooling-off period. Your account will be locked for 24 hours.' },
  { key: '7d', label: '7 Days', description: 'A week-long break. You will not be able to log in or place bets for 7 days.' },
  { key: '30d', label: '30 Days', description: 'A month-long exclusion. All active bets will remain but no new bets can be placed.' },
  { key: 'permanent', label: 'Permanent', description: 'Your account will be permanently closed. This action cannot be reversed.' },
];

const RESOURCES = [
  { name: 'Gamblers Anonymous', url: 'https://www.gamblersanonymous.org', description: 'A fellowship of people who share their experience and support one another.' },
  { name: 'National Problem Gambling Helpline', url: 'https://www.ncpgambling.org', description: '24/7 confidential helpline: 1-800-522-4700' },
  { name: 'BeGambleAware', url: 'https://www.begambleaware.org', description: 'Free, confidential help and advice about problem gambling.' },
  { name: 'GamCare', url: 'https://www.gamcare.org.uk', description: 'Support, information, and advice for anyone affected by gambling.' },
];

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ---------------------------------------------------------------------------
// Responsible Gambling Page
// ---------------------------------------------------------------------------

export default function ResponsibleGamblingPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('assessment');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [depositLimits, setDepositLimits] = useState({ daily: '', weekly: '', monthly: '' });
  const [lossLimits, setLossLimits] = useState({ daily: '', weekly: '', monthly: '' });
  const [sessionLimit, setSessionLimit] = useState('');
  const [selectedExclusion, setSelectedExclusion] = useState<string | null>(null);
  const [confirmExclusion, setConfirmExclusion] = useState('');

  const quizScore = Object.values(quizAnswers).reduce((sum, v) => sum + v, 0);
  const maxScore = QUIZ_QUESTIONS.length * 3;

  const getRiskLevel = (score: number) => {
    if (score <= 3) return { level: 'Low Risk', color: 'text-[#10B981]', bg: 'bg-[#10B981]', description: 'Your gambling habits appear to be within healthy limits. Continue to gamble responsibly.' };
    if (score <= 8) return { level: 'Moderate Risk', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]', description: 'Some of your gambling habits may need attention. Consider setting deposit and loss limits.' };
    return { level: 'High Risk', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]', description: 'Your responses indicate signs of problem gambling. We strongly recommend seeking support and setting strict limits.' };
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#E6EDF3]">Responsible Gambling</h1>
            <p className="text-sm text-[#8B949E]">Tools and resources to help you stay in control.</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5" />
          <p className="text-sm text-[#8B949E]">
            Gambling should be fun, not a source of stress. If you feel that gambling is becoming a problem,
            please use the tools below or reach out to one of the support organizations listed in our resources section.
          </p>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
                isActive
                  ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20'
                  : 'bg-[#161B22] text-[#8B949E] border border-[#30363D] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3]',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Self-Assessment Quiz */}
        {activeTab === 'assessment' && (
          <div className="space-y-6">
            <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6">
              <h2 className="text-lg font-bold text-[#E6EDF3] mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#8B5CF6]" />
                Self-Assessment Quiz
              </h2>
              <p className="text-sm text-[#8B949E] mb-6">
                Answer the following questions honestly to help assess your gambling habits. This is completely private.
              </p>

              {!quizSubmitted ? (
                <>
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                    {QUIZ_QUESTIONS.map((q) => (
                      <motion.div key={q.id} variants={itemVariants} className="space-y-3">
                        <p className="text-sm font-medium text-[#E6EDF3]">
                          {q.id}. {q.question}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((option, idx) => (
                            <button
                              key={option}
                              onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                              className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border',
                                quizAnswers[q.id] === idx
                                  ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                                  : 'bg-[#0D1117] text-[#8B949E] border-[#30363D] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3]',
                              )}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>

                  <button
                    onClick={() => setQuizSubmitted(true)}
                    disabled={Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length}
                    className="mt-6 h-11 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-button font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Submit Assessment
                  </button>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  {(() => {
                    const risk = getRiskLevel(quizScore);
                    return (
                      <>
                        <div className={cn('text-5xl font-bold mb-2', risk.color)}>
                          {quizScore}/{maxScore}
                        </div>
                        <div className={cn('text-lg font-bold mb-2', risk.color)}>{risk.level}</div>
                        <p className="text-[#8B949E] max-w-md mx-auto mb-6">{risk.description}</p>
                        <div className="w-full max-w-xs mx-auto h-3 bg-[#0D1117] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(quizScore / maxScore) * 100}%` }}
                            transition={{ duration: 0.8 }}
                            className={cn('h-full rounded-full', risk.bg)}
                          />
                        </div>
                        <button
                          onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); }}
                          className="mt-6 text-sm text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
                        >
                          Retake Assessment
                        </button>
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Deposit Limits */}
        {activeTab === 'deposit-limits' && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6">
            <h2 className="text-lg font-bold text-[#E6EDF3] mb-2 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#8B5CF6]" />
              Deposit Limits
            </h2>
            <p className="text-sm text-[#8B949E] mb-6">
              Set maximum deposit amounts for different time periods. Decreasing a limit takes effect immediately.
              Increasing a limit requires a 24-hour cooling-off period.
            </p>

            <div className="space-y-4 max-w-md">
              {[
                { key: 'daily', label: 'Daily Limit' },
                { key: 'weekly', label: 'Weekly Limit' },
                { key: 'monthly', label: 'Monthly Limit' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-[#E6EDF3] mb-1.5">{field.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B949E] text-sm">$</span>
                    <input
                      type="number"
                      placeholder="No limit set"
                      value={depositLimits[field.key as keyof typeof depositLimits]}
                      onChange={(e) => setDepositLimits((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full h-10 bg-[#0D1117] border border-[#30363D] rounded-lg pl-8 pr-4 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6] transition-all"
                    />
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-[#30363D]">
                <button className="h-11 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-button font-semibold text-sm transition-all hover:shadow-lg hover:shadow-[#8B5CF6]/20">
                  Save Deposit Limits
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loss Limits */}
        {activeTab === 'loss-limits' && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6">
            <h2 className="text-lg font-bold text-[#E6EDF3] mb-2 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-[#EF4444]" />
              Loss Limits
            </h2>
            <p className="text-sm text-[#8B949E] mb-6">
              Set maximum loss amounts. When your losses reach the limit, you will not be able to place new bets until the limit period resets.
            </p>

            <div className="space-y-4 max-w-md">
              {[
                { key: 'daily', label: 'Daily Loss Limit' },
                { key: 'weekly', label: 'Weekly Loss Limit' },
                { key: 'monthly', label: 'Monthly Loss Limit' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-[#E6EDF3] mb-1.5">{field.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B949E] text-sm">$</span>
                    <input
                      type="number"
                      placeholder="No limit set"
                      value={lossLimits[field.key as keyof typeof lossLimits]}
                      onChange={(e) => setLossLimits((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full h-10 bg-[#0D1117] border border-[#30363D] rounded-lg pl-8 pr-4 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6] transition-all"
                    />
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-[#30363D]">
                <button className="h-11 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-button font-semibold text-sm transition-all hover:shadow-lg hover:shadow-[#8B5CF6]/20">
                  Save Loss Limits
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Session Time Limits */}
        {activeTab === 'session-limits' && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6">
            <h2 className="text-lg font-bold text-[#E6EDF3] mb-2 flex items-center gap-2">
              <Timer className="w-5 h-5 text-[#F59E0B]" />
              Session Time Limits
            </h2>
            <p className="text-sm text-[#8B949E] mb-6">
              Set a maximum session duration. You will receive a notification when the time is reached and be automatically logged out.
            </p>

            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#E6EDF3] mb-3">Session Duration</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['30m', '1h', '2h', '4h', '6h', '8h', '12h', 'None'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setSessionLimit(option)}
                      className={cn(
                        'h-10 rounded-lg text-sm font-medium transition-all duration-200 border',
                        sessionLimit === option
                          ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                          : 'bg-[#0D1117] text-[#8B949E] border-[#30363D] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3]',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                  <div className="text-sm text-[#8B949E]">
                    <p className="font-medium text-[#E6EDF3] mb-1">Reality Check</p>
                    <p>When enabled, you will also receive periodic reminders showing your session duration and profit/loss during the current session.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#30363D]">
                <button className="h-11 px-6 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-button font-semibold text-sm transition-all hover:shadow-lg hover:shadow-[#8B5CF6]/20">
                  Save Session Limit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Self-Exclusion */}
        {activeTab === 'self-exclusion' && (
          <div className="space-y-4">
            <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-card p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="text-sm text-[#8B949E]">
                <p className="font-medium text-[#EF4444] mb-1">Warning: Self-Exclusion is Serious</p>
                <p>Self-exclusion will lock your account for the selected duration. During this period, you will not be able to log in, place bets, or access your account. Existing withdrawal requests will still be processed.</p>
              </div>
            </div>

            <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6">
              <h2 className="text-lg font-bold text-[#E6EDF3] mb-6 flex items-center gap-2">
                <Ban className="w-5 h-5 text-[#EF4444]" />
                Self-Exclusion Options
              </h2>

              <div className="space-y-3 max-w-lg">
                {EXCLUSION_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setSelectedExclusion(option.key)}
                    className={cn(
                      'w-full text-left p-4 rounded-lg border transition-all duration-200',
                      selectedExclusion === option.key
                        ? 'border-[#EF4444]/40 bg-[#EF4444]/5'
                        : 'border-[#30363D] bg-[#0D1117] hover:border-[#30363D]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#E6EDF3] text-sm">{option.label}</p>
                        <p className="text-xs text-[#8B949E] mt-1">{option.description}</p>
                      </div>
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3',
                        selectedExclusion === option.key
                          ? 'border-[#EF4444] bg-[#EF4444]'
                          : 'border-[#30363D]',
                      )}>
                        {selectedExclusion === option.key && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selectedExclusion && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 pt-6 border-t border-[#30363D] max-w-lg"
                >
                  <p className="text-sm text-[#8B949E] mb-3">
                    To confirm self-exclusion, type <span className="font-mono text-[#EF4444]">EXCLUDE ME</span> below:
                  </p>
                  <input
                    type="text"
                    placeholder="Type EXCLUDE ME"
                    value={confirmExclusion}
                    onChange={(e) => setConfirmExclusion(e.target.value)}
                    className="w-full h-10 bg-[#0D1117] border border-[#30363D] rounded-lg px-4 text-sm text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/50 focus:border-[#EF4444] transition-all mb-4"
                  />
                  <button
                    disabled={confirmExclusion !== 'EXCLUDE ME'}
                    className="h-11 px-6 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-button font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Confirm Self-Exclusion
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Resources */}
        {activeTab === 'resources' && (
          <div className="space-y-6">
            <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6">
              <h2 className="text-lg font-bold text-[#E6EDF3] mb-2 flex items-center gap-2">
                <Heart className="w-5 h-5 text-[#EF4444]" />
                Helpful Resources
              </h2>
              <p className="text-sm text-[#8B949E] mb-6">
                If you or someone you know is struggling with problem gambling, these organizations can help.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RESOURCES.map((resource) => (
                  <a
                    key={resource.name}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#0D1117] border border-[#30363D] rounded-lg p-4 hover:border-[#8B5CF6]/30 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-[#E6EDF3] text-sm group-hover:text-[#A78BFA] transition-colors">
                        {resource.name}
                      </h3>
                      <ExternalLink className="w-4 h-4 text-[#8B949E] shrink-0" />
                    </div>
                    <p className="text-xs text-[#8B949E]">{resource.description}</p>
                  </a>
                ))}
              </div>
            </div>

            {/* Contact Support */}
            <div className="bg-gradient-to-r from-[#10B981]/10 to-[#059669]/10 border border-[#10B981]/20 rounded-card p-6 text-center">
              <h3 className="text-lg font-bold text-[#E6EDF3] mb-2">Need someone to talk to?</h3>
              <p className="text-sm text-[#8B949E] mb-4 max-w-md mx-auto">
                Our support team is trained to help with gambling-related concerns. All conversations are confidential.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button className="inline-flex items-center gap-2 h-10 px-5 bg-[#10B981] hover:bg-[#059669] text-white rounded-button font-medium text-sm transition-all">
                  <MessageCircle className="w-4 h-4" />
                  Live Chat
                </button>
                <button className="inline-flex items-center gap-2 h-10 px-5 bg-[#161B22] text-[#E6EDF3] border border-[#30363D] hover:border-[#10B981]/50 rounded-button font-medium text-sm transition-all">
                  <Phone className="w-4 h-4" />
                  Call Support
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
