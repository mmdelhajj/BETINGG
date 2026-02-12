// GraphQL schema definition for CryptoBet platform
// Uses mercurius (Fastify's GraphQL adapter)

export const typeDefs = `
  scalar DateTime
  scalar Decimal

  # ─── Enums ───────────────────────────────────────────────
  enum EventStatus {
    UPCOMING
    LIVE
    ENDED
    CANCELLED
    POSTPONED
  }

  enum BetStatus {
    PENDING
    WON
    LOST
    VOID
    CASHED_OUT
    PARTIALLY_CASHED_OUT
  }

  enum BetType {
    SINGLE
    PARLAY
    SYSTEM
  }

  enum OddsChangePolicy {
    ACCEPT_ANY
    ACCEPT_BETTER
    NONE
  }

  # ─── Types ───────────────────────────────────────────────
  type Sport {
    id: ID!
    name: String!
    slug: String!
    iconUrl: String
    isActive: Boolean!
    competitionCount: Int!
    competitions: [Competition!]!
  }

  type Competition {
    id: ID!
    name: String!
    slug: String!
    country: String
    sportId: String!
    eventCount: Int!
    events(status: EventStatus, limit: Int): [Event!]!
  }

  type Event {
    id: ID!
    name: String!
    homeTeam: String!
    awayTeam: String!
    status: EventStatus!
    startsAt: DateTime!
    homeScore: Int
    awayScore: Int
    isLive: Boolean!
    isFeatured: Boolean!
    competition: Competition!
    sport: Sport!
    markets: [Market!]!
  }

  type Market {
    id: ID!
    name: String!
    type: String!
    isActive: Boolean!
    isSuspended: Boolean!
    selections: [Selection!]!
  }

  type Selection {
    id: ID!
    name: String!
    odds: Decimal!
    isActive: Boolean!
    status: String!
  }

  type Account {
    id: ID!
    username: String!
    email: String!
    vipTier: String!
    kycLevel: String!
    createdAt: DateTime!
  }

  type Balance {
    currency: String!
    balance: Decimal!
    bonusBalance: Decimal!
    lockedBalance: Decimal!
  }

  type Bet {
    id: ID!
    referenceId: String!
    type: BetType!
    status: BetStatus!
    stake: Decimal!
    currency: String!
    totalOdds: Decimal!
    potentialWin: Decimal!
    payout: Decimal
    legs: [BetLeg!]!
    createdAt: DateTime!
    settledAt: DateTime
  }

  type BetLeg {
    id: ID!
    selectionId: String!
    selectionName: String
    eventName: String
    odds: Decimal!
    status: String!
  }

  type BetConnection {
    bets: [Bet!]!
    total: Int!
    hasMore: Boolean!
  }

  type BetResult {
    referenceId: String!
    status: BetStatus!
    stake: Decimal!
    totalOdds: Decimal!
    potentialWin: Decimal!
  }

  type CashOutResult {
    referenceId: String!
    status: String!
    cashoutAmount: Decimal!
  }

  # ─── Subscriptions ─────────────────────────────────────
  type MarketUpdate {
    eventId: ID!
    marketId: ID!
    selections: [SelectionUpdate!]!
  }

  type SelectionUpdate {
    id: ID!
    odds: Decimal!
    isActive: Boolean!
  }

  type ScoreUpdate {
    eventId: ID!
    homeScore: Int!
    awayScore: Int!
    gameTime: String
  }

  type BetStatusUpdate {
    referenceId: String!
    status: BetStatus!
    payout: Decimal
  }

  # ─── Inputs ────────────────────────────────────────────
  input PlaceBetInput {
    selections: [BetSelectionInput!]!
    stake: Decimal!
    currency: String!
    type: BetType
    oddsChangePolicy: OddsChangePolicy
  }

  input BetSelectionInput {
    selectionId: ID!
    odds: Decimal
  }

  # ─── Root Types ────────────────────────────────────────
  type Query {
    sports: [Sport!]!
    sport(slug: String!): Sport
    competitions(sportId: ID!): [Competition!]!
    events(sportKey: String, status: EventStatus, limit: Int, offset: Int): [Event!]!
    event(id: ID!): Event
    odds(eventId: ID!): [Market!]!
    account: Account!
    balance(currency: String!): Balance!
    betHistory(limit: Int, offset: Int, status: BetStatus): BetConnection!
    bet(referenceId: String!): Bet
  }

  type Mutation {
    placeBet(input: PlaceBetInput!): BetResult!
    cashOut(betId: ID!, amount: Decimal): CashOutResult!
    cancelBet(betId: ID!): Boolean!
  }

  type Subscription {
    oddsUpdate(eventId: ID!): MarketUpdate!
    scoreUpdate(eventId: ID!): ScoreUpdate!
    betStatus(referenceId: String!): BetStatusUpdate!
  }
`;
