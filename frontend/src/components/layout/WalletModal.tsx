'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Copy,
  Check,
  QrCode,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUpFromLine,
  ArrowDownToLine,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { cn, formatCurrency, copyToClipboard, shortenAddress } from '@/lib/utils';
import { useAuthStore, selectBalances, selectPreferredCurrency } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toastSuccess, toastError } from '@/components/ui/toast';
import { get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CryptoWallet {
  currency: string;
  name: string;
  icon: string;
  available: number;
  locked: number;
  total: number;
  usdValue: number;
  change24h: number;
  depositAddress: string;
  networks: Network[];
}

interface Network {
  id: string;
  name: string;
  symbol: string;
  fee: number;
  confirmations: number;
  minWithdraw: number;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'swap' | 'bet' | 'win' | 'bonus';
  currency: string;
  amount: number;
  usdValue: number;
  status: 'pending' | 'confirmed' | 'failed' | 'processing';
  txHash?: string;
  address?: string;
  createdAt: string;
  confirmations?: number;
  requiredConfirmations?: number;
}

type ModalTab = 'deposit' | 'withdrawal' | 'history';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_WALLETS: CryptoWallet[] = [
  {
    currency: 'BTC', name: 'Bitcoin', icon: 'B', available: 0.04523, locked: 0.001, total: 0.04623,
    usdValue: 2843.21, change24h: 2.34,
    depositAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    networks: [
      { id: 'btc-main', name: 'Bitcoin', symbol: 'BTC', fee: 0.0001, confirmations: 3, minWithdraw: 0.0005 },
      { id: 'btc-lightning', name: 'Lightning', symbol: 'BTC-LN', fee: 0.000001, confirmations: 0, minWithdraw: 0.00001 },
    ],
  },
  {
    currency: 'ETH', name: 'Ethereum', icon: 'E', available: 1.2456, locked: 0.05, total: 1.2956,
    usdValue: 4102.88, change24h: -1.12,
    depositAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08',
    networks: [
      { id: 'eth-main', name: 'Ethereum (ERC-20)', symbol: 'ETH', fee: 0.003, confirmations: 12, minWithdraw: 0.01 },
      { id: 'eth-arb', name: 'Arbitrum', symbol: 'ARB', fee: 0.0005, confirmations: 1, minWithdraw: 0.005 },
    ],
  },
  {
    currency: 'USDT', name: 'Tether', icon: 'T', available: 5420.50, locked: 200.00, total: 5620.50,
    usdValue: 5620.50, change24h: 0.01,
    depositAddress: 'TLXx8pMjVqWbGphF4WfkRsQRXBz3Mm1sNA',
    networks: [
      { id: 'usdt-trc20', name: 'Tron (TRC-20)', symbol: 'TRX', fee: 1.0, confirmations: 20, minWithdraw: 10 },
      { id: 'usdt-erc20', name: 'Ethereum (ERC-20)', symbol: 'ETH', fee: 15.0, confirmations: 12, minWithdraw: 50 },
      { id: 'usdt-bep20', name: 'BSC (BEP-20)', symbol: 'BNB', fee: 0.5, confirmations: 15, minWithdraw: 10 },
    ],
  },
  {
    currency: 'USDC', name: 'USD Coin', icon: 'U', available: 1200.00, locked: 0, total: 1200.00,
    usdValue: 1200.00, change24h: 0.00,
    depositAddress: '0x8fd00f170fDf3772C5EBdCD90bF257316c69BA45',
    networks: [
      { id: 'usdc-erc20', name: 'Ethereum (ERC-20)', symbol: 'ETH', fee: 10.0, confirmations: 12, minWithdraw: 25 },
      { id: 'usdc-sol', name: 'Solana', symbol: 'SOL', fee: 0.01, confirmations: 1, minWithdraw: 1 },
    ],
  },
  {
    currency: 'SOL', name: 'Solana', icon: 'S', available: 25.678, locked: 0, total: 25.678,
    usdValue: 3842.55, change24h: 5.67,
    depositAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    networks: [
      { id: 'sol-main', name: 'Solana', symbol: 'SOL', fee: 0.01, confirmations: 1, minWithdraw: 0.1 },
    ],
  },
  {
    currency: 'DOGE', name: 'Dogecoin', icon: 'D', available: 10500, locked: 0, total: 10500,
    usdValue: 1365.00, change24h: -3.45,
    depositAddress: 'D7Y55BXwU3RzDGPMaS2x5jFbrRnXqGPeDX',
    networks: [
      { id: 'doge-main', name: 'Dogecoin', symbol: 'DOGE', fee: 5.0, confirmations: 6, minWithdraw: 50 },
    ],
  },
  {
    currency: 'LTC', name: 'Litecoin', icon: 'L', available: 3.456, locked: 0, total: 3.456,
    usdValue: 311.04, change24h: 1.23,
    depositAddress: 'ltc1qnv58sdqa8jkwrx7n0fjd3d0e0kzf9mfpfj9h2r',
    networks: [
      { id: 'ltc-main', name: 'Litecoin', symbol: 'LTC', fee: 0.001, confirmations: 6, minWithdraw: 0.01 },
    ],
  },
  {
    currency: 'XRP', name: 'Ripple', icon: 'X', available: 2500, locked: 0, total: 2500,
    usdValue: 1525.00, change24h: 0.89,
    depositAddress: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh',
    networks: [
      { id: 'xrp-main', name: 'XRP Ledger', symbol: 'XRP', fee: 0.25, confirmations: 1, minWithdraw: 10 },
    ],
  },
];

// All currencies for the full list (including ones with zero balance)
const ALL_CURRENCIES: { currency: string; name: string }[] = [
  { currency: 'ADA', name: 'Cardano' },
  { currency: 'ALGO', name: 'Algorand' },
  { currency: 'AVAX', name: 'Avalanche' },
  { currency: 'BCH', name: 'Bitcoin Cash' },
  { currency: 'BNB', name: 'Binance Coin' },
  { currency: 'BTC', name: 'Bitcoin' },
  { currency: 'DAI', name: 'Dai' },
  { currency: 'DOGE', name: 'Dogecoin' },
  { currency: 'DOT', name: 'Polkadot' },
  { currency: 'ETH', name: 'Ethereum' },
  { currency: 'FTM', name: 'Fantom' },
  { currency: 'LINK', name: 'Chainlink' },
  { currency: 'LTC', name: 'Litecoin' },
  { currency: 'MATIC', name: 'Polygon' },
  { currency: 'NEAR', name: 'NEAR Protocol' },
  { currency: 'SHIB', name: 'Shiba Inu' },
  { currency: 'SOL', name: 'Solana' },
  { currency: 'TRX', name: 'Tron' },
  { currency: 'UNI', name: 'Uniswap' },
  { currency: 'USD', name: 'US Dollar' },
  { currency: 'USDC', name: 'USD Coin' },
  { currency: 'USDT', name: 'Tether' },
  { currency: 'XLM', name: 'Stellar' },
  { currency: 'XRP', name: 'Ripple' },
];

const POPULAR_CURRENCIES = ['USDT', 'ETH', 'LTC', 'BCH', 'USD'];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', type: 'deposit', currency: 'BTC', amount: 0.05, usdValue: 3076.50, status: 'confirmed', txHash: '0xabc123...def456', createdAt: new Date(Date.now() - 3600000).toISOString(), confirmations: 6, requiredConfirmations: 3 },
  { id: 'tx-2', type: 'withdrawal', currency: 'USDT', amount: 500, usdValue: 500, status: 'processing', address: 'TLXx8pMjVqWbGphF4WfkRsQRXBz3Mm1sNA', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'tx-3', type: 'deposit', currency: 'ETH', amount: 0.25, usdValue: 815.75, status: 'confirmed', createdAt: new Date(Date.now() - 14400000).toISOString() },
  { id: 'tx-4', type: 'withdrawal', currency: 'USDT', amount: 100, usdValue: 100, status: 'confirmed', createdAt: new Date(Date.now() - 28800000).toISOString() },
  { id: 'tx-5', type: 'deposit', currency: 'BTC', amount: 0.01, usdValue: 615.30, status: 'confirmed', createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: 'tx-6', type: 'deposit', currency: 'SOL', amount: 10, usdValue: 1496.50, status: 'pending', txHash: '0x789abc...123def', createdAt: new Date(Date.now() - 1800000).toISOString(), confirmations: 0, requiredConfirmations: 1 },
];

// ---------------------------------------------------------------------------
// Currency Icon
// ---------------------------------------------------------------------------

function CurrencyIcon({ currency, size = 'md' }: { currency: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors: Record<string, { bg: string; text: string }> = {
    BTC: { bg: 'bg-orange-500', text: 'text-white' },
    ETH: { bg: 'bg-blue-500', text: 'text-white' },
    USDT: { bg: 'bg-emerald-500', text: 'text-white' },
    USDC: { bg: 'bg-blue-400', text: 'text-white' },
    SOL: { bg: 'bg-purple-500', text: 'text-white' },
    DOGE: { bg: 'bg-yellow-500', text: 'text-black' },
    LTC: { bg: 'bg-gray-400', text: 'text-white' },
    XRP: { bg: 'bg-slate-500', text: 'text-white' },
    BNB: { bg: 'bg-yellow-500', text: 'text-black' },
    ADA: { bg: 'bg-blue-600', text: 'text-white' },
    ALGO: { bg: 'bg-teal-500', text: 'text-white' },
    AVAX: { bg: 'bg-red-500', text: 'text-white' },
    BCH: { bg: 'bg-green-500', text: 'text-white' },
    DAI: { bg: 'bg-amber-500', text: 'text-white' },
    DOT: { bg: 'bg-pink-500', text: 'text-white' },
    FTM: { bg: 'bg-blue-500', text: 'text-white' },
    LINK: { bg: 'bg-blue-600', text: 'text-white' },
    MATIC: { bg: 'bg-purple-600', text: 'text-white' },
    NEAR: { bg: 'bg-emerald-600', text: 'text-white' },
    SHIB: { bg: 'bg-orange-400', text: 'text-white' },
    TRX: { bg: 'bg-red-500', text: 'text-white' },
    UNI: { bg: 'bg-pink-500', text: 'text-white' },
    USD: { bg: 'bg-green-600', text: 'text-white' },
    XLM: { bg: 'bg-sky-500', text: 'text-white' },
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const c = colors[currency] || { bg: 'bg-gray-500', text: 'text-white' };

  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold shrink-0', c.bg, c.text, sizeClasses[size])}>
      {currency.charAt(0)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Transaction['status'] }) {
  const config = {
    confirmed: { color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', label: 'Confirmed' },
    pending: { color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', label: 'Pending' },
    processing: { color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', label: 'Processing' },
    failed: { color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', label: 'Failed' },
  };
  const c = config[status];
  return (
    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', c.color, c.bg)}>
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Currency List View (main selector)
// ---------------------------------------------------------------------------

function CurrencyListView({
  wallets,
  searchQuery,
  onSelectCurrency,
}: {
  wallets: CryptoWallet[];
  searchQuery: string;
  onSelectCurrency: (currency: string) => void;
}) {
  const q = searchQuery.toLowerCase().trim();

  // Owned currencies (with balance > 0)
  const owned = wallets.filter((w) => w.available > 0);

  // Popular currencies (not already owned)
  const ownedSet = new Set(owned.map((w) => w.currency));
  const popular = POPULAR_CURRENCIES
    .filter((c) => !ownedSet.has(c))
    .map((c) => {
      const wallet = wallets.find((w) => w.currency === c);
      const allCur = ALL_CURRENCIES.find((ac) => ac.currency === c);
      return {
        currency: c,
        name: wallet?.name || allCur?.name || c,
        available: wallet?.available || 0,
        usdValue: wallet?.usdValue || 0,
      };
    });

  // All currencies
  const allCurrencies = ALL_CURRENCIES
    .filter((c) => !ownedSet.has(c.currency) && !POPULAR_CURRENCIES.includes(c.currency))
    .map((c) => {
      const wallet = wallets.find((w) => w.currency === c.currency);
      return {
        currency: c.currency,
        name: wallet?.name || c.name,
        available: wallet?.available || 0,
        usdValue: wallet?.usdValue || 0,
      };
    });

  // Filter by search
  const filterFn = (item: { currency: string; name: string }) => {
    if (!q) return true;
    return item.currency.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  };

  const filteredOwned = owned.filter(filterFn);
  const filteredPopular = popular.filter(filterFn);
  const filteredAll = allCurrencies.filter(filterFn);

  const renderRow = (item: { currency: string; name: string; available?: number; usdValue?: number }) => (
    <button
      key={item.currency}
      onClick={() => onSelectCurrency(item.currency)}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#1C2128] transition-colors duration-150 text-left group"
    >
      <CurrencyIcon currency={item.currency} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#E6EDF3]">{item.currency}</p>
        <p className="text-xs text-[#8B949E] truncate">{item.name}</p>
      </div>
      {(item.available ?? 0) > 0 && (
        <div className="text-right shrink-0">
          <p className="text-sm font-mono font-medium text-[#E6EDF3]">
            {formatCurrency(item.available ?? 0, item.currency, { showSymbol: false })}
          </p>
          <p className="text-[11px] font-mono text-[#8B949E]">
            ${(item.usdValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )}
      <ChevronLeft className="w-4 h-4 text-[#30363D] rotate-180 group-hover:text-[#8B949E] transition-colors shrink-0" />
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Owned section */}
      {filteredOwned.length > 0 && (
        <div>
          <div className="px-5 py-2 sticky top-0 bg-[#161B22] z-10">
            <p className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider">Owned</p>
          </div>
          {filteredOwned.map((w) => renderRow({ currency: w.currency, name: w.name, available: w.available, usdValue: w.usdValue }))}
        </div>
      )}

      {/* Popular section */}
      {filteredPopular.length > 0 && (
        <div>
          <div className="px-5 py-2 sticky top-0 bg-[#161B22] z-10">
            <p className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider">Popular</p>
          </div>
          {filteredPopular.map((item) => renderRow(item))}
        </div>
      )}

      {/* All currencies section */}
      {filteredAll.length > 0 && (
        <div>
          <div className="px-5 py-2 sticky top-0 bg-[#161B22] z-10">
            <p className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider">All currencies</p>
          </div>
          {filteredAll.map((item) => renderRow(item))}
        </div>
      )}

      {/* No results */}
      {filteredOwned.length === 0 && filteredPopular.length === 0 && filteredAll.length === 0 && (
        <div className="py-12 text-center text-[#8B949E] text-sm">
          No currencies found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deposit Detail View
// ---------------------------------------------------------------------------

function DepositDetailView({ wallet }: { wallet: CryptoWallet }) {
  const [copied, setCopied] = useState(false);
  const [selectedNetworkId, setSelectedNetworkId] = useState(wallet.networks[0]?.id || '');

  const handleCopy = async () => {
    const success = await copyToClipboard(wallet.depositAddress);
    if (success) {
      setCopied(true);
      toastSuccess('Address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toastError('Failed to copy address');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      {/* Currency info header */}
      <div className="flex items-center gap-3">
        <CurrencyIcon currency={wallet.currency} size="lg" />
        <div>
          <p className="text-lg font-bold text-[#E6EDF3]">{wallet.name}</p>
          <p className="text-sm text-[#8B949E]">{wallet.currency}</p>
        </div>
        {wallet.available > 0 && (
          <div className="ml-auto text-right">
            <p className="text-sm font-mono font-semibold text-[#E6EDF3]">
              {formatCurrency(wallet.available, wallet.currency, { showSymbol: false })}
            </p>
            <p className="text-xs text-[#8B949E] font-mono">
              ${wallet.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Network selector */}
      {wallet.networks.length > 1 && (
        <div>
          <p className="text-xs font-medium text-[#8B949E] mb-2">Select Network</p>
          <div className="flex flex-wrap gap-2">
            {wallet.networks.map((net) => (
              <button
                key={net.id}
                onClick={() => setSelectedNetworkId(net.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-200',
                  selectedNetworkId === net.id
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]'
                    : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#8B5CF6]/30'
                )}
              >
                {net.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR Code */}
      <div className="flex justify-center">
        <div className="w-44 h-44 bg-white rounded-xl flex items-center justify-center">
          <div className="text-center">
            <QrCode className="w-20 h-20 text-[#0D1117] mx-auto mb-1" />
            <p className="text-[10px] text-[#0D1117]/40 font-mono">{wallet.currency}</p>
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <p className="text-xs text-[#8B949E] mb-2">Deposit Address</p>
        <div className="flex items-center gap-2 bg-[#0D1117] border border-[#30363D] rounded-lg p-3">
          <p className="flex-1 text-xs font-mono text-[#E6EDF3] break-all leading-relaxed">
            {wallet.depositAddress}
          </p>
          <button
            onClick={handleCopy}
            className="shrink-0 p-2 hover:bg-[#1C2128] rounded-md transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-[#10B981]" />
            ) : (
              <Copy className="w-4 h-4 text-[#8B949E] hover:text-[#E6EDF3]" />
            )}
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg p-3">
        <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
        <p className="text-xs text-[#F59E0B]/80 leading-relaxed">
          Only send <strong>{wallet.name} ({wallet.currency})</strong> to this address. Sending other assets may result in permanent loss.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal Detail View
// ---------------------------------------------------------------------------

function WithdrawalDetailView({ wallet }: { wallet: CryptoWallet }) {
  const [selectedNetworkId, setSelectedNetworkId] = useState(wallet.networks[0]?.id || '');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');

  const activeNetwork = wallet.networks.find((n) => n.id === selectedNetworkId) || wallet.networks[0];
  const estimatedReceive = parseFloat(amount || '0') - (activeNetwork?.fee || 0);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      {/* Currency info header */}
      <div className="flex items-center gap-3">
        <CurrencyIcon currency={wallet.currency} size="lg" />
        <div>
          <p className="text-lg font-bold text-[#E6EDF3]">{wallet.name}</p>
          <p className="text-sm text-[#8B949E]">
            Available: {formatCurrency(wallet.available, wallet.currency, { showSymbol: false })} {wallet.currency}
          </p>
        </div>
      </div>

      {/* Network selector */}
      {wallet.networks.length > 1 && (
        <div>
          <p className="text-xs font-medium text-[#8B949E] mb-2">Select Network</p>
          <div className="flex flex-wrap gap-2">
            {wallet.networks.map((net) => (
              <button
                key={net.id}
                onClick={() => setSelectedNetworkId(net.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-200',
                  selectedNetworkId === net.id
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#A78BFA]'
                    : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#8B5CF6]/30'
                )}
              >
                {net.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Address input */}
      <div>
        <p className="text-xs font-medium text-[#8B949E] mb-2">Withdrawal Address</p>
        <input
          placeholder={`Enter ${wallet.currency} address`}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2.5 text-sm text-[#E6EDF3] placeholder:text-[#30363D] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all"
        />
      </div>

      {/* Amount input */}
      <div>
        <p className="text-xs font-medium text-[#8B949E] mb-2">Amount</p>
        <div className="relative">
          <input
            placeholder="0.00"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2.5 text-sm text-[#E6EDF3] placeholder:text-[#30363D] focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all pr-20"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={() => setAmount(String(wallet.available))}
              className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] px-2 py-1 rounded transition-colors"
            >
              MAX
            </button>
            <span className="text-xs text-[#8B949E] pr-2">{wallet.currency}</span>
          </div>
        </div>
        <p className="text-[11px] text-[#8B949E] mt-1">
          Min: {formatCurrency(activeNetwork?.minWithdraw || 0, wallet.currency, { showSymbol: false })} {wallet.currency}
        </p>
      </div>

      {/* Fee breakdown */}
      <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-4 space-y-2.5">
        <div className="flex justify-between text-xs">
          <span className="text-[#8B949E]">Network Fee</span>
          <span className="font-mono text-[#E6EDF3]">
            {formatCurrency(activeNetwork?.fee || 0, wallet.currency, { showSymbol: false })} {wallet.currency}
          </span>
        </div>
        <div className="border-t border-[#30363D]" />
        <div className="flex justify-between text-xs">
          <span className="text-[#8B949E]">You Receive</span>
          <span className={cn('font-mono font-semibold', estimatedReceive > 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
            {formatCurrency(Math.max(0, estimatedReceive), wallet.currency, { showSymbol: false })} {wallet.currency}
          </span>
        </div>
      </div>

      {/* Withdraw button */}
      <Button
        variant="primary"
        fullWidth
        size="lg"
        disabled={!address || !amount || estimatedReceive <= 0}
        className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
      >
        <ArrowUpFromLine className="w-4 h-4" />
        Withdraw {wallet.currency}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History View
// ---------------------------------------------------------------------------

function HistoryView({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {transactions.length === 0 ? (
        <div className="py-16 text-center text-[#8B949E] text-sm">
          <Clock className="w-8 h-8 mx-auto mb-3 text-[#30363D]" />
          <p>No transactions yet</p>
        </div>
      ) : (
        <div>
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 px-5 py-3 border-b border-[#30363D]/50 hover:bg-[#1C2128] transition-colors"
            >
              {/* Icon */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                tx.type === 'deposit' ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
              )}>
                {tx.type === 'deposit' ? (
                  <ArrowDownToLine className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <ArrowUpFromLine className="w-4 h-4 text-[#EF4444]" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#E6EDF3] capitalize">{tx.type}</p>
                  <StatusBadge status={tx.status} />
                </div>
                <p className="text-xs text-[#8B949E]">
                  {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p className={cn(
                  'text-sm font-mono font-medium',
                  tx.type === 'deposit' ? 'text-[#10B981]' : 'text-[#EF4444]'
                )}>
                  {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency, { showSymbol: false })}
                </p>
                <p className="text-[11px] text-[#8B949E] font-mono">{tx.currency}</p>
              </div>

              {/* External link */}
              {tx.txHash && (
                <button className="shrink-0 p-1 hover:bg-[#30363D] rounded transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-[#8B949E]" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WalletModal Component
// ---------------------------------------------------------------------------

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ModalTab;
}

export default function WalletModal({ isOpen, onClose, initialTab = 'deposit' }: WalletModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setSelectedCurrency(null);
      loadData();
    }
  }, [isOpen, initialTab]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const loadData = async () => {
    setIsLoading(true);

    // Fetch wallets from API
    let apiWallets: CryptoWallet[] | null = null;
    try {
      const walletsRes = await get<{ wallets: Array<{
        id: string;
        userId: string;
        currencyId: string;
        currency?: { symbol: string; name: string; icon: string; type: string };
        symbol?: string;
        name?: string;
        icon?: string;
        balance: string | number;
        lockedBalance: string | number;
      }> }>('/wallets');
      if (walletsRes?.wallets?.length) {
        apiWallets = walletsRes.wallets.map((w) => {
          const available = typeof w.balance === 'string' ? parseFloat(w.balance) : Number(w.balance);
          const locked = typeof w.lockedBalance === 'string' ? parseFloat(w.lockedBalance) : Number(w.lockedBalance);
          const total = available + locked;
          const sym = w.currency?.symbol ?? w.symbol ?? '';
          const walletName = w.currency?.name ?? w.name ?? sym;
          const walletIcon = w.currency?.icon ?? w.icon ?? '';
          const mock = MOCK_WALLETS.find((m) => m.currency === sym);
          return {
            currency: sym,
            name: walletName,
            icon: walletIcon || sym.charAt(0),
            available: isNaN(available) ? 0 : available,
            locked: isNaN(locked) ? 0 : locked,
            total: isNaN(total) ? 0 : total,
            usdValue: mock?.usdValue ?? 0,
            change24h: mock?.change24h ?? 0,
            depositAddress: mock?.depositAddress ?? '',
            networks: mock?.networks ?? [],
          } satisfies CryptoWallet;
        });
      }
    } catch {
      // API unavailable, fall back to mock data
    }

    // Fetch transactions from API
    let apiTransactions: Transaction[] | null = null;
    try {
      const txRes = await get<{ transactions: Transaction[] }>('/wallets/transactions');
      if (txRes?.transactions?.length) {
        apiTransactions = txRes.transactions;
      }
    } catch {
      // API unavailable, fall back to mock data
    }

    setWallets(apiWallets ?? MOCK_WALLETS);
    setTransactions(apiTransactions ?? MOCK_TRANSACTIONS);
    setIsLoading(false);
  };

  const handleSelectCurrency = useCallback((currency: string) => {
    setSelectedCurrency(currency);
    setSearchQuery('');
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCurrency(null);
    setSearchQuery('');
  }, []);

  const selectedWallet = selectedCurrency
    ? wallets.find((w) => w.currency === selectedCurrency) || {
        currency: selectedCurrency,
        name: ALL_CURRENCIES.find((c) => c.currency === selectedCurrency)?.name || selectedCurrency,
        icon: selectedCurrency.charAt(0),
        available: 0,
        locked: 0,
        total: 0,
        usdValue: 0,
        change24h: 0,
        depositAddress: '',
        networks: [],
      }
    : null;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-[500px] bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl shadow-black/50 flex flex-col pointer-events-auto"
              style={{ maxHeight: 'min(680px, 90vh)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ---- Header ---- */}
              <div className="shrink-0 px-5 pt-5 pb-0">
                {/* Title row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {selectedCurrency && (
                      <button
                        onClick={handleBack}
                        className="p-1.5 -ml-1.5 rounded-md hover:bg-[#1C2128] transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-[#8B949E]" />
                      </button>
                    )}
                    <h2 className="text-lg font-bold text-[#E6EDF3] tracking-tight">
                      {selectedCurrency ? selectedWallet?.name || selectedCurrency : 'WALLET'}
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-md hover:bg-[#1C2128] transition-colors"
                  >
                    <X className="w-5 h-5 text-[#8B949E]" />
                  </button>
                </div>

                {/* Tabs (only shown when no currency is selected) */}
                {!selectedCurrency && (
                  <div className="flex items-center gap-0 border-b border-[#30363D]">
                    <button
                      onClick={() => { setActiveTab('deposit'); setSelectedCurrency(null); }}
                      className={cn(
                        'relative px-4 py-2.5 text-sm font-medium transition-colors',
                        activeTab === 'deposit' ? 'text-[#E6EDF3]' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                      )}
                    >
                      Deposit
                      {activeTab === 'deposit' && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#8B5CF6] rounded-full" />
                      )}
                    </button>
                    <button
                      onClick={() => { setActiveTab('withdrawal'); setSelectedCurrency(null); }}
                      className={cn(
                        'relative px-4 py-2.5 text-sm font-medium transition-colors',
                        activeTab === 'withdrawal' ? 'text-[#E6EDF3]' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                      )}
                    >
                      Withdrawal
                      {activeTab === 'withdrawal' && (
                        <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#8B5CF6] rounded-full" />
                      )}
                    </button>
                    <button
                      onClick={() => { setActiveTab('history'); setSelectedCurrency(null); }}
                      className={cn(
                        'relative px-3 py-2.5 transition-colors',
                        activeTab === 'history' ? 'text-[#E6EDF3]' : 'text-[#8B949E] hover:text-[#E6EDF3]'
                      )}
                    >
                      <Clock className="w-4 h-4" />
                      {activeTab === 'history' && (
                        <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#8B5CF6] rounded-full" />
                      )}
                    </button>
                  </div>
                )}

                {/* Search bar (shown on deposit/withdrawal list) */}
                {!selectedCurrency && activeTab !== 'history' && (
                  <div className="py-3">
                    <div className="flex items-center gap-2 bg-[#0D1117] border border-[#30363D] rounded-lg px-3 py-2 focus-within:border-[#8B5CF6]/50 focus-within:ring-1 focus-within:ring-[#8B5CF6]/20 transition-all">
                      <Search className="w-4 h-4 text-[#8B949E] shrink-0" />
                      <input
                        type="text"
                        placeholder="Search crypto or fiat"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-[#E6EDF3] placeholder:text-[#30363D] outline-none"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="shrink-0">
                          <X className="w-3.5 h-3.5 text-[#8B949E] hover:text-[#E6EDF3]" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ---- Content ---- */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
                  </div>
                ) : activeTab === 'history' ? (
                  <HistoryView transactions={transactions} />
                ) : selectedCurrency && selectedWallet ? (
                  activeTab === 'deposit' ? (
                    <DepositDetailView wallet={selectedWallet} />
                  ) : (
                    <WithdrawalDetailView wallet={selectedWallet} />
                  )
                ) : (
                  <CurrencyListView
                    wallets={wallets}
                    searchQuery={searchQuery}
                    onSelectCurrency={handleSelectCurrency}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Balance Dropdown Component (for Header)
// ---------------------------------------------------------------------------

interface BalanceDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWallet: () => void;
  onSelectCurrency: (currency: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function BalanceDropdown({
  isOpen,
  onClose,
  onOpenWallet,
  onSelectCurrency,
  anchorRef,
}: BalanceDropdownProps) {
  const balances = useAuthStore(selectBalances);
  const preferredCurrency = useAuthStore(selectPreferredCurrency);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Funded balances
  const fundedBalances = balances.filter((b) => b.available > 0);

  // Active balance
  const activeBalance =
    fundedBalances.find((b) => b.currency === preferredCurrency) ||
    fundedBalances.slice().sort((a, b) => b.available - a.available)[0] ||
    null;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-72 bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-fade-in"
    >
      {/* Active balance header */}
      {activeBalance && (
        <div className="px-4 py-3 border-b border-[#30363D]">
          <p className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider mb-2">
            Active balance
          </p>
          <div className="flex items-center gap-3">
            <CurrencyIcon currency={activeBalance.currency} size="md" />
            <div className="flex-1">
              <p className="font-mono text-base font-bold text-[#E6EDF3]">
                {formatCurrency(activeBalance.available, activeBalance.currency, { showSymbol: false })}
              </p>
              <p className="text-xs text-[#8B949E]">{activeBalance.currency}</p>
            </div>
          </div>
        </div>
      )}

      {/* Available balances */}
      {fundedBalances.length > 1 && (
        <div className="border-b border-[#30363D]">
          <div className="px-4 py-2">
            <p className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider">
              Available balances
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {fundedBalances
              .filter((b) => b.currency !== activeBalance?.currency)
              .map((b) => (
                <button
                  key={b.currency}
                  onClick={() => {
                    onSelectCurrency(b.currency);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1C2128] transition-colors text-left"
                >
                  <CurrencyIcon currency={b.currency} size="sm" />
                  <span className="text-sm font-medium text-[#E6EDF3] flex-1">{b.currency}</span>
                  <span className="font-mono text-sm text-[#8B949E]">
                    {formatCurrency(b.available, b.currency, { showSymbol: false })}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* No funded balances */}
      {fundedBalances.length === 0 && (
        <div className="px-4 py-6 text-center border-b border-[#30363D]">
          <p className="text-sm text-[#8B949E]">No funded currencies</p>
          <p className="text-xs text-[#8B949E]/60 mt-1">Deposit to get started</p>
        </div>
      )}

      {/* Change balance display link */}
      <div className="px-4 py-2.5">
        <button
          onClick={() => {
            onOpenWallet();
            onClose();
          }}
          className="w-full text-center text-xs text-[#8B5CF6] hover:text-[#A78BFA] font-medium transition-colors"
        >
          Manage wallet
        </button>
      </div>
    </div>
  );
}
