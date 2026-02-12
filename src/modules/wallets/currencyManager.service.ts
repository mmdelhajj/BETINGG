import prisma from '../../lib/prisma';
import { NotFoundError, ValidationError, AppError } from '../../utils/errors';
import { deleteCachePattern } from '../../lib/redis';

export class CurrencyManagerService {
  async getCurrencies(options?: { type?: string; active?: boolean }) {
    const where: any = {};
    if (options?.type) where.type = options.type;
    if (options?.active !== undefined) where.isActive = options.active;

    const currencies = await prisma.currency.findMany({
      where,
      include: { networks: true },
      orderBy: { sortOrder: 'asc' },
    });

    return currencies.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      type: c.type,
      icon: c.icon,
      exchangeRateUsd: c.exchangeRateUsd?.toString(),
      minWithdrawal: c.minWithdrawal?.toString(),
      withdrawalFee: c.withdrawalFee?.toString(),
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      networks: c.networks.map((n) => ({
        id: n.id,
        networkName: n.networkName,
        networkLabel: n.networkLabel,
        contractAddress: n.contractAddress,
        confirmations: n.confirmations,
        isActive: n.isActive,
      })),
    }));
  }

  async updateCurrency(symbol: string, data: {
    name?: string;
    exchangeRateUsd?: string;
    minWithdrawal?: string;
    withdrawalFee?: string;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const currency = await prisma.currency.findUnique({ where: { symbol } });
    if (!currency) throw new NotFoundError('Currency', symbol);

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.exchangeRateUsd !== undefined) updateData.exchangeRateUsd = parseFloat(data.exchangeRateUsd);
    if (data.minWithdrawal !== undefined) updateData.minWithdrawal = parseFloat(data.minWithdrawal);
    if (data.withdrawalFee !== undefined) updateData.withdrawalFee = parseFloat(data.withdrawalFee);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const updated = await prisma.currency.update({
      where: { symbol },
      data: updateData,
    });

    await deleteCachePattern('currencies:*');
    return updated;
  }

  async updateNetwork(networkId: string, data: {
    confirmations?: number;
    isActive?: boolean;
  }) {
    const network = await prisma.currencyNetwork.findUnique({ where: { id: networkId } });
    if (!network) throw new NotFoundError('Network', networkId);

    const updateData: any = {};
    if (data.confirmations !== undefined) updateData.confirmations = data.confirmations;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.currencyNetwork.update({
      where: { id: networkId },
      data: updateData,
    });

    await deleteCachePattern('currencies:*');
    return updated;
  }

  async updateExchangeRates() {
    // In production, fetch from CoinGecko/CoinMarketCap API
    // For now, return the current rates
    const currencies = await prisma.currency.findMany({
      where: { type: 'CRYPTO', isActive: true },
      select: { symbol: true, exchangeRateUsd: true },
    });

    return currencies.map((c) => ({
      symbol: c.symbol,
      exchangeRateUsd: c.exchangeRateUsd?.toString() || '0',
      updatedAt: new Date().toISOString(),
    }));
  }
}

export const currencyManagerService = new CurrencyManagerService();
