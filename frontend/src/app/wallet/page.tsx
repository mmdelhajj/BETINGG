'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  QrCode,
  Check,
  AlertTriangle,
  Clipboard,
  Clock,
  ChevronDown,
} from 'lucide-react';

// Types
type ActiveSection = 'deposit' | 'withdraw' | 'swap' | 'history';
type TxFilter = 'all' | 'deposits' | 'withdrawals';
type TxStatus = 'Completed' | 'Pending' | 'Failed';

interface CurrencyInfo {
  symbol: string;
  name: string;
  color: string;
  balance: number;
  usdPrice: number;
  networks: { id: string; name: string; confirmations: number; minDeposit: string }[];
  address: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  currency: string;
  amount: string;
  status: TxStatus;
  date: string;
  txHash: string;
}

// Mock Data
const CURRENCIES: CurrencyInfo[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    color: '#F7931A',
    balance: 0.05234567,
    usdPrice: 43250.0,
    networks: [{ id: 'bitcoin', name: 'Bitcoin', confirmations: 3, minDeposit: '0.0001' }],
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    color: '#627EEA',
    balance: 1.234567,
    usdPrice: 2280.0,
    networks: [{ id: 'erc20', name: 'Ethereum (ERC-20)', confirmations: 12, minDeposit: '0.005' }],
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    color: '#26A17B',
    balance: 500.25,
    usdPrice: 1.0,
    networks: [
      { id: 'erc20', name: 'Ethereum (ERC-20)', confirmations: 12, minDeposit: '10' },
      { id: 'trc20', name: 'TRON (TRC-20)', confirmations: 20, minDeposit: '1' },
    ],
    address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    color: '#2775CA',
    balance: 1250.0,
    usdPrice: 1.0,
    networks: [{ id: 'erc20', name: 'Ethereum (ERC-20)', confirmations: 12, minDeposit: '10' }],
    address: '0x8E8F7E8A3C2B1D5E4F3A2B1C9D8E7F6A5B4C3D2E',
  },
  {
    symbol: 'BNB',
    name: 'Binance Coin',
    color: '#F3BA2F',
    balance: 2.5,
    usdPrice: 315.0,
    networks: [{ id: 'bsc', name: 'BNB Smart Chain', confirmations: 15, minDeposit: '0.01' }],
    address: 'bnb1xzy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'deposit',
    currency: 'BTC',
    amount: '0.025',
    status: 'Completed',
    date: '2026-02-11T14:30:00Z',
    txHash: '3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
  },
  {
    id: '2',
    type: 'withdrawal',
    currency: 'ETH',
    amount: '0.5',
    status: 'Completed',
    date: '2026-02-10T09:15:00Z',
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  },
  {
    id: '3',
    type: 'deposit',
    currency: 'USDT',
    amount: '250.00',
    status: 'Pending',
    date: '2026-02-12T08:45:00Z',
    txHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
  },
  {
    id: '4',
    type: 'withdrawal',
    currency: 'BTC',
    amount: '0.01',
    status: 'Failed',
    date: '2026-02-09T16:20:00Z',
    txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
  },
];

// Helpers
function getTotalUSD(): number {
  return CURRENCIES.reduce((acc, c) => acc + c.balance * c.usdPrice, 0);
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function CurrencyIcon({ symbol, color, size = 32 }: { symbol: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.35 }}
    >
      {symbol.length > 3 ? symbol.slice(0, 2) : symbol}
    </div>
  );
}

function StatusBadge({ status }: { status: TxStatus }) {
  if (status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[rgba(48,224,0,0.1)] text-[#30E000]">
        <Check className="w-3 h-3" />
        {status}
      </span>
    );
  }
  if (status === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[rgba(255,214,0,0.12)] text-[#FFD600]">
        <Clock className="w-3 h-3" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[rgba(255,73,74,0.1)] text-[#FF494A]">
      <AlertTriangle className="w-3 h-3" />
      {status}
    </span>
  );
}

export default function WalletPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('deposit');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('BTC');
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  const [depositNetwork, setDepositNetwork] = useState<string>('');
  const [addressCopied, setAddressCopied] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');

  const [swapFromCurrency, setSwapFromCurrency] = useState('BTC');
  const [swapToCurrency, setSwapToCurrency] = useState('ETH');
  const [swapAmount, setSwapAmount] = useState('');

  const currency = CURRENCIES.find((c) => c.symbol === selectedCurrency)!;
  const totalUSD = getTotalUSD();

  const currentNetwork =
    depositNetwork
      ? currency.networks.find((n) => n.id === depositNetwork)
      : currency.networks[0];

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(currency.address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  const handleSelectCurrency = (symbol: string) => {
    setSelectedCurrency(symbol);
    setDepositNetwork('');
    setAddressCopied(false);
    const curr = CURRENCIES.find((c) => c.symbol === symbol);
    if (curr && curr.networks.length > 0) {
      setDepositNetwork(curr.networks[0].id);
    }
  };

  const filteredTransactions = MOCK_TRANSACTIONS.filter((tx) => {
    if (txFilter === 'all') return true;
    if (txFilter === 'deposits') return tx.type === 'deposit';
    return tx.type === 'withdrawal';
  });

  const swapFromCurrencyData = CURRENCIES.find((c) => c.symbol === swapFromCurrency)!;
  const swapToCurrencyData = CURRENCIES.find((c) => c.symbol === swapToCurrency)!;
  const swapRate = swapFromCurrencyData && swapToCurrencyData
    ? (swapFromCurrencyData.usdPrice / swapToCurrencyData.usdPrice).toFixed(6)
    : '0';
  const swapReceiveAmount = swapAmount
    ? (parseFloat(swapAmount) * parseFloat(swapRate)).toFixed(8)
    : '0';

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20 bg-[#0F0F12] min-h-screen">
      {/* Balance Card */}
      <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded-lg p-6 mb-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-[rgba(224,232,255,0.6)] uppercase tracking-wide font-medium">Total Balance</span>
          <button
            onClick={() => setBalanceHidden(!balanceHidden)}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 hover:bg-[rgba(255,255,255,0.05)] rounded"
          >
            {balanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="text-5xl font-bold font-mono text-white">
            {balanceHidden ? '********' : `$${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CURRENCIES.slice(0, 3).map((c) => (
            <div key={c.symbol} className="bg-[#222328] rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <CurrencyIcon symbol={c.symbol} color={c.color} size={20} />
                <span className="text-xs text-[rgba(224,232,255,0.6)] font-medium">{c.symbol}</span>
              </div>
              <p className="text-sm font-mono font-semibold text-white truncate">
                {balanceHidden ? '****' : c.balance.toFixed(c.symbol === 'BTC' ? 8 : 2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Action Tabs */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)] mb-6">
        {[
          { key: 'deposit', label: 'Deposit' },
          { key: 'withdraw', label: 'Withdraw' },
          { key: 'swap', label: 'Swap' },
          { key: 'history', label: 'History' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as ActiveSection)}
            className={`relative px-6 h-[44px] text-sm font-semibold transition-colors ${
              activeSection === tab.key ? 'text-white' : 'text-[rgba(224,232,255,0.6)] hover:text-white'
            }`}
          >
            {tab.label}
            {activeSection === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8D52DA]" />
            )}
          </button>
        ))}
      </div>

      {/* Currency Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
        {CURRENCIES.map((c) => (
          <button
            key={c.symbol}
            onClick={() => handleSelectCurrency(c.symbol)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
              selectedCurrency === c.symbol
                ? 'bg-[rgba(141,82,218,0.15)] border border-[#8D52DA] text-white'
                : 'bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] text-[rgba(224,232,255,0.6)] hover:bg-[#222328] hover:text-white'
            }`}
          >
            <CurrencyIcon symbol={c.symbol} color={c.color} size={24} />
            <span>{c.symbol}</span>
            <span className="text-xs opacity-70">{c.balance.toFixed(c.symbol === 'BTC' || c.symbol === 'ETH' ? 4 : 2)}</span>
          </button>
        ))}
      </div>

      {/* Deposit Section */}
      {activeSection === 'deposit' && (
        <div className="space-y-6">
          <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded p-6">
            <div className="flex items-center gap-3 mb-6">
              <CurrencyIcon symbol={currency.symbol} color={currency.color} size={48} />
              <div>
                <h2 className="text-xl font-bold text-white mb-0.5">Deposit {currency.name}</h2>
                <p className="text-sm text-[rgba(224,232,255,0.6)]">Send {currency.symbol} to the address below</p>
              </div>
            </div>

            {/* Network Selector */}
            {currency.networks.length > 1 && (
              <div className="mb-6">
                <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide font-semibold">Select Network</label>
                <div className="flex flex-wrap gap-2">
                  {currency.networks.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setDepositNetwork(net.id)}
                      className={`px-4 h-[44px] rounded text-sm font-semibold transition-all ${
                        (depositNetwork || currency.networks[0].id) === net.id
                          ? 'bg-[rgba(141,82,218,0.15)] border border-[#8D52DA] text-[#8D52DA]'
                          : 'bg-[#222328] border border-[rgba(255,255,255,0.06)] text-[rgba(224,232,255,0.6)] hover:bg-[#2A2B30] hover:text-white'
                      }`}
                    >
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currency.networks.length === 1 && (
              <div className="mb-6">
                <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide font-semibold">Network</label>
                <div className="bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-4 h-[44px] flex items-center text-sm text-white font-semibold">
                  {currency.networks[0].name}
                </div>
              </div>
            )}

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-lg flex items-center justify-center bg-white p-3">
                <div className="w-full h-full rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2">
                  <QrCode className="w-12 h-12 md:w-16 md:h-16 text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium">QR Code</span>
                </div>
              </div>
            </div>

            {/* Wallet Address */}
            <div className="mb-6">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide font-semibold">Wallet Address</label>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 bg-[#222328] rounded px-4 py-3 font-mono text-sm text-white select-all border border-[rgba(255,255,255,0.06)] flex items-center overflow-hidden">
                  <span className="block md:hidden truncate">{currency.address.slice(0, 16)}...{currency.address.slice(-16)}</span>
                  <span className="hidden md:block break-all">{currency.address}</span>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className={`w-[44px] h-[44px] rounded shrink-0 transition-all flex items-center justify-center ${
                    addressCopied
                      ? 'bg-[rgba(48,224,0,0.15)] text-[#30E000] border border-[#30E000]'
                      : 'bg-[#222328] hover:bg-[#2A2B30] text-gray-400 hover:text-white border border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  {addressCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Deposit Info */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#222328] rounded p-4">
                <p className="text-xs text-[rgba(224,232,255,0.5)] mb-1 uppercase tracking-wide font-medium">Min Deposit</p>
                <p className="text-base font-mono font-bold text-white">
                  {currentNetwork?.minDeposit} {currency.symbol}
                </p>
              </div>
              <div className="bg-[#222328] rounded p-4">
                <p className="text-xs text-[rgba(224,232,255,0.5)] mb-1 uppercase tracking-wide font-medium">Confirmations</p>
                <p className="text-base font-mono font-bold text-white">
                  {currentNetwork?.confirmations} blocks
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-[rgba(255,214,0,0.08)] border border-[rgba(255,214,0,0.2)] rounded p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#FFD600] shrink-0 mt-0.5" />
                <div className="text-sm text-[rgba(224,232,255,0.85)] leading-relaxed">
                  Only send <span className="font-bold text-white">{currency.symbol}</span> on the{' '}
                  <span className="font-bold text-white">{currentNetwork?.name}</span> network to this address.
                  Sending any other asset or using a different network may result in permanent loss of funds.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Section */}
      {activeSection === 'withdraw' && (
        <div className="space-y-6">
          <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded p-6">
            <div className="flex items-center gap-3 mb-6">
              <CurrencyIcon symbol={currency.symbol} color={currency.color} size={48} />
              <div>
                <h2 className="text-xl font-bold text-white mb-0.5">Withdraw {currency.name}</h2>
                <p className="text-sm text-[rgba(224,232,255,0.6)]">
                  Available: <span className="font-mono text-white font-semibold">{currency.balance} {currency.symbol}</span>
                </p>
              </div>
            </div>

            {/* Recipient Address */}
            <div className="mb-5">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide font-semibold">Recipient Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder={`Enter ${currency.symbol} address`}
                  className="w-full bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-4 h-[44px] font-mono text-white pr-12 text-sm focus:border-[#8D52DA] focus:ring-2 focus:ring-[rgba(141,82,218,0.25)] transition-all outline-none"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setWithdrawAddress(text);
                    } catch {}
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-[40px] h-[40px] flex items-center justify-center text-gray-500 hover:text-white hover:bg-[rgba(255,255,255,0.05)] rounded transition-colors"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide font-semibold">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-4 h-[44px] font-mono text-white pr-20 text-base focus:border-[#8D52DA] focus:ring-2 focus:ring-[rgba(141,82,218,0.25)] transition-all outline-none"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={() => setWithdrawAmount(String(currency.balance))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 h-[36px] text-xs font-bold text-[#8D52DA] bg-[rgba(141,82,218,0.15)] hover:bg-[rgba(141,82,218,0.25)] rounded transition-colors"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-[rgba(224,232,255,0.5)] mt-2 font-mono">
                ≈ ${((parseFloat(withdrawAmount) || 0) * currency.usdPrice).toFixed(2)} USD
              </p>
            </div>

            {/* Fee Display */}
            <div className="bg-[#222328] rounded p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgba(224,232,255,0.6)]">Network Fee</span>
                <span className="font-mono font-semibold text-white">~0.0001 {currency.symbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                <span className="text-[rgba(224,232,255,0.6)]">You will receive</span>
                <span className="font-mono font-bold text-white">
                  {withdrawAmount ? (parseFloat(withdrawAmount) - 0.0001).toFixed(8) : '0.00'} {currency.symbol}
                </span>
              </div>
            </div>

            {/* Withdraw Button */}
            <button
              disabled={!withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0}
              className={`w-full h-[44px] rounded text-base font-bold transition-all ${
                !withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0
                  ? 'bg-[#222328] text-gray-600 cursor-not-allowed'
                  : 'bg-[#8D52DA] hover:bg-[#7A3FC7] text-white'
              }`}
            >
              Review Withdrawal
            </button>
          </div>
        </div>
      )}

      {/* Swap Section */}
      {activeSection === 'swap' && (
        <div className="space-y-6">
          <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[rgba(141,82,218,0.15)] flex items-center justify-center">
                <ArrowLeftRight className="w-6 h-6 text-[#8D52DA]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-0.5">Swap Crypto</h2>
                <p className="text-sm text-[rgba(224,232,255,0.6)]">Exchange one currency for another</p>
              </div>
            </div>

            {/* From Currency */}
            <div className="mb-4">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide font-semibold">From</label>
              <div className="bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="relative">
                    <select
                      value={swapFromCurrency}
                      onChange={(e) => setSwapFromCurrency(e.target.value)}
                      className="appearance-none bg-transparent text-white font-semibold text-base pr-8 outline-none cursor-pointer"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.symbol} value={c.symbol} className="bg-[#1A1B1F]">
                          {c.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CurrencyIcon symbol={swapFromCurrency} color={swapFromCurrencyData.color} size={28} />
                  </div>
                </div>
                <input
                  type="text"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent text-white font-mono text-2xl outline-none"
                  style={{ fontSize: '24px' }}
                />
                <p className="text-xs text-[rgba(224,232,255,0.5)] mt-2">
                  Balance: {swapFromCurrencyData.balance} {swapFromCurrency}
                </p>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={() => {
                  const temp = swapFromCurrency;
                  setSwapFromCurrency(swapToCurrency);
                  setSwapToCurrency(temp);
                }}
                className="w-[44px] h-[44px] rounded-full bg-[#8D52DA] hover:bg-[#7A3FC7] text-white flex items-center justify-center transition-all shadow-lg"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
            </div>

            {/* To Currency */}
            <div className="mb-6">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide font-semibold">To</label>
              <div className="bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="relative">
                    <select
                      value={swapToCurrency}
                      onChange={(e) => setSwapToCurrency(e.target.value)}
                      className="appearance-none bg-transparent text-white font-semibold text-base pr-8 outline-none cursor-pointer"
                    >
                      {CURRENCIES.filter((c) => c.symbol !== swapFromCurrency).map((c) => (
                        <option key={c.symbol} value={c.symbol} className="bg-[#1A1B1F]">
                          {c.symbol}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <CurrencyIcon symbol={swapToCurrency} color={swapToCurrencyData.color} size={28} />
                  </div>
                </div>
                <div className="w-full text-white font-mono text-2xl">
                  {swapReceiveAmount}
                </div>
                <p className="text-xs text-[rgba(224,232,255,0.5)] mt-2">
                  Balance: {swapToCurrencyData.balance} {swapToCurrency}
                </p>
              </div>
            </div>

            {/* Rate Display */}
            <div className="bg-[#222328] rounded p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgba(224,232,255,0.6)]">Exchange Rate</span>
                <span className="font-mono font-semibold text-white">
                  1 {swapFromCurrency} = {swapRate} {swapToCurrency}
                </span>
              </div>
            </div>

            {/* Swap Button */}
            <button
              disabled={!swapAmount || parseFloat(swapAmount) <= 0}
              className={`w-full h-[44px] rounded text-base font-bold transition-all ${
                !swapAmount || parseFloat(swapAmount) <= 0
                  ? 'bg-[#222328] text-gray-600 cursor-not-allowed'
                  : 'bg-[#8D52DA] hover:bg-[#7A3FC7] text-white'
              }`}
            >
              Swap {swapFromCurrency} for {swapToCurrency}
            </button>
          </div>
        </div>
      )}

      {/* History Section */}
      {activeSection === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {(['all', 'deposits', 'withdrawals'] as TxFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTxFilter(f)}
                className={`px-5 h-[44px] rounded text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                  txFilter === f
                    ? 'bg-[rgba(141,82,218,0.15)] text-[#8D52DA] border border-[#8D52DA]'
                    : 'bg-[#222328] text-[rgba(224,232,255,0.6)] border border-[rgba(255,255,255,0.06)] hover:bg-[#2A2B30] hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Transaction List */}
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded p-12 text-center">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-500 font-medium">No transactions found</p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const txCurrency = CURRENCIES.find((c) => c.symbol === tx.currency);
                return (
                  <div
                    key={tx.id}
                    className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded p-4 hover:border-[rgba(255,255,255,0.12)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                            tx.type === 'deposit' ? 'bg-[rgba(48,224,0,0.15)]' : 'bg-[rgba(255,73,74,0.15)]'
                          }`}
                        >
                          {tx.type === 'deposit' ? (
                            <ArrowDown className="w-5 h-5 text-[#30E000]" />
                          ) : (
                            <ArrowUp className="w-5 h-5 text-[#FF494A]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {txCurrency && <CurrencyIcon symbol={txCurrency.symbol} color={txCurrency.color} size={20} />}
                            <span className="font-semibold text-white capitalize">{tx.type}</span>
                          </div>
                          <p className="text-base font-mono font-bold mb-1">
                            <span className={tx.type === 'deposit' ? 'text-[#30E000]' : 'text-[#FF494A]'}>
                              {tx.type === 'deposit' ? '+' : '-'}
                            </span>
                            <span className="text-white ml-1">{tx.amount} {tx.currency}</span>
                          </p>
                          <p className="text-xs text-[rgba(224,232,255,0.5)] mb-2">
                            {new Date(tx.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-mono">{truncateHash(tx.txHash)}</span>
                            <a
                              href="#"
                              className="text-gray-600 hover:text-[#8D52DA] transition-colors shrink-0"
                              title="View on explorer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
