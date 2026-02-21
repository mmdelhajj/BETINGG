import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const positiveDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a valid positive number string')
  .refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than 0' });

const currencySymbol = z
  .string()
  .min(1, 'Currency symbol is required')
  .max(20)
  .transform((v) => v.toUpperCase());

// ---------------------------------------------------------------------------
// Generate deposit address
// ---------------------------------------------------------------------------

export const generateAddressSchema = z.object({
  networkId: z.string().min(1, 'Network ID is required'),
});

export type GenerateAddressInput = z.infer<typeof generateAddressSchema>;

// ---------------------------------------------------------------------------
// Withdrawal request
// ---------------------------------------------------------------------------

export const withdrawSchema = z.object({
  currency: currencySymbol,
  amount: positiveDecimalString,
  toAddress: z.string().min(1, 'Destination address is required').max(256),
  networkId: z.string().min(1, 'Network ID is required'),
  twoFactorToken: z.string().length(6).optional(),
});

export type WithdrawInput = z.infer<typeof withdrawSchema>;

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

export const swapSchema = z.object({
  fromCurrency: currencySymbol,
  toCurrency: currencySymbol,
  amount: positiveDecimalString,
});

export type SwapInput = z.infer<typeof swapSchema>;

// ---------------------------------------------------------------------------
// Swap rate query
// ---------------------------------------------------------------------------

export const swapRateSchema = z.object({
  fromCurrency: currencySymbol,
  toCurrency: currencySymbol,
  amount: positiveDecimalString,
});

export type SwapRateInput = z.infer<typeof swapRateSchema>;

// ---------------------------------------------------------------------------
// Transaction history filters
// ---------------------------------------------------------------------------

export const transactionFilterSchema = z.object({
  type: z
    .enum([
      'DEPOSIT',
      'WITHDRAWAL',
      'BET',
      'WIN',
      'BONUS',
      'RAKEBACK',
      'REWARD',
      'REFERRAL',
      'ADJUSTMENT',
      'SWAP',
    ])
    .optional(),
  currency: z.string().max(20).optional(),
  status: z
    .enum([
      'PENDING',
      'CONFIRMING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'APPROVED',
      'REJECTED',
    ])
    .optional(),
  dateFrom: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  dateTo: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;

// ---------------------------------------------------------------------------
// Admin: Currency management
// ---------------------------------------------------------------------------

export const createCurrencySchema = z.object({
  symbol: currencySymbol,
  name: z.string().min(1).max(100),
  type: z.enum(['CRYPTO', 'FIAT', 'STABLECOIN']),
  decimals: z.number().int().min(0).max(18),
  icon: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true),
  isDepositEnabled: z.boolean().default(true),
  isWithdrawEnabled: z.boolean().default(true),
  minWithdrawal: positiveDecimalString,
  withdrawalFee: z.string().regex(/^\d+(\.\d+)?$/, 'Must be a valid number string'),
  exchangeRateUsd: positiveDecimalString,
  sortOrder: z.number().int().default(0),
});

export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;

export const updateCurrencySchema = createCurrencySchema.partial();

export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;

// ---------------------------------------------------------------------------
// Admin: Network management
// ---------------------------------------------------------------------------

export const createNetworkSchema = z.object({
  networkName: z.string().min(1).max(50),
  networkLabel: z.string().min(1).max(100),
  contractAddress: z.string().max(256).optional().nullable(),
  confirmations: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  estimatedTime: z.string().max(50).optional().nullable(),
  rpcUrl: z.string().url().optional().nullable(),
  explorerUrl: z.string().url().optional().nullable(),
});

export type CreateNetworkInput = z.infer<typeof createNetworkSchema>;

export const updateNetworkSchema = createNetworkSchema.partial();

export type UpdateNetworkInput = z.infer<typeof updateNetworkSchema>;

// ---------------------------------------------------------------------------
// Admin: Withdrawal action
// ---------------------------------------------------------------------------

export const rejectWithdrawalSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

export type RejectWithdrawalInput = z.infer<typeof rejectWithdrawalSchema>;

// ---------------------------------------------------------------------------
// Admin: Transaction filters (superset of user filters)
// ---------------------------------------------------------------------------

export const adminTransactionFilterSchema = transactionFilterSchema.extend({
  userId: z.string().optional(),
  walletId: z.string().optional(),
});

export type AdminTransactionFilterInput = z.infer<typeof adminTransactionFilterSchema>;
