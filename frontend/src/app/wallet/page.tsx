'use client';

import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  QrCode,
  Check,
  AlertTriangle,
  Clipboard,
  Clock,
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
    balance: 0.05,
    usdPrice: 43250.0,
    networks: [{ id: 'bitcoin', name: 'Bitcoin', confirmations: 3, minDeposit: '0.0001' }],
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    color: '#627EEA',
    balance: 1.2,
    usdPrice: 2280.0,
    networks: [{ id: 'erc20', name: 'Ethereum (ERC-20)', confirmations: 12, minDeposit: '0.005' }],
    address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    color: '#26A17B',
    balance: 500,
    usdPrice: 1.0,
    networks: [
      { id: 'erc20', name: 'Ethereum (ERC-20)', confirmations: 12, minDeposit: '10' },
      { id: 'trc20', name: 'TRON (TRC-20)', confirmations: 20, minDeposit: '1' },
    ],
    address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-[rgba(48,224,0,0.1)] text-[#30E000]">
        <Check className="w-3 h-3" />
        {status}
      </span>
    );
  }
  if (status === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-[rgba(255,214,0,0.12)] text-[#FFD600]">
        <Clock className="w-3 h-3" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-[rgba(255,73,74,0.1)] text-[#FF494A]">
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

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 bg-[#0F0F12] min-h-screen">
      {/* Total Balance Header */}
      <div className="text-center py-8">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-sm text-[rgba(224,232,255,0.6)] uppercase tracking-wide">Total Balance</span>
          <button
            onClick={() => setBalanceHidden(!balanceHidden)}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            {balanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-4xl font-bold font-mono text-white mb-1">
          {balanceHidden ? '******' : `$${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
            className={`relative px-5 h-[44px] text-sm font-medium transition-colors ${
              activeSection === tab.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {activeSection === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8D52DA]" />
            )}
          </button>
        ))}
      </div>

      {/* Currency Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
        {CURRENCIES.map((c) => (
          <button
            key={c.symbol}
            onClick={() => handleSelectCurrency(c.symbol)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              selectedCurrency === c.symbol
                ? 'bg-[#222328] border border-[rgba(255,255,255,0.06)] text-white'
                : 'bg-[#1A1B1F] border border-transparent text-[rgba(224,232,255,0.6)] hover:bg-[#222328] hover:text-white'
            }`}
          >
            <CurrencyIcon symbol={c.symbol} color={c.color} size={22} />
            {c.symbol}
          </button>
        ))}
      </div>

      {/* Deposit Section */}
      {activeSection === 'deposit' && (
        <div className="space-y-6">
          <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <CurrencyIcon symbol={currency.symbol} color={currency.color} size={40} />
              <div>
                <h2 className="text-lg font-semibold text-white">Deposit {currency.name}</h2>
                <p className="text-sm text-[rgba(224,232,255,0.6)]">{currency.symbol} - Send funds to the address below</p>
              </div>
            </div>

            {/* Network Selector */}
            {currency.networks.length > 1 && (
              <div className="mb-6">
                <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide">Select Network</label>
                <div className="flex flex-wrap gap-2">
                  {currency.networks.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setDepositNetwork(net.id)}
                      className={`px-4 py-3 rounded text-sm font-medium transition-all ${
                        (depositNetwork || currency.networks[0].id) === net.id
                          ? 'bg-[rgba(141,82,218,0.15)] border border-[#8D52DA] text-[#8D52DA]'
                          : 'bg-[#222328] border border-transparent text-[rgba(224,232,255,0.6)] hover:bg-[#2A2B30]'
                      }`}
                    >
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#1A1B1F] to-[#222328]">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded border-2 border-dashed border-[rgba(255,255,255,0.06)] flex flex-col items-center justify-center gap-2">
                  <QrCode className="w-10 h-10 md:w-12 md:h-12 text-gray-500" />
                  <span className="text-xs text-gray-600">QR Code</span>
                </div>
              </div>
            </div>

            {/* Wallet Address */}
            <div className="mb-5">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide">Wallet Address</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#222328] rounded px-4 py-3 font-mono text-sm text-white break-all select-all border border-[rgba(255,255,255,0.06)]">
                  <span className="block md:hidden">{currency.address.slice(0, 12)}...{currency.address.slice(-12)}</span>
                  <span className="hidden md:block">{currency.address}</span>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className={`p-3 rounded shrink-0 transition-all ${
                    addressCopied
                      ? 'bg-[rgba(48,224,0,0.15)] text-[#30E000]'
                      : 'bg-[#222328] hover:bg-[#2A2B30] text-gray-400 hover:text-white'
                  }`}
                >
                  {addressCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Deposit Info */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#222328] rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">Min Deposit</p>
                <p className="text-sm font-mono font-semibold text-white">
                  {currentNetwork?.minDeposit} {currency.symbol}
                </p>
              </div>
              <div className="bg-[#222328] rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">Confirmations</p>
                <p className="text-sm font-mono font-semibold text-white">
                  {currentNetwork?.confirmations} blocks
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-[rgba(255,214,0,0.08)] border border-[rgba(255,214,0,0.2)] rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#FFD600] shrink-0 mt-0.5" />
                <div className="text-sm text-[rgba(224,232,255,0.6)] leading-relaxed">
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
          <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <CurrencyIcon symbol={currency.symbol} color={currency.color} size={40} />
              <div>
                <h2 className="text-lg font-semibold text-white">Withdraw {currency.name}</h2>
                <p className="text-sm text-[rgba(224,232,255,0.6)]">
                  Available: <span className="font-mono text-white">{currency.balance} {currency.symbol}</span>
                </p>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-5">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-4 py-3 font-mono text-white pr-20 text-base focus:border-[#8D52DA] focus:ring-2 focus:ring-[rgba(141,82,218,0.25)] transition-all outline-none h-10"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={() => setWithdrawAmount(String(currency.balance))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-bold text-[#8D52DA] bg-[rgba(141,82,218,0.1)] hover:bg-[rgba(141,82,218,0.2)] rounded transition-colors"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 font-mono">
                ~ ${((parseFloat(withdrawAmount) || 0) * currency.usdPrice).toFixed(2)} USD
              </p>
            </div>

            {/* Address Input */}
            <div className="mb-5">
              <label className="text-xs text-[rgba(224,232,255,0.6)] mb-2 block uppercase tracking-wide">Recipient Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder={`Enter ${currency.symbol} address`}
                  className="w-full bg-[#222328] border border-[rgba(255,255,255,0.06)] rounded px-4 py-3 font-mono text-white pr-12 text-sm focus:border-[#8D52DA] focus:ring-2 focus:ring-[rgba(141,82,218,0.25)] transition-all outline-none h-10"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setWithdrawAddress(text);
                    } catch {}
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-white transition-colors"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Review Button */}
            <button
              disabled={!withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0}
              className={`w-full py-3 rounded text-sm font-bold transition-all ${
                !withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0
                  ? 'bg-[#222328] text-gray-600 cursor-not-allowed'
                  : 'bg-[#8D52DA] hover:opacity-90 text-white'
              }`}
            >
              Review Withdrawal
            </button>
          </div>
        </div>
      )}

      {/* History Section */}
      {activeSection === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {(['all', 'deposits', 'withdrawals'] as TxFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTxFilter(f)}
                className={`px-4 py-2.5 rounded text-sm font-medium capitalize transition-all whitespace-nowrap ${
                  txFilter === f
                    ? 'bg-[rgba(141,82,218,0.15)] text-[#8D52DA] border border-[rgba(141,82,218,0.3)]'
                    : 'bg-[#222328] text-[rgba(224,232,255,0.6)] border border-transparent hover:bg-[#2A2B30]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Transaction List */}
          <div className="space-y-2">
            {filteredTransactions.length === 0 ? (
              <div className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded-lg p-12 text-center">
                <Clock className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-500">No transactions found</p>
              </div>
            ) : (
              filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-[#1A1B1F] border border-[rgba(255,255,255,0.06)] rounded-lg p-4 hover:border-[rgba(255,255,255,0.1)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
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
                        <p className="text-sm font-semibold">
                          <span className={tx.type === 'deposit' ? 'text-[#30E000]' : 'text-[#FF494A]'}>
                            {tx.type === 'deposit' ? '+' : '-'}
                          </span>
                          <span className="font-mono ml-1">{tx.amount} {tx.currency}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(tx.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-gray-600 font-mono truncate">{truncateHash(tx.txHash)}</span>
                          <a
                            href="#"
                            className="text-gray-600 hover:text-[#8D52DA] transition-colors shrink-0"
                            title="View on explorer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                </div>
              ))
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
