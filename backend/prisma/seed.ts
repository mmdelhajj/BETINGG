import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CURRENCIES (40+ Cryptocurrencies)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding currencies...');

  const currencies = [
    { symbol: 'BTC',   name: 'Bitcoin',           type: 'CRYPTO',      decimals: 8,  minWithdrawal: 0.0001,  withdrawalFee: 0.00005,  exchangeRateUsd: 67500.00,   sortOrder: 1  },
    { symbol: 'ETH',   name: 'Ethereum',          type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.001,   withdrawalFee: 0.0005,   exchangeRateUsd: 3450.00,    sortOrder: 2  },
    { symbol: 'USDT',  name: 'Tether',            type: 'STABLECOIN',  decimals: 6,  minWithdrawal: 1.00,    withdrawalFee: 0.50,     exchangeRateUsd: 1.00,       sortOrder: 3  },
    { symbol: 'USDC',  name: 'USD Coin',          type: 'STABLECOIN',  decimals: 6,  minWithdrawal: 1.00,    withdrawalFee: 0.50,     exchangeRateUsd: 1.00,       sortOrder: 4  },
    { symbol: 'BNB',   name: 'BNB',               type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.01,    withdrawalFee: 0.001,    exchangeRateUsd: 605.00,     sortOrder: 5  },
    { symbol: 'SOL',   name: 'Solana',            type: 'CRYPTO',      decimals: 9,  minWithdrawal: 0.05,    withdrawalFee: 0.01,     exchangeRateUsd: 172.00,     sortOrder: 6  },
    { symbol: 'XRP',   name: 'XRP',               type: 'CRYPTO',      decimals: 6,  minWithdrawal: 1.00,    withdrawalFee: 0.10,     exchangeRateUsd: 0.62,       sortOrder: 7  },
    { symbol: 'DOGE',  name: 'Dogecoin',          type: 'CRYPTO',      decimals: 8,  minWithdrawal: 10.00,   withdrawalFee: 2.00,     exchangeRateUsd: 0.165,      sortOrder: 8  },
    { symbol: 'ADA',   name: 'Cardano',           type: 'CRYPTO',      decimals: 6,  minWithdrawal: 2.00,    withdrawalFee: 0.50,     exchangeRateUsd: 0.48,       sortOrder: 9  },
    { symbol: 'MATIC', name: 'Polygon',           type: 'CRYPTO',      decimals: 18, minWithdrawal: 1.00,    withdrawalFee: 0.10,     exchangeRateUsd: 0.72,       sortOrder: 10 },
    { symbol: 'DOT',   name: 'Polkadot',          type: 'CRYPTO',      decimals: 10, minWithdrawal: 0.50,    withdrawalFee: 0.10,     exchangeRateUsd: 7.50,       sortOrder: 11 },
    { symbol: 'LTC',   name: 'Litecoin',          type: 'CRYPTO',      decimals: 8,  minWithdrawal: 0.01,    withdrawalFee: 0.001,    exchangeRateUsd: 84.00,      sortOrder: 12 },
    { symbol: 'BCH',   name: 'Bitcoin Cash',      type: 'CRYPTO',      decimals: 8,  minWithdrawal: 0.005,   withdrawalFee: 0.0005,   exchangeRateUsd: 490.00,     sortOrder: 13 },
    { symbol: 'AVAX',  name: 'Avalanche',         type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.10,    withdrawalFee: 0.01,     exchangeRateUsd: 38.00,      sortOrder: 14 },
    { symbol: 'LINK',  name: 'Chainlink',         type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.50,    withdrawalFee: 0.05,     exchangeRateUsd: 18.50,      sortOrder: 15 },
    { symbol: 'ATOM',  name: 'Cosmos',            type: 'CRYPTO',      decimals: 6,  minWithdrawal: 0.50,    withdrawalFee: 0.05,     exchangeRateUsd: 9.80,       sortOrder: 16 },
    { symbol: 'UNI',   name: 'Uniswap',           type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.50,    withdrawalFee: 0.10,     exchangeRateUsd: 12.40,      sortOrder: 17 },
    { symbol: 'DAI',   name: 'Dai',               type: 'STABLECOIN',  decimals: 18, minWithdrawal: 1.00,    withdrawalFee: 0.50,     exchangeRateUsd: 1.00,       sortOrder: 18 },
    { symbol: 'TRX',   name: 'TRON',              type: 'CRYPTO',      decimals: 6,  minWithdrawal: 5.00,    withdrawalFee: 1.00,     exchangeRateUsd: 0.13,       sortOrder: 19 },
    { symbol: 'NEAR',  name: 'NEAR Protocol',     type: 'CRYPTO',      decimals: 24, minWithdrawal: 0.50,    withdrawalFee: 0.05,     exchangeRateUsd: 7.20,       sortOrder: 20 },
    { symbol: 'FTM',   name: 'Fantom',            type: 'CRYPTO',      decimals: 18, minWithdrawal: 5.00,    withdrawalFee: 0.50,     exchangeRateUsd: 0.85,       sortOrder: 21 },
    { symbol: 'AAVE',  name: 'Aave',              type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.05,    withdrawalFee: 0.005,    exchangeRateUsd: 105.00,     sortOrder: 22 },
    { symbol: 'MKR',   name: 'Maker',             type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.005,   withdrawalFee: 0.001,    exchangeRateUsd: 1520.00,    sortOrder: 23 },
    { symbol: 'COMP',  name: 'Compound',          type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.10,    withdrawalFee: 0.01,     exchangeRateUsd: 62.00,      sortOrder: 24 },
    { symbol: 'SUSHI', name: 'SushiSwap',         type: 'CRYPTO',      decimals: 18, minWithdrawal: 2.00,    withdrawalFee: 0.20,     exchangeRateUsd: 1.35,       sortOrder: 25 },
    { symbol: 'YFI',   name: 'yearn.finance',     type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.001,   withdrawalFee: 0.0001,   exchangeRateUsd: 8900.00,    sortOrder: 26 },
    { symbol: 'SNX',   name: 'Synthetix',         type: 'CRYPTO',      decimals: 18, minWithdrawal: 1.00,    withdrawalFee: 0.20,     exchangeRateUsd: 3.40,       sortOrder: 27 },
    { symbol: 'CRV',   name: 'Curve DAO',         type: 'CRYPTO',      decimals: 18, minWithdrawal: 2.00,    withdrawalFee: 0.30,     exchangeRateUsd: 0.65,       sortOrder: 28 },
    { symbol: 'APT',   name: 'Aptos',             type: 'CRYPTO',      decimals: 8,  minWithdrawal: 0.20,    withdrawalFee: 0.02,     exchangeRateUsd: 9.20,       sortOrder: 29 },
    { symbol: 'TON',   name: 'Toncoin',           type: 'CRYPTO',      decimals: 9,  minWithdrawal: 0.50,    withdrawalFee: 0.05,     exchangeRateUsd: 5.80,       sortOrder: 30 },
    { symbol: 'SHIB',  name: 'Shiba Inu',         type: 'CRYPTO',      decimals: 18, minWithdrawal: 100000,  withdrawalFee: 50000,    exchangeRateUsd: 0.0000265,  sortOrder: 31 },
    { symbol: 'PEPE',  name: 'Pepe',              type: 'CRYPTO',      decimals: 18, minWithdrawal: 1000000, withdrawalFee: 500000,   exchangeRateUsd: 0.0000135,  sortOrder: 32 },
    { symbol: 'FLOKI', name: 'Floki Inu',         type: 'CRYPTO',      decimals: 18, minWithdrawal: 5000,    withdrawalFee: 2000,     exchangeRateUsd: 0.000215,   sortOrder: 33 },
    { symbol: 'XLM',   name: 'Stellar',           type: 'CRYPTO',      decimals: 7,  minWithdrawal: 5.00,    withdrawalFee: 0.50,     exchangeRateUsd: 0.12,       sortOrder: 34 },
    { symbol: 'EOS',   name: 'EOS',               type: 'CRYPTO',      decimals: 4,  minWithdrawal: 2.00,    withdrawalFee: 0.10,     exchangeRateUsd: 0.82,       sortOrder: 35 },
    { symbol: 'ALGO',  name: 'Algorand',          type: 'CRYPTO',      decimals: 6,  minWithdrawal: 5.00,    withdrawalFee: 0.50,     exchangeRateUsd: 0.22,       sortOrder: 36 },
    { symbol: 'DASH',  name: 'Dash',              type: 'CRYPTO',      decimals: 8,  minWithdrawal: 0.02,    withdrawalFee: 0.002,    exchangeRateUsd: 30.00,      sortOrder: 37 },
    { symbol: 'XMR',   name: 'Monero',            type: 'CRYPTO',      decimals: 12, minWithdrawal: 0.01,    withdrawalFee: 0.001,    exchangeRateUsd: 165.00,     sortOrder: 38 },
    { symbol: 'ZEC',   name: 'Zcash',             type: 'CRYPTO',      decimals: 8,  minWithdrawal: 0.02,    withdrawalFee: 0.005,    exchangeRateUsd: 25.00,      sortOrder: 39 },
    { symbol: 'ENJ',   name: 'Enjin Coin',        type: 'CRYPTO',      decimals: 18, minWithdrawal: 5.00,    withdrawalFee: 0.50,     exchangeRateUsd: 0.32,       sortOrder: 40 },
    { symbol: 'MANA',  name: 'Decentraland',      type: 'CRYPTO',      decimals: 18, minWithdrawal: 5.00,    withdrawalFee: 0.50,     exchangeRateUsd: 0.48,       sortOrder: 41 },
    { symbol: 'SAND',  name: 'The Sandbox',       type: 'CRYPTO',      decimals: 18, minWithdrawal: 5.00,    withdrawalFee: 0.50,     exchangeRateUsd: 0.45,       sortOrder: 42 },
    { symbol: 'AXS',   name: 'Axie Infinity',     type: 'CRYPTO',      decimals: 18, minWithdrawal: 0.50,    withdrawalFee: 0.05,     exchangeRateUsd: 8.10,       sortOrder: 43 },
  ];

  const currencyMap: Record<string, string> = {};

  for (const c of currencies) {
    const record = await prisma.currency.upsert({
      where: { symbol: c.symbol },
      update: {
        name: c.name,
        type: c.type as any,
        decimals: c.decimals,
        icon: `/icons/crypto/${c.symbol.toLowerCase()}.svg`,
        isActive: true,
        isDepositEnabled: true,
        isWithdrawEnabled: true,
        minWithdrawal: c.minWithdrawal,
        withdrawalFee: c.withdrawalFee,
        exchangeRateUsd: c.exchangeRateUsd,
        sortOrder: c.sortOrder,
      },
      create: {
        symbol: c.symbol,
        name: c.name,
        type: c.type as any,
        decimals: c.decimals,
        icon: `/icons/crypto/${c.symbol.toLowerCase()}.svg`,
        isActive: true,
        isDepositEnabled: true,
        isWithdrawEnabled: true,
        minWithdrawal: c.minWithdrawal,
        withdrawalFee: c.withdrawalFee,
        exchangeRateUsd: c.exchangeRateUsd,
        sortOrder: c.sortOrder,
      },
    });
    currencyMap[c.symbol] = record.id;
  }

  console.log(`  Seeded ${currencies.length} currencies.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1b. CURRENCY NETWORKS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding currency networks...');

  const networkDefs = [
    // BTC
    { currencySymbol: 'BTC',  networkName: 'bitcoin',           networkLabel: 'Bitcoin',          contractAddress: null, confirmations: 8,  estimatedTime: '~30 minutes', explorerUrl: 'https://blockchair.com/bitcoin' },
    // ETH
    { currencySymbol: 'ETH',  networkName: 'ethereum-mainnet',  networkLabel: 'ERC-20',           contractAddress: null, confirmations: 12, estimatedTime: '~5 minutes',  explorerUrl: 'https://etherscan.io' },
    // USDT - 4 networks
    { currencySymbol: 'USDT', networkName: 'ethereum-mainnet',  networkLabel: 'ERC-20',           contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', confirmations: 12, estimatedTime: '~5 minutes',  explorerUrl: 'https://etherscan.io' },
    { currencySymbol: 'USDT', networkName: 'bsc',               networkLabel: 'BEP-20',           contractAddress: '0x55d398326f99059fF775485246999027B3197955', confirmations: 15, estimatedTime: '~3 minutes',  explorerUrl: 'https://bscscan.com' },
    { currencySymbol: 'USDT', networkName: 'tron',              networkLabel: 'TRC-20',           contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',        confirmations: 20, estimatedTime: '~3 minutes',  explorerUrl: 'https://tronscan.org' },
    { currencySymbol: 'USDT', networkName: 'solana',            networkLabel: 'SPL',              contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', confirmations: 1,  estimatedTime: '~30 seconds', explorerUrl: 'https://solscan.io' },
    // USDC - 2 networks
    { currencySymbol: 'USDC', networkName: 'ethereum-mainnet',  networkLabel: 'ERC-20',           contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', confirmations: 12, estimatedTime: '~5 minutes',  explorerUrl: 'https://etherscan.io' },
    { currencySymbol: 'USDC', networkName: 'bsc',               networkLabel: 'BEP-20',           contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', confirmations: 15, estimatedTime: '~3 minutes',  explorerUrl: 'https://bscscan.com' },
    // BNB
    { currencySymbol: 'BNB',  networkName: 'bsc',               networkLabel: 'BEP-20 (BSC)',     contractAddress: null, confirmations: 15, estimatedTime: '~3 minutes',  explorerUrl: 'https://bscscan.com' },
    // SOL
    { currencySymbol: 'SOL',  networkName: 'solana',            networkLabel: 'Solana',           contractAddress: null, confirmations: 1,  estimatedTime: '~30 seconds', explorerUrl: 'https://solscan.io' },
    // MATIC
    { currencySymbol: 'MATIC', networkName: 'polygon',          networkLabel: 'Polygon',          contractAddress: null, confirmations: 128, estimatedTime: '~5 minutes', explorerUrl: 'https://polygonscan.com' },
    { currencySymbol: 'MATIC', networkName: 'ethereum-mainnet', networkLabel: 'ERC-20',           contractAddress: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', confirmations: 12, estimatedTime: '~5 minutes', explorerUrl: 'https://etherscan.io' },
    // AVAX
    { currencySymbol: 'AVAX', networkName: 'avalanche-c',       networkLabel: 'Avalanche C-Chain', contractAddress: null, confirmations: 12, estimatedTime: '~2 minutes', explorerUrl: 'https://snowtrace.io' },
    // TRX
    { currencySymbol: 'TRX',  networkName: 'tron',              networkLabel: 'Tron',             contractAddress: null, confirmations: 20, estimatedTime: '~3 minutes',  explorerUrl: 'https://tronscan.org' },
    // LTC
    { currencySymbol: 'LTC',  networkName: 'litecoin',          networkLabel: 'Litecoin',         contractAddress: null, confirmations: 6,  estimatedTime: '~15 minutes', explorerUrl: 'https://blockchair.com/litecoin' },
    // BCH
    { currencySymbol: 'BCH',  networkName: 'bitcoin-cash',      networkLabel: 'Bitcoin Cash',     contractAddress: null, confirmations: 6,  estimatedTime: '~30 minutes', explorerUrl: 'https://blockchair.com/bitcoin-cash' },
    // XRP
    { currencySymbol: 'XRP',  networkName: 'xrp-ledger',        networkLabel: 'XRP Ledger',       contractAddress: null, confirmations: 1,  estimatedTime: '~5 seconds',  explorerUrl: 'https://xrpscan.com' },
    // DOT
    { currencySymbol: 'DOT',  networkName: 'polkadot',          networkLabel: 'Polkadot',         contractAddress: null, confirmations: 1,  estimatedTime: '~30 seconds', explorerUrl: 'https://polkascan.io' },
    // ADA
    { currencySymbol: 'ADA',  networkName: 'cardano',           networkLabel: 'Cardano',          contractAddress: null, confirmations: 15, estimatedTime: '~5 minutes',  explorerUrl: 'https://cardanoscan.io' },
    // ATOM
    { currencySymbol: 'ATOM', networkName: 'cosmos-hub',        networkLabel: 'Cosmos Hub',       contractAddress: null, confirmations: 1,  estimatedTime: '~7 seconds',  explorerUrl: 'https://mintscan.io/cosmos' },
    // LINK - 2 networks
    { currencySymbol: 'LINK', networkName: 'ethereum-mainnet',  networkLabel: 'ERC-20',           contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA', confirmations: 12, estimatedTime: '~5 minutes', explorerUrl: 'https://etherscan.io' },
    { currencySymbol: 'LINK', networkName: 'bsc',               networkLabel: 'BEP-20',           contractAddress: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', confirmations: 15, estimatedTime: '~3 minutes', explorerUrl: 'https://bscscan.com' },
    // UNI
    { currencySymbol: 'UNI',  networkName: 'ethereum-mainnet',  networkLabel: 'ERC-20',           contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', confirmations: 12, estimatedTime: '~5 minutes', explorerUrl: 'https://etherscan.io' },
    // DAI
    { currencySymbol: 'DAI',  networkName: 'ethereum-mainnet',  networkLabel: 'ERC-20',           contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F', confirmations: 12, estimatedTime: '~5 minutes', explorerUrl: 'https://etherscan.io' },
    // DOGE
    { currencySymbol: 'DOGE', networkName: 'dogecoin',          networkLabel: 'Dogecoin',         contractAddress: null, confirmations: 40, estimatedTime: '~40 minutes', explorerUrl: 'https://blockchair.com/dogecoin' },
    // TON
    { currencySymbol: 'TON',  networkName: 'ton',               networkLabel: 'TON',              contractAddress: null, confirmations: 1,  estimatedTime: '~5 seconds',  explorerUrl: 'https://tonscan.org' },
    // NEAR
    { currencySymbol: 'NEAR', networkName: 'near',              networkLabel: 'NEAR',             contractAddress: null, confirmations: 1,  estimatedTime: '~2 seconds',  explorerUrl: 'https://nearblocks.io' },
    // SHIB - ERC-20
    { currencySymbol: 'SHIB', networkName: 'ethereum-mainnet',  networkLabel: 'ERC-20',           contractAddress: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', confirmations: 12, estimatedTime: '~5 minutes', explorerUrl: 'https://etherscan.io' },
    // APT
    { currencySymbol: 'APT',  networkName: 'aptos',             networkLabel: 'Aptos',            contractAddress: null, confirmations: 1,  estimatedTime: '~2 seconds',  explorerUrl: 'https://aptoscan.com' },
    // FTM
    { currencySymbol: 'FTM',  networkName: 'fantom',            networkLabel: 'Fantom Opera',     contractAddress: null, confirmations: 1,  estimatedTime: '~2 seconds',  explorerUrl: 'https://ftmscan.com' },
  ];

  for (const n of networkDefs) {
    const cId = currencyMap[n.currencySymbol];
    if (!cId) continue;
    // Use a composite key approach: find existing or create
    const existing = await prisma.currencyNetwork.findFirst({
      where: { currencyId: cId, networkName: n.networkName },
    });
    if (existing) {
      await prisma.currencyNetwork.update({
        where: { id: existing.id },
        data: {
          networkLabel: n.networkLabel,
          contractAddress: n.contractAddress,
          confirmations: n.confirmations,
          isActive: true,
          estimatedTime: n.estimatedTime,
          explorerUrl: n.explorerUrl,
        },
      });
    } else {
      await prisma.currencyNetwork.create({
        data: {
          currencyId: cId,
          networkName: n.networkName,
          networkLabel: n.networkLabel,
          contractAddress: n.contractAddress,
          confirmations: n.confirmations,
          isActive: true,
          estimatedTime: n.estimatedTime,
          explorerUrl: n.explorerUrl,
        },
      });
    }
  }

  console.log(`  Seeded ${networkDefs.length} currency networks.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SPORTS (35+)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding sports...');

  const sports = [
    { name: 'Football',            slug: 'football',             icon: '\u26BD',  sortOrder: 1  },
    { name: 'Basketball',          slug: 'basketball',           icon: '\uD83C\uDFC0', sortOrder: 2  },
    { name: 'Tennis',              slug: 'tennis',               icon: '\uD83C\uDFBE', sortOrder: 3  },
    { name: 'American Football',   slug: 'american-football',    icon: '\uD83C\uDFC8', sortOrder: 4  },
    { name: 'Baseball',            slug: 'baseball',             icon: '\u26BE',  sortOrder: 5  },
    { name: 'Ice Hockey',          slug: 'ice-hockey',           icon: '\uD83C\uDFD2', sortOrder: 6  },
    { name: 'MMA/UFC',             slug: 'mma-ufc',             icon: '\uD83E\uDD4A', sortOrder: 7  },
    { name: 'Boxing',              slug: 'boxing',               icon: '\uD83E\uDD4A', sortOrder: 8  },
    { name: 'Cricket',             slug: 'cricket',              icon: '\uD83C\uDFCF', sortOrder: 9  },
    { name: 'Rugby Union',         slug: 'rugby-union',          icon: '\uD83C\uDFC9', sortOrder: 10 },
    { name: 'Rugby League',        slug: 'rugby-league',         icon: '\uD83C\uDFC9', sortOrder: 11 },
    { name: 'Golf',                slug: 'golf',                 icon: '\u26F3',  sortOrder: 12 },
    { name: 'Darts',               slug: 'darts',                icon: '\uD83C\uDFAF', sortOrder: 13 },
    { name: 'Snooker',             slug: 'snooker',              icon: '\uD83C\uDFB1', sortOrder: 14 },
    { name: 'Table Tennis',        slug: 'table-tennis',         icon: '\uD83C\uDFD3', sortOrder: 15 },
    { name: 'Volleyball',          slug: 'volleyball',           icon: '\uD83C\uDFD0', sortOrder: 16 },
    { name: 'Handball',            slug: 'handball',             icon: '\uD83E\uDD3E', sortOrder: 17 },
    { name: 'Badminton',           slug: 'badminton',            icon: '\uD83C\uDFF8', sortOrder: 18 },
    { name: 'Cycling',             slug: 'cycling',              icon: '\uD83D\uDEB4', sortOrder: 19 },
    { name: 'Formula 1',           slug: 'formula-1',            icon: '\uD83C\uDFCE\uFE0F', sortOrder: 20 },
    { name: 'NASCAR',              slug: 'nascar',               icon: '\uD83C\uDFCE\uFE0F', sortOrder: 21 },
    { name: 'Horse Racing',        slug: 'horse-racing',         icon: '\uD83C\uDFC7', sortOrder: 22 },
    { name: 'Greyhound Racing',    slug: 'greyhound-racing',     icon: '\uD83D\uDC15', sortOrder: 23 },
    { name: 'Esports (CS2)',       slug: 'esports-cs2',          icon: '\uD83C\uDFAE', sortOrder: 24 },
    { name: 'Esports (Dota 2)',    slug: 'esports-dota-2',       icon: '\uD83C\uDFAE', sortOrder: 25 },
    { name: 'Esports (LoL)',       slug: 'esports-lol',          icon: '\uD83C\uDFAE', sortOrder: 26 },
    { name: 'Esports (Valorant)',  slug: 'esports-valorant',     icon: '\uD83C\uDFAE', sortOrder: 27 },
    { name: 'Futsal',              slug: 'futsal',               icon: '\u26BD',  sortOrder: 28 },
    { name: 'Beach Volleyball',    slug: 'beach-volleyball',     icon: '\uD83C\uDFD0', sortOrder: 29 },
    { name: 'Water Polo',          slug: 'water-polo',           icon: '\uD83E\uDD3D', sortOrder: 30 },
    { name: 'Alpine Skiing',       slug: 'alpine-skiing',        icon: '\u26F7\uFE0F', sortOrder: 31 },
    { name: 'Biathlon',            slug: 'biathlon',             icon: '\uD83C\uDFBF', sortOrder: 32 },
    { name: 'Cross Country Skiing', slug: 'cross-country-skiing', icon: '\uD83C\uDFBF', sortOrder: 33 },
    { name: 'Surfing',             slug: 'surfing',              icon: '\uD83C\uDFC4', sortOrder: 34 },
    { name: 'Aussie Rules',        slug: 'aussie-rules',         icon: '\uD83C\uDFC9', sortOrder: 35 },
  ];

  const sportMap: Record<string, string> = {};

  for (const s of sports) {
    const record = await prisma.sport.upsert({
      where: { slug: s.slug },
      update: { name: s.name, icon: s.icon, isActive: true, sortOrder: s.sortOrder },
      create: { name: s.name, slug: s.slug, icon: s.icon, isActive: true, sortOrder: s.sortOrder },
    });
    sportMap[s.slug] = record.id;
  }

  console.log(`  Seeded ${sports.length} sports.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. COMPETITIONS (20+)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding competitions...');

  const competitionDefs = [
    // Football
    { sportSlug: 'football', name: 'Premier League',       slug: 'premier-league',       country: 'England' },
    { sportSlug: 'football', name: 'La Liga',              slug: 'la-liga',              country: 'Spain' },
    { sportSlug: 'football', name: 'Bundesliga',           slug: 'bundesliga',           country: 'Germany' },
    { sportSlug: 'football', name: 'Serie A',              slug: 'serie-a',              country: 'Italy' },
    { sportSlug: 'football', name: 'Ligue 1',              slug: 'ligue-1',              country: 'France' },
    { sportSlug: 'football', name: 'Champions League',     slug: 'champions-league',     country: 'Europe' },
    { sportSlug: 'football', name: 'World Cup Qualifiers', slug: 'world-cup-qualifiers', country: 'International' },
    // Basketball
    { sportSlug: 'basketball', name: 'NBA',                slug: 'nba',                  country: 'USA' },
    { sportSlug: 'basketball', name: 'EuroLeague',         slug: 'euroleague',           country: 'Europe' },
    // Tennis
    { sportSlug: 'tennis', name: 'ATP Tour',               slug: 'atp-tour',             country: 'International' },
    { sportSlug: 'tennis', name: 'WTA Tour',               slug: 'wta-tour',             country: 'International' },
    { sportSlug: 'tennis', name: 'Grand Slams',            slug: 'grand-slams',          country: 'International' },
    // American Football
    { sportSlug: 'american-football', name: 'NFL',         slug: 'nfl',                  country: 'USA' },
    { sportSlug: 'american-football', name: 'NCAA Football', slug: 'ncaa-football',      country: 'USA' },
    // Baseball
    { sportSlug: 'baseball', name: 'MLB',                  slug: 'mlb',                  country: 'USA' },
    // Ice Hockey
    { sportSlug: 'ice-hockey', name: 'NHL',                slug: 'nhl',                  country: 'USA/Canada' },
    // MMA
    { sportSlug: 'mma-ufc', name: 'UFC',                   slug: 'ufc',                  country: 'International' },
    // Cricket
    { sportSlug: 'cricket', name: 'IPL',                    slug: 'ipl',                  country: 'India' },
    // Esports
    { sportSlug: 'esports-cs2', name: 'CS2 Major',         slug: 'cs2-major',            country: 'International' },
    { sportSlug: 'esports-lol', name: 'LoL Worlds',        slug: 'lol-worlds',           country: 'International' },
    { sportSlug: 'esports-dota-2', name: 'The International', slug: 'the-international', country: 'International' },
  ];

  const compMap: Record<string, string> = {};

  for (const comp of competitionDefs) {
    const sportId = sportMap[comp.sportSlug];
    if (!sportId) continue;

    const existing = await prisma.competition.findFirst({
      where: { sportId, slug: comp.slug },
    });

    let record;
    if (existing) {
      record = await prisma.competition.update({
        where: { id: existing.id },
        data: { name: comp.name, country: comp.country, isActive: true },
      });
    } else {
      record = await prisma.competition.create({
        data: {
          sportId,
          name: comp.name,
          slug: comp.slug,
          country: comp.country,
          isActive: true,
        },
      });
    }
    compMap[comp.slug] = record.id;
  }

  console.log(`  Seeded ${competitionDefs.length} competitions.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. EVENTS, MARKETS & SELECTIONS (30+ events)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding events with markets and selections...');

  const now = new Date();
  const hours = (h: number) => new Date(now.getTime() + h * 3600_000);
  const days = (d: number) => new Date(now.getTime() + d * 86400_000);
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  interface EventDef {
    compSlug: string;
    name: string;
    homeTeam: string;
    awayTeam: string;
    startTime: Date;
    status: string;
    isLive: boolean;
    isFeatured: boolean;
    scores: any;
    markets: MarketDef[];
  }

  interface MarketDef {
    name: string;
    marketKey: string;
    type: string;
    selections: SelectionDef[];
  }

  interface SelectionDef {
    name: string;
    outcome: string;
    odds: number;
    handicap?: number;
    params?: string;
  }

  const eventDefs: EventDef[] = [
    // ── PREMIER LEAGUE ──────────────────────────────────────────────────────
    {
      compSlug: 'premier-league', name: 'Manchester City vs Arsenal', homeTeam: 'Manchester City', awayTeam: 'Arsenal',
      startTime: hours(3), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Manchester City', outcome: 'home', odds: 1.85 },
          { name: 'Draw', outcome: 'draw', odds: 3.50 },
          { name: 'Arsenal', outcome: 'away', odds: 4.20 },
        ]},
        { name: 'Over/Under 2.5 Goals', marketKey: 'total_goals_2.5', type: 'TOTAL', selections: [
          { name: 'Over 2.5', outcome: 'over', odds: 1.72, params: '2.5' },
          { name: 'Under 2.5', outcome: 'under', odds: 2.10, params: '2.5' },
        ]},
        { name: 'Asian Handicap', marketKey: 'asian_handicap', type: 'SPREAD', selections: [
          { name: 'Manchester City -1.0', outcome: 'home', odds: 2.05, handicap: -1.0 },
          { name: 'Arsenal +1.0', outcome: 'away', odds: 1.80, handicap: 1.0 },
        ]},
      ],
    },
    {
      compSlug: 'premier-league', name: 'Liverpool vs Chelsea', homeTeam: 'Liverpool', awayTeam: 'Chelsea',
      startTime: minutesAgo(55), status: 'LIVE', isLive: true, isFeatured: true, scores: { home: 1, away: 0, period: '2nd Half' },
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Liverpool', outcome: 'home', odds: 1.35 },
          { name: 'Draw', outcome: 'draw', odds: 4.80 },
          { name: 'Chelsea', outcome: 'away', odds: 8.50 },
        ]},
        { name: 'Over/Under 2.5 Goals', marketKey: 'total_goals_2.5', type: 'TOTAL', selections: [
          { name: 'Over 2.5', outcome: 'over', odds: 2.20, params: '2.5' },
          { name: 'Under 2.5', outcome: 'under', odds: 1.65, params: '2.5' },
        ]},
      ],
    },
    {
      compSlug: 'premier-league', name: 'Tottenham vs Man United', homeTeam: 'Tottenham Hotspur', awayTeam: 'Manchester United',
      startTime: hours(26), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Tottenham', outcome: 'home', odds: 2.30 },
          { name: 'Draw', outcome: 'draw', odds: 3.40 },
          { name: 'Manchester United', outcome: 'away', odds: 3.10 },
        ]},
        { name: 'Over/Under 2.5 Goals', marketKey: 'total_goals_2.5', type: 'TOTAL', selections: [
          { name: 'Over 2.5', outcome: 'over', odds: 1.80, params: '2.5' },
          { name: 'Under 2.5', outcome: 'under', odds: 2.00, params: '2.5' },
        ]},
      ],
    },
    {
      compSlug: 'premier-league', name: 'Newcastle vs Aston Villa', homeTeam: 'Newcastle United', awayTeam: 'Aston Villa',
      startTime: days(2), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Newcastle', outcome: 'home', odds: 1.95 },
          { name: 'Draw', outcome: 'draw', odds: 3.50 },
          { name: 'Aston Villa', outcome: 'away', odds: 3.90 },
        ]},
      ],
    },
    // ── LA LIGA ──────────────────────────────────────────────────────────────
    {
      compSlug: 'la-liga', name: 'Real Madrid vs Barcelona', homeTeam: 'Real Madrid', awayTeam: 'FC Barcelona',
      startTime: hours(48), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Real Madrid', outcome: 'home', odds: 2.40 },
          { name: 'Draw', outcome: 'draw', odds: 3.30 },
          { name: 'Barcelona', outcome: 'away', odds: 2.90 },
        ]},
        { name: 'Over/Under 2.5 Goals', marketKey: 'total_goals_2.5', type: 'TOTAL', selections: [
          { name: 'Over 2.5', outcome: 'over', odds: 1.55, params: '2.5' },
          { name: 'Under 2.5', outcome: 'under', odds: 2.45, params: '2.5' },
        ]},
        { name: 'Both Teams to Score', marketKey: 'btts', type: 'PROP', selections: [
          { name: 'Yes', outcome: 'yes', odds: 1.60 },
          { name: 'No', outcome: 'no', odds: 2.25 },
        ]},
      ],
    },
    {
      compSlug: 'la-liga', name: 'Atletico Madrid vs Sevilla', homeTeam: 'Atletico Madrid', awayTeam: 'Sevilla',
      startTime: hours(5), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Atletico Madrid', outcome: 'home', odds: 1.55 },
          { name: 'Draw', outcome: 'draw', odds: 3.80 },
          { name: 'Sevilla', outcome: 'away', odds: 6.00 },
        ]},
      ],
    },
    // ── BUNDESLIGA ───────────────────────────────────────────────────────────
    {
      compSlug: 'bundesliga', name: 'Bayern Munich vs Borussia Dortmund', homeTeam: 'Bayern Munich', awayTeam: 'Borussia Dortmund',
      startTime: hours(28), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Bayern Munich', outcome: 'home', odds: 1.60 },
          { name: 'Draw', outcome: 'draw', odds: 4.00 },
          { name: 'Dortmund', outcome: 'away', odds: 5.25 },
        ]},
        { name: 'Over/Under 3.5 Goals', marketKey: 'total_goals_3.5', type: 'TOTAL', selections: [
          { name: 'Over 3.5', outcome: 'over', odds: 1.85, params: '3.5' },
          { name: 'Under 3.5', outcome: 'under', odds: 1.95, params: '3.5' },
        ]},
      ],
    },
    {
      compSlug: 'bundesliga', name: 'RB Leipzig vs Bayer Leverkusen', homeTeam: 'RB Leipzig', awayTeam: 'Bayer Leverkusen',
      startTime: minutesAgo(30), status: 'LIVE', isLive: true, isFeatured: false, scores: { home: 0, away: 2, period: '1st Half' },
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'RB Leipzig', outcome: 'home', odds: 5.50 },
          { name: 'Draw', outcome: 'draw', odds: 4.20 },
          { name: 'Bayer Leverkusen', outcome: 'away', odds: 1.45 },
        ]},
      ],
    },
    // ── SERIE A ──────────────────────────────────────────────────────────────
    {
      compSlug: 'serie-a', name: 'AC Milan vs Inter Milan', homeTeam: 'AC Milan', awayTeam: 'Inter Milan',
      startTime: days(3), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'AC Milan', outcome: 'home', odds: 3.10 },
          { name: 'Draw', outcome: 'draw', odds: 3.20 },
          { name: 'Inter Milan', outcome: 'away', odds: 2.30 },
        ]},
        { name: 'Over/Under 2.5 Goals', marketKey: 'total_goals_2.5', type: 'TOTAL', selections: [
          { name: 'Over 2.5', outcome: 'over', odds: 1.90, params: '2.5' },
          { name: 'Under 2.5', outcome: 'under', odds: 1.90, params: '2.5' },
        ]},
      ],
    },
    // ── LIGUE 1 ──────────────────────────────────────────────────────────────
    {
      compSlug: 'ligue-1', name: 'PSG vs Olympique Marseille', homeTeam: 'Paris Saint-Germain', awayTeam: 'Olympique Marseille',
      startTime: hours(50), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'PSG', outcome: 'home', odds: 1.40 },
          { name: 'Draw', outcome: 'draw', odds: 4.50 },
          { name: 'Marseille', outcome: 'away', odds: 7.50 },
        ]},
      ],
    },
    // ── CHAMPIONS LEAGUE ─────────────────────────────────────────────────────
    {
      compSlug: 'champions-league', name: 'Real Madrid vs Bayern Munich', homeTeam: 'Real Madrid', awayTeam: 'Bayern Munich',
      startTime: days(7), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Real Madrid', outcome: 'home', odds: 2.60 },
          { name: 'Draw', outcome: 'draw', odds: 3.30 },
          { name: 'Bayern Munich', outcome: 'away', odds: 2.70 },
        ]},
        { name: 'Over/Under 2.5 Goals', marketKey: 'total_goals_2.5', type: 'TOTAL', selections: [
          { name: 'Over 2.5', outcome: 'over', odds: 1.60, params: '2.5' },
          { name: 'Under 2.5', outcome: 'under', odds: 2.30, params: '2.5' },
        ]},
        { name: 'Asian Handicap', marketKey: 'asian_handicap', type: 'SPREAD', selections: [
          { name: 'Real Madrid -0.5', outcome: 'home', odds: 2.90, handicap: -0.5 },
          { name: 'Bayern Munich +0.5', outcome: 'away', odds: 1.40, handicap: 0.5 },
        ]},
      ],
    },
    {
      compSlug: 'champions-league', name: 'Manchester City vs PSG', homeTeam: 'Manchester City', awayTeam: 'Paris Saint-Germain',
      startTime: days(7), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_odds', type: 'MONEYLINE', selections: [
          { name: 'Manchester City', outcome: 'home', odds: 1.75 },
          { name: 'Draw', outcome: 'draw', odds: 3.60 },
          { name: 'PSG', outcome: 'away', odds: 4.80 },
        ]},
      ],
    },
    // ── NBA ──────────────────────────────────────────────────────────────────
    {
      compSlug: 'nba', name: 'Los Angeles Lakers vs Boston Celtics', homeTeam: 'Los Angeles Lakers', awayTeam: 'Boston Celtics',
      startTime: hours(6), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Lakers', outcome: 'home', odds: 2.10 },
          { name: 'Celtics', outcome: 'away', odds: 1.75 },
        ]},
        { name: 'Spread', marketKey: 'spread', type: 'SPREAD', selections: [
          { name: 'Lakers +3.5', outcome: 'home', odds: 1.91, handicap: 3.5 },
          { name: 'Celtics -3.5', outcome: 'away', odds: 1.91, handicap: -3.5 },
        ]},
        { name: 'Total Points O/U 224.5', marketKey: 'total_points', type: 'TOTAL', selections: [
          { name: 'Over 224.5', outcome: 'over', odds: 1.90, params: '224.5' },
          { name: 'Under 224.5', outcome: 'under', odds: 1.90, params: '224.5' },
        ]},
      ],
    },
    {
      compSlug: 'nba', name: 'Golden State Warriors vs Milwaukee Bucks', homeTeam: 'Golden State Warriors', awayTeam: 'Milwaukee Bucks',
      startTime: minutesAgo(90), status: 'LIVE', isLive: true, isFeatured: true, scores: { home: 68, away: 72, period: '3rd Quarter' },
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Warriors', outcome: 'home', odds: 2.35 },
          { name: 'Bucks', outcome: 'away', odds: 1.60 },
        ]},
        { name: 'Spread', marketKey: 'spread', type: 'SPREAD', selections: [
          { name: 'Warriors +4.5', outcome: 'home', odds: 1.85, handicap: 4.5 },
          { name: 'Bucks -4.5', outcome: 'away', odds: 1.95, handicap: -4.5 },
        ]},
      ],
    },
    {
      compSlug: 'nba', name: 'Denver Nuggets vs Phoenix Suns', homeTeam: 'Denver Nuggets', awayTeam: 'Phoenix Suns',
      startTime: hours(30), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Nuggets', outcome: 'home', odds: 1.65 },
          { name: 'Suns', outcome: 'away', odds: 2.25 },
        ]},
        { name: 'Total Points O/U 228.5', marketKey: 'total_points', type: 'TOTAL', selections: [
          { name: 'Over 228.5', outcome: 'over', odds: 1.87, params: '228.5' },
          { name: 'Under 228.5', outcome: 'under', odds: 1.93, params: '228.5' },
        ]},
      ],
    },
    {
      compSlug: 'nba', name: 'Dallas Mavericks vs Miami Heat', homeTeam: 'Dallas Mavericks', awayTeam: 'Miami Heat',
      startTime: hours(8), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Mavericks', outcome: 'home', odds: 1.80 },
          { name: 'Heat', outcome: 'away', odds: 2.00 },
        ]},
      ],
    },
    // ── NFL ──────────────────────────────────────────────────────────────────
    {
      compSlug: 'nfl', name: 'Kansas City Chiefs vs San Francisco 49ers', homeTeam: 'Kansas City Chiefs', awayTeam: 'San Francisco 49ers',
      startTime: days(4), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Chiefs', outcome: 'home', odds: 1.72 },
          { name: '49ers', outcome: 'away', odds: 2.15 },
        ]},
        { name: 'Spread', marketKey: 'spread', type: 'SPREAD', selections: [
          { name: 'Chiefs -2.5', outcome: 'home', odds: 1.91, handicap: -2.5 },
          { name: '49ers +2.5', outcome: 'away', odds: 1.91, handicap: 2.5 },
        ]},
        { name: 'Total Points O/U 49.5', marketKey: 'total_points', type: 'TOTAL', selections: [
          { name: 'Over 49.5', outcome: 'over', odds: 1.90, params: '49.5' },
          { name: 'Under 49.5', outcome: 'under', odds: 1.90, params: '49.5' },
        ]},
      ],
    },
    {
      compSlug: 'nfl', name: 'Philadelphia Eagles vs Dallas Cowboys', homeTeam: 'Philadelphia Eagles', awayTeam: 'Dallas Cowboys',
      startTime: days(4), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Eagles', outcome: 'home', odds: 1.55 },
          { name: 'Cowboys', outcome: 'away', odds: 2.50 },
        ]},
        { name: 'Spread', marketKey: 'spread', type: 'SPREAD', selections: [
          { name: 'Eagles -4.5', outcome: 'home', odds: 1.91, handicap: -4.5 },
          { name: 'Cowboys +4.5', outcome: 'away', odds: 1.91, handicap: 4.5 },
        ]},
      ],
    },
    // ── TENNIS ───────────────────────────────────────────────────────────────
    {
      compSlug: 'grand-slams', name: 'Djokovic vs Alcaraz', homeTeam: 'Novak Djokovic', awayTeam: 'Carlos Alcaraz',
      startTime: hours(4), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE', selections: [
          { name: 'Djokovic', outcome: 'home', odds: 2.20 },
          { name: 'Alcaraz', outcome: 'away', odds: 1.70 },
        ]},
        { name: 'Total Sets O/U 3.5', marketKey: 'total_sets', type: 'TOTAL', selections: [
          { name: 'Over 3.5 Sets', outcome: 'over', odds: 1.75, params: '3.5' },
          { name: 'Under 3.5 Sets', outcome: 'under', odds: 2.05, params: '3.5' },
        ]},
      ],
    },
    {
      compSlug: 'grand-slams', name: 'Sinner vs Medvedev', homeTeam: 'Jannik Sinner', awayTeam: 'Daniil Medvedev',
      startTime: minutesAgo(120), status: 'LIVE', isLive: true, isFeatured: true, scores: { home: 2, away: 1, period: '4th Set' },
      markets: [
        { name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE', selections: [
          { name: 'Sinner', outcome: 'home', odds: 1.30 },
          { name: 'Medvedev', outcome: 'away', odds: 3.50 },
        ]},
      ],
    },
    {
      compSlug: 'atp-tour', name: 'Rune vs Fritz', homeTeam: 'Holger Rune', awayTeam: 'Taylor Fritz',
      startTime: hours(24), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE', selections: [
          { name: 'Rune', outcome: 'home', odds: 1.85 },
          { name: 'Fritz', outcome: 'away', odds: 1.95 },
        ]},
      ],
    },
    {
      compSlug: 'wta-tour', name: 'Swiatek vs Sabalenka', homeTeam: 'Iga Swiatek', awayTeam: 'Aryna Sabalenka',
      startTime: hours(10), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE', selections: [
          { name: 'Swiatek', outcome: 'home', odds: 1.90 },
          { name: 'Sabalenka', outcome: 'away', odds: 1.90 },
        ]},
      ],
    },
    // ── MLB ──────────────────────────────────────────────────────────────────
    {
      compSlug: 'mlb', name: 'New York Yankees vs Los Angeles Dodgers', homeTeam: 'New York Yankees', awayTeam: 'Los Angeles Dodgers',
      startTime: days(1), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Yankees', outcome: 'home', odds: 2.05 },
          { name: 'Dodgers', outcome: 'away', odds: 1.80 },
        ]},
        { name: 'Run Line', marketKey: 'run_line', type: 'SPREAD', selections: [
          { name: 'Yankees +1.5', outcome: 'home', odds: 1.45, handicap: 1.5 },
          { name: 'Dodgers -1.5', outcome: 'away', odds: 2.70, handicap: -1.5 },
        ]},
      ],
    },
    // ── NHL ──────────────────────────────────────────────────────────────────
    {
      compSlug: 'nhl', name: 'Toronto Maple Leafs vs Montreal Canadiens', homeTeam: 'Toronto Maple Leafs', awayTeam: 'Montreal Canadiens',
      startTime: hours(7), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Maple Leafs', outcome: 'home', odds: 1.60 },
          { name: 'Canadiens', outcome: 'away', odds: 2.35 },
        ]},
        { name: 'Puck Line', marketKey: 'puck_line', type: 'SPREAD', selections: [
          { name: 'Maple Leafs -1.5', outcome: 'home', odds: 2.55, handicap: -1.5 },
          { name: 'Canadiens +1.5', outcome: 'away', odds: 1.52, handicap: 1.5 },
        ]},
        { name: 'Total Goals O/U 5.5', marketKey: 'total_goals', type: 'TOTAL', selections: [
          { name: 'Over 5.5', outcome: 'over', odds: 1.95, params: '5.5' },
          { name: 'Under 5.5', outcome: 'under', odds: 1.85, params: '5.5' },
        ]},
      ],
    },
    {
      compSlug: 'nhl', name: 'Edmonton Oilers vs Colorado Avalanche', homeTeam: 'Edmonton Oilers', awayTeam: 'Colorado Avalanche',
      startTime: minutesAgo(40), status: 'LIVE', isLive: true, isFeatured: false, scores: { home: 3, away: 2, period: '3rd Period' },
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Oilers', outcome: 'home', odds: 1.50 },
          { name: 'Avalanche', outcome: 'away', odds: 2.60 },
        ]},
      ],
    },
    // ── UFC / MMA ────────────────────────────────────────────────────────────
    {
      compSlug: 'ufc', name: 'UFC 312: Du Plessis vs Strickland', homeTeam: 'Dricus Du Plessis', awayTeam: 'Sean Strickland',
      startTime: days(5), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Fight Winner', marketKey: 'fight_winner', type: 'MONEYLINE', selections: [
          { name: 'Du Plessis', outcome: 'home', odds: 1.65 },
          { name: 'Strickland', outcome: 'away', odds: 2.25 },
        ]},
        { name: 'Method of Victory', marketKey: 'method_of_victory', type: 'PROP', selections: [
          { name: 'Du Plessis by KO/TKO', outcome: 'home_ko', odds: 3.50 },
          { name: 'Du Plessis by Decision', outcome: 'home_dec', odds: 3.00 },
          { name: 'Strickland by KO/TKO', outcome: 'away_ko', odds: 5.50 },
          { name: 'Strickland by Decision', outcome: 'away_dec', odds: 3.75 },
        ]},
      ],
    },
    {
      compSlug: 'ufc', name: 'UFC 312: Volkanovski vs Topuria', homeTeam: 'Alexander Volkanovski', awayTeam: 'Ilia Topuria',
      startTime: days(5), status: 'UPCOMING', isLive: false, isFeatured: true, scores: null,
      markets: [
        { name: 'Fight Winner', marketKey: 'fight_winner', type: 'MONEYLINE', selections: [
          { name: 'Volkanovski', outcome: 'home', odds: 2.60 },
          { name: 'Topuria', outcome: 'away', odds: 1.52 },
        ]},
        { name: 'Over/Under 2.5 Rounds', marketKey: 'total_rounds', type: 'TOTAL', selections: [
          { name: 'Over 2.5 Rounds', outcome: 'over', odds: 1.75, params: '2.5' },
          { name: 'Under 2.5 Rounds', outcome: 'under', odds: 2.05, params: '2.5' },
        ]},
      ],
    },
    // ── EUROLEAGUE ───────────────────────────────────────────────────────────
    {
      compSlug: 'euroleague', name: 'Real Madrid vs Olympiacos', homeTeam: 'Real Madrid Baloncesto', awayTeam: 'Olympiacos BC',
      startTime: hours(20), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Moneyline', marketKey: 'moneyline', type: 'MONEYLINE', selections: [
          { name: 'Real Madrid', outcome: 'home', odds: 1.50 },
          { name: 'Olympiacos', outcome: 'away', odds: 2.55 },
        ]},
        { name: 'Spread', marketKey: 'spread', type: 'SPREAD', selections: [
          { name: 'Real Madrid -5.5', outcome: 'home', odds: 1.90, handicap: -5.5 },
          { name: 'Olympiacos +5.5', outcome: 'away', odds: 1.90, handicap: 5.5 },
        ]},
      ],
    },
    // ── ESPORTS CS2 ──────────────────────────────────────────────────────────
    {
      compSlug: 'cs2-major', name: 'Natus Vincere vs FaZe Clan', homeTeam: 'Natus Vincere', awayTeam: 'FaZe Clan',
      startTime: hours(2), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE', selections: [
          { name: 'NAVI', outcome: 'home', odds: 1.70 },
          { name: 'FaZe', outcome: 'away', odds: 2.15 },
        ]},
        { name: 'Map Handicap', marketKey: 'map_handicap', type: 'SPREAD', selections: [
          { name: 'NAVI -1.5', outcome: 'home', odds: 2.40, handicap: -1.5 },
          { name: 'FaZe +1.5', outcome: 'away', odds: 1.55, handicap: 1.5 },
        ]},
      ],
    },
    // ── ESPORTS LOL ──────────────────────────────────────────────────────────
    {
      compSlug: 'lol-worlds', name: 'T1 vs Gen.G', homeTeam: 'T1', awayTeam: 'Gen.G',
      startTime: days(6), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE', selections: [
          { name: 'T1', outcome: 'home', odds: 1.90 },
          { name: 'Gen.G', outcome: 'away', odds: 1.90 },
        ]},
      ],
    },
    // ── IPL CRICKET ──────────────────────────────────────────────────────────
    {
      compSlug: 'ipl', name: 'Mumbai Indians vs Chennai Super Kings', homeTeam: 'Mumbai Indians', awayTeam: 'Chennai Super Kings',
      startTime: days(2), status: 'UPCOMING', isLive: false, isFeatured: false, scores: null,
      markets: [
        { name: 'Match Winner', marketKey: 'match_winner', type: 'MONEYLINE', selections: [
          { name: 'Mumbai Indians', outcome: 'home', odds: 1.85 },
          { name: 'Chennai Super Kings', outcome: 'away', odds: 1.95 },
        ]},
      ],
    },
  ];

  let eventCount = 0;
  let marketCount = 0;
  let selectionCount = 0;

  for (const ev of eventDefs) {
    const competitionId = compMap[ev.compSlug];
    if (!competitionId) continue;

    // Delete existing event with same name in this competition (idempotent re-seed)
    const existingEvent = await prisma.event.findFirst({
      where: { competitionId, name: ev.name },
    });

    let eventRecord;
    if (existingEvent) {
      // Delete child records first
      const existingMarkets = await prisma.market.findMany({ where: { eventId: existingEvent.id }, include: { selections: true } });
      for (const m of existingMarkets) {
        await prisma.selection.deleteMany({ where: { marketId: m.id } });
      }
      await prisma.market.deleteMany({ where: { eventId: existingEvent.id } });

      eventRecord = await prisma.event.update({
        where: { id: existingEvent.id },
        data: {
          name: ev.name,
          homeTeam: ev.homeTeam,
          awayTeam: ev.awayTeam,
          startTime: ev.startTime,
          status: ev.status as any,
          isLive: ev.isLive,
          isFeatured: ev.isFeatured,
          scores: ev.scores,
        },
      });
    } else {
      eventRecord = await prisma.event.create({
        data: {
          competitionId,
          name: ev.name,
          homeTeam: ev.homeTeam,
          awayTeam: ev.awayTeam,
          startTime: ev.startTime,
          status: ev.status as any,
          isLive: ev.isLive,
          isFeatured: ev.isFeatured,
          scores: ev.scores,
        },
      });
    }
    eventCount++;

    for (let mi = 0; mi < ev.markets.length; mi++) {
      const mkt = ev.markets[mi];
      const marketRecord = await prisma.market.create({
        data: {
          eventId: eventRecord.id,
          name: mkt.name,
          marketKey: mkt.marketKey,
          type: mkt.type as any,
          period: 'FT',
          status: 'OPEN' as any,
          sortOrder: mi,
        },
      });
      marketCount++;

      for (const sel of mkt.selections) {
        await prisma.selection.create({
          data: {
            marketId: marketRecord.id,
            name: sel.name,
            outcome: sel.outcome,
            odds: sel.odds,
            probability: parseFloat((1 / sel.odds).toFixed(4)),
            handicap: sel.handicap ?? null,
            params: sel.params ?? null,
            status: 'ACTIVE' as any,
          },
        });
        selectionCount++;
      }
    }
  }

  console.log(`  Seeded ${eventCount} events, ${marketCount} markets, ${selectionCount} selections.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. VIP TIER CONFIGS (8 tiers)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding VIP tier configs...');

  const vipTiers = [
    {
      tier: 'BRONZE' as any, name: 'Bronze', minWagered: 0, rakebackPercent: 0.5,
      turboBoostPercent: 5, turboDurationMin: 15, dailyBonusMax: 1, weeklyBonusMax: null,
      monthlyBonusMax: null, levelUpReward: 0, calendarSplitPercent: 70, sortOrder: 1,
      benefits: {
        description: [
          'Base rakeback on every bet',
          'Daily cash rewards via Rewards Calendar',
          'Turbo boost when claiming calendar rewards',
          'Access to level-up rewards',
          'Standard customer support',
        ],
      },
    },
    {
      tier: 'SILVER' as any, name: 'Silver', minWagered: 5000, rakebackPercent: 1,
      turboBoostPercent: 8, turboDurationMin: 25, dailyBonusMax: 5, weeklyBonusMax: 25,
      monthlyBonusMax: null, levelUpReward: 10, calendarSplitPercent: 65, sortOrder: 2,
      benefits: {
        description: [
          'Enhanced rakeback rate (1%)',
          'Weekly cash rewards unlocked',
          'Global tournament access',
          'Tier-up bonus on promotion',
          'Extended turbo boost duration',
          'Priority customer support',
        ],
      },
    },
    {
      tier: 'GOLD' as any, name: 'Gold', minWagered: 25000, rakebackPercent: 1.5,
      turboBoostPercent: 10, turboDurationMin: 35, dailyBonusMax: 15, weeklyBonusMax: 75,
      monthlyBonusMax: 300, levelUpReward: 50, calendarSplitPercent: 60, sortOrder: 3,
      benefits: {
        description: [
          'Premium rakeback rate (1.5%)',
          'Monthly cash rewards unlocked',
          'Bigger level-up payouts',
          'Exclusive Gold-tier promotions',
          'Enhanced turbo boost (10%)',
          'Increased daily bonus limits',
        ],
      },
    },
    {
      tier: 'PLATINUM' as any, name: 'Platinum', minWagered: 100000, rakebackPercent: 2,
      turboBoostPercent: 13, turboDurationMin: 45, dailyBonusMax: 50, weeklyBonusMax: 250,
      monthlyBonusMax: 1000, levelUpReward: 200, calendarSplitPercent: 55, sortOrder: 4,
      benefits: {
        description: [
          'Superior rakeback rate (2%)',
          'Significant level-up rewards ($200)',
          'Higher withdrawal limits',
          'Exclusive Platinum promotions',
          'Dedicated support channel',
          'Early access to new features',
          '45-minute turbo boost sessions',
        ],
      },
    },
    {
      tier: 'DIAMOND' as any, name: 'Diamond', minWagered: 500000, rakebackPercent: 2.5,
      turboBoostPercent: 16, turboDurationMin: 55, dailyBonusMax: 150, weeklyBonusMax: 750,
      monthlyBonusMax: 3000, levelUpReward: 500, calendarSplitPercent: 50, sortOrder: 5,
      benefits: {
        description: [
          'Elite rakeback rate (2.5%)',
          'Major level-up rewards ($500)',
          'VIP-only tournaments',
          'Custom promotional offers',
          'Priority withdrawal processing',
          'Personal account manager',
          '55-minute turbo boost sessions',
        ],
      },
    },
    {
      tier: 'ELITE' as any, name: 'Elite', minWagered: 2000000, rakebackPercent: 3,
      turboBoostPercent: 19, turboDurationMin: 65, dailyBonusMax: 500, weeklyBonusMax: 2500,
      monthlyBonusMax: 10000, levelUpReward: 2000, calendarSplitPercent: 45, sortOrder: 6,
      benefits: {
        description: [
          'Premium rakeback rate (3%)',
          'Substantial level-up rewards ($2,000)',
          'Bespoke reward packages',
          'Real-world experience invitations',
          'Highest withdrawal limits',
          'Dedicated VIP host',
          '65-minute turbo boost sessions',
          'Custom bet limits on request',
        ],
      },
    },
    {
      tier: 'BLACK_DIAMOND' as any, name: 'Black Diamond', minWagered: 10000000, rakebackPercent: 4,
      turboBoostPercent: 22, turboDurationMin: 80, dailyBonusMax: 2000, weeklyBonusMax: 10000,
      monthlyBonusMax: 40000, levelUpReward: 10000, calendarSplitPercent: 40, sortOrder: 7,
      benefits: {
        description: [
          'Top-tier rakeback rate (4%)',
          'Massive level-up rewards ($10,000)',
          'Private VIP concierge 24/7',
          'Money-can\'t-buy experiences',
          'No withdrawal limits',
          'Exclusive Black Diamond events',
          '80-minute turbo boost sessions',
          'Personal terms negotiation',
          'Birthday & anniversary bonuses',
        ],
      },
    },
    {
      tier: 'BLUE_DIAMOND' as any, name: 'Blue Diamond', minWagered: 50000000, rakebackPercent: 5,
      turboBoostPercent: 25, turboDurationMin: 90, dailyBonusMax: 5000, weeklyBonusMax: 25000,
      monthlyBonusMax: 100000, levelUpReward: 50000, calendarSplitPercent: 35, sortOrder: 8,
      benefits: {
        description: [
          'Maximum rakeback rate (5%)',
          'Highest level-up rewards ($50,000)',
          'Fully personalized VIP program',
          'Dedicated private VIP host',
          'All Black Diamond perks',
          '90-minute turbo boost sessions (25%)',
          'Luxury event invitations worldwide',
          'Custom cashback & reload offers',
          'Private terms and conditions',
          'Unlimited everything',
        ],
      },
    },
  ];

  for (const vip of vipTiers) {
    await prisma.vipTierConfig.upsert({
      where: { tier: vip.tier },
      update: {
        name: vip.name,
        minWagered: vip.minWagered,
        rakebackPercent: vip.rakebackPercent,
        turboBoostPercent: vip.turboBoostPercent,
        turboDurationMin: vip.turboDurationMin,
        dailyBonusMax: vip.dailyBonusMax,
        weeklyBonusMax: vip.weeklyBonusMax,
        monthlyBonusMax: vip.monthlyBonusMax,
        levelUpReward: vip.levelUpReward,
        calendarSplitPercent: vip.calendarSplitPercent,
        sortOrder: vip.sortOrder,
        benefits: vip.benefits,
      },
      create: {
        tier: vip.tier,
        name: vip.name,
        minWagered: vip.minWagered,
        rakebackPercent: vip.rakebackPercent,
        turboBoostPercent: vip.turboBoostPercent,
        turboDurationMin: vip.turboDurationMin,
        dailyBonusMax: vip.dailyBonusMax,
        weeklyBonusMax: vip.weeklyBonusMax,
        monthlyBonusMax: vip.monthlyBonusMax,
        levelUpReward: vip.levelUpReward,
        calendarSplitPercent: vip.calendarSplitPercent,
        sortOrder: vip.sortOrder,
        benefits: vip.benefits,
      },
    });
  }

  console.log(`  Seeded ${vipTiers.length} VIP tiers.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CASINO GAME CONFIGS (15 games)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding casino game configs...');

  const casinoGameConfigs = [
    { game: 'crash',       enabled: true, houseEdge: 3.0,  minBet: 0.01, maxBet: 10000, maxPayout: 1000000, jackpotContribution: 0.5, config: { tickInterval: 100, minMultiplier: 1.0 } },
    { game: 'dice',        enabled: true, houseEdge: 1.0,  minBet: 0.01, maxBet: 10000, maxPayout: 500000,  jackpotContribution: 0.3, config: { minValue: 0, maxValue: 99.99 } },
    { game: 'mines',       enabled: true, houseEdge: 2.0,  minBet: 0.01, maxBet: 5000,  maxPayout: 250000,  jackpotContribution: 0.3, config: { gridSize: 25, minMines: 1, maxMines: 24 } },
    { game: 'plinko',      enabled: true, houseEdge: 2.0,  minBet: 0.01, maxBet: 5000,  maxPayout: 250000,  jackpotContribution: 0.3, config: { rows: [8, 12, 16], risks: ['low', 'medium', 'high'] } },
    { game: 'coinflip',    enabled: true, houseEdge: 2.0,  minBet: 0.01, maxBet: 10000, maxPayout: 500000,  jackpotContribution: 0.2, config: { payout: 1.94 } },
    { game: 'roulette',    enabled: true, houseEdge: 2.7,  minBet: 0.10, maxBet: 10000, maxPayout: 500000,  jackpotContribution: 0.3, config: { type: 'european', numbers: 37 } },
    { game: 'blackjack',   enabled: true, houseEdge: 0.5,  minBet: 0.10, maxBet: 5000,  maxPayout: 100000,  jackpotContribution: 0.2, config: { decks: 6, blackjackPays: 1.5, dealerStandsSoft17: true } },
    { game: 'hilo',        enabled: true, houseEdge: 2.0,  minBet: 0.01, maxBet: 5000,  maxPayout: 250000,  jackpotContribution: 0.3, config: { deckSize: 52 } },
    { game: 'wheel',       enabled: true, houseEdge: 3.0,  minBet: 0.10, maxBet: 5000,  maxPayout: 250000,  jackpotContribution: 0.5, config: { segments: [1, 2, 5, 10, 20, 40], riskLevels: 3 } },
    { game: 'tower',       enabled: true, houseEdge: 2.0,  minBet: 0.01, maxBet: 5000,  maxPayout: 250000,  jackpotContribution: 0.3, config: { rows: 10, difficulties: ['easy', 'medium', 'hard', 'expert'] } },
    { game: 'limbo',       enabled: true, houseEdge: 1.0,  minBet: 0.01, maxBet: 10000, maxPayout: 1000000, jackpotContribution: 0.2, config: { minTarget: 1.01, maxTarget: 1000000 } },
    { game: 'keno',        enabled: true, houseEdge: 3.0,  minBet: 0.10, maxBet: 5000,  maxPayout: 250000,  jackpotContribution: 0.5, config: { gridSize: 40, maxPicks: 10, drawCount: 10 } },
    { game: 'video-poker', enabled: true, houseEdge: 1.5,  minBet: 0.10, maxBet: 1000,  maxPayout: 50000,   jackpotContribution: 0.3, config: { variant: 'jacks-or-better' } },
    { game: 'baccarat',    enabled: true, houseEdge: 1.2,  minBet: 0.10, maxBet: 10000, maxPayout: 500000,  jackpotContribution: 0.3, config: { decks: 8, bankerCommission: 5 } },
    { game: 'slots',       enabled: true, houseEdge: 4.0,  minBet: 0.10, maxBet: 1000,  maxPayout: 100000,  jackpotContribution: 1.0, config: { reels: 3, rows: 3, symbols: 8, paylines: 5 } },
  ];

  for (const cfg of casinoGameConfigs) {
    const existing = await prisma.casinoGameConfig.findFirst({
      where: { gameSlug: cfg.game },
    });
    if (existing) {
      await prisma.casinoGameConfig.update({
        where: { id: existing.id },
        data: {
          isActive: cfg.enabled,
          houseEdge: cfg.houseEdge,
          minBet: cfg.minBet,
          maxBet: cfg.maxBet,
          jackpotContribution: cfg.jackpotContribution,
          config: { ...cfg.config, maxPayout: cfg.maxPayout },
        },
      });
    } else {
      await prisma.casinoGameConfig.create({
        data: {
          gameSlug: cfg.game,
          isActive: cfg.enabled,
          houseEdge: cfg.houseEdge,
          minBet: cfg.minBet,
          maxBet: cfg.maxBet,
          jackpotContribution: cfg.jackpotContribution,
          config: { ...cfg.config, maxPayout: cfg.maxPayout },
        },
      });
    }
  }

  console.log(`  Seeded ${casinoGameConfigs.length} casino game configs.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6b. CASINO GAME RECORDS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding casino game records...');

  const casinoGames = [
    { name: 'Crash',        slug: 'crash',       type: 'CRASH',    category: 'originals', rtp: 97.0,  volatility: 'HIGH',   houseEdge: 3.0,  thumbnail: '/images/games/crash.webp',       description: 'Watch the multiplier climb and cash out before it crashes! Multiplayer real-time game with auto-cashout.', tags: ['provably-fair', 'multiplayer', 'popular'], isProvablyFair: true,  sortOrder: 1  },
    { name: 'Dice',         slug: 'dice',        type: 'DICE',     category: 'originals', rtp: 99.0,  volatility: 'LOW',    houseEdge: 1.0,  thumbnail: '/images/games/dice.webp',        description: 'Set your target and roll. Adjust risk and reward with the slider.', tags: ['provably-fair', 'instant'], isProvablyFair: true,  sortOrder: 2  },
    { name: 'Mines',        slug: 'mines',       type: 'MINES',    category: 'originals', rtp: 98.0,  volatility: 'MEDIUM', houseEdge: 2.0,  thumbnail: '/images/games/mines.webp',       description: 'Navigate a 5x5 minefield revealing gems for increasing multipliers. Cash out anytime.', tags: ['provably-fair', 'strategy'], isProvablyFair: true,  sortOrder: 3  },
    { name: 'Plinko',       slug: 'plinko',      type: 'PLINKO',   category: 'originals', rtp: 98.0,  volatility: 'MEDIUM', houseEdge: 2.0,  thumbnail: '/images/games/plinko.webp',      description: 'Drop the ball and watch it bounce through pegs to land on multiplier buckets.', tags: ['provably-fair', 'popular'], isProvablyFair: true,  sortOrder: 4  },
    { name: 'Coinflip',     slug: 'coinflip',    type: 'COINFLIP', category: 'originals', rtp: 98.0,  volatility: 'LOW',    houseEdge: 2.0,  thumbnail: '/images/games/coinflip.webp',    description: 'Heads or tails? Classic 50/50 with a 3D coin flip animation.', tags: ['provably-fair', 'instant', 'simple'], isProvablyFair: true,  sortOrder: 5  },
    { name: 'Roulette',     slug: 'roulette',    type: 'TABLE',    category: 'table',     rtp: 97.3,  volatility: 'MEDIUM', houseEdge: 2.7,  thumbnail: '/images/games/roulette.webp',    description: 'European roulette with animated spinning wheel and full betting board.', tags: ['provably-fair', 'classic', 'table'], isProvablyFair: true,  sortOrder: 6  },
    { name: 'Blackjack',    slug: 'blackjack',   type: 'TABLE',    category: 'table',     rtp: 99.5,  volatility: 'LOW',    houseEdge: 0.5,  thumbnail: '/images/games/blackjack.webp',   description: 'Classic card game. Hit, stand, double down, split, or take insurance.', tags: ['provably-fair', 'classic', 'table', 'cards'], isProvablyFair: true,  sortOrder: 7  },
    { name: 'HiLo',         slug: 'hilo',        type: 'TABLE',    category: 'originals', rtp: 98.0,  volatility: 'MEDIUM', houseEdge: 2.0,  thumbnail: '/images/games/hilo.webp',        description: 'Guess higher or lower on each card for a progressive multiplier chain.', tags: ['provably-fair', 'cards'], isProvablyFair: true,  sortOrder: 8  },
    { name: 'Wheel',        slug: 'wheel',       type: 'TABLE',    category: 'originals', rtp: 97.0,  volatility: 'HIGH',   houseEdge: 3.0,  thumbnail: '/images/games/wheel.webp',       description: 'Spin the Wheel of Fortune with color-coded multiplier segments.', tags: ['provably-fair', 'popular'], isProvablyFair: true,  sortOrder: 9  },
    { name: 'Tower',        slug: 'tower',       type: 'TABLE',    category: 'originals', rtp: 98.0,  volatility: 'MEDIUM', houseEdge: 2.0,  thumbnail: '/images/games/tower.webp',       description: 'Climb the tower row by row. Choose your difficulty and cash out at any level.', tags: ['provably-fair', 'strategy'], isProvablyFair: true,  sortOrder: 10 },
    { name: 'Limbo',        slug: 'limbo',       type: 'TABLE',    category: 'originals', rtp: 99.0,  volatility: 'HIGH',   houseEdge: 1.0,  thumbnail: '/images/games/limbo.webp',       description: 'Set your target multiplier and see if the result goes above it. Simple yet thrilling.', tags: ['provably-fair', 'instant'], isProvablyFair: true,  sortOrder: 11 },
    { name: 'Keno',         slug: 'keno',        type: 'TABLE',    category: 'originals', rtp: 97.0,  volatility: 'HIGH',   houseEdge: 3.0,  thumbnail: '/images/games/keno.webp',        description: 'Pick up to 10 numbers from a grid of 40. The more matches, the bigger the payout.', tags: ['provably-fair', 'lottery'], isProvablyFair: true,  sortOrder: 12 },
    { name: 'Video Poker',  slug: 'video-poker', type: 'TABLE',    category: 'table',     rtp: 98.5,  volatility: 'MEDIUM', houseEdge: 1.5,  thumbnail: '/images/games/video-poker.webp', description: 'Jacks or Better video poker. Hold your best cards and draw for the winning hand.', tags: ['provably-fair', 'cards', 'poker'], isProvablyFair: true,  sortOrder: 13 },
    { name: 'Baccarat',     slug: 'baccarat',    type: 'TABLE',    category: 'table',     rtp: 98.8,  volatility: 'LOW',    houseEdge: 1.2,  thumbnail: '/images/games/baccarat.webp',    description: 'Bet on Player, Banker, or Tie. Classic card game with standard drawing rules.', tags: ['provably-fair', 'classic', 'table', 'cards'], isProvablyFair: true,  sortOrder: 14 },
    { name: 'Slots',        slug: 'slots',       type: 'SLOT',     category: 'slots',     rtp: 96.0,  volatility: 'HIGH',   houseEdge: 4.0,  thumbnail: '/images/games/slots.webp',       description: 'Classic 3x3 slot machine with 8 symbols and multiple paylines. Spin to win!', tags: ['provably-fair', 'jackpot', 'popular'], isProvablyFair: true,  sortOrder: 15 },
  ];

  for (const g of casinoGames) {
    await prisma.casinoGame.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name,
        type: g.type as any,
        category: g.category,
        rtp: g.rtp,
        volatility: g.volatility,
        houseEdge: g.houseEdge,
        thumbnail: g.thumbnail,
        description: g.description,
        tags: g.tags,
        isActive: true,
        isDemoAvailable: true,
        isProvablyFair: g.isProvablyFair,
        sortOrder: g.sortOrder,
      },
      create: {
        name: g.name,
        slug: g.slug,
        type: g.type as any,
        category: g.category,
        rtp: g.rtp,
        volatility: g.volatility,
        houseEdge: g.houseEdge,
        thumbnail: g.thumbnail,
        description: g.description,
        tags: g.tags,
        isActive: true,
        isDemoAvailable: true,
        isProvablyFair: g.isProvablyFair,
        sortOrder: g.sortOrder,
      },
    });
  }

  console.log(`  Seeded ${casinoGames.length} casino games.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. JACKPOT POOLS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding jackpot pools...');

  const jackpotPools = [
    { tier: 'mini',  amount: 100,   seedAmount: 100   },
    { tier: 'major', amount: 1000,  seedAmount: 1000  },
    { tier: 'grand', amount: 10000, seedAmount: 10000 },
  ];

  for (const jp of jackpotPools) {
    const existing = await prisma.jackpotPool.findFirst({ where: { tier: jp.tier } });
    if (existing) {
      await prisma.jackpotPool.update({
        where: { id: existing.id },
        data: { seedAmount: jp.seedAmount },
      });
    } else {
      await prisma.jackpotPool.create({
        data: {
          tier: jp.tier,
          amount: jp.amount,
          seedAmount: jp.seedAmount,
        },
      });
    }
  }

  console.log(`  Seeded ${jackpotPools.length} jackpot pools.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SITE CONFIGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding site configs...');

  const siteConfigs = [
    { key: 'maintenance_mode',       value: false },
    { key: 'default_language',       value: 'en' },
    { key: 'default_theme',          value: 'dark' },
    { key: 'default_odds_format',    value: 'decimal' },
    { key: 'min_bet_amount',         value: 0.01 },
    { key: 'max_bet_amount',         value: 100000 },
    { key: 'parlay_max_legs',        value: 15 },
    { key: 'cash_out_enabled',       value: true },
    { key: 'live_betting_enabled',   value: true },
    { key: 'welcome_bonus_enabled',  value: true },
    { key: 'kyc_required_withdrawal', value: 2200 },
    { key: 'default_odds_margin',    value: 5 },
    { key: 'max_payout_per_bet',     value: 50000 },
    { key: 'live_bet_delay_seconds', value: 5 },
    { key: 'cashout_margin_percent', value: 5 },
    { key: 'supported_languages',    value: ['en', 'es', 'pt', 'de', 'fr', 'it', 'ja', 'ko', 'zh', 'ru', 'tr', 'ar', 'hi', 'th', 'vi', 'pl', 'nl', 'sv', 'fi'] },
    {
      key: 'terms_of_service',
      value: 'By accessing and using CryptoBet, you agree to be bound by these Terms of Service. You must be at least 18 years of age or the legal gambling age in your jurisdiction, whichever is greater. CryptoBet provides an online cryptocurrency betting platform including sportsbook and casino services. All deposits and withdrawals are processed in cryptocurrency. Users are responsible for ensuring online gambling is legal in their jurisdiction. CryptoBet reserves the right to void bets placed in error, limit accounts, or close accounts suspected of fraud or abuse. All bets are final once confirmed. Promotional terms and bonus conditions apply as stated. CryptoBet promotes responsible gambling and provides tools for self-exclusion, deposit limits, and session timeouts. For any disputes, CryptoBet\'s decision is final. These terms are governed by the laws of Curacao.',
    },
    {
      key: 'privacy_policy',
      value: 'CryptoBet collects personal information necessary for account registration, identity verification (KYC), and service delivery. We collect: email, username, date of birth, IP address, device information, transaction history, and KYC documents. Your data is used for: account management, regulatory compliance, fraud prevention, customer support, and improving our services. We employ industry-standard encryption (AES-256, TLS 1.3) to protect your data. We do not sell personal data to third parties. Data may be shared with: payment processors, KYC verification services, regulatory authorities (when legally required), and analytics services. You have the right to access, correct, or delete your personal data. Blockchain transactions are public and immutable by nature. Cookies are used for session management and analytics. By using CryptoBet, you consent to this privacy policy.',
    },
    { key: 'responsible_gambling_enabled', value: true },
    { key: 'session_timeout_options',      value: [30, 60, 120, 240, 480] },
    { key: 'cooling_off_options',          value: ['24h', '7d', '30d'] },
    { key: 'self_exclusion_options',       value: ['6m', '1y', 'permanent'] },
    { key: 'reality_check_intervals',      value: [30, 60, 120] },
  ];

  for (const sc of siteConfigs) {
    await prisma.siteConfig.upsert({
      where: { key: sc.key },
      update: { value: sc.value as any },
      create: { key: sc.key, value: sc.value as any },
    });
  }

  console.log(`  Seeded ${siteConfigs.length} site configs.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. ADMIN USER
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding admin user...');

  const adminPasswordHash = await bcrypt.hash('Admin123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@cryptobet.com' },
    update: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN' as any,
      kycLevel: 'ADVANCED' as any,
      vipTier: 'BLUE_DIAMOND' as any,
      isActive: true,
      isBanned: false,
      twoFactorEnabled: false,
      preferredCurrency: 'USDT',
      preferredOddsFormat: 'DECIMAL' as any,
      theme: 'DARK' as any,
      language: 'en',
    },
    create: {
      email: 'admin@cryptobet.com',
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN' as any,
      kycLevel: 'ADVANCED' as any,
      vipTier: 'BLUE_DIAMOND' as any,
      totalWagered: 0,
      isActive: true,
      isBanned: false,
      twoFactorEnabled: false,
      preferredCurrency: 'USDT',
      preferredOddsFormat: 'DECIMAL' as any,
      theme: 'DARK' as any,
      language: 'en',
      referralCode: 'ADMIN_REF_001',
    },
  });

  console.log('  Seeded admin user (admin@cryptobet.com / Admin123!).');

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. PROMOTIONS (5)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding promotions...');

  const promoStart = new Date();
  const promoEnd90 = new Date(promoStart.getTime() + 90 * 86400_000);
  const promoEnd30 = new Date(promoStart.getTime() + 30 * 86400_000);

  const promotions = [
    {
      title: 'Welcome Deposit Bonus - 100% up to $500',
      description: 'New players receive a 100% match on their first deposit, up to $500 in bonus funds. No wagering requirements - the bonus is paid as real cash credited directly to your wallet. Make your first deposit today and double your bankroll!',
      type: 'DEPOSIT_BONUS' as any,
      code: 'WELCOME100',
      conditions: {
        minDeposit: 10,
        maxBonus: 500,
        matchPercent: 100,
        wageringRequirement: 1,
        eligibleUsers: 'new',
        maxClaimsPerUser: 1,
        validCurrencies: ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB'],
      },
      reward: { type: 'deposit_match', percent: 100, maxReward: 500, currency: 'USDT' },
      startDate: promoStart,
      endDate: promoEnd90,
      isActive: true,
      maxClaims: 10000,
    },
    {
      title: 'Weekend Free Bet - $10',
      description: 'Enjoy a free $10 bet every weekend! Place any sports bet on Saturday or Sunday and receive a $10 free bet token. Minimum odds of 1.50 required. Winnings from free bets are paid as real cash with no restrictions.',
      type: 'FREE_BET' as any,
      code: 'WEEKEND10',
      conditions: {
        minOdds: 1.5,
        validDays: ['saturday', 'sunday'],
        maxClaimsPerUser: 1,
        claimPeriod: 'weekly',
        eligibleSports: 'all',
      },
      reward: { type: 'free_bet', amount: 10, currency: 'USDT' },
      startDate: promoStart,
      endDate: promoEnd90,
      isActive: true,
      maxClaims: null,
    },
    {
      title: 'Crypto Odds Boost - 10% Extra',
      description: 'Get a 10% odds boost on any pre-match single bet when you deposit with cryptocurrency. Applies to all sports markets with original odds of 1.80 or higher. The boosted odds are reflected directly in your potential payout.',
      type: 'ODDS_BOOST' as any,
      code: 'CRYPTOBOOST',
      conditions: {
        minOdds: 1.8,
        betType: 'single',
        marketType: 'pre-match',
        depositMethod: 'crypto',
        maxClaimsPerUser: 3,
        claimPeriod: 'daily',
      },
      reward: { type: 'odds_boost', percent: 10, maxReward: 100, currency: 'USDT' },
      startDate: promoStart,
      endDate: promoEnd30,
      isActive: true,
      maxClaims: 50000,
    },
    {
      title: 'Casino Cashback - 15% Weekly',
      description: 'Receive 15% cashback on your net casino losses every week! Cashback is calculated every Monday at 00:00 UTC on the previous week\'s net losses across all casino games. Minimum $10 in losses to qualify. Cashback paid in USDT with zero wagering requirements.',
      type: 'CASHBACK' as any,
      code: 'CASHBACK15',
      conditions: {
        minLoss: 10,
        maxCashback: 5000,
        cashbackPercent: 15,
        eligibleGames: 'all_casino',
        calculationPeriod: 'weekly',
        maxClaimsPerUser: 1,
        claimPeriod: 'weekly',
      },
      reward: { type: 'cashback', percent: 15, maxReward: 5000, currency: 'USDT' },
      startDate: promoStart,
      endDate: promoEnd90,
      isActive: true,
      maxClaims: null,
    },
    {
      title: 'Referral Tournament - $10,000 Prize Pool',
      description: 'Compete for a share of the $10,000 prize pool by referring the most active players! Top 50 referrers at the end of the month share the pool. 1st place wins $2,500, 2nd $1,500, 3rd $1,000, and places 4-50 share the remaining $5,000. Referred players must deposit and wager at least $100.',
      type: 'TOURNAMENT' as any,
      code: 'REFTOURNEY',
      conditions: {
        minReferralDeposit: 20,
        minReferralWager: 100,
        prizeDistribution: {
          '1': 2500,
          '2': 1500,
          '3': 1000,
          '4-10': 300,
          '11-20': 150,
          '21-50': 50,
        },
        maxParticipants: null,
      },
      reward: { type: 'tournament', totalPrizePool: 10000, currency: 'USDT', topPlaces: 50 },
      startDate: promoStart,
      endDate: promoEnd30,
      isActive: true,
      maxClaims: 50,
    },
  ];

  for (const promo of promotions) {
    const existingPromo = promo.code
      ? await prisma.promotion.findFirst({ where: { code: promo.code } })
      : null;

    if (existingPromo) {
      await prisma.promotion.update({
        where: { id: existingPromo.id },
        data: {
          title: promo.title,
          description: promo.description,
          type: promo.type,
          conditions: promo.conditions,
          reward: promo.reward,
          startDate: promo.startDate,
          endDate: promo.endDate,
          isActive: promo.isActive,
          maxClaims: promo.maxClaims,
        },
      });
    } else {
      await prisma.promotion.create({
        data: {
          title: promo.title,
          description: promo.description,
          type: promo.type,
          code: promo.code,
          conditions: promo.conditions,
          reward: promo.reward,
          startDate: promo.startDate,
          endDate: promo.endDate,
          isActive: promo.isActive,
          maxClaims: promo.maxClaims,
        },
      });
    }
  }

  console.log(`  Seeded ${promotions.length} promotions.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. BLOG POSTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Seeding blog posts...');

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@cryptobet.com' } });
  const adminId = adminUser?.id ?? null;

  const blogPosts = [
    {
      title: 'Welcome to CryptoBet - The Future of Crypto Betting',
      slug: 'welcome-to-cryptobet',
      content: `# Welcome to CryptoBet\n\nWe are thrilled to launch CryptoBet, a next-generation crypto betting platform designed for the modern bettor.\n\n## Why CryptoBet?\n\nCryptoBet combines the excitement of sports betting and casino gaming with the speed, security, and transparency of cryptocurrency.\n\n### Key Features\n\n- **40+ Cryptocurrencies**: Deposit and withdraw in Bitcoin, Ethereum, USDT, and many more.\n- **Provably Fair Casino**: Every casino game uses HMAC-SHA256 provably fair algorithms.\n- **VIP Rewards Program**: Earn rakeback, daily bonuses, and exclusive perks as you climb through 8 VIP tiers.\n- **Live Betting**: Bet on live events with real-time odds updates.\n- **Instant Deposits**: No waiting — your crypto deposits are credited as soon as they are confirmed on-chain.\n\n## Getting Started\n\n1. Create your account in seconds.\n2. Deposit with your preferred cryptocurrency.\n3. Explore sports betting, casino games, or both!\n\nWelcome aboard, and may the odds be ever in your favor!`,
      excerpt: 'Discover CryptoBet, the next-generation crypto betting platform with 40+ cryptocurrencies, provably fair casino games, and an 8-tier VIP rewards program.',
      category: 'Announcements',
      tags: ['launch', 'crypto', 'betting', 'welcome'],
    },
    {
      title: 'Understanding Provably Fair Gaming',
      slug: 'understanding-provably-fair-gaming',
      content: `# Understanding Provably Fair Gaming\n\nAt CryptoBet, fairness is not just a promise — it is mathematically verifiable. Every casino game on our platform uses a provably fair system.\n\n## How It Works\n\nProvably fair gaming uses cryptographic hash functions to ensure that neither the player nor the house can manipulate the outcome of a game.\n\n### The Process\n\n1. **Server Seed**: Before a game round, the server generates a secret seed and shares its hash (SHA-256) with the player.\n2. **Client Seed**: The player provides (or the system generates) a client seed.\n3. **Nonce**: A counter that increments with each bet.\n4. **Result Generation**: The game result is computed as HMAC-SHA256(serverSeed, clientSeed + nonce).\n5. **Verification**: After the round, the server seed is revealed. Players can verify that the hash matches and that the result was generated fairly.\n\n## Why It Matters\n\nTraditional online casinos require you to trust that their random number generator is fair. With provably fair gaming, trust is replaced by mathematical proof.\n\n## Verify Your Bets\n\nYou can verify any bet at any time using our built-in verification tool in your game history. Click on any round and select "Verify Fairness" to see the full cryptographic proof.`,
      excerpt: 'Learn how provably fair gaming works and why it matters. Every CryptoBet casino game uses HMAC-SHA256 cryptographic proofs that you can independently verify.',
      category: 'Education',
      tags: ['provably-fair', 'casino', 'security', 'transparency'],
    },
    {
      title: 'CryptoBet VIP Program - 8 Tiers of Rewards',
      slug: 'cryptobet-vip-program',
      content: `# CryptoBet VIP Program\n\nOur VIP program is designed to reward every player, from casual bettors to high rollers. With 8 tiers of increasing rewards, there is always something to look forward to.\n\n## The Tiers\n\n| Tier | Min Wagered | Rakeback |\n|------|------------|----------|\n| Bronze | $0 | 0.5% |\n| Silver | $5,000 | 1% |\n| Gold | $25,000 | 1.5% |\n| Platinum | $100,000 | 2% |\n| Diamond | $500,000 | 2.5% |\n| Elite | $2,000,000 | 3% |\n| Black Diamond | $10,000,000 | 4% |\n| Blue Diamond | $50,000,000 | 5% |\n\n## Rakeback\n\nEvery bet you place earns rakeback based on your VIP tier. 50% is credited instantly to your wallet, and the remaining 50% is added to your rewards calendar.\n\n## Rewards Calendar\n\nClaim free rewards every 12 hours! The amounts scale with your VIP tier.\n\n## Turbo Mode\n\nActivate Turbo Mode from your rewards calendar for a 90-minute boost of up to 25% extra on all winnings.\n\n## Level-Up Bonuses\n\nEvery time you reach a new wagering milestone, you receive a one-time bonus payout. The higher the milestone, the bigger the reward.\n\nStart playing today and begin your journey to Blue Diamond!`,
      excerpt: 'Explore the CryptoBet VIP program with 8 tiers from Bronze to Blue Diamond. Earn rakeback, daily bonuses, Turbo Mode boosts, and level-up rewards.',
      category: 'Promotions',
      tags: ['vip', 'rewards', 'rakeback', 'promotions'],
    },
    {
      title: 'Top 5 Betting Strategies for Beginners',
      slug: 'top-5-betting-strategies-beginners',
      content: `# Top 5 Betting Strategies for Beginners\n\nNew to sports betting? Here are five strategies that will help you make smarter bets and manage your bankroll effectively.\n\n## 1. Bankroll Management\n\nNever bet more than 1-5% of your total bankroll on a single wager. This protects you from losing streaks and ensures you can continue betting.\n\n## 2. Understand Value Betting\n\nA value bet occurs when the probability of an outcome is higher than what the odds suggest. Look for situations where you believe the bookmaker has underestimated the likelihood of an event.\n\n## 3. Specialize in One Sport\n\nRather than spreading yourself thin across multiple sports, focus on one sport and become an expert. Deep knowledge of teams, players, and trends gives you an edge.\n\n## 4. Keep Records\n\nTrack every bet you place, including the event, odds, stake, and outcome. Analyzing your betting history helps you identify patterns and improve your strategy.\n\n## 5. Avoid Emotional Betting\n\nNever bet on your favorite team just because you want them to win. Base your bets on research and data, not emotions.\n\n## Bonus Tip: Use Promotions Wisely\n\nTake advantage of free bets, deposit bonuses, and odds boosts offered by CryptoBet. These promotions give you extra value and can offset losses.`,
      excerpt: 'New to sports betting? Learn five essential strategies including bankroll management, value betting, specialization, record-keeping, and avoiding emotional bets.',
      category: 'Education',
      tags: ['betting', 'strategy', 'beginners', 'tips'],
    },
    {
      title: 'Crypto Deposits: Fast, Secure, and Fee-Free',
      slug: 'crypto-deposits-fast-secure-fee-free',
      content: `# Crypto Deposits: Fast, Secure, and Fee-Free\n\nOne of the biggest advantages of betting with cryptocurrency is the speed and security of transactions. Here is everything you need to know about depositing on CryptoBet.\n\n## Supported Cryptocurrencies\n\nWe support 40+ cryptocurrencies including:\n\n- Bitcoin (BTC)\n- Ethereum (ETH)\n- Tether (USDT) — ERC-20, BEP-20, TRC-20, SPL\n- USD Coin (USDC)\n- Solana (SOL)\n- BNB\n- And many more!\n\n## How to Deposit\n\n1. Go to your **Wallet** page.\n2. Select the cryptocurrency you want to deposit.\n3. Choose the network (e.g., ERC-20, BEP-20, TRC-20).\n4. Copy the deposit address or scan the QR code.\n5. Send your crypto from your external wallet.\n\n## Confirmation Times\n\nDeposit confirmation times vary by network:\n\n- **Solana**: ~30 seconds\n- **TRON (TRC-20)**: ~3 minutes\n- **BSC (BEP-20)**: ~3 minutes\n- **Ethereum (ERC-20)**: ~5 minutes\n- **Bitcoin**: ~30 minutes\n\n## Zero Platform Fees\n\nCryptoBet does not charge any fees for deposits. You only pay the standard network transaction fee.\n\n## Security\n\nAll deposit addresses are unique to your account. We use industry-standard cold storage to secure your funds.`,
      excerpt: 'Learn how to deposit cryptocurrency on CryptoBet. We support 40+ coins with fast confirmation times, zero platform fees, and industry-standard security.',
      category: 'Guides',
      tags: ['crypto', 'deposits', 'wallet', 'guide'],
    },
  ];

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        category: post.category,
        tags: post.tags,
        authorId: adminId,
        isPublished: true,
        publishedAt: new Date(),
      },
      create: {
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        category: post.category,
        tags: post.tags,
        authorId: adminId,
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  console.log(`  Seeded ${blogPosts.length} blog posts.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. ACADEMY COURSES (update existing to isPublished: true)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('Fixing academy courses (setting isPublished=true)...');

  await prisma.academyCourse.updateMany({
    data: { isPublished: true },
  });

  const courseCount = await prisma.academyCourse.count();
  console.log(`  Updated ${courseCount} academy courses to isPublished=true.`);

  // ═══════════════════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('Database seeding complete!');
  console.log('Summary:');
  console.log(`  - ${currencies.length} currencies`);
  console.log(`  - ${networkDefs.length} currency networks`);
  console.log(`  - ${sports.length} sports`);
  console.log(`  - ${competitionDefs.length} competitions`);
  console.log(`  - ${eventCount} events`);
  console.log(`  - ${marketCount} markets`);
  console.log(`  - ${selectionCount} selections`);
  console.log(`  - ${vipTiers.length} VIP tier configs`);
  console.log(`  - ${casinoGameConfigs.length} casino game configs`);
  console.log(`  - ${casinoGames.length} casino games`);
  console.log(`  - ${jackpotPools.length} jackpot pools`);
  console.log(`  - ${siteConfigs.length} site configs`);
  console.log(`  - 1 admin user`);
  console.log(`  - ${promotions.length} promotions`);
  console.log(`  - ${blogPosts.length} blog posts`);
  console.log(`  - ${courseCount} academy courses (isPublished=true)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
