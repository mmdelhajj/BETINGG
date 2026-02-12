// ─── Blockchain Provider Interface & Factory ────────────────────────────────
// Abstract interface that all blockchain providers must implement.
// The factory creates and caches provider instances per chain.

import { ChainId, isEvmChain, isUtxoChain, getChainConfig } from '../../../config/blockchain';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TransactionInfo {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  confirmations: number;
  blockNumber: number | null;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp?: number;
  tokenSymbol?: string;
  tokenAddress?: string;
}

export interface FeeEstimate {
  /** Fee in the native currency of the chain */
  fee: string;
  /** Gas price or fee rate (chain-specific) */
  feeRate: string;
  /** Estimated confirmation time in seconds */
  estimatedTimeSeconds: number;
}

export interface UTXOInfo {
  txHash: string;
  outputIndex: number;
  amount: string;
  script: string;
  confirmations: number;
}

export interface BlockInfo {
  blockNumber: number;
  blockHash: string;
  timestamp: number;
  transactionCount: number;
}

// ─── Provider Interface ─────────────────────────────────────────────────────

export interface BlockchainProvider {
  /** Chain identifier */
  readonly chainId: ChainId;

  /**
   * Get the native balance of an address.
   * Returns the balance as a string in the smallest unit (wei, satoshi, lamport, sun).
   */
  getBalance(address: string): Promise<string>;

  /**
   * Get the token balance for an ERC-20/SPL/TRC-20 token at an address.
   * Returns '0' if tokens are not applicable on this chain.
   */
  getTokenBalance(address: string, tokenAddress: string): Promise<string>;

  /**
   * Get the number of confirmations for a transaction.
   * Returns 0 if the transaction is not found or still pending.
   */
  getTransactionConfirmations(txHash: string): Promise<number>;

  /**
   * Get detailed information about a transaction.
   */
  getTransactionInfo(txHash: string): Promise<TransactionInfo | null>;

  /**
   * Broadcast a signed transaction to the network.
   * Returns the transaction hash.
   */
  broadcastTransaction(signedTx: string): Promise<string>;

  /**
   * Get the current block number.
   */
  getBlockNumber(): Promise<number>;

  /**
   * Validate an address format for this chain.
   */
  isValidAddress(address: string): boolean;

  /**
   * Estimate the fee for a transaction.
   * @param to - Destination address
   * @param amount - Amount in the smallest unit
   * @param tokenAddress - Optional token contract address for token transfers
   */
  estimateFee(to: string, amount: string, tokenAddress?: string): Promise<FeeEstimate>;

  /**
   * Get recent transactions for an address (for deposit detection).
   * Returns transactions since the given block number.
   */
  getAddressTransactions(address: string, fromBlock?: number): Promise<TransactionInfo[]>;

  /**
   * Check if the provider is connected and operational.
   */
  isHealthy(): Promise<boolean>;
}

// ─── Provider Factory ───────────────────────────────────────────────────────

const providerCache: Map<ChainId, BlockchainProvider> = new Map();

/**
 * Get or create a blockchain provider for the given chain.
 * Providers are cached and reused.
 */
export async function getProvider(chainId: ChainId): Promise<BlockchainProvider> {
  const cached = providerCache.get(chainId);
  if (cached) return cached;

  let provider: BlockchainProvider;

  if (isEvmChain(chainId)) {
    const { EvmProvider } = await import('./evm.provider');
    provider = new EvmProvider(chainId);
  } else if (isUtxoChain(chainId)) {
    const { BitcoinProvider } = await import('./bitcoin.provider');
    provider = new BitcoinProvider(chainId);
  } else if (chainId === 'SOL') {
    const { SolanaProvider } = await import('./solana.provider');
    provider = new SolanaProvider();
  } else if (chainId === 'TRX') {
    const { TronProvider } = await import('./tron.provider');
    provider = new TronProvider();
  } else {
    throw new Error(`No provider available for chain: ${chainId}`);
  }

  providerCache.set(chainId, provider);
  return provider;
}

/**
 * Clear the provider cache. Useful for testing or reconnecting.
 */
export function clearProviderCache(): void {
  providerCache.clear();
}

/**
 * Get all initialized providers.
 */
export function getAllProviders(): Map<ChainId, BlockchainProvider> {
  return new Map(providerCache);
}

/**
 * Initialize providers for all supported chains.
 */
export async function initializeAllProviders(): Promise<void> {
  const chains: ChainId[] = ['BTC', 'ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'LTC', 'DOGE', 'TRX', 'SOL'];

  const results = await Promise.allSettled(
    chains.map(async (chainId) => {
      try {
        const provider = await getProvider(chainId);
        const healthy = await provider.isHealthy();
        if (healthy) {
          console.log(`[BlockchainProvider] ${chainId} provider initialized and healthy`);
        } else {
          console.warn(`[BlockchainProvider] ${chainId} provider initialized but not healthy`);
        }
      } catch (err) {
        console.error(`[BlockchainProvider] Failed to initialize ${chainId}:`, (err as Error).message);
      }
    })
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`[BlockchainProvider] ${successful}/${chains.length} providers initialized`);
}
