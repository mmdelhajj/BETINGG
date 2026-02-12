'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, walletApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, History,
  Copy, Check, ChevronRight, AlertTriangle, Clock,
  ExternalLink, Clipboard, QrCode,
} from 'lucide-react';

type Tab = 'balances' | 'deposit' | 'withdraw' | 'transactions';

type TxFilter = 'all' | 'deposits' | 'withdrawals' | 'bets' | 'wins';

interface CurrencyInfo {
  symbol: string;
  name: string;
  color: string;
  networks?: { id: string; name: string; confirmations: number; estimatedTime: string }[];
}

const CURRENCIES: CurrencyInfo[] = [
  { symbol: 'BTC', name: 'Bitcoin', color: 'bg-orange-500',
    networks: [{ id: 'bitcoin', name: 'Bitcoin', confirmations: 3, estimatedTime: '~30 minutes' }] },
  { symbol: 'ETH', name: 'Ethereum', color: 'bg-blue-500',
    networks: [{ id: 'erc20', name: 'ERC-20', confirmations: 12, estimatedTime: '~5 minutes' }] },
  { symbol: 'USDT', name: 'Tether', color: 'bg-green-500',
    networks: [
      { id: 'erc20', name: 'ERC-20', confirmations: 12, estimatedTime: '~5 minutes' },
      { id: 'trc20', name: 'TRC-20', confirmations: 20, estimatedTime: '~3 minutes' },
      { id: 'bsc', name: 'BSC (BEP-20)', confirmations: 15, estimatedTime: '~3 minutes' },
      { id: 'solana', name: 'Solana', confirmations: 1, estimatedTime: '~1 minute' },
    ] },
  { symbol: 'LTC', name: 'Litecoin', color: 'bg-gray-400',
    networks: [{ id: 'litecoin', name: 'Litecoin', confirmations: 6, estimatedTime: '~15 minutes' }] },
  { symbol: 'SOL', name: 'Solana', color: 'bg-purple-500',
    networks: [{ id: 'solana', name: 'Solana', confirmations: 1, estimatedTime: '~1 minute' }] },
  { symbol: 'TRX', name: 'TRON', color: 'bg-red-500',
    networks: [{ id: 'trc20', name: 'TRC-20', confirmations: 20, estimatedTime: '~3 minutes' }] },
  { symbol: 'DOGE', name: 'Dogecoin', color: 'bg-yellow-500',
    networks: [{ id: 'dogecoin', name: 'Dogecoin', confirmations: 40, estimatedTime: '~40 minutes' }] },
  { symbol: 'XRP', name: 'Ripple', color: 'bg-slate-400',
    networks: [{ id: 'xrp', name: 'XRP Ledger', confirmations: 1, estimatedTime: '~4 seconds' }] },
  { symbol: 'BNB', name: 'BNB', color: 'bg-yellow-400',
    networks: [{ id: 'bsc', name: 'BSC (BEP-20)', confirmations: 15, estimatedTime: '~3 minutes' }] },
  { symbol: 'ADA', name: 'Cardano', color: 'bg-blue-400',
    networks: [{ id: 'cardano', name: 'Cardano', confirmations: 15, estimatedTime: '~10 minutes' }] },
  { symbol: 'MATIC', name: 'Polygon', color: 'bg-purple-400',
    networks: [{ id: 'polygon', name: 'Polygon', confirmations: 30, estimatedTime: '~5 minutes' }] },
  { symbol: 'USDC', name: 'USD Coin', color: 'bg-blue-600',
    networks: [
      { id: 'erc20', name: 'ERC-20', confirmations: 12, estimatedTime: '~5 minutes' },
      { id: 'solana', name: 'Solana', confirmations: 1, estimatedTime: '~1 minute' },
    ] },
];

const TAB_CONFIG = [
  { key: 'balances' as Tab, label: 'Balances', icon: Wallet },
  { key: 'deposit' as Tab, label: 'Deposit', icon: ArrowDownToLine },
  { key: 'withdraw' as Tab, label: 'Withdraw', icon: ArrowUpFromLine },
  { key: 'transactions' as Tab, label: 'Transactions', icon: History },
];

function CurrencyIcon({ symbol, size = 'md' }: { symbol: string; size?: 'sm' | 'md' | 'lg' }) {
  const currency = CURRENCIES.find((c) => c.symbol === symbol);
  const colorClass = currency?.color || 'bg-gray-500';
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-sm' : 'w-8 h-8 text-xs';

  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold text-white shrink-0', colorClass, sizeClass)}>
      {symbol.slice(0, symbol.length > 3 ? 2 : 3)}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === 'pending' || s === 'processing') return <span className="badge-pending"><Clock className="w-3 h-3" />{status}</span>;
  if (s === 'completed' || s === 'confirmed' || s === 'won') return <span className="badge-completed"><Check className="w-3 h-3" />{status}</span>;
  if (s === 'failed' || s === 'rejected' || s === 'lost') return <span className="badge-failed"><AlertTriangle className="w-3 h-3" />{status}</span>;
  return <span className="badge-pending">{status}</span>;
}

export default function WalletPage() {
  const [tab, setTab] = useState<Tab>('balances');
  const [wallets, setWallets] = useState<any[]>([]);
  const [totalUSD, setTotalUSD] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  // Deposit state
  const [depositStep, setDepositStep] = useState(1);
  const [depositCurrency, setDepositCurrency] = useState('');
  const [depositNetwork, setDepositNetwork] = useState('');
  const [depositAddress, setDepositAddress] = useState<any>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Withdraw state
  const [withdrawCurrency, setWithdrawCurrency] = useState('BTC');
  const [withdrawNetwork, setWithdrawNetwork] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawFee, _setWithdrawFee] = useState('0.0005');

  useEffect(() => {
    Promise.all([
      api.get('/wallets'),
      api.get('/wallets/balance/total'),
    ]).then(([walletsRes, totalRes]) => {
      setWallets(walletsRes.data.data);
      setTotalUSD(totalRes.data.data.totalUSD);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const params: Record<string, any> = {};
      if (txFilter !== 'all') params.type = txFilter;
      const { data } = await walletApi.getTransactions(params);
      setTransactions(Array.isArray(data.data) ? data.data : []);
    } catch {
      setTransactions([]);
    }
  }, [txFilter]);

  useEffect(() => {
    if (tab === 'transactions') loadTransactions();
  }, [tab, txFilter, loadTransactions]);

  const handleSelectDepositCurrency = (symbol: string) => {
    setDepositCurrency(symbol);
    const curr = CURRENCIES.find((c) => c.symbol === symbol);
    if (curr?.networks && curr.networks.length === 1) {
      setDepositNetwork(curr.networks[0].id);
      setDepositStep(3);
      fetchDepositAddress(symbol, curr.networks[0].id);
    } else {
      setDepositStep(2);
    }
  };

  const handleSelectDepositNetwork = (networkId: string) => {
    setDepositNetwork(networkId);
    setDepositStep(3);
    fetchDepositAddress(depositCurrency, networkId);
  };

  const fetchDepositAddress = async (currency: string, network: string) => {
    setIsLoadingAddress(true);
    try {
      const { data } = await api.get(`/wallets/deposit/${currency}/address`, { params: { network } });
      setDepositAddress(data.data);
    } catch {
      setDepositAddress({ address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', minDeposit: '0.0001' });
    }
    setIsLoadingAddress(false);
  };

  const handleCopyAddress = () => {
    if (depositAddress?.address) {
      navigator.clipboard.writeText(depositAddress.address);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    }
  };

  const handleWithdraw = async () => {
    try {
      await api.post('/wallets/withdraw', {
        currency: withdrawCurrency,
        amount: withdrawAmount,
        address: withdrawAddress,
        network: withdrawNetwork,
      });
      setWithdrawAmount('');
      setWithdrawAddress('');
    } catch (err) {
      console.error('Withdraw failed:', err);
    }
  };

  const resetDeposit = () => {
    setDepositStep(1);
    setDepositCurrency('');
    setDepositNetwork('');
    setDepositAddress(null);
    setAddressCopied(false);
  };

  const selectedDepositCurrency = CURRENCIES.find((c) => c.symbol === depositCurrency);
  const selectedDepositNetwork = selectedDepositCurrency?.networks?.find((n) => n.id === depositNetwork);

  const getNetAmount = () => {
    const amt = parseFloat(withdrawAmount) || 0;
    const fee = parseFloat(withdrawFee) || 0;
    return Math.max(0, amt - fee).toFixed(8);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Wallet</h1>
        <div className="flex items-baseline gap-2">
          <span className="text-gray-400 text-sm">Total Balance</span>
          <span className="text-2xl font-bold font-mono text-white">
            ${isLoading ? '---' : parseFloat(totalUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide pb-1">
        {TAB_CONFIG.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key === 'deposit') resetDeposit(); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap min-h-[44px]',
                tab === t.key
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Balances Tab */}
        {tab === 'balances' && (
          <motion.div
            key="balances"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {isLoading ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="card flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-4 w-20" />
                      <div className="skeleton h-3 w-32" />
                    </div>
                    <div className="skeleton h-4 w-24" />
                  </div>
                ))}
              </>
            ) : (
              wallets.map((w: any) => {
                const currInfo = CURRENCIES.find((c) => c.symbol === w.currency);
                return (
                  <div key={w.id} className="card flex items-center justify-between hover:border-border-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <CurrencyIcon symbol={w.currency} />
                      <div>
                        <p className="font-medium text-sm">{w.currency}</p>
                        <p className="text-xs text-gray-500">{currInfo?.name || w.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium">{parseFloat(w.balance).toFixed(w.currency === 'BTC' ? 8 : 4)}</p>
                      {w.usdValue && (
                        <p className="text-xs text-gray-500 font-mono">${parseFloat(w.usdValue).toFixed(2)}</p>
                      )}
                      {w.bonusBalance && w.bonusBalance !== '0' && parseFloat(w.bonusBalance) > 0 && (
                        <p className="text-xs text-accent-yellow font-mono">+{w.bonusBalance} bonus</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {/* Deposit Tab */}
        {tab === 'deposit' && (
          <motion.div
            key="deposit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Progress Steps */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <button
                    onClick={() => { if (step < depositStep) { setDepositStep(step); if (step === 1) resetDeposit(); } }}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                      step <= depositStep ? 'bg-brand-500 text-white' : 'bg-surface-tertiary text-gray-500'
                    )}
                  >
                    {step}
                  </button>
                  <span className={cn('text-xs hidden sm:inline', step <= depositStep ? 'text-white' : 'text-gray-500')}>
                    {step === 1 ? 'Currency' : step === 2 ? 'Network' : 'Address'}
                  </span>
                  {step < 3 && (
                    <ChevronRight className={cn('w-3 h-3', step < depositStep ? 'text-brand-400' : 'text-gray-600')} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Select Currency */}
            {depositStep === 1 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Select Currency</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.symbol}
                      onClick={() => handleSelectDepositCurrency(c.symbol)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-tertiary hover:bg-surface-hover border border-transparent hover:border-brand-500/30 transition-all min-h-[44px]"
                    >
                      <CurrencyIcon symbol={c.symbol} />
                      <span className="text-xs font-medium">{c.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Network */}
            {depositStep === 2 && selectedDepositCurrency && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CurrencyIcon symbol={depositCurrency} />
                  <div>
                    <h3 className="text-sm font-semibold">Select Network for {depositCurrency}</h3>
                    <p className="text-xs text-gray-500">Choose the network to deposit on</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedDepositCurrency.networks?.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => handleSelectDepositNetwork(net.id)}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-tertiary hover:bg-surface-hover border border-transparent hover:border-brand-500/30 transition-all text-left"
                    >
                      <div>
                        <p className="text-sm font-medium">{net.name}</p>
                        <p className="text-xs text-gray-500">
                          {net.confirmations} confirmations - {net.estimatedTime}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Deposit Address */}
            {depositStep === 3 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CurrencyIcon symbol={depositCurrency} />
                  <div>
                    <h3 className="text-sm font-semibold">Deposit {depositCurrency}</h3>
                    {selectedDepositNetwork && (
                      <p className="text-xs text-gray-500">via {selectedDepositNetwork.name}</p>
                    )}
                  </div>
                </div>

                {isLoadingAddress ? (
                  <div className="card space-y-4">
                    <div className="skeleton w-48 h-48 mx-auto rounded-xl" />
                    <div className="skeleton h-10 w-full rounded-lg" />
                  </div>
                ) : depositAddress ? (
                  <div className="card space-y-4">
                    {/* QR Code Placeholder */}
                    <div className="flex justify-center">
                      <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center p-3">
                        <div className="w-full h-full bg-surface rounded-lg flex items-center justify-center">
                          <QrCode className="w-16 h-16 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Deposit Address</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-surface-tertiary rounded-lg px-3 py-2.5 font-mono text-sm text-white break-all select-all border border-border">
                          {depositAddress.address}
                        </div>
                        <button
                          onClick={handleCopyAddress}
                          className={cn(
                            'p-2.5 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center',
                            addressCopied ? 'bg-accent-green/20 text-accent-green' : 'bg-surface-tertiary hover:bg-surface-hover text-gray-400'
                          )}
                        >
                          {addressCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Warning & Info */}
                    <div className="bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-accent-yellow shrink-0 mt-0.5" />
                        <div className="text-xs text-gray-300 space-y-1">
                          <p className="font-semibold text-accent-yellow">Important</p>
                          <p>Only send <span className="font-bold text-white">{depositCurrency}</span> to this address{selectedDepositNetwork ? ` on the ${selectedDepositNetwork.name} network` : ''}.</p>
                          {selectedDepositNetwork && (
                            <p>Requires {selectedDepositNetwork.confirmations} confirmations, {selectedDepositNetwork.estimatedTime}</p>
                          )}
                          {depositAddress.minDeposit && (
                            <p>Minimum deposit: <span className="font-mono font-medium text-white">{depositAddress.minDeposit} {depositCurrency}</span></p>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={resetDeposit}
                      className="btn-secondary w-full text-sm"
                    >
                      Deposit Another Currency
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </motion.div>
        )}

        {/* Withdraw Tab */}
        {tab === 'withdraw' && (
          <motion.div
            key="withdraw"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card space-y-4"
          >
            {/* Currency Selector */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Currency</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {['BTC', 'ETH', 'USDT', 'LTC', 'SOL', 'DOGE'].map((sym) => (
                  <button
                    key={sym}
                    onClick={() => setWithdrawCurrency(sym)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-xs font-medium min-h-[44px]',
                      withdrawCurrency === sym
                        ? 'bg-brand-500/20 border border-brand-500 text-brand-400'
                        : 'bg-surface-tertiary border border-transparent hover:bg-surface-hover text-gray-300'
                    )}
                  >
                    <CurrencyIcon symbol={sym} size="sm" />
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* Network Selector */}
            {CURRENCIES.find((c) => c.symbol === withdrawCurrency)?.networks && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Network</label>
                <div className="flex gap-2 flex-wrap">
                  {CURRENCIES.find((c) => c.symbol === withdrawCurrency)?.networks?.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setWithdrawNetwork(net.id)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[44px]',
                        withdrawNetwork === net.id
                          ? 'bg-brand-500/20 border border-brand-500 text-brand-400'
                          : 'bg-surface-tertiary border border-transparent hover:bg-surface-hover text-gray-300'
                      )}
                    >
                      {net.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Amount</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="input font-mono pr-16"
                />
                <button
                  onClick={() => {
                    const w = wallets.find((wl: any) => wl.currency === withdrawCurrency);
                    if (w) setWithdrawAmount(w.balance);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold text-brand-400 hover:bg-brand-500/10 rounded transition-colors"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Withdrawal Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="Enter wallet address"
                  className="input font-mono pr-10"
                />
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setWithdrawAddress(text);
                    } catch {}
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fee & Net Amount Preview */}
            {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
              <div className="bg-surface-tertiary rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Network Fee</span>
                  <span className="font-mono text-gray-300">{withdrawFee} {withdrawCurrency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">You will receive</span>
                  <span className="font-mono font-semibold text-white">{getNetAmount()} {withdrawCurrency}</span>
                </div>
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={handleWithdraw}
              disabled={!withdrawAmount || !withdrawAddress || parseFloat(withdrawAmount) <= 0}
              className="btn-primary w-full py-3 text-sm font-semibold rounded-xl"
            >
              Confirm Withdrawal
            </button>
          </motion.div>
        )}

        {/* Transactions Tab */}
        {tab === 'transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Filters */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-1">
              {(['all', 'deposits', 'withdrawals', 'bets', 'wins'] as TxFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-all min-h-[44px]',
                    txFilter === f
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      : 'bg-surface-tertiary text-gray-400 border border-transparent hover:bg-surface-hover'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Transaction List */}
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="card text-center py-12">
                  <History className="w-8 h-8 mx-auto mb-3 text-gray-600" />
                  <p className="text-sm text-gray-500">No transactions found</p>
                </div>
              ) : (
                transactions.map((tx: any) => (
                  <div key={tx.id} className="card flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        tx.type === 'deposit' ? 'bg-accent-green/15' : 'bg-accent-red/15'
                      )}>
                        {tx.type === 'deposit' ? (
                          <ArrowDownToLine className="w-4 h-4 text-accent-green" />
                        ) : (
                          <ArrowUpFromLine className="w-4 h-4 text-accent-red" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{tx.type}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className={cn('font-mono text-sm font-medium',
                          tx.type === 'deposit' || tx.type === 'win' ? 'text-accent-green' : 'text-white'
                        )}>
                          {tx.type === 'deposit' || tx.type === 'win' ? '+' : '-'}{tx.amount} {tx.currency}
                        </p>
                        <StatusBadge status={tx.status} />
                      </div>
                      {tx.txHash && (
                        <a href="#" className="text-gray-500 hover:text-brand-400 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
