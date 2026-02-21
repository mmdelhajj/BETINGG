# 🎯 MASTER GUIDE — Exact Messages for Claude Code

## Your Platform: CryptoBet (Cloudbet Clone)
## Tech Stack: Next.js + Fastify + PostgreSQL + Redis + Socket.IO + Prisma
## Running at: http://10.0.0.184:3000

---

# 📋 WHAT YOU HAVE (10 Files)

| File | Size | What It Covers |
|------|------|----------------|
| `CLAUDE.md` | Project overview | Tech stack, conventions, rules |
| `cryptobet-full-system-prompt.md` | BIGGEST FILE | Complete 8-agent spec, ALL database schemas, VIP, rewards, referral |
| `cryptobet-additional-features.md` | Extra features | Blog, Academy, Affiliate, Virtual Sports, i18n, Geo-restriction |
| `FRONTEND-REDESIGN-PROMPT.md` | UI redesign | 16 pages, design system, Cloudbet-style |
| `INTERNAL-FEATURES-PROMPT.md` | Core features | Auth, OAuth, 2FA, Wallets, KYC, Notifications |
| `ADMIN-AND-ODDS-INTEGRATION-PROMPT.md` | Sportsbook brain | Odds APIs, betting engine, settlement, admin dashboard |
| `CASINO-GAMES-PROMPT.md` | Casino | 15 games, provably fair, jackpot |
| `cloudbet-analysis.md` | Research | Cloudbet analysis (reference only) |
| `PASTE-INTO-CLAUDE-CODE.md` | Old prompt | Original all-in-one prompt (REPLACED by this guide) |
| `HOW-TO-USE.md` | Old guide | (REPLACED by this guide) |

---

# 🗂️ STEP 0: SETUP FILES

Before starting Claude Code, copy all docs to your project:

```bash
# On your server (10.0.0.184), in your project folder:
mkdir -p docs

# Copy these files to ~/cryptobet/docs/ :
# - CLAUDE.md → project root (~/cryptobet/CLAUDE.md)
# - All other .md files → ~/cryptobet/docs/
```

Your project should look like:
```
~/cryptobet/
├── CLAUDE.md
├── docs/
│   ├── cryptobet-full-system-prompt.md
│   ├── cryptobet-additional-features.md
│   ├── FRONTEND-REDESIGN-PROMPT.md
│   ├── INTERNAL-FEATURES-PROMPT.md
│   ├── ADMIN-AND-ODDS-INTEGRATION-PROMPT.md
│   └── CASINO-GAMES-PROMPT.md
├── src/
│   ├── app/          (Next.js frontend)
│   └── server/       (Fastify backend)
├── prisma/
│   └── schema.prisma
├── package.json
└── ...
```

---

# 🚀 EXECUTION PLAN — 7 STEPS (In Order)

## STEP 1: DATABASE & INFRASTRUCTURE
**What:** Create ALL database tables, setup server, Redis, queues
**Time estimate:** 1 Claude Code session

### Paste this into Claude Code:

```
Read CLAUDE.md and docs/cryptobet-full-system-prompt.md (AGENT 1 section only).

Implement AGENT 1 — Database & Core Infrastructure:

1. Create complete Prisma schema with ALL tables:
   - users, wallets, currencies, currency_networks, transactions
   - admin_wallets, fiat_on_ramp_providers
   - sports, competitions, events, markets, selections
   - bets, bet_legs
   - casino_games, game_providers, casino_sessions, provably_fair_seeds
   - casino_rounds, active_casino_games, crash_rounds, crash_bets (from docs/CASINO-GAMES-PROMPT.md section 23)
   - jackpot_pool, casino_game_config (from docs/CASINO-GAMES-PROMPT.md section 23)
   - vip_tier_configs, rewards, turbo_sessions, welcome_packages
   - promotions, promo_claims, promo_codes
   - referrals, notifications, kyc_documents
   - api_keys, audit_logs, site_configs
   - odds_providers, odds_sync_logs, market_liability, user_risk_profiles, admin_alerts, admin_user_notes (from docs/ADMIN-AND-ODDS-INTEGRATION-PROMPT.md section 11)
   - blog_posts, help_articles
   - academy_courses, academy_lessons, user_course_progress
   - geo_restrictions, affiliates, affiliate_players

2. Create seed data:
   - 40+ cryptocurrencies with networks (BTC, ETH, USDT, BNB, SOL, DOGE, XRP, ADA, etc.)
   - 35+ sports (Football, Basketball, Tennis, etc.)
   - Sample competitions and events
   - 8 VIP tier configs (Bronze → Blue Diamond)
   - Casino game configs for 15 games (from docs/CASINO-GAMES-PROMPT.md)
   - Default site_config settings (from docs/ADMIN-AND-ODDS-INTEGRATION-PROMPT.md section 12)

3. Setup Fastify server with: CORS, helmet, rate-limit, swagger, socket.io
4. Setup Prisma client, Redis client, Socket.IO
5. Setup BullMQ queues: bet-processing, bet-settlement, reward-calculation, withdrawal-processing, deposit-detection, notification-sender, odds-sync
6. Create middleware: auth (JWT), rateLimit, errorHandler, logger, adminGuard, geoRestriction
7. Run migrations, seed database, verify server starts

Do NOT ask questions. Build everything.
```

---

## STEP 2: AUTH, USERS, WALLETS, KYC
**What:** Registration, login, OAuth, 2FA, crypto wallets, KYC
**Time estimate:** 1 Claude Code session

### Paste this into Claude Code:

```
Read docs/INTERNAL-FEATURES-PROMPT.md COMPLETELY.

Implement ALL 11 features from that file:

1. FEATURE 1: User Registration & Login (email/password, JWT, refresh tokens)
2. FEATURE 2: Google OAuth Login
3. FEATURE 3: GitHub OAuth Login
4. FEATURE 4: Two-Factor Authentication (TOTP with QR code)
5. FEATURE 5: Crypto Wallet System (deposit, withdrawal, swap, multi-currency)
6. FEATURE 6: KYC Verification System (3 levels, document upload, admin review)
7. FEATURE 7: WalletConnect (MetaMask, Ledger, Trust Wallet)
8. FEATURE 8: Account Settings (profile, security, preferences)
9. FEATURE 9: Notification System (in-app bell, email templates)
10. FEATURE 10: Live Chat Widget
11. FEATURE 11: Admin Dashboard basic panels

Build both backend AND frontend for each feature.
Every feature must be FULLY WORKING, not stubs.
Do NOT ask questions. Build everything.
```

---

## STEP 3: VIP, REWARDS, PROMOTIONS, REFERRALS
**What:** The rewards engine that keeps users coming back
**Time estimate:** 1 Claude Code session

### Paste this into Claude Code:

```
Read docs/cryptobet-full-system-prompt.md — AGENT 5 section (Complete Rewards, VIP & Promotions Engine).

Implement the COMPLETE rewards system:

1. VIP TIER SYSTEM (8 tiers):
   - Bronze (0), Silver (5K), Gold (25K), Platinum (100K), Diamond (500K), Elite (2M), Black Diamond (10M), Blue Diamond (50M)
   - Configurable wagering thresholds from admin
   - Auto tier-up on wagering milestones
   - Tier badges and progress bar UI

2. RAKEBACK ENGINE:
   - Calculate rakeback on every bet (casino + sports)
   - Base rates: Bronze 0.5%, Silver 1%, Gold 1.5%, up to Blue Diamond 5%
   - Split rakeback: 50% instant to wallet, 50% to rewards calendar
   - Track weekly/monthly rakeback totals

3. REWARDS CALENDAR:
   - 3 daily claim windows (every 12 hours)
   - Daily, weekly, monthly reward tiers based on VIP level
   - Claim button with animation
   - Calendar grid UI showing available/claimed/locked

4. TURBO MODE:
   - Activated on calendar claim
   - Duration: 90 minutes
   - Boost: up to 25% extra on all winnings
   - Countdown timer in header
   - Visual indicator (glowing effect)

5. WELCOME PACKAGE:
   - New users get: $2,500 over 30 days, 10% rakeback, daily drops
   - Day 30: Cash Vault unlock
   - Progress tracker UI
   - Auto-expire after 30 days

6. LEVEL-UP REWARDS:
   - Wagering milestones: $1K, $5K, $10K, $50K, $100K, $500K, $1M, $2.5M
   - Each milestone = bonus payout
   - Progress bar showing next milestone

7. PROMOTIONS ENGINE:
   Backend:
   - POST /api/v1/admin/promotions (create: deposit bonus, free bet, odds boost, cashback, tournament)
   - Promo conditions: min deposit, wagering requirement, max bonus, expiry
   - Promo codes: generate, validate, redeem
   - Schedule promotions (start/end dates)
   Frontend:
   - /promotions page with active offers
   - Promo code input on deposit page
   - "Claim" buttons on available promotions

8. REFERRAL PROGRAM:
   - Generate unique referral code per user
   - Track: signups, deposits, wagering by referred users
   - Tiered rewards: 1 referral = $5, 5 refs = $50, 25 refs = $500
   - Anti-fraud: require referred user to deposit + wager minimum
   - Dashboard UI: share link, stats, earnings

9. NOTIFICATION SERVICE (enhance what exists):
   - Notification types: BET_WON, BET_LOST, DEPOSIT_CONFIRMED, WITHDRAWAL_APPROVED, VIP_LEVEL_UP, PROMO_AVAILABLE, REFERRAL_SIGNUP
   - Bell icon with unread count in header
   - Notification panel (slide-over)
   - Email templates for each type (HTML emails)
   - User preferences: toggle each notification type on/off

Build backend services + API endpoints + frontend pages + Socket.IO real-time updates.
Do NOT ask questions. Build everything.
```

---

## STEP 4: SPORTSBOOK ENGINE + ODDS + ADMIN
**What:** The entire sportsbook brain — odds, betting, settlement, admin
**Time estimate:** 1-2 Claude Code sessions (BIGGEST step)

### Paste this into Claude Code:

```
Read docs/ADMIN-AND-ODDS-INTEGRATION-PROMPT.md COMPLETELY (all 13 sections).

Implement EVERYTHING in that file in this exact order:

SECTION 1: Multi-API Odds Integration (The Odds API + Goalserve + OddsPapi providers)
SECTION 2: Odds Engine & Margin System
SECTION 3: Bet Placement System (single + parlay + validation)
SECTION 4: Bet Settlement System (auto-settle, parlay logic, void handling)
SECTION 5: Cash Out System (full + partial)
SECTION 6: Risk Management System (5 levels)
SECTION 7: Parlay / Accumulator System
SECTION 8: Live Betting System (bet delay, danger zones, Socket.IO)
SECTION 9: Admin Dashboard — ALL backend endpoints (80+ API routes)
SECTION 10: Admin Dashboard — ALL frontend pages (Dashboard, Users, Finance, Sports, Odds Providers, Casino, Settings, Reports, Alerts)
SECTION 11: Database migrations for new tables (if not already created)
SECTION 12: Environment variables
SECTION 13: Testing & validation

Follow the implementation order in the file (19 steps).
Do NOT skip any endpoint or page.
Do NOT ask questions. Build everything.
```

---

## STEP 5: CASINO GAMES (15 Games)
**What:** All casino games with provably fair system
**Time estimate:** 1-2 Claude Code sessions

### Paste this into Claude Code:

```
Read docs/CASINO-GAMES-PROMPT.md COMPLETELY (all 24 sections).

Implement EVERYTHING in that file:

PHASE 1 — Core Engine:
- ProvablyFairService (HMAC-SHA256 seeds, verification)
- BaseGame class
- Database tables (if not already created)
- Fairness API endpoints + verification modal

PHASE 2 — Primary Games (5):
- Crash (multiplayer WebSocket, Canvas animation, 2 bet slots, auto-cashout)
- Dice (slider, over/under, multiplier calc)
- Mines (5×5 grid, progressive reveal, cash-out)
- Plinko (physics animation, 3 risk levels, 3 row options)
- Coinflip (3D coin flip animation)

PHASE 3 — Card Games (3):
- Blackjack (full rules, hit/stand/double/split/insurance)
- HiLo (card chain, progressive multiplier)
- Baccarat (Player/Banker/Tie)

PHASE 4 — Additional Games (4):
- Roulette (European wheel, betting board, chip placement)
- Wheel of Fortune (spinning wheel, segments)
- Tower/Stairs (grid climbing, 4 difficulty modes)
- Limbo (target multiplier)

PHASE 5 — More Games (3):
- Keno (number grid, 10 draws)
- Video Poker (Jacks or Better, hold/draw)
- Slots (3×3 grid, symbol weights, paylines)

PHASE 6 — Systems:
- Auto-bet (server-side, Martingale support, stop conditions)
- Jackpot (3-tier progressive: Mini/Major/Grand)
- Live feed (real-time bets across entire site)
- Casino lobby (game grid, categories, search)

ALL games must use provably fair — NEVER Math.random().
ALL bets must be atomic transactions.
ALL rounds must be recorded in casino_rounds table.
Do NOT ask questions. Build all 15 games.
```

---

## STEP 6: FRONTEND REDESIGN
**What:** Make everything look like Cloudbet — professional dark theme
**Time estimate:** 1-2 Claude Code sessions

### Paste this into Claude Code:

```
Read docs/FRONTEND-REDESIGN-PROMPT.md COMPLETELY.

Redesign the ENTIRE frontend to match Cloudbet's professional look.
Do NOT change any backend code. Only rebuild frontend files.

Implement:
- PART 1: Design System (colors, typography, spacing)
- PART 2: Global Layout (header, sidebar, bet slip, footer, mobile nav)
- PART 3: ALL 16 Pages:
  1. Homepage/Landing
  2. Sports Lobby
  3. Event Detail (single match)
  4. Live Betting
  5. Casino Lobby
  6. Casino Game Page
  7. Crash Game UI
  8. Dice Game UI
  9. Mines Game UI
  10. Plinko Game UI
  11. Coinflip Game UI
  12. Virtual Sports
  13. Wallet/Deposit
  14. Account Settings
  15. VIP & Rewards Dashboard
  16. My Bets Page

Design rules:
- Dark theme (backgrounds: #0D1117, #161B22, #1C2128)
- Accent: purple/blue (#8B5CF6)
- Professional, premium feel
- Responsive (mobile-first)
- Smooth animations (framer-motion)
- Real data from backend, NOT mock data

Do NOT ask questions. Rebuild everything.
```

---

## STEP 7: EXTRA FEATURES + POLISH
**What:** Blog, Help Center, Academy, i18n, Docker, final polish
**Time estimate:** 1 Claude Code session

### Paste this into Claude Code:

```
Read docs/cryptobet-additional-features.md COMPLETELY.

Implement these remaining features:

1. BLOG / CMS:
   - Admin: create/edit blog posts with Markdown editor
   - Frontend: /blog page with post list, /blog/:slug detail page
   - Categories, tags, featured image
   - SEO meta tags

2. HELP CENTER:
   - Admin: CRUD help articles with categories
   - Frontend: /help page, searchable, categorized
   - "Was this helpful?" feedback buttons

3. BETTING ACADEMY:
   - Admin: create courses with lessons
   - Frontend: /academy page, course list, lesson viewer
   - Progress tracking per user
   - Quiz/quiz questions (optional)

4. RESPONSIBLE GAMBLING (enhance):
   - Deposit limits (daily/weekly/monthly)
   - Loss limits
   - Session timeout (auto-logout after X hours)
   - Cooling-off period (24h/1w/1m)
   - Self-exclusion (6m/1y/permanent)
   - Reality check popup every 30 min
   - Settings page under Account → Responsible Gambling

5. SOCIAL BET SHARING:
   - Generate visual bet slip card (canvas/html2canvas)
   - Share to Twitter, Telegram, WhatsApp
   - Share link that shows bet details to anyone

6. GEO-RESTRICTION:
   - MaxMind GeoIP middleware
   - Block restricted countries (configurable from admin)
   - Show "not available in your region" page

7. DOCKER DEPLOYMENT:
   - Dockerfile.backend (Node.js + Fastify)
   - Dockerfile.frontend (Next.js)
   - docker-compose.yml (app + postgres + redis + nginx)
   - nginx.conf (reverse proxy, WebSocket upgrade, gzip)
   - .env.example with ALL variables documented

8. FINAL POLISH:
   - Run through entire app, fix any broken pages
   - Ensure all navigation links work
   - Ensure all API endpoints return proper errors
   - Add loading states / skeletons to all pages
   - Make sure mobile works on ALL pages
   - Create README.md with setup instructions

Do NOT ask questions. Build everything.
```

---

# ⚠️ IMPORTANT RULES FOR CLAUDE CODE

1. **ONE STEP AT A TIME** — Don't paste all 7 steps at once. Finish Step 1, then paste Step 2, etc.

2. **If Claude Code stops mid-step** — paste: `Continue where you left off. Do NOT restart from the beginning.`

3. **If Claude Code asks questions** — paste: `Do NOT ask questions. Make reasonable decisions and keep building. Read the docs files for specifications.`

4. **If something breaks** — paste: `Fix the error: [paste error message]. Then continue building.`

5. **If Claude Code says "done" but missed things** — paste: `You are NOT done. Check docs/[relevant-file].md and implement everything you missed. List what you built vs what the spec requires.`

6. **Between sessions** — Start new session with: `Read CLAUDE.md. Check what's already built in the codebase. Then continue with Step X from docs/[relevant-file].md`

---

# 📊 TOTAL COVERAGE MAP

| Feature | Covered In |
|---------|-----------|
| Database (50+ tables) | Step 1 + cryptobet-full-system-prompt.md |
| Auth/Login/Register | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| Google/GitHub OAuth | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| 2FA (TOTP) | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| Crypto Wallets (deposit/withdraw) | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| KYC Verification | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| WalletConnect (MetaMask) | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| Account Settings | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| Notifications | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| Live Chat | Step 2 + INTERNAL-FEATURES-PROMPT.md |
| VIP 8-Tier System | Step 3 + cryptobet-full-system-prompt.md |
| Rakeback Engine | Step 3 + cryptobet-full-system-prompt.md |
| Rewards Calendar | Step 3 + cryptobet-full-system-prompt.md |
| TURBO Mode | Step 3 + cryptobet-full-system-prompt.md |
| Welcome Package | Step 3 + cryptobet-full-system-prompt.md |
| Level-Up Rewards | Step 3 + cryptobet-full-system-prompt.md |
| Promotions Engine | Step 3 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Referral Program | Step 3 + cryptobet-full-system-prompt.md |
| Odds API Integration (3 APIs) | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Odds Engine & Margins | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Bet Placement | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Bet Settlement | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Cash Out | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Risk Management (5 levels) | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Parlay System | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Live Betting | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| Admin Dashboard (80+ endpoints) | Step 4 + ADMIN-AND-ODDS-INTEGRATION-PROMPT.md |
| 15 Casino Games | Step 5 + CASINO-GAMES-PROMPT.md |
| Provably Fair | Step 5 + CASINO-GAMES-PROMPT.md |
| Auto-Bet System | Step 5 + CASINO-GAMES-PROMPT.md |
| Jackpot System | Step 5 + CASINO-GAMES-PROMPT.md |
| Live Bets Feed | Step 5 + CASINO-GAMES-PROMPT.md |
| Professional UI (Cloudbet-style) | Step 6 + FRONTEND-REDESIGN-PROMPT.md |
| 16 Complete Pages | Step 6 + FRONTEND-REDESIGN-PROMPT.md |
| Mobile Responsive | Step 6 + FRONTEND-REDESIGN-PROMPT.md |
| Blog/CMS | Step 7 + cryptobet-additional-features.md |
| Help Center | Step 7 + cryptobet-additional-features.md |
| Betting Academy | Step 7 + cryptobet-additional-features.md |
| Responsible Gambling | Step 7 + cryptobet-additional-features.md |
| Bet Sharing (Social) | Step 7 + cryptobet-additional-features.md |
| Geo-Restriction | Step 7 + cryptobet-additional-features.md |
| Docker Deployment | Step 7 |
| README & Docs | Step 7 |

**TOTAL: 40+ major features, 15 casino games, 80+ admin endpoints, 16+ pages**

---

# 🔑 ENVIRONMENT VARIABLES NEEDED

Create `.env` file with these before starting:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cryptobet

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-random-256-bit-secret
JWT_REFRESH_SECRET=your-other-random-secret
GOOGLE_CLIENT_ID=get-from-console.cloud.google.com
GOOGLE_CLIENT_SECRET=get-from-google
GITHUB_CLIENT_ID=get-from-github.com/settings/developers
GITHUB_CLIENT_SECRET=get-from-github

# Odds APIs (get free keys)
THE_ODDS_API_KEY=get-free-from-the-odds-api.com
GOALSERVE_API_KEY=get-from-goalserve.com
ODDSPAPI_API_KEY=get-from-oddspapi.com

# Crypto (optional for now)
COINGECKO_API_URL=https://api.coingecko.com/api/v3

# App
NEXT_PUBLIC_APP_URL=http://10.0.0.184:3000
BACKEND_URL=http://10.0.0.184:3001
NODE_ENV=development
```

---

# ✅ YOU'RE READY!

Start with **Step 1** and work through to **Step 7**.
Each step = 1 Claude Code session (paste the message, let it build).
Total estimate: **7-10 Claude Code sessions** to build everything.
