# CryptoBet — Admin Dashboard, Multi-API Odds Integration & Backend Systems

> **This is a Claude Code implementation prompt. Read ENTIRELY before writing any code.**
> **Do NOT ask questions. Implement everything top-to-bottom.**

---

## TABLE OF CONTENTS

1. [Multi-API Odds Integration System](#1-multi-api-odds-integration-system)
2. [Odds Engine & Margin System](#2-odds-engine--margin-system)
3. [Bet Placement System](#3-bet-placement-system)
4. [Bet Settlement System](#4-bet-settlement-system)
5. [Cash Out System](#5-cash-out-system)
6. [Risk Management System](#6-risk-management-system)
7. [Parlay / Accumulator System](#7-parlay--accumulator-system)
8. [Live Betting System](#8-live-betting-system)
9. [Admin Dashboard — Complete Backend](#9-admin-dashboard--complete-backend)
10. [Admin Dashboard — Complete Frontend](#10-admin-dashboard--complete-frontend)
11. [Database Schema Additions](#11-database-schema-additions)
12. [Environment Variables](#12-environment-variables)
13. [Testing & Validation Checklist](#13-testing--validation-checklist)

---

## 1. MULTI-API ODDS INTEGRATION SYSTEM

### Architecture Overview

The system uses MULTIPLE odds API providers simultaneously, with priority and fallback logic:

```
┌─────────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   The Odds API      │   │    Goalserve     │   │   OddsPapi       │
│   (Pre-match)       │   │   (Live WebSocket)│   │   (Fallback)     │
│   FREE / $50/mo     │   │   $100-200/mo    │   │   $50-200/mo     │
└──────────┬──────────┘   └────────┬─────────┘   └────────┬─────────┘
           │                       │                       │
           └───────────┬───────────┴───────────────────────┘
                       ▼
          ┌──────────────────────────┐
          │  OddsAggregatorService   │  ← Merges, deduplicates, picks best
          │  (Priority + Fallback)   │
          └──────────────┬───────────┘
                         ▼
          ┌──────────────────────────┐
          │   OddsEngine             │  ← Applies house margin
          │   (Margin Calculation)   │
          └──────────────┬───────────┘
                         ▼
          ┌──────────────────────────┐
          │     Redis Cache          │  ← TTL: 5s live, 30s pre-match
          └──────────────┬───────────┘
                         ▼
          ┌──────────────────────────┐
          │   PostgreSQL Database    │  ← Persistent storage
          └──────────────┬───────────┘
                         ▼
          ┌──────────────────────────┐
          │  Socket.IO Broadcast     │  → All connected clients
          └──────────────────────────┘
```

### File: `src/services/oddsProviders/BaseOddsProvider.ts`

```typescript
// Abstract base class for all odds providers
export abstract class BaseOddsProvider {
  abstract name: string;
  abstract priority: number; // 1 = highest priority
  abstract type: 'REST' | 'WEBSOCKET';
  
  abstract fetchSports(): Promise<Sport[]>;
  abstract fetchEvents(sportKey: string): Promise<ExternalEvent[]>;
  abstract fetchOdds(sportKey: string): Promise<ExternalOdds[]>;
  abstract fetchScores(sportKey: string): Promise<ExternalScore[]>;
  abstract fetchLiveOdds(sportKey: string): Promise<ExternalOdds[]>;
  
  // Normalize external data to internal format
  abstract normalizeEvent(external: any): NormalizedEvent;
  abstract normalizeOdds(external: any): NormalizedOdds;
  abstract normalizeScore(external: any): NormalizedScore;
  
  // Health check
  abstract isHealthy(): Promise<boolean>;
  abstract getRemainingQuota(): Promise<{ used: number; limit: number; remaining: number }>;
}
```

### File: `src/services/oddsProviders/TheOddsApiProvider.ts`

```typescript
// Implementation for The Odds API (https://the-odds-api.com)
// API Base: https://api.the-odds-api.com/v4
// Auth: apiKey query parameter
// Rate limit: based on plan (500 free, up to 250,000/mo)

// Endpoints to implement:
// GET /v4/sports — List all sports (FREE, no quota cost)
// GET /v4/sports/{sport}/events — List events (FREE, no quota cost)  
// GET /v4/sports/{sport}/odds?regions={regions}&markets={markets} — Get odds (costs quota)
// GET /v4/sports/{sport}/scores — Get scores (costs quota)
// GET /v4/sports/{sport}/events/{eventId}/odds — Get single event odds with additional markets

// Regions to use: eu,uk (for international coverage)
// Markets to fetch: h2h,spreads,totals
// Odds format: decimal (our platform uses decimal odds)

// IMPORTANT: Track quota usage from response headers:
// x-requests-used, x-requests-remaining

// Sport keys we support (start with these):
// soccer_epl, soccer_spain_la_liga, soccer_germany_bundesliga,
// soccer_italy_serie_a, soccer_france_ligue_one, soccer_uefa_champs_league,
// basketball_nba, basketball_euroleague,
// americanfootball_nfl,
// icehockey_nhl,
// baseball_mlb,
// mma_mixed_martial_arts,
// tennis_atp_australian_open (and other Grand Slams),
// cricket_ipl, cricket_international_t20,
// boxing_boxing
```

### File: `src/services/oddsProviders/GoalserveProvider.ts`

```typescript
// Implementation for Goalserve (https://goalserve.com)
// Supports WebSocket for live in-play odds (1-second updates)
// Also has REST API for pre-match

// REST Base: https://www.goalserve.com/getfeed/{apiKey}/{sport}/odds
// WebSocket: wss://push.goalserve.com/ws

// CRITICAL: Goalserve provides:
// - Live odds updating every 1 second via WebSocket
// - Ball position coordinates for match tracker
// - Live game statistics
// - Live game state (shot, offside, throw-in, corner, etc.)
// - Pre-match odds with 30-second refresh
// - 250+ betting markets
// - Odds settlement results (WIN/LOSE for each market)

// Sports covered: soccer, basketball, tennis, baseball, ice hockey, MMA, cricket, rugby

// WebSocket message format: JSON with sport, matchId, markets, odds
// Must reconnect on disconnect with exponential backoff

// This provider is PRIMARY for live events
// Falls back to TheOddsApi for pre-match when Goalserve is unavailable
```

### File: `src/services/OddsAggregatorService.ts`

```typescript
// The main aggregation service that coordinates all providers

export class OddsAggregatorService {
  private providers: Map<string, BaseOddsProvider>;
  
  // Provider priority (configurable from admin):
  // Pre-match: TheOddsApi (1) → OddsPapi (2) → Goalserve (3)
  // Live: Goalserve (1) → TheOddsApi (2) → OddsPapi (3)
  
  // Methods:
  
  // fetchAndMergeOdds(sportKey): 
  //   1. Get odds from highest priority provider
  //   2. If fails, try next provider (fallback)
  //   3. If multiple succeed, merge: take BEST odds for each selection
  //   4. Cache in Redis
  //   5. Compare with previous odds → detect changes
  //   6. Emit Socket.IO events for changes
  
  // fetchAndMergeScores(sportKey):
  //   1. Get scores from live provider first
  //   2. Fallback to pre-match provider scores endpoint
  //   3. Update database
  //   4. Emit Socket.IO score:update events
  
  // getProviderStatus():
  //   Returns health, quota, last sync time for each provider
  
  // switchProvider(context, providerName):
  //   Admin can manually override which provider is primary
  
  // BEST ODDS SELECTION LOGIC:
  // For each market+selection, compare odds across providers:
  //   - Take the highest decimal odds (best for the player)
  //   - Track which provider sourced each odd
  //   - This is how professional sportsbooks maximize player value
  //   - Apply OUR margin on top (see Odds Engine)
}
```

### File: `src/queues/processors/oddsSyncProcessor.ts`

```typescript
// BullMQ job that runs on schedule

// JOB: sync-prematch-odds
// Schedule: Every 60 seconds
// Steps:
//   1. Get list of enabled sports from database
//   2. For each sport, call OddsAggregatorService.fetchAndMergeOdds()
//   3. Upsert events into Events table (match by externalId or team names)
//   4. Upsert markets into Markets table
//   5. Upsert selections into Selections table
//   6. Compare old odds vs new odds
//   7. If odds changed: emit Socket.IO "odds:update" to event room
//   8. If new event: emit Socket.IO "event:new" to sport room
//   9. Log sync results to OddsSyncLog table
//   10. Update provider quota tracking

// JOB: sync-live-odds
// Schedule: Every 10 seconds (or WebSocket for Goalserve)
// Steps:
//   1. Get all events where status = 'LIVE' 
//   2. Fetch live odds from live-priority provider
//   3. Fetch live scores
//   4. Update database
//   5. Emit Socket.IO events:
//      - "odds:update" { eventId, marketId, selections: [{ id, odds, previousOdds }] }
//      - "score:update" { eventId, homeScore, awayScore, period, clock }
//      - "event:status" { eventId, status } (when game starts/ends)
//   6. If event finished: trigger bet settlement queue

// JOB: sync-scores
// Schedule: Every 30 seconds
// Steps:
//   1. Fetch scores for live events
//   2. Update Events table with scores
//   3. Detect completed events → change status to 'FINISHED'
//   4. For FINISHED events → add to settlement queue

// JOB: sync-sports-list
// Schedule: Every 6 hours
// Steps:
//   1. Fetch full sports list from providers
//   2. Update Sports table
//   3. Mark out-of-season sports as inactive
```

---

## 2. ODDS ENGINE & MARGIN SYSTEM

### How Sportsbook Odds Work

Professional sportsbooks don't just show raw API odds. They apply a **margin (vig/juice)** to ensure profitability regardless of outcome.

### File: `src/services/OddsEngine.ts`

```typescript
export class OddsEngine {
  
  // MARGIN APPLICATION
  // Raw odds from API represent true market probability
  // We apply our margin to ensure house edge
  
  // Example: True probability of Team A winning = 50% (decimal odds 2.00)
  // With 5% margin: displayed odds = 2.00 / (1 + 0.05) = 1.905
  // This means sum of implied probabilities > 100% (the overround)
  
  applyMargin(rawOdds: number, marginPercent: number): number {
    // marginPercent from admin settings (default 5%)
    // Formula: adjustedOdds = rawOdds / (1 + margin/100)
    // NEVER go below 1.01
    return Math.max(1.01, rawOdds / (1 + marginPercent / 100));
  }
  
  // MARGIN BY SPORT (admin configurable)
  // Soccer: 5-6% (competitive market, lower margin)
  // Basketball: 5% 
  // Tennis: 6%
  // MMA/Boxing: 7-8% (less liquid, higher margin)
  // Esports: 8-10%
  // Live betting: +1-2% above pre-match (compensate for speed advantage)
  
  // DYNAMIC MARGIN ADJUSTMENT
  // When liability is unbalanced (too much money on one side):
  // 1. Increase margin on the popular side
  // 2. Decrease margin on the unpopular side
  // This encourages balanced action
  
  adjustOddsForLiability(
    odds: number, 
    totalStakeOnThisOutcome: number,
    totalStakeOnAllOutcomes: number,
    targetBalance: number // 0.5 = perfectly balanced
  ): number {
    const currentBalance = totalStakeOnThisOutcome / totalStakeOnAllOutcomes;
    const imbalance = currentBalance - targetBalance;
    // If imbalance > 0: too much on this side → lower odds (less attractive)
    // If imbalance < 0: not enough on this side → raise odds (more attractive)
    const adjustment = 1 - (imbalance * 0.1); // 10% sensitivity
    return Math.max(1.01, odds * adjustment);
  }
  
  // ODDS FORMAT CONVERSION
  // Internal storage: always DECIMAL
  // Display: convert per user preference
  
  decimalToAmerican(decimal: number): string {
    if (decimal >= 2.0) {
      return '+' + Math.round((decimal - 1) * 100);
    } else {
      return '-' + Math.round(100 / (decimal - 1));
    }
  }
  
  decimalToFractional(decimal: number): string {
    const profit = decimal - 1;
    // Find closest simple fraction
    // e.g., 2.50 → 3/2, 1.50 → 1/2
    const denominator = [1,2,3,4,5,6,7,8,10,11,12,15,20,25,33,40,50,66,100];
    let bestNum = 1, bestDen = 1, bestDiff = Infinity;
    for (const den of denominator) {
      const num = Math.round(profit * den);
      const diff = Math.abs(profit - num/den);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestNum = num;
        bestDen = den;
      }
    }
    return `${bestNum}/${bestDen}`;
  }
  
  // PAYOUT CALCULATION
  calculatePayout(stake: number, odds: number): number {
    return stake * odds; // Total return including stake
  }
  
  calculateProfit(stake: number, odds: number): number {
    return stake * (odds - 1); // Profit only
  }
  
  // PARLAY ODDS CALCULATION
  calculateParlayOdds(legs: { odds: number }[]): number {
    return legs.reduce((acc, leg) => acc * leg.odds, 1);
  }
}
```

---

## 3. BET PLACEMENT SYSTEM

### File: `src/services/BetService.ts`

```typescript
// Complete bet placement flow — this is CRITICAL for the sportsbook

export class BetService {
  
  // STEP 1: VALIDATE BET
  async validateBet(userId: string, betRequest: BetRequest): Promise<ValidationResult> {
    // Check user exists and is not banned/suspended
    // Check user is not self-excluded (responsible gambling)
    // Check event exists and is OPEN or LIVE
    // Check market is not suspended
    // Check selection exists and odds are still valid
    // Check odds haven't changed more than acceptable threshold (2%)
    // Check stake >= minBetAmount (from site_config)
    // Check stake <= maxBetAmount (from site_config)
    // Check user has sufficient balance
    // Check user hasn't exceeded daily/weekly/monthly betting limits (responsible gambling)
    // For live bets: check if live betting delay has passed
    // For parlays: check max legs (from site_config, default 15)
    // For parlays: check no conflicting selections (same event)
    // Check against risk management rules (see Risk Management section)
  }
  
  // STEP 2: LOCK ODDS
  // Between validation and placement, odds might change
  // We "lock" the odds at the time of bet acceptance
  async lockOdds(selections: Selection[]): Promise<LockedOdds[]> {
    // Get current odds from Redis cache
    // If odds changed since user saw them:
    //   - If better for user: accept (they get better odds)
    //   - If worse by < 2%: accept with current odds
    //   - If worse by > 2%: reject, show new odds to user
    // Return locked odds with timestamp
  }
  
  // STEP 3: PLACE BET (Atomic Transaction)
  async placeBet(userId: string, betRequest: BetRequest): Promise<Bet> {
    // BEGIN TRANSACTION
    //   1. Deduct stake from user wallet (SELECT FOR UPDATE on wallet)
    //   2. Create Bet record (status: OPEN)
    //   3. Create BetSelection records (one per selection)
    //   4. Update event/market liability tracking
    //   5. Create transaction record (type: BET_PLACED)
    //   6. Log bet for audit trail
    // COMMIT TRANSACTION
    
    // If ANY step fails → ROLLBACK (user gets money back)
    
    // AFTER transaction:
    //   - Emit Socket.IO "bet:placed" to user
    //   - Emit "bet:new" to admin dashboard
    //   - Update risk exposure tracking
    //   - If liability threshold exceeded → alert admin
    //   - Check if odds should be adjusted (liability balancing)
  }
  
  // BET TYPES
  // SINGLE: One selection, one event
  //   payout = stake * odds
  // PARLAY (ACCUMULATOR): Multiple selections, different events
  //   payout = stake * (odds1 * odds2 * odds3 * ...)
  //   ALL legs must win for bet to win
  //   If one leg pushes (void): recalculate without that leg
  // SYSTEM: Multiple parlays from selected events
  //   e.g., System 2/3 = three 2-leg parlays from 3 selections

  // BET STATUS FLOW:
  // OPEN → SETTLED (WON/LOST/VOID/HALF_WON/HALF_LOST/PUSH)
  // OPEN → CASHED_OUT (if user uses cash out feature)
  // OPEN → CANCELLED (if admin voids the bet)
}
```

### API Endpoints for Betting

```
POST   /api/v1/bets/place          — Place a single bet
POST   /api/v1/bets/place-parlay   — Place a parlay bet
GET    /api/v1/bets/my-bets        — User's bets (open/settled, paginated)
GET    /api/v1/bets/:id            — Get bet detail
POST   /api/v1/bets/:id/cash-out   — Cash out a bet
GET    /api/v1/bets/:id/cash-out-value — Get current cash out value
```

---

## 4. BET SETTLEMENT SYSTEM

### How Settlement Works

Settlement is the process of determining if a bet won or lost after an event finishes, and paying out winners.

### File: `src/services/SettlementService.ts`

```typescript
export class SettlementService {
  
  // TRIGGERED WHEN:
  // 1. Event status changes to FINISHED (from odds sync)
  // 2. Scores are confirmed from data provider
  // 3. Admin manually triggers settlement
  
  // SETTLEMENT FLOW:
  async settleEvent(eventId: string): Promise<SettlementResult> {
    // 1. Get final scores/result from database
    // 2. Get all markets for this event
    // 3. For each market, determine winning selections:
    //    - h2h (moneyline): winning team's selection
    //    - spreads: check if team covered the spread
    //    - totals: check if total is over or under the line
    //    - For draws in 2-way markets: void all bets on that market (push)
    
    // 4. Get all OPEN bets that include selections from this event
    // 5. For each bet:
    //    a. Check all selections against results
    //    b. Determine bet outcome (WON/LOST/VOID/PUSH/HALF_WON/HALF_LOST)
    //    c. Calculate payout
    //    d. Credit winner's wallet
    //    e. Update bet status
    //    f. Create transaction record
    //    g. Send notification to user
    
    // 6. Log settlement for audit trail
    // 7. Emit events to admin dashboard
  }
  
  // MARKET SETTLEMENT RULES
  
  determineOutcome(market: Market, result: EventResult): SelectionOutcome[] {
    switch (market.type) {
      case 'h2h': // Moneyline / 1X2
        // 3-way (soccer): home win, draw, away win
        // 2-way: home win, away win
        // Winner = team with higher score
        // Draw in 2-way = PUSH (return stakes)
        break;
        
      case 'spreads': // Point Spread / Handicap
        // Team must win by more than the spread
        // e.g., Team A -3.5: must win by 4+ points
        // If spread is whole number (e.g., -3) and margin is exactly 3: PUSH
        break;
        
      case 'totals': // Over/Under
        // Total points/goals compared to line
        // Over 2.5: total must be 3+
        // Under 2.5: total must be 0, 1, or 2
        // Whole number lines: exact match = PUSH
        break;
        
      case 'outrights': // Futures
        // Settled at end of tournament/season
        // Winner takes all, others lose
        break;
    }
  }
  
  // PARLAY SETTLEMENT
  settleParlay(bet: Bet, selectionResults: SelectionOutcome[]): BetOutcome {
    // ALL selections must win for parlay to win
    // If ANY selection LOSES → entire parlay LOSES
    // If a selection is VOID/PUSH → remove from parlay, recalculate odds
    //   e.g., 4-leg parlay, 1 void: becomes 3-leg parlay with adjusted odds
    //   New payout = stake * (remaining_odds)
    // If ALL remaining selections win → parlay WINS with adjusted payout
    
    const activeLegs = selectionResults.filter(s => s.outcome !== 'VOID');
    const hasLoss = activeLegs.some(s => s.outcome === 'LOST');
    
    if (hasLoss) return { outcome: 'LOST', payout: 0 };
    
    const adjustedOdds = activeLegs.reduce((acc, s) => acc * s.lockedOdds, 1);
    return { outcome: 'WON', payout: bet.stake * adjustedOdds };
  }
  
  // PAYOUT PROCESSING
  async processPayout(bet: Bet, payout: number): Promise<void> {
    // BEGIN TRANSACTION
    //   1. Update bet status to WON
    //   2. Set bet.payout = calculated payout
    //   3. Credit user's wallet: balance += payout
    //   4. Create transaction: type = BET_WON, amount = payout
    //   5. Create notification: "Your bet on {event} won! +{payout}"
    // COMMIT
    
    // Emit Socket.IO: "bet:settled" to user
    // Emit Socket.IO: "balance:update" to user
  }
  
  // SETTLEMENT TIMING
  // - Simple markets (moneyline, spread, total): settle within 1-5 minutes of event end
  // - Player props: may take up to 30 minutes (wait for official stats)
  // - Futures/outrights: settle when tournament/season ends
  // - If result disputed: mark as PENDING_REVIEW for admin
  
  // IMPORTANT: Settlement must be IDEMPOTENT
  // Running settlement twice on the same event should not double-pay
  // Check if bet is already settled before processing
}
```

### Settlement Queue

```typescript
// BullMQ job: settle-event
// Triggered by: oddsSyncProcessor when event status → FINISHED
// Retry: 3 times with exponential backoff
// Dead letter queue for failed settlements → admin alert
```

---

## 5. CASH OUT SYSTEM

### File: `src/services/CashOutService.ts`

```typescript
export class CashOutService {
  
  // Cash out allows users to settle their bet early for a guaranteed payout
  // The offered amount is ALWAYS less than the potential full payout (house takes a cut)
  
  // CASH OUT VALUE FORMULA:
  // cashOutValue = potentialPayout × currentWinProbability × (1 - cashOutMargin)
  
  // cashOutMargin = 5% (admin configurable)
  // currentWinProbability = derived from current live odds
  
  calculateCashOutValue(bet: Bet): number | null {
    // Only available for:
    // - OPEN bets
    // - Events that are LIVE or haven't started yet
    // - If cashoutEnabled = true in site_config
    // - Single bets and parlays where at least one leg is still active
    
    // For SINGLE bets:
    // currentOdds = latest odds for the selection
    // impliedProb = 1 / currentOdds
    // cashOutValue = bet.stake * bet.lockedOdds * impliedProb * (1 - margin)
    
    // For PARLAY bets:
    // Calculate combined probability of remaining legs winning
    // cashOutValue = stake * (wonLegsOdds) * (remainingLegsProbability) * (1 - margin)
    // Where wonLegsOdds = product of odds for already-won legs
    
    // Example:
    // User bet $100 on Team A at 2.50 (potential payout $250)
    // Team A is now winning, live odds for them are 1.30
    // impliedProb = 1/1.30 = 0.769
    // cashOutValue = $100 * 2.50 * 0.769 * 0.95 = $182.64
    // User can take $182.64 now instead of waiting for $250 (or $0)
    
    if (!siteConfig.cashoutEnabled) return null;
    if (bet.status !== 'OPEN') return null;
    
    // Calculate and return
  }
  
  async executeCashOut(userId: string, betId: string): Promise<CashOutResult> {
    // 1. Recalculate cash out value (odds may have changed since user saw it)
    // 2. If value changed by > 5%: reject, show new value
    // 3. BEGIN TRANSACTION
    //    a. Update bet status to CASHED_OUT
    //    b. Set bet.cashOutAmount = cashOutValue
    //    c. Credit user wallet
    //    d. Create transaction: type = CASH_OUT
    //    e. Create notification
    // 4. COMMIT
    // 5. Emit Socket.IO events
  }
  
  // PARTIAL CASH OUT (optional advanced feature)
  // User can cash out a percentage of their bet
  // e.g., Cash out 50% → get half the cash out value, remaining bet continues
}
```

### API Endpoints

```
GET  /api/v1/bets/:id/cash-out-value  — Get current cash out offer
POST /api/v1/bets/:id/cash-out        — Execute cash out
POST /api/v1/bets/:id/partial-cash-out — Partial cash out (body: { percentage: 50 })
```

---

## 6. RISK MANAGEMENT SYSTEM

### File: `src/services/RiskManagementService.ts`

```typescript
export class RiskManagementService {
  
  // RISK MANAGEMENT prevents the sportsbook from catastrophic losses
  // It operates on multiple levels:
  
  // ═══════════════════════════════════════════
  // LEVEL 1: BET-LEVEL CONTROLS
  // ═══════════════════════════════════════════
  
  // Applied BEFORE accepting a bet
  
  validateBetRisk(bet: BetRequest, user: User): RiskDecision {
    // a. Stake limits
    //    - Global min/max from site_config
    //    - Per-sport min/max (configurable per sport)
    //    - Per-user limits (admin can set custom limits per user)
    //    - Per-user-tier limits (VIP users get higher limits)
    
    // b. Max payout limit
    //    - Maximum potential payout allowed per bet
    //    - Default: $50,000 (admin configurable)
    //    - If potential_payout > max_payout: reject bet
    //    - Or cap the stake so payout doesn't exceed limit
    
    // c. Max daily/weekly/monthly betting volume per user
    //    - Track total stakes placed in rolling windows
    //    - Alert admin if user exceeds threshold
  }
  
  // ═══════════════════════════════════════════
  // LEVEL 2: MARKET-LEVEL CONTROLS
  // ═══════════════════════════════════════════
  
  // Tracks liability (exposure) per market
  
  checkMarketLiability(eventId: string, marketId: string, selectionId: string, stake: number): RiskDecision {
    // Liability = total potential payout if a selection wins
    // liability[selectionId] += stake * odds
    
    // MAX MARKET LIABILITY (admin configurable per sport):
    //   - Soccer: $10,000
    //   - Basketball NBA: $15,000
    //   - Tennis: $5,000
    //   - MMA: $3,000
    
    // If adding this bet would exceed market liability:
    //   Option 1: REJECT the bet
    //   Option 2: ACCEPT but reduce max stake
    //   Option 3: ACCEPT but adjust odds (make less attractive)
    //   Option 4: ALERT admin for manual review
    
    // Track:
    //   - Total stakes per selection
    //   - Total potential payout per selection
    //   - Balance ratio (ideally close to 50/50 for 2-way markets)
  }
  
  // ═══════════════════════════════════════════
  // LEVEL 3: USER-LEVEL PROFILING
  // ═══════════════════════════════════════════
  
  // Track user betting behavior and assign risk scores
  
  getUserRiskProfile(userId: string): UserRiskProfile {
    // Calculate risk score (0-100) based on:
    
    // a. Win rate: High win rate (>60%) = potential sharp bettor
    // b. ROI: Consistently profitable users = higher risk
    // c. Bet patterns: Always betting large on underdogs = suspicious
    // d. Timing: Betting seconds before events = may have inside info
    // e. Arbitrage detection: Betting both sides across platforms
    // f. Bonus abuse: Multiple accounts, maximum bonus exploitation
    
    // Risk tiers:
    // LOW (0-30): Normal recreational bettor, no restrictions
    // MEDIUM (31-60): Monitor, slightly reduced limits
    // HIGH (61-80): Reduced limits, no promotions
    // CRITICAL (81-100): Manual review required, may restrict account
    
    return {
      score: calculated,
      tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      totalBets: count,
      winRate: percentage,
      roi: percentage,
      flags: string[], // e.g., ['HIGH_WIN_RATE', 'LATE_BETTOR', 'LARGE_STAKES']
    };
  }
  
  // ═══════════════════════════════════════════
  // LEVEL 4: EVENT-LEVEL CONTROLS
  // ═══════════════════════════════════════════
  
  // Per-event risk tracking
  
  getEventExposure(eventId: string): EventExposure {
    // For each possible outcome, calculate:
    //   - Total stakes received
    //   - Total potential payout (liability)
    //   - Net exposure (payout - total stakes from other outcomes)
    
    // WORST CASE = maximum net loss across all outcomes
    // This is what the sportsbook could lose if the worst outcome hits
    
    // If worst case > event liability limit → SUSPEND market or adjust odds
  }
  
  // ═══════════════════════════════════════════
  // LEVEL 5: PLATFORM-LEVEL MONITORING
  // ═══════════════════════════════════════════
  
  // Real-time dashboard metrics
  
  getPlatformExposure(): PlatformExposure {
    return {
      totalOpenBets: count,
      totalOpenStakes: sum,
      totalPotentialPayout: sum,
      maxSingleEventExposure: max,
      dailyGGR: grossGamingRevenue, // stakes - payouts
      dailyNGR: netGamingRevenue,   // GGR - bonuses - costs
      alertLevel: 'GREEN' | 'YELLOW' | 'RED',
    };
  }
  
  // ═══════════════════════════════════════════
  // AUTOMATED ACTIONS
  // ═══════════════════════════════════════════
  
  // Auto-suspend market if liability > 80% of limit
  // Auto-adjust odds if one side is > 70% of total stakes
  // Auto-alert admin if user risk score jumps suddenly
  // Auto-flag suspicious patterns (rapid bets, same IP different accounts)
  // Auto-void bets if event is corrupted/abandoned
}
```

---

## 7. PARLAY / ACCUMULATOR SYSTEM

### File: `src/services/ParlayService.ts`

```typescript
export class ParlayService {
  
  // RULES:
  // - Minimum 2 selections, maximum from site_config (default 15)
  // - All selections must be from DIFFERENT events
  // - Cannot combine conflicting markets (e.g., Team A win + Draw from same match)
  // - Some markets cannot be parlayed (admin configurable, e.g., outrights)
  
  // ODDS CALCULATION:
  // Combined odds = product of all individual odds
  // Example: 3 legs at 1.90, 2.10, 1.75
  // Parlay odds = 1.90 × 2.10 × 1.75 = 6.9825
  // $10 bet → potential payout = $69.83
  
  // SETTLEMENT:
  // ALL legs must win → bet wins
  // ANY leg loses → bet loses
  // VOID leg → removed from parlay, recalculate
  //   e.g., 4-leg parlay, 1 void → becomes 3-leg parlay
  //   New odds = product of remaining 3 legs
  //   If only 1 leg remains → becomes single bet
  //   If all legs void → bet is void (return stake)
  
  validateParlay(selections: ParlaySelection[]): ParlayValidation {
    // Check count: min 2, max from config
    // Check no duplicate events
    // Check no conflicting selections
    // Check all events are open/live
    // Check all markets allow parlay
    // Calculate combined odds
    // Check potential payout doesn't exceed max payout limit
  }
  
  calculateParlayOdds(selections: ParlaySelection[]): number {
    return selections.reduce((acc, sel) => acc * sel.odds, 1);
  }
  
  // BET BUILDER (Same Game Parlay)
  // Advanced feature: combine multiple markets from SAME event
  // e.g., Team A win + Over 2.5 goals + Player X to score
  // Requires correlation adjustment (outcomes aren't independent)
  // Correlation factor reduces combined odds slightly
  // This is complex — implement as Phase 2
}
```

---

## 8. LIVE BETTING SYSTEM

### File: `src/services/LiveBettingService.ts`

```typescript
export class LiveBettingService {
  
  // Live betting has special requirements:
  
  // 1. BET DELAY
  //    When a user places a live bet, there's a delay (default 5 seconds)
  //    During this delay, odds may change
  //    After delay: re-check odds
  //    - If odds same or better for user → accept
  //    - If odds worse but within tolerance (2%) → accept at new odds
  //    - If odds worse beyond tolerance → reject, user must re-submit
  //    - If market suspended during delay → reject
  
  // 2. DANGER ZONE
  //    During critical moments (goals, penalties, red cards), 
  //    all markets are AUTOMATICALLY SUSPENDED for 10-30 seconds
  //    Visual indicator: RED overlay on frontend
  //    No bets accepted during suspension
  //    Resume after odds are recalculated
  
  // 3. LIVE MARKET STATES
  //    OPEN: accepting bets
  //    SUSPENDED: temporarily not accepting bets (danger zone)
  //    CLOSED: market finalized, no more bets
  
  // 4. REAL-TIME UPDATES (Socket.IO events)
  //    "live:odds-update" → { eventId, markets: [{ id, selections: [{ id, odds }] }] }
  //    "live:score-update" → { eventId, homeScore, awayScore, period, minute }
  //    "live:market-suspend" → { eventId, marketId, reason }
  //    "live:market-resume" → { eventId, marketId }
  //    "live:event-update" → { eventId, stats: { corners, cards, possession, etc. } }
  //    "live:event-finish" → { eventId, finalScore }
  
  // 5. LIVE STATS (from Goalserve or similar)
  //    - Match clock / period
  //    - Score
  //    - Possession %
  //    - Shots / Shots on target
  //    - Corners
  //    - Cards (yellow/red)
  //    - Ball position (x, y coordinates for match tracker)
  
  async placeLiveBet(userId: string, betRequest: LiveBetRequest): Promise<LiveBetResult> {
    // 1. Check market is OPEN (not suspended)
    // 2. Start delay timer (liveBetDelay from site_config)
    // 3. After delay:
    //    a. Re-fetch current odds
    //    b. Check market still open
    //    c. Compare odds with user's submitted odds
    //    d. Apply acceptance logic (accept/reject/new-odds)
    //    e. If accepted: process bet same as regular bet
    // 4. Return result to user
  }
  
  // Socket.IO rooms structure:
  // "sport:{sportId}" — all events for a sport
  // "event:{eventId}" — specific event updates
  // "live:all" — all live events (for live lobby)
  // Users auto-join relevant rooms when viewing pages
}
```

---

## 9. ADMIN DASHBOARD — COMPLETE BACKEND

### All Admin API Routes

```typescript
// File: src/routes/admin/index.ts
// All routes require: auth middleware + admin role check

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
GET    /api/v1/admin/dashboard/stats
  // Returns: {
  //   revenue: { today, thisWeek, thisMonth, allTime },
  //   users: { total, activeToday, newToday, online },
  //   bets: { totalOpen, totalToday, totalStakesToday, totalPayoutsToday },
  //   deposits: { countToday, volumeToday },
  //   withdrawals: { pendingCount, pendingVolume },
  //   casino: { roundsToday, revenueToday },
  //   alerts: { critical: number, warning: number }
  // }

GET    /api/v1/admin/dashboard/charts
  // Query: ?period=7d|30d|90d|1y
  // Returns: {
  //   revenueChart: [{ date, revenue, deposits, withdrawals }],
  //   userGrowthChart: [{ date, newUsers, activeUsers }],
  //   betVolumeChart: [{ date, betCount, stakeVolume }],
  //   sportPopularity: [{ sport, betCount, percentage }]
  // }

GET    /api/v1/admin/dashboard/activity
  // Returns: real-time activity feed (last 50 actions)
  // [{ type, message, user, amount, timestamp }]
  // Types: DEPOSIT, WITHDRAWAL, BET_PLACED, BET_WON, REGISTRATION, etc.

// ═══════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/users
  // Query: ?search=&status=&sortBy=&page=&limit=
  // Returns paginated user list with: id, email, nickname, balance, status, kycLevel, 
  //   totalBets, totalDeposits, registeredAt, lastLogin, riskScore

GET    /api/v1/admin/users/:id
  // Returns FULL user detail:
  // { profile, balances (per currency), kycStatus, documents,
  //   recentBets (last 20), recentTransactions (last 20),
  //   loginHistory (last 10), activeSessionsCount,
  //   riskProfile, notes (admin notes), tags }

PUT    /api/v1/admin/users/:id/status
  // Body: { status: 'ACTIVE' | 'SUSPENDED' | 'BANNED', reason: string }
  // SUSPENDED: can't bet, can withdraw
  // BANNED: can't login

POST   /api/v1/admin/users/:id/adjust-balance
  // Body: { currency, amount (positive=credit, negative=debit), reason }
  // Creates transaction record with admin audit trail
  // Requires: reason is mandatory

PUT    /api/v1/admin/users/:id/reset-password
  // Forces password reset, sends email to user

PUT    /api/v1/admin/users/:id/reset-2fa
  // Disables user's 2FA (for support cases)

POST   /api/v1/admin/users/:id/notes
  // Body: { note: string }
  // Internal admin notes on user (not visible to user)

PUT    /api/v1/admin/users/:id/limits
  // Body: { maxStake, maxDailyBets, maxDailyDeposit, customOddsMargin }
  // Set per-user risk limits

GET    /api/v1/admin/users/:id/sessions
  // Returns active sessions with: device, browser, IP, location, lastActive

DELETE /api/v1/admin/users/:id/sessions/:sessionId
  // Revoke specific session

// ═══════════════════════════════════════════
// FINANCIAL MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/withdrawals
  // Query: ?status=PENDING|APPROVED|REJECTED&page=&limit=
  // Returns: list with user info, amount, currency, address, kycLevel, requestedAt

PUT    /api/v1/admin/withdrawals/:id/approve
  // Processes the withdrawal (sends crypto)

PUT    /api/v1/admin/withdrawals/:id/reject
  // Body: { reason: string }
  // Returns funds to user wallet, sends notification

POST   /api/v1/admin/withdrawals/batch-approve
  // Body: { withdrawalIds: string[] }
  // Approve multiple withdrawals at once

GET    /api/v1/admin/deposits
  // Query: ?status=&currency=&page=&limit=
  // List all deposits

GET    /api/v1/admin/transactions
  // Query: ?type=&userId=&currency=&dateFrom=&dateTo=&page=&limit=
  // Full transaction ledger

GET    /api/v1/admin/revenue
  // Query: ?period=today|week|month|year&groupBy=day|sport|game
  // Revenue breakdown

GET    /api/v1/admin/revenue/ggr
  // Gross Gaming Revenue = total stakes - total payouts
  // Broken down by: sport, casino game, time period

// ═══════════════════════════════════════════
// ODDS API MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/odds-providers
  // List all configured providers with status

POST   /api/v1/admin/odds-providers
  // Body: { name, type, apiKey, apiUrl, priority, enabled, config }
  // Add new provider

PUT    /api/v1/admin/odds-providers/:id
  // Update provider settings (apiKey, priority, etc.)

PUT    /api/v1/admin/odds-providers/:id/toggle
  // Enable/disable a provider

GET    /api/v1/admin/odds-providers/:id/stats
  // Returns: { requestsUsed, requestsRemaining, lastSync, errorCount, avgLatency }

PUT    /api/v1/admin/odds-providers/priority
  // Body: { prematch: ['the-odds-api', 'oddspapi'], live: ['goalserve', 'the-odds-api'] }
  // Set priority order for pre-match and live contexts

POST   /api/v1/admin/odds-sync/trigger
  // Body: { sportKey?: string, provider?: string }
  // Manually trigger odds sync

GET    /api/v1/admin/odds-sync/logs
  // Query: ?provider=&status=&page=&limit=
  // Sync history with: provider, sport, eventsUpdated, duration, errors

// ═══════════════════════════════════════════
// SPORTS & BETTING MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/sports
  // List all sports with: enabled, eventCount, betCount, margin

PUT    /api/v1/admin/sports/:id
  // Body: { enabled, margin, minStake, maxStake, maxPayout, maxLiability }
  // Configure per-sport settings

GET    /api/v1/admin/events
  // Query: ?sport=&status=UPCOMING|LIVE|FINISHED&date=&page=&limit=

PUT    /api/v1/admin/events/:id/suspend
  // Suspend all betting on an event

PUT    /api/v1/admin/events/:id/resume
  // Resume betting

PUT    /api/v1/admin/events/:id/result
  // Body: { homeScore, awayScore, status: 'FINISHED' }
  // Manually set result (triggers settlement)

POST   /api/v1/admin/events/:id/void
  // Void all bets on event (returns all stakes)

GET    /api/v1/admin/events/:id/exposure
  // Returns liability/exposure breakdown per market and selection

GET    /api/v1/admin/bets
  // Query: ?status=&userId=&eventId=&minStake=&maxStake=&page=&limit=

PUT    /api/v1/admin/bets/:id/void
  // Void specific bet (return stake)

PUT    /api/v1/admin/bets/:id/settle
  // Body: { outcome: 'WON'|'LOST'|'VOID', payout?: number }
  // Manually settle a bet

// ═══════════════════════════════════════════
// CASINO MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/casino/games
  // List all games with: enabled, totalRounds, revenue, houseEdge

PUT    /api/v1/admin/casino/games/:id
  // Body: { enabled, houseEdge, minBet, maxBet }

GET    /api/v1/admin/casino/rounds
  // Query: ?game=&userId=&page=&limit=
  // Audit trail of all game rounds

GET    /api/v1/admin/casino/revenue
  // Revenue by game, by time period

// ═══════════════════════════════════════════
// CURRENCY & PAYMENT MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/currencies
POST   /api/v1/admin/currencies
PUT    /api/v1/admin/currencies/:id
DELETE /api/v1/admin/currencies/:id

GET    /api/v1/admin/networks
POST   /api/v1/admin/networks
PUT    /api/v1/admin/networks/:id
DELETE /api/v1/admin/networks/:id

PUT    /api/v1/admin/currencies/:id/toggle
  // Enable/disable currency

PUT    /api/v1/admin/currencies/:id/rate
  // Body: { exchangeRate: number }
  // Manual rate update

POST   /api/v1/admin/currencies/rates/sync
  // Auto-fetch rates from CoinGecko API

// ═══════════════════════════════════════════
// KYC MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/kyc/pending
  // List users with pending KYC documents

GET    /api/v1/admin/kyc/:userId
  // View user's KYC details and uploaded documents

PUT    /api/v1/admin/kyc/:userId/approve
  // Body: { level: 'BASIC' | 'FULL' }
  // Approve KYC, upgrade user level

PUT    /api/v1/admin/kyc/:userId/reject
  // Body: { reason: string, documentIds: string[] }
  // Reject with reason, user must re-upload

// ═══════════════════════════════════════════
// PROMOTIONS MANAGEMENT
// ═══════════════════════════════════════════
GET    /api/v1/admin/promotions
POST   /api/v1/admin/promotions
PUT    /api/v1/admin/promotions/:id
DELETE /api/v1/admin/promotions/:id
PUT    /api/v1/admin/promotions/:id/toggle

GET    /api/v1/admin/promo-codes
POST   /api/v1/admin/promo-codes
  // Body: { code, type: 'DEPOSIT_BONUS'|'FREE_BET'|'CASHBACK', value, maxUses, expiresAt }
DELETE /api/v1/admin/promo-codes/:id

// ═══════════════════════════════════════════
// SITE CONFIGURATION
// ═══════════════════════════════════════════
GET    /api/v1/admin/settings
  // Returns all site configuration key-value pairs

PUT    /api/v1/admin/settings
  // Body: { key: value, ... }
  // Updatable settings:
  {
    // Betting
    "minBetAmount": 1,
    "maxBetAmount": 10000,
    "maxParlayLegs": 15,
    "maxPayoutPerBet": 50000,
    "defaultOddsMargin": 5,
    "liveBetDelay": 5,         // seconds
    "cashoutEnabled": true,
    "cashoutMargin": 5,        // percentage
    "oddsChangeThreshold": 2,  // percentage - reject bet if odds changed more
    
    // Platform
    "maintenanceMode": false,
    "registrationEnabled": true,
    "minimumAge": 18,
    
    // KYC & Limits
    "kycRequiredForWithdrawal": true,
    "maxWithdrawalWithoutKyc": 2200,
    "withdrawalAutoApproveLimit": 500, // auto-approve if below this
    
    // Odds API
    "oddsApiPrematchPrimary": "the-odds-api",
    "oddsApiLivePrimary": "goalserve",
    "oddsApiAutoFallback": true,
    "oddsSyncIntervalPreMatch": 60,    // seconds
    "oddsSyncIntervalLive": 10,        // seconds
    
    // Risk Management
    "maxMarketLiability": 10000,
    "autoSuspendLiabilityPercent": 80,
    "maxUserRiskScore": 80,           // above this → restrict account
    
    // Casino
    "crashGameHouseEdge": 3,
    "diceGameHouseEdge": 2,
    "minesGameHouseEdge": 3,
    "plinkoGameHouseEdge": 3,
    "coinflipGameHouseEdge": 3,
  }

// ═══════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════
GET    /api/v1/admin/reports/revenue
  // Query: ?from=&to=&groupBy=day|week|month&type=sport|casino|total

GET    /api/v1/admin/reports/users
  // Query: ?from=&to=
  // Returns: signups, active users, retention rate, churn

GET    /api/v1/admin/reports/bets
  // Query: ?from=&to=&sport=
  // Returns: volume, win/loss ratio, average stake, popular markets

GET    /api/v1/admin/reports/risk
  // Returns: high-risk users, unusual betting patterns, liability alerts

GET    /api/v1/admin/reports/providers
  // Returns: API usage, quota consumption, sync errors per provider

// ═══════════════════════════════════════════
// RISK & ALERTS
// ═══════════════════════════════════════════
GET    /api/v1/admin/alerts
  // Active alerts: large withdrawals, suspicious patterns, API errors, etc.

PUT    /api/v1/admin/alerts/:id/acknowledge
  // Mark alert as seen

GET    /api/v1/admin/risk/exposure
  // Real-time platform exposure across all events

GET    /api/v1/admin/risk/users
  // List users by risk score (highest first)
```

---

## 10. ADMIN DASHBOARD — COMPLETE FRONTEND

### Location: `src/app/admin/` (Next.js pages)

### Layout: `src/app/admin/layout.tsx`

```
Sidebar (240px, dark, fixed):
  Logo: "CryptoBet Admin"
  Nav items (with icons):
    📊 Dashboard        /admin
    👥 Users            /admin/users
    💰 Finance          /admin/finance
    🏈 Sports           /admin/sports
    🎰 Casino           /admin/casino
    🔗 Odds APIs        /admin/odds-providers
    💳 Payments         /admin/payments
    📋 KYC              /admin/kyc
    🎁 Promotions       /admin/promotions
    ⚙️  Settings         /admin/settings
    📈 Reports          /admin/reports
    🔔 Alerts           /admin/alerts (with red badge for count)

Header:
  Breadcrumb path
  Search bar
  Alert bell (with count)
  Admin avatar + dropdown (profile, logout)
```

### Pages to Build:

**Page: `/admin` (Dashboard)**
- 4 KPI cards: Revenue Today, Active Users, Open Bets, Pending Withdrawals
- Revenue chart (line chart, last 30 days)
- User growth chart (area chart)
- Sport popularity (donut chart)
- Real-time activity feed (scrolling list)
- Alert summary (critical + warning counts)

**Page: `/admin/users` (User Management)**
- Search bar + filters (status, KYC level, risk tier)
- Sortable table: avatar, email, nickname, balance, status, KYC, risk score, joined, actions
- Click row → user detail slide-over or page
- User detail: tabs (Profile, Bets, Transactions, Sessions, Risk, Notes)
- Action buttons: Ban, Suspend, Adjust Balance, Reset Password, Reset 2FA

**Page: `/admin/finance` (Financial Management)**
- Tabs: Withdrawals, Deposits, Transactions, Revenue
- Withdrawal queue: table with approve/reject buttons, batch approve
- Revenue cards: GGR, NGR, by period

**Page: `/admin/sports` (Sports Management)**
- Sports list with toggle switches
- Click sport → settings: margin, limits, liability caps
- Events table with status, exposure, suspend/resume buttons
- Bets table with void/settle options

**Page: `/admin/odds-providers` (Odds API Management)**
- Provider cards: name, status, priority, quota usage bar, last sync, error count
- Add provider button → modal form
- Drag to reorder priority
- Sync logs table
- Manual sync trigger button

**Page: `/admin/settings` (Site Configuration)**
- Grouped settings with appropriate input types:
  - Toggles for boolean settings
  - Number inputs with min/max
  - Text inputs for strings
- Save button with confirmation
- Reset to defaults option

**Page: `/admin/reports` (Reports)**
- Date range selector
- Report type tabs: Revenue, Users, Bets, Risk, API Usage
- Charts + data tables
- Export to CSV button

**Page: `/admin/alerts` (Alerts & Monitoring)**
- Alert list with severity colors (red=critical, yellow=warning, blue=info)
- Acknowledge button
- Alert types: Large Withdrawal, High Risk User, API Down, High Liability, Suspicious Pattern

### Design for Admin Pages:
- Use same dark theme as main site
- Tables: use `@tanstack/react-table` for sorting/filtering/pagination
- Charts: use `recharts` library
- Cards: clean borders, subtle shadows
- Colors: keep the purple accent from main site
- All data auto-refreshes every 30 seconds
- Real-time updates via Socket.IO for activity feed and alerts

---

## 11. DATABASE SCHEMA ADDITIONS

### New Tables Needed:

```sql
-- Odds Providers configuration
CREATE TABLE odds_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'REST' | 'WEBSOCKET'
  api_key_encrypted TEXT,
  api_url VARCHAR(500),
  priority_prematch INTEGER DEFAULT 10,
  priority_live INTEGER DEFAULT 10,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  quota_limit INTEGER,
  quota_used INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Odds sync log
CREATE TABLE odds_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES odds_providers(id),
  sport_key VARCHAR(100),
  events_found INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  odds_updated INTEGER DEFAULT 0,
  duration_ms INTEGER,
  status VARCHAR(20), -- 'SUCCESS' | 'PARTIAL' | 'FAILED'
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Events table fields
-- Add to existing events table:
--   external_id VARCHAR(200)     -- ID from odds provider
--   provider_source VARCHAR(50)  -- which provider sourced this
--   home_score INTEGER DEFAULT 0
--   away_score INTEGER DEFAULT 0
--   period VARCHAR(50)           -- '1st Half', 'Q1', 'Set 2', etc.
--   clock VARCHAR(20)            -- '45:30', '12:00', etc.
--   stats JSONB                  -- { corners, cards, possession, etc. }
--   live_data JSONB              -- provider-specific live data

-- Market Liability tracking
CREATE TABLE market_liability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  market_id UUID REFERENCES markets(id),
  selection_id UUID REFERENCES selections(id),
  total_stakes DECIMAL(18,8) DEFAULT 0,
  total_potential_payout DECIMAL(18,8) DEFAULT 0,
  bet_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Risk Profile
CREATE TABLE user_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  risk_score INTEGER DEFAULT 0,
  risk_tier VARCHAR(20) DEFAULT 'LOW',
  total_bets INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  total_staked DECIMAL(18,8) DEFAULT 0,
  total_won DECIMAL(18,8) DEFAULT 0,
  roi DECIMAL(8,2) DEFAULT 0,
  flags JSONB DEFAULT '[]',
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Alerts
CREATE TABLE admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- 'INFO' | 'WARNING' | 'CRITICAL'
  title VARCHAR(200) NOT NULL,
  message TEXT,
  data JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Notes on Users
CREATE TABLE admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  admin_id UUID REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site Configuration
CREATE TABLE site_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'string', -- 'string' | 'number' | 'boolean' | 'json'
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Bets table fields
-- Add to existing bets table:
--   cash_out_amount DECIMAL(18,8)  -- if cashed out
--   cash_out_at TIMESTAMPTZ
--   settled_at TIMESTAMPTZ
--   settlement_source VARCHAR(20)  -- 'AUTO' | 'MANUAL'
--   provider_source VARCHAR(50)    -- which odds provider
```

---

## 12. ENVIRONMENT VARIABLES

```env
# Add to .env.example:

# Odds API Providers
THE_ODDS_API_KEY=your-key-here
THE_ODDS_API_REGIONS=eu,uk
GOALSERVE_API_KEY=your-key-here
GOALSERVE_WS_URL=wss://push.goalserve.com/ws
ODDSPAPI_API_KEY=your-key-here

# Odds Configuration
ODDS_SYNC_INTERVAL_PREMATCH=60
ODDS_SYNC_INTERVAL_LIVE=10
DEFAULT_ODDS_MARGIN=5

# Risk Management
MAX_BET_AMOUNT=10000
MAX_PAYOUT_PER_BET=50000
MAX_MARKET_LIABILITY=10000
LIVE_BET_DELAY=5

# Cash Out
CASHOUT_ENABLED=true
CASHOUT_MARGIN=5

# CoinGecko (for exchange rates)
COINGECKO_API_URL=https://api.coingecko.com/api/v3
```

---

## 13. TESTING & VALIDATION CHECKLIST

After implementing everything, verify:

### Odds System
- [ ] Sports list loads from API
- [ ] Events with odds display on sportsbook page
- [ ] Odds update in real-time (Socket.IO)
- [ ] Odds flash green (up) / red (down) on change
- [ ] Provider fallback works (disable primary, check secondary takes over)
- [ ] Provider quota tracking accurate
- [ ] Admin can add/remove/prioritize providers
- [ ] Admin can trigger manual sync
- [ ] Sync logs record correctly

### Betting
- [ ] Single bet placement works end-to-end
- [ ] Parlay bet placement works (2-15 legs)
- [ ] Balance deducted on bet placement
- [ ] Bet appears in "My Bets" immediately
- [ ] Odds lock at time of bet placement
- [ ] Insufficient balance shows error
- [ ] Stake limits enforced (min/max)
- [ ] Max payout limit enforced
- [ ] Live bet delay works correctly
- [ ] Suspended market rejects bets

### Settlement
- [ ] Bets auto-settle when event finishes
- [ ] Won bets: balance credited correctly
- [ ] Lost bets: status updated, no payout
- [ ] Void/Push: stake returned
- [ ] Parlay with void leg: recalculated correctly
- [ ] Settlement is idempotent (no double-pay)
- [ ] User receives notification on settlement
- [ ] Settlement logged for audit

### Cash Out
- [ ] Cash out value calculates correctly
- [ ] Cash out executes, balance updated
- [ ] Cash out not available for settled bets
- [ ] Cash out disabled when setting is off

### Risk Management
- [ ] Liability tracking per market
- [ ] User risk profiles calculate
- [ ] Admin alerts trigger for thresholds
- [ ] Auto-suspend at liability threshold works

### Admin Dashboard
- [ ] All KPI stats display correctly
- [ ] Charts render with real data
- [ ] User management CRUD works
- [ ] Withdrawal approve/reject works
- [ ] Settings save and take effect immediately
- [ ] Odds provider management works
- [ ] Reports generate with date filters
- [ ] Alerts show and can be acknowledged
- [ ] Real-time activity feed updates

---

## IMPLEMENTATION ORDER

Build in this exact order:

1. **Database migrations** (new tables + table alterations)
2. **Site configuration service** (site_config table + CRUD)
3. **Odds providers CRUD** (admin endpoints + database)
4. **TheOddsApi provider** (start with free tier)
5. **OddsAggregator service** (single provider first)
6. **Odds sync queue jobs** (pre-match first)
7. **OddsEngine** (margin application)
8. **Frontend: sportsbook pages show real data**
9. **BetService** (single bet placement)
10. **ParlayService** (parlay bet placement)
11. **SettlementService** (auto-settlement)
12. **CashOutService**
13. **LiveBettingService** (with delay)
14. **RiskManagementService** (liability tracking)
15. **Admin dashboard backend** (all endpoints)
16. **Admin dashboard frontend** (all pages)
17. **GoalserveProvider** (add second provider)
18. **WebSocket live odds** (real-time updates)
19. **Testing & validation**

**Do NOT skip steps. Do NOT ask questions. Implement everything.**
**Test each step before moving to the next.**
**Use TypeScript for all backend code.**
**Use React + TailwindCSS for all frontend code.**
**Follow the existing project structure and patterns.**
