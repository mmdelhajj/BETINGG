#!/usr/bin/env bash
# =============================================================================
# CryptoBet — PostgreSQL Backup Script
# =============================================================================
# Creates a compressed PostgreSQL dump with a timestamp. Retains the most
# recent 7 daily backups and removes older ones automatically.
#
# Usage:
#   ./scripts/backup.sh                     # Use defaults
#   BACKUP_DIR=/mnt/backups ./scripts/backup.sh  # Custom backup directory
#
# Cron example (daily at 02:00):
#   0 2 * * * /root/cryptobet/scripts/backup.sh >> /var/log/cryptobet-backup.log 2>&1
# =============================================================================

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables if .env exists
if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-cryptobet}"
DB_USER="${POSTGRES_USER:-cryptobet}"
DB_PASSWORD="${DB_PASSWORD:-cryptobet_secret}"

# Backup settings
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="cryptobet_${TIMESTAMP}.sql.gz"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-cryptobet-postgres}"

# ─── Functions ─────────────────────────────────────────────────────────────

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    log "ERROR: $*" >&2
    exit 1
}

# ─── Pre-flight Checks ────────────────────────────────────────────────────

# Create backup directory if it does not exist
mkdir -p "$BACKUP_DIR"

log "Starting PostgreSQL backup..."
log "  Database: ${DB_NAME}"
log "  Backup directory: ${BACKUP_DIR}"
log "  Retention: ${RETENTION_DAYS} days"

# ─── Perform Backup ───────────────────────────────────────────────────────

# Determine whether to use Docker or local pg_dump
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DOCKER_CONTAINER}$"; then
    log "Using Docker container: ${DOCKER_CONTAINER}"
    docker exec -e PGPASSWORD="$DB_PASSWORD" "$DOCKER_CONTAINER" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --no-owner --no-privileges --clean --if-exists \
        | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"
elif command -v pg_dump &>/dev/null; then
    log "Using local pg_dump"
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-owner --no-privileges --clean --if-exists \
        | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"
else
    error "Neither Docker container '${DOCKER_CONTAINER}' nor local pg_dump found"
fi

# Verify the backup file was created and is non-empty
if [[ ! -s "${BACKUP_DIR}/${BACKUP_FILE}" ]]; then
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
    error "Backup file is empty or was not created"
fi

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Cleanup Old Backups ──────────────────────────────────────────────────

DELETED_COUNT=0
while IFS= read -r -d '' old_backup; do
    rm -f "$old_backup"
    log "  Deleted old backup: $(basename "$old_backup")"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" -name "cryptobet_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null)

if [[ $DELETED_COUNT -gt 0 ]]; then
    log "Cleaned up ${DELETED_COUNT} old backup(s)"
fi

# ─── Summary ───────────────────────────────────────────────────────────────

REMAINING=$(find "$BACKUP_DIR" -name "cryptobet_*.sql.gz" -type f 2>/dev/null | wc -l)
log "Backup complete. ${REMAINING} backup(s) in ${BACKUP_DIR}"
log "Done."
