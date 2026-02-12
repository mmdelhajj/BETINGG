// ─── HD Wallet Manager ──────────────────────────────────────────────────────
// Derives unique deposit addresses per user per currency using BIP39/BIP44.
// Only the xpub is stored on the hot server; private keys are derived on-demand
// for signing withdrawals and never persisted.

import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import BIP32Factory, { BIP32Interface } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import bs58check from 'bs58check';
import { sha256 } from '@noble/hashes/sha256';
import { keccak_256 } from '@noble/hashes/sha3';
import { hdWalletConfig, ChainId, chainConfigs, isEvmChain } from '../../config/blockchain';

const bip32 = BIP32Factory(ecc);

// Bitcoin-like network configurations for bitcoinjs-lib
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

// ─── BIP44 derivation paths ─────────────────────────────────────────────────
// Format: m/44'/<coin_type>'/<account>'/<change>/<address_index>
// account=0, change=0 (external/receiving addresses)

const BIP44_PATHS: Record<string, string> = {
  BTC: "m/44'/0'/0'/0",
  ETH: "m/44'/60'/0'/0",
  BSC: "m/44'/60'/0'/0",      // Same as ETH (EVM-compatible)
  POLYGON: "m/44'/60'/0'/0",  // Same as ETH (EVM-compatible)
  ARBITRUM: "m/44'/60'/0'/0", // Same as ETH (EVM-compatible)
  LTC: "m/44'/2'/0'/0",
  DOGE: "m/44'/3'/0'/0",
  TRX: "m/44'/195'/0'/0",
  SOL: "m/44'/501'",          // SOL uses m/44'/501'/N'/0'
};

export interface DerivedAddress {
  address: string;
  hdPath: string;
  chainId: ChainId;
}

export interface DerivedKeyPair {
  address: string;
  privateKey: string;
  hdPath: string;
  chainId: ChainId;
}

class HDWalletManager {
  private seed: Buffer | null = null;
  private masterNode: BIP32Interface | null = null;
  private initialized = false;

  /**
   * Initialize the HD wallet from mnemonic.
   * Must be called before any address derivation.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const mnemonic = hdWalletConfig.mnemonic;
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid BIP39 mnemonic configured in WALLET_MNEMONIC');
    }

    this.seed = await bip39.mnemonicToSeed(mnemonic);
    this.masterNode = bip32.fromSeed(this.seed);
    this.initialized = true;
    console.log('[HDWallet] Initialized from mnemonic');
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.masterNode || !this.seed) {
      throw new Error('HDWallet not initialized. Call initialize() first.');
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Derive a deposit address for a given chain and user index.
   * The index should be unique per user (e.g., a monotonically incrementing wallet counter).
   */
  deriveAddress(chainId: ChainId, index: number): DerivedAddress {
    this.ensureInitialized();

    switch (chainId) {
      case 'BTC':
      case 'LTC':
      case 'DOGE':
        return this.deriveUtxoAddress(chainId, index);
      case 'ETH':
      case 'BSC':
      case 'POLYGON':
      case 'ARBITRUM':
        return this.deriveEvmAddress(chainId, index);
      case 'TRX':
        return this.deriveTronAddress(index);
      case 'SOL':
        return this.deriveSolanaAddress(index);
      default:
        throw new Error(`Unsupported chain for address derivation: ${chainId}`);
    }
  }

  /**
   * Derive the full key pair (address + private key) for signing withdrawals.
   * Only call this in the withdrawal signing context; never persist private keys.
   */
  deriveKeyPair(chainId: ChainId, index: number): DerivedKeyPair {
    this.ensureInitialized();

    switch (chainId) {
      case 'BTC':
      case 'LTC':
      case 'DOGE':
        return this.deriveUtxoKeyPair(chainId, index);
      case 'ETH':
      case 'BSC':
      case 'POLYGON':
      case 'ARBITRUM':
        return this.deriveEvmKeyPair(chainId, index);
      case 'TRX':
        return this.deriveTronKeyPair(index);
      case 'SOL':
        return this.deriveSolanaKeyPair(index);
      default:
        throw new Error(`Unsupported chain for key derivation: ${chainId}`);
    }
  }

  /**
   * Get the xpub for a given chain (for watch-only monitoring).
   */
  getExtendedPublicKey(chainId: ChainId): string {
    this.ensureInitialized();
    const basePath = BIP44_PATHS[chainId];
    if (!basePath) throw new Error(`No BIP44 path for chain: ${chainId}`);

    // For SOL, derive up to account level
    if (chainId === 'SOL') {
      return this.masterNode!.derivePath(basePath).neutered().toBase58();
    }

    // For other chains, derive up to the change level
    const node = this.masterNode!.derivePath(basePath);
    return node.neutered().toBase58();
  }

  // ─── UTXO chain derivation (BTC, LTC, DOGE) ─────────────────────────────

  private deriveUtxoAddress(chainId: ChainId, index: number): DerivedAddress {
    const basePath = BIP44_PATHS[chainId];
    const fullPath = `${basePath}/${index}`;
    const child = this.masterNode!.derivePath(fullPath);
    const network = NETWORK_PARAMS[chainId];

    if (!network) throw new Error(`No network params for ${chainId}`);

    // Generate P2PKH address (legacy format, most compatible)
    const { address } = bitcoin.payments.p2pkh({
      pubkey: Buffer.from(child.publicKey),
      network,
    });

    if (!address) throw new Error(`Failed to derive ${chainId} address at ${fullPath}`);

    return { address, hdPath: fullPath, chainId };
  }

  private deriveUtxoKeyPair(chainId: ChainId, index: number): DerivedKeyPair {
    const basePath = BIP44_PATHS[chainId];
    const fullPath = `${basePath}/${index}`;
    const child = this.masterNode!.derivePath(fullPath);
    const network = NETWORK_PARAMS[chainId];

    const { address } = bitcoin.payments.p2pkh({
      pubkey: Buffer.from(child.publicKey),
      network,
    });

    if (!address || !child.privateKey) {
      throw new Error(`Failed to derive ${chainId} key pair at ${fullPath}`);
    }

    return {
      address,
      privateKey: Buffer.from(child.privateKey).toString('hex'),
      hdPath: fullPath,
      chainId,
    };
  }

  // ─── EVM chain derivation (ETH, BSC, Polygon, Arbitrum) ─────────────────

  private deriveEvmAddress(chainId: ChainId, index: number): DerivedAddress {
    const basePath = BIP44_PATHS[chainId];
    const fullPath = `${basePath}/${index}`;

    // Use ethers.js HDNodeWallet for EVM derivation
    const hdNode = ethers.HDNodeWallet.fromSeed(this.seed!);
    const child = hdNode.derivePath(fullPath);

    return {
      address: child.address,
      hdPath: fullPath,
      chainId,
    };
  }

  private deriveEvmKeyPair(chainId: ChainId, index: number): DerivedKeyPair {
    const basePath = BIP44_PATHS[chainId];
    const fullPath = `${basePath}/${index}`;

    const hdNode = ethers.HDNodeWallet.fromSeed(this.seed!);
    const child = hdNode.derivePath(fullPath);

    return {
      address: child.address,
      privateKey: child.privateKey,
      hdPath: fullPath,
      chainId,
    };
  }

  // ─── TRON derivation (same key as ETH, different address encoding) ───────

  private deriveTronAddress(index: number): DerivedAddress {
    const basePath = BIP44_PATHS.TRX;
    const fullPath = `${basePath}/${index}`;

    const hdNode = ethers.HDNodeWallet.fromSeed(this.seed!);
    const child = hdNode.derivePath(fullPath);

    // TRON address: Take the ETH address (without 0x), prepend 0x41, then Base58Check
    const address = this.ethAddressToTronAddress(child.address);

    return { address, hdPath: fullPath, chainId: 'TRX' };
  }

  private deriveTronKeyPair(index: number): DerivedKeyPair {
    const basePath = BIP44_PATHS.TRX;
    const fullPath = `${basePath}/${index}`;

    const hdNode = ethers.HDNodeWallet.fromSeed(this.seed!);
    const child = hdNode.derivePath(fullPath);
    const address = this.ethAddressToTronAddress(child.address);

    return {
      address,
      privateKey: child.privateKey,
      hdPath: fullPath,
      chainId: 'TRX',
    };
  }

  /**
   * Convert an Ethereum-style hex address to a TRON Base58Check address.
   * TRON uses the same ECDSA keys but encodes with 0x41 prefix + Base58Check.
   */
  private ethAddressToTronAddress(ethAddress: string): string {
    // Remove 0x prefix and get raw 20-byte address
    const addressHex = ethAddress.replace('0x', '').toLowerCase();
    // Prepend TRON's mainnet prefix (0x41)
    const tronHex = '41' + addressHex;
    const addressBytes = Buffer.from(tronHex, 'hex');

    // Base58Check encoding: address + first 4 bytes of double SHA-256
    const hash1 = sha256(addressBytes);
    const hash2 = sha256(hash1);
    const checksum = Buffer.from(hash2).slice(0, 4);
    const addressWithChecksum = Buffer.concat([addressBytes, checksum]);

    return bs58check.encode(addressWithChecksum);
  }

  // ─── Solana derivation ───────────────────────────────────────────────────

  private deriveSolanaAddress(index: number): DerivedAddress {
    // SOL uses m/44'/501'/N'/0' (hardened account + hardened change)
    const fullPath = `m/44'/501'/${index}'/0'`;
    const child = this.masterNode!.derivePath(fullPath);

    // Solana uses Ed25519 but we derive the seed from the BIP32 node.
    // The standard Phantom/Solflare derivation uses the 32-byte private key
    // from the BIP32 node to create an Ed25519 keypair.
    // For address derivation we need the ed25519 public key.
    // We use @solana/web3.js Keypair from the derived seed.

    const { Keypair } = require('@solana/web3.js');
    const { ed25519 } = require('@noble/curves/ed25519');

    // Use the first 32 bytes of the BIP32 node's private key as the Ed25519 seed
    const ed25519Seed = child.privateKey!.slice(0, 32);
    const keypair = Keypair.fromSeed(Buffer.from(ed25519Seed));

    return {
      address: keypair.publicKey.toBase58(),
      hdPath: fullPath,
      chainId: 'SOL',
    };
  }

  private deriveSolanaKeyPair(index: number): DerivedKeyPair {
    const fullPath = `m/44'/501'/${index}'/0'`;
    const child = this.masterNode!.derivePath(fullPath);

    const { Keypair } = require('@solana/web3.js');

    const ed25519Seed = child.privateKey!.slice(0, 32);
    const keypair = Keypair.fromSeed(Buffer.from(ed25519Seed));

    return {
      address: keypair.publicKey.toBase58(),
      // Solana secret key is the full 64-byte key (32 seed + 32 pubkey)
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      hdPath: fullPath,
      chainId: 'SOL',
    };
  }

  // ─── Utility ─────────────────────────────────────────────────────────────

  /**
   * Determine which chain a given network name maps to for derivation.
   * Multiple EVM networks share the same derived address.
   */
  getDerivationChain(networkName: string): ChainId {
    const normalized = networkName.toLowerCase().trim();
    const evmNetworks = ['ethereum', 'eth', 'erc20', 'bsc', 'bep20', 'polygon', 'arbitrum'];
    if (evmNetworks.includes(normalized)) return 'ETH'; // All EVM share same derivation
    if (['bitcoin', 'btc'].includes(normalized)) return 'BTC';
    if (['litecoin', 'ltc'].includes(normalized)) return 'LTC';
    if (['dogecoin', 'doge'].includes(normalized)) return 'DOGE';
    if (['tron', 'trx', 'trc20'].includes(normalized)) return 'TRX';
    if (['solana', 'sol', 'spl'].includes(normalized)) return 'SOL';
    throw new Error(`Cannot determine derivation chain for network: ${networkName}`);
  }

  /**
   * Check if the wallet manager has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const hdWalletManager = new HDWalletManager();
