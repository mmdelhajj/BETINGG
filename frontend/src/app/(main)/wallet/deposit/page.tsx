'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Copy,
  Check,
  CreditCard,
  QrCode,
  Clock,
  ArrowDownLeft,
  ChevronLeft,
} from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Currency {
  symbol: string;
  name: string;
  networks: string[];
}

interface RecentDeposit {
  id: string;
  currency: string;
  amount: number;
  status: 'pending' | 'confirmed';
  confirmations: number;
  requiredConfirmations: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const CURRENCIES: Currency[] = [
  { symbol: 'BTC', name: 'Bitcoin', networks: ['Bitcoin', 'Lightning'] },
  { symbol: 'ETH', name: 'Ethereum', networks: ['Ethereum (ERC-20)', 'Arbitrum', 'Optimism'] },
  { symbol: 'USDT', name: 'Tether', networks: ['Ethereum (ERC-20)', 'Tron (TRC-20)', 'BNB Chain (BEP-20)'] },
  { symbol: 'USDC', name: 'USD Coin', networks: ['Ethereum (ERC-20)', 'Solana', 'Polygon'] },
  { symbol: 'SOL', name: 'Solana', networks: ['Solana'] },
  { symbol: 'DOGE', name: 'Dogecoin', networks: ['Dogecoin'] },
  { symbol: 'LTC', name: 'Litecoin', networks: ['Litecoin'] },
  { symbol: 'BNB', name: 'BNB', networks: ['BNB Chain (BEP-20)'] },
  { symbol: 'XRP', name: 'Ripple', networks: ['XRP Ledger'] },
  { symbol: 'TRX', name: 'TRON', networks: ['Tron (TRC-20)'] },
  { symbol: 'ADA', name: 'Cardano', networks: ['Cardano'] },
  { symbol: 'MATIC', name: 'Polygon', networks: ['Polygon', 'Ethereum (ERC-20)'] },
];

const MOCK_RECENT: RecentDeposit[] = [
  { id: 'd1', currency: 'BTC', amount: 0.01, status: 'confirmed', confirmations: 3, requiredConfirmations: 3, timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'd2', currency: 'ETH', amount: 0.5, status: 'pending', confirmations: 8, requiredConfirmations: 12, timestamp: new Date(Date.now() - 600000).toISOString() },
];

// ---------------------------------------------------------------------------
// Deposit Page
// ---------------------------------------------------------------------------

export default function DepositPage() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const depositAddress = selectedNetwork
    ? '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18'
    : '';

  const handleCopy = async () => {
    const success = await copyToClipboard(depositAddress);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#E6EDF3]">Deposit</h1>
          <p className="text-xs text-[#8B949E]">Send crypto to your CryptoBet wallet</p>
        </div>
      </div>

      {/* Currency Selection */}
      {!selectedCurrency ? (
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
          <h2 className="text-sm font-semibold text-[#E6EDF3] mb-3">Select Currency</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {CURRENCIES.map((cur) => (
              <button
                key={cur.symbol}
                onClick={() => {
                  setSelectedCurrency(cur);
                  if (cur.networks.length === 1) setSelectedNetwork(cur.networks[0]);
                }}
                className="bg-[#1C2128] border border-[#30363D] rounded-card p-3 hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/5 transition-all duration-200 flex flex-col items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-[#0D1117] flex items-center justify-center text-xs font-bold text-[#8B5CF6]">
                  {cur.symbol.slice(0, 2)}
                </div>
                <span className="text-xs font-medium text-[#E6EDF3]">{cur.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      ) : !selectedNetwork ? (
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#E6EDF3]">Select Network</h2>
            <button
              onClick={() => { setSelectedCurrency(null); setSelectedNetwork(null); }}
              className="text-xs text-[#8B5CF6] hover:text-[#A78BFA]"
            >
              Change Currency
            </button>
          </div>
          <div className="space-y-2">
            {selectedCurrency.networks.map((network) => (
              <button
                key={network}
                onClick={() => setSelectedNetwork(network)}
                className="w-full p-3 bg-[#1C2128] border border-[#30363D] rounded-card text-left hover:border-[#8B5CF6]/30 transition-colors flex items-center justify-between"
              >
                <span className="text-sm text-[#E6EDF3]">{network}</span>
                <ChevronRight className="w-4 h-4 text-[#8B949E]" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-xs font-bold text-[#8B5CF6]">
                  {selectedCurrency.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#E6EDF3]">{selectedCurrency.name}</p>
                  <p className="text-[10px] text-[#8B949E]">{selectedNetwork}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedCurrency(null); setSelectedNetwork(null); }}
                className="text-xs text-[#8B5CF6] hover:text-[#A78BFA]"
              >
                Change
              </button>
            </div>

            {/* QR Code Placeholder */}
            <div className="flex items-center justify-center py-6">
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center">
                <QrCode className="w-32 h-32 text-[#0D1117]" />
              </div>
            </div>

            {/* Address */}
            <div className="mt-4">
              <label className="text-xs text-[#8B949E] mb-1.5 block">Deposit Address</label>
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-[#0D1117] border border-[#30363D] rounded-button px-3 flex items-center text-xs font-mono text-[#E6EDF3] overflow-hidden">
                  <span className="truncate">{depositAddress}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={cn(
                    'h-10 px-4 rounded-button font-medium text-sm transition-all duration-200 flex items-center gap-2',
                    copied
                      ? 'bg-[#10B981] text-white'
                      : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white'
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-card">
              <p className="text-xs text-[#F59E0B]">
                Only send {selectedCurrency.symbol} to this address via the {selectedNetwork} network.
                Sending other assets may result in permanent loss.
              </p>
            </div>
          </div>

          <button className="w-full h-12 bg-[#161B22] border border-[#30363D] hover:border-[#8B5CF6]/30 rounded-card flex items-center justify-center gap-2 text-sm font-semibold text-[#E6EDF3] transition-colors">
            <CreditCard className="w-5 h-5 text-[#8B5CF6]" />
            Buy {selectedCurrency.symbol} with Card
          </button>
        </div>
      )}

      {/* Recent Deposits */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card overflow-hidden">
        <div className="p-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#8B949E]" />
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Recent Deposits</h3>
        </div>
        <div className="border-t border-[#30363D] divide-y divide-[#30363D]/50">
          {MOCK_RECENT.map((dep) => (
            <div key={dep.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <ArrowDownLeft className="w-4 h-4 text-[#10B981]" />
                <div>
                  <p className="text-sm font-mono text-[#E6EDF3]">{dep.amount} {dep.currency}</p>
                  <p className="text-[10px] text-[#8B949E]">
                    {dep.confirmations}/{dep.requiredConfirmations} confirmations
                  </p>
                </div>
              </div>
              <span className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium',
                dep.status === 'confirmed' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
              )}>
                {dep.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
