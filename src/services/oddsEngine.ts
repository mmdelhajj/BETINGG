import Decimal from 'decimal.js';

export type OddsFormatType = 'DECIMAL' | 'FRACTIONAL' | 'AMERICAN';

export class OddsEngine {
  /**
   * Convert true probability to odds with margin applied
   */
  static probabilityToOdds(probability: number, margin: number = 0.05): Decimal {
    if (probability <= 0 || probability >= 1) throw new Error('Probability must be between 0 and 1');
    const trueOdds = new Decimal(1).div(probability);
    // Apply margin: odds = trueOdds * (1 - margin) adjusted
    const adjustedProb = probability * (1 + margin);
    return new Decimal(1).div(adjustedProb).mul(trueOdds).toDecimalPlaces(4);
  }

  /**
   * Apply margin to a set of probabilities (must sum to ~1)
   */
  static applyMargin(probabilities: number[], margin: number = 0.05): Decimal[] {
    const sum = probabilities.reduce((a, b) => a + b, 0);
    const marginMultiplier = (1 + margin) / sum;

    return probabilities.map((p) => {
      const adjustedProb = p * marginMultiplier;
      return new Decimal(1).div(adjustedProb).toDecimalPlaces(2);
    });
  }

  /**
   * Calculate combined parlay odds
   */
  static parlayOdds(odds: Decimal[]): Decimal {
    return odds.reduce((acc, o) => acc.mul(o), new Decimal(1)).toDecimalPlaces(4);
  }

  /**
   * Calculate potential win for a bet
   */
  static potentialWin(stake: Decimal, odds: Decimal): Decimal {
    return stake.mul(odds).toDecimalPlaces(8);
  }

  /**
   * Calculate cash-out value
   * Based on: cashout = stake * (originalOdds / currentOdds) * (1 - cashoutMargin)
   */
  static cashOutValue(
    stake: Decimal,
    originalOdds: Decimal,
    currentOdds: Decimal,
    cashoutMargin: number = 0.05
  ): Decimal {
    if (currentOdds.lte(0)) return new Decimal(0);
    const rawValue = stake.mul(originalOdds).div(currentOdds);
    return rawValue.mul(1 - cashoutMargin).toDecimalPlaces(8);
  }

  /**
   * Calculate partial cash-out
   */
  static partialCashOutValue(
    stake: Decimal,
    originalOdds: Decimal,
    currentOdds: Decimal,
    percentage: number,
    cashoutMargin: number = 0.05
  ): { cashoutAmount: Decimal; remainingStake: Decimal } {
    const fullCashout = this.cashOutValue(stake, originalOdds, currentOdds, cashoutMargin);
    const cashoutAmount = fullCashout.mul(percentage / 100).toDecimalPlaces(8);
    const remainingStake = stake.mul(1 - percentage / 100).toDecimalPlaces(8);
    return { cashoutAmount, remainingStake };
  }

  /**
   * Convert decimal odds to fractional
   */
  static decimalToFractional(decimal: Decimal): string {
    const value = decimal.minus(1);
    // Find closest fraction
    const tolerance = 0.01;
    let bestNumerator = 1;
    let bestDenominator = 1;
    let bestError = Math.abs(value.toNumber() - 1);

    for (let d = 1; d <= 100; d++) {
      const n = Math.round(value.toNumber() * d);
      const error = Math.abs(value.toNumber() - n / d);
      if (error < bestError) {
        bestError = error;
        bestNumerator = n;
        bestDenominator = d;
      }
      if (error < tolerance) break;
    }

    // Simplify
    const gcd = this.gcd(bestNumerator, bestDenominator);
    return `${bestNumerator / gcd}/${bestDenominator / gcd}`;
  }

  /**
   * Convert decimal odds to American
   */
  static decimalToAmerican(decimal: Decimal): string {
    const value = decimal.toNumber();
    if (value >= 2) {
      return `+${Math.round((value - 1) * 100)}`;
    } else {
      return `${Math.round(-100 / (value - 1))}`;
    }
  }

  /**
   * Convert American odds to decimal
   */
  static americanToDecimal(american: number): Decimal {
    if (american > 0) {
      return new Decimal(american).div(100).plus(1).toDecimalPlaces(4);
    } else {
      return new Decimal(100).div(Math.abs(american)).plus(1).toDecimalPlaces(4);
    }
  }

  /**
   * Convert fractional odds to decimal
   */
  static fractionalToDecimal(numerator: number, denominator: number): Decimal {
    return new Decimal(numerator).div(denominator).plus(1).toDecimalPlaces(4);
  }

  /**
   * Format odds for display
   */
  static formatOdds(decimal: Decimal, format: OddsFormatType): string {
    switch (format) {
      case 'DECIMAL':
        return decimal.toFixed(2);
      case 'FRACTIONAL':
        return this.decimalToFractional(decimal);
      case 'AMERICAN':
        return this.decimalToAmerican(decimal);
      default:
        return decimal.toFixed(2);
    }
  }

  /**
   * Calculate implied probability from decimal odds
   */
  static impliedProbability(decimal: Decimal): Decimal {
    return new Decimal(1).div(decimal).toDecimalPlaces(6);
  }

  /**
   * Calculate overround (total margin) from a set of odds
   */
  static overround(odds: Decimal[]): Decimal {
    const totalProb = odds.reduce((acc, o) => acc.plus(new Decimal(1).div(o)), new Decimal(0));
    return totalProb.minus(1).mul(100).toDecimalPlaces(2);
  }

  /**
   * Calculate system bet combinations
   */
  static systemBetCombinations(numSelections: number, comboSize: number): number[][] {
    const combinations: number[][] = [];
    const combo: number[] = [];

    function generate(start: number, remaining: number) {
      if (remaining === 0) {
        combinations.push([...combo]);
        return;
      }
      for (let i = start; i <= numSelections - remaining; i++) {
        combo.push(i);
        generate(i + 1, remaining - 1);
        combo.pop();
      }
    }

    generate(0, comboSize);
    return combinations;
  }

  /**
   * Calculate system bet potential win
   */
  static systemBetPotentialWin(
    stake: Decimal,
    odds: Decimal[],
    comboSize: number
  ): { totalStake: Decimal; potentialWin: Decimal; combinations: number } {
    const combos = this.systemBetCombinations(odds.length, comboSize);
    const stakePerCombo = stake.div(combos.length);
    let totalWin = new Decimal(0);

    for (const combo of combos) {
      const comboOdds = combo.reduce((acc, idx) => acc.mul(odds[idx]), new Decimal(1));
      totalWin = totalWin.plus(stakePerCombo.mul(comboOdds));
    }

    return {
      totalStake: stakePerCombo.mul(combos.length),
      potentialWin: totalWin.toDecimalPlaces(8),
      combinations: combos.length,
    };
  }

  /**
   * Handle Asian handicap result
   */
  static asianHandicapResult(
    handicap: number,
    homeScore: number,
    awayScore: number,
    selection: 'home' | 'away'
  ): 'WIN' | 'LOSE' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSE' {
    const diff = selection === 'home' ? homeScore - awayScore : awayScore - homeScore;
    const adjustedDiff = diff + handicap;

    if (adjustedDiff > 0.5) return 'WIN';
    if (adjustedDiff < -0.5) return 'LOSE';
    if (adjustedDiff === 0) return 'PUSH';
    if (adjustedDiff === 0.25) return 'HALF_WIN';
    if (adjustedDiff === -0.25) return 'HALF_LOSE';
    if (adjustedDiff === 0.5) return 'WIN';
    if (adjustedDiff === -0.5) return 'LOSE';

    return adjustedDiff > 0 ? 'WIN' : 'LOSE';
  }

  private static gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      [a, b] = [b, a % b];
    }
    return a;
  }
}
