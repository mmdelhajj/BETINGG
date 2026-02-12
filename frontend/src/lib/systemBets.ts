import Decimal from 'decimal.js';
import type { BetSlipItem } from '@/types';

// ─── System Bet Type Definitions ─────────────────────────────────

export interface SystemBetType {
  key: string;
  name: string;
  selections: number;
  bets: number;
  description: string;
  minWinners: number;
  includesSingles: boolean;
}

const SYSTEM_BETS: Record<string, SystemBetType> = {
  trixie: {
    key: 'trixie',
    name: 'Trixie',
    selections: 3,
    bets: 4,
    description: '3 doubles + 1 treble',
    minWinners: 2,
    includesSingles: false,
  },
  patent: {
    key: 'patent',
    name: 'Patent',
    selections: 3,
    bets: 7,
    description: '3 singles + 3 doubles + 1 treble',
    minWinners: 1,
    includesSingles: true,
  },
  yankee: {
    key: 'yankee',
    name: 'Yankee',
    selections: 4,
    bets: 11,
    description: '6 doubles + 4 trebles + 1 fourfold',
    minWinners: 2,
    includesSingles: false,
  },
  lucky15: {
    key: 'lucky15',
    name: 'Lucky 15',
    selections: 4,
    bets: 15,
    description: '4 singles + 6 doubles + 4 trebles + 1 fourfold',
    minWinners: 1,
    includesSingles: true,
  },
  canadian: {
    key: 'canadian',
    name: 'Canadian',
    selections: 5,
    bets: 26,
    description: '10 doubles + 10 trebles + 5 fourfolds + 1 fivefold',
    minWinners: 2,
    includesSingles: false,
  },
  lucky31: {
    key: 'lucky31',
    name: 'Lucky 31',
    selections: 5,
    bets: 31,
    description: '5 singles + 10 doubles + 10 trebles + 5 fourfolds + 1 fivefold',
    minWinners: 1,
    includesSingles: true,
  },
  heinz: {
    key: 'heinz',
    name: 'Heinz',
    selections: 6,
    bets: 57,
    description: '15 doubles + 20 trebles + 15 fourfolds + 6 fivefolds + 1 sixfold',
    minWinners: 2,
    includesSingles: false,
  },
  lucky63: {
    key: 'lucky63',
    name: 'Lucky 63',
    selections: 6,
    bets: 63,
    description: '6 singles + 15 doubles + 20 trebles + 15 fourfolds + 6 fivefolds + 1 sixfold',
    minWinners: 1,
    includesSingles: true,
  },
  superheinz: {
    key: 'superheinz',
    name: 'Super Heinz',
    selections: 7,
    bets: 120,
    description: '21 doubles + 35 trebles + 35 fourfolds + 21 fivefolds + 7 sixfolds + 1 sevenfold',
    minWinners: 2,
    includesSingles: false,
  },
  goliath: {
    key: 'goliath',
    name: 'Goliath',
    selections: 8,
    bets: 247,
    description: '28 doubles + 56 trebles + 70 fourfolds + 56 fivefolds + 28 sixfolds + 8 sevenfolds + 1 eightfold',
    minWinners: 2,
    includesSingles: false,
  },
};

// ─── Combination Utilities ───────────────────────────────────────

/**
 * Generate all combinations of `size` items from the given array.
 */
export function getCombinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  function backtrack(start: number, current: T[]) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}

/**
 * Calculate the number of combinations (n choose k).
 */
function nChooseK(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

// ─── System Bet Calculations ─────────────────────────────────────

/**
 * Get the minimum combo size for a system bet type.
 * For types that include singles, the min combo size is 1; otherwise 2.
 */
function getMinComboSize(systemType: string): number {
  const bet = SYSTEM_BETS[systemType];
  if (!bet) return 2;
  return bet.includesSingles ? 1 : 2;
}

/**
 * Get all combo sizes used in a particular system bet type.
 */
function getComboSizesForSystemType(systemType: string): number[] {
  const bet = SYSTEM_BETS[systemType];
  if (!bet) return [];
  const min = getMinComboSize(systemType);
  const sizes: number[] = [];
  for (let s = min; s <= bet.selections; s++) {
    sizes.push(s);
  }
  return sizes;
}

/**
 * Calculate the total number of individual bets in a system bet.
 */
export function getSystemBetCount(systemType: string): number {
  const bet = SYSTEM_BETS[systemType];
  if (!bet) return 0;
  return bet.bets;
}

/**
 * Calculate the maximum potential win for a system bet.
 * Assumes all selections win.
 */
export function calculateSystemBetWin(
  selections: BetSlipItem[],
  systemType: string,
  stakePerBet: string
): string {
  const bet = SYSTEM_BETS[systemType];
  if (!bet || selections.length !== bet.selections) return '0.00';

  const stakeDecimal = new Decimal(stakePerBet);
  const comboSizes = getComboSizesForSystemType(systemType);
  let totalWin = new Decimal(0);

  for (const size of comboSizes) {
    const combos = getCombinations(selections, size);
    for (const combo of combos) {
      const comboOdds = combo.reduce(
        (acc, item) => acc.mul(new Decimal(item.odds)),
        new Decimal(1)
      );
      totalWin = totalWin.plus(stakeDecimal.mul(comboOdds));
    }
  }

  return totalWin.toFixed(2);
}

/**
 * Get the total stake for a system bet (stakePerBet * numberOfBets).
 */
export function getSystemTotalStake(systemType: string, stakePerBet: string): string {
  const count = getSystemBetCount(systemType);
  if (count === 0) return '0.00';
  return new Decimal(stakePerBet).mul(count).toFixed(2);
}

/**
 * Get all available system bet types based on the number of selections.
 */
export function getAvailableSystemBets(selectionCount: number): SystemBetType[] {
  return Object.values(SYSTEM_BETS).filter(
    (bet) => bet.selections === selectionCount
  );
}

/**
 * Get a specific system bet type definition by key.
 */
export function getSystemBetDef(key: string): SystemBetType | undefined {
  return SYSTEM_BETS[key];
}

/**
 * Get all system bet type definitions.
 */
export function getAllSystemBetTypes(): SystemBetType[] {
  return Object.values(SYSTEM_BETS);
}

/**
 * Build the combinations breakdown for display
 * (e.g. "6 doubles, 4 trebles, 1 fourfold")
 */
export function getSystemBetBreakdown(
  selectionCount: number,
  systemType: string
): Array<{ size: number; count: number; label: string }> {
  const bet = SYSTEM_BETS[systemType];
  if (!bet || selectionCount !== bet.selections) return [];

  const labels: Record<number, string> = {
    1: 'singles',
    2: 'doubles',
    3: 'trebles',
    4: 'fourfolds',
    5: 'fivefolds',
    6: 'sixfolds',
    7: 'sevenfolds',
    8: 'eightfolds',
  };

  const comboSizes = getComboSizesForSystemType(systemType);
  return comboSizes.map((size) => ({
    size,
    count: nChooseK(selectionCount, size),
    label: labels[size] || `${size}-folds`,
  }));
}
