import { localDb } from '@/lib/db';
import { db, supabase } from '@/lib/supabase';
import { enqueue } from '@/features/outbox/enqueue';
import { isMock } from '@/config/mode';
import type { ActivityLog, ActivityKind } from './types';

const THIRTY_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
};

// Lazy-initialized per session to avoid import cycles.
let _deviceId: string | null = null;

function getDeviceId(): string {
  if (_deviceId) return _deviceId;
  if (isMock || !localDb) return 'web-device';
  const row = localDb.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'device_id'",
    [],
  );
  if (row?.value) {
    _deviceId = row.value;
    return _deviceId;
  }
  const id = crypto.randomUUID();
  localDb.runSync("INSERT INTO sync_meta (key, value) VALUES ('device_id', ?)", [id]);
  _deviceId = id;
  return _deviceId;
}

export async function logActivity(
  elderId: string,
  organizationId: string,
  kind: ActivityKind,
  payload: Record<string, unknown>,
): Promise<void> {
  const entry: ActivityLog = {
    id: crypto.randomUUID(),
    elder_id: elderId,
    organization_id: organizationId,
    kind,
    payload,
    client_ts: new Date().toISOString(),
    device_id: getDeviceId(),
  };

  if (isMock || !localDb) {
    await db.from('activity_log').insert(entry as unknown as Record<string, unknown>);
    return;
  }

  localDb.runSync(
    `INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, elderId, organizationId, kind, JSON.stringify(payload), entry.client_ts, entry.device_id],
  );
  // Enqueue for server delivery — idempotent via client_op_id upsert.
  // Use entry.id as the op id so the same SQLite row is the idempotency key.
  void enqueue({ id: entry.id, kind: 'activity_log', payload: entry });
}

function parseRow(row: Record<string, unknown>): ActivityLog {
  return {
    ...(row as unknown as ActivityLog),
    payload: JSON.parse((row.payload as string) || '{}'),
  };
}

export async function listActivity(
  elderId: string,
): Promise<{ data: ActivityLog[]; error: null }> {
  if (isMock || !localDb) {
    const result = await db.from<ActivityLog>('activity_log').select('*').eq('elder_id', elderId);
    return result;
  }
  const rows = localDb.getAllSync<Record<string, unknown>>(
    `SELECT * FROM activity_log
     WHERE elder_id = ? AND client_ts >= ?
     ORDER BY client_ts DESC
     LIMIT 200`,
    [elderId, THIRTY_DAYS_AGO()],
  );
  return { data: rows.map(parseRow), error: null };
}

/**
 * Per-elder roll-up for the intermediary dashboard.
 *
 * Counts each ActivityKind in the recent window, and surfaces the most
 * recent AI message snippets so a caregiver can see at a glance what their
 * elder is asking about today. Always queries Supabase directly — the
 * intermediary is typically on a different device than the elder, so
 * localDb won't have the elder's rows. RLS handles authorization.
 *
 * `lastSnippets` are the *user* side of the last few `ai_turn` entries
 * (what the elder said), not the model's response — that's the more
 * useful grounding for "what's on her mind right now."
 */
export interface ActivitySummary {
  counts: Record<ActivityKind, number>;
  lastSnippets: string[];
  lastActiveAt: string | null;
}

const EMPTY_COUNTS = (): Record<ActivityKind, number> => ({
  ai_turn: 0,
  ui_action: 0,
  error: 0,
  offline_ai_unavailable: 0,
});

export async function summarizeRecentActivity(
  elderId: string,
  sinceHours: number = 24,
  snippetCount: number = 3,
): Promise<ActivitySummary> {
  if (isMock) {
    return { counts: EMPTY_COUNTS(), lastSnippets: [], lastActiveAt: null };
  }

  const sinceIso = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  // Use the real supabase client (typed `any`) because the mock QueryBuilder
  // doesn't implement .gte/.order. The isMock branch above guarantees we
  // never reach this in mock mode.
  const { data } = await supabase
    .from('activity_log')
    .select('kind, payload, client_ts')
    .eq('elder_id', elderId)
    .gte('client_ts', sinceIso)
    .order('client_ts', { ascending: false });

  if (!data || data.length === 0) {
    return { counts: EMPTY_COUNTS(), lastSnippets: [], lastActiveAt: null };
  }

  const counts = EMPTY_COUNTS();
  const snippets: string[] = [];
  for (const row of data as Array<{ kind: string; payload: unknown; client_ts: string }>) {
    const kind = row.kind as ActivityKind;
    if (kind in counts) counts[kind]++;
    if (kind === 'ai_turn' && snippets.length < snippetCount) {
      // payload arrives from Supabase as a parsed JSON object (jsonb column).
      // Defensive: handle the local-cache shape too where it's still a string.
      const raw =
        typeof row.payload === 'string'
          ? JSON.parse(row.payload)
          : (row.payload as Record<string, unknown> | null);
      const message = ((raw?.message as string | undefined) ?? '').trim();
      if (message) snippets.push(message);
    }
  }

  return {
    counts,
    lastSnippets: snippets,
    lastActiveAt: (data[0] as { client_ts?: string } | undefined)?.client_ts ?? null,
  };
}
