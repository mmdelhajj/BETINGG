'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ArrowUpDown,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { post } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwapCurrency {
  symbol: string;
  name: string;
  balance: number;
  usdRate: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const SWAP_CURRENCIES: SwapCurrency[] = [
  { symbol: 'BTC', name: 'Bitcoin', balance: 0.05234, usdRate: 42000 },
  { symbol: 'ETH', name: 'Ethereum', balance: 1.5234, usdRate: 2200 },
  { symbol: 'USDT', name: 'Tether', balance: 500, usdRate: 1 },
  { symbol: 'USDC', name: 'USD Coin', balance: 300, usdRate: 1 },
  { symbol: 'SOL', name: 'Solana', balance: 12.5, usdRate: 25 },
  { symbol: 'DOGE', name: 'Dogecoin', balance: 5000, usdRate: 0.03 },
  { symbol: 'LTC', name: 'Litecoin', balance: 3.2, usdRate: 60 },
  { symbol: 'BNB', name: 'BNB', balance: 2.1, usdRate: 230 },
];

// ---------------------------------------------------------------------------
// Swap Page
// ---------------------------------------------------------------------------

export default function SwapPage() {
  const [fromSymbol, setFromSymbol] = useState('BTC');
  const [toSymbol, setToSymbol] = useState('USDT');
  const [fromAmount, setFromAmount] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const fromCurrency = SWAP_CURRENCIES.find((c) => c.symbol === fromSymbol)!;
  const toCurrency = SWAP_CURRENCIES.find((c) => c.symbol === toSymbol)!;

  const rate = fromCurrency.usdRate / toCurrency.usdRate;
  const numFrom = parseFloat(fromAmount) || 0;
  const toAmount = numFrom * rate;

  const handleSwapDirection = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setFromAmount('');
  };

  const handleSwap = async () => {
    if (numFrom <= 0) return;
    setIsSwapping(true);
    try {
      await post('/wallets/swap', {
        fromCurrency: fromSymbol,
        toCurrency: toSymbol,
        amount: fromAmount, // Backend expects string, not number
      });
    } catch {
      // Silently handle for demo
    } finally {
      setIsSwapping(false);
      setFromAmount('');
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#E6EDF3]">Swap</h1>
          <p className="text-xs text-[#8B949E]">Convert between cryptocurrencies instantly</p>
        </div>
      </div>

      {/* Swap Card */}
      <div className="space-y-0 relative">
        {/* From */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-t-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#8B949E]">From</span>
            <span className="text-xs text-[#8B949E]">
              Balance: <span className="font-mono text-[#E6EDF3]">{formatCurrency(fromCurrency.balance, fromCurrency.symbol)}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => { setShowFromPicker(!showFromPicker); setShowToPicker(false); }}
                className="flex items-center gap-2 h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button hover:border-[#8B5CF6]/30 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[10px] font-bold text-[#8B5CF6]">
                  {fromSymbol.slice(0, 2)}
                </div>
                <span className="text-sm font-semibold text-[#E6EDF3]">{fromSymbol}</span>
                <ChevronDown className="w-3 h-3 text-[#8B949E]" />
              </button>
              {showFromPicker && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-[#161B22] border border-[#30363D] rounded-card shadow-xl w-48 max-h-60 overflow-y-auto">
                  {SWAP_CURRENCIES.filter((c) => c.symbol !== toSymbol).map((c) => (
                    <button
                      key={c.symbol}
                      onClick={() => { setFromSymbol(c.symbol); setShowFromPicker(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-[#1C2128] flex items-center gap-2 text-sm transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[8px] font-bold text-[#8B5CF6]">
                        {c.symbol.slice(0, 2)}
                      </div>
                      <span className="text-[#E6EDF3]">{c.symbol}</span>
                      <span className="text-[#8B949E] text-xs ml-auto">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 h-10 bg-transparent text-right text-lg font-mono font-bold text-[#E6EDF3] placeholder:text-[#484F58] focus:outline-none"
            />
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button
            onClick={handleSwapDirection}
            className="w-10 h-10 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* To */}
        <div className="bg-[#161B22] border border-[#30363D] border-t-0 rounded-b-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#8B949E]">To</span>
            <span className="text-xs text-[#8B949E]">
              Balance: <span className="font-mono text-[#E6EDF3]">{formatCurrency(toCurrency.balance, toCurrency.symbol)}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => { setShowToPicker(!showToPicker); setShowFromPicker(false); }}
                className="flex items-center gap-2 h-10 px-3 bg-[#1C2128] border border-[#30363D] rounded-button hover:border-[#8B5CF6]/30 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[10px] font-bold text-[#10B981]">
                  {toSymbol.slice(0, 2)}
                </div>
                <span className="text-sm font-semibold text-[#E6EDF3]">{toSymbol}</span>
                <ChevronDown className="w-3 h-3 text-[#8B949E]" />
              </button>
              {showToPicker && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-[#161B22] border border-[#30363D] rounded-card shadow-xl w-48 max-h-60 overflow-y-auto">
                  {SWAP_CURRENCIES.filter((c) => c.symbol !== fromSymbol).map((c) => (
                    <button
                      key={c.symbol}
                      onClick={() => { setToSymbol(c.symbol); setShowToPicker(false); }}
                      className="w-full px-3 py-2 text-left hover:bg-[#1C2128] flex items-center gap-2 text-sm transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[8px] font-bold text-[#10B981]">
                        {c.symbol.slice(0, 2)}
                      </div>
                      <span className="text-[#E6EDF3]">{c.symbol}</span>
                      <span className="text-[#8B949E] text-xs ml-auto">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 text-right text-lg font-mono font-bold text-[#E6EDF3]">
              {toAmount > 0 ? toAmount.toFixed(toCurrency.symbol === 'USDT' || toCurrency.symbol === 'USDC' ? 2 : 6) : '0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Rate Display */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#8B949E] flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Exchange Rate
          </span>
          <span className="font-mono text-[#E6EDF3]">
            1 {fromSymbol} = {rate.toFixed(toCurrency.symbol === 'USDT' || toCurrency.symbol === 'USDC' ? 2 : 6)} {toSymbol}
          </span>
        </div>
      </div>

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!isAuthenticated || numFrom <= 0 || isSwapping}
        className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:bg-[#8B5CF6]/50 disabled:cursor-not-allowed text-white font-bold rounded-button transition-all duration-200 flex items-center justify-center gap-2"
      >
        {isSwapping ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <ArrowUpDown className="w-5 h-5" />
        )}
        {isSwapping ? 'Swapping...' : isAuthenticated ? 'Swap' : 'Login to Swap'}
      </button>
    </div>
  );
}
