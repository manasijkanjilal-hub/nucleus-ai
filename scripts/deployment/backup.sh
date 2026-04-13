#!/usr/bin/env bash
# =============================================================================
# Nucleus AI — Database Backup Script
# Usage: ./scripts/deployment/backup.sh [backup_dir]
# =============================================================================
set -euo pipefail

BACKUP_DIR="${1:-/opt/backups/nucleus-ai}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7
COMPOSE_FILE="docker-compose.prod.yml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[BACKUP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# ---- PostgreSQL Backup -------------------------------------------------------
log "Starting PostgreSQL backup..."
DB_BACKUP="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"

if docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U nucleus > /dev/null 2>&1; then
    docker compose -f "${COMPOSE_FILE}" exec -T postgres \
        pg_dump -U nucleus --no-owner --no-acl nucleus | gzip > "${DB_BACKUP}"
    DB_SIZE=$(du -sh "${DB_BACKUP}" | cut -f1)
    log "PostgreSQL backup complete: ${DB_BACKUP} (${DB_SIZE})"
else
    err "PostgreSQL is not running!"
    exit 1
fi

# ---- Qdrant Backup (snapshot) ------------------------------------------------
log "Creating Qdrant snapshot..."
QDRANT_BACKUP="${BACKUP_DIR}/qdrant_${TIMESTAMP}"
mkdir -p "${QDRANT_BACKUP}"

if curl -sf http://localhost:6333/readyz > /dev/null 2>&1; then
    # Create snapshot via Qdrant API
    SNAPSHOT=$(curl -sf -X POST http://localhost:6333/collections/nucleus_context/snapshots 2>/dev/null || echo "")
    if [ -n "${SNAPSHOT}" ]; then
        log "Qdrant snapshot created: ${SNAPSHOT}"
    else
        warn "Could not create Qdrant snapshot (collection may not exist yet)"
    fi
else
    warn "Qdrant is not accessible, skipping vector DB backup"
fi

# ---- Cleanup Old Backups -----------------------------------------------------
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "qdrant_*" -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} + 2>/dev/null || true

# ---- Summary -----------------------------------------------------------------
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "db_*.sql.gz" | wc -l)
log "Backup complete. Total backups retained: ${BACKUP_COUNT}"
