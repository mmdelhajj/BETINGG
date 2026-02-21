import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Swap spread (0.5% fee taken from exchange rate) */
const SWAP_SPREAD_PERCENT = new Prisma.Decimal('0.005');

/** Minimum swap amount in USD equivalent */
const MIN_SWAP_USD = new Prisma.Decimal('1');

/** Maximum swap amount in USD equivalent per transaction */
const MAX_SWAP_USD = new Prisma.Decimal('100000');

/** Cache TTL for exchange rates (seconds) */
const RATE_CACHE_TTL = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SwapRate {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  inverseRate: string;
  spread: string;
  fromUsdRate: string;
  toUsdRate: string;
  estimatedUsdValue: string;
}

interface SwapResult {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  spread: string;
  fromTransactionId: string;
  toTransactionId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCurrencyRate(symbol: string): Promise<{
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  exchangeRateUsd: Prisma.Decimal;
  isActive: boolean;
}> {
  // Try cache first
  const cacheKey = `currency_rate:${symbol}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached) as {
      id: string;
      symbol: string;
      name: string;
      decimals: number;
      exchangeRateUsd: string;
      isActive: boolean;
    };
    return {
      ...parsed,
      exchangeRateUsd: new Prisma.Decimal(parsed.exchangeRateUsd),
    };
  }

  const currency = await prisma.currency.findUnique({
    where: { symbol: symbol.toUpperCase() },
    select: {
      id: true,
      symbol: true,
      name: true,
      decimals: true,
      exchangeRateUsd: true,
      isActive: true,
    },
  });

  if (!currency) {
    throw new Error(`Currency ${symbol} not found`);
  }

  // Cache the rate
  await redis.set(
    cacheKey,
    JSON.stringify({
      ...currency,
      exchangeRateUsd: currency.exchangeRateUsd.toString(),
    }),
    'EX',
    RATE_CACHE_TTL,
  );

  return currency;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Calculate the swap rate between two currencies including the spread.
 * Rate = (fromUsdRate / toUsdRate) * (1 - spread)
 */
export async function getSwapRate(
  fromCurrencySymbol: string,
  toCurrencySymbol: string,
  amountStr: string,
): Promise<SwapRate> {
  const fromUpper = fromCurrencySymbol.toUpperCase();
  const toUpper = toCurrencySymbol.toUpperCase();

  if (fromUpper === toUpper) {
    throw new Error('Cannot swap a currency to itself');
  }

  const [fromCurrency, toCurrency] = await Promise.all([
    getCurrencyRate(fromUpper),
    getCurrencyRate(toUpper),
  ]);

  if (!fromCurrency.isActive) {
    throw new Error(`${fromUpper} is currently not available`);
  }
  if (!toCurrency.isActive) {
    throw new Error(`${toUpper} is currently not available`);
  }

  if (toCurrency.exchangeRateUsd.eq(0)) {
    throw new Error(`Exchange rate for ${toUpper} is not available`);
  }

  const amount = new Prisma.Decimal(amountStr);

  // Calculate raw rate: how many toCurrency per 1 fromCurrency
  const rawRate = fromCurrency.exchangeRateUsd.div(toCurrency.exchangeRateUsd);

  // Apply spread: user gets slightly less
  const effectiveRate = rawRate.mul(new Prisma.Decimal(1).sub(SWAP_SPREAD_PERCENT));

  // Calculate output amount
  const toAmount = amount.mul(effectiveRate);

  // USD value for limit checks
  const usdValue = amount.mul(fromCurrency.exchangeRateUsd);

  return {
    fromCurrency: fromUpper,
    toCurrency: toUpper,
    fromAmount: amount.toFixed(fromCurrency.decimals),
    toAmount: toAmount.toFixed(toCurrency.decimals),
    rate: effectiveRate.toFixed(8),
    inverseRate: effectiveRate.eq(0)
      ? '0'
      : new Prisma.Decimal(1).div(effectiveRate).toFixed(8),
    spread: SWAP_SPREAD_PERCENT.mul(100).toFixed(2) + '%',
    fromUsdRate: fromCurrency.exchangeRateUsd.toFixed(8),
    toUsdRate: toCurrency.exchangeRateUsd.toFixed(8),
    estimatedUsdValue: usdValue.toFixed(2),
  };
}

/**
 * Execute a swap between two currencies. Atomic: deducts from source, credits target.
 * Creates two SWAP transactions linked via metadata.
 */
export async function executeSwap(
  userId: string,
  fromCurrencySymbol: string,
  toCurrencySymbol: string,
  amountStr: string,
): Promise<SwapResult> {
  const fromUpper = fromCurrencySymbol.toUpperCase();
  const toUpper = toCurrencySymbol.toUpperCase();

  if (fromUpper === toUpper) {
    throw new Error('Cannot swap a currency to itself');
  }

  // Fetch currencies
  const [fromCurrency, toCurrency] = await Promise.all([
    prisma.currency.findUnique({ where: { symbol: fromUpper } }),
    prisma.currency.findUnique({ where: { symbol: toUpper } }),
  ]);

  if (!fromCurrency) throw new Error(`Currency ${fromUpper} not found`);
  if (!toCurrency) throw new Error(`Currency ${toUpper} not found`);
  if (!fromCurrency.isActive) throw new Error(`${fromUpper} is currently not available`);
  if (!toCurrency.isActive) throw new Error(`${toUpper} is currently not available`);

  if (toCurrency.exchangeRateUsd.eq(0)) {
    throw new Error(`Exchange rate for ${toUpper} is not available`);
  }

  const amount = new Prisma.Decimal(amountStr);

  // Check minimum/maximum amounts
  const usdValue = amount.mul(fromCurrency.exchangeRateUsd);
  if (usdValue.lt(MIN_SWAP_USD)) {
    throw new Error(`Minimum swap amount is $${MIN_SWAP_USD.toFixed(2)} USD`);
  }
  if (usdValue.gt(MAX_SWAP_USD)) {
    throw new Error(`Maximum swap amount is $${MAX_SWAP_USD.toFixed(0)} USD per transaction`);
  }

  // Calculate rate with spread
  const rawRate = fromCurrency.exchangeRateUsd.div(toCurrency.exchangeRateUsd);
  const effectiveRate = rawRate.mul(new Prisma.Decimal(1).sub(SWAP_SPREAD_PERCENT));
  const toAmount = amount.mul(effectiveRate);

  // Generate a shared swap reference
  const swapRef = `swap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Execute atomically
  const result = await prisma.$transaction(async (tx) => {
    // 1. Get or create source wallet
    const fromWallet = await tx.wallet.findUnique({
      where: { userId_currencyId: { userId, currencyId: fromCurrency.id } },
    });

    if (!fromWallet) {
      throw new Error(`No ${fromUpper} wallet found. Please deposit first.`);
    }

    // Check available balance
    const available = fromWallet.balance.sub(fromWallet.lockedBalance);
    if (available.lt(amount)) {
      throw new Error(
        `Insufficient ${fromUpper} balance. Available: ${available.toFixed(fromCurrency.decimals)}, Required: ${amount.toFixed(fromCurrency.decimals)}`,
      );
    }

    // 2. Get or create target wallet
    const toWallet = await tx.wallet.upsert({
      where: { userId_currencyId: { userId, currencyId: toCurrency.id } },
      create: { userId, currencyId: toCurrency.id },
      update: {},
    });

    // 3. Deduct from source wallet
    await tx.wallet.update({
      where: { id: fromWallet.id },
      data: { balance: { decrement: amount } },
    });

    // 4. Credit target wallet
    await tx.wallet.update({
      where: { id: toWallet.id },
      data: { balance: { increment: toAmount } },
    });

    // 5. Create debit transaction (SWAP out)
    const fromTx = await tx.transaction.create({
      data: {
        walletId: fromWallet.id,
        type: 'SWAP',
        amount: amount,
        fee: new Prisma.Decimal(0),
        status: 'COMPLETED',
        metadata: {
          swapRef,
          direction: 'OUT',
          fromCurrency: fromUpper,
          toCurrency: toUpper,
          rate: effectiveRate.toString(),
          toAmount: toAmount.toString(),
          spread: SWAP_SPREAD_PERCENT.toString(),
        },
      },
    });

    // 6. Create credit transaction (SWAP in)
    const toTx = await tx.transaction.create({
      data: {
        walletId: toWallet.id,
        type: 'SWAP',
        amount: toAmount,
        fee: new Prisma.Decimal(0),
        status: 'COMPLETED',
        metadata: {
          swapRef,
          direction: 'IN',
          fromCurrency: fromUpper,
          toCurrency: toUpper,
          rate: effectiveRate.toString(),
          fromAmount: amount.toString(),
          spread: SWAP_SPREAD_PERCENT.toString(),
        },
      },
    });

    return { fromTx, toTx };
  });

  return {
    id: swapRef,
    fromCurrency: fromUpper,
    toCurrency: toUpper,
    fromAmount: amount.toFixed(fromCurrency.decimals),
    toAmount: toAmount.toFixed(toCurrency.decimals),
    rate: effectiveRate.toFixed(8),
    spread: SWAP_SPREAD_PERCENT.mul(100).toFixed(2) + '%',
    fromTransactionId: result.fromTx.id,
    toTransactionId: result.toTx.id,
    createdAt: result.fromTx.createdAt.toISOString(),
  };
}
