import { BaseGame } from './BaseGame.js';
import { diceGame } from '../../modules/casino/games/dice/dice.service.js';
import { minesGame } from '../../modules/casino/games/mines/mines.service.js';
import { plinkoGame } from '../../modules/casino/games/plinko/plinko.service.js';
import { coinflipGame } from '../../modules/casino/games/coinflip/coinflip.service.js';
import { rouletteGame } from '../../modules/casino/games/roulette/roulette.service.js';
import { blackjackGame } from '../../modules/casino/games/blackjack/blackjack.service.js';
import { hiLoGame } from '../../modules/casino/games/hilo/hilo.service.js';
import { wheelGame } from '../../modules/casino/games/wheel/wheel.service.js';
import { towerGame } from '../../modules/casino/games/tower/tower.service.js';
import { limboGame } from '../../modules/casino/games/limbo/limbo.service.js';
import { kenoGame } from '../../modules/casino/games/keno/keno.service.js';
import { videoPokerGame } from '../../modules/casino/games/videopoker/videopoker.service.js';
import { baccaratGame } from '../../modules/casino/games/baccarat/baccarat.service.js';
import { slotsGame } from '../../modules/casino/games/slots/slots.service.js';

// ---------------------------------------------------------------------------
// Game Registry
// ---------------------------------------------------------------------------
// Central registry of all casino games. Stateful games (crash, mines,
// blackjack, hilo, tower, video-poker) have their own action endpoints;
// they are still registered here so the catalog and generic play endpoint
// can find them.
// ---------------------------------------------------------------------------

class GameRegistry {
  private games = new Map<string, BaseGame>();

  constructor() {
    this.register(diceGame);
    this.register(minesGame);
    this.register(plinkoGame);
    this.register(coinflipGame);
    this.register(rouletteGame);
    this.register(blackjackGame);
    this.register(hiLoGame);
    this.register(wheelGame);
    this.register(towerGame);
    this.register(limboGame);
    this.register(kenoGame);
    this.register(videoPokerGame);
    this.register(baccaratGame);
    this.register(slotsGame);
  }

  register(game: BaseGame): void {
    this.games.set(game.slug, game);
  }

  get(slug: string): BaseGame | undefined {
    return this.games.get(slug);
  }

  getAll(): BaseGame[] {
    return Array.from(this.games.values());
  }

  /**
   * Return game catalog data suitable for the /games endpoint.
   */
  getCatalog(): Array<{
    name: string;
    slug: string;
    houseEdge: number;
    minBet: number;
    maxBet: number;
    type: string;
  }> {
    return this.getAll().map((g) => ({
      name: g.name,
      slug: g.slug,
      houseEdge: g.houseEdge,
      minBet: g.minBet,
      maxBet: g.maxBet,
      type: this.inferType(g.slug),
    }));
  }

  private inferType(slug: string): string {
    const table = ['blackjack', 'roulette', 'baccarat', 'video-poker'];
    if (table.includes(slug)) return 'table';
    const slots = ['slots'];
    if (slots.includes(slug)) return 'slot';
    return 'original';
  }
}

export const gameRegistry = new GameRegistry();
export default gameRegistry;
