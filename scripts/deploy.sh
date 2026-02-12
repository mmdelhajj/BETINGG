#!/bin/bash
# ─── CryptoBet Deployment Script ─────────────────────────
# Usage: ./scripts/deploy.sh [staging|production]
# Handles: pull latest, build, migrate, restart

set -euo pipefail

ENVIRONMENT="${1:-staging}"
PROJECT_DIR="/opt/cryptobet"
COMPOSE_FILE="docker/docker-compose.yml"

echo "=== CryptoBet Deployment ==="
echo "Environment: ${ENVIRONMENT}"
echo "Time: $(date)"

cd "${PROJECT_DIR}"

# 1. Pull latest code
echo "Pulling latest changes..."
git fetch origin
git checkout main
git pull origin main

# 2. Build images
echo "Building Docker images..."
docker compose -f "${COMPOSE_FILE}" build --no-cache app frontend

# 3. Run database migrations
echo "Running database migrations..."
docker compose -f "${COMPOSE_FILE}" run --rm app npx prisma migrate deploy

# 4. Run backup before deployment
echo "Creating pre-deployment backup..."
./scripts/backup.sh daily

# 5. Rolling restart
echo "Restarting services..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans app frontend nginx

# 6. Wait for health checks
echo "Waiting for services to be healthy..."
sleep 10

# Health check
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "000")
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")

echo "API Health: ${API_STATUS}"
echo "Frontend Health: ${FRONTEND_STATUS}"

if [ "${API_STATUS}" != "200" ]; then
  echo "WARNING: API health check failed!"
  echo "Rolling back..."
  docker compose -f "${COMPOSE_FILE}" logs --tail=50 app
  exit 1
fi

if [ "${FRONTEND_STATUS}" != "200" ]; then
  echo "WARNING: Frontend health check failed!"
  echo "Check logs: docker compose -f ${COMPOSE_FILE} logs frontend"
fi

# 7. Clean up old images
echo "Cleaning up dangling Docker images..."
docker image prune -f

echo "=== Deployment Complete ==="
echo "API:      http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "Docs:     http://localhost:3001/docs"
