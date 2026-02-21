import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { ProvablyFairService } from '../../services/casino/ProvablyFairService.js';
import { gameRegistry } from '../../services/casino/GameRegistry.js';
import { GameError } from '../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameCatalogEntry {
  id: string;
  name: string;
  slug: string;
  type: string;
  category: string | null;
  rtp: number | null;
  houseEdge: number | null;
  thumbnail: string | null;
  description: string | null;
  tags: string[];
  isProvablyFair: boolean;
  isDemoAvailable: boolean;
  playCount: number;
  minBet: number;
  maxBet: number;
}

export interface GameDetail extends GameCatalogEntry {
  provider: { name: string; slug: string; logo: string | null } | null;
  rules: unknown;
  config: unknown;
}

export interface PlayResult {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: unknown;
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

export interface UserSeedInfo {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: Date;
}

export interface SeedRotationResult {
  previous: {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  } | null;
  current: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

export interface VerifyResult {
  hash: string;
  result: unknown;
  valid: boolean;
}

export interface GameHistoryEntry {
  id: string;
  gameSlug: string;
  betAmount: number;
  payout: number;
  multiplier: number;
  result: unknown;
  isWin: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_GAMES = 60; // 1 minute
const CACHE_KEY_GAMES = 'casino:games_catalog';

// ---------------------------------------------------------------------------
// Service singleton
// ---------------------------------------------------------------------------

const fairService = new ProvablyFairService();

// ---------------------------------------------------------------------------
// Game catalog
// ---------------------------------------------------------------------------

/**
 * Get all active casino games, optionally filtered by type/category/search.
 * Results are cached in Redis for performance.
 */
export async function getGames(filters?: {
  type?: string;
  category?: string;
  search?: string;
}): Promise<GameCatalogEntry[]> {
  const { type, category, search } = filters ?? {};

  // Build cache key based on filters
  const cacheKey = `${CACHE_KEY_GAMES}:${type ?? 'all'}:${category ?? 'all'}:${search ?? ''}`;

  // Try cache first (skip if search is active since search terms are too varied)
  if (!search) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const where: Prisma.CasinoGameWhereInput = { isActive: true };

  if (type) {
    where.type = type.toUpperCase();
  }
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { tags: { has: search.toLowerCase() } },
    ];
  }

  const games = await prisma.casinoGame.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { playCount: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      category: true,
      rtp: true,
      houseEdge: true,
      thumbnail: true,
      description: true,
      tags: true,
      isProvablyFair: true,
      isDemoAvailable: true,
      playCount: true,
    },
  });

  // Merge with in-memory game data from registry
  const registryData = gameRegistry.getCatalog();
  const registryMap = new Map(registryData.map((g) => [g.slug, g]));

  const result: GameCatalogEntry[] = games.map((g) => {
    const regData = registryMap.get(g.slug);
    return {
      ...g,
      rtp: g.rtp?.toNumber() ?? null,
      houseEdge: regData?.houseEdge ?? g.houseEdge?.toNumber() ?? null,
      minBet: regData?.minBet ?? 0.01,
      maxBet: regData?.maxBet ?? 10000,
    };
  });

  // Cache if not a search query
  if (!search) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_GAMES);
  }

  return result;
}

/**
 * Get a single game by its slug with full details.
 */
export async function getGameBySlug(slug: string): Promise<GameDetail | null> {
  const game = await prisma.casinoGame.findUnique({
    where: { slug },
    include: {
      provider: {
        select: { name: true, slug: true, logo: true },
      },
    },
  });

  if (!game || !game.isActive) {
    return null;
  }

  const regData = gameRegistry.get(slug);

  // Fetch game-specific config if available
  let config: unknown = null;
  try {
    const gameConfig = await prisma.casinoGameConfig.findUnique({
      where: { gameSlug: slug },
    });
    if (gameConfig) {
      config = {
        minBet: gameConfig.minBet.toNumber(),
        maxBet: gameConfig.maxBet.toNumber(),
        houseEdge: gameConfig.houseEdge.toNumber(),
        jackpotContribution: gameConfig.jackpotContribution.toNumber(),
        isEnabled: gameConfig.isEnabled,
      };
    }
  } catch {
    // Config table may not have an entry for this game
  }

  return {
    id: game.id,
    name: game.name,
    slug: game.slug,
    type: game.type,
    category: game.category,
    rtp: game.rtp?.toNumber() ?? null,
    houseEdge: regData?.houseEdge ?? game.houseEdge?.toNumber() ?? null,
    thumbnail: game.thumbnail,
    description: game.description,
    tags: game.tags,
    isProvablyFair: game.isProvablyFair,
    isDemoAvailable: game.isDemoAvailable,
    playCount: game.playCount,
    minBet: regData?.minBet ?? 0.01,
    maxBet: regData?.maxBet ?? 10000,
    provider: game.provider,
    rules: game.rules ?? null,
    config,
  };
}

// ---------------------------------------------------------------------------
// Play (generic for instant games)
// ---------------------------------------------------------------------------

/**
 * Play a round of an instant game.
 * Stateful games (crash, mines, blackjack, hilo, tower, video-poker)
 * should use their dedicated endpoints instead.
 */
export async function play(
  userId: string,
  gameSlug: string,
  betAmount: number,
  currency: string,
  clientSeed?: string,
  options?: Record<string, unknown>,
): Promise<PlayResult> {
  const game = gameRegistry.get(gameSlug);
  if (!game) {
    throw new GameError('GAME_NOT_FOUND', `Game "${gameSlug}" not found.`);
  }

  // Check if game is stateful
  const statefulGames = ['crash', 'mines', 'blackjack', 'hilo', 'tower', 'video-poker'];
  if (statefulGames.includes(gameSlug)) {
    throw new GameError(
      'USE_SPECIFIC_ENDPOINT',
      `"${gameSlug}" is a stateful game. Use the game-specific endpoints instead.`,
    );
  }

  // Check if game is enabled in config
  try {
    const gameConfig = await prisma.casinoGameConfig.findUnique({
      where: { gameSlug },
      select: { isEnabled: true },
    });
    if (gameConfig && !gameConfig.isEnabled) {
      throw new GameError('GAME_DISABLED', `Game "${gameSlug}" is currently disabled.`);
    }
  } catch (err) {
    if (err instanceof GameError) throw err;
    // Config may not exist, which is fine
  }

  // If user provided a custom client seed, update it
  if (clientSeed) {
    const seed = await prisma.provablyFairSeed.findFirst({
      where: { userId, isRevealed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (seed) {
      await prisma.provablyFairSeed.update({
        where: { id: seed.id },
        data: { clientSeed },
      });
    }
  }

  // Delegate to the game's play method
  const result = await game.play(userId, {
    amount: betAmount,
    currency,
    options,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Game history
// ---------------------------------------------------------------------------

/**
 * Get a user's casino round history with pagination.
 */
export async function getHistory(
  userId: string,
  filters: { page: number; limit: number; game?: string },
): Promise<{
  rounds: GameHistoryEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { page, limit, game } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.CasinoRoundWhereInput = { userId };
  if (game) {
    where.gameSlug = game;
  }

  const [rounds, total] = await Promise.all([
    prisma.casinoRound.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        gameSlug: true,
        betAmount: true,
        payout: true,
        multiplier: true,
        result: true,
        isWin: true,
        serverSeedHash: true,
        clientSeed: true,
        nonce: true,
        createdAt: true,
      },
    }),
    prisma.casinoRound.count({ where }),
  ]);

  return {
    rounds: rounds.map((r) => ({
      id: r.id,
      gameSlug: r.gameSlug,
      betAmount: r.betAmount.toNumber(),
      payout: r.payout.toNumber(),
      multiplier: r.multiplier.toNumber(),
      result: r.result,
      isWin: r.isWin,
      serverSeedHash: r.serverSeedHash,
      clientSeed: r.clientSeed,
      nonce: r.nonce,
      createdAt: r.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// Provably fair seeds
// ---------------------------------------------------------------------------

/**
 * Get the active seed pair for a user (hash only, seed is secret).
 */
export async function getUserSeeds(userId: string): Promise<UserSeedInfo> {
  let seed = await prisma.provablyFairSeed.findFirst({
    where: { userId, isRevealed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!seed) {
    const { seed: serverSeed, hash } = fairService.generateServerSeed();
    seed = await prisma.provablyFairSeed.create({
      data: {
        userId,
        serverSeed,
        serverSeedHash: hash,
        clientSeed: crypto.randomBytes(16).toString('hex'),
        nonce: 0,
      },
    });
  }

  return {
    serverSeedHash: seed.serverSeedHash,
    clientSeed: seed.clientSeed,
    nonce: seed.nonce,
    createdAt: seed.createdAt,
  };
}

/**
 * Rotate the server seed. Reveals the current seed and creates a new one.
 */
export async function rotateSeed(userId: string): Promise<SeedRotationResult> {
  // Reveal current seed
  const currentSeed = await prisma.provablyFairSeed.findFirst({
    where: { userId, isRevealed: false },
    orderBy: { createdAt: 'desc' },
  });

  let revealedSeed: {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  } | null = null;

  if (currentSeed) {
    const updated = await prisma.provablyFairSeed.update({
      where: { id: currentSeed.id },
      data: { isRevealed: true, revealedAt: new Date() },
    });
    revealedSeed = {
      serverSeed: updated.serverSeed,
      serverSeedHash: updated.serverSeedHash,
      clientSeed: updated.clientSeed,
      nonce: updated.nonce,
    };
  }

  // Create new seed
  const { seed: serverSeed, hash } = fairService.generateServerSeed();
  const newSeed = await prisma.provablyFairSeed.create({
    data: {
      userId,
      serverSeed,
      serverSeedHash: hash,
      clientSeed: currentSeed?.clientSeed ?? crypto.randomBytes(16).toString('hex'),
      nonce: 0,
    },
  });

  return {
    previous: revealedSeed,
    current: {
      serverSeedHash: newSeed.serverSeedHash,
      clientSeed: newSeed.clientSeed,
      nonce: newSeed.nonce,
    },
  };
}

/**
 * Update the client seed for the active seed pair.
 */
export async function setClientSeed(
  userId: string,
  clientSeed: string,
): Promise<{ clientSeed: string; serverSeedHash: string }> {
  const seed = await prisma.provablyFairSeed.findFirst({
    where: { userId, isRevealed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!seed) {
    throw new GameError('NO_ACTIVE_SEED', 'No active seed pair found. Play a game first.');
  }

  await prisma.provablyFairSeed.update({
    where: { id: seed.id },
    data: { clientSeed },
  });

  return { clientSeed, serverSeedHash: seed.serverSeedHash };
}

/**
 * Get all seed pairs for a user (revealed seeds show the full server seed).
 */
export async function getSeedHistory(
  userId: string,
  page = 1,
  limit = 20,
): Promise<{
  seeds: Array<{
    id: string;
    serverSeedHash: string;
    serverSeed: string | null;
    clientSeed: string;
    nonce: number;
    isRevealed: boolean;
    revealedAt: Date | null;
    createdAt: Date;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const skip = (page - 1) * limit;

  const [seeds, total] = await Promise.all([
    prisma.provablyFairSeed.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.provablyFairSeed.count({ where: { userId } }),
  ]);

  return {
    seeds: seeds.map((s) => ({
      id: s.id,
      serverSeedHash: s.serverSeedHash,
      serverSeed: s.isRevealed ? s.serverSeed : null, // Only reveal if rotated
      clientSeed: s.clientSeed,
      nonce: s.nonce,
      isRevealed: s.isRevealed,
      revealedAt: s.revealedAt,
      createdAt: s.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// Verify fairness
// ---------------------------------------------------------------------------

/**
 * Verify a past game result using the revealed server seed.
 */
export function verifyFairness(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  gameType: string,
): VerifyResult {
  const result = fairService.verify(serverSeed, clientSeed, nonce, gameType);
  const expectedHash = fairService.hashServerSeed(serverSeed);

  return {
    hash: expectedHash,
    result: result.result,
    valid: expectedHash === result.hash,
  };
}
