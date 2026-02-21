import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RiskLevel = 'low' | 'medium' | 'high';

interface WheelSegment {
  color: string;
  multiplier: number;
}

interface WheelBetOptions {
  riskLevel: RiskLevel;
}

// ---------------------------------------------------------------------------
// Segment configurations by risk level
// 54 segments total per wheel
// ---------------------------------------------------------------------------

const WHEEL_CONFIGS: Record<RiskLevel, WheelSegment[]> = {
  low: buildWheelSegments([
    { color: 'gray', multiplier: 1.2, count: 25 },
    { color: 'blue', multiplier: 1.5, count: 15 },
    { color: 'green', multiplier: 2, count: 8 },
    { color: 'purple', multiplier: 5, count: 4 },
    { color: 'gold', multiplier: 50, count: 1 },
    { color: 'red', multiplier: 0, count: 1 },
  ]),
  medium: buildWheelSegments([
    { color: 'gray', multiplier: 1.5, count: 22 },
    { color: 'blue', multiplier: 2, count: 14 },
    { color: 'green', multiplier: 3, count: 9 },
    { color: 'purple', multiplier: 10, count: 5 },
    { color: 'gold', multiplier: 100, count: 1 },
    { color: 'red', multiplier: 0, count: 3 },
  ]),
  high: buildWheelSegments([
    { color: 'gray', multiplier: 0, count: 25 },
    { color: 'blue', multiplier: 1.5, count: 13 },
    { color: 'green', multiplier: 3, count: 7 },
    { color: 'purple', multiplier: 10, count: 5 },
    { color: 'gold', multiplier: 150, count: 1 },
    { color: 'red', multiplier: 0, count: 3 },
  ]),
};

function buildWheelSegments(
  defs: { color: string; multiplier: number; count: number }[],
): WheelSegment[] {
  const segments: WheelSegment[] = [];
  for (const def of defs) {
    for (let i = 0; i < def.count; i++) {
      segments.push({ color: def.color, multiplier: def.multiplier });
    }
  }
  return segments;
}

// ---------------------------------------------------------------------------
// WheelGame
// ---------------------------------------------------------------------------

export class WheelGame extends BaseGame {
  readonly name = 'Wheel of Fortune';
  readonly slug = 'wheel';
  readonly houseEdge = 0.03;
  readonly minBet = 0.1;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const opts = options as WheelBetOptions | undefined;

    // Validate risk level
    const riskLevel: RiskLevel = opts?.riskLevel ?? 'low';
    if (!['low', 'medium', 'high'].includes(riskLevel)) {
      throw new GameError('INVALID_RISK', 'Risk level must be low, medium, or high.');
    }

    // Validate bet
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Generate segment index using provably fair
    const segments = WHEEL_CONFIGS[riskLevel];
    const totalSegments = segments.length; // 54
    const pfResult = this.fairService.generateResult(serverSeed, clientSeed, nonce);
    const segmentIndex = Math.floor(pfResult * totalSegments);
    const segment = segments[segmentIndex];

    const multiplier = segment.multiplier;
    const payout = amount * multiplier;
    const profit = payout - amount;

    // Atomic transaction: deduct, credit if win, record round
    await this.deductBalance(userId, amount, currency);

    if (payout > 0) {
      await this.creditWinnings(userId, payout, currency);
    }

    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: amount,
      payout,
      multiplier,
      result: {
        segmentIndex,
        segmentColor: segment.color,
        segmentMultiplier: multiplier,
        riskLevel,
        totalSegments,
      },
      serverSeedHash,
      clientSeed,
      nonce,
    });

    // Increment nonce for next bet
    await this.incrementNonce(userId);

    // Fetch updated balance to include in response
    const newBalance = await this.getBalance(userId, currency);

    return {
      roundId,
      game: this.slug,
      betAmount: amount,
      payout,
      profit,
      multiplier,
      result: {
        segmentIndex,
        segmentColor: segment.color,
        segmentMultiplier: multiplier,
        riskLevel,
        totalSegments,
        allSegments: segments,
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

export const wheelGame = new WheelGame();
export default wheelGame;
