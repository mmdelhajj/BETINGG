import { describe, it, expect } from 'vitest';

// Test odds calculation logic (pure functions)
describe('Odds Engine', () => {
  // Utility functions for odds conversion
  const decimalToAmerican = (decimal: number): number => {
    if (decimal >= 2) return Math.round((decimal - 1) * 100);
    return Math.round(-100 / (decimal - 1));
  };

  const americanToDecimal = (american: number): number => {
    if (american > 0) return american / 100 + 1;
    return 100 / Math.abs(american) + 1;
  };

  const decimalToFractional = (decimal: number): string => {
    const numerator = decimal - 1;
    // Find close fraction
    const denominators = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 33, 40, 50, 100];
    let bestNum = 1, bestDen = 1, bestDiff = Infinity;
    for (const den of denominators) {
      const num = Math.round(numerator * den);
      const diff = Math.abs(num / den - numerator);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestNum = num;
        bestDen = den;
      }
    }
    return `${bestNum}/${bestDen}`;
  };

  const applyMargin = (trueProbability: number, margin: number): number => {
    const adjustedProb = trueProbability * (1 + margin / 100);
    return Math.round((1 / adjustedProb) * 100) / 100;
  };

  describe('Odds Conversion', () => {
    it('converts decimal to american (favorite)', () => {
      expect(decimalToAmerican(1.5)).toBe(-200);
      expect(decimalToAmerican(1.25)).toBe(-400);
      expect(decimalToAmerican(1.1)).toBe(-1000);
    });

    it('converts decimal to american (underdog)', () => {
      expect(decimalToAmerican(2.0)).toBe(100);
      expect(decimalToAmerican(3.0)).toBe(200);
      expect(decimalToAmerican(5.0)).toBe(400);
    });

    it('converts american to decimal', () => {
      expect(americanToDecimal(100)).toBe(2.0);
      expect(americanToDecimal(-200)).toBeCloseTo(1.5);
      expect(americanToDecimal(200)).toBe(3.0);
    });

    it('round-trips decimal → american → decimal', () => {
      const odds = [1.25, 1.5, 2.0, 3.0, 5.0, 10.0];
      for (const odd of odds) {
        const american = decimalToAmerican(odd);
        const backToDecimal = americanToDecimal(american);
        expect(backToDecimal).toBeCloseTo(odd, 1);
      }
    });

    it('converts decimal to fractional', () => {
      expect(decimalToFractional(2.0)).toBe('1/1');
      expect(decimalToFractional(3.0)).toBe('2/1');
      expect(decimalToFractional(1.5)).toBe('1/2');
    });
  });

  describe('Margin Application', () => {
    it('applies margin to true probability', () => {
      // True 50% with 5% margin
      const odds = applyMargin(0.5, 5);
      expect(odds).toBeLessThan(2.0); // Should be lower than true odds
      expect(odds).toBeGreaterThan(1.0);
    });

    it('higher margin = lower odds', () => {
      const odds5 = applyMargin(0.5, 5);
      const odds10 = applyMargin(0.5, 10);
      expect(odds10).toBeLessThan(odds5);
    });

    it('zero margin = true odds', () => {
      const odds = applyMargin(0.5, 0);
      expect(odds).toBe(2.0);
    });
  });

  describe('Parlay Calculation', () => {
    it('calculates combined odds for parlay', () => {
      const selections = [1.5, 2.0, 3.0];
      const combinedOdds = selections.reduce((acc, odds) => acc * odds, 1);
      expect(combinedOdds).toBe(9.0);
    });

    it('calculates potential win for parlay', () => {
      const stake = 100;
      const odds = [1.5, 2.0];
      const combinedOdds = odds.reduce((acc, o) => acc * o, 1);
      const potentialWin = stake * combinedOdds;
      expect(potentialWin).toBe(300);
    });
  });

  describe('Cash Out Calculation', () => {
    it('calculates cash out value', () => {
      const originalStake = 100;
      const originalOdds = 3.0;
      const currentOdds = 2.0;

      // Simple cash out: (original odds / current odds) * stake * margin
      const cashOutMargin = 0.95; // 5% margin on cash out
      const cashOutValue = (originalOdds / currentOdds) * originalStake * cashOutMargin;
      expect(cashOutValue).toBeCloseTo(142.5);
    });

    it('cash out value decreases as odds move against', () => {
      const stake = 100;
      const originalOdds = 3.0;

      const cashout1 = (originalOdds / 2.0) * stake * 0.95; // Odds moved in favor
      const cashout2 = (originalOdds / 5.0) * stake * 0.95; // Odds moved against

      expect(cashout1).toBeGreaterThan(cashout2);
    });
  });
});
