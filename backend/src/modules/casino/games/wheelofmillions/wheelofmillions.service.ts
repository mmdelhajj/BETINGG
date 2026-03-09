import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierResult {
  segment: string;
  multiplier: number;
}

interface WheelOfMillionsResult {
  tier1: TierResult;
  tier2?: TierResult;
  tier3?: TierResult;
  finalMultiplier: number;
  payout: number;
  tiersReached: number;
}

// ---------------------------------------------------------------------------
// Tier segment definitions with weighted probabilities
// ---------------------------------------------------------------------------

// Tier 1 (Outer Wheel): 1x, 2x, 3x, 5x, BONUS
// Probabilities: 1x ~35%, 2x ~25%, 3x ~15%, 5x ~10%, BONUS ~15%
const TIER1_SEGMENTS: { segment: string; multiplier: number; weight: number }[] = [
  { segment: '1x', multiplier: 1, weight: 35 },
  { segment: '2x', multiplier: 2, weight: 25 },
  { segment: '3x', multiplier: 3, weight: 15 },
  { segment: '5x', multiplier: 5, weight: 10 },
  { segment: 'BONUS', multiplier: 0, weight: 15 },
];

// Tier 2 (Middle Wheel): 10x, 25x, 50x, 100x, MEGA BONUS
// Probabilities: 10x ~35%, 25x ~25%, 50x ~18%, 100x ~12%, MEGA BONUS ~10%
const TIER2_SEGMENTS: { segment: string; multiplier: number; weight: number }[] = [
  { segment: '10x', multiplier: 10, weight: 35 },
  { segment: '25x', multiplier: 25, weight: 25 },
  { segment: '50x', multiplier: 50, weight: 18 },
  { segment: '100x', multiplier: 100, weight: 12 },
  { segment: 'MEGA BONUS', multiplier: 0, weight: 10 },
];

// Tier 3 (Inner Wheel): 500x, 1000x, 5000x, 10000x
// Probabilities: 500x ~45%, 1000x ~30%, 5000x ~18%, 10000x ~7%
const TIER3_SEGMENTS: { segment: string; multiplier: number; weight: number }[] = [
  { segment: '500x', multiplier: 500, weight: 45 },
  { segment: '1000x', multiplier: 1000, weight: 30 },
  { segment: '5000x', multiplier: 5000, weight: 18 },
  { segment: '10000x', multiplier: 10000, weight: 7 },
];

// Total weights for each tier
const TIER1_TOTAL = TIER1_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
const TIER2_TOTAL = TIER2_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
const TIER3_TOTAL = TIER3_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);

/**
 * Pick a segment from a tier using a provably fair random value [0,1).
 */
function pickSegment(
  segments: typeof TIER1_SEGMENTS,
  totalWeight: number,
  randomValue: number,
): { segment: string; multiplier: number; index: number } {
  const target = randomValue * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < segments.length; i++) {
    cumulative += segments[i].weight;
    if (target < cumulative) {
      return { segment: segments[i].segment, multiplier: segments[i].multiplier, index: i };
    }
  }
  // Fallback: last segment
  const last = segments[segments.length - 1];
  return { segment: last.segment, multiplier: last.multiplier, index: segments.length - 1 };
}

// ---------------------------------------------------------------------------
// WheelOfMillions Game
// ---------------------------------------------------------------------------

export class WheelOfMillionsGame extends BaseGame {
  readonly name = 'Wheel of Millions';
  readonly slug = 'wheelofmillions';
  readonly houseEdge = 0.04;
  readonly minBet = 0.0001;
  readonly maxBet = 1000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency } = bet;

    // Validate bet
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate 3 random values (one for each possible tier) using provably fair
    const pfResults = this.fairService.generateMultipleResults(serverSeed, clientSeed, nonce, 3);

    // --- Tier 1 (Outer Wheel) - always spins ---
    const tier1Pick = pickSegment(TIER1_SEGMENTS, TIER1_TOTAL, pfResults[0]);
    const tier1: TierResult = { segment: tier1Pick.segment, multiplier: tier1Pick.multiplier };

    let tier2: TierResult | undefined;
    let tier3: TierResult | undefined;
    let finalMultiplier: number;
    let tiersReached = 1;

    if (tier1Pick.segment === 'BONUS') {
      // --- Tier 2 (Middle Wheel) ---
      tiersReached = 2;
      const tier2Pick = pickSegment(TIER2_SEGMENTS, TIER2_TOTAL, pfResults[1]);
      tier2 = { segment: tier2Pick.segment, multiplier: tier2Pick.multiplier };

      if (tier2Pick.segment === 'MEGA BONUS') {
        // --- Tier 3 (Inner Wheel) ---
        tiersReached = 3;
        const tier3Pick = pickSegment(TIER3_SEGMENTS, TIER3_TOTAL, pfResults[2]);
        tier3 = { segment: tier3Pick.segment, multiplier: tier3Pick.multiplier };
        finalMultiplier = tier3Pick.multiplier;
      } else {
        finalMultiplier = tier2Pick.multiplier;
      }
    } else {
      finalMultiplier = tier1Pick.multiplier;
    }

    const payout = Math.floor(amount * finalMultiplier * 100000000) / 100000000;
    const profit = payout - amount;

    // Atomic transaction: deduct, credit if win, record round
    await this.deductBalance(userId, amount, currency);

    if (payout > 0) {
      await this.creditWinnings(userId, payout, currency);
    }

    const resultData: WheelOfMillionsResult = {
      tier1,
      tier2,
      tier3,
      finalMultiplier,
      payout,
      tiersReached,
    };

    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: amount,
      payout,
      multiplier: finalMultiplier,
      result: {
        ...resultData,
        pfValues: pfResults,
        tier1Index: pickSegment(TIER1_SEGMENTS, TIER1_TOTAL, pfResults[0]).index,
        tier2Index: tier2 ? pickSegment(TIER2_SEGMENTS, TIER2_TOTAL, pfResults[1]).index : null,
        tier3Index: tier3 ? pickSegment(TIER3_SEGMENTS, TIER3_TOTAL, pfResults[2]).index : null,
      },
      serverSeedHash,
      clientSeed,
      nonce,
    });

    // Increment nonce for next bet
    await this.incrementNonce(userId);

    // Fetch updated balance
    const newBalance = await this.getBalance(userId, currency);

    return {
      roundId,
      game: this.slug,
      betAmount: amount,
      payout,
      profit,
      multiplier: finalMultiplier,
      result: {
        ...resultData,
        tier1Segments: TIER1_SEGMENTS.map((s) => ({ segment: s.segment, multiplier: s.multiplier })),
        tier2Segments: TIER2_SEGMENTS.map((s) => ({ segment: s.segment, multiplier: s.multiplier })),
        tier3Segments: TIER3_SEGMENTS.map((s) => ({ segment: s.segment, multiplier: s.multiplier })),
        tier1Index: pickSegment(TIER1_SEGMENTS, TIER1_TOTAL, pfResults[0]).index,
        tier2Index: tier2 ? pickSegment(TIER2_SEGMENTS, TIER2_TOTAL, pfResults[1]).index : null,
        tier3Index: tier3 ? pickSegment(TIER3_SEGMENTS, TIER3_TOTAL, pfResults[2]).index : null,
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
      newBalance,
    };
  }
}

export const wheelOfMillionsGame = new WheelOfMillionsGame();
export default wheelOfMillionsGame;
