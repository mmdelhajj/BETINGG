'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Currency {
  symbol: string;
  name: string;
  networks: { name: string; fee: number; minWithdraw: number }[];
}

interface PendingWithdrawal {
  id: string;
  currency: string;
  amount: number;
  address: string;
  status: 'pending' | 'processing' | 'completed';
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const CURRENCIES: Currency[] = [
  { symbol: 'BTC', name: 'Bitcoin', networks: [{ name: 'Bitcoin', fee: 0.0001, minWithdraw: 0.001 }, { name: 'Lightning', fee: 0.000001, minWithdraw: 0.0001 }] },
  { symbol: 'ETH', name: 'Ethereum', networks: [{ name: 'Ethereum (ERC-20)', fee: 0.002, minWithdraw: 0.01 }, { name: 'Arbitrum', fee: 0.0005, minWithdraw: 0.005 }] },
  { symbol: 'USDT', name: 'Tether', networks: [{ name: 'Ethereum (ERC-20)', fee: 10, minWithdraw: 20 }, { name: 'Tron (TRC-20)', fee: 1, minWithdraw: 5 }] },
  { symbol: 'SOL', name: 'Solana', networks: [{ name: 'Solana', fee: 0.01, minWithdraw: 0.1 }] },
  { symbol: 'DOGE', name: 'Dogecoin', networks: [{ name: 'Dogecoin', fee: 2, minWithdraw: 20 }] },
  { symbol: 'LTC', name: 'Litecoin', networks: [{ name: 'Litecoin', fee: 0.001, minWithdraw: 0.01 }] },
];

const MOCK_PENDING: PendingWithdrawal[] = [
  { id: 'w1', currency: 'ETH', amount: 0.5, address: '0x742d...bD18', status: 'processing', timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: 'w2', currency: 'BTC', amount: 0.02, address: 'bc1q...xj4k', status: 'pending', timestamp: new Date(Date.now() - 3600000).toISOString() },
];

// ---------------------------------------------------------------------------
// Withdraw Page
// ---------------------------------------------------------------------------

export default function WithdrawPage() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [selectedNetworkIdx, setSelectedNetworkIdx] = useState<number>(0);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const network = selectedCurrency?.networks[selectedNetworkIdx];
  const fee = network?.fee ?? 0;
  const numAmount = parseFloat(amount) || 0;
  const receiveAmount = Math.max(0, numAmount - fee);

  const mockBalance = selectedCurrency
    ? { BTC: 0.05234, ETH: 1.5234, USDT: 500, SOL: 12.5, DOGE: 5000, LTC: 3.2 }[selectedCurrency.symbol] || 0
    : 0;

  const handleMax = () => {
    setAmount(mockBalance.toString());
  };

  const handleWithdraw = async () => {
    if (!selectedCurrency || !address || numAmount <= 0 || !network) return;
    setIsSubmitting(true);
    try {
      await post('/wallets/withdraw', {
        currency: selectedCurrency.symbol,
        amount: amount, // Backend expects string, not number
        toAddress: address,
        networkId: network.name,
      });
    } catch {
      // Silently handle for demo
    } finally {
      setIsSubmitting(false);
      setAddress('');
      setAmount('');
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
          <h1 className="text-xl font-bold text-[#E6EDF3]">Withdraw</h1>
          <p className="text-xs text-[#8B949E]">Send crypto to an external wallet</p>
        </div>
      </div>

      {/* Currency + Network Selection */}
      {!selectedCurrency ? (
        <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
          <h2 className="text-sm font-semibold text-[#E6EDF3] mb-3">Select Currency</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {CURRENCIES.map((cur) => (
              <button
                key={cur.symbol}
                onClick={() => {
                  setSelectedCurrency(cur);
                  setSelectedNetworkIdx(0);
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
      ) : (
        <div className="space-y-4">
          {/* Currency Header */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-xs font-bold text-[#8B5CF6]">
                  {selectedCurrency.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#E6EDF3]">{selectedCurrency.name}</p>
                  <p className="text-[10px] text-[#8B949E]">
                    Balance: {formatCurrency(mockBalance, selectedCurrency.symbol)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCurrency(null)}
                className="text-xs text-[#8B5CF6] hover:text-[#A78BFA]"
              >
                Change
              </button>
            </div>

            {/* Network Selection */}
            {selectedCurrency.networks.length > 1 && (
              <div className="mb-4">
                <label className="text-xs text-[#8B949E] mb-1.5 block">Network</label>
                <div className="flex gap-2">
                  {selectedCurrency.networks.map((net, i) => (
                    <button
                      key={net.name}
                      onClick={() => setSelectedNetworkIdx(i)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-button text-xs font-medium transition-all duration-200',
                        selectedNetworkIdx === i
                          ? 'bg-[#8B5CF6] text-white'
                          : 'bg-[#1C2128] border border-[#30363D] text-[#8B949E] hover:text-[#E6EDF3]'
                      )}
                    >
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Address */}
            <div className="mb-3">
              <label className="text-xs text-[#8B949E] mb-1.5 block">Recipient Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={`Enter ${selectedCurrency.symbol} address`}
                className="w-full h-10 bg-[#0D1117] border border-[#30363D] rounded-button px-3 text-sm font-mono text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:border-[#8B5CF6] transition-colors"
              />
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="text-xs text-[#8B949E] mb-1.5 block">Amount</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 h-10 bg-[#0D1117] border border-[#30363D] rounded-button px-3 text-sm font-mono text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none focus:border-[#8B5CF6] transition-colors"
                />
                <button
                  onClick={handleMax}
                  className="h-10 px-4 bg-[#1C2128] border border-[#30363D] rounded-button text-xs font-medium text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Fee & Receive Info */}
            <div className="space-y-2 p-3 bg-[#0D1117] border border-[#30363D] rounded-card">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8B949E]">Network Fee</span>
                <span className="font-mono text-[#E6EDF3]">
                  {formatCurrency(fee, selectedCurrency.symbol)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8B949E]">Min Withdrawal</span>
                <span className="font-mono text-[#E6EDF3]">
                  {formatCurrency(network?.minWithdraw || 0, selectedCurrency.symbol)}
                </span>
              </div>
              <div className="border-t border-[#30363D] pt-2 flex items-center justify-between text-sm">
                <span className="text-[#8B949E] font-medium">You Receive</span>
                <span className="font-mono font-bold text-[#10B981]">
                  {receiveAmount > 0 ? formatCurrency(receiveAmount, selectedCurrency.symbol) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Withdraw Button */}
          <button
            onClick={handleWithdraw}
            disabled={!isAuthenticated || !address || numAmount <= 0 || isSubmitting}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#8B5CF6]/50 disabled:cursor-not-allowed text-white font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowUpRight className="w-5 h-5" />
            )}
            {isSubmitting ? 'Processing...' : isAuthenticated ? 'Withdraw' : 'Login to Withdraw'}
          </button>
        </div>
      )}

      {/* Pending Withdrawals */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card overflow-hidden">
        <div className="p-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#8B949E]" />
          <h3 className="text-sm font-semibold text-[#E6EDF3]">Pending Withdrawals</h3>
        </div>
        <div className="border-t border-[#30363D] divide-y divide-[#30363D]/50">
          {MOCK_PENDING.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#8B949E]">No pending withdrawals</div>
          ) : (
            MOCK_PENDING.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <ArrowUpRight className="w-4 h-4 text-[#F59E0B]" />
                  <div>
                    <p className="text-sm font-mono text-[#E6EDF3]">{w.amount} {w.currency}</p>
                    <p className="text-[10px] text-[#8B949E] font-mono">{w.address}</p>
                  </div>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium capitalize',
                  w.status === 'completed' ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                )}>
                  {w.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
