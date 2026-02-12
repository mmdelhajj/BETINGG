import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { NotFoundError, ValidationError } from '../../utils/errors';

export class FiatOnRampService {
  async getProviders() {
    const providers = await prisma.fiatOnRampProvider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      supportedFiats: p.supportedFiats,
      supportedCryptos: p.supportedCryptos,
      dailyLimit: p.dailyLimit?.toString(),
      monthlyLimit: p.monthlyLimit?.toString(),
      feePercent: p.feePercent?.toString(),
      config: p.config,
    }));
  }

  async createOrder(
    userId: string,
    providerId: string,
    fiatCurrency: string,
    cryptoCurrency: string,
    fiatAmount: string
  ) {
    const provider = await prisma.fiatOnRampProvider.findUnique({ where: { id: providerId } });
    if (!provider || !provider.isActive) throw new NotFoundError('Provider', providerId);

    const supportedFiats = provider.supportedFiats as string[];
    const supportedCryptos = provider.supportedCryptos as string[];

    if (!supportedFiats.includes(fiatCurrency)) {
      throw new ValidationError(`${fiatCurrency} not supported by this provider`);
    }
    if (!supportedCryptos.includes(cryptoCurrency)) {
      throw new ValidationError(`${cryptoCurrency} not supported by this provider`);
    }

    const amount = new Decimal(fiatAmount);
    if (provider.dailyLimit && amount.gt(provider.dailyLimit.toString())) {
      throw new ValidationError(`Amount exceeds daily limit of ${provider.dailyLimit} ${fiatCurrency}`);
    }

    const fee = amount.mul(provider.feePercent?.toString() || '0').div(100);
    const netAmount = amount.minus(fee);

    const currency = await prisma.currency.findUnique({ where: { symbol: cryptoCurrency } });
    if (!currency) throw new NotFoundError('Currency', cryptoCurrency);

    const rate = new Decimal(currency.exchangeRateUsd?.toString() || '1');
    const cryptoAmount = netAmount.div(rate);

    const orderId = `fiat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      orderId,
      provider: provider.name,
      fiatCurrency,
      fiatAmount,
      cryptoCurrency,
      estimatedCryptoAmount: cryptoAmount.toDecimalPlaces(8).toString(),
      fee: fee.toDecimalPlaces(2).toString(),
      rate: rate.toDecimalPlaces(2).toString(),
      redirectUrl: `https://checkout.${provider.name.toLowerCase()}.com/order/${orderId}`,
      expiresIn: 900,
    };
  }

  async handleCallback(orderId: string, status: string, txData: Record<string, unknown>) {
    return { orderId, status, processed: true };
  }
}

export const fiatOnRampService = new FiatOnRampService();
