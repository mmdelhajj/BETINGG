// ─── EVM Blockchain Provider ────────────────────────────────────────────────
// Supports Ethereum, BSC, Polygon, and Arbitrum via ethers.js.
// Handles native ETH/BNB/MATIC transfers and ERC-20 token operations.

import { ethers, JsonRpcProvider, Contract, TransactionResponse, TransactionReceipt } from 'ethers';
import Decimal from 'decimal.js';
import {
  ChainId,
  getChainConfig,
  ChainConfig,
  TokenContract,
  getTokenContract,
} from '../../../config/blockchain';
import {
  BlockchainProvider,
  TransactionInfo,
  FeeEstimate,
} from './index';

// Minimal ERC-20 ABI for balance + transfer + events
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const RPC_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;

export class EvmProvider implements BlockchainProvider {
  readonly chainId: ChainId;
  private provider: JsonRpcProvider;
  private config: ChainConfig;

  constructor(chainId: ChainId) {
    this.chainId = chainId;
    this.config = getChainConfig(chainId);
    this.provider = new JsonRpcProvider(this.config.rpcUrl, this.config.evmChainId, {
      staticNetwork: true,
    });
  }

  // ─── Core Methods ─────────────────────────────────────────────────────────

  async getBalance(address: string): Promise<string> {
    return this.withRetry(async () => {
      const balance = await this.provider.getBalance(address);
      return balance.toString();
    }, 'getBalance');
  }

  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    return this.withRetry(async () => {
      const contract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      return balance.toString();
    }, 'getTokenBalance');
  }

  async getTransactionConfirmations(txHash: string): Promise<number> {
    return this.withRetry(async () => {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) return 0;

      const currentBlock = await this.provider.getBlockNumber();
      if (receipt.blockNumber === null) return 0;

      return Math.max(0, currentBlock - receipt.blockNumber + 1);
    }, 'getTransactionConfirmations');
  }

  async getTransactionInfo(txHash: string): Promise<TransactionInfo | null> {
    return this.withRetry(async () => {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash),
      ]);

      if (!tx) return null;

      let confirmations = 0;
      let status: TransactionInfo['status'] = 'pending';

      if (receipt) {
        const currentBlock = await this.provider.getBlockNumber();
        confirmations = receipt.blockNumber ? Math.max(0, currentBlock - receipt.blockNumber + 1) : 0;
        status = receipt.status === 1 ? 'confirmed' : 'failed';
      }

      // Check if this is a token transfer
      let tokenInfo = this.parseTokenTransfer(tx, receipt);

      return {
        txHash: tx.hash,
        from: tx.from,
        to: tokenInfo?.to || tx.to || '',
        amount: tokenInfo?.amount || tx.value.toString(),
        confirmations,
        blockNumber: receipt?.blockNumber || null,
        status,
        tokenSymbol: tokenInfo?.symbol,
        tokenAddress: tokenInfo?.tokenAddress,
      };
    }, 'getTransactionInfo');
  }

  async broadcastTransaction(signedTx: string): Promise<string> {
    return this.withRetry(async () => {
      const response = await this.provider.broadcastTransaction(signedTx);
      console.log(`[EVM:${this.chainId}] Transaction broadcast: ${response.hash}`);
      return response.hash;
    }, 'broadcastTransaction');
  }

  async getBlockNumber(): Promise<number> {
    return this.withRetry(async () => {
      return await this.provider.getBlockNumber();
    }, 'getBlockNumber');
  }

  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  async estimateFee(to: string, amount: string, tokenAddress?: string): Promise<FeeEstimate> {
    return this.withRetry(async () => {
      const feeData = await this.provider.getFeeData();

      let gasLimit: bigint;

      if (tokenAddress) {
        // ERC-20 transfer gas estimation
        const contract = new Contract(tokenAddress, ERC20_ABI, this.provider);
        try {
          gasLimit = await contract.transfer.estimateGas(to, amount);
        } catch {
          // Fallback gas limit for ERC-20 transfers
          gasLimit = 65000n;
        }
      } else {
        // Native transfer gas estimation
        try {
          gasLimit = await this.provider.estimateGas({
            to,
            value: BigInt(amount),
          });
        } catch {
          gasLimit = 21000n;
        }
      }

      // Use EIP-1559 if available, otherwise legacy
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;
      const totalFee = gasLimit * (gasPrice || 0n);

      // Estimate confirmation time based on chain block time
      const estimatedTimeSeconds = Math.ceil(
        (this.config.confirmationsRequired * this.config.blockTimeMs) / 1000
      );

      return {
        fee: totalFee.toString(),
        feeRate: gasPrice.toString(),
        estimatedTimeSeconds,
      };
    }, 'estimateFee');
  }

  async getAddressTransactions(address: string, fromBlock?: number): Promise<TransactionInfo[]> {
    return this.withRetry(async () => {
      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = fromBlock || Math.max(0, currentBlock - 100); // Last 100 blocks by default

      const transactions: TransactionInfo[] = [];

      // Check for native transfers by scanning recent blocks
      // Note: For production, use Alchemy Notify, Etherscan API, or indexed data instead
      // This scans the last few blocks as a basic implementation
      const blocksToScan = Math.min(currentBlock - startBlock, 10);
      for (let i = 0; i <= blocksToScan; i++) {
        const blockNum = currentBlock - i;
        try {
          const block = await this.provider.getBlock(blockNum, true);
          if (!block || !block.transactions) continue;

          for (const txHash of block.transactions) {
            const tx = typeof txHash === 'string' ? await this.provider.getTransaction(txHash) : null;
            if (!tx) continue;

            if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
              transactions.push({
                txHash: tx.hash,
                from: tx.from,
                to: tx.to,
                amount: tx.value.toString(),
                confirmations: currentBlock - blockNum + 1,
                blockNumber: blockNum,
                status: 'confirmed',
              });
            }
          }
        } catch (err) {
          // Skip blocks that fail to fetch
          continue;
        }
      }

      // Check for ERC-20 token transfers using event logs
      for (const token of this.config.tokens) {
        try {
          const contract = new Contract(token.address, ERC20_ABI, this.provider);
          const filter = contract.filters.Transfer(null, address);
          const events = await contract.queryFilter(filter, startBlock, currentBlock);

          for (const event of events) {
            const log = event as ethers.EventLog;
            if (!log.args) continue;

            transactions.push({
              txHash: log.transactionHash,
              from: log.args[0],
              to: log.args[1],
              amount: log.args[2].toString(),
              confirmations: currentBlock - (log.blockNumber || currentBlock) + 1,
              blockNumber: log.blockNumber || null,
              status: 'confirmed',
              tokenSymbol: token.symbol,
              tokenAddress: token.address,
            });
          }
        } catch (err) {
          console.warn(
            `[EVM:${this.chainId}] Failed to fetch ${token.symbol} transfer events:`,
            (err as Error).message
          );
        }
      }

      return transactions;
    }, 'getAddressTransactions');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const blockNumber = await Promise.race([
        this.provider.getBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), RPC_TIMEOUT_MS)
        ),
      ]);
      return typeof blockNumber === 'number' && blockNumber > 0;
    } catch {
      return false;
    }
  }

  // ─── EVM-specific helpers ─────────────────────────────────────────────────

  /**
   * Get the underlying ethers.js provider for advanced operations.
   */
  getEthersProvider(): JsonRpcProvider {
    return this.provider;
  }

  /**
   * Create and sign a native token transfer transaction.
   */
  async createNativeTransfer(
    privateKey: string,
    to: string,
    amountWei: string
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const feeData = await this.provider.getFeeData();

    const tx = await wallet.sendTransaction({
      to,
      value: BigInt(amountWei),
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined,
      gasPrice: feeData.maxFeePerGas ? undefined : feeData.gasPrice || undefined,
    });

    console.log(`[EVM:${this.chainId}] Native transfer sent: ${tx.hash}`);
    return tx.hash;
  }

  /**
   * Create and sign an ERC-20 token transfer transaction.
   */
  async createTokenTransfer(
    privateKey: string,
    tokenAddress: string,
    to: string,
    amount: string
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    const contract = new Contract(tokenAddress, ERC20_ABI, wallet);

    const tx = await contract.transfer(to, amount);
    console.log(`[EVM:${this.chainId}] Token transfer sent: ${tx.hash}`);
    return tx.hash;
  }

  /**
   * Convert a human-readable amount to the smallest unit (wei for ETH, etc).
   */
  toSmallestUnit(amount: string, decimals?: number): string {
    const d = decimals ?? this.config.nativeDecimals;
    return ethers.parseUnits(amount, d).toString();
  }

  /**
   * Convert from smallest unit to human-readable amount.
   */
  fromSmallestUnit(amount: string, decimals?: number): string {
    const d = decimals ?? this.config.nativeDecimals;
    return ethers.formatUnits(amount, d);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private parseTokenTransfer(
    tx: TransactionResponse,
    receipt: TransactionReceipt | null
  ): { to: string; amount: string; symbol?: string; tokenAddress?: string } | null {
    if (!receipt || !tx.data || tx.data === '0x') return null;

    // Check if the `to` address is a known token contract
    const tokenConfig = this.config.tokens.find(
      (t) => t.address.toLowerCase() === tx.to?.toLowerCase()
    );

    if (!tokenConfig) return null;

    // Parse the transfer event from receipt logs
    try {
      const iface = new ethers.Interface(ERC20_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === 'Transfer') {
            return {
              to: parsed.args[1],
              amount: parsed.args[2].toString(),
              symbol: tokenConfig.symbol,
              tokenAddress: tokenConfig.address,
            };
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Not a parseable token transfer
    }

    return null;
  }

  private async withRetry<T>(fn: () => Promise<T>, operation: string, retries = MAX_RETRIES): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out`)), RPC_TIMEOUT_MS)
          ),
        ]);
      } catch (err) {
        lastError = err as Error;
        console.warn(
          `[EVM:${this.chainId}] ${operation} attempt ${attempt}/${retries} failed:`,
          lastError.message
        );

        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        }
      }
    }

    throw new Error(
      `[EVM:${this.chainId}] ${operation} failed after ${retries} attempts: ${lastError?.message}`
    );
  }
}
