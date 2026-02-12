import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { AppError, NotFoundError } from '../../utils/errors';
import { deleteCache } from '../../lib/redis';
import { addDepositDetectionJob } from '../../queues';
import { hdWalletManager } from '../../services/blockchain/hdWallet';
import { resolveChainId, ChainId } from '../../config/blockchain';

export class DepositService {
  async getDepositAddress(userId: string, currencySymbol: string) {
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currencySymbol } },
      include: { currency: { include: { networks: true } } },
    });

    if (!wallet) throw new NotFoundError('Wallet', currencySymbol);

    if (!wallet.depositAddress) {
      // Generate a real blockchain address using HD wallet derivation
      const { address, hdPath } = await this.generateBlockchainAddress(
        wallet.currency.symbol,
        wallet.currency.networks
      );
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { depositAddress: address, hdPath },
      });
      wallet.depositAddress = address;
    }

    return {
      address: wallet.depositAddress,
      currency: wallet.currency.symbol,
      networks: wallet.currency.networks.filter((n) => n.isActive).map((n) => ({
        networkName: n.networkName,
        networkLabel: n.networkLabel,
        confirmations: n.confirmations,
      })),
      minWithdrawal: wallet.currency.minWithdrawal?.toString() || '0',
    };
  }

  async processDeposit(
    userId: string,
    currencySymbol: string,
    amount: string,
    txHash: string,
    network: string
  ) {
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: currencySymbol } },
    });
    if (!wallet) throw new NotFoundError('Wallet', currencySymbol);

    const amountDecimal = new Decimal(amount);
    if (amountDecimal.lte(0)) throw new AppError('INVALID_AMOUNT', 'Deposit amount must be positive', 400);

    const existing = await prisma.transaction.findFirst({
      where: { txHash, walletId: wallet.id },
    });
    if (existing) throw new AppError('DUPLICATE_TX', 'Transaction already processed', 409);

    // Resolve the chain ID for blockchain verification
    let chainId: string | undefined;
    try {
      chainId = resolveChainId(network);
    } catch {
      // Unknown network, proceed without chainId
    }

    const tx = await prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: amountDecimal.toNumber(),
        status: 'PENDING',
        txHash,
        metadata: {
          network,
          chainId,
          confirmations: 0,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    await addDepositDetectionJob({
      transactionId: tx.id,
      walletId: wallet.id,
      txHash,
      network,
      chainId,
      amount,
      currencySymbol,
    });

    return {
      transactionId: tx.id,
      status: 'PENDING',
      amount,
      currency: currencySymbol,
      txHash,
    };
  }

  async confirmDeposit(transactionId: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { wallet: { include: { currency: true } } },
    });

    if (!tx) throw new NotFoundError('Transaction', transactionId);
    if (tx.status !== 'PENDING' && tx.status !== 'CONFIRMING') {
      throw new AppError('INVALID_STATUS', 'Transaction is not pending or confirming', 400);
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
      }),
      prisma.wallet.update({
        where: { id: tx.walletId },
        data: { balance: { increment: tx.amount.toNumber() } },
      }),
    ]);

    await deleteCache(`balance:${tx.wallet.userId}:${tx.wallet.currency.symbol}`);

    return { transactionId, status: 'COMPLETED', amount: tx.amount.toString() };
  }

  async getDepositHistory(userId: string, options: { currency?: string; page: number; limit: number }) {
    const { currency, page, limit } = options;
    const where: any = { wallet: { userId }, type: 'DEPOSIT' };
    if (currency) where.wallet.currency = { symbol: currency };

    const [deposits, total] = await Promise.all([
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
      deposits: deposits.map((d) => ({
        id: d.id,
        amount: d.amount.toString(),
        currency: d.wallet.currency.symbol,
        status: d.status,
        txHash: d.txHash,
        confirmations: d.confirmations,
        requiredConfirmations: d.requiredConfirmations,
        network: (d.metadata as any)?.network,
        createdAt: d.createdAt.toISOString(),
      })),
      meta: { page, total, hasMore: page * limit < total },
    };
  }

  /**
   * Generate a real blockchain deposit address using HD wallet derivation.
   */
  private async generateBlockchainAddress(
    currencySymbol: string,
    networks: Array<{ networkName: string; isActive: boolean }>
  ): Promise<{ address: string; hdPath: string }> {
    // Ensure HD wallet is initialized
    if (!hdWalletManager.isInitialized()) {
      await hdWalletManager.initialize();
    }

    const activeNetwork = networks.find((n) => n.isActive);
    if (!activeNetwork) {
      throw new AppError(
        'NO_ACTIVE_NETWORK',
        `No active network found for ${currencySymbol}`,
        400
      );
    }

    let chainId: ChainId;
    try {
      chainId = hdWalletManager.getDerivationChain(activeNetwork.networkName);
    } catch {
      throw new AppError(
        'UNSUPPORTED_NETWORK',
        `Unsupported network: ${activeNetwork.networkName}`,
        400
      );
    }

    // Get the next available derivation index
    const existingCount = await prisma.wallet.count({
      where: { hdPath: { not: null } },
    });

    const derived = hdWalletManager.deriveAddress(chainId, existingCount);

    console.log(
      `[DepositService] Generated address for ${currencySymbol}: ` +
      `${derived.address} (path: ${derived.hdPath})`
    );

    return { address: derived.address, hdPath: derived.hdPath };
  }
}

export const depositService = new DepositService();
