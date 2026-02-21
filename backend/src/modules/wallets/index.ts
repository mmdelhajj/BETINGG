// ---------------------------------------------------------------------------
// Wallet module barrel export
// ---------------------------------------------------------------------------

export { default as walletRoutes } from './wallet.routes.js';

export * as walletService from './wallet.service.js';
export * as withdrawalService from './withdrawal.service.js';
export * as swapService from './swap.service.js';
export * as depositService from './deposit.service.js';

export {
  generateAddressSchema,
  withdrawSchema,
  swapSchema,
  swapRateSchema,
  transactionFilterSchema,
  createCurrencySchema,
  updateCurrencySchema,
  createNetworkSchema,
  updateNetworkSchema,
  rejectWithdrawalSchema,
  adminTransactionFilterSchema,
} from './wallet.schemas.js';

export type {
  GenerateAddressInput,
  WithdrawInput,
  SwapInput,
  SwapRateInput,
  TransactionFilterInput,
  CreateCurrencyInput,
  UpdateCurrencyInput,
  CreateNetworkInput,
  UpdateNetworkInput,
  RejectWithdrawalInput,
  AdminTransactionFilterInput,
} from './wallet.schemas.js';
