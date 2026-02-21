-- CreateEnum
CREATE TYPE "KycLevel" AS ENUM ('UNVERIFIED', 'BASIC', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "VipTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'ELITE', 'BLACK_DIAMOND', 'BLUE_DIAMOND');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('DARK', 'LIGHT', 'CLASSIC');

-- CreateEnum
CREATE TYPE "OddsFormat" AS ENUM ('DECIMAL', 'FRACTIONAL', 'AMERICAN');

-- CreateEnum
CREATE TYPE "CurrencyType" AS ENUM ('CRYPTO', 'FIAT', 'STABLECOIN');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET', 'WIN', 'BONUS', 'RAKEBACK', 'REWARD', 'REFERRAL', 'ADJUSTMENT', 'SWAP');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMING', 'COMPLETED', 'FAILED', 'CANCELLED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdminWalletType" AS ENUM ('HOT', 'COLD', 'MULTISIG');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'LIVE', 'ENDED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('MONEYLINE', 'SPREAD', 'TOTAL', 'PROP', 'OUTRIGHT');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'SUSPENDED', 'SETTLED', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'WON', 'LOST', 'VOID', 'PUSH');

-- CreateEnum
CREATE TYPE "SelectionResult" AS ENUM ('WIN', 'LOSE', 'VOID', 'PUSH', 'HALF_WIN', 'HALF_LOSE');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('SINGLE', 'PARLAY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'ACCEPTED', 'WON', 'LOST', 'VOID', 'CASHOUT', 'PARTIALLY_SETTLED');

-- CreateEnum
CREATE TYPE "BetLegStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID', 'PUSH', 'HALF_WIN', 'HALF_LOSE');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('SLOT', 'TABLE', 'LIVE', 'CRASH', 'DICE', 'COINFLIP', 'MINES', 'PLINKO', 'ROULETTE', 'BLACKJACK', 'HILO', 'WHEEL', 'TOWER', 'LIMBO', 'KENO', 'VIDEO_POKER', 'BACCARAT', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('BET_WON', 'BET_LOST', 'BET_SETTLED', 'DEPOSIT_CONFIRMED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED', 'VIP_LEVEL_UP', 'PROMO_AVAILABLE', 'REWARD_AVAILABLE', 'SYSTEM', 'WELCOME');

-- CreateEnum
CREATE TYPE "KycDocType" AS ENUM ('PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'PROOF_OF_ADDRESS', 'SELFIE');

-- CreateEnum
CREATE TYPE "KycDocStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('RAKEBACK', 'DAILY', 'WEEKLY', 'MONTHLY', 'LEVEL_UP', 'TURBO', 'WELCOME', 'CASH_VAULT', 'REFERRAL');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'CLAIMABLE', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('DEPOSIT_BONUS', 'FREE_BET', 'ODDS_BOOST', 'CASHBACK', 'TOURNAMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'CLOSED', 'WAITING');

-- CreateEnum
CREATE TYPE "OddsProviderType" AS ENUM ('REST', 'WEBSOCKET');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "kycLevel" "KycLevel" NOT NULL DEFAULT 'UNVERIFIED',
    "vipTier" "VipTier" NOT NULL DEFAULT 'BRONZE',
    "totalWagered" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupCodes" JSONB,
    "preferredCurrency" TEXT NOT NULL DEFAULT 'USDT',
    "preferredOddsFormat" "OddsFormat" NOT NULL DEFAULT 'DECIMAL',
    "theme" "Theme" NOT NULL DEFAULT 'DARK',
    "language" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "depositLimit" JSONB,
    "lossLimit" JSONB,
    "selfExcludedUntil" TIMESTAMP(3),
    "timeoutUntil" TIMESTAMP(3),
    "sessionTimeout" INTEGER,
    "realityCheckInterval" INTEGER,
    "coolingOffUntil" TIMESTAMP(3),
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "googleId" TEXT,
    "githubId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CurrencyType" NOT NULL,
    "decimals" INTEGER NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDepositEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isWithdrawEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minWithdrawal" DECIMAL(18,8) NOT NULL,
    "withdrawalFee" DECIMAL(18,8) NOT NULL,
    "exchangeRateUsd" DECIMAL(18,8) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_networks" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "networkName" TEXT NOT NULL,
    "networkLabel" TEXT NOT NULL,
    "contractAddress" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "estimatedTime" TEXT,
    "rpcUrl" TEXT,
    "explorerUrl" TEXT,

    CONSTRAINT "currency_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "balance" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "lockedBalance" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "bonusBalance" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "depositAddress" TEXT,
    "networkId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "fee" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "txHash" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "networkId" TEXT,
    "status" "TxStatus" NOT NULL DEFAULT 'PENDING',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "rejectedReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_wallets" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "AdminWalletType" NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "balance" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "minThreshold" DECIMAL(18,8),
    "maxThreshold" DECIMAL(18,8),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiat_on_ramp_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "secretKey" TEXT,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supportedFiats" JSONB NOT NULL,
    "supportedCryptos" JSONB NOT NULL,
    "dailyLimit" DECIMAL(18,8),
    "monthlyLimit" DECIMAL(18,8),
    "feePercent" DECIMAL(18,8),
    "config" JSONB,

    CONSTRAINT "fiat_on_ramp_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homeTeam" TEXT,
    "awayTeam" TEXT,
    "startTime" TIMESTAMPTZ NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',
    "scores" JSONB,
    "metadata" JSONB,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "streamUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "type" "MarketType" NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'FT',
    "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selections" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "odds" DECIMAL(18,8) NOT NULL,
    "probability" DECIMAL(18,8),
    "maxStake" DECIMAL(18,8),
    "handicap" DECIMAL(18,8),
    "params" TEXT,
    "status" "SelectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "result" "SelectionResult",

    CONSTRAINT "selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "type" "BetType" NOT NULL,
    "stake" DECIMAL(18,8) NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "potentialWin" DECIMAL(18,8) NOT NULL,
    "actualWin" DECIMAL(18,8),
    "cashoutAmount" DECIMAL(18,8),
    "cashoutAt" TIMESTAMPTZ,
    "odds" DECIMAL(18,8) NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMPTZ,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "isCashoutAvailable" BOOLEAN NOT NULL DEFAULT false,
    "shareCode" TEXT,
    "placedVia" TEXT NOT NULL DEFAULT 'WEB',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_legs" (
    "id" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "eventName" TEXT,
    "marketName" TEXT,
    "selectionName" TEXT,
    "oddsAtPlacement" DECIMAL(18,8) NOT NULL,
    "status" "BetLegStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "bet_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casino_games" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "GameType" NOT NULL,
    "category" TEXT,
    "rtp" DECIMAL(18,8),
    "volatility" TEXT,
    "houseEdge" DECIMAL(18,8),
    "thumbnail" TEXT,
    "description" TEXT,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemoAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isProvablyFair" BOOLEAN NOT NULL DEFAULT false,
    "launchUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "playCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "casino_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "apiUrl" TEXT,
    "apiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "game_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casino_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalBet" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "totalWin" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "serverSeed" TEXT,
    "clientSeed" TEXT,
    "nonce" INTEGER,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ,

    CONSTRAINT "casino_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provably_fair_seeds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "isRevealed" BOOLEAN NOT NULL DEFAULT false,
    "revealedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provably_fair_seeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casino_rounds" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT NOT NULL,
    "gameSlug" TEXT NOT NULL,
    "betAmount" DECIMAL(18,8) NOT NULL,
    "payout" DECIMAL(18,8) NOT NULL,
    "multiplier" DECIMAL(18,8) NOT NULL,
    "result" JSONB NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "isWin" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casino_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crash_rounds" (
    "id" TEXT NOT NULL,
    "crashPoint" DECIMAL(18,8) NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMPTZ,
    "crashedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crash_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crash_bets" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "autoCashout" DECIMAL(18,8),
    "cashoutAt" DECIMAL(18,8),
    "payout" DECIMAL(18,8),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crash_bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jackpot_pools" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "seedAmount" DECIMAL(18,8) NOT NULL,
    "lastWonAt" TIMESTAMPTZ,
    "lastWonBy" TEXT,
    "lastWonAmount" DECIMAL(18,8),
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "jackpot_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casino_game_configs" (
    "id" TEXT NOT NULL,
    "gameSlug" TEXT NOT NULL,
    "houseEdge" DECIMAL(18,8) NOT NULL,
    "minBet" DECIMAL(18,8) NOT NULL,
    "maxBet" DECIMAL(18,8) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "jackpotContribution" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "config" JSONB,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "casino_game_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_seeds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameSlug" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_seeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OddsProviderType" NOT NULL,
    "apiKey" TEXT,
    "apiUrl" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitPerMin" INTEGER,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "quotaLimit" INTEGER,
    "lastSyncAt" TIMESTAMPTZ,
    "config" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_sync_logs" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sportKey" TEXT,
    "eventsCount" INTEGER NOT NULL DEFAULT 0,
    "marketsCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_liabilities" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "selectionId" TEXT,
    "totalStake" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "potentialPayout" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "netExposure" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "market_liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_risk_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'NORMAL',
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "totalWon" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "totalLost" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "winRate" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "avgStake" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "maxStake" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "flags" JSONB,
    "lastReviewAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_risk_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedUserId" TEXT,
    "relatedBetId" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_tier_configs" (
    "id" TEXT NOT NULL,
    "tier" "VipTier" NOT NULL,
    "name" TEXT NOT NULL,
    "minWagered" DECIMAL(18,8) NOT NULL,
    "rakebackPercent" DECIMAL(18,8) NOT NULL,
    "turboBoostPercent" DECIMAL(18,8) NOT NULL,
    "turboDurationMin" INTEGER NOT NULL,
    "dailyBonusMax" DECIMAL(18,8) NOT NULL,
    "weeklyBonusMax" DECIMAL(18,8),
    "monthlyBonusMax" DECIMAL(18,8),
    "levelUpReward" DECIMAL(18,8) NOT NULL,
    "calendarSplitPercent" DECIMAL(18,8) NOT NULL,
    "maxLevelUpReward" DECIMAL(18,8),
    "sortOrder" INTEGER NOT NULL,
    "benefits" JSONB NOT NULL,

    CONSTRAINT "vip_tier_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "source" TEXT,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "claimableAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "claimedAt" TIMESTAMPTZ,
    "calendarDay" INTEGER,
    "calendarSlot" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turbo_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boostPercent" DECIMAL(18,8) NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "turbo_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welcome_packages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "totalEarned" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "maxReward" DECIMAL(18,8) NOT NULL DEFAULT 2500,
    "rakebackPercent" DECIMAL(18,8) NOT NULL DEFAULT 10,
    "dailyDropsClaimed" INTEGER NOT NULL DEFAULT 0,
    "cashVaultAmount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "cashVaultClaimed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "welcome_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "code" TEXT,
    "image" TEXT,
    "conditions" JSONB NOT NULL,
    "reward" JSONB NOT NULL,
    "startDate" TIMESTAMPTZ NOT NULL,
    "endDate" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxClaims" INTEGER,
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "amount" DECIMAL(18,8),
    "status" TEXT NOT NULL DEFAULT 'CLAIMED',
    "claimedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "bonusAmount" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "referredWagered" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "qualifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotifType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "KycDocType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "KycDocStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "permissions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMPTZ,
    "rateLimitPerSec" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "site_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_restrictions" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "geo_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "featuredImage" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "authorId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "helpfulYes" INTEGER NOT NULL DEFAULT 0,
    "helpfulNo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "thumbnail" TEXT,
    "category" TEXT,
    "difficulty" TEXT,
    "lessonCount" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "academy_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_lessons" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "videoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "duration" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "academy_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_course_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionPercent" DECIMAL(18,8) NOT NULL DEFAULT 25,
    "totalEarned" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "totalReferred" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_players" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalWagered" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ChatStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL DEFAULT 'USER',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_vipTier_idx" ON "users"("vipTier");

-- CreateIndex
CREATE INDEX "users_kycLevel_idx" ON "users"("kycLevel");

-- CreateIndex
CREATE INDEX "users_referralCode_idx" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "users_referredBy_idx" ON "users"("referredBy");

-- CreateIndex
CREATE INDEX "users_googleId_idx" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_githubId_idx" ON "users"("githubId");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_isActive_isBanned_idx" ON "users"("isActive", "isBanned");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_refreshToken_idx" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_symbol_key" ON "currencies"("symbol");

-- CreateIndex
CREATE INDEX "currencies_symbol_idx" ON "currencies"("symbol");

-- CreateIndex
CREATE INDEX "currencies_type_idx" ON "currencies"("type");

-- CreateIndex
CREATE INDEX "currencies_isActive_idx" ON "currencies"("isActive");

-- CreateIndex
CREATE INDEX "currency_networks_currencyId_idx" ON "currency_networks"("currencyId");

-- CreateIndex
CREATE INDEX "currency_networks_networkName_idx" ON "currency_networks"("networkName");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallets_currencyId_idx" ON "wallets"("currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_currencyId_key" ON "wallets"("userId", "currencyId");

-- CreateIndex
CREATE INDEX "transactions_walletId_idx" ON "transactions"("walletId");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_txHash_idx" ON "transactions"("txHash");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE INDEX "transactions_walletId_type_idx" ON "transactions"("walletId", "type");

-- CreateIndex
CREATE INDEX "transactions_walletId_status_idx" ON "transactions"("walletId", "status");

-- CreateIndex
CREATE INDEX "admin_wallets_type_idx" ON "admin_wallets"("type");

-- CreateIndex
CREATE INDEX "admin_wallets_currencySymbol_idx" ON "admin_wallets"("currencySymbol");

-- CreateIndex
CREATE INDEX "admin_wallets_isActive_idx" ON "admin_wallets"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sports_slug_key" ON "sports"("slug");

-- CreateIndex
CREATE INDEX "sports_slug_idx" ON "sports"("slug");

-- CreateIndex
CREATE INDEX "sports_isActive_idx" ON "sports"("isActive");

-- CreateIndex
CREATE INDEX "competitions_sportId_idx" ON "competitions"("sportId");

-- CreateIndex
CREATE INDEX "competitions_isActive_idx" ON "competitions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_sportId_slug_key" ON "competitions"("sportId", "slug");

-- CreateIndex
CREATE INDEX "events_competitionId_idx" ON "events"("competitionId");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_startTime_idx" ON "events"("startTime");

-- CreateIndex
CREATE INDEX "events_isLive_idx" ON "events"("isLive");

-- CreateIndex
CREATE INDEX "events_isFeatured_idx" ON "events"("isFeatured");

-- CreateIndex
CREATE INDEX "events_competitionId_status_idx" ON "events"("competitionId", "status");

-- CreateIndex
CREATE INDEX "events_startTime_status_idx" ON "events"("startTime", "status");

-- CreateIndex
CREATE INDEX "markets_eventId_idx" ON "markets"("eventId");

-- CreateIndex
CREATE INDEX "markets_type_idx" ON "markets"("type");

-- CreateIndex
CREATE INDEX "markets_status_idx" ON "markets"("status");

-- CreateIndex
CREATE INDEX "markets_marketKey_idx" ON "markets"("marketKey");

-- CreateIndex
CREATE INDEX "markets_eventId_status_idx" ON "markets"("eventId", "status");

-- CreateIndex
CREATE INDEX "selections_marketId_idx" ON "selections"("marketId");

-- CreateIndex
CREATE INDEX "selections_status_idx" ON "selections"("status");

-- CreateIndex
CREATE INDEX "selections_marketId_status_idx" ON "selections"("marketId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bets_referenceId_key" ON "bets"("referenceId");

-- CreateIndex
CREATE INDEX "bets_userId_idx" ON "bets"("userId");

-- CreateIndex
CREATE INDEX "bets_referenceId_idx" ON "bets"("referenceId");

-- CreateIndex
CREATE INDEX "bets_status_idx" ON "bets"("status");

-- CreateIndex
CREATE INDEX "bets_createdAt_idx" ON "bets"("createdAt");

-- CreateIndex
CREATE INDEX "bets_userId_status_idx" ON "bets"("userId", "status");

-- CreateIndex
CREATE INDEX "bets_userId_createdAt_idx" ON "bets"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bets_isLive_idx" ON "bets"("isLive");

-- CreateIndex
CREATE INDEX "bets_shareCode_idx" ON "bets"("shareCode");

-- CreateIndex
CREATE INDEX "bet_legs_betId_idx" ON "bet_legs"("betId");

-- CreateIndex
CREATE INDEX "bet_legs_selectionId_idx" ON "bet_legs"("selectionId");

-- CreateIndex
CREATE INDEX "bet_legs_status_idx" ON "bet_legs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "casino_games_slug_key" ON "casino_games"("slug");

-- CreateIndex
CREATE INDEX "casino_games_slug_idx" ON "casino_games"("slug");

-- CreateIndex
CREATE INDEX "casino_games_type_idx" ON "casino_games"("type");

-- CreateIndex
CREATE INDEX "casino_games_category_idx" ON "casino_games"("category");

-- CreateIndex
CREATE INDEX "casino_games_providerId_idx" ON "casino_games"("providerId");

-- CreateIndex
CREATE INDEX "casino_games_isActive_idx" ON "casino_games"("isActive");

-- CreateIndex
CREATE INDEX "casino_games_type_isActive_idx" ON "casino_games"("type", "isActive");

-- CreateIndex
CREATE INDEX "casino_games_playCount_idx" ON "casino_games"("playCount");

-- CreateIndex
CREATE UNIQUE INDEX "game_providers_name_key" ON "game_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "game_providers_slug_key" ON "game_providers"("slug");

-- CreateIndex
CREATE INDEX "game_providers_slug_idx" ON "game_providers"("slug");

-- CreateIndex
CREATE INDEX "game_providers_isActive_idx" ON "game_providers"("isActive");

-- CreateIndex
CREATE INDEX "casino_sessions_userId_idx" ON "casino_sessions"("userId");

-- CreateIndex
CREATE INDEX "casino_sessions_gameId_idx" ON "casino_sessions"("gameId");

-- CreateIndex
CREATE INDEX "casino_sessions_userId_gameId_idx" ON "casino_sessions"("userId", "gameId");

-- CreateIndex
CREATE INDEX "casino_sessions_startedAt_idx" ON "casino_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "provably_fair_seeds_userId_idx" ON "provably_fair_seeds"("userId");

-- CreateIndex
CREATE INDEX "provably_fair_seeds_serverSeedHash_idx" ON "provably_fair_seeds"("serverSeedHash");

-- CreateIndex
CREATE INDEX "casino_rounds_sessionId_idx" ON "casino_rounds"("sessionId");

-- CreateIndex
CREATE INDEX "casino_rounds_userId_idx" ON "casino_rounds"("userId");

-- CreateIndex
CREATE INDEX "casino_rounds_gameSlug_idx" ON "casino_rounds"("gameSlug");

-- CreateIndex
CREATE INDEX "casino_rounds_createdAt_idx" ON "casino_rounds"("createdAt");

-- CreateIndex
CREATE INDEX "casino_rounds_userId_gameSlug_idx" ON "casino_rounds"("userId", "gameSlug");

-- CreateIndex
CREATE INDEX "crash_rounds_status_idx" ON "crash_rounds"("status");

-- CreateIndex
CREATE INDEX "crash_rounds_createdAt_idx" ON "crash_rounds"("createdAt");

-- CreateIndex
CREATE INDEX "crash_bets_roundId_idx" ON "crash_bets"("roundId");

-- CreateIndex
CREATE INDEX "crash_bets_userId_idx" ON "crash_bets"("userId");

-- CreateIndex
CREATE INDEX "crash_bets_roundId_userId_idx" ON "crash_bets"("roundId", "userId");

-- CreateIndex
CREATE INDEX "jackpot_pools_tier_idx" ON "jackpot_pools"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "casino_game_configs_gameSlug_key" ON "casino_game_configs"("gameSlug");

-- CreateIndex
CREATE INDEX "casino_game_configs_gameSlug_idx" ON "casino_game_configs"("gameSlug");

-- CreateIndex
CREATE INDEX "casino_game_configs_isActive_idx" ON "casino_game_configs"("isActive");

-- CreateIndex
CREATE INDEX "user_seeds_userId_idx" ON "user_seeds"("userId");

-- CreateIndex
CREATE INDEX "user_seeds_userId_gameSlug_idx" ON "user_seeds"("userId", "gameSlug");

-- CreateIndex
CREATE UNIQUE INDEX "odds_providers_name_key" ON "odds_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "odds_providers_slug_key" ON "odds_providers"("slug");

-- CreateIndex
CREATE INDEX "odds_providers_slug_idx" ON "odds_providers"("slug");

-- CreateIndex
CREATE INDEX "odds_providers_isActive_idx" ON "odds_providers"("isActive");

-- CreateIndex
CREATE INDEX "odds_sync_logs_providerId_idx" ON "odds_sync_logs"("providerId");

-- CreateIndex
CREATE INDEX "odds_sync_logs_createdAt_idx" ON "odds_sync_logs"("createdAt");

-- CreateIndex
CREATE INDEX "odds_sync_logs_status_idx" ON "odds_sync_logs"("status");

-- CreateIndex
CREATE INDEX "market_liabilities_marketId_idx" ON "market_liabilities"("marketId");

-- CreateIndex
CREATE INDEX "market_liabilities_selectionId_idx" ON "market_liabilities"("selectionId");

-- CreateIndex
CREATE INDEX "market_liabilities_marketId_selectionId_idx" ON "market_liabilities"("marketId", "selectionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_risk_profiles_userId_key" ON "user_risk_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_risk_profiles_userId_idx" ON "user_risk_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_risk_profiles_riskLevel_idx" ON "user_risk_profiles"("riskLevel");

-- CreateIndex
CREATE INDEX "admin_alerts_type_idx" ON "admin_alerts"("type");

-- CreateIndex
CREATE INDEX "admin_alerts_severity_idx" ON "admin_alerts"("severity");

-- CreateIndex
CREATE INDEX "admin_alerts_isResolved_idx" ON "admin_alerts"("isResolved");

-- CreateIndex
CREATE INDEX "admin_alerts_relatedUserId_idx" ON "admin_alerts"("relatedUserId");

-- CreateIndex
CREATE INDEX "admin_alerts_relatedBetId_idx" ON "admin_alerts"("relatedBetId");

-- CreateIndex
CREATE INDEX "admin_alerts_createdAt_idx" ON "admin_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "admin_user_notes_userId_idx" ON "admin_user_notes"("userId");

-- CreateIndex
CREATE INDEX "admin_user_notes_adminId_idx" ON "admin_user_notes"("adminId");

-- CreateIndex
CREATE INDEX "admin_user_notes_createdAt_idx" ON "admin_user_notes"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vip_tier_configs_tier_key" ON "vip_tier_configs"("tier");

-- CreateIndex
CREATE INDEX "vip_tier_configs_tier_idx" ON "vip_tier_configs"("tier");

-- CreateIndex
CREATE INDEX "vip_tier_configs_sortOrder_idx" ON "vip_tier_configs"("sortOrder");

-- CreateIndex
CREATE INDEX "rewards_userId_idx" ON "rewards"("userId");

-- CreateIndex
CREATE INDEX "rewards_type_idx" ON "rewards"("type");

-- CreateIndex
CREATE INDEX "rewards_status_idx" ON "rewards"("status");

-- CreateIndex
CREATE INDEX "rewards_userId_type_idx" ON "rewards"("userId", "type");

-- CreateIndex
CREATE INDEX "rewards_userId_status_idx" ON "rewards"("userId", "status");

-- CreateIndex
CREATE INDEX "rewards_expiresAt_idx" ON "rewards"("expiresAt");

-- CreateIndex
CREATE INDEX "rewards_createdAt_idx" ON "rewards"("createdAt");

-- CreateIndex
CREATE INDEX "turbo_sessions_userId_idx" ON "turbo_sessions"("userId");

-- CreateIndex
CREATE INDEX "turbo_sessions_isActive_idx" ON "turbo_sessions"("isActive");

-- CreateIndex
CREATE INDEX "turbo_sessions_endsAt_idx" ON "turbo_sessions"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "welcome_packages_userId_key" ON "welcome_packages"("userId");

-- CreateIndex
CREATE INDEX "welcome_packages_userId_idx" ON "welcome_packages"("userId");

-- CreateIndex
CREATE INDEX "welcome_packages_isActive_idx" ON "welcome_packages"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_type_idx" ON "promotions"("type");

-- CreateIndex
CREATE INDEX "promotions_code_idx" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_isActive_idx" ON "promotions"("isActive");

-- CreateIndex
CREATE INDEX "promotions_startDate_endDate_idx" ON "promotions"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "promo_claims_userId_idx" ON "promo_claims"("userId");

-- CreateIndex
CREATE INDEX "promo_claims_promotionId_idx" ON "promo_claims"("promotionId");

-- CreateIndex
CREATE INDEX "promo_claims_userId_promotionId_idx" ON "promo_claims"("userId", "promotionId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_referredId_idx" ON "referrals"("referredId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "referrals_referrerId_status_idx" ON "referrals"("referrerId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "kyc_documents_userId_idx" ON "kyc_documents"("userId");

-- CreateIndex
CREATE INDEX "kyc_documents_type_idx" ON "kyc_documents"("type");

-- CreateIndex
CREATE INDEX "kyc_documents_status_idx" ON "kyc_documents"("status");

-- CreateIndex
CREATE INDEX "kyc_documents_userId_status_idx" ON "kyc_documents"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_adminId_idx" ON "audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_action_idx" ON "audit_logs"("userId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "site_configs_key_key" ON "site_configs"("key");

-- CreateIndex
CREATE INDEX "site_configs_key_idx" ON "site_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "geo_restrictions_countryCode_key" ON "geo_restrictions"("countryCode");

-- CreateIndex
CREATE INDEX "geo_restrictions_countryCode_idx" ON "geo_restrictions"("countryCode");

-- CreateIndex
CREATE INDEX "geo_restrictions_isBlocked_idx" ON "geo_restrictions"("isBlocked");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_authorId_idx" ON "blog_posts"("authorId");

-- CreateIndex
CREATE INDEX "blog_posts_isPublished_idx" ON "blog_posts"("isPublished");

-- CreateIndex
CREATE INDEX "blog_posts_category_idx" ON "blog_posts"("category");

-- CreateIndex
CREATE INDEX "blog_posts_publishedAt_idx" ON "blog_posts"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "help_articles_slug_key" ON "help_articles"("slug");

-- CreateIndex
CREATE INDEX "help_articles_slug_idx" ON "help_articles"("slug");

-- CreateIndex
CREATE INDEX "help_articles_category_idx" ON "help_articles"("category");

-- CreateIndex
CREATE INDEX "help_articles_isPublished_idx" ON "help_articles"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "academy_courses_slug_key" ON "academy_courses"("slug");

-- CreateIndex
CREATE INDEX "academy_courses_slug_idx" ON "academy_courses"("slug");

-- CreateIndex
CREATE INDEX "academy_courses_category_idx" ON "academy_courses"("category");

-- CreateIndex
CREATE INDEX "academy_courses_isPublished_idx" ON "academy_courses"("isPublished");

-- CreateIndex
CREATE INDEX "academy_lessons_courseId_idx" ON "academy_lessons"("courseId");

-- CreateIndex
CREATE INDEX "academy_lessons_courseId_slug_idx" ON "academy_lessons"("courseId", "slug");

-- CreateIndex
CREATE INDEX "academy_lessons_sortOrder_idx" ON "academy_lessons"("sortOrder");

-- CreateIndex
CREATE INDEX "user_course_progress_userId_idx" ON "user_course_progress"("userId");

-- CreateIndex
CREATE INDEX "user_course_progress_courseId_idx" ON "user_course_progress"("courseId");

-- CreateIndex
CREATE INDEX "user_course_progress_userId_courseId_idx" ON "user_course_progress"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "user_course_progress_userId_courseId_lessonId_key" ON "user_course_progress"("userId", "courseId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_userId_key" ON "affiliates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");

-- CreateIndex
CREATE INDEX "affiliates_userId_idx" ON "affiliates"("userId");

-- CreateIndex
CREATE INDEX "affiliates_code_idx" ON "affiliates"("code");

-- CreateIndex
CREATE INDEX "affiliates_isActive_idx" ON "affiliates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_players_userId_key" ON "affiliate_players"("userId");

-- CreateIndex
CREATE INDEX "affiliate_players_affiliateId_idx" ON "affiliate_players"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_players_userId_idx" ON "affiliate_players"("userId");

-- CreateIndex
CREATE INDEX "chat_rooms_userId_idx" ON "chat_rooms"("userId");

-- CreateIndex
CREATE INDEX "chat_rooms_status_idx" ON "chat_rooms"("status");

-- CreateIndex
CREATE INDEX "chat_rooms_assignedTo_idx" ON "chat_rooms"("assignedTo");

-- CreateIndex
CREATE INDEX "chat_rooms_createdAt_idx" ON "chat_rooms"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_roomId_idx" ON "chat_messages"("roomId");

-- CreateIndex
CREATE INDEX "chat_messages_senderId_idx" ON "chat_messages"("senderId");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "chat_messages_roomId_createdAt_idx" ON "chat_messages"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_networks" ADD CONSTRAINT "currency_networks_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selections" ADD CONSTRAINT "selections_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_betId_fkey" FOREIGN KEY ("betId") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "selections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casino_games" ADD CONSTRAINT "casino_games_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "game_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casino_sessions" ADD CONSTRAINT "casino_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casino_sessions" ADD CONSTRAINT "casino_sessions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "casino_games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provably_fair_seeds" ADD CONSTRAINT "provably_fair_seeds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casino_rounds" ADD CONSTRAINT "casino_rounds_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "casino_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casino_rounds" ADD CONSTRAINT "casino_rounds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crash_bets" ADD CONSTRAINT "crash_bets_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "crash_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crash_bets" ADD CONSTRAINT "crash_bets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_seeds" ADD CONSTRAINT "user_seeds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_sync_logs" ADD CONSTRAINT "odds_sync_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "odds_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_risk_profiles" ADD CONSTRAINT "user_risk_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_alerts" ADD CONSTRAINT "admin_alerts_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_alerts" ADD CONSTRAINT "admin_alerts_relatedBetId_fkey" FOREIGN KEY ("relatedBetId") REFERENCES "bets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_notes" ADD CONSTRAINT "admin_user_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_notes" ADD CONSTRAINT "admin_user_notes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turbo_sessions" ADD CONSTRAINT "turbo_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welcome_packages" ADD CONSTRAINT "welcome_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_claims" ADD CONSTRAINT "promo_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_claims" ADD CONSTRAINT "promo_claims_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_lessons" ADD CONSTRAINT "academy_lessons_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "academy_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_players" ADD CONSTRAINT "affiliate_players_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_players" ADD CONSTRAINT "affiliate_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
