#!/usr/bin/env bash
# =============================================================================
# Nucleus AI — Database Restore Script
# Usage: ./scripts/deployment/restore.sh <backup_file.sql.gz>
# =============================================================================
set -euo pipefail

BACKUP_FILE="$1"
COMPOSE_FILE="docker-compose.prod.yml"

if [ -z "${BACKUP_FILE}" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Available backups:"
    ls -la /opt/backups/nucleus-ai/db_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "========================================"
echo "WARNING: This will REPLACE the current database!"
echo "Backup file: ${BACKUP_FILE}"
echo "========================================"
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo "[1/4] Stopping backend services..."
docker compose -f "${COMPOSE_FILE}" stop backend frontend

echo "[2/4] Dropping and recreating database..."
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U nucleus -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='nucleus' AND pid <> pg_backend_pid();"
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    dropdb -U nucleus --if-exists nucleus
docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    createdb -U nucleus nucleus

echo "[3/4] Restoring from backup..."
gunzip -c "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    psql -U nucleus nucleus

echo "[4/4] Restarting services..."
docker compose -f "${COMPOSE_FILE}" up -d backend frontend

echo "Restore complete! Verifying health..."
sleep 10
curl -sf http://localhost:8000/health && echo " Backend healthy!" || echo " Backend not responding"
