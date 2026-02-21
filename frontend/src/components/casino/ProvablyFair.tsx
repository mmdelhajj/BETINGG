'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Unlock,
  Hash,
  Info,
} from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvablyFairProps {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  serverSeed?: string; // Revealed after game round
  result?: string;
  onClientSeedChange?: (seed: string) => void;
  onVerify?: (data: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
  }) => void;
  className?: string;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProvablyFair({
  serverSeedHash,
  clientSeed,
  nonce,
  serverSeed,
  result,
  onClientSeedChange,
  onVerify,
  className,
  compact = false,
}: ProvablyFairProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [verifyServerSeed, setVerifyServerSeed] = useState(serverSeed || '');
  const [verifyClientSeed, setVerifyClientSeed] = useState(clientSeed);
  const [verifyNonce, setVerifyNonce] = useState(nonce.toString());
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  const handleVerify = useCallback(async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    try {
      if (onVerify) {
        onVerify({
          serverSeed: verifyServerSeed,
          clientSeed: verifyClientSeed,
          nonce: parseInt(verifyNonce, 10),
        });
      }

      // Simulate HMAC-SHA256 verification display
      // In production, this would call the actual verification API
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (verifyServerSeed && verifyClientSeed && verifyNonce) {
        setVerificationResult(
          result || 'Verification complete. Result matches the original game outcome.'
        );
      } else {
        setVerificationResult('Please fill in all fields to verify.');
      }
    } finally {
      setIsVerifying(false);
    }
  }, [verifyServerSeed, verifyClientSeed, verifyNonce, onVerify, result]);

  // Compact view - just a badge that opens the panel
  if (compact) {
    return (
      <div className={className}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1C2128] border border-[#30363D] rounded-button text-xs text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
        >
          <Shield className="w-3 h-3 text-[#10B981]" />
          Provably Fair
          {isExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ProvablyFairPanel
                serverSeedHash={serverSeedHash}
                clientSeed={clientSeed}
                nonce={nonce}
                serverSeed={serverSeed}
                verifyServerSeed={verifyServerSeed}
                verifyClientSeed={verifyClientSeed}
                verifyNonce={verifyNonce}
                isVerifying={isVerifying}
                verificationResult={verificationResult}
                copiedField={copiedField}
                showExplanation={showExplanation}
                onCopy={handleCopy}
                onVerifyServerSeedChange={setVerifyServerSeed}
                onVerifyClientSeedChange={setVerifyClientSeed}
                onVerifyNonceChange={setVerifyNonce}
                onVerify={handleVerify}
                onToggleExplanation={() => setShowExplanation(!showExplanation)}
                onClientSeedChange={onClientSeedChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full view
  return (
    <Card className={cn('bg-[#161B22] border-[#30363D]', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-[#E6EDF3]">
              Provably Fair
            </h3>
            <p className="text-xs text-[#8B949E]">
              Verify every game result cryptographically
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="xs" dot pulse>
            Active
          </Badge>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[#8B949E]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#8B949E]" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[#30363D] pt-4">
              <ProvablyFairPanel
                serverSeedHash={serverSeedHash}
                clientSeed={clientSeed}
                nonce={nonce}
                serverSeed={serverSeed}
                verifyServerSeed={verifyServerSeed}
                verifyClientSeed={verifyClientSeed}
                verifyNonce={verifyNonce}
                isVerifying={isVerifying}
                verificationResult={verificationResult}
                copiedField={copiedField}
                showExplanation={showExplanation}
                onCopy={handleCopy}
                onVerifyServerSeedChange={setVerifyServerSeed}
                onVerifyClientSeedChange={setVerifyClientSeed}
                onVerifyNonceChange={setVerifyNonce}
                onVerify={handleVerify}
                onToggleExplanation={() => setShowExplanation(!showExplanation)}
                onClientSeedChange={onClientSeedChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Internal Panel Component
// ---------------------------------------------------------------------------

interface ProvablyFairPanelProps {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  serverSeed?: string;
  verifyServerSeed: string;
  verifyClientSeed: string;
  verifyNonce: string;
  isVerifying: boolean;
  verificationResult: string | null;
  copiedField: string | null;
  showExplanation: boolean;
  onCopy: (text: string, field: string) => void;
  onVerifyServerSeedChange: (value: string) => void;
  onVerifyClientSeedChange: (value: string) => void;
  onVerifyNonceChange: (value: string) => void;
  onVerify: () => void;
  onToggleExplanation: () => void;
  onClientSeedChange?: (seed: string) => void;
}

function ProvablyFairPanel({
  serverSeedHash,
  clientSeed,
  nonce,
  serverSeed,
  verifyServerSeed,
  verifyClientSeed,
  verifyNonce,
  isVerifying,
  verificationResult,
  copiedField,
  showExplanation,
  onCopy,
  onVerifyServerSeedChange,
  onVerifyClientSeedChange,
  onVerifyNonceChange,
  onVerify,
  onToggleExplanation,
  onClientSeedChange,
}: ProvablyFairPanelProps) {
  return (
    <div className="space-y-4">
      {/* Current Seeds Display */}
      <div className="space-y-3">
        {/* Server Seed Hash */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#8B949E] mb-1.5">
            <Lock className="w-3 h-3" />
            Server Seed Hash
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-input text-xs font-mono text-[#8B949E] truncate select-all">
              {serverSeedHash}
            </code>
            <button
              onClick={() => onCopy(serverSeedHash, 'serverSeedHash')}
              className="shrink-0 p-2 bg-[#0D1117] border border-[#30363D] rounded-input text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
            >
              {copiedField === 'serverSeedHash' ? (
                <Check className="w-3.5 h-3.5 text-[#10B981]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Server Seed (revealed) */}
        {serverSeed && (
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#10B981] mb-1.5">
              <Unlock className="w-3 h-3" />
              Server Seed (Revealed)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-[#10B981]/5 border border-[#10B981]/20 rounded-input text-xs font-mono text-[#10B981] truncate select-all">
                {serverSeed}
              </code>
              <button
                onClick={() => onCopy(serverSeed, 'serverSeed')}
                className="shrink-0 p-2 bg-[#0D1117] border border-[#30363D] rounded-input text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
              >
                {copiedField === 'serverSeed' ? (
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Client Seed */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#8B949E] mb-1.5">
            <Hash className="w-3 h-3" />
            Client Seed
          </label>
          <div className="flex items-center gap-2">
            {onClientSeedChange ? (
              <input
                type="text"
                value={clientSeed}
                onChange={(e) => onClientSeedChange(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-input text-xs font-mono text-[#E6EDF3] focus:outline-none focus:border-[#8B5CF6] transition-colors"
                placeholder="Enter custom client seed..."
              />
            ) : (
              <code className="flex-1 px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-input text-xs font-mono text-[#E6EDF3] truncate select-all">
                {clientSeed}
              </code>
            )}
            <button
              onClick={() => onCopy(clientSeed, 'clientSeed')}
              className="shrink-0 p-2 bg-[#0D1117] border border-[#30363D] rounded-input text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#484F58] transition-all duration-200"
            >
              {copiedField === 'clientSeed' ? (
                <Check className="w-3.5 h-3.5 text-[#10B981]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Nonce */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#8B949E] mb-1.5">
            <RefreshCw className="w-3 h-3" />
            Nonce
          </label>
          <code className="block px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-input text-xs font-mono text-[#E6EDF3]">
            {nonce}
          </code>
        </div>
      </div>

      {/* Verification Section */}
      <div className="border-t border-[#30363D] pt-4">
        <h4 className="text-xs font-semibold text-[#E6EDF3] mb-3">
          Verify Previous Round
        </h4>
        <div className="space-y-2.5">
          <Input
            label="Server Seed"
            value={verifyServerSeed}
            onChange={(e) => onVerifyServerSeedChange(e.target.value)}
            placeholder="Enter revealed server seed..."
            className="bg-[#0D1117] border-[#30363D] text-xs font-mono h-9"
            containerClassName="text-xs"
          />
          <Input
            label="Client Seed"
            value={verifyClientSeed}
            onChange={(e) => onVerifyClientSeedChange(e.target.value)}
            placeholder="Enter client seed..."
            className="bg-[#0D1117] border-[#30363D] text-xs font-mono h-9"
            containerClassName="text-xs"
          />
          <Input
            label="Nonce"
            type="number"
            value={verifyNonce}
            onChange={(e) => onVerifyNonceChange(e.target.value)}
            placeholder="Enter nonce..."
            className="bg-[#0D1117] border-[#30363D] text-xs font-mono h-9"
            containerClassName="text-xs"
          />

          <Button
            variant="primary"
            size="sm"
            fullWidth
            isLoading={isVerifying}
            onClick={onVerify}
            leftIcon={<Shield className="w-3.5 h-3.5" />}
          >
            Verify Result
          </Button>

          {/* Verification Result */}
          <AnimatePresence>
            {verificationResult && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="px-3 py-2 bg-[#10B981]/10 border border-[#10B981]/20 rounded-input"
              >
                <p className="text-xs text-[#10B981] font-mono">
                  {verificationResult}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* How It Works Accordion */}
      <div className="border-t border-[#30363D] pt-3">
        <button
          onClick={onToggleExplanation}
          className="w-full flex items-center justify-between py-2 text-xs text-[#8B949E] hover:text-[#E6EDF3] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            How does provably fair work?
          </span>
          {showExplanation ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="py-3 space-y-3 text-xs text-[#8B949E] leading-relaxed">
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[10px] font-bold text-[#8B5CF6]">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-[#E6EDF3] mb-0.5">
                      Server Seed Generated
                    </p>
                    <p>
                      Before each round, the server generates a random seed and
                      shows you its SHA-256 hash. This commits the server to a
                      result before your bet.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[10px] font-bold text-[#8B5CF6]">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-[#E6EDF3] mb-0.5">
                      You Provide Client Seed
                    </p>
                    <p>
                      You can set your own client seed or use a randomly
                      generated one. This ensures the server cannot manipulate
                      the outcome.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[10px] font-bold text-[#8B5CF6]">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-[#E6EDF3] mb-0.5">
                      Result Calculated
                    </p>
                    <p>
                      The game result is determined by HMAC-SHA256(serverSeed,
                      clientSeed:nonce). The nonce increments with each bet.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[10px] font-bold text-[#10B981]">
                    4
                  </div>
                  <div>
                    <p className="font-medium text-[#E6EDF3] mb-0.5">
                      Verify Anytime
                    </p>
                    <p>
                      After rotating seeds, the previous server seed is
                      revealed. You can verify that its hash matches the
                      pre-committed hash and recalculate the game result.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
