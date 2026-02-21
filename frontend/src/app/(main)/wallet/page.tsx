'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Copy,
  Check,
  ChevronDown,
  Search,
  Filter,
  ExternalLink,
  QrCode,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn, formatCurrency, copyToClipboard, shortenAddress } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

type WalletTab = 'portfolio' | 'deposit' | 'withdraw' | 'swap' | 'history';

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

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', type: 'deposit', currency: 'BTC', amount: 0.05, usdValue: 3076.50, status: 'confirmed', txHash: '0xabc123...def456', createdAt: new Date(Date.now() - 3600000).toISOString(), confirmations: 6, requiredConfirmations: 3 },
  { id: 'tx-2', type: 'withdrawal', currency: 'USDT', amount: 500, usdValue: 500, status: 'processing', address: 'TLXx8pMjVqWbGphF4WfkRsQRXBz3Mm1sNA', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'tx-3', type: 'win', currency: 'ETH', amount: 0.25, usdValue: 815.75, status: 'confirmed', createdAt: new Date(Date.now() - 14400000).toISOString() },
  { id: 'tx-4', type: 'bet', currency: 'USDT', amount: 100, usdValue: 100, status: 'confirmed', createdAt: new Date(Date.now() - 28800000).toISOString() },
  { id: 'tx-5', type: 'swap', currency: 'BTC', amount: 0.01, usdValue: 615.30, status: 'confirmed', createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: 'tx-6', type: 'deposit', currency: 'SOL', amount: 10, usdValue: 1496.50, status: 'pending', txHash: '0x789abc...123def', createdAt: new Date(Date.now() - 1800000).toISOString(), confirmations: 0, requiredConfirmations: 1 },
  { id: 'tx-7', type: 'bonus', currency: 'USDT', amount: 25, usdValue: 25, status: 'confirmed', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'tx-8', type: 'withdrawal', currency: 'ETH', amount: 0.5, usdValue: 1631.50, status: 'failed', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08', createdAt: new Date(Date.now() - 172800000).toISOString() },
];

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CurrencyIcon({ currency, className }: { currency: string; className?: string }) {
  const colors: Record<string, string> = {
    BTC: 'bg-orange-500/20 text-orange-400',
    ETH: 'bg-blue-500/20 text-blue-400',
    USDT: 'bg-emerald-500/20 text-emerald-400',
    USDC: 'bg-blue-400/20 text-blue-300',
    SOL: 'bg-purple-500/20 text-purple-400',
    DOGE: 'bg-yellow-500/20 text-yellow-400',
    LTC: 'bg-gray-400/20 text-gray-300',
    XRP: 'bg-slate-400/20 text-slate-300',
  };

  return (
    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm', colors[currency] || 'bg-[#1C2128] text-[#8B949E]', className)}>
      {(currency || 'C').charAt(0)}
    </div>
  );
}

function StatusBadge({ status }: { status: Transaction['status'] }) {
  const config = {
    confirmed: { variant: 'success' as const, icon: CheckCircle2, label: 'Confirmed' },
    pending: { variant: 'warning' as const, icon: Clock, label: 'Pending' },
    processing: { variant: 'info' as const, icon: Loader2, label: 'Processing' },
    failed: { variant: 'danger' as const, icon: XCircle, label: 'Failed' },
  };
  const c = config[status];
  return (
    <Badge variant={c.variant} size="sm" dot pulse={status === 'pending' || status === 'processing'}>
      {c.label}
    </Badge>
  );
}

function TypeBadge({ type }: { type: Transaction['type'] }) {
  const config: Record<string, { color: string; label: string }> = {
    deposit: { color: 'text-[#10B981]', label: 'Deposit' },
    withdrawal: { color: 'text-[#EF4444]', label: 'Withdrawal' },
    swap: { color: 'text-[#8B5CF6]', label: 'Swap' },
    bet: { color: 'text-[#F59E0B]', label: 'Bet' },
    win: { color: 'text-[#10B981]', label: 'Win' },
    bonus: { color: 'text-[#8B5CF6]', label: 'Bonus' },
  };
  const c = config[type] || { color: 'text-[#8B949E]', label: type };
  return <span className={cn('text-xs font-medium capitalize', c.color)}>{c.label}</span>;
}

// ---------------------------------------------------------------------------
// Portfolio Section
// ---------------------------------------------------------------------------

function PortfolioSection({ wallets, hideBalances }: { wallets: CryptoWallet[]; hideBalances: boolean }) {
  const totalUsd = useMemo(() => wallets.reduce((sum, w) => sum + w.usdValue, 0), [wallets]);
  const totalChange = useMemo(() => {
    const weighted = totalUsd > 0 ? wallets.reduce((sum, w) => sum + w.change24h * (w.usdValue / totalUsd), 0) : 0;
    return isNaN(weighted) ? 0 : weighted;
  }, [wallets, totalUsd]);

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Total balance card */}
      <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-[#8B5CF6]/10 via-[#161B22] to-[#10B981]/5 border border-[#30363D] p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <p className="text-sm text-[#8B949E] mb-1">Total Portfolio Value</p>
          <div className="flex items-end gap-3 mb-2">
            <h2 className="text-4xl font-bold font-mono text-[#E6EDF3]">
              {hideBalances ? '********' : `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h2>
            <div className={cn('flex items-center gap-1 text-sm font-medium pb-1', totalChange >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
              {totalChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Math.abs(totalChange).toFixed(2)}%
            </div>
          </div>
          <p className="text-xs text-[#8B949E]">24h change</p>
        </div>
      </div>

      {/* Wallet list */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
        {wallets.map((wallet) => (
          <motion.div
            key={wallet.currency}
            variants={staggerItem}
            className="flex items-center justify-between p-4 bg-[#161B22] border border-[#30363D] rounded-card hover:border-[#8B5CF6]/20 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <CurrencyIcon currency={wallet.currency} />
              <div>
                <p className="font-semibold text-[#E6EDF3] text-sm">{wallet.name}</p>
                <p className="text-xs text-[#8B949E]">{wallet.currency}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold text-[#E6EDF3] text-sm">
                {hideBalances ? '***' : formatCurrency(wallet.available, wallet.currency)}
              </p>
              <div className="flex items-center gap-2 justify-end">
                <p className="text-xs text-[#8B949E] font-mono">
                  {hideBalances ? '***' : `$${wallet.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                </p>
                <span className={cn('text-[10px] font-mono', wallet.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
                  {wallet.change24h >= 0 ? '+' : ''}{wallet.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Deposit Section
// ---------------------------------------------------------------------------

function DepositSection({ wallets }: { wallets: CryptoWallet[] }) {
  const [selectedCurrency, setSelectedCurrency] = useState('BTC');
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedWallet = wallets.find((w) => w.currency === selectedCurrency) || wallets?.[0];

  const handleCopy = async () => {
    if (!selectedWallet) return;
    const success = await copyToClipboard(selectedWallet.depositAddress);
    if (success) {
      setCopied(true);
      toastSuccess('Address copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toastError('Failed to copy address');
    }
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Currency selector */}
      <div>
        <label className="block text-sm font-medium text-[#8B949E] mb-2">Select Currency</label>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center justify-between p-3 bg-[#161B22] border border-[#30363D] rounded-card hover:border-[#8B5CF6]/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CurrencyIcon currency={selectedCurrency} className="w-8 h-8 text-xs" />
              <div className="text-left">
                <p className="text-sm font-semibold text-[#E6EDF3]">{selectedWallet?.name}</p>
                <p className="text-xs text-[#8B949E]">{selectedCurrency}</p>
              </div>
            </div>
            <ChevronDown className={cn('w-5 h-5 text-[#8B949E] transition-transform', showDropdown && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute z-20 top-full mt-1 w-full bg-[#161B22] border border-[#30363D] rounded-card shadow-xl overflow-hidden max-h-60 overflow-y-auto"
              >
                {wallets.map((w) => (
                  <button
                    key={w.currency}
                    onClick={() => { setSelectedCurrency(w.currency); setShowDropdown(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 hover:bg-[#1C2128] transition-colors text-left',
                      w.currency === selectedCurrency && 'bg-[#8B5CF6]/10'
                    )}
                  >
                    <CurrencyIcon currency={w.currency} className="w-8 h-8 text-xs" />
                    <div>
                      <p className="text-sm font-semibold text-[#E6EDF3]">{w.name}</p>
                      <p className="text-xs text-[#8B949E]">{w.currency}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Network selector */}
      {(selectedWallet?.networks?.length ?? 0) > 1 && (
        <div>
          <label className="block text-sm font-medium text-[#8B949E] mb-2">Network</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(selectedWallet?.networks ?? []).map((net) => (
              <button
                key={net.id}
                className="p-3 bg-[#161B22] border border-[#30363D] rounded-card hover:border-[#8B5CF6]/30 text-left transition-colors focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30"
              >
                <p className="text-sm font-medium text-[#E6EDF3]">{net.name}</p>
                <p className="text-xs text-[#8B949E]">{net.confirmations} confirmations required</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR Code + Address */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-6 text-center space-y-4">
        {/* QR Code Placeholder */}
        <div className="mx-auto w-48 h-48 bg-white rounded-lg flex items-center justify-center">
          <div className="text-center">
            <QrCode className="w-24 h-24 text-[#0D1117] mx-auto mb-2" />
            <p className="text-[10px] text-[#0D1117]/50 font-mono">{selectedCurrency} QR</p>
          </div>
        </div>

        {/* Address */}
        <div>
          <p className="text-xs text-[#8B949E] mb-2">Deposit Address</p>
          <div className="flex items-center gap-2 bg-[#0D1117] border border-[#30363D] rounded-card p-3">
            <p className="flex-1 text-sm font-mono text-[#E6EDF3] break-all">{selectedWallet?.depositAddress}</p>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2 hover:bg-[#1C2128] rounded-button transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4 text-[#8B949E]" />}
            </button>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-card p-3 text-left">
          <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="text-xs text-[#F59E0B]/80">
            Only send {selectedWallet?.name} ({selectedCurrency}) to this address. Sending other assets may result in permanent loss.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Withdraw Section
// ---------------------------------------------------------------------------

function WithdrawSection({ wallets }: { wallets: CryptoWallet[] }) {
  const [selectedCurrency, setSelectedCurrency] = useState('BTC');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedWallet = wallets.find((w) => w.currency === selectedCurrency) || wallets?.[0];
  const activeNetwork = selectedWallet?.networks?.find((n) => n.id === selectedNetwork) || selectedWallet?.networks?.[0];

  useEffect(() => {
    setSelectedNetwork(selectedWallet?.networks?.[0]?.id || '');
  }, [selectedCurrency, selectedWallet?.networks]);

  const estimatedReceive = parseFloat(amount || '0') - (activeNetwork?.fee || 0);

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">
      {/* Currency selector */}
      <div>
        <label className="block text-sm font-medium text-[#8B949E] mb-2">Select Currency</label>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center justify-between p-3 bg-[#161B22] border border-[#30363D] rounded-card hover:border-[#8B5CF6]/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CurrencyIcon currency={selectedCurrency} className="w-8 h-8 text-xs" />
              <div className="text-left">
                <p className="text-sm font-semibold text-[#E6EDF3]">{selectedWallet?.name}</p>
                <p className="text-xs text-[#8B949E]">Available: {formatCurrency(selectedWallet?.available ?? 0, selectedCurrency)}</p>
              </div>
            </div>
            <ChevronDown className={cn('w-5 h-5 text-[#8B949E] transition-transform', showDropdown && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute z-20 top-full mt-1 w-full bg-[#161B22] border border-[#30363D] rounded-card shadow-xl overflow-hidden max-h-60 overflow-y-auto"
              >
                {wallets.map((w) => (
                  <button
                    key={w.currency}
                    onClick={() => { setSelectedCurrency(w.currency); setShowDropdown(false); }}
                    className={cn('w-full flex items-center gap-3 p-3 hover:bg-[#1C2128] transition-colors text-left', w.currency === selectedCurrency && 'bg-[#8B5CF6]/10')}
                  >
                    <CurrencyIcon currency={w.currency} className="w-8 h-8 text-xs" />
                    <div>
                      <p className="text-sm font-semibold text-[#E6EDF3]">{w.name}</p>
                      <p className="text-xs text-[#8B949E]">Balance: {formatCurrency(w.available, w.currency)}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Network */}
      <div>
        <label className="block text-sm font-medium text-[#8B949E] mb-2">Network</label>
        <div className="flex flex-wrap gap-2">
          {(selectedWallet?.networks ?? []).map((net) => (
            <button
              key={net.id}
              onClick={() => setSelectedNetwork(net.id)}
              className={cn(
                'px-4 py-2 rounded-button text-sm border transition-all',
                selectedNetwork === net.id
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:border-[#8B5CF6]/30'
              )}
            >
              {net.name}
            </button>
          ))}
        </div>
      </div>

      {/* Address */}
      <Input
        label="Withdrawal Address"
        placeholder={`Enter ${selectedCurrency} address`}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      {/* Amount */}
      <div>
        <Input
          label="Amount"
          placeholder="0.00"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          suffixText={selectedCurrency}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-[#8B949E]">
            Min: {formatCurrency(activeNetwork?.minWithdraw || 0, selectedCurrency)}
          </p>
          <button
            onClick={() => setAmount(String(selectedWallet?.available ?? 0))}
            className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
          >
            Max
          </button>
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Network Fee</span>
          <span className="font-mono text-[#E6EDF3]">{formatCurrency(activeNetwork?.fee || 0, selectedCurrency)}</span>
        </div>
        <div className="border-t border-[#30363D]" />
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">You Receive</span>
          <span className={cn('font-mono font-semibold', estimatedReceive > 0 ? 'text-[#10B981]' : 'text-[#EF4444]')}>
            {formatCurrency(Math.max(0, estimatedReceive), selectedCurrency)}
          </span>
        </div>
      </div>

      <Button variant="primary" fullWidth size="lg" disabled={!address || !amount || estimatedReceive <= 0}>
        <ArrowUpFromLine className="w-4 h-4" />
        Withdraw {selectedCurrency}
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Swap Section
// ---------------------------------------------------------------------------

function SwapSection({ wallets }: { wallets: CryptoWallet[] }) {
  const [fromCurrency, setFromCurrency] = useState('BTC');
  const [toCurrency, setToCurrency] = useState('USDT');
  const [fromAmount, setFromAmount] = useState('');
  const [showFromDD, setShowFromDD] = useState(false);
  const [showToDD, setShowToDD] = useState(false);

  const fromWallet = wallets.find((w) => w.currency === fromCurrency) || wallets?.[0];
  const toWallet = wallets.find((w) => w.currency === toCurrency) || (wallets?.[2] ?? wallets?.[0]);

  // Mock exchange rate
  const fromRate = fromWallet?.total ? fromWallet.usdValue / fromWallet.total : 0;
  const toRate = toWallet?.total ? toWallet.usdValue / toWallet.total : 0;
  const rate = toRate > 0 ? fromRate / toRate : 0;
  const toAmount = parseFloat(fromAmount || '0') * rate;

  const handleSwapDirection = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromAmount('');
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-4">
      {/* From */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8B949E]">From</span>
          <span className="text-xs text-[#8B949E]">
            Balance: <span className="font-mono">{formatCurrency(fromWallet?.available ?? 0, fromCurrency)}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => { setShowFromDD(!showFromDD); setShowToDD(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-[#0D1117] rounded-button hover:bg-[#1C2128] transition-colors"
            >
              <CurrencyIcon currency={fromCurrency} className="w-6 h-6 text-[10px]" />
              <span className="text-sm font-semibold text-[#E6EDF3]">{fromCurrency}</span>
              <ChevronDown className="w-3 h-3 text-[#8B949E]" />
            </button>
            <AnimatePresence>
              {showFromDD && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-30 top-full mt-1 w-48 bg-[#161B22] border border-[#30363D] rounded-card shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                >
                  {wallets.filter((w) => w.currency !== toCurrency).map((w) => (
                    <button
                      key={w.currency}
                      onClick={() => { setFromCurrency(w.currency); setShowFromDD(false); }}
                      className="w-full flex items-center gap-2 p-2 hover:bg-[#1C2128] text-left text-sm"
                    >
                      <CurrencyIcon currency={w.currency} className="w-6 h-6 text-[10px]" />
                      <span className="text-[#E6EDF3]">{w.currency}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <input
            type="number"
            placeholder="0.00"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            className="flex-1 bg-transparent text-right text-xl font-mono font-semibold text-[#E6EDF3] outline-none placeholder:text-[#30363D]"
          />
        </div>
        <button
          onClick={() => setFromAmount(String(fromWallet?.available ?? 0))}
          className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] transition-colors mt-2"
        >
          Use Max
        </button>
      </div>

      {/* Swap direction button */}
      <div className="flex justify-center -my-1">
        <motion.button
          onClick={handleSwapDirection}
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
          className="w-10 h-10 bg-[#8B5CF6] rounded-full flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20 hover:bg-[#7C3AED] transition-colors z-10"
        >
          <ArrowLeftRight className="w-4 h-4 text-white" />
        </motion.button>
      </div>

      {/* To */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#8B949E]">To</span>
          <span className="text-xs text-[#8B949E]">
            Balance: <span className="font-mono">{formatCurrency(toWallet?.available ?? 0, toCurrency)}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => { setShowToDD(!showToDD); setShowFromDD(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-[#0D1117] rounded-button hover:bg-[#1C2128] transition-colors"
            >
              <CurrencyIcon currency={toCurrency} className="w-6 h-6 text-[10px]" />
              <span className="text-sm font-semibold text-[#E6EDF3]">{toCurrency}</span>
              <ChevronDown className="w-3 h-3 text-[#8B949E]" />
            </button>
            <AnimatePresence>
              {showToDD && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-30 top-full mt-1 w-48 bg-[#161B22] border border-[#30363D] rounded-card shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                >
                  {wallets.filter((w) => w.currency !== fromCurrency).map((w) => (
                    <button
                      key={w.currency}
                      onClick={() => { setToCurrency(w.currency); setShowToDD(false); }}
                      className="w-full flex items-center gap-2 p-2 hover:bg-[#1C2128] text-left text-sm"
                    >
                      <CurrencyIcon currency={w.currency} className="w-6 h-6 text-[10px]" />
                      <span className="text-[#E6EDF3]">{w.currency}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 text-right text-xl font-mono font-semibold text-[#E6EDF3]">
            {toAmount > 0 ? formatCurrency(toAmount, toCurrency, { showSymbol: false }) : '0.00'}
          </div>
        </div>
      </div>

      {/* Rate */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Exchange Rate</span>
          <span className="font-mono text-[#E6EDF3]">1 {fromCurrency} = {rate.toFixed(6)} {toCurrency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Fee</span>
          <span className="font-mono text-[#E6EDF3]">0.1%</span>
        </div>
      </div>

      <Button variant="primary" fullWidth size="lg" disabled={!fromAmount || toAmount <= 0}>
        <ArrowLeftRight className="w-4 h-4" />
        Swap {fromCurrency} to {toCurrency}
      </Button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// History Section
// ---------------------------------------------------------------------------

function HistorySection({ transactions }: { transactions: Transaction[] }) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const types = ['all', 'deposit', 'withdrawal', 'swap', 'bet', 'win', 'bonus'];

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return tx.currency.toLowerCase().includes(q) || tx.type.toLowerCase().includes(q) || (tx.txHash && tx.txHash.toLowerCase().includes(q));
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefixIcon={<Search className="w-4 h-4" />}
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              'px-3 py-1.5 rounded-button text-xs font-medium capitalize transition-all',
              filterType === type
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-[#161B22] text-[#8B949E] border border-[#30363D] hover:border-[#8B5CF6]/30'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-card overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-6 gap-4 px-4 py-3 bg-[#0D1117] border-b border-[#30363D] text-xs font-medium text-[#8B949E]">
          <span>Type</span>
          <span>Currency</span>
          <span className="text-right">Amount</span>
          <span className="text-right">USD Value</span>
          <span>Status</span>
          <span className="text-right">Date</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[#8B949E] text-sm">No transactions found</div>
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            {filtered.map((tx) => (
              <motion.div
                key={tx.id}
                variants={staggerItem}
                className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 px-4 py-3 border-b border-[#30363D]/50 hover:bg-[#1C2128] transition-colors"
              >
                <div className="flex items-center">
                  <TypeBadge type={tx.type} />
                </div>
                <div className="flex items-center gap-2 justify-end md:justify-start">
                  <CurrencyIcon currency={tx.currency} className="w-6 h-6 text-[10px]" />
                  <span className="text-sm text-[#E6EDF3]">{tx.currency}</span>
                </div>
                <div className="text-right">
                  <span className={cn(
                    'font-mono text-sm font-medium',
                    ['deposit', 'win', 'bonus'].includes(tx.type) ? 'text-[#10B981]' : 'text-[#EF4444]'
                  )}>
                    {['deposit', 'win', 'bonus'].includes(tx.type) ? '+' : '-'}{formatCurrency(tx.amount, tx.currency, { showSymbol: false })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm text-[#8B949E]">${tx.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center">
                  <StatusBadge status={tx.status} />
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#8B949E]">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {tx.txHash && (
                    <button className="ml-1 inline-flex">
                      <ExternalLink className="w-3 h-3 text-[#8B949E] hover:text-[#8B5CF6]" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Wallet Page — now opens as a modal via the Header.
// This page auto-opens the WalletModal and shows a portfolio fallback.
// ---------------------------------------------------------------------------

export default function WalletPage() {
  const [hideBalances, setHideBalances] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Dynamically import WalletModal to avoid circular deps
  const WalletModal = React.lazy(() => import('@/components/layout/WalletModal'));

  useEffect(() => {
    // Auto-open wallet modal when this page is visited
    setWalletModalOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchWalletData() {
      setIsLoading(true);

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
        if (!cancelled && walletsRes?.wallets?.length) {
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
        // API unavailable, will fall back to mock data
      }

      if (!cancelled) {
        setWallets(apiWallets ?? MOCK_WALLETS);
        setIsLoading(false);
      }
    }

    fetchWalletData();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full rounded-card" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#E6EDF3]">Wallet</h1>
          <p className="text-sm text-[#8B949E]">Manage your crypto assets</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="p-2 hover:bg-[#161B22] rounded-button transition-colors text-[#8B949E] hover:text-[#E6EDF3]"
          >
            {hideBalances ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <Button variant="primary" size="sm" onClick={() => setWalletModalOpen(true)}>
            <ArrowDownToLine className="w-4 h-4" />
            Deposit / Withdraw
          </Button>
        </div>
      </motion.div>

      {/* Portfolio view (always shown on this page) */}
      <PortfolioSection wallets={wallets} hideBalances={hideBalances} />

      {/* Wallet Modal */}
      <React.Suspense fallback={null}>
        <WalletModal
          isOpen={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      </React.Suspense>
    </div>
  );
}
