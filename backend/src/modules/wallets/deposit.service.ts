import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepositResult {
  id: string;
  walletId: string;
  amount: string;
  currency: string;
  status: string;
  txHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  credited: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Process an incoming deposit detected on-chain (or via webhook).
 *
 * 1. Look up the wallet by deposit address (cached in Redis or DB lookup).
 * 2. Create or update the transaction with confirmation count.
 * 3. When confirmations reach the required threshold, credit the balance.
 */
export async function processDeposit(
  walletAddress: string,
  amount: string,
  txHash: string,
  confirmations: number,
): Promise<DepositResult> {
  const depositAmount = new Prisma.Decimal(amount);

  // 1. Resolve wallet from address
  //    First check Redis cache, then fallback to DB
  let walletId = await redis.get(`deposit_addr:${walletAddress}`);

  if (!walletId) {
    const wallet = await prisma.wallet.findFirst({
      where: { depositAddress: walletAddress },
      select: { id: true },
    });

    if (!wallet) {
      throw new Error(`No wallet found for address: ${walletAddress}`);
    }

    walletId = wallet.id;
    // Re-cache
    await redis.set(`deposit_addr:${walletAddress}`, walletId, 'EX', 60 * 60 * 24 * 365);
  }

  // 2. Load wallet with currency and network details
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    include: {
      currency: {
        include: {
          networks: true,
        },
      },
    },
  });

  if (!wallet) {
    throw new Error('Wallet not found');
  }

  if (!wallet.currency.isActive || !wallet.currency.isDepositEnabled) {
    throw new Error(`Deposits are disabled for ${wallet.currency.symbol}`);
  }

  // Determine required confirmations from the network
  const network = wallet.networkId
    ? wallet.currency.networks.find((n) => n.id === wallet.networkId)
    : wallet.currency.networks[0];

  const requiredConfirmations = network?.confirmations ?? 1;

  // 3. Check if we already have a transaction for this txHash
  const existing = await prisma.transaction.findFirst({
    where: {
      walletId: wallet.id,
      txHash,
      type: 'DEPOSIT',
    },
  });

  if (existing) {
    // Update confirmations
    if (existing.status === 'COMPLETED') {
      // Already fully processed
      return {
        id: existing.id,
        walletId: wallet.id,
        amount: existing.amount.toFixed(wallet.currency.decimals),
        currency: wallet.currency.symbol,
        status: existing.status,
        txHash: existing.txHash,
        confirmations: existing.confirmations,
        requiredConfirmations,
        credited: true,
        createdAt: existing.createdAt.toISOString(),
      };
    }

    // Update confirmation count
    if (confirmations >= requiredConfirmations) {
      // Credit the balance atomically
      const result = await prisma.$transaction(async (tx) => {
        const updatedTx = await tx.transaction.update({
          where: { id: existing.id },
          data: {
            confirmations,
            status: 'COMPLETED',
            metadata: {
              ...(typeof existing.metadata === 'object' && existing.metadata !== null
                ? existing.metadata
                : {}),
              completedAt: new Date().toISOString(),
              finalConfirmations: confirmations,
            },
          },
        });

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: depositAmount } },
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId: wallet.userId,
            type: 'DEPOSIT_CONFIRMED',
            title: 'Deposit Confirmed',
            message: `Your deposit of ${depositAmount.toFixed(wallet.currency.decimals)} ${wallet.currency.symbol} has been confirmed.`,
            data: {
              transactionId: updatedTx.id,
              amount: depositAmount.toString(),
              currency: wallet.currency.symbol,
              txHash,
            },
          },
        });

        return updatedTx;
      });

      return {
        id: result.id,
        walletId: wallet.id,
        amount: depositAmount.toFixed(wallet.currency.decimals),
        currency: wallet.currency.symbol,
        status: 'COMPLETED',
        txHash,
        confirmations,
        requiredConfirmations,
        credited: true,
        createdAt: result.createdAt.toISOString(),
      };
    }

    // Still confirming — just update count
    const updatedTx = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        confirmations,
        status: 'CONFIRMING',
      },
    });

    return {
      id: updatedTx.id,
      walletId: wallet.id,
      amount: depositAmount.toFixed(wallet.currency.decimals),
      currency: wallet.currency.symbol,
      status: 'CONFIRMING',
      txHash,
      confirmations,
      requiredConfirmations,
      credited: false,
      createdAt: updatedTx.createdAt.toISOString(),
    };
  }

  // 4. New deposit: create transaction
  const isConfirmed = confirmations >= requiredConfirmations;

  const result = await prisma.$transaction(async (tx) => {
    const newTx = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: depositAmount,
        fee: new Prisma.Decimal(0),
        txHash,
        fromAddress: walletAddress,
        networkId: wallet.networkId,
        status: isConfirmed ? 'COMPLETED' : 'CONFIRMING',
        confirmations,
        metadata: {
          detectedAt: new Date().toISOString(),
          requiredConfirmations,
          networkName: network?.networkName ?? 'unknown',
        },
      },
    });

    // Credit balance immediately if confirmed
    if (isConfirmed) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: depositAmount } },
      });

      // Create notification
      await tx.notification.create({
        data: {
          userId: wallet.userId,
          type: 'DEPOSIT_CONFIRMED',
          title: 'Deposit Confirmed',
          message: `Your deposit of ${depositAmount.toFixed(wallet.currency.decimals)} ${wallet.currency.symbol} has been confirmed.`,
          data: {
            transactionId: newTx.id,
            amount: depositAmount.toString(),
            currency: wallet.currency.symbol,
            txHash,
          },
        },
      });
    }

    return newTx;
  });

  return {
    id: result.id,
    walletId: wallet.id,
    amount: depositAmount.toFixed(wallet.currency.decimals),
    currency: wallet.currency.symbol,
    status: isConfirmed ? 'COMPLETED' : 'CONFIRMING',
    txHash,
    confirmations,
    requiredConfirmations,
    credited: isConfirmed,
    createdAt: result.createdAt.toISOString(),
  };
}

/**
 * Simulate a deposit for testing/development. Directly credits the wallet
 * and creates a COMPLETED transaction. NOT for production use.
 */
export async function simulateDeposit(
  userId: string,
  currencySymbol: string,
  amountStr: string,
): Promise<DepositResult> {
  const depositAmount = new Prisma.Decimal(amountStr);

  if (depositAmount.lte(0)) {
    throw new Error('Amount must be greater than 0');
  }

  const currency = await prisma.currency.findUnique({
    where: { symbol: currencySymbol.toUpperCase() },
  });

  if (!currency) {
    throw new Error(`Currency ${currencySymbol} not found`);
  }

  if (!currency.isActive) {
    throw new Error(`${currency.symbol} is currently not available`);
  }

  // Generate a mock tx hash
  const mockTxHash = `0xsim_${Date.now().toString(16)}_${Math.random().toString(36).slice(2, 10)}`;

  const result = await prisma.$transaction(async (tx) => {
    // Ensure wallet exists
    const wallet = await tx.wallet.upsert({
      where: { userId_currencyId: { userId, currencyId: currency.id } },
      create: { userId, currencyId: currency.id },
      update: {},
    });

    // Credit the balance
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: depositAmount } },
    });

    // Create completed transaction
    const transaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: depositAmount,
        fee: new Prisma.Decimal(0),
        txHash: mockTxHash,
        status: 'COMPLETED',
        confirmations: 999,
        metadata: {
          simulated: true,
          simulatedAt: new Date().toISOString(),
        },
      },
    });

    // Notify
    await tx.notification.create({
      data: {
        userId,
        type: 'DEPOSIT_CONFIRMED',
        title: 'Deposit Confirmed (Test)',
        message: `Test deposit of ${depositAmount.toFixed(currency.decimals)} ${currency.symbol} has been credited to your wallet.`,
        data: {
          transactionId: transaction.id,
          amount: depositAmount.toString(),
          currency: currency.symbol,
          simulated: true,
        },
      },
    });

    return { transaction, wallet };
  });

  return {
    id: result.transaction.id,
    walletId: result.wallet.id,
    amount: depositAmount.toFixed(currency.decimals),
    currency: currency.symbol,
    status: 'COMPLETED',
    txHash: mockTxHash,
    confirmations: 999,
    requiredConfirmations: 1,
    credited: true,
    createdAt: result.transaction.createdAt.toISOString(),
  };
}
