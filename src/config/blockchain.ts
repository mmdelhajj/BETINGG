// ─── Blockchain Configuration ────────────────────────────────────────────────
// Centralized config for all blockchain providers, networks, and token contracts.
// All values can be overridden via environment variables.

export type ChainId = 'BTC' | 'ETH' | 'BSC' | 'POLYGON' | 'ARBITRUM' | 'LTC' | 'DOGE' | 'TRX' | 'SOL';
export type NetworkType = 'mainnet' | 'testnet';

export interface TokenContract {
  symbol: string;
  address: string;
  decimals: number;
}

export interface ChainConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: string;
  nativeDecimals: number;
  confirmationsRequired: number;
  blockTimeMs: number;
  bip44CoinType: number;
  /** EVM chain numeric ID (only for EVM chains) */
  evmChainId?: number;
  tokens: TokenContract[];
  isTestnet: boolean;
}

// ─── Default RPC URLs (free / public tiers) ─────────────────────────────────

const ETH_RPC = process.env.ETH_RPC_URL || process.env.EVM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo';
const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';
const POLYGON_RPC = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
const BTC_RPC = process.env.BTC_RPC_URL || 'https://blockstream.info/api';
const LTC_RPC = process.env.LTC_RPC_URL || 'https://litecoinspace.org/api';
const DOGE_RPC = process.env.DOGE_RPC_URL || 'https://dogechain.info/api/v1';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TRON_API = process.env.TRON_API_URL || 'https://api.trongrid.io';
const NOWNODES_API_KEY = process.env.NOWNODES_API_KEY || '';
const TRON_API_KEY = process.env.TRON_API_KEY || '';

// ─── HD Wallet ──────────────────────────────────────────────────────────────

/** Demo testnet mnemonic - NEVER use with real funds */
const DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

export const hdWalletConfig = {
  mnemonic: process.env.WALLET_MNEMONIC || process.env.EVM_MNEMONIC || DEFAULT_MNEMONIC,
  /** Starting index for HD derivation per user */
  startIndex: 0,
};

// ─── Chain Configurations ───────────────────────────────────────────────────

export const chainConfigs: Record<ChainId, ChainConfig> = {
  BTC: {
    chainId: 'BTC',
    name: 'Bitcoin',
    rpcUrl: BTC_RPC,
    explorerUrl: 'https://blockstream.info/tx/',
    nativeCurrency: 'BTC',
    nativeDecimals: 8,
    confirmationsRequired: 3,
    blockTimeMs: 600_000, // ~10 minutes
    bip44CoinType: 0,
    tokens: [],
    isTestnet: false,
  },
  ETH: {
    chainId: 'ETH',
    name: 'Ethereum',
    rpcUrl: ETH_RPC,
    explorerUrl: 'https://etherscan.io/tx/',
    nativeCurrency: 'ETH',
    nativeDecimals: 18,
    confirmationsRequired: 12,
    blockTimeMs: 12_000,
    bip44CoinType: 60,
    evmChainId: 1,
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    ],
    isTestnet: false,
  },
  BSC: {
    chainId: 'BSC',
    name: 'BNB Smart Chain',
    rpcUrl: BSC_RPC,
    explorerUrl: 'https://bscscan.com/tx/',
    nativeCurrency: 'BNB',
    nativeDecimals: 18,
    confirmationsRequired: 15,
    blockTimeMs: 3_000,
    bip44CoinType: 60,
    evmChainId: 56,
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    ],
    isTestnet: false,
  },
  POLYGON: {
    chainId: 'POLYGON',
    name: 'Polygon',
    rpcUrl: POLYGON_RPC,
    explorerUrl: 'https://polygonscan.com/tx/',
    nativeCurrency: 'MATIC',
    nativeDecimals: 18,
    confirmationsRequired: 30,
    blockTimeMs: 2_000,
    bip44CoinType: 60,
    evmChainId: 137,
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    ],
    isTestnet: false,
  },
  ARBITRUM: {
    chainId: 'ARBITRUM',
    name: 'Arbitrum One',
    rpcUrl: ARBITRUM_RPC,
    explorerUrl: 'https://arbiscan.io/tx/',
    nativeCurrency: 'ETH',
    nativeDecimals: 18,
    confirmationsRequired: 12,
    blockTimeMs: 250,
    bip44CoinType: 60,
    evmChainId: 42161,
    tokens: [
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    ],
    isTestnet: false,
  },
  LTC: {
    chainId: 'LTC',
    name: 'Litecoin',
    rpcUrl: LTC_RPC,
    explorerUrl: 'https://litecoinspace.org/tx/',
    nativeCurrency: 'LTC',
    nativeDecimals: 8,
    confirmationsRequired: 6,
    blockTimeMs: 150_000, // ~2.5 minutes
    bip44CoinType: 2,
    tokens: [],
    isTestnet: false,
  },
  DOGE: {
    chainId: 'DOGE',
    name: 'Dogecoin',
    rpcUrl: DOGE_RPC,
    explorerUrl: 'https://dogechain.info/tx/',
    nativeCurrency: 'DOGE',
    nativeDecimals: 8,
    confirmationsRequired: 20,
    blockTimeMs: 60_000,
    bip44CoinType: 3,
    tokens: [],
    isTestnet: false,
  },
  TRX: {
    chainId: 'TRX',
    name: 'TRON',
    rpcUrl: TRON_API,
    explorerUrl: 'https://tronscan.org/#/transaction/',
    nativeCurrency: 'TRX',
    nativeDecimals: 6,
    confirmationsRequired: 20,
    blockTimeMs: 3_000,
    bip44CoinType: 195,
    tokens: [
      { symbol: 'USDT', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
    ],
    isTestnet: false,
  },
  SOL: {
    chainId: 'SOL',
    name: 'Solana',
    rpcUrl: SOLANA_RPC,
    explorerUrl: 'https://explorer.solana.com/tx/',
    nativeCurrency: 'SOL',
    nativeDecimals: 9,
    confirmationsRequired: 32,
    blockTimeMs: 400,
    bip44CoinType: 501,
    tokens: [
      { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
      { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
    ],
    isTestnet: false,
  },
};

// ─── Network name to chain ID mapping ───────────────────────────────────────

export const networkToChainId: Record<string, ChainId> = {
  bitcoin: 'BTC',
  btc: 'BTC',
  ethereum: 'ETH',
  eth: 'ETH',
  erc20: 'ETH',
  bsc: 'BSC',
  bep20: 'BSC',
  polygon: 'POLYGON',
  arbitrum: 'ARBITRUM',
  litecoin: 'LTC',
  ltc: 'LTC',
  dogecoin: 'DOGE',
  doge: 'DOGE',
  tron: 'TRX',
  trx: 'TRX',
  trc20: 'TRX',
  solana: 'SOL',
  sol: 'SOL',
  spl: 'SOL',
};

// ─── Helper functions ───────────────────────────────────────────────────────

export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return config;
}

export function resolveChainId(networkName: string): ChainId {
  const normalized = networkName.toLowerCase().trim();
  const chainId = networkToChainId[normalized];
  if (!chainId) {
    throw new Error(`Unknown network name: ${networkName}`);
  }
  return chainId;
}

export function getConfirmationsRequired(chainId: ChainId): number {
  return getChainConfig(chainId).confirmationsRequired;
}

export function isEvmChain(chainId: ChainId): boolean {
  return ['ETH', 'BSC', 'POLYGON', 'ARBITRUM'].includes(chainId);
}

export function isUtxoChain(chainId: ChainId): boolean {
  return ['BTC', 'LTC', 'DOGE'].includes(chainId);
}

export function getTokenContract(chainId: ChainId, tokenSymbol: string): TokenContract | undefined {
  const config = getChainConfig(chainId);
  return config.tokens.find((t) => t.symbol.toUpperCase() === tokenSymbol.toUpperCase());
}

export { NOWNODES_API_KEY, TRON_API_KEY };
