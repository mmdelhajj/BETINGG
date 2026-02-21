# CLAUDE.md — CryptoBet Platform

## READ THIS FIRST — YOU HAVE 6 SPECIFICATION FILES

All specs are in the `docs/` folder:

```
docs/cryptobet-full-system-prompt.md      → Database schemas, VIP, rewards, referral, full 8-agent spec
docs/cryptobet-additional-features.md     → Blog, Academy, Affiliate, Virtual Sports, i18n, Geo-restriction
docs/INTERNAL-FEATURES-PROMPT.md          → Auth, OAuth, 2FA, Wallets, KYC, Notifications, Chat
docs/ADMIN-AND-ODDS-INTEGRATION-PROMPT.md → Odds APIs, betting engine, settlement, cash-out, risk, admin dashboard
docs/CASINO-GAMES-PROMPT.md              → 15 casino games, provably fair, jackpot, auto-bet
docs/FRONTEND-REDESIGN-PROMPT.md          → UI redesign, 16 pages, Cloudbet dark theme
```

## TECH STACK

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend:** Fastify + TypeScript + Prisma ORM
- **Database:** PostgreSQL
- **Cache:** Redis
- **Real-time:** Socket.IO
- **Queues:** BullMQ
- **Auth:** JWT (access + refresh) + bcrypt + TOTP (speakeasy)
- **Crypto:** ethers.js (EVM) + bitcoinjs-lib (BTC)

## CONVENTIONS

- All money stored as Decimal(18,8) — NEVER floating point
- All timestamps in UTC
- All IDs are UUID
- All API responses: `{ success: true, data: {...} }` or `{ success: false, error: { code, message } }`
- All user input validated with Zod
- TypeScript strict mode everywhere
- Casino randomness: ONLY provably fair HMAC-SHA256 — NEVER Math.random()

## RULES

1. Do NOT stop and ask questions — make reasonable decisions and keep building
2. Do NOT skip any feature — implement everything
3. Create real working code — not stubs or placeholders
4. After each step, immediately start the next step
5. If something breaks, fix it and continue

---

# BUILD PLAN — EXECUTE IN ORDER

---

## STEP 1 OF 7: DATABASE & SERVER INFRASTRUCTURE

Read `docs/cryptobet-full-system-prompt.md` — find the AGENT 1 section.
Read `docs/CASINO-GAMES-PROMPT.md` — find section 23 (Database Schema).
Read `docs/ADMIN-AND-ODDS-INTEGRATION-PROMPT.md` — find section 11 (Database Schema Additions).

Create complete Prisma schema with ALL these tables:

**Core:**
users, wallets, currencies, currency_networks, transactions, admin_wallets, fiat_on_ramp_providers

**Sportsbook:**
sports, competitions, events, markets, selections, bets, bet_legs

**Casino:**
casino_games, game_providers, casino_sessions, provably_fair_seeds, casino_rounds, active_casino_games, crash_rounds, crash_bets, jackpot_pool, casino_game_config, user_seeds

**Odds & Risk:**
odds_providers, odds_sync_logs, market_liability, user_risk_profiles, admin_alerts, admin_user_notes

**VIP & Rewards:**
vip_tier_configs, rewards, turbo_sessions, welcome_packages, promotions, promo_claims, referrals

**Users & Admin:**
notifications, kyc_documents, api_keys, audit_logs, site_configs, geo_restrictions

**Content:**
blog_posts, help_articles, academy_courses, academy_lessons, user_course_progress

**Affiliate:**
affiliates, affiliate_players

Create seed data:
- 40+ cryptocurrencies with networks
- 35+ sports
- Sample competitions and events with markets
- 8 VIP tiers (Bronze, Silver, Gold, Platinum, Diamond, Elite, Black Diamond, Blue Diamond)
- 15 casino game configs with house edges
- Default site settings

Setup server:
- Fastify with CORS, helmet, rate-limit, swagger, socket.io
- Prisma client + Redis client
- BullMQ queues: bet-processing, bet-settlement, reward-calculation, withdrawal-processing, deposit-detection, notification-sender, odds-sync
- Middleware: auth (JWT verify), rateLimit, errorHandler, logger, adminGuard

Run migrations. Seed database. Verify server starts.

THEN IMMEDIATELY START STEP 2.

---

## STEP 2 OF 7: AUTH, USERS, WALLETS, KYC

Read `docs/INTERNAL-FEATURES-PROMPT.md` COMPLETELY — implement ALL 11 features:

**FEATURE 1:** User Registration & Login
- POST /api/v1/auth/register (email, password, nickname, dateOfBirth)
- POST /api/v1/auth/login (returns JWT access + refresh tokens)
- POST /api/v1/auth/refresh (rotate refresh token)
- POST /api/v1/auth/forgot-password (send reset email)
- POST /api/v1/auth/reset-password (with token)
- Frontend: Register page, Login page, Forgot Password page

**FEATURE 2:** Google OAuth Login
- GET /api/v1/auth/google (redirect to Google)
- GET /api/v1/auth/google/callback (handle response, create/login user)
- Frontend: "Continue with Google" button

**FEATURE 3:** GitHub OAuth Login
- Same pattern as Google
- Frontend: "Continue with GitHub" button

**FEATURE 4:** Two-Factor Authentication (TOTP)
- POST /api/v1/auth/2fa/setup (generate secret + QR code)
- POST /api/v1/auth/2fa/verify (verify 6-digit code, enable 2FA)
- POST /api/v1/auth/2fa/disable (with code confirmation)
- Login flow: if 2FA enabled, require code after password
- Frontend: QR code display, 6-digit input, backup codes

**FEATURE 5:** Crypto Wallet System
- Multi-currency wallets (auto-create on registration)
- Deposit: generate unique address per currency, QR code, copy button, confirmation tracking
- Withdrawal: address input, amount, network fee display, 2FA confirmation, admin approval queue
- Swap: internal exchange between currencies using CoinGecko rates
- Frontend: Wallet page with balances, deposit tab, withdraw tab, swap tab, transaction history

**FEATURE 6:** KYC Verification
- 3 levels: Basic (email verified), Intermediate (ID upload), Advanced (proof of address)
- Each level unlocks higher withdrawal limits
- Document upload (passport, ID card, driver's license, utility bill)
- Admin review queue (approve/reject with reason)
- Frontend: KYC page showing current level, upload forms, status

**FEATURE 7:** WalletConnect
- Connect MetaMask, Ledger, Trust Wallet
- Sign message to verify wallet ownership
- One-click deposit from connected wallet
- Frontend: "Connect Wallet" button in header + wallet modal

**FEATURE 8:** Account Settings
- Profile: edit nickname, email, avatar, date of birth
- Security: change password, 2FA setup, active sessions (view/revoke)
- Preferences: theme (dark/light), odds format (decimal/fractional/american), language, timezone
- Frontend: Settings page with tabs

**FEATURE 9:** Notification System
- Types: BET_WON, BET_LOST, DEPOSIT_CONFIRMED, WITHDRAWAL_APPROVED, VIP_LEVEL_UP, PROMO_AVAILABLE
- Bell icon in header with unread count
- Notification panel (dropdown/slide-over)
- Mark as read, mark all as read
- Email notifications (HTML templates)
- User preferences: toggle each type on/off

**FEATURE 10:** Live Chat Widget
- Floating chat button (bottom-right)
- Chat window: message input, auto-replies for common questions
- Socket.IO for real-time messaging
- Admin can respond from admin dashboard

**FEATURE 11:** Admin Dashboard basic panels
- User management (list, search, view, ban/suspend)
- Transaction overview
- KYC review queue

Build both backend AND frontend for every feature. Everything must work.

THEN IMMEDIATELY START STEP 3.

---

## STEP 3 OF 7: VIP, REWARDS, PROMOTIONS, REFERRALS

Read `docs/cryptobet-full-system-prompt.md` — find the AGENT 5 section (Complete Rewards, VIP & Promotions Engine).

**VIP TIER SYSTEM (8 tiers):**
- Bronze (0 wagered), Silver ($5K), Gold ($25K), Platinum ($100K), Diamond ($500K), Elite ($2M), Black Diamond ($10M), Blue Diamond ($50M)
- Auto tier-up when wagering milestone reached
- API: GET /api/v1/vip/status, GET /api/v1/vip/tiers
- Frontend: VIP dashboard with tier badge, progress bar to next tier

**RAKEBACK ENGINE:**
- On every bet: calculate rakeback based on VIP tier
- Rates: Bronze 0.5%, Silver 1%, Gold 1.5%, Platinum 2%, Diamond 2.5%, Elite 3%, Black Diamond 4%, Blue Diamond 5%
- 50% instant to wallet, 50% added to rewards calendar
- API: GET /api/v1/rewards/rakeback/stats
- Track daily, weekly, monthly totals

**REWARDS CALENDAR:**
- 3 claim windows per day (every 12 hours)
- Claim amounts scale with VIP tier
- API: GET /api/v1/rewards/calendar, POST /api/v1/rewards/calendar/claim
- Frontend: Calendar grid showing available/claimed/locked days, claim button with animation

**TURBO MODE:**
- Activated when user claims from calendar
- Duration: 90 minutes
- Boost: up to 25% extra on all winnings during TURBO
- API: GET /api/v1/rewards/turbo/status, POST /api/v1/rewards/turbo/activate
- Frontend: Countdown timer in header, glowing visual effect, TURBO badge

**WELCOME PACKAGE:**
- New users: $2,500 in bonuses over 30 days, 10% rakeback, daily drops
- Day 30: Cash Vault unlock (bonus payout)
- API: GET /api/v1/rewards/welcome-package
- Frontend: Welcome package tracker with daily checklist

**LEVEL-UP REWARDS:**
- Milestones: $1K, $5K, $10K, $50K, $100K, $500K, $1M, $2.5M cumulative wagering
- Each milestone = bonus payout
- API: GET /api/v1/rewards/level-up
- Frontend: Progress bar showing next milestone, claim button when reached

**PROMOTIONS ENGINE:**
- Admin creates: deposit bonus, free bets, odds boost, cashback, tournaments
- Conditions: min deposit, wagering requirement (e.g., 5x), max bonus, expiry date
- Promo codes: generate unique codes, validate, redeem
- API: GET /api/v1/promotions, POST /api/v1/promotions/:id/claim, POST /api/v1/promo-codes/redeem
- Admin API: full CRUD for promotions and promo codes
- Frontend: /promotions page with cards, "Claim" buttons, promo code input on deposit page

**REFERRAL PROGRAM:**
- Generate unique referral code/link per user
- Track: referred user signups, deposits, wagering
- Rewards: 1 referral = $5, 5 = $50, 25 = $500
- Anti-fraud: referred user must deposit + wager minimum before reward
- API: GET /api/v1/referrals/stats, GET /api/v1/referrals/code
- Frontend: Referral dashboard with share buttons (copy link, WhatsApp, Telegram, Twitter), stats table

THEN IMMEDIATELY START STEP 4.

---

## STEP 4 OF 7: SPORTSBOOK ENGINE + ODDS + ADMIN DASHBOARD

Read `docs/ADMIN-AND-ODDS-INTEGRATION-PROMPT.md` COMPLETELY — ALL 13 sections.
Implement EVERYTHING in that file.

Follow the implementation order specified in the file:
1. Database migrations (section 11)
2. Site configuration service
3. Odds providers CRUD
4. TheOddsApi provider (section 1)
5. OddsAggregator service (section 1)
6. Odds sync queue jobs (section 1)
7. OddsEngine with margins (section 2)
8. Frontend: sportsbook pages with real odds data
9. BetService — single bets (section 3)
10. ParlayService (section 7)
11. SettlementService (section 4)
12. CashOutService (section 5)
13. LiveBettingService with Socket.IO (section 8)
14. RiskManagementService (section 6)
15. Admin backend — ALL 80+ API endpoints (section 9)
16. Admin frontend — ALL pages (section 10): Dashboard, Users, Finance, Sports, Odds Providers, Casino, Settings, Reports, Alerts
17. GoalserveProvider (second odds provider)
18. WebSocket live odds updates
19. Testing & validation (section 13)

Do NOT skip any endpoint or page from the spec.

THEN IMMEDIATELY START STEP 5.

---

## STEP 5 OF 7: CASINO — 15 GAMES + SYSTEMS

Read `docs/CASINO-GAMES-PROMPT.md` COMPLETELY — ALL 24 sections.
Implement EVERYTHING in that file.

Build in this order:

**Core Engine First:**
- ProvablyFairService (section 1): HMAC-SHA256 seed generation, result generation, verification
- BaseGame abstract class (section 2)
- API: seed management, verification endpoint
- Frontend: Provably Fair verification modal

**15 Games (one by one):**

Game 1 — CRASH (section 3): Multiplayer WebSocket game, Canvas exponential curve, 2 bet slots per player, auto-cashout, active bets list, bust point history. THIS IS THE MOST IMPORTANT GAME.

Game 2 — DICE (section 4): Slider UI, over/under toggle, dynamic multiplier calculation, roll animation.

Game 3 — MINES (section 5): 5×5 grid, click to reveal gems, progressive multiplier, cash out anytime, mine explosion animation.

Game 4 — PLINKO (section 6): Canvas physics ball drop, 3 risk levels (Low/Medium/High), 3 row options (8/12/16), color-coded multiplier buckets.

Game 5 — COINFLIP (section 7): 3D CSS coin flip animation, heads/tails choice, 1.94x payout.

Game 6 — ROULETTE (section 8): European wheel (0-36), animated spinning wheel, betting board with chip placement, multiple bet types.

Game 7 — BLACKJACK (section 9): Full rules — hit, stand, double down, split, insurance. Card dealing animation, dealer AI.

Game 8 — HILO (section 10): Card chain, guess higher/lower, progressive multiplier, cash out anytime.

Game 9 — WHEEL OF FORTUNE (section 11): Spinning wheel with colored segments, multipliers, easing slowdown animation.

Game 10 — TOWER/STAIRS (section 12): Grid climbing, 4 difficulty modes (Easy/Medium/Hard/Expert), 10 rows, cash out anytime.

Game 11 — LIMBO (section 13): Set target multiplier, game generates result, win if result >= target. Simple big number animation.

Game 12 — KENO (section 14): Grid of 40 numbers, pick 1-10, system draws 10, payout by matches.

Game 13 — VIDEO POKER (section 15): Jacks or Better, deal 5 cards, hold/discard, redraw, hand evaluation.

Game 14 — BACCARAT (section 16): Player/Banker/Tie bets, standard drawing rules, card animation.

Game 15 — SLOTS (section 17): 3×3 grid, 8 symbols with weights, spinning reel animation, paylines.

**Systems:**
- Auto-Bet (section 20): Server-side auto-play for all games, Martingale support, stop conditions
- Jackpot (section 19): 3-tier progressive (Mini $100 seed, Major $1K, Grand $10K), contribution from every bet
- Live Feed (section 21): Real-time bet ticker across entire site via Socket.IO
- Casino Lobby (section 18): Game grid, categories (Originals/Slots/Table/All), search
- Admin Casino Controls (section 22): Per-game house edge, enable/disable, RTP monitoring

ALL games use provably fair — NEVER Math.random().
ALL bets are atomic transactions.
ALL rounds recorded in casino_rounds table.

THEN IMMEDIATELY START STEP 6.

---

## STEP 6 OF 7: FRONTEND REDESIGN — CLOUDBET STYLE

Read `docs/FRONTEND-REDESIGN-PROMPT.md` COMPLETELY.
Do NOT change any backend code. Only rebuild frontend files.

**DESIGN SYSTEM:**
- Background: #0D1117 (darkest), #161B22 (cards), #1C2128 (elevated)
- Accent: #8B5CF6 (purple), #10B981 (green/win), #EF4444 (red/loss)
- Font: Inter (body), JetBrains Mono (numbers/odds)
- Border radius: 8px cards, 6px buttons, 4px inputs
- All transitions 200ms ease

**GLOBAL LAYOUT:**
- Header: Logo, nav (Sports/Live/Casino/Promotions), search, balance, deposit button, user avatar
- Left Sidebar (desktop): Sports list with icons and event counts
- Right Sidebar (desktop): Bet Slip (sticky)
- Bottom Nav (mobile): Home, Sports, Live, Casino, Bets
- Footer: links, responsible gambling, payment icons

**ALL 16 PAGES:**
1. Homepage — hero banner, featured events, live now, popular casino games, promotions
2. Sports Lobby — sport categories, competitions, events list with odds
3. Event Detail — match header, all markets (moneyline, spread, totals, props), team stats
4. Live Betting — real-time scores, live odds with green/red flash on change, match tracker
5. Casino Lobby — game grid with thumbnails, categories, search, live bets ticker
6. Casino Game Page — full-screen game area, bet controls, history
7. Crash Game — Canvas curve, multiplier display, bet panel, active players, history bubbles
8. Dice Game — slider, result display, over/under toggle
9. Mines Game — 5×5 grid, gem/bomb reveal
10. Plinko Game — Canvas ball drop, peg grid, buckets
11. Coinflip Game — 3D coin, heads/tails buttons
12. Virtual Sports — event list, video area, betting markets
13. Wallet — currency selector, balances, deposit (QR + address), withdraw, swap, transactions
14. Account Settings — tabs: Profile, Security, Preferences, KYC, Responsible Gambling
15. VIP & Rewards — tier badge, progress bar, rewards calendar, TURBO timer, rakeback stats, referral dashboard
16. My Bets — tabs: Open (with cash-out), Settled, All. Bet cards with details.

Everything responsive. Mobile-first. Real data from backend.

THEN IMMEDIATELY START STEP 7.

---

## STEP 7 OF 7: EXTRA FEATURES + DOCKER + POLISH

Read `docs/cryptobet-additional-features.md` for reference.

**BLOG / CMS:**
- Admin: Create/edit blog posts with Markdown, categories, featured image, publish/draft
- API: GET /api/v1/blog/posts, GET /api/v1/blog/posts/:slug
- Frontend: /blog page (post grid), /blog/:slug (post detail), sidebar with categories

**HELP CENTER:**
- Admin: CRUD help articles with categories
- API: GET /api/v1/help/articles, GET /api/v1/help/articles/:slug, GET /api/v1/help/categories
- Frontend: /help page, searchable, categorized accordion, "Was this helpful?" buttons

**BETTING ACADEMY:**
- Admin: Create courses with ordered lessons
- API: GET /api/v1/academy/courses, GET /api/v1/academy/courses/:id/lessons, POST /api/v1/academy/progress
- Frontend: /academy page, course cards, lesson viewer, progress tracking

**RESPONSIBLE GAMBLING (enhance Account Settings):**
- Deposit limits: daily/weekly/monthly (user sets, takes 24h to increase, instant decrease)
- Loss limits: daily/weekly/monthly
- Session timeout: auto-logout after X hours of continuous play
- Cooling-off: 24 hours / 1 week / 1 month (no betting, can still withdraw)
- Self-exclusion: 6 months / 1 year / permanent (account locked)
- Reality check: popup every 30/60/120 minutes showing session duration and P&L
- API endpoints for each setting
- Frontend: Responsible Gambling tab in Account Settings

**SOCIAL BET SHARING:**
- Generate visual bet slip card (use html2canvas or server-side rendering)
- Share buttons: Twitter, Telegram, WhatsApp, copy link
- Public URL that shows bet details to anyone (even non-users)
- API: POST /api/v1/bets/:id/share → returns shareable link
- Frontend: Share button on each bet in My Bets

**GEO-RESTRICTION:**
- Middleware using MaxMind GeoIP database
- Admin configurable: list of blocked countries
- Blocked users see "CryptoBet is not available in your region" page
- API: GET /api/v1/admin/geo-restrictions, PUT /api/v1/admin/geo-restrictions

**DOCKER DEPLOYMENT:**
Create these files:
- `Dockerfile` (multi-stage: build frontend + backend, serve with Node.js)
- `docker-compose.yml` (services: app, postgres, redis, nginx)
- `nginx/nginx.conf` (reverse proxy, WebSocket upgrade, gzip, static files, CORS headers)
- `.env.example` (ALL environment variables documented with comments)

**FINAL POLISH:**
- Go through EVERY page — fix any broken links, missing data, errors
- Add loading skeletons to all pages
- Add error states (empty states, 404, 500)
- Verify all navigation works
- Verify mobile layout on ALL pages
- Create README.md with: project overview, setup instructions (prerequisites, install, run), environment variables, architecture diagram, deployment guide

---

## DONE

After completing all 7 steps, the platform should be fully functional with:
- 40+ database tables
- Auth with OAuth + 2FA
- Crypto wallets with deposit/withdraw
- Multi-API sportsbook with real odds
- 15 provably fair casino games
- VIP/Rewards/Promotions system
- Admin dashboard with 80+ endpoints
- Professional Cloudbet-style UI
- Blog, Help Center, Academy
- Docker deployment ready
