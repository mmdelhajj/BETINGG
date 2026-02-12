// ─── Blockchain Services ────────────────────────────────────────────────────
// Re-exports all blockchain infrastructure for easy importing.

export { hdWalletManager } from './hdWallet';
export type { DerivedAddress, DerivedKeyPair } from './hdWallet';

export { getProvider, clearProviderCache, initializeAllProviders } from './providers';
export type { BlockchainProvider, TransactionInfo, FeeEstimate, UTXOInfo, BlockInfo } from './providers';

export { depositMonitor } from './depositMonitor';
export { withdrawalBroadcaster } from './withdrawalBroadcaster';
export type { WithdrawalRequest } from './withdrawalBroadcaster';
