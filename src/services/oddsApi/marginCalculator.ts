import Decimal from 'decimal.js';

/**
 * Margin Calculator for odds pricing.
 *
 * Pipeline:
 *   1. Convert bookmaker odds to implied probabilities
 *   2. Sum implied probabilities (will be > 1 due to bookmaker vig)
 *   3. Normalize to 100% (de-vig / remove bookmaker margin)
 *   4. Apply our own margin
 *   5. Convert back to decimal odds
 *   6. Round to 2 decimal places, ensure minimum odds of 1.01
 */
export class MarginCalculator {
  private readonly margin: Decimal;

  constructor(marginPercent: number = 5) {
    // margin is stored as a fraction (e.g. 5% -> 0.05)
    this.margin = new Decimal(marginPercent).div(100);
  }

  /**
   * Convert decimal odds to implied probability.
   * impliedProb = 1 / odds
   */
  oddsToImpliedProbability(odds: Decimal): Decimal {
    if (odds.lte(0)) {
      throw new Error('Odds must be positive');
    }
    return new Decimal(1).div(odds);
  }

  /**
   * Convert probability to decimal odds.
   * odds = 1 / probability
   */
  probabilityToOdds(probability: Decimal): Decimal {
    if (probability.lte(0) || probability.gte(1)) {
      throw new Error('Probability must be between 0 and 1 (exclusive)');
    }
    return new Decimal(1).div(probability);
  }

  /**
   * De-vig a set of odds: remove the bookmaker's margin and return fair probabilities.
   *
   * Uses the multiplicative method (simplest, most common):
   *   fairProb_i = impliedProb_i / sum(impliedProbs)
   */
  devig(oddsArray: Decimal[]): Decimal[] {
    if (oddsArray.length === 0) {
      return [];
    }

    const impliedProbs = oddsArray.map((o) => this.oddsToImpliedProbability(o));
    const totalImplied = impliedProbs.reduce(
      (sum, p) => sum.plus(p),
      new Decimal(0),
    );

    // Normalize: fair probabilities sum to 1
    return impliedProbs.map((p) => p.div(totalImplied));
  }

  /**
   * Apply our house margin to fair probabilities and convert back to odds.
   *
   * For each selection:
   *   adjustedProb = fairProb * (1 + margin)
   *   finalOdds = 1 / adjustedProb
   *
   * This ensures the sum of implied probabilities in the final odds
   * equals (1 + margin), giving us the desired overround.
   */
  applyMargin(fairProbabilities: Decimal[]): Decimal[] {
    const marginMultiplier = new Decimal(1).plus(this.margin);

    return fairProbabilities.map((fairProb) => {
      const adjustedProb = fairProb.mul(marginMultiplier);

      // Clamp probability to avoid odds below 1.01 or negative
      const clampedProb = Decimal.min(adjustedProb, new Decimal(0.99));

      const rawOdds = new Decimal(1).div(clampedProb);

      // Ensure minimum odds of 1.01
      const finalOdds = Decimal.max(rawOdds, new Decimal(1.01));

      return finalOdds.toDecimalPlaces(2);
    });
  }

  /**
   * Full pipeline: take raw bookmaker odds and return our platform's odds.
   *
   * 1. De-vig the bookmaker odds
   * 2. Apply our margin
   * 3. Return final odds array
   */
  calculatePlatformOdds(bookmakerOdds: Decimal[]): Decimal[] {
    const fairProbabilities = this.devig(bookmakerOdds);
    return this.applyMargin(fairProbabilities);
  }

  /**
   * Pick the best (highest) odds for each outcome across multiple bookmakers,
   * then apply our margin to get the sharpest possible line.
   *
   * @param bookmakerOddsSets - Array of arrays. Each inner array is one bookmaker's odds
   *   for the same set of outcomes, in the same order.
   *   E.g. [[home, draw, away], [home, draw, away], ...]
   * @returns Our platform odds derived from the best available odds per outcome.
   */
  bestOddsWithMargin(bookmakerOddsSets: Decimal[][]): Decimal[] {
    if (bookmakerOddsSets.length === 0) {
      return [];
    }

    const outcomeCount = bookmakerOddsSets[0].length;

    // For each outcome, pick the best (highest) odds across bookmakers
    const bestOdds: Decimal[] = [];
    for (let i = 0; i < outcomeCount; i++) {
      let best = new Decimal(0);
      for (const bookmakerOdds of bookmakerOddsSets) {
        if (i < bookmakerOdds.length && bookmakerOdds[i].gt(best)) {
          best = bookmakerOdds[i];
        }
      }
      bestOdds.push(best);
    }

    return this.calculatePlatformOdds(bestOdds);
  }

  /**
   * Calculate the overround (total margin) for a set of odds.
   * overround = sum(1/odds_i) - 1, expressed as a percentage.
   */
  calculateOverround(oddsArray: Decimal[]): Decimal {
    const totalImplied = oddsArray.reduce(
      (sum, o) => sum.plus(new Decimal(1).div(o)),
      new Decimal(0),
    );
    return totalImplied.minus(1).mul(100).toDecimalPlaces(2);
  }

  /**
   * Get the fair probability for each selection after de-vigging.
   * Returns an array of Decimal probabilities that sum to 1.
   */
  getFairProbabilities(bookmakerOdds: Decimal[]): Decimal[] {
    return this.devig(bookmakerOdds);
  }

  /**
   * Get the current margin percentage.
   */
  getMarginPercent(): Decimal {
    return this.margin.mul(100);
  }
}
