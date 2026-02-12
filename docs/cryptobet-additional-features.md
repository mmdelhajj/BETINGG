# 🔥 CRYPTOBET — ADDITIONAL FEATURES (Append to Main Prompt)
## Features Discovered in Deep Research — ADD These to Each Agent

---

## MISSING FEATURES TO ADD

### 1. 🎓 BETTING ACADEMY / EDUCATION CENTER (NEW MODULE)
**What Cloudbet Has:** A full "Cloudbet Academy" — free courses teaching betting fundamentals, crypto wallets, bankroll management, Kelly Criterion, esports meta analysis, value betting, on-chain whale tracking.

**Add to Agent 5 (or create sub-task for Agent 8):**
```
Academy Module:
├── Courses (structured learning paths)
│   ├── Crypto Betting Basics (wallet setup, deposits, security)
│   ├── Sports Betting Fundamentals (odds, markets, bet types)
│   ├── Advanced Strategies (Kelly Criterion, value bets, bankroll)
│   ├── Esports Betting (meta analysis, team research)
│   └── Responsible Gambling (limits, signs of problem gambling)
├── Lessons within each course (ordered chapters)
├── Quizzes at end of each lesson
├── Progress tracking per user
├── Completion certificates/badges
└── CTA: "Test your edge → Go to Sportsbook"
```

**Database additions:**
```prisma
model AcademyCourse {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String
  thumbnail   String?
  category    String   // "crypto-basics", "sports-betting", "advanced", "esports"
  sortOrder   Int
  isActive    Boolean  @default(true)
  lessons     AcademyLesson[]
}

model AcademyLesson {
  id          String   @id @default(cuid())
  courseId    String
  course      AcademyCourse @relation(fields: [courseId])
  title       String
  slug        String
  content     String   // Markdown/HTML content
  sortOrder   Int
  quizQuestions Json?  // [{question, options[], correctAnswer}]
}

model UserCourseProgress {
  id          String   @id @default(cuid())
  userId      String
  courseId     String
  lessonId     String   // current lesson
  completedLessons String[] // array of completed lesson IDs
  quizScores  Json?    // {lessonId: score}
  completedAt DateTime?
  @@unique([userId, courseId])
}
```

---

### 2. 📺 LIVE STREAMING INTEGRATION
**What Cloudbet Has:** Free live streaming for esports and virtual sports (via Twitch embed). Paid live streaming for traditional sports (beIN Sports, Copa Libertadores, Equidia racing). Must have deposit to access sports streams.

**Add to Agent 3 (Sportsbook) + Agent 6 (Frontend):**
```
Live Streaming:
- Twitch embed for esports events (free, no deposit required)
- Sports stream URLs per event (admin-configured)
- Stream access gating: deposit required for premium sports
- Match tracker visualization as fallback when no stream available
- Picture-in-picture mode for streaming while browsing
- Stream quality selector (360p, 720p, 1080p)
```

**Database addition:**
```prisma
model EventStream {
  id          String   @id @default(cuid())
  eventId     String
  event       Event    @relation(fields: [eventId])
  type        StreamType // TWITCH, DIRECT_URL, YOUTUBE, EMBEDDED
  url         String
  isFree      Boolean  @default(false) // free for esports, paid for sports
  requiresDeposit Boolean @default(true)
  isActive    Boolean  @default(true)
}
```

---

### 3. 🔗 SOCIAL BET SHARING
**What Cloudbet Has:** Shareable bet cards — after placing a bet, users can share a visual bet card to Twitter, Telegram, WhatsApp with bet details. Settled bets show win/loss. API-placed bets show an "API" tag.

**Add to Agent 6 (Frontend):**
```
Bet Share Cards:
- Generate visual bet card (canvas/SVG) with:
  - Event name, selections, odds, stake, potential win
  - Cloudbet branding
  - "API" badge if placed via API
  - Win/Loss badge after settlement
- Share buttons: Twitter, Telegram, WhatsApp, Copy Link
- Unique shareable URL per bet: /bet/share/{referenceId}
- Public bet view page (no auth required, shows bet details)
- OG meta tags for social preview (image, title, description)
```

---

### 4. 🗳️ POLITICS & ENTERTAINMENT BETTING
**What Cloudbet Has:** Non-sports betting markets — US Presidential Election, UK PM next, party leader markets, award show winners, entertainment events.

**Add to Agent 3 (Sportsbook):**
```
Special Markets:
- Politics: elections, leadership races, referendum outcomes
- Entertainment: award shows (Oscars, Grammys), reality TV winners
- Specials: novelty markets (weather records, space events, etc.)
- Treated as regular sports with their own category in navigation
- Same bet types: outright winner, yes/no, over/under
```

**Seed data addition:** Add "Politics" and "Entertainment" as sports with appropriate competitions/events.

---

### 5. 🎮 VIRTUAL SPORTS (24/7 RNG Events)
**What Cloudbet Has:** HD computer-generated virtual sports — virtual NBA, soccer, tennis, horse racing, greyhound racing. 24/7 availability, games every 1-5 minutes. RNG-determined outcomes.

**Add to Agent 4 (Casino/Games):**
```
Virtual Sports Module:
- Virtual Football: simulated matches every 3 minutes
- Virtual Basketball: NBA-style with real rules
- Virtual Horse Racing: 8-horse races every 2 minutes
- Virtual Tennis: simulated sets
- Virtual Greyhound Racing
- Each sport has: match odds, correct score, over/under, first scorer
- RNG-powered outcomes (provably fair optional)
- HD animated graphics (placeholder thumbnails for MVP)
- Free streaming (no deposit required)
- Fast settlement (instant after virtual match ends)
```

**Database addition:**
```prisma
model VirtualSport {
  id            String   @id @default(cuid())
  name          String   // "Virtual Football", "Virtual Horse Racing"
  slug          String   @unique
  intervalSec   Int      // seconds between events (120-300)
  isActive      Boolean  @default(true)
  markets       Json     // available market types for this virtual sport
}

model VirtualEvent {
  id            String   @id @default(cuid())
  virtualSportId String
  virtualSport  VirtualSport @relation(fields: [virtualSportId])
  roundNumber   Int
  participants  Json     // teams/horses/players
  result        Json?    // outcome after RNG
  serverSeed    String
  clientSeed    String   @default("cloudbet")
  status        EventStatus @default(UPCOMING)
  startsAt      DateTime
  settledAt     DateTime?
}
```

---

### 6. 🕹️ EXPANDED ESPORTS (12+ Titles)
**What Cloudbet Has:** CS2, Dota 2, League of Legends, Valorant, Rainbow Six Siege, StarCraft 2, Call of Duty, FIFA/EA FC, NBA 2K, Rocket League, Wild Rift, Crossfire. Esports-specific markets: first blood, map winner, kill totals, ace, pistol round winner, duration.

**Add to seed data in Agent 1:**
```
Esports titles to seed:
- Counter-Strike 2 (CS2)
- Dota 2
- League of Legends
- Valorant
- Rainbow Six Siege
- StarCraft 2
- Call of Duty
- EA Sports FC (FIFA)
- NBA 2K
- Rocket League
- Wild Rift
- Crossfire

Esports-specific market types:
- match_winner, map_winner, map_handicap, map_total
- first_blood, first_tower, first_baron
- total_kills, total_rounds, total_maps
- ace_in_match, pistol_round_winner
- match_duration_over_under
- correct_map_score
```

---

### 7. 🛡️ ENHANCED RESPONSIBLE GAMBLING
**What Cloudbet Has:** Cooling-off (24h mandatory, then 1w/1m/6m/1y/permanent), separate from self-exclusion. Gambling assessment quiz. Links to GambleAware, GA, Gamban, BetBlocker. Child protection guidelines.

**Add to Agent 2 (User module):**
```
Responsible Gambling (Enhanced):
├── Deposit Limits: daily, weekly, monthly (per currency)
├── Loss Limits: daily, weekly, monthly
├── Wager Limits: max bet per day/week
├── Session Time Limits: reminder after X hours, auto-logout
├── Cooling-Off: 24h, 1w, 1m (account stays open, betting disabled)
├── Self-Exclusion: 6m, 1y, permanent (full account lockout)
├── Gambling Assessment Quiz (10 questions, score-based recommendation)
├── Reality Check: periodic popup showing time spent + money wagered
├── Third-party Tools: links to Gamban, BetBlocker, GambleAware
├── Under-18 Protection: age verification, child safety guidelines
└── All limits CANNOT be loosened immediately (24-72h cooling period)
```

---

### 8. 📝 BLOG / CONTENT CMS
**What Cloudbet Has:** Full WordPress-powered blog at /blog with categories: Sports, Casino, Esports, Crypto & Payments. Expert authors, SEO-optimized, embedded CTAs to sportsbook.

**Add to Agent 8 (Admin Dashboard):**
```
Blog/CMS Module:
- Admin: create/edit/delete blog posts (Markdown editor)
- Categories: Sports, Casino, Esports, Crypto, Promotions
- Author profiles with avatars
- SEO fields: title, description, slug, OG image
- Featured image
- Draft/Published/Scheduled status
- Tags for filtering
- Related posts
- Public pages: /blog, /blog/category/:slug, /blog/post/:slug
```

**Database addition:**
```prisma
model BlogPost {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  content     String   // Markdown
  excerpt     String?
  category    String   // sports, casino, esports, crypto
  tags        String[]
  authorName  String
  authorAvatar String?
  featuredImage String?
  seoTitle    String?
  seoDescription String?
  status      PostStatus @default(DRAFT) // DRAFT, PUBLISHED, SCHEDULED
  publishedAt DateTime?
  scheduledAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

### 9. 🌍 GEO-RESTRICTION SYSTEM
**What Cloudbet Has:** Country-level blocking. Restricted regions include: US, UK, Hong Kong, Singapore, and others. IP-based detection. VPN detection optional.

**Add to Agent 2 (Auth) + Agent 8 (Admin):**
```
Geo-Restriction:
- Admin: configure blocked countries (ISO codes)
- Admin: configure blocked regions/states
- Middleware: check user IP against GeoIP database (MaxMind GeoLite2)
- Block registration from restricted countries
- Block access/redirect to restriction page
- VPN detection (optional, configurable)
- Audit logging of blocked access attempts
```

**Database:**
```prisma
model GeoRestriction {
  id          String   @id @default(cuid())
  countryCode String   @unique // ISO 3166-1 alpha-2
  countryName String
  isBlocked   Boolean  @default(true)
  reason      String?
}
```

---

### 10. 🌐 FULL i18n (19 Languages)
**What Cloudbet Has:** English, Spanish, German, Italian, French, Swedish, Dutch, Greek, Hungarian, Turkish, Indonesian, Polish, Portuguese, Portuguese (BR), Russian, Korean, Japanese, Thai, Vietnamese.

**Add to Agent 6+7 (Frontend):**
```
i18n Setup:
- next-intl or next-i18next
- 19 language files in /frontend/src/locales/
- Language switcher in top nav
- RTL support stub (for Arabic if needed later)
- Currency format per locale
- Date/time format per locale
- URL-based locale: /en/, /es/, /de/, etc.
- Default: English
- User preference saved in profile
```

---

### 11. 💬 HELP CENTER / SUPPORT PORTAL
**What Cloudbet Has:** Searchable knowledge base with categories (Account, Payments, Bonuses, Responsible Gambling, Sportsbook Rules, Fairness). Live chat widget. Email support. No phone support.

**Add to Agent 8 (Admin):**
```
Help Center:
- Admin: CRUD help articles with categories
- Categories: Account, Payments, Bonuses, Betting Rules, Responsible Gambling, Security
- Searchable by users (full-text search)
- Related articles suggestions
- "Was this helpful?" feedback
- Public pages: /help, /help/category/:slug, /help/article/:slug
- Live chat widget integration (stub — Intercom/Zendesk/custom)
- Contact form (email to support)
```

**Database:**
```prisma
model HelpArticle {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  content     String
  category    String
  tags        String[]
  isPublished Boolean  @default(true)
  sortOrder   Int      @default(0)
  helpfulCount Int     @default(0)
  notHelpfulCount Int  @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

### 12. 📱 TELEGRAM MINI-APP (Stub)
**What Cloudbet Has:** Platform accessible via Telegram mini-app. Quick betting from Telegram.

**Add to Agent 8 (stubs):**
```
Telegram Integration (Stub):
- Telegram Bot setup with BotFather
- /start command → registration/login link
- /balance command → show balances
- /bet command → quick bet interface
- Webhook endpoint for Telegram updates
- Telegram Mini-App configuration (WebApp URL)
- Notification channel: send bet results, promotions via Telegram
```

---

### 13. 🤝 AFFILIATE SYSTEM (Separate Portal)
**What Cloudbet Has:** Full affiliate dashboard at /affiliates — revenue share commission, analytics, marketing materials (banners, widgets, links), API access for odds consumption, dedicated affiliate manager.

**Add to Agent 8:**
```
Affiliate Module:
├── Affiliate Registration (separate from player)
├── Affiliate Dashboard:
│   ├── Revenue share commission tracking
│   ├── Referred players list + activity
│   ├── Earnings reports (daily/weekly/monthly)
│   ├── Commission payment history
│   └── Marketing materials (banners, links, widgets)
├── Affiliate API Key (for odds feed consumption)
├── Sub-affiliate tracking (optional)
├── Admin: approve/reject affiliates, set commission %, view reports
└── Separate auth flow from main platform
```

**Database:**
```prisma
model Affiliate {
  id              String   @id @default(cuid())
  email           String   @unique
  companyName     String?
  website         String?
  commissionPercent Decimal @default(25) // revenue share %
  apiKey          String?  @unique
  status          AffiliateStatus @default(PENDING) // PENDING, APPROVED, REJECTED, SUSPENDED
  approvedBy      String?
  totalEarned     Decimal  @default(0)
  totalReferred   Int      @default(0)
  createdAt       DateTime @default(now())
  referredPlayers AffiliatePlayer[]
}

model AffiliatePlayer {
  id          String   @id @default(cuid())
  affiliateId String
  affiliate   Affiliate @relation(fields: [affiliateId])
  userId      String
  revenue     Decimal  @default(0) // revenue generated by this player
  commission  Decimal  @default(0) // affiliate's cut
  createdAt   DateTime @default(now())
}
```

---

### 14. 📊 CLOUDBET-BRANDED CUSTOM TABLE
**What Cloudbet Has:** Exclusive "Cloudbet Blackjack" table in partnership with Evolution Gaming — branded table with custom UI.

**Add to Agent 4 (Casino):**
```
Branded Games:
- Custom-branded live dealer table (stub for Evolution partnership)
- Platform-branded provably fair games (logo, colors, custom rules)
- Exclusive tournaments on branded tables
```

---

## 📋 FINAL COMPREHENSIVE FEATURE COUNT

| Category | Features | Count |
|----------|----------|-------|
| **Sportsbook** | 35+ sports, live/pre-match, bet builder, cash-out, parlays, system bets, early lines, odds boost | 15+ |
| **Esports** | 12 titles, esports-specific markets, free streaming | 12 |
| **Casino** | 3000+ slots, 300+ live tables, 8+ provably fair games | 20+ |
| **Virtual Sports** | Football, basketball, horse racing, tennis, greyhound | 5 |
| **Special Markets** | Politics, Entertainment, Specials | 3 |
| **Payments** | 40+ cryptos, 7 chains, MoonPay, Swapped, WalletConnect, Ledger | 50+ |
| **Rewards** | Rakeback, Calendar, TURBO, Welcome Package, Level-Up, VIP 8-tier | 10+ |
| **User** | Auth, 2FA, KYC, responsible gambling, profiles, preferences | 15+ |
| **Social** | Bet sharing, referral program, Discord, Telegram | 5 |
| **Education** | Academy courses, lessons, quizzes, progress tracking | 5 |
| **Content** | Blog CMS, Help Center, live streaming | 5 |
| **Admin** | User mgmt, payments, sports, casino, rewards, reports, risk, geo, settings | 20+ |
| **API** | REST, GraphQL, WebSocket, Affiliate API, Postman, Swagger | 6 |
| **i18n** | 19 languages | 19 |
| **DevOps** | Docker, CI/CD, monitoring, backups | 5 |
| **TOTAL** | | **195+** |

---

## HOW TO USE THIS FILE

1. Open the main prompt file (`cryptobet-full-system-prompt.md`)
2. For each agent, add the relevant new features from this document
3. Add new database models to Agent 1
4. Add Academy + Blog + Help Center to Agent 8
5. Add live streaming + virtual sports to appropriate agents
6. Add i18n setup to frontend agents (6 + 7)
7. Add geo-restriction to Agent 2 + 8
8. Add affiliate system to Agent 8

This gives you a **100% complete clone** of every feature Cloudbet has.
