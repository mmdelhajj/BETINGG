// ─── Deposit Monitor Service ────────────────────────────────────────────────
// Polls blockchains for incoming deposits to user deposit addresses.
// Tracks confirmation counts, auto-credits balances, and handles reorgs.

import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { deleteCache } from '../../lib/redis';
import { addNotificationJob } from '../../queues';
import { getProvider, BlockchainProvider, TransactionInfo } from './providers';
import {
  ChainId,
  resolveChainId,
  getChainConfig,
  getConfirmationsRequired,
  chainConfigs,
} from '../../config/blockchain';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const MAX_ADDRESSES_PER_BATCH = 100;
const STALE_DEPOSIT_HOURS = 72; // Stop monitoring after 72 hours with no activity

interface MonitoredAddress {
  walletId: string;
  userId: string;
  address: string;
  currencySymbol: string;
  chainId: ChainId;
  networkId?: string | null;
  lastCheckedBlock: number;
}

class DepositMonitorService {
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastPollErrors: Map<ChainId, number> = new Map();

  /**
   * Start the deposit monitoring loop.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[DepositMonitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[DepositMonitor] Starting deposit monitoring service');

    // Initial poll
    await this.pollAllChains();

    // Set up recurring polling
    this.pollTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.pollAllChains();
      }
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop the deposit monitoring loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[DepositMonitor] Stopped deposit monitoring service');
  }

  /**
   * Poll all active chains for deposits.
   */
  private async pollAllChains(): Promise<void> {
    const startTime = Date.now();
    console.log('[DepositMonitor] Starting poll cycle');

    try {
      // Get all active deposit addresses from the database
      const addresses = await this.getActiveDepositAddresses();

      if (addresses.length === 0) {
        console.log('[DepositMonitor] No active deposit addresses to monitor');
        return;
      }

      // Group addresses by chain
      const addressesByChain = new Map<ChainId, MonitoredAddress[]>();
      for (const addr of addresses) {
        const existing = addressesByChain.get(addr.chainId) || [];
        existing.push(addr);
        addressesByChain.set(addr.chainId, existing);
      }

      // Poll each chain in parallel
      const pollPromises = Array.from(addressesByChain.entries()).map(
        async ([chainId, chainAddresses]) => {
          try {
            await this.pollChain(chainId, chainAddresses);
            this.lastPollErrors.set(chainId, 0);
          } catch (err) {
            const errorCount = (this.lastPollErrors.get(chainId) || 0) + 1;
            this.lastPollErrors.set(chainId, errorCount);
            console.error(
              `[DepositMonitor] Error polling ${chainId} (consecutive errors: ${errorCount}):`,
              (err as Error).message
            );
          }
        }
      );

      await Promise.allSettled(pollPromises);

      const elapsed = Date.now() - startTime;
      console.log(
        `[DepositMonitor] Poll cycle complete in ${elapsed}ms (${addresses.length} addresses across ${addressesByChain.size} chains)`
      );
    } catch (err) {
      console.error('[DepositMonitor] Poll cycle failed:', (err as Error).message);
    }
  }

  /**
   * Poll a specific chain for deposits to the given addresses.
   */
  private async pollChain(chainId: ChainId, addresses: MonitoredAddress[]): Promise<void> {
    const provider = await getProvider(chainId);
    const config = getChainConfig(chainId);
    const requiredConfirmations = config.confirmationsRequired;

    // Process addresses in batches
    for (let i = 0; i < addresses.length; i += MAX_ADDRESSES_PER_BATCH) {
      const batch = addresses.slice(i, i + MAX_ADDRESSES_PER_BATCH);

      await Promise.allSettled(
        batch.map(async (monitoredAddr) => {
          try {
            await this.checkAddressForDeposits(
              provider,
              monitoredAddr,
              requiredConfirmations
            );
          } catch (err) {
            console.warn(
              `[DepositMonitor:${chainId}] Failed to check address ${monitoredAddr.address}:`,
              (err as Error).message
            );
          }
        })
      );
    }

    // Also update confirmation counts for pending deposits on this chain
    await this.updatePendingConfirmations(provider, chainId, requiredConfirmations);
  }

  /**
   * Check a single address for new deposits.
   */
  private async checkAddressForDeposits(
    provider: BlockchainProvider,
    monitoredAddr: MonitoredAddress,
    requiredConfirmations: number
  ): Promise<void> {
    // Get recent transactions to this address
    const transactions = await provider.getAddressTransactions(
      monitoredAddr.address,
      monitoredAddr.lastCheckedBlock || undefined
    );

    for (const tx of transactions) {
      // Skip transactions not directed at our address
      if (tx.to.toLowerCase() !== monitoredAddr.address.toLowerCase()) continue;

      // Skip zero-value transactions
      if (tx.amount === '0') continue;

      // Check if we already know about this transaction
      const existing = await prisma.transaction.findFirst({
        where: {
          txHash: tx.txHash,
          walletId: monitoredAddr.walletId,
        },
      });

      if (existing) {
        // Update confirmations if needed
        if (existing.confirmations < tx.confirmations) {
          await this.updateTransactionConfirmations(
            existing.id,
            tx.confirmations,
            requiredConfirmations,
            monitoredAddr
          );
        }
        continue;
      }

      // New deposit detected - create transaction record
      await this.createDepositTransaction(
        monitoredAddr,
        tx,
        requiredConfirmations
      );
    }
  }

  /**
   * Create a new deposit transaction record.
   */
  private async createDepositTransaction(
    monitoredAddr: MonitoredAddress,
    tx: TransactionInfo,
    requiredConfirmations: number
  ): Promise<void> {
    const config = getChainConfig(monitoredAddr.chainId);
    const amount = this.convertFromSmallestUnit(tx.amount, config.nativeDecimals, tx.tokenAddress, monitoredAddr.chainId);

    if (new Decimal(amount).lte(0)) return;

    const isFullyConfirmed = tx.confirmations >= requiredConfirmations;
    const status = isFullyConfirmed ? 'COMPLETED' : 'CONFIRMING';

    console.log(
      `[DepositMonitor:${monitoredAddr.chainId}] New deposit detected: ${tx.txHash} ` +
      `amount=${amount} ${monitoredAddr.currencySymbol} confirmations=${tx.confirmations}/${requiredConfirmations}`
    );

    try {
      await prisma.$transaction(async (txn) => {
        // Create the deposit transaction
        await txn.transaction.create({
          data: {
            walletId: monitoredAddr.walletId,
            type: 'DEPOSIT',
            amount: parseFloat(amount),
            txHash: tx.txHash,
            fromAddress: tx.from,
            toAddress: tx.to,
            networkId: monitoredAddr.networkId || undefined,
            status: status as any,
            confirmations: tx.confirmations,
            requiredConfirmations,
            metadata: {
              chainId: monitoredAddr.chainId,
              blockNumber: tx.blockNumber,
              tokenSymbol: tx.tokenSymbol,
              tokenAddress: tx.tokenAddress,
              detectedAt: new Date().toISOString(),
            },
          },
        });

        // Credit balance immediately if fully confirmed
        if (isFullyConfirmed) {
          await txn.wallet.update({
            where: { id: monitoredAddr.walletId },
            data: { balance: { increment: parseFloat(amount) } },
          });
        }
      });

      // Invalidate balance cache
      await deleteCache(`balance:${monitoredAddr.userId}:${monitoredAddr.currencySymbol}`);

      // Send notification
      if (isFullyConfirmed) {
        await addNotificationJob({
          userId: monitoredAddr.userId,
          type: 'DEPOSIT',
          title: 'Deposit Confirmed',
          message: `Your deposit of ${amount} ${monitoredAddr.currencySymbol} has been confirmed.`,
          data: {
            txHash: tx.txHash,
            amount,
            currency: monitoredAddr.currencySymbol,
          },
        });
      } else {
        await addNotificationJob({
          userId: monitoredAddr.userId,
          type: 'DEPOSIT',
          title: 'Deposit Detected',
          message: `Deposit of ${amount} ${monitoredAddr.currencySymbol} detected. Waiting for ${requiredConfirmations - tx.confirmations} more confirmations.`,
          data: {
            txHash: tx.txHash,
            amount,
            currency: monitoredAddr.currencySymbol,
            confirmations: tx.confirmations,
            requiredConfirmations,
          },
        });
      }
    } catch (err) {
      // Handle duplicate key errors gracefully (race condition protection)
      if ((err as any)?.code === 'P2002') {
        console.log(`[DepositMonitor] Duplicate deposit ignored: ${tx.txHash}`);
        return;
      }
      throw err;
    }
  }

  /**
   * Update confirmation count for a pending transaction.
   * Credits balance when confirmations threshold is reached.
   */
  private async updateTransactionConfirmations(
    transactionId: string,
    newConfirmations: number,
    requiredConfirmations: number,
    monitoredAddr: MonitoredAddress
  ): Promise<void> {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx || tx.status === 'COMPLETED' || tx.status === 'FAILED') return;

    const isNowConfirmed = newConfirmations >= requiredConfirmations;
    const newStatus = isNowConfirmed ? 'COMPLETED' : 'CONFIRMING';

    await prisma.$transaction(async (txn) => {
      await txn.transaction.update({
        where: { id: transactionId },
        data: {
          confirmations: newConfirmations,
          status: newStatus as any,
        },
      });

      // Credit balance when fully confirmed
      if (isNowConfirmed && tx.status !== 'COMPLETED') {
        await txn.wallet.update({
          where: { id: monitoredAddr.walletId },
          data: { balance: { increment: Math.abs(tx.amount.toNumber()) } },
        });

        console.log(
          `[DepositMonitor:${monitoredAddr.chainId}] Deposit confirmed: ${tx.txHash} ` +
          `amount=${tx.amount} confirmations=${newConfirmations}`
        );
      }
    });

    if (isNowConfirmed) {
      await deleteCache(`balance:${monitoredAddr.userId}:${monitoredAddr.currencySymbol}`);

      await addNotificationJob({
        userId: monitoredAddr.userId,
        type: 'DEPOSIT',
        title: 'Deposit Confirmed',
        message: `Your deposit of ${Math.abs(tx.amount.toNumber())} ${monitoredAddr.currencySymbol} has been confirmed.`,
        data: {
          txHash: tx.txHash,
          amount: Math.abs(tx.amount.toNumber()).toString(),
          currency: monitoredAddr.currencySymbol,
        },
      });
    }
  }

  /**
   * Update confirmation counts for all pending deposits on a given chain.
   * Handles both increasing confirmations and reorgs (decreasing confirmations).
   */
  private async updatePendingConfirmations(
    provider: BlockchainProvider,
    chainId: ChainId,
    requiredConfirmations: number
  ): Promise<void> {
    // Find all CONFIRMING transactions for this chain
    const pendingDeposits = await prisma.transaction.findMany({
      where: {
        type: 'DEPOSIT',
        status: 'CONFIRMING',
        metadata: {
          path: ['chainId'],
          equals: chainId,
        },
      },
      include: {
        wallet: {
          include: { currency: true },
        },
      },
      take: 200,
    });

    for (const deposit of pendingDeposits) {
      if (!deposit.txHash) continue;

      try {
        const currentConfirmations = await provider.getTransactionConfirmations(deposit.txHash);

        // Handle reorg: if confirmations decreased, it's a potential reorg
        if (currentConfirmations < deposit.confirmations) {
          console.warn(
            `[DepositMonitor:${chainId}] Possible reorg detected for ${deposit.txHash}: ` +
            `confirmations decreased from ${deposit.confirmations} to ${currentConfirmations}`
          );
        }

        if (currentConfirmations !== deposit.confirmations) {
          const monitoredAddr: MonitoredAddress = {
            walletId: deposit.walletId,
            userId: deposit.wallet.userId,
            address: deposit.toAddress || '',
            currencySymbol: deposit.wallet.currency.symbol,
            chainId,
            networkId: deposit.networkId,
            lastCheckedBlock: 0,
          };

          await this.updateTransactionConfirmations(
            deposit.id,
            currentConfirmations,
            requiredConfirmations,
            monitoredAddr
          );
        }
      } catch (err) {
        console.warn(
          `[DepositMonitor:${chainId}] Failed to update confirmations for ${deposit.txHash}:`,
          (err as Error).message
        );
      }
    }
  }

  /**
   * Fetch all active deposit addresses from the database.
   */
  private async getActiveDepositAddresses(): Promise<MonitoredAddress[]> {
    const staleThreshold = new Date(Date.now() - STALE_DEPOSIT_HOURS * 60 * 60 * 1000);

    const wallets = await prisma.wallet.findMany({
      where: {
        depositAddress: { not: null },
        // Only monitor wallets that are reasonably recent or have active deposits
        OR: [
          { updatedAt: { gte: staleThreshold } },
          { createdAt: { gte: staleThreshold } },
          {
            transactions: {
              some: {
                type: 'DEPOSIT',
                status: 'CONFIRMING',
              },
            },
          },
        ],
      },
      include: {
        currency: {
          include: { networks: true },
        },
      },
      take: 1000, // Limit to prevent overload
    });

    const monitoredAddresses: MonitoredAddress[] = [];

    for (const wallet of wallets) {
      if (!wallet.depositAddress) continue;

      // Determine the chain based on the currency networks
      for (const network of wallet.currency.networks) {
        if (!network.isActive) continue;

        try {
          const chainId = resolveChainId(network.networkName);

          monitoredAddresses.push({
            walletId: wallet.id,
            userId: wallet.userId,
            address: wallet.depositAddress,
            currencySymbol: wallet.currency.symbol,
            chainId,
            networkId: network.id,
            lastCheckedBlock: 0,
          });
        } catch {
          // Unknown network, skip
        }
      }
    }

    return monitoredAddresses;
  }

  /**
   * Convert from the smallest unit of a cryptocurrency to a human-readable amount.
   */
  private convertFromSmallestUnit(
    amount: string,
    nativeDecimals: number,
    tokenAddress: string | undefined,
    chainId: ChainId
  ): string {
    const config = getChainConfig(chainId);
    let decimals = nativeDecimals;

    if (tokenAddress) {
      const token = config.tokens.find(
        (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      if (token) {
        decimals = token.decimals;
      }
    }

    return new Decimal(amount).div(new Decimal(10).pow(decimals)).toFixed(decimals);
  }

  /**
   * Manual trigger: scan a specific address for deposits.
   * Useful for admin tools or on-demand checks.
   */
  async scanAddress(walletId: string): Promise<void> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        currency: { include: { networks: true } },
      },
    });

    if (!wallet || !wallet.depositAddress) {
      throw new Error(`Wallet ${walletId} not found or has no deposit address`);
    }

    for (const network of wallet.currency.networks) {
      if (!network.isActive) continue;

      try {
        const chainId = resolveChainId(network.networkName);
        const provider = await getProvider(chainId);
        const config = getChainConfig(chainId);

        const monitoredAddr: MonitoredAddress = {
          walletId: wallet.id,
          userId: wallet.userId,
          address: wallet.depositAddress,
          currencySymbol: wallet.currency.symbol,
          chainId,
          networkId: network.id,
          lastCheckedBlock: 0,
        };

        await this.checkAddressForDeposits(
          provider,
          monitoredAddr,
          config.confirmationsRequired
        );
      } catch (err) {
        console.warn(
          `[DepositMonitor] Failed to scan ${wallet.depositAddress} on ${network.networkName}:`,
          (err as Error).message
        );
      }
    }
  }
}

// Singleton instance
export const depositMonitor = new DepositMonitorService();
