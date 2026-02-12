#!/bin/bash
# ─── CryptoBet Database Backup Script ────────────────────
# Usage: ./scripts/backup.sh [daily|weekly|monthly]
# Requires: pg_dump, gzip
# Optionally uploads to S3 if AWS_BUCKET is set

set -euo pipefail

BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/cryptobet"
BACKUP_FILE="cryptobet_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Database connection (from environment or defaults)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cryptobet}"
DB_USER="${DB_USER:-cryptobet}"

echo "=== CryptoBet Backup ==="
echo "Type: ${BACKUP_TYPE}"
echo "Time: $(date)"
echo "File: ${BACKUP_FILE}"

# Create backup directory
mkdir -p "${BACKUP_DIR}/${BACKUP_TYPE}"

# Run pg_dump
echo "Starting database dump..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --verbose \
  2>/dev/null | gzip > "${BACKUP_DIR}/${BACKUP_TYPE}/${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_TYPE}/${BACKUP_FILE}" | cut -f1)
echo "Backup completed: ${BACKUP_SIZE}"

# Upload to S3 (if configured)
if [ -n "${AWS_BUCKET:-}" ]; then
  echo "Uploading to S3..."
  aws s3 cp \
    "${BACKUP_DIR}/${BACKUP_TYPE}/${BACKUP_FILE}" \
    "s3://${AWS_BUCKET}/backups/${BACKUP_TYPE}/${BACKUP_FILE}" \
    --storage-class STANDARD_IA
  echo "S3 upload complete"
fi

# Clean up old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}/${BACKUP_TYPE}" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "${BACKUP_DIR}/${BACKUP_TYPE}" -name "*.sql.gz" | wc -l)
echo "Remaining backups: ${REMAINING}"

echo "=== Backup Complete ==="
