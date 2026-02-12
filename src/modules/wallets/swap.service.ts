import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { NotFoundError, InsufficientBalanceError, ValidationError } from '../../utils/errors';
import { deleteCache } from '../../lib/redis';

const SWAP_FEE_PERCENT = 0.5;

export class SwapService {
  async getSwapQuote(fromCurrency: string, toCurrency: string, amount: string) {
    if (fromCurrency === toCurrency) throw new ValidationError('Cannot swap same currency');

    const amountDecimal = new Decimal(amount);
    if (amountDecimal.lte(0)) throw new ValidationError('Amount must be positive');

    const [fromCurr, toCurr] = await Promise.all([
      prisma.currency.findUnique({ where: { symbol: fromCurrency } }),
      prisma.currency.findUnique({ where: { symbol: toCurrency } }),
    ]);

    if (!fromCurr || !fromCurr.isActive) throw new NotFoundError('Currency', fromCurrency);
    if (!toCurr || !toCurr.isActive) throw new NotFoundError('Currency', toCurrency);

    const fromRate = new Decimal(fromCurr.exchangeRateUsd?.toString() || '1');
    const toRate = new Decimal(toCurr.exchangeRateUsd?.toString() || '1');

    const usdValue = amountDecimal.mul(fromRate);
    const fee = usdValue.mul(SWAP_FEE_PERCENT).div(100);
    const netUsd = usdValue.minus(fee);
    const toAmount = netUsd.div(toRate);

    return {
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: toAmount.toDecimalPlaces(8).toString(),
      rate: fromRate.div(toRate).toDecimalPlaces(8).toString(),
      fee: fee.div(toRate).toDecimalPlaces(8).toString(),
      feePercent: SWAP_FEE_PERCENT,
      expiresIn: 30,
    };
  }

  async executeSwap(userId: string, fromCurrency: string, toCurrency: string, amount: string) {
    const quote = await this.getSwapQuote(fromCurrency, toCurrency, amount);
    const amountDecimal = new Decimal(amount);
    const toAmountDecimal = new Decimal(quote.toAmount);

    const [fromWallet, toWallet] = await Promise.all([
      prisma.wallet.findFirst({ where: { userId, currency: { symbol: fromCurrency } } }),
      prisma.wallet.findFirst({ where: { userId, currency: { symbol: toCurrency } } }),
    ]);

    if (!fromWallet) throw new NotFoundError('Wallet', fromCurrency);
    if (!toWallet) throw new NotFoundError('Wallet', toCurrency);

    const balance = new Decimal(fromWallet.balance.toString());
    if (balance.lt(amountDecimal)) throw new InsufficientBalanceError();

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: fromWallet.id },
        data: { balance: { decrement: amountDecimal.toNumber() } },
      }),
      prisma.wallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: toAmountDecimal.toNumber() } },
      }),
      prisma.transaction.create({
        data: {
          walletId: fromWallet.id,
          type: 'SWAP',
          amount: amountDecimal.negated().toNumber(),
          status: 'COMPLETED',
          metadata: { toCurrency, toAmount: quote.toAmount, rate: quote.rate, fee: quote.fee },
        },
      }),
      prisma.transaction.create({
        data: {
          walletId: toWallet.id,
          type: 'SWAP',
          amount: toAmountDecimal.toNumber(),
          status: 'COMPLETED',
          metadata: { fromCurrency, fromAmount: amount, rate: quote.rate },
        },
      }),
    ]);

    await Promise.all([
      deleteCache(`balance:${userId}:${fromCurrency}`),
      deleteCache(`balance:${userId}:${toCurrency}`),
    ]);

    return {
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: quote.toAmount,
      rate: quote.rate,
      fee: quote.fee,
      status: 'COMPLETED',
    };
  }
}

export const swapService = new SwapService();
