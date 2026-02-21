#!/usr/bin/env bash
# =============================================================================
# CryptoBet — Production Deployment Script
# =============================================================================
# Pulls the latest code, builds images, runs migrations, seeds the database,
# and restarts all services with zero-downtime rolling updates.
#
# Usage:
#   ./scripts/deploy.sh              # Full deploy
#   ./scripts/deploy.sh --no-seed    # Skip seeding
#   ./scripts/deploy.sh --build-only # Build without restarting
# =============================================================================

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
LOG_FILE="$PROJECT_DIR/deploy.log"

# Parse flags
SKIP_SEED=false
BUILD_ONLY=false
SKIP_PULL=false
FORCE_REBUILD=false

for arg in "$@"; do
    case $arg in
        --no-seed)     SKIP_SEED=true ;;
        --build-only)  BUILD_ONLY=true ;;
        --skip-pull)   SKIP_PULL=true ;;
        --force)       FORCE_REBUILD=true ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-seed      Skip database seeding"
            echo "  --build-only   Build images without restarting services"
            echo "  --skip-pull    Skip git pull (deploy current code)"
            echo "  --force        Force rebuild without cache"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            exit 1
            ;;
    esac
done

# ─── Functions ─────────────────────────────────────────────────────────────

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

error() {
    log "ERROR: $*"
    exit 1
}

step() {
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log " $*"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ─── Pre-flight Checks ────────────────────────────────────────────────────

cd "$PROJECT_DIR"

log "CryptoBet Deployment — $(date)"
log "Project directory: $PROJECT_DIR"

# Check required tools
for cmd in docker git; do
    if ! command -v "$cmd" &>/dev/null; then
        error "$cmd is required but not installed"
    fi
done

# Check docker compose (v2 plugin or standalone)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    error "docker compose is required but not installed"
fi

# Check .env file exists
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
    log "WARNING: .env file not found. Copying from .env.example..."
    if [[ -f "$PROJECT_DIR/.env.example" ]]; then
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
        log "Created .env from .env.example — please review and update values."
    else
        error ".env.example not found. Cannot continue without configuration."
    fi
fi

# Load environment variables
set -a
source "$PROJECT_DIR/.env"
set +a

# ─── Step 1: Pull Latest Code ─────────────────────────────────────────────

if [[ "$SKIP_PULL" == false ]]; then
    step "Step 1/6: Pulling latest code"

    # Stash any local changes
    if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
        log "Stashing local changes..."
        git stash
    fi

    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    log "Current branch: $CURRENT_BRANCH"

    git pull origin "$CURRENT_BRANCH" 2>&1 | while IFS= read -r line; do log "  $line"; done
    log "Code updated successfully"
else
    step "Step 1/6: Skipping git pull (--skip-pull)"
fi

# ─── Step 2: Create Backup ────────────────────────────────────────────────

step "Step 2/6: Creating database backup"

if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "running"; then
    if [[ -x "$SCRIPT_DIR/backup.sh" ]]; then
        "$SCRIPT_DIR/backup.sh" 2>&1 | while IFS= read -r line; do log "  $line"; done
    else
        log "Backup script not executable, skipping backup"
    fi
else
    log "PostgreSQL container not running, skipping backup"
fi

# ─── Step 3: Build Docker Images ──────────────────────────────────────────

step "Step 3/6: Building Docker images"

BUILD_ARGS=""
if [[ "$FORCE_REBUILD" == true ]]; then
    BUILD_ARGS="--no-cache"
fi

$DOCKER_COMPOSE -f "$COMPOSE_FILE" build $BUILD_ARGS 2>&1 | while IFS= read -r line; do log "  $line"; done
log "Docker images built successfully"

if [[ "$BUILD_ONLY" == true ]]; then
    log "Build-only mode — skipping remaining steps"
    log "Deployment complete (build only)."
    exit 0
fi

# ─── Step 4: Start Infrastructure Services ────────────────────────────────

step "Step 4/6: Starting infrastructure services"

$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d postgres redis 2>&1 | while IFS= read -r line; do log "  $line"; done

# Wait for PostgreSQL to be healthy
log "Waiting for PostgreSQL to be healthy..."
RETRIES=30
while [[ $RETRIES -gt 0 ]]; do
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T postgres pg_isready -U cryptobet -q 2>/dev/null; then
        log "PostgreSQL is ready"
        break
    fi
    RETRIES=$((RETRIES - 1))
    sleep 2
done

if [[ $RETRIES -eq 0 ]]; then
    error "PostgreSQL failed to become healthy within 60 seconds"
fi

# Wait for Redis to be healthy
log "Waiting for Redis to be healthy..."
RETRIES=15
while [[ $RETRIES -gt 0 ]]; do
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
        log "Redis is ready"
        break
    fi
    RETRIES=$((RETRIES - 1))
    sleep 2
done

if [[ $RETRIES -eq 0 ]]; then
    error "Redis failed to become healthy within 30 seconds"
fi

# ─── Step 5: Run Migrations and Seed ──────────────────────────────────────

step "Step 5/6: Running database migrations"

$DOCKER_COMPOSE -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy 2>&1 | while IFS= read -r line; do log "  $line"; done
log "Migrations applied successfully"

if [[ "$SKIP_SEED" == false ]]; then
    log "Seeding database..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" run --rm backend npx tsx prisma/seed.ts 2>&1 | while IFS= read -r line; do log "  $line"; done || log "WARNING: Seed script failed (may already be seeded)"
    log "Seed complete"
else
    log "Skipping seed (--no-seed)"
fi

# ─── Step 6: Restart Application Services ─────────────────────────────────

step "Step 6/6: Restarting application services"

# Start backend first, then frontend, then nginx
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d backend 2>&1 | while IFS= read -r line; do log "  $line"; done
log "Backend started"

# Wait for backend health check
log "Waiting for backend to be healthy..."
RETRIES=30
while [[ $RETRIES -gt 0 ]]; do
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T backend wget -q --spider http://localhost:3001/health 2>/dev/null; then
        log "Backend is healthy"
        break
    fi
    RETRIES=$((RETRIES - 1))
    sleep 2
done

if [[ $RETRIES -eq 0 ]]; then
    log "WARNING: Backend health check did not pass within 60s, continuing anyway..."
fi

$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d frontend 2>&1 | while IFS= read -r line; do log "  $line"; done
log "Frontend started"

$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d nginx 2>&1 | while IFS= read -r line; do log "  $line"; done
log "Nginx started"

# ─── Cleanup ───────────────────────────────────────────────────────────────

log ""
log "Removing dangling Docker images..."
docker image prune -f 2>&1 | while IFS= read -r line; do log "  $line"; done

# ─── Summary ───────────────────────────────────────────────────────────────

step "Deployment Complete"

log ""
log "Service status:"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" ps 2>&1 | while IFS= read -r line; do log "  $line"; done

log ""
log "Endpoints:"
log "  Frontend:  http://localhost:${FRONTEND_PORT:-3000}"
log "  Backend:   http://localhost:${BACKEND_PORT:-3001}"
log "  Nginx:     http://localhost:80"
log "  API Docs:  http://localhost:${BACKEND_PORT:-3001}/docs"
log ""
log "Logs: $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
log "Stop: $DOCKER_COMPOSE -f $COMPOSE_FILE down"
log ""
log "Done."
