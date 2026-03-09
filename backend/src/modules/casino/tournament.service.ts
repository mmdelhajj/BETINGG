import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { GameError } from '../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Tournament System — In-Memory + Redis backed
// ---------------------------------------------------------------------------
// Tournaments run on specific casino games. Players pay an entry fee that
// goes to a prize pool. During the tournament window, the system tracks each
// participant's casino rounds for the target game to compute scores.
// Scoring modes: highest_multiplier, most_profit, wagering_volume.
// Prize distribution: 1st 50%, 2nd 25%, 3rd 15%, 4th-5th 5% each.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ScoringType = 'highest_multiplier' | 'most_profit' | 'wagering_volume';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  game: string; // game slug
  entryFee: number;
  currency: string;
  prizePool: number;
  startTime: Date;
  endTime: Date;
  status: TournamentStatus;
  scoringType: ScoringType;
  maxParticipants: number;
  minParticipants: number;
  participants: TournamentParticipant[];
  createdAt: Date;
}

export interface TournamentParticipant {
  userId: string;
  username: string;
  joinedAt: Date;
  score: number;
  roundsPlayed: number;
  prize: number;
  rank: number;
}

export interface TournamentListEntry {
  id: string;
  name: string;
  description: string;
  game: string;
  entryFee: number;
  currency: string;
  prizePool: number;
  startTime: Date;
  endTime: Date;
  status: TournamentStatus;
  scoringType: ScoringType;
  participantCount: number;
  maxParticipants: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  roundsPlayed: number;
  prize: number;
}

// ---------------------------------------------------------------------------
// In-memory tournament store
// ---------------------------------------------------------------------------

const tournaments = new Map<string, Tournament>();

// Prize distribution percentages
const PRIZE_DISTRIBUTION: Record<number, number> = {
  1: 0.50,
  2: 0.25,
  3: 0.15,
  4: 0.05,
  5: 0.05,
};

// ---------------------------------------------------------------------------
// Seed some default tournaments
// ---------------------------------------------------------------------------

function seedDefaultTournaments(): void {
  const now = new Date();

  const defaultTournaments: Omit<Tournament, 'participants'>[] = [
    {
      id: crypto.randomUUID(),
      name: 'Dice Masters Championship',
      description: 'Hit the highest multiplier in Dice to climb the leaderboard! Top 5 win prizes from the pool.',
      game: 'dice',
      entryFee: 5,
      currency: 'USDT',
      prizePool: 100,
      startTime: new Date(now.getTime() - 30 * 60 * 1000), // started 30 min ago
      endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // ends in 2 hours
      status: 'active',
      scoringType: 'highest_multiplier',
      maxParticipants: 100,
      minParticipants: 2,
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
    },
    {
      id: crypto.randomUUID(),
      name: 'Crash Tournament',
      description: 'Ride the crash curve to the moon. Highest single-round multiplier wins!',
      game: 'crash',
      entryFee: 10,
      currency: 'USDT',
      prizePool: 250,
      startTime: new Date(now.getTime() + 1 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      status: 'upcoming',
      scoringType: 'highest_multiplier',
      maxParticipants: 200,
      minParticipants: 5,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: 'Coinflip Profit Rush',
      description: 'Flip your way to profit! Player with the highest total profit wins.',
      game: 'coinflip',
      entryFee: 2,
      currency: 'USDT',
      prizePool: 50,
      startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 30 * 60 * 1000),
      status: 'active',
      scoringType: 'most_profit',
      maxParticipants: 50,
      minParticipants: 2,
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    },
    {
      id: crypto.randomUUID(),
      name: 'Mines Wagering War',
      description: 'Wager the most in Mines during the tournament period to climb the leaderboard.',
      game: 'mines',
      entryFee: 5,
      currency: 'USDT',
      prizePool: 150,
      startTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 12 * 60 * 60 * 1000),
      status: 'upcoming',
      scoringType: 'wagering_volume',
      maxParticipants: 100,
      minParticipants: 3,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: 'Plinko Drop Party',
      description: 'Completed tournament! Here were the results.',
      game: 'plinko',
      entryFee: 3,
      currency: 'USDT',
      prizePool: 75,
      startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      status: 'completed',
      scoringType: 'highest_multiplier',
      maxParticipants: 80,
      minParticipants: 2,
      createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
    },
    {
      id: crypto.randomUUID(),
      name: 'Virtual Sports Showdown',
      description: 'Bet on virtual sports matches and score the highest multiplier!',
      game: 'virtualsports',
      entryFee: 5,
      currency: 'USDT',
      prizePool: 200,
      startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      status: 'upcoming',
      scoringType: 'highest_multiplier',
      maxParticipants: 150,
      minParticipants: 3,
      createdAt: now,
    },
  ];

  // Seed some fake participants for the completed tournament
  for (const t of defaultTournaments) {
    const participants: TournamentParticipant[] = [];

    if (t.status === 'completed') {
      const fakeUsers = [
        { userId: 'demo_user_1', username: 'CryptoKing', score: 52.4 },
        { userId: 'demo_user_2', username: 'LuckyAce', score: 38.7 },
        { userId: 'demo_user_3', username: 'BetMaster', score: 24.1 },
        { userId: 'demo_user_4', username: 'GambleGuru', score: 18.9 },
        { userId: 'demo_user_5', username: 'RollHigh', score: 12.3 },
      ];
      fakeUsers.forEach((u, idx) => {
        participants.push({
          userId: u.userId,
          username: u.username,
          joinedAt: new Date(t.startTime.getTime() + idx * 60000),
          score: u.score,
          roundsPlayed: 10 + idx * 5,
          prize: t.prizePool * (PRIZE_DISTRIBUTION[idx + 1] || 0),
          rank: idx + 1,
        });
      });
    }

    if (t.status === 'active') {
      // Add a few demo participants to active tournaments
      const demoParticipants = [
        { userId: 'demo_user_1', username: 'CryptoKing', score: 12.5 },
        { userId: 'demo_user_3', username: 'BetMaster', score: 8.2 },
      ];
      demoParticipants.forEach((u, idx) => {
        participants.push({
          userId: u.userId,
          username: u.username,
          joinedAt: new Date(t.startTime.getTime() + idx * 120000),
          score: u.score,
          roundsPlayed: 5 + idx * 3,
          prize: 0,
          rank: idx + 1,
        });
      });
    }

    tournaments.set(t.id, { ...t, participants });
  }
}

// Initialize on module load
seedDefaultTournaments();

// ---------------------------------------------------------------------------
// Status updater — check tournaments for status transitions
// ---------------------------------------------------------------------------

function updateTournamentStatuses(): void {
  const now = new Date();
  for (const [, tournament] of tournaments) {
    if (tournament.status === 'upcoming' && now >= tournament.startTime) {
      tournament.status = 'active';
    }
    if (tournament.status === 'active' && now >= tournament.endTime) {
      tournament.status = 'completed';
      distributePrizes(tournament);
    }
  }
}

// Run status check every 30 seconds
setInterval(updateTournamentStatuses, 30 * 1000);

// ---------------------------------------------------------------------------
// Prize distribution
// ---------------------------------------------------------------------------

function distributePrizes(tournament: Tournament): void {
  // Sort participants by score descending
  const sorted = [...tournament.participants].sort((a, b) => b.score - a.score);

  sorted.forEach((p, idx) => {
    const rank = idx + 1;
    p.rank = rank;
    p.prize = tournament.prizePool * (PRIZE_DISTRIBUTION[rank] || 0);
  });

  tournament.participants = sorted;

  // Credit prizes to user wallets (fire-and-forget)
  for (const p of sorted) {
    if (p.prize > 0 && !p.userId.startsWith('demo_')) {
      creditTournamentPrize(p.userId, p.prize, tournament.currency).catch((err) => {
        console.error(`[Tournament] Failed to credit prize to ${p.userId}:`, err);
      });
    }
  }
}

async function creditTournamentPrize(userId: string, amount: number, currency: string): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { userId, currency: { symbol: currency } },
      });

      if (!wallet) return;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: new Decimal(amount.toFixed(8)) },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WIN',
          amount: new Decimal(amount.toFixed(8)),
          status: 'COMPLETED',
        },
      });
    });
  } catch (err) {
    console.error(`[Tournament] Credit prize error for user ${userId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Score calculation from CasinoRound table
// ---------------------------------------------------------------------------

async function calculateUserScore(
  userId: string,
  gameSlug: string,
  scoringType: ScoringType,
  startTime: Date,
  endTime: Date,
): Promise<{ score: number; roundsPlayed: number }> {
  const now = new Date();
  const effectiveEnd = now < endTime ? now : endTime;

  try {
    const rounds = await prisma.casinoRound.findMany({
      where: {
        userId,
        gameSlug,
        createdAt: {
          gte: startTime,
          lte: effectiveEnd,
        },
      },
      select: {
        betAmount: true,
        payout: true,
        multiplier: true,
      },
    });

    const roundsPlayed = rounds.length;

    switch (scoringType) {
      case 'highest_multiplier': {
        let maxMultiplier = 0;
        for (const r of rounds) {
          const m = r.multiplier.toNumber();
          if (m > maxMultiplier) maxMultiplier = m;
        }
        return { score: Math.round(maxMultiplier * 100) / 100, roundsPlayed };
      }
      case 'most_profit': {
        let totalProfit = 0;
        for (const r of rounds) {
          totalProfit += r.payout.toNumber() - r.betAmount.toNumber();
        }
        return { score: Math.round(totalProfit * 100) / 100, roundsPlayed };
      }
      case 'wagering_volume': {
        let totalWagered = 0;
        for (const r of rounds) {
          totalWagered += r.betAmount.toNumber();
        }
        return { score: Math.round(totalWagered * 100) / 100, roundsPlayed };
      }
      default:
        return { score: 0, roundsPlayed };
    }
  } catch {
    return { score: 0, roundsPlayed: 0 };
  }
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * List tournaments by status filter.
 */
export async function listTournaments(
  statusFilter?: TournamentStatus,
): Promise<TournamentListEntry[]> {
  updateTournamentStatuses();

  const results: TournamentListEntry[] = [];

  for (const [, t] of tournaments) {
    if (statusFilter && t.status !== statusFilter) continue;

    results.push({
      id: t.id,
      name: t.name,
      description: t.description,
      game: t.game,
      entryFee: t.entryFee,
      currency: t.currency,
      prizePool: t.prizePool,
      startTime: t.startTime,
      endTime: t.endTime,
      status: t.status,
      scoringType: t.scoringType,
      participantCount: t.participants.length,
      maxParticipants: t.maxParticipants,
    });
  }

  // Sort: active first, then upcoming by start time, then completed by end time
  results.sort((a, b) => {
    const statusOrder: Record<string, number> = { active: 0, upcoming: 1, completed: 2, cancelled: 3 };
    const diff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    if (diff !== 0) return diff;
    return a.startTime.getTime() - b.startTime.getTime();
  });

  return results;
}

/**
 * Get tournament details with leaderboard.
 */
export async function getTournamentDetails(
  tournamentId: string,
  requestingUserId?: string,
): Promise<{
  tournament: Tournament;
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
  isJoined: boolean;
}> {
  updateTournamentStatuses();

  const tournament = tournaments.get(tournamentId);
  if (!tournament) {
    throw new GameError('TOURNAMENT_NOT_FOUND', 'Tournament not found.');
  }

  // Recalculate live scores for active tournaments
  if (tournament.status === 'active') {
    for (const participant of tournament.participants) {
      if (!participant.userId.startsWith('demo_')) {
        const { score, roundsPlayed } = await calculateUserScore(
          participant.userId,
          tournament.game,
          tournament.scoringType,
          tournament.startTime,
          tournament.endTime,
        );
        participant.score = score;
        participant.roundsPlayed = roundsPlayed;
      }
    }

    // Re-rank
    const sorted = [...tournament.participants].sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      p.rank = idx + 1;
    });
    tournament.participants = sorted;
  }

  const leaderboard: LeaderboardEntry[] = tournament.participants.map((p) => ({
    rank: p.rank,
    userId: p.userId,
    username: p.username,
    score: p.score,
    roundsPlayed: p.roundsPlayed,
    prize: p.prize > 0 ? p.prize : tournament.prizePool * (PRIZE_DISTRIBUTION[p.rank] || 0),
  }));

  let userRank: number | null = null;
  let isJoined = false;

  if (requestingUserId) {
    const participant = tournament.participants.find((p) => p.userId === requestingUserId);
    if (participant) {
      userRank = participant.rank;
      isJoined = true;
    }
  }

  return { tournament, leaderboard, userRank, isJoined };
}

/**
 * Join a tournament (pay entry fee).
 */
export async function joinTournament(
  userId: string,
  tournamentId: string,
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  updateTournamentStatuses();

  const tournament = tournaments.get(tournamentId);
  if (!tournament) {
    throw new GameError('TOURNAMENT_NOT_FOUND', 'Tournament not found.');
  }

  if (tournament.status === 'completed' || tournament.status === 'cancelled') {
    throw new GameError('TOURNAMENT_ENDED', 'This tournament has already ended.');
  }

  if (tournament.participants.length >= tournament.maxParticipants) {
    throw new GameError('TOURNAMENT_FULL', 'This tournament is full.');
  }

  // Check if user already joined
  if (tournament.participants.find((p) => p.userId === userId)) {
    throw new GameError('ALREADY_JOINED', 'You have already joined this tournament.');
  }

  // Get username
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  if (!user) {
    throw new GameError('USER_NOT_FOUND', 'User not found.');
  }

  // Deduct entry fee
  if (tournament.entryFee > 0) {
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId,
        currency: { symbol: tournament.currency },
      },
    });

    if (!wallet) {
      throw new GameError('WALLET_NOT_FOUND', `No ${tournament.currency} wallet found.`);
    }

    if (wallet.balance.toNumber() < tournament.entryFee) {
      throw new GameError(
        'INSUFFICIENT_BALANCE',
        `Insufficient ${tournament.currency} balance. Need ${tournament.entryFee}, have ${wallet.balance.toNumber()}.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: new Decimal(tournament.entryFee.toFixed(8)) },
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'BET',
          amount: new Decimal(tournament.entryFee.toFixed(8)),
          status: 'COMPLETED',
        },
      });
    });

    // Add to prize pool
    tournament.prizePool += tournament.entryFee;
  }

  // Add participant
  tournament.participants.push({
    userId,
    username: user.username,
    joinedAt: new Date(),
    score: 0,
    roundsPlayed: 0,
    prize: 0,
    rank: tournament.participants.length + 1,
  });

  // Get updated balance
  const updatedWallet = await prisma.wallet.findFirst({
    where: { userId, currency: { symbol: tournament.currency } },
    select: { balance: true },
  });
  const newBalance = updatedWallet ? updatedWallet.balance.toNumber() : 0;

  // Cache participant list in Redis for quick lookups
  await redis
    .sadd(`tournament:${tournamentId}:participants`, userId)
    .catch(() => {});

  return {
    success: true,
    message: `Successfully joined "${tournament.name}"!`,
    newBalance,
  };
}

/**
 * Create a new tournament (admin or system use).
 */
export function createTournament(data: {
  name: string;
  description: string;
  game: string;
  entryFee: number;
  currency: string;
  basePrizePool: number;
  startTime: Date;
  endTime: Date;
  scoringType: ScoringType;
  maxParticipants: number;
  minParticipants: number;
}): Tournament {
  const id = crypto.randomUUID();

  const tournament: Tournament = {
    id,
    name: data.name,
    description: data.description,
    game: data.game,
    entryFee: data.entryFee,
    currency: data.currency,
    prizePool: data.basePrizePool,
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
    status: new Date() >= new Date(data.startTime) ? 'active' : 'upcoming',
    scoringType: data.scoringType,
    maxParticipants: data.maxParticipants,
    minParticipants: data.minParticipants,
    participants: [],
    createdAt: new Date(),
  };

  tournaments.set(id, tournament);
  return tournament;
}

/**
 * Get tournament IDs a user has joined.
 */
export function getUserTournaments(userId: string): string[] {
  const result: string[] = [];
  for (const [id, t] of tournaments) {
    if (t.participants.some((p) => p.userId === userId)) {
      result.push(id);
    }
  }
  return result;
}

export const tournamentService = {
  listTournaments,
  getTournamentDetails,
  joinTournament,
  createTournament,
  getUserTournaments,
};

export default tournamentService;
