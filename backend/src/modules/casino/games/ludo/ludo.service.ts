import { BaseGame, GameError, type GameResult, type BetRequest } from '../../../../services/casino/BaseGame.js';
import { prisma } from '../../../../lib/prisma.js';
import { redis } from '../../../../lib/redis.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LudoOptions {
  action: 'start' | 'roll' | 'move';
  roundId?: string;
  tokenIndex?: 0 | 1 | 2 | 3;
  autoPlay?: boolean;
}

interface TokenState {
  /** Position on the board: -1 = home base, 0-51 = board squares, 52-56 = home stretch, 57 = finished */
  position: number;
}

interface LudoGameState {
  roundId: string;
  userId: string;
  betAmount: number;
  currency: string;
  playerTokens: TokenState[];
  houseTokens: TokenState[];
  currentTurn: 'player' | 'house';
  diceRoll: number | null;
  isGameOver: boolean;
  winner: 'player' | 'house' | null;
  moveHistory: Array<{
    turn: 'player' | 'house';
    dice: number;
    tokenIndex: number;
    from: number;
    to: number;
    captured: boolean;
  }>;
  rollCount: number;
  captures: { player: number; house: number };
  awaitingMove: boolean;
  movableTokens: number[];
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  rollNonce: number; // sub-nonce for each roll within the game
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOARD_SIZE = 52;
const HOME_STRETCH_SIZE = 5; // positions 52-56
const FINISHED_POS = 57;
const HOME_BASE = -1;
const PLAYER_START = 0;
const HOUSE_START = 26; // House starts halfway around the board
const PLAYER_HOME_ENTRY = 51; // Player enters home stretch after position 51
const HOUSE_HOME_ENTRY = 25; // House enters home stretch after position 25 (relative)
const WIN_MULTIPLIER = 2.5;
const REDIS_PREFIX = 'ludo:game:';
const GAME_TTL = 3600; // 1 hour

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get the absolute board position for a house token.
 * House tokens start at position 26 and wrap around.
 */
function getHouseAbsolutePos(relativePos: number): number {
  if (relativePos < 0 || relativePos >= BOARD_SIZE + HOME_STRETCH_SIZE + 1) return relativePos;
  if (relativePos >= BOARD_SIZE) return relativePos; // home stretch, uses separate logic
  return (relativePos + HOUSE_START) % BOARD_SIZE;
}

/**
 * Check if a token can move given a dice roll.
 */
function canTokenMove(
  token: TokenState,
  dice: number,
  isPlayer: boolean,
  allFriendlyTokens: TokenState[],
): boolean {
  // Already finished
  if (token.position === FINISHED_POS) return false;

  // In home base - need a 6 to come out
  if (token.position === HOME_BASE) {
    return dice === 6;
  }

  const newPos = token.position + dice;

  // Check if moving into home stretch or finishing
  const entryPoint = isPlayer ? PLAYER_HOME_ENTRY : HOUSE_HOME_ENTRY;
  if (token.position <= entryPoint && token.position + dice > entryPoint) {
    // Entering home stretch
    const stepsIntoHome = (token.position + dice) - entryPoint - 1;
    const homePos = BOARD_SIZE + stepsIntoHome;
    if (homePos > FINISHED_POS) return false; // Overshoot
    return true;
  }

  // Regular move on the board
  if (token.position < BOARD_SIZE) {
    const targetPos = newPos >= BOARD_SIZE ? newPos - BOARD_SIZE : newPos;
    // Don't land on own token
    const landOnOwn = allFriendlyTokens.some(
      (t) => t.position >= 0 && t.position < BOARD_SIZE && t.position === targetPos && t !== token,
    );
    if (landOnOwn) return false;
    return true;
  }

  // In home stretch
  if (token.position >= BOARD_SIZE && token.position < FINISHED_POS) {
    const targetPos = token.position + dice;
    if (targetPos > FINISHED_POS) return false; // Overshoot
    return true;
  }

  return false;
}

/**
 * Move a token and handle captures.
 */
function moveToken(
  token: TokenState,
  dice: number,
  isPlayer: boolean,
  enemyTokens: TokenState[],
): { newPosition: number; captured: boolean } {
  if (token.position === HOME_BASE) {
    // Come out to start position
    const startPos = isPlayer ? PLAYER_START : 0; // Relative position for house is 0
    // Check for capture at start
    let captured = false;
    for (const enemy of enemyTokens) {
      const enemyAbsPos = isPlayer
        ? getHouseAbsolutePos(enemy.position)
        : enemy.position;
      const myAbsPos = isPlayer ? startPos : getHouseAbsolutePos(0);

      if (enemy.position >= 0 && enemy.position < BOARD_SIZE && enemyAbsPos === myAbsPos) {
        enemy.position = HOME_BASE;
        captured = true;
      }
    }
    return { newPosition: isPlayer ? PLAYER_START : 0, captured };
  }

  const entryPoint = isPlayer ? PLAYER_HOME_ENTRY : HOUSE_HOME_ENTRY;

  // Check if entering home stretch
  if (token.position < BOARD_SIZE && token.position <= entryPoint && token.position + dice > entryPoint) {
    const stepsIntoHome = (token.position + dice) - entryPoint - 1;
    const homePos = BOARD_SIZE + stepsIntoHome;
    return { newPosition: Math.min(homePos, FINISHED_POS), captured: false };
  }

  // In home stretch already
  if (token.position >= BOARD_SIZE) {
    const newPos = Math.min(token.position + dice, FINISHED_POS);
    return { newPosition: newPos, captured: false };
  }

  // Regular board move
  let newPos = (token.position + dice) % BOARD_SIZE;

  // Check for capture
  let captured = false;
  const myAbsPos = isPlayer ? newPos : getHouseAbsolutePos(newPos);

  for (const enemy of enemyTokens) {
    if (enemy.position < 0 || enemy.position >= BOARD_SIZE) continue;
    const enemyAbsPos = isPlayer
      ? getHouseAbsolutePos(enemy.position)
      : enemy.position;

    if (enemyAbsPos === myAbsPos) {
      enemy.position = HOME_BASE;
      captured = true;
    }
  }

  return { newPosition: newPos, captured };
}

/**
 * Find the best token to move (simple AI).
 * Priority: capture > enter home > advance furthest token > leave base.
 */
function findBestMove(
  tokens: TokenState[],
  dice: number,
  isPlayer: boolean,
  enemyTokens: TokenState[],
): number {
  const movable: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (canTokenMove(tokens[i], dice, isPlayer, tokens)) {
      movable.push(i);
    }
  }

  if (movable.length === 0) return -1;
  if (movable.length === 1) return movable[0];

  // Score each movable token
  let bestIndex = movable[0];
  let bestScore = -Infinity;

  for (const idx of movable) {
    let score = 0;
    const token = tokens[idx];

    // Simulate move to check for capture
    const entryPoint = isPlayer ? PLAYER_HOME_ENTRY : HOUSE_HOME_ENTRY;

    if (token.position === HOME_BASE && dice === 6) {
      score += 5; // Leaving base is good
    } else if (token.position >= BOARD_SIZE) {
      // In home stretch - getting closer to finish
      const newPos = Math.min(token.position + dice, FINISHED_POS);
      if (newPos === FINISHED_POS) score += 100; // Finishing a token is best
      else score += 20;
    } else if (
      token.position <= entryPoint &&
      token.position + dice > entryPoint
    ) {
      // Entering home stretch
      score += 50;
    } else {
      // Regular move - check for potential capture
      const newPos = (token.position + dice) % BOARD_SIZE;
      const myAbsPos = isPlayer ? newPos : getHouseAbsolutePos(newPos);

      for (const enemy of enemyTokens) {
        if (enemy.position < 0 || enemy.position >= BOARD_SIZE) continue;
        const enemyAbsPos = isPlayer
          ? getHouseAbsolutePos(enemy.position)
          : enemy.position;
        if (enemyAbsPos === myAbsPos) {
          score += 30; // Capture is very good
        }
      }

      // Prefer advancing tokens that are further along
      score += token.position;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  return bestIndex;
}

/**
 * Check if all tokens have finished.
 */
function allTokensFinished(tokens: TokenState[]): boolean {
  return tokens.every((t) => t.position === FINISHED_POS);
}

/**
 * Get list of movable token indices.
 */
function getMovableTokens(
  tokens: TokenState[],
  dice: number,
  isPlayer: boolean,
): number[] {
  const movable: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (canTokenMove(tokens[i], dice, isPlayer, tokens)) {
      movable.push(i);
    }
  }
  return movable;
}

// ---------------------------------------------------------------------------
// LudoGame
// ---------------------------------------------------------------------------

export class LudoGame extends BaseGame {
  readonly name = 'Ludo';
  readonly slug = 'ludo';
  readonly houseEdge = 0.05; // Implied via win multiplier being 2.5x vs 50/50 odds
  readonly minBet = 0.0001;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const { amount, currency, options } = bet;
    const opts = options as LudoOptions | undefined;

    if (!opts || !opts.action) {
      throw new GameError('INVALID_OPTIONS', 'Must provide action: "start", "roll", or "move".');
    }

    switch (opts.action) {
      case 'start':
        return this.startGame(userId, amount, currency, opts.autoPlay);
      case 'roll':
        return this.rollDice(userId, currency, opts.roundId, opts.autoPlay);
      case 'move':
        return this.moveTokenAction(userId, currency, opts.roundId, opts.tokenIndex, opts.autoPlay);
      default:
        throw new GameError('INVALID_ACTION', 'Action must be "start", "roll", or "move".');
    }
  }

  // ---------------------------------------------------------------------------
  // Start a new game
  // ---------------------------------------------------------------------------

  private async startGame(
    userId: string,
    amount: number,
    currency: string,
    autoPlay?: boolean,
  ): Promise<GameResult> {
    await this.validateBet(userId, amount, currency);

    // Get provably fair seeds
    const seeds = await this.getUserSeeds(userId);
    const { serverSeed, serverSeedHash, clientSeed, nonce } = seeds;

    // Deduct bet
    await this.deductBalance(userId, amount, currency);

    // Create initial game state
    const roundId = `ludo-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const state: LudoGameState = {
      roundId,
      userId,
      betAmount: amount,
      currency,
      playerTokens: [
        { position: HOME_BASE },
        { position: HOME_BASE },
        { position: HOME_BASE },
        { position: HOME_BASE },
      ],
      houseTokens: [
        { position: HOME_BASE },
        { position: HOME_BASE },
        { position: HOME_BASE },
        { position: HOME_BASE },
      ],
      currentTurn: 'player',
      diceRoll: null,
      isGameOver: false,
      winner: null,
      moveHistory: [],
      rollCount: 0,
      captures: { player: 0, house: 0 },
      awaitingMove: false,
      movableTokens: [],
      serverSeedHash,
      clientSeed,
      nonce,
      rollNonce: 0,
    };

    // Store state in Redis
    await redis.set(
      `${REDIS_PREFIX}${roundId}`,
      JSON.stringify(state),
      'EX',
      GAME_TTL,
    );

    // Also store reference by userId for lookup
    await redis.set(`${REDIS_PREFIX}user:${userId}`, roundId, 'EX', GAME_TTL);

    const newBalance = await this.getBalance(userId, currency);

    // If auto-play, run the entire game
    if (autoPlay) {
      return this.runAutoPlay(state);
    }

    return {
      roundId,
      game: this.slug,
      betAmount: amount,
      payout: 0,
      profit: -amount,
      multiplier: 0,
      result: {
        playerTokens: state.playerTokens.map((t) => t.position),
        houseTokens: state.houseTokens.map((t) => t.position),
        diceRoll: null,
        currentTurn: 'player',
        isGameOver: false,
        winner: null,
        movableTokens: [],
        awaitingMove: false,
        payout: 0,
        rollCount: 0,
        captures: state.captures,
        moveHistory: [],
      },
      fairness: {
        serverSeedHash,
        clientSeed,
        nonce,
      },
      newBalance,
    };
  }

  // ---------------------------------------------------------------------------
  // Roll dice
  // ---------------------------------------------------------------------------

  private async rollDice(
    userId: string,
    currency: string,
    roundId?: string,
    autoPlay?: boolean,
  ): Promise<GameResult> {
    if (!roundId) {
      throw new GameError('MISSING_ROUND_ID', 'Must provide roundId for roll action.');
    }

    const state = await this.loadState(roundId, userId);

    if (state.isGameOver) {
      throw new GameError('GAME_OVER', 'This game is already finished.');
    }

    if (state.awaitingMove) {
      throw new GameError('AWAITING_MOVE', 'You must move a token before rolling again.');
    }

    // Generate provably fair dice roll (1-6)
    // Use sub-nonce for multiple rolls within the same game
    const seeds = await this.getUserSeeds(userId);
    const pfResult = this.fairService.generateResult(
      seeds.serverSeed,
      seeds.clientSeed,
      seeds.nonce * 1000 + state.rollNonce,
    );
    const diceRoll = Math.floor(pfResult * 6) + 1;
    state.diceRoll = diceRoll;
    state.rollNonce++;
    state.rollCount++;

    const isPlayerTurn = state.currentTurn === 'player';
    const tokens = isPlayerTurn ? state.playerTokens : state.houseTokens;
    const enemyTokens = isPlayerTurn ? state.houseTokens : state.playerTokens;

    // Find movable tokens
    const movable = getMovableTokens(tokens, diceRoll, isPlayerTurn);
    state.movableTokens = movable;

    if (movable.length === 0) {
      // No valid moves, skip turn
      state.awaitingMove = false;
      state.currentTurn = isPlayerTurn ? 'house' : 'player';
      state.diceRoll = null;
      state.movableTokens = [];

      // If it's now the house's turn, auto-play house
      if (state.currentTurn === 'house') {
        await this.saveState(state);
        return this.playHouseTurn(state, currency);
      }

      await this.saveState(state);
    } else if (movable.length === 1) {
      // Only one option, auto-move
      const tokenIdx = movable[0];
      const token = tokens[tokenIdx];
      const fromPos = token.position;
      const result = moveToken(token, diceRoll, isPlayerTurn, enemyTokens);
      token.position = result.newPosition;

      if (result.captured) {
        if (isPlayerTurn) state.captures.player++;
        else state.captures.house++;
      }

      state.moveHistory.push({
        turn: state.currentTurn,
        dice: diceRoll,
        tokenIndex: tokenIdx,
        from: fromPos,
        to: result.newPosition,
        captured: result.captured,
      });

      state.awaitingMove = false;
      state.movableTokens = [];

      // Check win condition
      if (allTokensFinished(tokens)) {
        state.isGameOver = true;
        state.winner = isPlayerTurn ? 'player' : 'house';
        await this.finishGame(state);
      } else {
        // If rolled 6, same player goes again
        if (diceRoll !== 6) {
          state.currentTurn = isPlayerTurn ? 'house' : 'player';
        }
        state.diceRoll = null;

        // If house turn, auto-play
        if (state.currentTurn === 'house' && !state.isGameOver) {
          await this.saveState(state);
          return this.playHouseTurn(state, currency);
        }
      }

      await this.saveState(state);
    } else {
      // Multiple options - player must choose
      state.awaitingMove = true;
      await this.saveState(state);
    }

    const newBalance = await this.getBalance(userId, currency);

    return this.buildResult(state, newBalance);
  }

  // ---------------------------------------------------------------------------
  // Move a specific token
  // ---------------------------------------------------------------------------

  private async moveTokenAction(
    userId: string,
    currency: string,
    roundId?: string,
    tokenIndex?: number,
    autoPlay?: boolean,
  ): Promise<GameResult> {
    if (!roundId) {
      throw new GameError('MISSING_ROUND_ID', 'Must provide roundId for move action.');
    }

    if (tokenIndex === undefined || tokenIndex === null) {
      throw new GameError('MISSING_TOKEN', 'Must provide tokenIndex (0-3) for move action.');
    }

    if (tokenIndex < 0 || tokenIndex > 3) {
      throw new GameError('INVALID_TOKEN', 'tokenIndex must be 0, 1, 2, or 3.');
    }

    const state = await this.loadState(roundId, userId);

    if (state.isGameOver) {
      throw new GameError('GAME_OVER', 'This game is already finished.');
    }

    if (!state.awaitingMove) {
      throw new GameError('NOT_AWAITING_MOVE', 'Roll the dice first before moving.');
    }

    if (state.currentTurn !== 'player') {
      throw new GameError('NOT_YOUR_TURN', 'It is not your turn.');
    }

    if (!state.movableTokens.includes(tokenIndex)) {
      throw new GameError('TOKEN_NOT_MOVABLE', 'This token cannot be moved with the current dice roll.');
    }

    const diceRoll = state.diceRoll!;
    const token = state.playerTokens[tokenIndex];
    const fromPos = token.position;
    const result = moveToken(token, diceRoll, true, state.houseTokens);
    token.position = result.newPosition;

    if (result.captured) {
      state.captures.player++;
    }

    state.moveHistory.push({
      turn: 'player',
      dice: diceRoll,
      tokenIndex,
      from: fromPos,
      to: result.newPosition,
      captured: result.captured,
    });

    state.awaitingMove = false;
    state.movableTokens = [];

    // Check win
    if (allTokensFinished(state.playerTokens)) {
      state.isGameOver = true;
      state.winner = 'player';
      await this.finishGame(state);
      await this.saveState(state);
      const newBalance = await this.getBalance(userId, currency);
      return this.buildResult(state, newBalance);
    }

    // If rolled 6, player goes again
    if (diceRoll !== 6) {
      state.currentTurn = 'house';
      state.diceRoll = null;

      // Auto-play house turn(s)
      await this.saveState(state);
      return this.playHouseTurn(state, currency);
    } else {
      state.diceRoll = null;
      await this.saveState(state);
    }

    const newBalance = await this.getBalance(userId, currency);
    return this.buildResult(state, newBalance);
  }

  // ---------------------------------------------------------------------------
  // House AI turn (loops until it's player's turn or game over)
  // ---------------------------------------------------------------------------

  private async playHouseTurn(state: LudoGameState, currency: string): Promise<GameResult> {
    let maxIterations = 200; // Safety limit

    while (state.currentTurn === 'house' && !state.isGameOver && maxIterations-- > 0) {
      // Roll dice for house
      const seeds = await this.getUserSeeds(state.userId);
      const pfResult = this.fairService.generateResult(
        seeds.serverSeed,
        seeds.clientSeed,
        seeds.nonce * 1000 + state.rollNonce,
      );

      // Slight house advantage: house dice has ~3% better chance of rolling 6
      // This is achieved by adjusting the dice distribution slightly
      let diceRoll: number;
      if (pfResult < 0.03) {
        // Extra 3% chance of 6
        diceRoll = 6;
      } else {
        diceRoll = Math.floor(((pfResult - 0.03) / 0.97) * 6) + 1;
        diceRoll = Math.min(6, Math.max(1, diceRoll));
      }

      state.diceRoll = diceRoll;
      state.rollNonce++;
      state.rollCount++;

      const movable = getMovableTokens(state.houseTokens, diceRoll, false);

      if (movable.length === 0) {
        // No moves, pass turn
        state.currentTurn = 'player';
        state.diceRoll = null;
        state.movableTokens = [];
        break;
      }

      // AI picks best move
      const bestIdx = findBestMove(state.houseTokens, diceRoll, false, state.playerTokens);
      if (bestIdx === -1) {
        state.currentTurn = 'player';
        state.diceRoll = null;
        break;
      }

      const token = state.houseTokens[bestIdx];
      const fromPos = token.position;
      const result = moveToken(token, diceRoll, false, state.playerTokens);
      token.position = result.newPosition;

      if (result.captured) {
        state.captures.house++;
      }

      state.moveHistory.push({
        turn: 'house',
        dice: diceRoll,
        tokenIndex: bestIdx,
        from: fromPos,
        to: result.newPosition,
        captured: result.captured,
      });

      // Check win
      if (allTokensFinished(state.houseTokens)) {
        state.isGameOver = true;
        state.winner = 'house';
        await this.finishGame(state);
        break;
      }

      // If rolled 6, house goes again
      if (diceRoll !== 6) {
        state.currentTurn = 'player';
        state.diceRoll = null;
        state.movableTokens = [];
      }
    }

    await this.saveState(state);
    const newBalance = await this.getBalance(state.userId, currency);
    return this.buildResult(state, newBalance);
  }

  // ---------------------------------------------------------------------------
  // Auto-play: run entire game automatically
  // ---------------------------------------------------------------------------

  private async runAutoPlay(state: LudoGameState): Promise<GameResult> {
    let maxIterations = 2000; // Safety

    while (!state.isGameOver && maxIterations-- > 0) {
      const isPlayerTurn = state.currentTurn === 'player';
      const tokens = isPlayerTurn ? state.playerTokens : state.houseTokens;
      const enemyTokens = isPlayerTurn ? state.houseTokens : state.playerTokens;

      // Roll dice
      const seeds = await this.getUserSeeds(state.userId);
      const pfResult = this.fairService.generateResult(
        seeds.serverSeed,
        seeds.clientSeed,
        seeds.nonce * 1000 + state.rollNonce,
      );

      let diceRoll: number;
      if (!isPlayerTurn && pfResult < 0.03) {
        diceRoll = 6;
      } else if (!isPlayerTurn) {
        diceRoll = Math.floor(((pfResult - 0.03) / 0.97) * 6) + 1;
        diceRoll = Math.min(6, Math.max(1, diceRoll));
      } else {
        diceRoll = Math.floor(pfResult * 6) + 1;
      }

      state.diceRoll = diceRoll;
      state.rollNonce++;
      state.rollCount++;

      const movable = getMovableTokens(tokens, diceRoll, isPlayerTurn);

      if (movable.length === 0) {
        if (diceRoll !== 6) {
          state.currentTurn = isPlayerTurn ? 'house' : 'player';
        }
        state.diceRoll = null;
        continue;
      }

      const bestIdx = findBestMove(tokens, diceRoll, isPlayerTurn, enemyTokens);
      if (bestIdx === -1) {
        if (diceRoll !== 6) {
          state.currentTurn = isPlayerTurn ? 'house' : 'player';
        }
        state.diceRoll = null;
        continue;
      }

      const token = tokens[bestIdx];
      const fromPos = token.position;
      const result = moveToken(token, diceRoll, isPlayerTurn, enemyTokens);
      token.position = result.newPosition;

      if (result.captured) {
        if (isPlayerTurn) state.captures.player++;
        else state.captures.house++;
      }

      state.moveHistory.push({
        turn: state.currentTurn,
        dice: diceRoll,
        tokenIndex: bestIdx,
        from: fromPos,
        to: result.newPosition,
        captured: result.captured,
      });

      // Check win
      if (allTokensFinished(tokens)) {
        state.isGameOver = true;
        state.winner = isPlayerTurn ? 'player' : 'house';
        await this.finishGame(state);
        break;
      }

      if (diceRoll !== 6) {
        state.currentTurn = isPlayerTurn ? 'house' : 'player';
      }
      state.diceRoll = null;
    }

    // If we hit max iterations, declare house winner (safety net)
    if (!state.isGameOver) {
      state.isGameOver = true;
      state.winner = 'house';
      await this.finishGame(state);
    }

    await this.saveState(state);
    const newBalance = await this.getBalance(state.userId, state.currency);
    return this.buildResult(state, newBalance);
  }

  // ---------------------------------------------------------------------------
  // Finish game: credit winnings, record round
  // ---------------------------------------------------------------------------

  private async finishGame(state: LudoGameState): Promise<void> {
    const payout = state.winner === 'player'
      ? Math.floor(state.betAmount * WIN_MULTIPLIER * 100000000) / 100000000
      : 0;
    const multiplier = state.winner === 'player' ? WIN_MULTIPLIER : 0;

    if (payout > 0) {
      await this.creditWinnings(state.userId, payout, state.currency);
    }

    await this.recordRound({
      userId: state.userId,
      gameSlug: this.slug,
      betAmount: state.betAmount,
      payout,
      multiplier,
      result: {
        playerTokens: state.playerTokens.map((t) => t.position),
        houseTokens: state.houseTokens.map((t) => t.position),
        winner: state.winner,
        rollCount: state.rollCount,
        captures: state.captures,
        moveCount: state.moveHistory.length,
      },
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nonce,
    });

    await this.incrementNonce(state.userId);

    // Cleanup Redis
    await redis.del(`${REDIS_PREFIX}${state.roundId}`);
    await redis.del(`${REDIS_PREFIX}user:${state.userId}`);
  }

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------

  private async loadState(roundId: string, userId: string): Promise<LudoGameState> {
    const raw = await redis.get(`${REDIS_PREFIX}${roundId}`);
    if (!raw) {
      throw new GameError('GAME_NOT_FOUND', 'Game session not found or expired.');
    }

    const state: LudoGameState = JSON.parse(raw);

    if (state.userId !== userId) {
      throw new GameError('UNAUTHORIZED', 'This is not your game.');
    }

    return state;
  }

  private async saveState(state: LudoGameState): Promise<void> {
    await redis.set(
      `${REDIS_PREFIX}${state.roundId}`,
      JSON.stringify(state),
      'EX',
      GAME_TTL,
    );
  }

  // ---------------------------------------------------------------------------
  // Build response
  // ---------------------------------------------------------------------------

  private buildResult(state: LudoGameState, newBalance: number): GameResult {
    const payout = state.isGameOver && state.winner === 'player'
      ? Math.floor(state.betAmount * WIN_MULTIPLIER * 100000000) / 100000000
      : 0;
    const multiplier = state.isGameOver && state.winner === 'player' ? WIN_MULTIPLIER : 0;
    const profit = state.isGameOver ? payout - state.betAmount : -state.betAmount;

    return {
      roundId: state.roundId,
      game: this.slug,
      betAmount: state.betAmount,
      payout,
      profit,
      multiplier,
      result: {
        playerTokens: state.playerTokens.map((t) => t.position),
        houseTokens: state.houseTokens.map((t) => t.position),
        diceRoll: state.diceRoll,
        currentTurn: state.currentTurn,
        isGameOver: state.isGameOver,
        winner: state.winner,
        movableTokens: state.movableTokens,
        awaitingMove: state.awaitingMove,
        payout,
        rollCount: state.rollCount,
        captures: state.captures,
        moveHistory: state.moveHistory.slice(-20), // Last 20 moves for UI
        totalMoves: state.moveHistory.length,
      },
      fairness: {
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nonce,
      },
      newBalance,
    };
  }
}

export const ludoGame = new LudoGame();
export default ludoGame;
