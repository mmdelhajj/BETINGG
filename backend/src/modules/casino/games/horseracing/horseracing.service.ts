import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Horse Racing Casino Game
// ---------------------------------------------------------------------------
// 6 horses race, player bets on winner. Each horse has fixed odds based on
// its "strength". Provably fair determines the race outcome. The race is
// simulated over 10 segments with speed variations for animation data.
// Bet types: Win (pick exact winner), Place (top 2), Show (top 3).
// ---------------------------------------------------------------------------

interface HorseConfig {
  id: number;
  name: string;
  color: string;
  baseSpeed: number; // higher = more likely to win
  winOdds: number;
  placeOdds: number;
  showOdds: number;
}

const HORSES: HorseConfig[] = [
  { id: 1, name: 'Thunder Bolt',   color: '#EF4444', baseSpeed: 0.88, winOdds: 2.5,  placeOdds: 1.4,  showOdds: 1.15 },
  { id: 2, name: 'Golden Arrow',   color: '#F59E0B', baseSpeed: 0.82, winOdds: 3.5,  placeOdds: 1.8,  showOdds: 1.3  },
  { id: 3, name: 'Silver Storm',   color: '#8B5CF6', baseSpeed: 0.75, winOdds: 5.0,  placeOdds: 2.2,  showOdds: 1.5  },
  { id: 4, name: 'Dark Knight',    color: '#3B82F6', baseSpeed: 0.65, winOdds: 8.0,  placeOdds: 3.0,  showOdds: 2.0  },
  { id: 5, name: 'Wild Spirit',    color: '#10B981', baseSpeed: 0.50, winOdds: 15.0, placeOdds: 5.0,  showOdds: 3.0  },
  { id: 6, name: 'Lucky Phantom',  color: '#EC4899', baseSpeed: 0.35, winOdds: 30.0, placeOdds: 10.0, showOdds: 5.0  },
];

const RACE_SEGMENTS = 10;
const VALID_HORSES = [1, 2, 3, 4, 5, 6];
const VALID_BET_TYPES = ['win', 'place', 'show'] as const;
type BetType = typeof VALID_BET_TYPES[number];

export interface HorseRacingOptions {
  horse: number;
  betType: BetType;
}

interface SegmentData {
  /** position progress for each horse (0-1 range) after this segment */
  positions: number[];
  /** speed factor applied this segment for each horse */
  speeds: number[];
}

export class HorseRacingGame extends BaseGame {
  readonly name = 'Horse Racing';
  readonly slug = 'horseracing';
  readonly houseEdge = 0.04;
  readonly minBet = 0.0001;
  readonly maxBet = 10000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as HorseRacingOptions;

    // Validate options
    if (!options || typeof options.horse !== 'number' || typeof options.betType !== 'string') {
      throw new GameError('INVALID_OPTIONS', 'Must provide horse (1-6) and betType (win/place/show).');
    }

    const horseId = options.horse;
    const betType = options.betType.toLowerCase() as BetType;

    if (!VALID_HORSES.includes(horseId)) {
      throw new GameError('INVALID_HORSE', 'Horse must be a number from 1 to 6.');
    }

    if (!VALID_BET_TYPES.includes(betType)) {
      throw new GameError('INVALID_BET_TYPE', 'Bet type must be "win", "place", or "show".');
    }

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get user seeds
    const seeds = await this.getUserSeeds(userId);

    // Generate the race using provably fair randomness
    // We need 6 horses * 10 segments = 60 random values
    const randoms = this.fairService.generateMultipleResults(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
      HORSES.length * RACE_SEGMENTS,
    );

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    // Simulate the race
    const { finishing, raceSegments } = this.simulateRace(randoms);

    // Determine win
    const selectedHorse = HORSES.find((h) => h.id === horseId)!;
    const finishPosition = finishing.indexOf(horseId) + 1; // 1-indexed position

    let isWin = false;
    let multiplier = 0;

    switch (betType) {
      case 'win':
        isWin = finishPosition === 1;
        multiplier = isWin ? selectedHorse.winOdds : 0;
        break;
      case 'place':
        isWin = finishPosition <= 2;
        multiplier = isWin ? selectedHorse.placeOdds : 0;
        break;
      case 'show':
        isWin = finishPosition <= 3;
        multiplier = isWin ? selectedHorse.showOdds : 0;
        break;
    }

    // Apply house edge to multiplier
    if (isWin) {
      multiplier = Math.floor(multiplier * (1 - this.houseEdge) * 10000) / 10000;
    }

    const payout = isWin
      ? Math.floor(bet.amount * multiplier * 100000000) / 100000000
      : 0;

    // Credit winnings
    if (isWin) {
      await this.creditWinnings(userId, payout, bet.currency);
    }

    // Increment nonce
    await this.incrementNonce(userId);

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: bet.amount,
      payout,
      multiplier,
      result: {
        selectedHorse: horseId,
        betType,
        finishing,
        finishPosition,
        isWin,
        horses: HORSES.map((h) => ({
          id: h.id,
          name: h.name,
          color: h.color,
          winOdds: h.winOdds,
          placeOdds: h.placeOdds,
          showOdds: h.showOdds,
        })),
      },
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    const newBalance = await this.getBalance(userId, bet.currency);

    return {
      roundId,
      game: this.slug,
      betAmount: bet.amount,
      payout,
      profit: payout - bet.amount,
      multiplier,
      result: {
        selectedHorse: horseId,
        selectedHorseName: selectedHorse.name,
        selectedHorseColor: selectedHorse.color,
        betType,
        finishing,
        finishPosition,
        raceSegments,
        isWin,
        horses: HORSES.map((h) => ({
          id: h.id,
          name: h.name,
          color: h.color,
          winOdds: h.winOdds,
          placeOdds: h.placeOdds,
          showOdds: h.showOdds,
        })),
      },
      fairness: {
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.nonce,
      },
      newBalance,
    };
  }

  // =======================================================================
  // Race simulation
  // =======================================================================

  /**
   * Simulate a race over RACE_SEGMENTS segments.
   * Each horse accumulates distance based on baseSpeed + random variation.
   * Returns the finishing order (array of horse IDs, index 0 = winner)
   * and segment-by-segment data for animation.
   */
  private simulateRace(randoms: number[]): {
    finishing: number[];
    raceSegments: SegmentData[];
  } {
    const numHorses = HORSES.length;
    const positions = new Array(numHorses).fill(0); // cumulative distance
    const raceSegments: SegmentData[] = [];

    for (let seg = 0; seg < RACE_SEGMENTS; seg++) {
      const segSpeeds: number[] = [];

      for (let h = 0; h < numHorses; h++) {
        const randomIdx = seg * numHorses + h;
        const randomVal = randoms[randomIdx];

        // Speed = baseSpeed * (0.7 + randomVal * 0.6)
        // This gives a range of [baseSpeed*0.7, baseSpeed*1.3]
        const horse = HORSES[h];
        const speedVariation = 0.7 + randomVal * 0.6;
        const segmentSpeed = horse.baseSpeed * speedVariation;
        segSpeeds.push(segmentSpeed);

        // Add distance covered in this segment (each segment covers ~1/10 of the track)
        positions[h] += segmentSpeed / RACE_SEGMENTS;
      }

      // Normalize positions to 0-1 range for the current segment
      const maxPos = Math.max(...positions);
      const normalizedPositions = positions.map((p) =>
        maxPos > 0 ? Math.min(1, p / (maxPos * 1.05)) : 0,
      );

      // At the last segment, the leader should be at ~1.0
      if (seg === RACE_SEGMENTS - 1) {
        const maxFinal = Math.max(...positions);
        const finalPositions = positions.map((p) => p / maxFinal);
        raceSegments.push({
          positions: finalPositions,
          speeds: segSpeeds,
        });
      } else {
        raceSegments.push({
          positions: normalizedPositions,
          speeds: segSpeeds,
        });
      }
    }

    // Determine finishing order based on total distance
    const indexed = positions.map((dist, i) => ({ dist, horseId: HORSES[i].id }));
    indexed.sort((a, b) => b.dist - a.dist);
    const finishing = indexed.map((item) => item.horseId);

    return { finishing, raceSegments };
  }

  /**
   * Get available horses and their odds (for frontend display).
   */
  static getHorses(): HorseConfig[] {
    return HORSES;
  }
}

export const horseRacingGame = new HorseRacingGame();
export default horseRacingGame;
