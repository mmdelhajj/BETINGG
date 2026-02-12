#!/bin/bash
# CryptoBet — Database Seed Script
# Runs Prisma migrations and seeds the database with initial data

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== CryptoBet Database Seed ==="

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    echo "Loading .env file..."
    export $(grep -v '^#' .env | xargs)
  else
    echo "ERROR: DATABASE_URL not set and no .env file found"
    echo "Copy .env.example to .env and configure it first"
    exit 1
  fi
fi

# Run Prisma migrations
echo ""
echo "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate

# Run seed
echo ""
echo "Seeding database..."
npx tsx prisma/seed.ts

echo ""
echo "=== Seed complete ==="
echo "You can view the database with: npx prisma studio"
