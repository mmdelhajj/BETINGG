import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Case Opening Game (CS:GO Style)
// ---------------------------------------------------------------------------
// Player selects a case tier (bronze/silver/gold/diamond). Each case has a
// fixed price and contains ~15 items with weighted probabilities across
// 6 rarity tiers. A provably fair random value selects the winning item.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CaseType = 'bronze' | 'silver' | 'gold' | 'diamond';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

interface CaseItem {
  name: string;
  rarity: Rarity;
  multiplier: number; // payout = casePrice * multiplier
  weight: number;     // probability weight (summed for the tier)
}

interface CaseDefinition {
  type: CaseType;
  price: number;
  label: string;
  color: string;
  items: CaseItem[];
}

export interface CaseOpeningOptions {
  caseType: CaseType;
}

// ---------------------------------------------------------------------------
// Rarity colours (for frontend reference embedded in result)
// ---------------------------------------------------------------------------

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9CA3AF',    // gray
  uncommon: '#10B981',  // green
  rare: '#3B82F6',      // blue
  epic: '#8B5CF6',      // purple
  legendary: '#F59E0B', // gold
  mythic: '#EF4444',    // red
};

// ---------------------------------------------------------------------------
// Case Definitions
// ---------------------------------------------------------------------------

const CASES: Record<CaseType, CaseDefinition> = {
  bronze: {
    type: 'bronze',
    price: 1,
    label: 'Bronze Case',
    color: '#CD7F32',
    items: [
      { name: 'Rusty Knife',        rarity: 'common',    multiplier: 0.10, weight: 1200 },
      { name: 'Worn Gloves',        rarity: 'common',    multiplier: 0.20, weight: 1100 },
      { name: 'Basic Sticker',      rarity: 'common',    multiplier: 0.30, weight: 1000 },
      { name: 'Scratched Pistol',   rarity: 'common',    multiplier: 0.40, weight: 900 },
      { name: 'Faded Dog Tag',      rarity: 'common',    multiplier: 0.50, weight: 800 },
      { name: 'Green Camo Skin',    rarity: 'uncommon',  multiplier: 0.75, weight: 700 },
      { name: 'Blue Spray',         rarity: 'uncommon',  multiplier: 1.00, weight: 650 },
      { name: 'Desert Eagle Sand',  rarity: 'uncommon',  multiplier: 1.20, weight: 600 },
      { name: 'Chrome Lighter',     rarity: 'uncommon',  multiplier: 1.50, weight: 550 },
      { name: 'Silver Ring',        rarity: 'rare',      multiplier: 1.80, weight: 500 },
      { name: 'Tactical Scope',     rarity: 'rare',      multiplier: 2.00, weight: 400 },
      { name: 'Neon Keychain',      rarity: 'rare',      multiplier: 2.50, weight: 300 },
      { name: 'Mini Dragon',        rarity: 'epic',      multiplier: 3.00, weight: 200 },
      { name: 'Golden Bullet',      rarity: 'legendary', multiplier: 4.00, weight: 75 },
      { name: 'Phoenix Emblem',     rarity: 'mythic',    multiplier: 5.00, weight: 25 },
    ],
  },
  silver: {
    type: 'silver',
    price: 5,
    label: 'Silver Case',
    color: '#C0C0C0',
    items: [
      { name: 'Steel Baton',        rarity: 'common',    multiplier: 0.10, weight: 1100 },
      { name: 'Field Dressing',     rarity: 'common',    multiplier: 0.20, weight: 1000 },
      { name: 'Canvas Holster',     rarity: 'common',    multiplier: 0.30, weight: 950 },
      { name: 'Iron Sights',        rarity: 'common',    multiplier: 0.50, weight: 900 },
      { name: 'Urban Camo Wrap',    rarity: 'common',    multiplier: 0.60, weight: 850 },
      { name: 'Blue Tiger Grip',    rarity: 'uncommon',  multiplier: 1.00, weight: 700 },
      { name: 'Red Dot Module',     rarity: 'uncommon',  multiplier: 1.50, weight: 600 },
      { name: 'Stealth Blade',      rarity: 'uncommon',  multiplier: 2.00, weight: 500 },
      { name: 'Digital Forest Skin',rarity: 'uncommon',  multiplier: 2.50, weight: 450 },
      { name: 'Crimson Bandana',    rarity: 'rare',      multiplier: 3.00, weight: 400 },
      { name: 'Arctic Sniper Wrap', rarity: 'rare',      multiplier: 4.00, weight: 350 },
      { name: 'Gold Plated AK',     rarity: 'rare',      multiplier: 5.00, weight: 250 },
      { name: 'Dragon Lore Mini',   rarity: 'epic',      multiplier: 6.00, weight: 150 },
      { name: 'Sapphire Karambit',  rarity: 'legendary', multiplier: 8.00, weight: 75 },
      { name: 'Howl Souvenir',      rarity: 'mythic',    multiplier: 10.00, weight: 25 },
    ],
  },
  gold: {
    type: 'gold',
    price: 25,
    label: 'Gold Case',
    color: '#FFD700',
    items: [
      { name: 'Brass Knuckles',     rarity: 'common',    multiplier: 0.10, weight: 1000 },
      { name: 'Gilded Scope',       rarity: 'common',    multiplier: 0.20, weight: 950 },
      { name: 'Amber Flask',        rarity: 'common',    multiplier: 0.30, weight: 900 },
      { name: 'Topaz Amulet',       rarity: 'common',    multiplier: 0.50, weight: 850 },
      { name: 'Golden Thread',      rarity: 'common',    multiplier: 0.75, weight: 800 },
      { name: 'Fire Opal Grip',     rarity: 'uncommon',  multiplier: 1.00, weight: 700 },
      { name: 'Solar Flare Wrap',   rarity: 'uncommon',  multiplier: 1.50, weight: 600 },
      { name: 'Kings Crown',        rarity: 'uncommon',  multiplier: 2.00, weight: 500 },
      { name: 'Midas Touch Skin',   rarity: 'uncommon',  multiplier: 3.00, weight: 450 },
      { name: 'Emerald Bayonet',    rarity: 'rare',      multiplier: 4.00, weight: 400 },
      { name: 'Ruby Encrusted SMG', rarity: 'rare',      multiplier: 6.00, weight: 300 },
      { name: 'Obsidian Dagger',    rarity: 'rare',      multiplier: 8.00, weight: 200 },
      { name: 'Diamond AWP',        rarity: 'epic',      multiplier: 12.00, weight: 120 },
      { name: 'Volcanic Butterfly', rarity: 'legendary', multiplier: 15.00, weight: 55 },
      { name: 'Excalibur Blade',    rarity: 'mythic',    multiplier: 20.00, weight: 25 },
    ],
  },
  diamond: {
    type: 'diamond',
    price: 100,
    label: 'Diamond Case',
    color: '#B9F2FF',
    items: [
      { name: 'Crystal Shard',       rarity: 'common',    multiplier: 0.10, weight: 950 },
      { name: 'Frost Bitten Grip',   rarity: 'common',    multiplier: 0.20, weight: 900 },
      { name: 'Platinum Chain',      rarity: 'common',    multiplier: 0.30, weight: 850 },
      { name: 'Ice Core Fragment',   rarity: 'common',    multiplier: 0.50, weight: 800 },
      { name: 'Silver Phantom Wrap', rarity: 'common',    multiplier: 0.75, weight: 750 },
      { name: 'Celestial Orb',       rarity: 'uncommon',  multiplier: 1.00, weight: 650 },
      { name: 'Nebula Spray',        rarity: 'uncommon',  multiplier: 2.00, weight: 550 },
      { name: 'Aurora Skin',         rarity: 'uncommon',  multiplier: 3.00, weight: 500 },
      { name: 'Void Walker Blade',   rarity: 'uncommon',  multiplier: 5.00, weight: 400 },
      { name: 'Starfall Karambit',   rarity: 'rare',      multiplier: 8.00, weight: 350 },
      { name: 'Comet Trail AWP',     rarity: 'rare',      multiplier: 15.00, weight: 250 },
      { name: 'Galactic M4A4',       rarity: 'rare',      multiplier: 25.00, weight: 150 },
      { name: 'Supernova Butterfly', rarity: 'epic',      multiplier: 50.00, weight: 100 },
      { name: 'Black Hole Dragon',   rarity: 'legendary', multiplier: 75.00, weight: 50 },
      { name: 'Cosmic Annihilator',  rarity: 'mythic',    multiplier: 100.00, weight: 25 },
    ],
  },
};

// Valid case types for validation
const VALID_CASE_TYPES: CaseType[] = ['bronze', 'silver', 'gold', 'diamond'];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CaseOpeningGame extends BaseGame {
  readonly name = 'Case Opening';
  readonly slug = 'caseopening';
  readonly houseEdge = 0.05; // ~5% built into prize weights
  readonly minBet = 0.0001;  // minimum case price (bronze)
  readonly maxBet = 100;     // maximum case price (diamond)

  /**
   * Get case definitions (useful for frontend catalog display).
   */
  static getCases(): Record<CaseType, CaseDefinition> {
    return CASES;
  }

  /**
   * Get rarity color map.
   */
  static getRarityColors(): Record<Rarity, string> {
    return RARITY_COLORS;
  }

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as CaseOpeningOptions | undefined;

    // --- Validate options ---
    if (!options || !options.caseType) {
      throw new GameError(
        'INVALID_OPTIONS',
        'Must provide caseType: "bronze", "silver", "gold", or "diamond".',
      );
    }

    const caseType = options.caseType.toLowerCase() as CaseType;
    if (!VALID_CASE_TYPES.includes(caseType)) {
      throw new GameError(
        'INVALID_CASE_TYPE',
        'caseType must be "bronze", "silver", "gold", or "diamond".',
      );
    }

    const caseDef = CASES[caseType];
    const casePrice = caseDef.price;

    // Override bet amount with the case price (ignore user-supplied amount)
    const betAmount = casePrice;

    // --- Validate bet (uses case price) ---
    await this.validateBet(userId, betAmount, bet.currency);

    // --- Get provably fair seeds ---
    const seeds = await this.getUserSeeds(userId);

    // --- Generate provably fair result ---
    const rawResult = this.fairService.generateResult(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce,
    );

    // --- Determine winning item ---
    const totalWeight = caseDef.items.reduce((sum, item) => sum + item.weight, 0);
    const roll = rawResult * totalWeight;

    let cumulative = 0;
    let winningIndex = 0;
    let winningItem = caseDef.items[0];

    for (let i = 0; i < caseDef.items.length; i++) {
      cumulative += caseDef.items[i].weight;
      if (roll < cumulative) {
        winningIndex = i;
        winningItem = caseDef.items[i];
        break;
      }
    }

    // --- Calculate payout ---
    const payout = Math.floor(betAmount * winningItem.multiplier * 100000000) / 100000000;
    const multiplier = winningItem.multiplier;

    // --- Deduct balance ---
    await this.deductBalance(userId, betAmount, bet.currency);

    // --- Credit winnings (even small amounts) ---
    if (payout > 0) {
      await this.creditWinnings(userId, payout, bet.currency);
    }

    // --- Increment nonce ---
    await this.incrementNonce(userId);

    // --- Build items list for the reel display (with rarity colors) ---
    const itemsForDisplay = caseDef.items.map((item, idx) => ({
      name: item.name,
      rarity: item.rarity,
      multiplier: item.multiplier,
      value: Math.floor(betAmount * item.multiplier * 100) / 100,
      color: RARITY_COLORS[item.rarity],
      isWinner: idx === winningIndex,
    }));

    // --- Record round ---
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount,
      payout,
      multiplier,
      result: {
        caseType,
        winningItem: {
          name: winningItem.name,
          rarity: winningItem.rarity,
          multiplier: winningItem.multiplier,
          value: payout,
          color: RARITY_COLORS[winningItem.rarity],
        },
        spinIndex: winningIndex,
        items: itemsForDisplay,
        payout,
      },
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    // --- Fetch updated balance ---
    const newBalance = await this.getBalance(userId, bet.currency);

    return {
      roundId,
      game: this.slug,
      betAmount,
      payout,
      profit: payout - betAmount,
      multiplier,
      result: {
        caseType,
        casePrice: betAmount,
        caseLabel: caseDef.label,
        caseColor: caseDef.color,
        items: itemsForDisplay,
        winningItem: {
          name: winningItem.name,
          rarity: winningItem.rarity,
          multiplier: winningItem.multiplier,
          value: payout,
          color: RARITY_COLORS[winningItem.rarity],
        },
        spinIndex: winningIndex,
        payout,
      },
      fairness: {
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.nonce,
      },
      newBalance,
    };
  }
}

export const caseOpeningGame = new CaseOpeningGame();
export default caseOpeningGame;
