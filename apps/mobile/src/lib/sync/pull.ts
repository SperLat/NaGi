// Pull engine: fetches server rows modified since last_pull_at and upserts into SQLite.
// Server row wins on conflict (last-write-wins by updated_at).
import { localDb } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { isMock } from '@/config/mode';

const THIRTY_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
};

function getLastPullAt(): string {
  const row = localDb.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'last_pull_at'",
    [],
  );
  return row?.value ?? '1970-01-01T00:00:00Z';
}

function setLastPullAt(ts: string): void {
  localDb.runSync(
    "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_pull_at', ?)",
    [ts],
  );
}

export async function pullElders(organizationId: string): Promise<void> {
  if (isMock) return;

  const lastPullAt = getLastPullAt();

  const { data: rows, error } = await supabase
    .from('elders')
    .select('*')
    .eq('organization_id', organizationId)
    .gt('updated_at', lastPullAt);

  if (error || !rows) return;

  for (const row of rows as Array<Record<string, unknown>>) {
    const rowId = String(row.id ?? '');
    const local = localDb.getFirstSync<{ updated_at: string }>(
      'SELECT updated_at FROM elders WHERE id = ?',
      [rowId],
    );

    // Server wins if no local row, or server is newer.
    if (!local || String(row.updated_at) >= local.updated_at) {
      localDb.runSync(
        `INSERT OR REPLACE INTO elders
         (id, organization_id, display_name, preferred_lang, profile, profile_version,
          ui_config, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId,
          String(row.organization_id ?? ''),
          String(row.display_name ?? ''),
          String(row.preferred_lang ?? 'es'),
          typeof row.profile === 'string' ? row.profile : JSON.stringify(row.profile ?? {}),
          Number(row.profile_version ?? 1),
          typeof row.ui_config === 'string' ? row.ui_config : JSON.stringify(row.ui_config ?? {}),
          String(row.status ?? 'active'),
          String(row.created_at ?? ''),
          String(row.updated_at ?? ''),
        ],
      );
    }
  }

  setLastPullAt(new Date().toISOString());
}

export async function pullActivityLog(organizationId: string): Promise<void> {
  if (isMock) return;

  const { data: rows, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('server_ts', THIRTY_DAYS_AGO())
    .order('server_ts', { ascending: false })
    .limit(500);

  if (error || !rows) return;

  for (const row of rows as Array<Record<string, unknown>>) {
    // is_private MUST be carried into the local cache. Dropping it here
    // would silently mark every pulled row public (the SQLite column
    // defaults to 0), which would defeat the privacy boundary set by
    // migration 0015 the moment any local-cache reader rendered the
    // payload to the family. Fail closed: anything other than an
    // explicit `true` from the server stays public — but `true` MUST
    // round-trip.
    localDb.runSync(
      `INSERT OR IGNORE INTO activity_log
       (id, elder_id, organization_id, kind, payload, client_ts, server_ts, device_id, is_private)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(row.id ?? ''),
        String(row.elder_id ?? ''),
        String(row.organization_id ?? ''),
        String(row.kind ?? ''),
        typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload ?? {}),
        String(row.client_ts ?? ''),
        String(row.server_ts ?? ''),
        String(row.device_id ?? ''),
        row.is_private === true ? 1 : 0,
      ],
    );
  }
}
