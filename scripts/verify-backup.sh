#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"

TMP_DB="${TMP_DB:-lume_restore_check}"
echo "This script expects a disposable PostgreSQL database."
echo "Backup: $BACKUP_FILE"
echo "Target: $TMP_DB"

createdb "$TMP_DB" 2>/dev/null || true
pg_restore --exit-on-error --dbname="$TMP_DB" "$BACKUP_FILE"
psql "$TMP_DB" -Atc "SELECT 'RESTORE_VERIFY_OK'"
dropdb "$TMP_DB" 2>/dev/null || true
