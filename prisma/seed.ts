import { PrismaClient, Prisma, VipTier, CurrencyType, GameType, PostStatus, EventStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CryptoBet database...');

  // ─── CURRENCIES (40+ Cryptos) ───────────────────────────────────
  const currencies = [
    { symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO' as CurrencyType, decimals: 8, minWithdrawal: 0.0001, withdrawalFee: 0.00005, exchangeRateUsd: 65000, sortOrder: 1 },
    { symbol: 'ETH', name: 'Ethereum', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.001, withdrawalFee: 0.0005, exchangeRateUsd: 3500, sortOrder: 2 },
    { symbol: 'USDT', name: 'Tether', type: 'STABLECOIN' as CurrencyType, decimals: 6, minWithdrawal: 1, withdrawalFee: 1, exchangeRateUsd: 1, sortOrder: 3 },
    { symbol: 'USDC', name: 'USD Coin', type: 'STABLECOIN' as CurrencyType, decimals: 6, minWithdrawal: 1, withdrawalFee: 1, exchangeRateUsd: 1, sortOrder: 4 },
    { symbol: 'BNB', name: 'BNB', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.01, withdrawalFee: 0.0005, exchangeRateUsd: 600, sortOrder: 5 },
    { symbol: 'SOL', name: 'Solana', type: 'CRYPTO' as CurrencyType, decimals: 9, minWithdrawal: 0.01, withdrawalFee: 0.001, exchangeRateUsd: 150, sortOrder: 6 },
    { symbol: 'XRP', name: 'Ripple', type: 'CRYPTO' as CurrencyType, decimals: 6, minWithdrawal: 1, withdrawalFee: 0.1, exchangeRateUsd: 0.62, sortOrder: 7 },
    { symbol: 'ADA', name: 'Cardano', type: 'CRYPTO' as CurrencyType, decimals: 6, minWithdrawal: 1, withdrawalFee: 0.5, exchangeRateUsd: 0.65, sortOrder: 8 },
    { symbol: 'DOGE', name: 'Dogecoin', type: 'CRYPTO' as CurrencyType, decimals: 8, minWithdrawal: 5, withdrawalFee: 2, exchangeRateUsd: 0.15, sortOrder: 9 },
    { symbol: 'DOT', name: 'Polkadot', type: 'CRYPTO' as CurrencyType, decimals: 10, minWithdrawal: 0.1, withdrawalFee: 0.05, exchangeRateUsd: 8, sortOrder: 10 },
    { symbol: 'MATIC', name: 'Polygon', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 1, withdrawalFee: 0.1, exchangeRateUsd: 0.85, sortOrder: 11 },
    { symbol: 'LTC', name: 'Litecoin', type: 'CRYPTO' as CurrencyType, decimals: 8, minWithdrawal: 0.01, withdrawalFee: 0.001, exchangeRateUsd: 85, sortOrder: 12 },
    { symbol: 'BCH', name: 'Bitcoin Cash', type: 'CRYPTO' as CurrencyType, decimals: 8, minWithdrawal: 0.001, withdrawalFee: 0.0001, exchangeRateUsd: 320, sortOrder: 13 },
    { symbol: 'AVAX', name: 'Avalanche', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.01, withdrawalFee: 0.005, exchangeRateUsd: 40, sortOrder: 14 },
    { symbol: 'LINK', name: 'Chainlink', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.1, withdrawalFee: 0.05, exchangeRateUsd: 18, sortOrder: 15 },
    { symbol: 'UNI', name: 'Uniswap', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.1, withdrawalFee: 0.05, exchangeRateUsd: 12, sortOrder: 16 },
    { symbol: 'ATOM', name: 'Cosmos', type: 'CRYPTO' as CurrencyType, decimals: 6, minWithdrawal: 0.1, withdrawalFee: 0.005, exchangeRateUsd: 10, sortOrder: 17 },
    { symbol: 'FTM', name: 'Fantom', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 1, withdrawalFee: 0.1, exchangeRateUsd: 0.5, sortOrder: 18 },
    { symbol: 'NEAR', name: 'NEAR Protocol', type: 'CRYPTO' as CurrencyType, decimals: 24, minWithdrawal: 0.1, withdrawalFee: 0.01, exchangeRateUsd: 5.5, sortOrder: 19 },
    { symbol: 'APT', name: 'Aptos', type: 'CRYPTO' as CurrencyType, decimals: 8, minWithdrawal: 0.1, withdrawalFee: 0.01, exchangeRateUsd: 10, sortOrder: 20 },
    { symbol: 'DAI', name: 'Dai', type: 'STABLECOIN' as CurrencyType, decimals: 18, minWithdrawal: 1, withdrawalFee: 1, exchangeRateUsd: 1, sortOrder: 21 },
    { symbol: 'AAVE', name: 'Aave', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.01, withdrawalFee: 0.005, exchangeRateUsd: 120, sortOrder: 22 },
    { symbol: 'COMP', name: 'Compound', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.01, withdrawalFee: 0.005, exchangeRateUsd: 65, sortOrder: 23 },
    { symbol: 'SUSHI', name: 'SushiSwap', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.5, withdrawalFee: 0.1, exchangeRateUsd: 1.5, sortOrder: 24 },
    { symbol: 'YFI', name: 'yearn.finance', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.0001, withdrawalFee: 0.00005, exchangeRateUsd: 8000, sortOrder: 25 },
    { symbol: 'MKR', name: 'Maker', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 0.001, withdrawalFee: 0.0005, exchangeRateUsd: 1700, sortOrder: 26 },
    { symbol: 'SHIB', name: 'Shiba Inu', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 100000, withdrawalFee: 50000, exchangeRateUsd: 0.00001, sortOrder: 27 },
    { symbol: 'PEPE', name: 'Pepe', type: 'CRYPTO' as CurrencyType, decimals: 18, minWithdrawal: 1000000, withdrawalFee: 500000, exchangeRateUsd: 0.000001, sortOrder: 28 },
    { symbol: 'FLOKI', name: 'Floki', type: 'CRYPTO' as CurrencyType, decimals: 9, minWithdrawal: 10000, withdrawalFee: 5000, exchangeRateUsd: 0.00005, sortOrder: 29 },
    { symbol: 'TRX', name: 'TRON', type: 'CRYPTO' as CurrencyType, decimals: 6, minWithdrawal: 1, withdrawalFee: 0.1, exchangeRateUsd: 0.12, sortOrder: 30 },
    { symbol: 'XLM', name: 'Stellar', type: 'CRYPTO' as CurrencyType, decimals: 7, minWithdrawal: 1, withdrawalFee: 0.01, exchangeRateUsd: 0.12, sortOrder: 31 },
    { symbol: 'EOS', name: 'EOS', type: 'CRYPTO' as CurrencyType, decimals: 4, minWithdrawal: 0.5, withdrawalFee: 0.1, exchangeRateUsd: 0.8, sortOrder: 32 },
    { symbol: 'ALGO', name: 'Algorand', type: 'CRYPTO' as CurrencyType, decimals: 6, minWithdrawal: 1, withdrawalFee: 0.01, exchangeRateUsd: 0.2, sortOrder: 33 },
    { symbol: 'TON', name: 'Toncoin', type: 'CRYPTO' as CurrencyType, decimals: 9, minWithdrawal: 0.1, withdrawalFee: 0.01, exchangeRateUsd: 6, sortOrder: 34 },
    { symbol: 'DASH', name: 'Dash', type: 'CRYPTO' as CurrencyType, decimals: 8, minWithdrawal: 0.01, withdrawalFee: 0.001, exchangeRateUsd: 30, sortOrder: 35 },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { symbol: currency.symbol },
      update: { exchangeRateUsd: currency.exchangeRateUsd },
      create: currency,
    });
  }
  console.log(`✅ ${currencies.length} currencies seeded`);

  // ─── CURRENCY NETWORKS ──────────────────────────────────────────
  const networks = [
    { symbol: 'BTC', networkName: 'bitcoin', networkLabel: 'Bitcoin', confirmations: 3, estimatedTime: '~30 min' },
    { symbol: 'ETH', networkName: 'ethereum', networkLabel: 'ERC-20', confirmations: 12, estimatedTime: '~5 min' },
    { symbol: 'ETH', networkName: 'arbitrum', networkLabel: 'Arbitrum', confirmations: 1, estimatedTime: '~1 min' },
    { symbol: 'USDT', networkName: 'ethereum', networkLabel: 'ERC-20', confirmations: 12, estimatedTime: '~5 min', contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { symbol: 'USDT', networkName: 'bsc', networkLabel: 'BEP-20', confirmations: 15, estimatedTime: '~3 min', contractAddress: '0x55d398326f99059fF775485246999027B3197955' },
    { symbol: 'USDT', networkName: 'tron', networkLabel: 'TRC-20', confirmations: 20, estimatedTime: '~3 min', contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
    { symbol: 'USDT', networkName: 'solana', networkLabel: 'SPL', confirmations: 1, estimatedTime: '~1 min' },
    { symbol: 'USDC', networkName: 'ethereum', networkLabel: 'ERC-20', confirmations: 12, estimatedTime: '~5 min', contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { symbol: 'USDC', networkName: 'bsc', networkLabel: 'BEP-20', confirmations: 15, estimatedTime: '~3 min' },
    { symbol: 'USDC', networkName: 'solana', networkLabel: 'SPL', confirmations: 1, estimatedTime: '~1 min' },
    { symbol: 'BNB', networkName: 'bsc', networkLabel: 'BEP-20', confirmations: 15, estimatedTime: '~3 min' },
    { symbol: 'SOL', networkName: 'solana', networkLabel: 'Solana', confirmations: 1, estimatedTime: '~1 min' },
    { symbol: 'XRP', networkName: 'xrp-ledger', networkLabel: 'XRP Ledger', confirmations: 1, estimatedTime: '~5 sec' },
    { symbol: 'ADA', networkName: 'cardano', networkLabel: 'Cardano', confirmations: 15, estimatedTime: '~5 min' },
    { symbol: 'DOGE', networkName: 'dogecoin', networkLabel: 'Dogecoin', confirmations: 20, estimatedTime: '~20 min' },
    { symbol: 'DOT', networkName: 'polkadot', networkLabel: 'Polkadot', confirmations: 1, estimatedTime: '~1 min' },
    { symbol: 'MATIC', networkName: 'polygon', networkLabel: 'Polygon', confirmations: 30, estimatedTime: '~2 min' },
    { symbol: 'LTC', networkName: 'litecoin', networkLabel: 'Litecoin', confirmations: 6, estimatedTime: '~15 min' },
    { symbol: 'AVAX', networkName: 'avalanche', networkLabel: 'Avalanche C-Chain', confirmations: 1, estimatedTime: '~2 sec' },
    { symbol: 'TRX', networkName: 'tron', networkLabel: 'TRC-20', confirmations: 20, estimatedTime: '~3 min' },
    { symbol: 'TON', networkName: 'ton', networkLabel: 'TON', confirmations: 1, estimatedTime: '~5 sec' },
    { symbol: 'LINK', networkName: 'ethereum', networkLabel: 'ERC-20', confirmations: 12, estimatedTime: '~5 min' },
  ];

  for (const net of networks) {
    const currency = await prisma.currency.findUnique({ where: { symbol: net.symbol } });
    if (currency) {
      await prisma.currencyNetwork.upsert({
        where: { currencyId_networkName: { currencyId: currency.id, networkName: net.networkName } },
        update: {},
        create: {
          currencyId: currency.id,
          networkName: net.networkName,
          networkLabel: net.networkLabel,
          confirmations: net.confirmations,
          estimatedTime: net.estimatedTime,
          contractAddress: (net as any).contractAddress || null,
        },
      });
    }
  }
  console.log(`✅ ${networks.length} currency networks seeded`);

  // ─── SPORTS (35+) ───────────────────────────────────────────────
  const sports = [
    { name: 'Football', slug: 'football', icon: '⚽', sortOrder: 1 },
    { name: 'Basketball', slug: 'basketball', icon: '🏀', sortOrder: 2 },
    { name: 'Tennis', slug: 'tennis', icon: '🎾', sortOrder: 3 },
    { name: 'American Football', slug: 'american-football', icon: '🏈', sortOrder: 4 },
    { name: 'Baseball', slug: 'baseball', icon: '⚾', sortOrder: 5 },
    { name: 'Ice Hockey', slug: 'ice-hockey', icon: '🏒', sortOrder: 6 },
    { name: 'MMA', slug: 'mma', icon: '🥊', sortOrder: 7 },
    { name: 'Boxing', slug: 'boxing', icon: '🥊', sortOrder: 8 },
    { name: 'Cricket', slug: 'cricket', icon: '🏏', sortOrder: 9 },
    { name: 'Rugby Union', slug: 'rugby-union', icon: '🏉', sortOrder: 10 },
    { name: 'Rugby League', slug: 'rugby-league', icon: '🏉', sortOrder: 11 },
    { name: 'Golf', slug: 'golf', icon: '⛳', sortOrder: 12 },
    { name: 'F1', slug: 'f1', icon: '🏎️', sortOrder: 13 },
    { name: 'Cycling', slug: 'cycling', icon: '🚴', sortOrder: 14 },
    { name: 'Darts', slug: 'darts', icon: '🎯', sortOrder: 15 },
    { name: 'Snooker', slug: 'snooker', icon: '🎱', sortOrder: 16 },
    { name: 'Table Tennis', slug: 'table-tennis', icon: '🏓', sortOrder: 17 },
    { name: 'Volleyball', slug: 'volleyball', icon: '🏐', sortOrder: 18 },
    { name: 'Handball', slug: 'handball', icon: '🤾', sortOrder: 19 },
    { name: 'Futsal', slug: 'futsal', icon: '⚽', sortOrder: 20 },
    { name: 'Water Polo', slug: 'water-polo', icon: '🤽', sortOrder: 21 },
    { name: 'Badminton', slug: 'badminton', icon: '🏸', sortOrder: 22 },
    { name: 'Aussie Rules', slug: 'aussie-rules', icon: '🏉', sortOrder: 23 },
    { name: 'Horse Racing', slug: 'horse-racing', icon: '🐎', sortOrder: 24 },
    { name: 'Greyhound Racing', slug: 'greyhound-racing', icon: '🐕', sortOrder: 25 },
    { name: 'Surfing', slug: 'surfing', icon: '🏄', sortOrder: 26 },
    { name: 'Skiing', slug: 'skiing', icon: '⛷️', sortOrder: 27 },
    // Esports
    { name: 'Counter-Strike 2', slug: 'cs2', icon: '🎮', sortOrder: 28 },
    { name: 'Dota 2', slug: 'dota-2', icon: '🎮', sortOrder: 29 },
    { name: 'League of Legends', slug: 'league-of-legends', icon: '🎮', sortOrder: 30 },
    { name: 'Valorant', slug: 'valorant', icon: '🎮', sortOrder: 31 },
    { name: 'Rainbow Six', slug: 'rainbow-six', icon: '🎮', sortOrder: 32 },
    { name: 'StarCraft 2', slug: 'starcraft-2', icon: '🎮', sortOrder: 33 },
    { name: 'Call of Duty', slug: 'call-of-duty', icon: '🎮', sortOrder: 34 },
    { name: 'EA Sports FC', slug: 'ea-sports-fc', icon: '🎮', sortOrder: 35 },
    { name: 'Rocket League', slug: 'rocket-league', icon: '🎮', sortOrder: 36 },
    // Specials
    { name: 'Politics', slug: 'politics', icon: '🗳️', sortOrder: 37 },
    { name: 'Entertainment', slug: 'entertainment', icon: '🎬', sortOrder: 38 },
  ];

  for (const sport of sports) {
    await prisma.sport.upsert({
      where: { slug: sport.slug },
      update: {},
      create: sport,
    });
  }
  console.log(`✅ ${sports.length} sports seeded`);

  // ─── COMPETITIONS ───────────────────────────────────────────────
  const competitionsData = [
    { sportSlug: 'football', name: 'English Premier League', slug: 'epl', country: 'England' },
    { sportSlug: 'football', name: 'La Liga', slug: 'la-liga', country: 'Spain' },
    { sportSlug: 'football', name: 'Bundesliga', slug: 'bundesliga', country: 'Germany' },
    { sportSlug: 'football', name: 'Serie A', slug: 'serie-a', country: 'Italy' },
    { sportSlug: 'football', name: 'Ligue 1', slug: 'ligue-1', country: 'France' },
    { sportSlug: 'football', name: 'UEFA Champions League', slug: 'ucl', country: 'Europe' },
    { sportSlug: 'football', name: 'FIFA World Cup', slug: 'world-cup', country: 'International' },
    { sportSlug: 'basketball', name: 'NBA', slug: 'nba', country: 'USA' },
    { sportSlug: 'basketball', name: 'EuroLeague', slug: 'euroleague', country: 'Europe' },
    { sportSlug: 'tennis', name: 'ATP Tour', slug: 'atp', country: 'International' },
    { sportSlug: 'tennis', name: 'WTA Tour', slug: 'wta', country: 'International' },
    { sportSlug: 'tennis', name: 'Grand Slams', slug: 'grand-slams', country: 'International' },
    { sportSlug: 'american-football', name: 'NFL', slug: 'nfl', country: 'USA' },
    { sportSlug: 'american-football', name: 'NCAA Football', slug: 'ncaa-football', country: 'USA' },
    { sportSlug: 'baseball', name: 'MLB', slug: 'mlb', country: 'USA' },
    { sportSlug: 'ice-hockey', name: 'NHL', slug: 'nhl', country: 'USA/Canada' },
    { sportSlug: 'mma', name: 'UFC', slug: 'ufc', country: 'International' },
    { sportSlug: 'boxing', name: 'World Boxing', slug: 'world-boxing', country: 'International' },
    { sportSlug: 'cricket', name: 'IPL', slug: 'ipl', country: 'India' },
    { sportSlug: 'cricket', name: 'The Ashes', slug: 'the-ashes', country: 'England/Australia' },
    { sportSlug: 'f1', name: 'Formula 1 World Championship', slug: 'f1-wc', country: 'International' },
    { sportSlug: 'cs2', name: 'ESL Pro League', slug: 'esl-pro', country: 'International' },
    { sportSlug: 'cs2', name: 'BLAST Premier', slug: 'blast-premier', country: 'International' },
    { sportSlug: 'dota-2', name: 'The International', slug: 'ti', country: 'International' },
    { sportSlug: 'league-of-legends', name: 'LEC', slug: 'lec', country: 'Europe' },
    { sportSlug: 'league-of-legends', name: 'LCK', slug: 'lck', country: 'South Korea' },
    { sportSlug: 'valorant', name: 'VCT', slug: 'vct', country: 'International' },
    { sportSlug: 'politics', name: 'US Elections', slug: 'us-elections', country: 'USA' },
    { sportSlug: 'politics', name: 'UK Politics', slug: 'uk-politics', country: 'UK' },
    { sportSlug: 'entertainment', name: 'Award Shows', slug: 'award-shows', country: 'International' },
  ];

  for (const comp of competitionsData) {
    const sport = await prisma.sport.findUnique({ where: { slug: comp.sportSlug } });
    if (sport) {
      const existing = await prisma.competition.findFirst({
        where: { sportId: sport.id, slug: comp.slug },
      });
      if (!existing) {
        await prisma.competition.create({
          data: { sportId: sport.id, name: comp.name, slug: comp.slug, country: comp.country },
        });
      }
    }
  }
  console.log(`✅ ${competitionsData.length} competitions seeded`);

  // NOTE: No longer wiping all events here. Real Odds API events must be preserved.
  // If you need to reset seeded events only, run: npx tsx scripts/cleanup-fake-events.ts

  // ─── TEAM LOGOS (TheSportsDB CDN) ───────────────────────────────
  const TEAM_LOGOS: Record<string, string> = {
    // EPL
    'Manchester City': 'https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png',
    'Liverpool': 'https://r2.thesportsdb.com/images/media/team/badge/uvutpx1473460488.png',
    'Arsenal': 'https://r2.thesportsdb.com/images/media/team/badge/vrtrtp1448813175.png',
    'Chelsea': 'https://r2.thesportsdb.com/images/media/team/badge/yvwvtu1448813215.png',
    'Manchester United': 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
    'Tottenham': 'https://r2.thesportsdb.com/images/media/team/badge/5v67x51547214763.png',
    'Newcastle': 'https://r2.thesportsdb.com/images/media/team/badge/2whs381534005765.png',
    'Aston Villa': 'https://r2.thesportsdb.com/images/media/team/badge/wsyxsr1448813510.png',
    'Brighton': 'https://r2.thesportsdb.com/images/media/team/badge/if5mz21697805498.png',
    'West Ham': 'https://r2.thesportsdb.com/images/media/team/badge/eo2lex1621516552.png',
    'Wolves': 'https://r2.thesportsdb.com/images/media/team/badge/sxusps1448813543.png',
    'Crystal Palace': 'https://r2.thesportsdb.com/images/media/team/badge/vwvwqy1467462274.png',
    'Everton': 'https://r2.thesportsdb.com/images/media/team/badge/wqussp1448813356.png',
    'Nottingham Forest': 'https://r2.thesportsdb.com/images/media/team/badge/yrxrsq1448813672.png',
    'Fulham': 'https://r2.thesportsdb.com/images/media/team/badge/rsusxy1448813428.png',
    'Burnley': 'https://r2.thesportsdb.com/images/media/team/badge/rwwtqs1448813572.png',
    'Bournemouth': 'https://r2.thesportsdb.com/images/media/team/badge/y08nak1534005769.png',
    'Sheffield United': 'https://r2.thesportsdb.com/images/media/team/badge/vlwpwp1473460297.png',
    // La Liga
    'Real Madrid': 'https://r2.thesportsdb.com/images/media/team/badge/vwvwrw1473502969.png',
    'Barcelona': 'https://r2.thesportsdb.com/images/media/team/badge/qi12wz1712928180.png',
    'Atletico Madrid': 'https://r2.thesportsdb.com/images/media/team/badge/mhsh0p1637337062.png',
    'Sevilla': 'https://r2.thesportsdb.com/images/media/team/badge/ux8uxy1473462593.png',
    // Bundesliga
    'Bayern Munich': 'https://r2.thesportsdb.com/images/media/team/badge/rftyrq1534007478.png',
    'Borussia Dortmund': 'https://r2.thesportsdb.com/images/media/team/badge/uyvyqy1464505765.png',
    'RB Leipzig': 'https://r2.thesportsdb.com/images/media/team/badge/gkvnl01593599498.png',
    'Bayer Leverkusen': 'https://r2.thesportsdb.com/images/media/team/badge/gx4c5r1625175479.png',
    // Serie A
    'AC Milan': 'https://r2.thesportsdb.com/images/media/team/badge/rwqrrq1473497747.png',
    'Inter Milan': 'https://r2.thesportsdb.com/images/media/team/badge/xvssru1420884091.png',
    'Juventus': 'https://r2.thesportsdb.com/images/media/team/badge/5sse9j1685544637.png',
    'Napoli': 'https://r2.thesportsdb.com/images/media/team/badge/txwwsy1421834627.png',
    // Ligue 1
    'Paris Saint-Germain': 'https://r2.thesportsdb.com/images/media/team/badge/rwqtsx1473497879.png',
    'Marseille': 'https://r2.thesportsdb.com/images/media/team/badge/yyusrr1448813221.png',
    'PSG': 'https://r2.thesportsdb.com/images/media/team/badge/rwqtsx1473497879.png',
    // NBA
    'LA Lakers': 'https://r2.thesportsdb.com/images/media/team/badge/d8uoxw1714254511.png',
    'Boston Celtics': 'https://r2.thesportsdb.com/images/media/team/badge/xvsprt1421791515.png',
    'Golden State Warriors': 'https://r2.thesportsdb.com/images/media/team/badge/irobi61565197527.png',
    'Milwaukee Bucks': 'https://r2.thesportsdb.com/images/media/team/badge/olhug81593600068.png',
    'Brooklyn Nets': 'https://r2.thesportsdb.com/images/media/team/badge/h0dwny1600552068.png',
    'Miami Heat': 'https://r2.thesportsdb.com/images/media/team/badge/5v67x51484311904.png',
    'Phoenix Suns': 'https://r2.thesportsdb.com/images/media/team/badge/qkpkqr1504384092.png',
    'Denver Nuggets': 'https://r2.thesportsdb.com/images/media/team/badge/8o8j5k1557175794.png',
    'Dallas Mavericks': 'https://r2.thesportsdb.com/images/media/team/badge/yqptxx1421822404.png',
    'Philadelphia 76ers': 'https://r2.thesportsdb.com/images/media/team/badge/71545f1518464849.png',
    'Chicago Bulls': 'https://r2.thesportsdb.com/images/media/team/badge/jol1qp1617612055.png',
    'Toronto Raptors': 'https://r2.thesportsdb.com/images/media/team/badge/ax36vz1635079225.png',
    'Sacramento Kings': 'https://r2.thesportsdb.com/images/media/team/badge/5d3dpv1541759147.png',
    'Oklahoma City Thunder': 'https://r2.thesportsdb.com/images/media/team/badge/xqpuxr1421680420.png',
    'Cleveland Cavaliers': 'https://r2.thesportsdb.com/images/media/team/badge/a]z2le1522944801.png',
    'Minnesota Timberwolves': 'https://r2.thesportsdb.com/images/media/team/badge/5xsw1d1580139834.png',
    'New Orleans Pelicans': 'https://r2.thesportsdb.com/images/media/team/badge/f341s31523700397.png',
    'Indiana Pacers': 'https://r2.thesportsdb.com/images/media/team/badge/v6jzgm1503741821.png',
    // NHL
    'Toronto Maple Leafs': 'https://r2.thesportsdb.com/images/media/team/badge/mxig4p1570129307.png',
    'Montreal Canadiens': 'https://r2.thesportsdb.com/images/media/team/badge/stpryx1421791753.png',
    'New York Rangers': 'https://r2.thesportsdb.com/images/media/team/badge/dyohun1560523672.png',
    'Boston Bruins': 'https://r2.thesportsdb.com/images/media/team/badge/vuspuq1421791546.png',
    'Edmonton Oilers': 'https://r2.thesportsdb.com/images/media/team/badge/uxxsyw1421618428.png',
    'Colorado Avalanche': 'https://r2.thesportsdb.com/images/media/team/badge/wqutut1421173108.png',
    'Tampa Bay Lightning': 'https://r2.thesportsdb.com/images/media/team/badge/swysut1421791822.png',
    'Florida Panthers': 'https://r2.thesportsdb.com/images/media/team/badge/8qtaz91696618494.png',
    'Vegas Golden Knights': 'https://r2.thesportsdb.com/images/media/team/badge/7fd29b1512669554.png',
    'Detroit Red Wings': 'https://r2.thesportsdb.com/images/media/team/badge/1goz1r1549714513.png',
    'Pittsburgh Penguins': 'https://r2.thesportsdb.com/images/media/team/badge/dsj3on1570122390.png',
    'Carolina Hurricanes': 'https://r2.thesportsdb.com/images/media/team/badge/v07m3x1547232585.png',
    // NFL
    'Kansas City Chiefs': 'https://r2.thesportsdb.com/images/media/team/badge/936t161515051854.png',
    'San Francisco 49ers': 'https://r2.thesportsdb.com/images/media/team/badge/brtfwr1422049732.png',
    'Dallas Cowboys': 'https://r2.thesportsdb.com/images/media/team/badge/wrxspu1421639498.png',
    'Philadelphia Eagles': 'https://r2.thesportsdb.com/images/media/team/badge/yrxrsq1421164107.png',
    'Buffalo Bills': 'https://r2.thesportsdb.com/images/media/team/badge/2a0yt81587626055.png',
    'Miami Dolphins': 'https://r2.thesportsdb.com/images/media/team/badge/trtusv1421639352.png',
    // MLB
    'NY Yankees': 'https://r2.thesportsdb.com/images/media/team/badge/wqyryy1423478764.png',
    'LA Dodgers': 'https://r2.thesportsdb.com/images/media/team/badge/usxwyr1423478201.png',
    'Houston Astros': 'https://r2.thesportsdb.com/images/media/team/badge/miwigx1521893583.png',
    'Atlanta Braves': 'https://r2.thesportsdb.com/images/media/team/badge/ysyysr1423474078.png',
  };

  const logo = (team: string) => TEAM_LOGOS[team] || null;

  // ─── SAMPLE UPCOMING EVENTS ────────────────────────────────────
  const now = new Date();
  const ahead = (mins: number) => new Date(now.getTime() + mins * 60_000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch all competitions we need
  const comp = async (slug: string) => prisma.competition.findFirst({ where: { slug } });
  const [eplComp, laLigaComp, bundesligaComp, serieAComp, ligue1Comp, uclComp, nbaComp, euroLeagueComp, atpComp, wtaComp, nflComp, mlbComp, nhlComp, ufcComp, iplComp, eslComp, blastComp, tiComp, lckComp, vctComp] = await Promise.all([
    comp('epl'), comp('la-liga'), comp('bundesliga'), comp('serie-a'), comp('ligue-1'), comp('ucl'),
    comp('nba'), comp('euroleague'),
    comp('atp'), comp('wta'),
    comp('nfl'), comp('mlb'), comp('nhl'), comp('ufc'), comp('ipl'),
    comp('esl-pro'), comp('blast-premier'), comp('ti'), comp('lck'), comp('vct'),
  ]);

  // Helper to build event data
  interface SeedEvent {
    competitionId: string;
    name: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamLogo: string | null;
    awayTeamLogo: string | null;
    startTime: Date;
    status: EventStatus;
    isLive: boolean;
    isFeatured: boolean;
    homeScore?: number;
    awayScore?: number;
    metadata?: Record<string, unknown>;
  }

  // NOTE: The `live()` helper was removed. Fake LIVE events with fake scores should not be seeded.
  // Real live events come from The Odds API sync. Only UPCOMING placeholder events are seeded.

  const upcoming = (compId: string, home: string, away: string, startTime: Date, featured = false): SeedEvent => ({
    competitionId: compId, name: `${home} vs ${away}`, homeTeam: home, awayTeam: away,
    homeTeamLogo: logo(home), awayTeamLogo: logo(away),
    startTime, status: 'UPCOMING' as EventStatus, isLive: false, isFeatured: featured,
  });

  const allEvents: SeedEvent[] = [];

  // NOTE: Fake LIVE events removed. Real live data comes from The Odds API sync.

  // ── UPCOMING EVENTS (25+ across all sports) ──
  if (eplComp) {
    allEvents.push(
      upcoming(eplComp.id, 'Wolves', 'Crystal Palace', ahead(30), false),
      upcoming(eplComp.id, 'Everton', 'Nottingham Forest', ahead(120), false),
      upcoming(eplComp.id, 'Fulham', 'Burnley', tomorrow, false),
      upcoming(eplComp.id, 'Bournemouth', 'Sheffield United', tomorrow, false),
    );
  }
  if (uclComp) {
    allEvents.push(
      upcoming(uclComp.id, 'Real Madrid', 'Bayern Munich', tomorrow, true),
      upcoming(uclComp.id, 'Manchester City', 'Inter Milan', tomorrow, true),
      upcoming(uclComp.id, 'PSG', 'Borussia Dortmund', nextWeek, true),
    );
  }
  if (nbaComp) {
    allEvents.push(
      upcoming(nbaComp.id, 'Sacramento Kings', 'Oklahoma City Thunder', ahead(90), false),
      upcoming(nbaComp.id, 'Cleveland Cavaliers', 'Minnesota Timberwolves', tomorrow, false),
      upcoming(nbaComp.id, 'New Orleans Pelicans', 'Indiana Pacers', tomorrow, false),
    );
  }
  if (atpComp) {
    allEvents.push(
      upcoming(atpComp.id, 'Rafael Nadal', 'Alexander Zverev', ahead(60), false),
      upcoming(atpComp.id, 'Stefanos Tsitsipas', 'Andrey Rublev', tomorrow, false),
    );
  }
  if (nhlComp) {
    allEvents.push(
      upcoming(nhlComp.id, 'Vegas Golden Knights', 'Detroit Red Wings', ahead(45), false),
      upcoming(nhlComp.id, 'Pittsburgh Penguins', 'Carolina Hurricanes', tomorrow, false),
    );
  }
  if (nflComp) {
    allEvents.push(
      upcoming(nflComp.id, 'Kansas City Chiefs', 'San Francisco 49ers', nextWeek, true),
      upcoming(nflComp.id, 'Dallas Cowboys', 'Philadelphia Eagles', nextWeek, true),
      upcoming(nflComp.id, 'Buffalo Bills', 'Miami Dolphins', nextWeek, false),
    );
  }
  if (mlbComp) {
    allEvents.push(
      upcoming(mlbComp.id, 'NY Yankees', 'LA Dodgers', tomorrow, true),
      upcoming(mlbComp.id, 'Houston Astros', 'Atlanta Braves', tomorrow, false),
    );
  }
  if (ufcComp) {
    allEvents.push(
      upcoming(ufcComp.id, 'Islam Makhachev', 'Charles Oliveira', nextWeek, true),
      upcoming(ufcComp.id, 'Alex Pereira', 'Jamahal Hill', nextWeek, false),
    );
  }
  if (iplComp) {
    allEvents.push(
      upcoming(iplComp.id, 'Kolkata Knight Riders', 'Punjab Kings', tomorrow, false),
    );
  }
  if (eslComp) {
    allEvents.push(
      upcoming(eslComp.id, 'Cloud9', 'MOUZ', ahead(180), false),
    );
  }
  if (blastComp) {
    allEvents.push(
      upcoming(blastComp.id, 'Heroic', 'Astralis', tomorrow, false),
    );
  }

  let eventsCreated = 0;
  let eventsSkipped = 0;
  for (const ev of allEvents) {
    // Avoid duplicate seeded events on repeated seed runs
    const existing = await prisma.event.findFirst({
      where: {
        competitionId: ev.competitionId,
        name: ev.name,
        metadata: { equals: Prisma.DbNull },
      },
    });
    if (existing) {
      eventsSkipped++;
    } else {
      await prisma.event.create({ data: ev });
      eventsCreated++;
    }
  }
  console.log(`✅ ${eventsCreated} upcoming events seeded, ${eventsSkipped} already existed (no fake LIVE events)`);

  // ─── MARKETS & SELECTIONS FOR SEEDED EVENTS ────────────────────
  // Only create markets for events that have no metadata.externalId (i.e. seeded, not from Odds API).
  // We use Prisma.DbNull to match actual database NULL values in the JSON column.
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { metadata: { equals: Prisma.DbNull } },
        { metadata: { path: ['externalId'], equals: Prisma.JsonNull } },
      ],
    },
  });
  // Skip events that already have markets (from a previous seed run)
  const eventsNeedingMarkets: typeof events = [];
  for (const ev of events) {
    const marketCount = await prisma.market.count({ where: { eventId: ev.id } });
    if (marketCount === 0) {
      eventsNeedingMarkets.push(ev);
    }
  }
  for (const event of eventsNeedingMarkets) {
    // Match Winner / Moneyline
    const homeOdds = +(1.4 + Math.random() * 3).toFixed(2);
    const awayOdds = +(1.4 + Math.random() * 3).toFixed(2);
    const drawOdds = +(2.8 + Math.random() * 1.5).toFixed(2);

    const matchWinner = await prisma.market.create({
      data: {
        eventId: event.id,
        name: 'Match Winner',
        marketKey: 'match_winner',
        type: 'MONEYLINE',
        sortOrder: 1,
      },
    });

    const hasThreeWay = event.homeTeam && event.awayTeam;
    await prisma.selection.createMany({
      data: [
        { marketId: matchWinner.id, name: event.homeTeam || 'Home', outcome: 'home', odds: homeOdds, probability: 1 / homeOdds },
        ...(hasThreeWay ? [{ marketId: matchWinner.id, name: 'Draw', outcome: 'draw', odds: drawOdds, probability: 1 / drawOdds }] : []),
        { marketId: matchWinner.id, name: event.awayTeam || 'Away', outcome: 'away', odds: awayOdds, probability: 1 / awayOdds },
      ],
    });

    // Over/Under
    const overUnder = await prisma.market.create({
      data: {
        eventId: event.id,
        name: 'Over/Under 2.5',
        marketKey: 'total_goals',
        type: 'TOTAL',
        sortOrder: 2,
      },
    });

    const overOdds = +(1.65 + Math.random() * 0.5).toFixed(2);
    const underOdds = +(1.65 + Math.random() * 0.5).toFixed(2);
    await prisma.selection.createMany({
      data: [
        { marketId: overUnder.id, name: 'Over 2.5', outcome: 'over', odds: overOdds, handicap: 2.5 },
        { marketId: overUnder.id, name: 'Under 2.5', outcome: 'under', odds: underOdds, handicap: 2.5 },
      ],
    });

    // Both Teams to Score (for team sports)
    if (hasThreeWay) {
      const btts = await prisma.market.create({
        data: {
          eventId: event.id,
          name: 'Both Teams to Score',
          marketKey: 'btts',
          type: 'PROP',
          sortOrder: 3,
        },
      });

      await prisma.selection.createMany({
        data: [
          { marketId: btts.id, name: 'Yes', outcome: 'yes', odds: +(1.5 + Math.random() * 0.6).toFixed(2) },
          { marketId: btts.id, name: 'No', outcome: 'no', odds: +(1.7 + Math.random() * 0.6).toFixed(2) },
        ],
      });
    }
  }
  console.log(`✅ Markets and selections seeded for ${eventsNeedingMarkets.length} seeded events (${events.length - eventsNeedingMarkets.length} already had markets)`);

  // ─── VIP TIER CONFIGS ───────────────────────────────────────────
  const vipTiers = [
    { tier: 'BRONZE' as VipTier, name: 'Bronze', minWagered: 0, rakebackPercent: 5, turboBoostPercent: 5, turboDurationMin: 15, dailyBonusMax: 10, weeklyBonusMax: null, monthlyBonusMax: null, levelUpReward: 5, calendarSplitPercent: 60, maxLevelUpReward: 500, sortOrder: 0, benefits: { perks: ['Base rakeback', 'Daily cash rewards', 'Turbo boost', 'Level-up rewards'] } },
    { tier: 'SILVER' as VipTier, name: 'Silver', minWagered: 10000, rakebackPercent: 7, turboBoostPercent: 7, turboDurationMin: 20, dailyBonusMax: 25, weeklyBonusMax: 100, monthlyBonusMax: null, levelUpReward: 15, calendarSplitPercent: 55, maxLevelUpReward: 2000, sortOrder: 1, benefits: { perks: ['Weekly cash rewards', 'Global tournaments', 'Tier-up bonus'] } },
    { tier: 'GOLD' as VipTier, name: 'Gold', minWagered: 50000, rakebackPercent: 10, turboBoostPercent: 10, turboDurationMin: 30, dailyBonusMax: 50, weeklyBonusMax: 250, monthlyBonusMax: 500, levelUpReward: 50, calendarSplitPercent: 50, maxLevelUpReward: 10000, sortOrder: 2, benefits: { perks: ['Monthly cash rewards', 'Higher rakeback', 'Bigger level-up payouts'] } },
    { tier: 'EMERALD' as VipTier, name: 'Emerald', minWagered: 250000, rakebackPercent: 12, turboBoostPercent: 12, turboDurationMin: 45, dailyBonusMax: 100, weeklyBonusMax: 500, monthlyBonusMax: 2000, levelUpReward: 100, calendarSplitPercent: 45, maxLevelUpReward: 50000, sortOrder: 3, benefits: { perks: ['Enhanced everything', 'Exclusive promotions'] } },
    { tier: 'SAPPHIRE' as VipTier, name: 'Sapphire', minWagered: 1000000, rakebackPercent: 15, turboBoostPercent: 15, turboDurationMin: 60, dailyBonusMax: 250, weeklyBonusMax: 1000, monthlyBonusMax: 5000, levelUpReward: 500, calendarSplitPercent: 40, maxLevelUpReward: 200000, sortOrder: 4, benefits: { perks: ['Priority support', 'Higher limits'] } },
    { tier: 'RUBY' as VipTier, name: 'Ruby', minWagered: 5000000, rakebackPercent: 18, turboBoostPercent: 18, turboDurationMin: 75, dailyBonusMax: 500, weeklyBonusMax: 2500, monthlyBonusMax: 10000, levelUpReward: 1000, calendarSplitPercent: 35, maxLevelUpReward: 500000, sortOrder: 5, benefits: { perks: ['Bespoke rewards', 'Real-world experiences'] } },
    { tier: 'DIAMOND' as VipTier, name: 'Diamond', minWagered: 25000000, rakebackPercent: 22, turboBoostPercent: 22, turboDurationMin: 85, dailyBonusMax: 1000, weeklyBonusMax: 5000, monthlyBonusMax: 25000, levelUpReward: 5000, calendarSplitPercent: 30, maxLevelUpReward: 1000000, sortOrder: 6, benefits: { perks: ['24/7 VIP concierge', 'Money-cant-buy experiences'] } },
    { tier: 'BLUE_DIAMOND' as VipTier, name: 'Blue Diamond', minWagered: 100000000, rakebackPercent: 25, turboBoostPercent: 25, turboDurationMin: 90, dailyBonusMax: 5000, weeklyBonusMax: 25000, monthlyBonusMax: 100000, levelUpReward: 25000, calendarSplitPercent: 25, maxLevelUpReward: 2500000, sortOrder: 7, benefits: { perks: ['Maximum rakeback ~25%', 'Top-tier everything', 'Private terms'] } },
  ];

  for (const tier of vipTiers) {
    await prisma.vipTierConfig.upsert({
      where: { tier: tier.tier },
      update: {},
      create: tier,
    });
  }
  console.log('✅ 8 VIP tier configs seeded');

  // ─── CASINO GAME PROVIDERS ──────────────────────────────────────
  const providers = [
    { name: 'CryptoBet Originals', slug: 'cryptobet-originals', isActive: true },
    { name: 'NetEnt', slug: 'netent', isActive: true },
    { name: 'Microgaming', slug: 'microgaming', isActive: true },
    { name: 'Evolution Gaming', slug: 'evolution', isActive: true },
    { name: 'Pragmatic Play', slug: 'pragmatic-play', isActive: true },
    { name: 'Play n GO', slug: 'play-n-go', isActive: true },
    { name: 'Red Tiger', slug: 'red-tiger', isActive: true },
    { name: 'Hacksaw Gaming', slug: 'hacksaw', isActive: true },
  ];

  for (const provider of providers) {
    await prisma.gameProvider.upsert({
      where: { slug: provider.slug },
      update: {},
      create: provider,
    });
  }
  console.log(`✅ ${providers.length} game providers seeded`);

  // ─── CASINO GAMES ──────────────────────────────────────────────
  const cbProvider = await prisma.gameProvider.findUnique({ where: { slug: 'cryptobet-originals' } });
  const netent = await prisma.gameProvider.findUnique({ where: { slug: 'netent' } });
  const pragmatic = await prisma.gameProvider.findUnique({ where: { slug: 'pragmatic-play' } });
  const evolution = await prisma.gameProvider.findUnique({ where: { slug: 'evolution' } });
  const hacksaw = await prisma.gameProvider.findUnique({ where: { slug: 'hacksaw' } });
  const redTiger = await prisma.gameProvider.findUnique({ where: { slug: 'red-tiger' } });
  const playNGo = await prisma.gameProvider.findUnique({ where: { slug: 'play-n-go' } });
  const microgaming = await prisma.gameProvider.findUnique({ where: { slug: 'microgaming' } });

  const casinoGames = [
    // Built-in Provably Fair
    { name: 'Crash', slug: 'crash', type: 'CRASH' as GameType, providerId: cbProvider?.id, houseEdge: 3, isProvablyFair: true, tags: ['provably-fair', 'popular', 'multiplayer'], category: 'popular', sortOrder: 1 },
    { name: 'Dice', slug: 'dice', type: 'DICE' as GameType, providerId: cbProvider?.id, houseEdge: 1, isProvablyFair: true, tags: ['provably-fair', 'classic'], category: 'popular', sortOrder: 2 },
    { name: 'Coin Flip', slug: 'coinflip', type: 'COINFLIP' as GameType, providerId: cbProvider?.id, houseEdge: 2, isProvablyFair: true, tags: ['provably-fair', 'quick'], category: 'popular', sortOrder: 3 },
    { name: 'Mines', slug: 'mines', type: 'MINES' as GameType, providerId: cbProvider?.id, houseEdge: 2, isProvablyFair: true, tags: ['provably-fair', 'strategy'], category: 'popular', sortOrder: 4 },
    { name: 'Plinko', slug: 'plinko', type: 'PLINKO' as GameType, providerId: cbProvider?.id, houseEdge: 2, isProvablyFair: true, tags: ['provably-fair', 'fun'], category: 'popular', sortOrder: 5 },
    // Mock External Games
    { name: 'Starburst', slug: 'starburst', type: 'SLOT' as GameType, providerId: netent?.id, rtp: 96.09, volatility: 'LOW', tags: ['classic', 'popular'], category: 'slots', sortOrder: 10 },
    { name: 'Gonzo\'s Quest', slug: 'gonzos-quest', type: 'SLOT' as GameType, providerId: netent?.id, rtp: 95.97, volatility: 'MEDIUM', tags: ['adventure', 'popular'], category: 'slots', sortOrder: 11 },
    { name: 'Dead or Alive 2', slug: 'dead-or-alive-2', type: 'SLOT' as GameType, providerId: netent?.id, rtp: 96.82, volatility: 'HIGH', tags: ['western', 'high-volatility'], category: 'slots', sortOrder: 12 },
    { name: 'Gates of Olympus', slug: 'gates-of-olympus', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.50, volatility: 'HIGH', tags: ['mythology', 'popular', 'bonus-buy'], category: 'slots', sortOrder: 13 },
    { name: 'Sweet Bonanza', slug: 'sweet-bonanza', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.51, volatility: 'HIGH', tags: ['candy', 'popular', 'bonus-buy'], category: 'slots', sortOrder: 14 },
    { name: 'The Dog House Megaways', slug: 'dog-house-megaways', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.55, volatility: 'HIGH', tags: ['megaways', 'popular'], category: 'slots', sortOrder: 15 },
    { name: 'Big Bass Bonanza', slug: 'big-bass-bonanza', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.71, volatility: 'HIGH', tags: ['fishing'], category: 'slots', sortOrder: 16 },
    { name: 'Lightning Roulette', slug: 'lightning-roulette', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 97.30, tags: ['roulette', 'live', 'popular'], category: 'live', sortOrder: 20 },
    { name: 'Crazy Time', slug: 'crazy-time', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 96.08, tags: ['game-show', 'live', 'popular'], category: 'live', sortOrder: 21 },
    { name: 'Blackjack VIP', slug: 'blackjack-vip', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 99.50, tags: ['blackjack', 'live', 'vip'], category: 'live', sortOrder: 22 },
    { name: 'Baccarat', slug: 'baccarat', type: 'TABLE' as GameType, providerId: evolution?.id, rtp: 98.94, tags: ['classic', 'table'], category: 'table', sortOrder: 30 },
    { name: 'European Roulette', slug: 'european-roulette', type: 'TABLE' as GameType, providerId: netent?.id, rtp: 97.30, tags: ['roulette', 'classic'], category: 'table', sortOrder: 31 },
    { name: 'Blackjack Classic', slug: 'blackjack-classic', type: 'TABLE' as GameType, providerId: netent?.id, rtp: 99.50, tags: ['blackjack', 'classic'], category: 'table', sortOrder: 32 },
    { name: 'Video Poker', slug: 'video-poker', type: 'TABLE' as GameType, providerId: netent?.id, rtp: 99.54, tags: ['poker', 'classic'], category: 'table', sortOrder: 33 },
    { name: 'Fruit Party', slug: 'fruit-party', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.47, volatility: 'HIGH', tags: ['fruit', 'cluster'], category: 'slots', sortOrder: 17 },
    // ── More Pragmatic Play Slots ──
    { name: 'Sugar Rush', slug: 'sugar-rush', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.50, volatility: 'HIGH', tags: ['candy', 'cluster', 'popular'], category: 'slots', sortOrder: 40 },
    { name: 'Starlight Princess', slug: 'starlight-princess', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.50, volatility: 'HIGH', tags: ['anime', 'popular', 'bonus-buy'], category: 'slots', sortOrder: 41 },
    { name: 'Wolf Gold', slug: 'wolf-gold', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.01, volatility: 'MEDIUM', tags: ['wildlife', 'classic', 'jackpot'], category: 'slots', sortOrder: 42 },
    { name: 'John Hunter and the Tomb of the Scarab Queen', slug: 'tomb-of-scarab-queen', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.50, volatility: 'MEDIUM', tags: ['adventure', 'egypt'], category: 'slots', sortOrder: 43 },
    { name: 'Wild West Gold', slug: 'wild-west-gold', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.51, volatility: 'HIGH', tags: ['western', 'sticky-wilds'], category: 'slots', sortOrder: 44 },
    { name: 'Madame Destiny Megaways', slug: 'madame-destiny-megaways', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.56, volatility: 'HIGH', tags: ['megaways', 'mystical', 'bonus-buy'], category: 'slots', sortOrder: 45 },
    { name: 'Release the Kraken 2', slug: 'release-the-kraken-2', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.50, volatility: 'HIGH', tags: ['ocean', 'mythology', 'bonus-buy'], category: 'slots', sortOrder: 46 },
    { name: 'Floating Dragon', slug: 'floating-dragon', type: 'SLOT' as GameType, providerId: pragmatic?.id, rtp: 96.71, volatility: 'HIGH', tags: ['asian', 'hold-and-spin'], category: 'slots', sortOrder: 47 },
    // ── More NetEnt Slots ──
    { name: 'Book of Dead', slug: 'book-of-dead', type: 'SLOT' as GameType, providerId: netent?.id, rtp: 96.21, volatility: 'HIGH', tags: ['egypt', 'popular', 'classic'], category: 'slots', sortOrder: 50 },
    { name: 'Twin Spin', slug: 'twin-spin', type: 'SLOT' as GameType, providerId: netent?.id, rtp: 96.60, volatility: 'MEDIUM', tags: ['classic', 'retro'], category: 'slots', sortOrder: 51 },
    { name: 'Divine Fortune', slug: 'divine-fortune', type: 'SLOT' as GameType, providerId: netent?.id, rtp: 96.59, volatility: 'MEDIUM', tags: ['mythology', 'jackpot', 'popular'], category: 'slots', sortOrder: 52 },
    { name: 'Mega Fortune', slug: 'mega-fortune', type: 'SLOT' as GameType, providerId: netent?.id, rtp: 96.60, volatility: 'LOW', tags: ['luxury', 'jackpot', 'progressive'], category: 'slots', sortOrder: 53 },
    // ── Hacksaw Gaming Slots ──
    { name: 'Wanted Dead or a Wild', slug: 'wanted-dead-or-wild', type: 'SLOT' as GameType, providerId: hacksaw?.id, rtp: 96.38, volatility: 'HIGH', tags: ['western', 'popular', 'bonus-buy'], category: 'slots', sortOrder: 60 },
    { name: 'Chaos Crew', slug: 'chaos-crew', type: 'SLOT' as GameType, providerId: hacksaw?.id, rtp: 96.30, volatility: 'HIGH', tags: ['punk', 'bonus-buy', 'popular'], category: 'slots', sortOrder: 61 },
    { name: 'IteroConnect', slug: 'itero-connect', type: 'SLOT' as GameType, providerId: hacksaw?.id, rtp: 96.20, volatility: 'MEDIUM', tags: ['innovative', 'cluster'], category: 'slots', sortOrder: 62 },
    { name: 'Dueling Jokers Dream Drop', slug: 'dueling-jokers', type: 'SLOT' as GameType, providerId: hacksaw?.id, rtp: 94.23, volatility: 'HIGH', tags: ['jackpot', 'dream-drop', 'joker'], category: 'slots', sortOrder: 63 },
    // ── Red Tiger Slots ──
    { name: 'Gonzo\'s Quest Megaways', slug: 'gonzos-quest-megaways', type: 'SLOT' as GameType, providerId: redTiger?.id, rtp: 96.00, volatility: 'HIGH', tags: ['megaways', 'adventure', 'popular'], category: 'slots', sortOrder: 70 },
    { name: 'Piggy Riches Megaways', slug: 'piggy-riches-megaways', type: 'SLOT' as GameType, providerId: redTiger?.id, rtp: 94.72, volatility: 'HIGH', tags: ['megaways', 'classic'], category: 'slots', sortOrder: 71 },
    { name: 'Dragon\'s Fire', slug: 'dragons-fire', type: 'SLOT' as GameType, providerId: redTiger?.id, rtp: 96.07, volatility: 'MEDIUM', tags: ['dragon', 'multiplier'], category: 'slots', sortOrder: 72 },
    { name: 'Mystery Reels', slug: 'mystery-reels', type: 'SLOT' as GameType, providerId: redTiger?.id, rtp: 96.23, volatility: 'MEDIUM', tags: ['classic', 'mystery'], category: 'slots', sortOrder: 73 },
    // ── Play n GO Slots ──
    { name: 'Reactoonz', slug: 'reactoonz', type: 'SLOT' as GameType, providerId: playNGo?.id, rtp: 96.51, volatility: 'HIGH', tags: ['cluster', 'popular', 'aliens'], category: 'slots', sortOrder: 80 },
    { name: 'Moon Princess', slug: 'moon-princess', type: 'SLOT' as GameType, providerId: playNGo?.id, rtp: 96.50, volatility: 'HIGH', tags: ['anime', 'popular', 'grid'], category: 'slots', sortOrder: 81 },
    { name: 'Rise of Olympus', slug: 'rise-of-olympus', type: 'SLOT' as GameType, providerId: playNGo?.id, rtp: 96.50, volatility: 'HIGH', tags: ['mythology', 'grid', 'popular'], category: 'slots', sortOrder: 82 },
    { name: 'Legacy of Dead', slug: 'legacy-of-dead', type: 'SLOT' as GameType, providerId: playNGo?.id, rtp: 96.58, volatility: 'HIGH', tags: ['egypt', 'free-spins'], category: 'slots', sortOrder: 83 },
    { name: 'Fire Joker', slug: 'fire-joker', type: 'SLOT' as GameType, providerId: playNGo?.id, rtp: 96.15, volatility: 'HIGH', tags: ['classic', 'joker', '3-reel'], category: 'slots', sortOrder: 84 },
    { name: 'Rich Wilde and the Wandering City', slug: 'wandering-city', type: 'SLOT' as GameType, providerId: playNGo?.id, rtp: 96.20, volatility: 'HIGH', tags: ['adventure', 'rich-wilde'], category: 'slots', sortOrder: 85 },
    // ── Microgaming Slots ──
    { name: 'Mega Moolah', slug: 'mega-moolah', type: 'SLOT' as GameType, providerId: microgaming?.id, rtp: 88.12, volatility: 'LOW', tags: ['jackpot', 'progressive', 'legendary'], category: 'slots', sortOrder: 90 },
    { name: 'Immortal Romance', slug: 'immortal-romance', type: 'SLOT' as GameType, providerId: microgaming?.id, rtp: 96.86, volatility: 'HIGH', tags: ['vampire', 'popular', 'classic'], category: 'slots', sortOrder: 91 },
    { name: 'Thunderstruck II', slug: 'thunderstruck-2', type: 'SLOT' as GameType, providerId: microgaming?.id, rtp: 96.65, volatility: 'MEDIUM', tags: ['mythology', 'norse', 'classic'], category: 'slots', sortOrder: 92 },
    { name: 'Break da Bank Again', slug: 'break-da-bank', type: 'SLOT' as GameType, providerId: microgaming?.id, rtp: 95.43, volatility: 'MEDIUM', tags: ['classic', 'bank', 'free-spins'], category: 'slots', sortOrder: 93 },
    { name: '9 Masks of Fire', slug: '9-masks-of-fire', type: 'SLOT' as GameType, providerId: microgaming?.id, rtp: 96.24, volatility: 'MEDIUM', tags: ['african', 'fire', 'hold-and-spin'], category: 'slots', sortOrder: 94 },
    // ── More Evolution Live Games ──
    { name: 'Monopoly Live', slug: 'monopoly-live', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 96.23, tags: ['game-show', 'live', 'popular', 'monopoly'], category: 'live', sortOrder: 100 },
    { name: 'Dream Catcher', slug: 'dream-catcher', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 96.58, tags: ['game-show', 'live', 'wheel'], category: 'live', sortOrder: 101 },
    { name: 'Lightning Blackjack', slug: 'lightning-blackjack', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 99.56, tags: ['blackjack', 'live', 'lightning', 'popular'], category: 'live', sortOrder: 102 },
    { name: 'Speed Baccarat', slug: 'speed-baccarat', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 98.76, tags: ['baccarat', 'live', 'speed'], category: 'live', sortOrder: 103 },
    { name: 'Auto Roulette', slug: 'auto-roulette', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 97.30, tags: ['roulette', 'live', 'auto'], category: 'live', sortOrder: 104 },
    { name: 'Football Studio', slug: 'football-studio', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 96.27, tags: ['game-show', 'live', 'football'], category: 'live', sortOrder: 105 },
    { name: 'Mega Ball', slug: 'mega-ball', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 95.40, tags: ['game-show', 'live', 'lottery', 'popular'], category: 'live', sortOrder: 106 },
    { name: 'Cash or Crash', slug: 'cash-or-crash', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 99.59, tags: ['game-show', 'live', 'popular'], category: 'live', sortOrder: 107 },
    { name: 'Funky Time', slug: 'funky-time', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 95.62, tags: ['game-show', 'live', 'disco'], category: 'live', sortOrder: 108 },
    { name: 'XXXtreme Lightning Roulette', slug: 'xxxtreme-roulette', type: 'LIVE' as GameType, providerId: evolution?.id, rtp: 97.10, tags: ['roulette', 'live', 'lightning', 'extreme'], category: 'live', sortOrder: 109 },
    // ── More Table Games ──
    { name: 'Texas Hold\'em Bonus', slug: 'texas-holdem-bonus', type: 'TABLE' as GameType, providerId: evolution?.id, rtp: 99.47, tags: ['poker', 'texas-holdem', 'table'], category: 'table', sortOrder: 110 },
    { name: 'Caribbean Stud', slug: 'caribbean-stud', type: 'TABLE' as GameType, providerId: evolution?.id, rtp: 94.78, tags: ['poker', 'caribbean', 'table'], category: 'table', sortOrder: 111 },
    { name: 'Three Card Poker', slug: 'three-card-poker', type: 'TABLE' as GameType, providerId: evolution?.id, rtp: 96.63, tags: ['poker', 'table', 'quick'], category: 'table', sortOrder: 112 },
    { name: 'Craps', slug: 'craps', type: 'TABLE' as GameType, providerId: netent?.id, rtp: 98.60, tags: ['dice', 'classic', 'table'], category: 'table', sortOrder: 113 },
    { name: 'Red Dog', slug: 'red-dog', type: 'TABLE' as GameType, providerId: netent?.id, rtp: 97.00, tags: ['card', 'classic', 'table'], category: 'table', sortOrder: 114 },
    { name: 'Pai Gow Poker', slug: 'pai-gow-poker', type: 'TABLE' as GameType, providerId: netent?.id, rtp: 97.34, tags: ['poker', 'asian', 'table'], category: 'table', sortOrder: 115 },
  ];

  for (const game of casinoGames) {
    await prisma.casinoGame.upsert({
      where: { slug: game.slug },
      update: {},
      create: game,
    });
  }
  console.log(`✅ ${casinoGames.length} casino games seeded`);

  // ─── VIRTUAL SPORTS ─────────────────────────────────────────────
  const virtualSports = [
    { name: 'Virtual Football', slug: 'virtual-football', intervalSec: 180, markets: { types: ['match_winner', 'total_goals', 'btts', 'correct_score'] } },
    { name: 'Virtual Basketball', slug: 'virtual-basketball', intervalSec: 180, markets: { types: ['match_winner', 'total_points', 'handicap'] } },
    { name: 'Virtual Horse Racing', slug: 'virtual-horse-racing', intervalSec: 120, markets: { types: ['winner', 'place', 'each_way', 'forecast'] } },
    { name: 'Virtual Tennis', slug: 'virtual-tennis', intervalSec: 240, markets: { types: ['match_winner', 'set_betting', 'total_games'] } },
    { name: 'Virtual Greyhounds', slug: 'virtual-greyhounds', intervalSec: 120, markets: { types: ['winner', 'place', 'forecast'] } },
  ];

  for (const vs of virtualSports) {
    await prisma.virtualSport.upsert({
      where: { slug: vs.slug },
      update: {},
      create: vs,
    });
  }
  console.log('✅ 5 virtual sports seeded');

  // ─── GEO RESTRICTIONS ──────────────────────────────────────────
  const geoRestrictions = [
    { countryCode: 'US', countryName: 'United States', isBlocked: true, reason: 'Regulatory restrictions' },
    { countryCode: 'GB', countryName: 'United Kingdom', isBlocked: true, reason: 'Licensing requirements' },
    { countryCode: 'HK', countryName: 'Hong Kong', isBlocked: true, reason: 'Regulatory restrictions' },
    { countryCode: 'SG', countryName: 'Singapore', isBlocked: true, reason: 'Regulatory restrictions' },
    { countryCode: 'FR', countryName: 'France', isBlocked: true, reason: 'Licensing requirements' },
  ];

  for (const geo of geoRestrictions) {
    await prisma.geoRestriction.upsert({
      where: { countryCode: geo.countryCode },
      update: {},
      create: geo,
    });
  }
  console.log('✅ Geo restrictions seeded');

  // ─── BLOG POSTS ─────────────────────────────────────────────────
  const blogPosts = [
    { title: 'Getting Started with Crypto Betting', slug: 'getting-started-crypto-betting', content: '# Getting Started with Crypto Betting\n\nCryptocurrency betting is revolutionizing the online gambling industry...', excerpt: 'Learn the basics of cryptocurrency betting and get started today.', category: 'crypto', tags: ['beginner', 'crypto', 'guide'], authorName: 'CryptoBet Team', status: 'PUBLISHED' as PostStatus, publishedAt: new Date() },
    { title: 'Understanding Odds and Probabilities', slug: 'understanding-odds-probabilities', content: '# Understanding Odds and Probabilities\n\nOdds represent the probability of an event occurring...', excerpt: 'A comprehensive guide to understanding betting odds in all formats.', category: 'sports', tags: ['odds', 'beginner', 'sports'], authorName: 'CryptoBet Team', status: 'PUBLISHED' as PostStatus, publishedAt: new Date() },
    { title: 'Top 10 Provably Fair Games', slug: 'top-10-provably-fair-games', content: '# Top 10 Provably Fair Games\n\nProvably fair technology ensures every game outcome is verifiable...', excerpt: 'Discover the best provably fair casino games available on CryptoBet.', category: 'casino', tags: ['casino', 'provably-fair', 'games'], authorName: 'CryptoBet Team', status: 'PUBLISHED' as PostStatus, publishedAt: new Date() },
    { title: 'CS2 Betting Guide for Beginners', slug: 'cs2-betting-guide', content: '# CS2 Betting Guide\n\nCounter-Strike 2 offers exciting betting opportunities...', excerpt: 'Everything you need to know about betting on CS2 matches.', category: 'esports', tags: ['esports', 'cs2', 'guide'], authorName: 'CryptoBet Team', status: 'PUBLISHED' as PostStatus, publishedAt: new Date() },
  ];

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: post,
    });
  }
  console.log('✅ Blog posts seeded');

  // ─── HELP ARTICLES ──────────────────────────────────────────────
  const helpArticles = [
    { title: 'How to Create an Account', slug: 'how-to-create-account', content: 'Creating an account on CryptoBet is simple. Click the "Sign Up" button...', category: 'account', tags: ['registration', 'getting-started'], sortOrder: 1 },
    { title: 'How to Deposit Cryptocurrency', slug: 'how-to-deposit', content: 'To deposit cryptocurrency, navigate to Wallet > Deposit. Select your currency and network...', category: 'payments', tags: ['deposit', 'crypto', 'wallet'], sortOrder: 2 },
    { title: 'How to Withdraw', slug: 'how-to-withdraw', content: 'To withdraw, go to Wallet > Withdraw. Select your currency, enter the destination address...', category: 'payments', tags: ['withdrawal', 'payout'], sortOrder: 3 },
    { title: 'How to Place a Bet', slug: 'how-to-place-bet', content: 'Browse sports and select an event. Click on the odds to add a selection to your bet slip...', category: 'betting', tags: ['betting', 'sportsbook'], sortOrder: 4 },
    { title: 'Understanding KYC Verification', slug: 'kyc-verification', content: 'KYC (Know Your Customer) verification is required for higher withdrawal limits...', category: 'account', tags: ['kyc', 'verification', 'security'], sortOrder: 5 },
    { title: 'Two-Factor Authentication', slug: 'two-factor-auth', content: 'Enable 2FA for enhanced account security. Go to Account > Security > Enable 2FA...', category: 'security', tags: ['2fa', 'security', 'totp'], sortOrder: 6 },
    { title: 'Responsible Gambling', slug: 'responsible-gambling', content: 'We are committed to responsible gambling. You can set deposit limits, loss limits...', category: 'responsible-gambling', tags: ['responsible', 'limits', 'self-exclusion'], sortOrder: 7 },
    { title: 'VIP Rewards Program', slug: 'vip-rewards', content: 'Our 8-tier VIP program rewards your loyalty with rakeback, bonuses, and exclusive perks...', category: 'bonuses', tags: ['vip', 'rewards', 'rakeback'], sortOrder: 8 },
    { title: 'Provably Fair Games', slug: 'provably-fair', content: 'All our in-house games use a provably fair system. Before each round, a server seed hash is shown...', category: 'fairness', tags: ['provably-fair', 'verification', 'casino'], sortOrder: 9 },
    { title: 'Cash Out Your Bets', slug: 'cash-out', content: 'Cash out allows you to settle your bet early. When available, you will see a cash-out amount...', category: 'betting', tags: ['cash-out', 'betting'], sortOrder: 10 },
  ];

  for (const article of helpArticles) {
    await prisma.helpArticle.upsert({
      where: { slug: article.slug },
      update: {},
      create: article,
    });
  }
  console.log('✅ Help articles seeded');

  // ─── ACADEMY COURSES ────────────────────────────────────────────
  const courses = [
    {
      title: 'Crypto Betting Basics', slug: 'crypto-betting-basics', description: 'Learn the fundamentals of cryptocurrency and how to use it for betting.', category: 'crypto-basics', sortOrder: 1,
      lessons: [
        { title: 'What is Cryptocurrency?', slug: 'what-is-crypto', content: '# What is Cryptocurrency?\n\nCryptocurrency is a digital or virtual form of currency...', sortOrder: 1 },
        { title: 'Setting Up a Wallet', slug: 'setting-up-wallet', content: '# Setting Up a Wallet\n\nTo start betting with crypto, you need a wallet...', sortOrder: 2 },
        { title: 'Making Your First Deposit', slug: 'first-deposit', content: '# Making Your First Deposit\n\nOnce your wallet is set up, making a deposit is simple...', sortOrder: 3, quizQuestions: [{ question: 'What do you need to make a crypto deposit?', options: ['Credit card', 'Wallet address', 'Phone number'], correctAnswer: 1 }] },
      ],
    },
    {
      title: 'Sports Betting Fundamentals', slug: 'sports-betting-fundamentals', description: 'Master the basics of sports betting, odds, and market types.', category: 'sports-betting', sortOrder: 2,
      lessons: [
        { title: 'Understanding Decimal Odds', slug: 'decimal-odds', content: '# Understanding Decimal Odds\n\nDecimal odds represent the total payout per unit staked...', sortOrder: 1 },
        { title: 'Bet Types Explained', slug: 'bet-types', content: '# Bet Types\n\n## Singles\nA single bet on one selection.\n\n## Parlays\nMultiple selections combined...', sortOrder: 2 },
        { title: 'Bankroll Management', slug: 'bankroll-management', content: '# Bankroll Management\n\nProper bankroll management is key to long-term success...', sortOrder: 3 },
      ],
    },
    {
      title: 'Advanced Betting Strategies', slug: 'advanced-strategies', description: 'Dive into advanced topics like value betting and Kelly Criterion.', category: 'advanced', sortOrder: 3,
      lessons: [
        { title: 'Value Betting', slug: 'value-betting', content: '# Value Betting\n\nA value bet occurs when the odds offered are higher than the true probability...', sortOrder: 1 },
        { title: 'Kelly Criterion', slug: 'kelly-criterion', content: '# Kelly Criterion\n\nThe Kelly Criterion is a formula for determining optimal bet size...', sortOrder: 2 },
      ],
    },
    {
      title: 'Responsible Gambling', slug: 'responsible-gambling-course', description: 'Learn how to gamble responsibly and recognize problem gambling signs.', category: 'responsible-gambling', sortOrder: 4,
      lessons: [
        { title: 'Setting Limits', slug: 'setting-limits', content: '# Setting Limits\n\nAlways set deposit, loss, and time limits before you start...', sortOrder: 1 },
        { title: 'Recognizing Problem Gambling', slug: 'problem-gambling', content: '# Recognizing Problem Gambling\n\nProblem gambling can affect anyone...', sortOrder: 2 },
      ],
    },
  ];

  for (const course of courses) {
    const { lessons, ...courseData } = course;
    const createdCourse = await prisma.academyCourse.upsert({
      where: { slug: courseData.slug },
      update: {},
      create: courseData,
    });

    for (const lesson of lessons) {
      const existing = await prisma.academyLesson.findFirst({
        where: { courseId: createdCourse.id, slug: lesson.slug },
      });
      if (!existing) {
        await prisma.academyLesson.create({
          data: { ...lesson, courseId: createdCourse.id },
        });
      }
    }
  }
  console.log('✅ Academy courses and lessons seeded');

  // ─── SITE CONFIGS ──────────────────────────────────────────────
  const siteConfigs = [
    { key: 'maintenance_mode', value: { enabled: false, message: 'We are performing maintenance. Please check back soon.' } },
    { key: 'default_language', value: { language: 'en' } },
    { key: 'supported_languages', value: { languages: ['en', 'es', 'de', 'it', 'fr', 'sv', 'nl', 'el', 'hu', 'tr', 'id', 'pl', 'pt', 'pt-BR', 'ru', 'ko', 'ja', 'th', 'vi'] } },
    { key: 'default_theme', value: { theme: 'DARK' } },
    { key: 'bet_limits', value: { minStake: 0.1, maxStake: 100000, maxParlayLegs: 15 } },
    { key: 'odds_margins', value: { default: 5, football: 4, basketball: 4.5, tennis: 5, esports: 5.5 } },
    { key: 'live_bet_delay', value: { default: 5, football: 5, basketball: 3, tennis: 3, esports: 2 } },
    { key: 'withdrawal_approval_threshold', value: { amount: 10000, currency: 'USD' } },
    { key: 'responsible_gambling', value: { cooloffPeriods: ['24h', '1w', '1m'], exclusionPeriods: ['6m', '1y', 'permanent'], realityCheckIntervalMin: 60 } },
  ];

  for (const config of siteConfigs) {
    await prisma.siteConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }
  console.log('✅ Site configs seeded');

  // ─── ADMIN WALLETS ──────────────────────────────────────────────
  const adminWallets = [
    { label: 'Hot Wallet - BTC', type: 'HOT' as const, currencySymbol: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', network: 'bitcoin', balance: 10, minThreshold: 1, maxThreshold: 50 },
    { label: 'Hot Wallet - ETH', type: 'HOT' as const, currencySymbol: 'ETH', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E6e0', network: 'ethereum', balance: 100, minThreshold: 10, maxThreshold: 500 },
    { label: 'Hot Wallet - USDT', type: 'HOT' as const, currencySymbol: 'USDT', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E6e1', network: 'ethereum', balance: 500000, minThreshold: 50000, maxThreshold: 2000000 },
    { label: 'Cold Storage - BTC', type: 'COLD' as const, currencySymbol: 'BTC', address: 'bc1qcoldstorageaddress1234567890abcdef', network: 'bitcoin', balance: 100 },
    { label: 'Cold Storage - ETH', type: 'COLD' as const, currencySymbol: 'ETH', address: '0xColdStorage1234567890abcdef1234567890abcd', network: 'ethereum', balance: 1000 },
  ];

  for (const wallet of adminWallets) {
    await prisma.adminWallet.create({ data: wallet });
  }
  console.log('✅ Admin wallets seeded');

  // ─── FIAT ON-RAMP PROVIDERS ─────────────────────────────────────
  await prisma.fiatOnRampProvider.upsert({
    where: { name: 'MoonPay' },
    update: {},
    create: {
      name: 'MoonPay',
      apiKey: 'pk_test_moonpay_key',
      secretKey: 'sk_test_moonpay_secret',
      webhookSecret: 'wh_test_moonpay',
      supportedFiats: ['USD', 'EUR', 'GBP', 'AUD', 'CAD'],
      supportedCryptos: ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB'],
      dailyLimit: 5000,
      monthlyLimit: 20000,
      feePercent: 3.5,
      config: { widgetUrl: 'https://buy.moonpay.com' },
    },
  });

  await prisma.fiatOnRampProvider.upsert({
    where: { name: 'Swapped' },
    update: {},
    create: {
      name: 'Swapped',
      apiKey: 'pk_test_swapped_key',
      supportedFiats: ['USD', 'EUR', 'BRL', 'INR', 'PHP'],
      supportedCryptos: ['BTC', 'ETH', 'USDT', 'USDC'],
      dailyLimit: 10000,
      monthlyLimit: 50000,
      feePercent: 2.5,
      config: { methods: ['AstroPay', 'Skrill', 'Neteller', 'PIX', 'UPI', 'GCash', 'Paysafecard'] },
    },
  });
  console.log('✅ Fiat on-ramp providers seeded');

  // ─── DEFAULT ADMIN USER ─────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Book$$145', 12);
  await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: { passwordHash: adminPassword },
    create: {
      email: 'admin@admin.com',
      username: 'admin',
      passwordHash: adminPassword,
      role: 'SUPER_ADMIN',
      kycLevel: 'FULL',
      vipTier: 'BLUE_DIAMOND',
    },
  });
  console.log('✅ Admin user seeded (admin@admin.com)');

  // ─── SAMPLE PROMOTIONS ──────────────────────────────────────────
  await prisma.promotion.upsert({
    where: { code: 'WELCOME100' },
    update: {},
    create: {
      title: 'Welcome Bonus - 100% Match',
      description: 'Get 100% match on your first deposit up to $500!',
      type: 'DEPOSIT_BONUS',
      code: 'WELCOME100',
      conditions: { minDeposit: 10, maxDeposit: 500, firstDepositOnly: true },
      reward: { type: 'percentage', percent: 100, maxReward: 500 },
      startDate: new Date(),
      endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      maxClaims: 10000,
    },
  });

  await prisma.promotion.upsert({
    where: { code: 'FREEBET10' },
    update: {},
    create: {
      title: 'Free $10 Bet',
      description: 'Get a free $10 bet on any sport!',
      type: 'FREE_BET',
      code: 'FREEBET10',
      conditions: { minOdds: 1.5 },
      reward: { type: 'fixed', amount: 10 },
      startDate: new Date(),
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      maxClaims: 1000,
    },
  });
  console.log('✅ Sample promotions seeded');

  console.log('\n🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
