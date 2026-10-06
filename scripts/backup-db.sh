#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/lume-$STAMP.dump"

pg_dump "$DATABASE_URL" --format=custom --file="$FILE"
echo "BACKUP_OK $FILE"

# Keep latest 14 local backup files unless RETENTION_COUNT is overridden.
RETENTION_COUNT="${RETENTION_COUNT:-14}"
find "$BACKUP_DIR" -type f -name 'lume-*.dump' -printf '%T@ %p\n' \
  | sort -nr \
  | tail -n +"$((RETENTION_COUNT + 1))" \
  | cut -d' ' -f2- \
  | xargs -r rm -f
