#!/usr/bin/env bash
# db-backup.sh — snapshot the local Supabase Postgres into a timestamped SQL file.
#
# Why: `npx supabase stop` (with or without --no-backup) has, in some CLI
# versions, dismantled the local Docker volume. We learned this the hard
# way. ALWAYS take a fresh backup before any destructive op, and back up
# routinely if you've done meaningful manual seeding (created elders,
# users, conversations).
#
# Usage:
#   pnpm db:backup              # writes supabase/.backups/auto-<timestamp>.sql
#   bash scripts/db-backup.sh   # same
#
# Restore:
#   docker exec -i supabase_db_Cedar psql -U postgres -d postgres < <file>

set -euo pipefail

CONTAINER="supabase_db_Cedar"
BACKUP_DIR="supabase/.backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/auto-${TIMESTAMP}.sql"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: Container ${CONTAINER} is not running. Start Supabase first." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "Dumping ${CONTAINER} → ${FILE} ..."
docker exec "${CONTAINER}" pg_dump \
  -U postgres \
  -d postgres \
  --clean --if-exists --quote-all-identifiers \
  > "${FILE}"

SIZE_BYTES=$(wc -c < "${FILE}")
SIZE_KB=$((SIZE_BYTES / 1024))
echo "Done. ${FILE} (${SIZE_KB} KB)"

# Prune backups older than 14 days — keep the recent past handy without
# letting the directory grow forever.
find "${BACKUP_DIR}" -name 'auto-*.sql' -type f -mtime +14 -delete 2>/dev/null || true
