// ─── TRON Blockchain Provider ───────────────────────────────────────────────
// Supports TRX native and TRC-20 tokens (USDT) via TronGrid API.
// TRON uses the same ECDSA keys as Ethereum but with different address encoding.

import Decimal from 'decimal.js';
import { sha256 } from '@noble/hashes/sha256';
import bs58check from 'bs58check';
import { getChainConfig, ChainConfig, TRON_API_KEY } from '../../../config/blockchain';
import {
  BlockchainProvider,
  TransactionInfo,
  FeeEstimate,
} from './index';

const RPC_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

// TRC-20 function selectors (first 4 bytes of keccak256 hash)
const TRC20_TRANSFER_SELECTOR = 'a9059cbb';
const TRC20_BALANCE_SELECTOR = '70a08231';
const TRC20_DECIMALS_SELECTOR = '313ce567';

// TRON energy/bandwidth costs
const BANDWIDTH_COST_SUN = 1000; // 1000 sun per bandwidth point
const ENERGY_COST_SUN = 420;     // Approximate energy cost per unit in sun

export class TronProvider implements BlockchainProvider {
  readonly chainId = 'TRX' as const;
  private config: ChainConfig;
  private apiUrl: string;

  constructor() {
    this.config = getChainConfig('TRX');
    this.apiUrl = this.config.rpcUrl;
  }

  // ─── Core Methods ─────────────────────────────────────────────────────────

  async getBalance(address: string): Promise<string> {
    return this.withRetry(async () => {
      const data = await this.tronApiPost('/wallet/getaccount', {
        address: this.addressToHex(address),
        visible: false,
      });

      // Balance is in SUN (1 TRX = 1,000,000 SUN)
      return (data.balance || 0).toString();
    }, 'getBalance');
  }

  async getTokenBalance(address: string, tokenContractAddress: string): Promise<string> {
    return this.withRetry(async () => {
      const ownerAddressHex = this.addressToHex(address).replace('0x', '').replace('41', '');
      const paddedAddress = ownerAddressHex.padStart(64, '0');

      const data = await this.tronApiPost('/wallet/triggersmartcontract', {
        owner_address: this.addressToHex(address),
        contract_address: this.addressToHex(tokenContractAddress),
        function_selector: 'balanceOf(address)',
        parameter: paddedAddress,
        visible: false,
      });

      if (data.result?.result && data.constant_result?.[0]) {
        const hex = data.constant_result[0];
        return BigInt('0x' + hex).toString();
      }

      return '0';
    }, 'getTokenBalance');
  }

  async getTransactionConfirmations(txHash: string): Promise<number> {
    return this.withRetry(async () => {
      const txInfo = await this.getTransactionInfo(txHash);
      return txInfo?.confirmations || 0;
    }, 'getTransactionConfirmations');
  }

  async getTransactionInfo(txHash: string): Promise<TransactionInfo | null> {
    return this.withRetry(async () => {
      // First get the transaction details
      const txData = await this.tronApiPost('/wallet/gettransactionbyid', {
        value: txHash,
      });

      if (!txData || !txData.txID) return null;

      // Then get the transaction info for confirmation status
      const txInfoData = await this.tronApiPost('/wallet/gettransactioninfobyid', {
        value: txHash,
      });

      let confirmations = 0;
      let status: TransactionInfo['status'] = 'pending';

      if (txInfoData.blockNumber) {
        const currentBlock = await this.getBlockNumber();
        confirmations = Math.max(0, currentBlock - txInfoData.blockNumber + 1);

        // Check receipt status
        if (txInfoData.receipt) {
          status = txInfoData.receipt.result === 'SUCCESS' ? 'confirmed' : 'failed';
        } else {
          status = 'confirmed';
        }
      }

      // Parse the transaction type
      const contract = txData.raw_data?.contract?.[0];
      if (!contract) return null;

      let from = '';
      let to = '';
      let amount = '0';
      let tokenSymbol: string | undefined;
      let tokenAddress: string | undefined;

      if (contract.type === 'TransferContract') {
        // Native TRX transfer
        from = this.hexToAddress(contract.parameter?.value?.owner_address || '');
        to = this.hexToAddress(contract.parameter?.value?.to_address || '');
        amount = (contract.parameter?.value?.amount || 0).toString();
      } else if (contract.type === 'TriggerSmartContract') {
        // TRC-20 token transfer
        from = this.hexToAddress(contract.parameter?.value?.owner_address || '');
        const contractAddr = this.hexToAddress(contract.parameter?.value?.contract_address || '');

        // Parse the data field for transfer(address,uint256)
        const callData = contract.parameter?.value?.data || '';
        if (callData.startsWith(TRC20_TRANSFER_SELECTOR)) {
          const toHex = '41' + callData.substring(32, 72);
          to = this.hexToAddress(toHex);
          amount = BigInt('0x' + callData.substring(72)).toString();
          tokenAddress = contractAddr;

          // Check if it's a known token
          const tokenConfig = this.config.tokens.find(
            (t) => t.address === contractAddr
          );
          tokenSymbol = tokenConfig?.symbol;
        }
      }

      return {
        txHash,
        from,
        to,
        amount,
        confirmations,
        blockNumber: txInfoData.blockNumber || null,
        status,
        timestamp: txInfoData.blockTimeStamp
          ? Math.floor(txInfoData.blockTimeStamp / 1000)
          : undefined,
        tokenSymbol,
        tokenAddress,
      };
    }, 'getTransactionInfo');
  }

  async broadcastTransaction(signedTxJson: string): Promise<string> {
    return this.withRetry(async () => {
      const signedTx = JSON.parse(signedTxJson);

      const data = await this.tronApiPost('/wallet/broadcasttransaction', signedTx);

      if (data.result) {
        const txHash = data.txid || signedTx.txID;
        console.log(`[TRX] Transaction broadcast: ${txHash}`);
        return txHash;
      }

      throw new Error(`Broadcast failed: ${data.message || JSON.stringify(data)}`);
    }, 'broadcastTransaction');
  }

  async getBlockNumber(): Promise<number> {
    return this.withRetry(async () => {
      const data = await this.tronApiPost('/wallet/getnowblock', {});
      return data.block_header?.raw_data?.number || 0;
    }, 'getBlockNumber');
  }

  isValidAddress(address: string): boolean {
    try {
      if (address.startsWith('T')) {
        // Base58Check encoded address
        const decoded = bs58check.decode(address);
        return decoded.length === 25 && decoded[0] === 0x41;
      }
      if (address.startsWith('41') && address.length === 42) {
        // Hex format
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async estimateFee(to: string, amount: string, tokenAddress?: string): Promise<FeeEstimate> {
    return this.withRetry(async () => {
      let estimatedFee: number;

      if (tokenAddress) {
        // TRC-20 transfer typically costs 10-30 TRX worth of energy
        // Energy cost varies based on the contract
        estimatedFee = 15_000_000; // 15 TRX in SUN (conservative estimate)
      } else {
        // Native TRX transfer costs bandwidth
        // Each TRX transfer is about 267 bytes, costing ~267 bandwidth
        // If user has enough bandwidth, it's free. Otherwise, ~0.267 TRX
        estimatedFee = 1_000_000; // 1 TRX in SUN
      }

      return {
        fee: estimatedFee.toString(),
        feeRate: estimatedFee.toString(),
        estimatedTimeSeconds: Math.ceil(
          (this.config.confirmationsRequired * this.config.blockTimeMs) / 1000
        ),
      };
    }, 'estimateFee');
  }

  async getAddressTransactions(address: string, _fromBlock?: number): Promise<TransactionInfo[]> {
    return this.withRetry(async () => {
      const transactions: TransactionInfo[] = [];
      const addressHex = this.addressToHex(address);

      // Get native TRX transfers
      try {
        const nativeTxs = await this.tronApiGet(
          `/v1/accounts/${address}/transactions?limit=50&only_to=true`
        );

        if (nativeTxs.data && Array.isArray(nativeTxs.data)) {
          for (const tx of nativeTxs.data) {
            const contract = tx.raw_data?.contract?.[0];
            if (!contract || contract.type !== 'TransferContract') continue;

            const toAddr = this.hexToAddress(contract.parameter?.value?.to_address || '');
            if (toAddr.toLowerCase() !== address.toLowerCase()) continue;

            const currentBlock = await this.getBlockNumber();
            const blockNum = tx.blockNumber || 0;
            const confirmations = blockNum ? Math.max(0, currentBlock - blockNum + 1) : 0;

            transactions.push({
              txHash: tx.txID,
              from: this.hexToAddress(contract.parameter?.value?.owner_address || ''),
              to: toAddr,
              amount: (contract.parameter?.value?.amount || 0).toString(),
              confirmations,
              blockNumber: blockNum || null,
              status: tx.ret?.[0]?.contractRet === 'SUCCESS' ? 'confirmed' : 'pending',
              timestamp: tx.block_timestamp
                ? Math.floor(tx.block_timestamp / 1000)
                : undefined,
            });
          }
        }
      } catch (err) {
        console.warn('[TRX] Failed to fetch native transactions:', (err as Error).message);
      }

      // Get TRC-20 token transfers
      try {
        const tokenTxs = await this.tronApiGet(
          `/v1/accounts/${address}/transactions/trc20?limit=50&only_to=true`
        );

        if (tokenTxs.data && Array.isArray(tokenTxs.data)) {
          for (const tx of tokenTxs.data) {
            if (tx.to?.toLowerCase() !== address.toLowerCase()) continue;

            const tokenConfig = this.config.tokens.find(
              (t) => t.address === tx.token_info?.address
            );

            const currentBlock = await this.getBlockNumber();
            const blockNum = tx.block_timestamp ? 0 : 0; // TRC20 API doesn't always include block
            const confirmations = this.config.confirmationsRequired; // Assume confirmed if in API response

            transactions.push({
              txHash: tx.transaction_id,
              from: tx.from || '',
              to: tx.to || '',
              amount: tx.value || '0',
              confirmations,
              blockNumber: null,
              status: 'confirmed',
              timestamp: tx.block_timestamp
                ? Math.floor(tx.block_timestamp / 1000)
                : undefined,
              tokenSymbol: tokenConfig?.symbol || tx.token_info?.symbol,
              tokenAddress: tx.token_info?.address,
            });
          }
        }
      } catch (err) {
        console.warn('[TRX] Failed to fetch TRC-20 transactions:', (err as Error).message);
      }

      return transactions;
    }, 'getAddressTransactions');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const blockNumber = await Promise.race([
        this.getBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), RPC_TIMEOUT_MS)
        ),
      ]);
      return typeof blockNumber === 'number' && blockNumber > 0;
    } catch {
      return false;
    }
  }

  // ─── TRON-specific helpers ────────────────────────────────────────────────

  /**
   * Create a native TRX transfer transaction.
   * Returns the unsigned transaction object for signing.
   */
  async createNativeTransfer(
    fromAddress: string,
    toAddress: string,
    amountSun: number
  ): Promise<Record<string, unknown>> {
    const data = await this.tronApiPost('/wallet/createtransaction', {
      owner_address: this.addressToHex(fromAddress),
      to_address: this.addressToHex(toAddress),
      amount: amountSun,
      visible: false,
    });

    if (!data.txID) {
      throw new Error(`Failed to create TRX transfer: ${JSON.stringify(data)}`);
    }

    return data;
  }

  /**
   * Create a TRC-20 token transfer transaction.
   */
  async createTokenTransfer(
    fromAddress: string,
    tokenContractAddress: string,
    toAddress: string,
    amount: string
  ): Promise<Record<string, unknown>> {
    const toHex = this.addressToHex(toAddress).replace('41', '');
    const paddedTo = toHex.padStart(64, '0');
    const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
    const parameter = paddedTo + paddedAmount;

    const data = await this.tronApiPost('/wallet/triggersmartcontract', {
      owner_address: this.addressToHex(fromAddress),
      contract_address: this.addressToHex(tokenContractAddress),
      function_selector: 'transfer(address,uint256)',
      parameter,
      fee_limit: 100_000_000, // 100 TRX max fee
      visible: false,
    });

    if (!data.transaction?.txID) {
      throw new Error(`Failed to create TRC-20 transfer: ${JSON.stringify(data)}`);
    }

    return data.transaction;
  }

  /**
   * Convert SUN to TRX.
   */
  fromSun(sun: string): string {
    return new Decimal(sun).div(1_000_000).toFixed(6);
  }

  /**
   * Convert TRX to SUN.
   */
  toSun(trx: string): string {
    return new Decimal(trx).mul(1_000_000).toFixed(0);
  }

  // ─── Address conversion helpers ───────────────────────────────────────────

  /**
   * Convert a TRON Base58Check address to hex format (41-prefixed).
   */
  addressToHex(address: string): string {
    if (address.startsWith('41') && address.length === 42) {
      return address; // Already hex
    }

    if (address.startsWith('T')) {
      const decoded = bs58check.decode(address);
      return Buffer.from(decoded).toString('hex');
    }

    throw new Error(`Invalid TRON address format: ${address}`);
  }

  /**
   * Convert a hex address (41-prefixed) to TRON Base58Check format.
   */
  hexToAddress(hex: string): string {
    if (!hex) return '';

    if (hex.startsWith('T')) return hex; // Already Base58Check

    try {
      const addressBytes = Buffer.from(hex, 'hex');
      if (addressBytes.length !== 21 || addressBytes[0] !== 0x41) {
        return hex; // Not a valid TRON hex address
      }

      const hash1 = sha256(addressBytes);
      const hash2 = sha256(hash1);
      const checksum = Buffer.from(hash2).slice(0, 4);
      const addressWithChecksum = Buffer.concat([addressBytes, checksum]);

      return bs58check.encode(addressWithChecksum);
    } catch {
      return hex;
    }
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async tronApiPost(endpoint: string, body: Record<string, unknown>): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(TRON_API_KEY ? { 'TRON-PRO-API-KEY': TRON_API_KEY } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`TRON API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async tronApiGet(endpoint: string): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(TRON_API_KEY ? { 'TRON-PRO-API-KEY': TRON_API_KEY } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`TRON API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, operation: string, retries = MAX_RETRIES): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        console.warn(
          `[TRX] ${operation} attempt ${attempt}/${retries} failed:`,
          lastError.message
        );

        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAY_MS * attempt)
          );
        }
      }
    }

    throw new Error(
      `[TRX] ${operation} failed after ${retries} attempts: ${lastError?.message}`
    );
  }
}
