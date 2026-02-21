# CryptoBet Platform

A full-featured cryptocurrency betting platform with a sportsbook, 15 provably fair casino games, multi-currency wallets, an 8-tier VIP system, and a comprehensive admin dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI, Framer Motion |
| Backend | Fastify 5, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache / Queues | Redis 7, BullMQ |
| Real-time | Socket.IO |
| Auth | JWT (access + refresh), bcrypt, TOTP 2FA, Google/GitHub OAuth |
| Crypto | ethers.js (EVM chains), QR code generation |
| Containerization | Docker, Docker Compose, Nginx |
| CI/CD | GitHub Actions |

## Prerequisites

- **Node.js** >= 20.0.0
- **Docker** and **Docker Compose** (v2)
- **PostgreSQL** 16+ (provided via Docker or installed locally)
- **Redis** 7+ (provided via Docker or installed locally)
- **Git**

## Quick Start (Docker)

The fastest way to get the entire platform running:

```bash
# 1. Clone the repository
git clone https://github.com/mmdelhajj/BETINGG.git
cd BETINGG

# 2. Configure environment
cp .env.example .env
# Edit .env with your secrets (JWT keys, API keys, etc.)

# 3. Start all services
docker compose up -d

# 4. View logs
docker compose logs -f
```

The platform will be available at:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| API Documentation | http://localhost:3001/docs |
| Nginx (reverse proxy) | http://localhost:80 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Development Setup (Manual)

For local development with hot reload:

### Option A: Docker Development Mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This mounts your source directories as volumes for hot reload and exposes the Node.js debugger on port 9229.

### Option B: Fully Local

```bash
# 1. Start infrastructure (PostgreSQL + Redis)
docker compose up -d postgres redis

# 2. Backend setup
cd backend
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev

# 3. Frontend setup (in a separate terminal)
cd frontend
npm ci
npm run dev
```

The backend runs at http://localhost:3001 and the frontend at http://localhost:3000.

## Environment Variables

All environment variables are documented in `.env.example`. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `cryptobet_secret` |
| `REDIS_PASSWORD` | Redis password | (empty) |
| `JWT_SECRET` | Access token signing key | Must change in prod |
| `JWT_REFRESH_SECRET` | Refresh token signing key | Must change in prod |
| `FRONTEND_URL` | Public frontend URL | `http://localhost:3000` |
| `API_URL` | Public API URL | `http://localhost:3001` |
| `THE_ODDS_API_KEY` | Sportsbook odds provider | (optional) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (optional) |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | (optional) |
| `SMTP_HOST` | Email server hostname | `smtp.gmail.com` |

See `.env.example` for the complete list with descriptions and feature flags.

## Architecture Overview

```
                    +----------+
                    |  Nginx   |  :80 / :443
                    |  (proxy) |
                    +----+-----+
                         |
              +----------+----------+
              |                     |
        +-----+------+      +------+-----+
        |  Frontend   |      |  Backend    |
        |  Next.js    |      |  Fastify    |
        |  :3000      |      |  :3001      |
        +-------------+      +------+------+
                                    |
                         +----------+----------+
                         |                     |
                   +-----+------+       +------+-----+
                   | PostgreSQL |       |   Redis    |
                   |   :5432    |       |   :6379    |
                   +------------+       +------------+
```

### Backend Structure

```
backend/
  src/
    config/        # App configuration, environment loading
    middleware/     # Auth, rate limiting, error handling
    modules/
      auth/        # Registration, login, OAuth, 2FA
      users/       # Profile, settings, sessions
      wallets/     # Multi-currency wallets, deposits, withdrawals, swaps
      betting/     # Sportsbook: bets, parlays, settlement, cash-out
      casino/      # 15 games, provably fair engine, auto-bet
      vip/         # 8-tier VIP system, rakeback, rewards
      promotions/  # Promo codes, deposit bonuses, tournaments
      admin/       # Dashboard, user management, risk, finance
      content/     # Blog, help center, academy
    services/      # Shared services (email, notifications, odds)
    queues/        # BullMQ job processors
    websocket/     # Socket.IO event handlers
    utils/         # Helpers, constants, validators
    index.ts       # Application entry point
  prisma/
    schema.prisma  # Database schema (40+ tables)
    seed.ts        # Seed data
```

### Frontend Structure

```
frontend/
  src/
    app/           # Next.js App Router pages
    components/    # Reusable UI components
    hooks/         # Custom React hooks
    lib/           # API client, utilities
    stores/        # Zustand state management
    styles/        # Global CSS, Tailwind config
    types/         # TypeScript type definitions
```

## Key Features

### Sportsbook
- Real-time odds from multiple providers (The Odds API, Goalserve)
- Single bets, parlays, and live betting
- Cash-out with partial cash-out support
- 35+ sports with automated odds syncing

### Casino (15 Games)
- **Originals:** Crash, Dice, Mines, Plinko, Coinflip, HiLo, Limbo, Tower, Wheel of Fortune, Keno
- **Table Games:** Blackjack, Roulette, Baccarat, Video Poker, Slots
- All games use provably fair HMAC-SHA256 cryptography
- 3-tier progressive jackpot system
- Auto-bet with Martingale support

### VIP System
- 8 tiers: Bronze, Silver, Gold, Platinum, Diamond, Elite, Black Diamond, Blue Diamond
- Rakeback: 0.5% to 5% based on tier
- Rewards calendar with 3 daily claim windows
- Turbo Mode: 90-minute boost with up to 25% extra on winnings
- Welcome package: $2,500 in bonuses over 30 days

### Wallets
- 40+ supported cryptocurrencies
- Deposit with QR code and unique addresses
- Withdrawal with admin approval queue
- Internal currency swap via CoinGecko rates

### Security
- JWT access + refresh token authentication
- Two-factor authentication (TOTP with QR code)
- Google and GitHub OAuth
- 3-level KYC verification
- Rate limiting, CORS, Helmet security headers
- Responsible gambling tools (deposit limits, self-exclusion, cooling-off)

## Scripts

```bash
# Database backup (retains last 7 days)
./scripts/backup.sh

# Full production deployment
./scripts/deploy.sh

# Deploy without seeding
./scripts/deploy.sh --no-seed

# Build only (no restart)
./scripts/deploy.sh --build-only
```

## API Documentation

When the backend is running, interactive API documentation is available at:

- **Swagger UI:** http://localhost:3001/docs
- **OpenAPI JSON:** http://localhost:3001/docs/json

## Database Migrations

```bash
# Create a new migration
cd backend
npx prisma migrate dev --name describe_your_change

# Apply migrations in production
npx prisma migrate deploy

# Reset database (WARNING: drops all data)
npx prisma migrate reset

# Open Prisma Studio (visual database browser)
npx prisma studio
```

## Deployment Guide

### Production Deployment

1. **Provision a server** with Docker and Docker Compose installed.

2. **Clone and configure:**
   ```bash
   git clone https://github.com/your-org/cryptobet.git
   cd cryptobet
   cp .env.example .env
   ```

3. **Set production secrets in `.env`:**
   ```bash
   # Generate strong random secrets
   openssl rand -hex 64  # For JWT_SECRET
   openssl rand -hex 64  # For JWT_REFRESH_SECRET
   openssl rand -hex 32  # For DB_PASSWORD
   ```

4. **Configure SSL** (recommended):
   - Place certificates in `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem`
   - Uncomment the SSL configuration section in `nginx/nginx.conf`
   - Update `FRONTEND_URL` and `API_URL` in `.env` to use `https://`

5. **Deploy:**
   ```bash
   chmod +x scripts/deploy.sh scripts/backup.sh
   ./scripts/deploy.sh
   ```

6. **Set up automated backups:**
   ```bash
   # Add to crontab (daily at 02:00 UTC)
   crontab -e
   0 2 * * * /path/to/cryptobet/scripts/backup.sh >> /var/log/cryptobet-backup.log 2>&1
   ```

### Updating

```bash
./scripts/deploy.sh
```

This pulls the latest code, creates a database backup, builds new images, runs migrations, and restarts services.

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `main`/`develop` and on pull requests:

1. **Lint** -- TypeScript type checking and ESLint
2. **Test** -- Unit and integration tests with PostgreSQL and Redis services
3. **Build** -- Verifies production builds succeed
4. **Docker** -- Builds Docker images on pushes to `main`

## License

Proprietary. All rights reserved.
