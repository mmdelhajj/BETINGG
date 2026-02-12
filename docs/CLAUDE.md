# CLAUDE.md — CryptoBet Platform

## Project Overview
CryptoBet is a full-stack cryptocurrency sportsbook + casino platform (Cloudbet clone).
Full specification is in `docs/full-system-spec.md` and `docs/additional-features.md`.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Zustand
- **Backend**: Fastify (Node.js), TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Realtime**: Redis (sessions, caching, pub/sub)
- **Queue**: BullMQ (bet processing, settlement, rewards, withdrawals, notifications)
- **WebSocket**: Socket.IO (live odds, live scores, crash game, notifications)
- **Crypto**: ethers.js (EVM), bitcoinjs-lib (BTC), @solana/web3.js (SOL)
- **Auth**: JWT + OAuth2 (Google, GitHub) + TOTP 2FA (speakeasy)
- **API**: REST (versioned /api/v1/) + GraphQL (Apollo Server)
- **Container**: Docker + Docker Compose + Nginx
- **Testing**: Vitest + Playwright

## Project Structure
```
cryptobet/
├── CLAUDE.md                    # This file
├── docs/
│   ├── full-system-spec.md      # Complete 8-agent specification
│   └── additional-features.md   # Extra features (academy, blog, virtual sports, etc.)
├── prisma/
│   ├── schema.prisma            # Full database schema
│   └── seed.ts                  # Seed data
├── src/
│   ├── server.ts                # Fastify entry point
│   ├── config/                  # Database, Redis, Queue, Constants
│   ├── lib/                     # Prisma client, Redis, Socket.IO
│   ├── middleware/               # Auth, Rate limit, Error handler, Admin guard
│   ├── modules/
│   │   ├── auth/                # Registration, Login, OAuth, 2FA, JWT
│   │   ├── users/               # Profile, Preferences, Responsible gambling
│   │   ├── wallets/             # Crypto wallets, Deposits, Withdrawals, Fiat on-ramp, WalletConnect, Swap
│   │   ├── kyc/                 # Document upload, Verification levels
│   │   ├── sports/              # Sports, Competitions, Events CRUD
│   │   ├── odds/                # Odds engine, Margins, Format conversion
│   │   ├── betting/             # Bet placement, Parlays, Bet Builder, Cash-out
│   │   ├── settlement/          # Auto-settlement, Payouts
│   │   ├── live/                # WebSocket live feed, Score updates
│   │   ├── casino/              # Game catalog, Provably fair games (Crash, Dice, Mines, Plinko, Coinflip)
│   │   ├── casino/providers/    # Game provider adapter, Mock provider
│   │   ├── vip/                 # 8-tier VIP system, Progression
│   │   ├── rewards/             # Rakeback, Calendar (3x daily), TURBO, Welcome Package, Level-Up
│   │   ├── promotions/          # Promo engine, Codes, Conditions
│   │   ├── referrals/           # Referral program, Tracking, Anti-fraud
│   │   ├── notifications/       # In-app, Email, Push (stubs)
│   │   ├── virtual-sports/      # 24/7 RNG virtual events
│   │   ├── academy/             # Courses, Lessons, Quizzes
│   │   └── blog/                # CMS for blog posts
│   ├── api/
│   │   ├── rest/                # Versioned REST routes (/api/v1/)
│   │   ├── graphql/             # Schema, Resolvers, Subscriptions
│   │   └── docs/                # Swagger/OpenAPI spec
│   ├── queues/                  # BullMQ processors
│   ├── services/                # Shared services (oddsEngine, rewardCalculator)
│   └── utils/                   # Helpers, Crypto utils, Validation
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (sportsbook)/    # Sports, Events, Live betting pages
│       │   ├── (casino)/        # Casino lobby, Game pages, Crash game
│       │   ├── (wallet)/        # Deposit, Withdraw, Transactions, Swap, Connect
│       │   ├── (account)/       # Profile, Security, KYC, Limits
│       │   ├── (rewards)/       # VIP dashboard, Calendar, Rakeback, Referral
│       │   ├── (academy)/       # Courses, Lessons
│       │   ├── (blog)/          # Blog listing, Post pages
│       │   ├── (help)/          # Help center, Articles
│       │   └── admin/           # Full admin dashboard
│       ├── components/          # Reusable UI components
│       ├── hooks/               # Custom hooks (useOdds, useBetSlip, useLive, useSocket)
│       ├── stores/              # Zustand stores (betSlip, user, wallet)
│       ├── lib/                 # WebSocket manager, API client, Odds formatter
│       └── locales/             # i18n translation files (19 languages)
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── docker-compose.yml
│   └── nginx.conf
├── scripts/                     # Backup, Deploy, Seed
└── .github/workflows/           # CI/CD pipeline
```

## Build Order (Agent Execution)
1. **Agent 1**: Database schema + Core infrastructure (Prisma, Redis, Queues, Server)
2. **Agent 2**: Auth + Users + KYC + Complete Wallet/Payment system
3. **Agent 3**: Sportsbook engine (Sports, Odds, Betting, Settlement, Live)
4. **Agent 4**: Casino + Provably fair games (Crash, Dice, Mines, Plinko)
5. **Agent 5**: VIP + Rewards + Promotions + Referrals + Notifications
6. **Agent 6**: Frontend — Sportsbook UI (Sports pages, Bet Slip, Live betting)
7. **Agent 7**: Frontend — Casino, Wallet, Account, VIP/Rewards UI
8. **Agent 8**: Admin Dashboard + Public API + Blog + Help Center + DevOps

## Key Conventions
- TypeScript strict mode everywhere
- Zod for ALL request validation
- Money as Decimal (Prisma) / string — NEVER float
- All timestamps UTC (ISO 8601)
- Error format: `{ success: false, error: { code, message, details? } }`
- Success format: `{ success: true, data, meta? }`
- Soft deletes where appropriate
- All secrets encrypted at rest
- Cursor-based pagination for public APIs
- Offset-based pagination for admin
