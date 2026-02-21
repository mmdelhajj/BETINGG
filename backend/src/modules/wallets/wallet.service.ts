import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import type { TransactionFilterInput } from './wallet.schemas.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalletWithCurrency {
  id: string;
  userId: string;
  currencyId: string;
  balance: Prisma.Decimal;
  lockedBalance: Prisma.Decimal;
  bonusBalance: Prisma.Decimal;
  depositAddress: string | null;
  networkId: string | null;
  createdAt: Date;
  updatedAt: Date;
  currency: {
    id: string;
    symbol: string;
    name: string;
    type: string;
    decimals: number;
    icon: string | null;
    isActive: boolean;
    isDepositEnabled: boolean;
    isWithdrawEnabled: boolean;
    exchangeRateUsd: Prisma.Decimal;
    minWithdrawal: Prisma.Decimal;
    withdrawalFee: Prisma.Decimal;
    networks: Array<{
      id: string;
      networkName: string;
      networkLabel: string;
      contractAddress: string | null;
      confirmations: number;
      isActive: boolean;
      estimatedTime: string | null;
      explorerUrl: string | null;
    }>;
  };
}

interface WalletSummary {
  id: string;
  currencyId: string;
  symbol: string;
  name: string;
  type: string;
  icon: string | null;
  decimals: number;
  balance: string;
  lockedBalance: string;
  bonusBalance: string;
  availableBalance: string;
  usdValue: string;
  depositAddress: string | null;
  isDepositEnabled: boolean;
  isWithdrawEnabled: boolean;
  networks: Array<{
    id: string;
    networkName: string;
    networkLabel: string;
    confirmations: number;
    isActive: boolean;
    estimatedTime: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Address generation helpers
// ---------------------------------------------------------------------------

const CHAIN_PREFIXES: Record<string, string> = {
  BITCOIN: '1',
  BTC: '1',
  ETHEREUM: '0x',
  ETH: '0x',
  ERC20: '0x',
  BSC: '0x',
  BEP20: '0x',
  POLYGON: '0x',
  ARBITRUM: '0x',
  OPTIMISM: '0x',
  AVALANCHE: '0x',
  BASE: '0x',
  TRON: 'T',
  TRC20: 'T',
  SOLANA: '',
  SOL: '',
  LITECOIN: 'L',
  LTC: 'L',
  RIPPLE: 'r',
  XRP: 'r',
  DOGECOIN: 'D',
  DOGE: 'D',
  CARDANO: 'addr1',
  ADA: 'addr1',
  POLKADOT: '1',
  DOT: '1',
  COSMOS: 'cosmos1',
  ATOM: 'cosmos1',
  NEAR: '',
  APTOS: '0x',
  SUI: '0x',
  TON: 'EQ',
};

function generateMockAddress(networkName: string): string {
  const upper = networkName.toUpperCase();
  const prefix = CHAIN_PREFIXES[upper] ?? '0x';
  const randomHex = crypto.randomBytes(20).toString('hex');

  if (prefix === '0x') {
    return `0x${randomHex.slice(0, 40)}`;
  }
  if (prefix === 'T') {
    return `T${crypto.randomBytes(21).toString('base64url').slice(0, 33)}`;
  }
  if (upper === 'SOLANA' || upper === 'SOL') {
    return crypto.randomBytes(32).toString('base64url').slice(0, 44);
  }
  if (prefix === 'addr1') {
    return `addr1${crypto.randomBytes(28).toString('hex').slice(0, 56)}`;
  }
  if (prefix === 'cosmos1') {
    return `cosmos1${crypto.randomBytes(20).toString('hex').slice(0, 38)}`;
  }
  if (prefix === 'EQ') {
    return `EQ${crypto.randomBytes(24).toString('base64url').slice(0, 46)}`;
  }

  return `${prefix}${randomHex.slice(0, 34)}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Ensure a single wallet exists for a user + currency. Returns the wallet.
 */
export async function createWallet(userId: string, currencyId: string) {
  return prisma.wallet.upsert({
    where: { userId_currencyId: { userId, currencyId } },
    create: { userId, currencyId },
    update: {},
    include: {
      currency: {
        include: {
          networks: {
            where: { isActive: true },
            orderBy: { networkName: 'asc' },
          },
        },
      },
    },
  });
}

/**
 * Auto-create wallets for every active currency. Idempotent.
 */
export async function ensureWallets(userId: string): Promise<void> {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (currencies.length === 0) return;

  // Use createMany with skipDuplicates for efficiency
  await prisma.wallet.createMany({
    data: currencies.map((c) => ({ userId, currencyId: c.id })),
    skipDuplicates: true,
  });
}

/**
 * Get all wallets for a user with balances and USD equivalents.
 */
export async function getUserWallets(userId: string): Promise<WalletSummary[]> {
  // Ensure wallets exist for all active currencies
  await ensureWallets(userId);

  const wallets = (await prisma.wallet.findMany({
    where: { userId },
    include: {
      currency: {
        include: {
          networks: {
            where: { isActive: true },
            orderBy: { networkName: 'asc' },
          },
        },
      },
    },
    orderBy: [
      { currency: { sortOrder: 'asc' } },
      { currency: { symbol: 'asc' } },
    ],
  })) as WalletWithCurrency[];

  return wallets
    .filter((w) => w.currency.isActive)
    .map((w) => {
      const balance = new Prisma.Decimal(w.balance);
      const locked = new Prisma.Decimal(w.lockedBalance);
      const bonus = new Prisma.Decimal(w.bonusBalance);
      const available = balance.minus(locked);
      const rate = new Prisma.Decimal(w.currency.exchangeRateUsd);
      const usdValue = balance.mul(rate);

      return {
        id: w.id,
        currencyId: w.currencyId,
        symbol: w.currency.symbol,
        name: w.currency.name,
        type: w.currency.type,
        icon: w.currency.icon,
        decimals: w.currency.decimals,
        balance: balance.toFixed(w.currency.decimals),
        lockedBalance: locked.toFixed(w.currency.decimals),
        bonusBalance: bonus.toFixed(w.currency.decimals),
        availableBalance: available.toFixed(w.currency.decimals),
        usdValue: usdValue.toFixed(2),
        depositAddress: w.depositAddress,
        isDepositEnabled: w.currency.isDepositEnabled,
        isWithdrawEnabled: w.currency.isWithdrawEnabled,
        networks: w.currency.networks.map((n) => ({
          id: n.id,
          networkName: n.networkName,
          networkLabel: n.networkLabel,
          confirmations: n.confirmations,
          isActive: n.isActive,
          estimatedTime: n.estimatedTime,
        })),
      };
    });
}

/**
 * Get a specific wallet by currency symbol.
 */
export async function getWallet(
  userId: string,
  currencySymbol: string,
): Promise<WalletSummary | null> {
  const currency = await prisma.currency.findUnique({
    where: { symbol: currencySymbol.toUpperCase() },
    select: { id: true },
  });

  if (!currency) return null;

  // Ensure wallet exists
  const wallet = (await createWallet(userId, currency.id)) as WalletWithCurrency;

  const balance = new Prisma.Decimal(wallet.balance);
  const locked = new Prisma.Decimal(wallet.lockedBalance);
  const bonus = new Prisma.Decimal(wallet.bonusBalance);
  const available = balance.minus(locked);
  const rate = new Prisma.Decimal(wallet.currency.exchangeRateUsd);
  const usdValue = balance.mul(rate);

  return {
    id: wallet.id,
    currencyId: wallet.currencyId,
    symbol: wallet.currency.symbol,
    name: wallet.currency.name,
    type: wallet.currency.type,
    icon: wallet.currency.icon,
    decimals: wallet.currency.decimals,
    balance: balance.toFixed(wallet.currency.decimals),
    lockedBalance: locked.toFixed(wallet.currency.decimals),
    bonusBalance: bonus.toFixed(wallet.currency.decimals),
    availableBalance: available.toFixed(wallet.currency.decimals),
    usdValue: usdValue.toFixed(2),
    depositAddress: wallet.depositAddress,
    isDepositEnabled: wallet.currency.isDepositEnabled,
    isWithdrawEnabled: wallet.currency.isWithdrawEnabled,
    networks: wallet.currency.networks.map((n) => ({
      id: n.id,
      networkName: n.networkName,
      networkLabel: n.networkLabel,
      confirmations: n.confirmations,
      isActive: n.isActive,
      estimatedTime: n.estimatedTime,
    })),
  };
}

/**
 * Generate (or return existing) deposit address for a wallet on a given network.
 */
export async function generateDepositAddress(
  userId: string,
  currencySymbol: string,
  networkId: string,
): Promise<{ address: string; qrData: string; network: string }> {
  const currency = await prisma.currency.findUnique({
    where: { symbol: currencySymbol.toUpperCase() },
    include: {
      networks: { where: { id: networkId, isActive: true } },
    },
  });

  if (!currency) {
    throw new Error('Currency not found');
  }

  if (!currency.isActive || !currency.isDepositEnabled) {
    throw new Error('Deposits are currently disabled for this currency');
  }

  const network = currency.networks[0];
  if (!network) {
    throw new Error('Network not found or not active for this currency');
  }

  // Find or create the wallet
  let wallet = await prisma.wallet.findUnique({
    where: { userId_currencyId: { userId, currencyId: currency.id } },
  });

  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, currencyId: currency.id },
    });
  }

  // If the wallet already has an address for this network, return it
  if (wallet.depositAddress && wallet.networkId === networkId) {
    const qrData = buildQrData(currency.symbol, wallet.depositAddress, network.networkName);
    return {
      address: wallet.depositAddress,
      qrData,
      network: network.networkLabel,
    };
  }

  // Generate a new mock address
  const address = generateMockAddress(network.networkName);

  // Store it on the wallet
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { depositAddress: address, networkId },
  });

  // Cache the address -> wallet mapping for deposit detection
  await redis.set(`deposit_addr:${address}`, wallet.id, 'EX', 60 * 60 * 24 * 365);

  const qrData = buildQrData(currency.symbol, address, network.networkName);

  return {
    address,
    qrData,
    network: network.networkLabel,
  };
}

function buildQrData(symbol: string, address: string, networkName: string): string {
  const upper = networkName.toUpperCase();

  if (upper.includes('BITCOIN') || upper === 'BTC') {
    return `bitcoin:${address}`;
  }
  if (
    upper.includes('ETHEREUM') ||
    upper === 'ETH' ||
    upper === 'ERC20' ||
    upper === 'BSC' ||
    upper === 'BEP20' ||
    upper === 'POLYGON' ||
    upper === 'ARBITRUM' ||
    upper === 'OPTIMISM' ||
    upper === 'AVALANCHE' ||
    upper === 'BASE'
  ) {
    return `ethereum:${address}`;
  }
  if (upper.includes('LITECOIN') || upper === 'LTC') {
    return `litecoin:${address}`;
  }

  // Fallback: plain address
  return `${symbol.toLowerCase()}:${address}`;
}

/**
 * Get paginated, filtered transaction history for a user.
 */
export async function getTransactions(
  userId: string,
  filters: TransactionFilterInput,
): Promise<{
  transactions: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { type, currency, status, dateFrom, dateTo, page, limit } = filters;

  // Build the where clause scoped to user wallets
  const walletIds = await prisma.wallet.findMany({
    where: { userId },
    select: { id: true, currency: { select: { symbol: true } } },
  });

  const walletIdSet = new Set(walletIds.map((w) => w.id));

  // If filtering by currency, narrow down to that wallet
  let filteredWalletIds: string[];
  if (currency) {
    const upperCurrency = currency.toUpperCase();
    filteredWalletIds = walletIds
      .filter((w) => w.currency.symbol === upperCurrency)
      .map((w) => w.id);
  } else {
    filteredWalletIds = [...walletIdSet];
  }

  if (filteredWalletIds.length === 0) {
    return { transactions: [], total: 0, page, limit, totalPages: 0 };
  }

  const where: Prisma.TransactionWhereInput = {
    walletId: { in: filteredWalletIds },
    ...(type ? { type: type as Prisma.EnumTxTypeFilter['equals'] } : {}),
    ...(status ? { status: status as Prisma.EnumTxStatusFilter['equals'] } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        wallet: {
          select: {
            currency: {
              select: { symbol: true, name: true, decimals: true, exchangeRateUsd: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    transactions: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toFixed(tx.wallet.currency.decimals),
      fee: tx.fee.toFixed(tx.wallet.currency.decimals),
      currency: tx.wallet.currency.symbol,
      currencyName: tx.wallet.currency.name,
      status: tx.status,
      txHash: tx.txHash,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      networkId: tx.networkId,
      confirmations: tx.confirmations,
      metadata: tx.metadata,
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Admin: Get all transactions with extended filters.
 */
export async function getAdminTransactions(
  filters: TransactionFilterInput & { userId?: string; walletId?: string },
): Promise<{
  transactions: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { type, currency, status, dateFrom, dateTo, page, limit, userId, walletId } = filters;

  const where: Prisma.TransactionWhereInput = {
    ...(walletId ? { walletId } : {}),
    ...(type ? { type: type as Prisma.EnumTxTypeFilter['equals'] } : {}),
    ...(status ? { status: status as Prisma.EnumTxStatusFilter['equals'] } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  // Scope by user if provided
  if (userId) {
    const userWalletIds = await prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
    });
    where.walletId = { in: userWalletIds.map((w) => w.id) };
  }

  // Scope by currency if provided
  if (currency) {
    const cur = await prisma.currency.findUnique({
      where: { symbol: currency.toUpperCase() },
      select: { id: true },
    });
    if (cur) {
      const currencyWalletIds = await prisma.wallet.findMany({
        where: { currencyId: cur.id, ...(userId ? { userId } : {}) },
        select: { id: true },
      });
      where.walletId = { in: currencyWalletIds.map((w) => w.id) };
    } else {
      return { transactions: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        wallet: {
          select: {
            userId: true,
            currency: {
              select: { symbol: true, name: true, decimals: true, exchangeRateUsd: true },
            },
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    transactions: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount.toFixed(tx.wallet.currency.decimals),
      fee: tx.fee.toFixed(tx.wallet.currency.decimals),
      currency: tx.wallet.currency.symbol,
      currencyName: tx.wallet.currency.name,
      status: tx.status,
      txHash: tx.txHash,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      networkId: tx.networkId,
      confirmations: tx.confirmations,
      approvedBy: tx.approvedBy,
      rejectedReason: tx.rejectedReason,
      metadata: tx.metadata,
      user: {
        id: tx.wallet.userId,
        username: tx.wallet.user.username,
        email: tx.wallet.user.email,
      },
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages,
  };
}
