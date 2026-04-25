#!/usr/bin/env bash
# db-safe-stop.sh — snapshot then stop the local Supabase stack.
#
# Use this INSTEAD of `npx supabase stop` directly. The bare CLI command
# has been known to dismantle the Docker volume (data loss) even when
# called with --no-backup. This wrapper takes a guaranteed pg_dump first,
# so a restore is one command away regardless of what stop does.
#
# Usage:
#   pnpm db:safe-stop
#   bash scripts/db-safe-stop.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/2] Backing up local database before stop ..."
"${SCRIPT_DIR}/db-backup.sh"

echo ""
echo "[2/2] Stopping Supabase stack ..."
npx supabase stop

echo ""
echo "Done. To restart and (if needed) restore:"
echo "  npx supabase start"
echo "  ls -lt supabase/.backups/ | head -3   # find the freshest dump"
echo "  docker exec -i supabase_db_Cedar psql -U postgres -d postgres < supabase/.backups/auto-XXXX.sql"
