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
  options?: { isPrivate?: boolean },
): Promise<void> {
  const entry: ActivityLog = {
    id: crypto.randomUUID(),
    elder_id: elderId,
    organization_id: organizationId,
    kind,
    payload,
    client_ts: new Date().toISOString(),
    device_id: getDeviceId(),
    is_private: options?.isPrivate ?? false,
  };

  if (isMock || !localDb) {
    await db.from('activity_log').insert(entry as unknown as Record<string, unknown>);
    return;
  }

  // SQLite stores booleans as 0/1.
  localDb.runSync(
    `INSERT INTO activity_log (id, elder_id, organization_id, kind, payload, client_ts, device_id, is_private)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      elderId,
      organizationId,
      kind,
      JSON.stringify(payload),
      entry.client_ts,
      entry.device_id,
      entry.is_private ? 1 : 0,
    ],
  );
  // Enqueue for server delivery — idempotent via client_op_id upsert.
  // Use entry.id as the op id so the same SQLite row is the idempotency key.
  void enqueue({ id: entry.id, kind: 'activity_log', payload: entry });
}

/**
 * Bulk-update the privacy state of every ai_turn row for one elder on
 * one calendar day (in their device's local time). Powers the elder
 * home "Today's chat" toggle.
 *
 * Scoped to ai_turn rows because ui_action / error rows carry no
 * substance worth privatizing — flagging them would just confuse the
 * counts on the family dashboard. The day boundary is computed from
 * the device's local timezone, matching what the elder sees as "today".
 */
export async function setDayPrivacy(
  elderId: string,
  date: Date,
  isPrivate: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  // Day window in device-local timezone, expressed in UTC ISO bounds.
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  if (isMock || !localDb) {
    const { error } = await supabase
      .from('activity_log')
      .update({ is_private: isPrivate })
      .eq('elder_id', elderId)
      .eq('kind', 'ai_turn')
      .gte('client_ts', startIso)
      .lt('client_ts', endIso);
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  }

  // Local mirror first so the elder sees the change immediately,
  // then send a single UPDATE op through the outbox so it eventually
  // reaches the cloud row(s). The outbox doesn't currently have a
  // bulk-update primitive; we round-trip through a direct supabase call
  // when online and let the local row state drift slightly otherwise.
  // For a hackathon-scale dataset this is fine.
  localDb.runSync(
    `UPDATE activity_log SET is_private = ?
     WHERE elder_id = ? AND kind = 'ai_turn' AND client_ts >= ? AND client_ts < ?`,
    [isPrivate ? 1 : 0, elderId, startIso, endIso],
  );

  const { error } = await supabase
    .from('activity_log')
    .update({ is_private: isPrivate })
    .eq('elder_id', elderId)
    .eq('kind', 'ai_turn')
    .gte('client_ts', startIso)
    .lt('client_ts', endIso);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/**
 * Read the "is today shared with family?" state. Returns true unless at
 * least one ai_turn row in today's window is marked private.
 *
 * Used by the elder home pill to render the right state.
 */
export async function isDayShared(elderId: string, date: Date): Promise<boolean> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  if (isMock) return true;

  // Local SQLite is the elder's primary surface.
  if (localDb) {
    const row = localDb.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM activity_log
       WHERE elder_id = ? AND kind = 'ai_turn' AND is_private = 1
         AND client_ts >= ? AND client_ts < ?`,
      [elderId, startIso, endIso],
    );
    return (row?.count ?? 0) === 0;
  }

  const { data } = await supabase
    .from('activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('elder_id', elderId)
    .eq('kind', 'ai_turn')
    .eq('is_private', true)
    .gte('client_ts', startIso)
    .lt('client_ts', endIso);
  // If supabase didn't return data for any reason, assume shared (safer
  // default for the family-trust direction — elder can re-toggle).
  return Array.isArray(data) ? data.length === 0 : true;
}

function parseRow(row: Record<string, unknown>): ActivityLog {
  // Privacy must fail closed. SQLite's column is NOT NULL DEFAULT 0, so
  // we shouldn't see undefined/null in practice — but if a future sync
  // path or schema change ever does drop the flag (Finding 1 from the
  // 2026-04-26 QA audit was exactly this kind of bug), treating an
  // unknown privacy state as PRIVATE is the right direction to round
  // off. The elder can always re-share via the daily-share toggle;
  // there is no recovery from "the family already saw it."
  const rawPriv = row.is_private;
  const isPrivate =
    rawPriv === undefined || rawPriv === null
      ? true
      : (rawPriv as number | boolean) === 1 || rawPriv === true;
  return {
    ...(row as unknown as ActivityLog),
    payload: JSON.parse((row.payload as string) || '{}'),
    is_private: isPrivate,
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
    .select('kind, payload, client_ts, is_private')
    .eq('elder_id', elderId)
    .gte('client_ts', sinceIso)
    .order('client_ts', { ascending: false });

  if (!data || data.length === 0) {
    return { counts: EMPTY_COUNTS(), lastSnippets: [], lastActiveAt: null };
  }

  const counts = EMPTY_COUNTS();
  const snippets: string[] = [];
  for (const row of data as Array<{
    kind: string;
    payload: unknown;
    client_ts: string;
    is_private?: boolean;
  }>) {
    const kind = row.kind as ActivityKind;
    if (kind in counts) counts[kind]++;
    // Snippets are the family-facing preview — never include private turns.
    // The COUNT still bumps so the family knows their elder used Nagi N
    // times today, just without the substance of the private moments.
    if (kind === 'ai_turn' && !row.is_private && snippets.length < snippetCount) {
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
