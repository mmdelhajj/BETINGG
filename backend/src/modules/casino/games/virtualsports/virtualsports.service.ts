import { BaseGame, GameResult, BetRequest, GameError } from '../../../../services/casino/BaseGame.js';

// ---------------------------------------------------------------------------
// Virtual Sports Game
// ---------------------------------------------------------------------------
// Simulated sports events: Football, Basketball, Tennis.
// Each match has two teams with provably fair odds based on strength ratings.
// Player bets on outcome (home / draw / away).
// The match plays out instantly with a simulated score and highlights.
// ---------------------------------------------------------------------------

type Sport = 'football' | 'basketball' | 'tennis';
type BetType = 'home' | 'draw' | 'away';

export interface VirtualSportsOptions {
  sport: Sport;
  matchId?: string;
  betType: BetType;
  odds: number;
}

interface Team {
  name: string;
  strength: number; // 1-100
}

interface GeneratedMatch {
  matchId: string;
  sport: Sport;
  homeTeam: Team;
  awayTeam: Team;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
}

interface MatchResult {
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'draw' | 'away';
  userBet: BetType;
  odds: number;
  isWin: boolean;
  payout: number;
  matchHighlights: string[];
}

// ---------------------------------------------------------------------------
// Team databases per sport
// ---------------------------------------------------------------------------

const FOOTBALL_TEAMS: Team[] = [
  { name: 'FC Bayern', strength: 92 },
  { name: 'Real Madrid', strength: 91 },
  { name: 'Manchester City', strength: 90 },
  { name: 'Liverpool FC', strength: 88 },
  { name: 'Barcelona', strength: 87 },
  { name: 'Paris SG', strength: 86 },
  { name: 'Inter Milan', strength: 85 },
  { name: 'Arsenal', strength: 84 },
  { name: 'Juventus', strength: 82 },
  { name: 'Borussia Dortmund', strength: 81 },
  { name: 'AC Milan', strength: 80 },
  { name: 'Atletico Madrid', strength: 79 },
  { name: 'Chelsea', strength: 78 },
  { name: 'Napoli', strength: 77 },
  { name: 'Ajax', strength: 74 },
  { name: 'Benfica', strength: 73 },
  { name: 'Porto', strength: 72 },
  { name: 'Celtic FC', strength: 68 },
  { name: 'Galatasaray', strength: 70 },
  { name: 'Sporting CP', strength: 71 },
];

const BASKETBALL_TEAMS: Team[] = [
  { name: 'Thunder', strength: 94 },
  { name: 'Celtics', strength: 92 },
  { name: 'Nuggets', strength: 89 },
  { name: 'Warriors', strength: 85 },
  { name: 'Lakers', strength: 84 },
  { name: 'Bucks', strength: 87 },
  { name: '76ers', strength: 83 },
  { name: 'Heat', strength: 80 },
  { name: 'Suns', strength: 78 },
  { name: 'Mavericks', strength: 86 },
  { name: 'Knicks', strength: 82 },
  { name: 'Cavaliers', strength: 81 },
  { name: 'Kings', strength: 76 },
  { name: 'Pacers', strength: 77 },
  { name: 'Grizzlies', strength: 75 },
  { name: 'Hawks', strength: 73 },
];

const TENNIS_PLAYERS: Team[] = [
  { name: 'Sinner', strength: 95 },
  { name: 'Djokovic', strength: 93 },
  { name: 'Alcaraz', strength: 92 },
  { name: 'Zverev', strength: 87 },
  { name: 'Medvedev', strength: 86 },
  { name: 'Fritz', strength: 82 },
  { name: 'Rune', strength: 80 },
  { name: 'Ruud', strength: 79 },
  { name: 'Tsitsipas', strength: 78 },
  { name: 'De Minaur', strength: 77 },
  { name: 'Shelton', strength: 76 },
  { name: 'Draper', strength: 75 },
  { name: 'Tiafoe', strength: 73 },
  { name: 'Berrettini', strength: 72 },
  { name: 'Hurkacz', strength: 71 },
  { name: 'Paul', strength: 74 },
];

// ---------------------------------------------------------------------------
// In-memory match store with expiration
// ---------------------------------------------------------------------------

const activeMatches = new Map<string, GeneratedMatch & { expiresAt: number }>();

function cleanExpiredMatches(): void {
  const now = Date.now();
  for (const [id, match] of activeMatches) {
    if (match.expiresAt < now) {
      activeMatches.delete(id);
    }
  }
}

// Clean up every 5 minutes
setInterval(cleanExpiredMatches, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getTeamsBySport(sport: Sport): Team[] {
  switch (sport) {
    case 'football':
      return FOOTBALL_TEAMS;
    case 'basketball':
      return BASKETBALL_TEAMS;
    case 'tennis':
      return TENNIS_PLAYERS;
    default:
      return FOOTBALL_TEAMS;
  }
}

function selectTwoTeams(teams: Team[], seed: number): [Team, Team] {
  // Deterministic selection based on seed
  const idx1 = Math.floor(seed * teams.length) % teams.length;
  let idx2 = Math.floor(seed * 1000) % teams.length;
  if (idx2 === idx1) idx2 = (idx1 + 1) % teams.length;
  return [teams[idx1], teams[idx2]];
}

function calculateOdds(
  homeStrength: number,
  awayStrength: number,
  sport: Sport,
): { homeOdds: number; drawOdds: number; awayOdds: number } {
  const total = homeStrength + awayStrength;
  const homeProb = homeStrength / total;
  const awayProb = awayStrength / total;

  // House margin 5%
  const margin = 0.95;

  if (sport === 'football') {
    // Football allows draws — allocate ~15-25% to draw probability
    const strengthDiff = Math.abs(homeStrength - awayStrength);
    const drawProbBase = 0.25 - (strengthDiff / 200); // closer = more draws
    const drawProb = Math.max(0.1, Math.min(0.30, drawProbBase));
    const remainingProb = 1 - drawProb;
    const adjHome = homeProb * remainingProb;
    const adjAway = awayProb * remainingProb;

    return {
      homeOdds: Math.round((margin / adjHome) * 100) / 100,
      drawOdds: Math.round((margin / drawProb) * 100) / 100,
      awayOdds: Math.round((margin / adjAway) * 100) / 100,
    };
  }

  // Basketball / Tennis — no draw
  return {
    homeOdds: Math.round((margin / homeProb) * 100) / 100,
    drawOdds: 0,
    awayOdds: Math.round((margin / awayProb) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Score simulation
// ---------------------------------------------------------------------------

function simulateFootballScore(
  homeStrength: number,
  awayStrength: number,
  rawResults: number[],
): { homeScore: number; awayScore: number; highlights: string[] } {
  const highlights: string[] = [];
  let homeScore = 0;
  let awayScore = 0;

  // Simulate 90-minute match using multiple random values
  const events = Math.min(rawResults.length, 12);
  const eventMinutes = [5, 12, 23, 31, 38, 45, 52, 61, 68, 74, 82, 89];

  for (let i = 0; i < events; i++) {
    const r = rawResults[i];
    const minute = eventMinutes[i];
    const homeChance = homeStrength / (homeStrength + awayStrength);

    // ~25% chance of a goal event at each checkpoint
    if (r < 0.25) {
      if (r < 0.25 * homeChance) {
        homeScore++;
        highlights.push(`${minute}' - GOAL! Home team scores! (${homeScore}-${awayScore})`);
      } else {
        awayScore++;
        highlights.push(`${minute}' - GOAL! Away team scores! (${homeScore}-${awayScore})`);
      }
    } else if (r < 0.35) {
      highlights.push(`${minute}' - Shot saved by the keeper!`);
    } else if (r < 0.42) {
      highlights.push(`${minute}' - Corner kick awarded.`);
    } else if (r < 0.47) {
      highlights.push(`${minute}' - Free kick from a dangerous position.`);
    } else if (r < 0.50) {
      highlights.push(`${minute}' - Yellow card shown!`);
    }
  }

  if (highlights.length === 0) {
    highlights.push("45' - Goalless first half.");
    highlights.push("90' - The match ends 0-0.");
  } else {
    highlights.push(`90' - Full time! Final score: ${homeScore}-${awayScore}`);
  }

  return { homeScore, awayScore, highlights };
}

function simulateBasketballScore(
  homeStrength: number,
  awayStrength: number,
  rawResults: number[],
): { homeScore: number; awayScore: number; highlights: string[] } {
  const highlights: string[] = [];
  let homeScore = 0;
  let awayScore = 0;

  // 4 quarters, each ~25 points average per team
  const quarters = [1, 2, 3, 4];
  const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4'];

  for (let q = 0; q < 4; q++) {
    const baseIdx = q * 3;
    const homeChance = homeStrength / (homeStrength + awayStrength);

    // Each quarter: base score 20-30 per team
    const totalQuarterPoints = 45 + Math.floor((rawResults[baseIdx] || 0.5) * 15);
    const homeQuarterPts = Math.round(totalQuarterPoints * (homeChance + (((rawResults[baseIdx + 1] || 0.5) - 0.5) * 0.15)));
    const awayQuarterPts = totalQuarterPoints - homeQuarterPts;

    homeScore += homeQuarterPts;
    awayScore += awayQuarterPts;

    const bigPlay = rawResults[baseIdx + 2] || 0.5;
    if (bigPlay < 0.2) {
      highlights.push(`${quarterLabels[q]} - Spectacular slam dunk! Home takes control.`);
    } else if (bigPlay < 0.4) {
      highlights.push(`${quarterLabels[q]} - Three-pointer at the buzzer! Away closes the gap.`);
    } else if (bigPlay < 0.55) {
      highlights.push(`${quarterLabels[q]} - Steal and fast break! Home scores.`);
    } else if (bigPlay < 0.7) {
      highlights.push(`${quarterLabels[q]} - Block on the rim! Great defensive play.`);
    } else {
      highlights.push(`${quarterLabels[q]} - End of quarter: ${homeScore}-${awayScore}`);
    }
  }

  // Ensure no tie — overtime if needed
  if (homeScore === awayScore) {
    const otResult = rawResults[11] || 0.5;
    const homeChance = homeStrength / (homeStrength + awayStrength);
    if (otResult < homeChance) {
      homeScore += 5 + Math.floor((rawResults[10] || 0.5) * 8);
      awayScore += 2 + Math.floor((rawResults[9] || 0.5) * 5);
    } else {
      awayScore += 5 + Math.floor((rawResults[10] || 0.5) * 8);
      homeScore += 2 + Math.floor((rawResults[9] || 0.5) * 5);
    }
    highlights.push(`OT - Overtime! Final: ${homeScore}-${awayScore}`);
  } else {
    highlights.push(`Final - Game over! ${homeScore}-${awayScore}`);
  }

  return { homeScore, awayScore, highlights };
}

function simulateTennisScore(
  homeStrength: number,
  awayStrength: number,
  rawResults: number[],
): { homeScore: number; awayScore: number; highlights: string[] } {
  const highlights: string[] = [];
  let homeSets = 0;
  let awaySets = 0;

  const homeChance = homeStrength / (homeStrength + awayStrength);

  // Best of 3 sets
  for (let s = 0; s < 5 && homeSets < 2 && awaySets < 2; s++) {
    const r = rawResults[s * 2] || 0.5;
    const gamesR = rawResults[s * 2 + 1] || 0.5;

    // Determine set winner with some randomness
    const adjusted = homeChance + ((r - 0.5) * 0.3);
    if (adjusted > 0.5) {
      homeSets++;
      const homeGames = 6;
      const awayGames = Math.min(4, Math.floor(gamesR * 5));
      highlights.push(`Set ${s + 1}: Player 1 wins ${homeGames}-${awayGames}`);
    } else {
      awaySets++;
      const awayGames = 6;
      const homeGames = Math.min(4, Math.floor(gamesR * 5));
      highlights.push(`Set ${s + 1}: Player 2 wins ${awayGames}-${homeGames}`);
    }

    // Ace / break point highlight
    const eventR = rawResults[s * 2 + 10] || 0.5;
    if (eventR < 0.3) {
      highlights.push(`Set ${s + 1} - ACE! Massive serve down the middle.`);
    } else if (eventR < 0.5) {
      highlights.push(`Set ${s + 1} - Break point converted with a stunning return!`);
    } else if (eventR < 0.65) {
      highlights.push(`Set ${s + 1} - Rally of 30+ shots, incredible defense!`);
    }
  }

  highlights.push(`Match over! Final: ${homeSets}-${awaySets} sets`);

  return { homeScore: homeSets, awayScore: awaySets, highlights };
}

// ---------------------------------------------------------------------------
// Exported match schedule API (for frontend polling)
// ---------------------------------------------------------------------------

export function getActiveVirtualMatches(): Array<GeneratedMatch & { expiresAt: number }> {
  cleanExpiredMatches();
  return Array.from(activeMatches.values());
}

// ---------------------------------------------------------------------------
// VirtualSportsGame class
// ---------------------------------------------------------------------------

export class VirtualSportsGame extends BaseGame {
  readonly name = 'Virtual Sports';
  readonly slug = 'virtualsports';
  readonly houseEdge = 0.05;
  readonly minBet = 0.0001;
  readonly maxBet = 5000;

  async play(userId: string, bet: BetRequest): Promise<GameResult> {
    const options = bet.options as VirtualSportsOptions;

    if (!options || !options.sport) {
      throw new GameError('INVALID_OPTIONS', 'Must provide sport: "football", "basketball", or "tennis".');
    }

    const sport = options.sport.toLowerCase() as Sport;
    if (!['football', 'basketball', 'tennis'].includes(sport)) {
      throw new GameError('INVALID_SPORT', 'Sport must be "football", "basketball", or "tennis".');
    }

    // Accept betType directly, or extract from selection ID (e.g. "3-home" → "home")
    let rawBetType = (options as any).betType || (options as any).selection || '';
    if (typeof rawBetType === 'string' && rawBetType.includes('-')) {
      rawBetType = rawBetType.split('-').pop(); // "3-home" → "home"
    }
    const betType = String(rawBetType).toLowerCase() as BetType;
    if (!['home', 'draw', 'away'].includes(betType)) {
      throw new GameError('INVALID_BET_TYPE', 'betType must be "home", "draw", or "away".');
    }

    if (betType === 'draw' && sport !== 'football') {
      throw new GameError('INVALID_BET_TYPE', 'Draw bets are only available for football.');
    }

    // Odds will be resolved after match lookup; store raw value or null
    const rawOdds = (options.odds && typeof options.odds === 'number' && options.odds >= 1)
      ? options.odds
      : null;

    await this.validateBet(userId, bet.amount, bet.currency);

    // Get user seeds for provably fair results
    const seeds = await this.getUserSeeds(userId);

    // Generate multiple provably fair results for the match simulation
    const rawResults: number[] = [];
    for (let i = 0; i < 16; i++) {
      rawResults.push(
        this.fairService.generateResult(seeds.serverSeed, seeds.clientSeed, seeds.nonce + i),
      );
    }

    // Determine or retrieve the match
    let match: GeneratedMatch;

    if (options.matchId && activeMatches.has(options.matchId)) {
      match = activeMatches.get(options.matchId)!;
    } else {
      // Auto-generate a match
      const teams = getTeamsBySport(sport);
      const [homeTeam, awayTeam] = selectTwoTeams(teams, rawResults[0]);
      const odds = calculateOdds(homeTeam.strength, awayTeam.strength, sport);
      const matchId = options.matchId || `vs_${sport}_${Date.now()}_${Math.floor(rawResults[0] * 100000)}`;

      match = {
        matchId,
        sport,
        homeTeam,
        awayTeam,
        ...odds,
      };

      // Store match for 10 minutes
      activeMatches.set(matchId, { ...match, expiresAt: Date.now() + 10 * 60 * 1000 });
    }

    // Verify user-provided odds are within tolerance of server odds (10% margin to account for timing)
    const serverOdds =
      betType === 'home'
        ? match.homeOdds
        : betType === 'draw'
          ? match.drawOdds
          : match.awayOdds;

    // Use server odds if user didn't provide odds; validate tolerance if they did
    const odds = rawOdds ?? serverOdds;
    if (rawOdds !== null && Math.abs(rawOdds - serverOdds) / serverOdds > 0.15) {
      throw new GameError('ODDS_CHANGED', `Odds have changed. Current ${betType} odds: ${serverOdds}`);
    }

    const userOdds = odds;

    // Deduct balance
    await this.deductBalance(userId, bet.amount, bet.currency);

    // Simulate the match
    let homeScore: number;
    let awayScore: number;
    let matchHighlights: string[];

    switch (sport) {
      case 'football': {
        const sim = simulateFootballScore(match.homeTeam.strength, match.awayTeam.strength, rawResults);
        homeScore = sim.homeScore;
        awayScore = sim.awayScore;
        matchHighlights = sim.highlights;
        break;
      }
      case 'basketball': {
        const sim = simulateBasketballScore(match.homeTeam.strength, match.awayTeam.strength, rawResults);
        homeScore = sim.homeScore;
        awayScore = sim.awayScore;
        matchHighlights = sim.highlights;
        break;
      }
      case 'tennis': {
        const sim = simulateTennisScore(match.homeTeam.strength, match.awayTeam.strength, rawResults);
        homeScore = sim.homeScore;
        awayScore = sim.awayScore;
        matchHighlights = sim.highlights;
        break;
      }
      default: {
        const sim = simulateFootballScore(match.homeTeam.strength, match.awayTeam.strength, rawResults);
        homeScore = sim.homeScore;
        awayScore = sim.awayScore;
        matchHighlights = sim.highlights;
      }
    }

    // Determine winner
    let winner: 'home' | 'draw' | 'away';
    if (homeScore > awayScore) {
      winner = 'home';
    } else if (awayScore > homeScore) {
      winner = 'away';
    } else {
      winner = 'draw';
    }

    // Check if user bet wins
    const isWin = betType === winner;
    const multiplier = isWin ? userOdds : 0;
    const payout = isWin ? Math.floor(bet.amount * userOdds * 100000000) / 100000000 : 0;

    // Credit winnings
    if (isWin && payout > 0) {
      await this.creditWinnings(userId, payout, bet.currency);
    }

    // Increment nonce
    await this.incrementNonce(userId);

    // Build result object
    const matchResult: MatchResult = {
      sport,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore,
      awayScore,
      winner,
      userBet: betType,
      odds: userOdds,
      isWin,
      payout,
      matchHighlights,
    };

    // Record round
    const roundId = await this.recordRound({
      userId,
      gameSlug: this.slug,
      betAmount: bet.amount,
      payout,
      multiplier,
      result: matchResult,
      serverSeedHash: seeds.serverSeedHash,
      clientSeed: seeds.clientSeed,
      nonce: seeds.nonce,
    });

    // Fetch updated balance
    const newBalance = await this.getBalance(userId, bet.currency);

    // Remove consumed match
    activeMatches.delete(match.matchId);

    return {
      roundId,
      game: this.slug,
      betAmount: bet.amount,
      payout,
      profit: payout - bet.amount,
      multiplier,
      result: matchResult,
      fairness: {
        serverSeedHash: seeds.serverSeedHash,
        clientSeed: seeds.clientSeed,
        nonce: seeds.nonce,
      },
      newBalance,
    };
  }
}

export const virtualSportsGame = new VirtualSportsGame();
export default virtualSportsGame;
