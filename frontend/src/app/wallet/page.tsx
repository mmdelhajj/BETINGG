'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  QrCode,
  Check,
  AlertTriangle,
  ChevronDown,
  Clipboard,
  ArrowLeftRight,
  Clock,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
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

// ─── Mock Data ──────────────────────────────────────────────────────
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
      { id: 'bep20', name: 'BSC (BEP-20)', confirmations: 15, minDeposit: '5' },
      { id: 'solana', name: 'Solana (SPL)', confirmations: 1, minDeposit: '1' },
    ],
    address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    color: '#9945FF',
    balance: 10,
    usdPrice: 98.5,
    networks: [{ id: 'solana', name: 'Solana', confirmations: 1, minDeposit: '0.1' }],
    address: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
  },
  {
    symbol: 'LTC',
    name: 'Litecoin',
    color: '#BFBBBB',
    balance: 5,
    usdPrice: 68.4,
    networks: [{ id: 'litecoin', name: 'Litecoin', confirmations: 6, minDeposit: '0.01' }],
    address: 'ltc1qhw80dfq2kvtaruhfgestjdf539kc3eznaa8q8l',
  },
  {
    symbol: 'DOGE',
    name: 'Dogecoin',
    color: '#C2A633',
    balance: 1000,
    usdPrice: 0.082,
    networks: [{ id: 'dogecoin', name: 'Dogecoin', confirmations: 40, minDeposit: '10' }],
    address: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L',
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
    currency: 'SOL',
    amount: '5.0',
    status: 'Completed',
    date: '2026-02-09T18:22:00Z',
    txHash: '4rL4RCxwsYz7RdYFdExBv2kDSpqjCUqFvKhN6gFtV7jxzHb1ndBAPe6o2BoHck3h',
  },
  {
    id: '5',
    type: 'deposit',
    currency: 'DOGE',
    amount: '500',
    status: 'Failed',
    date: '2026-02-08T11:00:00Z',
    txHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  },
  {
    id: '6',
    type: 'withdrawal',
    currency: 'BTC',
    amount: '0.01',
    status: 'Pending',
    date: '2026-02-12T06:10:00Z',
    txHash: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────
function getTotalUSD(): number {
  return CURRENCIES.reduce((acc, c) => acc + c.balance * c.usdPrice, 0);
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

// ─── Sub-components ─────────────────────────────────────────────────

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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-accent-green/15 text-accent-green">
        <Check className="w-3 h-3" />
        {status}
      </span>
    );
  }
  if (status === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-accent-yellow/15 text-accent-yellow">
        <Clock className="w-3 h-3" />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-accent-red/15 text-accent-red">
      <AlertTriangle className="w-3 h-3" />
      {status}
    </span>
  );
}

function MiniSparkline({ color }: { color: string }) {
  // Generate a simple mock sparkline path
  const points = [40, 35, 45, 30, 50, 38, 55, 42, 48, 52, 46, 58];
  const width = 80;
  const height = 32;
  const maxVal = Math.max(...points);
  const minVal = Math.min(...points);
  const range = maxVal - minVal || 1;
  const step = width / (points.length - 1);

  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - minVal) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-50">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function WalletPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('deposit');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('BTC');
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  // Deposit
  const [depositNetwork, setDepositNetwork] = useState<string>('');
  const [addressCopied, setAddressCopied] = useState(false);

  // Withdraw
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState('');

  // Swap
  const [swapFrom, setSwapFrom] = useState('BTC');
  const [swapTo, setSwapTo] = useState('USDT');
  const [swapAmount, setSwapAmount] = useState('');

  const currency = CURRENCIES.find((c) => c.symbol === selectedCurrency)!;
  const totalUSD = getTotalUSD();
  const totalBTC = totalUSD / (CURRENCIES.find((c) => c.symbol === 'BTC')?.usdPrice || 43250);

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
      setWithdrawNetwork(curr.networks[0].id);
    }
  };

  const filteredTransactions = MOCK_TRANSACTIONS.filter((tx) => {
    if (txFilter === 'all') return true;
    if (txFilter === 'deposits') return tx.type === 'deposit';
    return tx.type === 'withdrawal';
  });

  const withdrawFee = selectedCurrency === 'BTC' ? '0.0005' : selectedCurrency === 'ETH' ? '0.005' : '1.00';
  const withdrawNetAmount = () => {
    const amt = parseFloat(withdrawAmount) || 0;
    const fee = parseFloat(withdrawFee) || 0;
    return Math.max(0, amt - fee).toFixed(selectedCurrency === 'BTC' ? 8 : 4);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pb-24 lg:pb-8">
      {/* ── Total Balance Header ─────────────────────────────────── */}
      <div className="text-center py-8">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-sm text-gray-400 uppercase tracking-wide">Total Balance</span>
          <button
            onClick={() => setBalanceHidden(!balanceHidden)}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {balanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-4xl font-bold font-mono text-white mb-1">
          {balanceHidden ? '******' : `$${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </div>
        <div className="text-sm text-gray-500 font-mono">
          {balanceHidden ? '****' : `${totalBTC.toFixed(6)} BTC`}
        </div>
      </div>

      {/* ── Action Buttons Row - 2-col grid on mobile, 4-col on desktop ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <button
          onClick={() => setActiveSection('deposit')}
          className={cn(
            'flex flex-col items-center gap-2 py-4 rounded-xl text-sm font-semibold transition-all min-h-[64px]',
            activeSection === 'deposit'
              ? 'bg-accent-green text-black shadow-lg'
              : 'bg-accent-green/15 text-accent-green hover:bg-accent-green/25'
          )}
        >
          <ArrowDown className="w-5 h-5" />
          Deposit
        </button>
        <button
          onClick={() => setActiveSection('withdraw')}
          className={cn(
            'flex flex-col items-center gap-2 py-4 rounded-xl text-sm font-semibold transition-all min-h-[64px]',
            activeSection === 'withdraw'
              ? 'bg-accent-orange text-black shadow-lg'
              : 'bg-accent-orange/15 text-accent-orange hover:bg-accent-orange/25'
          )}
        >
          <ArrowUp className="w-5 h-5" />
          Withdraw
        </button>
        <button
          onClick={() => setActiveSection('swap')}
          className={cn(
            'flex flex-col items-center gap-2 py-4 rounded-xl text-sm font-semibold transition-all min-h-[64px]',
            activeSection === 'swap'
              ? 'bg-brand-500 text-white shadow-lg'
              : 'bg-brand-500/15 text-brand-400 hover:bg-brand-500/25'
          )}
        >
          <ArrowLeftRight className="w-5 h-5" />
          Swap
        </button>
        <button
          onClick={() => setActiveSection('history')}
          className={cn(
            'flex flex-col items-center gap-2 py-4 rounded-xl text-sm font-semibold transition-all border min-h-[64px]',
            activeSection === 'history'
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-white/10 bg-transparent text-gray-400 hover:border-white/20 hover:text-gray-200'
          )}
        >
          <Clock className="w-5 h-5" />
          History
        </button>
      </div>

      {/* ── Currency Tabs - horizontal scroll ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {CURRENCIES.map((c) => (
          <button
            key={c.symbol}
            onClick={() => handleSelectCurrency(c.symbol)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 min-h-[44px]',
              selectedCurrency === c.symbol
                ? 'bg-surface-hover border border-white/15 text-white'
                : 'bg-surface-tertiary border border-transparent text-gray-400 hover:bg-surface-hover hover:text-gray-200'
            )}
          >
            <CurrencyIcon symbol={c.symbol} color={c.color} size={22} />
            {c.symbol}
          </button>
        ))}
      </div>

      {/* ── Deposit Section ──────────────────────────────────────── */}
      {activeSection === 'deposit' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-surface-secondary border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <CurrencyIcon symbol={currency.symbol} color={currency.color} size={40} />
              <div>
                <h2 className="text-lg font-semibold">Deposit {currency.name}</h2>
                <p className="text-sm text-gray-500">{currency.symbol} - Send funds to the address below</p>
              </div>
            </div>

            {/* Network Selector */}
            {currency.networks.length > 1 && (
              <div className="mb-6">
                <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Select Network</label>
                <div className="flex flex-wrap gap-2">
                  {currency.networks.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setDepositNetwork(net.id)}
                      className={cn(
                        'px-4 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]',
                        (depositNetwork || currency.networks[0].id) === net.id
                          ? 'bg-brand-500/20 border border-brand-500 text-brand-400'
                          : 'bg-surface-tertiary border border-transparent text-gray-300 hover:bg-surface-hover'
                      )}
                    >
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* QR Code - 128px on mobile, 192px on desktop */}
            <div className="flex justify-center mb-6">
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1A1B1F 0%, #2A2B30 50%, #1A1B1F 100%)' }}>
                <div className="w-28 h-28 md:w-40 md:h-40 rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
                  <QrCode className="w-10 h-10 md:w-12 md:h-12 text-gray-500" />
                  <span className="text-xs text-gray-600">QR Code</span>
                </div>
              </div>
            </div>

            {/* Wallet Address - truncated with copy button */}
            <div className="mb-5">
              <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Wallet Address</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface-deepest rounded-lg px-4 py-3 font-mono text-sm md:text-base text-white break-all select-all border border-border">
                  <span className="block md:hidden">{currency.address.slice(0, 12)}...{currency.address.slice(-12)}</span>
                  <span className="hidden md:block">{currency.address}</span>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className={cn(
                    'p-3 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0',
                    addressCopied
                      ? 'bg-accent-green/20 text-accent-green'
                      : 'bg-surface-tertiary hover:bg-surface-hover text-gray-400 hover:text-white'
                  )}
                >
                  {addressCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Deposit Info */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-surface-tertiary rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">Min Deposit</p>
                <p className="text-sm font-mono font-semibold text-white">
                  {currentNetwork?.minDeposit} {currency.symbol}
                </p>
              </div>
              <div className="bg-surface-tertiary rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">Confirmations</p>
                <p className="text-sm font-mono font-semibold text-white">
                  {currentNetwork?.confirmations} blocks
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-accent-yellow/8 border border-accent-yellow/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-accent-yellow shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300 leading-relaxed">
                  Only send <span className="font-bold text-white">{currency.symbol}</span> on the{' '}
                  <span className="font-bold text-white">{currentNetwork?.name}</span> network to this address.
                  Sending any other asset or using a different network may result in permanent loss of funds.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Withdraw Section ─────────────────────────────────────── */}
      {activeSection === 'withdraw' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-surface-secondary border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <CurrencyIcon symbol={currency.symbol} color={currency.color} size={40} />
              <div>
                <h2 className="text-lg font-semibold">Withdraw {currency.name}</h2>
                <p className="text-sm text-gray-500">
                  Available: <span className="font-mono text-white">{currency.balance} {currency.symbol}</span>
                </p>
              </div>
            </div>

            {/* Amount Input - 16px font minimum */}
            <div className="mb-5">
              <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-surface-deepest border border-border rounded-lg px-4 py-3 font-mono text-white pr-20 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition-all outline-none min-h-[44px]"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={() => setWithdrawAmount(String(currency.balance))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-bold text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 rounded transition-colors min-h-[32px]"
                >
                  MAX
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 font-mono">
                ~ ${((parseFloat(withdrawAmount) || 0) * currency.usdPrice).toFixed(2)} USD
              </p>
            </div>

            {/* Address Input - 16px font minimum */}
            <div className="mb-5">
              <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Recipient Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder={`Enter ${currency.symbol} address`}
                  className="w-full bg-surface-deepest border border-border rounded-lg px-4 py-3 font-mono text-white pr-12 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 transition-all outline-none min-h-[44px]"
                  style={{ fontSize: '16px' }}
                />
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setWithdrawAddress(text);
                    } catch {}
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Network Selector */}
            {currency.networks.length > 1 && (
              <div className="mb-5">
                <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">Network</label>
                <div className="flex flex-wrap gap-2">
                  {currency.networks.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setWithdrawNetwork(net.id)}
                      className={cn(
                        'px-4 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px]',
                        (withdrawNetwork || currency.networks[0].id) === net.id
                          ? 'bg-brand-500/20 border border-brand-500 text-brand-400'
                          : 'bg-surface-tertiary border border-transparent text-gray-300 hover:bg-surface-hover'
                      )}
                    >
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fee Info */}
            {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
              <div className="bg-surface-tertiary rounded-xl p-4 space-y-3 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Network Fee</span>
                  <span className="font-mono text-gray-300">{withdrawFee} {selectedCurrency}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">You will receive</span>
                  <span className="font-mono font-semibold text-white">{withdrawNetAmount()} {selectedCurrency}</span>
                </div>
              </div>
            )}

            {/* Review Button */}
            <button
              disabled={!withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0}
              className={cn(
                'w-full py-4 rounded-xl text-sm font-bold transition-all min-h-[44px]',
                !withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0
                  ? 'bg-surface-tertiary text-gray-600 cursor-not-allowed'
                  : 'bg-accent-orange hover:brightness-110 text-black shadow-lg'
              )}
            >
              Review Withdrawal
            </button>
          </div>
        </div>
      )}

      {/* ── Swap Section - larger swap button (48px) ─────────────────────────────────────── */}
      {activeSection === 'swap' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-surface-secondary border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-6">Swap Currencies</h2>

            {/* From */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">From</label>
              <div className="bg-surface-deepest border border-border rounded-lg p-4 flex items-center gap-3 min-h-[56px]">
                <div className="relative">
                  <select
                    value={swapFrom}
                    onChange={(e) => setSwapFrom(e.target.value)}
                    className="appearance-none bg-surface-tertiary border border-border rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-white cursor-pointer focus:outline-none focus:border-brand-500 min-h-[44px]"
                    style={{ fontSize: '16px' }}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <input
                  type="text"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-right font-mono text-lg text-white outline-none placeholder:text-gray-600"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right font-mono">
                Balance: {CURRENCIES.find((c) => c.symbol === swapFrom)?.balance ?? 0} {swapFrom}
              </p>
            </div>

            {/* Swap Direction Button - 48px */}
            <div className="flex justify-center -my-1 relative z-10">
              <button
                onClick={() => {
                  const tmp = swapFrom;
                  setSwapFrom(swapTo);
                  setSwapTo(tmp);
                }}
                className="w-12 h-12 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center transition-all shadow-lg"
              >
                <ArrowLeftRight className="w-5 h-5" />
              </button>
            </div>

            {/* To */}
            <div className="mb-6 mt-3">
              <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wide">To</label>
              <div className="bg-surface-deepest border border-border rounded-lg p-4 flex items-center gap-3 min-h-[56px]">
                <div className="relative">
                  <select
                    value={swapTo}
                    onChange={(e) => setSwapTo(e.target.value)}
                    className="appearance-none bg-surface-tertiary border border-border rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-white cursor-pointer focus:outline-none focus:border-brand-500 min-h-[44px]"
                    style={{ fontSize: '16px' }}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="flex-1 text-right font-mono text-lg text-gray-400">
                  {swapAmount && parseFloat(swapAmount) > 0
                    ? (
                        (parseFloat(swapAmount) *
                          (CURRENCIES.find((c) => c.symbol === swapFrom)?.usdPrice || 0)) /
                        (CURRENCIES.find((c) => c.symbol === swapTo)?.usdPrice || 1)
                      ).toFixed(6)
                    : '0.00'}
                </div>
              </div>
            </div>

            {/* Swap Info */}
            {swapAmount && parseFloat(swapAmount) > 0 && (
              <div className="bg-surface-tertiary rounded-xl p-4 space-y-2 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Rate</span>
                  <span className="font-mono text-gray-300">
                    1 {swapFrom} = {((CURRENCIES.find((c) => c.symbol === swapFrom)?.usdPrice || 0) / (CURRENCIES.find((c) => c.symbol === swapTo)?.usdPrice || 1)).toFixed(4)} {swapTo}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Fee</span>
                  <span className="font-mono text-gray-300">0.5%</span>
                </div>
              </div>
            )}

            <button
              disabled={!swapAmount || parseFloat(swapAmount) <= 0 || swapFrom === swapTo}
              className={cn(
                'w-full py-4 rounded-xl text-sm font-bold transition-all min-h-[44px]',
                !swapAmount || parseFloat(swapAmount) <= 0 || swapFrom === swapTo
                  ? 'bg-surface-tertiary text-gray-600 cursor-not-allowed'
                  : 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg'
              )}
            >
              Swap {swapFrom} to {swapTo}
            </button>
          </div>
        </div>
      )}

      {/* ── History Section - compact card layout ──────────────────────────────────────── */}
      {activeSection === 'history' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {(['all', 'deposits', 'withdrawals'] as TxFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTxFilter(f)}
                className={cn(
                  'px-4 py-2.5 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap min-h-[44px]',
                  txFilter === f
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : 'bg-surface-tertiary text-gray-400 border border-transparent hover:bg-surface-hover'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Transaction List - compact cards */}
          <div className="space-y-2">
            {filteredTransactions.length === 0 ? (
              <div className="bg-surface-secondary border border-border rounded-xl p-12 text-center">
                <Clock className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-500">No transactions found</p>
              </div>
            ) : (
              filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-surface-secondary border border-border rounded-xl p-4 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                          tx.type === 'deposit' ? 'bg-accent-green/15' : 'bg-accent-red/15'
                        )}
                      >
                        {tx.type === 'deposit' ? (
                          <ArrowDown className="w-5 h-5 text-accent-green" />
                        ) : (
                          <ArrowUp className="w-5 h-5 text-accent-red" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                          <span className={tx.type === 'deposit' ? 'text-accent-green' : 'text-accent-red'}>
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
                            className="text-gray-600 hover:text-brand-400 transition-colors shrink-0 min-w-[24px] min-h-[24px] flex items-center justify-center"
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

      {/* ── Wallet Grid ──────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">All Wallets</h2>
          <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors min-h-[44px] px-3">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CURRENCIES.map((c) => {
            const usdValue = c.balance * c.usdPrice;
            return (
              <button
                key={c.symbol}
                onClick={() => handleSelectCurrency(c.symbol)}
                className={cn(
                  'text-left bg-surface-secondary border rounded-xl p-4 hover:border-white/10 transition-all group',
                  selectedCurrency === c.symbol ? 'border-brand-500/40' : 'border-border'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <CurrencyIcon symbol={c.symbol} color={c.color} size={36} />
                    <div>
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.symbol}</p>
                    </div>
                  </div>
                  <MiniSparkline color={c.color} />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-lg font-mono font-semibold text-white">
                      {balanceHidden ? '****' : c.balance.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {balanceHidden ? '****' : `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
