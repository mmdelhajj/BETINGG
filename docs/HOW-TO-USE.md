# 🚀 HOW TO USE THIS WITH CLAUDE CODE

## The Problem
The full prompt is ~2000 lines. Claude Code works best when you give it focused, manageable instructions per task rather than dumping everything at once.

## ✅ RECOMMENDED APPROACH: CLAUDE.md + Agent-by-Agent

### Step 1: Create your project folder
```bash
mkdir cryptobet
cd cryptobet
git init
```

### Step 2: Create a CLAUDE.md file in the project root
Claude Code automatically reads `CLAUDE.md` at the root of your project. Put the high-level architecture there:

```bash
# In your terminal, create the file:
touch CLAUDE.md
```

Then paste the content from `CLAUDE.md` file (provided below) into it.

### Step 3: Put the full spec in a docs folder
```bash
mkdir docs
```
Copy both files into `docs/`:
- `docs/full-system-spec.md` (the main prompt)
- `docs/additional-features.md` (the extra features)

### Step 4: Run Claude Code agent by agent
Open Claude Code in your project folder, then give it one agent at a time:

**First message:**
```
Read the CLAUDE.md file and the docs/full-system-spec.md file. 
Understand the full project architecture.
Then execute AGENT 1: Database Architect & Core Infrastructure.
Create the complete Prisma schema, seed data, server setup, middleware, 
Redis config, and BullMQ queues.
```

**After Agent 1 completes, next message:**
```
Read docs/full-system-spec.md Agent 2 section.
Execute AGENT 2: Auth, User & Complete Wallet/Payment System.
Build on top of what Agent 1 created.
```

**Continue for each agent...**

### Step 5: For additional features
After the 8 agents are done:
```
Read docs/additional-features.md
Add these features to the existing codebase:
1. Academy module (courses, lessons, quizzes)
2. Blog CMS
3. Virtual Sports
4. Geo-restriction
5. i18n (19 languages)
6. Help Center
7. Live streaming integration
8. Bet sharing social cards
9. Affiliate system
```

---

## ⚡ QUICK START (If you want to try all at once)

If you want to just paste one message into Claude Code and let it run:

```
I'm building a Cloudbet-style crypto sportsbook + casino platform.
Read the file docs/full-system-spec.md for the complete specification.

Start with Agent 1: Create the full Prisma database schema with ALL tables 
(users, wallets, currencies, transactions, sports, events, markets, 
selections, bets, casino games, VIP tiers, rewards, promotions, referrals, 
notifications, audit logs, admin wallets, site config).

Then create:
- prisma/schema.prisma
- prisma/seed.ts  
- src/server.ts (Fastify)
- src/config/ (database, redis, queue)
- src/middleware/ (auth, rateLimit, errorHandler)
- src/lib/ (prisma client, redis client, socket.io)

Use: TypeScript, Prisma, Fastify, Redis, BullMQ, Socket.IO
```

Then continue agent by agent in subsequent messages.
