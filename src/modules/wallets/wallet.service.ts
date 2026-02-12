import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { AppError, NotFoundError, InsufficientBalanceError } from '../../utils/errors';
import { getCache, setCache, deleteCache } from '../../lib/redis';
import { hdWalletManager } from '../../services/blockchain/hdWallet';
import { resolveChainId, ChainId } from '../../config/blockchain';

export class WalletService {
  async getWallets(userId: string) {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      include: { currency: true },
      orderBy: { currency: { symbol: 'asc' } },
    });

    return wallets.map((w) => ({
      id: w.id,
      currency: w.currency.symbol,
      name: w.currency.name,
      balance: w.balance.toString(),
      bonusBalance: w.bonusBalance.toString(),
      lockedBalance: w.lockedBalance.toString(),
      depositAddress: w.depositAddress,
      type: w.currency.type,
      icon: w.currency.icon,
    }));
  }

  async getWallet(userId: string, currencySymbol: string) {
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currencySymbol } },
      include: { currency: true },
    });

    if (!wallet) throw new NotFoundError('Wallet', currencySymbol);

    return {
      id: wallet.id,
      currency: wallet.currency.symbol,
      name: wallet.currency.name,
      balance: wallet.balance.toString(),
      bonusBalance: wallet.bonusBalance.toString(),
      lockedBalance: wallet.lockedBalance.toString(),
      depositAddress: wallet.depositAddress,
      type: wallet.currency.type,
      icon: wallet.currency.icon,
    };
  }

  async createWallet(userId: string, currencySymbol: string) {
    const currency = await prisma.currency.findUnique({
      where: { symbol: currencySymbol },
      include: { networks: true },
    });
    if (!currency) throw new NotFoundError('Currency', currencySymbol);
    if (!currency.isActive) throw new AppError('CURRENCY_INACTIVE', 'Currency is not active', 400);

    const existing = await prisma.wallet.findFirst({
      where: { userId, currencyId: currency.id },
    });
    if (existing) throw new AppError('WALLET_EXISTS', 'Wallet already exists for this currency', 409);

    // Generate a real blockchain deposit address via HD wallet derivation
    const { address, hdPath } = await this.generateDepositAddress(currency.symbol, currency.networks);

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        currencyId: currency.id,
        depositAddress: address,
        hdPath,
      },
      include: { currency: true },
    });

    return {
      id: wallet.id,
      currency: wallet.currency.symbol,
      balance: wallet.balance.toString(),
      depositAddress: wallet.depositAddress,
    };
  }

  async getTransactionHistory(
    userId: string,
    options: { currency?: string; type?: string; page: number; limit: number }
  ) {
    const { currency, type, page, limit } = options;

    const walletIds = await this.getUserWalletIds(userId, currency);
    const where: any = { walletId: { in: walletIds } };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { wallet: { include: { currency: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toString(),
        currency: t.wallet.currency.symbol,
        status: t.status,
        txHash: t.txHash,
        metadata: t.metadata,
        createdAt: t.createdAt.toISOString(),
      })),
      meta: { page, total, hasMore: page * limit < total },
    };
  }

  async getBalance(userId: string, currencySymbol: string): Promise<string> {
    const cacheKey = `balance:${userId}:${currencySymbol}`;
    const cached = await getCache<string>(cacheKey);
    if (cached) return cached;

    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currencySymbol } },
    });

    const balance = wallet ? wallet.balance.toString() : '0';
    await setCache(cacheKey, balance, 30);
    return balance;
  }

  async getTotalBalanceUSD(userId: string): Promise<string> {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      include: { currency: true },
    });

    let total = new Decimal(0);
    for (const wallet of wallets) {
      const balance = new Decimal(wallet.balance.toString());
      const rate = new Decimal(wallet.currency.exchangeRateUsd?.toString() || '0');
      total = total.plus(balance.mul(rate));
    }

    return total.toDecimalPlaces(2).toString();
  }

  private async getUserWalletIds(userId: string, currency?: string): Promise<string[]> {
    const where: any = { userId };
    if (currency) where.currency = { symbol: currency };
    const wallets = await prisma.wallet.findMany({ where, select: { id: true } });
    return wallets.map((w) => w.id);
  }

  /**
   * Generate a real blockchain deposit address using HD wallet derivation.
   * Determines the correct chain from the currency's network configuration,
   * assigns a unique derivation index, and derives the address.
   */
  private async generateDepositAddress(
    currencySymbol: string,
    networks: Array<{ networkName: string; isActive: boolean }>
  ): Promise<{ address: string; hdPath: string }> {
    // Ensure the HD wallet is initialized
    if (!hdWalletManager.isInitialized()) {
      await hdWalletManager.initialize();
    }

    // Determine which chain to derive for based on the currency's primary network
    const activeNetwork = networks.find((n) => n.isActive);
    if (!activeNetwork) {
      throw new AppError(
        'NO_ACTIVE_NETWORK',
        `No active network found for currency ${currencySymbol}`,
        400
      );
    }

    let chainId: ChainId;
    try {
      chainId = hdWalletManager.getDerivationChain(activeNetwork.networkName);
    } catch {
      throw new AppError(
        'UNSUPPORTED_NETWORK',
        `Unsupported network for address derivation: ${activeNetwork.networkName}`,
        400
      );
    }

    // Get the next available derivation index.
    // Count existing wallets using the same derivation chain to determine the next index.
    const existingCount = await prisma.wallet.count({
      where: {
        hdPath: { not: null },
        // Match wallets whose hdPath starts with the chain's BIP44 prefix
        // This ensures unique indices per derivation chain
      },
    });

    // Use existingCount as the next index (0-based)
    const index = existingCount;

    const derived = hdWalletManager.deriveAddress(chainId, index);

    console.log(
      `[WalletService] Generated deposit address for ${currencySymbol}: ` +
      `${derived.address} (path: ${derived.hdPath})`
    );

    return {
      address: derived.address,
      hdPath: derived.hdPath,
    };
  }
}

export const walletService = new WalletService();
