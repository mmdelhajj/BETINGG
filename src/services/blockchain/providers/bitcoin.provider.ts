// ─── Bitcoin/UTXO Blockchain Provider ───────────────────────────────────────
// Supports BTC, LTC, DOGE using Blockstream/public UTXO APIs.
// Uses bitcoinjs-lib for transaction construction and signing.

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import Decimal from 'decimal.js';
import {
  ChainId,
  getChainConfig,
  ChainConfig,
  NOWNODES_API_KEY,
} from '../../../config/blockchain';
import {
  BlockchainProvider,
  TransactionInfo,
  FeeEstimate,
  UTXOInfo,
} from './index';

bitcoin.initEccLib(ecc);

const RPC_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

// ─── API URL mappings ───────────────────────────────────────────────────────

interface ApiUrls {
  addressInfo: (address: string) => string;
  utxos: (address: string) => string;
  txInfo: (txHash: string) => string;
  blockHeight: () => string;
  broadcast: () => string;
  addressTxs: (address: string) => string;
  feeEstimates: () => string;
}

function getBlockstreamUrls(baseUrl: string): ApiUrls {
  return {
    addressInfo: (addr) => `${baseUrl}/address/${addr}`,
    utxos: (addr) => `${baseUrl}/address/${addr}/utxo`,
    txInfo: (hash) => `${baseUrl}/tx/${hash}`,
    blockHeight: () => `${baseUrl}/blocks/tip/height`,
    broadcast: () => `${baseUrl}/tx`,
    addressTxs: (addr) => `${baseUrl}/address/${addr}/txs`,
    feeEstimates: () => `${baseUrl}/fee-estimates`,
  };
}

function getLitecoinspaceUrls(baseUrl: string): ApiUrls {
  return {
    addressInfo: (addr) => `${baseUrl}/address/${addr}`,
    utxos: (addr) => `${baseUrl}/address/${addr}/utxo`,
    txInfo: (hash) => `${baseUrl}/tx/${hash}`,
    blockHeight: () => `${baseUrl}/blocks/tip/height`,
    broadcast: () => `${baseUrl}/tx`,
    addressTxs: (addr) => `${baseUrl}/address/${addr}/txs`,
    feeEstimates: () => `${baseUrl}/fee-estimates`,
  };
}

function getDogeUrls(): ApiUrls {
  // DOGE uses a different API pattern (dogechain.info or SoChain)
  const base = 'https://dogechain.info/api/v1';
  const sochain = 'https://sochain.com/api/v3';
  return {
    addressInfo: (addr) => `${base}/address/balance/${addr}`,
    utxos: (addr) => `${sochain}/unspent_outputs/DOGE/${addr}`,
    txInfo: (hash) => `${sochain}/transaction/DOGE/${hash}`,
    blockHeight: () => `${base}/block/height`,
    broadcast: () => `${sochain}/broadcast_transaction/DOGE`,
    addressTxs: (addr) => `${sochain}/transactions/DOGE/${addr}`,
    feeEstimates: () => `${base}/fee-estimates`,
  };
}

// ─── Network params for bitcoinjs-lib ───────────────────────────────────────

const NETWORK_PARAMS: Record<string, bitcoin.Network> = {
  BTC: bitcoin.networks.bitcoin,
  LTC: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bech32: 'ltc',
    bip32: { public: 0x019da462, private: 0x019d9cfe },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0,
  },
  DOGE: {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    bip32: { public: 0x02facafd, private: 0x02fac398 },
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
    wif: 0x9e,
  },
};

export class BitcoinProvider implements BlockchainProvider {
  readonly chainId: ChainId;
  private config: ChainConfig;
  private apiUrls: ApiUrls;
  private network: bitcoin.Network;

  constructor(chainId: ChainId) {
    if (!['BTC', 'LTC', 'DOGE'].includes(chainId)) {
      throw new Error(`BitcoinProvider only supports BTC, LTC, DOGE. Got: ${chainId}`);
    }

    this.chainId = chainId;
    this.config = getChainConfig(chainId);
    this.network = NETWORK_PARAMS[chainId];

    // Set up API URLs based on chain
    switch (chainId) {
      case 'BTC':
        this.apiUrls = getBlockstreamUrls(this.config.rpcUrl);
        break;
      case 'LTC':
        this.apiUrls = getLitecoinspaceUrls(this.config.rpcUrl);
        break;
      case 'DOGE':
        this.apiUrls = getDogeUrls();
        break;
      default:
        this.apiUrls = getBlockstreamUrls(this.config.rpcUrl);
    }
  }

  // ─── Core Methods ─────────────────────────────────────────────────────────

  async getBalance(address: string): Promise<string> {
    return this.withRetry(async () => {
      if (this.chainId === 'DOGE') {
        const data = await this.fetchJson<{ balance: string }>(
          this.apiUrls.addressInfo(address)
        );
        // Dogechain returns balance as a string in DOGE units
        return new Decimal(data.balance || '0')
          .mul(new Decimal(10).pow(8))
          .toFixed(0);
      }

      // Blockstream-style API returns chain_stats
      const data = await this.fetchJson<{
        chain_stats: {
          funded_txo_sum: number;
          spent_txo_sum: number;
        };
      }>(this.apiUrls.addressInfo(address));

      const funded = data.chain_stats?.funded_txo_sum || 0;
      const spent = data.chain_stats?.spent_txo_sum || 0;
      return (funded - spent).toString();
    }, 'getBalance');
  }

  async getTokenBalance(_address: string, _tokenAddress: string): Promise<string> {
    // UTXO chains don't have tokens (in the traditional sense)
    return '0';
  }

  async getTransactionConfirmations(txHash: string): Promise<number> {
    return this.withRetry(async () => {
      const txInfo = await this.getTransactionInfo(txHash);
      return txInfo?.confirmations || 0;
    }, 'getTransactionConfirmations');
  }

  async getTransactionInfo(txHash: string): Promise<TransactionInfo | null> {
    return this.withRetry(async () => {
      if (this.chainId === 'DOGE') {
        return this.getDogeTransactionInfo(txHash);
      }

      // Blockstream-style API
      const data = await this.fetchJson<{
        txid: string;
        status: { confirmed: boolean; block_height?: number; block_time?: number };
        vin: Array<{ prevout: { scriptpubkey_address?: string; value: number } }>;
        vout: Array<{ scriptpubkey_address?: string; value: number }>;
      }>(this.apiUrls.txInfo(txHash));

      if (!data || !data.txid) return null;

      let confirmations = 0;
      if (data.status.confirmed && data.status.block_height) {
        const currentHeight = await this.getBlockNumber();
        confirmations = Math.max(0, currentHeight - data.status.block_height + 1);
      }

      // Sum all outputs as a simplified approach
      const totalOutput = data.vout.reduce((sum, out) => sum + (out.value || 0), 0);
      const fromAddress = data.vin[0]?.prevout?.scriptpubkey_address || '';
      const toAddress = data.vout[0]?.scriptpubkey_address || '';

      return {
        txHash: data.txid,
        from: fromAddress,
        to: toAddress,
        amount: totalOutput.toString(),
        confirmations,
        blockNumber: data.status.block_height || null,
        status: data.status.confirmed ? 'confirmed' : 'pending',
        timestamp: data.status.block_time,
      };
    }, 'getTransactionInfo');
  }

  async broadcastTransaction(signedTxHex: string): Promise<string> {
    return this.withRetry(async () => {
      const url = this.apiUrls.broadcast();

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: signedTxHex,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Broadcast failed: ${response.status} - ${errorText}`);
      }

      const txHash = await response.text();
      console.log(`[UTXO:${this.chainId}] Transaction broadcast: ${txHash.trim()}`);
      return txHash.trim();
    }, 'broadcastTransaction');
  }

  async getBlockNumber(): Promise<number> {
    return this.withRetry(async () => {
      if (this.chainId === 'DOGE') {
        const data = await this.fetchJson<{ height: number }>(this.apiUrls.blockHeight());
        return data.height || 0;
      }

      const response = await this.fetchWithTimeout(this.apiUrls.blockHeight());
      const text = await response.text();
      return parseInt(text.trim(), 10);
    }, 'getBlockNumber');
  }

  isValidAddress(address: string): boolean {
    try {
      // Try to decode the address using bitcoinjs-lib
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      // For BTC, also accept bech32 addresses
      if (this.chainId === 'BTC') {
        try {
          // Check if it's a valid bech32 address
          return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async estimateFee(to: string, amount: string, _tokenAddress?: string): Promise<FeeEstimate> {
    return this.withRetry(async () => {
      let feeRateSatPerByte = 10; // Default fallback

      try {
        if (this.chainId === 'BTC' || this.chainId === 'LTC') {
          const feeEstimates = await this.fetchJson<Record<string, number>>(
            this.apiUrls.feeEstimates()
          );
          // Use the 6-block target fee rate (medium speed)
          feeRateSatPerByte = Math.ceil(feeEstimates['6'] || feeEstimates['3'] || 10);
        }
      } catch {
        // Use default fee rate
      }

      // Estimate transaction size: ~250 bytes for a simple P2PKH tx (1 input, 2 outputs)
      const estimatedSizeBytes = 250;
      const totalFee = feeRateSatPerByte * estimatedSizeBytes;

      const estimatedTimeSeconds = Math.ceil(
        (this.config.confirmationsRequired * this.config.blockTimeMs) / 1000
      );

      return {
        fee: totalFee.toString(),
        feeRate: feeRateSatPerByte.toString(),
        estimatedTimeSeconds,
      };
    }, 'estimateFee');
  }

  async getAddressTransactions(address: string, _fromBlock?: number): Promise<TransactionInfo[]> {
    return this.withRetry(async () => {
      const transactions: TransactionInfo[] = [];

      if (this.chainId === 'DOGE') {
        return transactions; // Simplified for DOGE
      }

      // Blockstream-style API
      const data = await this.fetchJson<
        Array<{
          txid: string;
          status: { confirmed: boolean; block_height?: number; block_time?: number };
          vin: Array<{ prevout: { scriptpubkey_address?: string; value: number } }>;
          vout: Array<{ scriptpubkey_address?: string; value: number }>;
        }>
      >(this.apiUrls.addressTxs(address));

      if (!Array.isArray(data)) return transactions;

      const currentHeight = await this.getBlockNumber();

      for (const tx of data.slice(0, 50)) {
        // Find outputs directed to our address
        for (const vout of tx.vout) {
          if (vout.scriptpubkey_address?.toLowerCase() === address.toLowerCase()) {
            const confirmations = tx.status.confirmed && tx.status.block_height
              ? Math.max(0, currentHeight - tx.status.block_height + 1)
              : 0;

            transactions.push({
              txHash: tx.txid,
              from: tx.vin[0]?.prevout?.scriptpubkey_address || 'unknown',
              to: address,
              amount: vout.value.toString(),
              confirmations,
              blockNumber: tx.status.block_height || null,
              status: tx.status.confirmed ? 'confirmed' : 'pending',
              timestamp: tx.status.block_time,
            });
          }
        }
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

  // ─── UTXO-specific helpers ────────────────────────────────────────────────

  /**
   * Get unspent transaction outputs for an address.
   */
  async getUTXOs(address: string): Promise<UTXOInfo[]> {
    return this.withRetry(async () => {
      if (this.chainId === 'DOGE') {
        return this.getDogeUTXOs(address);
      }

      // Blockstream-style API
      const data = await this.fetchJson<
        Array<{
          txid: string;
          vout: number;
          value: number;
          status: { confirmed: boolean; block_height?: number };
        }>
      >(this.apiUrls.utxos(address));

      if (!Array.isArray(data)) return [];

      const currentHeight = await this.getBlockNumber();

      return data.map((utxo) => ({
        txHash: utxo.txid,
        outputIndex: utxo.vout,
        amount: utxo.value.toString(),
        script: '', // Will be populated during signing
        confirmations: utxo.status.confirmed && utxo.status.block_height
          ? currentHeight - utxo.status.block_height + 1
          : 0,
      }));
    }, 'getUTXOs');
  }

  /**
   * Create, sign, and return a raw UTXO transaction (hex encoded).
   * Does NOT broadcast - call broadcastTransaction() separately.
   */
  createSignedTransaction(
    privateKeyHex: string,
    utxos: UTXOInfo[],
    toAddress: string,
    amountSatoshis: number,
    feeSatoshis: number,
    changeAddress: string
  ): string {
    const keyPair = this.createKeyPair(privateKeyHex);
    const psbt = new bitcoin.Psbt({ network: this.network });

    // Sort UTXOs by amount descending to minimize inputs
    const sortedUtxos = [...utxos].sort(
      (a, b) => parseInt(b.amount) - parseInt(a.amount)
    );

    let inputTotal = 0;
    const selectedUtxos: UTXOInfo[] = [];

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      inputTotal += parseInt(utxo.amount);
      if (inputTotal >= amountSatoshis + feeSatoshis) break;
    }

    if (inputTotal < amountSatoshis + feeSatoshis) {
      throw new Error(
        `Insufficient UTXOs. Need ${amountSatoshis + feeSatoshis} satoshis, have ${inputTotal}`
      );
    }

    // Add inputs
    for (const utxo of selectedUtxos) {
      psbt.addInput({
        hash: utxo.txHash,
        index: utxo.outputIndex,
        nonWitnessUtxo: undefined, // Would need raw tx hex for non-segwit
      });
    }

    // Add destination output
    psbt.addOutput({
      address: toAddress,
      value: amountSatoshis,
    });

    // Add change output if there's remaining balance
    const change = inputTotal - amountSatoshis - feeSatoshis;
    if (change > 546) {
      // Dust threshold
      psbt.addOutput({
        address: changeAddress,
        value: change,
      });
    }

    // Sign all inputs
    for (let i = 0; i < selectedUtxos.length; i++) {
      psbt.signInput(i, keyPair);
    }

    psbt.finalizeAllInputs();
    return psbt.extractTransaction().toHex();
  }

  /**
   * Convert satoshis to human-readable coin amount.
   */
  fromSatoshis(satoshis: string): string {
    return new Decimal(satoshis).div(new Decimal(10).pow(8)).toFixed(8);
  }

  /**
   * Convert human-readable coin amount to satoshis.
   */
  toSatoshis(amount: string): string {
    return new Decimal(amount).mul(new Decimal(10).pow(8)).toFixed(0);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private createKeyPair(privateKeyHex: string): bitcoin.Signer {
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    return {
      publicKey: Buffer.from(ecc.pointFromScalar(privateKeyBuffer)!),
      sign: (hash: Buffer) => {
        return Buffer.from(ecc.sign(hash, privateKeyBuffer));
      },
    };
  }

  private async getDogeTransactionInfo(txHash: string): Promise<TransactionInfo | null> {
    try {
      const data = await this.fetchJson<{
        data: {
          txid: string;
          confirmations: number;
          block_no: number;
          time: number;
          inputs: Array<{ address: string; value: string }>;
          outputs: Array<{ address: string; value: string }>;
        };
      }>(this.apiUrls.txInfo(txHash));

      if (!data?.data) return null;

      const tx = data.data;
      const totalOutput = tx.outputs.reduce(
        (sum, out) => sum + parseFloat(out.value || '0'),
        0
      );

      return {
        txHash: tx.txid,
        from: tx.inputs[0]?.address || '',
        to: tx.outputs[0]?.address || '',
        amount: new Decimal(totalOutput).mul(1e8).toFixed(0),
        confirmations: tx.confirmations || 0,
        blockNumber: tx.block_no || null,
        status: tx.confirmations > 0 ? 'confirmed' : 'pending',
        timestamp: tx.time,
      };
    } catch {
      return null;
    }
  }

  private async getDogeUTXOs(address: string): Promise<UTXOInfo[]> {
    try {
      const data = await this.fetchJson<{
        data: {
          outputs: Array<{
            txid: string;
            output_no: number;
            value: string;
            confirmations: number;
          }>;
        };
      }>(this.apiUrls.utxos(address));

      if (!data?.data?.outputs) return [];

      return data.data.outputs.map((utxo) => ({
        txHash: utxo.txid,
        outputIndex: utxo.output_no,
        amount: new Decimal(utxo.value).mul(1e8).toFixed(0),
        script: '',
        confirmations: utxo.confirmations,
      }));
    } catch {
      return [];
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Add NOWNodes API key if configured
    if (NOWNODES_API_KEY && url.includes('nownodes.io')) {
      headers['api-key'] = NOWNODES_API_KEY;
    }

    try {
      return await fetch(url, {
        ...options,
        headers,
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
          `[UTXO:${this.chainId}] ${operation} attempt ${attempt}/${retries} failed:`,
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
      `[UTXO:${this.chainId}] ${operation} failed after ${retries} attempts: ${lastError?.message}`
    );
  }
}
